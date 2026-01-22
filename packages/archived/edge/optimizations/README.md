# Performance Optimization Suite

Comprehensive performance optimization utilities for ClaudeFlare Edge API.

## Performance Targets

- **Cold Start**: <100ms (target: <50ms)
- **Hot Path**: <50ms (target: <25ms)
- **Cache Hit Rate**: >90% (target: >95%)
- **Bundle Size**: <3MB (target: <1.5MB)
- **Memory Usage**: <128MB per DO (target: <100MB)

## Features

### 1. Bundle Optimization (`bundle.config.ts`)

Advanced tree-shaking and code splitting configuration for optimal bundle size.

```typescript
import {
  createEsbuildBuildOptions,
  analyzeBundle,
  validateBundleSize,
} from './optimizations/bundle.config';

// Create optimized build
const buildOptions = createEsbuildBuildOptions({
  minify: true,
  treeShaking: true,
  sourceMap: false,
});

// Analyze bundle
const analysis = analyzeBundle(metafile);
validateBundleSize(analysis);
```

**Features**:
- Manual code splitting by route and provider
- Tree-shaking for dead code elimination
- Bundle size validation
- Chunk size optimization

### 2. Cold Start Optimization (`cold-start.ts`)

Lazy initialization strategies to minimize cold start time.

```typescript
import {
  ColdStartOptimizer,
  initializeOnRequest,
  getOptimizer,
} from './optimizations/cold-start';

// Initialize on first request
const optimizer = getOptimizer();
await initializeOnRequest(env, optimizer);

// Or create custom optimizer
const customOptimizer = new ColdStartOptimizer({
  parallelProviders: true,
  prefetchModels: true,
  warmConnections: true,
  lazyCache: true,
});
```

**Features**:
- Lazy provider initialization
- Parallel provider loading
- Connection warming
- Model prefetching
- Cache warming

### 3. Memory Management (`memory-manager.ts`)

Advanced memory management for Durable Objects.

```typescript
import { DOMemoryManager } from './optimizations/memory-manager';

// Create memory manager for DO
class MyDO {
  private memoryManager: DOMemoryManager;

  constructor(state: DurableObjectState, env: Env) {
    this.memoryManager = new DOMemoryManager(state, {
      maxMemory: 128 * 1024 * 1024, // 128MB
      warningThreshold: 0.8,
      evictionStrategy: 'adaptive',
    });
  }

  async get(key: string) {
    return await this.memoryManager.get(key);
  }

  async set(key: string, value: any) {
    await this.memoryManager.set(key, value, { priority: 1 });
  }
}
```

**Features**:
- LRU eviction
- Adaptive eviction strategies
- Memory usage monitoring
- Automatic compression
- LRU cache implementation

### 4. Parallel Execution (`parallel-executor.ts`)

High-performance concurrent execution utilities.

```typescript
import {
  ParallelExecutor,
  parallelMap,
  parallelExecutor,
} from './optimizations/parallel-executor';

// Execute operations in parallel
const executor = new ParallelExecutor();
const results = await executor.parallel([
  () => provider1.chat(request),
  () => provider2.chat(request),
  () => provider3.chat(request),
]);

// Race providers
const fastest = await executor.raceProviders(
  providers,
  request,
  { timeout: 30000 }
);

// Parallel map with concurrency limit
const processed = await parallelMap(
  items,
  processor,
  10 // concurrency limit
);
```

**Features**:
- Parallel execution with concurrency limits
- Timeout management
- Provider racing
- Fallback strategies
- Batch processing
- Retry logic

### 5. Multi-Level Cache (`multi-level-cache.ts`)

Three-tier caching system for optimal performance.

```typescript
import { MultiLevelCache } from './optimizations/multi-level-cache';

// Create cache with KV and DO
const cache = new MultiLevelCache(
  env.CACHE_KV,
  doState,
  {
    l1MaxEntries: 1000,
    l1MaxSize: 10 * 1024 * 1024, // 10MB
    l2MaxEntries: 10000,
    l2MaxSize: 50 * 1024 * 1024, // 50MB
    l3DefaultTTL: 60 * 60 * 24 * 7, // 7 days
  }
);

// Get from cache (auto-promotes between tiers)
const value = await cache.get('key');

// Set in cache (stores in all tiers)
await cache.set('key', value, { ttl: 3600 });

// Get statistics
const stats = cache.getStats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
```

**Features**:
- L1: In-memory cache (<1ms)
- L2: DO memory (<1ms)
- L3: KV storage (1-50ms)
- Automatic promotion/demotion
- LRU eviction at each tier
- Compression for L3
- Cache warming

### 6. Performance Tracking (`performance-tracker.ts`)

Comprehensive performance monitoring and metrics collection.

```typescript
import {
  PerformanceTracker,
  measurePerformance,
  validatePerformance,
} from './optimizations/performance-tracker';

// Create tracker
const tracker = new PerformanceTracker({
  enabled: true,
  sampleRate: 1.0,
  thresholds: {
    coldStartMs: 100,
    hotPathMs: 50,
    memoryUsagePercentage: 90,
    cacheHitRate: 0.9,
  },
});

// Track latency
const endTimer = tracker.startTimer('operation');
// ... do work ...
endTimer();

// Or use measurePerformance
const result = await measurePerformance(
  'operation',
  async () => {
    return await doWork();
  },
  tracker
);

// Get statistics
const histogram = tracker.getHistogram('operation.latency');
console.log(`P95: ${histogram.percentiles.p95}ms`);

// Export metrics
const prometheus = tracker.exportMetrics('prometheus');

// Validate against targets
const validation = validatePerformance(tracker);
```

