import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreakerEngine } from '../../src/breaker/engine';
import { CircuitState, CircuitBreakerConfig, ExecutionResult } from '../../src/types';

describe('CircuitBreakerEngine', () => {
  let engine: CircuitBreakerEngine;
  let config: CircuitBreakerConfig;

  beforeEach(() => {
    config = {
      name: 'test-circuit',
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
      enablePredictiveDetection: false,
      enablePersistence: false,
    };
    engine = new CircuitBreakerEngine('test-circuit', config);
  });

  describe('State Management', () => {
    it('should start in CLOSED state', () => {
      expect(engine.getState()).toBe(CircuitState.CLOSED);
    });

    it('should transition to OPEN after failure threshold', async () => {
      // Fail 3 times to meet threshold
      for (let i = 0; i < 3; i++) {
        const failingOperation = async () => {
          throw new Error('Test failure');
        };
        try {
          await engine.execute(failingOperation);
        } catch (error) {
          // Expected
        }
      }

      expect(engine.getState()).toBe(CircuitState.OPEN);
    });

    it('should transition to HALF_OPEN after timeout', async () => {
      // Open the circuit
      engine.open();

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Execute to trigger state check
      try {
        await engine.execute(async () => 'success');
      } catch (error) {
        // Expected
      }

      expect(engine.getState()).toBe(CircuitState.HALF_OPEN);
    });

    it('should transition to CLOSED after successful recovery', async () => {
      // Open circuit
      engine.open();

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Execute successful operations
      for (let i = 0; i < 2; i++) {
        await engine.execute(async () => 'success');
      }

      expect(engine.getState()).toBe(CircuitState.CLOSED);
    });

    it('should transition back to OPEN on failure in HALF_OPEN', async () => {
      // Open circuit
      engine.open();

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Execute successful then failing operation
      await engine.execute(async () => 'success');

      try {
        await engine.execute(async () => {
          throw new Error('Recovery failed');
        });
      } catch (error) {
        // Expected
      }

      expect(engine.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Manual Control', () => {
    it('should manually open circuit', () => {
      engine.open();
      expect(engine.getState()).toBe(CircuitState.OPEN);
    });

    it('should manually close circuit', () => {
      engine.open();
      engine.close();
      expect(engine.getState()).toBe(CircuitState.CLOSED);
    });

    it('should manually isolate circuit', () => {
      engine.isolate();
      expect(engine.getState()).toBe(CircuitState.ISOLATED);
    });
  });

  describe('Execution', () => {
    it('should execute successful operation', async () => {
      const operation = async () => 'test-result';
      const result = await engine.execute(operation);

      expect(result.status).toBe(ExecutionResult.SUCCESS);
      expect(result.data).toBe('test-result');
    });

    it('should handle operation failure', async () => {
      const operation = async () => {
        throw new Error('Operation failed');
      };

      const result = await engine.execute(operation);

      expect(result.status).toBe(ExecutionResult.FAILURE);
      expect(result.error).toBeInstanceOf(Error);
    });

    it('should reject operations when circuit is open', async () => {
      engine.open();

      const operation = async () => 'result';
      const result = await engine.execute(operation);

      expect(result.status).toBe(ExecutionResult.REJECTED);
    });

    it('should handle operation timeout', async () => {
      const operation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return 'late-result';
      };

      const result = await engine.execute(operation, { timeout: 100 });

      expect(result.status).toBe(ExecutionResult.TIMEOUT);
    }, 10000);
  });

  describe('Metrics', () => {
    it('should track execution metrics', async () => {
      // Execute some operations
      for (let i = 0; i < 5; i++) {
        await engine.execute(async () => `result-${i}`);
      }

      const metrics = engine.getMetrics();

      expect(metrics.totalRequests).toBe(5);
      expect(metrics.successfulRequests).toBe(5);
      expect(metrics.failedRequests).toBe(0);
    });

    it('should calculate error rate correctly', async () => {
      // Execute mix of successful and failing operations
      for (let i = 0; i < 10; i++) {
        const operation = async () => {
          if (i % 2 === 0) throw new Error('Failure');
          return 'success';
        };

        try {
          await engine.execute(operation);
        } catch (error) {
          // Expected
        }
      }

      const metrics = engine.getMetrics();

      expect(metrics.errorRate).toBeGreaterThan(40);
      expect(metrics.errorRate).toBeLessThan(60);
    });

    it('should track duration metrics', async () => {
      await engine.execute(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'result';
      });

      const metrics = engine.getMetrics();

      expect(metrics.averageDuration).toBeGreaterThan(0);
      expect(metrics.p50Duration).toBeGreaterThan(0);
    });
  });

  describe('Event Listeners', () => {
    it('should notify state change listeners', async () => {
      const listener = vi.fn();
      engine.onStateChange(listener);

      engine.open();

      expect(listener).toHaveBeenCalled();
    });

    it('should remove listener when unsubscribe function is called', async () => {
      const listener = vi.fn();
      const unsubscribe = engine.onStateChange(listener);

      unsubscribe();
      engine.open();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Snapshot and Restore', () => {
    it('should create snapshot', () => {
      const snapshot = engine.getSnapshot();

      expect(snapshot).toHaveProperty('name');
      expect(snapshot).toHaveProperty('state');
      expect(snapshot).toHaveProperty('metrics');
      expect(snapshot).toHaveProperty('timestamp');
    });

    it('should restore from snapshot', () => {
      engine.open();

      const snapshot = engine.getSnapshot();
      const newEngine = new CircuitBreakerEngine('test-circuit', config);

      newEngine.restoreFromSnapshot(snapshot);

      expect(newEngine.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        thresholds: {
          ...config.thresholds,
          failureThreshold: 10,
        },
      };

      engine.updateConfig(newConfig);

      const currentConfig = engine.getConfig();
      expect(currentConfig.thresholds.failureThreshold).toBe(10);
    });
  });

  describe('Reset', () => {
    it('should reset circuit to initial state', async () => {
      // Execute some operations
      for (let i = 0; i < 5; i++) {
        try {
          await engine.execute(async () => {
            if (i % 2 === 0) throw new Error('Failure');
            return 'success';
          });
        } catch (error) {
          // Expected
        }
      }

      // Reset
      engine.reset();

      // Verify reset
      expect(engine.getState()).toBe(CircuitState.CLOSED);
      const metrics = engine.getMetrics();
      expect(metrics.totalRequests).toBe(0);
    });
  });

  describe('Health Check', () => {
    it('should return healthy when circuit is closed with no failures', () => {
      expect(engine.isHealthy()).toBe(true);
    });

    it('should return unhealthy when circuit is open', () => {
      engine.open();
      expect(engine.isHealthy()).toBe(false);
    });
  });

  describe('Active Executions', () => {
    it('should track active executions', async () => {
      const slowOperation = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'result';
      };

      const promise = engine.execute(slowOperation);
      expect(engine.getActiveExecutionCount()).toBe(1);

      await promise;
      expect(engine.getActiveExecutionCount()).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should provide comprehensive statistics', async () => {
      await engine.execute(async () => 'test');

      const stats = engine.getStats();

      expect(stats).toHaveProperty('name');
      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('activeExecutions');
      expect(stats).toHaveProperty('metrics');
    });
  });
});
