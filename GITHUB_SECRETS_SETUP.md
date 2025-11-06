# GitHub Secrets Setup for CI/CD

## Quick Setup Guide

To enable automated deployment, you need to add secrets to your GitHub repository.

## Step 1: Access GitHub Secrets

1. Go to your GitHub repository: https://github.com/Atiqul-Imon/prokrishi-server
2. Click **Settings** (top right)
3. Click **Secrets and variables** → **Actions** (left sidebar)
4. Click **New repository secret**

## Step 2: Add Required Secrets

Add these secrets one by one:

### 1. DROPLET_SSH_PRIVATE_KEY

**Get your private SSH key:**
```bash
cat ~/.ssh/id_rsa
```

**Copy the entire output** (including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`)

**In GitHub:**
- Name: `DROPLET_SSH_PRIVATE_KEY`
- Value: Paste the entire private key content

### 2. DROPLET_USER

- Name: `DROPLET_USER`
- Value: `root`

### 3. DROPLET_IP

- Name: `DROPLET_IP`
- Value: `178.128.91.197`

### 4. DROPLET_PATH

- Name: `DROPLET_PATH`
- Value: `/root/prokrishi-server/backend`

### 5. BACKEND_URL

- Name: `BACKEND_URL`
- Value: `http://178.128.91.197:3500` (or your domain if configured)

## Step 3: Verify Secrets

After adding all secrets, you should see:
- ✅ DROPLET_SSH_PRIVATE_KEY
- ✅ DROPLET_USER
- ✅ DROPLET_IP
- ✅ DROPLET_PATH
- ✅ BACKEND_URL

## Step 4: Test Deployment

1. Make a small change to any file in `backend/`
2. Commit and push:
   ```bash
   git add .
   git commit -m "test: trigger CI/CD"
   git push origin main
   ```
3. Go to **Actions** tab in GitHub
4. Watch the deployment workflow run
5. Check if it completes successfully

## Troubleshooting

### SSH Connection Failed

- Verify `DROPLET_SSH_PRIVATE_KEY` is the correct private key
- Check that the corresponding public key is added to your droplet
- Test SSH manually: `ssh root@178.128.91.197`

### Deployment Fails

- Check GitHub Actions logs for specific errors
- Verify all secrets are correctly set
- Ensure droplet has git and node installed
- Check that the repository path exists on the droplet

### Health Check Fails

- Verify application is running: `ssh root@178.128.91.197 "pm2 status"`
- Check application logs: `ssh root@178.128.91.197 "pm2 logs prokrishi-backend"`
- Verify `.env` file is configured correctly

## Security Best Practices

1. **Never commit secrets** - Always use GitHub Secrets
2. **Rotate keys regularly** - Update SSH keys periodically
3. **Limit access** - Only give necessary permissions
4. **Monitor deployments** - Review Actions logs regularly

## Next Steps

After setting up secrets:

1. ✅ Push a test commit to trigger deployment
2. ✅ Monitor the Actions tab
3. ✅ Verify deployment success
4. ✅ Test the application endpoint

Your CI/CD pipeline is now ready! 🚀

