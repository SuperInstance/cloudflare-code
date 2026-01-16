/**
 * Multi-Tier Cache System
 * Orchestrates L1, L2, and L3 caches with automatic promotion/demotion
 */

import {
  CacheTier,
  CacheError,
} from '../types';

import type {
  CacheMetadata,
  CacheOptions,
  CacheResult,
  TierInfo,
  MultiTierCacheConfig,
  CacheContext,
  DeepPartial,
} from '../types';
import { L1Cache } from './l1-tier';
import { L2Cache } from './l2-tier';
import { L3Cache } from './l3-tier';
import { MetricsCollector, PerformanceMonitor } from '../utils/metrics';
import { calculateSize, validateKey } from '../utils/serializer';

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: MultiTierCacheConfig = {
  tiers: {
    L1: {
      tier: CacheTier.L1,
      maxSize: 128 * 1024 * 1024, // 128 MB
      maxEntries: 10000,
      ttl: 300000, // 5 minutes
      compressionEnabled: false,
      priority: 1,
    },
    L2: {
      tier: CacheTier.L2,
      maxSize: 1024 * 1024 * 1024, // 1 GB
      maxEntries: 1000000,
      ttl: 86400000, // 24 hours
      compressionEnabled: true,
      priority: 2,
    },
    L3: {
      tier: CacheTier.L3,
      maxSize: 100 * 1024 * 1024 * 1024, // 100 GB
      maxEntries: 10000000,
      ttl: 604800000, // 7 days
      compressionEnabled: true,
      priority: 3,
    },
  },
  warming: {
    type: 'predictive',
    config: {
      enabled: true,
      concurrency: 10,
      batchSize: 100,
      maxEntries: 1000,
      priority: 'medium',
      sourceTier: CacheTier.L3,
    } as const,
  },
  invalidation: {
    type: 'ttl',
    config: {
      propagateToAllTiers: true,
      backgroundProcessing: true,
      batchSize: 100,
      retries: 3,
      retryDelay: 1000,
    } as const,
  },
  prefetch: {
    enabled: true,
    maxConcurrent: 5,
    maxBytes: 50 * 1024 * 1024, // 50 MB
    threshold: 0.7,
    strategy: 'hybrid',
    learningEnabled: true,
  },
  compression: {
    algorithm: 'gzip',
    threshold: 1024, // 1 KB
    level: 6,
    enabled: true,
  },
  analytics: {
    enabled: true,
    retentionDays: 30,
    sampleRate: 1.0,
  },
  metrics: {
    enabled: true,
    exportInterval: 60000, // 1 minute
  },
};

// ============================================================================
// Multi-Tier Cache Implementation
// ============================================================================

export class MultiTierCache {
  private l1: L1Cache;
  private l2: L2Cache | null = null;
  private l3: L3Cache | null = null;
  private config: MultiTierCacheConfig;
  private metrics: MetricsCollector;
  private performance: PerformanceMonitor;
  private tierHistory = new Map<string, TierInfo>();

  constructor(
    context: CacheContext,
    config?: DeepPartial<MultiTierCacheConfig>
  ) {
    this.config = config ? this.mergeConfig(DEFAULT_CONFIG, config) : DEFAULT_CONFIG;

    // Initialize L1 cache (always available)
    this.l1 = new L1Cache(this.config.tiers.L1);

    // Initialize L2 cache if KV is available
    if (context.env.CACHE_KV) {
      this.l2 = new L2Cache(context.env.CACHE_KV, this.config.tiers.L2);
    }

    // Initialize L3 cache if R2 is available
    if (context.env.CACHE_R2) {
      this.l3 = new L3Cache(context.env.CACHE_R2, this.config.tiers.L3);
    }

    // Initialize metrics
    this.metrics = new MetricsCollector();
    this.performance = new PerformanceMonitor();

    // Set performance thresholds
    this.performance.setThreshold('L1_latency', 1); // 1ms
    this.performance.setThreshold('L2_latency', 10); // 10ms
    this.performance.setThreshold('L3_latency', 100); // 100ms
  }

