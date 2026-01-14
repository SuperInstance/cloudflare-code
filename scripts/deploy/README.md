# ClaudeFlare Deployment System

Comprehensive Cloudflare Workers deployment automation with zero-downtime deployments, multi-region support, and automatic rollback capabilities.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ClaudeFlare Deployer                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Worker     │  │ Durable      │  │   Storage    │      │
│  │  Deployer    │  │   Objects    │  │ Provisioner  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Secret     │  │   Verify     │  │   Rollback   │      │
│  │   Manager    │  │    System    │  │    Manager   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **Zero-Downtime Deployments**: Staged rollout with automatic health checks
- **Multi-Region Support**: Deploy to 100+ Cloudflare edge locations
- **Automatic Rollback**: Instant rollback on deployment failure
- **Comprehensive Verification**: Health checks, smoke tests, and monitoring
- **Secret Management**: Encrypted secret provisioning and rotation
- **Resource Provisioning**: Automated KV, R2, D1, and Durable Objects setup
- **Environment Management**: Dev, staging, and production configurations

## Installation

```bash
# Install dependencies
npm install

# Install Wrangler CLI globally
npm install -g wrangler

# Authenticate with Cloudflare
wrangler login
```

## Environment Variables

Create a `.env` file:

```bash
# Cloudflare
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id

# Secret Encryption
SECRET_ENCRYPTION_KEY=your_32_byte_hex_key

# Development
DEV_API_KEY=your_dev_api_key
DEV_DATABASE_URL=your_dev_database_url

# Staging
STAGING_API_KEY=your_staging_api_key
STAGING_DATABASE_URL=your_staging_database_url

# Production
PRODUCTION_API_KEY=your_production_api_key
PRODUCTION_DATABASE_URL=your_production_database_url
PRODUCTION_ENCRYPTION_KEY=your_production_encryption_key

# AI Providers
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Authentication
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret
```

## Quick Start

### Deploy to Staging

```bash
npm run deploy:staging
```

### Deploy to Production

```bash
npm run deploy:production
```

### Rollback Deployment

```bash
npm run rollback:production
```

### Verify Deployment

```bash
npm run verify:production
```

## Deployment Commands

### Full Deployment

```bash
# Deploy to specific environment
npm run deploy:staging
npm run deploy:production

# Deploy with zero-downtime (default)
npm run deploy:production

# Deploy with dry-run
DEPLOYMENT_DRY_RUN=true npm run deploy:production

# Deploy with verbose output
DEPLOYMENT_VERBOSE=true npm run deploy:production
```

### Component Deployment

```bash
# Deploy only worker
npm run deploy:worker

# Deploy only Durable Objects
npm run deploy:do

# Provision storage resources
npm run provision:storage

# Provision secrets
npm run provision:secrets
```

### Rollback Commands

```bash
# Rollback to previous version
npm run rollback:production

# Rollback to specific version
npm run rollback:production <version-id>

# Automatic rollback on failure
AUTO_ROLLBACK=true npm run deploy:production
```

### Verification Commands

```bash
# Verify deployment health
npm run verify:production

# Run smoke tests
npm run test:smoke

# Monitor deployment
npm run monitor:deployment
```

## Deployment Architecture

### Zero-Downtime Strategy

```
Stage 1: 10% → Health Check → 30s wait
     ↓
Stage 2: 50% → Health Check → 30s wait
     ↓
Stage 3: 100% → Final Verification
```

### Multi-Region Deployment

```
Production (Global)
├── Workers (100+ edge locations)
│   ├── wnam (North America West)
│   ├── enam (North America East)
│   ├── weur (Europe West)
│   ├── eeur (Europe East)
│   ├── apac (Asia Pacific)
│   └── ... (95+ more locations)
│
├── Durable Objects (20 locations)
│   ├── Session Manager (5 locations)
│   ├── Agent Orchestrator (10 locations)
│   └── Vector Index (5 locations)
│
├── KV (Global replication)
│   ├── Cache KV
│   └── Sessions KV
│
├── R2 (Regional buckets)
│   └── claudeflare-storage
│
└── D1 (Single region)
    └── claudeflare-db
```

