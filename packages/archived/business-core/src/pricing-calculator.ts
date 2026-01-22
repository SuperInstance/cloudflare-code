/**
 * ClaudeFlare Pricing Calculator
 */

import { PricingTier, defaultBusinessModel } from './model';

export interface ProjectRequirements {
  projects: number;
  teamMembers: number;
  storage: number;
  apiCalls: number;
  computeHours: number;
  customDomains: number;
  aiProjects: number;
  features: string[];
}

export interface CostBreakdown {
  recommendedTier: PricingTier;
  monthlyCost: number;
  annualCost: number;
  costSavings: number;
  includedValue: number;
  additionalCosts: AdditionalCost[];
  upgradePath: UpgradePath[];
}

export interface AdditionalCosts {
  type: 'ai-credits' | 'storage' | 'compute' | 'api-calls' | 'domains';
  usage: number;
  cost: number;
  description: string;
}

export interface UpgradePath {
  tier: string;
  description: string;
  savings: number;
  benefits: string[];
}

export class PricingCalculator {
  private tiers: PricingTier[];

  constructor(model?: any) {
    this.tiers = model?.pricing || defaultBusinessModel.pricing;
  }

  calculateBestPlan(requirements: ProjectRequirements): CostBreakdown {
    // Find the best tier that meets requirements
    const recommendedTier = this.findBestTier(requirements);

    // Calculate costs
    const monthlyCost = recommendedTier.monthlyPrice || 0;
    const annualCost = recommendedTier.annualPrice || monthlyCost * 12;

    // Calculate additional costs
    const additionalCosts = this.calculateAdditionalCosts(requirements, recommendedTier);

    // Calculate value of included features
    const includedValue = this.calculateIncludedValue(requirements, recommendedTier);

    // Calculate savings vs paying for everything separately
    const costSavings = this.calculateCostSavings(requirements, recommendedTier, additionalCosts);

    // Generate upgrade path
    const upgradePath = this.generateUpgradePath(recommendedTier.id);

    return {
      recommendedTier,
      monthlyCost,
      annualCost,
      costSavings,
      includedValue,
      additionalCosts,
      upgradePath
    };
  }

  private findBestTier(requirements: ProjectRequirements): PricingTier {
    // Start with free tier and check if it meets needs
    let bestTier = this.tiers[0]; // Free tier

    for (const tier of this.tiers) {
      if (this.tierMeetsRequirements(tier, requirements)) {
        // Prefer paid tiers if they provide better value
        if (tier.monthlyPrice > 0) {
          bestTier = tier;
        }
      }
    }

    return bestTier;
  }

  private tierMeetsRequirements(tier: PricingTier, requirements: ProjectRequirements): boolean {
    // Check limits
    if (tier.limits.projects < requirements.projects) return false;
    if (tier.limits.teamMembers < requirements.teamMembers) return false;
    if (tier.limits.storage < requirements.storage) return false;
    if (tier.limits.apiCalls < requirements.apiCalls) return false;
    if (tier.limits.computeHours < requirements.computeHours) return false;
    if (tier.limits.customDomains < requirements.customDomains) return false;
    if (tier.limits.projectsWithAI < requirements.aiProjects) return false;

    // Check custom domain requirement
    if (requirements.customDomains > 0 && !tier.customDomains) return false;

    return true;
  }

  private calculateAdditionalCosts(
    requirements: ProjectRequirements,
    tier: PricingTier
  ): AdditionalCosts[] {
    const costs: AdditionalCosts[] = [];
    const overage = defaultBusinessModel.revenue.usage.overagePricing;

    // Calculate AI credits needed
    const aiCreditsNeeded = Math.max(0, requirements.aiProjects * 1000 - (tier.limits.projectsWithAI * 1000));
    if (aiCreditsNeeded > 0) {
      const aiCreditPacks = Math.ceil(aiCreditsNeeded / defaultBusinessModel.revenue.premiumFeatures.aiCredits.packSize);
      costs.push({
        type: 'ai-credits',
        usage: aiCreditsNeeded,
        cost: aiCreditPacks * defaultBusinessModel.revenue.premiumFeatures.aiCredits.pricePerPack,
        description: `${aiCreditsNeeded} additional AI credits`
      });
    }

    // Storage overage
    const storageOverage = Math.max(0, requirements.storage - tier.limits.storage);
    if (storageOverage > 0) {
      costs.push({
        type: 'storage',
        usage: storageOverage,
        cost: storageOverage * overage.storage.monthlyPerGB,
        description: `${storageOverage}GB additional storage`
      });
    }

    // Compute overage
    const computeOverage = Math.max(0, requirements.computeHours - tier.limits.computeHours);
    if (computeOverage > 0) {
      costs.push({
        type: 'compute',
        usage: computeOverage,
        cost: computeOverage * overage.compute.hourly,
        description: `${computeOverage} additional compute hours`
      });
    }

    // API calls overage
    const apiOverage = Math.max(0, requirements.apiCalls - tier.limits.apiCalls);
    if (apiOverage > 0) {
      costs.push({
        type: 'api-calls',
        usage: apiOverage,
        cost: Math.ceil(apiOverage / 1000) * overage.apiCalls.per1000,
        description: `${apiOverage} additional API calls`
      });
    }

    // Custom domains
    const domainOverage = Math.max(0, requirements.customDomains - (tier.customDomains ? 1 : 0));
    if (domainOverage > 0) {
      // $10 per custom domain per month
      costs.push({
        type: 'domains',
        usage: domainOverage,
        cost: domainOverage * 10,
        description: `${domainOverage} additional custom domains`
      });
    }

    return costs;
  }

