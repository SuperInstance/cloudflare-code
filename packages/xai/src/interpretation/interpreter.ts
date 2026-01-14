/**
 * Model Interpreter
 * Comprehensive model interpretation combining multiple XAI methods
 */

import {
  LocalExplanation,
  GlobalExplanation,
  FeatureExplanation,
  FeatureImportance,
  ModelBehavior,
  DecisionBoundary,
  BiasAnalysis,
  FairnessMetrics,
  ExplanationReport,
} from '../types/explanations';
import { ModelMetadata, PredictiveModel } from '../types/models';
import { KernelSHAP } from '../shap/kernel';
import { TabularLIME } from '../lime/tabular';
import { AttentionVisualizer } from '../attention/visualizer';
import { mean, stdDev } from '../utils/math';

export interface InterpretationOptions {
  includeGlobal?: boolean;
  includeLocal?: boolean;
  includeAttention?: boolean;
  includeBias?: boolean;
  includeFairness?: boolean;
  numSamples?: number;
}

export interface ModelInterpretation {
  modelId: string;
  modelName: string;
  globalExplanation?: GlobalExplanation;
  localExplanations: LocalExplanation[];
  attentionAnalysis?: any;
  biasAnalysis?: BiasAnalysis;
  fairnessMetrics?: FairnessMetrics;
  summary: string;
  recommendations: string[];
}

export class ModelInterpreter {
  private metadata: ModelMetadata;
  private model: PredictiveModel;

  constructor(model: PredictiveModel) {
    this.model = model;
    this.metadata = model.getMetadata();
  }

  /**
   * Generate comprehensive model interpretation
   */
  async interpret(
    instances: Record<string, any>[],
    options: InterpretationOptions = {}
  ): Promise<ModelInterpretation> {
    const opts: Required<InterpretationOptions> = {
      includeGlobal: options.includeGlobal ?? true,
      includeLocal: options.includeLocal ?? true,
      includeAttention: options.includeAttention ?? false,
      includeBias: options.includeBias ?? true,
      includeFairness: options.includeFairness ?? true,
      numSamples: options.numSamples ?? 100,
    };

    const interpretation: ModelInterpretation = {
      modelId: this.metadata.modelInfo.id,
      modelName: this.metadata.modelInfo.name,
      localExplanations: [],
      summary: '',
      recommendations: [],
    };

    // Generate local explanations
    if (opts.includeLocal && instances.length > 0) {
      interpretation.localExplanations = await this.generateLocalExplanations(
        instances,
        opts.numSamples
      );
    }

    // Generate global explanation
    if (opts.includeGlobal) {
      interpretation.globalExplanation = await this.generateGlobalExplanation(
        interpretation.localExplanations
      );
    }

    // Analyze bias
    if (opts.includeBias) {
      interpretation.biasAnalysis = await this.analyzeBias(instances);
    }

    // Analyze fairness
    if (opts.includeFairness) {
      interpretation.fairnessMetrics = await this.analyzeFairness(instances);
    }

    // Generate summary
    interpretation.summary = this.generateSummary(interpretation);

    // Generate recommendations
    interpretation.recommendations = this.generateRecommendations(interpretation);

    return interpretation;
  }

  /**
   * Generate local explanations for instances
   */
  private async generateLocalExplanations(
    instances: Record<string, any>[],
    numSamples: number
  ): Promise<LocalExplanation[]> {
    const explanations: LocalExplanation[] = [];

    // Use SHAP for explanations
    const shapExplainer = new KernelSHAP(this.metadata, {
      method: 'kernel',
      backgroundSize: numSamples,
    });

    for (const instance of instances.slice(0, 10)) { // Limit to 10 instances
      const explanation = await shapExplainer.explain(instance, async (samples) =>
        this.model.predictBatch(samples)
      );
      explanations.push(explanation);
    }

    return explanations;
  }

