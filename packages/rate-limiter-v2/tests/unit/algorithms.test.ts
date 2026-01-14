/**
 * Unit tests for rate limiting algorithms
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TokenBucketAlgorithm } from '../../src/algorithms/token-bucket.js';
import { LeakyBucketAlgorithm } from '../../src/algorithms/leaky-bucket.js';
import { SlidingWindowAlgorithm } from '../../src/algorithms/sliding-window.js';
import { FixedWindowAlgorithm } from '../../src/algorithms/fixed-window.js';
import { RateLimitAlgorithm } from '../../src/types/index.js';

describe('TokenBucketAlgorithm', () => {
  let algorithm: TokenBucketAlgorithm;

  beforeEach(() => {
    algorithm = new TokenBucketAlgorithm({
      algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
      limit: 10,
      window: 1000,
      burst: 20
    });
  });

  it('should allow requests within token bucket limit', async () => {
    const result = await algorithm.check(null, { identifier: 'test' });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });

  it('should deny requests when tokens exhausted', async () => {
    let state = null;

    // Exhaust all tokens
    for (let i = 0; i < 25; i++) {
      const result = await algorithm.check(state, { identifier: 'test' });
      if (result.allowed && state === null) {
        state = {
          tokens: result.remaining,
          lastRefill: Date.now(),
          count: 1,
          lastUpdate: Date.now(),
          metadata: {}
        };
      } else if (state) {
        state.tokens = result.remaining;
        state.lastRefill = Date.now();
        state.count++;
      }
    }

    // Next request should be denied
    const result = await algorithm.check(state, { identifier: 'test' });
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('should refill tokens over time', async () => {
    const state = {
      tokens: 0,
      lastRefill: Date.now() - 500, // 500ms ago
      count: 10,
      lastUpdate: Date.now(),
      metadata: {}
    };

    const result = await algorithm.check(state, { identifier: 'test' });
    expect(result.allowed).toBe(true);
    expect(result.metadata.tokens).toBeGreaterThan(0);
  });

  it('should reset state correctly', () => {
    const state = algorithm.reset();
    expect(state.tokens).toBe(20);
    expect(state.count).toBe(0);
  });

  it('should update configuration', () => {
    algorithm.updateConfig({ limit: 100, burst: 50 });
    const state = algorithm.reset();
    expect(state.tokens).toBe(50);
  });
});

describe('LeakyBucketAlgorithm', () => {
  let algorithm: LeakyBucketAlgorithm;

  beforeEach(() => {
    algorithm = new LeakyBucketAlgorithm({
      algorithm: RateLimitAlgorithm.LEAKY_BUCKET,
      limit: 10,
      window: 1000,
      rate: 10000 // 10 tokens per second
    });
  });

  it('should allow requests within leaky bucket capacity', async () => {
    const result = await algorithm.check(null, { identifier: 'test' });
    expect(result.allowed).toBe(true);
  });

  it('should deny requests when bucket overflows', async () => {
    let state: any = null;

    // Fill bucket to capacity
    for (let i = 0; i < 15; i++) {
      const result = await algorithm.check(state, { identifier: 'test' });
      if (result.allowed && state === null) {
        state = {
          volume: 10 - result.remaining,
          lastLeak: Date.now(),
          count: 1,
          lastUpdate: Date.now(),
          metadata: {}
        };
      } else if (state) {
        state.volume = 10 - result.remaining;
        state.lastLeak = Date.now();
        state.count++;
      }

      if (!result.allowed) break;
    }

    // Bucket should be overflowing now
    const result = await algorithm.check(state, { identifier: 'test' });
    expect(result.allowed).toBe(false);
  });

  it('should leak volume over time', async () => {
    const state = {
      volume: 10,
      lastLeak: Date.now() - 1000, // 1 second ago
      count: 10,
      lastUpdate: Date.now(),
      metadata: {}
    };

    const result = await algorithm.check(state, { identifier: 'test' });
    expect(result.allowed).toBe(true);
  });

  it('should reset state correctly', () => {
    const state = algorithm.reset();
    expect(state.volume).toBe(0);
    expect(state.count).toBe(0);
  });
});

describe('SlidingWindowAlgorithm', () => {
  let algorithm: SlidingWindowAlgorithm;

  beforeEach(() => {
    algorithm = new SlidingWindowAlgorithm({
      algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
      limit: 10,
      window: 1000
    });
  });

  it('should allow requests within sliding window limit', async () => {
    let state = null;

    for (let i = 0; i < 10; i++) {
      const result = await algorithm.check(state, { identifier: 'test' });
      expect(result.allowed).toBe(true);

      if (!state) {
        state = {
          requests: [{ timestamp: Date.now(), count: 1 }],
          count: 1,
          lastUpdate: Date.now(),
          metadata: {}
        };
      } else {
        state.requests.push({ timestamp: Date.now(), count: 1 });
        state.count++;
      }
    }
  });

  it('should deny requests when sliding window limit exceeded', async () => {
    let state = null;

    // Make 10 requests
    for (let i = 0; i < 10; i++) {
      const result = await algorithm.check(state, { identifier: 'test' });
      if (!state) {
        state = {
          requests: [{ timestamp: Date.now(), count: 1 }],
          count: 1,
          lastUpdate: Date.now(),
          metadata: {}
        };
      } else {
        state.requests.push({ timestamp: Date.now(), count: 1 });
        state.count++;
      }
    }

    // 11th request should be denied
    const result = await algorithm.check(state, { identifier: 'test' });
    expect(result.allowed).toBe(false);
  });

  it('should expire old requests in sliding window', async () => {
    const now = Date.now();
    const state = {
      requests: [
        { timestamp: now - 2000, count: 5 },
        { timestamp: now - 500, count: 5 }
      ],
      count: 10,
      lastUpdate: now,
      metadata: {}
    };

    // Old requests should be expired, only 5 recent requests remain
    const result = await algorithm.check(state, { identifier: 'test' });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it('should handle weighted requests', async () => {
    const result = await algorithm.checkWithWeight(
      null,
      { identifier: 'test' },
      5
    );
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeLessThan(10);
  });

  it('should reset state correctly', () => {
    const state = algorithm.reset();
    expect(state.requests).toEqual([]);
    expect(state.count).toBe(0);
  });
});

describe('FixedWindowAlgorithm', () => {
  let algorithm: FixedWindowAlgorithm;

  beforeEach(() => {
    algorithm = new FixedWindowAlgorithm({
      algorithm: RateLimitAlgorithm.FIXED_WINDOW,
      limit: 10,
      window: 1000
    });
  });

  it('should allow requests within fixed window limit', async () => {
    let state = null;

    for (let i = 0; i < 10; i++) {
      const result = await algorithm.check(state, { identifier: 'test' });
      expect(result.allowed).toBe(true);

      if (!state) {
        state = {
          windowStart: Math.floor(Date.now() / 1000) * 1000,
          count: 1,
          lastUpdate: Date.now(),
          metadata: {}
        };
      } else {
        state.count++;
      }
    }
  });

  it('should deny requests when fixed window limit exceeded', async () => {
    const now = Date.now();
    const windowStart = Math.floor(now / 1000) * 1000;

    const state = {
      windowStart,
      count: 10,
      lastUpdate: now,
      metadata: {}
    };

    const result = await algorithm.check(state, { identifier: 'test' });
    expect(result.allowed).toBe(false);
  });

  it('should reset counter when window expires', async () => {
    const now = Date.now();
    const oldWindowStart = Math.floor((now - 2000) / 1000) * 1000;

    const state = {
      windowStart: oldWindowStart,
      count: 10,
      lastUpdate: now,
      metadata: {}
    };

    // Window should have expired, counter should reset
    const result = await algorithm.check(state, { identifier: 'test' });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('should handle weighted requests', async () => {
    const result = await algorithm.checkWithWeight(
      null,
      { identifier: 'test' },
      5
    );
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5);
  });

  it('should calculate time until next window', () => {
    const timeUntilNext = algorithm.getTimeUntilNextWindow();
    expect(timeUntilNext).toBeGreaterThan(0);
    expect(timeUntilNext).toBeLessThanOrEqual(1000);
  });

  it('should get window statistics', () => {
    const stats = algorithm.getWindowStats(null);
    expect(stats.count).toBe(0);
    expect(stats.progress).toBeGreaterThanOrEqual(0);
    expect(stats.progress).toBeLessThanOrEqual(1);
  });

  it('should reset state correctly', () => {
    const state = algorithm.reset();
    expect(state.count).toBe(0);
  });
});
