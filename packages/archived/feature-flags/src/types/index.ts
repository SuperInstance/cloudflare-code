/**
 * Feature Flags System Type Definitions
 * Comprehensive types for feature flag management, rollouts, and A/B testing
 */

// ============================================================================
// Core Flag Types
// ============================================================================

export type FlagType = 'boolean' | 'string' | 'number' | 'json';

export type FlagValueType = boolean | string | number | Record<string, unknown>;

export type FlagState = 'active' | 'inactive' | 'archived';

export interface Flag<T extends FlagValueType = FlagValueType> {
  id: string;
  key: string;
  type: FlagType;
  description: string;
  defaultValue: T;
  state: FlagState;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  tags: string[];
  owner: string;
  metadata: Record<string, unknown>;
}

export interface BooleanFlag extends Flag<boolean> {
  type: 'boolean';
  defaultValue: boolean;
}

export interface StringFlag extends Flag<string> {
  type: 'string';
  defaultValue: string;
  allowedValues?: string[];
}

export interface NumberFlag extends Flag<number> {
  type: 'number';
  defaultValue: number;
  min?: number;
  max?: number;
}

export interface JsonFlag extends Flag<Record<string, unknown>> {
  type: 'json';
  defaultValue: Record<string, unknown>;
  schema?: Record<string, unknown>;
}

// ============================================================================
// Flag Rules and Conditions
// ============================================================================

export type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'in'
  | 'not_in'
  | 'regex'
  | 'is_one_of'
  | 'is_not_one_of';

export interface Condition {
  attribute: string;
  operator: RuleOperator;
  value: unknown;
}

export interface Rule {
  id: string;
  name: string;
  conditions: Condition[];
 逻辑: 'AND' | 'OR';
  variant?: string;
  enabled: boolean;
  priority: number;
  rolloutPercentage?: number;
}

export interface FlagRules {
  flagId: string;
  rules: Rule[];
  defaultRule?: Rule;
  updatedAt: Date;
  version: number;
}

// ============================================================================
// Rollout Types
// ============================================================================

export type RolloutType =
  | 'all'
  | 'percentage'
  | 'user_id'
  | 'segment'
  | 'canary'
  | 'blue_green'
  | 'gradual'
  | 'ab_test';

export interface RolloutStrategy {
  id: string;
  type: RolloutType;
  percentage?: number;
  segmentIds?: string[];
  userIds?: string[];
  targetVariant?: string;
  schedule?: RolloutSchedule;
}

export interface RolloutSchedule {
  startDate?: Date;
  endDate?: Date;
  stages: RolloutStage[];
}

export interface RolloutStage {
  percentage: number;
  duration: number; // in milliseconds
  startTime?: Date;
}

export interface CanaryDeployment {
  id: string;
  flagId: string;
  percentage: number;
  criteria: CanaryCriteria;
  startTime: Date;
  status: 'pending' | 'active' | 'completed' | 'rolled_back';
}

export interface CanaryCriteria {
  errorRateThreshold?: number;
  latencyThreshold?: number;
  customMetrics?: CanaryMetric[];
}

export interface CanaryMetric {
  name: string;
  threshold: number;
  operator: 'greater_than' | 'less_than' | 'equals';
}

// ============================================================================
// A/B Testing Types
// ============================================================================

export interface Experiment<T extends FlagValueType = FlagValueType> {
  id: string;
  name: string;
  description: string;
  flagId: string;
  variants: Variant<T>[];
  trafficAllocation: number; // 0-100
  status: 'draft' | 'running' | 'paused' | 'completed';
  hypothesis: string;
  successMetric: string;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  minSampleSize?: number;
  confidenceLevel: number; // 0-1
}

export interface Variant<T extends FlagValueType = FlagValueType> {
  id: string;
  name: string;
  description: string;
  value: T;
  allocation: number; // percentage
  isControl: boolean;
  metadata?: Record<string, unknown>;
}

export interface ExperimentResult {
  experimentId: string;
  variantId: string;
  metrics: MetricResult[];
  conversionRate: number;
  sampleSize: number;
  confidence: number;
  isWinner: boolean;
  uplift?: number;
  pValue?: number;
}

export interface MetricResult {
  name: string;
  value: number;
  change: number;
  changePercentage: number;
  isSignificant: boolean;
}

// ============================================================================
// Targeting Types
// ============================================================================

export interface UserAttributes {
  userId: string;
  email?: string;
  country?: string;
  region?: string;
  deviceType?: string;
  os?: string;
  browser?: string;
  appVersion?: string;
  customAttributes?: Record<string, unknown>;
}

