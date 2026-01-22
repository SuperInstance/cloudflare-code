/**
 * Code Vector Store
 *
 * Stores code chunks with embeddings and provides
 * semantic search using HNSW index.
 *
 * Performance Targets:
 * - Index 1000 chunks: <100ms
 * - Search top-10: <10ms
 * - Memory overhead: ~100 bytes per chunk (excluding embeddings)
 */

import type {
  CodeChunk,
  ChunkFilter,
  ChunkSearchResult,
  VectorStoreOptions,
  SearchStats,
  IndexingStats,
} from './types';
import { HNSWIndex, type SearchResult as HNSWSearchResult } from '../hnsw';
import type { KVNamespace } from '@cloudflare/workers-types';

const DEFAULT_OPTIONS: Required<VectorStoreOptions> = {
  index: {
    M: 16,
    efConstruction: 100,
    ef: 50,
    maxLayers: 0,
    metric: 'cosine',
  },
  storage: 'memory',
  cacheSize: 1000,
  persist: {
    enabled: false,
    interval: 60000,
    keyPrefix: 'codebase:',
  },
};

/**
 * Vector Store for Code Chunks
 */
export class CodeVectorStore {
  private options: Required<VectorStoreOptions>;
  private hnswIndex: HNSWIndex;
  private chunks: Map<string, CodeChunk>;
  private chunkById: Map<string, string>; // chunk ID -> vector ID mapping
  private chunksByFile: Map<string, Set<string>>; // file path -> chunk IDs
  private cache: Map<string, CodeChunk[]>;
  private kv?: KVNamespace;

  // Statistics
  private stats: SearchStats;

