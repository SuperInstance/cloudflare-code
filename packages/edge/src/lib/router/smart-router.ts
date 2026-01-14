/**
 * Smart Router
 *
 * Main orchestration layer for intelligent request routing.
 * Combines complexity analysis, strategy selection, confidence cascading,
 * and cost optimization for optimal AI request handling.
 */

import type { ChatRequest, ChatResponse } from '../../types/index';
import type { ProviderClient } from '../providers/base';
import type { SemanticCache } from '../cache/semantic';
import type {
  RequestAnalysis,
  RouterStats,
  SmartRouterConfig,
  ExecutionStrategy,
  CascadeResult,
} from './types';
import { RequestAnalyzer } from './analyzer';
import { StrategySelector, ProviderDefinition } from './strategy';
import { ConfidenceCascade } from './cascade';
import { CostOptimizer } from './cost-optimizer';

/**
 * Smart Router class
 *
 * Orchestrates the complete routing pipeline:
 * 1. Check semantic cache
 * 2. Analyze request complexity
 * 3. Select optimal strategy
 * 4. Execute through confidence cascade
 * 5. Cache result
 * 6. Track metrics
 *
 * Targets:
 * - 70-90% requests handled by Tier 1 (free)
 * - 90%+ cost reduction
 * - <50ms routing overhead
 * - 80%+ cache hit rate
 */
export class SmartRouter {
  private analyzer: RequestAnalyzer;
  private strategySelector: StrategySelector;
  private cascade: ConfidenceCascade;
  private costOptimizer: CostOptimizer;
  private cache?: SemanticCache;
  private providers: Map<string, ProviderClient>;
  private config: Required<SmartRouterConfig>;

