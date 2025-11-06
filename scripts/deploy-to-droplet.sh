#!/bin/bash

# Automated deployment script for Digital Ocean Droplet
# This script can be run locally or from CI/CD

set -e

# Configuration (can be overridden by environment variables)
DROPLET_USER=${DROPLET_USER:-root}
DROPLET_IP=${DROPLET_IP:-178.128.91.197}
DROPLET_PATH=${DROPLET_PATH:-/root/prokrishi-server/backend}
SSH_KEY=${SSH_KEY:-~/.ssh/id_rsa}

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🚀 Starting deployment to Digital Ocean Droplet...${NC}"
echo -e "📍 Target: ${DROPLET_USER}@${DROPLET_IP}"
echo -e "📁 Path: ${DROPLET_PATH}"
echo ""

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}❌ SSH key not found at $SSH_KEY${NC}"
    exit 1
fi

# Create remote deployment script
REMOTE_SCRIPT=$(cat << 'EOF'
#!/bin/bash
set -e

cd $DROPLET_PATH

echo "📦 Pulling latest changes from GitHub..."
git fetch origin
git reset --hard origin/main

echo "📦 Installing/updating dependencies..."
npm ci --production

echo "🔄 Restarting application with PM2..."
if pm2 list | grep -q "prokrishi-backend"; then
    pm2 restart prokrishi-backend
else
    pm2 start ecosystem.config.js --env production
fi

echo "💾 Saving PM2 process list..."
pm2 save

echo "✅ Deployment completed!"
pm2 status
EOF
)

# Deploy to droplet
echo -e "${GREEN}📤 Connecting to droplet...${NC}"
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ${DROPLET_USER}@${DROPLET_IP} << ENDSSH
  export DROPLET_PATH=${DROPLET_PATH}
  $REMOTE_SCRIPT
ENDSSH

# Verify deployment
echo -e "${GREEN}🔍 Verifying deployment...${NC}"
sleep 3

if ssh -i "$SSH_KEY" ${DROPLET_USER}@${DROPLET_IP} "curl -f -s http://localhost:3500/health > /dev/null"; then
    echo -e "${GREEN}✅ Health check passed!${NC}"
else
    echo -e "${YELLOW}⚠️  Health check failed, but deployment may still be in progress${NC}"
fi

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"

