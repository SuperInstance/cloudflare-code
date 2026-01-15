/**
 * Core types and interfaces for the distributed logging system
 */

// ============================================================================
// Log Entry Types
// ============================================================================

/**
 * Log severity levels following standard conventions
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
}

/**
 * Standard log entry structure
 */
export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  metadata?: LogMetadata;
  context?: LogContext;
  tags?: string[];
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  service: string;
  host?: string;
  environment?: string;
  stackTrace?: string;
  error?: ErrorInfo;
}

/**
 * Additional metadata for log entries
 */
export interface LogMetadata {
  [key: string]:
    | string
    | number
    | boolean
    | null
    | undefined
    | LogMetadata
    | Array<string | number | boolean | null | undefined>;
}

/**
 * Log context for correlation
 */
export interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  tenantId?: string;
  workflowId?: string;
  deploymentId?: string;
  buildId?: string;
}

/**
 * Error information for error logs
 */
export interface ErrorInfo {
  name: string;
  message: string;
  code?: string;
  stack?: string;
  cause?: ErrorInfo;
}

// ============================================================================
// Log Collection Types
// ============================================================================

/**
 * Log collection options
 */
export interface CollectionOptions {
  batchSize?: number;
  bufferTimeout?: number;
  compression?: CompressionType;
  enrichment?: boolean;
  validation?: boolean;
  deduplication?: boolean;
}

/**
 * Compression types for log storage
 */
export enum CompressionType {
  NONE = 'none',
  GZIP = 'gzip',
  LZ4 = 'lz4',
  SNAPPY = 'snappy',
}

/**
 * Log batch for bulk operations
 */
export interface LogBatch {
  entries: LogEntry[];
  metadata: BatchMetadata;
}

/**
 * Metadata for log batches
 */
export interface BatchMetadata {
  batchId: string;
  timestamp: number;
  count: number;
  sizeBytes: number;
  source: string;
  compression?: CompressionType;
}

// ============================================================================
// Log Aggregation Types
// ============================================================================

/**
 * Aggregation strategies
 */
export enum AggregationType {
  TEMPORAL = 'temporal',
  SERVICE = 'service',
  TRACE = 'trace',
  SESSION = 'session',
  ERROR = 'error',
  CUSTOM = 'custom',
}

/**
 * Aggregation configuration
 */
export interface AggregationConfig {
  type: AggregationType;
  windowSize?: number;
  groupBy?: string[];
  filters?: LogFilter[];
  maxGroups?: number;
  ttl?: number;
}

/**
 * Log aggregation result
 */
export interface AggregationResult {
  key: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  entries: LogEntry[];
  summary?: AggregationSummary;
}

/**
 * Summary statistics for aggregated logs
 */
export interface AggregationSummary {
  avgDuration?: number;
  errorCount: number;
  warningCount: number;
  uniqueUsers: number;
  topServices: Array<{ service: string; count: number }>;
  topErrors: Array<{ error: string; count: number }>;
}

// ============================================================================
// Log Search Types
// ============================================================================

/**
 * Search query for logs
 */
export interface SearchQuery {
  query?: string;
  filters?: LogFilter[];
  timeRange?: TimeRange;
  level?: LogLevel;
  limit?: number;
  offset?: number;
  sortBy?: SortField;
  sortOrder?: SortOrder;
  highlight?: boolean;
  aggregations?: AggregationConfig[];
}

/**
 * Filter for log search
 */
export interface LogFilter {
  field: string;
  operator: FilterOperator;
  value: any;
}

/**
 * Filter operators
 */
export enum FilterOperator {
  EQUALS = 'eq',
  NOT_EQUALS = 'ne',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUAL = 'lte',
  IN = 'in',
  NOT_IN = 'not_in',
  REGEX = 'regex',
  EXISTS = 'exists',
  NOT_EXISTS = 'not_exists',
}

/**
 * Time range for queries
 */
export interface TimeRange {
  start: number;
  end: number;
}

/**
 * Sortable fields
 */
export enum SortField {
  TIMESTAMP = 'timestamp',
  LEVEL = 'level',
  SERVICE = 'service',
  MESSAGE = 'message',
  DURATION = 'duration',
}

/**
 * Sort order
 */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

/**
 * Search result
 */
export interface SearchResult {
  entries: LogEntry[];
  total: number;
  took: number;
  aggregations?: Map<string, AggregationResult>;
  suggestions?: string[];
}

// ============================================================================
// Log Analytics Types
// ============================================================================

/**
 * Analytics metrics
 */
export interface LogMetrics {
  volume: VolumeMetrics;
  errors: ErrorMetrics;
  performance: PerformanceMetrics;
  availability: AvailabilityMetrics;
  custom?: Map<string, number>;
}

/**
 * Volume metrics
 */
export interface VolumeMetrics {
  totalLogs: number;
  logsPerSecond: number;
  bytesPerSecond: number;
  avgLogSize: number;
  peakLogsPerSecond: number;
}

/**
 * Error metrics
 */
export interface ErrorMetrics {
  totalErrors: number;
  errorRate: number;
  topErrors: Array<{ error: string; count: number; rate: number }>;
  errorTrend: Array<{ timestamp: number; count: number }>;
  criticalErrors: number;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  slowestOperations: Array<{ operation: string; duration: number }>;
}

/**
 * Availability metrics
 */
