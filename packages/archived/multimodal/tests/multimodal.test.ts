/**
 * Multimodal RAG Tests
 * Tests for cross-modal search and retrieval
 */

import { describe, it, expect } from 'vitest';
import {
  storeDocument,
  search,
  searchByText,
  getSimilarDocuments
} from '../src/multimodal';

describe('Multimodal RAG Module', () => {
  describe('Document Storage', () => {
    it('should store text document', async () => {
      const document = {
        id: 'test-doc-1',
        type: 'text' as const,
        content: 'Sample text content for testing',
        metadata: {
          source: 'test',
          timestamp: new Date(),
          tags: ['test', 'sample']
        }
      };

      const result = await storeDocument(document);

      expect(result).toBeDefined();
      expect(result.id).toBe(document.id);
      expect(result.content).toBe(document.content);
      expect(result.embedding).toBeDefined();
      expect(result.embedding.vector).toBeDefined();
      expect(result.embedding.dimension).toBeGreaterThan(0);
    });

    it('should store code document', async () => {
      const document = {
        type: 'code' as const,
        content: 'function test() { return true; }',
        metadata: {
          source: 'code-editor',
          timestamp: new Date(),
          language: 'javascript'
        }
      };

      const result = await storeDocument(document);

      expect(result).toBeDefined();
      expect(result.type).toBe('code');
      expect(result.embedding).toBeDefined();
    });

    it('should store image document', async () => {
      const document = {
        type: 'image' as const,
        content: 'base64-image-data',
        metadata: {
          source: 'screenshot',
          timestamp: new Date(),
          format: 'png'
        }
      };

      const result = await storeDocument(document);

      expect(result).toBeDefined();
      expect(result.type).toBe('image');
    });
  });

  describe('Search', () => {
    it('should search by text query', async () => {
      const result = await search({
        query: 'test query',
        limit: 5,
        threshold: 0.7
      });

      expect(result).toBeDefined();
      expect(result.documents).toBeDefined();
      expect(Array.isArray(result.documents)).toBe(true);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.queryType).toBe('text');
    });

    it('should search with media type filter', async () => {
      const result = await search({
        query: 'code sample',
        mediaTypes: ['code'],
        limit: 10
      });

      expect(result).toBeDefined();
      expect(result.documents).toBeDefined();
    });

    it('should search with date filter', async () => {
      const result = await search({
        query: 'recent content',
        filters: {
          dateRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-12-31')
          }
        }
      });

      expect(result).toBeDefined();
      expect(result.documents).toBeDefined();
    });
  });

  describe('Similar Documents', () => {
    it('should find similar documents', async () => {
      const similar = await getSimilarDocuments('test-doc-id', 5);

      expect(similar).toBeDefined();
      expect(similar.documents).toBeDefined();
      expect(similar.metadata.totalResults).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cross-Modal Search', () => {
    it('should find text related to image', async () => {
      const mockImage = Buffer.from('mock-image-data');

      const result = await search({
        query: mockImage,
        mediaTypes: ['text', 'code'],
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.metadata.queryType).toBe('image');
    });
  });
});
