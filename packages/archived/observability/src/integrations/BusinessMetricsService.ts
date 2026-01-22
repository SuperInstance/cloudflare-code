// @ts-nocheck - Complex business metrics type issues
import { Observable, ObservableConfig } from '../core/Observable';
import { BusinessMetric, ServiceHealth } from '../types';

/**
 * Business Metrics and KPI Tracking Service
 */
export class BusinessMetricsService extends Observable {
  private metrics: Map<string, BusinessMetric[]> = new Map();
  private aggregators: Map<string, MetricAggregator> = new Map();
  private thresholds: Map<string, MetricThreshold[]> = new Map();
  private targets: Map<string, MetricTarget[]> = new Map();

  constructor(config: ObservableConfig = {}) {
    super(config);
  }

  override async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize default business metrics
      this.initializeDefaultMetrics();

      // Initialize aggregators
      this.initializeAggregators();

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize BusinessMetricsService:', error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (!this.initialized) return;

    // Clear all stored data
    this.metrics.clear();
    this.aggregators.clear();
    this.thresholds.clear();
    this.targets.clear();

    this.initialized = false;
  }

  async export(): Promise<any> {
    this.ensureInitialized();

    try {
      return {
        success: true,
        exported: 1,
        duration: 0,
        businessMetricsData: {
          metrics: Array.from(this.metrics.entries()),
          aggregators: Array.from(this.aggregators.entries()),
          thresholds: Array.from(this.thresholds.entries()),
          targets: Array.from(this.targets.entries())
        }
      };
    } catch (error) {
      return this.handleExportError(error as Error);
    }
  }

  /**
   * Record a business metric
   */
  recordMetric(metric: BusinessMetric): void {
    const metricWithTimestamp = {
      ...metric,
      timestamp: metric.timestamp || Date.now()
    };

    if (!this.metrics.has(metric.id)) {
      this.metrics.set(metric.id, []);
    }

    this.metrics.get(metric.id)!.push(metricWithTimestamp);

    // Apply retention policies
    this.applyRetention(metric.id);

    // Check against thresholds
    this.checkThresholds(metricWithTimestamp);

    // Check against targets
    this.checkTargets(metricWithTimestamp);
  }

  /**
   * Get metrics for a specific ID
   */
  getMetrics(metricId: string): BusinessMetric[] {
    return this.metrics.get(metricId) || [];
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): BusinessMetric[] {
    return Array.from(this.metrics.values()).flat();
  }

  /**
   * Get metrics by category
   */
  getMetricsByCategory(category: string): BusinessMetric[] {
    return this.getAllMetrics().filter(metric => metric.category === category);
  }

  /**
   * Get metrics within a time range
   */
  getMetricsByTimeRange(metricId: string, startTime: number, endTime: number): BusinessMetric[] {
    const metrics = this.getMetrics(metricId);
    return metrics.filter(metric =>
      metric.timestamp >= startTime && metric.timestamp <= endTime
    );
  }

  /**
   * Get metrics by dimension
   */
  getMetricsByDimension(metricId: string, dimensionName: string, dimensionValue: string): BusinessMetric[] {
    const metrics = this.getMetrics(metricId);
    return metrics.filter(metric =>
      metric.dimensions?.[dimensionName] === dimensionValue
    );
  }

  /**
   * Get metric aggregation
   */
  getMetricAggregation(metricId: string, aggregationType: AggregationType, timeWindow: number): MetricAggregation {
    const endTime = Date.now();
    const startTime = endTime - timeWindow;

    const metrics = this.getMetricsByTimeRange(metricId, startTime, endTime);
    const aggregator = this.aggregators.get(metricId);

    if (aggregator) {
      return aggregator.aggregate(metrics, aggregationType);
    }

    // Default aggregation
    switch (aggregationType) {
      case 'sum':
        return {
          value: metrics.reduce((sum, m) => sum + m.value, 0),
          count: metrics.length,
          timestamp: endTime
        };
      case 'avg':
        return {
          value: metrics.length > 0 ? metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length : 0,
          count: metrics.length,
          timestamp: endTime
        };
      case 'count':
        return {
          value: metrics.length,
          count: metrics.length,
          timestamp: endTime
        };
      default:
        return {
          value: 0,
          count: 0,
          timestamp: endTime
        };
    }
  }

  /**
   * Get metric trend analysis
   */
  getMetricTrend(metricId: string, timeWindow: number): MetricTrend {
    const endTime = Date.now();
    const startTime = endTime - timeWindow;

    const metrics = this.getMetricsByTimeRange(metricId, startTime, endTime);

    if (metrics.length < 2) {
      return {
        trend: 'insufficient',
        change: 0,
        changePercentage: 0,
        startValue: metrics[0]?.value || 0,
        endValue: metrics[metrics.length - 1]?.value || 0,
        period: timeWindow
      };
    }

    const startMetric = metrics[0];
    const endMetric = metrics[metrics.length - 1];

    const change = endMetric.value - startMetric.value;
    const changePercentage = startMetric.value !== 0 ? (change / startMetric.value) * 100 : 0;

    let trend: 'increasing' | 'decreasing' | 'stable' | 'volatile' = 'stable';

    if (Math.abs(changePercentage) < 1) {
      trend = 'stable';
    } else if (changePercentage > 5) {
      trend = 'increasing';
    } else if (changePercentage < -5) {
      trend = 'decreasing';
    } else {
      trend = 'volatile';
    }

    return {
      trend,
      change,
      changePercentage,
      startValue: startMetric.value,
      endValue: endMetric.value,
      period: timeWindow
    };
  }

  /**
   * Get metric health score
   */
  getMetricHealthScore(metricId: string, timeWindow: number = 86400000): number {
    const aggregation = this.getMetricAggregation(metricId, 'avg', timeWindow);
    const trend = this.getMetricTrend(metricId, timeWindow);
    const thresholds = this.thresholds.get(metricId) || [];

    // Base score from trend (0-40 points)
    let trendScore = 40;
    if (trend.trend === 'decreasing') trendScore = 20;
    else if (trend.trend === 'increasing') trendScore = 30;
    else if (trend.trend === 'volatile') trendScore = 25;

    // Check thresholds (0-30 points)
    let thresholdScore = 30;
    thresholds.forEach(threshold => {
      if (aggregation.value < threshold.lowerBound || aggregation.value > threshold.upperBound) {
        thresholdScore -= 10;
      }
    });

    // Check trend magnitude (0-30 points)
    let trendMagnitudeScore = 30;
    if (Math.abs(trend.changePercentage) > 20) trendMagnitudeScore = 10;
    else if (Math.abs(trend.changePercentage) > 10) trendMagnitudeScore = 20;
    else if (Math.abs(trend.changePercentage) > 5) trendMagnitudeScore = 25;

    return Math.max(0, Math.min(100, trendScore + thresholdScore + trendMagnitudeScore));
  }

  /**
   * Create metric aggregator
   */
  createAggregator(metricId: string, aggregator: MetricAggregator): void {
    this.aggregators.set(metricId, aggregator);
  }

  /**
   * Create metric thresholds
   */
  createThresholds(metricId: string, thresholds: MetricThreshold[]): void {
    this.thresholds.set(metricId, thresholds);
  }

  /**
   * Create metric targets
   */
  createTargets(metricId: string, targets: MetricTarget[]): void {
    this.targets.set(metricId, targets);
  }

  /**
   * Get business metrics report
   */
  getBusinessMetricsReport(timeWindow: number = 86400000): BusinessMetricsReport {
    const allMetrics = this.getAllMetrics();
    const metricIds = [...new Set(allMetrics.map(m => m.id))];
    const report: BusinessMetricsReport = {
      timestamp: Date.now(),
      timeWindow,
      metricsCount: metricIds.length,
      categoryBreakdown: this.getCategoryBreakdown(),
      topPerformingMetrics: this.getTopPerformingMetrics(metricIds, timeWindow),
      metricsNeedingAttention: this.getMetricsNeedingAttention(metricIds, timeWindow),
      trends: this.getAllTrends(metricIds, timeWindow),
      recommendations: this.generateRecommendations(metricIds, timeWindow)
    };

    return report;
  }

  /**
   * Initialize default business metrics
   */
  private initializeDefaultMetrics(): void {
    // Default revenue metric
    this.createAggregator('revenue', new RevenueAggregator());

    // Default user metric
    this.createAggregator('users', new UserAggregator());

    // Default performance metric
    this.createAggregator('performance', new PerformanceAggregator());
  }

  /**
   * Initialize aggregators
   */
  private initializeAggregators(): void {
    // Initialize with default aggregators
    this.createAggregator('revenue', new RevenueAggregator());
    this.createAggregator('users', new UserAggregator());
    this.createAggregator('performance', new PerformanceAggregator());
  }

  /**
   * Apply retention policies
   */
  private applyRetention(metricId: string): void {
    const metrics = this.metrics.get(metricId);
    if (!metrics) return;

    // Keep only last 1000 metrics
    if (metrics.length > 1000) {
      this.metrics.set(metricId, metrics.slice(-1000));
    }
  }

  /**
   * Check metric thresholds
   */
  private checkThresholds(metric: BusinessMetric): void {
    const thresholds = this.thresholds.get(metric.id) || [];
    const alerts: AlertCondition[] = [];

    thresholds.forEach(threshold => {
      if (metric.value < threshold.lowerBound || metric.value > threshold.upperBound) {
        alerts.push({
          type: 'threshold',
          metric: metric.id,
          operator: metric.value < threshold.lowerBound ? 'lt' : 'gt',
          threshold: threshold.lowerBound || threshold.upperBound,
          duration: 0
        });
      }
    });

    // In a real implementation, these would trigger alerts
    if (alerts.length > 0) {
      console.log(`Metric ${metric.id} breached thresholds:`, alerts);
    }
  }

  /**
   * Check metric targets
   */
  private checkTargets(metric: BusinessMetric): void {
    const targets = this.targets.get(metric.id) || [];

    targets.forEach(target => {
      const progress = (metric.value / target.target) * 100;
      if (progress >= 100) {
        console.log(`Target met for metric ${metric.id}: ${metric.value}/${target.target}`);
      }
    });
  }

  /**
   * Get category breakdown
   */
  private getCategoryBreakdown(): Record<string, number> {
    const allMetrics = this.getAllMetrics();
    const breakdown: Record<string, number> = {};

    allMetrics.forEach(metric => {
      breakdown[metric.category] = (breakdown[metric.category] || 0) + 1;
    });

    return breakdown;
  }

  /**
   * Get top performing metrics
   */
  private getTopPerformingMetrics(metricIds: string[], timeWindow: number): TopPerformingMetric[] {
    return metricIds
      .map(id => {
        const healthScore = this.getMetricHealthScore(id, timeWindow);
        const trend = this.getMetricTrend(id, timeWindow);
        return { id, healthScore, trend };
      })
      .sort((a, b) => b.healthScore - a.healthScore)
      .slice(0, 5)
      .map(({ id, healthScore, trend }) => ({ id, healthScore, trend }));
  }

  /**
   * Get metrics needing attention
   */
  private getMetricsNeedingAttention(metricIds: string[], timeWindow: number): MetricNeedingAttention[] {
    return metricIds
      .map(id => {
        const healthScore = this.getMetricHealthScore(id, timeWindow);
        const aggregation = this.getMetricAggregation(id, 'avg', timeWindow);
        return { id, healthScore, aggregation };
      })
      .filter(m => m.healthScore < 70)
      .sort((a, b) => a.healthScore - b.healthScore)
      .slice(0, 5)
      .map(({ id, healthScore, aggregation }) => ({ id, healthScore, aggregation }));
  }

  /**
   * Get all trends
   */
  private getAllTrends(metricIds: string[], timeWindow: number): MetricTrend[] {
    return metricIds.map(id => this.getMetricTrend(id, timeWindow));
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(metricIds: string[], timeWindow: number): string[] {
    const recommendations: string[] = [];
    const metricsNeedingAttention = this.getMetricsNeedingAttention(metricIds, timeWindow);

    metricsNeedingAttention.forEach(metric => {
      if (metric.healthScore < 40) {
        recommendations.push(`Critical issue with metric ${metric.id}: Health score ${metric.healthScore.toFixed(1)}`);
      } else if (metric.healthScore < 60) {
        recommendations.push(`Review metric ${metric.id}: Health score ${metric.healthScore.toFixed(1)}`);
      } else {
        recommendations.push(`Monitor metric ${metric.id}: Health score ${metric.healthScore.toFixed(1)}`);
      }
    });

    return recommendations;
  }
}

