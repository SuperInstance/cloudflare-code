/**
 * Code Review and Analysis System - Main Entry Point
 *
 * Comprehensive automated code review system with:
 * - Static code analysis for 20+ languages
 * - Security vulnerability scanning
 * - Code quality scoring
 * - Best practices checking
 * - Performance analysis
 * - GitHub PR integration
 *
 * @example
 * ```typescript
 * import { createCodeReview } from '@claudeflare/review';
 *
 * const review = await createCodeReview({
 *   files: ['src/index.ts'],
 *   options: {
 *     includeSecurity: true,
 *     includePerformance: true,
 *     includeQuality: true,
 *   },
 * });
 *
 * console.log(review.overallScore);
 * ```
 */

// ==============================================================================
// Type Exports
// ==============================================================================

export type {
  // Core types
  Severity,
  IssueCategory,
  CodeIssue,
  CodeReviewReport,
  CodeMetrics,
  ReviewSummary,
  MultiFileReviewReport,
  AggregatedMetrics,

  // Review options
  ReviewOptions,
  RuleConfig,

  // Security types
  SecurityReport,
  SecurityVulnerability,
  Secret,
  DependencyVulnerability,

  // Performance types
  PerformanceIssue,
  PerformanceProfile,

  // Quality types
  CodeSmell,
  ComplexityAnalysis,

  // Rule engine types
  Rule,
  RulePattern,
  RuleResult,
  RuleTemplate,

  // Dependency types
  Dependency,
  DependencyGraph,
  DependencyReport,

  // Integration types
  PRReview,
  PRReviewComment,
  ReviewIntegrationOptions,

  // Analysis context
  AnalysisContext,
  AnalysisProgress,

  // Error types
  AnalysisError,
  ParseError,
  RuleError,
} from './types';

// ==============================================================================
// Main Code Review System
// ==============================================================================

import type {
  CodeReviewReport,
  MultiFileReviewReport,
  ReviewOptions,
  AnalysisContext,
  AnalysisProgress,
  ReviewIntegrationOptions,
} from './types';
import { StaticAnalyzer } from './analyzer';
import { SecurityScanner } from './security';
import { QualityChecker } from './quality';
import { RuleEngine } from './rules';
import { PerformanceAnalyzer } from './performance';
import { ReportGenerator, type ReportFormat } from './report';
import { createParser } from '../codebase/parser';
import { GitHubClient } from '../github/client';
import type { GitHubPullRequest, GitHubPullRequestComment } from '../github/types';

// ==============================================================================
// Code Review System
// ==============================================================================

/**
 * Code review system configuration
 */
export interface CodeReviewConfig {
  // Analysis options
  options?: ReviewOptions;

  // Integration options
  integration?: ReviewIntegrationOptions;

  // Report options
  reportFormat?: ReportFormat;

  // Parallelism
  parallelism?: number;

  // Progress callback
  onProgress?: (progress: AnalysisProgress) => void;
}

/**
 * Code review system result
 */
export interface CodeReviewResult {
  reports: CodeReviewReport[];
  multiFileReport: MultiFileReviewReport;
  formatted: string;
}

/**
 * Code review system
 */
export class CodeReviewSystem {
  private analyzer: StaticAnalyzer;
  private securityScanner: SecurityScanner;
  private qualityChecker: QualityChecker;
  private ruleEngine: RuleEngine;
  private performanceAnalyzer: PerformanceAnalyzer;
  private reportGenerator: ReportGenerator;
  private githubClient?: GitHubClient;

  constructor() {
    this.analyzer = new StaticAnalyzer();
    this.securityScanner = new SecurityScanner();
    this.qualityChecker = new QualityChecker();
    this.ruleEngine = new RuleEngine();
    this.performanceAnalyzer = new PerformanceAnalyzer();
    this.reportGenerator = new ReportGenerator();
  }

  /**
   * Set GitHub client for PR integration
   */
  setGitHubClient(client: GitHubClient): void {
    this.githubClient = client;
  }

