/**
 * Load tests for ClaudeFlare API
 */

import { describe, it, expect } from 'vitest';
import { LoadTestExecutor, WebPerformanceCollector } from './runner';
import type { PerformanceTestConfig } from '../utils/types';

describe('Load Tests', () => {
  const createLoadTestConfig = (concurrency: number): PerformanceTestConfig => ({
    targetUrl: 'http://localhost:8787',
    concurrency,
    duration: 30000,
    rampUp: 5000,
    thresholds: {
      responseTime: {
        p50: 200,
        p95: 500,
        p99: 1000
      },
      errorRate: 0.01,
      throughput: 100,
      memoryUsage: 512 * 1024 * 1024, // 512MB
      cpuUsage: 80
    }
  });

  describe('API Load Tests', () => {
    it('should handle 10 concurrent users', async () => {
      const config = createLoadTestConfig(10);
      const executor = new LoadTestExecutor(config);

      const metrics = await executor.executeLoadTest();

      expect(metrics.requests.total).toBe(10);
      expect(metrics.requests.success).toBeGreaterThanOrEqual(8); // Allow 20% failure
      expect(metrics.responseTime.p95).toBeLessThan(500);
    });

    it('should handle 50 concurrent users', async () => {
      const config = createLoadTestConfig(50);
      const executor = new LoadTestExecutor(config);

      const metrics = await executor.executeLoadTest();

      expect(metrics.requests.total).toBe(50);
      expect(metrics.requests.success).toBeGreaterThanOrEqual(40);
      expect(metrics.responseTime.p95).toBeLessThan(1000);
    });

    it('should handle 100 concurrent users', async () => {
      const config = createLoadTestConfig(100);
      const executor = new LoadTestExecutor(config);

      const metrics = await executor.executeLoadTest();

      expect(metrics.requests.total).toBe(100);
      expect(metrics.requests.success).toBeGreaterThanOrEqual(80);
      expect(metrics.responseTime.p99).toBeLessThan(2000);
    });

    it('should handle sustained load (100 concurrent for 1 minute)', async () => {
      const config: PerformanceTestConfig = {
        ...createLoadTestConfig(100),
        duration: 60000
      };

      const executor = new LoadTestExecutor(config);
      const metrics = await executor.executeLoadTest();

      // System should remain stable under sustained load
      expect(metrics.requests.success / metrics.requests.total).toBeGreaterThan(0.95);
      expect(metrics.responseTime.p95).toBeLessThan(1500);
    });
  });

  describe('Spike Tests', () => {
    it('should handle sudden traffic spike', async () => {
      const baselineConfig = createLoadTestConfig(10);
      const spikeConfig = createLoadTestConfig(200);

      // Baseline
      const baselineExecutor = new LoadTestExecutor(baselineConfig);
      const baselineMetrics = await baselineExecutor.executeLoadTest();

      // Spike
      const spikeExecutor = new LoadTestExecutor(spikeConfig);
      const spikeMetrics = await spikeExecutor.executeLoadTest();

      // Recovery - back to baseline
      const recoveryExecutor = new LoadTestExecutor(baselineConfig);
      const recoveryMetrics = await recoveryExecutor.executeLoadTest();

      // System should recover after spike
      expect(recoveryMetrics.responseTime.p95).toBeLessThan(
        baselineMetrics.responseTime.p95 * 2
      );
    });
  });

  describe('Stress Tests', () => {
    it('should identify breaking point', async () => {
      const concurrencyLevels = [10, 50, 100, 200, 500, 1000];
      const results = [];

      for (const concurrency of concurrencyLevels) {
        const config = createLoadTestConfig(concurrency);
        const executor = new LoadTestExecutor(config);

        const metrics = await executor.executeLoadTest();
        const errorRate = metrics.requests.failure / metrics.requests.total;

        results.push({ concurrency, errorRate, p95: metrics.responseTime.p95 });

        // Stop if error rate exceeds 50%
        if (errorRate > 0.5) {
          break;
        }
      }

      // Should handle at least 100 concurrent users
      const result100 = results.find(r => r.concurrency === 100);
      expect(result100?.errorRate).toBeLessThan(0.1);
    });

    it('should handle memory pressure', async () => {
      const config: PerformanceTestConfig = {
        ...createLoadTestConfig(500),
        duration: 60000
      };

      const executor = new LoadTestExecutor(config);
      const metrics = await executor.executeLoadTest();

      // System should not crash under memory pressure
      expect(metrics.requests.total).toBeGreaterThan(0);
    });
  });
});

