/**
 * L2 Tier - KV Cache
 * Fast edge storage with millisecond access
 */

import {
  CacheTier,
  CacheEntry,
  CacheMetadata,
  TierConfig,
  CacheError,
  CacheCapacityError,
} from '../types';
import { KVNamespace } from '@cloudflare/workers-types';
import { serialize, deserialize, calculateSize, validateKey } from '../utils/serializer';

// ============================================================================
// L2 Cache Entry
// ============================================================================

interface L2Entry<T> {
  key: string;
  value: T;
  metadata: CacheMetadata;
  compressed: boolean;
}

// ============================================================================
// L2 Cache Configuration
// ============================================================================

const DEFAULT_L2_CONFIG: TierConfig = {
  tier: CacheTier.L2,
  maxSize: 1024 * 1024 * 1024, // 1 GB
  maxEntries: 1000000,
  ttl: 86400000, // 24 hours
  compressionEnabled: true,
  priority: 2,
};

// ============================================================================
// L2 Cache Implementation
// ============================================================================

export class L2Cache {
  private kv: KVNamespace;
  private config: TierConfig;
  private prefix: string;
  private metadataKey = 'metadata';

  constructor(kv: KVNamespace, config: Partial<TierConfig> = {}, prefix = 'l2') {
    this.kv = kv;
    this.config = { ...DEFAULT_L2_CONFIG, ...config, tier: CacheTier.L2 };
    this.prefix = prefix;
  }

  /**
   * Get a value from L2 cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!validateKey(key)) {
      throw new CacheError(`Invalid key: ${key}`, 'INVALID_KEY', CacheTier.L2, key);
    }

    const startTime = performance.now();

    try {
      const cacheKey = this.getCacheKey(key);
      const value = await this.kv.get(cacheKey, 'text');

      if (!value) {
        return null;
      }

      const entry = deserialize<L2Entry<T>>(value);

      // Update metadata
      entry.metadata.lastAccessed = Date.now();
      entry.metadata.accessCount++;

      // Store updated metadata asynchronously
      this.updateMetadata(key, entry.metadata).catch(console.error);

      const latency = performance.now() - startTime;

      // Target: <10ms access
      if (latency > 10) {
        console.warn(`L2 cache access slow: ${latency.toFixed(2)}ms`);
      }

      return entry.value;
    } catch (error) {
      throw new CacheError(
        `Failed to get key ${key}: ${error}`,
        'GET_FAILED',
        CacheTier.L2,
        key
      );
    }
  }

  /**
   * Set a value in L2 cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!validateKey(key)) {
      throw new CacheError(`Invalid key: ${key}`, 'INVALID_KEY', CacheTier.L2, key);
    }

    const size = calculateSize(value);

    // Check size limit
    if (size > this.config.maxSize) {
      throw new CacheCapacityError(
        CacheTier.L2,
        `Value too large: ${size} bytes`
      );
    }

    const now = Date.now();
    const cacheTTL = ttl || this.config.ttl;

    const metadata: CacheMetadata = {
      createdAt: now,
      lastAccessed: now,
      accessCount: 1,
      size,
      compressed: false,
      tags: [],
      version: 1,
    };

    const entry: L2Entry<T> = {
      key,
      value,
      metadata,
      compressed: false,
    };

    try {
      const cacheKey = this.getCacheKey(key);
      const serialized = serialize(entry);

      await this.kv.put(cacheKey, serialized, {
        expirationTtl: Math.floor(cacheTTL / 1000),
      });

      // Store metadata separately for faster access
      await this.updateMetadata(key, metadata);
    } catch (error) {
      throw new CacheError(
        `Failed to set key ${key}: ${error}`,
        'SET_FAILED',
        CacheTier.L2,
        key
      );
    }
  }

  /**
   * Delete a value from L2 cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const cacheKey = this.getCacheKey(key);
      await this.kv.delete(cacheKey);
      await this.deleteMetadata(key);
      return true;
    } catch (error) {
      throw new CacheError(
        `Failed to delete key ${key}: ${error}`,
        'DELETE_FAILED',
        CacheTier.L2,
        key
      );
    }
  }

  /**
   * Check if a key exists in L2 cache
   */
  async has(key: string): Promise<boolean> {
    try {
      const cacheKey = this.getCacheKey(key);
      const value = await this.kv.get(cacheKey, 'text');
      return value !== null;
    } catch {
      return false;
    }
  }

