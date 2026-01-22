/**
 * Statistical utility functions
 */

export class Statistics {
  /**
   * Calculate mean
   */
  static mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate median
   */
  static median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /**
   * Calculate percentile
   */
  static percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * p;
    const base = Math.floor(pos);
    const rest = pos - base;

    if (sorted[base + 1] !== undefined) {
      return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    }
    return sorted[base];
  }

  /**
   * Calculate standard deviation
   */
  static stdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = this.mean(values);
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate variance
   */
  static variance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = this.mean(values);
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }

  /**
   * Calculate min and max
   */
  static range(values: number[]): { min: number; max: number } {
    if (values.length === 0) return { min: 0, max: 0 };
    return {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  /**
   * Calculate sum
   */
  static sum(values: number[]): number {
    return values.reduce((a, b) => a + b, 0);
  }

  /**
   * Calculate all common statistics
   */
  static calculateAll(values: number[]): {
    count: number;
    sum: number;
    mean: number;
    median: number;
    min: number;
    max: number;
    stdDev: number;
    variance: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  } {
    return {
      count: values.length,
      sum: this.sum(values),
      mean: this.mean(values),
      median: this.median(values),
      min: Math.min(...values),
      max: Math.max(...values),
      stdDev: this.stdDev(values),
      variance: this.variance(values),
      p50: this.percentile(values, 0.5),
      p75: this.percentile(values, 0.75),
      p90: this.percentile(values, 0.9),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99)
    };
  }
}

/**
 * Time series utilities
 */
export class TimeSeriesUtils {
  /**
   * Resample time series to a fixed interval
   */
  static resample(
    timestamps: number[],
    values: number[],
    interval: number
  ): { timestamps: number[]; values: number[] } {
    if (timestamps.length === 0) {
      return { timestamps: [], values: [] };
    }

    const start = Math.floor(timestamps[0] / interval) * interval;
    const end = timestamps[timestamps.length - 1];

    const resampledTimestamps: number[] = [];
    const resampledValues: number[] = [];

    for (let t = start; t <= end; t += interval) {
      const windowValues: number[] = [];

      for (let i = 0; i < timestamps.length; i++) {
        if (timestamps[i] >= t && timestamps[i] < t + interval) {
          windowValues.push(values[i]);
        }
      }

      if (windowValues.length > 0) {
        resampledTimestamps.push(t);
        resampledValues.push(Statistics.mean(windowValues));
      }
    }

    return { timestamps: resampledTimestamps, values: resampledValues };
  }

  /**
   * Smooth time series using moving average
   */
  static movingAverage(values: number[], window: number): number[] {
    if (values.length < window) {
      return [...values];
    }

    const smoothed: number[] = [];

    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - Math.floor(window / 2));
      const end = Math.min(values.length, i + Math.ceil(window / 2));
      const windowValues = values.slice(start, end);
      smoothed.push(Statistics.mean(windowValues));
    }

    return smoothed;
  }

  /**
   * Calculate rate of change
   */
  static rateOfChange(timestamps: number[], values: number[]): number[] {
    if (values.length < 2) {
      return [];
    }

    const rates: number[] = [];

    for (let i = 1; i < values.length; i++) {
      const dt = timestamps[i] - timestamps[i - 1];
      const dv = values[i] - values[i - 1];
      rates.push(dt > 0 ? dv / dt : 0);
    }

    return rates;
  }

  /**
   * Detect outliers using IQR method
   */
  static detectOutliers(values: number[]): Array<{ index: number; value: number; zScore: number }> {
    if (values.length < 4) {
      return [];
    }

    const outliers: Array<{ index: number; value: number; zScore: number }> = [];
    const sorted = [...values].sort((a, b) => a - b);

    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;

    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    for (let i = 0; i < values.length; i++) {
      if (values[i] < lowerBound || values[i] > upperBound) {
        const mean = Statistics.mean(values);
        const stdDev = Statistics.stdDev(values);
        const zScore = stdDev > 0 ? (values[i] - mean) / stdDev : 0;

        outliers.push({
          index: i,
          value: values[i],
          zScore
        });
      }
    }

    return outliers;
  }
}

/**
 * Formatting utilities
 */
export class FormatUtils {
  /**
   * Format bytes to human readable
   */
  static formatBytes(bytes: number): string {
    const abs = Math.abs(bytes);
    if (abs < 1024) return `${bytes.toFixed(2)} B`;
    if (abs < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (abs < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  /**
   * Format duration to human readable
   */
  static formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }

  /**
   * Format percentage
   */
  static formatPercent(value: number, decimals: number = 2): string {
    return `${(value * 100).toFixed(decimals)}%`;
  }

  /**
   * Format timestamp to ISO string
   */
  static formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toISOString();
  }

  /**
   * Format number with thousands separator
   */
  static formatNumber(value: number): string {
    return value.toLocaleString();
  }
}
