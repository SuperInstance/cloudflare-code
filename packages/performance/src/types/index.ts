/**
 * Performance monitoring and optimization types
 */

// Performance Metrics
export interface PerformanceMetrics {
  // Timing metrics
  duration: number;
  startTime: number;
  endTime: number;

  // CPU metrics
  cpuUsage: number;
  cpuTime: number;

  // Memory metrics
  memoryUsed: number;
  memoryTotal: number;
  memoryPercentage: number;

  // Event loop metrics
  eventLoopLag: number;
  eventLoopUtilization: number;

  // Custom metrics
  customMetrics?: Record<string, number>;
}

// Profile Snapshot
export interface ProfileSnapshot {
  timestamp: number;
  metrics: PerformanceMetrics;
  stackTrace?: StackFrame[];
  memorySnapshot?: MemorySnapshot;
  cpuProfile?: CPUProfile;
}

// Stack Frame
export interface StackFrame {
  functionName: string;
  scriptName: string;
  lineNumber: number;
  columnNumber: number;
  isNative: boolean;
}

// Memory Snapshot
export interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  heapSpaces?: HeapSpace[];
}

// Heap Space
export interface HeapSpace {
  name: string;
  size: number;
  used: number;
  available: number;
}

// CPU Profile
export interface CPUProfile {
  samples: number[];
  timestamps: number[];
  nodes: CPUProfileNode[];
}

// CPU Profile Node
export interface CPUProfileNode {
  id: number;
  callFrame: StackFrame;
  children?: number[];
  hitCount?: number;
}

// Benchmark Result
export interface BenchmarkResult {
  name: string;
  suite: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  stdDev: number;
  percentile95: number;
  percentile99: number;
  opsPerSecond: number;
  samples: number[];
  metrics: PerformanceMetrics;
  timestamp: number;
}

// Benchmark Suite
export interface BenchmarkSuite {
  name: string;
  description: string;
  benchmarks: Benchmark[];
  setup?: () => void | Promise<void>;
  teardown?: () => void | Promise<void>;
  beforeAll?: () => void | Promise<void>;
  afterAll?: () => void | Promise<void>;
}

// Benchmark
export interface Benchmark {
  name: string;
  description?: string;
  fn: () => void | Promise<void>;
  options?: BenchmarkOptions;
  skip?: boolean;
  only?: boolean;
}

// Benchmark Options
export interface BenchmarkOptions {
  iterations?: number;
  time?: number;
  warmupIterations?: number;
  setup?: () => void | Promise<void>;
  teardown?: () => void | Promise<void>;
  beforeEach?: () => void | Promise<void>;
  afterEach?: () => void | Promise<void>;
}

// Load Test Configuration
export interface LoadTestConfig {
  name: string;
  target: string; // URL to test
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  connections: number;
  duration: number; // seconds
  pipelining: number;
  timeout: number;
  maxConnectionRequests?: number;
  amount?: number;
  rate?: number;
  recovery?: number;
  requests: {
    body?: any;
    headers?: Record<string, string>;
    query?: Record<string, string>;
  };
  expectations?: LoadTestExpectations;
}

// Load Test Expectations
export interface LoadTestExpectations {
  maxLatency?: number; // milliseconds
  minThroughput?: number; // requests per second
  maxErrorRate?: number; // percentage (0-100)
  p95Latency?: number;
  p99Latency?: number;
}

// Load Test Result
export interface LoadTestResult {
  name: string;
  target: string;
  timestamp: number;
  duration: number;
  requests: {
    total: number;
    successful: number;
    failed: number;
    timeout: number;
  };
  latency: {
    min: number;
    max: number;
    mean: number;
    stdDev: number;
    percentile95: number;
    percentile99: number;
  };
  throughput: {
    mean: number; // requests per second
    min: number;
    max: number;
  };
  errors: ErrorSample[];
  expectations?: ExpectationResult[];
  cpuUsage?: number;
  memoryUsage?: number;
}

// Error Sample
export interface ErrorSample {
  error: string;
  count: number;
  firstOccurrence: number;
  stackTrace?: string;
}

// Expectation Result
export interface ExpectationResult {
  name: string;
  expected: number;
  actual: number;
  passed: boolean;
  threshold?: 'max' | 'min';
}

// Optimization Recommendation
export interface OptimizationRecommendation {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: OptimizationCategory;
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  codeLocation?: {
    file: string;
    line: number;
    column: number;
  };
  fix?: {
    description: string;
    code?: string;
    codeDiff?: string;
  };
  metrics?: {
    before: number;
    after: number;
    improvement: number;
  };
  references?: string[];
}

// Optimization Category
export type OptimizationCategory =
  | 'memory-leak'
  | 'cpu-usage'
  | 'event-loop'
  | 'bundle-size'
  | 'cold-start'
  | 'network'
  | 'caching'
  | 'database'
  | 'algorithm'
  | 'code-quality';

// Regression Detection Result
export interface RegressionResult {
  detected: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  regressions: Regression[];
  baseline: PerformanceBaseline;
  current: PerformanceBaseline;
  timestamp: number;
}

// Regression
export interface Regression {
  metric: string;
  baseline: number;
  current: number;
  degradation: number; // percentage
  threshold: number; // percentage
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: number; // 0-1
}

// Performance Baseline
export interface PerformanceBaseline {
  name: string;
  timestamp: number;
  commit?: string;
  branch?: string;
  metrics: {
    [key: string]: number;
  };
  benchmarks: BenchmarkResult[];
  loadTests: LoadTestResult[];
}

// Profiler Configuration
export interface ProfilerConfig {
  enabled: boolean;
  sampleInterval?: number; // milliseconds
  maxSamples?: number;
  includeStackTrace?: boolean;
  includeMemorySnapshot?: boolean;
  includeCPUProfile?: boolean;
  filters?: ProfilerFilter[];
}

// Profiler Filter
export interface ProfilerFilter {
  type: 'include' | 'exclude';
  pattern: string | RegExp;
  property?: 'functionName' | 'scriptName';
}

// Performance Report
export interface PerformanceReport {
  id: string;
  timestamp: number;
  type: 'benchmark' | 'load-test' | 'profile' | 'regression';
  summary: PerformanceReportSummary;
  details: {
    benchmarks?: BenchmarkResult[];
    loadTests?: LoadTestResult[];
    profiles?: ProfileSnapshot[];
    regressions?: RegressionResult[];
    recommendations?: OptimizationRecommendation[];
  };
  metadata: Record<string, any>;
}

// Performance Report Summary
export interface PerformanceReportSummary {
  totalTests: number;
  passed: number;
  failed: number;
  warnings: number;
  overallScore: number; // 0-100
  criticalIssues: number;
  recommendations: number;
}

// Performance Target
export interface PerformanceTarget {
  metric: string;
  target: number;
  threshold: number; // percentage tolerance
  direction: 'lower-is-better' | 'higher-is-better';
  category: 'latency' | 'throughput' | 'resource' | 'custom';
}

// Cloudflare Worker Specific Metrics
export interface WorkerMetrics {
  coldStart: number;
  warmStart: number;
  executionTime: number;
  cpuTime: number;
  memoryUsed: number;
  kvReads: number;
  kvWrites: number;
  r2Requests: number;
  doRequests: number;
  subrequests: number;
  errors: number;
  exceptions: number;
}

// WebSocket Performance Metrics
export interface WebSocketMetrics {
  messageLatency: number;
  messagesPerSecond: number;
  connectionsPerSecond: number;
  activeConnections: number;
  droppedConnections: number;
  errorRate: number;
}
