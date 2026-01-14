/**
 * Metrics and monitoring utilities
 */

import {
  CacheTier,
  LatencyStats,
  TierStats,
  SizeStats,
  CacheStats,
} from '../types';

// ============================================================================
// Metrics Collection
// ============================================================================

export class MetricsCollector {
  private hits = new Map<CacheTier, number>();
  private misses = new Map<CacheTier, number>();
  private latencies = new Map<CacheTier, number[]>();
  private sizes = new Map<CacheTier, number[]>();
  private startTimes = new Map<string, number>();
  private compressionRatios: number[] = [];

  constructor() {
    // Initialize tier-specific metrics
    Object.values(CacheTier).forEach(tier => {
      this.hits.set(tier, 0);
      this.misses.set(tier, 0);
      this.latencies.set(tier, []);
      this.sizes.set(tier, []);
    });
  }

  /**
   * Record a cache hit
   */
  recordHit(tier: CacheTier): void {
    const current = this.hits.get(tier) || 0;
    this.hits.set(tier, current + 1);
  }

  /**
   * Record a cache miss
   */
  recordMiss(tier: CacheTier): void {
    const current = this.misses.get(tier) || 0;
    this.misses.set(tier, current + 1);
  }

  /**
   * Record latency for a tier
   */
  recordLatency(tier: CacheTier, latency: number): void {
    const latencies = this.latencies.get(tier) || [];
    latencies.push(latency);
    this.latencies.set(tier, latencies);

    // Keep only last 1000 measurements
    if (latencies.length > 1000) {
      latencies.shift();
    }
  }

  /**
   * Record size for a tier
   */
  recordSize(tier: CacheTier, size: number): void {
    const sizes = this.sizes.get(tier) || [];
    sizes.push(size);
    this.sizes.set(tier, sizes);

    // Keep only last 1000 measurements
    if (sizes.length > 1000) {
      sizes.shift();
    }
  }

  /**
   * Record compression ratio
   */
  recordCompressionRatio(ratio: number): void {
    this.compressionRatios.push(ratio);

    // Keep only last 1000 measurements
    if (this.compressionRatios.length > 1000) {
      this.compressionRatios.shift();
    }
  }

  /**
   * Start timing an operation
   */
  startTiming(key: string): void {
    this.startTimes.set(key, performance.now());
  }

  /**
   * End timing an operation and return duration
   */
  endTiming(key: string): number | null {
    const startTime = this.startTimes.get(key);
    if (startTime === undefined) {
      return null;
    }
    this.startTimes.delete(key);
    return performance.now() - startTime;
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  /**
   * Calculate statistics for an array of numbers
   */
  private calculateStats(values: number[]) {
    if (values.length === 0) {
      return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, v) => acc + v, 0);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / values.length,
      p50: this.calculatePercentile(values, 50),
      p95: this.calculatePercentile(values, 95),
      p99: this.calculatePercentile(values, 99),
    };
  }

  /**
   * Get tier stats
   */
  getTierStats(): TierStats {
    const stats: TierStats = {
      L1: { hits: 0, misses: 0, size: 0 },
      L2: { hits: 0, misses: 0, size: 0 },
      L3: { hits: 0, misses: 0, size: 0 },
    };

    Object.values(CacheTier).forEach(tier => {
      stats[tier] = {
        hits: this.hits.get(tier) || 0,
        misses: this.misses.get(tier) || 0,
        size: (this.sizes.get(tier) || []).reduce((acc, v) => acc + v, 0),
      };
    });

    return stats;
  }

  /**
   * Get latency stats
   */
  getLatencyStats(): LatencyStats {
    const stats: LatencyStats = {} as any;

    Object.values(CacheTier).forEach(tier => {
      const latencies = this.latencies.get(tier) || [];
      stats[tier] = this.calculateStats(latencies);
    });

    return stats;
  }

  /**
   * Get size stats
   */
  getSizeStats(): SizeStats {
    const tierStats = this.getTierStats();
    const total = tierStats.L1.size + tierStats.L2.size + tierStats.L3.size;

    return {
      total,
      L1: tierStats.L1.size,
      L2: tierStats.L2.size,
      L3: tierStats.L3.size,
      compressionRatio: this.calculateAverage(this.compressionRatios),
    };
  }

  /**
   * Calculate average
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((acc, v) => acc + v, 0) / values.length;
  }

  /**
   * Get complete cache stats
   */
  getStats(): CacheStats {
    const tierStats = this.getTierStats();
    const totalHits = Object.values(tierStats).reduce((acc, s) => acc + s.hits, 0);
    const totalMisses = Object.values(tierStats).reduce((acc, s) => acc + s.misses, 0);
    const totalRequests = totalHits + totalMisses;

    return {
      hits: totalHits,
      misses: totalMisses,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      totalRequests,
      tierDistribution: tierStats,
      latencyStats: this.getLatencyStats(),
      sizeStats: this.getSizeStats(),
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    Object.values(CacheTier).forEach(tier => {
      this.hits.set(tier, 0);
      this.misses.set(tier, 0);
      this.latencies.set(tier, []);
      this.sizes.set(tier, []);
    });
    this.startTimes.clear();
    this.compressionRatios = [];
  }

  /**
   * Get metrics as JSON
   */
  toJSON(): string {
    return JSON.stringify(this.getStats());
  }
}

