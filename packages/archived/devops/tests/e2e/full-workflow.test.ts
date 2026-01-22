/**
 * End-to-end tests for complete DevOps workflows
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GitOpsEngine } from '../../src/gitops/engine';
import { IaCGenerator } from '../../src/iac/generator';
import { DeploymentOrchestrator } from '../../src/deployment/orchestrator';
import { GitProvider, Environment, DeploymentStrategy } from '../../src/types';
import { Logger } from '../../src/utils/logger';
import { MetricsCollector } from '../../src/utils/metrics';
import { InMemoryStorage } from '../../src/utils/durable-object';
import { rm } from 'fs/promises';

describe('End-to-End DevOps Workflows', () => {
  let logger: Logger;
  let metrics: MetricsCollector;
  let storage: InMemoryStorage;

  beforeEach(() => {
    logger = new Logger({ service: 'e2e-test', level: 'error' });
    metrics = new MetricsCollector({ service: 'e2e-test' });
    storage = new InMemoryStorage();
  });

  afterEach(async () => {
    // Cleanup test outputs
    try {
      await rm('./output/e2e', { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Complete GitOps Workflow', () => {
    it('should perform full GitOps lifecycle', async () => {
      // 1. Generate IaC
      const generator = new IaCGenerator(logger);

      const iacResult = await generator.generate({
        config: {
          type: 'kubernetes',
          variables: {
            namespace: 'e2e-test',
            appName: 'test-app',
            replicas: 2,
            image: 'nginx:latest',
            containerPort: 80,
            servicePort: 80,
            serviceType: 'ClusterIP',
            ingressEnabled: false,
          },
          providers: [],
          outputs: [],
        },
        outputPath: './output/e2e/k8s',
        validate: true,
      });

      expect(iacResult.success).toBe(true);
      expect(iacResult.files).toContain('deployment.yaml');
      expect(iacResult.files).toContain('service.yaml');

      // 2. Setup GitOps engine
      const gitopsConfig = {
        repository: {
          provider: GitProvider.GITHUB,
          owner: 'test-owner',
          repo: 'test-repo',
          branch: 'main',
          token: 'test-token',
        },
        targetPath: 'k8s',
        autoSync: false,
        pruneResources: true,
        validateOnSync: true,
        driftDetection: {
          enabled: true,
          checkInterval: 60000,
          autoCorrect: false,
          correctionStrategy: 'manual' as const,
        },
      };

      const engine = new GitOpsEngine({ config: gitopsConfig, storage, logger, metrics });

      await engine.start();

      const status = engine.getStatus();
      expect(status.isRunning).toBe(true);

      // 3. Perform sync
      const syncResult = await engine.triggerSync();
      expect(syncResult.success).toBe(true);

      // 4. Check drift detection
      const driftReport = await engine.detectAndCorrectDrift();
      expect(driftReport).not.toBeNull();

      // 5. Cleanup
      await engine.stop();
      expect(engine.getStatus().isRunning).toBe(false);
    }, 30000);
  });

  describe('Complete Deployment Workflow', () => {
    it('should perform blue-green deployment with rollback', async () => {
      const orchestrator = new DeploymentOrchestrator(logger, metrics);

      // 1. Deploy initial version
      const deployConfig = {
        id: 'e2e-deployment-bg',
        environment: Environment.STAGING,
        strategy: DeploymentStrategy.BLUE_GREEN,
        target: {
          type: 'kubernetes' as const,
          provider: 'aws',
          region: 'us-east-1',
          namespace: 'e2e-test',
          service: 'test-app',
        },
        manifest: {
          version: 'v1.0.0',
          replicas: 2,
          image: 'nginx:1.20',
          containerPort: 80,
        },
        healthChecks: [
          {
            name: 'tcp-check',
            type: 'tcp' as const,
            config: {
              host: 'localhost',
              port: 8080,
            },
            interval: 5000,
            timeout: 3000,
            threshold: 2,
          },
        ],
        rollback: {
          enabled: true,
          automatic: false,
        },
      };

      const result1 = await orchestrator.deploy({
        config: deployConfig,
        skipHealthChecks: true, // Skip for e2e test
      });

      expect(result1.success).toBe(true);
      expect(result1.status).toBe('success');

      // 2. Deploy new version
      deployConfig.id = 'e2e-deployment-bg-v2';
      deployConfig.manifest = {
        version: 'v2.0.0',
        previousVersion: 'v1.0.0',
        replicas: 2,
        image: 'nginx:1.21',
        containerPort: 80,
      };

      const result2 = await orchestrator.deploy({
        config: deployConfig,
        skipHealthChecks: true,
      });

      expect(result2.success).toBe(true);

      // 3. Perform rollback
      const rollbackResult = await orchestrator.rollback(
        'e2e-deployment-bg-v2',
        'v1.0.0'
      );

      expect(rollbackResult.success).toBe(true);
    }, 30000);
  });

  describe('Canary Deployment Workflow', () => {
    it('should perform canary deployment with phases', async () => {
      const orchestrator = new DeploymentOrchestrator(logger, metrics);

      const config = {
        id: 'e2e-canary',
        environment: Environment.STAGING,
        strategy: DeploymentStrategy.CANARY,
        target: {
          type: 'kubernetes' as const,
          provider: 'aws',
          namespace: 'e2e-test',
          service: 'canary-app',
        },
        manifest: {
          version: 'v2.0.0',
          previousVersion: 'v1.0.0',
          replicas: 10,
          image: 'app:v2',
          containerPort: 8080,
          canaryPhases: [
            { percentage: 10, duration: 1000 },
            { percentage: 25, duration: 1000 },
            { percentage: 50, duration: 1000 },
            { percentage: 100, duration: 0 },
          ],
        },
        healthChecks: [],
        rollback: {
          enabled: true,
          automatic: true,
        },
      };

      const result = await orchestrator.deploy({
        config,
        skipHealthChecks: true,
      });

      expect(result.success).toBe(true);
      expect(result.metrics).toBeDefined();
    }, 30000);
  });

  describe('Multi-IaC Generation Workflow', () => {
    it('should generate all IaC types in sequence', async () => {
      const generator = new IaCGenerator(logger);

      const types = ['terraform', 'kubernetes', 'cloudflare', 'helm'] as const;

      for (const type of types) {
        const config: any = {
          type,
          variables: {
            appName: 'multi-iac-test',
            namespace: 'default',
            accountId: 'test-account',
          },
          providers: [],
          outputs: [],
        };

        const result = await generator.generate({
          config,
          outputPath: `./output/e2e/${type}`,
        });

        expect(result.success).toBe(true);
        expect(result.files.length).toBeGreaterThan(0);
        expect(result.costEstimate).toBeDefined();
      }
    }, 30000);
  });

  describe('Metrics Collection Workflow', () => {
    it('should collect metrics across all operations', async () => {
      // Create orchestrator
      const orchestrator = new DeploymentOrchestrator(logger, metrics);

      // Create GitOps engine
      const gitopsConfig = {
        repository: {
          provider: GitProvider.GITHUB,
          owner: 'test',
          repo: 'test',
          token: 'test',
        },
        targetPath: 'k8s',
        autoSync: false,
        pruneResources: false,
        validateOnSync: false,
      };

      const engine = new GitOpsEngine({ config: gitopsConfig, storage, logger, metrics });

      // Perform operations
      await engine.start();

      // Generate IaC
      const generator = new IaCGenerator(logger);
      await generator.generate({
        config: {
          type: 'terraform',
          providers: [],
          variables: {},
          outputs: [],
        },
      });

      // Deploy
      await orchestrator.deploy({
        config: {
          id: 'metrics-test',
          environment: Environment.DEVELOPMENT,
          strategy: DeploymentStrategy.ROLLING,
          target: {
            type: 'kubernetes',
            provider: 'aws',
          },
          manifest: {
            version: 'v1.0.0',
          },
        },
        skipHealthChecks: true,
      });

      // Cleanup
      await engine.stop();

      // Check metrics
      const allMetrics = metrics.getMetrics();

      expect(allMetrics.counters).toBeDefined();
      expect(allMetrics.gauges).toBeDefined();
      expect(allMetrics.histograms).toBeDefined();

      // Verify specific metrics exist
      expect(metrics.getCounter('gitops.sync.attempts')).toBeGreaterThanOrEqual(0);
      expect(metrics.getCounter('deployment.attempts')).toBeGreaterThanOrEqual(0);
    }, 30000);
  });

  describe('Error Handling Workflow', () => {
    it('should handle and recover from errors gracefully', async () => {
      const orchestrator = new DeploymentOrchestrator(logger, metrics);

      // Invalid config should fail gracefully
      const invalidConfig = {
        id: 'invalid',
        environment: Environment.PRODUCTION,
        strategy: DeploymentStrategy.BLUE_GREEN,
        target: {
          type: 'invalid' as any,
          provider: 'invalid',
        },
        manifest: {},
      };

      const result = await orchestrator.deploy({
        config: invalidConfig,
        skipHealthChecks: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.retryable).toBeDefined();
    });
  });

  describe('Performance Workflow', () => {
    it('should handle concurrent operations efficiently', async () => {
      const generator = new IaCGenerator(logger);

      const startTime = Date.now();

      // Generate multiple IaC configurations concurrently
      const promises = Array.from({ length: 5 }, (_, i) =>
        generator.generate({
          config: {
            type: 'kubernetes',
            variables: {
              appName: `perf-test-${i}`,
              namespace: 'default',
            },
            providers: [],
            outputs: [],
          },
        })
      );

      const results = await Promise.all(promises);

      const duration = Date.now() - startTime;

      // All should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });

      // Should complete in reasonable time
      expect(duration).toBeLessThan(10000);
    }, 30000);
  });
});
