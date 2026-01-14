/**
 * Cache Analytics Collector
 *
 * Collects and processes cache performance metrics across all tiers.
 */

import type {
  CacheStats,
  CacheTier,
  AnalyticsPeriod,
  OverallMetrics,
  TierMetrics,
  FeatureMetrics,
  EndpointMetrics,
  GeographyMetrics,
  CacheInsight,
  CacheRecommendation,
} from '../types';

export interface AnalyticsConfig {
  retentionPeriod: number; // milliseconds
  aggregationInterval: number; // milliseconds
  sampleRate: number; // 0-1
  enableRealtime: boolean;
}

export interface MetricSnapshot {
  timestamp: number;
  tier: CacheTier;
  hits: number;
  misses: number;
  latency: number;
  size: number;
  feature?: string;
  endpoint?: string;
  geography?: string;
}

/**
 * Cache Analytics Collector
 *
 * Collects metrics from cache operations and provides analytics.
 */
export class CacheAnalyticsCollector {
  private kv: KVNamespace;
  private config: AnalyticsConfig;
  private snapshots: MetricSnapshot[];
  private tierStats: Map<CacheTier, CacheStats>;
  private startTime: number;

  constructor(kv: KVNamespace, config: Partial<AnalyticsConfig> = {}) {
    this.kv = kv;
    this.config = {
      retentionPeriod: 86400000 * 7, // 7 days
      aggregationInterval: 60000, // 1 minute
      sampleRate: 1.0,
      enableRealtime: true,
      ...config,
    };

    this.snapshots = [];
    this.tierStats = new Map();
    this.startTime = Date.now();

    // Initialize tier stats
    for (const tier of ['hot', 'warm', 'cold', 'browser'] as CacheTier[]) {
      this.tierStats.set(tier, this.createEmptyStats(tier));
    }
  }

  /**
   * Record a cache hit
   */
  recordHit(
    tier: CacheTier,
    latency: number,
    metadata?: {
      feature?: string;
      endpoint?: string;
      geography?: string;
      size?: number;
    }
  ): void {
    if (Math.random() > this.config.sampleRate) {
      return; // Sampling
    }

    const stats = this.tierStats.get(tier)!;
    stats.hits++;
    stats.totalRequests++;
    stats.hitRate = stats.hits / stats.totalRequests;

    // Update latency
    this.updateLatency(stats, latency);

    // Update size
    if (metadata?.size !== undefined) {
      stats.size += metadata.size;
    }

    // Create snapshot
    if (this.config.enableRealtime) {
      this.snapshots.push({
        timestamp: Date.now(),
        tier,
        hits: 1,
        misses: 0,
        latency,
        size: metadata?.size || 0,
        feature: metadata.feature,
        endpoint: metadata.endpoint,
        geography: metadata.geography,
      });
    }
  }

  /**
   * Record a cache miss
   */
  recordMiss(
    tier: CacheTier,
    latency: number,
    metadata?: {
      feature?: string;
      endpoint?: string;
      geography?: string;
    }
  ): void {
    if (Math.random() > this.config.sampleRate) {
      return; // Sampling
    }

    const stats = this.tierStats.get(tier)!;
    stats.misses++;
    stats.totalRequests++;
    stats.hitRate = stats.hits / stats.totalRequests;

    // Update latency
    this.updateLatency(stats, latency);

    // Create snapshot
    if (this.config.enableRealtime) {
      this.snapshots.push({
        timestamp: Date.now(),
        tier,
        hits: 0,
        misses: 1,
        latency,
        size: 0,
        feature: metadata.feature,
        endpoint: metadata.endpoint,
        geography: metadata.geography,
      });
    }
  }

  /**
   * Record an eviction
   */
  recordEviction(tier: CacheTier): void {
    const stats = this.tierStats.get(tier)!;
    stats.evictions++;
  }

  /**
   * Get overall metrics
   */
  async getOverallMetrics(period: AnalyticsPeriod = 'daily'): Promise<OverallMetrics> {
    const now = Date.now();
    const periodMs = this.getPeriodMs(period);
    const cutoff = now - periodMs;

    // Filter snapshots by period
    const periodSnapshots = this.snapshots.filter((s) => s.timestamp >= cutoff);

    // Calculate metrics
    let totalRequests = 0;
    let totalHits = 0;
    let totalMisses = 0;
    let totalLatency = 0;
    let latencies: number[] = [];

    for (const snapshot of periodSnapshots) {
      totalRequests += snapshot.hits + snapshot.misses;
      totalHits += snapshot.hits;
      totalMisses += snapshot.misses;
      totalLatency += snapshot.latency;
      latencies.push(snapshot.latency);
    }

    // Calculate percentiles
    latencies.sort((a, b) => a - b);
    const p50 = this.getPercentile(latencies, 50);
    const p95 = this.getPercentile(latencies, 95);
    const p99 = this.getPercentile(latencies, 99);

    // Calculate savings
    const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;
    const avgTokenPerRequest = 1000;
    const tokensSaved = totalHits * avgTokenPerRequest;
    const costPer1KTokens = 0.01;
    const costSaved = (tokensSaved / 1000) * costPer1KTokens;
    const avgHitLatency = this.getAverage(latencies.filter((_, i) => periodSnapshots[i]?.hits));
    const avgMissLatency = 500;
    const bandwidthSaved = totalHits * 1024 * 100; // Assume 100KB per hit

    return {
      hitRate,
      totalRequests,
      totalHits,
      totalMisses,
      avgLatency: totalRequests > 0 ? totalLatency / totalRequests : 0,
      p50Latency: p50,
      p95Latency: p95,
      p99Latency: p99,
      bandwidthSaved,
      costSaved,
      tokensSaved,
    };
  }

