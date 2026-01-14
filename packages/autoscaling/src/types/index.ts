/**
 * Auto-scaling type definitions for ClaudeFlare
 */

// ============================================================================
// Core Types
// ============================================================================

export interface ScalingPolicy {
  id: string;
  name: string;
  description: string;
  resourceType: ResourceType;
  enabled: boolean;
  triggers: ScalingTrigger[];
  actions: ScalingAction[];
  cooldownPeriod: number;
  createdAt: Date;
  updatedAt: Date;
}

export enum ResourceType {
  WORKER = 'worker',
  DURABLE_OBJECT = 'durable_object',
  KV = 'kv',
  R2 = 'r2',
  D1 = 'd1',
  QUEUE = 'queue'
}

export interface ScalingTrigger {
  id: string;
  type: TriggerType;
  condition: TriggerCondition;
  threshold: number;
  comparison: ComparisonOperator;
  duration?: number;
  evaluationInterval?: number;
}

export enum TriggerType {
  CPU_UTILIZATION = 'cpu_utilization',
  CPU_CREDITS = 'cpu_credits',
  MEMORY_USAGE = 'memory_usage',
  MEMORY_LEAK = 'memory_leak',
  REQUEST_RATE = 'request_rate',
  QUEUE_LENGTH = 'queue_length',
  LATENCY = 'latency',
  ERROR_RATE = 'error_rate',
  CUSTOM_METRIC = 'custom_metric',
  PREDICTIVE_LOAD = 'predictive_load',
  TIME_BASED = 'time_based',
  EVENT_BASED = 'event_based'
}

export enum ComparisonOperator {
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  EQUALS = 'equals',
  GREATER_THAN_OR_EQUAL = 'greater_than_or_equal',
  LESS_THAN_OR_EQUAL = 'less_than_or_equal'
}

export interface TriggerCondition {
  metric: string;
  aggregation: AggregationType;
  window: number;
}

export enum AggregationType {
  AVERAGE = 'average',
  SUM = 'sum',
  MAX = 'max',
  MIN = 'min',
  PERCENTILE = 'percentile',
  COUNT = 'count'
}

export interface ScalingAction {
  id: string;
  type: ActionType;
  target: string;
  parameters: Record<string, unknown>;
  order: number;
  delay?: number;
}

export enum ActionType {
  SCALE_UP = 'scale_up',
  SCALE_DOWN = 'scale_down',
  ADJUST_CPU = 'adjust_cpu',
  ADJUST_MEMORY = 'adjust_memory',
  ADJUST_CAPACITY = 'adjust_capacity',
  ENABLE_FEATURE = 'enable_feature',
  DISABLE_FEATURE = 'disable_feature',
  CHANGE_TIER = 'change_tier',
  REDISTRIBUTE_LOAD = 'redistribute_load'
}

// ============================================================================
// Prediction Types
// ============================================================================

export interface PredictionModel {
  id: string;
  name: string;
  type: PredictionModelType;
  trainedAt: Date;
  accuracy: number;
  features: string[];
  horizon: number;
  confidenceInterval: number;
}

export enum PredictionModelType {
  LINEAR_REGRESSION = 'linear_regression',
  ARIMA = 'arima',
  PROPHET = 'prophet',
  LSTM = 'lstm',
  XGBOOST = 'xgboost',
  ENSEMBLE = 'ensemble'
}

export interface PredictionResult {
  timestamp: Date;
  metric: string;
  predictions: PredictionPoint[];
  confidence: number;
  model: string;
  features: Record<string, number>;
}

export interface PredictionPoint {
  timestamp: Date;
  value: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  metadata?: Record<string, unknown>;
}

export interface SeasonalPattern {
  period: number;
  amplitude: number;
  phase: number;
  type: SeasonalType;
}

export enum SeasonalType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  CUSTOM = 'custom'
}

// ============================================================================
// Resource Allocation Types
// ============================================================================

