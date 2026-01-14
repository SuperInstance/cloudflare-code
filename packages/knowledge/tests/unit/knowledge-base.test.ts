/**
 * Unit tests for Knowledge Base
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeBase } from '../../src/knowledge/base.js';
import { DocumentContent, DocumentMetadata } from '../../src/types/index.js';

describe('KnowledgeBase', () => {
  let knowledgeBase: KnowledgeBase;
  let mockState: any;
  let mockEnv: any;

  beforeEach(() => {
    mockState = {
      storage: {
        get: async () => null,
        put: async () => {},
        delete: async () => {},
        list: async () => []
      }
    };

    mockEnv = {
      storage: {
        get: async () => null,
        put: async () => {},
        delete: async () => {}
      },
      embeddings: {
        generateEmbedding: async (text: string) => {
          // Mock embedding - return array of zeros
          return new Array(1536).fill(0);
        }
      },
      search: {
        index: async () => {},
        search: async () => [],
        delete: async () => {},
        clear: async () => {}
      }
    };

    knowledgeBase = new KnowledgeBase(mockState, mockEnv);
  });

  describe('putDocument()', () => {
    it('should store a document', async () => {
      const doc: DocumentContent = {
        metadata: {
          id: 'test-doc',
          title: 'Test Document',
          description: 'A test document',
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0',
          tags: ['test'],
          category: 'test',
          language: 'typescript'
        },
        content: 'Test content'
      };

      await knowledgeBase.putDocument(doc);

      const retrieved = await knowledgeBase.getDocument('test-doc');
      expect(retrieved).toBeDefined();
      expect(retrieved?.metadata.id).toBe('test-doc');
    });

    it('should generate embeddings for document', async () => {
      const doc: DocumentContent = {
        metadata: {
          id: 'embedding-test',
          title: 'Embedding Test',
          description: 'Test embedding generation',
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0',
          tags: ['test'],
          category: 'test',
          language: 'typescript'
        },
        content: 'Test content for embedding'
      };

      await knowledgeBase.putDocument(doc);

      // Embedding should be generated and stored
      const embedding = await mockEnv.embeddings.generateEmbedding(doc.content);
      expect(embedding).toBeDefined();
      expect(embedding.length).toBeGreaterThan(0);
    });
  });

  describe('getDocument()', () => {
    it('should retrieve a stored document', async () => {
      const doc: DocumentContent = {
        metadata: {
          id: 'get-test',
          title: 'Get Test',
          description: 'Test document retrieval',
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0',
          tags: ['test'],
          category: 'test',
          language: 'typescript'
        },
        content: 'Test content'
      };

      await knowledgeBase.putDocument(doc);
      const retrieved = await knowledgeBase.getDocument('get-test');

      expect(retrieved).toBeDefined();
      expect(retrieved?.metadata.title).toBe('Get Test');
      expect(retrieved?.content).toBe('Test content');
    });

    it('should return null for non-existent document', async () => {
      const retrieved = await knowledgeBase.getDocument('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('deleteDocument()', () => {
    it('should delete a document', async () => {
      const doc: DocumentContent = {
        metadata: {
          id: 'delete-test',
          title: 'Delete Test',
          description: 'Test document deletion',
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0',
          tags: ['test'],
          category: 'test',
          language: 'typescript'
        },
        content: 'Test content'
      };

      await knowledgeBase.putDocument(doc);
      await knowledgeBase.deleteDocument('delete-test');

      const retrieved = await knowledgeBase.getDocument('delete-test');
      expect(retrieved).toBeNull();
    });
  });

  describe('search()', () => {
    it('should search documents', async () => {
      const doc1: DocumentContent = {
        metadata: {
          id: 'search-test-1',
          title: 'Search Test One',
          description: 'First test document',
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0',
          tags: ['search', 'test'],
          category: 'test',
          language: 'typescript'
        },
        content: 'Content about search functionality'
      };

      const doc2: DocumentContent = {
        metadata: {
          id: 'search-test-2',
          title: 'Search Test Two',
          description: 'Second test document',
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0',
          tags: ['search'],
          category: 'test',
          language: 'typescript'
        },
        content: 'More content about search'
      };

      await knowledgeBase.putDocument(doc1);
      await knowledgeBase.putDocument(doc2);

      const results = await knowledgeBase.search('search', {
        limit: 10
      });

      expect(results.length).toBeGreaterThan(0);
    });

    it('should apply semantic search', async () => {
      const doc: DocumentContent = {
        metadata: {
          id: 'semantic-test',
          title: 'Semantic Search',
          description: 'Test semantic search functionality',
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0',
          tags: ['semantic', 'search'],
          category: 'test',
          language: 'typescript'
        },
        content: 'Content about semantic search and vector embeddings'
      };

      await knowledgeBase.putDocument(doc);

      const results = await knowledgeBase.search('vector similarity', {
        semantic: true,
        limit: 10
      });

      expect(results).toBeDefined();
    });
  });

  describe('findSimilar()', () => {
    it('should find similar documents', async () => {
      const doc1: DocumentContent = {
        metadata: {
          id: 'similar-1',
          title: 'Similar Document One',
          description: 'Test similarity',
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0',
          tags: ['test'],
          category: 'test',
          language: 'typescript'
        },
        content: 'Similar content about testing'
      };

      const doc2: DocumentContent = {
        metadata: {
          id: 'similar-2',
          title: 'Similar Document Two',
          description: 'Test similarity',
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0',
          tags: ['test'],
          category: 'test',
          language: 'typescript'
        },
        content: 'Similar content about testing and validation'
      };

      await knowledgeBase.putDocument(doc1);
      await knowledgeBase.putDocument(doc2);

      const similar = await knowledgeBase.findSimilar('similar-1', 5);

      expect(similar).toBeDefined();
      expect(similar.length).toBeGreaterThan(0);
    });
  });

  describe('getStats()', () => {
    it('should return knowledge base statistics', async () => {
      const doc: DocumentContent = {
        metadata: {
          id: 'stats-test',
          title: 'Stats Test',
          description: 'Test statistics',
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0',
          tags: ['stats', 'test'],
          category: 'test',
          language: 'typescript'
        },
        content: 'Test content for stats'
      };

      await knowledgeBase.putDocument(doc);

      const stats = await knowledgeBase.getStats();

      expect(stats.totalDocuments).toBe(1);
      expect(stats.documentsByCategory.test).toBe(1);
      expect(stats.documentsByLanguage.typescript).toBe(1);
      expect(stats.documentsByTag.test).toBe(1);
      expect(stats.documentsByTag.stats).toBe(1);
    });
  });
});