  /**
   * Get metrics by tier
   */
  async getTierMetrics(): Promise<Record<CacheTier, TierMetrics>> {
    const result: Record<CacheTier, TierMetrics> = {} as any;

    for (const [tier, stats] of this.tierStats) {
      result[tier] = {
        hitRate: stats.hitRate,
        totalRequests: stats.totalRequests,
        hits: stats.hits,
        misses: stats.misses,
        avgLatency: stats.avgLatency,
        size: stats.size,
        entryCount: stats.entryCount,
        evictionCount: stats.evictions,
        evictionRate: stats.totalRequests > 0 ? (stats.evictions / stats.totalRequests) * 1000 : 0,
        avgEntrySize: stats.entryCount > 0 ? stats.size / stats.entryCount : 0,
        utilizationRate: stats.size / (128 * 1024 * 1024), // Assume 128MB max
      };
    }

    return result;
  }

  /**
   * Get metrics by feature
   */
  async getFeatureMetrics(): Promise<Record<string, FeatureMetrics>> {
    const featureMap = new Map<string, {
      hits: number;
      misses: number;
      totalLatency: number;
      size: number;
      count: number;
    }>();

    // Aggregate by feature
    for (const snapshot of this.snapshots) {
      if (!snapshot.feature) continue;

      const existing = featureMap.get(snapshot.feature) || {
        hits: 0,
        misses: 0,
        totalLatency: 0,
        size: 0,
        count: 0,
      };

      existing.hits += snapshot.hits;
      existing.misses += snapshot.misses;
      existing.totalLatency += snapshot.latency;
      existing.size += snapshot.size;
      existing.count++;

      featureMap.set(snapshot.feature, existing);
    }

    // Convert to metrics
    const result: Record<string, FeatureMetrics> = {};
    for (const [feature, data] of featureMap) {
      const totalRequests = data.hits + data.misses;

      result[feature] = {
        hitRate: totalRequests > 0 ? data.hits / totalRequests : 0,
        totalRequests,
        avgLatency: data.count > 0 ? data.totalLatency / data.count : 0,
        size: data.size,
        entryCount: data.count,
      };
    }

    return result;
  }

  /**
   * Get metrics by endpoint
   */
  async getEndpointMetrics(): Promise<Record<string, EndpointMetrics>> {
    const endpointMap = new Map<string, {
      hits: number;
      misses: number;
      totalLatency: number;
      size: number;
      count: number;
      recentAccesses: number[];
    }>();

    // Aggregate by endpoint
    for (const snapshot of this.snapshots) {
      if (!snapshot.endpoint) continue;

      const existing = endpointMap.get(snapshot.endpoint) || {
        hits: 0,
        misses: 0,
        totalLatency: 0,
        size: 0,
        count: 0,
        recentAccesses: [],
      };

      existing.hits += snapshot.hits;
      existing.misses += snapshot.misses;
      existing.totalLatency += snapshot.latency;
      existing.size += snapshot.size;
      existing.count++;
      existing.recentAccesses.push(snapshot.timestamp);

      // Keep only last 100 accesses
      if (existing.recentAccesses.length > 100) {
        existing.recentAccesses.shift();
      }

      endpointMap.set(snapshot.endpoint, existing);
    }

    // Convert to metrics
    const result: Record<string, EndpointMetrics> = {};
    for (const [endpoint, data] of endpointMap) {
      const totalRequests = data.hits + data.misses;
      const hitRate = totalRequests > 0 ? data.hits / totalRequests : 0;

      // Calculate trend
      const recentAccesses = data.recentAccesses.slice(-20);
      const olderAccesses = data.recentAccesses.slice(0, -20);
      const recentRate = recentAccesses.length / 20;
      const olderRate = olderAccesses.length / Math.max(olderAccesses.length, 1);
      const trendChange = (recentRate - olderRate) / Math.max(olderRate, 1);

      let trend: 'rising' | 'stable' | 'falling' = 'stable';
      if (trendChange > 0.1) trend = 'rising';
      else if (trendChange < -0.1) trend = 'falling';

      result[endpoint] = {
        hitRate,
        totalRequests,
        avgLatency: data.count > 0 ? data.totalLatency / data.count : 0,
        size: data.size,
        popularity: totalRequests,
        trend,
      };
    }

    return result;
  }

