/**
 * Circuit Breaker Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, createCircuitBreaker } from '../../src/lib/circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: 'test-service',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
    });
  });

  describe('Initial state', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should have zero initial counts', () => {
      const stats = breaker.getStats();
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
    });
  });

  describe('Successful execution', () => {
    it('should execute function successfully in CLOSED state', async () => {
      const fn = async () => 'success';
      const result = await breaker.execute(fn);

      expect(result).toBe('success');
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should reset failure count on success', async () => {
      // Fail once
      try {
        await breaker.execute(async () => {
          throw new Error('Failed');
        });
      } catch (error) {
        // Expected
      }

      expect(breaker.getStats().failureCount).toBe(1);

      // Succeed
      await breaker.execute(async () => 'success');

      expect(breaker.getStats().failureCount).toBe(0);
    });
  });

  describe('Failed execution', () => {
    it('should throw error when function fails', async () => {
      const fn = async () => {
        throw new Error('Test error');
      };

      await expect(breaker.execute(fn)).rejects.toThrow('Test error');
    });

    it('should increment failure count on failure', async () => {
      const fn = async () => {
        throw new Error('Failed');
      };

      try {
        await breaker.execute(fn);
      } catch (error) {
        // Expected
      }

      expect(breaker.getStats().failureCount).toBe(1);
    });

    it('should open circuit after failure threshold', async () => {
      const fn = async () => {
        throw new Error('Failed');
      };

      // Fail 3 times (threshold)
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn);
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('OPEN');
    });

    it('should block execution when circuit is OPEN', async () => {
      const fn = async () => {
        throw new Error('Failed');
      };

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn);
        } catch (error) {
          // Expected
        }
      }

      // Try to execute again
      await expect(breaker.execute(fn)).rejects.toThrow('Circuit breaker OPEN');
    });
  });

  describe('Half-open state', () => {
    it('should transition to HALF_OPEN after timeout', async () => {
      const fn = async () => {
        throw new Error('Failed');
      };

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn);
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('OPEN');

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should transition to HALF_OPEN
      expect(breaker.getState()).toBe('HALF_OPEN');
    });

    it('should close circuit after success threshold', async () => {
      const failFn = async () => {
        throw new Error('Failed');
      };

      const successFn = async () => 'success';

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failFn);
        } catch (error) {
          // Expected
        }
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Succeed twice (threshold)
      await breaker.execute(successFn);
      await breaker.execute(successFn);

      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should re-open circuit on failure in HALF_OPEN', async () => {
      const failFn = async () => {
        throw new Error('Failed');
      };

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failFn);
        } catch (error) {
          // Expected
        }
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Fail in HALF_OPEN
      try {
        await breaker.execute(failFn);
      } catch (error) {
        // Expected
      }

      expect(breaker.getState()).toBe('OPEN');
    });

    it('should limit calls in HALF_OPEN state', async () => {
      const failFn = async () => {
        throw new Error('Failed');
      };

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failFn);
        } catch (error) {
          // Expected
        }
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      const breakerWithLimit = new CircuitBreaker({
        name: 'test-service-2',
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000,
        halfOpenMaxCalls: 2,
      });

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breakerWithLimit.execute(failFn);
        } catch (error) {
          // Expected
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1100));

      // Make max calls
      await breakerWithLimit.execute(async () => 'ok');
      await breakerWithLimit.execute(async () => 'ok');

      // Should block next call
      await expect(
        breakerWithLimit.execute(async () => 'ok')
      ).rejects.toThrow('Max test calls');
    });
  });

  describe('Reset', () => {
    it('should reset circuit to CLOSED state', async () => {
      const fn = async () => {
        throw new Error('Failed');
      };

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn);
        } catch (error) {
          // Expected
        }
      }

      await breaker.reset();

      expect(breaker.getState()).toBe('CLOSED');
      expect(breaker.getStats().failureCount).toBe(0);
    });
  });

  describe('Manual open', () => {
    it('should manually open the circuit', async () => {
      await breaker.open('Manual override');

      expect(breaker.getState()).toBe('OPEN');

      const fn = async () => 'success';
      await expect(breaker.execute(fn)).rejects.toThrow('Circuit breaker OPEN');
    });
  });

  describe('Statistics', () => {
    it('should return accurate statistics', async () => {
      const successFn = async () => 'success';
      const failFn = async () => {
        throw new Error('Failed');
      };

      // Some successes
      await breaker.execute(successFn);
      await breaker.execute(successFn);

      // Some failures
      try {
        await breaker.execute(failFn);
      } catch (error) {
        // Expected
      }

      const stats = breaker.getStats();

      expect(stats.successCount).toBe(0); // Reset in CLOSED state
      expect(stats.failureCount).toBe(1);
      expect(stats.lastSuccessTime).toBeGreaterThan(0);
      expect(stats.lastFailureTime).toBeGreaterThan(0);
    });
  });
});

describe('createCircuitBreaker', () => {
  it('should create circuit breaker with default config', () => {
    const breaker = createCircuitBreaker('test-service');

    expect(breaker.getState()).toBe('CLOSED');

    const stats = breaker.getStats();
    expect(stats.failureCount).toBe(0);
    expect(stats.successCount).toBe(0);
  });
});

describe('CircuitBreaker edge cases', () => {
  it('should handle zero failure threshold', async () => {
    const breaker = new CircuitBreaker({
      name: 'test',
      failureThreshold: 0,
      successThreshold: 1,
      timeout: 1000,
    });

    const fn = async () => {
      throw new Error('Failed');
    };

    try {
      await breaker.execute(fn);
    } catch (error) {
      // Expected
    }

    // Should open immediately
    expect(breaker.getState()).toBe('OPEN');
  });

  it('should handle very short timeouts', async () => {
    const breaker = new CircuitBreaker({
      name: 'test',
      failureThreshold: 2,
      successThreshold: 1,
      timeout: 100, // 100ms
    });

    const fn = async () => {
      throw new Error('Failed');
    };

    // Open the circuit
    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(fn);
      } catch (error) {
        // Expected
      }
    }

    expect(breaker.getState()).toBe('OPEN');

    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(breaker.getState()).toBe('HALF_OPEN');
  });
});
