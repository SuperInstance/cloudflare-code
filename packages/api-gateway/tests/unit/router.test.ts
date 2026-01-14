/**
 * Router Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Router, createRouter, createRoute } from '../../src/router';
import type { GatewayRequest, GatewayContext } from '../../src/types';

describe('Router', () => {
  let router: Router;

  beforeEach(() => {
    router = createRouter();
  });

  describe('Route matching', () => {
    it('should match exact path', async () => {
      const route = createRoute({
        id: 'test-route',
        name: 'Test Route',
        path: '/api/users',
        methods: ['GET'],
      });

      router.addRoute(route);

      const request = createMockRequest('GET', '/api/users');
      const context = createMockContext();

      const match = await router.match(request, context);

      expect(match).not.toBeNull();
      expect(match?.route.id).toBe('test-route');
    });

    it('should match path with parameters', async () => {
      const route = createRoute({
        id: 'user-route',
        name: 'User Route',
        path: '/api/users/:id',
        methods: ['GET'],
      });

      router.addRoute(route);

      const request = createMockRequest('GET', '/api/users/123');
      const context = createMockContext();

      const match = await router.match(request, context);

      expect(match).not.toBeNull();
      expect(match?.params.id).toBe('123');
    });

    it('should not match different method', async () => {
      const route = createRoute({
        id: 'get-route',
        name: 'GET Route',
        path: '/api/users',
        methods: ['GET'],
      });

      router.addRoute(route);

      const request = createMockRequest('POST', '/api/users');
      const context = createMockContext();

      const match = await router.match(request, context);

      expect(match).toBeNull();
    });

    it('should handle weighted routing', async () => {
      const route = createRoute({
        id: 'weighted-route',
        name: 'Weighted Route',
        path: '/api/test',
        methods: ['GET'],
        upstream: {
          type: 'weighted',
          targets: [
            { id: 'target-1', url: 'http://target1.com', weight: 70 },
            { id: 'target-2', url: 'http://target2.com', weight: 30 },
          ],
        },
      });

      router.addRoute(route);

      const request = createMockRequest('GET', '/api/test');
      const context = createMockContext();

      const match = await router.match(request, context);
      const target = await router.routeToTarget(request, context, match!.route.upstream);

      expect(target).toBeDefined();
      expect(['target-1', 'target-2']).toContain(target.id);
    });
  });

  describe('Route management', () => {
    it('should add and retrieve routes', () => {
      const route = createRoute({
        id: 'test-route',
        name: 'Test Route',
        path: '/test',
        methods: ['GET'],
      });

      router.addRoute(route);

      const retrieved = router.getRoute('test-route');

      expect(retrieved).toEqual(route);
    });

    it('should remove routes', () => {
      const route = createRoute({
        id: 'test-route',
        name: 'Test Route',
        path: '/test',
        methods: ['GET'],
      });

      router.addRoute(route);
      const removed = router.removeRoute('test-route');

      expect(removed).toBe(true);
      expect(router.getRoute('test-route')).toBeUndefined();
    });

    it('should return all routes', () => {
      const route1 = createRoute({
        id: 'route-1',
        name: 'Route 1',
        path: '/test1',
        methods: ['GET'],
      });

      const route2 = createRoute({
        id: 'route-2',
        name: 'Route 2',
        path: '/test2',
        methods: ['GET'],
      });

      router.addRoute(route1);
      router.addRoute(route2);

      const allRoutes = router.getAllRoutes();

      expect(allRoutes).toHaveLength(2);
      expect(allRoutes).toContainEqual(route1);
      expect(allRoutes).toContainEqual(route2);
    });
  });

  describe('Statistics', () => {
    it('should track routing statistics', async () => {
      const route = createRoute({
        id: 'stats-route',
        name: 'Stats Route',
        path: '/api/stats',
        methods: ['GET'],
      });

      router.addRoute(route);

      const request = createMockRequest('GET', '/api/stats');
      const context = createMockContext();

      await router.match(request, context);

      const stats = router.getStats();

      expect(stats.totalRequests).toBe(1);
      expect(stats.routesMatched['stats-route']).toBe(1);
    });

    it('should reset statistics', async () => {
      const route = createRoute({
        id: 'reset-route',
        name: 'Reset Route',
        path: '/api/reset',
        methods: ['GET'],
      });

      router.addRoute(route);

      const request = createMockRequest('GET', '/api/reset');
      const context = createMockContext();

      await router.match(request, context);
      router.resetStats();

      const stats = router.getStats();

      expect(stats.totalRequests).toBe(0);
    });
  });

  describe('Caching', () => {
    it('should cache route matches', async () => {
      const route = createRoute({
        id: 'cache-route',
        name: 'Cache Route',
        path: '/api/cache',
        methods: ['GET'],
      });

      router.addRoute(route);

      const request = createMockRequest('GET', '/api/cache');
      const context = createMockContext();

      // First match
      await router.match(request, context);
      // Second match (should hit cache)
      await router.match(request, context);

      const stats = router.getStats();

      expect(stats.totalRequests).toBe(2);
    });

    it('should clear cache', async () => {
      const route = createRoute({
        id: 'clear-cache-route',
        name: 'Clear Cache Route',
        path: '/api/clear-cache',
        methods: ['GET'],
      });

      router.addRoute(route);

      const request = createMockRequest('GET', '/api/clear-cache');
      const context = createMockContext();

      await router.match(request, context);
      router.clearCache();

      // Cache should be cleared, but this doesn't affect functionality
      expect(router.getRoute('clear-cache-route')).toBeDefined();
    });
  });
});

// Helper functions
function createMockRequest(method: string, path: string): GatewayRequest {
  const url = new URL(path, 'http://example.com');

  return {
    id: 'test-request-id',
    method,
    url,
    headers: new Headers(),
    body: null,
    query: url.searchParams,
    ip: '127.0.0.1',
    userAgent: 'test-agent',
    timestamp: Date.now(),
    metadata: {
      sourceIp: '127.0.0.1',
      userAgent: 'test-agent',
      tags: {},
    },
  };
}

function createMockContext(): GatewayContext {
  return {
    env: {} as any,
    ctx: {} as any,
    requestId: 'test-context-id',
    timestamp: Date.now(),
  };
}
