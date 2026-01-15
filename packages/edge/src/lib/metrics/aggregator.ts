/**
 * Metrics Aggregator
 *
 * Combines metrics from all collectors to provide dashboard data,
 * cost savings calculations, anomaly detection, and forecasting.
 */

import { RequestMetricsCollector } from './request';
import { ProviderMetricsCollector } from './provider';
import { CacheMetricsCollector } from './cache';
import type {
  DashboardData,
  CostSavings,
  ProviderStats,
  Anomaly,
} from './types';

export class MetricsAggregator {
  private requestCollector: RequestMetricsCollector;
  private providerCollector: ProviderMetricsCollector;
  private cacheCollector: CacheMetricsCollector;

  constructor(
    requestCollector: RequestMetricsCollector,
    providerCollector: ProviderMetricsCollector,
    cacheCollector: CacheMetricsCollector
  ) {
    this.requestCollector = requestCollector;
    this.providerCollector = providerCollector;
    this.cacheCollector = cacheCollector;
  }

  /**
   * Get complete dashboard data
   */
  async getDashboardData(
    timeRange: 'hour' | 'day' | 'week' = 'day'
  ): Promise<DashboardData> {
    const now = Date.now();
    let startTime: number;
    let label: string;

    switch (timeRange) {
      case 'hour':
        startTime = now - 60 * 60 * 1000;
        label = 'Last Hour';
        break;
      case 'day':
        startTime = now - 24 * 60 * 60 * 1000;
        label = 'Last 24 Hours';
        break;
      case 'week':
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        label = 'Last 7 Days';
        break;
    }

    const previousStartTime = startTime - (now - startTime);

    // Get metrics for current and previous periods
    const [currentMetrics, previousMetrics, providerStatus, cachePerformance] =
      await Promise.all([
        this.requestCollector.getByTimeRange(startTime, now),
        this.requestCollector.getByTimeRange(previousStartTime, startTime),
        this.providerCollector.getAllProviders(),
        this.cacheCollector.getAllTiers(),
      ]);

    const overview = this.calculateOverview(
      currentMetrics,
      previousMetrics
    );

    const costByProvider = this.groupCostByProvider(currentMetrics);
    const costByModel = this.groupCostByModel(currentMetrics);
    const costByFeature = this.groupCostByFeature(currentMetrics);

    const topProviders = await this.getTopProviders(5);
    const recentAnomalies = await this.detectAnomalies();
    const forecast = await this.generateForecast(now, timeRange);

    const overallCache = await this.cacheCollector.getOverallMetrics();
    const cacheSavings = await this.cacheCollector.getSavings();

    return {
      timestamp: now,
      timeRange: { start: startTime, end: now, label },
      overview,
      costByProvider,
      costByModel,
      costByFeature,
      providerStatus,
      cachePerformance: {
        ...cachePerformance,
        overall: {
          hitRate: overallCache.hitRate,
          savings: cacheSavings.costSaved,
        },
      },
      topProviders,
      recentAnomalies,
      forecast,
    };
  }

  /**
   * Calculate cost savings from optimizations
   */
  async calculateSavings(period: 'hour' | 'day' | 'week' = 'day'): Promise<CostSavings> {
    const now = Date.now();
    let startTime: number;

    switch (period) {
      case 'hour':
        startTime = now - 60 * 60 * 1000;
        break;
      case 'day':
        startTime = now - 24 * 60 * 60 * 1000;
        break;
      case 'week':
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
    }

    const metrics = await this.requestCollector.getByTimeRange(startTime, now);
    const cacheSavings = await this.cacheCollector.getSavings();

    // Calculate gross cost (without optimizations)
    const grossCost = metrics.reduce((sum, m) => sum + m.cost, 0);

    // Cache savings (95% of request cost for cache hits)
    const cacheHitCost = metrics
      .filter((m) => m.cacheHit)
      .reduce((sum, m) => sum + m.cost, 0);
    const cacheSavingsAmount = cacheHitCost * 0.95;

    // Routing savings (estimate 15% savings from intelligent routing)
    const routingSavingsAmount = grossCost * 0.15;

    // Cascade savings (estimate 10% savings from model cascade)
    const cascadeSavingsAmount = grossCost * 0.10;

    const totalSavings = cacheSavingsAmount + routingSavingsAmount + cascadeSavingsAmount;
    void (grossCost - totalSavings); // Calculate but don't use for now

    return {
      totalSavings,
      savingsPercentage: (totalSavings / grossCost) * 100,
      cacheSavings: {
        amount: cacheSavingsAmount,
        percentage: (cacheSavingsAmount / grossCost) * 100,
        tokensSaved: cacheSavings.tokensSaved,
      },
      routingSavings: {
        amount: routingSavingsAmount,
        percentage: (routingSavingsAmount / grossCost) * 100,
      },
      cascadeSavings: {
        amount: cascadeSavingsAmount,
        percentage: (cascadeSavingsAmount / grossCost) * 100,
      },
      period: {
        start: startTime,
        end: now,
        granularity: period,
      },
    };
  }

