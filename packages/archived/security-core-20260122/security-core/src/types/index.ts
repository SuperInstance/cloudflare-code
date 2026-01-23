/**
 * Comprehensive type definitions for Security Core package
 * Provides type safety across all security and compliance modules
 */

// ============================================================================
// SECRET MANAGEMENT TYPES
// ============================================================================

export interface SecretMetadata {
  id: string;
  name: string;
  description?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastAccessedAt?: Date;
  lastRotatedAt?: Date;
  nextRotationAt?: Date;
  tags: Record<string, string>;
  checksum: string;
  algorithm: string;
  keyId?: string;
}

export interface SecretValue {
  value: string;
  version: number;
  createdAt: Date;
  expiresAt?: Date;
}

export interface Secret extends SecretMetadata {
  currentVersion: SecretValue;
  previousVersions?: SecretValue[];
  accessPolicy: SecretAccessPolicy;
  rotationPolicy: RotationPolicy;
}

export interface SecretAccessPolicy {
  allowedPrincipals: string[];
  allowedIpRanges: string[];
  requireMfa: boolean;
  auditAccess: boolean;
  maxTtl?: number;
  allowedOperations: SecretOperation[];
}

export enum SecretOperation {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  ROTATE = 'rotate',
  SHARE = 'share'
}

export interface RotationPolicy {
  enabled: boolean;
  intervalDays: number;
  automaticRotation: boolean;
  notificationDaysBefore: number;
  gracePeriodDays: number;
}

export interface SecretShareRequest {
  secretId: string;
  principalId: string;
  expiresAt: Date;
  permissions: SecretOperation[];
  justification: string;
  requiresApproval: boolean;
}

export interface TemporaryCredential {
  credentialId: string;
  secretId: string;
  principalId: string;
  token: string;
  expiresAt: Date;
  permissions: SecretOperation[];
  createdAt: Date;
  maxUses?: number;
  useCount: number;
}

// ============================================================================
// ENCRYPTION TYPES
// ============================================================================

export enum EncryptionAlgorithm {
  AES_256_GCM = 'aes-256-gcm',
  AES_256_CBC = 'aes-256-cbc',
  RSA_OAEP = 'rsa-oaep',
  RSA_PKCS1 = 'rsa-pkcs1',
  CHACHA20_POLY1305 = 'chacha20-poly1305'
}

export enum HashAlgorithm {
  SHA256 = 'sha256',
  SHA384 = 'sha384',
  SHA512 = 'sha512',
  SHA3_256 = 'sha3-256',
  SHA3_512 = 'sha3-512',
  BLAKE2B = 'blake2b',
  BLAKE2S = 'blake2s'
}

export enum KeyDerivationAlgorithm {
  PBKDF2 = 'pbkdf2',
  ARGON2I = 'argon2i',
  ARGON2ID = 'argon2id',
  SCRYPT = 'scrypt'
}

export interface EncryptionKey {
  keyId: string;
  version: number;
  algorithm: EncryptionAlgorithm;
  keyData: Buffer;
  createdAt: Date;
  expiresAt?: Date;
  status: KeyStatus;
  metadata: Record<string, any>;
}

export enum KeyStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
  PENDING_DELETION = 'pending_deletion'
}

export interface EncryptedData {
  ciphertext: Buffer;
  iv: Buffer;
  authTag?: Buffer;
  algorithm: EncryptionAlgorithm;
  keyId: string;
  metadata?: Record<string, any>;
}

export interface EncryptionResult {
  encryptedData: EncryptedData;
  keyId: string;
  algorithm: EncryptionAlgorithm;
  timestamp: Date;
}

export interface DecryptionResult {
  plaintext: Buffer;
  verified: boolean;
  algorithm: EncryptionAlgorithm;
  timestamp: Date;
}

export interface KeyDerivationParams {
  algorithm: KeyDerivationAlgorithm;
  iterations?: number;
  memoryCost?: number;
  parallelism?: number;
  salt: Buffer;
  keyLength: number;
}

export interface KeyPair {
  publicKey: Buffer;
  privateKey: Buffer;
  keyId: string;
  algorithm: EncryptionAlgorithm;
  createdAt: Date;
  keySize: number;
}

