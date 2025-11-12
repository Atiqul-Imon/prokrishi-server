#!/bin/bash

# Complete SSL Setup Script for DNS-Only Cloudflare
# Run this on your Digital Ocean droplet: ssh root@178.128.91.197

set -e

DOMAIN="api.prokrishihub.com"
EMAIL="admin@prokrishihub.com"  # CHANGE THIS TO YOUR EMAIL
BACKEND_PORT=3500

echo "🔐 Complete SSL Setup for $DOMAIN"
echo "=================================="
echo ""

# Function to check command success
check_status() {
    if [ $? -eq 0 ]; then
        echo "✅ $1"
    else
        echo "❌ $1 failed"
        return 1
    fi
}

# 1. Check backend status
echo "1️⃣ Checking backend status..."
if pm2 list | grep -q "prokrishi-backend.*online"; then
    echo "✅ Backend is running"
    pm2 status | grep prokrishi-backend
else
    echo "⚠️  Backend is not running, starting..."
    cd ~/prokrishi-server || { echo "❌ Cannot find ~/prokrishi-server"; exit 1; }
    if [ -f ecosystem.config.cjs ]; then
        pm2 start ecosystem.config.cjs --env production
    elif [ -f ecosystem.config.js ]; then
        pm2 start ecosystem.config.js --env production
    else
        pm2 start index.js --name prokrishi-backend
    fi
    pm2 save
    sleep 3
    check_status "Backend started"
fi

# Test backend locally
echo ""
echo "2️⃣ Testing backend on port $BACKEND_PORT..."
if curl -s http://localhost:$BACKEND_PORT/health > /dev/null; then
    echo "✅ Backend responds on port $BACKEND_PORT"
    curl -s http://localhost:$BACKEND_PORT/health | head -3
else
    echo "❌ Backend not responding on port $BACKEND_PORT"
    echo "📋 Checking backend logs..."
    pm2 logs prokrishi-backend --lines 20 --nostream | tail -10
    exit 1
fi

# 3. Install Nginx if not installed
echo ""
echo "3️⃣ Checking Nginx..."
if ! command -v nginx &> /dev/null; then
    echo "📦 Installing Nginx..."
    sudo apt update -qq
    sudo apt install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    check_status "Nginx installed"
else
    echo "✅ Nginx is installed: $(nginx -v 2>&1)"
fi

# Ensure Nginx is running
if ! systemctl is-active --quiet nginx; then
    echo "🔄 Starting Nginx..."
    sudo systemctl start nginx
    sudo systemctl enable nginx
fi
check_status "Nginx is running"

# 4. Configure Nginx for HTTP
echo ""
echo "4️⃣ Configuring Nginx for HTTP (required for SSL validation)..."

# Create Nginx configuration
sudo tee /etc/nginx/sites-available/prokrishi-backend > /dev/null << NGINX_HTTP_CONFIG
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} 178.128.91.197;

    # Increase body size for file uploads
    client_max_body_size 50M;

    # Backend proxy
    location / {
        proxy_pass http://localhost:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:${BACKEND_PORT}/health;
        access_log off;
    }

    # Let's Encrypt challenge directory
    location ~ /.well-known/acme-challenge {
        allow all;
        root /var/www/html;
    }
}
NGINX_HTTP_CONFIG

# Enable site
sudo ln -sf /etc/nginx/sites-available/prokrishi-backend /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
echo "🧪 Testing Nginx configuration..."
if sudo nginx -t 2>&1 | grep -q "successful"; then
    echo "✅ Nginx configuration is valid"
    sudo systemctl reload nginx
    check_status "Nginx reloaded"
else
    echo "❌ Nginx configuration has errors:"
    sudo nginx -t
    exit 1
fi

# 5. Configure firewall
echo ""
echo "5️⃣ Configuring firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 80/tcp >/dev/null 2>&1 || true
    sudo ufw allow 443/tcp >/dev/null 2>&1 || true
    sudo ufw allow 22/tcp >/dev/null 2>&1 || true
    sudo ufw --force enable >/dev/null 2>&1 || true
    echo "✅ Firewall configured"
    sudo ufw status | grep -E "(80|443|22)"
else
    echo "⚠️  UFW not found, firewall might need manual configuration"
fi

# 6. Verify HTTP is accessible
echo ""
echo "6️⃣ Verifying HTTP accessibility..."
sleep 2

# Test from server itself
if curl -s -H "Host: $DOMAIN" http://localhost/health > /dev/null; then
    echo "✅ HTTP is accessible from server"
else
    echo "⚠️  HTTP might not be accessible externally"
fi

