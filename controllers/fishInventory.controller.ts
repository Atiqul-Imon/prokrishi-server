import { Response } from 'express';
import FishInventory from '../models/fishInventory.model.js';
import FishProduct from '../models/fishProduct.model.js';
import mongoose from 'mongoose';
import logger from '../services/logger.js';
import { AuthRequest } from '../types/index.js';

// Get all fish inventory items
export const getAllFishInventory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 50,
      fishProduct,
      sizeCategoryId,
      status,
      search,
      sort = 'createdAt',
      order = 'desc',
    } = req.query;

    const query: any = {};

    if (fishProduct && mongoose.Types.ObjectId.isValid(fishProduct as string)) {
      query.fishProduct = fishProduct;
    }

    if (sizeCategoryId && mongoose.Types.ObjectId.isValid(sizeCategoryId as string)) {
      query.sizeCategoryId = sizeCategoryId;
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { notes: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortField: any = {};
    sortField[sort as string] = sortOrder;

    const [inventoryItems, total] = await Promise.all([
      FishInventory.find(query)
        .populate('fishProduct', 'name image')
        .populate('reservedForOrder', 'orderNumber')
        .populate('soldToOrder', 'orderNumber')
        .sort(sortField)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      FishInventory.countDocuments(query),
    ]);

    // Enrich with size category info
    const enrichedItems = await Promise.all(
      inventoryItems.map(async (item: any) => {
        const product = await FishProduct.findById(item.fishProduct);
        if (product) {
          const sizeCategory = (product as any).sizeCategories.find(
            (cat: any) => cat._id.toString() === item.sizeCategoryId.toString()
          );
          return {
            ...item,
            sizeCategory: sizeCategory
              ? {
                  label: sizeCategory.label,
                  pricePerKg: sizeCategory.pricePerKg,
                }
              : null,
          };
        }
        return item;
      })
    );

    res.json({
      success: true,
      inventoryItems: enrichedItems,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    logger.error('Error fetching fish inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fish inventory',
      error: error.message,
    });
  }
};

// Get inventory stats
export const getFishInventoryStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { fishProduct, sizeCategoryId } = req.query;

    const query: any = {};
    if (fishProduct && mongoose.Types.ObjectId.isValid(fishProduct as string)) {
      query.fishProduct = fishProduct;
    }
    if (sizeCategoryId && mongoose.Types.ObjectId.isValid(sizeCategoryId as string)) {
      query.sizeCategoryId = sizeCategoryId;
    }

    const [total, available, reserved, sold, expired, damaged] = await Promise.all([
      FishInventory.countDocuments(query),
      FishInventory.countDocuments({ ...query, status: 'available' }),
      FishInventory.countDocuments({ ...query, status: 'reserved' }),
      FishInventory.countDocuments({ ...query, status: 'sold' }),
      FishInventory.countDocuments({ ...query, status: 'expired' }),
      FishInventory.countDocuments({ ...query, status: 'damaged' }),
    ]);

    // Calculate total weight by status
    const weightStats = await FishInventory.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          totalWeight: { $sum: '$actualWeight' },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      stats: {
        total,
        available,
        reserved,
        sold,
        expired,
        damaged,
        weightByStatus: weightStats,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching fish inventory stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory stats',
      error: error.message,
    });
  }
};

