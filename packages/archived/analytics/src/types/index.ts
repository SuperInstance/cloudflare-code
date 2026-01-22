/**
 * Core types for ClaudeFlare Analytics Platform
 * Comprehensive type definitions for monitoring, experiments, features, ML ops, and insights
 */

// ============================================================================
// Monitoring Types
// ============================================================================

export interface MetricData {
  name: string;
  value: number;
  timestamp: number;
  tags: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface PerformanceMetrics {
  requestRate: number;
  responseTime: ResponseTimeMetrics;
  errorRate: ErrorMetrics;
  throughput: number;
  resourceUtilization: ResourceMetrics;
  customMetrics?: MetricData[];
}

export interface ResponseTimeMetrics {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
}

export interface ErrorMetrics {
  total: number;
  rate: number;
  byType: Record<string, number>;
  criticalErrors: number;
}

export interface ResourceMetrics {
  cpu: number;
  memory: number;
  storage: number;
  network: number;
}

export interface TimeSeriesData {
  timestamp: number;
  value: number;
  tags?: Record<string, string>;
}

export interface MetricAggregation {
  metric: string;
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'percentile';
  percentile?: number;
  groupBy?: string[];
  filter?: Record<string, string>;
}

// ============================================================================
// Experiment Types
// ============================================================================

export interface Experiment {
  id: string;
  name: string;
  description: string;
  hypothesis: string;
  metrics: MetricConfig[];
  variants: Variant[];
  allocationStrategy: AllocationStrategy;
  trafficAllocation: TrafficAllocation;
  status: ExperimentStatus;
  startDate?: number;
  endDate?: number;
  sampleSize: number;
  statisticalConfig: StatisticalConfig;
  results?: ExperimentResults;
  metadata?: Record<string, any>;
}

export interface Variant {
  id: string;
  name: string;
  description: string;
  config: Record<string, any>;
  weight: number;
  isControl?: boolean;
}

export interface MetricConfig {
  name: string;
  type: 'primary' | 'secondary' | 'guardrail';
  improvementDirection: 'increase' | 'decrease';
  statisticalTest?: StatisticalTest;
  baselineValue?: number;
  minDetectableEffect?: number;
}

export type AllocationStrategy =
  | 'random'
  | 'stratified'
  | 'cohort'
  | 'multi_armed_bandit'
  | 'thompson_sampling';

export interface TrafficAllocation {
  totalPercentage: number;
  byVariant: Record<string, number>;
  rules?: AllocationRule[];
}

export interface AllocationRule {
  condition: string;
  variant: string;
  percentage: number;
}

export type ExperimentStatus =
  | 'draft'
  | 'running'
  | 'paused'
  | 'completed'
  | 'archived'
  | 'failed';

export interface StatisticalConfig {
  significanceLevel: number;
  statisticalPower: number;
  minimumSampleSize: number;
  testType: StatisticalTest;
  sequentialTesting?: SequentialTestingConfig;
  bayesianConfig?: BayesianConfig;
}

export type StatisticalTest =
  | 't_test'
  | 'chi_square'
  | 'mann_whitney'
  | 'welch'
  | 'bayesian'
  | 'sequential';

export interface SequentialTestingConfig {
  enabled: boolean;
  alphaSpending: 'obrien_fleming' | 'pocock' | 'custom';
  interimAnalyses: number;
}

export interface BayesianConfig {
  prior: 'uniform' | 'informed' | 'empirical';
  posteriorMethod: 'mcmc' | 'variational';
  decisionThreshold: number;
}

export interface ExperimentResults {
  variantMetrics: Record<string, VariantMetrics>;
  statisticalTests: StatisticalTestResults[];
  winner?: string;
  confidence: number;
  recommendation: string;
  analysisDate: number;
}

export interface VariantMetrics {
  variantId: string;
  sampleSize: number;
  metrics: Record<string, MetricResult>;
  conversionRate?: number;
  standardError?: number;
}

export interface MetricResult {
  value: number;
  change: number;
  changePercentage: number;
  confidenceInterval: ConfidenceInterval;
  pValue?: number;
  bayesFactor?: number;
  significant: boolean;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  level: number;
}

export interface StatisticalTestResults {
  metric: string;
  testType: StatisticalTest;
  statistic: number;
  pValue: number;
  significant: boolean;
  effectSize: number;
  power: number;
  confidenceInterval: ConfidenceInterval;
}

// ============================================================================
// Feature Flag Types
// ============================================================================

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  type: FeatureFlagType;
  enabled: boolean;
  rules: FeatureRule[];
  rolloutStrategy: RolloutStrategy;
  environmentConfig: EnvironmentConfig;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export type FeatureFlagType =
  | 'boolean'
  | 'multivariate'
  | 'kill_switch'
  | 'permission'
  | 'experimentation';

export interface FeatureRule {
  id: string;
  name: string;
  condition: RuleCondition;
  variation?: string;
  enabled: boolean;
  priority: number;
}

export interface RuleCondition {
  type: 'user' | 'segment' | 'percentage' | 'custom' | 'composite';
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in' | 'contains' | 'matches';
  value: any;
  attribute?: string;
  conditions?: RuleCondition[];
  logic?: 'AND' | 'OR';
}

export type RolloutStrategy =
  | 'all_users'
  | 'percentage'
  | 'gradual'
  | 'targeted'
  | 'canary'
  | 'blue_green';

export interface RolloutConfig {
  type: RolloutStrategy;
  percentage?: number;
  steps?: RolloutStep[];
  targeting?: TargetingConfig;
}

export interface RolloutStep {
  percentage: number;
  duration?: number;
  conditions?: RuleCondition[];
}

export interface TargetingConfig {
  userSegments: string[];
  userAttributes: Record<string, any>;
  customRules: RuleCondition[];
}

export interface EnvironmentConfig {
  development: boolean;
  staging: boolean;
  production: boolean;
  environmentOverrides?: Record<string, Partial<FeatureFlag>>;
}

// ============================================================================
// ML Monitoring Types
// ============================================================================

export interface ModelMetrics {
  modelId: string;
  modelVersion: string;
  timestamp: number;
  performanceMetrics: ModelPerformanceMetrics;
  dataDrift: DataDriftMetrics;
  predictions: PredictionMetrics;
  resourceUsage: ModelResourceMetrics;
}

export interface ModelPerformanceMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  aucRoc?: number;
  aucPr?: number;
  logLoss?: number;
  calibration?: CalibrationMetrics;
  customMetrics?: Record<string, number>;
}

