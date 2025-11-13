import { Response } from 'express';
import Cart from '../models/cart.model.js';
import { AuthRequest } from '../types/index.js';

export const getCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?._id) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    res.json({ cart });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching cart', error: error.message });
  }
};

export const addToCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?._id) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { productId, quantity = 1 } = req.body;
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

    const itemIndex = cart.items.findIndex((i: any) => i.product.equals(productId));
    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
    } else {
      cart.items.push({ product: productId, quantity });
    }

    await cart.save();
    res.json({ cart });
  } catch (error: any) {
    res.status(500).json({ message: 'Error adding to cart', error: error.message });
  }
};

export const updateCartItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?._id) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { productId } = req.params;
    const { quantity } = req.body;
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    const item = cart.items.find((i: any) => i.product.equals(productId));
    if (!item) {
      res.status(404).json({ message: 'Item not found' });
      return;
    }

    item.quantity = quantity;
    await cart.save();
    res.json({ cart });
  } catch (error: any) {
    res.status(500).json({ message: 'Error updating cart item', error: error.message });
  }
};

export const removeCartItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?._id) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { productId } = req.params;
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    cart.items = cart.items.filter((i: any) => !i.product.equals(productId));
    await cart.save();
    res.json({ cart });
  } catch (error: any) {
    res.status(500).json({ message: 'Error removing cart item', error: error.message });
  }
};

export const clearCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?._id) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });
    res.json({ message: 'Cart cleared' });
  } catch (error: any) {
    res.status(500).json({ message: 'Error clearing cart', error: error.message });
  }
};