**Features**:
- Real-time metrics collection
- Histogram-based statistics (P50, P90, P95, P99)
- Alert generation
- Prometheus export
- Performance validation
- Automatic cleanup

### 7. KV Compression (`kv-compression.ts`)

Advanced compression utilities for KV storage.

```typescript
import {
  KVCompression,
  setCompressed,
  getCompressed,
  createKVCompression,
} from './optimizations/kv-compression';

// Create compression wrapper
const compression = createKVCompression(env.CACHE_KV, {
  enabled: true,
  threshold: 1024, // 1KB
  trackMetadata: true,
});

// Set compressed value
await compression.set('key', largeData, {
  expirationTtl: 3600,
});

// Get decompressed value
const data = await compression.get<Data>('key');

// Helper functions
await setCompressed(env.CACHE_KV, 'key', data);
const value = await getCompressed<Data>(env.CACHE_KV, 'key');

// Get statistics
const stats = compression.getStats();
console.log(`Compression ratio: ${stats.compressionRatio}x`);
console.log(`Bytes saved: ${stats.totalBytesSaved}`);
```

**Features**:
- Automatic gzip compression
- Metadata tracking
- Batch operations
- Compression ratio tracking
- Cost savings calculation

### 8. Benchmark Suite (`benchmarks.ts`)

Comprehensive benchmark suite for validation.

```typescript
import {
  BenchmarkSuite,
  runBenchmarks,
  quickBenchmark,
  createPerformanceReport,
} from './optimizations/benchmarks';

// Run full benchmark suite
const results = await runBenchmarks({
  iterations: 10,
  warmupIterations: 3,
  detailedMetrics: true,
});

console.log(results.passed ? 'PASSED' : 'FAILED');
console.log(results.recommendations);

// Quick benchmark
const quick = await quickBenchmark();
console.log(`Cold start: ${quick.coldStart}ms`);
console.log(`Hot path: ${quick.hotPath}ms`);

// Generate report
const report = createPerformanceReport(results);
console.log(report);
```

**Features**:
- Cold start benchmark
- Hot path benchmark
- Cache performance benchmark
- Memory usage benchmark
- Bundle size benchmark
- Parallel execution benchmark
- Performance recommendations

## Usage Examples

### Basic Setup

```typescript
import { Hono } from 'hono';
import {
  getOptimizer,
  getPerformanceTracker,
  createMultiLevelCache,
} from './optimizations';

const app = new Hono();

// Initialize on first request
app.use('*', async (c, next) => {
  const optimizer = getOptimizer();
  await optimizer.initProviders(c.env);

  const tracker = getPerformanceTracker();
  const endTimer = tracker.startTimer('request');

  await next();
  endTimer();
});
```

### Advanced Setup with All Optimizations

```typescript
import {
  optimizationPresets,
  initializeOptimizations,
} from './optimizations';

// Use preset configuration
const { cache, tracker, coldStart, executor } = initializeOptimizations('maxPerformance');

// Or custom configuration
const custom = initializeOptimizations();
custom.cache = new MultiLevelCache(env.KV, doState, {
  l1MaxEntries: 5000,
  l1MaxSize: 50 * 1024 * 1024,
  enableCompression: true,
});
```

## Validation

Run the benchmark suite to validate performance:

```bash
# Run full benchmark suite
npm run benchmark

# Run quick benchmark
npm run benchmark:quick

# Generate performance report
npm run benchmark:report
```

Expected results:
- Cold start: <100ms
- Hot path: <50ms
- Cache hit rate: >90%
- Bundle size: <3MB
- Memory: <128MB per DO

## Optimization Presets

### Maximum Performance
Higher memory usage, maximum speed.

```typescript
import { optimizationPresets } from './optimizations';

const config = optimizationPresets.maxPerformance;
```

### Balanced
Balanced performance and memory usage (default).

```typescript
const config = optimizationPresets.balanced;
```

### Minimal Memory
Minimal memory usage, slightly slower.

```typescript
const config = optimizationPresets.minMemory;
```

## Performance Tips

1. **Enable Lazy Loading**: Use lazy imports for rarely used code
2. **Warm Up Cache**: Preload frequently accessed cache entries
3. **Monitor Metrics**: Track performance metrics in production
4. **Run Benchmarks**: Regularly validate performance against targets
5. **Use Parallel Execution**: Parallelize independent operations
6. **Enable Compression**: Compress large data in KV storage
7. **Monitor Memory**: Track DO memory usage to avoid evictions

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare Worker                        │
├─────────────────────────────────────────────────────────────┤
│  L1 Cache (In-Memory)          │  L2 Cache (DO Memory)      │
│  - 1000 entries                │  - 10000 entries            │
│  - 10MB                        │  - 50MB                     │
│  - Sub-microsecond             │  - Sub-millisecond          │
├─────────────────────────────────────────────────────────────┤
│  L3 Cache (KV)                 │  Providers (Lazy Loaded)    │
│  - Unlimited entries           │  - Cloudflare AI            │
│  - 1-50ms latency              │  - Groq                     │
│  - 7-day TTL                   │  - Cerebras                 │
│                                │  - OpenRouter               │
├─────────────────────────────────────────────────────────────┤
│  Performance Tracker           │  Memory Manager             │
│  - Latency metrics             │  - LRU eviction             │
│  - Percentiles                 │  - Compression              │
│  - Alerts                      │  - 128MB limit              │
└─────────────────────────────────────────────────────────────┘
```

## License

MIT
