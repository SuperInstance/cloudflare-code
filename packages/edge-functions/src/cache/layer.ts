/**
 * Cache Layer
 *
 * Provides edge caching with support for API response caching,
 * dynamic content caching, cache warming, invalidation, and
 * stale-while-revalidate patterns.
 */

import {
  EdgeEnv,
  CacheConfig,
  CacheEntry,
  CacheStats,
  CacheKeyStrategy,
  EdgeFunction,
} from '../types/index.js';

// ============================================================================
// Cache Configuration
// ============================================================================

/**
 * Cache layer configuration
 */
export interface CacheLayerConfig {
  /**
   * Default cache TTL (seconds)
   * @default 60
   */
  defaultTTL?: number;

  /**
   * Maximum cache size (entries)
   * @default 1000
   */
  maxSize?: number;

  /**
   * Maximum entry size (bytes)
   * @default 1048576 (1MB)
   */
  maxEntrySize?: number;

  /**
   * Enable stale-while-revalidate
   * @default true
   */
  enableStaleWhileRevalidate?: number;

  /**
   * Default stale-while-revalidate time (seconds)
   * @default 60
   */
  staleWhileRevalidate?: number;

  /**
   * Enable cache warming
   * @default true
   */
  enableCacheWarming?: boolean;

  /**
   * Cache warming interval (ms)
   * @default 60000 (1 minute)
   */
  cacheWarmingInterval?: number;

  /**
   * Enable cache metrics
   * @default true
   */
  enableMetrics?: boolean;

  /**
   * Cache key strategy
   * @default 'default'
   */
  keyStrategy?: CacheKeyStrategy;

  /**
   * Custom key generator
   */
  customKeyGenerator?: (functionId: string, input: unknown) => string;

  /**
   * Storage backend
   * @default 'memory'
   */
  storage?: CacheStorage;

  /**
   * KV namespace for persistent cache
   */
  kvNamespace?: string;
}

/**
 * Cache storage backend
 */
export type CacheStorage = 'memory' | 'kv' | 'hybrid';

// ============================================================================
// Cache Errors
// ============================================================================

/**
 * Base error for cache errors
 */
export class CacheError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly key?: string
  ) {
    super(message);
    this.name = 'CacheError';
  }
}

/**
 * Error thrown when cache entry is too large
 */
export class EntryTooLargeError extends CacheError {
  constructor(
    message: string,
    key: string,
    public readonly size: number,
    public readonly maxSize: number
  ) {
    super(message, 'ENTRY_TOO_LARGE', key);
    this.name = 'EntryTooLargeError';
  }
}

/**
 * Error thrown when cache is full
 */
export class CacheFullError extends CacheError {
  constructor(message: string) {
    super(message, 'CACHE_FULL');
    this.name = 'CacheFullError';
  }
}

// ============================================================================
// Cache Layer
// ============================================================================

/**
 * Advanced edge caching layer with multiple strategies
 */
export class CacheLayer {
  private readonly config: Required<CacheLayerConfig>;
  private readonly memoryCache: Map<string, CacheEntry>;
  private readonly stats: Map<string, CacheStats>;
  private readonly warmingTasks: Map<string, ReturnType<typeof setInterval>>;
  private currentSize: number = 0;

  constructor(config: CacheLayerConfig = {}) {
    this.config = {
      defaultTTL: 60,
      maxSize: 1000,
      maxEntrySize: 1048576,
      enableStaleWhileRevalidate: true,
      staleWhileRevalidate: 60,
      enableCacheWarming: true,
      cacheWarmingInterval: 60000,
      enableMetrics: true,
      keyStrategy: 'default',
      storage: 'memory',
      customKeyGenerator: () => '',
      kvNamespace: 'CACHE',
      ...config,
      customKeyGenerator: config.customKeyGenerator || this.defaultKeyGenerator,
    };

    this.memoryCache = new Map();
    this.stats = new Map();
    this.warmingTasks = new Map();
  }

  // ========================================================================
  // Cache Operations
  // ========================================================================

  /**
   * Get a value from cache
   */
  async get<T = unknown>(
    functionId: string,
    input: unknown,
    env?: EdgeEnv
  ): Promise<T | null> {
    const key = this.generateKey(functionId, input);

    // Try memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      this.updateStats(functionId, true);
      memoryEntry.metadata!.hits++;
      memoryEntry.metadata!.lastAccessed = Date.now();
      return memoryEntry.value as T;
    }

    // Check for stale-while-revalidate
    if (memoryEntry && this.isStale(memoryEntry)) {
      const staleEntry = memoryEntry;
      this.updateStats(functionId, true);

      // Trigger background revalidation
      this.revalidateInBackground(functionId, input, key, env).catch(console.error);

      return staleEntry.value as T;
    }

