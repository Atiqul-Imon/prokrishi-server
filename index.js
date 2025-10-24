import 'dotenv/config';
import express from "express";
import connectDB from "./config/connectDB.js";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import cors from "cors";
import compression from "compression";
import userRouter from "./routes/user.route.js";
import productRouter from "./routes/product.route.js";
import categoryRouter from "./routes/category.route.js";
import cartRouter from "./routes/cart.route.js";
import orderRouter from "./routes/order.route.js";
import paymentRouter from "./routes/payment.route.js";
import dashboardRoutes from "./routes/dashboard.route.js";
import adminOrderRouter from "./routes/adminOrder.route.js";
import mediaRouter from "./routes/media.route.js";

// Security and performance imports
import { 
  securityHeaders, 
  apiRateLimit, 
  authRateLimit, 
  strictRateLimit,
  adminRateLimit,
  profileRateLimit,
  sanitizeInput,
  requestLogger 
} from "./middlewares/security.js";
import logger, { logRequest, logError } from "./services/logger.js";
import cacheService from "./services/cache.js";
import { notFoundHandler, apiNotFoundHandler } from "./middlewares/notFound.js";

const app = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security headers (must be first)
app.use(securityHeaders);

// Compression middleware
app.use(compression());

// CORS configuration for production
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : [process.env.FRONTEND_URL || "http://localhost:3000"];

// Add common production domains
const productionOrigins = [
  'https://prokrishihub.com',
  'https://www.prokrishihub.com',
  
];

// Combine all allowed origins
const allAllowedOrigins = [...allowedOrigins, ...productionOrigins];

console.log('🌐 CORS Allowed Origins:', allAllowedOrigins);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) {
      console.log('✅ CORS: Allowing request with no origin');
      return callback(null, true);
    }
    
    console.log('🔍 CORS: Checking origin:', origin);
    
    // Check if origin is in allowed list
    if (allAllowedOrigins.includes(origin)) {
      console.log('✅ CORS: Origin allowed:', origin);
      return callback(null, true);
    }
    
    // Check for wildcard or development
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
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  preflightContinue: false
}));

// Request logging
app.use(requestLogger);

// Morgan logging with custom format
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.http(message.trim())
  }
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Input sanitization
app.use(sanitizeInput);

// Health check endpoint with cache status
app.get("/health", async (req, res) => {
  const cacheStats = await cacheService.getStats();
  res.status(200).json({ 
    status: "OK", 
    message: "Server is running",
    timestamp: new Date().toISOString(),
    cache: cacheStats?.connected ? "Connected" : "Disconnected",
    environment: process.env.NODE_ENV || "development"
  });
});

// API routes with specific rate limiting
// Apply auth rate limit only to login/register endpoints
app.use("/api/user/login", authRateLimit);
app.use("/api/user/register", authRateLimit);
app.use("/api/user/forgot-password", authRateLimit);
app.use("/api/user/reset-password-email", authRateLimit);
app.use("/api/user/reset-password-phone", authRateLimit);

// Apply profile rate limit to profile endpoints
app.use("/api/user/profile", profileRateLimit);

// Apply admin rate limits to admin operations
app.use("/api/product", adminRateLimit, productRouter);
app.use("/api/category", adminRateLimit, categoryRouter);
app.use("/api/dashboard", adminRateLimit, dashboardRoutes);
app.use("/api/admin/orders", adminRateLimit, adminOrderRouter);
app.use("/api/media", adminRateLimit, mediaRouter);

// No rate limiting for user operations
app.use("/api/user", userRouter);
app.use("/api/cart", cartRouter);
app.use("/api/order", orderRouter);
app.use("/api/payment", paymentRouter);

// CORS error handler
app.use((err, req, res, next) => {
  if (err.message && err.message.includes('CORS')) {
    console.error('🚨 CORS Error:', err.message);
    console.error('🚨 Request Origin:', req.get('Origin'));
    console.error('🚨 Request Headers:', req.headers);
    
    return res.status(403).json({
      success: false,
      error: true,
      message: 'CORS policy violation',
      details: {
        origin: req.get('Origin'),
        allowedOrigins: allAllowedOrigins,
        error: err.message
      }
    });
  }
  next(err);
});

// 404 handlers
app.use("/api/*", apiNotFoundHandler);
app.use("*", notFoundHandler);

const PORT = process.env.PORT || 3500;

// Enhanced error handler
app.use((err, req, res, next) => {
  logError(err, req);
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: true,
    message: isDevelopment ? err.message : 'Something went wrong!',
    success: false,
    ...(isDevelopment && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: true,
    message: 'Route not found',
    success: false
  });
});

// Start server
connectDB().then(() => {
  app.listen(PORT, () => {
    logger.info(`🚀 Server is running on port ${PORT}`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`📊 Cache service: ${cacheService.isRedisAvailable() ? 'ready' : 'disabled (Redis unavailable)'}`);
  });
}).catch((error) => {
  logError(error);
  logger.error("Failed to connect to database:", error);
  process.exit(1);
});

app.get("/", (req, res) => {
  res.json({ 
    message: "Prokrishi Backend API is running!",
    version: "2.0.0",
    timestamp: new Date().toISOString()
  });
});
