# Quick Upstash Redis Setup

## 🎯 Quick Steps

### 1. Create Database in Upstash
- Go to: https://console.upstash.com/redis
- Click **"+ Create Database"**
- Fill in:
  - **Name**: `prokrishi-redis`
  - **Type**: Regional
  - **Region**: Choose closest to your server
  - **TLS**: Enabled ✅
- Click **"Create"**

### 2. Copy Connection Details
After creation, you'll see:
- **REST Host** (e.g., `prokrishi-redis-12345.upstash.io`)
- **REST Port** (usually `6379`)
- **REST Password** (click "Show" to reveal)

### 3. Add to Backend .env
Open `backend/.env` and add:

```env
UPSTASH_REDIS_REST_HOST=your-tcp-host.upstash.io
UPSTASH_REDIS_REST_PORT=6379
UPSTASH_REDIS_REST_PASSWORD=your-tcp-password
```

**Note:** Choose **TCP** endpoint in Upstash (not REST). Variable names say "REST" but they work with TCP - this is just naming convention.

Replace with your actual TCP values from Upstash.

### 4. Test Connection
```bash
cd backend
node test-redis.js
```

You should see: `✅ Redis connected successfully`

### 5. Restart Backend
```bash
npm run dev
# or for production
pm2 restart prokrishi-backend
```

### 6. Verify
Check health endpoint:
```bash
curl http://localhost:3500/health | jq '.redis'
```

Should show:
```json
{
  "available": true,
  "working": true
}
```

## ✅ Done!

Redis is now configured and caching is enabled.

For detailed guide, see: `UPSTASH_REDIS_SETUP.md`

