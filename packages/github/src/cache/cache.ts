/**
 * Cache System for GitHub API Responses
 * Supports in-memory and Redis caching with TTL and size limits
 */

import { LRUCache } from 'lru-cache';
import Redis from 'ioredis';
import { CacheError, CacheMissError, CacheConnectionError } from '../errors';

// ============================================================================
// Cache Entry Interface
// ============================================================================

export interface CacheEntry<T> {
  key: string;
  value: T;
  expiresAt: number;
  createdAt: number;
  accessCount: number;
  lastAccessedAt: number;
  metadata?: CacheMetadata;
}

export interface CacheMetadata {
  etag?: string;
  lastModified?: string;
  contentType?: string;
  headers?: Record<string, string>;
}

// ============================================================================
// Cache Options
// ============================================================================

export interface CacheOptions {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  type: 'memory' | 'redis';
  redis?: RedisOptions;
  keyPrefix?: string;
  cleanupInterval?: number;
  compressionThreshold?: number;
}

export interface RedisOptions {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  connectTimeout?: number;
  lazyConnect?: boolean;
  maxRetriesPerRequest?: number;
}

export interface GetOptions {
  skipCache?: boolean;
  updateAccess?: boolean;
  metadata?: boolean;
}

export interface SetOptions {
  ttl?: number;
  metadata?: CacheMetadata;
  compress?: boolean;
}

// ============================================================================
// Abstract Cache Provider
// ============================================================================

export abstract class CacheProvider {
  protected options: CacheOptions;
  protected stats: CacheStats;

  constructor(options: CacheOptions) {
    this.options = options;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      clears: 0,
      evictions: 0,
      errors: 0
    };
  }

  abstract get<T>(key: string, options?: GetOptions): Promise<T | null>;
  abstract set<T>(key: string, value: T, options?: SetOptions): Promise<void>;
  abstract delete(key: string): Promise<boolean>;
  abstract clear(): Promise<void>;
  abstract has(key: string): Promise<boolean>;
  abstract keys(pattern?: string): Promise<string[]>;
  abstract size(): Promise<number>;
  abstract cleanup(): Promise<number>;

  getStats(): CacheStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      clears: 0,
      evictions: 0,
      errors: 0
    };
  }

  protected incrementHit(): void {
    this.stats.hits++;
  }

  protected incrementMiss(): void {
    this.stats.misses++;
  }

  protected incrementSet(): void {
    this.stats.sets++;
  }

  protected incrementDelete(): void {
    this.stats.deletes++;
  }

  protected incrementClear(): void {
    this.stats.clears++;
  }

  protected incrementEviction(): void {
    this.stats.evictions++;
  }

  protected incrementError(): void {
    this.stats.errors++;
  }
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  clears: number;
  evictions: number;
  errors: number;
}

// ============================================================================
// In-Memory Cache Provider
// ============================================================================

export class MemoryCacheProvider extends CacheProvider {
  private cache: LRUCache<string, CacheEntry<unknown>>;

  constructor(options: CacheOptions) {
    super(options);
    this.cache = new LRUCache<string, CacheEntry<unknown>>({
      max: options.maxSize,
      ttl: options.ttl,
      updateAgeOnGet: true,
      updateAgeOnHas: true,
      dispose: (value, key) => {
        this.incrementEviction();
      }
    });

    if (options.cleanupInterval) {
      setInterval(() => this.cleanup(), options.cleanupInterval);
    }
  }

  async get<T>(key: string, options?: GetOptions): Promise<T | null> {
    if (!this.options.enabled) {
      return null;
    }

    try {
      const entry = this.cache.get(key) as CacheEntry<T> | undefined;

      if (!entry) {
        this.incrementMiss();
        return null;
      }

      if (Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        this.incrementEviction();
        this.incrementMiss();
        return null;
      }

      this.incrementHit();
      return entry.value;
    } catch (error) {
      this.incrementError();
      throw new CacheError('Failed to get value from cache', error as Error);
    }
  }

