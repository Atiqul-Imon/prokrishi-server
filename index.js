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

// Security and performance imports
import { 
  securityHeaders, 
  apiRateLimit, 
  authRateLimit, 
  strictRateLimit,
  sanitizeInput,
  requestLogger 
} from "./middlewares/security.js";
import logger, { logRequest, logError } from "./services/logger.js";
import cacheService from "./services/cache.js";

const app = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security headers (must be first)
app.use(securityHeaders);

// Compression middleware
app.use(compression());

// CORS configuration
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : [process.env.FRONTEND_URL || "http://localhost:3000"];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
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

// Rate limiting
app.use('/api/', apiRateLimit);

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
app.use("/api/user", authRateLimit, userRouter);
app.use("/api/product", productRouter);
app.use("/api/category", categoryRouter);
app.use("/api/cart", strictRateLimit, cartRouter);
app.use("/api/order", strictRateLimit, orderRouter);
app.use("/api/payment", strictRateLimit, paymentRouter);
app.use("/api/dashboard", strictRateLimit, dashboardRoutes);

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
    logger.info(`📊 Cache service: ${cacheService.redis.status}`);
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
