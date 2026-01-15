import { EventEmitter } from 'events';
import { CacheConfig } from '../types';
import { Logger } from '../utils/logger';
import { LRUCache } from '../utils/helpers';
import * as redis from 'redis';

export class CacheManager extends EventEmitter {
  private logger: Logger;
  private cacheConfigs: Map<string, CacheConfig> = new Map();
  private memoryCaches: Map<string, LRUCache<string, any>> = new Map();
  private redisClients: Map<string, redis.RedisClientType> = new Map();
  private isRunning = false;

  constructor() {
    super();
    this.logger = new Logger('CacheManager');
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Cache Manager is already running');
    }

    this.logger.info('Starting Cache Manager...');

    try {
      // Initialize all configured caches
      for (const [serviceId, config] of this.cacheConfigs) {
        await this.initializeCache(serviceId, config);
      }

      this.isRunning = true;
      this.logger.info('Cache Manager started successfully');
      this.emit('started');
    } catch (error) {
      this.logger.error('Failed to start Cache Manager', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping Cache Manager...');

    try {
      // Close all Redis connections
      for (const client of this.redisClients.values()) {
        await client.quit();
      }

      // Clear memory caches
      this.memoryCaches.clear();
      this.redisClients.clear();

      this.isRunning = false;
      this.logger.info('Cache Manager stopped successfully');
      this.emit('stopped');
    } catch (error) {
      this.logger.error('Error during Cache Manager shutdown', { error });
      throw error;
    }
  }

  configureCache(serviceId: string, config: CacheConfig): void {
    this.cacheConfigs.set(serviceId, config);
    this.logger.debug(`Cache configured for service: ${serviceId}`, config);
  }

  private async initializeCache(serviceId: string, config: CacheConfig): Promise<void> {
    switch (config.type) {
      case 'memory':
        this.initializeMemoryCache(serviceId, config);
        break;
      case 'redis':
        await this.initializeRedisCache(serviceId, config);
        break;
      case 'file':
        // File cache implementation would go here
        this.logger.warn(`File cache not implemented for service: ${serviceId}`);
        break;
      default:
        throw new Error(`Unsupported cache type: ${config.type}`);
    }
  }

  private initializeMemoryCache(serviceId: string, config: CacheConfig): void {
    const cache = new LRUCache<string, any>(config.maxSize);
    this.memoryCaches.set(serviceId, cache);
    this.logger.debug(`Initialized memory cache for service: ${serviceId}`);
  }

  private async initializeRedisCache(serviceId: string, config: CacheConfig): Promise<void> {
    if (!config.redis) {
      throw new Error('Redis configuration required for Redis cache');
    }

    try {
      let client: redis.RedisClientType;

      if (config.redis.cluster) {
        // Redis cluster configuration
        const nodes = config.redis.nodes || [
          { host: config.redis.host, port: config.redis.port }
        ];

        client = redis.createClient({
          socket: {
            host: nodes[0].host,
            port: nodes[0].port
          },
          password: nodes[0].password,
          database: nodes[0].db
        }) as redis.RedisClientType;
      } else {
        // Single Redis instance
        client = redis.createClient({
          socket: {
            host: config.redis.host,
            port: config.redis.port
          },
          password: config.redis.password,
          database: config.redis.db
        }) as redis.RedisClientType;
      }

      await client.connect();
      this.redisClients.set(serviceId, client);
      this.logger.info(`Connected to Redis for service: ${serviceId}`);
    } catch (error) {
      this.logger.error(`Failed to connect to Redis for service: ${serviceId}`, { error });
      // Fall back to memory cache
      this.initializeMemoryCache(serviceId, config);
    }
  }

  async get(serviceId: string, key: string): Promise<any> {
    const config = this.cacheConfigs.get(serviceId);
    if (!config) {
      throw new Error(`No cache configured for service: ${serviceId}`);
    }

    try {
      switch (config.type) {
        case 'memory':
          return this.getFromMemory(serviceId, key);
        case 'redis':
          return await this.getFromRedis(serviceId, key);
        case 'file':
          return await this.getFromFile(serviceId, key);
        default:
          throw new Error(`Unsupported cache type: ${config.type}`);
      }
    } catch (error) {
      this.logger.error(`Cache get failed for service: ${serviceId}`, { error, key });
      throw error;
    }
  }

  async set(serviceId: string, key: string, value: any, ttl?: number): Promise<void> {
    const config = this.cacheConfigs.get(serviceId);
    if (!config) {
      throw new Error(`No cache configured for service: ${serviceId}`);
    }

    const effectiveTTL = ttl || config.ttl;

    try {
      switch (config.type) {
        case 'memory':
          this.setToMemory(serviceId, key, value, effectiveTTL);
          break;
        case 'redis':
          await this.setToRedis(serviceId, key, value, effectiveTTL);
          break;
        case 'file':
          await this.setToFile(serviceId, key, value, effectiveTTL);
          break;
      }
    } catch (error) {
      this.logger.error(`Cache set failed for service: ${serviceId}`, { error, key });
      throw error;
    }
  }

  async delete(serviceId: string, key: string): Promise<void> {
    const config = this.cacheConfigs.get(serviceId);
    if (!config) {
      throw new Error(`No cache configured for service: ${serviceId}`);
    }

    try {
      switch (config.type) {
        case 'memory':
          this.deleteFromMemory(serviceId, key);
          break;
        case 'redis':
          await this.deleteFromRedis(serviceId, key);
          break;
        case 'file':
          await this.deleteFromFile(serviceId, key);
          break;
      }
    } catch (error) {
      this.logger.error(`Cache delete failed for service: ${serviceId}`, { error, key });
      throw error;
    }
  }

  async invalidateByPattern(serviceId: string, pattern: string): Promise<void> {
    const config = this.cacheConfigs.get(serviceId);
    if (!config) {
      throw new Error(`No cache configured for service: ${serviceId}`);
    }

    this.logger.debug(`Invalidating cache pattern for service: ${serviceId}`, { pattern });

    try {
      switch (config.type) {
        case 'memory':
          this.invalidateMemoryByPattern(serviceId, pattern);
          break;
        case 'redis':
          await this.invalidateRedisByPattern(serviceId, pattern);
          break;
        case 'file':
          // File cache pattern invalidation would go here
          break;
      }
    } catch (error) {
      this.logger.error(`Cache pattern invalidation failed for service: ${serviceId}`, { error, pattern });
      throw error;
    }
  }

  async invalidateAll(serviceId: string): Promise<void> {
    const config = this.cacheConfigs.get(serviceId);
    if (!config) {
      throw new Error(`No cache configured for service: ${serviceId}`);
    }

    this.logger.debug(`Invalidating all cache for service: ${serviceId}`);

    try {
      switch (config.type) {
        case 'memory':
          this.invalidateMemoryAll(serviceId);
          break;
        case 'redis':
          await this.invalidateRedisAll(serviceId);
          break;
        case 'file':
          // File cache invalidation would go here
          break;
      }
    } catch (error) {
      this.logger.error(`Cache invalidation failed for service: ${serviceId}`, { error });
      throw error;
    }
  }

  // Private methods for memory cache
  private getFromMemory(serviceId: string, key: string): any {
    const cache = this.memoryCaches.get(serviceId);
    if (!cache) {
      throw new Error(`Memory cache not initialized for service: ${serviceId}`);
    }
    return cache.get(key);
  }

  private setToMemory(serviceId: string, key: string, value: any, ttl: number): void {
    const cache = this.memoryCaches.get(serviceId);
    if (!cache) {
      throw new Error(`Memory cache not initialized for service: ${serviceId}`);
    }
    cache.set(key, value);
  }

  private deleteFromMemory(serviceId: string, key: string): void {
    const cache = this.memoryCaches.get(serviceId);
    if (!cache) {
      throw new Error(`Memory cache not initialized for service: ${serviceId}`);
    }
    cache.delete(key);
  }

  private invalidateMemoryByPattern(serviceId: string, pattern: string): void {
    const cache = this.memoryCaches.get(serviceId);
    if (!cache) {
      throw new Error(`Memory cache not initialized for service: ${serviceId}`);
    }

    // This is a simplified pattern matching
    // In a real implementation, you'd need to iterate through all keys
    for (const key of cache['cache'].keys()) {
      if (key.includes(pattern)) {
        cache.delete(key);
      }
    }
  }

  private invalidateMemoryAll(serviceId: string): void {
    const cache = this.memoryCaches.get(serviceId);
    if (!cache) {
      throw new Error(`Memory cache not initialized for service: ${serviceId}`);
    }
    cache.clear();
  }

  // Private methods for Redis cache
  private async getFromRedis(serviceId: string, key: string): Promise<any> {
    const client = this.redisClients.get(serviceId);
    if (!client) {
      throw new Error(`Redis client not initialized for service: ${serviceId}`);
    }

    const value = await client.get(key);
    if (value) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return null;
  }

  private async setToRedis(serviceId: string, key: string, value: any, ttl: number): Promise<void> {
    const client = this.redisClients.get(serviceId);
    if (!client) {
      throw new Error(`Redis client not initialized for service: ${serviceId}`);
    }

    const serialized = JSON.stringify(value);
    await client.setEx(key, ttl, serialized);
  }

  private async deleteFromRedis(serviceId: string, key: string): Promise<void> {
    const client = this.redisClients.get(serviceId);
    if (!client) {
      throw new Error(`Redis client not initialized for service: ${serviceId}`);
    }

    await client.del(key);
  }

  private async invalidateRedisByPattern(serviceId: string, pattern: string): Promise<void> {
    const client = this.redisClients.get(serviceId);
    if (!client) {
      throw new Error(`Redis client not initialized for service: ${serviceId}`);
    }

    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
  }

  private async invalidateRedisAll(serviceId: string): Promise<void> {
    const client = this.redisClients.get(serviceId);
    if (!client) {
      throw new Error(`Redis client not initialized for service: ${serviceId}`);
    }

    await client.flushDb();
  }

  // Private methods for file cache (placeholder)
  private async getFromFile(serviceId: string, key: string): Promise<any> {
    // Implementation would read from file system
    return null;
  }

  private async setToFile(serviceId: string, key: string, value: any, ttl: number): Promise<void> {
    // Implementation would write to file system
  }

  private async deleteFromFile(serviceId: string, key: string): Promise<void> {
    // Implementation would delete from file system
  }

  async getCacheStats(serviceId: string): Promise<any> {
    const config = this.cacheConfigs.get(serviceId);
    if (!config) {
      throw new Error(`No cache configured for service: ${serviceId}`);
    }

    const stats: any = {
      type: config.type,
      maxSize: config.maxSize,
      ttl: config.ttl,
      evictionPolicy: config.evictionPolicy,
      memory: {},
      redis: {}
    };

    // Memory cache stats
    const memoryCache = this.memoryCaches.get(serviceId);
    if (memoryCache) {
      stats.memory = {
        size: memoryCache.size(),
        maxSize: config.maxSize
      };
    }

    // Redis cache stats
    const redisClient = this.redisClients.get(serviceId);
    if (redisClient) {
      try {
        const info = await redisClient.info('memory');
        stats.redis = {
          connected: true,
          memoryInfo: info
        };
      } catch (error) {
        stats.redis = {
          connected: false,
          error: error.message
        };
      }
    }

    return stats;
  }

  async getAllCacheStats(): Promise<any> {
    const allStats: Record<string, any> = {};

    for (const serviceId of this.cacheConfigs.keys()) {
      try {
        allStats[serviceId] = await this.getCacheStats(serviceId);
      } catch (error) {
        allStats[serviceId] = { error: error.message };
      }
    }

    return {
      totalServices: this.cacheConfigs.size,
      services: allStats,
      timestamp: new Date()
    };
  }
}

// Event emitter interface
export interface CacheManagerEvents {
  cacheHit: (event: { serviceId: string; key: string; value: any; timestamp: Date }) => void;
  cacheMiss: (event: { serviceId: string; key: string; timestamp: Date }) => void;
  cacheSet: (event: { serviceId: string; key: string; value: any; ttl: number; timestamp: Date }) => void;
  cacheDelete: (event: { serviceId: string; key: string; timestamp: Date }) => void;
  started: () => void;
  stopped: () => void;
}

// Extend CacheManager with EventEmitter functionality
export interface CacheManager extends NodeJS.EventEmitter {
  on(event: 'cacheHit', listener: (event: { serviceId: string; key: string; value: any; timestamp: Date }) => void): this;
  on(event: 'cacheMiss', listener: (event: { serviceId: string; key: string; timestamp: Date }) => void): this;
  on(event: 'cacheSet', listener: (event: { serviceId: string; key: string; value: any; ttl: number; timestamp: Date }) => void): this;
  on(event: 'cacheDelete', listener: (event: { serviceId: string; key: string; timestamp: Date }) => void): this;
  on(event: 'started', listener: () => void): this;
  on(event: 'stopped', listener: () => void): this;

  emit(event: 'cacheHit', event: { serviceId: string; key: string; value: any; timestamp: Date }): boolean;
  emit(event: 'cacheMiss', event: { serviceId: string; key: string; timestamp: Date }): boolean;
  emit(event: 'cacheSet', event: { serviceId: string; key: string; value: any; ttl: number; timestamp: Date }): boolean;
  emit(event: 'cacheDelete', event: { serviceId: string; key: string; timestamp: Date }): boolean;
  emit(event: 'started'): boolean;
  emit(event: 'stopped'): boolean;
}