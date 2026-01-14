/**
 * L3 Tier - R2 Cache
 * Cold storage for large or infrequently accessed data
 */

import {
  CacheTier,
  CacheEntry,
  CacheMetadata,
  TierConfig,
  CacheError,
  CacheCapacityError,
} from '../types';
import { R2Bucket } from '@cloudflare/workers-types';
import {
  serialize,
  deserialize,
  serializeCompressed,
  deserializeCompressed,
  calculateSize,
  validateKey,
} from '../utils/serializer';

// ============================================================================
// L3 Cache Entry
// ============================================================================

interface L3Entry<T> {
  key: string;
  value: T;
  metadata: CacheMetadata;
  compressed: boolean;
  checksum: string;
}

// ============================================================================
// L3 Cache Configuration
// ============================================================================

const DEFAULT_L3_CONFIG: TierConfig = {
  tier: CacheTier.L3,
  maxSize: 100 * 1024 * 1024 * 1024, // 100 GB
  maxEntries: 10000000,
  ttl: 604800000, // 7 days
  compressionEnabled: true,
  priority: 3,
};

// ============================================================================
// L3 Cache Implementation
// ============================================================================

export class L3Cache {
  private r2: R2Bucket;
  private config: TierConfig;
  private prefix: string;
  private metadataPrefix: string;

  constructor(r2: R2Bucket, config: Partial<TierConfig> = {}, prefix = 'l3') {
    this.r2 = r2;
    this.config = { ...DEFAULT_L3_CONFIG, ...config, tier: CacheTier.L3 };
    this.prefix = prefix;
    this.metadataPrefix = `${prefix}_metadata`;
  }

  /**
   * Get a value from L3 cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!validateKey(key)) {
      throw new CacheError(`Invalid key: ${key}`, 'INVALID_KEY', CacheTier.L3, key);
    }

    const startTime = performance.now();

    try {
      const objectKey = this.getObjectKey(key);
      const object = await this.r2.get(objectKey);

      if (!object) {
        return null;
      }

      const buffer = await object.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Deserialize (with decompression if needed)
      const entry = this.config.compressionEnabled
        ? await deserializeCompressed<L3Entry<T>>(bytes)
        : deserialize<L3Entry<T>>(new TextDecoder().decode(bytes));

      // Verify checksum
      if (!this.verifyChecksum(entry)) {
        throw new CacheError(
          `Checksum verification failed for key ${key}`,
          'CHECKSUM_FAILED',
          CacheTier.L3,
          key
        );
      }

      // Update metadata
      entry.metadata.lastAccessed = Date.now();
      entry.metadata.accessCount++;

      // Store updated metadata asynchronously
      this.updateMetadata(key, entry.metadata).catch(console.error);

      const latency = performance.now() - startTime;

      // Target: <100ms access (cold storage)
      if (latency > 100) {
        console.warn(`L3 cache access slow: ${latency.toFixed(2)}ms`);
      }

      return entry.value;
    } catch (error) {
      if (error instanceof CacheError) {
        throw error;
      }
      throw new CacheError(
        `Failed to get key ${key}: ${error}`,
        'GET_FAILED',
        CacheTier.L3,
        key
      );
    }
  }

  /**
   * Set a value in L3 cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!validateKey(key)) {
      throw new CacheError(`Invalid key: ${key}`, 'INVALID_KEY', CacheTier.L3, key);
    }

    const size = calculateSize(value);

    // Check size limit
    if (size > this.config.maxSize) {
      throw new CacheCapacityError(
        CacheTier.L3,
        `Value too large: ${size} bytes`
      );
    }

    const now = Date.now();

    const metadata: CacheMetadata = {
      createdAt: now,
      lastAccessed: now,
      accessCount: 1,
      size,
      compressed: this.config.compressionEnabled,
      tags: [],
      version: 1,
    };

    const entry: L3Entry<T> = {
      key,
      value,
      metadata,
      compressed: this.config.compressionEnabled,
      checksum: '',
    };

    // Calculate checksum
    entry.checksum = this.calculateChecksum(entry);

    try {
      const objectKey = this.getObjectKey(key);
      let data: Uint8Array | string;

      if (this.config.compressionEnabled) {
        data = await serializeCompressed(entry);
      } else {
        data = serialize(entry);
      }

      // Set custom metadata for R2
      const customMetadata = {
        'content-type': 'application/json',
        'cache-ttl': String(ttl || this.config.ttl),
        'created-at': String(now),
        'entry-size': String(size),
        'compressed': String(this.config.compressionEnabled),
      };

      await this.r2.put(objectKey, data, {
        customMetadata,
        httpMetadata: {
          contentType: 'application/json',
        },
      });

      // Store metadata separately for faster access
      await this.updateMetadata(key, metadata);
    } catch (error) {
      throw new CacheError(
        `Failed to set key ${key}: ${error}`,
        'SET_FAILED',
        CacheTier.L3,
        key
      );
    }
  }

  /**
   * Delete a value from L3 cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const objectKey = this.getObjectKey(key);
      await this.r2.delete(objectKey);
      await this.deleteMetadata(key);
      return true;
    } catch (error) {
      throw new CacheError(
        `Failed to delete key ${key}: ${error}`,
        'DELETE_FAILED',
        CacheTier.L3,
        key
      );
    }
  }

  /**
   * Check if a key exists in L3 cache
   */
  async has(key: string): Promise<boolean> {
    try {
      const objectKey = this.getObjectKey(key);
      const object = await this.r2.head(objectKey);
      return object !== null;
    } catch {
      return false;
    }
  }

