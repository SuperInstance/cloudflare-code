/**
 * Strategy Selector
 *
 * Selects execution strategies based on request analysis,
 * considering cost, quality, and speed tradeoffs.
 */

import type { ProviderClient, ProviderCapabilities, QuotaInfo, HealthStatus } from '../providers/base';
import type {
  RequestAnalysis,
  ExecutionStrategy,
  ComplexityLevel,
  IntentType,
} from './types';

/**
 * Strategy selector configuration
 */
export interface StrategySelectorConfig {
  /** Provider definitions */
  providers: Map<string, ProviderDefinition>;
  /** Scoring weights */
  weights: {
    cost: number;
    quality: number;
    speed: number;
  };
  /** Quality thresholds by tier */
  qualityThresholds: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
}

/**
 * Provider definition for routing
 */
export interface ProviderDefinition {
  /** Provider name */
  name: string;
  /** Provider client */
  client: ProviderClient;
  /** Capabilities */
  capabilities: ProviderCapabilities;
  /** Models available */
  models: string[];
  /** Default model */
  defaultModel: string;
  /** Tier level */
  tier: 1 | 2 | 3;
  /** Quality score (0-1) */
  quality: number;
  /** Base priority */
  priority: number;
}

/**
 * Strategy scoring result
 */
export interface StrategyScore {
  /** Strategy being scored */
  strategy: ExecutionStrategy;
  /** Total score (0-1) */
  totalScore: number;
  /** Component scores */
  scores: {
    cost: number;
    quality: number;
    speed: number;
  };
  /** Meets requirements */
  meetsRequirements: boolean;
}

/**
 * Strategy Selector class
 *
 * Selects optimal execution strategies based on:
 * - Request complexity and intent
 * - Cost constraints
 * - Quality requirements
 * - Speed requirements
 * - Provider capabilities
 * - Current quota and health
 */
export class StrategySelector {
  private config: StrategySelectorConfig;
  private providerCache: Map<string, ProviderCache>;

  // Predefined strategies for different tiers
  private readonly TIER1_STRATEGIES: ExecutionStrategy[] = [
    {
      name: 'cloudflare-workers-ai',
      provider: 'cloudflare',
      model: '@cf/meta/llama-2-7b-chat-int8',
      expectedQuality: 0.75,
      confidence: 0.8,
      costPer1M: 0,
      expectedLatency: 200,
      maxTokens: 2048,
      tier: 1,
    },
    {
      name: 'groq-llama',
      provider: 'groq',
      model: 'llama-3.1-8b',
      expectedQuality: 0.78,
      confidence: 0.82,
      costPer1M: 0,
      expectedLatency: 100,
      maxTokens: 4096,
      tier: 1,
    },
    {
      name: 'cerebras-inference',
      provider: 'cerebras',
      model: 'llama-3.1-8b',
      expectedQuality: 0.78,
      confidence: 0.82,
      costPer1M: 0,
      expectedLatency: 50,
      maxTokens: 4096,
      tier: 1,
    },
  ];

  private readonly TIER2_STRATEGIES: ExecutionStrategy[] = [
    {
      name: 'openrouter-mixtral',
      provider: 'openrouter',
      model: 'mistralai/mixtral-8x7b',
      expectedQuality: 0.85,
      confidence: 0.88,
      costPer1M: 0.50,
      expectedLatency: 300,
      maxTokens: 8192,
      tier: 2,
    },
    {
      name: 'openrouter-llama-70b',
      provider: 'openrouter',
      model: 'meta-llama/llama-3.1-70b',
      expectedQuality: 0.87,
      confidence: 0.90,
      costPer1M: 0.80,
      expectedLatency: 350,
      maxTokens: 8192,
      tier: 2,
    },
  ];

  private readonly TIER3_STRATEGIES: ExecutionStrategy[] = [
    {
      name: 'anthropic-claude',
      provider: 'anthropic',
      model: 'claude-3-haiku',
      expectedQuality: 0.92,
      confidence: 0.95,
      costPer1M: 1.00,
      expectedLatency: 400,
      maxTokens: 4096,
      tier: 3,
    },
    {
      name: 'openai-gpt',
      provider: 'openai',
      model: 'gpt-4o-mini',
      expectedQuality: 0.90,
      confidence: 0.93,
      costPer1M: 0.60,
      expectedLatency: 350,
      maxTokens: 4096,
      tier: 3,
    },
  ];

  constructor(config: StrategySelectorConfig) {
    this.config = config;
    this.providerCache = new Map();
  }

