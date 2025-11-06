# Deployment Files Summary

This document lists all the files created/updated for Digital Ocean deployment.

## Files Created

### 1. `ecosystem.config.js`
- PM2 process manager configuration
- Defines how the application runs in production
- Includes memory limits, logging, and auto-restart settings

### 2. `nginx.conf`
- Nginx reverse proxy configuration
- Handles SSL termination, rate limiting, and load balancing
- Includes HTTP and HTTPS server blocks

### 3. `deploy.sh`
- Automated deployment script
- Installs dependencies, sets up PM2, and starts the application
- Includes error checking and helpful output

### 4. `DIGITAL_OCEAN_DEPLOYMENT.md`
- Complete deployment guide
- Step-by-step instructions from server setup to SSL
- Includes troubleshooting and maintenance tips

### 5. `DEPLOYMENT_QUICK_START.md`
- Quick reference guide
- Essential commands and checklist
- Fast setup for experienced users

## Files Updated

### 1. `package.json`
- Added deployment scripts:
  - `npm run deploy` - Run deployment script
  - `npm run pm2:start` - Start with PM2
  - `npm run pm2:stop` - Stop PM2 process
  - `npm run pm2:restart` - Restart PM2 process
  - `npm run pm2:logs` - View PM2 logs
  - `npm run pm2:status` - Check PM2 status

### 2. `env.production.example`
- Updated for Digital Ocean deployment
- Includes all necessary environment variables
- Better organized with sections

## Deployment Checklist

Before deploying, ensure you have:

- [ ] Digital Ocean droplet created (Ubuntu 22.04 LTS)
- [ ] Domain name configured (optional)
- [ ] MongoDB Atlas account and connection string
- [ ] SSL Commerz credentials
- [ ] ImageKit credentials (if using)
- [ ] Email credentials (for password reset)
- [ ] SSH access to droplet
- [ ] Environment variables prepared

## Quick Deployment Steps

1. **On your local machine:**
   ```bash
   git add .
   git commit -m "Add Digital Ocean deployment configuration"
   git push
   ```

2. **On your Digital Ocean droplet:**
   ```bash
   git clone https://github.com/your-username/prokrishi-server.git
   cd prokrishi-server/backend
   cp env.production.example .env
   nano .env  # Fill in your values
   chmod +x deploy.sh
   ./deploy.sh
   ```

3. **Setup Nginx:**
   ```bash
   sudo cp nginx.conf /etc/nginx/sites-available/prokrishi-backend
   sudo ln -s /etc/nginx/sites-available/prokrishi-backend /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

4. **Setup SSL (if using domain):**
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d api.yourdomain.com
   ```

## File Locations on Server

After deployment, files will be located at:

- Application: `~/prokrishi-server/backend/`
- PM2 config: `~/prokrishi-server/backend/ecosystem.config.js`
- Environment: `~/prokrishi-server/backend/.env`
- Logs: `~/prokrishi-server/backend/logs/`
- Nginx config: `/etc/nginx/sites-available/prokrishi-backend`
- Nginx logs: `/var/log/nginx/prokrishi-backend-*.log`

## Support

For detailed instructions, see:
- `DIGITAL_OCEAN_DEPLOYMENT.md` - Complete guide
- `DEPLOYMENT_QUICK_START.md` - Quick reference