  async set<T>(key: string, value: T, options?: SetOptions): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    try {
      const ttl = options?.ttl ?? this.options.ttl;
      const entry: CacheEntry<T> = {
        key,
        value,
        expiresAt: Date.now() + ttl,
        createdAt: Date.now(),
        accessCount: 0,
        lastAccessedAt: Date.now(),
        metadata: options?.metadata
      };

      this.cache.set(key, entry as CacheEntry<unknown>);
      this.incrementSet();
    } catch (error) {
      this.incrementError();
      throw new CacheError('Failed to set value in cache', error as Error);
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const deleted = this.cache.delete(key);
      if (deleted) {
        this.incrementDelete();
      }
      return deleted;
    } catch (error) {
      this.incrementError();
      throw new CacheError('Failed to delete value from cache', error as Error);
    }
  }

  async clear(): Promise<void> {
    try {
      this.cache.clear();
      this.incrementClear();
    } catch (error) {
      this.incrementError();
      throw new CacheError('Failed to clear cache', error as Error);
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      return this.cache.has(key);
    } catch (error) {
      this.incrementError();
      return false;
    }
  }

  async keys(pattern?: string): Promise<string[]> {
    try {
      const allKeys = Array.from(this.cache.keys());
      if (!pattern) {
        return allKeys;
      }

      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return allKeys.filter(key => regex.test(key));
    } catch (error) {
      this.incrementError();
      throw new CacheError('Failed to get keys from cache', error as Error);
    }
  }

  async size(): Promise<number> {
    return this.cache.size;
  }

  async cleanup(): Promise<number> {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  async getEntry<T>(key: string): Promise<CacheEntry<T> | null> {
    return this.cache.get(key) as CacheEntry<T> | null;
  }

  async setEntry<T>(entry: CacheEntry<T>): Promise<void> {
    this.cache.set(entry.key, entry as CacheEntry<unknown>);
  }

  async peek<T>(key: string): Promise<T | null> {
    const entry = this.cache.peek(key) as CacheEntry<T> | undefined;
    return entry?.value ?? null;
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: SetOptions
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  async getMultiple<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();

    for (const key of keys) {
      const value = await this.get<T>(key);
      if (value !== null) {
        result.set(key, value);
      }
    }

    return result;
  }

  async setMultiple<T>(entries: Map<string, T>, options?: SetOptions): Promise<void> {
    for (const [key, value] of entries.entries()) {
      await this.set(key, value, options);
    }
  }

  async deleteMultiple(keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (await this.delete(key)) {
        deleted++;
      }
    }
    return deleted;
  }
}

// ============================================================================
// Redis Cache Provider
// ============================================================================

export class RedisCacheProvider extends CacheProvider {
  private client: Redis;
  private keyPrefix: string;

