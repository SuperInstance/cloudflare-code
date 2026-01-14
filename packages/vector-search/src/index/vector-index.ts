/**
 * Vector Index - Main interface for vector indexing
 *
 * Provides a unified interface for different index types (HNSW, IVF, etc.)
 * and handles index selection, management, and operations.
 */

import {
  Vector,
  VectorId,
  VectorRecord,
  IndexConfig,
  IndexType,
  DistanceMetric,
  SearchResult,
  IndexStats,
  IndexOperation,
  IndexOperationResult,
  BatchResult,
  IndexOptimizationOptions,
  IndexHealthCheck,
  IndexHealth,
  PerformanceMetrics,
} from '../types/index.js';
import { HNSWIndex } from './hnsw.js';
import { IVFIndex } from './ivf.js';

/**
 * Vector Index class
 */
export class VectorIndex {
  private index: HNSWIndex | IVFIndex | null;
  private indexType: IndexType;
  private config: IndexConfig;
  private dimension: number;
  private metrics: {
    queryCount: number;
    totalQueryTime: number;
    queriesPerSecond: number;
    lastQueryTime: number;
  };

  constructor(config: IndexConfig) {
    this.config = config;
    this.indexType = config.type;
    this.dimension = config.dimension;
    this.index = null;
    this.metrics = {
      queryCount: 0,
      totalQueryTime: 0,
      queriesPerSecond: 0,
      lastQueryTime: 0,
    };

    this.initializeIndex();
  }

  /**
   * Initialize the appropriate index based on config
   */
  private initializeIndex(): void {
    switch (this.indexType) {
      case IndexType.HNSW:
        this.index = new HNSWIndex(this.config);
        break;

      case IndexType.IVF:
        this.index = new IVFIndex(this.config);
        break;

      default:
        throw new Error(`Unsupported index type: ${this.indexType}`);
    }
  }

