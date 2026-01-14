/**
 * Core type definitions for XAI explanations
 */

// ============================================================================
// Base Explanation Types
// ============================================================================

export interface BaseExplanation {
  id: string;
  timestamp: Date;
  modelId: string;
  modelName: string;
  prediction: number | string;
  confidence: number;
}

export interface FeatureExplanation {
  featureName: string;
  featureValue: any;
  importance: number;
  contribution: number;
  direction: 'positive' | 'negative' | 'neutral';
  description?: string;
}

export interface LocalExplanation extends BaseExplanation {
  instanceId: string;
  instance: Record<string, any>;
  features: FeatureExplanation[];
  explanation: string;
  visualization?: VisualizationData;
}

export interface GlobalExplanation {
  modelId: string;
  modelName: string;
  featureImportance: FeatureImportance[];
  modelBehavior: ModelBehavior;
  limitations: string[];
  dataInfluence?: DataInfluence;
  recommendations: string[];
}

// ============================================================================
// SHAP Types
// ============================================================================

export interface SHAPValues {
  values: number[] | number[][];
  baseValue: number;
  data: Record<string, any>;
  featureNames: string[];
}

export interface SHAPExplanation extends LocalExplanation {
  method: 'kernel' | 'tree' | 'deep' | 'sampling';
  shapValues: SHAPValues;
  expectedValue: number;
  interactions?: SHAPInteractionValues;
}

export interface SHAPInteractionValues {
  values: number[][];
  featureNames: string[];
  matrix: number[][];
}

export interface SHAPConfig {
  method: 'kernel' | 'tree' | 'deep' | 'sampling';
  backgroundSize?: number;
  maxSamples?: number;
  algorithm?: 'auto' | 'exact' | 'approximate';
  outputPrecision?: number;
}

// ============================================================================
// LIME Types
// ============================================================================

export interface LIMEExplanation extends LocalExplanation {
  method: 'tabular' | 'text' | 'image';
  localExplanation: LocalModelExplanation;
  intercept: number;
  predictionLocal: number;
  score: number;
  samples: number;
}

export interface LocalModelExplanation {
  coefficients: number[];
  intercept: number;
  featureNames: string[];
  r2: number;
  prediction: number;
}

export interface LIMEConfig {
  numSamples?: number;
  kernelWidth?: number;
  mode?: 'classification' | 'regression';
  featureSelection?: 'auto' | 'none' | 'forward_selection' | 'highest_weights';
  discretizeContinuous?: boolean;
}

// ============================================================================
// Feature Importance Types
// ============================================================================

export interface FeatureImportance {
  featureName: string;
  importance: number;
  rank: number;
  stdDev?: number;
  min?: number;
  max?: number;
  description?: string;
}

export interface PermutationImportance {
  featureName: string;
  importance: number;
  baselineScore: number;
  decreaseInScore: number;
  stdDev: number;
}

export interface PartialDependence {
  featureName: string;
  featureValues: number[];
  averagePredictions: number[];
  stdDev?: number[];
  iceLines?: number[][];
}

// ============================================================================
// Attention Types
// ============================================================================

export interface AttentionWeights {
  layer: number;
  head: number;
  weights: number[][];
  tokens: string[];
}

export interface AttentionVisualization {
  layer: number;
  head: number;
  tokens: string[];
  weights: number[][];
  heatmap: HeatmapData;
  patterns: AttentionPattern[];
}

export interface AttentionPattern {
  type: 'local' | 'global' | 'diagonal' | 'vertical' | 'other';
  strength: number;
  description: string;
}

export interface AttentionConfig {
  layer?: number;
  head?: number;
  aggregateLayers?: boolean;
  aggregateHeads?: boolean;
  normalization?: 'softmax' | 'layer_norm' | 'none';
}

// ============================================================================
// Counterfactual Types
// ============================================================================

export interface CounterfactualExplanation {
  originalInstance: Record<string, any>;
  counterfactualInstance: Record<string, any>;
  originalPrediction: number | string;
  counterfactualPrediction: number | string;
  changes: CounterfactualChange[];
  distance: number;
  validity: boolean;
  proximity: number;
  plausibility: number;
  actionability: ActionabilityScore;
}

export interface CounterfactualChange {
  featureName: string;
  originalValue: any;
  counterfactualValue: any;
  magnitude: number;
  direction: 'increase' | 'decrease';
  importance: number;
}

export interface ActionabilityScore {
  score: number;
  actionable: boolean;
  cost?: number;
  timeToImplement?: string;
  complexity?: 'low' | 'medium' | 'high';
}

