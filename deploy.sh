#!/bin/bash

# Prokrishi Backend Deployment Script for Digital Ocean
# Usage: ./deploy.sh

set -e  # Exit on error

echo "🚀 Starting Prokrishi Backend Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}❌ Please do not run as root${NC}"
   exit 1
fi

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo -e "${GREEN}📁 Working directory: $SCRIPT_DIR${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from env.production.example...${NC}"
    if [ -f env.production.example ]; then
        cp env.production.example .env
        echo -e "${YELLOW}⚠️  Please update .env file with your production values!${NC}"
    else
        echo -e "${RED}❌ env.production.example not found!${NC}"
        exit 1
    fi
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version 18 or higher is required. Current version: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js version: $(node -v)${NC}"

# Install/Update dependencies
echo -e "${GREEN}📦 Installing dependencies...${NC}"
npm ci --production

# Create logs directory if it doesn't exist
mkdir -p logs

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 not found. Installing PM2 globally...${NC}"
    npm install -g pm2
fi

echo -e "${GREEN}✅ PM2 version: $(pm2 -v)${NC}"

# Stop existing PM2 process if running
echo -e "${GREEN}🛑 Stopping existing PM2 processes...${NC}"
pm2 stop prokrishi-backend 2>/dev/null || true
pm2 delete prokrishi-backend 2>/dev/null || true

# Start application with PM2
echo -e "${GREEN}🚀 Starting application with PM2...${NC}"
pm2 start ecosystem.config.js --env production

# Save PM2 process list
pm2 save

# Setup PM2 startup script
echo -e "${GREEN}⚙️  Setting up PM2 startup script...${NC}"
pm2 startup systemd -u $USER --hp $HOME | grep -v "PM2" | sudo bash || true

# Show PM2 status
echo -e "${GREEN}📊 PM2 Status:${NC}"
pm2 status

# Show logs
echo -e "${GREEN}📋 Recent logs:${NC}"
pm2 logs prokrishi-backend --lines 20 --nostream

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${YELLOW}💡 Useful commands:${NC}"
echo -e "   View logs: ${GREEN}pm2 logs prokrishi-backend${NC}"
echo -e "   View status: ${GREEN}pm2 status${NC}"
echo -e "   Restart: ${GREEN}pm2 restart prokrishi-backend${NC}"
echo -e "   Stop: ${GREEN}pm2 stop prokrishi-backend${NC}"