  /**
   * Insert a vector into the index
   */
  async insert(record: VectorRecord): Promise<IndexOperationResult> {
    const startTime = Date.now();

    try {
      if (!this.index) {
        throw new Error('Index not initialized');
      }

      await this.index.insert(record);

      return {
        operation: IndexOperation.INSERT,
        success: true,
        vectorId: record.id,
      };
    } catch (error) {
      return {
        operation: IndexOperation.INSERT,
        success: false,
        vectorId: record.id,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Insert multiple vectors in batch
   */
  async insertBatch(records: VectorRecord[]): Promise<BatchResult> {
    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ id: VectorId; error: string }> = [];

    for (const record of records) {
      const result = await this.insert(record);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
        errors.push({
          id: record.id,
          error: result.error || 'Unknown error',
        });
      }
    }

    return { succeeded, failed, errors };
  }

  /**
   * Delete a vector from the index
   */
  async delete(id: VectorId): Promise<IndexOperationResult> {
    const startTime = Date.now();

    try {
      if (!this.index) {
        throw new Error('Index not initialized');
      }

      const deleted = await this.index.delete(id);

      return {
        operation: IndexOperation.DELETE,
        success: deleted,
        vectorId: id,
        error: deleted ? undefined : 'Vector not found',
      };
    } catch (error) {
      return {
        operation: IndexOperation.DELETE,
        success: false,
        vectorId: id,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Delete multiple vectors in batch
   */
  async deleteBatch(ids: VectorId[]): Promise<BatchResult> {
    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ id: VectorId; error: string }> = [];

    for (const id of ids) {
      const result = await this.delete(id);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
        errors.push({
          id,
          error: result.error || 'Unknown error',
        });
      }
    }

    return { succeeded, failed, errors };
  }

  /**
   * Update a vector in the index
   */
  async update(record: VectorRecord): Promise<IndexOperationResult> {
    const startTime = Date.now();

    try {
      if (!this.index) {
        throw new Error('Index not initialized');
      }

      const updated = await this.index.update(record);

      return {
        operation: IndexOperation.UPDATE,
        success: updated,
        vectorId: record.id,
        error: updated ? undefined : 'Vector not found',
      };
    } catch (error) {
      return {
        operation: IndexOperation.UPDATE,
        success: false,
        vectorId: record.id,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Update multiple vectors in batch
   */
  async updateBatch(records: VectorRecord[]): Promise<BatchResult> {
    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ id: VectorId; error: string }> = [];

    for (const record of records) {
      const result = await this.update(record);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
        errors.push({
          id: record.id,
          error: result.error || 'Unknown error',
        });
      }
    }

    return { succeeded, failed, errors };
  }

  /**
   * Upsert a vector (insert or update)
   */
  async upsert(record: VectorRecord): Promise<IndexOperationResult> {
    const exists = await this.has(record.id);

    if (exists) {
      return await this.update(record);
    } else {
      return await this.insert(record);
    }
  }

  /**
   * Search for k-nearest neighbors
   */
  async search(query: Vector, k: number = 10): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      if (!this.index) {
        throw new Error('Index not initialized');
      }

      const results = await this.index.search(query, k);

      // Update metrics
      const queryTime = Date.now() - startTime;
      this.metrics.queryCount++;
      this.metrics.totalQueryTime += queryTime;
      this.metrics.queriesPerSecond = 1000 / queryTime;
      this.metrics.lastQueryTime = queryTime;

      return results;
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  /**
   * Get a vector by ID
   */
  async get(id: VectorId): Promise<VectorRecord | null> {
    if (!this.index) {
      throw new Error('Index not initialized');
    }

    return await this.index.get(id);
  }

  /**
   * Check if a vector exists
   */
  async has(id: VectorId): Promise<boolean> {
    if (!this.index) {
      throw new Error('Index not initialized');
    }

    return await this.index.has(id);
  }

  /**
   * Get all vector IDs
   */
  async getIds(): Promise<VectorId[]> {
    if (!this.index) {
      throw new Error('Index not initialized');
    }

    return this.index.getIds();
  }

  /**
   * Get number of vectors in index
   */
  async size(): Promise<number> {
    if (!this.index) {
      throw new Error('Index not initialized');
    }

    return this.index.size();
  }

  /**
   * Check if index is empty
   */
  async isEmpty(): Promise<boolean> {
    if (!this.index) {
      throw new Error('Index not initialized');
    }

    return this.index.isEmpty();
  }

  /**
   * Clear all vectors from the index
   */
  async clear(): Promise<void> {
    if (!this.index) {
      throw new Error('Index not initialized');
    }

    await this.index.clear();

    // Reset metrics
    this.metrics = {
      queryCount: 0,
      totalQueryTime: 0,
      queriesPerSecond: 0,
      lastQueryTime: 0,
    };
  }

  /**
   * Get index statistics
   */
  getStats(): IndexStats {
    if (!this.index) {
      throw new Error('Index not initialized');
    }

    const stats = this.index.getStats();
    return {
      ...stats,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Optimize the index
   */
  async optimize(options: IndexOptimizationOptions = {}): Promise<void> {
    if (!this.index) {
      throw new Error('Index not initialized');
    }

    // Rebuild index if requested
    if (options.rebuildIndex && this.indexType === IndexType.IVF) {
      const ivfIndex = this.index as IVFIndex;
      await ivfIndex.rebuild();
    }

    // Update statistics
    if (options.updateStatistics) {
      // Statistics are automatically updated
    }

    // Compaction can be added here
    if (options.compactIndex) {
      // Force garbage collection hints
      if (global.gc) {
        global.gc();
      }
    }
  }

  /**
   * Perform health check on the index
   */
  async healthCheck(): Promise<IndexHealthCheck> {
    const stats = this.getStats();
    const issues: string[] = [];
    const warnings: string[] = [];
    let status = IndexHealth.HEALTHY;

    // Check if index is empty
    if (stats.vectorCount === 0) {
      warnings.push('Index is empty');
    }

    // Check memory usage
    const memoryMB = stats.memoryUsage / (1024 * 1024);
    if (memoryMB > 1000) {
      issues.push(`High memory usage: ${memoryMB.toFixed(2)} MB`);
      status = IndexHealth.DEGRADED;
    }

    // Check query performance
    if (this.metrics.queryCount > 100) {
      const avgLatency = this.metrics.totalQueryTime / this.metrics.queryCount;
      if (avgLatency > 100) {
        issues.push(`High query latency: ${avgLatency.toFixed(2)} ms`);
        status = IndexHealth.DEGRADED;
      }
    }

    // Check if IVF index is trained
    if (this.indexType === IndexType.IVF) {
      const ivfIndex = this.index as IVFIndex;
      if (!ivfIndex.isTrained()) {
        issues.push('IVF index is not trained');
        status = IndexHealth.UNHEALTHY;
      }
    }

    const performanceMetrics: PerformanceMetrics = {
      avgQueryLatency:
        this.metrics.queryCount > 0
          ? this.metrics.totalQueryTime / this.metrics.queryCount
          : 0,
      p95QueryLatency: this.metrics.lastQueryTime * 1.5, // Approximation
      p99QueryLatency: this.metrics.lastQueryTime * 2.0, // Approximation
      queriesPerSecond: this.metrics.queriesPerSecond,
      indexSize: stats.indexSize,
      memoryUsage: stats.memoryUsage,
      cacheHitRate: 0, // No cache in base index
      recallRate: 0.95, // Approximation for HNSW/IVF
    };

    return {
      status,
      message: status === IndexHealth.HEALTHY ? 'Index is healthy' : 'Index has issues',
      metrics: performanceMetrics,
      issues,
      warnings,
    };
  }

  /**
   * Export index to snapshot
   */
  exportSnapshot(): any {
    if (!this.index) {
      throw new Error('Index not initialized');
    }

    const snapshot = this.index.exportSnapshot();

    return {
      ...snapshot,
      metrics: this.metrics,
    };
  }

  /**
   * Import index from snapshot
   */
  importSnapshot(snapshot: any): void {
    if (!this.index) {
      throw new Error('Index not initialized');
    }

    this.index.importSnapshot(snapshot);

    if (snapshot.metrics) {
      this.metrics = snapshot.metrics;
    }
  }

  /**
   * Get the configuration
   */
  getConfig(): IndexConfig {
    return { ...this.config };
  }

  /**
   * Get the index type
   */
  getIndexType(): IndexType {
    return this.indexType;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): {
    queryCount: number;
    totalQueryTime: number;
    queriesPerSecond: number;
    lastQueryTime: number;
  } {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      queryCount: 0,
      totalQueryTime: 0,
      queriesPerSecond: 0,
      lastQueryTime: 0,
    };
  }

  /**
   * Set search parameters (index-specific)
   */
  setSearchParams(params: Record<string, number>): void {
    if (!this.index) {
      throw new Error('Index not initialized');
    }

    if (this.indexType === IndexType.HNSW) {
      const hnswIndex = this.index as HNSWIndex;
      if (params.efSearch !== undefined) {
        hnswIndex.setSearchParams(params.efSearch);
      }
    } else if (this.indexType === IndexType.IVF) {
      const ivfIndex = this.index as IVFIndex;
      if (params.nprobe !== undefined) {
        ivfIndex.setNProbe(params.nprobe);
      }
    }
  }

  /**
   * Train the index (for IVF)
   */
  async train(vectors: Vector[]): Promise<void> {
    if (this.indexType === IndexType.IVF) {
      const ivfIndex = this.index as IVFIndex;
      await ivfIndex.train(vectors);
    } else {
      throw new Error('Training is only supported for IVF index');
    }
  }

  /**
   * Check if index is trained (for IVF)
   */
  isTrained(): boolean {
    if (this.indexType === IndexType.IVF) {
      const ivfIndex = this.index as IVFIndex;
      return ivfIndex.isTrained();
    }
    return true; // Other indexes don't need training
  }
}
