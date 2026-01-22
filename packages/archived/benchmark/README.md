# @claudeflare/benchmark

Comprehensive benchmarking and profiling suite for the ClaudeFlare distributed AI coding platform.

## Features

- **Benchmark Runner**: Execute benchmarks with statistical analysis, warmup iterations, and outlier detection
- **Metrics Collector**: Collect detailed performance metrics (memory, CPU, I/O, GC, event loop)
- **Comparison Engine**: A/B testing, performance regression detection, and trend analysis
- **Profiler Integration**: CPU and memory profiling with flame graphs and hot path analysis
- **Load Tester**: Concurrent execution testing with configurable concurrency levels
- **Stress Tester**: Breaking point analysis and capacity planning
- **Performance Reporter**: Generate reports in HTML, JSON, Markdown, and CSV formats

## Installation

```bash
npm install @claudeflare/benchmark
```

## Quick Start

### Basic Benchmark

```typescript
import { benchmark } from '@claudeflare/benchmark';

const result = await benchmark('array-sort', () => {
  const data = Array.from({ length: 1000 }, () => Math.random());
  data.sort((a, b) => a - b);
});

console.log(`Mean: ${result.mean / 1000000}ms`);
console.log(`Ops/sec: ${result.ops.toFixed(0)}`);
```

### Benchmark Suite

```typescript
import { suite } from '@claudeflare/benchmark';

const benchmarks = [
  {
    name: 'object-creation',
    fn: () => ({ a: 1, b: 2, c: 3 })
  },
  {
    name: 'array-creation',
    fn: () => [1, 2, 3, 4, 5]
  }
];

const results = await suite(benchmarks, {
  iterations: 100,
  time: 1000
});

console.log(results.results);
```

### With Setup/Teardown

```typescript
import { BenchmarkRunner } from '@claudeflare/benchmark';

const runner = new BenchmarkRunner({
  iterations: 100,
  warmupIterations: 5
});

let data: number[] = [];

runner.addBenchmark({
  name: 'array-map',
  fn: () => data.map(x => x * 2),
  setup: () => {
    data = Array.from({ length: 1000 }, () => Math.random());
  },
  teardown: () => {
    data = [];
  }
});

const suite = await runner.run();
```

## Comparison and Regression Detection

### Simple Comparison

```typescript
import { compare } from '@claudeflare/benchmark';

const comparison = compare(baselineResult, currentResult);

console.log(`Verdict: ${comparison.verdict}`);
console.log(`Difference: ${comparison.difference.relative.toFixed(2)}%`);
console.log(`Speedup: ${comparison.difference.speedup.toFixed(2)}x`);
```

### Regression Detection

```typescript
import { detectRegression } from '@claudeflare/benchmark';

const result = detectRegression(baselineResult, currentResult, 0.05);

if (result.isRegression) {
  console.log('⚠️ Performance regression detected!');
} else {
  console.log('✓ No significant regression');
}
```

### Multiple Benchmark Comparison

```typescript
import { ComparisonEngine } from '@claudeflare/benchmark';

const engine = new ComparisonEngine();

const comparisons = engine.compareAll(baselineResults, currentResults);
const report = engine.generateReport(comparisons, 'my-report');

console.log(`Overall: ${report.summary.overallVerdict}`);
console.log(`Improvements: ${report.summary.improvements}`);
console.log(`Regressions: ${report.summary.regressions}`);
```

## Metrics Collection

### Collect Metrics During Execution

```typescript
import { collectMetricsDuring } from '@claudeflare/benchmark';

const { result, metrics } = await collectMetricsDuring(
  async () => {
    // Your code here
    await performOperation();
  },
  { interval: 100 }
);

console.log(`Memory used: ${metrics.memory.heapUsed} bytes`);
console.log(`Event loop lag: ${metrics.eventLoop.avgLag}ms`);
```

### Manual Metrics Collection

```typescript
import { MetricsCollector } from '@claudeflare/benchmark';

const collector = new MetricsCollector({
  memory: true,
  cpu: true,
  eventLoop: true,
  interval: 100
});

collector.start();

// Run your code
await performOperation();

collector.stop();

const metrics = await collector.getMetrics();
```

## Profiling

### CPU Profiling

```typescript
import { profileCpu } from '@claudeflare/benchmark';

const { result, profile } = await profileCpu(
  'my-function',
  async () => {
    // Your code here
    await complexOperation();
  },
  {
    flameGraph: true,
    callTree: true,
    outputDir: './profiles'
  }
);

console.log(`Hot path: ${profile.hotPath.map(n => n.name).join(' -> ')}`);
```

### Memory Profiling

```typescript
import { profileMemory } from '@claudeflare/benchmark';

const { result, profile } = await profileMemory(
  'my-function',
  async () => {
    // Your code here
    await processLargeDataset();
  },
  {
    outputDir: './profiles'
  }
);

console.log(`Peak memory: ${profile.peakMemory} bytes`);
console.log(`Memory leaks: ${profile.leaks.length}`);
```

## Load Testing

### Basic Load Test

```typescript
import { loadTest } from '@claudeflare/benchmark';

const result = await loadTest(
  'my-api',
  async () => {
    await fetch('https://api.example.com/data');
  },
  {
    initialConcurrency: 1,
    maxConcurrency: 100,
    concurrencyStep: 10,
    durationPerLevel: 5000
  }
);

console.log(`Peak ops/sec: ${result.statistics.peakOps}`);
console.log(`Max sustainable concurrency: ${result.statistics.maxSustainableConcurrency}`);
```

