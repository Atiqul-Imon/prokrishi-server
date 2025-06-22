import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import {
  createPaymentSession,
  mockPaymentSuccess,
  mockPaymentFail,
  paymentSuccess,
  paymentFail,
  paymentCancel,
  paymentIPN,
  getPaymentStatus
} from '../controllers/payment.controller.js';

const router = express.Router();

// Protected routes (require authentication)
router.post('/create-session', authenticate, createPaymentSession);
router.get('/status/:orderId', authenticate, getPaymentStatus);

// Mock payment routes (for testing)
router.post('/mock/success', mockPaymentSuccess);
router.post('/mock/fail', mockPaymentFail);

// Real SSL Commerz routes (for future use)
router.post('/success', paymentSuccess);
router.post('/fail', paymentFail);
router.post('/cancel', paymentCancel);
router.post('/ipn', paymentIPN);

export default router;