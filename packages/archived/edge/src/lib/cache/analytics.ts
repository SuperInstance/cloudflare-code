/**
 * Cache Analytics and Insights
 *
 * Provides comprehensive analytics for cache performance, patterns,
 * and optimization opportunities. Includes real-time metrics,
 * historical analysis, and actionable insights.
 *
 * Goals:
 * - Track cache performance in real-time
 * - Identify optimization opportunities
 * - Generate actionable insights
 * - Predict future cache behavior
 * - Visualize cache state
 *
 * Metrics Tracked:
 * - Hit rates (overall, by tier, by pattern)
 * - Latency distributions
 * - Eviction patterns
 * - Access patterns
 * - Cost savings
 * - Memory usage
 */

export interface CacheMetric {
  timestamp: number;
  hitRate: number;
  totalQueries: number;
  hits: number;
  misses: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  memoryUsage: number;
  entryCount: number;
  tokensSaved: number;
  costSaved: number;
}

export interface AccessLogEntry {
  timestamp: number;
  key: string;
  hit: boolean;
  tier: 'hot' | 'warm' | 'cold';
  latency: number;
  similarity?: number;
  metadata: Record<string, unknown>;
}

export interface CacheInsight {
  type: 'optimization' | 'warning' | 'info' | 'success';
  category: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  suggestion?: string;
  metrics: Record<string, number>;
}

export interface TimeSeriesData {
  timestamps: number[];
  values: number[];
}

export interface DistributionData {
  min: number;
  max: number;
  mean: number;
  median: number;
  p90: number;
  p95: number;
  p99: number;
  stdDev: number;
}

export interface CacheAnalyticsOptions {
  /**
   * Retention period for metrics (ms)
   * @default 7 * 24 * 60 * 60 * 1000 (7 days)
   */
  retentionPeriod?: number;

  /**
   * Sample rate for access logging (0-1)
   * @default 0.1 (10% sampling)
   */
  accessLogSampleRate?: number;

  /**
   * Enable real-time analytics
   * @default true
   */
  enableRealTime?: boolean;

  /**
   * Enable predictive analytics
   * @default true
   */
  enablePredictive?: boolean;

  /**
   * Metrics aggregation interval (ms)
   * @default 60000 (1 minute)
   */
  aggregationInterval?: number;

  /**
   * Maximum access log entries
   * @default 10000
   */
  maxAccessLogEntries?: number;
}

export interface CacheAnalyticsReport {
  summary: {
    period: { start: number; end: number };
    totalQueries: number;
    overallHitRate: number;
    totalLatency: number;
    avgLatency: number;
    totalTokensSaved: number;
    totalCostSaved: number;
  };
  tierPerformance: {
    hot: { hitRate: number; avgLatency: number; queries: number };
    warm: { hitRate: number; avgLatency: number; queries: number };
    cold: { hitRate: number; avgLatency: number; queries: number };
  };
  latencyDistribution: DistributionData;
  hitRateTimeSeries: TimeSeriesData;
  topMisses: Array<{ key: string; count: number; lastMiss: number }>;
  topHits: Array<{ key: string; count: number; lastHit: number }>;
  insights: CacheInsight[];
}

/**
 * Cache Analytics Manager
 *
 * Provides comprehensive cache analytics and insights.
 */
export class CacheAnalyticsManager {
  private options: Required<CacheAnalyticsOptions>;
  private metrics: CacheMetric[];
  private accessLog: AccessLogEntry[];
  private tierMetrics: Map<string, { hits: number; misses: number; totalLatency: number }>;
  private latencySamples: number[];
  private lastAggregation: number;

  constructor(options: CacheAnalyticsOptions = {}) {
    this.options = {
      retentionPeriod: options.retentionPeriod ?? 7 * 24 * 60 * 60 * 1000, // 7 days
      accessLogSampleRate: options.accessLogSampleRate ?? 0.1,
      enableRealTime: options.enableRealTime ?? true,
      enablePredictive: options.enablePredictive ?? true,
      aggregationInterval: options.aggregationInterval ?? 60000, // 1 minute
      maxAccessLogEntries: options.maxAccessLogEntries ?? 10000,
    };

    this.metrics = [];
    this.accessLog = [];
    this.tierMetrics = new Map();
    this.latencySamples = [];
    this.lastAggregation = Date.now();
  }

