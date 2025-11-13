import { Router } from 'express';
import {
  getAllMedia,
  uploadMedia,
  deleteMedia,
  getMediaById,
  updateMedia,
  getMediaStats,
} from '../controllers/media.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.js';
import upload from '../middlewares/multer.js';

const mediaRouter = Router();

mediaRouter.get('/', authenticate, authorizeAdmin, getAllMedia);
mediaRouter.get('/stats', authenticate, authorizeAdmin, getMediaStats);
mediaRouter.get('/:id', authenticate, authorizeAdmin, getMediaById);
mediaRouter.post('/upload', authenticate, authorizeAdmin, upload.single('file'), uploadMedia);
mediaRouter.put('/:id', authenticate, authorizeAdmin, updateMedia);
mediaRouter.delete('/:id', authenticate, authorizeAdmin, deleteMedia);

export default mediaRouter;