  /**
   * Review code from file contents
   */
  async reviewCode(
    files: Array<{ path: string; content: string }>,
    config: CodeReviewConfig = {}
  ): Promise<CodeReviewResult> {
    const startTime = performance.now();
    const context: AnalysisContext = {
      files: files.map(f => f.path),
      options: config.options || {},
      timestamp: Date.now(),
      sessionId: crypto.randomUUID(),
    };

    // Notify progress
    config.onProgress?.({
      stage: 'parsing',
      progress: 0,
      filesCompleted: 0,
      totalFiles: files.length,
      issuesFound: 0,
    });

    // Parse files
    const parser = createParser();
    const parsedFiles = await parser.parseBatch(files);

    // Notify progress
    config.onProgress?.({
      stage: 'analyzing',
      progress: 20,
      filesCompleted: 0,
      totalFiles: files.length,
      issuesFound: 0,
    });

    // Analyze files
    const reports = await this.analyzer.analyzeBatch(
      parsedFiles,
      config.options,
      context,
      config.onProgress
    );

    // Notify progress
    config.onProgress?.({
      stage: 'reporting',
      progress: 90,
      filesCompleted: files.length,
      totalFiles: files.length,
      issuesFound: reports.reduce((sum, r) => sum + r.issues.length, 0),
    });

    // Generate multi-file report
    const multiFileReport = this.generateMultiFileReport(reports, context);

    // Generate formatted report
    const formatted = this.reportGenerator.generateMultiFileReport(
      multiFileReport,
      {
        format: config.reportFormat || 'console',
        includeDetails: true,
        includeSuggestions: true,
        includeCode: true,
      }
    );

    // Notify progress
    config.onProgress?.({
      stage: 'complete',
      progress: 100,
      filesCompleted: files.length,
      totalFiles: files.length,
      issuesFound: reports.reduce((sum, r) => sum + r.issues.length, 0),
    });

    const duration = performance.now() - startTime;
    multiFileReport.duration = duration;

    return {
      reports,
      multiFileReport,
      formatted,
    };
  }

