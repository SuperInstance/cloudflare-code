/**
 * Anomaly Detection Engine
 * Detects anomalies using statistical methods, ML algorithms, and threshold-based detection
 */

import { EventEmitter } from 'eventemitter3';
import {
  Anomaly,
  AnomalyType,
  AnomalySeverity,
  AnomalyDetectorConfig,
  AnomalyAlgorithm,
  AnomalyDetectionResult,
  TimeSeriesData
} from '../types';

export class AnomalyDetector {
  private config: AnomalyDetectorConfig;
  private eventEmitter: EventEmitter;
  private history: Map<string, TimeSeriesData>;
  private anomalies: Map<string, Anomaly[]>;
  private models: Map<string, any>;

  constructor(config: AnomalyDetectorConfig = {
    enabled: true,
    algorithms: ['statistical', 'threshold'],
    sensitivity: 0.95,
    minConfidence: 0.7,
    lookbackWindow: 3600000, // 1 hour
    thresholds: {
      spike: 3.0,
      drop: 3.0,
      trendChange: 2.0
    }
  }) {
    this.config = config;
    this.eventEmitter = new EventEmitter();
    this.history = new Map();
    this.anomalies = new Map();
    this.models = new Map();
  }

  /**
   * Add data point to history
   */
  addDataPoint(metric: string, value: number, timestamp?: number, labels?: Record<string, string>): void {
    if (!this.history.has(metric)) {
      this.history.set(metric, {
        timestamps: [],
        values: [],
        labels
      });
    }

    const data = this.history.get(metric)!;
    const ts = timestamp || Date.now();

    data.timestamps.push(ts);
    data.values.push(value);

    // Trim to lookback window
    const cutoff = ts - this.config.lookbackWindow;
    const keepIndices = data.timestamps
      .map((t, i) => t >= cutoff ? i : -1)
      .filter(i => i >= 0);

    data.timestamps = keepIndices.map(i => data.timestamps[i]);
    data.values = keepIndices.map(i => data.values[i]);

    // Run anomaly detection
    if (this.config.enabled) {
      this.detect(metric);
    }
  }

  /**
   * Detect anomalies for a metric
   */
  detect(metric: string): AnomalyDetectionResult {
    const data = this.history.get(metric);
    if (!data || data.values.length < 10) {
      return {
        detected: false,
        anomalies: [],
        metric,
        timestamp: Date.now(),
        confidence: 0,
        explanation: 'Insufficient data for anomaly detection'
      };
    }

    const detectedAnomalies: Anomaly[] = [];
    const latestValue = data.values[data.values.length - 1];
    const latestTimestamp = data.timestamps[data.timestamps.length - 1];

    // Run all configured algorithms
    for (const algorithm of this.config.algorithms) {
      let anomalies: Anomaly[] = [];

      switch (algorithm) {
        case 'statistical':
          anomalies = this.statisticalDetection(metric, data);
          break;
        case 'threshold':
          anomalies = this.thresholdDetection(metric, data);
          break;
        case 'ml_based':
          anomalies = this.mlBasedDetection(metric, data);
          break;
        case 'seasonal':
          anomalies = this.seasonalDetection(metric, data);
          break;
        case 'ensemble':
          anomalies = this.ensembleDetection(metric, data);
          break;
      }

      detectedAnomalies.push(...anomalies);
    }

    // Filter by confidence and deduplicate
    const filteredAnomalies = this.filterAndDeduplicate(detectedAnomalies);

    // Store anomalies
    if (!this.anomalies.has(metric)) {
      this.anomalies.set(metric, []);
    }
    this.anomalies.get(metric)!.push(...filteredAnomalies);

    // Emit events
    for (const anomaly of filteredAnomalies) {
      this.eventEmitter.emit('anomaly:detected', anomaly);
    }

    const overallConfidence = filteredAnomalies.length > 0
      ? Math.max(...filteredAnomalies.map(a => a.confidence))
      : 0;

    return {
      detected: filteredAnomalies.length > 0,
      anomalies: filteredAnomalies,
      metric,
      timestamp: latestTimestamp,
      confidence: overallConfidence,
      explanation: filteredAnomalies.length > 0
        ? `Detected ${filteredAnomalies.length} anomaly(s)`
        : 'No anomalies detected'
    };
  }

