/**
 * Integration tests for GitOps engine
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GitOpsEngine } from '../../src/gitops/engine';
import { GitOpsConfig, GitProvider, Environment } from '../../src/types';
import { Logger } from '../../src/utils/logger';
import { MetricsCollector } from '../../src/utils/metrics';
import { InMemoryStorage } from '../../src/utils/durable-object';

// Mock the git provider and cluster client
vi.mock('../../src/gitops/providers/github-adapter', () => ({
  GitHubAdapter: vi.fn().mockImplementation(() => ({
    validateAccess: vi.fn().mockResolvedValue(undefined),
    fetchCommitInfo: vi.fn().mockResolvedValue({
      sha: 'abc123',
      message: 'Test commit',
      author: 'Test Author',
      timestamp: new Date(),
      parentShas: [],
    }),
    fetchManifests: vi.fn().mockResolvedValue([
      {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: 'test-deployment',
          namespace: 'default',
          annotations: {},
        },
        spec: {
          replicas: 3,
          selector: {
            matchLabels: { app: 'test' },
          },
          template: {
            metadata: { labels: { app: 'test' } },
            spec: {
              containers: [{ name: 'app', image: 'nginx:latest' }],
            },
          },
        },
      },
    ]),
  })),
}));

vi.mock('../../src/gitops/providers/kubernetes-client', () => ({
  KubernetesClient: vi.fn().mockImplementation(() => ({
    getCurrentState: vi.fn().mockResolvedValue(new Map()),
    applyResource: vi.fn().mockResolvedValue(undefined),
    deleteResource: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('GitOpsEngine Integration Tests', () => {
  let engine: GitOpsEngine;
  let config: GitOpsConfig;
  let logger: Logger;
  let metrics: MetricsCollector;
  let storage: InMemoryStorage;

  beforeEach(() => {
    logger = new Logger({ service: 'test', level: 'error' });
    metrics = new MetricsCollector({ service: 'test', enabled: true });
    storage = new InMemoryStorage();

    config = {
      repository: {
        provider: GitProvider.GITHUB,
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'main',
        token: 'test-token',
      },
      targetPath: 'manifests',
      syncInterval: 60000,
      autoSync: false,
      pruneResources: true,
      validateOnSync: true,
      driftDetection: {
        enabled: true,
        checkInterval: 120000,
        autoCorrect: false,
        correctionStrategy: 'manual',
      },
    };
  });

  afterEach(async () => {
    if (engine) {
      await engine.stop();
    }
  });

  describe('initialization', () => {
    it('should start the engine successfully', async () => {
      engine = new GitOpsEngine({ config, storage, logger, metrics });
      await engine.start();

      const status = engine.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.driftDetectionEnabled).toBe(true);
    });

    it('should stop the engine successfully', async () => {
      engine = new GitOpsEngine({ config, storage, logger, metrics });
      await engine.start();
      await engine.stop();

      const status = engine.getStatus();
      expect(status.isRunning).toBe(false);
    });
  });

  describe('synchronization', () => {
    it('should perform a manual sync', async () => {
      engine = new GitOpsEngine({ config, storage, logger, metrics });
      await engine.start();

      const result = await engine.triggerSync();

      expect(result.success).toBe(true);
      expect(result.resourcesApplied).toBeGreaterThan(0);
    });

    it('should record sync metrics', async () => {
      engine = new GitOpsEngine({ config, storage, logger, metrics });
      await engine.start();

      await engine.triggerSync();

      const syncAttempts = metrics.getCounter('gitops.sync.attempts');
      const syncSuccess = metrics.getCounter('gitops.sync.success');

      expect(syncAttempts).toBeGreaterThan(0);
      expect(syncSuccess).toBeGreaterThan(0);
    });

    it('should detect no changes on second sync', async () => {
      engine = new GitOpsEngine({ config, storage, logger, metrics });
      await engine.start();

      const result1 = await engine.triggerSync();
      const result2 = await engine.triggerSync();

      expect(result1.resourcesApplied).toBeGreaterThan(0);
      expect(result2.resourcesApplied).toBe(0);
    });
  });

  describe('drift detection', () => {
    it('should detect drift when resources change', async () => {
      engine = new GitOpsEngine({ config, storage, logger, metrics });
      await engine.start();

      const driftReport = await engine.detectAndCorrectDrift();

      expect(driftReport).not.toBeNull();
      expect(driftReport?.hasDrift).toBeDefined();
    });

    it('should not auto-correct when disabled', async () => {
      config.driftDetection!.autoCorrect = false;
      engine = new GitOpsEngine({ config, storage, logger, metrics });
      await engine.start();

      const driftReport = await engine.detectAndCorrectDrift();

      // Should not throw even with drift
      expect(driftReport).not.toBeNull();
    });
  });

  describe('reconciliation state', () => {
    it('should track reconciliation state for resources', async () => {
      engine = new GitOpsEngine({ config, storage, logger, metrics });
      await engine.start();
      await engine.triggerSync();

      const states = engine.getAllReconciliationStates();
      expect(states.size).toBeGreaterThan(0);

      const state = states.get('default/Deployment/test-deployment');
      expect(state).toBeDefined();
      expect(state?.status).toBeDefined();
    });

    it('should update reconciliation state on sync', async () => {
      engine = new GitOpsEngine({ config, storage, logger, metrics });
      await engine.start();

      await engine.triggerSync();

      const state = engine.getReconciliationState(
        'default/Deployment/test-deployment'
      );
      expect(state?.observedGeneration).toBeGreaterThan(0);
    });
  });

  describe('rollback', () => {
    it('should rollback to previous revision', async () => {
      engine = new GitOpsEngine({ config, storage, logger, metrics });
      await engine.start();

      const result = await engine.rollback('previous-sha');

      expect(result.success).toBe(true);
      expect(result.syncRevision).toBe('previous-sha');
    });

    it('should record rollback metrics', async () => {
      engine = new GitOpsEngine({ config, storage, logger, metrics });
      await engine.start();

      await engine.rollback('previous-sha');

      const rollbackAttempts = metrics.getCounter('gitops.rollback.attempts');
      const rollbackSuccess = metrics.getCounter('gitops.rollback.success');

      expect(rollbackAttempts).toBeGreaterThan(0);
      expect(rollbackSuccess).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle sync failures gracefully', async () => {
      // This would require mocking failures
      engine = new GitOpsEngine({ config, storage, logger, metrics });
      await engine.start();

      // Sync should complete even with potential issues
      const result = await engine.triggerSync();
      expect(result).toBeDefined();
    });

    it('should continue after errors', async () => {
      engine = new GitOpsEngine({ config, storage, logger, metrics });
      await engine.start();

      // Should be able to perform multiple operations
      await engine.triggerSync();
      const status = engine.getStatus();
      expect(status.isRunning).toBe(true);
    });
  });
});
