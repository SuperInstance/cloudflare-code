/**
 * Core trace and span types for distributed tracing
 * Compatible with OpenTelemetry specification
 */

import { SpanKind, SpanStatusCode, Attributes } from '@opentelemetry/api';

/**
 * Trace ID - 16-byte identifier (32 hex characters)
 */
export type TraceId = string;

/**
 * Span ID - 8-byte identifier (16 hex characters)
 */
export type SpanId = string;

/**
 * Timestamp in microseconds since Unix epoch
 */
export type Timestamp = number;

/**
 * Duration in microseconds
 */
export type Duration = number;

/**
 * Span status codes
 */
export enum SpanStatus {
  UNSET = 0,
  OK = 1,
  ERROR = 2,
}

/**
 * Span kind defining the role of the span in a trace
 */
export enum SpanKindEnum {
  INTERNAL = 'INTERNAL',
  SERVER = 'SERVER',
  CLIENT = 'CLIENT',
  PRODUCER = 'PRODUCER',
  CONSUMER = 'CONSUMER',
}

/**
 * Link to another span
 */
export interface SpanLink {
  traceId: TraceId;
  spanId: SpanId;
  attributes?: Attributes;
  droppedAttributesCount?: number;
}

/**
 * Event within a span
 */
export interface SpanEvent {
  name: string;
  timestamp: Timestamp;
  attributes?: Attributes;
  droppedAttributesCount?: number;
}

/**
 * Single span in a distributed trace
 */
export interface Span {
  traceId: TraceId;
  spanId: SpanId;
  parentSpanId?: SpanId;
  traceState?: string;

  // Span identification
  name: string;
  kind: SpanKind | SpanKindEnum;

  // Temporal data
  startTime: Timestamp;
  endTime?: Timestamp;
  duration?: Duration;

  // Status
  status: {
    code: SpanStatus | SpanStatusCode;
    message?: string;
  };

  // Attributes and metadata
  attributes?: Attributes;
  events?: SpanEvent[];
  links?: SpanLink[];

  // Service information
  service: string;
  serviceVersion?: string;
  hostName?: string;
  ip?: string;

  // Resource attributes
  resource?: Attributes;

  // Dropping
  droppedAttributesCount?: number;
  droppedEventsCount?: number;
  droppedLinksCount?: number;

  // Custom extensions
  extensions?: Record<string, unknown>;
}

/**
 * Complete distributed trace
 */
export interface Trace {
  traceId: TraceId;
  rootSpan: Span;
  spans: Span[];

  // Trace metadata
  startTime: Timestamp;
  endTime: Timestamp;
  duration: Duration;
  spanCount: number;

  // Service information
  services: TraceService[];
  serviceMap: Map<string, TraceService>;

  // Trace quality
  completeness: TraceCompleteness;

  // Derived metrics
  metrics?: TraceMetrics;

  // Analysis results
  analysis?: TraceAnalysis;
}

/**
 * Service information within a trace
 */
export interface TraceService {
  name: string;
  version?: string;
  spanCount: number;
  errorCount: number;
  totalDuration: Duration;
  avgDuration: Duration;
  minDuration: Duration;
  maxDuration: Duration;
}

/**
 * Trace completeness metrics
 */
export interface TraceCompleteness {
  hasRootSpan: boolean;
  allSpansConnected: boolean;
  orphanedSpans: number;
  missingSpans: number;
  completenessScore: number; // 0-1
}

/**
 * Trace-level metrics
 */
export interface TraceMetrics {
  totalSpans: number;
  errorSpans: number;
  errorRate: number;
  totalDuration: Duration;
  avgDuration: Duration;
  minDuration: Duration;
  maxDuration: Duration;
  p50Duration: Duration;
  p95Duration: Duration;
  p99Duration: Duration;
}

/**
 * Trace analysis results
 */
export interface TraceAnalysis {
  bottlenecks: Bottleneck[];
  criticalPath: CriticalPath;
  errorAnalysis: ErrorAnalysis;
  latencyAnalysis: LatencyAnalysis;
  performanceInsights: PerformanceInsight[];
}

/**
 * Bottleneck in trace execution
 */
export interface Bottleneck {
  spanId: SpanId;
  spanName: string;
  service: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  impact: number;
  suggestions: string[];
}

/**
 * Critical path through the trace
 */
export interface CriticalPath {
  spans: SpanId[];
  totalDuration: Duration;
  pathPercentage: number;
  steps: CriticalPathStep[];
}

/**
 * Single step in critical path
 */
export interface CriticalPathStep {
  spanId: SpanId;
  spanName: string;
  duration: Duration;
  percentage: number;
  service: string;
}

/**
 * Error analysis results
 */
export interface ErrorAnalysis {
  totalErrors: number;
  errorRate: number;
  errorSpans: Span[];
  errorPatterns: ErrorPattern[];
  rootCauses: RootCause[];
}

/**
 * Pattern in errors
 */
export interface ErrorPattern {
  type: string;
  message: string;
  count: number;
  affectedSpans: SpanId[];
  service: string;
}

/**
 * Root cause analysis
 */
