/**
 * Development Portal Tests
 * Tests for dev portal authentication, routing, and Chat-to-Deploy interface
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { devRoutes } from '../../src/routes/dev-routes';

describe('Development Portal', () => {
  let app: Hono;
  const mockEnv = {
    CACHE_KV: {
      get: vi.fn(async (key: string, options?: { type?: string }) => {
        if (key === 'dev_users') {
          return JSON.stringify({ admin: 'admin123' });
        }
        return null;
      }),
      put: vi.fn(),
      delete: vi.fn()
    }
  };

  beforeEach(() => {
    app = new Hono();
    app.route('/dev', devRoutes);
  });

  describe('Authentication', () => {
    it('should require authentication for /dev routes', async () => {
      const req = new Request('http://localhost/dev');
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(401);
    });

    it('should accept valid credentials', async () => {
      const credentials = btoa('admin:admin123');
      const req = new Request('http://localhost/dev', {
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      });
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(200);
    });

    it('should reject invalid credentials', async () => {
      const credentials = btoa('admin:wrongpassword');
      const req = new Request('http://localhost/dev', {
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      });
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(401);
    });

    it('should reject malformed auth header', async () => {
      const req = new Request('http://localhost/dev', {
        headers: {
          'Authorization': 'Bearer invalid'
        }
      });
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(401);
    });

    it('should return proper WWW-Authenticate header', async () => {
      const req = new Request('http://localhost/dev');
      const res = await app.request(req, mockEnv);

      expect(res.headers.get('WWW-Authenticate')).toContain('Basic');
    });
  });

  describe('Dev Portal Home', () => {
    it('should render portal home page with correct content-type', async () => {
      const credentials = btoa('admin:admin123');
      const req = new Request('http://localhost/dev', {
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      });
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
    });

    it('should include tool cards in home page', async () => {
      const credentials = btoa('admin:admin123');
      const req = new Request('http://localhost/dev', {
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      });
      const res = await app.request(req, mockEnv);
      const html = await res.text();

      expect(html).toContain('AI Building Agent');
      expect(html).toContain('Code Review');
    });
  });

  describe('AI Building Agent Interface', () => {
    it('should render agent interface', async () => {
      const credentials = btoa('admin:admin123');
      const req = new Request('http://localhost/dev/agent', {
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      });
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(200);
    });

    it('should require authentication for agent page', async () => {
      const req = new Request('http://localhost/dev/agent');
      const res = await app.request(req, mockEnv);

      expect(res.status).toBe(401);
    });
  });

  describe('Authentication Flow', () => {
    it('should set user context after successful auth', async () => {
      const credentials = btoa('admin:admin123');
      const req = new Request('http://localhost/dev/agent', {
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      });
      const res = await app.request(req, mockEnv);
      const html = await res.text();

      expect(html).toContain('admin');
    });

    it('should handle special character in password', async () => {
      const credentials = btoa('admin:admin123!');
      const req = new Request('http://localhost/dev', {
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      });
      const res = await app.request(req, mockEnv);

      // Should not crash, returns 401 or 200
      expect([401, 200]).toContain(res.status);
    });
  });
});
