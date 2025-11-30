import { Response } from 'express';
import mongoose from 'mongoose';
import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import FishProduct from '../models/fishProduct.model.js';
import cacheService from '../services/cache.js';
import logger, { logBusiness, logPerformance } from '../services/logger.js';
import { AuthRequest, IOrder } from '../types/index.js';
import { restoreProductInventory } from '../services/inventory.service.js';
import {
  calculateItemWeightKg,
  calculateOtherProductShipping,
  calculateFishShipping,
  getShippingZone,
} from '../services/shipping.service.js';

export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  const startTime = Date.now();
  const {
    orderItems,
    shippingAddress,
    paymentMethod = 'Cash on Delivery',
    totalPrice,
    guestInfo,
  } = req.body;

  if (!orderItems || orderItems.length === 0) {
    res.status(400).json({
      success: false,
      message: 'No order items provided',
    });
    return;
  }

  if (!shippingAddress) {
    res.status(400).json({
      success: false,
      message: 'Shipping address is required',
    });
    return;
  }

  if (!shippingAddress.address || shippingAddress.address.trim().length < 2) {
    res.status(400).json({
      success: false,
      message: 'Address must be at least 2 characters',
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

  try {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const validatedItems: any[] = [];
        let calculatedTotal = 0;
        let totalWeightKg = 0;
        const productUpdates: Array<{
          productId: any;
          quantity: number;
          originalStock: number;
          variantId?: any;
          variantLabel?: string;
        }> = [];

        for (const item of orderItems) {
          const product = await Product.findById(item.product).session(session);
          if (!product) {
            throw new Error(`Product not found: ${item.name}`);
          }

          if ((product as any).status !== 'active') {
            throw new Error(`Product ${item.name} is not available`);
          }

          const variantIdFromRequest =
            item.variantId ||
            item.variant?._id ||
            item.variant?.variantId ||
            item.variantId;

          let variantSnapshot: any = null;
          let unitPrice = item.price;
          let lineItemName = item.name || (product as any).name;
          let originalStockValue = (product as any).stock;

          if ((product as any).hasVariants && (product as any).variants?.length) {
            const variants = (product as any).variants;
            let matchedVariant = variantIdFromRequest
              ? variants.id?.(variantIdFromRequest) ||
                variants.find((variant: any) => variant._id.equals(variantIdFromRequest))
              : variants.find((variant: any) => variant.isDefault);

            if (!matchedVariant) {
              throw new Error(`Variant not found for ${item.name}`);
            }

            if (
              matchedVariant.status === 'inactive' ||
              matchedVariant.stock === undefined ||
              matchedVariant.stock < item.quantity
            ) {
              throw new Error(
                `Insufficient stock for ${item.name} (${matchedVariant.label}). Available: ${matchedVariant.stock}`
              );
            }

            originalStockValue = matchedVariant.stock;

            matchedVariant.stock -= item.quantity;
            (product as any).sold = ((product as any).sold || 0) + item.quantity;
            (product as any).stock = (product as any).variants.reduce(
              (sum: number, variant: any) => sum + (variant.stock || 0),
              0
            );
            product.markModified('variants');
            await product.save({ session, validateModifiedOnly: true });

            unitPrice = matchedVariant.salePrice || matchedVariant.price;
            lineItemName = `${(product as any).name} (${matchedVariant.label})`;
            variantSnapshot = {
              variantId: matchedVariant._id,
              label: matchedVariant.label,
              sku: matchedVariant.sku,
              price: matchedVariant.price,
              salePrice: matchedVariant.salePrice,
              measurement: matchedVariant.measurement,
              unit: matchedVariant.unit,
              image: matchedVariant.image || (product as any).image,
              unitWeightKg: matchedVariant.unitWeightKg,
            };

            const itemWeight = calculateItemWeightKg({
              product: product as unknown as any,
              variant: matchedVariant,
              quantity: item.quantity,
            });
            totalWeightKg += itemWeight;

            validatedItems.push({
              product: (product as any)._id,
              name: lineItemName,
              quantity: item.quantity,
              price: unitPrice,
              variant: variantSnapshot,
            });

            productUpdates.push({
              productId: (product as any)._id,
              quantity: item.quantity,
              originalStock: originalStockValue,
              variantId: matchedVariant._id,
              variantLabel: matchedVariant.label,
            });
          } else {
            if ((product as any).stock < item.quantity) {
              throw new Error(
                `Insufficient stock for ${item.name}. Available: ${(product as any).stock}`
              );
            }

            originalStockValue = (product as any).stock;
            (product as any).stock -= item.quantity;
            (product as any).sold = ((product as any).sold || 0) + item.quantity;
            await product.save({ session, validateModifiedOnly: true });

            unitPrice = (product as any).price;
            lineItemName = item.name || (product as any).name;

            const itemWeight = calculateItemWeightKg({
              product: product as unknown as any,
              quantity: item.quantity,
            });
            totalWeightKg += itemWeight;

            validatedItems.push({
              product: (product as any)._id,
              name: lineItemName,
              quantity: item.quantity,
              price: unitPrice,
            });

            productUpdates.push({
              productId: (product as any)._id,
              quantity: item.quantity,
              originalStock: originalStockValue,
              variantId: variantSnapshot?.variantId,
              variantLabel: variantSnapshot?.label,
            });
          }

          const itemTotal = unitPrice * item.quantity;
          calculatedTotal += itemTotal;
        }

        if (Math.abs(calculatedTotal - totalPrice) > 0.01) {
          throw new Error('Price mismatch detected');
        }

        const zone = getShippingZone(shippingAddress);
        const shippingResult = calculateOtherProductShipping(zone, totalWeightKg);
        const grandTotal = calculatedTotal + shippingResult.shippingFee;

        const orderData: any = {
          orderItems: validatedItems,
          shippingAddress,
          paymentMethod,
          totalPrice: calculatedTotal,
          totalAmount: grandTotal,
          shippingFee: shippingResult.shippingFee,
          shippingZone: shippingResult.zone,
          shippingWeightKg: shippingResult.totalWeightKg,
          shippingBreakdown: shippingResult.breakdown,
          status: 'pending',
          paymentStatus: 'pending',
          isGuestOrder: isGuestOrder,
        };

        if (isGuestOrder) {
          if (!guestInfo || !guestInfo.name || !guestInfo.phone) {
            throw new Error('Guest information (name and phone) is required');
          }
          orderData.guestInfo = {
            name: guestInfo.name,
            email: guestInfo.email || '',
            phone: guestInfo.phone,
          };
        } else {
          if (!req.user || !req.user._id) {
            throw new Error('User authentication required for logged-in orders');
          }
          orderData.user = req.user._id;
        }

        const order = new Order(orderData);
        const createdOrder = await order.save({ session });

        req.createdOrder = createdOrder as IOrder;
        req.productUpdates = productUpdates;
        req.calculatedTotal = grandTotal;
      });

      const createdOrder = req.createdOrder!;

      const populatedOrder = await Order.findById(createdOrder._id)
        .populate('user', 'name email phone')
        .populate('orderItems.product', 'name image sku');

      if ((populatedOrder as any)?.user) {
        (populatedOrder as any).userInfo = {
          name: (populatedOrder as any).user.name,
          email: (populatedOrder as any).user.email,
          phone: (populatedOrder as any).user.phone,
        };
      } else if ((populatedOrder as any)?.guestInfo) {
        (populatedOrder as any).userInfo = {
          name: (populatedOrder as any).guestInfo.name,
          email: (populatedOrder as any).guestInfo.email,
          phone: (populatedOrder as any).guestInfo.phone,
        };
      }

      logBusiness('ORDER_CREATED', {
        orderId: createdOrder._id,
        userId: isGuestOrder ? 'guest' : req.user!._id.toString(),
        isGuestOrder: isGuestOrder,
        itemCount: orderItems.length,
        totalAmount: req.calculatedTotal || (populatedOrder as any).totalPrice,
        paymentMethod: paymentMethod,
        stockReserved: true,
      });

      for (const update of req.productUpdates || []) {
        await cacheService.del(`product:${update.productId}`);
      }
      if (!isGuestOrder && req.user?._id) {
        await cacheService.delPattern(`user:${req.user._id}:orders:*`);
      }

      logPerformance('createOrder', Date.now() - startTime, {
        itemCount: orderItems.length,
        totalAmount: req.calculatedTotal || (populatedOrder as any).totalPrice,
        transactionUsed: true,
      });

      res.status(201).json({
        success: true,
        message: 'Order created successfully with stock reserved',
        order: populatedOrder,
      });
    } catch (transactionError: any) {
      logger.error('Order creation transaction failed:', transactionError);

      if (transactionError.message?.includes('Insufficient stock')) {
        res.status(400).json({
          success: false,
          message: transactionError.message,
        });
        return;
      }

      if (transactionError.message?.includes('Product not found')) {
        res.status(404).json({
          success: false,
          message: transactionError.message,
        });
        return;
      }

      if (transactionError.message?.includes('not available')) {
        res.status(400).json({
          success: false,
          message: transactionError.message,
        });
        return;
      }

      if (transactionError.message?.includes('Price mismatch')) {
        res.status(400).json({
          success: false,
          message: transactionError.message,
        });
        return;
      }

      throw transactionError;
    } finally {
      await session.endSession();
    }
  } catch (error: any) {
    logger.error('Create order error:', error);
    logger.error('Error stack:', error.stack);
    logger.error('Request body:', JSON.stringify(req.body, null, 2));
    logger.error('User:', req.user ? req.user._id : 'guest');

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getShippingQuote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { orderItems, shippingAddress, shippingZone } = req.body;

    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Order items are required to calculate shipping',
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

    // Validate order items structure
    const validOrderItems = orderItems.filter((item: any) => 
      item && item.product && (typeof item.quantity === 'number' && item.quantity > 0)
    );

    if (validOrderItems.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Valid order items with products and quantities are required',
      });
      return;
    }

    const productIds = validOrderItems.map((item: any) => item.product).filter(Boolean);
    
    if (productIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'At least one valid product ID is required',
      });
      return;
    }

    // Check both Product and FishProduct models
    const [regularProducts, fishProducts] = await Promise.all([
      Product.find({ _id: { $in: productIds } }).lean(),
      FishProduct.find({ _id: { $in: productIds } }).lean(),
    ]);

    // Convert fish products to regular product format for compatibility
    const convertedFishProducts = fishProducts.map((fp: any) => {
      const defaultSizeCat = fp.sizeCategories?.find((sc: any) => sc.isDefault) || fp.sizeCategories?.[0];
      const totalStock = fp.sizeCategories?.reduce((sum: number, sc: any) => sum + (sc.stock || 0), 0) || 0;
      const minPrice = fp.sizeCategories?.length > 0 
        ? Math.min(...fp.sizeCategories.map((sc: any) => sc.pricePerKg))
        : 0;
      const maxPrice = fp.sizeCategories?.length > 0
        ? Math.max(...fp.sizeCategories.map((sc: any) => sc.pricePerKg))
        : 0;

      return {
        ...fp,
        _id: fp._id,
        price: defaultSizeCat?.pricePerKg || minPrice,
        stock: totalStock,
        measurement: 1,
        unit: 'kg',
        images: fp.image ? [fp.image] : [],
        hasVariants: (fp.sizeCategories?.length || 0) > 1,
        variants: fp.sizeCategories?.map((sc: any) => ({
          _id: sc._id,
          label: sc.label,
          price: sc.pricePerKg,
          stock: sc.stock || 0,
          measurement: 1,
          unit: 'kg',
          status: sc.status,
          isDefault: sc.isDefault,
        })) || [],
        priceRange: { min: minPrice, max: maxPrice },
        isFishProduct: true,
      };
    });

    // Combine regular and fish products
    // Remove duplicates (in case a product ID exists in both collections, prioritize regular product)
    const productMap = new Map<string, any>();
    regularProducts.forEach((p: any) => {
      productMap.set(p._id.toString(), p);
    });
    convertedFishProducts.forEach((p: any) => {
      // Only add if not already in map (regular products take priority)
      if (!productMap.has(p._id.toString())) {
        productMap.set(p._id.toString(), p);
      }
    });
    const products = Array.from(productMap.values());
    
    if (products.length !== productIds.length) {
      res.status(400).json({
        success: false,
        message: 'One or more products not found',
      });
      return;
    }

    let totalWeightKg = 0;

    for (const item of validOrderItems) {
      const productKey = String(item.product);
      const product = productMap.get(productKey);
      
      if (!product) {
        res.status(400).json({
          success: false,
          message: `Product not found: ${item.product}`,
        });
        return;
      }

      if ((product as any).status !== 'active') {
        res.status(400).json({
          success: false,
          message: `Product ${(product as any).name} is not available`,
        });
        return;
      }

      // Validate quantity (for fish products, quantity is weight in kg, so allow decimals)
      const quantity = Number(item.quantity);
      const isFishProduct = (product as any).isFishProduct === true;
      
      if (!quantity || quantity <= 0) {
        res.status(400).json({
          success: false,
          message: `Invalid quantity for product ${(product as any).name}`,
        });
        return;
      }

      // For regular products, quantity should be integer
      if (!isFishProduct && !Number.isInteger(quantity)) {
        res.status(400).json({
          success: false,
          message: `Quantity must be a whole number for product ${(product as any).name}`,
        });
        return;
      }

      let variant: any = null;

      if (isFishProduct) {
        // Handle fish products with sizeCategories
        const sizeCategories = (product as any).sizeCategories || [];
        if (sizeCategories.length > 0) {
          if (item.variantId) {
            variant = sizeCategories.find(
              (sc: any) => String(sc._id) === String(item.variantId)
            ) || null;
          } else {
            variant = sizeCategories.find((sc: any) => sc.isDefault) || sizeCategories[0] || null;
          }

          if (!variant) {
            res.status(400).json({
              success: false,
              message: `Size category not found for product ${(product as any).name}`,
            });
            return;
          }
        }
      } else if ((product as any).hasVariants && Array.isArray((product as any).variants) && (product as any).variants.length > 0) {
        // Handle regular products with variants
        if (item.variantId) {
          variant = (product as any).variants.find(
            (variantItem: any) => String(variantItem._id) === String(item.variantId)
          ) || null;
        } else {
          variant = (product as any).variants.find((v: any) => v.isDefault) || null;
        }

        if (!variant && (product as any).hasVariants) {
          res.status(400).json({
            success: false,
            message: `Variant not found for product ${(product as any).name}`,
          });
          return;
        }
      }

      // Calculate weight - for fish products, quantity is already in kg
      let weight: number;
      if (isFishProduct) {
        // For fish products, quantity is the weight in kg
        weight = quantity;
      } else {
        // For regular products, use the weight calculation function
        weight = calculateItemWeightKg({
          product: product as any,
          variant,
          quantity,
        });
      }
      totalWeightKg += weight;
    }

    // Validate and use provided zone - zone selection is mandatory, no auto-detection
    if (typeof shippingZone !== 'string' || (shippingZone !== 'inside_dhaka' && shippingZone !== 'outside_dhaka')) {
      res.status(400).json({
        success: false,
        message: 'Valid shipping zone (inside_dhaka or outside_dhaka) is required',
      });
      return;
    }
    const zone: 'inside_dhaka' | 'outside_dhaka' = shippingZone;

    // Separate fish products from regular products for shipping calculation
    let regularProductWeight = 0;
    let hasFishProducts = false;
    
    for (const item of validOrderItems) {
      const productKey = String(item.product);
      const product = productMap.get(productKey);
      if (product && (product as any).isFishProduct === true) {
        hasFishProducts = true;
        // Fish products don't contribute to weight-based shipping calculation
        // They use flat fee shipping calculated on backend
      } else {
        // Calculate weight for regular products only
        const quantity = Number(item.quantity);
        let variant: any = null;
        if ((product as any).hasVariants && Array.isArray((product as any).variants) && (product as any).variants.length > 0) {
          if (item.variantId) {
            variant = (product as any).variants.find(
              (variantItem: any) => String(variantItem._id) === String(item.variantId)
            ) || null;
          } else {
            variant = (product as any).variants.find((v: any) => v.isDefault) || null;
          }
        }
        const weight = calculateItemWeightKg({
          product: product as any,
          variant,
          quantity,
        });
        regularProductWeight += weight;
      }
    }

    // Calculate shipping separately for regular and fish products
    const regularShipping = calculateOtherProductShipping(zone, regularProductWeight);
    const fishShipping = hasFishProducts ? calculateFishShipping(zone) : null;
    
    // Combine shipping fees for display
    // Note: Fish orders will calculate their own shipping on backend, this is just for quote
    const totalShippingFee = regularShipping.shippingFee + (fishShipping?.shippingFee || 0);

    res.json({
      success: true,
      shippingFee: totalShippingFee,
      totalWeightKg: totalWeightKg,
      zone: zone,
      breakdown: {
        regularShippingFee: regularShipping.shippingFee,
        fishShippingFee: fishShipping?.shippingFee || 0,
        regularBreakdown: regularShipping.breakdown,
        fishBreakdown: fishShipping?.breakdown || null,
        totalFee: totalShippingFee,
      },
    });
  } catch (error: any) {
    logger.error('Shipping quote error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to calculate shipping',
    });
  }
};

