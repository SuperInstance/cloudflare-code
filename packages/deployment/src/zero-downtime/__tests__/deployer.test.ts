/**
 * Tests for ZeroDowntimeDeployer
 */

import {
  ZeroDowntimeDeployer,
  type ZeroDowntimeDeploymentOptions,
} from '../deployer';
import {
  DeploymentConfig,
  DeploymentTarget,
  HealthCheck,
  ZeroDowntimeConfig,
  DeploymentStrategy,
  Environment,
} from '../../types';

describe('ZeroDowntimeDeployer', () => {
  let deployer: ZeroDowntimeDeployer;
  let mockConfig: DeploymentConfig;
  let mockTargets: DeploymentTarget[];
  let mockHealthChecks: HealthCheck[];
  let mockZeroDowntimeConfig: ZeroDowntimeConfig;

  beforeEach(() => {
    // Setup mock configuration
    mockConfig = {
      id: 'test-deployment-1',
      strategy: DeploymentStrategy.ZERO_DOWNTIME,
      environment: Environment.PRODUCTION,
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'test-user',
    };

    mockTargets = [
      {
        id: 'target-1',
        name: 'Target 1',
        url: 'https://target1.example.com',
        healthCheckUrl: 'https://target1.example.com/health',
        maxInstances: 10,
        minInstances: 2,
        currentInstances: 5,
      },
      {
        id: 'target-2',
        name: 'Target 2',
        url: 'https://target2.example.com',
        healthCheckUrl: 'https://target2.example.com/health',
        maxInstances: 10,
        minInstances: 2,
        currentInstances: 5,
      },
    ];

    mockHealthChecks = [
      {
        id: 'health-check-1',
        name: 'HTTP Health Check',
        type: 'http' as any,
        endpoint: 'https://target.example.com/health',
        interval: 5000,
        timeout: 30000,
        threshold: 3,
        retries: 3,
        expectedStatus: 200,
      },
    ];

    mockZeroDowntimeConfig = {
      batchSize: 1,
      batchInterval: 10000,
      healthCheckInterval: 5000,
      healthCheckTimeout: 30000,
      gracePeriod: 30000,
      shutdownTimeout: 60000,
      maxRetries: 3,
      rollbackOnError: true,
    };

    deployer = new ZeroDowntimeDeployer({
      config: mockConfig,
      targets: mockTargets,
      healthChecks: mockHealthChecks,
      zeroDowntimeConfig: mockZeroDowntimeConfig,
    });
  });

  describe('constructor', () => {
    it('should create a new ZeroDowntimeDeployer instance', () => {
      expect(deployer).toBeInstanceOf(ZeroDowntimeDeployer);
    });

    it('should initialize with provided configuration', () => {
      // Verify deployer is properly initialized
      expect(deployer).toBeDefined();
    });
  });

  describe('deploy', () => {
    it('should execute zero-downtime deployment successfully', async () => {
      // Mock fetch for health checks
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' }),
      });

      const result = await deployer.deploy();

      expect(result.deploymentId).toBe(mockConfig.id);
      expect(result.status).toBe('success');
      expect(result.batches).toHaveLength(2); // 2 targets with batch size 1
      expect(result.metrics).toBeDefined();
    });

    it('should handle deployment failures and rollback if configured', async () => {
      // Mock fetch to fail health checks
      global.fetch = jest.fn().mockRejectedValue(
        new Error('Connection failed')
      );

      mockZeroDowntimeConfig.rollbackOnError = true;

      const result = await deployer.deploy();

      expect(result.status).toBe('failed');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should respect batch size configuration', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      mockZeroDowntimeConfig.batchSize = 2;
      deployer = new ZeroDowntimeDeployer({
        config: mockConfig,
        targets: mockTargets,
        healthChecks: mockHealthChecks,
        zeroDowntimeConfig: mockZeroDowntimeConfig,
      });

      const result = await deployer.deploy();

      expect(result.batches).toHaveLength(1); // 2 targets with batch size 2
    });

    it('should support aborting deployment', async () => {
      global.fetch = jest.fn().mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve({
          ok: true,
          status: 200,
        }), 1000))
      );

      // Start deployment and abort immediately
      const deploymentPromise = deployer.deploy();
      deployer.abort();

      const result = await deploymentPromise;

      expect(result.status).toBe('failed');
    });
  });

  describe('batch deployment', () => {
    it('should deploy targets in batches', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await deployer.deploy();

      expect(result.batches).toHaveLength(2);
      result.batches.forEach((batch) => {
        expect(batch.status).toBe('completed');
        expect(batch.targets).toBeDefined();
        expect(batch.targets.length).toBeGreaterThan(0);
      });
    });

    it('should wait for grace period after each batch', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const startTime = Date.now();
      await deployer.deploy();
      const endTime = Date.now();

      // Should take at least 2 grace periods (2 batches)
      const expectedMinTime = mockZeroDowntimeConfig.gracePeriod * 2;
      expect(endTime - startTime).toBeGreaterThanOrEqual(expectedMinTime);
    });
  });

  describe('error handling', () => {
    it('should retry failed deployments up to maxRetries', async () => {
      let attemptCount = 0;

      global.fetch = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= mockZeroDowntimeConfig.maxRetries) {
          throw new Error('Deployment failed');
        }
        return Promise.resolve({
          ok: true,
          status: 200,
        });
      });

      const result = await deployer.deploy();

      expect(result.status).toBe('success');
      expect(attemptCount).toBeGreaterThan(1);
    });

    it('should fail after exceeding maxRetries', async () => {
      global.fetch = jest.fn().mockRejectedValue(
        new Error('Deployment failed')
      );

      const result = await deployer.deploy();

      expect(result.status).toBe('failed');
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('health checks', () => {
    it('should run health checks after deployment', async () => {
      let healthCheckCalled = false;

      global.fetch = jest.fn().mockImplementation(() => {
        healthCheckCalled = true;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ status: 'healthy' }),
        });
      });

      await deployer.deploy();

      expect(healthCheckCalled).toBe(true);
    });

    it('should fail deployment if health checks fail', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });

      const result = await deployer.deploy();

      expect(result.status).toBe('failed');
    });
  });

  describe('metrics collection', () => {
    it('should collect deployment metrics', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await deployer.deploy();

      expect(result.metrics).toBeDefined();
      expect(result.metrics.deploymentId).toBe(mockConfig.id);
      expect(result.metrics.targets).toBeDefined();
      expect(result.metrics.healthChecks).toBeDefined();
    });
  });
});
