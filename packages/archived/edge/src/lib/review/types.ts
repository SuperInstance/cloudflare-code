/**
 * Code Review and Analysis System - Type Definitions
 *
 * Comprehensive types for static analysis, security scanning,
 * quality checking, and performance analysis
 */

import type { SupportedLanguage } from '../codebase/types';

// ============================================================================
// Core Review Types
// ============================================================================

/**
 * Issue severity levels
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Issue categories
 */
export type IssueCategory =
  | 'security'
  | 'performance'
  | 'quality'
  | 'maintainability'
  | 'reliability'
  | 'style'
  | 'documentation'
  | 'testing'
  | 'dependencies'
  | 'best-practices';

/**
 * Code review issue
 */
export interface CodeIssue {
  id: string;
  severity: Severity;
  category: IssueCategory;
  rule: string;
  message: string;
  description?: string;
  file: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  code?: string;
  suggestion?: string;
  fix?: {
    description: string;
    replacement: string;
  };
  context?: {
    before: string;
    after: string;
  };
  references?: string[];
  tags?: string[];
  confidence: number; // 0-1
}

/**
 * Code review report for a file
 */
export interface CodeReviewReport {
  file: string;
  language: SupportedLanguage;
  score: number; // 0-100
  issues: CodeIssue[];
  metrics: CodeMetrics;
  summary: ReviewSummary;
  timestamp: number;
}

/**
 * Code metrics
 */
export interface CodeMetrics {
  // Size metrics
  linesOfCode: number;
  linesOfDocumentation: number;
  blankLines: number;
  totalLines: number;
  fileSize: number;

  // Complexity metrics
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  nestingDepth: number;
  maxNestingDepth: number;

  // Duplication metrics
  duplicationPercentage: number;
  duplicatedLines: number;
  duplicateBlocks: number;

  // Quality metrics
  maintainabilityIndex: number;
  technicalDebt: number; // in minutes
  codeSmellCount: number;

  // Documentation metrics
  documentationCoverage: number;
  publicApiDocumented: number;

  // Test metrics
  testCoverage: number;
  testCount: number;
  assertionCount: number;

  // Dependency metrics
  dependencyCount: number;
  externalDependencyCount: number;
  circularDependencyCount: number;

  // Performance metrics
  estimatedExecutionTime: number;
  memoryUsageEstimate: number;
  bigONotation?: string;

  // Security metrics
  vulnerabilityCount: number;
  secretCount: number;
  dependencyVulnerabilityCount: number;
}

/**
 * Review summary
 */
export interface ReviewSummary {
  totalIssues: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  infoIssues: number;

  securityScore: number;
  performanceScore: number;
  qualityScore: number;
  maintainabilityScore: number;

  recommendations: string[];
  strengths: string[];
  weaknesses: string[];
}

/**
 * Multi-file review report
 */
export interface MultiFileReviewReport {
  repository: string;
  branch: string;
  commit?: string;
  files: CodeReviewReport[];
  overallScore: number;
  overallMetrics: AggregatedMetrics;
  overallSummary: ReviewSummary;
  issues: CodeIssue[];
  timestamp: number;
  duration: number;
}

/**
 * Aggregated metrics across files
 */
export interface AggregatedMetrics {
  totalFiles: number;
  totalLinesOfCode: number;
  totalIssues: number;
  avgComplexity: number;
  avgMaintainability: number;
  avgTestCoverage: number;
  languages: Record<SupportedLanguage, number>;
  mostProblematicFiles: Array<{
    file: string;
    score: number;
    issueCount: number;
  }>;
}

// ============================================================================
// Analysis Options
// ============================================================================

/**
 * Review options
 */
export interface ReviewOptions {
  // Analysis scope
  categories?: IssueCategory[];
  severities?: Severity[];
  languages?: SupportedLanguage[];

  // Analysis depth
  includeSecurity?: boolean;
  includePerformance?: boolean;
  includeQuality?: boolean;
  includeBestPractices?: boolean;

  // Rule configuration
  enabledRules?: string[];
  disabledRules?: string[];
  ruleConfig?: Record<string, RuleConfig>;

  // Performance
  maxFileSize?: number;
  maxFiles?: number;
  parallelism?: number;

  // Output
  includeSuggestions?: boolean;
  includeContext?: boolean;
  includeFixes?: boolean;

  // Integration
  githubIntegration?: boolean;
  autoComment?: boolean;
}

/**
 * Rule configuration
 */
export interface RuleConfig {
  enabled?: boolean;
  severity?: Severity;
  options?: Record<string, unknown>;
  exceptions?: string[];
}

// ============================================================================
// Security Analysis Types
// ============================================================================

