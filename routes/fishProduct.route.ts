import express from 'express';
import {
  getAllFishProducts,
  getFishProductById,
  createFishProduct,
  updateFishProduct,
  deleteFishProduct,
  toggleFishProductFeatured,
} from '../controllers/fishProduct.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.js';
import upload from '../middlewares/multer.js';

const router = express.Router();

// Public routes
router.get('/', getAllFishProducts);
router.get('/:id', getFishProductById);

// Protected admin routes
router.post('/', authenticate, authorizeAdmin, upload.single('image'), createFishProduct);
router.put('/:id', authenticate, authorizeAdmin, upload.single('image'), updateFishProduct);
router.delete('/:id', authenticate, authorizeAdmin, deleteFishProduct);
router.patch('/:id/featured', authenticate, authorizeAdmin, toggleFishProductFeatured);

export default router;

