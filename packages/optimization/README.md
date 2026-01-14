# @claudeflare/optimization

Advanced performance optimization suite for the ClaudeFlare platform. This package provides comprehensive tools for bundle optimization, runtime tuning, memory optimization, network optimization, caching strategies, and performance regression detection.

## Features

### Bundle Optimization
- **Bundle Size Analysis**: Analyze bundle size, dependencies, and generate optimization recommendations
- **Code Splitting**: Intelligent route-based, component-based, and vendor chunk splitting
- **Tree Shaking**: Detect and eliminate dead code for optimal bundle sizes
- **Compression Analysis**: Analyze gzip and brotli compression ratios

### Runtime Performance
- **Function Profiling**: Profile function execution times and identify hot paths
- **Memoization**: Automatic memoization of frequently called functions
- **Debouncing/Throttling**: Built-in debounce and throttle utilities
- **Optimization Suggestions**: AI-powered optimization recommendations

### Memory Optimization
- **Memory Profiling**: Capture and analyze memory snapshots
- **Leak Detection**: Automatic detection of memory leaks
- **Object Pooling**: Generic object pool implementation for memory optimization
- **Cache Management**: Optimized cache with memory limits

### Network Optimization
- **Request Batching**: Automatic batching of network requests
- **Connection Pooling**: HTTP connection pooling for reduced latency
- **Compression**: Request/response compression optimization
- **Retry Logic**: Configurable retry with exponential backoff

### Caching Strategies
- **Multi-Level Caching**: L1/L2/L3 cache hierarchy
- **Multiple Strategies**: LRU, LFU, FIFO, TTL, and Hybrid caching
- **Cache Warming**: Automatic cache warming on startup
- **Hit Rate Optimization**: Intelligent cache size tuning

### Performance Regression
- **Baseline Management**: Create and manage performance baselines
- **Regression Detection**: Automatic detection of performance regressions
- **Alerting**: Configurable alerts on performance degradation
- **Historical Analysis**: Track performance trends over time

## Installation

```bash
npm install @claudeflare/optimization
```

## Quick Start

### Bundle Analysis

```typescript
import { BundleAnalyzer } from '@claudeflare/optimization/bundle';

const analyzer = new BundleAnalyzer();
const result = await analyzer.analyzeBundle('./dist/bundle.js');
console.log(analyzer.generateReport(result));
```

### Runtime Optimization

```typescript
import { RuntimeOptimizer } from '@claudeflare/optimization/runtime';

const optimizer = new RuntimeOptimizer();

// Profile and optimize a function
const optimizedFn = optimizer.optimizeFunction(myFunction, {
  name: 'myFunction',
  memoize: true,
});

// Memoize a function
const memoized = optimizer.getProfiler().memoize(expensiveFunction);
```

### Memory Optimization

```typescript
import { MemoryOptimizer } from '@claudeflare/optimization/memory';

const optimizer = new MemoryOptimizer();

// Create object pool
const pool = optimizer.createPool(
  'buffer',
  () => new Uint8Array(1024),
  (buf) => buf.fill(0)
);

const buffer = pool.acquire();
// Use buffer...
pool.release(buffer);

// Analyze memory
const analysis = await optimizer.analyze();
console.log(analysis.leaks);
```

### Network Optimization

```typescript
import { NetworkOptimizer } from '@claudeflare/optimization/network';

const optimizer = new NetworkOptimizer({
  requestBatching: true,
  batchSize: 10,
  batchTimeout: 100,
});

// Batch requests
const result = await optimizer.batchRequest({
  id: '1',
  url: '/api/data',
  method: 'GET',
  priority: 1,
});
```

### Caching Optimization

```typescript
import { CachingOptimizer } from '@claudeflare/optimization/caching';

const optimizer = new CachingOptimizer();

// Create cache
const cache = optimizer.createCache('data', {
  strategy: 'lru',
  maxSize: 1000,
  ttl: 60000,
});

cache.set('key', { data: 'value' });
const data = cache.get('key');
```

### Performance Regression

```typescript
import { RegressionDetector } from '@claudeflare/optimization/regression';

const detector = new RegressionDetector();

// Create baseline
const baseline = detector.createBaseline('main', {
  cpu: 0.4,
  memory: 80 * 1024 * 1024,
  latency: { p50: 40, p95: 80, p99: 120 },
  throughput: 1200,
  bundleSize: { main: 450 * 1024, gzip: 140 * 1024, brotli: 110 * 1024 },
});
await detector.saveBaseline(baseline);

// Check for regressions
const result = detector.compare('main', currentMetrics);
```

## CLI Usage

```bash
# Analyze bundle
claudeflare-optimize bundle ./dist/bundle.js -o report.md

# Profile runtime performance
claudeflare-optimize profile --duration 60000 -o runtime-report.md

# Analyze memory
claudeflare-optimize memory --snapshots 10 --interval 5000 -o memory-report.md

# Create baseline
claudeflare-optimize baseline v1.0.0 --commit abc123

# Check for regressions
claudeflare-optimize regression v1.0.0 --metrics current.json

# Run full analysis
claudeflare-optimize analyze --output ./reports
```

## Configuration

### Bundle Configuration

```typescript
const bundleConfig: BundleConfig = {
  entryPoints: ['./src/index.ts'],
  outputPath: './dist',
  format: 'esm',
  target: 'es2022',
  minify: true,
  sourceMap: true,
  splitting: true,
  treeshake: true,
  compression: {
    gzip: true,
    brotli: true,
    level: 9,
  },
  codeSplitting: {
    strategy: 'mixed',
    manualChunks: {},
    minChunkSize: 20 * 1024,
    maxChunkSize: 244 * 1024,
  },
};
```

### Runtime Configuration

```typescript
const runtimeConfig: RuntimeOptimizationConfig = {
  enableProfiling: true,
  enableMemoization: true,
  enableDebouncing: true,
  enableThrottling: true,
  hotPathThreshold: 100,
  memoizationCacheSize: 1000,
  debounceWait: 100,
  throttleWait: 16,
};
```

### Memory Configuration

```typescript
const memoryConfig: MemoryConfig = {
  poolSize: 100,
  maxPoolSize: 1000,
  gcThreshold: 0.8,
  leakDetectionEnabled: true,
  profilingEnabled: true,
  snapshotInterval: 60000,
};
```

### Network Configuration

```typescript
const networkConfig: NetworkConfig = {
  requestBatching: true,
  batchSize: 10,
  batchTimeout: 100,
  connectionPooling: true,
  maxConnections: 100,
  http2: true,
  compression: true,
  cachingEnabled: true,
  retryAttempts: 3,
  retryDelay: 1000,
};
```

### Cache Configuration

```typescript
const cacheConfig: CacheConfig = {
  strategy: 'lru',
  maxSize: 1000,
  ttl: 60000,
  maxMemory: 100 * 1024 * 1024,
  compressionEnabled: false,
  persistEnabled: false,
  statsEnabled: true,
};
```

## Performance Budgets

Define performance budgets to catch regressions early:

```typescript
const budget: PerformanceBudget = {
  maxBundleSize: 500 * 1024,      // 500KB
  maxChunkSize: 244 * 1024,       // 244KB
  maxGzipSize: 150 * 1024,        // 150KB
  maxLoadTime: 3000,              // 3s
  maxMemoryUsage: 100 * 1024 * 1024,  // 100MB
};
```

## Integration with CI/CD

```yaml
# .github/workflows/performance.yml
name: Performance Check

on: [pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build
      - run: npx claudeflare-optimize regression main --metrics metrics.json
```

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Support

For issues and questions, please use the GitHub issue tracker.
