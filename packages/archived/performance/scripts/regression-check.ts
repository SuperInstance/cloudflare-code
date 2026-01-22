#!/usr/bin/env tsx
/**
 * Regression Detection CLI
 *
 * Detect and report performance regressions
 */

import { program } from 'commander';
import { BaselineManager, RegressionDetector, ReportGenerator } from '../src/index.js';
import { MetricsFormatter } from '../src/utils/formatter.js';
import fs from 'fs/promises';

const reportGenerator = new ReportGenerator();

program
  .name('claudeflare-regression')
  .description('ClaudeFlare Regression Detection')
  .version('1.0.0');

program
  .command('create-baseline')
  .description('Create a performance baseline')
  .requiredOption('-n, --name <name>', 'Baseline name')
  .requiredOption('-b, --benchmarks <path>', 'Benchmark results file')
  .option('-l, --loadtests <path>', 'Load test results file')
  .option('-o, --output <path>', 'Output directory', './baselines')
  .action(async (options) => {
    console.log('📊 Creating performance baseline...\n');

    const manager = new BaselineManager({ storagePath: options.output });

    // Load benchmark results
    const benchmarkData = JSON.parse(await fs.readFile(options.benchmarks, 'utf-8'));
    const benchmarks = benchmarkData.details?.benchmarks || benchmarkData.benchmarks || [];

    // Load load test results if provided
    let loadTests = [];
    if (options.loadtests) {
      const loadData = JSON.parse(await fs.readFile(options.loadtests, 'utf-8'));
      loadTests = loadData.details?.loadTests || loadData.loadTests || [];
    }

    const baseline = await manager.createBaseline(
      options.name,
      benchmarks,
      loadTests,
      {
        commit: process.env.GIT_SHA || process.env.CI_COMMIT_SHA,
        branch: process.env.GIT_BRANCH || process.env.CI_BRANCH,
      }
    );

    console.log(`✅ Baseline created: ${baseline.name}`);
    console.log(`   Timestamp: ${new Date(baseline.timestamp).toISOString()}`);
    console.log(`   Benchmarks: ${benchmarks.length}`);
    console.log(`   Load Tests: ${loadTests.length}`);
    console.log(`   Metrics: ${Object.keys(baseline.metrics).length}`);
  });

program
  .command('check')
  .description('Check for regressions against baseline')
  .requiredOption('-n, --name <name>', 'Baseline name')
  .requiredOption('-b, --benchmarks <path>', 'Current benchmark results')
  .option('-l, --loadtests <path>', 'Current load test results')
  .option('-o, --output <path>', 'Baseline storage path', './baselines')
  .option('-t, --threshold <level>', 'Regression threshold (critical, high, medium, low)', 'low')
  .option('--fail-on-regression', 'Exit with error if regression detected', true)
  .action(async (options) => {
    console.log('🔍 Checking for regressions...\n');

    const manager = new BaselineManager({ storagePath: options.output });
    const detector = new RegressionDetector();

    // Load baseline
    await manager.loadBaselines(options.name);
    const baseline = manager.getBaseline(options.name);

    if (!baseline) {
      console.error(`❌ Baseline not found: ${options.name}`);
      console.log('Available baselines:');
      const baselines = await manager.listBaselines();
      for (const b of baselines) {
        console.log(`  - ${b}`);
      }
      process.exit(1);
    }

    console.log(`Baseline: ${options.name}`);
    console.log(`Timestamp: ${new Date(baseline.timestamp).toISOString()}\n`);

    // Load current results
    const benchmarkData = JSON.parse(await fs.readFile(options.benchmarks, 'utf-8'));
    const currentBenchmarks = benchmarkData.details?.benchmarks || benchmarkData.benchmarks || [];

    let currentLoadTests = [];
    if (options.loadtests) {
      const loadData = JSON.parse(await fs.readFile(options.loadtests, 'utf-8'));
      currentLoadTests = loadData.details?.loadTests || loadData.loadTests || [];
    }

    const currentBaseline = await manager.createBaseline(
      `${options.name}-current`,
      currentBenchmarks,
      currentLoadTests
    );

    // Detect regressions
    const result = detector.detectRegressions(baseline, currentBaseline);

    // Generate report
    const report = detector.generateReport(result);
    console.log(report);

    if (result.detected) {
      console.log(MetricsFormatter.colorize(`\n⚠️ Regressions detected: ${result.regressions.length}`, 'yellow'));
      console.log(`Severity: ${result.severity.toUpperCase()}`);

      if (options.failOnRegression) {
        process.exit(1);
      }
    } else {
      console.log(MetricsFormatter.colorize('\n✅ No regressions detected!', 'green'));
    }
  });

