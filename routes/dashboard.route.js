import express from "express";
import { getDashboardStats } from "../controllers/dashboard.controller.js";
import { authenticate, authorizeAdmin } from "../middlewares/auth.js";

const router = express.Router();

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private/Admin
router.get("/stats", authenticate, authorizeAdmin, getDashboardStats);

export default router; 