/**
 * Audit Log Collector
 * Collects, validates, and normalizes audit events from various sources
 */

import {
  AuditEventType,
  ActorType,
  ResourceType,
  EventSeverity,
  EventOutcome,
  ComplianceFramework,
  SOC2TrustService,
  ISO27001Domain,
  type BaseAuditEvent,
  type AuditQueryParams,
  type AuditQueryResult
} from '../types/events';

/**
 * Compliance mappings for event types
 */
const COMPLIANCE_MAPPINGS: Record<AuditEventType, {
  frameworks: ComplianceFramework[];
  soc2TrustServices: SOC2TrustService[];
  iso27001Domains: ISO27001Domain[];
  defaultSeverity: EventSeverity;
}> = {
  // Authentication events
  [AuditEventType.AUTH_LOGIN]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001, ComplianceFramework.NIST],
    soc2TrustServices: [SOC2TrustService.SECURITY],
    iso27001Domains: [ISO27001Domain.ACCESS_CONTROL],
    defaultSeverity: EventSeverity.INFO
  },
  [AuditEventType.AUTH_LOGOUT]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001],
    soc2TrustServices: [SOC2TrustService.SECURITY],
    iso27001Domains: [ISO27001Domain.ACCESS_CONTROL],
    defaultSeverity: EventSeverity.INFO
  },
  [AuditEventType.AUTH_FAILED_LOGIN]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001],
    soc2TrustServices: [SOC2TrustService.SECURITY],
    iso27001Domains: [ISO27001Domain.ACCESS_CONTROL],
    defaultSeverity: EventSeverity.MEDIUM
  },
  [AuditEventType.AUTH_PASSWORD_CHANGE]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001, ComplianceFramework.NIST],
    soc2TrustServices: [SOC2TrustService.SECURITY],
    iso27001Domains: [ISO27001Domain.ACCESS_CONTROL],
    defaultSeverity: EventSeverity.INFO
  },
  [AuditEventType.AUTH_MFA_ENABLED]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001],
    soc2TrustServices: [SOC2TrustService.SECURITY],
    iso27001Domains: [ISO27001Domain.ACCESS_CONTROL],
    defaultSeverity: EventSeverity.LOW
  },
  [AuditEventType.AUTH_MFA_DISABLED]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001],
    soc2TrustServices: [SOC2TrustService.SECURITY],
    iso27001Domains: [ISO27001Domain.ACCESS_CONTROL],
    defaultSeverity: EventSeverity.HIGH
  },

  // Authorization events
  [AuditEventType.AUTHZ_PERMISSION_GRANTED]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001],
    soc2TrustServices: [SOC2TrustService.SECURITY],
    iso27001Domains: [ISO27001Domain.ACCESS_CONTROL],
    defaultSeverity: EventSeverity.LOW
  },
  [AuditEventType.AUTHZ_PERMISSION_REVOKED]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001],
    soc2TrustServices: [SOC2TrustService.SECURITY],
    iso27001Domains: [ISO27001Domain.ACCESS_CONTROL],
    defaultSeverity: EventSeverity.LOW
  },
  [AuditEventType.AUTHZ_ROLE_MODIFIED]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001],
    soc2TrustServices: [SOC2TrustService.SECURITY],
    iso27001Domains: [ISO27001Domain.ACCESS_CONTROL],
    defaultSeverity: EventSeverity.MEDIUM
  },
  [AuditEventType.AUTHZ_ACCESS_DENIED]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001],
    soc2TrustServices: [SOC2TrustService.SECURITY, SOC2TrustService.CONFIDENTIALITY],
    iso27001Domains: [ISO27001Domain.ACCESS_CONTROL],
    defaultSeverity: EventSeverity.MEDIUM
  },
  [AuditEventType.AUTHZ_PRIVILEGE_ESCALATION]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001],
    soc2TrustServices: [SOC2TrustService.SECURITY],
    iso27001Domains: [ISO27001Domain.ACCESS_CONTROL],
    defaultSeverity: EventSeverity.HIGH
  },

  // Data events
  [AuditEventType.DATA_ACCESS]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001, ComplianceFramework.GDPR, ComplianceFramework.HIPAA],
    soc2TrustServices: [SOC2TrustService.CONFIDENTIALITY, SOC2TrustService.PRIVACY],
    iso27001Domains: [ISO27001Domain.ACCESS_CONTROL, ISO27001Domain.ASSET_MANAGEMENT],
    defaultSeverity: EventSeverity.INFO
  },
  [AuditEventType.DATA_CREATED]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001, ComplianceFramework.GDPR],
    soc2TrustServices: [SOC2TrustService.PROCESSING_INTEGRITY, SOC2TrustService.CONFIDENTIALITY],
    iso27001Domains: [ISO27001Domain.ASSET_MANAGEMENT],
    defaultSeverity: EventSeverity.INFO
  },
  [AuditEventType.DATA_MODIFIED]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001, ComplianceFramework.GDPR],
    soc2TrustServices: [SOC2TrustService.PROCESSING_INTEGRITY],
    iso27001Domains: [ISO27001Domain.ASSET_MANAGEMENT, ISO27001Domain.OPERATIONS_SECURITY],
    defaultSeverity: EventSeverity.LOW
  },
  [AuditEventType.DATA_DELETED]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001, ComplianceFramework.GDPR],
    soc2TrustServices: [SOC2TrustService.PROCESSING_INTEGRITY],
    iso27001Domains: [ISO27001Domain.ASSET_MANAGEMENT, ISO27001Domain.OPERATIONS_SECURITY],
    defaultSeverity: EventSeverity.MEDIUM
  },
  [AuditEventType.DATA_EXPORTED]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001, ComplianceFramework.GDPR, ComplianceFramework.HIPAA],
    soc2TrustServices: [SOC2TrustService.CONFIDENTIALITY, SOC2TrustService.PRIVACY],
    iso27001Domains: [ISO27001Domain.ASSET_MANAGEMENT],
    defaultSeverity: EventSeverity.MEDIUM
  },
  [AuditEventType.DATA_BULK_DELETE]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001, ComplianceFramework.GDPR],
    soc2TrustServices: [SOC2TrustService.PROCESSING_INTEGRITY],
    iso27001Domains: [ISO27001Domain.OPERATIONS_SECURITY],
    defaultSeverity: EventSeverity.HIGH
  },

  // System events
  [AuditEventType.SYSTEM_CONFIG_CHANGE]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001],
    soc2TrustServices: [SOC2TrustService.SECURITY, SOC2TrustService.PROCESSING_INTEGRITY],
    iso27001Domains: [ISO27001Domain.OPERATIONS_SECURITY],
    defaultSeverity: EventSeverity.MEDIUM
  },
  [AuditEventType.SYSTEM_DEPLOYMENT]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001],
    soc2TrustServices: [SOC2TrustService.AVAILABILITY, SOC2TrustService.PROCESSING_INTEGRITY],
    iso27001Domains: [ISO27001Domain.OPERATIONS_SECURITY],
    defaultSeverity: EventSeverity.LOW
  },
  [AuditEventType.SYSTEM_ERROR]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001],
    soc2TrustServices: [SOC2TrustService.AVAILABILITY],
    iso27001Domains: [ISO27001Domain.OPERATIONS_SECURITY],
    defaultSeverity: EventSeverity.HIGH
  },
  [AuditEventType.SYSTEM_PERFORMANCE_DEGRADED]: {
    frameworks: [ComplianceFramework.SOC2],
    soc2TrustServices: [SOC2TrustService.AVAILABILITY],
    iso27001Domains: [ISO27001Domain.OPERATIONS_SECURITY],
    defaultSeverity: EventSeverity.MEDIUM
  },

  // Security events
  [AuditEventType.SECURITY_VULNERABILITY_DETECTED]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001, ComplianceFramework.PCI_DSS],
    soc2TrustServices: [SOC2TrustService.SECURITY],
    iso27001Domains: [ISO27001Domain.OPERATIONS_SECURITY],
    defaultSeverity: EventSeverity.HIGH
  },
  [AuditEventType.SECURITY_INTRUSION_DETECTED]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001],
    soc2TrustServices: [SOC2TrustService.SECURITY],
    iso27001Domains: [ISO27001Domain.OPERATIONS_SECURITY],
    defaultSeverity: EventSeverity.CRITICAL
  },
  [AuditEventType.SECURITY_BRUTE_FORCE_ATTEMPT]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001],
    soc2TrustServices: [SOC2TrustService.SECURITY],
    iso27001Domains: [ISO27001Domain.ACCESS_CONTROL],
    defaultSeverity: EventSeverity.HIGH
  },
  [AuditEventType.SECURITY_DATA_BREACH]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001, ComplianceFramework.GDPR, ComplianceFramework.HIPAA],
    soc2TrustServices: [SOC2TrustService.SECURITY, SOC2TrustService.CONFIDENTIALITY, SOC2TrustService.PRIVACY],
    iso27001Domains: [ISO27001Domain.INFORMATION_SECURITY_INCIDENT_MANAGEMENT],
    defaultSeverity: EventSeverity.CRITICAL
  },

  // Audit events
  [AuditEventType.AUDIT_LOG_ACCESSED]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001, ComplianceFramework.GDPR],
    soc2TrustServices: [SOC2TrustService.SECURITY],
    iso27001Domains: [ISO27001Domain.ACCESS_CONTROL],
    defaultSeverity: EventSeverity.MEDIUM
  },
  [AuditEventType.AUDIT_LOG_EXPORTED]: {
    frameworks: [ComplianceFramework.SOC2, ComplianceFramework.ISO27001],
    soc2TrustServices: [SOC2TrustService.SECURITY],
    iso27001Domains: [ISO27001Domain.ACCESS_CONTROL],
    defaultSeverity: EventSeverity.HIGH
  }
};

