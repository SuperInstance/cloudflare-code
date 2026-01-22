/**
 * Audit logging utility functions
 */

import {
  type BaseAuditEvent,
  AuditEventType,
  ActorType,
  ResourceType,
  EventSeverity,
  EventOutcome,
  ComplianceFramework,
  SOC2TrustService,
  ISO27001Domain
} from '../types/events';

/**
 * Generate a unique event ID
 */
export function generateEventId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a checksum for data integrity
 */
export async function generateChecksum(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate audit event structure
 */
export function validateEvent(event: any): boolean {
  return (
    event &&
    typeof event === 'object' &&
    typeof event.id === 'string' &&
    typeof event.eventType === 'string' &&
    typeof event.timestamp === 'string' &&
    event.actor &&
    typeof event.actor === 'object'
  );
}

/**
 * Sanitize sensitive data in events
 */
export function sanitizeEvent(event: BaseAuditEvent, sensitiveFields: string[] = []): BaseAuditEvent {
  const sanitized = { ...event };

  if (sanitized.details) {
    sanitized.details = sanitizeDetails(sanitized.details, sensitiveFields);
  }

  // Sanitize actor information
  if (sanitized.actor.ipAddress) {
    sanitized.actor = {
      ...sanitized.actor,
      ipAddress: maskIpAddress(sanitized.actor.ipAddress)
    };
  }

  return sanitized;
}

/**
 * Sanitize details object
 */
export function sanitizeDetails(details: any, sensitiveFields: string[]): any {
  if (!details || typeof details !== 'object') {
    return details;
  }

  const sanitized = { ...details };

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  }

  return sanitized;
}

/**
 * Mask IP address for privacy
 */
export function maskIpAddress(ip: string): string {
  const parts = ip.split('.');

  if (parts.length === 4) {
    // IPv4
    return `${parts[0]}.${parts[1]}.***.***`;
  } else if (ip.includes(':')) {
    // IPv6
    const parts = ip.split(':');
    return `${parts[0]}:${parts[1]}:${parts[2]}:***`;
  }

  return ip;
}

/**
 * Extract geolocation from IP address (placeholder)
 */
export async function getGeolocationFromIp(ip: string): Promise<{
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}> {
  // In production, this would call a geolocation service
  return {};
}

/**
 * Parse user agent string
 */
export function parseUserAgent(userAgent: string): {
  browser?: string;
  os?: string;
  device?: string;
} {
  // Simplified user agent parsing
  const browser = userAgent.includes('Chrome') ? 'Chrome' :
                  userAgent.includes('Firefox') ? 'Firefox' :
                  userAgent.includes('Safari') ? 'Safari' : 'Unknown';

  const os = userAgent.includes('Windows') ? 'Windows' :
             userAgent.includes('Mac') ? 'macOS' :
             userAgent.includes('Linux') ? 'Linux' :
             userAgent.includes('Android') ? 'Android' :
             userAgent.includes('iOS') ? 'iOS' : 'Unknown';

  const device = userAgent.includes('Mobile') ? 'Mobile' : 'Desktop';

  return { browser, os, device };
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: string, format: 'iso' | 'readable' | 'relative' = 'iso'): string {
  const date = new Date(timestamp);

  switch (format) {
    case 'iso':
      return date.toISOString();

    case 'readable':
      return date.toLocaleString();

    case 'relative':
      return getRelativeTimeString(date);

    default:
      return date.toISOString();
  }
}

/**
 * Get relative time string
 */
export function getRelativeTimeString(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return date.toLocaleDateString();
  } else if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}

/**
 * Calculate retention date based on compliance requirements
 */
export function calculateRetentionDate(
  frameworks: ComplianceFramework[],
  baseDate: Date = new Date()
): Date {
  // Find the maximum retention period across all frameworks
  const retentionDays = frameworks.reduce((max, framework) => {
    const frameworkRetention = getRetentionPeriodForFramework(framework);
    return Math.max(max, frameworkRetention);
  }, 0);

  const retentionDate = new Date(baseDate);
  retentionDate.setDate(retentionDate.getDate() + retentionDays);

  return retentionDate;
}

/**
 * Get retention period for a compliance framework
 */
export function getRetentionPeriodForFramework(framework: ComplianceFramework): number {
  switch (framework) {
    case ComplianceFramework.SOC2:
      return 2555; // 7 years
    case ComplianceFramework.ISO27001:
      return 3650; // 10 years
    case ComplianceFramework.GDPR:
      return 2555; // 7 years (or until purpose fulfilled)
    case ComplianceFramework.HIPAA:
      return 2555; // 7 years
    case ComplianceFramework.PCI_DSS:
      return 365; // 1 year
    default:
      return 2555; // Default 7 years
  }
}

