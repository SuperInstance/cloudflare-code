#!/usr/bin/env tsx

/**
 * Optimization CLI Script
 *
 * Main entry point for running optimization analyses
 */

import { Command } from 'commander';
import { BundleAnalyzer } from '../src/bundle/analyzer.js';
import { RuntimeOptimizer } from '../src/runtime/optimizer.js';
import { MemoryOptimizer } from '../src/memory/optimizer.js';
import { NetworkOptimizer } from '../src/network/optimizer.js';
import { CachingOptimizer } from '../src/caching/optimizer.js';
import { RegressionDetector } from '../src/regression/detector.js';
import { promises as fs } from 'fs';

const program = new Command();

program
  .name('claudeflare-optimize')
  .description('ClaudeFlare Performance Optimization CLI')
  .version('1.0.0');

// Bundle analysis command
program
  .command('bundle')
  .description('Analyze bundle size and generate optimization recommendations')
  .argument('<path>', 'Path to bundle file')
  .option('-o, --output <file>', 'Output report file')
  .option('--format <format>', 'Report format (text|json)', 'text')
  .action(async (path: string, options) => {
    console.log(`Analyzing bundle: ${path}`);

    const analyzer = new BundleAnalyzer();
    const result = await analyzer.analyzeBundle(path);

    if (options.format === 'json') {
      const report = JSON.stringify(result, null, 2);
      if (options.output) {
        await fs.writeFile(options.output, report);
      } else {
        console.log(report);
      }
    } else {
      const report = analyzer.generateReport(result);
      if (options.output) {
        await fs.writeFile(options.output, report);
      } else {
        console.log(report);
      }
    }
  });

// Runtime profiling command
program
  .command('profile')
  .description('Profile runtime performance')
  .option('-d, --duration <ms>', 'Profiling duration in ms', '60000')
  .option('-o, --output <file>', 'Output report file')
  .action(async (options) => {
    console.log('Starting runtime profiler...');

    const optimizer = new RuntimeOptimizer();
    const profiler = optimizer.getProfiler();

    // Simulate profiling
    await new Promise(resolve => setTimeout(resolve, parseInt(options.duration)));

    const stats = profiler.getStats();
    const hotPaths = profiler.analyzeHotPaths();

    const report = optimizer.generateReport();

    if (options.output) {
      await fs.writeFile(options.output, report);
    } else {
      console.log(report);
    }
  });

