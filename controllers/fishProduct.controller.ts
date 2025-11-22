import { Response } from 'express';
import FishProduct from '../models/fishProduct.model.js';
import Category from '../models/category.model.js';
import mongoose from 'mongoose';
import ImageKit from 'imagekit';
import logger from '../services/logger.js';
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
    logger.info('✅ ImageKit initialized successfully for fish products');
  } else {
    logger.warn('⚠️ ImageKit not configured - fish product image features will be disabled');
  }
} catch (error: any) {
  logger.error('❌ ImageKit initialization failed for fish products:', error);
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
        folder: '/prokrishi/fish',
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

// Get all fish products
export const getAllFishProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status,
      isFeatured,
      category,
      sort = 'createdAt',
      order = 'desc',
    } = req.query;

    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) {
      query.status = status;
    }

    if (isFeatured !== undefined) {
      query.isFeatured = isFeatured === 'true';
    }

    if (category) {
      query.category = category;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortField: any = {};
    sortField[sort as string] = sortOrder;

    const [products, total] = await Promise.all([
      FishProduct.find(query)
        .populate('category', 'name slug')
        .sort(sortField)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      FishProduct.countDocuments(query),
    ]);

    // Calculate available stock and price range for each product
    const productsWithStock = products.map((product: any) => {
      // Calculate total stock from size categories
      const activeCategories = product.sizeCategories.filter(
        (cat: any) => cat.status === 'active'
      );
      const totalStock = activeCategories.reduce((sum: number, cat: any) => sum + (cat.stock || 0), 0);
      const prices = activeCategories.map((cat: any) => cat.pricePerKg);
      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

      return {
        ...product,
        availableStock: totalStock,
        priceRange: { min: minPrice, max: maxPrice },
      };
    });

    res.json({
      success: true,
      fishProducts: productsWithStock,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    logger.error('Error fetching fish products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fish products',
      error: error.message,
    });
  }
};

// Get single fish product
export const getFishProductById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid fish product ID' });
      return;
    }

    const product = await FishProduct.findById(id).populate('category', 'name slug image');

    if (!product) {
      res.status(404).json({ success: false, message: 'Fish product not found' });
      return;
    }

    // Return size categories with stock info
    const inventoryStats = product.sizeCategories.map((sizeCat: any) => {
      return {
        ...sizeCat.toObject(),
        stock: sizeCat.stock || 0,
      };
    });

    res.json({
      success: true,
      fishProduct: {
        ...product.toObject(),
        sizeCategories: inventoryStats,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching fish product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fish product',
      error: error.message,
    });
  }
};

