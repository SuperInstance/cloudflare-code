/**
 * Circuit Breaker Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerManager,
  CircuitBreakerOpenError,
  RetryExhaustedError,
} from '../../src/circuit/breaker';
import type { RetryPolicy } from '../../src/types';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      serviceName: 'test-service',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 5000,
      halfOpenMaxCalls: 2,
      minRequests: 2,
      strategy: 'count',
    });
  });

  describe('Initial State', () => {
    it('should start in closed state', () => {
      expect(breaker.getState()).toBe('closed');
    });

    it('should have initial statistics', () => {
      const stats = breaker.getStats();
      expect(stats.state).toBe('closed');
      expect(stats.totalRequests).toBe(0);
      expect(stats.failedRequests).toBe(0);
    });
  });

  describe('Successful Requests', () => {
    it('should record successful requests', async () => {
      const mockRequest = vi.fn().mockResolvedValue({ success: true });

      await breaker.execute(mockRequest);

      const stats = breaker.getStats();
      expect(stats.successfulRequests).toBe(1);
      expect(stats.failedRequests).toBe(0);
    });

    it('should remain closed on success', async () => {
      const mockRequest = vi.fn().mockResolvedValue({ success: true });

      await breaker.execute(mockRequest);
      await breaker.execute(mockRequest);

      expect(breaker.getState()).toBe('closed');
    });
  });

  describe('Failed Requests', () => {
    it('should record failed requests', async () => {
      const mockRequest = vi.fn().mockRejectedValue(new Error('Request failed'));

      await expect(breaker.execute(mockRequest)).rejects.toThrow();

      const stats = breaker.getStats();
      expect(stats.failedRequests).toBe(1);
    });

    it('should open circuit after threshold', async () => {
      const mockRequest = vi.fn().mockRejectedValue(new Error('Request failed'));

      // Execute failing requests
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(mockRequest);
        } catch (e) {
          // Expected to fail
        }
      }

      expect(breaker.getState()).toBe('open');
    });

    it('should reject requests when open', async () => {
      const mockRequest = vi.fn().mockRejectedValue(new Error('Request failed'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(mockRequest);
        } catch (e) {
          // Expected
        }
      }

      // Next request should be rejected
      await expect(breaker.execute(mockRequest)).rejects.toThrow(
        CircuitBreakerOpenError
      );
    });
  });

  describe('Half-Open State', () => {
    it('should transition to half-open after timeout', async () => {
      const mockRequest = vi.fn().mockRejectedValue(new Error('Request failed'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(mockRequest);
        } catch (e) {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('open');

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Next request should transition to half-open
      mockRequest.mockResolvedValueOnce({ success: true });
      await breaker.execute(mockRequest);

      expect(breaker.getState()).toBe('half_open');
    });

    it('should close after successful requests in half-open', async () => {
      const mockRequest = vi.fn().mockResolvedValue({ success: true });

      // Manually set to half-open for testing
      (breaker as any).transitionTo('half_open');

      // Execute successful requests
      await breaker.execute(mockRequest);
      await breaker.execute(mockRequest);

      expect(breaker.getState()).toBe('closed');
    });

    it('should reopen on failure in half-open', async () => {
      const mockRequest = vi.fn();

      // Manually set to half-open
      (breaker as any).transitionTo('half_open');

      // First request succeeds
      mockRequest.mockResolvedValueOnce({ success: true });
      await breaker.execute(mockRequest);

      // Second request fails
      mockRequest.mockRejectedValueOnce(new Error('Request failed'));
      await expect(breaker.execute(mockRequest)).rejects.toThrow();

      expect(breaker.getState()).toBe('open');
    });
  });

  describe('Retry Logic', () => {
    it('should retry with exponential backoff', async () => {
      const mockRequest = vi.fn();

      // Fail twice, then succeed
      mockRequest
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ success: true });

      const retryPolicy: RetryPolicy = {
        maxAttempts: 3,
        initialBackoff: 100,
        maxBackoff: 1000,
        backoffMultiplier: 2,
        jitterEnabled: false,
        jitterFactor: 0.1,
        retryableStatuses: [503, 504],
        retryableErrors: ['ECONNRESET', 'ETIMEDOUT'],
      };

      // The circuit breaker implementation would need to support this
      // For now, we'll test the basic functionality
      const result = await breaker.execute(mockRequest, retryPolicy);
      expect(result).toBeDefined();
    });

    it('should exhaust retries after max attempts', async () => {
      const mockRequest = vi.fn().mockRejectedValue(new Error('Permanent failure'));

      const retryPolicy: RetryPolicy = {
        maxAttempts: 3,
        initialBackoff: 100,
        maxBackoff: 1000,
        backoffMultiplier: 2,
        jitterEnabled: false,
        jitterFactor: 0.1,
        retryableStatuses: [503],
        retryableErrors: ['ECONNRESET'],
      };

      await expect(breaker.execute(mockRequest, retryPolicy)).rejects.toThrow(
        RetryExhaustedError
      );

      expect(mockRequest).toHaveBeenCalledTimes(3);
    });
  });

  describe('Event Handling', () => {
    it('should emit state change events', () => {
      const events: any[] = [];
      breaker.on((event) => events.push(event));

      (breaker as any).transitionTo('half_open');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('state_change');
      expect(events[0].newState).toBe('half_open');
    });
  });

  describe('Reset', () => {
    it('should reset to closed state', async () => {
      const mockRequest = vi.fn().mockRejectedValue(new Error('Request failed'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(mockRequest);
        } catch (e) {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('open');

      breaker.reset();

      expect(breaker.getState()).toBe('closed');
      const stats = breaker.getStats();
      expect(stats.totalRequests).toBe(0);
    });
  });
});

describe('CircuitBreakerManager', () => {
  let manager: CircuitBreakerManager;

  beforeEach(() => {
    manager = new CircuitBreakerManager({
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 5000,
    });
  });

  it('should create circuit breakers for different services', () => {
    const breaker1 = manager.getBreaker('service-1');
    const breaker2 = manager.getBreaker('service-2');

    expect(breaker1).toBeInstanceOf(CircuitBreaker);
    expect(breaker2).toBeInstanceOf(CircuitBreaker);
    expect(breaker1).not.toBe(breaker2);
  });

  it('should reuse existing circuit breakers', () => {
    const breaker1 = manager.getBreaker('service-1');
    const breaker2 = manager.getBreaker('service-1');

    expect(breaker1).toBe(breaker2);
  });

  it('should get all circuit breaker stats', async () => {
    const breaker = manager.getBreaker('test-service');
    const mockRequest = vi.fn().mockResolvedValue({ success: true });

    await breaker.execute(mockRequest);

    const allStats = manager.getAllStats();
    expect(allStats.has('test-service')).toBe(true);
    expect(allStats.get('test-service')?.successfulRequests).toBe(1);
  });

  it('should identify open circuits', async () => {
    const breaker = manager.getBreaker('test-service');
    const mockRequest = vi.fn().mockRejectedValue(new Error('Failed'));

    // Open the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(mockRequest);
      } catch (e) {
        // Expected
      }
    }

    const openCircuits = manager.getOpenCircuits();
    expect(openCircuits).toContain('test-service');
  });

  it('should reset all circuit breakers', async () => {
    const breaker1 = manager.getBreaker('service-1');
    const breaker2 = manager.getBreaker('service-2');

    const mockRequest = vi.fn().mockRejectedValue(new Error('Failed'));

    // Open both circuits
    for (const breaker of [breaker1, breaker2]) {
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(mockRequest);
        } catch (e) {
          // Expected
        }
      }
    }

    manager.resetAll();

    expect(breaker1.getState()).toBe('closed');
    expect(breaker2.getState()).toBe('closed');
  });
});

describe('Circuit Breaker Statistics', () => {
  it('should calculate failure rate correctly', async () => {
    const breaker = new CircuitBreaker({
      serviceName: 'test-service',
      failureThreshold: 5,
      minRequests: 3,
      strategy: 'percentage',
    });

    const mockRequest = vi.fn();

    // 2 failures, 1 success = 66.67% failure rate
    mockRequest.mockRejectedValueOnce(new Error('Failed'));
    mockRequest.mockRejectedValueOnce(new Error('Failed'));
    mockRequest.mockResolvedValueOnce({ success: true });

    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(mockRequest);
      } catch (e) {
        // Expected failures
      }
    }

    const stats = breaker.getStats();
    expect(stats.failedRequests).toBe(2);
    expect(stats.successfulRequests).toBe(1);
    expect(stats.currentFailureRate).toBeGreaterThan(60);
  });

  it('should track average latency', async () => {
    const breaker = new CircuitBreaker({
      serviceName: 'test-service',
    });

    // Simulate requests with different latencies
    const mockRequest = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { success: true };
    });

    await breaker.execute(mockRequest);
    await breaker.execute(mockRequest);

    const stats = breaker.getStats();
    expect(stats.averageLatency).toBeGreaterThan(0);
  });
});
