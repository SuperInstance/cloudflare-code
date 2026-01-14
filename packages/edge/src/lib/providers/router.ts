/**
 * Intelligent Request Router
 *
 * Routes AI requests to optimal providers based on:
 * - Free tier availability
 * - Latency requirements
 * - Cost optimization
 * - Provider health
 * - Load balancing
 */

import type { ChatRequest, ChatResponse } from '../../types/index';
import type {
  ProviderClient,
  ProviderScore,
  QuotaInfo,
  HealthStatus,
  ProviderCapabilities,
} from './base';
import { ProviderRegistry } from './registry';
import { ResilientWrapper, createResilientWrapper } from './circuit-breaker';

/**
 * Routing strategy
 */
export enum RoutingStrategy {
  /** Prioritize free tier providers */
  FREE_TIER_FIRST = 'free_tier_first',
  /** Route to lowest latency provider */
  LOWEST_LATENCY = 'lowest_latency',
  /** Minimize API costs */
  COST_OPTIMIZED = 'cost_optimized',
  /** Distribute load across providers */
  LOAD_BALANCED = 'load_balanced',
  /** Prioritize highest quality */
  QUALITY_FIRST = 'quality_first',
}

/**
 * Routing configuration
 */
export interface RoutingConfig {
  /** Default routing strategy */
  defaultStrategy: RoutingStrategy;
  /** Enable circuit breaker */
  enableCircuitBreaker: boolean;
  /** Enable retry logic */
  enableRetry: boolean;
  /** Circuit breaker failure threshold */
  circuitFailureThreshold: number;
  /** Circuit breaker timeout (ms) */
  circuitTimeout: number;
  /** Max retry attempts */
  maxRetries: number;
  /** Retry base delay (ms) */
  retryBaseDelay: number;
  /** Fallback to alternative providers on failure */
  enableFallback: boolean;
  /** Maximum fallback attempts */
  maxFallbackAttempts: number;
  /** Score weights for adaptive routing */
  scoreWeights: {
    cost: number;
    latency: number;
    quota: number;
    reliability: number;
  };
}

/**
 * Routing result
 */
export interface RoutingResult {
  /** Selected provider */
  provider: ProviderClient;
  /** Provider name */
  providerName: string;
  /** Routing strategy used */
  strategy: RoutingStrategy;
  /** Provider score */
  score?: ProviderScore;
  /** Timestamp */
  timestamp: number;
}

/**
 * Request Router class
 */
export class RequestRouter {
  private registry: ProviderRegistry;
  private config: Required<RoutingConfig>;
  private resilientWrappers: Map<string, ResilientWrapper> = new Map();
  private routingHistory: RoutingResult[] = [];
  private maxHistorySize = 1000;

  constructor(registry: ProviderRegistry, config: Partial<RoutingConfig> = {}) {
    this.registry = registry;
    this.config = {
      defaultStrategy: config.defaultStrategy || RoutingStrategy.FREE_TIER_FIRST,
      enableCircuitBreaker: config.enableCircuitBreaker ?? true,
      enableRetry: config.enableRetry ?? true,
      circuitFailureThreshold: config.circuitFailureThreshold || 5,
      circuitTimeout: config.circuitTimeout || 60000,
      maxRetries: config.maxRetries || 3,
      retryBaseDelay: config.retryBaseDelay || 1000,
      enableFallback: config.enableFallback ?? true,
      maxFallbackAttempts: config.maxFallbackAttempts || 3,
      scoreWeights: config.scoreWeights || {
        cost: 0.35,
        latency: 0.25,
        quota: 0.25,
        reliability: 0.15,
      },
    };

    // Initialize resilient wrappers for all providers
    this.initializeResilientWrappers();
  }

  /**
   * Route request to optimal provider
   */
  async route(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();

    // Select provider based on strategy
    const routingResult = await this.selectProvider(request);

    // Record routing decision
    this.recordRouting(routingResult);

    // Execute request with resilience
    try {
      const response = await this.executeWithResilience(
        routingResult.provider,
        request,
        routingResult.providerName
      );

      return response;
    } catch (error) {
      // Try fallback providers if enabled
      if (this.config.enableFallback) {
        return await this.executeWithFallback(request, routingResult.providerName);
      }
      throw error;
    }
  }

