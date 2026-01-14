/**
 * Validation utilities for XAI
 */

import { z } from 'zod';

// ============================================================================
// Input Validation Schemas
// ============================================================================

export const SHAPConfigSchema = z.object({
  method: z.enum(['kernel', 'tree', 'deep', 'sampling']),
  backgroundSize: z.number().int().positive().optional().default(100),
  maxSamples: z.number().int().positive().optional().default(1000),
  algorithm: z.enum(['auto', 'exact', 'approximate']).optional().default('auto'),
  outputPrecision: z.number().int().min(1).max(10).optional().default(4),
});

export const LIMEConfigSchema = z.object({
  numSamples: z.number().int().positive().optional().default(5000),
  kernelWidth: z.number().positive().optional().default(0.75),
  mode: z.enum(['classification', 'regression']).optional().default('classification'),
  featureSelection: z.enum(['auto', 'none', 'forward_selection', 'highest_weights']).optional().default('auto'),
  discretizeContinuous: z.boolean().optional().default(false),
});

export const AttentionConfigSchema = z.object({
  layer: z.number().int().nonnegative().optional(),
  head: z.number().int().nonnegative().optional(),
  aggregateLayers: z.boolean().optional().default(false),
  aggregateHeads: z.boolean().optional().default(false),
  normalization: z.enum(['softmax', 'layer_norm', 'none']).optional().default('softmax'),
});

export const CounterfactualConfigSchema = z.object({
  method: z.enum(['genetic', 'gradient', 'prototype', 'growing_spheres']).optional().default('genetic'),
  numCandidates: z.number().int().positive().optional().default(10),
  maxIterations: z.number().int().positive().optional().default(1000),
  targetClass: z.union([z.string(), z.number()]).optional(),
  distanceMetric: z.enum(['euclidean', 'manhattan', 'mahalanobis']).optional().default('euclidean'),
  constraints: z.record(z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    categorical: z.array(z.boolean()).optional(),
    immutable: z.boolean().optional(),
  })).optional(),
});

export const ReportConfigSchema = z.object({
  format: z.enum(['text', 'html', 'json', 'markdown']).optional().default('html'),
  includeVisualizations: z.boolean().optional().default(true),
  detailLevel: z.enum(['brief', 'standard', 'detailed']).optional().default('standard'),
  targetAudience: z.enum(['technical', 'business', 'both']).optional().default('both'),
  language: z.string().optional().default('en'),
});

// ============================================================================
// Data Validation Functions
// ============================================================================

export function validateFeatureNames(names: string[]): void {
  if (!Array.isArray(names)) {
    throw new Error('Feature names must be an array');
  }

  if (names.length === 0) {
    throw new Error('Feature names cannot be empty');
  }

  const uniqueNames = new Set(names);
  if (uniqueNames.size !== names.length) {
    throw new Error('Feature names must be unique');
  }

  for (const name of names) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new Error(`Invalid feature name: ${name}`);
    }
  }
}

export function validateInstance(instance: Record<string, any>, featureNames: string[]): void {
  if (!instance || typeof instance !== 'object') {
    throw new Error('Instance must be an object');
  }

  const missingFeatures = featureNames.filter(name => !(name in instance));
  if (missingFeatures.length > 0) {
    throw new Error(`Missing features: ${missingFeatures.join(', ')}`);
  }

  for (const name of featureNames) {
    const value = instance[name];
    if (value === null || value === undefined) {
      throw new Error(`Feature ${name} has null or undefined value`);
    }
  }
}

export function validateInstances(instances: Record<string, any>[], featureNames: string[]): void {
  if (!Array.isArray(instances)) {
    throw new Error('Instances must be an array');
  }

  if (instances.length === 0) {
    throw new Error('Instances cannot be empty');
  }

  for (let i = 0; i < instances.length; i++) {
    try {
      validateInstance(instances[i], featureNames);
    } catch (error) {
      throw new Error(`Instance ${i}: ${error.message}`);
    }
  }
}

export function validatePrediction(prediction: any): void {
  if (prediction === null || prediction === undefined) {
    throw new Error('Prediction cannot be null or undefined');
  }

  const isValid =
    typeof prediction === 'number' ||
    typeof prediction === 'string' ||
    Array.isArray(prediction);

  if (!isValid) {
    throw new Error('Prediction must be a number, string, or array');
  }
}

