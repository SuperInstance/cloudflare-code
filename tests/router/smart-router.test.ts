/**
 * Smart Router Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SmartRouter } from '../../packages/edge/src/lib/router/smart-router';
import type { ProviderDefinition } from '../../packages/edge/src/lib/router/strategy';
import type { ProviderClient } from '../../packages/edge/src/lib/providers/base';
import type { SemanticCache } from '../../packages/edge/src/lib/cache/semantic';
import type { ChatRequest, ChatResponse } from '../../packages/edge/src/types/index';

// Mock semantic cache
const createMockCache = (): SemanticCache => {
  return {
    check: vi.fn().mockResolvedValue({
      response: null,
      hit: false,
      similarity: 0,
      source: 'miss' as const,
      latency: 0,
    }),
    store: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockReturnValue({
      metrics: {
        totalQueries: 0,
        hotHits: 0,
        warmHits: 0,
        coldHits: 0,
        misses: 0,
        totalLatency: 0,
        tokensSaved: 0,
        costSaved: 0,
      },
      hitRate: 0,
      avgLatency: 0,
      hotCacheSize: 0,
      hnswStats: {
        totalVectors: 0,
        totalNodes: 0,
        maxConnections: 0,
        efConstruction: 0,
      },
    }),
    clear: vi.fn().mockResolvedValue(undefined),
  } as unknown as SemanticCache;
};

// Mock provider client
const createMockProvider = (name: string, tier: number): ProviderClient => {
  return {
    name,
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: false,
      maxContextTokens: 8192,
      maxOutputTokens: 4096,
      avgLatency: tier * 100,
      hasFreeTier: tier === 1,
      freeTierDaily: tier === 1 ? 1000 : 0,
      inputCostPer1M: tier === 1 ? 0 : tier * 0.5,
      outputCostPer1M: tier === 1 ? 0 : tier * 0.5,
    },
    isAvailable: vi.fn().mockResolvedValue(true),
    chat: vi.fn().mockImplementation(async (request: ChatRequest) => {
      return {
        id: 'test-id',
        content: `Response from ${name}`,
        model: request.model || 'test-model',
        provider: name as any,
        finishReason: 'stop',
        usage: {
          promptTokens: 100,
          completionTokens: 200,
          totalTokens: 300,
        },
        timestamp: Date.now(),
      };
    }),
    stream: vi.fn(),
    getQuota: vi.fn().mockResolvedValue({
      provider: name,
      used: 0,
      limit: 1000,
      remaining: 1000,
      resetTime: Date.now() + 86400000,
      resetType: 'daily' as const,
      lastUpdated: Date.now(),
      isExhausted: false,
    }),
    getModelList: vi.fn().mockResolvedValue(['model1']),
    getHealthStatus: vi.fn().mockResolvedValue({
      provider: name,
      isHealthy: true,
      lastCheck: Date.now(),
      avgLatency: tier * 100,
      successRate: 0.95,
      totalRequests: 100,
      failedRequests: 5,
      circuitState: 'closed' as const,
    }),
    test: vi.fn().mockResolvedValue(true),
  };
};

describe('SmartRouter', () => {
  let router: SmartRouter;
  let providers: Map<string, ProviderClient>;
  let providerDefinitions: Map<string, ProviderDefinition>;
  let mockCache: SemanticCache;

  beforeEach(() => {
    // Create mock providers
    providers = new Map([
      ['cloudflare', createMockProvider('cloudflare', 1)],
      ['groq', createMockProvider('groq', 1)],
      ['anthropic', createMockProvider('anthropic', 3)],
      ['openai', createMockProvider('openai', 3)],
    ]);

    // Create provider definitions
    providerDefinitions = new Map([
      ['cloudflare', {
        name: 'cloudflare',
        client: providers.get('cloudflare')!,
        capabilities: providers.get('cloudflare')!.capabilities,
        models: ['@cf/meta/llama-2-7b-chat-int8'],
        defaultModel: '@cf/meta/llama-2-7b-chat-int8',
        tier: 1,
        quality: 0.75,
        priority: 1,
      }],
      ['groq', {
        name: 'groq',
        client: providers.get('groq')!,
        capabilities: providers.get('groq')!.capabilities,
        models: ['llama-3.1-8b'],
        defaultModel: 'llama-3.1-8b',
        tier: 1,
        quality: 0.78,
        priority: 2,
      }],
      ['anthropic', {
        name: 'anthropic',
        client: providers.get('anthropic')!,
        capabilities: providers.get('anthropic')!.capabilities,
        models: ['claude-3-haiku'],
        defaultModel: 'claude-3-haiku',
        tier: 3,
        quality: 0.92,
        priority: 3,
      }],
      ['openai', {
        name: 'openai',
        client: providers.get('openai')!,
        capabilities: providers.get('openai')!.capabilities,
        models: ['gpt-4o-mini'],
        defaultModel: 'gpt-4o-mini',
        tier: 3,
        quality: 0.90,
        priority: 4,
      }],
    ]);

    // Create mock cache
    mockCache = createMockCache();

    // Create router
    router = new SmartRouter(
      providers,
      providerDefinitions,
      mockCache,
      {
        enableCache: true,
        enableCascade: true,
        minConfidence: 0.75,
        maxCascadeAttempts: 3,
      }
    );
  });

  describe('route', () => {
    it('should route simple request', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Hello, how are you?' }],
      };

      const response = await router.route(request);

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(response.id).toBeDefined();
    });

    it('should check cache before executing', async () => {
      const cachedResponse: ChatResponse = {
        id: 'cached-id',
        content: 'Cached response',
        model: 'test-model',
        provider: 'cloudflare' as any,
        finishReason: 'stop',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
        timestamp: Date.now(),
      };

      vi.mocked(mockCache.check).mockResolvedValueOnce({
        response: cachedResponse,
        hit: true,
        similarity: 0.95,
        source: 'hot' as const,
        latency: 1,
      });

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Cached question' }],
      };

      const response = await router.route(request);

      expect(response).toEqual(cachedResponse);
      expect(mockCache.check).toHaveBeenCalled();
    });

    it('should route code request to appropriate tier', async () => {
      const request: ChatRequest = {
        messages: [
          {
            role: 'user',
            content: 'Write a function to sort an array:\n```javascript\nfunction sort(arr) {\n  return arr.sort((a, b) => a - b);\n}\n```',
          },
        ],
      };

      const response = await router.route(request);

      expect(response).toBeDefined();
      const stats = router.getStats();
      expect(stats.requestsByIntent.get('code')).toBeGreaterThan(0);
    });

    it('should handle complex requests', async () => {
      const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
      for (let i = 0; i < 15; i++) {
        messages.push({ role: 'user', content: `Message ${i}`.repeat(50) });
        messages.push({ role: 'assistant', content: `Response ${i}` });
      }

      const request: ChatRequest = { messages };

      const response = await router.route(request);

      expect(response).toBeDefined();
      const stats = router.getStats();
      expect(stats.requestsByComplexity.get('complex')).toBeGreaterThan(0);
    });

    it('should cache responses', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test question' }],
      };

      await router.route(request);

      expect(mockCache.store).toHaveBeenCalled();
    });
  });

  describe('statistics', () => {
    it('should track total requests', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      await router.route(request);
      await router.route(request);

      const stats = router.getStats();
      expect(stats.totalRequests).toBe(2);
    });

    it('should track cache hits and misses', async () => {
      const cachedResponse: ChatResponse = {
        id: 'cached-id',
        content: 'Cached response',
        model: 'test-model',
        provider: 'cloudflare' as any,
        finishReason: 'stop',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
        timestamp: Date.now(),
      };

      vi.mocked(mockCache.check).mockResolvedValueOnce({
        response: cachedResponse,
        hit: true,
        similarity: 0.95,
        source: 'hot' as const,
        latency: 1,
      });

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      await router.route(request); // Cache hit
      await router.route(request); // Cache miss

      const stats = router.getStats();
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(1);
    });

    it('should track requests by complexity', async () => {
      const simpleRequest: ChatRequest = {
        messages: [{ role: 'user', content: 'Hi' }],
      };

      const complexRequest: ChatRequest = {
        messages: Array(20).fill({ role: 'user' as const, content: 'x'.repeat(1000) }),
      };

      await router.route(simpleRequest);
      await router.route(complexRequest);

      const stats = router.getStats();
      expect(stats.requestsByComplexity.get('simple')).toBeGreaterThan(0);
    });

    it('should track requests by intent', async () => {
      const chatRequest: ChatRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const codeRequest: ChatRequest = {
        messages: [{ role: 'user', content: '```javascript\nconsole.log("test");\n```' }],
      };

      await router.route(chatRequest);
      await router.route(codeRequest);

      const stats = router.getStats();
      expect(stats.requestsByIntent.get('chat')).toBeGreaterThan(0);
      expect(stats.requestsByIntent.get('code')).toBeGreaterThan(0);
    });

    it('should track requests by tier', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      await router.route(request);

      const stats = router.getStats();
      const totalTierRequests = Array.from(stats.requestsByTier.values())
        .reduce((sum, count) => sum + count, 0);
      expect(totalTierRequests).toBeGreaterThan(0);
    });

    it('should track costs', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      await router.route(request);

      const stats = router.getStats();
      expect(stats.totalCost).toBeGreaterThanOrEqual(0);
    });

    it('should track latency', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      await router.route(request);

      const stats = router.getStats();
      expect(stats.totalLatency).toBeGreaterThan(0);
      expect(stats.averageLatency).toBeGreaterThan(0);
    });
  });

  describe('detailed statistics', () => {
    it('should provide detailed stats', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      await router.route(request);

      const detailedStats = router.getDetailedStats();

      expect(detailedStats.router).toBeDefined();
      expect(detailedStats.cascade).toBeDefined();
      expect(detailedStats.costOptimizer).toBeDefined();
      expect(detailedStats.cache).toBeDefined();
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      router.updateConfig({
        minConfidence: 0.8,
        enableCache: false,
      });

      const config = router.getConfig();
      expect(config.minConfidence).toBe(0.8);
      expect(config.enableCache).toBe(false);
    });
  });

  describe('health check', () => {
    it('should return health status', async () => {
      const health = await router.healthCheck();

      expect(health).toBeDefined();
      expect(health.healthy).toBeDefined();
      expect(health.providersHealthy).toBeGreaterThanOrEqual(0);
      expect(health.providersTotal).toBe(providers.size);
      expect(health.cacheHealthy).toBeDefined();
    });
  });

  describe('reset statistics', () => {
    it('should reset statistics', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      await router.route(request);
      router.resetStats();

      const stats = router.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      expect(() => router.destroy()).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty messages', async () => {
      const request: ChatRequest = {
        messages: [],
      };

      // Should not throw, but may return minimal response
      const response = await router.route(request);
      expect(response).toBeDefined();
    });

    it('should handle very long messages', async () => {
      const request: ChatRequest = {
        messages: [
          { role: 'user', content: 'x'.repeat(10000) },
        ],
      };

      const response = await router.route(request);
      expect(response).toBeDefined();
    });

    it('should handle special characters', async () => {
      const request: ChatRequest = {
        messages: [
          { role: 'user', content: 'Test with émojis 🎉 and spëcial çhars' },
        ],
      };

      const response = await router.route(request);
      expect(response).toBeDefined();
    });
  });
});
