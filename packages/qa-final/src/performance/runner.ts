/**
 * Performance test runner for ClaudeFlare
 */

import { Page } from '@playwright/test';
import type { PerformanceTestConfig, PerformanceTestResult, PerformanceMetrics, ThresholdViolation } from '../utils/types';
import { measureTime } from '../utils/test-helpers';

/**
 * Performance test runner class
 */
export class PerformanceTestRunner {
  private config: PerformanceTestConfig;
  private results: PerformanceTestResult[] = [];

  constructor(config: PerformanceTestConfig) {
    this.config = config;
  }

  /**
   * Run a performance test
   */
  async runTest(
    name: string,
    testFn: () => Promise<void>
  ): Promise<PerformanceTestResult> {
    const startTime = Date.now();
    const { duration, result } = await measureTime(async () => {
      await testFn();
    });

    const resultData = result as {
      metrics: PerformanceMetrics;
    };

    const testResult: PerformanceTestResult = {
      name,
      timestamp: new Date(),
      duration,
      metrics: resultData.metrics,
      thresholds: this.config.thresholds,
      passed: this.checkThresholds(resultData.metrics),
      violations: this.getViolations(resultData.metrics)
    };

    this.results.push(testResult);
    return testResult;
  }

  /**
   * Check if metrics meet thresholds
   */
  private checkThresholds(metrics: PerformanceMetrics): boolean {
    const { responseTime, errorRate, throughput } = this.config.thresholds;

    return (
      metrics.responseTime.p95 <= responseTime.p95 &&
      metrics.responseTime.p99 <= responseTime.p99 &&
      metrics.requests.failure / metrics.requests.total <= errorRate &&
      metrics.throughput.requestsPerSecond >= throughput
    );
  }

  /**
   * Get threshold violations
   */
  private getViolations(metrics: PerformanceMetrics): ThresholdViolation[] {
    const violations: ThresholdViolation[] = [];
    const { responseTime, errorRate, throughput } = this.config.thresholds;

    if (metrics.responseTime.p95 > responseTime.p95) {
      violations.push({
        metric: 'responseTime.p95',
        expected: responseTime.p95,
        actual: metrics.responseTime.p95,
        severity: 'critical'
      });
    }

    if (metrics.responseTime.p99 > responseTime.p99) {
      violations.push({
        metric: 'responseTime.p99',
        expected: responseTime.p99,
        actual: metrics.responseTime.p99,
        severity: 'critical'
      });
    }

    const actualErrorRate = metrics.requests.failure / metrics.requests.total;
    if (actualErrorRate > errorRate) {
      violations.push({
        metric: 'errorRate',
        expected: errorRate,
        actual: actualErrorRate,
        severity: 'critical'
      });
    }

    if (metrics.throughput.requestsPerSecond < throughput) {
      violations.push({
        metric: 'throughput',
        expected: throughput,
        actual: metrics.throughput.requestsPerSecond,
        severity: 'warning'
      });
    }

    return violations;
  }

  /**
   * Get all test results
   */
  getResults(): PerformanceTestResult[] {
    return [...this.results];
  }

  /**
   * Get aggregate metrics
   */
  getAggregateMetrics() {
    if (this.results.length === 0) {
      return null;
    }

    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;

    return {
      totalTests: this.results.length,
      passed,
      failed,
      passRate: passed / this.results.length,
      totalDuration,
      averageDuration: totalDuration / this.results.length
    };
  }
}

/**
 * Load test executor using k6-style approach
 */
export class LoadTestExecutor {
  private config: PerformanceTestConfig;

  constructor(config: PerformanceTestConfig) {
    this.config = config;
  }