export function validateProbabilities(probabilities: number[]): void {
  if (!Array.isArray(probabilities)) {
    throw new Error('Probabilities must be an array');
  }

  if (probabilities.length === 0) {
    throw new Error('Probabilities cannot be empty');
  }

  for (const prob of probabilities) {
    if (typeof prob !== 'number' || prob < 0 || prob > 1) {
      throw new Error('Probabilities must be numbers between 0 and 1');
    }
  }

  const sum = probabilities.reduce((s, p) => s + p, 0);
  if (Math.abs(sum - 1) > 0.01) {
    throw new Error('Probabilities must sum to 1');
  }
}

export function validateMatrix(matrix: number[][], name: string = 'Matrix'): void {
  if (!Array.isArray(matrix) || matrix.length === 0) {
    throw new Error(`${name} must be a non-empty array`);
  }

  const cols = matrix[0].length;
  for (let i = 0; i < matrix.length; i++) {
    if (!Array.isArray(matrix[i])) {
      throw new Error(`${name} row ${i} is not an array`);
    }

    if (matrix[i].length !== cols) {
      throw new Error(`${name} has inconsistent row lengths`);
    }

    for (let j = 0; j < matrix[i].length; j++) {
      if (typeof matrix[i][j] !== 'number' || !isFinite(matrix[i][j])) {
        throw new Error(`${name}[${i}][${j}] is not a valid number`);
      }
    }
  }
}

export function validateAttentionWeights(
  weights: number[][][],
  numLayers: number,
  numHeads: number
): void {
  if (!Array.isArray(weights) || weights.length !== numLayers) {
    throw new Error(`Weights must have ${numLayers} layers`);
  }

  for (let l = 0; l < weights.length; l++) {
    if (!Array.isArray(weights[l]) || weights[l].length !== numHeads) {
      throw new Error(`Layer ${l} must have ${numHeads} heads`);
    }

    for (let h = 0; h < weights[l].length; h++) {
      validateMatrix(weights[l][h], `Attention weights layer ${l} head ${h}`);
    }
  }
}

// ============================================================================
// Model Validation Functions
// ============================================================================

export function validateModelInterface(model: any): void {
  if (!model || typeof model !== 'object') {
    throw new Error('Model must be an object');
  }

  if (typeof model.predict !== 'function') {
    throw new Error('Model must have a predict method');
  }

  if (typeof model.getMetadata !== 'function') {
    throw new Error('Model must have a getMetadata method');
  }
}

export function validateModelMetadata(metadata: any): void {
  if (!metadata || typeof metadata !== 'object') {
    throw new Error('Metadata must be an object');
  }

  if (!metadata.modelInfo || typeof metadata.modelInfo !== 'object') {
    throw new Error('Metadata must contain modelInfo');
  }

  const { modelInfo } = metadata;

  if (!modelInfo.type || typeof modelInfo.type !== 'string') {
    throw new Error('ModelInfo must have a type');
  }

  if (!modelInfo.inputShape || !Array.isArray(modelInfo.inputShape)) {
    throw new Error('ModelInfo must have inputShape');
  }

  if (!modelInfo.outputShape || !Array.isArray(modelInfo.outputShape)) {
    throw new Error('ModelInfo must have outputShape');
  }

  if (!Array.isArray(metadata.featureNames) || metadata.featureNames.length === 0) {
    throw new Error('Metadata must have featureNames');
  }

  if (!Array.isArray(metadata.featureTypes)) {
    throw new Error('Metadata must have featureTypes');
  }
}

// ============================================================================
// Explanation Validation Functions
// ============================================================================

export function validateExplanation(explanation: any): void {
  if (!explanation || typeof explanation !== 'object') {
    throw new Error('Explanation must be an object');
  }

  if (!explanation.id || typeof explanation.id !== 'string') {
    throw new Error('Explanation must have an id');
  }

  if (!explanation.timestamp || !(explanation.timestamp instanceof Date)) {
    throw new Error('Explanation must have a timestamp');
  }

  if (!explanation.modelId || typeof explanation.modelId !== 'string') {
    throw new Error('Explanation must have a modelId');
  }

  if (explanation.prediction === null || explanation.prediction === undefined) {
    throw new Error('Explanation must have a prediction');
  }

  if (typeof explanation.confidence !== 'number' || explanation.confidence < 0 || explanation.confidence > 1) {
    throw new Error('Explanation confidence must be a number between 0 and 1');
  }
}

export function validateFeatureImportance(importance: Record<string, number>): void {
  if (!importance || typeof importance !== 'object') {
    throw new Error('Feature importance must be an object');
  }

  const features = Object.keys(importance);
  if (features.length === 0) {
    throw new Error('Feature importance cannot be empty');
  }

  for (const [feature, value] of Object.entries(importance)) {
    if (typeof feature !== 'string' || feature.trim().length === 0) {
      throw new Error('Feature names must be non-empty strings');
    }

    if (typeof value !== 'number' || !isFinite(value)) {
      throw new Error(`Importance value for ${feature} must be a number`);
    }
  }
}

