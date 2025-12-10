import { Response } from 'express';
import Product from '../models/product.model.js';
import FishProduct from '../models/fishProduct.model.js';
import Category from '../models/category.model.js';
import mongoose from 'mongoose';
import ImageKit from 'imagekit';
import logger, { logPerformance } from '../services/logger.js';
import { AuthRequest } from '../types/index.js';
import cacheService from '../services/cache.js';

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

const parseVariantsPayload = (variantsRaw: any): any[] | undefined => {
  if (variantsRaw === undefined) {
    return undefined;
  }

  if (typeof variantsRaw === 'string') {
    try {
      const parsed = JSON.parse(variantsRaw);
      return parsed;
    } catch (error) {
      throw new Error('Invalid variants format. Expecting JSON array.');
    }
  }

  if (Array.isArray(variantsRaw)) {
    return variantsRaw;
  }

  throw new Error('Invalid variants format. Expecting array.');
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      unitWeightKg:
        variant?.unitWeightKg !== undefined && variant?.unitWeightKg !== null
          ? Number(variant.unitWeightKg)
          : undefined,
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

type ProductUploadFiles = {
  image?: Express.Multer.File[];
  galleryImages?: Express.Multer.File[];
};

const parseStringArrayField = (value: any): string[] => {
  if (value === undefined || value === null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item: any) => (typeof item === 'string' ? item.trim() : ''))
          .filter(Boolean);
      }
    } catch {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
};

const buildImagePayload = (primary?: string, gallery: string[] = []) => {
  const sanitizedPrimary = typeof primary === 'string' ? primary.trim() : '';
  const sanitizedGallery = gallery
    .map((img) => (typeof img === 'string' ? img.trim() : ''))
    .filter(Boolean);

  let hero = sanitizedPrimary;
  const galleryQueue = [...sanitizedGallery];

  if (!hero && galleryQueue.length > 0) {
    hero = galleryQueue.shift() as string;
  }

  const ordered: string[] = [];
  const seen = new Set<string>();

  if (hero) {
    ordered.push(hero);
    seen.add(hero);
  }

  galleryQueue.forEach((img) => {
    if (img && !seen.has(img)) {
      ordered.push(img);
      seen.add(img);
    }
  });

  return {
    hero,
    images: ordered,
  };
};

