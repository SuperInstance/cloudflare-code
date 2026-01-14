/**
 * Quota Tracker Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuotaTracker, createQuotaTracker } from '../../src/lib/quota';

// Mock KV namespace
class MockKVNamespace implements KVNamespace {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null>;
  async get(key: string, type: 'text'): Promise<string | null>;
  async get(key: string, type: 'json'): Promise<any>;
  async get(key: string, type: 'stream'): Promise<ReadableStream | null>;
  async get(key: string, type?: string): Promise<any> {
    const value = this.store.get(key);
    if (!value) return null;

    if (type === 'json') {
      return JSON.parse(value);
    }
    return value;
  }

  async put(key: string, value: string | ReadableStream | ArrayBuffer): Promise<void>;
  async put(key: string, value: string | ReadableStream | ArrayBuffer, options: KVNamespacePutOptions): Promise<void>;
  async put(key: string, value: any, options?: KVNamespacePutOptions): Promise<void> {
    if (typeof value === 'string') {
      this.store.set(key, value);
    } else if (value instanceof ReadableStream) {
      // Handle stream
      const reader = value.getReader();
      const chunks: Uint8Array[] = [];
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) chunks.push(value);
      }

      const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      this.store.set(key, new TextDecoder().decode(combined));
    } else {
      this.store.set(key, JSON.stringify(value));
    }
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(options?: KVNamespaceListOptions): Promise<KVNamespaceListResult<any>> {
    const prefix = options?.prefix || '';
    const keys = Array.from(this.store.keys())
      .filter(key => key.startsWith(prefix))
      .map(key => ({ name: key, metadata: null }));

    return {
      keys,
      list_complete: true,
      cursor: '',
    };
  }

  // Additional methods
  getWithMetadata(): Promise<any> { throw new Error('Not implemented'); }
}

describe('QuotaTracker', () => {
  let tracker: QuotaTracker;
  let mockKV: MockKVNamespace;

  beforeEach(() => {
    mockKV = new MockKVNamespace();
    tracker = new QuotaTracker({
      kv: mockKV as any,
      enableAnalytics: true,
    });
  });

  describe('Initialization', () => {
    it('should initialize quota for a provider', async () => {
      await tracker.initialize('openai', 1000000, 'daily');

      const usage = await tracker.getUsage('openai');
      expect(usage).toBe(0);
    });

    it('should set initial remaining to limit', async () => {
      await tracker.initialize('anthropic', 500000, 'daily');

      const remaining = await tracker.getRemaining('anthropic');
      expect(remaining).toBe(500000);
    });

    it('should handle multiple providers', async () => {
      await tracker.initialize('openai', 1000000, 'daily');
      await tracker.initialize('anthropic', 500000, 'daily');

      const openaiUsage = await tracker.getUsage('openai');
      const anthropicUsage = await tracker.getUsage('anthropic');

      expect(openaiUsage).toBe(0);
      expect(anthropicUsage).toBe(0);
    });
  });

  describe('Recording usage', () => {
    it('should record usage correctly', async () => {
      await tracker.initialize('openai', 1000000, 'daily');
      await tracker.recordUsage('openai', 1000);

      const usage = await tracker.getUsage('openai');
      expect(usage).toBe(1000);
    });

    it('should update remaining quota', async () => {
      await tracker.initialize('openai', 1000000, 'daily');
      await tracker.recordUsage('openai', 10000);

      const remaining = await tracker.getRemaining('openai');
      expect(remaining).toBe(990000);
    });

    it('should accumulate usage across multiple calls', async () => {
      await tracker.initialize('openai', 1000000, 'daily');

      await tracker.recordUsage('openai', 1000);
      await tracker.recordUsage('openai', 2000);
      await tracker.recordUsage('openai', 3000);

      const usage = await tracker.getUsage('openai');
      expect(usage).toBe(6000);
    });

    it('should not allow negative remaining', async () => {
      await tracker.initialize('openai', 1000, 'daily');
      await tracker.recordUsage('openai', 1500);

      const remaining = await tracker.getRemaining('openai');
      expect(remaining).toBe(0);
    });
  });

  describe('hasQuota', () => {
    it('should return true when quota available', async () => {
      await tracker.initialize('openai', 1000000, 'daily');

      const hasQuota = await tracker.hasQuota('openai', 1000);
      expect(hasQuota).toBe(true);
    });

    it('should return false when insufficient quota', async () => {
      await tracker.initialize('openai', 1000, 'daily');
      await tracker.recordUsage('openai', 900);

      const hasQuota = await tracker.hasQuota('openai', 200);
      expect(hasQuota).toBe(false);
    });

    it('should return false when exhausted', async () => {
      await tracker.initialize('openai', 1000, 'daily');
      await tracker.recordUsage('openai', 1000);

      const hasQuota = await tracker.hasQuota('openai', 1);
      expect(hasQuota).toBe(false);
    });
  });

  describe('getQuotaPercent', () => {
    it('should calculate usage percentage', async () => {
      await tracker.initialize('openai', 1000000, 'daily');
      await tracker.recordUsage('openai', 250000);

      const percent = await tracker.getQuotaPercent('openai');
      expect(percent).toBe(25);
    });

    it('should return 0 for no usage', async () => {
      await tracker.initialize('openai', 1000000, 'daily');

      const percent = await tracker.getQuotaPercent('openai');
      expect(percent).toBe(0);
    });

    it('should return 100 for exhausted quota', async () => {
      await tracker.initialize('openai', 1000, 'daily');
      await tracker.recordUsage('openai', 1000);

      const percent = await tracker.getQuotaPercent('openai');
      expect(percent).toBe(100);
    });
  });

  describe('isExhausted', () => {
    it('should return true when quota exhausted', async () => {
      await tracker.initialize('openai', 1000, 'daily');
      await tracker.recordUsage('openai', 1000);

      const exhausted = await tracker.isExhausted('openai');
      expect(exhausted).toBe(true);
    });

    it('should return true when above threshold', async () => {
      await tracker.initialize('openai', 1000, 'daily');
      await tracker.recordUsage('openai', 950);

      const exhausted = await tracker.isExhausted('openai', 0.9);
      expect(exhausted).toBe(true);
    });

    it('should return false when below threshold', async () => {
      await tracker.initialize('openai', 1000, 'daily');
      await tracker.recordUsage('openai', 500);

      const exhausted = await tracker.isExhausted('openai', 0.9);
      expect(exhausted).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return detailed statistics', async () => {
      await tracker.initialize('openai', 1000000, 'daily');
      await tracker.recordUsage('openai', 250000);

      const stats = await tracker.getStats('openai');

      expect(stats.provider).toBe('openai');
      expect(stats.usagePercent).toBe(25);
      expect(stats.remaining).toBe(750000);
      expect(stats.limit).toBe(1000000);
      expect(stats.isExhausted).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset quota to full', async () => {
      await tracker.initialize('openai', 1000000, 'daily');
      await tracker.recordUsage('openai', 500000);

      await tracker.reset('openai');

      const usage = await tracker.getUsage('openai');
      const remaining = await tracker.getRemaining('openai');

      expect(usage).toBe(0);
      expect(remaining).toBe(1000000);
    });
  });

  describe('getAllStatus', () => {
    it('should return status for all providers', async () => {
      await tracker.initialize('openai', 1000000, 'daily');
      await tracker.initialize('anthropic', 500000, 'daily');

      await tracker.recordUsage('openai', 100000);
      await tracker.recordUsage('anthropic', 50000);

      const allStatus = await tracker.getAllStatus();

      expect(allStatus.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getProvidersByRemaining', () => {
    it('should sort providers by remaining quota', async () => {
      await tracker.initialize('openai', 1000000, 'daily');
      await tracker.initialize('anthropic', 500000, 'daily');

      await tracker.recordUsage('openai', 800000); // 200K remaining
      await tracker.recordUsage('anthropic', 100000); // 400K remaining

      const sorted = await tracker.getProvidersByRemaining();

      // Anthropic should be first (more remaining)
      expect(sorted[0]).toBe('anthropic');
      expect(sorted[1]).toBe('openai');
    });
  });

  describe('createQuotaTracker', () => {
    it('should create tracker with default settings', () => {
      const tracker2 = createQuotaTracker(mockKV as any);

      expect(tracker2).toBeInstanceOf(QuotaTracker);
    });
  });

  describe('QuotaTracker edge cases', () => {
    it('should handle zero limit', async () => {
      await tracker.initialize('test', 0, 'daily');

      const percent = await tracker.getQuotaPercent('test');
      expect(percent).toBe(0);
    });

    it('should handle very large quotas', async () => {
      await tracker.initialize('test', Number.MAX_SAFE_INTEGER, 'daily');
      await tracker.recordUsage('test', 1000000000000);

      const remaining = await tracker.getRemaining('test');
      expect(remaining).toBeGreaterThan(0);
    });

    it('should throw error for uninitialized provider', async () => {
      await expect(tracker.getUsage('unknown')).rejects.toThrow();
    });
  });
});
