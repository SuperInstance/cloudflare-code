/**
 * Performance Testing Framework - Load, stress, and benchmark testing
 */

import type {
  BenchmarkOptions,
  BenchmarkResult,
  LoadTestOptions,
  LoadTestResult,
} from '../types/index.js';

// ============================================================================
// Benchmark Testing
// ============================================================================

export class BenchmarkRunner {
  async benchmark(
    name: string,
    fn: () => unknown | Promise<unknown>,
    options: BenchmarkOptions = {}
  ): Promise<BenchmarkResult> {
    const {
      iterations = 1000,
      warmup = 100,
      duration,
      setup,
      teardown,
    } = options;

    // Warmup
    for (let i = 0; i < warmup; i++) {
      await fn();
    }

    // Setup if provided
    if (setup) {
      await setup();
    }

    const times: number[] = [];
    const startTime = Date.now();
    let iterationsCompleted = 0;

    // Run iterations
    if (duration) {
      // Time-based benchmark
      const endTime = startTime + duration;
      while (Date.now() < endTime) {
        const iterStart = performance.now();
        await fn();
        const iterEnd = performance.now();
        times.push(iterEnd - iterStart);
        iterationsCompleted++;
      }
    } else {
      // Count-based benchmark
      for (let i = 0; i < iterations; i++) {
        const iterStart = performance.now();
        await fn();
        const iterEnd = performance.now();
        times.push(iterEnd - iterStart);
        iterationsCompleted = i + 1;
      }
    }

    const totalTime = Date.now() - startTime;

    // Teardown if provided
    if (teardown) {
      await teardown();
    }

    // Calculate statistics
    const sortedTimes = times.slice().sort((a, b) => a - b);
    const sum = times.reduce((a, b) => a + b, 0);
    const avgTime = sum / times.length;
    const minTime = sortedTimes[0];
    const maxTime = sortedTimes[sortedTimes.length - 1];
    const opsPerSecond = (iterationsCompleted / totalTime) * 1000;

    const percentiles = {
      p50: sortedTimes[Math.floor(sortedTimes.length * 0.5)],
      p90: sortedTimes[Math.floor(sortedTimes.length * 0.9)],
      p95: sortedTimes[Math.floor(sortedTimes.length * 0.95)],
      p99: sortedTimes[Math.floor(sortedTimes.length * 0.99)],
    };

    return {
      name,
      iterations: iterationsCompleted,
      totalTime,
      avgTime,
      minTime,
      maxTime,
      opsPerSecond,
      percentiles,
    };
  }

  async compare(
    name: string,
    implementations: Map<string, () => unknown | Promise<unknown>>,
    options: BenchmarkOptions = {}
  ): Promise<Map<string, BenchmarkResult>> {
    const results = new Map<string, BenchmarkResult>();

    for (const [implName, fn] of implementations) {
      const result = await this.benchmark(`${name}:${implName}`, fn, options);
      results.set(implName, result);
    }

    return results;
  }

  async suite(
    name: string,
    benchmarks: Array<{ name: string; fn: () => unknown; options?: BenchmarkOptions }>
  ): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    for (const benchmark of benchmarks) {
      const result = await this.benchmark(
        `${name}:${benchmark.name}`,
        benchmark.fn,
        benchmark.options || {}
      );
      results.push(result);
    }

    return results;
  }
}

// ============================================================================
// Load Testing
// ============================================================================>

