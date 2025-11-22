import express from 'express';
import {
  getAllFishOrders,
  getFishOrderById,
  createFishOrder,
  updateFishOrderStatus,
  deleteFishOrder,
  getFishOrderStats,
} from '../controllers/fishOrder.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.js';

const router = express.Router();

// Public route for creating orders (can be guest or authenticated)
router.post('/', createFishOrder);

// Protected admin routes
router.get('/', authenticate, authorizeAdmin, getAllFishOrders);
router.get('/stats', authenticate, authorizeAdmin, getFishOrderStats);
router.get('/:id', authenticate, authorizeAdmin, getFishOrderById);
router.put('/:id', authenticate, authorizeAdmin, updateFishOrderStatus);
router.delete('/:id', authenticate, authorizeAdmin, deleteFishOrder);

export default router;

