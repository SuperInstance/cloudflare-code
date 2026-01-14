/**
 * Core type definitions for the observability package
 */

// ============================================================================
// Tracing Types
// ============================================================================

export interface TraceOptions {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  samplingRate?: number;
  exporter?: TraceExporter;
  attributes?: Record<string, string | number | boolean>;
}

export type TraceExporter = 'jaeger' | 'zipkin' | 'honeycomb' | 'otlp' | 'console';

export interface SpanOptions {
  name: string;
  kind?: SpanKind;
  attributes?: Record<string, string | number | boolean | string[]>;
  links?: SpanLink[];
  startTime?: number;
  parentSpan?: SpanContext;
}

export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer';

export interface SpanContext {
  traceId: string;
  spanId: string;
  traceFlags?: number;
}

export interface SpanLink {
  context: SpanContext;
  attributes?: Record<string, string | number | boolean>;
}

export interface SamplingStrategy {
  shouldSample(context: SamplingContext): boolean;
}

export interface SamplingContext {
  traceId: string;
  spanName: string;
  spanKind?: SpanKind;
  attributes?: Record<string, string | number | boolean>;
}

export interface TraceExportResult {
  exportedSpans: number;
  failedSpans: number;
  duration: number;
}

// ============================================================================
// Metrics Types
// ============================================================================

export interface MetricOptions {
  name: string;
  description?: string;
  unit?: string;
  labels?: Record<string, string>;
  enabled?: boolean;
}

export interface CounterOptions extends MetricOptions {
  initialValue?: number;
}

export interface GaugeOptions extends MetricOptions {
  initialValue?: number;
}

export interface HistogramOptions extends MetricOptions {
  buckets?: number[];
  min?: number;
  max?: number;
}

export interface MetricData {
  name: string;
  type: MetricType;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface AggregationWindow {
  duration: number;
  alignTo?: number;
}

export interface PercentileValues {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface MetricExportOptions {
  format: 'prometheus' | 'cloudflare' | 'json';
  includeTimestamp?: boolean;
  aggregationWindow?: AggregationWindow;
}

// ============================================================================
// Logging Types
// ============================================================================

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LoggerOptions {
  level?: LogLevel;
  format?: LogFormat;
  output?: LogOutput;
  correlation?: LogCorrelationOptions;
  redaction?: LogRedactionOptions;
  sampling?: LogSamplingOptions;
}

export type LogFormat = 'json' | 'text' | 'pretty';

export type LogOutput = 'console' | 'file' | 'stream' | 'remote';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: LogContext;
  error?: ErrorInfo;
  traceId?: string;
  spanId?: string;
  metadata?: Record<string, unknown>;
}

export interface LogContext {
  userId?: string;
  requestId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

export interface ErrorInfo {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  metadata?: Record<string, unknown>;
}

export interface LogCorrelationOptions {
  enableTraceCorrelation: boolean;
  traceIdField?: string;
  spanIdField?: string;
}

export interface LogRedactionOptions {
  enabled: boolean;
  patterns?: RedactionPattern[];
  fields?: string[];
}

export interface RedactionPattern {
  pattern: RegExp;
  replacement: string;
}

export interface LogSamplingOptions {
  enabled: boolean;
  rate?: number;
  minLevel?: LogLevel;
}

// ============================================================================
// Alerting Types
// ============================================================================

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: AlertCondition;
  actions: AlertAction[];
  enabled: boolean;
  severity: AlertSeverity;
  cooldown?: number;
  labels?: Record<string, string>;
}

export interface AlertCondition {
  type: AlertConditionType;
  metric?: string;
  threshold?: number;
  operator?: AlertOperator;
  duration?: number;
  aggregation?: AlertAggregation;
}

export type AlertConditionType = 
  | 'threshold' 
  | 'anomaly' 
  | 'rate' 
  | 'pattern' 
  | 'composite';

export type AlertOperator = 
  | 'gt' 
  | 'gte' 
  | 'lt' 
  | 'lte' 
  | 'eq' 
  | 'neq';

export type AlertAggregation = 
  | 'avg' 
  | 'sum' 
  | 'min' 
  | 'max' 
  | 'count' 
  | 'percentile';

export type AlertSeverity = 'info' | 'warning' | 'critical' | 'fatal';

export interface AlertAction {
  type: AlertActionType;
  config: NotificationConfig;
}

export type AlertActionType = 
  | 'email' 
  | 'slack' 
  | 'pagerduty' 
  | 'webhook' 
  | 'sns';

export interface NotificationConfig {
  recipients?: string[];
  webhookUrl?: string;
  template?: string;
  customPayload?: Record<string, unknown>;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  message: string;
  value: number;
  timestamp: number;
  resolvedAt?: number;
  metadata: Record<string, unknown>;
  status: AlertStatus;
}

export type AlertStatus = 'firing' | 'resolved' | 'acknowledged' | 'suppressed';

export interface AlertEscalationPolicy {
  levels: EscalationLevel[];
  repeatInterval?: number;
  maxEscalations?: number;
}

export interface EscalationLevel {
  delay: number;
  actions: AlertAction[];
}

export interface OnCallRotation {
  id: string;
  name: string;
  schedule: RotationSchedule;
  members: string[];
  timezone: string;
}

export interface RotationSchedule {
  type: 'daily' | 'weekly' | 'custom';
  rotationPeriod: number;
  startDate: number;
}

// ============================================================================
// Dashboard Types
// ============================================================================

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: Widget[];
  layout: DashboardLayout;
  refreshInterval?: number;
  timeRange: TimeRange;
  variables?: DashboardVariable[];
  permissions: DashboardPermissions;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  position: WidgetPosition;
  size: WidgetSize;
  config: WidgetConfig;
  queries: WidgetQuery[];
  refreshInterval?: number;
}

