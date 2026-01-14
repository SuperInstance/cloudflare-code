/**
 * Unit tests for statistical analysis
 */

import { describe, it, expect } from 'vitest';
import { StatisticalAnalyzer } from '../../src/abtesting/engine';

describe('StatisticalAnalyzer', () => {
  describe('zTest', () => {
    it('should perform z-test for proportions', () => {
      const control = {
        totalUsers: 1000,
        conversions: 100,
        conversionRate: 0.1,
        standardError: 0.0095,
        confidenceInterval: { lower: 0.0814, upper: 0.1186 },
      };

      const variant = {
        totalUsers: 1000,
        conversions: 120,
        conversionRate: 0.12,
        standardError: 0.0103,
        confidenceInterval: { lower: 0.0997, upper: 0.1403 },
      };

      const result = StatisticalAnalyzer.zTest(control, variant, 0.95);

      expect(result.testName).toBe('Z-test');
      expect(result.pValue).toBeGreaterThan(0);
      expect(result.pValue).toBeLessThan(1);
      expect(result.effectSize).toBeDefined();
    });

    it('should detect significant difference', () => {
      const control = {
        totalUsers: 1000,
        conversions: 100,
        conversionRate: 0.1,
        standardError: 0.0095,
        confidenceInterval: { lower: 0.0814, upper: 0.1186 },
      };

      const variant = {
        totalUsers: 1000,
        conversions: 150,
        conversionRate: 0.15,
        standardError: 0.0114,
        confidenceInterval: { lower: 0.1273, upper: 0.1727 },
      };

      const result = StatisticalAnalyzer.zTest(control, variant, 0.95);

      expect(result.isSignificant).toBe(true);
      expect(result.pValue).toBeLessThan(0.05);
    });

    it('should not detect significance for small differences', () => {
      const control = {
        totalUsers: 1000,
        conversions: 100,
        conversionRate: 0.1,
        standardError: 0.0095,
        confidenceInterval: { lower: 0.0814, upper: 0.1186 },
      };

      const variant = {
        totalUsers: 1000,
        conversions: 105,
        conversionRate: 0.105,
        standardError: 0.0097,
        confidenceInterval: { lower: 0.0859, upper: 0.1241 },
      };

      const result = StatisticalAnalyzer.zTest(control, variant, 0.95);

      expect(result.isSignificant).toBe(false);
    });
  });

  describe('chiSquareTest', () => {
    it('should perform chi-square test', () => {
      const control = {
        totalUsers: 1000,
        conversions: 100,
        conversionRate: 0.1,
        standardError: 0.0095,
        confidenceInterval: { lower: 0.0814, upper: 0.1186 },
      };

      const variant = {
        totalUsers: 1000,
        conversions: 120,
        conversionRate: 0.12,
        standardError: 0.0103,
        confidenceInterval: { lower: 0.0997, upper: 0.1403 },
      };

      const result = StatisticalAnalyzer.chiSquareTest(control, variant, 0.95);

      expect(result.testName).toBe('Chi-square test');
      expect(result.pValue).toBeGreaterThan(0);
      expect(result.testStatistic).toBeGreaterThan(0);
    });
  });

  describe('calculateMinSampleSize', () => {
    it('should calculate minimum sample size', () => {
      const baselineRate = 0.1;
      const minimumEffect = 0.02; // 2% absolute increase
      const sampleSize = StatisticalAnalyzer.calculateMinSampleSize(
        baselineRate,
        minimumEffect,
        0.95,
        0.8
      );

      expect(sampleSize).toBeGreaterThan(0);
      expect(Number.isInteger(sampleSize)).toBe(true);
    });

    it('should require larger sample for smaller effects', () => {
      const baselineRate = 0.1;

      const sampleSize1 = StatisticalAnalyzer.calculateMinSampleSize(
        baselineRate,
        0.05,
        0.95,
        0.8
      );

      const sampleSize2 = StatisticalAnalyzer.calculateMinSampleSize(
        baselineRate,
        0.01,
        0.95,
        0.8
      );

      expect(sampleSize2).toBeGreaterThan(sampleSize1);
    });
  });

  describe('confidenceInterval', () => {
    it('should calculate confidence interval for proportion', () => {
      const interval = StatisticalAnalyzer.confidenceInterval(100, 1000, 0.95);

      expect(interval.lower).toBeGreaterThan(0);
      expect(interval.upper).toBeLessThan(1);
      expect(interval.upper).toBeGreaterThan(interval.lower);
    });

    it('should calculate narrower interval for larger samples', () => {
      const interval1 = StatisticalAnalyzer.confidenceInterval(10, 100, 0.95);
      const interval2 = StatisticalAnalyzer.confidenceInterval(100, 1000, 0.95);

      const width1 = interval1.upper - interval1.lower;
      const width2 = interval2.upper - interval2.lower;

      expect(width2).toBeLessThan(width1);
    });
  });
});