    // Try KV cache if using hybrid or kv storage
    if (this.config.storage !== 'memory' && env) {
      try {
        const kvEntry = await this.getFromKV<T>(key, env);
        if (kvEntry) {
          this.updateStats(functionId, true);
          // Store in memory cache for faster access next time
          this.memoryCache.set(key, kvEntry);
          return kvEntry.value as T;
        }
      } catch (error) {
        console.error('KV cache read error:', error);
      }
    }

    this.updateStats(functionId, false);
    return null;
  }

  /**
   * Set a value in cache
   */
  async set<T = unknown>(
    functionId: string,
    input: unknown,
    value: T,
    config?: Partial<CacheConfig>,
    env?: EdgeEnv
  ): Promise<void> {
    const key = this.generateKey(functionId, input);
    const ttl = config?.ttl ?? this.config.defaultTTL;
    const staleWhileRevalidate = config?.staleWhileRevalidate ?? this.config.staleWhileRevalidate;

    // Check if value should be cached
    if (config?.bypassCache && config.bypassCache(input)) {
      return;
    }

    // Calculate entry size
    const size = this.calculateSize(value);
    if (size > this.config.maxEntrySize) {
      throw new EntryTooLargeError(
        `Entry size ${size} exceeds maximum ${this.config.maxEntrySize}`,
        key,
        size,
        this.config.maxEntrySize
      );
    }

    const now = Date.now();
    const entry: CacheEntry<T> = {
      value,
      expiresAt: now + ttl * 1000,
      createdAt: now,
      key,
      metadata: {
        functionId,
        version: '1.0.0',
        hits: 0,
        lastAccessed: now,
      },
    };

    // Check if cache is full
    if (this.memoryCache.size >= this.config.maxSize && !this.memoryCache.has(key)) {
      this.evictLRU();
    }

    // Store in memory cache
    this.memoryCache.set(key, entry);
    this.currentSize += size;

    // Store in KV if using hybrid or kv storage
    if (this.config.storage !== 'memory' && env) {
      try {
        await this.setToKV(key, entry, env);
      } catch (error) {
        console.error('KV cache write error:', error);
      }
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(functionId: string, input: unknown, env?: EdgeEnv): Promise<boolean> {
    const key = this.generateKey(functionId, input);

    // Delete from memory cache
    const deleted = this.memoryCache.delete(key);
    if (deleted) {
      this.currentSize -= this.estimateSize(key);
    }

    // Delete from KV if using hybrid or kv storage
    if (this.config.storage !== 'memory' && env) {
      try {
        await this.deleteFromKV(key, env);
      } catch (error) {
        console.error('KV cache delete error:', error);
      }
    }

    return deleted;
  }

  /**
   * Clear all cache entries
   */
  async clear(env?: EdgeEnv): Promise<void> {
    this.memoryCache.clear();
    this.currentSize = 0;
    this.stats.clear();

    // Clear KV if using hybrid or kv storage
    if (this.config.storage !== 'memory' && env) {
      try {
        await this.clearKV(env);
      } catch (error) {
        console.error('KV cache clear error:', error);
      }
    }
  }

  /**
   * Clear cache entries for a specific function
   */
  async clearFunctionCache(functionId: string, env?: EdgeEnv): Promise<number> {
    let cleared = 0;

    // Clear from memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.metadata?.functionId === functionId) {
        this.memoryCache.delete(key);
        this.currentSize -= this.estimateSize(key);
        cleared++;
      }
    }

    // Clear from KV if using hybrid or kv storage
    if (this.config.storage !== 'memory' && env) {
      try {
        const kvCleared = await this.clearFunctionFromKV(functionId, env);
        cleared += kvCleared;
      } catch (error) {
        console.error('KV cache clear function error:', error);
      }
    }

    return cleared;
  }

  // ========================================================================
  // Cache Warming
  // ========================================================================

  /**
   * Warm cache for a function
   */
  async warmCache(
    func: EdgeFunction,
    inputs: unknown[],
    env: EdgeEnv
  ): Promise<void> {
    if (!this.config.enableCacheWarming) {
      return;
    }

    const results = await Promise.allSettled(
      inputs.map(async (input) => {
        try {
          const output = await func.handler(input, { ctx: {} as any, env });
          await this.set(func.id, input, output, func.config.cache, env);
        } catch (error) {
          console.error(`Cache warming failed for ${func.id}:`, error);
        }
      })
    );

    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      console.warn(`Cache warming completed with ${failed} failures`);
    }
  }

  /**
   * Start automatic cache warming
   */
  startCacheWarming(
    func: EdgeFunction,
    inputs: unknown[],
    env: EdgeEnv
  ): void {
    if (this.warmingTasks.has(func.id)) {
      return; // Already warming
    }

    const intervalId = setInterval(
      () => {
        this.warmCache(func, inputs, env).catch(console.error);
      },
      this.config.cacheWarmingInterval
    );

    this.warmingTasks.set(func.id, intervalId);

    // Initial warming
    this.warmCache(func, inputs, env).catch(console.error);
  }

  /**
   * Stop cache warming for a function
   */
  stopCacheWarming(functionId: string): void {
    const intervalId = this.warmingTasks.get(functionId);
    if (intervalId) {
      clearInterval(intervalId);
      this.warmingTasks.delete(functionId);
    }
  }

  /**
   * Stop all cache warming
   */
  stopAllCacheWarming(): void {
    for (const [functionId, intervalId] of this.warmingTasks) {
      clearInterval(intervalId);
    }
    this.warmingTasks.clear();
  }

  // ========================================================================
  // Cache Invalidation
  // ========================================================================

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: RegExp, env?: EdgeEnv): Promise<number> {
    let invalidated = 0;

    // Invalidate from memory cache
    for (const [key] of this.memoryCache.entries()) {
      if (pattern.test(key)) {
        this.memoryCache.delete(key);
        this.currentSize -= this.estimateSize(key);
        invalidated++;
      }
    }

    // Invalidate from KV if using hybrid or kv storage
    if (this.config.storage !== 'memory' && env) {
      try {
        const kvInvalidated = await this.invalidatePatternFromKV(pattern, env);
        invalidated += kvInvalidated;
      } catch (error) {
        console.error('KV cache invalidate pattern error:', error);
      }
    }

    return invalidated;
  }

  /**
   * Invalidate expired entries
   */
  async invalidateExpired(env?: EdgeEnv): Promise<number> {
    let invalidated = 0;
    const now = Date.now();

    // Invalidate from memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
        this.currentSize -= this.estimateSize(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  // ========================================================================
  // Statistics & Monitoring
  // ========================================================================

  /**
   * Get cache statistics for a function
   */
  getStats(functionId: string): CacheStats | undefined {
    return this.stats.get(functionId);
  }

  /**
   * Get all cache statistics
   */
  getAllStats(): Map<string, CacheStats> {
    return new Map(this.stats);
  }

  /**
   * Reset cache statistics for a function
   */
  resetStats(functionId: string): void {
    this.stats.set(functionId, {
      hits: 0,
      misses: 0,
      size: 0,
      entries: 0,
      hitRate: 0,
      avgLatency: 0,
    });
  }

  /**
   * Reset all cache statistics
   */
  resetAllStats(): void {
    this.stats.clear();
  }

  /**
   * Get cache size information
   */
  getCacheSize(): {
    entries: number;
    size: number;
    maxSize: number;
    usagePercentage: number;
  } {
    return {
      entries: this.memoryCache.size,
      size: this.currentSize,
      maxSize: this.config.maxSize,
      usagePercentage: (this.memoryCache.size / this.config.maxSize) * 100,
    };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Generate cache key
   */
  private generateKey(functionId: string, input: unknown): string {
    return this.config.customKeyGenerator(functionId, input);
  }

  /**
   * Default cache key generator
   */
  private defaultKeyGenerator(functionId: string, input: unknown): string {
    const hash = this.simpleHash(JSON.stringify({ functionId, input }));
    return `${functionId}:${hash}`;
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expiresAt;
  }

  /**
   * Check if entry is stale (but can be served)
   */
  private isStale(entry: CacheEntry): boolean {
    const staleTime = entry.expiresAt - (this.config.staleWhileRevalidate * 1000);
    return Date.now() > staleTime;
  }

  /**
   * Revalidate cache entry in background
   */
  private async revalidateInBackground(
    functionId: string,
    input: unknown,
    key: string,
    env?: EdgeEnv
  ): Promise<void> {
    // In real implementation, would call the function to revalidate
    // This is a placeholder
    try {
      // Simulate revalidation
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Background revalidation failed:', error);
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestAccessed = Infinity;

    for (const [key, entry] of this.memoryCache.entries()) {
      const accessed = entry.metadata?.lastAccessed ?? 0;
      if (accessed < oldestAccessed) {
        oldestAccessed = accessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      this.currentSize -= this.estimateSize(oldestKey);
    }
  }

  /**
   * Calculate size of value
   */
  private calculateSize(value: unknown): number {
    return new Blob([JSON.stringify(value)]).size;
  }

  /**
   * Estimate size of key
   */
  private estimateSize(key: string): number {
    return key.length * 2; // Rough estimate
  }

  /**
   * Update cache statistics
   */
  private updateStats(functionId: string, hit: boolean): void {
    if (!this.config.enableMetrics) {
      return;
    }

    let stats = this.stats.get(functionId);
    if (!stats) {
      stats = {
        hits: 0,
        misses: 0,
        size: 0,
        entries: 0,
        hitRate: 0,
        avgLatency: 0,
      };
      this.stats.set(functionId, stats);
    }

    if (hit) {
      stats.hits++;
    } else {
      stats.misses++;
    }

    stats.entries = this.memoryCache.size;
    stats.size = this.currentSize;

    const total = stats.hits + stats.misses;
    stats.hitRate = total > 0 ? stats.hits / total : 0;
  }

  // ========================================================================
  // KV Storage Methods
  // ========================================================================

  /**
   * Get entry from KV
   */
  private async getFromKV<T>(
    key: string,
    env: EdgeEnv
  ): Promise<CacheEntry<T> | null> {
    const kv = env.KV?.[this.config.kvNamespace];
    if (!kv) {
      return null;
    }

    const value = await kv.get(key, 'json');
    return value as CacheEntry<T> | null;
  }

  /**
   * Set entry in KV
   */
  private async setToKV(
    key: string,
    entry: CacheEntry,
    env: EdgeEnv
  ): Promise<void> {
    const kv = env.KV?.[this.config.kvNamespace];
    if (!kv) {
      return;
    }

    const ttl = Math.ceil((entry.expiresAt - Date.now()) / 1000);
    await kv.put(key, JSON.stringify(entry), { expirationTtl: ttl });
  }

  /**
   * Delete entry from KV
   */
  private async deleteFromKV(key: string, env: EdgeEnv): Promise<void> {
    const kv = env.KV?.[this.config.kvNamespace];
    if (!kv) {
      return;
    }

    await kv.delete(key);
  }

  /**
   * Clear all entries from KV
   */
  private async clearKV(env: EdgeEnv): Promise<void> {
    const kv = env.KV?.[this.config.kvNamespace];
    if (!kv) {
      return;
    }

    // KV doesn't have a direct clear method, so we need to list and delete
    const list = await kv.list();
    await Promise.all(
      list.keys.map(key => kv.delete(key.name))
    );
  }

  /**
   * Clear function entries from KV
   */
  private async clearFunctionFromKV(
    functionId: string,
    env: EdgeEnv
  ): Promise<number> {
    const kv = env.KV?.[this.config.kvNamespace];
    if (!kv) {
      return 0;
    }

    const list = await kv.list({ prefix: functionId });
    await Promise.all(
      list.keys.map(key => kv.delete(key.name))
    );

    return list.keys.length;
  }

  /**
   * Invalidate pattern from KV
   */
  private async invalidatePatternFromKV(
    pattern: RegExp,
    env: EdgeEnv
  ): Promise<number> {
    const kv = env.KV?.[this.config.kvNamespace];
    if (!kv) {
      return 0;
    }

    const list = await kv.list();
    const toDelete = list.keys.filter(key => pattern.test(key.name));

    await Promise.all(
      toDelete.map(key => kv.delete(key.name))
    );

    return toDelete.length;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a new cache layer
 */
export function createCacheLayer(config?: CacheLayerConfig): CacheLayer {
  return new CacheLayer(config);
}

/**
 * Create cache configuration
 */
export function createCacheConfig(
  overrides?: Partial<CacheConfig>
): CacheConfig {
  return {
    enabled: true,
    ttl: 60,
    ...overrides,
  };
}

/**
 * Wrap a function with caching
 */
export function withCache<T extends (...args: any[]) => any>(
  fn: T,
  cacheLayer: CacheLayer,
  functionId: string,
  config?: Partial<CacheConfig>
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const input = args.length === 1 ? args[0] : args;

    // Try to get from cache
    const cached = await cacheLayer.get<ReturnType<T>>(
      functionId,
      input,
      args[args.length - 1]?.env
    );

    if (cached !== null) {
      return cached;
    }

    // Execute function
    const result = await fn(...args);

    // Store in cache
    await cacheLayer.set(functionId, input, result, config, args[args.length - 1]?.env);

    return result;
  }) as T;
}

/**
 * Create a cache decorator for edge functions
 */
export function cached(
  cacheLayer: CacheLayer,
  config?: Partial<CacheConfig>
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const functionId = `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const input = args.length === 1 ? args[0] : args;

      // Try to get from cache
      const cached = await cacheLayer.get(functionId, input, args[args.length - 1]?.env);

      if (cached !== null) {
        return cached;
      }

      // Execute method
      const result = await originalMethod.apply(this, args);

      // Store in cache
      await cacheLayer.set(functionId, input, result, config, args[args.length - 1]?.env);

      return result;
    };

    return descriptor;
  };
}
