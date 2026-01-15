/**
 * Log Metrics - Metrics collection and reporting for the logging system
 */

import EventEmitter from 'eventemitter3';
import {
  LogEntry,
  LogLevel,
  VolumeMetrics,
  ErrorMetrics,
  TimeRange,
} from '../types';
import { createLogger } from '../utils/logger';
import { calculateRate, now } from '../utils/helpers';

export interface MetricsConfig {
  aggregationInterval?: number;
  retentionPeriod?: number;
  enabledMetrics?: string[];
}

export interface MetricDataPoint {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

export interface MetricsSnapshot {
  timestamp: number;
  volume: VolumeMetrics;
  errors: ErrorMetrics;
  byLevel: Record<number, number>;
  byService: Record<string, number>;
  byEnvironment: Record<string, number>;
}

/**
 * Log Metrics Collector
 */
export class LogMetricsCollector extends EventEmitter<any> {
  private logger = createLogger({ component: 'LogMetricsCollector' });
  private config: Required<MetricsConfig>;
  private metrics: Map<string, MetricDataPoint[]> = new Map();
  private currentSnapshot: Partial<MetricsSnapshot> = {};
  private aggregationTimer: NodeJS.Timeout | null = null;

  constructor(config: MetricsConfig = {}) {
    super();

    this.config = {
      aggregationInterval: config.aggregationInterval ?? 60000, // 1 minute
      retentionPeriod: config.retentionPeriod ?? 86400000, // 24 hours
      enabledMetrics: config.enabledMetrics ?? ['volume', 'errors', 'byLevel', 'byService'],
    };

    this.startAggregation();

    this.logger.info('Log metrics collector initialized', {
      aggregationInterval: this.config.aggregationInterval,
    });
  }

  /**
   * Record a log entry for metrics
   */
  public record(entry: LogEntry): void {
    // Update current snapshot
    if (!this.currentSnapshot.timestamp) {
      this.currentSnapshot.timestamp = now();
    }

    // By level
    if (!this.currentSnapshot.byLevel) {
      this.currentSnapshot.byLevel = {};
    }
    this.currentSnapshot.byLevel[entry.level] =
      (this.currentSnapshot.byLevel[entry.level] ?? 0) + 1;

    // By service
    if (!this.currentSnapshot.byService) {
      this.currentSnapshot.byService = {};
    }
    this.currentSnapshot.byService[entry.service] =
      (this.currentSnapshot.byService[entry.service] ?? 0) + 1;

    // By environment
    if (entry.environment) {
      if (!this.currentSnapshot.byEnvironment) {
        this.currentSnapshot.byEnvironment = {};
      }
      this.currentSnapshot.byEnvironment[entry.environment] =
        (this.currentSnapshot.byEnvironment[entry.environment] ?? 0) + 1;
    }

    // Volume
    if (!this.currentSnapshot.volume) {
      this.currentSnapshot.volume = {
        totalLogs: 0,
        logsPerSecond: 0,
        bytesPerSecond: 0,
        avgLogSize: 0,
        peakLogsPerSecond: 0,
      };
    }
    this.currentSnapshot.volume.totalLogs++;

    // Errors
    if (entry.level >= LogLevel.ERROR) {
      if (!this.currentSnapshot.errors) {
        this.currentSnapshot.errors = {
          totalErrors: 0,
          errorRate: 0,
          topErrors: [],
          errorTrend: [],
          criticalErrors: 0,
        };
      }
      this.currentSnapshot.errors.totalErrors++;
    }
  }

  /**
   * Get current metrics
   */
  public getMetrics(timeRange?: TimeRange): MetricsSnapshot | null {
    if (!this.currentSnapshot.timestamp) {
      return null;
    }

    // Calculate rates
    const elapsed = now() - this.currentSnapshot.timestamp;
    const duration = elapsed / 1000; // Convert to seconds

    const volume = this.currentSnapshot.volume ?? {
      totalLogs: 0,
      logsPerSecond: 0,
      bytesPerSecond: 0,
      avgLogSize: 0,
      peakLogsPerSecond: 0,
    };

    volume.logsPerSecond = calculateRate(volume.totalLogs, elapsed);
    volume.peakLogsPerSecond = volume.logsPerSecond;

    const errors = this.currentSnapshot.errors ?? {
      totalErrors: 0,
      errorRate: 0,
      topErrors: [],
      errorTrend: [],
      criticalErrors: 0,
    };

    errors.errorRate = calculateRate(errors.totalErrors, elapsed);

    return {
      timestamp: this.currentSnapshot.timestamp,
      volume,
      errors,
      byLevel: this.currentSnapshot.byLevel ?? {},
      byService: this.currentSnapshot.byService ?? {},
      byEnvironment: this.currentSnapshot.byEnvironment ?? {},
    };
  }

