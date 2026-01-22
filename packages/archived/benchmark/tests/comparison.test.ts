/**
 * Comparison Engine Tests
 * Comprehensive test suite for the comparison engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ComparisonEngine } from '../src/comparison/index.js';
import type { BenchmarkResult } from '../src/types/index.js';

describe('ComparisonEngine', () => {
  let engine: ComparisonEngine;
  let baselineResult: BenchmarkResult;
  let currentResult: BenchmarkResult;

  beforeEach(() => {
    engine = new ComparisonEngine();

    // Create mock baseline result
    baselineResult = {
      name: 'test-benchmark',
      samples: Array.from({ length: 100 }, () => 1000 + Math.random() * 100),
      total: 100000,
      mean: 1000,
      standardDeviation: 50,
      rsd: 5,
      min: 900,
      max: 1100,
      median: 1000,
      mode: 1000,
      percentiles: { 50: 1000, 95: 1090 },
      ops: 1000000,
      confidence: { lower: 950, upper: 1050, level: 0.95 },
      significant: true,
      startTime: 1000,
      endTime: 2000
    };

    // Create mock current result (10% faster)
    currentResult = {
      name: 'test-benchmark',
      samples: Array.from({ length: 100 }, () => 900 + Math.random() * 90),
      total: 90000,
      mean: 900,
      standardDeviation: 45,
      rsd: 5,
      min: 810,
      max: 990,
      median: 900,
      mode: 900,
      percentiles: { 50: 900, 95: 980 },
      ops: 1111111,
      confidence: { lower: 855, upper: 945, level: 0.95 },
      significant: true,
      startTime: 2000,
      endTime: 3000
    };
  });

  describe('compare', () => {
    it('should compare two benchmark results', () => {
      const comparison = engine.compare(baselineResult, currentResult);

      expect(comparison.name).toBe('test-benchmark');
      expect(comparison.baseline).toEqual(baselineResult);
      expect(comparison.current).toEqual(currentResult);
      expect(comparison.difference).toBeDefined();
      expect(comparison.significance).toBeDefined();
      expect(comparison.verdict).toBeDefined();
    });

    it('should calculate performance difference correctly', () => {
      const comparison = engine.compare(baselineResult, currentResult);

      expect(comparison.difference.absolute).toBe(-100);
      expect(comparison.difference.relative).toBeCloseTo(-10, 1);
      expect(comparison.difference.speedup).toBeCloseTo(1.11, 2);
    });

    it('should detect improvement when current is faster', () => {
      const comparison = engine.compare(baselineResult, currentResult);

      expect(comparison.verdict).toBe('improved');
    });

    it('should detect regression when current is slower', () => {
      const slowerResult = { ...currentResult, mean: 1100 };
      const comparison = engine.compare(baselineResult, slowerResult);

      expect(comparison.verdict).toBe('regressed');
    });

    it('should return no-change for similar results', () => {
      const similarResult = { ...currentResult, mean: 1005 };
      const comparison = engine.compare(baselineResult, similarResult);

      expect(comparison.verdict).toBe('no-change');
    });
  });

  describe('compareAll', () => {
    it('should compare multiple benchmark results', () => {
      const baseline = [
        { ...baselineResult, name: 'bench1' },
        { ...baselineResult, name: 'bench2' }
      ];

      const current = [
        { ...currentResult, name: 'bench1' },
        { ...currentResult, name: 'bench2' }
      ];

      const comparisons = engine.compareAll(baseline, current);

      expect(comparisons).toHaveLength(2);
      expect(comparisons[0].name).toBe('bench1');
      expect(comparisons[1].name).toBe('bench2');
    });

    it('should only compare matching benchmarks', () => {
      const baseline = [
        { ...baselineResult, name: 'bench1' },
        { ...baselineResult, name: 'bench2' }
      ];

      const current = [
        { ...currentResult, name: 'bench1' },
        { ...currentResult, name: 'bench3' }
      ];

      const comparisons = engine.compareAll(baseline, current);

      expect(comparisons).toHaveLength(1);
      expect(comparisons[0].name).toBe('bench1');
    });
  });

  describe('generateReport', () => {
    it('should generate comparison report', () => {
      const comparisons = [
        engine.compare(baselineResult, currentResult),
        engine.compare(
          { ...baselineResult, name: 'bench2' },
          { ...currentResult, name: 'bench2', mean: 1100 }
        )
      ];

      const report = engine.generateReport(comparisons, 'test-report');

      expect(report.name).toBe('test-report');
      expect(report.comparisons).toHaveLength(2);
      expect(report.summary).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.metadata).toBeDefined();
    });

    it('should generate correct summary', () => {
      const comparisons = [
        engine.compare(baselineResult, currentResult),
        engine.compare(
          { ...baselineResult, name: 'bench2' },
          { ...currentResult, name: 'bench2', mean: 1100 }
        )
      ];

      const report = engine.generateReport(comparisons);

      expect(report.summary.total).toBe(2);
      expect(report.summary.improvements).toBe(1);
      expect(report.summary.regressions).toBe(1);
    });

    it('should generate recommendations', () => {
      const comparisons = [
        engine.compare(
          baselineResult,
          { ...currentResult, mean: 1200 }
        )
      ];

      const report = engine.generateReport(comparisons);

      expect(report.recommendations).toBeDefined();
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('detectRegression', () => {
    it('should detect regression when performance degrades', () => {
      const regression = engine.detectRegression(baselineResult, {
        ...currentResult,
        mean: 1200
      }, 0.05);

      expect(regression.isRegression).toBe(true);
      expect(regression.percentChange).toBeGreaterThan(0);
    });

    it('should not detect regression within threshold', () => {
      const regression = engine.detectRegression(baselineResult, {
        ...currentResult,
        mean: 1020
      }, 0.05);

      expect(regression.isRegression).toBe(false);
    });
  });

  describe('calculateTrend', () => {
    it('should detect improving trend', () => {
      const results = [
        { ...baselineResult, mean: 1100 },
        { ...baselineResult, mean: 1050 },
        { ...baselineResult, mean: 1000 },
        { ...baselineResult, mean: 950 },
        { ...baselineResult, mean: 900 }
      ];

      const trend = engine.calculateTrend(results);

      expect(trend.trend).toBe('improving');
      expect(trend.slope).toBeLessThan(0);
    });

    it('should detect degrading trend', () => {
      const results = [
        { ...baselineResult, mean: 900 },
        { ...baselineResult, mean: 950 },
        { ...baselineResult, mean: 1000 },
        { ...baselineResult, mean: 1050 },
        { ...baselineResult, mean: 1100 }
      ];

      const trend = engine.calculateTrend(results);

      expect(trend.trend).toBe('degrading');
      expect(trend.slope).toBeGreaterThan(0);
    });

    it('should detect stable trend', () => {
      const results = [
        { ...baselineResult, mean: 1000 },
        { ...baselineResult, mean: 1005 },
        { ...baselineResult, mean: 995 },
        { ...baselineResult, mean: 1002 },
        { ...baselineResult, mean: 998 }
      ];

      const trend = engine.calculateTrend(results);

      expect(trend.trend).toBe('stable');
    });
  });

  describe('compareWithHistory', () => {
    it('should compare with historical baseline', () => {
      const history = [
        { ...baselineResult, mean: 1100 },
        { ...baselineResult, mean: 1050 },
        { ...baselineResult, mean: 1000 }
      ];

      const result = engine.compareWithHistory(currentResult, history);

      expect(result.comparison).toBeDefined();
      expect(result.trend).toBeDefined();
      expect(result.isAnomaly).toBeDefined();
    });

    it('should detect anomaly in current result', () => {
      const history = [
        { ...baselineResult, mean: 1000 },
        { ...baselineResult, mean: 1001 },
        { ...baselineResult, mean: 999 },
        { ...baselineResult, mean: 1000 },
        { ...baselineResult, mean: 1000 }
      ];

      const anomalyResult = { ...currentResult, mean: 1500 };
      const result = engine.compareWithHistory(anomalyResult, history);

      expect(result.isAnomaly).toBe(true);
    });
  });

  describe('generateABTestReport', () => {
    it('should generate A/B test report', () => {
      const control = [
        { ...baselineResult, mean: 1000 },
        { ...baselineResult, mean: 1010 }
      ];

      const treatment = [
        { ...currentResult, mean: 900 },
        { ...currentResult, mean: 910 }
      ];

      const report = engine.generateABTestReport(control, treatment);

      expect(report.comparisons).toBeDefined();
      expect(report.winner).toBeDefined();
      expect(report.confidence).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    it('should declare treatment winner when significantly better', () => {
      const control = [
        { ...baselineResult, mean: 1000, samples: Array.from({ length: 50 }, () => 1000) }
      ];

      const treatment = [
        { ...currentResult, mean: 800, samples: Array.from({ length: 50 }, () => 800) }
      ];

      const report = engine.generateABTestReport(control, treatment);

      expect(report.winner).toBe('treatment');
    });

    it('should declare control winner when treatment is worse', () => {
      const control = [
        { ...baselineResult, mean: 800, samples: Array.from({ length: 50 }, () => 800) }
      ];

      const treatment = [
        { ...currentResult, mean: 1000, samples: Array.from({ length: 50 }, () => 1000) }
      ];

      const report = engine.generateABTestReport(control, treatment);

      expect(report.winner).toBe('control');
    });
  });
});
