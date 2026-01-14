/**
 * Benchmark Runner - Automated benchmark execution with A/B testing
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  BenchmarkSuite,
  Benchmark,
  BenchmarkFn,
  BenchmarkOptions,
  BenchmarkResult,
  BenchmarkStatistics,
  BenchmarkComparison,
  BenchmarkEnvironment,
  ProfilerEvent,
} from '../types';

export interface BenchmarkRunnerOptions {
  /**
   * Default benchmark options
   */
  defaultOptions?: BenchmarkOptions;

  /**
   * Enable warmup iterations
   */
  enableWarmup?: boolean;

  /**
   * Enable statistical significance testing
   */
  enableSignificanceTesting?: boolean;

  /**
   * Significance level (0-1)
   */
  significanceLevel?: number;

  /**
   * Enable A/B testing
   */
  enableABTesting?: boolean;

  /**
   * Minimum samples for statistical tests
   */
  minSamples?: number;

  /**
   * Maximum benchmark duration (ms)
   */
  maxDuration?: number;

  /**
   * Enable automatic calibration
   */
  enableCalibration?: boolean;

  /**
   * Save benchmark history
   */
  saveHistory?: boolean;

  /**
   * Maximum history size
   */
  maxHistory?: number;
}

export interface ABTest {
  id: string;
  name: string;
  control: Benchmark;
  treatment: Benchmark;
  sampleSize: number;
  results?: {
    control: BenchmarkResult;
    treatment: BenchmarkResult;
    comparison: BenchmarkComparison;
  };
}

export interface BenchmarkHistory {
  benchmarkId: string;
  suiteId: string;
  timestamp: number;
  result: BenchmarkResult;
  metadata?: Record<string, unknown>;
}

/**
 * Benchmark Runner implementation
 */
export class BenchmarkRunner extends EventEmitter {
  private suites: Map<string, BenchmarkSuite> = new Map();
  private results: Map<string, BenchmarkResult> = new Map();
  private history: BenchmarkHistory[] = [];
  private abTests: Map<string, ABTest> = new Map();
  private options: Required<BenchmarkRunnerOptions>;

  constructor(options: BenchmarkRunnerOptions = {}) {
    super();
    this.options = {
      defaultOptions: {
        iterations: 100,
        duration: 5000,
        warmupIterations: 10,
        ...options.defaultOptions,
      },
      enableWarmup: options.enableWarmup ?? true,
      enableSignificanceTesting: options.enableSignificanceTesting ?? true,
      significanceLevel: options.significanceLevel ?? 0.05,
      enableABTesting: options.enableABTesting ?? true,
      minSamples: options.minSamples ?? 30,
      maxDuration: options.maxDuration ?? 60000,
      enableCalibration: options.enableCalibration ?? true,
      saveHistory: options.saveHistory ?? true,
      maxHistory: options.maxHistory ?? 1000,
    };
  }

  /**
   * Register a benchmark suite
   */
  public registerSuite(suite: BenchmarkSuite): void {
    this.suites.set(suite.id, suite);
  }

  /**
   * Register a single benchmark
   */
  public registerBenchmark(
    suiteId: string,
    benchmark: Benchmark
  ): void {
    const suite = this.suites.get(suiteId);
    if (!suite) {
      throw new Error(`Suite not found: ${suiteId}`);
    }

    suite.benchmarks.push(benchmark);
  }

  /**
   * Run a benchmark
   */
  public async runBenchmark(
    suiteId: string,
    benchmarkId: string,
    options?: Partial<BenchmarkOptions>
  ): Promise<BenchmarkResult> {
    const suite = this.suites.get(suiteId);
    if (!suite) {
      throw new Error(`Suite not found: ${suiteId}`);
    }

    const benchmark = suite.benchmarks.find((b) => b.id === benchmarkId);
    if (!benchmark) {
      throw new Error(`Benchmark not found: ${benchmarkId}`);
    }

    const mergedOptions = { ...this.options.defaultOptions, ...benchmark.options, ...options };

    // Run setup
    if (suite.setup) {
      await suite.setup();
    }

    try {
      const result = await this.executeBenchmark(suiteId, benchmark, mergedOptions);
      this.results.set(`${suiteId}:${benchmarkId}`, result);

      if (this.options.saveHistory) {
        this.addToHistory(suiteId, benchmarkId, result, benchmark.metadata);
      }

      this.emit({
        type: 'benchmark-completed',
        timestamp: Date.now(),
        result,
      } as ProfilerEvent);

      return result;
    } finally {
      // Run teardown
      if (suite.teardown) {
        await suite.teardown();
      }
    }
  }

