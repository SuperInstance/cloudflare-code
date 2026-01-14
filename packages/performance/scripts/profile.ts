#!/usr/bin/env tsx
/**
 * Performance Profiling CLI
 *
 * Profile and analyze performance of Cloudflare Workers
 */

import { program } from 'commander';
import { PerformanceProfiler, PerformanceAnalyzer, ReportGenerator } from '../src/index.js';
import { MetricsFormatter } from '../src/utils/formatter.js';
import fs from 'fs/promises';
import path from 'path';

const reportGenerator = new ReportGenerator();

program
  .name('claudeflare-profile')
  .description('ClaudeFlare Performance Profiler')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze performance metrics')
  .requiredOption('-f, --file <path>', 'Metrics file to analyze')
  .option('-o, --output <path>', 'Output directory', './results')
  .option('--format <type>', 'Output format (json, markdown)', 'markdown')
  .action(async (options) => {
    console.log('🔍 Analyzing performance metrics...\n');

    const data = JSON.parse(await fs.readFile(options.file, 'utf-8'));
    const analyzer = new PerformanceAnalyzer();

    let report = '';

    // Analyze metrics if available
    if (data.metrics) {
      const recommendations = analyzer.analyzeMetrics(data.metrics);
      report += analyzer.generateReport(data.metrics, data.snapshots, data.benchmarks);
    }

    // Save report
    await fs.mkdir(options.output, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filepath = path.join(options.output, `analysis-${timestamp}.${options.format}`);
    await fs.writeFile(filepath, report);

    console.log('✅ Analysis complete');
    console.log(`📄 Report saved to ${filepath}\n`);

    console.log(report);
  });

program
  .command('worker')
  .description('Profile a Cloudflare Worker function')
  .argument('<file>', 'Worker file to profile')
  .option('-i, --iterations <number>', 'Number of iterations', '100')
  .option('-o, --output <path>', 'Output directory', './results')
  .action(async (file, options) => {
    console.log('🔍 Profiling Worker function...\n');

    // Load worker module
    const workerPath = path.resolve(file);
    const workerModule = await import(workerPath);

    // Find default export or named exports
    const workerFn = workerModule.default || workerModule.handler || workerModule.fetch;

    if (!workerFn || typeof workerFn !== 'function') {
      console.error('❌ Could not find a worker function to profile');
      console.log('Expected: default export, handler(), or fetch() function');
      process.exit(1);
    }

    // Profile the function
    const iterations = parseInt(options.iterations);
    const profiler = new PerformanceProfiler({ enabled: true });

    console.log(`Running ${iterations} iterations...\n`);

    profiler.start();

    const startTime = performance.now();
    for (let i = 0; i < iterations; i++) {
      await workerFn(new Request('https://example.com'), {});
    }
    const endTime = performance.now();

    profiler.stop();

    const summary = profiler.getSummary();
    const avgTime = (endTime - startTime) / iterations;

    console.log('📊 Profiling Results\n');
    console.log(`Iterations: ${iterations}`);
    console.log(`Total Time: ${MetricsFormatter.formatDuration(endTime - startTime)}`);
    console.log(`Average Time: ${MetricsFormatter.formatDuration(avgTime)}`);
    console.log(`Throughput: ${MetricsFormatter.formatThroughput(1000 / avgTime)}`);
    console.log(`\nCPU Usage: ${MetricsFormatter.formatCpuUsage(summary.avgCpuUsage)}`);
    console.log(`Memory: ${MetricsFormatter.formatMemorySnapshot(summary.avgMemoryUsage, summary.maxMemoryUsage)}`);
    console.log(`Event Loop: ${MetricsFormatter.formatEventLoopLag(summary.avgEventLoopLag)}`);

    // Save profile
    await fs.mkdir(options.output, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const profilePath = path.join(options.output, `profile-${timestamp}.json`);
    const profileData = {
      summary,
      snapshots: profiler.getSnapshots(),
      iterations,
      avgTime,
      throughput: 1000 / avgTime,
    };
    await fs.writeFile(profilePath, JSON.stringify(profileData, null, 2));

    console.log(`\n✅ Profile saved to ${profilePath}`);

    // Export Chrome DevTools profile
    const chromeProfilePath = path.join(options.output, `chrome-profile-${timestamp}.json`);
    const chromeProfile = profiler.exportProfile();
    await fs.writeFile(chromeProfilePath, chromeProfile);

    console.log(`📄 Chrome DevTools profile saved to ${chromeProfilePath}`);
  });

program
  .command('compare')
  .description('Compare two profiling runs')
  .argument('<baseline>', 'Baseline profile file')
  .argument('<current>', 'Current profile file')
  .action(async (baseline, current) => {
    console.log('📊 Comparing profiles...\n');

    const baselineData = JSON.parse(await fs.readFile(baseline, 'utf-8'));
    const currentData = JSON.parse(await fs.readFile(current, 'utf-8'));

    console.log('Baseline:');
    console.log(`  Avg Time: ${MetricsFormatter.formatDuration(baselineData.avgTime)}`);
    console.log(`  Throughput: ${MetricsFormatter.formatThroughput(baselineData.throughput)}`);

    console.log('\nCurrent:');
    console.log(`  Avg Time: ${MetricsFormatter.formatDuration(currentData.avgTime)}`);
    console.log(`  Throughput: ${MetricsFormatter.formatThroughput(currentData.throughput)}`);

    const timeChange = ((currentData.avgTime - baselineData.avgTime) / baselineData.avgTime) * 100;
    const throughputChange = ((currentData.throughput - baselineData.throughput) / baselineData.throughput) * 100;

    console.log('\nChanges:');
    console.log(`  Time: ${MetricsFormatter.formatComparison(baselineData.avgTime, currentData.avgTime, 'ms')}`);
    console.log(`  Throughput: ${MetricsFormatter.formatComparison(baselineData.throughput, currentData.throughput, ' ops/s', false)}`);

    const isRegression = timeChange > 10;
    if (isRegression) {
      console.log(MetricsFormatter.colorize('\n⚠️ Performance regression detected!', 'yellow'));
      process.exit(1);
    } else {
      console.log(MetricsFormatter.colorize('\n✅ No significant regression', 'green'));
    }
  });

program
  .command('check')
  .description('Check code for performance anti-patterns')
  .argument('<path>', 'File or directory to check')
  .option('-o, --output <path>', 'Output file', './performance-report.md')
  .action(async (targetPath, options) => {
    console.log('🔍 Scanning for performance issues...\n');

    const { PatternAnalyzer } = await import('../src/optimizer/patterns.js');
    const analyzer = new PatternAnalyzer();

    const target = path.resolve(targetPath);
    const stat = await fs.stat(target);

    let files: string[] = [];
    if (stat.isDirectory()) {
      const dir = target;
      const entries = await fs.readdir(dir, { recursive: true });
      files = entries
        .filter((e) => e.endsWith('.ts') || e.endsWith('.js'))
        .map((e) => path.join(dir, e));
    } else {
      files = [target];
    }

    let allIssues: any[] = [];
    for (const file of files) {
      try {
        const code = await fs.readFile(file, 'utf-8');
        const issues = analyzer.analyzeCode(code);

        for (const issue of issues) {
          for (const match of issue.matches) {
            allIssues.push({
              ...issue,
              file,
              line: match.line,
              text: match.text,
            });
          }
        }
      } catch (err) {
        // Skip files that can't be read
      }
    }

    if (allIssues.length === 0) {
      console.log('✅ No performance issues detected!\n');
      return;
    }

    console.log(`⚠️ Found ${allIssues.length} potential performance issues\n`);

    // Group by severity
    const bySeverity: any = {};
    for (const issue of allIssues) {
      if (!bySeverity[issue.pattern.severity]) {
        bySeverity[issue.pattern.severity] = [];
      }
      bySeverity[issue.pattern.severity].push(issue);
    }

    const severityOrder = ['critical', 'high', 'medium', 'low'];
    for (const severity of severityOrder) {
      const issues = bySeverity[severity];
      if (!issues || issues.length === 0) continue;

      console.log(MetricsFormatter.colorize(`${severity.toUpperCase()} (${issues.length})`, severity === 'critical' || severity === 'high' ? 'red' : 'yellow'));

      for (const issue of issues.slice(0, 5)) {
        console.log(`  ${issue.pattern.name}`);
        console.log(`    ${issue.file}:${issue.line}`);
        console.log(`    ${issue.text.trim()}`);
        console.log('');
      }

      if (issues.length > 5) {
        console.log(`  ... and ${issues.length - 5} more\n`);
      }
    }

    // Generate full report
    const report = analyzer.generateReport(allIssues);
    await fs.writeFile(options.output, report);
    console.log(`📄 Full report saved to ${options.output}`);
  });

program.parse();
