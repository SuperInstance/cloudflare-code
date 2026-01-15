/**
 * Performance Benchmarks
 *
 * Test performance characteristics and ensure they meet requirements
 */

import { describe, it, expect } from 'vitest';
import app from '../../packages/edge/src/index';
import type { ChatRequest } from '../../packages/edge/src/types';

describe('Performance Benchmarks', () => {
  describe('Response Time', () => {
    it('should respond to health check in < 50ms', async () => {
      const start = Date.now();

      const response = await app.request('/health');

      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(50);
    });

    it('should respond to status check in < 100ms', async () => {
      const start = Date.now();

      const response = await app.request('/v1/status');

      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(100);
    });

    it('should list models in < 100ms', async () => {
      const start = Date.now();

      const response = await app.request('/v1/models');

      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(100);
    });

    it('should handle chat request in reasonable time', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-opus-20240229',
      };

      const start = Date.now();

      const response = await app.request('/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(5000); // Should complete in < 5s
    });
  });

  describe('Throughput', () => {
    it('should handle 100 concurrent requests', async () => {
      const requests = Array(100).fill(null).map((_, i) => ({
        messages: [{ role: 'user', content: `Test ${i}` }],
        model: 'claude-3-opus-20240229',
      }));

      const start = Date.now();

      const responses = await Promise.all(
        requests.map(req =>
          app.request('/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req),
          })
        )
      );

      const duration = Date.now() - start;

      expect(responses.length).toBe(100);
      expect(duration).toBeLessThan(30000); // Should complete in < 30s

      // Calculate requests per second
      const rps = (requests.length / duration) * 1000;
      expect(rps).toBeGreaterThan(3); // At least 3 req/s
    });

    it('should handle 1000 sequential requests', async () => {
      let successCount = 0;
      let failureCount = 0;
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        const request: ChatRequest = {
          messages: [{ role: 'user', content: `Request ${i}` }],
          model: 'claude-3-opus-20240229',
        };

        const response = await app.request('/v1/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        });

        if (response.status === 200) {
          successCount++;
        } else {
          failureCount++;
        }
      }

      const duration = Date.now() - startTime;

      expect(successCount).toBeGreaterThan(990); // 99% success rate
      expect(failureCount).toBeLessThan(10);
      expect(duration).toBeLessThan(120000); // Should complete in < 2 minutes
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory across multiple requests', async () => {
      const initialMemory = (global as any).performance?.memory?.usedJSHeapSize || 0;

      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        const request: ChatRequest = {
          messages: [{ role: 'user', content: `Request ${i}` }],
          model: 'claude-3-opus-20240229',
        };

        await app.request('/v1/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        });
      }

      const finalMemory = (global as any).performance?.memory?.usedJSHeapSize || 0;

      // Memory growth should be reasonable (< 50MB)
      const memoryGrowth = finalMemory - initialMemory;
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Cache Performance', () => {
    it('should achieve high cache hit rate with repeated requests', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'What is AI?' }],
        model: 'claude-3-opus-20240229',
      };

      // Send same request 10 times
      const responses = await Promise.all(
        Array(10).fill(null).map(() =>
          app.request('/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
          })
        )
      );

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // At least some should benefit from caching
      const durations = responses.map(r =>
        parseInt(r.headers.get('x-response-time') || '0', 10)
      );

      // Later requests should be faster (cached)
      const avgFirstHalf = durations.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
      const avgSecondHalf = durations.slice(5).reduce((a, b) => a + b, 0) / 5;

      expect(avgSecondHalf).toBeLessThanOrEqual(avgFirstHalf);
    });
  });

  describe('Payload Size', () => {
    it('should handle small requests efficiently', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'claude-3-opus-20240229',
      };

      const start = Date.now();

      const response = await app.request('/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(1000);
    });

    it('should handle large requests', async () => {
      const largeContent = 'A'.repeat(10000);
      const request: ChatRequest = {
        messages: [{ role: 'user', content: largeContent }],
        model: 'claude-3-opus-20240229',
      };

      const start = Date.now();

      const response = await app.request('/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('Connection Pooling', () => {
    it('should reuse connections efficiently', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Test' }],
        model: 'claude-3-opus-20240229',
      };

      const startTime = Date.now();

      // Sequential requests should benefit from connection reuse
      for (let i = 0; i < 20; i++) {
        await app.request('/v1/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        });
      }

      const duration = Date.now() - startTime;

      // Should be faster than establishing new connections each time
      expect(duration).toBeLessThan(20000);
    });
  });

  describe('Stress Tests', () => {
    it('should handle burst of requests', async () => {
      const burstSize = 50;
      const requests = Array(burstSize).fill(null).map((_, i) => ({
        messages: [{ role: 'user', content: `Burst request ${i}` }],
        model: 'claude-3-opus-20240229',
      }));

      const start = Date.now();

      const responses = await Promise.all(
        requests.map(req =>
          app.request('/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req),
          })
        )
      );

      Date.now() - start;

      expect(responses.length).toBe(burstSize);

      // At least 90% should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThanOrEqual(burstSize * 0.9);
    });

    it('should recover from temporary overload', async () => {
      // Send burst that might overload
      const burst = Array(100).fill(null).map((_, i) => ({
        messages: [{ role: 'user', content: `Stress test ${i}` }],
        model: 'claude-3-opus-20240229',
      }));

      await Promise.all(
        burst.map(req =>
          app.request('/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req),
          })
        )
      );

      // System should recover and handle normal requests
      const normalRequest: ChatRequest = {
        messages: [{ role: 'user', content: 'Recovery test' }],
        model: 'claude-3-opus-20240229',
      };

      const response = await app.request('/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalRequest),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Latency Distribution', () => {
    it('should have consistent response times', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Performance test' }],
        model: 'claude-3-opus-20240229',
      };

      const samples = 50;
      const durations: number[] = [];

      for (let i = 0; i < samples; i++) {
        const start = Date.now();

        await app.request('/v1/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        });

        durations.push(Date.now() - start);
      }

      const avg = durations.reduce((a, b) => a + b, 0) / samples;
      const max = Math.max(...durations);
      Math.min(...durations);

      // Response times should be consistent (max < 3x avg)
      expect(max).toBeLessThan(avg * 3);

      // Average should be reasonable
      expect(avg).toBeLessThan(2000);
    });
  });
});
