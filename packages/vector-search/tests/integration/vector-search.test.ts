/**
 * Integration tests for VectorSearch
 */

import { VectorSearch } from '../../src/vector-search.js';
import { SearchQuery, VectorRecord } from '../../src/types/index.js';

describe('VectorSearch Integration', () => {
  let vectorSearch: VectorSearch;

  beforeEach(async () => {
    vectorSearch = new VectorSearch({
      dimension: 128,
      metric: 'cosine',
      indexType: 'hnsw',
      cacheEnabled: true,
      cacheSize: 100,
    });

    await vectorSearch.initialize();
  });

  afterEach(async () => {
    await vectorSearch.shutdown();
  });

  describe('insert and search', () => {
    it('should insert vectors and search', async () => {
      // Insert test vectors
      const vectors: VectorRecord[] = [];

      for (let i = 0; i < 100; i++) {
        const vector = new Float32Array(128).fill(0).map(() => Math.random());

        vectors.push({
          id: `test-${i}`,
          vector,
          metadata: {
            category: i % 2 === 0 ? 'even' : 'odd',
            index: i,
          },
        });
      }

      const result = await vectorSearch.insertBatch(vectors);

      expect(result.succeeded).toBe(100);
      expect(result.failed).toBe(0);

      // Search
      const query: SearchQuery = {
        vector: vectors[0].vector,
        topK: 10,
      };

      const searchResults = await vectorSearch.search(query);

      expect(searchResults).toHaveLength(10);
      expect(searchResults[0].id).toBe('test-0');
    });

    it('should handle insert with metadata filter', async () => {
      // Insert vectors with metadata
      for (let i = 0; i < 50; i++) {
        const vector = new Float32Array(128).fill(0).map(() => Math.random());

        await vectorSearch.insert({
          id: `test-${i}`,
          vector,
          metadata: {
            category: i % 3 === 0 ? 'A' : i % 3 === 1 ? 'B' : 'C',
          },
        });
      }

      // Search with filter
      const query: SearchQuery = {
        vector: new Float32Array(128).fill(0).map(() => Math.random()),
        topK: 10,
        filter: {
          must: [
            {
              field: 'category',
              operator: 'equals',
              value: 'A',
            },
          ],
        },
      };

      const results = await vectorSearch.search(query);

      expect(results.length).toBeLessThanOrEqual(10);

      // Verify all results match filter
      for (const result of results) {
        if (result.metadata) {
          expect(result.metadata.category).toBe('A');
        }
      }
    });
  });

  describe('embeddings', () => {
    it('should generate embeddings', async () => {
      const embedding = await vectorSearch.embed('test text');

      expect(embedding).toBeInstanceOf(Float32Array);
      expect(embedding.length).toBe(128);
    });

    it('should generate batch embeddings', async () => {
      const texts = ['text 1', 'text 2', 'text 3'];
      const embeddings = await vectorSearch.embedBatch(texts);

      expect(embeddings).toHaveLength(3);
      expect(embeddings[0].length).toBe(128);
    });
  });

  describe('delete and update', () => {
    it('should delete vectors', async () => {
      // Insert vector
      const vector = new Float32Array(128).fill(0).map(() => Math.random());

      await vectorSearch.insert({
        id: 'test-1',
        vector,
      });

      // Delete
      const deleted = await vectorSearch.delete('test-1');

      expect(deleted).toBe(true);
    });

    it('should update vectors', async () => {
      const vector1 = new Float32Array(128).fill(0);
      const vector2 = new Float32Array(128).fill(1);

      await vectorSearch.insert({
        id: 'test-1',
        vector: vector1,
      });

      const updated = await vectorSearch.update({
        id: 'test-1',
        vector: vector2,
      });

      expect(updated).toBe(true);
    });
  });

  describe('statistics', () => {
    it('should return statistics', async () => {
      // Insert some vectors
      for (let i = 0; i < 10; i++) {
        const vector = new Float32Array(128).fill(0).map(() => Math.random());

        await vectorSearch.insert({
          id: `test-${i}`,
          vector,
        });
      }

      const stats = vectorSearch.getStats();

      expect(stats.vectorCount).toBe(10);
      expect(stats.dimension).toBe(128);
    });

    it('should return cache statistics', async () => {
      // Perform a search to populate cache
      const vector = new Float32Array(128).fill(0).map(() => Math.random());

      await vectorSearch.insert({
        id: 'test-1',
        vector,
      });

      await vectorSearch.search({
        vector,
        topK: 5,
      });

      const cacheStats = vectorSearch.getCacheStats();

      expect(cacheStats.size).toBeGreaterThan(0);
    });
  });

  describe('optimization', () => {
    it('should optimize index', async () => {
      // Insert vectors
      for (let i = 0; i < 100; i++) {
        const vector = new Float32Array(128).fill(0).map(() => Math.random());

        await vectorSearch.insert({
          id: `test-${i}`,
          vector,
        });
      }

      await vectorSearch.optimize();

      const stats = vectorSearch.getStats();

      expect(stats.vectorCount).toBe(100);
    });
  });

  describe('health check', () => {
    it('should return health status', async () => {
      const health = await vectorSearch.getHealth();

      expect(health).toHaveProperty('index');
      expect(health).toHaveProperty('indexer');
      expect(health).toHaveProperty('healthy');
    });
  });

  describe('cache operations', () => {
    it('should clear cache', async () => {
      // Perform search to populate cache
      const vector = new Float32Array(128).fill(0).map(() => Math.random());

      await vectorSearch.insert({
        id: 'test-1',
        vector,
      });

      await vectorSearch.search({
        vector,
        topK: 5,
      });

      let cacheStats = vectorSearch.getCacheStats();
      expect(cacheStats.size).toBeGreaterThan(0);

      // Clear cache
      vectorSearch.clearCache();

      cacheStats = vectorSearch.getCacheStats();
      expect(cacheStats.size).toBe(0);
    });
  });

  describe('end-to-end workflow', () => {
    it('should handle complete workflow', async () => {
      // 1. Generate embeddings
      const texts = ['apple', 'banana', 'orange', 'grape', 'kiwi'];
      const embeddings = await vectorSearch.embedBatch(texts);

      // 2. Insert vectors
      const records: VectorRecord[] = embeddings.map((embedding, i) => ({
        id: `fruit-${i}`,
        vector: embedding,
        metadata: {
          name: texts[i],
          type: 'fruit',
        },
      }));

      await vectorSearch.insertBatch(records);

      // 3. Search
      const queryEmbedding = await vectorSearch.embed('apple');
      const results = await vectorSearch.search({
        vector: queryEmbedding,
        topK: 3,
      });

      expect(results).toHaveLength(3);
      expect(results[0].id).toBe('fruit-0'); // Should be closest to 'apple'

      // 4. Delete
      await vectorSearch.delete('fruit-0');

      // 5. Verify deletion
      const searchResults = await vectorSearch.search({
        vector: queryEmbedding,
        topK: 5,
      });

      expect(searchResults.every((r) => r.id !== 'fruit-0')).toBe(true);
    });
  });
});
