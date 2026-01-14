/**
 * Comparison Engine
 * A/B testing and performance regression detection
 */

import type {
  BenchmarkResult,
  BenchmarkComparison,
  ComparisonReport,
  ComparisonSummary,
  ComparisonMetadata,
  PerformanceDifference,
  StatisticalSignificance,
  SystemDiff,
  ReportMetadata
} from '../types/index.js';
import { tTest, mannWhitneyUTest, cohensD, mean, standardDeviation } from '../utils/statistics.js';
import { getSystemInfo } from '../utils/system.js';

/**
 * Comparison engine for analyzing benchmark results
 */
export class ComparisonEngine {
  private baselineSystemInfo = getSystemInfo();

  /**
   * Compare two benchmark results
   */
  compare(
    baseline: BenchmarkResult,
    current: BenchmarkResult,
    options?: {
      significanceLevel?: number;
      test?: 't-test' | 'mann-whitney';
    }
  ): BenchmarkComparison {
    const significanceLevel = options?.significanceLevel ?? 0.05;
    const testType = options?.test ?? 'mann-whitney';

    return {
      name: baseline.name,
      baseline,
      current,
      difference: this.calculateDifference(baseline, current),
      significance: this.calculateSignificance(baseline, current, significanceLevel, testType),
      verdict: this.determineVerdict(baseline, current, significanceLevel, testType),
      metadata: {
        baselineTimestamp: baseline.startTime,
        currentTimestamp: current.startTime,
        timeDelta: current.startTime - baseline.startTime
      }
    };
  }

  /**
   * Compare multiple benchmark results
   */
  compareAll(
    baseline: BenchmarkResult[],
    current: BenchmarkResult[],
    options?: {
      significanceLevel?: number;
      test?: 't-test' | 'mann-whitney';
    }
  ): BenchmarkComparison[] {
    const comparisons: BenchmarkComparison[] = [];
    const baselineMap = new Map(baseline.map(b => [b.name, b]));

    for (const currentResult of current) {
      const baselineResult = baselineMap.get(currentResult.name);
      if (baselineResult) {
        comparisons.push(this.compare(baselineResult, currentResult, options));
      }
    }

    return comparisons;
  }

  /**
   * Generate a comparison report
   */
  generateReport(
    comparisons: BenchmarkComparison[],
    name: string = 'comparison-report'
  ): ComparisonReport {
    const summary = this.generateSummary(comparisons);
    const recommendations = this.generateRecommendations(comparisons, summary);

    return {
      name,
      comparisons,
      summary,
      recommendations,
      metadata: {
        generatedAt: Date.now(),
        format: 'json',
        version: '1.0.0',
        generator: '@claudeflare/benchmark'
      }
    };
  }

  /**
   * Calculate performance difference
   */
  private calculateDifference(
    baseline: BenchmarkResult,
    current: BenchmarkResult
  ): PerformanceDifference {
    const absolute = current.mean - baseline.mean;
    const relative = (absolute / baseline.mean) * 100;
    const speedup = baseline.mean / current.mean;
    const opsDiff = current.ops - baseline.ops;

    return {
      absolute,
      relative,
      speedup,
      opsDiff
    };
  }

  /**
   * Calculate statistical significance
   */
  private calculateSignificance(
    baseline: BenchmarkResult,
    current: BenchmarkResult,
    significanceLevel: number,
    testType: 't-test' | 'mann-whitney'
  ): StatisticalSignificance {
    let result;

    if (testType === 'mann-whitney' && baseline.samples.length >= 20 && current.samples.length >= 20) {
      result = mannWhitneyUTest(baseline.samples, current.samples);
    } else {
      result = tTest(baseline.samples, current.samples);
    }

    return {
      significant: result.pValue < significanceLevel,
      pValue: result.pValue,
      test: testType,
      effectSize: cohensD(baseline.samples, current.samples),
      confidenceLevel: 1 - significanceLevel
    };
  }

  /**
   * Determine verdict based on comparison
   */
  private determineVerdict(
    baseline: BenchmarkResult,
    current: BenchmarkResult,
    significanceLevel: number,
    testType: 't-test' | 'mann-whitney'
  ): 'improved' | 'regressed' | 'no-change' | 'inconclusive' {
    const significance = this.calculateSignificance(baseline, current, significanceLevel, testType);
    const improvement = (baseline.mean - current.mean) / baseline.mean;

    // Not statistically significant
    if (!significance.significant) {
      return 'inconclusive';
    }

    // Significant improvement (> 5% faster)
    if (improvement > 0.05) {
      return 'improved';
    }

    // Significant regression (> 5% slower)
    if (improvement < -0.05) {
      return 'regressed';
    }

    // Statistically significant but within 5% threshold
    return 'no-change';
  }

