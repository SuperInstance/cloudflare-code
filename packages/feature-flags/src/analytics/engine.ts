/**
 * Analytics Engine - Comprehensive analytics for feature flags
 * Tracks evaluations, conversions, metrics, and provides insights
 */

import type {
  FlagEvaluation,
  FlagMetrics,
  Event,
  MetricsPeriod,
  VariantMetrics,
  FlagStorageEnv,
  EvaluationDetails,
  UserAttributes,
} from '../types/index.js';

// ============================================================================
// Analytics Configuration
// ============================================================================

export interface AnalyticsConfig {
  enabled: boolean;
  sampleRate: number; // 0-1
  batchSize: number;
  flushInterval: number; // milliseconds
  retentionPeriod: number; // milliseconds
}

// ============================================================================
// Metrics Collector
// ============================================================================

export class MetricsCollector {
  private counters: Map<string, number>;
  private gauges: Map<string, number>;
  private histograms: Map<string, number[]>;
  private timers: Map<string, number[]>;

  constructor() {
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.timers = new Map();
  }

  increment(key: string, value: number = 1): void {
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  decrement(key: string, value: number = 1): void {
    this.increment(key, -value);
  }

  gauge(key: string, value: number): void {
    this.gauges.set(key, value);
  }

  histogram(key: string, value: number): void {
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    this.histograms.get(key)!.push(value);
  }

  timing(key: string, value: number): void {
    if (!this.timers.has(key)) {
      this.timers.set(key, []);
    }
    this.timers.get(key)!.push(value);
  }

  getCounters(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }

  getGauges(): Record<string, number> {
    return Object.fromEntries(this.gauges);
  }

  getHistograms(): Record<string, { count: number; sum: number; avg: number; min: number; max: number }> {
    const result: Record<string, { count: number; sum: number; avg: number; min: number; max: number }> = {};

    for (const [key, values] of this.histograms.entries()) {
      if (values.length === 0) continue;

      const sum = values.reduce((a, b) => a + b, 0);
      result[key] = {
        count: values.length,
        sum,
        avg: sum / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
      };
    }

    return result;
  }

  getTimers(): Record<string, { count: number; avg: number; p50: number; p95: number; p99: number }> {
    const result: Record<string, { count: number; avg: number; p50: number; p95: number; p99: number }> = {};

    for (const [key, values] of this.timers.entries()) {
      if (values.length === 0) continue;

      const sorted = [...values].sort((a, b) => a - b);
      const count = sorted.length;

      result[key] = {
        count,
        avg: sorted.reduce((a, b) => a + b, 0) / count,
        p50: sorted[Math.floor(count * 0.5)],
        p95: sorted[Math.floor(count * 0.95)],
        p99: sorted[Math.floor(count * 0.99)],
      };
    }

    return result;
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.timers.clear();
  }
}

// ============================================================================
// Analytics Engine
// ============================================================================

export class AnalyticsEngine {
  private storage: DurableObjectStub;
  private config: AnalyticsConfig;
  private metrics: MetricsCollector;
  private eventBuffer: Event[];
  private evaluationBuffer: FlagEvaluation[];
  private flushTimer: ReturnType<typeof setInterval> | null;

  constructor(env: FlagStorageEnv, config: Partial<AnalyticsConfig> = {}) {
    this.storage = env.ANALYTICS_DURABLE_OBJECT.idFromName('analytics');
    this.config = {
      enabled: config.enabled ?? true,
      sampleRate: config.sampleRate ?? 1.0,
      batchSize: config.batchSize ?? 100,
      flushInterval: config.flushInterval ?? 10_000, // 10 seconds
      retentionPeriod: config.retentionPeriod ?? 30 * 24 * 60 * 60 * 1000, // 30 days
    };
    this.metrics = new MetricsCollector();
    this.eventBuffer = [];
    this.evaluationBuffer = [];
    this.flushTimer = null;

    // Start periodic flush
    this.startFlushTimer();
  }

  // ========================================================================
  // Event Recording
  // ========================================================================

  /**
   * Record a flag evaluation
   */
  async recordEvaluation(evaluation: FlagEvaluation): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Sample evaluations
    if (Math.random() > this.config.sampleRate) {
      return;
    }

