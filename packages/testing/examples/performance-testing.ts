/**
 * Performance Testing Examples
 *
 * Demonstrates performance testing with the ClaudeFlare Testing Framework
 */

import { describe, it, expect } from '@claudeflare/testing';
import {
  benchmark,
  loadTest,
  createPerformanceTest,
  measureLatency,
  monitorResources,
  LatencyMeasurer,
  LoadTester,
  BenchmarkRunner,
} from '@claudeflare/testing';

// ============================================================================
// Benchmark Testing
// ============================================================================

describe('Benchmarks', () => {
  it('should benchmark function performance', async () => {
    const result = await benchmark(
      'array-sum',
      () => {
        const arr = Array.from({ length: 1000 }, (_, i) => i);
        return arr.reduce((sum, n) => sum + n, 0);
      },
      { iterations: 1000 }
    );

    console.log(`Array sum benchmark:`, {
      avgTime: `${result.avgTime.toFixed(2)}ms`,
      opsPerSecond: result.opsPerSecond.toFixed(0),
      p95: `${result.percentiles.p95.toFixed(2)}ms`,
    });

    expect(result.avgTime).toBeGreaterThan(0);
    expect(result.opsPerSecond).toBeGreaterThan(100);
  });

  it('should compare different implementations', async () => {
    const implementations = new Map([
      ['for-loop', () => {
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      }],
      ['reduce', () => {
        return Array.from({ length: 1000 }, (_, i) => i)
          .reduce((sum, n) => sum + n, 0);
      }],
      ['while-loop', () => {
        let sum = 0;
        let i = 0;
        while (i < 1000) {
          sum += i;
          i++;
        }
        return sum;
      }],
    ]);

    const runner = new BenchmarkRunner();
    const results = await runner.compare('array-summation', implementations);

    console.log('Implementation comparison:');
    for (const [name, result] of results) {
      console.log(`  ${name}: ${result.avgTime.toFixed(3)}ms avg`);
    }

    expect(results.size).toBe(3);
  });

  it('should run benchmark suite', async () => {
    const runner = new BenchmarkRunner();

    const results = await runner.suite('string-operations', [
      {
        name: 'concatenation',
        fn: () => {
          let str = '';
          for (let i = 0; i < 100; i++) {
            str += 'test';
          }
          return str;
        },
      },
      {
        name: 'array-join',
        fn: () => {
          const arr = [];
          for (let i = 0; i < 100; i++) {
            arr.push('test');
          }
          return arr.join('');
        },
      },
      {
        name: 'template-literal',
        fn: () => {
          let str = '';
          for (let i = 0; i < 100; i++) {
            str = `${str}test`;
          }
          return str;
        },
      },
    ]);

    console.log('String operation benchmarks:');
    for (const result of results) {
      console.log(`  ${result.name}: ${result.avgTime.toFixed(3)}ms avg`);
    }

    expect(results).toHaveLength(3);
  });
});

// ============================================================================
// Load Testing
// ============================================================================

