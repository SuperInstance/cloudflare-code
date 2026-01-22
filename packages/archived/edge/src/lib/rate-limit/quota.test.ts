/**
 * Tests for Quota Manager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuotaManager, createQuotaManager } from './quota';
import type { SubscriptionTier, QuotaType } from './types';

describe('QuotaManager', () => {
  let manager: QuotaManager;

  beforeEach(() => {
    manager = new QuotaManager({
      enableTracking: true,
      enableSoftLimits: true,
      enableOverage: true,
    });
  });

  describe('Request Quota', () => {
    it('should allow requests within quota', async () => {
      const result = await manager.checkQuota('user1', 'free');
      expect(result.allowed).toBe(true);
    });

    it('should block requests exceeding quota', async () => {
      // Free tier: 60 requests per minute
      for (let i = 0; i < 60; i++) {
        await manager.recordUsage('user1', 'free');
      }

      const result = await manager.checkQuota('user1', 'free');
      expect(result.allowed).toBe(false);
      expect(result.blockedBy).toBe('requests');
    });

    it('should track concurrent requests', async () => {
      await manager.recordUsage('user1', 'free', 0, 0, 1);
      await manager.recordUsage('user1', 'free', 0, 0, 1);

      const state = await manager['getState']('user1', 'free');
      expect(state.concurrentRequests).toBe(2);
    });

    it('should release concurrent requests', async () => {
      await manager.recordUsage('user1', 'free', 0, 0, 1);
      await manager.releaseConcurrent('user1', 'free');

      const state = await manager['getState']('user1', 'free');
      expect(state.concurrentRequests).toBe(0);
    });
  });

  describe('Token Quota', () => {
    it('should track token usage', async () => {
      await manager.recordUsage('user1', 'free', 0, 1000);

      const quotas = await manager.getAllQuotas('user1', 'free');
      const tokenQuota = quotas.get('tokens');

      expect(tokenQuota?.used).toBe(1000);
    });

    it('should block when token quota exceeded', async () => {
      // Free tier: 10000 tokens per day
      await manager.recordUsage('user1', 'free', 0, 10000);

      const result = await manager.checkQuota('user1', 'free', 0, 1000);
      expect(result.allowed).toBe(false);
      expect(result.blockedBy).toBe('tokens');
    });
  });

  describe('Cost Quota', () => {
    it('should track cost usage', async () => {
      await manager.recordUsage('user1', 'free', 5.0);

      const quotas = await manager.getAllQuotas('user1', 'free');
      const costQuota = quotas.get('cost');

      expect(costQuota?.used).toBe(5.0);
    });

    it('should block when cost quota exceeded', async () => {
      // Free tier: $10 per month
      await manager.recordUsage('user1', 'free', 10.0);

      const result = await manager.checkQuota('user1', 'free', 1.0);
      expect(result.allowed).toBe(false);
      expect(result.blockedBy).toBe('cost');
    });

    it('should allow overage for pro tier', async () => {
      const proManager = new QuotaManager({
        enableOverage: true,
      });

      await proManager.recordUsage('user1', 'pro', 100.0);

      const result = await proManager.checkQuota('user1', 'pro', 1.0);
      expect(result.overageAvailable).toBe(true);
    });
  });

  describe('Soft Limits', () => {
    it('should warn when soft limit exceeded', async () => {
      // Free tier soft limit: 80% of 60 = 48 requests
      for (let i = 0; i < 50; i++) {
        await manager.recordUsage('user1', 'free');
      }

      const result = await manager.checkQuota('user1', 'free');
      expect(result.softLimitExceeded).toBe(true);
    });
  });

  describe('Quota Status', () => {
    it('should provide quota status', async () => {
      await manager.recordUsage('user1', 'free', 0, 100);

      const status = await manager.getQuotaStatus('user1', 'free');
      expect(status.identifier).toBe('user1');
      expect(status.tier).toBe('free');
      expect(status.used).toBeGreaterThan(0);
    });

    it('should calculate usage percentage', async () => {
      for (let i = 0; i < 30; i++) {
        await manager.recordUsage('user1', 'free');
      }

      const status = await manager.getQuotaStatus('user1', 'free');
      expect(status.usagePercent).toBeGreaterThan(0);
      expect(status.usagePercent).toBeLessThanOrEqual(100);
    });

    it('should indicate when quota is exhausted', async () => {
      for (let i = 0; i < 60; i++) {
        await manager.recordUsage('user1', 'free');
      }

      const status = await manager.getQuotaStatus('user1', 'free');
      expect(status.isExhausted).toBe(true);
    });
  });

  describe('All Quotas', () => {
    it('should return all quota types', async () => {
      await manager.recordUsage('user1', 'free', 5.0, 1000);

      const quotas = await manager.getAllQuotas('user1', 'free');

      expect(quotas.has('requests')).toBe(true);
      expect(quotas.has('tokens')).toBe(true);
      expect(quotas.has('cost')).toBe(true);
      expect(quotas.has('concurrent')).toBe(true);
    });

    it('should provide remaining for each quota type', async () => {
      const quotas = await manager.getAllQuotas('user1', 'free');

      for (const [type, quota] of quotas.entries()) {
        expect(quota.remaining).toBeGreaterThanOrEqual(0);
        expect(quota.limit).toBeGreaterThan(0);
      }
    });
  });

  describe('Tier Management', () => {
    it('should handle different tiers', async () => {
      const freeResult = await manager.checkQuota('user1', 'free');
      const proResult = await manager.checkQuota('user1', 'pro');
      const enterpriseResult = await manager.checkQuota('user1', 'enterprise');

      expect(freeResult.status.limit).toBeLessThan(proResult.status.limit);
      expect(proResult.status.limit).toBeLessThan(enterpriseResult.status.limit);
    });

    it('should change tier for user', async () => {
      await manager.recordUsage('user1', 'free');
      await manager.changeTier('user1', 'free', 'pro');

      const status = await manager.getQuotaStatus('user1', 'pro');
      expect(status.tier).toBe('pro');
    });
  });

  describe('Reset', () => {
    it('should reset specific quota type', async () => {
      await manager.recordUsage('user1', 'free');
      await manager.resetQuota('user1', 'requests');

      const result = await manager.checkQuota('user1', 'free');
      expect(result.allowed).toBe(true);
    });

    it('should reset all quotas', async () => {
      await manager.recordUsage('user1', 'free', 5.0, 1000);
      await manager.resetAllQuotas('user1');

      const quotas = await manager.getAllQuotas('user1', 'free');
      for (const quota of quotas.values()) {
        expect(quota.used).toBe(0);
      }
    });
  });

  describe('Custom Configuration', () => {
    it('should accept custom quota configuration', () => {
      const customManager = new QuotaManager({
        defaultQuotas: {
          free: [
            {
              type: 'requests',
              limit: 100,
              period: 'minute',
            },
          ],
        },
      });

      expect(customManager).toBeInstanceOf(QuotaManager);
    });

    it('should set tier configuration', () => {
      manager.setTierConfig('free', {
        tier: 'free',
        requestsPerMinute: 100,
        burst: 20,
        monthlyCostLimit: 20,
      });

      const config = manager.getQuotaConfig('free', 'requests');
      expect(config).toBeDefined();
    });
  });

  describe('Period Management', () => {
    it('should reset quota when period expires', async () => {
      // Record usage
      for (let i = 0; i < 60; i++) {
        await manager.recordUsage('user1', 'free');
      }

      // Simulate time passing to next period
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61000);

      const result = await manager.checkQuota('user1', 'free');
      expect(result.allowed).toBe(true);
    });
  });
});

describe('createQuotaManager', () => {
  it('should create manager with default options', () => {
    const manager = createQuotaManager();
    expect(manager).toBeInstanceOf(QuotaManager);
  });

  it('should create manager with custom options', () => {
    const manager = createQuotaManager({
      enableSoftLimits: false,
      enableOverage: false,
    });

    expect(manager).toBeInstanceOf(QuotaManager);
  });
});
