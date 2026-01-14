/**
 * Tests for Global Error Handler
 */

import { describe, it, expect, vi } from 'vitest';
import {
  GlobalErrorHandler,
  createGlobalErrorHandler,
  createProductionErrorHandler,
  createMinimalErrorHandler,
} from './handler';
import type { ProviderClient } from '../providers/base';
import type { ChatRequest, ChatResponse } from '../../types/index';
import { ErrorType } from './types';

// Mock R2Bucket
const mockBucket = {
  put: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
} as any;

// Mock KVNamespace
const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
} as any;

describe('Global Error Handler', () => {
  describe('Basic Functionality', () => {
    it('should execute request successfully', async () => {
      const mockResponse: ChatResponse = {
        content: 'test response',
        model: 'test-model',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      };

      const mockProvider = {
        name: 'test-provider',
        chat: vi.fn().mockResolvedValue(mockResponse),
      } as ProviderClient;

      const handler = new GlobalErrorHandler({
        enableRetry: false,
        enableFallback: false,
        enableCircuitBreaker: false,
        enableDeadLetterQueue: false,
        enableErrorReporting: false,
        maxRetries: 0,
        maxFallbackAttempts: 0,
        sendToDeadLetterQueue: false,
        reportErrors: false,
      });

      handler.registerProvider('test-provider', mockProvider);

      const request = { model: 'test-model' } as ChatRequest;
      const response = await handler.execute(request, { provider: 'test-provider' });

      expect(response).toBe(mockResponse);
      expect(mockProvider.chat).toHaveBeenCalledTimes(1);
    });

    it('should handle errors with retry', async () => {
      const mockResponse: ChatResponse = {
        content: 'test response',
        model: 'test-model',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      };

      const mockProvider = {
        name: 'test-provider',
        chat: vi.fn()
          .mockRejectedValueOnce(new Error('timeout'))
          .mockResolvedValue(mockResponse),
      } as ProviderClient;

      const handler = new GlobalErrorHandler({
        enableRetry: true,
        enableFallback: false,
        enableCircuitBreaker: false,
        enableDeadLetterQueue: false,
        enableErrorReporting: false,
        maxRetries: 3,
        maxFallbackAttempts: 0,
        sendToDeadLetterQueue: false,
        reportErrors: false,
      });

      handler.registerProvider('test-provider', mockProvider);

      const request = { model: 'test-model' } as ChatRequest;
      const response = await handler.execute(request, { provider: 'test-provider' });

      expect(response).toBe(mockResponse);
      expect(mockProvider.chat).toHaveBeenCalledTimes(2); // initial + 1 retry
    });

    it('should fail after all retries exhausted', async () => {
      const mockProvider = {
        name: 'test-provider',
        chat: vi.fn().mockRejectedValue(new Error('timeout')),
      } as ProviderClient;

      const handler = new GlobalErrorHandler({
        enableRetry: true,
        enableFallback: false,
        enableCircuitBreaker: false,
        enableDeadLetterQueue: false,
        enableErrorReporting: false,
        maxRetries: 2,
        maxFallbackAttempts: 0,
        sendToDeadLetterQueue: false,
        reportErrors: false,
      });

      handler.registerProvider('test-provider', mockProvider);

      const request = { model: 'test-model' } as ChatRequest;

      await expect(handler.execute(request, { provider: 'test-provider' }))
        .rejects.toThrow('timeout');
    });
  });

  describe('Error Handling', () => {
    it('should handle error and return detailed result', async () => {
      const mockProvider = {
        name: 'test-provider',
        chat: vi.fn().mockRejectedValue(new Error('timeout')),
      } as ProviderClient;

      const handler = new GlobalErrorHandler({
        enableRetry: false,
        enableFallback: false,
        enableCircuitBreaker: false,
        enableDeadLetterQueue: false,
        enableErrorReporting: false,
        maxRetries: 0,
        maxFallbackAttempts: 0,
        sendToDeadLetterQueue: false,
        reportErrors: false,
      });

      handler.registerProvider('test-provider', mockProvider);

      const request = { model: 'test-model' } as ChatRequest;
      const error = new Error('timeout');

      const result = await handler.handleError(request, error, {
        provider: 'test-provider',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.totalTime).toBeGreaterThanOrEqual(0);
      expect(result.steps).toBeInstanceOf(Array);
    });

    it('should classify errors correctly', async () => {
      const mockProvider = {
        name: 'test-provider',
        chat: vi.fn().mockRejectedValue(new Error('timeout')),
      } as ProviderClient;

      const handler = new GlobalErrorHandler({
        enableRetry: false,
        enableFallback: false,
        enableCircuitBreaker: false,
        enableDeadLetterQueue: false,
        enableErrorReporting: false,
        maxRetries: 0,
        maxFallbackAttempts: 0,
        sendToDeadLetterQueue: false,
        reportErrors: false,
      });

      handler.registerProvider('test-provider', mockProvider);

      const request = { model: 'test-model' } as ChatRequest;
      const error = new Error('timeout');

      const result = await handler.handleError(request, error);

      expect(result.errorType).toBe(ErrorType.TIMEOUT);
    });
  });

  describe('Provider Management', () => {
    it('should register provider', () => {
      const handler = new GlobalErrorHandler({
        enableRetry: false,
        enableFallback: false,
        enableCircuitBreaker: false,
        enableDeadLetterQueue: false,
        enableErrorReporting: false,
        maxRetries: 0,
        maxFallbackAttempts: 0,
        sendToDeadLetterQueue: false,
        reportErrors: false,
      });

      const mockProvider = { name: 'test-provider' } as ProviderClient;

      handler.registerProvider('test-provider', mockProvider);

      // Should not throw
      expect(() => handler.registerProvider('test-provider', mockProvider))
        .not.toThrow();
    });

    it('should unregister provider', () => {
      const handler = new GlobalErrorHandler({
        enableRetry: false,
        enableFallback: false,
        enableCircuitBreaker: false,
        enableDeadLetterQueue: false,
        enableErrorReporting: false,
        maxRetries: 0,
        maxFallbackAttempts: 0,
        sendToDeadLetterQueue: false,
        reportErrors: false,
      });

      const mockProvider = { name: 'test-provider' } as ProviderClient;

      handler.registerProvider('test-provider', mockProvider);
      handler.unregisterProvider('test-provider');

      // Should not throw
      expect(() => handler.unregisterProvider('test-provider'))
        .not.toThrow();
    });
  });

  describe('Configuration', () => {
    it('should get configuration', () => {
      const handler = new GlobalErrorHandler({
        enableRetry: true,
        enableFallback: true,
        enableCircuitBreaker: true,
        enableDeadLetterQueue: true,
        enableErrorReporting: true,
        maxRetries: 5,
        maxFallbackAttempts: 3,
        sendToDeadLetterQueue: true,
        reportErrors: true,
      });

      const config = handler.getConfig();

      expect(config.enableRetry).toBe(true);
      expect(config.enableFallback).toBe(true);
      expect(config.maxRetries).toBe(5);
      expect(config.maxFallbackAttempts).toBe(3);
    });

    it('should update configuration', () => {
      const handler = new GlobalErrorHandler({
        enableRetry: true,
        enableFallback: false,
        enableCircuitBreaker: false,
        enableDeadLetterQueue: false,
        enableErrorReporting: false,
        maxRetries: 3,
        maxFallbackAttempts: 0,
        sendToDeadLetterQueue: false,
        reportErrors: false,
      });

      handler.updateConfig({ maxRetries: 5 });

      const config = handler.getConfig();
      expect(config.maxRetries).toBe(5);
    });
  });

  describe('Metrics', () => {
    it('should return empty metrics when components disabled', async () => {
      const handler = new GlobalErrorHandler({
        enableRetry: false,
        enableFallback: false,
        enableCircuitBreaker: false,
        enableDeadLetterQueue: false,
        enableErrorReporting: false,
        maxRetries: 0,
        maxFallbackAttempts: 0,
        sendToDeadLetterQueue: false,
        reportErrors: false,
      });

      const metrics = await handler.getMetrics();

      expect(metrics).toEqual({});
    });
  });
});

describe('Factory Functions', () => {
  describe('createGlobalErrorHandler', () => {
    it('should create handler with default config', () => {
      const handler = createGlobalErrorHandler();

      expect(handler).toBeInstanceOf(GlobalErrorHandler);

      const config = handler.getConfig();
      expect(config.enableRetry).toBe(true);
      expect(config.enableFallback).toBe(true);
      expect(config.enableCircuitBreaker).toBe(true);
      expect(config.maxRetries).toBe(3);
    });

    it('should override default config', () => {
      const handler = createGlobalErrorHandler({
        maxRetries: 5,
        enableFallback: false,
      });

      const config = handler.getConfig();
      expect(config.maxRetries).toBe(5);
      expect(config.enableFallback).toBe(false);
    });
  });

  describe('createMinimalErrorHandler', () => {
    it('should create minimal handler', () => {
      const handler = createMinimalErrorHandler();

      expect(handler).toBeInstanceOf(GlobalErrorHandler);

      const config = handler.getConfig();
      expect(config.enableRetry).toBe(true);
      expect(config.enableFallback).toBe(false);
      expect(config.enableCircuitBreaker).toBe(false);
      expect(config.enableDeadLetterQueue).toBe(false);
      expect(config.enableErrorReporting).toBe(false);
      expect(config.maxRetries).toBe(2);
    });
  });

  describe('createProductionErrorHandler', () => {
    it('should create production handler with all features', () => {
      const providers = new Map<string, ProviderClient>();
      const handler = createProductionErrorHandler(providers, mockBucket, mockKV);

      expect(handler).toBeInstanceOf(GlobalErrorHandler);

      const config = handler.getConfig();
      expect(config.enableRetry).toBe(true);
      expect(config.enableFallback).toBe(true);
      expect(config.enableCircuitBreaker).toBe(true);
      expect(config.enableDeadLetterQueue).toBe(true);
      expect(config.enableErrorReporting).toBe(true);
      expect(config.sendToDeadLetterQueue).toBe(true);
      expect(config.reportErrors).toBe(true);
    });

    it('should initialize all components', () => {
      const providers = new Map<string, ProviderClient>();
      const handler = createProductionErrorHandler(providers, mockBucket, mockKV);

      const config = handler.getConfig();
      expect(config.circuitBreaker).toBeTruthy();
      expect(config.fallbackExecutor).toBeTruthy();
      expect(config.deadLetterQueue).toBeTruthy();
      expect(config.errorReporter).toBeTruthy();
    });
  });
});

describe('Error Handling Integration', () => {
  it('should handle error with full recovery chain', async () => {
    const mockResponse: ChatResponse = {
      content: 'test response',
      model: 'test-model',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    };

    const mockProvider = {
      name: 'test-provider',
      chat: vi.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue(mockResponse),
    } as ProviderClient;

    const handler = new GlobalErrorHandler({
      enableRetry: true,
      enableFallback: false,
      enableCircuitBreaker: false,
      enableDeadLetterQueue: false,
      enableErrorReporting: false,
      maxRetries: 3,
      maxFallbackAttempts: 0,
      sendToDeadLetterQueue: false,
      reportErrors: false,
    });

    handler.registerProvider('test-provider', mockProvider);

    const request = { model: 'test-model' } as ChatRequest;

    const response = await handler.execute(request, { provider: 'test-provider' });

    expect(response).toBe(mockResponse);
  });

  it('should track retry attempts in result', async () => {
    const mockProvider = {
      name: 'test-provider',
      chat: vi.fn().mockRejectedValue(new Error('timeout')),
    } as ProviderClient;

    const handler = new GlobalErrorHandler({
      enableRetry: true,
      enableFallback: false,
      enableCircuitBreaker: false,
      enableDeadLetterQueue: false,
      enableErrorReporting: false,
      maxRetries: 2,
      maxFallbackAttempts: 0,
        sendToDeadLetterQueue: false,
      reportErrors: false,
    });

    handler.registerProvider('test-provider', mockProvider);

    const request = { model: 'test-model' } as ChatRequest;
    const error = new Error('timeout');

    const result = await handler.handleError(request, error);

    expect(result.retryAttempts).toBe(2);
    expect(result.steps.some(s => s.type === 'retry')).toBe(true);
  });
});
