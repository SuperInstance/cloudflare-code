import { ExecutionResultData, AnalyticsEvent } from '../types/index.js';

/**
 * Analytics data point
 */
interface AnalyticsDataPoint {
  timestamp: number;
  type: string;
  data: Record<string, unknown>;
}

/**
 * Aggregated metrics
 */
interface AggregatedMetrics {
  totalExecutions: number;
  successRate: number;
  averageDuration: number;
  errorDistribution: Map<string, number>;
  hourlyExecutionCount: Map<number, number>;
  dailyExecutionCount: Map<string, number>;
}

/**
 * Advanced Analytics Collector
 * Provides detailed analytics and reporting
 */
export class AnalyticsCollector {
  private circuitName: string;
  private events: AnalyticsDataPoint[];
  private executions: ExecutionResultData[];
  private maxEvents: number;
  private maxExecutions: number;
  private aggregatedMetrics: AggregatedMetrics;

  constructor(circuitName: string, maxEvents: number = 10000, maxExecutions: number = 5000) {
    this.circuitName = circuitName;
    this.events = [];
    this.executions = [];
    this.maxEvents = maxEvents;
    this.maxExecutions = maxExecutions;
    this.aggregatedMetrics = this.createEmptyMetrics();
  }

  /**
   * Record an execution result
   */
  recordExecution<T>(result: ExecutionResultData<T>): void {
    this.executions.push(result as ExecutionResultData);

    // Update aggregated metrics
    this.aggregatedMetrics.totalExecutions++;

    if (result.status === 'SUCCESS') {
      this.aggregatedMetrics.successRate =
        (this.aggregatedMetrics.successRate * (this.aggregatedMetrics.totalExecutions - 1) +
          1) /
        this.aggregatedMetrics.totalExecutions;
    } else {
      this.aggregatedMetrics.successRate =
        (this.aggregatedMetrics.successRate * (this.aggregatedMetrics.totalExecutions - 1)) /
        this.aggregatedMetrics.totalExecutions;
    }

    // Update average duration
    this.aggregatedMetrics.averageDuration =
      (this.aggregatedMetrics.averageDuration * (this.aggregatedMetrics.totalExecutions - 1) +
        result.duration) /
      this.aggregatedMetrics.totalExecutions;

    // Update error distribution
    if (result.error) {
      const errorType = result.error.constructor.name;
      const count = this.aggregatedMetrics.errorDistribution.get(errorType) || 0;
      this.aggregatedMetrics.errorDistribution.set(errorType, count + 1);
    }

    // Update hourly execution count
    const hour = Math.floor(result.timestamp / 3600000);
    const hourCount = this.aggregatedMetrics.hourlyExecutionCount.get(hour) || 0;
    this.aggregatedMetrics.hourlyExecutionCount.set(hour, hourCount + 1);

    // Update daily execution count
    const day = new Date(result.timestamp).toISOString().split('T')[0];
    const dayCount = this.aggregatedMetrics.dailyExecutionCount.get(day) || 0;
    this.aggregatedMetrics.dailyExecutionCount.set(day, dayCount + 1);

    // Trim executions if necessary
    if (this.executions.length > this.maxExecutions) {
      this.executions.shift();
    }
  }

  /**
   * Record an analytics event
   */
  recordEvent(event: AnalyticsEvent): void {
    this.events.push({
      timestamp: event.timestamp,
      type: event.type,
      data: event.data,
    });

    // Trim events if necessary
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): Record<string, unknown> {
    if (this.executions.length === 0) {
      return {
        total: 0,
        successRate: 0,
        averageDuration: 0,
        statusDistribution: {},
        errorDistribution: {},
      };
    }

    const statusDistribution: Record<string, number> = {};
    this.executions.forEach((e) => {
      statusDistribution[e.status] = (statusDistribution[e.status] || 0) + 1;
    });

    const errorDistribution: Record<string, number> = {};
    this.executions.forEach((e) => {
      if (e.error) {
        const errorType = e.error.constructor.name;
        errorDistribution[errorType] = (errorDistribution[errorType] || 0) + 1;
      }
    });

    return {
      total: this.executions.length,
      successRate: this.aggregatedMetrics.successRate * 100,
      averageDuration: this.aggregatedMetrics.averageDuration,
      statusDistribution,
      errorDistribution,
    };
  }

