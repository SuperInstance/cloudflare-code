/**
 * L1 Tier - Durable Object Memory Cache
 * Fastest tier with sub-millisecond access
 */

import {
  CacheTier,
  CacheEntry,
  CacheMetadata,
  TierConfig,
  CacheError,
  CacheCapacityError,
} from '../types';
import { calculateSize, validateKey } from '../utils/serializer';

// ============================================================================
// L1 Cache Entry
// ============================================================================

interface L1Entry<T> {
  key: string;
  value: T;
  metadata: CacheMetadata;
  expiresAt: number;
  lastModified: number;
}

// ============================================================================
// L1 Cache Configuration
// ============================================================================

const DEFAULT_L1_CONFIG: TierConfig = {
  tier: CacheTier.L1,
  maxSize: 128 * 1024 * 1024, // 128 MB
  maxEntries: 10000,
  ttl: 300000, // 5 minutes
  compressionEnabled: false,
  priority: 1,
};

// ============================================================================
// L1 Cache Implementation
// ============================================================================

export class L1Cache {
  private cache = new Map<string, L1Entry<any>>();
  private config: TierConfig;
  private currentSize = 0;
  private accessLog = new Map<string, number[]>();

  constructor(config: Partial<TierConfig> = {}) {
    this.config = { ...DEFAULT_L1_CONFIG, ...config, tier: CacheTier.L1 };
  }

  /**
   * Get a value from L1 cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!validateKey(key)) {
      throw new CacheError(`Invalid key: ${key}`, 'INVALID_KEY', CacheTier.L1, key);
    }

    const startTime = performance.now();
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }

    // Update access metadata
    entry.metadata.lastAccessed = Date.now();
    entry.metadata.accessCount++;
    this.recordAccess(key);

    const latency = performance.now() - startTime;

    // Target: sub-millisecond access
    if (latency > 1) {
      console.warn(`L1 cache access slow: ${latency.toFixed(2)}ms`);
    }

    return entry.value as T;
  }

  /**
   * Set a value in L1 cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!validateKey(key)) {
      throw new CacheError(`Invalid key: ${key}`, 'INVALID_KEY', CacheTier.L1, key);
    }

    const size = calculateSize(value);

    // Check if we need to evict entries
    await this.ensureCapacity(size);

    const now = Date.now();
    const expiresAt = now + (ttl || this.config.ttl);

    const entry: L1Entry<T> = {
      key,
      value,
      metadata: {
        createdAt: now,
        lastAccessed: now,
        accessCount: 1,
        size,
        compressed: false,
        tags: [],
        version: 1,
      },
      expiresAt,
      lastModified: now,
    };

    // If updating existing entry, adjust size
    const existing = this.cache.get(key);
    if (existing) {
      this.currentSize -= existing.metadata.size;
    }

    this.cache.set(key, entry);
    this.currentSize += size;
    this.recordAccess(key);
  }

  /**
   * Delete a value from L1 cache
   */
  async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    this.currentSize -= entry.metadata.size;
    this.cache.delete(key);
    this.accessLog.delete(key);

