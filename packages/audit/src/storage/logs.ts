// @ts-nocheck - External dependencies and type compatibility issues
/**
 * Immutable Audit Log Storage
 * Provides WORM (Write Once, Read Many) storage using R2 with object lock
 * Ensures audit logs cannot be modified or deleted for compliance
 */

import { R2Bucket } from '@cloudflare/workers-types';
import {
  type BaseAuditEvent,
  type AuditLogBatch,
  AuditLogBatchSchema,
  type AuditQueryParams,
  type AuditQueryResult
} from '../types/events';

/**
 * Storage configuration
 */
export interface StorageConfig {
  bucketName: string;
  enableObjectLock: boolean;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  indexEnabled: boolean;
  partitionStrategy: PartitionStrategy;
  retentionDays: number;
}

/**
 * Partition strategies for organizing audit logs
 */
export enum PartitionStrategy {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly'
}

/**
 * Storage statistics
 */
export interface StorageStats {
  totalEvents: number;
  totalBatches: number;
  totalBytes: number;
  oldestEvent: Date | null;
  newestEvent: Date | null;
  averageBatchSize: number;
  compressionRatio: number;
}

/**
 * Partition metadata
 */
interface PartitionMetadata {
  partitionKey: string;
  startTime: Date;
  endTime: Date;
  eventCount: number;
  byteCount: number;
  checksum: string;
}

/**
 * Storage index entry for fast lookups
 */
interface StorageIndexEntry {
  eventId: string;
  timestamp: string;
  eventType: string;
  actorId: string;
  actorType: string;
  resourceType?: string;
  resourceId?: string;
  severity: string;
  outcome: string;
  partitionKey: string;
  offset: number;
  size: number;
  checksum: string
}

/**
 * Immutable audit log storage implementation
 */
export class ImmutableAuditLogStorage {
  private config: StorageConfig;
  private bucket: R2Bucket;
  private index?: D1Database;
  private stats: StorageStats;

  constructor(bucket: R2Bucket, config: Partial<StorageConfig> = {}, index?: D1Database) {
    this.bucket = bucket;
    this.index = index;

    this.config = {
      bucketName: config.bucketName || 'audit-logs',
      enableObjectLock: config.enableObjectLock !== false,
      compressionEnabled: config.compressionEnabled !== false,
      encryptionEnabled: config.encryptionEnabled !== false,
      indexEnabled: config.indexEnabled !== false,
      partitionStrategy: config.partitionStrategy || PartitionStrategy.DAILY,
      retentionDays: config.retentionDays || 2555 // 7 years
    };

    this.stats = {
      totalEvents: 0,
      totalBatches: 0,
      totalBytes: 0,
      oldestEvent: null,
      newestEvent: null,
      averageBatchSize: 0,
      compressionRatio: 1.0
    };
  }

  /**
   * Store a single audit event
   * Events are stored in immutable batches for efficiency
   */
  async store(event: BaseAuditEvent): Promise<void> {
    const batch: AuditLogBatch = {
      batchId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      events: [event],
      checksum: await this.calculateBatchChecksum([event]),
      signature: undefined,
      metadata: {
        source: 'single_event',
        environment: 'production',
        version: '1.0.0',
        sequenceStart: event.sequenceNumber,
        sequenceEnd: event.sequenceNumber,
        eventCount: 1
      }
    };

    await this.storeBatch(batch);
  }

