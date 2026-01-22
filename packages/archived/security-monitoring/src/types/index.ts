/**
 * Core type definitions for Security Monitoring Package
 * Defines all security event types, threat levels, and data structures
 */

import { z } from 'zod';

// ============================================================================
// ENUMS
// ============================================================================

export enum SecurityEventType {
  // Authentication & Authorization
  AUTH_LOGIN_SUCCESS = 'auth.login.success',
  AUTH_LOGIN_FAILURE = 'auth.login.failure',
  AUTH_LOGOUT = 'auth.logout',
  AUTH_PASSWORD_CHANGE = 'auth.password.change',
  AUTH_PASSWORD_RESET = 'auth.password.reset',
  AUTH_MFA_ENABLED = 'auth.mfa.enabled',
  AUTH_MFA_DISABLED = 'auth.mfa.disabled',
  AUTH_TOKEN_ISSUED = 'auth.token.issued',
  AUTH_TOKEN_REVOKED = 'auth.token.revoked',
  AUTH_SESSION_CREATED = 'auth.session.created',
  AUTH_SESSION_TERMINATED = 'auth.session.terminated',
  AUTH_PRIVILEGE_ESCALATION = 'auth.privilege.escalation',
  AUTH_ROLE_ASSIGNED = 'auth.role.assigned',
  AUTH_ROLE_REVOKED = 'auth.role.revoked',

  // Access Control
  ACCESS_GRANTED = 'access.granted',
  ACCESS_DENIED = 'access.denied',
  ACCESS_ATTEMPT = 'access.attempt',
  RESOURCE_ACCESS = 'resource.access',
  DATA_ACCESS = 'data.access',
  API_ACCESS = 'api.access',

  // Data Security
  DATA_ENCRYPTED = 'data.encrypted',
  DATA_DECRYPTED = 'data.decrypted',
  DATA_EXPORTED = 'data.exported',
  DATA_IMPORTED = 'data.imported',
  DATA_DELETED = 'data.deleted',
  DATA_MODIFIED = 'data.modified',
  DATA_COPIED = 'data.copied',
  PII_ACCESSED = 'pii.accessed',
  PII_MODIFIED = 'pii.modified',

  // Network Security
  NETWORK_CONNECTION = 'network.connection',
  NETWORK_DISCONNECTION = 'network.disconnection',
  NETWORK_TRAFFIC = 'network.traffic',
  NETWORK_SCAN = 'network.scan',
  PORT_SCAN = 'port.scan',
  DDOS_ATTEMPT = 'ddos.attempt',
  INTRUSION_DETECTED = 'intrusion.detected',
  MALWARE_DETECTED = 'malware.detected',

  // Application Security
  APP_STARTUP = 'app.startup',
  APP_SHUTDOWN = 'app.shutdown',
  APP_ERROR = 'app.error',
  APP_EXCEPTION = 'app.exception',
  APP_DEPLOYMENT = 'app.deployment',
  APP_CONFIG_CHANGE = 'app.config.change',

  // Vulnerability Management
  VULN_DISCOVERED = 'vuln.discovered',
  VULN_SCANNED = 'vuln.scanned',
  VULN_PATCHED = 'vuln.patched',
  VULN_REPORTED = 'vuln.reported',

  // Threat Detection
  THREAT_DETECTED = 'threat.detected',
  THREAT_BLOCKED = 'threat.blocked',
  THREAT_INVESTIGATED = 'threat.investigated',
  ANOMALY_DETECTED = 'anomaly.detected',

  // Incident Response
  INCIDENT_CREATED = 'incident.created',
  INCIDENT_UPDATED = 'incident.updated',
  INCIDENT_RESOLVED = 'incident.resolved',
  INCIDENT_CLOSED = 'incident.closed',

  // Compliance
  COMPLIANCE_CHECK = 'compliance.check',
  COMPLIANCE_PASS = 'compliance.pass',
  COMPLIANCE_FAIL = 'compliance.fail',
  AUDIT_LOG_ACCESSED = 'audit.log.accessed',

  // System & Infrastructure
  SYSTEM_BACKUP = 'system.backup',
  SYSTEM_RESTORE = 'system.restore',
  SYSTEM_MAINTENANCE = 'system.maintenance',
  CONFIGURATION_CHANGE = 'configuration.change',
  PERMISSION_CHANGE = 'permission.change',

