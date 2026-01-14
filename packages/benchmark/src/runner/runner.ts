/**
 * Benchmark Runner
 * Core benchmark execution engine with statistical analysis
 */

import { performance } from 'perf_hooks';
import { v8 } from 'node:perf_hooks';
import type {
  BenchmarkDefinition,
  BenchmarkOptions,
  BenchmarkResult,
  BenchmarkSuite,
  BenchmarkEvent,
  EventHandler,
  SystemInfo,
  SuiteMetadata,
  SuiteStatistics
} from '../types/index.js';
import {
  mean,
  median,
  mode,
  standardDeviation,
  percentile,
  confidenceInterval,
  detectOutliers,
  analyze,
  coefficientOfVariation
} from '../utils/statistics.js';
import { getSystemInfo } from '../utils/system.js';

/**
 * Default benchmark options
 */
const DEFAULT_OPTIONS: BenchmarkOptions = {
  warmupIterations: 5,
  iterations: 100,
  time: 1000, // 1 second minimum
  parallel: false,
  concurrency: 1,
  detailedMetrics: true,
  profiling: false,
  significanceThreshold: 0.95,
  maxRsd: 5, // 5% max relative standard deviation
  removeOutliers: true,
  outlierMethod: 'iqr',
  percentiles: [50, 75, 90, 95, 99, 99.9]
};

/**
 * Benchmark Runner class
 */
export class BenchmarkRunner {
  private benchmarks: Map<string, BenchmarkDefinition> = new Map();
  private options: BenchmarkOptions;
  private eventHandlers: Set<EventHandler> = new Set();
  private systemInfo: SystemInfo;
  private suiteStartTime: number = 0;
  private suiteEndTime: number = 0;

  constructor(options?: Partial<BenchmarkOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.systemInfo = getSystemInfo();
  }

  /**
   * Add a benchmark to the suite
   */
  addBenchmark(benchmark: BenchmarkDefinition): void {
    if (this.benchmarks.has(benchmark.name)) {
      throw new Error(`Benchmark '${benchmark.name}' already exists`);
    }
    this.benchmarks.set(benchmark.name, benchmark);
  }

  /**
   * Add multiple benchmarks
   */
  addBenchmarks(benchmarks: BenchmarkDefinition[]): void {
    benchmarks.forEach(benchmark => this.addBenchmark(benchmark));
  }

  /**
   * Remove a benchmark by name
   */
  removeBenchmark(name: string): boolean {
    return this.benchmarks.delete(name);
  }

  /**
   * Get a benchmark by name
   */
  getBenchmark(name: string): BenchmarkDefinition | undefined {
    return this.benchmarks.get(name);
  }

  /**
   * Get all benchmarks
   */
  getBenchmarks(): BenchmarkDefinition[] {
    return Array.from(this.benchmarks.values());
  }

  /**
   * Register an event handler
   */
  on(eventHandler: EventHandler): void {
    this.eventHandlers.add(eventHandler);
  }

  /**
   * Unregister an event handler
   */
  off(eventHandler: EventHandler): void {
    this.eventHandlers.delete(eventHandler);
  }

