/**
 * Gauge metric implementation
 * A gauge is a metric that represents a single numerical value that can arbitrarily go up and down
 */

import { EventEmitter } from 'eventemitter3';
import { GaugeMetric, GaugeOperation, MetricValue } from '../types';

export class Gauge {
  private metric: GaugeMetric;
  private eventEmitter: EventEmitter;

  constructor(name: string, help: string, labels?: Record<string, string>) {
    this.metric = {
      name,
      type: 'gauge',
      help,
      values: [],
      labels,
      value: 0
    };
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Set the gauge to a specific value
   */
  set(value: number, labels?: Record<string, string | number>): void {
    const metricValue: MetricValue = {
      value,
      timestamp: Date.now(),
      labels
    };

    this.metric.value = value;
    this.metric.values.push(metricValue);

    this.eventEmitter.emit('set', {
      metric: this.metric.name,
      value,
      labels,
      timestamp: metricValue.timestamp
    });
  }

  /**
   * Increment the gauge by a specific value
   */
  increment(value: number = 1, labels?: Record<string, string | number>): void {
    const newValue = this.metric.value + value;
    this.set(newValue, labels);
  }

  /**
   * Increment the gauge by one
   */
  inc(labels?: Record<string, string | number>): void {
    this.increment(1, labels);
  }

  /**
   * Decrement the gauge by a specific value
   */
  decrement(value: number = 1, labels?: Record<string, string | number>): void {
    const newValue = this.metric.value - value;
    this.set(newValue, labels);
  }

  /**
   * Decrement the gauge by one
   */
  dec(labels?: Record<string, string | number>): void {
    this.decrement(1, labels);
  }

  /**
   * Execute a function and track the duration
   */
  async trackDuration<T>(
    fn: () => Promise<T> | T,
    labels?: Record<string, string | number>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.set(duration, labels);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.set(duration, labels);
      throw error;
    }
  }

  /**
   * Set the gauge to the current Unix timestamp
   */
  setToCurrentTime(labels?: Record<string, string | number>): void {
    this.set(Date.now() / 1000, labels);
  }

  /**
   * Get the current value
   */
  get(): number {
    return this.metric.value;
  }

  /**
   * Get the complete metric object
   */
  getMetric(): GaugeMetric {
    return { ...this.metric };
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
   * Calculate statistics over a time window
   */
  getStatistics(windowMs: number): {
    min: number;
    max: number;
    avg: number;
    current: number;
  } {
    const now = Date.now();
    const windowStart = now - windowMs;
    const values = this.getValues(windowStart, now);

    if (values.length === 0) {
      return { min: 0, max: 0, avg: 0, current: this.metric.value };
    }

    const nums = values.map(v => v.value);
    return {
      min: Math.min(...nums),
      max: Math.max(...nums),
      avg: nums.reduce((a, b) => a + b, 0) / nums.length,
      current: this.metric.value
    };
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
    output += `# TYPE ${this.metric.name} gauge\n`;

    if (this.metric.labels) {
      const labelStr = this.formatLabels(this.metric.labels);
      output += `${this.metric.name}${labelStr} ${this.metric.value}\n`;
    } else {
      output += `${this.metric.name} ${this.metric.value}\n`;
    }

    return output;
  }

  private formatLabels(labels: Record<string, string>): string {
    const pairs = Object.entries(labels).map(([k, v]) => `${k}="${v}"`);
    return `{${pairs.join(',')}}`;
  }
}

/**
 * Gauge registry for managing multiple gauges
 */
export class GaugeRegistry {
  private gauges: Map<string, Gauge>;
  private eventEmitter: EventEmitter;

  constructor() {
    this.gauges = new Map();
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Create or get a gauge
   */
  getOrCreate(name: string, help: string, labels?: Record<string, string>): Gauge {
    if (!this.gauges.has(name)) {
      const gauge = new Gauge(name, help, labels);
      this.gauges.set(name, gauge);

      // Forward gauge events to registry
      gauge.on('set', (data) => {
        this.eventEmitter.emit('gauge:set', data);
      });

      this.eventEmitter.emit('gauge:created', { name, help, labels });
    }

    return this.gauges.get(name)!;
  }

  /**
   * Get a specific gauge
   */
  get(name: string): Gauge | undefined {
    return this.gauges.get(name);
  }

  /**
   * Get all gauges
   */
  getAll(): Gauge[] {
    return Array.from(this.gauges.values());
  }

  /**
   * Remove a gauge
   */
  delete(name: string): boolean {
    const gauge = this.gauges.get(name);
    if (gauge) {
      this.gauges.delete(name);
      this.eventEmitter.emit('gauge:deleted', { name });
      return true;
    }
    return false;
  }

  /**
   * Clear all gauges
   */
  clear(): void {
    this.gauges.clear();
    this.eventEmitter.emit('gauges:cleared');
  }

  /**
   * Export all gauges in Prometheus format
   */
  toPrometheus(): string {
    return this.getAll()
      .map(gauge => gauge.toPrometheus())
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