  // File & Storage
  FILE_UPLOADED = 'file.uploaded',
  FILE_DOWNLOADED = 'file.downloaded',
  FILE_SHARED = 'file.shared',
  STORAGE_LIMIT_REACHED = 'storage.limit.reached',

  // Code & Repository
  CODE_COMMIT = 'code.commit',
  CODE_PUSH = 'code.push',
  CODE_MERGE = 'code.merge',
  CODE_DEPLOYMENT = 'code.deployment',
  REPO_ACCESS = 'repo.access',
  REPO_FORK = 'repo.fork',
  REPO_CLONE = 'repo.clone',

  // API & Integration
  API_CALL = 'api.call',
  API_ERROR = 'api.error',
  API_RATE_LIMIT = 'api.rate.limit',
  WEBHOOK_RECEIVED = 'webhook.received',
  WEBHOOK_FAILED = 'webhook.failed',

  // Container & Orchestration
 _CONTAINER_CREATED = 'container.created',
  container_DELETED = 'container.deleted',
  CONTAINER_ESCALATION = 'container.escalation',
  K8S_API_CALL = 'k8s.api.call',

  // Monitoring & Alerting
  ALERT_TRIGGERED = 'alert.triggered',
  ALERT_ACKNOWLEDGED = 'alert.acknowledged',
  ALERT_RESOLVED = 'alert.resolved',
  METRIC_THRESHOLD = 'metric.threshold'
}

export enum SecurityEventSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export enum ThreatType {
  MALWARE = 'malware',
  PHISHING = 'phishing',
  DDOS = 'ddos',
  INJECTION = 'injection',
  XSS = 'xss',
  CSRF = 'csrf',
  BRUTE_FORCE = 'brute_force',
  SQL_INJECTION = 'sql_injection',
  XSS_ATTACK = 'xss_attack',
  PATH_TRAVERSAL = 'path_traversal',
  COMMAND_INJECTION = 'command_injection',
  MITM = 'mitm',
  PORT_SCAN = 'port_scan',
  SOCIAL_ENGINEERING = 'social_engineering',
  INSIDER_THREAT = 'insider_threat',
  DATA_EXFILTRATION = 'data_exfiltration',
  ZERO_DAY = 'zero_day',
  RANSOMWARE = 'ransomware',
  CRYPTO_MINING = 'crypto_mining',
  BOTNET = 'botnet',
  APT = 'apt',
  UNKNOWN = 'unknown'
}

export enum ThreatLevel {
  CRITICAL = 5,
  HIGH = 4,
  MEDIUM = 3,
  LOW = 2,
  MINIMAL = 1
}

export enum VulnerabilitySeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export enum VulnerabilityStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  FIXED = 'fixed',
  IGNORED = 'ignored',
  FALSE_POSITIVE = 'false_positive'
}

export enum ComplianceFramework {
  SOC_2 = 'soc_2',
  ISO_27001 = 'iso_27001',
  GDPR = 'gdpr',
  HIPAA = 'hipaa',
  PCI_DSS = 'pci_dss',
  NIST_800_53 = 'nist_800_53',
  CIS_CONTROLS = 'cis_controls'
}

export enum ComplianceStatus {
  COMPLIANT = 'compliant',
  NON_COMPLIANT = 'non_compliant',
  PARTIALLY_COMPLIANT = 'partially_compliant',
  PENDING_REVIEW = 'pending_review'
}

export enum IncidentStatus {
  OPEN = 'open',
  INVESTIGATING = 'investigating',
  CONTAINING = 'containing',
  REMEDIATING = 'remediating',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

export enum IncidentPriority {
  P1 = 'p1', // Critical - immediate response required
  P2 = 'p2', // High - response within 1 hour
  P3 = 'p3', // Medium - response within 4 hours
  P4 = 'p4', // Low - response within 24 hours
  P5 = 'p5'  // Informational - response within 72 hours
}

// ============================================================================
// INTERFACES
// ============================================================================

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  timestamp: Date;
  source: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  outcome: 'success' | 'failure' | 'partial';
  details: Record<string, unknown>;
  metadata: EventMetadata;
  tags?: string[];
  correlationId?: string;
  eventId?: string;
}