const uploadAdditionalImages = async (files: Express.Multer.File[] = []) => {
  if (!files.length) {
    return [];
  }

  const uploads = files.map(async (file) => {
    const uploadResult = await uploadToImageKit(file.buffer, file.originalname);
    return uploadResult.url;
  });

  return Promise.all(uploads);
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
      unitWeightKg,
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

    const filePayload = (req.files as ProductUploadFiles) || {};
    const primaryUpload = Array.isArray(filePayload?.image) ? filePayload.image[0] : undefined;
    const galleryUploads = Array.isArray(filePayload?.galleryImages)
      ? filePayload.galleryImages
      : [];

    if (primaryUpload) {
      const uploadResult = await uploadToImageKit(primaryUpload.buffer, primaryUpload.originalname);
      imageUrl = uploadResult.url;
    } else if (req.body.image) {
      imageUrl = req.body.image;
    }

    const galleryUploadUrls = await uploadAdditionalImages(galleryUploads);
    const existingGallery = parseStringArrayField(req.body.existingGallery);
    const manualGallery = parseStringArrayField(req.body.images);
    const combinedGallery = [...existingGallery, ...manualGallery, ...galleryUploadUrls];
    const imagePayload = buildImagePayload(imageUrl, combinedGallery);
    imageUrl = imagePayload.hero;

    let variantsPayload: any[] | undefined;
    try {
      variantsPayload = parseVariantsPayload(req.body?.variants);
    } catch (error: any) {
      res.status(400).json({
        message: error.message,
        success: false,
      });
      return;
    }

    const productImages = imagePayload.images;

    const variants = normalizeVariants(
      { variants: variantsPayload },
      {
        price: price !== undefined ? Number(price) : undefined,
        salePrice: salePrice !== undefined ? Number(salePrice) : undefined,
        stock: stock !== undefined ? Number(stock) : undefined,
        measurement: measurement !== undefined ? Number(measurement) : undefined,
        unit,
        image: imagePayload.hero,
      },
      name
    );

    const defaultVariant = variants.find((variant: any) => variant.isDefault) || variants[0];
    const aggregateStock = variants.reduce((sum: number, variant: any) => sum + (variant.stock || 0), 0);

    const newProduct = await Product.create({
      name,
      category,
      price: defaultVariant.salePrice || defaultVariant.price,
      stock: aggregateStock,
      measurement: defaultVariant.measurement ?? 1,
      unit: defaultVariant.unit ?? 'pcs',
      unitWeightKg:
        unitWeightKg !== undefined
          ? Number(unitWeightKg)
          : defaultVariant.unitWeightKg ?? undefined,
      measurementIncrement: measurementIncrement ?? 0.01,
      lowStockThreshold: lowStockThreshold ?? 5,
      status,
      description,
      shortDescription,
      metaTitle,
      metaDescription,
      tags,
      image: imageUrl,
      images: productImages,
      variants,
      hasVariants: variants.length > 0,
    });

    logger.info(`Product created: ${(newProduct as any).name} (ID: ${(newProduct as any)._id})`);

    // Invalidate product list caches when new product is created
    await cacheService.delPattern('products:*');
    await cacheService.del(cacheService.keys.FEATURED_PRODUCTS());
    await cacheService.del(cacheService.keys.POPULAR_PRODUCTS());

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

// Public endpoint - always includes fish products
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

    // Generate cache key based on query parameters
    const cacheKey = cacheService.keys.PRODUCTS(
      `page:${page}:limit:${limit}:cat:${category || 'all'}:search:${search || ''}:sort:${sort}:order:${order}`
    );

    // Try to get from cache first
    // NOTE: Stock values in cache are for DISPLAY ONLY - actual inventory checks MUST always query database
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logPerformance('getAllProducts', Date.now() - startTime, { source: 'cache' });
      res.status(200).json(cached);
      return;
    }

    // Find "মাছ" category
    const fishCategory = await Category.findOne({ name: 'মাছ' });
    const isFishCategory = category && fishCategory && category.toString() === fishCategory._id.toString();

    let products: any[] = [];
    let totalProducts = 0;

    if (isFishCategory) {
      // If filtering by "মাছ" category, only return fish products
      const fishQuery: any = { status: 'active' };
      if (search) {
        fishQuery.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      const fishProducts = await FishProduct.find(fishQuery)
        .populate('category', 'name slug')
        .sort({ [sort as string]: order === 'desc' ? -1 : 1 })
        .skip((parseInt(page as string) - 1) * parseInt(limit as string))
        .limit(parseInt(limit as string))
        .lean();

      // Convert fish products to regular product format for compatibility
      products = fishProducts.map((fp: any) => {
        const defaultSizeCat = fp.sizeCategories.find((sc: any) => sc.isDefault) || fp.sizeCategories[0];
        const totalStock = fp.sizeCategories.reduce((sum: number, sc: any) => sum + (sc.stock || 0), 0);
        const minPrice = Math.min(...fp.sizeCategories.map((sc: any) => sc.pricePerKg));
        const maxPrice = Math.max(...fp.sizeCategories.map((sc: any) => sc.pricePerKg));

        return {
          ...fp,
          _id: fp._id,
          price: defaultSizeCat?.pricePerKg || minPrice,
          stock: totalStock,
          measurement: 1,
          unit: 'kg',
          images: fp.image ? [fp.image] : [],
          hasVariants: fp.sizeCategories.length > 1,
          variants: fp.sizeCategories.map((sc: any) => ({
            _id: sc._id,
            label: sc.label,
            price: sc.pricePerKg,
            stock: sc.stock || 0,
            measurement: 1,
            unit: 'kg',
            status: sc.status,
            isDefault: sc.isDefault,
          })),
          priceRange: { min: minPrice, max: maxPrice },
          isFishProduct: true,
        };
      });

      totalProducts = await FishProduct.countDocuments(fishQuery);
    } else {
      // Regular products - exclude "মাছ" category
      const query: any = { status: 'active' };
      if (category) {
        query.category = new mongoose.Types.ObjectId(category as string);
      } else if (fishCategory) {
        // Exclude "মাছ" category from regular products
        query.category = { $ne: fishCategory._id };
      }
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      products = await Product.find(query)
        .populate('category', 'name slug')
        .sort({ [sort as string]: order === 'desc' ? -1 : 1 })
        .skip((parseInt(page as string) - 1) * parseInt(limit as string))
        .limit(parseInt(limit as string))
        .lean();

      totalProducts = await Product.countDocuments(query);

      // Always include fish products on public pages (when no category filter)
      if (!category && fishCategory) {
        const fishQuery: any = { status: 'active', category: fishCategory._id };
        if (search) {
          fishQuery.$or = [
            { name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
          ];
        }

        const fishProducts = await FishProduct.find(fishQuery)
          .populate('category', 'name slug')
          .sort({ [sort as string]: order === 'desc' ? -1 : 1 })
          .lean();

        const convertedFishProducts = fishProducts.map((fp: any) => {
          const defaultSizeCat = fp.sizeCategories.find((sc: any) => sc.isDefault) || fp.sizeCategories[0];
          const totalStock = fp.sizeCategories.reduce((sum: number, sc: any) => sum + (sc.stock || 0), 0);
          const minPrice = Math.min(...fp.sizeCategories.map((sc: any) => sc.pricePerKg));
          const maxPrice = Math.max(...fp.sizeCategories.map((sc: any) => sc.pricePerKg));

          return {
            ...fp,
            _id: fp._id,
            price: defaultSizeCat?.pricePerKg || minPrice,
            stock: totalStock,
            measurement: 1,
            unit: 'kg',
            hasVariants: fp.sizeCategories.length > 1,
            variants: fp.sizeCategories.map((sc: any) => ({
              _id: sc._id,
              label: sc.label,
              price: sc.pricePerKg,
              stock: sc.stock || 0,
              measurement: 1,
              unit: 'kg',
              status: sc.status,
              isDefault: sc.isDefault,
            })),
            priceRange: { min: minPrice, max: maxPrice },
            isFishProduct: true,
          };
        });

        products = [...products, ...convertedFishProducts];
        totalProducts += fishProducts.length;

        // Re-sort combined results
        const sortOrder = order === 'desc' ? -1 : 1;
        products.sort((a: any, b: any) => {
          const aVal = a[sort as string];
          const bVal = b[sort as string];
          if (aVal < bVal) return -1 * sortOrder;
          if (aVal > bVal) return 1 * sortOrder;
          return 0;
        });

        // Apply pagination to combined results
        const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
        products = products.slice(skip, skip + parseInt(limit as string));
      }
    }

    const pagination = {
      currentPage: parseInt(page as string),
      totalPages: Math.ceil(totalProducts / parseInt(limit as string)),
      totalProducts,
      hasNext: parseInt(page as string) * parseInt(limit as string) < totalProducts,
      hasPrev: parseInt(page as string) > 1,
    };

    const result = { products, pagination, success: true };

    // Cache the result for 5 minutes (300 seconds)
    // Note: Stock values in cache are for display only - actual inventory checks must always query database
    await cacheService.set(cacheKey, result, 300);

    logPerformance('getAllProducts', Date.now() - startTime, {
      source: 'database',
      count: products.length,
      optimization: 'aggregation_pipeline',
    });

    res.status(200).json(result);
  } catch (error: any) {
    logger.error('Error fetching products:', error);
    res.status(500).json({
      message: 'Error fetching products',
      error: true,
      success: false,
    });
  }
};

