// @ts-nocheck
/**
 * Core type definitions for ClaudeFlare Data Pipelines
 */

// ============================================================================
// Pipeline Types
// ============================================================================

export type PipelineStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface PipelineConfig {
  id: string;
  name: string;
  description?: string;
  version: string;
  status: PipelineStatus;
  schedule?: ScheduleConfig;
  sources: DataSource[];
  transforms: TransformConfig[];
  destinations: DataDestination[];
  quality?: QualityConfig;
  monitoring?: MonitoringConfig;
  metadata?: Record<string, unknown>;
}

export type PipelineType = 'streaming' | 'batch' | 'hybrid';

export interface PipelineExecution {
  pipelineId: string;
  executionId: string;
  startTime: Date;
  endTime?: Date;
  status: PipelineStatus;
  recordsProcessed: number;
  recordsFailed: number;
  metrics: ExecutionMetrics;
  errors: PipelineError[];
}

export interface ExecutionMetrics {
  throughput: number; // records per second
  latency: number; // milliseconds
  memoryUsage: number; // bytes
  cpuUsage: number; // percentage
  customMetrics?: Record<string, number>;
}

export interface PipelineError {
  code: string;
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
  stack?: string;
}

// ============================================================================
// Schedule Types
// ============================================================================

export type ScheduleType = 'cron' | 'interval' | 'event-driven' | 'manual';

export interface ScheduleConfig {
  type: ScheduleType;
  expression?: string; // cron expression
  interval?: number; // milliseconds
  timezone?: string;
  startTime?: Date;
  endTime?: Date;
  maxRuns?: number;
}

// ============================================================================
// Data Source Types
// ============================================================================

export type DataSourceType =
  | 'rest-api'
  | 'graphql-api'
  | 'webhook'
  | 'sse'
  | 'kafka'
  | 'kinesis'
  | 'websocket'
  | 'postgresql'
  | 'mysql'
  | 'mongodb'
  | 'redis'
  | 'd1'
  | 'kv'
  | 'r2'
  | 'csv'
  | 'json'
  | 'parquet'
  | 'avro'
  | 'xml';

export interface DataSource {
  id: string;
  type: DataSourceType;
  config: DataSourceConfig;
  schema?: DataSchema;
  batching?: BatchingConfig;
  metadata?: Record<string, unknown>;
}

export type DataSourceConfig =
  | RestApiConfig
  | GraphQLApiConfig
  | WebhookConfig
  | SSEConfig
  | KafkaConfig
  | KinesisConfig
  | WebSocketConfig
  | DatabaseConfig
  | CloudflareStorageConfig
  | FileConfig;

export interface RestApiConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  params?: Record<string, string>;
  body?: unknown;
  auth?: AuthConfig;
  pagination?: PaginationConfig;
  rateLimit?: RateLimitConfig;
}

export interface GraphQLApiConfig {
  url: string;
  query: string;
  variables?: Record<string, unknown>;
  headers?: Record<string, string>;
  auth?: AuthConfig;
}

export interface WebhookConfig {
  path: string;
  method: 'POST' | 'PUT' | 'PATCH';
  auth?: AuthConfig;
  validation?: WebhookValidationConfig;
  rateLimit?: RateLimitConfig;
}

export interface SSEConfig {
  url: string;
  headers?: Record<string, string>;
  auth?: AuthConfig;
  reconnectInterval?: number;
}

export interface KafkaConfig {
  brokers: string[];
  topic: string;
  groupId?: string;
  clientId?: string;
  auth?: KafkaAuthConfig;
  offset?: 'earliest' | 'latest' | 'none';
}

export interface KinesisConfig {
  streamName: string;
  region: string;
  shardIteratorType?: 'TRIM_HORIZON' | 'LATEST' | 'AT_TIMESTAMP';
  timestamp?: Date;
}

export interface WebSocketConfig {
  url: string;
  protocols?: string[];
  auth?: AuthConfig;
  reconnectInterval?: number;
  heartbeatInterval?: number;
}

export interface DatabaseConfig {
  connectionString: string;
  query: string;
  params?: unknown[];
  batchSize?: number;
  pollingInterval?: number;
}

export interface CloudflareStorageConfig {
  accountId: string;
  namespaceId?: string;
  bucketId?: string;
  query?: string;
  prefix?: string;
}

