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
  unit?: string;
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
  attributes?: Record<string, unknown>;
  requestId?: string;
  stackTrace?: string;
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
  tags?: string[];
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

export type AlertStatus = 'firing' | 'resolved' | 'acknowledged' | 'suppressed' | 'triggered';

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

export interface AlertingHistory {
  alertId: string;
  ruleId: string;
  timestamp: number;
  status: AlertStatus;
  duration?: number;
  notified: boolean;
  metadata?: Record<string, unknown>;
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
  tags?: string[];
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
  timeRange?: TimeRange;
  unit?: string;
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
  data?: Record<string, unknown>;
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

// ============================================================================
// Business Metrics Types
// ============================================================================

export interface BusinessMetric {
  name: string;
  value: number;
  timestamp: number;
  labels: Record<string, string>;
}

export interface MetricAggregator {
  name: string;
  type: 'sum' | 'avg' | 'min' | 'max' | 'count';
}

export interface MetricThreshold {
  name: string;
  operator: 'gt' | 'lt' | 'eq';
  value: number;
}

export interface MetricTarget {
  name: string;
  value: number;
}

// ============================================================================
// RUM (Real User Monitoring) Types
// ============================================================================

export interface WebVitals {
  LCP?: number;
  FID?: number;
  CLS?: number;
  FCP?: number;
  TTFB?: number;
}

export interface PageViewData {
  sessionId: string;
  pageViewId: string;
  url: string;
  title: string;
  referrer: string;
  timestamp: number;
  timing: {
    loadTime: number;
    domInteractive: number;
    domComplete: number;
  };
}

export interface UserInteractionEvent {
  type: string;
  timestamp: number;
  element: string;
  elementId: string;
  elementClass: string;
  x: number;
  y: number;
  text: string;
  pageUrl?: string;
}

export interface RUMSession {
  sessionId: string;
  startTime: number;
  endTime: number;
  userAgent: string;
  viewport?: {
    width: number;
    height: number;
  };
  device: string;
  location?: {
    country: string;
    language: string;
  };
  interactions: UserInteractionEvent[];
  pageViews: PageViewData[];
  customMetrics: Record<string, number>[];
}

// ============================================================================
// Inspection Types
// ============================================================================

export interface RequestInspection {
  headers: Record<string, string>;
  method: string;
  url: string;
  body?: unknown;
}

export interface ResponseInspection {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
}

export interface RequestResponsePair {
  request: RequestInspection;
  response: ResponseInspection;
  timestamp: number;
  duration: number;
}

export interface InspectionFilter {
  urlPattern?: string;
  method?: string;
  statusCode?: number;
}

export interface TimingInfo {
  start: number;
  end: number;
  duration: number;
}

// ============================================================================
// Memory & Profiling Types
// ============================================================================

export interface HeapSnapshot {
  nodeId: number;
  name: string;
  type: string;
  size: number;
  children: HeapSnapshot[];
}

export interface HeapNode {
  id: number;
  name: string;
  size: number;
  retainedSize: number;
}

export interface HeapEdge {
  from: number;
  to: number;
  type: string;
}

export interface MemoryLeak {
  description: string;
  severity: 'low' | 'medium' | 'high';
  objects: HeapNode[];
}

export interface RetainedSizeAnalysis {
  total: number;
  nodes: HeapNode[];
}

export interface RetainingPath {
  path: HeapNode[];
  totalSize: number;
}

export interface MemoryTimelinePoint {
  timestamp: number;
  used: number;
  total: number;
}

export interface CPUProfile {
  samples: ProfileSample[];
  startTime: number;
  endTime: number;
}

export interface ProfileSample {
  timestamp: number;
  stack: string[];
}

export interface FlameGraphFrame {
  name: string;
  value: number;
  children: FlameGraphFrame[];
}

export interface HotPath {
  frames: FlameGraphFrame[];
  totalTime: number;
}

export interface Bottleneck {
  function: string;
  totalTime: number;
  percentage: number;
}

// ============================================================================
// Additional Missing Types
// ============================================================================

export interface LogFilter {
  level?: LogLevel;
  pattern?: string;
  startTime?: number;
  endTime?: number;
}

export interface LogAggregation {
  byLevel: Record<LogLevel, number>;
  byPattern: Record<string, number>;
}

export type Attributes = Record<string, string | number | boolean>;

export interface CustomMetricData {
  name: string;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  metrics?: PerformanceMetrics;
}

// ============================================================================
// Error Tracking Types
// ============================================================================

export interface ErrorRecord {
  id: string;
  error: ErrorInfo;
  timestamp: number;
  count: number;
  firstSeen: number;
  lastSeen: number;
  tags?: string[];
}

export interface ErrorGroup {
  id: string;
  fingerprint: string;
  errors: ErrorRecord[];
  pattern: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface UserReport {
  id: string;
  userId: string;
  errorId: string;
  description: string;
  email?: string;
  timestamp: number;
  resolved?: boolean;
}

export interface ErrorSession {
  id: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  errors: string[];
  breadcrumbs: Breadcrumb[];
  metadata?: Record<string, unknown>;
}

export interface Breadcrumb {
  timestamp: number;
  message: string;
  category?: string;
  level?: LogLevel;
  data?: Record<string, unknown>;
}

// ============================================================================
// Visualization Types
// ============================================================================

export interface TraceTreeNode {
  span: SpanData;
  children: TraceTreeNode[];
  depth: number;
}

export interface SpanMetadata {
  name: string;
  startTime: number;
  duration: number;
  tags: Record<string, string>;
  status: 'ok' | 'error';
}

export interface SpanData {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  tags: Record<string, string>;
  logs: SpanLog[];
}

export interface SpanLog {
  timestamp: number;
  message: string;
  fields?: Record<string, unknown>;
}

// ============================================================================
// Recording/Debug Types
// ============================================================================

export interface DebugRecording {
  id: string;
  sessionId: string;
  startTime: number;
  endTime: number;
  frames: DebugFrame[];
  metadata: Record<string, unknown>;
}

export interface DebugFrame {
  timestamp: number;
  stackTrace: string;
  variables: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface ReplayState {
  currentFrame: number;
  isPlaying: boolean;
  speed: number;
  filters: ReplayFilter;
}

export interface ReplayFilter {
  startTime?: number;
  endTime?: number;
  function?: string;
}

export interface DebugSession {
  id: string;
  breakpoints: Breakpoint[];
  variables: Map<string, VariableInspection>;
  callStack: CallFrame[];
}

export interface Breakpoint {
  id: string;
  file: string;
  line: number;
  condition?: string;
  enabled: boolean;
}

export interface VariableInspection {
  name: string;
  value: unknown;
  type: string;
  properties?: Record<string, VariableInspection>;
}

export interface CallFrame {
  functionName: string;
  fileName: string;
  lineNumber: number;
  column: number;
}

export interface MemoryStatistics {
  total: number;
  used: number;
  free: number;
  percentage: number;
}

export interface ObjectReference {
  id: string;
  type: string;
  value?: unknown;
}
