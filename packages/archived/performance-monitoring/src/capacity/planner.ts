/**
 * Capacity Planning Analytics
 * Analyzes resource usage patterns and provides forecasting and recommendations
 */

import { EventEmitter } from 'eventemitter3';
import {
  CapacityMetric,
  CapacityForecast,
  ForecastPoint,
  CapacityRecommendation,
  CapacityReport
} from '../types';

export class CapacityPlanner {
  private metrics: Map<string, CapacityMetric>;
  private forecasts: Map<string, CapacityForecast>;
  private recommendations: CapacityRecommendation[];
  private eventEmitter: EventEmitter;

  constructor() {
    this.metrics = new Map();
    this.forecasts = new Map();
    this.recommendations = [];
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Add or update a capacity metric
   */
  updateMetric(name: string, data: {
    current: number;
    capacity: number;
    unit: string;
    history?: Array<{ timestamp: number; value: number }>;
    labels?: Record<string, string>;
  }): CapacityMetric {
    const history = data.history || [];

    const metric: CapacityMetric = {
      name,
      current: data.current,
      projected: data.current,
      capacity: data.capacity,
      unit: data.unit,
      trend: this.calculateTrend(history),
      forecast: this.generateForecast(history, data.capacity)
    };

    this.metrics.set(name, metric);
    this.forecasts.set(name, metric.forecast);

    // Check if we need recommendations
    this.generateRecommendations(metric);

    this.eventEmitter.emit('metric:updated', metric);

    return metric;
  }

  /**
   * Calculate trend from historical data
   */
  private calculateTrend(history: Array<{ timestamp: number; value: number }>): 'increasing' | 'decreasing' | 'stable' {
    if (history.length < 3) {
      return 'stable';
    }

    const recent = history.slice(-10);
    const n = recent.length;

    // Simple linear regression
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = recent[i].value;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    if (slope > 0.01) return 'increasing';
    if (slope < -0.01) return 'decreasing';
    return 'stable';
  }

  /**
   * Generate forecast using linear trend and seasonality
   */
  private generateForecast(
    history: Array<{ timestamp: number; value: number }>,
    capacity: number,
    horizon: number = 7 * 24 * 60 * 60 * 1000 // 7 days
  ): CapacityForecast {
    const now = Date.now();
    const predictions: ForecastPoint[] = [];

    if (history.length < 10) {
      // Not enough data, return flat forecast
      const currentValue = history.length > 0 ? history[history.length - 1].value : 0;

      return {
        horizon,
        predictions: [],
        confidence: 0,
        upperBound: capacity,
        lowerBound: 0
      };
    }

    // Simple linear regression forecast
    const n = Math.min(100, history.length);
    const recent = history.slice(-n);

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = recent[i].value;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate variance for confidence intervals
    const variance = recent.reduce((sum, point, i) => {
      const predicted = slope * i + intercept;
      return sum + Math.pow(point.value - predicted, 2);
    }, 0) / n;

    const stdDev = Math.sqrt(variance);

    // Generate predictions
    const steps = Math.floor(horizon / (5 * 60 * 1000)); // 5-minute intervals

    for (let i = 1; i <= steps; i++) {
      const timestamp = now + i * 5 * 60 * 1000;
      const value = slope * (n + i) + intercept;
      const upperBound = value + 2 * stdDev;
      const lowerBound = Math.max(0, value - 2 * stdDev);

      predictions.push({
        timestamp,
        value: Math.max(0, value),
        upperBound: Math.min(capacity, upperBound),
        lowerBound
      });

      // Check if we'll hit capacity
      if (upperBound >= capacity) {
        return {
          horizon,
          predictions,
          confidence: Math.max(0, 1 - stdDev / (sumY / n)),
          upperBound,
          lowerBound,
          saturationDate: timestamp
        };
      }
    }

    return {
      horizon,
      predictions,
      confidence: Math.max(0, 1 - stdDev / (sumY / n)),
      upperBound: predictions[predictions.length - 1]?.upperBound || capacity,
      lowerBound: predictions[predictions.length - 1]?.lowerBound || 0
    };
  }

  /**
   * Generate capacity recommendations
   */
  private generateRecommendations(metric: CapacityMetric): void {
    const utilization = metric.current / metric.capacity;
    const forecast = metric.forecast;

    // Check if we need to scale up
    if (utilization > 0.8) {
      this.addRecommendation({
        type: 'scale_up',
        priority: utilization > 0.95 ? 'urgent' : 'high',
        resource: metric.name,
        current: metric.current,
        recommended: metric.capacity * 1.5,
        reason: `${metric.name} utilization at ${(utilization * 100).toFixed(1)}%`,
        estimatedImpact: 'Improved performance and headroom',
        cost: this.estimateCost('scale_up', metric.capacity, metric.capacity * 1.5)
      });
    }

    // Check if we can scale down
    if (utilization < 0.3 && metric.trend === 'decreasing') {
      this.addRecommendation({
        type: 'scale_down',
        priority: 'low',
        resource: metric.name,
        current: metric.current,
        recommended: metric.capacity * 0.7,
        reason: `${metric.name} utilization low at ${(utilization * 100).toFixed(1)}% and trending down`,
        estimatedImpact: 'Cost savings with minimal performance impact',
        cost: this.estimateCost('scale_down', metric.capacity, metric.capacity * 0.7)
      });
    }

    // Check forecast for capacity saturation
    if (forecast.saturationDate) {
      const daysUntilSaturation = (forecast.saturationDate - Date.now()) / (24 * 60 * 60 * 1000);

      this.addRecommendation({
        type: 'scale_up',
        priority: daysUntilSaturation < 7 ? 'urgent' : 'high',
        resource: metric.name,
        current: metric.current,
        recommended: metric.capacity * 2,
        reason: `Forecast predicts capacity saturation in ${daysUntilSaturation.toFixed(1)} days`,
        estimatedImpact: 'Prevent capacity exhaustion',
        cost: this.estimateCost('scale_up', metric.capacity, metric.capacity * 2)
      });
    }
  }

  /**
   * Add a recommendation
   */
  private addRecommendation(rec: CapacityRecommendation): void {
    // Check for duplicates
    const isDuplicate = this.recommendations.some(
      r => r.resource === rec.resource && r.type === rec.type
    );

    if (!isDuplicate) {
      this.recommendations.push(rec);
      this.eventEmitter.emit('recommendation:added', rec);
    }
  }

  /**
   * Estimate cost for a scaling action
   */
  private estimateCost(
    type: 'scale_up' | 'scale_down',
    from: number,
    to: number
  ): number {
    // Simplified cost model - in reality would use cloud pricing APIs
    const baseCost = 100; // Base cost per unit
    const unitCost = type === 'scale_up' ? (to - from) * baseCost : -(from - to) * baseCost;
    return unitCost;
  }

  /**
   * Get a capacity metric
   */
  getMetric(name: string): CapacityMetric | undefined {
    return this.metrics.get(name);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): CapacityMetric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get forecast for a metric
   */
  getForecast(name: string): CapacityForecast | undefined {
    return this.forecasts.get(name);
  }

  /**
   * Get recommendations
   */
  getRecommendations(): CapacityRecommendation[] {
    return [...this.recommendations];
  }

  /**
   * Get recommendations by priority
   */
  getRecommendationsByPriority(priority: 'low' | 'medium' | 'high' | 'urgent'): CapacityRecommendation[] {
    return this.recommendations.filter(rec => rec.priority === priority);
  }

  /**
   * Generate capacity report
   */
  generateReport(): CapacityReport {
    const allMetrics = this.getAllMetrics();

    const summary = {
      healthy: 0,
      warning: 0,
      critical: 0
    };

    for (const metric of allMetrics) {
      const utilization = metric.current / metric.capacity;

      if (utilization > 0.8) {
        summary.critical++;
      } else if (utilization > 0.6) {
        summary.warning++;
      } else {
        summary.healthy++;
      }
    }

    return {
      timestamp: Date.now(),
      timeRange: 24 * 60 * 60 * 1000, // 24 hours
      resources: allMetrics,
      recommendations: this.recommendations,
      summary
    };
  }

  /**
   * Clear recommendations
   */
  clearRecommendations(): void {
    this.recommendations = [];
    this.eventEmitter.emit('recommendations:cleared');
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

  /**
   * Clean up resources
   */
  destroy(): void {
    this.metrics.clear();
    this.forecasts.clear();
    this.recommendations = [];
    this.eventEmitter.removeAllListeners();
  }
}