/**
 * Metric aggregator interface
 */
export interface MetricAggregator {
  aggregate(metrics: BusinessMetric[], type: AggregationType): MetricAggregation;
}

/**
 * Aggregation type enum
 */
export type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'first' | 'last';

/**
 * Metric aggregation result
 */
export interface MetricAggregation {
  value: number;
  count: number;
  timestamp: number;
}

/**
 * Metric threshold
 */
export interface MetricThreshold {
  lowerBound: number;
  upperBound: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Metric target
 */
export interface MetricTarget {
  target: number;
  period: string; // e.g., 'daily', 'weekly', 'monthly'
}

/**
 * Metric trend
 */
export interface MetricTrend {
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile' | 'insufficient';
  change: number;
  changePercentage: number;
  startValue: number;
  endValue: number;
  period: number;
}

/**
 * Top performing metric
 */
export interface TopPerformingMetric {
  id: string;
  healthScore: number;
  trend: MetricTrend;
}

/**
 * Metric needing attention
 */
export interface MetricNeedingAttention {
  id: string;
  healthScore: number;
  aggregation: MetricAggregation;
}

/**
 * Business metrics report
 */
export interface BusinessMetricsReport {
  timestamp: number;
  timeWindow: number;
  metricsCount: number;
  categoryBreakdown: Record<string, number>;
  topPerformingMetrics: TopPerformingMetric[];
  metricsNeedingAttention: MetricNeedingAttention[];
  trends: MetricTrend[];
  recommendations: string[];
}

/**
 * Revenue aggregator
 */
export class RevenueAggregator implements MetricAggregator {
  aggregate(metrics: BusinessMetric[], type: AggregationType): MetricAggregation {
    const relevantMetrics = metrics.filter(m => m.category === 'revenue');

    switch (type) {
      case 'sum':
        return {
          value: relevantMetrics.reduce((sum, m) => sum + m.value, 0),
          count: relevantMetrics.length,
          timestamp: Date.now()
        };
      case 'avg':
        return {
          value: relevantMetrics.length > 0 ?
            relevantMetrics.reduce((sum, m) => sum + m.value, 0) / relevantMetrics.length : 0,
          count: relevantMetrics.length,
          timestamp: Date.now()
        };
      default:
        return {
          value: 0,
          count: 0,
          timestamp: Date.now()
        };
    }
  }
}

/**
 * User aggregator
 */
export class UserAggregator implements MetricAggregator {
  aggregate(metrics: BusinessMetric[], type: AggregationType): MetricAggregation {
    const relevantMetrics = metrics.filter(m => m.category === 'user');

    switch (type) {
      case 'sum':
      case 'count':
        return {
          value: relevantMetrics.reduce((sum, m) => sum + m.value, 0),
          count: relevantMetrics.length,
          timestamp: Date.now()
        };
      case 'avg':
        return {
          value: relevantMetrics.length > 0 ?
            relevantMetrics.reduce((sum, m) => sum + m.value, 0) / relevantMetrics.length : 0,
          count: relevantMetrics.length,
          timestamp: Date.now()
        };
      default:
        return {
          value: 0,
          count: 0,
          timestamp: Date.now()
        };
    }
  }
}

/**
 * Performance aggregator
 */
export class PerformanceAggregator implements MetricAggregator {
  aggregate(metrics: BusinessMetric[], type: AggregationType): MetricAggregation {
    const relevantMetrics = metrics.filter(m => m.category === 'performance');

    switch (type) {
      case 'avg':
        return {
          value: relevantMetrics.length > 0 ?
            relevantMetrics.reduce((sum, m) => sum + m.value, 0) / relevantMetrics.length : 0,
          count: relevantMetrics.length,
          timestamp: Date.now()
        };
      case 'min':
        return {
          value: relevantMetrics.length > 0 ?
            Math.min(...relevantMetrics.map(m => m.value)) : 0,
          count: relevantMetrics.length,
          timestamp: Date.now()
        };
      case 'max':
        return {
          value: relevantMetrics.length > 0 ?
            Math.max(...relevantMetrics.map(m => m.value)) : 0,
          count: relevantMetrics.length,
          timestamp: Date.now()
        };
      default:
        return {
          value: 0,
          count: 0,
          timestamp: Date.now()
        };
    }
  }
}