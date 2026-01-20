# 🚀 Cocapn Hybrid IDE - Deployment Guide

## 📋 Overview
This guide will help you deploy the Cocapn Hybrid IDE to Cloudflare Workers. The Hybrid IDE provides a complete development environment with AI-powered chat, Monaco editor, file management, live preview, and terminal access.

## 🔧 Prerequisites

### Required Tools
- **Node.js** 18.x or later
- **npm** 9.x or later
- **Wrangler CLI** 3.x or later
- **Cloudflare Account** with Workers enabled

### Installation
```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

## 🚀 Quick Start

### 1. Setup Environment
```bash
# Clone the repository
git clone <repository-url>
cd cocapn-ide

# Run setup script
./deploy-setup.sh
```

### 2. Configure API Keys
Set up API keys for the AI providers you want to use:

```bash
# Set as secrets (recommended for production)
wrangler secret put MANUS_API_KEY
wrangler secret put ZAI_API_KEY
wrangler secret put MINIMAX_API_KEY
wrangler secret put CLAUDE_API_KEY
wrangler secret put GROK_API_KEY
```

### 3. Deploy
```bash
# Deploy to staging
./deploy.sh staging

# Deploy to production
./deploy.sh production
```

## 📁 Project Structure

```
cocapn-ide/
├── src/
│   ├── components/           # IDE components
│   │   ├── chat-interface.tsx    # AI chat interface
│   │   ├── editor-panel.tsx      # Monaco editor
│   │   ├── file-tree.tsx         # File management
│   │   ├── preview-panel.tsx     # Live preview
│   │   ├── terminal-panel.tsx     # Terminal access
│   │   └── hybrid-ide.tsx         # Main interface
│   └── worker.ts            # Cloudflare Worker entry point
├── wrangler-ide.toml        # Worker configuration
├── deploy-setup.sh          # Setup script
├── deploy.sh               # Deployment script
└── DEPLOYMENT_GUIDE.md     # This file
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `ENVIRONMENT` | Deployment environment | No | `development` |
| `DEBUG` | Debug mode | No | `false` |
| `ACCOUNT_ID` | Cloudflare account ID | No | Auto-detected |
| `ZONE_ID` | Cloudflare zone ID | No | For custom domains |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | Rate limit | No | `100` |

### AI Provider Configuration

#### Manus AI
```bash
wrangler secret put MANUS_API_KEY
wrangler secret put MANUS_BASE_URL
```

#### Z.ai
```bash
wrangler secret put ZAI_API_KEY
wrangler secret put ZAI_BASE_URL
```

#### Minimax
```bash
wrangler secret put MINIMAX_API_KEY
wrangler secret put MINIMAX_BASE_URL
```

#### Claude
```bash
wrangler secret put CLAUDE_API_KEY
wrangler secret put CLAUDE_BASE_URL
```

#### Grok
```bash
wrangler secret put GROK_API_KEY
wrangler secret put GROK_BASE_URL
```

### Wrangler Configuration

The `wrangler-ide.toml` file contains configuration for:
- **Environments**: development, staging, production
- **Routes**: Custom domain routing
- **Secrets**: API keys and configuration
- **Rate Limiting**: Request limiting
- **Security Headers**: Content Security Policy

## 🚀 Deployment Process

### Step 1: Development Deployment
```bash
# Start development server
./dev.sh

# Or manually
wrangler dev --env development --local-port 8787
```

### Step 2: Staging Deployment
```bash
# Deploy to staging
./deploy.sh staging

# Access at: https://cocapn-ide-staging.workers.dev
```

### Step 3: Production Deployment
```bash
# Deploy to production
./deploy.sh production

# Access at: https://cocapn-ide.workers.dev
```

## 🌐 Custom Domains

### Configure Custom Domains
1. **Add Domain in Cloudflare Dashboard**
   - Go to Workers → Your Worker → Custom Domains
   - Add your domain (e.g., `ide.cocapn.com`)

