import mongoose, { Schema, Model } from 'mongoose';
import { ICart, ICartItem } from '../types/index.js';

const variantSnapshotSchema = new Schema<ICartItem['variant']>(
  {
    variantId: { type: Schema.Types.ObjectId },
    label: { type: String, trim: true },
    sku: { type: String, trim: true },
    price: { type: Number },
    salePrice: { type: Number },
    measurement: { type: Number },
    unit: {
      type: String,
      enum: ['pcs', 'kg', 'g', 'l', 'ml'],
    },
    image: { type: String, trim: true },
  },
  { _id: false }
);

const cartItemSchema = new Schema<ICartItem>({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, default: 1 },
  price: { type: Number },
  variant: { type: variantSnapshotSchema },
});

const cartSchema = new Schema<ICart>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [cartItemSchema],
  },
  {
    timestamps: true,
  }
);

const Cart: Model<ICart> = mongoose.model<ICart>('Cart', cartSchema);
export default Cart;

