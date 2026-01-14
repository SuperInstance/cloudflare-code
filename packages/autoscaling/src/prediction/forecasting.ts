/**
 * Time series forecasting for predictive scaling
 */

import type { TimeSeriesData, PredictionPoint } from '../types/index.js';
import { Logger } from '@claudeflare/logger';

export interface ForecastConfig {
  method: ForecastMethod;
  windowSize: number;
  forecastHorizon: number;
  confidenceLevel: number;
  seasonalityEnabled: boolean;
}

export enum ForecastMethod {
  MOVING_AVERAGE = 'moving_average',
  EXPONENTIAL_SMOOTHING = 'exponential_smoothing',
  ARIMA = 'arima',
  LSTM = 'lstm',
  PROPHET = 'prophet',
  ENSEMBLE = 'ensemble'
}

export class TimeSeriesForecaster {
  private logger: Logger;
  private config: ForecastConfig;

  constructor(config: Partial<ForecastConfig> = {}) {
    this.logger = new Logger('TimeSeriesForecaster');
    this.config = {
      method: ForecastMethod.EXPONENTIAL_SMOOTHING,
      windowSize: 20,
      forecastHorizon: 60,
      confidenceLevel: 0.95,
      seasonalityEnabled: true,
      ...config
    };
  }

  /**
   * Generate forecast
   */
  forecast(data: TimeSeriesData[]): PredictionPoint[] {
    if (data.length < this.config.windowSize) {
      throw new Error(
        `Insufficient data for forecast. Need at least ${this.config.windowSize} points.`
      );
    }

    switch (this.config.method) {
      case ForecastMethod.MOVING_AVERAGE:
        return this.movingAverageForecast(data);

      case ForecastMethod.EXPONENTIAL_SMOOTHING:
        return this.exponentialSmoothingForecast(data);

      case ForecastMethod.ARIMA:
        return this.arimaForecast(data);

      case ForecastMethod.LSTM:
        return this.lstmForecast(data);

      case ForecastMethod.PROPHET:
        return this.prophetForecast(data);

      case ForecastMethod.ENSEMBLE:
        return this.ensembleForecast(data);

      default:
        return this.exponentialSmoothingForecast(data);
    }
  }

  /**
   * Moving average forecast
   */
  private movingAverageForecast(data: TimeSeriesData[]): PredictionPoint[] {
    const values = data.map((d) => d.value);
    const window = values.slice(-this.config.windowSize);

    const simpleMA = window.reduce((sum, v) => sum + v, 0) / window.length;

    // Calculate standard deviation for confidence intervals
    const variance = window.reduce((sum, v) => sum + Math.pow(v - simpleMA, 2), 0) / window.length;
    const stdDev = Math.sqrt(variance);

    const zScore = this.getZScore(this.config.confidenceLevel);
    const points: PredictionPoint[] = [];
    const lastTimestamp = data[data.length - 1].timestamp;

    for (let i = 1; i <= this.config.forecastHorizon; i++) {
      const timestamp = new Date(lastTimestamp.getTime() + i * 60000);

      points.push({
        timestamp,
        value: simpleMA,
        lowerBound: Math.max(0, simpleMA - zScore * stdDev),
        upperBound: simpleMA + zScore * stdDev,
        confidence: 0.7
      });
    }

    return points;
  }

