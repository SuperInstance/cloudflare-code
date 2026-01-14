/**
 * Metrics Collection and Aggregation Engine
 * Provides high-performance metrics collection with support for counters, gauges, and histograms
 */

import { EventEmitter } from 'eventemitter3';
import { MeterProvider, Meter, Counter, Histogram, Gauge, UpDownCounter } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { v4 as uuidv4 } from 'uuid';
import {
  MetricOptions,
  CounterOptions,
  GaugeOptions,
  HistogramOptions,
  MetricData,
  MetricType,
  AggregationWindow,
  PercentileValues,
  MetricExportOptions,
  ExportResult,
} from '../types';

// ============================================================================
// Metric Storage
// ============================================================================

interface MetricValue {
  value: number;
  timestamp: number;
  labels: Record<string, string>;
}

interface MetricStorage {
  data: Map<string, MetricValue[]>;
  maxSize: number;
  windowMs: number;
}

// ============================================================================
// Counter Implementation
// ============================================================================

export class MetricCounter {
  private counter: Counter;
  private readonly storage: Map<string, MetricValue[]> = new Map();
  private readonly windowSize = 1000; // Keep last 1000 data points per label set

  constructor(
    private meter: Meter,
    private options: CounterOptions
  ) {
    this.counter = this.meter.createCounter(options.name, {
      description: options.description,
      unit: options.unit,
    });
  }

  /**
   * Increment the counter
   */
  increment(value = 1, labels?: Record<string, string>): void {
    const labelKey = this.getLabelKey(labels);
    this.counter.add(value, labels);
    
    this.storeValue(labelKey, value, labels);
  }

  /**
   * Decrement the counter
   */
  decrement(value = 1, labels?: Record<string, string>): void {
    this.increment(-value, labels);
  }

  /**
   * Reset the counter
   */
  reset(labels?: Record<string, string>): void {
    const labelKey = this.getLabelKey(labels);
    this.storage.delete(labelKey);
  }

  /**
   * Get current value
   */
  getValue(labels?: Record<string, string>): number {
    const labelKey = this.getLabelKey(labels);
    const values = this.storage.get(labelKey) || [];
    
    return values.reduce((sum, v) => sum + v.value, 0);
  }

  /**
   * Get rate per second
   */
  getRate(labels?: Record<string, string>, windowMs = 60000): number {
    const labelKey = this.getLabelKey(labels);
    const values = this.storage.get(labelKey) || [];
    
    const now = Date.now();
    const windowValues = values.filter(v => now - v.timestamp <= windowMs);
    
    const total = windowValues.reduce((sum, v) => sum + v.value, 0);
    return total / (windowMs / 1000);
  }

  private getLabelKey(labels?: Record<string, string>): string {
    if (!labels) {
      return '_default';
    }
    
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
  }

  private storeValue(key: string, value: number, labels?: Record<string, string>): void {
    if (!this.storage.has(key)) {
      this.storage.set(key, []);
    }
    
    const values = this.storage.get(key)!;
    values.push({
      value,
      timestamp: Date.now(),
      labels: labels || {},
    });
    
    // Keep only recent values
    if (values.length > this.windowSize) {
      values.shift();
    }
  }
}

// ============================================================================
// Gauge Implementation
// ============================================================================

export class MetricGauge {
  private gauge: Gauge;
  private readonly storage: Map<string, MetricValue[]> = new Map();
  private readonly windowSize = 1000;

  constructor(
    private meter: Meter,
    private options: GaugeOptions
  ) {
    this.gauge = this.meter.createGauge(options.name, {
      description: options.description,
      unit: options.unit,
    });

    if (options.initialValue !== undefined) {
      this.set(options.initialValue);
    }
  }

  /**
   * Set the gauge value
   */
  set(value: number, labels?: Record<string, string>): void {
    const labelKey = this.getLabelKey(labels);
    this.gauge.record(value, labels);
    
    this.storeValue(labelKey, value, labels);
  }

  /**
   * Increment the gauge
   */
  increment(value = 1, labels?: Record<string, string>): void {
    const current = this.getValue(labels);
    this.set(current + value, labels);
  }