  /**
   * Record cache access
   *
   * @param key - Cache key
   * @param hit - Whether it was a hit
   * @param tier - Cache tier
   * @param latency - Access latency
   * @param metadata - Additional metadata
   */
  recordAccess(
    key: string,
    hit: boolean,
    tier: 'hot' | 'warm' | 'cold',
    latency: number,
    metadata: Record<string, unknown> = {}
  ): void {
    const now = Date.now();

    // Sample access log
    if (Math.random() < this.options.accessLogSampleRate) {
      this.accessLog.push({
        timestamp: now,
        key,
        hit,
        tier,
        latency,
        similarity: metadata.similarity as number,
        metadata,
      });

      // Limit access log size
      if (this.accessLog.length > this.options.maxAccessLogEntries) {
        this.accessLog.splice(0, this.accessLog.length - this.options.maxAccessLogEntries);
      }
    }

    // Update tier metrics
    let tierMetric = this.tierMetrics.get(tier);
    if (!tierMetric) {
      tierMetric = { hits: 0, misses: 0, totalLatency: 0 };
      this.tierMetrics.set(tier, tierMetric);
    }

    if (hit) {
      tierMetric.hits++;
    } else {
      tierMetric.misses++;
    }
    tierMetric.totalLatency += latency;

    // Add latency sample
    this.latencySamples.push(latency);

    // Limit latency samples
    if (this.latencySamples.length > 10000) {
      this.latencySamples.splice(0, this.latencySamples.length - 10000);
    }

    // Aggregate metrics if needed
    if (this.options.enableRealTime && now - this.lastAggregation >= this.options.aggregationInterval) {
      this.aggregateMetrics();
    }
  }

  /**
   * Generate analytics report
   *
   * @param period - Time period for report (ms)
   * @returns Analytics report
   */
  generateReport(period?: number): CacheAnalyticsReport {
    const now = Date.now();
    const start = period ? now - period : now - this.options.retentionPeriod;

    // Filter metrics by time period
    const periodMetrics = this.metrics.filter(m => m.timestamp >= start);

    // Calculate summary
    const summary = this.calculateSummary(periodMetrics, start, now);

    // Calculate tier performance
    const tierPerformance = this.calculateTierPerformance(periodMetrics);

    // Calculate latency distribution
    const latencyDistribution = this.calculateLatencyDistribution(periodMetrics);

    // Calculate hit rate time series
    const hitRateTimeSeries = this.calculateHitRateTimeSeries(periodMetrics);

    // Get top misses and hits
    const topMisses = this.getTopMisses(10);
    const topHits = this.getTopHits(10);

    // Generate insights
    const insights = this.generateInsights(summary, tierPerformance, latencyDistribution);

    return {
      summary,
      tierPerformance,
      latencyDistribution,
      hitRateTimeSeries,
      topMisses,
      topHits,
      insights,
    };
  }

  /**
   * Get real-time metrics
   */
  getRealTimeMetrics(): CacheMetric | null {
    if (this.metrics.length === 0) {
      return null;
    }

    return this.metrics[this.metrics.length - 1];
  }

  /**
   * Get current hit rate
   */
  getCurrentHitRate(): number {
    const latest = this.getRealTimeMetrics();
    return latest?.hitRate ?? 0;
  }

  /**
   * Get average latency
   */
  getAverageLatency(): number {
    if (this.latencySamples.length === 0) {
      return 0;
    }

    const sum = this.latencySamples.reduce((a, b) => a + b, 0);
    return sum / this.latencySamples.length;
  }

  /**
   * Get percentile latency
   *
   * @param percentile - Percentile to calculate (0-100)
   */
  getPercentileLatency(percentile: number): number {
    if (this.latencySamples.length === 0) {
      return 0;
    }

    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;

    return sorted[index];
  }

  /**
   * Get access log entries
   *
   * @param limit - Maximum number of entries
   */
  getAccessLog(limit: number = 100): AccessLogEntry[] {
    return this.accessLog.slice(-limit);
  }

  /**
   * Clear all analytics data
   */
  clear(): void {
    this.metrics = [];
    this.accessLog = [];
    this.tierMetrics.clear();
    this.latencySamples = [];
    this.lastAggregation = Date.now();
  }

  /**
   * Calculate summary
   *
   * @private
   */
  private calculateSummary(
    metrics: CacheMetric[],
    start: number,
    end: number
  ): CacheAnalyticsReport['summary'] {
    if (metrics.length === 0) {
      return {
        period: { start, end },
        totalQueries: 0,
        overallHitRate: 0,
        totalLatency: 0,
        avgLatency: 0,
        totalTokensSaved: 0,
        totalCostSaved: 0,
      };
    }

    const latest = metrics[metrics.length - 1];

    return {
      period: { start, end },
      totalQueries: latest.totalQueries,
      overallHitRate: latest.hitRate,
      totalLatency: latest.totalQueries * latest.avgLatency,
      avgLatency: latest.avgLatency,
      totalTokensSaved: latest.tokensSaved,
      totalCostSaved: latest.costSaved,
    };
  }