  /**
   * Generate summary of comparisons
   */
  private generateSummary(comparisons: BenchmarkComparison[]): ComparisonSummary {
    const summary: ComparisonSummary = {
      total: comparisons.length,
      improvements: 0,
      regressions: 0,
      noChange: 0,
      inconclusive: 0,
      overallVerdict: 'no-change'
    };

    for (const comparison of comparisons) {
      switch (comparison.verdict) {
        case 'improved':
          summary.improvements++;
          break;
        case 'regressed':
          summary.regressions++;
          break;
        case 'no-change':
          summary.noChange++;
          break;
        case 'inconclusive':
          summary.inconclusive++;
          break;
      }
    }

    // Determine overall verdict
    if (summary.regressions > 0) {
      summary.overallVerdict = 'regressed';
    } else if (summary.improvements > 0) {
      summary.overallVerdict = 'improved';
    }

    if (summary.improvements > 0 && summary.regressions > 0) {
      summary.overallVerdict = 'mixed';
    }

    return summary;
  }

  /**
   * Generate recommendations based on comparison results
   */
  private generateRecommendations(
    comparisons: BenchmarkComparison[],
    summary: ComparisonSummary
  ): string[] {
    const recommendations: string[] = [];

    // Overall recommendations
    if (summary.regressions > 0) {
      recommendations.push(
        `Performance regression detected in ${summary.regressions} benchmark(s). ` +
        'Review and investigate the changes that caused these regressions.'
      );
    }

    if (summary.improvements > summary.regressions && summary.improvements > 0) {
      recommendations.push(
        `Overall performance improved in ${summary.improvements} benchmark(s). ` +
        'Consider these changes as best practices.'
      );
    }

    if (summary.inconclusive > comparisons.length / 2) {
      recommendations.push(
        'More than half of the comparisons are inconclusive. ' +
        'Consider increasing the number of iterations or running tests for longer duration.'
      );
    }

    // Specific recommendations for regressions
    const regressions = comparisons.filter(c => c.verdict === 'regressed');
    for (const regression of regressions) {
      const percentChange = Math.abs(regression.difference.relative).toFixed(2);
      recommendations.push(
        `"${regression.name}" is ${percentChange}% slower. ` +
        'Profile this benchmark to identify bottlenecks.'
      );
    }

    // Recommendations for improvements
    const improvements = comparisons.filter(c => c.verdict === 'improved');
    if (improvements.length > 0) {
      const bestImprovement = improvements.reduce((best, current) =>
        current.difference.relative < best.difference.relative ? current : best
      );
      const percentImprovement = Math.abs(bestImprovement.difference.relative).toFixed(2);
      recommendations.push(
        `"${bestImprovement.name}" shows the best improvement at ${percentImprovement}% faster.`
      );
    }

    return recommendations;
  }

  /**
   * Detect performance regression
   */
  detectRegression(
    baseline: BenchmarkResult,
    current: BenchmarkResult,
    threshold: number = 0.05
  ): {
    isRegression: boolean;
    percentChange: number;
    significance: number;
  } {
    const percentChange = ((current.mean - baseline.mean) / baseline.mean) * 100;
    const comparison = this.compare(baseline, current);

    return {
      isRegression: percentChange > threshold && comparison.significance.significant,
      percentChange,
      significance: comparison.significance.pValue
    };
  }

  /**
   * Calculate trend across multiple results
   */
  calculateTrend(results: BenchmarkResult[]): {
    trend: 'improving' | 'degrading' | 'stable';
    slope: number;
    r2: number;
  } {
    if (results.length < 2) {
      return { trend: 'stable', slope: 0, r2: 1 };
    }

    // Linear regression
    const n = results.length;
    const xValues = results.map((_, i) => i);
    const yValues = results.map(r => r.mean);

    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R²
    const yMean = mean(yValues);
    const ssTotal = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const ssResidual = yValues.reduce((sum, y, i) => {
      const predicted = slope * i + intercept;
      return sum + Math.pow(y - predicted, 2);
    }, 0);
    const r2 = 1 - ssResidual / ssTotal;

    // Determine trend
    let trend: 'improving' | 'degrading' | 'stable' = 'stable';
    if (Math.abs(slope) > results[0].mean * 0.01) {
      trend = slope < 0 ? 'improving' : 'degrading';
    }

    return { trend, slope, r2 };
  }

