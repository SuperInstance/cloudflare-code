/**
 * Review Engine - Core automated PR review and code analysis engine
 */

// @ts-nocheck - External dependencies (p-limit, diff) and complex type mappings
import * as fs from 'fs/promises';
import * as path from 'path';
import { pLimit } from 'p-limit';
import { diffLines } from 'diff';
import {
  Issue,
  IssueBatch,
  IssueSummary,
  ReviewOptions,
  ReviewResult,
  ReviewMetrics,
  PullRequestInfo,
  ChangedFile,
  ReviewComment,
  PRReviewResult,
  FileInfo,
  FileLocation,
  Language,
  Severity,
  Category,
  AnalysisContext,
} from '../types/index.js';
import { LanguageDetector } from '../utils/language-detector.js';
import { ParserFactory } from '../utils/parser-factory.js';
import { RuleRegistry } from './rule-registry.js';
import { TemplateManager } from './template-manager.js';

// ============================================================================
// Review Engine Configuration
// ============================================================================

interface ReviewEngineConfig {
  maxConcurrentFiles?: number;
  timeoutPerFile?: number;
  cacheEnabled?: boolean;
  scoreWeights?: {
    severity: Record<Severity, number>;
    category: Record<Category, number>;
  };
}

const DEFAULT_CONFIG: ReviewEngineConfig = {
  maxConcurrentFiles: 10,
  timeoutPerFile: 30000,
  cacheEnabled: true,
  scoreWeights: {
    severity: {
      error: 10,
      warning: 5,
      info: 2,
      hint: 1,
    },
    category: {
      security: 10,
      performance: 8,
      quality: 6,
      bestPractices: 5,
      maintainability: 4,
      complexity: 3,
      style: 2,
      documentation: 2,
      testing: 3,
      duplication: 4,
    },
  },
};

// ============================================================================
// Review Engine
// ============================================================================

export class ReviewEngine {
  private config: ReviewEngineConfig;
  private languageDetector: LanguageDetector;
  private parserFactory: ParserFactory;
  private ruleRegistry: RuleRegistry;
  private templateManager: TemplateManager;
  private cache: Map<string, IssueBatch> = new Map();

  constructor(config: ReviewEngineConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.languageDetector = new LanguageDetector();
    this.parserFactory = new ParserFactory();
    this.ruleRegistry = new RuleRegistry();
    this.templateManager = new TemplateManager();
  }

  // ========================================================================
  // Core Review Methods
  // ========================================================================

