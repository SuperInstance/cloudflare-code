import {
  CircuitMetrics,
  PredictiveModel,
  WindowDataPoint,
  CircuitState,
} from '../types/index.js';
import { SlidingWindow } from '../utils/window.js';

/**
 * Fault Detection Result
 */
export interface FaultDetectionResult {
  /** Whether a fault is detected */
  faultDetected: boolean;
  /** Confidence in detection (0-1) */
  confidence: number;
  /** Predicted probability of failure (0-1) */
  failureProbability: number;
  /** Estimated time until failure (ms, or Infinity if not predicted) */
  timeUntilFailure: number;
  /** Detected issues */
  issues: DetectedIssue[];
  /** Recommendations */
  recommendations: string[];
}

/**
 * Detected issue details
 */
export interface DetectedIssue {
  /** Issue type */
  type: string;
  /** Severity (0-1) */
  severity: number;
  /** Description */
  description: string;
  /** Evidence */
  evidence: Record<string, unknown>;
}

/**
 * Configuration for fault detector
 */
export interface FaultDetectorConfig {
  /** Whether to enable predictive detection */
  enablePredictive: boolean;
  /** Threshold for anomaly detection */
  anomalyThreshold: number;
  /** Window size for pattern analysis */
  patternWindowSize: number;
  /** Minimum confidence for predictions */
  minConfidence: number;
  /** Learning rate for adaptive thresholds */
  learningRate: number;
  /** Whether to enable trend analysis */
  enableTrendAnalysis: boolean;
  /** Threshold for trend detection (0-1) */
  trendThreshold: number;
}

/**
 * Advanced Fault Detector
 * Detects and predicts failures using multiple techniques
 */
export class FaultDetector {
  private config: FaultDetectorConfig;
  private baselineMetrics: CircuitMetrics | null;
  private historicalData: WindowDataPoint[];
  private anomalyScores: number[];
  private adaptiveThresholds: Map<string, number>;
  private trendData: Map<string, number[]>;
  private lastPredictionTime: number;
  private lastPrediction: PredictiveModel | null;

  constructor(config: FaultDetectorConfig) {
    this.config = config;
    this.baselineMetrics = null;
    this.historicalData = [];
    this.anomalyScores = [];
    this.adaptiveThresholds = new Map();
    this.trendData = new Map();
    this.lastPredictionTime = 0;
    this.lastPrediction = null;
  }

  /**
   * Detect faults in current metrics
   */
  detect(metrics: CircuitMetrics, state: CircuitState): FaultDetectionResult {
    const issues: DetectedIssue[] = [];
    const recommendations: string[] = [];

    // Skip prediction if circuit is already open or isolated
    if (state === CircuitState.OPEN || state === CircuitState.ISOLATED) {
      return {
        faultDetected: true,
        confidence: 1.0,
        failureProbability: 1.0,
        timeUntilFailure: 0,
        issues: [
          {
            type: 'circuit_open',
            severity: 1.0,
            description: 'Circuit is already open',
            evidence: { state },
          },
        ],
        recommendations: ['Wait for timeout before attempting recovery'],
      };
    }

    // Check error rate
    if (metrics.errorRate > 50) {
      issues.push({
        type: 'high_error_rate',
        severity: metrics.errorRate / 100,
        description: `Error rate is ${metrics.errorRate.toFixed(2)}%`,
        evidence: { errorRate: metrics.errorRate },
      });
      recommendations.push('Consider opening circuit due to high error rate');
    }

    // Check slow calls
    if (metrics.slowCallRate > 30) {
      issues.push({
        type: 'high_slow_call_rate',
        severity: metrics.slowCallRate / 100,
        description: `Slow call rate is ${metrics.slowCallRate.toFixed(2)}%`,
        evidence: { slowCallRate: metrics.slowCallRate },
      });
      recommendations.push('Service is experiencing high latency');
    }

    // Check average duration
    if (metrics.averageDuration > 5000) {
      issues.push({
        type: 'high_latency',
        severity: Math.min(metrics.averageDuration / 10000, 1),
        description: `Average duration is ${metrics.averageDuration.toFixed(2)}ms`,
        evidence: { averageDuration: metrics.averageDuration },
      });
      recommendations.push('Service is responding slowly');
    }

    // Check p99 duration
    if (metrics.p99Duration > 10000) {
      issues.push({
        type: 'high_p99_latency',
        severity: Math.min(metrics.p99Duration / 20000, 1),
        description: `P99 duration is ${metrics.p99Duration.toFixed(2)}ms`,
        evidence: { p99Duration: metrics.p99Duration },
      });
      recommendations.push('Tail latency is very high');
    }

    // Perform anomaly detection
    const anomalyScore = this.detectAnomaly(metrics);
    if (anomalyScore > this.config.anomalyThreshold) {
      issues.push({
        type: 'anomaly_detected',
        severity: anomalyScore,
        description: 'Anomalous behavior detected',
        evidence: { anomalyScore },
      });
      recommendations.push('Unusual pattern detected, investigate further');
    }

    // Perform trend analysis
    if (this.config.enableTrendAnalysis) {
      const trendIssues = this.analyzeTrends(metrics);
      issues.push(...trendIssues);
    }

    // Perform predictive analysis
    let failureProbability = 0;
    let timeUntilFailure = Infinity;

    if (this.config.enablePredictive && Date.now() - this.lastPredictionTime > 5000) {
      const prediction = this.predictFailure(metrics);
      this.lastPrediction = prediction;
      this.lastPredictionTime = Date.now();

      failureProbability = prediction.failureProbability;
      timeUntilFailure = prediction.timeUntilFailure;

      if (failureProbability > 0.7 && prediction.confidence > this.config.minConfidence) {
        issues.push({
          type: 'predicted_failure',
          severity: failureProbability,
          description: `High probability of failure (${(failureProbability * 100).toFixed(2)}%)`,
          evidence: {
            failureProbability,
            confidence: prediction.confidence,
            timeUntilFailure,
          },
        });
        recommendations.push('Proactive action recommended: open circuit');
      }
    }

    // Calculate overall confidence
    const confidence = this.calculateConfidence(issues, metrics);

    // Determine if fault is detected
    const faultDetected =
      issues.length > 0 &&
      issues.some((issue) => issue.severity > 0.5) &&
      confidence > this.config.minConfidence;

    return {
      faultDetected,
      confidence,
      failureProbability: Math.max(failureProbability, faultDetected ? 0.8 : 0),
      timeUntilFailure,
      issues,
      recommendations: recommendations.length > 0 ? recommendations : ['No action required'],
    };
  }

