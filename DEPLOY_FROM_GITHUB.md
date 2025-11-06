# Deploy from GitHub - Digital Ocean

## Quick Deployment Steps

### Step 1: Connect to Your Droplet
```bash
ssh root@178.128.91.197
```

### Step 2: One-Command Setup (Copy and paste everything below)

```bash
# Install Node.js, PM2, Nginx, and Git
sudo apt update && sudo apt upgrade -y && \
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && \
sudo apt install -y nodejs nginx git && \
sudo npm install -g pm2 && \
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw --force enable && \
cd ~ && git clone https://github.com/Atiqul-Imon/prokrishi-server.git && \
cd prokrishi-server/backend && npm ci --production && \
mkdir -p logs && cp env.production.example .env && \
chmod +x deploy.sh setup-droplet.sh && \
sudo cp nginx.conf /etc/nginx/sites-available/prokrishi-backend && \
sudo ln -s /etc/nginx/sites-available/prokrishi-backend /etc/nginx/sites-enabled/ && \
sudo rm -f /etc/nginx/sites-enabled/default && \
sudo nginx -t && sudo systemctl reload nginx && \
echo "✅ Setup complete! Repository cloned from GitHub."
echo "📝 Next: Edit .env file with: nano .env"
```

### Step 3: Configure Environment Variables

```bash
cd ~/prokrishi-server/backend
nano .env
```

**Fill in these required values:**

1. **MongoDB Atlas Connection:**
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/prokrishi?retryWrites=true&w=majority
   ```

2. **Generate JWT Secrets:**
   ```bash
   # Run these commands to generate secure secrets
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Copy the output and use it for `JWT_SECRET` and `JWT_REFRESH_SECRET`

3. **Update URLs:**
   ```
   CORS_ORIGIN=https://your-frontend-domain.com
   FRONTEND_URL=https://your-frontend-domain.com
   BACKEND_URL=https://api.your-domain.com
   ```

4. **SSL Commerz (if using payments):**
   ```
   SSL_STORE_ID=your_store_id
   SSL_STORE_PASSWORD=your_store_password
   ```

5. **ImageKit (if using):**
   ```
   IMAGEKIT_PUBLIC_KEY=your_key
   IMAGEKIT_PRIVATE_KEY=your_key
   IMAGEKIT_URL_ENDPOINT=your_endpoint
   ```

### Step 4: Add Droplet IP to MongoDB Atlas

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Navigate to **Network Access**
3. Click **Add IP Address**
4. Add: `178.128.91.197`
5. Or temporarily allow all: `0.0.0.0/0` (less secure)

### Step 5: Deploy the Application

```bash
cd ~/prokrishi-server/backend
./deploy.sh
```

Or manually:
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup systemd
```

### Step 6: Verify Deployment

```bash
# Check PM2 status
pm2 status

# Check application health
curl http://localhost:3500/health

# View logs
pm2 logs prokrishi-backend
```

### Step 7: Update Nginx Configuration (Optional)

If you have a domain name:

```bash
sudo nano /etc/nginx/sites-available/prokrishi-backend
```

Update the `server_name` line:
```
server_name api.your-domain.com www.api.your-domain.com;
```

Then reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Step 8: Setup SSL Certificate (Optional)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.your-domain.com -d www.api.your-domain.com
```

## Updating from GitHub

When you push new changes to GitHub, update on the droplet:

```bash
cd ~/prokrishi-server/backend
git pull origin main
npm ci --production
pm2 restart prokrishi-backend
```

## Useful Commands

```bash
# PM2 Commands
pm2 status
pm2 logs prokrishi-backend
pm2 restart prokrishi-backend
pm2 stop prokrishi-backend

# Nginx Commands
sudo nginx -t
sudo systemctl reload nginx
sudo tail -f /var/log/nginx/prokrishi-backend-error.log

# Application Logs
pm2 logs prokrishi-backend
tail -f ~/prokrishi-server/backend/logs/error.log
```

## Troubleshooting

**Application not starting?**
```bash
pm2 logs prokrishi-backend --lines 50
cd ~/prokrishi-server/backend
node index.js  # Test directly
```

**Nginx 502 error?**
```bash
# Check if app is running
pm2 status
curl http://localhost:3500/health

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

**Can't connect to MongoDB?**
- Verify IP is whitelisted in MongoDB Atlas
- Check connection string in `.env`
- Test connection: `mongosh "your_connection_string"`

## Repository Information

- **GitHub URL:** https://github.com/Atiqul-Imon/prokrishi-server.git
- **Backend Path:** `prokrishi-server/backend/`
- **Droplet IP:** 178.128.91.197

## Next Steps

1. ✅ Code pushed to GitHub
2. ✅ Droplet created
3. ⏳ Setup server (run Step 2)
4. ⏳ Configure environment (Step 3)
5. ⏳ Deploy application (Step 5)
6. ⏳ Setup domain and SSL (optional)

Your backend is now ready to deploy from GitHub! 🚀

