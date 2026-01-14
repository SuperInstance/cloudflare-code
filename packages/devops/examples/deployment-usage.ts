/**
 * Example: Using the Deployment Orchestrator for advanced deployment strategies
 */

import {
  DeploymentOrchestrator,
  DeploymentStrategy,
  Environment,
  DeploymentConfig,
  Logger,
  MetricsCollector,
} from '../src';

// Initialize logger and metrics
const logger = new Logger({ service: 'deployment-example' });
const metrics = new MetricsCollector({ service: 'deployment-example' });

// Configure deployment
const config: DeploymentConfig = {
  id: 'app-deployment-001',
  environment: Environment.PRODUCTION,
  strategy: DeploymentStrategy.CANARY,
  target: {
    type: 'kubernetes',
    provider: 'aws',
    region: 'us-east-1',
    namespace: 'production',
    service: 'web-app',
  },
  manifest: {
    version: 'v2.0.0',
    previousVersion: 'v1.9.0',
    replicas: 6,
    canaryPhases: [
      { percentage: 10, duration: 300000 }, // 10% for 5 minutes
      { percentage: 25, duration: 300000 }, // 25% for 5 minutes
      { percentage: 50, duration: 300000 }, // 50% for 5 minutes
      { percentage: 100, duration: 0 },      // 100% immediately
    ],
  },
  healthChecks: [
    {
      name: 'http-health',
      type: 'http',
      config: {
        protocol: 'https',
        host: 'app.example.com',
        path: '/health',
        expectedStatus: 200,
      },
      interval: 10000,
      timeout: 5000,
      threshold: 3,
    },
    {
      name: 'tcp-check',
      type: 'tcp',
      config: {
        host: 'app.example.com',
        port: 443,
      },
      interval: 10000,
      timeout: 3000,
      threshold: 3,
    },
  ],
  rollback: {
    enabled: true,
    automatic: true,
    onFailure: true,
    onDegraded: false,
    timeout: 600000,
    retainVersions: 5,
  },
  notifications: [
    {
      type: 'slack',
      enabled: true,
      events: ['deployment_success', 'deployment_failed', 'rollback_initiated'],
      config: {
        webhook_url: process.env.SLACK_WEBHOOK_URL,
        channel: '#deployments',
      },
    },
  ],
  timeout: 3600000, // 1 hour
};

async function main() {
  try {
    // Create orchestrator
    const orchestrator = new DeploymentOrchestrator(logger, metrics);

    console.log('Starting deployment...');
    console.log('Strategy:', config.strategy);
    console.log('Environment:', config.environment);

    // Execute deployment
    const result = await orchestrator.deploy({
      config,
      skipHealthChecks: false,
      dryRun: false,
    });

    console.log('Deployment result:', result);

    if (result.success) {
      console.log('Deployment completed successfully!');
      console.log('Duration:', result.duration, 'ms');
      console.log('Metrics:', result.metrics);
    } else {
      console.error('Deployment failed:', result.error);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
