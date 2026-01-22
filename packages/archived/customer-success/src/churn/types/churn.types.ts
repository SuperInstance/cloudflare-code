/**
 * Customer Success Platform - Churn Prediction Types
 * Defines all churn prediction related types and interfaces
 */

export interface ChurnPrediction {
  id: string;
  customerId: string;
  prediction: PredictionResult;
  riskFactors: RiskFactor[];
  riskScore: number; // 0-100
  riskLevel: RiskLevel;
  probability: number; // 0-1
  confidence: number; // 0-1
  predictedChurnDate?: Date;
  timeHorizon: number; // days into the future
  modelVersion: string;
  features: FeatureImportance[];
  trends: ChurnTrends;
  interventions: InterventionRecommendation[];
  generatedAt: Date;
  expiresAt: Date;
  lastUpdated: Date;
  history: PredictionHistory[];
}

export interface PredictionResult {
  willChurn: boolean;
  probability: number;
  confidence: number;
  expectedChurnDate?: Date;
  churnType: ChurnType;
  primaryReason: string;
  secondaryReasons: string[];
  preventable: boolean;
}

export type ChurnType =
  | 'voluntary'
  | 'involuntary'
  | 'passive'
  | 'active'
  | 'competitive'
  | 'price_related'
  | 'product_related'
  | 'service_related';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';

export interface RiskFactor {
  id: string;
  name: string;
  category: RiskCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  score: number; // 0-100
  weight: number; // contribution to overall risk
  currentValue: number;
  threshold: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  description: string;
  evidence: RiskEvidence[];
  startedAt?: Date;
  duration?: number; // days
}

export type RiskCategory =
  | 'usage'
  | 'engagement'
  | 'support'
  | 'financial'
  | 'product'
  | 'competitive'
  | 'contractual'
  | 'operational';

export interface RiskEvidence {
  type: 'metric' | 'event' | 'feedback' | 'behavioral' | 'transactional';
  description: string;
  timestamp: Date;
  value: any;
  source: string;
}

export interface FeatureImportance {
  feature: string;
  importance: number; // 0-1
  value: number;
  contribution: string; // to churn prediction
  category: string;
}

export interface ChurnTrends {
  riskScore: TrendData;
  usage: TrendData;
  engagement: TrendData;
  satisfaction: TrendData;
  support: TrendData;
  financial: TrendData;
}

export interface TrendData {
  current: number;
  previous: number;
  change: number;
  direction: 'up' | 'down' | 'stable';
  dataPoints: TrendPoint[];
  movingAverage: number;
  trendLine: {
    slope: number;
    intercept: number;
    correlation: number;
  };
}

export interface TrendPoint {
  date: Date;
  value: number;
}

export interface InterventionRecommendation {
  id: string;
  type: InterventionType;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  rationale: string;
  expectedImpact: number; // reduction in churn probability
  confidence: number; // 0-1
  effort: 'low' | 'medium' | 'high';
  cost: number; // estimated cost in USD
  estimatedTimeToImplement: number; // in days
  actions: InterventionAction[];
  playbooks: string[]; // playbook IDs
  assignee?: string;
  dueDate?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  actualImpact?: number;
}

export type InterventionType =
  | 'contact_outreach'
  | 'feature_training'
  | 'support_upgrade'
  | 'pricing_adjustment'
  | 'product_improvement'
  | 'success_plan'
  | 'executive_engagement'
  | 'community_engagement'
  | 'incentive'
  | 'custom';

export interface InterventionAction {
  order: number;
  action: string;
  type: 'automated' | 'manual' | 'hybrid';
  assignee?: string;
  dueDate?: Date;
  completed: boolean;
  completedAt?: Date;
  notes?: string;
  result?: string;
}

export interface PredictionHistory {
  date: Date;
  riskScore: number;
  riskLevel: RiskLevel;
  probability: number;
  topRiskFactors: string[];
  interventions: string[];
}

export interface ChurnModel {
  id: string;
  name: string;
  description: string;
  version: string;
  type: ModelType;
  algorithm: ModelAlgorithm;
  status: ModelStatus;
  performance: ModelPerformance;
  features: ModelFeature[];
  configuration: ModelConfiguration;
  trainingData: TrainingDataInfo;
  deployment: DeploymentInfo;
  createdAt: Date;
  updatedAt: Date;
  lastTrainedAt: Date;
}

export type ModelType = 'classification' | 'regression' | 'ensemble' | 'neural_network';

export type ModelAlgorithm =
  | 'logistic_regression'
  | 'random_forest'
  | 'gradient_boosting'
  | 'xgboost'
  | 'lightgbm'
  | 'neural_network'
  | 'lstm'
  | 'transformer';

export type ModelStatus = 'training' | 'trained' | 'deployed' | 'deprecated' | 'failed';

export interface ModelPerformance {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number; // Area Under Curve
  confusionMatrix: ConfusionMatrix;
  calibration: number;
  lift: LiftData;
  validation: ValidationMetrics;
}

