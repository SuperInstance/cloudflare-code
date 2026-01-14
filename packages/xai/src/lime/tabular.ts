/**
 * Tabular LIME Implementation
 * LIME explanation for tabular data
 */

import {
  LIMEExplanation,
  LIMEConfig,
  LocalModelExplanation,
  FeatureExplanation,
} from '../types/explanations';
import { ModelMetadata } from '../types/models';
import { mean, stdDev, normalize } from '../utils/math';
import { validateInstance, validateFeatureNames } from '../utils/validation';
import { LIMEKernel, KernelFunction } from './kernel';

export class TabularLIME {
  private config: Required<LIMEConfig>;
  private metadata: ModelMetadata;
  private kernelFn: KernelFunction;

  constructor(metadata: ModelMetadata, config: LIMEConfig = {}) {
    this.metadata = metadata;
    this.config = this.validateAndSetConfig(config);
    this.kernelFn = LIMEKernel.exponential(this.config.kernelWidth);
  }

  private validateAndSetConfig(config: LIMEConfig): Required<LIMEConfig> {
    return {
      numSamples: config.numSamples || 5000,
      kernelWidth: config.kernelWidth || 0.75,
      mode: config.mode || 'classification',
      featureSelection: config.featureSelection || 'auto',
      discretizeContinuous: config.discretizeContinuous || false,
    };
  }

  /**
   * Generate LIME explanation for a single instance
   */
  async explain(
    instance: Record<string, any>,
    predictFn: (features: Record<string, any>[]) => (number | number[])[],
    trainingData?: Record<string, any>[]
  ): Promise<LIMEExplanation> {
    // Validate input
    validateFeatureNames(this.metadata.featureNames);
    validateInstance(instance, this.metadata.featureNames);

    // Generate perturbed samples
    const samples = this.generatePerturbedSamples(instance, trainingData);

    // Get predictions for all samples
    const predictions = predictFn(samples);

    // Convert predictions to numerical values
    const numericalPredictions = this.convertPredictions(predictions);

    // Calculate distances from original instance
    const distances = this.calculateDistances(samples, instance);

    // Calculate kernel weights
    const weights = LIMEKernel.calculateWeights(distances, this.kernelFn);

    // Fit local interpretable model
    const localModel = this.fitLocalModel(samples, numericalPredictions, weights);

    // Build explanation
    return this.buildExplanation(instance, samples, localModel, weights, numericalPredictions);
  }

  /**
   * Generate LIME explanation for multiple instances
   */
  async explainBatch(
    instances: Record<string, any>[],
    predictFn: (features: Record<string, any>[]) => (number | number[])[],
    trainingData?: Record<string, any>[]
  ): Promise<LIMEExplanation[]> {
    const explanations: LIMEExplanation[] = [];

    for (const instance of instances) {
      const explanation = await this.explain(instance, predictFn, trainingData);
      explanations.push(explanation);
    }

    return explanations;
  }

  /**
   * Generate perturbed samples around the instance
   */
  private generatePerturbedSamples(
    instance: Record<string, any>,
    trainingData?: Record<string, any>[]
  ): Record<string, any>[] {
    const samples: Record<string, any>[] = [];

    for (let i = 0; i < this.config.numSamples; i++) {
      const sample: Record<string, any> = {};

      for (const feature of this.metadata.featureNames) {
        const featureType = this.metadata.featureTypes.find(
          ft => ft.name === feature
        );

        if (!featureType) continue;

        // Randomly decide whether to use original value or perturb
        const useOriginal = Math.random() > 0.5;

        if (useOriginal) {
          sample[feature] = instance[feature];
        } else {
          sample[feature] = this.perturbFeature(feature, instance[feature], trainingData);
        }
      }

      samples.push(sample);
    }

    return samples;
  }

  /**
   * Perturb a single feature
   */
  private perturbFeature(
    feature: string,
    originalValue: any,
    trainingData?: Record<string, any>[]
  ): any {
    const featureType = this.metadata.featureTypes.find(ft => ft.name === feature);

    if (!featureType) return originalValue;

    if (featureType.type === 'numeric') {
      // Sample from training data or use range
      if (trainingData && trainingData.length > 0) {
        const randomSample = trainingData[Math.floor(Math.random() * trainingData.length)];
        return randomSample[feature];
      } else {
        const min = featureType.range?.[0] ?? 0;
        const max = featureType.range?.[1] ?? 1;
        return min + Math.random() * (max - min);
      }
    } else if (featureType.type === 'categorical') {
      // Random category different from original
      const categories = featureType.categories ?? [];
      if (categories.length <= 1) return originalValue;

      const availableCategories = categories.filter(c => c !== originalValue);
      if (availableCategories.length === 0) return originalValue;

      return availableCategories[Math.floor(Math.random() * availableCategories.length)];
    } else if (featureType.type === 'boolean') {
      return !originalValue;
    }

    return originalValue;
  }

