/**
 * ML Model Monitoring
 * Real-time monitoring of machine learning model performance and data drift
 */

import {
  ModelMetrics,
  ModelPerformanceMetrics,
  DataDriftMetrics,
  FeatureDrift,
  PredictionDrift,
  ConceptDrift,
  PredictionMetrics,
  ModelResourceMetrics,
} from '../types/index.js';
import { ModelMonitoringStorage } from './ml-storage.js';

export interface ModelConfig {
  modelId: string;
  modelVersion: string;
  features: string[];
  predictions: string[];
  baselineMetrics?: ModelPerformanceMetrics;
  thresholdConfig?: DriftThresholdConfig;
}

export interface DriftThresholdConfig {
  featureDriftThreshold: number;
  predictionDriftThreshold: number;
  performanceDegradationThreshold: number;
  enableAlerts: boolean;
}

export class ModelMonitoringService {
  private storage: ModelMonitoringStorage;
  private models: Map<string, ModelConfig> = new Map();
  private alertHandlers: Array<(alert: ModelAlert) => Promise<void>> = [];

  constructor(storage: ModelMonitoringStorage) {
    this.storage = storage;
  }

  /**
   * Register a model for monitoring
   */
  async registerModel(config: ModelConfig): Promise<void> {
    this.models.set(config.modelId, config);
    await this.storage.saveModelConfig(config);
  }

  /**
   * Record a prediction
   */
  async recordPrediction(record: PredictionRecord): Promise<void> {
    await this.storage.savePrediction(record);

    // Check for drift periodically
    const config = this.models.get(record.modelId);
    if (config) {
      await this.checkDrift(record.modelId);
    }
  }

  /**
   * Record ground truth label
   */
  async recordLabel(modelId: string, predictionId: string, label: any): Promise<void> {
    await this.storage.saveLabel(modelId, predictionId, label);

    // Update performance metrics
    await this.updatePerformanceMetrics(modelId);
  }

  /**
   * Get model metrics
   */
  async getModelMetrics(modelId: string, timeWindow?: number): Promise<ModelMetrics> {
    const config = this.models.get(modelId);
    if (!config) {
      throw new Error(`Model ${modelId} not registered`);
    }

    const now = Date.now();
    const startTime = timeWindow ? now - timeWindow : 0;

    const performanceMetrics = await this.getPerformanceMetrics(modelId, startTime);
    const dataDrift = await this.detectDataDrift(modelId, startTime);
    const predictions = await this.getPredictionMetrics(modelId, startTime);
    const resourceUsage = await this.getResourceMetrics(modelId, startTime);

    return {
      modelId,
      modelVersion: config.modelVersion,
      timestamp: now,
      performanceMetrics,
      dataDrift,
      predictions,
      resourceUsage,
    };
  }

  /**
   * Detect data drift
   */
  async detectDataDrift(
    modelId: string,
    startTime: number
  ): Promise<DataDriftMetrics> {
    const config = this.models.get(modelId);
    if (!config) {
      throw new Error(`Model ${modelId} not registered`);
    }

    const featureDrift: FeatureDrift[] = [];
    let totalDriftScore = 0;

    // Check each feature for drift
    for (const feature of config.features) {
      const drift = await this.detectFeatureDrift(modelId, feature, startTime);
      featureDrift.push(drift);
      totalDriftScore += drift.driftScore;
    }

    const predictionDrift = await this.detectPredictionDrift(modelId, startTime);
    const conceptDrift = await this.detectConceptDrift(modelId, startTime);

    const overallDriftScore =
      (totalDriftScore + predictionDrift.driftScore + (conceptDrift.detected ? conceptDrift.driftScore : 0)) /
      (featureDrift.length + 2);

    return {
      featureDrift,
      predictionDrift,
      conceptDrift,
      overallDriftScore,
    };
  }

  /**
   * Detect feature drift
   */
  async detectFeatureDrift(
    modelId: string,
    feature: string,
    startTime: number
  ): Promise<FeatureDrift> {
    const trainData = await this.storage.getTrainingFeatureDistribution(modelId, feature);
    const testData = await this.storage.getFeatureDistribution(modelId, feature, startTime);

    // Calculate Kolmogorov-Smirnov statistic
    const ksStat = this.kolmogorovSmirnov(trainData, testData);

    // Calculate p-value
    const pValue = this.ksPValue(ksStat, trainData.length, testData.length);

    // Calculate drift score
    const driftScore = 1 - pValue;

    return {
      feature,
      driftType: 'covariate',
      driftScore,
      pValue,
      distribution: {
        trainMean: this.mean(trainData),
        testMean: this.mean(testData),
        trainStd: this.standardDeviation(trainData),
        testStd: this.standardDeviation(testData),
        kolmogorovSmirnovStat: ksStat,
      },
      testMethod: 'kolmogorov_smirnov',
    };
  }

