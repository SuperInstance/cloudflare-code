import { Observable, ObservableConfig } from '../core/Observable';
import {
  MetricOptions,
  CounterOptions,
  GaugeOptions,
  HistogramOptions,
  MetricData,
  MetricType,
  AggregationWindow,
  PercentileValues,
  MetricExportOptions
} from '../types';

/**
 * Metrics Collector with OpenTelemetry integration
 */
export class MetricsCollector extends Observable {
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();
  private histograms: Map<string, Histogram> = new Map();
  private summaries: Map<string, Summary> = new Map();
  private bufferedMetrics: MetricData[] = [];
  private exportInterval: NodeJS.Timeout | null = null;
  private otelInitialized = false;

  constructor(config: ObservableConfig = {}) {
    super(config);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize OpenTelemetry
      await this.initializeOpenTelemetry();

      // Set up periodic export
      const exportInterval = this.config.metrics?.exportInterval || 15000;
      this.exportInterval = setInterval(() => {
        this.exportBufferedMetrics();
      }, exportInterval);

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize MetricsCollector:', error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (!this.initialized) return;

    // Clear export interval
    if (this.exportInterval) {
      clearInterval(this.exportInterval);
      this.exportInterval = null;
    }

    // Export any remaining metrics
    await this.exportBufferedMetrics();

    this.initialized = false;
  }

  async export(): Promise<any> {
    this.ensureInitialized();

    try {
      // Export buffered metrics
      const result = await this.exportBufferedMetrics();

      // Clear existing metrics
      this.clearAllMetrics();

      return {
        success: true,
        exported: result.exported,
        duration: result.duration,
        metrics: {
          counters: this.counters.size,
          gauges: this.gauges.size,
          histograms: this.histograms.size,
          summaries: this.summaries.size
        }
      };
    } catch (error) {
      return this.handleExportError(error as Error);
    }
  }

  /**
   * Create a counter metric
   */
  createCounter(options: CounterOptions): Counter {
    this.ensureInitialized();

    const counter = new Counter(options);
    this.counters.set(options.name, counter);
    return counter;
  }

  /**
   * Create a gauge metric
   */
  createGauge(options: GaugeOptions): Gauge {
    this.ensureInitialized();

    const gauge = new Gauge(options);
    this.gauges.set(options.name, gauge);
    return gauge;
  }

  /**
   * Create a histogram metric
   */
  createHistogram(options: HistogramOptions): Histogram {
    this.ensureInitialized();

    const histogram = new Histogram(options);
    this.histograms.set(options.name, histogram);
    return histogram;
  }

  /**
   * Create a summary metric
   */
  createSummary(options: MetricOptions & { quantiles?: number[] }): Summary {
    this.ensureInitialized();

    const summary = new Summary(options);
    this.summaries.set(options.name, summary);
    return summary;
  }

  /**
   * Get a metric instance by name
   */
  getMetric(name: string): Counter | Gauge | Histogram | Summary | null {
    return (
      this.counters.get(name) ||
      this.gauges.get(name) ||
      this.histograms.get(name) ||
      this.summaries.get(name) ||
      null
    );
  }

  /**
   * Remove a metric
   */
  removeMetric(name: string): boolean {
    return (
      this.counters.delete(name) ||
      this.gauges.delete(name) ||
      this.histograms.delete(name) ||
      this.summaries.delete(name)
    );
  }

  /**
   * Clear all metrics
   */
  clearAllMetrics(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.summaries.clear();
  }

  /**
   * Get all metrics count
   */
  getMetricsCount(): {
    counters: number;
    gauges: number;
    histograms: number;
    summaries: number;
    total: number;
  } {
    return {
      counters: this.counters.size,
      gauges: this.gauges.size,
      histograms: this.histograms.size,
      summaries: this.summaries.size,
      total: this.counters.size + this.gauges.size + this.histograms.size + this.summaries.size
    };
  }

  /**
   * Export buffered metrics
   */
  private async exportBufferedMetrics(): Promise<any> {
    if (this.bufferedMetrics.length === 0) {
      return {
        success: true,
        exported: 0,
        failed: 0,
        duration: 0
      };
    }

    const metricsToExport = [...this.bufferedMetrics];
    this.bufferedMetrics = [];

    try {
      if (this.otelInitialized) {
        // Export to OpenTelemetry
        await this.exportToOpenTelemetry(metricsToExport);
      }

      return {
        success: true,
        exported: metricsToExport.length,
        failed: 0,
        duration: 0
      };
    } catch (error) {
      // Re-buffer metrics if export fails
      this.bufferedMetrics.unshift(...metricsToExport);
      throw error;
    }
  }

  /**
   * Initialize OpenTelemetry
   */
  private async initializeOpenTelemetry(): Promise<void> {
    try {
      // This is a placeholder for OpenTelemetry initialization
      // In a real implementation, this would initialize the SDK
      console.log('Initializing OpenTelemetry Metrics SDK...');
      this.otelInitialized = true;
    } catch (error) {
      console.warn('OpenTelemetry initialization failed:', error);
      // Continue with local buffer as fallback
    }
  }

