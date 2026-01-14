/**
 * Tests for Rate Limit Manager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimitManager, createRateLimitManager } from './manager';
import type { RateLimitScope, SubscriptionTier } from './types';

describe('RateLimitManager', () => {
  let manager: RateLimitManager;

  beforeEach(() => {
    manager = new RateLimitManager({
      enableDistributed: false,
      enableAnalytics: true,
    });
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const result = await manager.checkLimit(
        'user1',
        'user',
        'free'
      );

      expect(result.decision.allowed).toBe(true);
      expect(result.decision.remaining).toBeGreaterThan(0);
    });

    it('should block requests exceeding limit', async () => {
      // Free tier: 60 requests per minute
      for (let i = 0; i < 60; i++) {
        await manager.checkLimit('user1', 'user', 'free');
      }

      const result = await manager.checkLimit('user1', 'user', 'free');
      expect(result.decision.allowed).toBe(false);
    });

    it('should provide accurate remaining count', async () => {
      const result1 = await manager.checkLimit('user1', 'user', 'free');
      expect(result1.decision.remaining).toBe(59);

      const result2 = await manager.checkLimit('user1', 'user', 'free');
      expect(result2.decision.remaining).toBe(58);
    });
  });

  describe('Tier-based Limits', () => {
    it('should enforce free tier limits', async () => {
      // Free tier: 60 requests per minute
      for (let i = 0; i < 60; i++) {
        await manager.checkLimit('user1', 'user', 'free');
      }

      const result = await manager.checkLimit('user1', 'user', 'free');
      expect(result.decision.allowed).toBe(false);
    });

    it('should enforce pro tier limits', async () => {
      // Pro tier: 600 requests per minute
      for (let i = 0; i < 600; i++) {
        await manager.checkLimit('user1', 'user', 'pro');
      }

      const result = await manager.checkLimit('user1', 'user', 'pro');
      expect(result.decision.allowed).toBe(false);
    });

    it('should enforce enterprise tier limits', async () => {
      // Enterprise tier: 6000 requests per minute
      for (let i = 0; i < 100; i++) {
        const result = await manager.checkLimit('user1', 'user', 'enterprise');
        expect(result.decision.allowed).toBe(true);
      }
    });
  });

  describe('Hierarchical Limits', () => {
    it('should check multiple scopes', async () => {
      const decision = await manager.checkHierarchicalLimits(
        '127.0.0.1',
        'user1',
        'org1',
        'free'
      );

      expect(decision.allowed).toBe(true);
    });

    it('should enforce IP-level limits', async () => {
      // IP limit is most restrictive
      for (let i = 0; i < 60; i++) {
        await manager.checkLimit('127.0.0.1', 'ip', 'free');
      }

      const result = await manager.checkHierarchicalLimits(
        '127.0.0.1',
        'user1',
        'org1',
        'free'
      );

      expect(result.allowed).toBe(false);
    });

    it('should check in correct priority order', async () => {
      // Global > Org > User > IP
      const scopes: RateLimitScope[] = ['global', 'organization', 'user', 'ip'];

      for (const scope of scopes) {
        const result = await manager.checkLimit('test', scope, 'free');
        expect(result.decision).toBeDefined();
      }
    });
  });

  describe('Endpoint-specific Limits', () => {
    it('should apply /api/chat limits', async () => {
      // Free tier: 10 requests per minute for /api/chat
      for (let i = 0; i < 10; i++) {
        const result = await manager.checkLimit(
          'user1',
          'user',
          'free',
          '/api/chat',
          'POST'
        );
        expect(result.decision.allowed).toBe(true);
      }

      const result = await manager.checkLimit(
        'user1',
        'user',
        'free',
        '/api/chat',
        'POST'
      );
      expect(result.decision.allowed).toBe(false);
    });

    it('should apply /api/code limits', async () => {
      // Free tier: 5 requests per minute for /api/code
      for (let i = 0; i < 5; i++) {
        const result = await manager.checkLimit(
          'user1',
          'user',
          'free',
          '/api/code',
          'POST'
        );
        expect(result.decision.allowed).toBe(true);
      }

      const result = await manager.checkLimit(
        'user1',
        'user',
        'free',
        '/api/code',
        'POST'
      );
      expect(result.decision.allowed).toBe(false);
    });

    it('should apply different limits for pro tier', async () => {
      // Pro tier: 100 requests per minute for /api/chat
      for (let i = 0; i < 100; i++) {
        const result = await manager.checkLimit(
          'user1',
          'user',
          'pro',
          '/api/chat',
          'POST'
        );
        expect(result.decision.allowed).toBe(true);
      }
    });
  });

  describe('Burst Handling', () => {
    it('should allow burst traffic', async () => {
      manager.setBurstConfig({
        enabled: true,
        burstSize: 10,
        burstDuration: 10000,
        recoveryRate: 1,
        cooldownPeriod: 30000,
      });

      // Should allow burst + capacity
      for (let i = 0; i < 70; i++) { // 60 + 10 burst
        const result = await manager.checkLimit('user1', 'user', 'free');
        expect(result.decision.allowed).toBe(true);
      }

      const result = await manager.checkLimit('user1', 'user', 'free');
      expect(result.decision.allowed).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should track statistics', async () => {
      await manager.checkLimit('user1', 'user', 'free');
      await manager.checkLimit('user1', 'user', 'free');

      const stats = manager.getStats('user1');
      expect(stats).toBeDefined();
      expect(stats?.totalRequests).toBe(2);
      expect(stats?.allowedRequests).toBe(2);
    });

    it('should track blocked requests', async () => {
      for (let i = 0; i < 65; i++) {
        await manager.checkLimit('user1', 'user', 'free');
      }

      const stats = manager.getStats('user1');
      expect(stats?.blockedRequests).toBeGreaterThan(0);
    });

    it('should calculate allow rate', async () => {
      for (let i = 0; i < 60; i++) {
        await manager.checkLimit('user1', 'user', 'free');
      }

      const stats = manager.getStats('user1');
      expect(stats?.allowRate).toBe(100);
    });
  });

  describe('Events', () => {
    it('should log rate limit events', async () => {
      await manager.checkLimit('user1', 'user', 'free');

      const events = manager.getEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('allow');
    });

    it('should log block events', async () => {
      for (let i = 0; i < 65; i++) {
        await manager.checkLimit('user1', 'user', 'free');
      }

      const events = manager.getEvents();
      const blockEvents = events.filter(e => e.type === 'block');
      expect(blockEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Custom Rules', () => {
    it('should add custom rule', () => {
      manager.addRule({
        id: 'custom-rule-1',
        name: 'Custom Rule',
        scope: 'user',
        config: {
          maxRequests: 100,
          windowMs: 60000,
          scope: 'user',
        },
        enabled: true,
        priority: 50,
      });

      const result = manager.checkLimit('user1', 'user', 'free');
      expect(result).resolves.toBeDefined();
    });

    it('should remove custom rule', () => {
      manager.addRule({
        id: 'custom-rule-1',
        name: 'Custom Rule',
        scope: 'user',
        config: {
          maxRequests: 100,
          windowMs: 60000,
          scope: 'user',
        },
        enabled: true,
        priority: 50,
      });

      const removed = manager.removeRule('custom-rule-1');
      expect(removed).toBe(true);
    });
  });

  describe('Reset', () => {
    it('should reset rate limit for identifier', async () => {
      for (let i = 0; i < 60; i++) {
        await manager.checkLimit('user1', 'user', 'free');
      }

      await manager.reset('user1', 'user');

      const result = await manager.checkLimit('user1', 'user', 'free');
      expect(result.decision.allowed).toBe(true);
    });

    it('should reset all rate limits', async () => {
      await manager.checkLimit('user1', 'user', 'free');
      await manager.checkLimit('user2', 'user', 'free');

      await manager.resetAll();

      const result1 = await manager.checkLimit('user1', 'user', 'free');
      const result2 = await manager.checkLimit('user2', 'user', 'free');

      expect(result1.decision.allowed).toBe(true);
      expect(result2.decision.allowed).toBe(true);
    });
  });

  describe('Tier Configuration', () => {
    it('should update tier configuration', () => {
      manager.updateTier('free', {
        requestsPerMinute: 100,
        burst: 20,
      });

      const result = manager.checkLimit('user1', 'user', 'free');
      expect(result).resolves.toBeDefined();
    });
  });
});

describe('createRateLimitManager', () => {
  it('should create manager with default options', () => {
    const manager = createRateLimitManager();
    expect(manager).toBeInstanceOf(RateLimitManager);
  });

  it('should create manager with custom options', () => {
    const manager = createRateLimitManager({
      defaultAlgorithm: 'sliding-window',
      enableAnalytics: false,
    });

    expect(manager).toBeInstanceOf(RateLimitManager);
  });
});