export interface FileConfig {
  path?: string;
  url?: string;
  format: 'csv' | 'json' | 'parquet' | 'avro' | 'xml';
  compression?: 'gzip' | 'bz2' | 'zip' | 'none';
  encoding?: string;
  delimiter?: string; // for CSV
  header?: boolean; // for CSV
}

// ============================================================================
// Authentication Types
// ============================================================================

export type AuthType = 'none' | 'basic' | 'bearer' | 'oauth2' | 'api-key' | 'jwt' | 'custom';

export interface AuthConfig {
  type: AuthType;
  credentials?: Record<string, string>;
}

export interface KafkaAuthConfig {
  type: 'none' | 'sasl' | 'ssl' | 'sasl-ssl';
  username?: string;
  password?: string;
  mechanism?: 'PLAIN' | 'SCRAM-SHA-256' | 'SCRAM-SHA-512';
}

// ============================================================================
// Pagination Types
// ============================================================================

export type PaginationType = 'none' | 'offset' | 'cursor' | 'page' | 'link-header';

export interface PaginationConfig {
  type: PaginationType;
  pageSize?: number;
  maxPages?: number;
  pageSizeParam?: string;
  pageParam?: string;
  cursorParam?: string;
  nextLinkSelector?: string;
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  burstSize?: number;
}

// ============================================================================
// Webhook Validation Types
// ============================================================================

export interface WebhookValidationConfig {
  type: 'hmac' | 'signature' | 'jwt' | 'custom';
  secret?: string;
  algorithm?: string;
  header?: string;
}

// ============================================================================
// Batching Types
// ============================================================================

export interface BatchingConfig {
  enabled: boolean;
  maxSize?: number; // records
  maxBytes?: number; // bytes
  maxTime?: number; // milliseconds
  alignment?: boolean;
}

// ============================================================================
// Data Schema Types
// ============================================================================

export interface DataSchema {
  type: 'json-schema' | 'avro' | 'parquet' | 'protobuf' | 'custom';
  definition: unknown;
  version?: string;
}

// ============================================================================
// Transform Types
// ============================================================================

export type TransformType =
  | 'map'
  | 'filter'
  | 'aggregate'
  | 'join'
  | 'window'
  | 'normalize'
  | 'enrich'
  | 'validate'
  | 'custom';

export interface TransformConfig {
  id: string;
  type: TransformType;
  config: TransformOperationConfig;
  condition?: string; // expression
}

export type TransformOperationConfig =
  | MapTransformConfig
  | FilterTransformConfig
  | AggregateTransformConfig
  | JoinTransformConfig
  | WindowTransformConfig
  | NormalizeTransformConfig
  | EnrichTransformConfig
  | ValidateTransformConfig
  | CustomTransformConfig;

export interface MapTransformConfig {
  script: string; // JavaScript expression or function
  language?: 'javascript' | 'typescript';
}

export interface FilterTransformConfig {
  condition: string; // expression
  language?: 'javascript' | 'jmespath';
}

export interface AggregateTransformConfig {
  groupBy?: string[];
  aggregations: AggregationConfig[];
  window?: WindowConfig;
}

export interface AggregationConfig {
  field: string;
  operation: AggregationOperation;
  alias?: string;
}

export type AggregationOperation =
  | 'count'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'first'
  | 'last'
  | 'stddev'
  | 'variance'
  | 'percentile';

export interface JoinTransformConfig {
  sources: string[];
  joinType: 'inner' | 'left' | 'right' | 'full' | 'cross';
  keys: Record<string, string>;
}

export interface WindowConfig {
  type: 'tumbling' | 'sliding' | 'session';
  size: number; // milliseconds or count
  slide?: number; // milliseconds
  gap?: number; // milliseconds (for session windows)
}

export interface NormalizeTransformConfig {
  operations: NormalizationOperation[];
}

export interface NormalizationOperation {
  field: string;
  operation: 'lowercase' | 'uppercase' | 'trim' | 'replace' | 'format-date' | 'format-number';
  params?: Record<string, unknown>;
}

export interface EnrichTransformConfig {
  source: string;
  mappings: Record<string, string>;
  cache?: CacheConfig;
}

export interface ValidateTransformConfig {
  schema: DataSchema;
  mode: 'strict' | 'lenient' | 'log-only';
  onFailure: 'drop' | ' quarantine' | 'transform';
}

