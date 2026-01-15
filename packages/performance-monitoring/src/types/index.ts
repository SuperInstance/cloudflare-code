/**
 * Core type definitions for the performance monitoring system
 */

// ============================================================================
// Metric Types
// ============================================================================

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface MetricValue {
  value: number;
  timestamp: number;
  labels?: Record<string, string | number>;
}

export interface Metric {
  name: string;
  type: MetricType;
  help: string;
  values: MetricValue[];
  labels?: Record<string, string>;
  aggregator?: MetricAggregator;
}

export type MetricAggregator = 'sum' | 'avg' | 'min' | 'max' | 'count';

export interface MetricData {
  name: string;
  type: MetricType;
  value: number;
  labels?: Record<string, string | number>;
  timestamp: number;
}

export interface MetricBatch {
  metrics: MetricData[];
  timestamp: number;
}

// ============================================================================
// Counter Metrics
// ============================================================================

export interface CounterMetric extends Metric {
  type: 'counter';
  total: number;
  created: number;
}

export interface CounterIncrement {
  value: number;
  labels?: Record<string, string | number>;
  timestamp?: number;
}

// ============================================================================
// Gauge Metrics
// ============================================================================

export interface GaugeMetric extends Metric {
  type: 'gauge';
  value: number;
}

export interface GaugeOperation {
  operation: 'set' | 'increment' | 'decrement';
  value: number;
  labels?: Record<string, string | number>;
}

// ============================================================================
// Histogram Metrics
// ============================================================================

export interface HistogramMetric extends Metric {
  type: 'histogram';
  buckets: number[];
  counts: number[];
  sum: number;
  count: number;
}

export interface HistogramBucket {
  le: string;
  count: number;
}

export interface HistogramOptions {
  buckets?: number[];
  labels?: Record<string, string>;
}

// ============================================================================
// Summary Metrics
// ============================================================================

export interface SummaryMetric extends Metric {
  type: 'summary';
  quantiles: number[];
  sampleCount: number;
  sampleSum: number;
}

export interface SummaryOptions {
  quantiles?: number[];
  maxAge?: number;
  ageBuckets?: number;
  labels?: Record<string, string>;
}

// ============================================================================
// Profiling Types
// ============================================================================

export type ProfileType = 'cpu' | 'memory' | 'io' | 'network' | 'lock';

export interface ProfileSession {
  id: string;
  type: ProfileType;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'running' | 'completed' | 'error';
  samples: ProfileSample[];
  metadata: Record<string, unknown>;
}

export interface ProfileSample {
  timestamp: number;
  data: unknown;
  labels?: Record<string, string>;
}

export interface CPUProfileSample extends ProfileSample {
  data: {
    stack: string[];
    cpuTime: number;
    wallTime: number;
  };
}

export interface MemoryProfileSample extends ProfileSample {
  data: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };
}

export interface IOProfileSample extends ProfileSample {
  data: {
    operation: 'read' | 'write';
    path: string;
    bytes: number;
    duration: number;
  };
}

export interface NetworkProfileSample extends ProfileSample {
  data: {
    method: string;
    url: string;
    statusCode?: number;
    duration: number;
    bytesSent: number;
    bytesReceived: number;
  };
}

export interface LockProfileSample extends ProfileSample {
  data: {
    resource: string;
    operation: 'acquire' | 'release';
    waitTime: number;
    holdTime: number;
  };
}

export interface ProfilingOptions {
  interval?: number;
  duration?: number;
  samplingRate?: number;
  maxSamples?: number;
}

// ============================================================================
// SLI/SLO Types
// ============================================================================

export type SLIMetricType =
  | 'availability'
  | 'latency'
  | 'error_rate'
  | 'throughput'
  | 'saturation'
  | 'custom';

export interface SLIMetric {
  name: string;
  type: SLIMetricType;
  description: string;
  query: string;
  measurementWindow: number;
  aggregations: string[];
  goodEvents: number;
  validEvents: number;
  value: number;
  timestamp: number;
}

export interface SLO {
  id: string;
  name: string;
  description: string;
  target: number;
  sli: SLIMetric;
  measurementWindow: number;
  timeWindow: {
    rolling: number;
    calendar?: string;
  };
  errorBudget: ErrorBudget;
  status: 'compliant' | 'warning' | 'violated';
  history: SLOHistoryEntry[];
  metadata: Record<string, unknown>;
}

export interface ErrorBudget {
  target: number;
  remaining: number;
  burned: number;
  initial: number;
  burnRate: number;
  timeRemaining: number;
}

