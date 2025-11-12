import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import User from '../models/user.model.js';
import cacheService from '../services/cache.js';
import logger, { logBusiness, logPerformance } from '../services/logger.js';

// @desc    Create new order (COD optimized) - Supports both authenticated and guest orders
// @route   POST /api/order/create
// @access  Public (guest) / Private (authenticated)
export const createOrder = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { 
    orderItems, 
    shippingAddress, 
    paymentMethod = 'Cash on Delivery', 
    totalPrice,
    guestInfo // For guest orders: { name, email, phone }
  } = req.body;

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

  // Check if this is a guest order
  const isGuestOrder = !req.user;
  
  // Validate guest info if it's a guest order
  if (isGuestOrder) {
    if (!guestInfo || !guestInfo.name || !guestInfo.phone) {
      return res.status(400).json({
        success: false,
        message: 'Guest information (name and phone) is required'
      });
    }
  }

  try {
    // Start database transaction to prevent overselling
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Validate products and check stock WITHIN transaction
        const validatedItems = [];
        let calculatedTotal = 0;
        const productUpdates = [];

        for (const item of orderItems) {
          // Use findOneAndUpdate with optimistic locking to prevent race conditions
          const product = await Product.findById(item.product).session(session);
          if (!product) {
            throw new Error(`Product not found: ${item.name}`);
          }

          if (product.stock < item.quantity) {
            throw new Error(`Insufficient stock for ${item.name}. Available: ${product.stock}`);
          }

          if (product.status !== 'active') {
            throw new Error(`Product ${item.name} is not available`);
          }

          // Reserve stock atomically using findOneAndUpdate
          const updatedProduct = await Product.findByIdAndUpdate(
            item.product,
            { 
              $inc: { 
                stock: -item.quantity,
                sold: item.quantity 
              }
            },
            { 
              new: true,
              session,
              // Ensure stock doesn't go negative
              runValidators: true
            }
          );

          if (updatedProduct.stock < 0) {
            throw new Error(`Stock would go negative for ${item.name}. Available: ${product.stock}`);
          }

          const itemTotal = item.price * item.quantity;
          calculatedTotal += itemTotal;

          validatedItems.push({
            product: product._id,
            name: item.name,
            quantity: item.quantity,
            price: item.price
          });

          productUpdates.push({
            productId: product._id,
            quantity: item.quantity,
            originalStock: product.stock
          });
        }

        // Verify total price
        if (Math.abs(calculatedTotal - totalPrice) > 0.01) {
          throw new Error('Price mismatch detected');
        }

        // Create order within transaction
        const orderData = {
          orderItems: validatedItems,
          shippingAddress,
          paymentMethod,
          totalPrice: calculatedTotal,
          totalAmount: calculatedTotal,
          status: 'pending',
          paymentStatus: 'pending',
          isGuestOrder: isGuestOrder,
        };

        // Add user or guest info
        if (isGuestOrder) {
          orderData.guestInfo = {
            name: guestInfo.name,
            email: guestInfo.email || '',
            phone: guestInfo.phone,
          };
        } else {
          orderData.user = req.user._id;
        }

        const order = new Order(orderData);

        const createdOrder = await order.save({ session });
        
        // Store the created order for response
        req.createdOrder = createdOrder;
        req.productUpdates = productUpdates;
      });

      // Transaction completed successfully
      const createdOrder = req.createdOrder;
      
      // Populate order details
      const populatedOrder = await Order.findById(createdOrder._id)
        .populate('user', 'name email phone')
        .populate('orderItems.product', 'name image sku');
      
      // Add userInfo for response (either from user or guestInfo)
      if (populatedOrder.user) {
        populatedOrder.userInfo = {
          name: populatedOrder.user.name,
          email: populatedOrder.user.email,
          phone: populatedOrder.user.phone,
        };
      } else if (populatedOrder.guestInfo) {
        populatedOrder.userInfo = {
          name: populatedOrder.guestInfo.name,
          email: populatedOrder.guestInfo.email,
          phone: populatedOrder.guestInfo.phone,
        };
      }

      // Log business event
      logBusiness('ORDER_CREATED', {
        orderId: createdOrder._id,
        userId: isGuestOrder ? 'guest' : req.user._id,
        isGuestOrder: isGuestOrder,
        itemCount: orderItems.length,
        totalAmount: calculatedTotal,
        paymentMethod: paymentMethod,
        stockReserved: true
      });

      // Invalidate product caches to reflect stock changes
      for (const update of req.productUpdates) {
        await cacheService.del(`product:${update.productId}`);
      }
      if (!isGuestOrder) {
        await cacheService.delPattern(`user:${req.user._id}:orders:*`);
      }

      logPerformance('createOrder', Date.now() - startTime, { 
        itemCount: orderItems.length,
        totalAmount: calculatedTotal,
        transactionUsed: true
      });

      res.status(201).json({
        success: true,
        message: 'Order created successfully with stock reserved',
        order: populatedOrder
      });

    } catch (transactionError) {
      // Transaction failed - rollback automatically handled by MongoDB
      logger.error('Order creation transaction failed:', transactionError);
      
      // Return appropriate error message
      if (transactionError.message.includes('Insufficient stock')) {
        return res.status(400).json({
          success: false,
          message: transactionError.message
        });
      }
      
      if (transactionError.message.includes('Product not found')) {
        return res.status(404).json({
          success: false,
          message: transactionError.message
        });
      }
      
      if (transactionError.message.includes('not available')) {
        return res.status(400).json({
          success: false,
          message: transactionError.message
        });
      }
      
      if (transactionError.message.includes('Price mismatch')) {
        return res.status(400).json({
          success: false,
          message: transactionError.message
        });
      }
      
      throw transactionError; // Re-throw for general error handling
    } finally {
      await session.endSession();
    }

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

    // Add userInfo for each order (from user or guestInfo)
    const ordersWithUserInfo = orders.map(order => {
      const orderObj = order.toObject ? order.toObject() : order;
      if (orderObj.user) {
        orderObj.userInfo = {
          name: orderObj.user.name,
          email: orderObj.user.email,
          phone: orderObj.user.phone,
        };
      } else if (orderObj.guestInfo) {
        orderObj.userInfo = {
          name: orderObj.guestInfo.name,
          email: orderObj.guestInfo.email || '',
          phone: orderObj.guestInfo.phone,
        };
      }
      return orderObj;
    });

    const result = {
      orders: ordersWithUserInfo,
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

    // Use transaction to restore stock when cancelling order
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Update order status within transaction
        order.status = 'cancelled';
        order.paymentStatus = 'cancelled';
        await order.save({ session });

        // Restore stock for all items in the cancelled order
        for (const item of order.orderItems) {
          await Product.findByIdAndUpdate(
            item.product,
            { 
              $inc: { 
                stock: item.quantity,
                sold: -item.quantity 
              }
            },
            { session }
          );
        }
      });

      // Transaction completed successfully
      
      // Invalidate caches to reflect stock restoration
      for (const item of order.orderItems) {
        await cacheService.del(`product:${item.product}`);
      }
      await cacheService.delPattern('orders:*');
      await cacheService.delPattern(`user:${req.user._id}:orders:*`);
      await cacheService.del(`order:${req.params.id}`);

      // Log business event
      logBusiness('ORDER_CANCELLED', {
        orderId: order._id,
        userId: req.user._id,
        amount: order.totalAmount,
        stockRestored: true
      });

      logger.info(`Order cancelled: ${req.params.id} by user ${req.user._id} - Stock restored`);

      res.json({
        success: true,
        message: 'Order cancelled successfully and stock restored',
        order
      });

    } catch (transactionError) {
      // Transaction failed - rollback automatically handled by MongoDB
      logger.error('Order cancellation transaction failed:', transactionError);
      throw transactionError;
    } finally {
      await session.endSession();
    }

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