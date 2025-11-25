import { Response } from 'express';
import FishOrder from '../models/fishOrder.model.js';
import FishProduct from '../models/fishProduct.model.js';
import mongoose from 'mongoose';
import logger from '../services/logger.js';
import { AuthRequest } from '../types/index.js';
import { calculateFishShipping, getShippingZone } from '../services/shipping.service.js';

// Get all fish orders
export const getAllFishOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      search,
      sort = 'createdAt',
      order = 'desc',
    } = req.query;

    const query: any = {};

    if (status) {
      query.status = status;
    }

    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'shippingAddress.name': { $regex: search, $options: 'i' } },
        { 'shippingAddress.phone': { $regex: search, $options: 'i' } },
        { 'guestInfo.name': { $regex: search, $options: 'i' } },
        { 'guestInfo.phone': { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortField: any = {};
    sortField[sort as string] = sortOrder;

    const [orders, total] = await Promise.all([
      FishOrder.find(query)
        .populate('user', 'name email phone')
        .populate('orderItems.fishProduct', 'name image')
        .sort(sortField)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      FishOrder.countDocuments(query),
    ]);

    res.json({
      success: true,
      fishOrders: orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    logger.error('Error fetching fish orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fish orders',
      error: error.message,
    });
  }
};

// Get single fish order
export const getFishOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid fish order ID' });
      return;
    }

    const order = await FishOrder.findById(id)
      .populate('user', 'name email phone')
      .populate('orderItems.fishProduct', 'name image');

    if (!order) {
      res.status(404).json({ success: false, message: 'Fish order not found' });
      return;
    }

    res.json({
      success: true,
      fishOrder: order,
    });
  } catch (error: any) {
    logger.error('Error fetching fish order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fish order',
      error: error.message,
    });
  }
};