## Deployment Pipeline

### Pre-Deployment

1. **Validation**
   - Check Wrangler installation
   - Verify Cloudflare authentication
   - Validate environment variables
   - Check bundle size limits

2. **Build**
   - Compile TypeScript
   - Bundle with esbuild
   - Generate source maps
   - Verify bundle size

3. **Testing**
   - Run unit tests
   - Run integration tests
   - Generate coverage report

### Deployment

1. **Storage Provisioning**
   - Create KV namespaces
   - Create R2 buckets
   - Create D1 databases
   - Run migrations

2. **Secret Deployment**
   - Validate secrets
   - Encrypt sensitive data
   - Deploy to Cloudflare
   - Verify deployment

3. **Durable Objects**
   - Deploy DO classes
   - Initialize instances
   - Configure routing
   - Health check

4. **Worker Deployment**
   - Upload worker script
   - Configure bindings
   - Update DNS
   - Verify routing

### Post-Deployment

1. **Verification**
   - Health checks
   - Smoke tests
   - API endpoint tests
   - Storage accessibility

2. **Monitoring**
   - Error rates
   - Latency metrics
   - Request counts
   - Resource usage

## Configuration

### wrangler.toml

The deployment system uses `wrangler.toml` for configuration:

```toml
name = "claudeflare"
main = "dist/worker.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[env.staging]
name = "claudeflare-staging"
vars = { ENVIRONMENT = "staging" }

[[env.staging.kv_namespaces]]
binding = "CACHE_KV"
id = "your_kv_id"

[env.production]
name = "claudeflare"
vars = { ENVIRONMENT = "production" }
```

### Deployment Config

```typescript
import { ClaudeFlareDeployer } from './scripts/deploy/index.js';

const deployer = new ClaudeFlareDeployer({
  environment: 'production',
  zeroDowntime: true,
  rolloutPercentage: 10,
  healthCheckTimeout: 30000,
  maxRetries: 3,
  skipTests: false,
  skipVerification: false,
  dryRun: false,
  verbose: true,
  regions: ['wnam', 'enam', 'weur', 'apac'],
});
```

## Advanced Usage

### Custom Deployment

```typescript
import { deploy } from './scripts/deploy/index.js';

await deploy('production', {
  zeroDowntime: true,
  rolloutPercentage: 25,
  healthCheckTimeout: 45000,
  verbose: true,
});
```

### Custom Rollback

```typescript
import { rollback } from './scripts/deploy/index.js';

await rollback('production', {
  strategy: 'gradual',
  targetVersion: 'v1234567890-abc123',
  backupData: true,
  verifyAfterRollback: true,
  maxRollbackTime: 300000,
});
```

### Programmatic Deployment

```typescript
import { ClaudeFlareDeployer } from './scripts/deploy/index.js';

const deployer = new ClaudeFlareDeployer({
  environment: 'staging',
  zeroDowntime: true,
});

await deployer.deploy({
  worker: {
    name: 'claudeflare',
    scriptPath: 'dist/worker.js',
    compatibilityDate: '2024-01-01',
    compatibilityFlags: ['nodejs_compat'],
    bindings: [],
    limits: {
      cpuMs: 50,
      memory: 128,
      maxRequestsPerSecond: 1000,
    },
  },
  durableObjects: DEFAULT_DURABLE_OBJECTS,
  storage: DEFAULT_STORAGE_CONFIGS,
  secrets: DEFAULT_SECRETS,
});
```

## Monitoring and Logging

### View Deployment Logs

```bash
# Tail worker logs
npm run tail

# View deployment events
npm run logs:deployment

# Monitor metrics
npm run metrics:live
```

### Health Checks

```bash
# Check health endpoint
curl https://claudeflare.workers.dev/health

# Check metrics
curl https://claudeflare.workers.dev/metrics

# Check version
curl https://claudeflare.workers.dev/version
```

