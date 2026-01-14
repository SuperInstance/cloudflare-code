/**
 * Pricing tier definitions and management
 */

import {
  PricingTier,
  PlanType,
  BillingInterval,
  UsageLimits,
} from '../types/index.js';

/**
 * Standard pricing tiers for ClaudeFlare
 */
export const PRICING_TIERS: Record<PlanType, PricingTier> = {
  [PlanType.FREE]: {
    id: 'plan_free',
    name: 'Free',
    type: PlanType.FREE,
    description: 'Perfect for individuals and small projects',
    price: 0,
    interval: BillingInterval.MONTHLY,
    currency: 'USD',
    limits: {
      requestsPerDay: 100,
      requestsPerMonth: 3000,
      tokensPerMonth: 100000,
      cpuTimePerMonth: 3600, // 1 hour
      storage: 1073741824, // 1 GB
      bandwidth: 10737418240, // 10 GB
      apiCallsPerMonth: 1000,
      seats: 1,
      projects: 3,
    },
    features: [
      'Basic code generation',
      'Community support',
      'Rate limited access',
      'Standard AI models',
      'Web dashboard access',
    ],
    stripePriceId: 'price_free',
  },
  [PlanType.PRO]: {
    id: 'plan_pro_monthly',
    name: 'Pro',
    type: PlanType.PRO,
    description: 'For professional developers and growing teams',
    price: 29,
    interval: BillingInterval.MONTHLY,
    currency: 'USD',
    limits: {
      requestsPerDay: 10000,
      requestsPerMonth: 300000,
      tokensPerMonth: 10000000,
      cpuTimePerMonth: 180000, // 50 hours
      storage: 107374182400, // 100 GB
      bandwidth: 1073741824000, // 1 TB
      apiCallsPerMonth: 100000,
      seats: 5,
      projects: 20,
    },
    features: [
      'Advanced AI features',
      'Priority support',
      'Full API access',
      'Advanced AI models',
      'Custom fine-tuning',
      'Team collaboration',
      'Analytics dashboard',
      'Webhook integrations',
    ],
    stripePriceId: 'price_pro_monthly',
  },
  [PlanType.TEAM]: {
    id: 'plan_team_monthly',
    name: 'Team',
    type: PlanType.TEAM,
    description: 'For teams requiring advanced collaboration',
    price: 99,
    interval: BillingInterval.MONTHLY,
    currency: 'USD',
    limits: {
      requestsPerDay: 50000,
      requestsPerMonth: 1500000,
      tokensPerMonth: 50000000,
      cpuTimePerMonth: 720000, // 200 hours
      storage: 536870912000, // 500 GB
      bandwidth: 5368709120000, // 5 TB
      apiCallsPerMonth: 500000,
      seats: 20,
      projects: 100,
    },
    features: [
      'Everything in Pro',
      'Multi-user collaboration',
      'Team management',
      'Priority routing',
      'SSO authentication',
      'Advanced analytics',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantee (99.9%)',
      'Custom AI fine-tuning',
    ],
    stripePriceId: 'price_team_monthly',
  },
  [PlanType.ENTERPRISE]: {
    id: 'plan_enterprise_custom',
    name: 'Enterprise',
    type: PlanType.ENTERPRISE,
    description: 'Custom solutions for large organizations',
    price: 0, // Custom pricing
    interval: BillingInterval.MONTHLY,
    currency: 'USD',
    limits: {
      requestsPerDay: -1, // Unlimited
      requestsPerMonth: -1,
      tokensPerMonth: -1,
      cpuTimePerMonth: -1,
      storage: -1, // Unlimited
      bandwidth: -1,
      apiCallsPerMonth: -1,
      seats: -1,
      projects: -1,
    },
    features: [
      'Everything in Team',
      'Unlimited requests',
      'Custom AI models',
      'Dedicated support',
      'SLA guarantees (99.99%)',
      'On-premise options',
      'Custom contracts',
      'Volume discounts',
      'Account manager',
      'Training sessions',
      'Priority feature requests',
    ],
    stripePriceId: undefined, // Custom pricing
  },
};

/**
 * Yearly pricing tiers (with 20% discount)
 */
