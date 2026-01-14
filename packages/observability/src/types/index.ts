/**
 * Core types and interfaces for the observability system
 */

import { Span, SpanContext, SpanKind, SpanStatusCode, Attributes } from '@opentelemetry/api';

/**
 * Trace information with context propagation
 */
export interface TraceInfo {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled: boolean;
  baggage?: Record<string, string>;
}

/**
 * Span metadata for extended tracking
 */
export interface SpanMetadata {
  name: string;
  kind: SpanKind;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: SpanStatusCode;
  statusMessage?: string;
  attributes: Attributes;
  events: SpanEvent[];
  links: SpanLink[];
  resource: Resource;
}

/**
 * Span event with timestamp
 */
export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes: Attributes;
}

/**
 * Span link to other spans
 */
export interface SpanLink {
  context: SpanContext;
  attributes: Attributes;
}

/**
 * Resource information
 */
export interface Resource {
  serviceName: string;
  serviceVersion?: string;
  deploymentEnvironment?: string;
  hostName?: string;
  attributes: Attributes;
}

/**
 * Trace tree structure for visualization
 */
export interface TraceTreeNode {
  span: SpanMetadata;
  children: TraceTreeNode[];
  depth: number;
}

/**
 * Service map node
 */
export interface ServiceMapNode {
  serviceName: string;
  type: 'service' | 'database' | 'cache' | 'external' | 'queue';
  endpointCount: number;
  errorRate: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  requestRate: number;
}

/**
 * Service map edge
 */
export interface ServiceMapEdge {
  from: string;
  to: string;
  requestCount: number;
  errorCount: number;
  avgLatency: number;
}

/**
 * Complete service map
 */
export interface ServiceMap {
  nodes: ServiceMapNode[];
  edges: ServiceMapEdge[];
  timestamp: number;
}

/**
 * Log levels
 */
export enum LogLevel {
  TRACE = 'trace',
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * Structured log entry
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  requestId?: string;
  attributes: Attributes;
  error?: ErrorInfo;
  stackTrace?: string;
}

/**
 * Error information
 */
export interface ErrorInfo {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  type?: string;
}

/**
 * Log aggregation result
 */
export interface LogAggregation {
  countByLevel: Record<LogLevel, number>;
  topErrors: Array<{ error: string; count: number }>;
  logsByTrace: Record<string, LogEntry[]>;
  timeSeriesData: TimeSeriesPoint[];
  errorRate: number;
  avgLevel: number;
}

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
  level?: LogLevel;
}

/**
 * Log filter criteria
 */
export interface LogFilter {
  levels?: LogLevel[];
  startTime?: number;
  endTime?: number;
  traceId?: string;
  userId?: string;
  requestId?: string;
  searchQuery?: string;
  minLevel?: LogLevel;
  attributes?: Attributes;
}

/**
 * Profile sample
 */
export interface ProfileSample {
  timestamp: number;
  stacks: string[][];
  weights: number[];
  duration: number;
}

/**
 * Flame graph frame
 */
export interface FlameGraphFrame {
  name: string;
  value: number;
  children: FlameGraphFrame[];
  depth: number;
}

/**
 * CPU profile data
 */
export interface CPUProfile {
  pid: number;
  tid: number;
  startTime: number;
  endTime: number;
  samples: ProfileSample[];
  frames: FrameInfo[];
}

/**
 * Frame information
 */
export interface FrameInfo {
  name: string;
  filename: string;
  functionName: string;
  lineNumber: number;
  columnNumber: number;
}

/**
 * Hot path analysis result
 */
export interface HotPath {
  path: string[];
  totalTime: number;
  selfTime: number;
  percentage: number;
  callCount: number;
}

/**
 * Bottleneck detection result
 */
export interface Bottleneck {
  location: string;
  type: 'cpu' | 'memory' | 'io' | 'network';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: number;
  suggestion: string;
}

/**
 * Heap snapshot
 */
export interface HeapSnapshot {
  id: string;
  timestamp: number;
  totalSize: number;
  nodes: HeapNode[];
  edges: HeapEdge[];
  strings: string[];
}

/**
 * Heap node
 */
export interface HeapNode {
  id: number;
  type: string;
  name: string;
  selfSize: number;
  retainedSize: number;
  edgeCount: number;
  children: number[];
}

/**
 * Heap edge
 */
export interface HeapEdge {
  from: number;
  to: number;
  type: string;
  name?: string;
}

/**
 * Memory leak detection result
 */