// Create fish product
export const createFishProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      name,
      category: categoryId,
      description,
      shortDescription,
      sizeCategories: sizeCategoriesRaw,
      status = 'active',
      isFeatured = false,
      tags: tagsRaw,
      metaTitle,
      metaDescription,
    } = req.body;

    if (!name) {
      res.status(400).json({ success: false, message: 'Name is required' });
      return;
    }

    // Auto-assign to "মাছ" category - find or create it
    let fishCategory = await Category.findOne({ name: 'মাছ' });
    if (!fishCategory) {
      // Create the category if it doesn't exist
      fishCategory = new Category({
        name: 'মাছ',
        slug: 'machh',
        description: 'Fish products',
      });
      await fishCategory.save();
      logger.info('Created "মাছ" category for fish products');
    }
    const category = categoryId || fishCategory._id;

    // Parse JSON strings from FormData
    let sizeCategories: any[] = [];
    try {
      if (typeof sizeCategoriesRaw === 'string') {
        sizeCategories = JSON.parse(sizeCategoriesRaw);
      } else if (Array.isArray(sizeCategoriesRaw)) {
        sizeCategories = sizeCategoriesRaw;
      }
    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Invalid sizeCategories format',
      });
      return;
    }

    let tags: string[] = [];
    if (tagsRaw) {
      try {
        if (typeof tagsRaw === 'string') {
          tags = JSON.parse(tagsRaw);
        } else if (Array.isArray(tagsRaw)) {
          tags = tagsRaw;
        }
      } catch (error) {
        // Tags parsing failed, ignore
      }
    }

    if (!sizeCategories || !Array.isArray(sizeCategories) || sizeCategories.length === 0) {
      res.status(400).json({
        success: false,
        message: 'At least one size category is required',
      });
      return;
    }

    // Validate size categories
    for (const sizeCat of sizeCategories) {
      if (!sizeCat.label || !sizeCat.pricePerKg) {
        res.status(400).json({
          success: false,
          message: 'Each size category must have a label and pricePerKg',
        });
        return;
      }
      if (sizeCat.pricePerKg <= 0) {
        res.status(400).json({
          success: false,
          message: 'Price per kg must be greater than 0',
        });
        return;
      }
    }

    // Verify category exists (should be "মাছ" category)
    const existingCategory = await Category.findById(category);
    if (!existingCategory) {
      res.status(400).json({ success: false, message: 'Invalid category ID' });
      return;
    }

    let imageUrl = '';
    if (req.file) {
      const uploadResult = await uploadToImageKit(req.file.buffer, req.file.originalname);
      imageUrl = uploadResult.url;
    } else if (req.body.image) {
      imageUrl = req.body.image;
    }

    // Ensure first size category is default
    const normalizedSizeCategories = sizeCategories.map((cat: any, index: number) => ({
      label: cat.label.trim(),
      pricePerKg: Number(cat.pricePerKg),
      stock: cat.stock !== undefined ? Number(cat.stock) : 0,
      minWeight: cat.minWeight ? Number(cat.minWeight) : undefined,
      maxWeight: cat.maxWeight ? Number(cat.maxWeight) : undefined,
      sku: cat.sku?.trim() || undefined,
      status: cat.status || 'active',
      isDefault: index === 0,
    }));

    const fishProduct = new FishProduct({
      name: name.trim(),
      category,
      description: description || '',
      shortDescription: shortDescription || '',
      image: imageUrl,
      sizeCategories: normalizedSizeCategories,
      status,
      isFeatured,
      tags: tags || [],
      metaTitle: metaTitle?.trim(),
      metaDescription: metaDescription?.trim(),
    });

    await fishProduct.save();

    res.status(201).json({
      success: true,
      message: 'Fish product created successfully',
      fishProduct,
    });
  } catch (error: any) {
    logger.error('Error creating fish product:', error);
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        message: 'Fish product with this SKU or slug already exists',
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create fish product',
      error: error.message,
    });
  }
};

