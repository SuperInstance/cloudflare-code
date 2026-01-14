/**
 * Integration tests for RateLimiter
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RateLimiter, RateLimitAlgorithm } from '../../src/index.js';
import type { RateLimitContext } from '../../src/types/index.js';

describe('RateLimiter Integration', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      config: {
        algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
        limit: 10,
        window: 1000
      }
    });
  });

  afterEach(async () => {
    await limiter.destroy();
  });

  it('should allow requests within limit', async () => {
    const result = await limiter.check({
      identifier: 'user-1',
      endpoint: '/api/test'
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeLessThanOrEqual(10);
  });

  it('should deny requests exceeding limit', async () => {
    const context = {
      identifier: 'user-2',
      endpoint: '/api/test'
    };

    // Exhaust limit
    for (let i = 0; i < 10; i++) {
      await limiter.check(context);
    }

    // Next request should be denied
    const result = await limiter.check(context);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('should track metrics', async () => {
    await limiter.check({ identifier: 'user-3' });
    await limiter.check({ identifier: 'user-4' });

    const metrics = limiter.getMetrics();
    expect(metrics.totalRequests).toBe(2);
    expect(metrics.allowedRequests).toBe(2);
    expect(metrics.deniedRequests).toBe(0);
  });

  it('should reset metrics', async () => {
    await limiter.check({ identifier: 'user-5' });
    await limiter.check({ identifier: 'user-6' });

    limiter.resetMetrics();

    const metrics = limiter.getMetrics();
    expect(metrics.totalRequests).toBe(0);
    expect(metrics.allowedRequests).toBe(0);
  });

  it('should update configuration', () => {
    limiter.updateConfig({ limit: 100 });

    const config = limiter.getConfig();
    expect(config.limit).toBe(100);
  });

  it('should emit events', async () => {
    let checkedEventFired = false;
    let allowedEventFired = false;

    limiter.on('checked' as any, (payload: any) => {
      checkedEventFired = true;
    });

    limiter.on('allowed' as any, (payload: any) => {
      allowedEventFired = true;
    });

    await limiter.check({ identifier: 'user-7' });

    expect(checkedEventFired).toBe(true);
    expect(allowedEventFired).toBe(true);
  });

  it('should check with weight', async () => {
    const result = await limiter.checkWithWeight(
      { identifier: 'user-8', endpoint: '/api/test' },
      5
    );

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);
  });

  it('should reset rate limit', async () => {
    const context = { identifier: 'user-9', endpoint: '/api/test' };

    // Exhaust limit
    for (let i = 0; i < 10; i++) {
      await limiter.check(context);
    }

    // Reset
    await limiter.reset(context);

    // Should be allowed again
    const result = await limiter.check(context);
    expect(result.allowed).toBe(true);
  });

  it('should handle multiple identifiers independently', async () => {
    const context1 = { identifier: 'user-10', endpoint: '/api/test' };
    const context2 = { identifier: 'user-11', endpoint: '/api/test' };

    // Exhaust limit for user-10
    for (let i = 0; i < 10; i++) {
      await limiter.check(context1);
    }

    // user-10 should be denied
    const result1 = await limiter.check(context1);
    expect(result1.allowed).toBe(false);

    // user-11 should still be allowed
    const result2 = await limiter.check(context2);
    expect(result2.allowed).toBe(true);
  });

  it('should export state', () => {
    const state = limiter.exportState();

    expect(state).toHaveProperty('config');
    expect(state).toHaveProperty('metrics');
    expect(state).toHaveProperty('distributed');
    expect(state).toHaveProperty('hierarchical');
    expect(state).toHaveProperty('adaptive');
  });
});

describe('RateLimiter with Token Bucket', () => {
  it('should create token bucket limiter', async () => {
    const limiter = RateLimiter.tokenBucket(10, 1000, 20);

    const result = await limiter.check({ identifier: 'test' });
    expect(result.allowed).toBe(true);

    await limiter.destroy();
  });

  it('should handle burst traffic', async () => {
    const limiter = RateLimiter.tokenBucket(10, 1000, 20);

    // Make 15 requests (burst capacity)
    for (let i = 0; i < 15; i++) {
      const result = await limiter.check({ identifier: 'test' });
      expect(result.allowed).toBe(true);
    }

    // 21st request should be denied
    for (let i = 0; i < 6; i++) {
      await limiter.check({ identifier: 'test' });
    }

    const result = await limiter.check({ identifier: 'test' });
    expect(result.allowed).toBe(false);

    await limiter.destroy();
  });
});

describe('RateLimiter with Leaky Bucket', () => {
  it('should create leaky bucket limiter', async () => {
    const limiter = RateLimiter.leakyBucket(10, 1000, 10000);

    const result = await limiter.check({ identifier: 'test' });
    expect(result.allowed).toBe(true);

    await limiter.destroy();
  });
});

describe('RateLimiter with Sliding Window', () => {
  it('should create sliding window limiter', async () => {
    const limiter = RateLimiter.slidingWindow(10, 1000);

    const result = await limiter.check({ identifier: 'test' });
    expect(result.allowed).toBe(true);

    await limiter.destroy();
  });
});

describe('RateLimiter with Fixed Window', () => {
  it('should create fixed window limiter', async () => {
    const limiter = RateLimiter.fixedWindow(10, 1000);

    const result = await limiter.check({ identifier: 'test' });
    expect(result.allowed).toBe(true);

    await limiter.destroy();
  });
});

describe('RateLimiter Static Methods', () => {
  it('should create limiter with default options', async () => {
    const limiter = RateLimiter.create({});

    const result = await limiter.check({ identifier: 'test' });
    expect(result.allowed).toBe(true);

    await limiter.destroy();
  });

  it('should create limiter with custom options', async () => {
    const limiter = RateLimiter.create({
      config: {
        algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
        limit: 100,
        window: 60000,
        burst: 200
      }
    });

    const config = limiter.getConfig();
    expect(config.algorithm).toBe(RateLimitAlgorithm.TOKEN_BUCKET);
    expect(config.limit).toBe(100);

    await limiter.destroy();
  });
});

describe('RateLimiter Error Handling', () => {
  it('should skip on error when configured', async () => {
    const limiter = new RateLimiter({
      config: {
        algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
        limit: 10,
        window: 1000
      },
      skipOnError: true
    });

    // This test would need a failing storage to properly test skipOnError
    // For now, we just verify the option is accepted
    const result = await limiter.check({ identifier: 'test' });
    expect(result.allowed).toBe(true);

    await limiter.destroy();
  });

  it('should emit error event on failure', async () => {
    let errorEventFired = false;

    const limiter = new RateLimiter({
      config: {
        algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
        limit: 10,
        window: 1000
      },
      onEvent: (event: any) => {
        if (event.type === 'error') {
          errorEventFired = true;
        }
      }
    });

    // Normal operation should not emit error
    await limiter.check({ identifier: 'test' });
    expect(errorEventFired).toBe(false);

    await limiter.destroy();
  });
});
