/**
 * Unit Tests for LLM Router
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LLMRouter } from '../../src/router/router';
import { ModelRegistry } from '../../src/models/registry';
import type {
  LLMRequest,
  RoutingOptions,
  RoutingStrategy,
  LLMProvider,
} from '../../src/types/index';

describe('LLMRouter', () => {
  let registry: ModelRegistry;
  let router: LLMRouter;

  beforeEach(() => {
    registry = new ModelRegistry({ enableHealthChecks: false });
    router = new LLMRouter(registry, {
      enableCaching: false,
      enableABTesting: false,
    });
  });

  afterEach(() => {
    router.clearCache();
  });

  describe('Routing', () => {
    it('should route a basic request', async () => {
      const request: LLMRequest = {
        messages: [
          { role: 'user', content: 'Hello, how are you?' },
        ],
      };

      const decision = await router.route(request);

      expect(decision).toBeDefined();
      expect(decision.model).toBeTruthy();
      expect(decision.provider).toBeTruthy();
      expect(decision.confidence).toBeGreaterThan(0);
    });

    it('should route code requests to capable models', async () => {
      const request: LLMRequest = {
        messages: [
          {
            role: 'user',
            content: 'Write a function to sort an array in JavaScript',
          },
        ],
      };

      const decision = await router.route(request);

      expect(decision.model).toBeTruthy();
      const model = registry.getModel(decision.model);
      expect(model?.metadata.capabilities.codeGeneration.supported).toBe(true);
    });

    it('should route reasoning requests to capable models', async () => {
      const request: LLMRequest = {
        messages: [
          {
            role: 'user',
            content: 'Analyze the logical implications of this statement...',
          },
        ],
      };

      const decision = await router.route(request);

      expect(decision.model).toBeTruthy();
      const model = registry.getModel(decision.model);
      expect(model?.metadata.capabilities.reasoning.supported).toBe(true);
    });

    it('should respect cost limit in routing options', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const options: RoutingOptions = {
        strategy: 'cost',
        costLimit: 5,
      };

      const decision = await router.route(request, options);

      const model = registry.getModel(decision.model);
      expect(model).toBeDefined();
      const estimatedCost =
        (model!.metadata.pricing.input + model!.metadata.pricing.output) / 2;
      expect(estimatedCost).toBeLessThanOrEqual(5);
    });
  });

  describe('Routing Strategies', () => {
    it('should use capability strategy', async () => {
      const request: LLMRequest = {
        messages: [
          { role: 'user', content: 'Help me write code' },
        ],
      };

      const decision = await router.route(request, {
        strategy: 'capability',
      });

      expect(decision.reasoning).toContain('capability');
    });

    it('should use cost strategy', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = await router.route(request, {
        strategy: 'cost',
      });

      expect(decision.reasoning).toContain('cost');
    });

    it('should use performance strategy', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = await router.route(request, {
        strategy: 'performance',
      });

      expect(decision.reasoning).toContain('performance');
    });

    it('should use latency strategy', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = await router.route(request, {
        strategy: 'latency',
      });

      expect(decision.reasoning).toContain('latency');
    });

    it('should use availability strategy', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = await router.route(request, {
        strategy: 'availability',
      });

      expect(decision.reasoning).toContain('availability');
    });
  });

  describe('Query Analysis', () => {
    it('should detect code requirements', async () => {
      const request: LLMRequest = {
        messages: [
          { role: 'user', content: 'Create a Python class' },
        ],
      };

      const decision = await router.route(request);

      const model = registry.getModel(decision.model);
      expect(model?.metadata.capabilities.codeGeneration.supported).toBe(true);
    });

    it('should detect tool requirements', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Get the weather' }],
        tools: [
          {
            name: 'get_weather',
            description: 'Get current weather',
            inputSchema: {},
          },
        ],
      };

      const decision = await router.route(request);

      const model = registry.getModel(decision.model);
      expect(model?.metadata.capabilities.functionCalling.supported).toBe(true);
    });

    it('should estimate tokens accurately', async () => {
      const longText = 'a'.repeat(1000);
      const request: LLMRequest = {
        messages: [{ role: 'user', content: longText }],
      };

      const decision = await router.route(request);

      expect(decision.model).toBeTruthy();
      const model = registry.getModel(decision.model);
      expect(model!.metadata.constraints.maxTokens).toBeGreaterThan(200);
    });
  });

  describe('Routing Rules', () => {
    it('should add and apply routing rules', async () => {
      const rule = {
        id: 'test-rule',
        name: 'Test Rule',
        priority: 100,
        condition: {
          type: 'user' as const,
          operator: 'equals' as const,
          value: 'test-user',
        },
        action: {
          type: 'select-model' as const,
          value: 'gpt-4',
        },
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      router.addRule(rule);

      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        user: 'test-user',
      };

      const decision = await router.route(request);

      expect(decision.appliedRules).toContain('test-rule');
    });

    it('should remove routing rules', () => {
      const rule = {
        id: 'test-rule',
        name: 'Test Rule',
        priority: 100,
        condition: {
          type: 'user' as const,
          operator: 'equals' as const,
          value: 'test-user',
        },
        action: {
          type: 'select-model' as const,
          value: 'gpt-4',
        },
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      router.addRule(rule);
      const removed = router.removeRule('test-rule');

      expect(removed).toBe(true);
      expect(router.getRules().length).toBe(1); // Only default rule remains
    });
  });

  describe('Caching', () => {
    it('should cache routing decisions', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision1 = await router.route(request);
      const decision2 = await router.route(request);

      expect(decision1.model).toBe(decision2.model);
    });

    it('should clear cache', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await router.route(request);
      router.clearCache();

      const analytics = router.getAnalytics();
      expect(analytics.cacheSize).toBe(0);
    });
  });

  describe('Fallback Handling', () => {
    it('should use fallback when primary model unavailable', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      // Make gpt-4 unavailable
      registry.updateModelStatus('gpt-4', 'unavailable', 0);

      const decision = await router.route(request, {
        fallbackModels: ['gpt-3.5-turbo', 'claude-3-haiku'],
      });

      expect(['gpt-3.5-turbo', 'claude-3-haiku']).toContain(decision.model);
    });

    it('should handle multiple fallback attempts', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      // Make all premium models unavailable
      registry.updateModelStatus('gpt-4', 'unavailable', 0);
      registry.updateModelStatus('claude-3-opus', 'unavailable', 0);
      registry.updateModelStatus('gemini-ultra', 'unavailable', 0);

      const decision = await router.route(request);

      expect(decision.model).toBeTruthy();
      expect(decision.reasoning).toContain('Fallback');
    });
  });

  describe('Analytics', () => {
    it('should track routing analytics', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await router.route(request);
      await router.route(request);

      const analytics = router.getAnalytics();

      expect(analytics.totalRequests).toBe(2);
      expect(analytics.modelUsage).toBeDefined();
      expect(Object.keys(analytics.modelUsage).length).toBeGreaterThan(0);
    });

    it('should track provider usage', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Write code' }],
      };

      await router.route(request);

      const analytics = router.getAnalytics();

      expect(analytics.providerUsage).toBeDefined();
      expect(Object.keys(analytics.providerUsage).length).toBeGreaterThan(0);
    });

    it('should track strategy usage', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await router.route(request, { strategy: 'cost' });

      const analytics = router.getAnalytics();

      expect(analytics.strategyUsage).toBeDefined();
    });
  });

  describe('Events', () => {
    it('should emit routing:decision event', (done) => {
      router.on('routing:decision', (data: unknown) => {
        expect((data as { decision: unknown }).decision).toBeDefined();
        done();
      });

      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      router.route(request);
    });
  });

  describe('Error Handling', () => {
    it('should throw when no models available', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      // Make all models unavailable
      for (const model of registry.getAllModels()) {
        registry.updateModelStatus(model.metadata.id, 'unavailable', 0);
      }

      await expect(router.route(request)).rejects.toThrow();
    });

    it('should handle invalid routing options', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const decision = await router.route(request, {
        strategy: 'custom' as RoutingStrategy,
      });

      // Should fall back to default strategy
      expect(decision).toBeDefined();
    });
  });
});
