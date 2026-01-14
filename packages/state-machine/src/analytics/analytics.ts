/**
 * State Machine Analytics
 * Provides analytics, metrics, and insights for state machine behavior
 */

import { StateMachineEngine } from '../engine/engine.js';
import {
  State,
  StateContext,
  TransitionMetrics,
  StateStatistics,
  StateTransitionEvent,
} from '../types/index.js';

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

/**
 * State duration statistics
 */
export interface StateDurationStats {
  state: State;
  count: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  medianTime: number;
  percentile95: number;
  percentile99: number;
  standardDeviation: number;
}

/**
 * Transition frequency data
 */
export interface TransitionFrequency {
  from: State;
  to: State;
  event: string;
  count: number;
  frequency: number;
  percentage: number;
}

/**
 * Anomaly detection result
 */
export interface AnomalyResult {
  type: 'state_duration' | 'transition_frequency' | 'error_rate' | 'performance';
  severity: 'low' | 'medium' | 'high';
  description: string;
  timestamp: number;
  data: any;
}

/**
 * Trend analysis result
 */
export interface TrendAnalysis {
  metric: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  changeRate: number;
  confidence: number;
  prediction?: number[];
}

/**
 * Analytics report
 */
export interface AnalyticsReport {
  period: {
    start: number;
    end: number;
    duration: number;
  };
  summary: {
    totalTransitions: number;
    totalStates: number;
    uniqueStates: number;
    avgTransitionsPerState: number;
  };
  stateStatistics: StateDurationStats[];
  transitionFrequencies: TransitionFrequency[];
  anomalies: AnomalyResult[];
  trends: TrendAnalysis[];
  performanceMetrics: PerformanceMetrics;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  avgTransitionTime: number;
  p50TransitionTime: number;
  p95TransitionTime: number;
  p99TransitionTime: number;
  maxTransitionTime: number;
  minTransitionTime: number;
  throughput: number;
  errorRate: number;
}

/**
 * State machine analytics class
 */
export class StateMachineAnalytics<TData = any> {
  private machine: StateMachineEngine<TData>;
  private events: StateTransitionEvent<TData>[] = [];
  private stateEntries: Map<State, number[]> = new Map();
  private stateExits: Map<State, number[]> = new Map();
  private transitionCounts: Map<string, number> = new Map();
  private errorEvents: StateTransitionEvent<TData>[] = [];
  private startTime: number = Date.now();
  private maxEvents: number = 10000;

  constructor(machine: StateMachineEngine<TData>, maxEvents: number = 10000) {
    this.machine = machine;
    this.maxEvents = maxEvents;

    // Subscribe to events
    this.machine.on('state:change', this.handleStateChange.bind(this));
    this.machine.on('transition:error', this.handleError.bind(this));
  }

  /**
   * Get transition metrics
   */
  getTransitionMetrics(): TransitionMetrics {
    const metrics = this.machine.getTransitionMetrics() as TransitionMetrics;

    if (!metrics) {
      return this.calculateTransitionMetrics();
    }

    return metrics;
  }

  /**
   * Get state statistics
   */
  getStateStatistics(): StateStatistics[] {
    const stats: StateStatistics[] = [];
    const now = Date.now();

    for (const [state, entries] of this.stateEntries) {
      const exits = this.stateExits.get(state) || [];
      const durations: number[] = [];

      for (let i = 0; i < Math.min(entries.length, exits.length); i++) {
        durations.push(exits[i] - entries[i]);
      }

      if (durations.length === 0) {
        // State is currently active
        const currentDuration = now - entries[entries.length - 1];
        durations.push(currentDuration);
      }

      stats.push({
        state,
        entries: entries.length,
        exits: exits.length,
        totalTime: durations.reduce((sum, d) => sum + d, 0),
        avgTime: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        minTime: Math.min(...durations),
        maxTime: Math.max(...durations),
        firstEntry: entries[0],
        lastExit: exits.length > 0 ? exits[exits.length - 1] : undefined,
      });
    }

    return stats;
  }

