import { Router } from "express";
import {
  createCategory,
  getCategories,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory,
  getFeaturedCategories
} from "../controllers/category.controller.js";

import { authenticate, authorizeAdmin } from "../middlewares/auth.js";
import upload from "../middlewares/multer.js";

const categoryRouter = Router();

// Create category (admin only)
categoryRouter.post("/create", authenticate, authorizeAdmin, upload.single("image"), createCategory);

// Get all categories
categoryRouter.get("/", getCategories);

// Get featured categories
categoryRouter.get("/featured", getFeaturedCategories);

// Get single category by ID
categoryRouter.get("/id/:id", getCategoryById);

// Get single category by slug
categoryRouter.get("/:slug", getCategoryBySlug);

// Update category by ID (admin only)
categoryRouter.put("/update/:id", authenticate, authorizeAdmin, upload.single("image"), updateCategory);

// Delete category by ID (admin only)
categoryRouter.delete("/delete/:id", authenticate, authorizeAdmin, deleteCategory);

export default categoryRouter;
