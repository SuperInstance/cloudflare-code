/**
 * Confidence Cascade Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfidenceCascade } from '../../packages/edge/src/lib/router/cascade';
import type { ExecutionStrategy } from '../../packages/edge/src/lib/router/types';
import type { ProviderClient } from '../../packages/edge/src/lib/providers/base';
import type { ChatRequest, ChatResponse } from '../../packages/edge/src/types/index';
import type { RequestAnalysis } from '../../packages/edge/src/lib/router/types';

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

describe('ConfidenceCascade', () => {
  let cascade: ConfidenceCascade;
  let providers: Map<string, ProviderClient>;

  beforeEach(() => {
    providers = new Map([
      ['cloudflare', createMockProvider('cloudflare', 1)],
      ['groq', createMockProvider('groq', 1)],
      ['anthropic', createMockProvider('anthropic', 3)],
    ]);

    cascade = new ConfidenceCascade(providers);
  });

  describe('execute', () => {
    it('should execute with tier 1 strategy', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Simple question' }],
      };

      const strategies: ExecutionStrategy[] = [
        {
          name: 'tier1',
          provider: 'cloudflare',
          model: '@cf/meta/llama-2-7b-chat-int8',
          expectedQuality: 0.75,
          confidence: 0.8,
          costPer1M: 0,
          expectedLatency: 200,
          maxTokens: 2048,
          tier: 1,
        },
      ];

      const result = await cascade.execute(request, strategies);

      expect(result.response).toBeDefined();
      expect(result.tierUsed).toBe(1);
      expect(result.attempts).toBe(1);
      expect(result.cost).toBe(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should cascade through multiple tiers if needed', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Complex question' }],
      };

      const strategies: ExecutionStrategy[] = [
        {
          name: 'tier1',
          provider: 'cloudflare',
          model: '@cf/meta/llama-2-7b-chat-int8',
          expectedQuality: 0.75,
          confidence: 0.8,
          costPer1M: 0,
          expectedLatency: 200,
          maxTokens: 2048,
          tier: 1,
        },
        {
          name: 'tier3',
          provider: 'anthropic',
          model: 'claude-3-haiku',
          expectedQuality: 0.92,
          confidence: 0.95,
          costPer1M: 1.0,
          expectedLatency: 400,
          maxTokens: 4096,
          tier: 3,
        },
      ];

      // Mock low confidence for tier 1
      cascade = new ConfidenceCascade(providers, {
        minConfidence: 0.95,
        maxAttempts: 3,
        confidenceThresholds: { tier1: 0.95, tier2: 0.90, tier3: 0.95 },
        enableQualityChecks: true,
        enableAutoEscalation: true,
      });

      const result = await cascade.execute(request, strategies);

      expect(result.response).toBeDefined();
      expect(result.attempts).toBeGreaterThan(1);
    });

    it('should return first tier response if confident', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Simple question' }],
      };

      const strategies: ExecutionStrategy[] = [
        {
          name: 'tier1',
          provider: 'cloudflare',
          model: '@cf/meta/llama-2-7b-chat-int8',
          expectedQuality: 0.9,
          confidence: 0.9,
          costPer1M: 0,
          expectedLatency: 200,
          maxTokens: 2048,
          tier: 1,
        },
      ];

      const result = await cascade.execute(request, strategies);

      expect(result.attempts).toBe(1);
      expect(result.tierUsed).toBe(1);
    });
  });

  describe('confidence evaluation', () => {
    it('should evaluate confidence based on response', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'What is 2+2?' }],
      };

      const strategies: ExecutionStrategy[] = [
        {
          name: 'tier1',
          provider: 'cloudflare',
          model: '@cf/meta/llama-2-7b-chat-int8',
          expectedQuality: 0.75,
          confidence: 0.8,
          costPer1M: 0,
          expectedLatency: 200,
          maxTokens: 2048,
          tier: 1,
        },
      ];

      const result = await cascade.execute(request, strategies);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should increase confidence for structured responses', async () => {
      // Mock provider to return structured response
      const mockProvider = providers.get('cloudflare')!;
      vi.mocked(mockProvider.chat).mockResolvedValueOnce({
        id: 'test-id',
        content: '1. First point\n2. Second point\n3. Third point\n\n```code example```',
        model: 'test-model',
        provider: 'cloudflare' as any,
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
        timestamp: Date.now(),
      });

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Explain something' }],
      };

      const strategies: ExecutionStrategy[] = [
        {
          name: 'tier1',
          provider: 'cloudflare',
          model: '@cf/meta/llama-2-7b-chat-int8',
          expectedQuality: 0.75,
          confidence: 0.8,
          costPer1M: 0,
          expectedLatency: 200,
          maxTokens: 2048,
          tier: 1,
        },
      ];

      const result = await cascade.execute(request, strategies);

      // Structured response should have higher confidence
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('error handling', () => {
    it('should handle provider errors', async () => {
      const mockProvider = providers.get('cloudflare')!;
      vi.mocked(mockProvider.chat).mockRejectedValueOnce(new Error('Provider error'));

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      const strategies: ExecutionStrategy[] = [
        {
          name: 'tier1',
          provider: 'cloudflare',
          model: '@cf/meta/llama-2-7b-chat-int8',
          expectedQuality: 0.75,
          confidence: 0.8,
          costPer1M: 0,
          expectedLatency: 200,
          maxTokens: 2048,
          tier: 1,
        },
        {
          name: 'tier3',
          provider: 'anthropic',
          model: 'claude-3-haiku',
          expectedQuality: 0.92,
          confidence: 0.95,
          costPer1M: 1.0,
          expectedLatency: 400,
          maxTokens: 4096,
          tier: 3,
        },
      ];

      const result = await cascade.execute(request, strategies);

      // Should fall back to tier 3
      expect(result.tierUsed).toBe(3);
      expect(result.attemptsLog).toHaveLength(2);
      expect(result.attemptsLog[0].success).toBe(false);
      expect(result.attemptsLog[1].success).toBe(true);
    });

    it('should throw if all strategies fail', async () => {
      const mockProvider = providers.get('cloudflare')!;
      vi.mocked(mockProvider.chat).mockRejectedValue(new Error('Provider error'));

      const mockProvider2 = providers.get('anthropic')!;
      vi.mocked(mockProvider2.chat).mockRejectedValue(new Error('Provider error'));

      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      const strategies: ExecutionStrategy[] = [
        {
          name: 'tier1',
          provider: 'cloudflare',
          model: '@cf/meta/llama-2-7b-chat-int8',
          expectedQuality: 0.75,
          confidence: 0.8,
          costPer1M: 0,
          expectedLatency: 200,
          maxTokens: 2048,
          tier: 1,
        },
        {
          name: 'tier3',
          provider: 'anthropic',
          model: 'claude-3-haiku',
          expectedQuality: 0.92,
          confidence: 0.95,
          costPer1M: 1.0,
          expectedLatency: 400,
          maxTokens: 4096,
          tier: 3,
        },
      ];

      await expect(cascade.execute(request, strategies)).rejects.toThrow('Cascade failed');
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      cascade.updateConfig({
        minConfidence: 0.8,
        maxAttempts: 5,
      });

      const config = cascade.getConfig();
      expect(config.minConfidence).toBe(0.8);
      expect(config.maxAttempts).toBe(5);
    });
  });

  describe('statistics', () => {
    it('should track cascade statistics', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test' }],
      };

      const strategies: ExecutionStrategy[] = [
        {
          name: 'tier1',
          provider: 'cloudflare',
          model: '@cf/meta/llama-2-7b-chat-int8',
          expectedQuality: 0.75,
          confidence: 0.8,
          costPer1M: 0,
          expectedLatency: 200,
          maxTokens: 2048,
          tier: 1,
        },
      ];

      await cascade.execute(request, strategies);
      await cascade.execute(request, strategies);

      const logs = [
        (await cascade.execute(request, strategies)).attemptsLog,
        (await cascade.execute(request, strategies)).attemptsLog,
      ];

      const stats = cascade.getStats(logs);

      expect(stats.totalCascades).toBe(2);
      expect(stats.averageAttempts).toBe(1);
    });
  });
});
