/**
 * Unit Tests for KVCache (WARM Tier)
 *
 * Tests for KV namespace wrapper with caching, compression,
 * and embedding quantization.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KVCache } from '../src/lib/kv';

describe('KVCache', () => {
  let mockKV: KVNamespace;
  let kvCache: KVCache;

  beforeEach(() => {
    // Mock KV namespace
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      getWithMetadata: vi.fn(),
    } as unknown as KVNamespace;

    kvCache = new KVCache(mockKV, {
      defaultTTL: 3600,
      compression: true,
      retry: false,
    });
  });

  describe('Basic Operations', () => {
    it('should get null for non-existent key', async () => {
      vi.mocked(mockKV.get).mockResolvedValue(null);

      const result = await kvCache.get<string>('non-existent');

      expect(result).toBeNull();
      expect(mockKV.get).toHaveBeenCalledWith('non-existent', 'text');
    });

    it('should set and get value', async () => {
      const testData = { message: 'Hello, World!' };

      vi.mocked(mockKV.put).mockResolvedValue(undefined);
      vi.mocked(mockKV.get).mockResolvedValue(JSON.stringify(testData));

      await kvCache.set('test-key', testData);
      const result = await kvCache.get<typeof testData>('test-key');

      expect(result).toEqual(testData);
      expect(mockKV.put).toHaveBeenCalled();
      expect(mockKV.get).toHaveBeenCalledWith('test-key', 'text');
    });

    it('should delete value', async () => {
      vi.mocked(mockKV.delete).mockResolvedValue(undefined);

      const result = await kvCache.delete('test-key');

      expect(result).toBe(true);
      expect(mockKV.delete).toHaveBeenCalledWith('test-key');
    });

    it('should check if key exists', async () => {
      vi.mocked(mockKV.get).mockResolvedValueOnce('data').mockResolvedValueOnce(null);

      const exists1 = await kvCache.exists('existing-key');
      const exists2 = await kvCache.exists('non-existing-key');

      expect(exists1).toBe(true);
      expect(exists2).toBe(false);
    });
  });

  describe('TTL Management', () => {
    it('should use default TTL when not specified', async () => {
      vi.mocked(mockKV.put).mockResolvedValue(undefined);

      await kvCache.set('test-key', { data: 'test' });

      expect(mockKV.put).toHaveBeenCalledWith(
        'test-key',
        expect.any(String),
        expect.objectContaining({
          expirationTtl: 3600,
        })
      );
    });

    it('should use custom TTL when specified', async () => {
      vi.mocked(mockKV.put).mockResolvedValue(undefined);

      await kvCache.set('test-key', { data: 'test' }, 7200);

      expect(mockKV.put).toHaveBeenCalledWith(
        'test-key',
        expect.any(String),
        expect.objectContaining({
          expirationTtl: 7200,
        })
      );
    });
  });

  describe('Embedding Operations', () => {
    it('should quantize and store embedding', async () => {
      vi.mocked(mockKV.put).mockResolvedValue(undefined);

      const embedding = new Float32Array([1.0, -0.5, 0.3, -0.8, 0.9]);
      await kvCache.setEmbedding('test-embedding', embedding);

      expect(mockKV.put).toHaveBeenCalledWith(
        'embedding:test-embedding',
        expect.objectContaining({
          quantized: expect.any(Array),
          dimensions: 5,
          min: expect.any(Number),
          max: expect.any(Number),
        }),
        expect.any(Number)
      );
    });

    it('should retrieve and de-quantize embedding', async () => {
      const embedding = new Float32Array([1.0, -0.5, 0.3, -0.8, 0.9]);
      const quantized = [-32, -96, -77, -109, -30]; // Approximate int8 values

      vi.mocked(mockKV.get).mockResolvedValue(
        JSON.stringify({
          quantized,
          dimensions: 5,
          min: -0.8,
          max: 1.0,
        })
      );

      const result = await kvCache.getEmbedding('test-embedding');

      expect(result).not.toBeNull();
      expect(result?.length).toBe(5);

      // Check that de-quantized values are close to original
      for (let i = 0; i < embedding.length; i++) {
        expect(Math.abs((result![i] ?? 0) - embedding[i])).toBeLessThan(0.1);
      }
    });

    it('should return null for non-existent embedding', async () => {
      vi.mocked(mockKV.get).mockResolvedValue(null);

      const result = await kvCache.getEmbedding('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('User Preferences', () => {
    it('should store user preferences', async () => {
      vi.mocked(mockKV.put).mockResolvedValue(undefined);

      const preferences = {
        userId: 'user-123',
        theme: 'dark' as const,
        language: 'en',
        framework: 'react',
        defaultModel: 'claude-3',
        temperature: 0.7,
        maxTokens: 4096,
        agentConfig: {
          directorEnabled: true,
          plannerEnabled: true,
          executorEnabled: true,
        },
        cacheConfig: {
          enabled: true,
          ttl: 3600,
          maxSize: 1000,
        },
      };

      await kvCache.setUserPreferences('user-123', preferences);

      expect(mockKV.put).toHaveBeenCalledWith(
        'user:user-123:preferences',
        JSON.stringify(preferences),
        expect.objectContaining({
          expirationTtl: 60 * 60 * 24 * 30, // 30 days
        })
      );
    });

    it('should retrieve user preferences', async () => {
      const preferences = {
        userId: 'user-123',
        theme: 'dark' as const,
        language: 'en',
        framework: 'react',
        defaultModel: 'claude-3',
        temperature: 0.7,
        maxTokens: 4096,
        agentConfig: {
          directorEnabled: true,
          plannerEnabled: true,
          executorEnabled: true,
        },
        cacheConfig: {
          enabled: true,
          ttl: 3600,
          maxSize: 1000,
        },
      };

      vi.mocked(mockKV.get).mockResolvedValue(JSON.stringify(preferences));

      const result = await kvCache.getUserPreferences('user-123');

      expect(result).toEqual(preferences);
    });
  });

  describe('LLM Response Caching', () => {
    it('should cache LLM response', async () => {
      vi.mocked(mockKV.put).mockResolvedValue(undefined);

      const promptHash = 'abc123';
      const response = 'This is a cached response';
      const metadata = {
        model: 'claude-3-opus',
        tokens: 100,
        cost: 0.001,
        latency: 1500,
      };

      await kvCache.cacheLLMResponse(promptHash, response, metadata);

      expect(mockKV.put).toHaveBeenCalledWith(
        `cache:${promptHash}`,
        expect.objectContaining({
          response,
          metadata,
          timestamp: expect.any(Number),
        }),
        expect.any(Number)
      );
    });

    it('should retrieve cached LLM response', async () => {
      const cachedData = {
        response: 'This is a cached response',
        metadata: {
          model: 'claude-3-opus',
          tokens: 100,
          cost: 0.001,
          latency: 1500,
        },
        timestamp: Date.now(),
      };

      vi.mocked(mockKV.get).mockResolvedValue(JSON.stringify(cachedData));

      const result = await kvCache.getCachedLLMResponse('test-hash');

      expect(result).toEqual(cachedData);
    });

    it('should return null for cache miss', async () => {
      vi.mocked(mockKV.get).mockResolvedValue(null);

      const result = await kvCache.getCachedLLMResponse('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('List Operations', () => {
    it('should list keys by prefix', async () => {
      const mockList = {
        keys: [
          { name: 'user:123:data' },
          { name: 'user:456:data' },
        ],
        list_complete: true,
      };

      vi.mocked(mockKV.list).mockResolvedValue(mockList);

      const result = await kvCache.list('user:', 10);

      expect(result).toEqual(['user:123:data', 'user:456:data']);
      expect(mockKV.list).toHaveBeenCalledWith(
        { prefix: 'user:', limit: 10 }
      );
    });
  });

  describe('Batch Operations', () => {
    it('should get multiple values', async () => {
      vi.mocked(mockKV.get)
        .mockResolvedValueOnce(JSON.stringify({ key: 'value1' }))
        .mockResolvedValueOnce(JSON.stringify({ key: 'value2' }))
        .mockResolvedValueOnce(null);

      const result = await kvCache.getMultiple(['key1', 'key2', 'key3']);

      expect(result.size).toBe(2);
      expect(result.get('key1')).toEqual({ key: 'value1' });
      expect(result.get('key2')).toEqual({ key: 'value2' });
      expect(result.get('key3')).toBeUndefined();
    });

    it('should set multiple values', async () => {
      vi.mocked(mockKV.put).mockResolvedValue(undefined);

      const entries = new Map([
        ['key1', { value: 1 }],
        ['key2', { value: 2 }],
      ]);

      await kvCache.setMultiple(entries, 3600);

      expect(mockKV.put).toHaveBeenCalledTimes(2);
    });
  });

  describe('Compression', () => {
    it('should compress large values', async () => {
      vi.mocked(mockKV.put).mockResolvedValue(undefined);

      // Create a large string (> 1KB)
      const largeData = { data: 'x'.repeat(2000) };

      await kvCache.set('large-key', largeData);

      const putCall = vi.mocked(mockKV.put).mock.calls[0];
      const storedValue = putCall[1] as string;

      // Compressed value should be smaller than original
      expect(storedValue.length).toBeLessThan(JSON.stringify(largeData).length);
    });
  });

  describe('Error Handling', () => {
    it('should handle get errors gracefully', async () => {
      vi.mocked(mockKV.get).mockRejectedValue(new Error('KV error'));

      const result = await kvCache.get<string>('test-key');

      expect(result).toBeNull();
    });

    it('should handle set errors', async () => {
      vi.mocked(mockKV.put).mockRejectedValue(new Error('KV error'));

      await expect(kvCache.set('test-key', { data: 'test' })).rejects.toThrow();
    });

    it('should retry on failure when retry is enabled', async () => {
      const retryKVCache = new KVCache(mockKV, { retry: true });

      vi.mocked(mockKV.get)
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce('data');

      const result = await retryKVCache.get<string>('test-key');

      expect(result).toBe('data');
      expect(mockKV.get).toHaveBeenCalledTimes(2);
    });
  });
});
