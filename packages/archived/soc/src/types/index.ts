/**
 * SOC (Security Operations Center) Type Definitions
 * Comprehensive types for threat detection, SIEM, incident response, vulnerability management
 */

import { z } from 'zod';

// ============================================================================
// Core Types
// ============================================================================

export type ThreatLevel = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type IncidentStatus = 'open' | 'investigating' | 'containing' | 'eradicating' | 'recovering' | 'resolved' | 'closed';
export type DetectionMethod = 'signature' | 'anomaly' | 'behavioral' | 'heuristic' | 'ml';
export type ResponseAction = 'block' | 'allow' | 'quarantine' | 'alert' | 'log' | 'isolate';

// ============================================================================
// Threat Detection Types
// ============================================================================

export enum ThreatType {
  SQL_INJECTION = 'sql_injection',
  XSS_ATTACK = 'xss_attack',
  CSRF_ATTACK = 'csrf_attack',
  DDOS_ATTACK = 'ddos_attack',
  BRUTE_FORCE = 'brute_force',
  DATA_EXFILTRATION = 'data_exfiltration',
  MALWARE = 'malware',
  PHISHING = 'phishing',
  INTRUSION = 'intrusion',
  COMMAND_INJECTION = 'command_injection',
  PATH_TRAVERSAL = 'path_traversal',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  ZERO_DAY = 'zero_day',
  ADVANCED_PERSISTENT_THREAT = 'apt',
  INSIDER_THREAT = 'insider_threat',
  SOCIAL_ENGINEERING = 'social_engineering',
  SUPPLY_CHAIN = 'supply_chain',
  CRYPTO_JACKING = 'crypto_jacking',
  RANSOMWARE = 'ransomware'
}

export interface ThreatIndicator {
  id: string;
  type: 'ip' | 'domain' | 'url' | 'hash' | 'email' | 'pattern' | 'signature';
  value: string;
  severity: ThreatLevel;
  confidence: number; // 0-1
  source: string;
  description: string;
  expiresAt?: number;
  tags: string[];
  firstSeen: number;
  lastSeen: number;
  sightings: number;
  isActive: boolean;
}

export interface ThreatSignature {
  id: string;
  name: string;
  pattern: RegExp | string;
  category: ThreatType;
  severity: ThreatLevel;
  description: string;
  references: string[];
  version: string;
  createdAt: number;
  updatedAt: number;
  enabled: boolean;
}

export interface ThreatDetection {
  id: string;
  threatType: ThreatType;
  detectionMethod: DetectionMethod;
  severity: ThreatLevel;
  confidence: number;
  timestamp: number;
  source: {
    ip: string;
    userAgent?: string;
    userId?: string;
    sessionId?: string;
  };
  target: {
    resource: string;
    endpoint?: string;
    method?: string;
  };
  indicators: ThreatIndicator[];
  evidence: Record<string, any>;
  context: {
    requestHeaders?: Record<string, string>;
    requestBody?: any;
    queryParams?: Record<string, string>;
    path?: string;
  };
  matchedSignatures: string[];
  anomalyScore?: number;
  behaviorScore?: number;
  isBlocked: boolean;
  isFalsePositive?: boolean;
  assignedTo?: string;
  notes?: string;
}

export interface AnomalyBaseline {
  metric: string;
  timeWindow: number; // milliseconds
  thresholds: {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
  };
  dataSource: string;
  lastUpdated: number;
  sampleSize: number;
}

export interface AnomalyDetection {
  id: string;
  metric: string;
  currentValue: number;
  expectedRange: [number, number];
  deviationScore: number; // z-score
  severity: ThreatLevel;
  timestamp: number;
  description: string;
  relatedMetrics: string[];
  contributingFactors: string[];
}

// ============================================================================
// SIEM Types
// ============================================================================

