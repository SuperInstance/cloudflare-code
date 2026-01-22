/**
 * Comparison Example
 * Demonstrates how to compare benchmark results and detect regressions
 */

import { BenchmarkRunner, ComparisonEngine, compare, detectRegression } from '@claudeflare/benchmark';
import type { BenchmarkResult } from '@claudeflare/benchmark';

// Example 1: Simple comparison
async function simpleComparison() {
  console.log('=== Simple Comparison Example ===\n');

  // Create baseline result (simulated)
  const baseline: BenchmarkResult = {
    name: 'array-filter',
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

  // Create current result (10% faster - improvement)
  const currentImproved: BenchmarkResult = {
    ...baseline,
    samples: Array.from({ length: 100 }, () => 900 + Math.random() * 90),
    mean: 900,
    ops: 1111111,
    startTime: 2000,
    endTime: 3000
  };

  // Create current result (10% slower - regression)
  const currentRegressed: BenchmarkResult = {
    ...baseline,
    samples: Array.from({ length: 100 }, () => 1100 + Math.random() * 110),
    mean: 1100,
    ops: 909090,
    startTime: 2000,
    endTime: 3000
  };

  // Compare improved version
  console.log('Comparing improved version:');
  const improvedComparison = compare(baseline, currentImproved);
  console.log(`  Verdict: ${improvedComparison.verdict}`);
  console.log(`  Difference: ${improvedComparison.difference.relative.toFixed(2)}%`);
  console.log(`  Speedup: ${improvedComparison.difference.speedup.toFixed(2)}x`);
  console.log(`  Significant: ${improvedComparison.significance.significant}`);

  // Compare regressed version
  console.log('\nComparing regressed version:');
  const regressedComparison = compare(baseline, currentRegressed);
  console.log(`  Verdict: ${regressedComparison.verdict}`);
  console.log(`  Difference: ${regressedComparison.difference.relative.toFixed(2)}%`);
  console.log(`  Significant: ${regressedComparison.significance.significant}`);
}

// Example 2: Regression detection
async function regressionDetection() {
  console.log('\n\n=== Regression Detection Example ===\n');

  const baseline: BenchmarkResult = {
    name: 'test-benchmark',
    samples: Array.from({ length: 100 }, () => 1000 + Math.random() * 50),
    mean: 1000,
    standardDeviation: 25,
    rsd: 2.5,
    min: 950,
    max: 1050,
    median: 1000,
    mode: 1000,
    percentiles: { 50: 1000, 95: 1045 },
    ops: 1000000,
    confidence: { lower: 975, upper: 1025, level: 0.95 },
    significant: true,
    samples: [],
    total: 0,
    startTime: 1000,
    endTime: 2000
  };

  // Test with 15% regression
  const regressed: BenchmarkResult = {
    ...baseline,
    samples: Array.from({ length: 100 }, () => 1150 + Math.random() * 57),
    mean: 1150,
    startTime: 2000,
    endTime: 3000
  };

  const result = detectRegression(baseline, regressed, 0.05);

  console.log('Regression Detection Result:');
  console.log(`  Is Regression: ${result.isRegression}`);
  console.log(`  Percent Change: ${result.percentChange.toFixed(2)}%`);
  console.log(`  P-value: ${result.significance.toFixed(4)}`);

  if (result.isRegression) {
    console.log('\n  ⚠️  Performance regression detected!');
  } else {
    console.log('\n  ✓ No significant regression detected');
  }
}

// Example 3: Multiple benchmark comparison
async function multipleComparison() {
  console.log('\n\n=== Multiple Benchmark Comparison ===\n');

  const engine = new ComparisonEngine();

  // Create baseline results
  const baseline = [
    {
      name: 'bench1',
      samples: Array.from({ length: 100 }, () => 1000 + Math.random() * 50),
      mean: 1000,
      standardDeviation: 25,
      rsd: 2.5,
      min: 950,
      max: 1050,
      median: 1000,
      mode: 1000,
      percentiles: { 50: 1000, 95: 1045 },
      ops: 1000000,
      confidence: { lower: 975, upper: 1025, level: 0.95 },
      significant: true,
      samples: [],
      total: 0,
      startTime: 1000,
      endTime: 2000
    },
    {
      name: 'bench2',
      samples: Array.from({ length: 100 }, () => 2000 + Math.random() * 100),
      mean: 2000,
      standardDeviation: 50,
      rsd: 2.5,
      min: 1900,
      max: 2100,
      median: 2000,
      mode: 2000,
      percentiles: { 50: 2000, 95: 2090 },
      ops: 500000,
      confidence: { lower: 1950, upper: 2050, level: 0.95 },
      significant: true,
      samples: [],
      total: 0,
      startTime: 1000,
      endTime: 2000
    }
  ];

  // Create current results (mixed improvements and regressions)
  const current = [
    {
      ...baseline[0],
      samples: Array.from({ length: 100 }, () => 900 + Math.random() * 45),
      mean: 900,
      ops: 1111111,
      startTime: 2000,
      endTime: 3000
    },
    {
      ...baseline[1],
      samples: Array.from({ length: 100 }, () => 2200 + Math.random() * 110),
      mean: 2200,
      ops: 454545,
      startTime: 2000,
      endTime: 3000
    }
  ];

  // Generate comparison report
  const comparisons = engine.compareAll(baseline, current);
  const report = engine.generateReport(comparisons, 'comparison-example');

  console.log('Comparison Summary:');
  console.log(`  Total: ${report.summary.total}`);
  console.log(`  Improvements: ${report.summary.improvements}`);
  console.log(`  Regressions: ${report.summary.regressions}`);
  console.log(`  No Change: ${report.summary.noChange}`);
  console.log(`  Overall: ${report.summary.overallVerdict}`);

  console.log('\nRecommendations:');
  for (const recommendation of report.recommendations) {
    console.log(`  - ${recommendation}`);
  }
}

// Example 4: Trend analysis
async function trendAnalysis() {
  console.log('\n\n=== Trend Analysis Example ===\n');

  const engine = new ComparisonEngine();

  // Simulate historical data showing improvement
  const history = [
    { mean: 1100, samples: [], total: 0, standardDeviation: 50, rsd: 4.5, min: 1050, max: 1150, median: 1100, mode: 1100, percentiles: {}, ops: 909090, confidence: { lower: 0, upper: 0, level: 0.95 }, significant: true, name: 'bench', startTime: 1000, endTime: 2000 },
    { mean: 1050, samples: [], total: 0, standardDeviation: 48, rsd: 4.6, min: 1002, max: 1098, median: 1050, mode: 1050, percentiles: {}, ops: 952380, confidence: { lower: 0, upper: 0, level: 0.95 }, significant: true, name: 'bench', startTime: 2000, endTime: 3000 },
    { mean: 1020, samples: [], total: 0, standardDeviation: 45, rsd: 4.4, min: 975, max: 1065, median: 1020, mode: 1020, percentiles: {}, ops: 980392, confidence: { lower: 0, upper: 0, level: 0.95 }, significant: true, name: 'bench', startTime: 3000, endTime: 4000 },
    { mean: 1000, samples: [], total: 0, standardDeviation: 44, rsd: 4.4, min: 956, max: 1044, median: 1000, mode: 1000, percentiles: {}, ops: 1000000, confidence: { lower: 0, upper: 0, level: 0.95 }, significant: true, name: 'bench', startTime: 4000, endTime: 5000 },
    { mean: 980, samples: [], total: 0, standardDeviation: 43, rsd: 4.4, min: 937, max: 1023, median: 980, mode: 980, percentiles: {}, ops: 1020408, confidence: { lower: 0, upper: 0, level: 0.95 }, significant: true, name: 'bench', startTime: 5000, endTime: 6000 }
  ];

  const trend = engine.calculateTrend(history);

  console.log('Trend Analysis:');
  console.log(`  Trend: ${trend.trend}`);
  console.log(`  Slope: ${trend.slope.toFixed(2)}`);
  console.log(`  R²: ${trend.r2.toFixed(4)}`);

  if (trend.trend === 'improving') {
    console.log('\n  ✓ Performance is improving over time');
  } else if (trend.trend === 'degrading') {
    console.log('\n  ⚠️  Performance is degrading over time');
  } else {
    console.log('\n  → Performance is stable');
  }
}

// Run examples
async function main() {
  await simpleComparison();
  await regressionDetection();
  await multipleComparison();
  await trendAnalysis();
}

main().catch(console.error);