  /**
   * Clear all entries from L2 cache
   */
  async clear(): Promise<void> {
    try {
      const list = await this.kv.list({ prefix: this.prefix });
      const keys = list.keys.map(k => k.name);

      // Delete in batches
      const batchSize = 100;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        await Promise.all(batch.map(key => this.kv.delete(key)));
      }
    } catch (error) {
      throw new CacheError(
        `Failed to clear L2 cache: ${error}`,
        'CLEAR_FAILED',
        CacheTier.L2
      );
    }
  }

  /**
   * Get all keys in L2 cache
   */
  async keys(): Promise<string[]> {
    try {
      const list = await this.kv.list({ prefix: this.prefix });
      return list.keys.map(k => this.stripCacheKey(k.name));
    } catch (error) {
      throw new CacheError(
        `Failed to list keys: ${error}`,
        'LIST_FAILED',
        CacheTier.L2
      );
    }
  }

  /**
   * Get multiple values at once
   */
  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    const cacheKeys = keys.map(key => this.getCacheKey(key));

    try {
      const values = await Promise.all(
        cacheKeys.map(async cacheKey => {
          const value = await this.kv.get(cacheKey, 'text');
          return value;
        })
      );

      for (let i = 0; i < keys.length; i++) {
        if (values[i]) {
          try {
            const entry = deserialize<L2Entry<T>>(values[i]!);
            results.set(keys[i], entry.value);
          } catch {
            // Skip invalid entries
          }
        }
      }
    } catch (error) {
      throw new CacheError(
        `Failed to get multiple keys: ${error}`,
        'GET_MANY_FAILED',
        CacheTier.L2
      );
    }

    return results;
  }

  /**
   * Set multiple values at once
   */
  async setMany<T>(entries: Map<string, T>, ttl?: number): Promise<void> {
    const cacheTTL = ttl || this.config.ttl;

    try {
      const operations = Array.from(entries.entries()).map(([key, value]) => {
        const cacheKey = this.getCacheKey(key);
        const size = calculateSize(value);
        const now = Date.now();

        const metadata: CacheMetadata = {
          createdAt: now,
          lastAccessed: now,
          accessCount: 1,
          size,
          compressed: false,
          tags: [],
          version: 1,
        };

        const entry: L2Entry<T> = {
          key,
          value,
          metadata,
          compressed: false,
        };

        const serialized = serialize(entry);
        return this.kv.put(cacheKey, serialized, {
          expirationTtl: Math.floor(cacheTTL / 1000),
        });
      });

      await Promise.all(operations);
    } catch (error) {
      throw new CacheError(
        `Failed to set multiple keys: ${error}`,
        'SET_MANY_FAILED',
        CacheTier.L2
      );
    }
  }

  /**
   * Get cache size information
   */
  async getSize(): Promise<{ entries: number; bytes: number; maxBytes: number }> {
    try {
      const list = await this.kv.list({ prefix: this.prefix });
      return {
        entries: list.keys.length,
        bytes: 0, // KV doesn't provide size info
        maxBytes: this.config.maxSize,
      };
    } catch (error) {
      return {
        entries: 0,
        bytes: 0,
        maxBytes: this.config.maxSize,
      };
    }
  }

  /**
   * Update metadata for a key
   */
  private async updateMetadata(key: string, metadata: CacheMetadata): Promise<void> {
    try {
      const metadataKey = this.getMetadataKey(key);
      await this.kv.put(metadataKey, serialize(metadata), {
        expirationTtl: Math.floor(this.config.ttl / 1000),
      });
    } catch (error) {
      console.error(`Failed to update metadata for ${key}:`, error);
    }
  }

  /**
   * Get metadata for a key
   */
  async getMetadata(key: string): Promise<CacheMetadata | null> {
    try {
      const metadataKey = this.getMetadataKey(key);
      const value = await this.kv.get(metadataKey, 'text');
      return value ? deserialize<CacheMetadata>(value) : null;
    } catch {
      return null;
    }
  }

  /**
   * Delete metadata for a key
   */
  private async deleteMetadata(key: string): Promise<void> {
    try {
      const metadataKey = this.getMetadataKey(key);
      await this.kv.delete(metadataKey);
    } catch (error) {
      console.error(`Failed to delete metadata for ${key}:`, error);
    }
  }

  /**
   * Get cache key with prefix
   */
  private getCacheKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  /**
   * Get metadata key
   */
  private getMetadataKey(key: string): string {
    return `${this.prefix}:${this.metadataKey}:${key}`;
  }

  /**
   * Strip prefix from cache key
   */
  private stripCacheKey(cacheKey: string): string {
    return cacheKey.substring(this.prefix.length + 1);
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    size: number;
    count: number;
    hitRate: number;
  }> {
    const sizeInfo = await this.getSize();
    return {
      size: sizeInfo.bytes,
      count: sizeInfo.entries,
      hitRate: 0, // Will be calculated by higher-level cache
    };
  }

  /**
   * List keys with pagination
   */
  async listKeys(cursor?: string, limit = 100): Promise<{
    keys: string[];
    cursor: string | undefined;
    list_complete: boolean;
  }> {
    try {
      const result = await this.kv.list({
        prefix: this.prefix,
        cursor,
        limit,
      });

      return {
        keys: result.keys.map(k => this.stripCacheKey(k.name)),
        cursor: result.cursor,
        list_complete: result.list_complete,
      };
    } catch (error) {
      throw new CacheError(
        `Failed to list keys: ${error}`,
        'LIST_FAILED',
        CacheTier.L2
      );
    }
  }

  /**
   * Get or set pattern
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const existing = await this.get<T>(key);
    if (existing !== null) {
      return existing;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }
}

// ============================================================================
// L2 Cache Factory
// ============================================================================

export function createL2Cache(
  kv: KVNamespace,
  config?: Partial<TierConfig>,
  prefix?: string
): L2Cache {
  return new L2Cache(kv, config, prefix);
}
