/**
 * Performance Regression Detector - Automated regression detection with statistical analysis
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  PerformanceRegression,
  PerformanceMetrics,
  PerformanceBaseline,
  ProfilerEvent,
} from '../types';

export interface RegressionDetectorOptions {
  /**
   * Regression threshold percentage
   */
  threshold?: number;

  /**
   * Minimum number of samples for detection
   */
  minSamples?: number;

  /**
   * Statistical significance level (0-1)
   */
  significanceLevel?: number;

  /**
   * Enable automated detection
   */
  enableAutoDetection?: boolean;

  /**
   * Detection interval in milliseconds
   */
  detectionInterval?: number;

  /**
   * Alert on regression detection
   */
  enableAlerts?: boolean;

  /**
   * Metrics to monitor
   */
  monitoredMetrics?: string[];
}

export interface RegressionTest {
  id: string;
  name: string;
  metric: string;
  baseline: number;
  threshold: number;
  current?: number;
  regression?: PerformanceRegression;
}

export interface RegressionAlert {
  id: string;
  regression: PerformanceRegression;
  timestamp: number;
  acknowledged: boolean;
}

/**
 * Performance Regression Detector implementation
 */
export class RegressionDetector extends EventEmitter {
  private baselines: Map<string, PerformanceBaseline> = new Map();
  private currentMetrics: PerformanceMetrics[] = [];
  private regressions: PerformanceRegression[] = new Array();
  private tests: RegressionTest[] = [];
  private alerts: RegressionAlert[] = [];
  private options: Required<RegressionDetectorOptions>;
  private detectionTimer?: NodeJS.Timeout;

  constructor(options: RegressionDetectorOptions = {}) {
    super();
    this.options = {
      threshold: options.threshold ?? 10,
      minSamples: options.minSamples ?? 10,
      significanceLevel: options.significanceLevel ?? 0.05,
      enableAutoDetection: options.enableAutoDetection ?? true,
      detectionInterval: options.detectionInterval ?? 60000, // 1 minute
      enableAlerts: options.enableAlerts ?? true,
      monitoredMetrics: options.monitoredMetrics ?? [
        'cpu.usage',
        'cpu.userTime',
        'cpu.systemTime',
        'memory.used',
        'memory.heapUsed',
        'memory.heapTotal',
        'network.latency',
        'network.errors',
      ],
    };

    if (this.options.enableAutoDetection) {
      this.startAutoDetection();
    }
  }

