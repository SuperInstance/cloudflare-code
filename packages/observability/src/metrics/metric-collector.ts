import { MetricOptions, MetricData, MetricType, CounterOptions, GaugeOptions, HistogramOptions } from '../types/metric-types';
import { MetricRegistry } from '../types/metric-types';
import { TelemetryManager } from '../core/telemetry-manager';
import { Utils } from '../core/utils';

export class MetricCollector implements MetricRegistry {
  private metrics: Map<string, MetricDescriptor> = new Map();
  private aggregators: Map<string, MetricAggregator> = new Map();
  private telemetryManager: TelemetryManager;
  private initialized: boolean = false;

  constructor() {
    this.telemetryManager = TelemetryManager.getInstance();
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.telemetryManager = TelemetryManager.getInstance();
    await this.telemetryManager.initialize();

    this.initialized = true;
  }

  public async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.metrics.clear();
    this.aggregators.clear();
    this.initialized = false;
  }

  public register(descriptor: MetricDescriptor): MetricAggregator {
    const existing = this.metrics.get(descriptor.name);
    if (existing) {
      throw new Error(`Metric ${descriptor.name} is already registered`);
    }

    this.metrics.set(descriptor.name, descriptor);
    const aggregator = this.createAggregator(descriptor);
    this.aggregators.set(descriptor.name, aggregator);

    return aggregator;
  }

  public get(name: string): MetricAggregator | undefined {
    return this.aggregators.get(name);
  }

  public list(): MetricDescriptor[] {
    return Array.from(this.metrics.values());
  }

  public createCounter(name: string, options: CounterOptions = {}): MetricAggregator {
    const descriptor: MetricDescriptor = {
      name,
      description: options.description || '',
      type: 'counter',
      unit: options.unit || '',
      labelKeys: Object.keys(options.labels || {}),
      aggregationTemporality: 'cumulative',
      monotonic: true
    };

    return this.register(descriptor);
  }

  public createGauge(name: string, options: GaugeOptions = {}): MetricAggregator {
    const descriptor: MetricDescriptor = {
      name,
      description: options.description || '',
      type: 'gauge',
      unit: options.unit || '',
      labelKeys: Object.keys(options.labels || {}),
      aggregationTemporality: 'delta',
      monotonic: false
    };

    return this.register(descriptor);
  }

  public createHistogram(name: string, options: HistogramOptions = {}): MetricAggregator {
    const descriptor: MetricDescriptor = {
      name,
      description: options.description || '',
      type: 'histogramagg',
      unit: options.unit || '',
      labelKeys: Object.keys(options.labels || {}),
      aggregationTemporality: 'delta',
      monotonic: false
    };

    return this.register(descriptor);
  }

  public createSummary(name: string, options: MetricOptions = {}): MetricAggregator {
    const descriptor: MetricDescriptor = {
      name,
      description: options.description || '',
      type: 'summary',
      unit: options.unit || '',
      labelKeys: Object.keys(options.labels || {}),
      aggregationTemporality: 'delta',
      monotonic: false
    };

    return this.register(descriptor);
  }

  public createUpDownCounter(name: string, options: MetricOptions = {}): MetricAggregator {
    const descriptor: MetricDescriptor = {
      name,
      description: options.description || '',
      type: 'updowncounter',
      unit: options.unit || '',
      labelKeys: Object.keys(options.labels || {}),
      aggregationTemporality: 'delta',
      monotonic: false
    };

    return this.register(descriptor);
  }

  private createAggregator(descriptor: MetricDescriptor): MetricAggregator {
    switch (descriptor.type) {
      case 'counter':
        return new CounterAggregator(descriptor);
      case 'gauge':
        return new GaugeAggregator(descriptor);
      case 'histogramagg':
        return new HistogramAggregator(descriptor);
      case 'summary':
        return new SummaryAggregator(descriptor);
      case 'updowncounter':
        return new UpDownCounterAggregator(descriptor);
      default:
        throw new Error(`Unsupported metric type: ${descriptor.type}`);
    }
  }

  public export(): MetricData[] {
    const results: MetricData[] = [];

    for (const [name, aggregator] of this.aggregators) {
      const descriptor = this.metrics.get(name);
      if (descriptor && descriptor.enabled !== false) {
        results.push(...aggregator.export());
      }
    }

    return results;
  }

  public reset(): void {
    for (const aggregator of this.aggregators.values()) {
      aggregator.reset();
    }
  }

  public isEnabled(name: string): boolean {
    const descriptor = this.metrics.get(name);
    return descriptor?.enabled !== false;
  }

  public setEnabled(name: string, enabled: boolean): void {
    const descriptor = this.metrics.get(name);
    if (descriptor) {
      descriptor.enabled = enabled;
    }
  }

  public getMetricInfo(name: string): MetricDescriptor | undefined {
    return this.metrics.get(name);
  }

  public getTotalMetricsCount(): number {
    return this.metrics.size;
  }

  public getEnabledMetricsCount(): number {
    return Array.from(this.metrics.values()).filter(m => m.enabled !== false).length;
  }
}