  /**
   * Get metrics by geography
   */
  async getGeographyMetrics(): Promise<Record<string, GeographyMetrics>> {
    const geoMap = new Map<string, {
      hits: number;
      misses: number;
      totalLatency: number;
      count: number;
      closestDatacenter: string;
    }>();

    // Aggregate by geography
    for (const snapshot of this.snapshots) {
      if (!snapshot.geography) continue;

      const existing = geoMap.get(snapshot.geography) || {
        hits: 0,
        misses: 0,
        totalLatency: 0,
        count: 0,
        closestDatacenter: this.getDatacenterForGeography(snapshot.geography),
      };

      existing.hits += snapshot.hits;
      existing.misses += snapshot.misses;
      existing.totalLatency += snapshot.latency;
      existing.count++;

      geoMap.set(snapshot.geography, existing);
    }

    // Convert to metrics
    const result: Record<string, GeographyMetrics> = {};
    for (const [geography, data] of geoMap) {
      const totalRequests = data.hits + data.misses;

      result[geography] = {
        hitRate: totalRequests > 0 ? data.hits / totalRequests : 0,
        totalRequests,
        avgLatency: data.count > 0 ? data.totalLatency / data.count : 0,
        closestDatacenter: data.closestDatacenter,
      };
    }

    return result;
  }

  /**
   * Generate insights
   */
  async generateInsights(): Promise<CacheInsight[]> {
    const insights: CacheInsight[] = [];
    const overall = await this.getOverallMetrics();
    const tierMetrics = await this.getTierMetrics();

    // Hit rate insights
    if (overall.hitRate < 0.5) {
      insights.push({
        type: 'performance',
        severity: 'warning',
        title: 'Low Cache Hit Rate',
        description: `Overall cache hit rate is ${(overall.hitRate * 100).toFixed(1)}%, below recommended 50%`,
        metric: 'hitRate',
        value: overall.hitRate,
        threshold: 0.5,
        timestamp: Date.now(),
      });
    } else if (overall.hitRate > 0.9) {
      insights.push({
        type: 'performance',
        severity: 'info',
        title: 'Excellent Cache Hit Rate',
        description: `Overall cache hit rate is ${(overall.hitRate * 100).toFixed(1)}%, performing well`,
        metric: 'hitRate',
        value: overall.hitRate,
        threshold: 0.9,
        timestamp: Date.now(),
      });
    }

    // Latency insights
    if (overall.p95Latency > 500) {
      insights.push({
        type: 'performance',
        severity: 'warning',
        title: 'High Cache Latency',
        description: `P95 cache latency is ${overall.p95Latency.toFixed(0)}ms, above recommended 500ms`,
        metric: 'p95Latency',
        value: overall.p95Latency,
        threshold: 500,
        timestamp: Date.now(),
      });
    }

    // Tier-specific insights
    for (const [tier, metrics] of Object.entries(tierMetrics)) {
      if (metrics.evictionRate > 100) {
        insights.push({
          type: 'usage',
          severity: 'warning',
          title: `High Eviction Rate in ${tier.toUpperCase()} Cache`,
          description: `${tier} cache eviction rate is ${metrics.evictionRate.toFixed(1)} per 1000 requests`,
          metric: 'evictionRate',
          value: metrics.evictionRate,
          threshold: 100,
          timestamp: Date.now(),
        });
      }

      if (metrics.utilizationRate > 0.9) {
        insights.push({
          type: 'usage',
          severity: 'critical',
          title: `${tier.toUpperCase()} Cache Near Capacity`,
          description: `${tier} cache utilization is ${(metrics.utilizationRate * 100).toFixed(1)}%`,
          metric: 'utilizationRate',
          value: metrics.utilizationRate,
          threshold: 0.9,
          timestamp: Date.now(),
        });
      }
    }

    return insights;
  }

