/**
 * Event Normalizer
 * Normalizes security events to a consistent format
 */

import { SecurityEvent, SecurityEventType, SecurityEventSeverity } from '../types';
import { EventValidator } from './validator';

export class EventNormalizer {
  private validator: EventValidator;

  constructor(validator: EventValidator) {
    this.validator = validator;
  }

  /**
   * Normalize an event to the standard SecurityEvent format
   */
  public async normalize(eventData: Partial<SecurityEvent>): Promise<SecurityEvent> {
    // Normalize type
    const type = this.normalizeType(eventData.type);

    // Normalize severity
    const severity = this.normalizeSeverity(eventData.severity, type);

    // Normalize timestamp
    const timestamp = this.normalizeTimestamp(eventData.timestamp);

    // Normalize IP address
    const ipAddress = this.normalizeIpAddress(eventData.ipAddress);

    // Normalize user agent
    const userAgent = this.normalizeUserAgent(eventData.userAgent);

    // Normalize resource
    const resource = this.normalizeResource(eventData.resource);

    // Normalize action
    const action = this.normalizeAction(eventData.action, type);

    // Normalize outcome
    const outcome = this.normalizeOutcome(eventData.outcome);

    // Normalize details
    const details = this.normalizeDetails(eventData.details);

    // Normalize metadata
    const metadata = this.normalizeMetadata(eventData.metadata);

    // Normalize tags
    const tags = this.normalizeTags(eventData.tags, type, severity);

    // Build normalized event
    const normalizedEvent: SecurityEvent = {
      id: eventData.id || this.generateEventId(),
      type,
      severity,
      timestamp,
      source: this.normalizeSource(eventData.source),
      userId: eventData.userId,
      sessionId: eventData.sessionId,
      ipAddress,
      userAgent,
      resource,
      action,
      outcome,
      details,
      metadata,
      tags,
      correlationId: eventData.correlationId,
      eventId: eventData.eventId,
    };

    return normalizedEvent;
  }

  /**
   * Normalize event type
   */
  private normalizeType(type: any): SecurityEventType {
    if (!type) {
      return SecurityEventType.APP_ERROR;
    }

    if (typeof type === 'string') {
      // Check if it's a valid SecurityEventType
      if (Object.values(SecurityEventType).includes(type as SecurityEventType)) {
        return type as SecurityEventType;
      }

      // Try to map common variations
      const normalizedType = this.mapEventType(type);
      if (normalizedType) {
        return normalizedType;
      }
    }

    return SecurityEventType.APP_ERROR;
  }

