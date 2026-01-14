# ClaudeFlare CI/CD Pipeline Guide

Comprehensive CI/CD pipeline enhancements for ClaudeFlare distributed AI coding platform on Cloudflare Workers.

## Overview

This enhanced CI/CD pipeline provides:

- **Automated testing workflows** - Unit, integration, and E2E tests with coverage reporting
- **Multi-environment deployments** - Support for dev, staging, and production environments
- **Rollback automation** - Automatic rollback on deployment failures
- **Deployment health checks** - Comprehensive health monitoring and verification
- **Progressive delivery** - Canary deployments and blue-green deployments
- **Pipeline analytics** - Deployment metrics collection and dashboard visualization

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Actions Workflows                 │
├─────────────────────────────────────────────────────────────┤
│  CI Workflow         │  Deploy Workflow  │  Quality/Security│
│  - Linting           │  - Staging        │  - SAST/SAST     │
│  - Type Check        │  - Production     │  - Dependency Scan│
│  - Unit Tests        │  - Health Checks  │  - Performance    │
│  - Integration Tests │  - Rollback       │                  │
│  - Build             │  - Metrics        │                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers                       │
│  - Worker deployment                                        │
│  - Durable Objects                                          │
│  - KV/R2/D1 resources                                       │
└─────────────────────────────────────────────────────────────┘
```

## New Scripts

### 1. CI Orchestration (`scripts/ci.ts`)

Automates the complete CI pipeline with configurable stages.

**Features:**
- Code quality checks (ESLint, Prettier, TypeScript)
- Security scanning (npm audit, secrets detection)
- Unit and integration tests
- Build verification
- Bundle size validation
- Coverage threshold enforcement

**Usage:**
```bash
# Run full CI pipeline
npm run ci

# Quick CI (skip security and bundle check)
npm run ci:quick

# Custom configuration
npx tsx scripts/ci.ts --skip-security --coverage-threshold 90 --output ci-report.json
```

**Environment Variables:**
- `BUILD_START_TIME` - Build start timestamp
- `BUILD_END_TIME` - Build end timestamp
- `GITHUB_SHA` - Commit SHA
- `GITHUB_ACTOR` - Actor who triggered the build

### 2. Health Check (`scripts/health-check.ts`)

Comprehensive health checking for deployed applications.

**Features:**
- HTTP endpoint health monitoring
- Response time metrics (P50, P95, P99)
- Error rate tracking
- Dependency health checks (KV, R2, D1, Durable Objects)
- Resource monitoring (CPU, memory)
- Continuous monitoring with configurable duration

**Usage:**
```bash
# Check production health
npm run health-check:production

# Check with custom settings
npx tsx scripts/health-check.ts \
  --environment staging \
  --duration 120 \
  --threshold 99 \
  --output health-report.json
```

**Health Checks Performed:**
- `/health` - Basic health endpoint
- `/health/kv` - KV namespace health
- `/health/r2` - R2 bucket health
- `/health/d1` - D1 database health
- `/health/durable-objects` - Durable Objects health
- `/metrics` - Application metrics
- `/metrics/cpu` - CPU usage
- `/metrics/memory` - Memory usage

### 3. Rollback Automation (`scripts/rollback-standalone.ts`)

Automated rollback with multiple strategies.

**Features:**
- Immediate rollback
- Gradual rollback (staged traffic reduction)
- Manual rollback with approval
- Pre-rollback backup
- Post-rollback verification
- Version history tracking

**Usage:**
```bash
# Rollback production
npm run rollback:production

# Rollback to specific version
npx tsx scripts/rollback-standalone.ts \
  --environment production \
  --target v1234567890-abc123 \
  --strategy immediate \
  --reason "High error rate detected"

# Gradual rollback
npx tsx scripts/rollback-standalone.ts \
  -e production \
  -s gradual \
  --backup
```

**Rollback Strategies:**

1. **Immediate** - Instant rollback to previous version
2. **Gradual** - Stage-based rollback (10% → 50% → 100%)
3. **Manual** - Prepare rollback plan for manual execution

### 4. Deployment Metrics (`scripts/deployment-metrics.ts`)

Collection and analysis of deployment metrics.

**Features:**
- Deployment tracking (success/failure/rollback)
- Performance metrics (build time, deploy time, latency)
- Quality metrics (test coverage, lint errors)
- Security metrics (vulnerabilities)
- Trend analysis
- Environment-specific metrics

**Usage:**
```bash
# Collect metrics for current deployment
npm run metrics:collect

