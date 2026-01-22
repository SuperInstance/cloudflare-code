/**
 * Unit tests for Backpressure Controller
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BackpressureController,
  FlowController,
  CircuitBreaker,
  RateLimiter,
  AdaptiveThrottler,
  createBackpressureController,
  createFlowController,
  createCircuitBreaker,
  createRateLimiter,
  createAdaptiveThrottler,
} from '../../src/backpressure/controller';
import type { BackpressureStrategy, FlowControlConfig, CircuitBreakerConfig } from '../../src/types';

describe('BackpressureController', () => {
  describe('drop strategy', () => {
    it('should accept items when buffer not full', async () => {
      const strategy: BackpressureStrategy = {
        type: 'drop',
        bufferSize: 10,
        dropPolicy: 'oldest',
      };

      const controller = new BackpressureController(strategy);
      const processor = vi.fn();

      const result = await controller.process('test', processor);

      expect(result.status).toBe('accepted');
    });

    it('should drop oldest items when buffer full', async () => {
      const strategy: BackpressureStrategy = {
        type: 'drop',
        bufferSize: 2,
        dropPolicy: 'oldest',
      };

      const controller = new BackpressureController(strategy);
      const processor = vi.fn();

      await controller.process('item1', processor);
      await controller.process('item2', processor);
      await controller.process('item3', processor);

      const stats = controller.getStats();

      expect(stats.dropped).toBe(1);
    });

    it('should drop newest items when configured', async () => {
      const strategy: BackpressureStrategy = {
        type: 'drop',
        bufferSize: 2,
        dropPolicy: 'newest',
      };

      const controller = new BackpressureController(strategy);
      const processor = vi.fn();

      await controller.process('item1', processor);
      await controller.process('item2', processor);
      await controller.process('item3', processor);

      const stats = controller.getStats();

      expect(stats.dropped).toBe(1);
    });
  });

  describe('buffer strategy', () => {
    it('should accept items when buffer not full', async () => {
      const strategy: BackpressureStrategy = {
        type: 'buffer',
        bufferSize: 10,
      };

      const controller = new BackpressureController(strategy);
      const processor = vi.fn();

      const result = await controller.process('test', processor);

      expect(result.status).toBe('accepted');
    });

    it('should reject items when buffer full', async () => {
      const strategy: BackpressureStrategy = {
        type: 'buffer',
        bufferSize: 2,
      };

      const controller = new BackpressureController(strategy);
      const processor = vi.fn();

      await controller.process('item1', processor);
      await controller.process('item2', processor);

      const result = await controller.process('item3', processor);

      expect(result.status).toBe('rejected');
      expect(result.reason).toBe('Buffer full');
    });
  });

  describe('throttle strategy', () => {
    it('should accept requests within rate limit', async () => {
      const strategy: BackpressureStrategy = {
        type: 'throttle',
        throttleRate: 10,
      };

      const controller = new BackpressureController(strategy);
      const processor = vi.fn();

      const result = await controller.process('test', processor);

      expect(result.status).toBe('accepted');
    });

    it('should reject requests exceeding rate limit', async () => {
      const strategy: BackpressureStrategy = {
        type: 'throttle',
        throttleRate: 0.01, // Very low rate
      };

      const controller = new BackpressureController(strategy);
      const processor = vi.fn();

      // First request should be accepted
      await controller.process('test1', processor);

      // Second request should be rejected
      const result = await controller.process('test2', processor);

      expect(result.status).toBe('rejected');
      expect(result.reason).toBe('Rate limit exceeded');
    });
  });

  describe('reject strategy', () => {
    it('should accept when under capacity', async () => {
      const strategy: BackpressureStrategy = {
        type: 'reject',
        bufferSize: 10,
      };

      const controller = new BackpressureController(strategy);
      const processor = vi.fn();

      const result = await controller.process('test', processor);

      expect(result.status).toBe('accepted');
    });

    it('should reject when overloaded', async () => {
      const strategy: BackpressureStrategy = {
        type: 'reject',
        bufferSize: 1,
      };

      const controller = new BackpressureController(strategy);
      const processor = vi.fn();

      await controller.process('item1', processor);

      const result = await controller.process('item2', processor);

      expect(result.status).toBe('rejected');
      expect(result.reason).toBe('Overloaded');
    });
  });

  describe('getStats', () => {
    it('should return current statistics', async () => {
      const strategy: BackpressureStrategy = {
        type: 'buffer',
        bufferSize: 10,
      };

      const controller = new BackpressureController(strategy);
      const processor = vi.fn();

      await controller.process('test', processor);

      const stats = controller.getStats();

      expect(stats.accepted).toBe(1);
    });
  });

  describe('clearBuffer', () => {
    it('should clear buffer', async () => {
      const strategy: BackpressureStrategy = {
        type: 'buffer',
        bufferSize: 10,
      };

      const controller = new BackpressureController(strategy);
      const processor = vi.fn();

      await controller.process('test', processor);
      controller.clearBuffer();

      expect(controller.getBufferSize()).toBe(0);
    });
  });
});

describe('FlowController', () => {
  let controller: FlowController;

  beforeEach(() => {
    controller = new FlowController({
      maxConcurrent: 2,
      timeout: 1000,
    });
  });

  it('should execute request successfully', async () => {
    const request = vi.fn().mockResolvedValue('result');

    const result = await controller.execute(request);

    expect(result).toBe('result');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('should handle timeout', async () => {
    const request = vi.fn(
      () =>
        new Promise(resolve => setTimeout(() => resolve('result'), 2000))
    );

    await expect(controller.execute(request, { timeout: 100 })).rejects.toThrow(
      'Request timeout'
    );
  });

  it('should limit concurrent requests', async () => {
    const controller = new FlowController({
      maxConcurrent: 2,
      timeout: 5000,
    });

    let activeCount = 0;
    const request = vi.fn(async () => {
      activeCount++;
      await new Promise(resolve => setTimeout(resolve, 100));
      activeCount--;
      return 'result';
    });

    // Start 3 concurrent requests
    const promises = [
      controller.execute(request),
      controller.execute(request),
      controller.execute(request),
    ];

    // Check that max concurrent is not exceeded
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(activeCount).toBeLessThanOrEqual(2);

    await Promise.all(promises);
  });

  it('should respect circuit breaker', async () => {
    const controller = new FlowController({
      maxConcurrent: 10,
      timeout: 1000,
      circuitBreaker: {
        failureThreshold: 2,
        timeout: 5000,
        successThreshold: 1,
        halfOpenMaxCalls: 1,
      },
    });

    const request = vi.fn().mockRejectedValue(new Error('Failure'));

    // Fail twice to open circuit
    await expect(controller.execute(request)).rejects.toThrow();
    await expect(controller.execute(request)).rejects.toThrow();

    // Circuit should be open
    const state = controller.getCircuitBreakerState();
    expect(state?.state).toBe('open');

    // Next request should be rejected immediately
    await expect(controller.execute(request, { retries: false })).rejects.toThrow();
  });

  it('should retry failed requests', async () => {
    const controller = new FlowController({
      maxConcurrent: 10,
      timeout: 1000,
      retryPolicy: {
        maxAttempts: 3,
        backoff: 'exponential',
        initialDelay: 10,
        maxDelay: 100,
      },
    });

    let attempts = 0;
    const request = vi.fn(async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Temporary failure');
      }
      return 'success';
    });

    const result = await controller.execute(request);

    expect(result).toBe('success');
    expect(request).toHaveBeenCalledTimes(3);
  });
});

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
      halfOpenMaxCalls: 2,
    });
  });

  it('should start in closed state', () => {
    const state = breaker.getState();

    expect(state.state).toBe('closed');
    expect(breaker.isClosed()).toBe(true);
  });

  it('should open after failure threshold', () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();

    const state = breaker.getState();

    expect(state.state).toBe('open');
    expect(breaker.isOpen()).toBe(true);
  });

  it('should transition to half-open after timeout', async () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();

    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 1100));

    await breaker.waitForReady();

    const state = breaker.getState();

    expect(state.state).toBe('half-open');
  });

  it('should close after successes in half-open', () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();

    // Manually set to half-open
    breaker['setState']('half-open');

    breaker.recordSuccess();
    breaker.recordSuccess();

    const state = breaker.getState();

    expect(state.state).toBe('closed');
  });

  it('should reset to closed', () => {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();

    breaker.reset();

    const state = breaker.getState();

    expect(state.state).toBe('closed');
  });
});

describe('RateLimiter', () => {
  it('should allow requests within limit', async () => {
    const limiter = new RateLimiter(5, 1000);

    for (let i = 0; i < 5; i++) {
      const allowed = await limiter.tryRequest();
      expect(allowed).toBe(true);
    }
  });

  it('should reject requests exceeding limit', async () => {
    const limiter = new RateLimiter(2, 1000);

    await limiter.tryRequest();
    await limiter.tryRequest();

    const allowed = await limiter.tryRequest();

    expect(allowed).toBe(false);
  });

  it('should reset after window expires', async () => {
    const limiter = new RateLimiter(2, 100);

    await limiter.tryRequest();
    await limiter.tryRequest();

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 150));

    const allowed = await limiter.tryRequest();

    expect(allowed).toBe(true);
  });
});

describe('AdaptiveThrottler', () => {
  let throttler: AdaptiveThrottler;

  beforeEach(() => {
    throttler = new AdaptiveThrottler(100, 10, 200);
  });

  it('should increase rate on successes', () => {
    const initialRate = throttler.getCurrentRate();

    for (let i = 0; i < 10; i++) {
      throttler.recordSuccess();
    }

    expect(throttler.getCurrentRate()).toBeGreaterThan(initialRate);
  });

  it('should decrease rate on errors', () => {
    const initialRate = throttler.getCurrentRate();

    for (let i = 0; i < 5; i++) {
      throttler.recordError();
    }

    expect(throttler.getCurrentRate()).toBeLessThan(initialRate);
  });

  it('should not exceed max rate', () => {
    for (let i = 0; i < 1000; i++) {
      throttler.recordSuccess();
    }

    expect(throttler.getCurrentRate()).toBeLessThanOrEqual(200);
  });

  it('should not go below min rate', () => {
    for (let i = 0; i < 1000; i++) {
      throttler.recordError();
    }

    expect(throttler.getCurrentRate()).toBeGreaterThanOrEqual(10);
  });

  it('should calculate wait time', () => {
    const rate = throttler.getCurrentRate();
    const waitTime = throttler.getWaitTime();

    expect(waitTime).toBe(1000 / rate);
  });

  it('should reset throttler', () => {
    throttler.recordSuccess();
    throttler.recordError();

    throttler.reset();

    expect(throttler['consecutiveSuccesses']).toBe(0);
    expect(throttler['consecutiveErrors']).toBe(0);
  });
});

describe('Helper functions', () => {
  it('should create backpressure controller', () => {
    const strategy: BackpressureStrategy = { type: 'buffer' };
    const controller = createBackpressureController(strategy);

    expect(controller).toBeInstanceOf(BackpressureController);
  });

  it('should create flow controller', () => {
    const config: FlowControlConfig = {
      maxConcurrent: 10,
      timeout: 1000,
    };
    const controller = createFlowController(config);

    expect(controller).toBeInstanceOf(FlowController);
  });

  it('should create circuit breaker', () => {
    const config: CircuitBreakerConfig = {
      failureThreshold: 5,
      timeout: 10000,
    };
    const breaker = createCircuitBreaker(config);

    expect(breaker).toBeInstanceOf(CircuitBreaker);
  });

  it('should create rate limiter', () => {
    const limiter = createRateLimiter(10, 1000);

    expect(limiter).toBeInstanceOf(RateLimiter);
  });

  it('should create adaptive throttler', () => {
    const throttler = createAdaptiveThrottler(100, 10, 200);

    expect(throttler).toBeInstanceOf(AdaptiveThrottler);
  });
});
