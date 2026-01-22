/**
 * Search Engine - High-level search interface
 *
 * Provides advanced search capabilities including KNN search, range search,
 * hybrid search, faceted search, and re-ranking.
 */

import {
  Vector,
  VectorId,
  SearchQuery,
  SearchResult,
  RangeSearchParams,
  FacetedSearchParams,
  FacetResult,
  HybridSearchParams,
  RerankOptions,
  VectorFilter,
  DistanceMetric,
  SearchMetrics,
} from '../types/index.js';
import { VectorIndex } from '../index/vector-index.js';
import { matchesVectorFilter, isFilterEmpty } from '../utils/filter.js';
import { calculateDistance, calculateSimilarity } from '../utils/vector.js';

/**
 * Search Engine class
 */
export class SearchEngine {
  private vectorIndex: VectorIndex;
  private cache: Map<string, { results: SearchResult[]; timestamp: number }>;
  private cacheTTL: number;
  private cacheEnabled: boolean;

  constructor(vectorIndex: VectorIndex, cacheEnabled: boolean = true, cacheTTL: number = 60000) {
    this.vectorIndex = vectorIndex;
    this.cacheEnabled = cacheEnabled;
    this.cacheTTL = cacheTTL;
    this.cache = new Map();
  }

  /**
   * Perform KNN search
   */
  async search(query: SearchQuery): Promise<{
    results: SearchResult[];
    metrics: SearchMetrics;
  }> {
    const startTime = Date.now();
    let cacheHit = false;

    // Check cache
    if (this.cacheEnabled) {
      const cacheKey = this.generateCacheKey(query);
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        cacheHit = true;
        const metrics: SearchMetrics = {
          queryLatency: Date.now() - startTime,
          vectorsScanned: 0,
          cacheHit: true,
          indexUsed: this.vectorIndex.getIndexType(),
        };

        // Apply filter if needed
        let results = cached.results;
        if (query.filter && !isFilterEmpty(query.filter)) {
          results = await this.applyFilter(results, query.filter);
        }

        return { results, metrics };
      }
    }

    // Perform search
    const topK = query.topK || 10;
    let results = await this.vectorIndex.search(query.vector, topK);

    // Apply metadata filter if provided
    if (query.filter && !isFilterEmpty(query.filter)) {
      results = await this.applyFilter(results, query.filter);
    }

    // Apply namespace filter if provided
    if (query.namespace) {
      results = results.filter((r) => r.metadata?.namespace === query.namespace);
    }

    // Trim to topK
    results = results.slice(0, topK);

    // Cache results
    if (this.cacheEnabled) {
      const cacheKey = this.generateCacheKey(query);
      this.cache.set(cacheKey, {
        results: results.slice(0, topK * 2), // Cache extra for flexibility
        timestamp: Date.now(),
      });

      // Clean old cache entries
      this.cleanCache();
    }

    const metrics: SearchMetrics = {
      queryLatency: Date.now() - startTime,
      vectorsScanned: await this.estimateVectorsScanned(query),
      cacheHit,
      indexUsed: this.vectorIndex.getIndexType(),
    };

