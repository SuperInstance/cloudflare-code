/**
 * Code Review Service for Cloudflare Workers
 * Simplified version that works with in-memory content analysis
 */

import type { AnalysisResult, Language, Issue } from '../../packages/code-review/src/types/index.js';

export interface CodeReviewConfig {
  includeQuality?: boolean;
  includeSecurity?: boolean;
  includePerformance?: boolean;
  includeStyle?: boolean;
  includePractices?: boolean;
  includeMetrics?: boolean;
}

export interface CodeReviewRequest {
  content: string;
  filePath?: string;
  config?: CodeReviewConfig;
}

export interface CodeReviewResponse {
  success: boolean;
  result?: AnalysisResult;
  error?: string;
  duration: number;
}

export class CodeReviewService {

  /**
   * Detect language from file extension and content
   */
  detectLanguage(filePath: string, content: string): Language {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';

    const extensionMap: Record<string, Language> = {
      'ts': 'typescript',
      'js': 'javascript',
      'py': 'python',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'cpp',
      'cs': 'csharp',
      'rb': 'ruby',
      'php': 'php',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'dart': 'dart'
    };

    const language = extensionMap[extension] || this.detectLanguageFromContent(content);
    return language;
  }

  /**
   * Detect language from content patterns
   */
  private detectLanguageFromContent(content: string): Language {
    const firstLines = content.split('\n').slice(0, 10).join('\n').toLowerCase();

    if (firstLines.includes('import ') && firstLines.includes(' from ')) {
      return firstLines.includes('.tsx') || firstLines.includes('.ts') ? 'typescript' : 'javascript';
    }
    if (firstLines.includes('def ') && firstLines.includes(':')) return 'python';
    if (firstLines.includes('package main') && firstLines.includes('import')) return 'go';
    if (firstLines.includes('fn ') && firstLines.includes('{')) return 'rust';
    if (firstLines.includes('public class ') || firstLines.includes('public interface')) return 'java';
    if (firstLines.includes('#include') && firstLines.includes('<iostream>')) return 'cpp';
    if (firstLines.includes('using System')) return 'csharp';
    if (firstLines.includes('require ') || firstLines.includes('.rb')) return 'ruby';
    if (firstLines.includes('<?php')) return 'php';
    if (firstLines.includes('func ') && firstLines.includes('{')) return 'swift';
    if (firstLines.includes('fun ') && firstLines.includes('{')) return 'kotlin';
    if (firstLines.includes('object ') && firstLines.includes('{')) return 'scala';
    if (firstLines.includes('import ') && firstLines.includes('dart:')) return 'dart';

    return 'javascript'; // Default fallback
  }

