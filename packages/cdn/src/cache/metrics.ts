/**
 * Cache Metrics
 *
 * Advanced metrics collection and reporting for cache performance.
 */

import { EventEmitter } from 'events';
import type { ICacheStats, ICacheMetricsConfig, ICacheMetricsSnapshot, ICacheMetricsReport } from '../types/index.js';

export class CacheMetrics extends EventEmitter {
  private snapshots: ICacheMetricsSnapshot[] = [];
  private currentSnapshot: ICacheMetricsSnapshot;
  private config: ICacheMetricsConfig;

  constructor(config?: Partial<ICacheMetricsConfig>) {
    super();

    this.config = {
      retentionPeriod: config?.retentionPeriod ?? 3600000, // 1 hour
      sampleInterval: config?.sampleInterval ?? 60000, // 1 minute
      enableRealTime: config?.enableRealTime ?? true,
      enableHistorical: config?.enableHistorical ?? true,
      aggregationWindow: config?.aggregationWindow ?? 300000 // 5 minutes
    };

    this.currentSnapshot = this.createSnapshot();

    // Start sampling
    if (this.config.enableRealTime || this.config.enableHistorical) {
      this.startSampling();
    }
  }

  /**
   * Record cache hit
   */
  public recordHit(responseTime: number, size: number): void {
    this.currentSnapshot.hits++;
    this.currentSnapshot.totalResponseTime += responseTime;
    this.currentSnapshot.responseTimes.push(responseTime);
    this.currentSnapshot.savedBandwidth += size;

    this.emit('hit', { responseTime, size });
  }

  /**
   * Record cache miss
   */
  public recordMiss(responseTime: number, size: number): void {
    this.currentSnapshot.misses++;
    this.currentSnapshot.totalResponseTime += responseTime;
    this.currentSnapshot.responseTimes.push(responseTime);
    this.currentSnapshot.totalBandwidth += size;

    this.emit('miss', { responseTime, size });
  }

  /**
   * Record stale hit
   */
  public recordStaleHit(responseTime: number, size: number): void {
    this.currentSnapshot.staleHits++;
    this.currentSnapshot.totalResponseTime += responseTime;
    this.currentSnapshot.responseTimes.push(responseTime);
    this.currentSnapshot.savedBandwidth += size;

    this.emit('stale_hit', { responseTime, size });
  }

  /**
   * Record bypass
   */
  public recordBypass(responseTime: number, size: number): void {
    this.currentSnapshot.bypasses++;
    this.currentSnapshot.totalResponseTime += responseTime;
    this.currentSnapshot.responseTimes.push(responseTime);
    this.currentSnapshot.totalBandwidth += size;

    this.emit('bypass', { responseTime, size });
  }

  /**
   * Get current statistics
   */
  public getStats(): ICacheStats {
    const total = this.currentSnapshot.hits + this.currentSnapshot.misses;
    const hitRate = total > 0 ? (this.currentSnapshot.hits / total) * 100 : 0;
    const missRate = total > 0 ? (this.currentSnapshot.misses / total) * 100 : 0;
    const avgResponseTime =
      this.currentSnapshot.responseTimes.length > 0
        ? this.currentSnapshot.totalResponseTime / this.currentSnapshot.responseTimes.length
        : 0;

    const responseTimes = [...this.currentSnapshot.responseTimes].sort((a, b) => a - b);
    const p50 = this.getPercentile(responseTimes, 50);
    const p95 = this.getPercentile(responseTimes, 95);
    const p99 = this.getPercentile(responseTimes, 99);

    return {
      hits: this.currentSnapshot.hits,
      misses: this.currentSnapshot.misses,
      staleHits: this.currentSnapshot.staleHits,
      bypasses: this.currentSnapshot.bypasses,
      hitRate,
      missRate,
      avgResponseTime,
      totalBandwidth: this.currentSnapshot.totalBandwidth,
      savedBandwidth: this.currentSnapshot.savedBandwidth,
      compressionRatio: this.calculateCompressionRatio()
    };
  }

