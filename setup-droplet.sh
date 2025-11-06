#!/bin/bash

# Complete Digital Ocean Droplet Setup Script
# Run this script on your droplet after SSH connection

set -e

echo "🚀 Starting Prokrishi Backend Setup on Digital Ocean Droplet..."
echo "=========================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Update system
echo -e "${GREEN}📦 Updating system packages...${NC}"
sudo apt update
sudo apt upgrade -y

# Install Node.js 20
echo -e "${GREEN}📦 Installing Node.js 20...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo -e "${YELLOW}⚠️  Node.js already installed: $(node -v)${NC}"
fi

# Verify Node.js installation
NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js version: $NODE_VERSION${NC}"

# Install PM2
echo -e "${GREEN}📦 Installing PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
else
    echo -e "${YELLOW}⚠️  PM2 already installed: $(pm2 -v)${NC}"
fi

# Install Nginx
echo -e "${GREEN}📦 Installing Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
else
    echo -e "${YELLOW}⚠️  Nginx already installed${NC}"
fi

# Install Git
echo -e "${GREEN}📦 Installing Git...${NC}"
if ! command -v git &> /dev/null; then
    sudo apt install -y git
else
    echo -e "${YELLOW}⚠️  Git already installed${NC}"
fi

# Setup Firewall
echo -e "${GREEN}🔥 Configuring firewall...${NC}"
sudo ufw --force enable
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'

# Create application directory
echo -e "${GREEN}📁 Setting up application directory...${NC}"
cd ~
if [ ! -d "prokrishi-server" ]; then
    echo -e "${YELLOW}⚠️  Repository not found. Please clone it manually:${NC}"
    echo -e "${YELLOW}   git clone https://github.com/Atiqul-Imon/prokrishi-server.git${NC}"
    echo -e "${YELLOW}   Or if using a different repo structure, adjust the path accordingly.${NC}"
    exit 1
fi

cd prokrishi-server/backend

# Install dependencies
echo -e "${GREEN}📦 Installing npm dependencies...${NC}"
npm ci --production

# Create logs directory
mkdir -p logs

# Setup environment file
if [ ! -f .env ]; then
    echo -e "${GREEN}📝 Creating .env file from template...${NC}"
    cp env.production.example .env
    echo -e "${YELLOW}⚠️  IMPORTANT: Please edit .env file with your production values!${NC}"
    echo -e "${YELLOW}   Run: nano .env${NC}"
else
    echo -e "${YELLOW}⚠️  .env file already exists${NC}"
fi

# Make deploy script executable
chmod +x deploy.sh

# Setup Nginx
echo -e "${GREEN}🌐 Setting up Nginx...${NC}"
if [ -f nginx.conf ]; then
    sudo cp nginx.conf /etc/nginx/sites-available/prokrishi-backend
    if [ ! -f /etc/nginx/sites-enabled/prokrishi-backend ]; then
        sudo ln -s /etc/nginx/sites-available/prokrishi-backend /etc/nginx/sites-enabled/
    fi
    # Remove default site
    sudo rm -f /etc/nginx/sites-enabled/default
    # Test Nginx config
    sudo nginx -t && sudo systemctl reload nginx
    echo -e "${GREEN}✅ Nginx configured${NC}"
else
    echo -e "${RED}❌ nginx.conf not found!${NC}"
fi

echo ""
echo -e "${GREEN}=========================================="
echo -e "✅ Setup completed successfully!${NC}"
echo -e "${GREEN}=========================================="
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo -e "1. Edit .env file: ${GREEN}nano .env${NC}"
echo -e "2. Fill in your production values (MongoDB, JWT secrets, etc.)"
echo -e "3. Deploy application: ${GREEN}./deploy.sh${NC}"
echo -e "4. Or manually: ${GREEN}pm2 start ecosystem.config.js --env production${NC}"
echo ""
echo -e "${YELLOW}💡 Don't forget to:${NC}"
echo -e "   - Add droplet IP (178.128.91.197) to MongoDB Atlas whitelist"
echo -e "   - Update CORS_ORIGIN in .env with your frontend domain"
echo -e "   - Generate secure JWT secrets"
echo ""

