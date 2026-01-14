/**
 * Core type definitions for the Performance Profiler package
 */

// ============================================================================
// CPU Profiling Types
// ============================================================================

export interface CPUProfileFrame {
  name: string;
  scriptId?: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
}

export interface CPUProfileNode {
  id: number;
  callFrame: CPUProfileFrame;
  hitCount: number;
  children: CPUProfileNode[];
  parent?: CPUProfileNode;
  depth: number;
}

export interface CPUProfileSample {
  timestamp: number;
  nodeId: number;
  cpuTime: number;
}

export interface CPUProfileData {
  startTime: number;
  endTime: number;
  nodes: CPUProfileNode[];
  samples: CPUProfileSample[];
  totalDuration: number;
  samplingInterval: number;
}

export interface HotPathResult {
  path: CPUProfileNode[];
  totalSelfTime: number;
  totalTime: number;
  percentage: number;
  depth: number;
}

// ============================================================================
// Memory Profiling Types
// ============================================================================

export interface MemorySnapshot {
  id: string;
  timestamp: number;
  totalSize: number;
  usedSize: number;
  freeSize: number;
  heapSpaces: HeapSpace[];
  objects: HeapObject[];
}

export interface HeapSpace {
  name: string;
  size: number;
  used: number;
  available: number;
  physicalSize: number;
}

export interface HeapObject {
  id: string;
  type: string;
  name: string;
  size: number;
  retainedSize: number;
  distance: number;
  dominator?: string;
  references: string[];
}

export interface MemoryAllocation {
  objectId: string;
  type: string;
  size: number;
  timestamp: number;
  stackTrace: StackFrame[];
  deallocated?: boolean;
  deallocationTime?: number;
}

export interface MemoryLeak {
  objectId: string;
  type: string;
  size: number;
  allocationTime: number;
  suspectedLeak: boolean;
  confidence: number;
  references: string[];
  stackTrace: StackFrame[];
}

export interface GCPause {
  startTime: number;
  endTime: number;
  duration: number;
  type: 'scavenge' | 'mark-sweep-compact' | 'incremental-marking' | 'processing-weak-callbacks';
  paused: boolean;
  heapSizeBefore: number;
  heapSizeAfter: number;
}

// ============================================================================
// Tracing Types
// ============================================================================

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  duration: number;
  tags: Record<string, string | number | boolean>;
  logs: TraceLog[];
  references: SpanReference[];
  status: SpanStatus;
}

export interface TraceLog {
  timestamp: number;
  fields: Record<string, unknown>;
}

export interface SpanReference {
  traceId: string;
  spanId: string;
  refType: 'child-of' | 'follows-from';
}

export interface SpanStatus {
  code: number;
  message?: string;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  baggage: Record<string, string>;
  sampled: boolean;
}

export interface CriticalPath {
  traceId: string;
  path: TraceSpan[];
  totalDuration: number;
  criticalDuration: number;
  bottlenecks: Bottleneck[];
}

export interface Bottleneck {
  spanId: string;
  operationName: string;
  duration: number;
  impact: number;
  suggestion?: string;
}

// ============================================================================
// Performance Analytics Types
// ============================================================================

export interface PerformanceMetrics {
  timestamp: number;
  cpu: CPUMetrics;
  memory: MemoryMetrics;
  network: NetworkMetrics;
  custom: Record<string, number>;
}

export interface CPUMetrics {
  usage: number;
  userTime: number;
  systemTime: number;
  idleTime: number;
}

export interface MemoryMetrics {
  used: number;
  total: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
}

export interface NetworkMetrics {
  requests: number;
  bytesReceived: number;
  bytesSent: number;
  errors: number;
  latency: number;
}

export interface PerformanceBaseline {
  id: string;
  name: string;
  timestamp: number;
  metrics: PerformanceMetrics;
  metadata: Record<string, unknown>;
}

export interface PerformanceRegression {
  id: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  baseline: number;
  current: number;
  delta: number;
  deltaPercent: number;
  confidence: number;
  description: string;
}

export interface PerformanceTrend {
  metric: string;
  direction: 'improving' | 'degrading' | 'stable';
  slope: number;
  rSquared: number;
  significance: number;
  prediction?: number[];
}

// ============================================================================
// Optimization Types
// ============================================================================

export interface OptimizationRecommendation {
  id: string;
  type: OptimizationType;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  location?: CodeLocation;
  impact: {
    metric: string;
    improvement: number;
    confidence: number;
  };
  effort: 'easy' | 'medium' | 'hard';
  codeExample?: string;
  resources: string[];
}

export type OptimizationType =
  | 'caching'
  | 'database-query'
  | 'network-batching'
  | 'lazy-loading'
  | 'code-optimization'
  | 'memory-leak'
  | 'algorithm'
  | 'parallelization'
  | 'compression'
  | 'indexing';