  /**
   * Get top providers by usage
   */
  async getTopProviders(limit: number = 5): Promise<ProviderStats[]> {
    const providers = await this.providerCollector.getAllProviders();
    const stats: ProviderStats[] = [];

    for (const provider of providers) {
      const quota = await this.providerCollector.getQuota(provider.provider);

      stats.push({
        provider: provider.provider,
        requestCount: Math.floor(provider.requestsPerMinute * 60), // Estimate
        requestPercentage: 0, // Will calculate relative to total
        tokenCount: 0, // Would need token tracking
        avgLatency: provider.latency.p50,
        p95Latency: provider.latency.p95,
        successRate: provider.successRate,
        totalCost: 0, // Would need cost tracking
        avgCostPerRequest: 0,
        costPer1KTokens:
          (provider.costPer1KTokens.input +
            provider.costPer1KTokens.output) /
          2,
        quotaUsage: quota?.used || 0,
        quotaRemaining: quota ? quota.total - quota.used : 0,
        costRank: 0,
        latencyRank: 0,
        qualityRank: 0,
      });
    }

    // Calculate percentages
    const totalRequests = stats.reduce((sum, s) => sum + s.requestCount, 0);
    stats.forEach((s) => {
      s.requestPercentage = (s.requestCount / totalRequests) * 100;
    });

    // Get rankings
    const [costRanking, latencyRanking, qualityRanking] = await Promise.all([
      this.providerCollector.getCostRanking(),
      this.providerCollector.getLatencyRanking(),
      this.providerCollector.getQualityRanking(),
    ]);

    costRanking.forEach((r) => {
      const stat = stats.find((s) => s.provider === r.provider);
      if (stat) stat.costRank = r.rank;
    });

    latencyRanking.forEach((r) => {
      const stat = stats.find((s) => s.provider === r.provider);
      if (stat) stat.latencyRank = r.rank;
    });

    qualityRanking.forEach((r) => {
      const stat = stats.find((s) => s.provider === r.provider);
      if (stat) stat.qualityRank = r.rank;
    });

    // Sort by total cost and return top N
    return stats.sort((a, b) => b.requestCount - a.requestCount).slice(0, limit);
  }

  /**
   * Detect anomalies in metrics
   */
  async detectAnomalies(): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;

    // Get recent metrics
    const recentMetrics = await this.requestCollector.getByTimeRange(
      hourAgo,
      now
    );

    // Get baseline (previous hour)
    const baselineMetrics = await this.requestCollector.getByTimeRange(
      hourAgo - 60 * 60 * 1000,
      hourAgo
    );

    // Calculate baselines
    const baselineCost = this.calculateAverageCost(baselineMetrics);
    const baselineLatency = this.calculateAverageLatency(baselineMetrics);
    const baselineErrorRate = this.calculateErrorRate(baselineMetrics);
    const baselineCacheHitRate = this.calculateCacheHitRate(baselineMetrics);

    // Calculate current values
    const currentCost = this.calculateAverageCost(recentMetrics);
    const currentLatency = this.calculateAverageLatency(recentMetrics);
    const currentErrorRate = this.calculateErrorRate(recentMetrics);
    const currentCacheHitRate = this.calculateCacheHitRate(recentMetrics);

    // Detect cost spikes (>50% increase)
    if (currentCost > baselineCost * 1.5) {
      anomalies.push({
        id: `cost-spike-${now}`,
        type: 'cost_spike',
        severity: currentCost > baselineCost * 2 ? 'emergency' : 'critical',
        timestamp: now,
        detected: now,
        currentValue: currentCost,
        baselineValue: baselineCost,
        deviation: ((currentCost - baselineCost) / baselineCost) * 100,
        description: `Cost spike detected: ${currentCost.toFixed(2)} vs baseline ${baselineCost.toFixed(2)}`,
        resolved: false,
      });
    }

    // Detect latency anomalies (>100% increase)
    if (currentLatency > baselineLatency * 2) {
      anomalies.push({
        id: `latency-anomaly-${now}`,
        type: 'latency_anomaly',
        severity: currentLatency > baselineLatency * 3 ? 'critical' : 'warning',
        timestamp: now,
        detected: now,
        currentValue: currentLatency,
        baselineValue: baselineLatency,
        deviation: ((currentLatency - baselineLatency) / baselineLatency) * 100,
        description: `High latency detected: ${currentLatency.toFixed(0)}ms vs baseline ${baselineLatency.toFixed(0)}ms`,
        resolved: false,
      });
    }

