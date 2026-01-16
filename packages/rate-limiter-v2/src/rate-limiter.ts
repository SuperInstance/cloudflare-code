/**
 * Main Rate Limiter Class
 *
 * Provides a unified interface for rate limiting with support for
 * multiple algorithms, distributed coordination, hierarchical limits,
 * and adaptive throttling.
 */

// @ts-nocheck
import type {
  RateLimitResult,
  RateLimitConfig,
  RateLimitContext,
  RateLimiterOptions,
  RateLimitEvent,
  RateLimitEventPayload,
  EventListener,
  RateLimitMetrics
} from './types/index.js';
import { RateLimitAlgorithm } from './types/index.js';
import { AlgorithmEngine } from './algorithms/engine.js';
import { createStorage, type StorageBackend } from './storage/index.js';
import { DistributedRateLimiter } from './distributed/limiter.js';
import { HierarchyManager, LimitPriority } from './hierarchy/manager.js';
import { AdaptiveThrottler } from './adaptive/throttler.js';

/**
 * Main rate limiter class
 */
export class RateLimiter {
  private config: RateLimitConfig;
  private storage: StorageBackend;
  private algorithmEngine: AlgorithmEngine;
  private distributed?: DistributedRateLimiter;
  private hierarchy?: HierarchyManager;
  private adaptive?: AdaptiveThrottler;
  private eventListeners: Map<RateLimitEvent, EventListener[]>;
  private metrics: RateLimitMetrics;
  private skipOnError: boolean;

  constructor(options: RateLimiterOptions) {
    this.config = options.config;
    this.storage = createStorage(options.storage || { type: 'memory' });
    this.algorithmEngine = new AlgorithmEngine();
    this.eventListeners = new Map();
    this.skipOnError = options.skipOnError ?? false;

    // Initialize metrics
    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      deniedRequests: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      currentUsage: 0,
      peakUsage: 0,
      algorithmMetrics: {}
    };

    // Initialize distributed limiter if configured
    if (options.distributed?.enabled) {
      this.distributed = new DistributedRateLimiter({
        config: this.config,
        distributed: options.distributed,
        storage: this.storage,
        nodeId: options.distributed.nodeId || 'node-1'
      });
    }

    // Initialize hierarchy manager if configured
    if (options.hierarchical) {
      this.hierarchy = new HierarchyManager(
        options.hierarchical,
        this.storage
      );
    }

    // Initialize adaptive throttler if configured
    if (options.adaptive?.enabled) {
      this.adaptive = new AdaptiveThrottler(
        options.adaptive,
        this.storage
      );
    }