export interface SecureRandomOptions {
  length: number;
  type: 'bytes' | 'hex' | 'base64' | 'url-safe';
}

// ============================================================================
// AUTHENTICATION & AUTHORIZATION TYPES
// ============================================================================

export interface JwtPayload {
  sub: string;
  iss: string;
  aud: string[];
  exp: number;
  iat: number;
  nbf?: number;
  jti?: string;
  scope?: string[];
  roles?: string[];
  permissions?: string[];
  customClaims?: Record<string, any>;
}

export interface JwtToken {
  token: string;
  payload: JwtPayload;
  expiresAt: Date;
  issuedAt: Date;
}

export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  tokenType: 'Bearer';
  expiresIn: number;
  scope?: string[];
  issuedAt: Date;
}

export interface User {
  userId: string;
  username: string;
  email: string;
  roles: Role[];
  permissions: Permission[];
  attributes: Record<string, any>;
  mfaEnabled: boolean;
  status: UserStatus;
  createdAt: Date;
  lastLoginAt?: Date;
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  LOCKED = 'locked',
  PENDING_ACTIVATION = 'pending_activation'
}

export interface Role {
  roleId: string;
  name: string;
  description?: string;
  permissions: Permission[];
  isSystemRole: boolean;
  createdAt: Date;
}

