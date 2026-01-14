/**
 * ClaudeFlare Analytics & Business Intelligence Platform
 * Comprehensive type definitions for product analytics, user behavior, revenue, cohorts, and funnels
 */

// ============================================================================
// Core Event Types
// ============================================================================

export interface AnalyticsEvent {
  id: string;
  type: EventType;
  timestamp: number;
  userId: string;
  sessionId: string;
  properties: Record<string, any>;
  context: EventContext;
  metadata?: EventMetadata;
}

export type EventType =
  | 'page_view'
  | 'click'
  | 'form_submit'
  | 'signup'
  | 'login'
  | 'purchase'
  | 'subscription'
  | 'feature_use'
  | 'error'
  | 'custom';

export interface EventContext {
  userAgent: string;
  ipAddress?: string;
  referrer?: string;
  url: string;
  platform: string;
  browser?: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  screenSize?: string;
  locale?: string;
  timezone?: string;
}

export interface EventMetadata {
  source?: string;
  campaign?: string;
  medium?: string;
  testVariants?: Record<string, string>;
  tags?: string[];
}

// ============================================================================
// Product Analytics Types
// ============================================================================

export interface ProductMetrics {
  dau: number;
  mau: number;
  wau: number;
  userGrowth: UserGrowthMetrics;
  engagement: EngagementMetrics;
  retention: RetentionMetrics;
  churn: ChurnMetrics;
  featureUsage: FeatureUsageMetrics;
  sessionMetrics: SessionMetrics;
}

export interface UserGrowthMetrics {
  newUsers: number;
  totalUsers: number;
  growthRate: number;
  growthBreakdown: GrowthBreakdown;
}

export interface GrowthBreakdown {
  organic: number;
  paid: number;
  referral: number;
  direct: number;
  other: number;
}

export interface EngagementMetrics {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  stickiness: number;
  averageSessionDuration: number;
  averageSessionsPerUser: number;
  pageviewsPerSession: number;
  bounceRate: number;
}

export interface RetentionMetrics {
  day1: number;
  day7: number;
  day30: number;
  day90: number;
  rolling: RollingRetention;
  cohort: CohortRetention;
}

export interface RollingRetention {
  r1: number;
  r7: number;
  r30: number;
  r90: number;
}

export interface CohortRetention {
  byAcquisitionWeek: Record<string, number[]>;
  bySignupMonth: Record<string, number[]>;
}

export interface ChurnMetrics {
  rate: number;
  count: number;
  bySegment: Record<string, number>;
  byReason: Record<string, number>;
  riskScore: number;
  atRiskUsers: number;
}

export interface FeatureUsageMetrics {
  totalFeatures: number;
  activeFeatures: number;
  adoptionRate: number;
  topFeatures: FeatureUsage[];
  featureDiscovery: FeatureDiscovery;
}

export interface FeatureUsage {
  featureId: string;
  featureName: string;
  users: number;
  usage: number;
  uniqueUsers: number;
  adoptionRate: number;
  avgUsagePerUser: number;
}

export interface FeatureDiscovery {
  discovered: number;
  undiscovered: number;
  timeToFirstUse: number;
  discoveryFunnel: Record<string, number>;
}

export interface SessionMetrics {
  totalSessions: number;
  averageDuration: number;
  averagePageviews: number;
  medianDuration: number;
  sessionsPerUser: number;
  bounceRate: number;
  timeDistribution: TimeDistribution;
}

export interface TimeDistribution {
  hourly: number[];
  daily: number[];
  weekly: number[];
}

// ============================================================================
// User Behavior Analytics Types
// ============================================================================

export interface BehaviorMetrics {
  pageviews: PageviewMetrics;
  interactions: InteractionMetrics;
  navigation: NavigationMetrics;
  conversions: ConversionMetrics;
  patterns: BehaviorPatterns;
  segments: UserSegments;
}

export interface PageviewMetrics {
  total: number;
  unique: number;
  perUser: number;
  topPages: PageStats[];
  exitPages: PageStats[];
  entryPages: PageStats[];
}

export interface PageStats {
  url: string;
  title: string;
  views: number;
  uniqueViews: number;
  avgTimeOnPage: number;
  bounceRate: number;
  exitRate: number;
}

