import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import User from '../models/user.model.js';
import logger, { logBusiness } from '../services/logger.js';

// COD Payment System - Simplified for agricultural e-commerce

// Process COD payment (immediate confirmation)
export const processCODPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.user.id;

    // Find the order
    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate('user')
      .populate('orderItems.product');

    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ 
        success: false,
        message: 'Order is not in pending status' 
      });
    }

    // Generate COD transaction ID
    const codTransactionId = `COD_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Update order status for COD
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        transactionId: codTransactionId,
        paymentMethod: 'Cash on Delivery',
        paymentStatus: 'pending', // Will be confirmed when delivered
        status: 'confirmed', // COD orders are immediately confirmed
        paymentDetails: {
          transactionId: codTransactionId,
          amount: order.totalAmount,
          currency: 'BDT',
          paymentDate: new Date(),
          method: 'COD'
        }
      },
      { new: true }
    ).populate('user orderItems.product');

    // Log business event
    logBusiness('COD_ORDER_CONFIRMED', {
      orderId: order._id,
      userId: userId,
      amount: order.totalAmount,
      transactionId: codTransactionId
    });

    logger.info(`COD order confirmed: ${orderId} - Amount: ৳${order.totalAmount}`);

    res.json({
      success: true,
      message: 'Order confirmed for Cash on Delivery',
      order: updatedOrder,
      transactionId: codTransactionId,
      paymentMethod: 'Cash on Delivery',
      status: 'confirmed'
    });

  } catch (error) {
    logger.error('COD payment processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Confirm COD payment (when customer pays on delivery)
export const confirmCODPayment = async (req, res) => {
  try {
    const { orderId, transactionId } = req.body;
    const userId = req.user.id;

    // Find the order
    const order = await Order.findOne({ 
      _id: orderId, 
      user: userId,
      transactionId: transactionId 
    });

    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Order not found or transaction ID mismatch' 
      });
    }

    if (order.paymentStatus === 'completed') {
      return res.status(400).json({ 
        success: false,
        message: 'Payment already confirmed' 
      });
    }

    // Update payment status
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        paymentStatus: 'completed',
        isPaid: true,
        paidAt: new Date(),
        'paymentDetails.paymentDate': new Date()
      },
      { new: true }
    ).populate('user orderItems.product');

    // Update product stock (reduce sold quantities)
    for (const item of order.orderItems) {
      await Product.findByIdAndUpdate(
        item.product._id,
        { 
          $inc: { 
            sold: item.quantity,
            stock: -item.quantity 
          }
        }
      );
    }

    // Log business event
    logBusiness('COD_PAYMENT_CONFIRMED', {
      orderId: order._id,
      userId: userId,
      amount: order.totalAmount,
      transactionId: transactionId
    });

    logger.info(`COD payment confirmed: ${orderId} - Amount: ৳${order.totalAmount}`);

    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      order: updatedOrder
    });

  } catch (error) {
    logger.error('COD payment confirmation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get payment status
export const getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({ _id: orderId, user: userId })
      .select('transactionId paymentStatus paymentMethod totalAmount status isPaid paidAt')
      .lean();

    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }

    res.json({
      success: true,
      payment: {
        orderId: order._id,
        transactionId: order.transactionId,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        amount: order.totalAmount,
        isPaid: order.isPaid,
        paidAt: order.paidAt,
        status: order.status
      }
    });

  } catch (error) {
    logger.error('Get payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get COD payment instructions
export const getCODPaymentInstructions = async (req, res) => {
  try {
    const instructions = {
      method: 'Cash on Delivery',
      description: 'Pay when your order is delivered',
      instructions: [
        'Your order will be prepared and dispatched within 24 hours',
        'Our delivery person will contact you before delivery',
        'Please have the exact amount ready for payment',
        'You can pay in cash when the order is delivered',
        'No advance payment required'
      ],
      deliveryTime: '1-3 business days',
      contactInfo: {
        phone: '+880 1234-567890',
        email: 'support@prokrishi.com'
      },
      terms: [
        'COD is available for orders above ৳200',
        'Delivery charges may apply based on location',
        'Please verify the order before payment',
        'Returns accepted within 24 hours of delivery'
      ]
    };

    res.json({
      success: true,
      codInstructions: instructions
    });

  } catch (error) {
    logger.error('Get COD instructions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Legacy functions for backward compatibility (simplified)
export const createPaymentSession = processCODPayment;
export const paymentSuccess = confirmCODPayment;
export const paymentFail = (req, res) => {
  res.status(400).json({
    success: false,
    message: 'Payment failed - COD orders cannot fail'
  });
};