  /**
   * Decrement the gauge
   */
  decrement(value = 1, labels?: Record<string, string>): void {
    const current = this.getValue(labels);
    this.set(current - value, labels);
  }

  /**
   * Get current value
   */
  getValue(labels?: Record<string, string>): number {
    const labelKey = this.getLabelKey(labels);
    const values = this.storage.get(labelKey);
    
    if (!values || values.length === 0) {
      return 0;
    }
    
    return values[values.length - 1].value;
  }

  /**
   * Get historical values
   */
  getHistory(labels?: Record<string, string>, windowMs = 60000): MetricValue[] {
    const labelKey = this.getLabelKey(labels);
    const values = this.storage.get(labelKey) || [];
    
    const now = Date.now();
    return values.filter(v => now - v.timestamp <= windowMs);
  }

  private getLabelKey(labels?: Record<string, string>): string {
    if (!labels) {
      return '_default';
    }
    
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
  }

  private storeValue(key: string, value: number, labels?: Record<string, string>): void {
    if (!this.storage.has(key)) {
      this.storage.set(key, []);
    }
    
    const values = this.storage.get(key)!;
    values.push({
      value,
      timestamp: Date.now(),
      labels: labels || {},
    });
    
    if (values.length > this.windowSize) {
      values.shift();
    }
  }
}

// ============================================================================
// Histogram Implementation
// ============================================================================

export class MetricHistogram {
  private histogram: Histogram;
  private readonly storage: Map<string, number[]> = new Map();
  private readonly defaultBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

  constructor(
    private meter: Meter,
    private options: HistogramOptions
  ) {
    this.histogram = this.meter.createHistogram(options.name, {
      description: options.description,
      unit: options.unit,
    });
  }

  /**
   * Record a value
   */
  record(value: number, labels?: Record<string, string>): void {
    const labelKey = this.getLabelKey(labels);
    this.histogram.record(value, labels);
    
    if (!this.storage.has(labelKey)) {
      this.storage.set(labelKey, []);
    }
    
    const values = this.storage.get(labelKey)!;
    values.push(value);
    
    // Keep only recent values
    if (values.length > 10000) {
      values.shift();
    }
  }

  /**
   * Get percentile values
   */
  getPercentiles(labels?: Record<string, string>): PercentileValues {
    const values = this.getValues(labels);
    
    if (values.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0 };
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    
    return {
      p50: this.getPercentile(sorted, 0.50),
      p90: this.getPercentile(sorted, 0.90),
      p95: this.getPercentile(sorted, 0.95),
      p99: this.getPercentile(sorted, 0.99),
    };
  }

  /**
   * Get average value
   */
  getAverage(labels?: Record<string, string>): number {
    const values = this.getValues(labels);
    
    if (values.length === 0) {
      return 0;
    }
    
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }

  /**
   * Get bucket counts
   */
  getBucketCounts(labels?: Record<string, string>): Record<string, number> {
    const values = this.getValues(labels);
    const buckets = this.options.buckets || this.defaultBuckets;
    const counts: Record<string, number> = {};
    
    // Initialize counts
    for (const bucket of buckets) {
      counts[`le_${bucket}`] = 0;
    }
    counts['le_+Inf'] = 0;
    
    // Count values in each bucket
    for (const value of values) {
      for (let i = 0; i < buckets.length; i++) {
        if (value <= buckets[i]) {
          counts[`le_${buckets[i]}`]++;
        }
      }
      counts['le_+Inf']++;
    }
    
    return counts;
  }

  private getValues(labels?: Record<string, string>): number[] {
    const labelKey = this.getLabelKey(labels);
    return this.storage.get(labelKey) || [];
  }

  private getLabelKey(labels?: Record<string, string>): string {
    if (!labels) {
      return '_default';
    }
    
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
  }

  private getPercentile(sorted: number[], percentile: number): number {
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }
}

// ============================================================================
// Main Metrics Collector
// ============================================================================

