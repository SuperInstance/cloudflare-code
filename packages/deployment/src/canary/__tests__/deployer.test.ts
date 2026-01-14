/**
 * Tests for CanaryDeployer
 */

import {
  CanaryDeployer,
  type CanaryDeploymentOptions,
} from '../deployer';
import {
  DeploymentConfig,
  DeploymentTarget,
  HealthCheck,
  CanaryConfig,
  DeploymentStrategy,
  Environment,
  CanaryStage,
} from '../../types';

describe('CanaryDeployer', () => {
  let deployer: CanaryDeployer;
  let mockConfig: DeploymentConfig;
  let mockBaselineTargets: DeploymentTarget[];
  let mockCanaryTargets: DeploymentTarget[];
  let mockHealthChecks: HealthCheck[];
  let mockCanaryConfig: CanaryConfig;

  beforeEach(() => {
    mockConfig = {
      id: 'test-canary-1',
      strategy: DeploymentStrategy.CANARY,
      environment: Environment.PRODUCTION,
      version: '2.0.0',
      previousVersion: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'test-user',
    };

    mockBaselineTargets = [
      {
        id: 'baseline-1',
        name: 'Baseline 1',
        url: 'https://baseline1.example.com',
        healthCheckUrl: 'https://baseline1.example.com/health',
        maxInstances: 10,
        minInstances: 2,
        currentInstances: 5,
      },
    ];

    mockCanaryTargets = [
      {
        id: 'canary-1',
        name: 'Canary 1',
        url: 'https://canary1.example.com',
        healthCheckUrl: 'https://canary1.example.com/health',
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

    const mockStage: CanaryStage = {
      name: 'Stage 1',
      percentage: 10,
      duration: 60000,
      minSuccessRate: 95,
      maxErrorRate: 5,
      checks: ['http-health'],
      autoPromote: true,
    };

    mockCanaryConfig = {
      stages: [mockStage],
      autoPromote: true,
      autoRollback: true,
      rollbackThreshold: 10,
      monitoringWindow: 300000,
      metricsCheckInterval: 10000,
      successCriteria: {
        minSuccessRate: 95,
        maxErrorRate: 5,
        maxResponseTime: 1000,
        minHealthScore: 80,
      },
      rollbackCriteria: {
        maxErrorRate: 10,
        minSuccessRate: 90,
        maxResponseTime: 2000,
        minHealthScore: 70,
        errorSpikeThreshold: 5,
      },
    };

    deployer = new CanaryDeployer({
      config: mockConfig,
      baselineTargets: mockBaselineTargets,
      canaryTargets: mockCanaryTargets,
      healthChecks: mockHealthChecks,
      canaryConfig: mockCanaryConfig,
    });
  });

  describe('constructor', () => {
    it('should create a new CanaryDeployer instance', () => {
      expect(deployer).toBeInstanceOf(CanaryDeployer);
    });

    it('should initialize with correct status', () => {
      const status = deployer.getStatus();
      expect(status.status).toBe('running');
      expect(status.currentStage).toBe(0);
      expect(status.totalStages).toBe(1);
    });
  });

  describe('deploy', () => {
    it('should execute canary deployment successfully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await deployer.deploy();

      expect(result.deploymentId).toBe(mockConfig.id);
      expect(result.status).toBe('success');
      expect(result.canaryStatus.status).toBe('completed');
      expect(result.currentStage).toBe(1);
    });

    it('should fail health checks and rollback', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });

      const result = await deployer.deploy();

      expect(result.status).toBe('failed');
      expect(result.rollbackPerformed).toBe(true);
    });

    it('should progress through canary stages', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      mockCanaryConfig.stages = [
        {
          name: 'Stage 1',
          percentage: 10,
          duration: 1000,
          minSuccessRate: 95,
          maxErrorRate: 5,
          checks: ['http-health'],
          autoPromote: true,
        },
        {
          name: 'Stage 2',
          percentage: 50,
          duration: 1000,
          minSuccessRate: 95,
          maxErrorRate: 5,
          checks: ['http-health'],
          autoPromote: true,
        },
        {
          name: 'Stage 3',
          percentage: 100,
          duration: 1000,
          minSuccessRate: 95,
          maxErrorRate: 5,
          checks: ['http-health'],
          autoPromote: true,
        },
      ];

      deployer = new CanaryDeployer({
        config: mockConfig,
        baselineTargets: mockBaselineTargets,
        canaryTargets: mockCanaryTargets,
        healthChecks: mockHealthChecks,
        canaryConfig: mockCanaryConfig,
      });

      const result = await deployer.deploy();

      expect(result.status).toBe('success');
      expect(result.canaryStatus.currentStage).toBe(3);
    });
  });

  describe('canary monitoring', () => {
    it('should check success criteria during deployment', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await deployer.deploy();

      expect(result.status).toBe('success');
    });

    it('should trigger rollback on rollback criteria', async () => {
      // Mock fetch to return high error rate
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });

      const result = await deployer.deploy();

      expect(result.status).toBe('failed');
      expect(result.rollbackPerformed).toBe(true);
    });
  });

  describe('pause and resume', () => {
    it('should pause canary deployment', () => {
      deployer.pause();

      const status = deployer.getStatus();
      expect(status.status).toBe('paused');
    });

    it('should resume paused canary deployment', () => {
      deployer.pause();
      deployer.resume();

      const status = deployer.getStatus();
      expect(status.status).toBe('running');
    });
  });

  describe('abort', () => {
    it('should abort canary deployment', async () => {
      global.fetch = jest.fn().mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve({
          ok: true,
          status: 200,
        }), 1000))
      );

      const deploymentPromise = deployer.deploy();
      deployer.abort();

      const result = await deploymentPromise;

      expect(result.status).toBe('failed');
    });
  });

  describe('traffic management', () => {
    it('should set traffic percentage correctly', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await deployer.deploy();

      // Verify traffic was set to 100% at the end
      const status = deployer.getStatus();
      expect(status.currentPercentage).toBe(100);
    });
  });
});