// Admin endpoint - excludes fish products (fish products managed separately)
export const getAdminProducts = async (req: AuthRequest, res: Response): Promise<void> => {
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

    // Find "মাছ" category to exclude it
    const fishCategory = await Category.findOne({ name: 'মাছ' });

    const query: any = { status: 'active' };
    
    if (category) {
      query.category = new mongoose.Types.ObjectId(category as string);
    } else if (fishCategory) {
      // Always exclude "মাছ" category from admin products
      query.category = { $ne: fishCategory._id };
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

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

    logPerformance('getAdminProducts', Date.now() - startTime, {
      source: 'database',
      count: products.length,
    });

    res.status(200).json({ products, pagination, success: true });
  } catch (error: any) {
    logger.error('Error fetching admin products:', error);
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

    // Generate cache key
    const cacheKey = cacheService.keys.PRODUCT(id);

    // Try to get from cache first
    // NOTE: Stock values in cache are for DISPLAY ONLY - actual inventory checks MUST always query database
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      logPerformance('getProductById', Date.now() - startTime, { source: 'cache', productId: id });
      res.status(200).json(cached);
      return;
    }

    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const query = isObjectId ? { _id: id } : { slug: id };

    let product: any = await Product.findOne(query)
      .populate('category', 'name slug description image')
      .select('-__v')
      .lean();

    // If not found in regular products, check fish products
    if (!product) {
      const fishProduct = await FishProduct.findOne(query)
        .populate('category', 'name slug description image')
        .select('-__v')
        .lean();

      if (fishProduct) {
        // Convert fish product to regular product format
        const defaultSizeCat = (fishProduct as any).sizeCategories.find((sc: any) => sc.isDefault) || (fishProduct as any).sizeCategories[0];
        const totalStock = (fishProduct as any).sizeCategories.reduce((sum: number, sc: any) => sum + (sc.stock || 0), 0);
        const minPrice = Math.min(...(fishProduct as any).sizeCategories.map((sc: any) => sc.pricePerKg));
        const maxPrice = Math.max(...(fishProduct as any).sizeCategories.map((sc: any) => sc.pricePerKg));

        product = {
          ...fishProduct,
          price: defaultSizeCat?.pricePerKg || minPrice,
          stock: totalStock,
          measurement: 1,
          unit: 'kg',
          images: fishProduct.image ? [fishProduct.image] : [],
          hasVariants: (fishProduct as any).sizeCategories.length > 1,
          variants: (fishProduct as any).sizeCategories.map((sc: any) => ({
            _id: sc._id,
            label: sc.label,
            price: sc.pricePerKg,
            stock: sc.stock || 0,
            measurement: 1,
            unit: 'kg',
            status: sc.status,
            isDefault: sc.isDefault,
          })),
          priceRange: { min: minPrice, max: maxPrice },
          isFishProduct: true,
        };
      }
    }

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

    const result = { product, success: true };

    // Cache the result for 5 minutes (300 seconds)
    // Note: Stock values in cache are for display only - actual inventory checks must always query database
    await cacheService.set(cacheKey, result, 300);

    logPerformance('getProductById', Date.now() - startTime, {
      source: 'database',
      productId: (product as any)._id,
    });

    res.status(200).json(result);
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
      unitWeightKg,
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
      unitWeightKg:
        unitWeightKg !== undefined ? Number(unitWeightKg) : undefined,
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

    const filePayload = (req.files as ProductUploadFiles) || {};
    const primaryUpload = Array.isArray(filePayload?.image) ? filePayload.image[0] : undefined;
    const galleryUploads = Array.isArray(filePayload?.galleryImages)
      ? filePayload.galleryImages
      : [];

    if (primaryUpload) {
      const uploadResult = await uploadToImageKit(primaryUpload.buffer, primaryUpload.originalname);
      updateData.image = uploadResult.url;
    }

    const galleryUploadUrls = await uploadAdditionalImages(galleryUploads);
    const galleryFieldProvided = Object.prototype.hasOwnProperty.call(req.body, 'existingGallery');
    const parsedExistingGallery = galleryFieldProvided
      ? parseStringArrayField(req.body.existingGallery)
      : undefined;
    const fallbackExistingGallery =
      (existingProduct as any).images?.filter((img: string) => img && img !== (existingProduct as any).image) ??
      [];
    const combinedGallery = [
      ...(parsedExistingGallery !== undefined ? parsedExistingGallery : fallbackExistingGallery),
      ...galleryUploadUrls,
    ];
    const imagePayload = buildImagePayload(updateData.image ?? (existingProduct as any).image, combinedGallery);
    if (imagePayload.hero) {
      updateData.image = imagePayload.hero;
    }
    updateData.images = imagePayload.images;

    if (variantPayload !== undefined) {
      let parsedVariants: any[] | undefined;
      try {
        parsedVariants = parseVariantsPayload(variantPayload);
      } catch (error: any) {
        res.status(400).json({
          message: error.message,
          success: false,
        });
        return;
      }

      const fallbackVariant =
        existingProduct.variants?.find((variant: any) => variant.isDefault) ||
        existingProduct.variants?.[0];

      const normalizedVariants = normalizeVariants(
        { variants: parsedVariants },
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
        normalizedVariants.find((variant: any) => variant.isDefault) || normalizedVariants[0];
      const aggregateStock = normalizedVariants.reduce(
        (sum: number, variant: any) => sum + (variant.stock || 0),
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

    // Invalidate all product-related caches to prevent stale data
    await cacheService.del(cacheService.keys.PRODUCT(req.params.id));
    await cacheService.delPattern('products:*');
    await cacheService.del(cacheService.keys.FEATURED_PRODUCTS());
    await cacheService.del(cacheService.keys.POPULAR_PRODUCTS());

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

    // Invalidate all product-related caches
    await cacheService.del(cacheService.keys.PRODUCT(req.params.id));
    await cacheService.delPattern('products:*');
    await cacheService.del(cacheService.keys.FEATURED_PRODUCTS());
    await cacheService.del(cacheService.keys.POPULAR_PRODUCTS());

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
    // Get featured regular products
    const regularProducts = await Product.find({ isFeatured: true, status: 'active' })
      .populate('category')
      .select('-__v')
      .lean();

    // Get featured fish products
    const fishCategory = await Category.findOne({ name: 'মাছ' });
    const fishProducts = fishCategory
      ? await FishProduct.find({ isFeatured: true, status: 'active', category: fishCategory._id })
          .populate('category')
          .select('-__v')
          .lean()
      : [];

    // Convert fish products to regular product format
    const convertedFishProducts = fishProducts.map((fp: any) => {
      const defaultSizeCat = fp.sizeCategories.find((sc: any) => sc.isDefault) || fp.sizeCategories[0];
      const totalStock = fp.sizeCategories.reduce((sum: number, sc: any) => sum + (sc.stock || 0), 0);
      const minPrice = Math.min(...fp.sizeCategories.map((sc: any) => sc.pricePerKg));
      const maxPrice = Math.max(...fp.sizeCategories.map((sc: any) => sc.pricePerKg));

      return {
        ...fp,
        _id: fp._id,
        price: defaultSizeCat?.pricePerKg || minPrice,
        stock: totalStock,
        measurement: 1,
        unit: 'kg',
        hasVariants: fp.sizeCategories.length > 1,
        variants: fp.sizeCategories.map((sc: any) => ({
          _id: sc._id,
          label: sc.label,
          price: sc.pricePerKg,
          stock: sc.stock || 0,
          measurement: 1,
          unit: 'kg',
          status: sc.status,
          isDefault: sc.isDefault,
        })),
        priceRange: { min: minPrice, max: maxPrice },
        isFishProduct: true,
      };
    });

    // Combine regular and fish products
    const products = [...regularProducts, ...convertedFishProducts];

    res.status(200).json({
      message: 'Featured products fetched successfully',
      success: true,
      products,
    });
  } catch (error: any) {
    logger.error('Error fetching featured products:', error);
    res.status(500).json({ message: 'Server error', success: false, error: true });
  }
};

export const getPopularProducts = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Get popular regular products
    const regularProducts = await Product.find({ status: 'active' })
      .sort({ sold: -1 })
      .limit(10)
      .populate('category')
      .select('-__v')
      .lean();

    // Get popular fish products
    const fishCategory = await Category.findOne({ name: 'মাছ' });
    const fishProducts = fishCategory
      ? await FishProduct.find({ status: 'active', category: fishCategory._id })
          .sort({ views: -1 })
          .limit(10)
          .populate('category')
          .select('-__v')
          .lean()
      : [];

    // Convert fish products to regular product format
    const convertedFishProducts = fishProducts.map((fp: any) => {
      const defaultSizeCat = fp.sizeCategories.find((sc: any) => sc.isDefault) || fp.sizeCategories[0];
      const totalStock = fp.sizeCategories.reduce((sum: number, sc: any) => sum + (sc.stock || 0), 0);
      const minPrice = Math.min(...fp.sizeCategories.map((sc: any) => sc.pricePerKg));
      const maxPrice = Math.max(...fp.sizeCategories.map((sc: any) => sc.pricePerKg));

      return {
        ...fp,
        _id: fp._id,
        price: defaultSizeCat?.pricePerKg || minPrice,
        stock: totalStock,
        measurement: 1,
        unit: 'kg',
        hasVariants: fp.sizeCategories.length > 1,
        variants: fp.sizeCategories.map((sc: any) => ({
          _id: sc._id,
          label: sc.label,
          price: sc.pricePerKg,
          stock: sc.stock || 0,
          measurement: 1,
          unit: 'kg',
          status: sc.status,
          isDefault: sc.isDefault,
        })),
        priceRange: { min: minPrice, max: maxPrice },
        isFishProduct: true,
      };
    });

    // Combine and sort by popularity (sold for regular, views for fish)
    const products = [...regularProducts, ...convertedFishProducts]
      .sort((a: any, b: any) => {
        const aPopularity = a.sold || a.views || 0;
        const bPopularity = b.sold || b.views || 0;
        return bPopularity - aPopularity;
      })
      .slice(0, 10);

    res.status(200).json({
      message: 'Popular products fetched successfully',
      success: true,
      products,
    });
  } catch (error: any) {
    logger.error('Error fetching popular products:', error);
    res.status(500).json({ message: 'Server error', success: false, error: true });
  }
};

