/**
 * Traffic Allocator
 * Allocates users to experiment variants using various strategies
 */

import { Variant, AllocationStrategy, TrafficAllocation } from '../types/index.js';

export interface AllocationConfig {
  variants: Variant[];
  strategy: AllocationStrategy;
  trafficAllocation: TrafficAllocation;
  attributes?: Record<string, any>;
}

export class TrafficAllocator {
  private seedHistory: Map<string, number> = new Map();

  /**
   * Allocate a user to a variant
   */
  async allocate(
    experimentId: string,
    userId: string,
    variants: Variant[],
    strategy: AllocationStrategy,
    trafficAllocation: TrafficAllocation,
    attributes?: Record<string, any>
  ): Promise<string> {
    // Check if traffic allocation allows this user
    const bucket = this.getBucket(userId);
    if (bucket > trafficAllocation.totalPercentage) {
      // User not in experiment, allocate to control
      const control = variants.find(v => v.isControl) || variants[0];
      return control.id;
    }

    switch (strategy) {
      case 'random':
        return this.randomAllocation(variants, trafficAllocation);
      case 'stratified':
        return this.stratifiedAllocation(variants, trafficAllocation, attributes);
      case 'cohort':
        return this.cohortAllocation(variants, trafficAllocation, userId);
      case 'multi_armed_bandit':
        return this.multiArmedBanditAllocation(experimentId, variants, trafficAllocation);
      case 'thompson_sampling':
        return this.thompsonSamplingAllocation(experimentId, variants, trafficAllocation);
      default:
        return this.randomAllocation(variants, trafficAllocation);
    }
  }

  /**
   * Random allocation
   */
  private randomAllocation(
    variants: Variant[],
    trafficAllocation: TrafficAllocation
  ): string {
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const variant of variants) {
      cumulative += trafficAllocation.byVariant[variant.id] || variant.weight;
      if (random <= cumulative) {
        return variant.id;
      }
    }

    return variants[0].id;
  }

  /**
   * Stratified allocation based on user attributes
   */
  private stratifiedAllocation(
    variants: Variant[],
    trafficAllocation: TrafficAllocation,
    attributes?: Record<string, any>
  ): string {
    if (!attributes) {
      return this.randomAllocation(variants, trafficAllocation);
    }

    // Create stratified key
    const strataKey = Object.keys(attributes)
      .sort()
      .map(k => `${k}:${attributes[k]}`)
      .join('|');

    // Use deterministic hash for consistent allocation
    const hash = this.hashString(strataKey);
    const bucket = (hash % 10000) / 100; // 0-100

    let cumulative = 0;
    for (const variant of variants) {
      cumulative += trafficAllocation.byVariant[variant.id] || variant.weight;
      if (bucket <= cumulative) {
        return variant.id;
      }
    }

    return variants[0].id;
  }

  /**
   * Cohort-based allocation
   */
  private cohortAllocation(
    variants: Variant[],
    trafficAllocation: TrafficAllocation,
    userId: string
  ): string {
    // Allocate based on user cohort (deterministic)
    const hash = this.hashString(userId);
    const bucket = (hash % 10000) / 100;

    let cumulative = 0;
    for (const variant of variants) {
      cumulative += trafficAllocation.byVariant[variant.id] || variant.weight;
      if (bucket <= cumulative) {
        return variant.id;
      }
    }

    return variants[0].id;
  }

  /**
   * Multi-armed bandit allocation (epsilon-greedy)
   */
  private multiArmedBanditAllocation(
    experimentId: string,
    variants: Variant[],
    trafficAllocation: TrafficAllocation
  ): string {
    // Get performance data for each variant
    const performance = this.getVariantPerformance(experimentId);

    // Find best performing variant
    let bestVariant = variants[0];
    let bestReward = -Infinity;

    for (const variant of variants) {
      const stats = performance.get(variant.id);
      const reward = stats ? (stats.successes / stats.total) : 0;

      if (reward > bestReward) {
        bestReward = reward;
        bestVariant = variant;
      }
    }

    // Epsilon-greedy: 10% exploration, 90% exploitation
    const epsilon = 0.1;
    if (Math.random() < epsilon) {
      // Explore: random allocation
      return this.randomAllocation(variants, trafficAllocation);
    } else {
      // Exploit: allocate to best variant
      return bestVariant.id;
    }
  }

  /**
   * Thompson sampling allocation
   */
  private thompsonSamplingAllocation(
    experimentId: string,
    variants: Variant[],
    trafficAllocation: TrafficAllocation
  ): string {
    const performance = this.getVariantPerformance(experimentId);
    const samples = new Map<string, number>();

    // Sample from Beta distribution for each variant
    for (const variant of variants) {
      const stats = performance.get(variant.id);
      const alpha = stats ? stats.successes + 1 : 1;
      const beta = stats ? (stats.total - stats.successes) + 1 : 1;

      const sample = this.betaSample(alpha, beta);
      samples.set(variant.id, sample);
    }

    // Select variant with highest sample
    let selectedVariant = variants[0];
    let maxSample = -Infinity;

    for (const [variantId, sample] of samples.entries()) {
      if (sample > maxSample) {
        maxSample = sample;
        selectedVariant = variants.find(v => v.id === variantId)!;
      }
    }

    return selectedVariant.id;
  }

  /**
   * Get bucket for a user (0-100)
   */
  private getBucket(userId: string): number {
    const hash = this.hashString(userId);
    return (hash % 10000) / 100;
  }

  /**
   * Hash a string to a number
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Sample from Beta distribution
   */
  private betaSample(alpha: number, beta: number): number {
    // Using gamma distribution approximation
    const gamma1 = this.gammaSample(alpha);
    const gamma2 = this.gammaSample(beta);

    return gamma1 / (gamma1 + gamma2);
  }

  /**
   * Sample from Gamma distribution
   */
  private gammaSample(shape: number): number {
    if (shape < 1) {
      return this.gammaSample(shape + 1) * Math.pow(Math.random(), 1 / shape);
    }

    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);

    while (true) {
      const x = this.normalRandom();
      const v = (1 + c * x) ** 3;

      if (v > 0) {
        const u = Math.random();
        if (u < 1 - 0.0331 * (x ** 4)) {
          return d * v;
        }

        if (Math.log(u) < 0.5 * x ** 2 + d * (1 - v + Math.log(v))) {
          return d * v;
        }
      }
    }
  }

  /**
   * Generate normal random number
   */
  private normalRandom(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /**
   * Get variant performance (simulated)
   */
  private getVariantPerformance(experimentId: string): Map<string, { successes: number; total: number }> {
    // In real implementation, this would query storage
    // For now, return empty map
    return new Map();
  }

  /**
   * Override allocation for specific user
   */
  async overrideAllocation(
    experimentId: string,
    userId: string,
    variantId: string
  ): Promise<void> {
    // Implement override logic
    console.log(`Override allocation for ${userId} to ${variantId} in ${experimentId}`);
  }

  /**
   * Remove override
   */
  async removeOverride(
    experimentId: string,
    userId: string
  ): Promise<void> {
    // Implement remove override logic
    console.log(`Remove override for ${userId} in ${experimentId}`);
  }

  /**
   * Get allocation for user
   */
  async getAllocation(
    experimentId: string,
    userId: string
  ): Promise<string | null> {
    // Check if user has override
    // Return null if no allocation exists
    return null;
  }
}

