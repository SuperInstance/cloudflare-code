// @ts-nocheck
import { MetricData } from '../types';

export class MetricsHelper {
  private static instance: MetricsHelper;
  private metrics: Map<string, MetricData[]> = new Map();

  static getInstance(): MetricsHelper {
    if (!MetricsHelper.instance) {
      MetricsHelper.instance = new MetricsHelper();
    }
    return MetricsHelper.instance;
  }

  recordMetric(metric: MetricData): void {
    if (!this.metrics.has(metric.metric)) {
      this.metrics.set(metric.metric, []);
    }

    const metrics = this.metrics.get(metric.metric)!;
    metrics.push(metric);

    // Keep only last 1000 metrics per type
    if (metrics.length > 1000) {
      metrics.shift();
    }
  }

  getMetrics(metricName: string, options?: {
    service?: string;
    from?: Date;
    to?: Date;
  }): MetricData[] {
    const metrics = this.metrics.get(metricName) || [];

    if (!options) {
      return metrics;
    }

    return metrics.filter(metric => {
      if (options.service && metric.service !== options.service) {
        return false;
      }
      if (options.from && metric.timestamp < options.from) {
        return false;
      }
      if (options.to && metric.timestamp > options.to) {
        return false;
      }
      return true;
    });
  }

  getAggregatedMetrics(metricName: string, timeWindow: number = 60000): any {
    const metrics = this.metrics.get(metricName) || [];
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindow);

    const windowedMetrics = metrics.filter(m => m.timestamp >= windowStart);

    if (windowedMetrics.length === 0) {
      return null;
    }

    const values = windowedMetrics.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      metricName,
      timeWindow,
      count: values.length,
      sum,
      average: avg,
      min,
      max,
      timestamp: now
    };
  }

  clearMetrics(): void {
    this.metrics.clear();
  }
}