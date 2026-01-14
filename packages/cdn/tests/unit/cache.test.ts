/**
 * Cache Controller Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheController } from '../../src/cache/controller.js';
import type { ICachePolicy, IRequestContext } from '../../src/types/index.js';

describe('CacheController', () => {
  let cache: CacheController;

  beforeEach(() => {
    cache = new CacheController({
      maxCacheSize: 100,
      defaultTTL: 3600,
      enableHierarchy: false
    });
  });

  describe('Policy Management', () => {
    it('should register a cache policy', () => {
      const policy: ICachePolicy = {
        name: 'test-policy',
        policy: 'public' as any,
        ttl: 7200,
        level: 'edge' as any,
        tags: ['test']
      };

      cache.registerPolicy(policy);
      expect(cache['policies'].has('test-policy')).toBe(true);
    });

    it('should get policy for matching request', () => {
      const policy: ICachePolicy = {
        name: 'api-policy',
        policy: 'public' as any,
        ttl: 60,
        level: 'edge' as any,
        tags: ['api']
      };

      cache.registerPolicy(policy);
      cache.registerRule({
        id: 'api-rule',
        pattern: '^/api/',
        policy,
        enabled: true,
        priority: 1
      });

      const context: IRequestContext = {
        url: 'https://example.com/api/users',
        method: 'GET',
        headers: {}
      };

      const matched = cache.getPolicyForRequest(context);
      expect(matched?.name).toBe('api-policy');
    });

    it('should return default policy when no rules match', () => {
      cache.registerPolicy({
        name: 'default',
        policy: 'public' as any,
        ttl: 3600,
        level: 'edge' as any
      });

      const context: IRequestContext = {
        url: 'https://example.com/test',
        method: 'GET',
        headers: {}
      };

      const matched = cache.getPolicyForRequest(context);
      expect(matched?.name).toBe('default');
    });
  });

  describe('Cache Operations', () => {
    it('should store and retrieve cache entries', async () => {
      const key = 'test-key';
      const entry = {
        url: 'https://example.com/test',
        status: 200,
        size: 1024,
        contentType: 'text/html',
        tags: [],
        ttl: 3600000,
        age: 0,
        lastAccessed: new Date(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        metadata: {}
      };

      await cache.set(key, entry);
      const retrieved = await cache.get(key);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.url).toBe(entry.url);
    });

    it('should delete cache entries', async () => {
      const key = 'test-key';
      const entry = {
        url: 'https://example.com/test',
        status: 200,
        size: 1024,
        contentType: 'text/html',
        tags: [],
        ttl: 3600000,
        age: 0,
        lastAccessed: new Date(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        metadata: {}
      };

      await cache.set(key, entry);
      await cache.delete(key);

      const retrieved = await cache.get(key);
      expect(retrieved).toBeNull();
    });

    it('should clear all cache entries', async () => {
      const entry1 = {
        url: 'https://example.com/test1',
        status: 200,
        size: 1024,
        contentType: 'text/html',
        tags: [],
        ttl: 3600000,
        age: 0,
        lastAccessed: new Date(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        metadata: {}
      };

      const entry2 = {
        url: 'https://example.com/test2',
        status: 200,
        size: 2048,
        contentType: 'application/json',
        tags: [],
        ttl: 3600000,
        age: 0,
        lastAccessed: new Date(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        metadata: {}
      };

      await cache.set('key1', entry1);
      await cache.set('key2', entry2);
      await cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('Bypass Rules', () => {
    it('should bypass cache when rule matches', () => {
      cache.registerBypassRule({
        id: 'admin-bypass',
        pattern: '^/admin/',
        reason: 'Admin routes bypass cache',
        enabled: true,
        priority: 1
      });

      const context: IRequestContext = {
        url: 'https://example.com/admin/users',
        method: 'GET',
        headers: {}
      };

      const shouldBypass = cache.shouldBypass(context);
      expect(shouldBypass).toBe(true);
    });

    it('should not bypass cache when rule does not match', () => {
      cache.registerBypassRule({
        id: 'admin-bypass',
        pattern: '^/admin/',
        reason: 'Admin routes bypass cache',
        enabled: true,
        priority: 1
      });

      const context: IRequestContext = {
        url: 'https://example.com/public/users',
        method: 'GET',
        headers: {}
      };

      const shouldBypass = cache.shouldBypass(context);
      expect(shouldBypass).toBe(false);
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate cache key from URL', () => {
      const key = cache.generateCacheKey('https://example.com/test', {});
      expect(key).toBe('https://example.com/test');
    });

    it('should include vary headers in cache key', () => {
      const key = cache.generateCacheKey('https://example.com/test', {
        'accept-encoding': 'gzip',
        'accept-language': 'en-US'
      }, ['accept-encoding']);

      expect(key).toContain('gzip');
    });
  });

  describe('Cache Headers', () => {
    it('should generate cache headers for policy', () => {
      const policy: ICachePolicy = {
        name: 'test',
        policy: 'public' as any,
        ttl: 3600,
        staleWhileRevalidate: 600,
        level: 'edge' as any
      };

      const headers = cache.generateCacheHeaders(policy);

      expect(headers['Cache-Control']).toContain('max-age=3600');
      expect(headers['Cache-Control']).toContain('stale-while-revalidate=600');
    });

    it('should include ETag in headers', () => {
      const policy: ICachePolicy = {
        name: 'test',
        policy: 'public' as any,
        ttl: 3600,
        level: 'edge' as any
      };

      const headers = cache.generateCacheHeaders(policy, 'abc123');

      expect(headers['ETag']).toBe('abc123');
    });
  });

  describe('Statistics', () => {
    it('should track cache hits and misses', async () => {
      const entry = {
        url: 'https://example.com/test',
        status: 200,
        size: 1024,
        contentType: 'text/html',
        tags: [],
        ttl: 3600000,
        age: 0,
        lastAccessed: new Date(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        metadata: {}
      };

      await cache.set('key', entry);
      await cache.get('key'); // Hit
      await cache.get('nonexistent'); // Miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(50);
    });

    it('should calculate hit rate correctly', async () => {
      const entry = {
        url: 'https://example.com/test',
        status: 200,
        size: 1024,
        contentType: 'text/html',
        tags: [],
        ttl: 3600000,
        age: 0,
        lastAccessed: new Date(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        metadata: {}
      };

      await cache.set('key', entry);
      await cache.get('key');
      await cache.get('key');
      await cache.get('key');

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(100);
    });
  });

  describe('Tag-based Operations', () => {
    it('should delete entries by tag', async () => {
      const entry1 = {
        url: 'https://example.com/test1',
        status: 200,
        size: 1024,
        contentType: 'text/html',
        tags: ['api', 'v1'],
        ttl: 3600000,
        age: 0,
        lastAccessed: new Date(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        metadata: {}
      };

      const entry2 = {
        url: 'https://example.com/test2',
        status: 200,
        size: 2048,
        contentType: 'application/json',
        tags: ['api', 'v2'],
        ttl: 3600000,
        age: 0,
        lastAccessed: new Date(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        metadata: {}
      };

      await cache.set('key1', entry1);
      await cache.set('key2', entry2);

      const deleted = await cache.deleteByTag('api');
      expect(deleted).toBe(2);
    });

    it('should delete entries by pattern', async () => {
      await cache.set('https://example.com/api/users', {
        url: 'https://example.com/api/users',
        status: 200,
        size: 1024,
        contentType: 'application/json',
        tags: [],
        ttl: 3600000,
        age: 0,
        lastAccessed: new Date(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        metadata: {}
      });

      await cache.set('https://example.com/web/page', {
        url: 'https://example.com/web/page',
        status: 200,
        size: 2048,
        contentType: 'text/html',
        tags: [],
        ttl: 3600000,
        age: 0,
        lastAccessed: new Date(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        metadata: {}
      });

      const deleted = await cache.deleteByPattern(/^https:\/\/example\.com\/api\//);
      expect(deleted).toBe(1);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', () => {
      const health = cache.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.levels.length).toBeGreaterThan(0);
    });
  });

  describe('Cache Warmup', () => {
    it('should warm cache with URLs', async () => {
      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: async () => 'test content',
        headers: {
          get: (name: string) => name === 'content-type' ? 'text/plain' : null
        }
      } as any);

      await cache.warmup(['https://example.com/test1', 'https://example.com/test2']);

      const size = cache.getSize();
      expect(size).toBeGreaterThan(0);
    });
  });
});