  /**
   * Exponential smoothing forecast (Holt-Winters)
   */
  private exponentialSmoothingForecast(data: TimeSeriesData[]): PredictionPoint[] {
    const values = data.map((d) => d.value);
    const alpha = 0.3; // Level smoothing
    const beta = 0.1; // Trend smoothing
    const gamma = 0.1; // Seasonal smoothing

    let level = values[0];
    let trend = 0;
    const seasonal: number[] = [];

    // Initialize seasonal components
    const seasonLength = 24; // Daily seasonality
    for (let i = 0; i < seasonLength; i++) {
      seasonal.push(1);
    }

    // Fit model
    for (let i = 1; i < values.length; i++) {
      const prevLevel = level;
      level = alpha * (values[i] - seasonal[i % seasonLength]) + (1 - alpha) * (prevLevel + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
      seasonal[i % seasonLength] =
        gamma * (values[i] - level) + (1 - gamma) * seasonal[i % seasonLength];
    }

    // Forecast
    const points: PredictionPoint[] = [];
    const lastTimestamp = data[data.length - 1].timestamp;

    for (let i = 1; i <= this.config.forecastHorizon; i++) {
      const timestamp = new Date(lastTimestamp.getTime() + i * 60000);
      const value = level + trend * i + seasonal[i % seasonLength];

      // Calculate confidence (decreases with horizon)
      const confidence = Math.max(0.3, 0.95 - i * 0.01);

      // Estimate bounds
      const uncertainty = Math.sqrt(i) * Math.abs(trend) * 2;
      points.push({
        timestamp,
        value: Math.max(0, value),
        lowerBound: Math.max(0, value - uncertainty),
        upperBound: value + uncertainty,
        confidence
      });
    }

    return points;
  }

  /**
   * ARIMA forecast
   */
  private arimaForecast(data: TimeSeriesData[]): PredictionPoint[] {
    const values = data.map((d) => d.value);

    // Difference the data
    const diffed = [];
    for (let i = 1; i < values.length; i++) {
      diffed.push(values[i] - values[i - 1]);
    }

    // Fit AR(1) model
    const n = diffed.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (let i = 1; i < n; i++) {
      sumX += diffed[i - 1];
      sumY += diffed[i];
      sumXY += diffed[i - 1] * diffed[i];
      sumXX += diffed[i - 1] * diffed[i - 1];
    }

    const ar = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const mean = sumY / n;

    // Calculate residual standard error
    let sse = 0;
    for (let i = 1; i < n; i++) {
      const predicted = ar * (diffed[i - 1] - mean) + mean;
      sse += Math.pow(diffed[i] - predicted, 2);
    }

    const stdError = Math.sqrt(sse / (n - 2));

    // Forecast
    const points: PredictionPoint[] = [];
    const lastTimestamp = data[data.length - 1].timestamp;
    let lastDiff = diffed[diffed.length - 1];
    let lastValue = values[values.length - 1];

    for (let i = 1; i <= this.config.forecastHorizon; i++) {
      const timestamp = new Date(lastTimestamp.getTime() + i * 60000);

      // Predict next difference
      const nextDiff = ar * (lastDiff - mean) + mean;
      lastValue += nextDiff;
      lastDiff = nextDiff;

      const confidence = Math.max(0.4, 0.95 - i * 0.008);
      const zScore = this.getZScore(this.config.confidenceLevel);

      points.push({
        timestamp,
        value: Math.max(0, lastValue),
        lowerBound: Math.max(0, lastValue - zScore * stdError),
        upperBound: lastValue + zScore * stdError,
        confidence
      });
    }

    return points;
  }

  /**
   * LSTM-style forecast (simplified sliding window)
   */
  private lstmForecast(data: TimeSeriesData[]): PredictionPoint[] {
    const values = data.map((d) => d.value);
    const windowSize = Math.min(10, Math.floor(values.length / 3));
    const points: PredictionPoint[] = [];
    const lastTimestamp = data[data.length - 1].timestamp;

    // Normalize data
    const min = Math.min(...values);
    const max = Math.max(...values);
    const normalized = values.map((v) => (v - min) / (max - min || 1));

    // Create sliding windows
    let window = normalized.slice(-windowSize);

    for (let i = 1; i <= this.config.forecastHorizon; i++) {
      // Predict using weighted average of window
      const weights = Array.from({ length: windowSize }, (_, j) => (j + 1) / windowSize);
      const sumWeights = weights.reduce((sum, w) => sum + w, 0);

      let nextValue = 0;
      for (let j = 0; j < windowSize; j++) {
        nextValue += window[j] * weights[j];
      }
      nextValue /= sumWeights;

      // Update window
      window = [...window.slice(1), nextValue];

      // Denormalize
      const denormalizedValue = nextValue * (max - min) + min;

      const confidence = Math.max(0.3, 0.9 - i * 0.015);
      const uncertainty = (max - min) * 0.1 * Math.sqrt(i);

      points.push({
        timestamp: new Date(lastTimestamp.getTime() + i * 60000),
        value: Math.max(0, denormalizedValue),
        lowerBound: Math.max(0, denormalizedValue - uncertainty),
        upperBound: denormalizedValue + uncertainty,
        confidence
      });
    }

    return points;
  }

  /**
   * Prophet-style forecast with trend and seasonality
   */
  private prophetForecast(data: TimeSeriesData[]): PredictionPoint[] {
    // Extract components
    const trend = this.extractTrend(data);
    const weekly = this.extractWeeklySeasonality(data);
    const daily = this.extractDailySeasonality(data);

    // Calculate residuals
    const residuals: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const trendValue = trend.slope * i + trend.intercept;
      const weeklyValue = weekly[data[i].timestamp.getDay()] || 0;
      const dailyValue = daily[data[i].timestamp.getHours()] || 0;
      residuals.push(data[i].value - trendValue - weeklyValue - dailyValue);
    }

    // Calculate residual standard deviation
    const residualStd = Math.sqrt(
      residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length
    );

    const zScore = this.getZScore(this.config.confidenceLevel);
    const points: PredictionPoint[] = [];
    const lastTimestamp = data[data.length - 1].timestamp;

    for (let i = 1; i <= this.config.forecastHorizon; i++) {
      const timestamp = new Date(lastTimestamp.getTime() + i * 60000);
      const dataIndex = data.length + i;

      // Calculate components
      const trendValue = trend.slope * dataIndex + trend.intercept;
      const weeklyValue = weekly[timestamp.getDay()] || 0;
      const dailyValue = daily[timestamp.getHours()] || 0;

      const value = trendValue + weeklyValue + dailyValue;
      const confidence = Math.max(0.4, 0.95 - i * 0.005);

      points.push({
        timestamp,
        value: Math.max(0, value),
        lowerBound: Math.max(0, value - zScore * residualStd),
        upperBound: value + zScore * residualStd,
        confidence
      });
    }

    return points;
  }

