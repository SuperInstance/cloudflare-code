/**
 * Real-time Performance Monitoring
 * Collects and analyzes performance metrics in real-time
 */

import {
  MetricData,
  PerformanceMetrics,
  ResponseTimeMetrics,
  ErrorMetrics,
  ResourceMetrics,
  TimeSeriesData,
  MetricAggregation,
} from '../types/index.js';

export class RealtimeMonitor {
  private metrics: Map<string, TimeSeriesData[]> = new Map();
  private aggregationWindow: number;
  private maxDataPoints: number;
  private alertThresholds: Map<string, AlertThreshold> = new Map();

  constructor(
    aggregationWindow: number = 60000, // 1 minute
    maxDataPoints: number = 1440 // 24 hours at minute granularity
  ) {
    this.aggregationWindow = aggregationWindow;
    this.maxDataPoints = maxDataPoints;
  }

  /**
   * Record a metric value
   */
  async recordMetric(metric: MetricData): Promise<void> {
    const key = this.getMetricKey(metric.name, metric.tags);

    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const data = this.metrics.get(key)!;
    data.push({
      timestamp: metric.timestamp,
      value: metric.value,
      tags: metric.tags,
    });

    // Keep only recent data points
    if (data.length > this.maxDataPoints) {
      data.shift();
    }

    // Check for alerts
    await this.checkAlerts(metric);
  }

  /**
   * Record multiple metrics in batch
   */
  async recordMetrics(metrics: MetricData[]): Promise<void> {
    await Promise.all(metrics.map(m => this.recordMetric(m)));
  }

  /**
   * Get current performance metrics
   */
  async getPerformanceMetrics(
    timeWindow?: number
  ): Promise<PerformanceMetrics> {
    const now = Date.now();
    const window = timeWindow || this.aggregationWindow;
    const startTime = now - window;

    return {
      requestRate: await this.getRequestRate(startTime),
      responseTime: await this.getResponseTimeMetrics(startTime),
      errorRate: await this.getErrorMetrics(startTime),
      throughput: await this.getThroughput(startTime),
      resourceUtilization: await this.getResourceMetrics(startTime),
    };
  }

  /**
   * Get time series data for a metric
   */
  async getTimeSeries(
    metricName: string,
    tags?: Record<string, string>,
    timeRange?: { start: number; end: number }
  ): Promise<TimeSeriesData[]> {
    const key = this.getMetricKey(metricName, tags || {});
    const data = this.metrics.get(key) || [];

    if (!timeRange) {
      return data;
    }

    return data.filter(
      d => d.timestamp >= timeRange.start && d.timestamp <= timeRange.end
    );
  }

  /**
   * Aggregate metrics
   */
  async aggregateMetrics(
    aggregations: MetricAggregation[],
    timeRange?: { start: number; end: number }
  ): Promise<Record<string, number>> {
    const results: Record<string, number> = {};

    for (const agg of aggregations) {
      const data = await this.getTimeSeries(
        agg.metric,
        agg.filter ? agg.filter : undefined,
        timeRange
      );

      let values = data.map(d => d.value);

      if (agg.groupBy && agg.filter) {
        values = values.filter(() => this.matchesGroupBy(agg.filter!, agg.groupBy!));
      }

      const result = this.computeAggregation(values, agg);
      results[`${agg.metric}_${agg.aggregation}`] = result;
    }

    return results;
  }

  /**
   * Get percentile values
   */
  async getPercentiles(
    metricName: string,
    percentiles: number[],
    timeWindow?: number
  ): Promise<Record<number, number>> {
    const now = Date.now();
    const startTime = now - (timeWindow || this.aggregationWindow);

    const data = await this.getTimeSeries(metricName, {}, { start: startTime, end: now });
    const values = data.map(d => d.value).sort((a, b) => a - b);

    const results: Record<number, number> = {};
    for (const p of percentiles) {
      const index = Math.floor((p / 100) * values.length);
      results[p] = values[index] || 0;
    }

    return results;
  }

  /**
   * Get rate metrics
   */
  async getRateMetrics(
    metricName: string,
    window: number
  ): Promise<{ current: number; average: number; peak: number }> {
    const now = Date.now();
    const startTime = now - window;

    const data = await this.getTimeSeries(metricName, {}, { start: startTime, end: now });

    // Calculate rate per second
    const count = data.length;
    const current = count / (window / 1000);

    // Calculate average over sub-windows
    const subWindows = 10;
    const subWindowSize = window / subWindows;
    const rates: number[] = [];

    for (let i = 0; i < subWindows; i++) {
      const subStart = startTime + (i * subWindowSize);
      const subEnd = subStart + subWindowSize;
      const subData = data.filter(d => d.timestamp >= subStart && d.timestamp < subEnd);
      rates.push(subData.length / (subWindowSize / 1000));
    }

    const average = rates.reduce((a, b) => a + b, 0) / rates.length;
    const peak = Math.max(...rates);

    return { current, average, peak };
  }