  /**
   * Statistical anomaly detection using z-scores
   */
  private statisticalDetection(metric: string, data: TimeSeriesData): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const values = data.values;
    const n = values.length;

    // Calculate statistics
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    // Check latest value
    const latestValue = values[n - 1];
    const zScore = stdDev > 0 ? (latestValue - mean) / stdDev : 0;
    const absZScore = Math.abs(zScore);

    if (absZScore > this.config.thresholds.spike) {
      const type: AnomalyType = zScore > 0 ? 'spike' : 'drop';
      const severity = this.calculateSeverity(absZScore, 3, 5, 7);

      anomalies.push({
        id: this.generateAnomalyId(),
        type,
        severity,
        metric,
        timestamp: data.timestamps[n - 1],
        value: latestValue,
        expectedValue: mean,
        deviation: absZScore,
        confidence: Math.min(1, absZScore / 5),
        description: `${type === 'spike' ? 'Unusual increase' : 'Unusual decrease'} detected (z-score: ${zScore.toFixed(2)})`,
        context: {
          method: 'statistical',
          mean,
          stdDev,
          zScore
        }
      });
    }

    // Check for trend changes
    if (values.length >= 20) {
      const recentMean = values.slice(-10).reduce((a, b) => a + b, 0) / 10;
      const olderMean = values.slice(-20, -10).reduce((a, b) => a + b, 0) / 10;
      const change = Math.abs(recentMean - olderMean);
      const normalizedChange = stdDev > 0 ? change / stdDev : 0;

      if (normalizedChange > this.config.thresholds.trendChange) {
        anomalies.push({
          id: this.generateAnomalyId(),
          type: 'trend_change',
          severity: this.calculateSeverity(normalizedChange, 2, 3, 4),
          metric,
          timestamp: data.timestamps[n - 1],
          value: latestValue,
          expectedValue: olderMean,
          deviation: normalizedChange,
          confidence: Math.min(1, normalizedChange / 4),
          description: `Significant trend change detected (${normalizedChange.toFixed(2)} standard deviations)`,
          context: {
            method: 'statistical',
            recentMean,
            olderMean,
            change
          }
        });
      }
    }