export class MetricsCollector extends EventEmitter {
  private meterProvider: MeterProvider;
  private meter: Meter;
  private counters: Map<string, MetricCounter> = new Map();
  private gauges: Map<string, MetricGauge> = new Map();
  private histograms: Map<string, MetricHistogram> = new Map();
  private enabled = true;
  private exportInterval: NodeJS.Timeout | null = null;
  private aggregationWindow: AggregationWindow = { duration: 60000 };

  constructor(private serviceName: string) {
    super();
    
    this.meterProvider = this.createMeterProvider();
    this.meter = this.meterProvider.getMeter(serviceName);
  }

  /**
   * Create or get a counter
   */
  counter(options: CounterOptions): MetricCounter {
    if (this.counters.has(options.name)) {
      return this.counters.get(options.name)!;
    }

    const counter = new MetricCounter(this.meter, options);
    this.counters.set(options.name, counter);
    
    this.emit('metric:created', { type: 'counter', name: options.name });
    
    return counter;
  }

  /**
   * Create or get a gauge
   */
  gauge(options: GaugeOptions): MetricGauge {
    if (this.gauges.has(options.name)) {
      return this.gauges.get(options.name)!;
    }

    const gauge = new MetricGauge(this.meter, options);
    this.gauges.set(options.name, gauge);
    
    this.emit('metric:created', { type: 'gauge', name: options.name });
    
    return gauge;
  }

  /**
   * Create or get a histogram
   */
  histogram(options: HistogramOptions): MetricHistogram {
    if (this.histograms.has(options.name)) {
      return this.histograms.get(options.name)!;
    }

    const histogram = new MetricHistogram(this.meter, options);
    this.histograms.set(options.name, histogram);
    
    this.emit('metric:created', { type: 'histogram', name: options.name });
    
    return histogram;
  }

  /**
   * Get all metric data
   */
  getAllMetrics(): MetricData[] {
    const metrics: MetricData[] = [];
    const timestamp = Date.now();

    // Collect counter data
    for (const [name, counter] of this.counters) {
      metrics.push({
        name,
        type: 'counter',
        value: counter.getValue(),
        labels: {},
        timestamp,
      });
    }

    // Collect gauge data
    for (const [name, gauge] of this.gauges) {
      metrics.push({
        name,
        type: 'gauge',
        value: gauge.getValue(),
        labels: {},
        timestamp,
      });
    }

    // Collect histogram data
    for (const [name, histogram] of this.histograms) {
      const percentiles = histogram.getPercentiles();
      metrics.push({
        name: `${name}_p50`,
        type: 'gauge',
        value: percentiles.p50,
        labels: {},
        timestamp,
      });
      metrics.push({
        name: `${name}_p90`,
        type: 'gauge',
        value: percentiles.p90,
        labels: {},
        timestamp,
      });
      metrics.push({
        name: `${name}_p95`,
        type: 'gauge',
        value: percentiles.p95,
        labels: {},
        timestamp,
      });
      metrics.push({
        name: `${name}_p99`,
        type: 'gauge',
        value: percentiles.p99,
        labels: {},
        timestamp,
      });
    }

    return metrics;
  }

