/**
 * Unit tests for L1 Cache
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { L1Cache } from '../../src/tiers/l1-tier';
import { CacheTier } from '../../src/types';

describe('L1Cache', () => {
  let cache: L1Cache;

  beforeEach(() => {
    cache = new L1Cache({
      tier: CacheTier.L1,
      maxSize: 1024 * 1024, // 1 MB
      maxEntries: 100,
      ttl: 60000, // 1 minute
      compressionEnabled: false,
      priority: 1,
    });
  });

  describe('Basic Operations', () => {
    it('should store and retrieve values', async () => {
      await cache.set('key1', 'value1');
      const result = await cache.get<string>('key1');

      expect(result).toBe('value1');
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get<string>('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle complex objects', async () => {
      const obj = {
        name: 'test',
        nested: { value: 42 },
        array: [1, 2, 3],
      };

      await cache.set('obj', obj);
      const result = await cache.get<typeof obj>('obj');

      expect(result).toEqual(obj);
    });

    it('should handle arrays', async () => {
      const arr = [1, 2, 3, 4, 5];

      await cache.set('arr', arr);
      const result = await cache.get<number[]>('arr');

      expect(result).toEqual(arr);
    });

    it('should handle numbers', async () => {
      await cache.set('num', 42);
      const result = await cache.get<number>('num');

      expect(result).toBe(42);
    });

    it('should handle booleans', async () => {
      await cache.set('bool', true);
      const result = await cache.get<boolean>('bool');

      expect(result).toBe(true);
    });

    it('should handle null values', async () => {
      await cache.set('null', null);
      const result = await cache.get<null>('null');

      expect(result).toBeNull();
    });
  });

  describe('Expiration', () => {
    it('should expire entries after TTL', async () => {
      await cache.set('key', 'value', 100); // 100ms TTL

      await new Promise(resolve => setTimeout(resolve, 150));

      const result = await cache.get<string>('key');
      expect(result).toBeNull();
    });

    it('should not expire entries before TTL', async () => {
      await cache.set('key', 'value', 1000); // 1s TTL

      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await cache.get<string>('key');
      expect(result).toBe('value');
    });

    it('should support custom TTL per key', async () => {
      await cache.set('key1', 'value1', 100);
      await cache.set('key2', 'value2', 5000);

      await new Promise(resolve => setTimeout(resolve, 150));

      const result1 = await cache.get<string>('key1');
      const result2 = await cache.get<string>('key2');

      expect(result1).toBeNull();
      expect(result2).toBe('value2');
    });
  });

  describe('Delete Operations', () => {
    it('should delete existing keys', async () => {
      await cache.set('key', 'value');
      const deleted = await cache.delete('key');

      expect(deleted).toBe(true);

      const result = await cache.get<string>('key');
      expect(result).toBeNull();
    });

    it('should return false for non-existent keys', async () => {
      const deleted = await cache.delete('nonexistent');

      expect(deleted).toBe(false);
    });
  });

  describe('Has Operations', () => {
    it('should return true for existing keys', async () => {
      await cache.set('key', 'value');
      const exists = await cache.has('key');

      expect(exists).toBe(true);
    });

    it('should return false for non-existent keys', async () => {
      const exists = await cache.has('nonexistent');

      expect(exists).toBe(false);
    });

    it('should return false for expired keys', async () => {
      await cache.set('key', 'value', 100);

      await new Promise(resolve => setTimeout(resolve, 150));

      const exists = await cache.has('key');
      expect(exists).toBe(false);
    });
  });

  describe('Clear Operations', () => {
    it('should clear all entries', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      await cache.clear();

      expect(await cache.has('key1')).toBe(false);
      expect(await cache.has('key2')).toBe(false);
      expect(await cache.has('key3')).toBe(false);
    });
  });

  describe('Size Management', () => {
    it('should track size correctly', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      const size = cache.getSize();

      expect(size.entries).toBe(2);
      expect(size.bytes).toBeGreaterThan(0);
    });

    it('should evict entries when size limit is reached', async () => {
      const smallCache = new L1Cache({
        tier: CacheTier.L1,
        maxSize: 100, // 100 bytes
        maxEntries: 10,
        ttl: 60000,
        compressionEnabled: false,
        priority: 1,
      });

      // Add entries until eviction
      for (let i = 0; i < 20; i++) {
        await smallCache.set(`key${i}`, 'x'.repeat(20)); // 20 bytes each
      }

      const size = smallCache.getSize();
      expect(size.entries).toBeLessThan(20);
      expect(size.bytes).toBeLessThanOrEqual(100);
    });
  });

  describe('Hot and Cold Keys', () => {
    it('should identify hot keys', async () => {
      await cache.set('hot', 'value');

      // Access multiple times
      for (let i = 0; i < 10; i++) {
        await cache.get('hot');
      }

      const hotKeys = cache.getHotKeys(5);

      expect(hotKeys.length).toBeGreaterThan(0);
      expect(hotKeys[0].key).toBe('hot');
      expect(hotKeys[0].frequency).toBeGreaterThan(0);
    });

    it('should identify cold keys', async () => {
      await cache.set('cold', 'value');

      await new Promise(resolve => setTimeout(resolve, 100));

      const coldKeys = cache.getColdKeys(5);

      expect(coldKeys.length).toBeGreaterThan(0);
      expect(coldKeys).toContain('cold');
    });
  });

  describe('Statistics', () => {
    it('should provide statistics', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      await cache.get('key1');
      await cache.get('key1');
      await cache.get('key2');

      const stats = cache.getStats();

      expect(stats.count).toBe(2);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty keys gracefully', async () => {
      await cache.set('', 'value');
      const result = await cache.get<string>('');

      expect(result).toBe('value');
    });

    it('should handle special characters in keys', async () => {
      const specialKey = 'key:with/special-chars_123';
      await cache.set(specialKey, 'value');
      const result = await cache.get<string>(specialKey);

      expect(result).toBe('value');
    });

    it('should handle very large values', async () => {
      const largeValue = 'x'.repeat(10000);
      await cache.set('large', largeValue);
      const result = await cache.get<string>('large');

      expect(result).toBe(largeValue);
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent operations', async () => {
      const operations = [];

      for (let i = 0; i < 100; i++) {
        operations.push(cache.set(`key${i}`, `value${i}`));
      }

      await Promise.all(operations);

      const size = cache.getSize();
      expect(size.entries).toBe(100);
    });
  });
});