export interface InteractionMetrics {
  totalClicks: number;
  totalInteractions: number;
  clickThroughRate: number;
  clickPaths: ClickPath[];
  heatmaps: HeatmapData;
  scrollDepth: ScrollDepthMetrics;
}

export interface ClickPath {
  path: string[];
  count: number;
  users: number;
  avgTime: number;
  dropoff: number;
}

export interface HeatmapData {
  clicks: Record<string, number>;
  movements: Record<string, number>;
  attention: Record<string, number>;
}

export interface ScrollDepthMetrics {
  average: number;
  distribution: Record<string, number>;
  byPage: Record<string, number>;
}

export interface NavigationMetrics {
  paths: NavigationPath[];
  depth: number;
  breadth: number;
  loops: number;
  exits: NavigationExit[];
}

export interface NavigationPath {
  sequence: string[];
  frequency: number;
  conversionRate: number;
  avgDuration: number;
}

export interface NavigationExit {
  page: string;
  exits: number;
  rate: number;
  lastAction: string;
}

export interface ConversionMetrics {
  totalConversions: number;
  conversionRate: number;
  bySource: Record<string, number>;
  byCampaign: Record<string, number>;
  value: number;
  microConversions: MicroConversion[];
}

export interface MicroConversion {
  name: string;
  count: number;
  rate: number;
  value?: number;
}

export interface BehaviorPatterns {
  usage: UsagePattern[];
  powerUsers: PowerUserMetrics;
  featureDiscovery: FeatureDiscoveryPattern[];
  churnPredictions: ChurnPrediction[];
  upsellOpportunities: UpsellOpportunity[];
}

export interface UsagePattern {
  pattern: string;
  users: number;
  percentage: number;
  characteristics: string[];
}

export interface PowerUserMetrics {
  count: number;
  percentage: number;
  characteristics: string[];
  engagement: number;
  retention: number;
  avgLTV: number;
}

export interface FeatureDiscoveryPattern {
  feature: string;
  discoverability: number;
  timeToDiscovery: number;
  discoveryPath: string[];
 影响因素: string[];
}

export interface ChurnPrediction {
  userId: string;
  probability: number;
  factors: RiskFactor[];
  predictionDate: number;
  timeframe: number;
}

export interface RiskFactor {
  factor: string;
  impact: number;
  value: number;
  threshold: number;
}

export interface UpsellOpportunity {
  userId: string;
  segment: string;
  opportunity: string;
  likelihood: number;
  estimatedValue: number;
  triggers: string[];
}

export interface UserSegments {
  segments: Segment[];
  overlaps: SegmentOverlap[];
  transitions: SegmentTransition[];
}

export interface Segment {
  id: string;
  name: string;
  type: SegmentType;
  criteria: SegmentCriteria;
  users: number;
  percentage: number;
  metrics: SegmentMetrics;
  createdAt: number;
  updatedAt: number;
}

export type SegmentType =
  | 'demographic'
  | 'behavioral'
  | 'firmographic'
  | 'technographic'
  | 'custom';

export interface SegmentCriteria {
  rules: SegmentRule[];
  logic: 'AND' | 'OR';
}

export interface SegmentRule {
  field: string;
  operator: SegmentOperator;
  value: any;
}

export type SegmentOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'in'
  | 'not_in'
  | 'matches';

export interface SegmentMetrics {
  engagement: number;
  retention: number;
  revenue: number;
  conversion: number;
  ltv: number;
}

export interface SegmentOverlap {
  segment1: string;
  segment2: string;
  overlap: number;
  overlapPercentage: number;
  jaccardIndex: number;
}

export interface SegmentTransition {
  from: string;
  to: string;
  users: number;
  rate: number;
  avgTimeInSegment: number;
}

// ============================================================================
// Revenue Analytics Types
// ============================================================================

export interface RevenueMetrics {
  mrr: MRRMetrics;
  arr: ARRMetrics;
  arpu: number;
  ltv: number;
  cac: number;
  ltvCacRatio: number;
  churn: RevenueChurnMetrics;
  expansion: ExpansionRevenueMetrics;
  forecasting: RevenueForecasting;
  trends: RevenueTrends;
  segmentation: RevenueSegmentation;
}

