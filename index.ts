import 'dotenv/config';
import express, { Request, Response, ErrorRequestHandler } from 'express';
import connectDB from './config/connectDB.js';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import cors from 'cors';
import compression from 'compression';
import userRouter from './routes/user.route.js';
import productRouter from './routes/product.route.js';
import categoryRouter from './routes/category.route.js';
import cartRouter from './routes/cart.route.js';
import orderRouter from './routes/order.route.js';
import paymentRouter from './routes/payment.route.js';
import dashboardRoutes from './routes/dashboard.route.js';
import adminOrderRouter from './routes/adminOrder.route.js';
import mediaRouter from './routes/media.route.js';

import {
  securityHeaders,
  authRateLimit,
  adminRateLimit,
  profileRateLimit,
  sanitizeInput,
  requestLogger,
} from './middlewares/security.js';
import logger, { logError } from './services/logger.js';
import cacheService from './services/cache.js';
import { notFoundHandler, apiNotFoundHandler } from './middlewares/notFound.js';

const app = express();

app.set('trust proxy', 1);

app.use(securityHeaders);
app.use(compression());

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : [process.env.FRONTEND_URL || 'http://localhost:3000'];

const productionOrigins = ['https://prokrishihub.com', 'https://www.prokrishihub.com'];

const allAllowedOrigins = [...allowedOrigins, ...productionOrigins];

console.log('🌐 CORS Allowed Origins:', allAllowedOrigins);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) {
        console.log('✅ CORS: Allowing request with no origin');
        return callback(null, true);
      }

      console.log('🔍 CORS: Checking origin:', origin);

      if (allAllowedOrigins.includes(origin)) {
        console.log('✅ CORS: Origin allowed:', origin);
        return callback(null, true);
      }

      if (allAllowedOrigins.includes('*') || process.env.NODE_ENV === 'development') {
        console.log('✅ CORS: Wildcard or development mode');
        return callback(null, true);
      }

      console.log('❌ CORS: Origin not allowed:', origin);
      console.log('📋 CORS: Allowed origins:', allAllowedOrigins);
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'Accept',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
    ],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    optionsSuccessStatus: 200,
    preflightContinue: false,
  })
);

app.use(requestLogger);

app.use(
  morgan('combined', {
    stream: {
      write: (message: string) => logger.http(message.trim()),
    },
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use(sanitizeInput);

app.get('/health', async (_req: Request, res: Response) => {
  const cacheStats = await cacheService.getStats();
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    cache: cacheStats?.connected ? 'Connected' : 'Disconnected',
    environment: process.env.NODE_ENV || 'development',
  });
});

app.use('/api/user/login', authRateLimit);
app.use('/api/user/register', authRateLimit);
app.use('/api/user/forgot-password', authRateLimit);
app.use('/api/user/reset-password-email', authRateLimit);
app.use('/api/user/reset-password-phone', authRateLimit);

app.use('/api/user/profile', profileRateLimit);

app.use('/api/product', adminRateLimit, productRouter);
app.use('/api/category', adminRateLimit, categoryRouter);
app.use('/api/dashboard', adminRateLimit, dashboardRoutes);
app.use('/api/admin/orders', adminRateLimit, adminOrderRouter);
app.use('/api/media', adminRateLimit, mediaRouter);

app.use('/api/user', userRouter);
app.use('/api/cart', cartRouter);
app.use('/api/order', orderRouter);
app.use('/api/payment', paymentRouter);

const corsErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (err.message && err.message.includes('CORS')) {
    console.error('🚨 CORS Error:', err.message);
    console.error('🚨 Request Origin:', req.get('Origin'));
    console.error('🚨 Request Headers:', req.headers);

    res.status(403).json({
      success: false,
      error: true,
      message: 'CORS policy violation',
      details: {
        origin: req.get('Origin'),
        allowedOrigins: allAllowedOrigins,
        error: err.message,
      },
    });
    return;
  }
  next(err);
};

app.use(corsErrorHandler);

app.use('/api/*', apiNotFoundHandler);
app.use('*', notFoundHandler);

const PORT = process.env.PORT || 3500;

const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  logError(err, req);

  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status((err as any).status || 500).json({
    error: true,
    message: isDevelopment ? err.message : 'Something went wrong!',
    success: false,
    ...(isDevelopment && { stack: err.stack }),
  });
};

app.use(errorHandler);

app.use('*', (_req: Request, res: Response) => {
  res.status(404).json({
    error: true,
    message: 'Route not found',
    success: false,
  });
});

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      logger.info(`🚀 Server is running on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(
        `📊 Cache service: ${cacheService.isRedisAvailable() ? 'ready' : 'disabled (Redis unavailable)'}`
      );
    });
  })
  .catch((error) => {
    logError(error);
    logger.error('Failed to connect to database:', error);
    process.exit(1);
  });

app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Prokrishi Backend API is running!',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', async (_req: Request, res: Response) => {
  const redisStatus: {
    available: boolean;
    configured: boolean;
    working?: boolean;
    error?: string;
  } = {
    available: cacheService.isRedisAvailable(),
    configured: !!(
      process.env.REDIS_URL ||
      process.env.REDIS_HOST ||
      process.env.UPSTASH_REDIS_REST_HOST
    ),
  };

  if (redisStatus.available) {
    try {
      const testKey = 'health:check';
      await cacheService.set(testKey, { timestamp: Date.now() }, 10);
      const testValue = await cacheService.get(testKey);
      await cacheService.del(testKey);
      redisStatus.working = !!testValue;
    } catch (error: any) {
      redisStatus.working = false;
      redisStatus.error = error.message;
    }
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    redis: redisStatus,
    database: {
      connected: mongoose.connection.readyState === 1,
    },
  });
});