export enum LogSourceType {
  APPLICATION = 'application',
  SYSTEM = 'system',
  SECURITY = 'security',
  NETWORK = 'network',
  DATABASE = 'database',
  FIREWALL = 'firewall',
  WAF = 'waf',
  IDS = 'ids',
  IPS = 'ips',
  AUTHENTICATION = 'authentication',
  AUDIT = 'audit',
  CUSTOM = 'custom'
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  source: LogSourceType;
  sourceIp?: string;
  message: string;
  details: Record<string, any>;
  tags: string[];
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  hostname?: string;
  environment?: string;
  parsedData?: Record<string, any>;
  normalizedData?: Record<string, any>;
}

export interface LogParser {
  name: string;
  pattern: RegExp;
  fieldMappings: Record<string, string>;
  sampleLog: string;
  description: string;
}

export interface LogCorrelationRule {
  id: string;
  name: string;
  description: string;
  conditions: CorrelationCondition[];
  timeWindow: number; // milliseconds
  threshold: number;
  severity: ThreatLevel;
  enabled: boolean;
  actions: ResponseAction[];
}

export interface CorrelationCondition {
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'gt' | 'lt' | 'gte' | 'lte' | 'in';
  value: any;
}

export interface CorrelatedEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  events: LogEntry[];
  matchCount: number;
  firstEvent: number;
  lastEvent: number;
  severity: ThreatLevel;
  confidence: number;
  description: string;
  indicators: string[];
  status: IncidentStatus;
}

export interface SIEMAlert {
  id: string;
  title: string;
  description: string;
  severity: ThreatLevel;
  status: IncidentStatus;
  createdAt: number;
  updatedAt: number;
  assignedTo?: string;
  correlatedEvent?: CorrelatedEvent;
  threatDetection?: ThreatDetection;
  incidents: string[];
  tags: string[];
  metadata: Record<string, any>;
}

// ============================================================================
// Incident Response Types
// ============================================================================

export interface Incident {
  id: string;
  title: string;
  description: string;
  type: ThreatType;
  severity: ThreatLevel;
  status: IncidentStatus;
  phase: 'detection' | 'analysis' | 'containment' | 'eradication' | 'recovery' | 'post_incident';
  priority: 'p1' | 'p2' | 'p3' | 'p4';
  createdAt: number;
  detectedAt: number;
  acknowledgedAt?: number;
  containedAt?: number;
  eradicatedAt?: number;
  resolvedAt?: number;
  closedAt?: number;
  assignedTo?: string;
  team: string[];
  detections: string[]; // Detection IDs
  alerts: string[]; // Alert IDs
  affectedAssets: AffectedAsset[];
  timeline: IncidentTimeline[];
  actions: ResponseActionRecord[];
  rootCause?: string;
  lessonsLearned?: string;
  recommendations: string[];
  tags: string[];
  metadata: Record<string, any>;
}

export interface AffectedAsset {
  type: 'server' | 'database' | 'application' | 'network' | 'user' | 'data';
  identifier: string;
  name: string;
  impact: string;
  isCompromised: boolean;
  isolationStatus: 'not_isolated' | 'isolated' | 'partially_isolated';
}

export interface IncidentTimeline {
  timestamp: number;
  phase: string;
  event: string;
  description: string;
  actor?: string;
  evidence?: Record<string, any>;
}

export interface ResponseActionRecord {
  id: string;
  action: ResponseAction;
  target: string;
  executedAt: number;
  executedBy: string | 'system';
  result: 'success' | 'failed' | 'partial';
  details: string;
  automated: boolean;
  rollbackPossible: boolean;
  rollbackAction?: string;
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  threatType: ThreatType;
  version: string;
  createdAt: number;
  updatedAt: number;
  author: string;
  enabled: boolean;
  triggerConditions: CorrelationCondition[];
  steps: PlaybookStep[];
  estimatedDuration: number;
  requiredPermissions: string[];
  tags: string[];
}