  /**
   * Detect anomalies in metrics
   */
  private detectAnomaly(metrics: CircuitMetrics): number {
    if (!this.baselineMetrics) {
      this.baselineMetrics = metrics;
      return 0;
    }

    const baseline = this.baselineMetrics;
    let anomalyScore = 0;

    // Compare error rate
    const errorRateDiff = Math.abs(metrics.errorRate - baseline.errorRate);
    if (baseline.errorRate > 0) {
      anomalyScore += errorRateDiff / baseline.errorRate;
    }

    // Compare average duration
    const durationDiff = Math.abs(metrics.averageDuration - baseline.averageDuration);
    if (baseline.averageDuration > 0) {
      anomalyScore += durationDiff / baseline.averageDuration;
    }

    // Compare slow call rate
    const slowCallDiff = Math.abs(metrics.slowCallRate - baseline.slowCallRate);
    if (baseline.slowCallRate > 0) {
      anomalyScore += slowCallDiff / baseline.slowCallRate;
    }

    // Normalize score
    return Math.min(anomalyScore / 3, 1);
  }

  /**
   * Analyze trends in metrics
   */
  private analyzeTrends(metrics: CircuitMetrics): DetectedIssue[] {
    const issues: DetectedIssue[] = [];

    // Store current metrics for trend analysis
    this.trendData.set('errorRate', [
      ...(this.trendData.get('errorRate') || []).slice(-9),
      metrics.errorRate,
    ]);
    this.trendData.set('averageDuration', [
      ...(this.trendData.get('averageDuration') || []).slice(-9),
      metrics.averageDuration,
    ]);

    // Check error rate trend
    const errorRateTrend = this.trendData.get('errorRate') || [];
    if (errorRateTrend.length >= 5) {
      const trend = this.calculateTrend(errorRateTrend);
      if (trend > this.config.trendThreshold) {
        issues.push({
          type: 'error_rate_trend',
          severity: trend,
          description: 'Error rate is increasing',
          evidence: { trend, values: errorRateTrend },
        });
      }
    }

    // Check duration trend
    const durationTrend = this.trendData.get('averageDuration') || [];
    if (durationTrend.length >= 5) {
      const trend = this.calculateTrend(durationTrend);
      if (trend > this.config.trendThreshold) {
        issues.push({
          type: 'latency_trend',
          severity: trend,
          description: 'Latency is increasing',
          evidence: { trend, values: durationTrend },
        });
      }
    }

    return issues;
  }