  /**
   * Select optimal provider for request
   */
  private async selectProvider(request: ChatRequest): Promise<RoutingResult> {
    const strategy = this.determineStrategy(request);
    const availableProviders = await this.registry.getAvailable();

    if (availableProviders.length === 0) {
      throw new Error('No providers available');
    }

    let selectedProvider: ProviderClient;
    let score: ProviderScore | undefined;

    switch (strategy) {
      case RoutingStrategy.FREE_TIER_FIRST:
        selectedProvider = await this.selectFreeTierFirst(availableProviders);
        break;

      case RoutingStrategy.LOWEST_LATENCY:
        selectedProvider = await this.selectLowestLatency(availableProviders);
        break;

      case RoutingStrategy.COST_OPTIMIZED:
        [selectedProvider, score] = await this.selectCostOptimized(availableProviders, request);
        break;

      case RoutingStrategy.LOAD_BALANCED:
        selectedProvider = await this.selectLoadBalanced(availableProviders);
        break;

      case RoutingStrategy.QUALITY_FIRST:
        selectedProvider = await this.selectQualityFirst(availableProviders);
        break;

      default:
        selectedProvider = availableProviders[0];
    }

    return {
      provider: selectedProvider,
      providerName: selectedProvider.name,
      strategy,
      score,
      timestamp: Date.now(),
    };
  }

  /**
   * Determine routing strategy based on request
   */
  private determineStrategy(request: ChatRequest): RoutingStrategy {
    // If provider specified, use it directly
    if (request.provider) {
      return RoutingStrategy.QUALITY_FIRST;
    }

    // Use default strategy
    return this.config.defaultStrategy;
  }

  /**
   * Select provider with most free tier quota
   */
  private async selectFreeTierFirst(providers: ProviderClient[]): Promise<ProviderClient> {
    let bestProvider = providers[0];
    let bestQuota = 0;

    for (const provider of providers) {
      const quota = await provider.getQuota();
      const quotaScore = quota.remaining / quota.limit;

      if (quotaScore > bestQuota) {
        bestQuota = quotaScore;
        bestProvider = provider;
      }
    }

    return bestProvider;
  }

  /**
   * Select provider with lowest latency
   */
  private async selectLowestLatency(providers: ProviderClient[]): Promise<ProviderClient> {
    let bestProvider = providers[0];
    let bestLatency = Infinity;

    for (const provider of providers) {
      const health = await provider.getHealthStatus();
      if (health.avgLatency < bestLatency) {
        bestLatency = health.avgLatency;
        bestProvider = provider;
      }
    }

    return bestProvider;
  }

  /**
   * Select provider with lowest cost
   */
  private async selectCostOptimized(
    providers: ProviderClient[],
    request: ChatRequest
  ): Promise<[ProviderClient, ProviderScore]> {
    const scores: ProviderScore[] = [];

    for (const provider of providers) {
      const score = await this.calculateProviderScore(provider, request);
      scores.push(score);
    }

    // Sort by total score (highest first)
    scores.sort((a, b) => b.score - a.score);

    const bestScore = scores[0];
    const bestProvider = providers.find((p) => p.name === bestScore.provider)!;

    return [bestProvider, bestScore];
  }

  /**
   * Select provider using round-robin load balancing
   */
  private async selectLoadBalanced(providers: ProviderClient[]): Promise<ProviderClient> {
    // Simple round-robin based on request count
    let minRequests = Infinity;
    let bestProvider = providers[0];

    for (const provider of providers) {
      const health = await provider.getHealthStatus();
      if (health.totalRequests < minRequests) {
        minRequests = health.totalRequests;
        bestProvider = provider;
      }
    }

    return bestProvider;
  }

  /**
   * Select highest quality provider
   */
  private async selectQualityFirst(providers: ProviderClient[]): Promise<ProviderClient> {
    // Prefer providers with better capabilities
    const qualityOrder = ['cloudflare', 'cerebras', 'groq', 'openrouter'];

    for (const name of qualityOrder) {
      const provider = providers.find((p) => p.name === name);
      if (provider) {
        return provider;
      }
    }

    return providers[0];
  }

  /**
   * Calculate provider score for adaptive routing
   */
  private async calculateProviderScore(
    provider: ProviderClient,
    request: ChatRequest
  ): Promise<ProviderScore> {
    const quota = await provider.getQuota();
    const health = await provider.getHealthStatus();
    const capabilities = provider.capabilities;

    // Cost score (lower is better, invert)
    const costScore = 1 / (capabilities.inputCostPer1K + capabilities.outputCostPer1K + 0.01);

    // Latency score (lower is better, invert)
    const latencyScore = 1 / (health.avgLatency + 0.01);

    // Quota score (higher is better)
    const quotaScore = quota.remaining / quota.limit;

    // Reliability score (higher is better)
    const reliabilityScore = health.successRate;

    // Weighted total
    const totalScore =
      costScore * this.config.scoreWeights.cost +
      latencyScore * this.config.scoreWeights.latency +
      quotaScore * this.config.scoreWeights.quota +
      reliabilityScore * this.config.scoreWeights.reliability;

    return {
      provider: provider.name,
      score: totalScore,
      costScore,
      latencyScore,
      quotaScore,
      reliabilityScore,
    };
  }