  /**
   * Detect prediction drift
   */
  async detectPredictionDrift(
    modelId: string,
    startTime: number
  ): Promise<PredictionDrift> {
    const trainPredictions = await this.storage.getTrainingPredictionDistribution(modelId);
    const testPredictions = await this.storage.getPredictionDistribution(modelId, startTime);

    const driftScore = 1 - this.jensenShannonDivergence(trainPredictions, testPredictions);

    const labelShift = await this.detectLabelShift(modelId, startTime);

    return {
      driftScore,
      distributionShift: {
        trainMean: this.mean(Object.values(trainPredictions)),
        testMean: this.mean(Object.values(testPredictions)),
        trainStd: 0, // Not applicable for categorical
        testStd: 0,
        kolmogorovSmirnovStat: 0,
      },
      labelShift,
    };
  }

  /**
   * Detect concept drift
   */
  async detectConceptDrift(
    modelId: string,
    startTime: number
  ): Promise<ConceptDrift> {
    const config = this.models.get(modelId);
    if (!config) {
      throw new Error(`Model ${modelId} not registered`);
    }

    // Compare current performance with baseline
    const currentMetrics = await this.getPerformanceMetrics(modelId, startTime);
    const baselineMetrics = config.baselineMetrics;

    if (!baselineMetrics) {
      return {
        detected: false,
        driftScore: 0,
        accuracyChange: 0,
        method: 'none',
      };
    }

    const accuracyChange =
      (currentMetrics.accuracy || 0) - (baselineMetrics.accuracy || 0);
    const driftScore = Math.abs(accuracyChange);

    const threshold = config.thresholdConfig?.performanceDegradationThreshold || 0.1;

    return {
      detected: accuracyChange < -threshold,
      driftScore,
      accuracyChange,
      method: 'accuracy_degradation',
    };
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(
    modelId: string,
    startTime: number
  ): Promise<ModelPerformanceMetrics> {
    const predictions = await this.storage.getLabeledPredictions(modelId, startTime);

    if (predictions.length === 0) {
      return {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
        aucRoc: 0,
        aucPr: 0,
        logLoss: 0,
      };
    }

    const metrics = this.calculateClassificationMetrics(predictions);

    return {
      ...metrics,
      calibration: await this.calculateCalibrationMetrics(predictions),
    };
  }

  /**
   * Get prediction metrics
   */
  async getPredictionMetrics(
    modelId: string,
    startTime: number
  ): Promise<PredictionMetrics> {
    const predictions = await this.storage.getPredictions(modelId, startTime);

    const totalPredictions = predictions.length;
    const predictionDistribution = this.calculatePredictionDistribution(predictions);
    const confidenceScores = this.calculateConfidenceScores(predictions);

    const latency = predictions.length > 0
      ? predictions.reduce((sum, p) => sum + p.latency, 0) / predictions.length
      : 0;

    return {
      totalPredictions,
      predictionDistribution,
      confidenceScores,
      latency,
      errorRate: 0, // Would need error tracking
    };
  }

  /**
   * Get resource metrics
   */
  async getResourceMetrics(
    modelId: string,
    startTime: number
  ): Promise<ModelResourceMetrics> {
    const predictions = await this.storage.getPredictions(modelId, startTime);

    if (predictions.length === 0) {
      return {
        inferenceTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        throughput: 0,
        batchSize: 0,
      };
    }

    const inferenceTimes = predictions.map(p => p.latency);
    const avgInferenceTime = this.mean(inferenceTimes);

    return {
      inferenceTime: avgInferenceTime,
      memoryUsage: 0, // Would need system monitoring
      cpuUsage: 0, // Would need system monitoring
      throughput: predictions.length / ((Date.now() - startTime) / 1000),
      batchSize: 1, // Assuming single predictions
    };
  }

  /**
   * Get model health status
   */
  async getHealthStatus(modelId: string): Promise<{
    healthy: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const config = this.models.get(modelId);
    if (!config) {
      return {
        healthy: false,
        issues: ['Model not registered'],
        recommendations: ['Register model for monitoring'],
      };
    }

    const metrics = await this.getModelMetrics(modelId);
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for drift
    if (metrics.dataDrift.overallDriftScore > (config.thresholdConfig?.featureDriftThreshold || 0.5)) {
      issues.push('High feature drift detected');
      recommendations.push('Retrain model with recent data');
    }

    // Check for concept drift
    if (metrics.dataDrift.conceptDrift.detected) {
      issues.push('Concept drift detected');
      recommendations.push('Investigate changing data patterns');
    }

    // Check performance degradation
    if (config.baselineMetrics) {
      const accuracyChange =
        (metrics.performanceMetrics.accuracy || 0) - (config.baselineMetrics.accuracy || 0);
      if (accuracyChange < -0.1) {
        issues.push('Significant accuracy drop');
        recommendations.push('Consider model retraining');
      }
    }

    // Check latency
    if (metrics.resourceUsage.inferenceTime > 1000) {
      issues.push('High inference latency');
      recommendations.push('Optimize model or increase resources');
    }

    return {
      healthy: issues.length === 0,
      issues,
      recommendations,
    };
  }

  /**
   * Register alert handler
   */
  onAlert(handler: (alert: ModelAlert) => Promise<void>): void {
    this.alertHandlers.push(handler);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private async checkDrift(modelId: string): Promise<void> {
    const config = this.models.get(modelId);
    if (!config || !config.thresholdConfig?.enableAlerts) {
      return;
    }

    const metrics = await this.getModelMetrics(modelId);

    // Check if drift exceeds threshold
    if (metrics.dataDrift.overallDriftScore > config.thresholdConfig.featureDriftThreshold) {
      const alert: ModelAlert = {
        modelId,
        type: 'feature_drift',
        severity: metrics.dataDrift.overallDriftScore > 0.8 ? 'critical' : 'warning',
        message: `Feature drift detected: ${metrics.dataDrift.overallDriftScore.toFixed(2)}`,
        timestamp: Date.now(),
        metrics,
      };

      await this.triggerAlert(alert);
    }

    if (metrics.dataDrift.conceptDrift.detected) {
      const alert: ModelAlert = {
        modelId,
        type: 'concept_drift',
        severity: 'critical',
        message: 'Concept drift detected',
        timestamp: Date.now(),
        metrics,
      };

      await this.triggerAlert(alert);
    }
  }

  private async triggerAlert(alert: ModelAlert): Promise<void> {
    await Promise.all(this.alertHandlers.map(handler => handler(alert)));
  }

  private async updatePerformanceMetrics(modelId: string): Promise<void> {
    // Update cached metrics
    await this.getModelMetrics(modelId);
  }

  private async detectLabelShift(
    modelId: string,
    startTime: number
  ): Promise<{ trainDistribution: Record<string, number>; testDistribution: Record<string, number>; jsDivergence: number }> {
    const trainDist = await this.storage.getTrainingLabelDistribution(modelId);
    const testDist = await this.storage.getLabelDistribution(modelId, startTime);

    const jsDivergence = this.jensenShannonDivergence(trainDist, testDist);

    return {
      trainDistribution: trainDist,
      testDistribution: testDist,
      jsDivergence,
    };
  }

  private calculateClassificationMetrics(
    predictions: LabeledPrediction[]
  ): Omit<ModelPerformanceMetrics, 'calibration'> {
    let truePositive = 0;
    let trueNegative = 0;
    let falsePositive = 0;
    let falseNegative = 0;

    for (const pred of predictions) {
      const predicted = pred.prediction > 0.5 ? 1 : 0;
      const actual = pred.label;

      if (predicted === 1 && actual === 1) truePositive++;
      else if (predicted === 0 && actual === 0) trueNegative++;
      else if (predicted === 1 && actual === 0) falsePositive++;
      else if (predicted === 0 && actual === 1) falseNegative++;
    }

    const accuracy = (truePositive + trueNegative) / predictions.length;
    const precision = truePositive / (truePositive + falsePositive) || 0;
    const recall = truePositive / (truePositive + falseNegative) || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;

    return {
      accuracy,
      precision,
      recall,
      f1Score,
      aucRoc: 0, // Would need more complex calculation
      aucPr: 0,
      logLoss: 0,
    };
  }

  private async calculateCalibrationMetrics(
    predictions: LabeledPrediction[]
  ): Promise<{ calibrationError: number; brierScore: number; reliabilityDiagram: Array<{ observed: number; predicted: number }> }> {
    const bins = 10;
    const binPredictions: Array<{ predicted: number; observed: number; count: number }>[] = [];

    for (let i = 0; i < bins; i++) {
      binPredictions.push({ predicted: 0, observed: 0, count: 0 });
    }

    for (const pred of predictions) {
      const binIndex = Math.min(Math.floor(pred.prediction * bins), bins - 1);
      binPredictions[binIndex].predicted += pred.prediction;
      binPredictions[binIndex].observed += pred.label;
      binPredictions[binIndex].count++;
    }

    const reliabilityDiagram = binPredictions.map(bin => ({
      observed: bin.count > 0 ? bin.observed / bin.count : 0,
      predicted: bin.count > 0 ? bin.predicted / bin.count : 0,
    }));

    const calibrationError =
      reliabilityDiagram.reduce((sum, point) => sum + Math.abs(point.observed - point.predicted), 0) /
      reliabilityDiagram.length;

    const brierScore =
      predictions.reduce((sum, pred) => sum + Math.pow(pred.label - pred.prediction, 2), 0) /
      predictions.length;

    return {
      calibrationError,
      brierScore,
      reliabilityDiagram,
    };
  }

  private calculatePredictionDistribution(predictions: PredictionRecord[]): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const pred of predictions) {
      const key = String(pred.prediction);
      distribution[key] = (distribution[key] || 0) + 1;
    }

    return distribution;
  }

