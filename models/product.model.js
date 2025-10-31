import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
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
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
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
      min: 0.01, // Allow fractional measurements (0.01 minimum)
    },

    unit: {
      type: String,
      required: true,
      enum: ['pcs', 'kg', 'g', 'l', 'ml'],
      default: 'pcs',
    },

    // Add support for minimum order quantity
    minOrderQuantity: {
      type: Number,
      default: 0.01,
      min: 0.01,
    },

    // Add support for measurement increments (e.g., 0.1 for 100g increments)
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
      enum: ["active", "inactive", "out_of_stock"],
      default: "active",
    },

    image: {
      type: String,
      default: "",
    },

    description: {
      type: String,
      default: "",
    },

    shortDescription: {
      type: String,
      maxlength: 100,
      default: "",
    },
    
    // SEO and Metadata
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
    
    // Analytics and Engagement
    views: {
      type: Number,
      default: 0,
    },
    lastViewedAt: {
      type: Date,
    },
    
    // Additional Product Details
    specifications: {
      type: Map,
      of: String,
      default: {},
    },
    tags: [{
      type: String,
      trim: true,
    }],
    
    // Rating and Reviews (for future implementation)
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
productSchema.virtual('displayMeasurement').get(function() {
  const measurement = this.measurement;
  const unit = this.unit;
  
  // Format measurement for display
  if (measurement >= 1) {
    return `${measurement} ${unit}`;
  } else if (measurement >= 0.1) {
    return `${measurement} ${unit}`;
  } else {
    // Convert to smaller units for better display
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
productSchema.virtual('pricePerUnit').get(function() {
  return this.price / this.measurement;
});

// Pre-save hook to generate SKU and slug for new products
productSchema.pre('save', async function(next) {
  try {
    // Generate SKU for new products
    if (this.isNew && !this.sku) {
      const category = await mongoose.model('Category').findById(this.category);
      if (!category) {
        throw new Error('Category not found for SKU generation.');
      }
      
      const categoryPrefix = category.name.slice(0, 3).toUpperCase();
      const uniquePart = this._id.toString().slice(-6).toUpperCase();
      this.sku = `${categoryPrefix}-${uniquePart}`;
    }
    
    // Generate slug from name if not provided
    if (this.isModified('name') && !this.slug) {
      const slugBase = this.name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/[\s_-]+/g, '-') // Replace spaces/underscores with hyphens
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
      
      // Ensure uniqueness
      let slug = slugBase;
      let counter = 1;
      while (await mongoose.model('Product').findOne({ slug, _id: { $ne: this._id } })) {
        slug = `${slugBase}-${counter}`;
        counter++;
      }
      this.slug = slug;
    }
    
    // Auto-generate meta fields if not provided
    if (!this.metaTitle && this.name) {
      this.metaTitle = `${this.name} | Prokrishi`;
    }
    if (!this.metaDescription && this.shortDescription) {
      this.metaDescription = this.shortDescription.substring(0, 160);
    } else if (!this.metaDescription && this.description) {
      this.metaDescription = this.description.substring(0, 160).replace(/\n/g, ' ').trim();
    }
    
  } catch (error) {
    return next(error);
  }
  next();
});

// Indexes for better query performance
productSchema.index({ category: 1, status: 1 });
productSchema.index({ slug: 1 });
productSchema.index({ status: 1, isFeatured: 1 });
productSchema.index({ views: -1 });
productSchema.index({ 'name': 'text', 'description': 'text' }); // Text search index

const Product = mongoose.model("Product", productSchema);
export default Product;
