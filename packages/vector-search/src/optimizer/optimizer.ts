// @ts-nocheck
/**
 * Query Optimizer - Optimize search queries for performance
 *
 * Provides query planning, index selection, caching strategies,
 * and performance monitoring.
 */

import {
  Vector,
  SearchQuery,
  QueryPlan,
  IndexType,
  DistanceMetric,
  SearchResult,
  SearchMetrics,
  VectorFilter,
  IndexStats,
} from '../types/index.js';
import { VectorIndex } from '../index/vector-index.js';
import { estimateFilterSelectivity, isFilterEmpty } from '../utils/filter.js';

/**
 * Query cache entry
 */
interface CacheEntry {
  query: SearchQuery;
  results: SearchResult[];
  timestamp: number;
  hitCount: number;
  plan: QueryPlan;
}

/**
 * Query statistics
 */
interface QueryStats {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  queriesPerSecond: number;
  lastReset: number;
}

/**
 * Query Optimizer class
 */
export class QueryOptimizer {
  private vectorIndex: VectorIndex;
  private cache: Map<string, CacheEntry>;
  private cacheEnabled: boolean;
  private cacheMaxSize: number;
  private cacheMaxAge: number;
  private queryStats: QueryStats;
  private latencies: number[];
  private prefetchEnabled: boolean;
  private prefetchThreshold: number;
  private lastQueryTime: number;

  constructor(
    vectorIndex: VectorIndex,
    options: {
      cacheEnabled?: boolean;
      cacheMaxSize?: number;
      cacheMaxAge?: number;
      prefetchEnabled?: boolean;
      prefetchThreshold?: number;
    } = {}
  ) {
    this.vectorIndex = vectorIndex;
    this.cacheEnabled = options.cacheEnabled ?? true;
    this.cacheMaxSize = options.cacheMaxSize ?? 1000;
    this.cacheMaxAge = options.cacheMaxAge ?? 300000; // 5 minutes
    this.prefetchEnabled = options.prefetchEnabled ?? false;
    this.prefetchThreshold = options.prefetchThreshold ?? 0.8;
    this.cache = new Map();
    this.lastQueryTime = 0;

    this.queryStats = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      queriesPerSecond: 0,
      lastReset: Date.now(),
    };