export interface SLOHistoryEntry {
  timestamp: number;
  sliValue: number;
  sloTarget: number;
  errorBudgetRemaining: number;
  status: SLO['status'];
}

export interface BurnRateCalculation {
  current: number;
  shortTerm: number;
  mediumTerm: number;
  longTerm: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface SLIReport {
  timestamp: number;
  period: number;
  metrics: SLIMetric[];
  overallHealth: number;
  summary: {
    healthy: number;
    warning: number;
    critical: number;
  };
}

// ============================================================================
// Anomaly Detection Types
// ============================================================================

export type AnomalyType =
  | 'spike'
  | 'drop'
  | 'trend_change'
  | 'pattern_break'
  | 'outlier'
  | 'seasonal_deviation';

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  metric: string;
  timestamp: number;
  value: number;
  expectedValue: number;
  deviation: number;
  confidence: number;
  description: string;
  affectedLabels?: Record<string, string>;
  duration?: number;
  relatedAnomalies?: string[];
  context: Record<string, unknown>;
}

export interface AnomalyDetectorConfig {
  enabled: boolean;
  algorithms: AnomalyAlgorithm[];
  sensitivity: number;
  minConfidence: number;
  lookbackWindow: number;
  seasonalityPeriod?: number;
  thresholds: {
    spike: number;
    drop: number;
    trendChange: number;
  };
}

export type AnomalyAlgorithm =
  | 'statistical'
  | 'ml_based'
  | 'threshold'
  | 'seasonal'
  | 'ensemble';

export interface AnomalyDetectionResult {
  detected: boolean;
  anomalies: Anomaly[];
  metric: string;
  timestamp: number;
  confidence: number;
  explanation: string;
}

// ============================================================================
// Alerting Types
// ============================================================================

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export type AlertStatus = 'firing' | 'resolved' | 'acknowledged' | 'silenced';

export interface Alert {
  id: string;
  name: string;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  metric: string;
  condition: AlertCondition;
  timestamp: number;
  resolvedAt?: number;
  acknowledgedAt?: number;
  silencedUntil?: number;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  firingValue: number;
  threshold: number;
  history: AlertHistoryEntry[];
  notifications: AlertNotification[];
}

export interface AlertCondition {
  type: 'threshold' | 'rate' | 'anomaly' | 'composite';
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
  threshold: number;
  duration: number;
  query: string;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  enabled: boolean;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  group: string;
  evaluationInterval: number;
  notificationChannels: string[];
}

export interface AlertHistoryEntry {
  timestamp: number;
  status: AlertStatus;
  value: number;
  message: string;
}

export interface AlertNotification {
  channel: string;
  status: 'pending' | 'sent' | 'failed';
  timestamp: number;
  error?: string;
}

export type NotificationChannel =
  | 'email'
  | 'slack'
  | 'pagerduty'
  | 'webhook'
  | 'sms'
  | 'custom';

export interface NotificationConfig {
  type: NotificationChannel;
  enabled: boolean;
  config: Record<string, unknown>;
  rateLimit?: {
    max: number;
    period: number;
  };
}

// ============================================================================
// Dashboard Types
// ============================================================================

export type VisualizationType =
  | 'line'
  | 'bar'
  | 'gauge'
  | 'heatmap'
  | 'table'
  | 'stat'
  | 'graph'
  | 'log';

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  panels: DashboardPanel[];
  variables: DashboardVariable[];
  refresh: number;
  timeRange: TimeRange;
  tags: string[];
  layout: DashboardLayout;
}

export interface DashboardPanel {
  id: string;
  title: string;
  type: VisualizationType;
  queries: DashboardQuery[];
  gridPos: GridPosition;
  options: PanelOptions;
  thresholds?: Threshold[];
  alerts?: string[];
  transformations?: Transformation[];
}

export interface DashboardQuery {
  refId: string;
  query: string;
  dataSource: string;
  queryType: string;
  legendFormat?: string;
}

export interface DashboardVariable {
  name: string;
  type: 'query' | 'custom' | 'constant' | 'interval';
  query?: string;
  values?: string[];
  current?: string;
  multi: boolean;
  options: VariableOption[];
}

export interface VariableOption {
  text: string;
  value: string;
  selected: boolean;
}

export interface TimeRange {
  start: string;
  end: string;
  zone?: string;
}

export interface GridPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PanelOptions {
  legend: {
    show: boolean;
    position: 'bottom' | 'right' | 'none';
  };
  tooltip: {
    mode: 'single' | 'multi' | 'all';
  };
  axes: {
    x: AxisOptions;
    y: AxisOptions;
  };
}

