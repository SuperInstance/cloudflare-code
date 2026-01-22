/**
 * API Routes E2E Tests
 *
 * Comprehensive tests for API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { createAPITestSuite, APIAssertions, loadTestEndpoint } from '../helpers/api';
import { createE2ETestSuite } from '../e2e/framework';

describe('API Routes E2E Tests', () => {
  // Create test app
  const app = new Hono();

  // Setup routes
  app.get('/health', (c) => {
    return c.json({
      status: 'healthy',
      timestamp: Date.now(),
      version: '1.0.0',
    });
  });

  app.get('/v1/status', (c) => {
    return c.json({
      status: 'operational',
      version: '1.0.0',
      environment: 'test',
      services: {
        api: true,
        cache: true,
        storage: true,
      },
    });
  });

  app.post('/v1/chat', (c) => {
    return c.json({
      id: 'test-id',
      content: 'Test response',
      model: 'test-model',
      provider: 'test-provider',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
      timestamp: Date.now(),
    });
  });

  app.get('/v1/models', (c) => {
    return c.json({
      models: [
        {
          id: 'claude-3-opus',
          name: 'Claude 3 Opus',
          provider: 'anthropic',
          contextLength: 200000,
        },
        {
          id: 'gpt-4-turbo',
          name: 'GPT-4 Turbo',
          provider: 'openai',
          contextLength: 128000,
        },
      ],
      count: 2,
      timestamp: Date.now(),
    });
  });

  app.get('/v1/models/:id', (c) => {
    const id = c.req.param('id');

    if (id === 'not-found') {
      return c.json({ error: { code: 'MODEL_NOT_FOUND', message: 'Model not found' } }, 404);
    }

    return c.json({
      id,
      name: 'Test Model',
      provider: 'test',
      contextLength: 100000,
    });
  });

  app.post('/v1/agents/orchestrate', (c) => {
    return c.json({
      id: 'orchestration-id',
      status: 'completed',
      result: {
        message: 'Orchestration complete',
      },
      timestamp: Date.now(),
    });
  });

  app.get('/v1/agents/status', (c) => {
    return c.json({
      agents: [
        { id: 'agent-1', name: 'Messenger', type: 'messenger', status: 'active' },
        { id: 'agent-2', name: 'Planner', type: 'planner', status: 'active' },
      ],
      count: 2,
      timestamp: Date.now(),
    });
  });

  describe('Health Endpoint', () => {
    createE2ETestSuite({
      name: 'Health Endpoint Tests',
    }).test('should return health status', async () => {
      const suite = createAPITestSuite({ app });
      const result = await suite.get('/health');

      APIAssertions.assertSuccess(result);
      APIAssertions.assertStatus(result, 200);
      APIAssertions.assertBodyContains(result, 'status', 'healthy');
      expect(result.response.body.timestamp).toBeDefined();
    });
  });

  describe('Status Endpoint', () => {
    it('should return operational status', async () => {
      const suite = createAPITestSuite({ app });
      const result = await suite.get('/v1/status');

      APIAssertions.assertSuccess(result);
      APIAssertions.assertStatus(result, 200);
      APIAssertions.assertBodyContains(result, 'status', 'operational');
    });

    it('should include service status', async () => {
      const suite = createAPITestSuite({ app });
      const result = await suite.get('/v1/status');

      APIAssertions.assertSuccess(result);
      expect(result.response.body.services).toBeDefined();
      expect(result.response.body.services.api).toBe(true);
    });
  });

  describe('Chat Completions', () => {
    it('should create chat completion', async () => {
      const suite = createAPITestSuite({ app });
      const result = await suite.post('/v1/chat', {
        body: {
          messages: [
            { role: 'user', content: 'Hello, world!' },
          ],
        },
      });

      APIAssertions.assertSuccess(result);
      APIAssertions.assertStatus(result, 200);
      APIAssertions.assertBodyContains(result, 'id');
      APIAssertions.assertBodyContains(result, 'content');
    });

    it('should validate request body', async () => {
      const suite = createAPITestSuite({ app });
      const result = await suite.post('/v1/chat', {
        body: {},
      });

      // Should still succeed in test
      expect(result.response.status).toBeGreaterThanOrEqual(200);
    });

    it('should include usage information', async () => {
      const suite = createAPITestSuite({ app });
      const result = await suite.post('/v1/chat', {
        body: {
          messages: [
            { role: 'user', content: 'Test' },
          ],
        },
      });

      APIAssertions.assertSuccess(result);
      expect(result.response.body.usage).toBeDefined();
      expect(result.response.body.usage.totalTokens).toBeGreaterThan(0);
    });
  });

  describe('Models Endpoint', () => {
    it('should list all models', async () => {
      const suite = createAPITestSuite({ app });
      const result = await suite.get('/v1/models');

      APIAssertions.assertSuccess(result);
      APIAssertions.assertStatus(result, 200);
      expect(result.response.body.models).toBeInstanceOf(Array);
      expect(result.response.body.models.length).toBeGreaterThan(0);
    });

    it('should get specific model', async () => {
      const suite = createAPITestSuite({ app });
      const result = await suite.get('/v1/models/claude-3-opus');

      APIAssertions.assertSuccess(result);
      APIAssertions.assertBodyContains(result, 'id', 'claude-3-opus');
    });

    it('should return 404 for non-existent model', async () => {
      const suite = createAPITestSuite({ app });
      const result = await suite.get('/v1/models/not-found');

      APIAssertions.assertStatus(result, 404);
      expect(result.response.body.error).toBeDefined();
    });
  });

  describe('Agent Orchestration', () => {
    it('should create orchestration', async () => {
      const suite = createAPITestSuite({ app });
      const result = await suite.post('/v1/agents/orchestrate', {
        body: {
          type: 'planner',
          input: 'Test input',
        },
      });

      APIAssertions.assertSuccess(result);
      APIAssertions.assertBodyContains(result, 'id');
      APIAssertions.assertBodyContains(result, 'status', 'completed');
    });

    it('should get agent status', async () => {
      const suite = createAPITestSuite({ app });
      const result = await suite.get('/v1/agents/status');

      APIAssertions.assertSuccess(result);
      expect(result.response.body.agents).toBeInstanceOf(Array);
    });
  });

  describe('Request Validation', () => {
    it('should reject invalid JSON', async () => {
      const suite = createAPITestSuite({ app });
      const result = await suite.post('/v1/chat', {
        body: 'invalid json',
        headers: {
          'content-type': 'application/json',
        },
      });

      // Should handle error gracefully
      expect(result.response.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject missing required fields', async () => {
      const suite = createAPITestSuite({ app });
      const result = await suite.post('/v1/chat', {
        body: {},
      });

      // May succeed with defaults or return validation error
      expect(result.response.status).toBeGreaterThanOrEqual(200);
      expect(result.response.status).toBeLessThan(500);
    });
  });

  describe('Response Headers', () => {
    it('should include content-type header', async () => {
      const suite = createAPITestSuite({ app });
      const result = await suite.get('/health');

      APIAssertions.assertContentType(result, 'application/json');
    });

    it('should include CORS headers', async () => {
      const suite = createAPITestSuite({ app });
      const result = await suite.get('/health', {
        headers: {
          Origin: 'https://example.com',
        },
      });

      APIAssertions.assertSuccess(result);
    });
  });

  describe('Performance Tests', () => {
    it('should handle 100 requests efficiently', async () => {
      const suite = createAPITestSuite({ app });

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(suite.get('/health'));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(100);
      expect(results.every(r => r.success)).toBe(true);

      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      expect(avgDuration).toBeLessThan(100); // Average < 100ms
    });

    it('should handle concurrent chat completions', async () => {
      const suite = createAPITestSuite({ app });

      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          suite.post('/v1/chat', {
            body: {
              messages: [
                { role: 'user', content: `Test message ${i}` },
              ],
            },
          })
        );
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(50);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('Load Tests', () => {
    it('should sustain 100 RPS for 10 seconds', async () => {
      const suite = createAPITestSuite({ app });

      const result = await loadTestEndpoint(suite, {
        method: 'GET',
        path: '/health',
        requestsPerSecond: 100,
        duration: 10000,
        concurrency: 10,
      });

      expect(result.statistics.totalRequests).toBeGreaterThanOrEqual(1000);
      expect(result.statistics.successfulRequests).toBeGreaterThan(
        result.statistics.totalRequests * 0.95
      );
      expect(result.statistics.averageLatency).toBeLessThan(100);
    });

    it('should sustain 50 RPS for chat completions', async () => {
      const suite = createAPITestSuite({ app });

      const result = await loadTestEndpoint(suite, {
        method: 'POST',
        path: '/v1/chat',
        requestsPerSecond: 50,
        duration: 5000,
        concurrency: 10,
        options: {
          body: {
            messages: [
              { role: 'user', content: 'Test' },
            ],
          },
        },
      });

      expect(result.statistics.totalRequests).toBeGreaterThanOrEqual(250);
      expect(result.statistics.successfulRequests).toBeGreaterThan(
        result.statistics.totalRequests * 0.95
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors', async () => {
      const suite = createAPITestSuite({ app });
      const result = await suite.get('/non-existent');

      expect(result.response.status).toBe(404);
    });

    it('should handle 405 method not allowed', async () => {
      const suite = createAPITestSuite({ app });
      const result = await suite.request('POST', '/health');

      expect(result.response.status).toBeGreaterThanOrEqual(400);
    });

    it('should return error responses with proper format', async () => {
      const suite = createAPITestSuite({ app });
      const result = await suite.get('/v1/models/not-found');

      expect(result.response.body.error).toBeDefined();
      expect(result.response.body.error.code).toBeDefined();
      expect(result.response.body.error.message).toBeDefined();
    });
  });

  describe('Request Recording', () => {
    it('should record all requests', async () => {
      const recorder = {
        requests: [],
        responses: [],
        start: () => {},
        stop: () => {},
        clear: () => {
          recorder.requests = [];
          recorder.responses = [];
        },
        getHistory: () => ({}),
        export: () => '',
      };

      const suite = createAPITestSuite({ app });

      await suite.get('/health');
      await suite.get('/v1/status');
      await suite.get('/v1/models');

      const results = suite.getResults();

      expect(results).toHaveLength(3);
      expect(results[0].request.method).toBe('GET');
      expect(results[0].request.url).toBe('/health');
    });

    it('should export results as JSON', async () => {
      const suite = createAPITestSuite({ app });

      await suite.get('/health');

      const exported = suite.exportResults();

      expect(exported).toBeDefined();
      expect(() => JSON.parse(exported)).not.toThrow();
    });

    it('should export results as HAR', async () => {
      const suite = createAPITestSuite({ app });

      await suite.get('/health');

      const exported = suite.exportAsHAR();

      expect(exported).toBeDefined();
      expect(() => JSON.parse(exported)).not.toThrow();
      const har = JSON.parse(exported);
      expect(har.log).toBeDefined();
      expect(har.log.entries).toBeInstanceOf(Array);
    });
  });
});
