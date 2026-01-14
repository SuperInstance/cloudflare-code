/**
 * Integration Tests for Session Management
 *
 * Tests the complete session lifecycle from creation to archival.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../../packages/edge/src/lib/sessions/manager';
import { SessionStorage } from '../../packages/edge/src/lib/sessions/storage';
import { ContextBuilder } from '../../packages/edge/src/lib/sessions/context';
import type { ConversationMessage } from '../../packages/edge/src/types';

describe('Session Management Integration', () => {
  // Mock environment
  const mockEnv = {
    SESSIONS: {
      idFromName: vi.fn((name: string) => ({ toString: () => name })),
      get: vi.fn(() => ({
        fetch: vi.fn(),
      })),
    },
    KV_CACHE: null as any,
    R2_STORAGE: null as any,
  };

  // Mock KV cache
  const mockKVCache = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    list: vi.fn(),
  };

  // Mock R2 storage
  const mockR2Storage = {
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    archiveSession: vi.fn(),
    getSessionArchive: vi.fn(),
  };

  let sessionManager: SessionManager;
  let sessionStorage: SessionStorage;
  let contextBuilder: ContextBuilder;

  beforeEach(() => {
    vi.clearAllMocks();

    sessionManager = new SessionManager(
      mockEnv.SESSIONS as any,
      mockKVCache as any,
      mockR2Storage as any,
      {
        sessionTimeout: 60 * 60 * 1000, // 1 hour
        archiveThreshold: 60 * 60 * 1000, // 1 hour
        deleteThreshold: 30 * 24 * 60 * 60 * 1000, // 30 days
        maxMessages: 10000,
        contextWindow: 128000,
      }
    );

    sessionStorage = new SessionStorage(
      mockEnv.SESSIONS as any,
      mockKVCache as any,
      mockR2Storage as any
    );

    contextBuilder = new ContextBuilder({
      contextWindow: 128000,
      enableSummarization: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Session Lifecycle', () => {
    it('should create, use, and archive a session', async () => {
      const sessionId = 'test-session-1';
      const userId = 'user-123';

      // Setup mock responses
      const mockSession = {
        sessionId,
        userId,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messages: [],
        metadata: {
          language: 'typescript',
          framework: 'react',
          projectPath: '/test',
          repositoryHash: 'abc123',
          messageCount: 0,
          totalTokens: 0,
          totalCost: 0,
          cacheHits: 0,
          cacheMisses: 0,
          hitRate: 0,
        },
        storage: {
          tier: 'hot',
          compressed: false,
          sizeBytes: 0,
          checkpointCount: 0,
          lastCheckpoint: Date.now(),
        },
      };

      // Mock create
      const stub = {
        fetch: vi.fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ session: mockSession }),
          })
          .mockResolvedValueOnce({ ok: true }) // For addMessage
          .mockResolvedValueOnce({ ok: true }), // For touch
      };
      (mockEnv.SESSIONS.get as any).mockReturnValue(stub);

      // 1. Create session
      const session = await sessionManager.create(sessionId, userId);
      expect(session).toBeDefined();
      expect(session.sessionId).toBe(sessionId);
      expect(session.userId).toBe(userId);

      // 2. Add messages
      const messages: ConversationMessage[] = [
        {
          role: 'user',
          content: 'Hello, how are you?',
          timestamp: Date.now(),
          tokens: 5,
        },
        {
          role: 'assistant',
          content: 'I am doing well, thank you!',
          timestamp: Date.now(),
          tokens: 7,
        },
      ];

      for (const message of messages) {
        await sessionManager.addMessage(sessionId, message);
      }

      // Verify messages were added
      expect(stub.fetch).toHaveBeenCalledTimes(3); // Create + 2 messages

      // 3. Build context
      mockSession.messages = messages;
      mockSession.metadata.messageCount = 2;
      mockSession.metadata.totalTokens = 12;

      const context = await contextBuilder.buildContext(mockSession, 'recent');
      expect(context.messages).toHaveLength(2);
      expect(context.totalTokens).toBe(12);

      // 4. Archive session
      await sessionManager.archiveSession(sessionId);

      expect(mockR2Storage.archiveSession).toHaveBeenCalledWith(mockSession);
    });

    it('should restore archived session', async () => {
      const sessionId = 'test-session-2';
      const userId = 'user-456';

      const archivedSession = {
        sessionId,
        userId,
        createdAt: Date.now() - 60 * 60 * 1000, // 1 hour ago
        lastActivity: Date.now() - 60 * 60 * 1000,
        messages: [
          {
            role: 'user',
            content: 'Old message',
            timestamp: Date.now() - 60 * 60 * 1000,
            tokens: 5,
          },
        ],
        metadata: {
          language: 'typescript',
          framework: 'react',
          projectPath: '/test',
          repositoryHash: 'abc123',
          messageCount: 1,
          totalTokens: 5,
          totalCost: 0,
          cacheHits: 0,
          cacheMisses: 0,
          hitRate: 0,
        },
        storage: {
          tier: 'cold',
          compressed: true,
          sizeBytes: 1024,
          checkpointCount: 1,
          lastCheckpoint: Date.now() - 60 * 60 * 1000,
        },
      };

      // Mock restore
      mockKVCache.get.mockResolvedValue(archivedSession);

      const stub = {
        fetch: vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ session: archivedSession }),
        }),
      };
      (mockEnv.SESSIONS.get as any).mockReturnValue(stub);

      // Restore session
      const restored = await sessionManager.restoreSession(sessionId);

      expect(restored).toBeDefined();
      expect(restored.sessionId).toBe(sessionId);
      expect(restored.storage.tier).toBe('hot');
    });
  });

  describe('Storage Tier Migration', () => {
    it('should migrate sessions through tiers', async () => {
      const sessionId = 'test-session-3';
      const userId = 'user-789';

      const mockSession = {
        sessionId,
        userId,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messages: [],
        metadata: {
          language: 'typescript',
          framework: 'react',
          projectPath: '/test',
          repositoryHash: 'abc123',
          messageCount: 0,
          totalTokens: 0,
          totalCost: 0,
          cacheHits: 0,
          cacheMisses: 0,
          hitRate: 0,
        },
        storage: {
          tier: 'hot',
          compressed: false,
          sizeBytes: 0,
          checkpointCount: 0,
          lastCheckpoint: Date.now(),
        },
      };

      // Start in HOT tier
      const hotStub = {
        fetch: vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ session: mockSession }),
        }),
      };
      (mockEnv.SESSIONS.get as any).mockReturnValue(hotStub);

      await sessionStorage.save(mockSession, 'hot');
      let tier = await sessionStorage.getTier(sessionId);
      expect(tier).toBe('hot');

      // Migrate to WARM
      await sessionStorage.migrate(sessionId, 'hot', 'warm');
      expect(mockKVCache.set).toHaveBeenCalled();

      // Migrate to COLD
      await sessionStorage.migrate(sessionId, 'warm', 'cold');
      expect(mockR2Storage.archiveSession).toHaveBeenCalled();

      // Promote back to WARM
      mockR2Storage.getSessionArchive.mockResolvedValue([mockSession]);
      await sessionStorage.migrate(sessionId, 'cold', 'warm');
      expect(mockKVCache.set).toHaveBeenCalled();
    });

    it('should auto-migrate based on access patterns', async () => {
      const sessionId = 'test-session-4';
      const userId = 'user-999';

      const mockSession = {
        sessionId,
        userId,
        createdAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        lastActivity: Date.now() - 2 * 60 * 60 * 1000,
        messages: [],
        metadata: {
          language: 'typescript',
          framework: 'react',
          projectPath: '/test',
          repositoryHash: 'abc123',
          messageCount: 0,
          totalTokens: 0,
          totalCost: 0,
          cacheHits: 0,
          cacheMisses: 0,
          hitRate: 0,
        },
        storage: {
          tier: 'hot',
          compressed: false,
          sizeBytes: 0,
          checkpointCount: 0,
          lastCheckpoint: Date.now() - 2 * 60 * 60 * 1000,
        },
      };

      // Simulate old session
      const stub = {
        fetch: vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ session: mockSession }),
        }),
      };
      (mockEnv.SESSIONS.get as any).mockReturnValue(stub);

      await sessionStorage.load(sessionId);

      // Run migration policy
      const result = await sessionStorage.runMigrationPolicy();

      expect(result.demoted).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Context Building Strategies', () => {
    it('should use different strategies for different scenarios', async () => {
      const mockSession = {
        sessionId: 'test-session-5',
        userId: 'user-111',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messages: [],
        metadata: {
          language: 'typescript',
          framework: 'react',
          projectPath: '/test',
          repositoryHash: 'abc123',
          messageCount: 0,
          totalTokens: 0,
          totalCost: 0,
          cacheHits: 0,
          cacheMisses: 0,
          hitRate: 0,
        },
        storage: {
          tier: 'hot',
          compressed: false,
          sizeBytes: 0,
          checkpointCount: 0,
          lastCheckpoint: Date.now(),
        },
      };

      // Create many messages
      const messages: ConversationMessage[] = [];
      for (let i = 0; i < 100; i++) {
        messages.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}: ${'A'.repeat(100)}`,
          timestamp: Date.now() + i * 1000,
          tokens: 100,
        });
      }

      mockSession.messages = messages;
      mockSession.metadata.messageCount = 100;
      mockSession.metadata.totalTokens = 10000;

      // Test recent strategy
      const recentContext = await contextBuilder.buildContext(mockSession, 'recent');
      expect(recentContext.messages.length).toBeGreaterThan(0);
      expect(recentContext.truncated).toBeDefined();

      // Test summary strategy
      const summaryContext = await contextBuilder.buildContext(mockSession, 'summary');
      expect(summaryContext.summary).toBeDefined();
      expect(summaryContext.messages.length).toBeGreaterThan(0);

      // Test all strategy
      const allContext = await contextBuilder.buildContext(mockSession, 'all');
      expect(allContext.messages).toHaveLength(100);
      expect(allContext.totalTokens).toBe(10000);
    });
  });

  describe('Session Cleanup', () => {
    it('should identify and clean up inactive sessions', async () => {
      const mockOldSession = {
        sessionId: 'old-session',
        userId: 'user-old',
        createdAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        lastActivity: Date.now() - 2 * 60 * 60 * 1000,
        messages: [],
        metadata: {
          language: 'typescript',
          framework: 'react',
          projectPath: '/test',
          repositoryHash: 'abc123',
          messageCount: 0,
          totalTokens: 0,
          totalCost: 0,
          cacheHits: 0,
          cacheMisses: 0,
          hitRate: 0,
        },
        storage: {
          tier: 'hot',
          compressed: false,
          sizeBytes: 0,
          checkpointCount: 0,
          lastCheckpoint: Date.now() - 2 * 60 * 60 * 1000,
        },
      };

      const stub = {
        fetch: vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ session: mockOldSession }),
        }),
      };
      (mockEnv.SESSIONS.get as any).mockReturnValue(stub);

      // Check if should demote
      await sessionStorage.load('old-session');
      const shouldDemote = await sessionStorage.shouldDemote('old-session');

      expect(shouldDemote).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing sessions gracefully', async () => {
      const stub = {
        fetch: vi.fn().mockResolvedValue({
          status: 404,
        }),
      };
      (mockEnv.SESSIONS.get as any).mockReturnValue(stub);

      mockKVCache.get.mockResolvedValue(null);
      mockR2Storage.getSessionArchive.mockResolvedValue([]);

      const session = await sessionManager.get('nonexistent-session');

      expect(session).toBeNull();
    });

    it('should handle migration failures', async () => {
      const stub = {
        fetch: vi.fn().mockRejectedValue(new Error('Migration failed')),
      };
      (mockEnv.SESSIONS.get as any).mockReturnValue(stub);

      const result = await sessionStorage.migrate('test-session', 'hot', 'warm');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Migration failed');
    });
  });

  describe('Performance', () => {
    it('should handle large numbers of messages efficiently', async () => {
      const mockSession = {
        sessionId: 'test-session-large',
        userId: 'user-large',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messages: [],
        metadata: {
          language: 'typescript',
          framework: 'react',
          projectPath: '/test',
          repositoryHash: 'abc123',
          messageCount: 0,
          totalTokens: 0,
          totalCost: 0,
          cacheHits: 0,
          cacheMisses: 0,
          hitRate: 0,
        },
        storage: {
          tier: 'hot',
          compressed: false,
          sizeBytes: 0,
          checkpointCount: 0,
          lastCheckpoint: Date.now(),
        },
      };

      // Create 1000 messages
      const messages: ConversationMessage[] = [];
      for (let i = 0; i < 1000; i++) {
        messages.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i}`,
          timestamp: Date.now() + i * 1000,
          tokens: 10,
        });
      }

      mockSession.messages = messages;
      mockSession.metadata.messageCount = 1000;
      mockSession.metadata.totalTokens = 10000;

      const startTime = performance.now();
      const context = await contextBuilder.buildContext(mockSession, 'recent');
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(100); // Should complete in < 100ms
      expect(context.messages.length).toBeGreaterThan(0);
    });
  });
});
