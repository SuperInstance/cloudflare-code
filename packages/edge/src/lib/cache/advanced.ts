/**
 * Advanced Cache Manager
 *
 * Integrates all advanced caching strategies into a unified system:
 * - SIEVE eviction algorithm
 * - Cache warming
 * - Predictive prefetching
 * - Cross-DO coherence
 * - Analytics and insights
 *
 * Architecture:
 * ```
 * AdvancedCacheManager
 * ├── SieveCache (HOT tier with SIEVE eviction)
 * ├── SemanticCache (multi-tier caching)
 * ├── CacheWarmingManager (pattern-based warming)
 * ├── PredictiveCacheManager (ML-based prefetching)
 * ├── CacheCoherenceManager (cross-DO sync)
 * └── CacheAnalyticsManager (metrics & insights)
 * ```
 *
 * Performance Targets:
 * - Hit Rate: >80%
 * - Latency: <50ms (P95)
 * - Eviction Overhead: <5ms
 * - Coherence Delay: <100ms
 */

import type { ChatResponse } from '@claudeflare/shared';
import type { DurableObjectState } from '@cloudflare/workers-types';
import type { SemanticCache, SemanticCacheOptions } from './semantic';
import type { KVCache } from '../kv';
import type { SieveCache, SieveCacheOptions } from './sieve';
import type { CacheWarmingManager, CacheWarmingOptions } from './warming';
import type { PredictiveCacheManager, PredictiveCacheOptions } from './predictive';
import type { CacheCoherenceManager, CacheCoherenceOptions } from './coherence';
import type { CacheAnalyticsManager, CacheAnalyticsOptions } from './analytics';

import { SemanticCache as SemanticCacheImpl } from './semantic';
import { SieveCache as SieveCacheImpl } from './sieve';
import { CacheWarmingManager as CacheWarmingManagerImpl } from './warming';
import { PredictiveCacheManager as PredictiveCacheManagerImpl } from './predictive';
import { CacheCoherenceManager as CacheCoherenceManagerImpl } from './coherence';
import { CacheAnalyticsManager as CacheAnalyticsManagerImpl } from './analytics';

export interface AdvancedCacheOptions {
  /**
   * Semantic cache options
   */
  semantic?: SemanticCacheOptions;

  /**
   * SIEVE cache options
   */
  sieve?: SieveCacheOptions;

  /**
   * Cache warming options
   */
  warming?: CacheWarmingOptions;

  /**
   * Predictive cache options
   */
  predictive?: PredictiveCacheOptions;

  /**
   * Cache coherence options
   */
  coherence?: CacheCoherenceOptions;

  /**
   * Analytics options
   */
  analytics?: CacheAnalyticsOptions;

  /**
   * Durable Object state (for coherence)
   */
  state?: DurableObjectState;

  /**
   * KV cache (for persistence)
   */
  kvCache?: KVCache;

  /**
   * Provider for generating responses
   */
  provider?: (query: string, metadata: Record<string, unknown>) => Promise<ChatResponse>;

  /**
   * Enable all advanced features
   * @default true
   */
  enableAdvanced?: boolean;

  /**
   * Enable SIEVE eviction
   * @default true
   */
  enableSieve?: boolean;

  /**
   * Enable cache warming
   * @default true
   */
  enableWarming?: boolean;

  /**
   * Enable predictive prefetching
   * @default true
   */
  enablePredictive?: boolean;

  /**
   * Enable cross-DO coherence
   * @default true
   */
  enableCoherence?: boolean;

  /**
   * Enable analytics
   * @default true
   */
  enableAnalytics?: boolean;

  /**
   * Broadcast function for coherence
   */
  onBroadcast?: (message: unknown) => Promise<void>;
}

export interface AdvancedCacheResult {
  response: ChatResponse | null;
  hit: boolean;
  similarity: number;
  source: 'hot' | 'warm' | 'cold' | 'miss';
  latency: number;
  metadata?: {
    tier: string;
    evicted: boolean;
    prefetched: boolean;
    warmed: boolean;
    coherent: boolean;
  };
}

