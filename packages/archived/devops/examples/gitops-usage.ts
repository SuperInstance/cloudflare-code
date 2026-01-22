/**
 * Example: Using the GitOps Engine for declarative infrastructure management
 */

import {
  GitOpsEngine,
  GitProvider,
  Environment,
  GitOpsConfig,
  Logger,
  MetricsCollector,
  InMemoryStorage,
} from '../src';

// Initialize logger and metrics
const logger = new Logger({ service: 'gitops-example' });
const metrics = new MetricsCollector({ service: 'gitops-example' });
const storage = new InMemoryStorage();

// Configure GitOps
const config: GitOpsConfig = {
  repository: {
    provider: GitProvider.GITHUB,
    owner: 'my-org',
    repo: 'infrastructure',
    branch: 'main',
    token: process.env.GITHUB_TOKEN || '',
  },
  targetPath: 'k8s/manifests',
  syncInterval: 60000, // Sync every minute
  autoSync: true,
  pruneResources: true,
  validateOnSync: true,
  driftDetection: {
    enabled: true,
    checkInterval: 300000, // Check every 5 minutes
    autoCorrect: false,
    correctionStrategy: 'manual',
  },
};

async function main() {
  try {
    // Create and start GitOps engine
    const engine = new GitOpsEngine({ config, storage, logger, metrics });
    await engine.start();

    console.log('GitOps engine started successfully');
    console.log('Status:', engine.getStatus());

    // Perform manual sync
    const syncResult = await engine.triggerSync();
    console.log('Sync result:', syncResult);

    // Monitor drift
    setInterval(async () => {
      const driftReport = await engine.detectAndCorrectDrift();
      if (driftReport?.hasDrift) {
        console.log('Drift detected:', driftReport);
      }
    }, 300000);

    // Keep running
    process.on('SIGINT', async () => {
      console.log('Stopping GitOps engine...');
      await engine.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
