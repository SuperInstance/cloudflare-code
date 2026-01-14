/**
 * Type validation tests for ClaudeFlare shared types
 *
 * These tests validate that:
 * 1. All types compile without errors
 * 2. Zod schemas match TypeScript types
 * 3. Type guards work correctly
 * 4. Utility types transform as expected
 */

import { describe, it, expect } from '@jest/globals';
import {
  // Core types
  Message,
  ChatRequest,
  ChatResponse,
  StreamChunk,
  RequestContext,
  RoutingRequest,
  MessageSchema,
  ChatRequestSchema,
  ChatResponseSchema,
  // Storage types
  SessionData,
  CacheEntry,
  CacheStats,
  SemanticCacheEntry,
  // Provider types
  Provider,
  ProviderConfig,
  ProviderHealth,
  ProviderRequest,
  ProviderResponse,
  // Metrics types
  RequestMetrics,
  AggregatedMetrics,
  QuotaInfo,
  CostSummary,
  // Error types
  APIError,
  RateLimitError,
  ProviderError,
  ValidationError,
  QuotaExceededError,
  isAPIError,
  isRateLimitError,
  isProviderError,
  // Utils
  PartialBy,
  Nullable,
  Dictionary,
  isString,
  isNumber,
  isObject
} from '../types';

