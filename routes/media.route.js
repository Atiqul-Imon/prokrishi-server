import { Router } from 'express';
import {
  getAllMedia,
  uploadMedia,
  deleteMedia,
  getMediaById,
  updateMedia,
  getMediaStats
} from '../controllers/media.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.js';
import upload from '../middlewares/multer.js';

const mediaRouter = Router();

// Get all media files (admin only)
mediaRouter.get('/', authenticate, authorizeAdmin, getAllMedia);

// Get media statistics (admin only)
mediaRouter.get('/stats', authenticate, authorizeAdmin, getMediaStats);

// Get single media file (admin only)
mediaRouter.get('/:id', authenticate, authorizeAdmin, getMediaById);

// Upload media file (admin only)
mediaRouter.post('/upload', authenticate, authorizeAdmin, upload.single('file'), uploadMedia);

// Update media file (admin only)
mediaRouter.put('/:id', authenticate, authorizeAdmin, updateMedia);

// Delete media file (admin only)
mediaRouter.delete('/:id', authenticate, authorizeAdmin, deleteMedia);

export default mediaRouter;
