/**
 * Performance Regression Detector
 *
 * Detects performance regressions by comparing current metrics with baselines
 */

import type {
  RegressionResult,
  Regression,
  PerformanceBaseline,
  BenchmarkResult,
  LoadTestResult,
  PerformanceTarget,
} from '../types/index.js';

export interface RegressionThresholds {
  critical: number; // Percentage degradation to consider critical
  high: number;
  medium: number;
  low: number;
}

export interface DetectionConfig {
  thresholds: RegressionThresholds;
  minSamples: number;
  confidenceLevel: number; // 0-1
  enableTrendAnalysis: boolean;
}

export class RegressionDetector {
  private config: DetectionConfig;

  constructor(config?: Partial<DetectionConfig>) {
    this.config = {
      thresholds: {
        critical: 50, // 50% degradation = critical
        high: 30,
        medium: 15,
        low: 5,
      },
      minSamples: 5,
      confidenceLevel: 0.95,
      enableTrendAnalysis: true,
      ...config,
    };
  }

  /**
   * Detect regressions between current and baseline
   */
  detectRegressions(
    baseline: PerformanceBaseline,
    current: PerformanceBaseline,
    targets?: PerformanceTarget[]
  ): RegressionResult {
    const regressions: Regression[] = [];

    // Compare benchmarks
    for (const currentBench of current.benchmarks) {
      const baselineBench = baseline.benchmarks.find(
        (b) => b.name === currentBench.name
      );

      if (baselineBench) {
        const regression = this.compareBenchmark(baselineBench, currentBench);
        if (regression) {
          regressions.push(regression);
        }
      }
    }

    // Compare load tests
    for (const currentLoadTest of current.loadTests) {
      const baselineLoadTest = baseline.loadTests.find(
        (l) => l.name === currentLoadTest.name
      );

      if (baselineLoadTest) {
        const testRegressions = this.compareLoadTest(baselineLoadTest, currentLoadTest);
        regressions.push(...testRegressions);
      }
    }

    // Compare custom metrics
    for (const [key, currentValue] of Object.entries(current.metrics)) {
      const baselineValue = baseline.metrics[key];
      if (baselineValue !== undefined) {
        const regression = this.compareMetric(key, baselineValue, currentValue);
        if (regression) {
          regressions.push(regression);
        }
      }
    }

    // Check against targets
    if (targets) {
      const targetRegressions = this.checkTargets(current, targets);
      regressions.push(...targetRegressions);
    }

    // Determine overall result
    const detected = regressions.length > 0;
    const severity = this.calculateOverallSeverity(regressions);

    return {
      detected,
      severity,
      regressions,
      baseline,
      current,
      timestamp: Date.now(),
    };
  }

  /**
   * Compare benchmark results
   */
  private compareBenchmark(
    baseline: BenchmarkResult,
    current: BenchmarkResult
  ): Regression | null {
    // For latency, lower is better
    const degradation = ((current.avgTime - baseline.avgTime) / baseline.avgTime) * 100;

    if (degradation > this.config.thresholds.low) {
      return {
        metric: `benchmark.${current.name}.avgTime`,
        baseline: baseline.avgTime,
        current: current.avgTime,
        degradation,
        threshold: this.config.thresholds.low,
        severity: this.getSeverity(degradation),
        confidence: this.calculateConfidence(baseline, current),
      };
    }

    return null;
  }

  /**
   * Compare load test results
   */
  private compareLoadTest(
    baseline: LoadTestResult,
    current: LoadTestResult
  ): Regression[] {
    const regressions: Regression[] = [];

    // Compare latency (lower is better)
    const latencyDegradation = ((current.latency.mean - baseline.latency.mean) / baseline.latency.mean) * 100;
    if (latencyDegradation > this.config.thresholds.low) {
      regressions.push({
        metric: `loadtest.${current.name}.latency`,
        baseline: baseline.latency.mean,
        current: current.latency.mean,
        degradation: latencyDegradation,
        threshold: this.config.thresholds.low,
        severity: this.getSeverity(latencyDegradation),
        confidence: 0.9,
      });
    }

    // Compare throughput (higher is better)
    const throughputDegradation = ((baseline.throughput.mean - current.throughput.mean) / baseline.throughput.mean) * 100;
    if (throughputDegradation > this.config.thresholds.low) {
      regressions.push({
        metric: `loadtest.${current.name}.throughput`,
        baseline: baseline.throughput.mean,
        current: current.throughput.mean,
        degradation: throughputDegradation,
        threshold: this.config.thresholds.low,
        severity: this.getSeverity(throughputDegradation),
        confidence: 0.9,
      });
    }

    // Compare error rate (lower is better)
    const baselineErrorRate = (baseline.requests.failed / baseline.requests.total) * 100;
    const currentErrorRate = (current.requests.failed / current.requests.total) * 100;
    const errorRateIncrease = currentErrorRate - baselineErrorRate;

    if (errorRateIncrease > 5) {
      regressions.push({
        metric: `loadtest.${current.name}.errorRate`,
        baseline: baselineErrorRate,
        current: currentErrorRate,
        degradation: errorRateIncrease,
        threshold: 5,
        severity: this.getSeverity(errorRateIncrease),
        confidence: 0.95,
      });
    }

    return regressions;
  }

