/**
 * Performance Analyzer - Metrics aggregation and regression detection
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  PerformanceMetrics,
  PerformanceBaseline,
  PerformanceRegression,
  PerformanceTrend,
  ProfilerEvent,
} from '../types';

export interface AnalyzerOptions {
  /**
   * Enable automatic regression detection
   */
  enableRegressionDetection?: boolean;

  /**
   * Regression threshold percentage
   */
  regressionThreshold?: number;

  /**
   * Minimum samples for regression detection
   */
  minSamples?: number;

  /**
   * Statistical significance level (0-1)
   */
  significanceLevel?: number;

  /**
   * Enable trend analysis
   */
  enableTrendAnalysis?: boolean;

  /**
   * Trend window size (number of samples)
   */
  trendWindowSize?: number;

  /**
   * Enable anomaly detection
   */
  enableAnomalyDetection?: boolean;

  /**
   * Anomaly threshold (standard deviations)
   */
  anomalyThreshold?: number;

  /**
   * Maximum baselines to keep
   */
  maxBaselines?: number;

  /**
   * Maximum metrics history to keep
   */
  maxHistory?: number;
}

export interface MetricStatistics {
  metric: string;
  count: number;
  mean: number;
  median: number;
  mode: number;
  stdDev: number;
  variance: number;
  min: number;
  max: number;
  percentile25: number;
  percentile75: number;
  percentile90: number;
  percentile95: number;
  percentile99: number;
}

export interface ComparisonResult {
  metric: string;
  baseline: number;
  current: number;
  delta: number;
  deltaPercent: number;
  improved: boolean;
  regressed: boolean;
  significant: boolean;
  confidence: number;
}

/**
 * Performance Analyzer implementation
 */
export class PerformanceAnalyzer extends EventEmitter {
  private baselines: Map<string, PerformanceBaseline> = new Map();
  private metricsHistory: PerformanceMetrics[] = [];
  private regressions: PerformanceRegression[] = [];
  private trends: Map<string, PerformanceTrend> = new Map();
  private options: Required<AnalyzerOptions>;

  constructor(options: AnalyzerOptions = {}) {
    super();
    this.options = {
      enableRegressionDetection: options.enableRegressionDetection ?? true,
      regressionThreshold: options.regressionThreshold ?? 10,
      minSamples: options.minSamples ?? 10,
      significanceLevel: options.significanceLevel ?? 0.05,
      enableTrendAnalysis: options.enableTrendAnalysis ?? true,
      trendWindowSize: options.trendWindowSize ?? 100,
      enableAnomalyDetection: options.enableAnomalyDetection ?? true,
      anomalyThreshold: options.anomalyThreshold ?? 3,
      maxBaselines: options.maxBaselines ?? 100,
      maxHistory: options.maxHistory ?? 10000,
    };
  }

  /**
   * Record performance metrics
   */
  public recordMetrics(metrics: PerformanceMetrics): void {
    this.metricsHistory.push(metrics);

    // Manage history size
    if (this.metricsHistory.length > this.options.maxHistory) {
      this.metricsHistory.shift();
    }

    // Perform analysis
    if (this.options.enableRegressionDetection) {
      this.detectRegressions(metrics);
    }

    if (this.options.enableTrendAnalysis) {
      this.analyzeTrends();
    }

    if (this.options.enableAnomalyDetection) {
      this.detectAnomalies(metrics);
    }
  }

  /**
   * Create a performance baseline
   */
  public createBaseline(
    name: string,
    metrics: PerformanceMetrics,
    metadata?: Record<string, unknown>
  ): PerformanceBaseline {
    const baseline: PerformanceBaseline = {
      id: uuidv4(),
      name,
      timestamp: Date.now(),
      metrics,
      metadata: metadata ?? {},
    };

    this.baselines.set(baseline.id, baseline);

    // Manage baseline count
    if (this.baselines.size > this.options.maxBaselines) {
      const oldest = Array.from(this.baselines.values())
        .sort((a, b) => a.timestamp - b.timestamp)[0];
      if (oldest) {
        this.baselines.delete(oldest.id);
      }
    }

    return baseline;
  }

  /**
   * Get baseline by ID
   */
  public getBaseline(id: string): PerformanceBaseline | undefined {
    return this.baselines.get(id);
  }

