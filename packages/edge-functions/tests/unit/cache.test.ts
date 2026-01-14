/**
 * Unit tests for Cache Layer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CacheLayer,
  EntryTooLargeError,
  createCacheLayer,
  createCacheConfig,
} from '../../src/cache/layer';
import type { EdgeFunction, EdgeEnv } from '../../src/types';

describe('CacheLayer', () => {
  let cache: CacheLayer;
  let mockEnv: EdgeEnv;

  beforeEach(() => {
    cache = new CacheLayer({
      maxSize: 10,
      maxEntrySize: 1024,
      defaultTTL: 60,
      enableMetrics: true,
    });

    mockEnv = {
      KV: {
        CACHE: {
          get: vi.fn(),
          put: vi.fn(),
          delete: vi.fn(),
          list: vi.fn(() => ({ keys: [] })),
        },
      },
      DURABLE: {},
      R2: {},
      DB: {},
      QUEUE: {},
    };
  });

  describe('Basic Cache Operations', () => {
    it('should set and get values', async () => {
      await cache.set('func1', { key: 'value' }, 'result');
      const result = await cache.get('func1', { key: 'value' });

      expect(result).toBe('result');
    });

    it('should return null for cache miss', async () => {
      const result = await cache.get('func1', { key: 'value' });
      expect(result).toBeNull();
    });

    it('should delete values', async () => {
      await cache.set('func1', { key: 'value' }, 'result');
      const deleted = await cache.delete('func1', { key: 'value' });

      expect(deleted).toBe(true);

      const result = await cache.get('func1', { key: 'value' });
      expect(result).toBeNull();
    });

    it('should clear all cache', async () => {
      await cache.set('func1', { key: 'value1' }, 'result1');
      await cache.set('func2', { key: 'value2' }, 'result2');

      await cache.clear();

      expect(await cache.get('func1', { key: 'value1' })).toBeNull();
      expect(await cache.get('func2', { key: 'value2' })).toBeNull();
    });
  });

  describe('Cache Expiration', () => {
    it('should expire entries after TTL', async () => {
      await cache.set('func1', { key: 'value' }, 'result', { ttl: 0.1 }); // 100ms

      await new Promise(resolve => setTimeout(resolve, 150));

      const result = await cache.get('func1', { key: 'value' });
      expect(result).toBeNull();
    });

    it('should serve stale entries while revalidating', async () => {
      const cacheWithSWR = new CacheLayer({
        staleWhileRevalidate: 1, // 1 second
      });

      await cacheWithSWR.set('func1', { key: 'value' }, 'result', { ttl: 0.1 });

      await new Promise(resolve => setTimeout(resolve, 150));

      // Should still return stale result
      const result = await cacheWithSWR.get('func1', { key: 'value' });
      expect(result).toBe('result');
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent keys for same input', async () => {
      const input = { key: 'value' };

      await cache.set('func1', input, 'result1');
      await cache.set('func1', input, 'result2');

      const result = await cache.get('func1', input);
      expect(result).toBe('result2'); // Should be overwritten
    });

    it('should generate different keys for different inputs', async () => {
      await cache.set('func1', { key: 'value1' }, 'result1');
      await cache.set('func1', { key: 'value2' }, 'result2');

      const result1 = await cache.get('func1', { key: 'value1' });
      const result2 = await cache.get('func1', { key: 'value2' });

      expect(result1).toBe('result1');
      expect(result2).toBe('result2');
    });

    it('should use custom key generator', () => {
      const customCache = new CacheLayer({
        customKeyGenerator: (funcId, input) => {
          return `custom:${funcId}:${JSON.stringify(input)}`;
        },
      });

      expect(customCache).toBeInstanceOf(CacheLayer);
    });
  });

  describe('Cache Statistics', () => {
    it('should track cache hits', async () => {
      await cache.set('func1', { key: 'value' }, 'result');
      await cache.get('func1', { key: 'value' }); // hit

      const stats = cache.getStats('func1');
      expect(stats?.hits).toBe(1);
      expect(stats?.misses).toBe(0);
    });

    it('should track cache misses', async () => {
      await cache.get('func1', { key: 'value' }); // miss

      const stats = cache.getStats('func1');
      expect(stats?.hits).toBe(0);
      expect(stats?.misses).toBe(1);
    });

    it('should calculate hit rate', async () => {
      await cache.set('func1', { key: 'value' }, 'result');
      await cache.get('func1', { key: 'value' }); // hit
      await cache.get('func1', { key: 'other' }); // miss

      const stats = cache.getStats('func1');
      expect(stats?.hitRate).toBe(0.5);
    });

    it('should reset statistics', async () => {
      await cache.set('func1', { key: 'value' }, 'result');
      await cache.get('func1', { key: 'value' });

      cache.resetStats('func1');

      const stats = cache.getStats('func1');
      expect(stats?.hits).toBe(0);
      expect(stats?.misses).toBe(0);
    });
  });

  describe('Cache Size Management', () => {
    it('should evict LRU entry when full', async () => {
      const smallCache = new CacheLayer({ maxSize: 2 });

      await smallCache.set('func1', { key: '1' }, 'result1');
      await smallCache.set('func2', { key: '2' }, 'result2');
      await smallCache.set('func3', { key: '3' }, 'result3');

      // First entry should be evicted
      const result1 = await smallCache.get('func1', { key: '1' });
      expect(result1).toBeNull();

      // Other entries should exist
      expect(await smallCache.get('func2', { key: '2' })).toBe('result2');
      expect(await smallCache.get('func3', { key: '3' })).toBe('result3');
    });

    it('should throw error for entry too large', async () => {
      const largeCache = new CacheLayer({ maxEntrySize: 100 });

      const largeValue = 'x'.repeat(200);

      await expect(
        cache.set('func1', { key: 'value' }, largeValue)
      ).rejects.toThrow(EntryTooLargeError);
    });

    it('should get cache size info', async () => {
      await cache.set('func1', { key: 'value1' }, 'result1');
      await cache.set('func2', { key: 'value2' }, 'result2');

      const size = cache.getCacheSize();
      expect(size.entries).toBe(2);
      expect(size.maxSize).toBe(10);
    });
  });

  describe('Function Cache Operations', () => {
    it('should clear all entries for a function', async () => {
      await cache.set('func1', { key: 'value1' }, 'result1');
      await cache.set('func1', { key: 'value2' }, 'result2');
      await cache.set('func2', { key: 'value3' }, 'result3');

      const cleared = await cache.clearFunctionCache('func1');

      expect(cleared).toBe(2);
      expect(await cache.get('func1', { key: 'value1' })).toBeNull();
      expect(await cache.get('func1', { key: 'value2' })).toBeNull();
      expect(await cache.get('func2', { key: 'value3' })).toBe('result3');
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate by pattern', async () => {
      await cache.set('func1', { key: 'value' }, 'result1');
      await cache.set('func2', { key: 'value' }, 'result2');
      await cache.set('other', { key: 'value' }, 'result3');

      const invalidated = await cache.invalidatePattern(/^func/);

      expect(invalidated).toBeGreaterThanOrEqual(2);
      expect(await cache.get('func1', { key: 'value' })).toBeNull();
      expect(await cache.get('func2', { key: 'value' })).toBeNull();
      expect(await cache.get('other', { key: 'value' })).toBe('result3');
    });

    it('should invalidate expired entries', async () => {
      await cache.set('func1', { key: 'value1' }, 'result1', { ttl: 0.1 });
      await cache.set('func2', { key: 'value2' }, 'result2', { ttl: 60 });

      await new Promise(resolve => setTimeout(resolve, 150));

      const invalidated = await cache.invalidateExpired();
      expect(invalidated).toBeGreaterThan(0);
    });
  });

  describe('Bypass Cache', () => {
    it('should bypass cache when condition met', async () => {
      await cache.set(
        'func1',
        { key: 'value' },
        'result',
        {
          bypassCache: (input) => (input as any).bypass === true,
        }
      );

      // Should not be cached
      const result1 = await cache.get('func1', { key: 'value', bypass: true });
      expect(result1).toBeNull();
    });
  });

  describe('Utility Functions', () => {
    it('should create cache layer with config', () => {
      const customCache = createCacheLayer({
        maxSize: 100,
        defaultTTL: 300,
      });

      expect(customCache).toBeInstanceOf(CacheLayer);
    });

    it('should create cache config', () => {
      const config = createCacheConfig({
        ttl: 120,
        enabled: true,
      });

      expect(config.ttl).toBe(120);
      expect(config.enabled).toBe(true);
    });
  });

  describe('Cache Warming', () => {
    it('should warm cache for function', async () => {
      const func: EdgeFunction = {
        id: 'warm-func',
        name: 'Warm Function',
        handler: async (input: { num: number }) => input.num * 2,
        config: {},
        version: '1.0.0',
      };

      await cache.warmCache(func, [{ num: 1 }, { num: 2 }, { num: 3 }], mockEnv);

      const result1 = await cache.get('warm-func', { num: 1 });
      const result2 = await cache.get('warm-func', { num: 2 });
      const result3 = await cache.get('warm-func', { num: 3 });

      expect(result1).toBe(2);
      expect(result2).toBe(4);
      expect(result3).toBe(6);
    });
  });
});
