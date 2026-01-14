/**
 * Performance Benchmarking Tools
 *
 * Comprehensive performance testing utilities for load testing, stress testing,
 * and benchmarking of Cloudflare Workers and Durable Objects
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * Benchmark result
 */
export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  medianTime: number;
  p90: number;
  p95: number;
  p99: number;
  throughput: number;
  memoryUsage?: {
    used: number;
    total: number;
  };
}

/**
 * Benchmark configuration
 */
export interface BenchmarkConfig {
  name: string;
  fn: () => Promise<void> | void;
  iterations?: number;
  warmupIterations?: number;
  timeout?: number;
  collectMemory?: boolean;
}

/**
 * Benchmark suite
 */
export class BenchmarkSuite {
  private results: BenchmarkResult[] = [];
  private beforeEach?: () => Promise<void>;
  private afterEach?: () => Promise<void>;

  constructor() {}

  /**
   * Set before hook
   */
  before(fn: () => Promise<void>): void {
    this.beforeEach = fn;
  }

  /**
   * Set after hook
   */
  after(fn: () => Promise<void>): void {
    this.afterEach = fn;
  }

  /**
   * Run benchmark
   */
  async run(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const {
      name,
      fn,
      iterations = 100,
      warmupIterations = 10,
      timeout = 30000,
      collectMemory = false,
    } = config;

    // Warmup
    for (let i = 0; i < warmupIterations; i++) {
      await fn();
    }

    // Collect memory before
    const memoryBefore = collectMemory ? process.memoryUsage() : null;

    // Run benchmark
    const times: number[] = [];
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      if (this.beforeEach) {
        await this.beforeEach();
      }

      const iterStart = performance.now();

      try {
        await fn();
        times.push(performance.now() - iterStart);
      } catch (error) {
        throw new Error(`Benchmark "${name}" failed on iteration ${i + 1}: ${error}`);
      }

      if (this.afterEach) {
        await this.afterEach();
      }

      // Check timeout
      if (Date.now() - startTime > timeout) {
        throw new Error(`Benchmark "${name}" exceeded timeout of ${timeout}ms`);
      }
    }

    // Collect memory after
    const memoryAfter = collectMemory ? process.memoryUsage() : null;

    // Calculate statistics
    const sorted = [...times].sort((a, b) => a - b);
    const totalTime = Date.now() - startTime;

    const result: BenchmarkResult = {
      name,
      iterations,
      totalTime,
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: sorted[0],
      maxTime: sorted[sorted.length - 1],
      medianTime: sorted[Math.floor(sorted.length / 2)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      throughput: (iterations / totalTime) * 1000,
    };

    if (collectMemory && memoryBefore && memoryAfter) {
      result.memoryUsage = {
        used: memoryAfter.heapUsed - memoryBefore.heapUsed,
        total: memoryAfter.heapTotal,
      };
    }

    this.results.push(result);
    return result;
  }

  /**
   * Get all results
   */
  getResults(): BenchmarkResult[] {
    return [...this.results];
  }

  /**
   * Get result by name
   */
  getResult(name: string): BenchmarkResult | undefined {
    return this.results.find((r) => r.name === name);
  }

  /**
   * Compare results
   */
  compare(name1: string, name2: string): {
    faster: string;
    speedup: number;
  } | null {
    const result1 = this.getResult(name1);
    const result2 = this.getResult(name2);

    if (!result1 || !result2) return null;

    if (result1.avgTime < result2.avgTime) {
      return {
        faster: name1,
        speedup: result2.avgTime / result1.avgTime,
      };
    } else {
      return {
        faster: name2,
        speedup: result1.avgTime / result2.avgTime,
      };
    }
  }

  /**
   * Clear results
   */
  clear(): void {
    this.results = [];
  }

  /**
   * Print results table
   */
  printResults(): void {
    console.log('\nBenchmark Results:');
    console.log('─'.repeat(100));
    console.log(
      'Name'.padEnd(30),
      'Iterations'.padEnd(12),
      'Avg (ms)'.padEnd(12),
      'Min (ms)'.padEnd(12),
      'Max (ms)'.padEnd(12),
      'P95 (ms)'.padEnd(12),
      'Throughput'
    );
    console.log('─'.repeat(100));

    for (const result of this.results) {
      console.log(
        result.name.padEnd(30),
        result.iterations.toString().padEnd(12),
        result.avgTime.toFixed(2).padEnd(12),
        result.minTime.toFixed(2).padEnd(12),
        result.maxTime.toFixed(2).padEnd(12),
        result.p95.toFixed(2).padEnd(12),
        result.throughput.toFixed(0) + ' ops/s'
      );
    }

    console.log('─'.repeat(100));
  }
}

