import asyncHandler from 'express-async-handler';
import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import User from '../models/user.model.js';
import logger, { logBusiness, logPerformance } from '../services/logger.js';

// @desc    Get all orders with pagination and filtering (Admin)
// @route   GET /api/admin/orders
// @access  Private/Admin
export const getAllOrders = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      dateFrom,
      dateTo,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }
    
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) {
        filter.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        filter.createdAt.$lte = new Date(dateTo);
      }
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build aggregation pipeline for search
    let pipeline = [
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $unwind: '$userInfo'
      }
    ];

    // Add search filter if provided
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { _id: { $regex: search, $options: 'i' } },
            { 'userInfo.name': { $regex: search, $options: 'i' } },
            { 'userInfo.email': { $regex: search, $options: 'i' } },
            { 'userInfo.phone': { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    // Add other filters
    if (Object.keys(filter).length > 0) {
      pipeline.push({ $match: filter });
    }

    // Add sorting and pagination
    pipeline.push(
      { $sort: sort },
      { $skip: skip },
      { $limit: parseInt(limit) }
    );

    // Execute aggregation
    const orders = await Order.aggregate(pipeline);

    // Get total count for pagination
    const countPipeline = [...pipeline];
    countPipeline.splice(-3); // Remove sort, skip, limit
    countPipeline.push({ $count: 'total' });
    const countResult = await Order.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Calculate pagination info
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    logPerformance('getAllOrders', Date.now() - startTime, { total, page, limit });

    res.status(200).json({
      success: true,
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalOrders: total,
        hasNextPage,
        hasPrevPage,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

// @desc    Get order statistics (Admin)
// @route   GET /api/admin/orders/stats
// @access  Private/Admin
export const getOrderStats = asyncHandler(async (req, res) => {
  try {
    const { period = '30' } = req.query; // days
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));

    // Get basic stats
    const [
      totalOrders,
      totalRevenue,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      recentOrders
    ] = await Promise.all([
      Order.countDocuments(),
      Order.aggregate([
        { $match: { paymentStatus: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } }
      ]),
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: 'processing' }),
      Order.countDocuments({ status: 'shipped' }),
      Order.countDocuments({ status: 'delivered' }),
      Order.countDocuments({ status: 'cancelled' }),
      Order.find({ createdAt: { $gte: daysAgo } })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user', 'name email phone')
        .select('_id user totalPrice status createdAt')
    ]);

    // Get revenue for the period
    const periodRevenue = await Order.aggregate([
      { $match: { createdAt: { $gte: daysAgo }, paymentStatus: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]);

    // Get daily sales for chart
    const dailySales = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: daysAgo },
          paymentStatus: 'completed'
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          totalSales: { $sum: '$totalPrice' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        periodRevenue: periodRevenue[0]?.total || 0,
        statusBreakdown: {
          pending: pendingOrders,
          processing: processingOrders,
          shipped: shippedOrders,
          delivered: deliveredOrders,
          cancelled: cancelledOrders
        },
        recentOrders,
        dailySales
      }
    });
  } catch (error) {
    logger.error('Error fetching order stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order statistics',
      error: error.message
    });
  }
});

// @desc    Update order status (Admin)
// @route   PUT /api/admin/orders/:id/status
// @access  Private/Admin
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;
  const { status, notes } = req.body;

  try {
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Valid statuses are: ' + validStatuses.join(', ')
      });
    }

    const order = await Order.findById(id).populate('user', 'name email phone');
    
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

    // Handle cancellation - restore product stock
    if (status === 'cancelled' && oldStatus !== 'cancelled') {
      for (const item of order.orderItems) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity } }
        );
      }
    }

    await order.save();

    logBusiness('order_status_updated', {
      orderId: id,
      oldStatus,
      newStatus: status,
      userId: req.user.id,
      notes
    });

    logPerformance('updateOrderStatus', Date.now() - startTime);

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      order: {
        _id: order._id,
        status: order.status,
        isDelivered: order.isDelivered,
        deliveredAt: order.deliveredAt
      }
    });
  } catch (error) {
    logger.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message
    });
  }
});

// @desc    Update payment status (Admin)
// @route   PUT /api/admin/orders/:id/payment
// @access  Private/Admin
export const updatePaymentStatus = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;
  const { paymentStatus, transactionId, notes } = req.body;

  try {
    const validPaymentStatuses = ['pending', 'completed', 'failed', 'cancelled'];
    
    if (!validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment status. Valid statuses are: ' + validPaymentStatuses.join(', ')
      });
    }

    const order = await Order.findById(id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const oldPaymentStatus = order.paymentStatus;
    order.paymentStatus = paymentStatus;

    if (paymentStatus === 'completed') {
      order.isPaid = true;
      order.paidAt = new Date();
      if (transactionId) {
        order.transactionId = transactionId;
      }
    } else if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
      order.isPaid = false;
      order.paidAt = null;
    }

    await order.save();

    logBusiness('order_payment_updated', {
      orderId: id,
      oldPaymentStatus,
      newPaymentStatus: paymentStatus,
      userId: req.user.id,
      transactionId,
      notes
    });

    logPerformance('updatePaymentStatus', Date.now() - startTime);

    res.status(200).json({
      success: true,
      message: 'Payment status updated successfully',
      order: {
        _id: order._id,
        paymentStatus: order.paymentStatus,
        isPaid: order.isPaid,
        paidAt: order.paidAt,
        transactionId: order.transactionId
      }
    });
  } catch (error) {
    logger.error('Error updating payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment status',
      error: error.message
    });
  }
});

// @desc    Get single order details (Admin)
// @route   GET /api/admin/orders/:id
// @access  Private/Admin
export const getOrderById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id)
      .populate('user', 'name email phone addresses')
      .populate('orderItems.product', 'name image sku');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.status(200).json({
      success: true,
      order
    });
  } catch (error) {
    logger.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details',
      error: error.message
    });
  }
});

// @desc    Delete order (Admin)
// @route   DELETE /api/admin/orders/:id
// @access  Private/Admin
export const deleteOrder = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Only allow deletion of pending or cancelled orders
    if (!['pending', 'cancelled'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only pending or cancelled orders can be deleted'
      });
    }

    // Restore product stock if order was not cancelled
    if (order.status !== 'cancelled') {
      for (const item of order.orderItems) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { stock: item.quantity } }
        );
      }
    }

    await Order.findByIdAndDelete(id);

    logBusiness('order_deleted', {
      orderId: id,
      userId: req.user.id,
      orderStatus: order.status
    });

    res.status(200).json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete order',
      error: error.message
    });
  }
});
