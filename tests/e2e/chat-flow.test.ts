/**
 * E2E Tests - Critical User Flows
 *
 * Test complete end-to-end user journeys
 */

import { describe, it, expect } from 'vitest';
import app from '../../packages/edge/src/index';
import type { ChatRequest } from '../../packages/edge/src/types';

describe('End-to-End Chat Flow', () => {
  describe('Complete Chat Request Lifecycle', () => {
    it('should complete full chat request with response', async () => {
      // Step 1: User checks service health
      const healthResponse = await app.request('/health');

      expect(healthResponse.status).toBe(200);
      const health = await healthResponse.json() as any;
      expect(health.status).toBe('healthy');

      // Step 2: User lists available models
      const modelsResponse = await app.request('/v1/models');

      expect(modelsResponse.status).toBe(200);
      const modelsData = await modelsResponse.json() as any;
      expect(modelsData.models.length).toBeGreaterThan(0);

      const selectedModel = modelsData.models[0];

      // Step 3: User sends chat request
      const chatRequest: ChatRequest = {
        messages: [
          { role: 'user', content: 'What is the capital of France?' },
        ],
        model: selectedModel.id,
        provider: selectedModel.provider,
        temperature: 0.7,
        maxTokens: 1000,
      };

      const chatResponse = await app.request('/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatRequest),
      });

      expect(chatResponse.status).toBe(200);

      const chatData = await chatResponse.json() as any;

      // Verify response structure
      expect(chatData.id).toBeDefined();
      expect(chatData.content).toBeDefined();
      expect(chatData.content.length).toBeGreaterThan(0);
      expect(chatData.model).toBe(selectedModel.id);
      expect(chatData.provider).toBe(selectedModel.provider);
      expect(chatData.finishReason).toBeDefined();
      expect(chatData.usage).toBeDefined();
      expect(chatData.usage.promptTokens).toBeGreaterThan(0);
      expect(chatData.usage.completionTokens).toBeGreaterThan(0);
      expect(chatData.usage.totalTokens).toBeGreaterThan(0);
      expect(chatData.timestamp).toBeDefined();

      // Step 4: Verify response includes proper headers
      expect(chatResponse.headers.get('content-type')).toContain('application/json');
      expect(chatResponse.headers.get('x-request-id')).toBeDefined();
      expect(chatResponse.headers.get('x-response-time')).toBeDefined();
    });
  });

  describe('Multi-Turn Conversation', () => {
    it('should maintain conversation context across multiple turns', async () => {
      const conversation: { role: 'user' | 'assistant'; content: string }[] = [
        { role: 'user', content: 'My name is Alice. Remember that.' },
        { role: 'assistant', content: 'Hello Alice! I\'ll remember your name.' },
        { role: 'user', content: 'What is my name?' },
      ];

      const chatRequest: ChatRequest = {
        messages: conversation,
        model: 'claude-3-opus-20240229',
        provider: 'anthropic',
      };

      const response = await app.request('/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatRequest),
      });

      expect(response.status).toBe(200);

      const data = await response.json() as any;

      expect(data.content).toBeDefined();
      expect(data.content.toLowerCase()).toContain('alice');
    });
  });

  describe('Error Recovery Flow', () => {
    it('should handle invalid request and provide helpful error', async () => {
      const invalidRequest = {
        messages: [],
        model: 'claude-3-opus-20240229',
      };

      const response = await app.request('/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidRequest),
      });

      expect(response.status).toBe(400);

      const error = await response.json() as any;

      expect(error.error).toBeDefined();
      expect(error.error.code).toBeDefined();
      expect(error.error.message).toBeDefined();
      expect(error.error.requestId).toBeDefined();
      expect(error.error.timestamp).toBeDefined();
    });

    it('should recover from error with valid request', async () => {
      // First, send an invalid request
      await app.request('/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [] }),
      });

      // Then send a valid request
      const validRequest: ChatRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-opus-20240229',
      };

      const response = await app.request('/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRequest),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Session Persistence Flow', () => {
    it('should maintain session across multiple requests', async () => {
      const sessionId = 'test-session-123';

      const request1: ChatRequest = {
        messages: [{ role: 'user', content: 'First message' }],
        model: 'claude-3-opus-20240229',
        sessionId,
      };

      const response1 = await app.request('/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId,
        },
        body: JSON.stringify(request1),
      });

      expect(response1.status).toBe(200);

      const request2: ChatRequest = {
        messages: [{ role: 'user', content: 'Second message' }],
        model: 'claude-3-opus-20240229',
        sessionId,
      };

      const response2 = await app.request('/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId,
        },
        body: JSON.stringify(request2),
      });

      expect(response2.status).toBe(200);
    });
  });

  describe('Rate Limiting Flow', () => {
    it('should handle multiple requests within rate limit', async () => {
      const requests = Array(10).fill(null).map((_, i) => ({
        messages: [{ role: 'user', content: `Request ${i}` }],
        model: 'claude-3-opus-20240229',
      }));

      const responses = await Promise.all(
        requests.map(req =>
          app.request('/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req),
          })
        )
      );

      // All should succeed (within rate limit)
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple concurrent requests', async () => {
      const concurrentRequests = Array(20).fill(null).map((_, i) => ({
        messages: [{ role: 'user', content: `Concurrent request ${i}` }],
        model: 'claude-3-opus-20240229',
      }));

      const startTime = Date.now();

      const responses = await Promise.all(
        concurrentRequests.map(req =>
          app.request('/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req),
          })
        )
      );

      const duration = Date.now() - startTime;

      // All should complete
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Concurrent requests should be faster than sequential
      expect(duration).toBeLessThan(10000); // Should complete in < 10s
    });
  });
});

describe('End-to-End Model Selection', () => {
  it('should handle requests for different providers', async () => {
    const modelsResponse = await app.request('/v1/models');
    const modelsData = await modelsResponse.json() as any;

    // Test with different providers
    const providers = [...new Set(modelsData.models.map((m: any) => m.provider))];

    for (const provider of providers) {
      const providerModels = modelsData.models.filter((m: any) => m.provider === provider);
      const model = providerModels[0];

      const request: ChatRequest = {
        messages: [{ role: 'user', content: `Test with ${provider}` }],
        model: model.id,
        provider: provider as any,
      };

      const response = await app.request('/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      expect(response.status).toBe(200);
    }
  });
});

describe('End-to-End Error Handling', () => {
  it('should handle malformed JSON gracefully', async () => {
    const response = await app.request('/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ completely invalid json }',
    });

    expect(response.status).toBe(400);

    const error = await response.json() as any;

    expect(error.error).toBeDefined();
  });

  it('should handle missing required fields', async () => {
    const response = await app.request('/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user' }] }), // Missing content
    });

    expect(response.status).toBe(400);
  });

  it('should handle unknown HTTP methods', async () => {
    const response = await app.request('/v1/chat', {
      method: 'PATCH',
    });

    expect([405, 404]).toContain(response.status);
  });
});
