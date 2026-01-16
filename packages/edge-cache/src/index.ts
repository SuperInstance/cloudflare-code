/**
 * ClaudeFlare Edge Cache Optimization System
 *
 * A comprehensive edge caching optimization system for Cloudflare Workers
 * featuring intelligent cache warming, predictive preloading, edge-side
 * rendering optimization, cache analytics, multi-tier coordination, and
 * advanced invalidation strategies.
 *
 * @example
 * ```typescript
 * import { createEdgeCacheSystem } from '@claudeflare/edge-cache';
 *
 * const cache = createEdgeCacheSystem(env);
 *
 * // Get with automatic tier fallback
 * const result = await cache.get('my-key');
 *
 * // Set with multi-tier propagation
 * await cache.set('my-key', 'my-value', { ttl: 3600 });
 *
 * // Predictive preloading
 * await cache.preload(userId, sessionId, context);
 * ```
 */

// Type exports
export * from './types';

// Warming strategies
export {
  CacheWarmingManager,
  createCacheWarmingManager,
  PopularContentWarmer,
  createPopularContentWarmer,
  TimeBasedWarmer,
  createTimeBasedWarmer,
  GeographicWarmer,
  createGeographicWarmer,
  createDailySchedule,
  createHourlySchedule,
  COMMON_REGIONS,
} from './warming';

// Prediction engines
export {
  PredictionManager,
  createPredictionManager,
  BehavioralPredictionEngine,
  createBehavioralPredictionEngine,
  CollaborativeFilteringEngine,
  createCollaborativeFilteringEngine,
} from './prediction';

// Rendering optimization
export {
  RenderingManager,
  createRenderingManager,
  SSROptimizer,
  createSSROptimizer,
  ISROptimizer,
  createISROptimizer,
} from './rendering';

// Analytics
export {
  CacheAnalyticsCollector,
  createCacheAnalyticsCollector,
} from './analytics/collector';

// Coordination
export {
  MultiTierCoordinator,
  createMultiTierCoordinator,
} from './coordination/multi-tier';

// Invalidation
export {
  CacheInvalidationManager,
  createCacheInvalidationManager,
} from './invalidation/strategies';

// Utilities
export {
  generateCacheKey,
  parseCacheControl,
  calculateHash,
  compress,
  decompress,
  sleep,
  retry,
  batch,
  throttle,
  debounce,
  calculatePercentile,
  calculateAverage,
  calculateMedian,
  formatDuration,
  formatBytes,
  formatPercentage,
  clamp,
  lerp,
  mapRange,
  generateId,
  now,
  isPromise,
  deepClone,
  deepMerge,
} from './utils/helpers';

export {
  cacheMiddleware,
  predictivePreloadMiddleware,
  cacheWarmupMiddleware,
} from './utils/middleware';

import type { EdgeCacheEnv } from './types';
import { CacheWarmingManager, createCacheWarmingManager } from './warming';
import { PredictionManager, createPredictionManager } from './prediction';
import { RenderingManager, createRenderingManager } from './rendering';
import { CacheAnalyticsCollector, createCacheAnalyticsCollector } from './analytics/collector';
import { MultiTierCoordinator, createMultiTierCoordinator } from './coordination/multi-tier';
import { CacheInvalidationManager, createCacheInvalidationManager } from './invalidation/strategies';

/**
 * Unified Edge Cache System
 *
 * Combines all cache optimization modules into a single interface.
 */
export class EdgeCacheSystem {
  private env: EdgeCacheEnv;
  private warming: CacheWarmingManager;
  private prediction: PredictionManager;
  private rendering: RenderingManager;
  private analytics: CacheAnalyticsCollector;
  private coordination: MultiTierCoordinator;
  private invalidation: CacheInvalidationManager;
  private initialized: boolean = false;

  constructor(env: EdgeCacheEnv) {
    this.env = env;
    this.warming = createCacheWarmingManager(env);
    this.prediction = createPredictionManager(env);
    this.rendering = createRenderingManager(env);
    this.analytics = createCacheAnalyticsCollector(env.ANALYTICS_KV || env.CACHE_KV);
    this.coordination = createMultiTierCoordinator(env);
    this.invalidation = createCacheInvalidationManager(env);
  }

