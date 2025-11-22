import { Response } from 'express';
import FishOrder from '../models/fishOrder.model.js';
import FishProduct from '../models/fishProduct.model.js';
import FishInventory from '../models/fishInventory.model.js';
import mongoose from 'mongoose';
import logger from '../services/logger.js';
import { AuthRequest } from '../types/index.js';

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
      .populate('orderItems.fishProduct', 'name image')
      .populate('orderItems.inventoryItems');

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

    const inventoryUpdates: any[] = [];

    try {
      const validatedItems: any[] = [];
      let calculatedTotal = 0;

      // Validate and process each order item
      for (const item of orderItems) {
        const fishProduct = await FishProduct.findById(item.fishProduct).session(session);
        if (!fishProduct) {
          throw new Error(`Fish product not found: ${item.fishProduct}`);
        }

        const sizeCategory = (fishProduct as any).sizeCategories.find(
          (cat: any) => cat._id.toString() === item.sizeCategoryId
        );
        if (!sizeCategory) {
          throw new Error(`Size category not found for product ${fishProduct.name}`);
        }

        if (sizeCategory.status !== 'active') {
          throw new Error(`Size category "${sizeCategory.label}" is not active`);
        }

        const requestedWeight = Number(item.requestedWeight);
        if (isNaN(requestedWeight) || requestedWeight <= 0) {
          throw new Error(`Invalid requested weight: ${item.requestedWeight}`);
        }

        const pricePerKg = sizeCategory.pricePerKg;
        const itemTotal = requestedWeight * pricePerKg;
        calculatedTotal += itemTotal;

        // Find available fish from inventory
        const availableFish = await FishInventory.find({
          fishProduct: item.fishProduct,
          sizeCategoryId: item.sizeCategoryId,
          status: 'available',
        })
          .session(session)
          .sort({ actualWeight: 1 }) // Prefer smaller fish first
          .limit(10); // Get enough to match weight

        let totalWeight = 0;
        const selectedInventoryItems: mongoose.Types.ObjectId[] = [];

        for (const fish of availableFish) {
          if (totalWeight >= requestedWeight) break;
          selectedInventoryItems.push(fish._id);
          totalWeight += (fish as any).actualWeight;
        }

        if (totalWeight < requestedWeight * 0.9) {
          // Allow 10% tolerance
          throw new Error(
            `Insufficient fish available. Requested: ${requestedWeight}kg, Available: ${totalWeight.toFixed(2)}kg`
          );
        }

        // Reserve the inventory items
        for (const invId of selectedInventoryItems) {
          await FishInventory.findByIdAndUpdate(
            invId,
            { status: 'reserved' },
            { session }
          );
          inventoryUpdates.push({ id: invId, status: 'reserved' });
        }

        validatedItems.push({
          fishProduct: fishProduct._id,
          fishProductName: (fishProduct as any).name,
          sizeCategoryId: sizeCategory._id,
          sizeCategoryLabel: sizeCategory.label,
          requestedWeight,
          pricePerKg,
          totalPrice: itemTotal,
          inventoryItems: selectedInventoryItems,
          notes: item.notes,
        });
      }

      // Verify total price matches
      if (Math.abs(calculatedTotal - totalPrice) > 0.01) {
        throw new Error('Price mismatch detected');
      }

      // Create the order
      const fishOrder = new FishOrder({
        user: req.user?._id,
        guestInfo: isGuestOrder ? guestInfo : undefined,
        isGuestOrder,
        orderItems: validatedItems,
        shippingAddress,
        paymentMethod,
        totalPrice: calculatedTotal,
        totalAmount: calculatedTotal,
        status: 'pending',
        paymentStatus: 'pending',
        notes: notes?.trim(),
      });

      // Link reserved inventory to order
      for (const item of validatedItems) {
        for (const invId of item.inventoryItems) {
          await FishInventory.findByIdAndUpdate(
            invId,
            { reservedForOrder: fishOrder._id },
            { session }
          );
        }
      }

      await fishOrder.save({ session });

      await session.commitTransaction();

      const populatedOrder = await FishOrder.findById(fishOrder._id)
        .populate('orderItems.fishProduct', 'name image')
        .populate('orderItems.inventoryItems');

      res.status(201).json({
        success: true,
        message: 'Fish order created successfully',
        fishOrder: populatedOrder,
      });
    } catch (error: any) {
      await session.abortTransaction();

      // Release reserved inventory
      for (const update of inventoryUpdates) {
        await FishInventory.findByIdAndUpdate(update.id, { status: 'available' });
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

        // Release reserved inventory
        for (const item of (order as any).orderItems) {
          for (const invId of item.inventoryItems) {
            await FishInventory.findByIdAndUpdate(
              invId,
              { status: 'available', reservedForOrder: undefined },
              { session }
            );
          }
        }
      } else if (status === 'delivered' && oldStatus !== 'delivered') {
        (order as any).deliveredAt = new Date();
        (order as any).paymentStatus = 'completed';

        // Mark inventory as sold
        for (const item of (order as any).orderItems) {
          for (const invId of item.inventoryItems) {
            await FishInventory.findByIdAndUpdate(
              invId,
              { status: 'sold', soldToOrder: order._id, reservedForOrder: undefined },
              { session }
            );
          }
        }
      } else if (status === 'confirmed' && oldStatus === 'pending') {
        // Keep inventory reserved
      }

      await order.save({ session });
      await session.commitTransaction();

      const populatedOrder = await FishOrder.findById(order._id)
        .populate('orderItems.fishProduct', 'name image')
        .populate('orderItems.inventoryItems');

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
      // Release reserved inventory
      for (const item of (order as any).orderItems) {
        for (const invId of item.inventoryItems) {
          await FishInventory.findByIdAndUpdate(
            invId,
            { status: 'available', reservedForOrder: undefined },
            { session }
          );
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

