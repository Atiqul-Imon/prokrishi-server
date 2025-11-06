# One-Line Setup for Digital Ocean Droplet

## Quick Setup (Copy and paste these commands)

### Step 1: Connect to your droplet
```bash
ssh root@178.128.91.197
```

### Step 2: Run the complete setup (copy everything below and paste)

```bash
# Download and run setup script
cd ~ && curl -o- https://raw.githubusercontent.com/your-repo/prokrishi-server/main/backend/setup-droplet.sh | bash || {
  # If direct download fails, run commands manually:
  sudo apt update && sudo apt upgrade -y && \
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && \
  sudo apt install -y nodejs nginx git && \
  sudo npm install -g pm2 && \
  sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw --force enable && \
  cd ~ && git clone https://github.com/Atiqul-Imon/prokrishi-server.git && \
  cd prokrishi-server/backend && npm ci --production && \
  mkdir -p logs && cp env.production.example .env && \
  chmod +x deploy.sh && sudo cp nginx.conf /etc/nginx/sites-available/prokrishi-backend && \
  sudo ln -s /etc/nginx/sites-available/prokrishi-backend /etc/nginx/sites-enabled/ && \
  sudo rm -f /etc/nginx/sites-enabled/default && sudo nginx -t && sudo systemctl reload nginx && \
  echo "✅ Setup complete! Now edit .env file: nano .env"
}
```

### Step 3: Configure environment variables
```bash
cd ~/prokrishi-server/backend
nano .env
```

**Required values to set:**
- `MONGODB_URI` - Your MongoDB Atlas connection string
- `JWT_SECRET` - Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `JWT_REFRESH_SECRET` - Generate another one
- `CORS_ORIGIN` - Your frontend domain
- `FRONTEND_URL` - Your frontend URL
- `BACKEND_URL` - Your backend URL (e.g., https://api.prokrishihub.com)
- `SSL_STORE_ID` - SSL Commerz store ID
- `SSL_STORE_PASSWORD` - SSL Commerz password

### Step 4: Deploy the application
```bash
./deploy.sh
```

## Alternative: Manual Step-by-Step

If the one-liner doesn't work, follow these steps:

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install PM2 and Nginx
sudo npm install -g pm2
sudo apt install -y nginx git

# 4. Setup firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# 5. Clone repository
cd ~
git clone https://github.com/Atiqul-Imon/prokrishi-server.git
cd prokrishi-server/backend

# 6. Install dependencies
npm ci --production

# 7. Setup environment
cp env.production.example .env
nano .env  # Edit with your values

# 8. Setup Nginx
sudo cp nginx.conf /etc/nginx/sites-available/prokrishi-backend
sudo ln -s /etc/nginx/sites-available/prokrishi-backend /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# 9. Deploy
chmod +x deploy.sh
./deploy.sh
```

## Important Reminders

1. **MongoDB Atlas**: Add your droplet IP `178.128.91.197` to the whitelist
2. **Environment Variables**: Make sure all required values are set in `.env`
3. **Domain**: Update Nginx config with your domain if using one
4. **SSL**: Setup SSL certificate after domain is configured

## Verify Deployment

```bash
# Check PM2 status
pm2 status

# Check application health
curl http://localhost:3500/health

# View logs
pm2 logs prokrishi-backend
```