  /**
   * Compare custom metrics
   */
  private compareMetric(
    name: string,
    baseline: number,
    current: number
  ): Regression | null {
    const degradation = ((current - baseline) / baseline) * 100;

    if (Math.abs(degradation) > this.config.thresholds.low) {
      return {
        metric: name,
        baseline,
        current,
        degradation,
        threshold: this.config.thresholds.low,
        severity: this.getSeverity(Math.abs(degradation)),
        confidence: 0.8,
      };
    }

    return null;
  }

  /**
   * Check if current results meet targets
   */
  private checkTargets(
    current: PerformanceBaseline,
    targets: PerformanceTarget[]
  ): Regression[] {
    const regressions: Regression[] = [];

    for (const target of targets) {
      // Check benchmark targets
      const bench = current.benchmarks.find((b) => b.name === target.metric);
      if (bench) {
        const value = bench.avgTime;
        const passed =
          target.direction === 'lower-is-better'
            ? value <= target.target * (1 + target.threshold / 100)
            : value >= target.target * (1 - target.threshold / 100);

        if (!passed) {
          regressions.push({
            metric: `target.${target.metric}`,
            baseline: target.target,
            current: value,
            degradation:
              target.direction === 'lower-is-better'
                ? ((value - target.target) / target.target) * 100
                : ((target.target - value) / target.target) * 100,
            threshold: target.threshold,
            severity: 'high',
            confidence: 1.0,
          });
        }
      }
    }

    return regressions;
  }

  /**
   * Calculate severity based on degradation
   */
  private getSeverity(degradation: number): 'critical' | 'high' | 'medium' | 'low' {
    if (degradation >= this.config.thresholds.critical) return 'critical';
    if (degradation >= this.config.thresholds.high) return 'high';
    if (degradation >= this.config.thresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Calculate overall severity
   */
  private calculateOverallSeverity(regressions: Regression[]): 'critical' | 'high' | 'medium' | 'low' {
    if (regressions.length === 0) return 'low';

    const hasCritical = regressions.some((r) => r.severity === 'critical');
    const hasHigh = regressions.some((r) => r.severity === 'high');
    const hasMedium = regressions.some((r) => r.severity === 'medium');

    if (hasCritical) return 'critical';
    if (hasHigh) return 'high';
    if (hasMedium) return 'medium';
    return 'low';
  }

  /**
   * Calculate confidence in regression
   */
  private calculateConfidence(
    baseline: BenchmarkResult,
    current: BenchmarkResult
  ): number {
    // Simple confidence based on sample sizes and variance
    const minSamples = Math.min(baseline.iterations, current.iterations);

    if (minSamples < this.config.minSamples) {
      return 0.5;
    }

    // Calculate coefficient of variation
    const baselineCV = baseline.stdDev / baseline.avgTime;
    const currentCV = current.stdDev / current.avgTime;
    const avgCV = (baselineCV + currentCV) / 2;

    // Lower CV = higher confidence
    return Math.max(0.5, 1 - avgCV);
  }

  /**
   * Generate regression report
   */
  generateReport(result: RegressionResult): string {
    let report = '# Performance Regression Report\n\n';
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Baseline:** ${new Date(result.baseline.timestamp).toISOString()}\n`;
    report += `**Current:** ${new Date(result.current.timestamp).toISOString()}\n\n`;

    if (!result.detected) {
      report += '✅ **No regressions detected!**\n\n';
      return report;
    }

    report += `⚠️ **Regressions Detected: ${result.regressions.length}**\n`;
    report += `**Severity:** ${result.severity.toUpperCase()}\n\n`;

    // Group by severity
    const bySeverity = result.regressions.reduce(
      (acc, r) => {
        if (!acc[r.severity]) {
          acc[r.severity] = [];
        }
        acc[r.severity].push(r);
        return acc;
      },
      {} as Record<string, Regression[]>
    );

    const severityOrder = ['critical', 'high', 'medium', 'low'];
    const emojis = { critical: '🚨', high: '⚠️', medium: '⚡', low: 'ℹ️' };

    for (const severity of severityOrder) {
      const regressions = bySeverity[severity];
      if (!regressions || regressions.length === 0) continue;

      report += `## ${emojis[severity as keyof typeof emojis]} ${severity.toUpperCase()} (${regressions.length})\n\n`;

      for (const regression of regressions) {
        report += `### ${regression.metric}\n\n`;
        report += `- **Baseline:** ${regression.baseline.toFixed(2)}\n`;
        report += `- **Current:** ${regression.current.toFixed(2)}\n`;
        report += `- **Degradation:** ${regression.degradation > 0 ? '+' : ''}${regression.degradation.toFixed(2)}%\n`;
        report += `- **Threshold:** ${regression.threshold}%\n`;
        report += `- **Confidence:** ${(regression.confidence * 100).toFixed(0)}%\n\n`;
      }
    }

    // Summary
    report += '## Summary\n\n';
    report += `- Total regressions: ${result.regressions.length}\n`;
    report += `- Critical: ${bySeverity.critical?.length || 0}\n`;
    report += `- High: ${bySeverity.high?.length || 0}\n`;
    report += `- Medium: ${bySeverity.medium?.length || 0}\n`;
    report += `- Low: ${bySeverity.low?.length || 0}\n\n`;

    return report;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): DetectionConfig {
    return { ...this.config };
  }
}

export default RegressionDetector;
