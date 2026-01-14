/**
 * Request Metrics Collector
 *
 * Tracks individual AI request metrics with tiered storage strategy:
 * - HOT: Recent requests in DO (last hour)
 * - WARM: Aggregated metrics in KV (last 24 hours)
 * - COLD: Raw metrics in R2 (archived)
 */

import type {
  RequestMetrics,
  AggregateMetrics,
  MetricsQueryOptions,
} from './types';

export class RequestMetricsCollector {
  private kvCache: KVNamespace;
  private r2Storage: R2Bucket;
  private hotMetrics: Map<string, RequestMetrics[]>;

  constructor(kvCache: KVNamespace, r2Storage: R2Bucket) {
    this.kvCache = kvCache;
    this.r2Storage = r2Storage;
    this.hotMetrics = new Map();
  }

  /**
   * Record a single request metric
   */
  async record(metrics: RequestMetrics): Promise<void> {
    const timestamp = Date.now();
    const hourKey = this.getHourKey(timestamp);

    // Add to HOT tier (in-memory)
    if (!this.hotMetrics.has(hourKey)) {
      this.hotMetrics.set(hourKey, []);
    }
    this.hotMetrics.get(hourKey)!.push(metrics);

    // Enforce HOT tier size limit (last hour)
    await this.cleanupHotTier();

    // Periodically aggregate to WARM tier
    if (Math.random() < 0.1) { // 10% chance to aggregate
      await this.aggregateToWarm(hourKey);
    }
  }

  /**
   * Get metrics by time range
   */
  async getByTimeRange(
    startTime: number,
    endTime: number,
    options?: MetricsQueryOptions
  ): Promise<RequestMetrics[]> {
    const results: RequestMetrics[] = [];

    // Check HOT tier first
    for (const [hourKey, metrics] of this.hotMetrics.entries()) {
      const hourTime = this.parseHourKey(hourKey);
      if (hourTime >= startTime && hourTime <= endTime) {
        results.push(...metrics);
      }
    }

    // Check WARM tier (aggregated data)
    const warmMetrics = await this.getFromWarm(startTime, endTime, options);
    results.push(...warmMetrics);

    // Check COLD tier if needed (archived data)
    if (endTime < Date.now() - 24 * 60 * 60 * 1000) {
      const coldMetrics = await this.getFromCold(startTime, endTime, options);
      results.push(...coldMetrics);
    }

    // Filter by options
    return this.filterMetrics(results, options);
  }

  /**
   * Get aggregate metrics for a provider and period
   */
  async getAggregate(
    provider: string,
    period: 'hour' | 'day' | 'week',
    model?: string
  ): Promise<AggregateMetrics> {
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

    const metrics = await this.getByTimeRange(startTime, now, {
      provider,
      model,
    });

    return this.calculateAggregates(metrics, provider, period, startTime, now);
  }

  /**
   * Get metrics for a specific request
   */
  async getByRequestId(requestId: string): Promise<RequestMetrics | null> {
    // Search HOT tier
    for (const metrics of this.hotMetrics.values()) {
      const found = metrics.find((m) => m.requestId === requestId);
      if (found) return found;
    }

    // Search WARM tier
    const warmKey = `request:${requestId}`;
    const warmData = await this.kvCache.get(warmKey, 'json');
    if (warmData) return warmData as RequestMetrics;

    // Search COLD tier
    const coldKey = `metrics/requests/${requestId}.json`;
    const coldObject = await this.r2Storage.get(coldKey);
    if (coldObject) {
      return await coldObject.json<RequestMetrics>();
    }

    return null;
  }

  /**
   * Get recent metrics (last N minutes)
   */
  async getRecent(minutes: number): Promise<RequestMetrics[]> {
    const startTime = Date.now() - minutes * 60 * 1000;
    return this.getByTimeRange(startTime, Date.now());
  }

  /**
   * Get metrics by user
   */
  async getByUser(
    userId: string,
    startTime: number,
    endTime: number
  ): Promise<RequestMetrics[]> {
    return this.getByTimeRange(startTime, endTime, { userId });
  }

