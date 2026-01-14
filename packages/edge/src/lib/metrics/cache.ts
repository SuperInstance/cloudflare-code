/**
 * Cache Metrics Collector
 *
 * Tracks cache performance across HOT (DO), WARM (KV), and COLD (R2) tiers.
 * Monitors hit rates, latency, evictions, and storage usage.
 */

import type { CacheMetrics } from './types';

export class CacheMetricsCollector {
  private kvCache: KVNamespace;
  private r2Storage: R2Bucket;

  // In-memory metrics by tier
  private tierMetrics: Map<'hot' | 'warm' | 'cold', CacheSnapshot>;

  constructor(kvCache: KVNamespace, r2Storage: R2Bucket) {
    this.kvCache = kvCache;
    this.r2Storage = r2Storage;
    this.tierMetrics = new Map();
    this.tierMetrics.set('hot', this.createSnapshot('hot'));
    this.tierMetrics.set('warm', this.createSnapshot('warm'));
    this.tierMetrics.set('cold', this.createSnapshot('cold'));
  }

  /**
   * Record a cache hit
   */
  recordHit(tier: 'hot' | 'warm' | 'cold', latency: number): void {
    const snapshot = this.tierMetrics.get(tier)!;
    snapshot.hits++;
    snapshot.totalRequests++;
    snapshot.latencies.push(latency);
    snapshot.lastUpdate = Date.now();
  }

  /**
   * Record a cache miss
   */
  recordMiss(tier: 'hot' | 'warm' | 'cold', latency: number): void {
    const snapshot = this.tierMetrics.get(tier)!;
    snapshot.misses++;
    snapshot.totalRequests++;
    snapshot.latencies.push(latency);
    snapshot.lastUpdate = Date.now();
  }

  /**
   * Record an eviction
   */
  recordEviction(tier: 'hot' | 'warm' | 'cold'): void {
    const snapshot = this.tierMetrics.get(tier)!;
    snapshot.evictions++;
  }

  /**
   * Update cache size
   */
  updateSize(tier: 'hot' | 'warm' | 'cold', bytes: number, entries: number): void {
    const snapshot = this.tierMetrics.get(tier)!;
    snapshot.size = bytes;
    snapshot.entryCount = entries;
    snapshot.lastUpdate = Date.now();
  }

  /**
   * Get metrics for a specific tier
   */
  async getTierMetrics(tier: 'hot' | 'warm' | 'cold'): Promise<CacheMetrics> {
    const snapshot = this.tierMetrics.get(tier)!;
    const latencies = snapshot.latencies.sort((a, b) => a - b);

    // Calculate average entry age (simplified)
    const avgEntryAge = Date.now() - snapshot.lastUpdate;

    return {
      tier,
      timestamp: Date.now(),
      hitRate:
        snapshot.totalRequests > 0
          ? snapshot.hits / snapshot.totalRequests
          : 0,
      totalRequests: snapshot.totalRequests,
      hits: snapshot.hits,
      misses: snapshot.misses,
      avgLatency: this.calculateAverage(snapshot.latencies),
      size: snapshot.size,
      entryCount: snapshot.entryCount,
      evictionCount: snapshot.evictions,
      evictionRate:
        snapshot.totalRequests > 0
          ? (snapshot.evictions / snapshot.totalRequests) * 1000
          : 0,
    };
  }

  /**
   * Get metrics for all tiers
   */
  async getAllTiers(): Promise<{
    hot: CacheMetrics;
    warm: CacheMetrics;
    cold: CacheMetrics;
  }> {
    return {
      hot: await this.getTierMetrics('hot'),
      warm: await this.getTierMetrics('warm'),
      cold: await this.getTierMetrics('cold'),
    };
  }