export interface EventMetadata {
  hostname?: string;
  environment?: string;
  service?: string;
  version?: string;
  region?: string;
  accountId?: string;
  projectId?: string;
  requestId?: string;
  traceId?: string;
}

export interface EnrichedSecurityEvent extends SecurityEvent {
  enriched: true;
  enrichmentData: EnrichmentData;
  riskScore: number;
  mitreTechniques?: string[];
}

export interface EnrichmentData {
  geoLocation?: GeoLocation;
  threatIntelligence?: ThreatIntelligence;
  userBehavior?: UserBehavior;
  historicalData?: HistoricalData;
  contextualData?: ContextualData;
}

export interface GeoLocation {
  country: string;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  isp?: string;
  asn?: number;
}

export interface ThreatIntelligence {
  knownAttacker: boolean;
  reputationScore: number;
  indicators: string[];
  relatedCampaigns?: string[];
  firstSeen?: Date;
  lastSeen?: Date;
}

export interface UserBehavior {
  isNewLocation: boolean;
  isNewDevice: boolean;
  isUnusualTime: boolean;
  isUnusualPattern: boolean;
  riskScore: number;
  baselineDeviation: number;
}

export interface HistoricalData {
  previousEvents: number;
  similarEvents: number;
  frequency: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  lastOccurrence?: Date;
}

export interface ContextualData {
  relatedEvents?: string[];
  relatedIncidents?: string[];
  relatedAlerts?: string[];
  dependencies?: string[];
}

export interface Threat {
  id: string;
  type: ThreatType;
  level: ThreatLevel;
  severity: SecurityEventSeverity;
  status: 'detected' | 'investigating' | 'blocking' | 'blocked' | 'false_positive';
  timestamp: Date;
  source: string;
  description: string;
  indicators: ThreatIndicator[];
  affectedAssets: string[];
  mitigation?: string;
  assignedTo?: string;
  eventId?: string;
  incidentId?: string;
  confidence: number;
  falsePositiveScore: number;
  metadata: Record<string, unknown>;
}

export interface ThreatIndicator {
  type: 'ip' | 'domain' | 'url' | 'hash' | 'email' | 'pattern' | 'signature';
  value: string;
  severity: SecurityEventSeverity;
  description?: string;
  firstSeen: Date;
  lastSeen: Date;
  occurrences: number;
}

export interface Vulnerability {
  id: string;
  cveId?: string;
  title: string;
  description: string;
  severity: VulnerabilitySeverity;
  cvssScore?: number;
  cvssVector?: string;
  status: VulnerabilityStatus;
  discoveredDate: Date;
  publishedDate?: Date;
  modifiedDate?: Date;
  affectedComponents: AffectedComponent[];
  remediation?: Remediation;
  references?: string[];
  tags?: string[];
  source: string;
  scanner: string;
  falsePositive?: boolean;
  suppressed?: boolean;
  suppressionReason?: string;
}

export interface AffectedComponent {
  type: 'dependency' | 'code' | 'configuration' | 'container' | 'infrastructure';
  name: string;
  version?: string;
  path?: string;
  language?: string;
  platform?: string;
}

export interface Remediation {
  type: 'upgrade' | 'patch' | 'configuration' | 'code_change' | 'workaround';
  description: string;
  steps: string[];
  estimatedEffort?: string;
  priority: number;
  automated: boolean;
}

export interface ComplianceCheck {
  id: string;
  framework: ComplianceFramework;
  control: string;
  requirement: string;
  status: ComplianceStatus;
  lastChecked: Date;
  nextCheck: Date;
  findings: ComplianceFinding[];
  score: number;
  maxScore: number;
  auditor?: string;
  notes?: string;
}

export interface ComplianceFinding {
  id: string;
  severity: SecurityEventSeverity;
  category: string;
  description: string;
  evidence: string[];
  status: 'open' | 'in_progress' | 'resolved' | 'accepted';
  assignedTo?: string;
  dueDate?: Date;
  remediationPlan?: string;
}