export interface MRRMetrics {
  current: number;
  new: number;
  expansion: number;
  contraction: number;
  churn: number;
  previous: number;
  growth: number;
  growthRate: number;
}

export interface ARRMetrics {
  current: number;
  forecast: number;
  yearOverYear: number;
  byPlan: Record<string, number>;
  bySegment: Record<string, number>;
}

export interface RevenueChurnMetrics {
  rate: number;
  amount: number;
  customers: number;
  bySegment: Record<string, number>;
  byReason: Record<string, number>;
  netRevenueRetention: number;
}

export interface ExpansionRevenueMetrics {
  amount: number;
  rate: number;
  contributors: ExpansionContributor[];
  byType: Record<string, number>;
}

export interface ExpansionContributor {
  userId: string;
  previousValue: number;
  newValue: number;
  expansionAmount: number;
  reason: string;
  timestamp: number;
}

export interface RevenueForecasting {
  nextMonth: number;
  nextQuarter: number;
  nextYear: number;
  confidence: number;
  upper: number;
  lower: number;
  method: ForecastingMethod;
}

export type ForecastingMethod =
  | 'linear_regression'
  | 'arima'
  | 'prophet'
  | 'lstm'
  | 'ensemble';

export interface RevenueTrends {
  monthly: RevenueTrendPoint[];
  quarterly: RevenueTrendPoint[];
  yearly: RevenueTrendPoint[];
  seasonality: SeasonalityPattern;
  growth: GrowthAnalysis;
}

export interface RevenueTrendPoint {
  period: string;
  revenue: number;
  growth: number;
  forecast?: number;
  variance?: number;
}

export interface SeasonalityPattern {
  detected: boolean;
  pattern: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  strength: number;
  peaks: number[];
  troughs: number[];
}

export interface GrowthAnalysis {
  rate: number;
  compounding: number;
  momentum: number;
  acceleration: number;
  trend: 'accelerating' | 'decelerating' | 'stable';
}

export interface RevenueSegmentation {
  byPlan: RevenueBySegment;
  byCustomer: RevenueBySegment;
  byGeography: RevenueBySegment;
  byChannel: RevenueBySegment;
}

export interface RevenueBySegment {
  segments: RevenueSegment[];
  concentration: number;
  giniCoefficient: number;
  herfindahlIndex: number;
}

export interface RevenueSegment {
  name: string;
  revenue: number;
  percentage: number;
  growth: number;
  customers: number;
  arpu: number;
}

// ============================================================================
// Cohort Analysis Types
// ============================================================================

export interface CohortAnalysis {
  cohorts: Cohort[];
  retention: CohortRetentionAnalysis;
  revenue: CohortRevenueAnalysis;
  ltv: CohortLTVAnalysis;
  comparison: CohortComparison;
}

export interface Cohort {
  id: string;
  name: string;
  type: CohortType;
  period: string;
  size: number;
  metrics: CohortMetrics;
  retention: number[];
  revenue: number[];
  ltv: number;
}

export type CohortType =
  | 'acquisition'
  | 'signup'
  | 'feature'
  | 'subscription'
  | 'behavior'
  | 'custom';

export interface CohortMetrics {
  day1: number;
  day7: number;
  day30: number;
  day90: number;
  day180: number;
  day365: number;
}

export interface CohortRetentionAnalysis {
  table: RetentionTable;
  curves: RetentionCurve[];
  summary: RetentionSummary;
}

export interface RetentionTable {
  headers: string[];
  rows: RetentionRow[];
}

export interface RetentionRow {
  cohort: string;
  size: number;
  periods: number[];
}

export interface RetentionCurve {
  cohort: string;
  curve: number[];
  prediction: number[];
  confidence: number[];
}

export interface RetentionSummary {
  average: number;
  best: CohortRetentionStat;
  worst: CohortRetentionStat;
  trend: 'improving' | 'declining' | 'stable';
}

export interface CohortRetentionStat {
  cohort: string;
  value: number;
  period: string;
}

