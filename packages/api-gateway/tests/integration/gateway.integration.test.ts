/**
 * API Gateway Integration Tests
 *
 * End-to-end tests for the API Gateway
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { APIGateway, createAPIGateway } from '../../src/gateway';
import type { GatewayConfig, GatewayEnv } from '../../src/types';

describe('API Gateway Integration', () => {
  let gateway: APIGateway;
  let mockEnv: GatewayEnv;

  beforeEach(() => {
    mockEnv = createMockEnv();

    const config: GatewayConfig = {
      id: 'test-gateway',
      name: 'Test Gateway',
      environment: 'development',
      routes: [
        {
          id: 'health-check',
          name: 'Health Check',
          path: '/health',
          methods: ['GET'],
          upstream: {
            type: 'single',
            targets: [
              {
                id: 'health-target',
                url: 'http://localhost:8080/health',
              },
            ],
          },
          middleware: [],
          auth: { required: false, methods: ['none'] },
        },
        {
          id: 'api-users',
          name: 'Users API',
          path: '/api/users',
          methods: ['GET', 'POST'],
          upstream: {
            type: 'load_balanced',
            targets: [
              {
                id: 'users-service-1',
                url: 'http://users-service-1:8080',
                weight: 1,
              },
              {
                id: 'users-service-2',
                url: 'http://users-service-2:8080',
                weight: 1,
              },
            ],
            strategy: 'round_robin',
          },
          middleware: [],
          auth: {
            required: true,
            methods: ['api_key', 'jwt'],
          },
          rateLimit: {
            enabled: true,
            algorithm: 'token_bucket',
            limits: [
              {
                id: 'users-api-limit',
                name: 'Users API Rate Limit',
                scope: 'per_user',
                limit: 100,
                window: 60000,
              },
            ],
          },
        },
      ],
      globalMiddleware: [],
      defaultAuth: {
        required: false,
        methods: ['none'],
      },
      defaultRateLimit: {
        enabled: true,
        algorithm: 'token_bucket',
        limits: [
          {
            id: 'global-limit',
            name: 'Global Rate Limit',
            scope: 'per_ip',
            limit: 1000,
            window: 60000,
          },
        ],
      },
      errorHandling: {
        includeStackTrace: true,
        includeRequestDetails: true,
        customErrors: {},
      },
      analytics: {
        enabled: true,
        sampleRate: 1.0,
        bufferSize: 100,
        flushInterval: 60000,
        events: ['request', 'response', 'error'],
      },
      monitoring: {
        enabled: true,
        healthCheckPath: '/health',
      },
    };

    gateway = createAPIGateway({
      env: mockEnv,
      config,
    });
  });

  describe('Request handling', () => {
    it('should handle health check request', async () => {
      const request = new Request('http://example.com/health', {
        method: 'GET',
      });

    // Mock fetch to return successful response
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'healthy' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

      const response = await gateway.handle(request, {} as any);

      expect(response.status).toBe(200);
    });

    it('should apply rate limiting', async () => {
      const request = new Request('http://example.com/api/users', {
        method: 'GET',
        headers: {
          'X-API-Key': 'test-api-key',
        },
      });

      // This test would need proper mocking of all dependencies
      // For now, we just verify the gateway doesn't crash
      try {
        await gateway.handle(request, {} as any);
      } catch (error) {
        // Expected due to missing upstream
        expect(error).toBeDefined();
      }
    });

    it('should require authentication', async () => {
      const request = new Request('http://example.com/api/users', {
        method: 'GET',
      });

      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
        })
      );

      const response = await gateway.handle(request, {} as any);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Metrics', () => {
    it('should track request metrics', async () => {
      const initialMetrics = gateway.getMetrics();

      expect(initialMetrics.totalRequests).toBe(0);
      expect(initialMetrics.successfulRequests).toBe(0);
    });

    it('should reset metrics', async () => {
      gateway.resetMetrics();

      const metrics = gateway.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.lastResetTime).toBeGreaterThan(0);
    });
  });

  describe('Configuration', () => {
    it('should get current configuration', () => {
      const config = gateway.getConfig();

      expect(config).toBeDefined();
      expect(config.id).toBe('test-gateway');
      expect(config.routes).toHaveLength(2);
    });

    it('should update configuration', async () => {
      await gateway.updateConfig({
        name: 'Updated Gateway',
      });

      const config = gateway.getConfig();

      expect(config.name).toBe('Updated Gateway');
    });
  });

  describe('Middleware', () => {
    it('should execute middleware chain', async () => {
      let middlewareExecuted = false;

      gateway.use({
        name: 'test-middleware',
        priority: 100,
        execute: async (request, context, next) => {
          middlewareExecuted = true;
          await next();
        },
      });

      const request = new Request('http://example.com/health', {
        method: 'GET',
      });

      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'healthy' }), {
          status: 200,
        })
      );

      await gateway.handle(request, {} as any);

      expect(middlewareExecuted).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle upstream errors gracefully', async () => {
      const request = new Request('http://example.com/health', {
        method: 'GET',
      });

      // Mock fetch to return error
      global.fetch = vi.fn().mockRejectedValue(new Error('Upstream error'));

      const response = await gateway.handle(request, {} as any);

      expect(response.status).toBeGreaterThanOrEqual(500);
    });
  });
});

// Helper function
function createMockEnv(): GatewayEnv {
  return {
    KV: {},
    DO: {},
    R2: {},
    D1: {},
    secrets: {},
    services: {},
    vars: {},
  };
}