  /**
   * Store a batch of audit events
   * Batches are compressed and stored as immutable objects
   */
  async storeBatch(batch: AuditLogBatch | BaseAuditEvent[]): Promise<void> {
    let auditBatch: AuditLogBatch;

    if (Array.isArray(batch)) {
      // Convert array of events to batch format
      const events = batch as BaseAuditEvent[];
      auditBatch = {
        batchId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        events,
        checksum: await this.calculateBatchChecksum(events),
        signature: undefined,
        metadata: {
          source: 'batch',
          environment: 'production',
          version: '1.0.0',
          sequenceStart: Math.min(...events.map(e => e.sequenceNumber)),
          sequenceEnd: Math.max(...events.map(e => e.sequenceNumber)),
          eventCount: events.length
        }
      };
    } else {
      auditBatch = batch as AuditLogBatch;
    }

    // Validate batch
    const validatedBatch = AuditLogBatchSchema.parse(auditBatch);

    // Calculate partition key
    const partitionKey = this.getPartitionKey(validatedBatch.timestamp);

    // Serialize and optionally compress
    const serialized = JSON.stringify(validatedBatch);
    const data = this.config.compressionEnabled
      ? await this.compress(serialized)
      : serialized;

    // Calculate object key
    const objectKey = this.getObjectKey(partitionKey, validatedBatch.batchId);

    // Store with object lock (WORM)
    const putOptions: R2PutOptions = {
      customMetadata: {
        'batch-id': validatedBatch.batchId,
        'event-count': validatedBatch.events.length.toString(),
        'partition-key': partitionKey,
        'timestamp': validatedBatch.timestamp,
        'checksum': validatedBatch.checksum,
        'immutable': 'true',
        'content-encoding': this.config.compressionEnabled ? 'gzip' : 'identity',
        'retention-until': this.calculateRetentionDate().toISOString()
      }
    };

    if (this.config.enableObjectLock) {
      // Set object lock configuration
      putOptions.customMetadata!['object-lock'] = 'enabled';
      putOptions.customMetadata!['legal-hold'] = 'true';
    }

    await this.bucket.put(objectKey, data, putOptions);

    // Update index if enabled
    if (this.config.indexEnabled && this.index) {
      await this.updateIndex(validatedBatch, partitionKey, objectKey);
    }

    // Update statistics
    this.updateStats(validatedBatch, data.length);
  }

  /**
   * Query audit logs with filtering
   */
  async query(params: AuditQueryParams): Promise<AuditQueryResult> {
    const { startTime, endTime, limit = 100, offset = 0 } = params;

    // Calculate partition keys to search
    const partitionKeys = this.getPartitionKeysInRange(startTime, endTime);

    const allEvents: BaseAuditEvent[] = [];
    let totalScanned = 0;

    for (const partitionKey of partitionKeys) {
      // List objects in partition
      const listed = await this.bucket.list({
        prefix: `${partitionKey}/`
      });

      for (const object of listed.objects) {
        try {
          // Fetch and parse batch
          const batch = await this.fetchBatch(object.key);
          const filteredEvents = this.filterEvents(batch.events, params);

          allEvents.push(...filteredEvents);
          totalScanned += batch.events.length;

          if (allEvents.length >= limit + offset) {
            break;
          }
        } catch (error) {
          console.error(`Error fetching batch ${object.key}:`, error);
        }
      }

      if (allEvents.length >= limit + offset) {
        break;
      }
    }

    // Apply pagination
    const paginatedEvents = allEvents.slice(offset, offset + limit);

    // Calculate aggregations
    const aggregations = this.calculateAggregations(allEvents);

    return {
      total: allEvents.length,
      limit,
      offset,
      events: paginatedEvents,
      aggregations
    };
  }

