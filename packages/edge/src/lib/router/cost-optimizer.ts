/**
 * Cost Optimizer
 *
 * Optimizes API costs through intelligent batching, free tier scheduling,
 * and cost-aware strategy selection.
 */

import type { ChatRequest, ChatResponse } from '../../types/index';
import type { ProviderClient } from '../providers/base';
import type {
  ExecutionStrategy,
  RequestAnalysis,
  ScheduledRequest,
  RequestBatch,
} from './types';

/**
 * Cost optimizer configuration
 */
export interface CostOptimizerConfig {
  /** Enable request batching */
  enableBatching: boolean;
  /** Batch timeout (ms) */
  batchTimeout: number;
  /** Minimum batch size */
  minBatchSize: number;
  /** Maximum batch size */
  maxBatchSize: number;
  /** Enable free tier scheduling */
  enableFreeTierScheduling: boolean;
  /** Free tier quota threshold */
  freeTierThreshold: number;
  /** Priority weights */
  priorityWeights: {
    /** Urgency priority */
    urgency: number;
    /** Complexity priority */
    complexity: number;
    /** User priority */
    user: number;
  };
}

/**
 * Cost Optimizer class
 *
 * Optimizes API costs through:
 * 1. Request batching for efficiency
 * 2. Free tier scheduling
 * 3. Cost-aware strategy selection
 * 4. Quota-aware routing
 *
 * Target: 70-90% cost reduction through intelligent routing
 */
export class CostOptimizer {
  private config: Required<CostOptimizerConfig>;
  private providers: Map<string, ProviderClient>;

  // Batching state
  private pendingBatches: Map<string, RequestBatch> = new Map();
  private batchTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  // Free tier scheduling
  private scheduledRequests: ScheduledRequest[] = [];
  private scheduledTimer?: ReturnType<typeof setInterval>;

  // Statistics
  private stats = {
    batchesProcessed: 0,
    requestsBatched: 0,
    freeTierRequests: 0,
    costSaved: 0,
  };

  constructor(
    providers: Map<string, ProviderClient>,
    config: Partial<CostOptimizerConfig> = {}
  ) {
    this.providers = providers;
    this.config = {
      enableBatching: config.enableBatching ?? true,
      batchTimeout: config.batchTimeout ?? 5000, // 5 seconds
      minBatchSize: config.minBatchSize ?? 3,
      maxBatchSize: config.maxBatchSize ?? 10,
      enableFreeTierScheduling: config.enableFreeTierScheduling ?? true,
      freeTierThreshold: config.freeTierThreshold ?? 0.1, // 10%
      priorityWeights: config.priorityWeights || {
        urgency: 0.4,
        complexity: 0.3,
        user: 0.3,
      },
    };

    // Start scheduled request processor
    if (this.config.enableFreeTierScheduling) {
      this.startScheduledProcessor();
    }
  }

  /**
   * Find cheapest valid strategy
   *
   * @param request - Chat request
   * @param analysis - Request analysis
   * @param strategies - Available strategies
   * @param minQuality - Minimum quality threshold
   * @returns Cheapest valid strategy
   */
  async findCheapest(
    request: ChatRequest,
    analysis: RequestAnalysis,
    strategies: ExecutionStrategy[],
    minQuality: number = 0.7
  ): Promise<ExecutionStrategy> {
    // Filter strategies that meet quality threshold
    const validStrategies = strategies.filter(s => s.expectedQuality >= minQuality);

    if (validStrategies.length === 0) {
      // Return lowest quality strategy if none meet threshold
      return strategies.reduce((cheapest, s) =>
        s.costPer1M < cheapest.costPer1M ? s : cheapest
      );
    }

    // Sort by cost (ascending)
    validStrategies.sort((a, b) => a.costPer1M - b.costPer1M);

    // Prefer free tier
    const freeStrategies = validStrategies.filter(s => s.costPer1M === 0);
    if (freeStrategies.length > 0) {
      return freeStrategies[0];
    }

    // Check if any free tier providers have quota
    for (const strategy of validStrategies) {
      if (strategy.costPer1M === 0) {
        const provider = this.providers.get(strategy.provider);
        if (provider) {
          const quota = await provider.getQuota();
          if (quota.remaining >= analysis.estimatedTokens.total) {
            return strategy;
          }
        }
      }
    }

    // Return cheapest paid strategy
    return validStrategies[0];
  }