  /**
   * Get transition frequencies
   */
  getTransitionFrequencies(): TransitionFrequency[] {
    const frequencies: TransitionFrequency[] = [];
    const total = this.events.length;

    for (const [key, count] of this.transitionCounts) {
      const [from, to, event] = key.split('|');

      frequencies.push({
        from,
        to,
        event,
        count,
        frequency: count / ((Date.now() - this.startTime) / 1000),
        percentage: (count / total) * 100,
      });
    }

    return frequencies.sort((a, b) => b.count - a.count);
  }

  /**
   * Get state duration statistics with percentiles
   */
  getStateDurationStats(state: State): StateDurationStats | null {
    const entries = this.stateEntries.get(state);
    const exits = this.stateExits.get(state);

    if (!entries || entries.length === 0) {
      return null;
    }

    const durations: number[] = [];

    for (let i = 0; i < Math.min(entries.length, exits ? exits.length : 0); i++) {
      durations.push(exits![i] - entries[i]);
    }

    // Add current duration if state is active
    if (this.machine.isIn(state) && (!exits || exits.length < entries.length)) {
      durations.push(Date.now() - entries[entries.length - 1]);
    }

    if (durations.length === 0) {
      return null;
    }

    durations.sort((a, b) => a - b);

    const sum = durations.reduce((s, d) => s + d, 0);
    const mean = sum / durations.length;
    const variance = durations.reduce((s, d) => s + Math.pow(d - mean, 2), 0) / durations.length;

    return {
      state,
      count: durations.length,
      totalTime: sum,
      avgTime: mean,
      minTime: durations[0],
      maxTime: durations[durations.length - 1],
      medianTime: durations[Math.floor(durations.length / 2)],
      percentile95: durations[Math.floor(durations.length * 0.95)],
      percentile99: durations[Math.floor(durations.length * 0.99)],
      standardDeviation: Math.sqrt(variance),
    };
  }

  /**
   * Detect anomalies
   */
  detectAnomalies(): AnomalyResult[] {
    const anomalies: AnomalyResult[] = [];

    // Check for unusual state durations
    for (const state of Object.keys(this.machine.definition.states)) {
      const stats = this.getStateDurationStats(state);

      if (stats && stats.count > 10) {
        // Check for outliers using z-score
        const zScore = (stats.avgTime - stats.medianTime) / stats.standardDeviation;

        if (Math.abs(zScore) > 3) {
          anomalies.push({
            type: 'state_duration',
            severity: Math.abs(zScore) > 5 ? 'high' : 'medium',
            description: `State '${state}' has unusual duration (z-score: ${zScore.toFixed(2)})`,
            timestamp: Date.now(),
            data: stats,
          });
        }
      }
    }

    // Check for error spikes
    const recentErrors = this.errorEvents.filter(
      e => Date.now() - e.timestamp < 60000
    );

    if (recentErrors.length > 10) {
      anomalies.push({
        type: 'error_rate',
        severity: 'high',
        description: `High error rate detected: ${recentErrors.length} errors in last minute`,
        timestamp: Date.now(),
        data: { errorCount: recentErrors.length },
      });
    }

    // Check for performance degradation
    const recentEvents = this.events.filter(
      e => Date.now() - e.timestamp < 60000
    );

    if (recentEvents.length > 0) {
      const avgDuration = recentEvents.reduce((sum, e) => sum + e.duration, 0) / recentEvents.length;

      if (avgDuration > 1000) {
        anomalies.push({
          type: 'performance',
          severity: 'medium',
          description: `Slow transition detected: avg ${avgDuration.toFixed(2)}ms`,
          timestamp: Date.now(),
          data: { avgDuration },
        });
      }
    }

    return anomalies;
  }