export interface ConfusionMatrix {
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
}

export interface LiftData {
  liftScore: number;
  liftByDecile: number[];
  cumulativeLift: number[];
}

export interface ValidationMetrics {
  crossValidation: CrossValidationMetrics;
  holdout: HoldoutMetrics;
  benchmark: BenchmarkComparison;
}

export interface CrossValidationMetrics {
  folds: number;
  meanAccuracy: number;
  stdAccuracy: number;
  meanAuc: number;
  stdAuc: number;
}

export interface HoldoutMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;
}

export interface BenchmarkComparison {
  baselineAccuracy: number;
  improvement: number;
  baselineModel: string;
}

export interface ModelFeature {
  name: string;
  type: 'numerical' | 'categorical' | 'boolean' | 'text' | 'temporal';
  importance: number;
  description: string;
  source: string;
  transformation?: string;
  missingValueStrategy: string;
}

export interface ModelConfiguration {
  hyperparameters: Record<string, any>;
  featureSelection: FeatureSelectionConfig;
  crossValidation: CrossValidationConfig;
  training: TrainingConfig;
  prediction: PredictionConfig;
}

export interface FeatureSelectionConfig {
  method: 'none' | 'variance_threshold' | 'correlation' | 'mutual_info' | 'recursive';
  maxFeatures?: number;
  threshold?: number;
}

export interface CrossValidationConfig {
  method: 'k_fold' | 'stratified_k_fold' | 'time_series';
  folds: number;
  shuffle: boolean;
  stratify?: boolean;
}

export interface TrainingConfig {
  batchSize?: number;
  epochs?: number;
  learningRate?: number;
  earlyStopping: boolean;
  earlyStoppingPatience?: number;
  classWeight?: 'balanced' | Record<string, number>;
}

export interface PredictionConfig {
  threshold: number; // probability threshold for churn prediction
  minConfidence: number;
  timeHorizon: number; // days to predict ahead
  recalibrationInterval: number; // days between recalibrations
}

export interface TrainingDataInfo {
  source: string;
  periodStart: Date;
  periodEnd: Date;
  sampleSize: number;
  positiveSamples: number;
  negativeSamples: number;
  imbalanceRatio: number;
  features: number;
  splits: DataSplit[];
}

export interface DataSplit {
  name: 'train' | 'validation' | 'test';
  size: number;
  percentage: number;
  churnRate: number;
}

export interface DeploymentInfo {
  environment: 'development' | 'staging' | 'production';
  endpoint?: string;
  version: string;
  deployedAt: Date;
  deployedBy: string;
  predictionsMade: number;
  lastPredictionAt: Date;
}

export interface ChurnAnalysis {
  id: string;
  customerId: string;
  period: AnalysisPeriod;
  summary: AnalysisSummary;
  patterns: ChurnPattern[];
  signals: ChurnSignal[];
  indicators: ChurnIndicator[];
  stage: ChurnStage;
  trajectory: ChurnTrajectory;
  similarCases: SimilarCustomer[];
  recommendations: AnalysisRecommendation[];
  generatedAt: Date;
}

export interface AnalysisPeriod {
  start: Date;
  end: Date;
  type: 'retrospective' | 'predictive';
}

export interface AnalysisSummary {
  currentRisk: RiskLevel;
  riskScore: number;
  riskTrend: 'increasing' | 'stable' | 'decreasing';
  primaryDrivers: string[];
  churnProbability: number;
  confidence: number;
  estimatedChurnDate?: Date;
  revenueAtRisk: number;
}

export interface ChurnPattern {
  id: string;
  name: string;
  description: string;
  category: PatternCategory;
  confidence: number;
  strength: 'weak' | 'moderate' | 'strong';
  timeframe: number; // days
  occurrences: number;
  significance: number; // statistical significance
  examples: PatternExample[];
}

export type PatternCategory =
  | 'usage_decline'
  | 'engagement_drop'
  | 'support_spike'
  | 'payment_issue'
  | 'competitive_threat'
  | 'feature_abandonment'
  | 'inactivity'
  | 'seasonal';

export interface PatternExample {
  date: Date;
  description: string;
  metrics: Record<string, number>;
}

export interface ChurnSignal {
  id: string;
  type: SignalType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  value: number;
  threshold: number;
  status: 'active' | 'resolved' | 'false_positive';
  firstDetected: Date;
  lastDetected: Date;
  occurrences: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  relatedSignals: string[];
}

export type SignalType =
  | 'usage_drop'
  | 'login_inactivity'
  | 'feature_abandonment'
  | 'support_ticket_spike'
  | 'negative_feedback'
  | 'payment_failure'
  | 'competitor_activity'
  | 'contract_expiration'
  | 'executive_change'
  | 'merger_acquisition';