export class LoadTester {
  async loadTest(options: LoadTestOptions): Promise<LoadTestResult> {
    const {
      concurrency,
      requests,
      rampUp = 0,
      duration,
      endpoint,
      method = 'GET',
      headers = {},
      body,
    } = options;

    const startTime = Date.now();
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    const latencies: number[] = [];
    const errors: Map<string, number> = new Map();

    // Create workers
    const workers: Promise<void>[] = [];
    let completedWorkers = 0;

    for (let i = 0; i < concurrency; i++) {
      workers.push(this.runWorker({
        endpoint,
        method,
        headers,
        body,
        requestsPerWorker: duration ? undefined : Math.ceil(requests / concurrency),
        duration: duration ? duration / concurrency : undefined,
        rampUpDelay: rampUp ? (rampUp / concurrency) * i : 0,
        onResult: (result) => {
          totalRequests++;
          if (result.success) {
            successfulRequests++;
            latencies.push(result.latency);
          } else {
            failedRequests++;
            const errorKey = result.error || 'unknown';
            errors.set(errorKey, (errors.get(errorKey) || 0) + 1);
          }
        },
      }));
    }

    // Wait for all workers to complete
    await Promise.all(workers);

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    // Calculate statistics
    const sortedLatencies = latencies.slice().sort((a, b) => a - b);
    const sum = latencies.reduce((a, b) => a + b, 0);
    const avgLatency = latencies.length > 0 ? sum / latencies.length : 0;
    const minLatency = sortedLatencies[0] || 0;
    const maxLatency = sortedLatencies[sortedLatencies.length - 1] || 0;

    const percentiles = {
      p50: sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || 0,
      p90: sortedLatencies[Math.floor(sortedLatencies.length * 0.9)] || 0,
      p95: sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0,
      p99: sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0,
    };

    return {
      endpoint,
      totalRequests,
      successfulRequests,
      failedRequests,
      duration: totalDuration,
      requestsPerSecond: (totalRequests / totalDuration) * 1000,
      avgLatency,
      minLatency,
      maxLatency,
      percentiles,
      errorRates: Object.fromEntries(errors),
    };
  }

  private async runWorker(options: {
    endpoint: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
    requestsPerWorker?: number;
    duration?: number;
    rampUpDelay: number;
    onResult: (result: { success: boolean; latency: number; error?: string }) => void;
  }): Promise<void> {
    const {
      endpoint,
      method,
      headers,
      body,
      requestsPerWorker,
      duration,
      rampUpDelay,
      onResult,
    } = options;

    // Wait for ramp up delay
    if (rampUpDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, rampUpDelay));
    }

    const startTime = Date.now();
    let requestsCompleted = 0;

    while (true) {
      // Check if we've completed enough requests
      if (requestsPerWorker && requestsCompleted >= requestsPerWorker) {
        break;
      }

      // Check if duration has elapsed
      if (duration && Date.now() - startTime >= duration) {
        break;
      }

      const requestStart = performance.now();
      try {
        const response = await fetch(endpoint, {
          method,
          headers,
          body,
        });

        const requestEnd = performance.now();
        const latency = requestEnd - requestStart;

        if (response.ok) {
          onResult({ success: true, latency });
        } else {
          onResult({
            success: false,
            latency,
            error: `HTTP ${response.status}`,
          });
        }
      } catch (error) {
        const requestEnd = performance.now();
        const latency = requestEnd - requestStart;
        onResult({
          success: false,
          latency,
          error: (error as Error).message,
        });
      }

      requestsCompleted++;
    }
  }

  async stressTest(
    endpoint: string,
    options: {
      startConcurrency: number;
      maxConcurrency: number;
      stepSize: number;
      stepDuration: number;
      requestsPerStep: number;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    }
  ): Promise<Array<LoadTestResult & { concurrency: number }>> {
    const results: Array<LoadTestResult & { concurrency: number }> = [];

    for (
      let concurrency = options.startConcurrency;
      concurrency <= options.maxConcurrency;
      concurrency += options.stepSize
    ) {
      console.log(`Running stress test with ${concurrency} concurrent connections...`);

      const result = await this.loadTest({
        endpoint,
        concurrency,
        requests: options.requestsPerStep,
        method: options.method,
        headers: options.headers,
        body: options.body,
      });

      results.push({ ...result, concurrency });

      // Stop if error rate is too high
      const errorRate = result.failedRequests / result.totalRequests;
      if (errorRate > 0.5) {
        console.log(`Error rate exceeded 50% at ${concurrency} concurrent connections`);
        break;
      }

      // Wait before next step
      await new Promise(resolve => setTimeout(resolve, options.stepDuration));
    }

    return results;
  }

  async spikeTest(
    endpoint: string,
    options: {
      baselineConcurrency: number;
      spikeConcurrency: number;
      spikeDuration: number;
      baselineDuration: number;
      requestsPerSecond: number;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    }
  ): Promise<{
    baseline: LoadTestResult;
    spike: LoadTestResult;
    recovery: LoadTestResult;
  }> {
    // Baseline
    console.log('Running baseline test...');
    const baseline = await this.loadTest({
      endpoint,
      concurrency: options.baselineConcurrency,
      requests: options.requestsPerSecond * options.baselineDuration,
      method: options.method,
      headers: options.headers,
      body: options.body,
    });

    // Spike
    console.log('Running spike test...');
    const spike = await this.loadTest({
      endpoint,
      concurrency: options.spikeConcurrency,
      requests: options.requestsPerSecond * options.spikeDuration,
      method: options.method,
      headers: options.headers,
      body: options.body,
    });

    // Recovery
    console.log('Running recovery test...');
    const recovery = await this.loadTest({
      endpoint,
      concurrency: options.baselineConcurrency,
      requests: options.requestsPerSecond * options.baselineDuration,
      method: options.method,
      headers: options.headers,
      body: options.body,
    });

    return { baseline, spike, recovery };
  }
}