export function validateSHAPValues(shapValues: any): void {
  if (!shapValues || typeof shapValues !== 'object') {
    throw new Error('SHAP values must be an object');
  }

  if (!Array.isArray(shapValues.values)) {
    throw new Error('SHAP values must have a values array');
  }

  if (typeof shapValues.baseValue !== 'number') {
    throw new Error('SHAP values must have a baseValue');
  }

  if (!Array.isArray(shapValues.featureNames)) {
    throw new Error('SHAP values must have featureNames');
  }

  if (shapValues.values.length !== shapValues.featureNames.length) {
    throw new Error('SHAP values length must match featureNames length');
  }
}

// ============================================================================
// Counterfactual Validation Functions
// ============================================================================

export function validateCounterfactual(counterfactual: any): void {
  if (!counterfactual || typeof counterfactual !== 'object') {
    throw new Error('Counterfactual must be an object');
  }

  if (!counterfactual.originalInstance || typeof counterfactual.originalInstance !== 'object') {
    throw new Error('Counterfactual must have originalInstance');
  }

  if (!counterfactual.counterfactualInstance || typeof counterfactual.counterfactualInstance !== 'object') {
    throw new Error('Counterfactual must have counterfactualInstance');
  }

  if (!Array.isArray(counterfactual.changes)) {
    throw new Error('Counterfactual must have changes array');
  }

  if (typeof counterfactual.distance !== 'number' || counterfactual.distance < 0) {
    throw new Error('Counterfactual distance must be a non-negative number');
  }

  if (typeof counterfactual.validity !== 'boolean') {
    throw new Error('Counterfactual must have validity flag');
  }

  if (typeof counterfactual.proximity !== 'number' || counterfactual.proximity < 0 || counterfactual.proximity > 1) {
    throw new Error('Counterfactual proximity must be between 0 and 1');
  }

  if (typeof counterfactual.plausibility !== 'number' || counterfactual.plausibility < 0 || counterfactual.plausibility > 1) {
    throw new Error('Counterfactual plausibility must be between 0 and 1');
  }
}

// ============================================================================
// Performance Validation Functions
// ============================================================================

export function validatePerformanceMetrics(metrics: any): void {
  if (!metrics || typeof metrics !== 'object') {
    throw new Error('Performance metrics must be an object');
  }

  const validMetrics = [
    'accuracy', 'precision', 'recall', 'f1Score', 'auc',
    'mse', 'mae', 'r2Score', 'logLoss'
  ];

  for (const [key, value] of Object.entries(metrics)) {
    if (!validMetrics.includes(key)) {
      throw new Error(`Unknown metric: ${key}`);
    }

    if (typeof value !== 'number' || !isFinite(value)) {
      throw new Error(`Metric ${key} must be a number`);
    }

    if (value < 0 || value > 1) {
      throw new Error(`Metric ${key} must be between 0 and 1`);
    }
  }
}

// ============================================================================
// Utility Validation Functions
// ============================================================================

export function validatePercentage(value: number, name: string = 'Value'): void {
  if (typeof value !== 'number') {
    throw new Error(`${name} must be a number`);
  }

  if (value < 0 || value > 1) {
    throw new Error(`${name} must be between 0 and 1`);
  }
}

export function validatePositiveInteger(value: number, name: string = 'Value'): void {
  if (typeof value !== 'number') {
    throw new Error(`${name} must be a number`);
  }

  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer`);
  }

  if (value <= 0) {
    throw new Error(`${name} must be positive`);
  }
}

export function validateNonNegativeInteger(value: number, name: string = 'Value'): void {
  if (typeof value !== 'number') {
    throw new Error(`${name} must be a number`);
  }

  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer`);
  }

  if (value < 0) {
    throw new Error(`${name} must be non-negative`);
  }
}

export function validateArray<T>(value: T, name: string = 'Value', minLength: number = 0): void {
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array`);
  }

  if (value.length < minLength) {
    throw new Error(`${name} must have at least ${minLength} elements`);
  }
}

// ============================================================================
// Configuration Builders
// ============================================================================

export function buildDefaultSHAPConfig() {
  return SHAPConfigSchema.parse({});
}

export function buildDefaultLIMEConfig() {
  return LIMEConfigSchema.parse({});
}

export function buildDefaultAttentionConfig() {
  return AttentionConfigSchema.parse({});
}

export function buildDefaultCounterfactualConfig() {
  return CounterfactualConfigSchema.parse({});
}

export function buildDefaultReportConfig() {
  return ReportConfigSchema.parse({});
}