// Metric Aggregator Implementations
abstract class MetricAggregator {
  protected descriptor: MetricDescriptor;
  protected data: Map<string, TimeSeriesData[]> = new Map();

  constructor(descriptor: MetricDescriptor) {
    this.descriptor = descriptor;
  }

  abstract update(value: number, labels: Record<string, string>): void;
  abstract export(): MetricData[];

  protected getLabelKey(labels: Record<string, string>): string {
    const labelString = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
    return labelString;
  }

  protected addDataPoint(value: number, labels: Record<string, string>): void {
    const key = this.getLabelKey(labels);

    if (!this.data.has(key)) {
      this.data.set(key, []);
    }

    const series = this.data.get(key)!;
    series.push({
      timestamp: Date.now(),
      value,
      labels: { ...labels }
    });

    // Keep only recent data points
    if (series.length > 1000) {
      series.splice(0, series.length - 1000);
    }
  }

  public reset(): void {
    this.data.clear();
  }

  public getDataPointsCount(): number {
    let total = 0;
    for (const series of this.data.values()) {
      total += series.length;
    }
    return total;
  }

  protected createMetricData(value: number, labels: Record<string, string>): MetricData {
    return {
      name: this.descriptor.name,
      type: this.descriptor.type,
      value,
      labels,
      timestamp: Date.now()
    };
  }
}

class CounterAggregator extends MetricAggregator {
  private values: Map<string, number> = new Map();

  constructor(descriptor: MetricDescriptor) {
    super(descriptor);
    // Initialize with initial value if provided
    const initialValue = (descriptor as any).initialValue || 0;
    if (initialValue > 0) {
      this.values.set('', initialValue);
    }
  }

  update(value: number, labels: Record<string, string> = {}): void {
    const key = this.getLabelKey(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current + value);
    this.addDataPoint(current + value, labels);
  }

  export(): MetricData[] {
    const results: MetricData[] = [];

    for (const [key, value] of this.values) {
      const labels = key ? this.parseLabels(key) : {};
      results.push(this.createMetricData(value, labels));
    }

    return results;
  }

  private parseLabels(labelString: string): Record<string, string> {
    const labels: Record<string, string> = {};
    const parts = labelString.split(',');

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key && value) {
        labels[key] = value;
      }
    }

    return labels;
  }
}

class GaugeAggregator extends MetricAggregator {
  private values: Map<string, number> = new Map();

  constructor(descriptor: MetricDescriptor) {
    super(descriptor);
    const initialValue = (descriptor as any).initialValue || 0;
    if (initialValue !== 0) {
      this.values.set('', initialValue);
    }
  }

  update(value: number, labels: Record<string, string> = {}): void {
    const key = this.getLabelKey(labels);
    this.values.set(key, value);
    this.addDataPoint(value, labels);
  }

  export(): MetricData[] {
    const results: MetricData[] = [];

    for (const [key, value] of this.values) {
      const labels = key ? this.parseLabels(key) : {};
      results.push(this.createMetricData(value, labels));
    }

    return results;
  }

  private parseLabels(labelString: string): Record<string, string> {
    const labels: Record<string, string> = {};
    const parts = labelString.split(',');

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key && value) {
        labels[key] = value;
      }
    }

    return labels;
  }
}

class HistogramAggregator extends MetricAggregator {
  private values: Map<string, number[]> = new Map();
  private options: HistogramOptions;

  constructor(descriptor: MetricDescriptor) {
    super(descriptor);
    this.options = descriptor as HistogramOptions;
    this.initializeBuckets();
  }

  private initializeBuckets(): void {
    const buckets = this.options.buckets || [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10];

    for (const bucket of buckets) {
      const key = `bucket_${bucket}`;
      this.values.set(key, []);
    }
  }