  /**
   * Execute load test
   */
  async executeLoadTest(): Promise<PerformanceMetrics> {
    const requests: Array<{ success: boolean; duration: number }> = [];
    const startTime = Date.now();

    // Execute concurrent requests
    const promises = Array.from({ length: this.config.concurrency }, async (_, i) => {
      const requestStartTime = Date.now();

      try {
        await this.makeRequest(i);
        const duration = Date.now() - requestStartTime;
        requests.push({ success: true, duration });
      } catch (error) {
        const duration = Date.now() - requestStartTime;
        requests.push({ success: false, duration });
      }
    });

    await Promise.all(promises);

    const endTime = Date.now();
    const totalDuration = (endTime - startTime) / 1000; // in seconds

    return this.calculateMetrics(requests, totalDuration);
  }

  /**
   * Make a single request
   */
  private async makeRequest(index: number): Promise<void> {
    const url = `${this.config.targetUrl}/api/test`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
  }

  /**
   * Calculate performance metrics
   */
  private calculateMetrics(
    requests: Array<{ success: boolean; duration: number }>,
    totalDuration: number
  ): PerformanceMetrics {
    const successfulRequests = requests.filter(r => r.success);
    const failedRequests = requests.filter(r => !r.success);
    const durations = successfulRequests.map(r => r.duration);

    const sortedDurations = [...durations].sort((a, b) => a - b);

    return {
      requests: {
        total: requests.length,
        success: successfulRequests.length,
        failure: failedRequests.length
      },
      responseTime: {
        min: sortedDurations[0] || 0,
        max: sortedDurations[sortedDurations.length - 1] || 0,
        mean: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
        median: sortedDurations[Math.floor(sortedDurations.length / 2)] || 0,
        p90: sortedDurations[Math.floor(sortedDurations.length * 0.9)] || 0,
        p95: sortedDurations[Math.floor(sortedDurations.length * 0.95)] || 0,
        p99: sortedDurations[Math.floor(sortedDurations.length * 0.99)] || 0
      },
      throughput: {
        requestsPerSecond: requests.length / totalDuration,
        bytesPerSecond: 0 // Would need to track bytes
      },
      concurrency: {
        min: this.config.concurrency,
        max: this.config.concurrency,
        mean: this.config.concurrency
      },
      errors: [],
      latency: []
    };
  }
}

/**
 * Web performance metrics collector
 */
