import mongoose, { Schema, Model } from 'mongoose';
import { IOrder, IOrderItem } from '../types/index.js';

const variantSnapshotSchema = new Schema(
  {
    variantId: { type: Schema.Types.ObjectId },
    label: { type: String },
    sku: { type: String },
    price: { type: Number },
    salePrice: { type: Number },
    measurement: { type: Number },
    unit: { type: String },
    image: { type: String },
  },
  { _id: false }
);

const orderItemSchema = new Schema<IOrderItem>({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  variant: { type: variantSnapshotSchema },
});

const orderSchema = new Schema<IOrder>(
  {
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
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
    orderItems: [orderItemSchema],
    shippingAddress: {
      name: { type: String },
      phone: { type: String },
      address: { type: String, required: true },
      division: { type: String, required: false },
      district: { type: String, required: false },
      upazila: { type: String, required: false },
      postalCode: { type: String, required: false },
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
    shippingFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    shippingZone: {
      type: String,
      enum: ['inside_dhaka', 'outside_dhaka'],
    },
    shippingWeightKg: {
      type: Number,
      default: 0,
      min: 0,
    },
    shippingBreakdown: {
      type: Object,
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: ['pending', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },
    transactionId: {
      type: String,
    },
    paymentDetails: {
      transactionId: String,
      validationId: String,
      amount: Number,
      currency: String,
      paymentDate: Date,
      error: String,
      failedDate: Date,
      cancelledDate: Date,
    },
    isPaid: {
      type: Boolean,
      required: true,
      default: false,
    },
    paidAt: {
      type: Date,
    },
    isDelivered: {
      type: Boolean,
      required: true,
      default: false,
    },
    deliveredAt: {
      type: Date,
    },
    invoiceNumber: {
      type: String,
      unique: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to generate invoice number
orderSchema.pre('save', async function (next) {
  try {
    const doc = this as any;
    
    if (this.isNew && !doc.invoiceNumber) {
      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      doc.invoiceNumber = `INV-${dateStr}-${randomPart}`;
    }
  } catch (error) {
    return next(error as Error);
  }
  next();
});

// Indexes
orderSchema.index({ invoiceNumber: 1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

const Order: Model<IOrder> = mongoose.model<IOrder>('Order', orderSchema);

export default Order;

