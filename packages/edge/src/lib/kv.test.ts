/**
 * Unit Tests - KV Cache
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KVCache } from './kv';
import { MockKVNamespace } from '../../tests/utils';

describe('KVCache', () => {
  let kv: MockKVNamespace;
  let cache: KVCache;

  beforeEach(() => {
    kv = new MockKVNamespace();
    cache = new KVCache(kv as any, {
      defaultTTL: 3600,
      compression: false,
      retry: false,
    });
  });

  describe('get', () => {
    it('should return null for non-existent key', async () => {
      const result = await cache.get('non-existent');

      expect(result).toBeNull();
    });

    it('should get typed value', async () => {
      await kv.put('test-key', JSON.stringify({ value: 'test' }));

      const result = await cache.get<{ value: string }>('test-key');

      expect(result).toEqual({ value: 'test' });
    });

    it('should parse JSON correctly', async () => {
      const data = { string: 'test', number: 42, boolean: true, array: [1, 2, 3] };
      await kv.put('complex', JSON.stringify(data));

      const result = await cache.get<typeof data>('complex');

      expect(result).toEqual(data);
    });

    it('should return null on error', async () => {
      // Mock a failing KV
      vi.spyOn(kv, 'get').mockRejectedValue(new Error('KV error'));

      const result = await cache.get('failing-key');

      expect(result).toBeNull();
    });
  });

  describe('getWithMetadata', () => {
    it('should get value with metadata', async () => {
      await kv.put('test-key', JSON.stringify({ data: 'test' }));

      const result = await cache.getWithMetadata<{ data: string }>('test-key');

      expect(result).toEqual({
        value: { data: 'test' },
        metadata: expect.any(Object),
      });
    });

    it('should return null value for non-existent key', async () => {
      const result = await cache.getWithMetadata('non-existent');

      expect(result).toEqual({
        value: null,
        metadata: expect.any(Object),
      });
    });
  });

  describe('set', () => {
    it('should set value with default TTL', async () => {
      await cache.set('test-key', { value: 'test' });

      const result = await kv.get('test-key');
      expect(result).toBe(JSON.stringify({ value: 'test' }));
    });

    it('should set value with custom TTL', async () => {
      await cache.set('test-key', { value: 'test' }, 7200);

      const result = await kv.get('test-key');
      expect(result).toBeDefined();
    });

    it('should stringify objects', async () => {
      const data = { nested: { value: 42 } };
      await cache.set('object-key', data);

      const result = await cache.get<typeof data>('object-key');
      expect(result).toEqual(data);
    });

    it('should handle arrays', async () => {
      const array = [1, 2, 3, 4, 5];
      await cache.set('array-key', array);

      const result = await cache.get<number[]>('array-key');
      expect(result).toEqual(array);
    });
  });

  describe('delete', () => {
    it('should delete existing key', async () => {
      await kv.put('test-key', 'value');
      expect(await kv.get('test-key')).toBe('value');

      const deleted = await cache.delete('test-key');
      expect(deleted).toBe(true);
      expect(await kv.get('test-key')).toBeNull();
    });

    it('should return false for non-existent key', async () => {
      const deleted = await cache.delete('non-existent');

      expect(deleted).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      vi.spyOn(kv, 'delete').mockRejectedValue(new Error('Delete failed'));

      const deleted = await cache.delete('test-key');
      expect(deleted).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      await kv.put('test-key', 'value');

      const exists = await cache.exists('test-key');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      const exists = await cache.exists('non-existent');
      expect(exists).toBe(false);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await kv.put('user:1', 'data1');
      await kv.put('user:2', 'data2');
      await kv.put('session:1', 'data3');
    });

    it('should list all keys', async () => {
      const keys = await cache.list('');

      expect(keys).toHaveLength(3);
      expect(keys).toContain('user:1');
      expect(keys).toContain('user:2');
      expect(keys).toContain('session:1');
    });

    it('should list keys by prefix', async () => {
      const keys = await cache.list('user:');

      expect(keys).toHaveLength(2);
      expect(keys).toContain('user:1');
      expect(keys).toContain('user:2');
      expect(keys).not.toContain('session:1');
    });

    it('should respect limit', async () => {
      const keys = await cache.list('', 2);

      expect(keys.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getMultiple', () => {
    beforeEach(async () => {
      await kv.put('key1', JSON.stringify({ value: 1 }));
      await kv.put('key2', JSON.stringify({ value: 2 }));
      await kv.put('key3', JSON.stringify({ value: 3 }));
    });

    it('should get multiple values', async () => {
      const results = await cache.getMultiple<{ value: number }>(['key1', 'key2', 'key3']);

      expect(results.size).toBe(3);
      expect(results.get('key1')).toEqual({ value: 1 });
      expect(results.get('key2')).toEqual({ value: 2 });
      expect(results.get('key3')).toEqual({ value: 3 });
    });

    it('should return empty map for no keys', async () => {
      const results = await cache.getMultiple([]);

      expect(results.size).toBe(0);
    });

    it('should skip non-existent keys', async () => {
      const results = await cache.getMultiple<{ value: number }>(['key1', 'non-existent', 'key2']);

      expect(results.size).toBe(2);
      expect(results.get('key1')).toEqual({ value: 1 });
      expect(results.get('non-existent')).toBeUndefined();
      expect(results.get('key2')).toEqual({ value: 2 });
    });
  });

  describe('setMultiple', () => {
    it('should set multiple values', async () => {
      const entries = new Map([
        ['key1', { value: 1 }],
        ['key2', { value: 2 }],
        ['key3', { value: 3 }],
      ]);

      await cache.setMultiple(entries);

      expect(await cache.get('key1')).toEqual({ value: 1 });
      expect(await cache.get('key2')).toEqual({ value: 2 });
      expect(await cache.get('key3')).toEqual({ value: 3 });
    });
  });

  describe('user preferences', () => {
    it('should set user preferences', async () => {
      const preferences = { theme: 'dark', language: 'en' };

      await cache.setUserPreferences('user-123', preferences);

      const result = await cache.getUserPreferences('user-123');
      expect(result).toEqual(preferences);
    });

    it('should get user preferences', async () => {
      const preferences = { theme: 'light', language: 'fr' };
      await cache.setUserPreferences('user-456', preferences);

      const result = await cache.getUserPreferences('user-456');

      expect(result).toEqual(preferences);
    });

    it('should return null for non-existent user preferences', async () => {
      const result = await cache.getUserPreferences('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('embeddings', () => {
    it('should set and get embedding', async () => {
      const embedding = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);

      await cache.setEmbedding('test-embedding', embedding);

      const result = await cache.getEmbedding('test-embedding');

      expect(result).toBeInstanceOf(Float32Array);
      expect(result?.length).toBe(5);
      // Quantization/dequantization may cause small floating point differences
      expect(result![0]).toBeCloseTo(0.1, 1);
      expect(result![1]).toBeCloseTo(0.2, 1);
    });

    it('should return null for non-existent embedding', async () => {
      const result = await cache.getEmbedding('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('LLM response caching', () => {
    it('should cache LLM response', async () => {
      const promptHash = 'hash-123';
      const response = 'This is a cached response';
      const metadata = {
        model: 'claude-3-opus',
        tokens: 100,
        cost: 0.01,
        latency: 50,
      };

      await cache.cacheLLMResponse(promptHash, response, metadata);

      const result = await cache.getCachedLLMResponse(promptHash);

      expect(result).toEqual({
        response,
        metadata,
        timestamp: expect.any(Number),
      });
    });

    it('should return null for cache miss', async () => {
      const result = await cache.getCachedLLMResponse('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('stats', () => {
    it('should get cache statistics', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      const stats = await cache.getStats();

      expect(stats.keyCount).toBeGreaterThan(0);
      expect(stats.avgLatency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('retry functionality', () => {
    it('should retry failed operations', async () => {
      const retryCache = new KVCache(kv as any, {
        retry: true,
      });

      let attempts = 0;
      vi.spyOn(kv, 'get').mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return JSON.stringify({ success: true });
      });

      const result = await retryCache.get('test-key');

      expect(result).toEqual({ success: true });
      expect(attempts).toBe(3);
    });

    it('should give up after max retries', async () => {
      const retryCache = new KVCache(kv as any, {
        retry: true,
      });

      vi.spyOn(kv, 'get').mockRejectedValue(new Error('Permanent failure'));

      const result = await retryCache.get('test-key');

      expect(result).toBeNull();
    });
  });
});