export interface PlaybookStep {
  id: string;
  name: string;
  description: string;
  order: number;
  action: ResponseAction | 'custom';
  target: string;
  automated: boolean;
  requiresApproval: boolean;
  timeout: number;
  onSuccess: string; // Next step ID
  onFailure: string; // Next step ID or 'abort'
  parameters: Record<string, any>;
  rollbackAction?: string;
}

export interface ContainmentStrategy {
  id: string;
  name: string;
  description: string;
  threatType: ThreatType;
  actions: ResponseAction[];
  scope: 'network' | 'host' | 'application' | 'user' | 'global';
  impact: 'low' | 'medium' | 'high';
  approvalRequired: boolean;
  estimatedDuration: number;
  rollbackPlan: string;
}

// ============================================================================
// Vulnerability Management Types
// ============================================================================

export enum VulnerabilityCategory {
  INJECTION = 'injection',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  CRYPTOGRAPHY = 'cryptography',
  CONFIGURATION = 'configuration',
  DATA_PROTECTION = 'data_protection',
  DEPENDENCY = 'dependency',
  NETWORK = 'network',
  SESSION_MANAGEMENT = 'session_management',
  INPUT_VALIDATION = 'input_validation',
  LOGGING = 'logging',
  ERROR_HANDLING = 'error_handling'
}

export enum VulnerabilityStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  FIX_VERIFIED = 'fix_verified',
  CLOSED = 'closed',
  FALSE_POSITIVE = 'false_positive',
  ACCEPTED_RISK = 'accepted_risk',
  DEFERRED = 'deferred'
}

export interface Vulnerability {
  id: string;
  title: string;
  description: string;
  category: VulnerabilityCategory;
  severity: ThreatLevel;
  cvssScore?: number;
  cvssVector?: string;
  cve?: string;
  cwe?: string;
  status: VulnerabilityStatus;
  discoveredAt: number;
  reportedBy: string;
  assignedTo?: string;
  resolvedAt?: number;
  verifiedAt?: number;
  location: {
    type: 'code' | 'dependency' | 'infrastructure' | 'configuration';
    path?: string;
    line?: number;
    component?: string;
    version?: string;
    url?: string;
  };
  evidence: {
    description: string;
    snippets?: string[];
    screenshots?: string[];
    logs?: string[];
    requests?: string[];
  };
  exploitability: 'easy' | 'medium' | 'hard' | 'unknown';
  impact: {
    confidentiality: 'none' | 'low' | 'high' | 'complete';
    integrity: 'none' | 'low' | 'high' | 'complete';
    availability: 'none' | 'low' | 'high' | 'complete';
  };
  affectedAssets: string[];
  remediation: {
    priority: 'immediate' | 'high' | 'medium' | 'low';
    effort: number; // hours
    complexity: 'low' | 'medium' | 'high';
    description: string;
    codeExample?: string;
    references: string[];
  };
  patch?: {
    version: string;
    availableAt: number;
    url?: string;
  };
  tags: string[];
  metadata: Record<string, any>;
}

export interface VulnerabilityScan {
  id: string;
  name: string;
  description: string;
  targetType: 'codebase' | 'dependencies' | 'infrastructure' | 'application';
  target: string;
  scanType: 'sast' | 'dast' | 'dependency' | 'container' | 'configuration';
  startedAt: number;
  completedAt?: number;
  duration?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  config: {
    depth: number;
    concurrency: number;
    excludePaths: string[];
    includePaths: string[];
    customRules: string[];
  };
  results: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  vulnerabilities: Vulnerability[];
  triggeredBy: string;
  tags: string[];
}

