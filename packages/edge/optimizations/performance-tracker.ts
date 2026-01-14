/**
 * Performance Tracker
 *
 * Comprehensive performance monitoring and metrics collection
 * for tracking bundle size, cold starts, memory usage, and latency.
 *
 * Features:
 * - Real-time metrics collection
 * - Performance percentile tracking
 * - Alert generation
 * - Export to monitoring systems
 */

/**
 * Performance metric
 */
export interface PerformanceMetric {
  /** Metric name */
  name: string;
  /** Metric value */
  value: number;
  /** Unit */
  unit: 'ms' | 'bytes' | 'count' | 'percentage';
  /** Timestamp */
  timestamp: number;
  /** Tags/labels */
  tags?: Record<string, string>;
}

/**
 * Performance histogram
 */
export interface PerformanceHistogram {
  /** Metric name */
  name: string;
  /** Count of observations */
  count: number;
  /** Sum of values */
  sum: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Mean */
  mean: number;
  /** Percentiles */
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

/**
 * Performance alert
 */
export interface PerformanceAlert {
  /** Alert ID */
  id: string;
  /** Severity */
  severity: 'info' | 'warning' | 'critical';
  /** Alert message */
  message: string;
  /** Metric name */
  metric: string;
  /** Current value */
  value: number;
  /** Threshold */
  threshold: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Performance tracker configuration
 */
export interface PerformanceTrackerConfig {
  /** Enable tracking */
  enabled?: boolean;
  /** Sample rate (0-1) */
  sampleRate?: number;
  /** Alert thresholds */
  thresholds?: {
    coldStartMs?: number;
    hotPathMs?: number;
    memoryUsagePercentage?: number;
    cacheHitRate?: number;
    bundleSizeBytes?: number;
  };
  /** Retention period (ms) */
  retention?: number;
}

/**
 * Performance tracker
 */
export class PerformanceTracker {
  private config: Required<PerformanceTrackerConfig>;
  private metrics: Map<string, PerformanceMetric[]>;
  private histograms: Map<string, number[]>;
  private alerts: PerformanceAlert[];
  private startTime: number;

  constructor(config: PerformanceTrackerConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      sampleRate: config.sampleRate ?? 1.0,
      thresholds: {
        coldStartMs: config.thresholds?.coldStartMs ?? 100,
        hotPathMs: config.thresholds?.hotPathMs ?? 50,
        memoryUsagePercentage: config.thresholds?.memoryUsagePercentage ?? 90,
        cacheHitRate: config.thresholds?.cacheHitRate ?? 0.5,
        bundleSizeBytes: config.thresholds?.bundleSizeBytes ?? 3 * 1024 * 1024,
      },
      retention: config.retention ?? 60 * 60 * 1000, // 1 hour
    };

    this.metrics = new Map();
    this.histograms = new Map();
    this.alerts = [];
    this.startTime = Date.now();

    // Start cleanup timer
    this.startCleanup();
  }

  /**
   * Track latency
   */
  trackLatency(operation: string, duration: number, tags?: Record<string, string>): void {
    if (!this.config.enabled) return;
    if (Math.random() > this.config.sampleRate) return;

    this.recordMetric({
      name: `${operation}.latency`,
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      tags,
    });

    // Add to histogram
    this.addToHistogram(`${operation}.latency`, duration);

    // Check thresholds
    if (operation === 'cold_start' && duration > this.config.thresholds.coldStartMs) {
      this.createAlert(
        'warning',
        'Cold start latency exceeded threshold',
        'cold_start.latency',
        duration,
        this.config.thresholds.coldStartMs
      );
    }

    if (operation === 'hot_path' && duration > this.config.thresholds.hotPathMs) {
      this.createAlert(
        'warning',
        'Hot path latency exceeded threshold',
        'hot_path.latency',
        duration,
        this.config.thresholds.hotPathMs
      );
    }
  }

  /**
   * Track bundle size
   */
  trackBundleSize(size: number, chunk?: string): void {
    if (!this.config.enabled) return;

    this.recordMetric({
      name: 'bundle.size',
      value: size,
      unit: 'bytes',
      timestamp: Date.now(),
      tags: chunk ? { chunk } : undefined,
    });

    // Check threshold
    if (size > this.config.thresholds.bundleSizeBytes) {
      this.createAlert(
        'critical',
        `Bundle size exceeded threshold: ${chunk ?? 'total'}`,
        'bundle.size',
        size,
        this.config.thresholds.bundleSizeBytes
      );
    }
  }

  /**
   * Track memory usage
   */
  trackMemoryUsage(used: number, total: number, tags?: Record<string, string>): void {
    if (!this.config.enabled) return;

    const percentage = (used / total) * 100;

    this.recordMetric({
      name: 'memory.usage',
      value: percentage,
      unit: 'percentage',
      timestamp: Date.now(),
      tags: {
        ...tags,
        usedBytes: used.toString(),
        totalBytes: total.toString(),
      },
    });

    // Check threshold
    if (percentage > this.config.thresholds.memoryUsagePercentage) {
      this.createAlert(
        'critical',
        'Memory usage exceeded threshold',
        'memory.usage',
        percentage,
        this.config.thresholds.memoryUsagePercentage
      );
    }
  }

