/**
 * Tests for health monitoring system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HealthMonitor, createDefaultHealthChecks, createHealthMonitor } from '../src/health/monitor';

describe('HealthMonitor', () => {
  let monitor: HealthMonitor;

  beforeEach(async () => {
    monitor = new HealthMonitor();
    await monitor.initialize();
  });

  afterEach(async () => {
    await monitor.dispose();
  });

  describe('health checks', () => {
    it('should register health checks', () => {
      monitor.registerCheck('test', {
        name: 'test',
        check: async () => ({
          status: 'healthy',
        }),
      });

      expect(monitor.getStatus('test')).toBeDefined();
    });

    it('should unregister health checks', () => {
      monitor.registerCheck('test', {
        name: 'test',
        check: async () => ({
          status: 'healthy',
        }),
      });

      monitor.unregisterCheck('test');
      expect(monitor.getStatus('test')).toBeUndefined();
    });

    it('should execute individual health checks', async () => {
      monitor.registerCheck('test', {
        name: 'test',
        check: async () => ({
          status: 'healthy',
          message: 'All good',
        }),
      });

      const result = await monitor.check('test');

      expect(result.name).toBe('test');
      expect(result.status).toBe('healthy');
      expect(result.message).toBe('All good');
    });

    it('should execute all health checks', async () => {
      monitor.registerCheck('check1', {
        name: 'check1',
        check: async () => ({ status: 'healthy' }),
      });

      monitor.registerCheck('check2', {
        name: 'check2',
        check: async () => ({ status: 'healthy' }),
      });

      const results = await monitor.checkAll();

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.status === 'healthy')).toBe(true);
    });

    it('should handle failing health checks', async () => {
      monitor.registerCheck('failing', {
        name: 'failing',
        check: async () => ({
          status: 'unhealthy',
          message: 'Failed',
        }),
      });

      const result = await monitor.check('failing');

      expect(result.status).toBe('unhealthy');
      expect(result.message).toBe('Failed');
    });

    it('should timeout health checks', async () => {
      monitor.registerCheck('slow', {
        name: 'slow',
        check: async () => {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return { status: 'healthy' };
        },
        timeout: 100,
      });

      const result = await monitor.check('slow');

      expect(result.status).toBe('unhealthy');
      expect(result.message).toContain('timeout');
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit after repeated failures', async () => {
      let attempt = 0;
      monitor.registerCheck('unreliable', {
        name: 'unreliable',
        check: async () => {
          attempt++;
          return {
            status: attempt < 5 ? 'unhealthy' : 'healthy',
          };
        },
      });

      // Trigger failures
      for (let i = 0; i < 6; i++) {
        await monitor.check('unreliable');
      }

      const state = monitor.getStatus('unreliable');
      expect(state?.circuitOpen).toBe(true);
    });

    it('should close circuit after timeout', async () => {
      const monitor = new HealthMonitor({
        circuitBreakerThreshold: 2,
        checkInterval: 100,
      });

      let attempt = 0;
      monitor.registerCheck('unreliable', {
        name: 'unreliable',
        check: async () => {
          attempt++;
          return {
            status: attempt < 3 ? 'unhealthy' : 'healthy',
          };
        },
      });

      await monitor.initialize();

      // Trigger failures
      for (let i = 0; i < 4; i++) {
        await monitor.check('unreliable');
      }

      expect(monitor.getStatus('unreliable')?.circuitOpen).toBe(true);

      // Wait for circuit to half-open
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Check should succeed now
      const result = await monitor.check('unreliable');
      expect(result.status).toBe('healthy');

      await monitor.dispose();
    });

    it('should allow manual circuit control', () => {
      monitor.registerCheck('test', {
        name: 'test',
        check: async () => ({ status: 'healthy' }),
      });

      monitor.openCircuit('test');
      expect(monitor.getStatus('test')?.circuitOpen).toBe(true);

      monitor.closeCircuit('test');
      expect(monitor.getStatus('test')?.circuitOpen).toBe(false);
    });
  });

  describe('recovery actions', () => {
    it('should execute recovery actions on failure', async () => {
      const recovery = vi.fn();
      let attempts = 0;

      monitor.registerCheck('failing', {
        name: 'failing',
        check: async () => ({
          status: 'unhealthy',
        }),
      });

      monitor.registerRecoveryAction('failing', {
        name: 'test-recovery',
        condition: (state) => state.consecutiveFailures >= 3,
        action: recovery,
      });

      // Trigger failures
      for (let i = 0; i < 4; i++) {
        await monitor.check('failing');
      }

      expect(recovery).toHaveBeenCalledTimes(1);
    });

    it('should reset consecutive failures on successful recovery', async () => {
      const recovery = vi.fn(async () => {
        // Simulate successful recovery
      });

      let attempts = 0;
      monitor.registerCheck('unreliable', {
        name: 'unreliable',
        check: async () => {
          attempts++;
          return {
            status: attempts < 3 ? 'unhealthy' : 'healthy',
          };
        },
      });

      monitor.registerRecoveryAction('unreliable', {
        name: 'test-recovery',
        condition: (state) => state.consecutiveFailures >= 2,
        action: recovery,
      });

      // Trigger failures then recovery
      for (let i = 0; i < 4; i++) {
        await monitor.check('unreliable');
      }

      const state = monitor.getStatus('unreliable');
      expect(state?.consecutiveFailures).toBe(0);
    });
  });

  describe('health statistics', () => {
    it('should track health check statistics', async () => {
      monitor.registerCheck('test', {
        name: 'test',
        check: async () => ({ status: 'healthy' }),
      });

      await monitor.check('test');
      await monitor.check('test');
      await monitor.check('test');

      const stats = monitor.getStatistics('test');
      expect(stats?.totalChecks).toBe(3);
      expect(stats?.successfulChecks).toBe(3);
      expect(stats?.failedChecks).toBe(0);
    });

    it('should calculate average response time', async () => {
      monitor.registerCheck('test', {
        name: 'test',
        check: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { status: 'healthy' };
        },
      });

      await monitor.check('test');
      await monitor.check('test');

      const stats = monitor.getStatistics('test');
      expect(stats?.averageResponseTime).toBeGreaterThan(0);
    });
  });

  describe('global health status', () => {
    it('should calculate global health status', async () => {
      monitor.registerCheck('healthy1', {
        name: 'healthy1',
        check: async () => ({ status: 'healthy' }),
      });

      monitor.registerCheck('healthy2', {
        name: 'healthy2',
        check: async () => ({ status: 'healthy' }),
      });

      await monitor.checkAll();

      const global = monitor.getGlobalStatus();
      expect(global.status).toBe('healthy');
      expect(global.checks.healthy).toBe(2);
    });

    it('should be degraded with some unhealthy checks', async () => {
      monitor.registerCheck('healthy', {
        name: 'healthy',
        check: async () => ({ status: 'healthy' }),
      });

      monitor.registerCheck('unhealthy', {
        name: 'unhealthy',
        check: async () => ({ status: 'unhealthy' }),
      });

      await monitor.checkAll();

      const global = monitor.getGlobalStatus();
      expect(global.status).toBe('degraded');
    });
  });

  describe('health reports', () => {
    it('should generate comprehensive health report', async () => {
      monitor.registerCheck('test', {
        name: 'test',
        check: async () => ({ status: 'healthy' }),
      });

      const report = await monitor.getReport();

      expect(report.timestamp).toBeDefined();
      expect(report.globalStatus).toBeDefined();
      expect(report.checks).toHaveLength(1);
      expect(report.summary.total).toBe(1);
    });
  });
});

describe('createDefaultHealthChecks', () => {
  it('should create default health checks', () => {
    const checks = createDefaultHealthChecks();

    expect(checks.memory).toBeDefined();
    expect(checks.cpu).toBeDefined();
    expect(checks.latency).toBeDefined();
    expect(checks.connections).toBeDefined();
  });
});

describe('createHealthMonitor', () => {
  it('should create health monitor with default checks', async () => {
    const monitor = createHealthMonitor();

    expect(monitor).toBeInstanceOf(HealthMonitor);

    const results = await monitor.checkAll();
    expect(results.length).toBeGreaterThan(0);

    await monitor.dispose();
  });
});
