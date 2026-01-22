/**
 * Monitoring System Types
 *
 * Comprehensive type definitions for the monitoring and observability system
 * including metrics, tracing, logging, alerting, and profiling.
 */

/**
 * Prometheus Metric Types
 */
export type PrometheusMetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

/**
 * Prometheus Metric Definition
 */
export interface PrometheusMetric {
  name: string;
  type: PrometheusMetricType;
  help: string;
  labels?: Record<string, string>;
  value?: number;
  samples?: PrometheusSample[];
  sum?: number;
  count?: number;
}

/**
 * Prometheus Sample (for histogram/summary)
 */
export interface PrometheusSample {
  name: string;
  value: number;
  labels?: Record<string, string>;
}

/**
 * Metric Labels
 */
export interface MetricLabels {
  [key: string]: string | number | boolean;
}

/**
 * Registry for all metrics
 */
export interface MetricsRegistry {
  counters: Map<string, CounterMetric>;
  gauges: Map<string, GaugeMetric>;
  histograms: Map<string, HistogramMetric>;
  summaries: Map<string, SummaryMetric>;
}

/**
 * Counter Metric (monotonically increasing)
 */
export interface CounterMetric {
  name: string;
  help: string;
  labels: Set<string>;
  value: number;
  created: number;
}

/**
 * Gauge Metric (can go up or down)
 */
export interface GaugeMetric {
  name: string;
  help: string;
  labels: Set<string>;
  value: number;
  created: number;
  min?: number;
  max?: number;
}

/**
 * Histogram Metric (distributions)
 */
export interface HistogramMetric {
  name: string;
  help: string;
  labels: Set<string>;
  buckets: number[];
  sum: number;
  count: number;
  created: number;
  observations: Map<string, number[]>;
}

/**
 * Summary Metric (sliding window quantiles)
 */
export interface SummaryMetric {
  name: string;
  help: string;
  labels: Set<string>;
  quantiles: number[];
  windowSize: number;
  created: number;
  observations: Map<string, number[]>;
}

/**
 * OpenTelemetry Trace
 */
export interface Trace {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: 'INTERNAL' | 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER';
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'UNSET' | 'OK' | 'ERROR';
  attributes: Record<string, string | number | boolean>;
  events: SpanEvent[];
  links: SpanLink[];
  statusCode?: number;
  statusMessage?: string;
}

/**
 * Span Event (timestamped events within a span)
 */
export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes: Record<string, string | number | boolean>;
}

/**
 * Span Link (causal relationships to other spans)
 */
export interface SpanLink {
  traceId: string;
  spanId: string;
  attributes: Record<string, string | number | boolean>;
}

/**
 * Trace Export (for external systems)
 */
export interface TraceExport {
  traces: Trace[];
  resource: {
    serviceName: string;
    serviceVersion: string;
    deploymentEnvironment: string;
  };
  instrumentationScope: string;
}

/**
 * Log Entry
 */
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
  error?: LogError;
  stack?: string;
}

/**
 * Log Levels
 */
export type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

/**
 * Log Error Details
 */
export interface LogError {
  name: string;
  message: string;
  code?: string;
  statusCode?: number;
  stack?: string;
  cause?: any;
}

/**
 * Log Context (for structured logging)
 */
export interface LogContext {
  name: string;
  metadata?: Record<string, any>;
  parent?: LogContext;
}

/**
 * Logger Interface
 */
export interface Logger {
  trace(message: string, metadata?: Record<string, any>): void;
  debug(message: string, metadata?: Record<string, any>): void;
  info(message: string, metadata?: Record<string, any>): void;
  warn(message: string, metadata?: Record<string, any>): void;
  error(message: string, error?: Error, metadata?: Record<string, any>): void;
  fatal(message: string, error?: Error, metadata?: Record<string, any>): void;

  withContext(context: string, metadata?: Record<string, any>): Logger;
  withCorrelationId(correlationId: string): Logger;
  withTrace(traceId: string, spanId: string): Logger;
  withUser(userId: string): Logger;
  withSession(sessionId: string): Logger;
  withRequest(requestId: string): Logger;
}

/**
 * Alert Condition
 */
export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'ne';
  threshold: number;
  duration: number; // milliseconds
  labels?: MetricLabels;
}

/**
 * Alert Rule
 */
export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  conditions: AlertCondition[];
  notificationChannels: NotificationChannel[];
  cooldown: number; // milliseconds
  lastTriggered?: number;
  triggerCount: number;
  metadata?: Record<string, any>;
}

/**
 * Notification Channel
 */
export interface NotificationChannel {
  type: 'slack' | 'email' | 'pagerduty' | 'webhook' | 'cloudflare_analytics';
  config: NotificationChannelConfig;
  enabled: boolean;
}

/**
 * Notification Channel Configuration
 */
export interface NotificationChannelConfig {
  // Slack
  webhookUrl?: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;

  // Email
  to?: string[];
  cc?: string[];
  subject?: string;

  // PagerDuty
  integrationKey?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';

  // Webhook
  url?: string;
  method?: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  bodyTemplate?: string;

  // Cloudflare Analytics
  dataset?: string;
}

/**
 * Alert State
 */
export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  status: 'firing' | 'resolved' | 'acknowledged';
  message: string;
  details: Record<string, any>;
  triggeredAt: number;
  resolvedAt?: number;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  notificationStatus: Map<string, 'pending' | 'sent' | 'failed'>;
}

