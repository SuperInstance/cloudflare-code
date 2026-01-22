/**
 * Benchmark Suite Types and Interfaces
 * Comprehensive type definitions for the benchmarking framework
 */

// ============================================================================
// Core Benchmark Types
// ============================================================================

/**
 * Represents a single benchmark function with metadata
 */
export interface BenchmarkDefinition {
  /** Unique identifier for the benchmark */
  name: string;
  /** Human-readable description */
  description?: string;
  /** The function to benchmark */
  fn: BenchmarkFunction;
  /** Setup function run before each iteration */
  setup?: () => void | Promise<void>;
  /** Teardown function run after each iteration */
  teardown?: () => void | Promise<void>;
  /** Before all function run once before benchmarks start */
  beforeAll?: () => void | Promise<void>;
  /** After all function run once after benchmarks complete */
  afterAll?: () => void | Promise<void>;
  /** Custom options for this benchmark */
  options?: Partial<BenchmarkOptions>;
  /** Tags for categorization and filtering */
  tags?: string[];
  /** Benchmark timeout in milliseconds */
  timeout?: number;
  /** Whether to skip this benchmark */
  skip?: boolean;
  /** Whether this benchmark is only for specific scenarios */
  only?: boolean;
}

/**
 * Benchmark function type
 */
export type BenchmarkFunction = () => void | Promise<void>;

/**
 * Options for running benchmarks
 */
export interface BenchmarkOptions {
  /** Number of warmup iterations before actual measurement */
  warmupIterations: number;
  /** Number of iterations to run for measurement */
  iterations: number;
  /** Minimum time in milliseconds to run the benchmark */
  time: number;
  /** Whether to run in parallel */
  parallel: boolean;
  /** Number of parallel instances */
  concurrency: number;
  /** Whether to collect detailed metrics */
  detailedMetrics: boolean;
  /** Whether to generate profiling data */
  profiling: boolean;
  /** Statistical significance threshold (0-1) */
  significanceThreshold: number;
  /** Maximum relative standard deviation */
  maxRsd: number;
  /** Whether to detect and remove outliers */
  removeOutliers: boolean;
  /** Outlier detection method */
  outlierMethod: 'iqr' | 'zscore' | 'modified-zscore';
  /** Percentiles to calculate */
  percentiles: number[];
}

/**
 * Result from a single benchmark run
 */
export interface BenchmarkResult {
  /** Benchmark name */
  name: string;
  /** All execution times in nanoseconds */
  samples: number[];
  /** Total execution time in nanoseconds */
  total: number;
  /** Mean execution time in nanoseconds */
  mean: number;
  /** Standard deviation in nanoseconds */
  standardDeviation: number;
  /** Relative standard deviation (percentage) */
  rsd: number;
  /** Minimum execution time in nanoseconds */
  min: number;
  /** Maximum execution time in nanoseconds */
  max: number;
  /** Median execution time in nanoseconds */
  median: number;
  /** Mode execution time in nanoseconds */
  mode: number;
  /** Percentile values */
  percentiles: Record<number, number>;
  /** Number of operations per second */
  ops: number;
  /** Confidence interval */
  confidence: {
    lower: number;
    upper: number;
    level: number;
  };
  /** Whether result is statistically significant */
  significant: boolean;
  /** Outlier information */
  outliers?: {
    count: number;
    indices: number[];
    values: number[];
  };
  /** Memory usage statistics */
  memory?: MemoryMetrics;
  /** CPU usage statistics */
  cpu?: CpuMetrics;
  /** Additional custom metrics */
  custom?: Record<string, number>;
  /** Timestamp when benchmark started */
  startTime: number;
  /** Timestamp when benchmark ended */
  endTime: number;
  /** Error if benchmark failed */
  error?: Error;
}

/**
 * Collection of benchmark results
 */