  /**
   * Get a value from the cache
   */
  async get<T>(key: string, _options?: CacheOptions): Promise<CacheResult<T>> {
    const startTime = performance.now();
    const result: CacheResult<T> = {
      hit: false,
      value: null,
      tier: null,
      latency: 0,
      metadata: null,
    };

    try {
      if (!validateKey(key)) {
        throw new CacheError(`Invalid key: ${key}`, 'INVALID_KEY', undefined, key);
      }

      // Try L1 first
      const l1Start = performance.now();
      const l1Value = await this.l1.get<T>(key);
      const l1Latency = performance.now() - l1Start;

      if (l1Value !== null) {
        result.hit = true;
        result.value = l1Value;
        result.tier = CacheTier.L1;
        result.latency = l1Latency;

        this.metrics.recordHit(CacheTier.L1);
        this.metrics.recordLatency(CacheTier.L1, l1Latency);
        this.performance.record('L1_latency', l1Latency);

        const metadata = await this.getMetadata(key);
        result.metadata = metadata;

        return result;
      }

      this.metrics.recordMiss(CacheTier.L1);

      // Try L2 if available
      if (this.l2) {
        const l2Start = performance.now();
        const l2Value = await this.l2.get<T>(key);
        const l2Latency = performance.now() - l2Start;

        if (l2Value !== null) {
          result.hit = true;
          result.value = l2Value;
          result.tier = CacheTier.L2;
          result.latency = l2Latency;

          this.metrics.recordHit(CacheTier.L2);
          this.metrics.recordLatency(CacheTier.L2, l2Latency);
          this.performance.record('L2_latency', l2Latency);

          // Promote to L1
          await this.promote(key, l2Value, CacheTier.L2, CacheTier.L1);

          const metadata = await this.getMetadata(key);
          result.metadata = metadata;

          return result;
        }

        this.metrics.recordMiss(CacheTier.L2);
      }

      // Try L3 if available
      if (this.l3) {
        const l3Start = performance.now();
        const l3Value = await this.l3.get<T>(key);
        const l3Latency = performance.now() - l3Start;

        if (l3Value !== null) {
          result.hit = true;
          result.value = l3Value;
          result.tier = CacheTier.L3;
          result.latency = l3Latency;

          this.metrics.recordHit(CacheTier.L3);
          this.metrics.recordLatency(CacheTier.L3, l3Latency);
          this.performance.record('L3_latency', l3Latency);

          // Promote to L2 (and potentially L1)
          await this.promote(key, l3Value, CacheTier.L3, CacheTier.L2);

          const metadata = await this.getMetadata(key);
          result.metadata = metadata;

          return result;
        }

        this.metrics.recordMiss(CacheTier.L3);
      }

      // Cache miss
      result.latency = performance.now() - startTime;

      return result;
    } catch (error) {
      result.latency = performance.now() - startTime;
      throw error;
    }
  }

  /**
   * Set a value in the cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      if (!validateKey(key)) {
        throw new CacheError(`Invalid key: ${key}`, 'INVALID_KEY', undefined, key);
      }

      const size = calculateSize(value);
      const ttl = options?.ttl || this.config.tiers.L1.ttl;

      // Determine target tier based on size and options
      const targetTier = options?.tier || this.determineTargetTier(size);

      // Set in target tier
      switch (targetTier) {
        case CacheTier.L1:
          await this.l1.set(key, value, ttl);
          break;

        case CacheTier.L2:
          if (!this.l2) {
            throw new CacheError('L2 cache not available', 'TIER_UNAVAILABLE', CacheTier.L2);
          }
          await this.l2.set(key, value, ttl);
          // Also cache in L1 if small enough
          if (size <= this.config.tiers.L1.maxSize / 10) {
            await this.l1.set(key, value, Math.min(ttl, this.config.tiers.L1.ttl));
          }
          break;

        case CacheTier.L3:
          if (!this.l3) {
            throw new CacheError('L3 cache not available', 'TIER_UNAVAILABLE', CacheTier.L3);
          }
          await this.l3.set(key, value, ttl);
          // Also cache in L2 if available
          if (this.l2 && size <= this.config.tiers.L2.maxSize / 10) {
            await this.l2.set(key, value, Math.min(ttl, this.config.tiers.L2.ttl));
          }
          break;
      }

      // Record size metrics
      this.metrics.recordSize(targetTier, size);

      // Initialize tier history
      if (!this.tierHistory.has(key)) {
        this.tierHistory.set(key, {
          currentTier: targetTier,
          tierHistory: [{
            from: CacheTier.L1, // Virtual starting tier
            to: targetTier,
            timestamp: Date.now(),
            reason: 'access_frequency',
          }],
          promotionCount: 0,
          demotionCount: 0,
        });
      }
    } catch (error) {
      throw new CacheError(
        `Failed to set key ${key}: ${error}`,
        'SET_FAILED',
        undefined,
        key
      );
    }
  }

  /**
   * Delete a value from all tiers
   */
  async delete(key: string): Promise<boolean> {
    try {
      if (!validateKey(key)) {
        throw new CacheError(`Invalid key: ${key}`, 'INVALID_KEY', undefined, key);
      }

      // Delete from all tiers
      const results = await Promise.all([
        this.l1.delete(key),
        this.l2?.delete(key),
        this.l3?.delete(key),
      ]);

      this.tierHistory.delete(key);

      return results.some(r => r === true);
    } catch (error) {
      throw new CacheError(
        `Failed to delete key ${key}: ${error}`,
        'DELETE_FAILED',
        undefined,
        key
      );
    }
  }

