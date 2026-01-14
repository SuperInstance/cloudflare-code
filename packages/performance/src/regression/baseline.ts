/**
 * Performance Baseline Manager
 *
 * Manages performance baselines for regression detection
 */

import fs from 'fs/promises';
import path from 'path';
import type {
  PerformanceBaseline,
  BenchmarkResult,
  LoadTestResult,
} from '../types/index.js';

export interface BaselineConfig {
  storagePath: string;
  retainCount: number;
  autoSave: boolean;
}

export class BaselineManager {
  private config: BaselineConfig;
  private baselines: Map<string, PerformanceBaseline[]> = new Map();

  constructor(config?: Partial<BaselineConfig>) {
    this.config = {
      storagePath: './baselines',
      retainCount: 10,
      autoSave: true,
      ...config,
    };
  }

  /**
   * Create a new baseline
   */
  async createBaseline(
    name: string,
    benchmarks: BenchmarkResult[],
    loadTests: LoadTestResult[],
    metadata?: Record<string, any>
  ): Promise<PerformanceBaseline> {
    const baseline: PerformanceBaseline = {
      name,
      timestamp: Date.now(),
      metrics: this.extractMetrics(benchmarks, loadTests),
      benchmarks,
      loadTests,
      ...metadata,
    };

    // Store in memory
    this.addBaseline(name, baseline);

    // Save to disk if auto-save is enabled
    if (this.config.autoSave) {
      await this.saveBaseline(name, baseline);
    }

    return baseline;
  }

  /**
   * Extract key metrics from results
   */
  private extractMetrics(
    benchmarks: BenchmarkResult[],
    loadTests: LoadTestResult[]
  ): Record<string, number> {
    const metrics: Record<string, number> = {};

    // Extract benchmark metrics
    for (const bench of benchmarks) {
      metrics[`benchmark.${bench.name}.avgTime`] = bench.avgTime;
      metrics[`benchmark.${bench.name}.opsPerSecond`] = bench.opsPerSecond;
      metrics[`benchmark.${bench.name}.minTime`] = bench.minTime;
      metrics[`benchmark.${bench.name}.maxTime`] = bench.maxTime;
    }

    // Extract load test metrics
    for (const test of loadTests) {
      metrics[`loadtest.${test.name}.latency`] = test.latency.mean;
      metrics[`loadtest.${test.name}.throughput`] = test.throughput.mean;
      metrics[`loadtest.${test.name}.p95Latency`] = test.latency.percentile95;
      metrics[`loadtest.${test.name}.p99Latency`] = test.latency.percentile99;
      metrics[`loadtest.${test.name}.errorRate`] =
        (test.requests.failed / test.requests.total) * 100;
    }

    return metrics;
  }

  /**
   * Add baseline to memory store
   */
  private addBaseline(name: string, baseline: PerformanceBaseline): void {
    let baselines = this.baselines.get(name);
    if (!baselines) {
      baselines = [];
      this.baselines.set(name, baselines);
    }

    baselines.push(baseline);

    // Trim to retain count
    if (baselines.length > this.config.retainCount) {
      baselines.shift();
    }
  }

  /**
   * Get latest baseline
   */
  getBaseline(name: string): PerformanceBaseline | undefined {
    const baselines = this.baselines.get(name);
    return baselines?.[baselines.length - 1];
  }

  /**
   * Get all baselines for a name
   */
  getBaselines(name: string): PerformanceBaseline[] {
    return this.baselines.get(name) || [];
  }

  /**
   * Get baseline by timestamp
   */
  getBaselineAt(name: string, timestamp: number): PerformanceBaseline | undefined {
    const baselines = this.baselines.get(name);
    return baselines?.find((b) => b.timestamp === timestamp);
  }

  /**
   * Get baseline by commit
   */
  getBaselineByCommit(name: string, commit: string): PerformanceBaseline | undefined {
    const baselines = this.baselines.get(name);
    return baselines?.find((b) => b.commit === commit);
  }

  /**
   * Save baseline to disk
   */
  async saveBaseline(name: string, baseline: PerformanceBaseline): Promise<void> {
    const dir = path.join(this.config.storagePath, name);
    await fs.mkdir(dir, { recursive: true });

    const filename = `${baseline.timestamp}.json`;
    const filepath = path.join(dir, filename);

    await fs.writeFile(filepath, JSON.stringify(baseline, null, 2));

    // Update latest symlink
    const latestPath = path.join(dir, 'latest.json');
    try {
      await fs.unlink(latestPath);
    } catch {
      // Ignore if doesn't exist
    }
    await fs.symlink(filename, latestPath);
  }

  /**
   * Load baseline from disk
   */
  async loadBaseline(name: string, timestamp?: number): Promise<PerformanceBaseline | undefined> {
    const dir = path.join(this.config.storagePath, name);

    if (timestamp) {
      const filepath = path.join(dir, `${timestamp}.json`);
      try {
        const data = await fs.readFile(filepath, 'utf-8');
        const baseline = JSON.parse(data) as PerformanceBaseline;
        this.addBaseline(name, baseline);
        return baseline;
      } catch {
        return undefined;
      }
    } else {
      // Load latest
      const latestPath = path.join(dir, 'latest.json');
      try {
        const data = await fs.readFile(latestPath, 'utf-8');
        const baseline = JSON.parse(data) as PerformanceBaseline;
        this.addBaseline(name, baseline);
        return baseline;
      } catch {
        return undefined;
      }
    }
  }

