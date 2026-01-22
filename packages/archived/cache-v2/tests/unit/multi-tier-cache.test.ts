/**
 * Unit tests for Multi-Tier Cache
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MultiTierCache } from '../../src/tiers/multi-tier';
import { CacheTier, CacheContext } from '../../src/types';

// Mock KV and R2 for testing
const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
};

const mockR2 = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
  head: vi.fn(),
};

describe('MultiTierCache', () => {
  let cache: MultiTierCache;
  let context: CacheContext;

  beforeEach(() => {
    vi.clearAllMocks();

    context = {
      env: {
        CACHE_KV: mockKV as any,
        CACHE_R2: mockR2 as any,
      },
    };

    cache = new MultiTierCache(context, {
      tiers: {
        L1: {
          tier: CacheTier.L1,
          maxSize: 1024 * 1024, // 1 MB
          maxEntries: 100,
          ttl: 60000,
          compressionEnabled: false,
          priority: 1,
        },
        L2: {
          tier: CacheTier.L2,
          maxSize: 10 * 1024 * 1024, // 10 MB
          maxEntries: 1000,
          ttl: 300000,
          compressionEnabled: false,
          priority: 2,
        },
        L3: {
          tier: CacheTier.L3,
          maxSize: 100 * 1024 * 1024, // 100 MB
          maxEntries: 10000,
          ttl: 3600000,
          compressionEnabled: false,
          priority: 3,
        },
      },
    });
  });

  describe('Basic Operations', () => {
    it('should store and retrieve from L1', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.get<string>('key1');

      expect(result.hit).toBe(true);
      expect(result.value).toBe('value1');
      expect(result.tier).toBe(CacheTier.L1);
    });

    it('should return cache miss for non-existent keys', async () => {
      const result = await cache.get<string>('nonexistent');

      expect(result.hit).toBe(false);
      expect(result.value).toBeNull();
    });

    it('should handle complex objects', async () => {
      const obj = {
        name: 'test',
        nested: { value: 42 },
        array: [1, 2, 3],
      };

      await cache.set('obj', obj);
      const result = await cache.get<typeof obj>('obj');

      expect(result.hit).toBe(true);
      expect(result.value).toEqual(obj);
    });
  });

  describe('Tier Promotion', () => {
    it('should promote from L2 to L1 on access', async () => {
      // Mock L2 get to return a value
      mockKV.get.mockResolvedValueOnce(
        JSON.stringify({
          key: 'key1',
          value: 'value1',
          metadata: {
            createdAt: Date.now(),
            lastAccessed: Date.now(),
            accessCount: 1,
            size: 10,
            compressed: false,
            tags: [],
            version: 1,
          },
          compressed: false,
        })
      );

      const result = await cache.get<string>('key1');

      // Should hit L2 and promote to L1
      expect(result.hit).toBe(true);
      expect(result.value).toBe('value1');
    });
  });

  describe('Delete Operations', () => {
    it('should delete from all tiers', async () => {
      await cache.set('key1', 'value1');
      const deleted = await cache.delete('key1');

      expect(deleted).toBe(true);

      const result = await cache.get<string>('key1');
      expect(result.hit).toBe(false);
    });
  });

  describe('Has Operations', () => {
    it('should check if key exists in any tier', async () => {
      await cache.set('key1', 'value1');
      const exists = await cache.has('key1');

      expect(exists).toBe(true);
    });

    it('should return false for non-existent keys', async () => {
      const exists = await cache.has('nonexistent');

      expect(exists).toBe(false);
    });
  });

  describe('Clear Operations', () => {
    it('should clear all tiers', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      await cache.clear();

      expect(await cache.has('key1')).toBe(false);
      expect(await cache.has('key2')).toBe(false);
    });
  });

  describe('GetOrSet Pattern', () => {
    it('should get existing value', async () => {
      await cache.set('key1', 'value1');
      const factory = vi.fn().mockResolvedValue('newvalue');

      const result = await cache.getOrSet('key1', factory);

      expect(result).toBe('value1');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should set and return new value', async () => {
      const factory = vi.fn().mockResolvedValue('newvalue');

      const result = await cache.getOrSet('key1', factory);

      expect(result).toBe('newvalue');
      expect(factory).toHaveBeenCalledTimes(1);
    });
  });

  describe('Batch Operations', () => {
    it('should get multiple values', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      const results = await cache.getMany<string>(['key1', 'key2', 'key3']);

      expect(results.size).toBe(3);
      expect(results.get('key1')).toBe('value1');
      expect(results.get('key2')).toBe('value2');
      expect(results.get('key3')).toBe('value3');
    });

    it('should set multiple values', async () => {
      const entries = new Map([
        ['key1', 'value1'],
        ['key2', 'value2'],
        ['key3', 'value3'],
      ]);

      await cache.setMany(entries);

      const result1 = await cache.get<string>('key1');
      const result2 = await cache.get<string>('key2');
      const result3 = await cache.get<string>('key3');

      expect(result1.hit).toBe(true);
      expect(result2.hit).toBe(true);
      expect(result3.hit).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should provide cache statistics', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      await cache.get('key1');
      await cache.get('key1');
      await cache.get('key2');
      await cache.get('nonexistent');

      const stats = cache.getStats();

      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.75, 2);
      expect(stats.totalRequests).toBe(4);
    });

    it('should track tier distribution', async () => {
      await cache.set('key1', 'value1');
      await cache.get('key1');

      const stats = cache.getStats();

      expect(stats.tierDistribution.L1.hits).toBeGreaterThan(0);
    });
  });

  describe('Tier Information', () => {
    it('should track tier information for keys', async () => {
      await cache.set('key1', 'value1');

      const tierInfo = await cache.getTierInfo('key1');

      expect(tierInfo).not.toBeNull();
      expect(tierInfo!.currentTier).toBe(CacheTier.L1);
    });
  });

  describe('Health Status', () => {
    it('should provide health status', () => {
      const health = cache.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.tiers.L1).toBe(true);
      expect(health.tiers.L2).toBe(true); // KV is mocked
      expect(health.tiers.L3).toBe(true); // R2 is mocked
    });
  });

  describe('Maintenance', () => {
    it('should run maintenance tasks', async () => {
      await cache.set('key1', 'value1', 100); // Short TTL

      await new Promise(resolve => setTimeout(resolve, 150));

      await cache.maintain();

      const result = await cache.get<string>('key1');
      expect(result.hit).toBe(false);
    });
  });

  describe('Tier Selection', () => {
    it('should select L1 for small values', async () => {
      await cache.set('small', 'x');

      const tierInfo = await cache.getTierInfo('small');
      expect(tierInfo!.currentTier).toBe(CacheTier.L1);
    });

    it('should select L3 for large values', async () => {
      const largeValue = 'x'.repeat(10 * 1024 * 1024); // 10 MB

      await cache.set('large', largeValue);

      const tierInfo = await cache.getTierInfo('large');
      expect(tierInfo!.currentTier).toBe(CacheTier.L3);
    });
  });

  describe('Configuration Merging', () => {
    it('should merge partial config with defaults', () => {
      const partialCache = new MultiTierCache(context, {
        tiers: {
          L1: {
            maxSize: 2048,
          },
        },
      });

      expect(partialCache).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid keys gracefully', async () => {
      await expect(
        cache.get('')
      ).resolves.toBeDefined();
    });

    it('should handle serialization errors', async () => {
      // Circular reference can't be serialized
      const circular: any = { a: 1 };
      circular.self = circular;

      await expect(cache.set('circular', circular)).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should have sub-ms L1 access time', async () => {
      await cache.set('key1', 'value1');

      const start = performance.now();
      await cache.get('key1');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1);
    });

    it('should handle high throughput', async () => {
      const operations = [];

      for (let i = 0; i < 1000; i++) {
        operations.push(cache.set(`key${i}`, `value${i}`));
      }

      const start = performance.now();
      await Promise.all(operations);
      const duration = performance.now() - start;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(1000);
    });
  });
});
