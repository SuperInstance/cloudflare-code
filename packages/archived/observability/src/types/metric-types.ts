export interface MetricOptions {
  name: string;
  description?: string;
  unit?: string;
  labels?: Record<string, string>;
  enabled?: boolean;
}

export interface CounterOptions extends MetricOptions {
  initialValue?: number;
}

export interface GaugeOptions extends MetricOptions {
  initialValue?: number;
}

export interface HistogramOptions extends MetricOptions {
  buckets?: number[];
  min?: number;
  max?: number;
}

export interface MetricData {
  name: string;
  type: MetricType;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary' | 'updowncounter' | 'histogramagg';

export interface AggregationWindow {
  duration: number;
  alignTo?: number;
}

export interface PercentileValues {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface MetricExportOptions {
  format: 'prometheus' | 'cloudflare' | 'json' | 'otlp';
  includeTimestamp?: boolean;
  aggregationWindow?: AggregationWindow;
  compression?: boolean;
}

export interface MetricDescriptor {
  name: string;
  description: string;
  type: MetricType;
  unit: string;
  labelKeys: string[];
  aggregationTemporality: 'cumulative' | 'delta';
  monotonic: boolean;
}

export interface MetricAggregator {
  update(value: number, labels: Record<string, string>): void;
  export(): MetricData[];
}

export interface MetricRegistry {
  register(descriptor: MetricDescriptor): MetricAggregator;
  get(name: string): MetricAggregator | undefined;
  list(): MetricDescriptor[];
}

export interface TimeSeriesData {
  timestamp: number;
  value: number;
  labels: Record<string, string>;
}

export interface TimeSeriesQuery {
  metricName: string;
  labelFilters?: Record<string, string>;
  aggregation: AggregationType;
  timeRange: TimeRange;
  interval?: number;
}

export type AggregationType = 'avg' | 'sum' | 'max' | 'min' | 'count' | 'p50' | 'p90' | 'p95' | 'p99';

export interface TimeRange {
  start: number;
  end: number;
}

export interface MetricQueryResult {
  metricName: string;
  data: TimeSeriesData[];
  labels: Record<string, string>;
}

export interface DimensionalMetrics {
  metricName: string;
  dimensions: string[];
  data: Array<{
    dimensionValues: Record<string, string>;
    timeSeries: TimeSeriesData[];
  }>;
}