  /**
   * Load all baselines for a name
   */
  async loadBaselines(name: string): Promise<PerformanceBaseline[]> {
    const dir = path.join(this.config.storagePath, name);
    const baselines: PerformanceBaseline[] = [];

    try {
      const files = await fs.readdir(dir);
      const jsonFiles = files.filter((f) => f.endsWith('.json') && f !== 'latest.json');

      for (const file of jsonFiles) {
        try {
          const filepath = path.join(dir, file);
          const data = await fs.readFile(filepath, 'utf-8');
          const baseline = JSON.parse(data) as PerformanceBaseline;
          baselines.push(baseline);
        } catch {
          // Skip invalid files
        }
      }

      // Sort by timestamp
      baselines.sort((a, b) => a.timestamp - b.timestamp);

      // Store in memory
      this.baselines.set(name, baselines);
    } catch {
      // Directory doesn't exist
    }

    return baselines;
  }

  /**
   * List all baseline names
   */
  async listBaselines(): Promise<string[]> {
    try {
      const dirs = await fs.readdir(this.config.storagePath);
      return dirs;
    } catch {
      return [];
    }
  }

  /**
   * Delete old baselines
   */
  async cleanupOldBaselines(name: string): Promise<void> {
    const baselines = this.baselines.get(name);
    if (!baselines || baselines.length <= this.config.retainCount) {
      return;
    }

    const toRemove = baselines.slice(0, baselines.length - this.config.retainCount);
    const dir = path.join(this.config.storagePath, name);

    for (const baseline of toRemove) {
      const filepath = path.join(dir, `${baseline.timestamp}.json`);
      try {
        await fs.unlink(filepath);
      } catch {
        // Ignore errors
      }
    }

    // Update memory
    this.baselines.set(
      name,
      baselines.slice(baselines.length - this.config.retainCount)
    );
  }

  /**
   * Export baseline to JSON
   */
  exportBaseline(name: string, timestamp?: number): string | undefined {
    const baseline = timestamp ? this.getBaselineAt(name, timestamp) : this.getBaseline(name);
    return baseline ? JSON.stringify(baseline, null, 2) : undefined;
  }

  /**
   * Import baseline from JSON
   */
  async importBaseline(name: string, json: string): Promise<PerformanceBaseline> {
    const baseline = JSON.parse(json) as PerformanceBaseline;
    this.addBaseline(name, baseline);

    if (this.config.autoSave) {
      await this.saveBaseline(name, baseline);
    }

    return baseline;
  }

  /**
   * Compare two baselines
   */
  compareBaselines(
    name: string,
    baseline1: number,
    baseline2: number
  ): BaselineComparison | undefined {
    const b1 = this.getBaselineAt(name, baseline1);
    const b2 = this.getBaselineAt(name, baseline2);

    if (!b1 || !b2) {
      return undefined;
    }

    const comparisons: MetricComparison[] = [];

    // Compare metrics
    for (const [key, value1] of Object.entries(b1.metrics)) {
      const value2 = b2.metrics[key];
      if (value2 !== undefined) {
        const change = ((value2 - value1) / value1) * 100;
        comparisons.push({
          metric: key,
          baseline: value1,
          current: value2,
          change,
          direction: value2 < value1 ? 'improvement' : 'regression',
        });
      }
    }

    return {
      baseline: b1,
      current: b2,
      comparisons,
      summary: {
        total: comparisons.length,
        improvements: comparisons.filter((c) => c.direction === 'improvement').length,
        regressions: comparisons.filter((c) => c.direction === 'regression').length,
      },
    };
  }

  /**
   * Get trend data for a metric
   */
  getTrend(name: string, metric: string): TrendData | undefined {
    const baselines = this.baselines.get(name);
    if (!baselines || baselines.length === 0) {
      return undefined;
    }

    const points: Array<{ timestamp: number; value: number }> = [];

    for (const baseline of baselines) {
      const value = baseline.metrics[metric];
      if (value !== undefined) {
        points.push({
          timestamp: baseline.timestamp,
          value,
        });
      }
    }

    if (points.length === 0) {
      return undefined;
    }

    // Calculate trend
    const first = points[0];
    const last = points[points.length - 1];
    const change = ((last.value - first.value) / first.value) * 100;

    return {
      metric,
      points,
      change,
      direction: change > 0 ? 'increasing' : change < 0 ? 'decreasing' : 'stable',
    };
  }
}

export interface BaselineComparison {
  baseline: PerformanceBaseline;
  current: PerformanceBaseline;
  comparisons: MetricComparison[];
  summary: {
    total: number;
    improvements: number;
    regressions: number;
  };
}

export interface MetricComparison {
  metric: string;
  baseline: number;
  current: number;
  change: number;
  direction: 'improvement' | 'regression';
}

export interface TrendData {
  metric: string;
  points: Array<{ timestamp: number; value: number }>;
  change: number;
  direction: 'increasing' | 'decreasing' | 'stable';
}

export default BaselineManager;
