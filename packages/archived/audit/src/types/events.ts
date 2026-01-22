/**
 * Comprehensive audit event type definitions for ClaudeFlare platform
 * Supports SOC 2 Type II, ISO 27001, and GDPR compliance requirements
 */

import { z } from 'zod';

/**
 * Base event types for audit logging
 */
export enum AuditEventType {
  // Authentication Events
  AUTH_LOGIN = 'auth.login',
  AUTH_LOGOUT = 'auth.logout',
  AUTH_FAILED_LOGIN = 'auth.failed_login',
  AUTH_PASSWORD_CHANGE = 'auth.password_change',
  AUTH_PASSWORD_RESET = 'auth.password_reset',
  AUTH_MFA_ENABLED = 'auth.mfa_enabled',
  AUTH_MFA_DISABLED = 'auth.mfa_disabled',
  AUTH_MFA_VERIFIED = 'auth.mfa_verified',
  AUTH_MFA_FAILED = 'auth.mfa_failed',
  AUTH_API_KEY_CREATED = 'auth.api_key_created',
  AUTH_API_KEY_DELETED = 'auth.api_key_deleted',
  AUTH_API_KEY_ROTATED = 'auth.api_key_rotated',
  AUTH_SESSION_CREATED = 'auth.session_created',
  AUTH_SESSION_DESTROYED = 'auth.session_destroyed',
  AUTH_SESSION_EXPIRED = 'auth.session_expired',
  AUTH_TOKEN_REFRESHED = 'auth.token_refreshed',

  // Authorization Events
  AUTHZ_PERMISSION_GRANTED = 'authz.permission_granted',
  AUTHZ_PERMISSION_REVOKED = 'authz.permission_revoked',
  AUTHZ_ROLE_CREATED = 'authz.role_created',
  AUTHZ_ROLE_DELETED = 'authz.role_deleted',
  AUTHZ_ROLE_MODIFIED = 'authz.role_modified',
  AUTHZ_ROLE_ASSIGNED = 'authz.role_assigned',
  AUTHZ_ROLE_UNASSIGNED = 'authz.role_unassigned',
  AUTHZ_ACCESS_GRANTED = 'authz.access_granted',
  AUTHZ_ACCESS_DENIED = 'authz.access_denied',
  AUTHZ_PRIVILEGE_ESCALATION = 'authz.privilege_escalation',
  AUTHZ_ADMIN_ACCESS = 'authz.admin_access',

  // Data Events
  DATA_ACCESS = 'data.access',
  DATA_CREATED = 'data.created',
  DATA_MODIFIED = 'data.modified',
  DATA_DELETED = 'data.deleted',
  DATA_EXPORTED = 'data.exported',
  DATA_IMPORTED = 'data.imported',
  DATA_QUERIED = 'data.queried',
  DATA_BULK_DELETE = 'data.bulk_delete',
  DATA_BULK_EXPORT = 'data.bulk_export',
  DATA_SCHEMA_CHANGE = 'data.schema_change',
  DATA_MIGRATION = 'data.migration',
  DATA_BACKUP = 'data.backup',
  DATA_RESTORE = 'data.restore',
  DATA_ARCHIVE = 'data.archive',
  DATA_RETENTION = 'data.retention',

  // System Events
  SYSTEM_CONFIG_CHANGE = 'system.config_change',
  SYSTEM_DEPLOYMENT = 'system.deployment',
  SYSTEM_ROLLBACK = 'system.rollback',
  SYSTEM_STARTUP = 'system.startup',
  SYSTEM_SHUTDOWN = 'system.shutdown',
  SYSTEM_ERROR = 'system.error',
  SYSTEM_WARNING = 'system.warning',
  SYSTEM_PERFORMANCE_DEGRADED = 'system.performance_degraded',
  SYSTEM_MAINTENANCE_START = 'system.maintenance_start',
  SYSTEM_MAINTENANCE_END = 'system.maintenance_end',
  SYSTEM_UPDATE = 'system.update',
  SYSTEM_PATCH = 'system.patch',
  SYSTEM_UPGRADE = 'system.upgrade',

