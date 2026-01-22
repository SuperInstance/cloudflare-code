/**
 * Redis storage backend for distributed rate limiting
 */

// @ts-nocheck
import Redis from 'ioredis';
import type {
  RateLimitState,
  StorageConfig
} from '../types/index.js';

/**
 * Redis storage implementation
 */
export class RedisStorage {
  private client: Redis;
  private prefix: string;
  private defaultTTL: number;
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;

  constructor(config: StorageConfig) {
    if (config.type !== 'redis' || !config.redis) {
      throw new Error('Redis configuration required');
    }

    const redisConfig = config.redis;

    this.client = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db || 0,
      retryStrategy: (times) => {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          return null; // Stop reconnecting
        }
        this.reconnectAttempts++;
        return Math.min(times * 50, 2000); // Exponential backoff
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false
    });

    this.prefix = redisConfig.keyPrefix || config.prefix || 'ratelimit';
    this.defaultTTL = config.ttl || 3600000;

    this.setupEventHandlers();
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.connected = true;
      this.reconnectAttempts = 0;
    });

    this.client.on('ready', () => {
      this.connected = true;
    });

    this.client.on('error', (error) => {
      console.error('Redis error:', error);
      this.connected = false;
    });

    this.client.on('close', () => {
      this.connected = false;
    });

    this.client.on('reconnecting', () => {
      this.reconnectAttempts++;
    });
  }

  /**
   * Get a value from Redis
   */
  async get(key: string): Promise<RateLimitState | null> {
    try {
      const fullKey = this.getFullKey(key);
      const value = await this.client.get(fullKey);

      if (!value) {
        return null;
      }

      return JSON.parse(value) as RateLimitState;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  /**
   * Set a value in Redis
   */
  async set(key: string, value: RateLimitState, ttl?: number): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      const serialized = JSON.stringify(value);
      const expirationTTL = ttl || this.defaultTTL;

      // Convert to seconds for Redis
      const ttlSeconds = Math.ceil(expirationTTL / 1000);

      await this.client.setex(fullKey, ttlSeconds, serialized);
    } catch (error) {
      console.error('Redis set error:', error);
      throw error;
    }
  }

  /**
   * Delete a value from Redis
   */
  async delete(key: string): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      await this.client.del(fullKey);
    } catch (error) {
      console.error('Redis delete error:', error);
    }
  }

  /**
   * Increment a counter value atomically
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);

      // Use pipeline for atomic operation
      const pipeline = this.client.pipeline();
      pipeline.incrby(fullKey, amount);
      pipeline.pexpire(fullKey, this.defaultTTL);

      const results = await pipeline.exec();

      if (!results || results[0]?.[0]) {
        throw new Error('Pipeline execution failed');
      }

      return results[0][1] as number;
    } catch (error) {
      console.error('Redis increment error:', error);
      throw error;
    }
  }

  /**
   * Set expiration time
   */
  async expire(key: string, ttl: number): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      const ttlMs = ttl;

      await this.client.pexpire(fullKey, ttlMs);
    } catch (error) {
      console.error('Redis expire error:', error);
    }
  }

  /**
   * Get multiple values using MGET
   */
  async getMultiple(keys: string[]): Promise<Map<string, RateLimitState>> {
    try {
      const fullKeys = keys.map((k) => this.getFullKey(k));
      const values = await this.client.mget(fullKeys);

      const results = new Map<string, RateLimitState>();

      keys.forEach((key, index) => {
        const value = values[index];
        if (value) {
          try {
            results.set(key, JSON.parse(value) as RateLimitState);
          } catch {
            // Skip invalid JSON
          }
        }
      });

      return results;
    } catch (error) {
      console.error('Redis getMultiple error:', error);
      return new Map();
    }
  }

  /**
   * Set multiple values using pipeline
   */
  async setMultiple(entries: Map<string, RateLimitState>, ttl?: number): Promise<void> {
    try {
      const pipeline = this.client.pipeline();
      const expirationTTL = ttl || this.defaultTTL;
      const ttlSeconds = Math.ceil(expirationTTL / 1000);

      for (const [key, value] of entries.entries()) {
        const fullKey = this.getFullKey(key);
        pipeline.setex(fullKey, ttlSeconds, JSON.stringify(value));
      }

      await pipeline.exec();
    } catch (error) {
      console.error('Redis setMultiple error:', error);
      throw error;
    }
  }

  /**
   * Delete multiple values
   */
  async deleteMultiple(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    try {
      const fullKeys = keys.map((k) => this.getFullKey(k));
      await this.client.del(...fullKeys);
    } catch (error) {
      console.error('Redis deleteMultiple error:', error);
    }
  }

  /**
   * Clear all values with prefix
   */
  async clear(): Promise<void> {
    try {
      const pattern = `${this.prefix}:*`;
      const keys = await this.client.keys(pattern);

      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      console.error('Redis clear error:', error);
    }
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern?: string): Promise<string[]> {
    try {
      const searchPattern = pattern
        ? `${this.prefix}:${pattern}`
        : `${this.prefix}:*`;

      const fullKeys = await this.client.keys(searchPattern);

      // Remove prefix from keys
      return fullKeys.map((key) =>
        key.substring(this.prefix.length + 1)
      );
    } catch (error) {
      console.error('Redis keys error:', error);
      return [];
    }
  }

  /**
   * Execute atomic increment with conditional expiration
   */
  async incrementWithCondition(
    key: string,
    amount: number,
    condition: (current: number) => boolean
  ): Promise<number | null> {
    try {
      const fullKey = this.getFullKey(key);

      // Use Lua script for atomic operation
      const luaScript = `
        local current = redis.call('GET', KEYS[1])
        if current == false then
          current = 0
        else
          current = tonumber(current)
        end

        if ${condition.toString().replace(/current/g, 'current')} then
          local newval = redis.call('INCRBY', KEYS[1], ARGV[1])
          redis.call('PEXPIRE', KEYS[1], ARGV[2])
          return newval
        else
          return current
        end
      `;

      const result = await this.client.eval(
        luaScript,
        1,
        fullKey,
        amount,
        this.defaultTTL
      ) as number;

      return result;
    } catch (error) {
      console.error('Redis incrementWithCondition error:', error);
      return null;
    }
  }

  /**
   * Check if connected to Redis
   */
  isConnected(): boolean {
    return this.connected && this.client.status === 'ready';
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    connected: boolean;
    status: string;
    reconnectAttempts: number;
    prefix: string;
  } {
    return {
      connected: this.connected,
      status: this.client.status,
      reconnectAttempts: this.reconnectAttempts,
      prefix: this.prefix
    };
  }

  /**
   * Get full key with prefix
   */
  private getFullKey(key: string): string {
    return `${this.prefix}:${key}`;
  }

  /**
   * Close Redis connection
   */
  async destroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch (error) {
      console.error('Redis destroy error:', error);
    }
  }

  /**
   * Ping Redis server
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Get Redis info
   */
  async getInfo(section?: string): Promise<string> {
    try {
      return await this.client.info(section);
    } catch (error) {
      console.error('Redis getInfo error:', error);
      return '';
    }
  }
}
