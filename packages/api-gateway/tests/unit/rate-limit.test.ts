/**
 * Rate Limiter Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RateLimiter,
  createRateLimiter,
  createRateLimitRPM,
  createRateLimitRPS,
} from '../../src/rate-limit';
import type { GatewayRequest, GatewayContext } from '../../src/types';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = createRateLimiter({
      algorithm: 'token_bucket',
      storage: 'memory',
      defaultLimits: [],
    });
  });

  describe('Token bucket algorithm', () => {
    it('should allow requests within limit', async () => {
      rateLimiter.addLimit({
        id: 'test-limit',
        name: 'Test Limit',
        scope: 'per_ip',
        limit: 10,
        window: 60000,
      });

      const request = createMockRequest();
      const context = createMockContext();

      const result = await rateLimiter.check(request, context);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('should block requests exceeding limit', async () => {
      rateLimiter.addLimit({
        id: 'strict-limit',
        name: 'Strict Limit',
        scope: 'per_ip',
        limit: 2,
        window: 60000,
      });

      const request = createMockRequest();
      const context = createMockContext();

      // First two requests should be allowed
      const result1 = await rateLimiter.check(request, context);
      const result2 = await rateLimiter.check(request, context);

      // Third request should be blocked
      const result3 = await rateLimiter.check(request, context);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result3.allowed).toBe(false);
    });

    it('should provide retry after time', async () => {
      rateLimiter.addLimit({
        id: 'retry-limit',
        name: 'Retry Limit',
        scope: 'per_ip',
        limit: 1,
        window: 10000,
      });

      const request = createMockRequest();
      const context = createMockContext();

      // First request allowed
      await rateLimiter.check(request, context);

      // Second request blocked
      const result = await rateLimiter.check(request, context);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter!).toBeGreaterThan(0);
    });
  });

  describe('Multiple rate limits', () => {
    it('should apply hierarchical limits', async () => {
      rateLimiter.addLimit({
        id: 'user-limit',
        name: 'User Limit',
        scope: 'per_user',
        limit: 100,
        window: 60000,
      });

      rateLimiter.addLimit({
        id: 'ip-limit',
        name: 'IP Limit',
        scope: 'per_ip',
        limit: 10,
        window: 60000,
      });

      const request = createMockRequest();
      request.metadata.userId = 'user-123';

      const context = createMockContext();

      const result = await rateLimiter.check(request, context);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    it('should track rate limit statistics', async () => {
      rateLimiter.addLimit({
        id: 'stats-limit',
        name: 'Stats Limit',
        scope: 'per_ip',
        limit: 10,
        window: 60000,
      });

      const request = createMockRequest();
      const context = createMockContext();

      await rateLimiter.check(request, context);
      await rateLimiter.check(request, context);

      const stats = rateLimiter.getStats();

      expect(stats.totalChecks).toBe(2);
      expect(stats.allowedRequests).toBe(2);
      expect(stats.blockedRequests).toBe(0);
    });

    it('should reset statistics', async () => {
      rateLimiter.addLimit({
        id: 'reset-stats-limit',
        name: 'Reset Stats Limit',
        scope: 'per_ip',
        limit: 10,
        window: 60000,
      });

      const request = createMockRequest();
      const context = createMockContext();

      await rateLimiter.check(request, context);
      rateLimiter.resetStats();

      const stats = rateLimiter.getStats();

      expect(stats.totalChecks).toBe(0);
      expect(stats.allowedRequests).toBe(0);
    });
  });

  describe('Helper functions', () => {
    it('should create RPM rate limit', () => {
      const limit = createRateLimitRPM(100, 'per_user');

      expect(limit.limit).toBe(100);
      expect(limit.window).toBe(60000);
      expect(limit.scope).toBe('per_user');
    });

    it('should create RPS rate limit', () => {
      const limit = createRateLimitRPS(10, 'per_ip');

      expect(limit.limit).toBe(10);
      expect(limit.window).toBe(1000);
      expect(limit.scope).toBe('per_ip');
    });
  });

  describe('Reset functionality', () => {
    it('should reset rate limit for identifier', async () => {
      rateLimiter.addLimit({
        id: 'reset-limit',
        name: 'Reset Limit',
        scope: 'per_ip',
        limit: 2,
        window: 60000,
      });

      const request = createMockRequest();
      const context = createMockContext();

      // Use up limit
      await rateLimiter.check(request, context);
      await rateLimiter.check(request, context);

      // Should be blocked
      const result1 = await rateLimiter.check(request, context);
      expect(result1.allowed).toBe(false);

      // Reset
      await rateLimiter.reset('127.0.0.1', 'per_ip');

      // Should be allowed again
      const result2 = await rateLimiter.check(request, context);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('Current usage', () => {
    it('should return current usage', async () => {
      rateLimiter.addLimit({
        id: 'usage-limit',
        name: 'Usage Limit',
        scope: 'per_ip',
        limit: 10,
        window: 60000,
      });

      const request = createMockRequest();
      const context = createMockContext();

      // Make 3 requests
      await rateLimiter.check(request, context);
      await rateLimiter.check(request, context);
      await rateLimiter.check(request, context);

      const usage = await rateLimiter.getCurrentUsage('127.0.0.1', 'per_ip');

      expect(usage).toBe(3);
    });
  });
});

// Helper functions
function createMockRequest(): GatewayRequest {
  const url = new URL('/test', 'http://example.com');

  return {
    id: 'test-request-id',
    method: 'GET',
    url,
    headers: new Headers(),
    body: null,
    query: url.searchParams,
    ip: '127.0.0.1',
    userAgent: 'test-agent',
    timestamp: Date.now(),
    metadata: {
      sourceIp: '127.0.0.1',
      userAgent: 'test-agent',
      tags: {},
    },
  };
}

function createMockContext(): GatewayContext {
  return {
    env: {} as any,
    ctx: {} as any,
    requestId: 'test-context-id',
    timestamp: Date.now(),
  };
}