# Check DNS
echo ""
echo "7️⃣ Verifying DNS..."
DNS_IP=$(dig +short $DOMAIN | tail -1 || echo "")
if [ "$DNS_IP" = "178.128.91.197" ]; then
    echo "✅ DNS is correct: $DOMAIN → $DNS_IP"
else
    echo "⚠️  DNS check: $DOMAIN → $DNS_IP (expected: 178.128.91.197)"
    echo "   If different, wait for DNS propagation"
fi

# 8. Install Certbot
echo ""
echo "8️⃣ Installing Certbot..."
if ! command -v certbot &> /dev/null; then
    sudo apt update -qq
    sudo apt install -y certbot python3-certbot-nginx
    check_status "Certbot installed"
else
    echo "✅ Certbot is already installed: $(certbot --version 2>&1 | head -1)"
fi

# 9. Get SSL certificate
echo ""
echo "9️⃣ Obtaining SSL certificate from Let's Encrypt..."
echo "   Domain: $DOMAIN"
echo "   Email: $EMAIL"
echo ""
echo "⚠️  Important: Make sure DNS is pointing to this server!"
read -p "Press Enter to continue, or Ctrl+C to cancel..."

# Get certificate
sudo certbot --nginx -d $DOMAIN \
  --non-interactive \
  --agree-tos \
  --email $EMAIL \
  --redirect \
  --cert-name $DOMAIN

check_status "SSL certificate obtained"

# 10. Verify certificate
echo ""
echo "🔟 Verifying SSL certificate..."
sleep 3

if sudo certbot certificates | grep -q "$DOMAIN"; then
    echo "✅ SSL certificate is installed"
    echo ""
    echo "📋 Certificate details:"
    sudo certbot certificates | grep -A 15 "$DOMAIN"
else
    echo "❌ SSL certificate verification failed"
    exit 1
fi

# 11. Test HTTPS
echo ""
echo "1️⃣1️⃣ Testing HTTPS..."
sleep 2

if curl -s https://$DOMAIN/health > /dev/null; then
    echo "✅ HTTPS is working!"
    echo ""
    echo "Health check response:"
    curl -s https://$DOMAIN/health | head -5
else
    echo "⚠️  HTTPS test failed"
    echo "Check Nginx error logs: sudo tail -f /var/log/nginx/error.log"
fi

# 12. Setup auto-renewal
echo ""
echo "1️⃣2️⃣ Setting up SSL auto-renewal..."
sudo systemctl enable certbot.timer >/dev/null 2>&1
sudo systemctl start certbot.timer >/dev/null 2>&1

if systemctl is-active --quiet certbot.timer; then
    echo "✅ Auto-renewal is enabled"
    echo "   Certificates will automatically renew before expiration"
else
    echo "⚠️  Auto-renewal timer might not be active"
fi

# 13. Update backend CORS
echo ""
echo "1️⃣3️⃣ Updating backend CORS configuration..."
cd ~/prokrishi-server

if [ -f .env ]; then
    # Backup
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null || true
    
    # Add domain to CORS
    if grep -q "^CORS_ORIGIN=" .env; then
        CURRENT_CORS=$(grep "^CORS_ORIGIN=" .env | cut -d'=' -f2-)
        if [[ "$CURRENT_CORS" != *"https://${DOMAIN}"* ]]; then
            NEW_CORS="https://${DOMAIN},${CURRENT_CORS}"
            sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=${NEW_CORS}|" .env
            echo "✅ Updated CORS_ORIGIN"
        else
            echo "✅ CORS already includes domain"
        fi
    else
        echo "CORS_ORIGIN=https://${DOMAIN},https://prokrishihub.com" >> .env
        echo "✅ Added CORS_ORIGIN"
    fi
    
    # Restart backend
    pm2 restart prokrishi-backend
    echo "✅ Backend restarted with updated CORS"
else
    echo "⚠️  .env file not found, skipping CORS update"
fi

# Final summary
echo ""
echo "=================================="
echo "✅ SSL Setup Complete!"
echo "=================================="
echo ""
echo "📋 Summary:"
echo "   Domain: $DOMAIN"
echo "   Backend: $(pm2 list | grep prokrishi-backend | awk '{print $10}')"
echo "   Nginx: $(systemctl is-active nginx)"
echo "   SSL: Installed via Let's Encrypt"
echo ""
echo "🧪 Test your API:"
echo "   curl https://$DOMAIN/health"
echo "   curl https://$DOMAIN/api/product"
echo ""
echo "📝 Next steps:"
echo "   1. Update Vercel env: NEXT_PUBLIC_API_BASE_URL=https://$DOMAIN/api"
echo "   2. Add your Vercel frontend domain to backend CORS_ORIGIN"
echo "   3. Redeploy Vercel frontend"
echo ""
echo "🔒 Your API is now accessible via HTTPS!"