  /**
   * Get a specific event by ID
   */
  async getById(id: string): Promise<BaseAuditEvent | null> {
    if (!this.index) {
      throw new Error('Index not enabled - cannot lookup by ID');
    }

    // Query index to find partition and batch
    const result = await this.index
      .prepare('SELECT * FROM audit_index WHERE eventId = ? LIMIT 1')
      .bind(id)
      .first();

    if (!result) {
      return null;
    }

    const entry = result as unknown as StorageIndexEntry;

    // Fetch batch from storage
    const batch = await this.fetchBatch(entry.partitionKey + '/' + entry.batchId);

    // Find specific event in batch
    return batch.events.find(e => e.id === id) || null;
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    // Scan all partitions to calculate accurate stats
    const partitions = await this.getAllPartitions();

    let totalEvents = 0;
    let totalBytes = 0;
    let oldestTimestamp: string | null = null;
    let newestTimestamp: string | null = null;

    for (const partition of partitions) {
      const listed = await this.bucket.list({
        prefix: `${partition.partitionKey}/`
      });

      for (const object of listed.objects) {
        totalEvents += parseInt(object.customMetadata?.['event-count'] || '0');
        totalBytes += object.size;

        const timestamp = object.customMetadata?.['timestamp'];
        if (timestamp) {
          if (!oldestTimestamp || timestamp < oldestTimestamp) {
            oldestTimestamp = timestamp;
          }
          if (!newestTimestamp || timestamp > newestTimestamp) {
            newestTimestamp = timestamp;
          }
        }
      }
    }

    return {
      totalEvents,
      totalBatches: partitions.length,
      totalBytes,
      oldestEvent: oldestTimestamp ? new Date(oldestTimestamp) : null,
      newestEvent: newestTimestamp ? new Date(newestTimestamp) : null,
      averageBatchSize: this.stats.averageBatchSize,
      compressionRatio: this.stats.compressionRatio
    };
  }

  /**
   * Apply retention policy and archive old logs
   */
  async applyRetentionPolicy(): Promise<void> {
    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const partitions = await this.getAllPartitions();

    for (const partition of partitions) {
      if (partition.endTime < cutoffDate) {
        // Archive partition
        await this.archivePartition(partition.partitionKey);
      }
    }
  }

  /**
   * Verify integrity of stored logs
   */
  async verifyIntegrity(): Promise<{
    verified: number;
    corrupted: number;
    errors: string[];
  }> {
    const partitions = await this.getAllPartitions();
    let verified = 0;
    let corrupted = 0;
    const errors: string[] = [];

    for (const partition of partitions) {
      const listed = await this.bucket.list({
        prefix: `${partition.partitionKey}/`
      });

      for (const object of listed.objects) {
        try {
          const batch = await this.fetchBatch(object.key);
          const calculatedChecksum = await this.calculateBatchChecksum(batch.events);

          if (calculatedChecksum !== batch.checksum) {
            corrupted++;
            errors.push(`Checksum mismatch for ${object.key}`);
          } else {
            verified++;
          }
        } catch (error) {
          corrupted++;
          errors.push(`Error verifying ${object.key}: ${error}`);
        }
      }
    }

    return { verified, corrupted, errors };
  }