  /**
   * Review a single file
   */
  async reviewFile(
    filePath: string,
    options: ReviewOptions = {}
  ): Promise<ReviewResult> {
    const startTime = Date.now();

    try {
      // Read file content
      const content = await fs.readFile(filePath, 'utf-8');
      const fileInfo = await this.getFileInfo(filePath, content);

      // Check cache
      const cacheKey = this.getCacheKey(filePath, content);
      if (this.config.cacheEnabled && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey)!;
        return this.buildReviewResult(cached.issues, cached.summary, startTime, {
          filesScanned: 1,
          linesAnalyzed: fileInfo.lines,
          issuesFound: cached.issues.length,
          issuesFixed: 0,
          coverage: 100,
          score: this.calculateScore(cached.summary),
        });
      }

      // Parse file
      const ast = await this.parserFactory.parse(fileInfo.language, content);

      // Apply rules
      const issues = await this.applyRules(filePath, content, ast, fileInfo, options);

      // Create summary
      const summary = this.createSummary(issues);

      // Cache result
      const batch: IssueBatch = { issues, summary, files: new Map([[filePath, fileInfo]]) };
      if (this.config.cacheEnabled) {
        this.cache.set(cacheKey, batch);
      }

      return this.buildReviewResult(issues, summary, startTime, {
        filesScanned: 1,
        linesAnalyzed: fileInfo.lines,
        issuesFound: issues.length,
        issuesFixed: 0,
        coverage: 100,
        score: this.calculateScore(summary),
      });
    } catch (error) {
      return this.buildReviewErrorResult(filePath, error as Error, startTime);
    }
  }

  /**
   * Review multiple files
   */
  async reviewFiles(
    filePaths: string[],
    options: ReviewOptions = {}
  ): Promise<ReviewResult> {
    const startTime = Date.now();
    const limit = pLimit(this.config.maxConcurrentFiles!);

    const results = await Promise.all(
      filePaths.map((filePath) =>
        limit(() => this.reviewFile(filePath, options))
      )
    );

    // Aggregate results
    const allIssues = results.flatMap((r) => (r.success ? r.issues : []));
    const aggregatedSummary = this.aggregateSummaries(results.map((r) => r.summary));
    const totalMetrics = this.aggregateMetrics(results.map((r) => r.metrics));

    return {
      success: true,
      issues: allIssues,
      summary: aggregatedSummary,
      metrics: {
        ...totalMetrics,
        score: this.calculateScore(aggregatedSummary),
      },
      duration: Date.now() - startTime,
      timestamp: new Date(),
    };
  }

  /**
   * Review a pull request
   */
  async reviewPullRequest(
    pr: PullRequestInfo,
    context: AnalysisContext,
    options: ReviewOptions = {}
  ): Promise<PRReviewResult> {
    const startTime = Date.now();

    // Review only changed files
    const changedFiles = pr.changedFiles.filter((f) => f.status !== 'deleted');
    const filePaths = changedFiles.map((f) => path.join(context.workingDirectory, f.path));

    // Review files
    const reviewResult = await this.reviewFiles(filePaths, {
      ...options,
      minSeverity: options.minSeverity || 'warning',
    });

    // Generate comments for PR
    const comments = await this.generatePRComments(reviewResult.issues, pr);

    // Calculate review score
    const reviewScore = this.calculateReviewScore(reviewResult, pr);

    // Determine approval status
    const approvalStatus = this.determineApprovalStatus(reviewResult, reviewScore);

    // Generate recommendations
    const recommendations = this.generateRecommendations(reviewResult, pr);

    return {
      pr,
      review: reviewResult,
      comments,
      approvalStatus,
      reviewScore,
      recommendations,
    };
  }

  /**
   * Review code changes (diff-based)
   */
  async reviewChanges(
    oldContent: string,
    newContent: string,
    filePath: string,
    options: ReviewOptions = {}
  ): Promise<ReviewResult> {
    const startTime = Date.now();

    // Get diff
    const changes = diffLines(oldContent, newContent);

    // Find added lines
    let newLineStart = 1;
    const addedLines: number[] = [];
    let currentNewLine = 1;

    for (const change of changes) {
      if (change.added) {
        const lines = change.value.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            addedLines.push(currentNewLine);
          }
          currentNewLine++;
        }
      } else if (change.removed) {
        const removedLines = change.value.split('\n').length;
        // Don't increment currentNewLine for removed lines
      } else {
        currentNewLine += change.value.split('\n').length;
      }
    }

    // Get file info
    const fileInfo = await this.getFileInfo(filePath, newContent);

    // Parse and review
    const ast = await this.parserFactory.parse(fileInfo.language, newContent);
    const allIssues = await this.applyRules(filePath, newContent, ast, fileInfo, options);

    // Filter to only issues in changed lines
    const changedLineIssues = allIssues.filter((issue) =>
      addedLines.includes(issue.location.line)
    );

    const summary = this.createSummary(changedLineIssues);

    return this.buildReviewResult(changedLineIssues, summary, startTime, {
      filesScanned: 1,
      linesAnalyzed: addedLines.length,
      issuesFound: changedLineIssues.length,
      issuesFixed: 0,
      coverage: (addedLines.length / fileInfo.lines) * 100,
      score: this.calculateScore(summary),
    });
  }

  // ========================================================================
  // Rule Application
  // ========================================================================

  private async applyRules(
    filePath: string,
    content: string,
    ast: unknown,
    fileInfo: FileInfo,
    options: ReviewOptions
  ): Promise<Issue[]> {
    const rules = this.ruleRegistry.getRulesForLanguage(fileInfo.language);
    const issues: Issue[] = [];

    for (const rule of rules) {
      // Check if rule should be applied
      if (!this.shouldApplyRule(rule, options)) {
        continue;
      }

      try {
        const ruleIssues = await rule.execute(filePath, content, ast, fileInfo);
        issues.push(...ruleIssues);
      } catch (error) {
        // Log rule error but continue
        console.warn(`Rule ${rule.id} failed: ${(error as Error).message}`);
      }
    }

    // Filter issues by options
    return this.filterIssues(issues, options);
  }

  private shouldApplyRule(rule: { category: Category; severity: Severity }, options: ReviewOptions): boolean {
    // Check category filter
    if (options.includeCategories && !options.includeCategories.includes(rule.category)) {
      return false;
    }
    if (options.excludeCategories && options.excludeCategories.includes(rule.category)) {
      return false;
    }

    // Check severity filter
    if (options.minSeverity) {
      const severityOrder: Record<Severity, number> = {
        error: 4,
        warning: 3,
        info: 2,
        hint: 1,
      };
      if (severityOrder[rule.severity] < severityOrder[options.minSeverity]) {
        return false;
      }
    }

    return true;
  }

  private filterIssues(issues: Issue[], options: ReviewOptions): Issue[] {
    let filtered = issues;

    // Apply max issues limit
    if (options.maxIssues && filtered.length > options.maxIssues) {
      // Sort by severity and take top issues
      const severityOrder: Record<Severity, number> = {
        error: 4,
        warning: 3,
        info: 2,
        hint: 1,
      };
      filtered = filtered
        .sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity])
        .slice(0, options.maxIssues);
    }

    return filtered;
  }

  // ========================================================================
  // PR Comment Generation
  // ========================================================================

  private async generatePRComments(
    issues: Issue[],
    pr: PullRequestInfo
  ): Promise<ReviewComment[]> {
    const comments: ReviewComment[] = [];

    for (const issue of issues) {
      const comment = await this.templateManager.renderComment(issue, pr);
      comments.push({
        id: this.generateId(),
        issueId: issue.id,
        prNumber: pr.number,
        file: issue.location.path,
        line: issue.location.line,
        body: comment,
        author: 'claudeflare-bot',
        createdAt: new Date(),
        resolved: false,
      });
    }

    return comments;
  }

  // ========================================================================
  // Scoring and Approval
  // ========================================================================

  private calculateScore(summary: IssueSummary): number {
    let totalScore = 0;
    const weights = this.config.scoreWeights!;

    for (const [severity, count] of Object.entries(summary.bySeverity)) {
      totalScore += count * weights.severity[severity as Severity];
    }

    for (const [category, count] of Object.entries(summary.byCategory)) {
      totalScore += count * weights.category[category as Category];
    }

    // Convert to 0-100 scale (inverse - lower score is better)
    const maxScore = 1000; // Arbitrary high score
    return Math.max(0, Math.min(100, 100 - (totalScore / maxScore) * 100));
  }

  private calculateReviewScore(review: ReviewResult, pr: PullRequestInfo): number {
    // Base score from review metrics
    let score = review.metrics.score;

    // Adjust for PR size
    const size = pr.additions + pr.deletions;
    if (size < 100) {
      // Small PRs should be nearly perfect
      score *= 1.2;
    } else if (size > 1000) {
      // Large PRs get some leniency
      score *= 0.9;
    }

    // Check for critical issues
    const criticalIssues = review.issues.filter(
      (i) => i.severity === 'error' || i.category === 'security'
    );
    if (criticalIssues.length > 0) {
      score -= criticalIssues.length * 20;
    }

    return Math.max(0, Math.min(100, score));
  }

  private determineApprovalStatus(
    review: ReviewResult,
    score: number
  ): 'approved' | 'changes_requested' | 'commented' | 'pending' {
    const criticalIssues = review.issues.filter(
      (i) => i.severity === 'error' || i.category === 'security'
    );

    if (criticalIssues.length > 0) {
      return 'changes_requested';
    }

    if (score < 50) {
      return 'changes_requested';
    }

    if (score < 70) {
      return 'commented';
    }

    if (review.issues.length === 0) {
      return 'approved';
    }

    return 'commented';
  }

  private generateRecommendations(review: ReviewResult, pr: PullRequestInfo): string[] {
    const recommendations: string[] = [];

    // Check for critical issues
    const criticalIssues = review.issues.filter(
      (i) => i.severity === 'error' || i.category === 'security'
    );
    if (criticalIssues.length > 0) {
      recommendations.push(
        `Address ${criticalIssues.length} critical issue(s) before merging`
      );
    }

    // Check PR size
    const size = pr.additions + pr.deletions;
    if (size > 500) {
      recommendations.push('Consider splitting this large PR into smaller, focused changes');
    }

    // Check for test coverage
    const testFiles = pr.changedFiles.filter((f) => f.path.includes('.test.') || f.path.includes('.spec.'));
    if (testFiles.length === 0 && size > 100) {
      recommendations.push('Add tests to verify the changes');
    }

    // Check for documentation
    const docsChanged = pr.changedFiles.some((f) => f.path.includes('docs') || f.path.endsWith('.md'));
    if (!docsChanged && size > 200) {
      recommendations.push('Update documentation to reflect the changes');
    }

    return recommendations;
  }

  // ========================================================================
  // Summary and Metrics
  // ========================================================================

  private createSummary(issues: Issue[]): IssueSummary {
    const summary: IssueSummary = {
      total: issues.length,
      bySeverity: { error: 0, warning: 0, info: 0, hint: 0 },
      byCategory: {} as Record<Category, number>,
      byFile: {},
    };

    // Initialize categories
    const categories: Category[] = [
      'security',
      'performance',
      'quality',
      'style',
      'best-practices',
      'documentation',
      'testing',
      'maintainability',
      'complexity',
      'duplication',
    ];
    for (const category of categories) {
      summary.byCategory[category] = 0;
    }

    // Count issues
    for (const issue of issues) {
      summary.bySeverity[issue.severity]++;
      summary.byCategory[issue.category]++;
      summary.byFile[issue.location.path] = (summary.byFile[issue.location.path] || 0) + 1;
    }

    return summary;
  }

  private aggregateSummaries(summaries: IssueSummary[]): IssueSummary {
    const aggregated: IssueSummary = {
      total: 0,
      bySeverity: { error: 0, warning: 0, info: 0, hint: 0 },
      byCategory: {} as Record<Category, number>,
      byFile: {},
    };

    // Initialize categories
    const categories: Category[] = [
      'security',
      'performance',
      'quality',
      'style',
      'best-practices',
      'documentation',
      'testing',
      'maintainability',
      'complexity',
      'duplication',
    ];
    for (const category of categories) {
      aggregated.byCategory[category] = 0;
    }

    // Sum all summaries
    for (const summary of summaries) {
      aggregated.total += summary.total;
      for (const [severity, count] of Object.entries(summary.bySeverity)) {
        aggregated.bySeverity[severity as Severity] += count;
      }
      for (const [category, count] of Object.entries(summary.byCategory)) {
        aggregated.byCategory[category as Category] += count;
      }
      for (const [file, count] of Object.entries(summary.byFile)) {
        aggregated.byFile[file] = (aggregated.byFile[file] || 0) + count;
      }
    }

    return aggregated;
  }

  private aggregateMetrics(metrics: ReviewMetrics[]): ReviewMetrics {
    return {
      filesScanned: metrics.reduce((sum, m) => sum + m.filesScanned, 0),
      linesAnalyzed: metrics.reduce((sum, m) => sum + m.linesAnalyzed, 0),
      issuesFound: metrics.reduce((sum, m) => sum + m.issuesFound, 0),
      issuesFixed: metrics.reduce((sum, m) => sum + m.issuesFixed, 0),
      coverage:
        metrics.reduce((sum, m) => sum + m.coverage, 0) / metrics.length,
      score:
        metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length,
    };
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private async getFileInfo(filePath: string, content: string): Promise<FileInfo> {
    const language = this.languageDetector.detectFromPath(filePath);
    const lines = content.split('\n').length;
    const size = Buffer.byteLength(content, 'utf8');
    const hash = this.hashContent(content);

    return {
      path: filePath,
      language,
      size,
      lines,
      encoding: 'utf-8',
      hash,
    };
  }

  private getCacheKey(filePath: string, content: string): string {
    return `${filePath}:${this.hashContent(content)}`;
  }

  private hashContent(content: string): string {
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private buildReviewResult(
    issues: Issue[],
    summary: IssueSummary,
    startTime: number,
    metrics: Omit<ReviewMetrics, 'score'>
  ): ReviewResult {
    return {
      success: true,
      issues,
      summary,
      metrics: {
        ...metrics,
        score: this.calculateScore(summary),
      },
      duration: Date.now() - startTime,
      timestamp: new Date(),
    };
  }

  private buildReviewErrorResult(filePath: string, error: Error, startTime: number): ReviewResult {
    return {
      success: false,
      issues: [],
      summary: {
        total: 0,
        bySeverity: { error: 0, warning: 0, info: 0, hint: 0 },
        byCategory: {} as Record<Category, number>,
        byFile: {},
      },
      metrics: {
        filesScanned: 0,
        linesAnalyzed: 0,
        issuesFound: 0,
        issuesFixed: 0,
        coverage: 0,
        score: 0,
      },
      duration: Date.now() - startTime,
      timestamp: new Date(),
    };
  }

  // ========================================================================
  // Public API Methods
  // ========================================================================

  /**
   * Clear the review cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Update engine configuration
   */
  updateConfig(config: Partial<ReviewEngineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ReviewEngineConfig {
    return { ...this.config };
  }
}
