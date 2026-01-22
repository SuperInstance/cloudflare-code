/**
 * Adaptive Throttling System
 *
 * Dynamically adjusts rate limits based on system load, performance metrics,
 * cost thresholds, and user tiers.
 */

// @ts-nocheck
import type {
  RateLimitResult,
  RateLimitConfig,
  AdaptiveConfig,
  PerformanceMetrics,
  UserTierConfig,
  CostMetrics,
  RateLimitContext
} from '../types/index.js';
import { UserTier } from '../types/index.js';
import { AlgorithmEngine } from '../algorithms/engine.js';
import type { StorageBackend } from '../storage/index.js';

/**
 * Load-based throttling configuration
 */
export interface LoadThrottlingConfig {
  enabled: boolean;
  cpuThreshold: number; // 0-1
  memoryThreshold: number; // 0-1
  adjustmentFactor: number; // 0-1 (how much to reduce)
  minLimit: number;
}

/**
 * Performance-based throttling configuration
 */
export interface PerformanceThrottlingConfig {
  enabled: boolean;
  responseTimeThreshold: number; // milliseconds
  errorRateThreshold: number; // 0-1
  adjustmentFactor: number;
  minLimit: number;
}

/**
 * Cost-based throttling configuration
 */
export interface CostThrottlingConfig {
  enabled: boolean;
  costThreshold: number; // credits
  softLimitThreshold: number; // 0-1
  hardLimitThreshold: number; // 0-1
  adjustmentFactor: number;
  minLimit: number;
}

/**
 * Adaptive throttling manager
 */
export class AdaptiveThrottler {
  private config: AdaptiveConfig;
  private storage: StorageBackend;
  private algorithmEngine: AlgorithmEngine;
  private userTiers: Map<UserTier, UserTierConfig>;
  private performanceHistory: PerformanceMetrics[];
  private currentLoadFactor: number;
  private currentPerformanceFactor: number;
  private currentCostFactor: number;
  private maxHistorySize: number;

  constructor(
    config: AdaptiveConfig,
    storage: StorageBackend
  ) {
    this.config = config;
    this.storage = storage;
    this.algorithmEngine = new AlgorithmEngine();
    this.userTiers = new Map();
    this.performanceHistory = [];
    this.currentLoadFactor = 1.0;
    this.currentPerformanceFactor = 1.0;
    this.currentCostFactor = 1.0;
    this.maxHistorySize = 1000;

    // Initialize default user tiers
    this.initializeUserTiers();
  }

  /**
   * Initialize default user tier configurations
   */
  private initializeUserTiers(): void {
    this.userTiers.set(UserTier.FREE, {
      tier: UserTier.FREE,
      baseLimit: 100,
      burstMultiplier: 1.5,
      priority: 1
    });

    this.userTiers.set(UserTier.BASIC, {
      tier: UserTier.BASIC,
      baseLimit: 1000,
      burstMultiplier: 2.0,
      priority: 10
    });

    this.userTiers.set(UserTier.PRO, {
      tier: UserTier.PRO,
      baseLimit: 10000,
      burstMultiplier: 2.5,
      priority: 100
    });

    this.userTiers.set(UserTier.ENTERPRISE, {
      tier: UserTier.ENTERPRISE,
      baseLimit: 100000,
      burstMultiplier: 3.0,
      priority: 1000
    });
  }

  /**
   * Check rate limit with adaptive adjustments
   */
  async check(
    baseConfig: RateLimitConfig,
    context: RateLimitContext,
    metrics?: {
      performance?: PerformanceMetrics;
      cost?: CostMetrics;
    }
  ): Promise<RateLimitResult> {
    // Get adjusted limit based on adaptive factors
    const adjustedLimit = this.calculateAdjustedLimit(baseConfig, context, metrics);

    // Create adjusted config
    const adjustedConfig: RateLimitConfig = {
      ...baseConfig,
      limit: adjustedLimit.limit
    };

    // Get user tier for context
    const userTier = this.getUserTier(context);
    const tierConfig = this.userTiers.get(userTier);

    if (tierConfig && tierConfig.customLimits) {
      // Apply custom tier limits
      const customLimit = tierConfig.customLimits[context.endpoint || 'default'];
      if (customLimit) {
        adjustedConfig.limit = Math.min(adjustedConfig.limit, customLimit);
      }
    }

    // Get state from storage
    const key = this.getKey(context);
    const state = await this.storage.get(key);

    // Check with adjusted limit
    const result = await this.algorithmEngine.check(
      adjustedConfig,
      state,
      context
    );

    // Update state if allowed
    if (result.allowed) {
      const newState = state || this.algorithmEngine.reset(adjustedConfig);
      await this.storage.set(key, newState);
    }

    // Add adaptive metadata
    result.metadata = {
      ...result.metadata,
      adaptive: {
        baseLimit: baseConfig.limit,
        adjustedLimit: adjustedConfig.limit,
        loadFactor: this.currentLoadFactor,
        performanceFactor: this.currentPerformanceFactor,
        costFactor: this.currentCostFactor,
        userTier
      }
    };

    return result;
  }

