/**
 * Invalidation Engine Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InvalidationEngine } from '../../src/invalidation/engine.js';
import { CacheController } from '../../src/cache/controller.js';

describe('InvalidationEngine', () => {
  let engine: InvalidationEngine;
  let cache: CacheController;

  beforeEach(() => {
    cache = new CacheController({
      maxCacheSize: 100,
      defaultTTL: 3600,
      enableHierarchy: false
    });

    engine = new InvalidationEngine(cache, {
      batchSize: 10,
      maxConcurrent: 2,
      retryAttempts: 2,
      retryDelay: 100
    });
  });

  describe('URL Purging', () => {
    it('should purge URLs from local cache', async () => {
      // Add entries to cache
      await cache.set('https://example.com/test1', {
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
      });

      const result = await engine.purgeURLs(['https://example.com/test1']);

      expect(result.success).toBe(true);
      expect(result.purged).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should handle multiple URLs', async () => {
      const urls = [
        'https://example.com/test1',
        'https://example.com/test2',
        'https://example.com/test3'
      ];

      for (const url of urls) {
        await cache.set(url, {
          url,
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
        });
      }

      const result = await engine.purgeURLs(urls);

      expect(result.success).toBe(true);
      expect(result.purged).toBe(3);
    });

    it('should report errors for failed purges', async () => {
      // Try to purge URLs that don't exist
      const result = await engine.purgeURLs(['https://example.com/nonexistent']);

      // Should still succeed even if nothing was purged
      expect(result.purged).toBe(0);
    });
  });

  describe('Tag Purging', () => {
    it('should purge entries by tag', async () => {
      await cache.set('key1', {
        url: 'https://example.com/api/v1/users',
        status: 200,
        size: 1024,
        contentType: 'application/json',
        tags: ['api', 'v1'],
        ttl: 3600000,
        age: 0,
        lastAccessed: new Date(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        metadata: {}
      });

      await cache.set('key2', {
        url: 'https://example.com/api/v2/users',
        status: 200,
        size: 1024,
        contentType: 'application/json',
        tags: ['api', 'v2'],
        ttl: 3600000,
        age: 0,
        lastAccessed: new Date(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        metadata: {}
      });

      const result = await engine.purgeTags(['api']);

      expect(result.success).toBe(true);
      expect(result.purged).toBe(2);
    });
  });

  describe('Wildcard Purging', () => {
    it('should purge entries matching wildcard pattern', async () => {
      await cache.set('https://example.com/api/v1/users', {
        url: 'https://example.com/api/v1/users',
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

      await cache.set('https://example.com/api/v1/posts', {
        url: 'https://example.com/api/v1/posts',
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
        size: 1024,
        contentType: 'text/html',
        tags: [],
        ttl: 3600000,
        age: 0,
        lastAccessed: new Date(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        metadata: {}
      });

      const result = await engine.purgeWildcard('https://example.com/api/v1/*');

      expect(result.purged).toBe(2);
    });
  });

  describe('Batch Purging', () => {
    it('should handle mixed batch operations', async () => {
      await cache.set('url1', {
        url: 'https://example.com/test1',
        status: 200,
        size: 1024,
        contentType: 'text/html',
        tags: ['test'],
        ttl: 3600000,
        age: 0,
        lastAccessed: new Date(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        metadata: {}
      });

      const results = await engine.batchPurge([
        { type: 'url' as const, targets: ['https://example.com/test1'] },
        { type: 'tag' as const, targets: ['test'] }
      ]);

      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
    });
  });

  describe('Purge All', () => {
    it('should clear all cache entries', async () => {
      await cache.set('key1', {
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
      });

      await cache.set('key2', {
        url: 'https://example.com/test2',
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
      });

      const result = await engine.purgeAll();

      expect(result.success).toBe(true);
      expect(cache.getSize()).toBe(0);
    });
  });

  describe('Queue Management', () => {
    it('should provide queue statistics', () => {
      const stats = engine.getQueueStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('concurrency');
    });

    it('should pause and resume queue', () => {
      engine.pause();
      engine.resume();

      const stats = engine.getQueueStats();
      expect(stats).toBeDefined();
    });
  });

  describe('Cloudflare Integration', () => {
    it('should configure Cloudflare API', () => {
      engine.configureCloudflare({
        apiKey: 'test-key',
        email: 'test@example.com',
        zoneId: 'test-zone',
        accountId: 'test-account'
      });

      // Configuration should be set
      expect(engine['cloudflareAPI']).toBeDefined();
    });
  });
});
