/**
 * Multi-Level Cache Implementation
 *
 * Three-tier caching system for optimal performance:
 * - L1: In-memory cache (sub-microsecond)
 * - L2: Durable Object memory (sub-millisecond)
 * - L3: KV storage (1-50ms)
 *
 * Features:
 * - Automatic promotion/demotion between tiers
 * - LRU eviction at each tier
 * - Size limits and TTL
 * - Cache warming and preloading
 * - Metrics collection
 */

import type { DurableObjectState } from '@cloudflare/workers-types';
import type { KVNamespace } from '@cloudflare/workers-types';

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T = any> {
  /** Cached value */
  value: T;
  /** Creation timestamp */
  createdAt: number;
  /** Last access timestamp */
  lastAccess: number;
  /** Access count */
  accessCount: number;
  /** Size in bytes */
  size: number;
  /** TTL in seconds (0 = no expiration) */
  ttl: number;
  /** Current tier */
  tier: 'l1' | 'l2' | 'l3';
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** L1: Max entries in memory */
  l1MaxEntries?: number;
  /** L1: Max size in bytes */
  l1MaxSize?: number;
  /** L2: Max entries in DO */
  l2MaxEntries?: number;
  /** L2: Max size in bytes */
  l2MaxSize?: number;
  /** L3: Default TTL in seconds */
  l3DefaultTTL?: number;
  /** Enable compression for L3 */
  enableCompression?: boolean;
  /** Compression threshold (bytes) */
  compressionThreshold?: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total hits */
  hits: number;
  /** L1 hits */
  l1Hits: number;
  /** L2 hits */
  l2Hits: number;
  /** L3 hits */
  l3Hits: number;
  /** Total misses */
  misses: number;
  /** Hit rate (0-1) */
  hitRate: number;
  /** Average latency (ms) */
  avgLatency: number;
  /** Promotions (L2->L1, L3->L2) */
  promotions: number;
  /** Evictions */
  evictions: number;
  /** Current sizes */
  sizes: {
    l1: { entries: number; bytes: number };
    l2: { entries: number; bytes: number };
    l3: { entries: number };
  };
}

/**
 * Multi-level cache
 */
export class MultiLevelCache {
  private config: Required<CacheConfig>;
  private l1: Map<string, CacheEntry>;
  private l2: Map<string, CacheEntry>;
  private l3: KVNamespace;
  private doState?: DurableObjectState;
  private stats: CacheStats;

  constructor(
    kvNamespace: KVNamespace,
    doState?: DurableObjectState,
    config: CacheConfig = {}
  ) {
    this.l3 = kvNamespace;
    this.doState = doState;
    this.l1 = new Map();
    this.l2 = new Map();

    this.config = {
      l1MaxEntries: config.l1MaxEntries ?? 1000,
      l1MaxSize: config.l1MaxSize ?? 10 * 1024 * 1024, // 10MB
      l2MaxEntries: config.l2MaxEntries ?? 10000,
      l2MaxSize: config.l2MaxSize ?? 100 * 1024 * 1024, // 100MB
      l3DefaultTTL: config.l3DefaultTTL ?? 60 * 60 * 24 * 7, // 7 days
      enableCompression: config.enableCompression ?? true,
      compressionThreshold: config.compressionThreshold ?? 1024, // 1KB
    };

    this.stats = {
      hits: 0,
      l1Hits: 0,
      l2Hits: 0,
      l3Hits: 0,
      misses: 0,
      hitRate: 0,
      avgLatency: 0,
      promotions: 0,
      evictions: 0,
      sizes: {
        l1: { entries: 0, bytes: 0 },
        l2: { entries: 0, bytes: 0 },
        l3: { entries: 0 },
      },
    };

    // Initialize L2 from DO storage
    this.initializeL2();
  }