export interface AxisOptions {
  label: string;
  unit: string;
  min?: number;
  max?: number;
}

export interface Threshold {
  color: string;
  value: number;
  operator: 'gt' | 'lt' | 'gte' | 'lte';
}

export interface Transformation {
  type: string;
  params: Record<string, unknown>;
}

export interface DashboardLayout {
  orientation: 'horizontal' | 'vertical';
  rows: number;
  columns: number;
}

// ============================================================================
// Capacity Planning Types
// ============================================================================

export interface CapacityMetric {
  name: string;
  current: number;
  projected: number;
  capacity: number;
  unit: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  forecast: CapacityForecast;
}

export interface CapacityForecast {
  horizon: number;
  predictions: ForecastPoint[];
  confidence: number;
  upperBound: number;
  lowerBound: number;
  saturationDate?: number;
}

export interface ForecastPoint {
  timestamp: number;
  value: number;
  upperBound: number;
  lowerBound: number;
}

export interface CapacityRecommendation {
  type: 'scale_up' | 'scale_down' | 'optimize' | 'migrate';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  resource: string;
  current: number;
  recommended: number;
  reason: string;
  estimatedImpact: string;
  cost: number;
}

export interface CapacityReport {
  timestamp: number;
  timeRange: number;
  resources: CapacityMetric[];
  recommendations: CapacityRecommendation[];
  summary: {
    healthy: number;
    warning: number;
    critical: number;
  };
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface PerformanceMonitoringConfig {
  metrics: MetricsConfig;
  profiling: ProfilingConfig;
  sli: SLIConfig;
  anomaly: AnomalyDetectorConfig;
  alerting: AlertingConfig;
  dashboard: DashboardConfig;
  capacity: CapacityConfig;
}

export interface MetricsConfig {
  enabled: boolean;
  collectionInterval: number;
  retentionPeriod: number;
  prometheus: {
    enabled: boolean;
    port: number;
    path: string;
  };
  aggregation: {
    interval: number;
    maxDataPoints: number;
  };
}

export interface ProfilingConfig {
  enabled: boolean;
  defaultDuration: number;
  defaultInterval: number;
  maxConcurrentProfiles: number;
  storage: {
    type: 'memory' | 'file' | 's3';
    retentionDays: number;
    path?: string;
  };
}

export interface SLIConfig {
  enabled: boolean;
  updateInterval: number;
  historyRetention: number;
}

export interface AlertingConfig {
  enabled: boolean;
  evaluationInterval: number;
  notificationRetention: number;
  rules: AlertRule[];
  notificationChannels: NotificationConfig[];
}

export interface DashboardConfig {
  enabled: boolean;
  refreshInterval: number;
  port: number;
  auth?: {
    enabled: boolean;
    type: 'basic' | 'token' | 'oauth';
  };
}

export interface CapacityConfig {
  enabled: boolean;
  analysisInterval: number;
  forecastHorizon: number;
  alertThresholds: {
    warning: number;
    critical: number;
  };
}

// ============================================================================
// Event Types
// ============================================================================

export type MonitoringEventType =
  | 'metric_collected'
  | 'metric_aggregated'
  | 'profile_started'
  | 'profile_stopped'
  | 'sli_calculated'
  | 'slo_updated'
  | 'anomaly_detected'
  | 'alert_fired'
  | 'alert_resolved'
  | 'capacity_warning';

export interface MonitoringEvent {
  type: MonitoringEventType;
  timestamp: number;
  data: unknown;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Export Types
// ============================================================================

export interface PrometheusMetric {
  name: string;
  help: string;
  type: MetricType;
  values: {
    value: number;
    labels?: Record<string, string>;
  }[];
}

export interface PrometheusResponse {
  status: 'success' | 'error';
  data: {
    resultType: string;
    result: unknown[];
  };
}

export interface MetricExportFormat {
  format: 'prometheus' | 'json' | 'csv' | 'influx';
  metrics: Metric[];
  timestamp: number;
}

// ============================================================================
// Statistics Types
// ============================================================================

export interface Statistics {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  median: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  stdDev: number;
  variance: number;
}

export interface TimeSeriesData {
  timestamps: number[];
  values: number[];
  labels?: Record<string, string>;
}

export interface TrendAnalysis {
  trend: 'up' | 'down' | 'stable';
  slope: number;
  correlation: number;
  r2: number;
}
