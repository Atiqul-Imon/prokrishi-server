import ImageKit from 'imagekit';
import logger from '../services/logger.js';
import cacheService from '../services/cache.js';

// Initialize ImageKit with error handling
let imagekit = null;

try {
  if (process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT) {
    imagekit = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
    });
    logger.info('✅ ImageKit initialized successfully');
  } else {
    logger.warn('⚠️ ImageKit not configured - media features will be disabled');
  }
} catch (error) {
  logger.error('❌ ImageKit initialization failed:', error);
}

// @desc    Get all media files
// @route   GET /api/media
// @access  Private/Admin
export const getAllMedia = async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!imagekit) {
      return res.status(503).json({
        success: false,
        message: 'Media service not available - ImageKit not configured'
      });
    }
    const { 
      page = 1, 
      limit = 20, 
      search, 
      sort = 'createdAt', 
      order = 'desc',
      type = 'all' // all, image, video, document
    } = req.query;

    // Build search parameters
    const searchParams = {
      path: '/prokrishi_media/',
      sort: sort === 'createdAt' ? 'A' : 'D',
      limit: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit)
    };

    // Add search if provided
    if (search) {
      searchParams.searchQuery = search;
    }

    // Add file type filter
    if (type !== 'all') {
      if (type === 'image') {
        searchParams.tags = ['image'];
      } else if (type === 'video') {
        searchParams.tags = ['video'];
      } else if (type === 'document') {
        searchParams.tags = ['document'];
      }
    }

    // Get files from ImageKit
    const result = await imagekit.listFiles(searchParams);
    
    // Process files for consistent response
    const mediaFiles = result.map(file => ({
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
      customMetadata: file.customMetadata || {}
    }));

    // Get total count for pagination
    const totalResult = await imagekit.listFiles({
      path: '/prokrishi_media/',
      limit: 1
    });
    const totalFiles = totalResult.length > 0 ? totalResult[0].totalCount || 0 : 0;

    const pagination = {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalFiles / parseInt(limit)),
      totalFiles,
      hasNext: (parseInt(page) * parseInt(limit)) < totalFiles,
      hasPrev: parseInt(page) > 1
    };

    // Cache the result
    const cacheKey = `media:${page}:${limit}:${search || 'all'}:${type}:${sort}:${order}`;
    await cacheService.set(cacheKey, { mediaFiles, pagination }, 300); // 5 minutes cache

    logger.info(`Media gallery fetched: ${mediaFiles.length} files, page ${page}`);

    res.json({
      success: true,
      mediaFiles,
      pagination
    });

  } catch (error) {
    logger.error('Get media files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch media files',
      error: error.message
    });
  }
};

// @desc    Upload media file
// @route   POST /api/media/upload
// @access  Private/Admin
export const uploadMedia = async (req, res) => {
  try {
    if (!imagekit) {
      return res.status(503).json({
        success: false,
        message: 'Media service not available - ImageKit not configured'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    const { tags, customMetadata } = req.body;
    const file = req.file;

    // Determine file type and tags
    const fileType = file.mimetype.startsWith('image/') ? 'image' : 
                    file.mimetype.startsWith('video/') ? 'video' : 'document';
    
    const fileTags = tags ? tags.split(',').map(tag => tag.trim()) : [fileType];
    fileTags.push('prokrishi_media');

    // Upload to ImageKit
    const uploadResult = await imagekit.upload({
      file: file.buffer,
      fileName: file.originalname,
      folder: '/prokrishi_media/',
      tags: fileTags,
      customMetadata: customMetadata ? JSON.parse(customMetadata) : {}
    });

    // Invalidate media cache
    await cacheService.delPattern('media:*');

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
        format: uploadResult.format,
        tags: uploadResult.tags,
        createdAt: uploadResult.createdAt,
        isPrivateFile: uploadResult.isPrivateFile
      }
    });

  } catch (error) {
    logger.error('Upload media error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload media',
      error: error.message
    });
  }
};