/**
 * Audit event collector configuration
 */
export interface CollectorConfig {
  batchSize: number;
  batchTimeout: number; // milliseconds
  enableValidation: boolean;
  enableEnrichment: boolean;
  enableDeduplication: boolean;
  retentionDays: number;
  allowedEnvironments: string[];
}

/**
 * Default collector configuration
 */
export const DEFAULT_COLLECTOR_CONFIG: CollectorConfig = {
  batchSize: 100,
  batchTimeout: 5000, // 5 seconds
  enableValidation: true,
  enableEnrichment: true,
  enableDeduplication: true,
  retentionDays: 2555, // 7 years for SOC 2
  allowedEnvironments: ['production', 'staging', 'development']
};

/**
 * Audit event context
 */
export interface AuditEventContext {
  requestId?: string;
  correlationId?: string;
  parentEventId?: string;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
}

/**
 * Audit collector interface
 */
export interface IAuditCollector {
  collect(event: Partial<BaseAuditEvent>, context?: AuditEventContext): Promise<string>;
  collectBatch(events: Partial<BaseAuditEvent>[], context?: AuditEventContext): Promise<string[]>;
  flush(): Promise<void>;
  getStats(): CollectorStats;
}

/**
 * Collector statistics
 */
export interface CollectorStats {
  totalCollected: number;
  totalBatched: number;
  totalFlushed: number;
  totalErrors: number;
  lastFlushTime: Date | null;
  averageBatchSize: number;
  currentBatchSize: number;
}

