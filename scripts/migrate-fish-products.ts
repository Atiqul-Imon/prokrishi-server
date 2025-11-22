import 'dotenv/config';
import connectDB from '../config/connectDB.js';
import Product from '../models/product.model.js';
import FishProduct from '../models/fishProduct.model.js';
import Category from '../models/category.model.js';
import logger from '../services/logger.js';

async function migrateFishProducts() {
  try {
    await connectDB();
    logger.info('Starting fish products migration...');

    // Find or create "মাছ" category
    let fishCategory = await Category.findOne({ name: 'মাছ' });
    if (!fishCategory) {
      fishCategory = new Category({
        name: 'মাছ',
        slug: 'machh',
        description: 'Fish products',
      });
      await fishCategory.save();
      logger.info('Created "মাছ" category');
    }

    // Find all products in "মাছ" category
    const fishProducts = await Product.find({ category: fishCategory._id });
    logger.info(`Found ${fishProducts.length} products in "মাছ" category`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    for (const product of fishProducts) {
      try {
        // Check if already migrated
        const existing = await FishProduct.findOne({ 
          $or: [
            { sku: (product as any).sku },
            { name: (product as any).name }
          ]
        });

        if (existing) {
          logger.info(`Skipping ${(product as any).name} - already exists in fish products`);
          skipped++;
          continue;
        }

        // Convert product variants to size categories
        const sizeCategories = [];
        if ((product as any).variants && (product as any).variants.length > 0) {
          // Use variants as size categories
          for (let i = 0; i < (product as any).variants.length; i++) {
            const variant = (product as any).variants[i];
            const pricePerKg = variant.salePrice || variant.price;
            
            sizeCategories.push({
              label: variant.label || `Size ${i + 1}`,
              pricePerKg: pricePerKg || (product as any).price || 0,
              stock: variant.stock || 0,
              minWeight: variant.measurement || undefined,
              maxWeight: variant.measurement || undefined,
              sku: variant.sku,
              status: variant.status === 'out_of_stock' ? 'out_of_stock' : 
                      variant.status === 'inactive' ? 'inactive' : 'active',
              isDefault: i === 0,
            });
          }
        } else {
          // Create a default size category from product data
          sizeCategories.push({
            label: 'Standard',
            pricePerKg: (product as any).price || 0,
            stock: (product as any).stock || 0,
            minWeight: (product as any).measurement || undefined,
            maxWeight: (product as any).measurement || undefined,
            sku: (product as any).sku,
            status: (product as any).status === 'out_of_stock' ? 'out_of_stock' :
                    (product as any).status === 'inactive' ? 'inactive' : 'active',
            isDefault: true,
          });
        }

        // Create fish product
        const fishProduct = new FishProduct({
          name: (product as any).name,
          sku: (product as any).sku,
          category: fishCategory._id,
          description: (product as any).description || '',
          shortDescription: (product as any).shortDescription || '',
          image: (product as any).image || '',
          sizeCategories,
          status: (product as any).status === 'inactive' ? 'inactive' : 'active',
          isFeatured: (product as any).isFeatured || false,
          tags: (product as any).tags || [],
          metaTitle: (product as any).metaTitle,
          metaDescription: (product as any).metaDescription,
        });

        await fishProduct.save();
        logger.info(`Migrated: ${(product as any).name}`);
        migrated++;
      } catch (error: any) {
        logger.error(`Error migrating ${(product as any).name}:`, error.message);
        errors++;
      }
    }

    logger.info(`Migration complete! Migrated: ${migrated}, Skipped: ${skipped}, Errors: ${errors}`);
    process.exit(0);
  } catch (error: any) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateFishProducts();

