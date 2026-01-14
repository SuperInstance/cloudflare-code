/**
 * Canary Monitor
 * Monitors canary deployment metrics and health
 */

import { CanaryConfig, CanaryMetrics, CanaryStage } from '../types';
import { Logger } from '../utils/logger';

export interface CanaryMonitorOptions {
  config: CanaryConfig;
  logger?: Logger;
}

export interface MetricSnapshot {
  timestamp: Date;
  baselineMetrics: DeploymentMetrics;
  canaryMetrics: DeploymentMetrics;
  comparison: MetricComparison;
}

export interface DeploymentMetrics {
  requests: number;
  errors: number;
  successRate: number;
  errorRate: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
}

export interface MetricComparison {
  requestDifference: number;
  errorDifference: number;
  responseTimeDifference: number;
  successRateDifference: number;
  isBetter: boolean;
  isWorse: boolean;
}

export class CanaryMonitor {
  private config: CanaryConfig;
  private logger: Logger;
  private metricSnapshots: MetricSnapshot[] = [];
  private baselineResponseTimes: number[] = [];
  private canaryResponseTimes: number[] = [];
  private baselineErrors: number = 0;
  private canaryErrors: number = 0;
  private baselineRequests: number = 0;
  private canaryRequests: number = 0;

  constructor(options: CanaryMonitorOptions) {
    this.config = options.config;
    this.logger = options.logger || new Logger({ component: 'CanaryMonitor' });
  }

  /**
   * Collect current canary metrics
   */
  async collectMetrics(): Promise<CanaryMetrics> {
    this.logger.debug('Collecting canary metrics');

    // Calculate metrics from collected data
    const metrics: CanaryMetrics = {
      requests: this.canaryRequests,
      errors: this.canaryErrors,
      successRate:
        this.canaryRequests > 0
          ? ((this.canaryRequests - this.canaryErrors) / this.canaryRequests) * 100
          : 100,
      errorRate:
        this.canaryRequests > 0
          ? (this.canaryErrors / this.canaryRequests) * 100
          : 0,
      averageResponseTime:
        this.canaryResponseTimes.length > 0
          ? this.canaryResponseTimes.reduce((a, b) => a + b, 0) / this.canaryResponseTimes.length
          : 0,
      healthScore: this.calculateHealthScore(),
    };

    return metrics;
  }

  /**
   * Record a request to baseline
   */
  recordBaselineRequest(success: boolean, responseTime: number): void {
    this.baselineRequests++;
    if (!success) {
      this.baselineErrors++;
    }
    this.baselineResponseTimes.push(responseTime);
  }

  /**
   * Record a request to canary
   */
  recordCanaryRequest(success: boolean, responseTime: number): void {
    this.canaryRequests++;
    if (!success) {
      this.canaryErrors++;
    }
    this.canaryResponseTimes.push(responseTime);
  }

  /**
   * Calculate health score
   */
  private calculateHealthScore(): number {
    const criteria = this.config.successCriteria;

    // Success rate score (0-40 points)
    const successRateScore =
      this.canaryRequests > 0
        ? Math.min(
            40,
            ((this.canaryRequests - this.canaryErrors) / this.canaryRequests) * 40
          )
        : 40;

    // Error rate score (0-30 points)
    const errorRate =
      this.canaryRequests > 0 ? (this.canaryErrors / this.canaryRequests) * 100 : 0;
    const errorRateScore = Math.max(0, 30 - errorRate * 3);

    // Response time score (0-30 points)
    const avgResponseTime =
      this.canaryResponseTimes.length > 0
        ? this.canaryResponseTimes.reduce((a, b) => a + b, 0) / this.canaryResponseTimes.length
        : 0;
    const responseTimeScore = Math.max(
      0,
      30 - (avgResponseTime / criteria.maxResponseTime) * 30
    );

    return Math.round(successRateScore + errorRateScore + responseTimeScore);
  }

  /**
   * Compare baseline vs canary metrics
   */
  compareMetrics(): MetricComparison | null {
    if (this.baselineRequests === 0 || this.canaryRequests === 0) {
      return null;
    }

    const baselineErrorRate = (this.baselineErrors / this.baselineRequests) * 100;
    const canaryErrorRate = (this.canaryErrors / this.canaryRequests) * 100;

    const baselineAvgResponseTime =
      this.baselineResponseTimes.length > 0
        ? this.baselineResponseTimes.reduce((a, b) => a + b, 0) / this.baselineResponseTimes.length
        : 0;
    const canaryAvgResponseTime =
      this.canaryResponseTimes.length > 0
        ? this.canaryResponseTimes.reduce((a, b) => a + b, 0) / this.canaryResponseTimes.length
        : 0;

    const errorDifference = canaryErrorRate - baselineErrorRate;
    const responseTimeDifference = canaryAvgResponseTime - baselineAvgResponseTime;

    // Determine if canary is better or worse
    const isBetter =
      errorDifference < -0.1 || responseTimeDifference < -10;
    const isWorse =
      errorDifference > 0.1 || responseTimeDifference > 10;

    return {
      requestDifference: this.canaryRequests - this.baselineRequests,
      errorDifference,
      responseTimeDifference,
      successRateDifference: (100 - canaryErrorRate) - (100 - baselineErrorRate),
      isBetter,
      isWorse,
    };
  }

