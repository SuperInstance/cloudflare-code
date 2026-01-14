/**
 * ClaudeFlare Deployment System - Usage Examples
 *
 * This file demonstrates how to use the deployment system
 * for various deployment scenarios.
 */

import {
  ClaudeFlareDeployer,
  deploy,
  rollback,
  verify,
} from './index.js';
import {
  DEFAULT_DURABLE_OBJECTS,
  DEFAULT_STORAGE_CONFIGS,
  DEFAULT_SECRETS,
} from './index.js';
import type {
  DeploymentConfig,
  WorkerDeploymentOptions,
  DurableObjectConfig,
  KVNamespaceConfig,
  R2BucketConfig,
  D1DatabaseConfig,
  SecretConfig,
} from './types.js';

// ============================================================================
// Example 1: Quick Deploy to Production
// ============================================================================

async function example1_quickDeploy() {
  console.log('Example 1: Quick Deploy to Production\n');

  await deploy('production', {
    zeroDowntime: true,
    verbose: true,
  });

  console.log('\n✅ Deployment completed!');
}

// ============================================================================
// Example 2: Deploy to Staging
// ============================================================================

async function example2_stagingDeploy() {
  console.log('Example 2: Deploy to Staging\n');

  const deployer = new ClaudeFlareDeployer({
    environment: 'staging',
    zeroDowntime: false,
    skipTests: false,
    skipVerification: false,
    verbose: true,
  });

  await deployer.deploy({
    worker: {
      name: 'claudeflare-staging',
      scriptPath: 'dist/worker.js',
      compatibilityDate: '2024-01-01',
      compatibilityFlags: ['nodejs_compat'],
      bindings: [],
      limits: {
        cpuMs: 50,
        memory: 128,
        maxRequestsPerSecond: 100,
      },
      routes: [],
      cronTriggers: [],
    },
  });

  console.log('\n✅ Staging deployment completed!');
}

// ============================================================================
// Example 3: Zero-Downtime Production Deploy
// ============================================================================

async function example3_zeroDowntimeDeploy() {
  console.log('Example 3: Zero-Downtime Production Deploy\n');

  const deployer = new ClaudeFlareDeployer({
    environment: 'production',
    zeroDowntime: true,
    rolloutPercentage: 10,
    healthCheckTimeout: 30000,
    maxRetries: 3,
    verbose: true,
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
      routes: [],
      cronTriggers: [],
    },
    durableObjects: DEFAULT_DURABLE_OBJECTS,
    storage: DEFAULT_STORAGE_CONFIGS,
    secrets: DEFAULT_SECRETS,
  });

  console.log('\n✅ Zero-downtime deployment completed!');
}

// ============================================================================
// Example 4: Deploy with Custom Configuration
// ============================================================================

async function example4_customDeploy() {
  console.log('Example 4: Deploy with Custom Configuration\n');

  const customDurableObjects: DurableObjectConfig[] = [
    {
      name: 'CUSTOM_AGENT_ORCHESTRATOR',
      className: 'AgentOrchestrator',
      scriptPath: 'src/durable-objects/agent-orchestrator.ts',
      bindings: [],
      locations: ['wnam', 'enam', 'weur'],
    },
  ];

  const customStorage = {
    kv: [
      {
        binding: 'CUSTOM_CACHE_KV',
        title: 'custom-cache',
      },
    ] as KVNamespaceConfig[],
    r2: [
      {
        name: 'custom-storage-bucket',
        binding: 'CUSTOM_STORAGE',
        versioning: true,
        lifecycleRules: [
          {
            id: 'delete-old-files',
            prefix: 'temp/',
            expirationDays: 7,
          },
        ],
      },
    ] as R2BucketConfig[],
    d1: [
      {
        name: 'custom-database',
        binding: 'CUSTOM_DB',
        migrationsPath: 'migrations/custom',
      },
    ] as D1DatabaseConfig[],
  };

  const customSecrets: SecretConfig[] = [
    {
      name: 'CUSTOM_API_KEY',
      value: process.env.CUSTOM_API_KEY || '',
      environment: 'production',
      required: true,
      encrypted: true,
    },
  ];

  const deployer = new ClaudeFlareDeployer({
    environment: 'production',
    zeroDowntime: true,
    verbose: true,
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
      routes: [],
      cronTriggers: [],
    },
    durableObjects: customDurableObjects,
    storage: customStorage,
    secrets: customSecrets,
  });

  console.log('\n✅ Custom deployment completed!');
}

// ============================================================================
// Example 5: Deploy to Specific Regions
// ============================================================================

async function example5_regionalDeploy() {
  console.log('Example 5: Deploy to Specific Regions\n');

  const deployer = new ClaudeFlareDeployer({
    environment: 'production',
    zeroDowntime: true,
    regions: ['weur', 'enam'], // Deploy to Europe and North America East only
    verbose: true,
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
      routes: [],
      cronTriggers: [],
    },
  });

  console.log('\n✅ Regional deployment completed!');
}

// ============================================================================
// Example 6: Deploy with Dry Run
// ============================================================================

async function example6_dryRunDeploy() {
  console.log('Example 6: Deploy with Dry Run\n');

  const deployer = new ClaudeFlareDeployer({
    environment: 'production',
    zeroDowntime: true,
    dryRun: true, // Dry run mode - no actual deployment
    verbose: true,
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
      routes: [],
      cronTriggers: [],
    },
  });

  console.log('\n✅ Dry run completed!');
}

// ============================================================================
// Example 7: Rollback Deployment
// ============================================================================

async function example7_rollback() {
  console.log('Example 7: Rollback Deployment\n');

  await rollback('production', {
    strategy: 'immediate',
    targetVersion: 'v1234567890-abc123',
    backupData: true,
    verifyAfterRollback: true,
    maxRollbackTime: 300000,
  });

  console.log('\n✅ Rollback completed!');
}

