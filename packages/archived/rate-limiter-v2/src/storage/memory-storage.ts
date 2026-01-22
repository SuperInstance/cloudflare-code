/**
 * In-memory storage backend for rate limiting
 */

// @ts-nocheck
import type {
  RateLimitState,
  StorageConfig
} from '../types/index.js';

/**
 * In-memory storage implementation
 */
export class MemoryStorage {
  private store: Map<string, RateLimitState>;
  private ttlStore: Map<string, NodeJS.Timeout>;
  private prefix: string;
  private defaultTTL: number;

  constructor(config: StorageConfig = { type: 'memory' }) {
    this.store = new Map();
    this.ttlStore = new Map();
    this.prefix = config.prefix || 'ratelimit';
    this.defaultTTL = config.ttl || 3600000; // 1 hour default

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Get a value from storage
   */
  async get(key: string): Promise<RateLimitState | null> {
    const fullKey = this.getFullKey(key);
    const value = this.store.get(fullKey);

    if (!value) {
      return null;
    }

    // Check if expired
    if (this.ttlStore.has(fullKey)) {
      return value;
    }

    // No TTL set, value exists
    return value;
  }

  /**
   * Set a value in storage
   */
  async set(key: string, value: RateLimitState, ttl?: number): Promise<void> {
    const fullKey = this.getFullKey(key);

    // Clear existing TTL
    const existingTimeout = this.ttlStore.get(fullKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set value
    this.store.set(fullKey, value);

    // Set TTL if provided
    const expirationTTL = ttl || this.defaultTTL;
    const timeout = setTimeout(() => {
      this.delete(key);
    }, expirationTTL);

    this.ttlStore.set(fullKey, timeout);
  }

  /**
   * Delete a value from storage
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);

    const timeout = this.ttlStore.get(fullKey);
    if (timeout) {
      clearTimeout(timeout);
      this.ttlStore.delete(fullKey);
    }

    this.store.delete(fullKey);
  }

  /**
   * Increment a counter value
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    const fullKey = this.getFullKey(key);
    const current = await this.get(key);

    const newCount = current ? current.count + amount : amount;

    await this.set(key, {
      count: newCount,
      lastUpdate: Date.now()
    });

    return newCount;
  }

  /**
   * Set expiration time
   */
  async expire(key: string, ttl: number): Promise<void> {
    const fullKey = this.getFullKey(key);
    const value = this.store.get(fullKey);

    if (!value) {
      return;
    }

    // Clear existing TTL
    const existingTimeout = this.ttlStore.get(fullKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new TTL
    const timeout = setTimeout(() => {
      this.delete(key);
    }, ttl);

    this.ttlStore.set(fullKey, timeout);
  }

  /**
   * Get multiple values
   */
  async getMultiple(keys: string[]): Promise<Map<string, RateLimitState>> {
    const results = new Map<string, RateLimitState>();

    await Promise.all(
      keys.map(async (key) => {
        const value = await this.get(key);
        if (value) {
          results.set(key, value);
        }
      })
    );

    return results;
  }

  /**
   * Set multiple values
   */
  async setMultiple(entries: Map<string, RateLimitState>, ttl?: number): Promise<void> {
    await Promise.all(
      Array.from(entries.entries()).map(([key, value]) =>
        this.set(key, value, ttl)
      )
    );
  }

  /**
   * Delete multiple values
   */
  async deleteMultiple(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.delete(key)));
  }

  /**
   * Clear all values
   */
  async clear(): Promise<void> {
    // Clear all timeouts
    for (const timeout of this.ttlStore.values()) {
      clearTimeout(timeout);
    }

    this.store.clear();
    this.ttlStore.clear();
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.store.keys());

    if (!pattern) {
      return allKeys;
    }

    const regex = new RegExp(
      pattern.replace(/\*/g, '.*').replace(/\?/g, '.')
    );

    return allKeys.filter((key) => regex.test(key));
  }

  /**
   * Get storage size
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, value] of this.store.entries()) {
      const timeout = this.ttlStore.get(key);

      // If no timeout and value is old (24 hours), consider it expired
      if (!timeout && now - value.lastUpdate > 86400000) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.store.delete(key);
    }
  }

  /**
   * Get full key with prefix
   */
  private getFullKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  /**
   * Destroy storage and cleanup resources
   */
  async destroy(): Promise<void> {
    await this.clear();
  }

  /**
   * Get storage statistics
   */
  getStats(): {
    size: number;
    keysWithTTL: number;
    prefix: string;
  } {
    return {
      size: this.store.size,
      keysWithTTL: this.ttlStore.size,
      prefix: this.prefix
    };
  }
}