export interface BenchmarkSuite {
  /** Suite name */
  name: string;
  /** Suite description */
  description?: string;
  /** Individual benchmark results */
  results: BenchmarkResult[];
  /** Suite-level metadata */
  metadata: SuiteMetadata;
  /** Aggregate statistics */
  statistics: SuiteStatistics;
}

/**
 * Metadata about a benchmark suite run
 */
export interface SuiteMetadata {
  /** Timestamp when suite started */
  startTime: number;
  /** Timestamp when suite ended */
  endTime: number;
  /** Total duration in milliseconds */
  duration: number;
  /** System information */
  system: SystemInfo;
  /** Environment variables */
  env?: Record<string, string>;
  /** Custom metadata */
  custom?: Record<string, any>;
}

/**
 * Aggregate statistics for a suite
 */
export interface SuiteStatistics {
  /** Total number of benchmarks run */
  totalBenchmarks: number;
  /** Number of successful benchmarks */
  successful: number;
  /** Number of failed benchmarks */
  failed: number;
  /** Number of skipped benchmarks */
  skipped: number;
  /** Overall execution time */
  totalExecutionTime: number;
  /** Fastest benchmark */
  fastest?: BenchmarkResult;
  /** Slowest benchmark */
  slowest?: BenchmarkResult;
}

// ============================================================================
// Metrics Types
// ============================================================================

/**
 * Memory usage metrics
 */
export interface MemoryMetrics {
  /** Heap used in bytes */
  heapUsed: number;
  /** Heap total in bytes */
  heapTotal: number;
  /** External memory in bytes */
  external: number;
  /** Array buffers in bytes */
  arrayBuffers: number;
  /** RSS (resident set size) in bytes */
  rss: number;
  /** Peak heap usage during benchmark */
  peakHeapUsed?: number;
  /** Memory growth */
  growth?: number;
}

/**
 * CPU usage metrics
 */
export interface CpuMetrics {
  /** User CPU time in microseconds */
  user: number;
  /** System CPU time in microseconds */
  system: number;
  /** Percent CPU usage */
  percent: number;
  /** Number of CPU cores */
  cores: number;
}

/**
 * I/O metrics
 */
export interface IOMetrics {
  /** Number of file reads */
  reads: number;
  /** Number of file writes */
  writes: number;
  /** Bytes read */
  bytesWritten: number;
  /** Bytes written */
  bytesRead: number;
  /** Network requests made */
  networkRequests: number;
}

/**
 * Garbage collection metrics
 */
export interface GCMetrics {
  /** Number of GC collections */
  collections: number;
  /** Time spent in GC in nanoseconds */
  time: number;
  /** Scavenge collections */
  scavenge: number;
  /** Mark-sweep-compact collections */
  markSweepCompact: number;
  /** Incremental marking collections */
  incrementalMarking: number;
}

/**
 * Event loop metrics
 */
export interface EventLoopMetrics {
  /** Average lag in milliseconds */
  avgLag: number;
  /** Maximum lag in milliseconds */
  maxLag: number;
  /** Minimum lag in milliseconds */
  minLag: number;
  /** Percentile lags */
  percentiles: Record<number, number>;
}

/**
 * Comprehensive metrics collection
 */
export interface CollectedMetrics {
  /** Memory metrics */
  memory: MemoryMetrics;
  /** CPU metrics */
  cpu: CpuMetrics;
  /** I/O metrics */
  io: IOMetrics;
  /** GC metrics */
  gc: GCMetrics;
  /** Event loop metrics */
  eventLoop: EventLoopMetrics;
  /** Custom metrics */
  custom?: Record<string, number>;
  /** Timestamp when collection started */
  startTime: number;
  /** Timestamp when collection ended */
  endTime: number;
}

// ============================================================================
// Comparison Types
// ============================================================================

/**
 * Comparison between two benchmark results
 */
