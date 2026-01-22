/**
 * Log Analytics - Statistical analysis and anomaly detection for logs
 */

import EventEmitter from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  LogEntry,
  LogLevel,
  LogMetrics,
  VolumeMetrics,
  ErrorMetrics,
  PerformanceMetrics,
  AvailabilityMetrics,
  Anomaly,
  AnomalyType,
  AnomalySeverity,
  AnomalyAlgorithm,
  AnomalyMetrics,
  TimeRange,
} from '../types';
import { createLogger } from '../utils/logger';
import { average, median, percentile, standardDeviation, calculateRate, now } from '../utils/helpers';

export interface AnalyticsConfig {
  windowSize?: number;
  minDataPoints?: number;
  sensitivity?: number;
  enabledAlgorithms?: AnomalyAlgorithm[];
}

export interface AnalyticsEvents {
  'metrics:calculated': LogMetrics;
  'anomaly:detected': Anomaly;
  'analysis:completed': { timeRange: TimeRange; entryCount: number };
}

/**
 * Log Analytics class
 */
export class LogAnalytics extends EventEmitter<AnalyticsEvents> {
  private logger = createLogger({ component: 'LogAnalytics' });
  private config: Required<AnalyticsConfig>;
  private historicalData: Array<{ timestamp: number; count: number; errorCount: number }> = [];
  private maxHistoricalPoints = 1000;

  constructor(config: AnalyticsConfig = {}) {
    super();

    this.config = {
      windowSize: config.windowSize ?? 3600000, // 1 hour
      minDataPoints: config.minDataPoints ?? 30,
      sensitivity: config.sensitivity ?? 2.0, // Standard deviations
      enabledAlgorithms: config.enabledAlgorithms ?? [
        AnomalyAlgorithm.Z_SCORE,
        AnomalyAlgorithm.MOVING_AVERAGE,
      ],
    };

    this.logger.info('Log analytics initialized', {
      windowSize: this.config.windowSize,
      algorithms: this.config.enabledAlgorithms,
    });
  }

  /**
   * Calculate metrics for log entries
   */
  public calculateMetrics(entries: LogEntry[], timeRange: TimeRange): LogMetrics {
    const volumeMetrics = this.calculateVolumeMetrics(entries, timeRange);
    const errorMetrics = this.calculateErrorMetrics(entries, timeRange);
    const performanceMetrics = this.calculatePerformanceMetrics(entries);
    const availabilityMetrics = this.calculateAvailabilityMetrics(entries, timeRange);

    const metrics: LogMetrics = {
      volume: volumeMetrics,
      errors: errorMetrics,
      performance: performanceMetrics,
      availability: availabilityMetrics,
    };

    this.emit('metrics:calculated', metrics);
    this.emit('analysis:completed', { timeRange, entryCount: entries.length });

    return metrics;
  }

  /**
   * Calculate volume metrics
   */
  private calculateVolumeMetrics(entries: LogEntry[], timeRange: TimeRange): VolumeMetrics {
    const duration = timeRange.end - timeRange.start;
    const totalLogs = entries.length;
    const logsPerSecond = calculateRate(totalLogs, duration);

    const sizes = entries.map((e) => Buffer.byteLength(JSON.stringify(e), 'utf8'));
    const totalBytes = sizes.reduce((sum, size) => sum + size, 0);
    const bytesPerSecond = calculateRate(totalBytes, duration);
    const avgLogSize = average(sizes);

    // Calculate peak by analyzing 1-minute windows
    const peakLogsPerSecond = this.calculatePeakRate(entries, 60000);

    return {
      totalLogs,
      logsPerSecond,
      bytesPerSecond,
      avgLogSize,
      peakLogsPerSecond,
    };
  }

  /**
   * Calculate peak log rate
   */
  private calculatePeakRate(entries: LogEntry[], windowMs: number): number {
    if (entries.length === 0) return 0;

    const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
    const startTime = sorted[0].timestamp;
    const endTime = sorted[sorted.length - 1].timestamp;

    const windows = new Map<number, number>();

    for (const entry of sorted) {
      const windowKey = Math.floor(entry.timestamp / windowMs) * windowMs;
      windows.set(windowKey, (windows.get(windowKey) ?? 0) + 1);
    }

    const maxCount = Math.max(...windows.values());
    return calculateRate(maxCount, windowMs);
  }