## Troubleshooting

### Common Issues

**Deployment fails with "Authentication required"**
```bash
wrangler login
```

**Bundle size exceeds limit**
```bash
npm run analyze-bundle
```

**Health checks failing**
```bash
npm run verify:production
npm run tail
```

**Rollback needed**
```bash
npm run rollback:production
```

### Debug Mode

```bash
# Enable verbose output
DEPLOYMENT_VERBOSE=true npm run deploy:production

# Dry run mode
DEPLOYMENT_DRY_RUN=true npm run deploy:production

# Skip tests
SKIP_TESTS=true npm run deploy:production

# Skip verification
SKIP_VERIFICATION=true npm run deploy:production
```

## Best Practices

1. **Always test in staging first**
   ```bash
   npm run deploy:staging
   npm run verify:staging
   ```

2. **Use zero-downtime deployments**
   ```bash
   npm run deploy:production
   ```

3. **Monitor after deployment**
   ```bash
   npm run verify:production
   npm run tail
   ```

4. **Keep backups**
   ```bash
   npm run backup
   ```

5. **Verify rollback procedures**
   ```bash
   npm run test:rollback
   ```

## CI/CD Integration

### GitHub Actions

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npm run deploy:production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

## API Reference

### ClaudeFlareDeployer

Main deployment orchestrator class.

```typescript
class ClaudeFlareDeployer {
  constructor(config: Partial<DeploymentConfig>, logger?: Logger)
  deploy(options: DeploymentOptions): Promise<void>
  rollback(rollbackConfig?: RollbackConfig): Promise<void>
  getEvents(): DeploymentEvent[]
  getMetrics(): DeploymentMetrics
}
```

### WorkerDeployer

Handles worker deployment with zero-downtime support.

```typescript
class WorkerDeployer {
  preDeploymentChecks(): Promise<PreDeploymentCheckResult>
  deploy(options: WorkerDeploymentOptions): Promise<void>
  performHealthChecks(regions: DeploymentRegion[]): Promise<HealthCheckResult[]>
}
```

### StorageProvisioner

Provisions KV, R2, and D1 resources.

```typescript
class StorageProvisioner {
  provisionAll(options: StorageOptions): Promise<void>
  provisionKV(config: KVNamespaceConfig): Promise<ProvisionResult>
  provisionR2(config: R2BucketConfig): Promise<ProvisionResult>
  provisionD1(config: D1DatabaseConfig): Promise<ProvisionResult>
}
```

### SecretManager

Manages secret provisioning and rotation.

```typescript
class SecretManager {
  provisionSecrets(secrets: SecretConfig[]): Promise<void>
  rotateSecret(secret: SecretConfig, newValue: string): Promise<void>
  exportSecrets(outputPath: string): Promise<void>
  importSecrets(inputPath: string): Promise<void>
}
```

### DeploymentVerifier

Comprehensive deployment verification.

```typescript
class DeploymentVerifier {
  verifyDeployment(): Promise<VerificationResult>
  performMultiRegionHealthChecks(regions: DeploymentRegion[]): Promise<HealthCheckResult[]>
  smokeTest(): Promise<SmokeTestResult>
  monitorDeployment(duration: number, interval?: number): Promise<void>
}
```

### RollbackManager

Handles deployment rollback with multiple strategies.

```typescript
class RollbackManager {
  rollback(rollbackConfig: RollbackConfig): Promise<void>
  listRollbackVersions(): Promise<RollbackVersion[]>
  backupCurrentState(): Promise<void>
  autoRollbackOnFailure(): Promise<void>
}
```

## Support

For issues and questions:
- GitHub Issues: [ClaudeFlare Issues](https://github.com/claudeflare/claudeflare/issues)
- Documentation: [ClaudeFlare Docs](https://docs.claudeflare.com)
- Discord: [ClaudeFlare Discord](https://discord.gg/claudeflare)

## License

MIT License - see LICENSE file for details.
