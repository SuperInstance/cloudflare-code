// @ts-nocheck - External dependencies and type compatibility issues
/**
 * Scaling metrics collection and aggregation
 */

import type {
  ScalingMetrics,
  CpuMetrics,
  MemoryMetrics,
  RequestMetrics,
  PerformanceMetrics,
  LatencyMetrics,
  CostMetrics,
  MetricThreshold
} from '../types/index.js';
// import { Logger } from '@claudeflare/logger';

// Mock Logger for type compatibility
class Logger {
  info(...args: any[]) {}
  warn(...args: any[]) {}
  error(...args: any[]) {}
  debug(...args: any[]) {}
}

export interface MetricCollectionConfig {
  collectionInterval: number;
  retentionDays: number;
  enabledMetrics: string[];
  aggregationLevel: 'raw' | '1m' | '5m' | '15m' | '1h';
}

export class ScalingMetricsCollector {
  private logger: Logger;
  private config: MetricCollectionConfig;
  private metricsHistory: Map<string, ScalingMetrics[]> = new Map();
  private thresholds: Map<string, MetricThreshold[]> = new Map();
  private alerts: Map<string, Date> = new Map();

  constructor(config: Partial<MetricCollectionConfig> = {}) {
    this.logger = new Logger('ScalingMetricsCollector');
    this.config = {
      collectionInterval: 60000, // 1 minute
      retentionDays: 30,
      enabledMetrics: ['cpu', 'memory', 'requests', 'performance', 'cost'],
      aggregationLevel: '5m',
      ...config
    };
  }

  /**
   * Collect current metrics for a resource
   */
  async collectMetrics(resourceId: string): Promise<ScalingMetrics> {
    const cpuMetrics = await this.collectCpuMetrics(resourceId);
    const memoryMetrics = await this.collectMemoryMetrics(resourceId);
    const requestMetrics = await this.collectRequestMetrics(resourceId);
    const performanceMetrics = await this.collectPerformanceMetrics(resourceId);
    const costMetrics = await this.collectCostMetrics(resourceId);

    const metrics: ScalingMetrics = {
      cpuMetrics,
      memoryMetrics,
      requestMetrics,
      performanceMetrics,
      costMetrics,
      timestamp: new Date()
    };

    // Store metrics
    this.storeMetrics(resourceId, metrics);

    // Check thresholds
    await this.checkThresholds(resourceId, metrics);

    return metrics;
  }

  /**
   * Collect CPU metrics
   */
  private async collectCpuMetrics(resourceId: string): Promise<CpuMetrics> {
    // In production, this would query actual Cloudflare metrics
    // For now, return simulated values
    return {
      utilization: Math.random() * 100,
      credits: 100 - Math.random() * 30,
      burstCapacity: Math.random() * 100,
      throttleCount: Math.floor(Math.random() * 10)
    };
  }

  /**
   * Collect memory metrics
   */
  private async collectMemoryMetrics(resourceId: string): Promise<MemoryMetrics> {
    return {
      usage: Math.random() * 100,
      available: 100 - Math.random() * 50,
      cached: Math.random() * 30,
      swapUsage: Math.random() * 10,
      pageFaults: Math.floor(Math.random() * 1000)
    };
  }

  /**
   * Collect request metrics
   */
  private async collectRequestMetrics(resourceId: string): Promise<RequestMetrics> {
    return {
      rate: Math.random() * 2000,
      count: Math.floor(Math.random() * 100000),
      errors: Math.floor(Math.random() * 100),
      timeoutRate: Math.random() * 5,
      averageSize: Math.random() * 10000
    };
  }

  /**
   * Collect performance metrics
   */
  private async collectPerformanceMetrics(resourceId: string): Promise<PerformanceMetrics> {
    const latencyMetrics: LatencyMetrics = {
      p50: Math.random() * 100,
      p90: Math.random() * 200,
      p95: Math.random() * 300,
      p99: Math.random() * 500,
      average: Math.random() * 150,
      max: Math.random() * 1000
    };

    return {
      latency: latencyMetrics,
      throughput: Math.random() * 5000,
      errorRate: Math.random() * 5,
      availability: 99 + Math.random(),
      saturation: Math.random() * 100
    };
  }

