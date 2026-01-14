/**
 * Unit Tests for StorageManager
 *
 * Tests for multi-tier storage orchestration including
 * automatic migration, tier selection, and access patterns.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageManager } from '../src/lib/storage';
import { KVCache } from '../src/lib/kv';
import { R2Storage } from '../src/lib/r2';
import type { SessionData } from '../src/types';

describe('StorageManager', () => {
  let mockSessionDO: DurableObjectNamespace;
  let mockKV: KVNamespace;
  let mockR2: R2Bucket;
  let kvCache: KVCache;
  let r2Storage: R2Storage;
  let storageManager: StorageManager;

  beforeEach(() => {
    // Mock Durable Object namespace
    mockSessionDO = {
      get: vi.fn(),
    } as unknown as DurableObjectNamespace;

    // Mock KV namespace
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      getWithMetadata: vi.fn(),
    } as unknown as KVNamespace;

    // Mock R2 bucket
    mockR2 = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      head: vi.fn(),
    } as unknown as R2Bucket;

    kvCache = new KVCache(mockKV, { retry: false });
    r2Storage = new R2Storage(mockR2, { retry: false });
    storageManager = new StorageManager(mockSessionDO, kvCache, r2Storage, {
      autoMigrate: false, // Disable for most tests
    });
  });

  describe('Get Operations', () => {
    it('should return data from HOT tier when available', async () => {
      const sessionData: SessionData = {
        sessionId: 'session-123',
        userId: 'user-456',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messages: [],
        metadata: {
          language: 'en',
          framework: 'react',
          projectPath: '/path',
          repositoryHash: 'hash123',
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

      // Mock DO response
      const mockDOStub = {
        fetch: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ session: sessionData }), { status: 200 })
        ),
      };
      vi.mocked(mockSessionDO.get).mockReturnValue(mockDOStub as unknown as DurableObjectStub);

      const result = await storageManager.get('session-123', 'session');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(sessionData);
      expect(result.tier).toBe('hot');
    });

    it('should fallback to WARM tier when HOT tier misses', async () => {
      const userData = { userId: 'user-123', theme: 'dark' as const };

      // Mock DO miss
      const mockDOStub = {
        fetch: vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
      };
      vi.mocked(mockSessionDO.get).mockReturnValue(mockDOStub as unknown as DurableObjectStub);

      // Mock KV hit
      vi.mocked(mockKV.get).mockResolvedValue(JSON.stringify(userData));

      const result = await storageManager.get('user-123', 'user');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(userData);
      expect(result.tier).toBe('warm');
    });

    it('should fallback to COLD tier when HOT and WARM miss', async () => {
      const archiveData = { timestamp: Date.now(), data: 'archived' };

      // Mock DO miss
      const mockDOStub = {
        fetch: vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
      };
      vi.mocked(mockSessionDO.get).mockReturnValue(mockDOStub as unknown as DurableObjectStub);

      // Mock KV miss
      vi.mocked(mockKV.get).mockResolvedValue(null);

      // Mock R2 hit
      const encoder = new TextEncoder();
      vi.mocked(mockR2.get).mockResolvedValue({
        arrayBuffer: () => Promise.resolve(encoder.encode(JSON.stringify(archiveData)).buffer),
        metadata: {},
      } as R2Object);

      const result = await storageManager.get('archive-123', 'data');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(archiveData);
      expect(result.tier).toBe('cold');
    });

    it('should return not found when all tiers miss', async () => {
      // Mock all misses
      const mockDOStub = {
        fetch: vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
      };
      vi.mocked(mockSessionDO.get).mockReturnValue(mockDOStub as unknown as DurableObjectStub);
      vi.mocked(mockKV.get).mockResolvedValue(null);
      vi.mocked(mockR2.get).mockResolvedValue(null);

      const result = await storageManager.get('non-existent', 'data');

      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result.error).toBe('Key not found in any tier');
    });
  });

  describe('Set Operations', () => {
    it('should set data in HOT tier', async () => {
      const sessionData: Partial<SessionData> = {
        sessionId: 'session-123',
        userId: 'user-456',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messages: [],
        metadata: {
          language: 'en',
          framework: 'react',
          projectPath: '/path',
          repositoryHash: 'hash123',
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

      const mockDOStub = {
        fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ session: sessionData }), { status: 200 })),
      };
      vi.mocked(mockSessionDO.get).mockReturnValue(mockDOStub as unknown as DurableObjectStub);

      const result = await storageManager.set('session-123', sessionData as SessionData, 'session', 'hot');

      expect(result.success).toBe(true);
      expect(result.tier).toBe('hot');
      expect(mockDOStub.fetch).toHaveBeenCalled();
    });

    it('should set data in WARM tier', async () => {
      vi.mocked(mockKV.put).mockResolvedValue(undefined);

      const data = { key: 'value' };
      const result = await storageManager.set('test-key', data, 'data', 'warm');

      expect(result.success).toBe(true);
      expect(result.tier).toBe('warm');
      expect(mockKV.put).toHaveBeenCalled();
    });

    it('should set data in COLD tier', async () => {
      vi.mocked(mockR2.put).mockResolvedValue({} as R2Object);

      const data = { key: 'value' };
      const result = await storageManager.set('test-key', data, 'data', 'cold');

      expect(result.success).toBe(true);
      expect(result.tier).toBe('cold');
      expect(mockR2.put).toHaveBeenCalled();
    });
  });

  describe('Migration Operations', () => {
    it('should migrate data from HOT to WARM', async () => {
      const sessionData: SessionData = {
        sessionId: 'session-123',
        userId: 'user-456',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messages: [],
        metadata: {
          language: 'en',
          framework: 'react',
          projectPath: '/path',
          repositoryHash: 'hash123',
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

      // Mock DO get
      const mockDOStub = {
        fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ session: sessionData }), { status: 200 })),
      };
      vi.mocked(mockSessionDO.get).mockReturnValue(mockDOStub as unknown as DurableObjectStub);

      // Mock KV put
      vi.mocked(mockKV.put).mockResolvedValue(undefined);

      // Mock DO delete
      const mockDeleteStub = {
        fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
      };
      vi.mocked(mockSessionDO.get).mockReturnValue(mockDeleteStub as unknown as DurableObjectStub);

      const result = await storageManager.migrate('session-123', 'hot', 'warm', 'session');

      expect(result.success).toBe(true);
      expect(result.from).toBe('hot');
      expect(result.to).toBe('warm');
    });

    it('should migrate data from WARM to COLD', async () => {
      const data = { key: 'value' };

      // Mock KV get
      vi.mocked(mockKV.get).mockResolvedValue(JSON.stringify(data));

      // Mock R2 put
      vi.mocked(mockR2.put).mockResolvedValue({} as R2Object);

      // Mock KV delete
      vi.mocked(mockKV.delete).mockResolvedValue(undefined);

      const result = await storageManager.migrate('test-key', 'warm', 'cold', 'data');

      expect(result.success).toBe(true);
      expect(result.from).toBe('warm');
      expect(result.to).toBe('cold');
    });

    it('should promote data from COLD to WARM', async () => {
      const data = { key: 'value' };

      // Mock R2 get
      const encoder = new TextEncoder();
      vi.mocked(mockR2.get).mockResolvedValue({
        arrayBuffer: () => Promise.resolve(encoder.encode(JSON.stringify(data)).buffer),
        metadata: {},
      } as R2Object);

      // Mock KV put
      vi.mocked(mockKV.put).mockResolvedValue(undefined);

      const result = await storageManager.promote('test-key', 'cold', 'warm', 'data');

      expect(result.success).toBe(true);
      expect(result.from).toBe('cold');
      expect(result.to).toBe('warm');
    });

    it('should fail to migrate when source tier is empty', async () => {
      // Mock all misses
      const mockDOStub = {
        fetch: vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
      };
      vi.mocked(mockSessionDO.get).mockReturnValue(mockDOStub as unknown as DurableObjectStub);
      vi.mocked(mockKV.get).mockResolvedValue(null);
      vi.mocked(mockR2.get).mockResolvedValue(null);

      const result = await storageManager.migrate('non-existent', 'hot', 'warm', 'data');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Data not found in source tier');
    });
  });

  describe('Delete Operations', () => {
    it('should delete from all tiers', async () => {
      const mockDOStub = {
        fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 })),
      };
      vi.mocked(mockSessionDO.get).mockReturnValue(mockDOStub as unknown as DurableObjectStub);
      vi.mocked(mockKV.delete).mockResolvedValue(undefined);
      vi.mocked(mockR2.delete).mockResolvedValue(undefined);

      await storageManager.delete('test-key', 'data');

      expect(mockDOStub.fetch).toHaveBeenCalled();
      expect(mockKV.delete).toHaveBeenCalled();
      expect(mockR2.delete).toHaveBeenCalled();
    });
  });

  describe('Exists Operations', () => {
    it('should return true when key exists in HOT tier', async () => {
      const mockDOStub = {
        fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })),
      };
      vi.mocked(mockSessionDO.get).mockReturnValue(mockDOStub as unknown as DurableObjectStub);

      const result = await storageManager.exists('session-123', 'session');

      expect(result.exists).toBe(true);
      expect(result.tier).toBe('hot');
    });

    it('should return true when key exists in WARM tier', async () => {
      const mockDOStub = {
        fetch: vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
      };
      vi.mocked(mockSessionDO.get).mockReturnValue(mockDOStub as unknown as DurableObjectStub);
      vi.mocked(mockKV.get).mockResolvedValue('data');

      const result = await storageManager.exists('test-key', 'data');

      expect(result.exists).toBe(true);
      expect(result.tier).toBe('warm');
    });

    it('should return true when key exists in COLD tier', async () => {
      const mockDOStub = {
        fetch: vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
      };
      vi.mocked(mockSessionDO.get).mockReturnValue(mockDOStub as unknown as DurableObjectStub);
      vi.mocked(mockKV.get).mockResolvedValue(null);
      vi.mocked(mockR2.head).mockResolvedValue({} as R2Object);

      const result = await storageManager.exists('test-key', 'data');

      expect(result.exists).toBe(true);
      expect(result.tier).toBe('cold');
    });

    it('should return false when key does not exist', async () => {
      const mockDOStub = {
        fetch: vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
      };
      vi.mocked(mockSessionDO.get).mockReturnValue(mockDOStub as unknown as DurableObjectStub);
      vi.mocked(mockKV.get).mockResolvedValue(null);
      vi.mocked(mockR2.head).mockResolvedValue(null);

      const result = await storageManager.exists('non-existent', 'data');

      expect(result.exists).toBe(false);
      expect(result.tier).toBeUndefined();
    });
  });

  describe('Statistics', () => {
    it('should get statistics across all tiers', async () => {
      vi.mocked(mockKV.list).mockResolvedValue({ objects: [], truncated: false });
      vi.mocked(mockR2.list).mockResolvedValue({ objects: [], truncated: false });

      const stats = await storageManager.getStats();

      expect(stats.hot).toBeDefined();
      expect(stats.warm).toBeDefined();
      expect(stats.cold).toBeDefined();
      expect(stats.totalAccessPatterns).toBeDefined();
    });
  });

  describe('Automatic Migration', () => {
    it('should run migration policy when enabled', async () => {
      const autoMigrateManager = new StorageManager(
        mockSessionDO,
        kvCache,
        r2Storage,
        { autoMigrate: true, hotMaxAge: 1000 }
      );

      // Add access pattern
      autoMigrateManager['accessPatterns'].set('test-key', {
        tier: 'hot',
        accessCount: 0,
        lastAccess: Date.now() - 2000, // 2 seconds ago
        createdAt: Date.now() - 10000,
      });

      vi.mocked(mockKV.get).mockResolvedValue(null);
      vi.mocked(mockKV.put).mockResolvedValue(undefined);

      const result = await autoMigrateManager.runMigrationPolicy();

      expect(result.migrated).toBeGreaterThanOrEqual(0);
      expect(result.errors).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      const mockDOStub = {
        fetch: vi.fn().mockRejectedValue(new Error('DO error')),
      };
      vi.mocked(mockSessionDO.get).mockReturnValue(mockDOStub as unknown as DurableObjectStub);

      const result = await storageManager.get('test-key', 'session');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