  /**
   * Execute request with circuit breaker and retry logic
   */
  private async executeWithResilience(
    provider: ProviderClient,
    request: ChatRequest,
    providerName: string
  ): Promise<ChatResponse> {
    if (!this.config.enableCircuitBreaker && !this.config.enableRetry) {
      return await provider.chat(request);
    }

    const wrapper = this.resilientWrappers.get(providerName);
    if (!wrapper) {
      return await provider.chat(request);
    }

    return wrapper.execute(async () => await provider.chat(request));
  }

  /**
   * Execute with fallback to alternative providers
   */
  private async executeWithFallback(
    request: ChatRequest,
    excludeProvider: string
  ): Promise<ChatResponse> {
    const availableProviders = await this.registry.getAvailable();
    const alternativeProviders = availableProviders.filter((p) => p.name !== excludeProvider);

    for (let i = 0; i < Math.min(this.config.maxFallbackAttempts, alternativeProviders.length); i++) {
      const provider = alternativeProviders[i];

      try {
        console.log(`Falling back to ${provider.name}`);
        return await this.executeWithResilience(provider, request, provider.name);
      } catch (error) {
        console.error(`Fallback to ${provider.name} failed:`, error);
        continue;
      }
    }

    throw new Error('All providers failed');
  }

  /**
   * Initialize resilient wrappers for all providers
   */
  private initializeResilientWrappers(): void {
    const providers = this.registry.getAll();

    for (const provider of providers) {
      const wrapper = createResilientWrapper(
        provider.name,
        {
          failureThreshold: this.config.circuitFailureThreshold,
          successThreshold: 2,
          timeout: this.config.circuitTimeout,
          halfOpenMaxCalls: 3,
        },
        {
          maxRetries: this.config.maxRetries,
          baseDelay: this.config.retryBaseDelay,
          maxDelay: 30000,
          jitterFactor: 0.1,
          backoffMultiplier: 2,
        }
      );

      this.resilientWrappers.set(provider.name, wrapper);
    }
  }

  /**
   * Record routing decision for analytics
   */
  private recordRouting(result: RoutingResult): void {
    this.routingHistory.push(result);

    // Keep history size bounded
    if (this.routingHistory.length > this.maxHistorySize) {
      this.routingHistory.shift();
    }
  }

  /**
   * Get routing statistics
   */
  getRoutingStats(): {
    totalRoutings: number;
    byProvider: Map<string, number>;
    byStrategy: Map<RoutingStrategy, number>;
    averageSelectionTime: number;
  } {
    const byProvider = new Map<string, number>();
    const byStrategy = new Map<RoutingStrategy, number>();

    for (const routing of this.routingHistory) {
      byProvider.set(
        routing.providerName,
        (byProvider.get(routing.providerName) || 0) + 1
      );
      byStrategy.set(
        routing.strategy,
        (byStrategy.get(routing.strategy) || 0) + 1
      );
    }

    return {
      totalRoutings: this.routingHistory.length,
      byProvider,
      byStrategy,
      averageSelectionTime: 0, // Could track if needed
    };
  }

  /**
   * Get recent routing history
   */
  getRecentHistory(limit = 10): RoutingResult[] {
    return this.routingHistory.slice(-limit);
  }

  /**
   * Clear routing history
   */
  clearHistory(): void {
    this.routingHistory = [];
  }

  /**
   * Get router configuration
   */
  getConfig(): Required<RoutingConfig> {
    return { ...this.config };
  }

  /**
   * Update router configuration
   */
  updateConfig(config: Partial<RoutingConfig>): void {
    Object.assign(this.config, config);

    // Re-initialize wrappers if circuit breaker config changed
    if (config.circuitFailureThreshold || config.circuitTimeout) {
      this.initializeResilientWrappers();
    }
  }
}

/**
 * Create request router instance
 */
export function createRequestRouter(
  registry: ProviderRegistry,
  config?: Partial<RoutingConfig>
): RequestRouter {
  return new RequestRouter(registry, config);
}