export interface CodeLocation {
  file: string;
  line: number;
  column: number;
  function?: string;
}

export interface OptimizationQueue {
  items: OptimizationRecommendation[];
  totalImpact: number;
  totalEffort: number;
  completionTime?: number;
}

// ============================================================================
// Benchmark Types
// ============================================================================

export interface BenchmarkSuite {
  id: string;
  name: string;
  description: string;
  benchmarks: Benchmark[];
  setup?: () => void | Promise<void>;
  teardown?: () => void | Promise<void>;
}

export interface Benchmark {
  id: string;
  name: string;
  fn: BenchmarkFn;
  options: BenchmarkOptions;
  metadata?: Record<string, unknown>;
}

export type BenchmarkFn = (env: BenchmarkEnvironment) => unknown | Promise<unknown>;

export interface BenchmarkOptions {
  iterations?: number;
  duration?: number;
  warmupIterations?: number;
  setup?: () => void | Promise<void>;
  teardown?: () => void | Promise<void>;
  beforeEach?: () => void | Promise<void>;
  afterEach?: () => void | Promise<void>;
}

export interface BenchmarkEnvironment {
  iteration: number;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export interface BenchmarkResult {
  benchmarkId: string;
  suiteId: string;
  timestamp: number;
  iterations: number;
  duration: number;
  stats: BenchmarkStatistics;
  samples: number[];
  metadata: Record<string, unknown>;
}

export interface BenchmarkStatistics {
  min: number;
  max: number;
  mean: number;
  median: number;
  mode: number;
  stdDev: number;
  variance: number;
  percentiles: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
    p999: number;
  };
  throughput?: number;
}

export interface BenchmarkComparison {
  baseline: BenchmarkResult;
  current: BenchmarkResult;
  difference: number;
  differencePercent: number;
  significance: number;
  improved: boolean;
  regression: boolean;
}

// ============================================================================
// Visualization Types
// ============================================================================

export interface FlameGraphData {
  name: string;
  value: number;
  children: FlameGraphData[];
  depth: number;
}

export interface CallTree {
  name: string;
  value: number;
  selfTime: number;
  children: CallTree[];
  expanded: boolean;
}

export interface TimeSeriesData {
  timestamp: number;
  value: number;
  label?: string;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  borderColor?: string;
  backgroundColor?: string;
  fill?: boolean;
}

// ============================================================================
// Network Profiling Types
// ============================================================================

export interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  startTime: number;
  endTime: number;
  duration: number;
  status: number;
  requestSize: number;
  responseSize: number;
  timing: NetworkTiming;
  headers: Record<string, string>;
  cacheHit?: boolean;
}

export interface NetworkTiming {
  dns: number;
  tcp: number;
  tls: number;
  ttfb: number;
  download: number;
  total: number;
}

export interface NetworkProfile {
  requests: NetworkRequest[];
  totalBytes: number;
  totalDuration: number;
  averageLatency: number;
  errorRate: number;
  cacheHitRate: number;
}

// ============================================================================
// Stack Trace Types
// ============================================================================

export interface StackFrame {
  functionName: string;
  scriptId?: string;
  url?: string;
  lineNumber: number;
  columnNumber: number;
  source?: string;
}

// ============================================================================
// Profiler Configuration Types
// ============================================================================

export interface ProfilerConfig {
  enabled: boolean;
  samplingInterval?: number;
  maxMemoryUsage?: number;
  maxProfiles?: number;
  autoStart?: boolean;
  filters?: ProfilerFilter[];
  output?: ProfilerOutput;
}

export interface ProfilerFilter {
  type: 'include' | 'exclude';
  pattern: string | RegExp;
  field: 'functionName' | 'url' | 'scriptId';
}

export interface ProfilerOutput {
  format: 'json' | 'protobuf' | 'chrome-trace';
  destination: 'file' | 'memory' | 'stream';
  path?: string;
  maxSize?: number;
}

// ============================================================================
// Event Types
// ============================================================================

export type ProfilerEvent =
  | { type: 'profile-started'; timestamp: number }
  | { type: 'profile-stopped'; timestamp: number; data: CPUProfileData }
  | { type: 'memory-snapshot'; timestamp: number; snapshot: MemorySnapshot }
  | { type: 'leak-detected'; timestamp: number; leak: MemoryLeak }
  | { type: 'regression-detected'; timestamp: number; regression: PerformanceRegression }
  | { type: 'threshold-exceeded'; timestamp: number; metric: string; value: number; threshold: number }
  | { type: 'benchmark-completed'; timestamp: number; result: BenchmarkResult }
  | { type: 'error'; timestamp: number; error: Error };

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}

export interface IDisposable {
  dispose(): void | Promise<void>;
}
