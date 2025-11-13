import { Response } from 'express';
import Product from '../models/product.model.js';
import Category from '../models/category.model.js';
import mongoose from 'mongoose';
import ImageKit from 'imagekit';
import logger, { logPerformance } from '../services/logger.js';
import { AuthRequest } from '../types/index.js';

let imagekit: ImageKit | null = null;

try {
  if (
    process.env.IMAGEKIT_PUBLIC_KEY &&
    process.env.IMAGEKIT_PRIVATE_KEY &&
    process.env.IMAGEKIT_URL_ENDPOINT
  ) {
    imagekit = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
    });
    logger.info('✅ ImageKit initialized successfully for products');
  } else {
    logger.warn('⚠️ ImageKit not configured - product image features will be disabled');
  }
} catch (error: any) {
  logger.error('❌ ImageKit initialization failed for products:', error);
}

const uploadToImageKit = (
  fileBuffer: Buffer,
  fileName: string
): Promise<{ url: string; fileId: string }> => {
  return new Promise((resolve, reject) => {
    if (!imagekit) {
      reject(new Error('ImageKit not configured'));
      return;
    }

    imagekit.upload(
      {
        file: fileBuffer,
        fileName: fileName,
        folder: '/prokrishi/products',
        useUniqueFileName: true,
      },
      (error: any, result: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
  });
};

export const createProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, category, price, stock, status, description } = req.body;
    let imageUrl = '';

    const existingCategory = await Category.findById(category);
    if (!existingCategory) {
      res.status(400).json({ message: 'Invalid category ID', success: false });
      return;
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

    logger.info(`Product created: ${(newProduct as any).name} (ID: ${(newProduct as any)._id})`);

    res.status(201).json({
      message: 'Product created successfully',
      product: newProduct,
      success: true,
    });
  } catch (error: any) {
    console.error('Create Product Error:', error.message);
    res.status(500).json({
      message: 'Server error while creating product',
      error: true,
      success: false,
    });
  }
};

export const getAllProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  const startTime = Date.now();

  try {
    const {
      page = 1,
      limit = 20,
      category,
      search,
      sort = 'createdAt',
      order = 'desc',
    } = req.query;

    const query: any = {};
    if (category) {
      query.category = new mongoose.Types.ObjectId(category as string);
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    query.status = 'active';

    const products = await Product.find(query)
      .populate('category', 'name slug')
      .sort({ [sort as string]: order === 'desc' ? -1 : 1 })
      .skip((parseInt(page as string) - 1) * parseInt(limit as string))
      .limit(parseInt(limit as string))
      .lean();

    const totalProducts = await Product.countDocuments(query);

    const pagination = {
      currentPage: parseInt(page as string),
      totalPages: Math.ceil(totalProducts / parseInt(limit as string)),
      totalProducts,
      hasNext: parseInt(page as string) * parseInt(limit as string) < totalProducts,
      hasPrev: parseInt(page as string) > 1,
    };

    logPerformance('getAllProducts', Date.now() - startTime, {
      source: 'database',
      count: products.length,
      optimization: 'aggregation_pipeline',
    });

    res.status(200).json({ products, pagination, success: true });
  } catch (error: any) {
    logger.error('Error fetching products:', error);
    res.status(500).json({
      message: 'Error fetching products',
      error: true,
      success: false,
    });
  }
};

export const getProductById = async (req: AuthRequest, res: Response): Promise<void> => {
  const startTime = Date.now();

  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        message: 'Product ID or slug is required',
        success: false,
      });
      return;
    }

    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const query = isObjectId ? { _id: id } : { slug: id };

    const product = await Product.findOne(query)
      .populate('category', 'name slug description image')
      .select('-__v')
      .lean();

    if (!product) {
      logger.warn(`Product not found: ${id}`);
      res.status(404).json({
        message: 'Product not found',
        success: false,
        productId: id,
      });
      return;
    }

    Product.findByIdAndUpdate((product as any)._id, {
      $inc: { views: 1 },
      $set: { lastViewedAt: new Date() },
    }).catch((err) => logger.error('Error incrementing product views:', err));

    logPerformance('getProductById', Date.now() - startTime, {
      source: 'database',
      productId: (product as any)._id,
    });

    res.status(200).json({ product, success: true });
  } catch (error: any) {
    logger.error('Error fetching product:', error);

    if (error.name === 'CastError') {
      res.status(400).json({
        message: 'Invalid product ID format',
        error: true,
        success: false,
      });
      return;
    }

    res.status(500).json({
      message: 'Error fetching product',
      error: error.message || 'Internal server error',
      success: false,
    });
  }
};

export const updateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      name,
      category,
      price,
      stock,
      status,
      description,
      measurement,
      unit,
      lowStockThreshold,
      isFeatured,
    } = req.body;

    const updateData: any = {
      name,
      category,
      price,
      stock,
      status,
      description,
      measurement,
      unit,
      lowStockThreshold,
      isFeatured,
    };

    Object.keys(updateData).forEach(
      (key) => updateData[key] === undefined && delete updateData[key]
    );

    if (category) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        res.status(400).json({ message: 'Invalid category ID', success: false });
        return;
      }
    }

    if (req.file) {
      const uploadResult = await uploadToImageKit(req.file.buffer, req.file.originalname);
      updateData.image = uploadResult.url;
    }

    console.log('Updating product with data:', updateData);

    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).populate('category', 'name slug');

    if (!updatedProduct) {
      res.status(404).json({ message: 'Product not found', success: false });
      return;
    }

    console.log('Updated product:', updatedProduct);

    res.status(200).json({
      message: 'Product updated successfully',
      product: updatedProduct,
      success: true,
    });
  } catch (error: any) {
    console.error('Update Product Error:', error.message);
    res.status(500).json({
      message: 'Error updating product',
      error: true,
      success: false,
    });
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({
        message: 'Invalid product ID format',
        success: false,
      });
      return;
    }

    const deleted = await Product.findByIdAndDelete(req.params.id);

    if (!deleted) {
      res.status(404).json({ message: 'Product not found', success: false });
      return;
    }

    res.status(200).json({
      message: 'Product deleted successfully',
      success: true,
    });
  } catch (error: any) {
    console.error('Delete product error:', error);
    res.status(500).json({
      message: 'Error deleting product',
      error: true,
      success: false,
    });
  }
};