  /**
   * Generate recommendations
   */
  async generateRecommendations(): Promise<CacheRecommendation[]> {
    const recommendations: CacheRecommendation[] = [];
    const overall = await this.getOverallMetrics();
    const tierMetrics = await this.getTierMetrics();
    const endpointMetrics = await this.getEndpointMetrics();

    // TTL recommendations
    if (overall.hitRate < 0.6) {
      recommendations.push({
        type: 'ttl',
        priority: 'high',
        title: 'Increase Cache TTL',
        description: 'Consider increasing TTL for frequently accessed content to improve hit rate',
        action: 'Adjust cache TTL settings',
        expectedImpact: `Potential ${((0.8 - overall.hitRate) * 100).toFixed(1)}% hit rate improvement`,
        estimatedSavings: (0.8 - overall.hitRate) * overall.costSaved,
      });
    }

    // Warming recommendations
    const topEndpoints = Object.entries(endpointMetrics)
      .sort(([, a], [, b]) => b.totalRequests - a.totalRequests)
      .slice(0, 5);

    for (const [endpoint, metrics] of topEndpoints) {
      if (metrics.hitRate < 0.5 && metrics.popularity > 100) {
        recommendations.push({
          type: 'warming',
          priority: 'medium',
          title: `Preload Popular Endpoint: ${endpoint}`,
          description: `Endpoint has ${metrics.totalRequests} requests but only ${(metrics.hitRate * 100).toFixed(1)}% hit rate`,
          action: 'Add to cache warming schedule',
          expectedImpact: `Improved latency for ${metrics.popularity} requests per period`,
        });
      }
    }

    // Size recommendations
    for (const [tier, metrics] of Object.entries(tierMetrics)) {
      if (metrics.utilizationRate > 0.9) {
        recommendations.push({
          type: 'size',
          priority: 'high',
          title: `Increase ${tier.toUpperCase()} Cache Size`,
          description: `${tier} cache is at ${(metrics.utilizationRate * 100).toFixed(1)}% capacity`,
          action: 'Increase cache allocation or implement more aggressive eviction',
          expectedImpact: 'Reduced evictions and improved hit rate',
        });
      }
    }

    return recommendations;
  }

  /**
   * Cleanup old snapshots
   */
  cleanup(): void {
    const cutoff = Date.now() - this.config.retentionPeriod;
    this.snapshots = this.snapshots.filter((s) => s.timestamp >= cutoff);
  }

  /**
   * Persist metrics to KV
   */
  async persist(): Promise<void> {
    const data = {
      snapshots: this.snapshots.slice(-1000), // Keep last 1000
      tierStats: Array.from(this.tierStats.entries()),
      startTime: this.startTime,
    };

    await this.kv.put('analytics:data', JSON.stringify(data), {
      expirationTtl: 86400, // 24 hours
    });
  }

  /**
   * Load metrics from KV
   */
  async load(): Promise<void> {
    const data = await this.kv.get('analytics:data', 'json');
    if (data && typeof data === 'object') {
      const analyticsData = data as {
        snapshots: MetricSnapshot[];
        tierStats: [CacheTier, CacheStats][];
        startTime: number;
      };

      this.snapshots = analyticsData.snapshots;
      this.tierStats = new Map(analyticsData.tierStats);
      this.startTime = analyticsData.startTime;
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalSnapshots: this.snapshots.length,
      retentionPeriod: this.config.retentionPeriod,
      startTime: this.startTime,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Create empty stats for a tier
   */
  private createEmptyStats(tier: CacheTier): CacheStats {
    return {
      tier,
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalRequests: 0,
      evictions: 0,
      size: 0,
      entryCount: 0,
      avgLatency: 0,
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
    };
  }

  /**
   * Update latency statistics
   */
  private updateLatency(stats: CacheStats, latency: number): void {
    // Simplified latency tracking
    stats.avgLatency = (stats.avgLatency * (stats.totalRequests - 1) + latency) / stats.totalRequests;

    // For percentiles, we'd need to track all latencies
    // This is a simplified approach
    stats.p95Latency = stats.avgLatency * 1.5;
    stats.p99Latency = stats.avgLatency * 2;
  }

  /**
   * Get period in milliseconds
   */
  private getPeriodMs(period: AnalyticsPeriod): number {
    switch (period) {
      case 'hourly':
        return 3600000;
      case 'daily':
        return 86400000;
      case 'weekly':
        return 604800000;
      case 'monthly':
        return 2592000000;
    }
  }

  /**
   * Get percentile from sorted array
   */
  private getPercentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((sorted.length - 1) * (p / 100));
    return sorted[index];
  }

  /**
   * Get average of array
   */
  private getAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Get closest datacenter for geography
   */
  private getDatacenterForGeography(geography: string): string {
    // Simplified mapping
    const datacenterMap: Record<string, string> = {
      'US': 'ewr',
      'GB': 'lhr',
      'DE': 'fra',
      'JP': 'nrt',
      'SG': 'sin',
      'AU': 'syd',
    };

    return datacenterMap[geography] || 'auto';
  }
}

/**
 * Create a cache analytics collector
 */
export function createCacheAnalyticsCollector(
  kv: KVNamespace,
  config?: Partial<AnalyticsConfig>
): CacheAnalyticsCollector {
  return new CacheAnalyticsCollector(kv, config);
}