export const getProductsByCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categoryId = req.params.categoryId;
    
    // Find the category to check if it's "মাছ"
    const category = await Category.findById(categoryId);
    const fishCategory = await Category.findOne({ name: 'মাছ' });
    const isFishCategory = category && fishCategory && category._id.toString() === fishCategory._id.toString();

    let products: any[] = [];

    if (isFishCategory) {
      // If it's the fish category, fetch from FishProduct
      const fishProducts = await FishProduct.find({ category: categoryId, status: 'active' })
        .populate('category')
        .lean();

      // Convert fish products to regular product format
      products = fishProducts.map((fp: any) => {
        const defaultSizeCat = fp.sizeCategories.find((sc: any) => sc.isDefault) || fp.sizeCategories[0];
        const totalStock = fp.sizeCategories.reduce((sum: number, sc: any) => sum + (sc.stock || 0), 0);
        const minPrice = Math.min(...fp.sizeCategories.map((sc: any) => sc.pricePerKg));
        const maxPrice = Math.max(...fp.sizeCategories.map((sc: any) => sc.pricePerKg));

        return {
          ...fp,
          _id: fp._id,
          price: defaultSizeCat?.pricePerKg || minPrice,
          stock: totalStock,
          measurement: 1,
          unit: 'kg',
          hasVariants: fp.sizeCategories.length > 1,
          variants: fp.sizeCategories.map((sc: any) => ({
            _id: sc._id,
            label: sc.label,
            price: sc.pricePerKg,
            stock: sc.stock || 0,
            measurement: 1,
            unit: 'kg',
            status: sc.status,
            isDefault: sc.isDefault,
          })),
          priceRange: { min: minPrice, max: maxPrice },
          isFishProduct: true,
        };
      });
    } else {
      // Regular category, fetch from Product
      products = await Product.find({ category: categoryId, status: 'active' })
        .populate('category')
        .lean();
    }

    res.status(200).json({
      message: 'Products by category fetched successfully',
      success: true,
      products,
    });
  } catch (error: any) {
    logger.error('Error fetching products by category:', error);
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

    // Check if it's the fish category
    const fishCategory = await Category.findOne({ name: 'মাছ' });
    const isFishCategory = fishCategory && category._id.toString() === fishCategory._id.toString();

    let products: any[] = [];

    if (isFishCategory) {
      // If it's the fish category, fetch from FishProduct
      const fishProducts = await FishProduct.find({ category: category._id, status: 'active' })
        .populate('category')
        .lean();

      // Convert fish products to regular product format
      products = fishProducts.map((fp: any) => {
        const defaultSizeCat = fp.sizeCategories.find((sc: any) => sc.isDefault) || fp.sizeCategories[0];
        const totalStock = fp.sizeCategories.reduce((sum: number, sc: any) => sum + (sc.stock || 0), 0);
        const minPrice = Math.min(...fp.sizeCategories.map((sc: any) => sc.pricePerKg));
        const maxPrice = Math.max(...fp.sizeCategories.map((sc: any) => sc.pricePerKg));

        return {
          ...fp,
          _id: fp._id,
          price: defaultSizeCat?.pricePerKg || minPrice,
          stock: totalStock,
          measurement: 1,
          unit: 'kg',
          hasVariants: fp.sizeCategories.length > 1,
          variants: fp.sizeCategories.map((sc: any) => ({
            _id: sc._id,
            label: sc.label,
            price: sc.pricePerKg,
            stock: sc.stock || 0,
            measurement: 1,
            unit: 'kg',
            status: sc.status,
            isDefault: sc.isDefault,
          })),
          priceRange: { min: minPrice, max: maxPrice },
          isFishProduct: true,
        };
      });
    } else {
      // Regular category, fetch from Product
      products = await Product.find({ category: category._id, status: 'active' })
        .populate('category')
        .lean();
    }

    res.status(200).json({
      message: 'Products by category fetched successfully',
      success: true,
      products,
    });
  } catch (error: any) {
    logger.error('Error fetching products by category slug:', error);
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

    // Check both Product and FishProduct models
    let currentProduct: any = await Product.findOne(query).select('category tags _id').lean();
    let isFishProduct = false;

    if (!currentProduct) {
      // Check FishProduct model
      const fishProduct = await FishProduct.findOne(query).select('category tags _id').lean();
      if (fishProduct) {
        currentProduct = fishProduct;
        isFishProduct = true;
      } else {
        res.status(404).json({
          message: 'Product not found',
          success: false,
        });
        return;
      }
    }

    const relatedQuery: any = {
      _id: { $ne: (currentProduct as any)._id },
      status: 'active',
    };

    if ((currentProduct as any).category) {
      relatedQuery.category = (currentProduct as any).category;
    }

    let relatedProducts: any[] = [];

    if (isFishProduct) {
      // Search for related products in FishProduct model
      relatedProducts = await FishProduct.find(relatedQuery)
        .populate('category', 'name slug')
        .select('name image category status slug shortDescription sizeCategories')
        .limit(limit * 2)
        .lean();

      // Convert fish products to regular product format
      relatedProducts = relatedProducts.map((fp: any) => {
        const defaultSizeCat = fp.sizeCategories.find((sc: any) => sc.isDefault) || fp.sizeCategories[0];
        const totalStock = fp.sizeCategories.reduce((sum: number, sc: any) => sum + (sc.stock || 0), 0);
        const minPrice = Math.min(...fp.sizeCategories.map((sc: any) => sc.pricePerKg));
        const maxPrice = Math.max(...fp.sizeCategories.map((sc: any) => sc.pricePerKg));

        return {
          ...fp,
          _id: fp._id,
          price: defaultSizeCat?.pricePerKg || minPrice,
          stock: totalStock,
          images: fp.image ? [fp.image] : [],
          hasVariants: fp.sizeCategories.length > 1,
          variants: fp.sizeCategories.map((sc: any) => ({
            _id: sc._id,
            label: sc.label,
            price: sc.pricePerKg,
            stock: sc.stock || 0,
            measurement: 1,
            unit: 'kg',
            status: sc.status,
            isDefault: sc.isDefault,
          })),
          priceRange: { min: minPrice, max: maxPrice },
          isFishProduct: true,
        };
      });
    } else {
      // Search for related products in Product model
      relatedProducts = await Product.find(relatedQuery)
        .populate('category', 'name slug')
        .select('name price image category stock status slug shortDescription')
        .limit(limit * 2)
        .lean();
    }

    // Sort by tags if available
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

    // If we need more products and it's a regular product, try to get more from regular products
    if (relatedProducts.length < limit && !isFishProduct) {
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

    // If we need more products and it's a fish product, try to get more from fish products
    if (relatedProducts.length < limit && isFishProduct) {
      const additionalProducts = await FishProduct.find({
        _id: {
          $nin: [
            ...relatedProducts.map((p: any) => p._id),
            (currentProduct as any)._id,
          ],
        },
        status: 'active',
      })
        .populate('category', 'name slug')
        .select('name image category status slug shortDescription sizeCategories')
        .sort({ views: -1 })
        .limit(limit - relatedProducts.length)
        .lean();

      // Convert additional fish products
      const convertedAdditional = additionalProducts.map((fp: any) => {
        const defaultSizeCat = fp.sizeCategories.find((sc: any) => sc.isDefault) || fp.sizeCategories[0];
        const totalStock = fp.sizeCategories.reduce((sum: number, sc: any) => sum + (sc.stock || 0), 0);
        const minPrice = Math.min(...fp.sizeCategories.map((sc: any) => sc.pricePerKg));
        const maxPrice = Math.max(...fp.sizeCategories.map((sc: any) => sc.pricePerKg));

        return {
          ...fp,
          _id: fp._id,
          price: defaultSizeCat?.pricePerKg || minPrice,
          stock: totalStock,
          images: fp.image ? [fp.image] : [],
          hasVariants: fp.sizeCategories.length > 1,
          variants: fp.sizeCategories.map((sc: any) => ({
            _id: sc._id,
            label: sc.label,
            price: sc.pricePerKg,
            stock: sc.stock || 0,
            measurement: 1,
            unit: 'kg',
            status: sc.status,
            isDefault: sc.isDefault,
          })),
          priceRange: { min: minPrice, max: maxPrice },
          isFishProduct: true,
        };
      });

      relatedProducts = [...relatedProducts, ...convertedAdditional];
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