    return { results, metrics };
  }

  /**
   * Perform range search
   */
  async rangeSearch(params: RangeSearchParams): Promise<SearchResult[]> {
    const { vector, radius, filter, maxResults } = params;

    // Get more results than needed to filter by radius
    const topK = maxResults || 100;
    const allResults = await this.vectorIndex.search(vector, topK);

    // Filter by radius
    const rangeResults: SearchResult[] = [];

    for (const result of allResults) {
      if (result.distance !== undefined && result.distance <= radius) {
        rangeResults.push(result);
      }

      if (maxResults && rangeResults.length >= maxResults) {
        break;
      }
    }

    // Apply metadata filter if provided
    if (filter && !isFilterEmpty(filter)) {
      return await this.applyFilter(rangeResults, filter);
    }

    return rangeResults;
  }

  /**
   * Perform faceted search
   */
  async facetedSearch(params: FacetedSearchParams): Promise<{
    results: SearchResult[];
    facets: FacetResult[];
  }> {
    // Perform main search
    const { results } = await this.search({
      vector: params.vector,
      topK: params.topK,
      filter: params.filter,
      namespace: params.namespace,
      includeMetadata: true,
    });

    // Compute facets
    const facets: FacetResult[] = [];

    for (const facetDef of params.facets) {
      const facetValues = new Map<string | number, number>();

      for (const result of results) {
        if (!result.metadata) continue;

        const value = result.metadata[facetDef.field];

        if (value === undefined) continue;

        // Handle different facet types
        switch (facetDef.type) {
          case 'term':
            const termKey = String(value);
            facetValues.set(termKey, (facetValues.get(termKey) || 0) + 1);
            break;

          case 'range':
            if (typeof value === 'number') {
              if (facetDef.ranges) {
                for (const range of facetDef.ranges) {
                  if (value >= range.from && value < range.to) {
                    const rangeKey = range.label || `${range.from}-${range.to}`;
                    facetValues.set(rangeKey, (facetValues.get(rangeKey) || 0) + 1);
                  }
                }
              }
            }
            break;

          case 'histogram':
            if (typeof value === 'number') {
              // Simple histogram with fixed bins
              const binSize = 10;
              const bin = Math.floor(value / binSize) * binSize;
              const binKey = `${bin}-${bin + binSize}`;
              facetValues.set(binKey, (facetValues.get(binKey) || 0) + 1);
            }
            break;
        }
      }

      // Sort by count and take top values
      const sortedValues = Array.from(facetValues.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, params.maxFacetValues || 10)
        .map(([value, count]) => ({ value, count }));

      facets.push({
        field: facetDef.field,
        values: sortedValues,
      });
    }

    return { results, facets };
  }

  /**
   * Perform hybrid search (vector + keyword)
   */
  async hybridSearch(params: HybridSearchParams): Promise<SearchResult[]> {
    const {
      vector,
      query,
      topK = 10,
      vectorWeight = 0.7,
      keywordWeight = 0.3,
      alpha = 0.5,
      filter,
    } = params;

    // Perform vector search
    const vectorResults = await this.vectorIndex.search(vector, topK * 2);
    const vectorScores = new Map<VectorId, number>();
    for (const result of vectorResults) {
      vectorScores.set(result.id, result.score);
    }

    // Perform keyword search (simplified BM25-like scoring)
    const keywordResults = await this.keywordSearch(query, topK * 2);
    const keywordScores = new Map<VectorId, number>();
    for (const result of keywordResults) {
      keywordScores.set(result.id, result.score);
    }

    // Combine scores
    const combinedResults = new Map<VectorId, SearchResult>();
    const allIds = new Set([...vectorScores.keys(), ...keywordScores.keys()]);

    for (const id of allIds) {
      const vScore = vectorScores.get(id) || 0;
      const kScore = keywordScores.get(id) || 0;

      // Normalize scores
      const normalizedVSore = vScore;
      const normalizedKScore = kScore;

      // Combine using interpolation
      const combinedScore =
        alpha * normalizedVSore * vectorWeight +
        (1 - alpha) * normalizedKScore * keywordWeight;

      combinedResults.set(id, {
        id,
        score: combinedScore,
      });
    }

    // Sort by combined score
    let results = Array.from(combinedResults.values()).sort(
      (a, b) => b.score - a.score
    );

    // Apply filter
    if (filter && !isFilterEmpty(filter)) {
      results = await this.applyFilter(results, filter);
    }

    // Re-rank if needed
    return results.slice(0, topK);
  }

  /**
   * Simplified keyword search (BM25-like)
   */
  private async keywordSearch(
    query: string,
    topK: number
  ): Promise<SearchResult[]> {
    // This is a simplified implementation
    // In production, you would use a proper full-text search engine
    const results: SearchResult[] = [];

    // Get all vector IDs
    const allIds = await this.vectorIndex.getIds();

    // Simple term frequency scoring
    const terms = query.toLowerCase().split(/\s+/);

    for (const id of allIds.slice(0, 100)) {
      // Limit for performance
      const record = await this.vectorIndex.get(id);
      if (!record || !record.metadata) continue;

      let score = 0;
      const text =
        record.metadata.text ||
        record.metadata.description ||
        record.metadata.title ||
        '';

      const searchText = String(text).toLowerCase();

      for (const term of terms) {
        if (searchText.includes(term)) {
          score += 1;
        }
      }

      if (score > 0) {
        results.push({ id, score: score / terms.length });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /**
   * Re-rank search results
   */
  async rerank(
    results: SearchResult[],
    query: Vector,
    options: RerankOptions
  ): Promise<SearchResult[]> {
    switch (options.method) {
      case 'none':
        return results;

      case 'score-fusion':
        return this.scoreFusion(results);

      case 'rrf':
        return this.reciprocalRankFusion(results);

      case 'custom':
        if (options.customFunction) {
          return options.customFunction(results);
        }
        return results;

      default:
        return results;
    }
  }

  /**
   * Score fusion re-ranking
   */
  private scoreFusion(results: SearchResult[]): SearchResult[] {
    // Normalize scores and return
    const maxScore = Math.max(...results.map((r) => r.score));
    const minScore = Math.min(...results.map((r) => r.score));
    const range = maxScore - minScore;

    return results
      .map((r) => ({
        ...r,
        score: range > 0 ? (r.score - minScore) / range : r.score,
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Reciprocal Rank Fusion (RRF)
   */
  private reciprocalRankFusion(results: SearchResult[], k: number = 60): SearchResult[] {
    return results
      .map((r, index) => ({
        ...r,
        score: 1 / (k + index + 1),
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Apply filter to search results
   */
  private async applyFilter(
    results: SearchResult[],
    filter: VectorFilter
  ): Promise<SearchResult[]> {
    const filtered: SearchResult[] = [];

    for (const result of results) {
      if (!result.metadata) {
        // If no metadata, can't filter - include it
        filtered.push(result);
        continue;
      }

      if (matchesVectorFilter(result.metadata, filter)) {
        filtered.push(result);
      }
    }

    return filtered;
  }

  /**
   * Generate cache key for search query
   */
  private generateCacheKey(query: SearchQuery): string {
    const parts = [
      query.topK || 10,
      query.namespace || '',
      JSON.stringify(query.filter || {}),
    ];

    // Hash vector (simplified)
    let hash = 0;
    for (let i = 0; i < Math.min(query.vector.length, 10); i++) {
      hash = (hash << 5) - hash + query.vector[i];
      hash |= 0;
    }

    parts.push(hash.toString(36));

    return parts.join(':');
  }

  /**
   * Clean old cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Estimate number of vectors scanned
   */
  private async estimateVectorsScanned(query: SearchQuery): Promise<number> {
    const stats = this.vectorIndex.getStats();
    const indexType = this.vectorIndex.getIndexType();

    // Rough estimation based on index type
    switch (indexType) {
      case 'hnsw':
        // HNSW visits much fewer vectors
        return Math.min(stats.vectorCount, (query.topK || 10) * 20);

      case 'ivf':
        // IVF searches only nprobe clusters
        return Math.min(stats.vectorCount, (query.topK || 10) * 50);

      default:
        return stats.vectorCount;
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses
    };
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
   * Set cache TTL
   */
  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
  }

  /**
   * Batch search
   */
  async batchSearch(queries: SearchQuery[]): Promise<Array<{
    results: SearchResult[];
    metrics: SearchMetrics;
  }>> {
    const results = [];

    for (const query of queries) {
      const result = await this.search(query);
      results.push(result);
    }

    return results;
  }

  /**
   * Multi-vector search (search with multiple query vectors)
   */
  async multiVectorSearch(
    queries: Vector[],
    topK: number = 10,
    aggregation: 'mean' | 'max' | 'min' = 'mean'
  ): Promise<SearchResult[]> {
    // Perform search for each query
    const allResults = await Promise.all(
      queries.map((q) => this.vectorIndex.search(q, topK * 2))
    );

    // Aggregate scores
    const aggregatedScores = new Map<VectorId, number[]>();

    for (const results of allResults) {
      for (const result of results) {
        if (!aggregatedScores.has(result.id)) {
          aggregatedScores.set(result.id, []);
        }
        aggregatedScores.get(result.id)!.push(result.score);
      }
    }

    // Compute final scores
    const finalResults: SearchResult[] = [];

    for (const [id, scores] of aggregatedScores.entries()) {
      let finalScore: number;

      switch (aggregation) {
        case 'mean':
          finalScore = scores.reduce((a, b) => a + b, 0) / scores.length;
          break;
        case 'max':
          finalScore = Math.max(...scores);
          break;
        case 'min':
          finalScore = Math.min(...scores);
          break;
      }

      finalResults.push({ id, score: finalScore });
    }

    return finalResults.sort((a, b) => b.score - a.score).slice(0, topK);
  }
}
