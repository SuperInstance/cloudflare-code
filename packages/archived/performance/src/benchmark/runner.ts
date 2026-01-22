/**
 * Benchmark Runner using TinyBench
 *
 * Provides comprehensive benchmarking capabilities
 */

import { Bench } from 'tinybench';
import type {
  BenchmarkResult,
  BenchmarkSuite,
  Benchmark,
  BenchmarkOptions,
  PerformanceMetrics,
} from '../types/index.js';
import { PerformanceProfiler } from '../profiler/profiler.js';

export class BenchmarkRunner {
  private suites: Map<string, BenchmarkSuite> = new Map();
  private results: Map<string, BenchmarkResult[]> = new Map();
  private profiler = new PerformanceProfiler({ enabled: true });

  /**
   * Register a benchmark suite
   */
  registerSuite(suite: BenchmarkSuite): void {
    this.suites.set(suite.name, suite);
  }

  /**
   * Register multiple suites
   */
  registerSuites(suites: BenchmarkSuite[]): void {
    for (const suite of suites) {
      this.registerSuite(suite);
    }
  }

  /**
   * Run a specific benchmark suite
   */
  async runSuite(suiteName: string): Promise<BenchmarkResult[]> {
    const suite = this.suites.get(suiteName);
    if (!suite) {
      throw new Error(`Benchmark suite not found: ${suiteName}`);
    }

    console.log(`\nRunning benchmark suite: ${suite.name}`);
    console.log(`Description: ${suite.description}\n`);

    // Setup
    if (suite.setup) {
      await suite.setup();
    }

    const results: BenchmarkResult[] = [];

    // Create tinybench instance
    const bench = new Bench({
      iterations: 1000,
      time: 5000,
      warmup: true,
      warmupIterations: 100,
    });

    // Add beforeAll hook
    if (suite.beforeAll) {
      bench.event('start', suite.beforeAll);
    }

    // Add benchmarks
    for (const benchmark of suite.benchmarks) {
      if (benchmark.skip) {
        console.log(`⊘ ${benchmark.name} (skipped)`);
        continue;
      }

      console.log(`⚡ ${benchmark.name}`);

      // Add benchmark to tinybench
      bench.add(benchmark.name, async () => {
        if (benchmark.beforeEach) {
          await benchmark.beforeEach();
        }

        await benchmark.fn();

        if (benchmark.afterEach) {
          await benchmark.afterEach();
        }
      }, benchmark.options);
    }

    // Add afterAll hook
    if (suite.afterAll) {
      bench.event('complete', suite.afterAll);
    }

    // Run benchmarks
    this.profiler.start();
    await bench.run();
    this.profiler.stop();

    // Process results
    const table = bench.table();
    for (const row of table) {
      const result: BenchmarkResult = {
        name: row['Task Name'] as string,
        suite: suiteName,
        iterations: row['ops'] as number,
        totalTime: row['Total Time (ms)'] as number,
        avgTime: row['Average Time (ms)'] as number,
        minTime: row['Min Time (ms)'] as number,
        maxTime: row['Max Time (ms)'] as number,
        stdDev: row['Std Deviation (ms)'] as number || 0,
        percentile95: row['p95'] as number || 0,
        percentile99: row['p99'] as number || 0,
        opsPerSecond: row['ops'] as number,
        samples: row['samples'] as number[] || [],
        metrics: this.profiler.getSummary() as any,
        timestamp: Date.now(),
      };

      results.push(result);

      console.log(`  ${result.avgTime.toFixed(4)}ms/op (${result.opsPerSecond.toFixed(0)} ops/s)`);
    }

    // Teardown
    if (suite.teardown) {
      await suite.teardown();
    }

    this.results.set(suiteName, results);
    this.profiler.clear();

    console.log(`\n✓ Benchmark suite completed: ${suiteName}\n`);

    return results;
  }

  /**
   * Run all registered suites
   */
  async runAll(): Promise<Map<string, BenchmarkResult[]>> {
    console.log('\n========================================');
    console.log('Running All Benchmark Suites');
    console.log('========================================\n');

    const allResults = new Map<string, BenchmarkResult[]>();

    for (const [name] of this.suites) {
      const results = await this.runSuite(name);
      allResults.set(name, results);
    }

    console.log('\n========================================');
    console.log('All Benchmark Suites Completed');
    console.log('========================================\n');

    return allResults;
  }