describe('Core Types', () => {
  describe('Message', () => {
    it('should validate a valid message', () => {
      const message: Message = {
        role: 'user',
        content: 'Hello, ClaudeFlare!',
        timestamp: Date.now()
      };

      const result = MessageSchema.safeParse(message);
      expect(result.success).toBe(true);
    });

    it('should reject invalid message role', () => {
      const invalidMessage = {
        role: 'invalid',
        content: 'Hello'
      };

      const result = MessageSchema.safeParse(invalidMessage);
      expect(result.success).toBe(false);
    });
  });

  describe('ChatRequest', () => {
    it('should validate a valid chat request', () => {
      const request: ChatRequest = {
        messages: [
          {
            role: 'user',
            content: 'Hello'
          }
        ],
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000
      };

      const result = ChatRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe('ChatResponse', () => {
    it('should validate a valid chat response', () => {
      const response: ChatResponse = {
        content: 'Hello! How can I help you?',
        model: 'gpt-4',
        tokens: {
          prompt: 10,
          completion: 20,
          total: 30
        },
        latency: 500
      };

      const result = ChatResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });
});

describe('Storage Types', () => {
  describe('SessionData', () => {
    it('should create valid session data', () => {
      const session: SessionData = {
        sessionId: 'session-123',
        userId: 'user-456',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        messages: [],
        metadata: {
          totalTokens: 0,
          totalCost: 0,
          requestCount: 0
        },
        status: 'active'
      };

      expect(session.sessionId).toBeDefined();
      expect(session.userId).toBeDefined();
    });
  });

  describe('CacheEntry', () => {
    it('should create valid cache entry', () => {
      const entry: CacheEntry<string> = {
        key: 'test-key',
        value: 'test-value',
        timestamp: Date.now(),
        ttl: 60000
      };

      expect(entry.key).toBe('test-key');
      expect(entry.value).toBe('test-value');
    });
  });
});

describe('Provider Types', () => {
  describe('Provider', () => {
    it('should create valid provider configuration', () => {
      const provider: Provider = {
        id: 'openai',
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        models: ['gpt-4', 'gpt-3.5-turbo'],
        qualityTier: 'high' as const,
        costPer1KTokens: {
          input: 0.03,
          output: 0.06
        },
        performance: {
          avgLatency: 500,
          p50Latency: 450,
          p90Latency: 800,
          p99Latency: 1200,
          tokensPerSecond: 50,
          successRate: 0.99
        },
        availability: {
          healthy: true,
          rateLimitRemaining: 100,
          freeTierRemaining: 1000000,
          freeTierQuota: 1000000,
          currentUsage: 50000,
          lastHealthCheck: Date.now()
        },
        constraints: {
          maxContextWindow: 128000,
          maxOutputTokens: 4096,
          supportedFeatures: ['streaming', 'function_calling'],
          rateLimitRpm: 100,
          rateLimitTpm: 150000,
          regions: ['us-east-1', 'eu-west-1']
        },
        config: {
          enabled: true,
          priority: 1,
          weight: 0.8,
          timeout: 30000,
          maxRetries: 3,
          retryDelay: 1000,
          enableFallback: true
        }
      };

      expect(provider.id).toBe('openai');
      expect(provider.qualityTier).toBe('high');
    });
  });
});

describe('Metrics Types', () => {
  describe('RequestMetrics', () => {
    it('should create valid request metrics', () => {
      const metrics: RequestMetrics = {
        requestId: 'req-123',
        timestamp: Date.now(),
        provider: 'openai',
        model: 'gpt-4',
        latency: 500,
        tokens: 100,
        cacheHit: false,
        cost: 0.01,
        success: true
      };

      expect(metrics.requestId).toBeDefined();
      expect(metrics.provider).toBe('openai');
    });
  });

  describe('QuotaInfo', () => {
    it('should create valid quota info', () => {
      const quota: QuotaInfo = {
        provider: 'openai',
        used: 50000,
        limit: 1000000,
        resetAt: Date.now() + 86400000,
        usagePercentage: 0.05,
        status: 'ok'
      };

      expect(quota.usagePercentage).toBeLessThan(1);
      expect(quota.status).toBe('ok');
    });
  });
});

describe('Error Types', () => {
  describe('APIError', () => {
    it('should create API error with all properties', () => {
      const error = new APIError(
        500,
        'INTERNAL_ERROR',
        'Internal server error',
        { requestId: 'test-123' }
      );

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.timestamp).toBeDefined();
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error', () => {
      const error = new RateLimitError(
        60000,
        100,
        1000,
        Date.now() + 60000
      );

      expect(error.retryAfter).toBe(60000);
      expect(error.statusCode).toBe(429);
      expect(isRateLimitError(error)).toBe(true);
    });
  });

  describe('ProviderError', () => {
    it('should create provider error', () => {
      const error = new ProviderError(
        'openai',
        'Provider request failed',
        503,
        true,
        'gpt-4',
        5000
      );

      expect(error.providerId).toBe('openai');
      expect(error.retryable).toBe(true);
      expect(isProviderError(error)).toBe(true);
    });
  });

  describe('Type Guards', () => {
    it('should correctly identify API errors', () => {
      const apiError = new APIError(500, 'TEST', 'Test error');
      const standardError = new Error('Standard error');

      expect(isAPIError(apiError)).toBe(true);
      expect(isAPIError(standardError)).toBe(false);
    });
  });
});

describe('Utility Types', () => {
  describe('PartialBy', () => {
    it('should make specified properties optional', () => {
      interface User {
        id: string;
        name: string;
        email: string;
      }

      type UserUpdate = PartialBy<User, 'name' | 'email'>;

      const update: UserUpdate = {
        id: 'user-123'
      };

      expect(update.id).toBeDefined();
    });
  });

  describe('Nullable', () => {
    it('should make all properties nullable', () => {
      interface Data {
        value: string;
        count: number;
      }

      type NullableData = Nullable<Data>;

      const data: NullableData = {
        value: null,
        count: null
      };

      expect(data.value).toBeNull();
      expect(data.count).toBeNull();
    });
  });

  describe('Dictionary', () => {
    it('should create dictionary type', () => {
      const dict: Dictionary<string, number> = {
        a: 1,
        b: 2,
        c: 3
      };

      expect(dict['a']).toBe(1);
    });
  });
});

describe('Type Guards', () => {
  describe('isString', () => {
    it('should identify strings correctly', () => {
      expect(isString('hello')).toBe(true);
      expect(isString(123)).toBe(false);
      expect(isString(null)).toBe(false);
    });
  });

  describe('isNumber', () => {
    it('should identify numbers correctly', () => {
      expect(isNumber(123)).toBe(true);
      expect(isNumber('123')).toBe(false);
      expect(isNumber(NaN)).toBe(false);
    });
  });

  describe('isObject', () => {
    it('should identify objects correctly', () => {
      expect(isObject({})).toBe(true);
      expect(isObject([])).toBe(false);
      expect(isObject(null)).toBe(false);
      expect(isObject('string')).toBe(false);
    });
  });
});