  private calculateIncludedValue(
    requirements: ProjectRequirements,
    tier: PricingTier
  ): number {
    let value = 0;

    // Value of included projects
    const includedProjects = Math.min(requirements.projects, tier.limits.projects);
    value += includedProjects * 50; // $50 per project value

    // Value of included team members
    const includedMembers = Math.min(requirements.teamMembers, tier.limits.teamMembers);
    value += includedMembers * 20; // $20 per member value

    // Value of storage
    const includedStorage = Math.min(requirements.storage, tier.limits.storage);
    value += includedStorage * 10; // $10 per GB value

    // Value of AI assistant
    if (tier.features.some(f => f.id === 'ai-assist')) {
      value += 200; // $200 value for AI assistant
    }

    return value;
  }

  private calculateCostSavings(
    requirements: ProjectRequirements,
    tier: PricingTier,
    additionalCosts: AdditionalCosts[]
  ): number {
    // Calculate what it would cost without any plan (pay as you go)
    const paygCost = this.calculatePayAsYouGoCost(requirements);

    // Total cost with plan
    const planCost = tier.monthlyPrice + additionalCosts.reduce((sum, cost) => sum + cost.cost, 0);

    return Math.max(0, paygCost - planCost);
  }

  private calculatePayAsYouGoCost(requirements: ProjectRequirements): number {
    const overage = defaultBusinessModel.revenue.usage.overagePricing;

    let cost = 0;

    // Projects would be handled under compute
    cost += requirements.computeHours * overage.compute.hourly;

    // Storage
    cost += requirements.storage * overage.storage.monthlyPerGB;

    // API calls
    cost += Math.ceil(requirements.apiCalls / 1000) * overage.apiCalls.per1000;

    // AI credits needed
    const aiCreditsNeeded = requirements.aiProjects * 1000;
    const aiCreditPacks = Math.ceil(aiCreditsNeeded / defaultBusinessModel.revenue.premiumFeatures.aiCredits.packSize);
    cost += aiCreditPacks * defaultBusinessModel.revenue.premiumFeatures.aiCredits.pricePerPack;

    // Custom domains
    cost += requirements.customDomains * 10;

    return cost;
  }

  private generateUpgradePath(currentTierId: string): UpgradePath[] {
    const path: UpgradePath[] = [];
    const currentIndex = this.tiers.findIndex(t => t.id === currentTierId);

    // Only show upgrade path if not on enterprise tier
    if (currentIndex < this.tiers.length - 1) {
      const nextTier = this.tiers[currentIndex + 1];

      const benefits = [];
      if (nextTier.limits.projects > this.tiers[currentIndex].limits.projects) {
        benefits.push(`Increase projects from ${this.tiers[currentIndex].limits.projects} to ${nextTier.limits.projects}`);
      }
      if (nextTier.limits.teamMembers > this.tiers[currentIndex].limits.teamMembers) {
        benefits.push(`Increase team from ${this.tiers[currentIndex].limits.teamMembers} to ${nextTier.limits.teamMembers}`);
      }
      if (nextTier.monthlyPrice > this.tiers[currentIndex].monthlyPrice) {
        const savings = nextTier.annualPrice - nextTier.monthlyPrice * 12;
        if (savings > 0) {
          benefits.push(`Save $${savings} with annual billing`);
        }
      }

      path.push({
        tier: nextTier.name,
        description: `Upgrade to ${nextTier.name} for more features and higher limits`,
        savings: this.calculateTierSavings(currentTierId, nextTier.id),
        benefits
      });
    }

    return path;
  }

  private calculateTierSavings(fromTierId: string, toTierId: string): number {
    const fromTier = this.tiers.find(t => t.id === fromTierId);
    const toTier = this.tiers.find(t => t.id === toTierId);

    if (!fromTier || !toTier || toTier.monthlyPrice <= fromTier.monthlyPrice) {
      return 0;
    }

    // Calculate value of additional features
    let savings = 0;

    // Additional projects
    const projectValue = Math.max(0, toTier.limits.projects - fromTier.limits.projects) * 50;

    // Additional team members
    const memberValue = Math.max(0, toTier.limits.teamMembers - fromTier.limits.teamMembers) * 20;

    // Additional storage
    const storageValue = Math.max(0, toTier.limits.storage - fromTier.limits.storage) * 10;

    // AI assistant value
    if (!fromTier.features.find(f => f.id === 'ai-assist') && toTier.features.find(f => f.id === 'ai-assist')) {
      savings += 200;
    }

    return savings + projectValue + memberValue + storageValue;
  }

  // Quick estimate for simple scenarios
  quickEstimate(projects: number, teamMembers: number): { tier: string; cost: number; description: string } {
    if (projects <= 3 && teamMembers <= 5) {
      return {
        tier: 'Free',
        cost: 0,
        description: 'Free tier covers your needs'
      };
    } else if (projects <= 10 && teamMembers <= 25) {
      return {
        tier: 'Pro',
        cost: 29,
        description: '$29/month for your project size'
      };
    } else {
      return {
        tier: 'Enterprise',
        cost: 'Custom',
        description: 'Contact sales for custom pricing'
      };
    }
  }
}

// Export default calculator instance
export const pricingCalculator = new PricingCalculator();