  /**
   * Initialize L2 from DO storage
   */
  private async initializeL2(): Promise<void> {
    if (!this.doState) return;

    try {
      const stored = await this.doState.storage.get<{
        entries: Record<string, CacheEntry>;
        totalSize: number;
      }>('l2-cache');

      if (stored) {
        this.l2 = new Map(Object.entries(stored.entries));
      }
    } catch (error) {
      console.warn('Failed to initialize L2 cache:', error);
    }
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    const startTime = performance.now();

    try {
      // Try L1
      const l1Entry = this.l1.get(key);
      if (l1Entry && !this.isExpired(l1Entry)) {
        this.updateAccess(l1Entry);
        this.stats.hits++;
        this.stats.l1Hits++;
        this.recordLatency(startTime);
        return l1Entry.value as T;
      }

      // Remove expired L1 entry
      if (l1Entry) {
        this.l1.delete(key);
      }

      // Try L2
      const l2Entry = this.l2.get(key);
      if (l2Entry && !this.isExpired(l2Entry)) {
        this.updateAccess(l2Entry);

        // Promote to L1
        await this.promoteToL1(key, l2Entry);

        this.stats.hits++;
        this.stats.l2Hits++;
        this.stats.promotions++;
        this.recordLatency(startTime);
        return l2Entry.value as T;
      }

      // Remove expired L2 entry
      if (l2Entry) {
        this.l2.delete(key);
        await this.persistL2();
      }

      // Try L3 (KV)
      const l3Entry = await this.getFromL3<T>(key);
      if (l3Entry !== null) {
        // Promote to L2
        const cacheEntry: CacheEntry = {
          value: l3Entry,
          createdAt: Date.now(),
          lastAccess: Date.now(),
          accessCount: 1,
          size: this.calculateSize(l3Entry),
          ttl: this.config.l3DefaultTTL,
          tier: 'l2',
        };

        await this.setInL2(key, cacheEntry);

        // Promote to L1
        await this.promoteToL1(key, cacheEntry);

        this.stats.hits++;
        this.stats.l3Hits++;
        this.stats.promotions += 2;
        this.recordLatency(startTime);
        return l3Entry;
      }

      // Cache miss
      this.stats.misses++;
      this.updateHitRate();
      this.recordLatency(startTime);
      return null;
    } catch (error) {
      console.error('Cache get failed:', error);
      this.stats.misses++;
      this.updateHitRate();
      this.recordLatency(startTime);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(
    key: string,
    value: any,
    options: {
      ttl?: number;
      priority?: number;
      skipL1?: boolean;
      skipL2?: boolean;
    } = {}
  ): Promise<void> {
    const { ttl = this.config.l3DefaultTTL } = options;

    const entry: CacheEntry = {
      value,
      createdAt: Date.now(),
      lastAccess: Date.now(),
      accessCount: 0,
      size: this.calculateSize(value),
      ttl,
      tier: 'l1',
    };

    // Store in L1
    if (!options.skipL1) {
      await this.setInL1(key, entry);
    }

    // Store in L2
    if (!options.skipL2) {
      const l2Entry = { ...entry, tier: 'l2' as const };
      await this.setInL2(key, l2Entry);
    }

    // Store in L3
    await this.setInL3(key, value, ttl);
  }

  /**
   * Delete from all tiers
   */
  async delete(key: string): Promise<void> {
    // Delete from L1
    this.l1.delete(key);

    // Delete from L2
    this.l2.delete(key);
    if (this.doState) {
      await this.persistL2();
    }

    // Delete from L3
    await this.l3.delete(key);
  }

  /**
   * Clear all tiers
   */
  async clear(): Promise<void> {
    // Clear L1
    this.l1.clear();

    // Clear L2
    this.l2.clear();
    if (this.doState) {
      await this.doState.storage.delete('l2-cache');
    }

    // Clear L3 (list and delete)
    const keys = await this.l3.list();
    await Promise.all(keys.keys.map((key) => this.l3.delete(key.name)));
  }

  /**
   * Set value in L1
   */
  private async setInL1(key: string, entry: CacheEntry): Promise<void> {
    // Evict if necessary
    await this.evictL1IfNeeded(entry.size);

    this.l1.set(key, entry);
  }

  /**
   * Set value in L2
   */
  private async setInL2(key: string, entry: CacheEntry): Promise<void> {
    // Evict if necessary
    await this.evictL2IfNeeded(entry.size);

    this.l2.set(key, entry);
    await this.persistL2();
  }

  /**
   * Set value in L3
   */
  private async setInL3(key: string, value: any, ttl: number): Promise<void> {
    try {
      let data = value;

      // Compress if enabled and threshold met
      if (
        this.config.enableCompression &&
        this.calculateSize(value) >= this.config.compressionThreshold
      ) {
        data = await this.compress(value);
      }

      await this.l3.put(key, JSON.stringify(data), {
        expirationTtl: ttl,
      });
    } catch (error) {
      console.error('Failed to set in L3:', error);
    }
  }

  /**
   * Get value from L3
   */
  private async getFromL3<T>(key: string): Promise<T | null> {
    try {
      const data = await this.l3.get(key);
      if (!data) return null;

      let parsed = JSON.parse(data);

      // Decompress if needed
      if (this.isCompressed(parsed)) {
        parsed = await this.decompress(parsed);
      }

      return parsed as T;
    } catch (error) {
      console.error('Failed to get from L3:', error);
      return null;
    }
  }

  /**
   * Promote entry to L1
   */
  private async promoteToL1(key: string, entry: CacheEntry): Promise<void> {
    const l1Entry: CacheEntry = {
      ...entry,
      tier: 'l1',
    };

    await this.setInL1(key, l1Entry);
  }

  /**
   * Evict from L1 if needed
   */
  private async evictL1IfNeeded(requiredBytes: number): Promise<void> {
    const currentSize = this.calculateL1Size();
    const targetSize = this.config.l1MaxSize * 0.8;

    while (currentSize + requiredBytes > targetSize && this.l1.size > 0) {
      this.evictLRU(this.l1);
      this.stats.evictions++;
    }

    // Also check entry count
    while (this.l1.size >= this.config.l1MaxEntries) {
      this.evictLRU(this.l1);
      this.stats.evictions++;
    }
  }

  /**
   * Evict from L2 if needed
   */
  private async evictL2IfNeeded(requiredBytes: number): Promise<void> {
    const currentSize = this.calculateL2Size();
    const targetSize = this.config.l2MaxSize * 0.8;

    while (currentSize + requiredBytes > targetSize && this.l2.size > 0) {
      this.evictLRU(this.l2);
      this.stats.evictions++;
    }

    // Also check entry count
    while (this.l2.size >= this.config.l2MaxEntries) {
      this.evictLRU(this.l2);
      this.stats.evictions++;
    }

    await this.persistL2();
  }

  /**
   * Evict LRU entry from a map
   */
  private evictLRU(map: Map<string, CacheEntry>): void {
    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of map.entries()) {
      if (entry.lastAccess < lruTime) {
        lruTime = entry.lastAccess;
        lruKey = key;
      }
    }

    if (lruKey) {
      map.delete(lruKey);
    }
  }

  /**
   * Update access metadata
   */
  private updateAccess(entry: CacheEntry): void {
    entry.lastAccess = Date.now();
    entry.accessCount++;
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    if (entry.ttl === 0) return false;
    return Date.now() - entry.createdAt > entry.ttl * 1000;
  }

  /**
   * Calculate size of value
   */
  private calculateSize(value: any): number {
    try {
      return JSON.stringify(value).length * 2; // UTF-16
    } catch {
      return 1024; // Default to 1KB
    }
  }

  /**
   * Calculate L1 size
   */
  private calculateL1Size(): number {
    let size = 0;
    for (const entry of this.l1.values()) {
      size += entry.size;
    }
    return size;
  }

  /**
   * Calculate L2 size
   */
  private calculateL2Size(): number {
    let size = 0;
    for (const entry of this.l2.values()) {
      size += entry.size;
    }
    return size;
  }

  /**
   * Compress value
   */
  private async compress(value: any): Promise<any> {
    const json = JSON.stringify(value);
    const encoder = new TextEncoder();
    const data = encoder.encode(json);

    if (typeof CompressionStream === 'undefined') {
      return value;
    }

    try {
      const compressed = new Response(data).body!
        .pipeThrough(new CompressionStream('gzip'));
      const arrayBuffer = await new Response(compressed).arrayBuffer();

      return {
        _compressed: true,
        data: Array.from(new Uint8Array(arrayBuffer)),
      };
    } catch (error) {
      return value;
    }
  }

  /**
   * Decompress value
   */
  private async decompress(compressed: any): Promise<any> {
    if (!compressed._compressed) {
      return compressed;
    }

    if (typeof DecompressionStream === 'undefined') {
      return compressed;
    }

    try {
      const data = new Uint8Array(compressed.data);
      const decompressed = new Response(data).body!
        .pipeThrough(new DecompressionStream('gzip'));
      const arrayBuffer = await new Response(decompressed).arrayBuffer();
      const decoder = new TextDecoder();
      const json = decoder.decode(arrayBuffer);
      return JSON.parse(json);
    } catch (error) {
      return compressed;
    }
  }

  /**
   * Check if value is compressed
   */
  private isCompressed(value: any): boolean {
    return value && typeof value === 'object' && value._compressed === true;
  }

  /**
   * Persist L2 to DO storage
   */
  private async persistL2(): Promise<void> {
    if (!this.doState) return;

    try {
      const entriesObj = Object.fromEntries(this.l2.entries());
      await this.doState.storage.put('l2-cache', {
        entries: entriesObj,
        totalSize: this.calculateL2Size(),
      });
    } catch (error) {
      console.warn('Failed to persist L2 cache:', error);
    }
  }

  /**
   * Record latency
   */
  private recordLatency(startTime: number): void {
    const latency = performance.now() - startTime;
    const totalRequests = this.stats.hits + this.stats.misses;
    this.stats.avgLatency =
      (this.stats.avgLatency * (totalRequests - 1) + latency) / totalRequests;
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.stats.sizes = {
      l1: {
        entries: this.l1.size,
        bytes: this.calculateL1Size(),
      },
      l2: {
        entries: this.l2.size,
        bytes: this.calculateL2Size(),
      },
      l3: {
        entries: 0, // Would require KV list call
      },
    };

    return { ...this.stats };
  }

  /**
   * Warm up cache with preloaded data
   */
  async warmup(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map(async (key) => {
        await this.get(key); // This will trigger promotion
      })
    );
  }
}

/**
 * Create multi-level cache instance
 */
export function createMultiLevelCache(
  kvNamespace: KVNamespace,
  doState?: DurableObjectState,
  config?: CacheConfig
): MultiLevelCache {
  return new MultiLevelCache(kvNamespace, doState, config);
}