  /**
   * Calculate tier performance
   *
   * @private
   */
  private calculateTierPerformance(metrics: CacheMetric[]): CacheAnalyticsReport['tierPerformance'] {
    const hot = this.tierMetrics.get('hot') ?? { hits: 0, misses: 0, totalLatency: 0 };
    const warm = this.tierMetrics.get('warm') ?? { hits: 0, misses: 0, totalLatency: 0 };
    const cold = this.tierMetrics.get('cold') ?? { hits: 0, misses: 0, totalLatency: 0 };

    const calculateTierStats = (tier: typeof hot) => {
      const total = tier.hits + tier.misses;
      return {
        hitRate: total > 0 ? (tier.hits / total) * 100 : 0,
        avgLatency: total > 0 ? tier.totalLatency / total : 0,
        queries: total,
      };
    };

    return {
      hot: calculateTierStats(hot),
      warm: calculateTierStats(warm),
      cold: calculateTierStats(cold),
    };
  }

  /**
   * Calculate latency distribution
   *
   * @private
   */
  private calculateLatencyDistribution(metrics: CacheMetric[]): DistributionData {
    if (this.latencySamples.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        stdDev: 0,
      };
    }

    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    const len = sorted.length;

    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / len;

    const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / len;
    const stdDev = Math.sqrt(variance);