export interface ResourceAllocation {
  id: string;
  resourceType: ResourceType;
  resourceId: string;
  allocation: ResourceSpec;
  usage: ResourceUsage;
  status: AllocationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResourceSpec {
  cpu: CpuSpec;
  memory: MemorySpec;
  storage: StorageSpec;
  network: NetworkSpec;
}

export interface CpuSpec {
  cores: number;
  frequency: number;
  credits: number;
  burstCapacity: number;
}

export interface MemorySpec {
  size: number;
  type: MemoryType;
  swap?: number;
}

export enum MemoryType {
  DRAM = 'dram',
  SSD = 'ssd',
  NVME = 'nvme'
}

export interface StorageSpec {
  size: number;
  type: StorageType;
  iops: number;
  throughput: number;
}

export enum StorageType {
  SSD = 'ssd',
  HDD = 'hdd',
  NVME = 'nvme'
}

export interface NetworkSpec {
  bandwidth: number;
  connections: number;
  requestsPerSecond: number;
}

export interface ResourceUsage {
  cpu: number;
  memory: number;
  storage: number;
  network: number;
  timestamp: Date;
}

export enum AllocationStatus {
  ACTIVE = 'active',
  SCALING = 'scaling',
  OVERPROVISIONED = 'overprovisioned',
  UNDERPROVISIONED = 'underprovisioned',
  ERROR = 'error'
}

export interface AllocationStrategy {
  type: AllocationStrategyType;
  parameters: Record<string, unknown>;
  constraints: AllocationConstraint[];
}

export enum AllocationStrategyType {
  BIN_PACKING = 'bin_packing',
  WORST_FIT = 'worst_fit',
  BEST_FIT = 'best_fit',
  FIRST_FIT = 'first_fit',
  SPREAD = 'spread',
  BIN_PACKING_WITH_AFFINITY = 'bin_packing_with_affinity'
}

export interface AllocationConstraint {
  type: ConstraintType;
  resource: string;
  operator: ComparisonOperator;
  value: number;
}

export enum ConstraintType {
  MIN = 'min',
  MAX = 'max',
  EXACT = 'exact',
  PREFERRED = 'preferred'
}

// ============================================================================
// Cost Optimization Types
// ============================================================================

export interface CostAnalysis {
  resourceId: string;
  resourceType: ResourceType;
  currentCost: CostBreakdown;
  projectedCost: CostBreakdown;
  optimization: CostOptimization[];
  savings: number;
  timestamp: Date;
}

export interface CostBreakdown {
  compute: number;
  storage: number;
  network: number;
  requests: number;
  total: number;
  period: CostPeriod;
}

export enum CostPeriod {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly'
}

export interface CostOptimization {
  type: CostOptimizationType;
  description: string;
  savings: number;
  effort: OptimizationEffort;
  risk: OptimizationRisk;
  implementation: OptimizationStep[];
}

export enum CostOptimizationType {
  RIGHT_SIZE = 'right_size',
  RESERVED_CAPACITY = 'reserved_capacity',
  SPOT_INSTANCE = 'spot_instance',
  SCHEDULED_SCALING = 'scheduled_scaling',
  ARCHITECTURE_CHANGE = 'architecture_change',
  CACHING = 'caching',
  DATA_COMPRESSION = 'data_compression',
  QUERY_OPTIMIZATION = 'query_optimization'
}

export enum OptimizationEffort {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum OptimizationRisk {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export interface OptimizationStep {
  order: number;
  action: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface Budget {
  id: string;
  name: string;
  limit: number;
  period: CostPeriod;
  alertThresholds: number[];
  currentSpend: number;
  forecast: BudgetForecast;
  tags: Record<string, string>;
}

export interface BudgetForecast {
  projected: number;
  confidence: number;
  overageProbability: number;
  recommendedActions: string[];
}

// ============================================================================
// Metrics Types
// ============================================================================

export interface ScalingMetrics {
  cpuMetrics: CpuMetrics;
  memoryMetrics: MemoryMetrics;
  requestMetrics: RequestMetrics;
  performanceMetrics: PerformanceMetrics;
  costMetrics: CostMetrics;
  timestamp: Date;
}

export interface CpuMetrics {
  utilization: number;
  credits: number;
  burstCapacity: number;
  throttleCount: number;
}

export interface MemoryMetrics {
  usage: number;
  available: number;
  cached: number;
  swapUsage: number;
  pageFaults: number;
}

export interface RequestMetrics {
  rate: number;
  count: number;
  errors: number;
  timeoutRate: number;
  averageSize: number;
}

export interface PerformanceMetrics {
  latency: LatencyMetrics;
  throughput: number;
  errorRate: number;
  availability: number;
  saturation: number;
}

export interface LatencyMetrics {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  average: number;
  max: number;
}

export interface CostMetrics {
  currentHour: number;
  currentDay: number;
  currentMonth: number;
  projectedDay: number;
  projectedMonth: number;
}

export interface MetricThreshold {
  metric: string;
  warning: number;
  critical: number;
  action: string;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface ScalingAnalytics {
  resourceId: string;
  period: TimePeriod;
  events: ScalingEvent[];
  patterns: ScalingPattern[];
  insights: ScalingInsight[];
  recommendations: ScalingRecommendation[];
  summary: ScalingSummary;
}

export interface TimePeriod {
  start: Date;
  end: Date;
}

export interface ScalingEvent {
  id: string;
  timestamp: Date;
  type: ScalingEventType;
  trigger: string;
  before: ResourceState;
  after: ResourceState;
  duration: number;
  status: ScalingStatus;
  impact: ScalingImpact;
}

export enum ScalingEventType {
  SCALE_UP = 'scale_up',
  SCALE_DOWN = 'scale_down',
  ADJUSTMENT = 'adjustment',
  REBALANCE = 'rebalance',
  MIGRATION = 'migration',
  OPTIMIZATION = 'optimization'
}

export interface ResourceState {
  capacity: number;
  cpu: number;
  memory: number;
  instances: number;
  cost: number;
}

export enum ScalingStatus {
  SUCCESS = 'success',
  PARTIAL = 'partial',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back'
}

export interface ScalingImpact {
  performanceChange: number;
  costChange: number;
  availabilityChange: number;
  userImpact: UserImpact;
}

export enum UserImpact {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export interface ScalingPattern {
  type: PatternType;
  description: string;
  confidence: number;
  occurrences: number;
  schedule?: PatternSchedule;
  characteristics: Record<string, unknown>;
}

export enum PatternType {
  SEASONAL = 'seasonal',
  TREND = 'trend',
  SPIKE = 'spike',
  DIP = 'dip',
  ANOMALY = 'anomaly',
  CORRELATED = 'correlated'
}

export interface PatternSchedule {
  frequency: string;
  startTime?: string;
  endTime?: string;
  days?: number[];
}

export interface ScalingInsight {
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
  evidence: string[];
  impact: string;
  timestamp: Date;
}

export enum InsightCategory {
  PERFORMANCE = 'performance',
  COST = 'cost',
  AVAILABILITY = 'availability',
  EFFICIENCY = 'efficiency',
  ANOMALY = 'anomaly'
}

export enum InsightSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

export interface ScalingRecommendation {
  id: string;
  type: RecommendationType;
  priority: RecommendationPriority;
  title: string;
  description: string;
  rationale: string;
  expectedBenefit: ExpectedBenefit;
  implementation: RecommendationImplementation;
  createdAt: Date;
}

export enum RecommendationType {
  SCALE_UP = 'scale_up',
  SCALE_DOWN = 'scale_down',
  RIGHT_SIZE = 'right_size',
  SCHEDULE_SCALING = 'schedule_scaling',
  CHANGE_POLICY = 'change_policy',
  ARCHITECTURE_CHANGE = 'architecture_change',
  COST_OPTIMIZATION = 'cost_optimization'
}

export enum RecommendationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface ExpectedBenefit {
  performance: number;
  cost: number;
  reliability: number;
}

export interface RecommendationImplementation {
  steps: string[];
  estimatedTime: number;
  complexity: OptimizationEffort;
  risk: OptimizationRisk;
  rollbackPlan: string;
}

export interface ScalingSummary {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  averageScaleTime: number;
  totalCostSavings: number;
  performanceImprovement: number;
  uptime: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface AutoscalingConfig {
  enabled: boolean;
  pollingInterval: number;
  evaluationInterval: number;
  cooldownPeriod: number;
  maxScaleUpPercent: number;
  maxScaleDownPercent: number;
  targetUtilization: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  predictiveScaling: PredictiveScalingConfig;
  costOptimization: CostOptimizationConfig;
  metrics: MetricsConfig;
  alerts: AlertsConfig;
}

export interface PredictiveScalingConfig {
  enabled: boolean;
  modelType: PredictionModelType;
  predictionHorizon: number;
  confidenceThreshold: number;
  retrainInterval: number;
  features: string[];
}

export interface CostOptimizationConfig {
  enabled: boolean;
  budgetLimit: number;
  budgetPeriod: CostPeriod;
  rightSizingEnabled: boolean;
  spotInstanceEnabled: boolean;
  reservedCapacityEnabled: boolean;
  optimizationInterval: number;
}

export interface MetricsConfig {
  retentionDays: number;
  aggregationLevel: AggregationType;
  collectionInterval: number;
  enabledMetrics: string[];
}

export interface AlertsConfig {
  enabled: boolean;
  channels: AlertChannel[];
  severityThresholds: Record<string, number>;
}

export interface AlertChannel {
  type: AlertChannelType;
  config: Record<string, unknown>;
}

export enum AlertChannelType {
  EMAIL = 'email',
  WEBHOOK = 'webhook',
  SLACK = 'slack',
  PAGER_DUTY = 'pager_duty',
  DATADOG = 'datadog'
}

// ============================================================================
// Health Check Types
// ============================================================================

export interface HealthCheck {
  id: string;
  resourceId: string;
  type: HealthCheckType;
  config: HealthCheckConfig;
  status: HealthStatus;
  lastCheck: Date;
  consecutiveFailures: number;
}

export enum HealthCheckType {
  HTTP = 'http',
  TCP = 'tcp',
  HTTPS = 'https',
  SCRIPT = 'script'
}

export interface HealthCheckConfig {
  interval: number;
  timeout: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
  path?: string;
  port?: number;
  expectedStatus?: number;
  protocol?: string;
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
  DRAINING = 'draining'
}
