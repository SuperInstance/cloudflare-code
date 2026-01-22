import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker } from '../../src/circuit-breaker';
import { CircuitState, HealthStatus, FallbackConfig, FallbackPriority } from '../../src/types';

describe('CircuitBreaker Integration Tests', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      name: 'integration-test',
      thresholds: {
        failureThreshold: 3,
        successThreshold: 2,
        timeoutMs: 1000,
        windowSize: 10,
        minRequests: 2,
        errorRateThreshold: 50,
        slowCallThreshold: 1000,
        slowCallRateThreshold: 30,
      },
      enableMetrics: true,
      enablePredictiveDetection: true,
    });
  });

  describe('Full Circuit Lifecycle', () => {
    it('should complete full cycle: closed -> open -> half-open -> closed', async () => {
      // Start closed
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      // Trigger failures to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('Test failure');
          });
        } catch (error) {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Wait for timeout and trigger half-open
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Execute to trigger state transition
      try {
        await circuitBreaker.execute(async () => 'success');
      } catch (error) {
        // Expected
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);

      // Execute successful operations to close circuit
      await circuitBreaker.execute(async () => 'success');
      await circuitBreaker.execute(async () => 'success');

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    }, 15000);
  });

  describe('Fallback Integration', () => {
    it('should use fallbacks when operations fail', async () => {
      const fallbackHandler = vi.fn(async () => 'fallback-result');

      circuitBreaker.registerFallback({
        name: 'test-fallback',
        priority: FallbackPriority.HIGH,
        handler: fallbackHandler,
        enabled: true,
      });

      // Execute failing operation
      const result = await circuitBreaker.execute(async () => {
        throw new Error('Operation failed');
      });

      expect(result).toBe('fallback-result');
      expect(fallbackHandler).toHaveBeenCalledTimes(1);
    });

    it('should chain fallbacks in priority order', async () => {
      const lowPriorityHandler = vi.fn(async () => 'low-result');
      const highPriorityHandler = vi.fn(async () => 'high-result');

      circuitBreaker.registerFallback({
        name: 'low-priority',
        priority: FallbackPriority.LOW,
        handler: lowPriorityHandler,
        enabled: true,
      });

      circuitBreaker.registerFallback({
        name: 'high-priority',
        priority: FallbackPriority.HIGH,
        handler: highPriorityHandler,
        enabled: true,
      });

      // Execute failing operation
      const result = await circuitBreaker.execute(async () => {
        throw new Error('Operation failed');
      });

      expect(result).toBe('high-result');
      expect(highPriorityHandler).toHaveBeenCalledTimes(1);
      expect(lowPriorityHandler).not.toHaveBeenCalled();
    });

    it('should fallback through chain on failure', async () => {
      const failingFallback = vi.fn(async () => {
        throw new Error('Fallback failed');
      });

      const workingFallback = vi.fn(async () => 'working-result');

      circuitBreaker.registerFallback({
        name: 'failing-fallback',
        priority: FallbackPriority.HIGH,
        handler: failingFallback,
        enabled: true,
      });

      circuitBreaker.registerFallback({
        name: 'working-fallback',
        priority: FallbackPriority.MEDIUM,
        handler: workingFallback,
        enabled: true,
      });

      const result = await circuitBreaker.execute(async () => {
        throw new Error('Operation failed');
      });

      expect(result).toBe('working-result');
      expect(failingFallback).toHaveBeenCalledTimes(1);
      expect(workingFallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event System Integration', () => {
    it('should emit events for state changes', async () => {
      const eventListener = vi.fn();

      circuitBreaker.on(eventListener);

      // Trigger state change
      circuitBreaker.open();

      expect(eventListener).toHaveBeenCalled(
        expect.objectContaining({
          type: expect.any(String),
          circuitName: 'integration-test',
        })
      );
    });

    it('should emit events for executions', async () => {
      const eventListener = vi.fn();

      circuitBreaker.on(eventListener);

      await circuitBreaker.execute(async () => 'result');

      expect(eventListener).toHaveBeenCalled();
    });

    it('should allow removing event listeners', async () => {
      const eventListener = vi.fn();

      const unsubscribe = circuitBreaker.on(eventListener);
      unsubscribe();

      circuitBreaker.open();

      expect(eventListener).not.toHaveBeenCalled();
    });
  });

  describe('Health Monitoring Integration', () => {
    it('should report healthy status for closed circuit', () => {
      expect(circuitBreaker.getHealthStatus()).toBe(HealthStatus.HEALTHY);
    });

    it('should report unhealthy status for open circuit', () => {
      circuitBreaker.open();
      expect(circuitBreaker.getHealthStatus()).toBe(HealthStatus.UNHEALTHY);
    });

    it('should report recovering status for half-open circuit', async () => {
      circuitBreaker.open();
      await new Promise((resolve) => setTimeout(resolve, 1100));

      try {
        await circuitBreaker.execute(async () => 'success');
      } catch (error) {
        // Expected
      }

      expect(circuitBreaker.getHealthStatus()).toBe(HealthStatus.RECOVERING);
    });
  });

  describe('Fault Detection Integration', () => {
    it('should detect faults before they trigger circuit opening', async () => {
      // Execute operations with increasing failure rate
      for (let i = 0; i < 20; i++) {
        try {
          await circuitBreaker.execute(async () => {
            if (Math.random() > 0.6) {
              throw new Error('Random failure');
            }
            return 'success';
          });
        } catch (error) {
          // Expected
        }
      }

      const faultDetection = circuitBreaker.detectFaults();

      expect(faultDetection.faultDetected).toBe(true);
      expect(faultDetection.issues.length).toBeGreaterThan(0);
    });

    it('should provide recommendations for detected faults', async () => {
      // Trigger high error rate
      for (let i = 0; i < 10; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('Failure');
          });
        } catch (error) {
          // Expected
        }
      }

      const faultDetection = circuitBreaker.detectFaults();

      expect(faultDetection.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Analytics Integration', () => {
    it('should track execution analytics', async () => {
      await circuitBreaker.execute(async () => 'result1');
      await circuitBreaker.execute(async () => 'result2');

      const analytics = circuitBreaker.getAnalytics();

      expect(analytics.executionStats.total).toBe(2);
      expect(analytics.executionStats.successRate).toBe(100);
    });

    it('should track error distribution', async () => {
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('Test error');
          });
        } catch (error) {
          // Expected
        }
      }

      const analytics = circuitBreaker.getAnalytics();

      expect(analytics.executionStats.errorDistribution).toBeDefined();
    });

    it('should provide comprehensive statistics', async () => {
      await circuitBreaker.execute(async () => 'result');

      const stats = circuitBreaker.getStats();

      expect(stats).toHaveProperty('circuit');
      expect(stats).toHaveProperty('health');
      expect(stats).toHaveProperty('faults');
      expect(stats).toHaveProperty('fallbacks');
      expect(stats).toHaveProperty('analytics');
    });
  });

  describe('Snapshot and Restore Integration', () => {
    it('should create and restore from snapshot', async () => {
      // Execute some operations
      await circuitBreaker.execute(async () => 'result1');
      await circuitBreaker.execute(async () => 'result2');

      // Create snapshot
      const snapshot = circuitBreaker.getSnapshot();

      // Create new circuit breaker
      const newCircuit = new CircuitBreaker({
        name: 'integration-test',
        thresholds: {
          failureThreshold: 3,
          successThreshold: 2,
          timeoutMs: 1000,
          windowSize: 10,
          minRequests: 2,
          errorRateThreshold: 50,
          slowCallThreshold: 1000,
          slowCallRateThreshold: 30,
        },
        enableMetrics: true,
      });

      // Restore from snapshot
      newCircuit.restoreFromSnapshot(snapshot);

      // Verify restored state
      expect(newCircuit.getState()).toBe(circuitBreaker.getState());
    });
  });

  describe('Manual Control Integration', () => {
    it('should allow manual circuit control', async () => {
      // Manual open
      circuitBreaker.open();
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Manual close
      circuitBreaker.close();
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      // Manual isolate
      circuitBreaker.isolate();
      expect(circuitBreaker.getState()).toBe(CircuitState.ISOLATED);
    });

    it('should respect manual override during execution', async () => {
      circuitBreaker.open();

      let rejected = false;
      try {
        await circuitBreaker.execute(async () => 'result');
      } catch (error) {
        rejected = true;
      }

      expect(rejected).toBe(true);
    });
  });

  describe('Configuration Updates Integration', () => {
    it('should update configuration dynamically', async () => {
      const originalThreshold = circuitBreaker.getMetrics().totalRequests;

      circuitBreaker.updateConfig({
        thresholds: {
          failureThreshold: 10,
          successThreshold: 3,
          timeoutMs: 2000,
          windowSize: 20,
          minRequests: 5,
          errorRateThreshold: 60,
          slowCallThreshold: 1500,
          slowCallRateThreshold: 40,
        },
      });

      // Config should be updated without throwing
      const stats = circuitBreaker.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('Reset Integration', () => {
    it('should reset all components', async () => {
      // Execute some operations
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(async () => {
            if (i % 2 === 0) throw new Error('Failure');
            return 'success';
          });
        } catch (error) {
          // Expected
        }
      }

      circuitBreaker.open();

      // Reset
      circuitBreaker.reset();

      // Verify reset
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(0);
    });
  });

  describe('Metrics Export Integration', () => {
    it('should export metrics in structured format', async () => {
      await circuitBreaker.execute(async () => 'result');

      const exported = circuitBreaker.exportMetrics();

      expect(exported).toContain('circuit');
      expect(exported).toContain('state');
      expect(exported).toContain('metrics');
      expect(exported).toContain('timestamp');

      const parsed = JSON.parse(exported);
      expect(parsed).toHaveProperty('circuit');
      expect(parsed).toHaveProperty('state');
      expect(parsed).toHaveProperty('metrics');
    });
  });

  describe('Concurrent Execution Integration', () => {
    it('should handle concurrent executions', async () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(
          circuitBreaker.execute(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return `result-${i}`;
          })
        );
      }

      const results = await Promise.all(promises);

      expect(results.length).toBe(10);
      expect(results.every((r) => typeof r === 'string')).toBe(true);
    }, 15000);
  });

  describe('Preset Configuration Integration', () => {
    it('should create circuit with critical preset', () => {
      const criticalCircuit = CircuitBreaker.createCritical('critical-service');

      expect(criticalCircuit.getState()).toBe(CircuitState.CLOSED);
      expect(criticalCircuit.getHealthStatus()).toBe(HealthStatus.HEALTHY);
    });

    it('should create circuit with lenient preset', () => {
      const lenientCircuit = CircuitBreaker.createLenient('lenient-service');

      expect(lenientCircuit.getState()).toBe(CircuitState.CLOSED);
      expect(lenientCircuit.getHealthStatus()).toBe(HealthStatus.HEALTHY);
    });
  });
});
