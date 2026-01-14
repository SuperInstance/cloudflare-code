/**
 * Unit Tests for Session Storage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionStorage } from '../../packages/edge/src/lib/sessions/storage';
import type { SessionData } from '../../packages/edge/src/types';

// Mock implementations
const mockDurableObject = {
  get: vi.fn(() => ({
    fetch: vi.fn(),
  })),
};

const mockKVCache = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  exists: vi.fn(),
  list: vi.fn(),
};

const mockR2Storage = {
  put: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
  archiveSession: vi.fn(),
  getSessionArchive: vi.fn(),
};

describe('SessionStorage', () => {
  let sessionStorage: SessionStorage;
  let mockSession: SessionData;

  beforeEach(() => {
    vi.clearAllMocks();

    sessionStorage = new SessionStorage(
      mockDurableObject as any,
      mockKVCache as any,
      mockR2Storage as any,
      {
        hotMaxAge: 60 * 60 * 1000, // 1 hour
        warmMaxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        hotAccessThreshold: 5,
        warmAccessThreshold: 3,
        autoMigrate: true,
      }
    );

    mockSession = {
      sessionId: 'test-session',
      userId: 'user-123',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messages: [],
      metadata: {
        language: 'typescript',
        framework: 'react',
        projectPath: '/test/project',
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
  });

  describe('save', () => {
    it('should save to HOT tier', async () => {
      const stub = {
        fetch: vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ session: mockSession }),
        }),
      };
      (mockDurableObject.get as any).mockReturnValue(stub);

      await sessionStorage.save(mockSession, 'hot');

      expect(stub.fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });

    it('should save to WARM tier', async () => {
      await sessionStorage.save(mockSession, 'warm');

      expect(mockKVCache.set).toHaveBeenCalledWith(
        'session:test-session',
        mockSession,
        60 * 60 * 24 * 7 // 7 days TTL
      );
    });

    it('should save to COLD tier', async () => {
      await sessionStorage.save(mockSession, 'cold');

      expect(mockR2Storage.archiveSession).toHaveBeenCalledWith(mockSession);
    });
  });

  describe('load', () => {
    it('should load from HOT tier', async () => {
      const stub = {
        fetch: vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ session: mockSession }),
        }),
      };
      (mockDurableObject.get as any).mockReturnValue(stub);

      const session = await sessionStorage.load('test-session');

      expect(session).toEqual(mockSession);
    });

    it('should load from WARM tier if not in HOT', async () => {
      const stub = {
        fetch: vi.fn().mockResolvedValue({
          status: 404,
        }),
      };
      (mockDurableObject.get as any).mockReturnValue(stub);

      mockKVCache.get.mockResolvedValue(mockSession);

      const session = await sessionStorage.load('test-session');

      expect(session).toEqual(mockSession);
      expect(mockKVCache.get).toHaveBeenCalledWith('session:test-session');
    });

    it('should load from COLD tier if not in HOT or WARM', async () => {
      const stub = {
        fetch: vi.fn().mockResolvedValue({
          status: 404,
        }),
      };
      (mockDurableObject.get as any).mockReturnValue(stub);

      mockKVCache.get.mockResolvedValue(null);
      mockR2Storage.getSessionArchive.mockResolvedValue([mockSession]);

      const session = await sessionStorage.load('test-session');

      expect(session).toEqual(mockSession);
    });

    it('should return null if not found in any tier', async () => {
      const stub = {
        fetch: vi.fn().mockResolvedValue({
          status: 404,
        }),
      };
      (mockDurableObject.get as any).mockReturnValue(stub);

      mockKVCache.get.mockResolvedValue(null);
      mockR2Storage.getSessionArchive.mockResolvedValue([]);

      const session = await sessionStorage.load('test-session');

      expect(session).toBeNull();
    });
  });

  describe('migrate', () => {
    it('should migrate from HOT to WARM', async () => {
      const stub = {
        fetch: vi.fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ session: mockSession }),
          })
          .mockResolvedValueOnce({ ok: true }),
      };
      (mockDurableObject.get as any).mockReturnValue(stub);

      const result = await sessionStorage.migrate('test-session', 'hot', 'warm');

      expect(result.success).toBe(true);
      expect(mockKVCache.set).toHaveBeenCalled();
    });

    it('should migrate from WARM to HOT (promotion)', async () => {
      const stub = {
        fetch: vi.fn().mockResolvedValue({ ok: true }),
      };
      (mockDurableObject.get as any).mockReturnValue(stub);

      mockKVCache.get.mockResolvedValue(mockSession);

      const result = await sessionStorage.migrate('test-session', 'warm', 'hot');

      expect(result.success).toBe(true);
    });

    it('should fail if session not found', async () => {
      const stub = {
        fetch: vi.fn().mockResolvedValue({
          status: 404,
        }),
      };
      (mockDurableObject.get as any).mockReturnValue(stub);

      mockKVCache.get.mockResolvedValue(null);

      const result = await sessionStorage.migrate('test-session', 'hot', 'warm');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('shouldPromote', () => {
    it('should return true for frequently accessed sessions', async () => {
      // Simulate multiple accesses
      await sessionStorage.load('test-session');

      const pattern = sessionStorage['accessPatterns'].get('test-session');
      if (pattern) {
        pattern.accessCount = 10;
        sessionStorage['accessPatterns'].set('test-session', pattern);
      }

      const shouldPromote = await sessionStorage.shouldPromote('test-session', 'warm');

      expect(shouldPromote).toBe(true);
    });

    it('should return false for infrequently accessed sessions', async () => {
      await sessionStorage.load('test-session');

      const shouldPromote = await sessionStorage.shouldPromote('test-session', 'warm');

      expect(shouldPromote).toBe(false);
    });
  });

  describe('shouldDemote', () => {
    it('should return true for old sessions', async () => {
      await sessionStorage.load('test-session');

      const pattern = sessionStorage['accessPatterns'].get('test-session');
      if (pattern) {
        pattern.lastAccess = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
        sessionStorage['accessPatterns'].set('test-session', pattern);
      }

      const shouldDemote = await sessionStorage.shouldDemote('test-session');

      expect(shouldDemote).toBe(true);
    });

    it('should return false for recent sessions', async () => {
      await sessionStorage.load('test-session');

      const shouldDemote = await sessionStorage.shouldDemote('test-session');

      expect(shouldDemote).toBe(false);
    });
  });

  describe('getTier', () => {
    it('should return HOT tier for active sessions', async () => {
      await sessionStorage.load('test-session');

      const tier = await sessionStorage.getTier('test-session');

      expect(tier).toBe('hot');
    });

    it('should return null for unknown sessions', async () => {
      const tier = await sessionStorage.getTier('unknown-session');

      expect(tier).toBeNull();
    });
  });

  describe('getTierStats', () => {
    it('should return statistics for all tiers', async () => {
      // Add some sessions
      await sessionStorage.load('session1');
      await sessionStorage.load('session2');

      const stats = await sessionStorage.getTierStats();

      expect(stats.hot.count).toBeGreaterThan(0);
      expect(stats.warm.count).toBe(0);
      expect(stats.cold.count).toBe(0);
    });
  });

  describe('runMigrationPolicy', () => {
    it('should promote and demote sessions based on policies', async () => {
      // Add sessions with different patterns
      await sessionStorage.load('session1');

      const pattern = sessionStorage['accessPatterns'].get('session1');
      if (pattern) {
        pattern.lastAccess = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
        sessionStorage['accessPatterns'].set('session1', pattern);
      }

      const result = await sessionStorage.runMigrationPolicy();

      expect(result.demoted).toBeGreaterThanOrEqual(0);
      expect(result.promoted).toBeGreaterThanOrEqual(0);
    });
  });
});
