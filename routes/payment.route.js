import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import {
  processCODPayment,
  confirmCODPayment,
  getPaymentStatus,
  getCODPaymentInstructions,
  createPaymentSession,
  paymentSuccess,
  paymentFail
} from '../controllers/payment.controller.js';

const router = express.Router();

// COD Payment routes
router.post('/cod/process', authenticate, processCODPayment);
router.post('/cod/confirm', authenticate, confirmCODPayment);
router.get('/cod/instructions', getCODPaymentInstructions);

// Payment status and legacy routes
router.get('/status/:orderId', authenticate, getPaymentStatus);
router.post('/create-session', authenticate, createPaymentSession);
router.post('/success', paymentSuccess);
router.post('/fail', paymentFail);

export default router;