    // Register event listener if provided
    if (options.onEvent) {
      this.on(RateLimitEvent.CHECKED, options.onEvent);
    }
  }

  /**
   * Check if a request is allowed
   */
  async check(context: RateLimitContext): Promise<RateLimitResult> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      let result: RateLimitResult;

      // Use distributed limiter if enabled
      if (this.distributed) {
        result = await this.distributed.check(context);
      }
      // Use hierarchy manager if enabled
      else if (this.hierarchy) {
        result = await this.hierarchy.check(context);
      }
      // Use adaptive throttler if enabled
      else if (this.adaptive) {
        result = await this.adaptive.check(this.config, context);
      }
      // Use standard algorithm engine
      else {
        const key = this.getKey(context);
        const state = await this.storage.get(key);

        result = await this.algorithmEngine.check(
          this.config,
          state,
          context
        );

        // Update state if allowed
        if (result.allowed) {
          const newState = state || this.algorithmEngine.reset(this.config);
          await this.storage.set(key, newState);
        }
      }

      // Update metrics
      if (result.allowed) {
        this.metrics.allowedRequests++;
        this.emit(RateLimitEvent.ALLOWED, { context, result, timestamp: Date.now() });
      } else {
        this.metrics.deniedRequests++;
        this.emit(RateLimitEvent.DENIED, { context, result, timestamp: Date.now() });
      }

      // Update latency metrics
      const latency = Date.now() - startTime;
      this.updateLatencyMetrics(latency);

      // Emit checked event
      this.emit(RateLimitEvent.CHECKED, { context, result, timestamp: Date.now() });

      return result;
    } catch (error) {
      // Emit error event
      this.emit(RateLimitEvent.ERROR, {
        context,
        error: error as Error,
        timestamp: Date.now()
      });

      // Skip or allow based on configuration
      if (this.skipOnError) {
        return {
          allowed: true,
          limit: this.config.limit,
          remaining: this.config.limit,
          reset: Date.now() + this.config.window
        };
      }

      throw error;
    }
  }

  /**
   * Check with custom weight
   */
  async checkWithWeight(
    context: RateLimitContext,
    weight: number
  ): Promise<RateLimitResult> {
    const key = this.getKey(context);
    const state = await this.storage.get(key);

    const result = await this.algorithmEngine.checkWithWeight(
      this.config,
      state,
      context,
      weight
    );

    // Update state if allowed
    if (result.allowed) {
      const newState = state || this.algorithmEngine.reset(this.config);
      await this.storage.set(key, newState);
    }

    return result;
  }

  /**
   * Reset rate limit for a context
   */
  async reset(context: RateLimitContext): Promise<void> {
    if (this.hierarchy) {
      await this.hierarchy.reset(context);
    } else {
      const key = this.getKey(context);
      await this.storage.delete(key);
    }

    this.emit(RateLimitEvent.RESET, { context, timestamp: Date.now() });
  }

  /**
   * Get current metrics
   */
  getMetrics(): RateLimitMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      deniedRequests: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      currentUsage: 0,
      peakUsage: 0,
      algorithmMetrics: {}
    };
  }

  /**
   * Update rate limit configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
    this.algorithmEngine.updateConfig(this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  /**
   * Add event listener
   */
  on(event: RateLimitEvent, listener: EventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * Remove event listener
   */
  off(event: RateLimitEvent, listener: EventListener): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: RateLimitEvent, payload: RateLimitEventPayload): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(payload);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      }
    }
  }

  /**
   * Get storage key for context
   */
  private getKey(context: RateLimitContext): string {
    const parts = ['ratelimit', context.identifier];

    if (context.endpoint) {
      parts.push(context.endpoint);
    }

    if (context.userId) {
      parts.push(context.userId);
    }

    return parts.join(':');
  }

  /**
   * Update latency metrics
   */
  private updateLatencyMetrics(latency: number): void {
    // Simple moving average
    this.metrics.averageLatency =
      (this.metrics.averageLatency * 0.9) + (latency * 0.1);

    // Update current usage
    this.metrics.currentUsage = latency;
    this.metrics.peakUsage = Math.max(this.metrics.peakUsage, latency);
  }

  /**
   * Get distributed limiter (if configured)
   */
  getDistributed(): DistributedRateLimiter | undefined {
    return this.distributed;
  }

  /**
   * Get hierarchy manager (if configured)
   */
  getHierarchy(): HierarchyManager | undefined {
    return this.hierarchy;
  }

  /**
   * Get adaptive throttler (if configured)
   */
  getAdaptive(): AdaptiveThrottler | undefined {
    return this.adaptive;
  }

  /**
   * Check if distributed mode is enabled
   */
  isDistributed(): boolean {
    return this.distributed !== undefined;
  }

  /**
   * Check if hierarchy is enabled
   */
  isHierarchical(): boolean {
    return this.hierarchy !== undefined;
  }

  /**
   * Check if adaptive throttling is enabled
   */
  isAdaptive(): boolean {
    return this.adaptive !== undefined;
  }

  /**
   * Destroy rate limiter and cleanup resources
   */
  async destroy(): Promise<void> {
    // Stop distributed limiter
    if (this.distributed) {
      await this.distributed.stop();
    }

    // Destroy storage if supported
    if (this.storage.destroy) {
      await this.storage.destroy();
    }

    // Clear event listeners
    this.eventListeners.clear();
  }

  /**
   * Export rate limiter state
   */
  exportState(): {
    config: RateLimitConfig;
    metrics: RateLimitMetrics;
    distributed?: boolean;
    hierarchical?: boolean;
    adaptive?: boolean;
  } {
    return {
      config: this.config,
      metrics: this.metrics,
      distributed: this.isDistributed(),
      hierarchical: this.isHierarchical(),
      adaptive: this.isAdaptive()
    };
  }

  /**
   * Create a rate limiter instance with default configuration
   */
  static create(options: Partial<RateLimiterOptions>): RateLimiter {
    return new RateLimiter({
      config: options.config || {
        algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
        limit: 100,
        window: 60000
      },
      ...options
    });
  }

  /**
   * Create a token bucket rate limiter
   */
  static tokenBucket(limit: number, window: number, burst?: number): RateLimiter {
    return new RateLimiter({
      config: {
        algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
        limit,
        window,
        burst
      }
    });
  }

  /**
   * Create a leaky bucket rate limiter
   */
  static leakyBucket(limit: number, window: number, rate?: number): RateLimiter {
    return new RateLimiter({
      config: {
        algorithm: RateLimitAlgorithm.LEAKY_BUCKET,
        limit,
        window,
        rate
      }
    });
  }

  /**
   * Create a sliding window rate limiter
   */
  static slidingWindow(limit: number, window: number): RateLimiter {
    return new RateLimiter({
      config: {
        algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
        limit,
        window
      }
    });
  }

  /**
   * Create a fixed window rate limiter
   */
  static fixedWindow(limit: number, window: number): RateLimiter {
    return new RateLimiter({
      config: {
        algorithm: RateLimitAlgorithm.FIXED_WINDOW,
        limit,
        window
      }
    });
  }
}