export interface CalibrationMetrics {
  calibrationError: number;
  brierScore: number;
  reliabilityDiagram: { observed: number; predicted: number }[];
}

export interface DataDriftMetrics {
  featureDrift: FeatureDrift[];
  predictionDrift: PredictionDrift;
  conceptDrift: ConceptDrift;
  overallDriftScore: number;
}

export interface FeatureDrift {
  feature: string;
  driftType: 'covariate' | 'prior' | 'conditional';
  driftScore: number;
  pValue: number;
  distribution: DistributionComparison;
  testMethod: string;
}

export interface DistributionComparison {
  trainMean: number;
  testMean: number;
  trainStd: number;
  testStd: number;
  kolmogorovSmirnovStat: number;
}

export interface PredictionDrift {
  driftScore: number;
  distributionShift: DistributionComparison;
  labelShift: LabelShift;
}

export interface LabelShift {
  trainDistribution: Record<string, number>;
  testDistribution: Record<string, number>;
  jsDivergence: number;
}

export interface ConceptDrift {
  detected: boolean;
  driftScore: number;
  accuracyChange: number;
  method: string;
}

export interface PredictionMetrics {
  totalPredictions: number;
  predictionDistribution: Record<string, number>;
  confidenceScores: ConfidenceMetrics;
  latency: number;
  errorRate: number;
}

export interface ConfidenceMetrics {
  mean: number;
  std: number;
  lowConfidenceRate: number;
  highConfidenceRate: number;
}

export interface ModelResourceMetrics {
  inferenceTime: number;
  memoryUsage: number;
  cpuUsage: number;
  throughput: number;
  batchSize: number;
}

export interface ModelExplainability {
  modelId: string;
  timestamp: number;
  featureImportance: FeatureImportance[];
  shapValues: ShapData;
  attentionVisualization?: AttentionData;
  errorAnalysis: ErrorAnalysis;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  method: 'permutation' | 'gain' | 'shap' | 'lime';
}

