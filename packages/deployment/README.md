# ClaudeFlare Deployment Automation System

Production-ready deployment automation for ClaudeFlare with zero-downtime deployments, blue-green deployments, canary deployments, automated smoke testing, and continuous delivery pipelines.

## Features

### Deployment Strategies

- **Zero-Downtime Deployment**: Rolling updates with graceful shutdown and health checks
- **Blue-Green Deployment**: Parallel environments with instant traffic switching
- **Canary Deployment**: Progressive rollout with automated monitoring and rollback

### Automation

- **Smoke Testing**: Automated health, API, database, cache, and integration tests
- **Deployment Verification**: HTTP, TCP, DNS, SSL, and performance checks
- **Continuous Delivery**: Full CD pipeline with build, test, deploy, and verify stages
- **GitOps Integration**: Automatic synchronization with Git repositories
- **Rollback Automation**: Immediate, gradual, or manual rollback options

### Monitoring

- **Real-time Metrics**: Deployment progress, health checks, and traffic metrics
- **Prometheus Integration**: Export metrics in Prometheus format
- **Alerting**: Built-in notifications for Slack, email, webhooks, and PagerDuty

## Installation

```bash
npm install @claudeflare/deployment
```

## Quick Start

### Zero-Downtime Deployment

```typescript
import {
  ZeroDowntimeDeployer,
  DeploymentStrategy,
  Environment,
} from '@claudeflare/deployment';

const deployer = new ZeroDowntimeDeployer({
  config: {
    id: 'deploy-123',
    strategy: DeploymentStrategy.ZERO_DOWNTIME,
    environment: Environment.PRODUCTION,
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user@example.com',
  },
  targets: [
    {
      id: 'target-1',
      name: 'Production Server 1',
      url: 'https://server1.example.com',
      healthCheckUrl: 'https://server1.example.com/health',
      maxInstances: 10,
      minInstances: 2,
      currentInstances: 5,
    },
  ],
  healthChecks: [
    {
      id: 'health-1',
      name: 'HTTP Health Check',
      type: 'http',
      endpoint: 'https://server1.example.com/health',
      interval: 5000,
      timeout: 30000,
      threshold: 3,
      retries: 3,
      expectedStatus: 200,
    },
  ],
  zeroDowntimeConfig: {
    batchSize: 1,
    batchInterval: 30000,
    healthCheckInterval: 5000,
    healthCheckTimeout: 30000,
    gracePeriod: 30000,
    shutdownTimeout: 60000,
    maxRetries: 3,
    rollbackOnError: true,
  },
});

const result = await deployer.deploy();
console.log('Deployment status:', result.status);
```

### Blue-Green Deployment

```typescript
import { BlueGreenDeployer } from '@claudeflare/deployment';

const deployer = new BlueGreenDeployer({
  config: deploymentConfig,
  blueTargets: blueEnvironmentTargets,
  greenTargets: greenEnvironmentTargets,
  healthChecks: healthChecks,
  verificationChecks: verificationChecks,
  blueGreenConfig: {
    blueEnvironment: 'production-blue',
    greenEnvironment: 'production-green',
    switchMode: 'gradual',
    validationTimeout: 300000,
    autoRollback: true,
    rollbackTimeout: 60000,
    keepOldVersion: false,
  },
});

const result = await deployer.deploy();
```

### Canary Deployment

```typescript
import { CanaryDeployer } from '@claudeflare/deployment';

const deployer = new CanaryDeployer({
  config: deploymentConfig,
  baselineTargets: productionTargets,
  canaryTargets: canaryTargets,
  healthChecks: healthChecks,
  canaryConfig: {
    stages: [
      {
        name: '10% Traffic',
        percentage: 10,
        duration: 300000,
        minSuccessRate: 99,
        maxErrorRate: 1,
        checks: ['http-health', 'api-response'],
        autoPromote: true,
      },
      {
        name: '50% Traffic',
        percentage: 50,
        duration: 300000,
        minSuccessRate: 99,
        maxErrorRate: 1,
        checks: ['http-health', 'api-response'],
        autoPromote: true,
      },
      {
        name: '100% Traffic',
        percentage: 100,
        duration: 300000,
        minSuccessRate: 99,
        maxErrorRate: 1,
        checks: ['http-health', 'api-response'],
        autoPromote: true,
      },
    ],
    autoPromote: true,
    autoRollback: true,
    rollbackThreshold: 5,
    monitoringWindow: 600000,
    metricsCheckInterval: 10000,
    successCriteria: {
      minSuccessRate: 99,
      maxErrorRate: 1,
      maxResponseTime: 500,
      minHealthScore: 90,
    },
    rollbackCriteria: {
      maxErrorRate: 5,
      minSuccessRate: 95,
      maxResponseTime: 1000,
      minHealthScore: 70,
      errorSpikeThreshold: 3,
    },
  },
});

const result = await deployer.deploy();
```