  /**
   * Export metrics in specified format
   */
  async export(options: MetricExportOptions): Promise<ExportResult> {
    const startTime = Date.now();
    const metrics = this.getAllMetrics();
    
    let exported = 0;
    let failed = 0;
    const errors: Error[] = [];

    try {
      switch (options.format) {
        case 'prometheus':
          await this.exportPrometheus(metrics);
          exported = metrics.length;
          break;
          
        case 'cloudflare':
          await this.exportCloudflare(metrics);
          exported = metrics.length;
          break;
          
        case 'json':
          await this.exportJSON(metrics);
          exported = metrics.length;
          break;
          
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }
    } catch (error) {
      errors.push(error as Error);
      failed = metrics.length;
    }

    const duration = Date.now() - startTime;
    
    return {
      success: errors.length === 0,
      exported,
      failed,
      duration,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Start automatic metric export
   */
  startExport(intervalMs: number, format: MetricExportOptions['format'] = 'prometheus'): void {
    if (this.exportInterval) {
      this.stopExport();
    }

    this.exportInterval = setInterval(async () => {
      try {
        await this.export({ format });
      } catch (error) {
        this.emit('export:error', error);
      }
    }, intervalMs);
  }

  /**
   * Stop automatic metric export
   */
  stopExport(): void {
    if (this.exportInterval) {
      clearInterval(this.exportInterval);
      this.exportInterval = null;
    }
  }

  /**
   * Set aggregation window
   */
  setAggregationWindow(window: AggregationWindow): void {
    this.aggregationWindow = window;
  }

  /**
   * Enable or disable metrics collection
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if metrics collection is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Force flush all metrics
   */
  async forceFlush(): Promise<void> {
    await this.meterProvider.forceFlush();
  }

  /**
   * Shutdown the collector
   */
  async shutdown(): Promise<void> {
    this.stopExport();
    await this.forceFlush();
    await this.meterProvider.shutdown();
    this.enabled = false;
  }

  /**
   * Get metric by name
   */
  getMetric(name: string): MetricCounter | MetricGauge | MetricHistogram | undefined {
    if (this.counters.has(name)) {
      return this.counters.get(name);
    }
    if (this.gauges.has(name)) {
      return this.gauges.get(name);
    }
    if (this.histograms.has(name)) {
      return this.histograms.get(name);
    }
    return undefined;
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return [
      ...Array.from(this.counters.keys()),
      ...Array.from(this.gauges.keys()),
      ...Array.from(this.histograms.keys()),
    ];
  }

  /**
   * Remove a metric
   */
  removeMetric(name: string): boolean {
    let removed = false;
    
    if (this.counters.has(name)) {
      this.counters.delete(name);
      removed = true;
    }
    if (this.gauges.has(name)) {
      this.gauges.delete(name);
      removed = true;
    }
    if (this.histograms.has(name)) {
      this.histograms.delete(name);
      removed = true;
    }
    
    if (removed) {
      this.emit('metric:removed', { name });
    }
    
    return removed;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private createMeterProvider(): MeterProvider {
    const resource = new Resource({
      [SEMRESATTRS_SERVICE_NAME]: this.serviceName,
    });

    const provider = new MeterProvider({ resource });

    // Setup Prometheus exporter
    const prometheusExporter = new PrometheusExporter({
      port: parseInt(process.env.PROMETHEUS_PORT || '9464'),
      endpoint: process.env.PROMETHEUS_ENDPOINT || '/metrics',
    });

    provider.addMetricReader(prometheusExporter);

    return provider;
  }

  private async exportPrometheus(metrics: MetricData[]): Promise<void> {
    // Prometheus export is handled by the exporter
    // This method is a placeholder for custom logic if needed
    this.emit('export:prometheus', metrics);
  }

  private async exportCloudflare(metrics: MetricData[]): Promise<void> {
    // Cloudflare-specific export logic
    const payload = {
      service: this.serviceName,
      metrics,
      timestamp: Date.now(),
    };

    // Send to Cloudflare Workers Analytics Engine
    const endpoint = process.env.CLOUDFLARE_ANALYTICS_ENDPOINT;
    if (endpoint) {
      // Implementation would use fetch or similar
      this.emit('export:cloudflare', payload);
    }
  }

  private async exportJSON(metrics: MetricData[]): Promise<void> {
    const data = JSON.stringify(metrics, null, 2);
    this.emit('export:json', data);
  }
}

// ============================================================================
// Metric Registry
// ============================================================================

/**
 * Global metric registry for singleton access
 */
export class MetricRegistry {
  private static collectors: Map<string, MetricsCollector> = new Map();

  static get(serviceName: string): MetricsCollector {
    if (!this.collectors.has(serviceName)) {
      this.collectors.set(serviceName, new MetricsCollector(serviceName));
    }
    return this.collectors.get(serviceName)!;
  }

  static has(serviceName: string): boolean {
    return this.collectors.has(serviceName);
  }

  static delete(serviceName: string): boolean {
    return this.collectors.delete(serviceName);
  }

  static clear(): void {
    this.collectors.clear();
  }

  static size(): number {
    return this.collectors.size;
  }
}