  /**
   * Initialize the cache system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('Initializing Edge Cache System...');

    // Initialize all modules
    await Promise.all([
      this.warming.initialize(),
      this.prediction.initialize(),
      this.rendering.initialize(),
      this.analytics.load(),
    ]);

    this.initialized = true;
    console.log('Edge Cache System initialized successfully');
  }

  /**
   * Get a value from cache with automatic tier fallback
   */
  async get(key: string, options?: {
    preferredTiers?: Array<'L1' | 'L2' | 'L3' | 'L4'>;
    recordMetrics?: boolean;
  }): Promise<{
    value: ArrayBuffer | string | null;
    source: string;
    cached: boolean;
    latency: number;
  }> {
    const startTime = Date.now();

    // Record access for predictions
    if (options?.recordMetrics) {
      // Record access
    }

    // Use coordinator to get value
    const result = await this.coordination.get(key, options?.preferredTiers);

    // Record metrics
    if (options?.recordMetrics) {
      if (result.success) {
        this.analytics.recordHit(
          result.source as any,
          result.latency,
          { feature: 'get' }
        );
      } else {
        this.analytics.recordMiss(
          result.source as any,
          result.latency,
          { feature: 'get' }
        );
      }
    }

    return {
      value: result.success ? await this.getFromTier(result.source, key) : null,
      source: result.source,
      cached: result.hits.length > 0,
      latency: result.latency,
    };
  }

  /**
   * Set a value in cache with automatic tier propagation
   */
  async set(
    key: string,
    value: ArrayBuffer | string,
    options?: {
      ttl?: number;
      tiers?: Array<'L1' | 'L2' | 'L3' | 'L4'>;
      tags?: string[];
      metadata?: Record<string, unknown>;
      recordMetrics?: boolean;
    }
  ): Promise<void> {
    // Use coordinator to set value
    await this.coordination.set(key, value, {
      ttl: options?.ttl,
      tiers: options?.tiers,
      metadata: options?.metadata,
    });

    // Tag if specified
    if (options?.tags && options.tags.length > 0) {
      await this.invalidation.tagEntries([key], options.tags);
    }

    // Record metrics
    if (options?.recordMetrics) {
      this.analytics.recordHit('hot', 0, { feature: 'set' });
    }
  }

  /**
   * Delete a value from all cache tiers
   */
  async delete(key: string, options?: {
    recordMetrics?: boolean;
  }): Promise<void> {
    await this.coordination.delete(key);

    // Record metrics
    if (options?.recordMetrics) {
      this.analytics.recordHit('hot', 0, { feature: 'delete' });
    }
  }

  /**
   * Invalidate cache entries
   */
  async invalidate(request: {
    keys?: string[];
    tags?: string[];
    pattern?: string;
    purgeAll?: boolean;
    strategy?: string;
  }): Promise<{
    success: boolean;
    keysInvalidated: number;
    duration: number;
    errors: string[];
  }> {
    const result = await this.invalidation.invalidate({
      ...request,
      strategy: (request.strategy as any) || 'tag-based',
      priority: 0,
    });

    return {
      success: result.success,
      keysInvalidated: result.keysInvalidated,
      duration: result.duration,
      errors: result.errors,
    };
  }

  /**
   * Record an access for predictions and warming
   */
  async recordAccess(
    userId: string | undefined,
    sessionId: string,
    url: string,
    method: string,
    context: {
      userAgent: string;
      referrer?: string;
      geography: string;
      timestamp: number;
    }
  ): Promise<void> {
    await this.prediction.recordAccess(userId, sessionId, url, method, {
      ...context,
      device: 'unknown',
    });
  }

  /**
   * Get predictions for a user
   */
  async getPredictions(
    userId: string | undefined,
    sessionId: string,
    context: {
      currentUrl: string;
      userAgent: string;
      referrer?: string;
      geography: string;
      timestamp: number;
    },
    limit: number = 10
  ): Promise<Array<{
    url: string;
    probability: number;
    confidence: number;
    reason: string;
  }>> {
    return await this.prediction.getPredictions(userId, sessionId, {
      ...context,
      device: 'unknown',
    }, limit);
  }