  /**
   * Get baseline by name
   */
  public getBaselineByName(name: string): PerformanceBaseline | undefined {
    return Array.from(this.baselines.values()).find((b) => b.name === name);
  }

  /**
   * Get all baselines
   */
  public getBaselines(): PerformanceBaseline[] {
    return Array.from(this.baselines.values());
  }

  /**
   * Compare current metrics against a baseline
   */
  public compareToBaseline(
    baselineId: string,
    current: PerformanceMetrics
  ): Map<string, ComparisonResult> {
    const baseline = this.baselines.get(baselineId);
    if (!baseline) {
      throw new Error(`Baseline not found: ${baselineId}`);
    }

    const results = new Map<string, ComparisonResult>();

    const compareValue = (metric: string, baselineValue: number, currentValue: number) => {
      const delta = currentValue - baselineValue;
      const deltaPercent = baselineValue !== 0 ? (delta / baselineValue) * 100 : 0;

      const improved = delta < 0 && Math.abs(deltaPercent) > this.options.regressionThreshold;
      const regressed = delta > 0 && deltaPercent > this.options.regressionThreshold;
      const significant = this.isSignificant(metric, baselineValue, currentValue);

      results.set(metric, {
        metric,
        baseline: baselineValue,
        current: currentValue,
        delta,
        deltaPercent,
        improved,
        regressed,
        significant,
        confidence: this.calculateConfidence(metric, baselineValue, currentValue),
      });
    };

    // Compare CPU metrics
    compareValue('cpu.usage', baseline.metrics.cpu.usage, current.cpu.usage);
    compareValue('cpu.userTime', baseline.metrics.cpu.userTime, current.cpu.userTime);
    compareValue('cpu.systemTime', baseline.metrics.cpu.systemTime, current.cpu.systemTime);

    // Compare memory metrics
    compareValue('memory.used', baseline.metrics.memory.used, current.metrics.memory.used);
    compareValue('memory.heapUsed', baseline.metrics.memory.heapUsed, current.metrics.memory.heapUsed);
    compareValue('memory.heapTotal', baseline.metrics.memory.heapTotal, current.metrics.memory.heapTotal);

    // Compare network metrics
    compareValue('network.latency', baseline.metrics.network.latency, current.metrics.network.latency);
    compareValue('network.errors', baseline.metrics.network.errors, current.metrics.network.errors);

    // Compare custom metrics
    for (const key of Object.keys(baseline.metrics.custom)) {
      const baselineValue = baseline.metrics.custom[key] as number;
      const currentValue = current.metrics.custom[key] as number;
      if (typeof currentValue === 'number') {
        compareValue(`custom.${key}`, baselineValue, currentValue);
      }
    }

    return results;
  }

  /**
   * Detect performance regressions
   */
  public detectRegressions(current: PerformanceMetrics): PerformanceRegression[] {
    if (this.metricsHistory.length < this.options.minSamples) {
      return [];
    }

    const newRegressions: PerformanceRegression[] = [];

    const detectRegression = (
      metric: string,
      value: number,
      baseline: number,
      severity: PerformanceRegression['severity']
    ) => {
      const delta = value - baseline;
      const deltaPercent = baseline !== 0 ? (delta / baseline) * 100 : 0;

      if (deltaPercent > this.options.regressionThreshold) {
        const regression: PerformanceRegression = {
          id: uuidv4(),
          timestamp: Date.now(),
          severity,
          metric,
          baseline,
          current: value,
          delta,
          deltaPercent,
          confidence: this.calculateConfidence(metric, baseline, value),
          description: this.generateRegressionDescription(metric, deltaPercent),
        };

        newRegressions.push(regression);
        this.regressions.push(regression);

        this.emit({
          type: 'regression-detected',
          timestamp: Date.now(),
          regression,
        } as ProfilerEvent);
      }
    };

    // Get baseline from recent history
    const baselineMetrics = this.calculateBaselineMetrics();
    if (!baselineMetrics) {
      return [];
    }

    // Detect CPU regressions
    detectRegression(
      'cpu.usage',
      current.cpu.usage,
      baselineMetrics.cpu.usage,
      current.cpu.usage > baselineMetrics.cpu.usage * 1.2 ? 'high' : 'medium'
    );

    // Detect memory regressions
    detectRegression(
      'memory.used',
      current.memory.used,
      baselineMetrics.memory.used,
      current.memory.used > baselineMetrics.memory.used * 1.5 ? 'critical' : 'high'
    );

    // Detect network regressions
    detectRegression(
      'network.latency',
      current.network.latency,
      baselineMetrics.network.latency,
      current.network.latency > baselineMetrics.network.latency * 2 ? 'critical' : 'high'
    );

    return newRegressions;
  }

