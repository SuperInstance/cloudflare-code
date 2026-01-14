/**
 * Sliding Window Rate Limiter Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SlidingWindow, createRateLimiterRPM, createRateLimiterRPS } from '../../src/lib/rate-limit/sliding-window';

describe('SlidingWindow', () => {
  let limiter: SlidingWindow;

  beforeEach(() => {
    limiter = new SlidingWindow({
      maxRequests: 10,
      windowMs: 1000, // 1 second window
    });
  });

  describe('Basic functionality', () => {
    it('should allow requests within limit', async () => {
      for (let i = 0; i < 10; i++) {
        const allowed = await limiter.isAllowed('user-1');
        expect(allowed).toBe(true);
      }
    });

    it('should block requests when limit exceeded', async () => {
      // Consume all requests
      for (let i = 0; i < 10; i++) {
        await limiter.isAllowed('user-1');
      }

      // Next request should be blocked
      const allowed = await limiter.isAllowed('user-1');
      expect(allowed).toBe(false);
    });

    it('should handle multiple identifiers independently', async () => {
      for (let i = 0; i < 10; i++) {
        await limiter.isAllowed('user-1');
      }

      // Different identifier should still work
      const allowed = await limiter.isAllowed('user-2');
      expect(allowed).toBe(true);
    });
  });

  describe('Sliding window behavior', () => {
    it('should allow requests after old ones expire', async () => {
      // Consume all requests
      for (let i = 0; i < 10; i++) {
        await limiter.isAllowed('user-1');
      }

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should allow new requests
      const allowed = await limiter.isAllowed('user-1');
      expect(allowed).toBe(true);
    });

    it('should gradually recover as requests expire', async () => {
      // Consume all requests
      for (let i = 0; i < 10; i++) {
        await limiter.isAllowed('user-1');
      }

      // Wait for half the window
      await new Promise(resolve => setTimeout(resolve, 500));

      // Some requests should have expired, allowing new ones
      const allowed = await limiter.isAllowed('user-1');
      expect(allowed).toBe(true);
    });
  });

  describe('getCount', () => {
    it('should return current request count', async () => {
      await limiter.isAllowed('user-1');
      await limiter.isAllowed('user-1');
      await limiter.isAllowed('user-1');

      const count = await limiter.getCount('user-1');
      expect(count).toBe(3);
    });

    it('should only count requests within window', async () => {
      for (let i = 0; i < 10; i++) {
        await limiter.isAllowed('user-1');
      }

      await new Promise(resolve => setTimeout(resolve, 1100));

      const count = await limiter.getCount('user-1');
      expect(count).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return detailed statistics', async () => {
      await limiter.isAllowed('user-1');
      await limiter.isAllowed('user-1');

      const stats = await limiter.getStats('user-1');

      expect(stats.count).toBe(2);
      expect(stats.maxRequests).toBe(10);
      expect(stats.remaining).toBe(8);
      expect(stats.windowStart).toBeGreaterThan(0);
      expect(stats.windowEnd).toBeGreaterThan(stats.windowStart);
    });

    it('should calculate remaining correctly', async () => {
      for (let i = 0; i < 7; i++) {
        await limiter.isAllowed('user-1');
      }

      const stats = await limiter.getStats('user-1');
      expect(stats.remaining).toBe(3);
    });
  });

  describe('recordRequest', () => {
    it('should record request without checking limit', async () => {
      for (let i = 0; i < 15; i++) {
        await limiter.recordRequest('user-1');
      }

      const count = await limiter.getCount('user-1');
      expect(count).toBe(15);
    });
  });

  describe('reset', () => {
    it('should reset rate limit for identifier', async () => {
      for (let i = 0; i < 10; i++) {
        await limiter.isAllowed('user-1');
      }

      await limiter.reset('user-1');

      const allowed = await limiter.isAllowed('user-1');
      expect(allowed).toBe(true);
    });

    it('should only reset specific identifier', async () => {
      for (let i = 0; i < 10; i++) {
        await limiter.isAllowed('user-1');
      }
      await limiter.isAllowed('user-2');

      await limiter.reset('user-1');

      const allowed1 = await limiter.isAllowed('user-1');
      const allowed2 = await limiter.isAllowed('user-2');

      expect(allowed1).toBe(true);
      expect(allowed2).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should remove old entries from cache', async () => {
      await limiter.isAllowed('user-1');
      await new Promise(resolve => setTimeout(resolve, 2100));

      await limiter.cleanup();

      const count = await limiter.getCount('user-1');
      expect(count).toBe(0);
    });
  });
});

describe('createRateLimiterRPM', () => {
  it('should create a rate limiter for requests per minute', async () => {
    const limiter = createRateLimiterRPM(100);

    const stats = await limiter.getStats('user-1');
    expect(stats.maxRequests).toBe(100);
  });
});

describe('createRateLimiterRPS', () => {
  it('should create a rate limiter for requests per second', async () => {
    const limiter = createRateLimiterRPS(50);

    const stats = await limiter.getStats('user-1');
    expect(stats.maxRequests).toBe(50);
  });
});

describe('SlidingWindow edge cases', () => {
  it('should handle zero max requests', async () => {
    const limiter = new SlidingWindow({
      maxRequests: 0,
      windowMs: 1000,
    });

    const allowed = await limiter.isAllowed('user-1');
    expect(allowed).toBe(false);
  });

  it('should handle very short windows', async () => {
    const limiter = new SlidingWindow({
      maxRequests: 5,
      windowMs: 100,
    });

    for (let i = 0; i < 5; i++) {
      expect(await limiter.isAllowed('user-1')).toBe(true);
    }

    expect(await limiter.isAllowed('user-1')).toBe(false);

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(await limiter.isAllowed('user-1')).toBe(true);
  });

  it('should handle burst traffic correctly', async () => {
    const limiter = new SlidingWindow({
      maxRequests: 10,
      windowMs: 1000,
    });

    // Rapid fire requests
    const results: boolean[] = [];
    for (let i = 0; i < 15; i++) {
      results.push(await limiter.isAllowed('user-1'));
    }

    // First 10 should be allowed
    expect(results.slice(0, 10).every(r => r === true)).toBe(true);

    // Next 5 should be blocked
    expect(results.slice(10).every(r => r === false)).toBe(true);
  });
});