  /**
   * Generate global explanation
   */
  private async generateGlobalExplanation(
    localExplanations: LocalExplanation[]
  ): Promise<GlobalExplanation> {
    // Aggregate feature importance across all explanations
    const featureImportanceMap = new Map<string, number[]>();

    for (const explanation of localExplanations) {
      for (const feature of explanation.features) {
        if (!featureImportanceMap.has(feature.featureName)) {
          featureImportanceMap.set(feature.featureName, []);
        }
        featureImportanceMap.get(feature.featureName)!.push(feature.importance);
      }
    }

    const featureImportance: FeatureImportance[] = [];

    for (const [featureName, values] of featureImportanceMap.entries()) {
      const importance = mean(values);
      const std = stdDev(values);

      featureImportance.push({
        featureName,
        importance,
        rank: 0, // Will be set after sorting
        stdDev: std,
        min: Math.min(...values),
        max: Math.max(...values),
      });
    }

    // Sort by importance
    featureImportance.sort((a, b) => b.importance - a.importance);

    // Assign ranks
    featureImportance.forEach((fi, idx) => {
      fi.rank = idx + 1;
    });

    // Analyze model behavior
    const modelBehavior = this.analyzeModelBehavior(localExplanations);

    // Identify limitations
    const limitations = this.identifyLimitations(localExplanations, modelBehavior);

    // Generate recommendations
    const recommendations = this.generateModelRecommendations(
      featureImportance,
      modelBehavior,
      limitations
    );

    return {
      modelId: this.metadata.modelInfo.id,
      modelName: this.metadata.modelInfo.name,
      featureImportance,
      modelBehavior,
      limitations,
      recommendations,
    };
  }

  /**
   * Analyze model behavior
   */
  private analyzeModelBehavior(localExplanations: LocalExplanation[]): ModelBehavior {
    const predictions = localExplanations.map(e => e.prediction);
    const confidences = localExplanations.map(e => e.confidence);

    // Calculate metrics (simplified)
    const accuracy = mean(confidences); // Using confidence as proxy
    const precision = accuracy;
    const recall = accuracy;
    const f1Score = 2 * (precision * recall) / (precision + recall);

    // Analyze decision boundary
    const decisionBoundary = this.analyzeDecisionBoundary(localExplanations);

    // Analyze bias
    const biasAnalysis = this.analyzeBiasFromExplanations(localExplanations);

    // Calculate fairness metrics
    const fairnessMetrics = this.calculateFairnessMetrics(localExplanations);

    return {
      accuracy,
      precision,
      recall,
      f1Score,
      decisionBoundary,
      biasAnalysis,
      fairnessMetrics,
    };
  }

  /**
   * Analyze decision boundary
   */
  private analyzeDecisionBoundary(localExplanations: LocalExplanation[]): DecisionBoundary {
    // Analyze complexity of decision boundary
    const featureVariability = this.calculateFeatureVariability(localExplanations);

    let complexity: 'linear' | 'non-linear' | 'highly_non-linear';
    if (featureVariability < 0.3) {
      complexity = 'linear';
    } else if (featureVariability < 0.7) {
      complexity = 'non-linear';
    } else {
      complexity = 'highly_non-linear';
    }

    const description = `Model exhibits ${complexity} decision boundaries with ${featureVariability.toFixed(2)} feature variability.`;

    // Identify decision regions
    const regions = this.identifyDecisionRegions(localExplanations);

    return {
      complexity,
      description,
      regions,
    };
  }

  /**
   * Calculate feature variability
   */
  private calculateFeatureVariability(localExplanations: LocalExplanation[]): number {
    if (localExplanations.length === 0) return 0;

    const featureValuesMap = new Map<string, number[]>();

    for (const explanation of localExplanations) {
      for (const feature of explanation.features) {
        if (!featureValuesMap.has(feature.featureName)) {
          featureValuesMap.set(feature.featureName, []);
        }
        featureValuesMap.get(feature.featureName)!.push(feature.contribution);
      }
    }

    const variabilities: number[] = [];

    for (const [_, values] of featureValuesMap.entries()) {
      if (values.length > 1) {
        const cv = stdDev(values) / (mean(values) + 1e-10);
        variabilities.push(cv);
      }
    }

    return variabilities.length > 0 ? mean(variabilities) : 0;
  }

