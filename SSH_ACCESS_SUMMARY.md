# SSH Access Summary for Digital Ocean Server

## Server Information

- **Droplet IP:** `178.128.91.197`
- **SSH User:** `root`
- **SSH Port:** `22`
- **Backend Path:** `/root/prokrishi-server/backend`
- **Repository:** `https://github.com/Atiqul-Imon/prokrishi-server.git`

## SSH Access Methods

### Method 1: Direct SSH (If Key is Configured)

```bash
ssh root@178.128.91.197
```

**SSH Key Location (Default):**
- Private Key: `~/.ssh/id_rsa`
- Public Key: `~/.ssh/id_rsa.pub`

**Check if SSH key exists:**
```bash
ls -la ~/.ssh/id_rsa
cat ~/.ssh/id_rsa.pub
```

### Method 2: SSH with Specific Key

```bash
ssh -i ~/.ssh/id_rsa root@178.128.91.197
```

### Method 3: Digital Ocean Console (No SSH Key Needed)

1. Go to [Digital Ocean Dashboard](https://cloud.digitalocean.com)
2. Click on your droplet
3. Click **"Console"** or **"Access"** → **"Launch Droplet Console"**
4. This opens a web-based terminal (no SSH key required)

## SSH Key Configuration

### Check Current SSH Keys

```bash
# List all SSH keys
ls -la ~/.ssh/

# View public key
cat ~/.ssh/id_rsa.pub
# OR
cat ~/.ssh/id_ed25519.pub
```

### Generate New SSH Key (If Needed)

```bash
# Generate ED25519 key (recommended)
ssh-keygen -t ed25519 -C "prokrishi-backend"

# OR generate RSA key
ssh-keygen -t rsa -b 4096 -C "prokrishi-backend"
```

### Add SSH Key to Digital Ocean

1. Copy your public key:
   ```bash
   cat ~/.ssh/id_rsa.pub
   ```

2. Go to Digital Ocean Dashboard → **Settings** → **SSH Keys**
3. Click **"Add SSH Key"**
4. Paste the public key content
5. Name it: `prokrishi-backend`
6. Click **"Add SSH Key"**

## Deployment Scripts Using SSH

### 1. Check Deployment Status

```bash
cd backend
./scripts/check-deployment-status.sh
```

**Configuration:**
- Uses SSH key: `~/.ssh/id_rsa` (default)
- Can override: `SSH_KEY=/path/to/key ./scripts/check-deployment-status.sh`

### 2. Deploy to Droplet

```bash
cd backend
./scripts/deploy-to-droplet.sh
```

**Configuration (via environment variables):**
```bash
export DROPLET_USER=root
export DROPLET_IP=178.128.91.197
export DROPLET_PATH=/root/prokrishi-server/backend
export SSH_KEY=~/.ssh/id_rsa
./scripts/deploy-to-droplet.sh
```

## Manual SSH Commands

### Connect to Server

```bash
ssh root@178.128.91.197
```

### Check Git Status on Server

```bash
ssh root@178.128.91.197 "cd /root/prokrishi-server/backend && git status"
```

### Check Latest Commit on Server

```bash
ssh root@178.128.91.197 "cd /root/prokrishi-server/backend && git log --oneline -1"
```

### Pull Latest Changes

```bash
ssh root@178.128.91.197 "cd /root/prokrishi-server/backend && git pull origin main"
```

### Check PM2 Status

```bash
ssh root@178.128.91.197 "pm2 status"
```

### View Application Logs

```bash
ssh root@178.128.91.197 "pm2 logs prokrishi-backend --lines 50"
```

## Troubleshooting SSH Access

### Issue: Connection Timeout

**Solution 1: Use Digital Ocean Console**
- Access via web console (no SSH needed)
- Fix firewall: `sudo ufw allow 22/tcp`

**Solution 2: Check Firewall**
```bash
# Via console
sudo ufw status
sudo ufw allow 22/tcp
sudo ufw reload
```

**Solution 3: Check Digital Ocean Firewall**
- Go to Digital Ocean → Networking → Firewalls
- Ensure SSH (port 22) is allowed

### Issue: Permission Denied

**Check SSH key permissions:**
```bash
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub
```

**Verify key is added to Digital Ocean:**
- Check Digital Ocean Dashboard → Settings → SSH Keys
- Ensure your public key is listed

### Issue: Host Key Verification Failed

**Remove old host key:**
```bash
ssh-keygen -f ~/.ssh/known_hosts -R 178.128.91.197
```

**Or use StrictHostKeyChecking:**
```bash
ssh -o StrictHostKeyChecking=no root@178.128.91.197
```

## Quick Reference Commands

### Check Deployment Status

```bash
# Local latest commit
cd backend && git log --oneline -1

# Server commit (if SSH works)
ssh root@178.128.91.197 "cd /root/prokrishi-server/backend && git log --oneline -1"

# Or use the script
./scripts/check-deployment-status.sh
```

### Deploy Latest Changes

```bash
# Option 1: Use deployment script
./scripts/deploy-to-droplet.sh

# Option 2: Manual deployment
ssh root@178.128.91.197 << 'EOF'
cd /root/prokrishi-server/backend
git pull origin main
npm ci --production
pm2 restart prokrishi-backend
pm2 status
EOF
```

### Check Application Health

```bash
# From server
ssh root@178.128.91.197 "curl http://localhost:3500/health"

# From external
curl http://178.128.91.197:3500/health
```

## Files Related to SSH Access

1. **`SSH_KEY_SETUP.md`** - How to setup SSH keys
2. **`FIX_SSH_TIMEOUT.md`** - Troubleshooting SSH connection issues
3. **`scripts/deploy-to-droplet.sh`** - Automated deployment script
4. **`scripts/check-deployment-status.sh`** - Check deployment status
5. **`DIGITAL_OCEAN_DEPLOYMENT.md`** - Full deployment guide
6. **`DEPLOY_FROM_GITHUB.md`** - GitHub deployment guide

## Current SSH Key Status

**Local SSH Keys Found:**
- `~/.ssh/id_rsa` (exists)
- `~/.ssh/id_rsa.pub` (exists)
- `~/.ssh/scarlet_backend_key` (alternative key)

**To use a specific key:**
```bash
export SSH_KEY=~/.ssh/scarlet_backend_key
ssh -i $SSH_KEY root@178.128.91.197
```

## Next Steps

1. **Test SSH Connection:**
   ```bash
   ssh root@178.128.91.197
   ```

2. **If SSH fails, use Digital Ocean Console:**
   - Access via web browser
   - No SSH key needed

3. **Check Deployment:**
   ```bash
   ./scripts/check-deployment-status.sh
   ```

4. **Deploy if needed:**
   ```bash
   ./scripts/deploy-to-droplet.sh
   ```

