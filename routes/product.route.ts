import { Router, Request, Response } from 'express';
import {
  createProduct,
  getAllProducts,
  getAdminProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getFeaturedProducts,
  getPopularProducts,
  getProductsByCategory,
  getProductsByCategorySlug,
  toggleProductFeatured,
  searchProducts,
  getRelatedProducts,
} from '../controllers/product.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.js';
import upload from '../middlewares/multer.js';

const productRouter = Router();

// Public endpoint - includes fish products
productRouter.get('/', getAllProducts);

// Admin endpoint - excludes fish products (fish products managed separately)
productRouter.get('/admin', authenticate, authorizeAdmin, getAdminProducts);
productRouter.get('/search', searchProducts);
productRouter.get('/featured', getFeaturedProducts);
productRouter.get('/popular', getPopularProducts);
productRouter.get('/category', (_req: Request, res: Response) => {
  res.status(400).json({
    message: 'Category ID or slug is required. Use /product/category/:categoryId or /product/category/slug/:slug',
    success: false,
    error: true,
  });
});
productRouter.get('/category/:categoryId', getProductsByCategory);
productRouter.get('/category/slug/:slug', getProductsByCategorySlug);
productRouter.get('/:id/related', getRelatedProducts);
productRouter.get('/:id', getProductById);

const productUpload = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'galleryImages', maxCount: 10 },
]);

productRouter.post('/create', authenticate, authorizeAdmin, productUpload, createProduct);
productRouter.put('/:id', authenticate, authorizeAdmin, productUpload, updateProduct);
productRouter.delete('/:id', authenticate, authorizeAdmin, deleteProduct);
productRouter.patch('/:id/toggle-featured', authenticate, authorizeAdmin, toggleProductFeatured);

export default productRouter;

