# PM2 Configuration Guide for StakePool247

## Overview

This guide covers setting up PM2 process management for the StakePool247 SAAS platform components. PM2 is used to manage all Node.js services including the web API, background scripts, and Telegram bot.

## Prerequisites

- Node.js 20+ installed (required for Firebase Admin SDK v12+)
- PM2 installed globally: `npm install -g pm2`
- Nginx installed: `sudo apt install nginx`
- Certbot installed: `sudo apt install certbot python3-certbot-nginx`
- Project dependencies installed: `npm install`

## Project Structure

The StakePool247 platform consists of multiple PM2-managed services:

```
stakepool247-saas/
├── stakepool247-io-web-api/     # Main REST API
├── stakepool247-scripts/        # Background processing
└── stakepool247-bot/           # Telegram bot
```

## API Configuration

### Main API (v1 - Production)

**Location**: `/path/to/stakepool247-io-web-api/`

**File**: `ecosystem.config.js`
```javascript
module.exports = {
    apps: [{
        name: "web-api",
        script: "src/main.js",
        env: {
            NODE_ENV: "production",
            PORT: 4000,
            // Add environment variables here
            GOOGLE_APPLICATION_CREDENTIALS: "/path/to/firebase_service_account.json",
            BF_API_KEY: "your_blockfrost_api_key",
            DB_HOST: "127.0.0.1",
            DB_USER: "your_db_user",
            DB_PASS: "your_db_password",
            DB_NAME: "your_db_name",
            DB_PORT: "5432",
            DATABASE_URL: "postgres://user:pass@localhost/dbname"
        },
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: "1G"
    }]
}
```

### API v2 Configuration

**File**: `ecosystem.v2.config.cjs`
```javascript
module.exports = {
    apps: [{
        name: 'web-api-v2',
        script: 'src/main.js',
        env: {
            NODE_ENV: 'production',
            PORT: 4040,
            // Same environment variables as v1
            GOOGLE_APPLICATION_CREDENTIALS: '/path/to/firebase_service_account.json',
            BF_API_KEY: 'your_blockfrost_api_key',
            DB_HOST: '127.0.0.1',
            DB_USER: 'your_db_user',
            DB_PASS: 'your_db_password',
            DB_NAME: 'your_db_name',
            DB_PORT: '5432',
            DATABASE_URL: 'postgres://user:pass@localhost/dbname'
        },
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G'
    }]
}
```

## Scripts Configuration

**Location**: `/path/to/stakepool247-scripts/`

**File**: `ecosystem.config.js`
```javascript
module.exports = {
    apps: [
        {
            name: "json-loader",
            script: "src/json-loader.js",
            env: {
                NODE_ENV: "production",
                ROOT_DIR_POOL_JSON_LOADER: "/path/to/pool/data",
                JSON_LOADER_CRON: "*/10 * * * *",
                SERVICE_ACCOUNT_PRIVATE_KEY_JSON: "firebase_service_account_json_content",
                POOLS_DATA_COLLECTION_ID: "poolData",
                GLOBAL_DATA_COLLECTION_ID: "globalData",
                STATUS_MANAGING_COLLECTION_ID: "statusManaging",
                EPOCHS_COLLECTION_ID: "epochs"
            }
        },
        {
            name: "status-manager",
            script: "src/status-manager.js",
            env: {
                NODE_ENV: "production",
                // Same environment variables as json-loader
            }
        },
        {
            name: "alerts",
            script: "src/alerts.js",
            env: {
                NODE_ENV: "production",
                ALERTS_CRON: "0 */5 * * * *",
                // Database and Firebase credentials
            }
        }
    ]
}
```

## Bot Configuration

**Location**: `/path/to/stakepool247-bot/`

**File**: `ecosystem.config.js`
```javascript
module.exports = {
    apps: [
        {
            name: "bot-prod",
            script: "src/main.js",
            env: {
                NODE_ENV: "production",
                BOT_TOKEN: "your_telegram_bot_token",
                QUEUE_PREFIX: "bot-notifications",
                BASE_DOMAIN: "https://portal.stakepool247.io",
                // Firebase and database credentials
            }
        },
        {
            name: "bot-dev",
            script: "src/main.js",
            env: {
                NODE_ENV: "development",
                BOT_TOKEN: "your_dev_telegram_bot_token",
                QUEUE_PREFIX: "bot-notifications-dev",
                BASE_DOMAIN: "https://dev.stakepool247.io"
            }
        }
    ]
}
```