  /**
   * Take a metric snapshot
   */
  async takeSnapshot(): Promise<MetricSnapshot> {
    const snapshot: MetricSnapshot = {
      timestamp: new Date(),
      baselineMetrics: {
        requests: this.baselineRequests,
        errors: this.baselineErrors,
        successRate:
          this.baselineRequests > 0
            ? ((this.baselineRequests - this.baselineErrors) / this.baselineRequests) * 100
            : 100,
        errorRate:
          this.baselineRequests > 0
            ? (this.baselineErrors / this.baselineRequests) * 100
            : 0,
        averageResponseTime:
          this.baselineResponseTimes.length > 0
            ? this.baselineResponseTimes.reduce((a, b) => a + b, 0) / this.baselineResponseTimes.length
            : 0,
        p95ResponseTime: this.calculatePercentile(this.baselineResponseTimes, 95),
        p99ResponseTime: this.calculatePercentile(this.baselineResponseTimes, 99),
      },
      canaryMetrics: {
        requests: this.canaryRequests,
        errors: this.canaryErrors,
        successRate:
          this.canaryRequests > 0
            ? ((this.canaryRequests - this.canaryErrors) / this.canaryRequests) * 100
            : 100,
        errorRate:
          this.canaryRequests > 0
            ? (this.canaryErrors / this.canaryRequests) * 100
            : 0,
        averageResponseTime:
          this.canaryResponseTimes.length > 0
            ? this.canaryResponseTimes.reduce((a, b) => a + b, 0) / this.canaryResponseTimes.length
            : 0,
        p95ResponseTime: this.calculatePercentile(this.canaryResponseTimes, 95),
        p99ResponseTime: this.calculatePercentile(this.canaryResponseTimes, 99),
      },
      comparison: this.compareMetrics() || {
        requestDifference: 0,
        errorDifference: 0,
        responseTimeDifference: 0,
        successRateDifference: 0,
        isBetter: false,
        isWorse: false,
      },
    };

    this.metricSnapshots.push(snapshot);

    // Keep only last 100 snapshots
    if (this.metricSnapshots.length > 100) {
      this.metricSnapshots.shift();
    }

    return snapshot;
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;

    return sorted[index] || 0;
  }

  /**
   * Get metric snapshots
   */
  getSnapshots(): MetricSnapshot[] {
    return [...this.metricSnapshots];
  }

  /**
   * Check for error spike
   */
  checkErrorSpike(): boolean {
    if (this.metricSnapshots.length < 2) {
      return false;
    }

    const recent = this.metricSnapshots.slice(-10);
    const older = this.metricSnapshots.slice(-20, -10);

    if (recent.length === 0 || older.length === 0) {
      return false;
    }

    const recentAvgErrorRate =
      recent.reduce((sum, s) => sum + s.canaryMetrics.errorRate, 0) / recent.length;
    const olderAvgErrorRate =
      older.reduce((sum, s) => sum + s.canaryMetrics.errorRate, 0) / older.length;

    const spikeThreshold = this.config.rollbackCriteria.errorSpikeThreshold;

    return recentAvgErrorRate - olderAvgErrorRate > spikeThreshold;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metricSnapshots = [];
    this.baselineResponseTimes = [];
    this.canaryResponseTimes = [];
    this.baselineErrors = 0;
    this.canaryErrors = 0;
    this.baselineRequests = 0;
    this.canaryRequests = 0;
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    const metrics = {
      baseline: {
        requests: this.baselineRequests,
        errors: this.baselineErrors,
        errorRate:
          this.baselineRequests > 0
            ? (this.baselineErrors / this.baselineRequests) * 100
            : 0,
        averageResponseTime:
          this.baselineResponseTimes.length > 0
            ? this.baselineResponseTimes.reduce((a, b) => a + b, 0) / this.baselineResponseTimes.length
            : 0,
      },
      canary: {
        requests: this.canaryRequests,
        errors: this.canaryErrors,
        errorRate:
          this.canaryRequests > 0
            ? (this.canaryErrors / this.canaryRequests) * 100
            : 0,
        averageResponseTime:
          this.canaryResponseTimes.length > 0
            ? this.canaryResponseTimes.reduce((a, b) => a + b, 0) / this.canaryResponseTimes.length
            : 0,
      },
      comparison: this.compareMetrics(),
      snapshots: this.metricSnapshots,
    };

    return JSON.stringify(metrics, null, 2);
  }
}
