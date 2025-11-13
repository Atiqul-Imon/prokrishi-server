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
  product: Types.ObjectId | IProduct;
  quantity: number;
  price?: number;
  _id?: Types.ObjectId;
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
  }>;
}

// JWT Payload
export interface JWTPayload {
  userId: string;
  role: string;
}

