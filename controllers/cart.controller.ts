import { Response } from 'express';
import mongoose from 'mongoose';
import Cart from '../models/cart.model.js';
import Product from '../models/product.model.js';
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

    const { productId, quantity = 1, variantId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ message: 'Invalid product ID' });
      return;
    }

    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    let variantSnapshot = undefined;
    let unitPrice = product.price;

    if (product.hasVariants) {
      const targetVariant = product.variants?.find((variant: any) =>
        variantId ? variant._id.equals(variantId) : variant.isDefault
      );

      if (!targetVariant) {
        res.status(400).json({ message: 'Variant not found for this product' });
        return;
      }

      if (targetVariant.status !== 'active' || targetVariant.stock < quantity) {
        res.status(400).json({ message: 'Variant is not available in requested quantity' });
        return;
      }

      variantSnapshot = {
        variantId: targetVariant._id,
        label: targetVariant.label,
        sku: targetVariant.sku,
        price: targetVariant.price,
        salePrice: targetVariant.salePrice,
        measurement: targetVariant.measurement,
        unit: targetVariant.unit,
        image: targetVariant.image,
      };
      unitPrice = targetVariant.salePrice || targetVariant.price;
    } else {
      if (product.status !== 'active' || product.stock < quantity) {
        res.status(400).json({ message: 'Product not available in requested quantity' });
        return;
      }
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

    const itemIndex = cart.items.findIndex((i: any) => {
      if (!i.product.equals(productId)) return false;
      if (variantSnapshot?.variantId) {
        return i.variant?.variantId?.equals?.(variantSnapshot.variantId);
      }
      return !i.variant?.variantId;
    });

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
    } else {
      cart.items.push({
        product: product._id,
        quantity,
        price: unitPrice,
        variant: variantSnapshot,
      });
    }

    await cart.save();
    await cart.populate('items.product');

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
    const { quantity, variantId } = req.body;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    const item = cart.items.find((i: any) => {
      if (!i.product.equals(productId)) return false;
      if (variantId) {
        return i.variant?.variantId?.equals?.(variantId);
      }
      return !i.variant?.variantId;
    });

    if (!item) {
      res.status(404).json({ message: 'Item not found' });
      return;
    }

    if (quantity <= 0) {
      cart.items = cart.items.filter((i: any) => i !== item);
    } else {
      item.quantity = quantity;
    }

    await cart.save();
    await cart.populate('items.product');
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
    const { variantId } = req.query;

    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    cart.items = cart.items.filter((i: any) => {
      if (!i.product.equals(productId)) return true;
      if (variantId) {
        return !i.variant?.variantId?.equals?.(variantId as any);
      }
      return !!i.variant?.variantId;
    });

    await cart.save();
    await cart.populate('items.product');
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