export interface Permission {
  permissionId: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface AccessRequest {
  requestId: string;
  principalId: string;
  resource: string;
  action: string;
  context: AccessContext;
  requestedAt: Date;
  expiresAt?: Date;
}

export interface AccessContext {
  ip?: string;
  userAgent?: string;
  timestamp: Date;
  location?: GeoLocation;
  sessionId?: string;
  additionalContext?: Record<string, any>;
}

export interface GeoLocation {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export interface AccessDecision {
  allowed: boolean;
  reason?: string;
  deniedPermissions?: Permission[];
  conditions?: Record<string, any>;
  evaluatedAt: Date;
}

export interface MfaChallenge {
  challengeId: string;
  userId: string;
  method: MfaMethod;
  secret: string;
  code?: string;
  expiresAt: Date;
  verified: boolean;
  attempts: number;
  maxAttempts: number;
}

export enum MfaMethod {
  TOTP = 'totp',
  SMS = 'sms',
  EMAIL = 'email',
  HARDWARE_TOKEN = 'hardware_token',
  BIOMETRIC = 'biometric',
  PUSH = 'push'
}

export interface Session {
  sessionId: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
  ip: string;
  userAgent: string;
  mfaVerified: boolean;
  data: Record<string, any>;
}

// ============================================================================
// AUDIT LOGGING TYPES
// ============================================================================

export interface AuditEvent {
  eventId: string;
  timestamp: Date;
  eventType: AuditEventType;
  category: AuditCategory;
  severity: AuditSeverity;
  principal: PrincipalInfo;
  resource: ResourceInfo;
  action: string;
  outcome: AuditOutcome;
  details: Record<string, any>;
  metadata: AuditMetadata;
  correlationId?: string;
  requestId?: string;
}

export enum AuditEventType {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATA_ACCESS = 'data_access',
  DATA_MODIFICATION = 'data_modification',
  CONFIGURATION_CHANGE = 'configuration_change',
  SECURITY_EVENT = 'security_event',
  COMPLIANCE_EVENT = 'compliance_event',
  SYSTEM_EVENT = 'system_event'
}

export enum AuditCategory {
  SECURITY = 'security',
  COMPLIANCE = 'compliance',
  OPERATIONS = 'operations',
  GOVERNANCE = 'governance',
  PRIVACY = 'privacy'
}

export enum AuditSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export enum AuditOutcome {
  SUCCESS = 'success',
  FAILURE = 'failure',
  ERROR = 'error',
  PARTIAL = 'partial'
}

export interface PrincipalInfo {
  id: string;
  type: PrincipalType;
  name?: string;
  roles?: string[];
  permissions?: string[];
  ip?: string;
  userAgent?: string;
}

export enum PrincipalType {
  USER = 'user',
  SERVICE = 'service',
  SYSTEM = 'system',
  API_KEY = 'api_key'
}

export interface ResourceInfo {
  id: string;
  type: string;
  name?: string;
  owner?: string;
  classification?: DataClassification;
  location?: string;
}

export enum DataClassification {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted',
  HIGHLY_CONFIDENTIAL = 'highly_confidential'
}

export interface AuditMetadata {
  source: string;
  environment: string;
  platform: string;
  version?: string;
  tags?: Record<string, string>;
  retentionPeriod?: number;
}

export interface AuditQuery {
  startDate?: Date;
  endDate?: Date;
  eventTypes?: AuditEventType[];
  categories?: AuditCategory[];
  severities?: AuditSeverity[];
  principals?: string[];
  resources?: string[];
  outcomes?: AuditOutcome[];
  limit?: number;
  offset?: number;
  sortOrder?: 'asc' | 'desc';
}

export interface AuditReport {
  reportId: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  summary: AuditSummary;
  events: AuditEvent[];
  complianceMappings: ComplianceMapping[];
}

export interface AuditSummary {
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  eventsByCategory: Record<AuditCategory, number>;
  eventsBySeverity: Record<AuditSeverity, number>;
  eventsByOutcome: Record<AuditOutcome, number>;
}

export interface ComplianceMapping {
  framework: ComplianceFramework;
  controls: string[];
  evidence: AuditEvent[];
}

// ============================================================================
// COMPLIANCE TYPES
// ============================================================================

export enum ComplianceFramework {
  SOC2 = 'soc2',
  ISO27001 = 'iso27001',
  GDPR = 'gdpr',
  HIPAA = 'hipaa',
  PCI_DSS = 'pci_dss',
  NIST_800_53 = 'nist_800_53',
  CSA_STAR = 'csa_star'
}

export interface ComplianceControl {
  controlId: string;
  framework: ComplianceFramework;
  title: string;
  description: string;
  category: string;
  status: ControlStatus;
  evidence: Evidence[];
  assessments: Assessment[];
  lastAssessedAt?: Date;
  nextAssessmentDue: Date;
  owner: string;
  exceptions?: Exception[];
}

export enum ControlStatus {
  IMPLEMENTED = 'implemented',
  PARTIALLY_IMPLEMENTED = 'partially_implemented',
  NOT_IMPLEMENTED = 'not_implemented',
  TESTING = 'testing',
  DEPRECATED = 'deprecated'
}

export interface Evidence {
  evidenceId: string;
  type: EvidenceType;
  source: string;
  collectedAt: Date;
  description: string;
  data: Record<string, any>;
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
}

export enum EvidenceType {
  AUDIT_LOG = 'audit_log',
  DOCUMENTATION = 'documentation',
  SCREENSHOT = 'screenshot',
  CONFIGURATION = 'configuration',
  POLICY = 'policy',
  PROCEDURE = 'procedure',
  TEST_RESULT = 'test_result',
  AUTOMATED_CHECK = 'automated_check'
}

export interface Assessment {
  assessmentId: string;
  controlIds: string[];
  assessor: string;
  assessedAt: Date;
  result: AssessmentResult;
  findings: Finding[];
  recommendations: string[];
  nextReviewDate: Date;
}

export enum AssessmentResult {
  COMPLIANT = 'compliant',
  NON_COMPLIANT = 'non_compliant',
  PARTIALLY_COMPLIANT = 'partially_compliant',
  NOT_ASSESSED = 'not_assessed'
}

export interface Finding {
  findingId: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  impact: string;
  remediation: string;
  status: FindingStatus;
  discoveredAt: Date;
  resolvedAt?: Date;
}

export enum FindingSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export enum FindingStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  ACCEPTED = 'accepted',
  DEFERRED = 'deferred'
}

export interface Exception {
  exceptionId: string;
  controlId: string;
  reason: string;
  approvedBy: string;
  approvedAt: Date;
  expiresAt?: Date;
  conditions: string[];
  riskAcceptance: string;
}

export interface ComplianceReport {
  reportId: string;
  framework: ComplianceFramework;
  period: {
    start: Date;
    end: Date;
  };
  generatedAt: Date;
  summary: ComplianceSummary;
  controls: ComplianceControl[];
  findings: Finding[];
  recommendations: string[];
}

export interface ComplianceSummary {
  totalControls: number;
  compliantControls: number;
  partiallyCompliantControls: number;
  nonCompliantControls: number;
  compliancePercentage: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
}

// ============================================================================
// SECURITY POLICY TYPES
// ============================================================================

export interface SecurityPolicy {
  policyId: string;
  name: string;
  version: string;
  description: string;
  category: PolicyCategory;
  status: PolicyStatus;
  rules: PolicyRule[];
  scope: PolicyScope;
  enforcement: PolicyEnforcement;
  exceptions: PolicyException[];
  createdAt: Date;
  updatedAt: Date;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
}

export enum PolicyCategory {
  ACCESS_CONTROL = 'access_control',
  DATA_PROTECTION = 'data_protection',
  ENCRYPTION = 'encryption',
  NETWORK_SECURITY = 'network_security',
  INCIDENT_RESPONSE = 'incident_response',
  CHANGE_MANAGEMENT = 'change_management',
  THIRD_PARTY_RISK = 'third_party_risk',
  BUSINESS_CONTINUITY = 'business_continuity'
}

export enum PolicyStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DEPRECATED = 'deprecated',
  UNDER_REVIEW = 'under_review'
}

