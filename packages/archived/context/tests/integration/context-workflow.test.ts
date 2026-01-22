/**
 * Integration tests for Context Management Workflow
 */

import { ContextManager } from '../../src/manager/manager';
import { MemoryStore } from '../../src/memory/store';
import { ContextCompressor } from '../../src/compression/compressor';
import { ContextOptimizer } from '../../src/optimizer/optimizer';
import { RAGEngine } from '../../src/rag/engine';
import { CrossSessionManager } from '../../src/sessions/cross-session';

describe('Context Management Integration', () => {
  let contextManager: ContextManager;
  let memoryStore: MemoryStore;
  let compressor: ContextCompressor;
  let optimizer: ContextOptimizer;
  let ragEngine: RAGEngine;
  let sessionManager: CrossSessionManager;

  beforeEach(() => {
    contextManager = new ContextManager({
      maxTokens: 50000,
      compressionEnabled: true,
      enableEvents: false,
    });

    memoryStore = new MemoryStore({
      maxSize: 1000,
      forgettingEnabled: true,
    });

    compressor = new ContextCompressor({
      level: 'medium',
      strategy: 'hybrid',
    });

    optimizer = new ContextOptimizer({
      maxTokens: 10000,
      priorityStrategy: 'hybrid',
    });

    ragEngine = new RAGEngine({
      chunkSize: 512,
      retrievalStrategy: 'hybrid',
    });

    sessionManager = new CrossSessionManager({
      persistenceEnabled: true,
      linkingEnabled: true,
    });
  });

  describe('End-to-End Conversation Flow', () => {
    test('should handle complete conversation lifecycle', async () => {
      // 1. Create session
      const context = await contextManager.createContext('user-integration');
      const session = await sessionManager.createSession(context);

      expect(session.state).toBe('active');

      // 2. Add messages
      await contextManager.addMessages(context.sessionId, [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What is TypeScript?' },
        {
          role: 'assistant',
          content:
            'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.',
        },
        { role: 'user', content: 'What are its benefits?' },
        {
          role: 'assistant',
          content:
            'TypeScript provides static typing, better IDE support, improved code quality, and easier refactoring.',
        },
      ]);

      const updatedContext = await contextManager.getContext(context.sessionId);
      expect(updatedContext.messages).toHaveLength(5);

      // 3. Create memories
      await memoryStore.createEpisodicMemory(
        'User asked about TypeScript and its benefits',
        Date.now(),
        { userId: 'user-integration', sessionId: context.sessionId }
      );

      await memoryStore.createSemanticMemory(
        'TypeScript knowledge',
        [
          {
            id: 'f1',
            statement: 'TypeScript is a typed superset of JavaScript',
            confidence: 1.0,
          },
        ],
        [],
        { categories: ['programming', 'typescript'] }
      );

      // 4. Compress context if needed
      const usage = contextManager.getTokenUsage(context.sessionId);
      if (usage.percentage > 50) {
        await contextManager.compressContext(context.sessionId);
      }

      // 5. Optimize for next query
      const optimized = await optimizer.optimize(
        updatedContext.messages,
        'TypeScript typing'
      );

      expect(optimized.included.length).toBeGreaterThan(0);

      // 6. Persist session
      await sessionManager.persistSession(context.sessionId);

      // 7. Archive session
      await sessionManager.archiveSession(context.sessionId);

      const archivedSession = await sessionManager.getSession(context.sessionId);
      expect(archivedSession.state).toBe('archived');
    });

    test('should handle multi-turn conversation with RAG', async () => {
      // Add documents
      await ragEngine.addDocument(
        'TypeScript is a programming language developed by Microsoft. It adds static typing to JavaScript.',
        {
          source: 'docs',
          title: 'TypeScript Introduction',
          tags: ['typescript', 'programming'],
        }
      );

      await ragEngine.addDocument(
        'React is a JavaScript library for building user interfaces. It was developed by Facebook.',
        {
          source: 'docs',
          title: 'React Introduction',
          tags: ['react', 'javascript'],
        }
      );

      // Create conversation
      const context = await contextManager.createContext('user-rag');

      await contextManager.addMessages(context.sessionId, [
        { role: 'user', content: 'What is TypeScript?' },
        {
          role: 'assistant',
          content: 'TypeScript is a programming language developed by Microsoft.',
        },
        { role: 'user', content: 'Tell me more about it' },
      ]);

      // Retrieve relevant documents
      const retrieval = await ragEngine.retrieve({
        query: 'TypeScript programming language',
        limit: 3,
      });

      expect(retrieval.chunks.length).toBeGreaterThan(0);
      expect(retrieval.retrievalTime).toBeLessThan(1000);
    });
  });

  describe('Memory Integration', () => {
    test('should integrate memory with context', async () => {
      const context = await contextManager.createContext('user-memory');

      // Add conversation
      await contextManager.addMessages(context.sessionId, [
        { role: 'user', content: 'I love Python programming' },
        {
          role: 'assistant',
          content: 'That is great! Python is a versatile language.',
        },
      ]);

      // Create episodic memory
      await memoryStore.createEpisodicMemory(
        'User expressed love for Python programming',
        Date.now(),
        { userId: 'user-memory' }
      );

      // Create semantic memory
      await memoryStore.createSemanticMemory(
        'User preferences',
        [
          {
            id: 'pref1',
            statement: 'User loves Python programming',
            confidence: 0.9,
          },
        ],
        [],
        { userId: 'user-memory', categories: ['preferences'] }
      );

      // Retrieve memories
      const episodicMemories = await memoryStore.getEpisodicMemories('user-memory');
      const semanticMemories = await memoryStore.getSemanticMemories('preferences');

      expect(episodicMemories.length).toBe(1);
      expect(semanticMemories.length).toBe(1);
    });
  });

  describe('Compression and Optimization Integration', () => {
    test('should compress and optimize large context', async () => {
      const context = await contextManager.createContext('user-compression');

      // Add many messages
      const messages = [];
      for (let i = 0; i < 50; i++) {
        messages.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message number ${i} with some content about topic ${i % 5}.`,
        });
      }

      await contextManager.addMessages(context.sessionId, messages);

      const fullContext = await contextManager.getContext(context.sessionId);
      expect(fullContext.messages.length).toBe(50);

      // Compress
      const compressionResult = await compressor.compress(fullContext.messages);
      expect(compressionResult.ratio).toBeLessThan(1.0);

      // Optimize
      const optimizationResult = await optimizer.optimize(
        fullContext.messages,
        'topic 3'
      );
      expect(optimizationResult.included.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Cross-Session Integration', () => {
    test('should link related sessions', async () => {
      // Create first session
      const context1 = await contextManager.createContext('user-link1');
      await contextManager.addMessages(context1.sessionId, [
        { role: 'user', content: 'Let discuss machine learning' },
        {
          role: 'assistant',
          content: 'Sure! What would you like to know?',
        },
      ]);

      const session1 = await sessionManager.createSession(context1);

      // Create second session
      const context2 = await contextManager.createContext('user-link2');
      await contextManager.addMessages(context2.sessionId, [
        { role: 'user', content: 'Continue our ML discussion' },
        {
          role: 'assistant',
          content: 'Let me recall what we discussed.',
        },
      ]);

      const session2 = await sessionManager.createSession(context2);

      // Link sessions
      await sessionManager.linkSessions(
        session1.id,
        session2.id,
        'followup',
        0.8
      );

      // Get linked sessions
      const linked = await sessionManager.getLinkedSessions(session1.id);

      expect(linked).toHaveLength(1);
      expect(linked[0].id).toBe(session2.id);
    });

    test('should share sessions between users', async () => {
      const context = await contextManager.createContext('owner-user');
      const session = await sessionManager.createSession(context);

      // Share with another user
      await sessionManager.shareSession(
        session.id,
        ['shared-user1', 'shared-user2'],
        'read'
      );

      const updatedSession = await sessionManager.getSession(session.id);

      expect(updatedSession.metadata.sharedWith).toContain('shared-user1');
      expect(updatedSession.metadata.sharedWith).toContain('shared-user2');
    });
  });

  describe('Performance Tests', () => {
    test('should handle rapid message additions', async () => {
      const context = await contextManager.createContext('user-perf');

      const startTime = Date.now();

      // Add 100 messages rapidly
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          contextManager.addMessage(context.sessionId, {
            role: 'user',
            content: `Message ${i}`,
          })
        );
      }

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000);

      const finalContext = await contextManager.getContext(context.sessionId);
      expect(finalContext.messages.length).toBe(100);
    });

    test('should retrieve context quickly', async () => {
      const context = await contextManager.createContext('user-retrieve');

      // Add some messages
      for (let i = 0; i < 10; i++) {
        await contextManager.addMessage(context.sessionId, {
          role: 'user',
          content: `Message ${i}`,
        });
      }

      const startTime = Date.now();

      // Perform 100 retrievals
      for (let i = 0; i < 100; i++) {
        await contextManager.getContext(context.sessionId);
      }

      const endTime = Date.now();
      const avgTime = (endTime - startTime) / 100;

      // Average retrieval should be fast
      expect(avgTime).toBeLessThan(10);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid session ID gracefully', async () => {
      await expect(
        contextManager.getContext('invalid-session-id')
      ).rejects.toThrow();

      await expect(
        sessionManager.getSession('invalid-session-id')
      ).rejects.toThrow();
    });

    test('should handle token limit exceeded', async () => {
      const smallContextManager = new ContextManager({
        maxTokens: 100,
        reservedTokens: 10,
        compressionEnabled: false,
      });

      const context = await smallContextManager.createContext('user-limit');

      // Add message that exceeds limit
      await expect(
        smallContextManager.addMessage(context.sessionId, {
          role: 'user',
          content: 'A'.repeat(1000),
        })
      ).rejects.toThrow();
    });
  });

  describe('Cleanup', () => {
    test('should clean up all resources', async () => {
      // Create resources
      await contextManager.createContext('user-cleanup1');
      await contextManager.createContext('user-cleanup2');
      await memoryStore.createEpisodicMemory('Test', Date.now());
      await ragEngine.addDocument('Test document', { source: 'test' });

      // Clear all
      await contextManager.clearAll();
      await memoryStore.clearAll();
      await ragEngine.clearAll();
      await sessionManager.clearAll();

      // Verify cleanup
      expect(contextManager.getCount()).toBe(0);
      expect(memoryStore.getTotalMemoryCount()).toBe(0);
      expect(ragEngine.getStats().documentCount).toBe(0);
    });
  });
});
