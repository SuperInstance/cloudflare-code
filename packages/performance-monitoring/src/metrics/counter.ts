/**
 * Counter metric implementation
 * A counter is a cumulative metric that represents a single monotonically increasing counter
 */

import { EventEmitter } from 'eventemitter3';
import { CounterMetric, CounterIncrement, MetricValue } from '../types';

export class Counter {
  private metric: CounterMetric;
  private eventEmitter: EventEmitter;

  constructor(name: string, help: string, labels?: Record<string, string>) {
    this.metric = {
      name,
      type: 'counter',
      help,
      values: [],
      labels,
      total: 0,
      created: Date.now()
    };
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Increment the counter by a specific value
   */
  increment(value: number = 1, labels?: Record<string, string | number>): void {
    const metricValue: MetricValue = {
      value,
      timestamp: Date.now(),
      labels
    };

    this.metric.total += value;
    this.metric.values.push(metricValue);

    // Emit event for real-time monitoring
    this.eventEmitter.emit('increment', {
      metric: this.metric.name,
      value,
      labels,
      total: this.metric.total,
      timestamp: metricValue.timestamp
    });
  }

  /**
   * Increment the counter by one
   */
  inc(labels?: Record<string, string | number>): void {
    this.increment(1, labels);
  }

  /**
   * Reset the counter to zero
   */
  reset(): void {
    this.metric.total = 0;
    this.metric.values = [];
    this.eventEmitter.emit('reset', {
      metric: this.metric.name,
      timestamp: Date.now()
    });
  }

  /**
   * Get the current total value
   */
  get(): number {
    return this.metric.total;
  }

  /**
   * Get the complete metric object
   */
  getMetric(): CounterMetric {
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
   * Calculate rate over a time window
   */
  getRate(windowMs: number): number {
    const now = Date.now();
    const windowStart = now - windowMs;
    const values = this.getValues(windowStart, now);

    if (values.length === 0) {
      return 0;
    }

    const sum = values.reduce((acc, v) => acc + v.value, 0);
    return sum / (windowMs / 1000); // per second
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
    output += `# TYPE ${this.metric.name} counter\n`;

    if (this.metric.labels) {
      const labelStr = this.formatLabels(this.metric.labels);
      output += `${this.metric.name}${labelStr} ${this.metric.total}\n`;
    } else {
      output += `${this.metric.name} ${this.metric.total}\n`;
    }

    return output;
  }

  private formatLabels(labels: Record<string, string>): string {
    const pairs = Object.entries(labels).map(([k, v]) => `${k}="${v}"`);
    return `{${pairs.join(',')}}`;
  }
}

/**
 * Counter registry for managing multiple counters
 */
export class CounterRegistry {
  private counters: Map<string, Counter>;
  private eventEmitter: EventEmitter;

  constructor() {
    this.counters = new Map();
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Create or get a counter
   */
  getOrCreate(name: string, help: string, labels?: Record<string, string>): Counter {
    if (!this.counters.has(name)) {
      const counter = new Counter(name, help, labels);
      this.counters.set(name, counter);

      // Forward counter events to registry
      counter.on('increment', (data) => {
        this.eventEmitter.emit('counter:increment', data);
      });

      this.eventEmitter.emit('counter:created', { name, help, labels });
    }

    return this.counters.get(name)!;
  }

  /**
   * Get a specific counter
   */
  get(name: string): Counter | undefined {
    return this.counters.get(name);
  }

  /**
   * Get all counters
   */
  getAll(): Counter[] {
    return Array.from(this.counters.values());
  }

  /**
   * Remove a counter
   */
  delete(name: string): boolean {
    const counter = this.counters.get(name);
    if (counter) {
      this.counters.delete(name);
      this.eventEmitter.emit('counter:deleted', { name });
      return true;
    }
    return false;
  }

  /**
   * Clear all counters
   */
  clear(): void {
    this.counters.clear();
    this.eventEmitter.emit('counters:cleared');
  }

  /**
   * Export all counters in Prometheus format
   */
  toPrometheus(): string {
    return this.getAll()
      .map(counter => counter.toPrometheus())
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
