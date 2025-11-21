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

const normalizeVariants = (
  body: any,
  fallback: {
    price?: number;
    salePrice?: number;
    stock?: number;
    measurement?: number;
    unit?: string;
    image?: string;
  },
  defaultLabel: string
) => {
  const incomingVariants = Array.isArray(body?.variants) ? body.variants : [];

  if (incomingVariants.length === 0) {
    if (fallback.price === undefined || fallback.stock === undefined) {
      throw new Error('Price and stock are required when no variants are provided');
    }

    return [
      {
        label: defaultLabel,
        price: Number(fallback.price),
        salePrice: fallback.salePrice,
        stock: Number(fallback.stock),
        measurement: fallback.measurement ?? 1,
        unit: fallback.unit ?? 'pcs',
        status: fallback.stock > 0 ? 'active' : 'out_of_stock',
        isDefault: true,
        image: fallback.image,
      },
    ];
  }

  const variants = incomingVariants.map((variant: any, index: number) => {
    const label = (variant?.label ?? `${defaultLabel} Variant ${index + 1}`).toString().trim();
    const price = Number(
      variant?.price ?? variant?.salePrice ?? fallback.price ?? 0
    );
    const salePrice =
      variant?.salePrice !== undefined && variant?.salePrice !== null
        ? Number(variant.salePrice)
        : undefined;
    const stock = Number(variant?.stock ?? fallback.stock ?? 0);
    const measurement =
      variant?.measurement !== undefined ? Number(variant.measurement) : fallback.measurement ?? 1;
    const unit = variant?.unit || fallback.unit || 'pcs';

    if (!label) {
      throw new Error('Variant label is required');
    }
    if (Number.isNaN(price) || price < 0) {
      throw new Error(`Invalid price for variant ${label}`);
    }
    if (salePrice !== undefined && (Number.isNaN(salePrice) || salePrice < 0 || salePrice > price)) {
      throw new Error(`Invalid sale price for variant ${label}`);
    }
    if (Number.isNaN(stock) || stock < 0) {
      throw new Error(`Invalid stock for variant ${label}`);
    }
    if (Number.isNaN(measurement) || measurement <= 0) {
      throw new Error(`Invalid measurement for variant ${label}`);
    }

    return {
      label,
      sku: variant?.sku,
      barcode: variant?.barcode,
      price,
      salePrice,
      stock,
      measurement,
      unit,
      status: variant?.status || (stock > 0 ? 'active' : 'out_of_stock'),
      isDefault: Boolean(variant?.isDefault),
      image: variant?.image || fallback.image,
      attributes: variant?.attributes || {},
    };
  });

  // ensure only one default
  if (!variants.some((variant: any) => variant.isDefault)) {
    variants[0].isDefault = true;
  } else {
    let defaultFound = false;
    variants.forEach((variant: any) => {
      if (defaultFound && variant.isDefault) {
        variant.isDefault = false;
      } else if (variant.isDefault) {
        defaultFound = true;
      }
    });
  }

  return variants;
};
  });
};

export const createProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      name,
      category,
      price,
      salePrice,
      stock,
      status,
      description,
      measurement,
      unit,
      measurementIncrement,
      shortDescription,
      metaTitle,
      metaDescription,
      lowStockThreshold,
      tags,
    } = req.body;

    if (!name || !category) {
      res.status(400).json({ message: 'Name and category are required', success: false });
      return;
    }

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

    const variants = normalizeVariants(
      req.body,
      {
        price: price !== undefined ? Number(price) : undefined,
        salePrice: salePrice !== undefined ? Number(salePrice) : undefined,
        stock: stock !== undefined ? Number(stock) : undefined,
        measurement: measurement !== undefined ? Number(measurement) : undefined,
        unit,
        image: imageUrl,
      },
      name
    );

    const defaultVariant = variants.find((variant) => variant.isDefault) || variants[0];
    const aggregateStock = variants.reduce((sum, variant) => sum + (variant.stock || 0), 0);

    const newProduct = await Product.create({
      name,
      category,
      price: defaultVariant.salePrice || defaultVariant.price,
      stock: aggregateStock,
      measurement: defaultVariant.measurement ?? 1,
      unit: defaultVariant.unit ?? 'pcs',
      measurementIncrement: measurementIncrement ?? 0.01,
      lowStockThreshold: lowStockThreshold ?? 5,
      status,
      description,
      shortDescription,
      metaTitle,
      metaDescription,
      tags,
      image: imageUrl,
      variants,
      hasVariants: variants.length > 0,
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
      salePrice,
      stock,
      status,
      description,
      measurement,
      unit,
      lowStockThreshold,
      isFeatured,
      measurementIncrement,
      shortDescription,
      metaTitle,
      metaDescription,
      tags,
      variants: variantPayload,
    } = req.body;

    const existingProduct = await Product.findById(req.params.id);
    if (!existingProduct) {
      res.status(404).json({ message: 'Product not found', success: false });
      return;
    }

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
      measurementIncrement,
      shortDescription,
      metaTitle,
      metaDescription,
      tags,
    };

    Object.keys(updateData).forEach((key) => updateData[key] === undefined && delete updateData[key]);

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
    } else if (req.body.image) {
      updateData.image = req.body.image;
    }

    if (variantPayload !== undefined) {
      const fallbackVariant =
        existingProduct.variants?.find((variant: any) => variant.isDefault) ||
        existingProduct.variants?.[0];

      const normalizedVariants = normalizeVariants(
        { variants: variantPayload },
        {
          price:
            price !== undefined
              ? Number(price)
              : fallbackVariant?.price ?? (existingProduct as any).price,
          salePrice:
            salePrice !== undefined
              ? Number(salePrice)
              : fallbackVariant?.salePrice ?? undefined,
          stock:
            stock !== undefined
              ? Number(stock)
              : fallbackVariant?.stock ?? (existingProduct as any).stock,
          measurement:
            measurement !== undefined
              ? Number(measurement)
              : fallbackVariant?.measurement ?? (existingProduct as any).measurement ?? 1,
          unit:
            unit ||
            fallbackVariant?.unit ||
            (existingProduct as any).unit ||
            'pcs',
          image: updateData.image || fallbackVariant?.image || (existingProduct as any).image,
        },
        name || (existingProduct as any).name
      );

      const defaultVariant =
        normalizedVariants.find((variant) => variant.isDefault) || normalizedVariants[0];
      const aggregateStock = normalizedVariants.reduce(
        (sum, variant) => sum + (variant.stock || 0),
        0
      );

      updateData.variants = normalizedVariants;
      updateData.hasVariants = normalizedVariants.length > 0;
      updateData.price = defaultVariant.salePrice || defaultVariant.price;
      updateData.stock = aggregateStock;
      updateData.measurement = defaultVariant.measurement ?? 1;
      updateData.unit = defaultVariant.unit ?? 'pcs';
    } else if (existingProduct.hasVariants) {
      // Keep hasVariants true if product already has variants and they weren't updated
      updateData.hasVariants = true;
    }

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

