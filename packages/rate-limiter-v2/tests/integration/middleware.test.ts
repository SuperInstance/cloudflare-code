/**
 * Integration tests for middleware
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RateLimiter, RateLimitAlgorithm } from '../../src/index.js';
import {
  expressMiddleware,
  ipRateLimiter,
  userRateLimiter,
  apiKeyRateLimiter
} from '../../src/middleware/express.js';

// Mock Express request, response, and next function
class MockRequest {
  public ip: string;
  public path: string;
  public method: string;
  public headers: Record<string, string>;
  public user?: any;

  constructor(options: {
    ip?: string;
    path?: string;
    method?: string;
    headers?: Record<string, string>;
    user?: any;
  }) {
    this.ip = options.ip || '127.0.0.1';
    this.path = options.path || '/api/test';
    this.method = options.method || 'GET';
    this.headers = options.headers || {};
    this.user = options.user;
  }
}

class MockResponse {
  public headers: Record<string, string> = {};
  public statusCode: number = 200;
  public body: any = null;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  header(key: string, value: string) {
    this.headers[key] = value;
    return this;
  }

  setHeader(key: string, value: string) {
    this.headers[key] = value;
    return this;
  }

  json(data: any) {
    this.body = data;
    return this;
  }
}

describe('Express Middleware', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      config: {
        algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
        limit: 10,
        window: 1000
      }
    });
  });

  afterEach(async () => {
    await limiter.destroy();
  });

  it('should allow requests within limit', async () => {
    const middleware = expressMiddleware(limiter);

    const req = new MockRequest({
      ip: '127.0.0.1',
      path: '/api/test',
      method: 'GET'
    }) as any;

    const res = new MockResponse() as any;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('should deny requests exceeding limit', async () => {
    const middleware = expressMiddleware(limiter);

    const req = new MockRequest({
      ip: '127.0.0.1',
      path: '/api/test',
      method: 'GET'
    }) as any;

    const res = new MockResponse() as any;
    const next = vi.fn();

    // Exhaust limit
    for (let i = 0; i < 10; i++) {
      await middleware(req, res as any, next);
    }

    const finalRes = new MockResponse() as any;
    const finalNext = vi.fn();

    await middleware(req, finalRes, finalNext);

    expect(finalNext).not.toHaveBeenCalled();
    expect(finalRes.statusCode).toBe(429);
    expect(finalRes.body).toHaveProperty('error');
  });

  it('should add rate limit headers', async () => {
    const middleware = expressMiddleware(limiter, { headers: true });

    const req = new MockRequest({
      ip: '127.0.0.1',
      path: '/api/test',
      method: 'GET'
    }) as any;

    const res = new MockResponse() as any;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.headers['X-RateLimit-Limit']).toBeDefined();
    expect(res.headers['X-RateLimit-Remaining']).toBeDefined();
    expect(res.headers['X-RateLimit-Reset']).toBeDefined();
  });

  it('should use custom key generator', async () => {
    const middleware = expressMiddleware(limiter, {
      keyGenerator: (req: any) => `custom:${req.headers['x-api-key']}`
    });

    const req = new MockRequest({
      ip: '127.0.0.1',
      headers: { 'x-api-key': 'test-key' }
    }) as any;

    const res = new MockResponse() as any;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should skip requests based on skip function', async () => {
    const middleware = expressMiddleware(limiter, {
      skip: (req: any) => req.headers['x-skip'] === 'true'
    });

    const req = new MockRequest({
      ip: '127.0.0.1',
      headers: { 'x-skip': 'true' }
    }) as any;

    const res = new MockResponse() as any;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should use custom handler', async () => {
    const customHandler = vi.fn((req: any, res: any, result: any) => {
      res.status(429).json({ custom: 'message' });
    });

    const middleware = expressMiddleware(limiter, {
      handler: customHandler
    });

    const req = new MockRequest({
      ip: '127.0.0.1',
      path: '/api/test',
      method: 'GET'
    }) as any;

    const res = new MockResponse() as any;
    const next = vi.fn();

    // Exhaust limit
    for (let i = 0; i < 10; i++) {
      await middleware(req, res as any, next);
    }

    const finalRes = new MockResponse() as any;
    const finalNext = vi.fn();

    await middleware(req, finalRes, finalNext);

    expect(customHandler).toHaveBeenCalled();
    expect(finalRes.body).toHaveProperty('custom');
  });
});

describe('IP-based Rate Limiter Middleware', () => {
  it('should use IP as key', async () => {
    const limiter = new RateLimiter({
      config: {
        algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
        limit: 10,
        window: 1000
      }
    });

    const middleware = ipRateLimiter(limiter);

    const req = new MockRequest({
      ip: '192.168.1.1'
    }) as any;

    const res = new MockResponse() as any;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();

    await limiter.destroy();
  });
});

describe('User-based Rate Limiter Middleware', () => {
  it('should use user ID as key', async () => {
    const limiter = new RateLimiter({
      config: {
        algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
        limit: 10,
        window: 1000
      }
    });

    const middleware = userRateLimiter(limiter);

    const req = new MockRequest({
      ip: '127.0.0.1',
      user: { id: 'user-123' }
    }) as any;

    const res = new MockResponse() as any;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();

    await limiter.destroy();
  });
});

describe('API Key-based Rate Limiter Middleware', () => {
  it('should use API key as key', async () => {
    const limiter = new RateLimiter({
      config: {
        algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
        limit: 10,
        window: 1000
      }
    });

    const middleware = apiKeyRateLimiter(limiter);

    const req = new MockRequest({
      ip: '127.0.0.1',
      headers: { 'x-api-key': 'test-api-key' }
    }) as any;

    const res = new MockResponse() as any;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();

    await limiter.destroy();
  });

  it('should handle missing API key', async () => {
    const limiter = new RateLimiter({
      config: {
        algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
        limit: 10,
        window: 1000
      }
    });

    const middleware = apiKeyRateLimiter(limiter);

    const req = new MockRequest({
      ip: '127.0.0.1',
      headers: {}
    }) as any;

    const res = new MockResponse() as any;
    const next = vi.fn();

    await middleware(req, res, next);

    // Should fall back to IP
    expect(next).toHaveBeenCalled();

    await limiter.destroy();
  });
});

// Helper function for vi
function vi() {
  return {
    fn: () => {
      const calls: any[] = [];
      const fn = (...args: any[]) => {
        calls.push(args);
      };
      fn.calls = calls;
      fn.toHaveBeenCalled = () => calls.length > 0;
      fn.toHaveBeenCalledTimes = (n: number) => calls.length === n;
      fn.toHaveBeenCalledWith = (...args: any[]) => {
        return calls.some(call => JSON.stringify(call) === JSON.stringify(args));
      };
      return fn;
    }
  };
}
