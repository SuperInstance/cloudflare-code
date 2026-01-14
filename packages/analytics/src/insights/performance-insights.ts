/**
 * Performance Insights
 * Automated analysis and insights from performance metrics
 */

import {
  Insight,
  InsightType,
  InsightSeverity,
  InsightData,
  Recommendation,
  AnomalyDetection,
  Anomaly,
  Bottleneck,
  Forecast,
  ForecastPoint,
  TrendAnalysis,
  Seasonality,
  TimeRange,
} from '../types/index.js';
import { RealtimeMonitor } from '../monitoring/realtime-monitor.js';

export interface InsightConfig {
  anomalyDetectionThreshold?: number;
  trendAnalysisWindow?: number;
  forecastHorizon?: number;
  enablePredictions?: boolean;
}

export class PerformanceInsightsService {
  private monitor: RealtimeMonitor;
  private config: InsightConfig;
  private insights: Map<string, Insight> = new Map();
  private history: Map<string, number[]> = new Map();

  constructor(monitor: RealtimeMonitor, config: InsightConfig = {}) {
    this.monitor = monitor;
    this.config = {
      anomalyDetectionThreshold: 3,
      trendAnalysisWindow: 24 * 60 * 60 * 1000, // 24 hours
      forecastHorizon: 7 * 24 * 60 * 60 * 1000, // 7 days
      enablePredictions: true,
      ...config,
    };
  }

  /**
   * Generate insights for all metrics
   */
  async generateInsights(): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Detect anomalies
    const anomalyInsights = await this.detectAnomalies();
    insights.push(...anomalyInsights);

    // Detect bottlenecks
    const bottleneckInsights = await this.detectBottlenecks();
    insights.push(...bottleneckInsights);

    // Analyze trends
    const trendInsights = await this.analyzeTrends();
    insights.push(...trendInsights);

    // Generate forecasts
    if (this.config.enablePredictions) {
      const forecastInsights = await this.generateForecasts();
      insights.push(...forecastInsights);
    }

    // Identify optimization opportunities
    const optimizationInsights = await this.identifyOpportunities();
    insights.push(...optimizationInsights);

    // Store insights
    for (const insight of insights) {
      this.insights.set(insight.id, insight);
    }

