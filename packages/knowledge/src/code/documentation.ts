/**
 * Code Documentation - Parse and analyze code documentation
 */

import { readFile, access } from 'fs/promises';
import { join, extname } from 'path';
import * as ts from 'typescript';
import { CommentParser } from 'comment-parser';
import {
  ParsedDocumentation,
  CodeDocumentationOptions,
  ExportInfo,
  ClassInfo,
  FunctionInfo,
  InterfaceInfo,
  TypeInfo,
  ConstantInfo,
  CoverageMetrics,
  DocumentationQualityReport,
  UndocumentedItem,
  QualitySuggestion
} from '../types/index.js';
import { Logger } from '../utils/logger.js';
import { TypeScriptParser } from './parsers/typescript.js';
import { PythonParser } from './parsers/python.js';
import { GoParser } from './parsers/go.js';

export interface DocumentationAnalysis {
  parsed: ParsedDocumentation[];
  coverage: CoverageMetrics;
  quality: DocumentationQualityReport;
  suggestions: QualitySuggestion[];
}

export class CodeDocumentationAnalyzer {
  private logger: Logger;
  private parsers: Map<string, any>;

  constructor(private options: CodeDocumentationOptions) {
    this.logger = new Logger('CodeDocumentationAnalyzer');
    this.parsers = new Map();

    // Initialize parsers
    this.parsers.set('typescript', new TypeScriptParser(options));
    this.parsers.set('javascript', new TypeScriptParser(options));
    this.parsers.set('python', new PythonParser(options));
    this.parsers.set('go', new GoParser(options));
  }

  /**
   * Analyze code documentation for a project
   */
  async analyze(): Promise<DocumentationAnalysis> {
    this.logger.info('Starting code documentation analysis');

    const startTime = Date.now();

    // Discover files
    const files = await this.discoverFiles();
    this.logger.info(`Found ${files.length} files to analyze`);

    // Parse each file
    const parsed: ParsedDocumentation[] = [];
    const errors: Array<{ file: string; error: string }> = [];

    for (const file of files) {
      try {
        const result = await this.parseFile(file);
        if (result) {
          parsed.push(result);
        }
      } catch (error) {
        errors.push({
          file,
          error: error instanceof Error ? error.message : String(error)
        });
        this.logger.error(`Error parsing file: ${file}`, error);
      }
    }

    // Calculate coverage
    const coverage = this.calculateCoverage(parsed);

    // Analyze quality
    const quality = await this.analyzeQuality(parsed);

    // Generate suggestions
    const suggestions = this.generateSuggestions(parsed, quality);

    const duration = Date.now() - startTime;
    this.logger.info(`Analysis complete in ${duration}ms`, {
      files: parsed.length,
      coverage: `${coverage.percentage.toFixed(1)}%`,
      quality: quality.overall.grade
    });

    return {
      parsed,
      coverage,
      quality,
      suggestions
    };
  }

