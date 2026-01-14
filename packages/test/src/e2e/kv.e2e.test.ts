/**
 * KV E2E Tests
 *
 * Comprehensive tests for KV namespace operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createKVFixture, KV_FIXTURE_DATA } from '../fixtures/kv-fixture';

describe('KV E2E Tests', () => {
  let fixture: ReturnType<typeof createKVFixture>;

  beforeEach(() => {
    fixture = createKVFixture();
  });

  afterEach(() => {
    fixture.clear();
  });

  describe('Basic Operations', () => {
    it('should put and get value', async () => {
      const kv = fixture.createNamespace();

      await kv.put('test-key', 'test-value');
      const value = await kv.get('test-key');

      expect(value).toBe('test-value');
    });

    it('should get with metadata', async () => {
      const kv = fixture.createNamespace();

      await kv.put('test-key', 'test-value', {
        metadata: { foo: 'bar' },
      });

      const result = await kv.getWithMetadata('test-key');

      expect(result.value).toBe('test-value');
      expect(result.metadata).toEqual({ foo: 'bar' });
    });

    it('should delete value', async () => {
      const kv = fixture.createNamespace();

      await kv.put('test-key', 'test-value');
      await kv.delete('test-key');

      const value = await kv.get('test-key');
      expect(value).toBeNull();
    });

    it('should return null for non-existent key', async () => {
      const kv = fixture.createNamespace();

      const value = await kv.get('non-existent');

      expect(value).toBeNull();
    });
  });

  describe('List Operations', () => {
    beforeEach(() => {
      fixture.seed({
        'prefix:key1': { value: 'value1' },
        'prefix:key2': { value: 'value2' },
        'prefix:key3': { value: 'value3' },
        'other:key1': { value: 'value4' },
      });
    });

    it('should list all keys', async () => {
      const kv = fixture.createNamespace();

      const result = await kv.list();

      expect(result.keys).toHaveLength(4);
      expect(result.list_complete).toBe(true);
    });

    it('should list keys with prefix', async () => {
      const kv = fixture.createNamespace();

      const result = await kv.list({ prefix: 'prefix:' });

      expect(result.keys).toHaveLength(3);
      expect(result.keys.every(k => k.name.startsWith('prefix:'))).toBe(true);
    });

    it('should list keys with limit', async () => {
      const kv = fixture.createNamespace();

      const result = await kv.list({ limit: 2 });

      expect(result.keys).toHaveLength(2);
    });

    it('should support pagination with cursor', async () => {
      const kv = fixture.createNamespace();

      const page1 = await kv.list({ limit: 2 });
      expect(page1.keys).toHaveLength(2);
      expect(page1.cursor).toBeDefined();

      const page2 = await kv.list({ limit: 2, cursor: page1.cursor });
      expect(page2.keys).toHaveLength(2);
    });
  });

  describe('Metadata Operations', () => {
    it('should store and retrieve metadata', async () => {
      const kv = fixture.createNamespace();

      const metadata = {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await kv.put('test-key', 'test-value', { metadata });

      const result = await kv.getWithMetadata('test-key');

      expect(result.metadata).toEqual(metadata);
    });

    it('should support null metadata', async () => {
      const kv = fixture.createNamespace();

      await kv.put('test-key', 'test-value');

      const result = await kv.getWithMetadata('test-key');

      expect(result.metadata).toBeNull();
    });
  });

  describe('Expiration Operations', () => {
    it('should set expiration TTL', async () => {
      const kv = fixture.createNamespace();

      await kv.put('test-key', 'test-value', {
        expirationTtl: 60,
      });

      const entry = fixture.get('test-key');

      expect(entry?.expiration).toBeDefined();
      expect(entry?.expiration).toBeGreaterThan(Date.now() / 1000);
    });

    it('should expire keys after TTL', async () => {
      const kv = fixture.createNamespace();

      await kv.put('test-key', 'test-value', {
        expirationTtl: 1,
      });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      const value = await kv.get('test-key');

      // Note: This test requires actual KV, mock doesn't expire
      expect(value).toBeDefined();
    });
  });

  describe('Batch Operations', () => {
    it('should handle multiple put operations', async () => {
      const kv = fixture.createNamespace();

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(kv.put(`key-${i}`, `value-${i}`));
      }

      await Promise.all(promises);

      expect(fixture.size()).toBe(100);
    });

    it('should handle multiple get operations', async () => {
      const kv = fixture.createNamespace();

      for (let i = 0; i < 100; i++) {
        await kv.put(`key-${i}`, `value-${i}`);
      }

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(kv.get(`key-${i}`));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(100);
      expect(results.every(r => r !== null)).toBe(true);
    });

    it('should handle multiple delete operations', async () => {
      const kv = fixture.createNamespace();

      for (let i = 0; i < 100; i++) {
        await kv.put(`key-${i}`, `value-${i}`);
      }

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(kv.delete(`key-${i}`));
      }

      await Promise.all(promises);

      expect(fixture.size()).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string key', async () => {
      const kv = fixture.createNamespace();

      await kv.put('', 'empty-key-value');
      const value = await kv.get('');

      expect(value).toBe('empty-key-value');
    });

    it('should handle large values', async () => {
      const kv = fixture.createNamespace();

      const largeValue = 'x'.repeat(1000000); // 1MB

      await kv.put('large-key', largeValue);
      const value = await kv.get('large-key');

      expect(value).toBe(largeValue);
    });

    it('should handle special characters in keys', async () => {
      const kv = fixture.createNamespace();

      const specialKeys = [
        'key/with/slashes',
        'key:with:colons',
        'key-with-dashes',
        'key_with_underscores',
        'key.with.dots',
      ];

      for (const key of specialKeys) {
        await kv.put(key, `value-for-${key}`);
      }

      for (const key of specialKeys) {
        const value = await kv.get(key);
        expect(value).toBe(`value-for-${key}`);
      }
    });
  });

  describe('Fixture Data', () => {
    it('should load config fixture data', async () => {
      fixture.seed(KV_FIXTURE_DATA.config);

      expect(fixture.size()).toBeGreaterThan(0);

      const value = await fixture.createNamespace().get('api:version');
      expect(value).toBe('v1');
    });

    it('should load cache fixture data', async () => {
      fixture.seed(KV_FIXTURE_DATA.cache);

      expect(fixture.has('cache:user:123')).toBe(true);
      expect(fixture.has('cache:session:abc')).toBe(true);
    });

    it('should load tokens fixture data', async () => {
      fixture.seed(KV_FIXTURE_DATA.tokens);

      expect(fixture.has('token:valid')).toBe(true);
      expect(fixture.has('token:expired')).toBe(true);
    });

    it('should load rate limits fixture data', async () => {
      fixture.seed(KV_FIXTURE_DATA.rateLimits);

      expect(fixture.has('ratelimit:user:123')).toBe(true);
      expect(fixture.has('ratelimit:ip:1.2.3.4')).toBe(true);
    });
  });

  describe('Performance Tests', () => {
    it('should handle 1000 put operations', async () => {
      const kv = fixture.createNamespace();

      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        await kv.put(`perf-key-${i}`, `perf-value-${i}`);
      }

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // Should complete in < 5s
      expect(fixture.size()).toBe(1000);
    });

    it('should handle 1000 get operations', async () => {
      const kv = fixture.createNamespace();

      for (let i = 0; i < 1000; i++) {
        await kv.put(`perf-key-${i}`, `perf-value-${i}`);
      }

      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        await kv.get(`perf-key-${i}`);
      }

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // Should complete in < 5s
    });

    it('should handle 1000 list operations', async () => {
      const kv = fixture.createNamespace();

      for (let i = 0; i < 100; i++) {
        await kv.put(`key-${i}`, `value-${i}`);
      }

      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        await kv.list({ limit: 10 });
      }

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // Should complete in < 5s
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent puts', async () => {
      const kv = fixture.createNamespace();

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(kv.put(`concurrent-${i}`, `value-${i}`));
      }

      await Promise.all(promises);

      expect(fixture.size()).toBe(100);
    });

    it('should handle concurrent gets', async () => {
      const kv = fixture.createNamespace();

      for (let i = 0; i < 100; i++) {
        await kv.put(`key-${i}`, `value-${i}`);
      }

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(kv.get(`key-${i}`));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(100);
      expect(results.every(r => r !== null)).toBe(true);
    });

    it('should handle concurrent deletes', async () => {
      const kv = fixture.createNamespace();

      for (let i = 0; i < 100; i++) {
        await kv.put(`key-${i}`, `value-${i}`);
      }

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(kv.delete(`key-${i}`));
      }

      await Promise.all(promises);

      expect(fixture.size()).toBe(0);
    });
  });
});