  // Security Events
  SECURITY_VULNERABILITY_DETECTED = 'security.vulnerability_detected',
  SECURITY_VULNERABILITY_FIXED = 'security.vulnerability_fixed',
  SECURITY_INTRUSION_DETECTED = 'security.intrusion_detected',
  SECURITY_MALWARE_DETECTED = 'security.malware_detected',
  SECURITY_BRUTE_FORCE_ATTEMPT = 'security.brute_force_attempt',
  SECURITY_DOS_ATTACK = 'security.dos_attack',
  SECURITY_UNAUTHORIZED_ACCESS = 'security.unauthorized_access',
  SECURITY_DATA_BREACH = 'security.data_breach',
  SECURITY_ENCRYPTION_KEY_ROTATED = 'security.encryption_key_rotated',
  SECURITY_CERTIFICATE_UPDATED = 'security.certificate_updated',
  SECURITY_FIREWALL_RULE_CHANGE = 'security.firewall_rule_change',
  SECURITY_POLICY_CHANGE = 'security.policy_change',

  // Network Events
  NETWORK_CONNECTION = 'network.connection',
  NETWORK_DISCONNECTION = 'network.disconnection',
  NETWORK_REQUEST = 'network.request',
  NETWORK_RESPONSE = 'network.response',
  NETWORK_ERROR = 'network.error',
  NETWORK_BANDWIDTH_LIMIT = 'network.bandwidth_limit',
  NETWORK_LATENCY_HIGH = 'network.latency_high',

  // User Management
  USER_CREATED = 'user.created',
  USER_DELETED = 'user.deleted',
  USER_MODIFIED = 'user.modified',
  USER_SUSPENDED = 'user.suspended',
  USER_REACTIVATED = 'user.reactivated',
  USER_PROFILE_VIEWED = 'user.profile_viewed',
  USER_BULK_ACTION = 'user.bulk_action',

  // Resource Management
  RESOURCE_CREATED = 'resource.created',
  RESOURCE_DELETED = 'resource.deleted',
  RESOURCE_MODIFIED = 'resource.modified',
  RESOURCE_ALLOCATED = 'resource.allocated',
  RESOURCE_DEALLOCATED = 'resource.deallocated',
  RESOURCE_QUOTA_EXCEEDED = 'resource.quota_exceeded',

  // Audit Events
  AUDIT_LOG_ACCESSED = 'audit.log_accessed',
  AUDIT_LOG_EXPORTED = 'audit.log_exported',
  AUDIT_LOG_ARCHIVED = 'audit.log_archived',
  AUDIT_REPORT_GENERATED = 'audit.report_generated',
  AUDIT_RETENTION_APPLIED = 'audit.retention_applied',

  // Compliance Events
  COMPLIANCE_CHECK_PASSED = 'compliance.check_passed',
  COMPLIANCE_CHECK_FAILED = 'compliance.check_failed',
  COMPLIANCE_ASSESSMENT = 'compliance.assessment',
  COMPLIANCE_REMEDIATION = 'compliance.remediation',

  // AI/ML Events
  AI_MODEL_DEPLOYED = 'ai.model_deployed',
  AI_MODEL_RETRACTED = 'ai.model_retracted',
  AI_MODEL_RETRAINED = 'ai.model_retrained',
  AI_INFERENCE_REQUEST = 'ai.inference_request',
  AI_INFERENCE_RESPONSE = 'ai.inference_response',
  AI_DATA_USED = 'ai.data_used',
  AI_BIAS_DETECTED = 'ai.bias_detected',

  // Workflow Events
  WORKFLOW_STARTED = 'workflow.started',
  WORKFLOW_COMPLETED = 'workflow.completed',
  WORKFLOW_FAILED = 'workflow.failed',
  WORKFLOW_CANCELLED = 'workflow.cancelled',
  WORKFLOW_APPROVED = 'workflow.approved',
  WORKFLOW_REJECTED = 'workflow.rejected',

