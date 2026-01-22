/**
 * Deployment Example
 *
 * Demonstrates function deployment, versioning, and rollback.
 */

import {
  DeploymentManager,
  createDeploymentManager,
  createEdgeFunction,
  createDeploymentConfig,
} from '../src/index';

// ============================================================================
// Create Deployment Manager
// ============================================================================

const manager = createDeploymentManager({
  autoRollback: true,
  enableHealthChecks: true,
  healthCheck: {
    count: 3,
    interval: 5000,
    timeout: 10000,
  },
  retainedVersions: 10,
});

// ============================================================================
// Define Functions
// ============================================================================

const version1Function = createEdgeFunction(
  'api-handler',
  'API Handler',
  async (input: { action: string }) => {
    return {
      version: 1,
      action: input.action,
      result: `Handled by v1: ${input.action}`,
    };
  },
  {
    timeout: 5000,
    cache: {
      enabled: true,
      ttl: 300,
    },
  }
);

const version2Function = createEdgeFunction(
  'api-handler',
  'API Handler',
  async (input: { action: string }) => {
    return {
      version: 2,
      action: input.action,
      result: `Handled by v2: ${input.action}`,
      enhanced: true,
    };
  },
  {
    timeout: 5000,
    cache: {
      enabled: true,
      ttl: 300,
    },
  }
);

// ============================================================================
// Deployment Examples
// ============================================================================

async function deploymentExample() {
  console.log('=== Deployment Example ===\n');

  // Example 1: Initial deployment
  console.log('1. Initial deployment to development');
  const devDeployment = await manager.deploy({
    functions: version1Function,
    environment: 'development',
    envVars: {
      API_KEY: 'dev-key',
      DB_URL: 'postgres://dev-db',
    },
  });

  console.log('Deployment ID:', devDeployment.deploymentId);
  console.log('Status:', devDeployment.status);
  console.log('Version:', devDeployment.version);
  console.log('Locations:', devDeployment.locations.length);
  console.log();

  // Example 2: Deploy to staging
  console.log('2. Deploy to staging');
  const stagingDeployment = await manager.deploy({
    functions: version1Function,
    environment: 'staging',
    strategy: 'canary',
  });

  console.log('Status:', stagingDeployment.status);
  console.log();

  // Example 3: Deploy to production
  console.log('3. Deploy to production');
  const prodDeployment = await manager.deploy({
    functions: version1Function,
    environment: 'production',
    strategy: 'gradual',
  });

  console.log('Status:', prodDeployment.status);
  console.log();

  // Example 4: Deploy new version
  console.log('4. Deploy v2 to production');
  const v2Deployment = await manager.deploy({
    functions: version2Function,
    environment: 'production',
    metadata: {
      changelog: 'Added enhanced output field',
    },
  });

  console.log('New version:', v2Deployment.version);
  console.log('Status:', v2Deployment.status);
  console.log();

  // Example 5: Check versions
  console.log('5. Version history');
  const versions = manager.getVersions('api-handler');
  versions.forEach((v, i) => {
    console.log(`  Version ${i + 1}: ${v.version} (${v.status})`);
  });
  console.log();

  // Example 6: Rollback
  console.log('6. Rollback to v1');
  const activeVersion = manager.getActiveVersion('api-handler');
  console.log('Current active version:', activeVersion?.version);

  // Simulate rollback by getting previous version
  const previousVersion = versions.find(v => v.status === 'deprecated');
  if (previousVersion) {
    const rollback = await manager.rollback('api-handler', previousVersion.version);
    console.log('Rollback status:', rollback.status);
    console.log('Rolled back to:', rollback.version);
  }
  console.log();

  // Example 7: Cleanup old versions
  console.log('7. Cleanup old versions (keep 2)');
  await manager.cleanupOldVersions('api-handler', 2);

  const remainingVersions = manager.getVersions('api-handler');
  console.log('Remaining versions:', remainingVersions.length);
  console.log();

  // Example 8: Get deployment status
  console.log('8. Deployment status');
  const status = manager.getDeploymentStatus(v2Deployment.deploymentId);
  console.log('Deployment status:', status?.status);
  console.log('Functions deployed:', status?.functions);
  console.log('Locations:', status?.locations.length);
}

// ============================================================================
// Blue-Green Deployment Example
// ============================================================================

async function blueGreenDeploymentExample() {
  console.log('\n=== Blue-Green Deployment Example ===\n');

  // Deploy blue version
  console.log('1. Deploy blue version');
  const blue = await manager.deploy({
    functions: version1Function,
    environment: 'production',
    strategy: 'blue-green',
  });

  console.log('Blue deployment:', blue.status);
  console.log('Blue version:', blue.version);

  // Deploy green version
  console.log('\n2. Deploy green version');
  const green = await manager.deploy({
    functions: version2Function,
    environment: 'production',
    strategy: 'blue-green',
  });

  console.log('Green deployment:', green.status);
  console.log('Green version:', green.version);
  console.log();

  console.log('Switching traffic to green...');
  console.log('Blue-green deployment complete!');
}

// ============================================================================
// Canary Deployment Example
// ============================================================================

async function canaryDeploymentExample() {
  console.log('\n=== Canary Deployment Example ===\n');

  console.log('1. Initial deployment (100% traffic)');
  const initial = await manager.deploy({
    functions: version1Function,
    environment: 'production',
  });

  console.log('Initial version:', initial.version);

  console.log('\n2. Canary deployment (10% traffic to new version)');
  const canary = await manager.deploy({
    functions: version2Function,
    environment: 'production',
    strategy: 'canary',
  });

  console.log('Canary version:', canary.version);
  console.log('Canary status:', canary.status);
  console.log();

  console.log('Monitoring canary deployment...');
  console.log('If successful, gradually increase traffic:');
  console.log('  - 10% -> 25% -> 50% -> 100%');
}

// ============================================================================
// Run Examples
// ============================================================================

async function runAllExamples() {
  try {
    await deploymentExample();
    await blueGreenDeploymentExample();
    await canaryDeploymentExample();
  } catch (error) {
    console.error('Error:', error);
  }
}

runAllExamples().catch(console.error);
