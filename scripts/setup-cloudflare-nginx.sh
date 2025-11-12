#!/bin/bash

# Script to configure Nginx for Cloudflare
# This handles both proxied (Orange cloud) and DNS-only (Gray cloud) modes

set -e

DOMAIN=${1:-"api.prokrishihub.com"}

echo "🔧 Configuring Nginx for Cloudflare with domain: $DOMAIN"

cd ~/prokrishi-server || { echo "❌ Could not find ~/prokrishi-server directory"; exit 1; }

# Create Nginx config for Cloudflare
cat > /tmp/nginx-cloudflare.conf << EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} 178.128.91.197;

    # Real IP from Cloudflare (important for logging and rate limiting)
    set_real_ip_from 173.245.48.0/20;
    set_real_ip_from 103.21.244.0/22;
    set_real_ip_from 103.22.200.0/22;
    set_real_ip_from 103.31.4.0/22;
    set_real_ip_from 141.101.64.0/18;
    set_real_ip_from 108.162.192.0/18;
    set_real_ip_from 190.93.240.0/20;
    set_real_ip_from 188.114.96.0/20;
    set_real_ip_from 197.234.240.0/22;
    set_real_ip_from 198.41.128.0/17;
    set_real_ip_from 162.158.0.0/15;
    set_real_ip_from 104.16.0.0/13;
    set_real_ip_from 104.24.0.0/14;
    set_real_ip_from 172.64.0.0/13;
    set_real_ip_from 131.0.72.0/22;
    real_ip_header CF-Connecting-IP;

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
        
        # Cloudflare specific headers
        proxy_set_header CF-Connecting-IP \$http_cf_connecting_ip;
        proxy_set_header CF-Ray \$http_cf_ray;
        proxy_set_header CF-Visitor \$http_cf_visitor;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint (no logging)
    location /health {
        proxy_pass http://localhost:3500/health;
        access_log off;
    }
}
EOF

# Backup existing config
if [ -f /etc/nginx/sites-available/prokrishi-backend ]; then
    sudo cp /etc/nginx/sites-available/prokrishi-backend /etc/nginx/sites-available/prokrishi-backend.backup.$(date +%Y%m%d_%H%M%S)
fi

# Copy new config
sudo cp /tmp/nginx-cloudflare.conf /etc/nginx/sites-available/prokrishi-backend

# Enable site
sudo ln -sf /etc/nginx/sites-available/prokrishi-backend /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
echo "🧪 Testing Nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid"
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded successfully"
else
    echo "❌ Nginx configuration has errors. Please check manually."
    exit 1
fi

# Configure firewall
echo "🔥 Configuring firewall..."
ufw allow 'Nginx Full' >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true

echo ""
echo "✅ Nginx configured for Cloudflare!"
echo ""
echo "📋 Next steps:"
echo "1. Add A record in Cloudflare: api → 178.128.91.197"
echo "2. Choose proxy mode (Orange cloud for SSL, Gray for direct)"
echo "3. Wait for DNS propagation (1-5 minutes)"
echo "4. Test: curl https://${DOMAIN}/health"
echo ""
echo "💡 If using Cloudflare Proxy (Orange cloud), SSL is automatic!"
echo "💡 If using DNS Only (Gray cloud), run: sudo certbot --nginx -d ${DOMAIN}"

