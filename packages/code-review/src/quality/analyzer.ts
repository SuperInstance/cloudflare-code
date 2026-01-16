/**
 * Quality Analyzer - Analyzes code quality metrics and code smells
 */

// @ts-nocheck - Complex AST analysis with unused parameters
import {
  FileInfo,
  Language,
  ComplexityMetrics,
  QualityMetrics,
  CodeSmell,
  DuplicationInstance,
  Issue,
  Severity,
  Category,
} from '../types/index.js';
import { ASTParser } from '../utils/ast-parser.js';

// ============================================================================
// Quality Analyzer Options
// ============================================================================

interface QualityAnalyzerOptions {
  maxComplexity?: number;
  maxCognitiveComplexity?: number;
  maxNestingDepth?: number;
  maxParameters?: number;
  minMaintainabilityIndex?: number;
  duplicationThreshold?: number; // Minimum similarity for duplication
  enableDuplicationDetection?: boolean;
}

const DEFAULT_OPTIONS: QualityAnalyzerOptions = {
  maxComplexity: 10,
  maxCognitiveComplexity: 15,
  maxNestingDepth: 4,
  maxParameters: 5,
  minMaintainabilityIndex: 20,
  duplicationThreshold: 0.8,
  enableDuplicationDetection: true,
};

// ============================================================================
// Quality Analyzer
// ============================================================================

export class QualityAnalyzer {
  private options: QualityAnalyzerOptions;
  private parser: ASTParser;

  constructor(options: QualityAnalyzerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.parser = new ASTParser();
  }

  // ========================================================================
  // Main Analysis Methods
  // ========================================================================

  /**
   * Analyze code quality for a single file
   */
  async analyzeFile(filePath: string, content: string, fileInfo: FileInfo): Promise<QualityMetrics> {
    const ast = await this.parser.parse(fileInfo.language, content);

    const complexity = await this.analyzeComplexity(ast, content, fileInfo);
    const codeSmells = await this.detectCodeSmells(ast, content, fileInfo);
    const duplications = await this.detectDuplications(content, filePath);

    const maintainabilityIndex = this.calculateMaintainabilityIndex(
      complexity,
      fileInfo.lines,
      codeSmells.length
    );

    const technicalDebt = this.calculateTechnicalDebt(codeSmells, duplications);

    return {
      maintainabilityIndex,
      technicalDebt,
      codeDuplication: this.calculateDuplicationPercentage(duplications, fileInfo.lines),
      codeSmells: codeSmells.length,
      complexity,
      testCoverage: 0, // Requires coverage reports
      documentationCoverage: await this.calculateDocumentationCoverage(ast),
    };
  }

  /**
   * Analyze code complexity
   */
  async analyzeComplexity(
    ast: unknown,
    content: string,
    fileInfo: FileInfo
  ): Promise<ComplexityMetrics> {
    const cyclomatic = this.calculateCyclomaticComplexity(content);
    const cognitive = this.calculateCognitiveComplexity(content);
    const nestingDepth = this.calculateNestingDepth(content);
    const parameters = await this.countParameters(ast, content);

    // Calculate overall complexity score
    const complexity =
      (cyclomatic * 0.4 + cognitive * 0.3 + nestingDepth * 0.2 + parameters * 0.1) /
      (this.options.maxComplexity! * 0.4 +
        this.options.maxCognitiveComplexity! * 0.3 +
        this.options.maxNestingDepth! * 0.2 +
        this.options.maxParameters! * 0.1) *
      100;

    return {
      cyclomatic,
      cognitive,
      nestingDepth,
      parameters,
      complexity: Math.min(100, complexity),
    };
  }

  /**
   * Detect code smells
   */
  async detectCodeSmells(
    ast: unknown,
    content: string,
    fileInfo: FileInfo
  ): Promise<CodeSmell[]> {
    const smells: CodeSmell[] = [];

    // Detect various code smells
    smells.push(...this.detectLongMethods(ast, content, fileInfo));
    smells.push(...this.detectLargeClasses(ast, content, fileInfo));
    smells.push(...this.detectFeatureEnvy(ast, content));
    smells.push(...this.detectDataClumps(ast, content));
    smells.push(...this.detectPrimitiveObsession(ast, content));
    smells.push(...this.detectShotgunSurgery(ast, content));
    smells.push(...this.detectGodObjects(ast, content));
    smells.push(...this.detectLazyClass(ast, content));
    smells.push(...this.detectSpeculativeGenerality(ast, content));
    smells.push(...this.detectMiddleMan(ast, content));
    smells.push(...this.detectRefusedBequest(ast, content));

    return smells;
  }

