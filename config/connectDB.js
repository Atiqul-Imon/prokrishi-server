import mongoose from "mongoose";
import dotenv from "dotenv";
import { createIndexes } from "./indexes.js";
import logger from "../services/logger.js";

dotenv.config();

if (!process.env.MONGODB_URI) {
  throw new Error("Please provide MONGODB_URI in the .env file");
}

async function connectDB() {
  try {
    // Enhanced connection options
    const options = {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    };

    await mongoose.connect(process.env.MONGODB_URI, options);
    
    logger.info("✅ MongoDB connected successfully");
    
    // Create indexes for optimal performance
    await createIndexes();
    
    // Connection event listeners
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

  } catch (error) {
    logger.error("MongoDB connection error:", error);
    process.exit(1);
  }
}

export default connectDB;