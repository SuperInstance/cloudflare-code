/**
 * Circuit Breaker Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CircuitBreaker,
  createCircuitBreaker,
  CircuitBreakerRegistry,
  createCircuitBreakerRegistry,
} from '../../src/circuit';
import type { CircuitBreakerConfig, CircuitState } from '../../src/types';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = createCircuitBreaker('test-service', {
      enabled: true,
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
      halfOpenMaxCalls: 2,
    });
  });

  describe('State transitions', () => {
    it('should start in closed state', () => {
      const state = circuitBreaker.getState();

      expect(state).toBe('closed');
    });

    it('should open after failure threshold', async () => {
      const failingFn = async () => {
        throw new Error('Service error');
      };

      // Trigger failures
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFn);
        } catch (error) {
          // Expected to fail
        }
      }

      const state = circuitBreaker.getState();
      expect(state).toBe('open');
    });

    it('should transition to half-open after timeout', async () => {
      const failingFn = async () => {
        throw new Error('Service error');
      };

      // Open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFn);
        } catch (error) {
          // Expected to fail
        }
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      const state = circuitBreaker.getState();
      expect(state).toBe('half_open');
    });

    it('should close after successful recovery', async () => {
      const failingFn = async () => {
        throw new Error('Service error');
      };

      const successFn = async () => {
        return 'success';
      };

      // Open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFn);
        } catch (error) {
          // Expected to fail
        }
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Execute successful calls
      await circuitBreaker.execute(successFn);
      await circuitBreaker.execute(successFn);

      const state = circuitBreaker.getState();
      expect(state).toBe('closed');
    });
  });

  describe('Execution', () => {
    it('should execute function when closed', async () => {
      const fn = async () => {
        return 'result';
      };

      const result = await circuitBreaker.execute(fn);

      expect(result).toBe('result');
    });

    it('should reject execution when open', async () => {
      const failingFn = async () => {
        throw new Error('Service error');
      };

      // Open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFn);
        } catch (error) {
          // Expected to fail
        }
      }

      // Try to execute when open
      const testFn = async () => {
        return 'should not execute';
      };

      await expect(circuitBreaker.execute(testFn)).rejects.toThrow();
    });

    it('should use fallback when provided', async () => {
      const failingFn = async () => {
        throw new Error('Service error');
      };

      // Open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFn);
        } catch (error) {
          // Expected to fail
        }
      }

      const fallback = {
        enabled: true,
        status: 200,
        body: { fallback: true },
      };

      const result = await circuitBreaker.execute(
        async () => 'should not execute',
        undefined,
        undefined,
        fallback
      );

      expect(result).toEqual(fallback);
    });
  });

  describe('Statistics', () => {
    it('should track statistics', async () => {
      const successFn = async () => {
        return 'success';
      };

      await circuitBreaker.execute(successFn);

      const stats = circuitBreaker.getStats();

      expect(stats.successCount).toBe(1);
      expect(stats.failureCount).toBe(0);
    });

    it('should track failures', async () => {
      const failingFn = async () => {
        throw new Error('Service error');
      };

      for (let i = 0; i < 2; i++) {
        try {
          await circuitBreaker.execute(failingFn);
        } catch (error) {
          // Expected to fail
        }
      }

      const stats = circuitBreaker.getStats();

      expect(stats.failureCount).toBe(2);
      expect(stats.successCount).toBe(0);
    });
  });

  describe('Manual control', () => {
    it('should manually open circuit', async () => {
      await circuitBreaker.open('Manual open for testing');

      const state = circuitBreaker.getState();
      expect(state).toBe('open');
    });

    it('should manually close circuit', async () => {
      circuitBreaker.close();

      const state = circuitBreaker.getState();
      expect(state).toBe('closed');
    });

    it('should reset circuit', async () => {
      const failingFn = async () => {
        throw new Error('Service error');
      };

      // Open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failingFn);
        } catch (error) {
          // Expected to fail
        }
      }

      await circuitBreaker.reset();

      const state = circuitBreaker.getState();
      expect(state).toBe('closed');

      const stats = circuitBreaker.getStats();
      expect(stats.failureCount).toBe(0);
    });
  });

  describe('Event listeners', () => {
    it('should emit state change events', async () => {
      let stateChangeEventFired = false;
      let fromState: CircuitState | undefined;
      let toState: CircuitState | undefined;

      circuitBreaker.on('state_change', (event, data) => {
        if (event === 'state_change') {
          stateChangeEventFired = true;
          const changeData = data as { from: CircuitState; to: CircuitState };
          fromState = changeData.from;
          toState = changeData.to;
        }
      });

      await circuitBreaker.open('Test');

      expect(stateChangeEventFired).toBe(true);
      expect(fromState).toBe('closed');
      expect(toState).toBe('open');
    });

    it('should emit success events', async () => {
      let successEventFired = false;

      circuitBreaker.on('success', () => {
        successEventFired = true;
      });

      const successFn = async () => {
        return 'success';
      };

      await circuitBreaker.execute(successFn);

      expect(successEventFired).toBe(true);
    });

    it('should emit failure events', async () => {
      let failureEventFired = false;

      circuitBreaker.on('failure', () => {
        failureEventFired = true;
      });

      const failingFn = async () => {
        throw new Error('Service error');
      };

      try {
        await circuitBreaker.execute(failingFn);
      } catch (error) {
        // Expected to fail
      }

      expect(failureEventFired).toBe(true);
    });
  });
});

describe('CircuitBreakerRegistry', () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    registry = createCircuitBreakerRegistry();
  });

  describe('Circuit management', () => {
    it('should get or create circuit breakers', () => {
      const breaker1 = registry.get('service-1');
      const breaker2 = registry.get('service-1');

      expect(breaker1).toBe(breaker2);
    });

    it('should create different circuit breakers for different services', () => {
      const breaker1 = registry.get('service-1');
      const breaker2 = registry.get('service-2');

      expect(breaker1).not.toBe(breaker2);
    });

    it('should remove circuit breakers', () => {
      registry.get('service-1');
      const removed = registry.delete('service-1');

      expect(removed).toBe(true);
    });

    it('should get all circuit breakers', () => {
      registry.get('service-1');
      registry.get('service-2');
      registry.get('service-3');

      const allBreakers = registry.getAll();

      expect(allBreakers).toHaveLength(3);
    });

    it('should get stats for all circuit breakers', () => {
      registry.get('service-1');
      registry.get('service-2');

      const allStats = registry.getAllStats();

      expect(allStats.size).toBe(2);
    });

    it('should reset all circuit breakers', async () => {
      const breaker1 = registry.get('service-1');
      const breaker2 = registry.get('service-2');

      await registry.resetAll();

      const stats1 = breaker1.getStats();
      const stats2 = breaker2.getStats();

      expect(stats1.failureCount).toBe(0);
      expect(stats2.failureCount).toBe(0);
    });
  });
});