  /**
   * Clear all entries from L3 cache
   */
  async clear(): Promise<void> {
    try {
      const listed = await this.r2.list({ prefix: this.prefix });

      for (const object of listed.objects) {
        await this.r2.delete(object.key);
      }

      // Also clear metadata
      const metadataListed = await this.r2.list({ prefix: this.metadataPrefix });
      for (const object of metadataListed.objects) {
        await this.r2.delete(object.key);
      }
    } catch (error) {
      throw new CacheError(
        `Failed to clear L3 cache: ${error}`,
        'CLEAR_FAILED',
        CacheTier.L3
      );
    }
  }

  /**
   * Get all keys in L3 cache
   */
  async keys(): Promise<string[]> {
    try {
      const listed = await this.r2.list({ prefix: this.prefix });
      return listed.objects.map(obj => this.stripObjectKey(obj.key));
    } catch (error) {
      throw new CacheError(
        `Failed to list keys: ${error}`,
        'LIST_FAILED',
        CacheTier.L3
      );
    }
  }

  /**
   * Get multiple values at once
   */
  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();

    try {
      await Promise.all(
        keys.map(async key => {
          const value = await this.get<T>(key);
          if (value !== null) {
            results.set(key, value);
          }
        })
      );
    } catch (error) {
      throw new CacheError(
        `Failed to get multiple keys: ${error}`,
        'GET_MANY_FAILED',
        CacheTier.L3
      );
    }