  /**
   * Calculate expected cost for a strategy
   *
   * @param strategy - Execution strategy
   * @param request - Chat request
   * @returns Expected cost in USD
   */
  calculateCost(
    strategy: ExecutionStrategy,
    request: ChatRequest
  ): number {
    // Estimate tokens
    const inputTokens = this.estimateInputTokens(request);
    const outputTokens = request.maxTokens || 2048;
    const totalTokens = inputTokens + outputTokens;

    return (totalTokens / 1_000_000) * strategy.costPer1M;
  }

  /**
   * Batch similar requests for efficiency
   *
   * @param request - Chat request to batch
   * @param analysis - Request analysis
   * @returns Batch key or null if not batched
   */
  async batchRequests(
    request: ChatRequest,
    analysis: RequestAnalysis
  ): Promise<string | null> {
    if (!this.config.enableBatching) {
      return null;
    }

    // Generate batch key based on similarity
    const batchKey = this.generateBatchKey(request, analysis);

    // Get or create batch
    let batch = this.pendingBatches.get(batchKey);
    if (!batch) {
      batch = {
        key: batchKey,
        requests: [],
        totalTokens: 0,
        createdAt: Date.now(),
      };
      this.pendingBatches.set(batchKey, batch);

      // Set batch timeout
      const timer = setTimeout(() => this.processBatch(batchKey), this.config.batchTimeout);
      this.batchTimers.set(batchKey, timer);
    }

    // Add request to batch
    batch.requests.push(request);
    batch.totalTokens += analysis.estimatedTokens.total;

    // Check if batch is full
    if (batch.requests.length >= this.config.maxBatchSize) {
      await this.processBatch(batchKey);
    }

    return batchKey;
  }

  /**
   * Process a batch of requests
   *
   * @private
   */
  private async processBatch(batchKey: string): Promise<void> {
    const batch = this.pendingBatches.get(batchKey);
    if (!batch) {
      return;
    }

    // Clear timer
    const timer = this.batchTimers.get(batchKey);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(batchKey);
    }

    // Check if batch meets minimum size
    if (batch.requests.length < this.config.minBatchSize) {
      // Keep waiting
      return;
    }

    // Remove from pending
    this.pendingBatches.delete(batchKey);

    // Update stats
    this.stats.batchesProcessed++;
    this.stats.requestsBatched += batch.requests.length;

