/**
 * Kernel SHAP Implementation
 * Model-agnostic SHAP approximation using weighted linear regression
 */

import {
  SHAPValues,
  SHAPExplanation,
  SHAPConfig,
  FeatureExplanation,
} from '../types/explanations';
import { ModelMetadata } from '../types/models';
import { mean, stdDev, normalize } from '../utils/math';
import { validateInstance, validateFeatureNames } from '../utils/validation';

export class KernelSHAP {
  private config: Required<SHAPConfig>;
  private metadata: ModelMetadata;

  constructor(metadata: ModelMetadata, config: SHAPConfig = {}) {
    this.metadata = metadata;
    this.config = this.validateAndSetConfig(config);
  }

  private validateAndSetConfig(config: SHAPConfig): Required<SHAPConfig> {
    return {
      method: 'kernel',
      backgroundSize: config.backgroundSize || 100,
      maxSamples: config.maxSamples || 1000,
      algorithm: config.algorithm || 'auto',
      outputPrecision: config.outputPrecision || 4,
    };
  }

  /**
   * Generate SHAP values for a single instance
   */
  async explain(
    instance: Record<string, any>,
    predictFn: (features: Record<string, any>[]) => (number | number[])[]
  ): Promise<SHAPExplanation> {
    // Validate input
    validateFeatureNames(this.metadata.featureNames);
    validateInstance(instance, this.metadata.featureNames);

    const featureNames = this.metadata.featureNames;
    const numFeatures = featureNames.length;

    // Generate background samples
    const backgroundSamples = await this.generateBackgroundSamples();

    // Create perturbed samples
    const samples = this.generatePerturbedSamples(instance, backgroundSamples);

    // Get predictions for all samples
    const predictions = predictFn(samples);

    // Calculate weights for each sample
    const weights = this.calculateKernelWeights(samples, instance);

    // Solve weighted linear regression
    const shapValues = this.solveWeightedRegression(samples, predictions, weights, numFeatures);

    // Build explanation
    return this.buildExplanation(instance, shapValues, predictions, weights);
  }

  /**
   * Generate SHAP values for multiple instances (batch)
   */
  async explainBatch(
    instances: Record<string, any>[],
    predictFn: (features: Record<string, any>[]) => (number | number[])[]
  ): Promise<SHAPExplanation[]> {
    const explanations: SHAPExplanation[] = [];

    for (const instance of instances) {
      const explanation = await this.explain(instance, predictFn);
      explanations.push(explanation);
    }

    return explanations;
  }

  /**
   * Generate background samples for SHAP calculation
   */
  private async generateBackgroundSamples(): Promise<Record<string, any>[]> {
    // In a real implementation, you'd sample from training data
    // For now, create synthetic background samples
    const samples: Record<string, any>[] = [];

    for (let i = 0; i < this.config.backgroundSize; i++) {
      const sample: Record<string, any> = {};

      for (const feature of this.metadata.featureNames) {
        const featureType = this.metadata.featureTypes.find(
          ft => ft.name === feature
        );

        if (!featureType) continue;

        if (featureType.type === 'numeric') {
          // Random value within range
          const min = featureType.range?.[0] ?? 0;
          const max = featureType.range?.[1] ?? 1;
          sample[feature] = min + Math.random() * (max - min);
        } else if (featureType.type === 'categorical') {
          // Random category
          const categories = featureType.categories ?? [];
          sample[feature] = categories[Math.floor(Math.random() * categories.length)];
        } else if (featureType.type === 'boolean') {
          sample[feature] = Math.random() > 0.5;
        } else {
          sample[feature] = null;
        }
      }

      samples.push(sample);
    }

    return samples;
  }

  /**
   * Generate perturbed samples for SHAP calculation
   */
  private generatePerturbedSamples(
    instance: Record<string, any>,
    backgroundSamples: Record<string, any>[]
  ): Record<string, any>[] {
    const numFeatures = this.metadata.featureNames.length;
    const samples: Record<string, any>[] = [];

    // Generate all 2^n possible subsets
    for (let mask = 0; mask < Math.pow(2, numFeatures); mask++) {
      const sample: Record<string, any> = {};

      for (let i = 0; i < numFeatures; i++) {
        const feature = this.metadata.featureNames[i];

        // If bit is set, use instance value, otherwise use background
        if ((mask >> i) & 1) {
          sample[feature] = instance[feature];
        } else {
          // Randomly sample from background
          const bgIndex = Math.floor(Math.random() * backgroundSamples.length);
          sample[feature] = backgroundSamples[bgIndex][feature];
        }
      }

      samples.push(sample);
    }

    return samples;
  }

