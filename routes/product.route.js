import { Router } from "express";
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getFeaturedProducts,
  getPopularProducts,
  getProductsByCategory,
  getProductsByCategorySlug,
  toggleProductFeatured,
  searchProducts,
} from "../controllers/product.controller.js";
import { authenticate, authorizeAdmin } from "../middlewares/auth.js";
import upload from "../middlewares/multer.js";

const productRouter = Router();

// Public Routes
productRouter.get("/", getAllProducts);
productRouter.get("/search", searchProducts);
productRouter.get("/featured", getFeaturedProducts);
productRouter.get("/popular", getPopularProducts);
productRouter.get("/category", (req, res) => {
  res.status(400).json({
    message: "Category ID or slug is required. Use /product/category/:categoryId or /product/category/slug/:slug",
    success: false,
    error: true
  });
});
productRouter.get("/category/:categoryId", getProductsByCategory);
productRouter.get("/category/slug/:slug", getProductsByCategorySlug);
productRouter.get("/:id", getProductById);

// Protected Admin Routes
productRouter.post("/create", authenticate, authorizeAdmin, upload.single("image"), createProduct);
productRouter.put("/:id", authenticate, authorizeAdmin, upload.single("image"), updateProduct);
productRouter.delete("/:id", authenticate, authorizeAdmin, deleteProduct);
productRouter.patch("/:id/toggle-featured", authenticate, authorizeAdmin, toggleProductFeatured);

export default productRouter;
