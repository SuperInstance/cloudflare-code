/**
 * Core experiment types for the A/B testing platform
 */

/**
 * Unique identifier for an experiment
 */
export type ExperimentId = string;

/**
 * Unique identifier for a variant
 */
export type VariantId = string;

/**
 * Unique identifier for a user/entity
 */
export type UserId = string;

/**
 * Status of an experiment in its lifecycle
 */
export enum ExperimentStatus {
  /** Experiment is being designed but not yet active */
  DRAFT = 'draft',
  /** Experiment is running and collecting data */
  RUNNING = 'running',
  /** Experiment has been paused */
  PAUSED = 'paused',
  /** Experiment has completed and winner determined */
  COMPLETED = 'completed',
  /** Experiment was terminated early */
  TERMINATED = 'terminated'
}

/**
 * Type of metric being measured
 */
export enum MetricType {
  /** Binary outcome (e.g., converted/not converted) */
  BINARY = 'binary',
  /** Continuous value (e.g., revenue, time spent) */
  CONTINUOUS = 'continuous',
  /** Count value (e.g., number of clicks) */
  COUNT = 'count',
  /** Ratio value (e.g., click-through rate) */
  RATIO = 'ratio'
}

/**
 * Direction of improvement for a metric
 */
export enum MetricDirection {
  /** Higher values are better */
  HIGHER_IS_BETTER = 'higher_is_better',
  /** Lower values are better */
  LOWER_IS_BETTER = 'lower_is_better',
  /** Values closest to target are better */
  NEUTRAL = 'neutral'
}

/**
 * Allocation strategy for variants
 */
export enum AllocationStrategy {
  /** Equal distribution across all variants */
  EQUAL = 'equal',
  /** Weighted distribution based on weights */
  WEIGHTED = 'weighted',
  /** Thompson sampling for Bayesian optimization */
  THOMPSON_SAMPLING = 'thompson_sampling',
  /** Upper Confidence Bound algorithm */
  UCB = 'ucb',
  /** Epsilon-greedy with exploration/exploitation */
  EPSILON_GREEDY = 'epsilon_greedy'
}

/**
 * Statistical test type
 */
export enum StatisticalTest {
  /** Z-test for proportions */
  Z_TEST = 'z_test',
  /** T-test for means */
  T_TEST = 't_test',
  /** Chi-square test */
  CHI_SQUARE = 'chi_square',
  /** Mann-Whitney U test */
  MANN_WHITNEY = 'mann_whitney',
  /** Bayesian analysis */
  BAYESIAN = 'bayesian'
}

/**
 * Definition of a metric to track
 */
export interface MetricDefinition {
  /** Unique identifier for the metric */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what the metric measures */
  description: string;
  /** Type of metric */
  type: MetricType;
  /** Direction of improvement */
  direction: MetricDirection;
  /** Whether this is the primary optimization target */
  primary: boolean;
  /** Minimum detectable effect size */
  minimumDetectableEffect: number;
  /** Statistical power (1 - beta) */
  power: number;
  /** Significance level (alpha) */
  alpha: number;
}

/**
 * Definition of a variant in an experiment
 */
export interface VariantDefinition {
  /** Unique identifier for the variant */
  id: VariantId;
  /** Human-readable name */
  name: string;
  /** Description of the variant */
  description: string;
  /** Allocation weight (0-1, sum of all weights must equal 1) */
  weight: number;
  /** Configuration parameters for this variant */
  parameters: Record<string, unknown>;
  /** Whether this is the control (baseline) variant */
  isControl?: boolean;
}

/**
 * Hypothesis for the experiment
 */
export interface Hypothesis {
  /** Title of the hypothesis */
  title: string;
  /** Detailed description */
  description: string;
  /** Expected outcome */
  expectedOutcome: string;
  /** Rationale for the hypothesis */
  rationale: string;
  /** Expected effect size */
  expectedEffectSize: number;
  /** Risk assessment */
  riskAssessment: string;
}

/**
 * Sample size calculation parameters
 */
export interface SampleSizeParams {
  /** Minimum detectable effect */
  minimumDetectableEffect: number;
  /** Statistical power (0-1) */
  power: number;
  /** Significance level (0-1) */
  alpha: number;
  /** Baseline conversion rate (for binary metrics) */
  baselineRate?: number;
  /** Expected standard deviation (for continuous metrics) */
  standardDeviation?: number;
  /** Number of variants */
  variantsCount: number;
}

/**
 * Experiment configuration
 */
export interface ExperimentConfig {
  /** Unique identifier */
  id: ExperimentId;
  /** Human-readable name */
  name: string;
  /** Description of the experiment */
  description: string;
  /** Hypothesis being tested */
  hypothesis: Hypothesis;
  /** Variants to test */
  variants: VariantDefinition[];
  /** Metrics to track */
  metrics: MetricDefinition[];
  /** Allocation strategy */
  allocationStrategy: AllocationStrategy;
  /** Target sample size per variant */
  targetSampleSize: number;
  /** Start timestamp */
  startTime?: number;
  /** End timestamp */
  endTime?: number;
  /** Minimum duration in milliseconds */
  minimumDuration: number;
  /** Maximum duration in milliseconds */
  maximumDuration: number;
  /** Target user segments */
  targeting?: TargetingCriteria;
  /** Tags for organization */
  tags: string[];
}

/**
 * Targeting criteria for user segmentation
 */
