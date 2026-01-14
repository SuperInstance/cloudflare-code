/**
 * Metrics Calculator - Calculates various code metrics and statistics
 */

import { Issue, ReviewMetrics, FileInfo, Language } from '../types/index.js';

// ============================================================================
// Metrics Calculator Options
// ============================================================================

interface MetricsCalculatorOptions {
  includeHistoricalTrends?: boolean;
  comparisonBaseline?: string;
}

const DEFAULT_OPTIONS: MetricsCalculatorOptions = {
  includeHistoricalTrends: true,
};

// ============================================================================
// Metrics Types
// ============================================================================

export interface CodeMetrics {
  linesOfCode: number;
  linesOfComments: number;
  linesOfBlank: number;
  commentRatio: number;
  complexity: number;
  maintainabilityIndex: number;
  technicalDebtRatio: number;
  codeDuplication: number;
  testCoverage: number;
  documentationCoverage: number;
}

export interface FileMetrics {
  path: string;
  language: Language;
  linesOfCode: number;
  linesOfComments: number;
  linesOfBlank: number;
  functions: number;
  classes: number;
  imports: number;
  exports: number;
}

export interface ContributionMetrics {
  author: string;
  commits: number;
  linesAdded: number;
  linesDeleted: number;
  filesChanged: number;
  averageCommitSize: number;
}

export interface VelocityMetrics {
  totalCommits: number;
  averageCommitsPerDay: number;
  averageCommitsPerWeek: number;
  activeDevelopers: number;
  codeChurn: number;
}

// ============================================================================
// Metrics Calculator
// ============================================================================

export class MetricsCalculator {
  private options: MetricsCalculatorOptions;
  private historicalData: Map<string, CodeMetrics[]> = new Map();

  constructor(options: MetricsCalculatorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ========================================================================
  // Code Metrics Calculation
  // ========================================================================

  /**
   * Calculate comprehensive code metrics
   */
  async calculateCodeMetrics(filePath: string, content: string, fileInfo: FileInfo): Promise<CodeMetrics> {
    const lines = content.split('\n');

    const linesOfCode = this.countLinesOfCode(lines);
    const linesOfComments = this.countLinesOfComments(lines, fileInfo.language);
    const linesOfBlank = lines.length - linesOfCode - linesOfComments;
    const commentRatio = linesOfCode > 0 ? (linesOfComments / linesOfCode) * 100 : 0;

    return {
      linesOfCode,
      linesOfComments,
      linesOfBlank,
      commentRatio,
      complexity: this.calculateCyclomaticComplexity(content),
      maintainabilityIndex: this.calculateMaintainabilityIndex(linesOfCode, linesOfComments),
      technicalDebtRatio: this.calculateTechnicalDebtRatio(content, linesOfCode),
      codeDuplication: await this.calculateCodeDuplication(content),
      testCoverage: 0, // Requires coverage reports
      documentationCoverage: this.calculateDocumentationCoverage(content),
    };
  }

  /**
   * Calculate file metrics
   */
  async calculateFileMetrics(filePath: string, content: string, fileInfo: FileInfo): Promise<FileMetrics> {
    const lines = content.split('\n');

    return {
      path: filePath,
      language: fileInfo.language,
      linesOfCode: this.countLinesOfCode(lines),
      linesOfComments: this.countLinesOfComments(lines, fileInfo.language),
      linesOfBlank: this.countBlankLines(lines),
      functions: this.countFunctions(content, fileInfo.language),
      classes: this.countClasses(content, fileInfo.language),
      imports: this.countImports(content, fileInfo.language),
      exports: this.countExports(content, fileInfo.language),
    };
  }

  /**
   * Calculate review metrics
   */
  calculateReviewMetrics(issues: Issue[], filesScanned: number, linesAnalyzed: number): ReviewMetrics {
    const summary = this.createSummary(issues);

    return {
      filesScanned,
      linesAnalyzed,
      issuesFound: issues.length,
      issuesFixed: 0,
      coverage: this.calculateIssueCoverage(issues, linesAnalyzed),
      score: this.calculateQualityScore(summary),
    };
  }

  /**
   * Calculate contribution metrics (would need git history)
   */
  async calculateContributionMetrics(projectPath: string): Promise<ContributionMetrics[]> {
    // This would analyze git history
    // For now, return empty array
    return [];
  }

  /**
   * Calculate velocity metrics
   */
  async calculateVelocityMetrics(projectPath: string, days: number = 30): Promise<VelocityMetrics> {
    // This would analyze git history
    return {
      totalCommits: 0,
      averageCommitsPerDay: 0,
      averageCommitsPerWeek: 0,
      activeDevelopers: 0,
      codeChurn: 0,
    };
  }

  // ========================================================================
  // Complexity Metrics
  // ========================================================================

  /**
   * Calculate cyclomatic complexity
   */
  calculateCyclomaticComplexity(content: string): number {
    let complexity = 1; // Base complexity

    const decisionPoints = content.match(
      /\b(if|else|for|while|case|catch|&&|\|\||\?)\b/g
    );

    if (decisionPoints) {
      complexity += decisionPoints.length;
    }

    return complexity;
  }

  /**
   * Calculate cognitive complexity
   */
  calculateCognitiveComplexity(content: string): number {
    let complexity = 0;
    let nestingLevel = 0;
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Increase nesting for control structures
      if (/^\s*(if|else|for|while|switch|case|catch)\b/.test(trimmed)) {
        nestingLevel++;
        complexity += nestingLevel;
      }

      // Decrease nesting for closing braces
      const closeBraces = (trimmed.match(/\}/g) || []).length;
      nestingLevel = Math.max(0, nestingLevel - closeBraces);

      // Add complexity for break and continue
      if (/\b(break|continue)\b/.test(trimmed)) {
        complexity++;
      }

      // Add complexity for logical operators
      const logicalOps = (trimmed.match(/&&|\|\|/g) || []).length;
      complexity += logicalOps;
    }