export class WebPerformanceCollector {
  /**
   * Collect Core Web Vitals
   */
  static async collectCoreWebVitals(page: Page): Promise<{
    LCP: number;
    FID: number;
    CLS: number;
    FCP: number;
    TTFB: number;
  }> {
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        // @ts-ignore
        if (!window.performance) {
          resolve({ LCP: 0, FID: 0, CLS: 0, FCP: 0, TTFB: 0 });
          return;
        }

        // @ts-ignore
        const perfData = window.performance.getEntriesByType('navigation')[0];
        // @ts-ignore
        const paintEntries = window.performance.getEntriesByType('paint');

        resolve({
          LCP: 0, // Would need PerformanceObserver
          FID: 0, // Would need PerformanceObserver
          CLS: 0, // Would need PerformanceObserver
          FCP: paintEntries.find((e: any) => e.name === 'first-contentful-paint')?.startTime || 0,
          TTFB: perfData?.responseStart || 0
        });
      });
    });

    return metrics as {
      LCP: number;
      FID: number;
      CLS: number;
      FCP: number;
      TTFB: number;
    };
  }

  /**
   * Collect resource timing metrics
   */
  static async collectResourceTiming(page: Page): Promise<{
    totalResources: number;
    totalSize: number;
    cachedResources: number;
    slowResources: number;
  }> {
    const metrics = await page.evaluate(() => {
      // @ts-ignore
      const resources = window.performance.getEntriesByType('resource') as PerformanceResourceTiming[];

      let totalSize = 0;
      let cachedCount = 0;
      let slowCount = 0;

      resources.forEach((resource) => {
        totalSize += resource.transferSize || 0;

        if (resource.transferSize === 0) {
          cachedCount++;
        }

        if (resource.duration > 1000) {
          slowCount++;
        }
      });

      return {
        totalResources: resources.length,
        totalSize,
        cachedResources: cachedCount,
        slowResources: slowCount
      };
    });

    return metrics;
  }

  /**
   * Collect navigation timing metrics
   */
  static async collectNavigationTiming(page: Page): Promise<{
    domContentLoaded: number;
    loadComplete: number;
    domInteractive: number;
    firstPaint: number;
  }> {
    const metrics = await page.evaluate(() => {
      // @ts-ignore
      const timing = window.performance.timing || {};
      // @ts-ignore
      const paintEntries = window.performance.getEntriesByType('paint');

      return {
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        loadComplete: timing.loadEventEnd - timing.navigationStart,
        domInteractive: timing.domInteractive - timing.navigationStart,
        firstPaint: paintEntries.find((e: any) => e.name === 'first-paint')?.startTime || 0
      };
    });

    return metrics;
  }

  /**
   * Measure page load performance
   */
  static async measurePageLoad(page: Page, url: string): Promise<{
    loadTime: number;
    domContentLoaded: number;
    firstContentfulPaint: number;
    resourceCount: number;
  }> {
    const startTime = Date.now();

    await page.goto(url, { waitUntil: 'networkidle' });

    const loadTime = Date.now() - startTime;

    const metrics = await page.evaluate(() => {
      // @ts-ignore
      const timing = window.performance.timing || {};
      // @ts-ignore
      const resources = window.performance.getEntriesByType('resource');
      // @ts-ignore
      const paintEntries = window.performance.getEntriesByType('paint');

      return {
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        firstContentfulPaint: paintEntries.find((e: any) => e.name === 'first-contentful-paint')?.startTime || 0,
        resourceCount: resources.length
      };
    });

    return {
      loadTime,
      ...metrics
    };
  }

  /**
   * Measure API performance
   */
  static async measureAPIPerformance(
    url: string,
    iterations = 100
  ): Promise<{
    averageTime: number;
    minTime: number;
    maxTime: number;
    p95: number;
    p99: number;
    errorRate: number;
  }> {
    const times: number[] = [];
    let errors = 0;

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();

      try {
        const response = await fetch(url);
        if (!response.ok) {
          errors++;
        }
      } catch (error) {
        errors++;
      }

      times.push(Date.now() - start);
    }

    const sortedTimes = [...times].sort((a, b) => a - b);

    return {
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: sortedTimes[0],
      maxTime: sortedTimes[sortedTimes.length - 1],
      p95: sortedTimes[Math.floor(sortedTimes.length * 0.95)],
      p99: sortedTimes[Math.floor(sortedTimes.length * 0.99)],
      errorRate: errors / iterations
    };
  }

  /**
   * Measure memory usage
   */
  static async measureMemoryUsage(page: Page): Promise<{
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  }> {
    const metrics = await page.evaluate(() => {
      // @ts-ignore
      if (performance.memory) {
        // @ts-ignore
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }

      return {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0
      };
    });

    return metrics;
  }

  /**
   * Trace resource loading
   */
  static async traceResourceLoading(page: Page): Promise<Array<{
    name: string;
    duration: number;
    size: number;
    cached: boolean;
  }>> {
    const resources = await page.evaluate(() => {
      // @ts-ignore
      const entries = window.performance.getEntriesByType('resource') as PerformanceResourceTiming[];

      return entries.map((entry) => ({
        name: entry.name,
        duration: entry.duration,
        size: entry.transferSize,
        cached: entry.transferSize === 0
      }));
    });

    return resources;
  }
}

/**
 * Performance benchmark helper
 */
export class PerformanceBenchmark {
  private results = new Map<string, number[]>();

  /**
   * Record a measurement
   */
  record(name: string, value: number): void {
    if (!this.results.has(name)) {
      this.results.set(name, []);
    }
    this.results.get(name)!.push(value);
  }

  /**
   * Get statistics for a metric
   */
  getStats(name: string) {
    const values = this.results.get(name) || [];
    if (values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  /**
   * Get all results
   */
  getAllResults() {
    const results: Record<string, any> = {};

    for (const [name] of this.results) {
      results[name] = this.getStats(name);
    }

    return results;
  }

  /**
   * Clear all results
   */
  clear(): void {
    this.results.clear();
  }
}
