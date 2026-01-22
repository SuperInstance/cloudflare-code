/**
 * High-performance cache layer for feature flag evaluations
 * Implements LRU, FIFO, and LFU caching strategies
 */

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccess: number;
  ttl: number;
}

export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  strategy: 'lru' | 'fifo' | 'lfu';
  cleanupInterval: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
  evictions: number;
}

/**
 * High-performance cache for feature flag evaluations
 * Optimized for sub-microsecond reads
 */
export class FlagCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>>;
  private accessOrder: string[];
  private config: CacheConfig;
  private stats: CacheStats;
  private cleanupTimer: ReturnType<typeof setInterval> | null;
  private version: number;

  constructor(config: Partial<CacheConfig> = {}) {
    this.cache = new Map();
    this.accessOrder = [];
    this.config = {
      maxSize: config.maxSize || 10000,
      defaultTTL: config.defaultTTL || 60_000, // 1 minute
      strategy: config.strategy || 'lru',
      cleanupInterval: config.cleanupInterval || 10_000, // 10 seconds
    };
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      hitRate: 0,
      evictions: 0,
    };
    this.version = 0;
    this.cleanupTimer = null;

    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Get a value from cache
   * O(1) average time complexity
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    // Update access tracking
    entry.accessCount++;
    entry.lastAccess = Date.now();

    // Update access order based on strategy
    this.updateAccessOrder(key);

    this.stats.hits++;
    this.updateHitRate();

    return entry.value;
  }

  /**
   * Set a value in cache
   * O(1) average time complexity
   */
  set(key: string, value: T, ttl?: number): void {
    // Check if we need to evict
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evict();
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      accessCount: 0,
      lastAccess: Date.now(),
      ttl: ttl || this.config.defaultTTL,
    };

    this.cache.set(key, entry);

    if (!this.accessOrder.includes(key)) {
      this.accessOrder.push(key);
    }

    this.stats.size = this.cache.size;
    this.version++;
  }

  /**
   * Delete a value from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.stats.size = this.cache.size;
    this.version++;
    return deleted;
  }

  /**
   * Check if a key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry !== undefined && !this.isExpired(entry);
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.stats.size = 0;
    this.version++;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache version (increments on every write)
   */
  getVersion(): number {
    return this.version;
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      size: this.cache.size,
      hitRate: 0,
      evictions: this.stats.evictions,
    };
  }

  /**
   * Get all keys in cache
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all values in cache
   */
  values(): T[] {
    return Array.from(this.cache.values()).map((entry) => entry.value);
  }

  /**
   * Get all entries in cache
   */
  entries(): Array<[string, T]> {
    return Array.from(this.cache.entries()).map(([key, entry]) => [
      key,
      entry.value,
    ]);
  }

  /**
   * Stop cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private updateAccessOrder(key: string): void {
    switch (this.config.strategy) {
      case 'lru':
        // Move to end (most recently used)
        const lruIndex = this.accessOrder.indexOf(key);
        if (lruIndex > -1) {
          this.accessOrder.splice(lruIndex, 1);
          this.accessOrder.push(key);
        }
        break;

      case 'lfu':
        // Reorder by access count (least frequently used at start)
        this.accessOrder.sort((a, b) => {
          const countA = this.cache.get(a)?.accessCount || 0;
          const countB = this.cache.get(b)?.accessCount || 0;
          return countA - countB;
        });
        break;

      case 'fifo':
        // No reordering needed
        break;
    }
  }

  private evict(): void {
    if (this.accessOrder.length === 0) {
      return;
    }

    let keyToEvict: string;

    switch (this.config.strategy) {
      case 'lru':
        // Evict least recently used (first in access order)
        keyToEvict = this.accessOrder[0];
        break;

      case 'lfu':
        // Evict least frequently used (first in access order after sort)
        keyToEvict = this.accessOrder[0];
        break;

      case 'fifo':
        // Evict oldest entry (first in access order)
        keyToEvict = this.accessOrder[0];
        break;

      default:
        keyToEvict = this.accessOrder[0];
    }

    this.delete(keyToEvict);
    this.stats.evictions++;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }
}

/**
 * Multi-level cache with L1 (in-memory) and L2 (distributed) support
 */
