#!/bin/bash

# Script to check if latest backend commit is deployed on Digital Ocean server
# Usage: ./scripts/check-deployment-status.sh

set -e

DROPLET_USER=${DROPLET_USER:-root}
DROPLET_IP=${DROPLET_IP:-178.128.107.215}
DROPLET_PATH=${DROPLET_PATH:-/root/prokrishi-server}
SSH_KEY=${SSH_KEY:-~/.ssh/id_rsa}

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Checking deployment status on Digital Ocean server...${NC}"
echo -e "📍 Server: ${DROPLET_USER}@${DROPLET_IP}"
echo -e "📁 Path: ${DROPLET_PATH}"
echo ""

# Get latest commit hash from local repository
LOCAL_COMMIT=$(cd "$(dirname "$0")/.." && git log --oneline -1 | awk '{print $1}')
LOCAL_MESSAGE=$(cd "$(dirname "$0")/.." && git log --oneline -1 | cut -d' ' -f2-)

echo -e "${BLUE}📋 Local Repository:${NC}"
echo -e "   Commit: ${GREEN}${LOCAL_COMMIT}${NC}"
echo -e "   Message: ${LOCAL_MESSAGE}"
echo ""

# Check server deployment status
echo -e "${BLUE}🌐 Server Status:${NC}"

if [ -f "$SSH_KEY" ]; then
    echo -e "   Using SSH key: ${SSH_KEY}"
    echo ""
    
    # Get server commit info
    SERVER_INFO=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ${DROPLET_USER}@${DROPLET_IP} "
        cd ${DROPLET_PATH} 2>/dev/null && {
            echo 'COMMIT:' \$(git log --oneline -1 | awk '{print \$1}') 2>/dev/null || echo 'COMMIT: not-found'
            echo 'MESSAGE:' \$(git log --oneline -1 | cut -d' ' -f2-) 2>/dev/null || echo 'MESSAGE: not-found'
            echo 'BRANCH:' \$(git branch --show-current 2>/dev/null || echo 'unknown')
            echo 'STATUS:' \$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ') 'uncommitted changes'
            echo 'REMOTE:' \$(git remote get-url origin 2>/dev/null || echo 'not-configured')
        } || {
            echo 'ERROR: Directory not found or git not initialized'
        }
    " 2>&1)
    
    SERVER_COMMIT=$(echo "$SERVER_INFO" | grep "^COMMIT:" | cut -d' ' -f2)
    SERVER_MESSAGE=$(echo "$SERVER_INFO" | grep "^MESSAGE:" | cut -d' ' -f2-)
    SERVER_BRANCH=$(echo "$SERVER_INFO" | grep "^BRANCH:" | cut -d' ' -f2)
    SERVER_STATUS=$(echo "$SERVER_INFO" | grep "^STATUS:" | cut -d' ' -f2-)
    SERVER_REMOTE=$(echo "$SERVER_INFO" | grep "^REMOTE:" | cut -d' ' -f2-)
    
    if [ "$SERVER_COMMIT" = "not-found" ] || [ -z "$SERVER_COMMIT" ]; then
        echo -e "   ${RED}❌ Could not get server commit info${NC}"
        echo -e "   ${YELLOW}   Error: ${SERVER_INFO}${NC}"
    else
        echo -e "   Commit: ${GREEN}${SERVER_COMMIT}${NC}"
        echo -e "   Message: ${SERVER_MESSAGE}"
        echo -e "   Branch: ${SERVER_BRANCH}"
        echo -e "   ${SERVER_STATUS}"
        echo -e "   Remote: ${SERVER_REMOTE}"
        echo ""
        
        # Compare commits
        if [ "$LOCAL_COMMIT" = "$SERVER_COMMIT" ]; then
            echo -e "${GREEN}✅ Latest commit is deployed!${NC}"
            echo -e "   Local and server commits match: ${GREEN}${LOCAL_COMMIT}${NC}"
        else
            echo -e "${YELLOW}⚠️  Latest commit is NOT deployed${NC}"
            echo -e "   Local:  ${GREEN}${LOCAL_COMMIT}${NC}"
            echo -e "   Server: ${YELLOW}${SERVER_COMMIT}${NC}"
            echo ""
            echo -e "${BLUE}💡 To deploy latest changes, run:${NC}"
            echo -e "   ${GREEN}./scripts/deploy-to-droplet.sh${NC}"
        fi
        
        # Check PM2 status
        echo ""
        echo -e "${BLUE}🔄 PM2 Status:${NC}"
        PM2_STATUS=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ${DROPLET_USER}@${DROPLET_IP} "pm2 status prokrishi-backend 2>/dev/null || echo 'not-running'" 2>&1)
        echo "$PM2_STATUS" | grep -E "(prokrishi-backend|online|offline|not-running)" || echo "   ${YELLOW}Could not get PM2 status${NC}"
    fi
else
    echo -e "   ${YELLOW}⚠️  SSH key not found at ${SSH_KEY}${NC}"
    echo -e "   ${BLUE}💡 Manual check commands:${NC}"
    echo ""
    echo -e "   ${GREEN}ssh ${DROPLET_USER}@${DROPLET_IP}${NC}"
    echo -e "   ${GREEN}cd ${DROPLET_PATH}${NC}"
    echo -e "   ${GREEN}git log --oneline -1${NC}"
    echo -e "   ${GREEN}git status${NC}"
    echo ""
    echo -e "   ${BLUE}Expected latest commit: ${GREEN}${LOCAL_COMMIT}${NC}"
fi

echo ""