export const getAllOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  const startTime = Date.now();
  const {
    page = 1,
    limit = 20,
    status,
    paymentStatus,
    sort = 'createdAt',
    order = 'desc',
    search,
  } = req.query;

  try {
    const query: any = {};
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (search) {
      query.$or = [
        { 'orderItems.name': { $regex: search, $options: 'i' } },
        { 'shippingAddress.district': { $regex: search, $options: 'i' } },
      ];
    }

    const sortObj: any = {};
    sortObj[sort as string] = order === 'desc' ? -1 : 1;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const totalOrders = await Order.countDocuments(query);

    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .populate('orderItems.product', 'name image sku')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit as string));

    const ordersWithUserInfo = orders.map((order) => {
      const orderObj = (order as any).toObject ? (order as any).toObject() : order;
      if (orderObj.user) {
        orderObj.userInfo = {
          name: orderObj.user.name,
          email: orderObj.user.email,
          phone: orderObj.user.phone,
        };
      } else if (orderObj.guestInfo) {
        orderObj.userInfo = {
          name: orderObj.guestInfo.name,
          email: orderObj.guestInfo.email || '',
          phone: orderObj.guestInfo.phone,
        };
      }
      return orderObj;
    });

    const result = {
      orders: ordersWithUserInfo,
      pagination: {
        currentPage: parseInt(page as string),
        totalPages: Math.ceil(totalOrders / parseInt(limit as string)),
        totalOrders,
        hasNext: skip + orders.length < totalOrders,
        hasPrev: parseInt(page as string) > 1,
      },
    };

    logPerformance('getAllOrders', Date.now() - startTime, {
      source: 'database',
      count: orders.length,
    });

    res.json(result);
  } catch (error: any) {
    logger.error('Get all orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getUserOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  const startTime = Date.now();
  const { page = 1, limit = 10, status } = req.query;

  try {
    if (!req.user?._id) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const cacheKey = cacheService.generateKey(
      'user',
      req.user._id.toString(),
      'orders',
      `page:${page}`,
      `limit:${limit}`,
      `status:${status || 'all'}`
    );

    const cachedOrders = await cacheService.get(cacheKey);
    if (cachedOrders) {
      logPerformance('getUserOrders', Date.now() - startTime, { source: 'cache' });
      res.json(cachedOrders);
      return;
    }

    const query: any = { user: req.user._id };
    if (status) query.status = status;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const totalOrders = await Order.countDocuments(query);

    const orders = await Order.find(query)
      .populate('orderItems.product', 'name image sku')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit as string));

    const result = {
      orders,
      pagination: {
        currentPage: parseInt(page as string),
        totalPages: Math.ceil(totalOrders / parseInt(limit as string)),
        totalOrders,
        hasNext: skip + orders.length < totalOrders,
        hasPrev: parseInt(page as string) > 1,
      },
    };

    logPerformance('getUserOrders', Date.now() - startTime, {
      source: 'database',
      count: orders.length,
    });

    res.json(result);
  } catch (error: any) {
    logger.error('Get user orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
  const startTime = Date.now();

  try {
    if (!req.user?._id) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const cacheKey = cacheService.generateKey('order', req.params.id);

    const cachedOrder = await cacheService.get(cacheKey);
    if (cachedOrder) {
      logPerformance('getOrderById', Date.now() - startTime, { source: 'cache' });
      res.json({ success: true, order: cachedOrder });
      return;
    }

    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone addresses')
      .populate('orderItems.product', 'name image sku description');

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    if (
      (order as any).user?._id?.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin' &&
      req.user.role !== 'super_admin'
    ) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    await cacheService.set(cacheKey, order, 600);

    logPerformance('getOrderById', Date.now() - startTime, { source: 'database' });

    res.json({
      success: true,
      order,
    });
  } catch (error: any) {
    logger.error('Get order by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

  if (!validStatuses.includes(status)) {
    res.status(400).json({
      success: false,
      message: 'Invalid status',
    });
    return;
  }

  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    const oldStatus = (order as any).status;
    (order as any).status = status;

    if (status === 'delivered') {
      (order as any).isDelivered = true;
      (order as any).deliveredAt = new Date();
    }

    await order.save();

    await cacheService.delPattern('orders:*');
    await cacheService.delPattern(`user:${(order as any).user}:orders:*`);
    await cacheService.del(`order:${req.params.id}`);

    logBusiness('ORDER_STATUS_UPDATED', {
      orderId: (order as any)._id,
      oldStatus,
      newStatus: status,
      updatedBy: req.user?._id?.toString() || 'unknown',
    });

    logger.info(`Order status updated: ${req.params.id} - ${oldStatus} → ${status}`);

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order,
    });
  } catch (error: any) {
    logger.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const cancelOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?._id) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    if ((order as any).user?.toString() !== req.user._id.toString()) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    if (['shipped', 'delivered', 'cancelled'].includes((order as any).status)) {
      res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage',
      });
      return;
    }

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        (order as any).status = 'cancelled';
        (order as any).paymentStatus = 'cancelled';
        await order.save({ session });

        for (const item of (order as any).orderItems) {
          await restoreProductInventory({
            productId: item.product,
            quantity: item.quantity,
            variantSnapshot: item.variant,
            session,
          });
        }
      });

      for (const item of (order as any).orderItems) {
        await cacheService.del(`product:${item.product}`);
      }
      await cacheService.delPattern('orders:*');
      await cacheService.delPattern(`user:${req.user._id}:orders:*`);
      await cacheService.del(`order:${req.params.id}`);

      logBusiness('ORDER_CANCELLED', {
        orderId: (order as any)._id,
        userId: req.user._id.toString(),
        amount: (order as any).totalAmount,
        stockRestored: true,
      });

      logger.info(`Order cancelled: ${req.params.id} by user ${req.user._id} - Stock restored`);

      res.json({
        success: true,
        message: 'Order cancelled successfully and stock restored',
        order,
      });
    } catch (transactionError: any) {
      logger.error('Order cancellation transaction failed:', transactionError);
      throw transactionError;
    } finally {
      await session.endSession();
    }
  } catch (error: any) {
    logger.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getOrderStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
          confirmedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] },
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
          },
          codOrders: {
            $sum: { $cond: [{ $eq: ['$paymentMethod', 'Cash on Delivery'] }, 1, 0] },
          },
        },
      },
    ]);

    const result = stats[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      pendingOrders: 0,
      confirmedOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
      codOrders: 0,
    };

    res.json({
      success: true,
      stats: result,
    });
  } catch (error: any) {
    logger.error('Get order stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

