/**
 * Storage Layer - Handles log persistence using D1 and R2
 */

import EventEmitter from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  LogEntry,
  LogBatch,
  StorageConfig,
  StorageType,
  RetentionPolicy,
  ArchiveEntry,
  CompressionType,
} from '../types';
import { createLogger } from '../utils/logger';
import { generateBatchId, now, calculateBatchSize } from '../utils/helpers';

export interface StorageEvents {
  'log:stored': { entryId: string; location: string };
  'batch:stored': { batchId: string; count: number; location: string };
  'archive:created': ArchiveEntry;
  'archive:deleted': { archiveId: string };
  'storage:error': { operation: string; error: Error };
}

/**
 * D1 Database Schema
 */
export const D1_SCHEMA = `
-- Log entries table
CREATE TABLE IF NOT EXISTS log_entries (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  level INTEGER NOT NULL,
  message TEXT NOT NULL,
  service TEXT NOT NULL,
  environment TEXT,
  host TEXT,
  trace_id TEXT,
  span_id TEXT,
  parent_span_id TEXT,
  user_id TEXT,
  session_id TEXT,
  request_id TEXT,
  metadata TEXT,
  tags TEXT,
  error_name TEXT,
  error_message TEXT,
  error_code TEXT,
  error_stack TEXT,
  created_at INTEGER NOT NULL,
  INDEX idx_timestamp (timestamp),
  INDEX idx_level (level),
  INDEX idx_service (service),
  INDEX idx_environment (environment),
  INDEX idx_trace_id (trace_id),
  INDEX idx_user_id (user_id),
  INDEX idx_session_id (session_id)
);

-- Batch metadata table
CREATE TABLE IF NOT EXISTS log_batches (
  batch_id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  entry_count INTEGER NOT NULL,
  size_bytes INTEGER NOT NULL,
  source TEXT NOT NULL,
  compression TEXT,
  created_at INTEGER NOT NULL,
  INDEX idx_timestamp (timestamp),
  INDEX idx_source (source)
);

-- Archive entries table
CREATE TABLE IF NOT EXISTS archive_entries (
  archive_id TEXT PRIMARY KEY,
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  log_count INTEGER NOT NULL,
  size_bytes INTEGER NOT NULL,
  location TEXT NOT NULL,
  compression BOOLEAN NOT NULL,
  checksum TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  archived_at INTEGER NOT NULL,
  INDEX idx_period_start (period_start),
  INDEX idx_period_end (period_end)
);

-- Metrics table
CREATE TABLE IF NOT EXISTS log_metrics (
  metric_id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  metric_type TEXT NOT NULL,
  metric_value REAL NOT NULL,
  dimensions TEXT,
  created_at INTEGER NOT NULL,
  INDEX idx_timestamp (timestamp),
  INDEX idx_metric_type (metric_type)
);
`;

/**
 * Storage Manager class
 */
export class StorageManager extends EventEmitter<StorageEvents> {
  private logger = createLogger({ component: 'StorageManager' });
  private config: StorageConfig;
  private db: any; // D1 database instance
  private r2: any; // R2 bucket instance
  private retentionPolicy: RetentionPolicy;
  private archiveTimer: NodeJS.Timeout | null = null;

  constructor(config: StorageConfig, db?: any, r2?: any) {
    super();

    this.config = config;
    this.db = db;
    this.r2 = r2;
    this.retentionPolicy = config.retention;

    this.initializeStorage();
    this.startArchiveTimer();

    this.logger.info('Storage manager initialized', {
      type: config.type,
      retention: config.retention,
    });
  }

  /**
   * Initialize storage
   */
  private async initializeStorage(): Promise<void> {
    if (this.config.type === StorageType.D1 || this.config.type === StorageType.HYBRID) {
      await this.initializeD1();
    }

    if (this.config.type === StorageType.R2 || this.config.type === StorageType.HYBRID) {
      await this.initializeR2();
    }
  }