  /**
   * Calculate distances between samples and original instance
   */
  private calculateDistances(
    samples: Record<string, any>[],
    instance: Record<string, any>
  ): number[] {
    const distances: number[] = [];

    for (const sample of samples) {
      let distance = 0;
      let numFeatures = 0;

      for (const feature of this.metadata.featureNames) {
        const featureType = this.metadata.featureTypes.find(
          ft => ft.name === feature
        );

        if (!featureType) continue;

        if (featureType.type === 'numeric') {
          // Gower distance for numeric features
          const range = (featureType.range?.[1] ?? 1) - (featureType.range?.[0] ?? 0);
          if (range > 0) {
            distance += Math.abs((sample[feature] - instance[feature]) / range);
            numFeatures++;
          }
        } else if (featureType.type === 'categorical' || featureType.type === 'boolean') {
          // Simple matching for categorical
          distance += sample[feature] === instance[feature] ? 0 : 1;
          numFeatures++;
        }
      }

      distances.push(numFeatures > 0 ? distance / numFeatures : 0);
    }

    return distances;
  }

  /**
   * Convert model predictions to numerical values
   */
  private convertPredictions(predictions: (number | number[])[]): number[] {
    return predictions.map(pred => {
      if (Array.isArray(pred)) {
        // For classification, use probability of predicted class
        return Math.max(...pred);
      } else {
        return pred;
      }
    });
  }

  /**
   * Fit local linear model
   */
  private fitLocalModel(
    samples: Record<string, any>[],
    predictions: number[],
    weights: number[]
  ): LocalModelExplanation {
    // Create feature matrix
    const featureMatrix = this.createFeatureMatrix(samples);

    // Perform weighted least squares
    const result = this.weightedLeastSquares(featureMatrix, predictions, weights);

    // Calculate R² score
    const r2 = this.calculateR2(featureMatrix, predictions, result.coefficients, result.intercept);

    return {
      coefficients: result.coefficients,
      intercept: result.intercept,
      featureNames: this.metadata.featureNames,
      r2,
      prediction: this.predictLocal(featureMatrix[0], result.coefficients, result.intercept),
    };
  }

  /**
   * Create feature matrix from samples
   */
  private createFeatureMatrix(samples: Record<string, any>[]): number[][] {
    return samples.map(sample => {
      const row: number[] = [];

      for (const feature of this.metadata.featureNames) {
        const featureType = this.metadata.featureTypes.find(
          ft => ft.name === feature
        );

        if (!featureType) {
          row.push(0);
          continue;
        }

        if (featureType.type === 'numeric') {
          // Normalize numeric features
          const value = sample[feature] as number;
          const min = featureType.range?.[0] ?? 0;
          const max = featureType.range?.[1] ?? 1;
          const range = max - min;
          row.push(range > 0 ? (value - min) / range : 0);
        } else if (featureType.type === 'categorical') {
          // One-hot encode categorical features
          const categories = featureType.categories ?? [];
          for (const category of categories) {
            row.push(sample[feature] === category ? 1 : 0);
          }
        } else if (featureType.type === 'boolean') {
          row.push(sample[feature] === true ? 1 : 0);
        }
      }

      return row;
    });
  }

  /**
   * Weighted least squares regression
   */
  private weightedLeastSquares(
    X: number[][],
    y: number[],
    weights: number[]
  ): { coefficients: number[]; intercept: number } {
    // Simplified weighted least squares
    const numSamples = X.length;
    const numFeatures = X[0].length;

    // Add intercept column
    const XWithIntercept = X.map(row => [1, ...row]);

    // Calculate weighted normal equations: X^T W X = X^T W y
    const XtWX: number[][] = Array(numFeatures + 1)
      .fill(0)
      .map(() => Array(numFeatures + 1).fill(0));
    const XtWy: number[] = Array(numFeatures + 1).fill(0);

    for (let i = 0; i < numSamples; i++) {
      for (let j = 0; j <= numFeatures; j++) {
        for (let k = 0; k <= numFeatures; k++) {
          XtWX[j][k] += weights[i] * XWithIntercept[i][j] * XWithIntercept[i][k];
        }
        XtWy[j] += weights[i] * XWithIntercept[i][j] * y[i];
      }
    }

    // Solve system (simplified - use proper linear algebra in production)
    const coefficients = this.solveLinearSystem(XtWX, XtWy);

    return {
      coefficients: coefficients.slice(1),
      intercept: coefficients[0],
    };
  }

  /**
   * Solve linear system (simplified Gaussian elimination)
   */
  private solveLinearSystem(A: number[][], b: number[]): number[] {
    const n = A.length;
    const augmented = A.map((row, i) => [...row, b[i]]);

    // Forward elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }

      // Swap rows
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

      // Eliminate column
      for (let k = i + 1; k < n; k++) {
        const factor = augmented[k][i] / augmented[i][i];
        for (let j = i; j <= n; j++) {
          augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }

    // Back substitution
    const x: number[] = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = augmented[i][n];
      for (let j = i + 1; j < n; j++) {
        x[i] -= augmented[i][j] * x[j];
      }
      x[i] /= augmented[i][i];
    }

    return x;
  }

