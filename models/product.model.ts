import mongoose, { Schema, Model } from 'mongoose';
import { IProduct } from '../types/index.js';

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      unique: true,
      trim: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    measurement: {
      type: Number,
      required: true,
      default: 1,
      min: 0.01,
    },
    unit: {
      type: String,
      required: true,
      enum: ['pcs', 'kg', 'g', 'l', 'ml'],
      default: 'pcs',
    },
    measurementIncrement: {
      type: Number,
      default: 0.01,
      min: 0.01,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    sold: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'out_of_stock'],
      default: 'active',
    },
    image: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    shortDescription: {
      type: String,
      maxlength: 100,
      default: '',
    },
    metaTitle: {
      type: String,
      trim: true,
    },
    metaDescription: {
      type: String,
      maxlength: 160,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
    },
    views: {
      type: Number,
      default: 0,
    },
    lastViewedAt: {
      type: Date,
    },
    specifications: {
      type: Map,
      of: String,
      default: {},
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual field for display measurement
productSchema.virtual('displayMeasurement').get(function (this: IProduct) {
  const measurement = (this as any).measurement;
  const unit = (this as any).unit;

  if (measurement >= 1) {
    return `${measurement} ${unit}`;
  } else if (measurement >= 0.1) {
    return `${measurement} ${unit}`;
  } else {
    if (unit === 'kg' && measurement < 0.1) {
      return `${(measurement * 1000).toFixed(0)}g`;
    } else if (unit === 'l' && measurement < 0.1) {
      return `${(measurement * 1000).toFixed(0)}ml`;
    } else {
      return `${measurement} ${unit}`;
    }
  }
});

// Virtual field for price per unit
productSchema.virtual('pricePerUnit').get(function (this: IProduct) {
  return ((this as any).price / (this as any).measurement) as number;
});

// Pre-save hook to generate SKU and slug for new products
productSchema.pre('save', async function (this: IProduct, next) {
  try {
    const doc = this as any;
    if (this.isNew && !doc.sku) {
      const category = await mongoose.model('Category').findById(doc.category);
      if (!category) {
        throw new Error('Category not found for SKU generation.');
      }

      const categoryPrefix = (category as any).name.slice(0, 3).toUpperCase();
      const uniquePart = this._id.toString().slice(-6).toUpperCase();
      doc.sku = `${categoryPrefix}-${uniquePart}`;
    }

    if (this.isModified('name') && !doc.slug) {
      const slugBase = (doc.name as string)
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');

      let slug = slugBase;
      let counter = 1;
      while (await mongoose.model('Product').findOne({ slug, _id: { $ne: this._id } })) {
        slug = `${slugBase}-${counter}`;
        counter++;
      }
      doc.slug = slug;
    }

    if (!doc.metaTitle && doc.name) {
      doc.metaTitle = `${doc.name} | Prokrishi`;
    }
    if (!doc.metaDescription && doc.shortDescription) {
      doc.metaDescription = (doc.shortDescription as string).substring(0, 160);
    } else if (!doc.metaDescription && doc.description) {
      doc.metaDescription = (doc.description as string).substring(0, 160).replace(/\n/g, ' ').trim();
    }
  } catch (error) {
    return next(error as Error);
  }
  next();
});

// Indexes for better query performance
productSchema.index({ category: 1, status: 1 });
productSchema.index({ slug: 1 });
productSchema.index({ status: 1, isFeatured: 1 });
productSchema.index({ views: -1 });
productSchema.index({ name: 'text', description: 'text' });

const Product: Model<IProduct> = mongoose.model<IProduct>('Product', productSchema);
export default Product;

