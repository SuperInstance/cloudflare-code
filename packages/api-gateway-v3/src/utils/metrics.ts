/**
 * Metrics Collector - Metrics collection utility
 */

export interface Metric {
  name: string;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export class MetricsCollector {
  private metrics: Map<string, Metric[]>;
  private aggregations: Map<string, number>;

  constructor() {
    this.metrics = new Map();
    this.aggregations = new Map();
  }

  record(metric: Metric): void {
    const metrics = this.metrics.get(metric.name) || [];
    metrics.push(metric);
    this.metrics.set(metric.name, metrics);
  }

  increment(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.createKey(name, labels);
    const current = this.aggregations.get(key) || 0;
    this.aggregations.set(key, current + value);
  }

  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.createKey(name, labels);
    this.aggregations.set(key, value);
  }

  timing(name: string, duration: number, labels?: Record<string, string>): void {
    this.record({
      name,
      value: duration,
      timestamp: Date.now(),
      labels,
    });
  }

  getMetric(name: string): Metric[] {
    return this.metrics.get(name) || [];
  }

  getAggregation(name: string, labels?: Record<string, string>): number | undefined {
    const key = this.createKey(name, labels);
    return this.aggregations.get(key);
  }

  private createKey(name: string, labels?: Record<string, string>): string {
    if (!labels) {
      return name;
    }
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  reset(): void {
    this.metrics.clear();
    this.aggregations.clear();
  }
}