  /**
   * Analyze trends
   */
  analyzeTrends(): TrendAnalysis[] {
    const trends: TrendAnalysis[] = [];

    // Analyze transition time trend
    const windowSize = 100;
    const timeSeries: TimeSeriesPoint[] = [];

    for (let i = windowSize; i < this.events.length; i += windowSize) {
      const window = this.events.slice(i - windowSize, i);
      const avgTime = window.reduce((sum, e) => sum + e.duration, 0) / window.length;

      timeSeries.push({
        timestamp: window[window.length - 1].timestamp,
        value: avgTime,
      });
    }

    if (timeSeries.length > 2) {
      const trend = this.calculateTrend(timeSeries);

      trends.push({
        metric: 'transition_time',
        trend: trend.direction,
        changeRate: trend.slope,
        confidence: trend.r2,
        prediction: this.predictNext(timeSeries, 5),
      });
    }

    // Analyze state visit frequency trend
    for (const state of Object.keys(this.machine.definition.states)) {
      const stateEvents = this.events.filter(e => e.to === state);

      if (stateEvents.length < windowSize) {
        continue;
      }

      const frequencySeries: TimeSeriesPoint[] = [];

      for (let i = windowSize; i < stateEvents.length; i += windowSize) {
        const window = stateEvents.slice(i - windowSize, i);
        const count = window.length;

        frequencySeries.push({
          timestamp: window[window.length - 1].timestamp,
          value: count,
        });
      }

      if (frequencySeries.length > 2) {
        const trend = this.calculateTrend(frequencySeries);

        trends.push({
          metric: `state_frequency_${state}`,
          trend: trend.direction,
          changeRate: trend.slope,
          confidence: trend.r2,
        });
      }
    }

    return trends;
  }