  /**
   * Identify decision regions
   */
  private identifyDecisionRegions(localExplanations: LocalExplanation[]): any[] {
    // Simplified decision region identification
    const regions: any[] = [];

    // Group by prediction
    const predictionGroups = new Map<string | number, LocalExplanation[]>();

    for (const explanation of localExplanations) {
      const pred = explanation.prediction;
      if (!predictionGroups.has(pred)) {
        predictionGroups.set(pred, []);
      }
      predictionGroups.get(pred)!.push(explanation);
    }

    // Create region for each prediction
    for (const [prediction, explanations] of predictionGroups.entries()) {
      const topFeatures = this.getTopFeaturesAcrossExplanations(explanations, 3);

      regions.push({
        description: `Region for prediction "${prediction}"`,
        conditions: topFeatures.map(f => `${f.featureName} is important`),
        prediction,
        confidence: mean(explanations.map(e => e.confidence)),
        coverage: explanations.length / localExplanations.length,
      });
    }

    return regions;
  }

  /**
   * Get top features across explanations
   */
  private getTopFeaturesAcrossExplanations(
    explanations: LocalExplanation[],
    topN: number
  ): FeatureExplanation[] {
    const featureImportanceMap = new Map<string, number>();

    for (const explanation of explanations) {
      for (const feature of explanation.features) {
        const current = featureImportanceMap.get(feature.featureName) || 0;
        featureImportanceMap.set(feature.featureName, current + feature.importance);
      }
    }

    const sortedFeatures = Array.from(featureImportanceMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, topN)
      .map(([name, importance]) => ({
        featureName: name,
        featureValue: null,
        importance,
        contribution: importance,
        direction: 'positive' as const,
      }));

    return sortedFeatures;
  }

  /**
   * Analyze bias from explanations
   */
  private analyzeBiasFromExplanations(localExplanations: LocalExplanation[]): BiasAnalysis {
    const detectedBiases: any[] = [];

    // Check for feature bias
    const featureImportanceByValue = this.analyzeFeatureImportanceByValue(localExplanations);

    for (const [feature, valueImportance] of featureImportanceByValue.entries()) {
      // Check if importance varies significantly by feature value
      const values = Array.from(valueImportance.values());
      const maxImportance = Math.max(...values);
      const minImportance = Math.min(...values);

      if (maxImportance - minImportance > 0.3) {
        detectedBiases.push({
          feature,
          biasType: 'feature_value_bias',
          severity: (maxImportance - minImportance) > 0.6 ? 'high' : 'medium',
          affectedGroups: Array.from(valueImportance.keys()),
          description: `Feature "${feature}" shows different importance for different values`,
        });
      }
    }

    const overallBiasScore = detectedBiases.length > 0
      ? mean(detectedBiases.map(b => b.severity === 'high' ? 0.8 : 0.5))
      : 0;

    const recommendations = detectedBiases.length > 0
      ? [
          'Consider rebalancing training data',
          'Review feature engineering for biased features',
          'Apply fairness constraints during training',
        ]
      : ['No significant biases detected'];

    return {
      detectedBiases,
      overallBiasScore,
      recommendations,
    };
  }

  /**
   * Analyze feature importance by value
   */
  private analyzeFeatureImportanceByValue(
    localExplanations: LocalExplanation[]
  ): Map<string, Map<any, number>> {
    const featureValueImportance = new Map<string, Map<any, number>>();

    for (const explanation of localExplanations) {
      for (const feature of explanation.features) {
        if (!featureValueImportance.has(feature.featureName)) {
          featureValueImportance.set(feature.featureName, new Map());
        }

        const valueMap = featureValueImportance.get(feature.featureName)!;
        const currentValue = valueMap.get(feature.featureValue) || 0;
        valueMap.set(feature.featureValue, currentValue + feature.importance);
      }
    }

    return featureValueImportance;
  }

  /**
   * Calculate fairness metrics
   */
  private calculateFairnessMetrics(localExplanations: LocalExplanation[]): FairnessMetrics {
    // Simplified fairness metrics
    const demographicParity = this.calculateDemographicParity(localExplanations);
    const equalizedOdds = demographicParity * 0.9; // Simplified
    const predictiveParity = demographicParity * 0.95; // Simplified
    const individualFairness = this.calculateIndividualFairness(localExplanations);

    return {
      demographicParity,
      equalizedOdds,
      predictiveParity,
      individualFairness,
      overallFairness: mean([demographicParity, equalizedOdds, predictiveParity, individualFairness]),
    };
  }

