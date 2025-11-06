# Digital Ocean Droplet Deployment Guide

This guide will help you deploy the Prokrishi backend to a Digital Ocean droplet.

## Prerequisites

- Digital Ocean account
- A droplet created (Ubuntu 22.04 LTS recommended)
- Domain name configured (optional but recommended)
- MongoDB Atlas account (or self-hosted MongoDB)
- SSH access to your droplet

## Step 1: Initial Server Setup

### 1.1 Connect to Your Droplet

```bash
ssh root@your_droplet_ip
```

### 1.2 Create a Non-Root User

```bash
# Create new user
adduser prokrishi
usermod -aG sudo prokrishi

# Switch to new user
su - prokrishi
```

### 1.3 Update System Packages

```bash
sudo apt update
sudo apt upgrade -y
```

## Step 2: Install Required Software

### 2.1 Install Node.js (v18 or higher)

```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node -v
npm -v
```

### 2.2 Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
pm2 -v
```

### 2.3 Install Nginx

```bash
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

### 2.4 Install Git

```bash
sudo apt install -y git
```

## Step 3: Configure Firewall

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Check status
sudo ufw status
```

## Step 4: Deploy Application

### 4.1 Clone Repository

```bash
# Navigate to home directory
cd ~

# Clone your repository (replace with your actual repo URL)
git clone https://github.com/your-username/prokrishi-server.git
cd prokrishi-server/backend

# Or if you're using a different structure
# git clone https://github.com/your-username/prokrishi-v2.git
# cd prokrishi-v2/backend
```

### 4.2 Install Dependencies

```bash
npm ci --production
```

### 4.3 Configure Environment Variables

```bash
# Copy production environment template
cp env.production.example .env

# Edit .env file with your actual values
nano .env
```

**Important variables to set:**
- `MONGODB_URI` - Your MongoDB Atlas connection string
- `JWT_SECRET` - Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `JWT_REFRESH_SECRET` - Generate another secure string
- `CORS_ORIGIN` - Your frontend domain
- `FRONTEND_URL` - Your frontend URL
- `BACKEND_URL` - Your backend URL (e.g., https://api.prokrishihub.com)
- `SSL_STORE_ID` and `SSL_STORE_PASSWORD` - SSL Commerz credentials
- `IMAGEKIT_*` - ImageKit credentials

### 4.4 Create Logs Directory

```bash
mkdir -p logs
```

### 4.5 Make Deploy Script Executable

```bash
chmod +x deploy.sh
```

### 4.6 Run Deployment Script

```bash
./deploy.sh
```

Or manually:

```bash
# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup systemd
# Follow the instructions shown
```

## Step 5: Configure Nginx

### 5.1 Copy Nginx Configuration

```bash
# Copy nginx config to sites-available
sudo cp nginx.conf /etc/nginx/sites-available/prokrishi-backend

# Create symlink to sites-enabled
sudo ln -s /etc/nginx/sites-available/prokrishi-backend /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default
```

### 5.2 Edit Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/prokrishi-backend
```

**Update the following:**
- Replace `api.prokrishihub.com` with your actual domain
- Adjust rate limiting if needed
- Update SSL certificate paths if using HTTPS

### 5.3 Test and Reload Nginx

```bash
# Test configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

## Step 6: Setup SSL Certificate (Let's Encrypt)

### 6.1 Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 6.2 Obtain SSL Certificate

```bash
sudo certbot --nginx -d api.prokrishihub.com -d www.api.prokrishihub.com
```

### 6.3 Enable HTTPS in Nginx Config

After obtaining the certificate, uncomment the HTTPS server block in `/etc/nginx/sites-available/prokrishi-backend` and update the SSL paths.

### 6.4 Test Auto-Renewal

```bash
sudo certbot renew --dry-run
```

## Step 7: Verify Deployment

### 7.1 Check PM2 Status

```bash
pm2 status
pm2 logs prokrishi-backend
```

### 7.2 Check Application Health

```bash
curl http://localhost:3500/health
```

### 7.3 Test from External

```bash
curl https://api.prokrishihub.com/health
```

## Step 8: Useful Commands

### PM2 Commands

```bash
# View logs
pm2 logs prokrishi-backend

# View status
pm2 status

# Restart application
pm2 restart prokrishi-backend

# Stop application
pm2 stop prokrishi-backend

# View monitoring
pm2 monit

# Reload application (zero downtime)
pm2 reload prokrishi-backend
```

### Nginx Commands

```bash
# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Restart Nginx
sudo systemctl restart nginx

# View logs
sudo tail -f /var/log/nginx/prokrishi-backend-access.log
sudo tail -f /var/log/nginx/prokrishi-backend-error.log
```

### Application Logs

```bash
# PM2 logs
pm2 logs prokrishi-backend

# Application logs
tail -f logs/combined.log
tail -f logs/error.log
```

## Step 9: Security Hardening

### 9.1 Setup Fail2Ban (Optional)

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 9.2 Disable Root Login (Recommended)

```bash
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd
```

### 9.3 Setup Automatic Security Updates

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Step 10: Monitoring and Maintenance

### 10.1 Setup PM2 Monitoring (Optional)

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 10.2 Setup Backup Script (Recommended)

Create a backup script for your database and important files.

### 10.3 Monitor Server Resources

```bash
# CPU and Memory
htop

# Disk usage
df -h

# Network
sudo iftop
```

## Troubleshooting

### Application Not Starting

1. Check PM2 logs: `pm2 logs prokrishi-backend`
2. Check application logs: `tail -f logs/error.log`
3. Verify environment variables: `pm2 env prokrishi-backend`
4. Check MongoDB connection
5. Verify port is not in use: `sudo lsof -i :3500`

### Nginx 502 Bad Gateway

1. Check if application is running: `pm2 status`
2. Check application logs
3. Verify Nginx can reach backend: `curl http://localhost:3500/health`
4. Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`

### CORS Errors

1. Verify `CORS_ORIGIN` in `.env` includes your frontend domain
2. Check Nginx configuration allows CORS headers
3. Verify frontend is using correct backend URL

### Database Connection Issues

1. Verify MongoDB Atlas IP whitelist includes your droplet IP
2. Check MongoDB connection string in `.env`
3. Test connection: `mongosh "your_connection_string"`

## Updating the Application

```bash
# Navigate to project directory
cd ~/prokrishi-server/backend

# Pull latest changes
git pull origin main

# Install new dependencies (if any)
npm ci --production

# Restart application
pm2 restart prokrishi-backend

# Check status
pm2 status
pm2 logs prokrishi-backend
```

## Support

For issues or questions:
- Check application logs: `pm2 logs prokrishi-backend`
- Check Nginx logs: `sudo tail -f /var/log/nginx/prokrishi-backend-error.log`
- Review this guide for common issues