  update(value: number, labels: Record<string, string> = {}): void {
    const key = this.getLabelKey(labels);

    if (!this.values.has(key)) {
      this.values.set(key, []);
    }

    const series = this.values.get(key)!;
    series.push(value);

    // Keep only recent data points
    if (series.length > 1000) {
      series.splice(0, series.length - 1000);
    }
  }

  export(): MetricData[] {
    const results: MetricData[] = [];

    for (const [key, values] of this.values) {
      const labels = key.startsWith('bucket_') ? { bucket: key.split('bucket_')[1] } : this.parseLabels(key);

      if (values.length === 0) continue;

      const sorted = values.sort((a, b) => a - b);
      const histogram = {
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        sum: values.reduce((acc, val) => acc + val, 0),
        avg: values.reduce((acc, val) => acc + val, 0) / values.length,
        p50: this.percentile(sorted, 50),
        p90: this.percentile(sorted, 90),
        p95: this.percentile(sorted, 95),
        p99: this.percentile(sorted, 99)
      };

      results.push(this.createMetricData(histogram.count, { ...labels, metric: 'count' }));
      results.push(this.createMetricData(histogram.avg, { ...labels, metric: 'avg' }));
      results.push(this.createMetricData(histogram.p95, { ...labels, metric: 'p95' }));
    }

    return results;
  }

  private percentile(sortedValues: number[], p: number): number {
    const index = Math.ceil((p / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  private parseLabels(labelString: string): Record<string, string> {
    const labels: Record<string, string> = {};
    const parts = labelString.split(',');

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key && value) {
        labels[key] = value;
      }
    }

    return labels;
  }
}

class SummaryAggregator extends MetricAggregator {
  private values: Map<string, number[]> = new Map();

  constructor(descriptor: MetricDescriptor) {
    super(descriptor);
  }

  update(value: number, labels: Record<string, string> = {}): void {
    const key = this.getLabelKey(labels);

    if (!this.values.has(key)) {
      this.values.set(key, []);
    }

    const series = this.values.get(key)!;
    series.push(value);

    // Keep only recent data points
    if (series.length > 1000) {
      series.splice(0, series.length - 1000);
    }
  }

  export(): MetricData[] {
    const results: MetricData[] = [];

    for (const [key, values] of this.values) {
      const labels = this.parseLabels(key);

      if (values.length === 0) continue;

      const sorted = values.sort((a, b) => a - b);
      const summary = {
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        sum: values.reduce((acc, val) => acc + val, 0),
        avg: values.reduce((acc, val) => acc + val, 0) / values.length,
        p50: this.percentile(sorted, 50),
        p90: this.percentile(sorted, 90),
        p95: this.percentile(sorted, 95),
        p99: this.percentile(sorted, 99)
      };

      results.push(this.createMetricData(summary.count, { ...labels, metric: 'count' }));
      results.push(this.createMetricData(summary.avg, { ...labels, metric: 'avg' }));
      results.push(this.createMetricData(summary.p95, { ...labels, metric: 'p95' }));
    }

    return results;
  }

  private percentile(sortedValues: number[], p: number): number {
    const index = Math.ceil((p / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
  }

  private parseLabels(labelString: string): Record<string, string> {
    const labels: Record<string, string> = {};
    const parts = labelString.split(',');

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key && value) {
        labels[key] = value;
      }
    }

    return labels;
  }
}

class UpDownCounterAggregator extends MetricAggregator {
  private values: Map<string, number> = new Map();

  constructor(descriptor: MetricDescriptor) {
    super(descriptor);
    const initialValue = (descriptor as any).initialValue || 0;
    if (initialValue !== 0) {
      this.values.set('', initialValue);
    }
  }

  update(value: number, labels: Record<string, string> = {}): void {
    const key = this.getLabelKey(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current + value);
    this.addDataPoint(current + value, labels);
  }

  export(): MetricData[] {
    const results: MetricData[] = [];

    for (const [key, value] of this.values) {
      const labels = key ? this.parseLabels(key) : {};
      results.push(this.createMetricData(value, labels));
    }

    return results;
  }

  private parseLabels(labelString: string): Record<string, string> {
    const labels: Record<string, string> = {};
    const parts = labelString.split(',');

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key && value) {
        labels[key] = value;
      }
    }

    return labels;
  }
}

// Export types
export type MetricAggregator = any;
export type MetricDescriptor = any;
export type TimeSeriesData = any;

export default MetricCollector;