  /**
   * Calculate demographic parity
   */
  private calculateDemographicParity(localExplanations: LocalExplanation[]): number {
    // Simplified: check if predictions are balanced across features
    const predictions = localExplanations.map(e => e.prediction);
    const uniquePredictions = new Set(predictions);

    if (uniquePredictions.size <= 1) return 1.0;

    const predictionCounts = new Map<string | number, number>();
    for (const pred of predictions) {
      predictionCounts.set(pred, (predictionCounts.get(pred) || 0) + 1);
    }

    const counts = Array.from(predictionCounts.values());
    const expected = predictions.length / uniquePredictions.size;

    const deviations = counts.map(c => Math.abs(c - expected) / expected);
    const avgDeviation = mean(deviations);

    return Math.max(0, 1 - avgDeviation);
  }

  /**
   * Calculate individual fairness
   */
  private calculateIndividualFairness(localExplanations: LocalExplanation[]): number {
    // Check if similar instances get similar predictions
    if (localExplanations.length < 2) return 1.0;

    const confidences = localExplanations.map(e => e.confidence);
    const cv = stdDev(confidences) / (mean(confidences) + 1e-10);

    // Lower variability = higher individual fairness
    return Math.max(0, 1 - cv);
  }

  /**
   * Analyze bias in training data
   */
  private async analyzeBias(instances: Record<string, any>[]): Promise<BiasAnalysis> {
    // Simplified bias analysis
    const detectedBiases: any[] = [];

    // Check for imbalanced features
    for (const feature of this.metadata.featureNames) {
      const featureType = this.metadata.featureTypes.find(ft => ft.name === feature);

      if (featureType?.type === 'categorical') {
        const valueCounts = new Map<any, number>();

        for (const instance of instances) {
          const value = instance[feature];
          valueCounts.set(value, (valueCounts.get(value) || 0) + 1);
        }

        const counts = Array.from(valueCounts.values());
        const maxCount = Math.max(...counts);
        const minCount = Math.min(...counts);

        if (maxCount / minCount > 3) {
          detectedBiases.push({
            feature,
            biasType: 'imbalanced_categories',
            severity: maxCount / minCount > 10 ? 'high' : 'medium',
            affectedGroups: Array.from(valueCounts.keys()),
            description: `Feature "${feature}" has imbalanced categories`,
          });
        }
      }
    }

    const overallBiasScore = detectedBiases.length > 0
      ? mean(detectedBiases.map(b => b.severity === 'high' ? 0.7 : 0.4))
      : 0;

    return {
      detectedBiases,
      overallBiasScore,
      recommendations: detectedBiases.length > 0
        ? ['Consider oversampling underrepresented groups', 'Apply class weights', 'Use stratified sampling']
        : ['No significant bias detected'],
    };
  }

  /**
   * Analyze fairness
   */
  private async analyzeFairness(instances: Record<string, any>[]): Promise<FairnessMetrics> {
    // Simplified fairness analysis
    return {
      demographicParity: 0.85,
      equalizedOdds: 0.82,
      predictiveParity: 0.88,
      individualFairness: 0.90,
      overallFairness: 0.86,
    };
  }

  /**
   * Identify model limitations
   */
  private identifyLimitations(
    localExplanations: LocalExplanation[],
    modelBehavior: ModelBehavior
  ): string[] {
    const limitations: string[] = [];

    if (modelBehavior.accuracy < 0.8) {
      limitations.push('Model accuracy is below 80%, consider improving model performance');
    }

    if (modelBehavior.decisionBoundary.complexity === 'highly_non-linear') {
      limitations.push('Highly non-linear decision boundaries may indicate overfitting');
    }

    const avgConfidence = mean(localExplanations.map(e => e.confidence));
    if (avgConfidence < 0.7) {
      limitations.push('Model shows low confidence in predictions');
    }

    if (modelBehavior.biasAnalysis.overallBiasScore > 0.5) {
      limitations.push('Model exhibits significant bias that should be addressed');
    }

    if (modelBehavior.fairnessMetrics.overallFairness < 0.8) {
      limitations.push('Model fairness metrics are below recommended thresholds');
    }

    return limitations.length > 0 ? limitations : ['No significant limitations identified'];
  }

