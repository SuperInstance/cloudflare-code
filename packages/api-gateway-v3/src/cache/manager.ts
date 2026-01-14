/**
 * Cache Manager - Response caching
 */

import { GatewayRequest, GatewayResponse } from '../types/index.js';

export interface CacheConfig {
  enabled: boolean;
  defaultTTL: number;
  maxSize: number;
  evictionPolicy: 'lru' | 'lfu' | 'fifo';
  compression: boolean;
}

export interface CacheEntry {
  key: string;
  response: GatewayResponse;
  expiresAt: number;
  accessedAt: number;
  accessCount: number;
  size: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  entries: number;
}

export class CacheManager {
  private config: CacheConfig;
  private cache: Map<string, CacheEntry>;
  private stats: CacheStats;
  private currentSize: number;

  constructor(config: CacheConfig) {
    this.config = config;
    this.cache = new Map();
    this.currentSize = 0;
    this.stats = {
      hits: 0,
      misses: 0,
      size: 0,
      entries: 0,
    };
  }

  async get(request: GatewayRequest): Promise<GatewayResponse | null> {
    if (!this.config.enabled) {
      return null;
    }

    const key = this.generateKey(request);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.currentSize -= entry.size;
      this.stats.misses++;
      return null;
    }

    // Update access stats
    entry.accessedAt = Date.now();
    entry.accessCount++;
    this.stats.hits++;

    return entry.response;
  }

  async set(
    request: GatewayRequest,
    response: GatewayResponse,
    options?: { ttl?: number }
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const key = this.generateKey(request);
    const ttl = options?.ttl || this.config.defaultTTL;
    const size = this.calculateSize(response);

    // Evict if necessary
    await this.ensureCapacity(size);

    const entry: CacheEntry = {
      key,
      response,
      expiresAt: Date.now() + ttl,
      accessedAt: Date.now(),
      accessCount: 0,
      size,
    };

    this.cache.set(key, entry);
    this.currentSize += size;
    this.stats.entries = this.cache.size;
    this.stats.size = this.currentSize;
  }

  async invalidate(pattern?: string): Promise<void> {
    if (!pattern) {
      this.cache.clear();
      this.currentSize = 0;
      return;
    }

    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        const entry = this.cache.get(key)!;
        this.cache.delete(key);
        this.currentSize -= entry.size;
      }
    }
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  private generateKey(request: GatewayRequest): string {
    return `${request.method}:${request.url}`;
  }

  private calculateSize(response: GatewayResponse): number {
    if (typeof response.body === 'string') {
      return response.body.length * 2; // UTF-16
    }
    return 1000; // Estimated size
  }

  private async ensureCapacity(requiredSize: number): Promise<void> {
    while (this.currentSize + requiredSize > this.config.maxSize && this.cache.size > 0) {
      const evicted = this.evictOne();
      if (!evicted) {
        break;
      }
    }
  }

  private evictOne(): CacheEntry | null {
    let oldestKey: string | null = null;
    let oldestEntry: CacheEntry | null = null;

    for (const [key, entry] of this.cache) {
      if (!oldestEntry || entry.accessedAt < oldestEntry.accessedAt) {
        oldestKey = key;
        oldestEntry = entry;
      }
    }

    if (oldestKey && oldestEntry) {
      this.cache.delete(oldestKey);
      this.currentSize -= oldestEntry.size;
      return oldestEntry;
    }

    return null;
  }
}