    // Detect error rate spikes (>5%)
    if (currentErrorRate > baselineErrorRate + 0.05) {
      anomalies.push({
        id: `error-spike-${now}`,
        type: 'error_spike',
        severity: currentErrorRate > 0.1 ? 'critical' : 'warning',
        timestamp: now,
        detected: now,
        currentValue: currentErrorRate * 100,
        baselineValue: baselineErrorRate * 100,
        deviation: ((currentErrorRate - baselineErrorRate) / baselineErrorRate) * 100,
        description: `Error rate spike detected: ${(currentErrorRate * 100).toFixed(1)}% vs baseline ${(baselineErrorRate * 100).toFixed(1)}%`,
        resolved: false,
      });
    }

    // Detect cache hit rate drops (>20% decrease)
    if (currentCacheHitRate < baselineCacheHitRate * 0.8) {
      anomalies.push({
        id: `cache-drop-${now}`,
        type: 'cache_drop',
        severity: currentCacheHitRate < baselineCacheHitRate * 0.5 ? 'critical' : 'warning',
        timestamp: now,
        detected: now,
        currentValue: currentCacheHitRate * 100,
        baselineValue: baselineCacheHitRate * 100,
        deviation: ((currentCacheHitRate - baselineCacheHitRate) / baselineCacheHitRate) * 100,
        description: `Cache hit rate dropped: ${(currentCacheHitRate * 100).toFixed(1)}% vs baseline ${(baselineCacheHitRate * 100).toFixed(1)}%`,
        resolved: false,
      });
    }

