/**
 * Performance Benchmarks for Semantic Caching
 *
 * Measures:
 * - Embedding generation performance
 * - Quantization/dequantization performance
 * - HNSW index search performance
 * - Semantic cache hit rate
 * - Memory usage
 */

import { describe, it } from 'vitest';
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
    if (entry.expiration && entry.expiration < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async put(key: string, value: string, options?: KVNamespacePutOptions): Promise<void> {
    const expiration = options?.expirationTtl
      ? Date.now() + options.expirationTtl * 1000
      : undefined;
    this.store.set(key, { value, expiration });
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async list(): Promise<{ keys: Array<{ name: string }>; list_complete: boolean }> {
    const keys = Array.from(this.store.keys()).map(name => ({ name }));
    return { keys, list_complete: true };
  }

  getWithMetadata = async () => null as any;
}

describe('Performance Benchmarks', () => {
  describe('EmbeddingService', () => {
    it('should quantize embeddings in <5ms', () => {
      const service = new EmbeddingService();
      const embedding = new Float32Array(768).map(() => Math.random() * 2 - 1);

      const start = performance.now();
      const result = service.quantize(embedding);
      const duration = performance.now() - start;

      console.log(`  Quantization: ${duration.toFixed(2)}ms`);
      console.log(`  Compression ratio: ${result.compressionRatio}x`);
      console.log(`  Original size: ${result.originalSize} bytes`);
      console.log(`  Quantized size: ${result.quantizedSize} bytes`);

      expect(duration).toBeLessThan(5);
      expect(result.compressionRatio).toBe(4);
    });

    it('should dequantize embeddings in <5ms', () => {
      const service = new EmbeddingService();
      const embedding = new Float32Array(768).map(() => Math.random() * 2 - 1);
      const quantized = service.quantize(embedding);

      const start = performance.now();
      const dequantized = service.dequantize(quantized.quantized, quantized.min, quantized.max);
      const duration = performance.now() - start;

      console.log(`  Dequantization: ${duration.toFixed(2)}ms`);
      console.log(`  Dimensions: ${dequantized.length}`);

      expect(duration).toBeLessThan(5);
      expect(dequantized.length).toBe(embedding.length);
    });

    it('should calculate similarity in <1ms', () => {
      const service = new EmbeddingService();
      const a = new Float32Array(768).map(() => Math.random() * 2 - 1);
      const b = new Float32Array(768).map(() => Math.random() * 2 - 1);

      const start = performance.now();
      const similarity = service.similarity(a, b);
      const duration = performance.now() - start;

      console.log(`  Similarity calculation: ${duration.toFixed(2)}ms`);
      console.log(`  Similarity score: ${similarity.toFixed(4)}`);

      expect(duration).toBeLessThan(1);
      expect(similarity).toBeGreaterThanOrEqual(-1);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should calculate quantized similarity in <1ms', () => {
      const service = new EmbeddingService();
      const a = new Float32Array(768).map(() => Math.random() * 2 - 1);
      const b = new Float32Array(768).map(() => Math.random() * 2 - 1);

      const qa = service.quantize(a);
      const qb = service.quantize(b);

      const start = performance.now();
      const similarity = service.similarityQuantized(
        qa.quantized,
        qb.quantized,
        qa.min,
        qa.max,
        qb.min,
        qb.max
      );
      const duration = performance.now() - start;

      console.log(`  Quantized similarity: ${duration.toFixed(2)}ms`);
      console.log(`  Similarity score: ${similarity.toFixed(4)}`);

      expect(duration).toBeLessThan(1);
    });
  });

  describe('HNSWIndex', () => {
    it('should add vectors in <1ms', () => {
      const index = new HNSWIndex();

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const vector = new Float32Array(768).map(() => Math.random() * 2 - 1);
        index.add(vector, `vec-${i}`);
      }
      const duration = performance.now() - start;

      const avgTime = duration / 100;

      console.log(`  Total insert time (100 vectors): ${duration.toFixed(2)}ms`);
      console.log(`  Average per insert: ${avgTime.toFixed(2)}ms`);
      console.log(`  Index size: ${index.size()}`);

      expect(avgTime).toBeLessThan(1);
      expect(index.size()).toBe(100);
    });

    it('should search vectors in <1ms for k=10', () => {
      const index = new HNSWIndex();

      // Add 1000 vectors
      for (let i = 0; i < 1000; i++) {
        const vector = new Float32Array(768).map(() => Math.random() * 2 - 1);
        index.add(vector, `vec-${i}`);
      }

      const query = new Float32Array(768).map(() => Math.random() * 2 - 1);

      const start = performance.now();
      const results = index.search(query, 10);
      const duration = performance.now() - start;

      console.log(`  Search time (1000 vectors, k=10): ${duration.toFixed(2)}ms`);
      console.log(`  Results found: ${results.length}`);
      console.log(`  Best similarity: ${results[0]?.similarity.toFixed(4) ?? 'N/A'}`);

      expect(duration).toBeLessThan(1);
      expect(results.length).toBe(10);
    });

    it('should maintain performance with 10K vectors', () => {
      const index = new HNSWIndex();

      console.log('  Adding 10,000 vectors...');
      const addStart = performance.now();
      for (let i = 0; i < 10000; i++) {
        const vector = new Float32Array(768).map(() => Math.random() * 2 - 1);
        index.add(vector, `vec-${i}`);
      }
      const addDuration = performance.now() - addStart;

      const query = new Float32Array(768).map(() => Math.random() * 2 - 1);

      const searchStart = performance.now();
      const results = index.search(query, 10);
      const searchDuration = performance.now() - searchStart;

      console.log(`  Add time (10K vectors): ${addDuration.toFixed(2)}ms`);
      console.log(`  Search time (10K vectors): ${searchDuration.toFixed(2)}ms`);
      console.log(`  Memory usage: ${(index.getSize() / 1024 / 1024).toFixed(2)}MB`);

      expect(searchDuration).toBeLessThan(5);
      expect(results.length).toBe(10);
    });

    it('should calculate accurate statistics', () => {
      const index = new HNSWIndex();

      for (let i = 0; i < 100; i++) {
        const vector = new Float32Array(768).map(() => Math.random() * 2 - 1);
        index.add(vector, `vec-${i}`);
      }

      // Perform searches
      for (let i = 0; i < 10; i++) {
        const query = new Float32Array(768).map(() => Math.random() * 2 - 1);
        index.search(query, 10);
      }

      const stats = index.getStats();

      console.log(`  Node count: ${stats.nodeCount}`);
      console.log(`  Max level: ${stats.maxLevel}`);
      console.log(`  Avg connections: ${stats.avgConnections.toFixed(2)}`);
      console.log(`  Total searches: ${stats.totalSearches}`);
      console.log(`  Avg search time: ${stats.avgSearchTime.toFixed(2)}ms`);
      console.log(`  Memory usage: ${(stats.memoryUsage / 1024).toFixed(2)}KB`);

      expect(stats.nodeCount).toBe(100);
      expect(stats.totalSearches).toBe(10);
      expect(stats.avgSearchTime).toBeGreaterThan(0);
    });
  });

  describe('SemanticCache', () => {
    it('should achieve target cache hit rates', async () => {
      const mockKV = new MockKVNamespace();
      const cache = new SemanticCache({
        similarityThreshold: 0.90,
        kvCache: mockKV as any,
      });

      const testPrompts = [
        'What is TypeScript?',
        'Explain TypeScript',
        'TypeScript tutorial',
        'How do I create a React component?',
        'Create React component',
        'React component example',
      ];

      const response: ChatResponse = {
        content: 'This is a cached response',
        model: 'claude-3-haiku',
        tokens: { prompt: 10, completion: 20, total: 30 },
        latency: 100,
      };

      // Store all prompts
      for (const prompt of testPrompts) {
        await cache.store(prompt, response, { model: 'claude-3-haiku' });
      }

      // Check cache with similar prompts
      let hits = 0;
      for (const prompt of testPrompts) {
        const result = await cache.check(prompt, { model: 'claude-3-haiku' });
        if (result.hit) hits++;
      }

      const hitRate = (hits / testPrompts.length) * 100;

      console.log(`  Cache hit rate: ${hitRate.toFixed(1)}%`);
      console.log(`  Hits: ${hits}/${testPrompts.length}`);

      // Should have at least 50% hit rate for exact matches
      expect(hitRate).toBeGreaterThanOrEqual(50);
    });

    it('should achieve sub-millisecond hot cache latency', async () => {
      const mockKV = new MockKVNamespace();
      const cache = new SemanticCache({
        kvCache: mockKV as any,
      });

      const prompt = 'What is TypeScript?';
      const response: ChatResponse = {
        content: 'TypeScript is a typed superset of JavaScript',
        model: 'claude-3-haiku',
        tokens: { prompt: 10, completion: 20, total: 30 },
        latency: 100,
      };

      await cache.store(prompt, response, { model: 'claude-3-haiku' });

      // Measure hot cache hit latency
      const latencies: number[] = [];
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const result = await cache.check(prompt, { model: 'claude-3-haiku' });
        const duration = performance.now() - start;
        latencies.push(duration);
        expect(result.hit).toBe(true);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);

      console.log(`  Average hot cache latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`  Max hot cache latency: ${maxLatency.toFixed(2)}ms`);

      expect(avgLatency).toBeLessThan(1);
    });

    it('should track cost savings accurately', async () => {
      const mockKV = new MockKVNamespace();
      const cache = new SemanticCache({
        kvCache: mockKV as any,
      });

      const testCases = [
        { tokens: 100, prompt: 'test1' },
        { tokens: 200, prompt: 'test2' },
        { tokens: 150, prompt: 'test3' },
      ];

      for (const tc of testCases) {
        const response: ChatResponse = {
          content: 'Response',
          model: 'claude-3-haiku',
          tokens: { prompt: tc.tokens, completion: tc.tokens, total: tc.tokens * 2 },
          latency: 100,
        };

        await cache.store(tc.prompt, response, { model: 'claude-3-haiku' });
        await cache.check(tc.prompt, { model: 'claude-3-haiku' });
      }

      const stats = cache.getStats();
      const totalTokens = testCases.reduce((sum, tc) => sum + tc.tokens * 2, 0);

      console.log(`  Tokens saved: ${stats.metrics.tokensSaved}`);
      console.log(`  Cost saved: $${stats.metrics.costSaved.toFixed(4)}`);
      console.log(`  Expected tokens: ${totalTokens}`);

      expect(stats.metrics.tokensSaved).toBe(totalTokens);
      expect(stats.metrics.costSaved).toBeGreaterThan(0);
    });

    it('should handle cache eviction gracefully', async () => {
      const mockKV = new MockKVNamespace();
      const cache = new SemanticCache({
        maxHotEntries: 50,
        kvCache: mockKV as any,
      });

      const response: ChatResponse = {
        content: 'Response',
        model: 'claude-3-haiku',
        tokens: { prompt: 10, completion: 20, total: 30 },
        latency: 100,
      };

      // Add 100 entries (should trigger eviction)
      console.log('  Adding 100 cache entries...');
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        await cache.store(`prompt-${i}`, response, { model: 'claude-3-haiku' });
      }
      const duration = performance.now() - start;

      const stats = cache.getStats();

      console.log(`  Store time (100 entries): ${duration.toFixed(2)}ms`);
      console.log(`  Hot cache size: ${stats.hotCacheSize}`);
      console.log(`  Max entries: 50`);

      expect(stats.hotCacheSize).toBeLessThanOrEqual(50);
    });
  });

  describe('Memory Usage', () => {
    it('should estimate memory usage accurately', () => {
      const index = new HNSWIndex();

      // Add vectors and track memory
      const sizes: number[] = [];
      for (let i = 0; i < 1000; i += 100) {
        const vector = new Float32Array(768).map(() => Math.random() * 2 - 1);
        index.add(vector, `vec-${i}`);

        const size = index.getSize();
        sizes.push(size);
      }

      console.log('  Memory usage by vector count:');
      sizes.forEach((size, i) => {
        const count = (i + 1) * 100;
        const sizePerVector = size / count;
        console.log(`    ${count} vectors: ${(size / 1024).toFixed(2)}KB (${sizePerVector.toFixed(1)} bytes/vector)`);
      });

      // Should be approximately 20-50 bytes per vector (excluding vector data)
      const finalSize = sizes[sizes.length - 1];
      const sizePerVector = finalSize / 1000;
      expect(sizePerVector).toBeLessThan(100);
    });
  });
});

describe('Validation Tests', () => {
  it('should validate similarity threshold accuracy', async () => {
    const mockKV = new MockKVNamespace();
    const cache = new SemanticCache({
      similarityThreshold: 0.90,
      kvCache: mockKV as any,
    });

    // Test with exact match (should have similarity = 1.0)
    const prompt = 'What is TypeScript?';
    const response: ChatResponse = {
      content: 'TypeScript is a typed superset of JavaScript',
      model: 'claude-3-haiku',
      tokens: { prompt: 10, completion: 20, total: 30 },
      latency: 100,
    };

    await cache.store(prompt, response, { model: 'claude-3-haiku' });
    const result = await cache.check(prompt, { model: 'claude-3-haiku' });

    console.log(`  Similarity for exact match: ${result.similarity.toFixed(4)}`);
    expect(result.similarity).toBeGreaterThan(0.90);
    expect(result.hit).toBe(true);
  });

  it('should validate compression ratios', () => {
    const service = new EmbeddingService();
    const embedding = new Float32Array(768).map(() => Math.random() * 2 - 1);

    const result = service.quantize(embedding);

    console.log(`  Compression ratio: ${result.compressionRatio}x`);
    console.log(`  Original size: ${result.originalSize} bytes`);
    console.log(`  Compressed size: ${result.quantizedSize} bytes`);

    expect(result.compressionRatio).toBe(4);
    expect(result.originalSize).toBe(3072); // 768 * 4
    expect(result.quantizedSize).toBe(768); // 768 * 1
  });
});