  /**
   * Ensemble forecast combining multiple methods
   */
  private ensembleForecast(data: TimeSeriesData[]): PredictionPoint[] {
    // Get forecasts from multiple methods
    const maForecast = this.movingAverageForecast(data);
    const esForecast = this.exponentialSmoothingForecast(data);
    const arimaForecast = this.arimaForecast(data);

    const points: PredictionPoint[] = [];

    for (let i = 0; i < this.config.forecastHorizon; i++) {
      // Weighted average (equal weights for now)
      const weights = [0.3, 0.4, 0.3];
      const value =
        maForecast[i].value * weights[0] +
        esForecast[i].value * weights[1] +
        arimaForecast[i].value * weights[2];

      // Combine confidence intervals
      const confidence =
        (maForecast[i].confidence + esForecast[i].confidence + arimaForecast[i].confidence) / 3;

      points.push({
        timestamp: maForecast[i].timestamp,
        value,
        lowerBound: Math.max(0, value * 0.8),
        upperBound: value * 1.2,
        confidence
      });
    }

    return points;
  }

  /**
   * Extract trend from time series
   */
  private extractTrend(data: TimeSeriesData[]): { slope: number; intercept: number } {
    const n = data.length;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += data[i].value;
      sumXY += i * data[i].value;
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  /**
   * Extract weekly seasonality
   */
  private extractWeeklySeasonality(data: TimeSeriesData[]): Map<number, number> {
    const weeklyData = new Map<number, number[]>();
    const trend = this.extractTrend(data);

    for (let i = 0; i < data.length; i++) {
      const day = data[i].timestamp.getDay();
      const detrended = data[i].value - (trend.slope * i + trend.intercept);

      if (!weeklyData.has(day)) {
        weeklyData.set(day, []);
      }
      weeklyData.get(day)!.push(detrended);
    }

    const weeklyAvg = new Map<number, number>();
    for (const [day, values] of weeklyData) {
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
      weeklyAvg.set(day, avg);
    }

    return weeklyAvg;
  }

  /**
   * Extract daily seasonality
   */
  private extractDailySeasonality(data: TimeSeriesData[]): Map<number, number> {
    const hourlyData = new Map<number, number[]>();
    const trend = this.extractTrend(data);

    for (let i = 0; i < data.length; i++) {
      const hour = data[i].timestamp.getHours();
      const detrended = data[i].value - (trend.slope * i + trend.intercept);

      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, []);
      }
      hourlyData.get(hour)!.push(detrended);
    }

    const hourlyAvg = new Map<number, number>();
    for (const [hour, values] of hourlyData) {
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
      hourlyAvg.set(hour, avg);
    }

    return hourlyAvg;
  }

  /**
   * Get z-score for confidence level
   */
  private getZScore(confidenceLevel: number): number {
    const zScores: Record<number, number> = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576
    };
    return zScores[confidenceLevel] || 1.96;
  }

  /**
   * Calculate forecast accuracy
   */
  calculateAccuracy(
    actual: TimeSeriesData[],
    forecast: PredictionPoint[]
  ): { mape: number; rmse: number; mae: number } {
    const n = Math.min(actual.length, forecast.length);

    let mape = 0;
    let sse = 0;
    let mae = 0;

    for (let i = 0; i < n; i++) {
      const a = actual[i].value;
      const f = forecast[i].value;

      mape += Math.abs((a - f) / a);
      sse += Math.pow(a - f, 2);
      mae += Math.abs(a - f);
    }

    return {
      mape: (mape / n) * 100,
      rmse: Math.sqrt(sse / n),
      mae: mae / n
    };
  }

  /**
   * Detect change points in time series
   */
  detectChangePoints(data: TimeSeriesData[], threshold: number = 2): number[] {
    if (data.length < 20) {
      return [];
    }

    const changePoints: number[] = [];
    const values = data.map((d) => d.value);

    // Use moving window to detect changes
    const windowSize = 10;
    for (let i = windowSize; i < values.length - windowSize; i++) {
      const before = values.slice(i - windowSize, i);
      const after = values.slice(i, i + windowSize);

      const beforeMean = before.reduce((sum, v) => sum + v, 0) / before.length;
      const afterMean = after.reduce((sum, v) => sum + v, 0) / after.length;

      const beforeStd = Math.sqrt(
        before.reduce((sum, v) => sum + Math.pow(v - beforeMean, 2), 0) / before.length
      );
      const afterStd = Math.sqrt(
        after.reduce((sum, v) => sum + Math.pow(v - afterMean, 2), 0) / after.length
      );

      // Z-test for difference in means
      const pooledStd = Math.sqrt(
        (Math.pow(beforeStd, 2) + Math.pow(afterStd, 2)) / 2
      );
      const zScore = Math.abs(afterMean - beforeMean) / pooledStd;

      if (zScore > threshold) {
        changePoints.push(i);
      }
    }

    return changePoints;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ForecastConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): ForecastConfig {
    return { ...this.config };
  }
}
