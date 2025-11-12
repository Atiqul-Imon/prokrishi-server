# Check Redis Environment Variables on Digital Ocean Droplet

## Method 1: SSH into Droplet and Check .env File

### Step 1: SSH into your Droplet

```bash
ssh root@your_droplet_ip
# OR if you have a non-root user
ssh prokrishi@your_droplet_ip
```

### Step 2: Navigate to Backend Directory

```bash
# Common locations:
cd ~/prokrishi-server/backend
# OR
cd ~/prokrishi-v2/backend
# OR check where your app is deployed
cd ~/backend
```

### Step 3: Check .env File for Redis Variables

```bash
# View the .env file
cat .env | grep -i redis

# OR view all Redis-related variables
grep -E "REDIS|UPSTASH" .env

# OR edit the file to see all variables
nano .env
```

### Step 4: Run the Check Script

```bash
# Make script executable (if not already)
chmod +x scripts/check-redis-env-droplet.sh

# Run the check script
./scripts/check-redis-env-droplet.sh
```

## Method 2: Check via PM2 Environment

If your app is running with PM2, you can check the environment variables:

```bash
# SSH into droplet
ssh root@your_droplet_ip

# Check PM2 environment
pm2 env prokrishi-backend | grep -i redis

# OR view all environment variables
pm2 env prokrishi-backend
```

## Method 3: Check via Health Endpoint (Remote)

You can check Redis status remotely without SSH:

```bash
# Replace with your actual backend URL
curl https://your-backend-domain.com/health | jq '.redis'

# OR if jq is not installed
curl https://your-backend-domain.com/health
```

Look for the `redis` object in the response:
```json
{
  "redis": {
    "available": true,
    "configured": true,
    "working": true
  }
}
```

## Method 4: Check Server Logs

Check the application logs to see if Redis is connecting:

```bash
# SSH into droplet
ssh root@your_droplet_ip

# Check PM2 logs
pm2 logs prokrishi-backend | grep -i redis

# OR check application logs
tail -f ~/prokrishi-server/backend/logs/combined.log | grep -i redis
```

Look for:
- `✅ Redis connected successfully` - Redis is working
- `⚠️ Redis not configured for production` - Redis needs configuration

## What to Look For in .env File

Your `.env` file should contain at least one of these Redis configurations:

### Option 1: Upstash Redis (Recommended)
```bash
UPSTASH_REDIS_REST_HOST=your-host.upstash.io
UPSTASH_REDIS_REST_PORT=6379
UPSTASH_REDIS_REST_PASSWORD=your-password-here
```

### Option 2: Redis URL
```bash
REDIS_URL=redis://username:password@host:port
# OR
REDIS_URL=rediss://username:password@host:port  # with SSL
```

### Option 3: Redis Host/Port
```bash
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-password-here
```

## Quick Commands Reference

### Check if .env file exists
```bash
ls -la ~/prokrishi-server/backend/.env
```

### View Redis variables only
```bash
cat ~/prokrishi-server/backend/.env | grep -E "REDIS|UPSTASH"
```

### Edit .env file
```bash
nano ~/prokrishi-server/backend/.env
# Press Ctrl+X, then Y, then Enter to save
```

### Test Redis connection
```bash
cd ~/prokrishi-server/backend
node scripts/check-redis-production.js
```

### Restart app after changing .env
```bash
pm2 restart prokrishi-backend
pm2 logs prokrishi-backend
```

## Common Issues

### Issue: .env file not found
**Solution**: Navigate to your backend directory or check where PM2 is running from:
```bash
pm2 info prokrishi-backend
# Look for "script path" to find the directory
```

### Issue: Redis variables not loaded
**Solution**: Restart PM2 after editing .env:
```bash
pm2 restart prokrishi-backend
```

### Issue: Can't edit .env file
**Solution**: Check file permissions:
```bash
ls -la .env
chmod 600 .env  # Secure permissions
nano .env
```

## Automated Check Script

Run this on your droplet to check everything:

```bash
cd ~/prokrishi-server/backend
chmod +x scripts/check-redis-env-droplet.sh
./scripts/check-redis-env-droplet.sh
```

This script will:
- ✅ Find your .env file
- ✅ Show all Redis environment variables
- ✅ Test Redis connection
- ✅ Display configuration status

## Next Steps

1. **If Redis is NOT configured**:
   - Add Redis environment variables to .env file
   - Restart the application: `pm2 restart prokrishi-backend`
   - Verify via health endpoint or logs

2. **If Redis IS configured but not working**:
   - Check Redis service is running (if self-hosted)
   - Verify credentials are correct
   - Check network connectivity
   - Review Redis server logs

3. **If Redis IS working**:
   - Monitor cache hit rates
   - Check application performance
   - Review cache statistics via health endpoint

---

**Need Help?** Check the main Redis guide: `REDIS_PRODUCTION_CHECK.md`

