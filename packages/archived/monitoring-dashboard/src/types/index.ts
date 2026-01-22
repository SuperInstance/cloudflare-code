/**
 * Core type definitions for the monitoring dashboard system
 */

// ============================================================================
// WIDGET TYPES
// ============================================================================

export type WidgetType =
  | 'line-chart'
  | 'bar-chart'
  | 'area-chart'
  | 'pie-chart'
  | 'gauge-chart'
  | 'counter'
  | 'table'
  | 'status-indicator'
  | 'heatmap'
  | 'scatter-plot'
  | 'histogram'
  | 'metric-card'
  | 'log-viewer'
  | 'custom';

export type WidgetSize = 'small' | 'medium' | 'large' | 'xlarge' | 'full';

export interface BaseWidget {
  id: string;
  type: WidgetType;
  title: string;
  description?: string;
  size: WidgetSize;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  dataSource: DataSource;
  refreshInterval?: number;
  config: WidgetConfig;
  theme?: WidgetTheme;
  permissions?: WidgetPermissions;
  createdAt: Date;
  updatedAt: Date;
}

export type DataSource = MetricDataSource | QueryDataSource | APIDataSource | StreamDataSource;

export interface MetricDataSource {
  type: 'metric';
  metricName: string;
  filters?: Record<string, any>;
  aggregations?: Aggregation[];
  groupBy?: string[];
}

export interface QueryDataSource {
  type: 'query';
  query: string;
  queryLanguage: 'SQL' | 'PromQL' | 'GraphQL' | 'Custom';
  parameters?: Record<string, any>;
}

export interface APIDataSource {
  type: 'api';
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  transform?: string;
}

export interface StreamDataSource {
  type: 'stream';
  streamName: string;
  filters?: Record<string, any>;
  bufferSize?: number;
}

export interface Aggregation {
  type: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'percentile';
  field?: string;
  percentile?: number;
  alias?: string;
}

export type WidgetConfig = ChartConfig | CounterConfig | TableConfig | StatusConfig | HeatmapConfig | CustomConfig;

export interface ChartConfig {
  xAxis?: AxisConfig;
  yAxis?: AxisConfig[];
  series: SeriesConfig[];
  legend?: LegendConfig;
  tooltip?: TooltipConfig;
  zoom?: boolean;
  annotations?: Annotation[];
  thresholds?: Threshold[];
  colors?: string[];
  stacked?: boolean;
  normalized?: boolean;
  area?: boolean;
  showGrid?: boolean;
  showDataPoints?: boolean;
}

export interface AxisConfig {
  label: string;
  type: 'category' | 'number' | 'time' | 'log';
  format?: string;
  min?: number;
  max?: number;
  tickInterval?: number;
}

export interface SeriesConfig {
  name: string;
  dataKey: string;
  color?: string;
  type?: 'line' | 'bar' | 'area' | 'scatter';
  strokeWidth?: number;
  showPoints?: boolean;
  fillOpacity?: number;
}

export interface LegendConfig {
  show: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
}

export interface TooltipConfig {
  show: boolean;
  format?: string;
  shared?: boolean;
}

export interface Annotation {
  type: 'line' | 'rect' | 'text';
  x?: number | string;
  y?: number;
  x2?: number | string;
  y2?: number;
  label?: string;
  color?: string;
  dashArray?: string;
}

export interface Threshold {
  value: number;
  label?: string;
  color: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  fillArea?: boolean;
}

export interface CounterConfig {
  value: number | string;
  unit?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  format?: 'number' | 'currency' | 'percentage' | 'bytes' | 'duration';
  trend?: TrendConfig;
  target?: TargetConfig;
  sparkline?: SparklineConfig;
}

export interface TrendConfig {
  show: boolean;
  period: string;
  direction: 'up' | 'down' | 'neutral';
  percentage: number;
  color?: 'green' | 'red' | 'neutral';
}

export interface TargetConfig {
  value: number;
  label?: string;
  showProgress?: boolean;
}

export interface SparklineConfig {
  show: boolean;
  dataKey: string;
  color?: string;
  height?: number;
}

export interface TableConfig {
  columns: TableColumn[];
  sortable?: boolean;
  filterable?: boolean;
  pagination?: PaginationConfig;
  rowActions?: RowAction[];
  cellRenderers?: Record<string, string>;
}

export interface TableColumn {
  key: string;
  label: string;
  width?: number;
  sortable?: boolean;
  filterable?: boolean;
  align?: 'left' | 'center' | 'right';
  format?: string;
  renderer?: string;
}

export interface PaginationConfig {
  enabled: boolean;
  pageSize: number;
  pageSizeOptions?: number[];
}

export interface RowAction {
  label: string;
  icon?: string;
  action: string;
  style?: 'default' | 'destructive' | 'primary';
}

export interface StatusConfig {
  status: 'operational' | 'degraded' | 'down' | 'unknown' | 'maintenance';
  message?: string;
  lastChecked?: Date;
  history?: StatusHistoryPoint[];
}

