/**
 * Tests for Rate Limiting Algorithms
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TokenBucketAlgorithm,
  SlidingWindowAlgorithm,
  FixedWindowAlgorithm,
  LeakyBucketAlgorithm,
  RateLimitAlgorithmFactory,
  HybridRateLimiter,
} from './algorithms';

describe('TokenBucketAlgorithm', () => {
  let algorithm: TokenBucketAlgorithm;

  beforeEach(() => {
    algorithm = new TokenBucketAlgorithm(10, 1); // 10 capacity, 1 token/sec
  });

  it('should allow requests within capacity', async () => {
    const decision1 = await algorithm.check('user1', 1);
    expect(decision1.allowed).toBe(true);
    expect(decision1.remaining).toBe(9);

    const decision2 = await algorithm.check('user1', 5);
    expect(decision2.allowed).toBe(true);
    expect(decision2.remaining).toBe(4);
  });

  it('should block requests exceeding capacity', async () => {
    await algorithm.check('user1', 10);
    const decision = await algorithm.check('user1', 1);
    expect(decision.allowed).toBe(false);
    expect(decision.remaining).toBe(0);
  });

  it('should refill tokens over time', async () => {
    // Use all tokens
    await algorithm.check('user1', 10);
    const decision1 = await algorithm.check('user1', 1);
    expect(decision1.allowed).toBe(false);

    // Wait for refill (simulate with time manipulation)
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2000);

    const decision2 = await algorithm.check('user1', 1);
    expect(decision2.allowed).toBe(true);
  });

  it('should handle burst configuration', async () => {
    const burstAlgorithm = new TokenBucketAlgorithm(10, 1, 5); // 5 burst

    const decision = await burstAlgorithm.check('user1', 12);
    expect(decision.allowed).toBe(true);
    expect(decision.remaining).toBeGreaterThanOrEqual(0);
  });

  it('should reset correctly', async () => {
    await algorithm.check('user1', 10);
    await algorithm.reset('user1');

    const decision = await algorithm.check('user1', 10);
    expect(decision.allowed).toBe(true);
  });

  it('should provide accurate state', async () => {
    await algorithm.check('user1', 5);
    const state = await algorithm.getState('user1');

    expect(state).not.toBeNull();
    expect(state?.tokens).toBeLessThan(10);
  });
});

describe('SlidingWindowAlgorithm', () => {
  let algorithm: SlidingWindowAlgorithm;

  beforeEach(() => {
    algorithm = new SlidingWindowAlgorithm(10, 60000); // 10 requests per minute
  });

  it('should allow requests within limit', async () => {
    for (let i = 0; i < 10; i++) {
      const decision = await algorithm.check('user1');
      expect(decision.allowed).toBe(true);
    }
  });

  it('should block requests exceeding limit', async () => {
    for (let i = 0; i < 10; i++) {
      await algorithm.check('user1');
    }

    const decision = await algorithm.check('user1');
    expect(decision.allowed).toBe(false);
    expect(decision.remaining).toBe(0);
  });

  it('should slide window correctly', async () => {
    // Make 10 requests
    for (let i = 0; i < 10; i++) {
      await algorithm.check('user1');
    }

    // Wait for window to slide (simulate time passing)
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);

    // Should now allow requests again
    const decision = await algorithm.check('user1');
    expect(decision.allowed).toBe(true);
  });

  it('should track requests accurately', async () => {
    await algorithm.check('user1');
    await algorithm.check('user1');

    const count = await algorithm.getCount('user1');
    expect(count).toBe(2);
  });

  it('should provide accurate statistics', async () => {
    await algorithm.check('user1');
    await algorithm.check('user1');

    const stats = await algorithm.getStats('user1');
    expect(stats.count).toBe(2);
    expect(stats.maxRequests).toBe(10);
    expect(stats.remaining).toBe(8);
  });

  it('should reset correctly', async () => {
    for (let i = 0; i < 10; i++) {
      await algorithm.check('user1');
    }

    await algorithm.reset('user1');

    const decision = await algorithm.check('user1');
    expect(decision.allowed).toBe(true);
  });
});

describe('FixedWindowAlgorithm', () => {
  let algorithm: FixedWindowAlgorithm;

  beforeEach(() => {
    algorithm = new FixedWindowAlgorithm(10, 60000); // 10 requests per minute
  });

  it('should allow requests within window', async () => {
    for (let i = 0; i < 10; i++) {
      const decision = await algorithm.check('user1');
      expect(decision.allowed).toBe(true);
    }
  });

  it('should block requests exceeding window limit', async () => {
    for (let i = 0; i < 10; i++) {
      await algorithm.check('user1');
    }

    const decision = await algorithm.check('user1');
    expect(decision.allowed).toBe(false);
  });

  it('should reset at window boundary', async () => {
    // Use all requests
    for (let i = 0; i < 10; i++) {
      await algorithm.check('user1');
    }

    // Move to next window
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);

    const decision = await algorithm.check('user1');
    expect(decision.allowed).toBe(true);
  });

  it('should handle multiple users independently', async () => {
    // User 1 uses all requests
    for (let i = 0; i < 10; i++) {
      await algorithm.check('user1');
    }

    // User 2 should still have requests
    const decision = await algorithm.check('user2');
    expect(decision.allowed).toBe(true);
  });
});

describe('LeakyBucketAlgorithm', () => {
  let algorithm: LeakyBucketAlgorithm;

  beforeEach(() => {
    algorithm = new LeakyBucketAlgorithm(10, 1); // 10 capacity, 1 leak/sec
  });

  it('should allow requests within capacity', async () => {
    for (let i = 0; i < 10; i++) {
      const decision = await algorithm.check('user1');
      expect(decision.allowed).toBe(true);
    }
  });

  it('should block requests when bucket is full', async () => {
    for (let i = 0; i < 10; i++) {
      await algorithm.check('user1');
    }

    const decision = await algorithm.check('user1');
    expect(decision.allowed).toBe(false);
  });

  it('should leak over time', async () => {
    // Fill bucket
    for (let i = 0; i < 10; i++) {
      await algorithm.check('user1');
    }

    // Wait for leak
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2000);

    const decision = await algorithm.check('user1');
    expect(decision.allowed).toBe(true);
  });
});

describe('RateLimitAlgorithmFactory', () => {
  it('should create token bucket algorithm', () => {
    const algorithm = RateLimitAlgorithmFactory.create(
      'token-bucket',
      60,
      60000
    );

    expect(algorithm).toBeInstanceOf(TokenBucketAlgorithm);
  });

  it('should create sliding window algorithm', () => {
    const algorithm = RateLimitAlgorithmFactory.create(
      'sliding-window',
      60,
      60000
    );

    expect(algorithm).toBeInstanceOf(SlidingWindowAlgorithm);
  });

  it('should create fixed window algorithm', () => {
    const algorithm = RateLimitAlgorithmFactory.create(
      'fixed-window',
      60,
      60000
    );

    expect(algorithm).toBeInstanceOf(FixedWindowAlgorithm);
  });

  it('should create leaky bucket algorithm', () => {
    const algorithm = RateLimitAlgorithmFactory.create(
      'leaky-bucket',
      60,
      60000
    );

    expect(algorithm).toBeInstanceOf(LeakyBucketAlgorithm);
  });

  it('should create token bucket for RPM', () => {
    const algorithm = RateLimitAlgorithmFactory.createTokenBucketRPM(100);
    expect(algorithm).toBeInstanceOf(TokenBucketAlgorithm);
  });

  it('should create sliding window for RPM', () => {
    const algorithm = RateLimitAlgorithmFactory.createSlidingWindowRPM(100);
    expect(algorithm).toBeInstanceOf(SlidingWindowAlgorithm);
  });

  it('should create fixed window for RPM', () => {
    const algorithm = RateLimitAlgorithmFactory.createFixedWindowRPM(100);
    expect(algorithm).toBeInstanceOf(FixedWindowAlgorithm);
  });

  it('should throw error for unknown algorithm', () => {
    expect(() => {
      RateLimitAlgorithmFactory.create(
        'unknown' as any,
        60,
        60000
      );
    }).toThrow();
  });
});

describe('HybridRateLimiter', () => {
  it('should check both algorithms', async () => {
    const limiter = new HybridRateLimiter('token-bucket', 10, 60000);

    const decision = await limiter.check('user1');
    expect(decision.allowed).toBe(true);
  });

  it('should block if primary algorithm blocks', async () => {
    const limiter = new HybridRateLimiter('token-bucket', 5, 60000);

    // Use up primary limit
    for (let i = 0; i < 5; i++) {
      await limiter.check('user1');
    }

    const decision = await limiter.check('user1');
    expect(decision.allowed).toBe(false);
  });

  it('should block if secondary algorithm blocks', async () => {
    const limiter = new HybridRateLimiter('sliding-window', 10, 60000);

    // Secondary has 2x limit, so need to use more
    for (let i = 0; i < 20; i++) {
      await limiter.check('user1');
    }

    const decision = await limiter.check('user1');
    expect(decision.allowed).toBe(false);
  });

  it('should reset both algorithms', async () => {
    const limiter = new HybridRateLimiter('token-bucket', 10, 60000);

    await limiter.check('user1');
    await limiter.reset('user1');

    const decision = await limiter.check('user1');
    expect(decision.allowed).toBe(true);
  });
});
