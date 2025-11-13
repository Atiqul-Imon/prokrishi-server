import mongoose, { Schema, Model } from 'mongoose';
import { ICategory } from '../types/index.js';

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      unique: true,
      lowercase: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
      default: null,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    cloudinary_id: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Category: Model<ICategory> = mongoose.model<ICategory>('Category', categorySchema);
export default Category;

