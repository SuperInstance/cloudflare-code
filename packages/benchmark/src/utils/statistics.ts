/**
 * Statistical Analysis Utilities
 * Comprehensive statistical functions for benchmark data analysis
 */

import type {
  StatisticalAnalysis,
  ConfidenceInterval,
  OutlierDetection,
  PercentileConfig
} from '../types/index.js';

/**
 * Calculate mean (average) of an array of numbers
 */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate median of an array of numbers
 */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate mode of an array of numbers
 */
export function mode(values: number[]): number {
  if (values.length === 0) return 0;
  const frequency = new Map<number, number>();
  let maxFreq = 0;
  let modeValue = values[0];

  for (const value of values) {
    const freq = (frequency.get(value) || 0) + 1;
    frequency.set(value, freq);
    if (freq > maxFreq) {
      maxFreq = freq;
      modeValue = value;
    }
  }

  return modeValue;
}

/**
 * Calculate variance of an array of numbers
 */
export function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map(value => Math.pow(value - avg, 2));
  return mean(squaredDiffs);
}

/**
 * Calculate standard deviation of an array of numbers
 */
export function standardDeviation(values: number[]): number {
  return Math.sqrt(variance(values));
}

/**
 * Calculate coefficient of variation (relative standard deviation as percentage)
 */
export function coefficientOfVariation(values: number[]): number {
  const avg = mean(values);
  if (avg === 0) return 0;
  return (standardDeviation(values) / avg) * 100;
}

/**
 * Calculate skewness (measure of asymmetry)
 */
export function skewness(values: number[]): number {
  if (values.length < 3) return 0;
  const avg = mean(values);
  const std = standardDeviation(values);
  if (std === 0) return 0;

  const n = values.length;
  const skew = values.reduce((sum, val) => {
    return sum + Math.pow((val - avg) / std, 3);
  }, 0);

  return (n / ((n - 1) * (n - 2))) * skew;
}

/**
 * Calculate kurtosis (measure of tailedness)
 */
export function kurtosis(values: number[]): number {
  if (values.length < 4) return 0;
  const avg = mean(values);
  const std = standardDeviation(values);
  if (std === 0) return 0;

  const n = values.length;
  const kurt = values.reduce((sum, val) => {
    return sum + Math.pow((val - avg) / std, 4);
  }, 0);

  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * kurt -
         (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
}

/**
 * Calculate range of an array of numbers
 */
export function range(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

/**
 * Calculate interquartile range (IQR)
 */
export function interquartileRange(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 25);
  const q3 = percentile(sorted, 75);
  return q3 - q1;
}

/**
 * Calculate percentile value
 */
export function percentile(values: number[], p: number, method: 'linear' | 'nearest' | 'midpoint' = 'linear'): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);

  if (method === 'nearest') {
    const roundedIndex = Math.round(index);
    return sorted[roundedIndex];
  }

  if (method === 'midpoint') {
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);
    if (lowerIndex === upperIndex) {
      return sorted[index];
    }
    return (sorted[lowerIndex] + sorted[upperIndex]) / 2;
  }

  // Linear interpolation (default)
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lowerValue = sorted[lowerIndex];
  const upperValue = sorted[upperIndex];
  const weight = index - lowerIndex;

  return lowerValue + weight * (upperValue - lowerValue);
}

/**
 * Calculate multiple percentiles
 */
export function percentiles(values: number[], percentileValues: number[]): Record<number, number> {
  const result: Record<number, number> = {};
  for (const p of percentileValues) {
    result[p] = percentile(values, p);
  }
  return result;
}

/**
 * Calculate confidence interval using t-distribution
 */
export function confidenceInterval(
  values: number[],
  confidenceLevel: number = 0.95
): ConfidenceInterval {
  const n = values.length;
  if (n < 2) {
    return {
      lower: values[0] || 0,
      upper: values[0] || 0,
      level: confidenceLevel,
      marginOfError: 0
    };
  }

  const avg = mean(values);
  const std = standardDeviation(values);
  const margin = std / Math.sqrt(n);

  // Approximate t-value for common confidence levels
  const tValues: Record<number, number> = {
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576
  };

  const t = tValues[confidenceLevel] || 1.96;
  const marginOfError = t * margin;

  return {
    lower: avg - marginOfError,
    upper: avg + marginOfError,
    level: confidenceLevel,
    marginOfError
  };
}

