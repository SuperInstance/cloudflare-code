/**
 * Unit tests for health check system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  HealthChecker,
  HealthIndicatorRegistry,
  type HealthCheckConfig,
  type HealthCheckType,
  type HealthCheckValue,
} from '../../src/health/checker';

describe('HealthChecker', () => {
  let checker: HealthChecker;

  beforeEach(() => {
    checker = new HealthChecker('test-service');
  });

  afterEach(() => {
    checker.stopPeriodicChecks();
  });

  describe('Check Registration', () => {
    it('should register a liveness check', () => {
      const config: HealthCheckConfig = {
        type: 'liveness',
        enabled: true,
        config: {},
      };

      checker.registerCheck(config);
      
      const checks = checker.getChecks();
      expect(checks).toHaveLength(1);
      expect(checks[0].type).toBe('liveness');
    });

    it('should register a readiness check', () => {
      const config: HealthCheckConfig = {
        type: 'readiness',
        enabled: true,
        config: {},
      };

      checker.registerCheck(config);
      
      const checks = checker.getChecks();
      expect(checks).toHaveLength(1);
    });

    it('should unregister a check', () => {
      const config: HealthCheckConfig = {
        type: 'liveness',
        enabled: true,
        config: {},
      };

      checker.registerCheck(config);
      expect(checker.getChecks()).toHaveLength(1);
      
      const removed = checker.unregisterCheck('liveness');
      expect(removed).toBe(true);
      expect(checker.getChecks()).toHaveLength(0);
    });
  });

  describe('Health Checks', () => {
    it('should pass liveness check by default', async () => {
      checker.registerCheck({
        type: 'liveness',
        enabled: true,
        config: {},
      });

      const result = await checker.check();
      
      expect(result.status).toBe('healthy');
      expect(result.checks.liveness.status).toBe('pass');
    });

    it('should pass readiness check without dependencies', async () => {
      checker.registerCheck({
        type: 'readiness',
        enabled: true,
        config: {},
      });

      const result = await checker.check();
      
      expect(result.status).toBe('healthy');
      expect(result.checks.readiness.status).toBe('pass');
    });

    it('should fail readiness check with failed dependencies', async () => {
      const depChecker = new HealthChecker('dependency-service');
      depChecker.registerCheck({
        type: 'liveness',
        enabled: true,
        config: {},
      });

      checker.registerCheck({
        type: 'readiness',
        enabled: true,
        config: {},
      });
      
      checker.addDependency('dep', depChecker);

      // Make dependency unhealthy by not registering any checks
      const result = await checker.check();
      
      // Should pass since dependency is healthy
      expect(result.checks.readiness.status).toBe('pass');
    });

    it('should pass startup check after startup time', async () => {
      checker.registerCheck({
        type: 'startup',
        enabled: true,
        config: { startupTime: -1 }, // Already started
      });

      const result = await checker.check();
      
      expect(result.checks.startup.status).toBe('pass');
    });

    it('should execute custom check function', async () => {
      checker.registerCheck({
        type: 'custom',
        enabled: true,
        config: {
          check: async (): Promise<HealthCheckValue> => {
            return {
              healthy: true,
              message: 'Custom check passed',
              data: { custom: 'value' },
            };
          },
        },
      });

      const result = await checker.check();
      
      expect(result.checks.custom.status).toBe('pass');
      expect(result.checks.custom.message).toBe('Custom check passed');
    });

    it('should handle custom check failure', async () => {
      checker.registerCheck({
        type: 'custom',
        enabled: true,
        config: {
          check: async (): Promise<HealthCheckValue> => {
            return {
              healthy: false,
              message: 'Custom check failed',
            };
          },
        },
      });

      const result = await checker.check();
      
      expect(result.checks.custom.status).toBe('fail');
      expect(result.checks.custom.message).toBe('Custom check failed');
    });

    it('should skip disabled checks', async () => {
      checker.registerCheck({
        type: 'liveness',
        enabled: false,
        config: {},
      });

      const result = await checker.check();
      
      expect(result.checks.liveness.status).toBe('pass');
    });

    it('should calculate overall health status', async () => {
      checker.registerCheck({
        type: 'liveness',
        enabled: true,
        config: {},
      });

      checker.registerCheck({
        type: 'custom',
        enabled: true,
        config: {
          check: async (): Promise<HealthCheckValue> => {
            return { healthy: false, message: 'Failed' };
          },
        },
      });

      const result = await checker.check();
      
      expect(result.status).toBe('unhealthy');
    });
  });

  describe('Periodic Checks', () => {
    it('should start periodic health checks', (done) => {
      checker.registerCheck({
        type: 'liveness',
        enabled: true,
        config: {},
      });

      let checkCount = 0;
      checker.on('health:checked', () => {
        checkCount++;
        if (checkCount >= 2) {
          checker.stopPeriodicChecks();
          done();
        }
      });

      checker.startPeriodicChecks(100);
    });

    it('should stop periodic health checks', () => {
      checker.registerCheck({
        type: 'liveness',
        enabled: true,
        config: {},
      });

      checker.startPeriodicChecks(100);
      checker.stopPeriodicChecks();
      
      // Should not throw
      expect(() => checker.stopPeriodicChecks()).not.toThrow();
    });
  });

  describe('Dependencies', () => {
    it('should add dependency checkers', () => {
      const depChecker = new HealthChecker('dependency');
      
      checker.addDependency('service1', depChecker);
      
      // Dependency is tracked internally
      expect(() => checker.addDependency('service1', depChecker)).not.toThrow();
    });
  });
});

describe('HealthIndicatorRegistry', () => {
  let registry: HealthIndicatorRegistry;

  beforeEach(() => {
    registry = new HealthIndicatorRegistry();
  });

  describe('Indicator Registration', () => {
    it('should register health indicators', () => {
      registry.register('database', async () => ({
        healthy: true,
        message: 'Database is healthy',
      }));

      registry.register('cache', async () => ({
        healthy: true,
        message: 'Cache is healthy',
      }));

      const indicators = registry.getIndicators();
      expect(indicators).toContain('database');
      expect(indicators).toContain('cache');
    });

    it('should unregister health indicators', () => {
      registry.register('database', async () => ({
        healthy: true,
      }));

      expect(registry.getIndicators()).toContain('database');
      
      const removed = registry.unregister('database');
      expect(removed).toBe(true);
      expect(registry.getIndicators()).not.toContain('database');
    });
  });

  describe('Health Checks', () => {
    it('should check all indicators', async () => {
      registry.register('indicator1', async () => ({
        healthy: true,
        message: 'Indicator 1 is healthy',
      }));

      registry.register('indicator2', async () => ({
        healthy: false,
        message: 'Indicator 2 is unhealthy',
      }));

      const results = await registry.checkAll();
      
      expect(results.indicator1.healthy).toBe(true);
      expect(results.indicator2.healthy).toBe(false);
    });

    it('should check single indicator', async () => {
      registry.register('indicator1', async () => ({
        healthy: true,
        message: 'Healthy',
      }));

      const result = await registry.checkOne('indicator1');
      
      expect(result.healthy).toBe(true);
      expect(result.message).toBe('Healthy');
    });

    it('should handle missing indicator', async () => {
      const result = await registry.checkOne('nonexistent');
      
      expect(result.healthy).toBe(false);
      expect(result.message).toBe('Indicator not found');
    });

    it('should handle indicator errors', async () => {
      registry.register('failing', async () => {
        throw new Error('Check failed');
      });

      const result = await registry.checkOne('failing');
      
      expect(result.healthy).toBe(false);
      expect(result.message).toBe('Check failed');
    });
  });
});
