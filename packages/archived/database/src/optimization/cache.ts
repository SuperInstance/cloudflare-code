/**
 * Query Cache
 *
 * Implements distributed query caching with various eviction policies
 */

import type { CacheEntry, CacheConfig } from './types';

export class QueryCache {
  private cache: Map<string, CacheEntry>;
  private config: CacheConfig;
  private accessOrder: string[];
  private accessFrequency: Map<string, number>;
  private currentSize: number;

  constructor(config: CacheConfig) {
    this.cache = new Map();
    this.config = config;
    this.accessOrder = [];
    this.accessFrequency = new Map();
    this.currentSize = 0;
  }

  /**
   * Get cached value
   */
  get(key: string): unknown | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp.getTime() > entry.ttl) {
      this.remove(key);
      return null;
    }

    // Update access tracking
    entry.hits++;
    this.updateAccess(key);

    return entry.value;
  }

  /**
   * Set cached value
   */
  set(key: string, value: unknown, ttl?: number): boolean {
    const size = this.calculateSize(value);

    // Check if we need to evict
    while (this.shouldEvict(size)) {
      if (!this.evict()) {
        // Failed to evict, cache is full with non-evictable entries
        return false;
      }
    }

    const entry: CacheEntry = {
      key,
      value,
      timestamp: new Date(),
      ttl: ttl || this.config.defaultTTL,
      hits: 0,
      size,
    };

    this.cache.set(key, entry);
    this.currentSize += size;
    this.updateAccess(key);

    return true;
  }

  /**
   * Remove entry from cache
   */
  remove(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    this.currentSize -= entry.size;
    this.cache.delete(key);

    // Remove from tracking structures
    const orderIndex = this.accessOrder.indexOf(key);
    if (orderIndex !== -1) {
      this.accessOrder.splice(orderIndex, 1);
    }
    this.accessFrequency.delete(key);

    return true;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.accessFrequency.clear();
    this.currentSize = 0;
  }

  /**
   * Check if eviction is needed
   */
  private shouldEvict(newSize: number): boolean {
    return (
      this.cache.size >= this.config.maxSize ||
      this.currentSize + newSize > this.config.maxSizeBytes
    );
  }

  /**
   * Evict an entry based on policy
   */
  private evict(): boolean {
    let keyToEvict: string | null = null;

    switch (this.config.evictionPolicy) {
      case 'lru':
        keyToEvict = this.evictLRU();
        break;

      case 'lfu':
        keyToEvict = this.evictLFU();
        break;

      case 'fifo':
        keyToEvict = this.evictFIFO();
        break;

      case 'ttl':
        keyToEvict = this.evictTTL();
        break;
    }

    if (keyToEvict) {
      return this.remove(keyToEvict);
    }

    return false;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): string | null {
    if (this.accessOrder.length === 0) {
      return null;
    }

    // The first item in accessOrder is the least recently used
    return this.accessOrder[0];
  }

  /**
   * Evict least frequently used entry
   */
  private evictLFU(): string | null {
    let minFrequency = Infinity;
    let keyToEvict: string | null = null;

    for (const [key, frequency] of this.accessFrequency) {
      if (frequency < minFrequency) {
        minFrequency = frequency;
        keyToEvict = key;
      }
    }

    return keyToEvict;
  }

  /**
   * Evict first-in-first-out entry
   */
  private evictFIFO(): string | null {
    if (this.accessOrder.length === 0) {
      return null;
    }

    return this.accessOrder[0];
  }

  /**
   * Evict expired entry
   */
  private evictTTL(): string | null {
    let oldestExpiry: Date | null = null;
    let keyToEvict: string | null = null;

    for (const [key, entry] of this.cache) {
      const expiryTime = new Date(entry.timestamp.getTime() + entry.ttl);

      if (!oldestExpiry || expiryTime < oldestExpiry) {
        oldestExpiry = expiryTime;
        keyToEvict = key;
      }
    }

    return keyToEvict;
  }

  /**
   * Update access tracking
   */
  private updateAccess(key: string): void {
    // Update LRU order
    const orderIndex = this.accessOrder.indexOf(key);
    if (orderIndex !== -1) {
      this.accessOrder.splice(orderIndex, 1);
    }
    this.accessOrder.push(key);

    // Update LFU frequency
    const freq = this.accessFrequency.get(key) || 0;
    this.accessFrequency.set(key, freq + 1);
  }

  /**
   * Calculate size of value
   */
  private calculateSize(value: unknown): number {
    const str = JSON.stringify(value);
    return Buffer.byteLength(str, 'utf8');
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    count: number;
    hitRate: number;
    totalHits: number;
    currentSizeBytes: number;
  } {
    let totalHits = 0;

    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
    }

    const hitRate = this.cache.size > 0 ? totalHits / (totalHits + this.cache.size) : 0;

    return {
      size: this.cache.size,
      count: this.cache.size,
      hitRate,
      totalHits,
      currentSizeBytes: this.currentSize,
    };
  }

  /**
   * Get cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache entries
   */
  entries(): CacheEntry[] {
    return Array.from(this.cache.values());
  }

  /**
   * Warm cache with data
   */
  async warm(data: Map<string, unknown>): Promise<void> {
    for (const [key, value] of data) {
      this.set(key, value);
    }
  }

  /**
   * Invalidate cache entries matching pattern
   */
  invalidate(pattern: string): number {
    let count = 0;
    const regex = new RegExp(pattern);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.remove(key);
        count++;
      }
    }

    return count;
  }
}
