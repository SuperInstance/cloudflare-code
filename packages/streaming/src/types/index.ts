// @ts-nocheck
/**
 * Core type definitions for the streaming infrastructure
 */

// ============================================================================
// Event Types
// ============================================================================

export interface StreamEvent<T = unknown> {
  id: string;
  type: string;
  data: T;
  timestamp: number;
  metadata?: EventMetadata;
  headers?: Record<string, string>;
}

export interface EventMetadata {
  source?: string;
  correlationId?: string;
  causationId?: string;
  userId?: string;
  sessionId?: string;
  version?: number;
  tags?: string[];
  [key: string]: unknown;
}

export interface EventFilter {
  types?: string[];
  source?: string;
  tags?: string[];
  timeRange?: TimeRange;
  custom?: (event: StreamEvent) => boolean;
}

export interface TimeRange {
  start: number;
  end: number;
}

// ============================================================================
// Stream Types
// ============================================================================

export interface StreamOptions {
  batchSize?: number;
  batchTimeout?: number;
  compression?: boolean;
  encryption?: boolean;
  retention?: RetentionPolicy;
}

export interface RetentionPolicy {
  duration?: number; // milliseconds
  maxSize?: number; // bytes
  maxEvents?: number;
}

export interface StreamStats {
  eventCount: number;
  byteSize: number;
  lastEventTime: number;
  firstEventTime: number;
  averageEventRate: number; // events per second
}

// ============================================================================
// Message Queue Types
// ============================================================================

export interface Message<T = unknown> {
  id: string;
  payload: T;
  priority?: number;
  attempts?: number;
  maxAttempts?: number;
  timeout?: number;
  deadline?: number;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  createdAt: number;
  scheduledAt?: number;
  expiresAt?: number;
  correlationId?: string;
  groupId?: string;
  deduplicationId?: string;
}

export type QueueType = 'fifo' | 'priority' | 'delayed';

export interface QueueOptions {
  type?: QueueType;
  maxSize?: number;
  deadLetterQueue?: string;
  retention?: number;
  deliveryDelay?: number;
  receiveWaitTime?: number;
  visibilityTimeout?: number;
}

export interface DeliveryGuarantee {
  type: 'at-most-once' | 'at-least-once' | 'exactly-once';
  idempotenceKey?: string;
}

// ============================================================================
// Stream Processing Types
// ============================================================================

export interface StreamProcessor<TInput = unknown, TOutput = unknown> {
  process(event: TInput): Promise<TOutput | TOutput[]>;
}

export interface WindowOptions {
  size: number; // window size in milliseconds
  slide?: number; // slide interval in milliseconds
  type: 'tumbling' | 'sliding' | 'session';
  sessionTimeout?: number; // for session windows
}

export interface Aggregation<T> {
  accumulator: (acc: T, event: StreamEvent) => T;
  initialValue: T;
  seed?: T;
}

export interface JoinOptions {
  type: 'inner' | 'left' | 'right' | 'outer' | 'stream-stream';
  window: WindowOptions;
  keySelector: (event: StreamEvent) => string;
}

export interface CEPPattern {
  id: string;
  pattern: PatternExpression;
  actions: PatternAction[];
  within?: number; // time window for pattern matching
}

export interface PatternExpression {
  type: 'sequence' | 'and' | 'or' | 'not' | 'repeat';
  children?: PatternExpression[];
  filter?: (event: StreamEvent) => boolean;
  times?: { min?: number; max?: number };
}

export interface PatternAction {
  type: 'alert' | 'aggregate' | 'transform' | 'route';
  handler: (events: StreamEvent[]) => Promise<void>;
}

// ============================================================================
// Event Sourcing Types
// ============================================================================

export interface StoredEvent extends StreamEvent {
  streamId: string;
  streamVersion: number;
  commitId: string;
  committedAt: number;
}

export interface EventStream {
  id: string;
  type: string;
  version: number;
  metadata?: StreamMetadata;
}

export interface StreamMetadata {
  createdAt: number;
  updatedAt: number;
  snapshotVersion?: number;
  lastSnapshotAt?: number;
  maxVersion?: number;
}

