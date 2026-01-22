# Performance Optimization Quick Reference

## Performance Targets

| Metric | Target | Excellent | Acceptable |
|--------|--------|-----------|------------|
| Cold Start | <100ms | <50ms | <150ms |
| Hot Path | <50ms | <25ms | <75ms |
| Cache Hit Rate | >90% | >95% | >80% |
| Bundle Size | <3MB | <1.5MB | <4MB |
| Memory Usage | <128MB | <100MB | <140MB |

## Quick Start

### 1. Enable Optimizations in Main App

```typescript
import { getOptimizer, getPerformanceTracker } from './optimizations';

let optimizer: any = null;
let tracker: any = null;

app.use('*', async (c, next) => {
  if (!optimizer) {
    optimizer = getOptimizer();
    await optimizer.initProviders(c.env);

    tracker = getPerformanceTracker();
  }

  const endTimer = tracker.startTimer('request');
  await next();
  endTimer();
});
```

### 2. Use Multi-Level Cache

```typescript
import { MultiLevelCache } from './optimizations';

const cache = new MultiLevelCache(env.KV, doState, {
  l1MaxEntries: 1000,
  l1MaxSize: 10 * 1024 * 1024,
});

// Get (auto-promotes between tiers)
const value = await cache.get('key');

// Set (stores in all tiers)
await cache.set('key', value, { ttl: 3600 });

// Get stats
const stats = cache.getStats();
```

### 3. Track Performance

```typescript
import { getPerformanceTracker } from './optimizations';

const tracker = getPerformanceTracker();

// Track latency
const endTimer = tracker.startTimer('operation');
// ... do work ...
endTimer();

// Get histogram
const hist = tracker.getHistogram('operation.latency');
console.log(`P95: ${hist.percentiles.p95}ms`);

// Export metrics
const prometheus = tracker.exportMetrics('prometheus');
```

### 4. Parallel Execution

```typescript
import { ParallelExecutor } from './optimizations';

const executor = new ParallelExecutor();

// Execute in parallel
const results = await executor.parallel([
  () => op1(),
  () => op2(),
  () => op3(),
]);

// Race providers
const fastest = await executor.raceProviders(
  providers,
  request,
  { timeout: 30000 }
);
```

### 5. Memory Management

```typescript
import { DOMemoryManager } from './optimizations';

class MyDO {
  private memory: DOMemoryManager;

  constructor(state, env) {
    this.memory = new DOMemoryManager(state, {
      maxMemory: 128 * 1024 * 1024,
      evictionStrategy: 'adaptive',
    });
  }

  async get(key) {
    return await this.memory.get(key);
  }

  async set(key, value) {
    await this.memory.set(key, value, { priority: 1 });
  }
}
```

### 6. KV Compression

```typescript
import { setCompressed, getCompressed } from './optimizations';

// Set compressed
await setCompressed(env.KV, 'key', largeData, {
  expirationTtl: 3600,
});

// Get decompressed
const data = await getCompressed<MyType>(env.KV, 'key');
```

## Optimization Presets

### Maximum Performance
```typescript
import { optimizationPresets } from './optimizations';
const config = optimizationPresets.maxPerformance;
```
- L1: 5000 entries, 50MB
- L2: 50000 entries, 100MB
- Parallel providers: Yes
- Prefetch models: Yes

### Balanced (Default)
```typescript
const config = optimizationPresets.balanced;
```
- L1: 1000 entries, 10MB
- L2: 10000 entries, 50MB
- Parallel providers: Yes
- Prefetch models: Yes

### Minimal Memory
```typescript
const config = optimizationPresets.minMemory;
```
- L1: 100 entries, 1MB
- L2: 1000 entries, 5MB
- Parallel providers: No
- Prefetch models: No

## Benchmark Commands

```bash
# Full benchmark suite
npm run benchmark

# Quick benchmark
npm run benchmark:quick

# Performance report
npm run benchmark:report
```

## Common Patterns

### Lazy Load Providers
```typescript
const { lazyLoadProvider } = await import('./optimizations');
const providerLoader = lazyLoadProvider('groq');
const Provider = await providerLoader();
const provider = new Provider();
```

### Cache Warming
```typescript
const warmKeys = ['key1', 'key2', 'key3'];
await Promise.all(
  warmKeys.map(key => cache.get(key)) // Triggers promotion
);
```

### Batch Operations
```typescript
const { BatchCompressor } = await import('./optimizations');
const compressor = new BatchCompressor(env.KV, 100);
await compressor.compressBatch(items);
```

## Performance Monitoring

### Track Custom Metrics
```typescript
tracker.trackMetric('custom.metric', value, 'ms', { tag: 'value' });
tracker.trackMemoryUsage(used, total);
tracker.trackCacheHitRate(hitRate, 'l1');
tracker.trackBundleSize(size, 'vendor');
```

### Get Statistics
```typescript
const summary = tracker.getSummary();
console.log(`Total metrics: ${summary.totalMetrics}`);
console.log(`Total alerts: ${summary.totalAlerts}`);
```

### Export Metrics
```typescript
// JSON format
const json = tracker.exportMetrics('json');

// Prometheus format
const prometheus = tracker.exportMetrics('prometheus');
```

## Troubleshooting

### High Cold Start Time
- Check provider initialization time
- Enable parallel provider loading
- Lazy load rarely used providers

### Low Cache Hit Rate
- Increase L1 cache size
- Preload frequently accessed keys
- Check TTL settings

### High Memory Usage
- Check for memory leaks
- Enable compression
- Adjust eviction strategy
- Monitor DO memory stats

### Slow Hot Path
- Check cache hit rate
- Enable parallel execution
- Profile with performance tracker
- Check for blocking operations

## File Structure

```
packages/edge/optimizations/
├── index.ts                    # Main exports
├── bundle.config.ts            # Bundle optimization
├── cold-start.ts              # Cold start optimization
├── memory-manager.ts          # DO memory management
├── parallel-executor.ts       # Parallel execution
├── multi-level-cache.ts       # Multi-tier cache
├── performance-tracker.ts     # Performance tracking
├── kv-compression.ts          # KV compression
├── benchmarks.ts              # Benchmark suite
└── README.md                  # Full documentation
```

## Performance Checklist

- [ ] Enable lazy initialization
- [ ] Use multi-level cache
- [ ] Enable KV compression
- [ ] Track performance metrics
- [ ] Run benchmarks regularly
- [ ] Monitor memory usage
- [ ] Use parallel execution
- [ ] Warm up cache on startup
- [ ] Validate bundle size
- [ ] Check cache hit rate

## Next Steps

1. **Integrate**: Add optimizations to main app
2. **Configure**: Choose optimization preset
3. **Monitor**: Set up performance tracking
4. **Benchmark**: Run initial benchmarks
5. **Iterate**: Tune based on metrics