  /**
   * Emit an event to all registered handlers
   */
  private emit(event: BenchmarkEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in event handler:', error);
      }
    });
  }

  /**
   * Run all benchmarks
   */
  async run(): Promise<BenchmarkSuite> {
    this.suiteStartTime = performance.now();
    this.emit({ type: 'suite-start', timestamp: this.suiteStartTime });

    const results: BenchmarkResult[] = [];
    const benchmarks = this.getBenchmarks();

    for (let i = 0; i < benchmarks.length; i++) {
      const benchmark = benchmarks[i];
      const progress = ((i + 1) / benchmarks.length) * 100;

      this.emit({
        type: 'progress',
        timestamp: performance.now(),
        data: { current: i + 1, total: benchmarks.length, progress }
      });

      const result = await this.runBenchmark(benchmark);
      results.push(result);
    }

    this.suiteEndTime = performance.now();
    this.emit({ type: 'suite-end', timestamp: this.suiteEndTime });

    return this.createSuite(results);
  }

  /**
   * Run a single benchmark
   */
  async runBenchmark(benchmark: BenchmarkDefinition): Promise<BenchmarkResult> {
    this.emit({
      type: 'benchmark-start',
      timestamp: performance.now(),
      data: { name: benchmark.name }
    });

    const startTime = performance.now();
    let samples: number[] = [];
    let memory: any = undefined;
    let cpu: any = undefined;
    let error: Error | undefined = undefined;

    try {
      // Run beforeAll if defined
      if (benchmark.beforeAll) {
        await benchmark.beforeAll();
      }

      // Warmup iterations
      await this.runWarmup(benchmark);

      // Collect initial metrics if detailed metrics are enabled
      const startMetrics = this.options.detailedMetrics ? this.collectStartMetrics() : null;

      // Main benchmark iterations
      samples = await this.runIterations(benchmark);

      // Collect final metrics if detailed metrics are enabled
      const endMetrics = this.options.detailedMetrics && startMetrics
        ? this.collectEndMetrics(startMetrics)
        : null;

      memory = endMetrics?.memory;
      cpu = endMetrics?.cpu;

      // Run afterAll if defined
      if (benchmark.afterAll) {
        await benchmark.afterAll();
      }
    } catch (e) {
      error = e as Error;
      this.emit({
        type: 'benchmark-error',
        timestamp: performance.now(),
        data: { name: benchmark.name, error }
      });
    }

    const endTime = performance.now();

    const result = this.createResult(
      benchmark,
      samples,
      memory,
      cpu,
      startTime,
      endTime,
      error
    );

    this.emit({
      type: 'benchmark-end',
      timestamp: endTime,
      data: { name: benchmark.name, result }
    });

    return result;
  }

  /**
   * Run warmup iterations
   */
  private async runWarmup(benchmark: BenchmarkDefinition): Promise<void> {
    const options = { ...this.options, ...benchmark.options };
    const warmupCount = options.warmupIterations;

    for (let i = 0; i < warmupCount; i++) {
      if (benchmark.setup) {
        await benchmark.setup();
      }

      await benchmark.fn();

      if (benchmark.teardown) {
        await benchmark.teardown();
      }
    }
  }

  /**
   * Run benchmark iterations
   */
  private async runIterations(benchmark: BenchmarkDefinition): Promise<number[]> {
    const options = { ...this.options, ...benchmark.options };
    const samples: number[] = [];
    let iterations = 0;
    const maxIterations = options.iterations;
    const minTime = options.time;
    const startTime = performance.now();

    while (iterations < maxIterations) {
      // Run setup if defined
      if (benchmark.setup) {
        await benchmark.setup();
      }

      // Measure the function execution
      const iterStart = performance.now();
      await benchmark.fn();
      const iterEnd = performance.now();

      // Run teardown if defined
      if (benchmark.teardown) {
        await benchmark.teardown();
      }

      // Record sample in nanoseconds
      samples.push((iterEnd - iterStart) * 1_000_000);
      iterations++;

      // Check if we've run long enough
      const elapsed = performance.now() - startTime;
      if (elapsed >= minTime && iterations >= 10) {
        break;
      }
    }

    // Remove outliers if configured
    if (options.removeOutliers && samples.length > 10) {
      const outliers = detectOutliers(samples, options.outlierMethod);
      const cleanSamples = samples.filter((_, idx) => !outliers.indices.includes(idx));

      // Only use cleaned samples if we have enough left
      if (cleanSamples.length >= samples.length * 0.7) {
        return cleanSamples;
      }
    }

    return samples;
  }

  /**
   * Collect metrics before benchmark
   */
  private collectStartMetrics() {
    const memoryUsage = process.memoryUsage();
    const startCpu = process.cpuUsage();

    return {
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers,
        rss: memoryUsage.rss
      },
      cpu: startCpu,
      timestamp: performance.now()
    };
  }

  /**
   * Collect metrics after benchmark and calculate delta
   */
  private collectEndMetrics(startMetrics: any) {
    const memoryUsage = process.memoryUsage();
    const endCpu = process.cpuUsage(startMetrics.cpu);

    return {
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers,
        rss: memoryUsage.rss,
        peakHeapUsed: memoryUsage.heapUsed,
        growth: memoryUsage.heapUsed - startMetrics.memory.heapUsed
      },
      cpu: {
        user: endCpu.user,
        system: endCpu.system,
        percent: (endCpu.user + endCpu.system) / ((performance.now() - startMetrics.timestamp) * 1000) * 100,
        cores: this.systemInfo.cpuCores
      }
    };
  }

  /**
   * Create a benchmark result object
   */
  private createResult(
    benchmark: BenchmarkDefinition,
    samples: number[],
    memory: any,
    cpu: any,
    startTime: number,
    endTime: number,
    error?: Error
  ): BenchmarkResult {
    const options = { ...this.options, ...benchmark.options };

    if (samples.length === 0) {
      return {
        name: benchmark.name,
        samples: [],
        total: 0,
        mean: 0,
        standardDeviation: 0,
        rsd: 0,
        min: 0,
        max: 0,
        median: 0,
        mode: 0,
        percentiles: {},
        ops: 0,
        confidence: { lower: 0, upper: 0, level: options.significanceThreshold },
        significant: false,
        startTime,
        endTime,
        error
      };
    }

    const total = samples.reduce((sum, val) => sum + val, 0);
    const meanValue = mean(samples);
    const stdDev = standardDeviation(samples);
    const rsdValue = coefficientOfVariation(samples);
    const confidence = confidenceInterval(samples, options.significanceThreshold);

    // Calculate percentiles
    const percentiles: Record<number, number> = {};
    for (const p of options.percentiles) {
      percentiles[p] = percentile(samples, p);
    }

    // Detect outliers
    const outliers = options.removeOutliers
      ? detectOutliers(samples, options.outlierMethod)
      : undefined;

    return {
      name: benchmark.name,
      samples,
      total,
      mean: meanValue,
      standardDeviation: stdDev,
      rsd: rsdValue,
      min: Math.min(...samples),
      max: Math.max(...samples),
      median: median(samples),
      mode: mode(samples),
      percentiles,
      ops: 1_000_000_000 / meanValue, // ops per second (nanoseconds to seconds)
      confidence,
      significant: rsdValue <= options.maxRsd,
      outliers: outliers?.count > 0 ? outliers : undefined,
      memory,
      cpu,
      startTime,
      endTime,
      error
    };
  }

  /**
   * Create a benchmark suite
   */
  private createSuite(results: BenchmarkResult[]): BenchmarkSuite {
    const successful = results.filter(r => !r.error);
    const failed = results.filter(r => r.error);

    return {
      name: 'benchmark-suite',
      results,
      metadata: this.createMetadata(),
      statistics: {
        totalBenchmarks: results.length,
        successful: successful.length,
        failed: failed.length,
        skipped: 0,
        totalExecutionTime: this.suiteEndTime - this.suiteStartTime,
        fastest: successful.sort((a, b) => a.mean - b.mean)[0],
        slowest: successful.sort((a, b) => b.mean - a.mean)[0]
      }
    };
  }

  /**
   * Create suite metadata
   */
  private createMetadata(): SuiteMetadata {
    return {
      startTime: this.suiteStartTime,
      endTime: this.suiteEndTime,
      duration: this.suiteEndTime - this.suiteStartTime,
      system: this.systemInfo,
      env: process.env.NODE_ENV ? { NODE_ENV: process.env.NODE_ENV } : undefined
    };
  }

  /**
   * Clear all benchmarks
   */
  clear(): void {
    this.benchmarks.clear();
  }

  /**
   * Get benchmark count
   */
  count(): number {
    return this.benchmarks.size;
  }
}

/**
 * Convenience function to create and run a benchmark
 */
export async function benchmark(
  name: string,
  fn: () => void | Promise<void>,
  options?: Partial<BenchmarkOptions>
): Promise<BenchmarkResult> {
  const runner = new BenchmarkRunner(options);
  const definition: BenchmarkDefinition = { name, fn, options };
  runner.addBenchmark(definition);
  const suite = await runner.run();
  return suite.results[0];
}

/**
 * Convenience function to run multiple benchmarks
 */
export async function suite(
  benchmarks: BenchmarkDefinition[],
  options?: Partial<BenchmarkOptions>
): Promise<BenchmarkSuite> {
  const runner = new BenchmarkRunner(options);
  runner.addBenchmarks(benchmarks);
  return runner.run();
}
