/**
 * Metrics collection and calculation utilities
 */

interface LatencySample {
  value: number;
  timestamp: number;
}

interface ThroughputSample {
  count: number;
  timestamp: number;
}

/**
 * Calculate percentile from a sorted array of values
 */
export function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];

  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= sortedValues.length) {
    return sortedValues[sortedValues.length - 1];
  }

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

/**
 * Calculate moving average
 */
export function calculateMovingAverage(values: number[], windowSize: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = values.slice(start, i + 1);
    const average = window.reduce((sum, val) => sum + val, 0) / window.length;
    result.push(average);
  }

  return result;
}

/**
 * Calculate exponential moving average
 */
export function calculateEMA(values: number[], alpha: number): number[] {
  const result: number[] = [values[0]];

  for (let i = 1; i < values.length; i++) {
    const ema = alpha * values[i] + (1 - alpha) * result[i - 1];
    result.push(ema);
  }

  return result;
}

/**
 * Calculate rate per second from samples
 */
export function calculateRate(samples: ThroughputSample[], windowMs: number = 1000): number {
  if (samples.length < 2) return 0;

  const now = Date.now();
  const windowStart = now - windowMs;

  const recentSamples = samples.filter(s => s.timestamp >= windowStart);

  if (recentSamples.length < 2) return 0;

  const totalEvents = recentSamples.reduce((sum, s) => sum + s.count, 0);
  const timeSpan = recentSamples[recentSamples.length - 1].timestamp - recentSamples[0].timestamp;

  if (timeSpan <= 0) return 0;

  return (totalEvents / timeSpan) * 1000;
}

/**
 * Calculate statistics for a set of values
 */
