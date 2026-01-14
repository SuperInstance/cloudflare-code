/**
 * Metrics Collector for Load Testing
 *
 * Collects and aggregates metrics during load tests
 */

export interface MetricSample {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

export interface MetricAggregation {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  stdDev: number;
}

export class MetricsCollector {
  private metrics = new Map<string, MetricSample[]>();
  private aggregations = new Map<string, MetricAggregation>();

  /**
   * Record a metric sample
   */
  record(name: string, value: number, labels?: Record<string, string>): void {
    const samples = this.metrics.get(name) || [];
    samples.push({
      timestamp: Date.now(),
      value,
      labels,
    });
    this.metrics.set(name, samples);

    // Invalidate aggregation
    this.aggregations.delete(name);
  }

  /**
   * Get all samples for a metric
   */
  getSamples(name: string): MetricSample[] {
    return this.metrics.get(name) || [];
  }

  /**
   * Get aggregation for a metric
   */
  aggregate(name: string): MetricAggregation | undefined {
    // Return cached if available
    if (this.aggregations.has(name)) {
      return this.aggregations.get(name);
    }

    const samples = this.getSamples(name);
    if (samples.length === 0) {
      return undefined;
    }

    const values = samples.map((s) => s.value);
    values.sort((a, b) => a - b);

    const sum = values.reduce((a, b) => a + b, 0);
    const count = values.length;
    const avg = sum / count;
    const min = values[0];
    const max = values[values.length - 1];

    const p50 = this.percentile(values, 50);
    const p95 = this.percentile(values, 95);
    const p99 = this.percentile(values, 99);

    const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    const aggregation: MetricAggregation = {
      count,
      sum,
      min,
      max,
      avg,
      p50,
      p95,
      p99,
      stdDev,
    };

    this.aggregations.set(name, aggregation);
    return aggregation;
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.aggregations.clear();
  }

  /**
   * Clear a specific metric
   */
  clearMetric(name: string): void {
    this.metrics.delete(name);
    this.aggregations.delete(name);
  }

  /**
   * Get time series data for a metric
   */
  getTimeSeries(name: string, bucketSize = 1000): Array<{
    timestamp: number;
    value: number;
  }> {
    const samples = this.getSamples(name);
    if (samples.length === 0) {
      return [];
    }

    const buckets = new Map<number, number[]>();

    for (const sample of samples) {
      const bucketKey = Math.floor(sample.timestamp / bucketSize) * bucketSize;
      const values = buckets.get(bucketKey) || [];
      values.push(sample.value);
      buckets.set(bucketKey, values);
    }

    return Array.from(buckets.entries())
      .map(([timestamp, values]) => ({
        timestamp,
        value: values.reduce((a, b) => a + b, 0) / values.length,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (upper >= sorted.length) {
      return sorted[sorted.length - 1];
    }

    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * Export metrics as Prometheus format
   */
  exportPrometheus(): string {
    let output = '';

    for (const name of this.getMetricNames()) {
      const agg = this.aggregate(name);
      if (!agg) continue;

      output += `# HELP ${name} Aggregated metric\n`;
      output += `# TYPE ${name} gauge\n`;
      output += `${name}_count ${agg.count}\n`;
      output += `${name}_sum ${agg.sum}\n`;
      output += `${name}_avg ${agg.avg}\n`;
      output += `${name}_min ${agg.min}\n`;
      output += `${name}_max ${agg.max}\n`;
      output += `${name}_p50 ${agg.p50}\n`;
      output += `${name}_p95 ${agg.p95}\n`;
      output += `${name}_p99 ${agg.p99}\n`;
      output += `${name}_stddev ${agg.stdDev}\n`;
      output += '\n';
    }

    return output;
  }

  /**
   * Export metrics as JSON
   */
  exportJSON(): string {
    const obj: Record<string, MetricAggregation> = {};

    for (const name of this.getMetricNames()) {
      const agg = this.aggregate(name);
      if (agg) {
        obj[name] = agg;
      }
    }

    return JSON.stringify(obj, null, 2);
  }

  /**
   * Merge metrics from another collector
   */
  merge(other: MetricsCollector): void {
    for (const name of other.getMetricNames()) {
      const samples = other.getSamples(name);
      for (const sample of samples) {
        this.record(name, sample.value, sample.labels);
      }
    }
  }

  /**
   * Filter metrics by label
   */
  filterByLabel(name: string, label: string, value: string): MetricSample[] {
    const samples = this.getSamples(name);
    return samples.filter((s) => s.labels?.[label] === value);
  }

  /**
   * Get rate of change for a metric
   */
  getRate(name: string, windowSize = 1000): number | undefined {
    const samples = this.getSamples(name);
    if (samples.length < 2) {
      return undefined;
    }

    const now = Date.now();
    const recentSamples = samples.filter((s) => s.timestamp >= now - windowSize);

    if (recentSamples.length < 2) {
      return undefined;
    }

    const first = recentSamples[0];
    const last = recentSamples[recentSamples.length - 1];

    const timeDiff = last.timestamp - first.timestamp;
    const valueDiff = last.value - first.value;

    if (timeDiff === 0) {
      return 0;
    }

    return valueDiff / (timeDiff / 1000); // Per second
  }

  /**
   * Detect anomalies in metrics using statistical methods
   */
  detectAnomalies(
    name: string,
    threshold = 3
  ): Array<{
    timestamp: number;
    value: number;
    zscore: number;
  }> {
    const agg = this.aggregate(name);
    if (!agg || agg.stdDev === 0) {
      return [];
    }

    const samples = this.getSamples(name);
    const anomalies: Array<{
      timestamp: number;
      value: number;
      zscore: number;
    }> = [];

    for (const sample of samples) {
      const zscore = Math.abs((sample.value - agg.avg) / agg.stdDev);
      if (zscore > threshold) {
        anomalies.push({
          timestamp: sample.timestamp,
          value: sample.value,
          zscore,
        });
      }
    }

    return anomalies;
  }

  /**
   * Calculate correlation between two metrics
   */
  calculateCorrelation(name1: string, name2: string): number | undefined {
    const samples1 = this.getSamples(name1);
    const samples2 = this.getSamples(name2);

    if (samples1.length === 0 || samples2.length === 0) {
      return undefined;
    }

    // Align samples by timestamp (nearest neighbor)
    const aligned: Array<[number, number]> = [];

    for (const sample1 of samples1) {
      const nearest = samples2.reduce((nearest, sample2) => {
        const dist1 = Math.abs(sample1.timestamp - nearest.timestamp);
        const dist2 = Math.abs(sample1.timestamp - sample2.timestamp);
        return dist2 < dist1 ? sample2 : nearest;
      }, samples2[0]);

      if (Math.abs(sample1.timestamp - nearest.timestamp) < 1000) {
        // Within 1 second
        aligned.push([sample1.value, nearest.value]);
      }
    }

    if (aligned.length < 2) {
      return undefined;
    }

    // Calculate Pearson correlation
    const n = aligned.length;
    const sumX = aligned.reduce((sum, [x]) => sum + x, 0);
    const sumY = aligned.reduce((sum, [, y]) => sum + y, 0);
    const sumXY = aligned.reduce((sum, [x, y]) => sum + x * y, 0);
    const sumX2 = aligned.reduce((sum, [x]) => sum + x * x, 0);
    const sumY2 = aligned.reduce((sum, [, y]) => sum + y * y, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) {
      return 0;
    }

    return numerator / denominator;
  }
}

export default MetricsCollector;