// Create fish order
export const createFishOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      orderItems,
      shippingAddress,
      paymentMethod = 'Cash on Delivery',
      totalPrice,
      guestInfo,
      notes,
    } = req.body;

    if (!orderItems || orderItems.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No order items provided',
      });
      return;
    }

    if (!shippingAddress || !shippingAddress.address) {
      res.status(400).json({
        success: false,
        message: 'Shipping address is required',
      });
      return;
    }

    if (totalPrice === undefined || totalPrice === null || isNaN(totalPrice) || totalPrice <= 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid total price',
      });
      return;
    }

    const isGuestOrder = !req.user;

    if (isGuestOrder) {
      if (!guestInfo || !guestInfo.name || !guestInfo.phone) {
        res.status(400).json({
          success: false,
          message: 'Guest information (name and phone) is required',
        });
        return;
      }
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    const stockUpdates: Array<{ productId: string; sizeCategoryId: string; stockDeducted: number }> = [];

    try {
      const validatedItems: any[] = [];
      let calculatedTotal = 0;

      // Validate and process each order item
      for (const item of orderItems) {
        const fishProduct = await FishProduct.findById(item.fishProduct).session(session);
        if (!fishProduct) {
          throw new Error(`Fish product not found: ${item.fishProduct}`);
        }

        const sizeCategoryIndex = (fishProduct as any).sizeCategories.findIndex(
          (cat: any) => cat._id.toString() === item.sizeCategoryId
        );
        if (sizeCategoryIndex === -1) {
          throw new Error(`Size category not found for product ${fishProduct.name}`);
        }

        const sizeCategory = (fishProduct as any).sizeCategories[sizeCategoryIndex];
        if (sizeCategory.status !== 'active') {
          throw new Error(`Size category "${sizeCategory.label}" is not active`);
        }

        const requestedWeight = Number(item.requestedWeight);
        if (isNaN(requestedWeight) || requestedWeight <= 0) {
          throw new Error(`Invalid requested weight: ${item.requestedWeight}`);
        }

        // Check stock availability (stock represents quantity, not weight)
        // For fish, we'll treat stock as available quantity (each unit can be 1kg or as specified)
        const availableStock = sizeCategory.stock || 0;
        if (availableStock < 1) {
          throw new Error(`Insufficient stock for size category "${sizeCategory.label}"`);
        }

        const pricePerKg = sizeCategory.pricePerKg;
        const itemTotal = requestedWeight * pricePerKg;
        calculatedTotal += itemTotal;

        // Deduct stock (treating each stock unit as 1 orderable unit)
        const stockToDeduct = Math.ceil(requestedWeight); // Round up to nearest whole unit
        if (availableStock < stockToDeduct) {
          throw new Error(
            `Insufficient stock. Requested: ${stockToDeduct} units, Available: ${availableStock} units`
          );
        }

        // Update stock in the product
        (fishProduct as any).sizeCategories[sizeCategoryIndex].stock = availableStock - stockToDeduct;
        stockUpdates.push({
          productId: fishProduct._id.toString(),
          sizeCategoryId: item.sizeCategoryId,
          stockDeducted: stockToDeduct,
        });

        await fishProduct.save({ session });

        validatedItems.push({
          fishProduct: fishProduct._id,
          fishProductName: (fishProduct as any).name,
          sizeCategoryId: sizeCategory._id,
          sizeCategoryLabel: sizeCategory.label,
          requestedWeight,
          actualWeight: requestedWeight, // For fish, requested weight is actual weight
          pricePerKg,
          totalPrice: itemTotal,
          stockDeducted: stockToDeduct,
          notes: item.notes,
        });
      }

      // Verify total price matches
      if (Math.abs(calculatedTotal - totalPrice) > 0.01) {
        throw new Error('Price mismatch detected');
      }

      const zone = getShippingZone(shippingAddress);
      const shippingResult = calculateFishShipping(zone);
      const grandTotal = calculatedTotal + shippingResult.shippingFee;

      // Create the order
      const fishOrder = new FishOrder({
        user: req.user?._id,
        guestInfo: isGuestOrder ? guestInfo : undefined,
        isGuestOrder,
        orderItems: validatedItems,
        shippingAddress,
        paymentMethod,
        totalPrice: calculatedTotal,
        totalAmount: grandTotal,
        shippingFee: shippingResult.shippingFee,
        shippingZone: shippingResult.zone,
        shippingBreakdown: shippingResult.breakdown,
        status: 'pending',
        paymentStatus: 'pending',
        notes: notes?.trim(),
      });

      await fishOrder.save({ session });

      await session.commitTransaction();

      const populatedOrder = await FishOrder.findById(fishOrder._id)
        .populate('orderItems.fishProduct', 'name image');

      res.status(201).json({
        success: true,
        message: 'Fish order created successfully',
        fishOrder: populatedOrder,
      });
    } catch (error: any) {
      await session.abortTransaction();

      // Restore stock if order creation failed
      for (const update of stockUpdates) {
        try {
          const product = await FishProduct.findById(update.productId);
          if (product) {
            const sizeCatIndex = (product as any).sizeCategories.findIndex(
              (cat: any) => cat._id.toString() === update.sizeCategoryId
            );
            if (sizeCatIndex !== -1) {
              (product as any).sizeCategories[sizeCatIndex].stock += update.stockDeducted;
              await product.save();
            }
          }
        } catch (restoreError) {
          logger.error('Error restoring stock:', restoreError);
        }
      }

      throw error;
    } finally {
      session.endSession();
    }
  } catch (error: any) {
    logger.error('Error creating fish order:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to create fish order',
      error: error.message,
    });
  }
};

