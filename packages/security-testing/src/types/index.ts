/**
 * Core type definitions for the Security Testing Package
 * Provides common interfaces and types used across all security modules
 */

// ============================================================================
// Severity Levels
// ============================================================================

export enum Severity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export interface SeverityScore {
  level: Severity;
  score: number; // 0-10
  cvss?: number; // CVSS score 0-10
}

// ============================================================================
// Vulnerability Types
// ============================================================================

export enum VulnerabilityType {
  // Injection
  SQL_INJECTION = 'SQL_INJECTION',
  XSS = 'XSS',
  CSRF = 'CSRF',
  COMMAND_INJECTION = 'COMMAND_INJECTION',
  LDAP_INJECTION = 'LDAP_INJECTION',
  XPath_INJECTION = 'XPATH_INJECTION',

  // Authentication & Authorization
  AUTHENTICATION_BYPASS = 'AUTHENTICATION_BYPASS',
  AUTHORIZATION_BYPASS = 'AUTHORIZATION_BYPASS',
  WEAK_PASSWORD = 'WEAK_PASSWORD',
  SESSION_FIXATION = 'SESSION_FIXATION',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',

  // Data Protection
  SENSITIVE_DATA_EXPOSURE = 'SENSITIVE_DATA_EXPOSURE',
  INSECURE_DESENSITIZATION = 'INSECURE_DESENSITIZATION',
  ENCRYPTION_FAILURE = 'ENCRYPTION_FAILURE',

  // Configuration
  SECURITY_MISCONFIGURATION = 'SECURITY_MISCONFIGURATION',
  DEFAULT_CREDENTIALS = 'DEFAULT_CREDENTIALS',
  INSECURE_SETTINGS = 'INSECURE_SETTINGS',

  // Code Quality
  BUFFER_OVERFLOW = 'BUFFER_OVERFLOW',
  INTEGER_OVERFLOW = 'INTEGER_OVERFLOW',
  FORMAT_STRING = 'FORMAT_STRING',
  RACE_CONDITION = 'RACE_CONDITION',
  USE_AFTER_FREE = 'USE_AFTER_FREE',

  // Dependencies
  VULNERABLE_DEPENDENCY = 'VULNERABLE_DEPENDENCY',
  OUTDATED_DEPENDENCY = 'OUTDATED_DEPENDENCY',
  LICENSE_VIOLATION = 'LICENSE_VIOLATION',

  // Business Logic
  BUSINESS_LOGIC flaw = 'BUSINESS_LOGIC_FLAW',
  PRICE_MANIPULATION = 'PRICE_MANIPULATION',
  LIMIT_BYPASS = 'LIMIT_BYPASS',

  // API
  BROKEN_AUTHENTICATION = 'BROKEN_AUTHENTICATION',
  BROKEN_ACCESS_CONTROL = 'BROKEN_ACCESS_CONTROL',
  EXCESSIVE_DATA_EXPOSURE = 'EXCESSIVE_DATA_EXPOSURE',
  LACK_OF_RESOURCES = 'LACK_OF_RESOURCES',

  // Other
  DOS = 'DOS',
  DDOS = 'DDOS',
  SSRF = 'SSRF',
  XXE = 'XXE',
  DESERIALIZATION = 'DESERIALIZATION',
  OPEN_REDIRECT = 'OPEN_REDIRECT',
  PATH_TRAVERSAL = 'PATH_TRAVERSAL'
}

// ============================================================================
// OWASP Top 10
// ============================================================================

export enum OWASPTop10 {
  A01_BROKEN_ACCESS_CONTROL = 'A01:2021-Broken Access Control',
  A02_CRYPTOGRAPHIC_FAILURES = 'A02:2021-Cryptographic Failures',
  A03_INJECTION = 'A03:2021-Injection',
  A04_INSECURE_DESIGN = 'A04:2021-Insecure Design',
  A05_SECURITY_MISCONFIGURATION = 'A05:2021-Security Misconfiguration',
  A06_VULNERABLE_OUTDATED_COMPONENTS = 'A06:2021-Vulnerable and Outdated Components',
  A07_AUTHENTICATION_FAILURES = 'A07:2021-Identification and Authentication Failures',
  A08_DATA_INTEGRITY_FAILURES = 'A08:2021-Software and Data Integrity Failures',
  A09_LOGGING_MONITORING_FAILURES = 'A09:2021-Security Logging and Monitoring Failures',
  A10_SSRF = 'A10:2021-Server-Side Request Forgery'
}