    return anomalies;
  }

  /**
   * Threshold-based anomaly detection
   */
  private thresholdDetection(metric: string, data: TimeSeriesData): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const values = data.values;
    const n = values.length;

    if (n < 10) {
      return anomalies;
    }

    const latestValue = values[n - 1];

    // Calculate adaptive thresholds using percentiles
    const sorted = [...values].sort((a, b) => a - b);
    const p10 = sorted[Math.floor(n * 0.1)];
    const p90 = sorted[Math.floor(n * 0.9)];
    const iqr = p90 - p10;

    const lowerThreshold = p10 - this.config.thresholds.drop * iqr;
    const upperThreshold = p90 + this.config.thresholds.spike * iqr;

    if (latestValue > upperThreshold) {
      anomalies.push({
        id: this.generateAnomalyId(),
        type: 'spike',
        severity: this.calculateSeverity((latestValue - p90) / iqr, 2, 3, 4),
        metric,
        timestamp: data.timestamps[n - 1],
        value: latestValue,
        expectedValue: p90,
        deviation: (latestValue - p90) / iqr,
        confidence: Math.min(1, (latestValue - p90) / (2 * iqr)),
        description: `Value exceeds upper threshold (${latestValue.toFixed(2)} > ${upperThreshold.toFixed(2)})`,
        context: {
          method: 'threshold',
          upperThreshold,
          lowerThreshold,
          p10,
          p90,
          iqr
        }
      });
    } else if (latestValue < lowerThreshold) {
      anomalies.push({
        id: this.generateAnomalyId(),
        type: 'drop',
        severity: this.calculateSeverity((p10 - latestValue) / iqr, 2, 3, 4),
        metric,
        timestamp: data.timestamps[n - 1],
        value: latestValue,
        expectedValue: p10,
        deviation: (p10 - latestValue) / iqr,
        confidence: Math.min(1, (p10 - latestValue) / (2 * iqr)),
        description: `Value below lower threshold (${latestValue.toFixed(2)} < ${lowerThreshold.toFixed(2)})`,
        context: {
          method: 'threshold',
          upperThreshold,
          lowerThreshold,
          p10,
          p90,
          iqr
        }
      });
    }

    return anomalies;
  }

  /**
   * ML-based anomaly detection using simple forecasting
   */
  private mlBasedDetection(metric: string, data: TimeSeriesData): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const values = data.values;

    if (values.length < 20) {
      return anomalies;
    }

    // Simple exponential smoothing for prediction
    const alpha = 0.3;
    let predicted = values[0];

    for (let i = 1; i < values.length - 1; i++) {
      predicted = alpha * values[i] + (1 - alpha) * predicted;
    }

    const latestValue = values[values.length - 1];
    const predictionError = latestValue - predicted;
    const absError = Math.abs(predictionError);

    // Calculate mean absolute error from history
    const errors: number[] = [];
    let pred = values[0];

    for (let i = 1; i < values.length; i++) {
      pred = alpha * values[i] + (1 - alpha) * pred;
      errors.push(Math.abs(values[i] - pred));
    }

    const meanError = errors.reduce((a, b) => a + b, 0) / errors.length;
    const errorThreshold = meanError * 3;

    if (absError > errorThreshold) {
      const type: AnomalyType = predictionError > 0 ? 'spike' : 'drop';

      anomalies.push({
        id: this.generateAnomalyId(),
        type,
        severity: this.calculateSeverity(absError / meanError, 2, 3, 4),
        metric,
        timestamp: data.timestamps[data.timestamps.length - 1],
        value: latestValue,
        expectedValue: predicted,
        deviation: absError / meanError,
        confidence: Math.min(1, absError / (2 * meanError)),
        description: `Prediction error exceeds threshold (${absError.toFixed(2)} vs ${errorThreshold.toFixed(2)})`,
        context: {
          method: 'ml_based',
          algorithm: 'exponential_smoothing',
          predicted,
          errorThreshold,
          alpha
        }
      });
    }

    return anomalies;
  }

  /**
   * Seasonal anomaly detection
   */
  private seasonalDetection(metric: string, data: TimeSeriesData): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const values = data.values;
    const timestamps = data.timestamps;

    if (values.length < 50) {
      return anomalies;
    }

    // Detect seasonality period using autocorrelation
    const period = this.detectSeasonality(values);
    if (period === 0) {
      return anomalies;
    }

    const latestValue = values[values.length - 1];

    // Calculate expected value based on seasonal pattern
    const seasonalValues: number[] = [];
    for (let i = values.length - period; i < values.length; i += period) {
      if (i >= 0) {
        seasonalValues.push(values[i]);
      }
    }

    if (seasonalValues.length < 3) {
      return anomalies;
    }

    const seasonalMean = seasonalValues.reduce((a, b) => a + b, 0) / seasonalValues.length;
    const seasonalStdDev = Math.sqrt(
      seasonalValues.reduce((sum, v) => sum + Math.pow(v - seasonalMean, 2), 0) / seasonalValues.length
    );

    const deviation = Math.abs(latestValue - seasonalMean);
    const normalizedDeviation = seasonalStdDev > 0 ? deviation / seasonalStdDev : 0;

    if (normalizedDeviation > 2.5) {
      anomalies.push({
        id: this.generateAnomalyId(),
        type: 'seasonal_deviation',
        severity: this.calculateSeverity(normalizedDeviation, 2, 3, 4),
        metric,
        timestamp: timestamps[timestamps.length - 1],
        value: latestValue,
        expectedValue: seasonalMean,
        deviation: normalizedDeviation,
        confidence: Math.min(1, normalizedDeviation / 4),
        description: `Value deviates from seasonal pattern (${normalizedDeviation.toFixed(2)} std devs)`,
        context: {
          method: 'seasonal',
          period,
          seasonalMean,
          seasonalStdDev,
          seasonalValues
        }
      });
    }

    return anomalies;
  }

  /**
   * Ensemble anomaly detection combining multiple methods
   */
  private ensembleDetection(metric: string, data: TimeSeriesData): Anomaly[] {
    const allAnomalies: Anomaly[] = [];

    // Run all detection methods
    allAnomalies.push(...this.statisticalDetection(metric, data));
    allAnomalies.push(...this.thresholdDetection(metric, data));
    allAnomalies.push(...this.mlBasedDetection(metric, data));

    if (this.config.seasonalityPeriod) {
      allAnomalies.push(...this.seasonalDetection(metric, data));
    }

    // Group anomalies by type and aggregate
    const grouped = new Map<AnomalyType, Anomaly[]>();

    for (const anomaly of allAnomalies) {
      if (!grouped.has(anomaly.type)) {
        grouped.set(anomaly.type, []);
      }
      grouped.get(anomaly.type)!.push(anomaly);
    }

    // Create ensemble anomalies
    const ensembleAnomalies: Anomaly[] = [];

    for (const [type, group] of grouped) {
      if (group.length >= 2) {
        // Multiple methods agree - higher confidence
        const avgConfidence = group.reduce((sum, a) => sum + a.confidence, 0) / group.length;
        const maxSeverity = group.reduce((max, a) =>
          this.severityToNumber(a.severity) > this.severityToNumber(max) ? a.severity : max,
          'low' as AnomalySeverity
        );

        ensembleAnomalies.push({
          id: this.generateAnomalyId(),
          type,
          severity: maxSeverity,
          metric,
          timestamp: group[0].timestamp,
          value: group[0].value,
          expectedValue: group[0].expectedValue,
          deviation: group[0].deviation,
          confidence: Math.min(1, avgConfidence * 1.2), // Boost confidence for consensus
          description: `Ensemble detection: ${group.length} methods agree on ${type}`,
          relatedAnomalies: group.map(a => a.id),
          context: {
            method: 'ensemble',
            algorithms: group.map(a => (a.context as any).method),
            votes: group.length
          }
        });
      }
    }

    return ensembleAnomalies;
  }

  /**
   * Filter anomalies by confidence and deduplicate
   */
  private filterAndDeduplicate(anomalies: Anomaly[]): Anomaly[] {
    // Filter by minimum confidence
    let filtered = anomalies.filter(a => a.confidence >= this.config.minConfidence);

    // Deduplicate by type and metric
    const seen = new Set<string>();
    filtered = filtered.filter(a => {
      const key = `${a.metric}:${a.type}:${Math.floor(a.timestamp / 1000)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    return filtered;
  }

  /**
   * Detect seasonality period using autocorrelation
   */
  private detectSeasonality(values: number[]): number {
    const maxPeriod = Math.min(100, Math.floor(values.length / 2));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;

    let bestPeriod = 0;
    let bestCorrelation = 0;

    for (let period = 5; period <= maxPeriod; period++) {
      let correlation = 0;
      let count = 0;

      for (let i = period; i < values.length; i++) {
        correlation += (values[i] - mean) * (values[i - period] - mean);
        count++;
      }

      if (count > 0) {
        correlation /= count;
        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestPeriod = period;
        }
      }
    }

    return bestCorrelation > 0.3 ? bestPeriod : 0;
  }

  /**
   * Calculate severity based on deviation
   */
  private calculateSeverity(
    deviation: number,
    lowThreshold: number,
    mediumThreshold: number,
    highThreshold: number
  ): AnomalySeverity {
    if (deviation >= highThreshold) return 'critical';
    if (deviation >= mediumThreshold) return 'high';
    if (deviation >= lowThreshold) return 'medium';
    return 'low';
  }

  /**
   * Convert severity to number for comparison
   */
  private severityToNumber(severity: AnomalySeverity): number {
    const levels = { low: 1, medium: 2, high: 3, critical: 4 };
    return levels[severity];
  }

  /**
   * Get anomalies for a metric
   */
  getAnomalies(metric: string, limit?: number): Anomaly[] {
    const anomalies = this.anomalies.get(metric) || [];
    return limit ? anomalies.slice(-limit) : anomalies;
  }

  /**
   * Get all anomalies
   */
  getAllAnomalies(): Map<string, Anomaly[]> {
    return this.anomalies;
  }

  /**
   * Clear history for a metric
   */
  clearHistory(metric: string): void {
    this.history.delete(metric);
    this.anomalies.delete(metric);
  }

  /**
   * Clear all history
   */
  clearAll(): void {
    this.history.clear();
    this.anomalies.clear();
    this.models.clear();
  }

  /**
   * Generate a unique anomaly ID
   */
  private generateAnomalyId(): string {
    return `anomaly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Register event listener
   */
  on(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  /**
   * Remove event listener
   */
  off(event: string, listener: (...args: unknown[]) => void): void {
    this.eventEmitter.off(event, listener);
  }
}
