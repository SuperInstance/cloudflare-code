/**
 * Central metrics collector for managing all metric types
 * Provides unified interface for counter, gauge, histogram, and summary metrics
 */

import { EventEmitter } from 'eventemitter3';
import { Counter, CounterRegistry } from './counter';
import { Gauge, GaugeRegistry } from './gauge';
import { Histogram, HistogramRegistry } from './histogram';
import { Summary, SummaryRegistry } from './summary';
import {
  Metric,
  MetricType,
  MetricData,
  MetricBatch,
  PerformanceMonitoringConfig
} from '../types';

export class MetricsCollector {
  private counters: CounterRegistry;
  private gauges: GaugeRegistry;
  private histograms: HistogramRegistry;
  private summaries: SummaryRegistry;
  private eventEmitter: EventEmitter;
  private config: PerformanceMonitoringConfig['metrics'];
  private collectionInterval?: NodeJS.Timeout;
  private batches: Map<string, MetricData[]>;

  constructor(config: PerformanceMonitoringConfig['metrics'] = {
    enabled: true,
    collectionInterval: 1000,
    retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
    prometheus: {
      enabled: true,
      port: 9090,
      path: '/metrics'
    },
    aggregation: {
      interval: 60000,
      maxDataPoints: 1000
    }
  }) {
    this.config = config;
    this.counters = new CounterRegistry();
    this.gauges = new GaugeRegistry();
    this.histograms = new HistogramRegistry();
    this.summaries = new SummaryRegistry();
    this.eventEmitter = new EventEmitter();
    this.batches = new Map();

    this.setupEventForwarding();
  }

  /**
   * Create or get a counter
   */
  createCounter(name: string, help: string, labels?: Record<string, string>): Counter {
    const counter = this.counters.getOrCreate(name, help, labels);
    this.eventEmitter.emit('metric:created', { type: 'counter', name, help, labels });
    return counter;
  }

  /**
   * Create or get a gauge
   */
  createGauge(name: string, help: string, labels?: Record<string, string>): Gauge {
    const gauge = this.gauges.getOrCreate(name, help, labels);
    this.eventEmitter.emit('metric:created', { type: 'gauge', name, help, labels });
    return gauge;
  }

  /**
   * Create or get a histogram
   */
  createHistogram(
    name: string,
    help: string,
    options?: { buckets?: number[]; labels?: Record<string, string> }
  ): Histogram {
    const histogram = this.histograms.getOrCreate(name, help, options);
    this.eventEmitter.emit('metric:created', { type: 'histogram', name, help, options });
    return histogram;
  }

  /**
   * Create or get a summary
   */
  createSummary(
    name: string,
    help: string,
    options?: {
      quantiles?: number[];
      maxAge?: number;
      ageBuckets?: number;
      labels?: Record<string, string>;
    }
  ): Summary {
    const summary = this.summaries.getOrCreate(name, help, options);
    this.eventEmitter.emit('metric:created', { type: 'summary', name, help, options });
    return summary;
  }

  /**
   * Get a metric by name and type
   */
  getMetric(name: string, type: MetricType): Counter | Gauge | Histogram | Summary | undefined {
    switch (type) {
      case 'counter':
        return this.counters.get(name);
      case 'gauge':
        return this.gauges.get(name);
      case 'histogram':
        return this.histograms.get(name);
      case 'summary':
        return this.summaries.get(name);
      default:
        return undefined;
    }
  }