export interface ChurnIndicator {
  id: string;
  name: string;
  category: IndicatorCategory;
  value: number;
  threshold: number;
  status: 'normal' | 'warning' | 'critical';
  weight: number;
  trend: 'improving' | 'stable' | 'declining';
  history: IndicatorHistoryPoint[];
  predictivePower: number; // 0-1
}

export type IndicatorCategory =
  | 'usage'
  | 'engagement'
  | 'sentiment'
  | 'support'
  | 'financial'
  | 'operational'
  | 'relationship';

export interface IndicatorHistoryPoint {
  date: Date;
  value: number;
  status: 'normal' | 'warning' | 'critical';
}

export type ChurnStage =
  | 'healthy'
  | 'early_warning'
  | 'at_risk'
  | 'high_risk'
  | 'critical'
  | 'churned';

export interface ChurnTrajectory {
  currentStage: ChurnStage;
  previousStage: ChurnStage;
  direction: 'improving' | 'stable' | 'declining';
  velocity: number; // speed of change
  acceleration: number; // change in velocity
  predictedPath: ChurnStage[];
  predictedDates: Date[];
  confidence: number;
}

export interface SimilarCustomer {
  customerId: string;
  similarity: number; // 0-1
  outcome: 'churned' | 'retained';
  riskFactors: string[];
  keyDifferences: string[];
  lessons: string[];
}

export interface AnalysisRecommendation {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  recommendation: string;
  rationale: string;
  expectedImpact: number;
  effort: 'low' | 'medium' | 'high';
  timeline: number; // days
  actions: string[];
  resources: string[];
}

export interface ChurnSegment {
  id: string;
  name: string;
  description: string;
  characteristics: SegmentCharacteristics;
  customers: string[];
  size: number;
  churnRate: number;
  avgRiskScore: number;
  commonRiskFactors: string[];
  recommendedInterventions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SegmentCharacteristics {
  demographics: Record<string, any>;
  firmographics: Record<string, any>;
  usage: Record<string, any>;
  behavioral: Record<string, any>;
  transactional: Record<string, any>;
}

export interface ChurnExperiment {
  id: string;
  name: string;
  description: string;
  hypothesis: string;
  segment: string;
  intervention: InterventionRecommendation;
  metrics: ExperimentMetrics;
  status: 'planned' | 'running' | 'completed' | 'cancelled';
  startDate: Date;
  endDate?: Date;
  results?: ExperimentResults;
  learnings?: string[];
  nextSteps?: string[];
}

export interface ExperimentMetrics {
  primary: string;
  secondary: string[];
  baseline: number;
  target: number;
  current?: number;
}

export interface ExperimentResults {
  achieved: number;
  improvement: number;
  improvementPercent: number;
  significance: number;
  confidence: number;
  churnReduction: number;
  revenueSaved: number;
  recommendations: string[];
}

export interface ChurnForecast {
  id: string;
  period: ForecastPeriod;
  overall: ForecastMetrics;
  bySegment: Record<string, ForecastMetrics>;
  byTier: Record<string, ForecastMetrics>;
  byCohort: Record<string, ForecastMetrics>;
  topRisks: ChurnRisk[];
  recommendations: ForecastRecommendation[];
  generatedAt: Date;
  confidence: number;
}

export interface ForecastPeriod {
  start: Date;
  end: Date;
  type: 'monthly' | 'quarterly' | 'annual';
}

export interface ForecastMetrics {
  predictedChurn: number;
  predictedChurnRate: number;
  predictedRevenue: number;
  confidence: number;
  upperBound: number;
  lowerBound: number;
}

export interface ChurnRisk {
  customerId: string;
  customerName: string;
  riskScore: number;
  riskLevel: RiskLevel;
  probability: number;
  revenueAtRisk: number;
  primaryReason: string;
  recommendedAction: string;
}

export interface ForecastRecommendation {
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  recommendation: string;
  expectedImpact: number;
  customersAffected: number;
  revenueImpact: number;
}

export interface ChurnIntervention {
  id: string;
  customerId: string;
  predictionId: string;
  type: InterventionType;
  status: InterventionStatus;
  assignedTo: string;
  actions: InterventionAction[];
  timeline: InterventionTimeline;
  budget: number;
  actualCost?: number;
  results?: InterventionResults;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export type InterventionStatus =
  | 'pending'
  | 'approved'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface InterventionTimeline {
  plannedStartDate: Date;
  plannedEndDate: Date;
  milestones: InterventionMilestone[];
}

export interface InterventionMilestone {
  name: string;
  date: Date;
  status: 'pending' | 'completed' | 'missed';
  completedAt?: Date;
}

export interface InterventionResults {
  outcome: 'successful' | 'partially_successful' | 'unsuccessful';
  churnPrevented: boolean;
  riskScoreChange: number;
  probabilityChange: number;
  retentionExtended: number; // days
  revenueSaved: number;
  feedback: string;
  lessons: string[];
  nextSteps: string[];
}
