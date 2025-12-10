/**
 * Inventory Guard Service
 * 
 * CRITICAL: This service ensures that inventory checks ALWAYS use fresh data from the database,
 * never cached data. This prevents overselling - a critical e-commerce bottleneck.
 * 
 * IMPORTANT RULES:
 * 1. Product listings can be cached (stock shown is approximate for display)
 * 2. Product details can be cached (stock shown is approximate for display)
 * 3. Order creation MUST always query fresh inventory from database
 * 4. Stock updates MUST always use database transactions
 * 5. Never trust cached stock values for order fulfillment
 */

import Product from '../models/product.model.js';
import FishProduct from '../models/fishProduct.model.js';
import mongoose from 'mongoose';

export interface InventoryCheckResult {
  available: boolean;
  currentStock: number;
  requestedQuantity: number;
  productId: string;
  variantId?: string;
  message?: string;
}

/**
 * Check product inventory with FRESH database query (never uses cache)
 * This is critical for preventing overselling
 */
export async function checkProductInventory(
  productId: string,
  quantity: number,
  variantId?: string
): Promise<InventoryCheckResult> {
  try {
    // ALWAYS query fresh from database - never use cache
    const product = await Product.findById(productId).lean();

    if (!product) {
      // Check fish products
      const fishProduct = await FishProduct.findById(productId).lean();
      if (!fishProduct) {
        return {
          available: false,
          currentStock: 0,
          requestedQuantity: quantity,
          productId,
          variantId,
          message: 'Product not found',
        };
      }

      // Fish product inventory check
      if (variantId) {
        const sizeCategory = (fishProduct as any).sizeCategories.find(
          (sc: any) => sc._id.toString() === variantId
        );
        if (!sizeCategory) {
          return {
            available: false,
            currentStock: 0,
            requestedQuantity: quantity,
            productId,
            variantId,
            message: 'Size category not found',
          };
        }

        const available = (sizeCategory.stock || 0) >= quantity;
        return {
          available,
          currentStock: sizeCategory.stock || 0,
          requestedQuantity: quantity,
          productId,
          variantId,
          message: available
            ? undefined
            : `Insufficient stock. Available: ${sizeCategory.stock}, Requested: ${quantity}`,
        };
      }

      // Total stock across all size categories
      const totalStock = (fishProduct as any).sizeCategories.reduce(
        (sum: number, sc: any) => sum + (sc.stock || 0),
        0
      );
      const available = totalStock >= quantity;

      return {
        available,
        currentStock: totalStock,
        requestedQuantity: quantity,
        productId,
        variantId,
        message: available
          ? undefined
          : `Insufficient stock. Available: ${totalStock}, Requested: ${quantity}`,
      };
    }

    // Regular product inventory check
    if (variantId) {
      const variant = (product as any).variants?.find(
        (v: any) => v._id.toString() === variantId
      );
      if (!variant) {
        return {
          available: false,
          currentStock: 0,
          requestedQuantity: quantity,
          productId,
          variantId,
          message: 'Variant not found',
        };
      }

      const available = (variant.stock || 0) >= quantity;
      return {
        available,
        currentStock: variant.stock || 0,
        requestedQuantity: quantity,
        productId,
        variantId,
        message: available
          ? undefined
          : `Insufficient stock. Available: ${variant.stock}, Requested: ${quantity}`,
      };
    }

    // Product without variants
    const available = ((product as any).stock || 0) >= quantity;
    return {
      available,
      currentStock: (product as any).stock || 0,
      requestedQuantity: quantity,
      productId,
      variantId,
      message: available
        ? undefined
        : `Insufficient stock. Available: ${(product as any).stock}, Requested: ${quantity}`,
    };
  } catch (error: any) {
    return {
      available: false,
      currentStock: 0,
      requestedQuantity: quantity,
      productId,
      variantId,
      message: `Error checking inventory: ${error.message}`,
    };
  }
}

/**
 * Reserve inventory atomically using database transaction
 * This ensures no overselling even under high concurrency
 */
export async function reserveInventory(
  productId: string,
  quantity: number,
  variantId?: string
): Promise<{ success: boolean; message?: string }> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // ALWAYS query fresh from database - never use cache
    const product = await Product.findById(productId).session(session);

    if (!product) {
      // Check fish products
      const fishProduct = await FishProduct.findById(productId).session(session);
      if (!fishProduct) {
        await session.abortTransaction();
        return { success: false, message: 'Product not found' };
      }

      if (variantId) {
        const sizeCategory = (fishProduct as any).sizeCategories.find(
          (sc: any) => sc._id.toString() === variantId
        );
        if (!sizeCategory || (sizeCategory.stock || 0) < quantity) {
          await session.abortTransaction();
          return {
            success: false,
            message: `Insufficient stock. Available: ${sizeCategory?.stock || 0}, Requested: ${quantity}`,
          };
        }

        sizeCategory.stock = (sizeCategory.stock || 0) - quantity;
        await fishProduct.save({ session });
      } else {
        const totalStock = (fishProduct as any).sizeCategories.reduce(
          (sum: number, sc: any) => sum + (sc.stock || 0),
          0
        );
        if (totalStock < quantity) {
          await session.abortTransaction();
          return {
            success: false,
            message: `Insufficient stock. Available: ${totalStock}, Requested: ${quantity}`,
          };
        }

        // Deduct from default or first available size category
        const defaultSizeCat =
          (fishProduct as any).sizeCategories.find((sc: any) => sc.isDefault) ||
          (fishProduct as any).sizeCategories[0];
        if (defaultSizeCat) {
          defaultSizeCat.stock = Math.max(0, (defaultSizeCat.stock || 0) - quantity);
          await fishProduct.save({ session });
        }
      }

      await session.commitTransaction();
      return { success: true };
    }

    // Regular product inventory reservation
    if (variantId) {
      const variant = (product as any).variants?.find(
        (v: any) => v._id.toString() === variantId
      );
      if (!variant || (variant.stock || 0) < quantity) {
        await session.abortTransaction();
        return {
          success: false,
          message: `Insufficient stock. Available: ${variant?.stock || 0}, Requested: ${quantity}`,
        };
      }

      variant.stock = (variant.stock || 0) - quantity;
      (product as any).stock = (product as any).variants.reduce(
        (sum: number, v: any) => sum + (v.stock || 0),
        0
      );
      await product.save({ session });
    } else {
      if ((product as any).stock < quantity) {
        await session.abortTransaction();
        return {
          success: false,
          message: `Insufficient stock. Available: ${(product as any).stock}, Requested: ${quantity}`,
        };
      }

      (product as any).stock = (product as any).stock - quantity;
      await product.save({ session });
    }

    await session.commitTransaction();
    return { success: true };
  } catch (error: any) {
    await session.abortTransaction();
    return { success: false, message: `Error reserving inventory: ${error.message}` };
  } finally {
    await session.endSession();
  }
}