  /**
   * Export metrics to OpenTelemetry
   */
  private async exportToOpenTelemetry(metrics: MetricData[]): Promise<void> {
    // Placeholder for OpenTelemetry export logic
    // In a real implementation, this would use the OTLP exporter
    console.log(`Exporting ${metrics.length} metrics to OpenTelemetry...`);
  }

  /**
   * Record a metric
   */
  private recordMetric(metric: MetricData): void {
    this.bufferedMetrics.push(metric);

    // Apply local aggregation if buffer is large
    if (this.bufferedMetrics.length >= 1000) {
      this.exportBufferedMetrics().catch(error => {
        console.error('Failed to export buffered metrics:', error);
      });
    }
  }
}

/**
 * Counter metric implementation
 */
export class Counter {
  private value = 0;
  private options: CounterOptions;

  constructor(options: CounterOptions) {
    this.options = options;
    if (options.initialValue !== undefined) {
      this.value = options.initialValue;
    }
  }

  /**
   * Increment the counter
   */
  inc(amount: number = 1): void {
    this.value += amount;
  }

  /**
   * Add a specific value
   */
  add(value: number): void {
    this.value += value;
  }

  /**
   * Get the current value
   */
  getValue(): number {
    return this.value;
  }

  /**
   * Get metric data
   */
  getData(labels: Record<string, string> = {}): MetricData {
    return {
      name: this.options.name,
      type: 'counter',
      value: this.value,
      labels: { ...this.options.labels, ...labels },
      timestamp: Date.now(),
      unit: this.options.unit
    };
  }
}

/**
 * Gauge metric implementation
 */
export class Gauge {
  private value: number;
  private options: GaugeOptions;

  constructor(options: GaugeOptions) {
    this.options = options;
    this.value = options.initialValue || 0;
  }

  /**
   * Set the gauge value
   */
  set(value: number): void {
    this.value = value;
  }

  /**
   * Add to the current value
   */
  add(delta: number): void {
    this.value += delta;
  }

  /**
   * Subtract from the current value
   */
  sub(delta: number): void {
    this.value -= delta;
  }

  /**
   * Get the current value
   */
  getValue(): number {
    return this.value;
  }

  /**
   * Get metric data
   */
  getData(labels: Record<string, string> = {}): MetricData {
    return {
      name: this.options.name,
      type: 'gauge',
      value: this.value,
      labels: { ...this.options.labels, ...labels },
      timestamp: Date.now(),
      unit: this.options.unit
    };
  }
}

/**
 * Histogram metric implementation
 */
export class Histogram {
  private buckets: number[] = [];
  private options: HistogramOptions;
  private sum = 0;
  private count = 0;

  constructor(options: HistogramOptions) {
    this.options = options;
    this.buckets = options.buckets || [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10];
  }

  /**
   * Record a value
   */
  record(value: number): void {
    this.buckets.push(value);
    this.sum += value;
    this.count++;

    // Keep only the last N values for memory efficiency
    if (this.buckets.length > 1000) {
      this.buckets = this.buckets.slice(-1000);
    }
  }

  /**
   * Get histogram statistics
   */
  getStatistics(): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    buckets: number[];
  } {
    return {
      count: this.count,
      sum: this.sum,
      avg: this.count > 0 ? this.sum / this.count : 0,
      min: this.buckets.length > 0 ? Math.min(...this.buckets) : 0,
      max: this.buckets.length > 0 ? Math.max(...this.buckets) : 0,
      buckets: this.buckets
    };
  }

  /**
   * Get metric data
   */
  getData(labels: Record<string, string> = {}): MetricData {
    return {
      name: this.options.name,
      type: 'histogram',
      value: this.count,
      labels: { ...this.options.labels, ...labels },
      timestamp: Date.now(),
      unit: this.options.unit
    };
  }
}

/**
 * Summary metric implementation
 */
export class Summary {
  private values: number[] = [];
  private quantiles: number[];
  private options: MetricOptions & { quantiles?: number[] };

  constructor(options: MetricOptions & { quantiles?: number[] }) {
    this.options = options;
    this.quantiles = options.quantiles || [0.5, 0.9, 0.95, 0.99];
  }

  /**
   * Record a value
   */
  record(value: number): void {
    this.values.push(value);

    // Keep only the last N values for memory efficiency
    if (this.values.length > 1000) {
      this.values = this.values.slice(-1000);
    }
  }

  /**
   * Get summary statistics
   */
  getStatistics(): PercentileValues {
    if (this.values.length === 0) {
      return {
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0
      };
    }

    const sorted = [...this.values].sort((a, b) => a - b);
    return {
      p50: this.percentile(sorted, 0.5),
      p90: this.percentile(sorted, 0.9),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99)
    };
  }

  /**
   * Calculate percentile value
   */
  private percentile(sortedValues: number[], p: number): number {
    const index = Math.floor(sortedValues.length * p);
    return sortedValues[index];
  }

  /**
   * Get metric data
   */
  getData(labels: Record<string, string> = {}): MetricData {
    return {
      name: this.options.name,
      type: 'summary',
      value: this.values.length,
      labels: { ...this.options.labels, ...labels },
      timestamp: Date.now(),
      unit: this.options.unit
    };
  }
}