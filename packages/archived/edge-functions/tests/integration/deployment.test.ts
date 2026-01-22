/**
 * Integration tests for Deployment Manager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeploymentManager, createDeploymentManager } from '../../src/deployment/manager';
import { EdgeFunction } from '../../src/types';

describe('DeploymentManager Integration', () => {
  let manager: DeploymentManager;
  let testFunctions: EdgeFunction[];

  beforeEach(() => {
    manager = createDeploymentManager({
      autoRollback: true,
      enableHealthChecks: false, // Disable for faster tests
    });

    testFunctions = [
      {
        id: 'func1',
        name: 'Function 1',
        handler: async (input: { name: string }) => `Hello, ${input.name}!`,
        config: {},
        version: '1.0.0',
      },
      {
        id: 'func2',
        name: 'Function 2',
        handler: async (input: { num: number }) => input.num * 2,
        config: {},
        version: '1.0.0',
      },
    ];
  });

  describe('Deployment Operations', () => {
    it('should deploy functions to production', async () => {
      const result = await manager.deploy({
        functions: testFunctions,
        environment: 'production',
      });

      expect(result.status).toBe('deployed');
      expect(result.functions).toContain('func1');
      expect(result.functions).toContain('func2');
      expect(result.version).toBeDefined();
      expect(result.locations.length).toBeGreaterThan(0);
    });

    it('should deploy to staging environment', async () => {
      const result = await manager.deploy({
        functions: testFunctions[0],
        environment: 'staging',
      });

      expect(result.status).toBe('deployed');
    });

    it('should deploy with custom environment variables', async () => {
      const result = await manager.deploy({
        functions: testFunctions[0],
        environment: 'production',
        envVars: {
          API_KEY: 'test-key',
          DB_URL: 'postgres://localhost',
        },
      });

      expect(result.status).toBe('deployed');
    });
  });

  describe('Version Management', () => {
    it('should track function versions', async () => {
      await manager.deploy({
        functions: testFunctions[0],
        environment: 'production',
      });

      const versions = manager.getVersions('func1');
      expect(versions.length).toBeGreaterThan(0);
      expect(versions[0].status).toBe('active');
    });

    it('should get active version', async () => {
      await manager.deploy({
        functions: testFunctions[0],
        environment: 'production',
      });

      const active = manager.getActiveVersion('func1');
      expect(active).toBeDefined();
      expect(active?.status).toBe('active');
    });

    it('should cleanup old versions', async () => {
      // Deploy multiple times to create versions
      for (let i = 0; i < 5; i++) {
        await manager.deploy({
          functions: testFunctions[0],
          environment: 'production',
        });
      }

      await manager.cleanupOldVersions('func1', 3);

      const versions = manager.getVersions('func1');
      const activeCount = versions.filter(v => v.status === 'active').length;
      const totalCount = versions.length;

      expect(activeCount).toBe(1);
      expect(totalCount).toBeLessThanOrEqual(4);
    });
  });

  describe('Rollback', () => {
    it('should rollback to previous version', async () => {
      // Initial deployment
      await manager.deploy({
        functions: testFunctions[0],
        environment: 'production',
      });

      const activeVersion = manager.getActiveVersion('func1');

      // Deploy new version
      await manager.deploy({
        functions: testFunctions[0],
        environment: 'production',
      });

      // Rollback
      const result = await manager.rollback('func1', activeVersion?.version);

      expect(result.status).toBe('rolled-back');
      expect(result.version).toBe(activeVersion?.version);
    });

    it('should rollback to latest active if not specified', async () => {
      await manager.deploy({
        functions: testFunctions[0],
        environment: 'production',
      });

      await manager.deploy({
        functions: testFunctions[0],
        environment: 'production',
      });

      const result = await manager.rollback('func1');

      expect(result.status).toBe('rolled-back');
    });
  });

  describe('Deployment Status', () => {
    it('should get deployment status', async () => {
      const deployment = await manager.deploy({
        functions: testFunctions[0],
        environment: 'production',
      });

      const status = manager.getDeploymentStatus(deployment.deploymentId);

      expect(status).toBeDefined();
      expect(status?.status).toBe('deployed');
    });

    it('should get all deployments', async () => {
      await manager.deploy({
        functions: testFunctions[0],
        environment: 'production',
      });

      await manager.deploy({
        functions: testFunctions[1],
        environment: 'staging',
      });

      const all = manager.getAllDeployments();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Validation', () => {
    it('should validate deployment configuration', async () => {
      // Missing required env var
      const funcWithRequiredEnv: EdgeFunction = {
        id: 'func3',
        name: 'Function 3',
        handler: async () => 'test',
        config: {
          requiredEnvVars: ['MISSING_VAR'],
        },
        version: '1.0.0',
      };

      const result = await manager.deploy({
        functions: funcWithRequiredEnv,
        environment: 'production',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();
    });
  });

  describe('Rollout Strategies', () => {
    it('should deploy with canary strategy', async () => {
      const result = await manager.deploy({
        functions: testFunctions[0],
        environment: 'production',
        strategy: 'canary',
      });

      expect(result.status).toBe('deployed');
    });

    it('should deploy with gradual strategy', async () => {
      const result = await manager.deploy({
        functions: testFunctions[0],
        environment: 'production',
        strategy: 'gradual',
      });

      expect(result.status).toBe('deployed');
    });
  });
});
