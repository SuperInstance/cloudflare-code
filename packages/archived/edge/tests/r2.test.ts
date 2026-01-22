/**
 * Unit Tests for R2Storage (COLD Tier)
 *
 * Tests for R2 bucket wrapper with compression,
 * archiving, and long-term storage.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { R2Storage } from '../src/lib/r2';
import type { SessionData } from '../src/types';

describe('R2Storage', () => {
  let mockR2: R2Bucket;
  let r2Storage: R2Storage;

  beforeEach(() => {
    // Mock R2 bucket
    mockR2 = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
      head: vi.fn(),
    } as unknown as R2Bucket;

    r2Storage = new R2Storage(mockR2, {
      compression: true,
      retry: false,
      maxUploadSize: 100 * 1024 * 1024, // 100MB
    });
  });

  describe('Basic Operations', () => {
    it('should put and get ArrayBuffer', async () => {
      const testData = new ArrayBuffer(100);
      const mockR2Object = {
        arrayBuffer: vi.fn().mockResolvedValue(testData),
        metadata: { compressed: 'false' },
      };

      vi.mocked(mockR2.put).mockResolvedValue({} as R2Object);
      vi.mocked(mockR2.get).mockResolvedValue(mockR2Object as R2Object);

      await r2Storage.put('test-key', testData);
      const result = await r2Storage.get('test-key');

      expect(result).not.toBeNull();
      expect(result?.byteLength).toBe(100);
    });

    it('should put and get string', async () => {
      const testData = 'Hello, R2!';
      const encoder = new TextEncoder();
      const arrayBuffer = encoder.encode(testData).buffer;

      const mockR2Object = {
        arrayBuffer: vi.fn().mockResolvedValue(arrayBuffer),
        metadata: { compressed: 'false' },
      };

      vi.mocked(mockR2.put).mockResolvedValue({} as R2Object);
      vi.mocked(mockR2.get).mockResolvedValue(mockR2Object as R2Object);

      await r2Storage.put('test-key', testData);
      const result = await r2Storage.getText('test-key');

      expect(result).toBe(testData);
    });

    it('should put and get JSON object', async () => {
      const testData = { message: 'Hello, R2!', count: 42 };
      const encoder = new TextEncoder();
      const arrayBuffer = encoder.encode(JSON.stringify(testData)).buffer;

      const mockR2Object = {
        arrayBuffer: vi.fn().mockResolvedValue(arrayBuffer),
        metadata: { compressed: 'false' },
      };

      vi.mocked(mockR2.put).mockResolvedValue({} as R2Object);
      vi.mocked(mockR2.get).mockResolvedValue(mockR2Object as R2Object);

      await r2Storage.put('test-key', testData);
      const result = await r2Storage.getJSON<typeof testData>('test-key');

      expect(result).toEqual(testData);
    });

    it('should return null for non-existent key', async () => {
      vi.mocked(mockR2.get).mockResolvedValue(null);

      const result = await r2Storage.get('non-existent');

      expect(result).toBeNull();
    });

    it('should delete object', async () => {
      vi.mocked(mockR2.delete).mockResolvedValue(undefined);

      const result = await r2Storage.delete('test-key');

      expect(result).toBe(true);
      expect(mockR2.delete).toHaveBeenCalledWith('test-key');
    });
  });

  describe('Metadata Operations', () => {
    it('should check if object exists', async () => {
      const mockR2Object = {
        size: 1000,
        uploaded: new Date(),
      };

      vi.mocked(mockR2.head)
        .mockResolvedValueOnce(mockR2Object as R2Object)
        .mockResolvedValueOnce(null);

      const exists1 = await r2Storage.exists('existing-key');
      const exists2 = await r2Storage.exists('non-existing-key');

      expect(exists1).toBe(true);
      expect(exists2).toBe(false);
    });

    it('should list objects by prefix', async () => {
      const mockR2Objects = {
        objects: [
          { key: 'sessions/123/data.json', size: 1000, uploaded: new Date() },
          { key: 'sessions/456/data.json', size: 2000, uploaded: new Date() },
        ],
        truncated: false,
      };

      vi.mocked(mockR2.list).mockResolvedValue(mockR2Objects);

      const result = await r2Storage.list('sessions/', 10);

      expect(result.objects).toHaveLength(2);
      expect(result.objects[0].key).toBe('sessions/123/data.json');
      expect(mockR2.list).toHaveBeenCalledWith({ prefix: 'sessions/', limit: 10 });
    });
  });

  describe('Session Archiving', () => {
    it('should archive session', async () => {
      vi.mocked(mockR2.put).mockResolvedValue({} as R2Object);

      const sessionData: SessionData = {
        sessionId: 'session-123',
        userId: 'user-456',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messages: [],
        metadata: {
          language: 'en',
          framework: 'react',
          projectPath: '/path/to/project',
          repositoryHash: 'abc123',
          messageCount: 0,
          totalTokens: 0,
          totalCost: 0,
          cacheHits: 0,
          cacheMisses: 0,
          hitRate: 0,
        },
        storage: {
          tier: 'cold',
          compressed: false,
          sizeBytes: 0,
          checkpointCount: 0,
          lastCheckpoint: Date.now(),
        },
      };

      await r2Storage.archiveSession(sessionData);

      expect(mockR2.put).toHaveBeenCalledWith(
        expect.stringContaining('sessions/session-123/'),
        expect.any(ArrayBuffer),
        expect.objectContaining({
          sessionId: 'session-123',
          tier: 'cold',
        })
      );
    });

    it('should retrieve session archives', async () => {
      const sessionData: SessionData = {
        sessionId: 'session-123',
        userId: 'user-456',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messages: [],
        metadata: {
          language: 'en',
          framework: 'react',
          projectPath: '/path/to/project',
          repositoryHash: 'abc123',
          messageCount: 0,
          totalTokens: 0,
          totalCost: 0,
          cacheHits: 0,
          cacheMisses: 0,
          hitRate: 0,
        },
        storage: {
          tier: 'cold',
          compressed: false,
          sizeBytes: 0,
          checkpointCount: 0,
          lastCheckpoint: Date.now(),
        },
      };

      const mockR2Objects = {
        objects: [
          { key: 'sessions/session-123/hash1/1000.json', uploaded: new Date() },
          { key: 'sessions/session-123/hash2/2000.json', uploaded: new Date() },
        ],
        truncated: false,
      };

      vi.mocked(mockR2.list).mockResolvedValue(mockR2Objects);
      vi.mocked(mockR2.get).mockImplementation((key) => {
        const encoder = new TextEncoder();
        return Promise.resolve({
          arrayBuffer: () => Promise.resolve(encoder.encode(JSON.stringify(sessionData)).buffer),
          metadata: { compressed: 'false' },
        } as R2Object);
      });

      const result = await r2Storage.getSessionArchive('session-123');

      expect(result).toHaveLength(2);
      expect(result[0].sessionId).toBe('session-123');
    });
  });

  describe('Conversation History', () => {
    it('should store conversation history', async () => {
      vi.mocked(mockR2.put).mockResolvedValue({} as R2Object);

      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      await r2Storage.storeConversationHistory('session-123', messages);

      expect(mockR2.put).toHaveBeenCalledWith(
        expect.stringContaining('conversations/session-123/'),
        expect.any(Object),
        expect.objectContaining({
          sessionId: 'session-123',
          messageCount: '2',
        })
      );
    });

    it('should retrieve conversation history', async () => {
      const mockR2Objects = {
        objects: [
          { key: 'conversations/session-123/1000.json', uploaded: new Date() },
        ],
        truncated: false,
      };

      const historyData = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
        metadata: { model: 'claude-3' },
      };

      vi.mocked(mockR2.list).mockResolvedValue(mockR2Objects);
      vi.mocked(mockR2.get).mockImplementation(() => {
        const encoder = new TextEncoder();
        return Promise.resolve({
          arrayBuffer: () => Promise.resolve(encoder.encode(JSON.stringify(historyData)).buffer),
          metadata: { compressed: 'false' },
        } as R2Object);
      });

      const result = await r2Storage.getConversationHistory('session-123');

      expect(result).toHaveLength(1);
      expect(result[0].messages).toHaveLength(2);
    });
  });

  describe('Log Storage', () => {
    it('should store logs', async () => {
      vi.mocked(mockR2.put).mockResolvedValue({} as R2Object);

      const logs = [
        { timestamp: Date.now(), level: 'info', message: 'Test log' },
        { timestamp: Date.now(), level: 'error', message: 'Test error', data: { error: 'details' } },
      ];

      await r2Storage.storeLogs('session-123', logs);

      expect(mockR2.put).toHaveBeenCalledWith(
        expect.stringContaining('logs/session-123/'),
        expect.any(Array),
        expect.objectContaining({
          sessionId: 'session-123',
          tier: 'cold',
        })
      );
    });

    it('should retrieve logs for a session', async () => {
      const logs = [
        { timestamp: 1000, level: 'info', message: 'Log 1' },
        { timestamp: 2000, level: 'error', message: 'Log 2' },
      ];

      const mockR2Objects = {
        objects: [
          { key: 'logs/session-123/2024-01-13.json', uploaded: new Date() },
        ],
        truncated: false,
      };

      vi.mocked(mockR2.list).mockResolvedValue(mockR2Objects);
      vi.mocked(mockR2.get).mockImplementation(() => {
        const encoder = new TextEncoder();
        return Promise.resolve({
          arrayBuffer: () => Promise.resolve(encoder.encode(JSON.stringify(logs)).buffer),
          metadata: { compressed: 'false' },
        } as R2Object);
      });

      const result = await r2Storage.getLogs('session-123');

      expect(result).toHaveLength(2);
      expect(result[0].message).toBe('Log 1');
      expect(result[1].message).toBe('Log 2');
    });
  });

  describe('Statistics', () => {
    it('should get storage statistics', async () => {
      const mockR2Objects = {
        objects: [
          { key: 'file1.json', size: 1000, uploaded: new Date() },
          { key: 'file2.json', size: 2000, uploaded: new Date() },
          { key: 'file3.json', size: 3000, uploaded: new Date() },
        ],
        truncated: false,
      };

      vi.mocked(mockR2.list).mockResolvedValue(mockR2Objects);

      const result = await r2Storage.getStats('sessions/');

      expect(result.objectCount).toBe(3);
      expect(result.totalSize).toBe(6000);
      expect(result.avgObjectSize).toBe(2000);
    });
  });

  describe('Copy Operation', () => {
    it('should copy object to another key', async () => {
      const testData = new ArrayBuffer(100);
      const mockR2Object = {
        arrayBuffer: vi.fn().mockResolvedValue(testData),
        metadata: { compressed: 'false' },
      };

      vi.mocked(mockR2.get).mockResolvedValue(mockR2Object as R2Object);
      vi.mocked(mockR2.put).mockResolvedValue({} as R2Object);

      await r2Storage.copy('source-key', 'dest-key');

      expect(mockR2.get).toHaveBeenCalledWith('source-key');
      expect(mockR2.put).toHaveBeenCalledWith('dest-key', testData, expect.any(Object));
    });
  });

  describe('Size Limits', () => {
    it('should reject uploads exceeding max size', async () => {
      const largeData = new ArrayBuffer(200 * 1024 * 1024); // 200MB

      await expect(
        r2Storage.put('large-key', largeData)
      ).rejects.toThrow('exceeds maximum');
    });

    it('should accept uploads within size limit', async () => {
      vi.mocked(mockR2.put).mockResolvedValue({} as R2Object);

      const data = new ArrayBuffer(50 * 1024 * 1024); // 50MB

      await expect(
        r2Storage.put('acceptable-key', data)
      ).resolves.not.toThrow();
    });
  });

  describe('Compression', () => {
    it('should compress data when enabled', async () => {
      const compressingR2 = new R2Storage(mockR2, { compression: true });
      vi.mocked(mockR2.put).mockResolvedValue({} as R2Object);

      const largeData = { data: 'x'.repeat(10000) };

      await compressingR2.put('test-key', largeData);

      expect(mockR2.put).toHaveBeenCalledWith(
        'test-key',
        expect.any(ArrayBuffer),
        expect.objectContaining({
          compressed: 'true',
        })
      );
    });

    it('should not compress data when disabled', async () => {
      const nonCompressingR2 = new R2Storage(mockR2, { compression: false });
      vi.mocked(mockR2.put).mockResolvedValue({} as R2Object);

      const data = { message: 'test' };

      await nonCompressingR2.put('test-key', data);

      expect(mockR2.put).toHaveBeenCalledWith(
        'test-key',
        expect.any(ArrayBuffer),
        expect.objectContaining({
          compressed: 'false',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle get errors gracefully', async () => {
      vi.mocked(mockR2.get).mockRejectedValue(new Error('R2 error'));

      const result = await r2Storage.get('test-key');

      expect(result).toBeNull();
    });

    it('should handle delete errors', async () => {
      vi.mocked(mockR2.delete).mockRejectedValue(new Error('R2 error'));

      const result = await r2Storage.delete('test-key');

      expect(result).toBe(false);
    });

    it('should retry on failure when retry is enabled', async () => {
      const retryingR2 = new R2Storage(mockR2, { retry: true });

      vi.mocked(mockR2.get)
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)), metadata: {} } as R2Object);

      const result = await retryingR2.get('test-key');

      expect(result).not.toBeNull();
      expect(mockR2.get).toHaveBeenCalledTimes(2);
    });
  });
});
