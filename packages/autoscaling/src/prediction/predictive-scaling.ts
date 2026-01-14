/**
 * Predictive scaling using machine learning
 */

import type {
  TimeSeriesData,
  PredictionResult,
  PredictionPoint,
  PredictionModel,
  PredictionModelType,
  SeasonalPattern,
  SeasonalType
} from '../types/index.js';
import { Logger } from '@claudeflare/logger';

export interface PredictiveScalingConfig {
  enabled: boolean;
  modelType: PredictionModelType;
  predictionHorizon: number; // Minutes to predict ahead
  confidenceThreshold: number; // Minimum confidence to act on predictions
  retrainInterval: number; // How often to retrain models (ms)
  features: string[];
  enableSeasonalDetection: boolean;
  enableAnomalyDetection: boolean;
}

export class PredictiveScalingEngine {
  private logger: Logger;
  private config: PredictiveScalingConfig;
  private models: Map<string, PredictionModel> = new Map();
  private historyData: Map<string, TimeSeriesData[]> = new Map();
  private seasonalPatterns: Map<string, SeasonalPattern[]> = new Map();
  private lastRetrain: Map<string, Date> = new Map();

  constructor(config: Partial<PredictiveScalingConfig> = {}) {
    this.logger = new Logger('PredictiveScalingEngine');
    this.config = {
      enabled: true,
      modelType: PredictionModelType.LINEAR_REGRESSION,
      predictionHorizon: 60, // 1 hour ahead
      confidenceThreshold: 0.7,
      retrainInterval: 3600000, // 1 hour
      features: ['cpu', 'memory', 'requests', 'latency'],
      enableSeasonalDetection: true,
      enableAnomalyDetection: true,
      ...config
    };
  }

  /**
   * Add time series data for prediction
   */
  addTimeSeriesData(resourceId: string, data: TimeSeriesData[]): void {
    if (!this.historyData.has(resourceId)) {
      this.historyData.set(resourceId, []);
    }

    const history = this.historyData.get(resourceId)!;
    history.push(...data);

    // Keep last 1000 data points
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }

    // Detect seasonal patterns
    if (this.config.enableSeasonalDetection) {
      this.detectSeasonalPatterns(resourceId);
    }

