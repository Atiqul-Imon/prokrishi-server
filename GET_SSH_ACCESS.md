# How to Get SSH Access to Digital Ocean Server

## Current Status

- **Server IP:** `178.128.91.197`
- **SSH Port:** `22` (currently blocked/timing out)
- **SSH Keys Available:**
  - `~/.ssh/id_rsa` (3072-bit RSA key)
  - `~/.ssh/scarlet_backend_key` (alternative key)

## Problem: SSH Connection Timeout

The SSH connection is timing out, which means:
- Port 22 is blocked by firewall
- OR SSH service is not running
- OR Digital Ocean firewall is blocking SSH

## Solution Options

### Option 1: Use Digital Ocean Console (EASIEST - No SSH Needed)

**This is the recommended method if SSH is blocked:**

1. **Go to Digital Ocean Dashboard:**
   - Visit: https://cloud.digitalocean.com
   - Login to your account

2. **Access Your Droplet:**
   - Click on **"Droplets"** in the left sidebar
   - Find your droplet (IP: 178.128.91.197)
   - Click on the droplet name

3. **Open Console:**
   - Click the **"Console"** button (or **"Access"** → **"Launch Droplet Console"**)
   - This opens a web-based terminal
   - **No SSH key needed!**

4. **Once in Console, Fix SSH:**
   ```bash
   # Check UFW status
   sudo ufw status
   
   # Allow SSH
   sudo ufw allow 22/tcp
   sudo ufw allow OpenSSH
   
   # Check SSH service
   sudo systemctl status ssh
   
   # If SSH is not running, start it
   sudo systemctl start ssh
   sudo systemctl enable ssh
   
   # Verify SSH is listening
   sudo netstat -tlnp | grep :22
   ```

5. **After fixing SSH, test from local machine:**
   ```bash
   ssh root@178.128.91.197
   ```

### Option 2: Fix Digital Ocean Firewall

1. **Go to Digital Ocean Dashboard:**
   - Navigate to **Networking** → **Firewalls**

2. **Check Firewall Rules:**
   - Find firewall attached to your droplet
   - Click on it

3. **Add SSH Rule:**
   - Go to **Inbound Rules**
   - Click **"Add Rule"**
   - Type: `SSH`
   - Port: `22`
   - Sources: `0.0.0.0/0` (or your IP address)
   - Click **"Save Changes"**

4. **Test SSH:**
   ```bash
   ssh root@178.128.91.197
   ```

### Option 3: Use Password Authentication (If Enabled)

If password authentication is enabled on the server:

```bash
ssh root@178.128.91.197
# Enter password when prompted
```

**Note:** You need to know the root password. If you don't have it, use Option 1 (Console).

### Option 4: Reset Root Password via Console

1. **Access Digital Ocean Console** (Option 1)
2. **Reset password:**
   ```bash
   sudo passwd root
   # Enter new password twice
   ```
3. **Enable password authentication (if disabled):**
   ```bash
   sudo nano /etc/ssh/sshd_config
   # Change: PasswordAuthentication yes
   sudo systemctl restart ssh
   ```

## Your SSH Public Key

**Your current SSH public key:**
```
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCy9R59MDu52xTFtA/G8nSqfaYZdc8GRj6E5Eu07JCwJUmpaPUibGUFG/XznZhfO9PO4nvDjZfqJhxEIaLCNQ2Vit5DBJXr1y38z33L/mmnzg4l+jb5hUTOnVAiXyGwdeeCLNPtF7RBojYFb4ZyCuh46bC1hvbpHiF+QZNtnIw29fJdR2Ejk69paUVDi/UJXbAfkO5GEj7vA+umyLhNtwzYBLLRAaQUt9ezITxC8m8IakkcYVCi9QU3uWg8dmm8Fc3QDPrVhsIlOz+cXfmijeI8r/RBHao6KlxyW34WsgX2RHrNRFdf86tpY6HQgPBCy1sGYix9ZPE4HdM9r5rqDCsfFxWoGJnDwt/g4BPM1luiVSzD2fiEz7gzyICNUDduV2Yq+xR7IpqCPAlOlw5Rdn1bfCpJPGObsHm2DD+1yP8yzRtxL7sdZCanv2BgAHAVduBAAcAg6HNQQP1hwxWaqZzKDvGqljb3qcBJTd/mrk0+TU4QxYmSiY94B+YTNB8EoSc= imonatikulislam@gmail.com
```

**To add this key to Digital Ocean:**
1. Go to Digital Ocean → Settings → SSH Keys
2. Click "Add SSH Key"
3. Paste the above key
4. Name it: `prokrishi-backend`
5. Click "Add SSH Key"

## Quick Steps to Get Access

### Step 1: Use Digital Ocean Console (Recommended)

1. Go to: https://cloud.digitalocean.com
2. Click on your droplet
3. Click "Console" button
4. You now have terminal access!

### Step 2: Fix SSH from Console

```bash
# Allow SSH in firewall
sudo ufw allow 22/tcp
sudo ufw reload

# Check SSH service
sudo systemctl status ssh
sudo systemctl start ssh
sudo systemctl enable ssh
```

### Step 3: Test SSH from Local Machine

```bash
ssh root@178.128.91.197
```

## Check Deployment Status via Console

Once you have console access, run:

```bash
cd /root/prokrishi-server/backend

# Check current commit
git log --oneline -1

# Check git status
git status

# Check if latest commit is deployed
git fetch origin
git log --oneline origin/main -1

# Compare with local
# Local latest: cfe9c74
```

## Alternative: Use Deployment Script After Fixing SSH

Once SSH is working:

```bash
cd /home/atiqul-islam/prokrishi-v2/backend
./scripts/deploy-to-droplet.sh
```

## Troubleshooting

### If Console Doesn't Work:

1. **Check if droplet is running:**
   - Go to Digital Ocean Dashboard
   - Check droplet status
   - Reboot if needed

2. **Check Digital Ocean Support:**
   - Contact Digital Ocean support
   - They can help with access issues

### If You Don't Have Digital Ocean Account Access:

1. **Recover account:**
   - Use "Forgot Password" on Digital Ocean
   - Check email for account recovery

2. **Contact account owner:**
   - If you're not the account owner, contact them for access

## Summary

**Easiest Method:** Use Digital Ocean Console (web-based terminal)
- No SSH key needed
- No password needed
- Works even if SSH is blocked
- Access via: Dashboard → Droplet → Console

**After Console Access:** Fix SSH, then use normal SSH commands

**Your SSH Key:** Already available at `~/.ssh/id_rsa`

