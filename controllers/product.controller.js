import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import mongoose from "mongoose";
import ImageKit from "imagekit";
// import cacheService from "../services/cache.js"; // Disabled for admin panel
import logger, { logPerformance } from "../services/logger.js";

// ImageKit config with error handling
let imagekit = null;

try {
  if (process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT) {
    imagekit = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
    });
    logger.info('✅ ImageKit initialized successfully for products');
  } else {
    logger.warn('⚠️ ImageKit not configured - product image features will be disabled');
  }
} catch (error) {
  logger.error('❌ ImageKit initialization failed for products:', error);
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
      folder: "/prokrishi/products",
      useUniqueFileName: true
      // Remove transformation entirely to avoid errors
    }, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
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
      const uploadResult = await uploadToImageKit(req.file.buffer, req.file.originalname);
      imageUrl = uploadResult.url;
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

    // Cache disabled for admin panel

    logger.info(`Product created: ${newProduct.name} (ID: ${newProduct._id})`);

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
  const startTime = Date.now();
  
  try {
    const { page = 1, limit = 20, category, search, sort = 'createdAt', order = 'desc' } = req.query;
    // Cache disabled for admin panel - always fetch from database

    // Simplified query for better reliability
    const query = {};
    if (category) {
      query.category = new mongoose.Types.ObjectId(category);
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    query.status = 'active';

    const products = await Product.find(query)
      .populate('category', 'name slug')
      .sort({ [sort]: order === 'desc' ? -1 : 1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const totalProducts = await Product.countDocuments(query);

    const pagination = {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalProducts / parseInt(limit)),
      totalProducts,
      hasNext: (parseInt(page) * parseInt(limit)) < totalProducts,
      hasPrev: parseInt(page) > 1
    };

    const response = { products, pagination };

    // Cache disabled for admin panel

    logPerformance('getAllProducts', Date.now() - startTime, { 
      source: 'database', 
      count: products.length,
      optimization: 'aggregation_pipeline'
    });
    
    // No caching for admin panel - immediate data updates
    
    res.status(200).json({ ...response, success: true });
  } catch (error) {
    logger.error('Error fetching products:', error);
    res.status(500).json({
      message: "Error fetching products",
      error: true,
      success: false,
    });
  }
};

// ✅ GET SINGLE PRODUCT BY ID OR SLUG
export const getProductById = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    
    // Validate ID format
    if (!id) {
      return res.status(400).json({ 
        message: "Product ID or slug is required", 
        success: false 
      });
    }

    // Build query - support both ObjectId and slug
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const query = isObjectId 
      ? { _id: id }
      : { slug: id };

    // Find product first
    const product = await Product.findOne(query)
      .populate('category', 'name slug description image')
      .select('-__v')
      .lean();

    if (!product) {
      logger.warn(`Product not found: ${id}`);
      return res.status(404).json({ 
        message: "Product not found", 
        success: false,
        productId: id 
      });
    }

    // Increment view count (non-blocking - don't wait for it)
    Product.findByIdAndUpdate(product._id, {
      $inc: { views: 1 },
      $set: { lastViewedAt: new Date() }
    }).catch(err => logger.error('Error incrementing product views:', err));

    logPerformance('getProductById', Date.now() - startTime, { 
      source: 'database',
      productId: product._id 
    });
    
    res.status(200).json({ product, success: true });
  } catch (error) {
    logger.error('Error fetching product:', error);
    
    // More specific error handling
    if (error.name === 'CastError') {
      return res.status(400).json({
        message: "Invalid product ID format",
        error: true,
        success: false,
      });
    }
    
    res.status(500).json({
      message: "Error fetching product",
      error: error.message || "Internal server error",
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

    console.log("Updating product with data:", updateData);
    
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate("category", "name slug");

    if (!updatedProduct)
      return res.status(404).json({ message: "Product not found", success: false });

    console.log("Updated product:", updatedProduct);

    // Cache disabled for admin panel

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
    // Check if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ 
        message: "Invalid product ID format", 
        success: false 
      });
    }
    
    const deleted = await Product.findByIdAndDelete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ message: "Product not found", success: false });
    }

    // Cache disabled for admin panel

    res.status(200).json({
      message: "Product deleted successfully",
      success: true,
    });
  } catch (error) {
    console.error("Delete product error:", error);
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
    const products = await Product.find({ isFeatured: true })
      .populate('category')
      .select('-__v')
      .lean();
    
    // No caching for admin panel - immediate data updates
    
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
    const products = await Product.find({})
      .sort({ sold: -1 }) // Changed from stock to sold (actual popularity)
      .limit(10)
      .populate('category')
      .select('-__v')
      .lean();
    
    // No caching for admin panel - immediate data updates
    
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

// ✅ GET RELATED PRODUCTS
// @desc    Get related products based on category and tags
// @route   GET /api/product/:id/related
// @access  Public
export const getRelatedProducts = async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 6;
    
    // Validate ID
    if (!id) {
      return res.status(400).json({ 
        message: "Product ID is required", 
        success: false 
      });
    }

    // Find the current product
    const query = mongoose.Types.ObjectId.isValid(id) 
      ? { _id: id }
      : { slug: id };
    
    const currentProduct = await Product.findOne(query).select('category tags _id');
    
    if (!currentProduct) {
      return res.status(404).json({ 
        message: "Product not found", 
        success: false 
      });
    }

    // Build query for related products
    const relatedQuery = {
      _id: { $ne: currentProduct._id },
      status: 'active'
    };

    // Prioritize same category
    if (currentProduct.category) {
      relatedQuery.category = currentProduct.category;
    }

    // Find related products
    let relatedProducts = await Product.find(relatedQuery)
      .populate('category', 'name slug')
      .select('name price image category stock status slug shortDescription')
      .limit(limit * 2) // Get more to filter by tags
      .lean();

    // If we have tags, prioritize products with matching tags
    if (currentProduct.tags && currentProduct.tags.length > 0) {
      const taggedProducts = relatedProducts.filter(p => 
        p.tags && p.tags.some(tag => currentProduct.tags.includes(tag))
      );
      const untaggedProducts = relatedProducts.filter(p => 
        !p.tags || !p.tags.some(tag => currentProduct.tags.includes(tag))
      );
      relatedProducts = [...taggedProducts, ...untaggedProducts];
    }

    // Limit to requested number
    relatedProducts = relatedProducts.slice(0, limit);

    // If not enough from same category, fill with popular products
    if (relatedProducts.length < limit) {
      const additionalProducts = await Product.find({
        _id: { $nin: [...relatedProducts.map(p => p._id), currentProduct._id] },
        status: 'active'
      })
        .populate('category', 'name slug')
        .select('name price image category stock status slug shortDescription')
        .sort({ views: -1, sold: -1 })
        .limit(limit - relatedProducts.length)
        .lean();
      
      relatedProducts = [...relatedProducts, ...additionalProducts];
    }

    logPerformance('getRelatedProducts', Date.now() - startTime, { 
      source: 'database',
      count: relatedProducts.length 
    });

    res.status(200).json({ 
      products: relatedProducts,
      success: true 
    });
  } catch (error) {
    logger.error('Error fetching related products:', error);
    res.status(500).json({
      message: "Error fetching related products",
      error: error.message || "Internal server error",
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

    // Execute search with optimizations
    const products = await Product.find(searchQuery)
      .populate('category', 'name slug')
      .select('-__v')
      .lean() // Return plain objects for better performance
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit));

    // Get total count for pagination
    const total = await Product.countDocuments(searchQuery);

    // Get categories for filter options
    const categories = await Category.find()
      .select('name _id slug')
      .lean();

    // No caching for admin panel - immediate data updates

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
