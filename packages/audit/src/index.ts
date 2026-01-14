/**
 * ClaudeFlare Audit Logging and Compliance Reporting
 *
 * Enterprise-grade audit logging system with:
 * - Immutable audit log storage (WORM)
 * - Real-time audit streaming
 * - SOC 2 Type II compliance reporting
 * - ISO 27001 compliance reporting
 * - Change tracking and history
 * - Advanced search and analytics
 *
 * @package @claudeflare/audit
 */

// Type definitions
export * from './types';

// Core components
export * from './collector';
export * from './storage';
export * from './reports';
export * from './search';
export * from './streams';
export * from './tracking';

// Utilities
export * from './utils/helpers';
export * from './utils/compliance';

/**
 * Main audit system class that integrates all components
 */
import { IAuditCollector, createAuditCollector } from './collector';
import { ImmutableAuditLogStorage, createAuditLogStorage } from './storage';
import { ComplianceReportGenerator, createComplianceReportGenerator } from './reports';
import { AuditLogSearchEngine, createAuditLogSearchEngine } from './search';
import { AuditEventStream, createAuditEventStream } from './streams';
import { ChangeTrackingSystem, createChangeTrackingSystem } from './change';

export interface AuditSystemConfig {
  // Collector configuration
  collector?: {
    batchSize?: number;
    batchTimeout?: number;
    retentionDays?: number;
  };

  // Storage configuration
  storage?: {
    bucketName?: string;
    enableObjectLock?: boolean;
    compressionEnabled?: boolean;
    partitionStrategy?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  };

  // Stream configuration
  stream?: {
    maxConnections?: number;
    heartbeatInterval?: number;
    enableAlerting?: boolean;
  };

  // Change tracking configuration
  changeTracking?: {
    enableRollback?: boolean;
    maxHistoryPerEntity?: number;
  };
}

/**
 * Complete audit system
 */
export class AuditSystem {
  private collector: IAuditCollector;
  private storage: ImmutableAuditLogStorage;
  private reportGenerator: ComplianceReportGenerator;
  private searchEngine: AuditLogSearchEngine;
  private eventStream: AuditEventStream;
  private changeTracking: ChangeTrackingSystem;

  constructor(
    bucket: R2Bucket,
    db: D1Database,
    config: AuditSystemConfig = {}
  ) {
    // Initialize storage
    this.storage = createAuditLogStorage(bucket, config.storage, db);

    // Initialize collector with storage
    this.collector = createAuditCollector(config.collector, {
      async store(event) {
        await this.storage.store(event);
      },
      async storeBatch(events) {
        await this.storage.storeBatch(events);
      },
      async query(params) {
        return await this.storage.query(params);
      },
      async getById(id) {
        return await this.storage.getById(id);
      }
    });

    // Initialize report generator
    this.reportGenerator = createComplianceReportGenerator();

    // Initialize search engine
    this.searchEngine = createAuditLogSearchEngine();

    // Initialize event stream
    this.eventStream = createAuditEventStream(config.stream);

    // Initialize change tracking
    this.changeTracking = createChangeTrackingSystem(config.changeTracking);

    // Hook up stream to collector
    this.collector.on('event', async (event) => {
      await this.eventStream.publish(event);
      this.searchEngine.indexEvent(event);
    });
  }

  /**
   * Get the audit collector
   */
  getCollector(): IAuditCollector {
    return this.collector;
  }

  /**
   * Get the storage layer
   */
  getStorage(): ImmutableAuditLogStorage {
    return this.storage;
  }

  /**
   * Get the report generator
   */
  getReportGenerator(): ComplianceReportGenerator {
    return this.reportGenerator;
  }

  /**
   * Get the search engine
   */
  getSearchEngine(): AuditLogSearchEngine {
    return this.searchEngine;
  }

  /**
   * Get the event stream
   */
  getEventStream(): AuditEventStream {
    return this.eventStream;
  }

  /**
   * Get the change tracking system
   */
  getChangeTracking(): ChangeTrackingSystem {
    return this.changeTracking;
  }

  /**
   * Collect an audit event
   */
  async collect(event: Partial<any>, context?: any): Promise<string> {
    return await this.collector.collect(event, context);
  }

  /**
   * Query audit logs
   */
  async query(params: any): Promise<any> {
    return await this.storage.query(params);
  }

  /**
   * Generate a compliance report
   */
  async generateReport(config: any): Promise<any> {
    const events = await this.storage.query({
      startTime: config.periodStart.toISOString(),
      endTime: config.periodEnd.toISOString(),
      limit: 100000
    });

    return await this.reportGenerator.generateReport(config, events.events);
  }

  /**
   * Search audit logs
   */
  async search(query: any): Promise<any> {
    return this.searchEngine.advancedSearch(query);
  }

  /**
   * Subscribe to real-time audit events
   */
  async subscribe(clientId: string, filter?: any, websocket?: WebSocket): Promise<string> {
    return await this.eventStream.subscribe(clientId, filter, websocket);
  }

  /**
   * Track a change
   */
  async trackChange(change: any): Promise<string> {
    return await this.changeTracking.trackChange(change);
  }

  /**
   * Get system statistics
   */
  async getStats(): Promise<{
    collector: any;
    storage: any;
    stream: any;
    search: any;
    changeTracking: any;
  }> {
    return {
      collector: this.collector.getStats(),
      storage: await this.storage.getStats(),
      stream: this.eventStream.getStats(),
      search: this.searchEngine.getStats(),
      changeTracking: this.changeTracking.getStats()
    };
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    await this.collector.destroy?.();
    await this.eventStream.destroy();
  }
}

/**
 * Factory function to create a complete audit system
 */
export function createAuditSystem(
  bucket: R2Bucket,
  db: D1Database,
  config?: AuditSystemConfig
): AuditSystem {
  return new AuditSystem(bucket, db, config);
}

/**
 * Default export
 */
export default {
  createAuditSystem,
  createAuditCollector,
  createAuditLogStorage,
  createComplianceReportGenerator,
  createAuditLogSearchEngine,
  createAuditEventStream,
  createChangeTrackingSystem
};
