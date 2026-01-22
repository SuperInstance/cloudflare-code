/**
 * Statistical Functions Tests
 * Comprehensive test suite for statistical analysis functions
 */

import { describe, it, expect } from 'vitest';
import {
  mean,
  median,
  mode,
  standardDeviation,
  variance,
  coefficientOfVariation,
  percentile,
  percentiles,
  confidenceInterval,
  detectOutliers,
  detectOutliersIQR,
  detectOutliersZScore,
  detectOutliersModifiedZScore,
  removeOutliers,
  analyze,
  skewness,
  kurtosis,
  range,
  interquartileRange,
  geometricMean,
  harmonicMean,
  movingAverage,
  exponentialMovingAverage,
  trimMean,
  tTest,
  mannWhitneyUTest,
  cohensD
} from '../src/utils/statistics.js';

describe('mean', () => {
  it('should calculate arithmetic mean', () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
    expect(mean([10, 20, 30])).toBe(20);
  });

  it('should handle empty array', () => {
    expect(mean([])).toBe(0);
  });

  it('should handle negative numbers', () => {
    expect(mean([-1, 0, 1])).toBe(0);
  });
});

describe('median', () => {
  it('should calculate median for odd-length array', () => {
    expect(median([1, 2, 3, 4, 5])).toBe(3);
  });

  it('should calculate median for even-length array', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('should handle empty array', () => {
    expect(median([])).toBe(0);
  });
});

describe('mode', () => {
  it('should find the most frequent value', () => {
    expect(mode([1, 2, 2, 3, 3, 3, 4])).toBe(3);
  });

  it('should handle empty array', () => {
    expect(mode([])).toBe(0);
  });
});

describe('variance and standardDeviation', () => {
  it('should calculate variance', () => {
    expect(variance([1, 2, 3, 4, 5])).toBe(2);
  });

  it('should calculate standard deviation', () => {
    expect(standardDeviation([1, 2, 3, 4, 5])).toBeCloseTo(1.414, 2);
  });

  it('should handle single value', () => {
    expect(variance([5])).toBe(0);
    expect(standardDeviation([5])).toBe(0);
  });
});

describe('coefficientOfVariation', () => {
  it('should calculate CV as percentage', () => {
    const cv = coefficientOfVariation([10, 12, 14, 16, 18]);
    expect(cv).toBeGreaterThan(0);
    expect(cv).toBeLessThan(100);
  });

  it('should return 0 for constant values', () => {
    expect(coefficientOfVariation([5, 5, 5, 5])).toBe(0);
  });
});

describe('percentile', () => {
  it('should calculate 50th percentile (median)', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });

  it('should calculate 25th percentile (Q1)', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8], 25)).toBe(2.75);
  });

  it('should calculate 75th percentile (Q3)', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8], 75)).toBe(6.25);
  });

  it('should handle 0th percentile', () => {
    expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1);
  });

  it('should handle 100th percentile', () => {
    expect(percentile([1, 2, 3, 4, 5], 100)).toBe(5);
  });
});

describe('percentiles', () => {
  it('should calculate multiple percentiles', () => {
    const result = percentiles([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [25, 50, 75, 90, 95]);
    expect(result).toHaveProperty('25');
    expect(result).toHaveProperty('50');
    expect(result).toHaveProperty('75');
    expect(result).toHaveProperty('90');
    expect(result).toHaveProperty('95');
  });
});

describe('confidenceInterval', () => {
  it('should calculate 95% confidence interval', () => {
    const ci = confidenceInterval([1, 2, 3, 4, 5], 0.95);
    expect(ci.lower).toBeLessThan(3);
    expect(ci.upper).toBeGreaterThan(3);
    expect(ci.level).toBe(0.95);
  });

  it('should handle single value', () => {
    const ci = confidenceInterval([5], 0.95);
    expect(ci.lower).toBe(5);
    expect(ci.upper).toBe(5);
  });
});

describe('detectOutliersIQR', () => {
  it('should detect outliers using IQR method', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
    const outliers = detectOutliersIQR(data);
    expect(outliers.count).toBeGreaterThan(0);
    expect(outliers.values).toContain(100);
  });

  it('should return no outliers for normal distribution', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const outliers = detectOutliersIQR(data);
    expect(outliers.count).toBe(0);
  });
});

describe('detectOutliersZScore', () => {
  it('should detect outliers using Z-score method', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
    const outliers = detectOutliersZScore(data, 2);
    expect(outliers.count).toBeGreaterThan(0);
  });
});

describe('detectOutliersModifiedZScore', () => {
  it('should detect outliers using modified Z-score method', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
    const outliers = detectOutliersModifiedZScore(data, 3.5);
    expect(outliers.count).toBeGreaterThan(0);
  });
});

describe('detectOutliers', () => {
  it('should use IQR method by default', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
    const outliers = detectOutliers(data, 'iqr');
    expect(outliers.method).toBe('iqr');
  });

  it('should support zscore method', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
    const outliers = detectOutliers(data, 'zscore');
    expect(outliers.method).toBe('zscore');
  });

  it('should support modified-zscore method', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
    const outliers = detectOutliers(data, 'modified-zscore');
    expect(outliers.method).toBe('modified-zscore');
  });
});

