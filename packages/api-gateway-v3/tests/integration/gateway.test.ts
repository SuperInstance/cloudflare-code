/**
 * Integration Tests - API Gateway
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { APIGateway, createGateway } from '../../src/gateway.js';
import type { GatewayConfig, GatewayRequest } from '../../src/types/index.js';

describe('API Gateway Integration', () => {
  let gateway: APIGateway;
  let config: GatewayConfig;

  beforeAll(async () => {
    config = {
      id: 'test-gateway',
      name: 'Test Gateway',
      environment: 'development',
      services: [
        {
          id: 'users-service',
          name: 'Users Service',
          version: '1.0.0',
          endpoint: 'https://api.users.example.com',
          timeout: 5000,
          metadata: {
            description: 'User management service',
            tags: ['users', 'core'],
          },
        },
        {
          id: 'posts-service',
          name: 'Posts Service',
          version: '1.0.0',
          endpoint: 'https://api.posts.example.com',
          timeout: 5000,
          metadata: {
            description: 'Post management service',
            tags: ['posts', 'content'],
          },
        },
      ],
      routes: [
        {
          id: 'get-users',
          path: '/api/users',
          method: ['GET'],
          serviceId: 'users-service',
        },
        {
          id: 'get-posts',
          path: '/api/posts',
          method: ['GET'],
          serviceId: 'posts-service',
        },
      ],
      middleware: [
        {
          name: 'logging',
          enabled: true,
          order: 1,
        },
        {
          name: 'cors',
          enabled: true,
          order: 2,
        },
      ],
      analytics: {
        enabled: true,
        batchSize: 100,
        flushInterval: 10000,
        sampling: 1.0,
        metrics: [
          {
            name: 'request.count',
            type: 'counter',
            enabled: true,
          },
          {
            name: 'request.duration',
            type: 'histogram',
            enabled: true,
          },
        ],
      },
      edge: {
        enabled: true,
        functions: [],
        cache: {
          enabled: true,
          ttl: 3600000,
          purgeKeys: [],
          cacheKeys: [],
        },
        routing: {
          strategy: 'latency',
          regions: [
            {
              name: 'us-east-1',
              code: 'use1',
              endpoint: 'https://use1.example.com',
              latitude: 40.7128,
              longitude: -74.0060,
              healthy: true,
            },
          ],
          healthCheck: false,
          healthCheckInterval: 30000,
        },
      },
      caching: {
        enabled: true,
        defaultTTL: 3600000,
        maxSize: 1000,
        evictionPolicy: 'lru',
        compression: true,
      },
      rateLimit: {
        enabled: true,
        defaultLimit: 100,
        defaultWindow: 60000,
        storage: 'memory',
      },
      circuitBreaker: {
        enabled: true,
        defaultThreshold: 0.5,
        defaultResetTimeout: 60000,
        monitoringEnabled: true,
      },
      versioning: {
        strategy: 'header',
        defaultVersion: 'v1',
        versions: [
          {
            version: 'v1',
            serviceIds: ['users-service', 'posts-service'],
          },
        ],
      },
      graphql: {
        enabled: false,
        endpoint: '/graphql',
        subscriptions: false,
      },
    };

    gateway = createGateway(config);
    await gateway.initialize();
  });

  afterAll(async () => {
    await gateway.shutdown();
  });

  describe('request handling', () => {
    it('should handle GET request', async () => {
      const request: GatewayRequest = {
        id: 'req-1',
        timestamp: Date.now(),
        method: 'GET',
        url: 'https://api.example.com/api/users',
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
        body: null,
        query: new URLSearchParams(),
        params: {},
        context: {} as any,
        metadata: {
          sourceIp: '127.0.0.1',
          userAgent: 'test-agent',
        },
      };

      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        body: JSON.stringify({ users: [] }),
      } as Response);

      const response = await gateway.handle(request);

      expect(response.status).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      const request: GatewayRequest = {
        id: 'req-2',
        timestamp: Date.now(),
        method: 'GET',
        url: 'https://api.example.com/nonexistent',
        headers: new Headers(),
        body: null,
        query: new URLSearchParams(),
        params: {},
        context: {} as any,
        metadata: {
          sourceIp: '127.0.0.1',
          userAgent: 'test-agent',
        },
      };

      const response = await gateway.handle(request);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('composition', () => {
    it('should execute composition request', async () => {
      // Mock fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ result: 'success' }),
      } as Response);

      const result = await gateway.executeComposition({
        requestId: 'comp-1',
        operations: [
          {
            id: 'op1',
            serviceId: 'users-service',
            method: 'GET',
            path: '/users',
            params: {},
          },
        ],
        mergeStrategy: 'parallel',
        errorPolicy: 'continue',
      });

      expect(result.requestId).toBe('comp-1');
      expect(result.data).toBeDefined();
    });
  });

  describe('analytics', () => {
    it('should record analytics events', () => {
      const analytics = gateway.getAnalytics();

      analytics.recordEvent({
        id: 'event-1',
        timestamp: Date.now(),
        type: 'request-start',
        data: {
          requestId: 'req-1',
          method: 'GET',
        },
      });

      const metrics = analytics.getMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('metrics', () => {
    it('should aggregate metrics from all components', () => {
      const metrics = gateway.getMetrics();

      expect(metrics.composition).toBeDefined();
      expect(metrics.streaming).toBeDefined();
      expect(metrics.edge).toBeDefined();
      expect(metrics.orchestration).toBeDefined();
    });
  });
});
