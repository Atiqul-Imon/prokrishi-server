import ImageKit from 'imagekit';
import logger from '../services/logger.js';

// ImageKit configuration with proper error handling
let imagekit = null;

export const initializeImageKit = () => {
  try {
    if (process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT) {
      imagekit = new ImageKit({
        publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
        privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
        urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
      });
      logger.info('✅ ImageKit initialized successfully');
      return true;
    } else {
      logger.warn('⚠️ ImageKit not configured - image features will be disabled');
      logger.warn('Required environment variables: IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT');
      return false;
    }
  } catch (error) {
    logger.error('❌ ImageKit initialization failed:', error);
    return false;
  }
};

export const getImageKit = () => {
  if (!imagekit) {
    throw new Error('ImageKit not initialized. Please check your environment variables.');
  }
  return imagekit;
};

export const isImageKitAvailable = () => {
  return imagekit !== null;
};

// Initialize ImageKit on module load
initializeImageKit();

export default imagekit;
