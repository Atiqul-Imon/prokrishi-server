# Render Deployment Guide - Prokrishi Backend

This guide provides step-by-step instructions for deploying the Prokrishi backend to Render.

## Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **Git Repository**: Code should be on GitHub, GitLab, or Bitbucket
3. **MongoDB Atlas**: Database cluster set up
4. **Cloudinary Account**: For image storage
5. **Generated Secrets**: JWT and cookie secrets

---

## Quick Deploy (Recommended)

### Step 1: Create Web Service

1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your Git repository
4. Select your repository from the list

### Step 2: Configure Service

Fill in the following settings:

#### Basic Information

| Setting | Value |
|---------|-------|
| **Name** | `prokrishi-backend` (or your choice) |
| **Region** | Singapore (or closest to your users) |
| **Branch** | `main` (or your production branch) |
| **Root Directory** | `backend` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |

#### Instance Type

- **Free**: For testing (spins down after 15 min inactivity)
- **Starter ($7/month)**: For production (always on)

### Step 3: Add Environment Variables

Click **"Advanced"** → **Environment Variables** and add:

#### Required Variables

```bash
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/prokrishi?retryWrites=true&w=majority
JWT_SECRET=your_32_character_secret_here
JWT_REFRESH_SECRET=your_32_character_secret_here
COOKIE_SECRET=your_32_character_secret_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

#### CORS Variables (Update after frontend deployed)

```bash
CORS_ORIGIN=https://your-frontend.vercel.app
FRONTEND_URL=https://your-frontend.vercel.app
BACKEND_URL=https://prokrishi-backend.onrender.com
```

#### Optional Variables

```bash
# Payment Gateway
SSL_STORE_ID=your_ssl_store_id
SSL_STORE_PASSWORD=your_ssl_store_password

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_gmail_app_password

# Redis (Optional - for caching)
REDIS_URL=redis://username:password@host:port

# Rate Limiting (Optional - defaults already set)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Render will start building your service
3. Wait 2-5 minutes for first deployment
4. Note your service URL: `https://your-service-name.onrender.com`

### Step 5: Verify Deployment

Visit these URLs to verify:

1. **Root endpoint**: `https://your-service.onrender.com/`
   ```json
   {
     "message": "Prokrishi Backend API is running!",
     "version": "2.0.0",
     "timestamp": "..."
   }
   ```

2. **Health check**: `https://your-service.onrender.com/health`
   ```json
   {
     "status": "OK",
     "message": "Server is running",
     "cache": "Connected",
     "environment": "production"
   }
   ```

3. **API endpoints**:
   - Products: `https://your-service.onrender.com/api/product`
   - Categories: `https://your-service.onrender.com/api/category`

---

## Using Blueprint (render.yaml)

The project includes a `render.yaml` blueprint file for automated deployment.

### Deploy with Blueprint

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Blueprint"**
3. Connect your repository
4. Select the `render.yaml` file
5. Render will prompt for environment variables
6. Fill in all required variables
7. Click **"Apply"**

### render.yaml Configuration

```yaml
services:
  - type: web
    name: prokrishi-backend
    env: node
    plan: free
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      # ... other variables marked with sync: false
      # Must be set manually in dashboard
```

---

## Generate Secure Secrets

Before deploying, generate secure random strings for secrets:

### Using Node.js

```bash
# Generate a single secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Run 3 times for:
# 1. JWT_SECRET
# 2. JWT_REFRESH_SECRET  
# 3. COOKIE_SECRET
```

### Using OpenSSL

```bash
openssl rand -hex 32
```

### Using Online Tool

