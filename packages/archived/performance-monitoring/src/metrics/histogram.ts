/**
 * Histogram metric implementation
 * A histogram samples observations (usually things like request durations or response sizes)
 * and counts them in configurable buckets
 */

import { EventEmitter } from 'eventemitter3';
import { HistogramMetric, HistogramOptions, HistogramBucket, MetricValue } from '../types';

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

export class Histogram {
  private metric: HistogramMetric;
  private eventEmitter: EventEmitter;
  private options: HistogramOptions;

  constructor(
    name: string,
    help: string,
    options: HistogramOptions = {}
  ) {
    this.options = {
      buckets: options.buckets || DEFAULT_BUCKETS,
      labels: options.labels || {}
    };

    this.metric = {
      name,
      type: 'histogram',
      help,
      values: [],
      buckets: this.options.buckets!,
      labels: this.options.labels,
      counts: new Array(this.options.buckets!.length + 1).fill(0),
      sum: 0,
      count: 0
    };

    this.eventEmitter = new EventEmitter();
  }

  /**
   * Observe a value
   */
  observe(value: number, labels?: Record<string, string | number>): void {
    const metricValue: MetricValue = {
      value,
      timestamp: Date.now(),
      labels
    };

    this.metric.values.push(metricValue);
    this.metric.sum += value;
    this.metric.count++;

    // Find the appropriate bucket
    let bucketIndex = this.metric.buckets.length;
    for (let i = 0; i < this.metric.buckets.length; i++) {
      if (value <= this.metric.buckets[i]) {
        bucketIndex = i;
        break;
      }
    }

    this.metric.counts[bucketIndex]++;

    this.eventEmitter.emit('observe', {
      metric: this.metric.name,
      value,
      labels,
      bucket: bucketIndex,
      timestamp: metricValue.timestamp
    });
  }

  /**
   * Start a timer and return a function that stops it and observes the duration
   */
  startTimer(labels?: Record<string, string | number>): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.observe(duration, labels);
    };
  }

  /**
   * Execute a function and track the duration
   */
  async trackDuration<T>(
    fn: () => Promise<T> | T,
    labels?: Record<string, string | number>
  ): Promise<T> {
    const end = this.startTimer(labels);
    try {
      const result = await fn();
      end();
      return result;
    } catch (error) {
      end();
      throw error;
    }
  }

  /**
   * Reset the histogram
   */
  reset(): void {
    this.metric.counts = new Array(this.metric.buckets.length + 1).fill(0);
    this.metric.sum = 0;
    this.metric.count = 0;
    this.metric.values = [];

    this.eventEmitter.emit('reset', {
      metric: this.metric.name,
      timestamp: Date.now()
    });
  }

  /**
   * Get the count of observations
   */
  getCount(): number {
    return this.metric.count;
  }

  /**
   * Get the sum of all observations
   */
  getSum(): number {
    return this.metric.sum;
  }

  /**
   * Get the complete metric object
   */
  getMetric(): HistogramMetric {
    return { ...this.metric };
  }

  /**
   * Get bucket counts
   */
  getBuckets(): HistogramBucket[] {
    const buckets: HistogramBucket[] = [];

    let cumulativeCount = 0;
    for (let i = 0; i < this.metric.buckets.length; i++) {
      cumulativeCount += this.metric.counts[i];
      buckets.push({
        le: this.metric.buckets[i].toString(),
        count: cumulativeCount
      });
    }

    // Add the +Inf bucket
    cumulativeCount += this.metric.counts[this.metric.buckets.length];
    buckets.push({
      le: '+Inf',
      count: cumulativeCount
    });

    return buckets;
  }

  /**
   * Calculate percentiles
   */
  getPercentile(percentile: number): number {
    if (this.metric.count === 0) {
      return 0;
    }

    const sortedValues = this.metric.values
      .map(v => v.value)
      .sort((a, b) => a - b);

    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  /**
   * Get common percentiles
   */
  getPercentiles(): Record<string, number> {
    return {
      p50: this.getPercentile(50),
      p75: this.getPercentile(75),
      p90: this.getPercentile(90),
      p95: this.getPercentile(95),
      p99: this.getPercentile(99),
      p999: this.getPercentile(99.9)
    };
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    percentiles: Record<string, number>;
  } {
    const values = this.metric.values.map(v => v.value);

    return {
      count: this.metric.count,
      sum: this.metric.sum,
      avg: this.metric.count > 0 ? this.metric.sum / this.metric.count : 0,
      min: values.length > 0 ? Math.min(...values) : 0,
      max: values.length > 0 ? Math.max(...values) : 0,
      percentiles: this.getPercentiles()
    };
  }

  /**
   * Get values within a time range
   */
  getValues(startTime: number, endTime: number): MetricValue[] {
    return this.metric.values.filter(
      v => v.timestamp >= startTime && v.timestamp <= endTime
    );
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
   * Get metric in Prometheus format
   */
  toPrometheus(): string {
    let output = `# HELP ${this.metric.name} ${this.metric.help}\n`;
    output += `# TYPE ${this.metric.name} histogram\n`;

    const labelStr = this.metric.labels
      ? this.formatLabels(this.metric.labels)
      : '';
    const baseName = this.metric.name;

    // Bucket counts
    const buckets = this.getBuckets();
    for (const bucket of buckets) {
      const bucketLabel = labelStr
        ? labelStr.slice(0, -1) + ',le="' + bucket.le + '"}'
        : `{le="${bucket.le}"}`;
      output += `${baseName}_bucket${bucketLabel} ${bucket.count}\n`;
    }

    // Sum
    output += `${baseName}_sum${labelStr} ${this.metric.sum}\n`;

    // Count
    output += `${baseName}_count${labelStr} ${this.metric.count}\n`;

    return output;
  }

  private formatLabels(labels: Record<string, string>): string {
    const pairs = Object.entries(labels).map(([k, v]) => `${k}="${v}"`);
    return `{${pairs.join(',')}}`;
  }
}

/**
 * Histogram registry for managing multiple histograms
 */
export class HistogramRegistry {
  private histograms: Map<string, Histogram>;
  private eventEmitter: EventEmitter;

  constructor() {
    this.histograms = new Map();
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Create or get a histogram
   */
  getOrCreate(
    name: string,
    help: string,
    options?: HistogramOptions
  ): Histogram {
    if (!this.histograms.has(name)) {
      const histogram = new Histogram(name, help, options);
      this.histograms.set(name, histogram);

      // Forward histogram events to registry
      histogram.on('observe', (data) => {
        this.eventEmitter.emit('histogram:observe', data);
      });

      this.eventEmitter.emit('histogram:created', { name, help, options });
    }

    return this.histograms.get(name)!;
  }

  /**
   * Get a specific histogram
   */
  get(name: string): Histogram | undefined {
    return this.histograms.get(name);
  }

  /**
   * Get all histograms
   */
  getAll(): Histogram[] {
    return Array.from(this.histograms.values());
  }

  /**
   * Remove a histogram
   */
  delete(name: string): boolean {
    const histogram = this.histograms.get(name);
    if (histogram) {
      this.histograms.delete(name);
      this.eventEmitter.emit('histogram:deleted', { name });
      return true;
    }
    return false;
  }

  /**
   * Clear all histograms
   */
  clear(): void {
    this.histograms.clear();
    this.eventEmitter.emit('histograms:cleared');
  }

  /**
   * Export all histograms in Prometheus format
   */
  toPrometheus(): string {
    return this.getAll()
      .map(histogram => histogram.toPrometheus())
      .join('\n');
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
}