/**
 * In-memory event batch
 */
interface EventBatch {
  events: BaseAuditEvent[];
  createdAt: Date;
}

/**
 * Audit Log Collector Implementation
 */
export class AuditCollector implements IAuditCollector {
  private config: CollectorConfig;
  private batch: EventBatch;
  private flushTimer: NodeJS.Timeout | null = null;
  private stats: CollectorStats;
  private sequenceNumber: number = 0;
  private seenEvents: Set<string> = new Set();
  private storage?: AuditStorage;

  constructor(config: Partial<CollectorConfig> = {}, storage?: AuditStorage) {
    this.config = { ...DEFAULT_COLLECTOR_CONFIG, ...config };
    this.batch = { events: [], createdAt: new Date() };
    this.storage = storage;

    this.stats = {
      totalCollected: 0,
      totalBatched: 0,
      totalFlushed: 0,
      totalErrors: 0,
      lastFlushTime: null,
      averageBatchSize: 0,
      currentBatchSize: 0
    };

    // Start flush timer
    this.startFlushTimer();
  }

  /**
   * Collect a single audit event
   */
  async collect(event: Partial<BaseAuditEvent>, context?: AuditEventContext): Promise<string> {
    try {
      const enrichedEvent = await this.enrichEvent(event, context);

      if (this.config.enableDeduplication) {
        const eventHash = this.hashEvent(enrichedEvent);
        if (this.seenEvents.has(eventHash)) {
          return enrichedEvent.id;
        }
        this.seenEvents.add(eventHash);
      }

      this.batch.events.push(enrichedEvent);
      this.stats.totalCollected++;
      this.stats.currentBatchSize = this.batch.events.length;

      if (this.batch.events.length >= this.config.batchSize) {
        await this.flush();
      }

      return enrichedEvent.id;
    } catch (error) {
      this.stats.totalErrors++;
      throw error;
    }
  }

