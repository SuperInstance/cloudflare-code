/**
 * Load Testing Framework
 *
 * Provides comprehensive load testing capabilities using autocannon
 */

import autocannon from 'autocannon';
import type {
  LoadTestConfig,
  LoadTestResult,
  LoadTestExpectations,
  ExpectationResult,
} from '../types/index.js';

export class LoadTestRunner {
  private results: Map<string, LoadTestResult> = new Map();

  /**
   * Run a load test
   */
  async runTest(config: LoadTestConfig): Promise<LoadTestResult> {
    console.log(`Starting load test: ${config.name}`);
    console.log(`Target: ${config.target}`);
    console.log(`Connections: ${config.connections}`);
    console.log(`Duration: ${config.duration}s`);

    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    // Configure autocannon
    const cannonConfig = {
      url: config.target,
      connections: config.connections,
      duration: config.duration,
      pipelining: config.pipelining || 1,
      timeout: config.timeout || 10,
      maxConnectionRequests: config.maxConnectionRequests,
      amount: config.amount,
      rate: config.rate,
      recovery: config.recovery,
      method: config.method,
      headers: config.requests.headers,
      body: config.requests.body ? JSON.stringify(config.requests.body) : undefined,
      requests: [
        {
          method: config.method,
          path: config.requests.query ? `?${new URLSearchParams(config.requests.query)}` : '/',
          headers: config.requests.headers,
          body: config.requests.body ? JSON.stringify(config.requests.body) : undefined,
        },
      ],
    };

    // Run the test
    const result = await new Promise<any>((resolve, reject) => {
      autocannon(cannonConfig, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });

    const endTime = Date.now();
    const endMemory = process.memoryUsage();

    // Process results
    const loadTestResult: LoadTestResult = {
      name: config.name,
      target: config.target,
      timestamp: startTime,
      duration: result.duration,
      requests: {
        total: result.requests.total,
        successful: result.requests.successful,
        failed: result.requests.failed,
        timeout: result.requests.timeouts || 0,
      },
      latency: {
        min: result.latency.min,
        max: result.latency.max,
        mean: result.latency.mean,
        stdDev: result.latency.stddev || 0,
        percentile95: result.latency.p95,
        percentile99: result.latency.p99,
      },
      throughput: {
        mean: result.throughput.mean,
        min: result.throughput.min,
        max: result.throughput.max,
      },
      errors: this.processErrors(result.errors),
      expectations: config.expectations ? this.checkExpectations(result, config.expectations) : undefined,
      cpuUsage: (endMemory.heapUsed - startMemory.heapUsed) / startMemory.heapUsed,
      memoryUsage: endMemory.heapUsed,
    };

    this.results.set(config.name, loadTestResult);

    console.log(`Load test completed: ${config.name}`);
    console.log(`Throughput: ${loadTestResult.throughput.mean.toFixed(2)} req/s`);
    console.log(`Latency: ${loadTestResult.latency.mean.toFixed(2)}ms (p95: ${loadTestResult.latency.percentile95.toFixed(2)}ms)`);
    console.log(`Errors: ${loadTestResult.requests.failed}`);

    return loadTestResult;
  }

  /**
   * Run multiple tests in parallel
   */
  async runParallel(tests: LoadTestConfig[]): Promise<LoadTestResult[]> {
    console.log(`Running ${tests.length} load tests in parallel...`);

    const promises = tests.map((test) => this.runTest(test));
    const results = await Promise.all(promises);

    console.log('All parallel load tests completed');

    return results;
  }

  /**
   * Run multiple tests in sequence
   */
  async runSequence(tests: LoadTestConfig[]): Promise<LoadTestResult[]> {
    console.log(`Running ${tests.length} load tests in sequence...`);

    const results: LoadTestResult[] = [];
    for (const test of tests) {
      const result = await this.runTest(test);
      results.push(result);
    }

    console.log('All sequential load tests completed');

    return results;
  }

  /**
   * Run progressive load test (ramp up)
   */
  async runProgressive(
    config: LoadTestConfig,
    startConnections: number,
    endConnections: number,
    steps: number
  ): Promise<LoadTestResult[]> {
    console.log(`Running progressive load test: ${config.name}`);
    console.log(`Ramp up from ${startConnections} to ${endConnections} connections in ${steps} steps`);

    const results: LoadTestResult[] = [];
    const stepSize = (endConnections - startConnections) / steps;

    for (let i = 0; i <= steps; i++) {
      const connections = Math.floor(startConnections + stepSize * i);
      console.log(`Step ${i + 1}/${steps + 1}: ${connections} connections`);

      const stepConfig: LoadTestConfig = {
        ...config,
        name: `${config.name}-step-${i + 1}`,
        connections,
      };

      const result = await this.runTest(stepConfig);
      results.push(result);
    }

    return results;
  }

  /**
   * Run duration test (stress test)
   */
  async runDuration(config: LoadTestConfig, maxDuration: number): Promise<LoadTestResult[]> {
    console.log(`Running duration test: ${config.name}`);
    console.log(`Max duration: ${maxDuration}s`);

    const results: LoadTestResult[] = [];
    let currentDuration = 60; // Start with 1 minute
    let lastResult: LoadTestResult | null = null;

    while (currentDuration <= maxDuration) {
      console.log(`Testing with duration: ${currentDuration}s`);

      const durationConfig: LoadTestConfig = {
        ...config,
        name: `${config.name}-duration-${currentDuration}s`,
        duration: currentDuration,
      };

      const result = await this.runTest(durationConfig);
      results.push(result);

      // Check if system degraded
      if (lastResult && result.requests.failed > lastResult.requests.failed * 2) {
        console.warn(`System degraded at ${currentDuration}s duration`);
        break;
      }

      lastResult = result;
      currentDuration *= 2; // Double duration each step
    }

    return results;
  }

  /**
   * Process errors from autocannon
   */
  private processErrors(errors?: any[]): any[] {
    if (!errors || errors.length === 0) {
      return [];
    }

    const errorMap = new Map<string, any>();

    for (const error of errors) {
      const key = error.message || error.code || 'unknown';
      const existing = errorMap.get(key);

      if (existing) {
        existing.count++;
      } else {
        errorMap.set(key, {
          error: key,
          count: 1,
          firstOccurrence: Date.now(),
          stackTrace: error.stack,
        });
      }
    }

    return Array.from(errorMap.values());
  }

  /**
   * Check expectations against results
   */
  private checkExpectations(result: any, expectations: LoadTestExpectations): ExpectationResult[] {
    const expectationResults: ExpectationResult[] = [];

    if (expectations.maxLatency !== undefined) {
      expectationResults.push({
        name: 'maxLatency',
        expected: expectations.maxLatency,
        actual: result.latency.max,
        passed: result.latency.max <= expectations.maxLatency,
        threshold: 'max',
      });
    }

    if (expectations.p95Latency !== undefined) {
      expectationResults.push({
        name: 'p95Latency',
        expected: expectations.p95Latency,
        actual: result.latency.p95,
        passed: result.latency.p95 <= expectations.p95Latency,
        threshold: 'max',
      });
    }

    if (expectations.p99Latency !== undefined) {
      expectationResults.push({
        name: 'p99Latency',
        expected: expectations.p99Latency,
        actual: result.latency.p99,
        passed: result.latency.p99 <= expectations.p99Latency,
        threshold: 'max',
      });
    }

    if (expectations.minThroughput !== undefined) {
      expectationResults.push({
        name: 'minThroughput',
        expected: expectations.minThroughput,
        actual: result.throughput.mean,
        passed: result.throughput.mean >= expectations.minThroughput,
        threshold: 'min',
      });
    }

    if (expectations.maxErrorRate !== undefined) {
      const errorRate = (result.requests.failed / result.requests.total) * 100;
      expectationResults.push({
        name: 'maxErrorRate',
        expected: expectations.maxErrorRate,
        actual: errorRate,
        passed: errorRate <= expectations.maxErrorRate,
        threshold: 'max',
      });
    }

    return expectationResults;
  }

  /**
   * Get test result by name
   */
  getResult(name: string): LoadTestResult | undefined {
    return this.results.get(name);
  }

  /**
   * Get all results
   */
  getAllResults(): LoadTestResult[] {
    return Array.from(this.results.values());
  }

  /**
   * Clear all results
   */
  clearResults(): void {
    this.results.clear();
  }

  /**
   * Export results to JSON
   */
  exportResults(name?: string): string {
    const results = name ? [this.getResult(name)] : this.getAllResults();
    return JSON.stringify(results, null, 2);
  }

  /**
   * Generate report
   */
  generateReport(name?: string): string {
    const results = name ? [this.getResult(name)] : this.getAllResults();

    if (results.length === 0 || results[0] === undefined) {
      return 'No results to report';
    }

    let report = '# Load Test Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;

    for (const result of results) {
      if (!result) continue;

      report += `## ${result.name}\n\n`;
      report += `**Target:** ${result.target}\n`;
      report += `**Duration:** ${result.duration}s\n\n`;

      report += '### Requests\n\n';
      report += `- Total: ${result.requests.total}\n`;
      report += `- Successful: ${result.requests.successful}\n`;
      report += `- Failed: ${result.requests.failed}\n`;
      report += `- Timeout: ${result.requests.timeout}\n\n`;

      report += '### Latency\n\n';
      report += `- Mean: ${result.latency.mean.toFixed(2)}ms\n`;
      report += `- Min: ${result.latency.min.toFixed(2)}ms\n`;
      report += `- Max: ${result.latency.max.toFixed(2)}ms\n`;
      report += `- Std Dev: ${result.latency.stdDev.toFixed(2)}ms\n`;
      report += `- p95: ${result.latency.percentile95.toFixed(2)}ms\n`;
      report += `- p99: ${result.latency.percentile99.toFixed(2)}ms\n\n`;

      report += '### Throughput\n\n';
      report += `- Mean: ${result.throughput.mean.toFixed(2)} req/s\n`;
      report += `- Min: ${result.throughput.min.toFixed(2)} req/s\n`;
      report += `- Max: ${result.throughput.max.toFixed(2)} req/s\n\n`;

      if (result.expectations && result.expectations.length > 0) {
        report += '### Expectations\n\n';
        for (const exp of result.expectations) {
          const status = exp.passed ? '✓' : '✗';
          report += `- ${status} ${exp.name}: ${exp.actual.toFixed(2)} ${exp.threshold === 'max' ? '<=' : '>='} ${exp.expected}\n`;
        }
        report += '\n';
      }

      if (result.errors.length > 0) {
        report += '### Errors\n\n';
        for (const error of result.errors.slice(0, 10)) {
          report += `- ${error.error} (${error.count} occurrences)\n`;
        }
        report += '\n';
      }

      report += '---\n\n';
    }

    return report;
  }
}

export default LoadTestRunner;