export interface ShapData {
  values: number[][];
  baseValue: number;
  features: string[];
}

export interface AttentionData {
  layer: number;
  heads: number[][];
  tokens: string[];
}

export interface ErrorAnalysis {
  totalErrors: number;
  errorTypes: Record<string, number>;
  confusionMatrix: number[][];
  errorPatterns: ErrorPattern[];
}

export interface ErrorPattern {
  pattern: string;
  count: number;
  examples: any[];
  suggestedFix?: string;
}

// ============================================================================
// Insights Types
// ============================================================================

export interface Insight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  description: string;
  timestamp: number;
  data: InsightData;
  recommendations: Recommendation[];
  confidence: number;
  expiresAt?: number;
}

export type InsightType =
  | 'anomaly'
  | 'bottleneck'
  | 'trend'
  | 'opportunity'
  | 'degradation'
  | 'optimization'
  | 'forecast';

export type InsightSeverity = 'info' | 'warning' | 'critical' | 'action_required';

export interface InsightData {
  metrics: string[];
  timeRange: TimeRange;
  affectedComponents: string[];
  baseline: any;
  current: any;
  change: any;
}

export interface TimeRange {
  start: number;
  end: number;
  duration: number;
}

export interface Recommendation {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  action: string;
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
  estimatedBenefit?: string;
}

export interface AnomalyDetection {
  metric: string;
  anomalies: Anomaly[];
  algorithm: 'isolation_forest' | 'autoencoder' | 'statistical' | 'moving_average';
  confidence: number;
}

export interface Anomaly {
  timestamp: number;
  value: number;
  expected: number;
  deviation: number;
  score: number;
  severity: InsightSeverity;
}

export interface Bottleneck {
  component: string;
  type: 'cpu' | 'memory' | 'io' | 'network' | 'database';
  severity: number;
  impact: string;
  suggestedActions: string[];
}

export interface Forecast {
  metric: string;
  horizon: number;
  predictions: ForecastPoint[];
  confidenceInterval: number;
  method: 'arima' | 'prophet' | 'lstm' | 'linear_regression';
  accuracy: number;
}

export interface ForecastPoint {
  timestamp: number;
  value: number;
  lower: number;
  upper: number;
}

export interface TrendAnalysis {
  metric: string;
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  changeRate: number;
  r2: number;
  seasonality?: Seasonality;
}

export interface Seasonality {
  period: number;
  strength: number;
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

// ============================================================================
// Report Types
// ============================================================================

export interface AnalyticsReport {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  timeRange: TimeRange;
  metrics: string[];
  filters: ReportFilter[];
  data: ReportData;
  visualizations: Visualization[];
  createdAt: number;
  updatedAt: number;
}

export type ReportType =
  | 'performance'
  | 'experiment'
  | 'feature'
  | 'ml_model'
  | 'custom'
  | 'executive_summary';

export interface ReportFilter {
  field: string;
  operator: string;
  value: any;
}

export interface ReportData {
  summary: ReportSummary;
  breakdown: DataPoint[];
  comparisons: Comparison[];
}

export interface ReportSummary {
  total: number;
  average: number;
  change: number;
  changePercent: number;
}

export interface DataPoint {
  dimension: string;
  value: number;
  breakdown?: DataPoint[];
}

export interface Comparison {
  period: string;
  value: number;
  change: number;
  changePercent: number;
}

export interface Visualization {
  type: 'line' | 'bar' | 'pie' | 'table' | 'heatmap' | 'funnel';
  title: string;
  data: any;
  config: Record<string, any>;
}

// ============================================================================
// Common Types
// ============================================================================

export interface AnalyticsConfig {
  samplingRate: number;
  retentionDays: number;
  batchSize: number;
  flushInterval: number;
  enableRealtime: boolean;
  storageBackend: 'memory' | 'kv' | 'r2' | 'durable';
}

export interface AnalyticsEvent {
  id: string;
  type: string;
  timestamp: number;
  userId?: string;
  sessionId?: string;
  properties: Record<string, any>;
  tags?: Record<string, string>;
}

export interface QueryOptions {
  timeRange: TimeRange;
  granularity?: 'minute' | 'hour' | 'day' | 'week' | 'month';
  filters?: Record<string, any>;
  groupBy?: string[];
  aggregations?: MetricAggregation[];
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