  /**
   * Get all regressions
   */
  public getRegressions(): PerformanceRegression[] {
    return [...this.regressions];
  }

  /**
   * Get regressions by severity
   */
  public getRegressionsBySeverity(severity: PerformanceRegression['severity']): PerformanceRegression[] {
    return this.regressions.filter((r) => r.severity === severity);
  }

  /**
   * Analyze trends
   */
  public analyzeTrends(): Map<string, PerformanceTrend> {
    if (this.metricsHistory.length < this.options.minSamples) {
      return this.trends;
    }

    const window = this.metricsHistory.slice(-this.options.trendWindowSize);

    const analyzeTrend = (metric: string, getValue: (m: PerformanceMetrics) => number): PerformanceTrend => {
      const values = window.map(getValue);

      const slope = this.calculateSlope(values);
      const rSquared = this.calculateRSquared(values, slope);
      const significance = this.calculateSignificance(values);
      const direction = slope > 0.01 ? 'degrading' : slope < -0.01 ? 'improving' : 'stable';

      const trend: PerformanceTrend = {
        metric,
        direction,
        slope,
        rSquared,
        significance,
        prediction: this.predictNext(values, slope),
      };

      this.trends.set(metric, trend);
      return trend;
    };

    // Analyze CPU trends
    analyzeTrend('cpu.usage', (m) => m.cpu.usage);
    analyzeTrend('cpu.userTime', (m) => m.cpu.userTime);

    // Analyze memory trends
    analyzeTrend('memory.used', (m) => m.memory.used);
    analyzeTrend('memory.heapUsed', (m) => m.memory.heapUsed);

    // Analyze network trends
    analyzeTrend('network.latency', (m) => m.network.latency);

    return this.trends;
  }

  /**
   * Get trends
   */
  public getTrends(): Map<string, PerformanceTrend> {
    return new Map(this.trends);
  }

  /**
   * Detect anomalies in metrics
   */
  public detectAnomalies(current: PerformanceMetrics): string[] {
    if (this.metricsHistory.length < this.options.minSamples) {
      return [];
    }

    const anomalies: string[] = [];
    const threshold = this.options.anomalyThreshold;

    const detectAnomaly = (
      metric: string,
      value: number,
      getValue: (m: PerformanceMetrics) => number
    ) => {
      const values = this.metricsHistory.map(getValue);
      const stats = this.calculateStatistics(values);

      const zScore = stats.stdDev !== 0 ? (value - stats.mean) / stats.stdDev : 0;

      if (Math.abs(zScore) > threshold) {
        anomalies.push(metric);

        this.emit({
          type: 'threshold-exceeded',
          timestamp: Date.now(),
          metric,
          value,
          threshold: stats.mean + threshold * stats.stdDev,
        } as ProfilerEvent);
      }
    };

    detectAnomaly('cpu.usage', current.cpu.usage, (m) => m.cpu.usage);
    detectAnomaly('memory.used', current.memory.used, (m) => m.memory.used);
    detectAnomaly('network.latency', current.network.latency, (m) => m.network.latency);

    return anomalies;
  }

  /**
   * Calculate statistics for a metric
   */
  public calculateMetricStatistics(metric: string): MetricStatistics | null {
    const values = this.getMetricValues(metric);
    if (values.length === 0) {
      return null;
    }

    return this.calculateStatistics(values);
  }

  /**
   * Get statistics for all metrics
   */
  public getAllStatistics(): Map<string, MetricStatistics> {
    const statistics = new Map<string, MetricStatistics>();

    const metrics = [
      'cpu.usage',
      'cpu.userTime',
      'cpu.systemTime',
      'memory.used',
      'memory.heapUsed',
      'memory.heapTotal',
      'network.latency',
      'network.requests',
    ];

    for (const metric of metrics) {
      const stats = this.calculateMetricStatistics(metric);
      if (stats) {
        statistics.set(metric, stats);
      }
    }

    return statistics;
  }

