import Cart from "../models/cart.model.js";
import Product from "../models/product.model.js";

// Get user's cart
export const getCart = async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id }).populate("items.product");
  res.json({ cart });
};

// Add product to cart
export const addToCart = async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

  const itemIndex = cart.items.findIndex(i => i.product.equals(productId));
  if (itemIndex > -1) {
    cart.items[itemIndex].quantity += quantity;
  } else {
    cart.items.push({ product: productId, quantity });
  }

  await cart.save();
  res.json({ cart });
};

// Update quantity
export const updateCartItem = async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body;
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return res.status(404).json({ message: "Cart not found" });

  const item = cart.items.find(i => i.product.equals(productId));
  if (!item) return res.status(404).json({ message: "Item not found" });

  item.quantity = quantity;
  await cart.save();
  res.json({ cart });
};

// Remove item
export const removeCartItem = async (req, res) => {
  const { productId } = req.params;
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return res.status(404).json({ message: "Cart not found" });

  cart.items = cart.items.filter(i => !i.product.equals(productId));
  await cart.save();
  res.json({ cart });
};

// Clear cart
export const clearCart = async (req, res) => {
  await Cart.findOneAndUpdate({ user: req.user._id }, { items: [] });
  res.json({ message: "Cart cleared" });
};