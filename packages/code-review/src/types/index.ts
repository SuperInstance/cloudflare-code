/**
 * Core type definitions for the code review package
 */

// ============================================================================
// Basic Types
// ============================================================================

export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'rust'
  | 'java'
  | 'cpp'
  | 'csharp'
  | 'ruby'
  | 'php'
  | 'swift'
  | 'kotlin'
  | 'scala'
  | 'dart';

export type Severity = 'error' | 'warning' | 'info' | 'hint';

export type Category =
  | 'security'
  | 'performance'
  | 'quality'
  | 'style'
  | 'best-practices'
  | 'documentation'
  | 'testing'
  | 'maintainability'
  | 'complexity'
  | 'duplication';

export type RuleStatus = 'enabled' | 'disabled' | 'warn';

// ============================================================================
// File and Location Types
// ============================================================================

export interface FileLocation {
  path: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export interface CodeRange {
  start: FileLocation;
  end: FileLocation;
}

export interface FileInfo {
  path: string;
  language: Language;
  size: number;
  lines: number;
  encoding?: string;
  hash?: string;
}

// ============================================================================
// Issue and Finding Types
// ============================================================================

export interface Issue {
  id: string;
  ruleId: string;
  severity: Severity;
  category: Category;
  title: string;
  description: string;
  location: FileLocation;
  code?: string;
  suggestion?: string;
  fix?: FixSuggestion;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface FixSuggestion {
  description: string;
  replacement: string;
  range?: CodeRange;
  requiresManualReview?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface IssueBatch {
  issues: Issue[];
  summary: IssueSummary;
  files: Map<string, FileInfo>;
}

export interface IssueSummary {
  total: number;
  bySeverity: Record<Severity, number>;
  byCategory: Record<Category, number>;
  byFile: Record<string, number>;
}

// ============================================================================
// Review Types
// ============================================================================

export interface ReviewOptions {
  includeCategories?: Category[];
  excludeCategories?: Category[];
  minSeverity?: Severity;
  maxIssues?: number;
  timeout?: number;
  parallel?: boolean;
  cacheResults?: boolean;
}

export interface ReviewResult {
  success: boolean;
  issues: Issue[];
  summary: IssueSummary;
  metrics: ReviewMetrics;
  duration: number;
  timestamp: Date;
}

export interface ReviewMetrics {
  filesScanned: number;
  linesAnalyzed: number;
  issuesFound: number;
  issuesFixed: number;
  coverage: number;
  score: number;
}

// ============================================================================
// PR Review Types
// ============================================================================

export interface PullRequestInfo {
  number: number;
  title: string;
  description: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  baseCommit: string;
  headCommit: string;
  changedFiles: ChangedFile[];
  additions: number;
  deletions: number;
}

export interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  patch?: string;
  previousPath?: string;
}

export interface ReviewComment {
  id: string;
  issueId: string;
  prNumber: number;
  file: string;
  line: number;
  body: string;
  author: string;
  createdAt: Date;
  resolved: boolean;
  thread?: ReviewComment[];
}

export interface PRReviewResult {
  pr: PullRequestInfo;
  review: ReviewResult;
  comments: ReviewComment[];
  approvalStatus: 'approved' | 'changes_requested' | 'commented' | 'pending';
  reviewScore: number;
  recommendations: string[];
}

// ============================================================================
// Quality Metrics Types
// ============================================================================

export interface ComplexityMetrics {
  cyclomatic: number;
  cognitive: number;
  nestingDepth: number;
  parameters: number;
  complexity: number;
}

export interface QualityMetrics {
  maintainabilityIndex: number;
  technicalDebt: number;
  codeDuplication: number;
  codeSmells: number;
  complexity: ComplexityMetrics;
  testCoverage: number;
  documentationCoverage: number;
}

export interface CodeSmell {
  type: string;
  name: string;
  description: string;
  location: FileLocation;
  severity: Severity;
  impact: string;
  remediation: string;
}

export interface DuplicationInstance {
  lines: number[];
  files: string[];
  tokens: string;
  similarity: number;
}

// ============================================================================
// Security Types
// ============================================================================

export interface SecurityIssue extends Issue {
  category: 'security';
  cwe?: string;
  owasp?: string;
  riskScore: number;
  exploitability: number;
  impact: number;
  cvss?: {
    baseScore: number;
    vector: string;
  };
}

export interface VulnerabilityReport {
  issues: SecurityIssue[];
  summary: SecuritySummary;
  dependencies: DependencyVulnerability[];
}

export interface SecuritySummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  totalRiskScore: number;
}

export interface DependencyVulnerability {
  packageName: string;
  version: string;
  vulnerability: {
    id: string;
    severity: Severity;
    title: string;
    description: string;
    cwe: string[];
    references: string[];
    patchedVersions?: string[];
  };
}

export interface SecretFinding {
  type: string;
  secret: string;
  location: FileLocation;
  verified: boolean;
  falsePositive?: boolean;
}

// ============================================================================
// Performance Types
// ============================================================================

export interface PerformanceIssue extends Issue {
  category: 'performance';
  impact: 'high' | 'medium' | 'low';
  estimatedImprovement?: string;
}

export interface PerformanceMetrics {
  timeComplexity?: string;
  spaceComplexity?: string;
  bottlenecks: string[];
  recommendations: string[];
  benchmarkResults?: BenchmarkResult[];
}

export interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  memory: number;
}

