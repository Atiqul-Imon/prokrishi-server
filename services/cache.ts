import Redis from 'ioredis';
import { gzipSync, gunzipSync } from 'zlib';

interface LayerConfig {
  ttl: number;
  maxSize: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
}

interface CacheKeys {
  PRODUCT: (id: string) => string;
  PRODUCTS: (filters?: string) => string;
  CATEGORY: (id: string) => string;
  CATEGORIES: () => string;
  USER: (id: string) => string;
  DASHBOARD_STATS: () => string;
  FEATURED_PRODUCTS: () => string;
  POPULAR_PRODUCTS: () => string;
}

class CacheService {
  private redis: Redis | null = null;
  private layers: Record<string, LayerConfig>;
  private stats: CacheStats;

  public keys: CacheKeys = {
    PRODUCT: (id: string) => `product:${id}`,
    PRODUCTS: (filters: string = '') => `products:${filters}`,
    CATEGORY: (id: string) => `category:${id}`,
    CATEGORIES: () => 'categories:all',
    USER: (id: string) => `user:${id}`,
    DASHBOARD_STATS: () => 'dashboard:stats',
    FEATURED_PRODUCTS: () => 'products:featured',
    POPULAR_PRODUCTS: () => 'products:popular',
  };

  constructor() {
    try {
      if (
        process.env.NODE_ENV === 'production' &&
        !process.env.REDIS_URL &&
        !process.env.REDIS_HOST &&
        !process.env.UPSTASH_REDIS_REST_HOST
      ) {
        console.log('⚠️ Redis not configured for production, running without cache');
        this.redis = null;
      } else {
        const redisConfig = process.env.UPSTASH_REDIS_REST_HOST
          ? {
              host: process.env.UPSTASH_REDIS_REST_HOST,
              port: parseInt(process.env.UPSTASH_REDIS_REST_PORT || '6379'),
              password: process.env.UPSTASH_REDIS_REST_PASSWORD,
              tls: {
                servername: process.env.UPSTASH_REDIS_REST_HOST,
              },
              retryDelayOnFailover: 100,
              enableReadyCheck: false,
              maxRetriesPerRequest: null,
              family: 4,
              keepAlive: 30000,
              lazyConnect: true,
            }
          : {
              host: process.env.REDIS_HOST || 'localhost',
              port: parseInt(process.env.REDIS_PORT || '6379'),
              password: process.env.REDIS_PASSWORD,
              retryDelayOnFailover: 100,
              enableReadyCheck: false,
              maxRetriesPerRequest: null,
              family: 4,
              keepAlive: 30000,
            };

        this.redis = new Redis(redisConfig);
      }

      if (this.redis) {
        this.redis.on('error', (err: Error) => {
          console.warn('Redis connection error:', err.message);
          this.redis = null;
        });

        this.redis.on('connect', () => {
          console.log('✅ Redis connected successfully');
        });
      }
    } catch (error: any) {
      console.warn('Redis initialization failed:', error.message);
      this.redis = null;
    }

    this.layers = {
      L1: { ttl: 30, maxSize: 1000 },
      L2: { ttl: 120, maxSize: 5000 },
      L3: { ttl: 300, maxSize: 10000 },
    };

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
    };
  }

  public isRedisAvailable(): boolean {
    return this.redis !== null && (this.redis.status === 'ready' || this.redis.status === 'connecting');
  }

  public async set(
    key: string,
    value: any,
    ttl: number = 300,
    layer: string = 'L2'
  ): Promise<boolean> {
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

  public async get(key: string): Promise<any> {
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

  public async del(key: string): Promise<boolean> {
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

  public async delPattern(pattern: string): Promise<boolean> {
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

  public async exists(key: string): Promise<boolean> {
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

  public async setWithExpiry(key: string, value: any, ttl: number): Promise<boolean> {
    return this.set(key, value, ttl);
  }

  public async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    ttl: number = 3600
  ): Promise<T | null> {
    try {
      let value = await this.get(key);

      if (value === null) {
        value = await fetchFunction();

        if (value !== null) {
          await this.set(key, value, ttl);
        }
      }

      return value;
    } catch (error) {
      console.error('Cache getOrSet error:', error);
      try {
        return await fetchFunction();
      } catch (fetchError) {
        console.error('Fetch function error:', fetchError);
        throw fetchError;
      }
    }
  }

  public generateKey(prefix: string, ...parts: string[]): string {
    return `${prefix}:${parts.join(':')}`;
  }

  public async clearAll(): Promise<boolean> {
    try {
      if (!this.redis) {
        return false;
      }
      await this.redis.flushall();
      return true;
    } catch (error) {
      console.error('Cache clear all error:', error);
      return false;
    }
  }

  public async getStats(): Promise<{
    memory?: string;
    keyspace?: string;
    connected: boolean;
    performance: {
      hits: number;
      misses: number;
      sets: number;
      deletes: number;
      hitRate: number;
    };
  } | null> {
    try {
      if (!this.redis) {
        return {
          connected: false,
          performance: {
            hits: this.stats.hits,
            misses: this.stats.misses,
            sets: this.stats.sets,
            deletes: this.stats.deletes,
            hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
          },
        };
      }

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
          hitRate: (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 || 0,
        },
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return null;
    }
  }

  public async warmCache(): Promise<void> {
    console.log('🔥 Warming cache with critical data...');

    try {
      const criticalData = [
        { key: 'featured_products', layer: 'L1', ttl: 60 },
        { key: 'categories', layer: 'L2', ttl: 300 },
        { key: 'popular_products', layer: 'L1', ttl: 60 },
        { key: 'dashboard_stats', layer: 'L3', ttl: 1800 },
      ];

      for (const { key, layer, ttl } of criticalData) {
        try {
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

  public async invalidateRelated(key: string): Promise<void> {
    const patterns: Record<string, string[]> = {
      products: ['products:*', 'featured_products', 'popular_products'],
      categories: ['categories:*', 'featured_categories'],
      orders: ['orders:*', 'dashboard_stats', 'user_orders:*'],
      users: ['user:*', 'dashboard_stats'],
    };

    for (const [prefix, relatedKeys] of Object.entries(patterns)) {
      if (key.includes(prefix)) {
        for (const pattern of relatedKeys) {
          try {
            if (!this.redis) continue;
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

  public async setCompressed(key: string, data: any, ttl: number = 3600): Promise<void> {
    try {
      if (!this.redis) {
        return;
      }
      const compressed = JSON.stringify(data);
      if (compressed.length > 1024) {
        const compressedData = gzipSync(compressed);
        await this.redis.setex(key, ttl, compressedData.toString('base64'));
      } else {
        await this.redis.setex(key, ttl, compressed);
      }
      this.stats.sets++;
    } catch (error) {
      console.error(`Cache compression error for key ${key}:`, error);
    }
  }

  public async getCompressed(key: string): Promise<any> {
    try {
      if (!this.redis) {
        return null;
      }
      const data = await this.redis.get(key);
      if (!data) return null;

      try {
        const decompressed = gunzipSync(Buffer.from(data, 'base64'));
        this.stats.hits++;
        return JSON.parse(decompressed.toString());
      } catch {
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

const cacheService = new CacheService();

export default cacheService;