  /**
   * Calculate R² score
   */
  private calculateR2(
    X: number[][],
    y: number[],
    coefficients: number[],
    intercept: number
  ): number {
    const predictions = X.map(row => this.predictLocal(row, coefficients, intercept));

    const yMean = mean(y);
    const ssRes = y.reduce((sum, yi, i) => sum + Math.pow(yi - predictions[i], 2), 0);
    const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);

    return ssTot > 0 ? 1 - ssRes / ssTot : 0;
  }

  /**
   * Make prediction using local model
   */
  private predictLocal(
    features: number[],
    coefficients: number[],
    intercept: number
  ): number {
    let prediction = intercept;
    for (let i = 0; i < features.length && i < coefficients.length; i++) {
      prediction += features[i] * coefficients[i];
    }
    return prediction;
  }

  /**
   * Build explanation object
   */
  private buildExplanation(
    instance: Record<string, any>,
    samples: Record<string, any>[],
    localModel: LocalModelExplanation,
    weights: number[],
    predictions: number[]
  ): LIMEExplanation {
    // Calculate feature importance from coefficients
    const features: FeatureExplanation[] = this.calculateFeatureImportance(
      instance,
      localModel
    );

    // Sort by importance
    features.sort((a, b) => b.importance - a.importance);

    const mainPrediction = Math.max(...predictions);

    return {
      id: this.generateId(),
      timestamp: new Date(),
      modelId: this.metadata.modelInfo.id,
      modelName: this.metadata.modelInfo.name,
      prediction: mainPrediction,
      confidence: this.calculateConfidence(localModel, weights),
      instanceId: this.generateId(),
      instance,
      features,
      explanation: this.generateExplanationText(features, mainPrediction),
      method: 'tabular',
      localExplanation: localModel,
      intercept: localModel.intercept,
      predictionLocal: localModel.prediction,
      score: localModel.r2,
      samples: samples.length,
    };
  }

  /**
   * Calculate feature importance from local model
   */
  private calculateFeatureImportance(
    instance: Record<string, any>,
    localModel: LocalModelExplanation
  ): FeatureExplanation[] {
    const features: FeatureExplanation[] = [];

    let coeffIndex = 0;
    for (const featureName of this.metadata.featureNames) {
      const featureType = this.metadata.featureTypes.find(
        ft => ft.name === featureName
      );

      if (!featureType) continue;

      if (featureType.type === 'categorical') {
        // For categorical, use max coefficient across all categories
        const categories = featureType.categories ?? [];
        let maxCoeff = 0;

        for (const category of categories) {
          if (coeffIndex < localModel.coefficients.length) {
            const coeff = localModel.coefficients[coeffIndex];
            maxCoeff = Math.max(maxCoeff, Math.abs(coeff));
            coeffIndex++;
          }
        }

        const direction: 'positive' | 'negative' | 'neutral' =
          maxCoeff < 0.01 ? 'neutral' : 'positive';

        features.push({
          featureName,
          featureValue: instance[featureName],
          importance: maxCoeff,
          contribution: maxCoeff,
          direction,
          description: this.generateFeatureDescription(featureName, maxCoeff, direction),
        });
      } else {
        // For numeric and boolean, use single coefficient
        if (coeffIndex < localModel.coefficients.length) {
          const coeff = localModel.coefficients[coeffIndex];
          const direction: 'positive' | 'negative' | 'neutral' =
            Math.abs(coeff) < 0.01 ? 'neutral' : coeff > 0 ? 'positive' : 'negative';

          features.push({
            featureName,
            featureValue: instance[featureName],
            importance: Math.abs(coeff),
            contribution: coeff,
            direction,
            description: this.generateFeatureDescription(featureName, coeff, direction),
          });

          coeffIndex++;
        }
      }
    }

    return features;
  }

  /**
   * Generate feature description
   */
  private generateFeatureDescription(
    name: string,
    value: number,
    direction: string
  ): string {
    const absValue = Math.abs(value).toFixed(4);

    if (direction === 'positive') {
      return `${name} increases prediction by ${absValue}`;
    } else if (direction === 'negative') {
      return `${name} decreases prediction by ${absValue}`;
    } else {
      return `${name} has minimal effect on prediction`;
    }
  }

  /**
   * Generate natural language explanation
   */
  private generateExplanationText(
    features: FeatureExplanation[],
    prediction: number
  ): string {
    const topFeatures = features.slice(0, 5);

    let explanation = `Local linear model predicts ${prediction.toFixed(4)}.\n\n`;
    explanation += 'Key factors:\n';

    for (const feature of topFeatures) {
      explanation += `- ${feature.description}\n`;
    }

    return explanation;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    localModel: LocalModelExplanation,
    weights: number[]
  ): number {
    // Confidence based on R² score and weight distribution
    const r2Score = localModel.r2;
    const weightVariance = stdDev(weights);

    return Math.min(1, r2Score * (1 - weightVariance * 0.5));
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `lime_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get feature importance rankings
   */
  getFeatureImportance(explanation: LIMEExplanation): FeatureExplanation[] {
    return [...explanation.features].sort((a, b) => b.importance - a.importance);
  }
}