## Required Environment Variables

### Firebase Configuration
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to Firebase service account JSON file
- `SERVICE_ACCOUNT_PRIVATE_KEY_JSON`: Firebase service account JSON content (for scripts)

### Database Configuration
- `DB_HOST`: PostgreSQL host (usually 127.0.0.1)
- `DB_USER`: PostgreSQL username
- `DB_PASS`: PostgreSQL password
- `DB_NAME`: PostgreSQL database name
- `DB_PORT`: PostgreSQL port (usually 5432)
- `DATABASE_URL`: Full PostgreSQL connection string

### API Keys
- `BF_API_KEY`: Blockfrost API key for Cardano blockchain access
- `BOT_TOKEN`: Telegram bot token

### Application Settings
- `NODE_ENV`: Environment (production/development)
- `PORT`: API server port (4000 for v1, 4040 for v2)
- `ROOT_DIR_POOL_JSON_LOADER`: Directory for pool data processing
- `JSON_LOADER_CRON`: Cron schedule for data processing
- `ALERTS_CRON`: Cron schedule for alert processing

## PM2 Commands

### Starting Services

```bash
# Start main API
cd /path/to/stakepool247-io-web-api
pm2 start ecosystem.config.js

# Start v2 API
pm2 start ecosystem.v2.config.cjs

# Start scripts
cd /path/to/stakepool247-scripts
pm2 start ecosystem.config.js

# Start bot
cd /path/to/stakepool247-bot
pm2 start ecosystem.config.js
```

### Managing Services

```bash
# List all processes
pm2 list

# View logs
pm2 logs web-api
pm2 logs web-api-v2 --lines 50

# Restart service
pm2 restart web-api

# Stop service
pm2 stop web-api

# Delete service
pm2 delete web-api

# Monitor resources
pm2 monit

# Show detailed process info
pm2 show web-api
```

### Persistence

```bash
# Save current PM2 configuration
pm2 save

# Generate startup script (run as root)
pm2 startup

# Restore processes after reboot
pm2 resurrect
```

## Common Issues and Solutions

### ES Module Errors
If you get `ERR_REQUIRE_ESM` errors, rename config files from `.js` to `.cjs`:
```bash
mv ecosystem.config.js ecosystem.config.cjs
```

### Missing Dependencies
```bash
# Install dependencies in each project directory
npm install
```

### Firebase Connection Issues
Ensure the service account JSON file exists and has correct permissions:
```bash
ls -la /path/to/firebase_service_account.json
```

### Port Conflicts
Check if ports are already in use:
```bash
netstat -tlnp | grep :4000
netstat -tlnp | grep :4040
```

## Security Notes

- Keep environment variables secure and never commit them to git
- Use separate Firebase service accounts for production and development
- Rotate API keys regularly
- Restrict database access to necessary hosts only
- Use different Telegram bot tokens for production and development

## Monitoring

### Log Management
PM2 includes automatic log rotation. Logs are stored in:
```
~/.pm2/logs/
├── app-name-out.log    # stdout
├── app-name-error.log  # stderr
└── pm2.log            # PM2 system logs
```

### Health Checking
```bash
# Quick health check
curl http://localhost:4000/
curl http://localhost:4040/

# Check process status
pm2 status

# Monitor in real-time
pm2 monit
```

## Deployment Workflow

1. **Prepare Environment**
   ```bash
   cd /path/to/project
   npm install
   ```

2. **Configure PM2**
   ```bash
   # Create/update ecosystem config files
   # Set environment variables
   ```

3. **Start Services**
   ```bash
   pm2 start ecosystem.config.cjs
   pm2 save
   ```

4. **Verify Deployment**
   ```bash
   pm2 list
   pm2 logs app-name --lines 20
   curl http://localhost:port/
   ```

