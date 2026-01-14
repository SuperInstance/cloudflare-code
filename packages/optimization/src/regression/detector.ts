/**
 * Performance Regression Detector
 *
 * Detects and alerts on performance regressions across builds
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { RegressionConfig, RegressionResult, PerformanceBaseline, RegressionIssue, Improvement, RegressionSummary, RegressionThresholds } from '../types/index.js';

export class RegressionDetector {
  private config: RegressionConfig;
  private baselines: Map<string, PerformanceBaseline> = new Map();

  constructor(config: Partial<RegressionConfig> = {}) {
    this.config = {
      baselinePath: './baselines',
      thresholds: {
        cpu: { warning: 0.1, critical: 0.2 },
        memory: { warning: 0.15, critical: 0.25 },
        latency: { warning: 0.1, critical: 0.2 },
        throughput: { warning: -0.1, critical: -0.15 },
        bundleSize: { warning: 0.1, critical: 0.2 },
      },
      alerting: {
        enabled: false,
        channels: [],
        recipients: [],
        webhookUrls: [],
      },
      historyRetention: 30,
      comparisonMethod: 'relative',
      ...config,
    };
  }

  /**
   * Load baseline from file
   */
  async loadBaseline(id: string): Promise<PerformanceBaseline | null> {
    try {
      const filePath = path.join(this.config.baselinePath, `${id}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const baseline = JSON.parse(content) as PerformanceBaseline;

      this.baselines.set(id, baseline);
      return baseline;
    } catch {
      return null;
    }
  }

  /**
   * Save baseline to file
   */
  async saveBaseline(baseline: PerformanceBaseline): Promise<void> {
    try {
      await fs.mkdir(this.config.baselinePath, { recursive: true });
      const filePath = path.join(this.config.baselinePath, `${baseline.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(baseline, null, 2));

      this.baselines.set(baseline.id, baseline);
    } catch (error) {
      console.error('Failed to save baseline:', error);
    }
  }

  /**
   * Create new baseline
   */
  createBaseline(id: string, metrics: PerformanceBaseline['metrics'], commit?: string): PerformanceBaseline {
    const baseline: PerformanceBaseline = {
      id,
      timestamp: Date.now(),
      commit: commit || 'unknown',
      metrics,
    };

    return baseline;
  }

  /**
   * Compare current metrics against baseline
   */
  compare(
    baselineId: string,
    currentMetrics: PerformanceBaseline['metrics']
  ): RegressionResult {
    const baseline = this.baselines.get(baselineId);

    if (!baseline) {
      throw new Error(`Baseline ${baselineId} not found`);
    }

    const regressions: RegressionIssue[] = [];
    const improvements: Improvement[] = [];

    // CPU comparison
    const cpuDelta = this.calculateDelta(baseline.metrics.cpu, currentMetrics.cpu);
    const cpuThreshold = this.config.thresholds.cpu;

    if (cpuDelta > cpuThreshold.critical) {
      regressions.push({
        metric: 'cpu',
        baseline: baseline.metrics.cpu,
        current: currentMetrics.cpu,
        delta: cpuDelta,
        deltaPercent: cpuDelta * 100,
        severity: 'critical',
        threshold: cpuThreshold.critical,
        description: `CPU usage increased by ${(cpuDelta * 100).toFixed(1)}% from baseline`,
      });
    } else if (cpuDelta > cpuThreshold.warning) {
      regressions.push({
        metric: 'cpu',
        baseline: baseline.metrics.cpu,
        current: currentMetrics.cpu,
        delta: cpuDelta,
        deltaPercent: cpuDelta * 100,
        severity: 'high',
        threshold: cpuThreshold.warning,
        description: `CPU usage increased by ${(cpuDelta * 100).toFixed(1)}% from baseline`,
      });
    } else if (cpuDelta < -cpuThreshold.warning) {
      improvements.push({
        metric: 'cpu',
        baseline: baseline.metrics.cpu,
        current: currentMetrics.cpu,
        delta: cpuDelta,
        deltaPercent: cpuDelta * 100,
        description: `CPU usage improved by ${Math.abs(cpuDelta * 100).toFixed(1)}%`,
      });
    }

    // Memory comparison
    const memoryDelta = this.calculateDelta(baseline.metrics.memory, currentMetrics.memory);
    const memoryThreshold = this.config.thresholds.memory;

    if (memoryDelta > memoryThreshold.critical) {
      regressions.push({
        metric: 'memory',
        baseline: baseline.metrics.memory,
        current: currentMetrics.memory,
        delta: memoryDelta,
        deltaPercent: memoryDelta * 100,
        severity: 'critical',
        threshold: memoryThreshold.critical,
        description: `Memory usage increased by ${(memoryDelta * 100).toFixed(1)}% from baseline`,
      });
    } else if (memoryDelta > memoryThreshold.warning) {
      regressions.push({
        metric: 'memory',
        baseline: baseline.metrics.memory,
        current: currentMetrics.memory,
        delta: memoryDelta,
        deltaPercent: memoryDelta * 100,
        severity: 'high',
        threshold: memoryThreshold.warning,
        description: `Memory usage increased by ${(memoryDelta * 100).toFixed(1)}% from baseline`,
      });
    } else if (memoryDelta < -memoryThreshold.warning) {
      improvements.push({
        metric: 'memory',
        baseline: baseline.metrics.memory,
        current: currentMetrics.memory,
        delta: memoryDelta,
        deltaPercent: memoryDelta * 100,
        description: `Memory usage improved by ${Math.abs(memoryDelta * 100).toFixed(1)}%`,
      });
    }

    // Latency comparison
    for (const percentile of ['p50', 'p95', 'p99'] as const) {
      const latencyDelta = this.calculateDelta(
        baseline.metrics.latency[percentile],
        currentMetrics.latency[percentile]
      );
      const latencyThreshold = this.config.thresholds.latency;

      if (latencyDelta > latencyThreshold.critical) {
        regressions.push({
          metric: `latency-${percentile}`,
          baseline: baseline.metrics.latency[percentile],
          current: currentMetrics.latency[percentile],
          delta: latencyDelta,
          deltaPercent: latencyDelta * 100,
          severity: 'critical',
          threshold: latencyThreshold.critical,
          description: `${percentile.toUpperCase()} latency increased by ${(latencyDelta * 100).toFixed(1)}% from baseline`,
        });
      } else if (latencyDelta > latencyThreshold.warning) {
        regressions.push({
          metric: `latency-${percentile}`,
          baseline: baseline.metrics.latency[percentile],
          current: currentMetrics.latency[percentile],
          delta: latencyDelta,
          deltaPercent: latencyDelta * 100,
          severity: 'medium',
          threshold: latencyThreshold.warning,
          description: `${percentile.toUpperCase()} latency increased by ${(latencyDelta * 100).toFixed(1)}% from baseline`,
        });
      } else if (latencyDelta < -latencyThreshold.warning) {
        improvements.push({
          metric: `latency-${percentile}`,
          baseline: baseline.metrics.latency[percentile],
          current: currentMetrics.latency[percentile],
          delta: latencyDelta,
          deltaPercent: latencyDelta * 100,
          description: `${percentile.toUpperCase()} latency improved by ${Math.abs(latencyDelta * 100).toFixed(1)}%`,
        });
      }
    }

    // Throughput comparison
    const throughputDelta = this.calculateDelta(baseline.metrics.throughput, currentMetrics.throughput);
    const throughputThreshold = this.config.thresholds.throughput;

    if (throughputDelta < throughputThreshold.critical) {
      regressions.push({
        metric: 'throughput',
        baseline: baseline.metrics.throughput,
        current: currentMetrics.throughput,
        delta: throughputDelta,
        deltaPercent: throughputDelta * 100,
        severity: 'critical',
        threshold: throughputThreshold.critical,
        description: `Throughput decreased by ${Math.abs(throughputDelta * 100).toFixed(1)}% from baseline`,
      });
    } else if (throughputDelta < throughputThreshold.warning) {
      regressions.push({
        metric: 'throughput',
        baseline: baseline.metrics.throughput,
        current: currentMetrics.throughput,
        delta: throughputDelta,
        deltaPercent: throughputDelta * 100,
        severity: 'medium',
        threshold: throughputThreshold.warning,
        description: `Throughput decreased by ${Math.abs(throughputDelta * 100).toFixed(1)}% from baseline`,
      });
    } else if (throughputDelta > -throughputThreshold.warning) {
      improvements.push({
        metric: 'throughput',
        baseline: baseline.metrics.throughput,
        current: currentMetrics.throughput,
        delta: throughputDelta,
        deltaPercent: throughputDelta * 100,
        description: `Throughput improved by ${(throughputDelta * 100).toFixed(1)}%`,
      });
    }

    // Bundle size comparison
    const bundleSizeDelta = this.calculateDelta(
      baseline.metrics.bundleSize.main,
      currentMetrics.bundleSize.main
    );
    const bundleSizeThreshold = this.config.thresholds.bundleSize;

    if (bundleSizeDelta > bundleSizeThreshold.critical) {
      regressions.push({
        metric: 'bundleSize',
        baseline: baseline.metrics.bundleSize.main,
        current: currentMetrics.bundleSize.main,
        delta: bundleSizeDelta,
        deltaPercent: bundleSizeDelta * 100,
        severity: 'high',
        threshold: bundleSizeThreshold.critical,
        description: `Bundle size increased by ${(bundleSizeDelta * 100).toFixed(1)}% from baseline`,
      });
    } else if (bundleSizeDelta > bundleSizeThreshold.warning) {
      regressions.push({
        metric: 'bundleSize',
        baseline: baseline.metrics.bundleSize.main,
        current: currentMetrics.bundleSize.main,
        delta: bundleSizeDelta,
        deltaPercent: bundleSizeDelta * 100,
        severity: 'medium',
        threshold: bundleSizeThreshold.warning,
        description: `Bundle size increased by ${(bundleSizeDelta * 100).toFixed(1)}% from baseline`,
      });
    } else if (bundleSizeDelta < -bundleSizeThreshold.warning) {
      improvements.push({
        metric: 'bundleSize',
        baseline: baseline.metrics.bundleSize.main,
        current: currentMetrics.bundleSize.main,
        delta: bundleSizeDelta,
        deltaPercent: bundleSizeDelta * 100,
        description: `Bundle size improved by ${Math.abs(bundleSizeDelta * 100).toFixed(1)}%`,
      });
    }

    // Generate summary
    const summary = this.generateSummary(regressions, improvements);

    return {
      detected: regressions.length > 0,
      severity: this.determineOverallSeverity(regressions),
      regressions,
      improvements,
      summary,
    };
  }

  /**
   * Calculate delta between baseline and current
   */
  private calculateDelta(baseline: number, current: number): number {
    if (this.config.comparisonMethod === 'absolute') {
      return current - baseline;
    }
    return (current - baseline) / baseline;
  }

  /**
   * Generate regression summary
   */
  private generateSummary(regressions: RegressionIssue[], improvements: Improvement[]): RegressionSummary {
    const criticalIssues = regressions.filter(r => r.severity === 'critical').length;
    const highIssues = regressions.filter(r => r.severity === 'high').length;
    const mediumIssues = regressions.filter(r => r.severity === 'medium').length;
    const lowIssues = regressions.filter(r => r.severity === 'low').length;

    let status: 'pass' | 'warn' | 'fail' = 'pass';
    if (criticalIssues > 0) {
      status = 'fail';
    } else if (highIssues > 0 || mediumIssues > 2) {
      status = 'warn';
    }

    return {
      totalIssues: regressions.length,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      totalImprovements: improvements.length,
      status,
    };
  }

  /**
   * Determine overall severity
   */
  private determineOverallSeverity(regressions: RegressionIssue[]): 'critical' | 'high' | 'medium' | 'low' {
    if (regressions.some(r => r.severity === 'critical')) {
      return 'critical';
    }
    if (regressions.some(r => r.severity === 'high')) {
      return 'high';
    }
    if (regressions.some(r => r.severity === 'medium')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Check for regressions and alert if configured
   */
  async checkAndAlert(baselineId: string, currentMetrics: PerformanceBaseline['metrics']): Promise<RegressionResult> {
    const result = this.compare(baselineId, currentMetrics);

    if (result.detected && this.config.alerting.enabled) {
      await this.sendAlerts(result);
    }

    return result;
  }

  /**
   * Send alerts
   */
  private async sendAlerts(result: RegressionResult): Promise<void> {
    // Alert implementation would go here
    console.error('Performance regression detected:', result.summary);
  }

  /**
   * Get baseline by ID
   */
  getBaseline(id: string): PerformanceBaseline | undefined {
    return this.baselines.get(id);
  }

  /**
   * Get all baselines
   */
  getAllBaselines(): Map<string, PerformanceBaseline> {
    return new Map(this.baselines);
  }

  /**
   * Delete baseline
   */
  async deleteBaseline(id: string): Promise<boolean> {
    try {
      const filePath = path.join(this.config.baselinePath, `${id}.json`);
      await fs.unlink(filePath);
      this.baselines.delete(id);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean old baselines
   */
  async cleanOldBaselines(): Promise<void> {
    const now = Date.now();
    const retentionMs = this.config.historyRetention * 24 * 60 * 60 * 1000;

    for (const [id, baseline] of this.baselines) {
      const age = now - baseline.timestamp;
      if (age > retentionMs) {
        await this.deleteBaseline(id);
      }
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RegressionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): RegressionConfig {
    return { ...this.config };
  }

  /**
   * Generate regression report
   */
  generateReport(result: RegressionResult): string {
    let report = '# Performance Regression Report\n\n';

    report += `**Status:** ${result.summary.status.toUpperCase()}\n`;
    report += `**Severity:** ${result.severity.toUpperCase()}\n\n`;

    if (result.regressions.length > 0) {
      report += '## Regressions\n\n';

      const bySeverity = new Map<'critical' | 'high' | 'medium' | 'low', RegressionIssue[]>();
      for (const regression of result.regressions) {
        if (!bySeverity.has(regression.severity)) {
          bySeverity.set(regression.severity, []);
        }
        bySeverity.get(regression.severity)!.push(regression);
      }

      for (const [severity, regs] of bySeverity) {
        report += `### ${severity.toUpperCase()} (${regs.length})\n\n`;
        for (const reg of regs) {
          report += `**${reg.metric}**\n`;
          report += `- Baseline: ${reg.baseline.toFixed(2)}\n`;
          report += `- Current: ${reg.current.toFixed(2)}\n`;
          report += `- Delta: ${reg.deltaPercent > 0 ? '+' : ''}${reg.deltaPercent.toFixed(1)}%\n`;
          report += `- ${reg.description}\n\n`;
        }
      }
    }

    if (result.improvements.length > 0) {
      report += '## Improvements\n\n';
      for (const imp of result.improvements) {
        report += `**${imp.metric}**\n`;
        report += `- ${imp.description}\n`;
        report += `- Delta: ${imp.deltaPercent > 0 ? '+' : ''}${imp.deltaPercent.toFixed(1)}%\n\n`;
      }
    }

    return report;
  }
}

export default RegressionDetector;