/**
 * Map event type to compliance frameworks
 */
export function getComplianceFrameworksForEventType(eventType: AuditEventType): ComplianceFramework[] {
  const authEvents = [
    AuditEventType.AUTH_LOGIN,
    AuditEventType.AUTH_LOGOUT,
    AuditEventType.AUTH_FAILED_LOGIN,
    AuditEventType.AUTH_PASSWORD_CHANGE,
    AuditEventType.AUTH_MFA_ENABLED,
    AuditEventType.AUTH_MFA_DISABLED
  ];

  const dataEvents = [
    AuditEventType.DATA_ACCESS,
    AuditEventType.DATA_CREATED,
    AuditEventType.DATA_MODIFIED,
    AuditEventType.DATA_DELETED,
    AuditEventType.DATA_EXPORTED
  ];

  const securityEvents = [
    AuditEventType.SECURITY_VULNERABILITY_DETECTED,
    AuditEventType.SECURITY_INTRUSION_DETECTED,
    AuditEventType.SECURITY_DATA_BREACH
  ];

  if (authEvents.includes(eventType)) {
    return [
      ComplianceFramework.SOC2,
      ComplianceFramework.ISO27001,
      ComplianceFramework.NIST
    ];
  }

  if (dataEvents.includes(eventType)) {
    return [
      ComplianceFramework.SOC2,
      ComplianceFramework.ISO27001,
      ComplianceFramework.GDPR,
      ComplianceFramework.HIPAA
    ];
  }

  if (securityEvents.includes(eventType)) {
    return [
      ComplianceFramework.SOC2,
      ComplianceFramework.ISO27001,
      ComplianceFramework.PCI_DSS
    ];
  }

  return [ComplianceFramework.SOC2, ComplianceFramework.ISO27001];
}

/**
 * Map event type to SOC 2 trust services
 */
export function getSOC2TrustServicesForEventType(eventType: AuditEventType): SOC2TrustService[] {
  if (eventType.startsWith('auth.') || eventType.startsWith('authz.')) {
    return [SOC2TrustService.SECURITY];
  }

  if (eventType.startsWith('data.')) {
    return [
      SOC2TrustService.CONFIDENTIALITY,
      SOC2TrustService.PRIVACY,
      SOC2TrustService.PROCESSING_INTEGRITY
    ];
  }

  if (eventType.startsWith('system.')) {
    return [SOC2TrustService.AVAILABILITY];
  }

  if (eventType.startsWith('security.')) {
    return [SOC2TrustService.SECURITY];
  }

  return [];
}

/**
 * Map event type to ISO 27001 domains
 */
export function getISO27001DomainsForEventType(eventType: AuditEventType): ISO27001Domain[] {
  if (eventType.startsWith('auth.') || eventType.startsWith('authz.')) {
    return [ISO27001Domain.ACCESS_CONTROL];
  }

  if (eventType.startsWith('data.')) {
    return [
      ISO27001Domain.ASSET_MANAGEMENT,
      ISO27001Domain.ACCESS_CONTROL
    ];
  }

  if (eventType.startsWith('system.')) {
    return [ISO27001Domain.OPERATIONS_SECURITY];
  }

  if (eventType.startsWith('security.')) {
    return [ISO27001Domain.INFORMATION_SECURITY_INCIDENT_MANAGEMENT];
  }

  return [];
}

/**
 * Determine event severity based on type and outcome
 */
export function determineEventSeverity(
  eventType: AuditEventType,
  outcome: EventOutcome,
  details?: any
): EventSeverity {
  // Critical events
  if (eventType === AuditEventType.SECURITY_DATA_BREACH) {
    return EventSeverity.CRITICAL;
  }

  if (eventType === AuditEventType.SECURITY_INTRUSION_DETECTED) {
    return EventSeverity.CRITICAL;
  }

  // High severity
  if (outcome === EventOutcome.FAILURE || outcome === EventOutcome.ERROR) {
    if (eventType.startsWith('security.') || eventType.startsWith('auth.')) {
      return EventSeverity.HIGH;
    }
  }

  if (eventType === AuditEventType.AUTHZ_PRIVILEGE_ESCALATION) {
    return EventSeverity.HIGH;
  }

  if (eventType === AuditEventType.DATA_DELETED) {
    return EventSeverity.HIGH;
  }

  // Medium severity
  if (eventType === AuditEventType.AUTH_FAILED_LOGIN) {
    return EventSeverity.MEDIUM;
  }

  if (eventType === AuditEventType.AUTH_MFA_DISABLED) {
    return EventSeverity.MEDIUM;
  }

  if (eventType === AuditEventType.DATA_EXPORTED) {
    return EventSeverity.MEDIUM;
  }

  // Low severity
  if (eventType === AuditEventType.AUTH_MFA_ENABLED) {
    return EventSeverity.LOW;
  }

  if (eventType === AuditEventType.AUTH_PASSWORD_CHANGE) {
    return EventSeverity.LOW;
  }

  // Default to info
  return EventSeverity.INFO;
}