  /**
   * Initialize D1 database
   */
  private async initializeD1(): Promise<void> {
    if (!this.db) {
      this.logger.warn('D1 database not provided, using mock storage');
      return;
    }

    try {
      // Execute schema
      const statements = D1_SCHEMA
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        await this.db.exec(statement);
      }

      this.logger.info('D1 database initialized');
    } catch (error) {
      this.logger.error('Failed to initialize D1 database', error);
      throw error;
    }
  }

  /**
   * Initialize R2 bucket
   */
  private async initializeR2(): Promise<void> {
    if (!this.r2) {
      this.logger.warn('R2 bucket not provided, using mock storage');
      return;
    }

    this.logger.info('R2 bucket initialized');
  }

  /**
   * Store a single log entry
   */
  public async storeEntry(entry: LogEntry): Promise<void> {
    try {
      if (this.config.type === StorageType.D1 || this.config.type === StorageType.HYBRID) {
        await this.storeEntryInD1(entry);
      }

      this.emit('log:stored', {
        entryId: entry.id,
        location: this.config.type,
      });
    } catch (error) {
      this.logger.error('Failed to store log entry', error);
      this.emit('storage:error', { operation: 'storeEntry', error: error as Error });
      throw error;
    }
  }

  /**
   * Store entry in D1
   */
  private async storeEntryInD1(entry: LogEntry): Promise<void> {
    if (!this.db) {
      this.logger.debug('D1 not available, skipping storage');
      return;
    }

    const stmt = `
      INSERT INTO log_entries (
        id, timestamp, level, message, service, environment, host,
        trace_id, span_id, parent_span_id, user_id, session_id, request_id,
        metadata, tags, error_name, error_message, error_code, error_stack,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      entry.id,
      entry.timestamp,
      entry.level,
      entry.message,
      entry.service,
      entry.environment ?? null,
      entry.host ?? null,
      entry.traceId ?? null,
      entry.spanId ?? null,
      entry.parentSpanId ?? null,
      entry.context?.userId ?? null,
      entry.context?.sessionId ?? null,
      entry.context?.requestId ?? null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
      entry.tags ? JSON.stringify(entry.tags) : null,
      entry.error?.name ?? null,
      entry.error?.message ?? null,
      entry.error?.code ?? null,
      entry.error?.stack ?? null,
      now(),
    ];

    await this.db.prepare(stmt).bind(...params).run();
  }

  /**
   * Store a batch of log entries
   */
  public async storeBatch(batch: LogBatch): Promise<void> {
    try {
      if (this.config.type === StorageType.D1 || this.config.type === StorageType.HYBRID) {
        await this.storeBatchInD1(batch);
      }

      if (this.config.type === StorageType.R2 || this.config.type === StorageType.HYBRID) {
        await this.storeBatchInR2(batch);
      }

      this.emit('batch:stored', {
        batchId: batch.metadata.batchId,
        count: batch.metadata.count,
        location: this.config.type,
      });
    } catch (error) {
      this.logger.error('Failed to store batch', error);
      this.emit('storage:error', { operation: 'storeBatch', error: error as Error });
      throw error;
    }
  }

  /**
   * Store batch in D1
   */
  private async storeBatchInD1(batch: LogBatch): Promise<void> {
    if (!this.db) {
      this.logger.debug('D1 not available, skipping batch storage');
      return;
    }

    // Store batch metadata
    const batchStmt = `
      INSERT INTO log_batches (
        batch_id, timestamp, entry_count, size_bytes, source, compression, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db
      .prepare(batchStmt)
      .bind(
        batch.metadata.batchId,
        batch.metadata.timestamp,
        batch.metadata.count,
        batch.metadata.sizeBytes,
        batch.metadata.source,
        batch.metadata.compression ?? CompressionType.NONE,
        now()
      )
      .run();

    // Store entries in transaction
    for (const entry of batch.entries) {
      await this.storeEntryInD1(entry);
    }
  }

  /**
   * Store batch in R2
   */
  private async storeBatchInR2(batch: LogBatch): Promise<void> {
    if (!this.r2) {
      this.logger.debug('R2 not available, skipping batch storage');
      return;
    }

    const key = `logs/${batch.metadata.batchId}.json`;
    const data = JSON.stringify(batch);

    await this.r2.put(key, data);

    this.logger.debug('Batch stored in R2', {
      batchId: batch.metadata.batchId,
      key,
      size: data.length,
    });
  }

  /**
   * Query log entries from storage
   */
  public async queryEntries(
    filters: {
      startTime?: number;
      endTime?: number;
      level?: number;
      service?: string;
      environment?: string;
      traceId?: string;
      userId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<LogEntry[]> {
    if (!this.db) {
      this.logger.warn('D1 not available, returning empty results');
      return [];
    }

    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.startTime) {
      conditions.push('timestamp >= ?');
      params.push(filters.startTime);
    }

    if (filters.endTime) {
      conditions.push('timestamp <= ?');
      params.push(filters.endTime);
    }

    if (filters.level !== undefined) {
      conditions.push('level = ?');
      params.push(filters.level);
    }

    if (filters.service) {
      conditions.push('service = ?');
      params.push(filters.service);
    }

    if (filters.environment) {
      conditions.push('environment = ?');
      params.push(filters.environment);
    }

    if (filters.traceId) {
      conditions.push('trace_id = ?');
      params.push(filters.traceId);
    }

    if (filters.userId) {
      conditions.push('user_id = ?');
      params.push(filters.userId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = filters.limit ? `LIMIT ${filters.limit}` : '';
    const offsetClause = filters.offset ? `OFFSET ${filters.offset}` : '';

    const query = `
      SELECT * FROM log_entries
      ${whereClause}
      ORDER BY timestamp DESC
      ${limitClause}
      ${offsetClause}
    `;

    const result = await this.db.prepare(query).bind(...params).all();

    return result.results.map((row: any) => this.rowToLogEntry(row));
  }

  /**
   * Convert database row to LogEntry
   */
  private rowToLogEntry(row: any): LogEntry {
    return {
      id: row.id,
      timestamp: row.timestamp,
      level: row.level,
      message: row.message,
      service: row.service,
      environment: row.environment ?? undefined,
      host: row.host ?? undefined,
      traceId: row.trace_id ?? undefined,
      spanId: row.span_id ?? undefined,
      parentSpanId: row.parent_span_id ?? undefined,
      context: {
        userId: row.user_id ?? undefined,
        sessionId: row.session_id ?? undefined,
        requestId: row.request_id ?? undefined,
      },
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      error:
        row.error_name || row.error_message
          ? {
              name: row.error_name,
              message: row.error_message,
              code: row.error_code ?? undefined,
              stack: row.error_stack ?? undefined,
            }
          : undefined,
    };
  }

  /**
   * Archive old log entries to R2
   */
  public async archiveEntries(periodStart: number, periodEnd: number): Promise<ArchiveEntry | null> {
    if (!this.r2 || !this.db) {
      this.logger.warn('R2 or D1 not available, skipping archive');
      return null;
    }

    try {
      // Query entries for the period
      const entries = await this.queryEntries({
        startTime: periodStart,
        endTime: periodEnd,
      });

      if (entries.length === 0) {
        this.logger.debug('No entries to archive', { periodStart, periodEnd });
        return null;
      }

      // Create batch
      const batch: LogBatch = {
        entries,
        metadata: {
          batchId: generateBatchId(),
          timestamp: now(),
          count: entries.length,
          sizeBytes: calculateBatchSize(entries),
          source: 'archive',
          compression: CompressionType.GZIP,
        },
      };

      // Store in R2
      const key = `archive/${periodStart}-${periodEnd}.json.gz`;
      const data = JSON.stringify(batch);

      await this.r2.put(key, data, {
        httpMetadata: {
          contentType: 'application/json',
          contentEncoding: 'gzip',
        },
      });

      // Create archive entry
      const archiveEntry: ArchiveEntry = {
        id: uuidv4(),
        periodStart,
        periodEnd,
        logCount: entries.length,
        sizeBytes: data.length,
        location: key,
        compressed: true,
        checksum: Buffer.from(data).toString('base64'),
      };

      // Store archive metadata
      await this.storeArchiveMetadata(archiveEntry);

      // Delete from D1
      await this.deleteEntries(periodStart, periodEnd);

      this.emit('archive:created', archiveEntry);

      this.logger.info('Archive created', {
        archiveId: archiveEntry.id,
        logCount: entries.length,
        sizeBytes: data.length,
      });

      return archiveEntry;
    } catch (error) {
      this.logger.error('Failed to archive entries', error);
      this.emit('storage:error', { operation: 'archiveEntries', error: error as Error });
      throw error;
    }
  }

  /**
   * Store archive metadata in D1
   */
  private async storeArchiveMetadata(archive: ArchiveEntry): Promise<void> {
    if (!this.db) return;

    const stmt = `
      INSERT INTO archive_entries (
        archive_id, period_start, period_end, log_count, size_bytes,
        location, compression, checksum, created_at, archived_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.db
      .prepare(stmt)
      .bind(
        archive.id,
        archive.periodStart,
        archive.periodEnd,
        archive.logCount,
        archive.sizeBytes,
        archive.location,
        archive.compressed ? 1 : 0,
        archive.checksum,
        now(),
        now()
      )
      .run();
  }

  /**
   * Delete entries from D1
   */
  private async deleteEntries(startTime: number, endTime: number): Promise<void> {
    if (!this.db) return;

    const stmt = `DELETE FROM log_entries WHERE timestamp >= ? AND timestamp <= ?`;
    await this.db.prepare(stmt).bind(startTime, endTime).run();

    this.logger.debug('Entries deleted from D1', { startTime, endTime });
  }

  /**
   * Get archive entries
   */
  public async getArchives(periodStart?: number, periodEnd?: number): Promise<ArchiveEntry[]> {
    if (!this.db) {
      return [];
    }

    let query = 'SELECT * FROM archive_entries';
    const params: any[] = [];

    if (periodStart && periodEnd) {
      query += ' WHERE period_start >= ? AND period_end <= ?';
      params.push(periodStart, periodEnd);
    }

    query += ' ORDER BY period_start DESC';

    const result = await this.db.prepare(query).bind(...params).all();

    return result.results.map((row: any) => ({
      id: row.archive_id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      logCount: row.log_count,
      sizeBytes: row.size_bytes,
      location: row.location,
      compressed: row.compression === 1,
      checksum: row.checksum,
    }));
  }

  /**
   * Load archive from R2
   */
  public async loadArchive(archiveId: string): Promise<LogBatch | null> {
    if (!this.r2 || !this.db) {
      return null;
    }

    // Get archive metadata
    const archiveResult = await this.db
      .prepare('SELECT * FROM archive_entries WHERE archive_id = ?')
      .bind(archiveId)
      .first();

    if (!archiveResult) {
      return null;
    }

    // Load from R2
    const object = await this.r2.get(archiveResult.location);

    if (!object) {
      return null;
    }

    const data = await object.text();
    const batch = JSON.parse(data) as LogBatch;

    this.logger.info('Archive loaded', {
      archiveId,
      entryCount: batch.entries.length,
    });

    return batch;
  }

  /**
   * Start archive timer
   */
  private startArchiveTimer(): void {
    // Run archive check every hour
    this.archiveTimer = setInterval(async () => {
      await this.runArchiveCheck();
    }, 3600000);
  }

  /**
   * Run archive check based on retention policy
   */
  private async runArchiveCheck(): Promise<void> {
    const currentTime = now();
    const archiveThreshold = currentTime - this.retention.archiveAfter;

    try {
      // Find periods to archive
      const archivePeriods = await this.findArchivePeriods(archiveThreshold);

      for (const period of archivePeriods) {
        await this.archiveEntries(period.start, period.end);
      }

      // Delete expired archives
      await this.deleteExpiredArchives(currentTime - this.retention.deleteAfter);
    } catch (error) {
      this.logger.error('Archive check failed', error);
    }
  }

  /**
   * Find periods that need to be archived
   */
  private async findArchivePeriods(beforeTime: number): Promise<Array<{ start: number; end: number }>> {
    if (!this.db) return [];

    // Find earliest and latest timestamps that need archiving
    const result = await this.db
      .prepare(`
        SELECT
          MIN(timestamp) as min_ts,
          MAX(timestamp) as max_ts
        FROM log_entries
        WHERE timestamp < ?
      `)
      .bind(beforeTime)
      .first();

    if (!result || !result.min_ts) {
      return [];
    }

    // Split into day-sized chunks
    const periods: Array<{ start: number; end: number }> = [];
    const dayMs = 86400000;
    let current = result.min_ts;

    while (current < result.max_ts) {
      periods.push({
        start: current,
        end: Math.min(current + dayMs, result.max_ts),
      });
      current += dayMs;
    }

    return periods;
  }

  /**
   * Delete expired archives
   */
  private async deleteExpiredArchives(beforeTime: number): Promise<void> {
    if (!this.db || !this.r2) return;

    // Find expired archives
    const result = await this.db
      .prepare('SELECT archive_id, location FROM archive_entries WHERE period_end < ?')
      .bind(beforeTime)
      .all();

    for (const row of result.results) {
      // Delete from R2
      await this.r2.delete(row.location);

      // Delete metadata
      await this.db.prepare('DELETE FROM archive_entries WHERE archive_id = ?').bind(row.archive_id).run();

      this.emit('archive:deleted', { archiveId: row.archive_id });

      this.logger.debug('Archive deleted', { archiveId: row.archive_id });
    }
  }

  /**
   * Get storage statistics
   */
  public async getStats(): Promise<{
    totalEntries: number;
    totalBatches: number;
    totalArchives: number;
    storageBytes: number;
  }> {
    if (!this.db) {
      return {
        totalEntries: 0,
        totalBatches: 0,
        totalArchives: 0,
        storageBytes: 0,
      };
    }

    const entriesResult = await this.db
      .prepare('SELECT COUNT(*) as count FROM log_entries')
      .first();
    const batchesResult = await this.db
      .prepare('SELECT COUNT(*) as count FROM log_batches')
      .first();
    const archivesResult = await this.db
      .prepare('SELECT COUNT(*) as count, SUM(size_bytes) as size FROM archive_entries')
      .first();

    return {
      totalEntries: entriesResult?.count ?? 0,
      totalBatches: batchesResult?.count ?? 0,
      totalArchives: archivesResult?.count ?? 0,
      storageBytes: archivesResult?.size ?? 0,
    };
  }

  /**
   * Shutdown storage manager
   */
  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down storage manager');

    if (this.archiveTimer) {
      clearInterval(this.archiveTimer);
      this.archiveTimer = null;
    }

    this.logger.info('Storage manager shutdown complete');
  }
}

/**
 * Create a storage manager instance
 */
export function createStorageManager(config: StorageConfig, db?: any, r2?: any): StorageManager {
  return new StorageManager(config, db, r2);
}
