/**
 * ClaudeFlare Benchmark Package
 * Comprehensive benchmarking and profiling suite
 */

// Core exports
export {
  BenchmarkRunner,
  benchmark,
  suite
} from './runner/index.js';

export {
  MetricsCollector,
  collectMetricsDuring,
  snapshotMetrics,
  calculateMetricsDelta
} from './metrics/index.js';

export {
  ComparisonEngine,
  compare,
  detectRegression
} from './comparison/index.js';

export {
  ProfilerIntegration,
  profileCpu,
  profileMemory
} from './profiling/index.js';

export {
  LoadTester,
  loadTest,
  sustainedLoadTest,
  spikeTest
} from './load/index.js';

export {
  StressTester,
  stressTest,
  findBreakingPoint
} from './stress/index.js';

export {
  PerformanceReporter,
  generateReport,
  generateHtmlReport,
  generateJsonReport
} from './reporting/index.js';

// Utility exports
export {
  mean,
  median,
  mode,
  standardDeviation,
  variance,
  coefficientOfVariation,
  percentile,
  percentiles,
  confidenceInterval,
  detectOutliers,
  analyze,
  tTest,
  mannWhitneyUTest,
  cohensD
} from './utils/statistics.js';

export {
  getSystemInfo,
  getProcessMemoryUsage,
  getProcessCpuUsage,
  formatBytes,
  formatNanoseconds,
  formatOpsPerSecond
} from './utils/system.js';

// Type exports
export type {
  BenchmarkDefinition,
  BenchmarkOptions,
  BenchmarkResult,
  BenchmarkSuite,
  BenchmarkEvent,
  EventHandler
} from './types/index.js';

export type {
  CollectedMetrics,
  MemoryMetrics,
  CpuMetrics,
  IOMetrics,
  GCMetrics,
  EventLoopMetrics
} from './types/index.js';

export type {
  BenchmarkComparison,
  ComparisonReport,
  PerformanceDifference,
  StatisticalSignificance
} from './types/index.js';

export type {
  ProfileOptions,
  CpuProfile,
  ProfileNode,
  MemoryProfile
} from './types/index.js';

export type {
  LoadTestConfig,
  LoadTestResult,
  LoadTestLevel,
  ResourceUsage
} from './types/index.js';

export type {
  StressTestConfig,
  StressTestResult,
  BreakdownAnalysis,
  BottleneckAnalysis,
  CapacityRecommendation
} from './types/index.js';

export type {
  ReportConfig,
  ReportData,
  GeneratedReport
} from './types/index.js';

export type {
  SystemInfo,
  StatisticalAnalysis,
  OutlierDetection,
  ConfidenceInterval
} from './types/index.js';