  // Integration Events
  INTEGRATION_CONNECTED = 'integration.connected',
  INTEGRATION_DISCONNECTED = 'integration.disconnected',
  INTEGRATION_SYNC = 'integration.sync',
  INTEGRATION_ERROR = 'integration.error',

  // Monitoring Events
  MONITORING_ALERT_TRIGGERED = 'monitoring.alert_triggered',
  MONITORING_ALERT_RESOLVED = 'monitoring.alert_resolved',
  MONITORING_THRESHOLD_EXCEEDED = 'monitoring.threshold_exceeded',
  MONITORING_ANOMALY_DETECTED = 'monitoring.anomaly_detected'
}

/**
 * Compliance frameworks
 */
export enum ComplianceFramework {
  SOC2 = 'SOC2',
  ISO27001 = 'ISO27001',
  GDPR = 'GDPR',
  HIPAA = 'HIPAA',
  PCI_DSS = 'PCI_DSS',
  NIST = 'NIST'
}

/**
 * SOC 2 Trust Services Criteria
 */
export enum SOC2TrustService {
  SECURITY = 'Security',
  AVAILABILITY = 'Availability',
  PROCESSING_INTEGRITY = 'Processing Integrity',
  CONFIDENTIALITY = 'Confidentiality',
  PRIVACY = 'Privacy'
}

/**
 * ISO 27001 Control Domains
 */
export enum ISO27001Domain {
  INFORMATION_SECURITY_POLICIES = 'A.5',
  ORGANIZATION_OF_INFORMATION_SECURITY = 'A.6',
  HUMAN_RESOURCE_SECURITY = 'A.7',
  ASSET_MANAGEMENT = 'A.8',
  ACCESS_CONTROL = 'A.9',
  CRYPTOGRAPHY = 'A.10',
  PHYSICAL_SECURITY = 'A.11',
  OPERATIONS_SECURITY = 'A.12',
  COMMUNICATIONS_SECURITY = 'A.13',
  SYSTEM_ACQUISITION_DEVELOPMENT_MAINTENANCE = 'A.14',
  SUPPLIER_RELATIONSHIPS = 'A.15',
  INFORMATION_SECURITY_INCIDENT_MANAGEMENT = 'A.16',
  INFORMATION_SECURITY_ASPECTS_OF_BUSINESS_CONTINUITY = 'A.17',
  COMPLIANCE = 'A.18'
}

/**
 * Event severity levels
 */
export enum EventSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

/**
 * Event outcome
 */
export enum EventOutcome {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PARTIAL = 'partial',
  PENDING = 'pending',
  ERROR = 'error'
}

/**
 * Actor types
 */
export enum ActorType {
  USER = 'user',
  SERVICE = 'service',
  SYSTEM = 'system',
  API = 'api',
  WEBHOOK = 'webhook'
}

/**
 * Resource types
 */
export enum ResourceType {
  USER = 'user',
  ROLE = 'role',
  PERMISSION = 'permission',
  API_KEY = 'api_key',
  SESSION = 'session',
  WORKSPACE = 'workspace',
  PROJECT = 'project',
  DATASET = 'dataset',
  MODEL = 'model',
  WORKFLOW = 'workflow',
  INTEGRATION = 'integration',
  CONFIGURATION = 'configuration',
  AUDIT_LOG = 'audit_log',
  REPORT = 'report',
  DATABASE = 'database',
  BUCKET = 'bucket',
  QUEUE = 'queue',
  SECRET = 'secret',
  CERTIFICATE = 'certificate',
  KEY = 'key',
  TOKEN = 'token',
  POLICY = 'policy',
  RULE = 'rule',
  NETWORK = 'network',
  FIREWALL = 'firewall'
}

/**
 * Base audit event schema
 */