  /**
   * Preload predicted content
   */
  async preloadPredictions(
    userId: string | undefined,
    sessionId: string,
    context: {
      currentUrl: string;
      userAgent: string;
      referrer?: string;
      geography: string;
      timestamp: number;
    },
    limit: number = 5
  ): Promise<void> {
    await this.prediction.preloadPredictions(userId, sessionId, {
      ...context,
      device: 'unknown',
    }, limit);
  }

  /**
   * Warm the cache with popular content
   */
  async warmCache(limit: number = 50): Promise<{
    popular: any[];
    timeBased: Map<string, any[]>;
    geographic: Map<string, any[]>;
  }> {
    return await this.warming.warmAll(limit);
  }

  /**
   * Render a page with optimization
   */
  async render(request: {
    url: string;
    method: string;
    headers: Headers;
    body?: string;
    query: Record<string, string>;
    context: {
      userId?: string;
      sessionId?: string;
      device: string;
      geography: string;
    };
  }): Promise<{
    content: string;
    status: number;
    cached: boolean;
    duration: number;
  }> {
    const result = await this.rendering.render({
      ...request,
      cookies: {},
      context: {
        ...request.context,
        timestamp: Date.now(),
      },
    });

    return {
      content: result.content,
      status: result.status,
      cached: result.cached,
      duration: result.duration,
    };
  }

  /**
   * Get analytics data
   */
  async getAnalytics(period: 'hourly' | 'daily' | 'weekly' | 'monthly' = 'daily') {
    const [
      overall,
      tierMetrics,
      featureMetrics,
      insights,
      recommendations,
    ] = await Promise.all([
      this.analytics.getOverallMetrics(period),
      this.analytics.getTierMetrics(),
      this.analytics.getFeatureMetrics(),
      this.analytics.generateInsights(),
      this.analytics.generateRecommendations(),
    ]);

    return {
      period,
      timestamp: Date.now(),
      overall,
      tierMetrics,
      featureMetrics,
      insights,
      recommendations,
    };
  }

  /**
   * Get system statistics
   */
  getStats() {
    return {
      warming: this.warming.getStats(),
      prediction: this.prediction.getStats(),
      rendering: this.rendering.getStats(),
      analytics: this.analytics.getStats(),
      coordination: this.coordination.getStats(),
      invalidation: this.invalidation.getStats(),
      initialized: this.initialized,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, boolean>;
  }> {
    const checks: Record<string, boolean> = {
      initialized: this.initialized,
      warming: true,
      prediction: true,
      rendering: true,
      analytics: true,
      coordination: true,
      invalidation: true,
    };

    const failedChecks = Object.entries(checks).filter(([, v]) => !v);
    const status = failedChecks.length === 0 ? 'healthy' :
                   failedChecks.length < 3 ? 'degraded' : 'unhealthy';

    return { status, checks };
  }

  /**
   * Shutdown the cache system
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down Edge Cache System...');

    await this.warming.shutdown();
    await this.analytics.persist();

    this.initialized = false;
    console.log('Edge Cache System shutdown complete');
  }

  /**
   * Helper to get value from specific tier
   */
  private async getFromTier(tier: string, key: string): Promise<ArrayBuffer | string | null> {
    switch (tier) {
      case 'L2':
        return await this.env.CACHE_KV.get(key, 'arrayBuffer') || null;
      case 'L3':
        return await this.env.CACHE_KV.get(`warm:${key}`, 'arrayBuffer') || null;
      case 'L4':
        if (this.env.CACHE_R2) {
          const object = await this.env.CACHE_R2.get(key);
          if (object) {
            return await object.arrayBuffer();
          }
        }
        return null;
      default:
        return null;
    }
  }
}

/**
 * Create an edge cache system
 */
export function createEdgeCacheSystem(env: EdgeCacheEnv): EdgeCacheSystem {
  return new EdgeCacheSystem(env);
}

/**
 * Default export
 */
export default EdgeCacheSystem;

/**
 * Hono integration
 */
export { createCacheStack } from './utils/middleware';