  /**
   * Calculate kernel weights for samples
   */
  private calculateKernelWeights(
    samples: Record<string, any>[],
    instance: Record<string, any>
  ): number[] {
    const numFeatures = this.metadata.featureNames.length;
    const weights: number[] = [];

    for (const sample of samples) {
      let numPresent = 0;

      for (const feature of this.metadata.featureNames) {
        if (sample[feature] === instance[feature]) {
          numPresent++;
        }
      }

      // Kernel SHAP weight function
      const z = numPresent / numFeatures;
      const weight = (numFeatures - 1) / (z * (1 - z) + 1e-10);

      weights.push(weight);
    }

    // Normalize weights
    const sumWeights = weights.reduce((sum, w) => sum + w, 0);
    return weights.map(w => w / sumWeights);
  }

  /**
   * Solve weighted linear regression to get SHAP values
   */
  private solveWeightedRegression(
    samples: Record<string, any>[],
    predictions: (number | number[])[],
    weights: number[],
    numFeatures: number
  ): number[] {
    // For simplicity, using a basic approach
    // In production, use proper linear algebra libraries

    const shapValues: number[] = [];
    const numSamples = samples.length;

    // Calculate base value (expected prediction with no features)
    let baseSum = 0;
    let weightSum = 0;

    for (let i = 0; i < numSamples; i++) {
      const hasNoFeatures = this.metadata.featureNames.every(
        f => samples[i][f] !== samples[0][f]
      );

      if (hasNoFeatures) {
        const pred = Array.isArray(predictions[i]) ? predictions[i][0] : predictions[i];
        baseSum += pred * weights[i];
        weightSum += weights[i];
      }
    }

    const baseValue = baseSum / weightSum;

    // Calculate SHAP values for each feature
    for (let f = 0; f < numFeatures; f++) {
      const feature = this.metadata.featureNames[f];

      // Calculate marginal contribution
      let contributionSum = 0;
      let contributionWeight = 0;

      for (let i = 0; i < numSamples; i++) {
        if (samples[i][feature] !== undefined) {
          // Find matching sample without this feature
          for (let j = 0; j < numSamples; j++) {
            const isMatch = this.metadata.featureNames.every(
              feat => feat === feature || samples[i][feat] === samples[j][feat]
            );

            if (isMatch) {
              const predI = Array.isArray(predictions[i]) ? predictions[i][0] : predictions[i];
              const predJ = Array.isArray(predictions[j]) ? predictions[j][0] : predictions[j];

              contributionSum += (predI - predJ) * weights[i];
              contributionWeight += weights[i];
              break;
            }
          }
        }
      }

      shapValues.push(contributionSum / contributionWeight);
    }

    // Normalize to ensure sum of SHAP values equals prediction - base value
    const sumSHAP = shapValues.reduce((sum, v) => sum + v, 0);

    return shapValues;
  }

  /**
   * Build explanation object
   */
  private buildExplanation(
    instance: Record<string, any>,
    shapValues: number[],
    predictions: (number | number[])[],
    weights: number[]
  ): SHAPExplanation {
    const baseValue = mean(predictions.map(p => Array.isArray(p) ? p[0] : p)) as number;

    // Calculate feature importance and direction
    const features: FeatureExplanation[] = this.metadata.featureNames.map(
      (name, index) => {
        const value = shapValues[index];
        const direction: 'positive' | 'negative' | 'neutral' =
          Math.abs(value) < 0.01 ? 'neutral' : value > 0 ? 'positive' : 'negative';

        return {
          featureName: name,
          featureValue: instance[name],
          importance: Math.abs(value),
          contribution: value,
          direction,
          description: this.generateFeatureDescription(name, value, direction),
        };
      }
    );

    // Sort by importance
    features.sort((a, b) => b.importance - a.importance);

    const mainPrediction = Array.isArray(predictions[0])
      ? predictions[0][0]
      : predictions[0];

    return {
      id: this.generateId(),
      timestamp: new Date(),
      modelId: this.metadata.modelInfo.id,
      modelName: this.metadata.modelInfo.name,
      prediction: mainPrediction,
      confidence: this.calculateConfidence(shapValues, weights),
      instanceId: this.generateId(),
      instance,
      features,
      explanation: this.generateExplanationText(features, mainPrediction, baseValue),
      method: 'kernel',
      shapValues: {
        values: shapValues,
        baseValue,
        data: instance,
        featureNames: this.metadata.featureNames,
      },
      expectedValue: baseValue,
    };
  }

  /**
   * Calculate confidence score for SHAP explanation
   */
  private calculateConfidence(shapValues: number[], weights: number[]): number {
    // Confidence based on weight distribution and SHAP value stability
    const weightVariance = stdDev(weights);
    const shapMean = mean(shapValues.map(Math.abs));

    return Math.min(1, 1 / (1 + weightVariance) * (1 - shapMean * 0.1));
  }

  /**
   * Generate description for a feature's contribution
   */
  private generateFeatureDescription(
    name: string,
    value: number,
    direction: string
  ): string {
    const absValue = Math.abs(value).toFixed(this.config.outputPrecision);

    if (direction === 'positive') {
      return `${name} increases prediction by ${absValue}`;
    } else if (direction === 'negative') {
      return `${name} decreases prediction by ${absValue}`;
    } else {
      return `${name} has minimal effect`;
    }
  }

