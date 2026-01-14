/**
 * @claudeflare/xai - Explainable AI System
 *
 * Comprehensive XAI (Explainable AI) system for ClaudeFlare providing
 * model interpretability, feature attribution, and explanation generation.
 *
 * @module @claudeflare/xai
 *
 * @example
 * ```typescript
 * import { KernelSHAP, TabularLIME, AttentionVisualizer } from '@claudeflare/xai';
 *
 * // SHAP explanation
 * const shap = new KernelSHAP(metadata, { backgroundSize: 100 });
 * const shapExplanation = await shap.explain(instance, predictFn);
 *
 * // LIME explanation
 * const lime = new TabularLIME(metadata, { numSamples: 5000 });
 * const limeExplanation = await lime.explain(instance, predictFn);
 *
 * // Attention visualization
 * const visualizer = new AttentionVisualizer({ layer: 0, head: 0 });
 * const attention = await visualizer.visualize(attentionWeights, tokens);
 * ```
 */

// ============================================================================
// SHAP Exports
// ============================================================================

export {
  KernelSHAP,
  SHAPSampler,
} from './shap';

export type {
  SHAPValues,
  SHAPExplanation,
  SHAPInteractionValues,
  SHAPConfig,
} from './types';

// ============================================================================
// LIME Exports
// ============================================================================

export {
  TabularLIME,
  LIMEKernel,
} from './lime';

export type {
  LIMEExplanation,
  LIMEConfig,
  LocalModelExplanation,
} from './types';

// ============================================================================
// Attention Exports
// ============================================================================

export {
  AttentionVisualizer,
} from './attention';

export type {
  AttentionConfig,
  AttentionWeights,
  AttentionMetrics,
  AttentionAnalysis,
  AttentionFlow,
  RolloutAttention,
  AttentionGraph,
} from './types';

// ============================================================================
// Counterfactual Exports
// ============================================================================

export {
  CounterfactualGenerator,
} from './counterfactual';

export type {
  CounterfactualExplanation,
  CounterfactualConfig,
  CounterfactualChange,
  ActionabilityScore,
  FeatureConstraints,
} from './types';

// ============================================================================
// Interpretation Exports
// ============================================================================

export {
  ModelInterpreter,
} from './interpretation';

export type {
  InterpretationOptions,
  ModelInterpretation,
} from './interpretation';

// ============================================================================
// Reporting Exports
// ============================================================================

export {
  ExplanationReporter,
} from './reporting';

export type {
  ExplanationReport,
  ReportConfig,
  NLExplanation,
  ExplanationStyle,
} from './types';

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Base types
  BaseExplanation,
  FeatureExplanation,
  LocalExplanation,
  GlobalExplanation,

  // Feature importance types
  FeatureImportance,
  PermutationImportance,
  PartialDependence,

  // Model behavior types
  ModelBehavior,
  DecisionBoundary,
  BiasAnalysis,
  FairnessMetrics,
  BiasDetection,

  // Visualization types
  VisualizationData,
  HeatmapData,
  WaterfallData,

  // Evaluation types
  ExplanationEvaluation,
  EvaluationMetric,

  // Model types
  ModelType,
  PredictionType,
  ModelInfo,
  ModelMetadata,
  FeatureType,
  PerformanceMetrics,
  Prediction,
  PredictiveModel,
  ExplainedModel,
} from './types';

// ============================================================================
// Utility Exports
// ============================================================================

export {
  // Math utilities
  mean,
  median,
  stdDev,
  variance,
  min,
  max,
  sum,
  product,
  normalize,
  normalizeMinMax,
  normalizeZScore,
  normalizeL2,
  normalizeL1,
  softmax,
  sigmoid,
  relu,
  euclideanDistance,
  manhattanDistance,
  cosineSimilarity,
  cosineDistance,
  minkowskiDistance,
  chebyshevDistance,
  mahalanobisDistance,
  multiplyMatrices,
  multiplyMatrixVector,
  transposeMatrix,
  invertMatrix,
  determinant,
  percentile,
  quantile,
  iqr,
  skewness,
  kurtosis,
  correlation,
  covariance,
  sample,
  shuffle,
  bootstrap,
  klDivergence,
  jsDivergence,
  entropy,
  crossEntropy,
} from './utils';

export {
  // Validation utilities
  validateFeatureNames,
  validateInstance,
  validateInstances,
  validatePrediction,
  validateProbabilities,
  validateMatrix,
  validateAttentionWeights,
  validateModelInterface,
  validateModelMetadata,
  validateExplanation,
  validateFeatureImportance,
  validateSHAPValues,
  validateCounterfactual,
  validatePerformanceMetrics,
  validatePercentage,
  validatePositiveInteger,
  validateNonNegativeInteger,
  validateArray,
  buildDefaultSHAPConfig,
  buildDefaultLIMEConfig,
  buildDefaultAttentionConfig,
  buildDefaultCounterfactualConfig,
  buildDefaultReportConfig,
} from './utils';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '1.0.0';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration values for XAI methods
 */
export const DEFAULT_CONFIG = {
  shap: {
    method: 'kernel' as const,
    backgroundSize: 100,
    maxSamples: 1000,
    algorithm: 'auto' as const,
    outputPrecision: 4,
  },
  lime: {
    numSamples: 5000,
    kernelWidth: 0.75,
    mode: 'classification' as const,
    featureSelection: 'auto' as const,
    discretizeContinuous: false,
  },
  attention: {
    layer: -1,
    head: 0,
    aggregateLayers: false,
    aggregateHeads: false,
    normalization: 'softmax' as const,
  },
  counterfactual: {
    method: 'genetic' as const,
    numCandidates: 10,
    maxIterations: 1000,
    targetClass: undefined,
    distanceMetric: 'euclidean' as const,
  },
  report: {
    format: 'html' as const,
    includeVisualizations: true,
    detailLevel: 'standard' as const,
    targetAudience: 'both' as const,
    language: 'en',
  },
} as const;

/**
 * Supported XAI methods
 */
export const XAI_METHODS = {
  SHAP: 'shap',
  LIME: 'lime',
  ATTENTION: 'attention',
  COUNTERFACTUAL: 'counterfactual',
  INTERPRETATION: 'interpretation',
} as const;

/**
 * Explanation types
 */
export const EXPLANATION_TYPES = {
  LOCAL: 'local',
  GLOBAL: 'global',
  BOTH: 'both',
} as const;

/**
 * Visualization formats
 */
export const VISUALIZATION_FORMATS = {
  HTML: 'html',
  JSON: 'json',
  MARKDOWN: 'markdown',
  TEXT: 'text',
} as const;