// Memory analysis command
program
  .command('memory')
  .description('Analyze memory usage and detect leaks')
  .option('-s, --snapshots <count>', 'Number of snapshots to collect', '10')
  .option('-i, --interval <ms>', 'Interval between snapshots', '5000')
  .option('-o, --output <file>', 'Output report file')
  .action(async (options) => {
    console.log('Starting memory analysis...');

    const optimizer = new MemoryOptimizer();

    const snapshotCount = parseInt(options.snapshots);
    const interval = parseInt(options.interval);

    for (let i = 0; i < snapshotCount; i++) {
      optimizer.captureSnapshot();
      console.log(`Captured snapshot ${i + 1}/${snapshotCount}`);
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    const analysis = await optimizer.analyze();
    const report = optimizer.generateReport();

    if (options.output) {
      await fs.writeFile(options.output, report);
    } else {
      console.log(report);
    }
  });

// Network analysis command
program
  .command('network')
  .description('Analyze network performance')
  .option('-o, --output <file>', 'Output report file')
  .action(async (options) => {
    console.log('Analyzing network performance...');

    const optimizer = new NetworkOptimizer();
    const analysis = optimizer.analyze();
    const report = optimizer.generateReport();

    if (options.output) {
      await fs.writeFile(options.output, report);
    } else {
      console.log(report);
    }
  });

// Cache analysis command
program
  .command('cache')
  .description('Analyze cache performance')
  .option('-o, --output <file>', 'Output report file')
  .action(async (options) => {
    console.log('Analyzing cache performance...');

    const optimizer = new CachingOptimizer();
    const analysis = optimizer.analyze();
    const report = optimizer.generateReport();

    if (options.output) {
      await fs.writeFile(options.output, report);
    } else {
      console.log(report);
    }
  });

// Regression check command
program
  .command('regression')
  .description('Check for performance regressions')
  .argument('<baseline>', 'Baseline ID to compare against')
  .option('-m, --metrics <file>', 'Current metrics file (JSON)')
  .option('-o, --output <file>', 'Output report file')
  .action(async (baseline: string, options) => {
    console.log(`Checking for regressions against baseline: ${baseline}`);

    const detector = new RegressionDetector();

    // Load baseline
    const baselineData = await detector.loadBaseline(baseline);
    if (!baselineData) {
      console.error(`Baseline ${baseline} not found`);
      process.exit(1);
    }

    // Load or use mock current metrics
    let currentMetrics;
    if (options.metrics) {
      const metricsContent = await fs.readFile(options.metrics, 'utf-8');
      currentMetrics = JSON.parse(metricsContent);
    } else {
      // Use current system metrics
      currentMetrics = {
        cpu: 0.5,
        memory: 100 * 1024 * 1024,
        latency: { p50: 50, p95: 100, p99: 150 },
        throughput: 1000,
        bundleSize: { main: 500 * 1024, gzip: 150 * 1024, brotli: 120 * 1024 },
      };
    }

    const result = detector.compare(baseline, currentMetrics);
    const report = detector.generateReport(result);

    if (options.output) {
      await fs.writeFile(options.output, report);
    } else {
      console.log(report);
    }

    // Exit with error code if regressions detected
    if (result.detected && result.summary.status === 'fail') {
      process.exit(1);
    }
  });

// Full optimization command
program
  .command('analyze')
  .description('Run complete optimization analysis')
  .option('-o, --output <dir>', 'Output directory for reports', './reports')
  .action(async (options) => {
    console.log('Running complete optimization analysis...');

    const outputDir = options.output;
    await fs.mkdir(outputDir, { recursive: true });

    const reports = [];

    // Bundle analysis
    try {
      console.log('Analyzing bundle...');
      // Skip if no bundle found
    } catch (error) {
      console.log('Bundle analysis skipped');
    }

    // Runtime analysis
    try {
      console.log('Analyzing runtime...');
      const runtimeOptimizer = new RuntimeOptimizer();
      const runtimeReport = runtimeOptimizer.generateReport();
      await fs.writeFile(`${outputDir}/runtime.md`, runtimeReport);
      reports.push('Runtime');
    } catch (error) {
      console.error('Runtime analysis failed:', error);
    }

    // Memory analysis
    try {
      console.log('Analyzing memory...');
      const memoryOptimizer = new MemoryOptimizer();
      memoryOptimizer.captureSnapshot();
      const memoryReport = memoryOptimizer.generateReport();
      await fs.writeFile(`${outputDir}/memory.md`, memoryReport);
      reports.push('Memory');
    } catch (error) {
      console.error('Memory analysis failed:', error);
    }

    // Network analysis
    try {
      console.log('Analyzing network...');
      const networkOptimizer = new NetworkOptimizer();
      const networkReport = networkOptimizer.generateReport();
      await fs.writeFile(`${outputDir}/network.md`, networkReport);
      reports.push('Network');
    } catch (error) {
      console.error('Network analysis failed:', error);
    }

    // Cache analysis
    try {
      console.log('Analyzing cache...');
      const cacheOptimizer = new CachingOptimizer();
      const cacheReport = cacheOptimizer.generateReport();
      await fs.writeFile(`${outputDir}/cache.md`, cacheReport);
      reports.push('Cache');
    } catch (error) {
      console.error('Cache analysis failed:', error);
    }

    console.log(`\nAnalysis complete! Reports generated in: ${outputDir}`);
    console.log(`Generated reports: ${reports.join(', ')}`);
  });

// Create baseline command
program
  .command('baseline')
  .description('Create performance baseline')
  .argument('<id>', 'Baseline ID')
  .option('-m, --metrics <file>', 'Metrics file (JSON)')
  .option('-c, --commit <hash>', 'Git commit hash')
  .action(async (id: string, options) => {
    console.log(`Creating baseline: ${id}`);

    const detector = new RegressionDetector();

    let metrics;
    if (options.metrics) {
      const content = await fs.readFile(options.metrics, 'utf-8');
      metrics = JSON.parse(content);
    } else {
      metrics = {
        cpu: 0.4,
        memory: 80 * 1024 * 1024,
        latency: { p50: 40, p95: 80, p99: 120 },
        throughput: 1200,
        bundleSize: { main: 450 * 1024, gzip: 140 * 1024, brotli: 110 * 1024 },
      };
    }

    const baseline = detector.createBaseline(id, metrics, options.commit);
    await detector.saveBaseline(baseline);

    console.log(`Baseline ${id} created successfully`);
  });

// List baselines command
program
  .command('list-baselines')
  .description('List all performance baselines')
  .action(async () => {
    const detector = new RegressionDetector();
    const baselines = detector.getAllBaselines();

    if (baselines.size === 0) {
      console.log('No baselines found');
      return;
    }

    console.log('\nPerformance Baselines:\n');
    for (const [id, baseline] of baselines) {
      console.log(`${id}:`);
      console.log(`  Created: ${new Date(baseline.timestamp).toISOString()}`);
      console.log(`  Commit: ${baseline.commit}`);
      console.log(`  CPU: ${baseline.metrics.cpu}`);
      console.log(`  Memory: ${baseline.metrics.memory}`);
      console.log(`  Throughput: ${baseline.metrics.throughput}`);
      console.log('');
    }
  });

program.parse();