### Sustained Load Test

```typescript
import { sustainedLoadTest } from '@claudeflare/benchmark';

const result = await sustainedLoadTest(
  'sustained-test',
  async () => {
    await processRequest();
  },
  50,  // concurrency
  60000 // duration (1 minute)
);
```

## Stress Testing

### Basic Stress Test

```typescript
import { stressTest } from '@claudeflare/benchmark';

const result = await stressTest(
  'stress-test',
  async () => {
    await processRequest();
  },
  {
    startLoad: 10,
    loadIncrement: 10,
    maxLoad: 1000,
    durationPerLevel: 5000,
    stopAtBreakdown: true
  }
);

console.log(`Breakdown detected: ${result.breakdown.detected}`);
console.log(`Breakdown load: ${result.breakdown.loadLevel}`);
```

### Find Breaking Point

```typescript
import { findBreakingPoint } from '@claudeflare/benchmark';

const breakingPoint = await findBreakingPoint(
  'find-breakpoint',
  async () => {
    await processRequest();
  },
  10,    // start load
  1000   // max load
);

console.log(`Breaking point at: ${breakingPoint} req/sec`);
```

## Report Generation

### Generate Multiple Report Formats

```typescript
import { generateReport } from '@claudeflare/benchmark';

await generateReport(
  { suite: benchmarkSuite },
  {
    name: 'my-benchmark',
    format: ['html', 'json', 'markdown'],
    outputDir: './reports',
    includeComparison: true,
    theme: 'light'
  }
);
```

### HTML Report

```typescript
import { generateHtmlReport } from '@claudeflare/benchmark';

await generateHtmlReport(
  { suite: benchmarkSuite },
  './reports'
);
```

### JSON Report

```typescript
import { generateJsonReport } from '@claudeflare/benchmark';

await generateJsonReport(
  { suite: benchmarkSuite },
  './reports'
);
```

## CLI Usage

```bash
# Run benchmarks
claudeflare-benchmark run --file ./benchmarks.ts --output ./results

# Compare two runs
claudeflare-benchmark compare --baseline ./baseline.json --current ./current.json

# Run load test
claudeflare-benchmark load --file ./load-test.ts --concurrency 100

# Run stress test
claudeflare-benchmark stress --file ./stress-test.ts --max-load 1000

# Profile code
claudeflare-benchmark profile --file ./profile-target.ts --type cpu
```

## Configuration

### Benchmark Options

```typescript
interface BenchmarkOptions {
  warmupIterations: number;      // Number of warmup iterations (default: 5)
  iterations: number;             // Number of iterations (default: 100)
  time: number;                   // Minimum time in milliseconds (default: 1000)
  parallel: boolean;              // Run in parallel (default: false)
  concurrency: number;            // Number of parallel instances (default: 1)
  detailedMetrics: boolean;       // Collect detailed metrics (default: true)
  profiling: boolean;             // Generate profiling data (default: false)
  significanceThreshold: number;  // Statistical significance threshold (default: 0.95)
  maxRsd: number;                 // Maximum relative standard deviation (default: 5)
  removeOutliers: boolean;        // Remove outliers (default: true)
  outlierMethod: 'iqr' | 'zscore' | 'modified-zscore'; // Outlier detection method
  percentiles: number[];          // Percentiles to calculate (default: [50, 75, 90, 95, 99, 99.9])
}
```

### Metrics Collection Config

```typescript
interface MetricsCollectionConfig {
  memory: boolean;                // Collect memory metrics (default: true)
  cpu: boolean;                   // Collect CPU metrics (default: true)
  io: boolean;                    // Collect I/O metrics (default: false)
  gc: boolean;                    // Collect GC metrics (default: true)
  eventLoop: boolean;             // Collect event loop metrics (default: true)
  interval: number;               // Collection interval in milliseconds (default: 100)
  maxSamples: number;             // Maximum samples to keep (default: 10000)
}
```

## Statistical Analysis

The package provides comprehensive statistical analysis:

- **Mean, Median, Mode**: Central tendency measures
- **Standard Deviation, Variance**: Dispersion measures
- **Coefficient of Variation**: Relative variability
- **Percentiles**: Distribution analysis
- **Confidence Intervals**: Statistical confidence
- **Outlier Detection**: IQR, Z-score, Modified Z-score methods
- **Hypothesis Testing**: T-test, Mann-Whitney U test
- **Effect Size**: Cohen's d

## Best Practices

1. **Always use warmup**: Allow JIT compilation to optimize code
2. **Run sufficient iterations**: Ensure statistical significance
3. **Use setup/teardown**: Prepare test data consistently
4. **Remove outliers**: Exclude anomalous measurements
5. **Check RSD**: Low relative standard deviation indicates consistent results
6. **Profile bottlenecks**: Use profiling to identify optimization targets
7. **Test under load**: Verify performance at scale
8. **Monitor regressions**: Compare against baselines regularly
9. **Track trends**: Analyze performance over time
10. **Document findings**: Generate comprehensive reports

## License

MIT

## Contributing

Contributions are welcome! Please submit pull requests or open issues on GitHub.
