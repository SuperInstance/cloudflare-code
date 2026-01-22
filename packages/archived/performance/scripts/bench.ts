#!/usr/bin/env tsx
/**
 * Benchmark Runner CLI
 *
 * Run and analyze performance benchmarks
 */

import { program } from 'commander';
import { BenchmarkRunner, BenchmarkSuites, ReportGenerator } from '../src/index.js';
import { MetricsFormatter } from '../src/utils/formatter.js';
import fs from 'fs/promises';
import path from 'path';

const reportGenerator = new ReportGenerator();

program
  .name('claudeflare-bench')
  .description('ClaudeFlare Benchmark Runner')
  .version('1.0.0');

program
  .command('run')
  .description('Run benchmark suites')
  .option('-s, --suite <name>', 'Suite name to run')
  .option('-p, --pattern <pattern>', 'Filter benchmarks by pattern')
  .option('-i, --iterations <number>', 'Number of iterations', '1000')
  .option('-t, --time <seconds>', 'Time to run each benchmark', '5')
  .option('-o, --output <path>', 'Output directory for results', './results')
  .option('--format <type>', 'Output format (json, markdown, html)', 'json')
  .option('--ci', 'CI mode (no colors, machine-readable)', false)
  .action(async (options) => {
    const runner = new BenchmarkRunner();

    // Register predefined suites
    const allSuites = BenchmarkSuites.getAll();
    runner.registerSuites(allSuites);

    console.log(MetricsFormatter.colorize('🚀 Starting Benchmarks', 'blue'));
    console.log(`Suites: ${allSuites.length}`);
    console.log(`Iterations: ${options.iterations}`);
    console.log(`Time: ${options.time}s\n`);

    let results;
    if (options.suite) {
      results = new Map();
      const suiteResults = await runner.runSuite(options.suite);
      results.set(options.suite, suiteResults);
    } else {
      results = await runner.runAll();
    }

    // Generate report
    const allResults = Array.from(results.values()).flat();
    const report = reportGenerator.generateReport({
      benchmarks: allResults,
      metadata: {
        iterations: parseInt(options.iterations),
        time: parseInt(options.time),
      },
    });

    // Ensure output directory exists
    await fs.mkdir(options.output, { recursive: true });

    // Save results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `bench-${timestamp}.${options.format}`;
    const filepath = path.join(options.output, filename);

    let output;
    switch (options.format) {
      case 'json':
        output = reportGenerator.exportJSON(report);
        break;
      case 'markdown':
        output = reportGenerator.exportMarkdown(report);
        break;
      case 'html':
        output = reportGenerator.exportHTML(report);
        break;
      default:
        output = reportGenerator.exportJSON(report);
    }

    await fs.writeFile(filepath, output);
    console.log(`\n✅ Results saved to ${filepath}`);

    // Print summary
    console.log('\n' + MetricsFormatter.colorize('📊 Summary', 'blue'));
    console.log(`Total Benchmarks: ${report.summary.totalTests}`);
    console.log(`Passed: ${MetricsFormatter.colorize(String(report.summary.passed), 'green')}`);
    console.log(`Failed: ${MetricsFormatter.colorize(String(report.summary.failed), 'red')}`);
    console.log(`Overall Score: ${MetricsFormatter.colorize(`${report.summary.overallScore}/100`, report.summary.overallScore >= 80 ? 'green' : 'yellow')}`);

    // Exit with error code if any failures
    if (report.summary.failed > 0) {
      process.exit(1);
    }
  });

program
  .command('compare')
  .description('Compare two benchmark runs')
  .argument('<baseline>', 'Baseline results file')
  .argument('<current>', 'Current results file')
  .option('-o, --output <path>', 'Output directory', './results')
  .action(async (baseline, current, options) => {
    console.log('Comparing benchmark runs...');

    const baselineData = JSON.parse(await fs.readFile(baseline, 'utf-8'));
    const currentData = JSON.parse(await fs.readFile(current, 'utf-8'));

    const runner = new BenchmarkRunner();
    const baselineBenchmarks = baselineData.details?.benchmarks || baselineData.benchmarks || [];
    const currentBenchmarks = currentData.details?.benchmarks || currentData.benchmarks || [];

    const comparison = runner.compare('comparison', baselineBenchmarks, currentBenchmarks);

    console.log(`\n📊 Comparison Results`);
    console.log(`Total: ${comparison.summary.total}`);
    console.log(`Significant: ${comparison.summary.significant}`);
    console.log(`Improvements: ${MetricsFormatter.colorize(String(comparison.summary.improvements), 'green')}`);
    console.log(`Regressions: ${MetricsFormatter.colorize(String(comparison.summary.regressions), 'red')}`);

    for (const comp of comparison.comparisons) {
      const emoji = comp.isFaster ? '✅' : '⚠️';
      const color = comp.isFaster ? 'green' : 'yellow';
      const text = `${emoji} ${comp.name}: ${MetricsFormatter.formatComparison(comp.baseline, comp.current, 'ms')}`;
      console.log(MetricsFormatter.colorize(text, color));
    }

    // Save comparison
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filepath = path.join(options.output, `comparison-${timestamp}.json`);
    await fs.mkdir(options.output, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(comparison, null, 2));

    console.log(`\n✅ Comparison saved to ${filepath}`);

    if (comparison.summary.regressions > 0) {
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List available benchmark suites')
  .action(() => {
    const suites = BenchmarkSuites.getAll();

    console.log('\n📋 Available Benchmark Suites\n');

    for (const suite of suites) {
      console.log(MetricsFormatter.colorize(suite.name, 'blue'));
      console.log(`  ${suite.description}`);
      console.log(`  Benchmarks: ${suite.benchmarks.length}\n`);

      for (const bench of suite.benchmarks) {
        console.log(`    • ${bench.name}`);
        if (bench.description) {
          console.log(`      ${bench.description}`);
        }
      }
      console.log('');
    }
  });

program.parse();