export const YEARLY_PRICING_TIERS: Record<PlanType, PricingTier> = {
  [PlanType.FREE]: {
    ...PRICING_TIERS[PlanType.FREE],
    id: 'plan_free_yearly',
  },
  [PlanType.PRO]: {
    ...PRICING_TIERS[PlanType.PRO],
    id: 'plan_pro_yearly',
    price: 278, // $29 * 12 * 0.8
    interval: BillingInterval.YEARLY,
    stripePriceId: 'price_pro_yearly',
  },
  [PlanType.TEAM]: {
    ...PRICING_TIERS[PlanType.TEAM],
    id: 'plan_team_yearly',
    price: 950, // $99 * 12 * 0.8
    interval: BillingInterval.YEARLY,
    stripePriceId: 'price_team_yearly',
  },
  [PlanType.ENTERPRISE]: {
    ...PRICING_TIERS[PlanType.ENTERPRISE],
    id: 'plan_enterprise_yearly',
  },
};

/**
 * Overage pricing for usage beyond limits
 */
export const OVERAGE_RATES = {
  requests: 0.0001, // $0.0001 per request
  tokens: 0.000001, // $0.000001 per token
  cpuTime: 0.01, // $0.01 per second
  storage: 0.1, // $0.1 per GB per month
  bandwidth: 0.02, // $0.02 per GB
  apiCalls: 0.001, // $0.001 per API call
  seats: 10, // $10 per additional seat per month
  projects: 1, // $1 per additional project per month
};

/**
 * Pricing manager class
 */
export class PricingManager {
  private tiers: Map<string, PricingTier>;

  constructor() {
    this.tiers = new Map();
    this.loadDefaultTiers();
  }

  /**
   * Load default pricing tiers
   */
  private loadDefaultTiers(): void {
    Object.values(PRICING_TIERS).forEach((tier) => {
      this.tiers.set(tier.id, tier);
    });
    Object.values(YEARLY_PRICING_TIERS).forEach((tier) => {
      this.tiers.set(tier.id, tier);
    });
  }

  /**
   * Get pricing tier by ID
   */
  getTier(id: string): PricingTier | undefined {
    return this.tiers.get(id);
  }

  /**
   * Get pricing tier by plan type and interval
   */
  getTierByPlan(planType: PlanType, interval: BillingInterval): PricingTier | undefined {
    const tiers = interval === BillingInterval.YEARLY ? YEARLY_PRICING_TIERS : PRICING_TIERS;
    return tiers[planType];
  }

  /**
   * Get all available pricing tiers
   */
  getAllTiers(): PricingTier[] {
    return Array.from(this.tiers.values());
  }

  /**
   * Get pricing tiers by interval
   */
  getTiersByInterval(interval: BillingInterval): PricingTier[] {
    return this.getAllTiers().filter((tier) => tier.interval === interval);
  }

  /**
   * Calculate proration for plan changes
   */
  calculateProration(
    currentPlan: PricingTier,
    newPlan: PricingTier,
    daysInPeriod: number,
    daysRemaining: number
  ): number {
    const dailyRateCurrent = currentPlan.price / daysInPeriod;
    const dailyRateNew = newPlan.price / daysInPeriod;
    const prorationAmount = (dailyRateNew - dailyRateCurrent) * daysRemaining;
    return Math.max(0, prorationAmount);
  }

  /**
   * Calculate overage cost
   */
  calculateOverageCost(
    planType: PlanType,
    usageType: keyof typeof OVERAGE_RATES,
    usageAmount: number,
    limit: number
  ): number {
    if (limit === -1) return 0; // Unlimited
    const overage = Math.max(0, usageAmount - limit);
    return overage * OVERAGE_RATES[usageType];
  }

  /**
   * Calculate total overage cost for all metrics
   */
  calculateTotalOverageCost(
    plan: PricingTier,
    usage: Record<keyof typeof OVERAGE_RATES, number>
  ): number {
    const { limits } = plan;
    let total = 0;

    total += this.calculateOverageCost(
      plan.type,
      'requests',
      usage.requests,
      limits.requestsPerMonth
    );
    total += this.calculateOverageCost(
      plan.type,
      'tokens',
      usage.tokens,
      limits.tokensPerMonth
    );
    total += this.calculateOverageCost(
      plan.type,
      'cpuTime',
      usage.cpuTime,
      limits.cpuTimePerMonth
    );
    total += this.calculateOverageCost(
      plan.type,
      'storage',
      usage.storage,
      limits.storage
    );
    total += this.calculateOverageCost(
      plan.type,
      'bandwidth',
      usage.bandwidth,
      limits.bandwidth
    );
    total += this.calculateOverageCost(
      plan.type,
      'apiCalls',
      usage.apiCalls,
      limits.apiCallsPerMonth
    );

    return total;
  }

  /**
   * Add custom pricing tier
   */
  addCustomTier(tier: PricingTier): void {
    this.tiers.set(tier.id, tier);
  }