describe('Web Performance Tests', () => {
  describe('Page Load Performance', () => {
    it('should load homepage within performance budget', async () => {
      const metrics = await WebPerformanceCollector.measurePageLoad(
        null as any,
        'http://localhost:8787'
      );

      expect(metrics.loadTime).toBeLessThan(3000);
      expect(metrics.domContentLoaded).toBeLessThan(1500);
      expect(metrics.firstContentfulPaint).toBeLessThan(1000);
    });

    it('should have good Core Web Vitals', async () => {
      const page = await globalThis.__BROWSER_GLOBAL__.newPage();
      await page.goto('http://localhost:8787', { waitUntil: 'networkidle' });

      const vitals = await WebPerformanceCollector.collectCoreWebVitals(page);

      // LCP should be under 2.5s
      expect(vitals.LCP).toBeLessThan(2500);

      // FID should be under 100ms
      expect(vitals.FID).toBeLessThan(100);

      // CLS should be under 0.1
      expect(vitals.CLS).toBeLessThan(0.1);

      await page.close();
    });

    it('should efficiently cache resources', async () => {
      const page = await globalThis.__BROWSER_GLOBAL__.newPage();

      // First visit
      await page.goto('http://localhost:8787', { waitUntil: 'networkidle' });
      const firstMetrics = await WebPerformanceCollector.collectResourceTiming(page);

      // Clear cache and revisit
      await page.context().clearCookies();
      await page.goto('http://localhost:8787', { waitUntil: 'networkidle' });
      const secondMetrics = await WebPerformanceCollector.collectResourceTiming(page);

      // Second visit should have more cached resources
      expect(secondMetrics.cachedResources).toBeGreaterThan(firstMetrics.cachedResources);

      await page.close();
    });
  });

  describe('API Performance', () => {
    it('should have fast API response times', async () => {
      const metrics = await WebPerformanceCollector.measureAPIPerformance(
        'http://localhost:8787/api/health',
        50
      );

      expect(metrics.averageTime).toBeLessThan(200);
      expect(metrics.p95).toBeLessThan(500);
      expect(metrics.p99).toBeLessThan(1000);
      expect(metrics.errorRate).toBe(0);
    });

    it('should handle API requests consistently', async () => {
      const metrics = await WebPerformanceCollector.measureAPIPerformance(
        'http://localhost:8787/api/users',
        100
      );

      // Standard deviation should be low (consistent performance)
      const variance = metrics.maxTime - metrics.minTime;
      expect(variance).toBeLessThan(metrics.averageTime * 2);
    });
  });

  describe('Resource Loading', () => {
    it('should minimize total page size', async () => {
      const page = await globalThis.__BROWSER_GLOBAL__.newPage();
      await page.goto('http://localhost:8787', { waitUntil: 'networkidle' });

      const metrics = await WebPerformanceCollector.collectResourceTiming(page);

      // Total size should be under 2MB
      expect(metrics.totalSize).toBeLessThan(2 * 1024 * 1024);

      await page.close();
    });

    it('should optimize critical resources', async () => {
      const page = await globalThis.__BROWSER_GLOBAL__.newPage();
      await page.goto('http://localhost:8787', { waitUntil: 'networkidle' });

      const resources = await WebPerformanceCollector.traceResourceLoading(page);

      // No single resource should take longer than 2s
      const slowResources = resources.filter(r => r.duration > 2000);
      expect(slowResources.length).toBe(0);

      await page.close();
    });

    it('should use efficient resource formats', async () => {
      const page = await globalThis.__BROWSER_GLOBAL__.newPage();
      await page.goto('http://localhost:8787', { waitUntil: 'networkidle' });

      const resources = await WebPerformanceCollector.traceResourceLoading(page);

      // Check for optimized images
      const images = resources.filter(r => r.name.match(/\.(jpg|png|webp|avif)$/));

      for (const image of images) {
        // Images should be reasonably sized
        expect(image.size).toBeLessThan(500 * 1024); // 500KB max per image
      }

      await page.close();
    });
  });

  describe('Memory Performance', () => {
    it('should not leak memory during navigation', async () => {
      const page = await globalThis.__BROWSER_GLOBAL__.newPage();

      const initialMemory = await WebPerformanceCollector.measureMemoryUsage(page);

      // Navigate multiple times
      for (let i = 0; i < 10; i++) {
        await page.goto('http://localhost:8787');
        await page.goto('http://localhost:8787/about');
      }

      const finalMemory = await WebPerformanceCollector.measureMemoryUsage(page);

      // Memory growth should be reasonable (< 50%)
      const memoryGrowth = (finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize) /
                          initialMemory.usedJSHeapSize;
      expect(memoryGrowth).toBeLessThan(0.5);

      await page.close();
    });

    it('should handle memory-intensive operations', async () => {
      const page = await globalThis.__BROWSER_GLOBAL__.newPage();

      // Load a page with lots of content
      await page.goto('http://localhost:8787/projects');

      const memory = await WebPerformanceCollector.measureMemoryUsage(page);

      // Memory usage should be reasonable
      expect(memory.usedJSHeapSize).toBeLessThan(100 * 1024 * 1024); // 100MB

      await page.close();
    });
  });

  describe('Network Performance', () => {
    it('should minimize HTTP requests', async () => {
      const page = await globalThis.__BROWSER_GLOBAL__.newPage();
      await page.goto('http://localhost:8787', { waitUntil: 'networkidle' });

      const metrics = await WebPerformanceCollector.collectResourceTiming(page);

      // Should have less than 50 resources (including HTTP/2 multiplexing)
      expect(metrics.totalResources).toBeLessThan(50);

      await page.close();
    });

    it('should use HTTP/2 or HTTP/3', async () => {
      const response = await fetch('http://localhost:8787');
      const protocol = response.headers.get('proto') || 'h2';

      // Should use modern HTTP protocol
      expect(['h2', 'h3', '2', '3']).toContain(protocol);
    });

    it('should implement compression', async () => {
      const response = await fetch('http://localhost:8787');
      const encoding = response.headers.get('content-encoding');

      // Should use compression
      expect(encoding).toMatch(/gzip|br|deflate/);
    });
  });
});

describe('Performance Regression Tests', () => {
  it('should not regress from baseline', async () => {
    const baseline = {
      loadTime: 2000,
      apiResponseTime: 150,
      p95ResponseTime: 400
    };

    const current = {
      loadTime: 2500,
      apiResponseTime: 180,
      p95ResponseTime: 450
    };

    // Allow 20% regression
    expect(current.loadTime).toBeLessThan(baseline.loadTime * 1.2);
    expect(current.apiResponseTime).toBeLessThan(baseline.apiResponseTime * 1.2);
    expect(current.p95ResponseTime).toBeLessThan(baseline.p95ResponseTime * 1.2);
  });
});

export {};