# Analyze historical metrics
npm run metrics:analyze

# Generate report
npm run metrics:report

# Custom period analysis
npx tsx scripts/deployment-metrics.ts report -p 30 -o analytics.json
```

**Metrics Collected:**
- Deployment ID, version, timestamp
- Build and deploy duration
- Test coverage and pass rate
- Lint and type errors
- Security vulnerabilities
- Bundle size
- Runtime metrics (error rate, latency, memory, CPU)

### 5. Progressive Delivery (`scripts/progressive-delivery.ts`)

Advanced deployment strategies for safe releases.

**Features:**
- Canary deployments with traffic splitting
- Blue-green deployments with traffic switching
- Automated health checks between stages
- Automatic rollback on failures
- Configurable traffic increments and thresholds

**Usage:**
```bash
# Canary deployment
npm run progressive:canary

# Blue-green deployment
npm run progressive:blue-green

# Custom canary configuration
npx tsx scripts/progressive-delivery.ts \
  --strategy canary \
  --environment production \
  --initial-percentage 20 \
  --increment 10 \
  --interval 5 \
  --threshold 0.5 \
  --max-duration 30

# Blue-green with approval
npx tsx scripts/progressive-delivery.ts \
  --strategy blue-green \
  --wait-approval \
  --health-check-duration 10
```

**Canary Configuration:**
```yaml
canary:
  initialPercentage: 10  # Start with 10% traffic
  increment: 10          # Increase by 10% each stage
  interval: 5            # Wait 5 minutes between increments
  threshold: 1           # Error rate threshold (%)
  maxDuration: 30        # Maximum canary duration (minutes)
```

**Blue-Green Configuration:**
```yaml
blueGreen:
  waitForApproval: true     # Require manual approval
  healthCheckDuration: 5    # Health check duration (minutes)
```

### 6. Pipeline Analytics (`scripts/pipeline-analytics.ts`)

Generate comprehensive analytics dashboards.

**Features:**
- Deployment frequency and success rate
- Environment-specific metrics
- Quality trends (coverage, lint errors)
- Security trends (vulnerabilities)
- Performance metrics (build time, latency)
- Automated recommendations
- Multiple output formats (console, JSON, HTML)

**Usage:**
```bash
# Generate console dashboard
npm run analytics

# Generate HTML dashboard
npm run analytics:html

# Custom period and format
npx tsx scripts/pipeline-analytics.ts \
  --period 30 \
  --format html \
  --output dashboard.html
```

**Dashboard Metrics:**
- Overview: Total deployments, success rate, avg duration, frequency
- Environments: Per-environment deployment stats
- Quality: Test coverage, pass rate, lint/type errors
- Security: Vulnerability counts and trends
- Performance: Build/deploy time, latency percentiles
- Recommendations: Actionable insights

## GitHub Actions Workflows

### CI Workflow (`.github/workflows/ci.yml`)

**Stages:**
1. Lint & Type Check
2. Security Audit
3. Unit Tests
4. Integration Tests
5. Build & Analyze
6. CI Orchestration
7. Smoke Tests
8. Pipeline Summary

**Triggers:**
- Push to main, develop, feature branches
- Pull requests to main, develop
- Manual workflow dispatch

### Deploy Workflow (`.github/workflows/deploy.yml`)

**Stages:**
1. Deploy to Staging (on develop branch)
2. Deploy to Production (on main branch)
3. Run smoke tests
4. Health checks (60 seconds)
5. Collect deployment metrics
6. Automatic rollback on failure

**Environments:**
- `staging` - https://staging.claudeflare.workers.dev
- `production` - https://claudeflare.workers.dev

### Progressive Delivery Workflow (`.github/workflows/progressive-delivery.yml`)

**Strategies:**
- Canary deployment with incremental traffic increase
- Blue-green deployment with manual approval
- Full deployment (no progressive delivery)

**Configuration:**
```yaml
canary:
  percentage: 10
  increment: 10
  threshold: 99
  duration: 30