/**
 * Detect outliers using IQR method
 */
export function detectOutliersIQR(values: number[], multiplier: number = 1.5): OutlierDetection {
  if (values.length === 0) {
    return { indices: [], values: [], method: 'iqr', threshold: 0, count: 0 };
  }

  const sorted = values.map((val, idx) => ({ val, idx }))
    .sort((a, b) => a.val - b.val);

  const q1 = percentile(sorted.map(s => s.val), 25);
  const q3 = percentile(sorted.map(s => s.val), 75);
  const iqr = q3 - q1;
  const lowerBound = q1 - multiplier * iqr;
  const upperBound = q3 + multiplier * iqr;

  const outliers = sorted.filter(s => s.val < lowerBound || s.val > upperBound);

  return {
    indices: outliers.map(o => o.idx),
    values: outliers.map(o => o.val),
    method: 'iqr',
    threshold: multiplier,
    count: outliers.length
  };
}

/**
 * Detect outliers using Z-score method
 */
export function detectOutliersZScore(values: number[], threshold: number = 3): OutlierDetection {
  if (values.length === 0) {
    return { indices: [], values: [], method: 'zscore', threshold, count: 0 };
  }

  const avg = mean(values);
  const std = standardDeviation(values);
  if (std === 0) {
    return { indices: [], values: [], method: 'zscore', threshold, count: 0 };
  }

  const outliers: { idx: number; val: number }[] = [];
  values.forEach((val, idx) => {
    const zScore = Math.abs((val - avg) / std);
    if (zScore > threshold) {
      outliers.push({ idx, val });
    }
  });

  return {
    indices: outliers.map(o => o.idx),
    values: outliers.map(o => o.val),
    method: 'zscore',
    threshold,
    count: outliers.length
  };
}

/**
 * Detect outliers using Modified Z-score method (more robust)
 */
export function detectOutliersModifiedZScore(values: number[], threshold: number = 3.5): OutlierDetection {
  if (values.length === 0) {
    return { indices: [], values: [], method: 'modified-zscore', threshold, count: 0 };
  }

  const med = median(values);
  const mad = median(values.map(v => Math.abs(v - med)));
  if (mad === 0) {
    return { indices: [], values: [], method: 'modified-zscore', threshold, count: 0 };
  }

  const outliers: { idx: number; val: number }[] = [];
  values.forEach((val, idx) => {
    const modifiedZScore = 0.6745 * (val - med) / mad;
    if (Math.abs(modifiedZScore) > threshold) {
      outliers.push({ idx, val });
    }
  });

  return {
    indices: outliers.map(o => o.idx),
    values: outliers.map(o => o.val),
    method: 'modified-zscore',
    threshold,
    count: outliers.length
  };
}

/**
 * Detect outliers using the specified method
 */
export function detectOutliers(
  values: number[],
  method: 'iqr' | 'zscore' | 'modified-zscore' = 'iqr',
  threshold: number = 1.5
): OutlierDetection {
  switch (method) {
    case 'iqr':
      return detectOutliersIQR(values, threshold);
    case 'zscore':
      return detectOutliersZScore(values, threshold);
    case 'modified-zscore':
      return detectOutliersModifiedZScore(values, threshold);
    default:
      return detectOutliersIQR(values, threshold);
  }
}

/**
 * Remove outliers from an array
 */
export function removeOutliers(
  values: number[],
  detection: OutlierDetection
): number[] {
  const outlierIndices = new Set(detection.indices);
  return values.filter((_, idx) => !outlierIndices.has(idx));
}

/**
 * Perform comprehensive statistical analysis
 */
export function analyze(values: number[], percentileConfig?: PercentileConfig): StatisticalAnalysis {
  const sortedValues = [...values].sort((a, b) => a - b);
  const percentileValues = percentileConfig?.values || [50, 75, 90, 95, 99];

  return {
    mean: mean(values),
    median: median(values),
    mode: mode(values),
    standardDeviation: standardDeviation(values),
    variance: variance(values),
    cv: coefficientOfVariation(values),
    skewness: skewness(values),
    kurtosis: kurtosis(values),
    min: Math.min(...values),
    max: Math.max(...values),
    range: range(values),
    iqr: interquartileRange(values),
    percentiles: percentiles(sortedValues, percentileValues),
    outliers: detectOutliersIQR(values).values
  };
}

/**
 * Perform two-sample t-test to determine if two samples are significantly different
 */