export interface BenchmarkComparison {
  /** Baseline result */
  baseline: BenchmarkResult;
  /** Current result */
  current: BenchmarkResult;
  /** Name of the benchmark */
  name: string;
  /** Performance difference */
  difference: PerformanceDifference;
  /** Statistical significance */
  significance: StatisticalSignificance;
  /** Verdict (improved, regressed, no-change) */
  verdict: 'improved' | 'regressed' | 'no-change' | 'inconclusive';
  /** Comparison metadata */
  metadata: ComparisonMetadata;
}

/**
 * Performance difference metrics
 */
export interface PerformanceDifference {
  /** Absolute difference in nanoseconds */
  absolute: number;
  /** Relative difference (percentage) */
  relative: number;
  /** Speedup factor */
  speedup: number;
  /** Operations per second difference */
  opsDiff: number;
}

/**
 * Statistical significance test results
 */
export interface StatisticalSignificance {
  /** Whether difference is statistically significant */
  significant: boolean;
  /** P-value */
  pValue: number;
  /** Test used (t-test, mann-whitney, etc.) */
  test: string;
  /** Effect size */
  effectSize: number;
  /** Confidence level */
  confidenceLevel: number;
}

/**
 * Metadata about the comparison
 */
export interface ComparisonMetadata {
  /** Baseline run timestamp */
  baselineTimestamp: number;
  /** Current run timestamp */
  currentTimestamp: number;
  /** Time difference between runs */
  timeDelta: number;
  /** System differences */
  systemDiff?: SystemDiff;
}

/**
 * Differences between systems
 */
export interface SystemDiff {
  /** CPU model difference */
  cpu?: boolean;
  /** Memory difference */
  memory?: boolean;
  /** Node version difference */
  nodeVersion?: boolean;
  /** OS version difference */
  osVersion?: boolean;
}

/**
 * Comparison report for multiple benchmarks
 */
export interface ComparisonReport {
  /** Report name */
  name: string;
  /** Comparisons for each benchmark */
  comparisons: BenchmarkComparison[];
  /** Summary statistics */
  summary: ComparisonSummary;
  /** Recommendations */
  recommendations: string[];
  /** Report metadata */
  metadata: ReportMetadata;
}

/**
 * Summary of comparison results
 */
export interface ComparisonSummary {
  /** Total comparisons */
  total: number;
  /** Number of improvements */
  improvements: number;
  /** Number of regressions */
  regressions: number;
  /** Number with no change */
  noChange: number;
  /** Number inconclusive */
  inconclusive: number;
  /** Overall verdict */
  overallVerdict: 'improved' | 'regressed' | 'mixed' | 'no-change';
}

/**
 * Report metadata
 */
export interface ReportMetadata {
  /** Report generation timestamp */
  generatedAt: number;
  /** Report format */
  format: 'json' | 'html' | 'markdown';
  /** Report version */
  version: string;
  /** Generator information */
  generator: string;
}

// ============================================================================
// Profiling Types
// ============================================================================

/**
 * Profile configuration options
 */
export interface ProfileOptions {
  /** Type of profiling */
  type: 'cpu' | 'memory' | 'heap' | 'coverage';
  /** Sampling interval in microseconds */
  samplingInterval?: number;
  /** Whether to generate flame graph */
  flameGraph?: boolean;
  /** Whether to generate call tree */
  callTree?: boolean;
  /** Profile output directory */
  outputDir?: string;
  /** Profile name */
  name?: string;
  /** Maximum duration for profiling */
  maxDuration?: number;
}

/**
 * CPU profile result
 */
export interface CpuProfile {
  /** Profile nodes */
  nodes: ProfileNode[];
  /** Profile start time */
  startTime: number;
  /** Profile end time */
  endTime: number;
  /** Total duration */
  duration: number;
  /** Sample count */
  sampleCount: number;
  /** Hot path (most time-consuming functions) */
  hotPath: ProfileNode[];
}

/**
 * Profile node representing a function call
 */
