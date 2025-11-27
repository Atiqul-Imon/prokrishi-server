import { Request, Response, NextFunction } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import helmet from 'helmet';
import { validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import logger from '../services/logger.js';
import { JWTPayload } from '../types/index.js';

export const createRateLimit = (
  windowMs: number = 15 * 60 * 1000,
  max: number = 100,
  message: string = 'Too many requests'
): RateLimitRequestHandler => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: true,
      message,
      success: false,
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

export const authRateLimit = createRateLimit(
  15 * 60 * 1000,
  5,
  'Too many authentication attempts, please try again later'
);
export const apiRateLimit = createRateLimit(
  15 * 60 * 1000,
  100,
  'Too many API requests, please try again later'
);
export const strictRateLimit = createRateLimit(
  15 * 60 * 1000,
  10,
  'Too many requests, please try again later'
);
const identifyAdminRequest = (req: Request): boolean => {
  const token =
    req.cookies?.accessToken ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null);

  if (!token || !process.env.JWT_SECRET) {
    return false;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JWTPayload;
    return decoded.role === 'admin' || decoded.role === 'super_admin';
  } catch {
    return false;
  }
};

export const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  skip: (req: Request) => identifyAdminRequest(req),
  message: {
    error: true,
    message: 'Too many admin requests, please try again later',
    success: false,
  },
  standardHeaders: true,
  legacyHeaders: false,
});
export const profileRateLimit = createRateLimit(
  15 * 60 * 1000,
  50,
  'Too many profile requests, please try again later'
);

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'https:', 'https://res.cloudinary.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", 'https://api.sslcommerz.com'],
      frameSrc: ["'self'", 'https://sandbox.sslcommerz.com'],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

export const validateInput = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: true,
      message: 'Validation failed',
      errors: errors.array(),
      success: false,
    });
    return;
  }
  next();
};

const sanitizeString = (str: string): string => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
};

const sanitizeObject = (obj: any): any => {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  } else if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  } else if (obj && typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }
  return obj;
};

export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query) as any;
  }
  if (req.params) {
    req.params = sanitizeObject(req.params) as any;
  }
  next();
};

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
    };

    if (res.statusCode >= 400) {
      logger.warn('HTTP Request:', logData);
    } else {
      logger.info('HTTP Request:', logData);
    }
  });

  next();
};