  /**
   * Remove pricing tier
   */
  removeTier(id: string): boolean {
    return this.tiers.delete(id);
  }

  /**
   * Update pricing tier
   */
  updateTier(id: string, updates: Partial<PricingTier>): boolean {
    const tier = this.tiers.get(id);
    if (!tier) return false;

    const updated = { ...tier, ...updates };
    this.tiers.set(id, updated);
    return true;
  }

  /**
   * Check if plan is upgrade
   */
  isUpgrade(currentPlan: PlanType, newPlan: PlanType): boolean {
    const hierarchy = [PlanType.FREE, PlanType.PRO, PlanType.TEAM, PlanType.ENTERPRISE];
    return hierarchy.indexOf(newPlan) > hierarchy.indexOf(currentPlan);
  }

  /**
   * Check if plan is downgrade
   */
  isDowngrade(currentPlan: PlanType, newPlan: PlanType): boolean {
    return this.isUpgrade(newPlan, currentPlan);
  }

  /**
   * Get applicable tax rate
   */
  getTaxRate(country: string, region?: string): number {
    // Simplified tax rates - in production, use a proper tax calculation service
    const taxRates: Record<string, number> = {
      US: 0, // Varies by state
      GB: 0.2,
      DE: 0.19,
      FR: 0.2,
      CA: 0.05, // GST
      AU: 0.1,
    };
    return taxRates[country] || 0;
  }

  /**
   * Calculate total with tax
   */
  calculateWithTax(amount: number, taxRate: number): number {
    return amount * (1 + taxRate);
  }

  /**
   * Get price comparison between plans
   */
  comparePlans(plan1: PlanType, plan2: PlanType): {
    priceDifference: number;
    featureDifference: string[];
    limitDifference: Partial<UsageLimits>;
  } {
    const tier1 = PRICING_TIERS[plan1];
    const tier2 = PRICING_TIERS[plan2];

    const priceDifference = tier2.price - tier1.price;
    const featureDifference = tier2.features.filter(
      (f) => !tier1.features.includes(f)
    );

    const limitDifference: Partial<UsageLimits> = {};
    for (const key in tier2.limits) {
      const limit1 = tier1.limits[key as keyof UsageLimits];
      const limit2 = tier2.limits[key as keyof UsageLimits];
      if (limit1 !== limit2) {
        limitDifference[key as keyof UsageLimits] = limit2;
      }
    }

    return {
      priceDifference,
      featureDifference,
      limitDifference,
    };
  }

  /**
   * Get recommended plan based on usage
   */
  getRecommendedPlan(usage: Record<keyof typeof OVERAGE_RATES, number>): {
    plan: PlanType;
    reason: string;
    estimatedCost: number;
  } {
    const monthlyRequests = usage.requests;
    const monthlyTokens = usage.tokens;
    const monthlyCpuTime = usage.cpuTime;

    // Check if free tier is sufficient
    const freeTier = PRICING_TIERS[PlanType.FREE];
    if (
      monthlyRequests <= freeTier.limits.requestsPerMonth &&
      monthlyTokens <= freeTier.limits.tokensPerMonth &&
      monthlyCpuTime <= freeTier.limits.cpuTimePerMonth
    ) {
      return {
        plan: PlanType.FREE,
        reason: 'Your usage is within the free tier limits',
        estimatedCost: 0,
      };
    }

    // Check if pro tier is sufficient
    const proTier = PRICING_TIERS[PlanType.PRO];
    const proOverage = this.calculateTotalOverageCost(PlanType.PRO, usage);
    if (proOverage < proTier.price * 0.5) {
      return {
        plan: PlanType.PRO,
        reason: 'Pro tier meets most of your needs with minimal overage',
        estimatedCost: proTier.price + proOverage,
      };
    }

    // Check if team tier is sufficient
    const teamTier = PRICING_TIERS[PlanType.TEAM];
    const teamOverage = this.calculateTotalOverageCost(PlanType.TEAM, usage);
    if (teamOverage < teamTier.price * 0.5) {
      return {
        plan: PlanType.TEAM,
        reason: 'Team tier provides adequate capacity for your usage',
        estimatedCost: teamTier.price + teamOverage,
      };
    }

    // Recommend enterprise for high usage
    return {
      plan: PlanType.ENTERPRISE,
      reason: 'Your usage exceeds standard tiers. Contact sales for custom pricing.',
      estimatedCost: 0, // Custom pricing
    };
  }
}

// Export singleton instance
export const pricingManager = new PricingManager();