// ============================================================================
// Style and Best Practices Types
// ============================================================================

export interface StyleIssue extends Issue {
  category: 'style';
  rule: string;
  autoFixable: boolean;
}

export interface BestPracticeViolation extends Issue {
  category: 'best-practices';
  principle: string; // SOLID, DRY, etc.
  pattern?: string;
}

// ============================================================================
// Rule Configuration Types
// ============================================================================

export interface RuleConfig {
  id: string;
  name: string;
  category: Category;
  severity: Severity;
  status: RuleStatus;
  description: string;
  languages: Language[];
  options?: Record<string, unknown>;
  exceptions?: string[];
}

export interface RuleSet {
  name: string;
  version: string;
  rules: RuleConfig[];
  extends?: string[];
}

export interface ConfigProfile {
  name: string;
  description: string;
  rulesets: string[];
  overrides: Map<string, Partial<RuleConfig>>;
  settings: ReviewOptions;
}

// ============================================================================
// Analysis Context Types
// ============================================================================

export interface AnalysisContext {
  workingDirectory: string;
  repositoryRoot: string;
  branch: string;
  commit: string;
  author: string;
  timestamp: Date;
  environment: 'local' | 'ci' | 'pr' | 'manual';
}

export interface AnalysisOptions {
  context: AnalysisContext;
  languages: Language[];
  rules: RuleSet[];
  options: ReviewOptions;
  filters?: FilterOptions;
}

export interface FilterOptions {
  includePaths?: string[];
  excludePaths?: string[];
  maxSize?: number;
  maxLines?: number;
}

// ============================================================================
// Result Types
// ============================================================================

export interface AnalysisResult {
  context: AnalysisContext;
  review: ReviewResult;
  quality: QualityMetrics;
  security: VulnerabilityReport;
  performance: PerformanceMetrics;
  style: StyleIssue[];
  practices: BestPracticeViolation[];
  timestamp: Date;
  duration: number;
}

export interface ReportFormat {
  type: 'json' | 'html' | 'markdown' | 'xml' | 'sarif' | 'checkstyle';
  output: string;
  include?: string[];
  exclude?: string[];
}

export interface Report {
  format: ReportFormat;
  data: AnalysisResult;
  metadata: {
    version: string;
    tool: string;
    timestamp: Date;
  };
}

// ============================================================================
// CI/CD Integration Types
// ============================================================================

export interface CIConfig {
  platform: 'github' | 'gitlab' | 'bitbucket' | 'azure';
  token?: string;
  repository: string;
  prNumber?: number;
  sha?: string;
}

export interface CIResult {
  success: boolean;
  checkUrl?: string;
  reportUrl?: string;
  commentPosted: boolean;
  status: 'success' | 'failure' | 'pending';
}

// ============================================================================
// Error Types
// ============================================================================

export class ReviewError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ReviewError';
  }
}

export class ParseError extends ReviewError {
  constructor(file: string, line: number, message: string) {
    super(`Parse error in ${file}:${line}: ${message}`, 'PARSE_ERROR', { file, line });
    this.name = 'ParseError';
  }
}

export class RuleError extends ReviewError {
  constructor(ruleId: string, message: string) {
    super(`Rule error in ${ruleId}: ${message}`, 'RULE_ERROR', { ruleId });
    this.name = 'RuleError';
  }
}