  // Statistics
  private stats: RouterStats = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    requestsByTier: new Map([[1, 0], [2, 0], [3, 0]]),
    requestsByComplexity: new Map([['simple', 0], ['moderate', 0], ['complex', 0]]),
    requestsByIntent: new Map([['chat', 0], ['code', 0], ['analysis', 0], ['creative', 0]]),
    totalCost: 0,
    totalLatency: 0,
    averageLatency: 0,
    cascadeStats: {
      singleAttempt: 0,
      twoAttempts: 0,
      threeAttempts: 0,
      failures: 0,
    },
    costSavings: 0,
    timestamp: Date.now(),
  };

  // Cascade attempt logs for statistics
  private cascadeLogs: CascadeResult['attemptsLog'][] = [];

  constructor(
    providers: Map<string, ProviderClient>,
    providerDefinitions: Map<string, ProviderDefinition>,
    cache?: SemanticCache,
    config: Partial<SmartRouterConfig> = {}
  ) {
    this.providers = providers;
    this.cache = cache;
    this.config = {
      enableCache: config.enableCache ?? true,
      enableCascade: config.enableCascade ?? true,
      minConfidence: config.minConfidence ?? 0.75,
      maxCascadeAttempts: config.maxCascadeAttempts ?? 3,
      enableCostOptimization: config.enableCostOptimization ?? true,
      minQuality: config.minQuality ?? 0.7,
      enableBatching: config.enableBatching ?? false,
      batchTimeout: config.batchTimeout ?? 5000,
      minBatchSize: config.minBatchSize ?? 3,
      maxBatchSize: config.maxBatchSize ?? 10,
      weights: config.weights || { cost: 0.4, quality: 0.4, speed: 0.2 },
    };

    // Initialize components
    this.analyzer = new RequestAnalyzer();
    this.strategySelector = new StrategySelector({
      providers: providerDefinitions,
      weights: this.config.weights,
      qualityThresholds: {
        tier1: 0.7,
        tier2: 0.85,
        tier3: 0.95,
      },
    });
    this.cascade = new ConfidenceCascade(providers, {
      minConfidence: this.config.minConfidence,
      maxAttempts: this.config.maxCascadeAttempts,
    });
    this.costOptimizer = new CostOptimizer(providers, {
      enableBatching: this.config.enableBatching,
      batchTimeout: this.config.batchTimeout,
      minBatchSize: this.config.minBatchSize,
      maxBatchSize: this.config.maxBatchSize,
    });
  }

  /**
   * Route request through intelligent pipeline
   *
   * @param request - Chat request
   * @returns Chat response
   *
   * Performance: <50ms routing overhead + execution time
   */
  async route(request: ChatRequest): Promise<ChatResponse> {
    const startTime = performance.now();
    this.stats.totalRequests++;

    try {
      // Step 1: Check semantic cache
      if (this.config.enableCache && this.cache) {
        const cached = await this.checkCache(request);
        if (cached) {
          this.stats.cacheHits++;
          const latency = performance.now() - startTime;
          this.recordCacheHit(latency);
          return cached;
        }
        this.stats.cacheMisses++;
      }

      // Step 2: Analyze request
      const analysis = await this.analyzer.analyze(request);
      this.recordAnalysis(analysis);

      // Step 3: Select strategy
      const availableProviders = Array.from(this.providers.values());
      let strategies: ExecutionStrategy[];

      if (this.config.enableCostOptimization) {
        // Find cheapest valid strategy
        const allStrategies = await this.getAllStrategies();
        const strategy = await this.costOptimizer.findCheapest(
          request,
          analysis,
          allStrategies,
          this.config.minQuality
        );
        strategies = [strategy];
      } else {
        // Select multiple strategies for cascade
        strategies = await this.strategySelector.selectStrategies(
          analysis,
          availableProviders,
          this.config.maxCascadeAttempts
        );
      }

      // Step 4: Execute through cascade
      let result: CascadeResult;
      if (this.config.enableCascade && strategies.length > 1) {
        result = await this.cascade.execute(request, strategies, analysis);
      } else if (strategies.length > 0) {
        // Single strategy execution
        result = await this.executeWithStrategy(request, strategies[0]);
      } else {
        throw new Error('No valid strategies available');
      }

      // Step 5: Cache result
      if (this.config.enableCache && this.cache) {
        await this.storeInCache(request, result.response);
      }

      // Step 6: Record metrics
      const totalLatency = performance.now() - startTime;
      this.recordResult(result, totalLatency);
      this.cascadeLogs.push(result.attemptsLog);

      return result.response;

    } catch (error) {
      console.error('Smart routing failed:', error);
      this.stats.cascadeStats.failures++;
      throw error;
    }
  }

  /**
   * Check semantic cache
   *
   * @private
   */
  private async checkCache(request: ChatRequest): Promise<ChatResponse | null> {
    if (!this.cache) return null;

    const text = request.messages.map(m => m.content).join('\n\n');
    const result = await this.cache.check(text);

    if (result.hit && result.response) {
      console.debug(`Cache hit (${result.source}) with similarity ${result.similarity.toFixed(3)}`);
      return result.response;
    }

    return null;
  }

  /**
   * Store in semantic cache
   *
   * @private
   */
  private async storeInCache(request: ChatRequest, response: ChatResponse): Promise<void> {
    if (!this.cache) return;

    const text = request.messages.map(m => m.content).join('\n\n');
    await this.cache.store(text, response, {
      model: request.model || 'default',
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    });
  }

  /**
   * Execute with single strategy
   *
   * @private
   */
  private async executeWithStrategy(
    request: ChatRequest,
    strategy: ExecutionStrategy
  ): Promise<CascadeResult> {
    const startTime = performance.now();

    const provider = this.providers.get(strategy.provider);
    if (!provider) {
      throw new Error(`Provider not found: ${strategy.provider}`);
    }

    const modifiedRequest: ChatRequest = {
      ...request,
      model: strategy.model,
    };

    const response = await provider.chat(modifiedRequest);
    const latency = performance.now() - startTime;
    const cost = (response.usage.totalTokens / 1_000_000) * strategy.costPer1M;

    return {
      response,
      tierUsed: strategy.tier,
      strategy,
      confidence: strategy.expectedQuality,
      cost,
      attempts: 1,
      latency,
      attemptsLog: [{
        attempt: 1,
        strategy,
        success: true,
        confidence: strategy.expectedQuality,
        latency,
      }],
    };
  }

  /**
   * Get all available strategies
   *
   * @private
   */
  private async getAllStrategies(): Promise<ExecutionStrategy[]> {
    // Return all predefined strategies from all tiers
    const strategies: ExecutionStrategy[] = [];

    // This would normally come from the strategy selector
    // For now, return a basic set
    strategies.push(
      {
        name: 'tier1',
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
        name: 'tier2',
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
        name: 'tier3',
        provider: 'anthropic',
        model: 'claude-3-haiku',
        expectedQuality: 0.92,
        confidence: 0.95,
        costPer1M: 1.00,
        expectedLatency: 400,
        maxTokens: 4096,
        tier: 3,
      }
    );

    return strategies;
  }

  /**
   * Record analysis in stats
   *
   * @private
   */
  private recordAnalysis(analysis: RequestAnalysis): void {
    this.stats.requestsByComplexity.set(
      analysis.complexity,
      (this.stats.requestsByComplexity.get(analysis.complexity) || 0) + 1
    );
    this.stats.requestsByIntent.set(
      analysis.intent,
      (this.stats.requestsByIntent.get(analysis.intent) || 0) + 1
    );
  }

  /**
   * Record cache hit in stats
   *
   * @private
   */
  private recordCacheHit(latency: number): void {
    this.stats.totalLatency += latency;
    this.stats.averageLatency = this.stats.totalLatency / this.stats.totalRequests;

    // Estimate cost savings (assuming $0.01 per 1K tokens)
    this.stats.costSavings += 0.01; // Rough estimate
  }

  /**
   * Record result in stats
   *
   * @private
   */
  private recordResult(result: CascadeResult, latency: number): void {
    this.stats.totalCost += result.cost;
    this.stats.totalLatency += latency;
    this.stats.averageLatency = this.stats.totalLatency / this.stats.totalRequests;

    // Record tier usage
    this.stats.requestsByTier.set(
      result.tierUsed,
      (this.stats.requestsByTier.get(result.tierUsed) || 0) + 1
    );

    // Record cascade stats
    switch (result.attempts) {
      case 1:
        this.stats.cascadeStats.singleAttempt++;
        break;
      case 2:
        this.stats.cascadeStats.twoAttempts++;
        break;
      case 3:
        this.stats.cascadeStats.threeAttempts++;
        break;
    }
  }

  /**
   * Get router statistics
   */
  getStats(): RouterStats {
    // Update timestamp
    this.stats.timestamp = Date.now();

    return {
      ...this.stats,
      requestsByTier: new Map(this.stats.requestsByTier),
      requestsByComplexity: new Map(this.stats.requestsByComplexity),
      requestsByIntent: new Map(this.stats.requestsByIntent),
    };
  }

  /**
   * Get detailed statistics
   */
  getDetailedStats(): {
    router: RouterStats;
    cascade: ReturnType<ConfidenceCascade['getStats']>;
    costOptimizer: ReturnType<CostOptimizer['getStats']>;
    cache?: ReturnType<SemanticCache['getStats']>;
  } {
    return {
      router: this.getStats(),
      cascade: this.cascade.getStats(this.cascadeLogs),
      costOptimizer: this.costOptimizer.getStats(),
      cache: this.cache?.getStats(),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      requestsByTier: new Map([[1, 0], [2, 0], [3, 0]]),
      requestsByComplexity: new Map([['simple', 0], ['moderate', 0], ['complex', 0]]),
      requestsByIntent: new Map([['chat', 0], ['code', 0], ['analysis', 0], ['creative', 0]]),
      totalCost: 0,
      totalLatency: 0,
      averageLatency: 0,
      cascadeStats: {
        singleAttempt: 0,
        twoAttempts: 0,
        threeAttempts: 0,
        failures: 0,
      },
      costSavings: 0,
      timestamp: Date.now(),
    };
    this.cascadeLogs = [];
  }

  /**
   * Get configuration
   */
  getConfig(): Required<SmartRouterConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SmartRouterConfig>): void {
    Object.assign(this.config, config);

    // Update child components
    if (config.minConfidence !== undefined) {
      this.cascade.updateConfig({ minConfidence: config.minConfidence });
    }
    if (config.maxCascadeAttempts !== undefined) {
      this.cascade.updateConfig({ maxAttempts: config.maxCascadeAttempts });
    }
    if (config.weights) {
      this.strategySelector.updateConfig({ weights: config.weights });
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    providersHealthy: number;
    providersTotal: number;
    cacheHealthy: boolean;
  }> {
    let providersHealthy = 0;

    for (const provider of this.providers.values()) {
      try {
        const isHealthy = await provider.isAvailable();
        if (isHealthy) {
          providersHealthy++;
        }
      } catch {
        // Provider not healthy
      }
    }

    return {
      healthy: providersHealthy > 0,
      providersHealthy,
      providersTotal: this.providers.size,
      cacheHealthy: this.config.enableCache ? this.cache !== undefined : true,
    };
  }

  /**
   * Destroy router
   */
  destroy(): void {
    this.costOptimizer.destroy();
    this.resetStats();
  }
}

/**
 * Create smart router instance
 */
export function createSmartRouter(
  providers: Map<string, ProviderClient>,
  providerDefinitions: Map<string, ProviderDefinition>,
  cache?: SemanticCache,
  config?: Partial<SmartRouterConfig>
): SmartRouter {
  return new SmartRouter(providers, providerDefinitions, cache, config);
}
