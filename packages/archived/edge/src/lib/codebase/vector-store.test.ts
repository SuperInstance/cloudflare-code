/**
 * Unit Tests for Code Vector Store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CodeVectorStore } from './vector-store';
import type { CodeChunk } from './types';

describe('CodeVectorStore', () => {
  let store: CodeVectorStore;

  beforeEach(() => {
    store = new CodeVectorStore();
  });

  const createMockChunk = (id: string, content: string, filePath: string = 'test.ts'): CodeChunk => ({
    id,
    filePath,
    language: 'typescript',
    content,
    startLine: 1,
    endLine: content.split('\n').length,
    type: 'function',
    dependencies: [],
    imports: [],
    exports: [],
    embedding: new Float32Array(768).fill(0.1), // Mock embedding
  });

  describe('index', () => {
    it('should index chunks with embeddings', async () => {
      const chunks = [
        createMockChunk('chunk1', 'function test1() { return 1; }'),
        createMockChunk('chunk2', 'function test2() { return 2; }'),
      ];

      await store.index(chunks);

      expect(store.getStats().totalChunks).toBe(2);
    });

    it('should handle empty array', async () => {
      await store.index([]);
      expect(store.getStats().totalChunks).toBe(0);
    });

    it('should skip chunks without embeddings', async () => {
      const chunkWithoutEmbedding: CodeChunk = {
        id: 'no-embed',
        filePath: 'test.ts',
        language: 'typescript',
        content: 'test',
        startLine: 1,
        endLine: 1,
        type: 'other',
        dependencies: [],
        imports: [],
        exports: [],
      };

      await store.index([chunkWithoutEmbedding]);

      expect(store.getStats().totalChunks).toBe(0);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      const chunks = [
        createMockChunk('func1', 'export function add(a: number, b: number) { return a + b; }'),
        createMockChunk('func2', 'export function multiply(a: number, b: number) { return a * b; }'),
        createMockChunk('func3', 'export class Calculator { }'),
      ];

      // Create different embeddings for variety
      chunks[0].embedding = new Float32Array(768).fill(0.1);
      chunks[1].embedding = new Float32Array(768).fill(0.2);
      chunks[2].embedding = new Float32Array(768).fill(0.3);

      await store.index(chunks);
    });

    it('should return search results', async () => {
      const query = new Float32Array(768).fill(0.15);
      const results = await store.search(query, 2);

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(2);
      expect(results[0]).toHaveProperty('chunk');
      expect(results[0]).toHaveProperty('similarity');
      expect(results[0]).toHaveProperty('score');
    });

    it('should limit results to k', async () => {
      const query = new Float32Array(768).fill(0.1);
      const results = await store.search(query, 2);

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should filter by language', async () => {
      const query = new Float32Array(768).fill(0.1);
      const results = await store.search(query, 10, {
        languages: ['typescript'],
      });

      expect(results.every(r => r.chunk.language === 'typescript')).toBe(true);
    });

    it('should filter by type', async () => {
      const query = new Float32Array(768).fill(0.1);
      const results = await store.search(query, 10, {
        types: ['function'],
      });

      expect(results.every(r => r.chunk.type === 'function')).toBe(true);
    });
  });

  describe('hybridSearch', () => {
    beforeEach(async () => {
      const chunks = [
        createMockChunk('search1', 'function search(items) { return items.find(x => x); }', 'search.ts'),
        createMockChunk('sort1', 'function sort(items) { return items.sort(); }', 'sort.ts'),
        createMockChunk('filter1', 'function filter(items) { return items.filter(x => x); }', 'filter.ts'),
      ];

      chunks.forEach((chunk, i) => {
        chunk.embedding = new Float32Array(768).fill(i * 0.1);
      });

      await store.index(chunks);
    });

    it('should combine semantic and keyword search', async () => {
      const queryEmbedding = new Float32Array(768).fill(0.1);
      const results = await store.hybridSearch('search function', queryEmbedding, 2);

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getByFile', () => {
    beforeEach(async () => {
      const chunks = [
        createMockChunk('chunk1', 'export const a = 1;', 'file1.ts'),
        createMockChunk('chunk2', 'export const b = 2;', 'file1.ts'),
        createMockChunk('chunk3', 'export const c = 3;', 'file2.ts'),
      ];

      chunks.forEach(chunk => {
        chunk.embedding = new Float32Array(768).fill(0.1);
      });

      await store.index(chunks);
    });

    it('should return chunks for a file', async () => {
      const chunks = await store.getByFile('file1.ts');

      expect(chunks).toHaveLength(2);
      expect(chunks.every(c => c.filePath === 'file1.ts')).toBe(true);
    });

    it('should return empty array for non-existent file', async () => {
      const chunks = await store.getByFile('nonexistent.ts');

      expect(chunks).toHaveLength(0);
    });

    it('should sort chunks by line number', async () => {
      const chunks = await store.getByFile('file1.ts');

      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i].startLine).toBeGreaterThanOrEqual(chunks[i - 1].startLine);
      }
    });
  });

  describe('getRelated', () => {
    it('should return related chunks by dependencies', async () => {
      const chunk1 = createMockChunk('chunk1', 'function helper() { }');
      const chunk2 = createMockChunk('chunk2', 'function main() { helper(); }');
      chunk2.dependencies = ['chunk1'];

      chunk1.embedding = new Float32Array(768).fill(0.1);
      chunk2.embedding = new Float32Array(768).fill(0.2);

      await store.index([chunk1, chunk2]);

      const related = await store.getRelated('chunk2', 1);

      expect(related).toContainEqual(chunk1);
    });
  });

  describe('remove', () => {
    it('should remove chunk from index', async () => {
      const chunk = createMockChunk('to-remove', 'test');
      chunk.embedding = new Float32Array(768).fill(0.1);

      await store.index([chunk]);
      expect(store.getStats().totalChunks).toBe(1);

      const removed = await store.remove('to-remove');
      expect(removed).toBe(true);
      expect(store.getStats().totalChunks).toBe(0);
    });

    it('should return false for non-existent chunk', async () => {
      const removed = await store.remove('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all chunks', async () => {
      const chunks = [
        createMockChunk('chunk1', 'test1'),
        createMockChunk('chunk2', 'test2'),
      ];

      chunks.forEach(chunk => {
        chunk.embedding = new Float32Array(768).fill(0.1);
      });

      await store.index(chunks);
      expect(store.getStats().totalChunks).toBe(2);

      await store.clear();
      expect(store.getStats().totalChunks).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return index statistics', async () => {
      const chunks = [
        createMockChunk('chunk1', 'export const a = 1;', 'file1.ts'),
        createMockChunk('chunk2', 'export const b = 2;', 'file2.ts'),
        createMockChunk('chunk3', 'export function test() {}', 'file1.ts'),
      ];

      chunks.forEach(chunk => {
        chunk.embedding = new Float32Array(768).fill(0.1);
      });

      await store.index(chunks);

      const stats = store.getStats();

      expect(stats.totalChunks).toBe(3);
      expect(stats.totalFiles).toBe(2);
      expect(stats.languages.typescript).toBe(3);
      expect(stats.avgChunksPerFile).toBeGreaterThan(0);
    });
  });

  describe('performance', () => {
    it('should index 1000 chunks quickly', async () => {
      const chunks: CodeChunk[] = [];

      for (let i = 0; i < 1000; i++) {
        const chunk = createMockChunk(`chunk${i}`, `function test${i}() { return ${i}; }`);
        chunk.embedding = new Float32Array(768).fill(Math.random());
        chunks.push(chunk);
      }

      const start = performance.now();
      await store.index(chunks);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(500); // Should complete in less than 500ms
    });

    it('should search quickly with 1000 chunks', async () => {
      const chunks: CodeChunk[] = [];

      for (let i = 0; i < 1000; i++) {
        const chunk = createMockChunk(`chunk${i}`, `function test${i}() { return ${i}; }`);
        chunk.embedding = new Float32Array(768).fill(Math.random());
        chunks.push(chunk);
      }

      await store.index(chunks);

      const query = new Float32Array(768).fill(0.5);
      const start = performance.now();
      const results = await store.search(query, 10);
      const duration = performance.now() - start;

      expect(results.length).toBe(10);
      expect(duration).toBeLessThan(50); // Should complete in less than 50ms
    });
  });
});