  /**
   * Calculate adjusted limit based on adaptive factors
   */
  private calculateAdjustedLimit(
    baseConfig: RateLimitConfig,
    context: RateLimitContext,
    metrics?: {
      performance?: PerformanceMetrics;
      cost?: CostMetrics;
    }
  ): { limit: number } {
    let adjustedLimit = baseConfig.limit;

    // Apply load-based adjustment
    if (this.config.loadThreshold) {
      const loadFactor = this.calculateLoadFactor();
      adjustedLimit = Math.floor(adjustedLimit * loadFactor);
    }

    // Apply performance-based adjustment
    if (this.config.performanceThreshold && metrics?.performance) {
      const perfFactor = this.calculatePerformanceFactor(metrics.performance);
      adjustedLimit = Math.floor(adjustedLimit * perfFactor);
    }

    // Apply cost-based adjustment
    if (this.config.costThreshold && metrics?.cost) {
      const costFactor = this.calculateCostFactor(metrics.cost);
      adjustedLimit = Math.floor(adjustedLimit * costFactor);
    }

    // Apply user tier adjustment
    const userTier = this.getUserTier(context);
    const tierConfig = this.userTiers.get(userTier);

    if (tierConfig) {
      const tierMultiplier = this.getTierMultiplier(tierConfig, context);
      adjustedLimit = Math.floor(adjustedLimit * tierMultiplier);
    }

    // Enforce min/max limits
    const minLimit = this.config.minLimit || 1;
    const maxLimit = this.config.maxLimit || baseConfig.limit * 2;

    adjustedLimit = Math.max(minLimit, Math.min(maxLimit, adjustedLimit));

    return { limit: adjustedLimit };
  }

  /**
   * Calculate load factor based on system resources
   */
  private calculateLoadFactor(): number {
    // This would typically get actual CPU and memory usage
    // For now, we'll use a simplified model
    return this.currentLoadFactor;
  }

  /**
   * Calculate performance factor based on response times and error rates
   */
  private calculatePerformanceFactor(performance: PerformanceMetrics): number {
    let factor = 1.0;

    // Adjust based on response time
    if (this.config.performanceThreshold) {
      const ratio = performance.responseTime / this.config.performanceThreshold;
      if (ratio > 1) {
        factor *= 1 - ((ratio - 1) * (this.config.adjustmentFactor || 0.1));
      }
    }

    // Adjust based on error rate
    if (this.config.performanceThreshold && performance.errorRate > 0.01) {
      factor *= 1 - (performance.errorRate * (this.config.adjustmentFactor || 0.1));
    }

    return Math.max(0.1, Math.min(1.0, factor));
  }

  /**
   * Calculate cost factor based on cost metrics
   */
  private calculateCostFactor(cost: CostMetrics): number {
    if (!this.config.costThreshold) {
      return 1.0;
    }

    const ratio = cost.creditsUsed / this.config.costThreshold;

    if (ratio < 0.8) {
      return 1.0; // No adjustment under 80% usage
    } else if (ratio < 0.95) {
      // Gradual reduction from 80% to 95%
      return 1.0 - ((ratio - 0.8) * 0.5);
    } else {
      // Sharp reduction above 95%
      return 0.1;
    }
  }

  /**
   * Get user tier from context
   */
  private getUserTier(context: RateLimitContext): UserTier {
    if (context.metadata?.tier) {
      return context.metadata.tier as UserTier;
    }

    // Determine tier based on user ID or API key
    // This is a simplified implementation
    return UserTier.FREE;
  }

  /**
   * Get tier multiplier
   */
  private getTierMultiplier(tierConfig: UserTierConfig, context: RateLimitContext): number {
    // Base multiplier from tier
    let multiplier = tierConfig.priority / 10;

    // Apply burst multiplier if configured
    if (tierConfig.burstMultiplier && context.metadata?.burst) {
      multiplier *= tierConfig.burstMultiplier;
    }

    return multiplier;
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(metrics: PerformanceMetrics): void {
    this.performanceHistory.push(metrics);

    // Trim history if needed
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory.shift();
    }

    // Update performance factor
    this.updatePerformanceFactor();
  }

  /**
   * Update performance factor based on history
   */
  private updatePerformanceFactor(): void {
    if (this.performanceHistory.length < 10) {
      return;
    }

    // Calculate averages over recent history
    const windowSize = Math.min(100, this.performanceHistory.length);
    const recent = this.performanceHistory.slice(-windowSize);

    const avgResponseTime = recent.reduce((sum, m) => sum + m.responseTime, 0) / recent.length;
    const avgErrorRate = recent.reduce((sum, m) => sum + m.errorRate, 0) / recent.length;

    // Calculate factor
    let factor = 1.0;

    if (this.config.performanceThreshold) {
      const responseRatio = avgResponseTime / this.config.performanceThreshold;
      if (responseRatio > 1) {
        factor *= 1 - ((responseRatio - 1) * (this.config.adjustmentFactor || 0.1));
      }

      if (avgErrorRate > 0.01) {
        factor *= 1 - (avgErrorRate * (this.config.adjustmentFactor || 0.1));
      }
    }

    this.currentPerformanceFactor = Math.max(0.1, Math.min(1.0, factor));
  }

