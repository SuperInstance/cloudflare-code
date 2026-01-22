/**
 * Code Quality Checker
 *
 * Comprehensive code quality analysis including:
 * - Cyclomatic complexity analysis
 * - Cognitive complexity analysis
 * - Code duplication detection
 * - Code smell detection
 * - Maintainability index calculation
 * - Naming convention checking
 * - Documentation coverage analysis
 */

import type { SupportedLanguage } from '../codebase/types';
import type {
  CodeIssue,
  CodeMetrics,
  ComplexityAnalysis,
  CodeSmell,
  ReviewOptions,
} from './types';

// ============================================================================
// Quality Configuration
// ============================================================================

/**
 * Quality thresholds
 */
interface QualityThresholds {
  maxCyclomaticComplexity: number;
  maxCognitiveComplexity: number;
  maxFunctionLength: number;
  maxParameterCount: number;
  maxNestingDepth: number;
  maxClassLength: number;
  maxFileLength: number;
  maxDuplicationPercentage: number;
  minDocumentationCoverage: number;
  minMaintainabilityIndex: number;
}

/**
 * Naming convention patterns
 */
interface NamingConvention {
  camelCase: RegExp;
  PascalCase: RegExp;
  snake_case: RegExp;
  SCREAMING_SNAKE_CASE: RegExp;
  kebabCase: RegExp;
}

const NAMING_PATTERNS: NamingConvention = {
  camelCase: /^[a-z][a-zA-Z0-9]*$/,
  PascalCase: /^[A-Z][a-zA-Z0-9]*$/,
  snake_case: /^[a-z][a-z0-9_]*$/,
  SCREAMING_SNAKE_CASE: /^[A-Z][A-Z0-9_]*$/,
  kebabCase: /^[a-z][a-z0-9-]*$/,
};

// ============================================================================
// Code Quality Checker
// ============================================================================

/**
 * Code quality checker
 */
export class QualityChecker {
  private thresholds: QualityThresholds;

  constructor(thresholds: Partial<QualityThresholds> = {}) {
    this.thresholds = {
      maxCyclomaticComplexity: thresholds.maxCyclomaticComplexity ?? 15,
      maxCognitiveComplexity: thresholds.maxCognitiveComplexity ?? 15,
      maxFunctionLength: thresholds.maxFunctionLength ?? 50,
      maxParameterCount: thresholds.maxParameterCount ?? 5,
      maxNestingDepth: thresholds.maxNestingDepth ?? 4,
      maxClassLength: thresholds.maxClassLength ?? 300,
      maxFileLength: thresholds.maxFileLength ?? 500,
      maxDuplicationPercentage: thresholds.maxDuplicationPercentage ?? 10,
      minDocumentationCoverage: thresholds.minDocumentationCoverage ?? 20,
      minMaintainabilityIndex: thresholds.minMaintainabilityIndex ?? 50,
    };
  }

  /**
   * Check code quality
   */
  async checkQuality(
    content: string,
    filePath: string,
    language: SupportedLanguage,
    options?: ReviewOptions
  ): Promise<{
    issues: CodeIssue[];
    metrics: CodeMetrics;
    smells: CodeSmell[];
  }> {
    const issues: CodeIssue[] = [];
    const smells: CodeSmell[] = [];
    const lines = content.split('\n');

    // Check complexity
    const complexity = this.analyzeComplexity(content, language);
    issues.push(...this.checkComplexityIssues(complexity, filePath, lines));

    // Check code smells
    const detectedSmells = this.detectCodeSmells(content, filePath, language);
    smells.push(...detectedSmells);

    // Check naming conventions
    issues.push(...this.checkNamingConventions(content, filePath, language));

    // Check documentation
    issues.push(...this.checkDocumentation(content, filePath, language));

    // Check code duplication
    const duplication = this.checkDuplication(content, filePath);
    issues.push(...duplication.issues);

    // Calculate metrics
    const metrics = this.calculateMetrics(content, complexity, smells);

    return { issues, metrics, smells };
  }

