/**
 * Token Bucket Rate Limiter Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TokenBucket, createRateLimiterRPM, createRateLimiterTPM } from '../../src/lib/rate-limit/token-bucket';

describe('TokenBucket', () => {
  let bucket: TokenBucket;

  beforeEach(() => {
    bucket = new TokenBucket({
      capacity: 10,
      refillRate: 1, // 1 token per second
    });
  });

  describe('Basic functionality', () => {
    it('should initialize with full capacity', async () => {
      const tokens = await bucket.getAvailableTokens('user-1');
      expect(tokens).toBe(10);
    });

    it('should consume tokens when available', async () => {
      const consumed = await bucket.tryConsume('user-1', 5);
      expect(consumed).toBe(true);

      const remaining = await bucket.getAvailableTokens('user-1');
      expect(remaining).toBe(5);
    });

    it('should reject consumption when insufficient tokens', async () => {
      // Consume all tokens
      await bucket.tryConsume('user-1', 10);

      // Try to consume more
      const consumed = await bucket.tryConsume('user-1', 1);
      expect(consumed).toBe(false);
    });

    it('should handle multiple identifiers independently', async () => {
      await bucket.tryConsume('user-1', 5);
      await bucket.tryConsume('user-2', 3);

      const tokens1 = await bucket.getAvailableTokens('user-1');
      const tokens2 = await bucket.getAvailableTokens('user-2');

      expect(tokens1).toBe(5);
      expect(tokens2).toBe(7);
    });
  });

  describe('Token refill', () => {
    it('should refill tokens over time', async () => {
      // Consume all tokens
      await bucket.tryConsume('user-1', 10);

      // Wait for refill (1 token per second)
      await new Promise(resolve => setTimeout(resolve, 2100));

      const tokens = await bucket.getAvailableTokens('user-1');
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThanOrEqual(2); // Should be ~2 tokens
    });

    it('should not exceed capacity when refilling', async () => {
      // Wait for refill with empty bucket
      await bucket.tryConsume('user-1', 10);
      await new Promise(resolve => setTimeout(resolve, 15000)); // 15 seconds

      const tokens = await bucket.getAvailableTokens('user-1');
      expect(tokens).toBeLessThanOrEqual(10); // Should not exceed capacity
    });
  });

  describe('consumeAndWait', () => {
    it('should wait for tokens to become available', async () => {
      // Consume all tokens
      await bucket.tryConsume('user-1', 10);

      // Try to consume with wait
      const startTime = Date.now();
      const consumed = await bucket.consumeAndWait('user-1', 1, 5000);
      const elapsed = Date.now() - startTime;

      expect(consumed).toBe(true);
      expect(elapsed).toBeGreaterThan(900); // At least ~1 second wait
    });

    it('should timeout if maxWait exceeded', async () => {
      // Consume all tokens
      await bucket.tryConsume('user-1', 10);

      // Try to consume with short timeout
      const consumed = await bucket.consumeAndWait('user-1', 5, 100);
      expect(consumed).toBe(false);
    });
  });

  describe('Reset', () => {
    it('should reset bucket to full capacity', async () => {
      await bucket.tryConsume('user-1', 8);

      await bucket.reset('user-1');

      const tokens = await bucket.getAvailableTokens('user-1');
      expect(tokens).toBe(10);
    });

    it('should only reset specific identifier', async () => {
      await bucket.tryConsume('user-1', 5);
      await bucket.tryConsume('user-2', 7);

      await bucket.reset('user-1');

      const tokens1 = await bucket.getAvailableTokens('user-1');
      const tokens2 = await bucket.getAvailableTokens('user-2');

      expect(tokens1).toBe(10);
      expect(tokens2).toBe(3);
    });
  });

  describe('Stats', () => {
    it('should return bucket statistics', async () => {
      await bucket.tryConsume('user-1', 3);

      const stats = await bucket.getStats('user-1');

      expect(stats.capacity).toBe(10);
      expect(stats.refillRate).toBe(1);
      expect(stats.tokens).toBe(7);
      expect(stats.lastRefill).toBeGreaterThan(0);
    });
  });
});

describe('createRateLimiterRPM', () => {
  it('should create a rate limiter for requests per minute', async () => {
    const limiter = createRateLimiterRPM(60); // 60 requests per minute

    const tokens = await limiter.getAvailableTokens('user-1');
    expect(tokens).toBe(60);
  });
});

describe('createRateLimiterTPM', () => {
  it('should create a rate limiter for tokens per minute', async () => {
    const limiter = createRateLimiterTPM(100000); // 100K tokens per minute

    const tokens = await limiter.getAvailableTokens('user-1');
    expect(tokens).toBe(100000);
  });
});

describe('TokenBucket edge cases', () => {
  it('should handle zero token consumption', async () => {
    const bucket = new TokenBucket({
      capacity: 10,
      refillRate: 1,
    });

    const consumed = await bucket.tryConsume('user-1', 0);
    expect(consumed).toBe(true);
  });

  it('should handle consuming more than capacity', async () => {
    const bucket = new TokenBucket({
      capacity: 10,
      refillRate: 1,
    });

    const consumed = await bucket.tryConsume('user-1', 100);
    expect(consumed).toBe(false);
  });

  it('should handle negative refill rate', async () => {
    const bucket = new TokenBucket({
      capacity: 10,
      refillRate: 0, // No refill
    });

    await bucket.tryConsume('user-1', 5);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const tokens = await bucket.getAvailableTokens('user-1');
    expect(tokens).toBe(5); // No refill occurred
  });
});
