import { Router } from "express";
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from "../controllers/product.controller.js";
import { authenticate, authorizeAdmin } from "../middlewares/auth.js";
import upload from "../middlewares/multer.js";

const productRouter = Router();

// Public Routes
productRouter.get("/", getAllProducts);
productRouter.get("/:id", getProductById);

// Protected Admin Routes
productRouter.post("/create", authenticate, authorizeAdmin, upload.single("image"), createProduct);
productRouter.put("/:id", authenticate, authorizeAdmin, upload.single("image"), updateProduct);
productRouter.delete("/:id", authenticate, authorizeAdmin, deleteProduct);

export default productRouter;