  /**
   * Analyze code complexity
   */
  analyzeComplexity(content: string, language: SupportedLanguage): ComplexityAnalysis {
    let cyclomatic = 1; // Base complexity
    let cognitive = 0;

    const lines = content.split('\n');
    let nestingLevel = 0;

    // Decision keywords that increase complexity
    const decisionKeywords = [
      'if', 'else', 'for', 'while', 'switch', 'case', 'catch', 'conditional',
      '&&', '||', '?', 'try', 'finally', 'throw', 'when', 'guard',
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Count cyclomatic complexity
      for (const keyword of decisionKeywords) {
        const regex = new RegExp(`\\b${keyword}\\b`);
        if (regex.test(line)) {
          cyclomatic++;

          // Increase cognitive complexity more for nesting
          if (['if', 'for', 'while', 'catch', 'try'].includes(keyword)) {
            cognitive += 1 + nestingLevel;
          }
        }
      }

      // Track nesting level
      if (line.match(/\b(if|for|while|switch|try|function|class)\b/) || line.includes('{')) {
        nestingLevel++;
      } else if (line.includes('}') || line.includes('end') || line.includes('fi')) {
        nestingLevel = Math.max(0, nestingLevel - 1);
      }
    }

    // Calculate maintainability index
    const maintainability = this.calculateMaintainabilityIndex(
      cyclomatic,
      content.split('\n').length,
      this.countDocumentationLines(content)
    );

    return {
      cyclomatic,
      cognitive,
      maintainability,
      halstead: this.calculateHalsteadMetrics(content),
    };
  }

  /**
   * Check complexity issues
   */
  private checkComplexityIssues(
    complexity: ComplexityAnalysis,
    filePath: string,
    lines: string[]
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];

    if (complexity.cyclomatic > this.thresholds.maxCyclomaticComplexity) {
      issues.push({
        id: `quality-complexity-cyclomatic`,
        severity: 'high',
        category: 'quality',
        rule: 'high-cyclomatic-complexity',
        message: `Cyclomatic complexity (${complexity.cyclomatic}) exceeds threshold (${this.thresholds.maxCyclomaticComplexity})`,
        description: 'High cyclomatic complexity makes code harder to test and maintain',
        file: filePath,
        line: 1,
        suggestion: 'Break down complex functions into smaller, more focused functions',
        confidence: 0.9,
        tags: ['quality', 'complexity', 'maintainability'],
      });
    }

    if (complexity.cognitive > this.thresholds.maxCognitiveComplexity) {
      issues.push({
        id: `quality-complexity-cognitive`,
        severity: 'high',
        category: 'quality',
        rule: 'high-cognitive-complexity',
        message: `Cognitive complexity (${complexity.cognitive}) exceeds threshold (${this.thresholds.maxCognitiveComplexity})`,
        description: 'High cognitive complexity makes code harder to understand',
        file: filePath,
        line: 1,
        suggestion: 'Simplify control flow and reduce nesting',
        confidence: 0.85,
        tags: ['quality', 'complexity', 'readability'],
      });
    }

    if (complexity.maintainability < this.thresholds.minMaintainabilityIndex) {
      issues.push({
        id: `quality-maintainability`,
        severity: 'medium',
        category: 'quality',
        rule: 'low-maintainability-index',
        message: `Maintainability index (${Math.round(complexity.maintainability)}) below threshold (${this.thresholds.minMaintainabilityIndex})`,
        description: 'Low maintainability index indicates code that will be difficult to maintain',
        file: filePath,
        line: 1,
        suggestion: 'Refactor code to improve maintainability',
        confidence: 0.8,
        tags: ['quality', 'maintainability'],
      });
    }