  /**
   * Select execution strategy based on analysis
   *
   * @param analysis - Request analysis
   * @param providers - Available providers
   * @returns Selected execution strategy
   *
   * Performance: <50ms (mostly async checks)
   */
  async selectStrategy(
    analysis: RequestAnalysis,
    providers: ProviderClient[]
  ): Promise<ExecutionStrategy> {
    const startTime = performance.now();

    // Get provider health and quota
    const providerStatus = await this.getProviderStatus(providers);

    // Score all available strategies
    const scoredStrategies = await this.scoreStrategies(
      analysis,
      providerStatus
    );

    // Filter strategies that meet requirements
    const validStrategies = scoredStrategies.filter(s => s.meetsRequirements);

    if (validStrategies.length === 0) {
      // Fallback to tier 1 if no valid strategies
      console.warn('No valid strategies found, falling back to tier 1');
      return this.TIER1_STRATEGIES[0];
    }

    // Sort by score
    validStrategies.sort((a, b) => b.totalScore - a.totalScore);

    const latency = performance.now() - startTime;
    console.debug(`Strategy selection completed in ${latency.toFixed(2)}ms`);

    return validStrategies[0].strategy;
  }

  /**
   * Select multiple strategies for cascade
   *
   * @param analysis - Request analysis
   * @param providers - Available providers
   * @param maxStrategies - Maximum strategies to return
   * @returns Array of execution strategies
   */
  async selectStrategies(
    analysis: RequestAnalysis,
    providers: ProviderClient[],
    maxStrategies: number = 3
  ): Promise<ExecutionStrategy[]> {
    const providerStatus = await this.getProviderStatus(providers);
    const scoredStrategies = await this.scoreStrategies(
      analysis,
      providerStatus
    );

    // Group by tier and pick best from each
    const byTier = new Map<number, StrategyScore[]>();
    for (const strategy of scoredStrategies) {
      const tier = strategy.strategy.tier;
      if (!byTier.has(tier)) {
        byTier.set(tier, []);
      }
      byTier.get(tier)!.push(strategy);
    }

    // Pick best from each tier
    const selected: ExecutionStrategy[] = [];
    for (const [tier, strategies] of byTier) {
      strategies.sort((a, b) => b.totalScore - a.totalScore);
      selected.push(strategies[0].strategy);
    }

    // Sort by tier (ascending)
    selected.sort((a, b) => a.tier - b.tier);

    return selected.slice(0, maxStrategies);
  }

  /**
   * Score strategies based on multiple objectives
   *
   * @private
   */
  private async scoreStrategies(
    analysis: RequestAnalysis,
    providerStatus: Map<string, ProviderCache>
  ): Promise<StrategyScore[]> {
    const allStrategies = [
      ...this.TIER1_STRATEGIES,
      ...this.TIER2_STRATEGIES,
      ...this.TIER3_STRATEGIES,
    ];

    const scores: StrategyScore[] = [];

    for (const strategy of allStrategies) {
      const score = await this.scoreStrategy(strategy, analysis, providerStatus);
      scores.push(score);
    }

    return scores;
  }

  /**
   * Score a single strategy
   *
   * @private
   */
  private async scoreStrategy(
    strategy: ExecutionStrategy,
    analysis: RequestAnalysis,
    providerStatus: Map<string, ProviderCache>
  ): Promise<StrategyScore> {
    // Get provider status
    const status = providerStatus.get(strategy.provider);
    if (!status || !status.isAvailable) {
      return {
        strategy,
        totalScore: 0,
        scores: { cost: 0, quality: 0, speed: 0 },
        meetsRequirements: false,
      };
    }

    // Calculate component scores
    const costScore = this.calculateCostScore(strategy, analysis);
    const qualityScore = this.calculateQualityScore(strategy, analysis);
    const speedScore = this.calculateSpeedScore(strategy, analysis, status);

    // Weighted total
    const totalScore =
      costScore * this.config.weights.cost +
      qualityScore * this.config.weights.quality +
      speedScore * this.config.weights.speed;

    // Check if strategy meets requirements
    const meetsRequirements = this.checkRequirements(strategy, analysis, status);

    return {
      strategy,
      totalScore,
      scores: { cost: costScore, quality: qualityScore, speed: speedScore },
      meetsRequirements,
    };
  }

  /**
   * Calculate cost score (lower is better)
   *
   * @private
   */
  private calculateCostScore(
    strategy: ExecutionStrategy,
    analysis: RequestAnalysis
  ): number {
    // Free tier gets highest score
    if (strategy.costPer1M === 0) {
      return 1.0;
    }

    // Calculate expected cost
    const expectedCost = (analysis.estimatedTokens.total / 1_000_000) * strategy.costPer1M;

    // Score inversely proportional to cost (log scale)
    // $0.01 -> 0.95, $1.00 -> 0.50, $10.00 -> 0.05
    return Math.max(0, 1 - Math.log10(expectedCost + 0.01) / 3);
  }