export interface AdvancedCacheStats {
  semantic: ReturnType<SemanticCacheImpl['getStats']>;
  sieve: ReturnType<SieveCacheImpl['getStats']>;
  warming: ReturnType<CacheWarmingManagerImpl['getStats']>;
  predictive: ReturnType<PredictiveCacheManagerImpl['getStats']>;
  coherence: ReturnType<CacheCoherenceManagerImpl['getStats']>;
  analytics: ReturnType<CacheAnalyticsManagerImpl['getRealTimeMetrics']>;
  summary: {
    overallHitRate: number;
    avgLatency: number;
    totalQueries: number;
    tokensSaved: number;
    costSaved: number;
  };
}

/**
 * Advanced Cache Manager
 *
 * Unified cache manager with all advanced strategies.
 */
export class AdvancedCacheManager {
  private options: Required<AdvancedCacheOptions>;
  private semanticCache: SemanticCache;
  private sieveCache: SieveCache<string, ChatResponse>;
  private warmingManager: CacheWarmingManager;
  private predictiveManager: PredictiveCacheManager;
  private coherenceManager: CacheCoherenceManager | null;
  private analyticsManager: CacheAnalyticsManager;

  constructor(options: AdvancedCacheOptions = {}) {
    this.options = {
      semantic: options.semantic ?? {},
      sieve: options.sieve ?? {},
      warming: options.warming ?? {},
      predictive: options.predictive ?? {},
      coherence: options.coherence ?? {},
      analytics: options.analytics ?? {},
      state: options.state!,
      kvCache: options.kvCache!,
      provider: options.provider!,
      enableAdvanced: options.enableAdvanced ?? true,
      enableSieve: options.enableSieve ?? true,
      enableWarming: options.enableWarming ?? true,
      enablePredictive: options.enablePredictive ?? true,
      enableCoherence: options.enableCoherence ?? true,
      enableAnalytics: options.enableAnalytics ?? true,
      onBroadcast: options.onBroadcast!,
    };

    // Initialize SIEVE cache
    this.sieveCache = new SieveCacheImpl(this.options.sieve);

    // Initialize semantic cache
    this.semanticCache = new SemanticCacheImpl(this.options.semantic);

    // Initialize cache warming manager
    this.warmingManager = new CacheWarmingManagerImpl({
      ...this.options.warming,
      kvCache: this.options.kvCache,
      semanticCache: this.semanticCache,
      provider: this.options.provider,
    });

    // Initialize predictive cache manager
    this.predictiveManager = new PredictiveCacheManagerImpl({
      ...this.options.predictive,
      semanticCache: this.semanticCache,
      provider: this.options.provider,
    });

    // Initialize coherence manager (requires DO state)
    this.coherenceManager = null;
    if (this.options.enableCoherence && this.options.state) {
      this.coherenceManager = new CacheCoherenceManagerImpl(this.options.state, {
        ...this.options.coherence,
        onInvalidate: async (keys) => {
          // Invalidate local cache
          for (const key of keys) {
            this.semanticCache.check(key, {}).catch(() => {});
          }
        },
        onUpdate: async (entries) => {
          // Update local cache
          for (const [key, value] of entries.entries()) {
            await this.semanticCache.store(key, value as ChatResponse, {});
          }
        },
        onBroadcast: this.options.onBroadcast,
      });
    }

    // Initialize analytics manager
    this.analyticsManager = new CacheAnalyticsManagerImpl(this.options.analytics);

    // Start background tasks
    this.startBackgroundTasks();
  }

