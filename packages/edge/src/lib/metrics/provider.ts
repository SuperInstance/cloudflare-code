/**
 * Provider Metrics Collector
 *
 * Tracks health, performance, and quota metrics for AI providers.
 * Maintains rolling windows of metrics for real-time monitoring.
 */

import type { ProviderMetrics } from './types';

export class ProviderMetricsCollector {
  private kvCache: KVNamespace;
  private r2Storage: R2Bucket;

  // In-memory rolling metrics (last 5 minutes)
  private rollingMetrics: Map<string, ProviderMetricsSnapshot>;

  constructor(kvCache: KVNamespace, r2Storage: R2Bucket) {
    this.kvCache = kvCache;
    this.r2Storage = r2Storage;
    this.rollingMetrics = new Map();
  }

  /**
   * Record provider metrics
   */
  async record(provider: string, metrics: ProviderMetrics): Promise<void> {
    // Update rolling metrics
    if (!this.rollingMetrics.has(provider)) {
      this.rollingMetrics.set(provider, this.createSnapshot());
    }

    const snapshot = this.rollingMetrics.get(provider)!;
    this.updateSnapshot(snapshot, metrics);

    // Store in KV for persistence (5 minute TTL)
    const kvKey = `provider:${provider}:${Math.floor(Date.now() / 60000)}`;
    await this.kvCache.put(kvKey, JSON.stringify(metrics), {
      expirationTtl: 300, // 5 minutes
    });

    // Archive to R2 hourly
    await this.archiveToR2(provider, metrics);
  }

  /**
   * Get current status for a provider
   */
  async getProviderStatus(provider: string): Promise<ProviderMetrics | null> {
    // Check rolling metrics first
    const snapshot = this.rollingMetrics.get(provider);
    if (snapshot && snapshot.recentMetrics.length > 0) {
      return this.calculateProviderMetrics(provider, snapshot);
    }

    // Check KV cache
    const kvKey = `provider:${provider}:${Math.floor(Date.now() / 60000)}`;
    const cached = await this.kvCache.get(kvKey, 'json');
    if (cached) {
      return cached as ProviderMetrics;
    }

    return null;
  }

  /**
   * Get all provider statuses
   */
  async getAllProviders(): Promise<ProviderMetrics[]> {
    const providers = ['anthropic', 'openai', 'groq', 'cerebras', 'cloudflare'];
    const metrics: ProviderMetrics[] = [];

    for (const provider of providers) {
      const status = await this.getProviderStatus(provider);
      if (status) {
        metrics.push(status);
      }
    }

    return metrics;
  }

  /**
   * Update provider health status
   */
  async updateHealth(
    provider: string,
    health: 'healthy' | 'degraded' | 'down'
  ): Promise<void> {
    const snapshot = this.rollingMetrics.get(provider) || this.createSnapshot();
    snapshot.health = health;
    this.rollingMetrics.set(provider, snapshot);

    // Persist to KV
    const kvKey = `provider:${provider}:health`;
    await this.kvCache.put(kvKey, health, {
      expirationTtl: 300,
    });
  }

  /**
   * Record a successful request
   */
  recordSuccess(provider: string, latency: number, _tokens: number): void {
    const snapshot = this.rollingMetrics.get(provider) || this.createSnapshot();
    snapshot.requestCount++;
    snapshot.successCount++;
    snapshot.latencies.push(latency);
    this.rollingMetrics.set(provider, snapshot);
  }

  /**
   * Record a failed request
   */
  recordFailure(provider: string, errorCode: string): void {
    const snapshot = this.rollingMetrics.get(provider) || this.createSnapshot();
    snapshot.requestCount++;
    snapshot.failureCount++;
    snapshot.errorCodes[errorCode] = (snapshot.errorCodes[errorCode] || 0) + 1;
    this.rollingMetrics.set(provider, snapshot);
  }