## CLI Usage

### Deploy Application

```bash
# Zero-downtime deployment
claudeflare-deploy deploy --strategy zero-downtime --environment production --version 1.0.0

# Blue-green deployment
claudeflare-deploy deploy --strategy blue-green --environment production --version 1.0.0

# Canary deployment
claudeflare-deploy deploy --strategy canary --environment production --version 1.0.0

# Dry run
claudeflare-deploy deploy --strategy zero-downtime --dry-run
```

### Rollback Deployment

```bash
# Immediate rollback
claudeflare-deploy rollback --deployment-id deploy-123 --target-version 0.9.0 --strategy immediate

# Gradual rollback
claudeflare-deploy rollback --deployment-id deploy-123 --target-version 0.9.0 --strategy gradual

# With verification
claudeflare-deploy rollback --deployment-id deploy-123 --verify
```

### Pipeline Execution

```bash
# Execute full pipeline
claudeflare-deploy pipeline --pipeline production

# Execute specific stage
claudeflare-deploy pipeline --pipeline production --stage deploy
```

### Status and Health

```bash
# Get deployment status
claudeflare-deploy status --deployment-id deploy-123

# Run health checks
claudeflare-deploy health --targets target-1,target-2
```

## Configuration

Create a `claudeflare.config.js` file in your project root:

```javascript
module.exports = {
  deployment: {
    id: 'my-deployment',
    strategy: 'zero-downtime',
    environment: 'production',
    version: '1.0.0',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'ci-system',
  },

  targets: [
    {
      id: 'server-1',
      name: 'Production Server 1',
      url: 'https://server1.example.com',
      healthCheckUrl: 'https://server1.example.com/health',
      maxInstances: 10,
      minInstances: 2,
      currentInstances: 5,
    },
  ],

  healthChecks: [
    {
      id: 'http-health',
      name: 'HTTP Health Check',
      type: 'http',
      endpoint: '/health',
      interval: 5000,
      timeout: 30000,
      threshold: 3,
      retries: 3,
      expectedStatus: 200,
    },
  ],

  zeroDowntime: {
    batchSize: 1,
    batchInterval: 30000,
    healthCheckInterval: 5000,
    healthCheckTimeout: 30000,
    gracePeriod: 30000,
    shutdownTimeout: 60000,
    maxRetries: 3,
    rollbackOnError: true,
  },

  smokeTests: {
    enabled: true,
    parallel: false,
    timeout: 300000,
    retryCount: 2,
    tests: [
      {
        id: 'health-check',
        name: 'Health Endpoint',
        type: 'health',
        endpoint: '/health',
        method: 'GET',
        expectedStatus: 200,
        timeout: 30000,
        critical: true,
      },
      {
        id: 'api-check',
        name: 'API Endpoint',
        type: 'api',
        endpoint: '/api/v1/status',
        method: 'GET',
        expectedStatus: 200,
        timeout: 30000,
        critical: true,
      },
    ],
  },

  verification: {
    enabled: true,
    timeout: 300000,
    retryCount: 2,
    checkInterval: 5000,
    checks: [
      {
        id: 'http-verify',
        name: 'HTTP Verification',
        type: 'http',
        target: 'https://app.example.com',
        method: 'GET',
        expectedStatus: 200,
        critical: true,
      },
    ],
  },

  pipeline: {
    name: 'production-pipeline',
    description: 'Production deployment pipeline',
    stages: [
      {
        id: 'build',
        name: 'Build',
        type: 'build',
        config: {},
        dependencies: [],
        continueOnError: false,
        timeout: 600000,
      },
      {
        id: 'test',
        name: 'Test',
        type: 'test',
        config: {},
        dependencies: ['build'],
        continueOnError: false,
        timeout: 300000,
      },
      {
        id: 'deploy',
        name: 'Deploy',
        type: 'deploy',
        config: deploymentConfig,
        dependencies: ['test'],
        continueOnError: false,
        timeout: 600000,
      },
      {
        id: 'verify',
        name: 'Verify',
        type: 'verify',
        config: {},
        dependencies: ['deploy'],
        continueOnError: false,
        timeout: 300000,
      },
    ],
    triggers: [
      {
        type: 'git',
        config: {
          branch: 'main',
        },
      },
    ],
    notifications: [
      {
        type: 'slack',
        events: ['success', 'failure'],
        config: {
          webhookUrl: 'https://hooks.slack.com/services/...',
        },
      },
    ],
    rollbackPolicy: {
      autoRollback: true,
      rollbackTimeout: 300000,
      maxRetries: 3,
      backupRetention: 7,
    },
  },
};
```