  /**
   * Track cache hit rate
   */
  trackCacheHitRate(hitRate: number, cacheType: string): void {
    if (!this.config.enabled) return;

    this.recordMetric({
      name: 'cache.hit_rate',
      value: hitRate * 100,
      unit: 'percentage',
      timestamp: Date.now(),
      tags: { type: cacheType },
    });

    // Check threshold (low hit rate is warning)
    if (hitRate < this.config.thresholds.cacheHitRate) {
      this.createAlert(
        'warning',
        `Cache hit rate below threshold: ${cacheType}`,
        'cache.hit_rate',
        hitRate,
        this.config.thresholds.cacheHitRate
      );
    }
  }

  /**
   * Track custom metric
   */
  trackMetric(
    name: string,
    value: number,
    unit: 'ms' | 'bytes' | 'count' | 'percentage',
    tags?: Record<string, string>
  ): void {
    if (!this.config.enabled) return;

    this.recordMetric({
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags,
    });
  }

  /**
   * Start a latency timer
   */
  startTimer(operation: string): () => void {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.trackLatency(operation, duration);
    };
  }

  /**
   * Record metric
   */
  private recordMetric(metric: PerformanceMetric): void {
    const metrics = this.metrics.get(metric.name) || [];
    metrics.push(metric);
    this.metrics.set(metric.name, metrics);
  }

  /**
   * Add value to histogram
   */
  private addToHistogram(name: string, value: number): void {
    const values = this.histograms.get(name) || [];
    values.push(value);
    this.histograms.set(name, values);
  }

  /**
   * Create alert
   */
  private createAlert(
    severity: PerformanceAlert['severity'],
    message: string,
    metric: string,
    value: number,
    threshold: number
  ): void {
    const alert: PerformanceAlert = {
      id: crypto.randomUUID(),
      severity,
      message,
      metric,
      value,
      threshold,
      timestamp: Date.now(),
    };

    this.alerts.push(alert);

    // Log critical alerts
    if (severity === 'critical') {
      console.error(`[PERFORMANCE ALERT] ${message}`, {
        metric,
        value,
        threshold,
      });
    }
  }

