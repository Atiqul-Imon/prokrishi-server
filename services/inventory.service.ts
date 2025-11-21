import mongoose, { ClientSession } from 'mongoose';
import Product from '../models/product.model.js';
import logger from './logger.js';
import { IVariantSnapshot } from '../types/index.js';

interface RestoreInventoryParams {
  productId: mongoose.Types.ObjectId | string;
  quantity: number;
  variantSnapshot?: IVariantSnapshot | null;
  session?: ClientSession | null;
}

export const restoreProductInventory = async ({
  productId,
  quantity,
  variantSnapshot,
  session,
}: RestoreInventoryParams): Promise<void> => {
  const product = await Product.findById(productId).session(session || null);

  if (!product) {
    logger.warn('Attempted to restore inventory for missing product', { productId });
    return;
  }

  const safeQuantity = Math.max(0, Number(quantity) || 0);
  if (safeQuantity === 0) {
    return;
  }

  const productAny = product as any;
  const hasVariants = productAny.hasVariants && Array.isArray(productAny.variants);

  if (hasVariants && productAny.variants.length > 0) {
    const variants = productAny.variants;
    let matchedVariant =
      (variantSnapshot?.variantId &&
        (variants.id?.(variantSnapshot.variantId) ||
          variants.find((variant: any) =>
            variant._id?.equals ? variant._id.equals(variantSnapshot.variantId) : false
          ))) ||
      variants.find((variant: any) => variant.isDefault) ||
      variants[0];

    if (matchedVariant) {
      matchedVariant.stock = (matchedVariant.stock || 0) + safeQuantity;
      productAny.stock = variants.reduce(
        (sum: number, variant: any) => sum + (variant.stock || 0),
        0
      );
      productAny.sold = Math.max(0, (productAny.sold || 0) - safeQuantity);
      product.markModified('variants');
      await product.save({ session, validateModifiedOnly: true });
      return;
    }
  }

  productAny.stock = (productAny.stock || 0) + safeQuantity;
  productAny.sold = Math.max(0, (productAny.sold || 0) - safeQuantity);
  await product.save({ session, validateModifiedOnly: true });
};