// Add fish to inventory
export const addFishToInventory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      fishProduct,
      sizeCategoryId,
      actualWeight,
      purchaseDate,
      expiryDate,
      location,
      costPrice,
      notes,
    } = req.body;

    if (!fishProduct || !sizeCategoryId || !actualWeight) {
      res.status(400).json({
        success: false,
        message: 'Fish product, size category, and actual weight are required',
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(fishProduct)) {
      res.status(400).json({ success: false, message: 'Invalid fish product ID' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(sizeCategoryId)) {
      res.status(400).json({ success: false, message: 'Invalid size category ID' });
      return;
    }

    if (Number(actualWeight) <= 0) {
      res.status(400).json({ success: false, message: 'Actual weight must be greater than 0' });
      return;
    }

    // Verify fish product and size category exist
    const product = await FishProduct.findById(fishProduct);
    if (!product) {
      res.status(404).json({ success: false, message: 'Fish product not found' });
      return;
    }

    const sizeCategory = (product as any).sizeCategories.find(
      (cat: any) => cat._id.toString() === sizeCategoryId
    );
    if (!sizeCategory) {
      res.status(404).json({ success: false, message: 'Size category not found' });
      return;
    }

    const inventoryItem = new FishInventory({
      fishProduct,
      sizeCategoryId,
      actualWeight: Number(actualWeight),
      status: 'available',
      purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      location: location?.trim(),
      costPrice: costPrice ? Number(costPrice) : undefined,
      notes: notes?.trim(),
    });

    await inventoryItem.save();

    res.status(201).json({
      success: true,
      message: 'Fish added to inventory successfully',
      inventoryItem,
    });
  } catch (error: any) {
    logger.error('Error adding fish to inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add fish to inventory',
      error: error.message,
    });
  }
};

// Bulk add fish to inventory
export const bulkAddFishToInventory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Items array is required and must not be empty',
      });
      return;
    }

    const inventoryItems = [];
    const errors: any[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        if (!item.fishProduct || !item.sizeCategoryId || !item.actualWeight) {
          errors.push({
            index: i,
            error: 'Fish product, size category, and actual weight are required',
          });
          continue;
        }

        if (!mongoose.Types.ObjectId.isValid(item.fishProduct)) {
          errors.push({ index: i, error: 'Invalid fish product ID' });
          continue;
        }

        if (!mongoose.Types.ObjectId.isValid(item.sizeCategoryId)) {
          errors.push({ index: i, error: 'Invalid size category ID' });
          continue;
        }

        if (Number(item.actualWeight) <= 0) {
          errors.push({ index: i, error: 'Actual weight must be greater than 0' });
          continue;
        }

        // Verify fish product and size category exist
        const product = await FishProduct.findById(item.fishProduct);
        if (!product) {
          errors.push({ index: i, error: 'Fish product not found' });
          continue;
        }

        const sizeCategory = (product as any).sizeCategories.find(
          (cat: any) => cat._id.toString() === item.sizeCategoryId
        );
        if (!sizeCategory) {
          errors.push({ index: i, error: 'Size category not found' });
          continue;
        }

        inventoryItems.push({
          fishProduct: item.fishProduct,
          sizeCategoryId: item.sizeCategoryId,
          actualWeight: Number(item.actualWeight),
          status: 'available',
          purchaseDate: item.purchaseDate ? new Date(item.purchaseDate) : new Date(),
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
          location: item.location?.trim(),
          costPrice: item.costPrice ? Number(item.costPrice) : undefined,
          notes: item.notes?.trim(),
        });
      } catch (error: any) {
        errors.push({ index: i, error: error.message });
      }
    }

    if (inventoryItems.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No valid items to add',
        errors,
      });
      return;
    }

    const insertedItems = await FishInventory.insertMany(inventoryItems);

    res.status(201).json({
      success: true,
      message: `Successfully added ${insertedItems.length} fish to inventory`,
      added: insertedItems.length,
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      inventoryItems: insertedItems,
    });
  } catch (error: any) {
    logger.error('Error bulk adding fish to inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk add fish to inventory',
      error: error.message,
    });
  }
};

// Update fish inventory item
export const updateFishInventory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      actualWeight,
      status,
      purchaseDate,
      expiryDate,
      location,
      costPrice,
      notes,
      reservedForOrder,
      soldToOrder,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid inventory item ID' });
      return;
    }

    const inventoryItem = await FishInventory.findById(id);
    if (!inventoryItem) {
      res.status(404).json({ success: false, message: 'Inventory item not found' });
      return;
    }

    // Prevent updating if already sold (unless changing status)
    if ((inventoryItem as any).status === 'sold' && status !== 'sold') {
      res.status(400).json({
        success: false,
        message: 'Cannot modify a sold inventory item',
      });
      return;
    }

    if (actualWeight !== undefined) {
      if (Number(actualWeight) <= 0) {
        res.status(400).json({ success: false, message: 'Actual weight must be greater than 0' });
        return;
      }
      (inventoryItem as any).actualWeight = Number(actualWeight);
    }

    if (status) {
      (inventoryItem as any).status = status;
    }

    if (purchaseDate !== undefined) {
      (inventoryItem as any).purchaseDate = purchaseDate ? new Date(purchaseDate) : undefined;
    }

    if (expiryDate !== undefined) {
      (inventoryItem as any).expiryDate = expiryDate ? new Date(expiryDate) : undefined;
    }

    if (location !== undefined) {
      (inventoryItem as any).location = location?.trim();
    }

    if (costPrice !== undefined) {
      (inventoryItem as any).costPrice = costPrice ? Number(costPrice) : undefined;
    }

    if (notes !== undefined) {
      (inventoryItem as any).notes = notes?.trim();
    }

    if (reservedForOrder !== undefined) {
      if (reservedForOrder && !mongoose.Types.ObjectId.isValid(reservedForOrder)) {
        res.status(400).json({ success: false, message: 'Invalid order ID' });
        return;
      }
      (inventoryItem as any).reservedForOrder = reservedForOrder || undefined;
    }

    if (soldToOrder !== undefined) {
      if (soldToOrder && !mongoose.Types.ObjectId.isValid(soldToOrder)) {
        res.status(400).json({ success: false, message: 'Invalid order ID' });
        return;
      }
      (inventoryItem as any).soldToOrder = soldToOrder || undefined;
    }

    await inventoryItem.save();

    res.json({
      success: true,
      message: 'Inventory item updated successfully',
      inventoryItem,
    });
  } catch (error: any) {
    logger.error('Error updating fish inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update inventory item',
      error: error.message,
    });
  }
};

// Delete fish inventory item
export const deleteFishInventory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid inventory item ID' });
      return;
    }

    const inventoryItem = await FishInventory.findById(id);
    if (!inventoryItem) {
      res.status(404).json({ success: false, message: 'Inventory item not found' });
      return;
    }

    // Prevent deletion if reserved or sold
    if ((inventoryItem as any).status === 'reserved' || (inventoryItem as any).status === 'sold') {
      res.status(400).json({
        success: false,
        message: 'Cannot delete reserved or sold inventory items',
      });
      return;
    }

    await FishInventory.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Inventory item deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting fish inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete inventory item',
      error: error.message,
    });
  }
};