export const BaseAuditEventSchema = z.object({
  // Event identification
  id: z.string().uuid(),
  eventType: z.nativeEnum(AuditEventType),
  timestamp: z.string().datetime(),
  sequenceNumber: z.number().int().positive(),

  // Actor information
  actor: z.object({
    id: z.string(),
    type: z.nativeEnum(ActorType),
    name: z.string().optional(),
    ipAddress: z.string().ip().optional(),
    userAgent: z.string().optional(),
    sessionId: z.string().optional()
  }),

  // Resource information
  resource: z.object({
    type: z.nativeEnum(ResourceType),
    id: z.string(),
    name: z.string().optional(),
    ownerId: z.string().optional()
  }).optional(),

  // Event details
  outcome: z.nativeEnum(EventOutcome),
  severity: z.nativeEnum(EventSeverity),

  // Compliance mappings
  complianceFrameworks: z.array(z.nativeEnum(ComplianceFramework)).default([]),
  soc2TrustServices: z.array(z.nativeEnum(SOC2TrustService)).default([]),
  iso27001Domains: z.array(z.nativeEnum(ISO27001Domain)).default([]),

  // Additional context
  description: z.string(),
  details: z.record(z.any()).optional(),
  metadata: z.record(z.string()).optional(),
  tags: z.array(z.string()).default([]),

  // Geolocation
  location: z.object({
    country: z.string().optional(),
    region: z.string().optional(),
    city: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional()
  }).optional(),

  // Correlation
  correlationId: z.string().uuid().optional(),
  parentEventId: z.string().uuid().optional(),
  requestId: z.string().optional(),

  // Integrity
  checksum: z.string(),
  signature: z.string().optional(),

  // Retention
  retentionUntil: z.string().datetime().optional(),
  isArchived: z.boolean().default(false),
  isImmutable: z.boolean().default(true)
});

export type BaseAuditEvent = z.infer<typeof BaseAuditEventSchema>;

/**
 * Authentication event schema
 */
export const AuthEventSchema = BaseAuditEventSchema.extend({
  eventType: z.nativeEnum(AuditEventType).refine(
    (val) => val.startsWith('auth.'),
    { message: 'Must be an authentication event' }
  ),
  details: z.object({
    method: z.enum(['password', 'oauth', 'saml', 'api_key', 'mfa', 'sso']),
    provider: z.string().optional(),
    mfaType: z.enum(['totp', 'sms', 'email', 'hardware_key', 'biometric']).optional(),
    failedReason: z.string().optional(),
    sessionDuration: z.number().optional(),
    tokenExpiry: z.string().datetime().optional()
  }).optional()
});

export type AuthEvent = z.infer<typeof AuthEventSchema>;

/**
 * Authorization event schema
 */
export const AuthzEventSchema = BaseAuditEventSchema.extend({
  eventType: z.nativeEnum(AuditEventType).refine(
    (val) => val.startsWith('authz.'),
    { message: 'Must be an authorization event' }
  ),
  details: z.object({
    permission: z.string().optional(),
    role: z.string().optional(),
    previousRole: z.string().optional(),
    previousPermission: z.string().optional(),
    reason: z.string().optional(),
    approver: z.string().optional(),
    constraints: z.array(z.string()).optional()
  }).optional()
});

export type AuthzEvent = z.infer<typeof AuthzEventSchema>;

/**
 * Data event schema
 */
export const DataEventSchema = BaseAuditEventSchema.extend({
  eventType: z.nativeEnum(AuditEventType).refine(
    (val) => val.startsWith('data.'),
    { message: 'Must be a data event' }
  ),
  details: z.object({
    dataType: z.string(),
    recordCount: z.number().int().optional(),
    dataSize: z.number().int().optional(),
    dataClass: z.string().optional(),
    query: z.string().optional(),
    format: z.enum(['json', 'csv', 'xml', 'parquet', 'excel']).optional(),
    destination: z.string().optional(),
    source: z.string().optional(),
    retentionPeriod: z.string().optional(),
    encryptionStatus: z.enum(['encrypted', 'plaintext', 'mixed']).optional()
  }).optional()
});

