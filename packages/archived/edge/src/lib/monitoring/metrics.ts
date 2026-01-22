/**
 * Prometheus Metrics Collector
 *
 * Comprehensive metrics collection system supporting Prometheus format.
 * Implements counters, gauges, histograms, and summaries with low overhead.
 *
 * Features:
 * - Counter metrics (monotonically increasing)
 * - Gauge metrics (can go up or down)
 * - Histogram metrics (configurable buckets)
 * - Summary metrics (sliding window quantiles)
 * - Label-based metric grouping
 * - Prometheus text format export
 * - Metric aggregation and statistics
 */

import type {
  PrometheusMetric,
  PrometheusMetricType,
  MetricLabels,
  CounterMetric,
  GaugeMetric,
  HistogramMetric,
  SummaryMetric,
  MetricsRegistry,
} from './types';

/**
 * Default histogram buckets (in seconds)
 */
const DEFAULT_HISTOGRAM_BUCKETS = [
  0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

/**
 * Default summary quantiles
 */
const DEFAULT_SUMMARY_QUANTILES = [0.5, 0.9, 0.95, 0.99];

/**
 * Metrics Collector Class
 */
export class MetricsCollector {
  private registry: MetricsRegistry;
  private defaultLabels: MetricLabels;
  private collectInterval: number;
  private collectionTimer?: ReturnType<typeof setInterval>;

  constructor(defaultLabels: MetricLabels = {}, collectInterval: number = 60000) {
    this.registry = {
      counters: new Map(),
      gauges: new Map(),
      histograms: new Map(),
      summaries: new Map(),
    };
    this.defaultLabels = defaultLabels;
    this.collectInterval = collectInterval;
  }

  /**
   * Create or get a counter metric
   */
  counter(
    name: string,
    help: string,
    labels: string[] = []
  ): (value?: number, labelValues?: MetricLabels) => void {
    if (!this.registry.counters.has(name)) {
      this.registry.counters.set(name, {
        name,
        help,
        labels: new Set(labels),
        value: 0,
        created: Date.now(),
      });
    }

    return (value: number = 1, labelValues?: MetricLabels) => {
      const metric = this.registry.counters.get(name)!;
      const key = this.getLabelKey(labelValues || {});

      // For labeled metrics, we store values in a nested structure
      if (labelValues && Object.keys(labelValues).length > 0) {
        if (!metric.labeledValues) {
          metric.labeledValues = new Map();
        }
        const current = metric.labeledValues.get(key) || 0;
        metric.labeledValues.set(key, current + value);
      } else {
        metric.value += value;
      }
    };
  }

  /**
   * Create or get a gauge metric
   */
  gauge(
    name: string,
    help: string,
    labels: string[] = []
  ): {
    set: (value: number, labelValues?: MetricLabels) => void;
    increment: (value?: number, labelValues?: MetricLabels) => void;
    decrement: (value?: number, labelValues?: MetricLabels) => void;
  } {
    if (!this.registry.gauges.has(name)) {
      this.registry.gauges.set(name, {
        name,
        help,
        labels: new Set(labels),
        value: 0,
        created: Date.now(),
      });
    }

    return {
      set: (value: number, labelValues?: MetricLabels) => {
        const metric = this.registry.gauges.get(name)!;
        const key = this.getLabelKey(labelValues || {});

        if (labelValues && Object.keys(labelValues).length > 0) {
          if (!metric.labeledValues) {
            metric.labeledValues = new Map();
          }
          metric.labeledValues.set(key, value);
        } else {
          metric.value = value;
        }
      },
      increment: (value: number = 1, labelValues?: MetricLabels) => {
        const metric = this.registry.gauges.get(name)!;
        const key = this.getLabelKey(labelValues || {});

        if (labelValues && Object.keys(labelValues).length > 0) {
          if (!metric.labeledValues) {
            metric.labeledValues = new Map();
          }
          const current = metric.labeledValues.get(key) || 0;
          metric.labeledValues.set(key, current + value);
        } else {
          metric.value += value;
        }
      },
      decrement: (value: number = 1, labelValues?: MetricLabels) => {
        const metric = this.registry.gauges.get(name)!;
        const key = this.getLabelKey(labelValues || {});

        if (labelValues && Object.keys(labelValues).length > 0) {
          if (!metric.labeledValues) {
            metric.labeledValues = new Map();
          }
          const current = metric.labeledValues.get(key) || 0;
          metric.labeledValues.set(key, current - value);
        } else {
          metric.value -= value;
        }
      },
    };
  }

  /**
   * Create or get a histogram metric
   */
  histogram(
    name: string,
    help: string,
    labels: string[] = [],
    buckets: number[] = DEFAULT_HISTOGRAM_BUCKETS
  ): (value: number, labelValues?: MetricLabels) => void {
    if (!this.registry.histograms.has(name)) {
      this.registry.histograms.set(name, {
        name,
        help,
        labels: new Set(labels),
        buckets,
        sum: 0,
        count: 0,
        created: Date.now(),
        observations: new Map(),
      });
    }

    return (value: number, labelValues?: MetricLabels) => {
      const metric = this.registry.histograms.get(name)!;
      const key = this.getLabelKey(labelValues || {});

      if (!metric.observations.has(key)) {
        metric.observations.set(key, []);
      }

      const observations = metric.observations.get(key)!;
      observations.push(value);

      // Update sum and count
      metric.sum += value;
      metric.count += 1;
    };
  }

  /**
   * Create or get a summary metric
   */
  summary(
    name: string,
    help: string,
    labels: string[] = [],
    quantiles: number[] = DEFAULT_SUMMARY_QUANTILES,
    windowSize: number = 1000
  ): (value: number, labelValues?: MetricLabels) => void {
    if (!this.registry.summaries.has(name)) {
      this.registry.summaries.set(name, {
        name,
        help,
        labels: new Set(labels),
        quantiles,
        windowSize,
        created: Date.now(),
        observations: new Map(),
      });
    }

    return (value: number, labelValues?: MetricLabels) => {
      const metric = this.registry.summaries.get(name)!;
      const key = this.getLabelKey(labelValues || {});

      if (!metric.observations.has(key)) {
        metric.observations.set(key, []);
      }

      const observations = metric.observations.get(key)!;
      observations.push(value);

      // Keep only the last windowSize observations
      if (observations.length > windowSize) {
        observations.shift();
      }
    };
  }

  /**
   * Get the current value of a counter
   */
  getCounter(name: string, labelValues?: MetricLabels): number {
    const metric = this.registry.counters.get(name);
    if (!metric) return 0;

    if (labelValues && Object.keys(labelValues).length > 0) {
      const key = this.getLabelKey(labelValues);
      return metric.labeledValues?.get(key) || 0;
    }

    return metric.value;
  }

  /**
   * Get the current value of a gauge
   */
  getGauge(name: string, labelValues?: MetricLabels): number {
    const metric = this.registry.gauges.get(name);
    if (!metric) return 0;

    if (labelValues && Object.keys(labelValues).length > 0) {
      const key = this.getLabelKey(labelValues);
      return metric.labeledValues?.get(key) || 0;
    }

    return metric.value;
  }

  /**
   * Get histogram statistics
   */
  getHistogramStats(name: string, labelValues?: MetricLabels): {
    count: number;
    sum: number;
    avg: number;
    buckets: Record<string, number>;
  } | null {
    const metric = this.registry.histograms.get(name);
    if (!metric) return null;

    const key = this.getLabelKey(labelValues || {});
    const observations = metric.observations.get(key) || [];

    const buckets: Record<string, number> = {};
    const sortedObs = [...observations].sort((a, b) => a - b);

    for (const bucket of metric.buckets) {
      buckets[`le_${bucket}`] = sortedObs.filter((v) => v <= bucket).length;
    }
    buckets[`le_+Inf`] = observations.length;

    return {
      count: observations.length,
      sum: observations.reduce((a, b) => a + b, 0),
      avg: observations.length > 0
        ? observations.reduce((a, b) => a + b, 0) / observations.length
        : 0,
      buckets,
    };
  }

  /**
   * Get summary quantiles
   */
  getSummaryQuantiles(name: string, labelValues?: MetricLabels): Record<string, number> | null {
    const metric = this.registry.summaries.get(name);
    if (!metric) return null;

    const key = this.getLabelKey(labelValues || {});
    const observations = metric.observations.get(key) || [];

    if (observations.length === 0) return null;

    const sorted = [...observations].sort((a, b) => a - b);
    const quantiles: Record<string, number> = {};

    for (const q of metric.quantiles) {
      const index = Math.floor(q * sorted.length);
      quantiles[`quantile_${q}`] = sorted[Math.min(index, sorted.length - 1)];
    }

    quantiles.count = observations.length;
    quantiles.sum = observations.reduce((a, b) => a + b, 0);

    return quantiles;
  }

  /**
   * Reset a metric to zero
   */
  reset(name: string): void {
    this.registry.counters.delete(name);
    this.registry.gauges.delete(name);
    this.registry.histograms.delete(name);
    this.registry.summaries.delete(name);
  }

  /**
   * Reset all metrics
   */
  resetAll(): void {
    this.registry.counters.clear();
    this.registry.gauges.clear();
    this.registry.histograms.clear();
    this.registry.summaries.clear();
  }

  /**
   * Export metrics in Prometheus text format
   */
  async exportPrometheus(): Promise<string> {
    const lines: string[] = [];

    // Export counters
    for (const metric of this.registry.counters.values()) {
      lines.push(...this.exportCounter(metric));
    }

    // Export gauges
    for (const metric of this.registry.gauges.values()) {
      lines.push(...this.exportGauge(metric));
    }

    // Export histograms
    for (const metric of this.registry.histograms.values()) {
      lines.push(...this.exportHistogram(metric));
    }

    // Export summaries
    for (const metric of this.registry.summaries.values()) {
      lines.push(...this.exportSummary(metric));
    }

    return lines.join('\n');
  }

  /**
   * Export metrics as JSON
   */
  exportJSON(): {
    counters: Array<CounterMetric & { type: string }>;
    gauges: Array<GaugeMetric & { type: string }>;
    histograms: Array<HistogramMetric & { type: string }>;
    summaries: Array<SummaryMetric & { type: string }>;
  } {
    return {
      counters: Array.from(this.registry.counters.values()).map((m) => ({
        ...m,
        type: 'counter',
        labels: Array.from(m.labels),
      })),
      gauges: Array.from(this.registry.gauges.values()).map((m) => ({
        ...m,
        type: 'gauge',
        labels: Array.from(m.labels),
      })),
      histograms: Array.from(this.registry.histograms.values()).map((m) => ({
        ...m,
        type: 'histogram',
        labels: Array.from(m.labels),
        observations: Object.fromEntries(m.observations),
      })),
      summaries: Array.from(this.registry.summaries.values()).map((m) => ({
        ...m,
        type: 'summary',
        labels: Array.from(m.labels),
        observations: Object.fromEntries(m.observations),
      })),
    };
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalMetrics: number;
    counters: number;
    gauges: number;
    histograms: number;
    summaries: number;
    labeledMetrics: number;
  } {
    let labeledMetrics = 0;

    for (const counter of this.registry.counters.values()) {
      if (counter.labeledValues) {
        labeledMetrics += counter.labeledValues.size;
      }
    }

    for (const gauge of this.registry.gauges.values()) {
      if (gauge.labeledValues) {
        labeledMetrics += gauge.labeledValues.size;
      }
    }

    for (const histogram of this.registry.histograms.values()) {
      labeledMetrics += histogram.observations.size;
    }

    for (const summary of this.registry.summaries.values()) {
      labeledMetrics += summary.observations.size;
    }

    return {
      totalMetrics:
        this.registry.counters.size +
        this.registry.gauges.size +
        this.registry.histograms.size +
        this.registry.summaries.size,
      counters: this.registry.counters.size,
      gauges: this.registry.gauges.size,
      histograms: this.registry.histograms.size,
      summaries: this.registry.summaries.size,
      labeledMetrics,
    };
  }

  /**
   * Start periodic metric collection
   */
  startCollection(callback?: () => void): void {
    if (this.collectionTimer) {
      this.stopCollection();
    }

    this.collectionTimer = setInterval(() => {
      // Cleanup old data, aggregate metrics, etc.
      this.cleanup();

      if (callback) {
        callback();
      }
    }, this.collectInterval);
  }

  /**
   * Stop periodic metric collection
   */
  stopCollection(): void {
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = undefined;
    }
  }

  /**
   * Export a counter metric
   */
  private exportCounter(metric: CounterMetric): string[] {
    const lines: string[] = [];
    const baseLabels = this.buildLabelString({});

    lines.push(
      `# HELP ${metric.name} ${metric.help}`,
      `# TYPE ${metric.name} counter`
    );

    // Export default value
    if (metric.value > 0 || Object.keys(this.defaultLabels).length > 0) {
      lines.push(`${metric.name}${baseLabels} ${metric.value}`);
    }

    // Export labeled values
    if (metric.labeledValues) {
      for (const [key, value] of metric.labeledValues.entries()) {
        if (value > 0) {
          const labels = this.buildLabelString(this.parseLabelKey(key));
          lines.push(`${metric.name}${labels} ${value}`);
        }
      }
    }

    lines.push('');
    return lines;
  }

  /**
   * Export a gauge metric
   */
  private exportGauge(metric: GaugeMetric): string[] {
    const lines: string[] = [];
    const baseLabels = this.buildLabelString({});

    lines.push(
      `# HELP ${metric.name} ${metric.help}`,
      `# TYPE ${metric.name} gauge`,
      `${metric.name}${baseLabels} ${metric.value}`
    );

    // Export labeled values
    if (metric.labeledValues) {
      for (const [key, value] of metric.labeledValues.entries()) {
        const labels = this.buildLabelString(this.parseLabelKey(key));
        lines.push(`${metric.name}${labels} ${value}`);
      }
    }

    lines.push('');
    return lines;
  }

  /**
   * Export a histogram metric
   */
  private exportHistogram(metric: HistogramMetric): string[] {
    const lines: string[] = [];

    lines.push(
      `# HELP ${metric.name} ${metric.help}`,
      `# TYPE ${metric.name} histogram`
    );

    // Export bucket counts for each label combination
    for (const [key, observations] of metric.observations.entries()) {
      const labels = this.buildLabelString(this.parseLabelKey(key));
      const sorted = [...observations].sort((a, b) => a - b);

      for (const bucket of metric.buckets) {
        const count = sorted.filter((v) => v <= bucket).length;
        lines.push(`${metric.name}_bucket${labels}le="${bucket}" ${count}`);
      }

      // Add +Inf bucket
      lines.push(`${metric.name}_bucket${labels}le="+Inf" ${observations.length}`);
      lines.push(`${metric.name}_sum${labels} ${observations.reduce((a, b) => a + b, 0)}`);
      lines.push(`${metric.name}_count${labels} ${observations.length}`);
    }

    // If no labeled values, export empty buckets
    if (metric.observations.size === 0) {
      const labels = this.buildLabelString({});
      for (const bucket of metric.buckets) {
        lines.push(`${metric.name}_bucket${labels}le="${bucket}" 0`);
      }
      lines.push(`${metric.name}_bucket${labels}le="+Inf" 0`);
      lines.push(`${metric.name}_sum${labels} 0`);
      lines.push(`${metric.name}_count${labels} 0`);
    }

    lines.push('');
    return lines;
  }

  /**
   * Export a summary metric
   */
  private exportSummary(metric: SummaryMetric): string[] {
    const lines: string[] = [];

    lines.push(
      `# HELP ${metric.name} ${metric.help}`,
      `# TYPE ${metric.name} summary`
    );

    // Export quantiles for each label combination
    for (const [key, observations] of metric.observations.entries()) {
      if (observations.length === 0) continue;

      const labels = this.buildLabelString(this.parseLabelKey(key));
      const sorted = [...observations].sort((a, b) => a - b);

      for (const quantile of metric.quantiles) {
        const index = Math.floor(quantile * sorted.length);
        const value = sorted[Math.min(index, sorted.length - 1)];
        lines.push(
          `${metric.name}${labels}quantile="${quantile}" ${value}`
        );
      }

      lines.push(`${metric.name}_sum${labels} ${observations.reduce((a, b) => a + b, 0)}`);
      lines.push(`${metric.name}_count${labels} ${observations.length}`);
    }

    lines.push('');
    return lines;
  }

  /**
   * Build label string for Prometheus format
   */
  private buildLabelString(labels: MetricLabels): string {
    const allLabels = { ...this.defaultLabels, ...labels };
    const keys = Object.keys(allLabels);

    if (keys.length === 0) return '';

    const labelPairs = keys.map(
      (key) => `${key}="${this.escapeLabelValue(String(allLabels[key]))}"`
    );

    return `{${labelPairs.join(',')}}`;
  }

  /**
   * Escape label values for Prometheus format
   */
  private escapeLabelValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  /**
   * Generate a key from label values
   */
  private getLabelKey(labels: MetricLabels): string {
    const keys = Object.keys(labels).sort();
    return keys.map((k) => `${k}=${labels[k]}`).join(',');
  }

  /**
   * Parse a label key back into an object
   */
  private parseLabelKey(key: string): MetricLabels {
    if (!key) return {};

    const labels: MetricLabels = {};
    for (const pair of key.split(',')) {
      const [name, value] = pair.split('=');
      if (name && value) {
        labels[name] = value;
      }
    }

    return labels;
  }

  /**
   * Cleanup old data and prevent memory leaks
   */
  private cleanup(): void {
    // Cleanup histogram observations (keep last 10000 per label)
    for (const histogram of this.registry.histograms.values()) {
      for (const [key, observations] of histogram.observations.entries()) {
        if (observations.length > 10000) {
          histogram.observations.set(
            key,
            observations.slice(-10000)
          );
        }
      }
    }

    // Cleanup summary observations (already limited by windowSize)
    // But we can remove empty label combinations
    for (const summary of this.registry.summaries.values()) {
      for (const [key, observations] of summary.observations.entries()) {
        if (observations.length === 0) {
          summary.observations.delete(key);
        }
      }
    }
  }
}

/**
 * Labeled metric values storage extension
 */
interface LabeledMetric {
  labeledValues?: Map<string, number>;
}

/**
 * Extend CounterMetric interface
 */
interface ExtendedCounterMetric extends CounterMetric, LabeledMetric {}

/**
 * Extend GaugeMetric interface
 */
interface ExtendedGaugeMetric extends GaugeMetric, LabeledMetric {}