    return issues;
  }

  /**
   * Detect code smells
   */
  detectCodeSmells(content: string, filePath: string, language: SupportedLanguage): CodeSmell[] {
    const smells: CodeSmell[] = [];
    const lines = content.split('\n');

    // Long method
    const functionBlocks = this.extractFunctionBlocks(content, language);
    for (const block of functionBlocks) {
      const length = block.endLine - block.startLine + 1;
      if (length > this.thresholds.maxFunctionLength) {
        smells.push({
          id: `smell-long-method-${block.startLine}`,
          type: 'long-method',
          severity: 'medium',
          title: `Long method: ${block.name}`,
          description: `Function '${block.name}' is ${length} lines long (threshold: ${this.thresholds.maxFunctionLength})`,
          file: filePath,
          line: block.startLine,
          endLine: block.endLine,
          remediation: 'Break down the function into smaller, more focused functions',
        });
      }
    }

    // Long parameter list
    const functionParams = this.extractFunctionParameters(content, language);
    for (const func of functionParams) {
      if (func.params.length > this.thresholds.maxParameterCount) {
        smells.push({
          id: `smell-long-params-${func.line}`,
          type: 'long-parameter-list',
          severity: 'low',
          title: `Long parameter list: ${func.name}`,
          description: `Function '${func.name}' has ${func.params.length} parameters (threshold: ${this.thresholds.maxParameterCount})`,
          file: filePath,
          line: func.line,
          remediation: 'Use an options object or group related parameters into a data structure',
        });
      }
    }

    // Large class
    const classBlocks = this.extractClassBlocks(content, language);
    for (const block of classBlocks) {
      const length = block.endLine - block.startLine + 1;
      if (length > this.thresholds.maxClassLength) {
        smells.push({
          id: `smell-large-class-${block.startLine}`,
          type: 'large-class',
          severity: 'medium',
          title: `Large class: ${block.name}`,
          description: `Class '${block.name}' is ${length} lines long (threshold: ${this.thresholds.maxClassLength})`,
          file: filePath,
          line: block.startLine,
          endLine: block.endLine,
          remediation: 'Split the class into smaller, more focused classes following Single Responsibility Principle',
        });
      }
    }

    // Magic numbers
    const magicNumberPattern = /\b(?!0|1|2|10|100|1000|-1|-2)\d{2,}\b/g;
    let match;
    while ((match = magicNumberPattern.exec(content)) !== null) {
      const lineNum = this.getLineNumber(content, match.index);
      const line = lines[lineNum - 1] || '';

      // Skip if in comment or string
      if (!line.match(/\/\/|\/\*|\*/)) {
        smells.push({
          id: `smell-magic-number-${lineNum}`,
          type: 'magic-number',
          severity: 'info',
          title: `Magic number: ${match[0]}`,
          description: `Magic number ${match[0]} should be replaced with a named constant`,
          file: filePath,
          line: lineNum,
          remediation: 'Replace with a named constant that explains the meaning of the value',
        });
      }
    }

    // Dead code (commented out code)
    const commentedCodePattern = /^(\s*)\/\/.*(?:function|class|const|let|var|if|for|while)/gm;
    while ((match = commentedCodePattern.exec(content)) !== null) {
      const lineNum = this.getLineNumber(content, match.index);
      smells.push({
        id: `smell-dead-code-${lineNum}`,
        type: 'dead-code',
        severity: 'info',
        title: 'Commented out code detected',
        description: 'Commented out code should be removed',
        file: filePath,
        line: lineNum,
        remediation: 'Remove the commented code or use version control for historical code',
      });
    }

    return smells;
  }

  /**
   * Check naming conventions
   */
  private checkNamingConventions(
    content: string,
    filePath: string,
    language: SupportedLanguage
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = content.split('\n');

    // Variable/function naming (should be camelCase)
    const varPattern = /(?:let|const|var|function)\s+(\w+)/g;
    let match;
    while ((match = varPattern.exec(content)) !== null) {
      const name = match[1];
      if (!NAMING_PATTERNS.camelCase.test(name) && !NAMING_PATTERNS.PascalCase.test(name)) {
        const lineNum = this.getLineNumber(content, match.index);
        issues.push({
          id: `quality-naming-variable-${lineNum}`,
          severity: 'info',
          category: 'quality',
          rule: 'naming-convention',
          message: `Variable '${name}' should use camelCase or PascalCase`,
          description: 'Inconsistent naming conventions reduce code readability',
          file: filePath,
          line: lineNum,
          code: lines[lineNum - 1]?.trim(),
          suggestion: `Rename to ${this.toCamelCase(name)}`,
          confidence: 0.6,
          tags: ['quality', 'style', 'naming'],
        });
      }
    }

    // Class naming (should be PascalCase)
    const classPattern = /class\s+(\w+)/g;
    while ((match = classPattern.exec(content)) !== null) {
      const name = match[1];
      if (!NAMING_PATTERNS.PascalCase.test(name)) {
        const lineNum = this.getLineNumber(content, match.index);
        issues.push({
          id: `quality-naming-class-${lineNum}`,
          severity: 'info',
          category: 'quality',
          rule: 'naming-convention',
          message: `Class '${name}' should use PascalCase`,
          description: 'Classes should use PascalCase convention',
          file: filePath,
          line: lineNum,
          code: lines[lineNum - 1]?.trim(),
          suggestion: `Rename to ${this.toPascalCase(name)}`,
          confidence: 0.9,
          tags: ['quality', 'style', 'naming'],
        });
      }
    }

    // Constant naming (should be SCREAMING_SNAKE_CASE)
    const constPattern = /const\s+([A-Z_][A-Z0-9_]*)\s*=/g;
    while ((match = constPattern.exec(content)) !== null) {
      const name = match[1];
      if (!NAMING_PATTERNS.SCREAMING_SNAKE_CASE.test(name)) {
        const lineNum = this.getLineNumber(content, match.index);
        issues.push({
          id: `quality-naming-constant-${lineNum}`,
          severity: 'info',
          category: 'quality',
          rule: 'naming-convention',
          message: `Constant '${name}' should use SCREAMING_SNAKE_CASE`,
          description: 'Constants should use SCREAMING_SNAKE_CASE convention',
          file: filePath,
          line: lineNum,
          code: lines[lineNum - 1]?.trim(),
          suggestion: `Rename to ${this.toScreamingSnakeCase(name)}`,
          confidence: 0.7,
          tags: ['quality', 'style', 'naming'],
        });
      }
    }

    return issues;
  }

  /**
   * Check documentation coverage
   */
  private checkDocumentation(
    content: string,
    filePath: string,
    language: SupportedLanguage
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = content.split('\n');

    // Check for missing function documentation
    const functionBlocks = this.extractFunctionBlocks(content, language);
    for (const block of functionBlocks) {
      // Check if function has documentation before it
      const beforeFunc = lines.slice(Math.max(0, block.startLine - 5), block.startLine - 1);
      const hasDoc = beforeFunc.some(line =>
        line.trim().startsWith('*') ||
        line.trim().startsWith('/**') ||
        line.trim().startsWith('//') ||
        line.trim().startsWith('#')
      );

      if (!hasDoc && block.name !== 'anonymous') {
        issues.push({
          id: `quality-documentation-function-${block.startLine}`,
          severity: 'info',
          category: 'documentation',
          rule: 'missing-documentation',
          message: `Function '${block.name}' is missing documentation`,
          description: 'Public functions should have documentation explaining their purpose, parameters, and return values',
          file: filePath,
          line: block.startLine,
          suggestion: 'Add JSDoc/DocBlock comment explaining the function',
          confidence: 0.5,
          tags: ['quality', 'documentation'],
        });
      }
    }

    // Check for missing module/file documentation
    const hasModuleDoc = lines.slice(0, 10).some(line =>
      line.includes('@file') ||
      line.includes('@module') ||
      line.includes('/**') ||
      line.includes('#')
    );

    if (!hasModuleDoc) {
      issues.push({
        id: 'quality-documentation-module',
        severity: 'info',
        category: 'documentation',
        rule: 'missing-module-documentation',
        message: 'Module is missing documentation header',
        description: 'Files should have a documentation comment explaining their purpose',
        file: filePath,
        line: 1,
        suggestion: 'Add a file header comment with module description',
        confidence: 0.4,
        tags: ['quality', 'documentation'],
      });
    }

    return issues;
  }

  /**
   * Check code duplication
   */
  private checkDuplication(content: string, filePath: string): {
    issues: CodeIssue[];
    duplicateBlocks: number;
    duplicationPercentage: number;
  } {
    const issues: CodeIssue[] = [];
    const lines = content.split('\n');

    // Find duplicate lines
    const lineMap = new Map<string, number[]>();
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.length > 20) { // Ignore very short lines
        if (!lineMap.has(trimmed)) {
          lineMap.set(trimmed, []);
        }
        lineMap.get(trimmed)!.push(i + 1);
      }
    }

    // Find duplicate blocks (3+ consecutive identical lines)
    let duplicateBlocks = 0;
    let totalDuplicatedLines = 0;

    for (const [line, occurrences] of lineMap) {
      if (occurrences.length > 1) {
        totalDuplicatedLines += line.length * occurrences.length;

        // Check if these are part of consecutive blocks
        for (let i = 0; i < occurrences.length; i++) {
          for (let j = i + 1; j < occurrences.length; j++) {
            let consecutiveCount = 0;
            let line1 = occurrences[i];
            let line2 = occurrences[j];

            while (line1 < lines.length && line2 < lines.length &&
                   lines[line1].trim() === lines[line2].trim()) {
              consecutiveCount++;
              line1++;
              line2++;
            }

            if (consecutiveCount >= 3) {
              duplicateBlocks++;
              issues.push({
                id: `quality-duplication-${occurrences[i]}-${occurrences[j]}`,
                severity: 'medium',
                category: 'quality',
                rule: 'code-duplication',
                message: `Duplicate code block (${consecutiveCount} lines) at lines ${occurrences[i]} and ${occurrences[j]}`,
                description: 'Code duplication leads to maintenance issues and should be refactored into reusable functions',
                file: filePath,
                line: occurrences[i],
                suggestion: 'Extract duplicated code into a shared function or module',
                confidence: 0.9,
                tags: ['quality', 'duplication', 'maintainability'],
              });
            }
          }
        }
      }
    }

    const duplicationPercentage = lines.length > 0
      ? (totalDuplicatedLines / (lines.length * 80)) * 100
      : 0;

    if (duplicationPercentage > this.thresholds.maxDuplicationPercentage) {
      issues.push({
        id: 'quality-duplication-overall',
        severity: 'medium',
        category: 'quality',
        rule: 'high-duplication',
        message: `High code duplication: ${duplicationPercentage.toFixed(1)}% (threshold: ${this.thresholds.maxDuplicationPercentage}%)`,
        description: 'High code duplication increases maintenance burden',
        file: filePath,
        line: 1,
        suggestion: 'Refactor duplicated code into reusable components',
        confidence: 0.8,
        tags: ['quality', 'duplication'],
      });
    }

    return { issues, duplicateBlocks, duplicationPercentage };
  }

  /**
   * Calculate code metrics
   */
  private calculateMetrics(
    content: string,
    complexity: ComplexityAnalysis,
    smells: CodeSmell[]
  ): CodeMetrics {
    const lines = content.split('\n');
    const linesOfCode = this.countLinesOfCode(content);
    const linesOfDocumentation = this.countDocumentationLines(content);
    const blankLines = this.countBlankLines(content);

    return {
      linesOfCode,
      linesOfDocumentation,
      blankLines,
      totalLines: lines.length,
      fileSize: content.length,
      cyclomaticComplexity: complexity.cyclomatic,
      cognitiveComplexity: complexity.cognitive,
      nestingDepth: 0, // Calculated elsewhere
      maxNestingDepth: 0, // Calculated elsewhere
      duplicationPercentage: 0, // Calculated elsewhere
      duplicatedLines: 0,
      duplicateBlocks: 0,
      maintainabilityIndex: complexity.maintainability,
      technicalDebt: complexity.cyclomatic * 2 + smells.length * 30,
      codeSmellCount: smells.length,
      documentationCoverage: linesOfCode > 0 ? (linesOfDocumentation / linesOfCode) * 100 : 0,
      publicApiDocumented: 0, // Requires more sophisticated analysis
      testCoverage: 0,
      testCount: 0,
      assertionCount: 0,
      dependencyCount: 0,
      externalDependencyCount: 0,
      circularDependencyCount: 0,
      estimatedExecutionTime: 0,
      memoryUsageEstimate: 0,
      bigONotation: undefined,
      vulnerabilityCount: 0,
      secretCount: 0,
      dependencyVulnerabilityCount: 0,
    };
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Extract function blocks
   */
  private extractFunctionBlocks(content: string, language: SupportedLanguage): Array<{
    name: string;
    startLine: number;
    endLine: number;
  }> {
    const blocks: Array<{ name: string; startLine: number; endLine: number }> = [];
    const lines = content.split('\n');

    if (language === 'typescript' || language === 'javascript') {
      const funcPattern = /(?:function\s+(\w+)|(\w+)\s*(?::\s*\w+)?\s*=>|(?:async\s+)?(\w+)\s*\()/g;
      let braceCount = 0;
      let inFunction = false;
      let funcStart = 0;
      let funcName = '';

      for (let i = 0; i < lines.length; i++) {
        if (funcPattern.test(lines[i])) {
          const newMatch = funcPattern.exec(lines[i]);
          if (newMatch) {
            funcName = newMatch[1] || newMatch[2] || newMatch[3] || 'anonymous';
            funcStart = i + 1;
            inFunction = true;
            braceCount = (lines[i].match(/\{/g) || []).length;
          }
        }

        if (inFunction) {
          braceCount += (lines[i].match(/\{/g) || []).length;
          braceCount -= (lines[i].match(/\}/g) || []).length;

          if (braceCount === 0 && i > funcStart) {
            blocks.push({ name: funcName, startLine: funcStart, endLine: i + 1 });
            inFunction = false;
          }
        }
      }
    }

    return blocks;
  }

  /**
   * Extract function parameters
   */
  private extractFunctionParameters(content: string, language: SupportedLanguage): Array<{
    name: string;
    params: string[];
    line: number;
  }> {
    const functions: Array<{ name: string; params: string[]; line: number }> = [];
    const lines = content.split('\n');

    if (language === 'typescript' || language === 'javascript') {
      const funcPattern = /(?:function\s+(\w+)\s*\(([^)]*)\)|(\w+)\s*(?::\s*\w+)?\s*=>\s*\(([^)]*)\)|(\w+)\s*\(([^)]*)\)\s*\{)/g;

      for (let i = 0; i < lines.length; i++) {
        let match;
        while ((match = funcPattern.exec(lines[i])) !== null) {
          const name = match[1] || match[3] || match[5] || 'anonymous';
          const paramsStr = match[2] || match[4] || match[6] || '';
          const params = paramsStr.split(',').map(p => p.trim()).filter(p => p.length > 0);

          functions.push({ name, params, line: i + 1 });
        }
      }
    }

    return functions;
  }

  /**
   * Extract class blocks
   */
  private extractClassBlocks(content: string, language: SupportedLanguage): Array<{
    name: string;
    startLine: number;
    endLine: number;
  }> {
    const blocks: Array<{ name: string; startLine: number; endLine: number }> = [];
    const lines = content.split('\n');

    if (language === 'typescript' || language === 'javascript') {
      let inClass = false;
      let classStart = 0;
      let className = '';
      let braceCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const classMatch = lines[i].match(/class\s+(\w+)/);
        if (classMatch) {
          className = classMatch[1];
          classStart = i + 1;
          inClass = true;
          braceCount = (lines[i].match(/\{/g) || []).length;
          continue;
        }

        if (inClass) {
          braceCount += (lines[i].match(/\{/g) || []).length;
          braceCount -= (lines[i].match(/\}/g) || []).length;

          if (braceCount === 0 && i > classStart) {
            blocks.push({ name: className, startLine: classStart, endLine: i + 1 });
            inClass = false;
          }
        }
      }
    }

    return blocks;
  }

  /**
   * Calculate maintainability index
   */
  private calculateMaintainabilityIndex(
    cyclomaticComplexity: number,
    linesOfCode: number,
    linesOfDocumentation: number
  ): number {
    if (linesOfCode === 0) return 100;

    const volume = linesOfCode;
    const cc = cyclomaticComplexity;
    const loc = linesOfCode;

    const mi = Math.max(0, (171 - 5.2 * Math.log(volume) - 0.23 * cc - 16.2 * Math.log(loc)) * 100 / 171);

    const docBonus = linesOfDocumentation > 0 ? (linesOfDocumentation / linesOfCode) * 10 : 0;

    return Math.min(100, mi + docBonus);
  }

  /**
   * Calculate Halstead metrics
   */
  private calculateHalsteadMetrics(content: string): ComplexityAnalysis['halstead'] {
    // Simplified Halstead metrics
    const operators = new Set<string>();
    const operands = new Set<string>();
    let totalOperators = 0;
    let totalOperands = 0;

    const operatorPatterns = [
      /\+/g, /-/g, /\*/g, /\//g, /=/g, /%/g,
      /&&/g, /\|\|/g, /!/g, /</g, />/g,
      /\?/g, /:/g,
    ];

    for (const pattern of operatorPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        operators.add(match[0]);
        totalOperators++;
      }
    }

    const words = content.match(/\b[a-zA-Z_]\w*\b/g) || [];
    for (const word of words) {
      if (!this.isKeyword(word)) {
        operands.add(word);
        totalOperands++;
      }
    }

    const vocabulary = operators.size + operands.size;
    const length = totalOperators + totalOperands;
    const difficulty = (operators.size / 2) * (totalOperands / operands.size);
    const volume = length * Math.log2(vocabulary);
    const effort = difficulty * volume;
    const time = effort / 18;
    const bugs = volume / 3000;

    return {
      vocabulary,
      length,
      difficulty,
      volume,
      effort,
      time,
      bugs,
    };
  }

  /**
   * Check if word is a keyword
   */
  private isKeyword(word: string): boolean {
    const keywords = [
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
      'function', 'return', 'class', 'extends', 'new', 'this', 'super',
      'const', 'let', 'var', 'true', 'false', 'null', 'undefined',
      'import', 'export', 'from', 'default', 'async', 'await',
      'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof',
    ];
    return keywords.includes(word);
  }

  /**
   * Count lines of code
   */
  private countLinesOfCode(content: string): number {
    const lines = content.split('\n');
    return lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('#') && !trimmed.startsWith('*');
    }).length;
  }

  /**
   * Count documentation lines
   */
  private countDocumentationLines(content: string): number {
    const lines = content.split('\n');
    return lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*') || trimmed.startsWith('/**');
    }).length;
  }

  /**
   * Count blank lines
   */
  private countBlankLines(content: string): number {
    return content.split('\n').filter(line => line.trim().length === 0).length;
  }

  /**
   * Get line number from character index
   */
  private getLineNumber(content: string, index: number): number {
    const before = content.substring(0, index);
    return before.split('\n').length;
  }

  /**
   * Convert to camelCase
   */
  private toCamelCase(str: string): string {
    return str.replace(/[-_](.)/g, (_, c) => c.toUpperCase()).replace(/^(.)/, (_, c) => c.toLowerCase());
  }

  /**
   * Convert to PascalCase
   */
  private toPascalCase(str: string): string {
    return this.toCamelCase(str).replace(/^(.)/, (_, c) => c.toUpperCase());
  }

  /**
   * Convert to SCREAMING_SNAKE_CASE
   */
  private toScreamingSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a quality checker instance
 */
export function createQualityChecker(
  thresholds?: Partial<QualityThresholds>
): QualityChecker {
  return new QualityChecker(thresholds);
}
