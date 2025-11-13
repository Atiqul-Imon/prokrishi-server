import { Response } from 'express';
import mongoose from 'mongoose';
import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import cacheService from '../services/cache.js';
import logger, { logBusiness, logPerformance } from '../services/logger.js';
import { AuthRequest, IOrder } from '../types/index.js';

export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  const startTime = Date.now();
  const {
    orderItems,
    shippingAddress,
    paymentMethod = 'Cash on Delivery',
    totalPrice,
    guestInfo,
  } = req.body;

  if (!orderItems || orderItems.length === 0) {
    res.status(400).json({
      success: false,
      message: 'No order items provided',
    });
    return;
  }

  if (!shippingAddress) {
    res.status(400).json({
      success: false,
      message: 'Shipping address is required',
    });
    return;
  }

  if (!shippingAddress.address || shippingAddress.address.trim().length < 2) {
    res.status(400).json({
      success: false,
      message: 'Address must be at least 2 characters',
    });
    return;
  }

  if (totalPrice === undefined || totalPrice === null || isNaN(totalPrice) || totalPrice <= 0) {
    res.status(400).json({
      success: false,
      message: 'Invalid total price',
    });
    return;
  }

  const isGuestOrder = !req.user;

  if (isGuestOrder) {
    if (!guestInfo || !guestInfo.name || !guestInfo.phone) {
      res.status(400).json({
        success: false,
        message: 'Guest information (name and phone) is required',
      });
      return;
    }
  }

  try {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const validatedItems: any[] = [];
        let calculatedTotal = 0;
        const productUpdates: Array<{
          productId: any;
          quantity: number;
          originalStock: number;
        }> = [];

        for (const item of orderItems) {
          const product = await Product.findById(item.product).session(session);
          if (!product) {
            throw new Error(`Product not found: ${item.name}`);
          }

          if ((product as any).stock < item.quantity) {
            throw new Error(`Insufficient stock for ${item.name}. Available: ${(product as any).stock}`);
          }

          if ((product as any).status !== 'active') {
            throw new Error(`Product ${item.name} is not available`);
          }

          const updatedProduct = await Product.findByIdAndUpdate(
            item.product,
            {
              $inc: {
                stock: -item.quantity,
                sold: item.quantity,
              },
            },
            {
              new: true,
              session,
              runValidators: true,
            }
          );

          if ((updatedProduct as any)?.stock < 0) {
            throw new Error(`Stock would go negative for ${item.name}. Available: ${(product as any).stock}`);
          }

          const itemTotal = item.price * item.quantity;
          calculatedTotal += itemTotal;

          validatedItems.push({
            product: (product as any)._id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          });

          productUpdates.push({
            productId: (product as any)._id,
            quantity: item.quantity,
            originalStock: (product as any).stock,
          });
        }

        if (Math.abs(calculatedTotal - totalPrice) > 0.01) {
          throw new Error('Price mismatch detected');
        }

        const orderData: any = {
          orderItems: validatedItems,
          shippingAddress,
          paymentMethod,
          totalPrice: calculatedTotal,
          totalAmount: calculatedTotal,
          status: 'pending',
          paymentStatus: 'pending',
          isGuestOrder: isGuestOrder,
        };

        if (isGuestOrder) {
          if (!guestInfo || !guestInfo.name || !guestInfo.phone) {
            throw new Error('Guest information (name and phone) is required');
          }
          orderData.guestInfo = {
            name: guestInfo.name,
            email: guestInfo.email || '',
            phone: guestInfo.phone,
          };
        } else {
          if (!req.user || !req.user._id) {
            throw new Error('User authentication required for logged-in orders');
          }
          orderData.user = req.user._id;
        }

        const order = new Order(orderData);
        const createdOrder = await order.save({ session });

        req.createdOrder = createdOrder as IOrder;
        req.productUpdates = productUpdates;
        req.calculatedTotal = calculatedTotal;
      });

      const createdOrder = req.createdOrder!;

      const populatedOrder = await Order.findById(createdOrder._id)
        .populate('user', 'name email phone')
        .populate('orderItems.product', 'name image sku');

      if ((populatedOrder as any)?.user) {
        (populatedOrder as any).userInfo = {
          name: (populatedOrder as any).user.name,
          email: (populatedOrder as any).user.email,
          phone: (populatedOrder as any).user.phone,
        };
      } else if ((populatedOrder as any)?.guestInfo) {
        (populatedOrder as any).userInfo = {
          name: (populatedOrder as any).guestInfo.name,
          email: (populatedOrder as any).guestInfo.email,
          phone: (populatedOrder as any).guestInfo.phone,
        };
      }

      logBusiness('ORDER_CREATED', {
        orderId: createdOrder._id,
        userId: isGuestOrder ? 'guest' : req.user!._id.toString(),
        isGuestOrder: isGuestOrder,
        itemCount: orderItems.length,
        totalAmount: req.calculatedTotal || (populatedOrder as any).totalPrice,
        paymentMethod: paymentMethod,
        stockReserved: true,
      });

      for (const update of req.productUpdates || []) {
        await cacheService.del(`product:${update.productId}`);
      }
      if (!isGuestOrder && req.user?._id) {
        await cacheService.delPattern(`user:${req.user._id}:orders:*`);
      }

      logPerformance('createOrder', Date.now() - startTime, {
        itemCount: orderItems.length,
        totalAmount: req.calculatedTotal || (populatedOrder as any).totalPrice,
        transactionUsed: true,
      });

      res.status(201).json({
        success: true,
        message: 'Order created successfully with stock reserved',
        order: populatedOrder,
      });
    } catch (transactionError: any) {
      logger.error('Order creation transaction failed:', transactionError);

      if (transactionError.message?.includes('Insufficient stock')) {
        res.status(400).json({
          success: false,
          message: transactionError.message,
        });
        return;
      }

      if (transactionError.message?.includes('Product not found')) {
        res.status(404).json({
          success: false,
          message: transactionError.message,
        });
        return;
      }

      if (transactionError.message?.includes('not available')) {
        res.status(400).json({
          success: false,
          message: transactionError.message,
        });
        return;
      }

      if (transactionError.message?.includes('Price mismatch')) {
        res.status(400).json({
          success: false,
          message: transactionError.message,
        });
        return;
      }

      throw transactionError;
    } finally {
      await session.endSession();
    }
  } catch (error: any) {
    logger.error('Create order error:', error);
    logger.error('Error stack:', error.stack);
    logger.error('Request body:', JSON.stringify(req.body, null, 2));
    logger.error('User:', req.user ? req.user._id : 'guest');

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getAllOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  const startTime = Date.now();
  const {
    page = 1,
    limit = 20,
    status,
    paymentStatus,
    sort = 'createdAt',
    order = 'desc',
    search,
  } = req.query;

  try {
    const query: any = {};
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (search) {
      query.$or = [
        { 'orderItems.name': { $regex: search, $options: 'i' } },
        { 'shippingAddress.district': { $regex: search, $options: 'i' } },
      ];
    }

    const sortObj: any = {};
    sortObj[sort as string] = order === 'desc' ? -1 : 1;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const totalOrders = await Order.countDocuments(query);

    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('orderItems.product', 'name image sku')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit as string));

    const ordersWithUserInfo = orders.map((order) => {
      const orderObj = (order as any).toObject ? (order as any).toObject() : order;
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
        currentPage: parseInt(page as string),
        totalPages: Math.ceil(totalOrders / parseInt(limit as string)),
        totalOrders,
        hasNext: skip + orders.length < totalOrders,
        hasPrev: parseInt(page as string) > 1,
      },
    };

    logPerformance('getAllOrders', Date.now() - startTime, {
      source: 'database',
      count: orders.length,
    });

    res.json(result);
  } catch (error: any) {
    logger.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getUserOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  const startTime = Date.now();
  const { page = 1, limit = 10, status } = req.query;

  try {
    if (!req.user?._id) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const cacheKey = cacheService.generateKey(
      'user',
      req.user._id.toString(),
      'orders',
      `page:${page}`,
      `limit:${limit}`,
      `status:${status || 'all'}`
    );

    const cachedOrders = await cacheService.get(cacheKey);
    if (cachedOrders) {
      logPerformance('getUserOrders', Date.now() - startTime, { source: 'cache' });
      res.json(cachedOrders);
      return;
    }

    const query: any = { user: req.user._id };
    if (status) query.status = status;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const totalOrders = await Order.countDocuments(query);

    const orders = await Order.find(query)
      .populate('orderItems.product', 'name image sku')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string));

    const result = {
      orders,
      pagination: {
        currentPage: parseInt(page as string),
        totalPages: Math.ceil(totalOrders / parseInt(limit as string)),
        totalOrders,
        hasNext: skip + orders.length < totalOrders,
        hasPrev: parseInt(page as string) > 1,
      },
    };

    logPerformance('getUserOrders', Date.now() - startTime, {
      source: 'database',
      count: orders.length,
    });

    res.json(result);
  } catch (error: any) {
    logger.error('Get user orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
  const startTime = Date.now();

  try {
    if (!req.user?._id) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const cacheKey = cacheService.generateKey('order', req.params.id);

    const cachedOrder = await cacheService.get(cacheKey);
    if (cachedOrder) {
      logPerformance('getOrderById', Date.now() - startTime, { source: 'cache' });
      res.json({ success: true, order: cachedOrder });
      return;
    }

    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone addresses')
      .populate('orderItems.product', 'name image sku description');

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    if (
      (order as any).user?._id?.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin' &&
      req.user.role !== 'super_admin'
    ) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    await cacheService.set(cacheKey, order, 600);

    logPerformance('getOrderById', Date.now() - startTime, { source: 'database' });

    res.json({
      success: true,
      order,
    });
  } catch (error: any) {
    logger.error('Get order by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

  if (!validStatuses.includes(status)) {
    res.status(400).json({
      success: false,
      message: 'Invalid status',
    });
    return;
  }

  try {
    const order = await Order.findById(req.params.id);
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

    await order.save();

    await cacheService.delPattern('orders:*');
    await cacheService.delPattern(`user:${(order as any).user}:orders:*`);
    await cacheService.del(`order:${req.params.id}`);

    logBusiness('ORDER_STATUS_UPDATED', {
      orderId: (order as any)._id,
      oldStatus,
      newStatus: status,
      updatedBy: req.user?._id?.toString() || 'unknown',
    });

    logger.info(`Order status updated: ${req.params.id} - ${oldStatus} → ${status}`);

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order,
    });
  } catch (error: any) {
    logger.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const cancelOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?._id) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    if ((order as any).user?.toString() !== req.user._id.toString()) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    if (['shipped', 'delivered', 'cancelled'].includes((order as any).status)) {
      res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage',
      });
      return;
    }

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        (order as any).status = 'cancelled';
        (order as any).paymentStatus = 'cancelled';
        await order.save({ session });

        for (const item of (order as any).orderItems) {
          await Product.findByIdAndUpdate(
            item.product,
            {
              $inc: {
                stock: item.quantity,
                sold: -item.quantity,
              },
            },
            { session }
          );
        }
      });

      for (const item of (order as any).orderItems) {
        await cacheService.del(`product:${item.product}`);
      }
      await cacheService.delPattern('orders:*');
      await cacheService.delPattern(`user:${req.user._id}:orders:*`);
      await cacheService.del(`order:${req.params.id}`);

      logBusiness('ORDER_CANCELLED', {
        orderId: (order as any)._id,
        userId: req.user._id.toString(),
        amount: (order as any).totalAmount,
        stockRestored: true,
      });

      logger.info(`Order cancelled: ${req.params.id} by user ${req.user._id} - Stock restored`);

      res.json({
        success: true,
        message: 'Order cancelled successfully and stock restored',
        order,
      });
    } catch (transactionError: any) {
      logger.error('Order cancellation transaction failed:', transactionError);
      throw transactionError;
    } finally {
      await session.endSession();
    }
  } catch (error: any) {
    logger.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getOrderStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
          confirmedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] },
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
          },
          codOrders: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'Cash on Delivery'] }, 1, 0] },
          },
        },
      },
    ]);

    const result = stats[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      pendingOrders: 0,
      confirmedOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
      codOrders: 0,
    };

    res.json({
      success: true,
      stats: result,
    });
  } catch (error: any) {
    logger.error('Get order stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