```

### Security Workflow (`.github/workflows/security.yml`)

**Scans:**
- Dependency vulnerability scanning (npm audit, Snyk)
- Static application security testing (CodeQL, Semgrep)
- Secrets detection (TruffleHog, Gitleaks)
- Infrastructure as Code security (Checkov, tfsec)
- Container security (Trivy, Grype)

### Performance Workflow (`.github/workflows/performance.yml`)

**Tests:**
- Load testing (basic, peak, sustained scenarios)
- Stress testing (2000 concurrent users)
- Benchmark tests with comparison
- Latency analysis (cold start, warm)
- Memory profiling
- CPU time analysis

## Environment Configuration

### Development
```toml
[env.development]
name = "claudeflare-dev"
vars = { ENVIRONMENT = "development" }
```

### Staging
```toml
[env.staging]
name = "claudeflare-staging"
route = { pattern = "staging.claudeflare.workers.dev", zone_name = "workers.dev" }
```

### Production
```toml
[env.production]
name = "claudeflare"
route = { pattern = "claudeflare.workers.dev", zone_name = "workers.dev" }
```

## Deployment Process

### Standard Deployment Flow

```
1. CI Pipeline
   ├─ Lint & Type Check
   ├─ Security Scan
   ├─ Unit Tests
   ├─ Integration Tests
   └─ Build & Bundle Check

2. Deploy to Staging
   ├─ Build Worker
   ├─ Deploy to Cloudflare
   ├─ Run Smoke Tests
   ├─ Health Checks (60s)
   └─ Collect Metrics

3. Deploy to Production
   ├─ Build Worker
   ├─ Backup Current Deployment
   ├─ Deploy to Cloudflare
   ├─ Health Checks (60s)
   ├─ Collect Metrics
   └─ Auto-Rollback on Failure
```

### Canary Deployment Flow

```
1. Deploy Canary (10%)
   ├─ Deploy to canary Workers
   ├─ Monitor for 5 min
   └─ Check error rate < 1%

2. Increase to 20%
   ├─ Update traffic split
   ├─ Monitor for 5 min
   └─ Check error rate < 1%

3. Increment to 40%, 60%, 80%, 100%
   ├─ Repeat monitoring
   └─ Auto-rollback on failure

4. Complete Deployment
   └─ 100% traffic to new version
```

### Blue-Green Deployment Flow

```
1. Deploy Green Environment
   ├─ Deploy to green Workers
   └─ Run health checks

2. Verify Green Environment
   ├─ Smoke Tests
   ├─ Integration Tests
   └─ Health Checks (5 min)

3. Manual Approval (if enabled)
   └─ Wait for human approval

4. Switch Traffic to Green
   ├─ Update DNS/LB rules
   └─ Verify traffic switch

5. Cleanup Blue Environment
   └─ Remove old deployment
```

## Rollback Process

### Automatic Rollback
- Triggered on deployment failure
- Triggered on health check failure
- Triggered on error rate threshold exceeded
- Immediate rollback to previous version

### Manual Rollback
```bash
# Rollback to previous version
npm run rollback:production

# Rollback to specific version
npx tsx scripts/rollback-standalone.ts \
  --environment production \
  --target v1234567890-abc123 \
  --reason "Performance degradation"
```

### Rollback Strategies

**Immediate Rollback:**
- Fastest rollback time (~30 seconds)
- Full traffic switch to previous version
- Best for critical failures

**Gradual Rollback:**
- Staged rollback (~5 minutes)
- Reduces risk of cascade failures
- Best for ambiguous failures

## Metrics & Analytics

### Deployment Metrics

**Success Metrics:**
- Deployment success rate
- Change failure rate
- Mean time to restore (MTTR)

**Performance Metrics:**
- Build duration
- Deploy duration
- P50/P95/P99 deployment time

**Quality Metrics:**
- Test coverage percentage
- Test pass rate
- Lint error count
- Type error count

**Security Metrics:**
- Total vulnerabilities
- Critical/High/Medium/Low counts
- Vulnerability trends

### Viewing Analytics

**Console Dashboard:**
```bash
npm run analytics
```

**HTML Dashboard:**
```bash
npm run analytics:html
# View dashboard.html in browser
```

**JSON Export:**
```bash
npx tsx scripts/pipeline-analytics.ts \
  --format json \
  --output analytics.json
```

## Best Practices

### 1. Pre-Deployment
- Always run `npm run ci` before pushing
- Ensure test coverage is above threshold (80%)
- Check for security vulnerabilities
- Review bundle size impact

### 2. Deployment
- Use canary deployments for production
- Monitor health checks closely
- Have rollback plan ready
- Keep deployments small and frequent

### 3. Post-Deployment
- Run health checks for at least 60 seconds
- Monitor error rates and latency
- Collect deployment metrics
- Review analytics dashboard

### 4. Rollback
- Don't hesitate to rollback on failures
- Use gradual rollback for ambiguous issues
- Always verify rollback health
- Investigate failure root cause

### 5. Progressive Delivery
- Start with low canary percentage (10%)
- Use sufficient monitoring time (5+ minutes)
- Set appropriate error thresholds (< 1%)
- Enable manual approval for critical deployments

## Troubleshooting

### Deployment Failures

**Issue:** Deployment fails during build
```bash
# Check build logs
npm run build