/**
 * Load test configuration
 */
export interface LoadTestConfig {
  name: string;
  fn: () => Promise<void>;
  requestsPerSecond?: number;
  duration?: number;
  concurrency?: number;
  rampUp?: number;
}

/**
 * Load test result
 */
export interface LoadTestResult {
  name: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  duration: number;
  requestsPerSecond: number;
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  errorRate: number;
  errors: Array<{
    error: string;
    count: number;
  }>;
}

/**
 * Load tester
 */
export class LoadTester {
  private results: LoadTestResult[] = [];

  /**
   * Run load test
   */
  async run(config: LoadTestConfig): Promise<LoadTestResult> {
    const {
      name,
      fn,
      requestsPerSecond = 100,
      duration = 10000,
      concurrency = 10,
      rampUp = 0,
    } = config;

    const latencies: number[] = [];
    const errors: Map<string, number> = new Map();
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;

    const startTime = Date.now();
    const endTime = startTime + duration;
    const interval = 1000 / requestsPerSecond;

    let currentConcurrency = 0;
    const targetConcurrency = concurrency;

    while (Date.now() < endTime) {
      // Ramp up concurrency
      if (rampUp > 0) {
        const elapsed = Date.now() - startTime;
        currentConcurrency = Math.min(
          targetConcurrency,
          Math.floor((elapsed / rampUp) * targetConcurrency)
        );
      } else {
        currentConcurrency = targetConcurrency;
      }

      // Execute concurrent requests
      const promises: Promise<void>[] = [];

      for (let i = 0; i < currentConcurrency; i++) {
        const promise = (async () => {
          const start = performance.now();

          try {
            await fn();
            const latency = performance.now() - start;
            latencies.push(latency);
            successfulRequests++;
            totalRequests++;
          } catch (error) {
            const errorMessage = (error as Error).message;
            errors.set(errorMessage, (errors.get(errorMessage) || 0) + 1);
            failedRequests++;
            totalRequests++;
          }
        })();

        promises.push(promise);
      }

      await Promise.all(promises);

      // Maintain request rate
      const batchDuration = performance.now() % (interval * currentConcurrency);
      if (batchDuration < interval * currentConcurrency) {
        await new Promise((resolve) =>
          setTimeout(resolve, interval * currentConcurrency - batchDuration)
        );
      }
    }

    // Calculate statistics
    const sorted = [...latencies].sort((a, b) => a - b);

    const result: LoadTestResult = {
      name,
      totalRequests,
      successfulRequests,
      failedRequests,
      duration: Date.now() - startTime,
      requestsPerSecond: (totalRequests / duration) * 1000,
      averageLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      minLatency: sorted[0] || 0,
      maxLatency: sorted[sorted.length - 1] || 0,
      p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
      p90: sorted[Math.floor(sorted.length * 0.9)] || 0,
      p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
      p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
      errorRate: (failedRequests / totalRequests) * 100,
      errors: Array.from(errors.entries()).map(([error, count]) => ({
        error,
        count,
      })),
    };

    this.results.push(result);
    return result;
  }

  /**
   * Get all results
   */
  getResults(): LoadTestResult[] {
    return [...this.results];
  }

  /**
   * Clear results
   */
  clear(): void {
    this.results = [];
  }

  /**
   * Print results table
   */
  printResults(): void {
    console.log('\nLoad Test Results:');
    console.log('─'.repeat(120));
    console.log(
      'Name'.padEnd(30),
      'Requests'.padEnd(12),
      'Success'.padEnd(12),
      'Failed'.padEnd(10),
      'RPS'.padEnd(10),
      'Avg (ms)'.padEnd(10),
      'P95 (ms)'.padEnd(10),
      'Error %'
    );
    console.log('─'.repeat(120));

    for (const result of this.results) {
      console.log(
        result.name.padEnd(30),
        result.totalRequests.toString().padEnd(12),
        result.successfulRequests.toString().padEnd(12),
        result.failedRequests.toString().padEnd(10),
        result.requestsPerSecond.toFixed(0).padEnd(10),
        result.averageLatency.toFixed(2).padEnd(10),
        result.p95.toFixed(2).padEnd(10),
        result.errorRate.toFixed(2) + '%'
      );
    }

    console.log('─'.repeat(120));
  }
}