/**
 * Security vulnerability
 */
export interface SecurityVulnerability {
  id: string;
  severity: Severity;
  category:
    | 'injection'
    | 'xss'
    | 'csrf'
    | 'auth'
    | 'crypto'
    | 'config'
    | 'dependency'
    | 'data-exposure'
    | 'denial-of-service'
    | 'other';
  title: string;
  description: string;
  cwe?: string; // Common Weakness Enumeration
  owasp?: string; // OWASP category
  file: string;
  line: number;
  code?: string;
  remediation: string;
  references: string[];
  confidence: number;
}

/**
 * Secret detection result
 */
export interface Secret {
  type:
    | 'api-key'
    | 'aws-access-key'
    | 'aws-secret-key'
    | 'azure-key'
    | 'google-cloud-key'
    | 'jwt'
    | 'password'
    | 'private-key'
    | 'database-url'
    | 'service-account'
    | 'oauth-token'
    | 'other';
  value: string;
  file: string;
  line: number;
  column: number;
  severity: Severity;
  verified: boolean;
}

/**
 * Security analysis report
 */
export interface SecurityReport {
  vulnerabilities: SecurityVulnerability[];
  secrets: Secret[];
  dependencyVulnerabilities: DependencyVulnerability[];
  score: number;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
}

/**
 * Dependency vulnerability
 */
export interface DependencyVulnerability {
  packageName: string;
  version: string;
  severity: Severity;
  cve?: string;
  title: string;
  description: string;
  patchedVersions?: string[];
  recommendation: string;
  references: string[];
}

// ============================================================================
// Performance Analysis Types
// ============================================================================

/**
 * Performance issue
 */
export interface PerformanceIssue {
  id: string;
  severity: Severity;
  category:
    | 'n-plus-one'
    | 'memory-leak'
    | 'inefficient-algorithm'
    | 'unoptimized-loop'
    | 'unnecessary-computation'
    | 'large-bundle'
    | 'slow-query'
    | 'blocking-operation'
    | 'cache-miss'
    | 'other';
  title: string;
  description: string;
  file: string;
  line: number;
  impact: string;
  optimization: string;
  estimatedImprovement?: string;
  code?: string;
  suggestion?: string;
}

/**
 * Performance profile
 */
export interface PerformanceProfile {
  file: string;
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  ioOperations: number;
  networkRequests: number;
  bottlenecks: PerformanceIssue[];
  optimizations: string[];
  score: number;
}

// ============================================================================
// Quality Analysis Types
// ============================================================================

/**
 * Code smell
 */
export interface CodeSmell {
  id: string;
  type:
    | 'long-method'
    | 'long-parameter-list'
    | 'large-class'
    | 'feature-envy'
    | 'data-clumps'
    | 'primitive-obsession'
    | 'lazy-class'
    | 'duplicate-code'
    | 'complex-conditional'
    | 'magic-number'
    | 'dead-code'
    | 'god-object'
    | 'shotgun-surgery'
    | 'other';
  severity: Severity;
  title: string;
  description: string;
  file: string;
  line: number;
  endLine?: number;
  remediation: string;
}

/**
 * Complexity analysis
 */
export interface ComplexityAnalysis {
  cyclomatic: number;
  cognitive: number;
  halstead?: {
    vocabulary: number;
    length: number;
    difficulty: number;
    volume: number;
    effort: number;
    time: number;
    bugs: number;
  };
  maintainability: number;
}

// ============================================================================
// Rule Engine Types
// ============================================================================

/**
 * Rule definition
 */
export interface Rule {
  id: string;
  name: string;
  category: IssueCategory;
  severity: Severity;
  description: string;
  documentation?: string;
  languages: SupportedLanguage[];
  patterns: RulePattern[];
  options?: RuleConfig;
  examples?: RuleExample[];
  references?: string[];
  tags?: string[];
}

/**
 * Rule pattern
 */
export interface RulePattern {
  type: 'regex' | 'ast' | 'custom' | 'heuristic';
  pattern: string | object | Function;
  scope?: 'file' | 'function' | 'class' | 'statement' | 'line';
  ignore?: string[];
  exceptions?: string[];
}

/**
 * Rule example
 */
export interface RuleExample {
  description: string;
  before: string;
  after: string;
}

/**
 * Rule execution result
 */
export interface RuleResult {
  rule: string;
  matches: Array<{
    file: string;
    line: number;
    column: number;
    code: string;
    message: string;
    suggestion?: string;
  }>;
  executionTime: number;
}

// ============================================================================
// Dependency Analysis Types
// ============================================================================

/**
 * Dependency information
 */
