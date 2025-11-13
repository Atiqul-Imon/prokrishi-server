import { Response } from 'express';
import Category from '../models/category.model.js';
import ImageKit from 'imagekit';
import { generateSlug } from '../utils/slugGenerator.js';
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
    console.log('✅ ImageKit initialized successfully for categories');
  } else {
    console.warn('⚠️ ImageKit not configured - category image features will be disabled');
  }
} catch (error: any) {
  console.error('❌ ImageKit initialization failed for categories:', error);
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
        folder: '/prokrishi/categories',
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

export const createCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, isFeatured } = req.body;

    const exists = await Category.findOne({ name: name.toLowerCase() });
    if (exists) {
      res.status(400).json({
        message: 'Category already exists',
        error: true,
        success: false,
      });
      return;
    }

    let image_url: string | null = null;
    let imagekit_id: string | null = null;

    if (req.file) {
      const result = await uploadToImageKit(req.file.buffer, req.file.originalname);
      image_url = result.url;
      imagekit_id = result.fileId;
    }

    const category = await Category.create({
      name: name.toLowerCase(),
      slug: generateSlug(name),
      description,
      image: image_url,
      isFeatured: isFeatured || false,
      cloudinary_id: imagekit_id,
    });

    res.status(201).json({
      message: 'Category created successfully',
      success: true,
      category,
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to create category',
      error: error.message,
      success: false,
    });
  }
};

export const getCategories = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categories = await Category.find()
      .select('-__v -cloudinary_id')
      .lean()
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, categories });
  } catch (error: any) {
    res.status(500).json({
      message: 'Error fetching categories',
      error: error.message,
      success: false,
    });
  }
};

export const getCategoryById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const category = await Category.findById(req.params.id).select('-__v').lean();

    if (!category) {
      res.status(404).json({
        message: 'Category not found',
        success: false,
      });
      return;
    }

    res.status(200).json({ success: true, category });
  } catch (error: any) {
    res.status(500).json({
      message: 'Error fetching category',
      error: error.message,
      success: false,
    });
  }
};

export const getCategoryBySlug = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const category = await Category.findOne({ slug: req.params.slug });

    if (!category) {
      res.status(404).json({
        message: 'Category not found',
        success: false,
      });
      return;
    }

    res.status(200).json({ success: true, category });
  } catch (error: any) {
    res.status(500).json({
      message: 'Error fetching category',
      error: error.message,
      success: false,
    });
  }
};

export const updateCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, isFeatured } = req.body;
    const category = await Category.findById(req.params.id);

    if (!category) {
      res.status(404).json({ message: 'Category not found', success: false });
      return;
    }

    let image_url = category.image;
    let imagekit_id = category.cloudinary_id;

    if (req.file) {
      const result = await uploadToImageKit(req.file.buffer, req.file.originalname);
      image_url = result.url;
      imagekit_id = result.fileId;
    }

    const updateData: Record<string, any> = {};

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
      updateData.cloudinary_id = imagekit_id;
    }

    const updated = await Category.findByIdAndUpdate(req.params.id, updateData, { new: true });

    res.status(200).json({ success: true, category: updated });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to update category',
      error: error.message,
      success: false,
    });
  }
};

export const deleteCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      res.status(404).json({ message: 'Category not found', success: false });
      return;
    }

    await Category.findByIdAndDelete(req.params.id);

    res.status(200).json({
      message: 'Category deleted successfully',
      success: true,
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to delete category',
      error: error.message,
      success: false,
    });
  }
};

export const getFeaturedCategories = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categories = await Category.find({ isFeatured: true }).limit(8);
    res.status(200).json({
      message: 'Featured categories fetched successfully',
      success: true,
      categories,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Server error', success: false, error: true });
  }
};