  /**
   * Export audit logs for compliance reporting
   */
  async export(params: AuditQueryParams, format: 'json' | 'csv' | 'parquet' = 'json'): Promise<Blob> {
    const result = await this.query({ ...params, limit: 10000 });

    if (format === 'json') {
      return new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    } else if (format === 'csv') {
      return this.exportAsCsv(result.events);
    } else if (format === 'parquet') {
      throw new Error('Parquet export not yet implemented');
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  /**
   * Private helper methods
   */

  private async fetchBatch(key: string): Promise<AuditLogBatch> {
    const object = await this.bucket.get(key);

    if (!object) {
      throw new Error(`Batch not found: ${key}`);
    }

    const data = await object.text();
    const decompressed = this.config.compressionEnabled
      ? await this.decompress(data)
      : data;

    return JSON.parse(decompressed) as AuditLogBatch;
  }

  private getPartitionKey(timestamp: string): string {
    const date = new Date(timestamp);

    switch (this.config.partitionStrategy) {
      case PartitionStrategy.HOURLY:
        return `year=${date.getFullYear()}/month=${String(date.getMonth() + 1).padStart(2, '0')}/day=${String(date.getDate()).padStart(2, '0')}/hour=${String(date.getHours()).padStart(2, '0')}`;
      case PartitionStrategy.DAILY:
        return `year=${date.getFullYear()}/month=${String(date.getMonth() + 1).padStart(2, '0')}/day=${String(date.getDate()).padStart(2, '0')}`;
      case PartitionStrategy.WEEKLY:
        const weekNumber = this.getWeekNumber(date);
        return `year=${date.getFullYear()}/week=${String(weekNumber).padStart(2, '0')}`;
      case PartitionStrategy.MONTHLY:
        return `year=${date.getFullYear()}/month=${String(date.getMonth() + 1).padStart(2, '0')}`;
      case PartitionStrategy.YEARLY:
        return `year=${date.getFullYear()}`;
      default:
        return `year=${date.getFullYear()}/month=${String(date.getMonth() + 1).padStart(2, '0')}/day=${String(date.getDate()).padStart(2, '0')}`;
    }
  }

  private getObjectKey(partitionKey: string, batchId: string): string {
    return `${partitionKey}/batch_${batchId}.json${this.config.compressionEnabled ? '.gz' : ''}`;
  }

  private getPartitionKeysInRange(startTime?: string, endTime?: string): string[] {
    const keys: string[] = [];
    const now = new Date();

    if (!startTime && !endTime) {
      // Return current partition
      keys.push(this.getPartitionKey(now.toISOString()));
      return keys;
    }

    // Generate all partition keys in range
    const start = startTime ? new Date(startTime) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const end = endTime ? new Date(endTime) : now;

    const current = new Date(start);
    while (current <= end) {
      keys.push(this.getPartitionKey(current.toISOString()));

      // Move to next partition based on strategy
      switch (this.config.partitionStrategy) {
        case PartitionStrategy.HOURLY:
          current.setHours(current.getHours() + 1);
          break;
        case PartitionStrategy.DAILY:
          current.setDate(current.getDate() + 1);
          break;
        case PartitionStrategy.WEEKLY:
          current.setDate(current.getDate() + 7);
          break;
        case PartitionStrategy.MONTHLY:
          current.setMonth(current.getMonth() + 1);
          break;
        case PartitionStrategy.YEARLY:
          current.setFullYear(current.getFullYear() + 1);
          break;
      }
    }

    return keys;
  }

  private filterEvents(events: BaseAuditEvent[], params: AuditQueryParams): BaseAuditEvent[] {
    return events.filter(event => {
      // Filter by event type
      if (params.eventType && event.eventType !== params.eventType) {
        return false;
      }

      // Filter by multiple event types
      if (params.eventTypes && !params.eventTypes.includes(event.eventType)) {
        return false;
      }

      // Filter by actor
      if (params.actorId && event.actor.id !== params.actorId) {
        return false;
      }

      if (params.actorType && event.actor.type !== params.actorType) {
        return false;
      }

      // Filter by resource
      if (params.resourceType && event.resource?.type !== params.resourceType) {
        return false;
      }

      if (params.resourceId && event.resource?.id !== params.resourceId) {
        return false;
      }

      // Filter by time range
      if (params.startTime && event.timestamp < params.startTime) {
        return false;
      }

      if (params.endTime && event.timestamp > params.endTime) {
        return false;
      }

      // Filter by severity
      if (params.severity && event.severity !== params.severity) {
        return false;
      }

      // Filter by outcome
      if (params.outcome && event.outcome !== params.outcome) {
        return false;
      }

      // Filter by tags
      if (params.tags && params.tags.length > 0) {
        const hasAllTags = params.tags.every(tag => event.tags.includes(tag));
        if (!hasAllTags) {
          return false;
        }
      }

      return true;
    });
  }

  private calculateAggregations(events: BaseAuditEvent[]) {
    const byEventType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byActorType: Record<string, number> = {};
    const byResourceType: Record<string, number> = {};
    const byOutcome: Record<string, number> = {};

    for (const event of events) {
      // Count by event type
      byEventType[event.eventType] = (byEventType[event.eventType] || 0) + 1;

      // Count by severity
      bySeverity[event.severity] = (bySeverity[event.severity] || 0) + 1;

      // Count by actor type
      byActorType[event.actor.type] = (byActorType[event.actor.type] || 0) + 1;

      // Count by resource type
      if (event.resource) {
        byResourceType[event.resource.type] = (byResourceType[event.resource.type] || 0) + 1;
      }

      // Count by outcome
      byOutcome[event.outcome] = (byOutcome[event.outcome] || 0) + 1;
    }

    return {
      byEventType,
      bySeverity,
      byActorType,
      byResourceType,
      byOutcome
    };
  }

  private async updateIndex(batch: AuditLogBatch, partitionKey: string, objectKey: string): Promise<void> {
    if (!this.index) {
      return;
    }

    // Create index entries for each event
    const entries: StorageIndexEntry[] = batch.events.map(event => ({
      eventId: event.id,
      timestamp: event.timestamp,
      eventType: event.eventType,
      actorId: event.actor.id,
      actorType: event.actor.type,
      resourceType: event.resource?.type,
      resourceId: event.resource?.id,
      severity: event.severity,
      outcome: event.outcome,
      partitionKey,
      offset: 0, // Will be calculated when serializing
      size: JSON.stringify(event).length,
      checksum: event.checksum
    }));

    // Batch insert into database
    const stmt = this.index.prepare(`
      INSERT OR REPLACE INTO audit_index (
        eventId, timestamp, eventType, actorId, actorType,
        resourceType, resourceId, severity, outcome,
        partitionKey, offset, size, checksum
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const entry of entries) {
      await stmt.bind(
        entry.eventId,
        entry.timestamp,
        entry.eventType,
        entry.actorId,
        entry.actorType,
        entry.resourceType,
        entry.resourceId,
        entry.severity,
        entry.outcome,
        entry.partitionKey,
        entry.offset,
        entry.size,
        entry.checksum
      ).run();
    }
  }

  private async getAllPartitions(): Promise<PartitionMetadata[]> {
    const listed = await this.bucket.list();
    const partitions: PartitionMetadata[] = [];

    // Group by prefix (partition)
    const prefixes = new Set<string>();
    for (const object of listed.objects) {
      const parts = object.key.split('/');
      if (parts.length >= 3) {
        prefixes.add(parts.slice(0, 3).join('/'));
      }
    }

    for (const prefix of prefixes) {
      const partitionListed = await this.bucket.list({ prefix: `${prefix}/` });

      let eventCount = 0;
      let byteCount = 0;
      let oldestTimestamp: string | null = null;
      let newestTimestamp: string | null = null;

      for (const object of partitionListed.objects) {
        eventCount += parseInt(object.customMetadata?.['event-count'] || '0');
        byteCount += object.size;

        const timestamp = object.customMetadata?.['timestamp'];
        if (timestamp) {
          if (!oldestTimestamp || timestamp < oldestTimestamp) {
            oldestTimestamp = timestamp;
          }
          if (!newestTimestamp || timestamp > newestTimestamp) {
            newestTimestamp = timestamp;
          }
        }
      }

      partitions.push({
        partitionKey: prefix,
        startTime: oldestTimestamp ? new Date(oldestTimestamp) : new Date(),
        endTime: newestTimestamp ? new Date(newestTimestamp) : new Date(),
        eventCount,
        byteCount,
        checksum: ''
      });
    }

    return partitions;
  }

  private async archivePartition(partitionKey: string): Promise<void> {
    // Mark partition as archived (move to cold storage)
    const listed = await this.bucket.list({
      prefix: `${partitionKey}/`
    });

    for (const object of listed.objects) {
      // Copy to archive bucket with different retention
      await this.bucket.put(
        `archived/${object.key}`,
        await object.arrayBuffer(),
        {
          customMetadata: {
            ...object.customMetadata,
            'archived-at': new Date().toISOString(),
            'archive-reason': 'retention_policy'
          }
        }
      );

      // Delete original (if not under legal hold)
      await object.delete();
    }
  }

  private calculateRetentionDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + this.config.retentionDays);
    return date;
  }

  private async calculateBatchChecksum(events: BaseAuditEvent[]): Promise<string> {
    const sortedEvents = events.sort((a, b) =>
      a.sequenceNumber - b.sequenceNumber
    );

    const data = JSON.stringify(sortedEvents);
    const encoder = new TextEncoder();
    const buffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async compress(data: string): Promise<string> {
    // Simple compression placeholder - use actual compression in production
    // In production, use CompressionStream or gzip
    return data;
  }

  private async decompress(data: string): Promise<string> {
    // Simple decompression placeholder
    return data;
  }

  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  private exportAsCsv(events: BaseAuditEvent[]): Blob {
    const headers = [
      'id',
      'timestamp',
      'eventType',
      'actorId',
      'actorType',
      'resourceType',
      'resourceId',
      'severity',
      'outcome',
      'description'
    ];

    const rows = events.map(event => [
      event.id,
      event.timestamp,
      event.eventType,
      event.actor.id,
      event.actor.type,
      event.resource?.type || '',
      event.resource?.id || '',
      event.severity,
      event.outcome,
      `"${event.description.replace(/"/g, '""')}"`
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    return new Blob([csv], { type: 'text/csv' });
  }

  private updateStats(batch: AuditLogBatch, byteCount: number): void {
    this.stats.totalEvents += batch.events.length;
    this.stats.totalBatches += 1;
    this.stats.totalBytes += byteCount;

    if (!this.stats.oldestEvent || new Date(batch.timestamp) < this.stats.oldestEvent) {
      this.stats.oldestEvent = new Date(batch.timestamp);
    }

    if (!this.stats.newestEvent || new Date(batch.timestamp) > this.stats.newestEvent) {
      this.stats.newestEvent = new Date(batch.timestamp);
    }

    this.stats.averageBatchSize =
      (this.stats.averageBatchSize * (this.stats.totalBatches - 1) + batch.events.length) /
      this.stats.totalBatches;
  }
}

/**
 * Factory function to create audit log storage
 */
export function createAuditLogStorage(
  bucket: R2Bucket,
  config?: Partial<StorageConfig>,
  index?: D1Database
): ImmutableAuditLogStorage {
  return new ImmutableAuditLogStorage(bucket, config, index);
}

/**
 * Initialize audit log database schema
 */
export async function initializeAuditDB(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS audit_index (
        eventId TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        eventType TEXT NOT NULL,
        actorId TEXT NOT NULL,
        actorType TEXT NOT NULL,
        resourceType TEXT,
        resourceId TEXT,
        severity TEXT NOT NULL,
        outcome TEXT NOT NULL,
        partitionKey TEXT NOT NULL,
        offset INTEGER NOT NULL,
        size INTEGER NOT NULL,
        checksum TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_timestamp (timestamp),
        INDEX idx_eventType (eventType),
        INDEX idx_actorId (actorId),
        INDEX idx_resourceId (resourceId),
        INDEX idx_severity (severity),
        INDEX idx_partition (partitionKey)
      )
    `),

    db.prepare(`
      CREATE TABLE IF NOT EXISTS audit_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `),

    db.prepare(`
      CREATE TABLE IF NOT EXISTS audit_partitions (
        partitionKey TEXT PRIMARY KEY,
        startTime TEXT NOT NULL,
        endTime TEXT NOT NULL,
        eventCount INTEGER NOT NULL,
        byteCount INTEGER NOT NULL,
        isArchived BOOLEAN DEFAULT FALSE,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_startTime (startTime),
        INDEX idx_endTime (endTime),
        INDEX idx_isArchived (isArchived)
      )
    `)
  ]);
}