  /**
   * Check cache with all advanced strategies
   *
   * @param query - Query to check
   * @param metadata - Query metadata
   * @returns Cache result
   */
  async check(
    query: string,
    metadata: Record<string, unknown> = {}
  ): Promise<AdvancedCacheResult> {
    const startTime = performance.now();

    // Check SIEVE cache (HOT tier)
    const sieveResult = this.sieveCache.get(query);

    if (sieveResult.hit) {
      // Record in analytics
      this.recordAccess(query, true, 'hot', performance.now() - startTime, metadata);

      return {
        response: sieveResult.value,
        hit: true,
        similarity: 1.0,
        source: 'hot',
        latency: performance.now() - startTime,
        metadata: {
          tier: 'hot',
          evicted: false,
          prefetched: false,
          warmed: false,
          coherent: true,
        },
      };
    }

    // Check semantic cache
    const semanticResult = await this.semanticCache.check(query, metadata);

    if (semanticResult.hit && semanticResult.response) {
      // Add to SIEVE cache (promotion)
      this.sieveCache.set(query, semanticResult.response);

      // Record in analytics
      this.recordAccess(query, true, semanticResult.source, performance.now() - startTime, metadata);

      // Record in warming manager
      if (this.options.enableWarming) {
        this.warmingManager.recordAccess(query, metadata, true);
      }

      return {
        response: semanticResult.response,
        hit: true,
        similarity: semanticResult.similarity,
        source: semanticResult.source,
        latency: performance.now() - startTime,
        metadata: {
          tier: semanticResult.source,
          evicted: false,
          prefetched: false,
          warmed: false,
          coherent: true,
        },
      };
    }

    // Cache miss - record in analytics
    this.recordAccess(query, false, 'cold', performance.now() - startTime, metadata);

    // Record in warming manager
    if (this.options.enableWarming) {
      this.warmingManager.recordAccess(query, metadata, false);
    }

    // Record in predictive manager
    if (this.options.enablePredictive) {
      this.predictiveManager.recordQuery(query, {
        recentQueries: metadata.recentQueries as string[] ?? [],
        sessionId: metadata.sessionId as string ?? 'default',
        userId: metadata.userId as string,
        language: metadata.language as string,
        framework: metadata.framework as string,
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
      });

      // Trigger predictive prefetching
      this.predictiveManager.prefetch({
        recentQueries: metadata.recentQueries as string[] ?? [],
        sessionId: metadata.sessionId as string ?? 'default',
        userId: metadata.userId as string,
        language: metadata.language as string,
        framework: metadata.framework as string,
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
      }).catch(() => {});
    }

    return {
      response: null,
      hit: false,
      similarity: 0,
      source: 'miss',
      latency: performance.now() - startTime,
      metadata: {
        tier: 'miss',
        evicted: false,
        prefetched: false,
        warmed: false,
        coherent: true,
      },
    };
  }

  /**
   * Store response in cache
   *
   * @param query - Query key
   * @param response - Response to cache
   * @param metadata - Cache metadata
   */
  async store(
    query: string,
    response: ChatResponse,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    // Store in SIEVE cache
    this.sieveCache.set(query, response);

    // Store in semantic cache
    await this.semanticCache.store(query, response, metadata);
  }

  /**
   * Invalidate cache entries
   *
   * @param keys - Keys to invalidate
   */
  async invalidate(keys: string[]): Promise<void> {
    // Invalidate from SIEVE cache
    for (const key of keys) {
      this.sieveCache.delete(key);
    }

    // Invalidate from semantic cache
    await this.semanticCache.clear();

    // Invalidate across DOs (if coherence enabled)
    if (this.coherenceManager) {
      await this.coherenceManager.invalidate(keys);
    }
  }

  /**
   * Warm cache with predicted queries
   *
   * @returns Number of entries warmed
   */
  async warmCache(): Promise<number> {
    if (!this.options.enableWarming) {
      return 0;
    }

    return await this.warmingManager.warmCache();
  }

  /**
   * Predict next queries
   *
   * @param recentQueries - Recent query history
   * @param sessionId - Session ID
   * @returns Predicted queries
   */
  predictNextQueries(recentQueries: string[], sessionId: string): string[] {
    if (!this.options.enablePredictive) {
      return [];
    }

    return this.predictiveManager.predictNextQueries({
      recentQueries,
      sessionId,
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
    }).map(p => p.query);
  }

