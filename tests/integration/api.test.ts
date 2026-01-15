/**
 * Integration Tests - API Routes
 *
 * Test full request/response flows through the API
 */

import { describe, it, expect } from 'vitest';
import app from '../../packages/edge/src/index';
import type { ChatRequest, HealthResponse, StatusResponse, ModelsResponse } from '../../packages/edge/src/types';

describe('Health Endpoint Integration', () => {
  it('should return healthy status', async () => {
    const response = await app.request('/health');

    expect(response.status).toBe(200);

    const data: HealthResponse = await response.json();

    expect(data.status).toBe('healthy');
    expect(data.timestamp).toBeDefined();
    expect(data.version).toBeDefined();
    expect(data.environment).toBeDefined();
    expect(data.uptime).toBeGreaterThan(0);
  });

  it('should include correct headers', async () => {
    const response = await app.request('/health');

    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('x-request-id')).toBeDefined();
  });
});

describe('Status Endpoint Integration', () => {
  it('should return operational status', async () => {
    const response = await app.request('/v1/status');

    expect(response.status).toBe(200);

    const data: StatusResponse = await response.json();

    expect(data.status).toBe('operational');
    expect(data.version).toBeDefined();
    expect(data.environment).toBeDefined();
    expect(data.timestamp).toBeDefined();
    expect(data.services).toBeDefined();
    expect(data.services.api).toBe(true);
  });

  it('should include metrics when available', async () => {
    const response = await app.request('/v1/status');

    const data: StatusResponse = await response.json();

    expect(data.metrics).toBeDefined();
    expect(data.metrics.requestsPerSecond).toBeDefined();
    expect(data.metrics.averageLatency).toBeDefined();
    expect(data.metrics.errorRate).toBeDefined();
  });
});

describe('Models Endpoint Integration', () => {
  it('should list all available models', async () => {
    const response = await app.request('/v1/models');

    expect(response.status).toBe(200);

    const data: ModelsResponse = await response.json();

    expect(data.models).toBeDefined();
    expect(Array.isArray(data.models)).toBe(true);
    expect(data.models.length).toBeGreaterThan(0);
    expect(data.count).toBe(data.models.length);
    expect(data.timestamp).toBeDefined();
  });

  it('should include model details', async () => {
    const response = await app.request('/v1/models');

    const data: ModelsResponse = await response.json();
    const model = data.models[0];

    if (!model) {
      throw new Error('No models available');
    }

    expect(model.id).toBeDefined();
    expect(model.name).toBeDefined();
    expect(model.provider).toBeDefined();
    expect(model.contextLength).toBeGreaterThan(0);
    expect(model.description).toBeDefined();
    expect(model.capabilities).toBeDefined();
    expect(model.capabilities.streaming).toBeDefined();
    expect(model.capabilities.functionCalling).toBeDefined();
    expect(model.capabilities.vision).toBeDefined();
  });

  it('should get specific model by ID', async () => {
    const listResponse = await app.request('/v1/models');
    const listData: ModelsResponse = await listResponse.json();
    const modelId = listData.models[0]?.id;

    if (!modelId) {
      throw new Error('No models available');
    }

    const response = await app.request(`/v1/models/${modelId}`);

    expect(response.status).toBe(200);

    const model = await response.json() as any;

    expect(model.id).toBe(modelId);
    expect(model.name).toBeDefined();
  });

  it('should return 404 for non-existent model', async () => {
    const response = await app.request('/v1/models/non-existent-model');

    expect(response.status).toBe(404);
  });
});

