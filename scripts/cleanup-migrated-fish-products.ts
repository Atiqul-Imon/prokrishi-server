import 'dotenv/config';
import connectDB from '../config/connectDB.js';
import Product from '../models/product.model.js';
import FishProduct from '../models/fishProduct.model.js';
import Category from '../models/category.model.js';
import logger from '../services/logger.js';

async function cleanupMigratedFishProducts() {
  try {
    await connectDB();
    logger.info('Starting cleanup of migrated fish products from main product system...');

    // Find "মাছ" category
    const fishCategory = await Category.findOne({ name: 'মাছ' });
    if (!fishCategory) {
      logger.warn('"মাছ" category not found. Nothing to clean up.');
      process.exit(0);
    }

    // Find all products in "মাছ" category
    const fishProducts = await Product.find({ category: fishCategory._id });
    logger.info(`Found ${fishProducts.length} products in "মাছ" category`);

    if (fishProducts.length === 0) {
      logger.info('No products found in "মাছ" category. Nothing to clean up.');
      process.exit(0);
    }

    let deleted = 0;
    let skipped = 0;
    let errors = 0;

    for (const product of fishProducts) {
      try {
        // Check if this product has been migrated to fish products
        const migrated = await FishProduct.findOne({
          $or: [
            { sku: (product as any).sku },
            { name: (product as any).name }
          ]
        });

        if (migrated) {
          // Delete from regular products
          await Product.findByIdAndDelete(product._id);
          logger.info(`Deleted: ${(product as any).name} (migrated to fish products)`);
          deleted++;
        } else {
          logger.warn(`Skipping: ${(product as any).name} - not found in fish products (may need manual review)`);
          skipped++;
        }
      } catch (error: any) {
        logger.error(`Error deleting ${(product as any).name}:`, error.message);
        errors++;
      }
    }

    logger.info(`Cleanup complete! Deleted: ${deleted}, Skipped: ${skipped}, Errors: ${errors}`);
    
    if (skipped > 0) {
      logger.warn(`${skipped} products were skipped. Please review them manually.`);
    }
    
    process.exit(0);
  } catch (error: any) {
    logger.error('Cleanup failed:', error);
    process.exit(1);
  }
}

cleanupMigratedFishProducts();

