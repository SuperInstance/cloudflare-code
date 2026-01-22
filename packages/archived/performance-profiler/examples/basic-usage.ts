/**
 * Basic Usage Examples for ClaudeFlare Performance Profiler
 */

import {
  PerformanceProfiler,
  CPUProfiler,
  MemoryProfiler,
  ExecutionTracer,
  createPerformanceProfiler,
} from '../src';

// ============================================================================
// Example 1: Basic CPU Profiling
// ============================================================================

async function basicCPUProfiling() {
  console.log('=== Basic CPU Profiling ===');

  const profiler = new CPUProfiler({
    samplingInterval: 1000,
    maxSamples: 10000,
    enableFunctionTiming: true,
  });

  profiler.start();

  // Simulate some work
  function heavyComputation(n: number): number {
    if (n <= 1) return 1;
    return n * heavyComputation(n - 1);
  }

  profiler.recordFunctionEntry('heavyComputation');
  const result = heavyComputation(10);
  profiler.recordFunctionExit('heavyComputation');

  const profile = profiler.stop();

  console.log('Profile Statistics:', profiler.getStatistics());
  console.log('Function Timings:', profiler.getFunctionTimings());
  console.log('Hot Paths:', profiler.identifyHotPaths(5));

  profiler.dispose();
}

// ============================================================================
// Example 2: Memory Profiling
// ============================================================================

async function basicMemoryProfiling() {
  console.log('\n=== Basic Memory Profiling ===');

  const profiler = new MemoryProfiler({
    enableSnapshots: true,
    snapshotInterval: 1000,
    enableLeakDetection: true,
    trackAllocations: true,
  });

  profiler.start();

  // Allocate some memory
  const allocations: string[] = [];
  for (let i = 0; i < 1000; i++) {
    const id = profiler.trackAllocation('string', 100);
    allocations.push(id);
  }

  // Take a snapshot
  profiler.takeSnapshot();

  // Deallocate some memory
  for (const id of allocations.slice(0, 500)) {
    profiler.trackDeallocation(id);
  }

  profiler.stop();

  console.log('Memory Statistics:', profiler.getStatistics());
  console.log('Snapshots:', profiler.getSnapshots().length);
  console.log('Leaks:', profiler.getLeaks().length);

  profiler.dispose();
}

// ============================================================================
// Example 3: Distributed Tracing
// ============================================================================

async function basicTracing() {
  console.log('\n=== Basic Distributed Tracing ===');

  const tracer = new ExecutionTracer({
    enabled: true,
    samplingRate: 1.0,
    enableCriticalPathAnalysis: true,
  });

  // Simulate a distributed request
  async function handleRequest() {
    const span = tracer.startSpan({
      operationName: 'handle-request',
      tags: { http.method: 'GET', http.url: '/api/users' },
    });

    if (!span) return;

    try {
      // Simulate database query
      await tracer.withSpan(
        {
          operationName: 'database-query',
          parentContext: tracer.getCurrentContext(),
        },
        async () => {
          return new Promise((resolve) => setTimeout(resolve, 50));
        }
      );

      // Simulate cache lookup
      await tracer.withSpan(
        {
          operationName: 'cache-lookup',
          parentContext: tracer.getCurrentContext(),
        },
        async () => {
          return new Promise((resolve) => setTimeout(resolve, 10));
        }
      );

      tracer.finishSpan(span);
    } catch (error) {
      span.status = { code: 1, message: String(error) };
      tracer.finishSpan(span);
    }
  }

  await handleRequest();

  console.log('Trace Statistics:', tracer.getStatistics());
  console.log('Traces:', tracer.getAllTraces().size);

  const traces = Array.from(tracer.getAllTraces().values())[0];
  if (traces) {
    const criticalPath = tracer.analyzeCriticalPath(traces[0].traceId);
    console.log('Critical Path:', criticalPath);
  }
}

// ============================================================================
// Example 4: Integrated Profiling
// ============================================================================

