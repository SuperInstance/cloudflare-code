/**
 * Unit Tests - Middleware
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { errorHandler, requestLogger, requestId, notFoundHandler } from './error-handler';
import { devCORS, corsWithOriginValidation } from './cors';
import type { Env } from '../types';

describe('errorHandler middleware', () => {
  let app: Hono<{ Bindings: Env }>;

  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>();
    app.use('*', errorHandler);
    app.env = {
      ENVIRONMENT: 'test',
      API_VERSION: '0.1.0',
    } as Env;
  });

  it('should pass through successful requests', async () => {
    app.get('/test', (c) => c.json({ success: true }));

    const response = await app.request('/test');

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ success: true });
  });

  it('should catch and format AppError', async () => {
    app.get('/error', () => {
      throw new Error('Test error');
    });

    const response = await app.request('/error');

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe('INTERNAL_ERROR');
  });

  it('should include request ID in error response', async () => {
    app.get('/error', () => {
      throw new Error('Test error');
    });

    const response = await app.request('/error', {
      headers: { 'X-Request-ID': 'test-123' },
    });

    const data = await response.json();
    expect(data.error.requestId).toBeDefined();
  });
});

describe('requestLogger middleware', () => {
  it('should log incoming requests', async () => {
    const consoleSpy = vi.spyOn(console, 'log');

    const app = new Hono<{ Bindings: Env }>();
    app.use('*', requestLogger);
    app.get('/test', (c) => c.json({ ok: true }));

    await app.request('/test');

    expect(consoleSpy).toHaveBeenCalled();
    const logCall = consoleSpy.mock.calls[0][0] as string;
    expect(logCall).toContain('GET');
    expect(logCall).toContain('/test');

    consoleSpy.mockRestore();
  });

  it('should log response with duration', async () => {
    const consoleSpy = vi.spyOn(console, 'log');

    const app = new Hono<{ Bindings: Env }>();
    app.use('*', requestLogger);
    app.get('/test', (c) => c.json({ ok: true }));

    await app.request('/test');

    expect(consoleSpy).toHaveBeenCalledTimes(2); // Request + response

    const responseLog = consoleSpy.mock.calls[1][0] as string;
    expect(responseLog).toContain('200');
    expect(responseLog).toContain('ms');

    consoleSpy.mockRestore();
  });
});

describe('requestId middleware', () => {
  it('should generate and add request ID header', async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', requestId);
    app.get('/test', (c) => c.json({ ok: true }));

    const response = await app.request('/test');

    expect(response.headers.get('X-Request-ID')).toBeDefined();
    expect(response.headers.get('X-Request-ID')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('should preserve existing request ID header', async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', requestId);
    app.get('/test', (c) => c.json({ ok: true }));

    const response = await app.request('/test', {
      headers: { 'X-Request-ID': 'existing-123' },
    });

    expect(response.headers.get('X-Request-ID')).toBe('existing-123');
  });
});

describe('notFoundHandler', () => {
  it('should return 404 for undefined routes', () => {
    const c = {
      req: { method: 'GET', path: '/undefined' },
      json: (data: any, status: number) => ({ status, data }),
    } as any;

    const response = notFoundHandler(c);

    expect(response.status).toBe(404);
    expect(response.data.error.code).toBe('NOT_FOUND');
    expect(response.data.error.message).toContain('GET /undefined');
  });
});

describe('CORS middleware', () => {
  describe('devCORS', () => {
    it('should add CORS headers for all origins', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', devCORS);
      app.get('/test', (c) => c.json({ ok: true }));

      const response = await app.request('/test', {
        headers: { Origin: 'https://example.com' },
      });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('should handle OPTIONS preflight requests', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', devCORS);
      app.get('/test', (c) => c.json({ ok: true }));

      const response = await app.request('/test', {
        method: 'OPTIONS',
      });

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeDefined();
    });
  });

  describe('corsWithOriginValidation', () => {
    it('should allow requests from allowed origins', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', corsWithOriginValidation(['https://example.com']));
      app.get('/test', (c) => c.json({ ok: true }));

      const response = await app.request('/test', {
        headers: { Origin: 'https://example.com' },
      });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    });

    it('should allow requests from wildcard subdomain', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', corsWithOriginValidation(['*.example.com']));
      app.get('/test', (c) => c.json({ ok: true }));

      const response = await app.request('/test', {
        headers: { Origin: 'https://sub.example.com' },
      });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://sub.example.com');
    });

    it('should block requests from non-allowed origins', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', corsWithOriginValidation(['https://allowed.com']));
      app.get('/test', (c) => c.json({ ok: true }));

      const response = await app.request('/test', {
        headers: { Origin: 'https://blocked.com' },
      });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('should allow all origins with wildcard', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', corsWithOriginValidation(['*']));
      app.get('/test', (c) => c.json({ ok: true }));

      const response = await app.request('/test', {
        headers: { Origin: 'https://any-origin.com' },
      });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://any-origin.com');
    });
  });
});