/**
 * Build audit event from request context
 */
export function buildEventFromContext(
  eventType: AuditEventType,
  actor: {
    id: string;
    type?: ActorType;
    name?: string;
  },
  resource?: {
    type: ResourceType;
    id: string;
    name?: string;
  },
  details?: any,
  outcome: EventOutcome = EventOutcome.SUCCESS,
  context?: {
    requestId?: string;
    correlationId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Partial<BaseAuditEvent> {
  return {
    id: generateEventId(),
    eventType,
    timestamp: new Date().toISOString(),
    sequenceNumber: 0,

    actor: {
      id: actor.id,
      type: actor.type || ActorType.USER,
      name: actor.name || actor.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      sessionId: context?.sessionId
    },

    resource: resource ? {
      type: resource.type,
      id: resource.id,
      name: resource.name
    } : undefined,

    outcome,
    severity: determineEventSeverity(eventType, outcome, details),

    complianceFrameworks: getComplianceFrameworksForEventType(eventType),
    soc2TrustServices: getSOC2TrustServicesForEventType(eventType),
    iso27001Domains: getISO27001DomainsForEventType(eventType),

    description: `${eventType.replace(/\./g, ' ')}: ${resource?.type || 'system'}`,
    details,

    correlationId: context?.correlationId,
    requestId: context?.requestId,

    checksum: '',
    isImmutable: true,
    isArchived: false
  };
}

/**
 * Batch events for efficient storage
 */
export function batchEvents(events: BaseAuditEvent[], batchSize: number = 100): BaseAuditEvent[][] {
  const batches: BaseAuditEvent[][] = [];

  for (let i = 0; i < events.length; i += batchSize) {
    batches.push(events.slice(i, i + batchSize));
  }

  return batches;
}

/**
 * Filter events by time range
 */
export function filterByTimeRange(
  events: BaseAuditEvent[],
  startTime?: Date,
  endTime?: Date
): BaseAuditEvent[] {
  return events.filter(event => {
    const eventTime = new Date(event.timestamp);

    if (startTime && eventTime < startTime) {
      return false;
    }

    if (endTime && eventTime > endTime) {
      return false;
    }

    return true;
  });
}

/**
 * Group events by time period
 */
export function groupByTimePeriod(
  events: BaseAuditEvent[],
  period: 'hour' | 'day' | 'week' | 'month'
): Map<string, BaseAuditEvent[]> {
  const groups = new Map<string, BaseAuditEvent[]>();

  for (const event of events) {
    const date = new Date(event.timestamp);
    let key: string;

    switch (period) {
      case 'hour':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
        break;
      case 'day':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        break;
      case 'week':
        const weekNumber = getWeekNumber(date);
        key = `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
        break;
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key)!.push(event);
  }

  return groups;
}

/**
 * Get week number from date
 */
export function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

/**
 * Calculate compliance percentage
 */
export function calculateCompliancePercentage(
  totalEvents: number,
  compliantEvents: number
): number {
  if (totalEvents === 0) {
    return 100;
  }

  return Math.round((compliantEvents / totalEvents) * 100);
}

/**
 * Generate event hash for deduplication
 */
export function generateEventHash(event: BaseAuditEvent): string {
  const hashData = {
    eventType: event.eventType,
    actorId: event.actor.id,
    resourceType: event.resource?.type,
    resourceId: event.resource?.id,
    timestamp: event.timestamp,
    description: event.description
  };

  const jsonString = JSON.stringify(hashData);
  let hash = 0;

  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return hash.toString(16);
}

/**
 * Validate event checksum
 */
export async function validateEventChecksum(event: BaseAuditEvent): Promise<boolean> {
  const calculatedChecksum = await generateChecksum(JSON.stringify({
    eventType: event.eventType,
    timestamp: event.timestamp,
    actor: event.actor,
    resource: event.resource,
    outcome: event.outcome,
    description: event.description,
    details: event.details
  }));

  return calculatedChecksum === event.checksum;
}

/**
 * Export events to various formats
 */
export function exportEvents(events: BaseAuditEvent[], format: 'json' | 'csv' | 'ndjson'): string {
  switch (format) {
    case 'json':
      return JSON.stringify(events, null, 2);

    case 'csv':
      return exportEventsAsCsv(events);

    case 'ndjson':
      return events.map(e => JSON.stringify(e)).join('\n');

    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Export events as CSV
 */
function exportEventsAsCsv(events: BaseAuditEvent[]): string {
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

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}
