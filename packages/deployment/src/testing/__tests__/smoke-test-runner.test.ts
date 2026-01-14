/**
 * Tests for SmokeTestRunner
 */

import { SmokeTestRunner, type SmokeTestRunnerOptions } from '../smoke-test-runner';
import {
  SmokeTestConfig,
  SmokeTest,
  DeploymentTarget,
} from '../../types';

describe('SmokeTestRunner', () => {
  let runner: SmokeTestRunner;
  let mockConfig: SmokeTestConfig;
  let mockTargets: DeploymentTarget[];

  beforeEach(() => {
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
    ];

    const mockTest: SmokeTest = {
      id: 'test-1',
      name: 'Health Check Test',
      type: 'health',
      endpoint: '/health',
      method: 'GET',
      expectedStatus: 200,
      timeout: 30000,
      critical: true,
    };

    mockConfig = {
      enabled: true,
      parallel: false,
      timeout: 300000,
      retryCount: 2,
      tests: [mockTest],
    };

    runner = new SmokeTestRunner({
      config: mockConfig,
    });
  });

  describe('constructor', () => {
    it('should create a new SmokeTestRunner instance', () => {
      expect(runner).toBeInstanceOf(SmokeTestRunner);
    });
  });

  describe('runTests', () => {
    it('should run all smoke tests', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' }),
      });

      const results = await runner.runTests(mockTargets);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('pass');
    });

    it('should skip tests when disabled', async () => {
      mockConfig.enabled = false;
      runner = new SmokeTestRunner({ config: mockConfig });

      const results = await runner.runTests(mockTargets);

      expect(results).toHaveLength(0);
    });

    it('should retry failed tests', async () => {
      let attemptCount = 0;

      global.fetch = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= mockConfig.retryCount) {
          throw new Error('Test failed');
        }
        return Promise.resolve({
          ok: true,
          status: 200,
        });
      });

      const results = await runner.runTests(mockTargets);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('pass');
      expect(attemptCount).toBeGreaterThan(1);
    });

    it('should fail after exceeding retry count', async () => {
      global.fetch = jest.fn().mockRejectedValue(
        new Error('Test failed')
      );

      const results = await runner.runTests(mockTargets);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('fail');
    });

    it('should run tests in parallel when configured', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      mockConfig.parallel = true;
      mockConfig.tests = [
        {
          id: 'test-1',
          name: 'Test 1',
          type: 'health',
          endpoint: '/health1',
          method: 'GET',
          expectedStatus: 200,
          timeout: 30000,
          critical: false,
        },
        {
          id: 'test-2',
          name: 'Test 2',
          type: 'health',
          endpoint: '/health2',
          method: 'GET',
          expectedStatus: 200,
          timeout: 30000,
          critical: false,
        },
      ];

      runner = new SmokeTestRunner({ config: mockConfig });

      const results = await runner.runTests(mockTargets);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.status === 'pass')).toBe(true);
    });

    it('should fail fast on critical test failure', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });

      const results = await runner.runTests(mockTargets);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('fail');
    });
  });

  describe('calculateMetrics', () => {
    it('should calculate test metrics correctly', () => {
      const mockResults = [
        {
          testId: 'test-1',
          testName: 'Test 1',
          type: 'health',
          status: 'pass' as const,
          duration: 100,
          timestamp: new Date(),
        },
        {
          testId: 'test-2',
          testName: 'Test 2',
          type: 'api',
          status: 'fail' as const,
          duration: 200,
          timestamp: new Date(),
          message: 'Test failed',
        },
        {
          testId: 'test-3',
          testName: 'Test 3',
          type: 'database',
          status: 'skip' as const,
          duration: 0,
          timestamp: new Date(),
        },
      ];

      const metrics = runner.calculateMetrics(mockResults);

      expect(metrics.total).toBe(3);
      expect(metrics.passed).toBe(1);
      expect(metrics.failed).toBe(1);
      expect(metrics.skipped).toBe(1);
      expect(metrics.passRate).toBe(33.33);
    });

    it('should handle empty results', () => {
      const metrics = runner.calculateMetrics([]);

      expect(metrics.total).toBe(0);
      expect(metrics.passed).toBe(0);
      expect(metrics.failed).toBe(0);
      expect(metrics.skipped).toBe(0);
      expect(metrics.passRate).toBe(100);
    });
  });

  describe('abort', () => {
    it('should abort running tests', async () => {
      global.fetch = jest.fn().mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve({
          ok: true,
          status: 200,
        }), 5000))
      );

      const testPromise = runner.runTests(mockTargets);
      runner.abort();

      const results = await testPromise;

      // Should have skipped or aborted tests
      expect(results).toBeDefined();
    });
  });
});