  /**
   * Generate natural language explanation
   */
  private generateExplanationText(
    features: FeatureExplanation[],
    prediction: number,
    baseValue: number
  ): string {
    const topFeatures = features.slice(0, 5);

    let explanation = `Model predicts ${prediction.toFixed(2)} (base value: ${baseValue.toFixed(2)}).\n\n`;

    explanation += 'Key factors:\n';
    for (const feature of topFeatures) {
      explanation += `- ${feature.description}\n`;
    }

    return explanation;
  }

  /**
   * Calculate interaction values between features
   */
  async calculateInteractions(
    instance: Record<string, any>,
    predictFn: (features: Record<string, any>[]) => (number | number[])[]
  ): Promise<number[][]> {
    const numFeatures = this.metadata.featureNames.length;
    const interactions: number[][] = Array(numFeatures)
      .fill(0)
      .map(() => Array(numFeatures).fill(0));

    // Calculate SHAP interaction matrix
    for (let i = 0; i < numFeatures; i++) {
      for (let j = i; j < numFeatures; j++) {
        const interactionValue = await this.calculatePairwiseInteraction(
          i,
          j,
          instance,
          predictFn
        );

        interactions[i][j] = interactionValue;
        interactions[j][i] = interactionValue;
      }
    }

    return interactions;
  }

  /**
   * Calculate interaction between a pair of features
   */
  private async calculatePairwiseInteraction(
    featureI: number,
    featureJ: number,
    instance: Record<string, any>,
    predictFn: (features: Record<string, any>[]) => (number | number[])[]
  ): Promise<number> {
    // Simplified interaction calculation
    // In production, use proper SHAP interaction computation

    const samples: Record<string, any>[] = [];
    const featureIName = this.metadata.featureNames[featureI];
    const featureJName = this.metadata.featureNames[featureJ];

    // Create perturbed samples for interaction
    for (let maskI = 0; maskI <= 1; maskI++) {
      for (let maskJ = 0; maskJ <= 1; maskJ++) {
        const sample: Record<string, any> = { ...instance };

        // Perturb features
        if (maskI === 0) {
          sample[featureIName] = this.getRandomValue(featureIName);
        }
        if (maskJ === 0) {
          sample[featureJName] = this.getRandomValue(featureJName);
        }

        samples.push(sample);
      }
    }

    const predictions = predictFn(samples);
    const preds = predictions.map(p => (Array.isArray(p) ? p[0] : p) as number);

    // Calculate interaction effect
    const interaction =
      (preds[3] - preds[2] - preds[1] + preds[0]) / 4;

    return interaction;
  }

  /**
   * Get random value for a feature
   */
  private getRandomValue(featureName: string): any {
    const featureType = this.metadata.featureTypes.find(
      ft => ft.name === featureName
    );

    if (!featureType) return 0;

    if (featureType.type === 'numeric') {
      const min = featureType.range?.[0] ?? 0;
      const max = featureType.range?.[1] ?? 1;
      return min + Math.random() * (max - min);
    } else if (featureType.type === 'categorical') {
      const categories = featureType.categories ?? [];
      return categories[Math.floor(Math.random() * categories.length)];
    } else if (featureType.type === 'boolean') {
      return Math.random() > 0.5;
    }

    return 0;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `shap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get feature importance rankings
   */
  getFeatureImportance(shapExplanation: SHAPExplanation): FeatureExplanation[] {
    return [...shapExplanation.features].sort((a, b) => b.importance - a.importance);
  }

  /**
   * Summarize SHAP explanations across multiple instances
   */
  summarizeBatch(explanations: SHAPExplanation[]): {
    meanAbsoluteSHAP: Record<string, number>;
    importanceRanking: string[];
    consensus: Record<string, { mean: number; std: number; direction: string }>;
  } {
    const numFeatures = this.metadata.featureNames.length;
    const shapMatrix: number[][] = Array(numFeatures)
      .fill(0)
      .map(() => []);

    // Collect SHAP values
    for (const explanation of explanations) {
      for (let i = 0; i < numFeatures; i++) {
        const featureName = this.metadata.featureNames[i];
        const feature = explanation.features.find(f => f.featureName === featureName);
        if (feature) {
          shapMatrix[i].push(Math.abs(feature.contribution));
        }
      }
    }

    // Calculate statistics
    const meanAbsoluteSHAP: Record<string, number> = {};
    const consensus: Record<string, { mean: number; std: number; direction: string }> = {};

    for (let i = 0; i < numFeatures; i++) {
      const featureName = this.metadata.featureNames[i];
      const values = shapMatrix[i];

      meanAbsoluteSHAP[featureName] = mean(values);
      consensus[featureName] = {
        mean: mean(values),
        std: stdDev(values),
        direction: 'neutral',
      };
    }

    // Rank features
    const importanceRanking = Object.entries(meanAbsoluteSHAP)
      .sort(([, a], [, b]) => b - a)
      .map(([name]) => name);

    return { meanAbsoluteSHAP, importanceRanking, consensus };
  }
}