    return results;
  }

  /**
   * Set multiple values at once
   */
  async setMany<T>(entries: Map<string, T>, ttl?: number): Promise<void> {
    try {
      const operations = Array.from(entries.entries()).map(([key, value]) =>
        this.set(key, value, ttl)
      );

      await Promise.all(operations);
    } catch (error) {
      throw new CacheError(
        `Failed to set multiple keys: ${error}`,
        'SET_MANY_FAILED',
        CacheTier.L3
      );
    }
  }

  /**
   * Get cache size information
   */
  async getSize(): Promise<{ entries: number; bytes: number; maxBytes: number }> {
    try {
      const listed = await this.r2.list({ prefix: this.prefix });
      const totalBytes = listed.objects.reduce((sum, obj) => sum + obj.size, 0);

      return {
        entries: listed.objects.length,
        bytes: totalBytes,
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
      const data = serialize(metadata);

      await this.r2.put(metadataKey, data, {
        customMetadata: {
          'content-type': 'application/json',
        },
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
      const object = await this.r2.get(metadataKey);

      if (!object) {
        return null;
      }

      const buffer = await object.arrayBuffer();
      const text = new TextDecoder().decode(buffer);
      return deserialize<CacheMetadata>(text);
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
      await this.r2.delete(metadataKey);
    } catch (error) {
      console.error(`Failed to delete metadata for ${key}:`, error);
    }
  }

  /**
   * Get object key with prefix
   */
  private getObjectKey(key: string): string {
    return `${this.prefix}/${key}`;
  }

  /**
   * Get metadata key
   */
  private getMetadataKey(key: string): string {
    return `${this.metadataPrefix}/${key}`;
  }

  /**
   * Strip prefix from object key
   */
  private stripObjectKey(objectKey: string): string {
    return objectKey.substring(this.prefix.length + 1);
  }

  /**
   * Calculate checksum for entry
   */
  private calculateChecksum(entry: L3Entry<any>): string {
    const data = serialize(entry);
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Verify checksum for entry
   */
  private verifyChecksum(entry: L3Entry<any>): boolean {
    const expectedChecksum = this.calculateChecksum(entry);
    return entry.checksum === expectedChecksum;
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
    truncated: boolean;
  }> {
    try {
      const result = await this.r2.list({
        prefix: this.prefix,
        cursor,
        limit,
      });

      return {
        keys: result.objects.map(obj => this.stripObjectKey(obj.key)),
        cursor: result.truncated ? result.cursor : undefined,
        truncated: result.truncated,
      };
    } catch (error) {
      throw new CacheError(
        `Failed to list keys: ${error}`,
        'LIST_FAILED',
        CacheTier.L3
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

  /**
   * Copy entry to another key
   */
  async copy(sourceKey: string, destinationKey: string): Promise<void> {
    try {
      const sourceObjectKey = this.getObjectKey(sourceKey);
      const destObjectKey = this.getObjectKey(destinationKey);

      const source = await this.r2.get(sourceObjectKey);
      if (!source) {
        throw new CacheError(
          `Source key ${sourceKey} not found`,
          'NOT_FOUND',
          CacheTier.L3,
          sourceKey
        );
      }

      await this.r2.put(destObjectKey, source.body);
    } catch (error) {
      if (error instanceof CacheError) {
        throw error;
      }
      throw new CacheError(
        `Failed to copy ${sourceKey} to ${destinationKey}: ${error}`,
        'COPY_FAILED',
        CacheTier.L3
      );
    }
  }

  /**
   * Move entry to another key
   */
  async move(sourceKey: string, destinationKey: string): Promise<void> {
    await this.copy(sourceKey, destinationKey);
    await this.delete(sourceKey);
  }

  /**
   * Get entry with metadata
   */
  async getWithMetadata<T>(key: string): Promise<{ value: T; metadata: CacheMetadata } | null> {
    const value = await this.get<T>(key);
    if (value === null) {
      return null;
    }

    const metadata = await this.getMetadata(key);
    return { value, metadata: metadata! };
  }

  /**
   * Set entry with custom metadata
   */
  async setWithMetadata<T>(
    key: string,
    value: T,
    metadata: Partial<CacheMetadata>,
    ttl?: number
  ): Promise<void> {
    const size = calculateSize(value);
    const now = Date.now();

    const fullMetadata: CacheMetadata = {
      createdAt: metadata.createdAt || now,
      lastAccessed: now,
      accessCount: metadata.accessCount || 1,
      size,
      compressed: this.config.compressionEnabled,
      tags: metadata.tags || [],
      version: metadata.version || 1,
    };

    await this.set(key, value, ttl);
    await this.updateMetadata(key, fullMetadata);
  }
}

// ============================================================================
// L3 Cache Factory
// ============================================================================

export function createL3Cache(
  r2: R2Bucket,
  config?: Partial<TierConfig>,
  prefix?: string
): L3Cache {
  return new L3Cache(r2, config, prefix);
}
