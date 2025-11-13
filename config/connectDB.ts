import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createIndexes } from './indexes.js';
import logger from '../services/logger.js';

dotenv.config();

if (!process.env.MONGODB_URI) {
  throw new Error('Please provide MONGODB_URI in the .env file');
}

async function connectDB(): Promise<void> {
  try {
    const options: mongoose.ConnectOptions = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(process.env.MONGODB_URI as string, options);

    logger.info('✅ MongoDB connected successfully');

    await createIndexes();

    mongoose.connection.on('error', (err: Error) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

export default connectDB;

