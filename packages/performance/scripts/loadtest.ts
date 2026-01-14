#!/usr/bin/env tsx
/**
 * Load Testing CLI
 *
 * Run load tests against Cloudflare Workers
 */

import { program } from 'commander';
import { LoadTestRunner, LoadTestScenarios, ReportGenerator } from '../src/index.js';
import { MetricsFormatter } from '../src/utils/formatter.js';
import fs from 'fs/promises';
import path from 'path';

const reportGenerator = new ReportGenerator();

program
  .name('claudeflare-loadtest')
  .description('ClaudeFlare Load Testing Tool')
  .version('1.0.0');

program
  .command('run')
  .description('Run load tests')
  .requiredOption('-u, --url <url>', 'Target URL')
  .option('-s, --scenario <name>', 'Scenario to run (standard-api, high-throughput, cold-start, etc.)')
  .option('-c, --connections <number>', 'Number of connections', '100')
  .option('-d, --duration <seconds>', 'Test duration', '30')
  .option('-p, --pipelining <number>', 'Pipelining factor', '1')
  .option('-m, --method <method>', 'HTTP method', 'GET')
  .option('-o, --output <path>', 'Output directory', './results')
  .option('--format <type>', 'Output format (json, markdown, html)', 'json')
  .option('--progressive', 'Run progressive load test', false)
  .action(async (options) => {
    const runner = new LoadTestRunner();

    let config;
    if (options.scenario) {
      // Use predefined scenario
      const scenarioMethod = options.scenario.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const scenarioFn = (LoadTestScenarios as any)[scenarioMethod];
      if (typeof scenarioFn === 'function') {
        config = scenarioFn(options.url);
        // Override with CLI options
        if (options.connections) config.connections = parseInt(options.connections);
        if (options.duration) config.duration = parseInt(options.duration);
      } else {
        console.error(`Unknown scenario: ${options.scenario}`);
        console.log('Available scenarios:');
        console.log('  - standard-api');
        console.log('  - high-throughput');
        console.log('  - websocket');
        console.log('  - cold-start');
        console.log('  - memory-stress');
        console.log('  - r2-storage');
        console.log('  - kv-storage');
        console.log('  - durable-object');
        console.log('  - concurrent-connections');
        console.log('  - spike-test');
        console.log('  - endurance-test');
        process.exit(1);
      }
    } else {
      // Create custom config
      config = LoadTestScenarios.custom({
        name: 'custom-load-test',
        target: options.url,
        method: options.method as any,
        connections: parseInt(options.connections),
        duration: parseInt(options.duration),
        pipelining: parseInt(options.pipelining),
      });
    }

    console.log(MetricsFormatter.colorize('⚡ Starting Load Test', 'blue'));
    console.log(`Target: ${config.target}`);
    console.log(`Connections: ${config.connections}`);
    console.log(`Duration: ${config.duration}s\n`);

    let results;
    if (options.progressive) {
      results = await runner.runProgressive(
        config,
        Math.floor(config.connections / 4),
        config.connections,
        4
      );
    } else {
      const result = await runner.runTest(config);
      results = [result];
    }

    // Generate report
    const report = reportGenerator.generateReport({
      loadTests: results,
      metadata: {
        url: options.url,
        scenario: options.scenario,
      },
    });

    // Ensure output directory exists
    await fs.mkdir(options.output, { recursive: true });

    // Save results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `loadtest-${timestamp}.${options.format}`;
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
    console.log('\n' + MetricsFormatter.colorize('📊 Load Test Results', 'blue'));

    for (const result of results) {
      console.log(`\n${result.name}:`);
      console.log(`  Throughput: ${MetricsFormatter.formatRequestRate(result.throughput.mean)}`);
      console.log(`  Latency: ${MetricsFormatter.formatDuration(result.latency.mean)} (p95: ${MetricsFormatter.formatDuration(result.latency.percentile95)})`);
      console.log(`  Requests: ${result.requests.total} total, ${result.requests.successful} success, ${result.requests.failed} failed`);
    }

    // Check expectations
    let allPassed = true;
    for (const result of results) {
      if (result.expectations) {
        console.log('\nExpectations:');
        for (const exp of result.expectations) {
          const status = exp.passed ? '✅' : '❌';
          console.log(`  ${status} ${exp.name}: ${exp.actual.toFixed(2)} ${exp.threshold === 'max' ? '<=' : '>='} ${exp.expected}`);
          if (!exp.passed) allPassed = false;
        }
      }
    }

    console.log(`\nOverall Score: ${MetricsFormatter.colorize(`${report.summary.overallScore}/100`, report.summary.overallScore >= 80 ? 'green' : 'yellow')}`);

    if (!allPassed) {
      process.exit(1);
    }
  });

program
  .command('scenarios')
  .description('List available load test scenarios')
  .action(() => {
    console.log('\n📋 Available Load Test Scenarios\n');

    const scenarios = [
      { name: 'standard-api', description: 'Standard API endpoint test' },
      { name: 'high-throughput', description: 'High throughput test with many concurrent connections' },
      { name: 'websocket', description: 'WebSocket streaming test' },
      { name: 'cold-start', description: 'Cold start performance test' },
      { name: 'memory-stress', description: 'Memory stress test' },
      { name: 'r2-storage', description: 'R2 storage operations test' },
      { name: 'kv-storage', description: 'KV storage read test' },
      { name: 'durable-object', description: 'Durable Object operations test' },
      { name: 'concurrent-connections', description: 'High concurrent connections test' },
      { name: 'spike-test', description: 'Sudden traffic spike test' },
      { name: 'endurance-test', description: 'Long duration endurance test' },
    ];

    for (const scenario of scenarios) {
      console.log(MetricsFormatter.colorize(scenario.name, 'blue'));
      console.log(`  ${scenario.description}\n`);
    }
  });

program
  .command('report')
  .description('Generate report from existing results')
  .argument('<file>', 'Results file')
  .option('-o, --output <path>', 'Output directory', './results')
  .option('--format <type>', 'Output format (json, markdown, html)', 'html')
  .action(async (file, options) => {
    const data = JSON.parse(await fs.readFile(file, 'utf-8'));

    const report = reportGenerator.generateReport({
      loadTests: data.details?.loadTests || data.loadTests || [],
    });

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
        output = reportGenerator.exportHTML(report);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filepath = path.join(options.output, `report-${timestamp}.${options.format}`);
    await fs.mkdir(options.output, { recursive: true });
    await fs.writeFile(filepath, output);

    console.log(`✅ Report generated: ${filepath}`);
  });

program.parse();