export interface MemoryLeak {
  type: string;
  size: number;
  count: number;
  retentionPath: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

/**
 * Memory timeline data point
 */
export interface MemoryTimelinePoint {
  timestamp: number;
  used: number;
  total: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
}

/**
 * Retained size analysis
 */
export interface RetainedSizeAnalysis {
  objectId: number;
  retainedSize: number;
  retainingPaths: RetainingPath[];
}

/**
 * Retaining path
 */
export interface RetainingPath {
  path: Array<{ nodeId: number; edge: string }>;
  size: number;
}

/**
 * HTTP request inspection data
 */
export interface RequestInspection {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  cookies: Record<string, string>;
  body?: any;
  traceId?: string;
  spanId?: string;
}

/**
 * HTTP response inspection data
 */
export interface ResponseInspection {
  id: string;
  requestId: string;
  timestamp: number;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: any;
  timing: TimingInfo;
  traceId?: string;
  spanId?: string;
}

/**
 * Timing information
 */
export interface TimingInfo {
  startTime: number;
  endTime: number;
  duration: number;
  dnsLookup?: number;
  tcpConnection?: number;
  tlsHandshake?: number;
  ttfb?: number;
  download?: number;
}

/**
 * Request/response pair
 */
export interface RequestResponsePair {
  request: RequestInspection;
  response: ResponseInspection;
  traceId?: string;
  spanId?: string;
}

/**
 * Inspection filter
 */
export interface InspectionFilter {
  startTime?: number;
  endTime?: number;
  method?: string;
  url?: string;
  minStatus?: number;
  maxStatus?: number;
  traceId?: string;
  hasError?: boolean;
}

/**
 * Debug session
 */
export interface DebugSession {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  status: 'active' | 'paused' | 'completed';
  traceId?: string;
  breakpointIds: string[];
  watchExpressions: string[];
}

/**
 * Breakpoint
 */
export interface Breakpoint {
  id: string;
  sessionId: string;
  file: string;
  line: number;
  column?: number;
  condition?: string;
  hitCount: number;
  enabled: boolean;
}

/**
 * Variable inspection
 */
export interface VariableInspection {
  name: string;
  value: any;
  type: string;
  properties?: VariableInspection[];
  scope: 'local' | 'closure' | 'global' | 'catch';
  readonly?: boolean;
}

/**
 * Watch expression result
 */
export interface WatchExpression {
  id: string;
  sessionId: string;
  expression: string;
  value: any;
  type: string;
  error?: string;
}

/**
 * Step action for debugging
 */
export enum StepAction {
  CONTINUE = 'continue',
  STEP_OVER = 'stepOver',
  STEP_IN = 'stepIn',
  STEP_OUT = 'stepOut',
  PAUSE = 'pause',
}

/**
 * Debug recording frame
 */
export interface DebugFrame {
  timestamp: number;
  action: StepAction;
  file: string;
  line: number;
  callStack: CallStackFrame[];
  variables: VariableInspection[];
  watchResults: WatchExpression[];
}

/**
 * Call stack frame
 */
export interface CallStackFrame {
  functionName: string;
  fileId: string;
  lineNumber: number;
  columnNumber: number;
  scriptId?: string;
}

/**
 * Debug recording
 */
export interface DebugRecording {
  sessionId: string;
  frames: DebugFrame[];
  metadata: {
    startTime: number;
    endTime: number;
    totalFrames: number;
    recordingDuration: number;
  };
}

/**
 * Replay state
 */
export interface ReplayState {
  currentFrame: number;
  isPlaying: boolean;
  playbackSpeed: number;
  filters: ReplayFilter;
}

/**
 * Replay filter
 */
export interface ReplayFilter {
  startTime?: number;
  endTime?: number;
  files?: string[];
  functions?: string[];
  variables?: string[];
}

/**
 * Export format for traces
 */
export interface ExportedTrace {
  format: 'json' | 'protobuf' | 'jaeger';
  data: string | Uint8Array;
  timestamp: number;
}

/**
 * Export format for logs
 */
export interface ExportedLogs {
  format: 'json' | 'csv' | 'ndjson';
  entries: LogEntry[];
  timestamp: number;
}

/**
 * Export format for profiles
 */
export interface ExportedProfile {
  format: 'json' | 'pprof' | 'chrome';
  data: CPUProfile | string;
  timestamp: number;
}

/**
 * Observability configuration
 */
export interface ObservabilityConfig {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  environment: string;

  // Tracing config
  tracing: {
    enabled: boolean;
    sampleRate: number;
    exporter: 'otlp' | 'jaeger' | 'zipkin' | 'console';
    exporterEndpoint?: string;
    propagateHeaders: string[];
    batchSize: number;
    batchTimeout: number;
  };

  // Logging config
  logging: {
    enabled: boolean;
    level: LogLevel;
    format: 'json' | 'pretty';
    exporter: 'console' | 'otlp' | 'custom';
    exporterEndpoint?: string;
    correlationEnabled: boolean;
  };

  // Profiling config
  profiling: {
    enabled: boolean;
    interval: number;
    duration: number;
    maxSamples: number;
    exporter: 'otlp' | 'custom';
  };

  // Memory config
  memory: {
    enabled: boolean;
    samplingInterval: number;
    heapSnapshotInterval: number;
    leakDetectionThreshold: number;
  };

  // Inspection config
  inspection: {
    enabled: boolean;
    recordHeaders: boolean;
    recordBody: boolean;
    maxBodySize: number;
    maskSensitiveHeaders: string[];
  };

  // Recording config
  recording: {
    enabled: boolean;
    maxSessionDuration: number;
    maxFramesPerSession: number;
    autoRecordOnError: boolean;
  };
}
