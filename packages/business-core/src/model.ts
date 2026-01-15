/**
 * ClaudeFlare Business Model - Ultra-Optimized
 * Lightweight monetization strategy
 */

import type { Plan } from '@claudeflare/core-interfaces';

interface PricingTier {
  price: number;
  limits: { projects: number; team: number };
}

// Optimized pricing lookup (Map for O(1) access)
const pricing = new Map<Plan, PricingTier>([
  ['free', { price: 0, limits: { projects: 3, team: 5 } }],
  ['pro', { price: 29, limits: { projects: 10, team: 25 } }],
  ['enterprise', { price: 0, limits: { projects: Infinity, team: Infinity } }]
]);

// Optimized plan recommendation
const recommendPlan = (projects: number, team: number): Plan => {
  if (projects <= 3 && team <= 5) return 'free';
  if (projects <= 10 && team <= 25) return 'pro';
  return 'enterprise';
};

// Streamlined pricing calculator
export const pricingCalculator = {
  calculateCost(projects: number, team: number): { plan: Plan; cost: number } {
    const plan = recommendPlan(projects, team);
    return { plan, cost: pricing.get(plan)!.price };
  },

  calculateMRR(customers: Map<Plan, number>): number {
    let total = 0;
    for (const [plan, count] of customers) {
      total += (pricing.get(plan)?.price || 0) * count;
    }
    return total;
  },

  getMetrics(customers: Map<Plan, number>, spend: number, newCustomers: number) {
    const mrr = this.calculateMRR(customers);
    const cac = newCustomers > 0 ? spend / newCustomers : 0;
    const ltv = mrr > 0 ? cac * 12 : 0; // Simplified LTV
    return { mrr, cac, ltv };
  }
};