import Category from "../models/category.model.js";
import slugify from "slugify";
import ImageKit from "imagekit";
import { generateSlug } from "../utils/slugGenerator.js";

// ImageKit config with error handling
let imagekit = null;

try {
  if (process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT) {
    imagekit = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
    });
    console.log('✅ ImageKit initialized successfully for categories');
  } else {
    console.warn('⚠️ ImageKit not configured - category image features will be disabled');
  }
} catch (error) {
  console.error('❌ ImageKit initialization failed for categories:', error);
}

// Helper: Upload to ImageKit from buffer
const uploadToImageKit = (fileBuffer, fileName) => {
  return new Promise((resolve, reject) => {
    if (!imagekit) {
      reject(new Error('ImageKit not configured'));
      return;
    }
    
    imagekit.upload({
      file: fileBuffer,
      fileName: fileName,
      folder: "/prokrishi/categories",
      useUniqueFileName: true,
      // Remove transformation to avoid errors
    }, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
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
    let imagekit_id = null;

    if (req.file) {
      const result = await uploadToImageKit(req.file.buffer, req.file.originalname);
      image_url = result.url;
      imagekit_id = result.fileId;
    }

    // Generate slug with proper Bangla support using utility function

    const category = await Category.create({
      name: name.toLowerCase(),
      slug: generateSlug(name),
      description,
      image: image_url,
      isFeatured: isFeatured || false,
      imagekit_id,
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
      .select('-__v -imagekit_id') // Exclude unnecessary fields
      .lean() // Return plain objects for better performance
      .sort({ createdAt: -1 });
    
    // Categories change infrequently, cache aggressively
    res.set({
      'Cache-Control': 'public, max-age=300, s-maxage=600', // 5 min client, 10 min CDN
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
            'Cache-Control': 'public, max-age=300, s-maxage=600', // 5 min client, 10 min CDN
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
    let imagekit_id = category.imagekit_id;

    if (req.file) {
      // Upload new image (ImageKit handles cleanup automatically)
      const result = await uploadToImageKit(req.file.buffer, req.file.originalname);
      image_url = result.url;
      imagekit_id = result.fileId;
    }

    // Generate slug with proper Bangla support using utility function

    // Build update object - only include fields that are provided
    const updateData = {};
    
    if (name !== undefined) {
      updateData.name = name.toLowerCase();
      updateData.slug = generateSlug(name);
    }
    
    if (description !== undefined) {
      updateData.description = description;
    }
    
    if (isFeatured !== undefined) {
      updateData.isFeatured = isFeatured;
    }
    
    if (req.file) {
      updateData.image = image_url;
      updateData.imagekit_id = imagekit_id;
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

    // ImageKit handles cleanup automatically, no manual deletion needed
    
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
