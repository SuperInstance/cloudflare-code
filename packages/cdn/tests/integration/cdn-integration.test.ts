/**
 * CDN Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CDN } from '../../src/index.js';
import type { ICDNConfig } from '../../src/types/index.js';

describe('CDN Integration', () => {
  let cdn: CDN;

  beforeEach(() => {
    const config: ICDNConfig = {
      provider: 'cloudflare',
      cachePolicies: [],
      cacheRules: [],
      analytics: true
    };

    cdn = new CDN(config);
  });

  afterEach(async () => {
    await cdn.destroy();
  });

  describe('Request Handling', () => {
    it('should handle GET request', async () => {
      // Mock fetch
      global.fetch = async (url: string) => {
        return {
          ok: true,
          status: 200,
          text: async () => 'test content',
          headers: {
            get: (name: string) => {
              const headers: Record<string, string> = {
                'content-type': 'text/plain',
                'cache-control': 'max-age=3600'
              };
              return headers[name] || null;
            }
          }
        } as any;
      };

      const response = await cdn.handleRequest({
        url: 'https://example.com/test',
        method: 'GET',
        headers: {
          'user-agent': 'test'
        }
      });

      expect(response.status).toBe(200);
      expect(response.fromCache).toBe(false);
    });

    it('should serve subsequent requests from cache', async () => {
      let requestCount = 0;

      global.fetch = async (url: string) => {
        requestCount++;
        return {
          ok: true,
          status: 200,
          text: async () => 'test content',
          headers: {
            get: (name: string) => {
              const headers: Record<string, string> = {
                'content-type': 'text/plain',
                'cache-control': 'max-age=3600'
              };
              return headers[name] || null;
            }
          }
        } as any;
      };

      const context = {
        url: 'https://example.com/test',
        method: 'GET',
        headers: {}
      };

      // First request
      const response1 = await cdn.handleRequest(context);
      expect(response1.fromCache).toBe(false);

      // Second request
      const response2 = await cdn.handleRequest(context);
      expect(response2.fromCache).toBe(true);

      expect(requestCount).toBe(1);
    });

    it('should bypass cache for admin routes', async () => {
      let requestCount = 0;

      global.fetch = async (url: string) => {
        requestCount++;
        return {
          ok: true,
          status: 200,
          text: async () => 'admin content',
          headers: {
            get: (name: string) => name === 'content-type' ? 'text/html' : null
          }
        } as any;
      };

      const context = {
        url: 'https://example.com/admin/users',
        method: 'GET',
        headers: {}
      };

      // Multiple requests should all hit origin
      await cdn.handleRequest(context);
      await cdn.handleRequest(context);
      await cdn.handleRequest(context);

      expect(requestCount).toBe(3);
    });
  });

  describe('Cache Invalidation', () => {
    it('should purge URLs', async () => {
      // Add to cache first
      global.fetch = async (url: string) => {
        return {
          ok: true,
          status: 200,
          text: async () => 'test',
          headers: {
            get: () => 'text/plain'
          }
        } as any;
      };

      const context = {
        url: 'https://example.com/test',
        method: 'GET',
        headers: {}
      };

      await cdn.handleRequest(context);

      // Purge
      const result = await cdn.purge('url', ['https://example.com/test']);
      expect(result.success).toBe(true);
    });

    it('should purge all cache', async () => {
      const result = await cdn.purge('all');
      expect(result.success).toBe(true);
    });
  });

  describe('Analytics', () => {
    it('should track requests', async () => {
      global.fetch = async (url: string) => {
        return {
          ok: true,
          status: 200,
          text: async () => 'test',
          headers: {
            get: () => 'text/plain'
          }
        } as any;
      };

      await cdn.handleRequest({
        url: 'https://example.com/test',
        method: 'GET',
        headers: {}
      });

      const summary = cdn.getSummary();
      expect(summary.requests.total).toBeGreaterThan(0);
    });

    it('should provide analytics summary', () => {
      const summary = cdn.getSummary();

      expect(summary).toHaveProperty('period');
      expect(summary).toHaveProperty('requests');
      expect(summary).toHaveProperty('bandwidth');
      expect(summary).toHaveProperty('performance');
    });
  });

  describe('Cache Statistics', () => {
    it('should return cache statistics', () => {
      const stats = cdn.getCacheStats();

      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('avgResponseTime');
    });
  });

  describe('Cache Warmup', () => {
    it('should warm cache with URLs', async () => {
      global.fetch = async (url: string) => {
        return {
          ok: true,
          status: 200,
          text: async () => 'test',
          headers: {
            get: () => 'text/plain'
          }
        } as any;
      };

      await cdn.warmCache([
        'https://example.com/page1',
        'https://example.com/page2'
      ]);

      const stats = cdn.getCacheStats();
      // Cache should have entries
      expect(stats).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      global.fetch = async () => {
        throw new Error('Network error');
      };

      await expect(
        cdn.handleRequest({
          url: 'https://example.com/test',
          method: 'GET',
          headers: {}
        })
      ).rejects.toThrow();
    });

    it('should record error in analytics', async () => {
      global.fetch = async () => {
        throw new Error('Network error');
      };

      try {
        await cdn.handleRequest({
          url: 'https://example.com/test',
          method: 'GET',
          headers: {}
        });
      } catch (error) {
        // Expected
      }

      const analytics = cdn.getAnalytics();
      expect(analytics).toBeDefined();
    });
  });
});
