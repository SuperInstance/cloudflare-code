/**
 * Unit tests for Statistical Engine
 */

import { describe, it, expect } from 'vitest';
import { StatisticalEngine } from '../../src/statistics/engine';

describe('StatisticalEngine', () => {
  let engine: StatisticalEngine;

  beforeEach(() => {
    engine = new StatisticalEngine();
  });

  describe('zTestProportions', () => {
    it('should detect significant difference', () => {
      const result = engine.zTestProportions(
        100, // control conversions
        1000, // control total
        120, // treatment conversions
        1000, // treatment total
        0.05 // alpha
      );

      expect(result.significant).toBe(true);
      expect(result.pValue).toBeLessThan(0.05);
      expect(result.effectSize).toBeCloseTo(0.02, 2);
    });

    it('should not detect significant difference when none exists', () => {
      const result = engine.zTestProportions(
        100,
        1000,
        102,
        1000,
        0.05
      );

      expect(result.significant).toBe(false);
      expect(result.pValue).toBeGreaterThan(0.05);
    });

    it('should calculate correct confidence interval', () => {
      const result = engine.zTestProportions(
        100,
        1000,
        120,
        1000,
        0.05
      );

      const [lower, upper] = result.confidenceInterval;
      expect(lower).toBeLessThan(result.effectSize);
      expect(upper).toBeGreaterThan(result.effectSize);
    });

    it('should calculate power', () => {
      const result = engine.zTestProportions(
        100,
        1000,
        120,
        1000,
        0.05
      );

      expect(result.power).toBeGreaterThan(0);
      expect(result.power).toBeLessThanOrEqual(1);
    });
  });

  describe('tTestMeans', () => {
    it('should detect significant difference in means', () => {
      const result = engine.tTestMeans(
        100, // control mean
        20, // control std
        100, // control n
        110, // treatment mean
        20, // treatment std
        100, // treatment n
        0.05
      );

      expect(result.significant).toBe(true);
      expect(result.effectSize).toBeCloseTo(10, 1);
    });

    it('should handle small differences', () => {
      const result = engine.tTestMeans(
        100,
        20,
        100,
        101,
        20,
        100,
        0.05
      );

      expect(result.significant).toBe(false);
    });
  });

  describe('chiSquareTest', () => {
    it('should detect significant association', () => {
      const result = engine.chiSquareTest(
        100,
        1000,
        150,
        1000,
        0.05
      );

      expect(result.significant).toBe(true);
      expect(result.pValue).toBeLessThan(0.05);
    });

    it('should not detect association when none exists', () => {
      const result = engine.chiSquareTest(
        100,
        1000,
        102,
        1000,
        0.05
      );

      expect(result.significant).toBe(false);
    });
  });

  describe('bayesianAnalysis', () => {
    it('should favor better variant', () => {
      const result = engine.bayesianAnalysis(
        100,
        1000,
        150,
        1000,
        0.01
      );

      expect(result.probability).toBeGreaterThan(0.9);
      expect(result.recommendation).toBe('deploy');
    });

    it('should recommend continue when uncertain', () => {
      const result = engine.bayesianAnalysis(
        100,
        1000,
        105,
        1000,
        0.01
      );

      expect(result.probability).toBeLessThan(0.99);
      expect(result.recommendation).toBe('continue');
    });

    it('should recommend rollback for worse variant', () => {
      const result = engine.bayesianAnalysis(
        150,
        1000,
        100,
        1000,
        0.01
      );

      expect(result.probability).toBeLessThan(0.01);
      expect(result.recommendation).toBe('rollback');
    });

    it('should calculate expected loss', () => {
      const result = engine.bayesianAnalysis(
        100,
        1000,
        120,
        1000,
        0.01
      );

      expect(result.expectedLoss).toBeGreaterThanOrEqual(0);
      expect(result.expectedLoss).toBeLessThan(1);
    });
  });

  describe('cohenD', () => {
    it('should calculate effect size', () => {
      const cohenD = engine.cohenD(
        100, // control mean
        20, // control std
        110, // treatment mean
        20 // treatment std
      );

      expect(cohenD).toBeCloseTo(0.5, 1);
    });

    it('should classify small effect', () => {
      const cohenD = engine.cohenD(100, 20, 104, 20);
      expect(Math.abs(cohenD)).toBeLessThan(0.2);
    });

    it('should classify medium effect', () => {
      const cohenD = engine.cohenD(100, 20, 110, 20);
      expect(Math.abs(cohenD)).toBeGreaterThanOrEqual(0.2);
      expect(Math.abs(cohenD)).toBeLessThan(0.8);
    });

    it('should classify large effect', () => {
      const cohenD = engine.cohenD(100, 20, 120, 20);
      expect(Math.abs(cohenD)).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('calculateLift', () => {
    it('should calculate positive lift', () => {
      const lift = engine.calculateLift(100, 120);
      expect(lift).toBeCloseTo(0.2, 2);
    });

    it('should calculate negative lift', () => {
      const lift = engine.calculateLift(100, 80);
      expect(lift).toBeCloseTo(-0.2, 2);
    });

    it('should handle zero baseline', () => {
      const lift = engine.calculateLift(0, 10);
      expect(lift).toBe(1);
    });
  });

  describe('proportionCI', () => {
    it('should calculate confidence interval', () => {
      const [lower, upper] = engine.proportionCI(100, 1000, 0.95);

      expect(lower).toBeGreaterThan(0);
      expect(upper).toBeLessThan(1);
      expect(lower).toBeLessThan(0.1); // 100/1000 = 0.1
      expect(upper).toBeGreaterThan(0.1);
    });

    it('should narrow with larger sample', () => {
      const ci1 = engine.proportionCI(100, 1000, 0.95);
      const ci2 = engine.proportionCI(1000, 10000, 0.95);

      const width1 = ci1[1] - ci1[0];
      const width2 = ci2[1] - ci2[0];

      expect(width2).toBeLessThan(width1);
    });
  });

  describe('meanCI', () => {
    it('should calculate confidence interval for mean', () => {
      const [lower, upper] = engine.meanCI(100, 20, 100, 0.95);

      expect(lower).toBeLessThan(100);
      expect(upper).toBeGreaterThan(100);
    });

    it('should narrow with larger sample', () => {
      const ci1 = engine.meanCI(100, 20, 50, 0.95);
      const ci2 = engine.meanCI(100, 20, 200, 0.95);

      const width1 = ci1[1] - ci1[0];
      const width2 = ci2[1] - ci2[0];

      expect(width2).toBeLessThan(width1);
    });
  });

  describe('compareVariants', () => {
    it('should compare binary metrics', () => {
      const control = {
        variantId: 'control',
        sampleSize: 1000,
        metrics: {
          conversion: {
            name: 'conversion',
            count: 1000,
            sum: 100,
            mean: 0.1,
            variance: 0.09,
            standardDeviation: 0.3,
            min: 0,
            max: 1,
            percentiles: { p25: 0, p50: 0, p75: 0, p90: 1, p95: 1, p99: 1 }
          }
        }
      };

      const treatment = {
        variantId: 'treatment',
        sampleSize: 1000,
        metrics: {
          conversion: {
            name: 'conversion',
            count: 1000,
            sum: 120,
            mean: 0.12,
            variance: 0.1056,
            standardDeviation: 0.325,
            min: 0,
            max: 1,
            percentiles: { p25: 0, p50: 0, p75: 0, p90: 1, p95: 1, p99: 1 }
          }
        }
      };

      const comparison = engine.compareVariants(control, treatment, 'conversion', {
        testType: 'z_test',
        alpha: 0.05,
        minSampleSize: 100
      });

      expect(comparison.lift).toBeCloseTo(0.2, 1);
      expect(comparison.testResults.effectSize).toBeCloseTo(0.02, 2);
    });
  });

  describe('determineWinner', () => {
    it('should determine winner when significant', () => {
      const results = {
        experimentId: 'test',
        status: 'running' as const,
        variantStats: [
          {
            variantId: 'control',
            sampleSize: 1000,
            metrics: {
              conversion: {
                name: 'conversion',
                count: 1000,
                sum: 100,
                mean: 0.1,
                variance: 0.09,
                standardDeviation: 0.3,
                min: 0,
                max: 1,
                percentiles: { p25: 0, p50: 0, p75: 0, p90: 1, p95: 1, p99: 1 }
              }
            }
          },
          {
            variantId: 'treatment',
            sampleSize: 1000,
            metrics: {
              conversion: {
                name: 'conversion',
                count: 1000,
                sum: 150,
                mean: 0.15,
                variance: 0.1275,
                standardDeviation: 0.357,
                min: 0,
                max: 1,
                percentiles: { p25: 0, p50: 0, p75: 0, p90: 1, p95: 1, p99: 1 }
              }
            }
          }
        ],
        testResults: {},
        totalParticipants: 2000,
        timestamp: Date.now()
      };

      const winner = engine.determineWinner(results, 'conversion', {
        testType: 'z_test',
        alpha: 0.05,
        minSampleSize: 100
      });

      expect(winner.variantId).toBe('treatment');
      expect(winner.confidence).toBeGreaterThan(0);
      expect(winner.lift).toBeGreaterThan(0);
    });

    it('should return null when no significant winner', () => {
      const results = {
        experimentId: 'test',
        status: 'running' as const,
        variantStats: [
          {
            variantId: 'control',
            sampleSize: 1000,
            metrics: {
              conversion: {
                name: 'conversion',
                count: 1000,
                sum: 100,
                mean: 0.1,
                variance: 0.09,
                standardDeviation: 0.3,
                min: 0,
                max: 1,
                percentiles: { p25: 0, p50: 0, p75: 0, p90: 1, p95: 1, p99: 1 }
              }
            }
          },
          {
            variantId: 'treatment',
            sampleSize: 1000,
            metrics: {
              conversion: {
                name: 'conversion',
                count: 1000,
                sum: 102,
                mean: 0.102,
                variance: 0.0916,
                standardDeviation: 0.303,
                min: 0,
                max: 1,
                percentiles: { p25: 0, p50: 0, p75: 0, p90: 1, p95: 1, p99: 1 }
              }
            }
          }
        ],
        testResults: {},
        totalParticipants: 2000,
        timestamp: Date.now()
      };

      const winner = engine.determineWinner(results, 'conversion', {
        testType: 'z_test',
        alpha: 0.05,
        minSampleSize: 100
      });

      expect(winner.variantId).toBeNull();
      expect(winner.reasoning).toContain('No statistically significant winner');
    });
  });
});