  /**
   * Calculate error metrics
   */
  private calculateErrorMetrics(entries: LogEntry[], timeRange: TimeRange): ErrorMetrics {
    const errorEntries = entries.filter((e) => e.level >= LogLevel.ERROR);
    const totalErrors = errorEntries.length;
    const duration = timeRange.end - timeRange.start;
    const errorRate = calculateRate(totalErrors, duration);

    // Top errors
    const errorCounts = new Map<string, number>();
    for (const entry of errorEntries) {
      const key = entry.error?.name ?? entry.message;
      errorCounts.set(key, (errorCounts.get(key) ?? 0) + 1);
    }

    const topErrors = Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([error, count]) => ({
        error,
        count,
        rate: calculateRate(count, duration),
      }));

    // Error trend (bucketed by 10% of time range)
    const bucketSize = duration / 10;
    const errorTrend = this.calculateErrorTrend(errorEntries, timeRange.start, bucketSize);

    const criticalErrors = errorEntries.filter((e) => e.level === LogLevel.FATAL).length;

    return {
      totalErrors,
      errorRate,
      topErrors,
      errorTrend,
      criticalErrors,
    };
  }

  /**
   * Calculate error trend over time
   */
  private calculateErrorTrend(errorEntries: LogEntry[], startTime: number, bucketSize: number): Array<{
    timestamp: number;
    count: number;
  }> {
    const buckets = new Map<number, number>();

    for (const entry of errorEntries) {
      const bucketIndex = Math.floor((entry.timestamp - startTime) / bucketSize);
      const bucketTimestamp = startTime + bucketIndex * bucketSize;
      buckets.set(bucketTimestamp, (buckets.get(bucketTimestamp) ?? 0) + 1);
    }

    return Array.from(buckets.entries())
      .map(([timestamp, count]) => ({ timestamp, count }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(entries: LogEntry[]): PerformanceMetrics {
    // Extract duration from metadata if available
    const durations = entries
      .map((e) => e.metadata?.duration)
      .filter((d): d is number => typeof d === 'number' && d > 0);

    if (durations.length === 0) {
      return {
        avgResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        slowestOperations: [],
      };
    }

    const avgResponseTime = average(durations);
    const p50ResponseTime = percentile(durations, 50);
    const p95ResponseTime = percentile(durations, 95);
    const p99ResponseTime = percentile(durations, 99);

    // Slowest operations
    const slowestEntries = entries
      .filter((e) => typeof e.metadata?.duration === 'number')
      .sort((a, b) => (b.metadata?.duration ?? 0) - (a.metadata?.duration ?? 0))
      .slice(0, 10);

    const slowestOperations = slowestEntries.map((e) => ({
      operation: e.message,
      duration: e.metadata?.duration ?? 0,
    }));

    return {
      avgResponseTime,
      p50ResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      slowestOperations,
    };
  }

  /**
   * Calculate availability metrics
   */
  private calculateAvailabilityMetrics(entries: LogEntry[], timeRange: TimeRange): AvailabilityMetrics {
    const duration = timeRange.end - timeRange.start;

    // Detect incidents (periods with high error rates)
    const incidents = this.detectIncidents(entries, timeRange);
    const downtime = incidents.reduce((sum, i) => sum + (i.end - i.start), 0);
    const uptime = duration - downtime;
    const availabilityRate = uptime / duration;

    // Calculate MTBF (Mean Time Between Failures)
    const mtbf = incidents.length > 0 ? uptime / incidents.length : uptime;

    // Calculate MTTR (Mean Time To Recovery)
    const mttr =
      incidents.length > 0
        ? incidents.reduce((sum, i) => sum + (i.end - i.start), 0) / incidents.length
        : 0;

    return {
      uptime,
      downtime,
      availabilityRate,
      incidents: incidents.length,
      mtbf,
      mttr,
    };
  }

  /**
   * Detect incidents (high error periods)
   */
  private detectIncidents(
    entries: LogEntry[],
    timeRange: TimeRange
  ): Array<{ start: number; end: number; errorCount: number }> {
    const windowSize = 60000; // 1 minute windows
    const errorThreshold = 10; // More than 10 errors per minute
    const incidents: Array<{ start: number; end: number; errorCount: number }> = [];

    const windows = new Map<number, { count: number; errorCount: number }>();

    for (const entry of entries) {
      const windowKey = Math.floor(entry.timestamp / windowSize) * windowSize;
      const window = windows.get(windowKey) ?? { count: 0, errorCount: 0 };
      window.count++;
      if (entry.level >= LogLevel.ERROR) {
        window.errorCount++;
      }
      windows.set(windowKey, window);
    }

    let inIncident = false;
    let incidentStart = 0;
    let incidentErrorCount = 0;

    const sortedWindows = Array.from(windows.entries()).sort((a, b) => a[0] - b[0]);

    for (const [timestamp, window] of sortedWindows) {
      if (window.errorCount > errorThreshold) {
        if (!inIncident) {
          inIncident = true;
          incidentStart = timestamp;
          incidentErrorCount = window.errorCount;
        } else {
          incidentErrorCount += window.errorCount;
        }
      } else {
        if (inIncident) {
          incidents.push({
            start: incidentStart,
            end: timestamp,
            errorCount: incidentErrorCount,
          });
          inIncident = false;
        }
      }
    }

    if (inIncident) {
      incidents.push({
        start: incidentStart,
        end: timeRange.end,
        errorCount: incidentErrorCount,
      });
    }

    return incidents;
  }

  /**
   * Detect anomalies in log data
   */
  public detectAnomalies(entries: LogEntry[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Prepare data for analysis
    const dataPoints = this.prepareDataPoints(entries);

    if (dataPoints.length < this.config.minDataPoints) {
      this.logger.debug('Insufficient data for anomaly detection', {
        count: dataPoints.length,
        required: this.config.minDataPoints,
      });
      return anomalies;
    }

    // Run enabled algorithms
    for (const algorithm of this.config.enabledAlgorithms) {
      try {
        const detected = this.runAnomalyDetection(dataPoints, algorithm);
        anomalies.push(...detected);
      } catch (error) {
        this.logger.error(`Anomaly detection failed for ${algorithm}`, error);
      }
    }

    return anomalies;
  }

  /**
   * Prepare data points for anomaly detection
   */
  private prepareDataPoints(entries: LogEntry[]): Array<{
    timestamp: number;
    count: number;
    errorCount: number;
    responseTime?: number;
  }> {
    const windowSize = this.config.windowSize;
    const windows = new Map<number, { count: number; errorCount: number; responseTimes: number[] }>();

    for (const entry of entries) {
      const windowKey = Math.floor(entry.timestamp / windowSize) * windowSize;
      const window = windows.get(windowKey) ?? {
        count: 0,
        errorCount: 0,
        responseTimes: [],
      };

      window.count++;
      if (entry.level >= LogLevel.ERROR) {
        window.errorCount++;
      }

      if (typeof entry.metadata?.duration === 'number') {
        window.responseTimes.push(entry.metadata.duration);
      }

      windows.set(windowKey, window);
    }

    return Array.from(windows.entries())
      .map(([timestamp, data]) => ({
        timestamp,
        count: data.count,
        errorCount: data.errorCount,
        responseTime: data.responseTimes.length > 0 ? average(data.responseTimes) : undefined,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Run anomaly detection algorithm
   */
  private runAnomalyDetection(
    dataPoints: Array<{ timestamp: number; count: number; errorCount: number; responseTime?: number }>,
    algorithm: AnomalyAlgorithm
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    switch (algorithm) {
      case AnomalyAlgorithm.Z_SCORE:
        anomalies.push(...this.detectZScoreAnomalies(dataPoints));
        break;

      case AnomalyAlgorithm.MOVING_AVERAGE:
        anomalies.push(...this.detectMovingAverageAnomalies(dataPoints));
        break;

      case AnomalyAlgorithm.IQR:
        anomalies.push(...this.detectIQRAnomalies(dataPoints));
        break;

      default:
        this.logger.warn(`Unknown algorithm: ${algorithm}`);
    }

    return anomalies;
  }

  /**
   * Detect anomalies using Z-score
   */
  private detectZScoreAnomalies(
    dataPoints: Array<{ timestamp: number; count: number; errorCount: number; responseTime?: number }>
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Check for volume anomalies
    const counts = dataPoints.map((d) => d.count);
    const mean = average(counts);
    const stdDev = standardDeviation(counts);

    for (const point of dataPoints) {
      const zScore = stdDev > 0 ? Math.abs((point.count - mean) / stdDev) : 0;

      if (zScore > this.config.sensitivity) {
        anomalies.push({
          id: uuidv4(),
          type: point.count > mean ? AnomalyType.SPIKE : AnomalyType.DROP,
          severity: this.getAnomalySeverity(zScore),
          timestamp: point.timestamp,
          description: `Log volume ${point.count > mean ? 'spike' : 'drop'} detected: ${point.count} logs (expected: ${mean.toFixed(2)})`,
          affectedServices: [],
          metrics: {
            expectedValue: mean,
            actualValue: point.count,
            deviation: zScore,
            confidence: Math.min(zScore / this.config.sensitivity, 1),
            baseline: counts,
          },
        });
      }
    }

    // Check for error surges
    const errorCounts = dataPoints.map((d) => d.errorCount);
    const errorMean = average(errorCounts);
    const errorStdDev = standardDeviation(errorCounts);

    for (const point of dataPoints) {
      const zScore = errorStdDev > 0 ? Math.abs((point.errorCount - errorMean) / errorStdDev) : 0;

      if (zScore > this.config.sensitivity && point.errorCount > errorMean) {
        anomalies.push({
          id: uuidv4(),
          type: AnomalyType.ERROR_SURGE,
          severity: this.getAnomalySeverity(zScore),
          timestamp: point.timestamp,
          description: `Error surge detected: ${point.errorCount} errors (expected: ${errorMean.toFixed(2)})`,
          affectedServices: [],
          metrics: {
            expectedValue: errorMean,
            actualValue: point.errorCount,
            deviation: zScore,
            confidence: Math.min(zScore / this.config.sensitivity, 1),
            baseline: errorCounts,
          },
        });
      }
    }

    return anomalies;
  }

  /**
   * Detect anomalies using moving average
   */
  private detectMovingAverageAnomalies(
    dataPoints: Array<{ timestamp: number; count: number; errorCount: number }>
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const windowSize = 5;

    for (let i = windowSize; i < dataPoints.length; i++) {
      const window = dataPoints.slice(i - windowSize, i);
      const avg = average(window.map((d) => d.count));
      const current = dataPoints[i].count;

      const deviation = Math.abs(current - avg) / (avg || 1);

      if (deviation > this.config.sensitivity / 2) {
        anomalies.push({
          id: uuidv4(),
          type: current > avg ? AnomalyType.SPIKE : AnomalyType.DROP,
          severity: this.getAnomalySeverity(deviation),
          timestamp: dataPoints[i].timestamp,
          description: `Moving average anomaly: ${current} logs (average: ${avg.toFixed(2)})`,
          affectedServices: [],
          metrics: {
            expectedValue: avg,
            actualValue: current,
            deviation,
            confidence: Math.min(deviation / (this.config.sensitivity / 2), 1),
            baseline: window.map((d) => d.count),
          },
        });
      }
    }

    return anomalies;
  }

  /**
   * Detect anomalies using IQR (Interquartile Range)
   */
  private detectIQRAnomalies(
    dataPoints: Array<{ timestamp: number; count: number }>
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    const counts = dataPoints.map((d) => d.count).sort((a, b) => a - b);
    const q1 = percentile(counts, 25);
    const q3 = percentile(counts, 75);
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    for (const point of dataPoints) {
      if (point.count < lowerBound || point.count > upperBound) {
        const deviation = Math.abs(point.count - (q1 + q3) / 2) / (iqr || 1);

        anomalies.push({
          id: uuidv4(),
          type: point.count > upperBound ? AnomalyType.SPIKE : AnomalyType.DROP,
          severity: this.getAnomalySeverity(deviation),
          timestamp: point.timestamp,
          description: `IQR anomaly: ${point.count} logs (bounds: ${lowerBound.toFixed(2)} - ${upperBound.toFixed(2)})`,
          affectedServices: [],
          metrics: {
            expectedValue: (q1 + q3) / 2,
            actualValue: point.count,
            deviation,
            confidence: Math.min(deviation / 1.5, 1),
            baseline: counts,
          },
        });
      }
    }

    return anomalies;
  }

  /**
   * Get anomaly severity from z-score or deviation
   */
  private getAnomalySeverity(deviation: number): AnomalySeverity {
    if (deviation < 2) return AnomalySeverity.LOW;
    if (deviation < 3) return AnomalySeverity.MEDIUM;
    if (deviation < 4) return AnomalySeverity.HIGH;
    return AnomalySeverity.CRITICAL;
  }

  /**
   * Add historical data point
   */
  public addHistoricalDataPoint(timestamp: number, count: number, errorCount: number): void {
    this.historicalData.push({ timestamp, count, errorCount });

    // Keep only recent data
    if (this.historicalData.length > this.maxHistoricalPoints) {
      this.historicalData = this.historicalData.slice(-this.maxHistoricalPoints);
    }
  }

  /**
   * Get historical data
   */
  public getHistoricalData(timeRange?: TimeRange): Array<{
    timestamp: number;
    count: number;
    errorCount: number;
  }> {
    if (!timeRange) {
      return [...this.historicalData];
    }

    return this.historicalData.filter(
      (d) => d.timestamp >= timeRange.start && d.timestamp <= timeRange.end
    );
  }

  /**
   * Get analytics stats
   */
  public getStats(): {
    historicalDataPoints: number;
    config: Required<AnalyticsConfig>;
  } {
    return {
      historicalDataPoints: this.historicalData.length,
      config: this.config,
    };
  }
}

/**
 * Create a log analytics instance
 */
export function createLogAnalytics(config?: AnalyticsConfig): LogAnalytics {
  return new LogAnalytics(config);
}