export type WidgetType = 
  | 'timeseries' 
  | 'gauge' 
  | 'stat' 
  | 'table' 
  | 'heatmap' 
  | 'log-viewer'
  | 'trace-viewer';

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface WidgetSize {
  width: number;
  height: number;
}

export interface WidgetConfig {
  showLegend?: boolean;
  colorScheme?: string;
  axisLabels?: boolean;
  gridLines?: boolean;
  thresholds?: WidgetThreshold[];
  customOptions?: Record<string, unknown>;
}

export interface WidgetThreshold {
  value: number;
  color: string;
  label?: string;
}

export interface WidgetQuery {
  id: string;
  query: string;
  dataSource: string;
  legendFormat?: string;
}

export interface DashboardLayout {
  columns: number;
  rows?: number;
  autoArrange?: boolean;
}

export interface TimeRange {
  start: string | number;
  end: string | number;
  preset?: TimeRangePreset;
}

export type TimeRangePreset = 
  | 'last-5m' 
  | 'last-15m' 
  | 'last-1h' 
  | 'last-6h' 
  | 'last-24h' 
  | 'last-7d' 
  | 'custom';

export interface DashboardVariable {
  name: string;
  type: VariableType;
  query: string;
  defaultValue?: string;
  multi?: boolean;
  options?: VariableOption[];
}

export type VariableType = 'query' | 'custom' | 'constant';

export interface VariableOption {
  value: string;
  label: string;
}

export interface DashboardPermissions {
  read: string[];
  write: string[];
  public?: boolean;
}

// ============================================================================
// Performance Monitoring Types
// ============================================================================

export interface PerformanceMetrics {
  latency: LatencyMetrics;
  throughput: ThroughputMetrics;
  errorRate: ErrorRateMetrics;
  resources: ResourceMetrics;
  dependencies: DependencyMetrics[];
}

export interface LatencyMetrics {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  avg: number;
  max: number;
}

export interface ThroughputMetrics {
  requestsPerSecond: number;
  requestsPerMinute: number;
  peakRps: number;
}

export interface ErrorRateMetrics {
  total: number;
  rate: number;
  byType: Record<string, number>;
}

export interface ResourceMetrics {
  cpu: ResourceUsage;
  memory: ResourceUsage;
  disk: ResourceUsage;
  network: NetworkUsage;
}

export interface ResourceUsage {
  used: number;
  total: number;
  percentage: number;
}

export interface NetworkUsage {
  inboundBytes: number;
  outboundBytes: number;
  connections: number;
}

export interface DependencyMetrics {
  name: string;
  type: DependencyType;
  health: DependencyHealth;
  latency: LatencyMetrics;
  errorRate: number;
  requestCount: number;
}

export type DependencyType = 'http' | 'grpc' | 'database' | 'cache' | 'queue' | 'external';

export type DependencyHealth = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface SLI {
  name: string;
  description: string;
  type: SLIType;
  target: number;
  window: SLIWindow;
  calculation: SLICalculation;
}

export type SLIType = 'availability' | 'latency' | 'error-rate' | 'throughput' | 'saturation';

export interface SLIWindow {
  duration: number;
  rolling: boolean;
}

export interface SLICalculation {
  metric: string;
  query: string;
  aggregation: string;
}

export interface SLO {
  id: string;
  name: string;
  sli: SLI;
  objective: number;
  errorBudget: ErrorBudget;
  timeSlots: SLOTimeSlot[];
}

export interface ErrorBudget {
  initial: number;
  remaining: number;
  burnRate: number;
  estimatedExhaustion?: number;
}

export interface SLOTimeSlot {
  name: string;
  start: string;
  duration: number;
  objective: number;
}

// ============================================================================
// Health Check Types
// ============================================================================

export interface HealthCheckResult {
  status: HealthStatus;
  checks: Record<string, HealthCheck>;
  timestamp: number;
  version?: string;
}

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheck {
  name: string;
  status: HealthCheckStatus;
  message?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
  dependencies?: string[];
}

export type HealthCheckStatus = 'pass' | 'fail' | 'warn';

export interface HealthCheckConfig {
  type: HealthCheckType;
  enabled: boolean;
  interval?: number;
  timeout?: number;
  threshold?: number;
  config: Record<string, unknown>;
}

export type HealthCheckType = 
  | 'liveness' 
  | 'readiness' 
  | 'startup' 
  | 'custom';

export interface ProbeOptions {
  endpoint: string;
  interval: number;
  timeout: number;
  failureThreshold: number;
  successThreshold: number;
  initialDelay?: number;
}

export interface HealthIndicator {
  name: string;
  check: () => Promise<HealthCheckValue>;
  dependencies?: string[];
}

export interface HealthCheckValue {
  healthy: boolean;
  message?: string;
  data?: Record<string, unknown>;
}

// ============================================================================
// Common Types
// ============================================================================

export interface ObservableConfig {
  tracing?: TraceOptions;
  metrics?: {
    enabled: boolean;
    exportInterval?: number;
  };
  logging?: LoggerOptions;
  alerting?: {
    enabled: boolean;
    rules: AlertRule[];
  };
  healthChecks?: {
    enabled: boolean;
    endpoint?: string;
  };
}

export interface ExportResult {
  success: boolean;
  exported: number;
  failed: number;
  duration: number;
  errors?: Error[];
}

export interface TelemetryData {
  traceId?: string;
  metrics: MetricData[];
  logs: LogEntry[];
  metadata: Record<string, unknown>;
}
