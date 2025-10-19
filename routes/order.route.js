import express from 'express';
const router = express.Router();
import { 
  createOrder, 
  getAllOrders, 
  getUserOrders, 
  getOrderById, 
  updateOrderStatus, 
  cancelOrder,
  getOrderStats 
} from '../controllers/order.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.js';

// Order routes
router.route('/create').post(authenticate, createOrder);
router.route('/user').get(authenticate, getUserOrders);
router.route('/stats').get(authenticate, authorizeAdmin, getOrderStats);
router.route('/:id').get(authenticate, getOrderById);
router.route('/:id/status').put(authenticate, authorizeAdmin, updateOrderStatus);
router.route('/:id/cancel').put(authenticate, cancelOrder);

// Admin routes
router.route('/').get(authenticate, authorizeAdmin, getAllOrders);

export default router;