export interface CohortRevenueAnalysis {
  cumulative: CohortRevenueCurve[];
  perPeriod: CohortRevenueCurve[];
  bySegment: Record<string, CohortRevenueCurve[]>;
}

export interface CohortRevenueCurve {
  cohort: string;
  curve: number[];
  total: number;
  average: number;
  median: number;
}

export interface CohortLTVAnalysis {
  curves: LTVCurve[];
  projections: LTVProjection;
  comparison: LTVComparison;
}

export interface LTVCurve {
  cohort: string;
  ltv: number[];
  cac: number;
  paybackPeriod: number;
  roi: number;
}

export interface LTVProjection {
  month6: number;
  month12: number;
  month24: number;
  month36: number;
  confidence: number;
}

export interface LTVComparison {
  byCohort: Record<string, number>;
  bySegment: Record<string, number>;
  trend: number;
}

export interface CohortComparison {
  metrics: ComparisonMetric[];
  statistical: StatisticalComparison;
}

export interface ComparisonMetric {
  metric: string;
  cohorts: Record<string, number>;
  difference: number;
  significant: boolean;
}

export interface StatisticalComparison {
  test: string;
  pValue: number;
  significant: boolean;
  recommendation: string;
}

// ============================================================================
// Funnel Analysis Types
// ============================================================================

export interface FunnelAnalysis {
  funnel: Funnel;
  metrics: FunnelMetrics;
  breakdown: FunnelBreakdown;
  comparison: FunnelComparison;
  insights: FunnelInsight[];
}

export interface Funnel {
  id: string;
  name: string;
  type: FunnelType;
  steps: FunnelStep[];
  timeRange: TimeRange;
  segment?: string;
}

export type FunnelType =
  | 'signup'
  | 'activation'
  | 'conversion'
  | 'upgrade'
  | 'retention'
  | 'custom';

export interface FunnelStep {
  id: string;
  name: string;
  description: string;
  event: string;
  criteria?: StepCriteria;
  order: number;
  required: boolean;
  timeConstraint?: TimeConstraint;
}

export interface StepCriteria {
  conditions: Record<string, any>;
  logic: 'AND' | 'OR';
}

export interface TimeConstraint {
  maxDuration: number;
  fromFirstStep?: boolean;
  fromPreviousStep?: boolean;
}

export interface FunnelMetrics {
  overall: FunnelOverallMetrics;
  byStep: FunnelStepMetrics[];
  bySegment: Record<string, FunnelStepMetrics[]>;
  byTimePeriod: Record<string, FunnelStepMetrics[]>;
}

export interface FunnelOverallMetrics {
  entrants: number;
  completions: number;
  conversionRate: number;
  dropoff: number;
  avgTimeToComplete: number;
  medianTimeToComplete: number;
}

export interface FunnelStepMetrics {
  stepId: string;
  stepName: string;
  users: number;
  completionRate: number;
  dropoffRate: number;
  dropoffUsers: number;
  avgTimeFromStart: number;
  avgTimeFromPrevious: number;
  timeDistribution: TimeDistribution;
}

export interface FunnelBreakdown {
  bySegment: FunnelSegmentBreakdown[];
  bySource: FunnelSegmentBreakdown[];
  byDevice: FunnelSegmentBreakdown[];
  byBrowser: FunnelSegmentBreakdown[];
}

export interface FunnelSegmentBreakdown {
  segment: string;
  entrants: number;
  completions: number;
  conversionRate: number;
  steps: FunnelStepMetrics[];
}

export interface FunnelComparison {
  funnels: FunnelComparisonEntry[];
  statistical: FunnelStatisticalComparison;
}

export interface FunnelComparisonEntry {
  funnel: string;
  entrants: number;
  completions: number;
  conversionRate: number;
  difference: number;
  significant: boolean;
}

export interface FunnelStatisticalComparison {
  test: string;
  statistic: number;
  pValue: number;
  significant: boolean;
  winner: string;
  confidence: number;
}

export interface FunnelInsight {
  type: 'bottleneck' | 'optimization' | 'anomaly' | 'recommendation';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  step?: string;
  impact: number;
  recommendation: string;
  confidence: number;
}