  constructor(options: CacheOptions) {
    super(options);

    if (!options.redis) {
      throw new CacheError('Redis options are required for Redis cache');
    }

    this.keyPrefix = options.redis.keyPrefix || options.keyPrefix || 'github:cache:';
    this.client = new Redis({
      host: options.redis.host,
      port: options.redis.port,
      password: options.redis.password,
      db: options.redis.db || 0,
      connectTimeout: options.redis.connectTimeout || 10000,
      lazyConnect: options.redis.lazyConnect || false,
      maxRetriesPerRequest: options.redis.maxRetriesPerRequest || 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    this.client.on('error', (error) => {
      this.incrementError();
      throw new CacheConnectionError(error);
    });
  }

  private getPrefixedKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private serialize<T>(value: T): string {
    return JSON.stringify(value);
  }

  private deserialize<T>(data: string): T {
    return JSON.parse(data) as T;
  }

  async get<T>(key: string, options?: GetOptions): Promise<T | null> {
    if (!this.options.enabled) {
      return null;
    }

    try {
      const prefixedKey = this.getPrefixedKey(key);
      const data = await this.client.get(prefixedKey);

      if (!data) {
        this.incrementMiss();
        return null;
      }

      const entry: CacheEntry<T> = this.deserialize<CacheEntry<T>>(data);

      if (Date.now() > entry.expiresAt) {
        await this.client.del(prefixedKey);
        this.incrementEviction();
        this.incrementMiss();
        return null;
      }

      if (options?.updateAccess !== false) {
        entry.accessCount++;
        entry.lastAccessedAt = Date.now();
        await this.client.set(prefixedKey, this.serialize(entry), 'PX', entry.expiresAt - Date.now());
      }

      this.incrementHit();
      return entry.value;
    } catch (error) {
      this.incrementError();
      throw new CacheError('Failed to get value from Redis cache', error as Error);
    }
  }

  async set<T>(key: string, value: T, options?: SetOptions): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    try {
      const prefixedKey = this.getPrefixedKey(key);
      const ttl = options?.ttl ?? this.options.ttl;
      const entry: CacheEntry<T> = {
        key,
        value,
        expiresAt: Date.now() + ttl,
        createdAt: Date.now(),
        accessCount: 0,
        lastAccessedAt: Date.now(),
        metadata: options?.metadata
      };

      await this.client.set(prefixedKey, this.serialize(entry), 'PX', ttl);
      this.incrementSet();
    } catch (error) {
      this.incrementError();
      throw new CacheError('Failed to set value in Redis cache', error as Error);
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      const result = await this.client.del(prefixedKey);
      if (result > 0) {
        this.incrementDelete();
        return true;
      }
      return false;
    } catch (error) {
      this.incrementError();
      throw new CacheError('Failed to delete value from Redis cache', error as Error);
    }
  }

  async clear(): Promise<void> {
    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await this.client.keys(pattern);

      if (keys.length > 0) {
        await this.client.del(...keys);
      }

      this.incrementClear();
    } catch (error) {
      this.incrementError();
      throw new CacheError('Failed to clear Redis cache', error as Error);
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      const exists = await this.client.exists(prefixedKey);
      return exists === 1;
    } catch (error) {
      this.incrementError();
      return false;
    }
  }

  async keys(pattern?: string): Promise<string[]> {
    try {
      const searchPattern = pattern
        ? `${this.keyPrefix}${pattern}`
        : `${this.keyPrefix}*`;

      const prefixedKeys = await this.client.keys(searchPattern);
      return prefixedKeys.map(key => key.replace(this.keyPrefix, ''));
    } catch (error) {
      this.incrementError();
      throw new CacheError('Failed to get keys from Redis cache', error as Error);
    }
  }