export function tTest(sample1: number[], sample2: number[]): {
  tStatistic: number;
  pValue: number;
  significant: boolean;
  alpha: number;
} {
  const n1 = sample1.length;
  const n2 = sample2.length;
  const mean1 = mean(sample1);
  const mean2 = mean(sample2);
  const var1 = variance(sample1);
  const var2 = variance(sample2);

  // Pooled standard error
  const pooledSE = Math.sqrt(var1 / n1 + var2 / n2);

  // T-statistic
  const tStatistic = (mean1 - mean2) / pooledSE;

  // Degrees of freedom (Welch's t-test)
  const df = Math.pow(var1 / n1 + var2 / n2, 2) /
    (Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1));

  // Approximate p-value (two-tailed)
  // This is a simplified calculation - for production, use a proper statistical library
  const absT = Math.abs(tStatistic);
  const pValue = 2 * (1 - normalCDF(absT));

  return {
    tStatistic,
    pValue,
    significant: pValue < 0.05,
    alpha: 0.05
  };
}

/**
 * Calculate Mann-Whitney U test (non-parametric alternative to t-test)
 */
export function mannWhitneyUTest(sample1: number[], sample2: number[]): {
  uStatistic: number;
  pValue: number;
  significant: boolean;
} {
  const n1 = sample1.length;
  const n2 = sample2.length;
  const all = [...sample1.map(v => ({ val: v, group: 1 })),
              ...sample2.map(v => ({ val: v, group: 2 }))];
  all.sort((a, b) => a.val - b.val);

  // Calculate rank sums
  let rankSum1 = 0;
  let rankSum2 = 0;

  for (let i = 0; i < all.length; i++) {
    // Handle ties by averaging ranks
    let j = i;
    while (j < all.length && all[j].val === all[i].val) j++;
    const avgRank = (i + j + 1) / 2;

    for (let k = i; k < j; k++) {
      if (all[k].group === 1) {
        rankSum1 += avgRank;
      } else {
        rankSum2 += avgRank;
      }
    }
    i = j - 1;
  }

  const u1 = rankSum1 - n1 * (n1 + 1) / 2;
  const u2 = rankSum2 - n2 * (n2 + 1) / 2;
  const uStatistic = Math.min(u1, u2);

  // Approximate p-value using normal approximation
  const meanU = n1 * n2 / 2;
  const stdU = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12);
  const z = (uStatistic - meanU) / stdU;
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  return {
    uStatistic,
    pValue,
    significant: pValue < 0.05
  };
}

/**
 * Calculate effect size (Cohen's d)
 */
export function cohensD(sample1: number[], sample2: number[]): number {
  const mean1 = mean(sample1);
  const mean2 = mean(sample2);
  const n1 = sample1.length;
  const n2 = sample2.length;

  // Pooled standard deviation
  const var1 = variance(sample1);
  const var2 = variance(sample2);
  const pooledSD = Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2));

  return (mean1 - mean2) / pooledSD;
}

/**
 * Standard normal cumulative distribution function (CDF)
 * Approximation using the error function
 */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Calculate geometric mean
 */
export function geometricMean(values: number[]): number {
  if (values.length === 0) return 0;
  const logSum = values.reduce((sum, val) => sum + Math.log(val), 0);
  return Math.exp(logSum / values.length);
}

/**
 * Calculate harmonic mean
 */
export function harmonicMean(values: number[]): number {
  if (values.length === 0) return 0;
  const reciprocalSum = values.reduce((sum, val) => sum + 1 / val, 0);
  return values.length / reciprocalSum;
}

/**
 * Calculate moving average
 */
export function movingAverage(values: number[], window: number): number[] {
  if (values.length === 0 || window < 1) return [];
  if (window >= values.length) return [mean(values)];

  const result: number[] = [];
  for (let i = 0; i <= values.length - window; i++) {
    const windowValues = values.slice(i, i + window);
    result.push(mean(windowValues));
  }
  return result;
}

/**
 * Calculate exponential moving average
 */
export function exponentialMovingAverage(values: number[], alpha: number): number[] {
  if (values.length === 0) return [];
  if (alpha < 0 || alpha > 1) throw new Error('Alpha must be between 0 and 1');

  const result: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(alpha * values[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
}

/**
 * Trim mean (remove a percentage of extreme values)
 */
export function trimMean(values: number[], percentage: number = 0.2): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * percentage);
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  return mean(trimmed);
}
