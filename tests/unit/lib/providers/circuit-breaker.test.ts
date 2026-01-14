/**
 * Unit Tests for Circuit Breaker and Retry Logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createCircuitBreaker,
  CircuitState,
  createRetryPolicy,
  createResilientWrapper,
  type CircuitBreakerConfig,
  type RetryConfig,
} from '../../../../packages/edge/src/lib/providers/circuit-breaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: ReturnType<typeof createCircuitBreaker>;
  let config: CircuitBreakerConfig;

  beforeEach(() => {
    config = {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
      halfOpenMaxCalls: 2,
      failureRateWindow: 10000,
      failureRateThreshold: 0.5,
    };
    circuitBreaker = createCircuitBreaker('test-provider', config);
  });

  describe('initial state', () => {
    it('should start in closed state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should have zero failures', () => {
      const stats = circuitBreaker.getStats();
      expect(stats.failureCount).toBe(0);
    });
  });

  describe('successful execution', () => {
    it('should execute function successfully', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const result = await circuitBreaker.execute(fn);

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should keep circuit closed on success', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      await circuitBreaker.execute(fn);

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('failed execution', () => {
    it('should handle failed function', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('test error'));

      await expect(circuitBreaker.execute(fn)).rejects.toThrow('test error');
    });

    it('should open circuit after threshold failures', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('test error'));

      // Execute until threshold
      for (let i = 0; i < config.failureThreshold; i++) {
        try {
          await circuitBreaker.execute(fn);
        } catch (e) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should reject calls when circuit is open', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('test error'));

      // Open the circuit
      for (let i = 0; i < config.failureThreshold; i++) {
        try {
          await circuitBreaker.execute(fn);
        } catch (e) {
          // Expected to fail
        }
      }

      // Should reject immediately
      await expect(circuitBreaker.execute(fn)).rejects.toThrow('Circuit breaker OPEN');
    });
  });

  describe('recovery', () => {
    it('should transition to half-open after timeout', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('test error'));

      // Open the circuit
      for (let i = 0; i < config.failureThreshold; i++) {
        try {
          await circuitBreaker.execute(fn);
        } catch (e) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, config.timeout + 100));

      // Next call should transition to half-open
      fn.mockResolvedValue('result');
      await circuitBreaker.execute(fn);

      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
    });

    it('should close circuit after successful calls in half-open', async () => {
      // Open circuit
      const failFn = vi.fn().mockRejectedValue(new Error('test error'));
      for (let i = 0; i < config.failureThreshold; i++) {
        try {
          await circuitBreaker.execute(failFn);
        } catch (e) {
          // Expected
        }
      }

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, config.timeout + 100));

      // Execute successful calls
      const successFn = vi.fn().mockResolvedValue('result');
      for (let i = 0; i < config.successThreshold; i++) {
        await circuitBreaker.execute(successFn);
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('reset', () => {
    it('should reset circuit to closed state', async () => {
      // Open circuit
      const fn = vi.fn().mockRejectedValue(new Error('test error'));
      for (let i = 0; i < config.failureThreshold; i++) {
        try {
          await circuitBreaker.execute(fn);
        } catch (e) {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Reset
      circuitBreaker.reset();
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      const stats = circuitBreaker.getStats();
      expect(stats.failureCount).toBe(0);
    });
  });

  describe('stats', () => {
    it('should track failures and successes', async () => {
      const failFn = vi.fn().mockRejectedValue(new Error('test error'));
      const successFn = vi.fn().mockResolvedValue('result');

      // Fail twice
      for (let i = 0; i < 2; i++) {
        try {
          await circuitBreaker.execute(failFn);
        } catch (e) {
          // Expected
        }
      }

      // Succeed once
      await circuitBreaker.execute(successFn);

      const stats = circuitBreaker.getStats();
      expect(stats.failureCount).toBe(0); // Reset by success
      expect(stats.totalRequests).toBe(3);
      expect(stats.failedRequests).toBe(2);
    });
  });
});

describe('RetryPolicy', () => {
  let retryPolicy: ReturnType<typeof createRetryPolicy>;
  let config: RetryConfig;

  beforeEach(() => {
    config = {
      maxRetries: 3,
      baseDelay: 100,
      maxDelay: 1000,
      jitterFactor: 0.1,
      backoffMultiplier: 2,
    };
    retryPolicy = createRetryPolicy(config);
  });

  describe('successful execution', () => {
    it('should execute successfully on first try', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const result = await retryPolicy.execute(fn);

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('retry on failure', () => {
    it('should retry on retryable errors', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValue('result');

      const result = await retryPolicy.execute(fn);
      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry up to max attempts', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(retryPolicy.execute(fn)).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(config.maxRetries + 1); // Initial + retries
    });

    it('should not retry on non-retryable errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Invalid request'));

      await expect(retryPolicy.execute(fn)).rejects.toThrow();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValue('result');

      const start = Date.now();
      await retryPolicy.execute(fn);
      const duration = Date.now() - start;

      // Should have delays: ~100ms + ~200ms = ~300ms minimum
      expect(duration).toBeGreaterThanOrEqual(250);
    });
  });

  describe('config', () => {
    it('should return config', () => {
      const retrievedConfig = retryPolicy.getConfig();
      expect(retrievedConfig.maxRetries).toBe(config.maxRetries);
      expect(retrievedConfig.baseDelay).toBe(config.baseDelay);
    });
  });
});

describe('ResilientWrapper', () => {
  let wrapper: ReturnType<typeof createResilientWrapper>;

  beforeEach(() => {
    wrapper = createResilientWrapper(
      'test-provider',
      {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000,
        halfOpenMaxCalls: 2,
      },
      {
        maxRetries: 2,
        baseDelay: 50,
        maxDelay: 500,
        jitterFactor: 0.1,
        backoffMultiplier: 2,
      }
    );
  });

  describe('execution', () => {
    it('should execute with both circuit breaker and retry', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const result = await wrapper.execute(fn);

      expect(result).toBe('result');
    });

    it('should retry before opening circuit', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValue('result');

      const result = await wrapper.execute(fn);
      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('circuit state', () => {
    it('should get circuit state', () => {
      const state = wrapper.getCircuitState();
      expect([CircuitState.CLOSED, CircuitState.OPEN, CircuitState.HALF_OPEN]).toContain(state);
    });

    it('should get circuit stats', () => {
      const stats = wrapper.getCircuitStats();
      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('failureCount');
      expect(stats).toHaveProperty('successCount');
    });
  });

  describe('reset', () => {
    it('should reset circuit breaker', async () => {
      // Open circuit
      const fn = vi.fn().mockRejectedValue(new Error('test error'));
      for (let i = 0; i < 3; i++) {
        try {
          await wrapper.execute(fn);
        } catch (e) {
          // Expected
        }
      }

      expect(wrapper.getCircuitState()).toBe(CircuitState.OPEN);

      // Reset
      wrapper.reset();
      expect(wrapper.getCircuitState()).toBe(CircuitState.CLOSED);
    });
  });
});
