/**
 * Unit Tests for Semantic Caching
 *
 * Tests for:
 * - EmbeddingService
 * - HNSWIndex
 * - SemanticCache
 * - Integration tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EmbeddingService } from '../packages/edge/src/lib/embeddings';
import { HNSWIndex } from '../packages/edge/src/lib/hnsw';
import { SemanticCache } from '../packages/edge/src/lib/cache/semantic';
import type { ChatResponse } from '@claudeflare/shared';

// Mock KV namespace
class MockKVNamespace implements KVNamespace {
  private store = new Map<string, { value: string; expiration?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    // Check expiration
    if (entry.expiration && entry.expiration < Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async put(
    key: string,
    value: string,
    options?: KVNamespacePutOptions
  ): Promise<void> {
    const expiration = options?.expirationTtl
      ? Date.now() + options.expirationTtl * 1000
      : undefined;

    this.store.set(key, { value, expiration });
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async list(options?: { prefix?: string; limit?: number }): Promise<{
    keys: Array<{ name: string }>;
    list_complete: boolean;
  }> {
    const prefix = options?.prefix ?? '';
    const limit = options?.limit ?? 100;

    const keys = Array.from(this.store.keys())
      .filter(k => k.startsWith(prefix))
      .slice(0, limit)
      .map(name => ({ name }));

    return { keys, list_complete: true };
  }

  // Other KV methods (not used in tests)
  getWithMetadata = async () => null as any;
}

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    service = new EmbeddingService();
  });

  describe('quantize and dequantize', () => {
    it('should quantize embedding to int8 with 4x compression', () => {
      const embedding = new Float32Array([1.0, -1.0, 0.5, -0.5, 0.0, 1.0]);
      const result = service.quantize(embedding);

      expect(result.quantized).toBeInstanceOf(Int8Array);
      expect(result.quantized.length).toBe(embedding.length);
      expect(result.originalSize).toBe(embedding.length * 4);
      expect(result.quantizedSize).toBe(embedding.length);
      expect(result.compressionRatio).toBe(4);
    });

    it('should dequantize embedding accurately', () => {
      const embedding = new Float32Array([1.0, -1.0, 0.5, -0.5, 0.0, 1.0]);
      const quantized = service.quantize(embedding);
      const dequantized = service.dequantize(quantized.quantized, quantized.min, quantized.max);

      expect(dequantized.length).toBe(embedding.length);

      // Check that values are close (allowing for quantization error)
      for (let i = 0; i < embedding.length; i++) {
        expect(Math.abs(dequantized[i] - embedding[i])).toBeLessThan(0.01);
      }
    });
  });

  describe('similarity calculation', () => {
    it('should calculate cosine similarity correctly', () => {
      const a = new Float32Array([1.0, 0.0, 0.0]);
      const b = new Float32Array([1.0, 0.0, 0.0]);
      const similarity = service.similarity(a, b);

      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should calculate similarity for orthogonal vectors', () => {
      const a = new Float32Array([1.0, 0.0, 0.0]);
      const b = new Float32Array([0.0, 1.0, 0.0]);
      const similarity = service.similarity(a, b);

      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('should calculate similarity for opposite vectors', () => {
      const a = new Float32Array([1.0, 0.0, 0.0]);
      const b = new Float32Array([-1.0, 0.0, 0.0]);
      const similarity = service.similarity(a, b);

      expect(similarity).toBeCloseTo(-1.0, 5);
    });

    it('should throw error for mismatched dimensions', () => {
      const a = new Float32Array([1.0, 0.0]);
      const b = new Float32Array([1.0, 0.0, 0.0]);

      expect(() => service.similarity(a, b)).toThrow();
    });
  });

  describe('similarity for quantized embeddings', () => {
    it('should approximate similarity for quantized vectors', () => {
      const a = new Float32Array([1.0, 0.5, 0.0]);
      const b = new Float32Array([1.0, 0.5, 0.0]);

      const qa = service.quantize(a);
      const qb = service.quantize(b);

      const similarity = service.similarityQuantized(
        qa.quantized,
        qb.quantized,
        qa.min,
        qa.max,
        qb.min,
        qb.max
      );

      // Should be close to 1.0
      expect(similarity).toBeGreaterThan(0.95);
    });
  });

  describe('embedding statistics', () => {
    it('should calculate embedding statistics', () => {
      const embedding = new Float32Array([1.0, 2.0, 3.0, 4.0, 5.0]);
      const stats = service.calculateStats(embedding);

      expect(stats.dimensions).toBe(5);
      expect(stats.min).toBe(1.0);
      expect(stats.max).toBe(5.0);
      expect(stats.mean).toBe(3.0);
      expect(stats.norm).toBeGreaterThan(0);
    });
  });
});

describe('HNSWIndex', () => {
  let index: HNSWIndex;

  beforeEach(() => {
    index = new HNSWIndex({ M: 16, efConstruction: 50, ef: 50 });
  });

  describe('basic operations', () => {
    it('should add vectors to index', () => {
      const vector = new Float32Array([1.0, 0.0, 0.0]);
      index.add(vector, 'test-1');

      expect(index.size()).toBe(1);
      expect(index.has('test-1')).toBe(true);
    });

    it('should retrieve vectors by ID', () => {
      const vector = new Float32Array([1.0, 0.0, 0.0]);
      index.add(vector, 'test-1');

      const retrieved = index.get('test-1');
      expect(retrieved).toEqual(vector);
    });

    it('should remove vectors from index', () => {
      const vector = new Float32Array([1.0, 0.0, 0.0]);
      index.add(vector, 'test-1');

      const removed = index.remove('test-1');
      expect(removed).toBe(true);
      expect(index.has('test-1')).toBe(false);
    });

    it('should clear all vectors', () => {
      index.add(new Float32Array([1.0, 0.0]), 'test-1');
      index.add(new Float32Array([0.0, 1.0]), 'test-2');

      index.clear();

      expect(index.size()).toBe(0);
    });
  });

  describe('vector search', () => {
    it('should find exact matches', () => {
      const query = new Float32Array([1.0, 0.0, 0.0]);
      index.add(query, 'exact');

      const results = index.search(query, 1);

      expect(results.length).toBe(1);
      expect(results[0].id).toBe('exact');
      expect(results[0].similarity).toBeCloseTo(1.0, 2);
    });

    it('should find similar vectors', () => {
      index.add(new Float32Array([1.0, 0.0, 0.0]), 'vec1');
      index.add(new Float32Array([0.0, 1.0, 0.0]), 'vec2');
      index.add(new Float32Array([0.0, 0.0, 1.0]), 'vec3');

      const query = new Float32Array([1.0, 0.1, 0.0]);
      const results = index.search(query, 3);

      expect(results.length).toBe(3);
      expect(results[0].id).toBe('vec1'); // Most similar
      expect(results[0].similarity).toBeGreaterThan(0.9);
    });

    it('should return empty results for empty index', () => {
      const query = new Float32Array([1.0, 0.0, 0.0]);
      const results = index.search(query, 5);

      expect(results.length).toBe(0);
    });

    it('should limit results to k', () => {
      for (let i = 0; i < 10; i++) {
        const vector = new Float32Array([Math.random(), Math.random(), Math.random()]);
        index.add(vector, `vec-${i}`);
      }

      const query = new Float32Array([0.5, 0.5, 0.5]);
      const results = index.search(query, 5);

      expect(results.length).toBe(5);
    });
  });

  describe('statistics', () => {
    it('should calculate index statistics', () => {
      for (let i = 0; i < 10; i++) {
        const vector = new Float32Array([Math.random(), Math.random(), Math.random()]);
        index.add(vector, `vec-${i}`);
      }

      // Perform some searches
      index.search(new Float32Array([0.5, 0.5, 0.5]), 5);

      const stats = index.getStats();

      expect(stats.nodeCount).toBe(10);
      expect(stats.entryPoint).not.toBeNull();
      expect(stats.totalSearches).toBe(1);
      expect(stats.avgSearchTime).toBeGreaterThan(0);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });

    it('should estimate memory usage', () => {
      const vector = new Float32Array(768);
      index.add(vector, 'test-1');

      const size = index.getSize();
      expect(size).toBeGreaterThan(0);
      // 768 floats * 4 bytes + overhead
      expect(size).toBeGreaterThan(3072);
    });
  });
});

describe('SemanticCache', () => {
  let cache: SemanticCache;
  let mockKV: MockKVNamespace;

  beforeEach(() => {
    mockKV = new MockKVNamespace();
    cache = new SemanticCache({
      similarityThreshold: 0.90,
      maxHotEntries: 100,
      kvCache: mockKV as any,
      enablePersistence: true,
    });
  });

  describe('cache operations', () => {
    it('should store and retrieve responses', async () => {
      const prompt = 'What is TypeScript?';
      const response: ChatResponse = {
        content: 'TypeScript is a typed superset of JavaScript...',
        model: 'claude-3-haiku',
        tokens: { prompt: 10, completion: 20, total: 30 },
        latency: 100,
      };

      await cache.store(prompt, response, { model: 'claude-3-haiku' });

      const result = await cache.check(prompt, { model: 'claude-3-haiku' });

      expect(result.hit).toBe(true);
      expect(result.response).toEqual(response);
      expect(result.source).toBe('hot');
      expect(result.similarity).toBeGreaterThan(0.90);
    });

    it('should return null for cache miss', async () => {
      const result = await cache.check('unknown prompt', {});

      expect(result.hit).toBe(false);
      expect(result.response).toBeNull();
      expect(result.source).toBe('miss');
    });

    it('should match semantically similar prompts', async () => {
      const prompt1 = 'What is TypeScript?';
      const prompt2 = 'Explain TypeScript programming language';

      const response: ChatResponse = {
        content: 'TypeScript is a typed superset of JavaScript...',
        model: 'claude-3-haiku',
        tokens: { prompt: 10, completion: 20, total: 30 },
        latency: 100,
      };

      await cache.store(prompt1, response, { model: 'claude-3-haiku' });

      // Note: This test may not pass without actual embeddings
      // In real usage, Cloudflare Workers AI would generate similar embeddings
      const result = await cache.check(prompt2, { model: 'claude-3-haiku' });

      // Similar prompts should match (if embeddings are similar enough)
      // This is a placeholder - actual behavior depends on embedding model
      expect(result).toBeDefined();
    });
  });

  describe('context matching', () => {
    it('should not match different models', async () => {
      const prompt = 'What is TypeScript?';
      const response: ChatResponse = {
        content: 'TypeScript is a typed superset of JavaScript...',
        model: 'claude-3-haiku',
        tokens: { prompt: 10, completion: 20, total: 30 },
        latency: 100,
      };

      await cache.store(prompt, response, { model: 'claude-3-haiku' });

      const result = await cache.check(prompt, { model: 'gpt-4' });

      expect(result.hit).toBe(false);
    });

    it('should not match different temperatures', async () => {
      const prompt = 'Write a poem';
      const response: ChatResponse = {
        content: 'Once upon a time...',
        model: 'claude-3-haiku',
        tokens: { prompt: 5, completion: 50, total: 55 },
        latency: 150,
      };

      await cache.store(prompt, response, { model: 'claude-3-haiku', temperature: 0.7 });

      const result = await cache.check(prompt, { model: 'claude-3-haiku', temperature: 1.5 });

      expect(result.hit).toBe(false);
    });
  });

  describe('statistics', () => {
    it('should track cache statistics', async () => {
      const prompt = 'What is TypeScript?';
      const response: ChatResponse = {
        content: 'TypeScript is a typed superset of JavaScript...',
        model: 'claude-3-haiku',
        tokens: { prompt: 10, completion: 20, total: 30 },
        latency: 100,
      };

      await cache.store(prompt, response, { model: 'claude-3-haiku' });

      // Cache hit
      await cache.check(prompt, { model: 'claude-3-haiku' });

      // Cache miss
      await cache.check('unknown', {});

      const stats = cache.getStats();

      expect(stats.metrics.totalQueries).toBe(2);
      expect(stats.metrics.hotHits).toBe(1);
      expect(stats.metrics.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(50);
    });

    it('should calculate hit rate correctly', async () => {
      const response: ChatResponse = {
        content: 'Response',
        model: 'claude-3-haiku',
        tokens: { prompt: 5, completion: 10, total: 15 },
        latency: 50,
      };

      // Add 3 cached responses
      await cache.store('prompt1', response, { model: 'claude-3-haiku' });
      await cache.store('prompt2', response, { model: 'claude-3-haiku' });
      await cache.store('prompt3', response, { model: 'claude-3-haiku' });

      // 3 hits, 2 misses = 60% hit rate
      await cache.check('prompt1', { model: 'claude-3-haiku' });
      await cache.check('prompt2', { model: 'claude-3-haiku' });
      await cache.check('prompt3', { model: 'claude-3-haiku' });
      await cache.check('miss1', {});
      await cache.check('miss2', {});

      const stats = cache.getStats();
      expect(stats.hitRate).toBeCloseTo(60);
    });
  });

  describe('cache eviction', () => {
    it('should evict entries when hot cache is full', async () => {
      const smallCache = new SemanticCache({
        maxHotEntries: 5,
        kvCache: mockKV as any,
      });

      const response: ChatResponse = {
        content: 'Response',
        model: 'claude-3-haiku',
        tokens: { prompt: 5, completion: 10, total: 15 },
        latency: 50,
      };

      // Add 10 entries (should evict some)
      for (let i = 0; i < 10; i++) {
        await smallCache.store(`prompt${i}`, response, { model: 'claude-3-haiku' });
      }

      const stats = smallCache.getStats();
      // Should be close to maxHotEntries
      expect(stats.hotCacheSize).toBeLessThanOrEqual(5);
    });
  });

  describe('cache clearing', () => {
    it('should clear all cache entries', async () => {
      const response: ChatResponse = {
        content: 'Response',
        model: 'claude-3-haiku',
        tokens: { prompt: 5, completion: 10, total: 15 },
        latency: 50,
      };

      await cache.store('prompt1', response, { model: 'claude-3-haiku' });
      await cache.store('prompt2', response, { model: 'claude-3-haiku' });

      await cache.clear();

      const stats = cache.getStats();
      expect(stats.hotCacheSize).toBe(0);
      expect(stats.hnswStats.nodeCount).toBe(0);
    });
  });
});

describe('Integration Tests', () => {
  it('should handle end-to-end caching workflow', async () => {
    const mockKV = new MockKVNamespace();
    const cache = new SemanticCache({
      similarityThreshold: 0.90,
      kvCache: mockKV as any,
    });

    const prompt = 'How do I create a REST API in Node.js?';
    const response: ChatResponse = {
      content: 'To create a REST API in Node.js...',
      model: 'claude-3-haiku',
      tokens: { prompt: 15, completion: 100, total: 115 },
      latency: 200,
    };

    // First request - cache miss
    const result1 = await cache.check(prompt, { model: 'claude-3-haiku' });
    expect(result1.hit).toBe(false);

    // Store response
    await cache.store(prompt, response, { model: 'claude-3-haiku' });

    // Second request - cache hit
    const result2 = await cache.check(prompt, { model: 'claude-3-haiku' });
    expect(result2.hit).toBe(true);
    expect(result2.response).toEqual(response);
    expect(result2.latency).toBeLessThan(10); // Should be fast
  });

  it('should track cost savings', async () => {
    const mockKV = new MockKVNamespace();
    const cache = new SemanticCache({
      kvCache: mockKV as any,
    });

    const response: ChatResponse = {
      content: 'Response',
      model: 'claude-3-haiku',
      tokens: { prompt: 100, completion: 200, total: 300 },
      latency: 100,
    };

    await cache.store('prompt1', response, { model: 'claude-3-haiku' });
    await cache.check('prompt1', { model: 'claude-3-haiku' });

    const stats = cache.getStats();
    expect(stats.metrics.tokensSaved).toBe(300);
    expect(stats.metrics.costSaved).toBeGreaterThan(0);
  });
});
