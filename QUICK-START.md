# ClaudeFlare CI/CD Quick Start

## 🚀 5-Minute Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your Cloudflare credentials
```

### 3. Authenticate with Cloudflare
```bash
wrangler login
```

### 4. Run Initial Setup
```bash
./scripts/setup.sh
```

### 5. Deploy to Staging
```bash
npm run deploy:staging
```

## 📋 Common Commands

### Development
```bash
npm run dev              # Start local dev server
npm run build            # Build for production
npm run lint             # Check code quality
npm run typecheck        # TypeScript type check
```

### Testing
```bash
npm test                 # Run all tests
npm run test:unit        # Unit tests with coverage
npm run test:integration # Integration tests
npm run test:smoke       # Smoke tests (after deployment)
```

### Deployment
```bash
npm run deploy:staging    # Deploy to staging
npm run deploy:production # Deploy to production
npm run verify           # Verify deployment
npm run rollback         # Rollback to previous version
```

## 🔄 CI/CD Pipeline

### Automatic Triggers
- **Push to `develop`** → Deploy to staging
- **Push to `main`** → Deploy to production
- **Pull Request** → Run quality checks

### Pipeline Stages
1. **Quality Checks** (3-5 min)
   - ESLint
   - TypeScript
   - Tests (80%+ coverage)
   - Security scan

2. **Build** (2-3 min)
   - Bundle Workers
   - Check size (<3MB)
   - Analyze composition

3. **Deploy** (3-5 min)
   - Deploy to Cloudflare
   - Run smoke tests
   - Verify health
   - Auto-rollback on failure

## 🔧 Required Secrets

Add to GitHub repository settings:

```
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
CODECOV_TOKEN=your-codecov-token (optional)
SNYK_TOKEN=your-snyk-token (optional)
SLACK_WEBHOOK=your-webhook (optional)
```

## 📊 Health Checks

```bash
# Health
curl https://claudeflare.workers.dev/health

# Version
curl https://claudeflare.workers.dev/version

# Metrics
curl https://claudeflare.workers.dev/metrics
```

## 🐛 Troubleshooting

### Build fails
```bash
rm -rf node_modules package-lock.json
npm install
```

### Deployment fails
- Check GitHub Secrets are set
- Verify API token has Workers permissions
- Ensure `wrangler.toml` is configured

### Tests fail locally
```bash
npm run lint:fix
npm run typecheck
```

## 📚 Full Documentation

- [README.md](./README.md) - Project overview
- [README-DEPLOYMENT.md](./README-DEPLOYMENT.md) - Detailed deployment guide
- [CI-CD-SETUP-SUMMARY.md](./CI-CD-SETUP-SUMMARY.md) - Complete setup summary

## ✅ Quality Gates

Before merging to `main`:
- [ ] All tests pass
- [ ] Coverage ≥80%
- [ ] ESLint: 0 errors
- [ ] TypeScript: Pass
- [ ] Bundle <3MB
- [ ] Staging verified

## 🎯 Next Steps

1. ✅ Complete initial setup
2. ✅ Configure GitHub Secrets
3. ✅ Deploy to staging
4. ✅ Verify all endpoints
5. ✅ Deploy to production

---

**Need help?** Check [README-DEPLOYMENT.md](./README-DEPLOYMENT.md) for detailed instructions.