export function calculateStatistics(values: number[]): {
  min: number;
  max: number;
  sum: number;
  avg: number;
  median: number;
  variance: number;
  stdDev: number;
  p50: number;
  p95: number;
  p99: number;
  p999: number;
} {
  if (values.length === 0) {
    return {
      min: 0,
      max: 0,
      sum: 0,
      avg: 0,
      median: 0,
      variance: 0,
      stdDev: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      p999: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((s, v) => s + v, 0);
  const avg = sum / sorted.length;

  const variance = sorted.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / sorted.length;
  const stdDev = Math.sqrt(variance);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    sum,
    avg,
    median: calculatePercentile(sorted, 50),
    variance,
    stdDev,
    p50: calculatePercentile(sorted, 50),
    p95: calculatePercentile(sorted, 95),
    p99: calculatePercentile(sorted, 99),
    p999: calculatePercentile(sorted, 99.9),
  };
}

/**
 * Track latency measurements
 */
export class LatencyTracker {
  private samples: LatencySample[] = [];
  private maxSamples: number;
  private retentionMs: number;

  constructor(maxSamples: number = 10000, retentionMs: number = 60000) {
    this.maxSamples = maxSamples;
    this.retentionMs = retentionMs;
  }

  /**
   * Record a latency measurement
   */
  record(value: number): void {
    const now = Date.now();
    this.samples.push({ value, timestamp: now });
    this.cleanup(now);
  }

  /**
   * Get current latency statistics
   */
  getStats(): {
    p50: number;
    p95: number;
    p99: number;
    p999: number;
    avg: number;
    min: number;
    max: number;
  } {
    this.cleanup(Date.now());

    if (this.samples.length === 0) {
      return { p50: 0, p95: 0, p99: 0, p999: 0, avg: 0, min: 0, max: 0 };
    }

    const sorted = this.samples.map(s => s.value).sort((a, b) => a - b);

    return {
      p50: calculatePercentile(sorted, 50),
      p95: calculatePercentile(sorted, 95),
      p99: calculatePercentile(sorted, 99),
      p999: calculatePercentile(sorted, 99.9),
      avg: sorted.reduce((s, v) => s + v, 0) / sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  }

  /**
   * Clean up old samples
   */
  private cleanup(now: number): void {
    const cutoff = now - this.retentionMs;
    this.samples = this.samples.filter(s => s.timestamp >= cutoff);

    if (this.samples.length > this.maxSamples) {
      this.samples = this.samples.slice(-this.maxSamples);
    }
  }

  /**
   * Reset the tracker
   */
  reset(): void {
    this.samples = [];
  }
}

/**
 * Track throughput measurements
 */
export class ThroughputTracker {
  private samples: ThroughputSample[] = [];
  private lastCount = 0;
  private lastSampleTime = Date.now();
  private maxSamples: number;

  constructor(maxSamples: number = 1000) {
    this.maxSamples = maxSamples;
  }

  /**
   * Record a count increment
   */
  increment(delta: number = 1): void {
    const now = Date.now();

    if (now - this.lastSampleTime >= 1000) {
      this.samples.push({
        count: delta,
        timestamp: now,
      });

      if (this.samples.length > this.maxSamples) {
        this.samples.shift();
      }

      this.lastSampleTime = now;
      this.lastCount = 0;
    } else {
      this.lastCount += delta;
    }
  }

  /**
   * Get current throughput rate
   */
  getRate(windowMs: number = 1000): number {
    return calculateRate(this.samples, windowMs);
  }

  /**
   * Get peak throughput
   */
  getPeak(): number {
    if (this.samples.length === 0) return 0;

    const peakSample = this.samples.reduce((max, s) =>
      s.count > max.count ? s : max
    );

    return peakSample.count;
  }

  /**
   * Reset the tracker
   */
  reset(): void {
    this.samples = [];
    this.lastCount = 0;
    this.lastSampleTime = Date.now();
  }
}

/**
 * Detect anomalies using statistical methods
 */
export class AnomalyDetector {
  private readonly threshold: number;
  private readonly windowSize: number;
  private values: number[] = [];

  constructor(threshold: number = 3, windowSize: number = 100) {
    this.threshold = threshold;
    this.windowSize = windowSize;
  }

  /**
   * Check if a value is anomalous using z-score
   */
  isAnomalous(value: number): boolean {
    this.values.push(value);

    if (this.values.length > this.windowSize) {
      this.values.shift();
    }

    if (this.values.length < 10) {
      return false;
    }

    const stats = calculateStatistics(this.values);
    const zScore = stats.stdDev > 0 ? Math.abs((value - stats.avg) / stats.stdDev) : 0;

    return zScore > this.threshold;
  }

  /**
   * Get anomaly score (z-score)
   */
  getAnomalyScore(value: number): number {
    if (this.values.length < 10) {
      return 0;
    }

    const stats = calculateStatistics(this.values);
    return stats.stdDev > 0 ? Math.abs((value - stats.avg) / stats.stdDev) : 0;
  }

  /**
   * Reset the detector
   */
  reset(): void {
    this.values = [];
  }
}

/**
 * Calculate exponential histogram for approximate quantiles
 */
export class ExponentialHistogram {
  private readonly bins: Map<number, number> = new Map();
  private readonly scaleFactor: number;
  private count = 0;

  constructor(scaleFactor: number = 0.1) {
    this.scaleFactor = scaleFactor;
  }

  /**
   * Record a value
   */
  record(value: number): void {
    const binIndex = Math.floor(Math.log(Math.abs(value) + 1) / this.scaleFactor);
    this.bins.set(binIndex, (this.bins.get(binIndex) || 0) + 1);
    this.count++;
  }

  /**
   * Estimate percentile
   */
  estimatePercentile(percentile: number): number {
    if (this.count === 0) return 0;

    const target = (percentile / 100) * this.count;
    let cumulative = 0;

    const sortedBins = Array.from(this.bins.entries()).sort((a, b) => a[0] - b[0]);

    for (const [binIndex, binCount] of sortedBins) {
      cumulative += binCount;
      if (cumulative >= target) {
        return Math.exp(binIndex * this.scaleFactor) - 1;
      }
    }

    return Math.exp(sortedBins[sortedBins.length - 1][0] * this.scaleFactor) - 1;
  }

  /**
   * Reset the histogram
   */
  reset(): void {
    this.bins.clear();
    this.count = 0;
  }
}