## API Reference

### ZeroDowntimeDeployer

```typescript
class ZeroDowntimeDeployer {
  constructor(options: ZeroDowntimeDeploymentOptions)
  deploy(): Promise<DeploymentResult>
  abort(): void
}
```

### BlueGreenDeployer

```typescript
class BlueGreenDeployer {
  constructor(options: BlueGreenDeploymentOptions)
  deploy(): Promise<BlueGreenDeploymentResult>
  abort(): void
}
```

### CanaryDeployer

```typescript
class CanaryDeployer {
  constructor(options: CanaryDeploymentOptions)
  deploy(): Promise<CanaryDeploymentResult>
  abort(): void
  pause(): void
  resume(): void
  getStatus(): CanaryStatus
}
```

### SmokeTestRunner

```typescript
class SmokeTestRunner {
  constructor(options: SmokeTestRunnerOptions)
  runTests(targets: DeploymentTarget[]): Promise<TestResult[]>
  calculateMetrics(results: TestResult[]): TestMetrics
  abort(): void
}
```

### VerificationEngine

```typescript
class VerificationEngine {
  constructor(options: VerificationEngineOptions)
  verify(targets: DeploymentTarget[]): Promise<VerificationExecutionResult>
  abort(): void
}
```

### CDPipeline

```typescript
class CDPipeline {
  constructor(options: CDPipelineOptions)
  execute(): Promise<PipelineExecution>
  abort(): void
  getExecution(): PipelineExecution | null
}
```

## Monitoring and Metrics

The deployment system automatically collects metrics during deployment:

- **Deployment Duration**: Total time for deployment completion
- **Target Metrics**: Instances deployed, healthy, and failed per target
- **Health Check Metrics**: Total, passed, failed, and skipped health checks
- **Test Metrics**: Smoke test results and pass rates
- **Traffic Metrics**: Request counts, response times, and error rates

### Prometheus Metrics Export

```typescript
const metrics = await metricsCollector.exportPrometheus();
console.log(metrics);
```

Output:
```
deployment_info{id="deploy-123",status="success"} 1
deployment_target_deployed{deployment="deploy-123",target="server-1"} 5
deployment_target_healthy{deployment="deploy-123",target="server-1"} 5
deployment_healthcheck_total{deployment="deploy-123"} 15
deployment_healthcheck_passed{deployment="deploy-123"} 15
deployment_requests_total{deployment="deploy-123"} 1000
deployment_error_rate{deployment="deploy-123"} 0.5
```

## Best Practices

### Zero-Downtime Deployments

1. **Use small batch sizes** (1-2 instances) for minimal impact
2. **Set adequate grace periods** for connections to drain
3. **Configure comprehensive health checks** before deploying
4. **Enable rollback on error** for automatic recovery
5. **Monitor metrics** during deployment

### Blue-Green Deployments

1. **Ensure green environment is fully tested** before switching
2. **Use gradual traffic switching** for safer rollouts
3. **Keep old version** temporarily for quick rollback
4. **Run verification checks** after traffic switch
5. **Monitor both environments** during transition

### Canary Deployments

1. **Start with small percentages** (5-10%)
2. **Set realistic success criteria** based on baseline metrics
3. **Use multiple stages** for gradual rollout
4. **Enable automatic rollback** for safety
5. **Monitor custom metrics** relevant to your application

### Smoke Testing

1. **Test critical paths** first
2. **Keep tests fast** (< 30 seconds each)
3. **Use appropriate timeouts** for each test
4. **Mark critical tests** for fail-fast behavior
5. **Run tests in parallel** when possible

## Troubleshooting

### Deployment Fails

1. Check health check endpoints are accessible
2. Verify network connectivity to targets
3. Review deployment logs for errors
4. Ensure sufficient resources (CPU, memory, disk)
5. Check for configuration errors

### Rollback Required

1. Use immediate rollback for critical failures
2. Use gradual rollback for partial issues
3. Always verify after rollback
4. Investigate failure cause before redeploying
5. Keep backups of previous versions

### Health Check Failures

1. Verify health check endpoints respond correctly
2. Check expected status codes match
3. Ensure response body contains expected data
4. Increase timeout values if needed
5. Check for network issues

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Support

For issues and questions, please open an issue on GitHub or contact support@claudeflare.com.