/**
 * Alert Summary
 */
export interface AlertSummary {
  total: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  recent: Alert[];
}

/**
 * Performance Profile
 */
export interface PerformanceProfile {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  samples: ProfileSample[];
  summary: ProfileSummary;
  metadata: Record<string, any>;
}

/**
 * Profile Sample
 */
export interface ProfileSample {
  timestamp: number;
  cpuTime: number;
  wallTime: number;
  memory: {
    used: number;
    total: number;
    limit: number;
  };
  stackTrace?: StackFrame[];
  metadata?: Record<string, any>;
}

/**
 * Stack Frame
 */
export interface StackFrame {
  name: string;
  file?: string;
  line?: number;
  column?: number;
  function?: string;
  module?: string;
}

/**
 * Profile Summary
 */
export interface ProfileSummary {
  totalSamples: number;
  duration: number;
  cpuTime: number;
  wallTime: number;
  avgCpuUsage: number;
  maxMemoryUsage: number;
  avgMemoryUsage: number;
  hotFunctions: Array<{
    name: string;
    samples: number;
    percentage: number;
  }>;
}

/**
 * Profiling Options
 */
export interface ProfilingOptions {
  enabled: boolean;
  samplingInterval: number; // microseconds
  maxSamples: number;
  includeStackTrace: boolean;
  trackMemory: boolean;
  trackCPU: boolean;
  metadata?: Record<string, any>;
}

/**
 * Dashboard Data
 */
export interface DashboardData {
  timestamp: number;
  timeRange: {
    start: number;
    end: number;
    label: string;
  };

  // System Overview
  overview: {
    health: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    version: string;
    environment: string;
  };

  // Request Metrics
  requests: {
    total: number;
    rate: number; // per second
    avgLatency: number;
    p95Latency: number;
    p99Latency: number;
    errorRate: number;
    successRate: number;
  };

  // Provider Metrics
  providers: Array<{
    name: string;
    health: 'healthy' | 'degraded' | 'down';
    requests: number;
    successRate: number;
    avgLatency: number;
    cost: number;
  }>;

  // Cache Metrics
  cache: {
    hitRate: number;
    totalHits: number;
    totalMisses: number;
    avgLatency: number;
    savings: number;
    tiers: {
      hot: { hitRate: number; size: number; entries: number };
      warm: { hitRate: number; size: number; entries: number };
      cold: { hitRate: number; size: number; entries: number };
    };
  };

  // Cost Metrics
  costs: {
    total: number;
    byProvider: Record<string, number>;
    byModel: Record<string, number>;
    byFeature: Record<string, number>;
    forecast: {
      nextHour: number;
      nextDay: number;
      nextWeek: number;
      confidence: number;
    };
  };

  // Resource Metrics
  resources: {
    cpu: {
      usage: number;
      limit: number;
      percentage: number;
    };
    memory: {
      used: number;
      total: number;
      limit: number;
      percentage: number;
    };
    storage: {
      kv: { reads: number; writes: number; size: number };
      r2: { reads: number; writes: number; size: number };
      do: { count: number; memory: number };
    };
  };

  // Active Alerts
  alerts: AlertSummary;

  // Recent Traces
  traces: {
    total: number;
    errorRate: number;
    avgDuration: number;
    recent: Array<{
      traceId: string;
      name: string;
      duration: number;
      status: string;
    }>;
  };

  // Logs Summary
  logs: {
    total: number;
    byLevel: Record<string, number>;
    errorRate: number;
    recent: Array<{
      timestamp: number;
      level: string;
      message: string;
    }>;
  };
}

/**
 * Monitoring System Configuration
 */
export interface MonitoringConfig {
  // Metrics Configuration
  metrics: {
    enabled: boolean;
    prometheusEndpoint: string;
    defaultLabels: MetricLabels;
    collectInterval: number; // milliseconds
    retentionPeriod: number; // milliseconds
  };

  // Tracing Configuration
  tracing: {
    enabled: boolean;
    samplingRate: number; // 0-1
    exporter: 'otlp' | 'zipkin' | 'jaeger' | 'cloudflare';
    exporterEndpoint: string;
    batchSize: number;
    exportInterval: number; // milliseconds
  };

  // Logging Configuration
  logging: {
    level: LogLevel;
    format: 'json' | 'text';
    includeStackTrace: boolean;
    includeContext: boolean;
    exportToCloudflare: boolean;
    minLevelToExport: LogLevel;
  };

  // Alerting Configuration
  alerting: {
    enabled: boolean;
    evaluationInterval: number; // milliseconds
    defaultNotificationChannels: NotificationChannel[];
    rules: AlertRule[];
  };

  // Profiling Configuration
  profiling: {
    enabled: boolean;
    defaultOptions: ProfilingOptions;
    exportInterval: number; // milliseconds
  };

  // Dashboard Configuration
  dashboard: {
    enabled: boolean;
    refreshInterval: number; // milliseconds
    dataRetention: number; // milliseconds
    exportFormats: Array<'json' | 'prometheus' | 'grafana'>;
  };
}

/**
 * Export Format
 */
export interface MonitoringExport {
  timestamp: number;
  format: 'json' | 'prometheus' | 'grafana';
  data: {
    metrics?: string;
    traces?: TraceExport;
    logs?: LogEntry[];
    alerts?: Alert[];
    profile?: PerformanceProfile;
    dashboard?: DashboardData;
  };
}