    return anomalies;
  }

  /**
   * Generate cost forecast
   */
  async generateForecast(
    now: number,
    _period: 'hour' | 'day' | 'week'
  ): Promise<{
    nextHour: number;
    nextDay: number;
    nextWeek: number;
    confidence: number;
  }> {
    // Get historical data
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const historicalMetrics = await this.requestCollector.getByTimeRange(
      weekAgo,
      now
    );

    // Calculate daily costs
    const dailyCosts = new Map<number, number>();

    for (const metric of historicalMetrics) {
      const day = Math.floor(metric.timestamp / (24 * 60 * 60 * 1000));
      dailyCosts.set(day, (dailyCosts.get(day) || 0) + metric.cost);
    }

    const costs = Array.from(dailyCosts.values());

    if (costs.length < 2) {
      return {
        nextHour: 0,
        nextDay: 0,
        nextWeek: 0,
        confidence: 0,
      };
    }

    // Simple linear regression for forecasting
    const n = costs.length;
    const sumX = costs.reduce((sum, _, i) => sum + i, 0);
    const sumY = costs.reduce((sum, y) => sum + y, 0);
    const sumXY = costs.reduce((sum, y, i) => sum + i * y, 0);
    const sumXX = costs.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate forecast
    const lastDayCost = costs[costs.length - 1] ?? 0;
    const nextDay = lastDayCost + slope;
    const nextHour = nextDay / 24;
    const nextWeek = nextDay * 7;

    // Calculate confidence (based on R²)
    const meanY = sumY / n;
    const ssTot = costs.reduce((sum, y) => sum + Math.pow(y - meanY, 2), 0);
    const ssRes = costs.reduce(
      (sum, y, i) => sum + Math.pow(y - (intercept + slope * i), 2),
      0
    );
    const rSquared = 1 - ssRes / ssTot;

    return {
      nextHour: Math.max(0, nextHour),
      nextDay: Math.max(0, nextDay),
      nextWeek: Math.max(0, nextWeek),
      confidence: Math.max(0, Math.min(1, rSquared)),
    };
  }

  /**
   * Get Prometheus metrics for all collectors
   */
  async getPrometheusMetrics(): Promise<string> {
    const lines: string[] = [];

    // Request metrics
    const recentMetrics = await this.requestCollector.getRecent(60);
    const stats = this.requestCollector.calculateStatistics(recentMetrics);

    lines.push(
      '# HELP requests_total Total number of requests',
      '# TYPE requests_total counter',
      `requests_total ${stats.count}`,
      '',
      '# HELP request_success_rate Success rate of requests',
      '# TYPE request_success_rate gauge',
      `request_success_rate ${stats.successRate / 100}`,
      '',
      '# HELP request_latency_seconds Request latency in seconds',
      '# TYPE request_latency_seconds histogram',
      `request_latency_seconds{quantile="0.5"} ${stats.percentiles.p50 / 1000}`,
      `request_latency_seconds{quantile="0.9"} ${stats.percentiles.p90 / 1000}`,
      `request_latency_seconds{quantile="0.95"} ${stats.percentiles.p95 / 1000}`,
      `request_latency_seconds{quantile="0.99"} ${stats.percentiles.p99 / 1000}`,
      ''
    );

    // Cost metrics
    lines.push(
      '# HELP cost_total_dollars Total cost in dollars',
      '# TYPE cost_total_dollars counter',
      `cost_total_dollars ${stats.totalCost}`,
      '',
      '# HELP cost_per_request_dollars Average cost per request',
      '# TYPE cost_per_request_dollars gauge',
      `cost_per_request_dollars ${stats.totalCost / stats.count}`,
      ''
    );

    // Token metrics
    lines.push(
      '# HELP tokens_total Total tokens processed',
      '# TYPE tokens_total counter',
      `tokens_total ${stats.totalTokens}`,
      ''
    );

    // Provider metrics
    const providers = await this.providerCollector.getAllProviders();
    for (const provider of providers) {
      lines.push(
        `# HELP provider_up Provider health status`,
        `# TYPE provider_up gauge`,
        `provider_up{provider="${provider.provider}"} ${provider.health === 'healthy' ? 1 : 0}`,
        '',
        `# HELP provider_success_rate Provider success rate`,
        `# TYPE provider_success_rate gauge`,
        `provider_success_rate{provider="${provider.provider}"} ${provider.successRate / 100}`,
        '',
        `# HELP provider_latency_seconds Provider latency`,
        `# TYPE provider_latency_seconds gauge`,
        `provider_latency_seconds{provider="${provider.provider}",quantile="0.5"} ${provider.latency.p50 / 1000}`,
        `provider_latency_seconds{provider="${provider.provider}",quantile="0.95"} ${provider.latency.p95 / 1000}`,
        ''
      );
    }

    // Cache metrics
    const cacheMetrics = await this.cacheCollector.getPrometheusMetrics();
    lines.push(cacheMetrics);

    return lines.join('\n');
  }

  /**
   * Calculate overview metrics with trends
   */
  private calculateOverview(
    currentMetrics: any[],
    previousMetrics: any[]
  ): DashboardData['overview'] {
    const currentStats = this.requestCollector.calculateStatistics(currentMetrics);
    const previousStats = this.requestCollector.calculateStatistics(previousMetrics);

    const calculateTrend = (current: number, previous: number): number => {
      if (previous === 0) return 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      totalCost: currentStats.totalCost,
      totalRequests: currentStats.count,
      cacheHitRate: currentStats.cacheHitRate,
      avgLatency: currentStats.avgLatency,
      successRate: currentStats.successRate,
      trends: {
        cost: calculateTrend(currentStats.totalCost, previousStats.totalCost),
        requests: calculateTrend(currentStats.count, previousStats.count),
        cacheHitRate: calculateTrend(
          currentStats.cacheHitRate,
          previousStats.cacheHitRate
        ),
        latency: calculateTrend(currentStats.avgLatency, previousStats.avgLatency),
      },
    };
  }

  /**
   * Group costs by provider
   */
  private groupCostByProvider(metrics: any[]): Record<string, number> {
    const costs: Record<string, number> = {};
    for (const metric of metrics) {
      costs[metric.provider] = (costs[metric.provider] || 0) + metric.cost;
    }
    return costs;
  }

  /**
   * Group costs by model
   */
  private groupCostByModel(metrics: any[]): Record<string, number> {
    const costs: Record<string, number> = {};
    for (const metric of metrics) {
      costs[metric.model] = (costs[metric.model] || 0) + metric.cost;
    }
    return costs;
  }

  /**
   * Group costs by feature
   */
  private groupCostByFeature(metrics: any[]): Record<string, number> {
    const costs: Record<string, number> = {};
    for (const metric of metrics) {
      const feature = metric.feature || 'other';
      costs[feature] = (costs[feature] || 0) + metric.cost;
    }
    return costs;
  }

  /**
   * Calculate average cost
   */
  private calculateAverageCost(metrics: any[]): number {
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.cost, 0) / metrics.length;
  }

  /**
   * Calculate average latency
   */
  private calculateAverageLatency(metrics: any[]): number {
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length;
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(metrics: any[]): number {
    if (metrics.length === 0) return 0;
    const errors = metrics.filter((m) => !m.success).length;
    return errors / metrics.length;
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(metrics: any[]): number {
    if (metrics.length === 0) return 0;
    const hits = metrics.filter((m) => m.cacheHit).length;
    return hits / metrics.length;
  }
}