  /**
   * Perform a comprehensive code review
   */
  async reviewCode(request: CodeReviewRequest): Promise<CodeReviewResponse> {
    const startTime = Date.now();

    try {
      const { content, filePath = 'code.ts', config = {} } = request;

      if (!content || typeof content !== 'string') {
        return {
          success: false,
          error: 'Content is required and must be a string',
          duration: Date.now() - startTime
        };
      }

      if (!content.trim()) {
        return {
          success: false,
          error: 'Content cannot be empty',
          duration: Date.now() - startTime
        };
      }

      const language = this.detectLanguage(filePath, content);
      const analysisResult = await this.performAnalysis(filePath, content, language, config);

      return {
        success: true,
        result: analysisResult,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Perform the actual analysis
   */
  private async performAnalysis(
    filePath: string,
    content: string,
    language: Language,
    _config: CodeReviewConfig
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    // Basic file info
    const fileInfo = {
      path: filePath,
      language,
      size: new TextEncoder().encode(content).length,
      lines: content.split('\n').length,
    };

    // Detect basic issues
    const issues = this.detectBasicIssues(content, language, fileInfo);

    // Generate review metrics
    this.calculateBasicMetrics(content, language);

    return {
      context: {
        workingDirectory: '/',
        repositoryRoot: '/',
        branch: 'main',
        commit: 'HEAD',
        author: 'unknown',
        timestamp: new Date(),
        environment: 'local',
      },
      review: {
        success: true,
        issues: issues.filter(i => i.category === 'quality' || i.category === 'best-practices'),
        summary: {
          total: issues.length,
          bySeverity: this.calculateSeverityCounts(issues),
          byCategory: this.calculateCategoryCounts(issues),
          byFile: { [filePath]: issues.length },
        },
        metrics: {
          filesScanned: 1,
          linesAnalyzed: content.split('\n').length,
          issuesFound: issues.length,
          issuesFixed: 0,
          coverage: 100,
          score: this.calculateScore(issues),
        },
        duration: Date.now() - startTime,
        timestamp: new Date(),
      },
      quality: {
        maintainabilityIndex: this.calculateMaintainability(content),
        technicalDebt: this.calculateTechnicalDebt(issues),
        codeDuplication: this.calculateDuplication(content),
        codeSmells: issues.filter(i => i.category === 'quality').length,
        complexity: {
          cyclomatic: this.calculateCyclomaticComplexity(content),
          cognitive: this.calculateCognitiveComplexity(content),
          nestingDepth: this.calculateNestingDepth(content),
          parameters: this.calculateMaxParameters(content),
          complexity: this.calculateOverallComplexity(content),
        },
        testCoverage: 0, // Not calculated in this simplified version
        documentationCoverage: 0, // Not calculated in this simplified version
      },
      security: {
        issues: issues.filter(i => i.category === 'security') as any,
        summary: {
          critical: issues.filter(i => i.category === 'security' && i.severity === 'error').length,
          high: issues.filter(i => i.category === 'security' && i.severity === 'warning').length,
          medium: 0,
          low: 0,
          totalRiskScore: 0,
        },
        dependencies: [], // Not calculated in this simplified version
      },
      performance: {
        bottlenecks: [],
        recommendations: this.generatePerformanceRecommendations(content),
      },
      style: issues.filter(i => i.category === 'style') as any,
      practices: issues.filter(i => i.category === 'best-practices') as any,
      timestamp: new Date(),
      duration: Date.now() - startTime,
    };
  }

  /**
   * Detect basic code issues
   */
  private detectBasicIssues(content: string, language: Language, fileInfo: any): Issue[] {
    const issues: Issue[] = [];
    const lines = content.split('\n');

    // Check for TODO comments
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (line && (line.toLowerCase().includes('todo:') || line.toLowerCase().includes('fixme:'))) {
        issues.push({
          id: `TODO-${Date.now()}-${i}`,
          ruleId: 'todo-comment',
          severity: 'info',
          category: 'best-practices',
          title: 'TODO Comment Found',
          description: `TODO comment found at line ${i + 1}`,
          location: {
            path: fileInfo.path,
            line: i + 1,
            column: 1,
          },
          suggestion: 'Address TODO items or remove if no longer needed',
          timestamp: new Date(),
        });
      }
    }

    // Check for console.log (potential debugging code in production)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && line.includes('console.log')) {
        const consoleIndex = line.indexOf('console.log');
        issues.push({
          id: `CONSOLE-LOG-${Date.now()}-${i}`,
          ruleId: 'console-log',
          severity: 'warning',
          category: 'performance',
          title: 'Console Log in Production',
          description: `console.log found at line ${i + 1}`,
          location: {
            path: fileInfo.path,
            line: i + 1,
            column: consoleIndex !== -1 ? consoleIndex + 1 : 1,
          },
          suggestion: 'Remove console.log statements in production code',
          timestamp: new Date(),
        });
      }
    }

    // Check for long lines (style issue)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && line.length > 120) {
        issues.push({
          id: `LONG-LINE-${Date.now()}-${i}`,
          ruleId: 'long-line',
          severity: 'hint',
          category: 'style',
          title: 'Line Too Long',
          description: `Line ${i + 1} is ${line.length} characters long (recommended max: 120)`,
          location: {
            path: fileInfo.path,
            line: i + 1,
            column: 1,
          },
          suggestion: 'Break long lines into multiple lines',
          timestamp: new Date(),
        });
      }
    }

    // Check for empty lines (style issue)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const prevLine = lines[i - 1];
      const nextLine = lines[i + 1];
      if (line && line.trim() === '' && i > 0 && i < lines.length - 1) {
        // Check if there are multiple empty lines
        if ((prevLine && prevLine.trim() === '') || (nextLine && nextLine.trim() === '')) {
          issues.push({
            id: `EXTRA-BLANK-${Date.now()}-${i}`,
            ruleId: 'extra-blank-line',
            severity: 'hint',
            category: 'style',
            title: 'Extra Blank Line',
            description: `Extra blank line at line ${i + 1}`,
            location: {
              path: fileInfo.path,
              line: i + 1,
            },
            suggestion: 'Remove unnecessary blank lines',
            timestamp: new Date(),
          });
        }
      }
    }

    // Language-specific checks
    if (language === 'javascript' || language === 'typescript') {
      this.checkJavaScriptIssues(content, fileInfo, issues);
    } else if (language === 'python') {
      this.checkPythonIssues(content, fileInfo, issues);
    }

    return issues;
  }

  /**
   * Check JavaScript/TypeScript specific issues
   */
  private checkJavaScriptIssues(content: string, fileInfo: any, issues: Issue[]) {
    const lines = content.split('\n');

    // Check for var usage
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const varMatch = line.match(/\bvar\s+(\w+)/);
      if (varMatch) {
        const varIndex = line.indexOf('var');
        issues.push({
          id: `VAR-USAGE-${Date.now()}-${i}`,
          ruleId: 'var-usage',
          severity: 'warning',
          category: 'best-practices',
          title: 'Use of var keyword',
          description: `var keyword used at line ${i + 1}`,
          location: {
            path: fileInfo.path,
            line: i + 1,
            column: varIndex !== -1 ? varIndex + 1 : 1,
          },
          suggestion: 'Use let or const instead of var',
          timestamp: new Date(),
        });
      }
    }

    // Check for unused imports (basic detection)
    const importMatches = content.matchAll(/import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g);
    for (const match of importMatches) {
      // This is a simplified check - real implementation would need AST parsing
      if (match[1] && !content.includes(match[1].replace(/\./g, ''))) {
        const line = content.substring(0, match.index).split('\n').length;
        issues.push({
          id: `UNUSED-IMPORT-${Date.now()}-${line}`,
          ruleId: 'unused-import',
          severity: 'warning',
          category: 'maintainability',
          title: 'Potentially Unused Import',
          description: `Import ${match[1]} may be unused`,
          location: {
            path: fileInfo.path,
            line,
            column: content.substring(0, match.index).lastIndexOf('\n') + 1,
          },
          suggestion: 'Remove unused imports',
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Check Python specific issues
   */
  private checkPythonIssues(content: string, fileInfo: any, issues: Issue[]) {
    const lines = content.split('\n');

    // Check for snake_case in functions
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const functionMatch = line.match(/def\s+([A-Z][a-zA-Z0-9_]*)\s*\(/);
      if (functionMatch) {
        const defIndex = line.indexOf('def');
        issues.push({
          id: `SNAKE-CASE-${Date.now()}-${i}`,
          ruleId: 'snake-case',
          severity: 'warning',
          category: 'style',
          title: 'Function Name Should Be Snake Case',
          description: `Function name ${functionMatch[1]} should be snake_case`,
          location: {
            path: fileInfo.path,
            line: i + 1,
            column: defIndex !== -1 ? defIndex + 1 : 1,
          },
          suggestion: 'Rename function to snake_case format',
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Calculate basic metrics
   */
  private calculateBasicMetrics(content: string, language: Language) {
    return {
      maintainabilityIndex: this.calculateMaintainability(content),
      technicalDebt: this.calculateTechnicalDebt(this.detectBasicIssues(content, language, { path: '', language, size: 0, lines: 0 })),
      codeDuplication: this.calculateDuplication(content),
      codeSmells: 0,
      complexity: {
        cyclomatic: this.calculateCyclomaticComplexity(content),
        cognitive: this.calculateCognitiveComplexity(content),
        nestingDepth: this.calculateNestingDepth(content),
        parameters: this.calculateMaxParameters(content),
        complexity: this.calculateOverallComplexity(content),
      },
      testCoverage: 0,
      documentationCoverage: 0,
    };
  }

  /**
   * Calculate cyclomatic complexity
   */
  private calculateCyclomaticComplexity(content: string): number {
    let complexity = 1; // Base complexity

    const patterns = [
      /\b(if|else if|while|for|case|catch|switch)\b/g,
      /\band\b/g,
      /\bor\b/g,
      /\?/g,
      /\|\|/g,
      /&&/g,
    ];

    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });

    return complexity;
  }

  /**
   * Calculate cognitive complexity
   */
  private calculateCognitiveComplexity(content: string): number {
    let complexity = 0;
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('if ') || trimmed.startsWith('while ')) {
        complexity += 1;
      }
      if (trimmed.includes('||') || trimmed.includes('&&')) {
        complexity += 1;
      }
      if (trimmed.includes(' for ') || trimmed.includes('while ')) {
        complexity += 1;
      }
    }

    return complexity;
  }

  /**
   * Calculate nesting depth
   */
  private calculateNestingDepth(content: string): number {
    let maxDepth = 0;
    let currentDepth = 0;

    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      const openBrackets = (trimmed.match(/[({[]/g) || []).length;
      const closeBrackets = (trimmed.match(/[)}\]]/g) || []).length;

      currentDepth += openBrackets - closeBrackets;
      maxDepth = Math.max(maxDepth, currentDepth);
    }

    return maxDepth;
  }

  /**
   * Calculate maximum parameters in function
   */
  private calculateMaxParameters(content: string): number {
    let maxParams = 0;
    const functionMatches = content.matchAll(/(?:function\s+\w+|\w+\s*\([^)]*\)\s*=>|\bdef\s+\w+\s*\()/g);

    for (const match of functionMatches) {
      const paramsStr = match[0].match(/\(([^)]*)\)/)?.[1] || '';
      const params = paramsStr.split(',').filter(p => p.trim()).length;
      maxParams = Math.max(maxParams, params);
    }

    return maxParams;
  }

  /**
   * Calculate overall complexity
   */
  private calculateOverallComplexity(content: string): number {
    return Math.round((this.calculateCyclomaticComplexity(content) +
                      this.calculateCognitiveComplexity(content) +
                      this.calculateNestingDepth(content)) / 3);
  }

  /**
   * Calculate maintainability index
   */
  private calculateMaintainability(content: string): number {
    const loc = content.split('\n').length;
    const cc = this.calculateCyclomaticComplexity(content);

    // Halstead volume estimate
    const n1 = (content.match(/\b[a-zA-Z_]\w*\b/g) || []).length;
    const n2 = (content.match(/[\+\-\*\/=<>!&|]/g) || []).length;
    const vocabulary = n1 + n2;
    const length = content.replace(/\s/g, '').length;
    const volume = length * Math.log2(vocabulary);

    // Maintainability index formula
    const mi = 171 - 5.2 * Math.log10(volume) - 0.23 * cc - 16.2 * Math.log10(loc);

    return Math.round(Math.max(0, Math.min(100, mi)));
  }

  /**
   * Calculate technical debt
   */
  private calculateTechnicalDebt(issues: Issue[]): number {
    return issues.reduce((debt, issue) => {
      const severityWeight = {
        error: 3,
        warning: 2,
        info: 1,
        hint: 0.5,
      }[issue.severity] || 0;
      return debt + severityWeight;
    }, 0);
  }

  /**
   * Calculate code duplication
   */
  private calculateDuplication(content: string): number {
    const lines = content.split('\n').filter(line => line.trim());
    const uniqueLines = new Set(lines);
    return ((lines.length - uniqueLines.size) / lines.length) * 100;
  }

  /**
   * Calculate score based on issues
   */
  private calculateScore(issues: Issue[]): number {
    const severityWeight = {
      error: 5,
      warning: 3,
      info: 1,
      hint: 0.5,
    };

    const totalWeight = issues.reduce((score, issue) => {
      return score + (severityWeight[issue.severity] || 1);
    }, 0);

    return Math.round(Math.max(0, 100 - totalWeight));
  }

  /**
   * Generate performance recommendations
   */
  private generatePerformanceRecommendations(content: string): string[] {
    const recommendations = [];

    if (content.includes('console.log')) {
      recommendations.push('Remove console.log statements in production code');
    }

    if (content.includes('for (let i = 0; i < array.length; i++)')) {
      recommendations.push('Consider using array methods like forEach, map, or for...of for cleaner code');
    }

    if (content.includes('.slice()') && content.includes('.length')) {
      recommendations.push('Be careful with array.slice() as it creates a new array');
    }

    if (content.includes('eval(')) {
      recommendations.push('Avoid using eval() as it can be a security risk and performance bottleneck');
    }

    if (recommendations.length === 0) {
      recommendations.push('Good performance practices detected');
    }

    return recommendations;
  }

  /**
   * Calculate severity counts
   */
  private calculateSeverityCounts(issues: Issue[]): Record<string, number> {
    const counts = { error: 0, warning: 0, info: 0, hint: 0 };
    issues.forEach(issue => {
      counts[issue.severity] = (counts[issue.severity] || 0) + 1;
    });
    return counts;
  }

  /**
   * Calculate category counts
   */
  private calculateCategoryCounts(issues: Issue[]): Record<string, number> {
    const counts: Record<string, number> = {};
    issues.forEach(issue => {
      counts[issue.category] = (counts[issue.category] || 0) + 1;
    });
    return counts;
  }
}