program
  .command('trend')
  .description('Show performance trend for a metric')
  .requiredOption('-n, --name <name>', 'Baseline name')
  .requiredOption('-m, --metric <name>', 'Metric name')
  .option('-o, --output <path>', 'Baseline storage path', './baselines')
  .action(async (options) => {
    const manager = new BaselineManager({ storagePath: options.output });

    await manager.loadBaselines(options.name);
    const trend = manager.getTrend(options.name, options.metric);

    if (!trend) {
      console.error(`❌ No trend data found for metric: ${options.metric}`);
      process.exit(1);
    }

    console.log(`📈 Performance Trend: ${trend.metric}\n`);
    console.log(`Direction: ${trend.direction}`);
    console.log(`Change: ${trend.change > 0 ? '+' : ''}${trend.change.toFixed(2)}%`);
    console.log(`Data points: ${trend.points.length}\n`);

    console.log('History:');
    for (const point of trend.points) {
      const value = typeof point.value === 'number' ? point.value.toFixed(2) : point.value;
      console.log(`  ${new Date(point.timestamp).toISOString()}: ${value}`);
    }
  });

program
  .command('list')
  .description('List available baselines')
  .option('-o, --output <path>', 'Baseline storage path', './baselines')
  .action(async (options) => {
    const manager = new BaselineManager({ storagePath: options.output });

    const baselines = await manager.listBaselines();

    console.log('\n📋 Available Baselines\n');

    if (baselines.length === 0) {
      console.log('No baselines found.');
      return;
    }

    for (const name of baselines) {
      await manager.loadBaselines(name);
      const baseline = manager.getBaseline(name);

      if (baseline) {
        console.log(MetricsFormatter.colorize(name, 'blue'));
        console.log(`  Created: ${new Date(baseline.timestamp).toISOString()}`);
        console.log(`  Benchmarks: ${baseline.benchmarks.length}`);
        console.log(`  Load Tests: ${baseline.loadTests.length}`);
        if (baseline.commit) {
          console.log(`  Commit: ${baseline.commit}`);
        }
        console.log('');
      }
    }
  });

program
  .command('compare')
  .description('Compare two baselines')
  .requiredOption('-n, --name <name>', 'Baseline name')
  .requiredOption('-b, --baseline <timestamp>', 'Baseline timestamp')
  .requiredOption('-c, --current <timestamp>', 'Current timestamp')
  .option('-o, --output <path>', 'Baseline storage path', './baselines')
  .action(async (options) => {
    const manager = new BaselineManager({ storagePath: options.output });

    await manager.loadBaselines(options.name);
    const comparison = manager.compareBaselines(
      options.name,
      parseInt(options.baseline),
      parseInt(options.current)
    );

    if (!comparison) {
      console.error('❌ Could not compare baselines');
      process.exit(1);
    }

    console.log(`\n📊 Baseline Comparison: ${options.name}\n`);
    console.log(`Baseline: ${new Date(comparison.baseline.timestamp).toISOString()}`);
    console.log(`Current: ${new Date(comparison.current.timestamp).toISOString()}\n`);

    console.log(`Total comparisons: ${comparison.summary.total}`);
    console.log(`Improvements: ${MetricsFormatter.colorize(String(comparison.summary.improvements), 'green')}`);
    console.log(`Regressions: ${MetricsFormatter.colorize(String(comparison.summary.regressions), 'red')}\n`);

    console.log('Significant changes:');
    for (const comp of comparison.comparisons) {
      if (Math.abs(comp.change) > 5) {
        const emoji = comp.direction === 'improvement' ? '✅' : '⚠️';
        const text = `${emoji} ${comp.metric}: ${comp.baseline.toFixed(2)} → ${comp.current.toFixed(2)} (${comp.change > 0 ? '+' : ''}${comp.change.toFixed(1)}%)`;
        console.log(text);
      }
    }
  });

program.parse();