  /**
   * Generate analytics report
   *
   * @param period - Time period for report (ms)
   */
  generateReport(period?: number) {
    if (!this.options.enableAnalytics) {
      return null;
    }

    return this.analyticsManager.generateReport(period);
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): AdvancedCacheStats {
    const semanticStats = this.semanticCache.getStats();
    const sieveStats = this.sieveCache.getStats();
    const warmingStats = this.warmingManager.getStats();
    const predictiveStats = this.predictiveManager.getStats();
    const coherenceStats = this.coherenceManager?.getStats() ?? {
      invalidationsReceived: 0,
      invalidationsSent: 0,
      invalidationsFailed: 0,
      updatesReceived: 0,
      updatesSent: 0,
      syncsReceived: 0,
      syncsSent: 0,
      avgInvalidationLatency: 0,
      antiEntropyRuns: 0,
      conflictsDetected: 0,
      conflictsResolved: 0,
    };
    const analyticsStats = this.analyticsManager.getRealTimeMetrics();

    // Calculate summary
    const totalQueries = semanticStats.metrics.totalQueries;
    const totalHits = semanticStats.metrics.hotHits +
                      semanticStats.metrics.warmHits +
                      semanticStats.metrics.coldHits;
    const overallHitRate = totalQueries > 0 ? (totalHits / totalQueries) * 100 : 0;
    const avgLatency = semanticStats.avgLatency;
    const tokensSaved = semanticStats.metrics.tokensSaved;
    const costSaved = semanticStats.metrics.costSaved;

    return {
      semantic: semanticStats,
      sieve: sieveStats,
      warming: warmingStats,
      predictive: predictiveStats,
      coherence: coherenceStats,
      analytics: analyticsStats,
      summary: {
        overallHitRate,
        avgLatency,
        totalQueries,
        tokensSaved,
        costSaved,
      },
    };
  }

  /**
   * Handle incoming coherence message
   *
   * @param message - Coherence message
   */
  async handleCoherenceMessage(message: unknown): Promise<void> {
    if (!this.coherenceManager) {
      return;
    }

    await this.coherenceManager.handleInvalidation(message as any);
  }

  /**
   * Clear all cache data
   */
  async clear(): Promise<void> {
    this.sieveCache.clear();
    await this.semanticCache.clear();
    this.warmingManager.clearPatterns();
    this.predictiveManager.clearPatterns();
    this.coherenceManager?.clearVersions();
    this.analyticsManager.clear();
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    this.coherenceManager?.destroy();
  }

  /**
   * Record access in analytics
   *
   * @private
   */
  private recordAccess(
    key: string,
    hit: boolean,
    tier: 'hot' | 'warm' | 'cold',
    latency: number,
    metadata: Record<string, unknown>
  ): void {
    if (!this.options.enableAnalytics) {
      return;
    }

    this.analyticsManager.recordAccess(key, hit, tier, latency, metadata);
  }

  /**
   * Start background tasks
   *
   * @private
   */
  private startBackgroundTasks(): void {
    // Periodic cache warming (every hour)
    if (this.options.enableWarming) {
      setInterval(async () => {
        await this.warmCache();
      }, 60 * 60 * 1000); // 1 hour
    }

    // Periodic analytics aggregation (every minute)
    if (this.options.enableAnalytics) {
      setInterval(() => {
        this.analyticsManager.getRealTimeMetrics();
      }, 60 * 1000); // 1 minute
    }
  }
}

/**
 * Create an advanced cache manager
 */
export function createAdvancedCacheManager(
  options?: AdvancedCacheOptions
): AdvancedCacheManager {
  return new AdvancedCacheManager(options);
}

/**
 * Default advanced cache manager
 */
export const defaultAdvancedCacheManager = new AdvancedCacheManager();

// Export all components
export { SemanticCacheImpl as SemanticCache };
export { SieveCacheImpl as SieveCache };
export { CacheWarmingManagerImpl as CacheWarmingManager };
export { PredictiveCacheManagerImpl as PredictiveCacheManager };
export { CacheCoherenceManagerImpl as CacheCoherenceManager };
export { CacheAnalyticsManagerImpl as CacheAnalyticsManager };

// Re-export types
export type { SemanticCacheOptions, CachedResponse, CacheMetadata, SemanticCacheResult } from './semantic';
export type { SieveCacheEntry, SieveCacheOptions, SieveCacheStats, SieveCacheResult } from './sieve';
export type { AccessPattern, TimePattern, SessionPattern, CacheWarmingOptions, WarmStats } from './warming';
export type { QueryFeatures, SequentialPattern, MarkovState, PredictionContext, PredictionResult, PredictiveCacheOptions, PredictiveStats } from './predictive';
export type { CacheInvalidationMessage, CacheEntryVersion, VectorClock, CacheCoherenceOptions, CoherenceStats } from './coherence';
export type { CacheMetric, AccessLogEntry, CacheInsight, TimeSeriesData, DistributionData, CacheAnalyticsOptions, CacheAnalyticsReport } from './analytics';
