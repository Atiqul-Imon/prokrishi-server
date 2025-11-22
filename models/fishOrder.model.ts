import mongoose, { Schema, Model } from 'mongoose';

export interface IFishOrderItem {
  fishProduct: mongoose.Types.ObjectId;
  fishProductName: string;
  sizeCategoryId: mongoose.Types.ObjectId;
  sizeCategoryLabel: string;
  requestedWeight: number; // Weight customer requested (e.g., 2.5kg)
  actualWeight?: number; // Actual weight delivered (may differ slightly)
  pricePerKg: number; // Price per kg at time of order
  totalPrice: number; // Calculated: requestedWeight × pricePerKg
  inventoryItems: mongoose.Types.ObjectId[]; // References to FishInventory items used
  notes?: string;
}

export interface IFishOrder {
  _id?: mongoose.Types.ObjectId;
  user?: mongoose.Types.ObjectId; // Reference to User (if logged in)
  guestInfo?: {
    name: string;
    email?: string;
    phone: string;
  };
  isGuestOrder: boolean;
  orderItems: IFishOrderItem[];
  shippingAddress: {
    name: string;
    phone: string;
    address: string;
    division?: string;
    district?: string;
    upazila?: string;
    postalCode?: string;
  };
  paymentMethod: string;
  totalPrice: number;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'processing' | 'prepared' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'completed' | 'failed' | 'cancelled';
  orderNumber?: string;
  notes?: string;
  cancelledAt?: Date;
  cancellationReason?: string;
  deliveredAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const fishOrderItemSchema = new Schema<IFishOrderItem>(
  {
    fishProduct: {
      type: Schema.Types.ObjectId,
      ref: 'FishProduct',
      required: true,
    },
    fishProductName: {
      type: String,
      required: true,
    },
    sizeCategoryId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    sizeCategoryLabel: {
      type: String,
      required: true,
    },
    requestedWeight: {
      type: Number,
      required: true,
      min: 0.01,
    },
    actualWeight: {
      type: Number,
      min: 0.01,
    },
    pricePerKg: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    inventoryItems: [
      {
        type: Schema.Types.ObjectId,
        ref: 'FishInventory',
      },
    ],
    notes: {
      type: String,
      trim: true,
    },
  },
  { _id: true }
);

const fishOrderSchema = new Schema<IFishOrder>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    guestInfo: {
      name: { type: String },
      email: { type: String },
      phone: { type: String },
    },
    isGuestOrder: {
      type: Boolean,
      default: false,
    },
    orderItems: [fishOrderItemSchema],
    shippingAddress: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, required: true },
      division: { type: String },
      district: { type: String },
      upazila: { type: String },
      postalCode: { type: String },
    },
    paymentMethod: {
      type: String,
      required: true,
      default: 'Cash on Delivery',
    },
    totalPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
    totalAmount: {
      type: Number,
      required: true,
      default: 0.0,
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'confirmed', 'processing', 'prepared', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: ['pending', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },
    orderNumber: {
      type: String,
      unique: true,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    deliveredAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to generate order number
fishOrderSchema.pre('save', async function (next) {
  try {
    const doc = this as any;
    
    if (this.isNew && !doc.orderNumber) {
      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      doc.orderNumber = `FISH-${dateStr}-${randomPart}`;
    }
  } catch (error) {
    return next(error as Error);
  }
  next();
});

// Indexes
fishOrderSchema.index({ user: 1, createdAt: -1 });
fishOrderSchema.index({ status: 1, createdAt: -1 });
fishOrderSchema.index({ paymentStatus: 1 });
fishOrderSchema.index({ orderNumber: 1 });
fishOrderSchema.index({ 'guestInfo.phone': 1 });
fishOrderSchema.index({ createdAt: -1 });

const FishOrder: Model<IFishOrder> = mongoose.model<IFishOrder>('FishOrder', fishOrderSchema);
export default FishOrder;

