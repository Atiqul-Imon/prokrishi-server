import express, { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import {
  processCODPayment,
  confirmCODPayment,
  getPaymentStatus,
  getCODPaymentInstructions,
  createPaymentSession,
  paymentSuccess,
  paymentFail,
} from '../controllers/payment.controller.js';

const router: Router = express.Router();

router.post('/cod/process', authenticate, processCODPayment);
router.post('/cod/confirm', authenticate, confirmCODPayment);
router.get('/cod/instructions', getCODPaymentInstructions);
router.get('/status/:orderId', authenticate, getPaymentStatus);
router.post('/create-session', authenticate, createPaymentSession);
router.post('/success', paymentSuccess);
router.post('/fail', paymentFail);

export default router;