  private calculateConfidenceScores(predictions: PredictionRecord[]): {
    mean: number;
    std: number;
    lowConfidenceRate: number;
    highConfidenceRate: number;
  } {
    if (predictions.length === 0) {
      return { mean: 0, std: 0, lowConfidenceRate: 0, highConfidenceRate: 0 };
    }

    const confidences = predictions.map(p => Math.abs(p.prediction - 0.5) * 2); // 0 to 1
    const mean = this.mean(confidences);
    const std = this.standardDeviation(confidences);

    const lowConfidenceCount = confidences.filter(c => c < 0.5).length;
    const highConfidenceCount = confidences.filter(c => c >= 0.8).length;

    return {
      mean,
      std,
      lowConfidenceRate: lowConfidenceCount / predictions.length,
      highConfidenceRate: highConfidenceCount / predictions.length,
    };
  }

  private kolmogorovSmirnov(data1: number[], data2: number[]): number {
    const sorted1 = [...data1].sort((a, b) => a - b);
    const sorted2 = [...data2].sort((a, b) => a - b);

    const cdf1 = (x: number) => sorted1.filter(v => v <= x).length / sorted1.length;
    const cdf2 = (x: number) => sorted2.filter(v => v <= x).length / sorted2.length;

    const allValues = [...sorted1, ...sorted2].sort((a, b) => a - b);

    let maxDiff = 0;
    for (const value of allValues) {
      const diff = Math.abs(cdf1(value) - cdf2(value));
      maxDiff = Math.max(maxDiff, diff);
    }

    return maxDiff;
  }