2. **Update DNS Records**
   ```dns
   Type: CNAME
   Name: ide
   Target: cocapn-ide.workers.dev
   Proxy status: Proxied
   ```

3. **Enable SSL**
   - Cloudflare automatically provisions SSL certificates

### Update Configuration
Uncomment and configure routes in `wrangler-ide.toml`:
```toml
[env.production.routes]
pattern = "ide.cocapn.com/*"
zone_name = "cocapn.com"
```

## 🔒 Security Configuration

### Content Security Policy
The Worker includes security headers:
- **Content-Security-Policy**: Restricts script sources
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **X-Frame-Options**: Prevents clickjacking
- **X-XSS-Protection**: Enables XSS filtering

### Rate Limiting
Configure rate limiting in production:
```toml
[env.production.ratelimit]
zone = "cocapn-ide"
requests_per_minute = 100
```

### Secrets Management
Use Wrangler secrets for sensitive data:
```bash
wrangler secret put API_KEY
```

## 📊 Monitoring and Analytics

### Health Check
```bash
curl https://your-worker.workers.dev/health
```

### Custom Analytics (Optional)
1. **Enable Workers Analytics**
   - Upgrade to Workers Paid plan
   - Add analytics to configuration

2. **Track Usage**
   - Monitor successful deployments
   - Track API usage by provider

### Error Monitoring
```bash
# Check logs
wrangler tail --format pretty
```

## 🛠️ Development Workflow

### Local Development
```bash
# Start development server
./dev.sh

# Make changes
# The server auto-reloads
```

### Testing Changes
```bash
# Test specific functionality
curl -X POST https://your-worker.workers.dev/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "provider": "manus"}'

# Check health
curl https://your-worker.workers.dev/health
```

### Deploy to Staging
```bash
# Test changes in staging
./deploy.sh staging

# Verify functionality
curl https://cocapn-ide-staging.workers.dev/health
```

### Production Deployment
```bash
# Final deployment
./deploy.sh production

# Monitor deployment
wrangler tail --format pretty
```

## 🔧 Troubleshooting

### Common Issues

#### Build Errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Deployment Failures
```bash
# Check login status
wrangler whoami

# Check configuration
wrangler config list

# View logs
wrangler tail --format pretty
```

#### API Key Issues
```bash
# Check secrets
wrangler secret list

# Update secrets
wrangler secret put API_KEY
```

### Debug Mode
Enable debug logging:
```bash
# Set debug environment variable
export DEBUG=true

# Start with debug
wrangler dev --env development
```

## 📈 Performance Optimization

### Caching
```toml
# KV namespace for caching
[[env.production.kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"
```

### CDN Optimization
- **Use Workers for static assets**
- **Cache responses appropriately**
- **Minify and compress assets**

### Scaling
- **Use rate limiting**
- **Implement proper error handling**
- **Monitor resource usage**

## 🔄 Maintenance

### Regular Updates
```bash
# Update dependencies
npm update

# Test deployment
./test-deploy.sh

# Deploy updates
./deploy.sh production
```

### Security Audits
- Regularly review configuration
- Update API keys periodically
- Monitor for security patches

### Performance Monitoring
- Monitor response times
- Track error rates
- Monitor resource usage

## 🎯 Best Practices

### Development
- Use environment-specific configurations
- Test in staging before production
- Implement proper error handling
- Use TypeScript for type safety

### Production
- Use secrets for sensitive data
- Implement proper rate limiting
- Monitor performance and errors
- Keep dependencies updated

### Security
- Never commit API keys to version control
- Use proper HTTPS
- Implement input validation
- Use security headers

## 📞 Support

### Documentation
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [Hono Framework Documentation](https://hono.dev/)

### Community
- [Cloudflare Workers Discord](https://discord.gg/cloudflaredev)
- [GitHub Issues](https://github.com/cloudflare/workers-sdk/issues)

### Professional Support
- [Cloudflare Support](https://support.cloudflare.com/)

---

🎉 **Happy Deploying!**

Your Cocapn Hybrid IDE is ready to deploy. Follow the steps above to get your development environment live in minutes.