    return complexity;
  }

  /**
   * Calculate nesting depth
   */
  calculateNestingDepth(content: string): number {
    let maxDepth = 0;
    let currentDepth = 0;
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Increase depth for opening control structures
      if (/^\s*(if|else|for|while|switch|case|catch|function)\b/.test(trimmed)) {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      }

      // Decrease depth for closing braces
      const closeBraces = (trimmed.match(/\}/g) || []).length;
      currentDepth = Math.max(0, currentDepth - closeBraces);
    }

    return maxDepth;
  }

  // ========================================================================
  // Quality Metrics
  // ========================================================================

  /**
   * Calculate maintainability index (Microsoft's formula)
   */
  calculateMaintainabilityIndex(linesOfCode: number, linesOfComments: number): number {
    if (linesOfCode === 0) return 100;

    // Simplified MI calculation
    const commentRatio = linesOfComments / linesOfCode;
    const mi = Math.max(0, Math.min(100, 50 + commentRatio * 50));

    return Math.round(mi * 100) / 100;
  }

  /**
   * Calculate technical debt ratio
   */
  calculateTechnicalDebtRatio(content: string, linesOfCode: number): number {
    // Count technical debt indicators
    const todos = (content.match(/TODO|FIXME|HACK|XXX/g) || []).length;
    const complexity = this.calculateCyclomaticComplexity(content);

    const debtScore = todos * 5 + Math.max(0, complexity - 10) * 2;
    const ratio = linesOfCode > 0 ? (debtScore / linesOfCode) * 100 : 0;

    return Math.round(ratio * 100) / 100;
  }

  /**
   * Calculate code duplication percentage
   */
  async calculateCodeDuplication(content: string): Promise<number> {
    const lines = content.split('\n');
    const blockSize = 6;
    const duplications = new Set<string>();

    for (let i = 0; i <= lines.length - blockSize; i++) {
      const block = lines.slice(i, i + blockSize).map(l => l.trim()).join('|');
      if (block.length > 50) { // Only consider significant blocks
        duplications.add(block);
      }
    }

    // Count duplicates (blocks that appear more than once)
    const totalBlocks = lines.length - blockSize + 1;
    const duplicateBlocks = duplications.size;

    return totalBlocks > 0 ? Math.round((duplicateBlocks / totalBlocks) * 100) : 0;
  }

  /**
   * Calculate documentation coverage
   */
  calculateDocumentationCoverage(content: string): number {
    const lines = content.split('\n');
    let documentedFunctions = 0;
    let totalFunctions = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect function declaration
      if (/function\s+\w+|=>\s*{|^\s*\w+\s*\([^)]*\)\s*{/.test(line)) {
        totalFunctions++;

        // Check if previous line is a comment
        if (i > 0) {
          const prevLine = lines[i - 1].trim();
          if (prevLine.startsWith('*') || prevLine.startsWith('//') || prevLine.startsWith('#')) {
            documentedFunctions++;
          }
        }
      }
    }

    return totalFunctions > 0 ? Math.round((documentedFunctions / totalFunctions) * 100) : 0;
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private countLinesOfCode(lines: string[]): number {
    return lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('#') && !trimmed.startsWith('*');
    }).length;
  }

  private countLinesOfComments(lines: string[], language: Language): number {
    let count = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) {
        count++;
      }
    }

    return count;
  }

  private countBlankLines(lines: string[]): number {
    return lines.filter(line => line.trim().length === 0).length;
  }

  private countFunctions(content: string, language: Language): number {
    let count = 0;

    if (language === 'typescript' || language === 'javascript') {
      count += (content.match(/function\s+\w+/g) || []).length;
      count += (content.match(/\w+\s*:\s*\([^)]*\)\s*=>/g) || []).length;
      count += (content.match(/=>\s*{/g) || []).length;
    } else if (language === 'python') {
      count += (content.match(/def\s+\w+/g) || []).length;
    } else if (language === 'go') {
      count += (content.match(/func\s+\w+\s*\(/g) || []).length;
    } else if (language === 'java') {
      count += (content.match(/(public|private|protected)?\s*(static)?\s*\w+\s+\w+\s*\(/g) || []).length;
    }

    return count;
  }

  private countClasses(content: string, language: Language): number {
    let count = 0;

    if (language === 'typescript' || language === 'javascript' || language === 'java') {
      count += (content.match(/class\s+\w+/g) || []).length;
    } else if (language === 'python') {
      count += (content.match(/class\s+\w+/g) || []).length;
    } else if (language === 'go') {
      // Go doesn't have classes, but structs
      count += (content.match(/type\s+\w+\s+struct/g) || []).length;
    }

    return count;
  }

  private countImports(content: string, language: Language): number {
    let count = 0;

    if (language === 'typescript' || language === 'javascript') {
      count += (content.match(/import\s+.*from/g) || []).length;
      count += (content.match(/require\s*\(/g) || []).length;
    } else if (language === 'python') {
      count += (content.match(/^import\s+|^from\s+.*import/gm) || []).length;
    } else if (language === 'go') {
      count += (content.match(/import\s+/g) || []).length;
    } else if (language === 'java') {
      count += (content.match(/import\s+/g) || []).length;
    }

    return count;
  }

  private countExports(content: string, language: Language): number {
    let count = 0;

    if (language === 'typescript' || language === 'javascript') {
      count += (content.match(/export\s+/g) || []).length;
      count += (content.match(/module\.exports/g) || []).length;
    } else if (language === 'python') {
      count += (content.match(/__all__\s*=/g) || []).length;
    }

    return count;
  }

  private createSummary(issues: Issue[]): any {
    return {
      total: issues.length,
      bySeverity: {
        error: issues.filter(i => i.severity === 'error').length,
        warning: issues.filter(i => i.severity === 'warning').length,
        info: issues.filter(i => i.severity === 'info').length,
        hint: issues.filter(i => i.severity === 'hint').length,
      },
      byCategory: {
        security: issues.filter(i => i.category === 'security').length,
        performance: issues.filter(i => i.category === 'performance').length,
        quality: issues.filter(i => i.category === 'quality').length,
        style: issues.filter(i => i.category === 'style').length,
        'best-practices': issues.filter(i => i.category === 'best-practices').length,
      },
    };
  }

  private calculateIssueCoverage(issues: Issue[], linesAnalyzed: number): number {
    return linesAnalyzed > 0 ? Math.round((issues.length / linesAnalyzed) * 1000) / 10 : 0;
  }

  private calculateQualityScore(summary: any): number {
    const weights = {
      error: 10,
      warning: 5,
      info: 2,
      hint: 1,
    };

    let totalScore = 0;
    for (const [severity, count] of Object.entries(summary.bySeverity)) {
      totalScore += (count as number) * weights[severity as keyof typeof weights];
    }

    // Convert to 0-100 scale (inverse - lower score is better)
    const maxScore = 1000;
    return Math.max(0, Math.min(100, 100 - (totalScore / maxScore) * 100));
  }

  // ========================================================================
  // Historical Trends
  // ========================================================================

  /**
   * Store metrics for historical analysis
   */
  storeHistoricalMetrics(filePath: string, metrics: CodeMetrics): void {
    if (!this.historicalData.has(filePath)) {
      this.historicalData.set(filePath, []);
    }

    const history = this.historicalData.get(filePath)!;
    history.push({
      ...metrics,
      timestamp: Date.now(),
    } as any);

    // Keep only last 100 entries
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Calculate trend for a metric
   */
  calculateTrend(filePath: string, metric: keyof CodeMetrics): {
    direction: 'improving' | 'stable' | 'declining';
    change: number;
  } {
    const history = this.historicalData.get(filePath);
    if (!history || history.length < 2) {
      return { direction: 'stable', change: 0 };
    }

    const latest = history[history.length - 1][metric] as number;
    const previous = history[history.length - 2][metric] as number;

    const change = previous > 0 ? ((latest - previous) / previous) * 100 : 0;

    let direction: 'improving' | 'stable' | 'declining';
    if (Math.abs(change) < 5) {
      direction = 'stable';
    } else if (
      (metric === 'maintainabilityIndex' && change > 0) ||
      (metric === 'complexity' && change < 0) ||
      (metric === 'technicalDebtRatio' && change < 0) ||
      (metric === 'codeDuplication' && change < 0)
    ) {
      direction = 'improving';
    } else {
      direction = 'declining';
    }

    return { direction, change };
  }

  /**
   * Get historical metrics
   */
  getHistoricalMetrics(filePath: string): CodeMetrics[] {
    return this.historicalData.get(filePath) || [];
  }

  /**
   * Clear historical data
   */
  clearHistoricalData(): void {
    this.historicalData.clear();
  }
}
