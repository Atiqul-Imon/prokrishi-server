# SSH Commands to Add Redis to Digital Ocean Droplet

## Quick Method: Run the Script

From your local Ubuntu machine, run:

```bash
cd ~/prokrishi-v2/backend
./ADD_REDIS_TO_DROPLET.sh
```

## Manual Method: Step by Step

### Step 1: SSH into Droplet

```bash
ssh root@YOUR_DROPLET_IP
```

### Step 2: Navigate to Backend Directory

```bash
cd ~/prokrishi-server/backend
# or
cd /root/prokrishi-server/backend
```

### Step 3: Backup Current .env

```bash
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
```

### Step 4: Edit .env File

```bash
nano .env
# or
vi .env
```

### Step 5: Remove Old Redis Config

Find and remove/comment out these lines:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### Step 6: Add New Upstash Redis Config

Add these lines at the end of the file:

```env
# Upstash Redis Configuration (TCP)
UPSTASH_REDIS_REST_HOST=your-redis-host.upstash.io
UPSTASH_REDIS_REST_PORT=6379
UPSTASH_REDIS_REST_PASSWORD=your-redis-password-here

# Alternative: Redis URL format
REDIS_URL="rediss://default:your-redis-password@your-redis-host.upstash.io:6379"
```

### Step 7: Save and Exit

- In `nano`: Press `Ctrl+X`, then `Y`, then `Enter`
- In `vi`: Press `Esc`, type `:wq`, press `Enter`

### Step 8: Restart Backend

```bash
pm2 restart prokrishi-backend
```

### Step 9: Verify Redis Connection

```bash
# Check logs
pm2 logs prokrishi-backend | grep -i redis

# Should see: ✅ Redis connected successfully

# Or check health endpoint
curl http://localhost:3500/health | jq '.redis'
```

## One-Line Command (Copy-Paste)

If you want to do it all in one command:

```bash
ssh root@YOUR_DROPLET_IP 'cd ~/prokrishi-server/backend && cp .env .env.backup.$(date +%Y%m%d_%H%M%S) && echo "" >> .env && echo "# Upstash Redis Configuration" >> .env && echo "UPSTASH_REDIS_REST_HOST=your-redis-host.upstash.io" >> .env && echo "UPSTASH_REDIS_REST_PORT=6379" >> .env && echo "UPSTASH_REDIS_REST_PASSWORD=your-redis-password" >> .env && echo "REDIS_URL=\"rediss://default:your-redis-password@your-redis-host.upstash.io:6379\"" >> .env && pm2 restart prokrishi-backend && echo "✅ Redis configured and backend restarted"'
```

## Verify Configuration

After adding, verify:

```bash
ssh root@YOUR_DROPLET_IP 'cd ~/prokrishi-server/backend && grep -E "REDIS|UPSTASH" .env'
```

## Troubleshooting

### If SSH fails:
- Check SSH key is loaded: `ssh-add -l`
- Try: `ssh -i ~/.ssh/your-key-name root@YOUR_DROPLET_IP`

### If path is different:
- Find backend: `ssh root@YOUR_DROPLET_IP 'find / -name "package.json" -path "*/backend/*" 2>/dev/null'`

### If pm2 not found:
- Check process: `ssh root@YOUR_DROPLET_IP 'ps aux | grep node'`

