/**
 * Smoke Tests - Health Endpoint Checks
 * Tests core system health for v1.0 release
 */

import { describe, it, expect, beforeAll } from 'vitest';

const BASE_URL = process.env.TEST_URL || 'https://claudeflare.workers.dev';

interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
  uptime: number;
  services: {
    database: string;
    cache: string;
    storage: string;
    websocket: string;
  };
}

describe('Smoke Tests - Health Checks', () => {
  let response: HealthResponse;

  beforeAll(async () => {
    const res = await fetch(`${BASE_URL}/health`);
    response = await res.json();
  });

  it('should return healthy status', () => {
    expect(response.status).toBe('healthy');
  });

  it('should have valid version number', () => {
    expect(response.version).toMatch(/^1\.0\.\d+$/);
  });

  it('should have positive uptime', () => {
    expect(response.uptime).toBeGreaterThan(0);
  });

  it('should have all services operational', () => {
    expect(response.services.database).toBe('operational');
    expect(response.services.cache).toBe('operational');
    expect(response.services.storage).toBe('operational');
    expect(response.services.websocket).toBe('operational');
  });
});

describe('Smoke Tests - Version Endpoint', () => {
  it('should return version information', async () => {
    const res = await fetch(`${BASE_URL}/version`);
    const data = await res.json();

    expect(data.version).toMatch(/^1\.0\.\d+$/);
    expect(data.commit).toBeDefined();
    expect(data.buildTime).toBeDefined();
    expect(data.environment).toBeDefined();
  });
});

describe('Smoke Tests - Metrics Endpoint', () => {
  it('should return system metrics', async () => {
    const res = await fetch(`${BASE_URL}/metrics`);
    const data = await res.json();

    expect(data.requests).toBeDefined();
    expect(data.errors).toBeDefined();
    expect(data.latency).toBeDefined();
    expect(data.cacheHitRate).toBeDefined();
  });

  it('should have acceptable latency', async () => {
    const start = Date.now();
    await fetch(`${BASE_URL}/metrics`);
    const latency = Date.now() - start;

    expect(latency).toBeLessThan(1000); // 1 second threshold
  });
});

describe('Smoke Tests - Database Connectivity', () => {
  it('should connect to D1 database', async () => {
    const res = await fetch(`${BASE_URL}/api/health/database`);
    const data = await res.json();

    expect(data.status).toBe('connected');
    expect(data.latency).toBeLessThan(100);
  });

  it('should be able to execute queries', async () => {
    const res = await fetch(`${BASE_URL}/api/health/database/query`, {
      method: 'POST',
      body: JSON.stringify({ query: 'SELECT 1' }),
    });
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.results).toBeDefined();
  });
});

describe('Smoke Tests - Cache Connectivity', () => {
  it('should connect to KV cache', async () => {
    const res = await fetch(`${BASE_URL}/api/health/cache`);
    const data = await res.json();

    expect(data.status).toBe('connected');
    expect(data.latency).toBeLessThan(50);
  });

  it('should be able to read/write cache', async () => {
    const key = `smoke-test-${Date.now()}`;
    const value = 'test-value';

    // Write
    await fetch(`${BASE_URL}/api/health/cache/write`, {
      method: 'POST',
      body: JSON.stringify({ key, value }),
    });

    // Read
    const res = await fetch(`${BASE_URL}/api/health/cache/read?key=${key}`);
    const data = await res.json();

    expect(data.value).toBe(value);
  });
});

describe('Smoke Tests - Storage Connectivity', () => {
  it('should connect to R2 storage', async () => {
    const res = await fetch(`${BASE_URL}/api/health/storage`);
    const data = await res.json();

    expect(data.status).toBe('connected');
    expect(data.buckets).toBeDefined();
  });

  it('should be able to upload/download files', async () => {
    const fileName = `smoke-test-${Date.now()}.txt`;
    const content = 'test-content';

    // Upload
    await fetch(`${BASE_URL}/api/health/storage/upload`, {
      method: 'POST',
      body: JSON.stringify({ fileName, content }),
    });

    // Download
    const res = await fetch(`${BASE_URL}/api/health/storage/download?fileName=${fileName}`);
    const data = await res.json();

    expect(data.content).toBe(content);

    // Cleanup
    await fetch(`${BASE_URL}/api/health/storage/delete?fileName=${fileName}`, {
      method: 'DELETE',
    });
  });
});

describe('Smoke Tests - WebSocket Connectivity', () => {
  it('should accept WebSocket connections', async () => {
    const wsUrl = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/ws`);

    await new Promise((resolve, reject) => {
      ws.onopen = () => {
        ws.close();
        resolve(true);
      };
      ws.onerror = reject;

      setTimeout(reject, 5000);
    });

    expect(true).toBe(true);
  });
});

describe('Smoke Tests - API Functionality', () => {
  it('should handle agent creation', async () => {
    const res = await fetch(`${BASE_URL}/api/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'smoke-test-agent',
        type: 'coding',
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
  });

  it('should handle session creation', async () => {
    const res = await fetch(`${BASE_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'test-agent',
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.sessionId).toBeDefined();
  });

  it('should handle code execution requests', async () => {
    const res = await fetch(`${BASE_URL}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'console.log("test");',
        language: 'javascript',
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.output).toBeDefined();
  });
});

describe('Smoke Tests - Authentication Flow', () => {
  it('should handle login requests', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'test-password',
      }),
    });

    expect([200, 401]).toContain(res.status);
  });

  it('should reject invalid tokens', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/verify`, {
      headers: {
        'Authorization': 'Bearer invalid-token',
      },
    });

    expect(res.status).toBe(401);
  });

  it('should handle token refresh', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: 'test-refresh-token',
      }),
    });

    expect([200, 401]).toContain(res.status);
  });
});
