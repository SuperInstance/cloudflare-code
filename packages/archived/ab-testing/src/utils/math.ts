/**
 * Mathematical utilities for statistical calculations
 */

/**
 * Calculate mean of array
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate median of array
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

/**
 * Calculate variance
 */
export function variance(values: number[], sample: boolean = true): number {
  if (values.length < 2) return 0;

  const avg = mean(values);
  const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
  const sum = squaredDiffs.reduce((s, v) => s + v, 0);

  return sample ? sum / (values.length - 1) : sum / values.length;
}

/**
 * Calculate standard deviation
 */
export function standardDeviation(values: number[], sample: boolean = true): number {
  return Math.sqrt(variance(values, sample));
}

/**
 * Calculate percentile
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
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
 * Calculate percentiles (25, 50, 75, 90, 95, 99)
 */
export function percentiles(values: number[]): {
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
} {
  return {
    p25: percentile(values, 25),
    p50: percentile(values, 50),
    p75: percentile(values, 75),
    p90: percentile(values, 90),
    p95: percentile(values, 95),
    p99: percentile(values, 99)
  };
}

/**
 * Calculate standard error
 */
export function standardError(stdDev: number, n: number): number {
  if (n === 0) return 0;
  return stdDev / Math.sqrt(n);
}

/**
 * Calculate margin of error
 */
export function marginOfError(stdDev: number, n: number, confidence: number = 0.95): number {
  const z = zScore(confidence);
  return z * standardError(stdDev, n);
}

/**
 * Get z-score for confidence level
 */
export function zScore(confidence: number): number {
  const scores: Record<number, number> = {
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576
  };
  return scores[confidence] ?? 1.96;
}

/**
 * Round to decimal places
 */
export function round(value: number, decimals: number): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Map value from one range to another
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * Calculate moving average
 */
export function movingAverage(values: number[], window: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    result.push(mean(slice));
  }

  return result;
}

/**
 * Calculate exponential moving average
 */
export function ema(values: number[], alpha: number = 0.5): number[] {
  const result: number[] = [];
  let ema = values[0] ?? 0;

  for (let i = 0; i < values.length; i++) {
    ema = alpha * values[i] + (1 - alpha) * ema;
    result.push(ema);
  }

  return result;
}

/**
 * Calculate sum
 */
export function sum(values: number[]): number {
  return values.reduce((s, v) => s + v, 0);
}

/**
 * Calculate product
 */
export function product(values: number[]): number {
  return values.reduce((p, v) => p * v, 1);
}

/**
 * Find min value
 */
export function min(values: number[]): number {
  return Math.min(...values);
}

/**
 * Find max value
 */
export function max(values: number[]): number {
  return Math.max(...values);
}

/**
 * Calculate range
 */
export function range(values: number[]): number {
  if (values.length === 0) return 0;
  return max(values) - min(values);
}

/**
 * Calculate mode (most frequent value)
 */
export function mode(values: number[]): number {
  if (values.length === 0) return 0;

  const frequency = new Map<number, number>();

  for (const value of values) {
    frequency.set(value, (frequency.get(value) ?? 0) + 1);
  }

  let maxValue = values[0];
  let maxFrequency = 0;

  for (const [value, freq] of frequency.entries()) {
    if (freq > maxFrequency) {
      maxFrequency = freq;
      maxValue = value;
    }
  }

  return maxValue;
}

/**
 * Calculate skewness (asymmetry of distribution)
 */
export function skewness(values: number[]): number {
  if (values.length < 3) return 0;

  const avg = mean(values);
  const std = standardDeviation(values);

  if (std === 0) return 0;

  const n = values.length;
  const sum = values.reduce((s, v) => s + Math.pow((v - avg) / std, 3), 0);

  return (n / ((n - 1) * (n - 2))) * sum;
}

/**
 * Calculate kurtosis (tailedness of distribution)
 */
export function kurtosis(values: number[]): number {
  if (values.length < 4) return 0;

  const avg = mean(values);
  const std = standardDeviation(values);

  if (std === 0) return 0;

  const n = values.length;
  const sum = values.reduce((s, v) => s + Math.pow((v - avg) / std, 4), 0);

  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * sum -
         (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
}

/**
 * Calculate coefficient of variation (relative variability)
 */
export function coefficientOfVariation(values: number[]): number {
  const avg = mean(values);
  if (avg === 0) return 0;
  return standardDeviation(values) / avg;
}

/**
 * Calculate geometric mean
 */
export function geometricMean(values: number[]): number {
  if (values.length === 0) return 0;

  const logSum = values.reduce((s, v) => s + Math.log(v), 0);
  return Math.exp(logSum / values.length);
}

/**
 * Calculate harmonic mean
 */
export function harmonicMean(values: number[]): number {
  if (values.length === 0) return 0;

  const reciprocalSum = values.reduce((s, v) => s + 1 / v, 0);
  return values.length / reciprocalSum;
}

/**
 * Normalize values to 0-1 range
 */
export function normalize(values: number[]): number[] {
  const minVal = min(values);
  const maxVal = max(values);
  const rangeVal = maxVal - minVal;

  if (rangeVal === 0) return values.map(() => 0.5);

  return values.map(v => (v - minVal) / rangeVal);
}

/**
 * Standardize values (z-scores)
 */
export function standardize(values: number[]): number[] {
  const avg = mean(values);
  const std = standardDeviation(values);

  if (std === 0) return values.map(() => 0);

  return values.map(v => (v - avg) / std);
}

/**
 * Calculate correlation coefficient (Pearson's r)
 */
export function correlation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const meanX = mean(x);
  const meanY = mean(y);

  let numerator = 0;
  let sumSqX = 0;
  let sumSqY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    sumSqX += dx * dx;
    sumSqY += dy * dy;
  }

  const denominator = Math.sqrt(sumSqX * sumSqY);

  if (denominator === 0) return 0;

  return numerator / denominator;
}

/**
 * Calculate covariance
 */
export function covariance(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const meanX = mean(x);
  const meanY = mean(y);

  const sum = x.reduce((s, vx, i) => s + (vx - meanX) * (y[i] - meanY), 0);

  return sum / (x.length - 1);
}

/**
 * Safe division with default value
 */
export function safeDivide(a: number, b: number, defaultValue: number = 0): number {
  return b !== 0 ? a / b : defaultValue;
}

/**
 * Calculate percentage
 */
export function percentage(value: number, total: number): number {
  return total !== 0 ? (value / total) * 100 : 0;
}

/**
 * Calculate percentage change
 */
export function percentageChange(oldValue: number, newValue: number): number {
  return oldValue !== 0 ? ((newValue - oldValue) / oldValue) * 100 : 0;
}