export interface PolicyRule {
  ruleId: string;
  name: string;
  description: string;
  condition: PolicyCondition;
  action: PolicyAction;
  severity: PolicySeverity;
  enabled: boolean;
}

export interface PolicyCondition {
  type: ConditionType;
  operator: ConditionOperator;
  value: any;
  metadata?: Record<string, any>;
}

export enum ConditionType {
  RESOURCE = 'resource',
  USER = 'user',
  ROLE = 'role',
  PERMISSION = 'permission',
  ATTRIBUTE = 'attribute',
  TIME = 'time',
  LOCATION = 'location',
  CUSTOM = 'custom'
}

export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  IN = 'in',
  NOT_IN = 'not_in',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  REGEX = 'regex',
  IP_RANGE = 'ip_range'
}

export interface PolicyAction {
  type: ActionType;
  parameters?: Record<string, any>;
}

export enum ActionType {
  ALLOW = 'allow',
  DENY = 'deny',
  REQUIRE_MFA = 'require_mfa',
  REQUIRE_APPROVAL = 'require_approval',
  LOG_ONLY = 'log_only',
  ALERT = 'alert',
  QUARANTINE = 'quarantine',
  BLOCK = 'block'
}

export enum PolicySeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface PolicyScope {
  resources?: string[];
  users?: string[];
  roles?: string[];
  environments?: string[];
  regions?: string[];
}

export interface PolicyEnforcement {
  mode: EnforcementMode;
  gateTypes: GateType[];
  allowOverrides: boolean;
  overrideApprovalRequired: boolean;
  violationAction: ViolationAction;
}

export enum EnforcementMode {
  ENFORCED = 'enforced',
  MONITOR_ONLY = 'monitor_only',
  DISABLED = 'disabled'
}

export enum GateType {
  PRE_COMMIT = 'pre_commit',
  PRE_PUSH = 'pre_push',
  PRE_DEPLOY = 'pre_deploy',
  PRE_MERGE = 'pre_merge',
  PRE_RELEASE = 'pre_release'
}

export enum ViolationAction {
  BLOCK = 'block',
  WARN = 'warn',
  LOG = 'log',
  ALERT = 'alert',
  CREATE_TICKET = 'create_ticket'
}

export interface PolicyException {
  exceptionId: string;
  policyId: string;
  reason: string;
  requestedBy: string;
  approvedBy: string;
  approvedAt: Date;
  expiresAt: Date;
  conditions: string[];
  reviewRequired: boolean;
}

export interface PolicyEvaluationResult {
  policyId: string;
  policyName: string;
  passed: boolean;
  violations: PolicyViolation[];
  evaluatedAt: Date;
  evaluator: string;
}

export interface PolicyViolation {
  ruleId: string;
  ruleName: string;
  severity: PolicySeverity;
  message: string;
  resource?: string;
  remediation?: string;
}

// ============================================================================
// THREAT DETECTION TYPES
// ============================================================================

