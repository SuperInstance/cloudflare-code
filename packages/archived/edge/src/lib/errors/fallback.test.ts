/**
 * Tests for Fallback Strategies
 */

import { describe, it, expect, vi } from 'vitest';
import {
  FallbackExecutor,
  FallbackStrategy,
  ProviderFallbackHandler,
  ModelFallbackHandler,
  CacheFallbackHandler,
  GracefulDegradationHandler,
  DefaultResponseHandler,
  FailFastHandler,
  createFallbackExecutor,
  createModelHierarchy,
  createDefaultResponse,
} from './fallback';
import type { ProviderClient } from '../providers/base';
import type { ChatRequest, ChatResponse } from '../../types/index';

describe('Fallback Handlers', () => {
  describe('Provider Fallback Handler', () => {
    it('should identify available providers', () => {
      const providers = new Map<string, ProviderClient>([
        ['provider1', { name: 'provider1' } as ProviderClient],
        ['provider2', { name: 'provider2' } as ProviderClient],
      ]);

      const handler = new ProviderFallbackHandler(providers);
      const context = {
        request: {} as ChatRequest,
        error: new Error('failure'),
        errorType: 'rate_limited' as any,
        attempt: 1,
        triedProviders: [],
        triedModels: [],
        timestamp: Date.now(),
      };

      expect(handler.canHandle(context)).toBe(true);
    });

    it('should not handle when all providers tried', () => {
      const providers = new Map<string, ProviderClient>([
        ['provider1', { name: 'provider1' } as ProviderClient],
      ]);

      const handler = new ProviderFallbackHandler(providers);
      const context = {
        request: {} as ChatRequest,
        error: new Error('failure'),
        errorType: 'rate_limited' as any,
        attempt: 1,
        triedProviders: ['provider1'],
        triedModels: [],
        timestamp: Date.now(),
      };

      expect(handler.canHandle(context)).toBe(false);
    });

    it('should execute provider fallback', async () => {
      const mockResponse: ChatResponse = {
        content: 'fallback response',
        model: 'fallback-model',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      };

      const providers = new Map<string, ProviderClient>([
        ['provider1', {
          name: 'provider1',
          chat: vi.fn().mockResolvedValue(mockResponse),
        } as any],
        ['provider2', {
          name: 'provider2',
          chat: vi.fn().mockResolvedValue(mockResponse),
        } as any],
      ]);

      const handler = new ProviderFallbackHandler(providers);
      const context = {
        request: {} as ChatRequest,
        error: new Error('failure'),
        errorType: 'rate_limited' as any,
        attempt: 1,
        triedProviders: ['provider1'],
        triedModels: [],
        timestamp: Date.now(),
      };

      const response = await handler.execute(context);

      expect(response).toBe(mockResponse);
      expect(context.triedProviders).toContain('provider2');
    });
  });

  describe('Model Fallback Handler', () => {
    it('should identify fallback models', () => {
      const config = {
        modelHierarchy: {
          'gpt-4': ['gpt-3.5-turbo'],
        },
        defaultFallbackModels: ['claude-3-haiku'],
      };

      const handler = new ModelFallbackHandler(config);
      const context = {
        request: { model: 'gpt-4' } as ChatRequest,
        error: new Error('failure'),
        errorType: 'rate_limited' as any,
        attempt: 1,
        triedProviders: [],
        triedModels: [],
        timestamp: Date.now(),
      };

      expect(handler.canHandle(context)).toBe(true);
    });

    it('should not handle when all models tried', () => {
      const config = {
        modelHierarchy: {
          'gpt-4': ['gpt-3.5-turbo'],
        },
        defaultFallbackModels: [],
      };

      const handler = new ModelFallbackHandler(config);
      const context = {
        request: { model: 'gpt-4' } as ChatRequest,
        error: new Error('failure'),
        errorType: 'rate_limited' as any,
        attempt: 1,
        triedProviders: [],
        triedModels: ['gpt-4', 'gpt-3.5-turbo'],
        timestamp: Date.now(),
      };

      expect(handler.canHandle(context)).toBe(false);
    });

    it('should execute model fallback', async () => {
      const mockResponse: ChatResponse = {
        content: 'fallback response',
        model: 'gpt-3.5-turbo',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      };

      const config = {
        modelHierarchy: {
          'gpt-4': ['gpt-3.5-turbo'],
        },
        defaultFallbackModels: [],
      };

      const handler = new ModelFallbackHandler(config);
      const context = {
        request: { model: 'gpt-4' } as ChatRequest,
        error: new Error('failure'),
        errorType: 'rate_limited' as any,
        attempt: 1,
        triedProviders: [],
        triedModels: ['gpt-4'],
        timestamp: Date.now(),
        metadata: {
          providers: new Map([['provider1', {
            name: 'provider1',
            chat: vi.fn().mockResolvedValue(mockResponse),
          } as any]]),
        },
      };

      const response = await handler.execute(context);

      expect(response.model).toBe('gpt-3.5-turbo');
      expect(context.triedModels).toContain('gpt-3.5-turbo');
    });
  });

  describe('Cache Fallback Handler', () => {
    it('should check cache availability', () => {
      const cache = new Map([['key', {
        response: {} as ChatResponse,
        timestamp: Date.now(),
      }]]);

      const handler = new CacheFallbackHandler(cache, 60000);
      const context = {
        request: {} as ChatRequest,
        error: new Error('failure'),
        errorType: 'timeout' as any,
        attempt: 1,
        triedProviders: [],
        triedModels: [],
        timestamp: Date.now(),
      };

      // Should not handle without proper cache key generation
      expect(handler.canHandle(context)).toBe(false);
    });

    it('should return cached response', async () => {
      const cachedResponse: ChatResponse = {
        content: 'cached response',
        model: 'cached-model',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      };

      const cache = new Map();
      const handler = new CacheFallbackHandler(cache, 60000);
      const request = {
        model: 'test-model',
        messages: [{ role: 'user', content: 'test' }],
      } as ChatRequest;

      // Manually set cache for testing
      cache.set(JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        maxTokens: request.maxTokens,
      }), {
        response: cachedResponse,
        timestamp: Date.now(),
      });

      const context = {
        request,
        error: new Error('failure'),
        errorType: 'timeout' as any,
        attempt: 1,
        triedProviders: [],
        triedModels: [],
        timestamp: Date.now(),
      };

      const response = await handler.execute(context);

      expect(response.content).toBe('cached response');
      expect(response.metadata?.cached).toBe(true);
    });

    it('should respect cache TTL', () => {
      const cache = new Map([['key', {
        response: {} as ChatResponse,
        timestamp: Date.now() - 120000, // 2 minutes ago
      }]]);

      const handler = new CacheFallbackHandler(cache, 60000); // 1 minute TTL
      const context = {
        request: {} as ChatRequest,
        error: new Error('failure'),
        errorType: 'timeout' as any,
        attempt: 1,
        triedProviders: [],
        triedModels: [],
        timestamp: Date.now(),
      };

      expect(handler.canHandle(context)).toBe(false);
    });
  });

  describe('Graceful Degradation Handler', () => {
    it('should always handle', () => {
      const handler = new GracefulDegradationHandler(0.5);
      const context = {
        request: {} as ChatRequest,
        error: new Error('failure'),
        errorType: 'timeout' as any,
        attempt: 1,
        triedProviders: [],
        triedModels: [],
        timestamp: Date.now(),
      };

      expect(handler.canHandle(context)).toBe(true);
    });

    it('should apply degradation to request', async () => {
      const mockResponse: ChatResponse = {
        content: 'degraded response',
        model: 'test-model',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      };

      const handler = new GracefulDegradationHandler(0.5);
      const request = {
        model: 'test-model',
        messages: [
          { role: 'system', content: 'system' },
          { role: 'user', content: 'message 1' },
          { role: 'assistant', content: 'response 1' },
          { role: 'user', content: 'message 2' },
          { role: 'assistant', content: 'response 2' },
          { role: 'user', content: 'message 3' },
        ],
        maxTokens: 2048,
        temperature: 1.0,
      } as ChatRequest;

      const context = {
        request,
        error: new Error('failure'),
        errorType: 'timeout' as any,
        attempt: 1,
        triedProviders: [],
        triedModels: [],
        timestamp: Date.now(),
        metadata: {
          provider: {
            chat: vi.fn().mockResolvedValue(mockResponse),
          } as any,
        },
      };

      const response = await handler.execute(context);

      expect(response.metadata?.degraded).toBe(true);
      expect(response.metadata?.degradationLevel).toBe(0.5);

      // Verify degraded request was sent
      const chatCall = (context.metadata?.provider as any).chat as ReturnType<typeof vi.fn>;
      expect(chatCall).toHaveBeenCalled();
      const degradedRequest = chatCall.mock.calls[0][0] as ChatRequest;
      expect(degradedRequest.maxTokens).toBeLessThan(request.maxTokens!);
      expect(degradedRequest.messages.length).toBeLessThan(request.messages.length);
    });
  });

  describe('Default Response Handler', () => {
    it('should always handle', () => {
      const defaultResponse: ChatResponse = {
        content: 'default response',
        model: 'default',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };

      const handler = new DefaultResponseHandler(defaultResponse);
      const context = {
        request: {} as ChatRequest,
        error: new Error('failure'),
        errorType: 'timeout' as any,
        attempt: 1,
        triedProviders: [],
        triedModels: [],
        timestamp: Date.now(),
      };

      expect(handler.canHandle(context)).toBe(true);
    });

    it('should return default response', async () => {
      const defaultResponse: ChatResponse = {
        content: 'default response',
        model: 'default',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };

      const handler = new DefaultResponseHandler(defaultResponse);
      const context = {
        request: {} as ChatRequest,
        error: new Error('failure'),
        errorType: 'timeout' as any,
        attempt: 1,
        triedProviders: [],
        triedModels: [],
        timestamp: Date.now(),
      };

      const response = await handler.execute(context);

      expect(response.content).toBe('default response');
      expect(response.metadata?.fallback).toBe(true);
      expect(response.metadata?.originalError).toBe('failure');
    });
  });

  describe('Fail Fast Handler', () => {
    it('should always handle', () => {
      const handler = new FailFastHandler();
      const context = {
        request: {} as ChatRequest,
        error: new Error('failure'),
        errorType: 'timeout' as any,
        attempt: 1,
        triedProviders: [],
        triedModels: [],
        timestamp: Date.now(),
      };

      expect(handler.canHandle(context)).toBe(true);
    });

    it('should throw error immediately', async () => {
      const handler = new FailFastHandler();
      const context = {
        request: {} as ChatRequest,
        error: new Error('failure'),
        errorType: 'timeout' as any,
        attempt: 1,
        triedProviders: [],
        triedModels: [],
        timestamp: Date.now(),
      };

      await expect(handler.execute(context)).rejects.toThrow('Fail fast');
    });
  });

  describe('Fallback Executor', () => {
    it('should execute fallback chain', async () => {
      const mockResponse: ChatResponse = {
        content: 'fallback response',
        model: 'fallback-model',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      };

      const providers = new Map<string, ProviderClient>([
        ['provider1', {
          name: 'provider1',
          chat: vi.fn().mockResolvedValue(mockResponse),
        } as any],
      ]);

      const executor = new FallbackExecutor({
        primaryStrategy: FallbackStrategy.PROVIDER_FALLBACK,
        fallbackChain: [
          FallbackStrategy.PROVIDER_FALLBACK,
          FallbackStrategy.FAIL_FAST,
        ],
        maxFallbackAttempts: 2,
        fallbackTimeout: 5000,
        enableCacheFallback: false,
        cacheFallbackTTL: 300000,
        enableGracefulDegradation: false,
        degradationLevel: 0.5,
      });

      const request = {} as ChatRequest;
      const error = new Error('failure');

      const result = await executor.execute(request, error, providers);

      expect(result.success).toBe(true);
      expect(result.response).toBe(mockResponse);
      expect(result.strategy).toBe('provider_fallback');
    });

    it('should fail when all strategies fail', async () => {
      const providers = new Map<string, ProviderClient>();

      const executor = new FallbackExecutor({
        primaryStrategy: FallbackStrategy.FAIL_FAST,
        fallbackChain: [FallbackStrategy.FAIL_FAST],
        maxFallbackAttempts: 1,
        fallbackTimeout: 5000,
        enableCacheFallback: false,
        cacheFallbackTTL: 300000,
        enableGracefulDegradation: false,
        degradationLevel: 0.5,
      });

      const request = {} as ChatRequest;
      const error = new Error('failure');

      const result = await executor.execute(request, error, providers);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('Factory Functions', () => {
    it('should create model hierarchy', () => {
      const hierarchy = createModelHierarchy();

      expect(hierarchy['gpt-4']).toContain('gpt-3.5-turbo');
      expect(hierarchy['claude-3-opus']).toContain('claude-3-sonnet');
      expect(hierarchy['llama-3-70b']).toContain('llama-3-8b');
    });

    it('should create default response', () => {
      const response = createDefaultResponse();

      expect(response.content).toBeTruthy();
      expect(response.model).toBe('fallback');
      expect(response.usage.totalTokens).toBe(0);
      expect(response.metadata?.fallback).toBe(true);
    });

    it('should create fallback executor', () => {
      const providers = new Map<string, ProviderClient>();
      const executor = createFallbackExecutor(providers);

      expect(executor).toBeInstanceOf(FallbackExecutor);
      expect(executor.getHandlers().length).toBeGreaterThan(0);
    });
  });
});
