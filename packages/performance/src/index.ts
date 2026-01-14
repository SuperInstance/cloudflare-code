/**
 * ClaudeFlare Performance Package
 *
 * Comprehensive performance monitoring and optimization toolkit
 * for Cloudflare Workers and edge computing platforms
 *
 * @module @claudeflare/performance
 */

// Profiler
export {
  PerformanceProfiler,
  StatisticalSampler,
  TimeSeriesSampler,
  Tracer,
  AsyncTraceContext,
  trace,
} from './profiler/index.js';

// Load Testing
export { LoadTestRunner, LoadTestScenarios } from './load-test/index.js';

// Benchmarking
export { BenchmarkRunner, BenchmarkSuites } from './benchmark/index.js';

// Optimization
export { PerformanceAnalyzer, PatternAnalyzer } from './optimizer/index.js';

// Regression Detection
export { RegressionDetector, BaselineManager } from './regression/index.js';

// Utilities
export { ReportGenerator, MetricsFormatter } from './utils/index.js';

// Types
export type {
  // Common
  PerformanceMetrics,
  ProfileSnapshot,
  BenchmarkResult,
  BenchmarkSuite,
  Benchmark,
  LoadTestConfig,
  LoadTestResult,
  OptimizationRecommendation,
  RegressionResult,
  PerformanceBaseline,

  // Profiler
  ProfilerConfig,
  ProfilerFilter,
  CPUProfile,
  StackFrame,
  MemorySnapshot,
  WorkerMetrics,

  // Tracer
  TraceContext,
  Span,
  SpanLog,
  SpanStatus,

  // Benchmark
  BenchmarkOptions,
  BenchmarkComparison,
  ComparisonResult,
  ComparisonSummary,

  // Load Test
  LoadTestExpectations,
  ExpectationResult,
  ErrorSample,

  // Optimization
  OptimizationCategory,

  // Regression
  RegressionThresholds,
  DetectionConfig,
  BaselineConfig,
  BaselineComparison,
  MetricComparison,
  TrendData,

  // Report
  PerformanceReport,
  PerformanceReportSummary,
} from './types/index.js';

// Version
export const VERSION = '1.0.0';
