import express from 'express';
const router = express.Router();
import { createOrder, getAllOrders } from '../controllers/order.controller.js';
import { authenticate, authorizeAdmin } from '../middlewares/auth.js';

router.route('/').get(authenticate, authorizeAdmin, getAllOrders);
router.route('/create').post(authenticate, createOrder);

export default router;