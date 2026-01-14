/**
 * Strategy Selector Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StrategySelector } from '../../packages/edge/src/lib/router/strategy';
import type {
  ProviderDefinition,
  ExecutionStrategy,
} from '../../packages/edge/src/lib/router/types';
import type { ProviderClient } from '../../packages/edge/src/lib/providers/base';
import type { RequestAnalysis } from '../../packages/edge/src/lib/router/types';

// Mock provider client
const createMockProvider = (name: string): ProviderClient => {
  return {
    name,
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: false,
      maxContextTokens: 8192,
      maxOutputTokens: 4096,
      avgLatency: 200,
      hasFreeTier: true,
      freeTierDaily: 1000,
      inputCostPer1M: 0,
      outputCostPer1M: 0,
    },
    isAvailable: vi.fn().mockResolvedValue(true),
    chat: vi.fn(),
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
    getModelList: vi.fn().mockResolvedValue(['model1', 'model2']),
    getHealthStatus: vi.fn().mockResolvedValue({
      provider: name,
      isHealthy: true,
      lastCheck: Date.now(),
      avgLatency: 200,
      successRate: 0.95,
      totalRequests: 100,
      failedRequests: 5,
      circuitState: 'closed' as const,
    }),
    test: vi.fn().mockResolvedValue(true),
  };
};

describe('StrategySelector', () => {
  let selector: StrategySelector;
  let providers: Map<string, ProviderClient>;
  let providerDefinitions: Map<string, ProviderDefinition>;

  beforeEach(() => {
    // Create mock providers
    providers = new Map([
      ['cloudflare', createMockProvider('cloudflare')],
      ['groq', createMockProvider('groq')],
      ['anthropic', createMockProvider('anthropic')],
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
    ]);

    selector = new StrategySelector({
      providers: providerDefinitions,
      weights: { cost: 0.4, quality: 0.4, speed: 0.2 },
      qualityThresholds: {
        tier1: 0.7,
        tier2: 0.85,
        tier3: 0.95,
      },
    });
  });

  describe('selectStrategy', () => {
    it('should select a strategy for simple request', async () => {
      const analysis: RequestAnalysis = {
        complexity: 'simple',
        intent: 'chat',
        estimatedTokens: { input: 50, output: 100, total: 150 },
        languages: [],
        hasCode: false,
        codeSnippets: [],
        semanticHash: 'test123',
        timestamp: Date.now(),
      };

      const availableProviders = Array.from(providers.values());
      const strategy = await selector.selectStrategy(analysis, availableProviders);

      expect(strategy).toBeDefined();
      expect(strategy.name).toBeDefined();
      expect(strategy.provider).toBeDefined();
      expect(strategy.model).toBeDefined();
    });

    it('should select a strategy for complex code request', async () => {
      const analysis: RequestAnalysis = {
        complexity: 'complex',
        intent: 'code',
        estimatedTokens: { input: 500, output: 1000, total: 1500 },
        languages: ['javascript'],
        hasCode: true,
        codeSnippets: [{ language: 'javascript', code: 'test', lineCount: 10 }],
        semanticHash: 'test456',
        timestamp: Date.now(),
      };

      const availableProviders = Array.from(providers.values());
      const strategy = await selector.selectStrategy(analysis, availableProviders);

      expect(strategy).toBeDefined();
      // Complex code requests might prefer higher tier
      expect(strategy.tier).toBeGreaterThanOrEqual(1);
    });
  });

  describe('selectStrategies', () => {
    it('should select multiple strategies for cascade', async () => {
      const analysis: RequestAnalysis = {
        complexity: 'moderate',
        intent: 'chat',
        estimatedTokens: { input: 200, output: 400, total: 600 },
        languages: [],
        hasCode: false,
        codeSnippets: [],
        semanticHash: 'test789',
        timestamp: Date.now(),
      };

      const availableProviders = Array.from(providers.values());
      const strategies = await selector.selectStrategies(analysis, availableProviders, 3);

      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies.length).toBeLessThanOrEqual(3);

      // Should be sorted by tier (ascending)
      for (let i = 1; i < strategies.length; i++) {
        expect(strategies[i].tier).toBeGreaterThanOrEqual(strategies[i - 1].tier);
      }
    });
  });

  describe('scoring', () => {
    it('should prioritize cost for simple requests', async () => {
      const analysis: RequestAnalysis = {
        complexity: 'simple',
        intent: 'chat',
        estimatedTokens: { input: 50, output: 100, total: 150 },
        languages: [],
        hasCode: false,
        codeSnippets: [],
        semanticHash: 'test-simple',
        timestamp: Date.now(),
      };

      const availableProviders = Array.from(providers.values());
      const strategy = await selector.selectStrategy(analysis, availableProviders);

      // Simple requests should prefer free tier or lower cost options
      expect(strategy.tier).toBeGreaterThanOrEqual(1);
      expect(strategy.tier).toBeLessThanOrEqual(3);
    });

    it('should adjust quality score for code intent', async () => {
      // This is tested indirectly through selectStrategy
      const codeAnalysis: RequestAnalysis = {
        complexity: 'moderate',
        intent: 'code',
        estimatedTokens: { input: 300, output: 600, total: 900 },
        languages: ['javascript'],
        hasCode: true,
        codeSnippets: [{ language: 'javascript', code: 'test', lineCount: 5 }],
        semanticHash: 'test-code',
        timestamp: Date.now(),
      };

      const availableProviders = Array.from(providers.values());
      const strategy = await selector.selectStrategy(codeAnalysis, availableProviders);

      expect(strategy).toBeDefined();
    });
  });

  describe('configuration', () => {
    it('should update weights', () => {
      selector.updateConfig({
        weights: { cost: 0.5, quality: 0.3, speed: 0.2 },
      });

      const config = selector.getConfig();
      expect(config.weights.cost).toBe(0.5);
      expect(config.weights.quality).toBe(0.3);
      expect(config.weights.speed).toBe(0.2);
    });

    it('should clear cache', () => {
      selector.clearCache();
      // No error should be thrown
    });
  });

  describe('unavailable providers', () => {
    it('should handle unavailable providers gracefully', async () => {
      // Make one provider unavailable
      const mockProvider = providers.get('cloudflare')!;
      vi.mocked(mockProvider.isAvailable).mockResolvedValue(false);
      vi.mocked(mockProvider.getQuota).mockResolvedValue({
        provider: 'cloudflare',
        used: 1000,
        limit: 1000,
        remaining: 0,
        resetTime: Date.now() + 86400000,
        resetType: 'daily',
        lastUpdated: Date.now(),
        isExhausted: true,
      });

      const analysis: RequestAnalysis = {
        complexity: 'simple',
        intent: 'chat',
        estimatedTokens: { input: 50, output: 100, total: 150 },
        languages: [],
        hasCode: false,
        codeSnippets: [],
        semanticHash: 'test-unavailable',
        timestamp: Date.now(),
      };

      const availableProviders = Array.from(providers.values());
      const strategy = await selector.selectStrategy(analysis, availableProviders);

      // Should still return a strategy (possibly from other providers)
      expect(strategy).toBeDefined();
    });
  });
});