  /**
   * Update quota usage
   */
  async updateQuota(
    provider: string,
    used: number,
    total: number,
    resetTime?: number
  ): Promise<void> {
    const snapshot = this.rollingMetrics.get(provider) || this.createSnapshot();
    snapshot.quotaUsed = used;
    snapshot.quotaTotal = total;
    if (resetTime !== undefined) {
      snapshot.quotaResetTime = resetTime;
    }
    this.rollingMetrics.set(provider, snapshot);

    // Persist to KV
    const kvKey = `provider:${provider}:quota`;
    const kvData: { used: number; total: number; resetTime?: number } = { used, total };
    if (resetTime !== undefined) {
      kvData.resetTime = resetTime;
    }
    await this.kvCache.put(
      kvKey,
      JSON.stringify(kvData),
      {
        expirationTtl: 3600, // 1 hour
      }
    );
  }

  /**
   * Get quota usage for a provider
   */
  async getQuota(provider: string): Promise<{
    used: number;
    total: number;
    percentage: number;
    resetTime?: number;
  } | null> {
    const snapshot = this.rollingMetrics.get(provider);
    if (snapshot) {
      const result: {
        used: number;
        total: number;
        percentage: number;
        resetTime?: number;
      } = {
        used: snapshot.quotaUsed,
        total: snapshot.quotaTotal,
        percentage: (snapshot.quotaUsed / snapshot.quotaTotal) * 100,
      };
      if (snapshot.quotaResetTime !== undefined) {
        result.resetTime = snapshot.quotaResetTime;
      }
      return result;
    }

    // Check KV cache
    const kvKey = `provider:${provider}:quota`;
    const cached = await this.kvCache.get(kvKey, 'json');
    if (cached) {
      const data = cached as { used: number; total: number; resetTime?: number };
      return {
        ...data,
        percentage: (data.used / data.total) * 100,
      };
    }

    return null;
  }

  /**
   * Calculate provider health score
   */
  calculateHealthScore(provider: string): number {
    const snapshot = this.rollingMetrics.get(provider);
    if (!snapshot || snapshot.requestCount === 0) return 0;

    const successRate = snapshot.successCount / snapshot.requestCount;
    const avgLatency = this.calculateAverage(snapshot.latencies);

    // Health score: 70% success rate, 30% latency (inverse)
    const latencyScore = Math.max(0, 1 - avgLatency / 5000); // 5s = 0 score
    return successRate * 0.7 + latencyScore * 0.3;
  }

  /**
   * Get provider ranking by cost
   */
  async getCostRanking(): Promise<
    Array<{ provider: string; avgCostPer1K: number; rank: number }>
  > {
    const providers = await this.getAllProviders();
    const costs = providers.map((p) => ({
      provider: p.provider,
      avgCostPer1K:
        (p.costPer1KTokens.input + p.costPer1KTokens.output) / 2,
    }));

    costs.sort((a, b) => a.avgCostPer1K - b.avgCostPer1K);

    return costs.map((c, i) => ({ ...c, rank: i + 1 }));
  }

  /**
   * Get provider ranking by latency
   */
  async getLatencyRanking(): Promise<
    Array<{ provider: string; avgLatency: number; rank: number }>
  > {
    const providers = await this.getAllProviders();
    const latencies = providers.map((p) => ({
      provider: p.provider,
      avgLatency: p.latency.p50,
    }));

    latencies.sort((a, b) => a.avgLatency - b.avgLatency);

    return latencies.map((l, i) => ({ ...l, rank: i + 1 }));
  }

  /**
   * Get provider ranking by quality (success rate)
   */
  async getQualityRanking(): Promise<
    Array<{ provider: string; successRate: number; rank: number }>
  > {
    const providers = await this.getAllProviders();
    const qualities = providers.map((p) => ({
      provider: p.provider,
      successRate: p.successRate,
    }));

    qualities.sort((a, b) => b.successRate - a.successRate);

    return qualities.map((q, i) => ({ ...q, rank: i + 1 }));
  }

