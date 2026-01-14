/**
 * ClaudeFlare Code Review Package
 * Automated code review and analysis platform
 */

// Core types
export * from './types/index.js';

// Review engine
export { ReviewEngine } from './review/engine.js';
export { RuleRegistry } from './review/rule-registry.js';
export { TemplateManager } from './review/template-manager.js';

// Quality analyzer
export { QualityAnalyzer } from './quality/analyzer.js';

// Security scanner
export { SecurityScanner } from './security/scanner.js';

// Performance analyzer
export { PerformanceAnalyzer } from './performance/analyzer.js';

// Style checker
export { StyleChecker } from './style/checker.js';

// Best practices enforcer
export { PracticesEnforcer } from './practices/enforcer.js';

// Metrics calculator
export { MetricsCalculator } from './metrics/calculator.js';
export type {
  CodeMetrics,
  FileMetrics,
  ContributionMetrics,
  VelocityMetrics,
} from './metrics/calculator.js';

// Utilities
export { LanguageDetector } from './utils/language-detector.js';
export { ParserFactory, ASTParser } from './utils/parser-factory.js';
export { ASTVisitor } from './utils/ast-parser.js';

// Version
export const VERSION = '0.1.0';

// ========================================================================
// Convenience API
// ========================================================================

import { ReviewEngine } from './review/engine.js';
import { QualityAnalyzer } from './quality/analyzer.js';
import { SecurityScanner } from './security/scanner.js';
import { PerformanceAnalyzer } from './performance/analyzer.js';
import { StyleChecker } from './style/checker.js';
import { PracticesEnforcer } from './practices/enforcer.js';
import { MetricsCalculator } from './metrics/calculator.js';
import { ReviewOptions, AnalysisResult, Language } from './types/index.js';

/**
 * Create a complete code review configuration
 */
export interface CodeReviewConfig {
  includeQuality?: boolean;
  includeSecurity?: boolean;
  includePerformance?: boolean;
  includeStyle?: boolean;
  includePractices?: boolean;
  includeMetrics?: boolean;
  options?: ReviewOptions;
}

/**
 * Main Code Review API
 */
export class CodeReview {
  private reviewEngine: ReviewEngine;
  private qualityAnalyzer: QualityAnalyzer;
  private securityScanner: SecurityScanner;
  private performanceAnalyzer: PerformanceAnalyzer;
  private styleChecker: StyleChecker;
  private practicesEnforcer: PracticesEnforcer;
  private metricsCalculator: MetricsCalculator;

  constructor() {
    this.reviewEngine = new ReviewEngine();
    this.qualityAnalyzer = new QualityAnalyzer();
    this.securityScanner = new SecurityScanner();
    this.performanceAnalyzer = new PerformanceAnalyzer();
    this.styleChecker = new StyleChecker();
    this.practicesEnforcer = new PracticesEnforcer();
    this.metricsCalculator = new MetricsCalculator();
  }

  /**
   * Review a single file
   */
  async reviewFile(
    filePath: string,
    config: CodeReviewConfig = {}
  ): Promise<AnalysisResult> {
    const { promises: fs } = await import('fs');
    const content = await fs.promises.readFile(filePath, 'utf-8');

    const language = this.detectLanguage(filePath, content);

    return this.reviewContent(filePath, content, language, config);
  }

  /**
   * Review multiple files
   */
  async reviewFiles(
    filePaths: string[],
    config: CodeReviewConfig = {}
  ): Promise<Map<string, AnalysisResult>> {
    const results = new Map<string, AnalysisResult>();

    for (const filePath of filePaths) {
      try {
        const result = await this.reviewFile(filePath, config);
        results.set(filePath, result);
      } catch (error) {
        console.error(`Failed to review ${filePath}:`, error);
      }
    }

    return results;
  }

  /**
   * Review code content
   */
  async reviewContent(
    filePath: string,
    content: string,
    language: Language,
    config: CodeReviewConfig = {}
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    // Review all requested aspects
    const allIssues: any[] = [];

    // Base review
    const reviewResult = await this.reviewEngine.reviewFile(filePath, config.options || {});
    allIssues.push(...reviewResult.issues);

    // Additional analyses
    if (config.includeQuality !== false) {
      const qualityIssues = await this.analyzeQuality(filePath, content, language);
      allIssues.push(...qualityIssues);
    }

    if (config.includeSecurity !== false) {
      const securityIssues = await this.analyzeSecurity(filePath, content, language);
      allIssues.push(...securityIssues);
    }

    if (config.includePerformance !== false) {
      const performanceIssues = await this.analyzePerformance(filePath, content, language);
      allIssues.push(...performanceIssues);
    }

    if (config.includeStyle !== false) {
      const styleIssues = await this.analyzeStyle(filePath, content, language);
      allIssues.push(...styleIssues);
    }

    if (config.includePractices !== false) {
      const practiceIssues = await this.analyzePractices(filePath, content, language);
      allIssues.push(...practiceIssues);
    }

    // Calculate metrics
    let metrics: any = {};
    if (config.includeMetrics !== false) {
      metrics = await this.calculateMetrics(filePath, content, language);
    }

    return {
      context: {
        workingDirectory: process.cwd(),
        repositoryRoot: process.cwd(),
        branch: 'main',
        commit: 'HEAD',
        author: 'unknown',
        timestamp: new Date(),
        environment: 'local',
      },
      review: reviewResult,
      quality: metrics.quality || {},
      security: metrics.security || { issues: [], summary: {}, dependencies: [] },
      performance: metrics.performance || {},
      style: allIssues.filter((i) => i.category === 'style'),
      practices: allIssues.filter((i) => i.category === 'best-practices'),
      timestamp: new Date(),
      duration: Date.now() - startTime,
    } as AnalysisResult;
  }