  /**
   * Generate comprehensive analytics report
   */
  generateReport(): AnalyticsReport {
    const now = Date.now();

    return {
      period: {
        start: this.startTime,
        end: now,
        duration: now - this.startTime,
      },
      summary: {
        totalTransitions: this.events.length,
        totalStates: Object.keys(this.machine.definition.states).length,
        uniqueStates: this.stateEntries.size,
        avgTransitionsPerState: this.events.length / Math.max(1, this.stateEntries.size),
      },
      stateStatistics: this.getStateStatistics().map(s => ({
        ...s,
        medianTime: 0,
        percentile95: 0,
        percentile99: 0,
        standardDeviation: 0,
      })),
      transitionFrequencies: this.getTransitionFrequencies(),
      anomalies: this.detectAnomalies(),
      trends: this.analyzeTrends(),
      performanceMetrics: this.getPerformanceMetrics(),
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    if (this.events.length === 0) {
      return {
        avgTransitionTime: 0,
        p50TransitionTime: 0,
        p95TransitionTime: 0,
        p99TransitionTime: 0,
        maxTransitionTime: 0,
        minTransitionTime: 0,
        throughput: 0,
        errorRate: 0,
      };
    }

    const durations = this.events.map(e => e.duration).sort((a, b) => a - b);
    const duration = (Date.now() - this.startTime) / 1000;

    return {
      avgTransitionTime: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      p50TransitionTime: durations[Math.floor(durations.length * 0.5)],
      p95TransitionTime: durations[Math.floor(durations.length * 0.95)],
      p99TransitionTime: durations[Math.floor(durations.length * 0.99)],
      maxTransitionTime: durations[durations.length - 1],
      minTransitionTime: durations[0],
      throughput: this.events.length / duration,
      errorRate: this.errorEvents.length / Math.max(1, this.events.length),
    };
  }

  /**
   * Get time series data for a metric
   */
  getTimeSeries(metric: 'transition_time' | 'state_visits', bucketSize: number = 60000): TimeSeriesPoint[] {
    const series: TimeSeriesPoint[] = [];
    const buckets = new Map<number, number[]>();

    if (metric === 'transition_time') {
      for (const event of this.events) {
        const bucket = Math.floor(event.timestamp / bucketSize) * bucketSize;

        if (!buckets.has(bucket)) {
          buckets.set(bucket, []);
        }

        buckets.get(bucket)!.push(event.duration);
      }
    } else if (metric === 'state_visits') {
      for (const event of this.events) {
        const bucket = Math.floor(event.timestamp / bucketSize) * bucketSize;

        if (!buckets.has(bucket)) {
          buckets.set(bucket, []);
        }

        buckets.get(bucket)!.push(event.to);
      }
    }

    for (const [timestamp, values] of buckets) {
      const value = metric === 'transition_time'
        ? values.reduce((sum, v) => sum + v, 0) / values.length
        : values.length;

      series.push({ timestamp, value });
    }

    return series.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Clear all analytics data
   */
  clear(): void {
    this.events = [];
    this.stateEntries.clear();
    this.stateExits.clear();
    this.transitionCounts.clear();
    this.errorEvents = [];
    this.startTime = Date.now();
  }

  /**
   * Handle state change event
   */
  private handleStateChange(event: StateTransitionEvent<TData>): void {
    // Store event
    this.events.push(event);

    // Trim events if needed
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Record state entry
    if (!this.stateEntries.has(event.to)) {
      this.stateEntries.set(event.to, []);
    }
    this.stateEntries.get(event.to)!.push(event.timestamp);

    // Record state exit
    if (!this.stateExits.has(event.from)) {
      this.stateExits.set(event.from, []);
    }
    this.stateExits.get(event.from)!.push(event.timestamp);

    // Record transition count
    const key = `${event.from}|${event.to}|${event.event}`;
    this.transitionCounts.set(key, (this.transitionCounts.get(key) || 0) + 1);
  }

  /**
   * Handle error event
   */
  private handleError(error: Error, context: StateContext): void {
    this.errorEvents.push({
      from: context.current,
      to: context.current,
      event: context.event,
      timestamp: context.timestamp,
      duration: 0,
      error,
    } as any);

    // Trim error events if needed
    if (this.errorEvents.length > this.maxEvents) {
      this.errorEvents.shift();
    }
  }

  /**
   * Calculate transition metrics
   */
  private calculateTransitionMetrics(): TransitionMetrics {
    const byState: Record<string, number> = {};
    const byEvent: Record<string, number> = {};

    for (const event of this.events) {
      byState[event.from] = (byState[event.from] || 0) + 1;
      byEvent[event.event] = (byEvent[event.event] || 0) + 1;
    }

    return {
      total: this.events.length,
      successful: this.events.length - this.errorEvents.length,
      failed: this.errorEvents.length,
      byState,
      byEvent,
      avgDuration: this.events.reduce((sum, e) => sum + e.duration, 0) / this.events.length,
      minDuration: Math.min(...this.events.map(e => e.duration)),
      maxDuration: Math.max(...this.events.map(e => e.duration)),
      lastTransition: this.events.length > 0 ? this.events[this.events.length - 1].timestamp : undefined,
    };
  }

  /**
   * Calculate trend from time series
   */
  private calculateTrend(series: TimeSeriesPoint[]): {
    direction: 'increasing' | 'decreasing' | 'stable';
    slope: number;
    r2: number;
  } {
    if (series.length < 2) {
      return { direction: 'stable', slope: 0, r2: 0 };
    }

    // Calculate linear regression
    const n = series.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    let sumY2 = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = series[i].value;

      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
      sumY2 += y * y;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    let ssRes = 0;
    let ssTot = 0;

    for (let i = 0; i < n; i++) {
      const y = series[i].value;
      const yPred = slope * i + intercept;

      ssRes += Math.pow(y - yPred, 2);
      ssTot += Math.pow(y - yMean, 2);
    }

    const r2 = 1 - ssRes / ssTot;

    let direction: 'increasing' | 'decreasing' | 'stable' = 'stable';

    if (Math.abs(slope) > 0.01) {
      direction = slope > 0 ? 'increasing' : 'decreasing';
    }

    return { direction, slope, r2 };
  }

  /**
   * Predict next values using linear regression
   */
  private predictNext(series: TimeSeriesPoint[], count: number): number[] {
    const trend = this.calculateTrend(series);
    const predictions: number[] = [];
    const lastValue = series[series.length - 1].value;

    for (let i = 1; i <= count; i++) {
      predictions.push(lastValue + trend.slope * i);
    }

    return predictions;
  }

  /**
   * Destroy analytics
   */
  destroy(): void {
    this.clear();
  }
}