    // Process batch (in real implementation, would execute all requests)
    console.debug(`Processing batch ${batchKey} with ${batch.requests.length} requests`);
  }

  /**
   * Generate batch key for similar requests
   *
   * @private
   */
  private generateBatchKey(request: ChatRequest, analysis: RequestAnalysis): string {
    const parts = [
      analysis.complexity,
      analysis.intent,
      analysis.languages.join(','),
      // Round estimated tokens to nearest 100
      Math.round(analysis.estimatedTokens.total / 100) * 100,
    ];

    return parts.join(':');
  }

  /**
   * Schedule request for free tier execution
   *
   * @param request - Chat request
   * @param analysis - Request analysis
   * @param priority - Request priority (0-1)
   * @returns Scheduled request info
   */
  async scheduleForFreeTier(
    request: ChatRequest,
    analysis: RequestAnalysis,
    priority: number = 0.5
  ): Promise<ScheduledRequest> {
    const scheduled: ScheduledRequest = {
      requestId: crypto.randomUUID(),
      request,
      scheduledTime: this.calculateScheduleTime(analysis, priority),
      priority: this.calculatePriority(request, analysis, priority),
    };

    this.scheduledRequests.push(scheduled);
    this.scheduledRequests.sort((a, b) => {
      // Sort by priority (higher first), then by time (earlier first)
      if (Math.abs(a.priority - b.priority) > 0.1) {
        return b.priority - a.priority;
      }
      return a.scheduledTime - b.scheduledTime;
    });

    return scheduled;
  }

  /**
   * Calculate schedule time for free tier
   *
   * @private
   */
  private calculateScheduleTime(analysis: RequestAnalysis, priority: number): number {
    const now = Date.now();

    // High priority requests execute sooner
    if (priority > 0.8) {
      return now; // Immediate
    } else if (priority > 0.5) {
      return now + 1000; // 1 second delay
    } else if (priority > 0.3) {
      return now + 5000; // 5 second delay
    }
    return now + 30000; // 30 second delay
  }

  /**
   * Calculate request priority
   *
   * @private
   */
  private calculatePriority(
    request: ChatRequest,
    analysis: RequestAnalysis,
    basePriority: number
  ): number {
    let priority = basePriority;

    // Adjust by complexity
    if (analysis.complexity === 'simple') {
      priority += 0.2; // Simple requests can wait
    } else if (analysis.complexity === 'complex') {
      priority -= 0.1; // Complex requests are more important
    }

    // Adjust by intent
    if (analysis.intent === 'code') {
      priority += 0.1; // Code is higher priority
    }

    // Normalize to [0, 1]
    return Math.max(0, Math.min(1, priority));
  }

  /**
   * Start scheduled request processor
   *
   * @private
   */
  private startScheduledProcessor(): void {
    this.scheduledTimer = setInterval(async () => {
      const now = Date.now();
      const readyRequests = this.scheduledRequests.filter(
        r => r.scheduledTime <= now
      );

      if (readyRequests.length > 0) {
        console.debug(`Processing ${readyRequests.length} scheduled free tier requests`);
        this.stats.freeTierRequests += readyRequests.length;

        // Remove processed requests
        this.scheduledRequests = this.scheduledRequests.filter(
          r => r.scheduledTime > now
        );
      }
    }, 1000); // Check every second
  }

  /**
   * Stop scheduled processor
   */
  stopScheduledProcessor(): void {
    if (this.scheduledTimer) {
      clearInterval(this.scheduledTimer);
      this.scheduledTimer = undefined;
    }
  }

  /**
   * Estimate input tokens from request
   *
   * @private
   */
  private estimateInputTokens(request: ChatRequest): number {
    const text = request.messages.map(m => m.content).join('\n\n');
    return Math.ceil(text.length / 4);
  }

  /**
   * Get optimizer statistics
   */
  getStats(): {
    batchesProcessed: number;
    requestsBatched: number;
    freeTierRequests: number;
    costSaved: number;
    pendingBatches: number;
    scheduledRequests: number;
  } {
    return {
      ...this.stats,
      pendingBatches: this.pendingBatches.size,
      scheduledRequests: this.scheduledRequests.length,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      batchesProcessed: 0,
      requestsBatched: 0,
      freeTierRequests: 0,
      costSaved: 0,
    };
  }

  /**
   * Clear all pending batches
   */
  clearBatches(): void {
    // Clear all timers
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }

    this.pendingBatches.clear();
    this.batchTimers.clear();
  }

  /**
   * Clear all scheduled requests
   */
  clearScheduled(): void {
    this.scheduledRequests = [];
  }

  /**
   * Get configuration
   */
  getConfig(): Required<CostOptimizerConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CostOptimizerConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Destroy optimizer
   */
  destroy(): void {
    this.stopScheduledProcessor();
    this.clearBatches();
    this.clearScheduled();
  }
}

/**
 * Create cost optimizer instance
 */
export function createCostOptimizer(
  providers: Map<string, ProviderClient>,
  config?: Partial<CostOptimizerConfig>
): CostOptimizer {
  return new CostOptimizer(providers, config);
}
