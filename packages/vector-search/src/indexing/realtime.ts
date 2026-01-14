/**
 * Real-time Indexing - Incremental updates and bulk indexing
 *
 * Provides real-time vector indexing with incremental updates,
 * bulk operations, index optimization, and replication support.
 */

import {
  Vector,
  VectorId,
  VectorRecord,
  IndexType,
  DistanceMetric,
  BatchResult,
  BulkIndexOptions,
  BulkIndexProgress,
  IndexSnapshot,
  IndexStats,
  IndexOperation,
} from '../types/index.js';
import { VectorIndex } from '../index/vector-index.js';

/**
 * Index operation queue item
 */
interface QueueItem {
  id: VectorId;
  operation: IndexOperation;
  record: VectorRecord;
  priority: number;
  timestamp: number;
}

/**
 * Index replication state
 */
interface ReplicationState {
  enabled: boolean;
  targetCount: number;
  replicas: Map<string, VectorIndex>;
  lastSync: number;
}

/**
 * Real-time Indexer class
 */
export class RealtimeIndexer {
  private vectorIndex: VectorIndex;
  private operationQueue: QueueItem[];
  private processingQueue: boolean;
  private queueSize: number;
  private batchSize: number;
  private flushInterval: number;
  private flushTimer: NodeJS.Timeout | null;
  private replicationState: ReplicationState;
  private snapshotEnabled: boolean;
  private snapshotInterval: number;
  private snapshotTimer: NodeJS.Timeout | null;

  constructor(
    vectorIndex: VectorIndex,
    options: {
      queueSize?: number;
      batchSize?: number;
      flushInterval?: number;
      snapshotEnabled?: boolean;
      snapshotInterval?: number;
    } = {}
  ) {
    this.vectorIndex = vectorIndex;
    this.operationQueue = [];
    this.processingQueue = false;
    this.queueSize = options.queueSize || 10000;
    this.batchSize = options.batchSize || 100;
    this.flushInterval = options.flushInterval || 1000;
    this.flushTimer = null;
    this.snapshotEnabled = options.snapshotEnabled || false;
    this.snapshotInterval = options.snapshotInterval || 300000; // 5 minutes
    this.snapshotTimer = null;
    this.replicationState = {
      enabled: false,
      targetCount: 0,
      replicas: new Map(),
      lastSync: 0,
    };

    this.startFlushTimer();
    if (this.snapshotEnabled) {
      this.startSnapshotTimer();
    }
  }

  /**
   * Insert a single vector
   */
  async insert(record: VectorRecord): Promise<void> {
    await this.enqueueOperation({
      id: record.id,
      operation: IndexOperation.INSERT,
      record,
      priority: 0,
      timestamp: Date.now(),
    });
  }