  /**
   * Calculate performance score
   */
  public calculatePerformanceScore(metrics: PerformanceMetrics): number {
    let score = 100;

    // CPU score (0-30 points)
    if (metrics.cpu.usage > 80) score -= 30;
    else if (metrics.cpu.usage > 60) score -= 20;
    else if (metrics.cpu.usage > 40) score -= 10;

    // Memory score (0-30 points)
    const memoryUsagePercent = (metrics.memory.used / metrics.memory.total) * 100;
    if (memoryUsagePercent > 90) score -= 30;
    else if (memoryUsagePercent > 75) score -= 20;
    else if (memoryUsagePercent > 60) score -= 10;

    // Network score (0-20 points)
    if (metrics.network.latency > 1000) score -= 20;
    else if (metrics.network.latency > 500) score -= 15;
    else if (metrics.network.latency > 200) score -= 10;

    // Error rate score (0-20 points)
    const errorRate = metrics.network.errors / Math.max(metrics.network.requests, 1);
    if (errorRate > 0.1) score -= 20;
    else if (errorRate > 0.05) score -= 15;
    else if (errorRate > 0.01) score -= 10;

    return Math.max(0, score);
  }

  /**
   * Generate performance report
   */
  public generateReport(): {
    timestamp: number;
    score: number;
    statistics: Map<string, MetricStatistics>;
    trends: Map<string, PerformanceTrend>;
    regressions: PerformanceRegression[];
    recommendations: string[];
  } {
    const currentMetrics = this.metricsHistory[this.metricsHistory.length - 1];
    const score = currentMetrics ? this.calculatePerformanceScore(currentMetrics) : 100;
    const statistics = this.getAllStatistics();
    const trends = this.getTrends();
    const regressions = this.getRegressions();
    const recommendations = this.generateRecommendations();

    return {
      timestamp: Date.now(),
      score,
      statistics,
      trends,
      regressions,
      recommendations,
    };
  }

  /**
   * Clear analyzer state
   */
  public clear(): void {
    this.baselines.clear();
    this.metricsHistory = [];
    this.regressions = [];
    this.trends.clear();
  }

  /**
   * Calculate baseline metrics from history
   */
  private calculateBaselineMetrics(): PerformanceMetrics | null {
    if (this.metricsHistory.length < this.options.minSamples) {
      return null;
    }

    const window = this.metricsHistory.slice(-this.options.minSamples);

    const average = (getValue: (m: PerformanceMetrics) => number): number => {
      const sum = window.reduce((acc, m) => acc + getValue(m), 0);
      return sum / window.length;
    };

    return {
      timestamp: Date.now(),
      cpu: {
        usage: average((m) => m.cpu.usage),
        userTime: average((m) => m.cpu.userTime),
        systemTime: average((m) => m.cpu.systemTime),
        idleTime: average((m) => m.cpu.idleTime),
      },
      memory: {
        used: average((m) => m.memory.used),
        total: average((m) => m.memory.total),
        heapUsed: average((m) => m.memory.heapUsed),
        heapTotal: average((m) => m.memory.heapTotal),
        external: average((m) => m.memory.external),
      },
      network: {
        requests: average((m) => m.network.requests),
        bytesReceived: average((m) => m.network.bytesReceived),
        bytesSent: average((m) => m.network.bytesSent),
        errors: average((m) => m.network.errors),
        latency: average((m) => m.network.latency),
      },
      custom: {},
    };
  }

  /**
   * Test if difference is statistically significant
   */
  private isSignificant(metric: string, baseline: number, current: number): boolean {
    const values = this.getMetricValues(metric);
    if (values.length < this.options.minSamples) {
      return false;
    }

    const stats = this.calculateStatistics(values);
    const zScore = stats.stdDev !== 0 ? (current - baseline) / stats.stdDev : 0;

    return Math.abs(zScore) > 1.96; // 95% confidence
  }

