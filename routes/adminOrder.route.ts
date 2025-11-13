import { Router } from 'express';
import {
  getAllOrders,
  getOrderStats,
  updateOrderStatus,
  updatePaymentStatus,
  getOrderById,
  deleteOrder,
} from '../controllers/adminOrder.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.js';

const router = Router();

router.use(authenticate);
router.use(authorizeAdmin);

router.get('/', getAllOrders);
router.get('/stats', getOrderStats);
router.get('/:id', getOrderById);
router.put('/:id/status', updateOrderStatus);
router.put('/:id/payment', updatePaymentStatus);
router.delete('/:id', deleteOrder);

export default router;