    // Update metrics
    this.metrics.increment(`evaluations.total`);
    this.metrics.increment(`evaluations.flag.${evaluation.flagKey}`);
    this.metrics.timing('evaluations.time', evaluation.evaluationDetails.evaluationTime);

    if (evaluation.evaluationDetails.source === 'cache') {
      this.metrics.increment('evaluations.cache_hits');
    } else {
      this.metrics.increment('evaluations.cache_misses');
    }

    // Add to buffer
    this.evaluationBuffer.push(evaluation);

    // Flush if buffer is full
    if (this.evaluationBuffer.length >= this.config.batchSize) {
      await this.flushEvaluations();
    }
  }

  /**
   * Record an event
   */
  async recordEvent(event: Event): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Update metrics
    this.metrics.increment(`events.total`);
    this.metrics.increment(`events.type.${event.type}`);

    // Add to buffer
    this.eventBuffer.push(event);

    // Flush if buffer is full
    if (this.eventBuffer.length >= this.config.batchSize) {
      await this.flushEvents();
    }
  }

  /**
   * Record a conversion
   */
  async recordConversion(
    flagKey: string,
    userId: string,
    variant?: string
  ): Promise<void> {
    await this.recordEvent({
      id: this.generateId(),
      type: 'flag_evaluated',
      timestamp: new Date(),
      flagId: flagKey,
      userId,
      data: {
        conversion: true,
        variant,
      },
    });

    this.metrics.increment(`conversions.flag.${flagKey}`);
    if (variant) {
      this.metrics.increment(`conversions.variant.${variant}`);
    }
  }

  // ========================================================================
  // Metrics Queries
  // ========================================================================

  /**
   * Get metrics for a flag
   */
  async getFlagMetrics(
    flagKey: string,
    period: MetricsPeriod
  ): Promise<FlagMetrics | undefined> {
    const evaluations = await this.storage.queryEvaluations({
      flagId: flagKey,
      startTime: period.start,
      endTime: period.end,
      limit: 100000,
    });

    if (evaluations.length === 0) {
      return undefined;
    }

    const uniqueUsers = new Set(evaluations.map((e) => e.userId)).size;
    const trueCount = evaluations.filter((e) => e.value === true).length;
    const falseCount = evaluations.filter((e) => e.value === false).length;

    // Calculate performance metrics
    const evaluationTimes = evaluations.map((e) => e.evaluationDetails.evaluationTime);
    evaluationTimes.sort((a, b) => a - b);

    const p50 = evaluationTimes[Math.floor(evaluationTimes.length * 0.5)] || 0;
    const p95 = evaluationTimes[Math.floor(evaluationTimes.length * 0.95)] || 0;
    const p99 = evaluationTimes[Math.floor(evaluationTimes.length * 0.99)] || 0;
    const avg =
      evaluationTimes.reduce((a, b) => a + b, 0) / evaluationTimes.length || 0;

    // Calculate cache hit rate
    const cacheHits = evaluations.filter((e) => e.evaluationDetails.source === 'cache').length;

    // Calculate variant distribution
    const variantMap = new Map<string, number>();
    for (const evaluation of evaluations) {
      const variant = evaluation.evaluationDetails.matchedVariant || 'default';
      variantMap.set(variant, (variantMap.get(variant) || 0) + 1);
    }

    const variants: VariantMetrics[] = Array.from(variantMap.entries()).map(
      ([variantId, count]) => ({
        variantId,
        evaluations: count,
        uniqueUsers: new Set(
          evaluations
            .filter((e) => (e.evaluationDetails.matchedVariant || 'default') === variantId)
            .map((e) => e.userId)
        ).size,
        percentage: (count / evaluations.length) * 100,
      })
    );

    return {
      flagId: flagKey,
      period,
      evaluations: {
        total: evaluations.length,
        uniqueUsers,
        trueCount,
        falseCount,
      },
      variants,
      errors: {
        total: 0,
        rate: 0,
        types: {},
      },
      performance: {
        avgEvaluationTime: avg,
        p50EvaluationTime: p50,
        p95EvaluationTime: p95,
        p99EvaluationTime: p99,
        cacheHitRate: cacheHits / evaluations.length,
      },
    };
  }

  /**
   * Get metrics for multiple flags
   */
  async getBatchFlagMetrics(
    flagKeys: string[],
    period: MetricsPeriod
  ): Promise<Map<string, FlagMetrics>> {
    const results = new Map<string, FlagMetrics>();

    for (const flagKey of flagKeys) {
      const metrics = await this.getFlagMetrics(flagKey, period);
      if (metrics) {
        results.set(flagKey, metrics);
      }
    }

    return results;
  }

  /**
   * Get evaluation time series
   */
  async getEvaluationTimeSeries(
    flagKey: string,
    period: MetricsPeriod,
    interval: number = 3600000 // 1 hour
  ): Promise<Array<{ timestamp: Date; count: number }>> {
    const evaluations = await this.storage.queryEvaluations({
      flagId: flagKey,
      startTime: period.start,
      endTime: period.end,
      limit: 100000,
    });

    const timeSeries: Map<number, number> = new Map();

    // Round timestamps to interval
    for (const evaluation of evaluations) {
      const bucket =
        Math.floor(evaluation.timestamp.getTime() / interval) * interval;
      timeSeries.set(bucket, (timeSeries.get(bucket) || 0) + 1);
    }

    // Convert to array
    return Array.from(timeSeries.entries()).map(([timestamp, count]) => ({
      timestamp: new Date(timestamp),
      count,
    }));
  }

  /**
   * Get user evaluation history
   */
  async getUserEvaluationHistory(
    userId: string,
    flagKey?: string,
    limit: number = 100
  ): Promise<FlagEvaluation[]> {
    return this.storage.queryEvaluations({
      flagId: flagKey,
      userId,
      limit,
    });
  }

  /**
   * Get events for a flag
   */
  async getFlagEvents(
    flagKey: string,
    period: MetricsPeriod,
    limit: number = 1000
  ): Promise<Event[]> {
    return this.storage.queryEvents({
      flagId: flagKey,
      startTime: period.start,
      endTime: period.end,
      limit,
    });
  }

  // ========================================================================
  // Aggregation and Insights
  // ========================================================================

  /**
   * Get top flags by evaluation count
   */
  async getTopFlags(period: MetricsPeriod, limit: number = 10): Promise<
    Array<{
      flagKey: string;
      evaluations: number;
      uniqueUsers: number;
    }>
  > {
    // This would typically be computed from aggregated metrics
    // For now, return empty array
    return [];
  }

  /**
   * Get flag comparison
   */
  async compareFlags(
    flagKeys: string[],
    period: MetricsPeriod
  ): Promise<
    Array<{
      flagKey: string;
      metrics: FlagMetrics;
    }>
  > {
    const comparison = [];

    for (const flagKey of flagKeys) {
      const metrics = await this.getFlagMetrics(flagKey, period);
      if (metrics) {
        comparison.push({
          flagKey,
          metrics,
        });
      }
    }

    return comparison;
  }

  /**
   * Get flag health status
   */
  async getFlagHealth(flagKey: string): Promise<{
    status: 'healthy' | 'warning' | 'error';
    checks: Array<{
      name: string;
      status: 'pass' | 'fail';
      message?: string;
    }>;
  }> {
    const checks = [];

    // Check if flag is being evaluated
    const recentEvaluations = await this.storage.queryEvaluations({
      flagId: flagKey,
      limit: 1,
    });

    if (recentEvaluations.length === 0) {
      checks.push({
        name: 'recent_activity',
        status: 'fail' as const,
        message: 'No recent evaluations',
      });
    } else {
      checks.push({
        name: 'recent_activity',
        status: 'pass' as const,
      });
    }

    // Determine overall status
    const failedChecks = checks.filter((c) => c.status === 'fail');
    let status: 'healthy' | 'warning' | 'error';

    if (failedChecks.length === 0) {
      status = 'healthy';
    } else if (failedChecks.length === 1) {
      status = 'warning';
    } else {
      status = 'error';
    }

    return { status, checks };
  }

  // ========================================================================
  // Real-time Metrics
  // ========================================================================

  /**
   * Get current metrics from collector
   */
  getRealtimeMetrics(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, { count: number; sum: number; avg: number; min: number; max: number }>;
    timers: Record<string, { count: number; avg: number; p50: number; p95: number; p99: number }>;
  } {
    return {
      counters: this.metrics.getCounters(),
      gauges: this.metrics.getGauges(),
      histograms: this.metrics.getHistograms(),
      timers: this.metrics.getTimers(),
    };
  }

  /**
   * Get evaluation rate (evaluations per second)
   */
  getEvaluationRate(): number {
    const counters = this.metrics.getCounters();
    const totalEvaluations = counters['evaluations.total'] || 0;

    // Approximate rate based on uptime
    const uptime = process.uptime() || 1;
    return totalEvaluations / uptime;
  }

  /**
   * Get cache hit rate
   */
  getCacheHitRate(): number {
    const counters = this.metrics.getCounters();
    const hits = counters['evaluations.cache_hits'] || 0;
    const misses = counters['evaluations.cache_misses'] || 0;
    const total = hits + misses;

    return total > 0 ? hits / total : 0;
  }

  // ========================================================================
  // Data Management
  // ========================================================================

  /**
   * Flush buffered data to storage
   */
  async flush(): Promise<void> {
    await Promise.all([this.flushEvaluations(), this.flushEvents()]);
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.reset();
  }

  /**
   * Shutdown analytics engine
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush();
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  private async flushEvaluations(): Promise<void> {
    if (this.evaluationBuffer.length === 0) {
      return;
    }

    const evaluations = [...this.evaluationBuffer];
    this.evaluationBuffer = [];

    for (const evaluation of evaluations) {
      await this.storage.recordEvaluation(evaluation);
    }
  }

  private async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    const events = [...this.eventBuffer];
    this.eventBuffer = [];

    for (const event of events) {
      await this.storage.recordEvent(event);
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      await this.flush();
    }, this.config.flushInterval);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// Analytics Reporter
// ============================================================================

export interface AnalyticsReport {
  period: MetricsPeriod;
  flags: Array<{
    flagKey: string;
    metrics: FlagMetrics;
  }>;
  summary: {
    totalEvaluations: number;
    totalUniqueUsers: number;
    avgEvaluationTime: number;
    cacheHitRate: number;
  };
}

export class AnalyticsReporter {
  private analytics: AnalyticsEngine;

  constructor(analytics: AnalyticsEngine) {
    this.analytics = analytics;
  }

  /**
   * Generate daily report
   */
  async generateDailyReport(date: Date = new Date()): Promise<AnalyticsReport> {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return this.generateReport({ start, end });
  }

  /**
   * Generate custom report
   */
  async generateReport(period: MetricsPeriod): Promise<AnalyticsReport> {
    // Get all flag keys from evaluations
    const evaluations = await this.analytics['storage'].queryEvaluations({
      startTime: period.start,
      endTime: period.end,
      limit: 1000000,
    });

    const flagKeys = new Set(evaluations.map((e) => e.flagId));

    const flags = [];
    let totalEvaluations = 0;
    let totalUniqueUsers = new Set<string>();
    const evaluationTimes: number[] = [];
    let cacheHits = 0;

    for (const flagKey of flagKeys) {
      const metrics = await this.analytics.getFlagMetrics(flagKey, period);
      if (metrics) {
        flags.push({
          flagKey,
          metrics,
        });

        totalEvaluations += metrics.evaluations.total;
        metrics.evaluations.uniqueUsers;
        evaluationTimes.push(metrics.performance.avgEvaluationTime);
        cacheHits += metrics.performance.cacheHitRate * metrics.evaluations.total;
      }
    }

    return {
      period,
      flags,
      summary: {
        totalEvaluations,
        totalUniqueUsers: totalUniqueUsers.size,
        avgEvaluationTime:
          evaluationTimes.reduce((a, b) => a + b, 0) / evaluationTimes.length || 0,
        cacheHitRate: cacheHits / totalEvaluations || 0,
      },
    };
  }

  /**
   * Export report as JSON
   */
  exportReportAsJSON(report: AnalyticsReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Export report as CSV
   */
  exportReportAsCSV(report: AnalyticsReport): string {
    const headers = ['Flag Key', 'Evaluations', 'Unique Users', 'Avg Time', 'Cache Hit Rate'];
    const rows = report.flags.map((f) => [
      f.flagKey,
      f.metrics.evaluations.total.toString(),
      f.metrics.evaluations.uniqueUsers.toString(),
      f.metrics.performance.avgEvaluationTime.toFixed(2),
      f.metrics.performance.cacheHitRate.toFixed(2),
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\n');
  }
}