  /**
   * Calculate quality score
   *
   * @private
   */
  private calculateQualityScore(
    strategy: ExecutionStrategy,
    analysis: RequestAnalysis
  ): number {
    // Start with base quality
    let score = strategy.expectedQuality;

    // Adjust based on complexity
    if (analysis.complexity === 'complex') {
      // Complex requests benefit more from higher quality
      score *= (1 + strategy.tier * 0.1);
    } else if (analysis.complexity === 'simple') {
      // Simple requests don't need as much quality
      score *= 0.95;
    }

    // Adjust based on intent
    if (analysis.intent === 'code' && strategy.tier >= 2) {
      // Code benefits from higher quality
      score *= 1.1;
    }

    return Math.min(1.0, score);
  }

  /**
   * Calculate speed score
   *
   * @private
   */
  private calculateSpeedScore(
    strategy: ExecutionStrategy,
    analysis: RequestAnalysis,
    status: ProviderCache
  ): number {
    // Lower latency = higher score
    // 50ms -> 1.0, 500ms -> 0.5, 2000ms -> 0.0
    const maxLatency = 2000;
    const score = Math.max(0, 1 - status.health.avgLatency / maxLatency);

    // Adjust based on urgency
    // Simple requests are more latency-sensitive
    if (analysis.complexity === 'simple') {
      return Math.min(1.0, score * 1.2);
    }

    return score;
  }

  /**
   * Check if strategy meets requirements
   *
   * @private
   */
  private checkRequirements(
    strategy: ExecutionStrategy,
    analysis: RequestAnalysis,
    status: ProviderCache
  ): boolean {
    // Check token limit
    if (strategy.maxTokens < analysis.estimatedTokens.total) {
      return false;
    }

    // Check availability
    if (!status.isAvailable) {
      return false;
    }

    // Check quota
    if (status.quota.remaining < analysis.estimatedTokens.total) {
      return false;
    }

    // Check health
    if (status.health.successRate < 0.5) {
      return false;
    }

    return true;
  }

  /**
   * Get provider status (cached)
   *
   * @private
   */
  private async getProviderStatus(
    providers: ProviderClient[]
  ): Promise<Map<string, ProviderCache>> {
    const now = Date.now();
    const result = new Map<string, ProviderCache>();

    for (const provider of providers) {
      // Check cache
      const cached = this.providerCache.get(provider.name);
      if (cached && now - cached.timestamp < 5000) { // 5 second cache
        result.set(provider.name, cached);
        continue;
      }

      // Fetch status
      try {
        const [quota, health] = await Promise.all([
          provider.getQuota(),
          provider.getHealthStatus(),
        ]);

        const status: ProviderCache = {
          quota,
          health,
          isAvailable: quota.remaining > 0 && health.isHealthy,
          timestamp: now,
        };

        result.set(provider.name, status);
        this.providerCache.set(provider.name, status);
      } catch (error) {
        console.error(`Failed to get status for ${provider.name}:`, error);
        // Mark as unavailable
        result.set(provider.name, {
          quota: {
            provider: provider.name,
            used: 0,
            limit: 0,
            remaining: 0,
            resetTime: 0,
            resetType: 'never',
            lastUpdated: now,
            isExhausted: true,
          },
          health: {
            provider: provider.name,
            isHealthy: false,
            lastCheck: now,
            avgLatency: Infinity,
            successRate: 0,
            totalRequests: 0,
            failedRequests: 0,
            circuitState: 'open',
          },
          isAvailable: false,
          timestamp: now,
        });
      }
    }

    return result;
  }

  /**
   * Get configuration
   */
  getConfig(): StrategySelectorConfig {
    return {
      ...this.config,
      providers: new Map(this.config.providers),
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<StrategySelectorConfig>): void {
    if (config.weights) {
      this.config.weights = { ...this.config.weights, ...config.weights };
    }
    if (config.qualityThresholds) {
      this.config.qualityThresholds = { ...this.config.qualityThresholds, ...config.qualityThresholds };
    }
    if (config.providers) {
      this.config.providers = new Map(config.providers);
    }
  }

  /**
   * Clear provider cache
   */
  clearCache(): void {
    this.providerCache.clear();
  }
}

/**
 * Provider cache entry
 */
interface ProviderCache {
  quota: QuotaInfo;
  health: HealthStatus;
  isAvailable: boolean;
  timestamp: number;
}

/**
 * Create strategy selector instance
 */
export function createStrategySelector(
  providers: Map<string, ProviderDefinition>,
  config?: Partial<StrategySelectorConfig>
): StrategySelector {
  return new StrategySelector({
    providers,
    weights: config?.weights || { cost: 0.4, quality: 0.4, speed: 0.2 },
    qualityThresholds: config?.qualityThresholds || {
      tier1: 0.7,
      tier2: 0.85,
      tier3: 0.95,
    },
  });
}