  /**
   * Cleanup old rolling metrics
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [provider, snapshot] of this.rollingMetrics.entries()) {
      if (now - snapshot.lastUpdate > maxAge) {
        this.rollingMetrics.delete(provider);
      }
    }
  }

  /**
   * Create a new metrics snapshot
   */
  private createSnapshot(): ProviderMetricsSnapshot {
    return {
      requestCount: 0,
      successCount: 0,
      failureCount: 0,
      latencies: [],
      errorCodes: {},
      quotaUsed: 0,
      quotaTotal: Infinity,
      health: 'healthy',
      lastUpdate: Date.now(),
      recentMetrics: [],
    };
  }

  /**
   * Update snapshot with new metrics
   */
  private updateSnapshot(
    snapshot: ProviderMetricsSnapshot,
    metrics: ProviderMetrics
  ): void {
    snapshot.health = metrics.health;
    snapshot.quotaUsed = metrics.quotaUsed;
    snapshot.quotaTotal = metrics.quotaTotal;
    snapshot.quotaResetTime = metrics.quotaResetTime;
    snapshot.lastUpdate = Date.now();

    // Keep last 100 metrics for calculation
    snapshot.recentMetrics.push(metrics);
    if (snapshot.recentMetrics.length > 100) {
      snapshot.recentMetrics.shift();
    }
  }

  /**
   * Calculate provider metrics from snapshot
   */
  private calculateProviderMetrics(
    provider: string,
    snapshot: ProviderMetricsSnapshot
  ): ProviderMetrics {
    const latencies = snapshot.latencies.sort((a, b) => a - b);
    const successRate =
      snapshot.requestCount > 0
        ? snapshot.successCount / snapshot.requestCount
        : 1;

    // Calculate requests per minute
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = snapshot.recentMetrics.filter(
      (m) => m.timestamp >= oneMinuteAgo
    );
    const requestsPerMinute = recentRequests.length;

    const result: ProviderMetrics = {
      provider,
      timestamp: now,
      health: snapshot.health,
      latency: {
        p50: latencies[Math.floor(latencies.length * 0.5)] || 0,
        p95: latencies[Math.floor(latencies.length * 0.95)] || 0,
        p99: latencies[Math.floor(latencies.length * 0.99)] || 0,
      },
      successRate: successRate * 100,
      requestsPerMinute,
      tokensPerSecond: 0, // Would need token tracking
      quotaUsed: snapshot.quotaUsed,
      quotaTotal: snapshot.quotaTotal,
      costPer1KTokens: {
        input: 0,
        output: 0,
      }, // Would need pricing data
    };
    if (snapshot.quotaResetTime !== undefined) {
      result.quotaResetTime = snapshot.quotaResetTime;
    }
    return result;
  }

  /**
   * Calculate average of array
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Archive metrics to R2 for long-term storage
   */
  private async archiveToR2(
    provider: string,
    metrics: ProviderMetrics
  ): Promise<void> {
    const now = new Date();
    const hourKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}-${now.getUTCHours()}`;
    const r2Key = `metrics/providers/${provider}/${hourKey}.json`;

    // Get existing data
    const existing = await this.r2Storage.get(r2Key);
    let data: ProviderMetrics[] = [];

    if (existing) {
      data = await existing.json<ProviderMetrics[]>();
    }

    // Add new metrics
    data.push(metrics);

    // Store back to R2
    await this.r2Storage.put(r2Key, JSON.stringify(data));
  }
}

/**
 * Internal snapshot structure for rolling metrics
 */
interface ProviderMetricsSnapshot {
  requestCount: number;
  successCount: number;
  failureCount: number;
  latencies: number[];
  errorCodes: Record<string, number>;
  quotaUsed: number;
  quotaTotal: number;
  quotaResetTime?: number;
  health: 'healthy' | 'degraded' | 'down';
  lastUpdate: number;
  recentMetrics: ProviderMetrics[];
}
