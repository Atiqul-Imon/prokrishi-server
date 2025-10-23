import asyncHandler from 'express-async-handler';
import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import User from '../models/user.model.js';
import cacheService from '../services/cache.js';
import logger, { logBusiness, logPerformance } from '../services/logger.js';

// @desc    Create new order (COD optimized)
// @route   POST /api/order/create
// @access  Private
export const createOrder = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { orderItems, shippingAddress, paymentMethod = 'Cash on Delivery', totalPrice } = req.body;

  if (!orderItems || orderItems.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No order items provided'
    });
  }

  if (!shippingAddress) {
    return res.status(400).json({
      success: false,
      message: 'Shipping address is required'
    });
  }

  try {
    // Validate products and check stock
    const validatedItems = [];
    let calculatedTotal = 0;

    for (const item of orderItems) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.name}`
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.name}. Available: ${product.stock}`
        });
      }

      if (product.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: `Product ${item.name} is not available`
        });
      }

      const itemTotal = item.price * item.quantity;
      calculatedTotal += itemTotal;

      validatedItems.push({
        product: product._id,
        name: item.name,
        quantity: item.quantity,
        price: item.price
      });
    }

    // Verify total price
    if (Math.abs(calculatedTotal - totalPrice) > 0.01) {
      return res.status(400).json({
        success: false,
        message: 'Price mismatch detected'
      });
    }

    // Create order
    const order = new Order({
      orderItems: validatedItems,
      user: req.user._id,
      shippingAddress,
      paymentMethod,
      totalPrice: calculatedTotal,
      totalAmount: calculatedTotal,
      status: 'pending',
      paymentStatus: 'pending'
    });

    const createdOrder = await order.save();
    
    // Populate order details
    const populatedOrder = await Order.findById(createdOrder._id)
      .populate('user', 'name email phone')
      .populate('orderItems.product', 'name image sku');

    // Log business event
    logBusiness('ORDER_CREATED', {
      orderId: createdOrder._id,
      userId: req.user._id,
      itemCount: orderItems.length,
      totalAmount: calculatedTotal,
      paymentMethod: paymentMethod
    });

    // Invalidate user orders cache
    await cacheService.delPattern(`user:${req.user._id}:orders:*`);

    logPerformance('createOrder', Date.now() - startTime, { 
      itemCount: orderItems.length,
      totalAmount: calculatedTotal 
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: populatedOrder
    });

  } catch (error) {
    logger.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @desc    Get all orders (Admin)
// @route   GET /api/order
// @access  Private/Admin
export const getAllOrders = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { 
    page = 1, 
    limit = 20, 
    status, 
    paymentStatus, 
    sort = 'createdAt', 
    order = 'desc',
    search 
  } = req.query;

  try {
    // Cache disabled for admin panel - always fetch from database

    // Build query
    const query = {};
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (search) {
      query.$or = [
        { 'orderItems.name': { $regex: search, $options: 'i' } },
        { 'shippingAddress.district': { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sortObj = {};
    sortObj[sort] = order === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalOrders = await Order.countDocuments(query);

    // Fetch orders
    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('orderItems.product', 'name image sku')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    const result = {
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalOrders / parseInt(limit)),
        totalOrders,
        hasNext: skip + orders.length < totalOrders,
        hasPrev: parseInt(page) > 1
      }
    };

    // Cache disabled for admin panel

    logPerformance('getAllOrders', Date.now() - startTime, { 
      source: 'database', 
      count: orders.length 
    });

    res.json(result);

  } catch (error) {
    logger.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @desc    Get user orders
// @route   GET /api/order/user
// @access  Private
export const getUserOrders = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { page = 1, limit = 10, status } = req.query;

  try {
    const cacheKey = cacheService.generateKey(
      'user', 
      req.user._id, 
      'orders', 
      `page:${page}`, 
      `limit:${limit}`, 
      `status:${status || 'all'}`
    );

    // Try cache first
    const cachedOrders = await cacheService.get(cacheKey);
    if (cachedOrders) {
      logPerformance('getUserOrders', Date.now() - startTime, { source: 'cache' });
      return res.json(cachedOrders);
    }

    // Build query
    const query = { user: req.user._id };
    if (status) query.status = status;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalOrders = await Order.countDocuments(query);

    // Fetch orders
    const orders = await Order.find(query)
      .populate('orderItems.product', 'name image sku')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const result = {
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalOrders / parseInt(limit)),
        totalOrders,
        hasNext: skip + orders.length < totalOrders,
        hasPrev: parseInt(page) > 1
      }
    };

    // Cache disabled for admin panel

    logPerformance('getUserOrders', Date.now() - startTime, { 
      source: 'database', 
      count: orders.length 
    });

    res.json(result);

  } catch (error) {
    logger.error('Get user orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @desc    Get single order
// @route   GET /api/order/:id
// @access  Private
export const getOrderById = asyncHandler(async (req, res) => {
  const startTime = Date.now();

  try {
    const cacheKey = cacheService.generateKey('order', req.params.id);

    // Try cache first
    const cachedOrder = await cacheService.get(cacheKey);
    if (cachedOrder) {
      logPerformance('getOrderById', Date.now() - startTime, { source: 'cache' });
      return res.json({ success: true, order: cachedOrder });
    }

    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone addresses')
      .populate('orderItems.product', 'name image sku description');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns this order (unless admin)
    if (order.user._id.toString() !== req.user._id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Cache for 10 minutes
    await cacheService.set(cacheKey, order, 600);

    logPerformance('getOrderById', Date.now() - startTime, { source: 'database' });

    res.json({
      success: true,
      order
    });

  } catch (error) {
    logger.error('Get order by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @desc    Update order status (Admin)
// @route   PUT /api/order/:id/status
// @access  Private/Admin
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status'
    });
  }

  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const oldStatus = order.status;
    order.status = status;

    // Set delivery date if status is delivered
    if (status === 'delivered') {
      order.isDelivered = true;
      order.deliveredAt = new Date();
    }

    await order.save();

    // Invalidate caches
    await cacheService.delPattern('orders:*');
    await cacheService.delPattern(`user:${order.user}:orders:*`);
    await cacheService.del(`order:${req.params.id}`);

    // Log business event
    logBusiness('ORDER_STATUS_UPDATED', {
      orderId: order._id,
      oldStatus,
      newStatus: status,
      updatedBy: req.user._id
    });

    logger.info(`Order status updated: ${req.params.id} - ${oldStatus} → ${status}`);

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order
    });

  } catch (error) {
    logger.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @desc    Cancel order
// @route   PUT /api/order/:id/cancel
// @access  Private
export const cancelOrder = asyncHandler(async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns this order
    if (order.user.toString() !== req.user._id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if order can be cancelled
    if (['shipped', 'delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage'
      });
    }

    order.status = 'cancelled';
    order.paymentStatus = 'cancelled';
    await order.save();

    // Invalidate caches
    await cacheService.delPattern('orders:*');
    await cacheService.delPattern(`user:${req.user._id}:orders:*`);
    await cacheService.del(`order:${req.params.id}`);

    // Log business event
    logBusiness('ORDER_CANCELLED', {
      orderId: order._id,
      userId: req.user._id,
      amount: order.totalAmount
    });

    logger.info(`Order cancelled: ${req.params.id} by user ${req.user._id}`);

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order
    });

  } catch (error) {
    logger.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @desc    Get order statistics (Admin)
// @route   GET /api/order/stats
// @access  Private/Admin
export const getOrderStats = asyncHandler(async (req, res) => {
  try {
    // Cache disabled for admin panel - always fetch from database

    const stats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          confirmedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          codOrders: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'Cash on Delivery'] }, 1, 0] }
          }
        }
      }
    ]);

    const result = stats[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      pendingOrders: 0,
      confirmedOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
      codOrders: 0
    };

    // Cache disabled for admin panel

    res.json({
      success: true,
      stats: result
    });

  } catch (error) {
    logger.error('Get order stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});