// @desc    Delete media file
// @route   DELETE /api/media/:id
// @access  Private/Admin
export const deleteMedia = async (req, res) => {
  try {
    if (!imagekit) {
      return res.status(503).json({
        success: false,
        message: 'Media service not available - ImageKit not configured'
      });
    }

    const { id } = req.params;

    // Delete from ImageKit
    await imagekit.deleteFile(id);

    // Invalidate media cache
    await cacheService.delPattern('media:*');

    logger.info(`Media deleted: ${id}`);

    res.json({
      success: true,
      message: 'Media deleted successfully'
    });

  } catch (error) {
    logger.error('Delete media error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete media',
      error: error.message
    });
  }
};

// @desc    Get media file details
// @route   GET /api/media/:id
// @access  Private/Admin
export const getMediaById = async (req, res) => {
  try {
    if (!imagekit) {
      return res.status(503).json({
        success: false,
        message: 'Media service not available - ImageKit not configured'
      });
    }

    const { id } = req.params;

    // Get file details from ImageKit
    const fileDetails = await imagekit.getFileDetails(id);

    res.json({
      success: true,
      media: {
        id: fileDetails.fileId,
        name: fileDetails.name,
        url: fileDetails.url,
        thumbnailUrl: fileDetails.thumbnailUrl || fileDetails.url,
        size: fileDetails.size,
        width: fileDetails.width,
        height: fileDetails.height,
        format: fileDetails.format,
        tags: fileDetails.tags,
        createdAt: fileDetails.createdAt,
        updatedAt: fileDetails.updatedAt,
        isPrivateFile: fileDetails.isPrivateFile,
        customMetadata: fileDetails.customMetadata
      }
    });

  } catch (error) {
    logger.error('Get media details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get media details',
      error: error.message
    });
  }
};

// @desc    Update media file
// @route   PUT /api/media/:id
// @access  Private/Admin
export const updateMedia = async (req, res) => {
  try {
    if (!imagekit) {
      return res.status(503).json({
        success: false,
        message: 'Media service not available - ImageKit not configured'
      });
    }

    const { id } = req.params;
    const { tags, customMetadata } = req.body;

    // Update file in ImageKit
    const updateData = {};
    if (tags) {
      updateData.tags = tags.split(',').map(tag => tag.trim());
    }
    if (customMetadata) {
      updateData.customMetadata = JSON.parse(customMetadata);
    }

    await imagekit.updateFileDetails(id, updateData);

    // Invalidate media cache
    await cacheService.delPattern('media:*');

    logger.info(`Media updated: ${id}`);

    res.json({
      success: true,
      message: 'Media updated successfully'
    });

  } catch (error) {
    logger.error('Update media error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update media',
      error: error.message
    });
  }
};

// @desc    Get media statistics
// @route   GET /api/media/stats
// @access  Private/Admin
export const getMediaStats = async (req, res) => {
  try {
    if (!imagekit) {
      return res.status(503).json({
        success: false,
        message: 'Media service not available - ImageKit not configured'
      });
    }

    // Get all files for statistics
    const allFiles = await imagekit.listFiles({
      path: '/prokrishi_media/',
      limit: 1000 // Get more files for accurate stats
    });

    const stats = {
      totalFiles: allFiles.length,
      totalSize: allFiles.reduce((sum, file) => sum + (file.size || 0), 0),
      imageCount: allFiles.filter(file => file.tags?.includes('image')).length,
      videoCount: allFiles.filter(file => file.tags?.includes('video')).length,
      documentCount: allFiles.filter(file => file.tags?.includes('document')).length,
      recentUploads: allFiles
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
        .map(file => ({
          id: file.fileId,
          name: file.name,
          url: file.url,
          thumbnailUrl: file.thumbnailUrl || file.url,
          createdAt: file.createdAt
        }))
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    logger.error('Get media stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get media statistics',
      error: error.message
    });
  }
};
