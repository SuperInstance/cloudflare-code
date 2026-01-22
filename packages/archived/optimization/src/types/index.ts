/**
 * Optimization Types
 *
 * Core type definitions for the optimization package
 */

// ============================================================================
// Bundle Optimization Types
// ============================================================================

export interface BundleConfig {
  entryPoints: string[];
  outputPath: string;
  format: 'esm' | 'cjs' | 'iife';
  target: 'es2020' | 'es2022' | 'esnext';
  minify: boolean;
  sourceMap: boolean;
  splitting: boolean;
  treeshake: boolean;
  compression: CompressionOptions;
  codeSplitting: CodeSplittingOptions;
}

export interface CompressionOptions {
  gzip: boolean;
  brotli: boolean;
  level: number;
}

export interface CodeSplittingOptions {
  strategy: 'route' | 'component' | 'vendor' | 'mixed';
  manualChunks: Record<string, string[]>;
  minChunkSize: number;
  maxChunkSize: number;
}

export interface BundleAnalysisResult {
  name: string;
  size: number;
  gzipSize: number;
  brotliSize: number;
  modules: BundleModule[];
  dependencies: BundleDependency[];
  chunks: BundleChunk[];
  recommendations: BundleRecommendation[];
}

export interface BundleModule {
  id: string;
  name: string;
  size: number;
  renderedSize: number;
  originalSize: number;
  isEntry: boolean;
  isDynamicImport: boolean;
  imports: string[];
  dependents: string[];
}

export interface BundleDependency {
  name: string;
  version: string;
  size: number;
  treeShaken: boolean;
  required: boolean;
}

export interface BundleChunk {
  name: string;
  size: number;
  modules: string[];
  imports: string[];
  isDynamic: boolean;
}

export interface BundleRecommendation {
  type: 'code-splitting' | 'tree-shaking' | 'lazy-loading' | 'compression' | 'vendor';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: number;
  effort: 'low' | 'medium' | 'high';
  codeExample?: string;
}

// ============================================================================
// Runtime Optimization Types
// ============================================================================

export interface RuntimeOptimizationConfig {
  enableProfiling: boolean;
  enableMemoization: boolean;
  enableDebouncing: boolean;
  enableThrottling: boolean;
  hotPathThreshold: number;
  memoizationCacheSize: number;
  debounceWait: number;
  throttleWait: number;
}

export interface RuntimeProfile {
  functionName: string;
  callCount: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  selfTime: number;
  isHotPath: boolean;
}

export interface OptimizationSuggestion {
  functionName: string;
  suggestionType: 'memoization' | 'caching' | 'algorithm' | 'lazy-loading';
  description: string;
  expectedImprovement: number;
  codeBefore: string;
  codeAfter: string;
}

export interface HotPathAnalysis {
  functionName: string;
  filePath: string;
  lineNumber: number;
  executionTime: number;
  callCount: number;
  percentage: number;
  optimizations: OptimizationSuggestion[];
}

// ============================================================================
// Memory Optimization Types
// ============================================================================

export interface MemoryConfig {
  poolSize: number;
  maxPoolSize: number;
  gcThreshold: number;
  leakDetectionEnabled: boolean;
  profilingEnabled: boolean;
  snapshotInterval: number;
}

export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  detachedArrayBuffers?: number;
}

export interface MemoryLeak {
  location: string;
  type: 'event-listener' | 'timer' | 'closure' | 'cache' | 'reference';
  severity: 'critical' | 'high' | 'medium' | 'low';
  size: number;
  growthRate: number;
  description: string;
  fixSuggestion: string;
}

export interface ObjectPool<T> {
  acquire(): T;
  release(obj: T): void;
  size(): number;
  clear(): void;
}

export interface MemoryAnalysisResult {
  baseline: MemorySnapshot;
  current: MemorySnapshot;
  leaks: MemoryLeak[];
  pools: PoolStats[];
  recommendations: MemoryRecommendation[];
}

export interface PoolStats {
  name: string;
  size: number;
  maxSize: number;
  hitRate: number;
  avgAcquireTime: number;
}

export interface MemoryRecommendation {
  type: 'pool' | 'leak-fix' | 'gc-tuning' | 'buffer-management';
  priority: 'high' | 'medium' | 'low';
  description: string;
  expectedReduction: number;
  implementation: string;
}

// ============================================================================
// Network Optimization Types
// ============================================================================

export interface NetworkConfig {
  requestBatching: boolean;
  batchSize: number;
  batchTimeout: number;
  connectionPooling: boolean;
  maxConnections: number;
  http2: boolean;
  compression: boolean;
  cachingEnabled: boolean;
  retryAttempts: number;
  retryDelay: number;
}

export interface NetworkMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  totalBytes: number;
  compressionRatio: number;
  cacheHitRate: number;
}

