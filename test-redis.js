// Test script for Redis connection
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

async function testRedisConnection() {
  console.log('🔍 Testing Redis connection...');
  
  try {
    const redisConfig = process.env.UPSTASH_REDIS_REST_HOST ? {
      host: process.env.UPSTASH_REDIS_REST_HOST,
      port: process.env.UPSTASH_REDIS_REST_PORT || 6379,
      password: process.env.UPSTASH_REDIS_REST_PASSWORD,
      tls: {}, // Upstash requires TLS
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    } : {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
    };

    const redis = new Redis(redisConfig);

    redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redis.on('error', (err) => {
      console.error('❌ Redis connection error:', err.message);
    });

    // Test basic operations
    await redis.set('test:connection', 'success', 'EX', 60);
    const result = await redis.get('test:connection');
    
    if (result === 'success') {
      console.log('✅ Redis operations working correctly');
      console.log('📊 Redis info:', await redis.info('server'));
    } else {
      console.log('❌ Redis operations failed');
    }

    await redis.quit();
    console.log('🎉 Redis test completed successfully');
    
  } catch (error) {
    console.error('❌ Redis test failed:', error.message);
  }
}

testRedisConnection();