export interface ProfileNode {
  /** Function name */
  name: string;
  /** Script URL */
  scriptName?: string;
  /** Line number */
  lineNumber?: number;
  /** Column number */
  columnNumber?: number;
  /** Execution time in nanoseconds */
  time: number;
  /** Self time (excluding children) */
  selfTime: number;
  /** Number of calls */
  callCount: number;
  /** Child nodes */
  children?: ProfileNode[];
  /** Percentage of total time */
  percentage: number;
}

/**
 * Memory profile result
 */
export interface MemoryProfile {
  /** Memory samples over time */
  samples: MemorySample[];
  /** Profile start time */
  startTime: number;
  /** Profile end time */
  endTime: number;
  /** Peak memory usage */
  peakMemory: number;
  /** Memory growth rate */
  growthRate: number;
  /** Potential memory leaks detected */
  leaks: MemoryLeakInfo[];
}

/**
 * Memory sample at a point in time
 */
export interface MemorySample {
  /** Timestamp */
  timestamp: number;
  /** Heap used */
  heapUsed: number;
  /** Heap total */
  heapTotal: number;
  /** External memory */
  external: number;
}

/**
 * Information about a potential memory leak
 */
export interface MemoryLeakInfo {
  /** Object description */
  description: string;
  /** Number of instances */
  count: number;
  /** Size in bytes */
  size: number;
  /** Growth rate */
  growthRate: number;
  /** Confidence level */
  confidence: 'low' | 'medium' | 'high';
}

// ============================================================================
// Load Testing Types
// ============================================================================

/**
 * Load test configuration
 */
export interface LoadTestConfig {
  /** Test name */
  name: string;
  /** Function to test */
  fn: () => void | Promise<void>;
  /** Initial number of concurrent operations */
  initialConcurrency: number;
  /** Maximum number of concurrent operations */
  maxConcurrency: number;
  /** Concurrency increment step */
  concurrencyStep: number;
  /** Duration for each concurrency level in milliseconds */
  durationPerLevel: number;
  /** Request rate (requests per second) */
  rate?: number;
  /** Whether to use rate limiting */
  rateLimit?: boolean;
  /** Ramp-up duration in milliseconds */
  rampUpDuration?: number;
  /** Cooldown duration in milliseconds */
  coolDownDuration?: number;
}

/**
 * Result from a load test
 */
export interface LoadTestResult {
  /** Test name */
  name: string;
  /** Results per concurrency level */
  levels: LoadTestLevel[];
  /** Aggregate statistics */
  statistics: LoadTestStatistics;
  /** System resource usage */
  resources: ResourceUsage;
  /** Test duration */
  duration: number;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
  /** Whether test completed successfully */
  success: boolean;
}

/**
 * Results for a single concurrency level
 */
export interface LoadTestLevel {
  /** Concurrency level */
  concurrency: number;
  /** Total operations performed */
  totalOperations: number;
  /** Successful operations */
  successful: number;
  /** Failed operations */
  failed: number;
  /** Operations per second */
  ops: number;
  /** Average latency in milliseconds */
  avgLatency: number;
  /** Median latency */
  medianLatency: number;
  /** Percentile latencies */
  percentiles: Record<number, number>;
  /** Minimum latency */
  minLatency: number;
  /** Maximum latency */
  maxLatency: number;
  /** Throughput in bytes per second */
  throughput?: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Timeout rate (0-1) */
  timeoutRate: number;
  /** Resource usage at this level */
  resources: ResourceUsage;
}

/**
 * Aggregate load test statistics
 */
export interface LoadTestStatistics {
  /** Total operations across all levels */
  totalOperations: number;
  /** Peak operations per second achieved */
  peakOps: number;
  /** Concurrency level at peak ops */
  peakOpsConcurrency: number;
  /** Maximum sustainable concurrency */
  maxSustainableConcurrency?: number;
  /** Breakdown point (where errors increase significantly) */
  breakdownPoint?: number;
  /** Average latency across all levels */
  avgLatency: number;
  /** Maximum latency observed */
  maxLatency: number;
}

/**
 * Resource usage metrics
 */