  async size(): Promise<number> {
    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await this.client.keys(pattern);
      return keys.length;
    } catch (error) {
      this.incrementError();
      return 0;
    }
  }

  async cleanup(): Promise<number> {
    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await this.client.keys(pattern);
      const now = Date.now();
      const expiredKeys: string[] = [];

      for (const prefixedKey of keys) {
        const data = await this.client.get(prefixedKey);
        if (data) {
          const entry = this.deserialize<CacheEntry<unknown>>(data);
          if (now > entry.expiresAt) {
            expiredKeys.push(prefixedKey);
          }
        }
      }

      if (expiredKeys.length > 0) {
        await this.client.del(...expiredKeys);
      }

      return expiredKeys.length;
    } catch (error) {
      this.incrementError();
      throw new CacheError('Failed to cleanup Redis cache', error as Error);
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: SetOptions
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  async getMultiple<T>(keys: string[]): Promise<Map<string, T>> {
    const result = new Map<string, T>();

    if (keys.length === 0) {
      return result;
    }

    try {
      const prefixedKeys = keys.map(k => this.getPrefixedKey(k));
      const values = await this.client.mget(...prefixedKeys);

      for (let i = 0; i < keys.length; i++) {
        const value = values[i];
        if (value) {
          const entry: CacheEntry<T> = this.deserialize<CacheEntry<T>>(value);
          if (Date.now() <= entry.expiresAt) {
            result.set(keys[i], entry.value);
            this.incrementHit();
          } else {
            this.incrementMiss();
          }
        } else {
          this.incrementMiss();
        }
      }
    } catch (error) {
      this.incrementError();
      throw new CacheError('Failed to get multiple values from Redis cache', error as Error);
    }

    return result;
  }

  async setMultiple<T>(entries: Map<string, T>, options?: SetOptions): Promise<void> {
    if (entries.size === 0) {
      return;
    }

    try {
      const pipeline = this.client.pipeline();
      const ttl = options?.ttl ?? this.options.ttl;

      for (const [key, value] of entries.entries()) {
        const entry: CacheEntry<T> = {
          key,
          value,
          expiresAt: Date.now() + ttl,
          createdAt: Date.now(),
          accessCount: 0,
          lastAccessedAt: Date.now(),
          metadata: options?.metadata
        };

        const prefixedKey = this.getPrefixedKey(key);
        pipeline.set(prefixedKey, this.serialize(entry), 'PX', ttl);
      }

      await pipeline.exec();
      this.incrementSet();
    } catch (error) {
      this.incrementError();
      throw new CacheError('Failed to set multiple values in Redis cache', error as Error);
    }
  }

  async deleteMultiple(keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }

    try {
      const prefixedKeys = keys.map(k => this.getPrefixedKey(k));
      const result = await this.client.del(...prefixedKeys);
      this.incrementDelete();
      return result;
    } catch (error) {
      this.incrementError();
      throw new CacheError('Failed to delete multiple values from Redis cache', error as Error);
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  async getInfo(): Promise<Record<string, string>> {
    try {
      const info = await this.client.info();
      const lines = info.split('\r\n');
      const result: Record<string, string> = {};

      for (const line of lines) {
        if (line && !line.startsWith('#')) {
          const [key, value] = line.split(':');
          if (key && value) {
            result[key] = value;
          }
        }
      }

      return result;
    } catch (error) {
      throw new CacheError('Failed to get Redis info', error as Error);
    }
  }
}

// ============================================================================
// Cache Factory
// ============================================================================

export class CacheFactory {
  static create(options: CacheOptions): CacheProvider {
    if (!options.enabled) {
      return new MemoryCacheProvider(options);
    }

    switch (options.type) {
      case 'redis':
        return new RedisCacheProvider(options);
      case 'memory':
      default:
        return new MemoryCacheProvider(options);
    }
  }
}

// ============================================================================
// Cache Key Generator
// ============================================================================

export class CacheKeyGenerator {
  static generate(
    resource: string,
    identifier: string,
    params?: Record<string, unknown>
  ): string {
    const parts = [resource, identifier];

    if (params) {
      const sortedParams = Object.keys(params)
        .sort()
        .map(key => `${key}=${JSON.stringify(params[key])}`)
        .join('&');
      parts.push(sortedParams);
    }

    return parts.join(':');
  }

  static generateForRepository(
    owner: string,
    repo: string,
    resource: string,
    identifier?: string
  ): string {
    return this.generate('repo', `${owner}/${repo}/${resource}`, identifier ? { identifier } : undefined);
  }

  static generateForPullRequest(
    owner: string,
    repo: string,
    prNumber: number,
    resource: string
  ): string {
    return this.generate('pr', `${owner}/${repo}/${prNumber}`, { resource });
  }

  static generateForIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    resource: string
  ): string {
    return this.generate('issue', `${owner}/${repo}/${issueNumber}`, { resource });
  }

  static generateForGraphQL(query: string, variables?: Record<string, unknown>): string {
    const hash = this.hash(query + JSON.stringify(variables || {}));
    return this.generate('graphql', hash);
  }

  private static hash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

// ============================================================================
// Cache Decorator
// ============================================================================

export function cached<T>(
  cache: CacheProvider,
  keyGenerator: (...args: unknown[]) => string,
  options?: { ttl?: number; metadata?: CacheMetadata }
) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]): Promise<T> {
      const key = keyGenerator(...args);

      try {
        const cached = await cache.get<T>(key);
        if (cached !== null) {
          return cached;
        }
      } catch (error) {
        // Cache miss or error, continue to execute
      }

      const result = await originalMethod.apply(this, args);

      try {
        await cache.set(key, result, options);
      } catch (error) {
        // Failed to cache, but still return result
      }

      return result;
    };

    return descriptor;
  };
}