  /**
   * Check if a key exists in any tier
   */
  async has(key: string): Promise<boolean> {
    try {
      if (await this.l1.has(key)) return true;
      if (this.l2 && await this.l2.has(key)) return true;
      if (this.l3 && await this.l3.has(key)) return true;
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Clear all tiers
   */
  async clear(): Promise<void> {
    await Promise.all([
      this.l1.clear(),
      this.l2?.clear(),
      this.l3?.clear(),
    ]);
    this.tierHistory.clear();
    this.metrics.reset();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return this.metrics.getStats();
  }

  /**
   * Get tier information for a key
   */
  async getTierInfo(key: string): Promise<TierInfo | null> {
    return this.tierHistory.get(key) || null;
  }

  /**
   * Promote a value to a higher tier
   */
  private async promote<T>(
    key: string,
    value: T,
    fromTier: CacheTier,
    toTier: CacheTier
  ): Promise<void> {
    try {
      const size = calculateSize(value);
      const ttl = this.config.tiers[toTier].ttl;

      // Set in target tier
      switch (toTier) {
        case CacheTier.L1:
          await this.l1.set(key, value, ttl);
          break;

        case CacheTier.L2:
          if (this.l2) {
            await this.l2.set(key, value, ttl);
          }
          break;
      }

      // Update tier history
      const info = this.tierHistory.get(key);
      if (info) {
        info.currentTier = toTier;
        info.tierHistory.push({
          from: fromTier,
          to: toTier,
          timestamp: Date.now(),
          reason: 'access_frequency',
        });
        info.promotionCount++;
      }

      // Record size in new tier
      this.metrics.recordSize(toTier, size);
    } catch (error) {
      console.error(`Failed to promote ${key} from ${fromTier} to ${toTier}:`, error);
    }
  }


  /**
   * Determine the best tier for a value based on size
   */
  private determineTargetTier(size: number): CacheTier {
    if (size <= this.config.tiers.L1.maxSize / 10) {
      return CacheTier.L1;
    } else if (size <= this.config.tiers.L2.maxSize / 10) {
      return CacheTier.L2;
    } else {
      return CacheTier.L3;
    }
  }

  /**
   * Get metadata for a key
   */
  private async getMetadata(key: string): Promise<CacheMetadata | null> {
    // Try to get metadata from L1
    const l1Entries = this.l1.getEntries();
    const l1Entry = l1Entries.find(e => e.key === key);
    if (l1Entry) {
      return l1Entry.metadata;
    }

    // Try L2
    if (this.l2) {
      const l2Metadata = await this.l2.getMetadata(key);
      if (l2Metadata) {
        return l2Metadata;
      }
    }

    // Try L3
    if (this.l3) {
      const l3Metadata = await this.l3.getMetadata(key);
      if (l3Metadata) {
        return l3Metadata;
      }
    }

    return null;
  }

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(
    defaults: MultiTierCacheConfig,
    config: DeepPartial<MultiTierCacheConfig>
  ): MultiTierCacheConfig {
    return {
      tiers: {
        L1: { ...defaults.tiers.L1, ...config.tiers?.L1 },
        L2: { ...defaults.tiers.L2, ...config.tiers?.L2 },
        L3: { ...defaults.tiers.L3, ...config.tiers?.L3 },
      },
      warming: { ...defaults.warming, ...config.warming } as any,
      invalidation: { ...defaults.invalidation, ...config.invalidation } as any,
      prefetch: { ...defaults.prefetch, ...config.prefetch },
      compression: { ...defaults.compression, ...config.compression },
      analytics: { ...defaults.analytics, ...config.analytics },
      metrics: { ...defaults.metrics, ...config.metrics },
    };
  }

  /**
   * Get or set pattern
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const result = await this.get<T>(key, options);

    if (result.hit && result.value !== null) {
      return result.value;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Get multiple values at once
   */
  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();

    await Promise.all(
      keys.map(async key => {
        const result = await this.get<T>(key);
        if (result.hit && result.value !== null) {
          results.set(key, result.value);
        }
      })
    );

    return results;
  }

  /**
   * Set multiple values at once
   */
  async setMany<T>(entries: Map<string, T>, options?: CacheOptions): Promise<void> {
    await Promise.all(
      Array.from(entries.entries()).map(([key, value]) =>
        this.set(key, value, options)
      )
    );
  }

  /**
   * Perform cache maintenance
   */
  async maintain(): Promise<void> {
    // Clean expired entries from L1
    await this.l1.cleanExpired();

    // Additional maintenance tasks can be added here
  }

  /**
   * Get health status
   */
  getHealth(): {
    healthy: boolean;
    tiers: {
      L1: boolean;
      L2: boolean;
      L3: boolean;
    };
  } {
    return {
      healthy: true,
      tiers: {
        L1: true,
        L2: this.l2 !== null,
        L3: this.l3 !== null,
      },
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createMultiTierCache(
  context: CacheContext,
  config?: DeepPartial<MultiTierCacheConfig>
): MultiTierCache {
  return new MultiTierCache(context, config);
}