  /**
   * Get metrics by feature
   */
  async getByFeature(
    feature: string,
    startTime: number,
    endTime: number
  ): Promise<RequestMetrics[]> {
    return this.getByTimeRange(startTime, endTime, { feature });
  }

  /**
   * Calculate statistics for a set of metrics
   */
  calculateStatistics(metrics: RequestMetrics[]): {
    count: number;
    successRate: number;
    cacheHitRate: number;
    totalTokens: number;
    totalCost: number;
    avgLatency: number;
    percentiles: { p50: number; p90: number; p95: number; p99: number };
  } {
    if (metrics.length === 0) {
      return {
        count: 0,
        successRate: 0,
        cacheHitRate: 0,
        totalTokens: 0,
        totalCost: 0,
        avgLatency: 0,
        percentiles: { p50: 0, p90: 0, p95: 0, p99: 0 },
      };
    }

    const latencies = metrics.map((m) => m.latency).sort((a, b) => a - b);
    const successful = metrics.filter((m) => m.success).length;
    const cacheHits = metrics.filter((m) => m.cacheHit).length;

    return {
      count: metrics.length,
      successRate: (successful / metrics.length) * 100,
      cacheHitRate: (cacheHits / metrics.length) * 100,
      totalTokens: metrics.reduce((sum, m) => sum + m.tokens.total, 0),
      totalCost: metrics.reduce((sum, m) => sum + m.cost, 0),
      avgLatency: metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length,
      percentiles: {
        p50: latencies[Math.floor(latencies.length * 0.5)],
        p90: latencies[Math.floor(latencies.length * 0.9)],
        p95: latencies[Math.floor(latencies.length * 0.95)],
        p99: latencies[Math.floor(latencies.length * 0.99)],
      },
    };
  }

  /**
   * Cleanup old metrics from HOT tier
   */
  private async cleanupHotTier(): Promise<void> {
    const now = Date.now();
    const hotMaxAge = 60 * 60 * 1000; // 1 hour

    for (const [hourKey, metrics] of this.hotMetrics.entries()) {
      const hourTime = this.parseHourKey(hourKey);
      const age = now - hourTime;

      if (age > hotMaxAge) {
        // Aggregate to WARM before removing
        await this.aggregateToWarm(hourKey);

        // Remove from HOT tier
        this.hotMetrics.delete(hourKey);
      }
    }
  }

  /**
   * Aggregate metrics to WARM tier (KV)
   */
  private async aggregateToWarm(hourKey: string): Promise<void> {
    const metrics = this.hotMetrics.get(hourKey);
    if (!metrics || metrics.length === 0) return;

    // Calculate aggregates by provider
    const byProvider = new Map<string, RequestMetrics[]>();
    for (const metric of metrics) {
      if (!byProvider.has(metric.provider)) {
        byProvider.set(metric.provider, []);
      }
      byProvider.get(metric.provider)!.push(metric);
    }

    // Store aggregates in KV
    for (const [provider, providerMetrics] of byProvider.entries()) {
      const aggregate = this.calculateAggregates(
        providerMetrics,
        provider,
        'hour',
        this.parseHourKey(hourKey),
        this.parseHourKey(hourKey) + 60 * 60 * 1000
      );

      const kvKey = `aggregate:hour:${hourKey}:${provider}`;
      await this.kvCache.put(kvKey, JSON.stringify(aggregate), {
        expirationTtl: 24 * 60 * 60, // 24 hours
      });
    }
  }

  /**
   * Get aggregated metrics from WARM tier
   */
  private async getFromWarm(
    startTime: number,
    endTime: number,
    options?: MetricsQueryOptions
  ): Promise<RequestMetrics[]> {
    const results: RequestMetrics[] = [];

    // This is simplified - in production, you'd list KV keys or maintain an index
    // For now, we'll return empty and rely on HOT tier
    return results;
  }