  /**
   * Collect multiple audit events
   */
  async collectBatch(events: Partial<BaseAuditEvent>[], context?: AuditEventContext): Promise<string[]> {
    const eventIds: string[] = [];

    for (const event of events) {
      const id = await this.collect(event, context);
      eventIds.push(id);
    }

    return eventIds;
  }

  /**
   * Flush the current batch to storage
   */
  async flush(): Promise<void> {
    if (this.batch.events.length === 0) {
      return;
    }

    try {
      const eventsToFlush = [...this.batch.events];

      if (this.storage) {
        await this.storage.storeBatch(eventsToFlush);
      }

      this.stats.totalBatched += eventsToFlush.length;
      this.stats.totalFlushed++;
      this.stats.lastFlushTime = new Date();
      this.stats.averageBatchSize =
        (this.stats.averageBatchSize * (this.stats.totalFlushed - 1) + eventsToFlush.length) /
        this.stats.totalFlushed;

      // Clear batch
      this.batch.events = [];
      this.batch.createdAt = new Date();
      this.stats.currentBatchSize = 0;

      // Clear deduplication cache periodically
      if (this.seenEvents.size > 10000) {
        this.seenEvents.clear();
      }
    } catch (error) {
      this.stats.totalErrors++;
      throw error;
    }
  }

  /**
   * Get collector statistics
   */
  getStats(): CollectorStats {
    return { ...this.stats };
  }

  /**
   * Start the automatic flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(async () => {
      await this.flush();
    }, this.config.batchTimeout);
  }

  /**
   * Stop the automatic flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Enrich an event with compliance mappings and defaults
   */
  private async enrichEvent(
    event: Partial<BaseAuditEvent>,
    context?: AuditEventContext
  ): Promise<BaseAuditEvent> {
    const eventType = event.eventType || AuditEventType.SYSTEM_CONFIG_CHANGE;
    const mapping = COMPLIANCE_MAPPINGS[eventType] || {
      frameworks: [],
      soc2TrustServices: [],
      iso27001Domains: [],
      defaultSeverity: EventSeverity.INFO
    };

    const now = new Date();
    const retentionDate = new Date(now);
    retentionDate.setDate(retentionDate.getDate() + this.config.retentionDays);

    const enriched: BaseAuditEvent = {
      id: event.id || crypto.randomUUID(),
      eventType,
      timestamp: event.timestamp || now.toISOString(),
      sequenceNumber: this.sequenceNumber++,

      actor: event.actor || {
        id: 'system',
        type: ActorType.SYSTEM,
        name: 'System'
      },

      resource: event.resource,
      outcome: event.outcome || EventOutcome.SUCCESS,
      severity: event.severity || mapping.defaultSeverity,

      complianceFrameworks: event.complianceFrameworks || mapping.frameworks,
      soc2TrustServices: event.soc2TrustServices || mapping.soc2TrustServices,
      iso27001Domains: event.iso27001Domains || mapping.iso27001Domains,

      description: event.description || `Event: ${eventType}`,
      details: event.details,
      metadata: event.metadata,
      tags: event.tags || [],

      location: context?.location || event.location,
      correlationId: context?.correlationId || event.correlationId,
      parentEventId: context?.parentEventId || event.parentEventId,
      requestId: context?.requestId || event.requestId,

      checksum: '', // Will be calculated
      signature: event.signature,

      retentionUntil: event.retentionUntil || retentionDate.toISOString(),
      isArchived: false,
      isImmutable: true
    };

    // Add context metadata
    if (context) {
      enriched.metadata = {
        ...enriched.metadata,
        userAgent: context.userAgent,
        sessionId: context.sessionId,
        ipAddress: context.ipAddress
      };

      if (!enriched.actor.ipAddress && context.ipAddress) {
        enriched.actor.ipAddress = context.ipAddress;
      }
      if (!enriched.actor.userAgent && context.userAgent) {
        enriched.actor.userAgent = context.userAgent;
      }
      if (!enriched.actor.sessionId && context.sessionId) {
        enriched.actor.sessionId = context.sessionId;
      }
    }

    // Calculate checksum
    enriched.checksum = await this.calculateChecksum(enriched);

    return enriched;
  }

