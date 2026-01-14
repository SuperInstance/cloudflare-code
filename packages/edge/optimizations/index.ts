/**
 * Performance Optimization Suite
 *
 * Comprehensive optimization utilities for ClaudeFlare Edge API.
 * Target: Sub-100ms cold starts, sub-50ms hot path, 90%+ cache hit rate.
 *
 * @module optimizations
 */

// Bundle optimization
export {
  createEsbuildBuildOptions,
  analyzeBundle,
  printBundleAnalysis,
  validateBundleSize,
  lazyLoadProvider,
  getPreloadOrder,
  bundleSizeThresholds,
  type BundleOptimizationConfig,
  type BundleAnalysis,
  type ChunkConfig,
  type CodeSplittingConfig,
} from './bundle.config';

// Cold start optimization
export {
  ColdStartOptimizer,
  CacheWarmer,
  ConnectionPool,
  getOptimizer,
  initializeOnRequest,
  prefetchIdle,
  createInitMiddleware,
  measureColdStart,
  coldStartTargets,
  type InitializationState,
  type LazyInitOptions,
} from './cold-start';

// Memory management
export {
  DOMemoryManager,
  LRUCache,
  MemoryPool,
  type MemoryStats,
  type MemoryEntry,
  type MemoryManagerConfig,
  type EvictionStrategy,
} from './memory-manager';

// Parallel execution
export {
  ParallelExecutor,
  ConcurrencyLimiter,
  parallelFetch,
  parallelMap,
  parallelFilter,
  createParallelExecutor,
  parallelExecutor,
  type ParallelOptions,
  type ParallelResult,
  type BatchOptions,
} from './parallel-executor';

// Multi-level cache
export {
  MultiLevelCache,
  createMultiLevelCache,
  type CacheEntry,
  type CacheConfig,
  type CacheStats,
} from './multi-level-cache';

// Performance tracking
export {
  PerformanceTracker,
  getPerformanceTracker,
  measurePerformance,
  createPerformanceMiddleware,
  validatePerformance,
  performanceTargets,
  type PerformanceMetric,
  type PerformanceHistogram,
  type PerformanceAlert,
  type PerformanceTrackerConfig,
} from './performance-tracker';

// KV compression
export {
  KVCompression,
  BatchCompressor,
  setCompressed,
  getCompressed,
  createKVCompression,
  estimateKVSavings,
  compressionPresets,
  type CompressionMetadata,
  type CompressionOptions,
} from './kv-compression';

// Benchmarks
export {
  BenchmarkSuite,
  runBenchmarks,
  quickBenchmark,
  createPerformanceReport,
  type BenchmarkResult,
  type BenchmarkSuiteResults,
  type BenchmarkConfig,
} from './benchmarks';

/**
 * Optimization presets
 */
export const optimizationPresets = {
  /** Maximum performance (higher memory usage) */
  maxPerformance: {
    l1MaxEntries: 5000,
    l1MaxSize: 50 * 1024 * 1024, // 50MB
    l2MaxEntries: 50000,
    l2MaxSize: 100 * 1024 * 1024, // 100MB
    enableCompression: true,
    parallelProviders: true,
    prefetchModels: true,
    warmConnections: true,
  },

  /** Balanced performance and memory */
  balanced: {
    l1MaxEntries: 1000,
    l1MaxSize: 10 * 1024 * 1024, // 10MB
    l2MaxEntries: 10000,
    l2MaxSize: 50 * 1024 * 1024, // 50MB
    enableCompression: true,
    parallelProviders: true,
    prefetchModels: true,
    warmConnections: false,
  },

  /** Minimal memory usage */
  minMemory: {
    l1MaxEntries: 100,
    l1MaxSize: 1024 * 1024, // 1MB
    l2MaxEntries: 1000,
    l2MaxSize: 5 * 1024 * 1024, // 5MB
    enableCompression: true,
    parallelProviders: false,
    prefetchModels: false,
    warmConnections: false,
  },
};

/**
 * Initialize all optimizations with preset
 */
export function initializeOptimizations(
  preset: keyof typeof optimizationPresets = 'balanced'
): {
  cache: MultiLevelCache;
  tracker: PerformanceTracker;
  coldStart: ColdStartOptimizer;
  executor: ParallelExecutor;
} {
  const config = optimizationPresets[preset];

  // These would be initialized with actual env in production
  // This is a factory function for setup
  return {
    cache: null as any, // Would be initialized with KV
    tracker: new PerformanceTracker({ enabled: true }),
    coldStart: new ColdStartOptimizer(config),
    executor: new ParallelExecutor(),
  };
}

/**
 * Performance targets summary
 */
export const PERFORMANCE_TARGETS = {
  coldStart: '<100ms',
  hotPath: '<50ms',
  cacheHitRate: '>90%',
  bundleSize: '<3MB',
  memoryUsage: '<128MB per DO',
  throughput: '>20 req/sec',
} as const;
