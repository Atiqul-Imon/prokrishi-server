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

    const searchParams: any = {
      path: '/prokrishi_media/',
      sort: sort === 'createdAt' ? 'A' : 'D',
      limit: parseInt(limit as string),
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
    };

    if (search) {
      searchParams.searchQuery = search;
    }

    if (type !== 'all') {
      if (type === 'image') {
        searchParams.tags = ['image'];
      } else if (type === 'video') {
        searchParams.tags = ['video'];
      } else if (type === 'document') {
        searchParams.tags = ['document'];
      }
    }

    const result: any = await imagekit.listFiles(searchParams);

    const mediaFiles = result.map((file: any) => ({
      id: file.fileId,
      name: file.name,
      url: file.url,
      thumbnailUrl: file.thumbnailUrl || file.url,
      size: file.size,
      width: file.width,
      height: file.height,
      format: file.format,
      tags: file.tags || [],
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      isPrivateFile: file.isPrivateFile,
      customMetadata: file.customMetadata || {},
    }));

    const totalResult = await imagekit.listFiles({
      path: '/prokrishi_media/',
      limit: 1,
    });
    const totalFiles = totalResult.length > 0 ? (totalResult[0] as any).totalCount || 0 : 0;

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

    const allFiles = await imagekit.listFiles({
      path: '/prokrishi_media/',
      limit: 1000,
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