export interface StatusHistoryPoint {
  timestamp: Date;
  status: string;
  message?: string;
}

export interface HeatmapConfig {
  xAxis: string;
  yAxis: string;
  valueKey: string;
  colorScheme: 'heatmap' | 'blues' | 'greens' | 'reds' | 'spectral';
  legend?: LegendConfig;
  cellSize?: number;
  showLabels?: boolean;
}

export interface CustomConfig {
  component: string;
  props?: Record<string, any>;
  customRenderFn?: string;
}

export interface WidgetTheme {
  mode: 'light' | 'dark' | 'auto';
  primaryColor?: string;
  backgroundColor?: string;
  borderColor?: string;
}

export interface WidgetPermissions {
  view: string[];
  edit: string[];
  delete: string[];
}

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: BaseWidget[];
  layout: DashboardLayout;
  settings: DashboardSettings;
  tags?: string[];
  isTemplate?: boolean;
  templateId?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy?: string;
}

export interface DashboardLayout {
  type: 'grid' | 'free';
  columns: number;
  rowHeight: number;
  margin: [number, number];
  padding?: [number, number, number, number];
  breakpoints?: BreakpointConfig[];
}

export interface BreakpointConfig {
  name: string;
  columns: number;
  width: number;
}

export interface DashboardSettings {
  autoRefresh: boolean;
  refreshInterval: number;
  timezone: string;
  theme: 'light' | 'dark' | 'auto';
  compactMode: boolean;
  showBorders: boolean;
  enableAnimations: boolean;
  maxDataPoints?: number;
}

// ============================================================================
// ALERT TYPES
// ============================================================================

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AlertStatus = 'open' | 'acknowledged' | 'resolved' | 'silenced';
export type AlertType = 'threshold' | 'anomaly' | 'manual' | 'composite';

export interface Alert {
  id: string;
  name: string;
  description?: string;
  severity: AlertSeverity;
  status: AlertStatus;
  type: AlertType;
  condition: AlertCondition;
  actions?: AlertAction[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
 Silenced?: boolean;
  silencedUntil?: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  triggeredCount: number;
  lastTriggered?: Date;
}

export interface AlertCondition {
  type: 'threshold' | 'expression' | 'composite';
  query?: string;
  threshold?: ThresholdCondition;
  expression?: string;
  compositeConditions?: AlertCondition[];
  logicalOperator?: 'AND' | 'OR';
  for?: string;
  evalFrequency?: string;
}

export interface ThresholdCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
  value: number;
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'slack' | 'pagerduty' | 'custom';
  enabled: boolean;
  config: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  conditions: AlertCondition[];
  actions: AlertAction[];
  labels?: Record<string, string>;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertInstance {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  status: AlertStatus;
  value: number;
  message: string;
  labels: Record<string, string>;
  fingerprint: string;
  startedAt: Date;
  resolvedAt?: Date;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  url?: string;
}

// ============================================================================
// INCIDENT TYPES
// ============================================================================

export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved' | 'postmortem';
export type IncidentImpact = 'critical' | 'high' | 'medium' | 'low';

export interface Incident {
  id: string;
  title: string;
  description: string;
  status: IncidentStatus;
  impact: IncidentImpact;
  severity: AlertSeverity;
  affectedServices: string[];
  startTime: Date;
  endTime?: Date;
  estimatedResolution?: Date;
  rootCause?: string;
  resolution?: string;
  timeline: IncidentTimelineEvent[];
  relatedAlerts: string[];
  assignees: string[];
  updates: IncidentUpdate[];
  tags?: string[];
  postmortem?: Postmortem;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy?: string;
}

export interface IncidentTimelineEvent {
  id: string;
  timestamp: Date;
  type: 'status-change' | 'update' | 'action' | 'detection' | 'resolution';
  description: string;
  details?: Record<string, any>;
  createdBy?: string;
  metadata?: Record<string, any>;
}

export interface IncidentUpdate {
  id: string;
  timestamp: Date;
  message: string;
  status?: IncidentStatus;
  visibility: 'public' | 'private';
  createdBy: string;
  attachments?: string[];
}

export interface Postmortem {
  summary: string;
  rootCause: string;
  timeline: string;
  resolution: string;
  lessonsLearned: string[];
  actionItems: ActionItem[];
  followUpDate?: Date;
  reviewedBy?: string[];
  reviewDate?: Date;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  assignee: string;
  status: 'open' | 'in-progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  dueDate?: Date;
  completedAt?: Date;
}

// ============================================================================
// INSIGHT TYPES
// ============================================================================

export type InsightType = 'bottleneck' | 'optimization' | 'trend' | 'anomaly' | 'forecast' | 'recommendation';
export type InsightSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Insight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  description: string;
  category: InsightCategory;
  details: InsightDetails;
  metrics: MetricReference[];
  recommendations: Recommendation[];
  confidence: number;
  createdAt: Date;
  expiresAt?: Date;
  dismissed?: boolean;
  labels?: Record<string, string>;
}