export interface ComplianceReport {
  id: string;
  framework: ComplianceFramework;
  period: {
    start: Date;
    end: Date;
  };
  overallStatus: ComplianceStatus;
  score: number;
  checks: ComplianceCheck[];
  findings: ComplianceFinding[];
  recommendations: string[];
  generatedAt: Date;
  generatedBy: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  severity: SecurityEventSeverity;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  detectedBy: string;
  assignedTo?: string;
  type: ThreatType;
  stage: 'preparation' | 'delivery' | 'exploitation' | 'installation' | 'c2' | 'actions' | 'objectives';
  killChain?: string[];
  relatedEvents: string[];
  relatedThreats: string[];
  relatedVulnerabilities: string[];
  timeline: IncidentTimeline[];
  actions: IncidentAction[];
  artifacts: Artifact[];
  impact: ImpactAssessment;
  lessonsLearned?: string;
  rootCauseAnalysis?: string;
}

export interface IncidentTimeline {
  timestamp: Date;
  action: string;
  description: string;
  performedBy?: string;
}

export interface IncidentAction {
  id: string;
  timestamp: Date;
  action: string;
  performedBy: string;
  description: string;
  outcome: 'success' | 'failure' | 'partial';
  details?: Record<string, unknown>;
}

export interface Artifact {
  type: 'ip' | 'domain' | 'url' | 'file' | 'hash' | 'email' | 'registry' | 'process' | 'command';
  value: string;
  description?: string;
  ioc?: boolean;
  extractedAt: Date;
}

export interface ImpactAssessment {
  confidentiality: number; // 0-5 scale
  integrity: number; // 0-5 scale
  availability: number; // 0-5 scale;
  affectedUsers: number;
  affectedSystems: string[];
  dataExposed?: boolean;
  dataLost?: boolean;
  serviceDisruption?: boolean;
  financialImpact?: number;
}

export interface SecurityMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  dimensions: Record<string, string>;
}

export interface SecurityAlert {
  id: string;
  rule: string;
  severity: SecurityEventSeverity;
  status: 'open' | 'acknowledged' | 'resolved' | 'suppressed';
  timestamp: Date;
  title: string;
  description: string;
  source: string;
  events: string[];
  threshold?: AlertThreshold;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
}

export interface AlertThreshold {
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
  value: number | string;
  window: number; // seconds
}

export interface SecurityDashboard {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  refreshInterval: number;
  lastUpdated: Date;
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'log' | 'map' | 'timeline';
  title: string;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  config: Record<string, unknown>;
  dataSource: string;
  query?: string;
  refreshInterval?: number;
}

export interface DetectionRule {
  id: string;
  name: string;
  description: string;
  type: 'pattern' | 'anomaly' | 'behavioral' | 'ml';
  enabled: boolean;
  severity: SecurityEventSeverity;
  conditions: DetectionCondition[];
  actions: DetectionAction[];
  falsePositiveRate: number;
  detectionRate: number;
  lastTuned: Date;
  version: number;
}

export interface DetectionCondition {
  field: string;
  operator: 'contains' | 'equals' | 'matches' | 'gt' | 'lt' | 'in' | 'not_in';
  value: unknown;
  negate?: boolean;
}

export interface DetectionAction {
  type: 'alert' | 'block' | 'quarantine' | 'notify' | 'log' | 'custom';
  config: Record<string, unknown>;
}

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const SecurityEventSchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(SecurityEventType),
  severity: z.nativeEnum(SecurityEventSeverity),
  timestamp: z.date(),
  source: z.string(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
  resource: z.string().optional(),
  action: z.string().optional(),
  outcome: z.enum(['success', 'failure', 'partial']),
  details: z.record(z.unknown()),
  metadata: z.object({
    hostname: z.string().optional(),
    environment: z.string().optional(),
    service: z.string().optional(),
    version: z.string().optional(),
    region: z.string().optional(),
    accountId: z.string().optional(),
    projectId: z.string().optional(),
    requestId: z.string().optional(),
    traceId: z.string().optional(),
  }),
  tags: z.array(z.string()).optional(),
  correlationId: z.string().optional(),
  eventId: z.string().optional(),
});

