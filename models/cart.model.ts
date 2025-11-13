import mongoose, { Schema, Model } from 'mongoose';
import { ICart, ICartItem } from '../types/index.js';

const cartItemSchema = new Schema<ICartItem>({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, default: 1 },
  price: { type: Number },
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