  /**
   * Update load factor manually
   */
  updateLoadFactor(cpu: number, memory: number): void {
    let factor = 1.0;

    if (this.config.loadThreshold !== undefined) {
      const cpuRatio = cpu / this.config.loadThreshold;
      const memoryRatio = memory / this.config.loadThreshold;

      if (cpuRatio > 1 || memoryRatio > 1) {
        const maxRatio = Math.max(cpuRatio, memoryRatio);
        factor = 1 - ((maxRatio - 1) * (this.config.adjustmentFactor || 0.1));
      }
    }

    this.currentLoadFactor = Math.max(0.1, Math.min(1.0, factor));
  }

  /**
   * Update cost factor
   */
  updateCostFactor(cost: CostMetrics): void {
    this.currentCostFactor = this.calculateCostFactor(cost);
  }

  /**
   * Register custom user tier
   */
  registerUserTier(config: UserTierConfig): void {
    this.userTiers.set(config.tier, config);
  }

  /**
   * Unregister user tier
   */
  unregisterUserTier(tier: UserTier): boolean {
    return this.userTiers.delete(tier);
  }

  /**
   * Get user tier configuration
   */
  getUserTierConfig(tier: UserTier): UserTierConfig | undefined {
    return this.userTiers.get(tier);
  }

  /**
   * Update user tier configuration
   */
  updateUserTierConfig(tier: UserTier, updates: Partial<UserTierConfig>): boolean {
    const config = this.userTiers.get(tier);

    if (!config) {
      return false;
    }

    Object.assign(config, updates);
    return true;
  }

  /**
   * Get storage key for context
   */
  private getKey(context: RateLimitContext): string {
    return `adaptive:${context.identifier}:${context.endpoint || 'default'}`;
  }

  /**
   * Get current adaptive factors
   */
  getCurrentFactors(): {
    load: number;
    performance: number;
    cost: number;
  } {
    return {
      load: this.currentLoadFactor,
      performance: this.currentPerformanceFactor,
      cost: this.currentCostFactor
    };
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    averageResponseTime: number;
    averageErrorRate: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    dataPoints: number;
  } {
    if (this.performanceHistory.length === 0) {
      return {
        averageResponseTime: 0,
        averageErrorRate: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        dataPoints: 0
      };
    }

    const responseTimes = this.performanceHistory.map(m => m.responseTime).sort((a, b) => a - b);
    const errorRates = this.performanceHistory.map(m => m.errorRate);

    const avgResponseTime = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
    const avgErrorRate = errorRates.reduce((sum, r) => sum + r, 0) / errorRates.length;

    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    return {
      averageResponseTime: avgResponseTime,
      averageErrorRate: avgErrorRate,
      p95ResponseTime: responseTimes[p95Index] || 0,
      p99ResponseTime: responseTimes[p99Index] || 0,
      dataPoints: this.performanceHistory.length
    };
  }

  /**
   * Clear performance history
   */
  clearPerformanceHistory(): void {
    this.performanceHistory = [];
  }

  /**
   * Reset adaptive factors
   */
  resetFactors(): void {
    this.currentLoadFactor = 1.0;
    this.currentPerformanceFactor = 1.0;
    this.currentCostFactor = 1.0;
  }

  /**
   * Get throttling statistics
   */
  getStats(): {
    currentFactors: {
      load: number;
      performance: number;
      cost: number;
    };
    performanceDataPoints: number;
    userTiers: number;
    config: AdaptiveConfig;
  } {
    return {
      currentFactors: this.getCurrentFactors(),
      performanceDataPoints: this.performanceHistory.length,
      userTiers: this.userTiers.size,
      config: this.config
    };
  }

  /**
   * Export adaptive configuration
   */
  exportConfig(): {
    adaptive: AdaptiveConfig;
    userTiers: Record<string, UserTierConfig>;
  } {
    const userTiers: Record<string, UserTierConfig> = {};

    for (const [tier, config] of this.userTiers.entries()) {
      userTiers[tier] = config;
    }

    return {
      adaptive: this.config,
      userTiers
    };
  }

  /**
   * Import adaptive configuration
   */
  importConfig(config: {
    adaptive: AdaptiveConfig;
    userTiers?: Record<string, UserTierConfig>;
  }): void {
    this.config = config.adaptive;

    if (config.userTiers) {
      for (const [tier, tierConfig] of Object.entries(config.userTiers)) {
        this.userTiers.set(tier as UserTier, tierConfig);
      }
    }
  }
}
