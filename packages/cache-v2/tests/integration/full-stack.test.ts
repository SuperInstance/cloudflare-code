/**
 * Integration tests for the complete cache system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCacheSystem } from '../../src/index';
import { CacheTier, CacheContext } from '../../src/types';

describe('Cache System Integration', () => {
  let context: CacheContext;
  let cacheSystem: any;

  beforeEach(() => {
    context = {
      env: {
        CACHE_KV: {
          get: vi.fn(),
          put: vi.fn(),
          delete: vi.fn(),
          list: vi.fn(),
        } as any,
        CACHE_R2: {
          get: vi.fn(),
          put: vi.fn(),
          delete: vi.fn(),
          list: vi.fn(),
          head: vi.fn(),
        } as any,
      },
      requestId: 'test-request-1',
      userId: 'user-123',
    };

    cacheSystem = createCacheSystem(context, {
      tiers: {
        L1: {
          tier: CacheTier.L1,
          maxSize: 1024 * 1024,
          maxEntries: 100,
          ttl: 60000,
          compressionEnabled: false,
          priority: 1,
        },
        L2: {
          tier: CacheTier.L2,
          maxSize: 10 * 1024 * 1024,
          maxEntries: 1000,
          ttl: 300000,
          compressionEnabled: false,
          priority: 2,
        },
        L3: {
          tier: CacheTier.L3,
          maxSize: 100 * 1024 * 1024,
          maxEntries: 10000,
          ttl: 3600000,
          compressionEnabled: false,
          priority: 3,
        },
      },
      warming: {
        type: 'predictive',
        config: {
          enabled: true,
          concurrency: 5,
          batchSize: 10,
          maxEntries: 100,
          priority: 'medium',
          sourceTier: CacheTier.L3,
        },
      },
      invalidation: {
        type: 'ttl',
        config: {
          propagateToAllTiers: true,
          backgroundProcessing: true,
          batchSize: 50,
          retries: 2,
          retryDelay: 500,
        },
      },
      prefetch: {
        enabled: true,
        maxConcurrent: 3,
        maxBytes: 10 * 1024 * 1024,
        threshold: 0.7,
        strategy: 'hybrid',
        learningEnabled: true,
      },
      compression: {
        algorithm: 'gzip',
        threshold: 1024,
        level: 6,
        enabled: false,
      },
      analytics: {
        enabled: true,
        retentionDays: 7,
        sampleRate: 1.0,
      },
      metrics: {
        enabled: true,
        exportInterval: 60000,
      },
    });
  });

  describe('System Initialization', () => {
    it('should initialize all components', () => {
      expect(cacheSystem.cache).toBeDefined();
      expect(cacheSystem.warmer).toBeDefined();
      expect(cacheSystem.invalidation).toBeDefined();
      expect(cacheSystem.prefetcher).toBeDefined();
      expect(cacheSystem.analytics).toBeDefined();
    });
  });

  describe('End-to-End Operations', () => {
    it('should complete full read-write cycle', async () => {
      // Write
      await cacheSystem.set('test-key', { data: 'test-value' });

      // Read
      const result = await cacheSystem.get('test-key');

      expect(result.hit).toBe(true);
      expect(result.value).toEqual({ data: 'test-value' });
    });

    it('should handle cache misses with factory', async () => {
      const factory = vi.fn().mockResolvedValue({ data: 'factory-value' });

      const result = await cacheSystem.cache.getOrSet('new-key', factory);

      expect(result).toEqual({ data: 'factory-value' });
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it('should handle updates', async () => {
      await cacheSystem.set('key1', { version: 1 });
      let result = await cacheSystem.get('key1');

      expect(result.value).toEqual({ version: 1 });

      await cacheSystem.set('key1', { version: 2 });
      result = await cacheSystem.get('key1');

      expect(result.value).toEqual({ version: 2 });
    });

    it('should handle deletes', async () => {
      await cacheSystem.set('key1', 'value1');
      await cacheSystem.delete('key1');

      const result = await cacheSystem.get('key1');

      expect(result.hit).toBe(false);
    });
  });

  describe('Tag-based Invalidation', () => {
    it('should support tags on set', async () => {
      await cacheSystem.set('key1', 'value1', { tags: ['user', 'profile'] });

      // Tags should be registered
      const stats = cacheSystem.invalidation.getStats();
      expect(stats.tagIndex.totalKeys).toBeGreaterThan(0);
    });

    it('should invalidate by tag', async () => {
      await cacheSystem.set('key1', 'value1', { tags: ['tag1'] });
      await cacheSystem.set('key2', 'value2', { tags: ['tag1'] });
      await cacheSystem.set('key3', 'value3', { tags: ['tag2'] });

      const result = await cacheSystem.invalidation.invalidateByTag('tag1');

      expect(result.success).toBe(true);
      expect(result.invalidatedKeys).toContain('key1');
      expect(result.invalidatedKeys).toContain('key2');
      expect(result.invalidatedKeys).not.toContain('key3');
    });
  });

  describe('TTL Management', () => {
    it('should set custom TTL', async () => {
      await cacheSystem.set('key1', 'value1', { ttl: 1000 });

      const result = await cacheSystem.get('key1');
      expect(result.hit).toBe(true);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      const expired = await cacheSystem.get('key1');
      expect(expired.hit).toBe(false);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track cache statistics', async () => {
      await cacheSystem.set('key1', 'value1');
      await cacheSystem.set('key2', 'value2');
      await cacheSystem.set('key3', 'value3');

      await cacheSystem.get('key1');
      await cacheSystem.get('key2');
      await cacheSystem.get('key1');
      await cacheSystem.get('nonexistent');

      const stats = cacheSystem.getStats();

      expect(stats.totalRequests).toBe(4);
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.75, 2);
    });

    it('should provide health status', () => {
      const health = cacheSystem.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.tiers.L1).toBe(true);
    });
  });

  describe('Analytics', () => {
    it('should record access patterns', async () => {
      await cacheSystem.set('key1', 'value1');

      for (let i = 0; i < 10; i++) {
        await cacheSystem.get('key1');
      }

      const patterns = cacheSystem.analytics.getAllAccessPatterns();

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns[0].key).toBe('key1');
    });

    it('should identify hot keys', async () => {
      await cacheSystem.set('hot-key', 'value');

      for (let i = 0; i < 20; i++) {
        await cacheSystem.get('hot-key');
      }

      const hotKeys = cacheSystem.analytics.getHotKeys(10);

      expect(hotKeys.length).toBeGreaterThan(0);
      expect(hotKeys[0].key).toBe('hot-key');
    });
  });

  describe('Maintenance', () => {
    it('should run maintenance tasks', async () => {
      await cacheSystem.set('key1', 'value1', { ttl: 100 });

      await new Promise(resolve => setTimeout(resolve, 150));

      await cacheSystem.maintain();

      const result = await cacheSystem.get('key1');
      expect(result.hit).toBe(false);
    });
  });

  describe('Prefetching', () => {
    it('should record accesses for prefetching', async () => {
      await cacheSystem.set('key1', 'value1');
      await cacheSystem.set('key2', 'value2');

      await cacheSystem.get('key1', 'user-123');

      const stats = cacheSystem.prefetcher.getStats();

      expect(stats.patternsTracked).toBeGreaterThan(0);
    });

    it('should generate prefetch predictions', async () => {
      await cacheSystem.set('key1', 'value1');
      await cacheSystem.set('key2', 'value2');

      // Create access pattern
      for (let i = 0; i < 5; i++) {
        await cacheSystem.get('key1');
        await cacheSystem.get('key2');
      }

      const predictions = await cacheSystem.prefetcher.predict('key1', 'user-123');

      expect(Array.isArray(predictions)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle set errors gracefully', async () => {
      // Try to set a circular reference
      const circular: any = { a: 1 };
      circular.self = circular;

      await expect(cacheSystem.set('circular', circular)).rejects.toThrow();
    });

    it('should handle get errors gracefully', async () => {
      const result = await cacheSystem.get('nonexistent');

      expect(result.hit).toBe(false);
      expect(result.value).toBeNull();
    });
  });

  describe('Performance', () => {
    it('should maintain high hit rate', async () => {
      // Set up cache
      for (let i = 0; i < 100; i++) {
        await cacheSystem.set(`key${i}`, `value${i}`);
      }

      // Access same keys repeatedly
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 100; j++) {
          await cacheSystem.get(`key${j}`);
        }
      }

      const stats = cacheSystem.getStats();

      // Hit rate should be very high
      expect(stats.hitRate).toBeGreaterThan(0.95);
    });

    it('should handle high throughput', async () => {
      const operations = [];

      for (let i = 0; i < 1000; i++) {
        operations.push(cacheSystem.set(`key${i}`, `value${i}`));
      }

      const start = performance.now();
      await Promise.all(operations);
      const duration = performance.now() - start;

      // Should complete 1000 sets in reasonable time
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Multi-User Scenarios', () => {
    it('should handle multiple users independently', async () => {
      await cacheSystem.set('user1-data', { user: 'user1' });
      await cacheSystem.set('user2-data', { user: 'user2' });

      const result1 = await cacheSystem.get('user1-data', 'user1');
      const result2 = await cacheSystem.get('user2-data', 'user2');

      expect(result1.value?.user).toBe('user1');
      expect(result2.value?.user).toBe('user2');
    });
  });

  describe('Cache Warmer', () => {
    it('should record accesses for warming', async () => {
      await cacheSystem.set('key1', 'value1');
      await cacheSystem.get('key1');

      const stats = cacheSystem.warmer.getStats();

      expect(stats.patternsTracked).toBeGreaterThan(0);
    });

    it('should generate warmup recommendations', async () => {
      await cacheSystem.set('hot-key', 'value');

      for (let i = 0; i < 20; i++) {
        await cacheSystem.get('hot-key');
      }

      const recommendations = cacheSystem.warmer.getRecommendations(10);

      expect(recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('Cleanup', () => {
    it('should clear all data', async () => {
      await cacheSystem.set('key1', 'value1');
      await cacheSystem.set('key2', 'value2');

      await cacheSystem.cache.clear();

      const result1 = await cacheSystem.get('key1');
      const result2 = await cacheSystem.get('key2');

      expect(result1.hit).toBe(false);
      expect(result2.hit).toBe(false);
    });
  });
});