    return {
      min: sorted[0],
      max: sorted[len - 1],
      mean,
      median: sorted[Math.floor(len / 2)],
      p90: sorted[Math.floor(len * 0.9)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)],
      stdDev,
    };
  }

  /**
   * Calculate hit rate time series
   *
   * @private
   */
  private calculateHitRateTimeSeries(metrics: CacheMetric[]): TimeSeriesData {
    return {
      timestamps: metrics.map(m => m.timestamp),
      values: metrics.map(m => m.hitRate),
    };
  }

  /**
   * Get top misses
   *
   * @private
   */
  private getTopMisses(limit: number): Array<{ key: string; count: number; lastMiss: number }> {
    const missCounts = new Map<string, { count: number; lastMiss: number }>();

    for (const entry of this.accessLog) {
      if (!entry.hit) {
        const existing = missCounts.get(entry.key);
        if (existing) {
          existing.count++;
          existing.lastMiss = Math.max(existing.lastMiss, entry.timestamp);
        } else {
          missCounts.set(entry.key, { count: 1, lastMiss: entry.timestamp });
        }
      }
    }

    return Array.from(missCounts.entries())
      .map(([key, data]) => ({ key, count: data.count, lastMiss: data.lastMiss }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get top hits
   *
   * @private
   */
  private getTopHits(limit: number): Array<{ key: string; count: number; lastHit: number }> {
    const hitCounts = new Map<string, { count: number; lastHit: number }>();

    for (const entry of this.accessLog) {
      if (entry.hit) {
        const existing = hitCounts.get(entry.key);
        if (existing) {
          existing.count++;
          existing.lastHit = Math.max(existing.lastHit, entry.timestamp);
        } else {
          hitCounts.set(entry.key, { count: 1, lastHit: entry.timestamp });
        }
      }
    }

    return Array.from(hitCounts.entries())
      .map(([key, data]) => ({ key, count: data.count, lastHit: data.lastHit }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Generate insights
   *
   * @private
   */
  private generateInsights(
    summary: CacheAnalyticsReport['summary'],
    tierPerformance: CacheAnalyticsReport['tierPerformance'],
    latencyDistribution: DistributionData
  ): CacheInsight[] {
    const insights: CacheInsight[] = [];

    // Hit rate insights
    if (summary.overallHitRate < 50) {
      insights.push({
        type: 'warning',
        category: 'performance',
        title: 'Low Cache Hit Rate',
        description: `Overall hit rate is ${(summary.overallHitRate).toFixed(1)}%, which is below target.`,
        impact: 'high',
        actionable: true,
        suggestion: 'Consider increasing cache size or adjusting similarity threshold.',
        metrics: { hitRate: summary.overallHitRate },
      });
    } else if (summary.overallHitRate > 80) {
      insights.push({
        type: 'success',
        category: 'performance',
        title: 'Excellent Cache Hit Rate',
        description: `Overall hit rate is ${(summary.overallHitRate).toFixed(1)}%, exceeding target.`,
        impact: 'high',
        actionable: false,
        metrics: { hitRate: summary.overallHitRate },
      });
    }

    // Tier performance insights
    if (tierPerformance.hot.hitRate < 70) {
      insights.push({
        type: 'optimization',
        category: 'performance',
        title: 'Low HOT Cache Hit Rate',
        description: `HOT cache hit rate is ${(tierPerformance.hot.hitRate).toFixed(1)}%. Consider cache warming.`,
        impact: 'medium',
        actionable: true,
        suggestion: 'Implement cache warming for frequently accessed queries.',
        metrics: { hotHitRate: tierPerformance.hot.hitRate },
      });
    }

    // Latency insights
    if (latencyDistribution.p95 > 100) {
      insights.push({
        type: 'warning',
        category: 'latency',
        title: 'High P95 Latency',
        description: `P95 latency is ${latencyDistribution.p95.toFixed(2)}ms, above target of 100ms.`,
        impact: 'high',
        actionable: true,
        suggestion: 'Consider optimizing cache access patterns or increasing HOT cache size.',
        metrics: { p95Latency: latencyDistribution.p95 },
      });
    }

    // Cost savings insights
    if (summary.totalTokensSaved > 100000) {
      insights.push({
        type: 'success',
        category: 'cost',
        title: 'Significant Cost Savings',
        description: `Saved ${summary.totalTokensSaved.toLocaleString()} tokens ($${summary.totalCostSaved.toFixed(2)}).`,
        impact: 'high',
        actionable: false,
        metrics: {
          tokensSaved: summary.totalTokensSaved,
          costSaved: summary.totalCostSaved,
        },
      });
    }

    return insights;
  }

  /**
   * Aggregate metrics
   *
   * @private
   */
  private aggregateMetrics(): void {
    const now = Date.now();

    // Calculate overall metrics
    let totalHits = 0;
    let totalMisses = 0;
    let totalLatency = 0;
    let totalTokensSaved = 0;
    let totalCostSaved = 0;

    for (const tierMetric of this.tierMetrics.values()) {
      totalHits += tierMetric.hits;
      totalMisses += tierMetric.misses;
      totalLatency += tierMetric.totalLatency;
    }

    const totalQueries = totalHits + totalMisses;
    const hitRate = totalQueries > 0 ? (totalHits / totalQueries) * 100 : 0;
    const avgLatency = totalQueries > 0 ? totalLatency / totalQueries : 0;

    // Estimate tokens saved (assuming 1000 tokens per cache hit)
    totalTokensSaved = totalHits * 1000;

    // Estimate cost saved (assuming $0.001 per 1000 tokens)
    totalCostSaved = totalTokensSaved * 0.000001;

    const metric: CacheMetric = {
      timestamp: now,
      hitRate,
      totalQueries,
      hits: totalHits,
      misses: totalMisses,
      avgLatency,
      p50Latency: this.getPercentileLatency(50),
      p95Latency: this.getPercentileLatency(95),
      p99Latency: this.getPercentileLatency(99),
      memoryUsage: 0, // Would need to be provided externally
      entryCount: 0, // Would need to be provided externally
      tokensSaved: totalTokensSaved,
      costSaved: totalCostSaved,
    };

    this.metrics.push(metric);

    // Cleanup old metrics
    this.cleanupOldMetrics();

    // Reset tier metrics
    this.tierMetrics.clear();

    this.lastAggregation = now;
  }

  /**
   * Cleanup old metrics
   *
   * @private
   */
  private cleanupOldMetrics(): void {
    const now = Date.now();
    const cutoff = now - this.options.retentionPeriod;

    this.metrics = this.metrics.filter(m => m.timestamp >= cutoff);
    this.accessLog = this.accessLog.filter(entry => entry.timestamp >= cutoff);
  }

  /**
   * Predict future hit rate
   *
   * @param horizon - Prediction horizon (ms)
   */
  predictHitRate(horizon: number = 3600000): number {
    if (!this.options.enablePredictive || this.metrics.length < 2) {
      return this.getCurrentHitRate();
    }

    // Simple linear regression on recent metrics
    const recentMetrics = this.metrics.slice(-100);

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    const now = Date.now();

    for (let i = 0; i < recentMetrics.length; i++) {
      const x = (recentMetrics[i].timestamp - now) / 1000; // seconds
      const y = recentMetrics[i].hitRate;

      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const n = recentMetrics.length;
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const futureX = horizon / 1000;
    const prediction = slope * futureX + intercept;

    return Math.max(0, Math.min(100, prediction));
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics(): string {
    return JSON.stringify({
      metrics: this.metrics,
      accessLog: this.accessLog.slice(-1000), // Limit to last 1000 entries
      tierMetrics: Object.fromEntries(this.tierMetrics),
      summary: this.getRealTimeMetrics(),
    }, null, 2);
  }
}

/**
 * Create a cache analytics manager
 */
export function createCacheAnalyticsManager(
  options?: CacheAnalyticsOptions
): CacheAnalyticsManager {
  return new CacheAnalyticsManager(options);
}

/**
 * Default cache analytics manager
 */
export const defaultCacheAnalyticsManager = new CacheAnalyticsManager();