  /**
   * Get events by type
   */
  getEventsByType(type: string, limit?: number): AnalyticsDataPoint[] {
    const filtered = this.events.filter((e) => e.type === type);
    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * Get events in time range
   */
  getEventsInTimeRange(startTime: number, endTime: number): AnalyticsDataPoint[] {
    return this.events.filter((e) => e.timestamp >= startTime && e.timestamp <= endTime);
  }

  /**
   * Get executions in time range
   */
  getExecutionsInTimeRange(startTime: number, endTime: number): ExecutionResultData[] {
    return this.executions.filter((e) => e.timestamp >= startTime && e.timestamp <= endTime);
  }

  /**
   * Get hourly execution rate
   */
  getHourlyExecutionRate(hours: number = 24): Array<{ hour: number; count: number }> {
    const now = Math.floor(Date.now() / 3600000);
    const result: Array<{ hour: number; count: number }> = [];

    for (let i = hours - 1; i >= 0; i--) {
      const hour = now - i;
      const count = this.aggregatedMetrics.hourlyExecutionCount.get(hour) || 0;
      result.push({ hour, count });
    }

    return result;
  }

  /**
   * Get daily execution rate
   */
  getDailyExecutionRate(days: number = 7): Array<{ day: string; count: number }> {
    const result: Array<{ day: string; count: number }> = [];
    const today = new Date().toISOString().split('T')[0];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const day = date.toISOString().split('T')[0];
      const count = this.aggregatedMetrics.dailyExecutionCount.get(day) || 0;
      result.push({ day, count });
    }

    return result;
  }

  /**
   * Get percentile duration
   */
  getPercentileDuration(percentile: number): number {
    if (this.executions.length === 0) return 0;

    const durations = this.executions.map((e) => e.duration).sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * durations.length) - 1;
    return durations[Math.max(0, index)];
  }

  /**
   * Get error patterns
   */
  getErrorPatterns(): Record<string, unknown> {
    const errorGroups: Map<string, ExecutionResultData[]> = new Map();

    this.executions.forEach((e) => {
      if (e.error) {
        const errorType = e.error.constructor.name;
        if (!errorGroups.has(errorType)) {
          errorGroups.set(errorType, []);
        }
        errorGroups.get(errorType)!.push(e);
      }
    });

    const patterns: Record<string, unknown> = {};
    errorGroups.forEach((executions, errorType) => {
      const avgDuration =
        executions.reduce((sum, e) => sum + e.duration, 0) / executions.length;
      const hourlyTrend = this.calculateHourlyTrend(executions);

      patterns[errorType] = {
        count: executions.length,
        averageDuration: avgDuration,
        hourlyTrend,
        lastOccurrence: executions[executions.length - 1].timestamp,
      };
    });

    return patterns;
  }

  /**
   * Calculate hourly trend for executions
   */
  private calculateHourlyTrend(executions: ExecutionResultData[]): Array<number> {
    const hourlyCounts: Map<number, number> = new Map();

    executions.forEach((e) => {
      const hour = Math.floor(e.timestamp / 3600000);
      hourlyCounts.set(hour, (hourlyCounts.get(hour) || 0) + 1);
    });

    const sortedHours = Array.from(hourlyCounts.keys()).sort((a, b) => a - b);
    return sortedHours.map((hour) => hourlyCounts.get(hour) || 0);
  }

  /**
   * Get summary
   */
  getSummary(): Record<string, unknown> {
    return {
      circuitName: this.circuitName,
      executionStats: this.getExecutionStats(),
      hourlyRate: this.getHourlyExecutionRate(24),
      dailyRate: this.getDailyExecutionRate(7),
      errorPatterns: this.getErrorPatterns(),
      percentiles: {
        p50: this.getPercentileDuration(50),
        p95: this.getPercentileDuration(95),
        p99: this.getPercentileDuration(99),
      },
      eventCounts: this.getEventCounts(),
    };
  }

  /**
   * Get event counts by type
   */
  getEventCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    this.events.forEach((e) => {
      counts[e.type] = (counts[e.type] || 0) + 1;
    });
    return counts;
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 100): AnalyticsDataPoint[] {
    return this.events.slice(-limit);
  }

  /**
   * Get recent executions
   */
  getRecentExecutions(limit: number = 100): ExecutionResultData[] {
    return this.executions.slice(-limit);
  }

  /**
   * Export analytics data
   */
  export(): string {
    return JSON.stringify(
      {
        circuitName: this.circuitName,
        summary: this.getSummary(),
        recentEvents: this.getRecentEvents(1000),
        recentExecutions: this.getRecentExecutions(1000),
        exportedAt: Date.now(),
      },
      null,
      2
    );
  }

  /**
   * Reset all analytics
   */
  reset(): void {
    this.events = [];
    this.executions = [];
    this.aggregatedMetrics = this.createEmptyMetrics();
  }

  /**
   * Create empty metrics
   */
  private createEmptyMetrics(): AggregatedMetrics {
    return {
      totalExecutions: 0,
      successRate: 0,
      averageDuration: 0,
      errorDistribution: new Map(),
      hourlyExecutionCount: new Map(),
      dailyExecutionCount: new Map(),
    };
  }

  /**
   * Get memory usage
   */
  getMemoryUsage(): Record<string, number> {
    return {
      events: this.events.length,
      executions: this.executions.length,
      maxEvents: this.maxEvents,
      maxExecutions: this.maxExecutions,
    };
  }
}
