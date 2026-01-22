/**
 * Tests for rate limiter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from '../rate/limiter';
import type { RateLimit, NotificationChannelType } from '../types';

describe('Rate Limiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      enablePriority: true,
      enableBursting: true,
      defaultStrategy: 'sliding_window',
    });
  });

  describe('addLimit', () => {
    it('should add a rate limit', () => {
      const limit: RateLimit = {
        id: 'limit-1',
        identifier: 'user-1',
        channel: 'email',
        strategy: 'sliding_window',
        limit: 100,
        windowMs: 3600000,
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      limiter.addLimit(limit);
      expect(limiter.getLimit('user-1', 'email')).toBe(limit);
    });
  });

  describe('removeLimit', () => {
    it('should remove a rate limit', () => {
      const limit: RateLimit = {
        id: 'limit-1',
        identifier: 'user-1',
        channel: 'email',
        strategy: 'sliding_window',
        limit: 100,
        windowMs: 3600000,
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      limiter.addLimit(limit);
      expect(limiter.removeLimit('user-1', 'email')).toBe(true);
      expect(limiter.getLimit('user-1', 'email')).toBeUndefined();
    });
  });

  describe('check', () => {
    it('should allow requests within limit', async () => {
      const limit: RateLimit = {
        id: 'limit-1',
        identifier: 'user-1',
        channel: 'email',
        strategy: 'fixed_window',
        limit: 10,
        windowMs: 60000,
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      limiter.addLimit(limit);

      const check1 = await limiter.check('user-1', 'email');
      expect(check1.allowed).toBe(true);
      expect(check1.remaining).toBe(9);

      const check2 = await limiter.check('user-1', 'email');
      expect(check2.allowed).toBe(true);
      expect(check2.remaining).toBe(8);
    });

    it('should deny requests exceeding limit', async () => {
      const limit: RateLimit = {
        id: 'limit-1',
        identifier: 'user-1',
        channel: 'email',
        strategy: 'fixed_window',
        limit: 2,
        windowMs: 60000,
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      limiter.addLimit(limit);

      await limiter.check('user-1', 'email');
      await limiter.check('user-1', 'email');

      const check3 = await limiter.check('user-1', 'email');
      expect(check3.allowed).toBe(false);
      expect(check3.remaining).toBe(0);
      expect(check3.retryAfter).toBeDefined();
    });

    it('should adjust limit based on priority', async () => {
      const limit: RateLimit = {
        id: 'limit-1',
        identifier: 'user-1',
        channel: 'email',
        strategy: 'fixed_window',
        limit: 10,
        windowMs: 60000,
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      limiter.addLimit(limit);

      const normalCheck = await limiter.check('user-1', 'email', 'normal');
      expect(normalCheck.remaining).toBe(9);

      const criticalCheck = await limiter.check('user-1', 'email', 'critical');
      // Critical should have 10x the limit
      expect(criticalCheck.remaining).toBeGreaterThan(9);
    });

    it('should handle token bucket strategy', async () => {
      const limit: RateLimit = {
        id: 'limit-1',
        identifier: 'user-1',
        channel: 'email',
        strategy: 'token_bucket',
        limit: 10,
        windowMs: 60000,
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      limiter.addLimit(limit);

      const check1 = await limiter.check('user-1', 'email');
      expect(check1.allowed).toBe(true);

      // Exhaust tokens
      for (let i = 0; i < 9; i++) {
        await limiter.check('user-1', 'email');
      }

      const checkExhausted = await limiter.check('user-1', 'email');
      expect(checkExhausted.allowed).toBe(false);
    });
  });

  describe('reserve', () => {
    it('should reserve capacity', async () => {
      const limit: RateLimit = {
        id: 'limit-1',
        identifier: 'user-1',
        channel: 'email',
        strategy: 'fixed_window',
        limit: 10,
        windowMs: 60000,
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      limiter.addLimit(limit);

      const reserved = await limiter.reserve('user-1', 'email', 5);
      expect(reserved.allowed).toBe(true);
      expect(reserved.remaining).toBeGreaterThanOrEqual(5);
    });

    it('should deny insufficient capacity', async () => {
      const limit: RateLimit = {
        id: 'limit-1',
        identifier: 'user-1',
        channel: 'email',
        strategy: 'fixed_window',
        limit: 10,
        windowMs: 60000,
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      limiter.addLimit(limit);

      const reserved = await limiter.reserve('user-1', 'email', 100);
      expect(reserved.allowed).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset rate limit state', async () => {
      const limit: RateLimit = {
        id: 'limit-1',
        identifier: 'user-1',
        channel: 'email',
        strategy: 'fixed_window',
        limit: 2,
        windowMs: 60000,
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      limiter.addLimit(limit);

      await limiter.check('user-1', 'email');
      await limiter.check('user-1', 'email');

      let check = await limiter.check('user-1', 'email');
      expect(check.allowed).toBe(false);

      limiter.reset('user-1', 'email');

      check = await limiter.check('user-1', 'email');
      expect(check.allowed).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return rate limit statistics', () => {
      const limit: RateLimit = {
        id: 'limit-1',
        identifier: 'user-1',
        channel: 'email',
        strategy: 'sliding_window',
        limit: 100,
        windowMs: 3600000,
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      limiter.addLimit(limit);

      const stats = limiter.getStats();
      expect(stats.totalLimits).toBe(1);
      expect(stats.channels).toContain('email');
      expect(stats.strategies).toContain('sliding_window');
    });
  });

  describe('checkMultiple', () => {
    it('should check multiple channels at once', async () => {
      const channels: NotificationChannelType[] = ['email', 'sms', 'push'];

      for (const channel of channels) {
        const limit: RateLimit = {
          id: `limit-${channel}`,
          identifier: 'user-1',
          channel,
          strategy: 'fixed_window',
          limit: 10,
          windowMs: 60000,
          priority: 'normal',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        limiter.addLimit(limit);
      }

      const results = await limiter.checkMultiple('user-1', channels, 'normal');

      expect(results.size).toBe(3);
      expect(results.get('email')?.allowed).toBe(true);
      expect(results.get('sms')?.allowed).toBe(true);
      expect(results.get('push')?.allowed).toBe(true);
    });
  });

  describe('updateLimit', () => {
    it('should update existing limit', () => {
      const limit: RateLimit = {
        id: 'limit-1',
        identifier: 'user-1',
        channel: 'email',
        strategy: 'sliding_window',
        limit: 100,
        windowMs: 3600000,
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      limiter.addLimit(limit);

      const updated: RateLimit = {
        ...limit,
        limit: 200,
        updatedAt: new Date(),
      };

      expect(limiter.updateLimit(updated)).toBe(true);

      const retrieved = limiter.getLimit('user-1', 'email');
      expect(retrieved?.limit).toBe(200);
    });

    it('should return false for non-existent limit', () => {
      const limit: RateLimit = {
        id: 'limit-1',
        identifier: 'user-1',
        channel: 'email',
        strategy: 'sliding_window',
        limit: 100,
        windowMs: 3600000,
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(limiter.updateLimit(limit)).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should clean up expired states', async () => {
      const limit: RateLimit = {
        id: 'limit-1',
        identifier: 'user-1',
        channel: 'email',
        strategy: 'fixed_window',
        limit: 10,
        windowMs: 1, // Very short window
        priority: 'normal',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      limiter.addLimit(limit);

      await limiter.check('user-1', 'email');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      limiter.cleanup();

      const stats = limiter.getStats();
      expect(stats.activeStates).toBe(0);
    });
  });
});