export class MultiLevelCache<T = unknown> {
  private l1: FlagCache<T>;
  private l2?: FlagCache<T>;
  private l1HitRate: number;
  private l2HitRate: number;

  constructor(config: {
    l1: Partial<CacheConfig>;
    l2?: Partial<CacheConfig>;
  }) {
    this.l1 = new FlagCache<T>(config.l1);
    this.l2 = config.l2 ? new FlagCache<T>(config.l2) : undefined;
    this.l1HitRate = 0;
    this.l2HitRate = 0;
  }

  async get(key: string): Promise<T | undefined> {
    // Try L1 cache first
    const l1Value = this.l1.get(key);
    if (l1Value !== undefined) {
      this.updateL1HitRate(true);
      return l1Value;
    }
    this.updateL1HitRate(false);

    // Try L2 cache if available
    if (this.l2) {
      const l2Value = this.l2.get(key);
      if (l2Value !== undefined) {
        // Promote to L1
        this.l1.set(key, l2Value);
        this.updateL2HitRate(true);
        return l2Value;
      }
      this.updateL2HitRate(false);
    }

    return undefined;
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    // Set in both L1 and L2
    this.l1.set(key, value, ttl);
    if (this.l2) {
      this.l2.set(key, value, ttl);
    }
  }

  async delete(key: string): Promise<boolean> {
    const l1Deleted = this.l1.delete(key);
    const l2Deleted = this.l2?.delete(key) || false;
    return l1Deleted || l2Deleted;
  }

  clear(): void {
    this.l1.clear();
    this.l2?.clear();
  }

  getStats(): {
    l1: CacheStats;
    l2?: CacheStats;
    l1HitRate: number;
    l2HitRate: number;
  } {
    return {
      l1: this.l1.getStats(),
      l2: this.l2?.getStats(),
      l1HitRate: this.l1HitRate,
      l2HitRate: this.l2HitRate,
    };
  }

  private updateL1HitRate(hit: boolean): void {
    const alpha = 0.1; // Smoothing factor
    this.l1HitRate = alpha * (hit ? 1 : 0) + (1 - alpha) * this.l1HitRate;
  }

  private updateL2HitRate(hit: boolean): void {
    const alpha = 0.1; // Smoothing factor
    this.l2HitRate = alpha * (hit ? 1 : 0) + (1 - alpha) * this.l2HitRate;
  }

  destroy(): void {
    this.l1.destroy();
    this.l2?.destroy();
  }
}

/**
 * Cache key generator for feature flag evaluations
 */
export class CacheKeyGenerator {
  /**
   * Generate cache key for flag evaluation
   */
  static forFlagEvaluation(
    flagKey: string,
    userId: string,
    attributes?: Record<string, unknown>
  ): string {
    const parts = [flagKey, userId];

    if (attributes) {
      const sortedKeys = Object.keys(attributes).sort();
      const attrPart = sortedKeys
        .map((key) => `${key}:${JSON.stringify(attributes[key])}`)
        .join('|');
      parts.push(attrPart);
    }

    return parts.join(':');
  }

  /**
   * Generate cache key for batch evaluation
   */
  static forBatchEvaluation(
    userId: string,
    flagKeys: string[]
  ): string {
    return `batch:${userId}:${flagKeys.sort().join(',')}`;
  }

  /**
   * Generate cache key for segment check
   */
  static forSegmentCheck(
    segmentId: string,
    userId: string,
    attributes?: Record<string, unknown>
  ): string {
    return `segment:${segmentId}:${this.forFlagEvaluation('', userId, attributes)}`;
  }

  /**
   * Generate cache key for experiment assignment
   */
  static forExperimentAssignment(
    experimentId: string,
    userId: string
  ): string {
    return `experiment:${experimentId}:${userId}`;
  }
}