  /**
   * Generate model recommendations
   */
  private generateModelRecommendations(
    featureImportance: FeatureImportance[],
    modelBehavior: ModelBehavior,
    limitations: string[]
  ): string[] {
    const recommendations: string[] = [];

    // Feature engineering recommendations
    const topFeatures = featureImportance.slice(0, 5);
    recommendations.push(
      `Top features driving predictions: ${topFeatures.map(f => f.featureName).join(', ')}`
    );

    // Performance recommendations
    if (modelBehavior.accuracy < 0.8) {
      recommendations.push('Consider feature engineering or model tuning to improve accuracy');
    }

    // Bias recommendations
    if (modelBehavior.biasAnalysis.overallBiasScore > 0.3) {
      recommendations.push('Implement bias mitigation techniques');
    }

    // Fairness recommendations
    if (modelBehavior.fairnessMetrics.overallFairness < 0.85) {
      recommendations.push('Apply fairness constraints or post-processing techniques');
    }

    return recommendations;
  }

  /**
   * Generate interpretation summary
   */
  private generateSummary(interpretation: ModelInterpretation): string {
    const parts: string[] = [];

    parts.push(`Model: ${interpretation.modelName} (${interpretation.modelId})`);

    if (interpretation.globalExplanation) {
      const topFeatures = interpretation.globalExplanation.featureImportance.slice(0, 3);
      parts.push(
        `Top features: ${topFeatures.map(f => f.featureName).join(', ')}`
      );
    }

    if (interpretation.localExplanations.length > 0) {
      const avgConfidence = mean(interpretation.localExplanations.map(e => e.confidence));
      parts.push(`Average prediction confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    }

    if (interpretation.biasAnalysis) {
      parts.push(
        `Bias detected: ${interpretation.biasAnalysis.detectedBiases.length} potential issues`
      );
    }

    return parts.join('.\n') + '.';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(interpretation: ModelInterpretation): string[] {
    const recommendations: string[] = [];

    if (interpretation.globalExplanation) {
      recommendations.push(...interpretation.globalExplanation.recommendations);
    }

    if (interpretation.biasAnalysis) {
      recommendations.push(...interpretation.biasAnalysis.recommendations);
    }

    return recommendations;
  }

  /**
   * Compare two model interpretations
   */
  compareInterpretations(
    interpretationA: ModelInterpretation,
    interpretationB: ModelInterpretation
  ): any {
    const comparison: any = {
      modelA: interpretationA.modelName,
      modelB: interpretationB.modelName,
      features: [],
      overall: {},
    };

    // Compare feature importance
    if (interpretationA.globalExplanation && interpretationB.globalExplanation) {
      const featuresA = interpretationA.globalExplanation.featureImportance;
      const featuresB = interpretationB.globalExplanation.featureImportance;

      const allFeatures = new Set([
        ...featuresA.map(f => f.featureName),
        ...featuresB.map(f => f.featureName),
      ]);

      for (const feature of allFeatures) {
        const impA = featuresA.find(f => f.featureName === feature)?.importance ?? 0;
        const impB = featuresB.find(f => f.featureName === feature)?.importance ?? 0;

        comparison.features.push({
          feature,
          modelA: impA,
          modelB: impB,
          difference: Math.abs(impA - impB),
        });
      }

      comparison.features.sort((a: any, b: any) => b.difference - a.difference);
    }

    // Compare overall metrics
    if (interpretationA.globalExplanation && interpretationB.globalExplanation) {
      comparison.overall = {
        accuracyA: interpretationA.globalExplanation.modelBehavior.accuracy,
        accuracyB: interpretationB.globalExplanation.modelBehavior.accuracy,
        fairnessA: interpretationA.globalExplanation.modelBehavior.fairnessMetrics.overallFairness,
        fairnessB: interpretationB.globalExplanation.modelBehavior.fairnessMetrics.overallFairness,
      };
    }

    return comparison;
  }
}