export interface Segment {
  id: string;
  name: string;
  description: string;
  conditions: Condition[];
 逻辑: 'AND' | 'OR';
  userIds?: string[];
  size?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TargetingRule {
  segmentId?: string;
  conditions?: Condition[];
  variant?: string;
  percentage?: number;
  enabled: boolean;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface FlagEvaluation {
  flagId: string;
  flagKey: string;
  userId: string;
  value: FlagValueType;
  variant?: string;
  timestamp: Date;
  evaluationDetails: EvaluationDetails;
}

export interface EvaluationDetails {
  matchedRule?: string;
  matchedSegment?: string;
  matchedVariant?: string;
  evaluationTime: number; // microseconds
  source: 'cache' | 'storage' | 'fallback';
}

export interface FlagMetrics {
  flagId: string;
  period: MetricsPeriod;
  evaluations: EvaluationMetrics;
  variants: VariantMetrics[];
  errors: ErrorMetrics;
  performance: PerformanceMetrics;
}

export interface MetricsPeriod {
  start: Date;
  end: Date;
}

export interface EvaluationMetrics {
  total: number;
  uniqueUsers: number;
  trueCount: number;
  falseCount: number;
}

export interface VariantMetrics {
  variantId: string;
  evaluations: number;
  uniqueUsers: number;
  percentage: number;
}

export interface ErrorMetrics {
  total: number;
  rate: number;
  types: Record<string, number>;
}

export interface PerformanceMetrics {
  avgEvaluationTime: number;
  p50EvaluationTime: number;
  p95EvaluationTime: number;
  p99EvaluationTime: number;
  cacheHitRate: number;
}

// ============================================================================
// Event Types
// ============================================================================

export type EventType =
  | 'flag_evaluated'
  | 'flag_created'
  | 'flag_updated'
  | 'flag_deleted'
  | 'experiment_started'
  | 'experiment_ended'
  | 'canary_started'
  | 'canary_rolled_back'
  | 'rule_updated';

export interface Event {
  id: string;
  type: EventType;
  timestamp: Date;
  flagId?: string;
  userId?: string;
  data: Record<string, unknown>;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface FeatureFlagsConfig {
  storage: StorageConfig;
  cache: CacheConfig;
  analytics: AnalyticsConfig;
  performance: PerformanceConfig;
}

export interface StorageConfig {
  type: 'durable_object' | 'kv' | 'memory';
  durableObjectId?: string;
  namespace?: string;
  ttl?: number;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  strategy: 'lru' | 'fifo' | 'lfu';
}

export interface AnalyticsConfig {
  enabled: boolean;
  sampleRate: number;
  batchSize: number;
  flushInterval: number;
}

export interface PerformanceConfig {
  maxEvaluationTime: number; // microseconds
  cacheStrategy: 'aggressive' | 'balanced' | 'minimal';
  enableParallelEvaluation: boolean;
}

// ============================================================================
// API Types
// ============================================================================

export interface EvaluationContext {
  userId: string;
  attributes: UserAttributes;
  currentTime?: Date;
  cacheKey?: string;
}

export interface EvaluationResult<T extends FlagValueType = FlagValueType> {
  value: T;
  variant?: string;
  reason: EvaluationReason;
  timestamp: Date;
  evaluationTime: number;
}

export type EvaluationReason =
  | 'default'
  | 'rule_match'
  | 'segment_match'
  | 'variant_assignment'
  | 'forced'
  | 'error';

export interface BatchEvaluationRequest {
  userId: string;
  attributes: UserAttributes;
  flagKeys: string[];
}

export interface BatchEvaluationResult {
  results: Record<string, EvaluationResult>;
  errors: Record<string, string>;
}

// ============================================================================
// Error Types
// ============================================================================

export class FeatureFlagError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'FeatureFlagError';
  }
}

export class FlagNotFoundError extends FeatureFlagError {
  constructor(flagKey: string) {
    super(`Flag not found: ${flagKey}`, 'FLAG_NOT_FOUND', { flagKey });
    this.name = 'FlagNotFoundError';
  }
}

export class InvalidFlagError extends FeatureFlagError {
  constructor(flagKey: string, reason: string) {
    super(`Invalid flag: ${flagKey} - ${reason}`, 'INVALID_FLAG', {
      flagKey,
      reason,
    });
    this.name = 'InvalidFlagError';
  }
}

export class EvaluationError extends FeatureFlagError {
  constructor(flagKey: string, details?: Record<string, unknown>) {
    super(
      `Failed to evaluate flag: ${flagKey}`,
      'EVALUATION_ERROR',
      details
    );
    this.name = 'EvaluationError';
  }
}

// ============================================================================
// Durable Object Types
// ============================================================================

export interface FlagStorageState {
  flags: Record<string, Flag>;
  rules: Record<string, FlagRules>;
  segments: Record<string, Segment>;
  experiments: Record<string, Experiment>;
  version: number;
  lastUpdated: Date;
}

export interface AnalyticsStorageState {
  evaluations: FlagEvaluation[];
  events: Event[];
  metrics: Record<string, FlagMetrics>;
  retentionPeriod: number;
}
