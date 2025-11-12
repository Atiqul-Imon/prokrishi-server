# Redis Production Status Check Guide

## Overview

This guide helps you verify if Redis is working correctly in your production environment.

## Quick Check Methods

### Method 1: Health Endpoint (Recommended)

The backend now includes a `/health` endpoint that shows Redis status.

**Production URL:**
```bash
curl https://your-backend-domain.com/health
```

**Expected Response (Redis Working):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "environment": "production",
  "redis": {
    "available": true,
    "configured": true,
    "working": true
  },
  "database": {
    "connected": true
  }
}
```

**Expected Response (Redis Not Working):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "environment": "production",
  "redis": {
    "available": false,
    "configured": false,
    "working": false
  },
  "database": {
    "connected": true
  }
}
```

### Method 2: Check Server Logs

When the server starts, it logs Redis connection status:

**Redis Working:**
```
✅ Redis connected successfully
📊 Cache service: ready
```

**Redis Not Working:**
```
⚠️ Redis not configured for production, running without cache
📊 Cache service: disabled (Redis unavailable)
```

### Method 3: Run Check Script

If you have SSH/shell access to your production server:

```bash
cd /path/to/backend
node scripts/check-redis-production.js
```

This will provide detailed information about:
- Environment variables
- Connection status
- Redis operations (SET, GET, DELETE)
- Cache statistics

## Production Redis Setup

### Option 1: Upstash Redis (Recommended - Free Tier Available)

1. **Sign up**: [https://upstash.com](https://upstash.com)
2. **Create Redis Database**:
   - Click "Create Database"
   - Choose region closest to your server
   - Select "Global" or "Regional"
   - Click "Create"

3. **Get Connection Details**:
   - Copy the following values:
     - `UPSTASH_REDIS_REST_HOST`
     - `UPSTASH_REDIS_REST_PORT`
     - `UPSTASH_REDIS_REST_PASSWORD`

4. **Set Environment Variables** (in your hosting platform):
   ```bash
   UPSTASH_REDIS_REST_HOST=your-host.upstash.io
   UPSTASH_REDIS_REST_PORT=6379
   UPSTASH_REDIS_REST_PASSWORD=your-password
   ```

### Option 2: Redis Cloud (Free Tier Available)

1. **Sign up**: [https://redis.com/cloud](https://redis.com/cloud)
2. **Create Database**:
   - Create a free database
   - Choose cloud provider and region
   - Copy connection string

3. **Set Environment Variable**:
   ```bash
   REDIS_URL=redis://default:password@host:port
   ```

### Option 3: Self-Hosted Redis

If you have a VPS/server:

1. **Install Redis**:
   ```bash
   sudo apt update
   sudo apt install redis-server
   ```

2. **Configure Redis**:
   ```bash
   sudo nano /etc/redis/redis.conf
   # Set: bind 0.0.0.0 (if remote access needed)
   # Set: requirepass your-strong-password
   sudo systemctl restart redis
   ```

3. **Set Environment Variables**:
   ```bash
   REDIS_HOST=your-server-ip
   REDIS_PORT=6379
   REDIS_PASSWORD=your-strong-password
   ```

## Environment Variables Checklist

For Redis to work in production, you need **at least one** of these:

### Option A: Upstash Redis
- [ ] `UPSTASH_REDIS_REST_HOST` set
- [ ] `UPSTASH_REDIS_REST_PORT` set (usually 6379)
- [ ] `UPSTASH_REDIS_REST_PASSWORD` set

### Option B: Redis URL
- [ ] `REDIS_URL` set (full connection string)

### Option C: Redis Host/Port
- [ ] `REDIS_HOST` set
- [ ] `REDIS_PORT` set (usually 6379)
- [ ] `REDIS_PASSWORD` set (if required)

## Testing Redis Connection

### Test Locally (Before Production)

```bash
cd backend
node scripts/check-redis-production.js
```

### Test in Production

**Via Health Endpoint:**
```bash
curl https://your-backend-domain.com/health | jq '.redis'
```

**Via SSH/Shell:**
```bash
# SSH into your server
ssh user@your-server

# Navigate to backend
cd /path/to/backend

# Run check script
node scripts/check-redis-production.js
```

## Troubleshooting

### Redis Not Available

**Problem**: `redis.available: false`

**Solutions**:
1. Check environment variables are set correctly
2. Verify Redis service is running (if self-hosted)
3. Check network connectivity to Redis server
4. Verify credentials are correct
5. Check firewall rules allow Redis port (6379)

### Redis Configured but Not Working

**Problem**: `redis.configured: true` but `redis.working: false`

**Solutions**:
1. Check Redis server is accessible
2. Verify credentials
3. Check Redis server logs for errors
4. Test connection manually:
   ```bash
   redis-cli -h your-host -p 6379 -a your-password ping
   ```

### Environment Variables Not Loading

**Problem**: Variables set but not detected

**Solutions**:
1. Restart the application after setting variables
2. Check variable names match exactly (case-sensitive)
3. Remove any quotes or spaces around values
4. Check if your hosting platform requires a redeploy

## Current Status Check

### Check Your Production Environment

1. **Visit Health Endpoint**:
   ```
   https://your-backend-domain.com/health
   ```

2. **Look for Redis Status**:
   - If `redis.available: true` → ✅ Redis is working
   - If `redis.available: false` → ❌ Redis needs configuration

3. **Check Server Startup Logs**:
   - Look for "Redis connected successfully" message
   - Check "Cache service: ready" status

## Benefits of Redis in Production

When Redis is enabled:

✅ **Faster Response Times**: Cached data served instantly
✅ **Reduced Database Load**: Fewer queries to MongoDB
✅ **Better Performance**: Improved page load times
✅ **Cost Savings**: Reduced database operation costs
✅ **Scalability**: Handle more concurrent users

## Cache Statistics

You can view cache performance via the health endpoint or logs:

- **Hit Rate**: Percentage of requests served from cache
- **Hits**: Number of successful cache retrievals
- **Misses**: Number of cache misses (database queries)
- **Sets**: Number of cache writes
- **Deletes**: Number of cache invalidations

## Next Steps

1. **If Redis is NOT working**:
   - Set up Redis service (Upstash recommended)
   - Configure environment variables
   - Restart application
   - Verify via health endpoint

2. **If Redis IS working**:
   - Monitor cache hit rates
   - Adjust TTL values if needed
   - Set up monitoring/alerts
   - Consider cache warming for critical data

## Support

For issues:
1. Check server logs for Redis errors
2. Run the check script: `node scripts/check-redis-production.js`
3. Verify environment variables
4. Test Redis connection manually
5. Check Redis service provider status page

---

**Last Updated**: 2024
**Maintained By**: Prokrishi Development Team

