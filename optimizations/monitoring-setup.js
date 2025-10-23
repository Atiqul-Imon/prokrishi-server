import winston from 'winston';
import { createClient } from 'redis';

/**
 * Comprehensive Monitoring & Analytics Setup
 * Provides real-time insights into performance, costs, and user behavior
 */

class MonitoringService {
  constructor() {
    this.redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    this.redis.on('error', (err) => console.error('Redis Client Error', err));
    this.redis.connect();

    // Enhanced logger with performance tracking
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });

    // Performance metrics
    this.metrics = {
      requests: 0,
      errors: 0,
      responseTime: [],
      databaseQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };

    // Cost tracking
    this.costMetrics = {
      databaseQueries: 0,
      cacheOperations: 0,
      imageProcessing: 0,
      apiCalls: 0,
      bandwidth: 0
    };
  }

  // 1. PERFORMANCE MONITORING
  async trackPerformance(operation, startTime, metadata = {}) {
    const duration = Date.now() - startTime;
    
    this.metrics.responseTime.push(duration);
    this.metrics.requests++;
    
    // Log slow operations
    if (duration > 1000) {
      this.logger.warn('Slow operation detected', {
        operation,
        duration,
        metadata
      });
    }
    
    // Update Redis metrics
    await this.redis.hIncrBy('metrics:performance', 'total_requests', 1);
    await this.redis.hIncrBy('metrics:performance', 'total_response_time', duration);
    await this.redis.hSet('metrics:performance', 'avg_response_time', 
      this.calculateAverageResponseTime()
    );
  }

  // 2. DATABASE MONITORING
  async trackDatabaseQuery(query, duration, resultCount) {
    this.metrics.databaseQueries++;
    this.costMetrics.databaseQueries++;
    
    await this.redis.hIncrBy('metrics:database', 'total_queries', 1);
    await this.redis.hIncrBy('metrics:database', 'total_duration', duration);
    await this.redis.hIncrBy('metrics:database', 'total_results', resultCount);
    
    // Track slow queries
    if (duration > 100) {
      await this.redis.lPush('metrics:slow_queries', JSON.stringify({
        query: query.substring(0, 100),
        duration,
        resultCount,
        timestamp: Date.now()
      }));
    }
  }

  // 3. CACHE MONITORING
  async trackCacheOperation(operation, key, hit = false) {
    if (hit) {
      this.metrics.cacheHits++;
      await this.redis.hIncrBy('metrics:cache', 'hits', 1);
    } else {
      this.metrics.cacheMisses++;
      await this.redis.hIncrBy('metrics:cache', 'misses', 1);
    }
    
    this.costMetrics.cacheOperations++;
    
    // Calculate cache hit rate
    const hitRate = this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100;
    await this.redis.hSet('metrics:cache', 'hit_rate', hitRate.toFixed(2));
  }

  // 4. COST TRACKING
  async trackCost(service, operation, cost) {
    this.costMetrics[service] += cost;
    
    await this.redis.hIncrBy('metrics:costs', service, cost);
    await this.redis.hIncrBy('metrics:costs', 'total', cost);
    
    // Log high-cost operations
    if (cost > 10) {
      this.logger.warn('High-cost operation detected', {
        service,
        operation,
        cost
      });
    }
  }

  // 5. ERROR TRACKING
  async trackError(error, context = {}) {
    this.metrics.errors++;
    
    await this.redis.hIncrBy('metrics:errors', 'total', 1);
    await this.redis.lPush('metrics:recent_errors', JSON.stringify({
      error: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now()
    }));
    
    this.logger.error('Application error', {
      error: error.message,
      stack: error.stack,
      context
    });
  }

  // 6. RESOURCE MONITORING
  async trackResourceUsage() {
    const usage = process.memoryUsage();
    this.metrics.memoryUsage = usage.heapUsed / 1024 / 1024; // MB
    
    await this.redis.hSet('metrics:resources', 'memory_usage', this.metrics.memoryUsage);
    await this.redis.hSet('metrics:resources', 'memory_total', usage.heapTotal / 1024 / 1024);
    await this.redis.hSet('metrics:resources', 'timestamp', Date.now());
  }

  // 7. USER BEHAVIOR ANALYTICS
  async trackUserBehavior(userId, action, metadata = {}) {
    const behaviorData = {
      userId,
      action,
      metadata,
      timestamp: Date.now(),
      userAgent: metadata.userAgent,
      ip: metadata.ip
    };
    
    await this.redis.lPush('analytics:user_behavior', JSON.stringify(behaviorData));
    
    // Track popular actions
    await this.redis.hIncrBy('analytics:actions', action, 1);
  }

  // 8. BUSINESS METRICS
  async trackBusinessMetrics(metric, value, metadata = {}) {
    const businessData = {
      metric,
      value,
      metadata,
      timestamp: Date.now()
    };
    
    await this.redis.lPush('analytics:business', JSON.stringify(businessData));
    await this.redis.hIncrBy('analytics:business_totals', metric, value);
  }

  // 9. ALERTING SYSTEM
  async checkAlerts() {
    const alerts = [];
    
    // High error rate alert
    const errorRate = this.metrics.errors / this.metrics.requests * 100;
    if (errorRate > 5) {
      alerts.push({
        type: 'high_error_rate',
        message: `Error rate is ${errorRate.toFixed(2)}%`,
        severity: 'critical'
      });
    }
    
    // High response time alert
    const avgResponseTime = this.calculateAverageResponseTime();
    if (avgResponseTime > 2000) {
      alerts.push({
        type: 'high_response_time',
        message: `Average response time is ${avgResponseTime}ms`,
        severity: 'warning'
      });
    }
    
    // Low cache hit rate alert
    const cacheHitRate = this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100;
    if (cacheHitRate < 70) {
      alerts.push({
        type: 'low_cache_hit_rate',
        message: `Cache hit rate is ${cacheHitRate.toFixed(2)}%`,
        severity: 'warning'
      });
    }
    
    // High memory usage alert
    if (this.metrics.memoryUsage > 500) {
      alerts.push({
        type: 'high_memory_usage',
        message: `Memory usage is ${this.metrics.memoryUsage.toFixed(2)}MB`,
        severity: 'warning'
      });
    }
    
    // Send alerts
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }
    
    return alerts;
  }

  // 10. DASHBOARD DATA
  async getDashboardData() {
    const [
      performanceData,
      databaseData,
      cacheData,
      errorData,
      costData,
      resourceData
    ] = await Promise.all([
      this.redis.hGetAll('metrics:performance'),
      this.redis.hGetAll('metrics:database'),
      this.redis.hGetAll('metrics:cache'),
      this.redis.hGetAll('metrics:errors'),
      this.redis.hGetAll('metrics:costs'),
      this.redis.hGetAll('metrics:resources')
    ]);
    
    return {
      performance: {
        totalRequests: parseInt(performanceData.total_requests || 0),
        avgResponseTime: parseFloat(performanceData.avg_response_time || 0),
        totalResponseTime: parseInt(performanceData.total_response_time || 0)
      },
      database: {
        totalQueries: parseInt(databaseData.total_queries || 0),
        avgQueryTime: this.calculateAverageQueryTime(databaseData),
        totalResults: parseInt(databaseData.total_results || 0)
      },
      cache: {
        hits: parseInt(cacheData.hits || 0),
        misses: parseInt(cacheData.misses || 0),
        hitRate: parseFloat(cacheData.hit_rate || 0)
      },
      errors: {
        total: parseInt(errorData.total || 0),
        errorRate: this.calculateErrorRate()
      },
      costs: {
        database: parseInt(costData.databaseQueries || 0),
        cache: parseInt(costData.cacheOperations || 0),
        total: parseInt(costData.total || 0)
      },
      resources: {
        memoryUsage: parseFloat(resourceData.memory_usage || 0),
        memoryTotal: parseFloat(resourceData.memory_total || 0)
      }
    };
  }

  // Helper methods
  calculateAverageResponseTime() {
    if (this.metrics.responseTime.length === 0) return 0;
    return this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length;
  }

  calculateAverageQueryTime(databaseData) {
    const totalQueries = parseInt(databaseData.total_queries || 0);
    const totalDuration = parseInt(databaseData.total_duration || 0);
    return totalQueries > 0 ? totalDuration / totalQueries : 0;
  }

  calculateErrorRate() {
    const totalRequests = this.metrics.requests;
    const totalErrors = this.metrics.errors;
    return totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
  }

  async sendAlert(alert) {
    // Implementation depends on your alerting system (Slack, email, etc.)
    this.logger.warn('Alert triggered', alert);
    
    // Store alert in Redis
    await this.redis.lPush('alerts:recent', JSON.stringify({
      ...alert,
      timestamp: Date.now()
    }));
  }

  // Cleanup old data
  async cleanupOldData() {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    // Clean old error logs
    await this.redis.lTrim('metrics:recent_errors', 0, 99);
    
    // Clean old user behavior data
    await this.redis.lTrim('analytics:user_behavior', 0, 999);
    
    // Clean old business metrics
    await this.redis.lTrim('analytics:business', 0, 999);
  }
}

// Export singleton instance
export default new MonitoringService();
