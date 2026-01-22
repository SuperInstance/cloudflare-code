/**
 * Unit tests for Memory Store
 */

import { MemoryStore } from '../../src/memory/store';
import {
  Memory,
  MemoryType,
  Fact,
  ProcedureStep,
  MemoryStoreConfig,
} from '../../src/types';

describe('MemoryStore', () => {
  let store: MemoryStore;
  let config: Partial<MemoryStoreConfig>;

  beforeEach(() => {
    config = {
      maxSize: 100,
      consolidationThreshold: 10,
      forgettingEnabled: true,
      forgettingRate: 0.01,
    };
    store = new MemoryStore(config);
  });

  describe('Episodic Memory', () => {
    test('should create episodic memory', async () => {
      const memory = await store.createEpisodicMemory(
        'Had a conversation about AI',
        Date.now(),
        {
          userId: 'user123',
          participants: ['user123', 'assistant'],
          emotions: ['curious', 'engaged'],
        }
      );

      expect(memory.id).toBeDefined();
      expect(memory.type).toBe('episodic');
      expect(memory.content).toBe('Had a conversation about AI');
      expect(memory.timestamp).toBeDefined();
      expect(memory.metadata.userId).toBe('user123');
    });

    test('should retrieve episodic memories for user', async () => {
      await store.createEpisodicMemory('Memory 1', Date.now() - 1000, {
        userId: 'user1',
      });
      await store.createEpisodicMemory('Memory 2', Date.now() - 500, {
        userId: 'user1',
      });
      await store.createEpisodicMemory('Memory 3', Date.now(), {
        userId: 'user2',
      });

      const user1Memories = await store.getEpisodicMemories('user1');

      expect(user1Memories).toHaveLength(2);
      expect(user1Memories.every(m => m.metadata.userId === 'user1')).toBe(true);
    });

    test('should sort episodic memories by timestamp', async () => {
      const now = Date.now();
      await store.createEpisodicMemory('First', now - 3000, { userId: 'user' });
      await store.createEpisodicMemory('Second', now - 2000, { userId: 'user' });
      await store.createEpisodicMemory('Third', now - 1000, { userId: 'user' });

      const memories = await store.getEpisodicMemories('user');

      expect(memories[0].content).toBe('Third');
      expect(memories[1].content).toBe('Second');
      expect(memories[2].content).toBe('First');
    });

    test('should limit episodic memory retrieval', async () => {
      for (let i = 0; i < 20; i++) {
        await store.createEpisodicMemory(`Memory ${i}`, Date.now(), {
          userId: 'user',
        });
      }

      const memories = await store.getEpisodicMemories('user', 5);

      expect(memories).toHaveLength(5);
    });
  });

  describe('Semantic Memory', () => {
    test('should create semantic memory', async () => {
      const facts: Fact[] = [
        {
          id: 'f1',
          statement: 'Paris is the capital of France',
          confidence: 1.0,
        },
        {
          id: 'f2',
          statement: 'The Eiffel Tower is in Paris',
          confidence: 1.0,
        },
      ];

      const memory = await store.createSemanticMemory(
        'Geographic knowledge about Paris',
        facts,
        [],
        {
          userId: 'user456',
          categories: ['geography', 'europe'],
        }
      );

      expect(memory.type).toBe('semantic');
      expect(memory.facts).toHaveLength(2);
      expect(memory.metadata.categories).toContain('geography');
    });

    test('should retrieve semantic memories by category', async () => {
      const facts: Fact[] = [
        { id: 'f1', statement: 'Fact 1', confidence: 1.0 },
      ];

      await store.createSemanticMemory('Memory 1', facts, [], {
        categories: ['science'],
      });
      await store.createSemanticMemory('Memory 2', facts, [], {
        categories: ['history'],
      });
      await store.createSemanticMemory('Memory 3', facts, [], {
        categories: ['science'],
      });

      const scienceMemories = await store.getSemanticMemories('science');

      expect(scienceMemories).toHaveLength(2);
      expect(scienceMemories.every(m => m.metadata.categories?.includes('science'))).toBe(true);
    });

    test('should sort semantic memories by importance', async () => {
      const facts: Fact[] = [{ id: 'f1', statement: 'Fact', confidence: 1.0 }];

      await store.createSemanticMemory('Low importance', facts, [], {
        importance: 0.3,
      });
      await store.createSemanticMemory('High importance', facts, [], {
        importance: 0.9,
      });
      await store.createSemanticMemory('Medium importance', facts, [], {
        importance: 0.6,
      });

      const memories = await store.getSemanticMemories('category');

      expect(memories[0].content).toBe('High importance');
      expect(memories[1].content).toBe('Medium importance');
      expect(memories[2].content).toBe('Low importance');
    });
  });

  describe('Procedural Memory', () => {
    test('should create procedural memory', async () => {
      const steps: ProcedureStep[] = [
        { order: 1, action: 'Open terminal' },
        { order: 2, action: 'Run npm install' },
        { order: 3, action: 'Start development server' },
      ];

      const memory = await store.createProceduralMemory(
        'How to start a development project',
        steps,
        ['development', 'npm', 'setup'],
        ['Project is ready']
      );

      expect(memory.type).toBe('semantic_procedural');
      expect(memory.steps).toHaveLength(3);
      expect(memory.triggers).toContain('development');
      expect(memory.outcomes).toContain('Project is ready');
    });

    test('should retrieve procedural memories by trigger', async () => {
      const steps: ProcedureStep[] = [
        { order: 1, action: 'Step 1' },
      ];

      await store.createProceduralMemory('Proc 1', steps, ['trigger-a']);
      await store.createProceduralMemory('Proc 2', steps, ['trigger-b']);
      await store.createProceduralMemory('Proc 3', steps, ['trigger-a']);

      const memories = await store.getProceduralMemories('trigger-a');

      expect(memories).toHaveLength(2);
    });

    test('should sort procedural memories by strength', async () => {
      const steps: ProcedureStep[] = [{ order: 1, action: 'Step' }];

      const m1 = await store.createProceduralMemory('Weak', steps, ['test']);
      const m2 = await store.createProceduralMemory('Strong', steps, ['test']);

      await store.strengthenMemory(m2.id, 0.3);
      await store.weakenMemory(m1.id, 0.2);

      const memories = await store.getProceduralMemories('test');

      expect(memories[0].id).toBe(m2.id);
      expect(memories[1].id).toBe(m1.id);
    });
  });

  describe('Working Memory', () => {
    test('should create working memory', async () => {
      const memory = await store.createWorkingMemory(
        'session123',
        'Temporary context information',
        60000,
        50
      );

      expect(memory.type).toBe('working');
      expect(memory.content).toBe('Temporary context information');
      expect(memory.ttl).toBe(60000);
      expect(memory.capacity).toBe(50);
      expect(memory.currentSize).toBe(1);
    });

    test('should retrieve working memory for session', async () => {
      await store.createWorkingMemory('session1', 'Data 1');
      await store.createWorkingMemory('session2', 'Data 2');

      const mem1 = await store.getWorkingMemory('session1');
      const mem2 = await store.getWorkingMemory('session2');

      expect(mem1?.content).toBe('Data 1');
      expect(mem2?.content).toBe('Data 2');
    });

    test('should return null for non-existent working memory', async () => {
      const memory = await store.getWorkingMemory('non-existent');

      expect(memory).toBeNull();
    });
  });

  describe('Memory Retrieval', () => {
    beforeEach(async () => {
      // Create test memories with embeddings
      await store.createEpisodicMemory('AI and machine learning discussion', Date.now(), {
        userId: 'user1',
      });
      await store.createEpisodicMemory('Weather conversation', Date.now(), {
        userId: 'user1',
      });
      await store.createSemanticMemory('Python programming facts', [], [], {
        categories: ['programming'],
      });
    });

    test('should get memory by ID', async () => {
      const memory = await store.createEpisodicMemory('Test', Date.now());
      const retrieved = await store.getMemory(memory.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(memory.id);
      expect(retrieved?.content).toBe('Test');
    });

    test('should return null for non-existent memory', async () => {
      const memory = await store.getMemory('invalid-id');

      expect(memory).toBeNull();
    });

    test('should get multiple memories by IDs', async () => {
      const m1 = await store.createEpisodicMemory('M1', Date.now());
      const m2 = await store.createEpisodicMemory('M2', Date.now());
      const m3 = await store.createEpisodicMemory('M3', Date.now());

      const memories = await store.getMemories([m1.id, m2.id, m3.id]);

      expect(memories).toHaveLength(3);
    });

    test('should perform semantic search', async () => {
      const queryEmbedding = new Array(1536).fill(0.1);

      const results = await store.semanticSearch(
        'machine learning',
        queryEmbedding,
        5,
        0.5
      );

      expect(Array.isArray(results)).toBe(true);
    });

    test('should perform keyword search', async () => {
      const results = await store.keywordSearch('conversation', 10);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    test('should perform hybrid search', async () => {
      const queryEmbedding = new Array(1536).fill(0.1);

      const results = await store.hybridSearch(
        'AI discussion',
        queryEmbedding,
        5,
        0.7
      );

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Memory Updates', () => {
    test('should update memory content', async () => {
      const memory = await store.createEpisodicMemory('Original', Date.now());

      const updated = await store.updateMemory(memory.id, {
        content: 'Updated content',
      });

      expect(updated.content).toBe('Updated content');
      expect(updated.updatedAt).toBeGreaterThan(memory.createdAt);
    });

    test('should update memory importance', async () => {
      const memory = await store.createEpisodicMemory('Test', Date.now());

      await store.updateImportance(memory.id, 0.9);

      const retrieved = await store.getMemory(memory.id);
      expect(retrieved?.importance).toBe(0.9);
    });

    test('should clamp importance to valid range', async () => {
      const memory = await store.createEpisodicMemory('Test', Date.now());

      await store.updateImportance(memory.id, 1.5);
      let retrieved = await store.getMemory(memory.id);
      expect(retrieved?.importance).toBe(1.0);

      await store.updateImportance(memory.id, -0.5);
      retrieved = await store.getMemory(memory.id);
      expect(retrieved?.importance).toBe(0.0);
    });

    test('should strengthen memory', async () => {
      const memory = await store.createEpisodicMemory('Test', Date.now());
      const originalStrength = memory.strength;

      await store.strengthenMemory(memory.id, 0.2);

      const retrieved = await store.getMemory(memory.id);
      expect(retrieved?.strength).toBeCloseTo(originalStrength + 0.2, 1);
    });

    test('should clamp strength to maximum', async () => {
      const memory = await store.createEpisodicMemory('Test', Date.now());

      await store.strengthenMemory(memory.id, 0.5);

      const retrieved = await store.getMemory(memory.id);
      expect(retrieved?.strength).toBeLessThanOrEqual(1.0);
    });

    test('should weaken memory', async () => {
      const memory = await store.createEpisodicMemory('Test', Date.now());
      const originalStrength = memory.strength;

      await store.weakenMemory(memory.id, 0.1);

      const retrieved = await store.getMemory(memory.id);
      expect(retrieved?.strength).toBeLessThan(originalStrength);
    });

    test('should delete memory when strength reaches zero', async () => {
      const memory = await store.createEpisodicMemory('Test', Date.now());

      // Weaken multiple times to reach zero
      for (let i = 0; i < 20; i++) {
        await store.weakenMemory(memory.id, 0.1);
      }

      const retrieved = await store.getMemory(memory.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Memory Deletion', () => {
    test('should delete memory', async () => {
      const memory = await store.createEpisodicMemory('To delete', Date.now());

      await store.deleteMemory(memory.id);

      const retrieved = await store.getMemory(memory.id);
      expect(retrieved).toBeNull();
    });

    test('should handle deleting non-existent memory', async () => {
      await expect(store.deleteMemory('invalid-id')).resolves.not.toThrow();
    });

    test('should forget memory gradually', async () => {
      const memory = await store.createEpisodicMemory('To forget', Date.now());

      await store.forgetMemory(memory.id);

      const retrieved = await store.getMemory(memory.id);
      expect(retrieved?.strength).toBeLessThan(1.0);
    });
  });

  describe('Memory Consolidation', () => {
    test('should consolidate memories', async () => {
      // Create similar memories
      await store.createEpisodicMemory('Similar content 1', Date.now(), {
        userId: 'user1',
      });
      await store.createEpisodicMemory('Similar content 2', Date.now(), {
        userId: 'user1',
      });
      await store.createEpisodicMemory('Different content', Date.now(), {
        userId: 'user2',
      });

      const result = await store.consolidateMemories();

      expect(result.memories).toBeDefined();
      expect(result.consolidated).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('Memory Statistics', () => {
    beforeEach(async () => {
      await store.createEpisodicMemory('E1', Date.now());
      await store.createEpisodicMemory('E2', Date.now());
      await store.createSemanticMemory('S1', [], [], {
        categories: ['test'],
      });
      await store.createProceduralMemory('P1', [], ['test']);
      await store.createWorkingMemory('session', 'W1');
    });

    test('should get memory count by type', () => {
      const counts = store.getMemoryCountByType();

      expect(counts.episodic).toBe(2);
      expect(counts.semantic).toBe(1);
      expect(counts.semantic_procedural).toBe(1);
      expect(counts.working).toBe(1);
    });

    test('should get total memory count', () => {
      const total = store.getTotalMemoryCount();

      expect(total).toBe(5);
    });

    test('should get memory statistics', () => {
      const stats = store.getMemoryStats();

      expect(stats.total).toBe(5);
      expect(stats.byType).toBeDefined();
      expect(stats.avgImportance).toBeGreaterThanOrEqual(0);
      expect(stats.avgImportance).toBeLessThanOrEqual(1);
      expect(stats.avgStrength).toBeGreaterThanOrEqual(0);
      expect(stats.avgStrength).toBeLessThanOrEqual(1);
      expect(stats.totalAccesses).toBeGreaterThanOrEqual(0);
    });

    test('should get most accessed memories', async () => {
      const m1 = await store.createEpisodicMemory('M1', Date.now());
      const m2 = await store.createEpisodicMemory('M2', Date.now());

      // Access m1 multiple times
      await store.getMemory(m1.id);
      await store.getMemory(m1.id);
      await store.getMemory(m1.id);
      await store.getMemory(m2.id);

      const mostAccessed = store.getMostAccessedMemories(2);

      expect(mostAccessed[0].id).toBe(m1.id);
    });

    test('should get strongest memories', async () => {
      const m1 = await store.createEpisodicMemory('M1', Date.now());
      const m2 = await store.createEpisodicMemory('M2', Date.now());

      await store.strengthenMemory(m1.id, 0.3);

      const strongest = store.getStrongestMemories(2);

      expect(strongest[0].id).toBe(m1.id);
    });
  });

  describe('Utility Methods', () => {
    test('should clear all memories', async () => {
      await store.createEpisodicMemory('M1', Date.now());
      await store.createEpisodicMemory('M2', Date.now());

      await store.clearAll();

      expect(store.getTotalMemoryCount()).toBe(0);
    });
  });
});