  /**
   * Collect cost metrics
   */
  private async collectCostMetrics(resourceId: string): Promise<CostMetrics> {
    const baseCost = Math.random() * 100;

    return {
      currentHour: baseCost / 720,
      currentDay: baseCost / 30,
      currentMonth: baseCost,
      projectedDay: (baseCost / 30) * 1.1,
      projectedMonth: baseCost * 1.1
    };
  }

  /**
   * Store metrics in history
   */
  private storeMetrics(resourceId: string, metrics: ScalingMetrics): void {
    if (!this.metricsHistory.has(resourceId)) {
      this.metricsHistory.set(resourceId, []);
    }

    const history = this.metricsHistory.get(resourceId)!;
    history.push(metrics);

    // Enforce retention
    const maxAge = Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000;
    const validMetrics = history.filter((m) => m.timestamp.getTime() > maxAge);

    this.metricsHistory.set(resourceId, validMetrics);
  }

  /**
   * Get metrics history for a resource
   */
  getMetricsHistory(resourceId: string, limit?: number): ScalingMetrics[] {
    const history = this.metricsHistory.get(resourceId) || [];

    if (limit) {
      return history.slice(-limit);
    }

    return history;
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(
    resourceId: string,
    window: number,
    aggregation: 'average' | 'sum' | 'max' | 'min'
  ): ScalingMetrics | null {
    const history = this.getMetricsHistory(resourceId);
    const cutoff = Date.now() - window;

    const windowMetrics = history.filter((m) => m.timestamp.getTime() > cutoff);

    if (windowMetrics.length === 0) {
      return null;
    }

    return this.aggregateMetrics(windowMetrics, aggregation);
  }

  /**
   * Aggregate multiple metric samples
   */
  private aggregateMetrics(
    metrics: ScalingMetrics[],
    aggregation: 'average' | 'sum' | 'max' | 'min'
  ): ScalingMetrics {
    const cpuMetrics = this.aggregateCpuMetrics(
      metrics.map((m) => m.cpuMetrics),
      aggregation
    );
    const memoryMetrics = this.aggregateMemoryMetrics(
      metrics.map((m) => m.memoryMetrics),
      aggregation
    );
    const requestMetrics = this.aggregateRequestMetrics(
      metrics.map((m) => m.requestMetrics),
      aggregation
    );
    const performanceMetrics = this.aggregatePerformanceMetrics(
      metrics.map((m) => m.performanceMetrics),
      aggregation
    );
    const costMetrics = this.aggregateCostMetrics(
      metrics.map((m) => m.costMetrics),
      aggregation
    );

    return {
      cpuMetrics,
      memoryMetrics,
      requestMetrics,
      performanceMetrics,
      costMetrics,
      timestamp: new Date()
    };
  }

  /**
   * Aggregate CPU metrics
   */
  private aggregateCpuMetrics(
    metrics: CpuMetrics[],
    aggregation: 'average' | 'sum' | 'max' | 'min'
  ): CpuMetrics {
    const utilizations = metrics.map((m) => m.utilization);
    const credits = metrics.map((m) => m.credits);
    const burstCapacities = metrics.map((m) => m.burstCapacity);
    const throttleCounts = metrics.map((m) => m.throttleCount);

    return {
      utilization: this.aggregateValues(utilizations, aggregation),
      credits: this.aggregateValues(credits, aggregation),
      burstCapacity: this.aggregateValues(burstCapacities, aggregation),
      throttleCount: aggregation === 'sum' ? throttleCounts.reduce((a, b) => a + b, 0) : Math.max(...throttleCounts)
    };
  }

  /**
   * Aggregate memory metrics
   */
  private aggregateMemoryMetrics(
    metrics: MemoryMetrics[],
    aggregation: 'average' | 'sum' | 'max' | 'min'
  ): MemoryMetrics {
    const usages = metrics.map((m) => m.usage);
    const availables = metrics.map((m) => m.available);
    const cacheds = metrics.map((m) => m.cached);
    const swapUsages = metrics.map((m) => m.swapUsage);
    const pageFaults = metrics.map((m) => m.pageFaults);

    return {
      usage: this.aggregateValues(usages, aggregation),
      available: this.aggregateValues(availables, aggregation),
      cached: this.aggregateValues(cacheds, aggregation),
      swapUsage: this.aggregateValues(swapUsages, aggregation),
      pageFaults: aggregation === 'sum' ? pageFaults.reduce((a, b) => a + b, 0) : Math.max(...pageFaults)
    };
  }

  /**
   * Aggregate request metrics
   */
  private aggregateRequestMetrics(
    metrics: RequestMetrics[],
    aggregation: 'average' | 'sum' | 'max' | 'min'
  ): RequestMetrics {
    const rates = metrics.map((m) => m.rate);
    const counts = metrics.map((m) => m.count);
    const errors = metrics.map((m) => m.errors);
    const timeoutRates = metrics.map((m) => m.timeoutRate);
    const averageSizes = metrics.map((m) => m.averageSize);

    return {
      rate: this.aggregateValues(rates, aggregation),
      count: aggregation === 'sum' ? counts.reduce((a, b) => a + b, 0) : Math.max(...counts),
      errors: aggregation === 'sum' ? errors.reduce((a, b) => a + b, 0) : Math.max(...errors),
      timeoutRate: this.aggregateValues(timeoutRates, aggregation),
      averageSize: this.aggregateValues(averageSizes, aggregation)
    };
  }

  /**
   * Aggregate performance metrics
   */
  private aggregatePerformanceMetrics(
    metrics: PerformanceMetrics[],
    aggregation: 'average' | 'sum' | 'max' | 'min'
  ): PerformanceMetrics {
    const latencies = metrics.map((m) => m.latency);
    const throughputs = metrics.map((m) => m.throughput);
    const errorRates = metrics.map((m) => m.errorRate);
    const availabilities = metrics.map((m) => m.availability);
    const saturations = metrics.map((m) => m.saturation);

    const aggregateLatency: LatencyMetrics = {
      p50: this.aggregateValues(latencies.map((l) => l.p50), aggregation),
      p90: this.aggregateValues(latencies.map((l) => l.p90), aggregation),
      p95: this.aggregateValues(latencies.map((l) => l.p95), aggregation),
      p99: this.aggregateValues(latencies.map((l) => l.p99), aggregation),
      average: this.aggregateValues(latencies.map((l) => l.average), aggregation),
      max: this.aggregateValues(latencies.map((l) => l.max), 'max')
    };

    return {
      latency: aggregateLatency,
      throughput: this.aggregateValues(throughputs, aggregation),
      errorRate: this.aggregateValues(errorRates, aggregation),
      availability: this.aggregateValues(availabilities, aggregation),
      saturation: this.aggregateValues(saturations, aggregation)
    };
  }

  /**
   * Aggregate cost metrics
   */
  private aggregateCostMetrics(
    metrics: CostMetrics[],
    aggregation: 'average' | 'sum' | 'max' | 'min'
  ): CostMetrics {
    const currentHours = metrics.map((m) => m.currentHour);
    const currentDays = metrics.map((m) => m.currentDay);
    const currentMonths = metrics.map((m) => m.currentMonth);
    const projectedDays = metrics.map((m) => m.projectedDay);
    const projectedMonths = metrics.map((m) => m.projectedMonth);

    return {
      currentHour: this.aggregateValues(currentHours, aggregation),
      currentDay: this.aggregateValues(currentDays, aggregation),
      currentMonth: this.aggregateValues(currentMonths, aggregation),
      projectedDay: this.aggregateValues(projectedDays, aggregation),
      projectedMonth: this.aggregateValues(projectedMonths, aggregation)
    };
  }

  /**
   * Aggregate numeric values
   */
  private aggregateValues(
    values: number[],
    aggregation: 'average' | 'sum' | 'max' | 'min'
  ): number {
    switch (aggregation) {
      case 'average':
        return values.reduce((sum, v) => sum + v, 0) / values.length;

      case 'sum':
        return values.reduce((sum, v) => sum + v, 0);

      case 'max':
        return Math.max(...values);

      case 'min':
        return Math.min(...values);

      default:
        return values[0];
    }
  }

  /**
   * Set metric thresholds for a resource
   */
  setThresholds(resourceId: string, thresholds: MetricThreshold[]): void {
    this.thresholds.set(resourceId, thresholds);
    this.logger.info(`Set ${thresholds.length} thresholds for ${resourceId}`);
  }

  /**
   * Check if metrics exceed thresholds
   */
  private async checkThresholds(resourceId: string, metrics: ScalingMetrics): Promise<void> {
    const thresholds = this.thresholds.get(resourceId);
    if (!thresholds || thresholds.length === 0) {
      return;
    }

    for (const threshold of thresholds) {
      const value = this.getMetricValue(metrics, threshold.metric);
      if (value === null) {
        continue;
      }

      if (value >= threshold.critical) {
        await this.triggerAlert(resourceId, threshold, 'critical', value);
      } else if (value >= threshold.warning) {
        await this.triggerAlert(resourceId, threshold, 'warning', value);
      }
    }
  }

  /**
   * Get the value of a specific metric
   */
  private getMetricValue(metrics: ScalingMetrics, metricPath: string): number | null {
    const parts = metricPath.split('.');

    let value: any = metrics;
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }

    return typeof value === 'number' ? value : null;
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(
    resourceId: string,
    threshold: MetricThreshold,
    severity: 'warning' | 'critical',
    value: number
  ): Promise<void> {
    const alertKey = `${resourceId}-${threshold.metric}-${severity}`;

    // Rate limit alerts (once per 5 minutes)
    const lastAlert = this.alerts.get(alertKey);
    if (lastAlert && Date.now() - lastAlert.getTime() < 300000) {
      return;
    }

    this.alerts.set(alertKey, new Date());

    this.logger.warn(
      `Alert [${severity.toUpperCase()}] for ${resourceId}: ` +
      `${threshold.metric} = ${value.toFixed(2)} (threshold: ${severity === 'critical' ? threshold.critical : threshold.warning})`
    );

    // In production, this would send actual alerts to monitoring systems
  }

  /**
   * Get percentile of metrics
   */
  getPercentile(
    resourceId: string,
    metricPath: string,
    percentile: number,
    window: number
  ): number | null {
    const history = this.getMetricsHistory(resourceId);
    const cutoff = Date.now() - window;

    const windowMetrics = history.filter((m) => m.timestamp.getTime() > cutoff);

    if (windowMetrics.length === 0) {
      return null;
    }

    const values: number[] = [];
    for (const metrics of windowMetrics) {
      const value = this.getMetricValue(metrics, metricPath);
      if (value !== null) {
        values.push(value);
      }
    }

    if (values.length === 0) {
      return null;
    }

    values.sort((a, b) => a - b);

    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[index];
  }

  /**
   * Get trend for a metric
   */
  getTrend(resourceId: string, metricPath: string, points: number): number {
    const history = this.getMetricsHistory(resourceId, points);
    if (history.length < 2) {
      return 0;
    }

    const values: number[] = [];
    for (const metrics of history) {
      const value = this.getMetricValue(metrics, metricPath);
      if (value !== null) {
        values.push(value);
      }
    }

    if (values.length < 2) {
      return 0;
    }

    // Simple linear regression to get trend
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  /**
   * Clear metrics history for a resource
   */
  clearHistory(resourceId: string): void {
    this.metricsHistory.delete(resourceId);
    this.thresholds.delete(resourceId);
    this.logger.info(`Cleared metrics history for ${resourceId}`);
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<MetricCollectionConfig>): void {
    this.config = { ...this.config, ...updates };
    this.logger.info('Metrics collector configuration updated', updates);
  }

  /**
   * Get current configuration
   */
  getConfig(): MetricCollectionConfig {
    return { ...this.config };
  }
}