async function integratedProfiling() {
  console.log('\n=== Integrated Profiling ===');

  const profiler = createPerformanceProfiler({
    cpu: {
      samplingInterval: 1000,
      enableFunctionTiming: true,
    },
    memory: {
      enableSnapshots: true,
      snapshotInterval: 2000,
    },
    network: {
      enabled: true,
    },
  });

  profiler.startAll();

  // Simulate application workload
  async function processRequest() {
    // CPU work
    for (let i = 0; i < 1000; i++) {
      Math.sqrt(i);
    }

    // Memory allocation
    const data = new Array(1000).fill('test');

    // Network request (simulated)
    const requestId = profiler.network.recordRequestStart(
      'https://api.example.com/data',
      'GET'
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    profiler.network.recordRequestEnd(requestId, 200, undefined, 1024);

    return data.length;
  }

  // Process multiple requests
  for (let i = 0; i < 10; i++) {
    await processRequest();
  }

  profiler.stopAll();

  const report = profiler.getReport();
  console.log('\nPerformance Report:');
  console.log('- CPU:', report.cpu);
  console.log('- Memory:', report.memory);
  console.log('- Network:', report.network);
  console.log('- Analytics Score:', report.analytics.score);

  const analysis = await profiler.analyzeAndOptimize();
  console.log('\nOptimization Analysis:');
  console.log('- Priority:', analysis.priority);
  console.log('- Issues:', analysis.issues);
  console.log('- Recommendations:', analysis.recommendations.length);

  profiler.dispose();
}

// ============================================================================
// Example 5: Benchmarking
// ============================================================================

async function basicBenchmarking() {
  console.log('\n=== Basic Benchmarking ===');

  const { BenchmarkRunner, createBenchmarkSuite, createBenchmark } = await import('../src');

  const runner = new BenchmarkRunner();

  const suite = createBenchmarkSuite(
    'array-operations',
    'Array Operations Benchmark Suite'
  );

  suite.benchmarks.push(
    createBenchmark('array-map', 'Array.map()', async () => {
      const arr = Array.from({ length: 1000 }, (_, i) => i);
      return arr.map((x) => x * 2);
    })
  );

  suite.benchmarks.push(
    createBenchmark('array-for-loop', 'For loop', async () => {
      const arr = Array.from({ length: 1000 }, (_, i) => i);
      const result: number[] = [];
      for (let i = 0; i < arr.length; i++) {
        result.push(arr[i] * 2);
      }
      return result;
    })
  );

  runner.registerSuite(suite);

  const results = await runner.runSuite('array-operations');

  console.log('\nBenchmark Results:');
  for (const result of results) {
    console.log(`\n${result.benchmarkId}:`);
    console.log(`  Mean: ${result.stats.mean.toFixed(2)}ms`);
    console.log(`  Min: ${result.stats.min.toFixed(2)}ms`);
    console.log(`  Max: ${result.stats.max.toFixed(2)}ms`);
    console.log(`  Throughput: ${result.stats.throughput?.toFixed(0)} ops/sec`);
  }

  // Compare results
  if (results.length >= 2) {
    const comparison = runner.compareResults(results[0], results[1]);
    console.log('\nComparison:');
    console.log(`  Difference: ${comparison.difference.toFixed(2)}ms`);
    console.log(`  Difference %: ${comparison.differencePercent.toFixed(2)}%`);
    console.log(`  Improved: ${comparison.improved}`);
    console.log(`  Significant: ${comparison.significance > 0.95}`);
  }
}

// ============================================================================
// Example 6: Regression Detection
// ============================================================================

async function regressionDetection() {
  console.log('\n=== Regression Detection ===');

  const { RegressionDetector, createRegressionDetector } = await import('../src');
  const { PerformanceMetrics } = await import('../src');

  const detector = createRegressionDetector({
    threshold: 10,
    minSamples: 5,
    enableAlerts: true,
  });

  // Establish baseline
  const baseline: PerformanceMetrics = {
    timestamp: Date.now(),
    cpu: { usage: 30, userTime: 100, systemTime: 30, idleTime: 0 },
    memory: {
      used: 1024 * 1024 * 100,
      total: 1024 * 1024 * 512,
      heapUsed: 1024 * 1024 * 80,
      heapTotal: 1024 * 1024 * 256,
      external: 1024 * 1024 * 10,
    },
    network: {
      requests: 100,
      bytesReceived: 1024 * 1024 * 10,
      bytesSent: 1024 * 1024 * 5,
      errors: 0,
      latency: 50,
    },
    custom: {},
  };

  detector.createBaseline('production-baseline', baseline);

  // Record normal metrics
  for (let i = 0; i < 10; i++) {
    detector.recordMetrics({
      ...baseline,
      timestamp: Date.now(),
    });
  }

  console.log('Regressions:', detector.getRegressions().length);

  // Record degraded metrics
  const degraded: PerformanceMetrics = {
    timestamp: Date.now(),
    cpu: { usage: 50, userTime: 150, systemTime: 50, idleTime: 0 },
    memory: {
      used: 1024 * 1024 * 150,
      total: 1024 * 1024 * 512,
      heapUsed: 1024 * 1024 * 120,
      heapTotal: 1024 * 1024 * 256,
      external: 1024 * 1024 * 10,
    },
    network: {
      requests: 100,
      bytesReceived: 1024 * 1024 * 10,
      bytesSent: 1024 * 1024 * 5,
      errors: 0,
      latency: 100,
    },
    custom: {},
  };

  detector.recordMetrics(degraded);

  const regressions = detector.detectRegressions();
  console.log('Detected Regressions:', regressions.length);

  if (regressions.length > 0) {
    console.log('\nRegression Details:');
    for (const regression of regressions) {
      console.log(`- ${regression.metric}`);
      console.log(`  Severity: ${regression.severity}`);
      console.log(`  Delta: ${regression.deltaPercent.toFixed(2)}%`);
      console.log(`  Description: ${regression.description}`);
    }
  }
}

// ============================================================================
// Run all examples
// ============================================================================

async function main() {
  try {
    await basicCPUProfiling();
    await basicMemoryProfiling();
    await basicTracing();
    await integratedProfiling();
    await basicBenchmarking();
    await regressionDetection();

    console.log('\n=== All examples completed successfully ===');
  } catch (error) {
    console.error('Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export {
  basicCPUProfiling,
  basicMemoryProfiling,
  basicTracing,
  integratedProfiling,
  basicBenchmarking,
  regressionDetection,
};