export interface CounterfactualConfig {
  method?: 'genetic' | 'gradient' | 'prototype' | 'growing_spheres';
  numCandidates?: number;
  maxIterations?: number;
  targetClass?: string | number;
  distanceMetric?: 'euclidean' | 'manhattan' | 'mahalanobis';
  constraints?: FeatureConstraints;
}

export interface FeatureConstraints {
  [featureName: string]: {
    min?: number;
    max?: number;
    categorical?: boolean[];
    immutable?: boolean;
  };
}

// ============================================================================
// Model Interpretation Types
// ============================================================================

export interface ModelBehavior {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  decisionBoundary: DecisionBoundary;
  biasAnalysis: BiasAnalysis;
  fairnessMetrics: FairnessMetrics;
}

export interface DecisionBoundary {
  complexity: 'linear' | 'non-linear' | 'highly_non-linear';
  description: string;
  regions: DecisionRegion[];
}

export interface DecisionRegion {
  description: string;
  conditions: string[];
  prediction: string | number;
  confidence: number;
  coverage: number;
}

export interface BiasAnalysis {
  detectedBiases: BiasDetection[];
  overallBiasScore: number;
  recommendations: string[];
}

export interface BiasDetection {
  feature: string;
  biasType: string;
  severity: 'low' | 'medium' | 'high';
  affectedGroups: string[];
  description: string;
}

export interface FairnessMetrics {
  demographicParity?: number;
  equalizedOdds?: number;
  predictiveParity?: number;
  individualFairness?: number;
  overallFairness: number;
}

// ============================================================================
// Data Influence Types
// ============================================================================

export interface DataInfluence {
  trainingInfluence: TrainingInfluence[];
  dataQuality: DataQuality;
  dataDistribution: DataDistribution;
}

export interface TrainingInfluence {
  sampleId: string;
  influence: number;
  misclassified: boolean;
  description: string;
}

export interface DataQuality {
  missingValues: number;
  outliers: number;
  inconsistencies: number;
  overallQuality: 'poor' | 'fair' | 'good' | 'excellent';
}

export interface DataDistribution {
  skewness: number;
  kurtosis: number;
  balance: 'balanced' | 'slightly_imbalanced' | 'imbalanced' | 'highly_imbalanced';
  description: string;
}

// ============================================================================
// Visualization Types
// ============================================================================

export interface VisualizationData {
  type: 'bar' | 'line' | 'heatmap' | 'scatter' | 'waterfall' | 'force';
  data: any;
  options?: any;
  metadata?: Record<string, any>;
}

export interface HeatmapData {
  rows: string[];
  cols: string[];
  values: number[][];
  colorScale?: string;
  annotations?: string[][];
}

export interface WaterfallData {
  base: number;
  features: {
    name: string;
    value: number;
    contribution: number;
  }[];
  final: number;
}

// ============================================================================
// Report Types
// ============================================================================

export interface ExplanationReport {
  id: string;
  timestamp: Date;
  modelId: string;
  modelName: string;
  summary: string;
  localExplanations: LocalExplanation[];
  globalExplanation?: GlobalExplanation;
  visualizations: VisualizationData[];
  recommendations: string[];
  confidence: number;
  completeness: number;
}

export interface ReportConfig {
  format: 'text' | 'html' | 'json' | 'markdown';
  includeVisualizations: boolean;
  detailLevel: 'brief' | 'standard' | 'detailed';
  targetAudience: 'technical' | 'business' | 'both';
  language: string;
}

// ============================================================================
// Natural Language Explanation Types
// ============================================================================

export interface NLExplanation {
  summary: string;
  detailedExplanation: string;
  keyFindings: string[];
  confidence: number;
  recommendations: string[];
  questions: FAQ[];
}

export interface FAQ {
  question: string;
  answer: string;
  relevance: number;
}

export interface ExplanationStyle {
  tone: 'formal' | 'casual' | 'technical';
  length: 'brief' | 'medium' | 'detailed';
  includeTechnicalDetails: boolean;
  includeExamples: boolean;
  includeCaveats: boolean;
}

// ============================================================================
// Evaluation Types
// ============================================================================

export interface ExplanationEvaluation {
  faithfulness: number;
  stability: number;
  comprehensibility: number;
  completeness: number;
  confidence: number;
  overall: number;
  metrics: EvaluationMetric[];
}

export interface EvaluationMetric {
  name: string;
  value: number;
  description: string;
  threshold?: number;
  passed?: boolean;
}

export interface ComparisonResult {
  modelA: string;
  modelB: string;
  metrics: {
    metricName: string;
    modelAValue: number;
    modelBValue: number;
    winner: 'A' | 'B' | 'tie';
  }[];
  overallWinner: 'A' | 'B' | 'tie';
}
