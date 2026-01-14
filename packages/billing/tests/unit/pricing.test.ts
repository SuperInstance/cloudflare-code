/**
 * Unit tests for pricing system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PricingManager,
  PRICING_TIERS,
  OVERAGE_RATES,
  PlanType,
  BillingInterval,
} from '../../src/pricing/index.js';

describe('PricingManager', () => {
  let pricingManager: PricingManager;

  beforeEach(() => {
    pricingManager = new PricingManager();
  });

  describe('getTier', () => {
    it('should return the correct tier by ID', () => {
      const tier = pricingManager.getTier('plan_free');
      expect(tier).toBeDefined();
      expect(tier?.name).toBe('Free');
      expect(tier?.price).toBe(0);
    });

    it('should return undefined for non-existent tier', () => {
      const tier = pricingManager.getTier('plan_nonexistent');
      expect(tier).toBeUndefined();
    });
  });

  describe('getTierByPlan', () => {
    it('should return monthly pro tier', () => {
      const tier = pricingManager.getTierByPlan(PlanType.PRO, BillingInterval.MONTHLY);
      expect(tier).toBeDefined();
      expect(tier?.price).toBe(29);
      expect(tier?.interval).toBe(BillingInterval.MONTHLY);
    });

    it('should return yearly pro tier with discount', () => {
      const tier = pricingManager.getTierByPlan(PlanType.PRO, BillingInterval.YEARLY);
      expect(tier).toBeDefined();
      expect(tier?.price).toBe(278); // $29 * 12 * 0.8
      expect(tier?.interval).toBe(BillingInterval.YEARLY);
    });
  });

  describe('getAllTiers', () => {
    it('should return all pricing tiers', () => {
      const tiers = pricingManager.getAllTiers();
      expect(tiers.length).toBeGreaterThan(0);
      expect(tiers.some((t) => t.type === PlanType.FREE)).toBe(true);
      expect(tiers.some((t) => t.type === PlanType.PRO)).toBe(true);
      expect(tiers.some((t) => t.type === PlanType.TEAM)).toBe(true);
      expect(tiers.some((t) => t.type === PlanType.ENTERPRISE)).toBe(true);
    });
  });

  describe('calculateProration', () => {
    it('should calculate proration for upgrade', () => {
      const freeTier = PRICING_TIERS[PlanType.FREE];
      const proTier = PRICING_TIERS[PlanType.PRO];
      const daysInPeriod = 30;
      const daysRemaining = 15;

      const proration = pricingManager.calculateProration(
        freeTier,
        proTier,
        daysInPeriod,
        daysRemaining
      );

      expect(proration).toBeGreaterThan(0);
      expect(proration).toBe(proTier.price * (daysRemaining / daysInPeriod));
    });

    it('should calculate proration for downgrade', () => {
      const proTier = PRICING_TIERS[PlanType.PRO];
      const freeTier = PRICING_TIERS[PlanType.FREE];
      const daysInPeriod = 30;
      const daysRemaining = 15;

      const proration = pricingManager.calculateProration(
        proTier,
        freeTier,
        daysInPeriod,
        daysRemaining
      );

      expect(proration).toBeLessThan(0);
    });
  });

  describe('calculateOverageCost', () => {
    it('should calculate overage cost for requests', () => {
      const plan = PRICING_TIERS[PlanType.PRO];
      const usage = 15000; // 5000 over the limit
      const limit = plan.limits.requestsPerMonth;

      const cost = pricingManager.calculateOverageCost(
        PlanType.PRO,
        'requests',
        usage,
        limit
      );

      expect(cost).toBe(5000 * OVERAGE_RATES.requests);
    });

    it('should return zero for unlimited plans', () => {
      const enterpriseTier = PRICING_TIERS[PlanType.ENTERPRISE];
      const cost = pricingManager.calculateOverageCost(
        PlanType.ENTERPRISE,
        'requests',
        1000000,
        -1
      );

      expect(cost).toBe(0);
    });

    it('should return zero when under limit', () => {
      const plan = PRICING_TIERS[PlanType.PRO];
      const cost = pricingManager.calculateOverageCost(
        PlanType.PRO,
        'requests',
        1000,
        plan.limits.requestsPerMonth
      );

      expect(cost).toBe(0);
    });
  });

  describe('calculateTotalOverageCost', () => {
    it('should calculate total overage for all metrics', () => {
      const plan = PRICING_TIERS[PlanType.PRO];
      const usage = {
        requests: plan.limits.requestsPerMonth + 1000,
        tokens: plan.limits.tokensPerMonth + 10000,
        cpuTime: plan.limits.cpuTimePerMonth + 100,
        storage: plan.limits.storage + 1000000000,
        bandwidth: plan.limits.bandwidth + 1000000000,
        apiCalls: plan.limits.apiCallsPerMonth + 100,
      };

      const totalCost = pricingManager.calculateTotalOverageCost(plan, usage);
      expect(totalCost).toBeGreaterThan(0);
    });
  });

  describe('isUpgrade and isDowngrade', () => {
    it('should correctly identify upgrades', () => {
      expect(pricingManager.isUpgrade(PlanType.FREE, PlanType.PRO)).toBe(true);
      expect(pricingManager.isUpgrade(PlanType.PRO, PlanType.TEAM)).toBe(true);
      expect(pricingManager.isUpgrade(PlanType.TEAM, PlanType.ENTERPRISE)).toBe(true);
      expect(pricingManager.isUpgrade(PlanType.PRO, PlanType.FREE)).toBe(false);
    });

    it('should correctly identify downgrades', () => {
      expect(pricingManager.isDowngrade(PlanType.PRO, PlanType.FREE)).toBe(true);
      expect(pricingManager.isDowngrade(PlanType.TEAM, PlanType.PRO)).toBe(true);
      expect(pricingManager.isDowngrade(PlanType.FREE, PlanType.PRO)).toBe(false);
    });
  });

  describe('getRecommendedPlan', () => {
    it('should recommend free tier for low usage', () => {
      const usage = {
        requests: 50,
        tokens: 10000,
        cpuTime: 1000,
        storage: 500000000,
        bandwidth: 5000000000,
        apiCalls: 500,
      };

      const recommendation = pricingManager.getRecommendedPlan(usage);
      expect(recommendation.plan).toBe(PlanType.FREE);
      expect(recommendation.estimatedCost).toBe(0);
    });

    it('should recommend pro tier for moderate usage', () => {
      const usage = {
        requests: 5000,
        tokens: 1000000,
        cpuTime: 50000,
        storage: 50000000000,
        bandwidth: 500000000000,
        apiCalls: 50000,
      };

      const recommendation = pricingManager.getRecommendedPlan(usage);
      expect(recommendation.plan).toBe(PlanType.PRO);
      expect(recommendation.estimatedCost).toBeGreaterThan(0);
    });

    it('should recommend team tier for high usage', () => {
      const usage = {
        requests: 20000,
        tokens: 15000000,
        cpuTime: 200000,
        storage: 200000000000,
        bandwidth: 2000000000000,
        apiCalls: 200000,
      };

      const recommendation = pricingManager.getRecommendedPlan(usage);
      expect(recommendation.plan).toBe(PlanType.TEAM);
    });

    it('should recommend enterprise for very high usage', () => {
      const usage = {
        requests: 100000,
        tokens: 100000000,
        cpuTime: 1000000,
        storage: 1000000000000,
        bandwidth: 10000000000000,
        apiCalls: 1000000,
      };

      const recommendation = pricingManager.getRecommendedPlan(usage);
      expect(recommendation.plan).toBe(PlanType.ENTERPRISE);
    });
  });

  describe('comparePlans', () => {
    it('should compare free and pro plans', () => {
      const comparison = pricingManager.comparePlans(PlanType.FREE, PlanType.PRO);

      expect(comparison.priceDifference).toBe(29);
      expect(comparison.featureDifference.length).toBeGreaterThan(0);
      expect(comparison.limitDifference).toBeDefined();
    });
  });

  describe('custom tier management', () => {
    it('should add custom tier', () => {
      const customTier = {
        id: 'plan_custom',
        name: 'Custom',
        type: PlanType.ENTERPRISE,
        description: 'Custom plan',
        price: 199,
        interval: BillingInterval.MONTHLY,
        currency: 'USD',
        limits: {
          requestsPerDay: 100000,
          requestsPerMonth: 3000000,
          tokensPerMonth: 100000000,
          cpuTimePerMonth: 1000000,
          storage: 1073741824000,
          bandwidth: 10737418240000,
          apiCallsPerMonth: 1000000,
          seats: 50,
          projects: 500,
        },
        features: ['Custom feature 1', 'Custom feature 2'],
      };

      pricingManager.addCustomTier(customTier);
      const retrieved = pricingManager.getTier('plan_custom');
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Custom');
    });

    it('should update existing tier', () => {
      const updated = pricingManager.updateTier('plan_free', {
        description: 'Updated free tier',
      });

      expect(updated).toBe(true);

      const tier = pricingManager.getTier('plan_free');
      expect(tier?.description).toBe('Updated free tier');
    });

    it('should remove tier', () => {
      pricingManager.addCustomTier({
        id: 'plan_temporary',
        name: 'Temporary',
        type: PlanType.PRO,
        description: 'Temp',
        price: 10,
        interval: BillingInterval.MONTHLY,
        currency: 'USD',
        limits: {
          requestsPerDay: 100,
          requestsPerMonth: 3000,
          tokensPerMonth: 100000,
          cpuTimePerMonth: 3600,
          storage: 1073741824,
          bandwidth: 10737418240,
          apiCallsPerMonth: 1000,
          seats: 1,
          projects: 3,
        },
        features: [],
      });

      const removed = pricingManager.removeTier('plan_temporary');
      expect(removed).toBe(true);

      const tier = pricingManager.getTier('plan_temporary');
      expect(tier).toBeUndefined();
    });
  });
});