export interface TimeRange {
  start: number;
  end: number;
  duration: number;
}

// ============================================================================
// Report Builder Types
// ============================================================================

export interface Report {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  owner: string;
  config: ReportConfig;
  schedule?: ReportSchedule;
  distribution?: ReportDistribution;
  lastRun?: number;
  nextRun?: number;
  createdAt: number;
  updatedAt: number;
}

export type ReportType =
  | 'product'
  | 'behavior'
  | 'revenue'
  | 'cohort'
  | 'funnel'
  | 'custom'
  | 'executive_summary'
  | 'realtime';

export interface ReportConfig {
  dataSource: ReportDataSource;
  metrics: ReportMetric[];
  dimensions: ReportDimension[];
  filters: ReportFilter[];
  visualizations: ReportVisualization[];
  layout: ReportLayout;
  calculations?: ReportCalculation[];
}

export interface ReportDataSource {
  type: 'events' | 'metrics' | 'cohort' | 'funnel' | 'revenue' | 'custom';
  query?: any;
  table?: string;
  join?: ReportJoin[];
}

export interface ReportJoin {
  type: 'inner' | 'left' | 'right';
  table: string;
  on: string;
}

export interface ReportMetric {
  id: string;
  name: string;
  type: 'count' | 'sum' | 'avg' | 'median' | 'percentile' | 'rate' | 'ratio' | 'custom';
  field?: string;
  formula?: string;
  format?: MetricFormat;
  comparison?: MetricComparison;
}

export interface MetricFormat {
  type: 'number' | 'currency' | 'percentage' | 'duration' | 'custom';
  decimals?: number;
  prefix?: string;
  suffix?: string;
  scaling?: boolean;
}

export interface MetricComparison {
  type: 'previous_period' | 'same_period_last_year' | 'custom_target' | 'forecast';
  showChange: boolean;
  showPercentage: boolean;
}

export interface ReportDimension {
  id: string;
  name: string;
  field: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  sortable: boolean;
  filterable: boolean;
}

export interface ReportFilter {
  id: string;
  field: string;
  operator: FilterOperator;
  value: any;
  logic?: 'AND' | 'OR';
}

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null';

export interface ReportVisualization {
  id: string;
  type: VisualizationType;
  title: string;
  dataSource: string;
  config: VisualizationConfig;
  position: VisualizationPosition;
}

export type VisualizationType =
  | 'line'
  | 'bar'
  | 'area'
  | 'pie'
  | 'donut'
  | 'table'
  | 'heatmap'
  | 'funnel'
  | 'cohort'
  | 'number'
  | 'gauge'
  | 'scatter'
  | 'histogram'
  | 'sankey'
  | 'treemap';

export interface VisualizationConfig {
  xAxis?: string;
  yAxis?: string | string[];
  groupBy?: string;
  stackBy?: string;
  colorBy?: string;
  showLegend?: boolean;
  showDataLabels?: boolean;
  showTrendline?: boolean;
  limit?: number;
  sort?: 'asc' | 'desc' | 'custom';
  comparison?: boolean;
  annotations?: VisualizationAnnotation[];
}

export interface VisualizationAnnotation {
  type: 'line' | 'point' | 'range';
  value: any;
  label: string;
  color?: string;
}

export interface VisualizationPosition {
  row: number;
  column: number;
  rowSpan?: number;
  columnSpan?: number;
}

export interface ReportLayout {
  type: 'grid' | 'freeform';
  columns: number;
  rows?: number;
  spacing?: number;
}

export interface ReportCalculation {
  id: string;
  name: string;
  formula: string;
  variables: Record<string, string>;
}

export interface ReportSchedule {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
  timezone: string;
  time?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
}

export interface ReportDistribution {
  channels: DistributionChannel[];
  recipients: string[];
  message?: string;
  attachments?: boolean;
  format?: 'pdf' | 'html' | 'csv' | 'json';
}

export interface DistributionChannel {
  type: 'email' | 'slack' | 'webhook' | 's3' | 'custom';
  config: Record<string, any>;
}

// ============================================================================
// Export Types
// ============================================================================