export interface TargetingCriteria {
  /** Inclusion criteria */
  include?: SegmentDefinition[];
  /** Exclusion criteria */
  exclude?: SegmentDefinition[];
}

/**
 * Definition of a user segment
 */
export interface SegmentDefinition {
  /** Segment name */
  name: string;
  /** Filter conditions */
  conditions: FilterCondition[];
}

/**
 * Filter condition for segmentation
 */
export interface FilterCondition {
  /** Field to filter on */
  field: string;
  /** Comparison operator */
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
  /** Value to compare against */
  value: unknown;
}

/**
 * Assignment result
 */
export interface Assignment {
  /** Experiment ID */
  experimentId: ExperimentId;
  /** Assigned variant ID */
  variantId: VariantId;
  /** User ID */
  userId: UserId;
  /** Assignment timestamp */
  assignedAt: number;
  /** Assignment metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Metric value
 */
export type MetricValue = boolean | number | string;

/**
 * Event data
 */
export interface Event {
  /** Event type/name */
  type: string;
  /** User ID */
  userId: UserId;
  /** Experiment ID */
  experimentId: ExperimentId;
  /** Variant ID */
  variantId: VariantId;
  /** Metric values */
  metrics: Record<string, MetricValue>;
  /** Event timestamp */
  timestamp: number;
  /** Additional properties */
  properties?: Record<string, unknown>;
}

/**
 * Statistical test result
 */
export interface StatisticalResult {
  /** Test type used */
  testType: StatisticalTest;
  /** P-value */
  pValue: number;
  /** Whether result is statistically significant */
  significant: boolean;
  /** Confidence level achieved */
  confidence: number;
  /** Effect size */
  effectSize: number;
  /** Confidence interval */
  confidenceInterval: [number, number];
  /** Test statistic value */
  testStatistic: number;
  /** Critical value */
  criticalValue: number;
  /** Power achieved */
  power: number;
}

/**
 * Variant statistics
 */
export interface VariantStats {
  /** Variant ID */
  variantId: VariantId;
  /** Sample size */
  sampleSize: number;
  /** Metric values */
  metrics: Record<string, MetricStats>;
  /** Conversion rate (for binary metrics) */
  conversionRate?: number;
  /** Mean value (for continuous metrics) */
  mean?: number;
  /** Standard deviation */
  standardDeviation?: number;
  /** Standard error */
  standardError?: number;
}

/**
 * Statistics for a specific metric
 */
export interface MetricStats {
  /** Metric name */
  name: string;
  /** Count of observations */
  count: number;
  /** Sum of values */
  sum: number;
  /** Mean value */
  mean: number;
  /** Variance */
  variance: number;
  /** Standard deviation */
  standardDeviation: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Percentiles */
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

/**
 * Experiment results summary
 */
export interface ExperimentResults {
  /** Experiment ID */
  experimentId: ExperimentId;
  /** Experiment status */
  status: ExperimentStatus;
  /** Statistics per variant */
  variantStats: VariantStats[];
  /** Statistical test results per metric */
  testResults: Record<string, StatisticalResult>;
  /** Winning variant (if determined) */
  winner?: {
    variantId: VariantId;
    confidence: number;
    lift: number;
    reasoning: string;
  };
  /** Total participants */
  totalParticipants: number;
  /** Results timestamp */
  timestamp: number;
}

/**
 * Bandit algorithm parameters
 */
export interface BanditParams {
  /** Algorithm type */
  algorithm: AllocationStrategy;
  /** Exploration rate (for epsilon-greedy) */
  epsilon?: number;
  /** Confidence level (for UCB) */
  confidence?: number;
  /** Prior alpha (for Thompson sampling) */
  alpha?: number;
  /** Prior beta (for Thompson sampling) */
  beta?: number;
  /** Context features (for contextual bandits) */
  contextFeatures?: string[];
}

/**
 * Cohort definition
 */
export interface CohortDefinition {
  /** Cohort name */
  name: string;
  /** Cohort description */
  description?: string;
  /** Segment criteria */
  criteria: TargetingCriteria;
  /** Creation timestamp */
  createdAt: number;
}

/**
 * Cohort analysis results
 */
export interface CohortAnalysis {
  /** Cohort name */
  cohortName: string;
  /** Experiment results for this cohort */
  results: ExperimentResults;
  /** Comparison with overall results */
  comparison: {
    /** Lift compared to overall */
    lift: number;
    /** Significance of difference */
    significant: boolean;
    /** Confidence interval */
    confidenceInterval: [number, number];
  };
}

/**
 * Visualization data
 */
export interface VisualizationData {
  /** Chart type */
  type: 'line' | 'bar' | 'funnel' | 'heatmap' | 'scatter';
  /** Data points */
  data: Array<{
    x: string | number;
    y: number;
    label?: string;
    metadata?: Record<string, unknown>;
  }>;
  /** Chart metadata */
  metadata: {
    title: string;
    xAxis: string;
    yAxis: string;
    description?: string;
  };
}

/**
 * Experiment checkpoint for rollback
 */
export interface ExperimentCheckpoint {
  /** Checkpoint timestamp */
  timestamp: number;
  /** Experiment state at checkpoint */
  state: ExperimentConfig;
  /** Results at checkpoint */
  results: ExperimentResults;
  /** Snapshot of assignments */
  assignments: Map<UserId, Assignment>;
}