export interface RiskScore {
  score: number; // 0-100
  level: 'critical' | 'high' | 'medium' | 'low';
  factors: {
    vulnerabilityCount: number;
    avgSeverity: number;
    exploitability: number;
    assetCriticality: number;
    exposure: number;
  };
  calculatedAt: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

// ============================================================================
// Security Analytics Types
// ============================================================================

export interface SecurityMetrics {
  period: {
    start: number;
    end: number;
  };
  detection: {
    totalThreats: number;
    blockedThreats: number;
    bySeverity: Record<ThreatLevel, number>;
    byType: Record<ThreatType, number>;
    detectionRate: number;
    falsePositiveRate: number;
    meanTimeToDetect: number;
  };
  incidents: {
    total: number;
    open: number;
    resolved: number;
    meanTimeToResolve: number;
    meanTimeToContain: number;
    bySeverity: Record<ThreatLevel, number>;
  };
  vulnerabilities: {
    total: number;
    open: number;
    resolved: number;
    meanTimeToPatch: number;
    bySeverity: Record<ThreatLevel, number>;
    byCategory: Record<VulnerabilityCategory, number>;
  };
  response: {
    automatedActions: number;
    manualActions: number;
    successRate: number;
    avgResponseTime: number;
  };
  compliance: {
    framework: string;
    complianceScore: number;
    passedControls: number;
    failedControls: number;
    pendingControls: number;
  };
}

export interface SecurityTrend {
  metric: string;
  data: Array<{
    timestamp: number;
    value: number;
  }>;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
  prediction?: Array<{
    timestamp: number;
    value: number;
    confidence: number;
  }>;
}

export interface BehaviorProfile {
  id: string;
  entity: {
    type: 'user' | 'system' | 'application';
    id: string;
    name: string;
  };
  baseline: {
    loginTimes: number[];
    loginLocations: string[];
    accessedResources: string[];
    dataTransfer: {
      avg: number;
      max: number;
    };
    sessionDuration: {
      avg: number;
      max: number;
    };
  };
  anomalies: number;
  riskScore: number;
  lastUpdated: number;
}

export interface ThreatIntelligence {
  indicators: ThreatIndicator[];
  campaigns: ThreatCampaign[];
  actors: ThreatActor[];
  exploitKits: ExploitKit[];
  lastUpdated: number;
  sources: string[];
}

export interface ThreatCampaign {
  id: string;
  name: string;
  description: string;
  targetIndustries: string[];
  targetGeographies: string[];
  start_date: number;
  isActive: boolean;
  tactics: string[];
  techniques: string[];
  indicators: string[];
  confidence: number;
}

export interface ThreatActor {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  origin: string;
  motivations: string[];
  capabilities: string[];
  targets: string[];
  knownCampaigns: string[];
  lastSeen: number;
}

export interface ExploitKit {
  name: string;
  version: string;
  description: string;
  vulnerabilities: string[];
  urls: string[];
  firstSeen: number;
  lastSeen: number;
  prevalence: number;
}

// ============================================================================
// Compliance Types
// ============================================================================

export enum ComplianceFramework {
  SOC2 = 'soc2',
  ISO27001 = 'iso27001',
  GDPR = 'gdpr',
  HIPAA = 'hipaa',
  PCI_DSS = 'pci_dss',
  NIST = 'nist',
  CIS_CONTROLS = 'cis_controls',
  CIS_BENCHMARKS = 'cis_benchmarks'
}

export enum ControlStatus {
  COMPLIANT = 'compliant',
  NON_COMPLIANT = 'non_compliant',
  PARTIAL = 'partial',
  NOT_APPLICABLE = 'not_apppliant',
  PENDING = 'pending'
}

export interface ComplianceControl {
  id: string;
  framework: ComplianceFramework;
  controlId: string;
  title: string;
  description: string;
  category: string;
  status: ControlStatus;
  lastAssessed: number;
  nextAssessment: number;
  evidence: Evidence[];
  findings: ComplianceFinding[];
  owner: string;
  automation: {
    automated: boolean;
    testScript?: string;
    frequency: number;
  };
}

export interface Evidence {
  id: string;
  type: 'screenshot' | 'log' | 'document' | 'configuration' | 'test_result';
  description: string;
  location: string;
  collectedAt: number;
  collectedBy: string;
  hash: string;
}

export interface ComplianceFinding {
  id: string;
  controlId: string;
  severity: ThreatLevel;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'accepted_risk';
  discoveredAt: number;
  resolvedAt?: number;
  remediation: string;
  assignee?: string;
}

export interface ComplianceReport {
  id: string;
  framework: ComplianceFramework;
  period: {
    start: number;
    end: number;
  };
  generatedAt: number;
  generatedBy: string;
  status: 'draft' | 'in_review' | 'approved';
  summary: {
    totalControls: number;
    compliantControls: number;
    nonCompliantControls: number;
    partialControls: number;
    complianceScore: number;
  };
  controls: ComplianceControl[];
  findings: ComplianceFinding[];
  recommendations: string[];
  approvedBy?: string[];
  reviewedBy?: string[];
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  category: string;
  framework: ComplianceFramework;
  version: string;
  effectiveDate: number;
  reviewDate: number;
  status: 'draft' | 'active' | 'deprecated' | 'archived';
  owner: string;
  content: string;
  controls: string[];
  exceptions: PolicyException[];
}

export interface PolicyException {
  id: string;
  policyId: string;
  requestedBy: string;
  reason: string;
  justification: string;
  risk: ThreatLevel;
  approvedBy: string[];
  expiresAt: number;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  conditions: string[];
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface SOCConfig {
  // Detection
  enableThreatDetection: boolean;
  detectionMethods: DetectionMethod[];
  falsePositiveThreshold: number;

  // SIEM
  enableSIEM: boolean;
  logRetention: number;
  maxLogSize: number;
  enableRealtimeAlerting: boolean;

  // Response
  enableAutoResponse: boolean;
  requireApprovalFor: ResponseAction[];
  defaultPlaybooks: string[];

  // Vulnerability
  vulnerabilityScans: {
    enabled: boolean;
    schedule: string;
    depth: number;
  };

  // Analytics
  enableBehavioralAnalysis: boolean;
  baselinePeriod: number;
  anomalyThreshold: number;

  // Compliance
  frameworks: ComplianceFramework[];
  assessmentFrequency: number;

  // Integrations
  integrations: {
    slack?: SlackConfig;
    email?: EmailConfig;
    jira?: JiraConfig;
    splunk?: SplunkConfig;
    s3?: S3Config;
  };

  // Performance
  maxConcurrentScans: number;
  cacheTTL: number;
}

export interface SlackConfig {
  webhookUrl: string;
  channel: string;
  username: string;
  icon?: string;
  notifyOn: ThreatLevel[];
}

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
  from: string;
  to: string[];
  notifyOn: ThreatLevel[];
}

export interface JiraConfig {
  baseUrl: string;
  username: string;
  apiToken: string;
  projectKey: string;
  issueType: string;
  autoCreate: boolean;
  priorities: Record<ThreatLevel, string>;
}

export interface SplunkConfig {
  hecUrl: string;
  token: string;
  index: string;
  source: string;
  sourcetype: string;
}

export interface S3Config {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix: string;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const ThreatDetectionSchema = z.object({
  id: z.string().uuid(),
  threatType: z.nativeEnum(ThreatType),
  detectionMethod: z.nativeEnum(DetectionMethod),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  confidence: z.number().min(0).max(1),
  timestamp: z.number(),
  source: z.object({
    ip: z.string().ip(),
    userAgent: z.string().optional(),
    userId: z.string().optional(),
    sessionId: z.string().optional()
  }),
  target: z.object({
    resource: z.string(),
    endpoint: z.string().optional(),
    method: z.string().optional()
  }),
  indicators: z.array(z.any()),
  evidence: z.record(z.any()),
  context: z.object({
    requestHeaders: z.record(z.string()).optional(),
    requestBody: z.any().optional(),
    queryParams: z.record(z.string()).optional(),
    path: z.string().optional()
  }),
  matchedSignatures: z.array(z.string()),
  anomalyScore: z.number().optional(),
  behaviorScore: z.number().optional(),
  isBlocked: z.boolean(),
  isFalsePositive: z.boolean().optional(),
  assignedTo: z.string().optional(),
  notes: z.string().optional()
});

export const IncidentSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  type: z.nativeEnum(ThreatType),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  status: z.enum(['open', 'investigating', 'containing', 'eradicating', 'recovering', 'resolved', 'closed']),
  phase: z.enum(['detection', 'analysis', 'containment', 'eradication', 'recovery', 'post_incident']),
  priority: z.enum(['p1', 'p2', 'p3', 'p4']),
  createdAt: z.number(),
  detectedAt: z.number(),
  acknowledgedAt: z.number().optional(),
  containedAt: z.number().optional(),
  eradicatedAt: z.number().optional(),
  resolvedAt: z.number().optional(),
  closedAt: z.number().optional(),
  assignedTo: z.string().optional(),
  team: z.array(z.string()),
  detections: z.array(z.string()),
  alerts: z.array(z.string()),
  affectedAssets: z.array(z.object({
    type: z.enum(['server', 'database', 'application', 'network', 'user', 'data']),
    identifier: z.string(),
    name: z.string(),
    impact: z.string(),
    isCompromised: z.boolean(),
    isolationStatus: z.enum(['not_isolated', 'isolated', 'partially_isolated'])
  })),
  timeline: z.array(z.object({
    timestamp: z.number(),
    phase: z.string(),
    event: z.string(),
    description: z.string(),
    actor: z.string().optional(),
    evidence: z.record(z.any()).optional()
  })),
  actions: z.array(z.object({
    id: z.string(),
    action: z.enum(['block', 'allow', 'quarantine', 'alert', 'log', 'isolate']),
    target: z.string(),
    executedAt: z.number(),
    executedBy: z.string(),
    result: z.enum(['success', 'failed', 'partial']),
    details: z.string(),
    automated: z.boolean(),
    rollbackPossible: z.boolean(),
    rollbackAction: z.string().optional()
  })),
  rootCause: z.string().optional(),
  lessonsLearned: z.string().optional(),
  recommendations: z.array(z.string()),
  tags: z.array(z.string()),
  metadata: z.record(z.any())
});