// ============================================================================
// Performance Monitoring
// ============================================================================

export class PerformanceMonitor {
  private measurements = new Map<string, number[]>();
  private thresholds = new Map<string, number>();

  /**
   * Set a performance threshold
   */
  setThreshold(metric: string, threshold: number): void {
    this.thresholds.set(metric, threshold);
  }

  /**
   * Record a measurement
   */
  record(metric: string, value: number): void {
    const measurements = this.measurements.get(metric) || [];
    measurements.push(value);

    // Keep only last 100 measurements
    if (measurements.length > 100) {
      measurements.shift();
    }

    this.measurements.set(metric, measurements);
  }

  /**
   * Check if a metric exceeds its threshold
   */
  exceedsThreshold(metric: string): boolean {
    const threshold = this.thresholds.get(metric);
    if (threshold === undefined) {
      return false;
    }

    const measurements = this.measurements.get(metric) || [];
    if (measurements.length === 0) {
      return false;
    }

    const latest = measurements[measurements.length - 1];
    return latest > threshold;
  }

  /**
   * Get average for a metric
   */
  getAverage(metric: string): number {
    const measurements = this.measurements.get(metric) || [];
    if (measurements.length === 0) {
      return 0;
    }
    return measurements.reduce((acc, v) => acc + v, 0) / measurements.length;
  }

  /**
   * Get percentile for a metric
   */
  getPercentile(metric: string, percentile: number): number {
    const measurements = this.measurements.get(metric) || [];
    if (measurements.length === 0) {
      return 0;
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  /**
   * Get all metrics
   */
  getMetrics(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const result: Record<string, { avg: number; min: number; max: number; count: number }> = {};

    this.measurements.forEach((measurements, metric) => {
      if (measurements.length > 0) {
        const sorted = [...measurements].sort((a, b) => a - b);
        result[metric] = {
          avg: measurements.reduce((acc, v) => acc + v, 0) / measurements.length,
          min: sorted[0],
          max: sorted[sorted.length - 1],
          count: measurements.length,
        };
      }
    });

    return result;
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements.clear();
  }
}

// ============================================================================
// Alert System
// ============================================================================

export interface Alert {
  type: 'threshold' | 'anomaly' | 'capacity';
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
  message: string;
}

export class AlertSystem {
  private alerts: Alert[] = [];
  private handlers = new Map<string, (alert: Alert) => void>();
  private thresholds = new Map<string, { min?: number; max?: number }>();

  /**
   * Set a threshold for a metric
   */
  setThreshold(metric: string, min?: number, max?: number): void {
    this.thresholds.set(metric, { min, max });
  }

  /**
   * Register a handler for alerts
   */
  onAlert(metric: string, handler: (alert: Alert) => void): void {
    this.handlers.set(metric, handler);
  }

  /**
   * Check a metric value against thresholds
   */
  check(metric: string, value: number): void {
    const threshold = this.thresholds.get(metric);
    if (!threshold) {
      return;
    }

    if (threshold.min !== undefined && value < threshold.min) {
      this.trigger({
        type: 'threshold',
        metric,
        value,
        threshold: threshold.min,
        timestamp: Date.now(),
        message: `${metric} (${value}) is below minimum threshold (${threshold.min})`,
      });
    }

    if (threshold.max !== undefined && value > threshold.max) {
      this.trigger({
        type: 'threshold',
        metric,
        value,
        threshold: threshold.max,
        timestamp: Date.now(),
        message: `${metric} (${value}) exceeds maximum threshold (${threshold.max})`,
      });
    }
  }

  /**
   * Trigger an alert
   */
  private trigger(alert: Alert): void {
    this.alerts.push(alert);

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts.shift();
    }

    // Call handler if registered
    const handler = this.handlers.get(alert.metric);
    if (handler) {
      handler(alert);
    }
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit?: number): Alert[] {
    if (limit) {
      return this.alerts.slice(-limit);
    }
    return [...this.alerts];
  }

  /**
   * Clear alerts
   */
  clear(): void {
    this.alerts = [];
  }
}

// ============================================================================
// Export Helpers
// ============================================================================

/**
 * Format metrics for export
 */
export function formatMetricsForExport(stats: CacheStats): string {
  return JSON.stringify({
    timestamp: Date.now(),
    stats,
    version: '2.0.0',
  });
}

/**
 * Convert metrics to Prometheus format
 */
export function toPrometheusFormat(stats: CacheStats): string {
  const lines: string[] = [];

  // Hit rate
  lines.push(`cache_hit_rate{tier="all"} ${stats.hitRate}`);

  // Tier-specific metrics
  Object.entries(stats.tierDistribution).forEach(([tier, data]) => {
    lines.push(`cache_hits{tier="${tier}"} ${data.hits}`);
    lines.push(`cache_misses{tier="${tier}"} ${data.misses}`);
    lines.push(`cache_size{tier="${tier}"} ${data.size}`);
  });

  // Latency metrics
  Object.entries(stats.latencyStats).forEach(([tier, data]) => {
    lines.push(`cache_latency_avg{tier="${tier}"} ${data.avg}`);
    lines.push(`cache_latency_p95{tier="${tier}"} ${data.p95}`);
    lines.push(`cache_latency_p99{tier="${tier}"} ${data.p99}`);
  });

  return lines.join('\n');
}
