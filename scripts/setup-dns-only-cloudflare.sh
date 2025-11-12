#!/bin/bash

# Setup script for Cloudflare DNS-only mode (Gray cloud)
# This configures Nginx for direct connection and sets up SSL with Let's Encrypt

set -e

DOMAIN=${1:-"api.prokrishihub.com"}

echo "🔧 Setting up backend for Cloudflare DNS-only mode (Gray cloud)"
echo "📍 Domain: $DOMAIN"
echo ""

cd ~/prokrishi-server || { echo "❌ Could not find ~/prokrishi-server directory"; exit 1; }

# 1. Ensure backend is running
echo "1️⃣ Ensuring backend is running..."
if ! pm2 list | grep -q "prokrishi-backend.*online"; then
    echo "🔄 Starting backend..."
    if [ -f ecosystem.config.cjs ]; then
        pm2 start ecosystem.config.cjs --env production
    else
        pm2 start index.js --name prokrishi-backend
    fi
    pm2 save
    sleep 3
fi

# Test backend
if curl -s http://localhost:3500/health > /dev/null; then
    echo "✅ Backend is running and responding"
else
    echo "❌ Backend is not responding on port 3500"
    echo "Check logs: pm2 logs prokrishi-backend"
    exit 1
fi

# 2. Install Certbot if not installed
echo ""
echo "2️⃣ Installing Certbot for SSL..."
if ! command -v certbot &> /dev/null; then
    sudo apt update
    sudo apt install -y certbot python3-certbot-nginx
    echo "✅ Certbot installed"
else
    echo "✅ Certbot already installed"
fi

# 3. Configure Nginx for HTTP first (required for Let's Encrypt)
echo ""
echo "3️⃣ Configuring Nginx for HTTP..."

sudo tee /etc/nginx/sites-available/prokrishi-backend > /dev/null << NGINX_HTTP_CONFIG
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} 178.128.91.197;

    # Increase body size for file uploads
    client_max_body_size 50M;

    # Backend proxy
    location / {
        proxy_pass http://localhost:3500;
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
        proxy_pass http://localhost:3500/health;
        access_log off;
    }

    # Let's Encrypt challenge
    location ~ /.well-known/acme-challenge {
        allow all;
        root /var/www/html;
    }
}
NGINX_HTTP_CONFIG

# Enable site
sudo ln -sf /etc/nginx/sites-available/prokrishi-backend /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
echo "🧪 Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded"
else
    echo "❌ Nginx configuration has errors"
    exit 1
fi

# 4. Configure firewall
echo ""
echo "4️⃣ Configuring firewall..."
sudo ufw allow 80/tcp >/dev/null 2>&1 || true
sudo ufw allow 443/tcp >/dev/null 2>&1 || true
sudo ufw --force enable >/dev/null 2>&1 || true
echo "✅ Firewall configured"

# 5. Get SSL certificate
echo ""
echo "5️⃣ Obtaining SSL certificate from Let's Encrypt..."
echo "⚠️  Make sure DNS record is pointing to this server and propagated!"
read -p "Press Enter to continue with SSL certificate setup..."

# Get SSL certificate
sudo certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos --email admin@prokrishihub.com --redirect || {
    echo "⚠️  SSL certificate setup failed. This might be because:"
    echo "   1. DNS has not propagated yet (wait 5-15 minutes)"
    echo "   2. Port 80 is not accessible from internet"
    echo "   3. Domain is not pointing to this server"
    echo ""
    echo "You can try again later with:"
    echo "   sudo certbot --nginx -d ${DOMAIN}"
}

# 6. Test HTTPS
echo ""
echo "6️⃣ Testing HTTPS connection..."
sleep 2
if curl -s https://${DOMAIN}/health > /dev/null; then
    echo "✅ HTTPS is working!"
    curl -s https://${DOMAIN}/health | head -3
else
    echo "⚠️  HTTPS test failed. Certificate might still be processing."
fi

# 7. Setup auto-renewal
echo ""
echo "7️⃣ Setting up SSL auto-renewal..."
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
echo "✅ SSL auto-renewal configured"

# 8. Update backend CORS
echo ""
echo "8️⃣ Updating backend CORS configuration..."
if [ -f .env ]; then
    # Backup
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    
    # Update CORS_ORIGIN
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
    echo "✅ Backend restarted with new CORS settings"
else
    echo "⚠️  .env file not found, skipping CORS update"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Summary:"
echo "   Domain: ${DOMAIN}"
echo "   Backend: $(pm2 list | grep prokrishi-backend | awk '{print $10}')"
echo "   Nginx: $(systemctl is-active nginx)"
echo "   SSL: Check with: sudo certbot certificates"
echo ""
echo "🧪 Test your API:"
echo "   curl https://${DOMAIN}/health"
echo "   curl https://${DOMAIN}/api/product"
echo ""
echo "📝 Next steps:"
echo "   1. Update Vercel env: NEXT_PUBLIC_API_BASE_URL=https://${DOMAIN}/api"
echo "   2. Add your Vercel domain to backend CORS_ORIGIN"
echo "   3. Redeploy Vercel frontend"

