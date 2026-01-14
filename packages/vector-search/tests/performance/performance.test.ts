/**
 * Performance tests for vector search
 */

import { VectorSearch } from '../../src/vector-search.js';
import { VectorRecord } from '../../src/types/index.js';

describe('VectorSearch Performance', () => {
  let vectorSearch: VectorSearch;

  beforeAll(async () => {
    vectorSearch = new VectorSearch({
      dimension: 768,
      metric: 'cosine',
      indexType: 'hnsw',
      cacheEnabled: true,
      cacheSize: 1000,
    });

    await vectorSearch.initialize();
  });

  afterAll(async () => {
    await vectorSearch.shutdown();
  });

  describe('indexing performance', () => {
    it('should index 10K vectors in reasonable time', async () => {
      const startTime = Date.now();
      const count = 10000;
      const batchSize = 1000;

      for (let i = 0; i < count; i += batchSize) {
        const records: VectorRecord[] = [];

        for (let j = 0; j < batchSize && i + j < count; j++) {
          const vector = new Float32Array(768).fill(0).map(() => Math.random());

          records.push({
            id: `test-${i + j}`,
            vector,
          });
        }

        await vectorSearch.insertBatch(records);
      }

      const elapsed = Date.now() - startTime;

      console.log(`Indexed ${count} vectors in ${elapsed}ms`);
      console.log(`Average: ${(elapsed / count).toFixed(2)}ms per vector`);

      // Should complete in less than 30 seconds
      expect(elapsed).toBeLessThan(30000);

      const stats = vectorSearch.getStats();
      expect(stats.vectorCount).toBe(count);
    });

    it('should handle batch insertion efficiently', async () => {
      const batchSize = 1000;
      const records: VectorRecord[] = [];

      for (let i = 0; i < batchSize; i++) {
        const vector = new Float32Array(768).fill(0).map(() => Math.random());

        records.push({
          id: `batch-${i}`,
          vector,
        });
      }

      const startTime = Date.now();
      await vectorSearch.insertBatch(records);
      const elapsed = Date.now() - startTime;

      console.log(`Batch insert of ${batchSize} vectors took ${elapsed}ms`);
      console.log(`Average: ${(elapsed / batchSize).toFixed(2)}ms per vector`);

      // Should be faster than individual inserts
      expect(elapsed).toBeLessThan(5000);
    });
  });

  describe('search performance', () => {
    beforeAll(async () => {
      // Insert 10K vectors for testing
      const count = 10000;

      for (let i = 0; i < count; i += 1000) {
        const records: VectorRecord[] = [];

        for (let j = 0; j < 1000 && i + j < count; j++) {
          const vector = new Float32Array(768).fill(0).map(() => Math.random());

          records.push({
            id: `perf-${i + j}`,
            vector,
          });
        }

        await vectorSearch.insertBatch(records);
      }
    });

    it('should perform search in under 10ms', async () => {
      const queryVector = new Float32Array(768).fill(0).map(() => Math.random());

      const iterations = 100;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        await vectorSearch.search({
          vector: queryVector,
          topK: 10,
        });

        const latency = Date.now() - startTime;
        latencies.push(latency);
      }

      const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
      const p99Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.99)];

      console.log(`Search performance (10K vectors):`);
      console.log(`  Average: ${avgLatency.toFixed(2)}ms`);
      console.log(`  P95: ${p95Latency.toFixed(2)}ms`);
      console.log(`  P99: ${p99Latency.toFixed(2)}ms`);

      expect(avgLatency).toBeLessThan(10);
      expect(p95Latency).toBeLessThan(20);
      expect(p99Latency).toBeLessThan(50);
    });

    it('should handle high QPS', async () => {
      const queryVector = new Float32Array(768).fill(0).map(() => Math.random());
      const qps = 1000;
      const duration = 5000; // 5 seconds
      const totalQueries = qps * (duration / 1000);

      const startTime = Date.now();
      let completedQueries = 0;

      const promises: Promise<void>[] = [];

      for (let i = 0; i < totalQueries; i++) {
        const promise = vectorSearch
          .search({
            vector: queryVector,
            topK: 10,
          })
          .then(() => {
            completedQueries++;
          });

        promises.push(promise);
      }

      await Promise.all(promises);

      const elapsed = Date.now() - startTime;
      const actualQPS = (completedQueries / elapsed) * 1000;

      console.log(`Completed ${completedQueries} queries in ${elapsed}ms`);
      console.log(`Actual QPS: ${actualQPS.toFixed(2)}`);

      expect(actualQPS).toBeGreaterThan(500);
    });
  });

  describe('cache performance', () => {
    it('should improve search performance with cache', async () => {
      const queryVector = new Float32Array(768).fill(0).map(() => Math.random());

      // Clear cache
      vectorSearch.clearCache();

      // First search (cache miss)
      const coldStart = Date.now();
      await vectorSearch.search({
        vector: queryVector,
        topK: 10,
      });
      const coldLatency = Date.now() - coldStart;

      // Second search (cache hit)
      const warmStart = Date.now();
      await vectorSearch.search({
        vector: queryVector,
        topK: 10,
      });
      const warmLatency = Date.now() - warmStart;

      console.log(`Cold search: ${coldLatency}ms`);
      console.log(`Warm search: ${warmLatency}ms`);
      console.log(`Speedup: ${(coldLatency / warmLatency).toFixed(2)}x`);

      expect(warmLatency).toBeLessThan(coldLatency);
    });
  });

  describe('memory usage', () => {
    it('should have reasonable memory footprint', async () => {
      const stats = vectorSearch.getStats();

      console.log(`Memory usage for ${stats.vectorCount} vectors:`);
      console.log(`  Total: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Per vector: ${(stats.memoryUsage / stats.vectorCount / 1024).toFixed(2)} KB`);

      // Should use less than 500 MB for 10K vectors
      expect(stats.memoryUsage).toBeLessThan(500 * 1024 * 1024);
    });
  });

  describe('scalability', () => {
    it('should maintain performance as index grows', async () => {
      const sizes = [1000, 5000, 10000];
      const queryVector = new Float32Array(768).fill(0).map(() => Math.random());

      const results: Array<{ size: number; avgLatency: number }> = [];

      for (const size of sizes) {
        // Insert vectors if needed
        const currentSize = vectorSearch.getStats().vectorCount;

        if (currentSize < size) {
          const records: VectorRecord[] = [];

          for (let i = currentSize; i < size; i++) {
            const vector = new Float32Array(768).fill(0).map(() => Math.random());

            records.push({
              id: `scale-${i}`,
              vector,
            });
          }

          await vectorSearch.insertBatch(records);
        }

        // Measure search performance
        const iterations = 50;
        const latencies: number[] = [];

        for (let i = 0; i < iterations; i++) {
          const startTime = Date.now();

          await vectorSearch.search({
            vector: queryVector,
            topK: 10,
          });

          latencies.push(Date.now() - startTime);
        }

        const avgLatency =
          latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;

        results.push({ size, avgLatency });

        console.log(`Size: ${size}, Avg Latency: ${avgLatency.toFixed(2)}ms`);
      }

      // Latency should not grow linearly with size
      expect(results[1].avgLatency).toBeLessThan(results[0].avgLatency * 2);
      expect(results[2].avgLatency).toBeLessThan(results[1].avgLatency * 2);
    });
  });
});
