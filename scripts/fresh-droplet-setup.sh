#!/bin/bash

# Fresh Droplet Setup Script for Prokrishi Backend
# Run this on a fresh Ubuntu 22.04 droplet
# Usage: curl -fsSL https://your-repo-url/setup.sh | bash
# OR: wget -O- https://your-repo-url/setup.sh | bash

set -e

echo "🚀 Fresh Droplet Setup for Prokrishi Backend"
echo "============================================="
echo ""

# Configuration
REPO_URL="https://github.com/Atiqul-Imon/prokrishi-server.git"
APP_DIR="prokrishi-server/backend"
DOMAIN="api.prokrishihub.com"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

# 1. System Update
echo "1️⃣ Updating system packages..."
sudo apt update -qq
sudo apt upgrade -y -qq
print_status "System updated"

# 2. Install Node.js 20
echo ""
echo "2️⃣ Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1
sudo apt install -y nodejs >/dev/null 2>&1
print_status "Node.js $(node -v) installed"

# 3. Install PM2, Nginx, Git
echo ""
echo "3️⃣ Installing PM2, Nginx, and Git..."
sudo npm install -g pm2 >/dev/null 2>&1
sudo apt install -y nginx git >/dev/null 2>&1
print_status "PM2, Nginx, Git installed"

# 4. Configure Firewall
echo ""
echo "4️⃣ Configuring firewall (UFW)..."
sudo ufw allow OpenSSH >/dev/null 2>&1
sudo ufw allow 'Nginx Full' >/dev/null 2>&1
sudo ufw --force enable >/dev/null 2>&1
print_status "Firewall configured"

# 5. Clone Repository
echo ""
echo "5️⃣ Cloning backend repository..."
cd ~
if [ -d "$APP_DIR" ]; then
    print_warning "Repository already exists, pulling latest changes..."
    cd "$APP_DIR"
    git pull origin main
else
    git clone "$REPO_URL" >/dev/null 2>&1
    cd "$APP_DIR"
fi
print_status "Repository cloned/updated"

# 6. Install Dependencies
echo ""
echo "6️⃣ Installing application dependencies..."
npm ci --production >/dev/null 2>&1
print_status "Dependencies installed"

# 7. Setup Environment Variables
echo ""
echo "7️⃣ Setting up environment variables..."
mkdir -p logs
if [ ! -f .env ]; then
    if [ -f env.production.example ]; then
        cp env.production.example .env
        print_warning ".env file created from env.production.example"
        print_warning "⚠️  IMPORTANT: Edit .env file with your actual values!"
        echo ""
        echo "Run: nano .env"
        echo "Fill in: MONGODB_URI, JWT_SECRET, CORS_ORIGIN, etc."
    else
        print_error "env.production.example not found!"
    fi
else
    print_status ".env file already exists"
fi

# 8. Configure Nginx
echo ""
echo "8️⃣ Configuring Nginx..."
if [ -f nginx.conf ]; then
    sudo cp nginx.conf /etc/nginx/sites-available/prokrishi-backend
    sudo ln -sf /etc/nginx/sites-available/prokrishi-backend /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t >/dev/null 2>&1
    sudo systemctl reload nginx >/dev/null 2>&1
    print_status "Nginx configured"
else
    print_error "nginx.conf not found!"
fi

# 9. Start Backend with PM2
echo ""
echo "9️⃣ Starting backend with PM2..."
if [ -f deploy.sh ]; then
    chmod +x deploy.sh
    ./deploy.sh >/dev/null 2>&1
    print_status "Backend started with PM2"
elif [ -f ecosystem.config.cjs ] || [ -f ecosystem.config.js ]; then
    pm2 start ecosystem.config.cjs --env production 2>/dev/null || pm2 start ecosystem.config.js --env production
    pm2 save
    print_status "Backend started with PM2"
else
    print_warning "No deployment script found, starting manually..."
    pm2 start index.js --name prokrishi-backend
    pm2 save
fi

# 10. Verify Backend
echo ""
echo "🔟 Verifying backend..."
sleep 3
if curl -s http://localhost:3500/health >/dev/null 2>&1; then
    print_status "Backend is running and responding"
else
    print_warning "Backend may not be responding yet, check with: pm2 status"
fi

# Summary
echo ""
echo "════════════════════════════════════════════════"
echo "✅ Fresh Droplet Setup Complete!"
echo "════════════════════════════════════════════════"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Edit environment variables:"
echo "   cd ~/$APP_DIR"
echo "   nano .env"
echo ""
echo "2. Add MongoDB Atlas IP whitelist:"
echo "   - Add your droplet IP to MongoDB Atlas"
echo "   - IP: $(curl -s ifconfig.me)"
echo ""
echo "3. Set up SSL certificate:"
echo "   sudo apt install -y certbot python3-certbot-nginx"
echo "   sudo certbot --nginx -d $DOMAIN \\"
echo "     --non-interactive \\"
echo "     --agree-tos \\"
echo "     --email your-email@example.com \\"
echo "     --redirect"
echo ""
echo "4. Verify everything:"
echo "   pm2 status"
echo "   curl http://localhost/health"
echo "   curl https://$DOMAIN/health"
echo ""
echo "5. Update DNS (if IP changed):"
echo "   - Update Cloudflare A record for $DOMAIN"
echo "   - New IP: $(curl -s ifconfig.me)"
echo ""
echo "════════════════════════════════════════════════"