5. **Enable Auto-start**
   ```bash
   pm2 startup
   pm2 save
   ```

## Nginx Configuration & SSL Setup

### API Reverse Proxy Configuration

The StakePool247 API runs behind nginx as a reverse proxy with SSL termination. This provides better security, performance, and allows standard HTTPS ports.

#### Create Nginx Site Configuration

**File**: `/etc/nginx/sites-available/api-v2.stakepool247.io`
```nginx
server {
    server_name api-v2.stakepool247.io;

    location / {
        proxy_pass http://localhost:4041;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    listen 80;
    # SSL will be added by Certbot
}
```

#### Enable the Site
```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/api-v2.stakepool247.io /etc/nginx/sites-enabled/

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### SSL Certificate Setup

#### Using Certbot (Let's Encrypt)

```bash
# Install Certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d api-v2.stakepool247.io

# Choose option 2 for redirect (HTTP → HTTPS)
# This will automatically update the nginx configuration
```

#### Manual SSL Configuration (Alternative)

If you have custom certificates, update the nginx configuration:

```nginx
server {
    server_name api-v2.stakepool247.io;

    location / {
        proxy_pass http://localhost:4041;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/api-v2.stakepool247.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-v2.stakepool247.io/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = api-v2.stakepool247.io) {
        return 301 https://$host$request_uri;
    }

    listen 80;
    server_name api-v2.stakepool247.io;
    return 404;
}
```

### Architecture Overview

```
Client → HTTPS:443 (nginx SSL termination) → HTTP:4041 (Node.js API) → Firebase/Database
```

**Benefits:**
- **SSL Termination**: Nginx handles encryption/decryption
- **Standard Ports**: Uses 443/80 instead of custom ports
- **Load Balancing**: Can easily add multiple API instances
- **Static Content**: Nginx can serve static files efficiently
- **Security**: Additional security headers and rate limiting

### Certificate Renewal

Let's Encrypt certificates auto-renew via cron job:

```bash
# Check renewal status
sudo certbot renew --dry-run

# Manual renewal if needed
sudo certbot renew

# Restart nginx after renewal
sudo systemctl reload nginx
```

### Monitoring & Troubleshooting

#### Check Services
```bash
# Check nginx status
sudo systemctl status nginx

# Check nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check nginx access logs
sudo tail -f /var/log/nginx/access.log

# Test SSL certificate
curl -I https://api-v2.stakepool247.io/

# Check certificate details
openssl s_client -connect api-v2.stakepool247.io:443 -servername api-v2.stakepool247.io
```

#### Common Issues

**502 Bad Gateway**
- Check if PM2 process is running: `pm2 list`
- Verify port in nginx config matches PM2 port
- Check PM2 logs: `pm2 logs web-api-v2`

**SSL Certificate Errors**
- Verify certificate paths in nginx config
- Check certificate expiration: `sudo certbot certificates`
- Renew if needed: `sudo certbot renew`

**Port Conflicts**
- Check what's using ports: `sudo netstat -tlnp | grep :443`
- Ensure nginx and PM2 use different ports (nginx:443, PM2:4041)

### Security Considerations

#### Nginx Security Headers

Add to nginx configuration:
```nginx
# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
```

#### Rate Limiting

```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

server {
    location / {
        limit_req zone=api burst=20 nodelay;
        # ... rest of proxy configuration
    }
}
```

#### Firewall Configuration

**For Google Cloud deployments:**

Configure firewall rules through Google Cloud Console or gcloud CLI:

```bash
# Allow HTTP/HTTPS traffic (if not already enabled)
gcloud compute firewall-rules create allow-http-https \
    --allow tcp:80,tcp:443 \
    --source-ranges 0.0.0.0/0 \
    --description "Allow HTTP and HTTPS traffic"

# Block direct access to API port (optional, as it's internal)
# Note: Internal ports (4041) are typically not exposed externally by default
```

**For local/on-premise deployments:**

```bash
# Allow nginx traffic
sudo ufw allow 'Nginx Full'

# Block direct access to API port
sudo ufw deny 4041
```

This configuration enables reliable, scalable deployment of the StakePool247 platform with proper process management, SSL termination, and monitoring.