describe('removeOutliers', () => {
  it('should remove outliers from data', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
    const outliers = detectOutliersIQR(data);
    const cleaned = removeOutliers(data, outliers);
    expect(cleaned).not.toContain(100);
    expect(cleaned.length).toBeLessThan(data.length);
  });
});

describe('analyze', () => {
  it('should perform comprehensive statistical analysis', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const analysis = analyze(data);

    expect(analysis.mean).toBeDefined();
    expect(analysis.median).toBeDefined();
    expect(analysis.mode).toBeDefined();
    expect(analysis.standardDeviation).toBeDefined();
    expect(analysis.variance).toBeDefined();
    expect(analysis.cv).toBeDefined();
    expect(analysis.skewness).toBeDefined();
    expect(analysis.kurtosis).toBeDefined();
    expect(analysis.min).toBeDefined();
    expect(analysis.max).toBeDefined();
    expect(analysis.range).toBeDefined();
    expect(analysis.iqr).toBeDefined();
    expect(analysis.percentiles).toBeDefined();
    expect(analysis.outliers).toBeDefined();
  });
});

describe('skewness', () => {
  it('should calculate skewness', () => {
    expect(skewness([1, 2, 3, 4, 5])).toBeCloseTo(0, 5);
  });

  it('should handle small arrays', () => {
    expect(skewness([1, 2])).toBe(0);
  });
});

describe('kurtosis', () => {
  it('should calculate kurtosis', () => {
    const k = kurtosis([1, 2, 3, 4, 5]);
    expect(k).toBeDefined();
    expect(typeof k).toBe('number');
  });

  it('should handle small arrays', () => {
    expect(kurtosis([1, 2, 3])).toBe(0);
  });
});

describe('range', () => {
  it('should calculate range', () => {
    expect(range([1, 2, 3, 4, 5])).toBe(4);
    expect(range([10, 20, 30])).toBe(20);
  });
});

describe('interquartileRange', () => {
  it('should calculate IQR', () => {
    expect(interquartileRange([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBeCloseTo(5, 0);
  });
});

describe('geometricMean', () => {
  it('should calculate geometric mean', () => {
    expect(geometricMean([1, 2, 4, 8])).toBeCloseTo(2.828, 2);
  });

  it('should handle empty array', () => {
    expect(geometricMean([])).toBe(0);
  });
});

describe('harmonicMean', () => {
  it('should calculate harmonic mean', () => {
    expect(harmonicMean([1, 2, 4])).toBeCloseTo(1.714, 2);
  });

  it('should handle empty array', () => {
    expect(harmonicMean([])).toBe(0);
  });
});

describe('movingAverage', () => {
  it('should calculate simple moving average', () => {
    const result = movingAverage([1, 2, 3, 4, 5], 3);
    expect(result).toEqual([2, 3, 4]);
  });

  it('should handle window larger than data', () => {
    const result = movingAverage([1, 2, 3], 10);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(2);
  });
});

describe('exponentialMovingAverage', () => {
  it('should calculate exponential moving average', () => {
    const result = exponentialMovingAverage([1, 2, 3, 4, 5], 0.5);
    expect(result).toHaveLength(5);
    expect(result[0]).toBe(1);
  });

  it('should throw error for invalid alpha', () => {
    expect(() => exponentialMovingAverage([1, 2, 3], -1)).toThrow();
    expect(() => exponentialMovingAverage([1, 2, 3], 2)).toThrow();
  });
});

describe('trimMean', () => {
  it('should calculate trimmed mean', () => {
    expect(trimMean([1, 2, 3, 4, 5, 100], 0.2)).toBeCloseTo(3.5, 1);
  });
});

describe('tTest', () => {
  it('should perform two-sample t-test', () => {
    const sample1 = [1, 2, 3, 4, 5];
    const sample2 = [2, 3, 4, 5, 6];
    const result = tTest(sample1, sample2);

    expect(result.tStatistic).toBeDefined();
    expect(result.pValue).toBeDefined();
    expect(result.significant).toBeDefined();
  });

  it('should detect significant difference', () => {
    const sample1 = [1, 1, 1, 1, 1];
    const sample2 = [100, 100, 100, 100, 100];
    const result = tTest(sample1, sample2);

    expect(result.significant).toBe(true);
    expect(result.pValue).toBeLessThan(0.05);
  });
});

describe('mannWhitneyUTest', () => {
  it('should perform Mann-Whitney U test', () => {
    const sample1 = [1, 2, 3, 4, 5];
    const sample2 = [2, 3, 4, 5, 6];
    const result = mannWhitneyUTest(sample1, sample2);

    expect(result.uStatistic).toBeDefined();
    expect(result.pValue).toBeDefined();
    expect(result.significant).toBeDefined();
  });
});

describe('cohensD', () => {
  it('should calculate effect size', () => {
    const sample1 = [1, 2, 3, 4, 5];
    const sample2 = [3, 4, 5, 6, 7];
    const d = cohensD(sample1, sample2);

    expect(d).toBeDefined();
    expect(typeof d).toBe('number');
  });

  it('should return 0 for identical samples', () => {
    const sample = [1, 2, 3, 4, 5];
    expect(cohensD(sample, sample)).toBe(0);
  });
});
