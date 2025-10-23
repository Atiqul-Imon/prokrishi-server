import { Router } from "express";
import {
  getAllOrders,
  getOrderStats,
  updateOrderStatus,
  updatePaymentStatus,
  getOrderById,
  deleteOrder
} from "../controllers/adminOrder.controller.js";
import { authenticate, authorizeAdmin } from "../middlewares/auth.js";

const router = Router();

// All routes require authentication and admin authorization
router.use(authenticate);
router.use(authorizeAdmin);

// Get all orders with pagination and filtering
router.get("/", getAllOrders);

// Get order statistics
router.get("/stats", getOrderStats);

// Get single order details
router.get("/:id", getOrderById);

// Update order status
router.put("/:id/status", updateOrderStatus);

// Update payment status
router.put("/:id/payment", updatePaymentStatus);

// Delete order
router.delete("/:id", deleteOrder);

export default router;