export interface CustomTransformConfig {
  code: string;
  language: 'javascript' | 'typescript' | 'wasm';
  dependencies?: string[];
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheConfig {
  enabled: boolean;
  ttl?: number; // milliseconds
  maxSize?: number;
  backend?: 'memory' | 'kv' | 'redis';
}

// ============================================================================
// Destination Types
// ============================================================================

export type DestinationType =
  | 'rest-api'
  | 'graphql-api'
  | 'webhook'
  | 'kafka'
  | 'kinesis'
  | 'websocket'
  | 'postgresql'
  | 'mysql'
  | 'mongodb'
  | 'redis'
  | 'd1'
  | 'kv'
  | 'r2'
  | 'csv'
  | 'json'
  | 'parquet'
  | 'avro';

export interface DataDestination {
  id: string;
  type: DestinationType;
  config: DestinationConfig;
  schema?: DataSchema;
  batching?: BatchingConfig;
  retry?: RetryConfig;
  metadata?: Record<string, unknown>;
}

export type DestinationConfig =
  | RestApiConfig
  | GraphQLApiConfig
  | WebhookConfig
  | KafkaConfig
  | KinesisConfig
  | WebSocketConfig
  | DatabaseConfig
  | CloudflareStorageConfig
  | FileConfig;

// ============================================================================
// Retry Types
// ============================================================================

export interface RetryConfig {
  maxAttempts: number;
  backoff: 'fixed' | 'exponential' | 'linear';
  initialDelay: number; // milliseconds
  maxDelay?: number; // milliseconds
  multiplier?: number; // for exponential backoff
  jitter?: boolean;
}

// ============================================================================
// Quality Types
// ============================================================================

export interface QualityConfig {
  enabled: boolean;
  rules: QualityRule[];
  actions: QualityAction[];
}

export interface QualityRule {
  id: string;
  name: string;
  type: QualityRuleType;
  config: QualityRuleConfig;
  severity: 'error' | 'warning' | 'info';
}

export type QualityRuleType =
  | 'schema-validation'
  | 'completeness'
  | 'uniqueness'
  | 'accuracy'
  | 'timeliness'
  | 'consistency'
  | 'custom';

export interface QualityRuleConfig {
  field?: string;
  condition?: string;
  threshold?: number;
  reference?: string;
  custom?: Record<string, unknown>;
}

export type QualityAction =
  | 'drop'
  | 'quarantine'
  | 'transform'
  | 'alert'
  | 'retry';

// ============================================================================
// Monitoring Types
// ============================================================================

export interface MonitoringConfig {
  enabled: boolean;
  metrics: MetricConfig[];
  alerts: AlertConfig[];
  logging?: LoggingConfig;
}

export interface MetricConfig {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  labels?: string[];
  buckets?: number[];
}

export interface AlertConfig {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  window: number; // milliseconds
  actions: AlertAction[];
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'slack' | 'pagerduty' | 'custom';
  config: Record<string, unknown>;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
  sampling?: number; // 0-1
}

// ============================================================================
// Stream Processing Types
// ============================================================================

export interface StreamEvent {
  key: string;
  value: unknown;
  timestamp: Date;
  headers?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface WindowOperation {
  type: 'tumbling' | 'sliding' | 'session';
  size: number;
  slide?: number;
  gap?: number;
}

export interface AggregateResult {
  windowStart: Date;
  windowEnd: Date;
  key?: string;
  value: Record<string, unknown>;
}

// ============================================================================
// Batch Processing Types
// ============================================================================

export interface BatchJob {
  id: string;
  name: string;
  config: BatchJobConfig;
  status: BatchJobStatus;
  runs: BatchJobRun[];
}

export type BatchJobStatus = 'scheduled' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface BatchJobConfig {
  schedule: ScheduleConfig;
  source: DataSource;
  transforms: TransformConfig[];
  destination: DataDestination;
  errorHandling?: ErrorHandlingConfig;
  resourceLimits?: ResourceLimitsConfig;
}

export interface BatchJobRun {
  runId: string;
  startTime: Date;
  endTime?: Date;
  status: BatchJobStatus;
  inputRecords: number;
  outputRecords: number;
  errorRecords: number;
  metrics: ExecutionMetrics;
}

export interface ErrorHandlingConfig {
  maxErrors: number;
  errorThreshold: number; // percentage
  onMaxErrors: 'continue' | 'abort' | 'retry';
  deadletterQueue?: string;
}

export interface ResourceLimitsConfig {
  maxMemory?: number; // bytes
  maxCpu?: number; // percentage
  maxDuration?: number; // milliseconds
  maxConcurrency?: number;
}

// ============================================================================
// Data Transformation DSL Types
// ============================================================================

export interface TransformationPipeline {
  steps: TransformationStep[];
  metadata?: PipelineMetadata;
}

export interface TransformationStep {
  id: string;
  name: string;
  type: TransformType;
  config: TransformOperationConfig;
  dependencies?: string[]; // step IDs
}

export interface PipelineMetadata {
  version: string;
  author?: string;
  description?: string;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================================================
// Data Profiling Types
// ============================================================================

export interface DataProfile {
  fieldProfiles: FieldProfile[];
  summary: ProfileSummary;
  timestamp: Date;
}

export interface FieldProfile {
  name: string;
  type: string;
  nullCount: number;
  nullPercentage: number;
  uniqueCount: number;
  uniquePercentage: number;
  statistics?: FieldStatistics;
  patterns?: PatternMatch[];
}

export interface FieldStatistics {
  numeric?: NumericStatistics;
  string?: StringStatistics;
  temporal?: TemporalStatistics;
}

export interface NumericStatistics {
  min: number;
  max: number;
  mean: number;
  median: number;
  mode?: number;
  stddev: number;
  variance: number;
  percentiles?: Record<string, number>;
}

export interface StringStatistics {
  minLength: number;
  maxLength: number;
  meanLength: number;
  mostCommon: string[];
  pattern?: string;
}

export interface TemporalStatistics {
  min: Date;
  max: Date;
  mean?: Date;
  mostCommon?: Date[];
}

export interface PatternMatch {
  pattern: string;
  count: number;
  percentage: number;
  sample?: string[];
}

export interface ProfileSummary {
  totalRecords: number;
  totalFields: number;
  completeFields: number;
  completenessScore: number;
  uniquenessScore: number;
  validityScore: number;
}

// ============================================================================
// Anomaly Detection Types
// ============================================================================

export interface AnomalyDetector {
  type: AnomalyDetectorType;
  config: AnomalyDetectorConfig;
}

export type AnomalyDetectorType =
  | 'statistical'
  | 'ml-based'
  | 'rule-based'
  | 'time-series'
  | 'custom';

export interface AnomalyDetectorConfig {
  sensitivity: 'low' | 'medium' | 'high';
  threshold?: number;
  windowSize?: number;
  features?: string[];
  model?: unknown;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  score: number;
  confidence: number;
  reasons: string[];
  timestamp: Date;
}

// ============================================================================
// Orchestration Types
// ============================================================================

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  version: string;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables?: Record<string, unknown>;
  schedules?: ScheduleConfig[];
}

export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  config: NodeConfig;
  position: { x: number; y: number };
  retry?: RetryConfig;
  timeout?: number;
}

export type NodeType =
  | 'source'
  | 'transform'
  | 'destination'
  | 'condition'
  | 'parallel'
  | 'sequence'
  | 'sub-workflow';

export interface NodeConfig {
  [key: string]: unknown;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
  label?: string;
}

export interface WorkflowExecution {
  workflowId: string;
  executionId: string;
  status: PipelineStatus;
  startTime: Date;
  endTime?: Date;
  nodeExecutions: NodeExecution[];
  variables: Record<string, unknown>;
  error?: PipelineError;
}

export interface NodeExecution {
  nodeId: string;
  status: PipelineStatus;
  startTime: Date;
  endTime?: Date;
  input?: unknown;
  output?: unknown;
  error?: PipelineError;
  metrics: ExecutionMetrics;
}

// ============================================================================
// Event Types
// ============================================================================

export interface PipelineEvent {
  type: EventType;
  pipelineId: string;
  timestamp: Date;
  data: unknown;
}

export type EventType =
  | 'pipeline.started'
  | 'pipeline.completed'
  | 'pipeline.failed'
  | 'pipeline.paused'
  | 'pipeline.resumed'
  | 'transform.started'
  | 'transform.completed'
  | 'transform.failed'
  | 'quality.check.failed'
  | 'alert.triggered'
  | 'custom';

// ============================================================================
// Utility Types
// ============================================================================

export type JsonObject = Record<string, JsonValue>;
export type JsonArray = JsonValue[];
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;

export interface AsyncIterator<T> {
  next(): Promise<IteratorResult<T>>;
}

export interface ReadableStream<T> {
  read(): Promise<T | null>;
  close(): Promise<void>;
  [Symbol.asyncIterator](): AsyncIterator<T>;
}
