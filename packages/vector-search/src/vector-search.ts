/**
 * VectorSearch - Main entry point for vector search functionality
 *
 * Provides a unified interface for vector indexing, search, and management.
 */

import {
  Vector,
  VectorId,
  VectorRecord,
  SearchQuery,
  SearchResult,
  IndexConfig,
  IndexType,
  DistanceMetric,
  VectorDatabaseConfig,
  BatchResult,
  IndexStats,
  EmbeddingModelConfig,
} from './types/index.js';
import { VectorIndex } from './index/vector-index.js';
import { SearchEngine } from './search/engine.js';
import { EmbeddingManager } from './embeddings/manager.js';
import { VectorDatabase } from './database/abstraction.js';
import { RealtimeIndexer } from './indexing/realtime.js';
import { QueryOptimizer } from './optimizer/optimizer.js';

/**
 * VectorSearch configuration
 */
export interface VectorSearchConfig {
  dimension: number;
  metric?: DistanceMetric;
  indexType?: IndexType;
  indexConfig?: Partial<IndexConfig>;
  databaseConfig?: VectorDatabaseConfig;
  cacheEnabled?: boolean;
  cacheSize?: number;
  optimizerEnabled?: boolean;
}

/**
 * Main VectorSearch class
 */
export class VectorSearch {
  private vectorIndex: VectorIndex;
  private searchEngine: SearchEngine;
  private embeddingManager: EmbeddingManager;
  private database?: VectorDatabase;
  private realtimeIndexer: RealtimeIndexer;
  private queryOptimizer: QueryOptimizer;
  private config: VectorSearchConfig;

  constructor(config: VectorSearchConfig) {
    this.config = config;

    // Initialize vector index
    const indexConfig: IndexConfig = {
      type: config.indexType || IndexType.HNSW,
      dimension: config.dimension,
      metric: config.metric || DistanceMetric.COSINE,
      ...config.indexConfig,
    };

    this.vectorIndex = new VectorIndex(indexConfig);

    // Initialize search engine
    this.searchEngine = new SearchEngine(
      this.vectorIndex,
      config.cacheEnabled || true,
      config.cacheSize || 1000
    );

    // Initialize embedding manager
    const defaultModel: EmbeddingModelConfig = {
      name: 'default',
      dimension: config.dimension,
      modelType: 'text',
    };

    this.embeddingManager = new EmbeddingManager(defaultModel);

    // Initialize real-time indexer
    this.realtimeIndexer = new RealtimeIndexer(this.vectorIndex);

    // Initialize query optimizer
    this.queryOptimizer = new QueryOptimizer(this.vectorIndex, {
      cacheEnabled: config.cacheEnabled || true,
      cacheMaxSize: config.cacheSize || 1000,
    });

    // Initialize database if config provided
    if (config.databaseConfig) {
      this.database = new VectorDatabase(config.databaseConfig);
    }
  }

  /**
   * Initialize the vector search system
   */
  async initialize(): Promise<void> {
    if (this.database) {
      await this.database.connect();
    }
  }

  /**
   * Shutdown the vector search system
   */
  async shutdown(): Promise<void> {
    await this.realtimeIndexer.shutdown();

    if (this.database) {
      await this.database.disconnect();
    }
  }

  /**
   * Insert a vector
   */
  async insert(record: VectorRecord): Promise<void> {
    await this.realtimeIndexer.insert(record);

    if (this.database) {
      await this.database.insert(record);
    }
  }

  /**
   * Insert multiple vectors
   */
  async insertBatch(records: VectorRecord[]): Promise<BatchResult> {
    const result = await this.realtimeIndexer.insertBatch(records);

    if (this.database) {
      await this.database.insertBatch(records);
    }

    return result;
  }

  /**
   * Delete a vector
   */
  async delete(id: VectorId): Promise<boolean> {
    const result = await this.realtimeIndexer.delete(id);

    if (this.database) {
      await this.database.delete(id);
    }

    return result;
  }

  /**
   * Update a vector
   */
  async update(record: VectorRecord): Promise<boolean> {
    const result = await this.realtimeIndexer.update(record);

    if (this.database) {
      await this.database.update(record);
    }

    return result;
  }

  /**
   * Search for similar vectors
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    return await this.searchEngine.search(query).then((r) => r.results);
  }

  /**
   * Generate embeddings for text
   */
  async embed(text: string): Promise<Vector> {
    return await this.embeddingManager.embed(text);
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<Vector[]> {
    return await this.embeddingManager.embedBatch(texts);
  }

  /**
   * Get index statistics
   */
  getStats(): IndexStats {
    return this.vectorIndex.getStats();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.searchEngine.getCacheStats();
  }

  /**
   * Get query statistics
   */
  getQueryStats() {
    return this.queryOptimizer.getQueryStats();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.searchEngine.clearCache();
    this.queryOptimizer.clearCache();
  }

  /**
   * Optimize the index
   */
  async optimize(): Promise<void> {
    await this.realtimeIndexer.optimize();
  }

  /**
   * Get health status
   */
  async getHealth() {
    const indexHealth = await this.vectorIndex.healthCheck();
    const indexerHealth = await this.realtimeIndexer.getHealth();

    return {
      index: indexHealth,
      indexer: indexerHealth,
      healthy:
        indexHealth.status === 'healthy' &&
        (indexerHealth.queueSize < 1000),
    };
  }

  /**
   * Get configuration
   */
  getConfig(): VectorSearchConfig {
    return { ...this.config };
  }
}
