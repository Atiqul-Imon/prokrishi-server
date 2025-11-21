import { Response } from 'express';
import ImageKit from 'imagekit';
import logger from '../services/logger.js';
import { AuthRequest } from '../types/index.js';

let imagekit: ImageKit | null = null;

try {
  if (
    process.env.IMAGEKIT_PUBLIC_KEY &&
    process.env.IMAGEKIT_PRIVATE_KEY &&
    process.env.IMAGEKIT_URL_ENDPOINT
  ) {
    imagekit = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
    });
    logger.info('✅ ImageKit initialized successfully');
  } else {
    logger.warn('⚠️ ImageKit not configured - media features will be disabled');
  }
} catch (error: any) {
  logger.error('❌ ImageKit initialization failed:', error);
}

export const getAllMedia = async (req: AuthRequest, res: Response): Promise<void> => {

  try {
    if (!imagekit) {
      res.status(503).json({
        success: false,
        message: 'Media service not available - ImageKit not configured',
      });
      return;
    }

    const {
      page = 1,
      limit = 20,
      search,
      sort = 'createdAt',
      type = 'all',
    } = req.query;

    // Fetch all files from ImageKit (ImageKit max limit is 1000)
    // We'll fetch in batches if needed, but for now use max limit
    const allFilesResult: any = await imagekit.listFiles({
      limit: 1000, // Maximum allowed by ImageKit
    });

    // Filter files to only include Prokrishi-related folders
    let filteredFiles = allFilesResult.filter((file: any) => {
      const filePath = file.filePath || '';
      return filePath.includes('/prokrishi') || 
             filePath.includes('/prokrishi_media') ||
             filePath.includes('/prokrishi/products') ||
             filePath.includes('/prokrishi/categories');
    });

    // Apply search filter if provided
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      filteredFiles = filteredFiles.filter((file: any) => 
        file.name?.toLowerCase().includes(searchLower) ||
        file.filePath?.toLowerCase().includes(searchLower)
      );
    }

    // Apply type filter if provided
    if (type !== 'all') {
      if (type === 'image') {
        filteredFiles = filteredFiles.filter((file: any) => 
          file.fileType === 'image' || 
          file.format?.toLowerCase().match(/jpg|jpeg|png|gif|webp|svg/)
        );
      } else if (type === 'video') {
        filteredFiles = filteredFiles.filter((file: any) => 
          file.fileType === 'video' || 
          file.format?.toLowerCase().match(/mp4|avi|mov|wmv|flv|webm/)
        );
      } else if (type === 'document') {
        filteredFiles = filteredFiles.filter((file: any) => 
          file.fileType === 'non-image' && 
          !file.format?.toLowerCase().match(/mp4|avi|mov|wmv|flv|webm/)
        );
      }
    }

    const result = filteredFiles;

    // Map and sort files based on sort parameter
    let mediaFiles = result.map((file: any) => {
      // Clean up file name - extract from filePath if name is garbled
      let fileName = file.name;
      if (!fileName || fileName.includes('à__') || fileName.match(/^[à_]+/)) {
        // If name is garbled, try to extract from filePath
        if (file.filePath) {
          const pathParts = file.filePath.split('/');
          fileName = pathParts[pathParts.length - 1] || file.fileId;
        } else if (file.url) {
          // Extract from URL
          try {
            const urlParts = new URL(file.url).pathname.split('/');
            fileName = decodeURIComponent(urlParts[urlParts.length - 1]) || file.fileId;
          } catch {
            fileName = file.fileId;
          }
        } else {
          fileName = file.fileId;
        }
      }
      
      // Decode URI component if needed
      try {
        fileName = decodeURIComponent(fileName);
      } catch {
        // If decode fails, use as is
      }

      return {
        id: file.fileId,
        name: fileName,
        url: file.url,
        thumbnailUrl: file.thumbnailUrl || file.url,
        size: file.size,
        width: file.width,
        height: file.height,
        format: file.format || file.name?.split('.').pop()?.toLowerCase() || 'unknown',
        tags: file.tags || [],
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        isPrivateFile: file.isPrivateFile,
        customMetadata: file.customMetadata || {},
      };
    });

    // Sort files based on sort parameter and order
    const order = req.query.order === 'asc' ? 1 : -1;
    if (sort === 'createdAt') {
      mediaFiles.sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return (dateA - dateB) * order;
      });
    } else if (sort === 'name') {
      mediaFiles.sort((a: any, b: any) => {
        return a.name.localeCompare(b.name) * order;
      });
    } else if (sort === 'size') {
      mediaFiles.sort((a: any, b: any) => {
        return (a.size - b.size) * order;
      });
    }

    // Apply pagination after sorting
    const startIndex = (parseInt(page as string) - 1) * parseInt(limit as string);
    const endIndex = startIndex + parseInt(limit as string);
    mediaFiles = mediaFiles.slice(startIndex, endIndex);

    // Total files is the filtered result length
    const totalFiles = result.length;

    const pagination = {
      currentPage: parseInt(page as string),
      totalPages: Math.ceil(totalFiles / parseInt(limit as string)),
      totalFiles,
      hasNext: parseInt(page as string) * parseInt(limit as string) < totalFiles,
      hasPrev: parseInt(page as string) > 1,
    };

    logger.info(`Media gallery fetched: ${mediaFiles.length} files, page ${page as string}`);

    res.json({
      success: true,
      mediaFiles,
      pagination,
    });
  } catch (error: any) {
    logger.error('Get media files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch media files',
      error: error.message,
    });
  }
};