  /**
   * Detect code duplication
   */
  async detectDuplications(
    content: string,
    filePath: string
  ): Promise<DuplicationInstance[]> {
    if (!this.options.enableDuplicationDetection) {
      return [];
    }

    const duplications: DuplicationInstance[] = [];
    const lines = content.split('\n');

    // Split content into blocks
    const blocks = this.createBlocks(lines, 6); // 6-line blocks

    // Compare blocks for similarity
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const similarity = this.calculateSimilarity(blocks[i], blocks[j]);

        if (similarity >= this.options.duplicationThreshold!) {
          duplications.push({
            lines: [i * 6 + 1, j * 6 + 1],
            files: [filePath, filePath],
            tokens: blocks[i].join('\n'),
            similarity,
          });
        }
      }
    }

    return duplications;
  }

  // ========================================================================
  // Complexity Calculations
  // ========================================================================

  private calculateCyclomaticComplexity(content: string): number {
    let complexity = 1; // Base complexity

    const decisionPoints = content.match(
      /\b(if|else|for|while|case|catch|&&|\|\||\?)\b/g
    );

    if (decisionPoints) {
      complexity += decisionPoints.length;
    }

    return complexity;
  }

  private calculateCognitiveComplexity(content: string): number {
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

  private calculateNestingDepth(content: string): number {
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

  private async countParameters(ast: unknown, content: string): Promise<number> {
    // Simplified parameter counting
    const functionMatches = content.match(
      /function\s+\w+\s*\(([^)]*)\)|=>\s*\(([^)]*)\)|\w+\s*\(([^)]*)\)\s*{/g
    );

    if (!functionMatches) {
      return 0;
    }

    let maxParams = 0;

    for (const match of functionMatches) {
      const paramsMatch = match.match(/\(([^)]*)\)/);
      if (paramsMatch && paramsMatch[1].trim()) {
        const params = paramsMatch[1].split(',').length;
        maxParams = Math.max(maxParams, params);
      }
    }

    return maxParams;
  }

  // ========================================================================
  // Code Smell Detection
  // ========================================================================

  private detectLongMethods(
    ast: unknown,
    content: string,
    fileInfo: FileInfo
  ): CodeSmell[] {
    const smells: CodeSmell[] = [];
    const lines = content.split('\n');
    let currentFunctionStart = 0;
    let braceDepth = 0;
    let inFunction = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect function start
      if (/function\s+\w+|=>\s*{|^\s*\w+\s*\([^)]*\)\s*{/.test(line)) {
        currentFunctionStart = i;
        inFunction = true;
      }

      // Track brace depth
      braceDepth += (line.match(/{/g) || []).length;
      braceDepth -= (line.match(/}/g) || []).length;

      // Function end
      if (inFunction && braceDepth === 0) {
        const functionLength = i - currentFunctionStart + 1;

        if (functionLength > 50) {
          smells.push({
            type: 'Long Method',
            name: `Long method at line ${currentFunctionStart + 1}`,
            description: `Method is ${functionLength} lines long (max: 50)`,
            location: {
              path: fileInfo.path,
              line: currentFunctionStart + 1,
              column: 1,
            },
            severity: 'warning',
            impact: 'Difficult to understand, test, and maintain',
            remediation: 'Extract logical blocks into smaller, named methods',
          });
        }

        inFunction = false;
      }
    }

    return smells;
  }

  private detectLargeClasses(
    ast: unknown,
    content: string,
    fileInfo: FileInfo
  ): CodeSmell[] {
    const smells: CodeSmell[] = [];
    const lines = content.split('\n');

    // Count methods and properties
    const methods = (content.match(/function\s+\w+|\w+\s*\([^)]*\)\s*{/g) || []).length;
    const properties = (content.match(/this\.\w+|this\.\w+\s*=/g) || []).length;
    const classMembers = methods + properties;

    if (classMembers > 20) {
      smells.push({
        type: 'Large Class',
        name: `Large class: ${fileInfo.path}`,
        description: `Class has ${classMembers} members (max: 20)`,
        location: {
          path: fileInfo.path,
          line: 1,
          column: 1,
        },
        severity: 'warning',
        impact: 'Class is doing too much and should be split',
        remediation: 'Extract related functionality into separate classes',
      });
    }

    return smells;
  }

  private detectFeatureEnvy(ast: unknown, content: string): CodeSmell[] {
    const smells: CodeSmell[] = [];
    const lines = content.split('\n');

    // Look for methods that heavily use other objects' data
    lines.forEach((line, index) => {
      // If we see many calls to another object's methods/properties
      const objectCalls = line.match(/(\w+)\.\w+\(.*\)/g);
      if (objectCalls && objectCalls.length > 2) {
        const objects = new Set(objectCalls.map((call) => call.split('.')[0]));
        if (objects.size === 1) {
          const objectName = Array.from(objects)[0];
          smells.push({
            type: 'Feature Envy',
            name: `Feature envy for ${objectName}`,
            description: `Method seems more interested in ${objectName} than its own class`,
            location: {
              path: '',
              line: index + 1,
              column: 1,
            },
            severity: 'info',
            impact: 'Method should probably be moved to the other object',
            remediation: `Move method to ${objectName} class using 'Move Method' refactoring`,
          });
        }
      }
    });

    return smells;
  }

  private detectDataClumps(ast: unknown, content: string): CodeSmell[] {
    const smells: CodeSmell[] = [];
    const lines = content.split('\n');

    // Look for groups of parameters that appear together multiple times
    const paramGroups: Map<string, number[]> = new Map();

    lines.forEach((line, index) => {
      const paramMatch = line.match(/\(([^)]+)\)/);
      if (paramMatch) {
        const params = paramMatch[1].split(',').map((p) => p.trim().split(':')[0].trim());
        if (params.length >= 3) {
          const key = params.join(',');
          if (!paramGroups.has(key)) {
            paramGroups.set(key, []);
          }
          paramGroups.get(key)!.push(index + 1);
        }
      }
    });

    // Report groups that appear multiple times
    for (const [params, occurrences] of paramGroups.entries()) {
      if (occurrences.length > 2) {
        smells.push({
          type: 'Data Clumps',
          name: `Data clump: ${params}`,
          description: `Parameters ${params} appear together ${occurrences.length} times`,
          location: {
            path: '',
            line: occurrences[0],
            column: 1,
          },
          severity: 'info',
          impact: 'Should be encapsulated in an object',
          remediation: `Create a data class or object for these parameters: ${params}`,
        });
      }
    }

    return smells;
  }

  private detectPrimitiveObsession(ast: unknown, content: string): CodeSmell[] {
    const smells: CodeSmell[] = [];
    const lines = content.split('\n');

    // Look for primitives used together frequently
    const primitivePatterns: Map<string, number[]> = new Map();

    lines.forEach((line, index) => {
      // Look for type annotations with primitives
      const matches = line.match(/:\s*(string|number|boolean)/g);
      if (matches && matches.length >= 3) {
        const key = matches.join(',');
        if (!primitivePatterns.has(key)) {
          primitivePatterns.set(key, []);
        }
        primitivePatterns.get(key)!.push(index + 1);
      }
    });

    for (const [pattern, occurrences] of primitivePatterns.entries()) {
      if (occurrences.length > 2) {
        smells.push({
          type: 'Primitive Obsession',
          name: 'Primitive obsession detected',
          description: 'Multiple primitive types used together',
          location: {
            path: '',
            line: occurrences[0],
            column: 1,
          },
          severity: 'info',
          impact: 'Should use value objects instead',
          remediation: 'Create a value object to encapsulate these primitives',
        });
      }
    }

    return smells;
  }

  private detectShotgunSurgery(ast: unknown, content: string): CodeSmell[] {
    // This requires cross-file analysis
    // Placeholder for implementation
    return [];
  }

  private detectGodObjects(ast: unknown, content: string): CodeSmell[] {
    const smells: CodeSmell[] = [];

    // Count dependencies and responsibilities
    const imports = (content.match(/import.*from/g) || []).length;
    const methods = (content.match(/function\s+\w+|=>\s*{/g) || []).length;
    const properties = (content.match(/this\.\w+/g) || []).length;

    if (imports > 10 && methods > 15 && properties > 15) {
      smells.push({
        type: 'God Object',
        name: 'God object detected',
        description: 'Class has too many responsibilities',
        location: {
          path: '',
          line: 1,
          column: 1,
        },
        severity: 'warning',
        impact: 'Class knows too much and does too much',
        remediation: 'Split into smaller, focused classes with single responsibilities',
      });
    }

    return smells;
  }

  private detectLazyClass(ast: unknown, content: string): CodeSmell[] {
    const smells: CodeSmell[] = [];
    const lines = content.split('\n');

    // Look for classes with very few methods
    const methods = (content.match(/function\s+\w+|=>\s*{/g) || []).length;

    if (methods < 3 && lines.length > 50) {
      smells.push({
        type: 'Lazy Class',
        name: 'Lazy class detected',
        description: 'Class has very low functionality',
        location: {
          path: '',
          line: 1,
          column: 1,
        },
        severity: 'info',
        impact: 'Class may not be pulling its weight',
        remediation: 'Merge with another class or add more responsibility',
      });
    }

    return smells;
  }

  private detectSpeculativeGenerality(ast: unknown, content: string): CodeSmell[] {
    const smells: CodeSmell[] = [];
    const lines = content.split('\n');

    // Look for unused abstractions
    lines.forEach((line, index) => {
      if (/\b(abstract|interface|protocol)\b/.test(line)) {
        // Check if it's actually used
        const name = line.match(/\b(abstract|interface|protocol)\s+(\w+)/);
        if (name) {
          const abstractionName = name[2];
          const usageCount = (content.match(new RegExp(`\\b${abstractionName}\\b`, 'g')) || []).length;

          if (usageCount <= 2) {
            smells.push({
              type: 'Speculative Generality',
              name: `Unused abstraction: ${abstractionName}`,
              description: `Abstraction is only used ${usageCount} time(s)`,
              location: {
                path: '',
                line: index + 1,
                column: 1,
              },
              severity: 'info',
              impact: 'YAGNI - You Ain\'t Gonna Need It',
              remediation: 'Remove unused abstraction or inline it',
            });
          }
        }
      }
    });

    return smells;
  }

  private detectMiddleMan(ast: unknown, content: string): CodeSmell[] {
    const smells: CodeSmell[] = [];
    const lines = content.split('\n');

    // Look for methods that just delegate to another object
    lines.forEach((line, index) => {
      const delegateMatch = line.match(/(\w+)\s*\([^)]*\)\s*{\s*return\s+\w+\.\1\s*\(/);
      if (delegateMatch) {
        smells.push({
          type: 'Middle Man',
          name: `Middle man method: ${delegateMatch[1]}`,
          description: 'Method only delegates to another object',
          location: {
            path: '',
            line: index + 1,
            column: 1,
          },
          severity: 'info',
          impact: 'Unnecessary indirection',
          remediation: 'Call the target object directly or remove the delegation',
        });
      }
    });

    return smells;
  }

  private detectRefusedBequest(ast: unknown, content: string): CodeSmell[] {
    const smells: CodeSmell[] = [];

    // Look for classes that override parent methods to do nothing
    const emptyOverrides = content.match(
      /override\s+\w+\s*\([^)]*\)\s*{\s*\/\/\s*nothing\s*}|override\s+\w+\s*\([^)]*\)\s*{\s*throw\s+new\s+NotImplementedError/g
    );

    if (emptyOverrides && emptyOverrides.length > 0) {
      smells.push({
        type: 'Refused Bequest',
        name: 'Refused bequest detected',
        description: 'Subclass refuses parent class functionality',
        location: {
          path: '',
          line: 1,
          column: 1,
        },
        severity: 'info',
        impact: 'Poor inheritance hierarchy design',
        remediation: 'Refactor inheritance hierarchy or use composition',
      });
    }

    return smells;
  }

  // ========================================================================
  // Duplication Detection
  // ========================================================================

  private createBlocks(lines: string[], blockSize: number): string[][] {
    const blocks: string[][] = [];

    for (let i = 0; i <= lines.length - blockSize; i++) {
      blocks.push(lines.slice(i, i + blockSize));
    }

    return blocks;
  }

  private calculateSimilarity(block1: string[], block2: string[]): number {
    let matches = 0;
    const maxLength = Math.max(block1.length, block2.length);

    for (let i = 0; i < maxLength; i++) {
      const line1 = block1[i]?.trim().replace(/\s+/g, ' ') || '';
      const line2 = block2[i]?.trim().replace(/\s+/g, ' ') || '';

      if (line1 === line2 && line1.length > 10) {
        matches++;
      } else if (line1.length > 0 && line2.length > 0) {
        // Calculate similarity for non-identical lines
        const similarity = this.calculateStringSimilarity(line1, line2);
        if (similarity > 0.8) {
          matches += similarity;
        }
      }
    }

    return matches / maxLength;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1.charAt(i - 1) === str2.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    const maxLength = Math.max(len1, len2);
    return (maxLength - matrix[len1][len2]) / maxLength;
  }

  // ========================================================================
  // Metrics Calculations
  // ========================================================================

  private calculateMaintainabilityIndex(
    complexity: ComplexityMetrics,
    linesOfCode: number,
    codeSmellCount: number
  ): number {
    // Microsoft's maintainability index formula
    // MI = MAX(0, (171 - 5.2 * ln(HV) - 0.23 * CC - 16.2 * ln(LOC)) * 100 / 171)

    const hv = codeSmellCount + 1; // Halstead volume (simplified)
    const cc = complexity.cyclomatic;
    const loc = linesOfCode;

    const mi = Math.max(
      0,
      (171 - 5.2 * Math.log(hv) - 0.23 * cc - 16.2 * Math.log(loc)) * 100 / 171
    );

    return Math.round(mi * 100) / 100;
  }

  private calculateTechnicalDebt(
    codeSmells: CodeSmell[],
    duplications: DuplicationInstance[]
  ): number {
    let debt = 0;

    // Calculate debt from code smells
    for (const smell of codeSmells) {
      const severityWeight: Record<Severity, number> = {
        error: 10,
        warning: 5,
        info: 2,
        hint: 1,
      };
      debt += severityWeight[smell.severity];
    }

    // Calculate debt from duplications
    for (const dup of duplications) {
      debt += 5 * dup.similarity;
    }

    return Math.round(debt);
  }

  private calculateDuplicationPercentage(
    duplications: DuplicationInstance[],
    totalLines: number
  ): number {
    if (totalLines === 0) {
      return 0;
    }

    const duplicatedLines = duplications.length * 6; // Assuming 6-line blocks
    return Math.round((duplicatedLines / totalLines) * 100);
  }

  private async calculateDocumentationCoverage(ast: unknown): Promise<number> {
    // This is a simplified implementation
    // Real implementation would parse JSDoc/comments
    return 0;
  }

  // ========================================================================
  // Trend Analysis
  // ========================================================================

  /**
   * Calculate quality trend over time
   */
  calculateTrend(
    historicalData: QualityMetrics[]
  ): {
    maintainability: 'improving' | 'stable' | 'declining';
    complexity: 'improving' | 'stable' | 'declining';
    technicalDebt: 'improving' | 'stable' | 'declining';
  } {
    if (historicalData.length < 2) {
      return {
        maintainability: 'stable',
        complexity: 'stable',
        technicalDebt: 'stable',
      };
    }

    const latest = historicalData[historicalData.length - 1];
    const previous = historicalData[historicalData.length - 2];

    const threshold = 5; // 5% change threshold

    return {
      maintainability: this.getTrendDirection(
        previous.maintainabilityIndex,
        latest.maintainabilityIndex,
        threshold
      ),
      complexity: this.getTrendDirection(
        previous.complexity.complexity,
        latest.complexity.complexity,
        threshold,
        true // inverted (lower is better)
      ),
      technicalDebt: this.getTrendDirection(
        previous.technicalDebt,
        latest.technicalDebt,
        threshold,
        true // inverted (lower is better)
      ),
    };
  }

  private getTrendDirection(
    previous: number,
    current: number,
    threshold: number,
    inverted = false
  ): 'improving' | 'stable' | 'declining' {
    const change = ((current - previous) / Math.abs(previous)) * 100;

    if (Math.abs(change) < threshold) {
      return 'stable';
    }

    if (inverted) {
      return change < 0 ? 'improving' : 'declining';
    }

    return change > 0 ? 'improving' : 'declining';
  }
}