export interface Threat {
  threatId: string;
  type: ThreatType;
  severity: ThreatSeverity;
  confidence: number;
  status: ThreatStatus;
  detectedAt: Date;
  source: ThreatSource;
  target: ThreatTarget;
  indicators: Indicator[];
  description: string;
  mitigation?: string;
  response?: ThreatResponse;
  relatedThreats?: string[];
  metadata: Record<string, any>;
}

export enum ThreatType {
  MALWARE = 'malware',
  PHISHING = 'phishing',
  SQL_INJECTION = 'sql_injection',
  XSS = 'xss',
  CSRF = 'csrf',
  DDOS = 'ddos',
  BRUTE_FORCE = 'brute_force',
  INTRUSION = 'intrusion',
  DATA_EXFILTRATION = 'data_exfiltration',
  ANOMALY = 'anomaly',
  POLICY_VIOLATION = 'policy_violation',
  VULNERABILITY = 'vulnerability'
}

export enum ThreatSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export enum ThreatStatus {
  DETECTED = 'detected',
  INVESTIGATING = 'investigating',
  CONFIRMED = 'confirmed',
  FALSE_POSITIVE = 'false_positive',
  MITIGATING = 'mitigating',
  MITIGATED = 'mitigated',
  CLOSED = 'closed'
}

export interface ThreatSource {
  type: string;
  ip?: string;
  userAgent?: string;
  userId?: string;
  sessionId?: string;
  location?: GeoLocation;
  additionalInfo?: Record<string, any>;
}

export interface ThreatTarget {
  type: string;
  id: string;
  name?: string;
  classification?: DataClassification;
}

export interface Indicator {
  indicatorId: string;
  type: IndicatorType;
  value: string;
  confidence: number;
  firstSeen: Date;
  lastSeen: Date;
  occurrences: number;
}

export enum IndicatorType {
  IP_ADDRESS = 'ip_address',
  DOMAIN = 'domain',
  URL = 'url',
  HASH = 'hash',
  EMAIL = 'email',
  USER_AGENT = 'user_agent',
  PATTERN = 'pattern',
  BEHAVIOR = 'behavior'
}

export interface ThreatResponse {
  responseId: string;
  actions: ResponseAction[];
  executedAt: Date;
  executedBy: string;
  automatic: boolean;
  result: ResponseResult;
}

export interface ResponseAction {
  type: ResponseActionType;
  parameters: Record<string, any>;
  executed: boolean;
  result?: string;
}

export enum ResponseActionType {
  BLOCK_IP = 'block_ip',
  BLOCK_USER = 'block_user',
  TERMINATE_SESSION = 'terminate_session',
  RESET_CREDENTIALS = 'reset_credentials',
  ISOLATE_SYSTEM = 'isolate_system',
  NOTIFY_ADMIN = 'notify_admin',
  CREATE_INCIDENT = 'create_incident',
  THROTTLE_REQUESTS = 'throttle_requests',
  REQUIRE_MFA = 'require_mfa',
  LOG_ONLY = 'log_only'
}

export enum ResponseResult {
  SUCCESS = 'success',
  PARTIAL = 'partial',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

export interface Anomaly {
  anomalyId: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  confidence: number;
  detectedAt: Date;
  description: string;
  baseline: BaselineMetrics;
  observed: ObservedMetrics;
  deviation: number;
  threshold: number;
  context: Record<string, any>;
}

export enum AnomalyType {
  STATISTICAL = 'statistical',
  BEHAVIORAL = 'behavioral',
  VOLUME = 'volume',
  PERFORMANCE = 'performance',
  ACCESS = 'access',
  CONFIGURATION = 'configuration'
}

export enum AnomalySeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface BaselineMetrics {
  metricName: string;
  value: number;
  period: string;
  sampleSize: number;
}

export interface ObservedMetrics {
  metricName: string;
  value: number;
  timestamp: Date;
}

export interface ThreatIntelligence {
  feedId: string;
  source: string;
  indicators: Indicator[];
  lastUpdated: Date;
  confidence: number;
  ttl: number;
  categories: string[];
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class SecurityError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class SecretNotFoundError extends SecurityError {
  constructor(secretId: string) {
    super(`Secret not found: ${secretId}`, 'SECRET_NOT_FOUND', 404);
    this.name = 'SecretNotFoundError';
  }
}

export class SecretAccessDeniedError extends SecurityError {
  constructor(secretId: string, principalId: string) {
    super(`Access denied to secret ${secretId} for principal ${principalId}`, 'ACCESS_DENIED', 403);
    this.name = 'SecretAccessDeniedError';
  }
}

export class EncryptionError extends SecurityError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'ENCRYPTION_ERROR', 500, details);
    this.name = 'EncryptionError';
  }
}