    this.latencies = [];
  }

  /**
   * Optimize and execute a search query
   */
  async search(query: SearchQuery): Promise<{
    results: SearchResult[];
    metrics: SearchMetrics;
    plan: QueryPlan;
  }> {
    const startTime = Date.now();

    // Check cache
    if (this.cacheEnabled) {
      const cacheKey = this.generateCacheKey(query);
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
        // Cache hit
        cached.hitCount++;
        this.queryStats.cacheHits++;
        this.queryStats.totalQueries++;

        const latency = Date.now() - startTime;
        this.updateLatency(latency);

        return {
          results: this.applyQueryToCachedResults(cached.results, query),
          metrics: {
            queryLatency: latency,
            vectorsScanned: 0,
            cacheHit: true,
            indexUsed: this.vectorIndex.getIndexType(),
          },
          plan: cached.plan,
        };
      }

      this.queryStats.cacheMisses++;
    }

    this.queryStats.totalQueries++;

    // Generate query plan
    const plan = this.generateQueryPlan(query);

    // Execute search
    const results = await this.vectorIndex.search(query.vector, query.topK || 10);

    // Apply filters
    let filteredResults = results;
    if (query.filter && !isFilterEmpty(query.filter)) {
      filteredResults = await this.applyFilters(results, query.filter);
    }

    // Cache results
    if (this.cacheEnabled) {
      this.cacheResult(query, filteredResults, plan);
    }

    // Prefetch if enabled
    if (this.prefetchEnabled) {
      await this.prefetch(query, plan);
    }

    const latency = Date.now() - startTime;
    this.updateLatency(latency);
    this.lastQueryTime = Date.now();

    return {
      results: filteredResults,
      metrics: {
        queryLatency: latency,
        vectorsScanned: this.estimateVectorsScanned(query),
        cacheHit: false,
        indexUsed: this.vectorIndex.getIndexType(),
      },
      plan,
    };
  }

  /**
   * Generate query plan
   */
  private generateQueryPlan(query: SearchQuery): QueryPlan {
    const stats = this.vectorIndex.getStats();
    const indexType = this.vectorIndex.getIndexType();

    // Estimate filter selectivity
    const filterSelectivity = query.filter
      ? estimateFilterSelectivity(query.filter)
      : 1.0;

    // Determine strategy
    let strategy: 'exact' | 'approximate' | 'hybrid' = 'approximate';

    if (stats.vectorCount < 1000) {
      // Small dataset: exact search
      strategy = 'exact';
    } else if (filterSelectivity < 0.1) {
      // Very selective filter: hybrid approach
      strategy = 'hybrid';
    } else {
      // Default: approximate search
      strategy = 'approximate';
    }

    // Estimate cost
    const estimatedCost = this.estimateQueryCost(query, stats);

    // Select indexes
    const indexesToUse = [indexType];

    // Set prefetch parameters
    const prefetch = {
      enabled: this.prefetchEnabled,
      batchSize: Math.min(100, query.topK || 10),
    };

    return {
      strategy,
      indexesToUse,
      estimatedCost,
      filters: query.filter || {},
      limit: query.topK || 10,
      prefetch,
    };
  }

  /**
   * Estimate query cost
   */
  private estimateQueryCost(query: SearchQuery, stats: IndexStats): number {
    let cost = stats.vectorCount;

    // Adjust for index type
    const indexType = this.vectorIndex.getIndexType();
    switch (indexType) {
      case IndexType.HNSW:
        cost = Math.log(stats.vectorCount) * (query.topK || 10);
        break;

      case IndexType.IVF:
        // Assume we search nprobe clusters
        const nprobe = 10; // Default
        cost = (stats.vectorCount / 100) * nprobe;
        break;
    }

    // Adjust for filter selectivity
    if (query.filter && !isFilterEmpty(query.filter)) {
      const selectivity = estimateFilterSelectivity(query.filter);
      cost *= selectivity;
    }

    return Math.max(cost, 1);
  }

  /**
   * Apply filters to results
   */
  private async applyFilters(
    results: SearchResult[],
    filter: VectorFilter
  ): Promise<SearchResult[]> {
    // Import filter utilities
    const { matchesVectorFilter } = await import('../utils/filter.js');

    return results.filter((result) => {
      if (!result.metadata) {
        return true; // Can't filter without metadata
      }
      return matchesVectorFilter(result.metadata, filter);
    });
  }

  /**
   * Apply query constraints to cached results
   */
  private applyQueryToCachedResults(
    cached: SearchResult[],
    query: SearchQuery
  ): SearchResult[] {
    let results = cached;

    // Apply topK limit
    const topK = query.topK || 10;
    results = results.slice(0, topK);

    // Apply filter
    if (query.filter && !isFilterEmpty(query.filter)) {
      // Note: This would need async filter application
      // For now, we'll just return the cached results
    }

    return results;
  }

  /**
   * Cache query results
   */
  private cacheResult(
    query: SearchQuery,
    results: SearchResult[],
    plan: QueryPlan
  ): void {
    // Check cache size
    if (this.cache.size >= this.cacheMaxSize) {
      this.evictFromCache();
    }

    const cacheKey = this.generateCacheKey(query);
    this.cache.set(cacheKey, {
      query,
      results,
      timestamp: Date.now(),
      hitCount: 0,
      plan,
    });
  }

  /**
   * Evict entries from cache
   */
  private evictFromCache(): void {
    // Find least recently used entry
    let lruKey: string | null = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < lruTime) {
        lruTime = entry.timestamp;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  /**
   * Generate cache key from query
   */
  private generateCacheKey(query: SearchQuery): string {
    const parts = [
      query.topK || 10,
      query.namespace || '',
      JSON.stringify(query.filter || {}),
    ];

    // Hash vector
    let hash = 0;
    for (let i = 0; i < Math.min(query.vector.length, 10); i++) {
      hash = (hash << 5) - hash + Math.floor(query.vector[i] * 100);
      hash |= 0;
    }

    parts.push(hash.toString(36));

    return parts.join(':');
  }

  /**
   * Prefetch related queries
   */
  private async prefetch(query: SearchQuery, plan: QueryPlan): Promise<void> {
    if (!plan.prefetch?.enabled) {
      return;
    }

    // Simple prefetch strategy: search for slightly modified queries
    const variations = this.generateQueryVariations(query, plan.prefetch.batchSize);

    for (const variation of variations) {
      const cacheKey = this.generateCacheKey(variation);

      if (!this.cache.has(cacheKey)) {
        // Prefetch this query
        try {
          const results = await this.vectorIndex.search(
            variation.vector,
            variation.topK || 10
          );

          this.cacheResult(variation, results, plan);
        } catch (error) {
          // Ignore prefetch errors
        }
      }
    }
  }

  /**
   * Generate query variations for prefetching
   */
  private generateQueryVariations(
    query: SearchQuery,
    count: number
  ): SearchQuery[] {
    const variations: SearchQuery[] = [];

    // Vary topK
    for (let i = 1; i <= 3; i++) {
      variations.push({
        ...query,
        topK: (query.topK || 10) * i,
      });
    }

    return variations.slice(0, count);
  }

  /**
   * Estimate number of vectors scanned
   */
  private estimateVectorsScanned(query: SearchQuery): number {
    const stats = this.vectorIndex.getStats();
    const indexType = this.vectorIndex.getIndexType();

    switch (indexType) {
      case IndexType.HNSW:
        // HNSW visits O(log N) nodes
        return Math.floor(Math.log(stats.vectorCount) * (query.topK || 10));

      case IndexType.IVF:
        // IVF searches nprobe clusters
        const nprobe = 10; // Default
        return Math.floor(stats.vectorCount * (nprobe / 100));

      default:
        return stats.vectorCount;
    }
  }

  /**
   * Update latency statistics
   */
  private updateLatency(latency: number): void {
    this.latencies.push(latency);

    // Keep only last 1000 latencies
    if (this.latencies.length > 1000) {
      this.latencies.shift();
    }

    // Update average
    this.queryStats.avgLatency =
      this.latencies.reduce((sum, l) => sum + l, 0) / this.latencies.length;

    // Update percentiles
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    this.queryStats.p95Latency = sorted[p95Index] || 0;
    this.queryStats.p99Latency = sorted[p99Index] || 0;

    // Update queries per second
    const elapsed = Date.now() - this.queryStats.lastReset;
    this.queryStats.queriesPerSecond =
      (this.queryStats.totalQueries / elapsed) * 1000;
  }

  /**
   * Get query statistics
   */
  getQueryStats(): QueryStats {
    return { ...this.queryStats };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    totalHits: number;
  } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
    }

    return {
      size: this.cache.size,
      maxSize: this.cacheMaxSize,
      hitRate:
        this.queryStats.totalQueries > 0
          ? this.queryStats.cacheHits / this.queryStats.totalQueries
          : 0,
      totalHits,
    };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Enable or disable cache
   */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    if (!enabled) {
      this.clearCache();
    }
  }

  /**
   * Set cache max size
   */
  setCacheMaxSize(size: number): void {
    this.cacheMaxSize = size;

    // Trim cache if necessary
    while (this.cache.size > this.cacheMaxSize) {
      this.evictFromCache();
    }
  }

  /**
   * Set cache max age
   */
  setCacheMaxAge(age: number): void {
    this.cacheMaxAge = age;

    // Clean old entries
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheMaxAge) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Enable or disable prefetch
   */
  setPrefetchEnabled(enabled: boolean): void {
    this.prefetchEnabled = enabled;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.queryStats = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      queriesPerSecond: 0,
      lastReset: Date.now(),
    };

    this.latencies = [];
  }

  /**
   * Optimize query based on historical performance
   */
  optimizeQuery(query: SearchQuery): SearchQuery {
    const stats = this.getQueryStats();

    // If cache hit rate is high, try to use larger cache window
    if (stats.hitRate > 0.8) {
      // Increase topK to cache more results
      return {
        ...query,
        topK: Math.min((query.topK || 10) * 2, 100),
      };
    }

    // If average latency is high, consider using approximate search
    if (stats.avgLatency > 100) {
      // Reduce topK for faster queries
      return {
        ...query,
        topK: Math.max((query.topK || 10) / 2, 5),
      };
    }

    return query;
  }

  /**
   * Analyze query patterns
   */
  analyzePatterns(): {
    avgTopK: number;
    filterUsage: number;
    namespaceUsage: number;
    peakHours: number[];
  } {
    let totalTopK = 0;
    let filterCount = 0;
    let namespaceCount = 0;
    const hourCounts = new Array(24).fill(0);

    for (const entry of this.cache.values()) {
      totalTopK += entry.query.topK || 10;

      if (entry.query.filter && !isFilterEmpty(entry.query.filter)) {
        filterCount++;
      }

      if (entry.query.namespace) {
        namespaceCount++;
      }

      const hour = new Date(entry.timestamp).getHours();
      hourCounts[hour]++;
    }

    const avgTopK = this.cache.size > 0 ? totalTopK / this.cache.size : 0;
    const filterUsage = this.cache.size > 0 ? filterCount / this.cache.size : 0;
    const namespaceUsage = this.cache.size > 0 ? namespaceCount / this.cache.size : 0;

    // Find peak hours
    const avgHourlyCount =
      hourCounts.reduce((sum, count) => sum + count, 0) / 24;
    const peakHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter((item) => item.count > avgHourlyCount * 1.5)
      .map((item) => item.hour);

    return {
      avgTopK,
      filterUsage,
      namespaceUsage,
      peakHours,
    };
  }

  /**
   * Suggest optimizations based on analysis
   */
  suggestOptimizations(): string[] {
    const suggestions: string[] = [];
    const stats = this.getQueryStats();
    const cacheStats = this.getCacheStats();
    const patterns = this.analyzePatterns();

    // Cache hit rate
    if (cacheStats.hitRate < 0.5) {
      suggestions.push('Consider increasing cache size or TTL to improve hit rate');
    }

    // Average latency
    if (stats.avgLatency > 100) {
      suggestions.push('High average latency detected. Consider using approximate search or reducing topK');
    }

    // Filter usage
    if (patterns.filterUsage > 0.5) {
      suggestions.push('High filter usage. Consider indexing filtered fields for better performance');
    }

    // Peak hours
    if (patterns.peakHours.length > 0) {
      suggestions.push(`Peak query hours detected: ${patterns.peakHours.join(', ')}. Consider scaling during these times`);
    }

    // Average topK
    if (patterns.avgTopK > 50) {
      suggestions.push('High average topK detected. Consider reducing default topK or implementing pagination');
    }

    return suggestions;
  }

  /**
   * Warm up the cache with common queries
   */
  async warmupCache(queries: SearchQuery[]): Promise<void> {
    for (const query of queries) {
      try {
        await this.search(query);
      } catch (error) {
        console.error('Error warming up cache:', error);
      }
    }
  }

  /**
   * Export cache for persistence
   */
  exportCache(): Array<{
    key: string;
    results: SearchResult[];
    timestamp: number;
    plan: QueryPlan;
  }> {
    const entries = [];

    for (const [key, entry] of this.cache.entries()) {
      entries.push({
        key,
        results: entry.results,
        timestamp: entry.timestamp,
        plan: entry.plan,
      });
    }

    return entries;
  }

  /**
   * Import cache from persistence
   */
  importCache(entries: Array<{
    key: string;
    results: SearchResult[];
    timestamp: number;
    plan: QueryPlan;
  }>): void {
    for (const entry of entries) {
      if (this.cache.size < this.cacheMaxSize) {
        this.cache.set(entry.key, {
          query: entry.plan.filters as any, // Simplified
          results: entry.results,
          timestamp: entry.timestamp,
          hitCount: 0,
          plan: entry.plan,
        });
      }
    }
  }

  /**
   * Get memory usage
   */
  getMemoryUsage(): number {
    let bytes = 0;

    // Cache storage
    for (const entry of this.cache.values()) {
      bytes += JSON.stringify(entry.results).length * 2; // Rough estimate
      bytes += 100; // Object overhead
    }

    return bytes;
  }
}
