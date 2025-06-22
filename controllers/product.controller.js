import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
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
      { folder: "prokrishi_products" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(fileBuffer);
  });
};

// ✅ CREATE PRODUCT
export const createProduct = async (req, res) => {
  try {
    const { name, category, price, stock, status, description } = req.body;
    let imageUrl = "";

    // Validate category
    const existingCategory = await Category.findById(category);
    if (!existingCategory) {
      return res.status(400).json({ message: "Invalid category ID", success: false });
    }

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer);
      imageUrl = uploadResult.secure_url;
    } else if (req.body.image) {
      imageUrl = req.body.image;
    }

    const newProduct = await Product.create({
      name,
      category,
      price,
      stock,
      status,
      description,
      image: imageUrl,
    });

    res.status(201).json({
      message: "Product created successfully",
      product: newProduct,
      success: true,
    });
  } catch (error) {
    console.error("Create Product Error:", error.message);
    res.status(500).json({
      message: "Server error while creating product",
      error: true,
      success: false,
    });
  }
};

// ✅ GET ALL PRODUCTS
export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("category", "name slug")
      .sort({ createdAt: -1 });

    res.status(200).json({ products, success: true });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching products",
      error: true,
      success: false,
    });
  }
};

// ✅ GET SINGLE PRODUCT BY ID
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category');

    if (!product)
      return res.status(404).json({ message: "Product not found", success: false });

    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching product",
      error: true,
      success: false,
    });
  }
};

// ✅ UPDATE PRODUCT
export const updateProduct = async (req, res) => {
  try {
    const { name, category, price, stock, status, description, measurement, unit, lowStockThreshold, isFeatured } = req.body;

    const updateData = { 
      name, 
      category, 
      price, 
      stock, 
      status, 
      description, 
      measurement, 
      unit,
      lowStockThreshold,
      isFeatured
    };

    // Keep only fields that are not undefined to prevent overwriting with null
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);
    
    // Validate new category if changed
    if (category) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(400).json({ message: "Invalid category ID", success: false });
      }
    }

    // If a new file is uploaded, update the image URL
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer);
      updateData.image = uploadResult.secure_url;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate("category", "name slug");

    if (!updatedProduct)
      return res.status(404).json({ message: "Product not found", success: false });

    res.status(200).json({
      message: "Product updated successfully",
      product: updatedProduct,
      success: true,
    });
  } catch (error) {
    console.error("Update Product Error:", error.message);
    res.status(500).json({
      message: "Error updating product",
      error: true,
      success: false,
    });
  }
};

// ✅ DELETE PRODUCT
export const deleteProduct = async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ message: "Product not found", success: false });

    res.status(200).json({
      message: "Product deleted successfully",
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error deleting product",
      error: true,
      success: false,
    });
  }
};

// @desc    Get featured products
// @route   GET /api/product/featured
// @access  Public
export const getFeaturedProducts = async (req, res) => {
  try {
    const products = await Product.find({ isFeatured: true }).limit(10).populate('category');
    res.status(200).json({
      message: "Featured products fetched successfully",
      success: true,
      products,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', success: false, error: true });
  }
};

// @desc    Get popular products (placeholder for top-selling)
// @route   GET /api/product/popular
// @access  Public
export const getPopularProducts = async (req, res) => {
  try {
    const products = await Product.find({}).sort({ stock: -1 }).limit(10).populate('category');
    res.status(200).json({
      message: "Popular products fetched successfully",
      success: true,
      products,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', success: false, error: true });
  }
};

// @desc    Get products by category
// @route   GET /api/product/category/:categoryId
// @access  Public
export const getProductsByCategory = async (req, res) => {
  try {
    const products = await Product.find({ category: req.params.categoryId }).populate('category');
    res.status(200).json({
      message: "Products by category fetched successfully",
      success: true,
      products,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', success: false, error: true });
  }
};

// @desc    Get products by category slug
// @route   GET /api/product/category/slug/:slug
// @access  Public
export const getProductsByCategorySlug = async (req, res) => {
  try {
    // First find the category by slug
    const category = await Category.findOne({ slug: req.params.slug });
    
    if (!category) {
      return res.status(404).json({
        message: "Category not found",
        success: false,
      });
    }

    // Then find products by category ID
    const products = await Product.find({ category: category._id }).populate('category');
    
    res.status(200).json({
      message: "Products by category fetched successfully",
      success: true,
      products,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', success: false, error: true });
  }
};

// @desc    Toggle featured status of a product
// @route   PATCH /api/product/:id/toggle-featured
// @access  Private (Admin only)
export const toggleProductFeatured = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        message: "Product not found",
        success: false,
      });
    }

    // Toggle the featured status
    product.isFeatured = !product.isFeatured;
    await product.save();

    res.status(200).json({
      message: `Product ${product.isFeatured ? 'marked as' : 'removed from'} featured successfully`,
      success: true,
      product,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error toggling featured status",
      error: error.message,
      success: false,
    });
  }
};

// @desc    Search products
// @route   GET /api/product/search
// @access  Public
export const searchProducts = async (req, res) => {
  try {
    const {
      q = '', // search query
      category = '', // category filter
      minPrice = 0,
      maxPrice = 999999,
      sortBy = 'name', // name, price, createdAt
      sortOrder = 'asc', // asc, desc
      page = 1,
      limit = 12,
      status = 'active'
    } = req.query;

    // Build search query
    let searchQuery = {};

    // Text search in name and description
    if (q.trim()) {
      searchQuery.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ];
    }

    // Category filter
    if (category) {
      searchQuery.category = category;
    }

    // Price range filter
    searchQuery.price = { $gte: Number(minPrice), $lte: Number(maxPrice) };

    // Status filter
    if (status) {
      searchQuery.status = status;
    }

    // Build sort object
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Execute search
    const products = await Product.find(searchQuery)
      .populate('category', 'name slug')
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit));

    // Get total count for pagination
    const total = await Product.countDocuments(searchQuery);

    // Get categories for filter options
    const categories = await Category.find().select('name _id slug');

    res.status(200).json({
      message: "Search completed successfully",
      success: true,
      products,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalProducts: total,
        hasNextPage: Number(page) * Number(limit) < total,
        hasPrevPage: Number(page) > 1
      },
      filters: {
        query: q,
        category,
        minPrice: Number(minPrice),
        maxPrice: Number(maxPrice),
        sortBy,
        sortOrder,
        status
      },
      categories
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      message: 'Server error during search', 
      success: false, 
      error: true 
    });
  }
};
