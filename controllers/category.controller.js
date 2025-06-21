import Category from "../models/category.model.js";
import slugify from "slugify";

// Create Category
export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    const exists = await Category.findOne({ name: name.toLowerCase() });
    if (exists) {
      return res.status(400).json({
        message: "Category already exists",
        error: true,
        success: false,
      });
    }

    const category = await Category.create({
      name: name.toLowerCase(),
      slug: slugify(name),
      description,
    });

    res.status(201).json({
      message: "Category created successfully",
      success: true,
      category,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create category",
      error: error.message,
      success: false,
    });
  }
};

// Get All Categories
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, categories });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching categories",
      error: error.message,
      success: false,
    });
  }
};

// Get Single Category by Slug
export const getCategoryBySlug = async (req, res) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug });

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
        success: false,
      });
    }

    res.status(200).json({ success: true, category });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching category",
      error: error.message,
      success: false,
    });
  }
};

// Update Category
export const updateCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    const updated = await Category.findByIdAndUpdate(
      req.params.id,
      {
        name: name?.toLowerCase(),
        slug: slugify(name),
        description,
      },
      { new: true }
    );

    res.status(200).json({ success: true, category: updated });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update category",
      error: error.message,
      success: false,
    });
  }
};

// Delete Category
export const deleteCategory = async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.status(200).json({
      message: "Category deleted successfully",
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete category",
      error: error.message,
      success: false,
    });
  }
};
