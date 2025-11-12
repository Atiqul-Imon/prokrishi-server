#!/bin/bash

# Script to check Redis environment variables on Digital Ocean Droplet
# Usage: Run this script on your Digital Ocean droplet

set -e

echo "🔍 Checking Redis Environment Variables on Digital Ocean Droplet..."
echo "================================================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Common paths where .env file might be located
ENV_PATHS=(
    "$HOME/prokrishi-server/backend/.env"
    "$HOME/prokrishi-v2/backend/.env"
    "$HOME/backend/.env"
    "./.env"
    "/home/prokrishi/prokrishi-server/backend/.env"
    "/home/prokrishi/prokrishi-v2/backend/.env"
)

ENV_FILE=""

# Find .env file
echo -e "${BLUE}📁 Searching for .env file...${NC}"
for path in "${ENV_PATHS[@]}"; do
    if [ -f "$path" ]; then
        ENV_FILE="$path"
        echo -e "${GREEN}✅ Found .env file at: $ENV_FILE${NC}"
        break
    fi
done

if [ -z "$ENV_FILE" ]; then
    echo -e "${RED}❌ .env file not found in common locations${NC}"
    echo -e "${YELLOW}💡 Please specify the path manually or create one:${NC}"
    echo -e "   nano ~/prokrishi-server/backend/.env"
    exit 1
fi

echo ""
echo "================================================================"
echo "📋 Redis Environment Variables:"
echo "================================================================"

# Check each Redis-related variable
REDIS_VARS=(
    "REDIS_URL"
    "REDIS_HOST"
    "REDIS_PORT"
    "REDIS_PASSWORD"
    "UPSTASH_REDIS_REST_HOST"
    "UPSTASH_REDIS_REST_PORT"
    "UPSTASH_REDIS_REST_PASSWORD"
)

REDIS_FOUND=false

for var in "${REDIS_VARS[@]}"; do
    # Source the .env file and check for the variable
    value=$(grep -E "^${var}=" "$ENV_FILE" 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "")
    
    if [ -n "$value" ] && [ "$value" != "" ]; then
        REDIS_FOUND=true
        # Hide sensitive values
        if [[ "$var" == *"PASSWORD"* ]] || [[ "$var" == *"SECRET"* ]]; then
            display_value="***HIDDEN*** (${#value} characters)"
        else
            display_value="$value"
        fi
        echo -e "${GREEN}✅ ${var}=${display_value}${NC}"
    else
        echo -e "${YELLOW}⚠️  ${var}= (not set)${NC}"
    fi
done

echo ""
echo "================================================================"
echo "📊 Redis Configuration Status:"
echo "================================================================"

# Check if Redis is configured
if [ "$REDIS_FOUND" = true ]; then
    echo -e "${GREEN}✅ Redis environment variables are configured${NC}"
    
    # Check which Redis provider is configured
    if grep -qE "^UPSTASH_REDIS_REST_HOST=" "$ENV_FILE"; then
        echo -e "${BLUE}📌 Redis Provider: Upstash${NC}"
    elif grep -qE "^REDIS_URL=" "$ENV_FILE"; then
        echo -e "${BLUE}📌 Redis Provider: Redis URL${NC}"
    elif grep -qE "^REDIS_HOST=" "$ENV_FILE"; then
        echo -e "${BLUE}📌 Redis Provider: Self-hosted/Redis Cloud${NC}"
    fi
else
    echo -e "${RED}❌ No Redis environment variables found${NC}"
    echo ""
    echo -e "${YELLOW}💡 To configure Redis, add these to your .env file:${NC}"
    echo ""
    echo -e "${BLUE}Option 1: Upstash Redis${NC}"
    echo "UPSTASH_REDIS_REST_HOST=your-host.upstash.io"
    echo "UPSTASH_REDIS_REST_PORT=6379"
    echo "UPSTASH_REDIS_REST_PASSWORD=your-password"
    echo ""
    echo -e "${BLUE}Option 2: Redis URL${NC}"
    echo "REDIS_URL=redis://host:port"
    echo ""
    echo -e "${BLUE}Option 3: Redis Host/Port${NC}"
    echo "REDIS_HOST=your-host"
    echo "REDIS_PORT=6379"
    echo "REDIS_PASSWORD=your-password"
fi

echo ""
echo "================================================================"
echo "🧪 Testing Redis Connection:"
echo "================================================================"

# Load environment variables
set -a
source "$ENV_FILE"
set +a

# Run the Redis check script if it exists
if [ -f "scripts/check-redis-production.js" ]; then
    echo -e "${BLUE}Running Redis connection test...${NC}"
    node scripts/check-redis-production.js
elif [ -f "../scripts/check-redis-production.js" ]; then
    echo -e "${BLUE}Running Redis connection test...${NC}"
    node ../scripts/check-redis-production.js
else
    echo -e "${YELLOW}⚠️  Redis check script not found${NC}"
    echo -e "${YELLOW}💡 You can test Redis manually by running:${NC}"
    echo "   node scripts/check-redis-production.js"
fi

echo ""
echo "================================================================"
echo "✨ Check completed!"
echo "================================================================"