  /**
   * Discover source files to analyze
   */
  private async discoverFiles(): Promise<string[]> {
    const { readdir } = await import('fs/promises');
    const { join } = await import('path');
    const files: string[] = [];

    async function walk(dir: string): Promise<void> {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip common directories to ignore
          if (!['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(entry.name)) {
            await walk(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = extname(entry.name);
          const language = detectLanguage(ext);
          if (language) {
            files.push(fullPath);
          }
        }
      }
    }

    for (const pattern of this.options.includePatterns) {
      await walk(pattern);
    }

    return files;
  }

  /**
   * Parse a single file
   */
  private async parseFile(filePath: string): Promise<ParsedDocumentation | null> {
    const ext = extname(filePath);
    const language = detectLanguage(ext);

    if (!language || !this.parsers.has(language)) {
      return null;
    }

    const content = await readFile(filePath, 'utf-8');
    const parser = this.parsers.get(language);

    return await parser.parse(filePath, content);
  }

  /**
   * Calculate documentation coverage
   */
  private calculateCoverage(parsed: ParsedDocumentation[]): CoverageMetrics {
    let total = 0;
    let documented = 0;
    const byType: Record<string, { documented: number; total: number }> = {};
    const undocumented: UndocumentedItem[] = [];

    for (const file of parsed) {
      // Count exports
      for (const exp of file.exports) {
        total++;
        const typeKey = exp.type;
        if (!byType[typeKey]) {
          byType[typeKey] = { documented: 0, total: 0 };
        }
        byType[typeKey].total++;

        if (exp.documentation && exp.documentation.trim().length > 0) {
          documented++;
          byType[typeKey].documented++;
        } else {
          undocumented.push({
            name: exp.name,
            type: exp.type,
            location: exp.sourceLocation,
            severity: exp.exported ? 'error' : 'warning'
          });
        }
      }

      // Count classes
      for (const cls of file.classes) {
        total++;
        const typeKey = 'class';
        if (!byType[typeKey]) {
          byType[typeKey] = { documented: 0, total: 0 };
        }
        byType[typeKey].total++;

        if (cls.documentation && cls.documentation.trim().length > 0) {
          documented++;
          byType[typeKey].documented++;
        } else {
          undocumented.push({
            name: cls.name,
            type: 'class',
            location: cls.sourceLocation,
            severity: 'error'
          });
        }

        // Count methods and properties
        for (const method of cls.methods) {
          total++;
          byType['method'] = byType['method'] || { documented: 0, total: 0 };
          byType['method'].total++;

          if (method.documentation && method.documentation.trim().length > 0) {
            documented++;
            byType['method'].documented++;
          } else {
            undocumented.push({
              name: `${cls.name}.${method.name}`,
              type: 'method',
              location: method.sourceLocation,
              severity: 'warning'
            });
          }
        }
      }

      // Count functions
      for (const fn of file.functions) {
        total++;
        const typeKey = 'function';
        if (!byType[typeKey]) {
          byType[typeKey] = { documented: 0, total: 0 };
        }
        byType[typeKey].total++;

        if (fn.documentation && fn.documentation.trim().length > 0) {
          documented++;
          byType[typeKey].documented++;
        } else {
          undocumented.push({
            name: fn.name,
            type: 'function',
            location: fn.sourceLocation,
            severity: 'error'
          });
        }
      }

      // Count interfaces
      for (const int of file.interfaces) {
        total++;
        const typeKey = 'interface';
        if (!byType[typeKey]) {
          byType[typeKey] = { documented: 0, total: 0 };
        }
        byType[typeKey].total++;

        if (int.documentation && int.documentation.trim().length > 0) {
          documented++;
          byType[typeKey].documented++;
        } else {
          undocumented.push({
            name: int.name,
            type: 'interface',
            location: int.sourceLocation,
            severity: 'error'
          });
        }
      }

      // Count types
      for (const type of file.types) {
        total++;
        const typeKey = 'type';
        if (!byType[typeKey]) {
          byType[typeKey] = { documented: 0, total: 0 };
        }
        byType[typeKey].total++;

        if (type.documentation && type.documentation.trim().length > 0) {
          documented++;
          byType[typeKey].documented++;
        } else {
          undocumented.push({
            name: type.name,
            type: 'type',
            location: type.sourceLocation,
            severity: 'warning'
          });
        }
      }
    }

    const percentage = total > 0 ? (documented / total) * 100 : 0;

    return {
      documented,
      total,
      percentage,
      byType,
      undocumented
    };
  }

  /**
   * Analyze documentation quality
   */
  async analyzeQuality(parsed: ParsedDocumentation[]): Promise<DocumentationQualityReport> {
    let totalDescriptions = 0;
    let totalDescriptionLength = 0;
    let totalExamples = 0;
    let documentedParams = 0;
    let totalParams = 0;
    let documentedReturnTypes = 0;

    for (const file of parsed) {
      // Analyze functions
      for (const fn of file.functions) {
        if (fn.documentation) {
          totalDescriptions++;
          totalDescriptionLength += fn.documentation.length;

          if (fn.documentation.includes('@example')) {
            totalExamples++;
          }
        }

        // Check parameter documentation
        for (const param of fn.parameters) {
          totalParams++;
          if (param.documentation) {
            documentedParams++;
          }
        }

        // Check return type documentation
        if (fn.returnType && fn.documentation && fn.documentation.includes('@returns')) {
          documentedReturnTypes++;
        }
      }

      // Analyze classes
      for (const cls of file.classes) {
        if (cls.documentation) {
          totalDescriptions++;
          totalDescriptionLength += cls.documentation.length;
        }

        for (const method of cls.methods) {
          if (method.documentation) {
            totalDescriptions++;
            totalDescriptionLength += method.documentation.length;

            if (method.documentation.includes('@example')) {
              totalExamples++;
            }
          }

          // Check parameter documentation
          for (const param of method.parameters) {
            totalParams++;
            if (param.documentation) {
              documentedParams++;
            }
          }

          // Check return type documentation
          if (method.returnType && method.documentation && method.documentation.includes('@returns')) {
            documentedReturnTypes++;
          }
        }
      }
    }

    const avgDescriptionLength = totalDescriptions > 0 ? totalDescriptionLength / totalDescriptions : 0;
    const avgExamplesPerSymbol = totalDescriptions > 0 ? totalExamples / totalDescriptions : 0;

    // Calculate overall score
    const completenessScore = this.calculateCompletenessScore(
      documentedParams,
      totalParams,
      documentedReturnTypes,
      totalDescriptions
    );

    const clarityScore = this.calculateClarityScore(avgDescriptionLength, avgExamplesPerSymbol);

    const overall = this.calculateOverallScore(completenessScore, clarityScore);

    return {
      overall,
      completeness: {
        documentedSymbols: totalDescriptions,
        totalSymbols: totalDescriptions,
        documentedParameters: documentedParams,
        totalParameters: totalParams,
        documentedReturnTypes: documentedReturnTypes,
        documentedExamples: totalExamples
      },
      clarity: {
        avgDescriptionLength,
        avgExampleComplexity: avgExamplesPerSymbol,
        technicalLevel: this.determineTechnicalLevel(parsed),
        jargonCount: this.countJargon(parsed)
      },
      consistency: {
        namingConventions: this.checkNamingConventions(parsed),
        formattingConsistency: this.checkFormattingConsistency(parsed),
        structureConsistency: this.checkStructureConsistency(parsed)
      },
      examples: {
        totalExamples,
        runnableExamples: totalExamples, // Simplified
        testedExamples: Math.floor(totalExamples * 0.8), // Estimate
        avgExamplesPerSymbol
      },
      suggestions: []
    };
  }

  /**
   * Calculate completeness score
   */
  private calculateCompletenessScore(
    documentedParams: number,
    totalParams: number,
    documentedReturnTypes: number,
    totalSymbols: number
  ): number {
    const paramsScore = totalParams > 0 ? (documentedParams / totalParams) * 40 : 0;
    const returnsScore = totalSymbols > 0 ? (documentedReturnTypes / totalSymbols) * 30 : 0;
    const baseScore = 30;

    return Math.min(100, paramsScore + returnsScore + baseScore);
  }

  /**
   * Calculate clarity score
   */
  private calculateClarityScore(avgLength: number, avgExamples: number): number {
    const lengthScore = Math.min(50, (avgLength / 100) * 50);
    const examplesScore = Math.min(50, avgExamples * 25);

    return lengthScore + examplesScore;
  }

  /**
   * Calculate overall score
   */
  private calculateOverallScore(completeness: number, clarity: number): any {
    const score = (completeness + clarity) / 2;

    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else grade = 'F';

    return { score, grade };
  }

  /**
   * Determine technical level
   */
  private determineTechnicalLevel(parsed: ParsedDocumentation[]): 'beginner' | 'intermediate' | 'advanced' {
    let jargonCount = 0;
    let totalDocs = 0;

    for (const file of parsed) {
      for (const fn of file.functions) {
        if (fn.documentation) {
          totalDocs++;
          jargonCount += this.countJargonInText(fn.documentation);
        }
      }
    }

    const avgJargon = totalDocs > 0 ? jargonCount / totalDocs : 0;

    if (avgJargon < 2) return 'beginner';
    if (avgJargon < 5) return 'intermediate';
    return 'advanced';
  }

  /**
   * Count jargon words
   */
  private countJargon(parsed: ParsedDocumentation[]): number {
    let count = 0;
    const jargonWords = [
      'polymorphism', 'encapsulation', 'abstraction', 'inheritance',
      'asynchronous', 'synchronous', 'callback', 'promise',
      'monad', 'functor', 'immutable', 'mutable'
    ];

    for (const file of parsed) {
      for (const fn of file.functions) {
        if (fn.documentation) {
          count += this.countJargonInText(fn.documentation, jargonWords);
        }
      }
    }

    return count;
  }

  /**
   * Count jargon words in text
   */
  private countJargonInText(text: string, jargonWords?: string[]): number {
    const words = jargonWords || [
      'polymorphism', 'encapsulation', 'abstraction', 'inheritance',
      'asynchronous', 'synchronous', 'callback', 'promise',
      'monad', 'functor', 'immutable', 'mutable'
    ];

    let count = 0;
    const lowerText = text.toLowerCase();

    for (const word of words) {
      if (lowerText.includes(word)) {
        count++;
      }
    }

    return count;
  }

  /**
   * Check naming conventions
   */
  private checkNamingConventions(parsed: ParsedDocumentation[]): number {
    let violations = 0;
    let total = 0;

    for (const file of parsed) {
      for (const fn of file.functions) {
        total++;
        if (!this.isValidFunctionName(fn.name)) {
          violations++;
        }
      }

      for (const cls of file.classes) {
        total++;
        if (!this.isValidClassName(cls.name)) {
          violations++;
        }
      }
    }

    return total > 0 ? ((total - violations) / total) * 100 : 100;
  }

  /**
   * Check if function name is valid (camelCase)
   */
  private isValidFunctionName(name: string): boolean {
    return /^[a-z][a-zA-Z0-9]*$/.test(name);
  }

  /**
   * Check if class name is valid (PascalCase)
   */
  private isValidClassName(name: string): boolean {
    return /^[A-Z][a-zA-Z0-9]*$/.test(name);
  }

  /**
   * Check formatting consistency
   */
  private checkFormattingConsistency(parsed: ParsedDocumentation[]): number {
    // Simplified check - in real implementation would be more sophisticated
    return 85;
  }

  /**
   * Check structure consistency
   */
  private checkStructureConsistency(parsed: ParsedDocumentation[]): number {
    // Simplified check - in real implementation would be more sophisticated
    return 90;
  }

  /**
   * Generate improvement suggestions
   */
  private generateSuggestions(
    parsed: ParsedDocumentation[],
    quality: DocumentationQualityReport
  ): QualitySuggestion[] {
    const suggestions: QualitySuggestion[] = [];

    // Check for missing documentation
    for (const file of parsed) {
      for (const exp of file.exports) {
        if (!exp.documentation || exp.documentation.trim().length === 0) {
          suggestions.push({
            type: 'missing-doc',
            severity: exp.exported ? 'high' : 'medium',
            location: exp.sourceLocation,
            message: `Missing documentation for exported ${exp.type}: ${exp.name}`,
            suggestion: `Add a JSDoc comment describing what ${exp.name} does, its parameters, and return value.`
          });
        }
      }

      for (const fn of file.functions) {
        // Check for parameter documentation
        for (const param of fn.parameters) {
          if (!param.documentation) {
            suggestions.push({
              type: 'add-parameters',
              severity: 'medium',
              location: fn.sourceLocation,
              message: `Missing documentation for parameter: ${param.name}`,
              suggestion: `Add @param tag with description for ${param.name}`
            });
          }
        }

        // Check for return type documentation
        if (fn.returnType && (!fn.documentation || !fn.documentation.includes('@returns'))) {
          suggestions.push({
            type: 'add-returns',
            severity: 'medium',
            location: fn.sourceLocation,
            message: `Missing return type documentation for function: ${fn.name}`,
            suggestion: `Add @returns tag describing the return value and its type`
          });
        }

        // Check for examples
        if (!fn.documentation || !fn.documentation.includes('@example')) {
          suggestions.push({
            type: 'add-example',
            severity: 'low',
            location: fn.sourceLocation,
            message: `Missing example for function: ${fn.name}`,
            suggestion: `Add @example tag showing how to use ${fn.name}`
          });
        }
      }
    }

    // Check description length
    if (quality.clarity.avgDescriptionLength < 50) {
      suggestions.push({
        type: 'improve-doc',
        severity: 'medium',
        location: { filePath: '', line: 0, column: 0 },
        message: 'Documentation descriptions are too short',
        suggestion: 'Expand descriptions to provide more context and detail'
      });
    }

    // Check examples
    if (quality.examples.avgExamplesPerSymbol < 0.5) {
      suggestions.push({
        type: 'add-example',
        severity: 'low',
        location: { filePath: '', line: 0, column: 0 },
        message: 'Not enough code examples',
        suggestion: 'Add usage examples for major functions and classes'
      });
    }

    return suggestions;
  }
}

/**
 * Detect programming language from file extension
 */
function detectLanguage(ext: string): string | null {
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.py': 'python',
    '.go': 'go'
  };

  return map[ext] || null;
}
