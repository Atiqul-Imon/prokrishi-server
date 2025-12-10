#!/bin/bash

# Script to add Upstash Redis to Digital Ocean Droplet
# Run this from your local machine (where SSH key is)

# IMPORTANT: Replace these with your actual values before running!
DROPLET_IP="YOUR_DROPLET_IP_HERE"
REDIS_URL="rediss://default:YOUR_REDIS_PASSWORD@YOUR_REDIS_HOST:6379"

# Parse Redis URL
REDIS_HOST="YOUR_REDIS_HOST.upstash.io"
REDIS_PORT="6379"
REDIS_PASSWORD="YOUR_REDIS_PASSWORD_HERE"

echo "🔧 Adding Redis configuration to Digital Ocean Droplet..."
echo "📡 Droplet IP: $DROPLET_IP"
echo ""

# SSH into droplet and add Redis config
ssh root@$DROPLET_IP << 'ENDSSH'
cd ~/prokrishi-server/backend || cd /root/prokrishi-server/backend || cd /home/$(whoami)/prokrishi-server/backend

# Backup current .env
if [ -f .env ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backed up .env file"
fi

# Remove old Redis config
sed -i '/^REDIS_HOST=/d' .env
sed -i '/^REDIS_PORT=/d' .env
sed -i '/^REDIS_PASSWORD=/d' .env
sed -i '/^REDIS_URL=/d' .env
sed -i '/^UPSTASH_REDIS_REST_HOST=/d' .env
sed -i '/^UPSTASH_REDIS_REST_PORT=/d' .env
sed -i '/^UPSTASH_REDIS_REST_PASSWORD=/d' .env

# Add new Upstash Redis config
echo "" >> .env
echo "# Upstash Redis Configuration (TCP)" >> .env
echo "UPSTASH_REDIS_REST_HOST=$REDIS_HOST" >> .env
echo "UPSTASH_REDIS_REST_PORT=$REDIS_PORT" >> .env
echo "UPSTASH_REDIS_REST_PASSWORD=$REDIS_PASSWORD" >> .env
echo "" >> .env
echo "# Alternative: Redis URL format" >> .env
echo "REDIS_URL=\"$REDIS_URL\"" >> .env

echo "✅ Added Redis configuration to .env"
echo ""
echo "📋 Current Redis config:"
grep -E "REDIS|UPSTASH" .env | grep -v "^#"

ENDSSH

echo ""
echo "✅ Redis configuration added!"
echo ""
echo "🔄 Next steps:"
echo "1. Restart the backend: ssh root@$DROPLET_IP 'pm2 restart prokrishi-backend'"
echo "2. Check logs: ssh root@$DROPLET_IP 'pm2 logs prokrishi-backend | grep -i redis'"
echo "3. Verify: curl https://your-backend-domain.com/health | jq '.redis'"