  /**
   * Calculate checksum for event integrity
   */
  private async calculateChecksum(event: BaseAuditEvent): Promise<string> {
    const eventString = JSON.stringify({
      eventType: event.eventType,
      timestamp: event.timestamp,
      actor: event.actor,
      resource: event.resource,
      outcome: event.outcome,
      description: event.description,
      details: event.details
    });

    const encoder = new TextEncoder();
    const data = encoder.encode(eventString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Hash event for deduplication
   */
  private hashEvent(event: BaseAuditEvent): string {
    const eventString = JSON.stringify({
      eventType: event.eventType,
      actor: event.actor,
      resource: event.resource,
      timestamp: event.timestamp,
      description: event.description
    });
    return eventString;
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.stopFlushTimer();
    await this.flush();
    this.seenEvents.clear();
  }
}

/**
 * Audit storage interface (to be implemented by storage layer)
 */
export interface AuditStorage {
  store(event: BaseAuditEvent): Promise<void>;
  storeBatch(events: BaseAuditEvent[]): Promise<void>;
  query(params: AuditQueryParams): Promise<AuditQueryResult>;
  getById(id: string): Promise<BaseAuditEvent | null>;
}

/**
 * Create a new audit collector
 */
export function createAuditCollector(
  config?: Partial<CollectorConfig>,
  storage?: AuditStorage
): IAuditCollector {
  return new AuditCollector(config, storage);
}

/**
 * Helper function to create authentication events
 */
export function createAuthEvent(
  eventType: AuditEventType,
  actorId: string,
  details?: Record<string, any>,
  context?: AuditEventContext
): Partial<BaseAuditEvent> {
  return {
    eventType,
    actor: {
      id: actorId,
      type: ActorType.USER,
      name: details?.username || actorId,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      sessionId: context?.sessionId
    },
    resource: {
      type: ResourceType.SESSION,
      id: context?.sessionId || crypto.randomUUID()
    },
    description: `Authentication event: ${eventType}`,
    details,
    severity: details?.failed ? EventSeverity.HIGH : EventSeverity.INFO,
    outcome: details?.failed ? EventOutcome.FAILURE : EventOutcome.SUCCESS
  };
}

/**
 * Helper function to create authorization events
 */
export function createAuthzEvent(
  eventType: AuditEventType,
  actorId: string,
  resource: { type: ResourceType; id: string; name?: string },
  details?: Record<string, any>,
  context?: AuditEventContext
): Partial<BaseAuditEvent> {
  return {
    eventType,
    actor: {
      id: actorId,
      type: ActorType.USER,
      name: details?.username || actorId,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent
    },
    resource,
    description: `Authorization event: ${eventType}`,
    details,
    severity: EventSeverity.MEDIUM,
    outcome: EventOutcome.SUCCESS
  };
}

/**
 * Helper function to create data events
 */
export function createDataEvent(
  eventType: AuditEventType,
  actorId: string,
  resource: { type: ResourceType; id: string; name?: string },
  details?: Record<string, any>,
  context?: AuditEventContext
): Partial<BaseAuditEvent> {
  return {
    eventType,
    actor: {
      id: actorId,
      type: ActorType.USER,
      name: details?.username || actorId,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent
    },
    resource,
    description: `Data event: ${eventType}`,
    details,
    severity: EventSeverity.LOW,
    outcome: EventOutcome.SUCCESS
  };
}

/**
 * Helper function to create security events
 */
export function createSecurityEvent(
  eventType: AuditEventType,
  details?: Record<string, any>,
  context?: AuditEventContext
): Partial<BaseAuditEvent> {
  return {
    eventType,
    actor: {
      id: 'system',
      type: ActorType.SYSTEM,
      name: 'Security System'
    },
    description: `Security event: ${eventType}`,
    details,
    severity: details?.severity || EventSeverity.HIGH,
    outcome: EventOutcome.SUCCESS
  };
}

/**
 * Helper function to create system events
 */
export function createSystemEvent(
  eventType: AuditEventType,
  details?: Record<string, any>,
  context?: AuditEventContext
): Partial<BaseAuditEvent> {
  return {
    eventType,
    actor: {
      id: 'system',
      type: ActorType.SYSTEM,
      name: 'System'
    },
    description: `System event: ${eventType}`,
    details,
    severity: EventSeverity.INFO,
    outcome: EventOutcome.SUCCESS
  };
}
