import asyncHandler from "express-async-handler";
import User from "../models/user.model.js";
import Product from "../models/product.model.js";
import Order from "../models/order.model.js";

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private/Admin
export const getDashboardStats = asyncHandler(async (req, res) => {
  // Get total users
  const totalUsers = await User.countDocuments();

  // Get total products
  const totalProducts = await Product.countDocuments();

  // Get total orders and revenue
  const orders = await Order.find({});
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce(
    (sum, order) => sum + (order.totalPrice || 0),
    0,
  );

  // Get recent orders (last 5)
  const recentOrders = await Order.find({})
    .populate("user", "name email")
    .sort({ createdAt: -1 })
    .limit(5);

  // Get low stock products (less than 10 items)
  const lowStockProducts = await Product.find({ stock: { $lt: 10 } })
    .select("name stock")
    .limit(5);

  res.json({
    success: true,
    stats: {
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
    },
    recentOrders,
    lowStockProducts,
  });
}); 