/**
 * Storage module exports and factory
 */

import type { StorageConfig, RateLimitState } from '../types/index.js';
import { MemoryStorage } from './memory-storage.js';
import { RedisStorage } from './redis-storage.js';
import { DurableObjectsStorage, RateLimiterDurableObject } from './durable-objects-storage.js';

/**
 * Storage interface
 */
export interface StorageBackend {
  get(key: string): Promise<RateLimitState | null>;
  set(key: string, value: RateLimitState, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  increment(key: string, amount?: number): Promise<number>;
  expire(key: string, ttl: number): Promise<void>;
  getMultiple(keys: string[]): Promise<Map<string, RateLimitState>>;
  setMultiple(entries: Map<string, RateLimitState>, ttl?: number): Promise<void>;
  deleteMultiple(keys: string[]): Promise<void>;
  clear?(): Promise<void>;
  keys?(pattern?: string): Promise<string[]>;
  destroy?(): Promise<void>;
}

/**
 * Create storage backend based on configuration
 */
export function createStorage(config: StorageConfig, binding?: any): StorageBackend {
  switch (config.type) {
    case 'memory':
      return new MemoryStorage(config);

    case 'redis':
      return new RedisStorage(config);

    case 'durable_objects':
      if (!binding) {
        throw new Error('Durable Objects binding required');
      }
      return new DurableObjectsStorage(config, binding);

    case 'custom':
      if (!config.custom) {
        throw new Error('Custom storage implementation required');
      }
      return config.custom as StorageBackend;

    default:
      throw new Error(`Unknown storage type: ${config.type}`);
  }
}

export {
  MemoryStorage,
  RedisStorage,
  DurableObjectsStorage,
  RateLimiterDurableObject
};
