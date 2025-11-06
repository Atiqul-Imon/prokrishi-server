# Quick Deployment Guide - Digital Ocean

## Quick Setup (5 minutes)

### 1. On Your Droplet

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git

# Install PM2
sudo npm install -g pm2

# Clone and setup
git clone https://github.com/your-username/prokrishi-server.git
cd prokrishi-server/backend
npm ci --production

# Configure
cp env.production.example .env
nano .env  # Fill in your values

# Deploy
chmod +x deploy.sh
./deploy.sh
```

### 2. Setup Nginx

```bash
sudo cp nginx.conf /etc/nginx/sites-available/prokrishi-backend
sudo ln -s /etc/nginx/sites-available/prokrishi-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Setup SSL (Optional)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

## Essential Commands

```bash
# PM2
pm2 status                    # Check status
pm2 logs prokrishi-backend    # View logs
pm2 restart prokrishi-backend # Restart

# Nginx
sudo nginx -t                 # Test config
sudo systemctl reload nginx   # Reload

# Application
curl http://localhost:3500/health  # Health check
```

## Environment Variables Checklist

- [ ] `MONGODB_URI` - MongoDB Atlas connection string
- [ ] `JWT_SECRET` - Generate secure random string
- [ ] `JWT_REFRESH_SECRET` - Generate secure random string
- [ ] `CORS_ORIGIN` - Your frontend domain
- [ ] `FRONTEND_URL` - Your frontend URL
- [ ] `BACKEND_URL` - Your backend URL
- [ ] `SSL_STORE_ID` - SSL Commerz store ID
- [ ] `SSL_STORE_PASSWORD` - SSL Commerz password
- [ ] `IMAGEKIT_*` - ImageKit credentials

## Generate Secure Secrets

```bash
# JWT Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Cookie Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Troubleshooting

**502 Bad Gateway?**
```bash
pm2 status
pm2 logs prokrishi-backend
curl http://localhost:3500/health
```

**Application not starting?**
```bash
pm2 logs prokrishi-backend --lines 50
tail -f logs/error.log
```

**CORS errors?**
- Check `CORS_ORIGIN` in `.env`
- Verify frontend domain is included
- Check Nginx CORS headers

## Full Documentation

See `DIGITAL_OCEAN_DEPLOYMENT.md` for complete guide.