describe('Load Tests', () => {
  it('should perform basic load test', async () => {
    const tester = new LoadTester();

    // Mock endpoint for testing
    // In real scenario, this would be an actual endpoint
    const mockEndpoint = 'https://httpbin.org/get';

    const result = await tester.loadTest({
      endpoint: mockEndpoint,
      concurrency: 10,
      requests: 100,
      rampUp: 1000,
    });

    console.log('Load test results:', {
      totalRequests: result.totalRequests,
      successfulRequests: result.successfulRequests,
      failedRequests: result.failedRequests,
      requestsPerSecond: result.requestsPerSecond.toFixed(2),
      avgLatency: `${result.avgLatency.toFixed(2)}ms`,
      p95Latency: `${result.percentiles.p95.toFixed(2)}ms`,
      p99Latency: `${result.percentiles.p99.toFixed(2)}ms`,
    });

    expect(result.totalRequests).toBe(100);
    expect(result.successfulRequests).toBeGreaterThan(0);
  });

  it('should perform stress test', async () => {
    const tester = new LoadTester();

    const results = await tester.stressTest('https://httpbin.org/get', {
      startConcurrency: 1,
      maxConcurrency: 10,
      stepSize: 2,
      stepDuration: 2000,
      requestsPerStep: 20,
    });

    console.log('Stress test results:');
    for (const result of results) {
      console.log(`  ${result.concurrency} concurrent:`, {
        rps: result.requestsPerSecond.toFixed(2),
        avgLatency: `${result.avgLatency.toFixed(2)}ms`,
        errorRate: `${((result.failedRequests / result.totalRequests) * 100).toFixed(2)}%`,
      });
    }

    expect(results).toHaveLengthGreaterThan(0);
  });

  it('should perform spike test', async () => {
    const tester = new LoadTester();

    const { baseline, spike, recovery } = await tester.spikeTest(
      'https://httpbin.org/get',
      {
        baselineConcurrency: 5,
        spikeConcurrency: 50,
        spikeDuration: 5000,
        baselineDuration: 5000,
        requestsPerSecond: 10,
      }
    );

    console.log('Spike test results:', {
      baseline: {
        rps: baseline.requestsPerSecond.toFixed(2),
        avgLatency: `${baseline.avgLatency.toFixed(2)}ms`,
      },
      spike: {
        rps: spike.requestsPerSecond.toFixed(2),
        avgLatency: `${spike.avgLatency.toFixed(2)}ms`,
      },
      recovery: {
        rps: recovery.requestsPerSecond.toFixed(2),
        avgLatency: `${recovery.avgLatency.toFixed(2)}ms`,
      },
    });

    expect(baseline.totalRequests).toBeGreaterThan(0);
    expect(spike.totalRequests).toBeGreaterThan(0);
    expect(recovery.totalRequests).toBeGreaterThan(0);
  });
});

// ============================================================================
// Latency Measurement
// ============================================================================

describe('Latency Measurement', () => {
  it('should measure function latency', async () => {
    const measurer = new LatencyMeasurer();

    async function fetchData(): Promise<number> {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 100));
      return 42;
    }

    const { result, latency } = await measurer.measure('fetch-data', fetchData);

    expect(result).toBe(42);
    expect(latency).toBeGreaterThan(90); // Should be ~100ms

    const stats = measurer.getStats('fetch-data');
    expect(stats).toBeDefined();
    expect(stats!.count).toBe(1);
    expect(stats!.avg).toBeGreaterThan(0);

    console.log('Latency stats:', {
      count: stats!.count,
      avg: `${stats!.avg.toFixed(2)}ms`,
      min: `${stats!.min.toFixed(2)}ms`,
      max: `${stats!.max.toFixed(2)}ms`,
      p95: `${stats!.p95.toFixed(2)}ms`,
      p99: `${stats!.p99.toFixed(2)}ms`,
    });
  });

  it('should track multiple measurements', async () => {
    const measurer = new LatencyMeasurer();

    for (let i = 0; i < 10; i++) {
      await measurer.measure('operation', async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return i;
      });
    }

    const stats = measurer.getStats('operation');
    expect(stats!.count).toBe(10);
    expect(stats!.avg).toBeGreaterThan(40);
  });
});

// ============================================================================
// Throughput Testing
// ============================================================================

describe('Throughput Testing', () => {
  it('should measure throughput', async () => {
    const { ThroughputTester } = await import('@claudeflare/testing');
    const tester = new ThroughputTester();

    async function quickOperation() {
      return Math.random();
    }

    const result = await tester.measureThroughput(quickOperation, {
      duration: 1000,
      concurrency: 4,
    });

    console.log('Throughput results:', {
      operations: result.operations,
      duration: `${result.duration}ms`,
      opsPerSecond: result.opsPerSecond.toFixed(2),
      avgLatency: `${result.avgLatency.toFixed(2)}ms`,
    });

    expect(result.operations).toBeGreaterThan(0);
    expect(result.opsPerSecond).toBeGreaterThan(100);
  });
});