export interface RequestBatch {
  id: string;
  requests: BatchedRequest[];
  createdAt: number;
  executedAt?: number;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

export interface BatchedRequest {
  id: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
  priority: number;
}

export interface ConnectionPool {
  available: number;
  active: number;
  max: number;
  queue: number;
}

export interface NetworkOptimizationResult {
  metrics: NetworkMetrics;
  batches: RequestBatchStats[];
  connectionPool: ConnectionPool;
  recommendations: NetworkRecommendation[];
}

export interface RequestBatchStats {
  window: string;
  batchCount: number;
  totalRequests: number;
  avgBatchSize: number;
  reduction: number;
}

export interface NetworkRecommendation {
  type: 'batching' | 'compression' | 'http2' | 'caching' | 'connection-pool';
  priority: 'high' | 'medium' | 'low';
  description: string;
  expectedImprovement: number;
  implementation: string;
}

// ============================================================================
// Caching Optimization Types
// ============================================================================

export interface CacheConfig {
  strategy: 'lru' | 'lfu' | 'fifo' | 'ttl' | 'hybrid';
  maxSize: number;
  ttl: number;
  maxMemory: number;
  compressionEnabled: boolean;
  persistEnabled: boolean;
  persistPath?: string;
  statsEnabled: boolean;
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  size: number;
  hits: number;
  createdAt: number;
  accessedAt: number;
  expiresAt: number;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  memoryUsage: number;
  avgAccessTime: number;
}

export interface CacheLayer {
  name: string;
  level: number;
  config: CacheConfig;
  stats: CacheStats;
}

export interface MultiLevelCache {
  layers: CacheLayer[];
  hitRates: Map<string, number>;
  fallbackCount: number;
}

export interface CacheAnalysisResult {
  totalHits: number;
  totalMisses: number;
  overallHitRate: number;
  layers: CacheLayer[];
  hotKeys: HotKeyEntry[];
  recommendations: CacheRecommendation[];
}

export interface HotKeyEntry {
  key: string;
  hits: number;
  size: number;
  lastAccessed: number;
}

export interface CacheRecommendation {
  type: 'size-adjustment' | 'tuning' | 'warming' | 'invalidation' | 'compression';
  priority: 'high' | 'medium' | 'low';
  description: string;
  expectedImprovement: number;
  implementation: string;
}

// ============================================================================
// Performance Regression Types
// ============================================================================

export interface RegressionConfig {
  baselinePath: string;
  thresholds: RegressionThresholds;
  alerting: AlertConfig;
  historyRetention: number;
  comparisonMethod: 'absolute' | 'relative' | 'statistical';
}

export interface RegressionThresholds {
  cpu: {
    warning: number;
    critical: number;
  };
  memory: {
    warning: number;
    critical: number;
  };
  latency: {
    warning: number;
    critical: number;
  };
  throughput: {
    warning: number;
    critical: number;
  };
  bundleSize: {
    warning: number;
    critical: number;
  };
}

export interface AlertConfig {
  enabled: boolean;
  channels: ('email' | 'slack' | 'webhook')[];
  recipients: string[];
  webhookUrls: string[];
}

export interface PerformanceBaseline {
  id: string;
  timestamp: number;
  commit: string;
  metrics: BaselineMetrics;
}

export interface BaselineMetrics {
  cpu: number;
  memory: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: number;
  bundleSize: {
    main: number;
    gzip: number;
    brotli: number;
  };
}

export interface RegressionResult {
  detected: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  regressions: RegressionIssue[];
  improvements: Improvement[];
  summary: RegressionSummary;
}

export interface RegressionIssue {
  metric: string;
  baseline: number;
  current: number;
  delta: number;
  deltaPercent: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  threshold: number;
  description: string;
}

export interface Improvement {
  metric: string;
  baseline: number;
  current: number;
  delta: number;
  deltaPercent: number;
  description: string;
}

export interface RegressionSummary {
  totalIssues: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  totalImprovements: number;
  status: 'pass' | 'warn' | 'fail';
}

// ============================================================================
// Common Types
// ============================================================================

export interface OptimizationResult {
  success: boolean;
  duration: number;
  improvements: ImprovementMetric[];
  warnings: string[];
  errors: string[];
}

export interface ImprovementMetric {
  metric: string;
  before: number;
  after: number;
  improvement: number;
  unit: string;
}

export interface PerformanceBudget {
  maxBundleSize: number;
  maxChunkSize: number;
  maxGzipSize: number;
  maxLoadTime: number;
  maxMemoryUsage: number;
}

export interface BudgetReport {
  budget: PerformanceBudget;
  actual: PerformanceBudget;
  status: 'pass' | 'warn' | 'fail';
  violations: BudgetViolation[];
}

export interface BudgetViolation {
  metric: string;
  budget: number;
  actual: number;
  excess: number;
  excessPercent: number;
}

// Tree Shaking Analysis Types
export interface TreeShakingAnalysis {
  totalModules: number;
  usedModules: number;
  unusedModules: number;
  deadCode: DeadCodeReport[];
  recommendations: BundleRecommendation[];
}

export interface DeadCodeReport {
  module: string;
  type: 'function' | 'class' | 'variable' | 'import';
  name: string;
  size: number;
  reason: string;
}