  /**
   * Map common event type variations to standard types
   */
  private mapEventType(type: string): SecurityEventType | null {
    const typeMap: Record<string, SecurityEventType> = {
      // Authentication variations
      'login_success': SecurityEventType.AUTH_LOGIN_SUCCESS,
      'login.success': SecurityEventType.AUTH_LOGIN_SUCCESS,
      'login': SecurityEventType.AUTH_LOGIN_SUCCESS,
      'login_failed': SecurityEventType.AUTH_LOGIN_FAILURE,
      'login_failure': SecurityEventType.AUTH_LOGIN_FAILURE,
      'login.failed': SecurityEventType.AUTH_LOGIN_FAILURE,
      'logout': SecurityEventType.AUTH_LOGOUT,
      'log_out': SecurityEventType.AUTH_LOGOUT,

      // Access variations
      'access_granted': SecurityEventType.ACCESS_GRANTED,
      'access.granted': SecurityEventType.ACCESS_GRANTED,
      'access_denied': SecurityEventType.ACCESS_DENIED,
      'access.denied': SecurityEventType.ACCESS_DENIED,
      'unauthorized': SecurityEventType.ACCESS_DENIED,
      'forbidden': SecurityEventType.ACCESS_DENIED,

      // Threat variations
      'threat': SecurityEventType.THREAT_DETECTED,
      'attack': SecurityEventType.THREAT_DETECTED,
      'intrusion': SecurityEventType.INTRUSION_DETECTED,
      'malware': SecurityEventType.MALWARE_DETECTED,

      // Vulnerability variations
      'vulnerability': SecurityEventType.VULN_DISCOVERED,
      'vuln': SecurityEventType.VULN_DISCOVERED,
      'cve': SecurityEventType.VULN_DISCOVERED,
    };

    const normalized = typeMap[type.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')];
    return normalized || null;
  }

  /**
   * Normalize severity
   */
  private normalizeSeverity(
    severity: any,
    type: SecurityEventType
  ): SecurityEventSeverity {
    if (severity) {
      if (typeof severity === 'string') {
        const normalizedSeverity = severity.toLowerCase();
        if (Object.values(SecurityEventSeverity).includes(normalizedSeverity as SecurityEventSeverity)) {
          return normalizedSeverity as SecurityEventSeverity;
        }
      }

      if (typeof severity === 'number') {
        return this.mapNumberToSeverity(severity);
      }
    }

    // Default severity based on event type
    return this.getDefaultSeverityForType(type);
  }

  /**
   * Map number to severity
   */
  private mapNumberToSeverity(severity: number): SecurityEventSeverity {
    if (severity >= 8) return SecurityEventSeverity.CRITICAL;
    if (severity >= 6) return SecurityEventSeverity.HIGH;
    if (severity >= 4) return SecurityEventSeverity.MEDIUM;
    if (severity >= 2) return SecurityEventSeverity.LOW;
    return SecurityEventSeverity.INFO;
  }

  /**
   * Get default severity for event type
   */
  private getDefaultSeverityForType(type: SecurityEventType): SecurityEventSeverity {
    const defaultSeverityMap: Record<SecurityEventType, SecurityEventSeverity> = {
      [SecurityEventType.AUTH_LOGIN_SUCCESS]: SecurityEventSeverity.INFO,
      [SecurityEventType.AUTH_LOGIN_FAILURE]: SecurityEventSeverity.MEDIUM,
      [SecurityEventType.AUTH_LOGOUT]: SecurityEventSeverity.INFO,
      [SecurityEventType.AUTH_PASSWORD_CHANGE]: SecurityEventSeverity.INFO,
      [SecurityEventType.AUTH_PASSWORD_RESET]: SecurityEventSeverity.LOW,
      [SecurityEventType.AUTH_MFA_ENABLED]: SecurityEventSeverity.INFO,
      [SecurityEventType.AUTH_MFA_DISABLED]: SecurityEventSeverity.MEDIUM,
      [SecurityEventType.AUTH_TOKEN_ISSUED]: SecurityEventSeverity.INFO,
      [SecurityEventType.AUTH_TOKEN_REVOKED]: SecurityEventSeverity.LOW,
      [SecurityEventType.AUTH_SESSION_CREATED]: SecurityEventSeverity.INFO,
      [SecurityEventType.AUTH_SESSION_TERMINATED]: SecurityEventSeverity.INFO,
      [SecurityEventType.AUTH_PRIVILEGE_ESCALATION]: SecurityEventSeverity.HIGH,
      [SecurityEventType.AUTH_ROLE_ASSIGNED]: SecurityEventSeverity.INFO,
      [SecurityEventType.AUTH_ROLE_REVOKED]: SecurityEventSeverity.LOW,

      [SecurityEventType.ACCESS_GRANTED]: SecurityEventSeverity.INFO,
      [SecurityEventType.ACCESS_DENIED]: SecurityEventSeverity.MEDIUM,
      [SecurityEventType.ACCESS_ATTEMPT]: SecurityEventSeverity.LOW,
      [SecurityEventType.RESOURCE_ACCESS]: SecurityEventSeverity.INFO,
      [SecurityEventType.DATA_ACCESS]: SecurityEventSeverity.LOW,
      [SecurityEventType.API_ACCESS]: SecurityEventSeverity.INFO,

      [SecurityEventType.DATA_ENCRYPTED]: SecurityEventSeverity.INFO,
      [SecurityEventType.DATA_DECRYPTED]: SecurityEventSeverity.INFO,
      [SecurityEventType.DATA_EXPORTED]: SecurityEventSeverity.LOW,
      [SecurityEventType.DATA_IMPORTED]: SecurityEventSeverity.LOW,
      [SecurityEventType.DATA_DELETED]: SecurityEventSeverity.MEDIUM,
      [SecurityEventType.DATA_MODIFIED]: SecurityEventSeverity.MEDIUM,
      [SecurityEventType.DATA_COPIED]: SecurityEventSeverity.LOW,
      [SecurityEventType.PII_ACCESSED]: SecurityEventSeverity.LOW,
      [SecurityEventType.PII_MODIFIED]: SecurityEventSeverity.HIGH,

      [SecurityEventType.NETWORK_CONNECTION]: SecurityEventSeverity.INFO,
      [SecurityEventType.NETWORK_DISCONNECTION]: SecurityEventSeverity.INFO,
      [SecurityEventType.NETWORK_TRAFFIC]: SecurityEventSeverity.INFO,
      [SecurityEventType.NETWORK_SCAN]: SecurityEventSeverity.HIGH,
      [SecurityEventType.PORT_SCAN]: SecurityEventSeverity.HIGH,
      [SecurityEventType.DDOS_ATTEMPT]: SecurityEventSeverity.CRITICAL,
      [SecurityEventType.INTRUSION_DETECTED]: SecurityEventSeverity.CRITICAL,
      [SecurityEventType.MALWARE_DETECTED]: SecurityEventSeverity.CRITICAL,

      [SecurityEventType.APP_STARTUP]: SecurityEventSeverity.INFO,
      [SecurityEventType.APP_SHUTDOWN]: SecurityEventSeverity.INFO,
      [SecurityEventType.APP_ERROR]: SecurityEventSeverity.MEDIUM,
      [SecurityEventType.APP_EXCEPTION]: SecurityEventSeverity.HIGH,
      [SecurityEventType.APP_DEPLOYMENT]: SecurityEventSeverity.INFO,
      [SecurityEventType.APP_CONFIG_CHANGE]: SecurityEventSeverity.LOW,

      [SecurityEventType.VULN_DISCOVERED]: SecurityEventSeverity.HIGH,
      [SecurityEventType.VULN_SCANNED]: SecurityEventSeverity.INFO,
      [SecurityEventType.VULN_PATCHED]: SecurityEventSeverity.INFO,
      [SecurityEventType.VULN_REPORTED]: SecurityEventSeverity.MEDIUM,

      [SecurityEventType.THREAT_DETECTED]: SecurityEventSeverity.HIGH,
      [SecurityEventType.THREAT_BLOCKED]: SecurityEventSeverity.MEDIUM,
      [SecurityEventType.THREAT_INVESTIGATED]: SecurityEventSeverity.LOW,
      [SecurityEventType.ANOMALY_DETECTED]: SecurityEventSeverity.MEDIUM,

      [SecurityEventType.INCIDENT_CREATED]: SecurityEventSeverity.HIGH,
      [SecurityEventType.INCIDENT_UPDATED]: SecurityEventSeverity.LOW,
      [SecurityEventType.INCIDENT_RESOLVED]: SecurityEventSeverity.INFO,
      [SecurityEventType.INCIDENT_CLOSED]: SecurityEventSeverity.INFO,

      [SecurityEventType.COMPLIANCE_CHECK]: SecurityEventSeverity.INFO,
      [SecurityEventType.COMPLIANCE_PASS]: SecurityEventSeverity.INFO,
      [SecurityEventType.COMPLIANCE_FAIL]: SecurityEventSeverity.HIGH,
      [SecurityEventType.AUDIT_LOG_ACCESSED]: SecurityEventSeverity.LOW,

      [SecurityEventType.SYSTEM_BACKUP]: SecurityEventSeverity.INFO,
      [SecurityEventType.SYSTEM_RESTORE]: SecurityEventSeverity.MEDIUM,
      [SecurityEventType.SYSTEM_MAINTENANCE]: SecurityEventSeverity.INFO,
      [SecurityEventType.CONFIGURATION_CHANGE]: SecurityEventSeverity.LOW,
      [SecurityEventType.PERMISSION_CHANGE]: SecurityEventSeverity.LOW,

      [SecurityEventType.FILE_UPLOADED]: SecurityEventSeverity.INFO,
      [SecurityEventType.FILE_DOWNLOADED]: SecurityEventSeverity.INFO,
      [SecurityEventType.FILE_SHARED]: SecurityEventSeverity.LOW,
      [SecurityEventType.STORAGE_LIMIT_REACHED]: SecurityEventSeverity.MEDIUM,

      [SecurityEventType.CODE_COMMIT]: SecurityEventSeverity.INFO,
      [SecurityEventType.CODE_PUSH]: SecurityEventSeverity.INFO,
      [SecurityEventType.CODE_MERGE]: SecurityEventSeverity.INFO,
      [SecurityEventType.CODE_DEPLOYMENT]: SecurityEventSeverity.INFO,
      [SecurityEventType.REPO_ACCESS]: SecurityEventSeverity.INFO,
      [SecurityEventType.REPO_FORK]: SecurityEventSeverity.INFO,
      [SecurityEventType.REPO_CLONE]: SecurityEventSeverity.INFO,

      [SecurityEventType.API_CALL]: SecurityEventSeverity.INFO,
      [SecurityEventType.API_ERROR]: SecurityEventSeverity.MEDIUM,
      [SecurityEventType.API_RATE_LIMIT]: SecurityEventSeverity.LOW,
      [SecurityEventType.WEBHOOK_RECEIVED]: SecurityEventSeverity.INFO,
      [SecurityEventType.WEBHOOK_FAILED]: SecurityEventSeverity.MEDIUM,

      [SecurityEventType.ALERT_TRIGGERED]: SecurityEventSeverity.MEDIUM,
      [SecurityEventType.ALERT_ACKNOWLEDGED]: SecurityEventSeverity.INFO,
      [SecurityEventType.ALERT_RESOLVED]: SecurityEventSeverity.INFO,
      [SecurityEventType.METRIC_THRESHOLD]: SecurityEventSeverity.LOW,

      // Container events
      [SecurityEventType._CONTAINER_CREATED]: SecurityEventSeverity.INFO,
      [SecurityEventType.container_DELETED]: SecurityEventSeverity.INFO,
      [SecurityEventType.CONTAINER_ESCALATION]: SecurityEventSeverity.HIGH,

      // Kubernetes events
      [SecurityEventType.K8S_API_CALL]: SecurityEventSeverity.LOW,
    };

    return defaultSeverityMap[type] || SecurityEventSeverity.INFO;
  }

  /**
   * Normalize timestamp
   */
  private normalizeTimestamp(timestamp: any): Date {
    if (!timestamp) {
      return new Date();
    }

    if (timestamp instanceof Date) {
      return timestamp;
    }

    if (typeof timestamp === 'string') {
      const parsed = new Date(timestamp);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    if (typeof timestamp === 'number') {
      return new Date(timestamp);
    }

    return new Date();
  }

  /**
   * Normalize IP address
   */
  private normalizeIpAddress(ipAddress: any): string | undefined {
    if (!ipAddress) {
      return undefined;
    }

    const ipStr = String(ipAddress).trim();

    // Basic IP validation
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    if (ipv4Regex.test(ipStr) || ipv6Regex.test(ipStr)) {
      return ipStr;
    }

    return undefined;
  }

  /**
   * Normalize user agent
   */
  private normalizeUserAgent(userAgent: any): string | undefined {
    if (!userAgent) {
      return undefined;
    }

    const uaStr = String(userAgent).trim();

    // Limit user agent length
    if (uaStr.length > 500) {
      return uaStr.substring(0, 500);
    }

    return uaStr;
  }

  /**
   * Normalize resource
   */
  private normalizeResource(resource: any): string | undefined {
    if (!resource) {
      return undefined;
    }

    const resourceStr = String(resource).trim();

    // Limit resource length
    if (resourceStr.length > 1000) {
      return resourceStr.substring(0, 1000);
    }

    return resourceStr;
  }

  /**
   * Normalize action
   */
  private normalizeAction(action: any, type: SecurityEventType): string | undefined {
    if (!action) {
      // Derive action from type
      const typeParts = type.split('.');
      return typeParts[typeParts.length - 1];
    }

    const actionStr = String(action).trim();

    // Limit action length
    if (actionStr.length > 100) {
      return actionStr.substring(0, 100);
    }

    return actionStr;
  }

  /**
   * Normalize outcome
   */
  private normalizeOutcome(outcome: any): 'success' | 'failure' | 'partial' {
    if (!outcome) {
      return 'success';
    }

    const outcomeStr = String(outcome).toLowerCase();

    if (outcomeStr === 'success' || outcomeStr === 'true' || outcomeStr === '1') {
      return 'success';
    }

    if (outcomeStr === 'failure' || outcomeStr === 'fail' || outcomeStr === 'false' || outcomeStr === '0') {
      return 'failure';
    }

    if (outcomeStr === 'partial') {
      return 'partial';
    }

    return 'success';
  }

  /**
   * Normalize details
   */
  private normalizeDetails(details: any): Record<string, unknown> {
    if (!details) {
      return {};
    }

    if (typeof details === 'object' && !Array.isArray(details)) {
      return details as Record<string, unknown>;
    }

    if (Array.isArray(details)) {
      return { items: details };
    }

    return { value: details };
  }

  /**
   * Normalize metadata
   */
  private normalizeMetadata(metadata: any): any {
    if (!metadata) {
      return {};
    }

    if (typeof metadata === 'object' && !Array.isArray(metadata)) {
      return metadata;
    }

    return {};
  }

  /**
   * Normalize source
   */
  private normalizeSource(source: any): string {
    if (!source) {
      return 'unknown';
    }

    const sourceStr = String(source).trim();

    // Limit source length
    if (sourceStr.length > 100) {
      return sourceStr.substring(0, 100);
    }

    return sourceStr;
  }

  /**
   * Normalize tags
   */
  private normalizeTags(
    tags: any,
    type: SecurityEventType,
    severity: SecurityEventSeverity
  ): string[] | undefined {
    const normalizedTags: string[] = [];

    // Add type-based tag
    const typeCategory = type.split('.')[0];
    normalizedTags.push(typeCategory);

    // Add severity-based tag
    normalizedTags.push(severity);

    // Add custom tags
    if (Array.isArray(tags)) {
      tags.forEach(tag => {
        if (typeof tag === 'string' && tag.trim().length > 0) {
          normalizedTags.push(tag.trim());
        }
      });
    }

    return normalizedTags.length > 0 ? normalizedTags : undefined;
  }

  /**
   * Generate event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