  /**
   * Get metrics from COLD tier (R2)
   */
  private async getFromCold(
    startTime: number,
    endTime: number,
    options?: MetricsQueryOptions
  ): Promise<RequestMetrics[]> {
    // List R2 objects in the time range
    const listed = await this.r2Storage.list({
      prefix: 'metrics/requests/',
    });

    const results: RequestMetrics[] = [];

    for (const object of listed.objects) {
      const objectTime = this.parseObjectKey(object.key);
      if (objectTime >= startTime && objectTime <= endTime) {
        const objectData = await this.r2Storage.get(object.key);
        if (objectData) {
          const metrics = await objectData.json<RequestMetrics[]>();
          results.push(...metrics);
        }
      }
    }

    return this.filterMetrics(results, options);
  }

  /**
   * Calculate aggregate metrics from raw metrics
   */
  private calculateAggregates(
    metrics: RequestMetrics[],
    provider: string,
    period: 'hour' | 'day' | 'week',
    startTime: number,
    endTime: number
  ): AggregateMetrics {
    if (metrics.length === 0) {
      return {
        period,
        startTime,
        endTime,
        provider,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        latency: { p50: 0, p90: 0, p95: 0, p99: 0, avg: 0 },
        totalCost: 0,
        avgCostPerRequest: 0,
        avgCostPer1KTokens: 0,
        cacheHitRate: 0,
        cacheSavings: 0,
      };
    }

    const stats = this.calculateStatistics(metrics);
    const latencies = metrics.map((m) => m.latency).sort((a, b) => a - b);
    const totalTokens = metrics.reduce((sum, m) => sum + m.tokens.total, 0);

    // Calculate cache savings (assume 95% savings on cache hits)
    const cacheHits = metrics.filter((m) => m.cacheHit).length;
    const avgCostPerRequest = stats.totalCost / metrics.length;
    const cacheSavings = cacheHits * avgCostPerRequest * 0.95;

    return {
      period,
      startTime,
      endTime,
      provider,
      totalRequests: metrics.length,
      successfulRequests: metrics.filter((m) => m.success).length,
      failedRequests: metrics.filter((m) => !m.success).length,
      cacheHits,
      cacheMisses: metrics.length - cacheHits,
      totalTokens,
      promptTokens: metrics.reduce((sum, m) => sum + m.tokens.prompt, 0),
      completionTokens: metrics.reduce((sum, m) => sum + m.tokens.completion, 0),
      latency: {
        p50: latencies[Math.floor(latencies.length * 0.5)],
        p90: latencies[Math.floor(latencies.length * 0.9)],
        p95: latencies[Math.floor(latencies.length * 0.95)],
        p99: latencies[Math.floor(latencies.length * 0.99)],
        avg: stats.avgLatency,
      },
      totalCost: stats.totalCost,
      avgCostPerRequest: stats.totalCost / metrics.length,
      avgCostPer1KTokens: (stats.totalCost / totalTokens) * 1000,
      cacheHitRate: stats.cacheHitRate,
      cacheSavings,
    };
  }

  /**
   * Filter metrics by query options
   */
  private filterMetrics(
    metrics: RequestMetrics[],
    options?: MetricsQueryOptions
  ): RequestMetrics[] {
    if (!options) return metrics;

    let filtered = metrics;

    if (options.provider) {
      filtered = filtered.filter((m) => m.provider === options.provider);
    }

    if (options.model) {
      filtered = filtered.filter((m) => m.model === options.model);
    }

    if (options.feature) {
      filtered = filtered.filter((m) => m.feature === options.feature);
    }

    if (options.userId) {
      filtered = filtered.filter((m) => m.userId === options.userId);
    }

    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  /**
   * Get hour-based key for HOT tier
   */
  private getHourKey(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}-${date.getUTCHours()}`;
  }

  /**
   * Parse hour key to timestamp
   */
  private parseHourKey(hourKey: string): number {
    const [year, month, day, hour] = hourKey.split('-').map(Number);
    return Date.UTC(year, month - 1, day, hour, 0, 0, 0);
  }

  /**
   * Parse R2 object key to timestamp
   */
  private parseObjectKey(key: string): number {
    // Extract timestamp from key like "metrics/requests/2026-01-13/14.json"
    const match = key.match(/(\d{4})-(\d{2})-(\d{2})\/(\d{2})\.json$/);
    if (!match) return 0;

    const [, year, month, day, hour] = match;
    return Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      0,
      0,
      0
    );
  }
}