export const uploadMedia = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!imagekit) {
      res.status(503).json({
        success: false,
        message: 'Media service not available - ImageKit not configured',
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file provided',
      });
      return;
    }

    const { tags, customMetadata } = req.body;
    const file = req.file;

    const fileType = file.mimetype.startsWith('image/')
      ? 'image'
      : file.mimetype.startsWith('video/')
      ? 'video'
      : 'document';

    const fileTags = tags ? (tags as string).split(',').map((tag) => tag.trim()) : [fileType];
    fileTags.push('prokrishi_media');

    const uploadResult: any = await imagekit.upload({
      file: file.buffer,
      fileName: file.originalname,
      folder: '/prokrishi_media/',
      tags: fileTags,
      customMetadata: customMetadata ? JSON.parse(customMetadata as string) : {},
    });

    logger.info(`Media uploaded: ${uploadResult.name} (${uploadResult.fileId})`);

    res.status(201).json({
      success: true,
      message: 'Media uploaded successfully',
      media: {
        id: uploadResult.fileId,
        name: uploadResult.name,
        url: uploadResult.url,
        thumbnailUrl: uploadResult.thumbnailUrl || uploadResult.url,
        size: uploadResult.size,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format || file.mimetype.split('/')[1],
        tags: uploadResult.tags,
        createdAt: uploadResult.createdAt || new Date(),
        isPrivateFile: uploadResult.isPrivateFile,
      },
    });
  } catch (error: any) {
    logger.error('Upload media error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload media',
      error: error.message,
    });
  }
};

export const deleteMedia = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!imagekit) {
      res.status(503).json({
        success: false,
        message: 'Media service not available - ImageKit not configured',
      });
      return;
    }

    const { id } = req.params;
    await imagekit.deleteFile(id);

    logger.info(`Media deleted: ${id}`);

    res.json({
      success: true,
      message: 'Media deleted successfully',
    });
  } catch (error: any) {
    logger.error('Delete media error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete media',
      error: error.message,
    });
  }
};

export const getMediaById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!imagekit) {
      res.status(503).json({
        success: false,
        message: 'Media service not available - ImageKit not configured',
      });
      return;
    }

    const { id } = req.params;
    const fileDetails: any = await imagekit.getFileDetails(id);

    res.json({
      success: true,
      media: {
        id: fileDetails.fileId,
        name: fileDetails.name,
        url: fileDetails.url,
        thumbnailUrl: fileDetails.thumbnail || fileDetails.url,
        size: fileDetails.size,
        width: fileDetails.width,
        height: fileDetails.height,
        format: fileDetails.format || fileDetails.name.split('.').pop(),
        tags: fileDetails.tags,
        createdAt: fileDetails.createdAt,
        updatedAt: fileDetails.updatedAt,
        isPrivateFile: fileDetails.isPrivateFile,
        customMetadata: fileDetails.customMetadata,
      },
    });
  } catch (error: any) {
    logger.error('Get media details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get media details',
      error: error.message,
    });
  }
};

export const updateMedia = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!imagekit) {
      res.status(503).json({
        success: false,
        message: 'Media service not available - ImageKit not configured',
      });
      return;
    }

    const { id } = req.params;
    const { tags, customMetadata } = req.body;

    const updateData: any = {};
    if (tags) {
      updateData.tags = (tags as string).split(',').map((tag) => tag.trim());
    }
    if (customMetadata) {
      updateData.customMetadata = JSON.parse(customMetadata as string);
    }

    await imagekit.updateFileDetails(id, updateData);

    logger.info(`Media updated: ${id}`);

    res.json({
      success: true,
      message: 'Media updated successfully',
    });
  } catch (error: any) {
    logger.error('Update media error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update media',
      error: error.message,
    });
  }
};

export const getMediaStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!imagekit) {
      res.status(503).json({
        success: false,
        message: 'Media service not available - ImageKit not configured',
      });
      return;
    }

    // Fetch all files from ImageKit (ImageKit max limit is 1000)
    const allFilesResult = await imagekit.listFiles({
      limit: 1000, // Maximum allowed by ImageKit
    });

    // Filter to only Prokrishi-related files
    const allFiles = allFilesResult.filter((file: any) => {
      const filePath = file.filePath || '';
      return filePath.includes('/prokrishi') || 
             filePath.includes('/prokrishi_media') ||
             filePath.includes('/prokrishi/products') ||
             filePath.includes('/prokrishi/categories');
    });

    const stats = {
      totalFiles: allFiles.length,
      totalSize: allFiles.reduce((sum: number, file: any) => sum + (file.size || 0), 0),
      imageCount: allFiles.filter((file: any) => file.tags?.includes('image')).length,
      videoCount: allFiles.filter((file: any) => file.tags?.includes('video')).length,
      documentCount: allFiles.filter((file: any) => file.tags?.includes('document')).length,
      recentUploads: allFiles
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map((file: any) => ({
          id: file.fileId,
          name: file.name,
          url: file.url,
          thumbnailUrl: file.thumbnailUrl || file.url,
          createdAt: file.createdAt,
        })),
    };

    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    logger.error('Get media stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get media statistics',
      error: error.message,
    });
  }
};

