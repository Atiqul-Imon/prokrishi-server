# CI/CD Setup Guide

This document explains the CI/CD pipelines and how to configure them.

## GitHub Actions Workflows

### 1. CI Pipeline (`ci.yml`)
**Triggers:** Push to main/develop, Pull Requests
**Purpose:** 
- Run linting checks
- Verify deployment scripts
- Check Node.js compatibility
- Validate environment templates

### 2. Production Deployment (`deploy-production.yml`)
**Triggers:** Push to main, Manual dispatch
**Purpose:**
- Automatically deploy to Digital Ocean when code is pushed to main
- SSH into droplet and pull latest code
- Restart PM2 processes
- Verify deployment health

### 3. Staging Deployment (`deploy-staging.yml`)
**Triggers:** Push to develop/staging branches
**Purpose:**
- Deploy to staging environment
- Run tests before deployment

### 4. Security Scan (`security-scan.yml`)
**Triggers:** Push, PRs, Weekly schedule, Manual
**Purpose:**
- Run npm audit
- Check for security vulnerabilities
- Generate security reports

### 5. Auto-Update Dependencies (`auto-update.yml`)
**Triggers:** Weekly schedule (Sunday), Manual
**Purpose:**
- Automatically check for outdated dependencies
- Create PR with updates

### 6. Docker Build (`docker-build.yml`)
**Triggers:** Push to main, Tags, Manual
**Purpose:**
- Build Docker images (optional)
- Push to Docker Hub (if configured)

### 7. Database Backup (`backup-database.yml`)
**Triggers:** Daily schedule, Manual
**Purpose:**
- Reminder for database backups
- Can be configured for actual backup automation

## Required GitHub Secrets

To enable CI/CD, you need to add these secrets to your GitHub repository:

### For Production Deployment

1. Go to: **GitHub Repository → Settings → Secrets and variables → Actions → New repository secret**

2. Add these secrets:

```
DROPLET_SSH_PRIVATE_KEY    # Your private SSH key (content of ~/.ssh/id_rsa)
DROPLET_USER               # SSH user (usually 'root')
DROPLET_IP                 # Your droplet IP (e.g., '178.128.91.197')
DROPLET_PATH               # Path on droplet (e.g., '/root/prokrishi-server/backend')
BACKEND_URL                # Your backend URL (e.g., 'http://178.128.91.197:3500')
```

### Optional Secrets

```
DOCKER_USERNAME            # Docker Hub username (for Docker builds)
DOCKER_PASSWORD            # Docker Hub password
MONGODB_URI                # For database backups
AWS_ACCESS_KEY_ID          # For S3/Spaces backups
AWS_SECRET_ACCESS_KEY      # For S3/Spaces backups
```

## Setting Up Secrets

### Step 1: Get Your SSH Private Key

```bash
# On your local machine
cat ~/.ssh/id_rsa
# Copy the entire output (including -----BEGIN and -----END lines)
```

### Step 2: Add Secrets to GitHub

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret:
   - **Name:** `DROPLET_SSH_PRIVATE_KEY`
   - **Value:** Paste your private SSH key (entire content)

Repeat for all required secrets.

## How It Works

### Automatic Deployment Flow

1. **Developer pushes to main branch**
   ```
   git push origin main
   ```

2. **GitHub Actions triggers:**
   - CI pipeline runs (linting, checks)
   - Production deployment starts
   - Code is pulled on droplet
   - Application restarts
   - Health check verifies deployment

3. **Deployment completes:**
   - Application is live with new code
   - PM2 manages the process
   - Logs are available

### Manual Deployment

You can also trigger deployment manually:

1. Go to **Actions** tab in GitHub
2. Select **Deploy to Production**
3. Click **Run workflow**
4. Select branch and click **Run workflow**

## Deployment Script

The deployment script (`scripts/deploy-to-droplet.sh`) can also be run locally:

```bash
# Set environment variables
export DROPLET_USER=root
export DROPLET_IP=178.128.91.197
export DROPLET_PATH=/root/prokrishi-server/backend

# Run deployment
./scripts/deploy-to-droplet.sh
```

## Monitoring

### Check Deployment Status

1. Go to **Actions** tab in GitHub
2. View workflow runs and their status
3. Click on a run to see detailed logs

### Check Application Status

```bash
# SSH into droplet
ssh root@178.128.91.197

# Check PM2 status
pm2 status

# View logs
pm2 logs prokrishi-backend

# Check health
curl http://localhost:3500/health
```

## Troubleshooting

### Deployment Fails

1. **Check GitHub Actions logs:**
   - Go to Actions → Failed workflow → View logs
   - Look for error messages

2. **Check SSH connection:**
   ```bash
   ssh root@178.128.91.197
   ```

3. **Verify secrets are correct:**
   - Check DROPLET_IP is correct
   - Verify SSH key is valid
   - Ensure DROPLET_PATH exists

### Application Not Starting

1. **Check PM2 logs:**
   ```bash
   ssh root@178.128.91.197
   pm2 logs prokrishi-backend
   ```

2. **Verify environment variables:**
   ```bash
   cd /root/prokrishi-server/backend
   cat .env  # Check if all variables are set
   ```

3. **Test manually:**
   ```bash
   cd /root/prokrishi-server/backend
   node index.js  # Should start without errors
   ```

## Best Practices

1. **Always test in staging first**
   - Push to develop branch
   - Verify staging deployment
   - Then merge to main

2. **Review PRs before merging**
   - CI pipeline runs on PRs
   - Review checks before merging

3. **Monitor deployments**
   - Check GitHub Actions status
   - Verify health endpoints
   - Monitor application logs

4. **Keep secrets secure**
   - Never commit secrets to code
   - Use GitHub Secrets
   - Rotate keys regularly

## Next Steps

1. ✅ Add required secrets to GitHub
2. ✅ Push code to trigger first deployment
3. ✅ Monitor deployment status
4. ✅ Verify application is running
5. ✅ Set up monitoring and alerts

Your CI/CD pipeline is now ready! 🚀