    return true;
  }

  /**
   * Check if a key exists in L1 cache
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      await this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all entries from L1 cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.accessLog.clear();
    this.currentSize = 0;
  }

  /**
   * Get cache size information
   */
  getSize(): { entries: number; bytes: number; maxBytes: number } {
    return {
      entries: this.cache.size,
      bytes: this.currentSize,
      maxBytes: this.config.maxSize,
    };
  }

  /**
   * Get all keys in L1 cache
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache entries with metadata
   */
  getEntries(): CacheEntry[] {
    return Array.from(this.cache.values()).map(entry => ({
      key: entry.key,
      value: entry.value,
      metadata: entry.metadata,
      tiers: {
        currentTier: CacheTier.L1,
        tierHistory: [],
        promotionCount: 0,
        demotionCount: 0,
      },
    }));
  }

  /**
   * Ensure capacity for a new entry
   */
  private async ensureCapacity(requiredSize: number): Promise<void> {
    // Check size constraint
    if (this.currentSize + requiredSize > this.config.maxSize) {
      await this.evictBySize(requiredSize);
    }

    // Check entry count constraint
    if (this.cache.size >= this.config.maxEntries) {
      await this.evictByCount();
    }

    // Final check
    if (this.currentSize + requiredSize > this.config.maxSize) {
      throw new CacheCapacityError(
        CacheTier.L1,
        `Cannot fit ${requiredSize} bytes in L1 cache`
      );
    }
  }

  /**
   * Evict entries based on size using LRU
   */
  private async evictBySize(requiredSize: number): Promise<void> {
    const targetSize = this.config.maxSize - requiredSize;
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].metadata.lastAccessed - b[1].metadata.lastAccessed);

    let freed = 0;
    for (const [key, entry] of entries) {
      if (this.currentSize - freed <= targetSize) {
        break;
      }

      this.currentSize -= entry.metadata.size;
      this.cache.delete(key);
      this.accessLog.delete(key);
      freed += entry.metadata.size;
    }
  }

  /**
   * Evict entries based on count using LRU
   */
  private async evictByCount(): Promise<void> {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].metadata.lastAccessed - b[1].metadata.lastAccessed);

    const toEvict = Math.ceil(this.config.maxEntries * 0.1); // Evict 10%
    for (let i = 0; i < toEvict && i < entries.length; i++) {
      const [key, entry] = entries[i];
      this.currentSize -= entry.metadata.size;
      this.cache.delete(key);
      this.accessLog.delete(key);
    }
  }

  /**
   * Record access to a key
   */
  private recordAccess(key: string): void {
    const accesses = this.accessLog.get(key) || [];
    accesses.push(Date.now());

    // Keep only last 100 accesses
    if (accesses.length > 100) {
      accesses.shift();
    }

    this.accessLog.set(key, accesses);
  }

  /**
   * Get access frequency for a key
   */
  getAccessFrequency(key: string): number {
    const accesses = this.accessLog.get(key);
    if (!accesses || accesses.length < 2) {
      return 0;
    }

    const timeSpan = accesses[accesses.length - 1] - accesses[0];
    if (timeSpan === 0) {
      return accesses.length;
    }

    return (accesses.length / timeSpan) * 1000; // Accesses per second
  }

  /**
   * Get hot keys (frequently accessed)
   */
  getHotKeys(limit = 10): Array<{ key: string; frequency: number }> {
    const entries = Array.from(this.accessLog.entries())
      .map(([key, accesses]) => ({
        key,
        frequency: this.getAccessFrequency(key),
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);

    return entries;
  }

  /**
   * Get cold keys (infrequently accessed)
   */
  getColdKeys(limit = 10): string[] {
    const now = Date.now();
    const entries = Array.from(this.cache.entries())
      .filter(([_, entry]) => now - entry.metadata.lastAccessed > 60000) // Not accessed in 1 minute
      .sort((a, b) => a[1].metadata.lastAccessed - b[1].metadata.lastAccessed)
      .slice(0, limit)
      .map(([key]) => key);

    return entries;
  }

  /**
   * Clean expired entries
   */
  async cleanExpired(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        await this.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get statistics
   */
  getStats(): {
    size: number;
    count: number;
    hitRate: number;
    avgAccessFrequency: number;
  } {
    const frequencies = Array.from(this.cache.keys()).map(key =>
      this.getAccessFrequency(key)
    );

    return {
      size: this.currentSize,
      count: this.cache.size,
      hitRate: 0, // Will be calculated by higher-level cache
      avgAccessFrequency:
        frequencies.length > 0
          ? frequencies.reduce((a, b) => a + b, 0) / frequencies.length
          : 0,
    };
  }

  /**
   * Export cache state for persistence
   */
  export(): Array<{ key: string; value: any; metadata: CacheMetadata; expiresAt: number }> {
    return Array.from(this.cache.values()).map(entry => ({
      key: entry.key,
      value: entry.value,
      metadata: entry.metadata,
      expiresAt: entry.expiresAt,
    }));
  }

  /**
   * Import cache state
   */
  import(data: Array<{ key: string; value: any; metadata: CacheMetadata; expiresAt: number }>): void {
    this.clear();

    for (const item of data) {
      if (Date.now() < item.expiresAt) {
        const entry: L1Entry<any> = {
          key: item.key,
          value: item.value,
          metadata: item.metadata,
          expiresAt: item.expiresAt,
          lastModified: item.metadata.lastAccessed,
        };

        this.cache.set(item.key, entry);
        this.currentSize += item.metadata.size;
      }
    }
  }
}

// ============================================================================
// L1 Cache Factory
// ============================================================================

export function createL1Cache(config?: Partial<TierConfig>): L1Cache {
  return new L1Cache(config);
}
