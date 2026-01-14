/**
 * Unit tests for HNSW index
 */

import { HNSWIndex } from '../../src/index/hnsw.js';
import { HNSWConfig, IndexType, DistanceMetric } from '../../src/types/index.js';

describe('HNSWIndex', () => {
  let index: HNSWIndex;
  let config: HNSWConfig;

  beforeEach(() => {
    config = {
      type: IndexType.HNSW,
      dimension: 128,
      metric: DistanceMetric.COSINE,
      M: 16,
      efConstruction: 200,
      efSearch: 50,
    };

    index = new HNSWIndex(config);
  });

  describe('constructor', () => {
    it('should create index with valid config', () => {
      expect(index).toBeDefined();
      expect(index.size()).toBe(0);
      expect(index.isEmpty()).toBe(true);
    });

    it('should throw error for invalid M', () => {
      expect(() => {
        new HNSWIndex({
          ...config,
          M: 1,
        });
      }).toThrow();
    });

    it('should throw error for invalid efConstruction', () => {
      expect(() => {
        new HNSWIndex({
          ...config,
          M: 16,
          efConstruction: 10,
        });
      }).toThrow();
    });
  });

  describe('insert', () => {
    it('should insert a vector', async () => {
      const vector = new Float32Array(128).fill(0).map(() => Math.random());

      await index.insert({
        id: 'test-1',
        vector,
      });

      expect(index.size()).toBe(1);
      expect(index.isEmpty()).toBe(false);
    });

    it('should insert multiple vectors', async () => {
      for (let i = 0; i < 100; i++) {
        const vector = new Float32Array(128).fill(0).map(() => Math.random());

        await index.insert({
          id: `test-${i}`,
          vector,
        });
      }

      expect(index.size()).toBe(100);
    });

    it('should throw error for mismatched dimensions', async () => {
      const vector = new Float32Array(64);

      await expect(
        index.insert({
          id: 'test-1',
          vector,
        })
      ).rejects.toThrow();
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      // Insert some test vectors
      for (let i = 0; i < 100; i++) {
        const vector = new Float32Array(128).fill(0).map(() => Math.random());

        await index.insert({
          id: `test-${i}`,
          vector,
        });
      }
    });

    it('should return k nearest neighbors', async () => {
      const queryVector = new Float32Array(128).fill(0).map(() => Math.random());
      const results = await index.search(queryVector, 10);

      expect(results).toHaveLength(10);
      expect(results[0].score).toBeGreaterThanOrEqual(results[9].score);
    });

    it('should return results with correct structure', async () => {
      const queryVector = new Float32Array(128).fill(0).map(() => Math.random());
      const results = await index.search(queryVector, 5);

      for (const result of results) {
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('distance');
      }
    });

    it('should return empty array for empty index', async () => {
      const emptyIndex = new HNSWIndex(config);
      const queryVector = new Float32Array(128).fill(0).map(() => Math.random());
      const results = await emptyIndex.search(queryVector, 10);

      expect(results).toHaveLength(0);
    });
  });

  describe('delete', () => {
    it('should delete a vector', async () => {
      const vector = new Float32Array(128).fill(0).map(() => Math.random());

      await index.insert({
        id: 'test-1',
        vector,
      });

      expect(await index.has('test-1')).toBe(true);

      const deleted = await index.delete('test-1');
      expect(deleted).toBe(true);
      expect(await index.has('test-1')).toBe(false);
    });

    it('should return false for non-existent vector', async () => {
      const deleted = await index.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('get', () => {
    it('should retrieve a vector', async () => {
      const vector = new Float32Array(128).fill(0).map(() => Math.random());

      await index.insert({
        id: 'test-1',
        vector,
        metadata: { key: 'value' },
      });

      const retrieved = await index.get('test-1');

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('test-1');
      expect(retrieved!.vector).toEqual(vector);
      expect(retrieved!.metadata).toEqual({ key: 'value' });
    });

    it('should return null for non-existent vector', async () => {
      const retrieved = await index.get('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a vector', async () => {
      const vector1 = new Float32Array(128).fill(0);
      const vector2 = new Float32Array(128).fill(1);

      await index.insert({
        id: 'test-1',
        vector: vector1,
      });

      const updated = await index.update({
        id: 'test-1',
        vector: vector2,
      });

      expect(updated).toBe(true);

      const retrieved = await index.get('test-1');
      expect(retrieved!.vector).toEqual(vector2);
    });

    it('should return false for non-existent vector', async () => {
      const updated = await index.update({
        id: 'non-existent',
        vector: new Float32Array(128).fill(0),
      });

      expect(updated).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all vectors', async () => {
      for (let i = 0; i < 10; i++) {
        const vector = new Float32Array(128).fill(0).map(() => Math.random());

        await index.insert({
          id: `test-${i}`,
          vector,
        });
      }

      expect(index.size()).toBe(10);

      await index.clear();

      expect(index.size()).toBe(0);
      expect(index.isEmpty()).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const vector = new Float32Array(128).fill(0).map(() => Math.random());

      await index.insert({
        id: 'test-1',
        vector,
      });

      const stats = index.getStats();

      expect(stats.vectorCount).toBe(1);
      expect(stats.dimension).toBe(128);
      expect(stats.indexType).toBe(IndexType.HNSW);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('setSearchParams', () => {
    it('should update search parameters', () => {
      index.setSearchParams(100);

      const config = index.getConfig();
      expect(config.efSearch).toBe(100);
    });

    it('should throw error for invalid efSearch', () => {
      expect(() => {
        index.setSearchParams(0);
      }).toThrow();
    });
  });

  describe('export/import snapshot', () => {
    it('should export and import snapshot', async () => {
      // Insert some vectors
      for (let i = 0; i < 10; i++) {
        const vector = new Float32Array(128).fill(0).map(() => Math.random());

        await index.insert({
          id: `test-${i}`,
          vector,
        });
      }

      const snapshot = index.exportSnapshot();

      expect(snapshot).toHaveProperty('version');
      expect(snapshot).toHaveProperty('config');
      expect(snapshot).toHaveProperty('nodes');
      expect(snapshot.nodes).toHaveLength(10);

      // Create new index and import
      const newIndex = new HNSWIndex(config);
      newIndex.importSnapshot(snapshot);

      expect(newIndex.size()).toBe(10);

      // Verify search works
      const queryVector = new Float32Array(128).fill(0).map(() => Math.random());
      const results = await newIndex.search(queryVector, 5);

      expect(results).toHaveLength(5);
    });
  });

  describe('getIds', () => {
    it('should return all vector IDs', async () => {
      const ids = ['test-1', 'test-2', 'test-3'];

      for (const id of ids) {
        const vector = new Float32Array(128).fill(0).map(() => Math.random());

        await index.insert({
          id,
          vector,
        });
      }

      const retrievedIds = index.getIds();

      expect(retrievedIds).toHaveLength(3);
      expect(retrievedIds).toContain('test-1');
      expect(retrievedIds).toContain('test-2');
      expect(retrievedIds).toContain('test-3');
    });

    it('should return empty array for empty index', () => {
      const ids = index.getIds();

      expect(ids).toHaveLength(0);
    });
  });
});