export class DecryptionError extends SecurityError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'DECRYPTION_ERROR', 500, details);
    this.name = 'DecryptionError';
  }
}

export class AuthenticationError extends SecurityError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends SecurityError {
  constructor(message: string) {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

export class PolicyViolationError extends SecurityError {
  constructor(message: string, public policyId: string, public ruleId: string) {
    super(message, 'POLICY_VIOLATION', 403);
    this.name = 'PolicyViolationError';
  }
}

export class ComplianceError extends SecurityError {
  constructor(message: string, public framework: ComplianceFramework) {
    super(message, 'COMPLIANCE_ERROR', 500);
    this.name = 'ComplianceError';
  }
}

export class ThreatDetectedError extends SecurityError {
  constructor(message: string, public threatId: string, public severity: ThreatSeverity) {
    super(message, 'THREAT_DETECTED', 403);
    this.name = 'ThreatDetectedError';
  }
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface SecurityConfig {
  secrets: SecretsConfig;
  encryption: EncryptionConfig;
  auth: AuthConfig;
  audit: AuditConfig;
  compliance: ComplianceConfig;
  policies: PoliciesConfig;
  threats: ThreatsConfig;
}

export interface SecretsConfig {
  provider: 'cloudflare' | 'vault' | 'aws' | 'gcp' | 'azure';
  defaultRotationDays: number;
  autoRotationEnabled: boolean;
  encryptionRequired: boolean;
  accessLoggingEnabled: boolean;
  quotaLimit: number;
}

export interface EncryptionConfig {
  defaultAlgorithm: EncryptionAlgorithm;
  keyRotationDays: number;
  keyDerivationAlgorithm: KeyDerivationAlgorithm;
  fipsCompliant: boolean;
  keyManagementService: string;
}

export interface AuthConfig {
  jwtIssuer: string;
  jwtAudience: string[];
  jwtExpirySeconds: number;
  mfaRequired: boolean;
  mfaMethods: MfaMethod[];
  sessionTimeoutMinutes: number;
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
}

export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}

export interface SAML2Config {
  entryPoint: string;
  issuer: string;
  callbackUrl: string;
  cert: string;
  privateCert?: string;
  identifierFormat?: string;
  acceptedClockSkewMs?: number;
}

export interface AuditConfig {
  enabled: boolean;
  retentionDays: number;
  logLevel: AuditSeverity;
  asyncLogging: boolean;
  batchSize: number;
  flushIntervalMs: number;
  exportEnabled: boolean;
  exportFormat: 'json' | 'csv' | 'parquet';
}

export interface ComplianceConfig {
  frameworks: ComplianceFramework[];
  autoAssessmentEnabled: boolean;
  assessmentIntervalDays: number;
  evidenceCollectionEnabled: boolean;
  reportingEnabled: boolean;
  notificationEmails: string[];
}

export interface PoliciesConfig {
  enforcementMode: EnforcementMode;
  allowExceptions: boolean;
  exceptionApprovalRequired: boolean;
  gateChecksEnabled: boolean;
  violationAction: ViolationAction;
}

export interface ThreatsConfig {
  detectionEnabled: boolean;
  responseEnabled: boolean;
  autoMitigation: boolean;
  intelligenceFeeds: string[];
  anomalyDetectionEnabled: boolean;
  baselineWindowDays: number;
  sensitivityThreshold: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface SearchOptions {
  query?: string;
  filters?: Record<string, any>;
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  pagination?: {
    page: number;
    pageSize: number;
  };
}

export interface MetricData {
  name: string;
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}