export interface Snapshot {
  streamId: string;
  version: number;
  state: unknown;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface Projection {
  id: string;
  name: string;
  lastEventPosition: number;
  state: unknown;
  updatedAt: number;
}

export interface CQRSQuery {
  queryId: string;
  queryType: string;
  parameters: Record<string, unknown>;
  timestamp: number;
}

export interface CQRSCommand {
  commandId: string;
  commandType: string;
  payload: unknown;
  expectedVersion?: number;
  timestamp: number;
}

// ============================================================================
// Pub/Sub Types
// ============================================================================

export interface Topic {
  name: string;
  partitions: number;
  retention: RetentionPolicy;
  subscriptions: string[];
  createdAt: number;
}

export interface Subscription {
  id: string;
  topic: string;
  subscriberId: string;
  filter?: SubscriptionFilter;
  createdAt: number;
  position?: SubscriptionPosition;
}

export interface SubscriptionFilter {
  types?: string[];
  attributes?: Record<string, string>;
  expression?: string; // SQL-like filter expression
}

export interface SubscriptionPosition {
  partition: number;
  offset: number;
}

export interface PublishOptions {
  partitionKey?: string;
  orderingKey?: string;
  delay?: number;
  attributes?: Record<string, string>;
}

export interface Subscriber {
  id: string;
  endpoint: string;
  protocol: 'http' | 'websocket' | 'sse';
  config?: SubscriberConfig;
}

export interface SubscriberConfig {
  batchSize?: number;
  maxConcurrency?: number;
  retryPolicy?: RetryPolicy;
  transformation?: string; // transformation pipeline ID
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface StreamMetrics {
  eventCount: number;
  eventRate: number; // events per second
  byteRate: number; // bytes per second
  latency: LatencyMetrics;
  throughput: ThroughputMetrics;
  errors: ErrorMetrics;
}

export interface LatencyMetrics {
  p50: number;
  p95: number;
  p99: number;
  p999: number;
  avg: number;
  min: number;
  max: number;
}

export interface ThroughputMetrics {
  current: number;
  peak: number;
  average: number;
}

export interface ErrorMetrics {
  count: number;
  rate: number;
  types: Record<string, number>;
  lastError?: Error;
}

export interface AnomalyDetection {
  enabled: boolean;
  algorithm: 'statistical' | 'ml' | 'hybrid';
  sensitivity: 'low' | 'medium' | 'high';
  threshold: number;
  windowSize: number;
}

export interface AnomalyAlert {
  id: string;
  type: 'spike' | 'drop' | 'pattern' | 'statistical';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  metrics: StreamMetrics;
  confidence: number;
}

export interface PatternMatch {
  patternId: string;
  events: StreamEvent[];
  timestamp: number;
  confidence: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Backpressure Types
// ============================================================================

export interface BackpressureStrategy {
  type: 'drop' | 'buffer' | 'throttle' | 'reject' | 'custom';
  bufferSize?: number;
  throttleRate?: number; // operations per second
  dropPolicy?: 'oldest' | 'newest' | 'lowest-priority';
  customHandler?: (item: unknown) => Promise<void>;
}

export interface FlowControlConfig {
  windowSize: number;
  maxConcurrent: number;
  timeout: number;
  retryPolicy: RetryPolicy;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoff: 'fixed' | 'exponential' | 'linear';
  initialDelay: number;
  maxDelay: number;
  multiplier?: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  halfOpenMaxCalls: number;
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastStateChange: number;
}

// ============================================================================
// Transport Types
// ============================================================================

export interface SSEConnection {
  id: string;
  clientId: string;
  lastEventId?: string;
  connectedAt: number;
  filters?: EventFilter[];
  retry?: number;
}

export interface WebSocketConnection extends SSEConnection {
  subprotocol?: string;
  extensions?: string[];
}

export interface SSEEvent {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

// ============================================================================
// Common Types
// ============================================================================

export interface Result<T = unknown, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
  metadata?: Record<string, unknown>;
}

export interface RetryableResult<T = unknown> extends Result<T> {
  retryable: boolean;
  retryAfter?: number;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  checks: Record<string, boolean>;
  message?: string;
}

export interface Telemetry {
  metrics: StreamMetrics;
  health: HealthCheck;
  performance: PerformanceMetrics;
}

export interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  bufferUtilization: number;
  queueDepth: number;
  activeConnections: number;
}

// ============================================================================
// Durable Object Types (Cloudflare Workers)
// ============================================================================

declare global {
  interface DurableObjectStorage {
    get(key: string): Promise<any>;
    put(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
    list(): Promise<any[]>;
  }

  interface DurableObjectId {
    toString(): string;
  }

  interface KVNamespace {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
  }

  interface DurableObjectNamespace {
    get(id: string): any;
  }
}

export interface DurableObjectState {
  storage: any;
  id: any;
  env: Env;
}

export interface Env {
  STREAMING_KV: any;
  STREAMING_DO: any;
  QUEUE_DO: any;
  ANALYTICS_DO: any;
}

// All types are already exported above - no need to re-export
