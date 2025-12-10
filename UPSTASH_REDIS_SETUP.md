# Upstash Redis Setup Guide

Complete guide to set up Upstash Redis for Prokrishi backend.

## 🚀 Step 1: Create Redis Database in Upstash

1. **Go to Upstash Console**
   - Visit: https://console.upstash.com/redis
   - Sign in or create an account (free tier available)

2. **Create a New Database**
   - Click the green **"+ Create Database"** button
   - Fill in the details:
     - **Name**: `prokrishi-redis` (or your preferred name)
     - **Type**: Choose **Regional** (recommended) or **Global**
     - **Region**: Select closest to your backend server (e.g., `us-east-1`, `ap-south-1`)
     - **Primary Region**: Select your primary region
     - **Read Replicas**: 0 (for free tier) or more for production
     - **TLS**: Enabled (recommended)
     - **Eviction**: Enabled (recommended for cache)

3. **Click "Create"**

## 📋 Step 2: Get Connection Details

After creating the database, you'll see the connection details:

1. **Copy the following values:**
   - **REST Host** (e.g., `your-db-name.upstash.io`)
   - **REST Port** (usually `6379`)
   - **REST Password** (click "Show" to reveal)

2. **Note:** Upstash provides two connection methods:
   - **REST API** (recommended for serverless/serverless-like environments)
   - **Redis Protocol** (for traditional Redis clients)

   We'll use the **REST API** method as it's already configured in the backend.

## ⚙️ Step 3: Configure Backend Environment Variables

1. **Open your backend `.env` file:**
   ```bash
   cd backend
   nano .env
   # or
   code .env
   ```

2. **Add these Upstash Redis variables:**
   ```env
   # Upstash Redis Configuration (TCP endpoint)
   UPSTASH_REDIS_REST_HOST=your-db-name.upstash.io
   UPSTASH_REDIS_REST_PORT=6379
   UPSTASH_REDIS_REST_PASSWORD=your-password-here
   ```

   **Note:** Variable names say "REST" but they work with TCP endpoint. This is just naming convention.

3. **Replace the values:**
   - `your-db-name.upstash.io` → Your actual TCP Host from Upstash
   - `6379` → Your TCP Port (usually 6379 or 6380 for TLS)
   - `your-password-here` → Your actual TCP Password from Upstash

4. **Save the file**

## 🧪 Step 4: Test Redis Connection

### Option 1: Test Script (Recommended)

```bash
cd backend
node scripts/check-redis-production.js
```

### Option 2: Manual Test

```bash
cd backend
node test-redis.js
```

### Option 3: Check Health Endpoint

Start your backend server and check:
```bash
curl http://localhost:3500/health | jq '.redis'
```

You should see:
```json
{
  "available": true,
  "working": true,
  "status": "ready"
}
```

## ✅ Step 5: Verify Redis is Working

1. **Start your backend server:**
   ```bash
   npm run dev
   ```

2. **Look for these log messages:**
   - ✅ `✅ Redis connected successfully` - Success!
   - ⚠️ `⚠️ Redis not configured` - Check your .env file
   - ❌ `Redis connection error` - Check your credentials

3. **Check cache service status:**
   - Visit: `http://localhost:3500/health`
   - Look for `redis` object in the response

## 🔒 Step 6: Production Deployment

### For Digital Ocean Droplet:

1. **SSH into your server:**
   ```bash
   ssh root@your-server-ip
   ```

2. **Edit production .env file:**
   ```bash
   cd ~/prokrishi-server/backend
   nano .env
   ```

3. **Add the same Upstash Redis variables**

4. **Restart your application:**
   ```bash
   pm2 restart prokrishi-backend
   ```

5. **Check Redis status:**
   ```bash
   pm2 logs prokrishi-backend | grep -i redis
   ```

### For Vercel/Render/Other Platforms:

Add the environment variables in your platform's dashboard:
- `UPSTASH_REDIS_REST_HOST`
- `UPSTASH_REDIS_REST_PORT`
- `UPSTASH_REDIS_REST_PASSWORD`

## 📊 Step 7: Monitor Redis Usage

1. **Go to Upstash Console**
   - Visit: https://console.upstash.com/redis
   - Click on your database
   - View metrics:
     - Commands per second
     - Storage usage
     - Cost

2. **Check Backend Health Endpoint:**
   ```bash
   curl https://your-backend-domain.com/health | jq '.redis'
   ```

## 🎯 What Gets Cached

The backend automatically caches:
- Product listings
- Category data
- Featured products
- Dashboard statistics
- User sessions (optional)

Cache TTL (Time To Live) is configurable per cache operation.

## 🐛 Troubleshooting

### Issue: "Redis not configured"
- **Solution**: Check that all three Upstash variables are set in `.env`
- Verify variable names match exactly (case-sensitive)

### Issue: "Redis connection error"
- **Solution**: 
  - Verify credentials are correct
  - Check if TLS is enabled (should be)
  - Ensure your server can reach Upstash (check firewall)

### Issue: "Redis not available"
- **Solution**: 
  - Check Upstash console - is database active?
  - Verify network connectivity
  - Check backend logs for specific error messages

### Issue: Cache not working
- **Solution**:
  - Verify Redis is connected (check `/health` endpoint)
  - Check cache service logs
  - Ensure cache methods are being called in your code

## 💡 Tips

1. **Free Tier Limits:**
   - 10,000 commands/day
   - 256 MB storage
   - Perfect for development and small production

2. **Upgrade When Needed:**
   - Monitor usage in Upstash console
   - Upgrade plan when approaching limits

3. **Cache Strategy:**
   - Cache frequently accessed data (products, categories)
   - Use appropriate TTL (Time To Live)
   - Clear cache when data is updated

4. **Security:**
   - Never commit `.env` file
   - Rotate passwords periodically
   - Use environment-specific databases

## 📚 Additional Resources

- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Upstash Console](https://console.upstash.com/)
- Backend Cache Service: `backend/services/cache.ts`
- Redis Check Scripts: `backend/scripts/check-redis-*.js`

## ✅ Checklist

- [ ] Created Upstash Redis database
- [ ] Copied REST Host, Port, and Password
- [ ] Added variables to backend `.env` file
- [ ] Tested connection locally
- [ ] Verified Redis is working (check logs)
- [ ] Added variables to production environment
- [ ] Tested in production
- [ ] Monitored usage in Upstash console

---

**Need Help?** Check the backend logs or Upstash console for detailed error messages.