/**
 * Stress test configuration
 */
export interface StressTestConfig {
  name: string;
  fn: () => Promise<void>;
  startConcurrency: number;
  maxConcurrency: number;
  stepDuration: number;
  stepIncrement: number;
  maxErrorRate: number;
}

/**
 * Stress test result
 */
export interface StressTestResult {
  name: string;
  maxSustainedConcurrency: number;
  maxSustainedRPS: number;
  breakpoints: Array<{
    concurrency: number;
    errorRate: number;
    averageLatency: number;
  }>;
}

/**
 * Stress tester
 */
export class StressTester {
  /**
   * Run stress test
   */
  async run(config: StressTestConfig): Promise<StressTestResult> {
    const {
      name,
      fn,
      startConcurrency = 1,
      maxConcurrency = 1000,
      stepDuration = 5000,
      stepIncrement = 10,
      maxErrorRate = 5,
    } = config;

    const breakpoints: StressTestResult['breakpoints'] = [];
    let maxSustainedConcurrency = 0;
    let concurrency = startConcurrency;

    while (concurrency <= maxConcurrency) {
      const loadTester = new LoadTester();

      const result = await loadTester.run({
        name: `${name}-c${concurrency}`,
        fn,
        requestsPerSecond: concurrency * 10,
        duration: stepDuration,
        concurrency,
      });

      breakpoints.push({
        concurrency,
        errorRate: result.errorRate,
        averageLatency: result.averageLatency,
      });

      if (result.errorRate <= maxErrorRate) {
        maxSustainedConcurrency = concurrency;
      } else {
        break;
      }

      concurrency += stepIncrement;
    }

    return {
      name,
      maxSustainedConcurrency,
      maxSustainedRPS: maxSustainedConcurrency * 10,
      breakpoints,
    };
  }
}

/**
 * Create benchmark suite
 */
export function createBenchmarkSuite(): BenchmarkSuite {
  return new BenchmarkSuite();
}

/**
 * Create load tester
 */
export function createLoadTester(): LoadTester {
  return new LoadTester();
}

/**
 * Create stress tester
 */
export function createStressTester(): StressTester {
  return new StressTester();
}

/**
 * Benchmark helper for comparing functions
 */
export async function compareBenchmarks(
  name1: string,
  fn1: () => Promise<void> | void,
  name2: string,
  fn2: () => Promise<void> | void,
  options?: { iterations?: number }
): Promise<{
  winner: string;
  speedup: number;
  result1: BenchmarkResult;
  result2: BenchmarkResult;
}> {
  const suite = createBenchmarkSuite();
  const iterations = options?.iterations || 100;

  const result1 = await suite.run({ name: name1, fn: fn1, iterations });
  const result2 = await suite.run({ name: name2, fn: fn2, iterations });

  const winner = result1.avgTime < result2.avgTime ? name1 : name2;
  const speedup = Math.max(result1.avgTime, result2.avgTime) / Math.min(result1.avgTime, result2.avgTime);

  return {
    winner,
    speedup,
    result1,
    result2,
  };
}

/**
 * Performance assertion helpers
 */
export class PerformanceAssertions {
  static assertThroughput(result: LoadTestResult, minRPS: number): void {
    expect(result.requestsPerSecond).toBeGreaterThanOrEqual(minRPS);
  }

  static assertLatency(result: LoadTestResult, maxLatency: number): void {
    expect(result.p95).toBeLessThan(maxLatency);
  }

  static assertErrorRate(result: LoadTestResult, maxErrorRate: number): void {
    expect(result.errorRate).toBeLessThan(maxErrorRate);
  }

  static assertBenchmarkFaster(
    result1: BenchmarkResult,
    result2: BenchmarkResult,
    factor: number = 1.0
  ): void {
    expect(result2.avgTime / result1.avgTime).toBeGreaterThanOrEqual(factor);
  }
}
