import { ExecutionResultData, CircuitMetrics } from '../types/index.js';

/**
 * Metrics collector for circuit breaker operations
 * Provides detailed analytics and performance tracking
 */
export class MetricsCollector {
  private circuitName: string;
  private enabled: boolean;
  private totalRequests: number;
  private successfulRequests: number;
  private failedRequests: number;
  private rejectedRequests: number;
  private timeoutRequests: number;
  private fallbackSuccesses: number;
  private fallbackFailures: number;
  private durations: number[];
  private timestamps: number[];
  private errorTypes: Map<string, number>;
  private startTime: number;

  constructor(circuitName: string, enabled: boolean = true) {
    this.circuitName = circuitName;
    this.enabled = enabled;
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.rejectedRequests = 0;
    this.timeoutRequests = 0;
    this.fallbackSuccesses = 0;
    this.fallbackFailures = 0;
    this.durations = [];
    this.timestamps = [];
    this.errorTypes = new Map();
    this.startTime = Date.now();
  }

  /**
   * Record an execution result
   */
  record<T>(result: ExecutionResultData<T>): void {
    if (!this.enabled) return;

    this.totalRequests++;

    switch (result.status) {
      case 'SUCCESS':
        this.successfulRequests++;
        break;
      case 'FAILURE':
        this.failedRequests++;
        this.recordError(result.error);
        break;
      case 'TIMEOUT':
        this.timeoutRequests++;
        this.recordError(result.error);
        break;
      case 'REJECTED':
        this.rejectedRequests++;
        break;
      case 'FALLBACK_SUCCESS':
        this.fallbackSuccesses++;
        break;
      case 'FALLBACK_FAILURE':
        this.fallbackFailures++;
        this.recordError(result.error);
        break;
    }

    this.durations.push(result.duration);
    this.timestamps.push(result.timestamp);

    // Keep only last 1000 durations to prevent memory issues
    if (this.durations.length > 1000) {
      this.durations.shift();
      this.timestamps.shift();
    }
  }

  /**
   * Record error type
   */
  private recordError(error?: Error): void {
    if (!error) return;

    const errorType = error.constructor.name;
    const count = this.errorTypes.get(errorType) || 0;
    this.errorTypes.set(errorType, count + 1);
  }

  /**
   * Get comprehensive metrics
   */
  getMetrics(): Partial<CircuitMetrics> {
    const errorRate = this.totalRequests > 0 ? (this.failedRequests / this.totalRequests) * 100 : 0;
    const averageDuration =
      this.durations.length > 0
        ? this.durations.reduce((sum, d) => sum + d, 0) / this.durations.length
        : 0;

    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      rejectedRequests: this.rejectedRequests,
      timeoutRequests: this.timeoutRequests,
      errorRate,
      averageDuration,
      p50Duration: this.getPercentile(50),
      p95Duration: this.getPercentile(95),
      p99Duration: this.getPercentile(99),
      slowCallRate: this.getSlowCallRate(),
    };
  }

  /**
   * Calculate percentile from durations
   */
  private getPercentile(percentile: number): number {
    if (this.durations.length === 0) return 0;

    const sorted = [...this.durations].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Calculate slow call rate (calls over 1 second)
   */
  private getSlowCallRate(): number {
    if (this.durations.length === 0) return 0;

    const slowCalls = this.durations.filter((d) => d > 1000).length;
    return (slowCalls / this.durations.length) * 100;
  }

  /**
   * Get error type distribution
   */
  getErrorDistribution(): Map<string, number> {
    return new Map(this.errorTypes);
  }

  /**
   * Get requests per second
   */
  getRequestsPerSecond(): number {
    if (this.timestamps.length === 0) return 0;

    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const recentRequests = this.timestamps.filter((t) => t >= oneSecondAgo).length;

    return recentRequests;
  }

  /**
   * Get uptime in milliseconds
   */
  getUptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.rejectedRequests = 0;
    this.timeoutRequests = 0;
    this.fallbackSuccesses = 0;
    this.fallbackFailures = 0;
    this.durations = [];
    this.timestamps = [];
    this.errorTypes.clear();
    this.startTime = Date.now();
  }

  /**
   * Restore metrics from snapshot
   */
  restore(metrics: CircuitMetrics): void {
    this.totalRequests = metrics.totalRequests;
    this.successfulRequests = metrics.successfulRequests;
    this.failedRequests = metrics.failedRequests;
    this.rejectedRequests = metrics.rejectedRequests;
    this.timeoutRequests = metrics.timeoutRequests;
  }

  /**
   * Get metrics summary
   */
  getSummary(): Record<string, unknown> {
    return {
      circuitName: this.circuitName,
      uptime: this.getUptime(),
      totalRequests: this.totalRequests,
      successRate:
        this.totalRequests > 0 ? (this.successfulRequests / this.totalRequests) * 100 : 0,
      errorRate: this.totalRequests > 0 ? (this.failedRequests / this.totalRequests) * 100 : 0,
      averageDuration:
        this.durations.length > 0
          ? this.durations.reduce((sum, d) => sum + d, 0) / this.durations.length
          : 0,
      requestsPerSecond: this.getRequestsPerSecond(),
      fallbackSuccessRate:
        this.fallbackSuccesses + this.fallbackFailures > 0
          ? (this.fallbackSuccesses / (this.fallbackSuccesses + this.fallbackFailures)) * 100
          : 0,
      errorTypes: Object.fromEntries(this.errorTypes),
    };
  }
}
