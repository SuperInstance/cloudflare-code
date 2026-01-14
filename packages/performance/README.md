# @claudeflare/performance

Comprehensive performance monitoring, benchmarking, and optimization toolkit for ClaudeFlare and Cloudflare Workers.

## Features

- **Performance Profiling**: CPU, memory, and event loop profiling with Chrome DevTools integration
- **Load Testing**: High-performance load testing framework with autocannon
- **Benchmarking**: Comprehensive benchmark suite with 50+ predefined benchmarks
- **Optimization Analysis**: Automatic detection of performance anti-patterns and optimization recommendations
- **Regression Detection**: Automated performance regression detection with baseline management
- **Reporting**: Beautiful reports in JSON, Markdown, and HTML formats

## Installation

```bash
npm install @claudeflare/performance
```

## Quick Start

### Benchmarking

```typescript
import { BenchmarkRunner, BenchmarkSuites } from '@claudeflare/performance';

const runner = new BenchmarkRunner();
runner.registerSuites(BenchmarkSuites.getAll());
await runner.runAll();
```

### Load Testing

```typescript
import { LoadTestRunner, LoadTestScenarios } from '@claudeflare/performance';

const runner = new LoadTestRunner();
const result = await runner.runTest(
  LoadTestScenarios.standardApi('https://api.example.com')
);
```

### Performance Profiling

```typescript
import { PerformanceProfiler } from '@claudeflare/performance';

const profiler = new PerformanceProfiler();
profiler.start();

// Your code here
await myFunction();

profiler.stop();
const summary = profiler.getSummary();
console.log(summary);
```

### Optimization Analysis

```typescript
import { PerformanceAnalyzer } from '@claudeflare/performance';

const analyzer = new PerformanceAnalyzer();
const recommendations = analyzer.analyzeMetrics(metrics);
console.log(analyzer.generateReport(metrics));
```

## CLI Tools

### Benchmark Runner

```bash
# Run all benchmarks
claudeflare-bench run

# Run specific suite
claudeflare-bench run --suite string-operations

# Compare two runs
claudeflare-bench compare baseline.json current.json

# List available suites
claudeflare-bench list
```

### Load Testing

```bash
# Run load test
claudeflare-loadtest run --url https://api.example.com

# Use predefined scenario
claudeflare-loadtest run --url https://api.example.com --scenario high-throughput

# Custom configuration
claudeflare-loadtest run \
  --url https://api.example.com \
  --connections 1000 \
  --duration 60 \
  --method POST
```

### Performance Profiling

```bash
# Analyze metrics file
claudeflare-profile analyze --file metrics.json

# Profile a worker function
claudeflare-profile worker ./worker.ts

# Check code for anti-patterns
claudeflare-profile check ./src
```

### Regression Detection

```bash
# Create baseline
claudeflare-regression create-baseline \
  --name main \
  --benchmarks results.json

# Check for regressions
claudeflare-regression check \
  --name main \
  --benchmarks current-results.json

# View trends
claudeflare-regression trend \
  --name main \
  --metric "benchmark.string-operations.avgTime"
```

## Performance Targets

### Latency Targets

| Metric | Target |
|--------|--------|
| Cold Start | <100ms |
| Hot Path | <50ms |
| API Response | <500ms |
| WebSocket Message | <10ms |

### Throughput Targets

| Metric | Target |
|--------|--------|
| Requests/Second | 10,000+ |
| Concurrent Connections | 1,000+ |
| WebSocket Messages | 100,000+ |

### Resource Targets

| Metric | Target |
|--------|--------|
| CPU Usage | <50% average |
| Memory per DO | <128MB |
| Bundle Size | <3MB |

## Benchmark Suites

The package includes 50+ predefined benchmarks:

- **String Operations**: Concatenation, splitting, replacement, etc.
- **JSON Operations**: Parsing and stringification
- **Array Operations**: Map, filter, reduce, find, etc.
- **Data Structures**: Map vs Object, Set operations
- **Async Operations**: Promises, async/await
- **Cryptography**: SHA-256, SHA-384, SHA-512
- **Compression**: Gzip, deflate
- **Encoding**: Base64, UTF-8
- **Regular Expressions**: Pattern matching
- **Memory**: Allocation and copying
- **Worker Operations**: Request/response handling

## Load Test Scenarios

Predefined scenarios for common use cases:

- `standard-api`: Standard API endpoint testing
- `high-throughput`: High throughput with many concurrent connections
- `websocket`: WebSocket streaming test
- `cold-start`: Cold start performance
- `memory-stress`: Memory stress testing
- `r2-storage`: R2 storage operations
- `kv-storage`: KV storage reads
- `durable-object`: Durable Object operations
- `concurrent-connections`: High concurrent connections
- `spike-test`: Sudden traffic spike
- `endurance-test`: Long duration testing

## Optimization Recommendations

The analyzer can detect and recommend fixes for:

- Memory leaks (event listeners, timers, closures)
- CPU usage issues (nested loops, blocking operations)
- Event loop blocking (synchronous I/O, heavy computation)
- Caching opportunities (repeated expensive operations)
- Network optimization (sequential vs parallel requests)
- Database queries (N+1 problems)
- Code quality issues (inefficient patterns)

## CI/CD Integration

### GitHub Actions

```yaml
name: Performance Tests

on: [push, pull_request]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run bench -- --ci
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: benchmark-results
          path: results/

  regression-check:
    runs-on: ubuntu-latest
    needs: benchmark
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - name: Check regressions
        run: npm run regression-check
        env:
          GIT_SHA: ${{ github.sha }}
```

## Configuration

### Environment Variables

- `PERFORMANCE_OUTPUT_DIR`: Output directory for results (default: `./results`)
- `PERFORMANCE_BASELINE_DIR`: Baseline storage path (default: `./baselines`)
- `PERFORMANCE_CI`: Set to `true` for CI mode

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

## API Reference

### PerformanceProfiler

```typescript
import { PerformanceProfiler } from '@claudeflare/performance';

const profiler = new PerformanceProfiler({
  enabled: true,
  sampleInterval: 10,
  maxSamples: 10000,
  includeStackTrace: true,
  includeMemorySnapshot: true,
});

profiler.start();
// ... code to profile ...
profiler.stop();

const summary = profiler.getSummary();
const snapshots = profiler.getSnapshots();
const profile = profiler.exportProfile();
```

### BenchmarkRunner

```typescript
import { BenchmarkRunner } from '@claudeflare/performance';

const runner = new BenchmarkRunner();

runner.registerSuite({
  name: 'my-suite',
  description: 'My benchmark suite',
  benchmarks: [
    {
      name: 'my-benchmark',
      fn: () => {
        // Code to benchmark
      },
    },
  ],
});

const results = await runner.runSuite('my-suite');
```

### LoadTestRunner

```typescript
import { LoadTestRunner } from '@claudeflare/performance';

const runner = new LoadTestRunner();

const result = await runner.runTest({
  name: 'my-test',
  target: 'https://api.example.com',
  method: 'GET',
  connections: 100,
  duration: 30,
  pipelining: 1,
  timeout: 10,
  requests: {},
  expectations: {
    maxLatency: 500,
    minThroughput: 100,
    maxErrorRate: 1,
  },
});
```

## Performance Dashboard

Import the Grafana dashboard from `dashboards/performance.json` for real-time monitoring:

```bash
# Import via Grafana CLI
grafana-cli import-dashboard dashboards/performance.json
```

Or manually import through the Grafana UI.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT

## Support

- GitHub Issues: https://github.com/claudeflare/claudeflare/issues
- Documentation: https://docs.claudeflare.com
- Discord: https://discord.gg/claudeflare
