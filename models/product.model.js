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

// Pre-save hook to generate SKU for new products
productSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      const category = await mongoose.model('Category').findById(this.category);
      if (!category) {
        throw new Error('Category not found for SKU generation.');
      }
      
      const categoryPrefix = category.name.slice(0, 3).toUpperCase();
      const uniquePart = this._id.toString().slice(-6).toUpperCase();
      this.sku = `${categoryPrefix}-${uniquePart}`;
      
    } catch (error) {
      return next(error);
    }
  }
  next();
});

const Product = mongoose.model("Product", productSchema);
export default Product;
