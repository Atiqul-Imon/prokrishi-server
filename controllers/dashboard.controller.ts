import { Response } from 'express';
import User from '../models/user.model.js';
import Product from '../models/product.model.js';
import Order from '../models/order.model.js';
import { AuthRequest } from '../types/index.js';

export const getDashboardStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();

    const orders = await Order.find({});
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + ((order as any).totalPrice || 0), 0);

    const recentOrders = await Order.find({})
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    const lowStockProducts = await Product.find({ stock: { $lt: 10 } })
      .select('name stock')
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard stats',
      error: error.message,
    });
  }
};

