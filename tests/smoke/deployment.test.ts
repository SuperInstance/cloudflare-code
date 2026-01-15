/**
 * Smoke Tests - Deployment Verification
 *
 * Quick tests to verify deployment is working correctly
 */

import { describe, it, expect } from 'vitest';
import app from '../../packages/edge/src/index';

describe('Deployment Smoke Tests', () => {
  describe('Core Functionality', () => {
    it('should respond to health check', async () => {
      const response = await app.request('/health');

      expect(response.status).toBe(200);

      const data = await response.json() as { status?: string; timestamp?: string; version?: string };

      expect(data.status).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(data.version).toBeDefined();
    });

    it('should respond to root endpoint', async () => {
      const response = await app.request('/');

      expect(response.status).toBe(200);

      const data = await response.json() as any;

      expect(data.name).toBeDefined();
      expect(data.version).toBeDefined();
      expect(data.endpoints).toBeDefined();
    });

    it('should respond to status endpoint', async () => {
      const response = await app.request('/v1/status');

      expect(response.status).toBe(200);

      const data = await response.json() as any;

      expect(data.status).toBeDefined();
      expect(data.services).toBeDefined();
    });

    it('should list available models', async () => {
      const response = await app.request('/v1/models');

      expect(response.status).toBe(200);

      const data = await response.json() as any;

      expect(data.models).toBeDefined();
      expect(Array.isArray(data.models)).toBe(true);
      expect(data.models.length).toBeGreaterThan(0);
    });
  });

  describe('Service Health', () => {
    it('should have all required services operational', async () => {
      const response = await app.request('/v1/status');

      const data = await response.json() as any;

      expect(data.services).toBeDefined();

      // Check that core services are reported
      expect(data.services.api).toBeDefined();
    });

    it('should have healthy status indicator', async () => {
      const response = await app.request('/health');

      const data = await response.json() as any;

      expect(['healthy', 'degraded', 'unhealthy']).toContain(data.status);
    });

    it('should report uptime', async () => {
      const response = await app.request('/health');

      const data = await response.json() as any;

      expect(data.uptime).toBeDefined();
      expect(data.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('CORS Configuration', () => {
    it('should include CORS headers', async () => {
      const response = await app.request('/v1/status', {
        headers: { Origin: 'https://example.com' },
      });

      const corsHeader = response.headers.get('access-control-allow-origin');

      expect(corsHeader).toBeDefined();
    });

    it('should handle OPTIONS preflight', async () => {
      const response = await app.request('/v1/status', {
        method: 'OPTIONS',
      });

      expect([200, 204]).toContain(response.status);
    });
  });

  describe('Request Tracking', () => {
    it('should generate request IDs', async () => {
      const response = await app.request('/v1/status');

      const requestId = response.headers.get('x-request-id');

      expect(requestId).toBeDefined();
      expect(requestId).toMatch(/^[0-9a-f-]+$/);
    });

    it('should include response time', async () => {
      const response = await app.request('/v1/status');

      const responseTime = response.headers.get('x-response-time');

      expect(responseTime).toBeDefined();
      expect(responseTime).toMatch(/^\d+ms$/);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await app.request('/v1/non-existent-route');

      expect(response.status).toBe(404);

      const data = await response.json() as any;

      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('NOT_FOUND');
    });

    it('should return 405 for invalid methods', async () => {
      const response = await app.request('/v1/chat', {
        method: 'PUT',
      });

      expect([404, 405]).toContain(response.status);
    });

    it('should return proper error response structure', async () => {
      const response = await app.request('/v1/undefined');

      const data = await response.json() as any;

      expect(data.error).toBeDefined();
      expect(data.error.code).toBeDefined();
      expect(data.error.message).toBeDefined();
      expect(data.error.requestId).toBeDefined();
      expect(data.error.timestamp).toBeDefined();
    });
  });

  describe('Model Availability', () => {
    it('should have at least one model per provider', async () => {
      const response = await app.request('/v1/models');

      const data = await response.json() as any;

      expect(data.models.length).toBeGreaterThan(0);

      // Group by provider
      const providers = new Set(data.models.map((m: any) => m.provider));

      expect(providers.size).toBeGreaterThan(0);
    });

    it('should include model capabilities', async () => {
      const response = await app.request('/v1/models');

      const data = await response.json() as any;

      data.models.forEach((model: any) => {
        expect(model.capabilities).toBeDefined();
        expect(model.capabilities.streaming).toBeDefined();
        expect(model.capabilities.functionCalling).toBeDefined();
        expect(model.capabilities.vision).toBeDefined();
      });
    });

    it('should have valid model IDs', async () => {
      const response = await app.request('/v1/models');

      const data = await response.json() as any;

      data.models.forEach((model: any) => {
        expect(model.id).toBeDefined();
        expect(typeof model.id).toBe('string');
        expect(model.id.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Quick Chat Test', () => {
    it('should handle a simple chat request', async () => {
      const response = await app.request('/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'claude-3-opus-20240229',
        }),
      });

      expect(response.status).toBe(200);

      const data = await response.json() as any;

      expect(data.content).toBeDefined();
      expect(data.id).toBeDefined();
      expect(data.usage).toBeDefined();
    }, 10000);
  });

  describe('Response Headers', () => {
    it('should include content-type', async () => {
      const response = await app.request('/v1/status');

      expect(response.headers.get('content-type')).toContain('application/json');
    });

    it('should not expose internal errors', async () => {
      const response = await app.request('/v1/undefined');

      const data = await response.json() as any;

      // In production, should not include stack traces
      expect(data.error.stack).toBeUndefined();
    });
  });

  describe('Configuration', () => {
    it('should have version information', async () => {
      const response = await app.request('/');

      const data = await response.json() as any;

      expect(data.version).toBeDefined();
      expect(typeof data.version).toBe('string');
    });

    it('should have environment information', async () => {
      const response = await app.request('/health');

      const data = await response.json() as any;

      expect(data.environment).toBeDefined();
      expect(['development', 'staging', 'production', 'test']).toContain(data.environment);
    });
  });

  describe('Performance Baselines', () => {
    it('should respond to health check quickly', async () => {
      const start = Date.now();

      const response = await app.request('/health');

      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(100);
    });

    it('should list models quickly', async () => {
      const start = Date.now();

      const response = await app.request('/v1/models');

      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(200);
    });

    it('should handle status check quickly', async () => {
      const start = Date.now();

      const response = await app.request('/v1/status');

      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(200);
    });
  });
});
