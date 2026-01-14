/**
 * ClaudeFlare Multi-Tier Caching System
 * Version 2.0.0
 *
 * A comprehensive caching solution for distributed AI platforms
 */

// ============================================================================
// Core Types
// ============================================================================

export * from './types';

// ============================================================================
// Tier Implementations
// ============================================================================

export { L1Cache, createL1Cache } from './tiers/l1-tier';
export { L2Cache, createL2Cache } from './tiers/l2-tier';
export { L3Cache, createL3Cache } from './tiers/l3-tier';
export { MultiTierCache, createMultiTierCache } from './tiers/multi-tier';

// ============================================================================
// Cache Warming
// ============================================================================

export { CacheWarmer, createCacheWarmer } from './warming/warmer';

// ============================================================================
// Cache Invalidation
// ============================================================================

export { InvalidationEngine, createInvalidationEngine } from './invalidation/engine';

// ============================================================================
// Cache Prefetching
// ============================================================================

export { CachePrefetcher, createCachePrefetcher } from './prefetch/prefetcher';

// ============================================================================
// Compression
// ============================================================================

export {
  CacheCompressor,
  createCacheCompressor,
  isCompressed,
  detectCompressionAlgorithm,
  calculateSizeDifference,
} from './compression/compressor';

// ============================================================================
// Analytics
// ============================================================================

export {
  AnalyticsCollector,
  AnalyticsReporter,
  createAnalyticsCollector,
  createAnalyticsReporter,
} from './analytics/analytics';

// ============================================================================
// Metrics
// ============================================================================

export {
  MetricsCollector,
  PerformanceMonitor,
  AlertSystem,
  formatMetricsForExport,
  toPrometheusFormat,
} from './utils/metrics';

// ============================================================================
// Configuration
// ============================================================================

export {
  DEFAULT_PRODUCTION_CONFIG,
  DEFAULT_DEVELOPMENT_CONFIG,
  DEFAULT_TESTING_CONFIG,
  getConfigForEnvironment,
  validateConfig,
} from './config/default';

// ============================================================================
// Serialization Utilities
// ============================================================================

export {
  compress,
  decompress,
  serialize,
  deserialize,
  serializeCompressed,
  deserializeCompressed,
  calculateSize,
  calculateStringSize,
  calculateBytesSize,
  generateHash,
  generateCacheKey,
  validateKey,
  validateTags,
  validateTTL,
  encodeValue,
  decodeValue,
  base64Encode,
  base64Decode,
  isSerializable,
  isPlainObject,
  isDate,
  isBuffer,
  customSerialize,
  customDeserialize,
} from './utils/serializer';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '2.0.0';
export const BUILD_DATE = new Date().toISOString();

// ============================================================================
// Convenience Factory
// ============================================================================>

import { createMultiTierCache } from './tiers/multi-tier';
import { createCacheWarmer } from './warming/warmer';
import { createInvalidationEngine } from './invalidation/engine';
import { createCachePrefetcher } from './prefetch/prefetcher';
import { createAnalyticsCollector } from './analytics/analytics';
import { CacheContext, DeepPartial, MultiTierCacheConfig } from './types';

/**
 * Create a complete cache system with all components
 */
export function createCacheSystem(
  context: CacheContext,
  config?: DeepPartial<MultiTierCacheConfig>
) {
  const cache = createMultiTierCache(context, config);

  const warmer = config?.warming?.config?.enabled
    ? createCacheWarmer(cache, config.warming.config)
    : null;

  const invalidation = createInvalidationEngine(cache, config?.invalidation?.config);

  const prefetcher = config?.prefetch?.enabled
    ? createCachePrefetcher(cache, config.prefetch)
    : null;

  const analytics = config?.analytics?.enabled
    ? createAnalyticsCollector()
    : null;

  return {
    cache,
    warmer,
    invalidation,
    prefetcher,
    analytics,

    /**
     * Get a value from cache with optional prefetch
     */
    async get<T>(key: string, userId?: string) {
      const result = await cache.get<T>(key);

      // Record access for analytics
      if (analytics) {
        analytics.recordAccess(key, result.tier || CacheTier.L1, result.hit, 0);
      }

      // Record access for warmer
      if (warmer) {
        warmer.recordAccess(key);
      }

      // Trigger prefetch
      if (prefetcher && result.hit) {
        prefetcher.recordAccess(key, userId);
        prefetcher.prefetch(key, userId).catch(console.error);
      }

      return result;
    },

    /**
     * Set a value in cache
     */
    async set<T>(key: string, value: T, options?: any) {
      await cache.set(key, value, options);

      // Add tags if provided
      if (options?.tags && invalidation) {
        invalidation.addTags(key, options.tags);
      }

      // Set TTL if provided
      if (options?.ttl && invalidation) {
        invalidation.setTTL(key, options.ttl);
      }
    },

    /**
     * Delete a value from cache
     */
    async delete(key: string) {
      return cache.delete(key);
    },

    /**
     * Get cache statistics
     */
    getStats() {
      return cache.getStats();
    },

    /**
     * Get health status
     */
    getHealth() {
      return cache.getHealth();
    },

    /**
     * Run maintenance tasks
     */
    async maintain() {
      await cache.maintain();

      if (analytics) {
        analytics.clearOld();
      }
    },
  };
}

// Re-export CacheTier for convenience
import { CacheTier } from './types';
export { CacheTier };