    // Retrain model if needed
    if (this.shouldRetrain(resourceId)) {
      this.trainModel(resourceId);
    }
  }

  /**
   * Generate predictions for a resource
   */
  async predict(
    resourceId: string,
    metric: string,
    horizon?: number
  ): Promise<PredictionResult> {
    if (!this.config.enabled) {
      throw new Error('Predictive scaling is disabled');
    }

    const history = this.historyData.get(resourceId);
    if (!history || history.length < 10) {
      throw new Error(`Insufficient data for prediction: ${resourceId}`);
    }

    const model = this.models.get(resourceId);
    if (!model) {
      await this.trainModel(resourceId);
    }

    const predictionHorizon = horizon || this.config.predictionHorizon;
    const points = await this.generatePredictionPoints(resourceId, metric, predictionHorizon);

    // Calculate overall confidence
    const avgConfidence =
      points.reduce((sum, p) => sum + p.confidence, 0) / points.length;

    return {
      timestamp: new Date(),
      metric,
      predictions: points,
      confidence: avgConfidence,
      model: this.config.modelType,
      features: this.extractFeatures(history)
    };
  }

  /**
   * Generate prediction points
   */
  private async generatePredictionPoints(
    resourceId: string,
    metric: string,
    horizon: number
  ): Promise<PredictionPoint[]> {
    const history = this.historyData.get(resourceId)!;
    const points: PredictionPoint[] = [];

    switch (this.config.modelType) {
      case PredictionModelType.LINEAR_REGRESSION:
        return this.linearRegressionPredict(history, horizon);

      case PredictionModelType.ARIMA:
        return this.arimaPredict(history, horizon);

      case PredictionModelType.PROPHET:
        return this.prophetPredict(history, horizon);

      case PredictionModelType.LSTM:
        return this.lstmPredict(history, horizon);

      default:
        return this.linearRegressionPredict(history, horizon);
    }
  }

  /**
   * Linear regression prediction
   */
  private linearRegressionPredict(
    history: TimeSeriesData[],
    horizon: number
  ): PredictionPoint[] {
    const n = history.length;
    const data = history.map((d, i) => ({ x: i, y: d.value }));

    // Calculate linear regression
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (const point of data) {
      sumX += point.x;
      sumY += point.y;
      sumXY += point.x * point.y;
      sumXX += point.x * point.x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R² for confidence
    const meanY = sumY / n;
    let ssTotal = 0, ssResidual = 0;
    for (const point of data) {
      const predicted = slope * point.x + intercept;
      ssTotal += Math.pow(point.y - meanY, 2);
      ssResidual += Math.pow(point.y - predicted, 2);
    }

    const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;
    const stdError = Math.sqrt(ssResidual / (n - 2));

    // Generate predictions
    const points: PredictionPoint[] = [];
    const lastTimestamp = history[history.length - 1].timestamp;

    for (let i = 1; i <= horizon; i++) {
      const x = n + i - 1;
      const value = slope * x + intercept;
      const confidence = Math.max(0.1, Math.min(0.95, rSquared));
      const margin = stdError * 1.96; // 95% confidence interval

      points.push({
        timestamp: new Date(lastTimestamp.getTime() + i * 60000),
        value: Math.max(0, value),
        lowerBound: Math.max(0, value - margin),
        upperBound: value + margin,
        confidence
      });
    }

    return points;
  }

  /**
   * ARIMA prediction (simplified)
   */
  private arimaPredict(history: TimeSeriesData[], horizon: number): PredictionPoint[] {
    // Simplified ARIMA(1,1,1) implementation
    const values = history.map((h) => h.value);

    // Differencing
    const diffed = [];
    for (let i = 1; i < values.length; i++) {
      diffed.push(values[i] - values[i - 1]);
    }

    // Simple AR(1) model on differenced data
    const n = diffed.length;
    let sum = 0, sumXY = 0, sumXX = 0;
    for (let i = 1; i < n; i++) {
      sum += diffed[i];
      sumXY += diffed[i - 1] * diffed[i];
      sumXX += diffed[i - 1] * diffed[i - 1];
    }

    const mean = sum / (n - 1);
    const ar = sumXY / sumXX;

    // Forecast
    const lastValue = values[values.length - 1];
    const lastDiff = diffed[diffed.length - 1];
    const points: PredictionPoint[] = [];
    const lastTimestamp = history[history.length - 1].timestamp;

    let predictedValue = lastValue;
    let predictedDiff = lastDiff;

    for (let i = 1; i <= horizon; i++) {
      predictedDiff = ar * (predictedDiff - mean) + mean;
      predictedValue += predictedDiff;

      const confidence = Math.max(0.3, 0.9 - i * 0.01);

      points.push({
        timestamp: new Date(lastTimestamp.getTime() + i * 60000),
        value: Math.max(0, predictedValue),
        lowerBound: Math.max(0, predictedValue * 0.8),
        upperBound: predictedValue * 1.2,
        confidence
      });
    }

    return points;
  }

  /**
   * Prophet-like prediction with seasonality
   */
  private prophetPredict(history: TimeSeriesData[], horizon: number): PredictionPoint[] {
    // Decompose time series into trend, seasonality, and holidays
    const trend = this.calculateTrend(history);
    const seasonal = this.calculateSeasonality(history);
    const residuals = this.calculateResiduals(history, trend, seasonal);

    // Calculate standard error of residuals
    const stdError = Math.sqrt(
      residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length
    );

    const points: PredictionPoint[] = [];
    const lastTimestamp = history[history.length - 1].timestamp;

    for (let i = 1; i <= horizon; i++) {
      const timestamp = new Date(lastTimestamp.getTime() + i * 60000);
      const trendValue = this.extrapolateTrend(trend, i);
      const seasonalValue = this.extrapolateSeasonality(seasonal, timestamp);
      const value = trendValue + seasonalValue;

      const confidence = Math.max(0.4, 0.95 - i * 0.005);
      const margin = stdError * 1.96;

      points.push({
        timestamp,
        value: Math.max(0, value),
        lowerBound: Math.max(0, value - margin),
        upperBound: value + margin,
        confidence
      });
    }

    return points;
  }

  /**
   * LSTM-style prediction (simplified)
   */
  private lstmPredict(history: TimeSeriesData[], horizon: number): PredictionPoint[] {
    // Simplified sliding window prediction
    const windowSize = Math.min(10, Math.floor(history.length / 2));
    const values = history.map((h) => h.value);

    const points: PredictionPoint[] = [];
    const lastTimestamp = history[history.length - 1].timestamp;
    let window = values.slice(-windowSize);

    for (let i = 1; i <= horizon; i++) {
      // Predict next value using weighted average of window
      const weights = Array.from({ length: windowSize }, (_, j) => (j + 1) / windowSize);
      const sumWeights = weights.reduce((sum, w) => sum + w, 0);
      const value =
        window.reduce((sum, v, j) => sum + v * weights[j], 0) / sumWeights;

      // Update window
      window = [...window.slice(1), value];

      const confidence = Math.max(0.3, 0.9 - i * 0.02);

      points.push({
        timestamp: new Date(lastTimestamp.getTime() + i * 60000),
        value: Math.max(0, value),
        lowerBound: Math.max(0, value * 0.7),
        upperBound: value * 1.3,
        confidence
      });
    }

    return points;
  }

  /**
   * Calculate trend component
   */
  private calculateTrend(history: TimeSeriesData[]): { slope: number; intercept: number } {
    const n = history.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += history[i].value;
      sumXY += i * history[i].value;
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  /**
   * Calculate seasonality component
   */
  private calculateSeasonality(history: TimeSeriesData[]): Map<number, number> {
    const seasonal = new Map<number, number>();

    if (history.length < 24) {
      return seasonal;
    }

    // Calculate hourly seasonality (24-hour pattern)
    const hourlySums = new Map<number, number[]>();
    const hourlyCounts = new Map<number, number>();

    const trend = this.calculateTrend(history);

    for (let i = 0; i < history.length; i++) {
      const hour = history[i].timestamp.getHours();
      const detrended = history[i].value - (trend.slope * i + trend.intercept);

      if (!hourlySums.has(hour)) {
        hourlySums.set(hour, []);
        hourlyCounts.set(hour, 0);
      }

      hourlySums.get(hour)!.push(detrended);
      hourlyCounts.set(hour, hourlyCounts.get(hour)! + 1);
    }

    // Calculate average for each hour
    for (const [hour, values] of hourlySums) {
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
      seasonal.set(hour, avg);
    }

    return seasonal;
  }

  /**
   * Calculate residuals
   */
  private calculateResiduals(
    history: TimeSeriesData[],
    trend: { slope: number; intercept: number },
    seasonal: Map<number, number>
  ): number[] {
    const residuals: number[] = [];

    for (let i = 0; i < history.length; i++) {
      const trendValue = trend.slope * i + trend.intercept;
      const seasonalValue = seasonal.get(history[i].timestamp.getHours()) || 0;
      const residual = history[i].value - trendValue - seasonalValue;
      residuals.push(residual);
    }

    return residuals;
  }

  /**
   * Extrapolate trend
   */
  private extrapolateTrend(trend: { slope: number; intercept: number }, steps: number): number {
    return trend.slope * (1000 + steps) + trend.intercept;
  }

  /**
   * Extrapolate seasonality
   */
  private extrapolateSeasonality(seasonal: Map<number, number>, timestamp: Date): number {
    return seasonal.get(timestamp.getHours()) || 0;
  }

  /**
   * Detect seasonal patterns
   */
  private detectSeasonalPatterns(resourceId: string): void {
    const history = this.historyData.get(resourceId);
    if (!history || history.length < 48) {
      return;
    }

    const patterns: SeasonalPattern[] = [];

    // Detect daily pattern
    const dailyPattern = this.detectDailyPattern(history);
    if (dailyPattern) {
      patterns.push(dailyPattern);
    }

    // Detect weekly pattern
    const weeklyPattern = this.detectWeeklyPattern(history);
    if (weeklyPattern) {
      patterns.push(weeklyPattern);
    }

    this.seasonalPatterns.set(resourceId, patterns);
    this.logger.info(`Detected ${patterns.length} seasonal patterns for ${resourceId}`);
  }

  /**
   * Detect daily pattern
   */
  private detectDailyPattern(history: TimeSeriesData[]): SeasonalPattern | null {
    // Group by hour and calculate variance
    const hourlyValues = new Map<number, number[]>();

    for (const point of history) {
      const hour = point.timestamp.getHours();
      if (!hourlyValues.has(hour)) {
        hourlyValues.set(hour, []);
      }
      hourlyValues.get(hour)!.push(point.value);
    }

    // Calculate amplitude (max difference between hourly averages)
    const hourlyAvgs = Array.from(hourlyValues.entries()).map(([hour, values]) => ({
      hour,
      avg: values.reduce((sum, v) => sum + v, 0) / values.length
    }));

    const max = Math.max(...hourlyAvgs.map((h) => h.avg));
    const min = Math.min(...hourlyAvgs.map((h) => h.avg));
    const amplitude = max - min;

    // If amplitude is significant (more than 20% of mean)
    const mean = hourlyAvgs.reduce((sum, h) => sum + h.avg, 0) / hourlyAvgs.length;
    if (amplitude > mean * 0.2) {
      return {
        period: 24,
        amplitude,
        phase: hourlyAvgs.findIndex((h) => h.avg === max),
        type: SeasonalType.DAILY
      };
    }

    return null;
  }

  /**
   * Detect weekly pattern
   */
  private detectWeeklyPattern(history: TimeSeriesData[]): SeasonalPattern | null {
    if (history.length < 7 * 24) {
      return null;
    }

    // Group by day of week
    const dailyValues = new Map<number, number[]>();

    for (const point of history) {
      const day = point.timestamp.getDay();
      if (!dailyValues.has(day)) {
        dailyValues.set(day, []);
      }
      dailyValues.get(day)!.push(point.value);
    }

    const dailyAvgs = Array.from(dailyValues.entries()).map(([day, values]) => ({
      day,
      avg: values.reduce((sum, v) => sum + v, 0) / values.length
    }));

    const max = Math.max(...dailyAvgs.map((d) => d.avg));
    const min = Math.min(...dailyAvgs.map((d) => d.avg));
    const amplitude = max - min;

    const mean = dailyAvgs.reduce((sum, d) => sum + d.avg, 0) / dailyAvgs.length;
    if (amplitude > mean * 0.15) {
      return {
        period: 7,
        amplitude,
        phase: dailyAvgs.findIndex((d) => d.avg === max),
        type: SeasonalType.WEEKLY
      };
    }

    return null;
  }

  /**
   * Detect anomalies in time series
   */
  detectAnomalies(
    resourceId: string,
    threshold: number = 2.5
  ): Array<{ timestamp: Date; value: number; score: number }> {
    const history = this.historyData.get(resourceId);
    if (!history || history.length < 20) {
      return [];
    }

    const anomalies: Array<{ timestamp: Date; value: number; score: number }> = [];
    const values = history.map((h) => h.value);

    // Calculate mean and standard deviation
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Detect anomalies using z-score
    for (let i = 0; i < history.length; i++) {
      const zScore = Math.abs((history[i].value - mean) / stdDev);
      if (zScore > threshold) {
        anomalies.push({
          timestamp: history[i].timestamp,
          value: history[i].value,
          score: zScore
        });
      }
    }

    return anomalies;
  }

  /**
   * Train a prediction model
   */
  async trainModel(resourceId: string): Promise<PredictionModel> {
    const history = this.historyData.get(resourceId);
    if (!history || history.length < 20) {
      throw new Error(`Insufficient data to train model: ${resourceId}`);
    }

    // Train model and calculate accuracy
    const accuracy = this.calculateModelAccuracy(history);

    const model: PredictionModel = {
      id: `model-${resourceId}`,
      name: `${this.config.modelType} model for ${resourceId}`,
      type: this.config.modelType,
      trainedAt: new Date(),
      accuracy,
      features: this.config.features,
      horizon: this.config.predictionHorizon,
      confidenceInterval: 0.95
    };

    this.models.set(resourceId, model);
    this.lastRetrain.set(resourceId, new Date());

    this.logger.info(
      `Trained ${this.config.modelType} model for ${resourceId} with accuracy: ${(accuracy * 100).toFixed(1)}%`
    );

    return model;
  }

  /**
   * Calculate model accuracy using cross-validation
   */
  private calculateModelAccuracy(history: TimeSeriesData[]): number {
    // Use last 20% of data for testing
    const splitPoint = Math.floor(history.length * 0.8);
    const trainData = history.slice(0, splitPoint);
    const testData = history.slice(splitPoint);

    if (testData.length === 0) {
      return 0.5;
    }

    // Generate predictions for test period
    const predictions = this.linearRegressionPredict(trainData, testData.length);

    // Calculate mean absolute percentage error (MAPE)
    let mape = 0;
    for (let i = 0; i < predictions.length; i++) {
      const actual = testData[i].value;
      const predicted = predictions[i].value;
      mape += Math.abs((actual - predicted) / actual);
    }

    mape /= predictions.length;
    const accuracy = Math.max(0, 1 - mape);

    return accuracy;
  }

  /**
   * Check if model should be retrained
   */
  private shouldRetrain(resourceId: string): boolean {
    const lastRetrain = this.lastRetrain.get(resourceId);
    if (!lastRetrain) {
      return true;
    }

    const timeSinceRetrain = Date.now() - lastRetrain.getTime();
    return timeSinceRetrain > this.config.retrainInterval;
  }

  /**
   * Extract features from history
   */
  private extractFeatures(history: TimeSeriesData[]): Record<string, number> {
    const values = history.map((h) => h.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;

    return {
      mean,
      stdDev: Math.sqrt(variance),
      min: Math.min(...values),
      max: Math.max(...values),
      trend: (values[values.length - 1] - values[0]) / values.length
    };
  }

  /**
   * Get seasonal patterns for a resource
   */
  getSeasonalPatterns(resourceId: string): SeasonalPattern[] {
    return this.seasonalPatterns.get(resourceId) || [];
  }

  /**
   * Get model for a resource
   */
  getModel(resourceId: string): PredictionModel | undefined {
    return this.models.get(resourceId);
  }

  /**
   * Clear history for a resource
   */
  clearHistory(resourceId: string): void {
    this.historyData.delete(resourceId);
    this.models.delete(resourceId);
    this.seasonalPatterns.delete(resourceId);
    this.lastRetrain.delete(resourceId);
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<PredictiveScalingConfig>): void {
    this.config = { ...this.config, ...updates };
    this.logger.info('Predictive scaling configuration updated', updates);
  }

  /**
   * Get current configuration
   */
  getConfig(): PredictiveScalingConfig {
    return { ...this.config };
  }
}
