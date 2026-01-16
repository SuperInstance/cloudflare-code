// @ts-nocheck
/**
 * ClaudeFlare Optimization Package
 *
 * Comprehensive performance optimization toolkit for ClaudeFlare platform
 * including bundle optimization, runtime tuning, memory optimization,
 * network optimization, caching strategies, and regression detection
 *
 * @module @claudeflare/optimization
 */

// Bundle Optimization
export {
  BundleAnalyzer,
  CodeSplittingOptimizer,
  TreeShakingOptimizer,
} from './bundle/index.js';

export type {
  BundleConfig,
  BundleAnalysisResult,
  BundleModule,
  BundleDependency,
  BundleChunk,
  BundleRecommendation,
  CodeSplittingOptions,
  CompressionOptions,
  TreeShakingAnalysis,
  DeadCodeReport,
} from './types/index.js';

// Runtime Optimization
export {
  RuntimeProfiler,
  RuntimeOptimizer,
  type OptimizedArray,
} from './runtime/index.js';

export type {
  RuntimeOptimizationConfig,
  RuntimeProfile,
  OptimizationSuggestion,
  HotPathAnalysis,
} from './types/index.js';

// Memory Optimization
export { MemoryOptimizer } from './memory/index.js';

export type {
  MemoryConfig,
  MemorySnapshot,
  MemoryLeak,
  ObjectPool,
  MemoryAnalysisResult,
  MemoryRecommendation,
  PoolStats,
} from './types/index.js';

// Network Optimization
export { NetworkOptimizer } from './network/index.js';

export type {
  NetworkConfig,
  NetworkMetrics,
  RequestBatch,
  BatchedRequest,
  ConnectionPool,
  NetworkOptimizationResult,
  NetworkRecommendation,
  RequestBatchStats,
} from './types/index.js';

// Caching Optimization
export {
  CachingOptimizer,
  type OptimizedCache,
} from './caching/index.js';

export type {
  CacheConfig,
  CacheEntry,
  CacheStats,
  CacheLayer,
  MultiLevelCache,
  CacheAnalysisResult,
  HotKeyEntry,
  CacheRecommendation,
} from './types/index.js';

// Performance Regression
export { RegressionDetector } from './regression/index.js';

export type {
  RegressionConfig,
  RegressionResult,
  PerformanceBaseline,
  BaselineMetrics,
  RegressionIssue,
  Improvement,
  RegressionSummary,
  RegressionThresholds,
  AlertConfig,
} from './types/index.js';

// Common Types
export type {
  OptimizationResult,
  ImprovementMetric,
  PerformanceBudget,
  BudgetReport,
  BudgetViolation,
} from './types/index.js';

// Version
export const VERSION = '1.0.0';

/**
 * Create a complete optimization suite
 */
export function createOptimizationSuite(config?: {
  bundle?: Partial<import('./types/index.js').BundleConfig>;
  runtime?: Partial<import('./types/index.js').RuntimeOptimizationConfig>;
  memory?: Partial<import('./types/index.js').MemoryConfig>;
  network?: Partial<import('./types/index.js').NetworkConfig>;
  cache?: Partial<import('./types/index.js').CacheConfig>;
  regression?: Partial<import('./types/index.js').RegressionConfig>;
}) {
  return {
    bundle: {
      analyzer: new (async () => {
        const { BundleAnalyzer } = await import('./bundle/index.js');
        return new BundleAnalyzer();
      })(),
      codeSplitting: new (async () => {
        const { CodeSplittingOptimizer } = await import('./bundle/index.js');
        return new CodeSplittingOptimizer(config?.bundle);
      })(),
      treeShaking: new (async () => {
        const { TreeShakingOptimizer } = await import('./bundle/index.js');
        return new TreeShakingOptimizer();
      })(),
    },
    runtime: new (async () => {
      const { RuntimeOptimizer } = await import('./runtime/index.js');
      return new RuntimeOptimizer(config?.runtime);
    })(),
    memory: new (async () => {
      const { MemoryOptimizer } = await import('./memory/index.js');
      return new MemoryOptimizer(config?.memory);
    })(),
    network: new (async () => {
      const { NetworkOptimizer } = await import('./network/index.js');
      return new NetworkOptimizer(config?.network);
    })(),
    cache: new (async () => {
      const { CachingOptimizer } = await import('./caching/index.js');
      return new CachingOptimizer(config?.cache);
    })(),
    regression: new (async () => {
      const { RegressionDetector } = await import('./regression/index.js');
      return new RegressionDetector(config?.regression);
    })(),
  };
}