export type InsightCategory =
  | 'performance'
  | 'availability'
  | 'capacity'
  | 'cost'
  | 'security'
  | 'reliability'
  | 'scalability';

export interface InsightDetails {
  currentValue?: number;
  previousValue?: number;
  changePercentage?: number;
  trend?: 'increasing' | 'decreasing' | 'stable';
  duration?: string;
  affectedResources?: string[];
  baselineValue?: number;
  thresholdValue?: number;
  impact?: string;
  evidence?: Evidence[];
}

export interface Evidence {
  type: 'metric' | 'log' | 'trace' | 'event';
  source: string;
  data: Record<string, any>;
  timestamp: Date;
}

export interface MetricReference {
  name: string;
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionItems: string[];
  estimatedImpact?: string;
  effort?: 'low' | 'medium' | 'high';
  status: 'pending' | 'acknowledged' | 'implemented' | 'dismissed';
}

// ============================================================================
// ANOMALY DETECTION TYPES
// ============================================================================

export type AnomalyType = 'spike' | 'drop' | 'trend-change' | 'pattern-break' | 'outlier';
export type AnomalySeverity = 'critical' | 'high' | 'medium' | 'low';
export type AnomalyStatus = 'active' | 'investigating' | 'resolved' | 'false-positive';

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  metric: string;
  detectedAt: Date;
  duration?: string;
  value: number;
  expectedValue: number;
  deviation: number;
  deviationPercentage: number;
  confidence: number;
  description: string;
  patterns: Pattern[];
  relatedAnomalies?: string[];
  rootCauseAnalysis?: RootCauseAnalysis;
  investigationSteps?: InvestigationStep[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface Pattern {
  type: 'seasonal' | 'trend' | 'cyclical' | 'irregular';
  description: string;
  strength: number;
  period?: string;
}

export interface RootCauseAnalysis {
  potentialCauses: PotentialCause[];
  correlations: Correlation[];
  contributingFactors: ContributingFactor[];
  confidence: number;
}

export interface PotentialCause {
  cause: string;
  probability: number;
  evidence: string[];
  relatedMetrics?: string[];
}

export interface Correlation {
  metric1: string;
  metric2: string;
  correlation: number;
  significance: number;
  lag?: number;
}

export interface ContributingFactor {
  factor: string;
  impact: number;
  description: string;
}

export interface InvestigationStep {
  id: string;
  step: number;
  action: string;
  description: string;
  result?: string;
  status: 'pending' | 'in-progress' | 'completed';
  completedBy?: string;
  completedAt?: Date;
}

// ============================================================================
// REAL-TIME DATA TYPES
// ============================================================================

export interface RealTimeMetric {
  name: string;
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
  unit?: string;
}

export interface MetricStream {
  metric: string;
  data: DataPoint[];
  isStreaming: boolean;
  bufferSize: number;
}

export interface DataPoint {
  timestamp: Date;
  value: number;
  labels?: Record<string, string>;
}

export interface WebSocketMessage {
  type: 'metric' | 'alert' | 'incident' | 'anomaly' | 'status';
  data: any;
  timestamp: Date;
}

// ============================================================================
// FILTER AND QUERY TYPES
// ============================================================================

export interface DashboardFilter {
  id: string;
  name: string;
  field: string;
  operator: 'eq' | 'ne' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte' | 'in';
  value: any;
  active: boolean;
}

export interface DashboardQuery {
  filters: DashboardFilter[];
  timeRange: TimeRange;
  groupBy?: string[];
  aggregations?: Aggregation[];
  orderBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  limit?: number;
}

export interface TimeRange {
  type: 'relative' | 'absolute';
  value?: string;
  start?: Date;
  end?: Date;
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

export interface DashboardExport {
  format: 'json' | 'yaml' | 'csv';
  includeData?: boolean;
  timeRange?: TimeRange;
}

export interface DashboardImport {
  format: 'json' | 'yaml';
  overwrite?: boolean;
  mergeStrategy?: 'replace' | 'merge' | 'skip';
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'pagerduty' | 'sms' | 'custom';
  enabled: boolean;
  config: Record<string, any>;
  verified: boolean;
}

export interface NotificationRule {
  id: string;
  name: string;
  channels: string[];
  conditions: AlertCondition[];
  filters: Record<string, any>;
  throttle?: number;
  enabled: boolean;
}

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  preview?: string;
  widgets: Omit<BaseWidget, 'id'>[];
  layout: DashboardLayout;
  tags?: string[];
  variables?: TemplateVariable[];
  popularity?: number;
  createdAt: Date;
}

export interface TemplateVariable {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'multiselect';
  defaultValue?: any;
  options?: { label: string; value: any }[];
  required: boolean;
}