  /**
   * Get overall cache metrics (aggregated across tiers)
   */
  async getOverallMetrics(): Promise<{
    hitRate: number;
    totalRequests: number;
    totalHits: number;
    totalMisses: number;
    avgLatency: number;
    totalSize: number;
    totalEntries: number;
  }> {
    const [hot, warm, cold] = await Promise.all([
      this.getTierMetrics('hot'),
      this.getTierMetrics('warm'),
      this.getTierMetrics('cold'),
    ]);

    const totalRequests = hot.totalRequests + warm.totalRequests + cold.totalRequests;
    const totalHits = hot.hits + warm.hits + cold.hits;
    const totalMisses = hot.misses + warm.misses + cold.misses;
    const totalSize = hot.size + warm.size + cold.size;
    const totalEntries = hot.entryCount + warm.entryCount + cold.entryCount;

    // Weighted average latency (by request count)
    const avgLatency =
      totalRequests > 0
        ? (hot.avgLatency * hot.totalRequests +
            warm.avgLatency * warm.totalRequests +
            cold.avgLatency * cold.totalRequests) / totalRequests
        : 0;

    return {
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      totalRequests,
      totalHits,
      totalMisses,
      avgLatency,
      totalSize,
      totalEntries,
    };
  }

  /**
   * Get cache hit rate by feature
   */
  async getHitRateByFeature(): Promise<Record<string, number>> {
    // This would require feature-aware cache tracking
    // For now, return overall hit rate
    const overall = await this.getOverallMetrics();
    return {
      'code-gen': overall.hitRate,
      'code-review': overall.hitRate,
      'docs': overall.hitRate,
      'other': overall.hitRate,
    };
  }

  /**
   * Get cache savings (cost and latency)
   */
  async getSavings(): Promise<{
    tokensSaved: number;
    costSaved: number;
    latencySaved: number;
    hitRate: number;
  }> {
    const overall = await this.getOverallMetrics();

    // Estimate tokens saved (average 1000 tokens per cache hit)
    const avgTokensPerRequest = 1000;
    const tokensSaved = overall.totalHits * avgTokensPerRequest;

    // Estimate cost saved (average $0.01 per 1K tokens)
    const avgCostPer1KTokens = 0.01;
    const costSaved = (tokensSaved / 1000) * avgCostPer1KTokens;

    // Estimate latency saved (cache hits are ~50ms, misses are ~500ms)
    const cacheHitLatency = overall.avgLatency;
    const cacheMissLatency = 500;
    const latencySaved = overall.totalHits * (cacheMissLatency - cacheHitLatency);

    return {
      tokensSaved,
      costSaved,
      latencySaved,
      hitRate: overall.hitRate,
    };
  }

  /**
   * Get cache efficiency metrics
   */
  async getEfficiencyMetrics(): Promise<{
    avgEntrySize: number;
    memoryUtilization: number;
    evictionRate: number;
    staleEntryRate: number;
  }> {
    const overall = await this.getOverallMetrics();
    const [hot, warm, cold] = await Promise.all([
      this.getTierMetrics('hot'),
      this.getTierMetrics('warm'),
      this.getTierMetrics('cold'),
    ]);

    const totalEvictions = hot.evictionCount + warm.evictionCount + cold.evictionCount;
    const avgEntrySize =
      overall.totalEntries > 0
        ? overall.totalSize / overall.totalEntries
        : 0;

    // Estimate memory utilization (assuming 100MB total cache)
    const maxCacheSize = 100 * 1024 * 1024; // 100MB
    const memoryUtilization = overall.totalSize / maxCacheSize;

    return {
      avgEntrySize,
      memoryUtilization,
      evictionRate:
        overall.totalRequests > 0
          ? (totalEvictions / overall.totalRequests) * 1000
          : 0,
      staleEntryRate: 0, // Would need TTL tracking
    };
  }

  /**
   * Reset metrics for a tier
   */
  resetTier(tier: 'hot' | 'warm' | 'cold'): void {
    this.tierMetrics.set(tier, this.createSnapshot(tier));
  }

  /**
   * Reset all metrics
   */
  resetAll(): void {
    this.tierMetrics.set('hot', this.createSnapshot('hot'));
    this.tierMetrics.set('warm', this.createSnapshot('warm'));
    this.tierMetrics.set('cold', this.createSnapshot('cold'));
  }