// ============================================================================
// CWE Mapping
// ============================================================================

export interface CWE {
  id: number;
  name: string;
  description: string;
  url: string;
}

// ============================================================================
// Vulnerability Findings
// ============================================================================

export interface Finding {
  id: string;
  title: string;
  description: string;
  severity: SeverityScore;
  type: VulnerabilityType;
  cwe?: CWE[];
  owasp?: OWASPTop10[];
  confidence: number; // 0-100

  // Location
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;

  // Code context
  codeSnippet?: string;
  context?: string;

  // Remediation
  remediation: string;
  references: string[];

  // Metadata
  scanner: string;
  timestamp: Date;
  falsePositive?: boolean;
  suppressed?: boolean;
  suppressionReason?: string;

  // Additional data
  metadata?: Record<string, unknown>;
}

export interface FindingGroup {
  type: VulnerabilityType;
  severity: Severity;
  findings: Finding[];
  count: number;
  files: string[];
}

// ============================================================================
// Scan Configuration
// ============================================================================

export interface ScanConfig {
  // Target
  target: string;
  targetType: 'code' | 'url' | 'api' | 'dependency';

  // Scope
  includePaths?: string[];
  excludePaths?: string[];
  filePatterns?: string[];

  // Scan types
  enableSAST: boolean;
  enableDAST: boolean;
  enableSCA: boolean;
  enableCompliance: boolean;

  // Rules
  rules?: string[];
  customRules?: CustomRule[];

  // Performance
  maxDepth?: number;
  maxFiles?: number;
  timeout?: number;
  parallel?: number;

  // Output
  outputFormat: 'json' | 'xml' | 'html' | 'sarif' | 'console';
  outputFile?: string;

  // Reporting
  severityThreshold?: Severity;
  failOnThreshold?: Severity;
}

export interface CustomRule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  pattern: string | RegExp;
  languages: string[];
  cwe?: number;
  owasp?: OWASPTop10;
  test?: string;
}

// ============================================================================
// Scan Results
// ============================================================================

export interface ScanResult {
  id: string;
  scanType: 'sast' | 'dast' | 'sca' | 'compliance';
  status: ScanStatus;
  config: ScanConfig;

  // Findings
  findings: Finding[];
  groupedFindings: FindingGroup[];

  // Statistics
  stats: ScanStatistics;

  // Metadata
  startTime: Date;
  endTime?: Date;
  duration?: number;
  scannerVersion: string;
  errors?: string[];
}

export interface ScanStatistics {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;

  filesScanned: number;
  linesScanned: number;
  vulnerabilitiesFound: number;
  falsePositiveRate: number;
}

export enum ScanStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout'
}

// ============================================================================
// DAST Specific Types
// ============================================================================

export interface DASTRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  params?: Record<string, string>;
}

export interface DASTResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  responseTime: number;
}

export interface DASTAttack {
  type: string;
  payload: string;
  description: string;
  expectedBehavior: string;
}

export interface APIEndpoint {
  method: string;
  path: string;
  authRequired: boolean;
  parameters: Parameter[];
  headers: Record<string, string>;
}

export interface Parameter {
  name: string;
  type: string;
  location: 'query' | 'path' | 'header' | 'body';
  required: boolean;
  sensitive?: boolean;
}

// ============================================================================
// SCA Specific Types
// ============================================================================

export interface Dependency {
  name: string;
  version: string;
  type: 'npm' | 'pypi' | 'go' | 'maven' | 'cargo' | 'nuget' | 'composer';
  dev: boolean;
  optional: boolean;
  transitive?: boolean;
  path?: string;
}

export interface Vulnerability {
  id: string;
  cve?: string;
  title: string;
  description: string;
  severity: Severity;
  cvss?: number;
  cwes: number[];
  references: string[];
  affectedVersions: string[];
  patchedVersions: string[];
  publishedDate: Date;
  modifiedDate: Date;
}

export interface License {
  id: string;
  name: string;
  type: 'permissive' | 'weak_copyleft' | 'strong_copyleft' | 'proprietary';
  risk: 'low' | 'medium' | 'high';
  approved: boolean;
  url?: string;
}

export interface DependencyFinding extends Finding {
  dependency: Dependency;
  vulnerability?: Vulnerability;
  license?: License;
}

// ============================================================================
// Compliance Types
// ============================================================================