// ============================================================================
// Latency Measurement
// ============================================================================

export class LatencyMeasurer {
  private measurements: Map<string, number[]> = new Map();

  async measure<T>(
    name: string,
    fn: () => T | Promise<T>
  ): Promise<{ result: T; latency: number }> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    const latency = end - start;

    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }
    this.measurements.get(name)!.push(latency);

    return { result, latency };
  }

  getStats(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  } | null {
    const measurements = this.measurements.get(name);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const sorted = measurements.slice().sort((a, b) => a - b);
    const sum = measurements.reduce((a, b) => a + b, 0);

    return {
      count: measurements.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / measurements.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  getAllStats(): Map<string, ReturnType<LatencyMeasurer['getStats']>> {
    const stats = new Map();
    for (const name of this.measurements.keys()) {
      stats.set(name, this.getStats(name));
    }
    return stats;
  }

  clear(name?: string): void {
    if (name) {
      this.measurements.delete(name);
    } else {
      this.measurements.clear();
    }
  }
}

// ============================================================================
// Throughput Testing
// ============================================================================

export class ThroughputTester {
  async measureThroughput(
    fn: () => unknown | Promise<unknown>,
    options: {
      duration: number;
      concurrency?: number;
    }
  ): Promise<{
    operations: number;
    duration: number;
    opsPerSecond: number;
    avgLatency: number;
  }> {
    const { duration, concurrency = 1 } = options;
    const startTime = Date.now();
    const latencies: number[] = [];
    let operations = 0;

    const workers: Promise<void>[] = [];

    for (let i = 0; i < concurrency; i++) {
      workers.push(
        (async () => {
          while (Date.now() - startTime < duration) {
            const start = performance.now();
            await fn();
            const end = performance.now();
            latencies.push(end - start);
            operations++;
          }
        })()
      );
    }

    await Promise.all(workers);

    const actualDuration = Date.now() - startTime;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    return {
      operations,
      duration: actualDuration,
      opsPerSecond: (operations / actualDuration) * 1000,
      avgLatency,
    };
  }

  async findMaxThroughput(
    fn: () => unknown | Promise<unknown>,
    options: {
      startConcurrency: number;
      maxConcurrency: number;
      stepSize: number;
      durationPerStep: number;
      targetLatency?: number;
    }
  ): Promise<Array<{
    concurrency: number;
    throughput: number;
    avgLatency: number;
  }>> {
    const results: Array<{
      concurrency: number;
      throughput: number;
      avgLatency: number;
    }> = [];

    for (
      let concurrency = options.startConcurrency;
      concurrency <= options.maxConcurrency;
      concurrency += options.stepSize
    ) {
      const result = await this.measureThroughput(fn, {
        duration: options.durationPerStep,
        concurrency,
      });

      results.push({
        concurrency,
        throughput: result.opsPerSecond,
        avgLatency: result.avgLatency,
      });

      // Stop if latency exceeds target
      if (options.targetLatency && result.avgLatency > options.targetLatency) {
        console.log(`Target latency ${options.targetLatency}ms exceeded at ${concurrency} concurrency`);
        break;
      }
    }

    return results;
  }
}

// ============================================================================
// Resource Usage Monitoring
// ============================================================================>

export class ResourceMonitor {
  private samples: Array<{
    timestamp: number;
    memory: NodeJS.MemoryUsage;
    cpu: number;
  }> = [];

  private lastCpuUsage = process.cpuUsage();
  private lastSampleTime = Date.now();

  start(interval: number = 100): void {
    this.samples = [];
    this.lastCpuUsage = process.cpuUsage();
    this.lastSampleTime = Date.now();

    const intervalId = setInterval(() => {
      this.sample();
    }, interval);

    // Store interval ID for cleanup
    (this as any).intervalId = intervalId;
  }

  private sample(): void {
    const now = Date.now();
    const cpuUsage = process.cpuUsage(this.lastCpuUsage);
    const timeDelta = now - this.lastSampleTime;

    // Calculate CPU usage percentage
    const cpuPercent =
      (cpuUsage.user + cpuUsage.system) / 1000 / timeDelta / 100;

    this.samples.push({
      timestamp: now,
      memory: process.memoryUsage(),
      cpu: cpuPercent,
    });

    this.lastCpuUsage = process.cpuUsage();
    this.lastSampleTime = now;
  }

  stop(): void {
    if ((this as any).intervalId) {
      clearInterval((this as any).intervalId);
      delete (this as any).intervalId;
    }
  }

  getStats(): {
    duration: number;
    samples: number;
    memory: {
      avg: number;
      min: number;
      max: number;
      peak: number;
    };
    cpu: {
      avg: number;
      min: number;
      max: number;
    };
  } {
    if (this.samples.length === 0) {
      throw new Error('No samples collected');
    }

    const duration = this.samples[this.samples.length - 1].timestamp - this.samples[0].timestamp;

    const memoryValues = this.samples.map(s => s.memory.heapUsed);
    const cpuValues = this.samples.map(s => s.cpu);

    return {
      duration,
      samples: this.samples.length,
      memory: {
        avg: memoryValues.reduce((a, b) => a + b) / memoryValues.length,
        min: Math.min(...memoryValues),
        max: Math.max(...memoryValues),
        peak: Math.max(...memoryValues),
      },
      cpu: {
        avg: cpuValues.reduce((a, b) => a + b) / cpuValues.length,
        min: Math.min(...cpuValues),
        max: Math.max(...cpuValues),
      },
    };
  }

  getSamples(): Array<{
    timestamp: number;
    memory: NodeJS.MemoryUsage;
    cpu: number;
  }> {
    return [...this.samples];
  }

  clear(): void {
    this.samples = [];
  }
}

// ============================================================================
// Performance Test Builder
// ============================================================================

export class PerformanceTestBuilder {
  private benchmarks: Array<{ name: string; fn: () => unknown; options?: BenchmarkOptions }> = [];
  private loadTests: Array<{ name: string; options: LoadTestOptions }> = [];

  addBenchmark(name: string, fn: () => unknown, options?: BenchmarkOptions): this {
    this.benchmarks.push({ name, fn, options });
    return this;
  }

  addLoadTest(name: string, options: LoadTestOptions): this {
    this.loadTests.push({ name, options });
    return this;
  }

  async run(): Promise<{
    benchmarks: Map<string, BenchmarkResult>;
    loadTests: Map<string, LoadTestResult>;
  }> {
    const benchmarkResults = new Map<string, BenchmarkResult>();
    const loadTestResults = new Map<string, LoadTestResult>();

    // Run benchmarks
    if (this.benchmarks.length > 0) {
      const benchmarkRunner = new BenchmarkRunner();
      for (const { name, fn, options } of this.benchmarks) {
        const result = await benchmarkRunner.benchmark(name, fn, options);
        benchmarkResults.set(name, result);
      }
    }

    // Run load tests
    if (this.loadTests.length > 0) {
      const loadTester = new LoadTester();
      for (const { name, options } of this.loadTests) {
        const result = await loadTester.loadTest(options);
        loadTestResults.set(name, result);
      }
    }

    return {
      benchmarks: benchmarkResults,
      loadTests: loadTestResults,
    };
  }
}

// ============================================================================
// Convenience functions
// ============================================================================

export async function benchmark(
  name: string,
  fn: () => unknown,
  options?: BenchmarkOptions
): Promise<BenchmarkResult> {
  const runner = new BenchmarkRunner();
  return runner.benchmark(name, fn, options);
}

export async function loadTest(options: LoadTestOptions): Promise<LoadTestResult> {
  const tester = new LoadTester();
  return tester.loadTest(options);
}

export function createPerformanceTest(): PerformanceTestBuilder {
  return new PerformanceTestBuilder();
}

export function measureLatency<T>(
  name: string,
  fn: () => T | Promise<T>,
  measurer?: LatencyMeasurer
): Promise<{ result: T; latency: number }> {
  const m = measurer || new LatencyMeasurer();
  return m.measure(name, fn);
}

export function monitorResources(): ResourceMonitor {
  return new ResourceMonitor();
}