export const getFeaturedProducts = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const products = await Product.find({ isFeatured: true })
      .populate('category')
      .select('-__v')
      .lean();

    res.status(200).json({
      message: 'Featured products fetched successfully',
      success: true,
      products,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error', success: false, error: true });
  }
};

export const getPopularProducts = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const products = await Product.find({})
      .sort({ sold: -1 })
      .limit(10)
      .populate('category')
      .select('-__v')
      .lean();

    res.status(200).json({
      message: 'Popular products fetched successfully',
      success: true,
      products,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error', success: false, error: true });
  }
};

export const getProductsByCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const products = await Product.find({ category: req.params.categoryId }).populate('category');
    res.status(200).json({
      message: 'Products by category fetched successfully',
      success: true,
      products,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error', success: false, error: true });
  }
};

export const getProductsByCategorySlug = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const category = await Category.findOne({ slug: req.params.slug });

    if (!category) {
      res.status(404).json({
        message: 'Category not found',
        success: false,
      });
      return;
    }

    const products = await Product.find({ category: (category as any)._id }).populate('category');

    res.status(200).json({
      message: 'Products by category fetched successfully',
      success: true,
      products,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error', success: false, error: true });
  }
};

export const toggleProductFeatured = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      res.status(404).json({
        message: 'Product not found',
        success: false,
      });
      return;
    }

    (product as any).isFeatured = !(product as any).isFeatured;
    await product.save();

    res.status(200).json({
      message: `Product ${(product as any).isFeatured ? 'marked as' : 'removed from'} featured successfully`,
      success: true,
      product,
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Error toggling featured status',
      error: error.message,
      success: false,
    });
  }
};

export const getRelatedProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  const startTime = Date.now();

  try {
    const { id } = req.params;
    const limit = parseInt((req.query.limit as string) || '6');

    if (!id) {
      res.status(400).json({
        message: 'Product ID is required',
        success: false,
      });
      return;
    }

    const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { slug: id };

    const currentProduct = await Product.findOne(query).select('category tags _id');

    if (!currentProduct) {
      res.status(404).json({
        message: 'Product not found',
        success: false,
      });
      return;
    }

    const relatedQuery: any = {
      _id: { $ne: (currentProduct as any)._id },
      status: 'active',
    };

    if ((currentProduct as any).category) {
      relatedQuery.category = (currentProduct as any).category;
    }

    let relatedProducts = await Product.find(relatedQuery)
      .populate('category', 'name slug')
      .select('name price image category stock status slug shortDescription')
      .limit(limit * 2)
      .lean();

    if ((currentProduct as any).tags && (currentProduct as any).tags.length > 0) {
      const taggedProducts = relatedProducts.filter(
        (p: any) =>
          p.tags && (p.tags as any[]).some((tag) => (currentProduct as any).tags.includes(tag))
      );
      const untaggedProducts = relatedProducts.filter(
        (p: any) =>
          !p.tags || !(p.tags as any[]).some((tag) => (currentProduct as any).tags.includes(tag))
      );
      relatedProducts = [...taggedProducts, ...untaggedProducts];
    }

    relatedProducts = relatedProducts.slice(0, limit);

    if (relatedProducts.length < limit) {
      const additionalProducts = await Product.find({
        _id: {
          $nin: [
            ...relatedProducts.map((p: any) => p._id),
            (currentProduct as any)._id,
          ],
        },
        status: 'active',
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
      count: relatedProducts.length,
    });

    res.status(200).json({
      products: relatedProducts,
      success: true,
    });
  } catch (error: any) {
    logger.error('Error fetching related products:', error);
    res.status(500).json({
      message: 'Error fetching related products',
      error: error.message || 'Internal server error',
      success: false,
    });
  }
};

export const searchProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      q = '',
      category = '',
      minPrice = 0,
      maxPrice = 999999,
      sortBy = 'name',
      sortOrder = 'asc',
      page = 1,
      limit = 12,
      status = 'active',
    } = req.query;

    const searchQuery: any = {};

    if ((q as string).trim()) {
      searchQuery.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
    }

    if (category) {
      searchQuery.category = category;
    }

    searchQuery.price = { $gte: Number(minPrice), $lte: Number(maxPrice) };

    if (status) {
      searchQuery.status = status;
    }

    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const skip = (Number(page) - 1) * Number(limit);

    const products = await Product.find(searchQuery)
      .populate('category', 'name slug')
      .select('-__v')
      .lean()
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit));

    const total = await Product.countDocuments(searchQuery);

    const categories = await Category.find().select('name _id slug').lean();

    res.status(200).json({
      message: 'Search completed successfully',
      success: true,
      products,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalProducts: total,
        hasNextPage: Number(page) * Number(limit) < total,
        hasPrevPage: Number(page) > 1,
      },
      filters: {
        query: q,
        category,
        minPrice: Number(minPrice),
        maxPrice: Number(maxPrice),
        sortBy,
        sortOrder,
        status,
      },
      categories,
    });
  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({
      message: 'Server error during search',
      success: false,
      error: true,
    });
  }
};

