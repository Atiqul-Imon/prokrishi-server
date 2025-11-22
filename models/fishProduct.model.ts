import mongoose, { Schema, Model } from 'mongoose';

export interface IFishSizeCategory {
  label: string; // e.g., "2kg size", "4kg size"
  pricePerKg: number; // Price per kilogram for this size
  stock: number; // Stock quantity for this size category
  minWeight?: number; // Optional minimum weight for this size category
  maxWeight?: number; // Optional maximum weight for this size category
  sku?: string; // Optional SKU for this size category
  status: 'active' | 'inactive' | 'out_of_stock';
  isDefault?: boolean;
}

export interface IFishProduct {
  _id?: mongoose.Types.ObjectId;
  name: string;
  sku?: string;
  category: mongoose.Types.ObjectId; // Reference to Category (should be fish category)
  description?: string;
  shortDescription?: string;
  image?: string;
  sizeCategories: IFishSizeCategory[];
  status: 'active' | 'inactive';
  isFeatured: boolean;
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  tags?: string[];
  views?: number;
  lastViewedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const fishSizeCategorySchema = new Schema<IFishSizeCategory>(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    pricePerKg: {
      type: Number,
      required: true,
      min: 0,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    minWeight: {
      type: Number,
      min: 0,
    },
    maxWeight: {
      type: Number,
      min: 0,
    },
    sku: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'out_of_stock'],
      default: 'active',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const fishProductSchema = new Schema<IFishProduct>(
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
    description: {
      type: String,
      default: '',
    },
    shortDescription: {
      type: String,
      maxlength: 100,
      default: '',
    },
    image: {
      type: String,
      default: '',
    },
    sizeCategories: {
      type: [fishSizeCategorySchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    slug: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
    },
    metaTitle: {
      type: String,
      trim: true,
    },
    metaDescription: {
      type: String,
      maxlength: 160,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    views: {
      type: Number,
      default: 0,
    },
    lastViewedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-validate hook to ensure at least one default size category
fishProductSchema.pre('validate', function (next) {
  const doc = this as any;
  const sizeCategories = Array.isArray(doc.sizeCategories) ? doc.sizeCategories : [];

  if (sizeCategories.length > 0) {
    // Ensure only one default size category
    let defaultCategory = sizeCategories.find((cat: any) => cat.isDefault);
    if (!defaultCategory) {
      sizeCategories[0].isDefault = true;
    } else {
      sizeCategories.forEach((cat: any) => {
        cat.isDefault = cat === defaultCategory || cat._id?.equals?.(defaultCategory._id);
      });
    }
  }

  next();
});

// Pre-save hook to generate SKU and slug
fishProductSchema.pre('save', async function (next) {
  try {
    const doc = this as any;
    
    // Generate SKU if not provided
    if (this.isNew && !doc.sku) {
      const category = await mongoose.model('Category').findById(doc.category);
      if (category) {
        const categoryPrefix = (category as any).name.slice(0, 3).toUpperCase();
        const uniquePart = this._id.toString().slice(-6).toUpperCase();
        doc.sku = `FISH-${categoryPrefix}-${uniquePart}`;
      }
    }

    // Generate slug if not provided
    if (this.isModified('name') && !doc.slug) {
      const slugBase = (doc.name as string)
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');

      let slug = slugBase;
      let counter = 1;
      while (await mongoose.model('FishProduct').findOne({ slug, _id: { $ne: this._id } })) {
        slug = `${slugBase}-${counter}`;
        counter++;
      }
      doc.slug = slug;
    }

    // Generate meta fields if not provided
    if (!doc.metaTitle && doc.name) {
      doc.metaTitle = `${doc.name} | Prokrishi Fish`;
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

// Indexes
fishProductSchema.index({ category: 1, status: 1 });
fishProductSchema.index({ slug: 1 });
fishProductSchema.index({ status: 1, isFeatured: 1 });
fishProductSchema.index({ views: -1 });
fishProductSchema.index({ name: 'text', description: 'text' });
fishProductSchema.index({ 'sizeCategories.sku': 1 });

const FishProduct: Model<IFishProduct> = mongoose.model<IFishProduct>('FishProduct', fishProductSchema);
export default FishProduct;