export enum ComplianceFramework {
  SOC2 = 'SOC_2',
  ISO27001 = 'ISO_27001',
  PCIDSS = 'PCI_DSS',
  GDPR = 'GDPR',
  HIPAA = 'HIPAA',
  NIST = 'NIST',
  CIS = 'CIS',
  OWASP = 'OWASP'
}

export interface ComplianceControl {
  id: string;
  framework: ComplianceFramework;
  category: string;
  title: string;
  description: string;
  requirement: string;
  severity: Severity;
  automatedCheck: boolean;
  testMethod?: string;
}

export interface ComplianceResult {
  framework: ComplianceFramework;
  controls: ControlTestResult[];
  overallScore: number;
  passedControls: number;
  failedControls: number;
  skippedControls: number;
  timestamp: Date;
}

export interface ControlTestResult {
  control: ComplianceControl;
  status: 'pass' | 'fail' | 'skip' | 'warning';
  findings: Finding[];
  evidence: string[];
  timestamp: Date;
}

// ============================================================================
// Policy Types
// ============================================================================

export interface Policy {
  id: string;
  name: string;
  description: string;
  version: string;
  framework: 'opa' | 'rego' | 'custom';
  rules: PolicyRule[];
  scope: string[];
  severity: Severity;
  enabled: boolean;
}

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  action: 'allow' | 'deny' | 'warn' | 'audit';
  severity?: Severity;
  exception?: PolicyException;
}

export interface PolicyException {
  id: string;
  reason: string;
  expires?: Date;
  approvedBy: string;
  autoRenew: boolean;
}

export interface PolicyViolation {
  policy: Policy;
  rule: PolicyRule;
  finding: Finding;
  timestamp: Date;
  actionTaken: string;
}

// ============================================================================
// Penetration Testing Types
// ============================================================================

export interface PentestPhase {
  name: string;
  description: string;
  duration: number;
  status: ScanStatus;
  results: Finding[];
  startTime: Date;
  endTime?: Date;
}

export interface PentestReport {
  id: string;
  target: string;
  phases: PentestPhase[];
  findings: Finding[];
  executiveSummary: string;
  methodology: string;
  recommendations: string[];
  riskScore: number;
  timestamp: Date;
}

export interface Exploit {
  id: string;
  name: string;
  type: VulnerabilityType;
  severity: Severity;
  description: string;
  pocCode: string;
  references: string[];
  cve?: string;
}

// ============================================================================
// Scanner Integration Types
// ============================================================================

export enum ScannerType {
  SEMGREP = 'semgrep',
  SONARQUBE = 'sonarqube',
  SNYK = 'snyk',
  TRIVY = 'trivy',
  GRYPE = 'grype',
  ZAP = 'zap',
  BURP = 'burp',
  NESSES = 'nessus',
  OPENVAS = 'openvas'
}

export interface ScannerConfig {
  type: ScannerType;
  enabled: boolean;
  priority: number;
  timeout: number;
  retries: number;
  config?: Record<string, unknown>;
}

export interface ScannerResult {
  scanner: ScannerType;
  success: boolean;
  executionTime: number;
  findings: Finding[];
  errors?: string[];
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Reporting Types
// ============================================================================

export interface ReportConfig {
  format: 'json' | 'xml' | 'html' | 'pdf' | 'markdown' | 'sarif';
  includeExecutiveSummary: boolean;
  includeFindings: boolean;
  includeStatistics: boolean;
  includeRemediation: boolean;
  includeCodeSnippets: boolean;
  severityFilter?: Severity[];
  groupBySeverity: boolean;
  groupByType: boolean;
  sortResults: boolean;
}

export interface Report {
  id: string;
  scanResult: ScanResult;
  config: ReportConfig;
  generatedAt: Date;
  generatedBy: string;
  file?: string;
}

// ============================================================================
// Notification Types
// ============================================================================

export interface Notification {
  id: string;
  type: 'email' | 'slack' | 'webhook' | 'jira' | 'pagerduty';
  enabled: boolean;
  config: NotificationConfig;
}

export interface NotificationConfig {
  recipients?: string[];
  webhookUrl?: string;
  severityThreshold?: Severity;
  includeFindingDetails: boolean;
  customMessage?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface ProgressCallback {
  (progress: number, message: string): void;
}

export interface ScanContext {
  scanId: string;
  config: ScanConfig;
  startTime: Date;
  logger: Logger;
  onProgress?: ProgressCallback;
}

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: Date;
  ttl: number;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}
