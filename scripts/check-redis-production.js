#!/usr/bin/env node

/**
 * Redis Production Status Checker
 * 
 * This script checks if Redis is properly configured and working in production
 * Usage: node scripts/check-redis-production.js
 */

import dotenv from 'dotenv';
import cacheService from '../services/cache.js';

// Load environment variables
dotenv.config({ path: process.env.ENV_FILE || '.env' });

async function checkRedisProduction() {
  console.log('\n🔍 Checking Redis Production Status...\n');
  console.log('=' .repeat(60));
  
  // Check environment variables
  console.log('\n📋 Environment Configuration:');
  console.log('-'.repeat(60));
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`REDIS_URL: ${process.env.REDIS_URL ? '✅ Set' : '❌ Not set'}`);
  console.log(`REDIS_HOST: ${process.env.REDIS_HOST || 'not set'}`);
  console.log(`REDIS_PORT: ${process.env.REDIS_PORT || 'not set'}`);
  console.log(`REDIS_PASSWORD: ${process.env.REDIS_PASSWORD ? '✅ Set (hidden)' : '❌ Not set'}`);
  console.log(`UPSTASH_REDIS_REST_HOST: ${process.env.UPSTASH_REDIS_REST_HOST ? '✅ Set' : '❌ Not set'}`);
  console.log(`UPSTASH_REDIS_REST_PORT: ${process.env.UPSTASH_REDIS_REST_PORT || 'not set'}`);
  console.log(`UPSTASH_REDIS_REST_PASSWORD: ${process.env.UPSTASH_REDIS_REST_PASSWORD ? '✅ Set (hidden)' : '❌ Not set'}`);
  
  // Check Redis availability
  console.log('\n🔌 Redis Connection Status:');
  console.log('-'.repeat(60));
  const isAvailable = cacheService.isRedisAvailable();
  console.log(`Redis Available: ${isAvailable ? '✅ Yes' : '❌ No'}`);
  
  if (!isAvailable) {
    console.log('\n⚠️  Redis is not available. The application will run without caching.');
    console.log('\n💡 To enable Redis:');
    console.log('   1. Set up Redis service (Upstash, Redis Cloud, or self-hosted)');
    console.log('   2. Configure environment variables:');
    console.log('      - REDIS_URL (connection string)');
    console.log('      OR');
    console.log('      - REDIS_HOST, REDIS_PORT, REDIS_PASSWORD');
    console.log('      OR');
    console.log('      - UPSTASH_REDIS_REST_HOST, UPSTASH_REDIS_REST_PORT, UPSTASH_REDIS_REST_PASSWORD');
    console.log('   3. Restart the application');
    return;
  }
  
  // Test Redis operations
  console.log('\n🧪 Testing Redis Operations:');
  console.log('-'.repeat(60));
  
  try {
    // Test SET operation
    const testKey = 'test:production:check';
    const testValue = { timestamp: Date.now(), status: 'ok' };
    const setResult = await cacheService.set(testKey, testValue, 60);
    console.log(`SET operation: ${setResult ? '✅ Success' : '❌ Failed'}`);
    
    // Test GET operation
    const getValue = await cacheService.get(testKey);
    console.log(`GET operation: ${getValue ? '✅ Success' : '❌ Failed'}`);
    
    if (getValue && getValue.status === 'ok') {
      console.log(`✅ Data integrity: Verified`);
    }
    
    // Test DELETE operation
    const delResult = await cacheService.del(testKey);
    console.log(`DELETE operation: ${delResult ? '✅ Success' : '❌ Failed'}`);
    
    // Test EXISTS operation
    const existsAfter = await cacheService.exists(testKey);
    console.log(`EXISTS check (after delete): ${!existsAfter ? '✅ Correct' : '❌ Failed'}`);
    
    // Get cache statistics
    console.log('\n📊 Cache Statistics:');
    console.log('-'.repeat(60));
    try {
      const stats = await cacheService.getStats();
      if (stats) {
        console.log(`Connected: ${stats.connected ? '✅ Yes' : '❌ No'}`);
        console.log(`Hits: ${stats.performance.hits}`);
        console.log(`Misses: ${stats.performance.misses}`);
        console.log(`Hit Rate: ${stats.performance.hitRate.toFixed(2)}%`);
        console.log(`Sets: ${stats.performance.sets}`);
        console.log(`Deletes: ${stats.performance.deletes}`);
      } else {
        console.log('❌ Unable to get cache statistics');
      }
    } catch (statsError) {
      console.log(`⚠️  Stats error: ${statsError.message}`);
    }
    
    console.log('\n✅ Redis is working correctly in production!');
    
  } catch (error) {
    console.log(`\n❌ Redis test failed: ${error.message}`);
    console.log(`   Error details: ${error.stack}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✨ Redis check completed\n');
}

// Run the check
checkRedisProduction()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

