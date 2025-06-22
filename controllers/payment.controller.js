import Order from '../models/order.model.js';

// Mock payment system for testing
// This simulates SSL Commerz behavior without requiring real credentials

// Create payment session (mock)
export const createPaymentSession = async (req, res) => {
  try {
    const { orderId, paymentMethod } = req.body;
    const userId = req.user.id;

    // Find the order
    const order = await Order.findOne({ _id: orderId, user: userId }).populate('user');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'Order is not in pending status' });
    }

    // Generate unique transaction ID
    const tran_id = `MOCK_TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Update order with transaction ID
    await Order.findByIdAndUpdate(orderId, {
      transactionId: tran_id,
      paymentMethod: paymentMethod,
      paymentStatus: 'pending'
    });

    // For mock system, we'll redirect to a mock payment page
    const mockPaymentUrl = `${process.env.FRONTEND_URL}/mock-payment?tran_id=${tran_id}&amount=${order.totalAmount}&orderId=${orderId}`;

    res.json({
      success: true,
      paymentUrl: mockPaymentUrl,
      transactionId: tran_id,
      isMock: true // Flag to indicate this is a mock payment
    });
  } catch (error) {
    console.error('Payment session error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Mock payment success (simulates SSL Commerz success callback)
export const mockPaymentSuccess = async (req, res) => {
  try {
    const { tran_id, orderId } = req.body;

    // Find order by transaction ID
    const order = await Order.findOne({ transactionId: tran_id });
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Simulate payment verification delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update order status (simulating successful payment)
    await Order.findByIdAndUpdate(order._id, {
      status: 'confirmed',
      paymentStatus: 'completed',
      paymentDetails: {
        transactionId: tran_id,
        validationId: `MOCK_VAL_${Date.now()}`,
        amount: order.totalAmount,
        currency: 'BDT',
        paymentDate: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Payment successful (Mock)',
      orderId: order._id,
      transactionId: tran_id
    });
  } catch (error) {
    console.error('Mock payment success error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Mock payment failure (simulates SSL Commerz failure callback)
export const mockPaymentFail = async (req, res) => {
  try {
    const { tran_id, orderId, error = 'Payment failed' } = req.body;

    // Find order by transaction ID
    const order = await Order.findOne({ transactionId: tran_id });
    
    if (order) {
      // Update order status
      await Order.findByIdAndUpdate(order._id, {
        status: 'cancelled',
        paymentStatus: 'failed',
        paymentDetails: {
          transactionId: tran_id,
          error: error,
          failedDate: new Date()
        }
      });
    }

    res.json({
      success: false,
      message: 'Payment failed (Mock)',
      error: error
    });
  } catch (error) {
    console.error('Mock payment fail error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Payment success callback (for real SSL Commerz - kept for future use)
export const paymentSuccess = async (req, res) => {
  try {
    const { tran_id, val_id, amount, store_amount, currency, status } = req.body;

    // For now, just log the data (will be implemented when real SSL Commerz is available)
    console.log('Real SSL Commerz success callback:', { tran_id, val_id, amount, currency, status });

    // Find order by transaction ID
    const order = await Order.findOne({ transactionId: tran_id });
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Update order status
    await Order.findByIdAndUpdate(order._id, {
      status: 'confirmed',
      paymentStatus: 'completed',
      paymentDetails: {
        transactionId: tran_id,
        validationId: val_id,
        amount: amount,
        currency: currency,
        paymentDate: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Payment successful',
      orderId: order._id
    });
  } catch (error) {
    console.error('Payment success error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Payment failure callback (for real SSL Commerz - kept for future use)
export const paymentFail = async (req, res) => {
  try {
    const { tran_id, error } = req.body;

    console.log('Real SSL Commerz failure callback:', { tran_id, error });

    // Find order by transaction ID
    const order = await Order.findOne({ transactionId: tran_id });
    
    if (order) {
      // Update order status
      await Order.findByIdAndUpdate(order._id, {
        status: 'cancelled',
        paymentStatus: 'failed',
        paymentDetails: {
          transactionId: tran_id,
          error: error,
          failedDate: new Date()
        }
      });
    }

    res.json({
      success: false,
      message: 'Payment failed',
      error: error
    });
  } catch (error) {
    console.error('Payment fail error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Payment cancel callback (for real SSL Commerz - kept for future use)
export const paymentCancel = async (req, res) => {
  try {
    const { tran_id } = req.body;

    console.log('Real SSL Commerz cancel callback:', { tran_id });

    // Find order by transaction ID
    const order = await Order.findOne({ transactionId: tran_id });
    
    if (order) {
      // Update order status
      await Order.findByIdAndUpdate(order._id, {
        status: 'cancelled',
        paymentStatus: 'cancelled',
        paymentDetails: {
          transactionId: tran_id,
          cancelledDate: new Date()
        }
      });
    }

    res.json({
      success: false,
      message: 'Payment cancelled'
    });
  } catch (error) {
    console.error('Payment cancel error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// IPN (Instant Payment Notification) handler (for real SSL Commerz - kept for future use)
export const paymentIPN = async (req, res) => {
  try {
    const { tran_id, val_id, amount, store_amount, currency, status } = req.body;

    console.log('Real SSL Commerz IPN:', { tran_id, val_id, amount, currency, status });

    // Find and update order
    const order = await Order.findOne({ transactionId: tran_id });
    
    if (order) {
      await Order.findByIdAndUpdate(order._id, {
        status: 'confirmed',
        paymentStatus: 'completed',
        paymentDetails: {
          transactionId: tran_id,
          validationId: val_id,
          amount: amount,
          currency: currency,
          paymentDate: new Date()
        }
      });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('IPN error:', error);
    res.status(500).send('ERROR');
  }
};

// Get payment status
export const getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({ _id: orderId, user: userId });
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({
      success: true,
      order: {
        id: order._id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        transactionId: order.transactionId,
        paymentMethod: order.paymentMethod,
        paymentDetails: order.paymentDetails
      }
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}; 