// ============================================================================
// Resource Monitoring
// ============================================================================

describe('Resource Monitoring', () => {
  it('should monitor resource usage', async () => {
    const monitor = monitorResources();

    monitor.start(100); // Sample every 100ms

    // Do some work
    for (let i = 0; i < 1000; i++) {
      const arr = Array.from({ length: 100 }, (_, j) => j);
      arr.reduce((sum, n) => sum + n, 0);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    monitor.stop();

    const stats = monitor.getStats();

    console.log('Resource stats:', {
      duration: `${stats.duration}ms`,
      samples: stats.samples,
      memory: {
        avg: `${(stats.memory.avg / 1024 / 1024).toFixed(2)}MB`,
        peak: `${(stats.memory.peak / 1024 / 1024).toFixed(2)}MB`,
      },
      cpu: {
        avg: `${(stats.cpu.avg * 100).toFixed(2)}%`,
        max: `${(stats.cpu.max * 100).toFixed(2)}%`,
      },
    });

    expect(stats.samples).toBeGreaterThan(0);
    expect(stats.memory.peak).toBeGreaterThan(0);
  });
});

// ============================================================================
// Performance Test Builder
// ============================================================================

describe('Performance Test Builder', () => {
  it('should build and run performance tests', async () => {
    const builder = createPerformanceTest();

    builder
      .addBenchmark('fibonacci', () => {
        function fib(n: number): number {
          if (n <= 1) return n;
          return fib(n - 1) + fib(n - 2);
        }
        return fib(20);
      })
      .addBenchmark('factorial', () => {
        function fact(n: number): number {
          if (n <= 1) return 1;
          return n * fact(n - 1);
        }
        return fact(10);
      })
      .addLoadTest('api-load', {
        endpoint: 'https://httpbin.org/get',
        concurrency: 5,
        requests: 50,
      });

    const results = await builder.run();

    console.log('Benchmark results:');
    for (const [name, result] of results.benchmarks) {
      console.log(`  ${name}:`, {
        opsPerSecond: result.opsPerSecond.toFixed(0),
        avgTime: `${result.avgTime.toFixed(3)}ms`,
      });
    }

    console.log('Load test results:');
    for (const [name, result] of results.loadTests) {
      console.log(`  ${name}:`, {
        totalRequests: result.totalRequests,
        requestsPerSecond: result.requestsPerSecond.toFixed(2),
        avgLatency: `${result.avgLatency.toFixed(2)}ms`,
      });
    }

    expect(results.benchmarks.size).toBe(2);
    expect(results.loadTests.size).toBe(1);
  });
});

// ============================================================================
// Real-World Performance Scenarios
// ============================================================================

describe('Real-World Performance Scenarios', () => {
  it('should benchmark JSON parsing', async () => {
    const largeObject = {
      users: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        metadata: {
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        },
      })),
    };

    const jsonString = JSON.stringify(largeObject);

    const result = await benchmark(
      'json-parse',
      () => JSON.parse(jsonString),
      { iterations: 100 }
    );

    console.log('JSON parsing benchmark:', {
      avgTime: `${result.avgTime.toFixed(2)}ms`,
      opsPerSecond: result.opsPerSecond.toFixed(0),
    });

    expect(result.avgTime).toBeGreaterThan(0);
  });

  it('should benchmark data transformations', async () => {
    const data = Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      value: Math.random(),
    }));

    const result = await benchmark(
      'data-transformation',
      () => {
        return data
          .filter((item) => item.value > 0.5)
          .map((item) => ({
            ...item,
            doubled: item.value * 2,
          }))
          .reduce((sum, item) => sum + item.doubled, 0);
      },
      { iterations: 100 }
    );

    console.log('Data transformation benchmark:', {
      avgTime: `${result.avgTime.toFixed(2)}ms`,
      opsPerSecond: result.opsPerSecond.toFixed(0),
    });

    expect(result.avgTime).toBeGreaterThan(0);
  });
});