export interface Dependency {
  name: string;
  version: string;
  type: 'production' | 'development' | 'peer' | 'optional';
  source: 'npm' | 'yarn' | 'pnpm' | 'bower' | 'other';
  files: string[];
  vulnerabilities: DependencyVulnerability[];
  outdated?: {
    current: string;
    latest: string;
    wanted: string;
  };
  license?: string;
  size?: number;
}

/**
 * Dependency graph
 */
export interface DependencyGraph {
  nodes: Array<{
    id: string;
    name: string;
    version: string;
    depth: number;
  }>;
  edges: Array<{
    from: string;
    to: string;
    type: 'imports' | 'requires' | 'includes';
  }>;
  circular: Array<{
    path: string[];
  }>;
}

/**
 * Dependency analysis report
 */
export interface DependencyReport {
  dependencies: Dependency[];
  graph: DependencyGraph;
  outdated: Dependency[];
  vulnerabilities: DependencyVulnerability[];
  unused: Dependency[];
  missing: Dependency[];
  score: number;
  recommendations: string[];
}

// ============================================================================
// Best Practices Types
// ============================================================================

/**
 * Best practice check
 */
export interface BestPracticeCheck {
  id: string;
  name: string;
  category: string;
  description: string;
  framework?: string;
  language: SupportedLanguage;
  compliant: boolean;
  file: string;
  line?: number;
  message: string;
  suggestion?: string;
}

/**
 * Framework conventions
 */
export interface FrameworkConvention {
  framework: 'react' | 'vue' | 'angular' | 'svelte' | 'express' | 'fastify' | 'nest' | 'next' | 'nuxt' | 'other';
  convention: string;
  description: string;
  compliant: boolean;
  issues: CodeIssue[];
}

// ============================================================================
// Integration Types
// ============================================================================

/**
 * GitHub PR review comment
 */
export interface PRReviewComment {
  path: string;
  line: number;
  side?: 'LEFT' | 'RIGHT';
  body: string;
  start_line?: number;
  start_side?: 'LEFT' | 'RIGHT';
}

/**
 * GitHub PR review
 */
export interface PRReview {
  pull_number: number;
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
  body?: string;
  comments: PRReviewComment[];
}

/**
 * Review integration options
 */
export interface ReviewIntegrationOptions {
  github?: {
    enabled: boolean;
    autoComment: boolean;
    commentOnSuccess?: boolean;
    minSeverity?: Severity;
    draftMode?: boolean;
  };
  slack?: {
    enabled: boolean;
    webhook: string;
    minSeverity?: Severity;
  };
  email?: {
    enabled: boolean;
    recipients: string[];
    minSeverity?: Severity;
  };
}

// ============================================================================
// ML and Anomaly Detection Types
// ============================================================================

/**
 * Anomaly detection result
 */
export interface AnomalyResult {
  type: 'code-pattern' | 'performance' | 'security' | 'behavior';
  severity: Severity;
  description: string;
  file: string;
  line?: number;
  confidence: number;
  similarCode?: Array<{
    file: string;
    line: number;
    similarity: number;
  }>;
}

/**
 * Code similarity result
 */
export interface CodeSimilarity {
  file1: string;
  file2: string;
  similarity: number;
  type: 'exact' | 'structural' | 'token-based';
  lines?: Array<{
    line1: number;
    line2: number;
    similarity: number;
  }>;
}

// ============================================================================
// Analysis Context
// ============================================================================

/**
 * Analysis context
 */
export interface AnalysisContext {
  repository?: {
    name: string;
    owner: string;
    branch: string;
    commit?: string;
  };
  files: string[];
  options: ReviewOptions;
  timestamp: number;
  sessionId: string;
}

/**
 * Analysis progress
 */
export interface AnalysisProgress {
  stage: 'parsing' | 'analyzing' | 'scanning' | 'reporting' | 'complete';
  progress: number; // 0-100
  currentFile?: string;
  filesCompleted: number;
  totalFiles: number;
  issuesFound: number;
  estimatedTimeRemaining?: number;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Analysis error
 */
export class AnalysisError extends Error {
  constructor(
    message: string,
    public code: string,
    public file?: string,
    public line?: number
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}

/**
 * Parse error
 */
export class ParseError extends AnalysisError {
  constructor(message: string, file: string, line?: number) {
    super(message, 'PARSE_ERROR', file, line);
    this.name = 'ParseError';
  }
}

/**
 * Rule execution error
 */
export class RuleError extends AnalysisError {
  constructor(message: string, rule: string, file?: string) {
    super(message, 'RULE_ERROR', file);
    this.name = 'RuleError';
    this.rule = rule;
  }

  rule: string;
}