export interface AvailabilityMetrics {
  uptime: number;
  downtime: number;
  availabilityRate: number;
  incidents: number;
  mtbf: number; // Mean time between failures
  mttr: number; // Mean time to recovery
}

/**
 * Anomaly detection result
 */
export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  timestamp: number;
  description: string;
  affectedServices: string[];
  metrics: AnomalyMetrics;
  suggestions?: string[];
}

/**
 * Anomaly types
 */
export enum AnomalyType {
  SPIKE = 'spike',
  DROP = 'drop',
  ERROR_SURGE = 'error_surge',
  PERFORMANCE_DEGRADATION = 'performance_degradation',
  PATTERN_MISMATCH = 'pattern_mismatch',
  UNUSUAL_CORRELATION = 'unusual_correlation',
}

/**
 * Anomaly severity levels
 */
export enum AnomalySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Metrics for anomalies
 */
export interface AnomalyMetrics {
  expectedValue: number;
  actualValue: number;
  deviation: number;
  confidence: number;
  baseline: number[];
}

// ============================================================================
// Storage Types
// ============================================================================

/**
 * Storage configuration
 */
export interface StorageConfig {
  type: StorageType;
  connection: StorageConnection;
  retention: RetentionPolicy;
  indexing: IndexingConfig;
  compression?: CompressionType;
}

/**
 * Storage types
 */
export enum StorageType {
  D1 = 'd1',
  R2 = 'r2',
  HYBRID = 'hybrid',
}

/**
 * Storage connection details
 */
export interface StorageConnection {
  connectionString?: string;
  accountId?: string;
  databaseId?: string;
  bucketName?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  endpoint?: string;
}

/**
 * Retention policy
 */
export interface RetentionPolicy {
  hotTTL: number; // milliseconds
  warmTTL: number; // milliseconds
  coldTTL: number; // milliseconds
  archiveAfter: number; // milliseconds
  deleteAfter: number; // milliseconds
}

/**
 * Indexing configuration
 */
export interface IndexingConfig {
  enabled: boolean;
  fields: string[];
  fullTextSearch: boolean;
  facetFields: string[];
}

/**
 * Archive entry
 */
export interface ArchiveEntry {
  id: string;
  periodStart: number;
  periodEnd: number;
  logCount: number;
  sizeBytes: number;
  location: string;
  compressed: boolean;
  checksum: string;
}

// ============================================================================
// Streaming Types
// ============================================================================

/**
 * Stream configuration
 */
export interface StreamConfig {
  enabled: boolean;
  bufferSize?: number;
  flushInterval?: number;
  retries?: number;
  backoffMs?: number;
}

/**
 * Stream event
 */
export interface StreamEvent {
  type: StreamEventType;
  data: LogEntry | LogBatch | SearchQuery;
  timestamp: number;
}

/**
 * Stream event types
 */
export enum StreamEventType {
  LOG_RECEIVED = 'log_received',
  BATCH_FLUSHED = 'batch_flushed',
  SEARCH_COMPLETED = 'search_completed',
  AGGREGATION_COMPLETED = 'aggregation_completed',
  ANOMALY_DETECTED = 'anomaly_detected',
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Main distributed logging configuration
 */
export interface DistributedLoggingConfig {
  service: string;
  environment: string;
  collection: CollectionOptions;
  aggregation: AggregationConfig[];
  storage: StorageConfig;
  search: SearchConfig;
  analytics: AnalyticsConfig;
  streaming: StreamConfig;
  monitoring?: MonitoringConfig;
}

/**
 * Search configuration
 */
export interface SearchConfig {
  enabled: boolean;
  maxResults: number;
  timeout: number;
  cacheSize?: number;
  cacheTTL?: number;
}

/**
 * Analytics configuration
 */
export interface AnalyticsConfig {
  enabled: boolean;
  anomalyDetection: AnomalyDetectionConfig;
  metrics: MetricsConfig;
}

/**
 * Anomaly detection configuration
 */
export interface AnomalyDetectionConfig {
  enabled: boolean;
  algorithms: AnomalyAlgorithm[];
  sensitivity: number;
  windowSize: number;
  minDataPoints: number;
}

/**
 * Anomaly detection algorithms
 */
export enum AnomalyAlgorithm {
  Z_SCORE = 'z_score',
  IQR = 'iqr',
  MOVING_AVERAGE = 'moving_average',
  EXPONENTIAL_SMOOTHING = 'exponential_smoothing',
  MACHINE_LEARNING = 'machine_learning',
}

/**
 * Metrics configuration
 */
export interface MetricsConfig {
  retentionPeriod: number;
  aggregationInterval: number;
  enabledMetrics: string[];
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  enabled: boolean;
  healthCheckInterval: number;
  metricsEndpoint?: string;
  alertThresholds: AlertThresholds;
}

/**
 * Alert thresholds
 */
export interface AlertThresholds {
  errorRate: number;
  responseTime: number;
  logVolume: number;
  storageUsage: number;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: ResponseMetadata;
}

/**
 * API error
 */
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  stack?: string;
}

/**
 * Response metadata
 */
export interface ResponseMetadata {
  timestamp: number;
  requestId: string;
  duration: number;
  version: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Deep partial type for configuration updates
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Promise result type
 */
export type PromiseResult<T> = [Error | null, T | null];

/**
 * Log entry with optional fields
 */
export type PartialLogEntry = Partial<LogEntry> &
  Pick<LogEntry, 'message' | 'level' | 'service'>;