# Verify bundle size
npm run check-bundle-size

# Check type errors
npm run typecheck
```

**Issue:** Deployment fails health checks
```bash
# Run extended health check
npx tsx scripts/health-check.ts --environment production --duration 300

# Check specific endpoints
curl https://claudeflare.workers.dev/health
curl https://claudeflare.workers.dev/metrics
```

**Issue:** Rollback needed
```bash
# Immediate rollback
npm run rollback:production

# Check previous versions
npx wrangler deployments list --env production
```

### Performance Issues

**Issue:** High latency after deployment
```bash
# Check metrics endpoint
curl https://claudeflare.workers.dev/metrics

# Run performance tests
npm run test:benchmark
```

**Issue:** High error rate
```bash
# Run health check with low threshold
npx tsx scripts/health-check.ts --threshold 90

# Rollback if necessary
npm run rollback:production
```

### CI Pipeline Failures

**Issue:** Tests failing
```bash
# Run tests locally
npm run test:unit
npm run test:integration

# Check coverage
npm run test:coverage

# Run specific test file
npx vitest run path/to/test.test.ts
```

**Issue:** Security vulnerabilities found
```bash
# Check npm audit
npm audit --audit-level=moderate

# Update dependencies
npm update

# Review security report
cat npm-audit-report.json
```

## Configuration Files

### Wrangler Configuration (`wrangler.toml`)
- Environment-specific settings
- Resource bindings (KV, R2, D1, Durable Objects)
- Routes and domains
- Limits and quotas

### GitHub Secrets Required
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID
- `SNYK_TOKEN` - Snyk security scanning token
- `CODECOV_TOKEN` - Codecov coverage token
- `SLACK_WEBHOOK` - Slack notifications webhook

### Environment Variables
- `NODE_ENV` - Environment (development, staging, production)
- `BUILD_START_TIME` - Build start timestamp
- `BUILD_END_TIME` - Build end timestamp
- `GITHUB_SHA` - Commit SHA
- `GITHUB_ACTOR` - GitHub actor
- `GITHUB_RUN_ID` - GitHub Actions run ID

## Advanced Usage

### Custom CI Pipeline
```typescript
import { CIOrchestrator, CIConfig } from './scripts/ci';

const config: CIConfig = {
  skipLint: false,
  skipTypeCheck: false,
  skipTests: false,
  skipSecurity: false,
  coverageThreshold: 90,
  verbose: true,
  fixIssues: false,
};

const orchestrator = new CIOrchestrator(config);
await orchestrator.run();
```

### Custom Health Checks
```typescript
import { HealthChecker, HealthCheckConfig } from './scripts/health-check';

const config: HealthCheckConfig = {
  environment: 'production',
  timeout: 15000,
  retries: 5,
  threshold: 99.5,
  duration: 300,
  interval: 10,
  verbose: true,
};

const checker = new HealthChecker(config);
await checker.run();
```

### Custom Progressive Delivery
```typescript
import { ProgressiveDeliveryManager } from './scripts/progressive-delivery';

const config = {
  environment: 'production',
  strategy: 'canary',
  canaryConfig: {
    initialPercentage: 20,
    increment: 20,
    incrementInterval: 3,
    threshold: 0.5,
    maxDuration: 20,
  },
};

const manager = new ProgressiveDeliveryManager(config);
await manager.deploy();
```

## Support & Documentation

- GitHub Issues: https://github.com/your-org/claudeflare/issues
- Documentation: /docs
- API Documentation: /docs/api
- Architecture: /docs/architecture

## Changelog

### Version 0.2.0 (Current)
- Added comprehensive CI orchestration
- Enhanced health check system
- Automated rollback with multiple strategies
- Deployment metrics collection
- Progressive delivery (canary, blue-green)
- Pipeline analytics dashboard
- Multi-environment deployment support
- Enhanced GitHub Actions workflows

### Version 0.1.0
- Initial CI/CD pipeline
- Basic deployment automation
- Simple health checks
