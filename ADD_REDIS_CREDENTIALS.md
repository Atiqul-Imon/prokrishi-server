# Add Upstash Redis Credentials

## 📋 After Creating Database in Upstash

Once you've created your Redis database, you'll see connection details. Follow these steps:

### Step 1: Choose TCP Endpoint in Upstash

**Important:** Choose **TCP** endpoint (not REST) because the backend uses `ioredis` which requires TCP protocol.

### Step 2: Copy These Values from Upstash

From your Upstash database page, after selecting **TCP**, copy:
- **Host** (e.g., `prokrishi-redis-12345.upstash.io`)
- **Port** (usually `6379` or `6380` for TLS)
- **Password** (click "Show" to reveal)

### Step 2: Edit Backend .env File

```bash
cd backend
nano .env
# or use your preferred editor
code .env
```

### Step 3: Add/Update These Lines

**Remove or comment out old Redis config:**
```env
# OLD - Comment out or remove these:
# REDIS_HOST=localhost
# REDIS_PORT=6379
# REDIS_PASSWORD=
```

**Add new Upstash Redis config (TCP endpoint):**
```env
# Upstash Redis Configuration (TCP)
UPSTASH_REDIS_REST_HOST=your-tcp-host.upstash.io
UPSTASH_REDIS_REST_PORT=6379
UPSTASH_REDIS_REST_PASSWORD=your-tcp-password-here
```

**Note:** Even though the variable name says "REST", it works with TCP endpoint. The backend uses `ioredis` which connects via TCP.

**Replace:**
- `your-tcp-host.upstash.io` → Your actual TCP Host from Upstash
- `your-tcp-password-here` → Your actual TCP Password from Upstash

### Step 4: Save and Test

```bash
# Test connection
node test-redis.js

# Should see: ✅ Redis connected successfully
```

### Step 5: Restart Backend

```bash
npm run dev
# or for production
pm2 restart prokrishi-backend
```

### Step 6: Verify

Check logs for:
```
✅ Redis connected successfully
```

Or check health endpoint:
```bash
curl http://localhost:3500/health | jq '.redis'
```

---

**Quick Copy-Paste Template:**

```env
UPSTASH_REDIS_REST_HOST=
UPSTASH_REDIS_REST_PORT=6379
UPSTASH_REDIS_REST_PASSWORD=
```

Fill in the values from Upstash console (TCP endpoint).

**Note:** The variable names say "REST" but they work with TCP endpoint. This is just the naming convention used in the codebase.

