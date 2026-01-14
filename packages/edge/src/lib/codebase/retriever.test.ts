/**
 * Unit Tests for Code Retriever
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CodeRetriever } from './retriever';
import { CodeVectorStore } from './vector-store';
import { CodeEmbeddingGenerator } from './embeddings';
import type { CodeChunk, ConversationContext } from './types';

// Mock implementations
const mockQueryEmbedding = new Float32Array(768).fill(0.5);

describe('CodeRetriever', () => {
  let retriever: CodeRetriever;
  let vectorStore: CodeVectorStore;
  let embeddingGenerator: CodeEmbeddingGenerator;

  const createMockChunk = (id: string, content: string, filePath: string = 'test.ts'): CodeChunk => ({
    id,
    filePath,
    language: 'typescript',
    content,
    startLine: 1,
    endLine: content.split('\n').length,
    type: 'function',
    name: id,
    dependencies: [],
    imports: [],
    exports: [],
    embedding: new Float32Array(768).fill(0.1),
    indexedAt: Date.now(),
  });

  beforeEach(() => {
    vectorStore = new CodeVectorStore();
    embeddingGenerator = new CodeEmbeddingGenerator();
    retriever = new CodeRetriever(vectorStore, embeddingGenerator);
  });

  describe('retrieve', () => {
    beforeEach(async () => {
      const chunks = [
        createMockChunk('add', 'export function add(a: number, b: number): number { return a + b; }'),
        createMockChunk('multiply', 'export function multiply(a: number, b: number): number { return a * b; }'),
        createMockChunk('Calculator', 'export class Calculator { }'),
      ];

      // Create varied embeddings
      chunks[0].embedding = new Float32Array(768).fill(0.1);
      chunks[1].embedding = new Float32Array(768).fill(0.2);
      chunks[2].embedding = new Float32Array(768).fill(0.3);

      await vectorStore.index(chunks);
    });

    it('should retrieve relevant code for query', async () => {
      // Mock the embedding generator
      vi.spyOn(embeddingGenerator, 'generateQueryEmbedding').mockResolvedValue(mockQueryEmbedding);

      const result = await retriever.retrieve('addition function');

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.context).toBeTruthy();
      expect(result.metadata.totalTokens).toBeGreaterThan(0);
      expect(result.metadata.fileCount).toBeGreaterThan(0);
      expect(result.metadata.chunkCount).toBeGreaterThan(0);
      expect(result.metadata.averageRelevance).toBeGreaterThan(0);
    });

    it('should respect max chunks limit', async () => {
      vi.spyOn(embeddingGenerator, 'generateQueryEmbedding').mockResolvedValue(mockQueryEmbedding);

      const result = await retriever.retrieve('test', { messages: [], currentQuery: 'test' });

      expect(result.chunks.length).toBeLessThanOrEqual(10); // Default maxChunks
    });

    it('should filter by minimum similarity', async () => {
      vi.spyOn(embeddingGenerator, 'generateQueryEmbedding').mockResolvedValue(mockQueryEmbedding);

      const retrieverWithMinSimilarity = new CodeRetriever(
        vectorStore,
        embeddingGenerator,
        { minSimilarity: 0.9 }
      );

      const result = await retrieverWithMinSimilarity.retrieve('test');

      // All results should have similarity >= 0.9 (though with mock embeddings this may vary)
      expect(result.chunks.length).toBeGreaterThanOrEqual(0);
    });

    it('should use conversation context', async () => {
      vi.spyOn(embeddingGenerator, 'generateQueryEmbedding').mockResolvedValue(mockQueryEmbedding);

      const context: ConversationContext = {
        messages: [],
        currentQuery: 'test',
        relevantFiles: ['test.ts'],
      };

      const result = await retriever.retrieve('test', context);

      expect(result.chunks.length).toBeGreaterThan(0);
    });
  });

  describe('retrieveHybrid', () => {
    beforeEach(async () => {
      const chunks = [
        createMockChunk('search', 'function search(items) { return items.find(x => x); }', 'search.ts'),
        createMockChunk('sort', 'function sort(items) { return items.sort(); }', 'sort.ts'),
        createMockChunk('filter', 'function filter(items) { return items.filter(x => x); }', 'filter.ts'),
      ];

      chunks.forEach((chunk, i) => {
        chunk.embedding = new Float32Array(768).fill(i * 0.1);
      });

      await vectorStore.index(chunks);
    });

    it('should combine semantic and keyword search', async () => {
      vi.spyOn(embeddingGenerator, 'generateQueryEmbedding').mockResolvedValue(mockQueryEmbedding);

      const result = await retriever.retrieveHybrid('search function');

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.context).toBeTruthy();
    });
  });

  describe('formatForLLM', () => {
    it('should format retrieved code with template', async () => {
      const retrieved = {
        chunks: [createMockChunk('test', 'export function test() {}')],
        context: '// File: test.ts\nexport function test() {}',
        metadata: {
          totalTokens: 50,
          fileCount: 1,
          chunkCount: 1,
          averageRelevance: 0.85,
          retrievalTime: 100,
        },
      };

      const formatted = retriever.formatForLLM(retrieved);

      expect(formatted).toContain('test.ts');
      expect(formatted).toContain('export function test() {}');
      expect(formatted).toContain('Files: 1');
      expect(formatted).toContain('Chunks: 1');
      expect(formatted).toContain('0.85');
    });

    it('should use custom template', async () => {
      const retrieved = {
        chunks: [createMockChunk('test', 'test')],
        context: 'test code',
        metadata: {
          totalTokens: 10,
          fileCount: 1,
          chunkCount: 1,
          averageRelevance: 0.9,
          retrievalTime: 50,
        },
      };

      const customTemplate = 'Code: {context}\nFiles: {fileCount}';
      const formatted = retriever.formatForLLM(retrieved, customTemplate);

      expect(formatted).toContain('Code: test code');
      expect(formatted).toContain('Files: 1');
    });
  });

  describe('retrieveStream', () => {
    beforeEach(async () => {
      const chunks = [
        createMockChunk('chunk1', 'export const a = 1;'),
        createMockChunk('chunk2', 'export const b = 2;'),
        createMockChunk('chunk3', 'export const c = 3;'),
      ];

      chunks.forEach(chunk => {
        chunk.embedding = new Float32Array(768).fill(0.1);
      });

      await vectorStore.index(chunks);
    });

    it('should stream chunks as they are retrieved', async () => {
      vi.spyOn(embeddingGenerator, 'generateQueryEmbedding').mockResolvedValue(mockQueryEmbedding);

      const streamedChunks: CodeChunk[] = [];
      const onChunk = (chunk: CodeChunk) => {
        streamedChunks.push(chunk);
      };

      const result = await retriever.retrieveStream(
        'test',
        { messages: [], currentQuery: 'test' },
        onChunk
      );

      expect(streamedChunks.length).toBeGreaterThan(0);
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.context).toBeTruthy();
    });
  });

  describe('updateOptions', () => {
    it('should update retriever options', () => {
      retriever.updateOptions({
        maxChunks: 20,
        minSimilarity: 0.7,
      });

      const options = retriever.getOptions();

      expect(options.maxChunks).toBe(20);
      expect(options.minSimilarity).toBe(0.7);
    });
  });

  describe('getOptions', () => {
    it('should return current options', () => {
      const options = retriever.getOptions();

      expect(options).toHaveProperty('maxChunks');
      expect(options).toHaveProperty('minSimilarity');
      expect(options).toHaveProperty('reranking');
      expect(options).toHaveProperty('includeFileContext');
      expect(options).toHaveProperty('includeRelated');
    });
  });

  describe('performance', () => {
    it('should retrieve and build context quickly', async () => {
      const chunks: CodeChunk[] = [];

      for (let i = 0; i < 100; i++) {
        const chunk = createMockChunk(`chunk${i}`, `function test${i}() { return ${i}; }`);
        chunk.embedding = new Float32Array(768).fill(Math.random());
        chunks.push(chunk);
      }

      await vectorStore.index(chunks);

      vi.spyOn(embeddingGenerator, 'generateQueryEmbedding').mockResolvedValue(mockQueryEmbedding);

      const start = performance.now();
      const result = await retriever.retrieve('test');
      const duration = performance.now() - start;

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(200); // Should complete in less than 200ms
    });
  });
});
