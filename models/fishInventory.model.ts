import mongoose, { Schema, Model } from 'mongoose';

export interface IFishInventory {
  _id?: mongoose.Types.ObjectId;
  fishProduct: mongoose.Types.ObjectId; // Reference to FishProduct
  sizeCategoryId: mongoose.Types.ObjectId; // Reference to size category within FishProduct
  actualWeight: number; // Actual weight of this fish (e.g., 2.5kg, 3.8kg)
  status: 'available' | 'reserved' | 'sold' | 'expired' | 'damaged';
  purchaseDate?: Date; // When this fish was purchased/received
  expiryDate?: Date; // Optional expiry date
  location?: string; // Storage location
  costPrice?: number; // Price paid for this fish (for profit tracking)
  reservedForOrder?: mongoose.Types.ObjectId; // Reference to FishOrder if reserved
  soldToOrder?: mongoose.Types.ObjectId; // Reference to FishOrder if sold
  notes?: string; // Additional notes
  createdAt?: Date;
  updatedAt?: Date;
}

const fishInventorySchema = new Schema<IFishInventory>(
  {
    fishProduct: {
      type: Schema.Types.ObjectId,
      ref: 'FishProduct',
      required: true,
    },
    sizeCategoryId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    actualWeight: {
      type: Number,
      required: true,
      min: 0.01,
    },
    status: {
      type: String,
      enum: ['available', 'reserved', 'sold', 'expired', 'damaged'],
      default: 'available',
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
    },
    location: {
      type: String,
      trim: true,
    },
    costPrice: {
      type: Number,
      min: 0,
    },
    reservedForOrder: {
      type: Schema.Types.ObjectId,
      ref: 'FishOrder',
    },
    soldToOrder: {
      type: Schema.Types.ObjectId,
      ref: 'FishOrder',
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
fishInventorySchema.index({ fishProduct: 1, status: 1 });
fishInventorySchema.index({ sizeCategoryId: 1, status: 1 });
fishInventorySchema.index({ status: 1 });
fishInventorySchema.index({ reservedForOrder: 1 });
fishInventorySchema.index({ soldToOrder: 1 });
fishInventorySchema.index({ expiryDate: 1 });

const FishInventory: Model<IFishInventory> = mongoose.model<IFishInventory>('FishInventory', fishInventorySchema);
export default FishInventory;