  /**
   * Get metrics report
   */
  public getReport(): ICacheMetricsReport {
    const stats = this.getStats();
    const now = Date.now();

    return {
      timestamp: new Date(now),
      period: {
        start: new Date(now - this.config.retentionPeriod),
        end: new Date(now)
      },
      stats,
      performance: {
        p50: this.getPercentile(
          [...this.currentSnapshot.responseTimes].sort((a, b) => a - b),
          50
        ),
        p95: this.getPercentile(
          [...this.currentSnapshot.responseTimes].sort((a, b) => a - b),
          95
        ),
        p99: this.getPercentile(
          [...this.currentSnapshot.responseTimes].sort((a, b) => a - b),
          99
        )
      },
      trends: this.calculateTrends(),
      alerts: this.checkAlerts()
    };
  }

  /**
   * Reset metrics
   */
  public reset(): void {
    this.currentSnapshot = this.createSnapshot();
    this.snapshots = [];
    this.emit('reset');
  }

  /**
   * Get historical snapshots
   */
  public getSnapshots(count?: number): ICacheMetricsSnapshot[] {
    const snapshots = this.snapshots.slice(-count ?? this.snapshots.length);
    return snapshots;
  }

  /**
   * Start sampling
   */
  private startSampling(): void {
    setInterval(() => {
      this.takeSnapshot();
    }, this.config.sampleInterval);
  }

  /**
   * Take snapshot of current metrics
   */
  private takeSnapshot(): void {
    if (!this.config.enableHistorical) return;

    const snapshot = { ...this.currentSnapshot };
    this.snapshots.push(snapshot);

    // Remove old snapshots outside retention period
    const cutoff = Date.now() - this.config.retentionPeriod;
    this.snapshots = this.snapshots.filter(s => s.timestamp.getTime() > cutoff);

    this.emit('snapshot', snapshot);
  }

  /**
   * Create new snapshot
   */
  private createSnapshot(): ICacheMetricsSnapshot {
    return {
      timestamp: new Date(),
      hits: 0,
      misses: 0,
      staleHits: 0,
      bypasses: 0,
      totalResponseTime: 0,
      responseTimes: [],
      totalBandwidth: 0,
      savedBandwidth: 0
    };
  }

  /**
   * Calculate percentile
   */
  private getPercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  /**
   * Calculate compression ratio
   */
  private calculateCompressionRatio(): number {
    if (this.currentSnapshot.totalBandwidth === 0) return 0;
    return (
      (this.currentSnapshot.savedBandwidth / this.currentSnapshot.totalBandwidth) * 100
    );
  }

  /**
   * Calculate trends
   */
  private calculateTrends(): {
    hitRate: number;
    responseTime: number;
    bandwidth: number;
  } {
    if (this.snapshots.length < 2) {
      return { hitRate: 0, responseTime: 0, bandwidth: 0 };
    }

    const recent = this.snapshots.slice(-10);
    const older = this.snapshots.slice(-20, -10);

    const recentHitRate =
      recent.reduce((sum, s) => sum + s.hits, 0) /
      recent.reduce((sum, s) => sum + s.hits + s.misses, 0);
    const olderHitRate =
      older.reduce((sum, s) => sum + s.hits, 0) /
      older.reduce((sum, s) => sum + s.hits + s.misses, 0);

    const recentAvgResponse =
      recent.reduce((sum, s) => sum + s.totalResponseTime, 0) /
      recent.reduce((sum, s) => sum + s.responseTimes.length, 0);
    const olderAvgResponse =
      older.reduce((sum, s) => sum + s.totalResponseTime, 0) /
      older.reduce((sum, s) => sum + s.responseTimes.length, 0);

    return {
      hitRate: ((recentHitRate - olderHitRate) / olderHitRate) * 100,
      responseTime: ((recentAvgResponse - olderAvgResponse) / olderAvgResponse) * 100,
      bandwidth: 0 // Simplified
    };
  }

  /**
   * Check for alerts
   */
  private checkAlerts(): string[] {
    const alerts: string[] = [];
    const stats = this.getStats();

    if (stats.hitRate < 50) {
      alerts.push('Low cache hit rate detected');
    }

    if (stats.avgResponseTime > 1000) {
      alerts.push('High average response time detected');
    }

    return alerts;
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.removeAllListeners();
    this.snapshots = [];
  }
}

export default CacheMetrics;
