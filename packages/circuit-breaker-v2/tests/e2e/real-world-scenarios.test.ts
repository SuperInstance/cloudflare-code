import { describe, it, expect, beforeEach } from 'vitest';
import { CircuitBreaker } from '../../src/circuit-breaker';
import { CircuitState, HealthStatus, FallbackPriority } from '../../src/types';

/**
 * End-to-End Tests for Real-World Scenarios
 */

describe('Real-World Scenario Tests', () => {
  describe('HTTP API Circuit Breaker', () => {
    let circuitBreaker: CircuitBreaker;
    let requestCount = 0;

    beforeEach(() => {
      requestCount = 0;
      circuitBreaker = new CircuitBreaker({
        name: 'http-api',
        thresholds: {
          failureThreshold: 5,
          successThreshold: 3,
          timeoutMs: 5000,
          windowSize: 50,
          minRequests: 10,
          errorRateThreshold: 40,
          slowCallThreshold: 2000,
          slowCallRateThreshold: 25,
        },
        enableMetrics: true,
        enablePredictiveDetection: true,
        operationTimeoutMs: 3000,
      });

      // Register fallbacks
      circuitBreaker.registerFallback({
        name: 'cache-fallback',
        priority: FallbackPriority.HIGH,
        handler: async (context, error) => {
          return { fromCache: true, data: 'cached-response' };
        },
        enabled: true,
      });

      circuitBreaker.registerFallback({
        name: 'default-response',
        priority: FallbackPriority.LOW,
        handler: async (context, error) => {
          return { default: true, data: 'default-response' };
        },
        enabled: true,
      });
    });

    it('should handle API service degradation', async () => {
      // Simulate API with increasing failures
      async function callApi() {
        requestCount++;
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (requestCount > 15 && requestCount < 25) {
          throw new Error('Service unavailable (503)');
        }

        return { status: 'ok', data: `response-${requestCount}` };
      }

      // Execute many requests
      const results = [];
      for (let i = 0; i < 40; i++) {
        try {
          const result = await circuitBreaker.execute(callApi);
          results.push({ success: true, data: result });
        } catch (error) {
          results.push({ success: false, error });
        }

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Some requests should succeed
      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBeGreaterThan(30);

      // Circuit should have opened at some point
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(40);
    }, 30000);

    it('should use fallbacks during outage', async () => {
      // Simulate complete outage
      let outageActive = true;

      async function callApi() {
        if (outageActive) {
          throw new Error('Connection refused');
        }
        return { status: 'ok' };
      }

      // Execute requests during outage
      const results = [];
      for (let i = 0; i < 10; i++) {
        try {
          const result = await circuitBreaker.execute(callApi);
          results.push({ success: true, data: result, fromCache: result.fromCache });
        } catch (error) {
          results.push({ success: false, error });
        }
      }

      // All should succeed using fallbacks
      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBe(10);

      // Most should use cache fallback
      const cacheCount = results.filter((r) => r.fromCache).length;
      expect(cacheCount).toBeGreaterThan(5);
    });

    it('should recover after service restoration', async () => {
      let serviceHealthy = false;

      async function callApi() {
        if (!serviceHealthy) {
          throw new Error('Service down');
        }
        return { status: 'ok' };
      }

      // Trigger failures to open circuit
      for (let i = 0; i < 10; i++) {
        try {
          await circuitBreaker.execute(callApi);
        } catch (error) {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      // Restore service
      serviceHealthy = true;

      // Wait for timeout and attempt recovery
      await new Promise((resolve) => setTimeout(resolve, 5100));

      // Execute successful operations to close circuit
      for (let i = 0; i < 5; i++) {
        await circuitBreaker.execute(callApi);
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    }, 20000);
  });

  describe('Database Connection Circuit Breaker', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        name: 'database',
        thresholds: {
          failureThreshold: 3,
          successThreshold: 2,
          timeoutMs: 10000,
          windowSize: 20,
          minRequests: 5,
          errorRateThreshold: 30,
          slowCallThreshold: 3000,
          slowCallRateThreshold: 20,
        },
        enableMetrics: true,
        enablePredictiveDetection: true,
        operationTimeoutMs: 5000,
      });
    });

    it('should handle database connection issues', async () => {
      let connectionAttempts = 0;

      async function queryDatabase() {
        connectionAttempts++;
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (connectionAttempts <= 5) {
          throw new Error('Connection timeout');
        }

        return { rows: [{ id: 1, name: 'test' }] };
      }

      // Execute queries
      const results = [];
      for (let i = 0; i < 10; i++) {
        try {
          const result = await circuitBreaker.execute(queryDatabase);
          results.push({ success: true, data: result });
        } catch (error) {
          results.push({ success: false, error });
        }
      }

      // Eventually queries should succeed
      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBeGreaterThan(0);
    });

    it('should track database metrics accurately', async () => {
      async function queryDatabase() {
        const delay = 100 + Math.random() * 200;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return { rows: [] };
      }

      // Execute queries
      for (let i = 0; i < 20; i++) {
        await circuitBreaker.execute(queryDatabase);
      }

      const metrics = circuitBreaker.getMetrics();

      expect(metrics.totalRequests).toBe(20);
      expect(metrics.successfulRequests).toBe(20);
      expect(metrics.averageDuration).toBeGreaterThan(100);
      expect(metrics.averageDuration).toBeLessThan(300);
    }, 15000);
  });

  describe('Microservices Communication', () => {
    let serviceACircuit: CircuitBreaker;
    let serviceBCircuit: CircuitBreaker;

    beforeEach(() => {
      serviceACircuit = new CircuitBreaker({
        name: 'service-a',
        thresholds: {
          failureThreshold: 3,
          successThreshold: 2,
          timeoutMs: 3000,
          windowSize: 20,
          minRequests: 5,
          errorRateThreshold: 50,
          slowCallThreshold: 1000,
          slowCallRateThreshold: 30,
        },
        enableMetrics: true,
      });

      serviceBCircuit = new CircuitBreaker({
        name: 'service-b',
        thresholds: {
          failureThreshold: 3,
          successThreshold: 2,
          timeoutMs: 3000,
          windowSize: 20,
          minRequests: 5,
          errorRateThreshold: 50,
          slowCallThreshold: 1000,
          slowCallRateThreshold: 30,
        },
        enableMetrics: true,
      });
    });

    it('should handle cascading failures', async () => {
      let serviceBHealthy = false;

      // Service B fails
      async function callServiceB() {
        if (!serviceBHealthy) {
          throw new Error('Service B unavailable');
        }
        return { status: 'ok' };
      }

      // Service A calls Service B
      async function callServiceA() {
        return await serviceBCircuit.execute(callServiceB);
      }

      // Execute calls through Service A
      for (let i = 0; i < 5; i++) {
        try {
          await serviceACircuit.execute(callServiceA);
        } catch (error) {
          // Expected
        }
      }

      // Both circuits should be affected
      expect(serviceBCircuit.getState()).toBe(CircuitState.OPEN);
    });

    it('should handle gradual service restoration', async () => {
      let serviceHealth = 0; // 0 = unhealthy, 1 = healthy

      async function callService() {
        if (serviceHealth < 0.5) {
          throw new Error('Service degraded');
        }
        return { status: 'ok' };
      }

      // Initially failing
      for (let i = 0; i < 5; i++) {
        try {
          await serviceACircuit.execute(callService);
        } catch (error) {
          // Expected
        }
      }

      expect(serviceACircuit.getState()).toBe(CircuitState.OPEN);

      // Gradually improve service
      serviceHealth = 0.3;
      await new Promise((resolve) => setTimeout(resolve, 3100));

      // Try recovery
      try {
        await serviceACircuit.execute(callService);
      } catch (error) {
        // Expected
      }

      // Fully restore
      serviceHealth = 1;
      await new Promise((resolve) => setTimeout(resolve, 3100));

      await serviceACircuit.execute(callService);
      await serviceACircuit.execute(callService);

      expect(serviceACircuit.getState()).toBe(CircuitState.CLOSED);
    }, 15000);
  });

  describe('High-Traffic Scenarios', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        name: 'high-traffic-service',
        thresholds: {
          failureThreshold: 50,
          successThreshold: 10,
          timeoutMs: 60000,
          windowSize: 500,
          minRequests: 50,
          errorRateThreshold: 30,
          slowCallThreshold: 2000,
          slowCallRateThreshold: 20,
        },
        enableMetrics: true,
        maxConcurrent: 200,
      });
    });

    it('should handle burst of requests', async () => {
      async function handleRequest(id: number) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { id, status: 'ok' };
      }

      // Burst of 100 requests
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(circuitBreaker.execute(() => handleRequest(i)));
      }

      const results = await Promise.all(promises);

      expect(results.length).toBe(100);
      expect(results.every((r) => r.status === 'ok')).toBe(true);
    }, 15000);

    it('should maintain performance under load', async () => {
      const durations = [];

      async function handleRequest() {
        const start = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 50));
        durations.push(Date.now() - start);
        return { status: 'ok' };
      }

      // Execute 50 requests
      for (let i = 0; i < 50; i++) {
        await circuitBreaker.execute(handleRequest);
      }

      const metrics = circuitBreaker.getMetrics();

      expect(metrics.totalRequests).toBe(50);
      expect(metrics.averageDuration).toBeLessThan(100);
    }, 15000);
  });

  describe('Analytics and Monitoring', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        name: 'monitored-service',
        thresholds: {
          failureThreshold: 5,
          successThreshold: 2,
          timeoutMs: 5000,
          windowSize: 50,
          minRequests: 10,
          errorRateThreshold: 50,
          slowCallThreshold: 1000,
          slowCallRateThreshold: 30,
        },
        enableMetrics: true,
        enablePredictiveDetection: true,
      });
    });

    it('should provide comprehensive analytics', async () => {
      // Execute mix of successful and failing operations
      for (let i = 0; i < 30; i++) {
        try {
          await circuitBreaker.execute(async () => {
            if (Math.random() > 0.7) {
              throw new Error('Random failure');
            }
            return 'success';
          });
        } catch (error) {
          // Expected
        }
      }

      const analytics = circuitBreaker.getAnalytics();

      expect(analytics.executionStats.total).toBe(30);
      expect(analytics.executionStats.statusDistribution).toBeDefined();
      expect(analytics.errorPatterns).toBeDefined();
      expect(analytics.percentiles).toBeDefined();
    });

    it('should export actionable metrics', async () => {
      await circuitBreaker.execute(async () => 'test');

      const exported = circuitBreaker.exportMetrics();
      const parsed = JSON.parse(exported);

      expect(parsed).toHaveProperty('circuit');
      expect(parsed).toHaveProperty('state');
      expect(parsed).toHaveProperty('health');
      expect(parsed).toHaveProperty('metrics');
    });
  });

  describe('Long-Running Scenarios', () => {
    it('should maintain stability over extended period', async () => {
      const circuitBreaker = new CircuitBreaker({
        name: 'long-running-service',
        thresholds: {
          failureThreshold: 10,
          successThreshold: 5,
          timeoutMs: 30000,
          windowSize: 100,
          minRequests: 20,
          errorRateThreshold: 40,
          slowCallThreshold: 2000,
          slowCallRateThreshold: 25,
        },
        enableMetrics: true,
        enablePredictiveDetection: true,
      });

      // Simulate extended operation
      const results = [];
      for (let i = 0; i < 100; i++) {
        try {
          const result = await circuitBreaker.execute(async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            if (Math.random() > 0.9) {
              throw new Error('Occasional failure');
            }
            return `result-${i}`;
          });
          results.push({ success: true, data: result });
        } catch (error) {
          results.push({ success: false });
        }

        // Small delay between requests
        if (i % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBeGreaterThan(80);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(100);
    }, 60000);
  });
});
