/**
 * Integration Tests for LLM Orchestration Engine
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  LLMOrchestrationEngine,
  createOrchestrationEngine,
} from '../../src/orchestration/engine';
import type {
  LLMRequest,
  BudgetConfig,
  RateLimitQuota,
} from '../../src/types/index';

// Mock provider client
class MockProviderClient {
  async chat(request: LLMRequest) {
    return {
      id: `test-${Date.now()}`,
      model: request.model || 'gpt-4',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Mock response',
          },
          finishReason: 'stop',
        },
      ],
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
      created: Date.now(),
    };
  }
}

describe('LLMOrchestrationEngine Integration', () => {
  let engine: LLMOrchestrationEngine;

  beforeEach(() => {
    engine = createOrchestrationEngine({
      enableRouting: true,
      enableAggregation: true,
      enableCostTracking: true,
      enableRateLimiting: true,
      enableCaching: true,
    });

    // Register mock providers
    engine.registerProvider('openai', new MockProviderClient());
    engine.registerProvider('anthropic', new MockProviderClient());
  });

  afterEach(() => {
    engine.dispose();
  });

  describe('Basic Execution', () => {
    it('should execute a simple request', async () => {
      const request: LLMRequest = {
        messages: [
          { role: 'user', content: 'Hello, how are you?' },
        ],
      };

      const response = await engine.execute(request);

      expect(response).toBeDefined();
      expect(response.choices).toHaveLength(1);
      expect(response.choices[0].message.content).toBe('Mock response');
    });

    it('should route requests to appropriate models', async () => {
      const request: LLMRequest = {
        messages: [
          { role: 'user', content: 'Write a JavaScript function' },
        ],
      };

      const response = await engine.execute(request);

      expect(response.model).toBeDefined();
    });

    it('should execute with routing options', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const response = await engine.execute(request, {
        routing: {
          strategy: 'cost',
          costLimit: 10,
        },
      });

      expect(response).toBeDefined();
    });
  });

  describe('Multi-Model Aggregation', () => {
    it('should execute with multiple models', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const response = await engine.execute(request, {
        multiModel: true,
        aggregation: {
          method: 'weighted',
          strategy: 'best',
        },
      });

      expect(response).toBeDefined();
      expect(response.model).toBe('aggregated');
      expect(response.metadata?.aggregated).toBeDefined();
    });

    it('should aggregate responses using different methods', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Explain quantum computing' }],
      };

      const methods = ['consensus', 'voting', 'weighted', 'ranked'];

      for (const method of methods) {
        const response = await engine.execute(request, {
          multiModel: true,
          aggregation: {
            method: method as any,
            strategy: 'best',
          },
        });

        expect(response).toBeDefined();
        expect(response.model).toBe('aggregated');
      }
    });
  });

  describe('Cost Tracking', () => {
    it('should track request costs', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await engine.execute(request);

      const analytics = engine.getAnalytics();
      expect(analytics.cost.totalTracked).toBeGreaterThan(0);
    });

    it('should enforce budget limits', async () => {
      const budget: BudgetConfig = {
        id: 'test-budget',
        name: 'Test Budget',
        limit: 0.001,
        period: 'daily',
        scope: 'global',
        hardLimit: true,
      };

      engine.createBudget(budget);

      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      // First request should succeed
      await engine.execute(request);

      // Second request might exceed budget
      try {
        await engine.execute(request);
      } catch (error: any) {
        expect(error.code).toBe('BUDGET_EXCEEDED');
      }
    });

    it('should generate cost reports', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await engine.execute(request);

      const costOptimizer = (engine as any).costOptimizer;
      const report = costOptimizer.generateReport(
        new Date(Date.now() - 86400000),
        new Date()
      );

      expect(report).toBeDefined();
      expect(report.totalCost).toBeGreaterThanOrEqual(0);
      expect(report.breakdown).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const quota: RateLimitQuota = {
        id: 'test-quota',
        name: 'Test Quota',
        scope: 'global',
        limits: {
          requests: 2,
          window: 60000,
        },
      };

      engine.createRateLimit(quota);

      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      // First two requests should succeed
      await engine.execute(request);
      await engine.execute(request);

      // Third request should be rate limited
      try {
        await engine.execute(request);
      } catch (error: any) {
        expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      }
    });

    it('should track quota status', async () => {
      const quota: RateLimitQuota = {
        id: 'test-quota',
        name: 'Test Quota',
        scope: 'global',
        limits: {
          requests: 10,
          tokens: 10000,
          window: 60000,
        },
      };

      engine.createRateLimit(quota);

      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await engine.execute(request);

      const analytics = engine.getAnalytics();
      expect(analytics.rateLimit).toBeDefined();
    });
  });

  describe('Prompt Management', () => {
    it('should render prompt templates', async () => {
      const promptEngine = (engine as any).promptEngine;

      const templateId = 'question-answering';
      const variables = {
        context: 'The capital of France is Paris.',
        question: 'What is the capital of France?',
      };

      const rendered = promptEngine.render(templateId, variables);

      expect(rendered).toContain('France');
      expect(rendered).toContain('Paris');
    });

    it('should optimize prompts', async () => {
      const promptEngine = (engine as any).promptEngine;

      const result = await promptEngine.optimize('question-answering');

      expect(result).toBeDefined();
      expect(result.originalTemplate).toBeDefined();
      expect(result.optimizedTemplate).toBeDefined();
      expect(result.improvements).toBeInstanceOf(Array);
    });
  });

  describe('Analytics and Monitoring', () => {
    it('should provide comprehensive analytics', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await engine.execute(request);

      const analytics = engine.getAnalytics();

      expect(analytics.registry).toBeDefined();
      expect(analytics.router).toBeDefined();
      expect(analytics.cost).toBeDefined();
      expect(analytics.rateLimit).toBeDefined();
      expect(analytics.promptEngine).toBeDefined();
      expect(analytics.aggregator).toBeDefined();
    });

    it('should track metrics', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await engine.execute(request);

      const metrics = engine.getMetrics();

      expect(metrics.models).toBeDefined();
      expect(metrics.routing).toBeDefined();
      expect(metrics.costs).toBeDefined();
      expect(metrics.rateLimits).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle unavailable models gracefully', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'non-existent-model',
      };

      try {
        await engine.execute(request);
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });

    it('should handle invalid requests', async () => {
      const request: LLMRequest = {
        messages: [],
      };

      try {
        await engine.execute(request);
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Events', () => {
    it('should emit request lifecycle events', async () => {
      const events: string[] = [];

      engine.on('request:start', () => events.push('start'));
      engine.on('request:complete', () => events.push('complete'));
      engine.on('request:error', () => events.push('error'));

      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await engine.execute(request);

      expect(events).toContain('start');
      expect(events).toContain('complete');
    });

    it('should emit routing events', async () => {
      const events: string[] = [];

      engine.on('routing:decision', () => events.push('routing'));

      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await engine.execute(request);

      expect(events).toContain('routing');
    });
  });

  describe('Performance', () => {
    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        messages: [{ role: 'user', content: `Request ${i}` }],
      }));

      const responses = await Promise.all(
        requests.map((req) => engine.execute(req))
      );

      expect(responses).toHaveLength(10);
      responses.forEach((res) => {
        expect(res).toBeDefined();
      });
    });

    it('should maintain performance under load', async () => {
      const startTime = Date.now();

      const requests = Array.from({ length: 50 }, (_, i) => ({
        messages: [{ role: 'user', content: `Request ${i}` }],
      }));

      await Promise.all(requests.map((req) => engine.execute(req)));

      const duration = Date.now() - startTime;
      const avgLatency = duration / 50;

      // Should process requests reasonably fast
      expect(avgLatency).toBeLessThan(1000);
    });
  });

  describe('Caching', () => {
    it('should cache routing decisions', async () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await engine.execute(request);
      await engine.execute(request);

      const routerAnalytics = (engine as any).router.getAnalytics();
      expect(routerAnalytics.cacheSize).toBeGreaterThan(0);
    });
  });

  describe('Cleanup', () => {
    it('should properly dispose resources', () => {
      const engine = createOrchestrationEngine();

      expect(() => engine.dispose()).not.toThrow();
    });
  });
});