// ============================================================================
// Gradual Rollout
// ============================================================================

export class GradualRollout {
  private allocations: Map<string, number> = new Map();

  /**
   * Calculate rollout percentage based on time
   */
  calculateRollup(
    startTime: number,
    duration: number,
    steps: number[],
    currentTime: number = Date.now()
  ): number {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Find current step
    for (let i = 0; i < steps.length; i++) {
      if (progress <= steps[i]) {
        return steps[i];
      }
    }

    return steps[steps.length - 1];
  }

  /**
   * Get current rollout percentage
   */
  getCurrentRollout(experimentId: string): number {
    return this.allocations.get(experimentId) || 0;
  }

  /**
   * Update rollout percentage
   */
  updateRollout(experimentId: string, percentage: number): void {
    this.allocations.set(experimentId, percentage);
  }
}

// ============================================================================
// Canary Deployment
// ============================================================================

export class CanaryDeployment {
  /**
   * Calculate canary allocation
   */
  calculateCanary(
    phase: number,
    totalPhases: number,
    initialPercentage: number,
    finalPercentage: number
  ): number {
    const progress = phase / totalPhases;
    return initialPercentage + (finalPercentage - initialPercentage) * progress;
  }

  /**
   * Verify canary health before proceeding
   */
  async verifyHealth(
    experimentId: string,
    thresholds: {
      errorRate: number;
      latency: number;
      rollbackThreshold: number;
    }
  ): Promise<{ healthy: boolean; reason?: string }> {
    // Get metrics for canary variant
    // Compare with thresholds

    // Simulated check
    return { healthy: true };
  }

  /**
   * Rollback canary deployment
   */
  async rollback(
    experimentId: string,
    reason: string
  ): Promise<void> {
    console.log(`Rolling back ${experimentId}: ${reason}`);
    // Implement rollback logic
  }
}

// ============================================================================
// Sticky Allocation
// ============================================================================

export class StickyAllocation {
  private allocations: Map<string, string> = new Map();

  /**
   * Get sticky allocation for user
   */
  getAllocation(experimentId: string, userId: string): string | null {
    const key = `${experimentId}:${userId}`;
    return this.allocations.get(key) || null;
  }

  /**
   * Set sticky allocation for user
   */
  setAllocation(experimentId: string, userId: string, variantId: string): void {
    const key = `${experimentId}:${userId}`;
    this.allocations.set(key, variantId);
  }

  /**
   * Clear sticky allocation for user
   */
  clearAllocation(experimentId: string, userId: string): void {
    const key = `${experimentId}:${userId}`;
    this.allocations.delete(key);
  }

  /**
   * Clear all allocations for experiment
   */
  clearExperiment(experimentId: string): void {
    const prefix = `${experimentId}:`;
    for (const key of this.allocations.keys()) {
      if (key.startsWith(prefix)) {
        this.allocations.delete(key);
      }
    }
  }
}
