import { Response } from 'express';
import Order from '../models/order.model.js';
import logger, { logBusiness, logPerformance } from '../services/logger.js';
import { AuthRequest } from '../types/index.js';
import { restoreProductInventory } from '../services/inventory.service.js';

export const getAllOrders = async (req: AuthRequest, res: Response): Promise<void> => {
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
      sortOrder = 'desc',
    } = req.query;

    const parsedPage = Math.max(Number(page) || 1, 1);
    const parsedLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

    const matchFilters: any = {};

    if (status) {
      matchFilters.status = status;
    }

    if (paymentStatus) {
      matchFilters.paymentStatus = paymentStatus;
    }

    if (dateFrom || dateTo) {
      matchFilters.createdAt = {};
      if (dateFrom) {
        matchFilters.createdAt.$gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        matchFilters.createdAt.$lte = new Date(dateTo as string);
      }
    }

    const sortStage: any = {
      [sortBy as string]: sortOrder === 'desc' ? -1 : 1,
      _id: -1,
    };

    const basePipeline: any[] = [];

    if (Object.keys(matchFilters).length > 0) {
      basePipeline.push({ $match: matchFilters });
    }

    basePipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userInfo',
          pipeline: [
            {
              $project: {
                _id: 1,
                name: 1,
                email: 1,
                phone: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: '$userInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          userInfo: {
            $cond: [
              { $ifNull: ['$userInfo', false] },
              '$userInfo',
              {
                name: { $ifNull: ['$guestInfo.name', 'Guest'] },
                email: '$guestInfo.email',
                phone: '$guestInfo.phone',
              },
            ],
          },
          orderIdStr: { $toString: '$_id' },
        },
      }
    );

    if (search) {
      const searchRegex = new RegExp(search as string, 'i');
      basePipeline.push({
        $match: {
          $or: [
            { orderIdStr: searchRegex },
            { 'userInfo.name': searchRegex },
            { 'userInfo.email': searchRegex },
            { 'userInfo.phone': searchRegex },
            { 'shippingAddress.name': searchRegex },
            { 'shippingAddress.phone': searchRegex },
          ],
        },
      });
    }

    const ordersPipeline = [
      ...basePipeline,
      { $sort: sortStage },
      { $skip: (parsedPage - 1) * parsedLimit },
      { $limit: parsedLimit },
      { $project: { orderIdStr: 0 } },
    ];

    const countPipeline = [...basePipeline, { $count: 'total' }];

    const [orders, countResult] = await Promise.all([
      Order.aggregate(ordersPipeline),
      Order.aggregate(countPipeline),
    ]);
    const total = countResult[0]?.total || 0;
    const totalPages = Math.max(Math.ceil(total / parsedLimit), 1);
    const hasNextPage = parsedPage < totalPages;
    const hasPrevPage = parsedPage > 1;

    logPerformance('getAllOrders', Date.now() - startTime, {
      total,
      page: parsedPage,
      limit: parsedLimit,
    });

    res.status(200).json({
      success: true,
      orders,
      pagination: {
        currentPage: parsedPage,
        totalPages,
        totalOrders: total,
        hasNextPage,
        hasPrevPage,
        limit: parsedLimit,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message,
    });
  }
};

export const getOrderStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { period = '30' } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period as string));

    const [
      totalOrders,
      totalRevenue,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      recentOrders,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.aggregate([
        { $match: { paymentStatus: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalPrice' } } },
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
        .select('_id user totalPrice status createdAt'),
    ]);

    const periodRevenue = await Order.aggregate([
      { $match: { createdAt: { $gte: daysAgo }, paymentStatus: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } },
    ]);

    const dailySales = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: daysAgo },
          paymentStatus: 'completed',
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          totalSales: { $sum: '$totalPrice' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
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
          cancelled: cancelledOrders,
        },
        recentOrders,
        dailySales,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching order stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order statistics',
      error: error.message,
    });
  }
};

