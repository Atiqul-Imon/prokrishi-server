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
  },
  {
    timestamps: true,
  }
);

const Order: Model<IOrder> = mongoose.model<IOrder>('Order', orderSchema);

export default Order;

