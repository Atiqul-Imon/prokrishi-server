import { Document, Types } from 'mongoose';
import { Request } from 'express';

// Address Interface
export interface IAddress {
  name: string;
  phone: string;
  division?: string;
  district?: string;
  upazila?: string;
  postalCode?: string;
  address: string;
  _id?: Types.ObjectId;
}

// User Interface
export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email?: string;
  phone: string;
  password: string;
  role: 'user' | 'admin' | 'super_admin';
  isVerified: boolean;
  addresses: IAddress[];
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  phoneOtp?: string;
  phoneOtpExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
  matchPassword(enteredPassword: string): Promise<boolean>;
}

// Product Interface
export interface IProductVariant {
  _id: Types.ObjectId;
  label: string;
  sku?: string;
  barcode?: string;
  price: number;
  salePrice?: number;
  stock: number;
  measurement?: number;
  unit?: string;
  status: 'active' | 'inactive' | 'out_of_stock';
  isDefault?: boolean;
  image?: string;
  attributes?: Record<string, string>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IVariantSnapshot {
  variantId: Types.ObjectId;
  label: string;
  sku?: string;
  price: number;
  salePrice?: number;
  measurement?: number;
  unit?: string;
  image?: string;
}

export interface IProduct extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  shortDescription?: string;
  price: number;
  stock: number;
  lowStockThreshold?: number;
  category: Types.ObjectId | ICategory;
  image?: string;
  images?: string[];
  sku?: string;
  unit: string;
  measurement?: number;
  measurementIncrement?: number;
  specifications?: Record<string, string>;
  views: number;
  sold: number;
  rating: number;
  reviewCount: number;
  isFeatured?: boolean;
  status?: string;
  tags?: string[];
  metaTitle?: string;
  metaDescription?: string;
  slug?: string;
  lastViewedAt?: Date;
  variants?: IProductVariant[];
  hasVariants?: boolean;
  defaultVariantId?: Types.ObjectId;
  variantSummary?: {
    totalStock: number;
    minPrice: number;
    maxPrice: number;
    activeCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Category Interface
export interface ICategory extends Document {
  _id: Types.ObjectId;
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  isFeatured?: boolean;
  cloudinary_id?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Cart Item Interface
export interface ICartItem {
  _id?: Types.ObjectId;
  product: Types.ObjectId | IProduct;
  quantity: number;
  price?: number;
  variant?: IVariantSnapshot;
}

// Cart Interface
export interface ICart extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId | IUser;
  items: ICartItem[];
  createdAt: Date;
  updatedAt: Date;
}

// Order Item Interface
export interface IOrderItem {
  product: Types.ObjectId | IProduct;
  name: string;
  quantity: number;
  price: number;
  variant?: IVariantSnapshot;
}

// Shipping Address Interface
export interface IShippingAddress {
  name?: string;
  phone?: string;
  address: string;
  division?: string;
  district?: string;
  upazila?: string;
  postalCode?: string;
}

// Order Interface
export interface IOrder extends Document {
  _id: Types.ObjectId;
  user?: Types.ObjectId | IUser;
  guestInfo?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  isGuestOrder?: boolean;
  orderItems: IOrderItem[];
  shippingAddress: IShippingAddress;
  paymentMethod: string;
  paymentResult?: {
    id?: string;
    status?: string;
    update_time?: string;
    email_address?: string;
  };
  totalPrice: number;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'completed' | 'failed' | 'cancelled';
  transactionId?: string;
  paymentDetails?: {
    transactionId?: string;
    validationId?: string;
    amount?: number;
    currency?: string;
    paymentDate?: Date;
    error?: string;
    failedDate?: Date;
    cancelledDate?: Date;
  };
  isPaid: boolean;
  paidAt?: Date;
  isDelivered: boolean;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Express Request with User
export interface AuthRequest extends Request {
  user?: IUser;
  calculatedTotal?: number;
  createdOrder?: IOrder;
  productUpdates?: Array<{
    productId: any;
    quantity: number;
    originalStock: number;
    variantId?: Types.ObjectId;
    variantLabel?: string;
  }>;
}

// JWT Payload
export interface JWTPayload {
  userId: string;
  role: string;
}

// Fish Product Interfaces
export interface IFishSizeCategory {
  _id?: Types.ObjectId;
  label: string;
  pricePerKg: number;
  minWeight?: number;
  maxWeight?: number;
  sku?: string;
  status: 'active' | 'inactive' | 'out_of_stock';
  isDefault?: boolean;
}

export interface IFishProduct extends Document {
  _id: Types.ObjectId;
  name: string;
  sku?: string;
  category: Types.ObjectId;
  description?: string;
  shortDescription?: string;
  image?: string;
  sizeCategories: IFishSizeCategory[];
  status: 'active' | 'inactive';
  isFeatured: boolean;
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  tags?: string[];
  views?: number;
  lastViewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFishInventory extends Document {
  _id: Types.ObjectId;
  fishProduct: Types.ObjectId;
  sizeCategoryId: Types.ObjectId;
  actualWeight: number;
  status: 'available' | 'reserved' | 'sold' | 'expired' | 'damaged';
  purchaseDate?: Date;
  expiryDate?: Date;
  location?: string;
  costPrice?: number;
  reservedForOrder?: Types.ObjectId;
  soldToOrder?: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFishOrderItem {
  _id?: Types.ObjectId;
  fishProduct: Types.ObjectId;
  fishProductName: string;
  sizeCategoryId: Types.ObjectId;
  sizeCategoryLabel: string;
  requestedWeight: number;
  actualWeight?: number;
  pricePerKg: number;
  totalPrice: number;
  inventoryItems: Types.ObjectId[];
  notes?: string;
}

export interface IFishOrder extends Document {
  _id: Types.ObjectId;
  user?: Types.ObjectId;
  guestInfo?: {
    name: string;
    email?: string;
    phone: string;
  };
  isGuestOrder: boolean;
  orderItems: IFishOrderItem[];
  shippingAddress: {
    name: string;
    phone: string;
    address: string;
    division?: string;
    district?: string;
    upazila?: string;
    postalCode?: string;
  };
  paymentMethod: string;
  totalPrice: number;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'processing' | 'prepared' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'completed' | 'failed' | 'cancelled';
  orderNumber?: string;
  notes?: string;
  cancelledAt?: Date;
  cancellationReason?: string;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

