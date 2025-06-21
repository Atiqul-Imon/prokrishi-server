import { Router } from "express";
import {
  createCategory,
  getCategories,
  getCategoryBySlug,
  updateCategory,
  deleteCategory
} from "../controllers/category.controller.js";

import { authenticate, authorizeAdmin } from "../middlewares/auth.js";

const categoryRouter = Router();

// Create category (admin only)
categoryRouter.post("/create", authenticate, authorizeAdmin, createCategory);

// Get all categories
categoryRouter.get("/", getCategories);

// Get single category by slug
categoryRouter.get("/:slug", getCategoryBySlug);

// Update category by ID (admin only)
categoryRouter.put("/update/:id", authenticate, authorizeAdmin, updateCategory);

// Delete category by ID (admin only)
categoryRouter.delete("/delete/:id", authenticate, authorizeAdmin, deleteCategory);

export default categoryRouter;
