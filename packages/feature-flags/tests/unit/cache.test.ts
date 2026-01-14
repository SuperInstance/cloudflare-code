/**
 * Unit tests for cache layer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FlagCache, MultiLevelCache, CacheKeyGenerator } from '../../src/storage/cache';

describe('FlagCache', () => {
  let cache: FlagCache<string>;

  beforeEach(() => {
    cache = new FlagCache({
      maxSize: 5,
      defaultTTL: 1000,
      strategy: 'lru',
    });
  });

  describe('basic operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should delete values', () => {
      cache.set('key1', 'value1');
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('key2')).toBe(false);
    });

    it('should clear all values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('TTL', () => {
    it('should expire entries after TTL', async () => {
      cache.set('key1', 'value1', 100);
      expect(cache.get('key1')).toBe('value1');

      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should not expire entries before TTL', async () => {
      cache.set('key1', 'value1', 200);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(cache.get('key1')).toBe('value1');
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entry when full', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');
      cache.set('key5', 'value5');

      // Access key1 to make it more recently used
      cache.get('key1');

      // Add new entry, should evict key2 (least recently used)
      cache.set('key6', 'value6');

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBe('value3');
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'value1');

      cache.get('key1'); // hit
      cache.get('key2'); // miss
      cache.get('key1'); // hit
      cache.get('key3'); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should track evictions', () => {
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      const stats = cache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
    });
  });

  describe('utility methods', () => {
    it('should return all keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const keys = cache.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('should return all values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const values = cache.values();
      expect(values).toContain('value1');
      expect(values).toContain('value2');
    });

    it('should return all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const entries = cache.entries();
      expect(entries).toContainEqual(['key1', 'value1']);
      expect(entries).toContainEqual(['key2', 'value2']);
    });

    it('should cleanup expired entries', async () => {
      cache.set('key1', 'value1', 100);
      cache.set('key2', 'value2', 5000);

      await new Promise((resolve) => setTimeout(resolve, 150));

      const cleaned = cache.cleanup();
      expect(cleaned).toBe(1);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
    });
  });
});

describe('MultiLevelCache', () => {
  let cache: MultiLevelCache<string>;

  beforeEach(() => {
    cache = new MultiLevelCache({
      l1: {
        maxSize: 3,
        defaultTTL: 1000,
        strategy: 'lru',
      },
      l2: {
        maxSize: 10,
        defaultTTL: 5000,
        strategy: 'lru',
      },
    });
  });

  it('should store values in both L1 and L2', async () => {
    await cache.set('key1', 'value1');

    const l1Value = cache['l1'].get('key1');
    const l2Value = cache['l2']!.get('key1');

    expect(l1Value).toBe('value1');
    expect(l2Value).toBe('value1');
  });

  it('should check L1 first then L2', async () => {
    await cache.set('key1', 'value1');

    const value = await cache.get('key1');
    expect(value).toBe('value1');
  });

  it('should promote from L2 to L1 on access', async () => {
    // Clear L1
    cache['l1'].clear();

    await cache.set('key1', 'value1');

    const value = await cache.get('key1');
    expect(value).toBe('value1');

    // Should now be in L1
    expect(cache['l1'].get('key1')).toBe('value1');
  });

  it('should delete from both levels', async () => {
    await cache.set('key1', 'value1');
    await cache.delete('key1');

    expect(cache['l1'].get('key1')).toBeUndefined();
    expect(cache['l2']!.get('key1')).toBeUndefined();
  });

  it('should provide stats for both levels', async () => {
    await cache.set('key1', 'value1');
    await cache.get('key1');

    const stats = cache.getStats();
    expect(stats.l1).toBeDefined();
    expect(stats.l2).toBeDefined();
    expect(stats.l1HitRate).toBeGreaterThanOrEqual(0);
    expect(stats.l2HitRate).toBeGreaterThanOrEqual(0);
  });
});

describe('CacheKeyGenerator', () => {
  describe('forFlagEvaluation', () => {
    it('should generate key for simple evaluation', () => {
      const key = CacheKeyGenerator.forFlagEvaluation('flag1', 'user123');
      expect(key).toBe('flag1:user123');
    });

    it('should generate key with attributes', () => {
      const key = CacheKeyGenerator.forFlagEvaluation('flag1', 'user123', {
        country: 'US',
        tier: 'premium',
      });
      expect(key).toContain('flag1:user123');
      expect(key).toContain('country');
    });
  });

  describe('forBatchEvaluation', () => {
    it('should generate key for batch evaluation', () => {
      const key = CacheKeyGenerator.forBatchEvaluation('user123', ['flag1', 'flag2']);
      expect(key).toBe('batch:user123:flag1,flag2');
    });
  });

  describe('forSegmentCheck', () => {
    it('should generate key for segment check', () => {
      const key = CacheKeyGenerator.forSegmentCheck('segment1', 'user123');
      expect(key).toBe('segment:segment1:user123');
    });
  });

  describe('forExperimentAssignment', () => {
    it('should generate key for experiment assignment', () => {
      const key = CacheKeyGenerator.forExperimentAssignment('exp1', 'user123');
      expect(key).toBe('experiment:exp1:user123');
    });
  });
});
