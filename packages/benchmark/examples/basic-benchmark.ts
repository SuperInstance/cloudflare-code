/**
 * Basic Benchmark Example
 * Demonstrates how to create and run simple benchmarks
 */

import { BenchmarkRunner, benchmark, suite } from '@claudeflare/benchmark';

// Example 1: Simple synchronous function benchmark
async function benchmarkSyncFunction() {
  const result = await benchmark('array-sort', () => {
    const data = Array.from({ length: 1000 }, () => Math.random());
    data.sort((a, b) => a - b);
  }, {
    iterations: 100,
    time: 1000
  });

  console.log('Benchmark Result:');
  console.log(`  Mean: ${result.mean / 1000000}ms`);
  console.log(`  Ops/sec: ${result.ops.toFixed(0)}`);
  console.log(`  RSD: ${result.rsd.toFixed(2)}%`);
}

// Example 2: Simple async function benchmark
async function benchmarkAsyncFunction() {
  const result = await benchmark('async-fetch', async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
  }, {
    iterations: 50,
    time: 1000
  });

  console.log('Async Benchmark Result:');
  console.log(`  Mean: ${result.mean / 1000000}ms`);
  console.log(`  Ops/sec: ${result.ops.toFixed(0)}`);
}

// Example 3: Benchmark with setup and teardown
async function benchmarkWithHooks() {
  const runner = new BenchmarkRunner({
    iterations: 50,
    warmupIterations: 3
  });

  let data: number[] = [];

  runner.addBenchmark({
    name: 'array-map',
    fn: () => {
      data.map(x => x * 2);
    },
    setup: () => {
      // Prepare data before each iteration
      data = Array.from({ length: 1000 }, () => Math.random());
    },
    teardown: () => {
      // Clean up after each iteration
      data = [];
    }
  });

  const suite = await runner.run();

  console.log('Benchmark with Hooks:');
  console.log(`  Total: ${suite.statistics.totalBenchmarks}`);
  console.log(`  Successful: ${suite.statistics.successful}`);
}

// Example 4: Running multiple benchmarks as a suite
async function benchmarkSuite() {
  const benchmarks = [
    {
      name: 'object-creation',
      fn: () => {
        const obj = { a: 1, b: 2, c: 3 };
        return obj;
      }
    },
    {
      name: 'array-creation',
      fn: () => {
        const arr = [1, 2, 3, 4, 5];
        return arr;
      }
    },
    {
      name: 'string-concat',
      fn: () => {
        const str = 'hello' + ' ' + 'world';
        return str;
      }
    }
  ];

  const result = await suite(benchmarks, {
    iterations: 100,
    time: 500
  });

  console.log('\nBenchmark Suite Results:');
  for (const benchmarkResult of result.results) {
    console.log(`\n${benchmarkResult.name}:`);
    console.log(`  Mean: ${benchmarkResult.mean / 1000000}ms`);
    console.log(`  Ops/sec: ${benchmarkResult.ops.toFixed(0)}`);
    console.log(`  Min: ${benchmarkResult.min / 1000000}ms`);
    console.log(`  Max: ${benchmarkResult.max / 1000000}ms`);
  }
}

// Example 5: Benchmark with event handling
async function benchmarkWithEvents() {
  const runner = new BenchmarkRunner({
    iterations: 20
  });

  // Register event handlers
  runner.on((event) => {
    if (event.type === 'benchmark-start') {
      console.log(`Starting: ${event.data.name}`);
    } else if (event.type === 'benchmark-end') {
      console.log(`Completed: ${event.data.data.name}`);
    } else if (event.type === 'progress') {
      console.log(`Progress: ${event.data.progress.toFixed(0)}%`);
    }
  });

  runner.addBenchmark({
    name: 'test-benchmark',
    fn: () => {
      const sum = Array.from({ length: 1000 }, (_, i) => i)
        .reduce((a, b) => a + b, 0);
    }
  });

  await runner.run();
}

// Run examples
async function main() {
  console.log('=== Basic Benchmark Examples ===\n');

  console.log('\n1. Simple Sync Function Benchmark:');
  await benchmarkSyncFunction();

  console.log('\n2. Simple Async Function Benchmark:');
  await benchmarkAsyncFunction();

  console.log('\n3. Benchmark with Hooks:');
  await benchmarkWithHooks();

  console.log('\n4. Benchmark Suite:');
  await benchmarkSuite();

  console.log('\n5. Benchmark with Events:');
  await benchmarkWithEvents();
}

main().catch(console.error);