  /**
   * Get metrics for a specific metric name
   */
  public getMetric(name: string, timeRange?: TimeRange): MetricDataPoint[] {
    const data = this.metrics.get(name);
    if (!data) return [];

    if (!timeRange) {
      return [...data];
    }

    return data.filter((d) => d.timestamp >= timeRange.start && d.timestamp <= timeRange.end);
  }

  /**
   * Get aggregate metrics
   */
  public getAggregateMetrics(name: string, timeRange: TimeRange): {
    sum: number;
    avg: number;
    min: number;
    max: number;
    count: number;
  } {
    const data = this.getMetric(name, timeRange);

    if (data.length === 0) {
      return { sum: 0, avg: 0, min: 0, max: 0, count: 0 };
    }

    const values = data.map((d) => d.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { sum, avg, min, max, count: values.length };
  }

  /**
   * Start aggregation timer
   */
  private startAggregation(): void {
    this.aggregationTimer = setInterval(() => {
      this.aggregateMetrics();
    }, this.config.aggregationInterval);
  }

  /**
   * Aggregate and store current metrics
   */
  private aggregateMetrics(): void {
    const snapshot = this.getMetrics();
    if (!snapshot) return;

    const timestamp = now();

    // Store volume metrics
    if (this.config.enabledMetrics.includes('volume')) {
      this.storeMetric('volume_total_logs', timestamp, snapshot.volume.totalLogs);
      this.storeMetric('volume_logs_per_second', timestamp, snapshot.volume.logsPerSecond);
    }

    // Store error metrics
    if (this.config.enabledMetrics.includes('errors')) {
      this.storeMetric('errors_total', timestamp, snapshot.errors.totalErrors);
      this.storeMetric('errors_rate', timestamp, snapshot.errors.errorRate);
    }

    // Store by-level metrics
    if (this.config.enabledMetrics.includes('byLevel')) {
      for (const [level, count] of Object.entries(snapshot.byLevel)) {
        this.storeMetric(
          `logs_by_level_${level}`,
          timestamp,
          count,
          { level }
        );
      }
    }

    // Store by-service metrics
    if (this.config.enabledMetrics.includes('byService')) {
      for (const [service, count] of Object.entries(snapshot.byService)) {
        this.storeMetric(
          `logs_by_service_${service}`,
          timestamp,
          count,
          { service }
        );
      }
    }

    // Reset current snapshot
    this.currentSnapshot = {};

    // Clean up old metrics
    this.cleanupOldMetrics();

    this.emit('metrics:aggregated', { timestamp, snapshot });
  }

  /**
   * Store a metric data point
   */
  private storeMetric(name: string, timestamp: number, value: number, labels?: Record<string, string>): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const data = this.metrics.get(name)!;
    data.push({ timestamp, value, labels });

    // Enforce retention period
    const cutoff = timestamp - this.config.retentionPeriod;
    const filtered = data.filter((d) => d.timestamp >= cutoff);

    if (filtered.length < data.length) {
      this.metrics.set(name, filtered);
    }
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoff = now() - this.config.retentionPeriod;

    for (const [name, data] of this.metrics.entries()) {
      const filtered = data.filter((d) => d.timestamp >= cutoff);
      this.metrics.set(name, filtered);
    }
  }

  /**
   * Get metrics stats
   */
  public getStats(): {
    metricCount: number;
    totalDataPoints: number;
    enabledMetrics: string[];
  } {
    let totalDataPoints = 0;

    for (const data of this.metrics.values()) {
      totalDataPoints += data.length;
    }

    return {
      metricCount: this.metrics.size,
      totalDataPoints,
      enabledMetrics: this.config.enabledMetrics,
    };
  }

  /**
   * Clear all metrics
   */
  public clearMetrics(): void {
    this.metrics.clear();
    this.currentSnapshot = {};
  }

  /**
   * Shutdown metrics collector
   */
  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down metrics collector');

    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }

    // Final aggregation
    this.aggregateMetrics();

    this.logger.info('Metrics collector shutdown complete');
  }
}

/**
 * Create a log metrics collector instance
 */
export function createLogMetricsCollector(config?: MetricsConfig): LogMetricsCollector {
  return new LogMetricsCollector(config);
}