  /**
   * Run all benchmarks in a suite
   */
  public async runSuite(
    suiteId: string,
    options?: Partial<BenchmarkOptions>
  ): Promise<BenchmarkResult[]> {
    const suite = this.suites.get(suiteId);
    if (!suite) {
      throw new Error(`Suite not found: ${suiteId}`);
    }

    const results: BenchmarkResult[] = [];

    for (const benchmark of suite.benchmarks) {
      const result = await this.runBenchmark(suiteId, benchmark.id, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Run all registered benchmarks
   */
  public async runAll(options?: Partial<BenchmarkOptions>): Promise<Map<string, BenchmarkResult>> {
    const allResults = new Map<string, BenchmarkResult>();

    for (const [suiteId, suite] of this.suites) {
      for (const benchmark of suite.benchmarks) {
        const result = await this.runBenchmark(suiteId, benchmark.id, options);
        allResults.set(`${suiteId}:${benchmark.id}`, result);
      }
    }

    return allResults;
  }

  /**
   * Compare two benchmark results
   */
  public compareResults(
    result1: BenchmarkResult,
    result2: BenchmarkResult
  ): BenchmarkComparison {
    const baseline = result1;
    const current = result2;

    const diff = current.stats.mean - baseline.stats.mean;
    const diffPercent = baseline.stats.mean !== 0
      ? (diff / baseline.stats.mean) * 100
      : 0;

    const improved = diff < 0;
    const regression = diff > 0;

    let significance = 0;
    if (this.options.enableSignificanceTesting) {
      significance = this.calculateSignificance(
        baseline.samples,
        current.samples
      );
    }

    return {
      baseline,
      current,
      difference: diff,
      differencePercent: diffPercent,
      significance,
      improved,
      regression,
    };
  }

  /**
   * Compare current result with historical baseline
   */
  public compareWithBaseline(
    suiteId: string,
    benchmarkId: string
  ): BenchmarkComparison | null {
    const currentResult = this.results.get(`${suiteId}:${benchmarkId}`);
    if (!currentResult) {
      return null;
    }

    const baseline = this.findBaseline(suiteId, benchmarkId);
    if (!baseline) {
      return null;
    }

    return this.compareResults(baseline.result, currentResult);
  }

  /**
   * Create and run an A/B test
   */
  public async runABTest(
    name: string,
    controlFn: BenchmarkFn,
    treatmentFn: BenchmarkFn,
    options?: Partial<BenchmarkOptions>
  ): Promise<ABTest> {
    if (!this.options.enableABTesting) {
      throw new Error('A/B testing is not enabled');
    }

    const control: Benchmark = {
      id: uuidv4(),
      name: `${name} (control)`,
      fn: controlFn,
      options: options ?? {},
    };

    const treatment: Benchmark = {
      id: uuidv4(),
      name: `${name} (treatment)`,
      fn: treatmentFn,
      options: options ?? {},
    };

    const abTest: ABTest = {
      id: uuidv4(),
      name,
      control,
      treatment,
      sampleSize: options?.iterations ?? this.options.defaultOptions.iterations ?? 100,
    };

    // Run control
    const controlResult = await this.executeBenchmark('ab-test', control, {
      ...this.options.defaultOptions,
      ...options,
    });

    // Run treatment
    const treatmentResult = await this.executeBenchmark('ab-test', treatment, {
      ...this.options.defaultOptions,
      ...options,
    });

    const comparison = this.compareResults(controlResult, treatmentResult);

    abTest.results = {
      control: controlResult,
      treatment: treatmentResult,
      comparison,
    };

    this.abTests.set(abTest.id, abTest);

    return abTest;
  }

  /**
   * Get benchmark result
   */
  public getResult(suiteId: string, benchmarkId: string): BenchmarkResult | undefined {
    return this.results.get(`${suiteId}:${benchmarkId}`);
  }

  /**
   * Get benchmark history
   */
  public getHistory(suiteId?: string, benchmarkId?: string): BenchmarkHistory[] {
    let history = [...this.history];

    if (suiteId) {
      history = history.filter((h) => h.suiteId === suiteId);
    }

    if (benchmarkId) {
      history = history.filter((h) => h.benchmarkId === benchmarkId);
    }

    return history;
  }

  /**
   * Get A/B test results
   */
  public getABTests(): ABTest[] {
    return Array.from(this.abTests.values());
  }

  /**
   * Calibrate benchmark iterations
   */
  public async calibrate(benchmark: Benchmark): Promise<number> {
    if (!this.options.enableCalibration) {
      return this.options.defaultOptions.iterations ?? 100;
    }

    // Start with a small number of iterations
    let iterations = 10;
    const targetDuration = 1000; // 1 second

    while (iterations < 1000000) {
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const env: BenchmarkEnvironment = {
          iteration: i,
          timestamp: Date.now(),
          metadata: {},
        };
        await benchmark.fn(env);
      }

      const duration = Date.now() - startTime;

      if (duration >= targetDuration) {
        break;
      }

      iterations *= 2;
    }

    return iterations;
  }

  /**
   * Clear all results and history
   */
  public clear(): void {
    this.results.clear();
    this.history = [];
    this.abTests.clear();
  }

  /**
   * Execute benchmark
   */
  private async executeBenchmark(
    suiteId: string,
    benchmark: Benchmark,
    options: Required<BenchmarkOptions>
  ): Promise<BenchmarkResult> {
    const samples: number[] = [];
    const iterations = options.iterations ?? 100;
    const startTime = Date.now();

    // Warmup
    if (this.options.enableWarmup && options.warmupIterations) {
      for (let i = 0; i < options.warmupIterations; i++) {
        const env: BenchmarkEnvironment = {
          iteration: i,
          timestamp: Date.now(),
          metadata: {},
        };

        if (options.beforeEach) {
          await options.beforeEach();
        }

        await benchmark.fn(env);

        if (options.afterEach) {
          await options.afterEach();
        }
      }
    }

    // Run benchmark
    for (let i = 0; i < iterations; i++) {
      const env: BenchmarkEnvironment = {
        iteration: i,
        timestamp: Date.now(),
        metadata: {},
      };

      if (options.beforeEach) {
        await options.beforeEach();
      }

      const iterStart = performance.now();
      await benchmark.fn(env);
      const iterEnd = performance.now();

      const duration = iterEnd - iterStart;
      samples.push(duration);

      if (options.afterEach) {
        await options.afterEach();
      }

      // Check max duration
      if (Date.now() - startTime > this.options.maxDuration) {
        break;
      }
    }

    const endTime = Date.now();

    return {
      benchmarkId: benchmark.id,
      suiteId,
      timestamp: Date.now(),
      iterations: samples.length,
      duration: endTime - startTime,
      stats: this.calculateStatistics(samples),
      samples,
      metadata: benchmark.metadata ?? {},
    };
  }

  /**
   * Calculate statistics from samples
   */
  private calculateStatistics(samples: number[]): BenchmarkStatistics {
    if (samples.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        mode: 0,
        stdDev: 0,
        variance: 0,
        percentiles: {
          p50: 0,
          p75: 0,
          p90: 0,
          p95: 0,
          p99: 0,
          p999: 0,
        },
      };
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const n = sorted.length;

    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / n;

    const median = n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];

    const mode = this.calculateMode(sorted);

    const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    const percentile = (p: number): number => sorted[Math.floor(n * p)];

    return {
      min: sorted[0],
      max: sorted[n - 1],
      mean,
      median,
      mode,
      stdDev,
      variance,
      percentiles: {
        p50: percentile(0.50),
        p75: percentile(0.75),
        p90: percentile(0.90),
        p95: percentile(0.95),
        p99: percentile(0.99),
        p999: percentile(0.999),
      },
      throughput: 1000 / mean, // Operations per second
    };
  }

  /**
   * Calculate mode
   */
  private calculateMode(samples: number[]): number {
    const frequency = new Map<number, number>();
    let maxFreq = 0;
    let mode = samples[0];

    for (const sample of samples) {
      const freq = (frequency.get(sample) ?? 0) + 1;
      frequency.set(sample, freq);

      if (freq > maxFreq) {
        maxFreq = freq;
        mode = sample;
      }
    }

    return mode;
  }

  /**
   * Calculate statistical significance (t-test)
   */
  private calculateSignificance(samples1: number[], samples2: number[]): number {
    if (samples1.length < this.options.minSamples || samples2.length < this.options.minSamples) {
      return 0;
    }

    const n1 = samples1.length;
    const n2 = samples2.length;

    const mean1 = samples1.reduce((a, b) => a + b, 0) / n1;
    const mean2 = samples2.reduce((a, b) => a + b, 0) / n2;

    const var1 = samples1.reduce((acc, val) => acc + Math.pow(val - mean1, 2), 0) / (n1 - 1);
    const var2 = samples2.reduce((acc, val) => acc + Math.pow(val - mean2, 2), 0) / (n2 - 1);

    // Pooled standard error
    const pooledSE = Math.sqrt(var1 / n1 + var2 / n2);

    if (pooledSE === 0) {
      return 0;
    }

    // t-statistic
    const tStat = (mean2 - mean1) / pooledSE;

    // Convert to p-value (two-tailed)
    // This is a simplified calculation
    const pValue = 2 * (1 - this.normalCDF(Math.abs(tStat)));

    return 1 - pValue; // Return confidence level
  }

  /**
   * Normal cumulative distribution function
   */
  private normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Find baseline in history
   */
  private findBaseline(suiteId: string, benchmarkId: string): BenchmarkHistory | null {
    const history = this.history.filter(
      (h) => h.suiteId === suiteId && h.benchmarkId === benchmarkId
    );

    if (history.length === 0) {
      return null;
    }

    // Use oldest result as baseline
    return history.sort((a, b) => a.timestamp - b.timestamp)[0];
  }

  /**
   * Add result to history
   */
  private addToHistory(
    suiteId: string,
    benchmarkId: string,
    result: BenchmarkResult,
    metadata?: Record<string, unknown>
  ): void {
    const historyItem: BenchmarkHistory = {
      suiteId,
      benchmarkId,
      timestamp: Date.now(),
      result,
      metadata,
    };

    this.history.push(historyItem);

    // Manage history size
    if (this.history.length > this.options.maxHistory) {
      this.history.shift();
    }
  }
}

/**
 * Convenience function to create a benchmark suite
 */
export function createBenchmarkSuite(
  id: string,
  name: string,
  description?: string
): BenchmarkSuite {
  return {
    id,
    name,
    description: description ?? '',
    benchmarks: [],
  };
}

/**
 * Convenience function to create a benchmark
 */
export function createBenchmark(
  id: string,
  name: string,
  fn: BenchmarkFn,
  options?: BenchmarkOptions
): Benchmark {
  return {
    id,
    name,
    fn,
    options: options ?? {},
  };
}

/**
 * Decorator to benchmark a method
 */
export function benchmark(name?: string, options?: BenchmarkOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const benchmarkName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const start = performance.now();
      const result = await originalMethod.apply(this, args);
      const end = performance.now();

      console.log(`[Benchmark] ${benchmarkName}: ${(end - start).toFixed(2)}ms`);

      return result;
    };

    return descriptor;
  };
}