Visit [randomkeygen.com](https://randomkeygen.com) and use "CodeIgniter Encryption Keys"

---

## MongoDB Atlas Setup

### Create Database

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a cluster (free tier available)
3. Create database user with password
4. Whitelist all IPs: `0.0.0.0/0`
5. Get connection string

### Connection String Format

```
mongodb+srv://USERNAME:PASSWORD@cluster.mongodb.net/DATABASE_NAME?retryWrites=true&w=majority
```

Replace:
- `USERNAME`: Your database username
- `PASSWORD`: Your database password (URL encode special characters)
- `DATABASE_NAME`: `prokrishi` (or your choice)

### URL Encode Password

If password contains special characters, encode them:
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`

Example: `P@ssw0rd!` → `P%40ssw0rd%21`

---

## Cloudinary Setup

### Get Credentials

1. Sign up at [Cloudinary](https://cloudinary.com)
2. Go to Dashboard
3. Note these values:
   - **Cloud Name**: Your cloud name
   - **API Key**: Your API key
   - **API Secret**: Your API secret

### Configure Upload Preset (Optional)

For unsigned uploads:
1. Go to Settings → Upload
2. Enable unsigned uploads
3. Create upload preset
4. Note preset name

---

## SSL Commerz Setup (Optional)

Only needed if you want payment functionality.

### Get Store Credentials

1. Sign up at [SSL Commerz](https://sslcommerz.com)
2. Get Sandbox credentials for testing
3. Get Live credentials for production

### Sandbox vs Live

**Sandbox (Testing)**:
```bash
SSL_STORE_ID=your_sandbox_store_id
SSL_STORE_PASSWORD=your_sandbox_password
```

**Live (Production)**:
```bash
SSL_STORE_ID=your_live_store_id
SSL_STORE_PASSWORD=your_live_password
```

---

## Email Configuration (Optional)

For password reset and notifications.

### Gmail Setup

1. Enable 2-Factor Authentication in Google Account
2. Generate App Password:
   - Go to: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - Create app password for "Mail"
   - Copy 16-character password

### Configuration

```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your.email@gmail.com
EMAIL_PASS=your_16_char_app_password
```

### Other Email Providers

**SendGrid**:
```bash
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=your_sendgrid_api_key
```

**Mailgun**:
```bash
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_USER=your_mailgun_username
EMAIL_PASS=your_mailgun_password
```

---

## Redis Setup (Optional)

For caching and improved performance.

### Upstash Redis (Recommended - Free Tier)

1. Sign up at [Upstash](https://upstash.com)
2. Create Redis database
3. Get connection URL
4. Add to environment variables:

```bash
REDIS_URL=rediss://default:password@host:port
```

### Redis Cloud

1. Sign up at [Redis Cloud](https://redis.com/cloud)
2. Create database
3. Get connection URL

---

## Render Dashboard Features

### Logs

View real-time logs:
1. Go to your service
2. Click **"Logs"** tab
3. See all console output and errors

### Metrics

Monitor performance:
- CPU usage
- Memory usage
- Request rate
- Response times

### Environment Variables

Update variables:
1. Go to **"Environment"** tab
2. Add/Edit/Delete variables
3. Save (triggers redeploy)

### Manual Deploy

Trigger manual deployment:
1. Go to **"Manual Deploy"** tab
2. Select branch
3. Click **"Deploy latest commit"**

### Shell Access

SSH into your service:
1. Go to **"Shell"** tab
2. Run commands directly on server
3. Debug issues in real-time

---

## Custom Domain (Optional)

### Add Custom Domain

1. Go to **"Settings"** → **"Custom Domain"**
2. Click **"Add Custom Domain"**
3. Enter your domain (e.g., `api.prokrishi.com`)

### Configure DNS

Add CNAME record at your domain registrar:

```
Type: CNAME
Name: api (or your subdomain)
Value: your-service.onrender.com
```

### SSL Certificate

Render automatically provisions SSL certificate (1-5 minutes).

---

## Monitoring and Alerts

### Health Checks

Render automatically monitors:
- HTTP endpoint health
- Service uptime
- Response time

Default health check: `GET /` (200 OK expected)

### Custom Health Check

Already implemented at `/health`:

```javascript
app.get("/health", async (req, res) => {
  const cacheStats = await cacheService.getStats();
  res.status(200).json({ 
    status: "OK", 
    message: "Server is running",
    cache: cacheStats?.connected ? "Connected" : "Disconnected"
  });
});
```

### Email Alerts

Configure in Render:
1. Go to **"Settings"** → **"Notifications"**
2. Add email addresses
3. Choose alert types:
   - Deploy failures
   - Service crashes
   - High CPU/memory usage

---

## Performance Optimization

### Already Configured

✅ **Compression**: gzip enabled
✅ **Rate Limiting**: API endpoints protected
✅ **Caching**: Redis integration ready
✅ **Database Indexing**: Implemented
✅ **Logging**: Winston logger configured
✅ **Security Headers**: Helmet middleware

### Additional Optimizations

1. **Database Indexing**
   - Already configured in `config/indexes.js`
   - Run seeding to create indexes

2. **Redis Caching**
   - Configure `REDIS_URL` for faster queries
   - Product and category caching enabled

3. **Image Optimization**
   - Use Cloudinary transformations
   - Serve optimized formats (WebP)

---

## Troubleshooting

### Service Won't Start

**Check Build Logs**:
1. Go to **"Logs"** tab
2. Look for errors during `npm install`
3. Fix missing dependencies

**Common Issues**:
- Missing dependencies in `package.json`
- Node version mismatch (requires 18+)
- Environment variables not set

### Database Connection Failed

**Check MongoDB Atlas**:
- IP whitelist includes `0.0.0.0/0`
- Database user has correct permissions
- Password is URL-encoded
- Cluster is running

**Test Connection**:
```bash
# In Render Shell
node -e "const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(() => console.log('Connected')).catch(err => console.error(err));"
```

### 503 Service Unavailable

**Free Tier Spin Down**:
- Free tier spins down after 15 minutes of inactivity
- First request takes 30-60 seconds to wake up
- Upgrade to Starter plan for always-on service

**Keep Alive Service** (Free tier workaround):
- Use [UptimeRobot](https://uptimerobot.com) to ping every 14 minutes
- Set up cron job to hit `/health` endpoint

### CORS Errors

**Check Environment Variables**:
```bash
CORS_ORIGIN=https://your-frontend.vercel.app  # No trailing slash
FRONTEND_URL=https://your-frontend.vercel.app
```

**Check Frontend URL**:
- Must match exactly (including https://)
- No trailing slash
- Update after frontend deployment

### Image Upload Fails

**Check Cloudinary**:
- Credentials are correct
- API key has upload permissions
- Storage limit not exceeded

**Test Credentials**:
```bash
# In Render Shell
node -e "const cloudinary = require('cloudinary').v2; cloudinary.config({cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET}); cloudinary.api.ping().then(r => console.log('OK')).catch(e => console.error(e));"
```

---

## Scaling

### Vertical Scaling (Upgrade Plan)

| Plan | RAM | CPU | Price |
|------|-----|-----|-------|
| Free | 512 MB | 0.1 CPU | $0 |
| Starter | 512 MB | 0.5 CPU | $7/mo |
| Standard | 2 GB | 1 CPU | $25/mo |
| Pro | 4 GB | 2 CPU | $85/mo |

### Horizontal Scaling

Not available on Render free/starter plans. Consider:
- Load balancers
- Multiple instances
- Database read replicas

### When to Scale

**Upgrade if**:
- Response times > 1 second
- CPU usage consistently > 80%
- Memory usage consistently > 80%
- Need always-on service
- High traffic (>100K requests/day)

---

## Security Best Practices

### Environment Variables

✅ Never commit secrets to Git
✅ Use long random secrets (32+ characters)
✅ Rotate secrets periodically
✅ Use Render's environment tab to manage

### API Security

Already configured:
✅ Rate limiting on all API endpoints
✅ Helmet for security headers
✅ CORS restricted to frontend domain
✅ Input sanitization
✅ JWT authentication

### Database Security

✅ Use MongoDB Atlas (not self-hosted)
✅ Enable authentication
✅ Restrict IP whitelist (or use VPN)
✅ Use strong passwords
✅ Enable audit logging

### Additional Recommendations

1. **Enable Two-Factor Authentication**
   - On Render account
   - On MongoDB Atlas
   - On Cloudinary

2. **Monitor Logs**
   - Check for unusual activity
   - Set up log alerts
   - Review error patterns

3. **Regular Updates**
   - Update dependencies monthly
   - Apply security patches
   - Monitor CVE databases

---

## Deployment Checklist

### Before Deploying

- [ ] MongoDB Atlas cluster created
- [ ] Connection string obtained and tested
- [ ] Cloudinary account created
- [ ] Cloudinary credentials obtained
- [ ] JWT secrets generated (3x 32+ chars)
- [ ] Code pushed to Git repository
- [ ] Dependencies listed in package.json
- [ ] Node version 18+ specified in package.json

### During Deployment

- [ ] Render account created
- [ ] Web service created
- [ ] Root directory set correctly
- [ ] Build command: `npm install`
- [ ] Start command: `npm start`
- [ ] All environment variables added
- [ ] Deploy initiated

### After Deployment

- [ ] Service deployed successfully (green status)
- [ ] Root endpoint returns JSON response
- [ ] Health endpoint returns OK
- [ ] API endpoints are accessible
- [ ] Database connection working
- [ ] Image upload to Cloudinary working
- [ ] Logs show no errors
- [ ] Frontend CORS updated with backend URL

---

## Useful Commands

### In Render Shell

```bash
# Check Node version
node --version

# Check npm version
npm --version

# Test MongoDB connection
node -e "require('mongoose').connect(process.env.MONGODB_URI).then(() => console.log('OK'))"

# Check environment variables
env | grep -E 'MONGODB|JWT|CLOUDINARY'

# View running processes
ps aux

# Check disk space
df -h

# View logs in real-time
# (Use Render dashboard Logs tab instead)
```

---

## Support Resources

- **Render Documentation**: [render.com/docs](https://render.com/docs)
- **Render Community**: [community.render.com](https://community.render.com)
- **MongoDB Atlas Docs**: [docs.atlas.mongodb.com](https://docs.atlas.mongodb.com)
- **Cloudinary Docs**: [cloudinary.com/documentation](https://cloudinary.com/documentation)
- **Express.js Docs**: [expressjs.com](https://expressjs.com)

---

## Quick Reference

### Environment Variables Template

```bash
# Server
NODE_ENV=production
PORT=10000

# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/prokrishi

# JWT
JWT_SECRET=<32+ chars>
JWT_REFRESH_SECRET=<32+ chars>
COOKIE_SECRET=<32+ chars>

# CORS
CORS_ORIGIN=https://your-frontend.vercel.app
FRONTEND_URL=https://your-frontend.vercel.app
BACKEND_URL=https://your-backend.onrender.com

# Cloudinary
CLOUDINARY_CLOUD_NAME=<cloud_name>
CLOUDINARY_API_KEY=<api_key>
CLOUDINARY_API_SECRET=<api_secret>

# Payment (Optional)
SSL_STORE_ID=<store_id>
SSL_STORE_PASSWORD=<store_password>

# Email (Optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=<email>
EMAIL_PASS=<app_password>

# Redis (Optional)
REDIS_URL=<redis_connection_string>
```

### Important Files

- `index.js` - Main server file
- `package.json` - Dependencies and scripts
- `render.yaml` - Render blueprint
- `env.production.example` - Environment variables template

---

**Your backend is now deployed on Render!** 🎉

For any issues, check the troubleshooting section or Render's documentation.