export type DataEvent = z.infer<typeof DataEventSchema>;

/**
 * System event schema
 */
export const SystemEventSchema = BaseAuditEventSchema.extend({
  eventType: z.nativeEnum(AuditEventType).refine(
    (val) => val.startsWith('system.'),
    { message: 'Must be a system event' }
  ),
  details: z.object({
    component: z.string(),
    version: z.string().optional(),
    previousVersion: z.string().optional(),
    environment: z.enum(['development', 'staging', 'production']),
    deploymentId: z.string().optional(),
    errorMessage: z.string().optional(),
    stackTrace: z.string().optional(),
    metrics: z.record(z.number()).optional(),
    duration: z.number().optional()
  }).optional()
});

export type SystemEvent = z.infer<typeof SystemEventSchema>;

/**
 * Security event schema
 */
export const SecurityEventSchema = BaseAuditEventSchema.extend({
  eventType: z.nativeEnum(AuditEventType).refine(
    (val) => val.startsWith('security.'),
    { message: 'Must be a security event' }
  ),
  details: z.object({
    threatType: z.string().optional(),
    severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    sourceIp: z.string().ip().optional(),
    targetIp: z.string().ip().optional(),
    port: z.number().int().optional(),
    protocol: z.string().optional(),
    indicators: z.array(z.string()).optional(),
    mitigation: z.string().optional(),
    blocked: z.boolean().optional(),
    incidentId: z.string().optional()
  }).optional()
});

export type SecurityEvent = z.infer<typeof SecurityEventSchema>;

/**
 * Compliance event schema
 */
export const ComplianceEventSchema = BaseAuditEventSchema.extend({
  eventType: z.nativeEnum(AuditEventType).refine(
    (val) => val.startsWith('compliance.'),
    { message: 'Must be a compliance event' }
  ),
  details: z.object({
    framework: z.nativeEnum(ComplianceFramework),
    control: z.string(),
    requirement: z.string().optional(),
    status: z.enum(['compliant', 'non_compliant', 'partial']),
    findings: z.array(z.string()).optional(),
    remediationPlan: z.string().optional(),
    assessor: z.string().optional(),
    assessmentDate: z.string().datetime().optional(),
    nextReviewDate: z.string().datetime().optional()
  }).optional()
});

export type ComplianceEvent = z.infer<typeof ComplianceEventSchema>;

/**
 * Audit log batch for efficient storage
 */
export const AuditLogBatchSchema = z.object({
  batchId: z.string().uuid(),
  timestamp: z.string().datetime(),
  events: z.array(BaseAuditEventSchema),
  checksum: z.string(),
  signature: z.string().optional(),
  metadata: z.object({
    source: z.string(),
    environment: z.string(),
    version: z.string(),
    sequenceStart: z.number().int(),
    sequenceEnd: z.number().int(),
    eventCount: z.number().int()
  })
});

export type AuditLogBatch = z.infer<typeof AuditLogBatchSchema>;

/**
 * Audit query parameters
 */