  /**
   * Detect anomalies in metrics
   */
  async detectAnomalies(
    metricName: string,
    threshold?: number
  ): Promise<Anomaly[]> {
    const now = Date.now();
    const window = this.aggregationWindow * 5; // Look at 5 windows
    const startTime = now - window;

    const data = await this.getTimeSeries(metricName, {}, { start: startTime, end: now });
    const values = data.map(d => d.value);

    const mean = this.mean(values);
    const std = this.standardDeviation(values, mean);
    const anomalyThreshold = threshold || 3; // 3 sigma

    const anomalies: Anomaly[] = [];
    for (const point of data) {
      const zScore = Math.abs((point.value - mean) / std);
      if (zScore > anomalyThreshold) {
        anomalies.push({
          timestamp: point.timestamp,
          value: point.value,
          expected: mean,
          deviation: point.value - mean,
          score: zScore,
          severity: zScore > 5 ? 'critical' : zScore > 4 ? 'warning' : 'info',
        });
      }
    }

    return anomalies;
  }

  /**
   * Set alert threshold for a metric
   */
  setAlertThreshold(
    metricName: string,
    threshold: AlertThreshold
  ): void {
    this.alertThresholds.set(metricName, threshold);
  }

  /**
   * Get metric statistics
   */
  async getMetricStatistics(
    metricName: string,
    timeWindow?: number
  ): Promise<MetricStatistics> {
    const now = Date.now();
    const startTime = now - (timeWindow || this.aggregationWindow);

    const data = await this.getTimeSeries(metricName, {}, { start: startTime, end: now });
    const values = data.map(d => d.value);

    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      mean: this.mean(values),
      median: this.median(values),
      std: this.standardDeviation(values, this.mean(values)),
      percentiles: await this.getPercentiles(metricName, [50, 95, 99], timeWindow),
      trend: this.calculateTrend(values),
    };
  }

  /**
   * Get correlation between two metrics
   */
  async getCorrelation(
    metric1: string,
    metric2: string,
    timeWindow?: number
  ): Promise<number> {
    const now = Date.now();
    const startTime = now - (timeWindow || this.aggregationWindow);

    const data1 = await this.getTimeSeries(metric1, {}, { start: startTime, end: now });
    const data2 = await this.getTimeSeries(metric2, {}, { start: startTime, end: now });

    // Align timestamps
    const aligned = this.alignTimeSeries(data1, data2);
    const values1 = aligned.map(d => d.value1);
    const values2 = aligned.map(d => d.value2);

    return this.pearsonCorrelation(values1, values2);
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const metrics = await this.getPerformanceMetrics();
    const anomalies = await this.detectAnomalies('response_time', 2);
    const errorRate = metrics.errorRate.rate;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const issues: string[] = [];

    if (errorRate > 0.05) {
      status = 'unhealthy';
      issues.push(`High error rate: ${(errorRate * 100).toFixed(2)}%`);
    } else if (errorRate > 0.01) {
      status = 'degraded';
      issues.push(`Elevated error rate: ${(errorRate * 100).toFixed(2)}%`);
    }

    if (metrics.responseTime.p99 > 5000) {
      status = 'unhealthy';
      issues.push(`P99 latency too high: ${metrics.responseTime.p99}ms`);
    } else if (metrics.responseTime.p95 > 2000) {
      status = status === 'healthy' ? 'degraded' : status;
      issues.push(`Elevated P95 latency: ${metrics.responseTime.p95}ms`);
    }

    if (anomalies.length > 10) {
      status = status === 'healthy' ? 'degraded' : status;
      issues.push(`${anomalies.length} anomalies detected in recent metrics`);
    }

    return {
      status,
      issues,
      metrics,
      timestamp: Date.now(),
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private getMetricKey(name: string, tags: Record<string, string>): string {
    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}:${tagStr}`;
  }

  private async getRequestRate(startTime: number): Promise<number> {
    const data = await this.getTimeSeries('request_count', {}, { start: startTime, end: Date.now() });
    return data.length / ((Date.now() - startTime) / 1000);
  }

  private async getResponseTimeMetrics(startTime: number): Promise<ResponseTimeMetrics> {
    const data = await this.getTimeSeries('response_time', {}, { start: startTime, end: Date.now() });
    const values = data.map(d => d.value).sort((a, b) => a - b);

    if (values.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0 };
    }

    return {
      p50: values[Math.floor(values.length * 0.5)],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
      avg: this.mean(values),
      min: values[0],
      max: values[values.length - 1],
    };
  }

  private async getErrorMetrics(startTime: number): Promise<ErrorMetrics> {
    const totalData = await this.getTimeSeries('error_total', {}, { start: startTime, end: Date.now() });
    const total = totalData.reduce((sum, d) => sum + d.value, 0);

    const requestData = await this.getTimeSeries('request_count', {}, { start: startTime, end: Date.now() });
    const requestCount = requestData.length;

    return {
      total,
      rate: requestCount > 0 ? total / requestCount : 0,
      byType: {}, // Would need separate metrics per error type
      criticalErrors: totalData.filter(d => d.tags?.severity === 'critical').length,
    };
  }

  private async getThroughput(startTime: number): Promise<number> {
    const data = await this.getTimeSeries('request_count', {}, { start: startTime, end: Date.now() });
    return data.length;
  }

  private async getResourceMetrics(startTime: number): Promise<ResourceMetrics> {
    const cpu = await this.getAverageMetric('cpu_usage', startTime);
    const memory = await this.getAverageMetric('memory_usage', startTime);
    const storage = await this.getAverageMetric('storage_usage', startTime);
    const network = await this.getAverageMetric('network_usage', startTime);

    return {
      cpu,
      memory,
      storage,
      network,
    };
  }

  private async getAverageMetric(metricName: string, startTime: number): Promise<number> {
    const data = await this.getTimeSeries(metricName, {}, { start: startTime, end: Date.now() });
    const values = data.map(d => d.value);
    return values.length > 0 ? this.mean(values) : 0;
  }

  private async checkAlerts(metric: MetricData): Promise<void> {
    const threshold = this.alertThresholds.get(metric.name);
    if (!threshold) return;

    if (threshold.operator === 'gt' && metric.value > threshold.value) {
      await this.triggerAlert(metric.name, metric.value, threshold);
    } else if (threshold.operator === 'lt' && metric.value < threshold.value) {
      await this.triggerAlert(metric.name, metric.value, threshold);
    } else if (threshold.operator === 'eq' && metric.value === threshold.value) {
      await this.triggerAlert(metric.name, metric.value, threshold);
    }
  }

  private async triggerAlert(
    metricName: string,
    value: number,
    threshold: AlertThreshold
  ): Promise<void> {
    // Implement alert triggering logic
    console.warn(`Alert triggered for ${metricName}: ${value} ${threshold.operator} ${threshold.value}`);
  }

  private matchesGroupBy(filter: Record<string, string>, groupBy: string[]): boolean {
    return groupBy.every(key => filter.hasOwnProperty(key));
  }

  private computeAggregation(values: number[], aggregation: MetricAggregation): number {
    if (values.length === 0) return 0;

    switch (aggregation.aggregation) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'avg':
        return this.mean(values);
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      case 'percentile':
        const sorted = values.sort((a, b) => a - b);
        const index = Math.floor(((aggregation.percentile || 50) / 100) * sorted.length);
        return sorted[index] || 0;
      default:
        return 0;
    }
  }

  private mean(values: number[]): number {
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  private median(values: number[]): number {
    const sorted = values.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private standardDeviation(values: number[], mean: number): number {
    const squareDiffs = values.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(this.mean(squareDiffs));
  }

  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = this.mean(firstHalf);
    const secondAvg = this.mean(secondHalf);

    const changePercent = Math.abs((secondAvg - firstAvg) / firstAvg) * 100;

    if (changePercent < 5) return 'stable';
    return secondAvg > firstAvg ? 'increasing' : 'decreasing';
  }

  private alignTimeSeries(
    data1: TimeSeriesData[],
    data2: TimeSeriesData[]
  ): Array<{ value1: number; value2: number }> {
    const map1 = new Map(data1.map(d => [d.timestamp, d.value]));
    const map2 = new Map(data2.map(d => [d.timestamp, d.value]));

    const timestamps = new Set([...map1.keys(), ...map2.keys()]);

    return Array.from(timestamps)
      .map(ts => {
        const v1 = map1.get(ts);
        const v2 = map2.get(ts);
        if (v1 !== undefined && v2 !== undefined) {
          return { value1: v1, value2: v2 };
        }
        return null;
      })
      .filter((v): v is { value1: number; value2: number } => v !== null);
  }

  private pearsonCorrelation(values1: number[], values2: number[]): number {
    if (values1.length !== values2.length || values1.length === 0) return 0;

    const mean1 = this.mean(values1);
    const mean2 = this.mean(values2);

    let numerator = 0;
    let sum1 = 0;
    let sum2 = 0;

    for (let i = 0; i < values1.length; i++) {
      const diff1 = values1[i] - mean1;
      const diff2 = values2[i] - mean2;
      numerator += diff1 * diff2;
      sum1 += diff1 * diff1;
      sum2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(sum1) * Math.sqrt(sum2);
    return denominator === 0 ? 0 : numerator / denominator;
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface AlertThreshold {
  operator: 'gt' | 'lt' | 'eq';
  value: number;
  severity: 'info' | 'warning' | 'critical';
  cooldown?: number;
}

export interface Anomaly {
  timestamp: number;
  value: number;
  expected: number;
  deviation: number;
  score: number;
  severity: 'info' | 'warning' | 'critical';
}

export interface MetricStatistics {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  std: number;
  percentiles: Record<number, number>;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  issues: string[];
  metrics: PerformanceMetrics;
  timestamp: number;
}