export interface ExportConfig {
  format: ExportFormat;
  compression?: boolean;
  encryption?: boolean;
  destination?: ExportDestination;
  filters?: ReportFilter[];
  fields?: string[];
  includeMetadata?: boolean;
}

export type ExportFormat =
  | 'csv'
  | 'json'
  | 'parquet'
  | 'excel'
  | 'pdf'
  | 'html'
  | 'xml'
  | 'sql';

export interface ExportDestination {
  type: 's3' | 'gcs' | 'azure' | 'local' | 'url' | 'email' | 'webhook';
  config: Record<string, any>;
}

export interface ExportResult {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: ExportFormat;
  size: number;
  rows: number;
  url?: string;
  expiresAt?: number;
  createdAt: number;
  completedAt?: number;
  error?: string;
}

// ============================================================================
// Aggregation Types
// ============================================================================

export interface AggregationConfig {
  timeWindow: TimeWindow;
  dimensions: string[];
  metrics: AggregationMetric[];
  filters?: ReportFilter[];
  grouping?: AggregationGrouping;
}

export type TimeWindow =
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'custom';

export interface AggregationMetric {
  field: string;
  operations: AggregationOperation[];
  alias?: string;
}

export type AggregationOperation =
  | 'count'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'stddev'
  | 'variance'
  | 'percentile'
  | 'distinct_count';

export interface AggregationGrouping {
  by: string[];
  timeBased?: boolean;
  custom?: Record<string, any>;
}

export interface AggregationResult {
  timeWindow: string;
  dimensions: Record<string, any>;
  metrics: Record<string, number>;
  count: number;
}

// ============================================================================
// Statistical Analysis Types
// ============================================================================

export interface StatisticalAnalysis {
  descriptive: DescriptiveStatistics;
  inferential: InferentialStatistics;
  trend: TrendAnalysis;
  correlation: CorrelationAnalysis;
  anomaly: AnomalyDetection;
  forecast: ForecastingAnalysis;
}

export interface DescriptiveStatistics {
  mean: number;
  median: number;
  mode: number;
  std: number;
  variance: number;
  min: number;
  max: number;
  quartiles: Quartiles;
  skewness: number;
  kurtosis: number;
}

export interface Quartiles {
  q1: number;
  q2: number;
  q3: number;
  iqr: number;
}

export interface InferentialStatistics {
  tests: StatisticalTest[];
  significance: number;
  confidence: number;
}

export interface StatisticalTest {
  type: StatisticalTestType;
  statistic: number;
  pValue: number;
  significant: boolean;
  interpretation: string;
}

export type StatisticalTestType =
  | 't_test'
  | 'chi_square'
  | 'anova'
  | 'mann_whitney'
  | 'kruskal_wallis'
  | 'correlation'
  | 'regression';

export interface TrendAnalysis {
  trend: 'increasing' | 'decreasing' | 'stable';
  slope: number;
  correlation: number;
  r2: number;
  seasonality?: SeasonalityPattern;
  changePoints: ChangePoint[];
}

export interface ChangePoint {
  timestamp: number;
  before: number;
  after: number;
  magnitude: number;
  confidence: number;
}

export interface CorrelationAnalysis {
  correlations: Correlation[];
  strongest: Correlation;
  network: CorrelationNetwork;
}

export interface Correlation {
  field1: string;
  field2: string;
  coefficient: number;
  pValue: number;
  significant: boolean;
  strength: CorrelationStrength;
}

export type CorrelationStrength =
  | 'very_weak'
  | 'weak'
  | 'moderate'
  | 'strong'
  | 'very_strong';

export interface CorrelationNetwork {
  nodes: CorrelationNode[];
  edges: CorrelationEdge[];
}

export interface CorrelationNode {
  field: string;
  connections: number;
  centrality: number;
}

export interface CorrelationEdge {
  source: string;
  target: string;
  coefficient: number;
  strength: CorrelationStrength;
}

export interface AnomalyDetection {
  anomalies: Anomaly[];
  score: number;
  threshold: number;
  method: AnomalyMethod;
}