  /**
   * Get all metrics of a specific type
   */
  getMetricsByType(type: MetricType): Array<Counter | Gauge | Histogram | Summary> {
    switch (type) {
      case 'counter':
        return this.counters.getAll();
      case 'gauge':
        return this.gauges.getAll();
      case 'histogram':
        return this.histograms.getAll();
      case 'summary':
        return this.summaries.getAll();
      default:
        return [];
    }
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, Metric> {
    const allMetrics = new Map<string, Metric>();

    for (const counter of this.counters.getAll()) {
      allMetrics.set(counter.getMetric().name, counter.getMetric());
    }

    for (const gauge of this.gauges.getAll()) {
      allMetrics.set(gauge.getMetric().name, gauge.getMetric());
    }

    for (const histogram of this.histograms.getAll()) {
      allMetrics.set(histogram.getMetric().name, histogram.getMetric());
    }

    for (const summary of this.summaries.getAll()) {
      allMetrics.set(summary.getMetric().name, summary.getMetric());
    }

    return allMetrics;
  }

  /**
   * Delete a metric
   */
  deleteMetric(name: string, type: MetricType): boolean {
    switch (type) {
      case 'counter':
        return this.counters.delete(name);
      case 'gauge':
        return this.gauges.delete(name);
      case 'histogram':
        return this.histograms.delete(name);
      case 'summary':
        return this.summaries.delete(name);
      default:
        return false;
    }
  }

  /**
   * Clear all metrics
   */
  clearAll(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.summaries.clear();
    this.eventEmitter.emit('metrics:cleared');
  }

  /**
   * Export metrics in Prometheus format
   */
  toPrometheus(): string {
    const parts: string[] = [];

    parts.push(this.counters.toPrometheus());
    parts.push(this.gauges.toPrometheus());
    parts.push(this.histograms.toPrometheus());
    parts.push(this.summaries.toPrometheus());

    return parts.filter(p => p.length > 0).join('\n\n');
  }

  /**
   * Export metrics as JSON
   */
  toJSON(): Record<string, Metric> {
    const metrics: Record<string, Metric> = {};

    for (const [name, metric] of this.getAllMetrics()) {
      metrics[name] = metric;
    }

    return metrics;
  }

  /**
   * Export metrics as a batch
   */
  createBatch(): MetricBatch {
    const metrics: MetricData[] = [];
    const now = Date.now();

    for (const [name, metric] of this.getAllMetrics()) {
      metrics.push({
        name,
        type: metric.type,
        value: this.getMetricValue(metric),
        labels: metric.labels,
        timestamp: now
      });
    }

    return {
      metrics,
      timestamp: now
    };
  }

  /**
   * Add metrics to a batch
   */
  addToBatch(batchId: string, metric: MetricData): void {
    if (!this.batches.has(batchId)) {
      this.batches.set(batchId, []);
    }

    this.batches.get(batchId)!.push(metric);
  }

  /**
   * Get a batch
   */
  getBatch(batchId: string): MetricBatch | undefined {
    const metrics = this.batches.get(batchId);
    if (!metrics) {
      return undefined;
    }

    return {
      metrics,
      timestamp: Date.now()
    };
  }

  /**
   * Clear a batch
   */
  clearBatch(batchId: string): void {
    this.batches.delete(batchId);
  }

  /**
   * Start periodic metric collection
   */
  startCollection(): void {
    if (this.collectionInterval) {
      return;
    }

    this.collectionInterval = setInterval(() => {
      const batch = this.createBatch();
      this.eventEmitter.emit('metrics:collected', batch);
    }, this.config.collectionInterval);

    this.eventEmitter.emit('collection:started');
  }

  /**
   * Stop periodic metric collection
   */
  stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = undefined;
      this.eventEmitter.emit('collection:stopped');
    }
  }

  /**
   * Get metric statistics
   */
  getStatistics(): {
    totalMetrics: number;
    counters: number;
    gauges: number;
    histograms: number;
    summaries: number;
    totalValues: number;
  } {
    const allMetrics = this.getAllMetrics();
    let totalValues = 0;

    for (const metric of allMetrics.values()) {
      totalValues += metric.values.length;
    }

    return {
      totalMetrics: allMetrics.size,
      counters: this.counters.getAll().length,
      gauges: this.gauges.getAll().length,
      histograms: this.histograms.getAll().length,
      summaries: this.summaries.getAll().length,
      totalValues
    };
  }

  /**
   * Clean up old metric values based on retention policy
   */
  cleanup(): void {
    const cutoff = Date.now() - this.config.retentionPeriod;
    let cleanedCount = 0;

    for (const counter of this.counters.getAll()) {
      const metric = counter.getMetric();
      const originalLength = metric.values.length;
      metric.values = metric.values.filter(v => v.timestamp >= cutoff);
      cleanedCount += originalLength - metric.values.length;
    }

    for (const gauge of this.gauges.getAll()) {
      const metric = gauge.getMetric();
      const originalLength = metric.values.length;
      metric.values = metric.values.filter(v => v.timestamp >= cutoff);
      cleanedCount += originalLength - metric.values.length;
    }

    for (const histogram of this.histograms.getAll()) {
      const metric = histogram.getMetric();
      const originalLength = metric.values.length;
      metric.values = metric.values.filter(v => v.timestamp >= cutoff);
      cleanedCount += originalLength - metric.values.length;
    }

    for (const summary of this.summaries.getAll()) {
      const metric = summary.getMetric();
      const originalLength = metric.values.length;
      metric.values = metric.values.filter(v => v.timestamp >= cutoff);
      cleanedCount += originalLength - metric.values.length;
    }

    this.eventEmitter.emit('metrics:cleaned', { count: cleanedCount });
  }

  /**
   * Register event listener
   */
  on(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Remove event listener
   */
  off(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  /**
   * Set up event forwarding from registries
   */
  private setupEventForwarding(): void {
    this.counters.on('counter:increment', (data) => {
      this.eventEmitter.emit('counter:increment', data);
    });

    this.gauges.on('gauge:set', (data) => {
      this.eventEmitter.emit('gauge:set', data);
    });

    this.histograms.on('histogram:observe', (data) => {
      this.eventEmitter.emit('histogram:observe', data);
    });

    this.summaries.on('summary:observe', (data) => {
      this.eventEmitter.emit('summary:observe', data);
    });
  }

  /**
   * Extract numeric value from metric
   */
  private getMetricValue(metric: Metric): number {
    switch (metric.type) {
      case 'counter':
        return (metric as any).total || 0;
      case 'gauge':
        return (metric as any).value || 0;
      case 'histogram':
        return (metric as any).count || 0;
      case 'summary':
        return (metric as any).sampleCount || 0;
      default:
        return 0;
    }
  }

  /**
   * Destroy the collector and cleanup resources
   */
  destroy(): void {
    this.stopCollection();
    this.clearAll();
    this.batches.clear();
    this.eventEmitter.removeAllListeners();
  }
}

/**
 * Global metrics collector instance
 */
let globalCollector: MetricsCollector | undefined;

/**
 * Get or create the global metrics collector
 */
export function getGlobalCollector(
  config?: PerformanceMonitoringConfig['metrics']
): MetricsCollector {
  if (!globalCollector) {
    globalCollector = new MetricsCollector(config);
  }

  return globalCollector;
}

/**
 * Reset the global metrics collector
 */
export function resetGlobalCollector(): void {
  if (globalCollector) {
    globalCollector.destroy();
    globalCollector = undefined;
  }
}