    return insights;
  }

  /**
   * Detect anomalies in metrics
   */
  async detectAnomalies(): Promise<Insight[]> {
    const insights: Insight[] = [];
    const metrics = ['request_count', 'response_time', 'error_total', 'cpu_usage', 'memory_usage'];

    for (const metric of metrics) {
      const anomalies = await this.monitor.detectAnomalies(metric, this.config.anomalyDetectionThreshold);

      if (anomalies.length > 0) {
        const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
        const warningAnomalies = anomalies.filter(a => a.severity === 'warning');

        if (criticalAnomalies.length > 0) {
          insights.push(this.createInsight({
            type: 'anomaly',
            severity: 'critical',
            title: `Critical anomalies detected in ${metric}`,
            description: `Detected ${criticalAnomalies.length} critical anomalies in ${metric}`,
            data: {
              metrics: [metric],
              timeRange: {
                start: Date.now() - this.config.trendAnalysisWindow!,
                end: Date.now(),
                duration: this.config.trendAnalysisWindow!,
              },
              affectedComponents: [metric],
              baseline: anomalies[0].expected,
              current: anomalies[anomalies.length - 1].value,
              change: anomalies[anomalies.length - 1].deviation,
            },
            recommendations: [
              {
                priority: 'urgent',
                action: 'Investigate the cause of anomalies immediately',
                expectedImpact: 'Prevent potential system failure',
                effort: 'high',
              },
              {
                priority: 'high',
                action: 'Check recent deployments or configuration changes',
                expectedImpact: 'Identify root cause',
                effort: 'medium',
              },
            ],
            confidence: 0.9,
          }));
        } else if (warningAnomalies.length > 5) {
          insights.push(this.createInsight({
            type: 'anomaly',
            severity: 'warning',
            title: `Multiple anomalies detected in ${metric}`,
            description: `Detected ${warningAnomalies.length} anomalies in ${metric}`,
            data: {
              metrics: [metric],
              timeRange: {
                start: Date.now() - this.config.trendAnalysisWindow!,
                end: Date.now(),
                duration: this.config.trendAnalysisWindow!,
              },
              affectedComponents: [metric],
              baseline: anomalies[0].expected,
              current: anomalies[anomalies.length - 1].value,
              change: anomalies[anomalies.length - 1].deviation,
            },
            recommendations: [
              {
                priority: 'medium',
                action: 'Monitor the situation closely',
                expectedImpact: 'Early detection of issues',
                effort: 'low',
              },
            ],
            confidence: 0.7,
          }));
        }
      }
    }

    return insights;
  }

  /**
   * Detect performance bottlenecks
   */
  async detectBottlenecks(): Promise<Insight[]> {
    const insights: Insight[] = [];
    const metrics = await this.monitor.getPerformanceMetrics();

    // Check CPU bottleneck
    if (metrics.resourceUtilization.cpu > 80) {
      insights.push(this.createInsight({
        type: 'bottleneck',
        severity: metrics.resourceUtilization.cpu > 90 ? 'critical' : 'warning',
        title: 'High CPU usage detected',
        description: `CPU usage is at ${metrics.resourceUtilization.cpu.toFixed(1)}%`,
        data: {
          metrics: ['cpu_usage'],
          timeRange: {
            start: Date.now() - 300000,
            end: Date.now(),
            duration: 300000,
          },
          affectedComponents: ['cpu'],
          baseline: 50,
          current: metrics.resourceUtilization.cpu,
          change: metrics.resourceUtilization.cpu - 50,
        },
        recommendations: [
          {
            priority: 'high',
            action: 'Scale up resources or optimize CPU-intensive operations',
            expectedImpact: 'Reduce CPU usage and improve performance',
            effort: 'medium',
          },
          {
            priority: 'medium',
            action: 'Profile application to identify CPU hotspots',
            expectedImpact: 'Target optimization efforts',
            effort: 'high',
          },
        ],
        confidence: 0.95,
      }));
    }

    // Check memory bottleneck
    if (metrics.resourceUtilization.memory > 80) {
      insights.push(this.createInsight({
        type: 'bottleneck',
        severity: metrics.resourceUtilization.memory > 90 ? 'critical' : 'warning',
        title: 'High memory usage detected',
        description: `Memory usage is at ${metrics.resourceUtilization.memory.toFixed(1)}%`,
        data: {
          metrics: ['memory_usage'],
          timeRange: {
            start: Date.now() - 300000,
            end: Date.now(),
            duration: 300000,
          },
          affectedComponents: ['memory'],
          baseline: 50,
          current: metrics.resourceUtilization.memory,
          change: metrics.resourceUtilization.memory - 50,
        },
        recommendations: [
          {
            priority: 'high',
            action: 'Investigate potential memory leaks or increase memory allocation',
            expectedImpact: 'Prevent out-of-memory errors',
            effort: 'medium',
          },
          {
            priority: 'medium',
            action: 'Review memory allocation patterns and optimize data structures',
            expectedImpact: 'Reduce memory footprint',
            effort: 'high',
          },
        ],
        confidence: 0.95,
      }));
    }

    // Check response time bottleneck
    if (metrics.responseTime.p95 > 2000) {
      insights.push(this.createInsight({
        type: 'bottleneck',
        severity: metrics.responseTime.p95 > 5000 ? 'critical' : 'warning',
        title: 'High response time detected',
        description: `P95 response time is ${metrics.responseTime.p95}ms`,
        data: {
          metrics: ['response_time'],
          timeRange: {
            start: Date.now() - this.config.trendAnalysisWindow!,
            end: Date.now(),
            duration: this.config.trendAnalysisWindow!,
          },
          affectedComponents: ['application'],
          baseline: 500,
          current: metrics.responseTime.p95,
          change: metrics.responseTime.p95 - 500,
        },
        recommendations: [
          {
            priority: 'high',
            action: 'Optimize slow database queries or API calls',
            expectedImpact: 'Reduce response times',
            effort: 'medium',
          },
          {
            priority: 'medium',
            action: 'Implement caching for frequently accessed data',
            expectedImpact: 'Improve response times',
            effort: 'low',
          },
          {
            priority: 'medium',
            action: 'Consider implementing request queuing or rate limiting',
            expectedImpact: 'Prevent overload',
            effort: 'medium',
          },
        ],
        confidence: 0.9,
      }));
    }

    return insights;
  }

  /**
   * Analyze trends
   */
  async analyzeTrends(): Promise<Insight[]> {
    const insights: Insight[] = [];
    const metrics = ['request_count', 'response_time', 'error_total'];

    for (const metric of metrics) {
      const stats = await this.monitor.getMetricStatistics(
        metric,
        this.config.trendAnalysisWindow
      );

      if (stats.trend === 'increasing' && metric === 'response_time') {
        insights.push(this.createInsight({
          type: 'trend',
          severity: 'warning',
          title: `Increasing trend in ${metric}`,
          description: `${metric} has been increasing over the past ${this.config.trendAnalysisWindow! / 3600000} hours`,
          data: {
            metrics: [metric],
            timeRange: {
              start: Date.now() - this.config.trendAnalysisWindow!,
              end: Date.now(),
              duration: this.config.trendAnalysisWindow!,
            },
            affectedComponents: [metric],
            baseline: stats.min,
            current: stats.max,
            change: stats.max - stats.min,
          },
          recommendations: [
            {
              priority: 'medium',
              action: 'Monitor the trend and investigate if it continues',
              expectedImpact: 'Early detection of performance degradation',
              effort: 'low',
            },
            {
              priority: 'low',
              action: 'Review recent changes that might have affected performance',
              expectedImpact: 'Identify potential causes',
              effort: 'medium',
            },
          ],
          confidence: 0.7,
        }));
      } else if (stats.trend === 'increasing' && metric === 'error_total') {
        insights.push(this.createInsight({
          type: 'degradation',
          severity: 'critical',
          title: `Error rate increasing`,
          description: `Error rate has shown an increasing trend`,
          data: {
            metrics: [metric],
            timeRange: {
              start: Date.now() - this.config.trendAnalysisWindow!,
              end: Date.now(),
              duration: this.config.trendAnalysisWindow!,
            },
            affectedComponents: ['application'],
            baseline: stats.min,
            current: stats.max,
            change: stats.max - stats.min,
          },
          recommendations: [
            {
              priority: 'urgent',
              action: 'Investigate the cause of increasing errors immediately',
              expectedImpact: 'Prevent service degradation',
              effort: 'high',
            },
            {
              priority: 'high',
              action: 'Check error logs for patterns and common causes',
              expectedImpact: 'Identify root cause',
              effort: 'medium',
            },
          ],
          confidence: 0.85,
        }));
      }
    }

    return insights;
  }

  /**
   * Generate forecasts
   */
  async generateForecasts(): Promise<Insight[]> {
    const insights: Insight[] = [];
    const metrics = ['request_count', 'response_time'];

    for (const metric of metrics) {
      const forecast = await this.generateForecast(metric, this.config.forecastHorizon!);

      // Check if forecast predicts issues
      const maxPrediction = Math.max(...forecast.predictions.map(p => p.value));

      if (metric === 'response_time' && maxPrediction > 2000) {
        insights.push(this.createInsight({
          type: 'forecast',
          severity: 'warning',
          title: `Forecast: High response times predicted`,
          description: `Response times are predicted to exceed 2000ms in the next ${this.config.forecastHorizon! / 86400000} days`,
          data: {
            metrics: [metric],
            timeRange: {
              start: Date.now(),
              end: Date.now() + this.config.forecastHorizon!,
              duration: this.config.forecastHorizon!,
            },
            affectedComponents: [metric],
            baseline: forecast.predictions[0].value,
            current: forecast.predictions[forecast.predictions.length - 1].value,
            change: forecast.predictions[forecast.predictions.length - 1].value - forecast.predictions[0].value,
          },
          recommendations: [
            {
              priority: 'medium',
              action: 'Prepare scaling strategies for anticipated load',
              expectedImpact: 'Handle increased load gracefully',
              effort: 'medium',
            },
            {
              priority: 'low',
              action: 'Review auto-scaling configuration',
              expectedImpact: 'Ensure automatic scaling',
              effort: 'low',
            },
          ],
          confidence: forecast.accuracy,
        }));
      }
    }

    return insights;
  }

  /**
   * Identify optimization opportunities
   */
  async identifyOpportunities(): Promise<Insight[]> {
    const insights: Insight[] = [];
    const metrics = await this.monitor.getPerformanceMetrics();

    // Check for underutilized resources
    if (metrics.resourceUtilization.cpu < 20) {
      insights.push(this.createInsight({
        type: 'optimization',
        severity: 'info',
        title: 'Low CPU utilization',
        description: 'CPU utilization is consistently low, consider scaling down',
        data: {
          metrics: ['cpu_usage'],
          timeRange: {
            start: Date.now() - this.config.trendAnalysisWindow!,
            end: Date.now(),
            duration: this.config.trendAnalysisWindow!,
          },
          affectedComponents: ['cpu'],
          baseline: 50,
          current: metrics.resourceUtilization.cpu,
          change: metrics.resourceUtilization.cpu - 50,
        },
        recommendations: [
          {
            priority: 'low',
            action: 'Consider reducing allocated CPU resources to optimize costs',
            expectedImpact: 'Reduce infrastructure costs',
            effort: 'low',
          },
        ],
        confidence: 0.8,
      }));
    }

    // Check for caching opportunities
    const cacheHitRatio = await this.calculateCacheHitRatio();
    if (cacheHitRatio < 0.5) {
      insights.push(this.createInsight({
        type: 'optimization',
        severity: 'info',
        title: 'Low cache hit ratio',
        description: `Cache hit ratio is ${(cacheHitRatio * 100).toFixed(1)}%, consider optimizing cache strategy`,
        data: {
          metrics: ['cache_hit_ratio'],
          timeRange: {
            start: Date.now() - this.config.trendAnalysisWindow!,
            end: Date.now(),
            duration: this.config.trendAnalysisWindow!,
          },
          affectedComponents: ['cache'],
          baseline: 0.8,
          current: cacheHitRatio,
          change: cacheHitRatio - 0.8,
        },
        recommendations: [
          {
            priority: 'medium',
            action: 'Review cache key strategy and TTL values',
            expectedImpact: 'Improve cache effectiveness',
            effort: 'medium',
          },
          {
            priority: 'low',
            action: 'Consider increasing cache size or adjusting eviction policies',
            expectedImpact: 'Increase cache hit ratio',
            effort: 'low',
          },
        ],
        confidence: 0.7,
      }));
    }

    return insights;
  }

  /**
   * Get insight by ID
   */
  getInsight(insightId: string): Insight | null {
    return this.insights.get(insightId) || null;
  }

  /**
   * Get all insights
   */
  getInsights(filters?: {
    type?: InsightType;
    severity?: InsightSeverity;
    timeRange?: TimeRange;
  }): Insight[] {
    let insights = Array.from(this.insights.values());

    if (filters?.type) {
      insights = insights.filter(i => i.type === filters.type);
    }

    if (filters?.severity) {
      insights = insights.filter(i => i.severity === filters.severity);
    }

    if (filters?.timeRange) {
      insights = insights.filter(i =>
        i.timestamp >= filters.timeRange!.start &&
        i.timestamp <= filters.timeRange!.end
      );
    }

    return insights.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Clear old insights
   */
  clearInsights(olderThan: number): void {
    for (const [id, insight] of this.insights.entries()) {
      if (insight.timestamp < olderThan) {
        this.insights.delete(id);
      }
    }
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private createInsight(data: {
    type: InsightType;
    severity: InsightSeverity;
    title: string;
    description: string;
    data: InsightData;
    recommendations: Recommendation[];
    confidence: number;
  }): Insight {
    return {
      id: this.generateInsightId(),
      type: data.type,
      severity: data.severity,
      title: data.title,
      description: data.description,
      timestamp: Date.now(),
      data: data.data,
      recommendations: data.recommendations,
      confidence: data.confidence,
    };
  }

  private generateInsightId(): string {
    return `insight-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private async generateForecast(
    metric: string,
    horizon: number
  ): Promise<Forecast> {
    const timeSeries = await this.monitor.getTimeSeries(
      metric,
      {},
      {
        start: Date.now() - this.config.trendAnalysisWindow!,
        end: Date.now(),
      }
    );

    const values = timeSeries.map(d => d.value);
    const predictions = this.simpleLinearForecast(values, horizon);

    return {
      metric,
      horizon,
      predictions,
      confidenceInterval: 0.95,
      method: 'linear_regression',
      accuracy: this.calculateForecastAccuracy(values, predictions),
    };
  }

  private simpleLinearForecast(
    values: number[],
    horizon: number
  ): ForecastPoint[] {
    if (values.length < 2) {
      return [];
    }

    // Calculate linear regression
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, i) => sum + i * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate predictions
    const predictions: ForecastPoint[] = [];
    const now = Date.now();
    const interval = this.config.trendAnalysisWindow! / values.length;

    for (let i = 1; i <= horizon / interval; i++) {
      const value = slope * (n + i) + intercept;
      const stdError = this.calculateStdError(values, slope, intercept);

      predictions.push({
        timestamp: now + i * interval,
        value: Math.max(0, value),
        lower: Math.max(0, value - 1.96 * stdError),
        upper: value + 1.96 * stdError,
      });
    }

    return predictions;
  }

  private calculateStdError(values: number[], slope: number, intercept: number): number {
    const n = values.length;
    let sumSquaredErrors = 0;

    for (let i = 0; i < n; i++) {
      const predicted = slope * i + intercept;
      sumSquaredErrors += Math.pow(values[i] - predicted, 2);
    }

    return Math.sqrt(sumSquaredErrors / (n - 2));
  }

  private calculateForecastAccuracy(
    actual: number[],
    predictions: ForecastPoint[]
  ): number {
    if (actual.length < 2 || predictions.length === 0) {
      return 0.5;
    }

    // Use last few actual values to validate
    const validationSize = Math.min(5, actual.length);
    const validationActual = actual.slice(-validationSize);
    const validationPredicted = predictions.slice(0, validationSize);

    let sumSquaredErrors = 0;
    for (let i = 0; i < validationActual.length; i++) {
      const error = validationActual[i] - validationPredicted[i]?.value;
      sumSquaredErrors += error * error;
    }

    const mse = sumSquaredErrors / validationActual.length;
    const variance = validationActual.reduce((sum, v) => sum + Math.pow(v - this.mean(validationActual), 2), 0) / validationActual.length;

    return Math.max(0, Math.min(1, 1 - mse / variance));
  }

  private async calculateCacheHitRatio(): Promise<number> {
    // This would be calculated from actual cache metrics
    // For now, return a placeholder
    return 0.7;
  }

  private mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
}

// ============================================================================
// Anomaly Detection Algorithms
// ============================================================================

export class AnomalyDetector {
  /**
   * Isolation Forest algorithm for anomaly detection
   */
  static isolationForest(data: number[], contamination: number = 0.1): number[] {
    const scores = data.map(value => {
      // Simplified isolation forest score
      const mean = data.reduce((a, b) => a + b, 0) / data.length;
      const std = Math.sqrt(data.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / data.length);
      const zScore = Math.abs((value - mean) / std);

      return zScore;
    });

    const threshold = this.calculateThreshold(scores, contamination);
    return scores.map((score, i) => (score > threshold ? i : -1)).filter(i => i !== -1);
  }

  /**
   * Statistical anomaly detection using z-score
   */
  static statistical(data: number[], threshold: number = 3): number[] {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const std = Math.sqrt(data.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / data.length);

    return data
      .map((value, i) => (Math.abs((value - mean) / std) > threshold ? i : -1))
      .filter(i => i !== -1);
  }

  /**
   * Moving average anomaly detection
   */
  static movingAverage(data: number[], window: number = 5, threshold: number = 2): number[] {
    const anomalies: number[] = [];

    for (let i = window; i < data.length; i++) {
      const windowData = data.slice(i - window, i);
      const mean = windowData.reduce((a, b) => a + b, 0) / window;
      const std = Math.sqrt(windowData.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / window);
      const zScore = Math.abs((data[i] - mean) / std);

      if (zScore > threshold) {
        anomalies.push(i);
      }
    }

    return anomalies;
  }

  private static calculateThreshold(scores: number[], contamination: number): number {
    const sorted = [...scores].sort((a, b) => b - a);
    const index = Math.floor(scores.length * contamination);
    return sorted[index] || 3;
  }
}
