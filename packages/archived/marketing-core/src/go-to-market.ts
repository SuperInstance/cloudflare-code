/**
 * ClaudeFlare Go-to-Market - Ultra-Optimized
 * Lightweight launch strategy
 */

export type Phase = 'pre-launch' | 'launch' | 'growth' | 'expansion';

// Optimized phase lookup (Map for O(1) access)
const phases = new Map<Phase, { duration: number; budget: number; focus: string }>([
  ['pre-launch', { duration: 2, budget: 50000, focus: 'Community & validation' }],
  ['launch', { duration: 3, budget: 200000, focus: 'Public launch & acquisition' }],
  ['growth', { duration: 6, budget: 500000, focus: 'Scale & conversion' }],
  ['expansion', { duration: 12, budget: 1000000, focus: 'Enterprise & international' }]
]);

// Streamlined channels (grouped by type for efficiency)
const channelBudgets = new Map<'organic' | 'paid' | 'partnership', number>([
  ['organic', 50000],
  ['paid', 200000],
  ['partnership', 50000]
]);

// Simplified content strategy
const content = [
  { type: 'blog', frequency: 'weekly', impact: 'SEO' },
  { type: 'video', frequency: 'biweekly', impact: 'adoption' },
  { type: 'social', frequency: 'daily', impact: 'engagement' }
];

// Optimized launch calculator
export const launchCalculator = {
  totalBudget(): number {
    let total = 0;
    for (const phase of phases.values()) total += phase.budget;
    return total;
  },

  totalTimeline(): number {
    let total = 0;
    for (const phase of phases.values()) total += phase.duration;
    return total;
  },

  phase(phase: Phase) {
    return phases.get(phase);
  },

  channelBudget(type: 'organic' | 'paid' | 'partnership'): number {
    return channelBudgets.get(type) || 0;
  },

  getROI(phase: Phase, revenue: number): number {
    const cost = phases.get(phase)?.budget || 0;
    return cost > 0 ? (revenue - cost) / cost : 0;
  }
};