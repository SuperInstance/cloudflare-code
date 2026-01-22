#!/usr/bin/env node

/**
 * ClaudeFlare Benchmark CLI
 * Command-line interface for running benchmarks
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import {
  BenchmarkRunner,
  ComparisonEngine,
  LoadTester,
  StressTester,
  PerformanceReporter,
  generateReport
} from '../index.js';
import { formatNanoseconds, formatOpsPerSecond } from '../utils/system.js';
import type { BenchmarkDefinition } from '../types/index.js';

const program = new Command();

program
  .name('claudeflare-benchmark')
  .description('ClaudeFlare Benchmark CLI - Comprehensive benchmarking and profiling')
  .version('1.0.0');

// ============================================================================
// Benchmark Command
// ============================================================================

program
  .command('run')
  .description('Run benchmarks')
  .option('-f, --file <path>', 'Path to benchmark file')
  .option('-o, --output <dir>', 'Output directory for reports', './benchmark-results')
  .option('--format <formats>', 'Report formats (comma-separated)', 'html,json')
  .option('--no-warmup', 'Skip warmup iterations')
  .option('--iterations <n>', 'Number of iterations', '100')
  .option('--time <ms>', 'Minimum time in milliseconds', '1000')
  .action(async (options) => {
    const spinner = ora('Running benchmarks...').start();

    try {
      let benchmarks: BenchmarkDefinition[] = [];

      if (options.file) {
        // Load benchmarks from file
        const benchmarkModule = await import(options.file);
        if (benchmarkModule.default) {
          benchmarks = benchmarkModule.default;
        } else if (benchmarkModule.benchmarks) {
          benchmarks = benchmarkModule.benchmarks;
        }
      } else {
        spinner.warn('No benchmark file specified. Use --file to specify a benchmark file.');
        return;
      }

      const runner = new BenchmarkRunner({
        warmupIterations: options.noWarmup ? 0 : 5,
        iterations: parseInt(options.iterations),
        time: parseInt(options.time)
      });

      runner.addBenchmarks(benchmarks);

      spinner.text = 'Executing benchmarks...';
      const suite = await runner.run();

      spinner.succeed('Benchmarks completed');

      // Display results table
      displayBenchmarkResults(suite);

      // Generate reports
      const formats = options.format.split(',');
      await generateReport(
        { suite },
        {
          name: 'benchmark',
          format: formats as any,
          outputDir: options.output
        }
      );

      console.log(chalk.green(`\nReports generated in ${options.output}`));
    } catch (error) {
      spinner.fail('Benchmark execution failed');
      console.error(chalk.red(error));
      process.exit(1);
    }
  });

// ============================================================================
// Compare Command
// ============================================================================

program
  .command('compare')
  .description('Compare two benchmark runs')
  .option('-b, --baseline <path>', 'Path to baseline results')
  .option('-c, --current <path>', 'Path to current results')
  .option('-o, --output <dir>', 'Output directory for reports', './comparison-results')
  .action(async (options) => {
    const spinner = ora('Comparing benchmarks...').start();

    try {
      const baseline = JSON.parse(await import('fs').then(fs => fs.readFileSync(options.baseline, 'utf-8')));
      const current = JSON.parse(await import('fs').then(fs => fs.readFileSync(options.current, 'utf-8')));

      const engine = new ComparisonEngine();
      const comparisons = engine.compareAll(
        baseline.results || [baseline],
        current.results || [current]
      );

      spinner.succeed('Comparison completed');

      // Display comparison table
      displayComparisonResults(comparisons);
    } catch (error) {
      spinner.fail('Comparison failed');
      console.error(chalk.red(error));
      process.exit(1);
    }
  });

// ============================================================================
// Load Test Command
// ============================================================================

program
  .command('load')
  .description('Run load tests')
  .option('-f, --file <path>', 'Path to load test file')
  .option('-c, --concurrency <n>', 'Maximum concurrency', '100')
  .option('-d, --duration <ms>', 'Duration per level', '5000')
  .option('-o, --output <dir>', 'Output directory for reports', './load-test-results')
  .action(async (options) => {
    const spinner = ora('Running load tests...').start();

    try {
      // Load test implementation would go here
      spinner.info('Load testing feature - implement test configuration in file');
    } catch (error) {
      spinner.fail('Load test failed');
      console.error(chalk.red(error));
      process.exit(1);
    }
  });

// ============================================================================
// Stress Test Command
// ============================================================================

program
  .command('stress')
  .description('Run stress tests')
  .option('-f, --file <path>', 'Path to stress test file')
  .option('--start-load <n>', 'Starting load', '10')
  .option('--max-load <n>', 'Maximum load', '1000')
  .option('--increment <n>', 'Load increment', '10')
  .option('-o, --output <dir>', 'Output directory for reports', './stress-test-results')
  .action(async (options) => {
    const spinner = ora('Running stress tests...').start();

    try {
      // Stress test implementation would go here
      spinner.info('Stress testing feature - implement test configuration in file');
    } catch (error) {
      spinner.fail('Stress test failed');
      console.error(chalk.red(error));
      process.exit(1);
    }
  });

// ============================================================================
// Profile Command
// ============================================================================

program
  .command('profile')
  .description('Profile code execution')
  .option('-f, --file <path>', 'Path to file to profile')
  .option('--type <type>', 'Profile type (cpu|memory)', 'cpu')
  .option('-o, --output <dir>', 'Output directory for profiles', './profiles')
  .action(async (options) => {
    const spinner = ora('Profiling...').start();

    try {
      // Profiling implementation would go here
      spinner.info('Profiling feature - implement target function in file');
    } catch (error) {
      spinner.fail('Profiling failed');
      console.error(chalk.red(error));
      process.exit(1);
    }
  });

// ============================================================================
// Utility Functions
// ============================================================================

function displayBenchmarkResults(suite: any): void {
  const table = new Table({
    head: [
      chalk.cyan('Name'),
      chalk.cyan('Mean'),
      chalk.cyan('Ops/sec'),
      chalk.cyan('Min'),
      chalk.cyan('Max'),
      chalk.cyan('Median'),
      chalk.cyan('RSD')
    ],
    colWidths: [30, 15, 15, 15, 15, 15, 10]
  });

  for (const result of suite.results) {
    table.push([
      result.name,
      formatNanoseconds(result.mean),
      result.ops.toFixed(0),
      formatNanoseconds(result.min),
      formatNanoseconds(result.max),
      formatNanoseconds(result.median),
      result.rsd.toFixed(2) + '%'
    ]);
  }

  console.log('\n' + table.toString());
}

function displayComparisonResults(comparisons: any[]): void {
  const table = new Table({
    head: [
      chalk.cyan('Name'),
      chalk.cyan('Baseline'),
      chalk.cyan('Current'),
      chalk.cyan('Diff'),
      chalk.cyan('Speedup'),
      chalk.cyan('Verdict')
    ],
    colWidths: [25, 15, 15, 12, 12, 15]
  });

  for (const comp of comparisons) {
    const diff = comp.difference.relative.toFixed(2) + '%';
    const speedup = comp.difference.speedup.toFixed(2) + 'x';
    const verdict = comp.verdict;

    const verdictColor = verdict === 'improved' ? chalk.green :
                        verdict === 'regressed' ? chalk.red :
                        chalk.gray;

    table.push([
      comp.name,
      formatNanoseconds(comp.baseline.mean),
      formatNanoseconds(comp.current.mean),
      diff,
      speedup,
      verdictColor(verdict)
    ]);
  }

  console.log('\n' + table.toString());
}

// ============================================================================
// Parse and execute
// ============================================================================

program.parse();