  /**
   * Get histogram statistics
   */
  getHistogram(name: string): PerformanceHistogram | null {
    const values = this.histograms.get(name);
    if (!values || values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const min = sorted[0];
    const max = sorted[count - 1];
    const mean = sum / count;

    const percentiles = {
      p50: sorted[Math.floor(count * 0.5)],
      p90: sorted[Math.floor(count * 0.9)],
      p95: sorted[Math.floor(count * 0.95)],
      p99: sorted[Math.floor(count * 0.99)],
    };

    return {
      name,
      count,
      sum,
      min,
      max,
      mean,
      percentiles,
    };
  }

  /**
   * Get all histograms
   */
  getAllHistograms(): Map<string, PerformanceHistogram> {
    const result = new Map<string, PerformanceHistogram>();

    for (const [name] of this.histograms.entries()) {
      const histogram = this.getHistogram(name);
      if (histogram) {
        result.set(name, histogram);
      }
    }

    return result;
  }

  /**
   * Get metrics for a name
   */
  getMetrics(name: string): PerformanceMetric[] {
    return this.metrics.get(name) || [];
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, PerformanceMetric[]> {
    return new Map(this.metrics.entries());
  }

  /**
   * Get alerts
   */
  getAlerts(severity?: PerformanceAlert['severity']): PerformanceAlert[] {
    if (severity) {
      return this.alerts.filter((a) => a.severity === severity);
    }
    return [...this.alerts];
  }

  /**
   * Clear alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    uptime: number;
    totalMetrics: number;
    totalAlerts: number;
    histograms: Map<string, PerformanceHistogram>;
    recentAlerts: PerformanceAlert[];
  } {
    let totalMetrics = 0;
    for (const metrics of this.metrics.values()) {
      totalMetrics += metrics.length;
    }

    const recentAlerts = this.alerts
      .filter((a) => Date.now() - a.timestamp < 60000) // Last minute
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    return {
      uptime: Date.now() - this.startTime,
      totalMetrics,
      totalAlerts: this.alerts.length,
      histograms: this.getAllHistograms(),
      recentAlerts,
    };
  }

  /**
   * Export metrics for external monitoring
   */
  exportMetrics(format: 'prometheus' | 'json' = 'json'): string {
    if (format === 'prometheus') {
      return this.exportPrometheus();
    }
    return JSON.stringify(this.getSummary(), null, 2);
  }

  /**
   * Export in Prometheus format
   */
  private exportPrometheus(): string {
    const lines: string[] = [];

    for (const [name, histogram] of this.getAllHistograms()) {
      const safeName = name.replace(/\./g, '_');
      lines.push(`# HELP ${safeName} Performance metric`);
      lines.push(`# TYPE ${safeName} summary`);

      lines.push(
        `${safeName}_count ${histogram.count}`,
        `${safeName}_sum ${histogram.sum}`,
        `${safeName}${safeName === 'cold_start_latency' ? '' : '}_min'} ${histogram.min}`,
        `${safeName}_max ${histogram.max}`,
        `${safeName}_mean ${histogram.mean}`,
        `${safeName}{quantile="0.5"} ${histogram.percentiles.p50}`,
        `${safeName}{quantile="0.9"} ${histogram.percentiles.p90}`,
        `${safeName}{quantile="0.95"} ${histogram.percentiles.p95}`,
        `${safeName}{quantile="0.99"} ${histogram.percentiles.p99}`
      );
    }

    return lines.join('\n');
  }

  /**
   * Start cleanup timer
   */
  private startCleanup(): void {
    setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute
  }

  /**
   * Cleanup old metrics
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.config.retention;

    // Cleanup old metrics
    for (const [name, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter((m) => m.timestamp > cutoff);
      this.metrics.set(name, filtered);
    }

    // Cleanup old histograms (keep last 1000)
    for (const [name, values] of this.histograms.entries()) {
      if (values.length > 1000) {
        this.histograms.set(name, values.slice(-1000));
      }
    }

    // Cleanup old alerts (keep last 100)
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.histograms.clear();
    this.alerts = [];
    this.startTime = Date.now();
  }
}

/**
 * Global performance tracker instance
 */
let globalTracker: PerformanceTracker | null = null;

/**
 * Get global tracker instance
 */
export function getPerformanceTracker(config?: PerformanceTrackerConfig): PerformanceTracker {
  if (!globalTracker) {
    globalTracker = new PerformanceTracker(config);
  }
  return globalTracker;
}

/**
 * Measure function execution time
 */
export function measurePerformance<T>(
  operation: string,
  fn: () => Promise<T>,
  tracker?: PerformanceTracker
): Promise<T> {
  const perfTracker = tracker ?? getPerformanceTracker();
  const endTimer = perfTracker.startTimer(operation);

  return fn().finally(() => {
    endTimer();
  });
}

/**
 * Create performance tracking middleware for Hono
 */
export function createPerformanceMiddleware(
  tracker: PerformanceTracker
): (c: any, next: () => Promise<void>) => Promise<void> {
  return async (c: any, next: () => Promise<void>) => {
    const endTimer = tracker.startTimer('request');

    try {
      await next();
    } finally {
      endTimer();
    }
  };
}

/**
 * Performance targets for validation
 */
export const performanceTargets = {
  /** Cold start: <100ms */
  coldStart: {
    target: 100,
    excellent: 50,
    acceptable: 150,
  },

  /** Hot path: <50ms */
  hotPath: {
    target: 50,
    excellent: 25,
    acceptable: 75,
  },

  /** Memory: <90% usage */
  memoryUsage: {
    target: 90,
    excellent: 70,
    acceptable: 95,
  },

  /** Cache hit rate: >90% */
  cacheHitRate: {
    target: 90,
    excellent: 95,
    acceptable: 80,
  },

  /** Bundle size: <3MB */
  bundleSize: {
    target: 3 * 1024 * 1024,
    excellent: 1.5 * 1024 * 1024,
    acceptable: 4 * 1024 * 1024,
  },
};

/**
 * Validate performance against targets
 */
export function validatePerformance(
  tracker: PerformanceTracker
): {
  passed: boolean;
  results: Array<{
    metric: string;
    target: number;
    actual: number;
    status: 'excellent' | 'target' | 'acceptable' | 'failed';
  }>;
} {
  const results: Array<{
    metric: string;
    target: number;
    actual: number;
    status: 'excellent' | 'target' | 'acceptable' | 'failed';
  }> = [];

  // Check cold start
  const coldStartHistogram = tracker.getHistogram('cold_start.latency');
  if (coldStartHistogram) {
    const p95 = coldStartHistogram.percentiles.p95;
    let status: 'excellent' | 'target' | 'acceptable' | 'failed';
    if (p95 <= performanceTargets.coldStart.excellent) status = 'excellent';
    else if (p95 <= performanceTargets.coldStart.target) status = 'target';
    else if (p95 <= performanceTargets.coldStart.acceptable) status = 'acceptable';
    else status = 'failed';

    results.push({
      metric: 'cold_start.p95',
      target: performanceTargets.coldStart.target,
      actual: p95,
      status,
    });
  }

  // Check hot path
  const hotPathHistogram = tracker.getHistogram('hot_path.latency');
  if (hotPathHistogram) {
    const p95 = hotPathHistogram.percentiles.p95;
    let status: 'excellent' | 'target' | 'acceptable' | 'failed';
    if (p95 <= performanceTargets.hotPath.excellent) status = 'excellent';
    else if (p95 <= performanceTargets.hotPath.target) status = 'target';
    else if (p95 <= performanceTargets.hotPath.acceptable) status = 'acceptable';
    else status = 'failed';

    results.push({
      metric: 'hot_path.p95',
      target: performanceTargets.hotPath.target,
      actual: p95,
      status,
    });
  }

  const passed = results.every((r) => r.status !== 'failed');

  return { passed, results };
}