  /**
   * Get metrics as Prometheus format
   */
  async getPrometheusMetrics(): Promise<string> {
    const [hot, warm, cold, overall, savings] = await Promise.all([
      this.getTierMetrics('hot'),
      this.getTierMetrics('warm'),
      this.getTierMetrics('cold'),
      this.getOverallMetrics(),
      this.getSavings(),
    ]);

    const lines: string[] = [];

    // Hit rates
    lines.push(
      `# HELP cache_hit_rate Cache hit rate by tier`,
      `# TYPE cache_hit_rate gauge`,
      `cache_hit_rate{tier="hot"} ${hot.hitRate}`,
      `cache_hit_rate{tier="warm"} ${warm.hitRate}`,
      `cache_hit_rate{tier="cold"} ${cold.hitRate}`,
      `cache_hit_rate{tier="overall"} ${overall.hitRate}`,
      ''
    );

    // Request counts
    lines.push(
      `# HELP cache_requests_total Total cache requests by tier`,
      `# TYPE cache_requests_total counter`,
      `cache_requests_total{tier="hot",status="hit"} ${hot.hits}`,
      `cache_requests_total{tier="hot",status="miss"} ${hot.misses}`,
      `cache_requests_total{tier="warm",status="hit"} ${warm.hits}`,
      `cache_requests_total{tier="warm",status="miss"} ${warm.misses}`,
      `cache_requests_total{tier="cold",status="hit"} ${cold.hits}`,
      `cache_requests_total{tier="cold",status="miss"} ${cold.misses}`,
      ''
    );

    // Latency
    lines.push(
      `# HELP cache_latency_seconds Cache latency by tier`,
      `# TYPE cache_latency_seconds gauge`,
      `cache_latency_seconds{tier="hot"} ${hot.avgLatency / 1000}`,
      `cache_latency_seconds{tier="warm"} ${warm.avgLatency / 1000}`,
      `cache_latency_seconds{tier="cold"} ${cold.avgLatency / 1000}`,
      ''
    );

    // Size
    lines.push(
      `# HELP cache_size_bytes Cache size in bytes by tier`,
      `# TYPE cache_size_bytes gauge`,
      `cache_size_bytes{tier="hot"} ${hot.size}`,
      `cache_size_bytes{tier="warm"} ${warm.size}`,
      `cache_size_bytes{tier="cold"} ${cold.size}`,
      ''
    );

    // Entries
    lines.push(
      `# HELP cache_entries Cache entry count by tier`,
      `# TYPE cache_entries gauge`,
      `cache_entries{tier="hot"} ${hot.entryCount}`,
      `cache_entries{tier="warm"} ${warm.entryCount}`,
      `cache_entries{tier="cold"} ${cold.entryCount}`,
      ''
    );

    // Evictions
    lines.push(
      `# HELP cache_evictions_total Total cache evictions by tier`,
      `# TYPE cache_evictions_total counter`,
      `cache_evictions_total{tier="hot"} ${hot.evictionCount}`,
      `cache_evictions_total{tier="warm"} ${warm.evictionCount}`,
      `cache_evictions_total{tier="cold"} ${cold.evictionCount}`,
      ''
    );

    // Savings
    lines.push(
      `# HELP cache_savings_dollars Total cost savings from cache hits`,
      `# TYPE cache_savings_dollars gauge`,
      `cache_savings_dollars ${savings.costSaved}`,
      '',
      `# HELP cache_savings_tokens Total tokens saved from cache hits`,
      `# TYPE cache_savings_tokens counter`,
      `cache_savings_tokens ${savings.tokensSaved}`,
      ''
    );

    return lines.join('\n');
  }

  /**
   * Create a new snapshot for a tier
   */
  private createSnapshot(tier: 'hot' | 'warm' | 'cold'): CacheSnapshot {
    return {
      tier,
      hits: 0,
      misses: 0,
      totalRequests: 0,
      latencies: [],
      evictions: 0,
      size: 0,
      entryCount: 0,
      lastUpdate: Date.now(),
    };
  }

  /**
   * Calculate average of array
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }
}

/**
 * Internal snapshot structure for cache metrics
 */
interface CacheSnapshot {
  tier: 'hot' | 'warm' | 'cold';
  hits: number;
  misses: number;
  totalRequests: number;
  latencies: number[];
  evictions: number;
  size: number;
  entryCount: number;
  lastUpdate: number;
}