  /**
   * Insert multiple vectors
   */
  async insertBatch(
    records: VectorRecord[],
    options?: BulkIndexOptions
  ): Promise<BatchResult> {
    const result: BatchResult = {
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    const batchSize = options?.batchSize || this.batchSize;
    const concurrency = options?.concurrency || 1;

    for (let i = 0; i < records.length; i += batchSize * concurrency) {
      const batch = records.slice(i, i + batchSize * concurrency);

      // Process batches in parallel
      const promises = [];
      for (let j = 0; j < concurrency && j * batchSize < batch.length; j++) {
        const subBatch = batch.slice(j * batchSize, (j + 1) * batchSize);
        promises.push(this.processBatch(subBatch));
      }

      const results = await Promise.all(promises);

      for (const batchResult of results) {
        result.succeeded += batchResult.succeeded;
        result.failed += batchResult.failed;
        result.errors.push(...batchResult.errors);
      }

      // Report progress
      if (options?.progressCallback) {
        options.progressCallback({
          total: records.length,
          processed: i + batch.length,
          succeeded: result.succeeded,
          failed: result.failed,
          percentage: ((i + batch.length) / records.length) * 100,
        });
      }
    }

    return result;
  }

  /**
   * Process a batch of operations
   */
  private async processBatch(records: VectorRecord[]): Promise<BatchResult> {
    return await this.vectorIndex.insertBatch(records);
  }

  /**
   * Delete a vector
   */
  async delete(id: VectorId): Promise<boolean> {
    const result = await this.vectorIndex.delete(id);
    return result.success;
  }

  /**
   * Delete multiple vectors
   */
  async deleteBatch(ids: VectorId[]): Promise<BatchResult> {
    return await this.vectorIndex.deleteBatch(ids);
  }

  /**
   * Update a vector
   */
  async update(record: VectorRecord): Promise<boolean> {
    const result = await this.vectorIndex.update(record);
    return result.success;
  }

  /**
   * Update multiple vectors
   */
  async updateBatch(records: VectorRecord[]): Promise<BatchResult> {
    return await this.vectorIndex.updateBatch(records);
  }

  /**
   * Upsert a vector (insert or update)
   */
  async upsert(record: VectorRecord): Promise<void> {
    await this.vectorIndex.upsert(record);
  }

  /**
   * Enqueue an operation
   */
  private async enqueueOperation(item: QueueItem): Promise<void> {
    // Check queue size
    if (this.operationQueue.length >= this.queueSize) {
      // Force flush
      await this.flushQueue();
    }

    this.operationQueue.push(item);

    // Sort by priority
    this.operationQueue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Flush the operation queue
   */
  async flushQueue(): Promise<void> {
    if (this.processingQueue || this.operationQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    try {
      while (this.operationQueue.length > 0) {
        const batch = this.operationQueue.splice(0, this.batchSize);

        for (const item of batch) {
          try {
            switch (item.operation) {
              case IndexOperation.INSERT:
                await this.vectorIndex.insert(item.record);
                break;

              case IndexOperation.UPDATE:
                await this.vectorIndex.update(item.record);
                break;

              case IndexOperation.DELETE:
                await this.vectorIndex.delete(item.id);
                break;

              case IndexOperation.UPSERT:
                await this.vectorIndex.upsert(item.record);
                break;
            }
          } catch (error) {
            console.error(`Error processing operation for ${item.id}:`, error);
          }
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushQueue().catch((error) => {
        console.error('Error flushing queue:', error);
      });
    }, this.flushInterval);
  }

  /**
   * Stop automatic flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Start snapshot timer
   */
  private startSnapshotTimer(): void {
    this.snapshotTimer = setInterval(() => {
      this.createSnapshot().catch((error) => {
        console.error('Error creating snapshot:', error);
      });
    }, this.snapshotInterval);
  }

  /**
   * Stop snapshot timer
   */
  private stopSnapshotTimer(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
  }

  /**
   * Create a snapshot of the index
   */
  async createSnapshot(): Promise<IndexSnapshot> {
    const snapshot = this.vectorIndex.exportSnapshot();

    return {
      version: snapshot.version,
      timestamp: Date.now(),
      config: snapshot.config,
      vectors: [], // Vectors are stored in the index
      stats: this.vectorIndex.getStats(),
    };
  }

  /**
   * Restore from a snapshot
   */
  async restoreSnapshot(snapshot: IndexSnapshot): Promise<void> {
    this.vectorIndex.importSnapshot(snapshot);
  }

  /**
   * Enable replication
   */
  enableReplication(replicaCount: number): void {
    this.replicationState.enabled = true;
    this.replicationState.targetCount = replicaCount;

    // Create replicas
    const config = this.vectorIndex.getConfig();

    for (let i = 0; i < replicaCount; i++) {
      // Create replica indexes
      // In production, these would be on different machines
      const replica = new VectorIndex(config);
      this.replicationState.replicas.set(`replica-${i}`, replica);
    }
  }

  /**
   * Disable replication
   */
  disableReplication(): void {
    this.replicationState.enabled = false;
    this.replicationState.replicas.clear();
  }

  /**
   * Sync replicas
   */
  async syncReplicas(): Promise<void> {
    if (!this.replicationState.enabled) {
      return;
    }

    const snapshot = this.vectorIndex.exportSnapshot();

    for (const [name, replica] of this.replicationState.replicas.entries()) {
      try {
        replica.importSnapshot(snapshot);
      } catch (error) {
        console.error(`Error syncing replica ${name}:`, error);
      }
    }

    this.replicationState.lastSync = Date.now();
  }

  /**
   * Get replication status
   */
  getReplicationStatus(): {
    enabled: boolean;
    targetCount: number;
    actualCount: number;
    lastSync: number;
  } {
    return {
      enabled: this.replicationState.enabled,
      targetCount: this.replicationState.targetCount,
      actualCount: this.replicationState.replicas.size,
      lastSync: this.replicationState.lastSync,
    };
  }

  /**
   * Optimize the index
   */
  async optimize(): Promise<void> {
    // Flush queue first
    await this.flushQueue();

    // Optimize vector index
    await this.vectorIndex.optimize({
      compactIndex: true,
      updateStatistics: true,
    });

    // Sync replicas if enabled
    if (this.replicationState.enabled) {
      await this.syncReplicas();
    }
  }

  /**
   * Compact the index
   */
  async compact(): Promise<void> {
    await this.optimize();
  }

  /**
   * Get index statistics
   */
  getStats(): IndexStats {
    return this.vectorIndex.getStats();
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    size: number;
    processing: boolean;
    flushInterval: number;
  } {
    return {
      size: this.operationQueue.length,
      processing: this.processingQueue,
      flushInterval: this.flushInterval,
    };
  }

  /**
   * Set flush interval
   */
  setFlushInterval(interval: number): void {
    this.flushInterval = interval;
    this.stopFlushTimer();
    this.startFlushTimer();
  }

  /**
   * Set batch size
   */
  setBatchSize(size: number): void {
    this.batchSize = size;
  }

  /**
   * Enable snapshots
   */
  enableSnapshots(interval: number): void {
    this.snapshotEnabled = true;
    this.snapshotInterval = interval;
    this.stopSnapshotTimer();
    this.startSnapshotTimer();
  }

  /**
   * Disable snapshots
   */
  disableSnapshots(): void {
    this.snapshotEnabled = false;
    this.stopSnapshotTimer();
  }

  /**
   * Force immediate flush
   */
  async forceFlush(): Promise<void> {
    await this.flushQueue();
  }

  /**
   * Clear the index
   */
  async clear(): Promise<void> {
    await this.flushQueue();
    await this.vectorIndex.clear();
  }

  /**
   * Shutdown the indexer
   */
  async shutdown(): Promise<void> {
    this.stopFlushTimer();
    this.stopSnapshotTimer();

    // Final flush
    await this.flushQueue();

    // Final sync
    if (this.replicationState.enabled) {
      await this.syncReplicas();
    }
  }

  /**
   * Get health status
   */
  async getHealth(): Promise<{
    healthy: boolean;
    queueSize: number;
    replicationStatus: ReturnType<typeof this.getReplicationStatus>;
    lastFlush: number;
  }> {
    const health = await this.vectorIndex.healthCheck();

    return {
      healthy: health.status === 'healthy',
      queueSize: this.operationQueue.length,
      replicationStatus: this.getReplicationStatus(),
      lastFlush: Date.now(),
    };
  }
}

/**
 * Bulk indexer for large-scale indexing operations
 */
export class BulkIndexer {
  private vectorIndex: VectorIndex;

  constructor(vectorIndex: VectorIndex) {
    this.vectorIndex = vectorIndex;
  }

  /**
   * Perform bulk indexing with progress tracking
   */
  async bulkIndex(
    records: VectorRecord[],
    options: BulkIndexOptions = {}
  ): Promise<BatchResult> {
    const startTime = Date.now();
    const result: BatchResult = {
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    const batchSize = options.batchSize || 1000;
    const concurrency = options.concurrency || 4;

    // Split into batches
    const batches: VectorRecord[][] = [];
    for (let i = 0; i < records.length; i += batchSize) {
      batches.push(records.slice(i, i + batchSize));
    }

    // Process batches with concurrency
    let processed = 0;

    for (let i = 0; i < batches.length; i += concurrency) {
      const batchGroup = batches.slice(i, i + concurrency);
      const promises = batchGroup.map((batch) => this.processBatch(batch, options));

      const results = await Promise.all(promises);

      for (const batchResult of results) {
        result.succeeded += batchResult.succeeded;
        result.failed += batchResult.failed;
        result.errors.push(...batchResult.errors);
      }

      processed += batchGroup.length * batchSize;

      // Report progress
      if (options.progressCallback) {
        const elapsed = Date.now() - startTime;
        const rate = processed / (elapsed / 1000); // vectors per second
        const remaining = records.length - processed;
        const eta = remaining / rate;

        options.progressCallback({
          total: records.length,
          processed: Math.min(processed, records.length),
          succeeded: result.succeeded,
          failed: result.failed,
          percentage: (processed / records.length) * 100,
          eta,
        });
      }
    }

    return result;
  }

  /**
   * Process a single batch
   */
  private async processBatch(
    records: VectorRecord[],
    options: BulkIndexOptions
  ): Promise<BatchResult> {
    if (options.skipExisting) {
      // Filter out existing records
      const newRecords: VectorRecord[] = [];

      for (const record of records) {
        const exists = await this.vectorIndex.has(record.id);
        if (!exists) {
          newRecords.push(record);
        }
      }

      return await this.vectorIndex.insertBatch(newRecords);
    } else {
      return await this.vectorIndex.insertBatch(records);
    }
  }

  /**
   * Perform bulk update
   */
  async bulkUpdate(
    records: VectorRecord[],
    options: BulkIndexOptions = {}
  ): Promise<BatchResult> {
    return await this.vectorIndex.updateBatch(records);
  }

  /**
   * Perform bulk delete
   */
  async bulkDelete(
    ids: VectorId[],
    options: BulkIndexOptions = {}
  ): Promise<BatchResult> {
    const batchSize = options.batchSize || 1000;
    const result: BatchResult = {
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const batchResult = await this.vectorIndex.deleteBatch(batch);

      result.succeeded += batchResult.succeeded;
      result.failed += batchResult.failed;
      result.errors.push(...batchResult.errors);

      if (options.progressCallback) {
        options.progressCallback({
          total: ids.length,
          processed: i + batch.length,
          succeeded: result.succeeded,
          failed: result.failed,
          percentage: ((i + batch.length) / ids.length) * 100,
        });
      }
    }

    return result;
  }

  /**
   * Perform bulk upsert
   */
  async bulkUpsert(
    records: VectorRecord[],
    options: BulkIndexOptions = {}
  ): Promise<BatchResult> {
    const batchSize = options.batchSize || 1000;
    const result: BatchResult = {
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      for (const record of batch) {
        try {
          await this.vectorIndex.upsert(record);
          result.succeeded++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            id: record.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (options.progressCallback) {
        options.progressCallback({
          total: records.length,
          processed: i + batch.length,
          succeeded: result.succeeded,
          failed: result.failed,
          percentage: ((i + batch.length) / records.length) * 100,
        });
      }
    }

    return result;
  }
}
