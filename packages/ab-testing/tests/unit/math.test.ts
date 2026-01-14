/**
 * Unit tests for Math Utilities
 */

import { describe, it, expect } from 'vitest';
import {
  mean,
  median,
  variance,
  standardDeviation,
  percentile,
  percentiles,
  standardError,
  marginOfError,
  zScore,
  round,
  clamp,
  lerp,
  mapRange,
  movingAverage,
  ema,
  sum,
  product,
  min,
  max,
  range,
  mode,
  skewness,
  kurtosis,
  coefficientOfVariation,
  geometricMean,
  harmonicMean,
  normalize,
  standardize,
  correlation,
  covariance,
  safeDivide,
  percentage,
  percentageChange
} from '../../src/utils/math';

describe('Math Utilities', () => {
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
    it('should calculate median for odd length', () => {
      expect(median([1, 2, 3, 4, 5])).toBe(3);
    });

    it('should calculate median for even length', () => {
      expect(median([1, 2, 3, 4])).toBe(2.5);
    });

    it('should handle unsorted input', () => {
      expect(median([5, 1, 3, 2, 4])).toBe(3);
    });
  });

  describe('variance', () => {
    it('should calculate sample variance', () => {
      expect(variance([1, 2, 3, 4, 5])).toBeCloseTo(2.5, 2);
    });

    it('should calculate population variance', () => {
      expect(variance([1, 2, 3, 4, 5], false)).toBeCloseTo(2, 2);
    });
  });

  describe('standardDeviation', () => {
    it('should calculate sample standard deviation', () => {
      expect(standardDeviation([1, 2, 3, 4, 5])).toBeCloseTo(1.58, 2);
    });
  });

  describe('percentile', () => {
    it('should calculate percentiles', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      expect(percentile(data, 25)).toBeCloseTo(3.25, 2);
      expect(percentile(data, 50)).toBeCloseTo(5.5, 2);
      expect(percentile(data, 75)).toBeCloseTo(7.75, 2);
    });
  });

  describe('percentiles', () => {
    it('should calculate multiple percentiles', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = percentiles(data);

      expect(result.p25).toBeGreaterThan(0);
      expect(result.p50).toBeGreaterThan(result.p25);
      expect(result.p75).toBeGreaterThan(result.p50);
      expect(result.p90).toBeGreaterThan(result.p75);
      expect(result.p95).toBeGreaterThan(result.p90);
      expect(result.p99).toBeGreaterThan(result.p95);
    });
  });

  describe('standardError', () => {
    it('should calculate standard error', () => {
      expect(standardError(2, 100)).toBeCloseTo(0.2, 2);
    });

    it('should handle zero sample size', () => {
      expect(standardError(2, 0)).toBe(0);
    });
  });

  describe('marginOfError', () => {
    it('should calculate margin of error', () => {
      const moe = marginOfError(0.5, 100, 0.95);
      expect(moe).toBeGreaterThan(0);
      expect(moe).toBeLessThan(1);
    });
  });

  describe('zScore', () => {
    it('should return correct z-scores', () => {
      expect(zScore(0.90)).toBeCloseTo(1.645, 2);
      expect(zScore(0.95)).toBeCloseTo(1.96, 2);
      expect(zScore(0.99)).toBeCloseTo(2.576, 2);
    });
  });

  describe('round', () => {
    it('should round to decimal places', () => {
      expect(round(3.14159, 2)).toBe(3.14);
      expect(round(3.14159, 4)).toBe(3.1416);
      expect(round(3.5, 0)).toBe(4);
    });
  });

  describe('clamp', () => {
    it('should clamp values', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('lerp', () => {
    it('should interpolate linearly', () => {
      expect(lerp(0, 10, 0.5)).toBe(5);
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 1)).toBe(10);
    });
  });

  describe('mapRange', () => {
    it('should map value from one range to another', () => {
      expect(mapRange(5, 0, 10, 0, 100)).toBe(50);
      expect(mapRange(0, 0, 10, 0, 100)).toBe(0);
      expect(mapRange(10, 0, 10, 0, 100)).toBe(100);
    });
  });

  describe('movingAverage', () => {
    it('should calculate moving average', () => {
      const data = [1, 2, 3, 4, 5];
      const ma = movingAverage(data, 3);

      expect(ma[0]).toBe(1);
      expect(ma[1]).toBe(1.5);
      expect(ma[2]).toBe(2);
      expect(ma[3]).toBe(3);
      expect(ma[4]).toBe(4);
    });
  });

  describe('ema', () => {
    it('should calculate exponential moving average', () => {
      const data = [1, 2, 3, 4, 5];
      const result = ema(data, 0.5);

      expect(result[0]).toBeCloseTo(1, 1);
      expect(result[4]).toBeGreaterThan(result[3]);
      expect(result[4]).toBeLessThan(5);
    });
  });

  describe('sum', () => {
    it('should calculate sum', () => {
      expect(sum([1, 2, 3, 4, 5])).toBe(15);
      expect(sum([-1, 1])).toBe(0);
    });
  });

  describe('product', () => {
    it('should calculate product', () => {
      expect(product([2, 3, 4])).toBe(24);
      expect(product([1, 2, 3])).toBe(6);
    });
  });

  describe('min and max', () => {
    it('should find min and max', () => {
      expect(min([5, 2, 8, 1, 9])).toBe(1);
      expect(max([5, 2, 8, 1, 9])).toBe(9);
    });
  });

  describe('range', () => {
    it('should calculate range', () => {
      expect(range([1, 2, 3, 4, 5])).toBe(4);
      expect(range([10, 20, 30])).toBe(20);
    });
  });

  describe('mode', () => {
    it('should find most frequent value', () => {
      expect(mode([1, 2, 2, 3, 3, 3])).toBe(3);
      expect(mode([1, 1, 2, 2])).toBe(1); // First occurrence
    });
  });

  describe('skewness', () => {
    it('should calculate skewness', () => {
      const normal = [1, 2, 3, 4, 5];
      const skewed = [1, 1, 1, 1, 10];

      expect(skewness(normal)).toBeCloseTo(0, 0);
      expect(skewness(skewed)).toBeGreaterThan(0);
    });
  });

  describe('kurtosis', () => {
    it('should calculate kurtosis', () => {
      const data = [1, 2, 3, 4, 5, 6, 7];
      const k = kurtosis(data);

      expect(typeof k).toBe('number');
    });
  });

  describe('coefficientOfVariation', () => {
    it('should calculate CV', () => {
      const cv = coefficientOfVariation([1, 2, 3, 4, 5]);
      expect(cv).toBeGreaterThan(0);
    });
  });

  describe('geometricMean', () => {
    it('should calculate geometric mean', () => {
      expect(geometricMean([1, 2, 4])).toBeCloseTo(2, 1);
    });
  });

  describe('harmonicMean', () => {
    it('should calculate harmonic mean', () => {
      expect(harmonicMean([1, 2, 4])).toBeCloseTo(1.71, 1);
    });
  });

  describe('normalize', () => {
    it('should normalize to 0-1 range', () => {
      const normalized = normalize([1, 2, 3, 4, 5]);

      expect(normalized[0]).toBeCloseTo(0, 1);
      expect(normalized[4]).toBeCloseTo(1, 1);
      expect(normalized[2]).toBeCloseTo(0.5, 1);
    });
  });

  describe('standardize', () => {
    it('should calculate z-scores', () => {
      const standardized = standardize([1, 2, 3, 4, 5]);

      expect(standardized[2]).toBeCloseTo(0, 1);
      expect(standardized[0]).toBeLessThan(0);
      expect(standardized[4]).toBeGreaterThan(0);
    });
  });

  describe('correlation', () => {
    it('should calculate correlation coefficient', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];

      expect(correlation(x, y)).toBeCloseTo(1, 1);

      const y2 = [5, 4, 3, 2, 1];
      expect(correlation(x, y2)).toBeCloseTo(-1, 1);
    });

    it('should handle uncorrelated data', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [1, 3, 2, 4, 5];

      const corr = correlation(x, y);
      expect(Math.abs(corr)).toBeLessThan(1);
    });
  });

  describe('covariance', () => {
    it('should calculate covariance', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];

      const cov = covariance(x, y);
      expect(cov).toBeGreaterThan(0);
    });
  });

  describe('safeDivide', () => {
    it('should divide safely', () => {
      expect(safeDivide(10, 2)).toBe(5);
      expect(safeDivide(10, 0)).toBe(0);
      expect(safeDivide(10, 0, -1)).toBe(-1);
    });
  });

  describe('percentage', () => {
    it('should calculate percentage', () => {
      expect(percentage(50, 100)).toBe(50);
      expect(percentage(1, 4)).toBe(25);
      expect(percentage(0, 100)).toBe(0);
    });
  });

  describe('percentageChange', () => {
    it('should calculate percentage change', () => {
      expect(percentageChange(100, 150)).toBe(50);
      expect(percentageChange(100, 50)).toBe(-50);
      expect(percentageChange(0, 10)).toBe(0);
    });
  });
});