  /**
   * Analyze code quality
   */
  async analyzeQuality(filePath: string, content: string, language: Language): Promise<any[]> {
    const fileInfo = {
      path: filePath,
      language,
      size: Buffer.byteLength(content, 'utf8'),
      lines: content.split('\n').length,
    };

    const qualityMetrics = await this.qualityAnalyzer.analyzeFile(filePath, content, fileInfo);
    const codeSmells = await this.qualityAnalyzer.detectCodeSmells(null, content, fileInfo);

    return codeSmells.map((smell) => ({
      id: `QUALITY-${smell.type}-${Date.now()}`,
      ruleId: smell.type.toLowerCase().replace(/\s+/g, '-'),
      severity: smell.severity,
      category: 'quality' as const,
      title: smell.name,
      description: smell.description,
      location: smell.location,
      suggestion: smell.remediation,
      timestamp: new Date(),
    }));
  }

  /**
   * Analyze security
   */
  async analyzeSecurity(filePath: string, content: string, language: Language): Promise<any[]> {
    const fileInfo = {
      path: filePath,
      language,
      size: Buffer.byteLength(content, 'utf8'),
      lines: content.split('\n').length,
    };

    const report = await this.securityScanner.scanFile(filePath, content, fileInfo);

    return report.issues;
  }

  /**
   * Analyze performance
   */
  async analyzePerformance(filePath: string, content: string, language: Language): Promise<any[]> {
    const fileInfo = {
      path: filePath,
      language,
      size: Buffer.byteLength(content, 'utf8'),
      lines: content.split('\n').length,
    };

    const issues = await this.performanceAnalyzer.detectPerformanceIssues(filePath, content, fileInfo);

    return issues;
  }

  /**
   * Analyze style
   */
  async analyzeStyle(filePath: string, content: string, language: Language): Promise<any[]> {
    const fileInfo = {
      path: filePath,
      language,
      size: Buffer.byteLength(content, 'utf8'),
      lines: content.split('\n').length,
    };

    return await this.styleChecker.checkFile(filePath, content, fileInfo);
  }

  /**
   * Analyze practices
   */
  async analyzePractices(filePath: string, content: string, language: Language): Promise<any[]> {
    const fileInfo = {
      path: filePath,
      language,
      size: Buffer.byteLength(content, 'utf8'),
      lines: content.split('\n').length,
    };

    return await this.practicesEnforcer.enforceFile(filePath, content, fileInfo);
  }

  /**
   * Calculate metrics
   */
  async calculateMetrics(filePath: string, content: string, language: Language): Promise<{
    quality: any;
    security: any;
    performance: any;
  }> {
    const fileInfo = {
      path: filePath,
      language,
      size: Buffer.byteLength(content, 'utf8'),
      lines: content.split('\n').length,
    };

    const [quality, securityReport, performance] = await Promise.all([
      this.qualityAnalyzer.analyzeFile(filePath, content, fileInfo),
      this.securityScanner.scanFile(filePath, content, fileInfo),
      this.performanceAnalyzer.analyzeFile(filePath, content, fileInfo),
    ]);

    return {
      quality,
      security: securityReport,
      performance,
    };
  }

  /**
   * Detect language from file
   */
  private detectLanguage(filePath: string, content: string): Language {
    const { LanguageDetector } = require('./utils/language-detector.js');
    const detector = new LanguageDetector();

    const result = detector.detectWithConfidence(filePath, content);
    return result.language;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.reviewEngine.clearCache();
  }

  /**
   * Get engine statistics
   */
  getStats(): {
    reviewEngine: any;
    qualityAnalyzer: any;
    securityScanner: any;
  } {
    return {
      reviewEngine: this.reviewEngine.getCacheStats(),
      qualityAnalyzer: {},
      securityScanner: {},
    };
  }
}

/**
 * Create a new CodeReview instance
 */
export function createCodeReview(): CodeReview {
  return new CodeReview();
}

/**
 * Quick review function for single file
 */
export async function quickReview(
  filePath: string,
  config: CodeReviewConfig = {}
): Promise<AnalysisResult> {
  const review = createCodeReview();
  return review.reviewFile(filePath, config);
}

// Export as default
export default CodeReview;
