import Redis from 'ioredis';

class CacheService {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });

    this.redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    this.redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });
  }

  // Set cache with TTL
  async set(key, value, ttl = 3600) {
    try {
      const serializedValue = JSON.stringify(value);
      await this.redis.setex(key, ttl, serializedValue);
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  // Get cache
  async get(key) {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  // Delete cache
  async del(key) {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  // Delete multiple keys
  async delPattern(pattern) {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return true;
    } catch (error) {
      console.error('Cache delete pattern error:', error);
      return false;
    }
  }

  // Check if key exists
  async exists(key) {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  // Set cache with expiration
  async setWithExpiry(key, value, ttl) {
    return this.set(key, value, ttl);
  }

  // Get or set cache (cache-aside pattern)
  async getOrSet(key, fetchFunction, ttl = 3600) {
    try {
      // Try to get from cache first
      let value = await this.get(key);
      
      if (value === null) {
        // If not in cache, fetch from source
        value = await fetchFunction();
        
        // Store in cache
        if (value !== null) {
          await this.set(key, value, ttl);
        }
      }
      
      return value;
    } catch (error) {
      console.error('Cache getOrSet error:', error);
      // If cache fails, try to fetch from source
      try {
        return await fetchFunction();
      } catch (fetchError) {
        console.error('Fetch function error:', fetchError);
        throw fetchError;
      }
    }
  }

  // Cache key generators
  generateKey(prefix, ...parts) {
    return `${prefix}:${parts.join(':')}`;
  }

  // Common cache keys
  keys = {
    PRODUCT: (id) => `product:${id}`,
    PRODUCTS: (filters = '') => `products:${filters}`,
    CATEGORY: (id) => `category:${id}`,
    CATEGORIES: () => 'categories:all',
    USER: (id) => `user:${id}`,
    DASHBOARD_STATS: () => 'dashboard:stats',
    FEATURED_PRODUCTS: () => 'products:featured',
    POPULAR_PRODUCTS: () => 'products:popular',
  };

  // Clear all cache
  async clearAll() {
    try {
      await this.redis.flushall();
      return true;
    } catch (error) {
      console.error('Cache clear all error:', error);
      return false;
    }
  }

  // Get cache statistics
  async getStats() {
    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      
      return {
        memory: info,
        keyspace: keyspace,
        connected: this.redis.status === 'ready'
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return null;
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

export default cacheService;
