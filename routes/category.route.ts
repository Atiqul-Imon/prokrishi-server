import { Router } from 'express';
import {
  createCategory,
  getCategories,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
  getFeaturedCategories,
} from '../controllers/category.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.js';
import upload from '../middlewares/multer.js';

const categoryRouter = Router();

categoryRouter.post('/create', authenticate, authorizeAdmin, upload.single('image'), createCategory);
categoryRouter.get('/', getCategories);
categoryRouter.get('/featured', getFeaturedCategories);
categoryRouter.get('/id/:id', getCategoryById);
categoryRouter.get('/:slug', getCategoryBySlug);
categoryRouter.put('/update/:id', authenticate, authorizeAdmin, upload.single('image'), updateCategory);
categoryRouter.patch('/update/:id', authenticate, authorizeAdmin, updateCategory);
categoryRouter.delete('/delete/:id', authenticate, authorizeAdmin, deleteCategory);

export default categoryRouter;