export interface ResourceUsage {
  /** CPU usage percentage */
  cpu: number;
  /** Memory usage in bytes */
  memory: number;
  /** Event loop lag in milliseconds */
  eventLoopLag: number;
  /** Active handles */
  activeHandles: number;
  /** Active requests */
  activeRequests: number;
}

// ============================================================================
// Stress Testing Types
// ============================================================================

/**
 * Stress test configuration
 */
export interface StressTestConfig {
  /** Test name */
  name: string;
  /** Function to stress test */
  fn: () => void | Promise<void>;
  /** Starting load level */
  startLoad: number;
  /** Load increment per step */
  loadIncrement: number;
  /** Maximum load to test */
  maxLoad: number;
  /** Duration per load level in milliseconds */
  durationPerLevel: number;
  /** Maximum error rate threshold (0-1) */
  maxErrorRate: number;
  /** Maximum latency threshold in milliseconds */
  maxLatency: number;
  /** Whether to stop at breaking point */
  stopAtBreakdown: boolean;
  /** Recovery test configuration */
  recoveryTest?: RecoveryTestConfig;
}

/**
 * Recovery test configuration
 */
export interface RecoveryTestConfig {
  /** Whether to run recovery test */
  enabled: boolean;
  /** Load level to test recovery at */
  loadLevel: number;
  /** Duration to maintain overload */
  overloadDuration: number;
  /** Recovery duration */
  recoveryDuration: number;
}

/**
 * Stress test result
 */
export interface StressTestResult {
  /** Test name */
  name: string;
  /** Results per stress level */
  levels: StressTestLevel[];
  /** Breaking point analysis */
  breakdown: BreakdownAnalysis;
  /** Bottleneck analysis */
  bottlenecks: BottleneckAnalysis[];
  /** Capacity planning recommendations */
  recommendations: CapacityRecommendation[];
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
  /** Total duration */
  duration: number;
}

/**
 * Results for a single stress level
 */
export interface StressTestLevel {
  /** Stress level (concurrency, rate, etc.) */
  level: number;
  /** Total operations attempted */
  totalOperations: number;
  /** Successful operations */
  successful: number;
  /** Failed operations */
  failed: number;
  /** Error rate */
  errorRate: number;
  /** Average latency */
  avgLatency: number;
  /** P95 latency */
  p95Latency: number;
  /** P99 latency */
  p99Latency: number;
  /** Maximum latency */
  maxLatency: number;
  /** Resource usage */
  resources: ResourceUsage;
  /** Whether system was stable at this level */
  stable: boolean;
}

/**
 * Analysis of the breaking point
 */
export interface BreakdownAnalysis {
  /** Whether breakdown was detected */
  detected: boolean;
  /** Load level at breakdown */
  loadLevel?: number;
  /** Type of breakdown */
  type?: 'memory' | 'cpu' | 'latency' | 'errors' | 'timeout' | 'crash';
  /** Description */
  description: string;
  /** Latency at breakdown */
  latencyAtBreakdown?: number;
  /** Error rate at breakdown */
  errorRateAtBreakdown?: number;
}

/**
 * Bottleneck analysis
 */
export interface BottleneckAnalysis {
  /** Resource that is the bottleneck */
  resource: 'cpu' | 'memory' | 'io' | 'network' | 'event-loop';
  /** Severity (0-1) */
  severity: number;
  /** Description */
  description: string;
  /** Current utilization */
  utilization: number;
  /** Recommended action */
  recommendation: string;
}

/**
 * Capacity planning recommendation
 */
export interface CapacityRecommendation {
  /** Metric this recommendation is for */
  metric: string;
  /** Recommended maximum capacity */
  maxCapacity: number;
  /** Recommended buffer percentage */
  bufferPercentage: number;
  /** Justification */
  justification: string;
  /** Confidence level */
  confidence: 'low' | 'medium' | 'high';
}

// ============================================================================
// Reporting Types
// ============================================================================

/**
 * Report configuration
 */
