import Redis from 'ioredis';

class CacheService {
  constructor() {
    // Initialize Redis with error handling
    try {
      // Skip Redis in production if no Redis URL is provided
      if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL && !process.env.REDIS_HOST) {
        console.log('⚠️ Redis not configured for production, running without cache');
        this.redis = null;
      } else {
        this.redis = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD,
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          maxRetriesPerRequest: null,
          // Connection pooling optimization
          family: 4,
          keepAlive: true,
        });
      }

      // Handle Redis connection errors only if Redis is initialized
      if (this.redis) {
        this.redis.on('error', (err) => {
          console.warn('Redis connection error:', err.message);
          this.redis = null; // Disable Redis on error
        });

        this.redis.on('connect', () => {
          console.log('✅ Redis connected successfully');
        });
      }
    } catch (error) {
      console.warn('Redis initialization failed:', error.message);
      this.redis = null; // Disable Redis on error
    }

    // Multi-layer cache configuration
    this.layers = {
      L1: { ttl: 60, maxSize: 1000 },      // Hot data - 1 minute
      L2: { ttl: 300, maxSize: 5000 },     // Warm data - 5 minutes  
      L3: { ttl: 1800, maxSize: 10000 }    // Cold data - 30 minutes
    };

    // Cache statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };

    // Add method to check Redis availability
    this.isRedisAvailable = () => {
      return this.redis && this.redis.status === 'ready';
    };

    this.redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });
  }

  // Set cache with TTL and layer optimization
  async set(key, value, ttl = 3600, layer = 'L2') {
    try {
      if (!this.redis) {
        console.warn('Redis not available, skipping cache set');
        return false;
      }
      
      const serializedValue = JSON.stringify(value);
      const layerConfig = this.layers[layer];
      const finalTtl = layerConfig ? layerConfig.ttl : ttl;
      
      await this.redis.setex(key, finalTtl, serializedValue);
      this.stats.sets++;
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  // Get cache with statistics tracking
  async get(key) {
    try {
      if (!this.redis) {
        console.warn('Redis not available, skipping cache get');
        this.stats.misses++;
        return null;
      }
      
      const value = await this.redis.get(key);
      if (value) {
        this.stats.hits++;
        return JSON.parse(value);
      } else {
        this.stats.misses++;
        return null;
      }
    } catch (error) {
      console.error('Cache get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  // Delete cache
  async del(key) {
    try {
      if (!this.redis) {
        console.warn('Redis not available, skipping cache delete');
        return false;
      }
      
      await this.redis.del(key);
      this.stats.deletes++;
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  // Delete multiple keys
  async delPattern(pattern) {
    try {
      if (!this.redis) {
        console.warn('Redis not available, skipping cache delete pattern');
        return false;
      }
      
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
      if (!this.redis) {
        console.warn('Redis not available, skipping cache exists check');
        return false;
      }
      
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
        connected: this.redis.status === 'ready',
        performance: {
          hits: this.stats.hits,
          misses: this.stats.misses,
          sets: this.stats.sets,
          deletes: this.stats.deletes,
          hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) * 100
        }
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return null;
    }
  }

  // Multi-layer cache warming
  async warmCache() {
    console.log('🔥 Warming cache with critical data...');
    
    try {
      const criticalData = [
        { key: 'featured_products', layer: 'L1', ttl: 60 },
        { key: 'categories', layer: 'L2', ttl: 300 },
        { key: 'popular_products', layer: 'L1', ttl: 60 },
        { key: 'dashboard_stats', layer: 'L3', ttl: 1800 }
      ];

      for (const { key, layer, ttl } of criticalData) {
        try {
          // This would typically fetch from your actual services
          const data = { preloaded: true, timestamp: Date.now() };
          await this.set(key, data, ttl, layer);
          console.log(`✅ Warmed cache for: ${key} (${layer})`);
        } catch (error) {
          console.error(`❌ Failed to warm cache for: ${key}`, error);
        }
      }
      
      console.log('🎉 Cache warming completed');
    } catch (error) {
      console.error('Cache warming failed:', error);
    }
  }

  // Intelligent cache invalidation
  async invalidateRelated(key) {
    const patterns = {
      'products': ['products:*', 'featured_products', 'popular_products'],
      'categories': ['categories:*', 'featured_categories'],
      'orders': ['orders:*', 'dashboard_stats', 'user_orders:*'],
      'users': ['user:*', 'dashboard_stats']
    };

    for (const [prefix, relatedKeys] of Object.entries(patterns)) {
      if (key.includes(prefix)) {
        // Delete related cache entries
        for (const pattern of relatedKeys) {
          try {
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
              await this.redis.del(...keys);
              this.stats.deletes += keys.length;
            }
          } catch (error) {
            console.error(`Failed to invalidate pattern ${pattern}:`, error);
          }
        }
      }
    }
  }

  // Cache compression for large data
  async setCompressed(key, data, ttl = 3600) {
    try {
      const compressed = JSON.stringify(data);
      // Use compression for large data (>1KB)
      if (compressed.length > 1024) {
        const zlib = await import('zlib');
        const compressedData = zlib.gzipSync(compressed);
        await this.redis.setex(key, ttl, compressedData);
      } else {
        await this.redis.setex(key, ttl, compressed);
      }
      this.stats.sets++;
    } catch (error) {
      console.error(`Cache compression error for key ${key}:`, error);
    }
  }

  async getCompressed(key) {
    try {
      const data = await this.redis.get(key);
      if (!data) return null;

      // Try to decompress if it's compressed
      try {
        const zlib = await import('zlib');
        const decompressed = zlib.gunzipSync(Buffer.from(data, 'binary'));
        this.stats.hits++;
        return JSON.parse(decompressed.toString());
      } catch {
        // If decompression fails, try parsing as regular JSON
        this.stats.hits++;
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`Cache decompression error for key ${key}:`, error);
      this.stats.misses++;
      return null;
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

export default cacheService;