// Update fish order status
export const updateFishOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, paymentStatus, notes, cancellationReason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid fish order ID' });
      return;
    }

    const order = await FishOrder.findById(id);
    if (!order) {
      res.status(404).json({ success: false, message: 'Fish order not found' });
      return;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const oldStatus = (order as any).status;

      if (status) {
        (order as any).status = status;
      }

      if (paymentStatus) {
        (order as any).paymentStatus = paymentStatus;
      }

      if (notes !== undefined) {
        (order as any).notes = notes?.trim();
      }

      // Handle status changes
      if (status === 'cancelled' && oldStatus !== 'cancelled') {
        (order as any).cancelledAt = new Date();
        if (cancellationReason) {
          (order as any).cancellationReason = cancellationReason.trim();
        }

        // Restore stock for cancelled orders
        for (const item of (order as any).orderItems) {
          const product = await FishProduct.findById(item.fishProduct).session(session);
          if (product) {
            const sizeCatIndex = (product as any).sizeCategories.findIndex(
              (cat: any) => cat._id.toString() === item.sizeCategoryId.toString()
            );
            if (sizeCatIndex !== -1 && item.stockDeducted) {
              (product as any).sizeCategories[sizeCatIndex].stock += item.stockDeducted;
              await product.save({ session });
            }
          }
        }
      } else if (status === 'delivered' && oldStatus !== 'delivered') {
        (order as any).deliveredAt = new Date();
        (order as any).paymentStatus = 'completed';
        // Stock already deducted, no need to do anything
      } else if (status === 'confirmed' && oldStatus === 'pending') {
        // Stock already deducted, keep it deducted
      }

      await order.save({ session });
      await session.commitTransaction();

      const populatedOrder = await FishOrder.findById(order._id)
        .populate('orderItems.fishProduct', 'name image');

      res.json({
        success: true,
        message: 'Fish order updated successfully',
        fishOrder: populatedOrder,
      });
    } catch (error: any) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error: any) {
    logger.error('Error updating fish order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update fish order',
      error: error.message,
    });
  }
};

// Delete fish order (only if pending)
export const deleteFishOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid fish order ID' });
      return;
    }

    const order = await FishOrder.findById(id);
    if (!order) {
      res.status(404).json({ success: false, message: 'Fish order not found' });
      return;
    }

    if ((order as any).status !== 'pending') {
      res.status(400).json({
        success: false,
        message: 'Can only delete pending orders',
      });
      return;
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Restore stock for deleted orders
      for (const item of (order as any).orderItems) {
        const product = await FishProduct.findById(item.fishProduct).session(session);
        if (product) {
          const sizeCatIndex = (product as any).sizeCategories.findIndex(
            (cat: any) => cat._id.toString() === item.sizeCategoryId.toString()
          );
          if (sizeCatIndex !== -1 && item.stockDeducted) {
            (product as any).sizeCategories[sizeCatIndex].stock += item.stockDeducted;
            await product.save({ session });
          }
        }
      }

      await FishOrder.findByIdAndDelete(id).session(session);
      await session.commitTransaction();

      res.json({
        success: true,
        message: 'Fish order deleted successfully',
      });
    } catch (error: any) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error: any) {
    logger.error('Error deleting fish order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete fish order',
      error: error.message,
    });
  }
};

// Get fish order stats
export const getFishOrderStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [total, pending, confirmed, processing, shipped, delivered, cancelled] =
      await Promise.all([
        FishOrder.countDocuments({}),
        FishOrder.countDocuments({ status: 'pending' }),
        FishOrder.countDocuments({ status: 'confirmed' }),
        FishOrder.countDocuments({ status: 'processing' }),
        FishOrder.countDocuments({ status: 'shipped' }),
        FishOrder.countDocuments({ status: 'delivered' }),
        FishOrder.countDocuments({ status: 'cancelled' }),
      ]);

    const revenueStats = await FishOrder.aggregate([
      {
        $match: { status: 'delivered', paymentStatus: 'completed' },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalPrice' },
          orderCount: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      stats: {
        total,
        byStatus: {
          pending,
          confirmed,
          processing,
          shipped,
          delivered,
          cancelled,
        },
        revenue: revenueStats[0] || { totalRevenue: 0, orderCount: 0 },
      },
    });
  } catch (error: any) {
    logger.error('Error fetching fish order stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order stats',
      error: error.message,
    });
  }
};