// Update fish product
export const updateFishProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      category,
      description,
      shortDescription,
      sizeCategories: sizeCategoriesRaw,
      status,
      isFeatured,
      tags: tagsRaw,
      metaTitle,
      metaDescription,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid fish product ID' });
      return;
    }

    const fishProduct = await FishProduct.findById(id);
    if (!fishProduct) {
      res.status(404).json({ success: false, message: 'Fish product not found' });
      return;
    }

    // Handle image upload
    if (req.file) {
      const uploadResult = await uploadToImageKit(req.file.buffer, req.file.originalname);
      (fishProduct as any).image = uploadResult.url;
    } else if (req.body.image !== undefined) {
      (fishProduct as any).image = req.body.image || '';
    }

    // Update fields
    if (name) (fishProduct as any).name = name.trim();
    if (category) {
      const existingCategory = await Category.findById(category);
      if (!existingCategory) {
        res.status(400).json({ success: false, message: 'Invalid category ID' });
        return;
      }
      (fishProduct as any).category = category;
    }
    if (description !== undefined) (fishProduct as any).description = description || '';
    if (shortDescription !== undefined)
      (fishProduct as any).shortDescription = shortDescription || '';
    if (status) (fishProduct as any).status = status;
    if (isFeatured !== undefined) (fishProduct as any).isFeatured = isFeatured;
    
    // Parse tags if provided
    if (tagsRaw !== undefined) {
      let tags: string[] = [];
      try {
        if (typeof tagsRaw === 'string') {
          tags = JSON.parse(tagsRaw);
        } else if (Array.isArray(tagsRaw)) {
          tags = tagsRaw;
        }
      } catch (error) {
        // Tags parsing failed, ignore
      }
      (fishProduct as any).tags = tags;
    }
    
    if (metaTitle !== undefined) (fishProduct as any).metaTitle = metaTitle?.trim();
    if (metaDescription !== undefined) (fishProduct as any).metaDescription = metaDescription?.trim();

    // Parse and update size categories if provided
    if (sizeCategoriesRaw !== undefined) {
      let sizeCategories: any[] = [];
      try {
        if (typeof sizeCategoriesRaw === 'string') {
          sizeCategories = JSON.parse(sizeCategoriesRaw);
        } else if (Array.isArray(sizeCategoriesRaw)) {
          sizeCategories = sizeCategoriesRaw;
        }
      } catch (error) {
        res.status(400).json({
          success: false,
          message: 'Invalid sizeCategories format',
        });
        return;
      }

      if (sizeCategories.length === 0) {
        res.status(400).json({
          success: false,
          message: 'At least one size category is required',
        });
        return;
      }

      // Validate size categories
      for (const sizeCat of sizeCategories) {
        if (!sizeCat.label || sizeCat.pricePerKg === undefined) {
          res.status(400).json({
            success: false,
            message: 'Each size category must have a label and pricePerKg',
          });
          return;
        }
        if (sizeCat.pricePerKg <= 0) {
          res.status(400).json({
            success: false,
            message: 'Price per kg must be greater than 0',
          });
          return;
        }
      }

      // Normalize size categories
      const normalizedSizeCategories = sizeCategories.map((cat: any, index: number) => {
        // Preserve existing _id if updating
        const existingCat = (fishProduct as any).sizeCategories.find(
          (ec: any) => ec._id?.toString() === cat._id?.toString()
        );

        return {
          _id: existingCat?._id || new mongoose.Types.ObjectId(),
          label: cat.label.trim(),
          pricePerKg: Number(cat.pricePerKg),
          stock: cat.stock !== undefined ? Number(cat.stock) : (existingCat?.stock || 0),
          minWeight: cat.minWeight ? Number(cat.minWeight) : undefined,
          maxWeight: cat.maxWeight ? Number(cat.maxWeight) : undefined,
          sku: cat.sku?.trim() || undefined,
          status: cat.status || 'active',
          isDefault: index === 0 || cat.isDefault || false,
        };
      });

      // Ensure only one default
      let defaultFound = false;
      normalizedSizeCategories.forEach((cat: any) => {
        if (defaultFound && cat.isDefault) {
          cat.isDefault = false;
        } else if (cat.isDefault) {
          defaultFound = true;
        }
      });
      if (!defaultFound && normalizedSizeCategories.length > 0) {
        normalizedSizeCategories[0].isDefault = true;
      }

      (fishProduct as any).sizeCategories = normalizedSizeCategories;
      (fishProduct as any).markModified('sizeCategories');
    }

    await fishProduct.save();

    res.json({
      success: true,
      message: 'Fish product updated successfully',
      fishProduct,
    });
  } catch (error: any) {
    logger.error('Error updating fish product:', error);
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        message: 'Fish product with this SKU or slug already exists',
      });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update fish product',
      error: error.message,
    });
  }
};

// Delete fish product
export const deleteFishProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid fish product ID' });
      return;
    }

    // Check if there are any orders
    const orderCount = await mongoose.model('FishOrder').countDocuments({ 'orderItems.fishProduct': id });

    if (orderCount > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete fish product. It has ${orderCount} orders associated with it.`,
      });
      return;
    }

    const fishProduct = await FishProduct.findByIdAndDelete(id);

    if (!fishProduct) {
      res.status(404).json({ success: false, message: 'Fish product not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Fish product deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting fish product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete fish product',
      error: error.message,
    });
  }
};

// Toggle featured status
export const toggleFishProductFeatured = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid fish product ID' });
      return;
    }

    const fishProduct = await FishProduct.findById(id);
    if (!fishProduct) {
      res.status(404).json({ success: false, message: 'Fish product not found' });
      return;
    }

    (fishProduct as any).isFeatured = !(fishProduct as any).isFeatured;
    await fishProduct.save();

    res.json({
      success: true,
      message: `Fish product ${(fishProduct as any).isFeatured ? 'featured' : 'unfeatured'} successfully`,
      fishProduct,
    });
  } catch (error: any) {
    logger.error('Error toggling fish product featured status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle featured status',
      error: error.message,
    });
  }
};