  /**
   * Calculate trend direction and magnitude
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    // Calculate linear regression slope
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Normalize by mean value
    const mean = sumY / n;
    return mean > 0 ? Math.abs(slope / mean) : 0;
  }

  /**
   * Predict future failure probability
   */
  private predictFailure(metrics: CircuitMetrics): PredictiveModel {
    const features: string[] = [];
    let failureProbability = 0;
    let timeUntilFailure = Infinity;

    // Feature 1: Error rate trend
    const errorRateTrend = this.trendData.get('errorRate');
    if (errorRateTrend && errorRateTrend.length >= 3) {
      features.push('error_rate_trend');
      const recentIncrease = this.calculateRecentIncrease(errorRateTrend);
      failureProbability += recentIncrease * 0.3;
    }

    // Feature 2: Latency trend
    const latencyTrend = this.trendData.get('averageDuration');
    if (latencyTrend && latencyTrend.length >= 3) {
      features.push('latency_trend');
      const recentIncrease = this.calculateRecentIncrease(latencyTrend);
      failureProbability += recentIncrease * 0.25;
    }

    // Feature 3: Current error rate
    features.push('current_error_rate');
    failureProbability += (metrics.errorRate / 100) * 0.2;

    // Feature 4: Current slow call rate
    features.push('slow_call_rate');
    failureProbability += (metrics.slowCallRate / 100) * 0.15;

    // Feature 5: P99 latency
    features.push('p99_latency');
    if (metrics.p99Duration > 5000) {
      failureProbability += 0.1;
    }

    // Calculate confidence based on data availability
    const confidence = Math.min(features.length / 5, 1);

    // Estimate time until failure based on trends
    if (failureProbability > 0.5) {
      const rateOfIncrease = this.calculateRateOfIncrease();
      if (rateOfIncrease > 0) {
        const remainingCapacity = 1 - failureProbability;
        timeUntilFailure = (remainingCapacity / rateOfIncrease) * 10000; // Estimate in ms
      }
    }

    return {
      failureProbability: Math.min(failureProbability, 1),
      confidence,
      timeUntilFailure,
      features,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate recent increase in values
   */
  private calculateRecentIncrease(values: number[]): number {
    if (values.length < 2) return 0;

    const recent = values.slice(-3);
    const older = values.slice(-6, -3);

    if (older.length === 0) return 0;

    const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
    const olderAvg = older.reduce((sum, v) => sum + v, 0) / older.length;

    if (olderAvg === 0) return recentAvg > 0 ? 1 : 0;

    return Math.max(0, (recentAvg - olderAvg) / olderAvg);
  }

  /**
   * Calculate rate of increase for failure prediction
   */
  private calculateRateOfIncrease(): number {
    const errorRateTrend = this.trendData.get('errorRate');
    if (!errorRateTrend || errorRateTrend.length < 3) return 0;

    const increases: number[] = [];
    for (let i = 1; i < errorRateTrend.length; i++) {
      if (errorRateTrend[i - 1] > 0) {
        increases.push((errorRateTrend[i] - errorRateTrend[i - 1]) / errorRateTrend[i - 1]);
      }
    }

    if (increases.length === 0) return 0;

    return increases.reduce((sum, inc) => sum + inc, 0) / increases.length;
  }

  /**
   * Calculate confidence in detection
   */
  private calculateConfidence(issues: DetectedIssue[], metrics: CircuitMetrics): number {
    if (issues.length === 0) return 0;

    // More issues = higher confidence
    const issueCount = issues.length;
    const issueConfidence = Math.min(issueCount / 3, 1);

    // Higher severity = higher confidence
    const avgSeverity =
      issues.reduce((sum, issue) => sum + issue.severity, 0) / issues.length;

    // More data points = higher confidence
    const dataConfidence = Math.min(metrics.totalRequests / 100, 1);

    return (issueConfidence * 0.4 + avgSeverity * 0.4 + dataConfidence * 0.2);
  }

  /**
   * Update baseline metrics
   */
  updateBaseline(metrics: CircuitMetrics): void {
    // Only update if current metrics look healthy
    if (metrics.errorRate < 5 && metrics.slowCallRate < 10) {
      this.baselineMetrics = metrics;
    }
  }

  /**
   * Reset detector state
   */
  reset(): void {
    this.baselineMetrics = null;
    this.historicalData = [];
    this.anomalyScores = [];
    this.adaptiveThresholds.clear();
    this.trendData.clear();
    this.lastPrediction = null;
    this.lastPredictionTime = 0;
  }

  /**
   * Get last prediction
   */
  getLastPrediction(): PredictiveModel | null {
    return this.lastPrediction;
  }

  /**
   * Get adaptive threshold
   */
  getAdaptiveThreshold(key: string): number {
    return this.adaptiveThresholds.get(key) || 0;
  }

  /**
   * Update adaptive threshold
   */
  updateAdaptiveThreshold(key: string, value: number): void {
    const current = this.adaptiveThresholds.get(key) || value;
    const updated = current + (value - current) * this.config.learningRate;
    this.adaptiveThresholds.set(key, updated);
  }
}
