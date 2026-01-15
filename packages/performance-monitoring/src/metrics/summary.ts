/**
 * Summary metric implementation
 * A summary samples observations (usually things like request durations and response sizes)
 * and provides a total count and sum of observations and configurable quantiles over a sliding time window
 */

import { EventEmitter } from 'eventemitter3';
import { SummaryMetric, SummaryOptions, MetricValue } from '../types';

const DEFAULT_QUANTILES = [0.01, 0.05, 0.5, 0.9, 0.95, 0.99];
const DEFAULT_MAX_AGE = 10 * 60 * 1000; // 10 minutes
const DEFAULT_AGE_BUCKETS = 5;

export class Summary {
  private metric: SummaryMetric;
  private eventEmitter: EventEmitter;
  private options: Required<SummaryOptions>;
  private valueBuckets: Array<{ values: number[]; timestamp: number }>;

  constructor(
    name: string,
    help: string,
    options: SummaryOptions = {}
  ) {
    this.options = {
      quantiles: options.quantiles || DEFAULT_QUANTILES,
      maxAge: options.maxAge || DEFAULT_MAX_AGE,
      ageBuckets: options.ageBuckets || DEFAULT_AGE_BUCKETS,
      labels: options.labels || {}
    };

    this.metric = {
      name,
      type: 'summary',
      help,
      values: [],
      labels: this.options.labels,
      quantiles: this.options.quantiles,
      sampleCount: 0,
      sampleSum: 0
    };

    // Initialize age buckets for sliding window
    this.valueBuckets = [];
    for (let i = 0; i < this.options.ageBuckets; i++) {
      this.valueBuckets.push({ values: [], timestamp: Date.now() });
    }

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
    this.metric.sampleSum += value;
    this.metric.sampleCount++;

    // Add to current bucket
    this.addToCurrentBucket(value);

    // Rotate buckets if needed
    this.rotateBuckets();

    this.eventEmitter.emit('observe', {
      metric: this.metric.name,
      value,
      labels,
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
   * Reset the summary
   */
  reset(): void {
    this.metric.sampleCount = 0;
    this.metric.sampleSum = 0;
    this.metric.values = [];
    this.valueBuckets = [];

    for (let i = 0; i < this.options.ageBuckets; i++) {
      this.valueBuckets.push({ values: [], timestamp: Date.now() });
    }

    this.eventEmitter.emit('reset', {
      metric: this.metric.name,
      timestamp: Date.now()
    });
  }

  /**
   * Get the count of observations
   */
  getCount(): number {
    return this.metric.sampleCount;
  }

  /**
   * Get the sum of all observations
   */
  getSum(): number {
    return this.metric.sampleSum;
  }

  /**
   * Get the complete metric object
   */
  getMetric(): SummaryMetric {
    return { ...this.metric };
  }

  /**
   * Calculate quantile
   */
  getQuantile(quantile: number): number {
    const values = this.getValuesInWindow();

    if (values.length === 0) {
      return 0;
    }

    const sorted = values.sort((a, b) => a - b);
    const pos = (sorted.length - 1) * quantile;
    const base = Math.floor(pos);
    const rest = pos - base;

    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    }

    return sorted[base];
  }

  /**
   * Get all configured quantiles
   */
  getQuantiles(): Map<number, number> {
    const result = new Map<number, number>();

    for (const quantile of this.metric.quantiles) {
      result.set(quantile, this.getQuantile(quantile));
    }

    return result;
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
    quantiles: Map<number, number>;
  } {
    const values = this.getValuesInWindow();

    return {
      count: this.metric.sampleCount,
      sum: this.metric.sampleSum,
      avg: this.metric.sampleCount > 0
        ? this.metric.sampleSum / this.metric.sampleCount
        : 0,
      min: values.length > 0 ? Math.min(...values) : 0,
      max: values.length > 0 ? Math.max(...values) : 0,
      quantiles: this.getQuantiles()
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
   * Add value to current bucket
   */
  private addToCurrentBucket(value: number): void {
    const currentBucket = this.valueBuckets[0];
    currentBucket.values.push(value);
  }

  /**
   * Rotate buckets based on time
   */
  private rotateBuckets(): void {
    const now = Date.now();
    const bucketDuration = this.options.maxAge / this.options.ageBuckets;

    // Check if we need to rotate
    if (now - this.valueBuckets[0].timestamp >= bucketDuration) {
      // Shift buckets
      this.valueBuckets.pop();
      this.valueBuckets.unshift({ values: [], timestamp: now });
    }
  }

  /**
   * Get all values in the sliding time window
   */
  private getValuesInWindow(): number[] {
    const now = Date.now();
    const values: number[] = [];

    for (const bucket of this.valueBuckets) {
      // Check if bucket is within the time window
      if (now - bucket.timestamp <= this.options.maxAge) {
        values.push(...bucket.values);
      }
    }

    return values;
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
    output += `# TYPE ${this.metric.name} summary\n`;

    const labelStr = this.metric.labels
      ? this.formatLabels(this.metric.labels)
      : '';
    const baseName = this.metric.name;

    // Quantiles
    const quantiles = this.getQuantiles();
    for (const [quantile, value] of quantiles.entries()) {
      const quantileLabel = labelStr
        ? labelStr.slice(0, -1) + ',quantile="' + quantile + '"}'
        : `{quantile="${quantile}"}`;
      output += `${baseName}${quantileLabel} ${value}\n`;
    }

    // Sum
    output += `${baseName}_sum${labelStr} ${this.metric.sampleSum}\n`;

    // Count
    output += `${baseName}_count${labelStr} ${this.metric.sampleCount}\n`;

    return output;
  }

  private formatLabels(labels: Record<string, string>): string {
    const pairs = Object.entries(labels).map(([k, v]) => `${k}="${v}"`);
    return `{${pairs.join(',')}}`;
  }
}

/**
 * Summary registry for managing multiple summaries
 */
export class SummaryRegistry {
  private summaries: Map<string, Summary>;
  private eventEmitter: EventEmitter;

  constructor() {
    this.summaries = new Map();
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Create or get a summary
   */
  getOrCreate(
    name: string,
    help: string,
    options?: SummaryOptions
  ): Summary {
    if (!this.summaries.has(name)) {
      const summary = new Summary(name, help, options);
      this.summaries.set(name, summary);

      // Forward summary events to registry
      summary.on('observe', (data) => {
        this.eventEmitter.emit('summary:observe', data);
      });

      this.eventEmitter.emit('summary:created', { name, help, options });
    }

    return this.summaries.get(name)!;
  }

  /**
   * Get a specific summary
   */
  get(name: string): Summary | undefined {
    return this.summaries.get(name);
  }

  /**
   * Get all summaries
   */
  getAll(): Summary[] {
    return Array.from(this.summaries.values());
  }

  /**
   * Remove a summary
   */
  delete(name: string): boolean {
    const summary = this.summaries.get(name);
    if (summary) {
      this.summaries.delete(name);
      this.eventEmitter.emit('summary:deleted', { name });
      return true;
    }
    return false;
  }

  /**
   * Clear all summaries
   */
  clear(): void {
    this.summaries.clear();
    this.eventEmitter.emit('summaries:cleared');
  }

  /**
   * Export all summaries in Prometheus format
   */
  toPrometheus(): string {
    return this.getAll()
      .map(summary => summary.toPrometheus())
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