export const AuditQueryParamsSchema = z.object({
  eventType: z.nativeEnum(AuditEventType).optional(),
  eventTypes: z.array(z.nativeEnum(AuditEventType)).optional(),
  actorId: z.string().optional(),
  actorType: z.nativeEnum(ActorType).optional(),
  resourceType: z.nativeEnum(ResourceType).optional(),
  resourceId: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  severity: z.nativeEnum(EventSeverity).optional(),
  outcome: z.nativeEnum(EventOutcome).optional(),
  complianceFramework: z.nativeEnum(ComplianceFramework).optional(),
  soc2TrustService: z.nativeEnum(SOC2TrustService).optional(),
  iso27001Domain: z.nativeEnum(ISO27001Domain).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(10000).default(100),
  offset: z.number().int().nonnegative().default(0),
  sortBy: z.enum(['timestamp', 'severity', 'eventType', 'actorId']).default('timestamp'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export type AuditQueryParams = z.infer<typeof AuditQueryParamsSchema>;

/**
 * Audit query result
 */
export const AuditQueryResultSchema = z.object({
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  events: z.array(BaseAuditEventSchema),
  aggregations: z.object({
    byEventType: z.record(z.number()).optional(),
    bySeverity: z.record(z.number()).optional(),
    byActorType: z.record(z.number()).optional(),
    byResourceType: z.record(z.number()).optional(),
    byOutcome: z.record(z.number()).optional(),
    byTime: z.array(z.object({
      timestamp: z.string().datetime(),
      count: z.number().int()
    })).optional()
  }).optional()
});

export type AuditQueryResult = z.infer<typeof AuditQueryResultSchema>;

/**
 * Compliance report schema
 */
export const ComplianceReportSchema = z.object({
  id: z.string().uuid(),
  reportType: z.enum([
    'soc2_type2',
    'iso27001',
    'gdpr',
    'hipaa',
    'pci_dss',
    'custom'
  ]),
  framework: z.nativeEnum(ComplianceFramework),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  generatedAt: z.string().datetime(),
  generatedBy: z.string(),

  status: z.enum(['in_progress', 'completed', 'failed', 'approved']),

  summary: z.object({
    totalEvents: z.number().int(),
    compliantEvents: z.number().int(),
    nonCompliantEvents: z.number().int(),
    compliancePercentage: z.number().min(0).max(100),
    criticalFindings: z.number().int(),
    highFindings: z.number().int(),
    mediumFindings: z.number().int(),
    lowFindings: z.number().int()
  }),

  findings: z.array(z.object({
    id: z.string().uuid(),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    category: z.string(),
    control: z.string(),
    description: z.string(),
    evidence: z.array(z.string()),
    remediation: z.string().optional(),
    status: z.enum(['open', 'in_progress', 'resolved', 'accepted_risk']),
    discoveredAt: z.string().datetime(),
    resolvedAt: z.string().datetime().optional()
  })),

  controls: z.array(z.object({
    controlId: z.string(),
    controlName: z.string(),
    status: z.enum(['compliant', 'non_compliant', 'partial', 'not_applicable']),
    lastTested: z.string().datetime().optional(),
    nextReview: z.string().datetime().optional(),
    evidenceCount: z.number().int(),
    findings: z.array(z.string())
  })),

  recommendations: z.array(z.object({
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    title: z.string(),
    description: z.string(),
    estimatedEffort: z.string().optional(),
    dueDate: z.string().datetime().optional()
  })),

  metadata: z.object({
    version: z.string(),
    templateId: z.string().optional(),
    approvers: z.array(z.string()),
    reviewedBy: z.array(z.string()),
    reviewComments: z.array(z.string()).optional(),
    attachments: z.array(z.object({
      name: z.string(),
      type: z.string(),
      url: z.string(),
      size: z.number().int()
    })).optional()
  }),

  checksum: z.string(),
  signature: z.string().optional()
});

export type ComplianceReport = z.infer<typeof ComplianceReportSchema>;

/**
 * Change history entry
 */
export const ChangeHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  changedBy: z.object({
    id: z.string(),
    name: z.string(),
    type: z.nativeEnum(ActorType)
  }),

  entityType: z.nativeEnum(ResourceType),
  entityId: z.string(),
  entityName: z.string().optional(),

  changeType: z.enum([
    'created',
    'modified',
    'deleted',
    'restored',
    'archived'
  ]),

  changes: z.array(z.object({
    field: z.string(),
    oldValue: z.any().optional(),
    newValue: z.any().optional(),
    changeType: z.enum(['added', 'removed', 'modified'])
  })),

  reason: z.string().optional(),
  requestId: z.string().optional(),
  rollbackId: z.string().optional()
});

export type ChangeHistoryEntry = z.infer<typeof ChangeHistoryEntrySchema>;