export interface ReportConfig {
  /** Report name */
  name?: string;
  /** Output format(s) */
  format: ('html' | 'json' | 'markdown' | 'csv')[];
  /** Output directory */
  outputDir: string;
  /** Whether to include comparison data */
  includeComparison?: boolean;
  /** Whether to include profiling data */
  includeProfiling?: boolean;
  /** Whether to include historical data */
  includeHistory?: boolean;
  /** Number of historical data points to include */
  historyCount?: number;
  /** Custom CSS for HTML reports */
  customCss?: string;
  /** Report theme */
  theme?: 'light' | 'dark' | 'auto';
}

/**
 * Report data
 */
export interface ReportData {
  /** Benchmark suite results */
  suite: BenchmarkSuite;
  /** Comparison data (if available) */
  comparison?: ComparisonReport;
  /** Historical data (if available) */
  history?: BenchmarkSuite[];
  /** Profiling data (if available) */
  profiling?: {
    cpu?: CpuProfile;
    memory?: MemoryProfile;
  };
}

/**
 * Generated report information
 */
export interface GeneratedReport {
  /** Report file paths */
  files: string[];
  /** Report format */
  format: string;
  /** Generation timestamp */
  generatedAt: number;
  /** Report size in bytes */
  size: number;
}

// ============================================================================
// System Information Types
// ============================================================================

/**
 * System information snapshot
 */
export interface SystemInfo {
  /** CPU model */
  cpuModel: string;
  /** CPU speed in MHz */
  cpuSpeed: number;
  /** Number of CPU cores */
  cpuCores: number;
  /** Total memory in bytes */
  totalMemory: number;
  /** Free memory in bytes */
  freeMemory: number;
  /** Operating system */
  platform: string;
  /** OS release */
  osRelease: string;
  /** OS version */
  osVersion: string;
  /** OS architecture */
  arch: string;
  /** Node.js version */
  nodeVersion: string;
  /** V8 version */
  v8Version: string;
  /** Program name */
  programName: string;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Benchmark event types
 */
export type BenchmarkEventType =
  | 'suite-start'
  | 'suite-end'
  | 'benchmark-start'
  | 'benchmark-end'
  | 'benchmark-error'
  | 'progress'
  | 'complete';

/**
 * Benchmark event
 */
export interface BenchmarkEvent {
  /** Event type */
  type: BenchmarkEventType;
  /** Event timestamp */
  timestamp: number;
  /** Event data */
  data?: any;
  /** Source of event */
  source?: string;
}

/**
 * Event handler function type
 */
export type EventHandler = (event: BenchmarkEvent) => void;

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Statistical analysis result
 */
export interface StatisticalAnalysis {
  /** Mean value */
  mean: number;
  /** Median value */
  median: number;
  /** Mode value */
  mode: number;
  /** Standard deviation */
  standardDeviation: number;
  /** Variance */
  variance: number;
  /** Coefficient of variation */
  cv: number;
  /** Skewness */
  skewness: number;
  /** Kurtosis */
  kurtosis: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Range */
  range: number;
  /** Interquartile range */
  iqr: number;
  /** Percentiles */
  percentiles: Record<number, number>;
  /** Outliers */
  outliers: number[];
}

/**
 * Percentile configuration
 */
export interface PercentileConfig {
  /** Percentile values to calculate */
  values: number[];
  /** Calculation method */
  method: 'linear' | 'nearest' | 'midpoint';
}

/**
 * Outlier detection result
 */
export interface OutlierDetection {
  /** Indices of outliers */
  indices: number[];
  /** Values of outliers */
  values: number[];
  /** Method used */
  method: string;
  /** Threshold value */
  threshold: number;
  /** Count of outliers */
  count: number;
}

/**
 * Confidence interval
 */
export interface ConfidenceInterval {
  /** Lower bound */
  lower: number;
  /** Upper bound */
  upper: number;
  /** Confidence level (0-1) */
  level: number;
  /** Margin of error */
  marginOfError: number;
}
