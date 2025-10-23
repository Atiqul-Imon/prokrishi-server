import Category from "../models/category.model.js";
import slugify from "slugify";
import { v2 as cloudinary } from "cloudinary";

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Helper: Upload to Cloudinary from buffer
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "prokrishi_categories" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(fileBuffer);
  });
};

// Create Category
export const createCategory = async (req, res) => {
  try {
    const { name, description, isFeatured } = req.body;

    const exists = await Category.findOne({ name: name.toLowerCase() });
    if (exists) {
      return res.status(400).json({
        message: "Category already exists",
        error: true,
        success: false,
      });
    }

    let image_url = null;
    let cloudinary_id = null;

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      image_url = result.secure_url;
      cloudinary_id = result.public_id;
    }

    const category = await Category.create({
      name: name.toLowerCase(),
      slug: slugify(name),
      description,
      image: image_url,
      isFeatured: isFeatured || false,
      cloudinary_id,
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
    const categories = await Category.find()
      .select('-__v -cloudinary_id') // Exclude unnecessary fields
      .lean() // Return plain objects for better performance
      .sort({ createdAt: -1 });
    
    // Categories change infrequently, cache aggressively
    res.set({
      'Cache-Control': 'public, max-age=3600, s-maxage=7200', // 1 hour client, 2 hours CDN
      'ETag': '"categories-all"'
    });
    
    res.status(200).json({ success: true, categories });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching categories",
      error: error.message,
      success: false,
    });
  }
};

// Get Single Category by ID
export const getCategoryById = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id)
            .select('-__v')
            .lean();

        if (!category) {
            return res.status(404).json({
                message: "Category not found",
                success: false,
            });
        }

        // Add cache headers
        res.set({
            'Cache-Control': 'public, max-age=1800, s-maxage=3600', // 30 min client, 1 hour CDN
            'ETag': `"category-${req.params.id}"`
        });

        res.status(200).json({ success: true, category });
    } catch (error) {
        res.status(500).json({
            message: "Error fetching category",
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
    const { name, description, isFeatured } = req.body;
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: "Category not found", success: false });
    }

    // Handle image update (only if file is provided)
    let image_url = category.image;
    let cloudinary_id = category.cloudinary_id;

    if (req.file) {
      // Delete old image from Cloudinary
      if (category.cloudinary_id) {
        await cloudinary.uploader.destroy(category.cloudinary_id);
      }
      // Upload new image
      const result = await uploadToCloudinary(req.file.buffer);
      image_url = result.secure_url;
      cloudinary_id = result.public_id;
    }

    // Build update object - only include fields that are provided
    const updateData = {};
    
    if (name !== undefined) {
      updateData.name = name.toLowerCase();
      updateData.slug = slugify(name);
    }
    
    if (description !== undefined) {
      updateData.description = description;
    }
    
    if (isFeatured !== undefined) {
      updateData.isFeatured = isFeatured;
    }
    
    if (req.file) {
      updateData.image = image_url;
      updateData.cloudinary_id = cloudinary_id;
    }

    const updated = await Category.findByIdAndUpdate(
      req.params.id,
      updateData,
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
    const category = await Category.findById(req.params.id);

    if (!category) {
        return res.status(404).json({ message: "Category not found", success: false });
    }

    // Delete image from cloudinary
    if (category.cloudinary_id) {
        await cloudinary.uploader.destroy(category.cloudinary_id);
    }
    
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

// @desc    Get featured categories
// @route   GET /api/category/featured
// @access  Public
export const getFeaturedCategories = async (req, res) => {
    try {
        const categories = await Category.find({ isFeatured: true }).limit(8);
        res.status(200).json({
            message: "Featured categories fetched successfully",
            success: true,
            categories,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', success: false, error: true });
    }
};