  /**
   * Set performance baseline
   */
  public setBaseline(baseline: PerformanceBaseline): void {
    this.baselines.set(baseline.id, baseline);
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
   * Record current metrics
   */
  public recordMetrics(metrics: PerformanceMetrics): void {
    this.currentMetrics.push(metrics);

    // Keep only recent metrics
    if (this.currentMetrics.length > this.options.minSamples * 2) {
      this.currentMetrics.shift();
    }

    // Check for regressions
    if (this.currentMetrics.length >= this.options.minSamples) {
      this.detectRegressions();
    }
  }

  /**
   * Detect performance regressions
   */
  public detectRegressions(): PerformanceRegression[] {
    if (this.currentMetrics.length < this.options.minSamples) {
      return [];
    }

    const newRegressions: PerformanceRegression[] = [];

    // Get latest metrics
    const latest = this.currentMetrics[this.currentMetrics.length - 1];

    // Check against all baselines
    for (const baseline of this.baselines.values()) {
      const regressions = this.compareToBaseline(baseline, latest);
      newRegressions.push(...regressions);
    }

    // Also check against moving average
    const movingAverage = this.calculateMovingAverage();
    if (movingAverage) {
      const regressions = this.compareToMovingAverage(movingAverage, latest);
      newRegressions.push(...regressions);
    }

    // Add new regressions
    for (const regression of newRegressions) {
      this.regressions.push(regression);

      if (this.options.enableAlerts) {
        this.createAlert(regression);
      }

      this.emit({
        type: 'regression-detected',
        timestamp: Date.now(),
        regression,
      } as ProfilerEvent);
    }

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
   * Get regressions by metric
   */
  public getRegressionsByMetric(metric: string): PerformanceRegression[] {
    return this.regressions.filter((r) => r.metric === metric);
  }

  /**
   * Acknowledge a regression
   */
  public acknowledgeRegression(regressionId: string): void {
    const alert = this.alerts.find((a) => a.regression.id === regressionId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Get alerts
   */
  public getAlerts(): RegressionAlert[] {
    return [...this.alerts];
  }

  /**
   * Get unacknowledged alerts
   */
  public getUnacknowledgedAlerts(): RegressionAlert[] {
    return this.alerts.filter((a) => !a.acknowledged);
  }

  /**
   * Create a regression test
   */
  public createTest(
    name: string,
    metric: string,
    baseline: number,
    threshold?: number
  ): RegressionTest {
    const test: RegressionTest = {
      id: uuidv4(),
      name,
      metric,
      baseline,
      threshold: threshold ?? this.options.threshold,
    };

    this.tests.push(test);
    return test;
  }

  /**
   * Run regression tests
   */
  public runTests(): RegressionTest[] {
    if (this.currentMetrics.length === 0) {
      return [];
    }

    const latest = this.currentMetrics[this.currentMetrics.length - 1];

    for (const test of this.tests) {
      const currentValue = this.getMetricValue(latest, test.metric);
      test.current = currentValue;

      const delta = currentValue - test.baseline;
      const deltaPercent = test.baseline !== 0 ? (delta / test.baseline) * 100 : 0;

      if (deltaPercent > test.threshold) {
        test.regression = {
          id: uuidv4(),
          timestamp: Date.now(),
          severity: this.calculateSeverity(deltaPercent),
          metric: test.metric,
          baseline: test.baseline,
          current: currentValue,
          delta,
          deltaPercent,
          confidence: 0.9,
          description: `${test.name}: ${test.metric} exceeded threshold by ${deltaPercent.toFixed(2)}%`,
        };

        if (this.options.enableAlerts) {
          this.createAlert(test.regression);
        }
      } else {
        test.regression = undefined;
      }
    }

    return this.tests;
  }

  /**
   * Get test results
   */
  public getTestResults(): RegressionTest[] {
    return [...this.tests];
  }

  /**
   * Clear all regressions
   */
  public clearRegressions(): void {
    this.regressions = [];
  }

  /**
   * Clear all alerts
   */
  public clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Reset detector state
   */
  public reset(): void {
    this.currentMetrics = [];
    this.regressions = [];
    this.alerts = [];
  }

  /**
   * Start automatic detection
   */
  public startAutoDetection(): void {
    if (this.detectionTimer) {
      return;
    }

    this.detectionTimer = setInterval(() => {
      this.detectRegressions();
    }, this.options.detectionInterval);
  }

  /**
   * Stop automatic detection
   */
  public stopAutoDetection(): void {
    if (this.detectionTimer) {
      clearInterval(this.detectionTimer);
      this.detectionTimer = undefined;
    }
  }

  /**
   * Compare metrics against baseline
   */
  private compareToBaseline(
    baseline: PerformanceBaseline,
    current: PerformanceMetrics
  ): PerformanceRegression[] {
    const regressions: PerformanceRegression[] = [];

    const compareMetric = (
      metric: string,
      baselineValue: number,
      currentValue: number,
      severity: PerformanceRegression['severity']
    ) => {
      const delta = currentValue - baselineValue;
      const deltaPercent = baselineValue !== 0 ? (delta / baselineValue) * 100 : 0;

      if (deltaPercent > this.options.threshold) {
        regressions.push({
          id: uuidv4(),
          timestamp: Date.now(),
          severity,
          metric,
          baseline: baselineValue,
          current: currentValue,
          delta,
          deltaPercent,
          confidence: this.calculateConfidence(baselineValue, currentValue),
          description: `${metric} has degraded by ${deltaPercent.toFixed(2)}% compared to baseline "${baseline.name}"`,
        });
      }
    };

    // CPU metrics
    compareMetric(
      'cpu.usage',
      baseline.metrics.cpu.usage,
      current.cpu.usage,
      current.cpu.usage > baseline.metrics.cpu.usage * 1.3 ? 'high' : 'medium'
    );

    // Memory metrics
    compareMetric(
      'memory.used',
      baseline.metrics.memory.used,
      current.memory.used,
      current.memory.used > baseline.metrics.memory.used * 1.5 ? 'critical' : 'high'
    );

    // Network metrics
    compareMetric(
      'network.latency',
      baseline.metrics.network.latency,
      current.network.latency,
      current.network.latency > baseline.metrics.network.latency * 2 ? 'critical' : 'high'
    );

    compareMetric(
      'network.errors',
      baseline.metrics.network.errors,
      current.network.errors,
      current.network.errors > baseline.metrics.network.errors * 2 ? 'critical' : 'high'
    );

    // Custom metrics
    for (const [key, baselineValue] of Object.entries(baseline.metrics.custom)) {
      const currentValue = current.metrics.custom[key];
      if (typeof currentValue === 'number' && typeof baselineValue === 'number') {
        compareMetric(
          `custom.${key}`,
          baselineValue,
          currentValue,
          currentValue > baselineValue * 1.2 ? 'medium' : 'low'
        );
      }
    }

    return regressions;
  }

  /**
   * Compare metrics against moving average
   */
  private compareToMovingAverage(
    movingAverage: PerformanceMetrics,
    current: PerformanceMetrics
  ): PerformanceRegression[] {
    const regressions: PerformanceRegression[] = [];

    const compareMetric = (
      metric: string,
      avgValue: number,
      currentValue: number
    ) => {
      const delta = currentValue - avgValue;
      const deltaPercent = avgValue !== 0 ? (delta / avgValue) * 100 : 0;

      if (deltaPercent > this.options.threshold) {
        regressions.push({
          id: uuidv4(),
          timestamp: Date.now(),
          severity: this.calculateSeverity(deltaPercent),
          metric,
          baseline: avgValue,
          current: currentValue,
          delta,
          deltaPercent,
          confidence: this.calculateConfidence(avgValue, currentValue),
          description: `${metric} has degraded by ${deltaPercent.toFixed(2)}% compared to moving average`,
        });
      }
    };

    compareMetric('cpu.usage', movingAverage.cpu.usage, current.cpu.usage);
    compareMetric('memory.used', movingAverage.memory.used, current.memory.used);
    compareMetric('network.latency', movingAverage.network.latency, current.network.latency);

    return regressions;
  }

  /**
   * Calculate moving average of metrics
   */
  private calculateMovingAverage(): PerformanceMetrics | null {
    if (this.currentMetrics.length < this.options.minSamples) {
      return null;
    }

    const window = this.currentMetrics.slice(-this.options.minSamples);

    const average = (getValue: (m: PerformanceMetrics) => number): number => {
      return window.reduce((sum, m) => sum + getValue(m), 0) / window.length;
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
   * Get metric value from metrics object
   */
  private getMetricValue(metrics: PerformanceMetrics, metric: string): number {
    if (metric.startsWith('cpu.')) {
      return (metrics.cpu as any)[metric.substring(4)] as number;
    } else if (metric.startsWith('memory.')) {
      return (metrics.memory as any)[metric.substring(7)] as number;
    } else if (metric.startsWith('network.')) {
      return (metrics.network as any)[metric.substring(8)] as number;
    } else if (metric.startsWith('custom.')) {
      return (metrics.custom as any)[metric.substring(7)] as number;
    }
    return 0;
  }

  /**
   * Calculate regression severity
   */
  private calculateSeverity(deltaPercent: number): PerformanceRegression['severity'] {
    if (deltaPercent > 100) return 'critical';
    if (deltaPercent > 50) return 'high';
    if (deltaPercent > 20) return 'medium';
    return 'low';
  }

  /**
   * Calculate confidence level for regression
   */
  private calculateConfidence(baseline: number, current: number): number {
    // Simple confidence based on magnitude of regression
    const deltaPercent = baseline !== 0 ? ((current - baseline) / baseline) * 100 : 0;
    return Math.min(1, Math.abs(deltaPercent) / 50);
  }

  /**
   * Create alert for regression
   */
  private createAlert(regression: PerformanceRegression): void {
    const alert: RegressionAlert = {
      id: uuidv4(),
      regression,
      timestamp: Date.now(),
      acknowledged: false,
    };

    this.alerts.push(alert);
  }
}

/**
 * Convenience function to create a regression detector
 */
export function createRegressionDetector(
  options?: RegressionDetectorOptions
): RegressionDetector {
  return new RegressionDetector(options);
}

/**
 * Decorator to detect regressions in methods
 */
export function detectRegression(threshold?: number) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const timings: number[] = [];

    descriptor.value = async function (...args: any[]) {
      const start = performance.now();
      const result = await originalMethod.apply(this, args);
      const end = performance.now();
      const duration = end - start;

      timings.push(duration);

      // Keep only last 100 timings
      if (timings.length > 100) {
        timings.shift();
      }

      // Check for regression if we have enough samples
      if (timings.length >= 20) {
        const baseline = timings.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
        const current = timings.slice(-10).reduce((a, b) => a + b, 0) / 10;
        const regressionThreshold = threshold ?? 20;

        const deltaPercent = baseline !== 0 ? ((current - baseline) / baseline) * 100 : 0;

        if (deltaPercent > regressionThreshold) {
          console.warn(
            `[Regression Detected] ${target.constructor.name}.${propertyKey}: ` +
              `Performance degraded by ${deltaPercent.toFixed(2)}% ` +
              `(baseline: ${baseline.toFixed(2)}ms, current: ${current.toFixed(2)}ms)`
          );
        }
      }

      return result;
    };

    return descriptor;
  };
}
