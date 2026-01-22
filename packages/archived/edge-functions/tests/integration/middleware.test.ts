/**
 * Integration tests for Middleware
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MiddlewareChain,
  loggingMiddleware,
  timingMiddleware,
  errorHandlingMiddleware,
  rateLimitMiddleware,
  corsMiddleware,
  createMiddlewareChain,
} from '../../src/middleware/middleware';
import { EdgeRequest, EdgeResponse } from '../../src/types';

describe('Middleware Integration', () => {
  let chain: MiddlewareChain;
  let mockRequest: EdgeRequest;
  let mockContext: any;
  let mockHandler: () => Promise<EdgeResponse>;

  beforeEach(() => {
    chain = createMiddlewareChain();

    mockRequest = {
      id: 'req-1',
      functionId: 'test-func',
      input: { name: 'test' },
      timestamp: Date.now(),
      headers: new Headers({
        'Origin': 'https://example.com',
        'Accept-Encoding': 'gzip',
      }),
    };

    mockContext = {
      env: {},
      waitUntil: vi.fn(),
    };

    mockHandler = async () => ({
      id: 'resp-1',
      requestId: mockRequest.id,
      functionId: mockRequest.functionId,
      data: 'success',
      status: 'success' as const,
      metrics: {
        functionId: mockRequest.functionId,
        executionId: 'exec-1',
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 100,
        memoryUsed: 1024,
        cpuTime: 50,
        status: 'success' as const,
      },
    });
  });

  describe('Middleware Chain', () => {
    it('should execute middleware in order', async () => {
      const order: string[] = [];

      chain.use({
        name: 'first',
        priority: 0,
        handler: async (req, ctx, next) => {
          order.push('first');
          return next();
        },
      });

      chain.use({
        name: 'second',
        priority: 1,
        handler: async (req, ctx, next) => {
          order.push('second');
          return next();
        },
      });

      await chain.execute(mockRequest, mockContext, mockHandler);

      expect(order).toEqual(['first', 'second']);
    });

    it('should respect middleware priority', async () => {
      const order: string[] = [];

      chain.use({
        name: 'low',
        priority: 10,
        handler: async (req, ctx, next) => {
          order.push('low');
          return next();
        },
      });

      chain.use({
        name: 'high',
        priority: -10,
        handler: async (req, ctx, next) => {
          order.push('high');
          return next();
        },
      });

      await chain.execute(mockRequest, mockContext, mockHandler);

      expect(order).toEqual(['high', 'low']);
    });
  });

  describe('Logging Middleware', () => {
    it('should log requests and responses', async () => {
      const logs: string[] = [];
      const logger = (message: string, data?: any) => logs.push(message);

      chain.use(loggingMiddleware({ logger }));

      await chain.execute(mockRequest, mockContext, mockHandler);

      expect(logs).toContain('[Request] test-func');
      expect(logs).toContain('[Response] test-func');
    });

    it('should log errors', async () => {
      const logs: string[] = [];
      const logger = (message: string, data?: any) => logs.push(message);

      chain.use(loggingMiddleware({ logger }));

      const errorHandler = async () => {
        throw new Error('Test error');
      };

      await expect(
        chain.execute(mockRequest, mockContext, errorHandler)
      ).rejects.toThrow();

      expect(logs).toContain('[Error] test-func');
    });
  });

  describe('Timing Middleware', () => {
    it('should add timing header to response', async () => {
      chain.use(timingMiddleware());

      const response = await chain.execute(mockRequest, mockContext, mockHandler);

      expect(response.headers?.has('X-Function-Duration')).toBe(true);
    });
  });

  describe('Error Handling Middleware', () => {
    it('should handle errors gracefully', async () => {
      chain.use(errorHandlingMiddleware({
        onError: (error, request) => ({
          id: 'error-1',
          requestId: request.id,
          functionId: request.functionId,
          data: { error: error.message },
          status: 'error' as const,
          metrics: {
            functionId: request.functionId,
            executionId: 'exec-1',
            startTime: Date.now(),
            endTime: Date.now(),
            duration: 0,
            memoryUsed: 0,
            cpuTime: 0,
            status: 'error' as const,
          },
        }),
      }));

      const errorHandler = async () => {
        throw new Error('Test error');
      };

      const response = await chain.execute(mockRequest, mockContext, errorHandler);

      expect(response.status).toBe('error');
    });

    it('should transform errors', async () => {
      chain.use(errorHandlingMiddleware({
        transformError: (error) => {
          return new Error(`Transformed: ${error.message}`);
        },
      }));

      const errorHandler = async () => {
        throw new Error('Original error');
      };

      await expect(
        chain.execute(mockRequest, mockContext, errorHandler)
      ).rejects.toThrow('Transformed: Original error');
    });
  });

  describe('Rate Limiting Middleware', () => {
    it('should allow requests under limit', async () => {
      const storage = new Map();

      chain.use(rateLimitMiddleware({
        limit: 5,
        window: 60000,
        storage,
      }));

      const response = await chain.execute(mockRequest, mockContext, mockHandler);

      expect(response.status).toBe('success');
    });

    it('should block requests over limit', async () => {
      const storage = new Map();

      chain.use(rateLimitMiddleware({
        limit: 2,
        window: 60000,
        storage,
      }));

      // First 2 requests should succeed
      await chain.execute(mockRequest, mockContext, mockHandler);
      await chain.execute(mockRequest, mockContext, mockHandler);

      // Third request should be rate limited
      const response = await chain.execute(mockRequest, mockContext, mockHandler);

      expect(response.status).toBe('error');
    });
  });

  describe('CORS Middleware', () => {
    it('should add CORS headers', async () => {
      chain.use(corsMiddleware({
        origin: 'https://example.com',
        methods: ['GET', 'POST'],
        credentials: true,
      }));

      const response = await chain.execute(mockRequest, mockContext, mockHandler);

      expect(response.headers?.has('Access-Control-Allow-Origin')).toBe(true);
      expect(response.headers?.has('Access-Control-Allow-Methods')).toBe(true);
      expect(response.headers?.has('Access-Control-Allow-Credentials')).toBe(true);
    });

    it('should use wildcard origin if not specified', async () => {
      chain.use(corsMiddleware());

      const response = await chain.execute(mockRequest, mockContext, mockHandler);

      expect(response.headers?.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });

  describe('Complex Middleware Scenarios', () => {
    it('should handle multiple middleware layers', async () => {
      chain.use(loggingMiddleware());
      chain.use(timingMiddleware());
      chain.use(corsMiddleware());
      chain.use(errorHandlingMiddleware());

      const response = await chain.execute(mockRequest, mockContext, mockHandler);

      expect(response.status).toBe('success');
      expect(response.headers?.has('X-Function-Duration')).toBe(true);
      expect(response.headers?.has('Access-Control-Allow-Origin')).toBe(true);
    });

    it('should apply middleware only to specific functions', async () => {
      chain.use({
        ...timingMiddleware(),
        applyTo: ['specific-func'],
      });

      // Should apply timing header
      const specificRequest = { ...mockRequest, functionId: 'specific-func' };
      const response1 = await chain.execute(specificRequest, mockContext, mockHandler);

      expect(response1.headers?.has('X-Function-Duration')).toBe(true);

      // Should not apply timing header
      const otherRequest = { ...mockRequest, functionId: 'other-func' };
      const response2 = await chain.execute(otherRequest, mockContext, mockHandler);

      expect(response2.headers?.has('X-Function-Duration')).toBe(false);
    });
  });
});