  private ksPValue(statistic: number, n1: number, n2: number): number {
    // Approximation for KS test p-value
    const effectiveN = (n1 * n2) / (n1 + n2);
    const z = statistic * Math.sqrt(effectiveN);

    // Approximate p-value from normal distribution
    return 1 - this.normalCDF(z);
  }

  private jensenShannonDivergence(p: Record<string, number>, q: Record<string, number>): number {
    const keys = new Set([...Object.keys(p), ...Object.keys(q)]);

    let pSum = 0;
    let qSum = 0;

    // Normalize distributions
    const pNorm: Record<string, number> = {};
    const qNorm: Record<string, number> = {};

    for (const key of keys) {
      pSum += p[key] || 0;
      qSum += q[key] || 0;
    }

    for (const key of keys) {
      pNorm[key] = (p[key] || 0) / pSum;
      qNorm[key] = (q[key] || 0) / qSum;
    }

    // Calculate KL divergence
    let jsDiv = 0;
    for (const key of keys) {
      const m = (pNorm[key] + qNorm[key]) / 2;

      if (pNorm[key] > 0) {
        jsDiv += pNorm[key] * Math.log2(pNorm[key] / m);
      }
      if (qNorm[key] > 0) {
        jsDiv += qNorm[key] * Math.log2(qNorm[key] / m);
      }
    }

    return jsDiv / 2;
  }

  private mean(values: number[]): number {
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  private standardDeviation(values: number[]): number {
    const m = this.mean(values);
    return Math.sqrt(values.reduce((acc, v) => acc + Math.pow(v - m, 2), 0) / values.length);
  }

  private normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

export interface PredictionRecord {
  modelId: string;
  predictionId: string;
  features: Record<string, number>;
  prediction: number | number[];
  probability?: number;
  timestamp: number;
  latency: number;
  userId?: string;
}

export interface LabeledPrediction extends PredictionRecord {
  label: number | number[];
}

export interface ModelAlert {
  modelId: string;
  type: 'feature_drift' | 'prediction_drift' | 'concept_drift' | 'performance_degradation';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  metrics: ModelMetrics;
}
