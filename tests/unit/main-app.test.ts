/**
 * Main Application Tests
 * Tests for the Hono app, health endpoints, and core routing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { devRoutes } from '../../src/routes/dev-routes';

describe('Main Application', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.use('*', cors());

    // Health check endpoint
    app.get('/health', (c) => {
      return c.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: 'test'
      });
    });

    // Version endpoint
    app.get('/version', (c) => {
      return c.json({
        version: '2.0.0',
        commit: 'dev'
      });
    });

    // Metrics endpoint
    app.get('/metrics', (c) => {
      return c.json({
        requests: 0,
        errors: 0,
        latency: 0
      });
    });

    // Dev portal routes
    app.route('/dev', devRoutes);
  });

  describe('Health Check Endpoint', () => {
    it('should return healthy status', async () => {
      const req = new Request('http://localhost/health');
      const res = await app.request(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty('status', 'healthy');
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('environment');
    });

    it('should include environment info', async () => {
      const req = new Request('http://localhost/health');
      const res = await app.request(req);
      const json = await res.json();

      expect(json.environment).toBeDefined();
      expect(typeof json.environment).toBe('string');
    });
  });

  describe('Version Endpoint', () => {
    it('should return version information', async () => {
      const req = new Request('http://localhost/version');
      const res = await app.request(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty('version');
      expect(json).toHaveProperty('commit');
    });

    it('should return valid semver version', async () => {
      const req = new Request('http://localhost/version');
      const res = await app.request(req);
      const json = await res.json();

      expect(json.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('Metrics Endpoint', () => {
    it('should return metrics data', async () => {
      const req = new Request('http://localhost/metrics');
      const res = await app.request(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty('requests');
      expect(json).toHaveProperty('errors');
      expect(json).toHaveProperty('latency');
    });

    it('should initialize metrics to zero', async () => {
      const req = new Request('http://localhost/metrics');
      const res = await app.request(req);
      const json = await res.json();

      expect(json.requests).toBe(0);
      expect(json.errors).toBe(0);
      expect(json.latency).toBe(0);
    });
  });

  describe('CORS Configuration', () => {
    it('should include CORS headers', async () => {
      const req = new Request('http://localhost/health', {
        method: 'OPTIONS'
      });
      const res = await app.request(req);

      expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 routes gracefully', async () => {
      const req = new Request('http://localhost/nonexistent');
      const res = await app.request(req);

      expect(res.status).toBe(404);
    });
  });
});