export const VulnerabilitySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  category: z.nativeEnum(VulnerabilityCategory),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  cvssScore: z.number().min(0).max(10).optional(),
  cvssVector: z.string().optional(),
  cve: z.string().optional(),
  cwe: z.string().optional(),
  status: z.nativeEnum(VulnerabilityStatus),
  discoveredAt: z.number(),
  reportedBy: z.string(),
  assignedTo: z.string().optional(),
  resolvedAt: z.number().optional(),
  verifiedAt: z.number().optional(),
  location: z.object({
    type: z.enum(['code', 'dependency', 'infrastructure', 'configuration']),
    path: z.string().optional(),
    line: z.number().optional(),
    component: z.string().optional(),
    version: z.string().optional(),
    url: z.string().optional()
  }),
  evidence: z.object({
    description: z.string(),
    snippets: z.array(z.string()).optional(),
    screenshots: z.array(z.string()).optional(),
    logs: z.array(z.string()).optional(),
    requests: z.array(z.string()).optional()
  }),
  exploitability: z.enum(['easy', 'medium', 'hard', 'unknown']),
  impact: z.object({
    confidentiality: z.enum(['none', 'low', 'high', 'complete']),
    integrity: z.enum(['none', 'low', 'high', 'complete']),
    availability: z.enum(['none', 'low', 'high', 'complete'])
  }),
  affectedAssets: z.array(z.string()),
  remediation: z.object({
    priority: z.enum(['immediate', 'high', 'medium', 'low']),
    effort: z.number(),
    complexity: z.enum(['low', 'medium', 'high']),
    description: z.string(),
    codeExample: z.string().optional(),
    references: z.array(z.string())
  }),
  patch: z.object({
    version: z.string(),
    availableAt: z.number(),
    url: z.string().optional()
  }).optional(),
  tags: z.array(z.string()),
  metadata: z.record(z.any())
});