describe('Chat Endpoint Integration', () => {
  describe('valid requests', () => {
    it('should handle simple chat request', async () => {
      const request: ChatRequest = {
        messages: [
          { role: 'user', content: 'Hello, how are you?' },
        ],
        model: 'claude-3-opus-20240229',
        provider: 'anthropic',
        temperature: 0.7,
        maxTokens: 1000,
      };

      const response = await app.request('/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      expect(response.status).toBe(200);

      const data = await response.json() as any;

      expect(data.id).toBeDefined();
      expect(data.content).toBeDefined();
      expect(data.model).toBeDefined();
      expect(data.provider).toBeDefined();
      expect(data.finishReason).toBeDefined();
      expect(data.usage).toBeDefined();
      expect(data.usage.promptTokens).toBeGreaterThan(0);
      expect(data.usage.completionTokens).toBeGreaterThan(0);
      expect(data.usage.totalTokens).toBeGreaterThan(0);
      expect(data.timestamp).toBeDefined();
    });

    it('should handle multi-turn conversation', async () => {
      const request: ChatRequest = {
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'What is the capital of France?' },
          { role: 'assistant', content: 'The capital of France is Paris.' },
          { role: 'user', content: 'What is its population?' },
        ],
        model: 'claude-3-opus-20240229',
        provider: 'anthropic',
      };

      const response = await app.request('/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      expect(response.status).toBe(200);

      const data = await response.json() as any;

      expect(data.content).toBeDefined();
      expect(data.content.length).toBeGreaterThan(0);
    });

    it('should handle request with session ID', async () => {
      const request: ChatRequest = {
        messages: [
          { role: 'user', content: 'Test message' },
        ],
        model: 'claude-3-opus-20240229',
        provider: 'anthropic',
        sessionId: 'session-123',
      };

      const response = await app.request('/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': 'session-123',
        },
        body: JSON.stringify(request),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('invalid requests', () => {
    it('should reject request with empty messages', async () => {
      const request: ChatRequest = {
        messages: [],
        model: 'claude-3-opus-20240229',
      };

      const response = await app.request('/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      expect(response.status).toBe(400);
    });

    it('should reject request with invalid temperature', async () => {
      const request: ChatRequest = {
        messages: [
          { role: 'user', content: 'Test' },
        ],
        model: 'claude-3-opus-20240229',
        temperature: 2.5, // Invalid: > 2.0
      };

      const response = await app.request('/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      expect(response.status).toBe(400);
    });

    it('should reject request with negative max tokens', async () => {
      const request: ChatRequest = {
        messages: [
          { role: 'user', content: 'Test' },
        ],
        model: 'claude-3-opus-20240229',
        maxTokens: -100,
      };

      const response = await app.request('/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      expect(response.status).toBe(400);
    });

    it('should reject request with invalid JSON', async () => {
      const response = await app.request('/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json }',
      });

      expect(response.status).toBe(400);
    });

    it('should reject request for unknown model', async () => {
      const request: ChatRequest = {
        messages: [
          { role: 'user', content: 'Test' },
        ],
        model: 'unknown-model-xyz',
      };

      const response = await app.request('/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      expect(response.status).toBe(400);
    });
  });
});

describe('Error Handling Integration', () => {
  it('should return 404 for undefined routes', async () => {
    const response = await app.request('/v1/undefined-route');

    expect(response.status).toBe(404);

    const data = await response.json() as any;

    expect(data.error).toBeDefined();
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('should handle method not allowed', async () => {
    const response = await app.request('/v1/chat', {
      method: 'GET',
    });

    expect(response.status).toBe(405);
  });

  it('should include request ID in error responses', async () => {
    const response = await app.request('/v1/undefined');

    const data = await response.json() as any;

    expect(data.error.requestId).toBeDefined();
    expect(data.error.timestamp).toBeDefined();
  });
});

describe('CORS Integration', () => {
  it('should include CORS headers', async () => {
    const response = await app.request('/v1/status', {
      headers: { Origin: 'https://example.com' },
    });

    expect(response.headers.get('access-control-allow-origin')).toBeDefined();
  });
});

describe('Request ID Integration', () => {
  it('should generate request ID if not provided', async () => {
    const response = await app.request('/v1/status');

    const requestId = response.headers.get('x-request-id');

    expect(requestId).toBeDefined();
    expect(requestId).toMatch(/^[0-9a-f-]+$/);
  });

  it('should preserve provided request ID', async () => {
    const customId = 'custom-request-id-123';

    const response = await app.request('/v1/status', {
      headers: { 'X-Request-ID': customId },
    });

    const requestId = response.headers.get('x-request-id');

    expect(requestId).toBe(customId);
  });
});

describe('Response Headers Integration', () => {
  it('should include content-type header', async () => {
    const response = await app.request('/v1/status');

    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('should include response-time header', async () => {
    const response = await app.request('/v1/status');

    const responseTime = response.headers.get('x-response-time');

    expect(responseTime).toBeDefined();
    expect(responseTime).toMatch(/^\d+ms$/);
  });
});