  /**
   * Compare two benchmark runs
   */
  compare(
    suiteName: string,
    baseline: BenchmarkResult[],
    current: BenchmarkResult[]
  ): ComparisonResult {
    const comparisons: BenchmarkComparison[] = [];

    for (const currentResult of current) {
      const baselineResult = baseline.find((b) => b.name === currentResult.name);

      if (baselineResult) {
        const improvement =
          ((baselineResult.avgTime - currentResult.avgTime) / baselineResult.avgTime) * 100;

        comparisons.push({
          name: currentResult.name,
          baseline: baselineResult.avgTime,
          current: currentResult.avgTime,
          improvement,
          isFaster: currentResult.avgTime < baselineResult.avgTime,
          significant: Math.abs(improvement) > 5, // 5% threshold
        });
      }
    }

    return {
      suite: suiteName,
      comparisons,
      summary: this.calculateComparisonSummary(comparisons),
    };
  }

  /**
   * Calculate comparison summary
   */
  private calculateComparisonSummary(comparisons: BenchmarkComparison[]): ComparisonSummary {
    const significant = comparisons.filter((c) => c.significant);
    const improvements = significant.filter((c) => c.isFaster);
    const regressions = significant.filter((c) => !c.isFaster);

    const avgImprovement =
      improvements.reduce((sum, c) => sum + c.improvement, 0) / Math.max(improvements.length, 1);

    return {
      total: comparisons.length,
      significant: significant.length,
      improvements: improvements.length,
      regressions: regressions.length,
      avgImprovement,
    };
  }

  /**
   * Get results for a suite
   */
  getResults(suiteName: string): BenchmarkResult[] | undefined {
    return this.results.get(suiteName);
  }

  /**
   * Get all results
   */
  getAllResults(): Map<string, BenchmarkResult[]> {
    return this.results;
  }

  /**
   * Clear all results
   */
  clearResults(): void {
    this.results.clear();
  }

  /**
   * Export results to JSON
   */
  exportResults(suiteName?: string): string {
    const results = suiteName
      ? this.getResults(suiteName)
      : Array.from(this.results.values()).flat();

    return JSON.stringify(results, null, 2);
  }

  /**
   * Generate markdown report
   */
  generateReport(suiteName?: string): string {
    const results = suiteName
      ? this.getResults(suiteName)
      : Array.from(this.results.values()).flat();

    if (!results || results.length === 0) {
      return '# Benchmark Report\n\nNo results to display.';
    }

    let report = '# Benchmark Report\n\n';
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Total Benchmarks:** ${results.length}\n\n`;

    // Summary table
    report += '## Summary\n\n';
    report += '| Benchmark | Time (ms/op) | Ops/sec | Min | Max | p95 | p99 |\n';
    report += '|-----------|--------------|---------|-----|-----|-----|-----|\n';

    for (const result of results) {
      report += `| ${result.name} | ${result.avgTime.toFixed(4)} | ${result.opsPerSecond.toFixed(0)} | ${result.minTime.toFixed(4)} | ${result.maxTime.toFixed(4)} | ${result.percentile95.toFixed(4)} | ${result.percentile99.toFixed(4)} |\n`;
    }

    report += '\n## Details\n\n';

    for (const result of results) {
      report += `### ${result.name}\n\n`;
      report += `- **Iterations:** ${result.iterations}\n`;
      report += `- **Total Time:** ${result.totalTime.toFixed(2)}ms\n`;
      report += `- **Average:** ${result.avgTime.toFixed(4)}ms\n`;
      report += `- **Std Dev:** ${result.stdDev.toFixed(4)}ms\n`;
      report += `- **Throughput:** ${result.opsPerSecond.toFixed(0)} ops/sec\n`;
      report += '\n';
    }

    return report;
  }
}

export interface BenchmarkComparison {
  name: string;
  baseline: number;
  current: number;
  improvement: number;
  isFaster: boolean;
  significant: boolean;
}

export interface ComparisonResult {
  suite: string;
  comparisons: BenchmarkComparison[];
  summary: ComparisonSummary;
}

export interface ComparisonSummary {
  total: number;
  significant: number;
  improvements: number;
  regressions: number;
  avgImprovement: number;
}

export default BenchmarkRunner;
