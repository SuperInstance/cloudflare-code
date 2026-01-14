# ClaudeFlare CI/CD Deployment Guide

Complete guide for deploying ClaudeFlare using GitHub Actions and Cloudflare Workers with zero infrastructure cost.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [GitHub Secrets Configuration](#github-secrets-configuration)
4. [Cloudflare Resources Setup](#cloudflare-resources-setup)
5. [Local Development](#local-development)
6. [Deployment Workflows](#deployment-workflows)
7. [Monitoring and Verification](#monitoring-and-verification)
8. [Troubleshooting](#troubleshooting)
9. [Rollback Procedures](#rollback-procedures)

## Prerequisites

Before setting up CI/CD, ensure you have:

- **Node.js 20+** installed
- **npm 10+** installed
- **GitHub account** with repository access
- **Cloudflare account** (free tier)
- **Git** installed and configured

## Initial Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/your-org/claudeflare.git
cd claudeflare

# Install dependencies
npm install
```

### 2. Install Wrangler CLI

```bash
# Install Wrangler globally
npm install -g wrangler

# Authenticate with Cloudflare
wrangler login
```

## GitHub Secrets Configuration

Configure the following secrets in your GitHub repository settings (`Settings > Secrets and variables > Actions`):

### Required Secrets

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare Account ID | Dashboard > Right sidebar > Account ID |
| `CLOUDFLARE_API_TOKEN` | API token with Workers permissions | Profile > API Tokens > Create Token |
| `CODECOV_TOKEN` | Codecov upload token | Codecov.io > Settings > Repository |
| `SNYK_TOKEN` | Snyk security scanner token | Snyk.io > General > API Token |
| `SLACK_WEBHOOK` | Slack notifications webhook | Slack App > Incoming Webhooks |

### Creating a Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token"
3. Use "Edit Cloudflare Workers" template
4. Configure permissions:
   - Account > Cloudflare Workers > Edit
   - Account > Workers KV Storage > Edit
   - Account > Workers Durable Objects > Edit
   - Account > Workers R2 Storage > Edit
   - Account > D1 > Edit
5. Set account resources to your account
6. Click "Continue to summary" and create token
7. Copy the token (you won't see it again!)

## Cloudflare Resources Setup

### 1. Create KV Namespace

```bash
# Create production KV namespace
wrangler kv:namespace create "CACHE_KV" --env production

# Create staging KV namespace
wrangler kv:namespace create "CACHE_KV" --env staging
```

Update `wrangler.toml` with the returned IDs.

### 2. Create R2 Bucket

```bash
# Create production R2 bucket
wrangler r2 bucket create "claudeflare-production-storage"

# Create staging R2 bucket
wrangler r2 bucket create "claudeflare-staging-storage"
```

### 3. Create D1 Database

```bash
# Create production D1 database
wrangler d1 create "claudeflare-production-db"

# Create staging D1 database
wrangler d1 create "claudeflare-staging-db"
```

Update `wrangler.toml` with the returned database IDs.

### 4. Create Durable Objects Classes

Durable Objects are defined in your code. They're automatically created when first deployed.

## Local Development

### Running Locally

```bash
# Start local development server
npm run dev

# Or with Wrangler
wrangler dev

# With local mode (no internet)
npm run local
```

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests with coverage
npm run test:unit

# Run integration tests
npm run test:integration

# Run smoke tests
npm run test:smoke

# Watch mode
npm run test:watch
```

### Code Quality Checks

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Type check
npm run typecheck

# All quality checks
npm run lint && npm run typecheck && npm test
```

## Deployment Workflows

### Automated Deployment

Deployments are triggered automatically:

- **To Staging**: Push to `develop` branch
- **To Production**: Push to `main` branch

```bash
# Deploy to staging
git checkout develop
git merge feature/your-feature
git push origin develop

# Deploy to production
git checkout main
git merge develop
git push origin main
```

### Manual Deployment

Trigger deployment manually via GitHub Actions:

1. Go to **Actions** tab in GitHub
2. Select **Deploy** workflow
3. Click **Run workflow**
4. Choose environment (`staging` or `production`)
5. Click **Run workflow**

### Local Deployment

Deploy directly from your machine:

```bash
# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production

# Deploy with dry run (no actual deployment)
./scripts/deploy.sh staging --dry-run
```

## CI/CD Pipeline Stages

### Stage 1: Quality Checks (`.github/workflows/quality.yml`)

Triggered on: All pushes and pull requests

- ESLint code quality checks
- TypeScript strict type checking
- Unit tests with coverage
- Integration tests
- Security scanning (Snyk, npm audit)
- Secret detection

**Success Criteria:**
- Zero ESLint errors
- TypeScript compilation passes
- 80%+ test coverage
- No high-severity security issues

### Stage 2: Build Validation (`.github/workflows/build.yml`)

Triggered on: All pushes and pull requests

- Build Workers bundle
- Check bundle size (<3MB)
- Analyze bundle composition
- Environment-specific builds

**Success Criteria:**
- Bundle builds successfully
- Bundle size <3MB
- No critical dependencies

### Stage 3: Deployment (`.github/workflows/deploy.yml`)

Triggered on:
- Push to `main` (production)
- Push to `develop` (staging)
- Manual workflow dispatch

**Process:**
1. Build for target environment
2. Backup current deployment
3. Deploy to Cloudflare Workers
4. Run smoke tests
5. Verify deployment health
6. Create GitHub release (production only)
7. Send notifications

## Monitoring and Verification

### Deployment Verification

After deployment, run verification:

```bash
# Verify staging deployment
npm run verify -- staging

# Verify production deployment
npm run verify -- production
```

### Health Check Endpoints

```bash
# Health check
curl https://claudeflare.workers.dev/health

# Version info
curl https://claudeflare.workers.dev/version

# Metrics
curl https://claudeflare.workers.dev/metrics
```

### Monitoring in Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your account
3. Navigate to **Workers & Pages**
4. Click on `claudeflare` worker
5. View:
   - Analytics (requests, errors, latency)
   - Logs (real-time log streaming)
   - Metrics (CPU time, memory usage)
   - Traces (distributed tracing)

### Local Logs Monitoring

```bash
# Tail Worker logs in real-time
npm run tail

# Or with Wrangler
wrangler tail
```

## Rollback Procedures

### Automatic Rollback

If deployment fails or smoke tests fail, automatic rollback is triggered.

### Manual Rollback via GitHub Actions

1. Go to **Actions** tab
2. Select **Deploy** workflow
3. Click **Run workflow**
4. Choose environment
5. Check **Rollback to previous version**
6. Click **Run workflow**

### Manual Rollback via CLI

```bash
# Rollback staging
npm run rollback:staging

# Rollback production
npm run rollback:production
```

### Manual Rollback Steps

```bash
# 1. List recent deployments
wrangler deployments list --env production

# 2. Get previous deployment version
# (copy the version ID from the list)

# 3. Rollback to specific version
wrangler rollback --env production

# 4. Verify rollback
npm run verify -- production
```

## Quality Gates

### Pre-Merge Checklist

Before merging to `main`:

- [ ] All tests pass (unit, integration, smoke)
- [ ] Code coverage >= 80%
- [ ] ESLint shows zero errors
- [ ] TypeScript type checking passes
- [ ] Bundle size <3MB
- [ ] Security scan shows no critical issues
- [ ] Manual testing completed
- [ ] Documentation updated

### Pre-Deployment Checklist

Before deploying to production:

- [ ] Staging deployment successful
- [ ] Smoke tests pass on staging
- [ ] Performance benchmarks met
- [ ] Load tests pass (if applicable)
- [ ] Rollback plan documented
- [ ] Team notified

## Environment Variables

### Staging Variables

Set in `wrangler.toml` under `[env.staging.vars]`:

```toml
ENVIRONMENT = "staging"
LOG_LEVEL = "debug"
ENABLE_CACHE = "true"
```

### Production Variables

Set in `wrangler.toml` under `[env.production.vars]`:

```toml
ENVIRONMENT = "production"
LOG_LEVEL = "info"
ENABLE_CACHE = "true"
```

## Cost Optimization

### Free Tier Usage

- **Workers**: 100K requests/day
- **KV**: 100K reads/day, 1K writes/day
- **Durable Objects**: Unlimited
- **R2**: 10GB storage, 1M Class A operations/month
- **D1**: 5GB storage, 25M rows read/day

### Monitoring Free Tier Usage

```bash
# Check usage via Wrangler
wrangler analytics --format json

# Monitor in Cloudflare Dashboard
# Workers & Pages > Your Worker > Metrics
```

## Troubleshooting

### Common Issues

#### 1. Build Fails with "Module not found"

**Problem**: Dependencies missing or incorrect import paths.

**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
```

#### 2. Deployment Fails with "Authentication error"

**Problem**: Invalid or missing Cloudflare API token.

**Solution**:
- Verify `CLOUDFLARE_API_TOKEN` in GitHub Secrets
- Token must have Workers, KV, R2, D1 permissions
- Regenerate token if expired

#### 3. Bundle Size Exceeds 3MB

**Problem**: Worker bundle too large for Cloudflare.

**Solution**:
```bash
# Analyze bundle composition
npm run analyze-bundle

# Remove unused dependencies
npm prune

# Use dynamic imports for large modules
```

#### 4. Tests Fail in CI but Pass Locally

**Problem**: Environment differences or timing issues.

**Solution**:
- Check test timeouts (increase if needed)
- Ensure all mocks are properly set up
- Use fixed test data instead of dynamic values
- Check Node.js version matches CI (20.x)

#### 5. KV/D1/R2 Binding Errors

**Problem**: Resources not created or IDs not set.

**Solution**:
```bash
# List KV namespaces
wrangler kv:namespace list

# List R2 buckets
wrangler r2 bucket list

# List D1 databases
wrangler d1 list

# Update wrangler.toml with correct IDs
```

### Getting Help

- **GitHub Issues**: Report bugs and feature requests
- **Cloudflare Community**: https://community.cloudflare.com
- **Cloudflare Discord**: https://discord.gg/cloudflaredev
- **Documentation**: https://developers.cloudflare.com/workers/

## Best Practices

### 1. Branch Strategy

- `main` - Production-ready code
- `develop` - Staging integration branch
- `feature/*` - Feature branches
- `bugfix/*` - Bug fixes
- `hotfix/*` - Emergency production fixes

### 2. Commit Messages

Follow conventional commits:

```
feat: add new agent orchestration
fix: resolve KV storage timeout
docs: update deployment guide
test: add integration tests for Durable Objects
chore: upgrade dependencies
```

### 3. Pull Request Guidelines

- Descriptive title and description
- Link to related issues
- All tests passing
- Code review required
- Update documentation if needed

### 4. Security

- Never commit secrets or API keys
- Use environment variables for sensitive data
- Regular dependency updates
- Security scanning in CI/CD
- Review dependencies for vulnerabilities

## Performance Targets

- **Cold start**: <100ms
- **Cache hit**: <10ms
- **API response**: <50ms (p95)
- **Uptime**: 99.9%
- **Error rate**: <0.1%

## Next Steps

1. Complete initial setup
2. Configure all GitHub Secrets
3. Create Cloudflare resources
4. Run local tests
5. Deploy to staging
6. Verify staging deployment
7. Deploy to production
8. Set up monitoring alerts

## Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Hono Framework](https://hono.dev/)
- [Vitest Documentation](https://vitest.dev/)
