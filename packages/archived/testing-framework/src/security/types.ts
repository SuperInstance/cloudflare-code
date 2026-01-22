/**
 * Security Testing Types
 * Provides types and interfaces for security testing and vulnerability scanning
 */

export interface SecurityTest {
  id: string;
  name: string;
  description?: string;
  type: SecurityTestType;
  severity: SecuritySeverity;
  target: string;
  parameters: SecurityTestParameters;
  expected: SecurityTestExpected;
  timeout?: number;
  retries?: number;
  enabled: boolean;
}

export type SecurityTestType =
  | 'owasp-top-ten'
  | 'xss'
  | 'sql-injection'
  | 'csrf'
  | 'auth-bypass'
  | 'directory-traversal'
  | 'file-inclusion'
  | 'ssrf'
  | 'cors-misconfiguration'
  | 'security-headers'
  | 'ssl-tls'
  | 'dependency-vulnerability'
  | 'secrets-scan'
  | 'input-validation'
  | 'access-control'
  | 'rate-limiting'
  | 'data-protection'
  | 'api-security'
  | 'websocket-security'
  | 'oauth-security'
  | 'jwt-security'
  | 'custom';

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SecurityTestParameters {
  [key: string]: any;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  data?: any;
  files?: File[];
  auth?: SecurityAuth;
  userAgent?: string;
  referer?: string;
  followRedirects?: boolean;
  maxRedirects?: number;
}

export interface SecurityAuth {
  type: 'basic' | 'bearer' | 'api-key' | 'oauth2' | 'jwt' | 'custom';
  credentials: any;
  token?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  scope?: string;
}

export interface SecurityTestExpected {
  pass: boolean;
  statusCodes?: number[];
  responseBody?: string | RegExp;
  headers?: Record<string, string>;
  responseTime?: number;
  vulnerability?: string;
}

export interface SecurityTestResult {
  id: string;
  testId: string;
  testName: string;
  passed: boolean;
  severity: SecuritySeverity;
  duration: number;
  findings: SecurityFinding[];
  error?: SecurityTestError;
  metadata: SecurityMetadata;
}

export interface SecurityFinding {
  id: string;
  title: string;
  description: string;
  severity: SecuritySeverity;
  category: string;
  evidence: string;
  url: string;
  method: string;
  parameters: any;
  recommendation: string;
  cwe?: number;
  owasp?: string;
  reference?: string;
}

export interface SecurityTestError {
  type: 'network' | 'timeout' | 'parse' | 'validation';
  message: string;
  code: string;
  details?: any;
}

export interface SecurityMetadata {
  timestamp: Date;
  environment: string;
  targetVersion: string;
  testRunnerVersion: string;
  scanId: string;
  tags?: string[];
}

export interface SecurityScanReport {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  target: string;
  status: 'running' | 'completed' | 'failed' | 'aborted';
  summary: SecurityScanSummary;
  findings: SecurityFinding[];
  tests: SecurityTestResult[];
  recommendations: SecurityRecommendation[];
  vulnerabilities: Vulnerability[];
  score: SecurityScore;
}

export interface SecurityScanSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  infoFindings: number;
  vulnerabilityScore: number;
  complianceScore: number;
}

export interface SecurityRecommendation {
  id: string;
  title: string;
  description: string;
  priority: 'immediate' | 'high' | 'medium' | 'low';
  complexity: 'easy' | 'medium' | 'hard';
  category: string;
  affectedTests: string[];
  estimatedTime?: number;
}

export interface Vulnerability {
  id: string;
  name: string;
  description: string;
  severity: SecuritySeverity;
  category: string;
  cweId: string;
  owaspCategory: string;
  affectedResources: string[];
  remediation: string;
  references: string[];
  cvssScore?: number;
  cveId?: string;
  publishedDate?: Date;
  patched?: boolean;
}

export interface SecurityScore {
  overall: number;
  details: {
    owaspTopTen: number;
    inputValidation: number;
    accessControl: number;
    dataProtection: number;
    secureHeaders: number;
    sslTls: number;
    dependencySecurity: number;
    secretsManagement: number;
  };
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D+' | 'D' | 'F';
}

export interface SecurityTestSuite {
  id: string;
  name: string;
  description?: string;
  target: string;
  tests: SecurityTest[];
  configuration: SecurityTestConfig;
  schedule?: Schedule;
  enabled: boolean;
}

export interface SecurityTestConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  auth?: SecurityAuth;
  timeout: number;
  retries: number;
  parallel: boolean;
  maxConcurrent: number;
  outputFormat: 'json' | 'html' | 'xml' | 'sarif' | 'pdf';
  outputDir: string;
  includeTests: SecurityTestType[];
  excludeTests: SecurityTestType[];
  severityFilters: SecuritySeverity[];
  customRules?: SecurityRule[];
}

export interface SecurityRule {
  id: string;
  name: string;
  type: 'regex' | 'pattern' | 'signature';
  pattern: string;
  severity: SecuritySeverity;
  category: string;
  description: string;
  enabled: boolean;
}

export interface Schedule {
  type: 'manual' | 'cron' | 'interval';
  cronExpression?: string;
  intervalMinutes?: number;
  timezone?: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

export interface SecurityProfile {
  id: string;
  name: string;
  description?: string;
  tests: SecurityTest[];
  configuration: SecurityTestConfig;
  complianceStandards?: ComplianceStandard[];
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceStandard {
  name: string;
  version: string;
  description: string;
  requirements: ComplianceRequirement[];
}

export interface ComplianceRequirement {
  id: string;
  title: string;
  description: string;
  category: string;
  status: 'compliant' | 'non-compliant' | 'partial' | 'not-tested';
  evidence?: string;
  references?: string[];
}