export interface Anomaly {
  timestamp: number;
  value: number;
  expected: number;
  deviation: number;
  score: number;
  severity: AnomalySeverity;
  type: 'spike' | 'drop' | 'trend_shift' | 'pattern_change';
}

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export type AnomalyMethod =
  | 'z_score'
  | 'iqr'
  | 'isolation_forest'
  | 'moving_average'
  | 'exponential_smoothing'
  | 'lstm';

export interface ForecastingAnalysis {
  forecast: ForecastPoint[];
  accuracy: number;
  method: ForecastingMethod;
  confidence: number;
  upper: number[];
  lower: number[];
}

export interface ForecastPoint {
  timestamp: number;
  value: number;
  lower: number;
  upper: number;
  confidence: number;
}

// ============================================================================
// Visualization Types
// ============================================================================

export interface VisualizationData {
  type: VisualizationType;
  title: string;
  data: any[];
  config: VisualizationConfig;
  metadata: VisualizationMetadata;
}

export interface VisualizationMetadata {
  generatedAt: number;
  dataSource: string;
  rows: number;
  columns: number;
  refreshInterval?: number;
  drilldown?: DrilldownConfig;
}

export interface DrilldownConfig {
  enabled: boolean;
  levels: DrilldownLevel[];
}

export interface DrilldownLevel {
  dimension: string;
  metric: string;
  aggregation: string;
}

// ============================================================================
// Query Types
// ============================================================================

export interface AnalyticsQuery {
  id: string;
  name: string;
  description?: string;
  query: QueryDefinition;
  cache?: CacheConfig;
  timeout?: number;
}

export interface QueryDefinition {
  select: QuerySelect[];
  from: string;
  joins?: QueryJoin[];
  where?: QueryCondition[];
  groupBy?: string[];
  orderBy?: QueryOrderBy[];
  limit?: number;
  offset?: number;
}

export interface QuerySelect {
  field: string;
  alias?: string;
  aggregation?: string;
}

export interface QueryJoin {
  table: string;
  type: 'inner' | 'left' | 'right';
  on: string;
}

export interface QueryCondition {
  field: string;
  operator: string;
  value: any;
  logic?: 'AND' | 'OR';
}

export interface QueryOrderBy {
  field: string;
  direction: 'asc' | 'desc';
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  key?: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface AnalyticsPlatformConfig {
  storage: StorageConfig;
  processing: ProcessingConfig;
  aggregation: AggregationConfig;
  retention: RetentionConfig;
  privacy: PrivacyConfig;
  performance: PerformanceConfig;
}

export interface StorageConfig {
  type: 'kv' | 'd1' | 'r2' | 'hybrid';
  events: EventStorageConfig;
  metrics: MetricStorageConfig;
  reports: ReportStorageConfig;
}

export interface EventStorageConfig {
  retention: number;
  compression: boolean;
  partitioning: 'daily' | 'weekly' | 'monthly';
}

export interface MetricStorageConfig {
  retention: number;
  resolution: 'raw' | 'minute' | 'hour' | 'day';
  downsampling: boolean;
}

export interface ReportStorageConfig {
  retention: number;
  versioning: boolean;
}

export interface ProcessingConfig {
  batchSize: number;
  flushInterval: number;
  maxConcurrency: number;
  retryAttempts: number;
}

export interface RetentionConfig {
  events: number;
  aggregated: number;
  reports: number;
  exports: number;
}

export interface PrivacyConfig {
  anonymization: boolean;
  dataMinimization: boolean;
  consentRequired: boolean;
  retentionPolicy: RetentionPolicy;
}

export interface RetentionPolicy {
  events: number;
  userData: number;
  aggregated: number;
}

export interface PerformanceConfig {
  caching: CacheConfig;
  indexing: IndexingConfig;
  queryOptimization: boolean;
  materializedViews: boolean;
}

export interface IndexingConfig {
  enabled: boolean;
  fields: string[];
  type: 'btree' | 'hash' | 'fulltext';
}

// ============================================================================
// API Response Types
// ============================================================================

export interface AnalyticsResponse<T> {
  success: boolean;
  data: T;
  metadata: ResponseMetadata;
}

export interface ResponseMetadata {
  timestamp: number;
  duration: number;
  cached: boolean;
  queryId?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
