import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import { IUser, AuthRequest, JWTPayload } from '../types/index.js';

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token =
      req.cookies?.accessToken ||
      (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null);

    if (!token) {
      res.status(401).json({
        message: 'Authentication required',
        error: true,
        success: false,
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JWTPayload;

    const user = await User.findById(decoded.userId || (decoded as any).id)
      .select('-password')
      .lean();

    if (!user) {
      res.status(401).json({
        message: 'User account not found',
        error: true,
        success: false,
      });
      return;
    }

    req.user = user as IUser;
    next();
  } catch (error: any) {
    console.error('Auth Error:', error.message);
    res.status(401).json({
      message: 'Invalid or expired token',
      error: true,
      success: false,
    });
  }
};

export const isAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        message: 'Authentication required',
        error: true,
        success: false,
      });
      return;
    }

    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      res.status(403).json({
        message: 'Admin access required',
        error: true,
        success: false,
      });
      return;
    }

    next();
  } catch (error: any) {
    console.error('Admin Check Error:', error.message);
    res.status(500).json({
      message: 'Server error',
      error: true,
      success: false,
    });
  }
};

export const isSuperAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        message: 'Authentication required',
        error: true,
        success: false,
      });
      return;
    }

    if (req.user.role !== 'super_admin') {
      res.status(403).json({
        message: 'Super admin access required',
        error: true,
        success: false,
      });
      return;
    }

    next();
  } catch (error: any) {
    console.error('Super Admin Check Error:', error.message);
    res.status(500).json({
      message: 'Server error',
      error: true,
      success: false,
    });
  }
};

export const authorizeAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      message: 'Authentication required',
      error: true,
      success: false,
    });
    return;
  }

  const allowedRoles = ['admin', 'super_admin'];

  if (!allowedRoles.includes(req.user.role)) {
    res.status(403).json({
      message: 'Admin privileges required',
      error: true,
      success: false,
    });
    return;
  }

  next();
};