  constructor(options: VectorStoreOptions = {}, kv?: KVNamespace) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      index: { ...DEFAULT_OPTIONS.index, ...options.index },
      persist: { ...DEFAULT_OPTIONS.persist, ...options.persist },
    };

    this.hnswIndex = new HNSWIndex(this.options.index);
    this.chunks = new Map();
    this.chunkById = new Map();
    this.chunksByFile = new Map();
    this.cache = new Map();
    if (kv !== undefined) {
      this.kv = kv;
    }

    this.stats = {
      totalSearches: 0,
      avgSearchTime: 0,
      avgResults: 0,
      cacheHitRate: 0,
      lastSearch: 0,
    };

    // Start persistence timer if enabled
    if (this.options.persist.enabled && this.kv) {
      this.startPersistenceTimer();
    }
  }

  /**
   * Index code chunks with embeddings
   *
   * @param chunks - Chunks to index
   */
  public async index(chunks: CodeChunk[]): Promise<void> {
    const startTime = performance.now();

    for (const chunk of chunks) {
      await this.indexChunk(chunk);
    }

    const latency = performance.now() - startTime;
    console.debug(`Indexed ${chunks.length} chunks in ${latency.toFixed(2)}ms`);

    // Persist if enabled
    if (this.options.persist.enabled && this.kv) {
      await this.persist();
    }
  }

  /**
   * Index a single chunk
   *
   * @private
   */
  private async indexChunk(chunk: CodeChunk): Promise<void> {
    if (!chunk.embedding) {
      console.warn(`Skipping chunk ${chunk.id} - no embedding`);
      return;
    }

    // Add to HNSW index
    this.hnswIndex.add(chunk.embedding, chunk.id);

    // Store chunk data
    this.chunks.set(chunk.id, chunk);
    this.chunkById.set(chunk.id, chunk.id);

    // Index by file
    if (!this.chunksByFile.has(chunk.filePath)) {
      this.chunksByFile.set(chunk.filePath, new Set());
    }
    this.chunksByFile.get(chunk.filePath)!.add(chunk.id);

    // Invalidate cache
    this.invalidateCache(chunk.filePath);
  }

  /**
   * Semantic search for relevant code
   *
   * @param query - Query embedding
   * @param k - Number of results
   * @param filters - Optional filters
   * @returns Search results sorted by relevance
   */
  async search(
    query: Float32Array,
    k: number = 10,
    filters?: ChunkFilter
  ): Promise<ChunkSearchResult[]> {
    const startTime = performance.now();
    this.stats.totalSearches++;

    // Check cache first
    const cacheKey = this.getCacheKey(query, k, filters);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.stats.cacheHitRate = (this.stats.cacheHitRate * (this.stats.totalSearches - 1) + 1) / this.stats.totalSearches;
      return this.toSearchResults(cached, startTime);
    }

    // Perform HNSW search
    const hnswResults = this.hnswIndex.search(query, k * 2); // Get more for filtering

    // Convert to chunks and apply filters
    let results: ChunkSearchResult[] = [];
    for (const result of hnswResults) {
      const chunk = this.chunks.get(result.id);
      if (!chunk) continue;

      // Apply filters
      if (filters && !this.matchesFilters(chunk, filters)) {
        continue;
      }

      results.push({
        chunk,
        similarity: result.similarity,
        score: this.calculateScore(result, chunk),
        rank: results.length + 1,
      });

      if (results.length >= k) break;
    }

    // Update cache
    if (results.length > 0) {
      this.updateCache(cacheKey, results);
    }

    // Update statistics
    const latency = performance.now() - startTime;
    this.updateStats(latency, results.length);

    return results;
  }

  /**
   * Hybrid search (semantic + keyword)
   *
   * @param query - Query string
   * @param queryEmbedding - Query embedding
   * @param k - Number of results
   * @param filters - Optional filters
   * @returns Combined search results
   */
  async hybridSearch(
    query: string,
    queryEmbedding: Float32Array,
    k: number = 10,
    filters?: ChunkFilter
  ): Promise<ChunkSearchResult[]> {
    // Semantic search
    const semanticResults = await this.search(queryEmbedding, k * 2, filters);

    // Keyword search (simple text matching)
    const keywordResults = this.keywordSearch(query, k * 2, filters);

    // Combine and re-rank
    const combined = this.combineResults(semanticResults, keywordResults);

    return combined.slice(0, k);
  }

  /**
   * Simple keyword search
   *
   * @private
   */
  private keywordSearch(query: string, k: number, filters?: ChunkFilter): ChunkSearchResult[] {
    const terms = query.toLowerCase().split(/\s+/);
    const scores = new Map<string, number>();

    for (const [id, chunk] of this.chunks) {
      if (filters && !this.matchesFilters(chunk, filters)) continue;

      const content = chunk.content.toLowerCase();
      let score = 0;

      for (const term of terms) {
        if (content.includes(term)) {
          score += 1;
        }
        if (chunk.name?.toLowerCase().includes(term)) {
          score += 2; // Boost name matches
        }
      }

      if (score > 0) {
        scores.set(id, score);
      }
    }

    // Convert to results
    const results: ChunkSearchResult[] = [];
    const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]).slice(0, k);

    for (const [id, score] of sorted) {
      const chunk = this.chunks.get(id)!;
      results.push({
        chunk,
        similarity: 0, // No semantic similarity
        score: score / terms.length, // Normalize by query length
        rank: results.length + 1,
      });
    }

    return results;
  }

  /**
   * Combine semantic and keyword results
   *
   * @private
   */
  private combineResults(
    semanticResults: ChunkSearchResult[],
    keywordResults: ChunkSearchResult[]
  ): ChunkSearchResult[] {
    const combined = new Map<string, ChunkSearchResult>();

    // Add semantic results
    for (const result of semanticResults) {
      combined.set(result.chunk.id, {
        ...result,
        score: result.similarity * 0.7, // Weight: 70% semantic
      });
    }

    // Add/boost keyword results
    for (const result of keywordResults) {
      const existing = combined.get(result.chunk.id);
      if (existing) {
        existing.score += result.score * 0.3; // Weight: 30% keyword
      } else {
        combined.set(result.chunk.id, {
          ...result,
          score: result.score * 0.3,
        });
      }
    }

    // Sort by combined score
    return Array.from(combined.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Get chunks by file path
   *
   * @param filePath - File path
   * @returns Chunks from the file
   */
  async getByFile(filePath: string): Promise<CodeChunk[]> {
    const chunkIds = this.chunksByFile.get(filePath);
    if (!chunkIds) return [];

    const chunks: CodeChunk[] = [];
    for (const id of chunkIds) {
      const chunk = this.chunks.get(id);
      if (chunk) chunks.push(chunk);
    }

    return chunks.sort((a, b) => a.startLine - b.startLine);
  }

  /**
   * Get related chunks by dependencies
   *
   * @param chunkId - Chunk ID
   * @param depth - Dependency depth to traverse
   * @returns Related chunks
   */
  async getRelated(chunkId: string, depth: number = 1): Promise<CodeChunk[]> {
    const visited = new Set<string>();
    const related: CodeChunk[] = [];

    const traverse = async (id: string, currentDepth: number) => {
      if (visited.has(id) || currentDepth > depth) return;

      visited.add(id);
      const chunk = this.chunks.get(id);
      if (!chunk) return;

      if (currentDepth > 0) {
        related.push(chunk);
      }

      // Traverse dependencies
      for (const depId of chunk.dependencies) {
        await traverse(depId, currentDepth + 1);
      }
    };

    await traverse(chunkId, 0);

    return related;
  }

  /**
   * Remove chunk from index
   *
   * @param chunkId - Chunk ID to remove
   */
  async remove(chunkId: string): Promise<boolean> {
    const chunk = this.chunks.get(chunkId);
    if (!chunk) return false;

    // Remove from HNSW index
    this.hnswIndex.remove(chunkId);

    // Remove from storage
    this.chunks.delete(chunkId);
    this.chunkById.delete(chunkId);

    // Remove from file index
    const fileChunks = this.chunksByFile.get(chunk.filePath);
    if (fileChunks) {
      fileChunks.delete(chunkId);
      if (fileChunks.size === 0) {
        this.chunksByFile.delete(chunk.filePath);
      }
    }

    // Invalidate cache
    this.invalidateCache(chunk.filePath);

    return true;
  }

  /**
   * Clear all chunks from index
   */
  async clear(): Promise<void> {
    this.hnswIndex.clear();
    this.chunks.clear();
    this.chunkById.clear();
    this.chunksByFile.clear();
    this.cache.clear();
  }

  /**
   * Get index statistics
   */
  getStats(): IndexingStats & SearchStats {
    const languages: Record<string, number> = {};

    for (const chunk of this.chunks.values()) {
      languages[chunk.language] = (languages[chunk.language] || 0) + 1;
    }

    const totalTokens = Array.from(this.chunks.values()).reduce(
      (sum, chunk) => sum + chunk.content.length / 4, // Rough token estimate
      0
    );

    return {
      totalFiles: this.chunksByFile.size,
      totalChunks: this.chunks.size,
      totalTokens: Math.floor(totalTokens),
      languages: languages as any,
      avgChunksPerFile: this.chunks.size / Math.max(1, this.chunksByFile.size),
      avgFileSize: Array.from(this.chunks.values()).reduce((sum, c) => sum + c.content.length, 0) / Math.max(1, this.chunks.size),
      indexingTime: 0, // Would need to track this during indexing
      lastIndexed: Date.now(),
      ...this.stats,
    };
  }

  /**
   * Persist index to KV storage
   *
   * @private
   */
  private async persist(): Promise<void> {
    if (!this.kv || !this.options.persist.enabled) return;

    try {
      // Store chunks metadata (embeddings stay in memory for now)
      const chunksData = Array.from(this.chunks.entries()).map(([id, chunk]) => [
        id,
        {
          id: chunk.id,
          filePath: chunk.filePath,
          language: chunk.language,
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          type: chunk.type,
          name: chunk.name,
          dependencies: chunk.dependencies,
          embedding: Array.from(chunk.embedding || []), // Convert Float32Array to array
        },
      ]);

      await this.kv.put(
        `${this.options.persist.keyPrefix}chunks`,
        JSON.stringify(chunksData),
        { expirationTtl: 86400 } // 24 hours
      );

      console.debug(`Persisted ${chunksData.length} chunks to KV`);
    } catch (error) {
      console.error('Failed to persist index:', error);
    }
  }

  /**
   * Load index from KV storage
   */
  async load(): Promise<void> {
    if (!this.kv || !this.options.persist.enabled) return;

    try {
      const data = await this.kv.get(`${this.options.persist.keyPrefix}chunks`, 'json');
      if (!data) return;

      const chunksData = data as Array<[string, any]>;
      for (const [, chunkData] of chunksData) {
        const chunk: CodeChunk = {
          ...chunkData,
          embedding: new Float32Array(chunkData.embedding),
        };
        await this.indexChunk(chunk);
      }

      console.debug(`Loaded ${chunksData.length} chunks from KV`);
    } catch (error) {
      console.error('Failed to load index:', error);
    }
  }

  /**
   * Start persistence timer
   *
   * @private
   */
  private startPersistenceTimer(): void {
    if (typeof setInterval === 'undefined') return; // Not available in Workers

    setInterval(
      () => {
        this.persist();
      },
      this.options.persist.interval
    );
  }

  /**
   * Check if chunk matches filters
   *
   * @private
   */
  private matchesFilters(chunk: CodeChunk, filters: ChunkFilter): boolean {
    if (filters.languages && !filters.languages.includes(chunk.language)) {
      return false;
    }

    if (filters.types && !filters.types.includes(chunk.type)) {
      return false;
    }

    if (filters.filePaths && !filters.filePaths.includes(chunk.filePath)) {
      return false;
    }

    if (filters.filePathPattern) {
      const pattern = new RegExp(filters.filePathPattern);
      if (!pattern.test(chunk.filePath)) {
        return false;
      }
    }

    if (filters.hasExports && chunk.exports.length === 0) {
      return false;
    }

    if (filters.hasImports && chunk.imports.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Calculate combined score
   *
   * @private
   */
  private calculateScore(hnswResult: HNSWSearchResult, chunk: CodeChunk): number {
    let score = hnswResult.similarity;

    // Boost based on chunk type
    if (chunk.type === 'function' || chunk.type === 'class') {
      score *= 1.1; // 10% boost for functions/classes
    }

    // Boost based on exports
    if (chunk.exports.length > 0) {
      score *= 1.05; // 5% boost for exports
    }

    return Math.min(score, 1); // Cap at 1
  }

  /**
   * Generate cache key
   *
   * @private
   */
  private getCacheKey(query: Float32Array, k: number, filters?: ChunkFilter): string {
    // Use first few dimensions of query as cache key
    const queryPrefix = Array.from(query.slice(0, 10)).join(',');
    const filterStr = filters ? JSON.stringify(filters) : '';
    return `${queryPrefix}:${k}:${filterStr}`;
  }

  /**
   * Update cache
   *
   * @private
   */
  private updateCache(key: string, results: ChunkSearchResult[]): void {
    // Simple LRU: limit cache size
    if (this.cache.size >= this.options.cacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, results.map(r => r.chunk));
  }

  /**
   * Invalidate cache for file
   *
   * @private
   */
  private invalidateCache(filePath: string): void {
    for (const key of this.cache.keys()) {
      const chunks = this.cache.get(key);
      if (chunks?.some(c => c.filePath === filePath)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Convert chunks to search results
   *
   * @private
   */
  private toSearchResults(chunks: CodeChunk[], startTime: number): ChunkSearchResult[] {
    const latency = performance.now() - startTime;
    this.updateStats(latency, chunks.length);

    return chunks.map((chunk, i) => ({
      chunk,
      similarity: 1, // Cached results don't have similarity
      score: 1,
      rank: i + 1,
    }));
  }

  /**
   * Update search statistics
   *
   * @private
   */
  private updateStats(latency: number, resultCount: number): void {
    this.stats.avgSearchTime =
      (this.stats.avgSearchTime * (this.stats.totalSearches - 1) + latency) / this.stats.totalSearches;
    this.stats.avgResults =
      (this.stats.avgResults * (this.stats.totalSearches - 1) + resultCount) / this.stats.totalSearches;
    this.stats.lastSearch = Date.now();
  }

  /**
   * Get HNSW index stats (for debugging)
   */
  getHNSWStats() {
    return this.hnswIndex.getStats();
  }
}

/**
 * Create a vector store instance
 */
export function createCodeVectorStore(options?: VectorStoreOptions, kv?: KVNamespace): CodeVectorStore {
  return new CodeVectorStore(options, kv);
}