export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const startTime = Date.now();
  const { id } = req.params;
  const { status, notes } = req.body;

  try {
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Invalid status. Valid statuses are: ' + validStatuses.join(', '),
      });
      return;
    }

    const order = await Order.findById(id).populate('user', 'name email phone');

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    const oldStatus = (order as any).status;
    (order as any).status = status;

    if (status === 'delivered') {
      (order as any).isDelivered = true;
      (order as any).deliveredAt = new Date();
    }

    if (status === 'cancelled' && oldStatus !== 'cancelled') {
      for (const item of (order as any).orderItems) {
        await restoreProductInventory({
          productId: item.product,
          quantity: item.quantity,
          variantSnapshot: item.variant,
        });
      }
    }

    await order.save();

    logBusiness('order_status_updated', {
      orderId: id,
      oldStatus,
      newStatus: status,
      userId: req.user?._id?.toString() || 'unknown',
      notes,
    });

    logPerformance('updateOrderStatus', Date.now() - startTime);

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      order: {
        _id: (order as any)._id,
        status: (order as any).status,
        isDelivered: (order as any).isDelivered,
        deliveredAt: (order as any).deliveredAt,
      },
    });
  } catch (error: any) {
    logger.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message,
    });
  }
};

export const updatePaymentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const startTime = Date.now();
  const { id } = req.params;
  const { paymentStatus, transactionId, notes } = req.body;

  try {
    const validPaymentStatuses = ['pending', 'completed', 'failed', 'cancelled'];

    if (!validPaymentStatuses.includes(paymentStatus)) {
      res.status(400).json({
        success: false,
        message: 'Invalid payment status. Valid statuses are: ' + validPaymentStatuses.join(', '),
      });
      return;
    }

    const order = await Order.findById(id);

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    const oldPaymentStatus = (order as any).paymentStatus;
    (order as any).paymentStatus = paymentStatus;

    if (paymentStatus === 'completed') {
      (order as any).isPaid = true;
      (order as any).paidAt = new Date();
      if (transactionId) {
        (order as any).transactionId = transactionId;
      }
    } else if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
      (order as any).isPaid = false;
      (order as any).paidAt = null;
    }

    await order.save();

    logBusiness('order_payment_updated', {
      orderId: id,
      oldPaymentStatus,
      newPaymentStatus: paymentStatus,
      userId: req.user?._id?.toString() || 'unknown',
      transactionId,
      notes,
    });

    logPerformance('updatePaymentStatus', Date.now() - startTime);

    res.status(200).json({
      success: true,
      message: 'Payment status updated successfully',
      order: {
        _id: (order as any)._id,
        paymentStatus: (order as any).paymentStatus,
        isPaid: (order as any).isPaid,
        paidAt: (order as any).paidAt,
        transactionId: (order as any).transactionId,
      },
    });
  } catch (error: any) {
    logger.error('Error updating payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment status',
      error: error.message,
    });
  }
};

export const getOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id)
      .populate('user', 'name email phone addresses')
      .populate('orderItems.product', 'name image sku');

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error: any) {
    logger.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details',
      error: error.message,
    });
  }
};

export const deleteOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    if (!['pending', 'cancelled'].includes((order as any).status)) {
      res.status(400).json({
        success: false,
        message: 'Only pending or cancelled orders can be deleted',
      });
      return;
    }

    if ((order as any).status !== 'cancelled') {
      for (const item of (order as any).orderItems) {
        await restoreProductInventory({
          productId: item.product,
          quantity: item.quantity,
          variantSnapshot: item.variant,
        });
      }
    }

    await Order.findByIdAndDelete(id);

    logBusiness('order_deleted', {
      orderId: id,
      userId: req.user?._id?.toString() || 'unknown',
      orderStatus: (order as any).status,
    });

    res.status(200).json({
      success: true,
      message: 'Order deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete order',
      error: error.message,
    });
  }
};