export interface RootCause {
  description: string;
  confidence: number;
  spanId: SpanId;
  evidence: string[];
}

/**
 * Latency analysis results
 */
export interface LatencyAnalysis {
  percentiles: {
    p50: Duration;
    p75: Duration;
    p90: Duration;
    p95: Duration;
    p99: Duration;
    p999: Duration;
  };
  outliers: Span[];
  slowOperations: SlowOperation[];
  timeDistribution: TimeDistribution[];
}

/**
 * Slow operation identified
 */
export interface SlowOperation {
  spanId: SpanId;
  spanName: string;
  service: string;
  duration: Duration;
  expectedDuration: Duration;
  slownessFactor: number;
}

/**
 * Time distribution bucket
 */
export interface TimeDistribution {
  range: [number, number];
  count: number;
  percentage: number;
}

/**
 * Performance insight
 */
export interface PerformanceInsight {
  type: 'optimization' | 'warning' | 'info' | 'success';
  category: string;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  recommendations: string[];
}

/**
 * Service dependency information
 */
export interface ServiceDependency {
  from: string;
  to: string;
  operation?: string;
  callCount: number;
  avgLatency: Duration;
  minLatency: Duration;
  maxLatency: Duration;
  p95Latency: Duration;
  p99Latency: Duration;
  errorRate: number;
  lastSeen: Timestamp;
}

/**
 * Service dependency graph
 */
export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: ServiceDependency[];
  metrics: DependencyGraphMetrics;
}

/**
 * Node in dependency graph
 */
export interface DependencyNode {
  service: string;
  version?: string;
  inboundCalls: number;
  outboundCalls: number;
  totalCalls: number;
  errorRate: number;
  avgLatency: Duration;
}

/**
 * Dependency graph metrics
 */
export interface DependencyGraphMetrics {
  totalServices: number;
  totalDependencies: number;
  avgDepth: number;
  maxDepth: number;
  criticalPath: string[];
}

/**
 * Trace collection options
 */
export interface CollectionOptions {
  endpoint?: string;
  apiKey?: string;
  batchSize?: number;
  flushInterval?: number;
  maxBufferSize?: number;
  compression?: boolean;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * Trace aggregation options
 */
export interface AggregationOptions {
  timeout?: number;
  maxSpansPerTrace?: number;
  validateStructure?: boolean;
  enrichWithMetadata?: boolean;
  indexForSearch?: boolean;
}

/**
 * Trace analysis options
 */
export interface AnalysisOptions {
  includeBottlenecks?: boolean;
  includeCriticalPath?: boolean;
  includeErrorAnalysis?: boolean;
  includeLatencyAnalysis?: boolean;
  includePerformanceInsights?: boolean;
  bottleneckThreshold?: number;
  slowOperationThreshold?: number;
  outlierThreshold?: number;
}

/**
 * Trace export options
 */
export interface ExportOptions {
  format?: 'json' | 'protobuf' | 'jaeger' | 'zipkin';
  includeMetrics?: boolean;
  includeAnalysis?: boolean;
  pretty?: boolean;
  compress?: boolean;
}

/**
 * Trace query filters
 */
export interface TraceQuery {
  traceIds?: TraceId[];
  service?: string;
  minDuration?: Duration;
  maxDuration?: Duration;
  hasErrors?: boolean;
  startTime?: Timestamp;
  endTime?: Timestamp;
  limit?: number;
  offset?: number;
  orderBy?: 'duration' | 'startTime' | 'spanCount';
  orderDirection?: 'asc' | 'desc';
}

/**
 * Trace query result
 */
export interface TraceQueryResult {
  traces: Trace[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Span validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error';
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  severity: 'warning';
}

/**
 * Span enrichment data
 */
export interface SpanEnrichment {
  geoip?: {
    country?: string;
    city?: string;
    region?: string;
  };
  user?: {
    id?: string;
    segment?: string;
  };
  environment?: {
    name: string;
    tier: string;
  };
  deployment?: {
    version: string;
    build: string;
  };
}

/**
 * Trace buffer entry
 */
export interface BufferEntry {
  span: Span;
  timestamp: Timestamp;
  size: number;
  retryCount: number;
}

/**
 * Buffer statistics
 */
export interface BufferStats {
  currentSize: number;
  maxSize: number;
  utilization: number;
  droppedSpans: number;
  flushCount: number;
}

/**
 * Collection statistics
 */
export interface CollectionStats {
  spansCollected: number;
  spansProcessed: number;
  spansDropped: number;
  tracesCompleted: number;
  avgProcessingTime: number;
  bytesProcessed: number;
}

/**
 * Aggregation statistics
 */
export interface AggregationStats {
  tracesAggregated: number;
  spansAggregated: number;
  avgAggregationTime: number;
  aggregationErrors: number;
  orphanedSpans: number;
}

/**
 * Analysis statistics
 */
export interface AnalysisStats {
  tracesAnalyzed: number;
  avgAnalysisTime: number;
  bottlenecksFound: number;
  errorsAnalyzed: number;
  insightsGenerated: number;
}