  /**
   * Calculate confidence level
   */
  private calculateConfidence(metric: string, baseline: number, current: number): number {
    const values = this.getMetricValues(metric);
    if (values.length < this.options.minSamples) {
      return 0;
    }

    const stats = this.calculateStatistics(values);
    const zScore = stats.stdDev !== 0 ? (current - baseline) / stats.stdDev : 0;

    // Convert z-score to confidence (0-1)
    const confidence = Math.min(1, Math.abs(zScore) / 2);
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Get metric values from history
   */
  private getMetricValues(metric: string): number[] {
    const getValue = (m: PerformanceMetrics): number => {
      if (metric.startsWith('cpu.')) {
        return (m.cpu as any)[metric.substring(4)] as number;
      } else if (metric.startsWith('memory.')) {
        return (m.memory as any)[metric.substring(7)] as number;
      } else if (metric.startsWith('network.')) {
        return (m.network as any)[metric.substring(8)] as number;
      } else if (metric.startsWith('custom.')) {
        return (m.custom as any)[metric.substring(7)] as number;
      }
      return 0;
    };

    return this.metricsHistory.map(getValue);
  }

  /**
   * Calculate statistics for values
   */
  private calculateStatistics(values: number[]): MetricStatistics {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;

    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const mean = sum / n;

    const median = n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];

    const mode = this.calculateMode(sorted);

    const variance = sorted.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    const percentile = (p: number): number => sorted[Math.floor(n * p)];

    return {
      metric: '',
      count: n,
      mean,
      median,
      mode,
      stdDev,
      variance,
      min: sorted[0],
      max: sorted[n - 1],
      percentile25: percentile(0.25),
      percentile75: percentile(0.75),
      percentile90: percentile(0.90),
      percentile95: percentile(0.95),
      percentile99: percentile(0.99),
    };
  }

  /**
   * Calculate mode
   */
  private calculateMode(values: number[]): number {
    const frequency = new Map<number, number>();
    let maxFreq = 0;
    let mode = values[0];

    for (const value of values) {
      const freq = (frequency.get(value) ?? 0) + 1;
      frequency.set(value, freq);

      if (freq > maxFreq) {
        maxFreq = freq;
        mode = value;
      }
    }

    return mode;
  }

  /**
   * Calculate slope for trend analysis
   */
  private calculateSlope(values: number[]): number {
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (values[i] - yMean);
      denominator += Math.pow(i - xMean, 2);
    }

    return denominator !== 0 ? numerator / denominator : 0;
  }

  /**
   * Calculate R-squared for trend
   */
  private calculateRSquared(values: number[], slope: number): number {
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((a, b) => a + b, 0) / n;

    let ssTot = 0;
    let ssRes = 0;

    for (let i = 0; i < n; i++) {
      const yPred = yMean + slope * (i - xMean);
      ssTot += Math.pow(values[i] - yMean, 2);
      ssRes += Math.pow(values[i] - yPred, 2);
    }

    return ssTot !== 0 ? 1 - ssRes / ssTot : 0;
  }

  /**
   * Calculate statistical significance
   */
  private calculateSignificance(values: number[]): number {
    const n = values.length;
    const stats = this.calculateStatistics(values);
    const standardError = stats.stdDev / Math.sqrt(n);

    return standardError !== 0 ? Math.abs(stats.mean) / standardError : 0;
  }

  /**
   * Predict next value in trend
   */
  private predictNext(values: number[], slope: number): number[] {
    const predictions: number[] = [];
    const lastValue = values[values.length - 1];

    for (let i = 1; i <= 10; i++) {
      predictions.push(lastValue + slope * i);
    }

    return predictions;
  }

  /**
   * Generate regression description
   */
  private generateRegressionDescription(metric: string, deltaPercent: number): string {
    const direction = deltaPercent > 0 ? 'increased' : 'decreased';
    const severity = Math.abs(deltaPercent) > 50 ? 'significantly' : 'noticeably';

    return `${metric} has ${severity} ${direction} by ${Math.abs(deltaPercent).toFixed(2)}%`;
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Check trends
    for (const [metric, trend] of this.trends) {
      if (trend.direction === 'degrading' && trend.significance > 2) {
        recommendations.push(
          `Investigate ${metric}: showing ${trend.direction} trend (significance: ${trend.significance.toFixed(2)})`
        );
      }
    }

    // Check recent regressions
    const recentRegressions = this.regressions.slice(-10);
    for (const regression of recentRegressions) {
      if (regression.severity === 'critical' || regression.severity === 'high') {
        recommendations.push(
          `Address ${regression.metric}: ${regression.description}`
        );
      }
    }

    return recommendations;
  }
}

/**
 * Convenience function to create an analyzer
 */
export function createAnalyzer(options?: AnalyzerOptions): PerformanceAnalyzer {
  return new PerformanceAnalyzer(options);
}