  /**
   * Review a GitHub pull request
   */
  async reviewPullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    config: CodeReviewConfig = {}
  ): Promise<{
    reviewResult: CodeReviewResult;
    reviewComment?: { id: number; body: string };
  }> {
    if (!this.githubClient) {
      throw new Error('GitHub client not configured. Call setGitHubClient() first.');
    }

    // Get pull request
    const pr = await this.githubClient.getPullRequest(owner, repo, pullNumber);

    // Get changed files
    const diff = await this.githubClient.request<{ files: Array<{ filename: string; patch?: string }> }>(
      `/repos/${owner}/${repo}/pulls/${pullNumber}/files`
    );

    // Fetch file contents
    const files = await Promise.all(
      diff.data.files.map(async (file) => {
        try {
          const content = await this.githubClient!.getFile(owner, repo, file.filename, pr.head.sha);
          return {
            path: file.filename,
            content: (content as any).decodedContent || '',
          };
        } catch {
          return {
            path: file.filename,
            content: '',
          };
        }
      })
    );

    // Run code review
    const reviewResult = await this.reviewCode(files, config);

    // Post review comment if enabled
    let reviewComment;
    if (config.integration?.github?.autoComment && this.githubClient) {
      const comment = this.generatePRReviewComment(reviewResult.multiFileReport);
      reviewComment = await this.postPRReview(owner, repo, pullNumber, comment, pr);
    }

    return { reviewResult, reviewComment };
  }

  /**
   * Generate PR review comment
   */
  private generatePRReviewComment(report: MultiFileReviewReport): string {
    const lines: string[] = [];

    lines.push('## 🔍 Code Review Report\n');
    lines.push(`**Overall Score:** ${report.overallScore}/100\n`);
    lines.push(`**Files Analyzed:** ${report.files.length}\n`);
    lines.push(`**Total Issues:** ${report.issues.length}\n`);

    if (report.overallSummary.criticalIssues > 0) {
      lines.push(`\n### 🚨 Critical Issues (${report.overallSummary.criticalIssues})\n`);
    }
    if (report.overallSummary.highIssues > 0) {
      lines.push(`\n### ⚠️ High Priority Issues (${report.overallSummary.highIssues})\n`);
    }

    // Top issues
    const topIssues = report.issues
      .filter(i => i.severity === 'critical' || i.severity === 'high')
      .slice(0, 10);

    if (topIssues.length > 0) {
      lines.push('\n### Top Issues\n');
      for (const issue of topIssues) {
        lines.push(`\n**${issue.severity.toUpperCase()}** - ${issue.message}`);
        lines.push(`- **File:** ${issue.file}:${issue.line}`);
        lines.push(`- **Rule:** ${issue.rule}`);
        if (issue.suggestion) {
          lines.push(`- **Suggestion:** ${issue.suggestion}`);
        }
      }
    }

    // Recommendations
    if (report.overallSummary.recommendations.length > 0) {
      lines.push('\n### Recommendations\n');
      for (const rec of report.overallSummary.recommendations.slice(0, 5)) {
        lines.push(`- ${rec}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Post review to GitHub PR
   */
  private async postPRReview(
    owner: string,
    repo: string,
    pullNumber: number,
    comment: string,
    pr: GitHubPullRequest
  ): Promise<{ id: number; body: string } | undefined> {
    if (!this.githubClient) return undefined;

    try {
      // Determine review state based on score
      const score = this.calculatePRScore(comment);
      const event = score >= 80 ? 'APPROVE' : score >= 50 ? 'COMMENT' : 'REQUEST_CHANGES';

      // Create review
      const review = await this.githubClient.createPullRequestReview(
        owner,
        repo,
        pullNumber,
        event,
        comment
      );

      return {
        id: review.id,
        body: comment,
      };
    } catch (error) {
      console.error('Failed to post PR review:', error);
      return undefined;
    }
  }

  /**
   * Calculate PR score from comment
   */
  private calculatePRScore(comment: string): number {
    const scoreMatch = comment.match(/Overall Score:\s*(\d+)/);
    return scoreMatch ? parseInt(scoreMatch[1], 10) : 50;
  }

  /**
   * Generate multi-file report
   */
  private generateMultiFileReport(
    reports: CodeReviewReport[],
    context: AnalysisContext
  ): MultiFileReviewReport {
    const allIssues = reports.flatMap(r => r.issues);

    // Calculate overall score
    const avgScore = reports.reduce((sum, r) => sum + r.score, 0) / reports.length;

    // Aggregate metrics
    const totalLinesOfCode = reports.reduce((sum, r) => sum + r.metrics.linesOfCode, 0);
    const avgComplexity = reports.reduce((sum, r) => sum + r.metrics.cyclomaticComplexity, 0) / reports.length;
    const avgMaintainability = reports.reduce((sum, r) => sum + r.metrics.maintainabilityIndex, 0) / reports.length;

    // Count by language
    const languages: Record<string, number> = {};
    for (const report of reports) {
      languages[report.language] = (languages[report.language] || 0) + 1;
    }

    // Most problematic files
    const mostProblematicFiles = reports
      .map(r => ({
        file: r.file,
        score: r.score,
        issueCount: r.issues.length,
      }))
      .filter(f => f.issueCount > 0)
      .sort((a, b) => b.issueCount - a.issueCount)
      .slice(0, 10);

    return {
      repository: context.repository?.name || 'unknown',
      branch: context.repository?.branch || 'unknown',
      commit: context.repository?.commit,
      files: reports,
      overallScore: Math.round(avgScore),
      overallMetrics: {
        totalFiles: reports.length,
        totalLinesOfCode,
        totalIssues: allIssues.length,
        avgComplexity: Math.round(avgComplexity),
        avgMaintainability: Math.round(avgMaintainability),
        avgTestCoverage: 0,
        languages: languages as any,
        mostProblematicFiles,
      },
      overallSummary: {
        totalIssues: allIssues.length,
        criticalIssues: allIssues.filter(i => i.severity === 'critical').length,
        highIssues: allIssues.filter(i => i.severity === 'high').length,
        mediumIssues: allIssues.filter(i => i.severity === 'medium').length,
        lowIssues: allIssues.filter(i => i.severity === 'low').length,
        infoIssues: allIssues.filter(i => i.severity === 'info').length,
        securityScore: 0,
        performanceScore: 0,
        qualityScore: 0,
        maintainabilityScore: Math.round(avgMaintainability),
        recommendations: [],
        strengths: [],
        weaknesses: [],
      },
      issues: allIssues,
      timestamp: Date.now(),
      duration: 0,
    };
  }
}

// ==============================================================================
// Factory Functions
// ==============================================================================

/**
 * Create a code review system instance
 */
export function createCodeReviewSystem(): CodeReviewSystem {
  return new CodeReviewSystem();
}

/**
 * Review code from files (convenience function)
 */
export async function reviewCode(
  files: Array<{ path: string; content: string }>,
  config?: CodeReviewConfig
): Promise<CodeReviewResult> {
  const system = createCodeReviewSystem();
  return system.reviewCode(files, config);
}

/**
 * Review a GitHub pull request (convenience function)
 */
export async function reviewPullRequest(
  owner: string,
  repo: string,
  pullNumber: number,
  githubClient: GitHubClient,
  config?: CodeReviewConfig
): Promise<{
  reviewResult: CodeReviewResult;
  reviewComment?: { id: number; body: string };
}> {
  const system = createCodeReviewSystem();
  system.setGitHubClient(githubClient);
  return system.reviewPullRequest(owner, repo, pullNumber, config);
}

// ==============================================================================
// Re-export Individual Components
// ==============================================================================

export { StaticAnalyzer, createStaticAnalyzer } from './analyzer';
export { SecurityScanner, createSecurityScanner } from './security';
export { QualityChecker, createQualityChecker } from './quality';
export { RuleEngine, createRuleEngine, createDefaultRuleEngine, getTotalRuleCount, getRuleCountByCategory } from './rules';
export { PerformanceAnalyzer, createPerformanceAnalyzer } from './performance';
export { ReportGenerator, createReportGenerator } from './report';

// ==============================================================================
// Default Exports
// ==============================================================================

export default {
  createCodeReviewSystem,
  reviewCode,
  reviewPullRequest,
  StaticAnalyzer,
  SecurityScanner,
  QualityChecker,
  RuleEngine,
  PerformanceAnalyzer,
  ReportGenerator,
};
