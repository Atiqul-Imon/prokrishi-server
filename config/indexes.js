import mongoose from 'mongoose';
import Product from '../models/product.model.js';
import Category from '../models/category.model.js';
import User from '../models/user.model.js';
import Order from '../models/order.model.js';
import Cart from '../models/cart.model.js';

// Create database indexes for optimal performance
export const createIndexes = async () => {
  try {
    console.log('🔍 Creating database indexes...');

    // Product indexes
    await Product.collection.createIndex({ name: 'text', description: 'text' });
    await Product.collection.createIndex({ category: 1, status: 1 });
    await Product.collection.createIndex({ price: 1 });
    await Product.collection.createIndex({ createdAt: -1 });
    await Product.collection.createIndex({ isFeatured: 1, status: 1 });
    await Product.collection.createIndex({ sku: 1 }, { unique: true });
    await Product.collection.createIndex({ stock: 1 });
    await Product.collection.createIndex({ sold: -1 });
    console.log('✅ Product indexes created');

    // Category indexes
    await Category.collection.createIndex({ name: 1 }, { unique: true });
    await Category.collection.createIndex({ slug: 1 }, { unique: true });
    await Category.collection.createIndex({ isFeatured: 1 });
    await Category.collection.createIndex({ createdAt: -1 });
    console.log('✅ Category indexes created');

    // User indexes
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ role: 1 });
    await User.collection.createIndex({ isVerified: 1 });
    await User.collection.createIndex({ createdAt: -1 });
    await User.collection.createIndex({ 'addresses.division': 1, 'addresses.district': 1 });
    console.log('✅ User indexes created');

    // Order indexes
    await Order.collection.createIndex({ user: 1, createdAt: -1 });
    await Order.collection.createIndex({ status: 1 });
    await Order.collection.createIndex({ paymentStatus: 1 });
    await Order.collection.createIndex({ transactionId: 1 });
    await Order.collection.createIndex({ createdAt: -1 });
    await Order.collection.createIndex({ 'shippingAddress.district': 1 });
    console.log('✅ Order indexes created');

    // Cart indexes
    await Cart.collection.createIndex({ user: 1 }, { unique: true });
    await Cart.collection.createIndex({ 'items.product': 1 });
    console.log('✅ Cart indexes created');

    console.log('🎉 All database indexes created successfully!');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    throw error;
  }
};

// Drop all indexes (for development/testing)
export const dropIndexes = async () => {
  try {
    console.log('🗑️ Dropping all indexes...');
    
    await Product.collection.dropIndexes();
    await Category.collection.dropIndexes();
    await User.collection.dropIndexes();
    await Order.collection.dropIndexes();
    await Cart.collection.dropIndexes();
    
    console.log('✅ All indexes dropped');
  } catch (error) {
    console.error('❌ Error dropping indexes:', error);
    throw error;
  }
};

// Get index information
export const getIndexInfo = async () => {
  try {
    const indexes = {
      products: await Product.collection.getIndexes(),
      categories: await Category.collection.getIndexes(),
      users: await User.collection.getIndexes(),
      orders: await Order.collection.getIndexes(),
      carts: await Cart.collection.getIndexes(),
    };
    
    return indexes;
  } catch (error) {
    console.error('❌ Error getting index info:', error);
    throw error;
  }
};