  /**
   * Compare with historical baseline
   */
  compareWithHistory(
    current: BenchmarkResult,
    history: BenchmarkResult[],
    options?: {
      windowSize?: number;
      significanceLevel?: number;
    }
  ): {
    comparison: BenchmarkComparison;
    trend: ReturnType<typeof this.calculateTrend>;
    isAnomaly: boolean;
  } {
    const windowSize = options?.windowSize ?? Math.min(10, history.length);
    const recentHistory = history.slice(-windowSize);

    // Calculate average of recent history
    const avgMean = mean(recentHistory.map(h => h.mean));
    const avgSamples = recentHistory.flatMap(h => h.samples);

    // Create synthetic baseline
    const baseline: BenchmarkResult = {
      ...current,
      mean: avgMean,
      samples: avgSamples.length > 0 ? avgSamples : current.samples
    };

    const comparison = this.compare(baseline, current, {
      significanceLevel: options?.significanceLevel
    });

    const trend = this.calculateTrend([...history, current]);

    // Detect anomaly (current is more than 2 standard deviations from trend)
    const recentMeans = recentHistory.map(h => h.mean);
    const trendMean = mean(recentMeans);
    const trendStd = standardDeviation(recentMeans);
    const isAnomaly = Math.abs(current.mean - trendMean) > 2 * trendStd;

    return {
      comparison,
      trend,
      isAnomaly
    };
  }

  /**
   * Generate A/B test report
   */
  generateABTestReport(
    control: BenchmarkResult[],
    treatment: BenchmarkResult[],
    options?: {
      significanceLevel?: number;
      minimumDetectableEffect?: number;
    }
  ): {
    comparisons: BenchmarkComparison[];
    winner: 'control' | 'treatment' | 'inconclusive';
    confidence: number;
    recommendations: string[];
  } {
    const comparisons = this.compareAll(control, treatment, options);

    let winner: 'control' | 'treatment' | 'inconclusive' = 'inconclusive';
    let confidence = 0;

    const significantComparisons = comparisons.filter(c => c.significance.significant);

    if (significantComparisons.length > 0) {
      const treatmentWins = significantComparisons.filter(
        c => c.verdict === 'improved' && c.difference.speedup > 1
      ).length;
      const controlWins = significantComparisons.filter(
        c => c.verdict === 'regressed' || (c.verdict === 'improved' && c.difference.speedup < 1)
      ).length;

      if (treatmentWins > controlWins) {
        winner = 'treatment';
        confidence = treatmentWins / significantComparisons.length;
      } else if (controlWins > treatmentWins) {
        winner = 'control';
        confidence = controlWins / significantComparisons.length;
      }
    }

    const recommendations: string[] = [];

    if (winner === 'treatment') {
      recommendations.push(
        `Treatment is the winner with ${(confidence * 100).toFixed(1)}% confidence. ` +
        'Deploy the treatment variant.'
      );
    } else if (winner === 'control') {
      recommendations.push(
        `Control is the winner with ${(confidence * 100).toFixed(1)}% confidence. ` +
        'Keep the current implementation.'
      );
    } else {
      recommendations.push(
        'Inconclusive result. Consider running the test longer or with more samples.'
      );
    }

    return {
      comparisons,
      winner,
      confidence,
      recommendations
    };
  }
}

/**
 * Convenience function to compare two results
 */
export function compare(
  baseline: BenchmarkResult,
  current: BenchmarkResult,
  options?: {
    significanceLevel?: number;
    test?: 't-test' | 'mann-whitney';
  }
): BenchmarkComparison {
  const engine = new ComparisonEngine();
  return engine.compare(baseline, current, options);
}

/**
 * Convenience function to detect regression
 */
export function detectRegression(
  baseline: BenchmarkResult,
  current: BenchmarkResult,
  threshold?: number
): ReturnType<ComparisonEngine['detectRegression']> {
  const engine = new ComparisonEngine();
  return engine.detectRegression(baseline, current, threshold);
}
