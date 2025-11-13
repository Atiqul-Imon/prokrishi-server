import { Response } from 'express';
import mongoose from 'mongoose';
import Order from '../models/order.model.js';
import cacheService from '../services/cache.js';
import logger, { logBusiness } from '../services/logger.js';
import { AuthRequest } from '../types/index.js';

export const processCODPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?._id) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { orderId } = req.body;
    const userId = req.user._id;

    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate('user')
      .populate('orderItems.product');

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    if ((order as any).status !== 'pending') {
      res.status(400).json({
        success: false,
        message: 'Order is not in pending status',
      });
      return;
    }

    const codTransactionId = `COD_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        transactionId: codTransactionId,
        paymentMethod: 'Cash on Delivery',
        paymentStatus: 'pending',
        status: 'confirmed',
        paymentDetails: {
          transactionId: codTransactionId,
          amount: (order as any).totalAmount,
          currency: 'BDT',
          paymentDate: new Date(),
          method: 'COD',
        },
      },
      { new: true }
    ).populate('user orderItems.product');

    logBusiness('COD_ORDER_CONFIRMED', {
      orderId: (order as any)._id,
      userId: userId.toString(),
      amount: (order as any).totalAmount,
      transactionId: codTransactionId,
    });

    logger.info(`COD order confirmed: ${orderId} - Amount: ৳${(order as any).totalAmount}`);

    res.json({
      success: true,
      message: 'Order confirmed for Cash on Delivery',
      order: updatedOrder,
      transactionId: codTransactionId,
      paymentMethod: 'Cash on Delivery',
      status: 'confirmed',
    });
  } catch (error: any) {
    logger.error('COD payment processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const confirmCODPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?._id) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { orderId, transactionId } = req.body;
    const userId = req.user._id;

    const order = await Order.findOne({
      _id: orderId,
      user: userId,
      transactionId: transactionId,
    });

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found or transaction ID mismatch',
      });
      return;
    }

    if ((order as any).paymentStatus === 'completed') {
      res.status(400).json({
        success: false,
        message: 'Payment already confirmed',
      });
      return;
    }

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const updatedOrder = await Order.findByIdAndUpdate(
          orderId,
          {
            paymentStatus: 'completed',
            isPaid: true,
            paidAt: new Date(),
            'paymentDetails.paymentDate': new Date(),
          },
          { new: true, session }
        ).populate('user orderItems.product');

        logger.info(`Payment confirmed for order ${orderId} - stock already reserved during order creation`);
        (req as any).updatedOrder = updatedOrder;
      });

      const updatedOrder = (req as any).updatedOrder;

      await cacheService.del(`order:${orderId}`);
      await cacheService.delPattern(`user:${userId}:orders:*`);

      for (const item of (order as any).orderItems) {
        await cacheService.del(`product:${(item.product as any)._id}`);
      }

      logBusiness('COD_PAYMENT_CONFIRMED', {
        orderId: (order as any)._id,
        userId: userId.toString(),
        amount: (order as any).totalAmount,
        transactionId: transactionId,
        stockAlreadyReserved: true,
      });

      logger.info(`COD payment confirmed: ${orderId} - Amount: ৳${(order as any).totalAmount} - Stock already reserved during order creation`);

      res.json({
        success: true,
        message: 'Payment confirmed successfully',
        order: updatedOrder,
      });
    } catch (transactionError: any) {
      logger.error('Payment confirmation transaction failed:', transactionError);
      throw transactionError;
    } finally {
      await session.endSession();
    }
  } catch (error: any) {
    logger.error('COD payment confirmation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getPaymentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?._id) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { orderId } = req.params;
    const userId = req.user._id;

    const order = await Order.findOne({ _id: orderId, user: userId })
      .select('transactionId paymentStatus paymentMethod totalAmount status isPaid paidAt')
      .lean();

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    res.json({
      success: true,
      payment: {
        orderId: (order as any)._id,
        transactionId: (order as any).transactionId,
        paymentMethod: (order as any).paymentMethod,
        paymentStatus: (order as any).paymentStatus,
        amount: (order as any).totalAmount,
        isPaid: (order as any).isPaid,
        paidAt: (order as any).paidAt,
        status: (order as any).status,
      },
    });
  } catch (error: any) {
    logger.error('Get payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getCODPaymentInstructions = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const instructions = {
      method: 'Cash on Delivery',
      description: 'Pay when your order is delivered',
      instructions: [
        'Your order will be prepared and dispatched within 24 hours',
        'Our delivery person will contact you before delivery',
        'Please have the exact amount ready for payment',
        'You can pay in cash when the order is delivered',
        'No advance payment required',
      ],
      deliveryTime: '1-3 business days',
      contactInfo: {
        phone: '+880 1234-567890',
        email: 'support@prokrishi.com',
      },
      terms: [
        'COD is available for orders above ৳200',
        'Delivery charges may apply based on location',
        'Please verify the order before payment',
        'Returns accepted within 24 hours of delivery',
      ],
    };

    res.json({
      success: true,
      codInstructions: instructions,
    });
  } catch (error: any) {
    logger.error('Get COD instructions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const createPaymentSession = processCODPayment;
export const paymentSuccess = confirmCODPayment;
export const paymentFail = (_req: AuthRequest, res: Response): void => {
  res.status(400).json({
    success: false,
    message: 'Payment failed - COD orders cannot fail',
  });
};