export const ThreatSchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(ThreatType),
  level: z.nativeEnum(ThreatLevel),
  severity: z.nativeEnum(SecurityEventSeverity),
  status: z.enum(['detected', 'investigating', 'blocking', 'blocked', 'false_positive']),
  timestamp: z.date(),
  source: z.string(),
  description: z.string(),
  indicators: z.array(z.object({
    type: z.enum(['ip', 'domain', 'url', 'hash', 'email', 'pattern', 'signature']),
    value: z.string(),
    severity: z.nativeEnum(SecurityEventSeverity),
    description: z.string().optional(),
    firstSeen: z.date(),
    lastSeen: z.date(),
    occurrences: z.number(),
  })),
  affectedAssets: z.array(z.string()),
  mitigation: z.string().optional(),
  assignedTo: z.string().optional(),
  eventId: z.string().optional(),
  incidentId: z.string().optional(),
  confidence: z.number().min(0).max(1),
  falsePositiveScore: z.number().min(0).max(1),
  metadata: z.record(z.unknown()),
});

export const VulnerabilitySchema = z.object({
  id: z.string().uuid(),
  cveId: z.string().optional(),
  title: z.string(),
  description: z.string(),
  severity: z.nativeEnum(VulnerabilitySeverity),
  cvssScore: z.number().min(0).max(10).optional(),
  cvssVector: z.string().optional(),
  status: z.nativeEnum(VulnerabilityStatus),
  discoveredDate: z.date(),
  publishedDate: z.date().optional(),
  modifiedDate: z.date().optional(),
  affectedComponents: z.array(z.object({
    type: z.enum(['dependency', 'code', 'configuration', 'container', 'infrastructure']),
    name: z.string(),
    version: z.string().optional(),
    path: z.string().optional(),
    language: z.string().optional(),
    platform: z.string().optional(),
  })),
  remediation: z.object({
    type: z.enum(['upgrade', 'patch', 'configuration', 'code_change', 'workaround']),
    description: z.string(),
    steps: z.array(z.string()),
    estimatedEffort: z.string().optional(),
    priority: z.number(),
    automated: z.boolean(),
  }).optional(),
  references: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  source: z.string(),
  scanner: z.string(),
  falsePositive: z.boolean().optional(),
  suppressed: z.boolean().optional(),
  suppressionReason: z.string().optional(),
});

export const IncidentSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  status: z.nativeEnum(IncidentStatus),
  priority: z.nativeEnum(IncidentPriority),
  severity: z.nativeEnum(SecurityEventSeverity),
  createdAt: z.date(),
  updatedAt: z.date(),
  resolvedAt: z.date().optional(),
  closedAt: z.date().optional(),
  detectedBy: z.string(),
  assignedTo: z.string().optional(),
  type: z.nativeEnum(ThreatType),
  stage: z.enum(['preparation', 'delivery', 'exploitation', 'installation', 'c2', 'actions', 'objectives']).optional(),
  killChain: z.array(z.string()).optional(),
  relatedEvents: z.array(z.string()),
  relatedThreats: z.array(z.string()),
  relatedVulnerabilities: z.array(z.string()),
  timeline: z.array(z.object({
    timestamp: z.date(),
    action: z.string(),
    description: z.string(),
    performedBy: z.string().optional(),
  })),
  actions: z.array(z.object({
    id: z.string(),
    timestamp: z.date(),
    action: z.string(),
    performedBy: z.string(),
    description: z.string(),
    outcome: z.enum(['success', 'failure', 'partial']),
    details: z.record(z.unknown()).optional(),
  })),
  artifacts: z.array(z.object({
    type: z.enum(['ip', 'domain', 'url', 'file', 'hash', 'email', 'registry', 'process', 'command']),
    value: z.string(),
    description: z.string().optional(),
    ioc: z.boolean().optional(),
    extractedAt: z.date(),
  })),
  impact: z.object({
    confidentiality: z.number().min(0).max(5),
    integrity: z.number().min(0).max(5),
    availability: z.number().min(0).max(5),
    affectedUsers: z.number(),
    affectedSystems: z.array(z.string()),
    dataExposed: z.boolean().optional(),
    dataLost: z.boolean().optional(),
    serviceDisruption: z.boolean().optional(),
    financialImpact: z.number().optional(),
  }),
  lessonsLearned: z.string().optional(),
  rootCauseAnalysis: z.string().optional(),
});