// ============================================================================
// Example 8: Gradual Rollback
// ============================================================================

async function example8_gradualRollback() {
  console.log('Example 8: Gradual Rollback\n');

  const deployer = new ClaudeFlareDeployer({
    environment: 'production',
  });

  await deployer.rollback({
    strategy: 'gradual',
    targetVersion: 'v1234567890-abc123',
    backupData: true,
    verifyAfterRollback: true,
    maxRollbackTime: 600000,
  });

  console.log('\n✅ Gradual rollback completed!');
}

// ============================================================================
// Example 9: Verify Deployment
// ============================================================================

async function example9_verify() {
  console.log('Example 9: Verify Deployment\n');

  await verify('production');

  console.log('\n✅ Verification completed!');
}

// ============================================================================
// Example 10: Deploy with Monitoring
// ============================================================================

async function example10_deployWithMonitoring() {
  console.log('Example 10: Deploy with Monitoring\n');

  const deployer = new ClaudeFlareDeployer({
    environment: 'production',
    zeroDowntime: true,
    verbose: true,
  });

  // Deploy
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
      routes: [],
      cronTriggers: [],
    },
  });

  // Get deployment events
  const events = deployer.getEvents();
  console.log(`\n📊 Deployment Events: ${events.length}`);

  // Get deployment metrics
  const metrics = deployer.getMetrics();
  console.log(`⏱️  Deployment Duration: ${metrics.duration}ms`);
  console.log(`✅ Deployed Resources: ${metrics.deployedResources}`);
  console.log(`❌ Failed Resources: ${metrics.failedResources}`);

  console.log('\n✅ Deployment with monitoring completed!');
}

// ============================================================================
// Example 11: Deploy to Development
// ============================================================================

async function example11_developmentDeploy() {
  console.log('Example 11: Deploy to Development\n');

  const deployer = new ClaudeFlareDeployer({
    environment: 'development',
    zeroDowntime: false,
    skipTests: false,
    skipVerification: false,
    verbose: true,
  });

  await deployer.deploy({
    worker: {
      name: 'claudeflare-dev',
      scriptPath: 'dist/worker.js',
      compatibilityDate: '2024-01-01',
      compatibilityFlags: ['nodejs_compat'],
      bindings: [],
      limits: {
        cpuMs: 50,
        memory: 128,
        maxRequestsPerSecond: 100,
      },
      routes: [],
      cronTriggers: [],
    },
  });

  console.log('\n✅ Development deployment completed!');
}

// ============================================================================
// Example 12: Deploy Worker Only
// ============================================================================

async function example12_workerOnlyDeploy() {
  console.log('Example 12: Deploy Worker Only\n');

  const { createWorkerDeployer } = await import('./worker.js');

  const deployer = createWorkerDeployer(
    {
      environment: 'production',
      zeroDowntime: true,
      verbose: true,
    } as DeploymentConfig,
    {
      config: {} as DeploymentConfig,
      manifest: {
        version: '',
        timestamp: new Date(),
        environment: 'production',
        deployments: [],
        checksums: new Map(),
      },
      metrics: {
        startTime: new Date(),
        totalResources: 0,
        deployedResources: 0,
        failedResources: 0,
        regions: ['wnam', 'enam', 'weur', 'apac'],
        healthChecks: [],
        errorRate: 0,
        avgLatency: 0,
      },
      events: [],
      logger: {
        info: (msg) => console.log(msg),
        warn: (msg) => console.warn(msg),
        error: (msg) => console.error(msg),
        debug: (msg) => console.debug(msg),
        success: (msg) => console.log(msg),
      },
    }
  );

  await deployer.deploy({
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
    routes: [],
    cronTriggers: [],
  });

  console.log('\n✅ Worker deployment completed!');
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  const examples = [
    { name: 'Quick Deploy', fn: example1_quickDeploy },
    { name: 'Staging Deploy', fn: example2_stagingDeploy },
    { name: 'Zero-Downtime Deploy', fn: example3_zeroDowntimeDeploy },
    { name: 'Custom Deploy', fn: example4_customDeploy },
    { name: 'Regional Deploy', fn: example5_regionalDeploy },
    { name: 'Dry Run Deploy', fn: example6_dryRunDeploy },
    { name: 'Rollback', fn: example7_rollback },
    { name: 'Gradual Rollback', fn: example8_gradualRollback },
    { name: 'Verify Deployment', fn: example9_verify },
    { name: 'Deploy with Monitoring', fn: example10_deployWithMonitoring },
    { name: 'Development Deploy', fn: example11_developmentDeploy },
    { name: 'Worker Only Deploy', fn: example12_workerOnlyDeploy },
  ];

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     ClaudeFlare Deployment System - Usage Examples       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const exampleNumber = parseInt(process.argv[2]) || 0;

  if (exampleNumber > 0 && exampleNumber <= examples.length) {
    const example = examples[exampleNumber - 1];
    console.log(`Running Example ${exampleNumber}: ${example.name}\n`);
    await example.fn();
  } else {
    console.log('Usage: npm run examples <number>\n');
    console.log('Available Examples:\n');
    examples.forEach((example, index) => {
      console.log(`  ${index + 1}. ${example.name}`);
    });
    console.log('\nExample: npm run examples 1');
  }
}

// Run examples if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  example1_quickDeploy,
  example2_stagingDeploy,
  example3_zeroDowntimeDeploy,
  example4_customDeploy,
  example5_regionalDeploy,
  example6_dryRunDeploy,
  example7_rollback,
  example8_gradualRollback,
  example9_verify,
  example10_deployWithMonitoring,
  example11_developmentDeploy,
  example12_workerOnlyDeploy,
};
