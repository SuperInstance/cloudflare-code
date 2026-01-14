/**
 * Metrics collection utility
 */

export interface MetricsConfig {
  service: string;
  enabled?: boolean;
  defaultLabels?: Record<string, string>;
}

export class MetricsCollector {
  private config: MetricsConfig;
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private labelValues = new Map<string, Record<string, any>>();

  constructor(config: MetricsConfig) {
    this.config = {
      ...config,
      enabled: config.enabled ?? true,
    };
  }

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, value: number = 1, labels?: Record<string, any>): void {
    if (!this.config.enabled) return;

    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);

    if (labels) {
      this.labelValues.set(name, { ...this.labelValues.get(name), ...labels });
    }
  }

  /**
   * Set a gauge metric
   */
  setGauge(name: string, value: number, labels?: Record<string, any>): void {
    if (!this.config.enabled) return;

    this.gauges.set(name, value);

    if (labels) {
      this.labelValues.set(name, { ...this.labelValues.get(name), ...labels });
    }
  }

  /**
   * Record a value in a histogram
   */
  recordHistogram(name: string, value: number, labels?: Record<string, any>): void {
    if (!this.config.enabled) return;

    const values = this.histograms.get(name) || [];
    values.push(value);
    this.histograms.set(name, values);

    if (labels) {
      this.labelValues.set(name, { ...this.labelValues.get(name), ...labels });
    }
  }

  /**
   * Get all metrics
   */
  getMetrics(): Record<string, any> {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([name, values]) => {
          const sorted = [...values].sort((a, b) => a - b);
          return [
            name,
            {
              count: sorted.length,
              min: sorted[0] || 0,
              max: sorted[sorted.length - 1] || 0,
              sum: sorted.reduce((a, b) => a + b, 0),
              avg: sorted.reduce((a, b) => a + b, 0) / sorted.length || 0,
              p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
              p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
              p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
            },
          ];
        })
      ),
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.labelValues.clear();
  }

  /**
   * Get counter value
   */
  getCounter(name: string): number {
    return this.counters.get(name) || 0;
  }

  /**
   * Get gauge value
   */
  getGauge(name: string): number {
    return this.gauges.get(name) || 0;
  }

  /**
   * Get histogram statistics
   */
  getHistogram(name: string): any {
    const values = this.histograms.get(name) || [];
    const sorted = [...values].sort((a, b) => a - b);

    return {
      count: sorted.length,
      min: sorted[0] || 0,
      max: sorted[sorted.length - 1] || 0,
      sum: sorted.reduce((a, b) => a + b, 0),
      avg: sorted.reduce((a, b) => a + b, 0) / sorted.length || 0,
      p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
      p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
      p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
    };
  }
}
