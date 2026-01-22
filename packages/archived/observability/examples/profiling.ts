/**
 * Performance profiling example
 */

import { CPUProfiler } from '@claudeflare/observability';

async function main() {
  const profiler = new CPUProfiler({
    interval: 1000, // 1ms sampling
    duration: 10000, // 10 seconds
  });

  console.log('Starting CPU profiling...');

  // Start profiling
  profiler.start();

  // Do some work
  await performWork();

  // Stop profiling
  const profile = profiler.stop();

  console.log(`Profile captured ${profile.samples.length} samples`);

  // Generate flame graph
  const flameGraph = profiler.generateFlameGraph(profile);
  console.log('Flame graph:', JSON.stringify(flameGraph, null, 2));

  // Analyze hot paths
  const hotPaths = profiler.analyzeHotPaths(profile, 5);
  console.log('Hot paths:', hotPaths);

  // Detect bottlenecks
  const bottlenecks = profiler.detectBottlenecks(profile);
  console.log('Bottlenecks:', bottlenecks);
}

async function performWork(): Promise<void> {
  // Simulate some CPU-intensive work
  for (let i = 0; i < 1000; i++) {
    await fibonacci(30);
  }
}

function fibonacci(n: number): Promise<number> {
  return new Promise((resolve) => {
    setImmediate(() => {
      if (n <= 1) {
        resolve(n);
      } else {
        Promise.all([fibonacci(n - 1), fibonacci(n - 2)]).then(([a, b]) => {
          resolve(a + b);
        });
      }
    });
  });
}

main().catch(console.error);
