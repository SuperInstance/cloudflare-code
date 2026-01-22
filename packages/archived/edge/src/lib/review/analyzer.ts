/**
 * Static Code Analyzer
 *
 * Performs AST-based static analysis for 20+ programming languages.
 * Extracts code structure, detects patterns, and identifies issues.
 *
 * Performance Targets:
 * - Analyze 1KB code: <5ms
 * - Parse AST: <10ms
 * - Extract metrics: <5ms
 */

import type {
  SupportedLanguage,
  ParsedFile,
  CodeChunk,
  FileStructure,
} from '../codebase/types';
import type {
  CodeReviewReport,
  CodeIssue,
  CodeMetrics,
  ReviewSummary,
  ReviewOptions,
  AnalysisContext,
  AnalysisProgress,
  ComplexityAnalysis,
  Rule,
  RuleResult,
} from './types';
import { ParseError } from './types';

// ============================================================================
// AST Parser Interface
// ============================================================================

/**
 * Abstract syntax tree node
 */
export interface ASTNode {
  type: string;
  name?: string;
  start?: number;
  end?: number;
  body?: ASTNode[];
  children?: ASTNode[];
  properties?: Record<string, unknown>;
}

/**
 * AST parse result
 */
export interface ASTParseResult {
  tree: ASTNode | null;
  success: boolean;
  errors: Array<{
    message: string;
    line: number;
    column: number;
  }>;
  parsingTime: number;
}

/**
 * Language-specific AST parser
 */
interface ASTParser {
  parse(content: string, filePath: string): Promise<ASTParseResult>;
  extractFunctions(tree: ASTNode): Array<{
    name: string;
    start: number;
    end: number;
    complexity: number;
  }>;
  extractClasses(tree: ASTNode): Array<{
    name: string;
    start: number;
    end: number;
    methods: string[];
  }>;
  extractImports(tree: ASTNode): Array<{
    module: string;
    line: number;
  }>;
  calculateComplexity(tree: ASTNode): number;
  findPatterns(tree: ASTNode, pattern: object): ASTNode[];
}

// ============================================================================
// Static Analyzer
// ============================================================================

/**
 * Static analyzer configuration
 */
interface AnalyzerConfig {
  maxFileSize: number;
  includeComments: boolean;
  extractMetrics: boolean;
  detectPatterns: boolean;
  parallelism: number;
}

/**
 * Static code analyzer
 */
export class StaticAnalyzer {
  private config: AnalyzerConfig;
  private parsers: Map<SupportedLanguage, ASTParser>;
  private rules: Rule[];

  constructor(options: Partial<AnalyzerConfig> = {}) {
    this.config = {
      maxFileSize: options.maxFileSize ?? 1024 * 1024, // 1MB
      includeComments: options.includeComments ?? true,
      extractMetrics: options.extractMetrics ?? true,
      detectPatterns: options.detectPatterns ?? true,
      parallelism: options.parallelism ?? 4,
    };
    this.parsers = new Map();
    this.rules = [];
  }

  /**
   * Register an AST parser for a language
   */
  registerParser(language: SupportedLanguage, parser: ASTParser): void {
    this.parsers.set(language, parser);
  }

  /**
   * Register analysis rules
   */
  registerRules(rules: Rule[]): void {
    this.rules.push(...rules);
  }

  /**
   * Analyze a parsed file
   */
  async analyzeFile(
    parsedFile: ParsedFile,
    options: ReviewOptions = {},
    context?: AnalysisContext
  ): Promise<CodeReviewReport> {
    const startTime = performance.now();

    // Initialize report
    const report: CodeReviewReport = {
      file: parsedFile.path,
      language: parsedFile.language,
      score: 0,
      issues: [],
      metrics: {} as CodeMetrics,
      summary: {} as ReviewSummary,
      timestamp: Date.now(),
    };

    try {
      // Parse AST
      const ast = await this.parseAST(parsedFile);

      // Extract metrics
      if (this.config.extractMetrics) {
        report.metrics = await this.extractMetrics(parsedFile, ast);
      }

      // Run security analysis
      if (options.includeSecurity !== false) {
        const securityIssues = await this.analyzeSecurity(parsedFile, ast);
        report.issues.push(...securityIssues);
      }

      // Run performance analysis
      if (options.includePerformance !== false) {
        const performanceIssues = await this.analyzePerformance(parsedFile, ast);
        report.issues.push(...performanceIssues);
      }

      // Run quality analysis
      if (options.includeQuality !== false) {
        const qualityIssues = await this.analyzeQuality(parsedFile, ast);
        report.issues.push(...qualityIssues);
      }

      // Run best practices
      if (options.includeBestPractices !== false) {
        const bestPracticeIssues = await this.analyzeBestPractices(parsedFile, ast);
        report.issues.push(...bestPracticeIssues);
      }

      // Run custom rules
      const ruleResults = await this.runRules(parsedFile, ast, options);
      for (const result of ruleResults) {
        for (const match of result.matches) {
          report.issues.push(this.toCodeIssue(match, result.rule));
        }
      }

      // Generate summary
      report.summary = this.generateSummary(report.issues, report.metrics);

      // Calculate score
      report.score = this.calculateScore(report.issues, report.metrics);

      const duration = performance.now() - startTime;
      console.debug(`Analyzed ${parsedFile.path} in ${duration.toFixed(2)}ms`);

    } catch (error) {
      throw new ParseError(
        `Failed to analyze file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        parsedFile.path
      );
    }

    return report;
  }

  /**
   * Analyze multiple files in parallel
   */
  async analyzeBatch(
    parsedFiles: ParsedFile[],
    options: ReviewOptions = {},
    context?: AnalysisContext,
    onProgress?: (progress: AnalysisProgress) => void
  ): Promise<CodeReviewReport[]> {
    const startTime = performance.now();
    const reports: CodeReviewReport[] = [];

    // Process files in batches
    const batchSize = this.config.parallelism;
    for (let i = 0; i < parsedFiles.length; i += batchSize) {
      const batch = parsedFiles.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(file => this.analyzeFile(file, options, context))
      );

      reports.push(...batchResults);

      // Report progress
      if (onProgress) {
        onProgress({
          stage: 'analyzing',
          progress: Math.min(100, Math.round(((i + batchSize) / parsedFiles.length) * 100)),
          filesCompleted: i + batchSize,
          totalFiles: parsedFiles.length,
          issuesFound: reports.reduce((sum, r) => sum + r.issues.length, 0),
        });
      }
    }

    const duration = performance.now() - startTime;
    console.debug(`Analyzed ${parsedFiles.length} files in ${duration.toFixed(2)}ms`);

    return reports;
  }

  /**
   * Parse AST from file content
   */
  private async parseAST(parsedFile: ParsedFile): Promise<ASTParseResult> {
    const parser = this.parsers.get(parsedFile.language);

    if (!parser) {
      // No parser available for this language, return empty tree
      return {
        tree: null,
        success: true,
        errors: [],
        parsingTime: 0,
      };
    }

    return parser.parse(parsedFile.content, parsedFile.path);
  }

  /**
   * Extract code metrics
   */
  private async extractMetrics(
    parsedFile: ParsedFile,
    ast: ASTParseResult
  ): Promise<CodeMetrics> {
    const content = parsedFile.content;
    const lines = content.split('\n');

    // Size metrics
    const linesOfCode = this.countLinesOfCode(content);
    const linesOfDocumentation = this.countDocumentationLines(content);
    const blankLines = this.countBlankLines(content);
    const totalLines = lines.length;
    const fileSize = content.length;

    // Complexity metrics
    const complexity = this.calculateComplexity(parsedFile, ast);
    const cyclomaticComplexity = complexity.cyclomatic;
    const cognitiveComplexity = complexity.cognitive;

    // Nesting depth
    const { nestingDepth, maxNestingDepth } = this.analyzeNestingDepth(content, parsedFile.language);

    // Duplication metrics
    const duplication = this.analyzeDuplication(parsedFile);

    // Maintainability index (Microsoft formula)
    const maintainabilityIndex = this.calculateMaintainabilityIndex(
      cyclomaticComplexity,
      linesOfCode,
      linesOfDocumentation
    );

    // Technical debt (simplified)
    const technicalDebt = this.estimateTechnicalDebt(cyclomaticComplexity, duplication.duplicationPercentage);

    // Documentation coverage
    const documentationCoverage = linesOfCode > 0
      ? (linesOfDocumentation / linesOfCode) * 100
      : 0;

    return {
      linesOfCode,
      linesOfDocumentation,
      blankLines,
      totalLines,
      fileSize,
      cyclomaticComplexity,
      cognitiveComplexity,
      nestingDepth,
      maxNestingDepth,
      duplicationPercentage: duplication.duplicationPercentage,
      duplicatedLines: duplication.duplicatedLines,
      duplicateBlocks: duplication.duplicateBlocks,
      maintainabilityIndex,
      technicalDebt,
      codeSmellCount: 0, // Will be updated by quality analyzer
      documentationCoverage,
      publicApiDocumented: 0, // Requires more sophisticated analysis
      testCoverage: 0, // Will be calculated from test files
      testCount: 0,
      assertionCount: 0,
      dependencyCount: parsedFile.structure.imports.length,
      externalDependencyCount: this.countExternalDependencies(parsedFile.structure.imports),
      circularDependencyCount: 0, // Requires full project analysis
      estimatedExecutionTime: 0, // Will be estimated by performance analyzer
      memoryUsageEstimate: 0,
      bigONotation: undefined,
      vulnerabilityCount: 0,
      secretCount: 0,
      dependencyVulnerabilityCount: 0,
    };
  }

  /**
   * Analyze security issues
   */
  private async analyzeSecurity(
    parsedFile: ParsedFile,
    ast: ASTParseResult
  ): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];
    const content = parsedFile.content;
    const lines = content.split('\n');

    // Check for hardcoded secrets
    const secretPatterns = [
      { pattern: /password\s*[:=]\s*['"]([^'"]{8,})['"]/i, type: 'password' },
      { pattern: /api[_-]?key\s*[:=]\s*['"]([^'"]{20,})['"]/i, type: 'api-key' },
      { pattern: /secret[_-]?key\s*[:=]\s*['"]([^'"]{20,})['"]/i, type: 'secret-key' },
      { pattern: /token\s*[:=]\s*['"]([A-Za-z0-9+/]{32,})['"]/i, type: 'token' },
      {
        pattern: /AKIA[0-9A-Z]{16}/,
        type: 'aws-access-key',
        message: 'Hardcoded AWS access key detected'
      },
      {
        pattern: /\b[A-Za-z0-9+/]{32,}\.[-A-Za-z0-9+/]{32,}\.[A-Za-z0-9+/]{32,}\b/,
        type: 'jwt',
        message: 'Hardcoded JWT token detected'
      },
      {
        pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
        type: 'private-key',
        message: 'Hardcoded private key detected'
      },
      {
        pattern: /mongodb\+srv:\/\/[^@]+@/,
        type: 'database-url',
        message: 'Hardcoded MongoDB connection string detected'
      },
      {
        pattern: /postgres(?:ql)?:\/\/[^@]+@/,
        type: 'database-url',
        message: 'Hardcoded PostgreSQL connection string detected'
      },
      {
        pattern: /mysql:\/\/[^@]+@/,
        type: 'database-url',
        message: 'Hardcoded MySQL connection string detected'
      },
    ];

    for (const { pattern, type, message } of secretPatterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index);
        issues.push({
          id: this.generateIssueId('secret', type, lineNum),
          severity: 'critical',
          category: 'security',
          rule: `hardcoded-${type}`,
          message: message || `Hardcoded ${type} detected`,
          description: 'Hardcoded secrets in source code can be exposed through version control or decompilation',
          file: parsedFile.path,
          line: lineNum,
          column: match.index,
          code: lines[lineNum - 1]?.trim(),
          suggestion: 'Move secrets to environment variables or a secure secrets manager',
          confidence: 0.9,
          tags: ['security', 'secret', 'hardcoded'],
        });
      }
    }

    // Check for SQL injection vulnerabilities
    const sqlInjectionPatterns = [
      /query\s*\(\s*['"`].*?\$\{.*?\}.*?['"`]\s*\)/,
      /execute\s*\(\s*['"`].*?\+.*?['"`]\s*\)/,
      /exec\s*\(\s*['"`].*?\+.*?['"`]\s*\)/,
    ];

    for (const pattern of sqlInjectionPatterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index);
        issues.push({
          id: this.generateIssueId('sql-injection', 'query', lineNum),
          severity: 'critical',
          category: 'security',
          rule: 'sql-injection',
          message: 'Potential SQL injection vulnerability',
          description: 'Direct string concatenation in SQL queries can lead to SQL injection attacks',
          file: parsedFile.path,
          line: lineNum,
          code: lines[lineNum - 1]?.trim(),
          suggestion: 'Use parameterized queries or prepared statements',
          confidence: 0.75,
          tags: ['security', 'sql-injection', 'owasp-a1'],
        });
      }
    }

    // Check for XSS vulnerabilities
    const xssPatterns = [
      /innerHTML\s*=\s*.*?\$/,
      /document\.write\s*\(\s*.*?\$/,
      /dangerouslySetInnerHTML/,
      /\bhtml\s*\(\s*.*?\$/,
    ];

    for (const pattern of xssPatterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index);
        issues.push({
          id: this.generateIssueId('xss', 'dangerous-html', lineNum),
          severity: 'high',
          category: 'security',
          rule: 'xss-vulnerability',
          message: 'Potential XSS vulnerability',
          description: 'Rendering unescaped user input can lead to cross-site scripting attacks',
          file: parsedFile.path,
          line: lineNum,
          code: lines[lineNum - 1]?.trim(),
          suggestion: 'Sanitize and escape user input before rendering',
          confidence: 0.7,
          tags: ['security', 'xss', 'owasp-a3'],
        });
      }
    }

    // Check for insecure crypto
    const insecureCryptoPatterns = [
      { pattern: /md5\s*\(/, algorithm: 'MD5' },
      { pattern: /sha1\s*\(/, algorithm: 'SHA1' },
      { pattern: /createHash\s*\(\s*['"`]md5['"`]/, algorithm: 'MD5' },
      { pattern: /createHash\s*\(\s*['"`]sha1['"`]/, algorithm: 'SHA1' },
    ];

    for (const { pattern, algorithm } of insecureCryptoPatterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index);
        issues.push({
          id: this.generateIssueId('crypto', algorithm.toLowerCase(), lineNum),
          severity: 'medium',
          category: 'security',
          rule: 'insecure-crypto',
          message: `Insecure cryptographic algorithm: ${algorithm}`,
          description: `${algorithm} is cryptographically broken and should not be used for security purposes`,
          file: parsedFile.path,
          line: lineNum,
          code: lines[lineNum - 1]?.trim(),
          suggestion: `Use SHA-256 or stronger (e.g., SHA-384, SHA-512)`,
          confidence: 0.95,
          tags: ['security', 'crypto', 'owasp-a2'],
        });
      }
    }

    // Check for insecure random number generation
    const insecureRandomPatterns = [
      /Math\.random\s*\(\s*\)/,
      /rand\s*\(\s*\)/,
    ];

    for (const pattern of insecureRandomPatterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index);
        // Check if it's used in security context
        const surroundingContext = content.substring(
          Math.max(0, match.index - 200),
          Math.min(content.length, match.index + 200)
        );

        if (surroundingContext.match(/password|token|key|secret|crypto|encrypt|auth/i)) {
          issues.push({
            id: this.generateIssueId('crypto', 'weak-random', lineNum),
            severity: 'high',
            category: 'security',
            rule: 'weak-random',
            message: 'Weak random number generator used in security context',
            description: 'Math.random() and similar functions are not cryptographically secure',
            file: parsedFile.path,
            line: lineNum,
            code: lines[lineNum - 1]?.trim(),
            suggestion: 'Use crypto.getRandomValues() or a cryptographically secure random generator',
            confidence: 0.8,
            tags: ['security', 'crypto', 'random'],
          });
        }
      }
    }

    return issues;
  }

  /**
   * Analyze performance issues
   */
  private async analyzePerformance(
    parsedFile: ParsedFile,
    ast: ASTParseResult
  ): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];
    const content = parsedFile.content;
    const lines = content.split('\n');

    // Check for nested loops (potential performance issue)
    const nestedLoopPattern = /for\s*\([^)]+\)\s*\{[^}]*for\s*\(/gs;
    let match;
    while ((match = nestedLoopPattern.exec(content)) !== null) {
      const lineNum = this.getLineNumber(content, match.index);
      issues.push({
        id: this.generateIssueId('performance', 'nested-loop', lineNum),
        severity: 'medium',
        category: 'performance',
        rule: 'nested-loops',
        message: 'Nested loops detected',
        description: 'Nested loops can lead to O(n²) or worse time complexity',
        file: parsedFile.path,
        line: lineNum,
        code: lines[lineNum - 1]?.trim(),
        suggestion: 'Consider using a hash map or optimizing the algorithm',
        confidence: 0.6,
        tags: ['performance', 'complexity', 'optimization'],
      });
    }

    // Check for inefficient array operations
    const inefficientPatterns = [
      {
        pattern: /\.forEach\s*\([^)]*\)\s*\{[^}]*\.push\s*\(/,
        message: 'Array.push inside forEach loop - consider using map or filter',
      },
      {
        pattern: /for\s*\([^)]+\)\s*\{[^}]*\.indexOf\s*\(/,
        message: 'Array.indexOf inside loop - consider using Set for O(1) lookups',
      },
      {
        pattern: /\.filter\s*\([^)]*\)\s*\.find\s*\(/,
        message: 'Chaining filter().find() - use find() with a more specific predicate',
      },
    ];

    for (const { pattern, message } of inefficientPatterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index);
        issues.push({
          id: this.generateIssueId('performance', 'inefficient-operation', lineNum),
          severity: 'low',
          category: 'performance',
          rule: 'inefficient-array-operation',
          message,
          description: 'This pattern can lead to suboptimal performance',
          file: parsedFile.path,
          line: lineNum,
          code: lines[lineNum - 1]?.trim(),
          suggestion: 'Review and optimize the array operation',
          confidence: 0.5,
          tags: ['performance', 'optimization'],
        });
      }
    }

    // Check for synchronous operations that could be async
    if (parsedFile.language === 'typescript' || parsedFile.language === 'javascript') {
      const syncPatterns = [
        { pattern: /fs\.readFileSync/, asyncVersion: 'fs.promises.readFile' },
        { pattern: /fs\.writeFileSync/, asyncVersion: 'fs.promises.writeFile' },
        { pattern: /child_process\.execSync/, asyncVersion: 'child_process.exec' },
      ];

      for (const { pattern, asyncVersion } of syncPatterns) {
        let match;
        const regex = new RegExp(pattern.source, pattern.flags);
        while ((match = regex.exec(content)) !== null) {
          const lineNum = this.getLineNumber(content, match.index);
          issues.push({
            id: this.generateIssueId('performance', 'sync-operation', lineNum),
            severity: 'medium',
            category: 'performance',
            rule: 'sync-operation',
            message: `Synchronous operation detected: ${match[0]}`,
            description: 'Synchronous file I/O blocks the event loop and should be avoided',
            file: parsedFile.path,
            line: lineNum,
            code: lines[lineNum - 1]?.trim(),
            suggestion: `Use ${asyncVersion} instead`,
            confidence: 0.9,
            tags: ['performance', 'async', 'nodejs'],
          });
        }
      }
    }

    return issues;
  }

  /**
   * Analyze quality issues
   */
  private async analyzeQuality(
    parsedFile: ParsedFile,
    ast: ASTParseResult
  ): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];
    const content = parsedFile.content;
    const lines = content.split('\n');

    // Check for long functions
    const functionBlocks = this.extractFunctionBlocks(content, parsedFile.language);
    for (const block of functionBlocks) {
      const length = block.endLine - block.startLine + 1;
      if (length > 50) {
        issues.push({
          id: this.generateIssueId('quality', 'long-function', block.startLine),
          severity: 'medium',
          category: 'quality',
          rule: 'long-function',
          message: `Function '${block.name}' is too long (${length} lines)`,
          description: 'Long functions are harder to understand, test, and maintain',
          file: parsedFile.path,
          line: block.startLine,
          endLine: block.endLine,
          code: `${block.name}() - ${length} lines`,
          suggestion: 'Consider breaking this function into smaller, more focused functions',
          confidence: 0.8,
          tags: ['quality', 'complexity', 'maintainability'],
        });
      }
    }

    // Check for long parameter lists
    const functionParams = this.extractFunctionParameters(content, parsedFile.language);
    for (const func of functionParams) {
      if (func.params.length > 5) {
        issues.push({
          id: this.generateIssueId('quality', 'long-parameter-list', func.line),
          severity: 'low',
          category: 'quality',
          rule: 'long-parameter-list',
          message: `Function '${func.name}' has too many parameters (${func.params.length})`,
          description: 'Long parameter lists are hard to use and indicate the function may be doing too much',
          file: parsedFile.path,
          line: func.line,
          code: `${func.name}(${func.params.join(', ')})`,
          suggestion: 'Consider using an options object or grouping related parameters',
          confidence: 0.9,
          tags: ['quality', 'design'],
        });
      }
    }

    // Check for magic numbers
    const magicNumberPattern = /\b(?!0|1|2|10|100|1000)\d{2,}\b/g;
    let match;
    while ((match = magicNumberPattern.exec(content)) !== null) {
      const lineNum = this.getLineNumber(content, match.index);
      // Skip if in certain contexts (like array indices or common values)
      const line = lines[lineNum - 1] || '';
      if (!line.match(/\/\/|\/\*|\*/)) {
        issues.push({
          id: this.generateIssueId('quality', 'magic-number', lineNum),
          severity: 'info',
          category: 'quality',
          rule: 'magic-number',
          message: `Magic number detected: ${match[0]}`,
          description: 'Magic numbers make code harder to understand and maintain',
          file: parsedFile.path,
          line: lineNum,
          code: line.trim(),
          suggestion: 'Replace with a named constant',
          confidence: 0.4,
          tags: ['quality', 'readability'],
        });
      }
    }

    // Check for deeply nested code
    for (let i = 0; i < lines.length; i++) {
      const indentMatch = lines[i].match(/^(\s*)/);
      if (indentMatch) {
        const indentLevel = indentMatch[1].length;
        if (indentLevel > 24) { // More than 6 levels of 4-space indentation
          issues.push({
            id: this.generateIssueId('quality', 'deep-nesting', i + 1),
            severity: 'medium',
            category: 'quality',
            rule: 'deep-nesting',
            message: 'Deeply nested code detected',
            description: 'Deeply nested code is hard to read and understand',
            file: parsedFile.path,
            line: i + 1,
            code: lines[i].trim(),
            suggestion: 'Consider extracting nested logic into separate functions',
            confidence: 0.7,
            tags: ['quality', 'complexity', 'readability'],
          });
        }
      }
    }

    // Check for console.log statements (should be removed in production)
    const consoleLogPattern = /console\.(log|debug|info|warn|error)\s*\(/g;
    while ((match = consoleLogPattern.exec(content)) !== null) {
      const lineNum = this.getLineNumber(content, match.index);
      issues.push({
        id: this.generateIssueId('quality', 'console-log', lineNum),
        severity: 'info',
        category: 'quality',
        rule: 'console-log',
        message: `Console.${match[1]} statement detected`,
        description: 'Console logging statements should be removed or disabled in production',
        file: parsedFile.path,
        line: lineNum,
        code: lines[lineNum - 1]?.trim(),
        suggestion: 'Use a proper logging library or remove this statement',
        confidence: 0.95,
        tags: ['quality', 'logging'],
      });
    }

    // Check for TODO/FIXME comments
    const todoPattern = /(TODO|FIXME|HACK|XXX|NOTE):\s*.*/gi;
    while ((match = todoPattern.exec(content)) !== null) {
      const lineNum = this.getLineNumber(content, match.index);
      issues.push({
        id: this.generateIssueId('quality', 'todo-comment', lineNum),
        severity: 'info',
        category: 'quality',
        rule: 'todo-comment',
        message: `Technical debt marker: ${match[1]}`,
        description: 'TODO/FIXME comments indicate unresolved work or technical debt',
        file: parsedFile.path,
        line: lineNum,
        code: lines[lineNum - 1]?.trim(),
        suggestion: 'Address the issue or create a task ticket',
        confidence: 1.0,
        tags: ['quality', 'technical-debt'],
      });
    }

    return issues;
  }

  /**
   * Analyze best practices violations
   */
  private async analyzeBestPractices(
    parsedFile: ParsedFile,
    ast: ASTParseResult
  ): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];
    const content = parsedFile.content;
    const lines = content.split('\n');

    // Check for missing error handling
    const asyncCallPattern = /await\s+(\w+)\s*\(/g;
    let match;
    while ((match = asyncCallPattern.exec(content)) !== null) {
      const lineNum = this.getLineNumber(content, match.index);
      const nextLines = lines.slice(lineNum, lineNum + 5).join('\n');
      if (!nextLines.match(/catch|try\s*\{|\.catch\(/)) {
        issues.push({
          id: this.generateIssueId('best-practices', 'missing-error-handling', lineNum),
          severity: 'medium',
          category: 'best-practices',
          rule: 'missing-error-handling',
          message: 'Awaited call without error handling',
          description: 'Unhandled promise rejections can crash the application',
          file: parsedFile.path,
          line: lineNum,
          code: lines[lineNum - 1]?.trim(),
          suggestion: 'Wrap in try-catch or add .catch() handler',
          confidence: 0.6,
          tags: ['best-practices', 'error-handling', 'async'],
        });
      }
    }

    // Check for unused imports
    const imports = parsedFile.structure.imports;
    for (const imp of imports) {
      let used = false;
      for (const symbol of imp.symbols) {
        const pattern = new RegExp(`\\b${symbol}\\b`, 'g');
        if (pattern.test(content.substring(imp.line * 100))) { // Skip the import line itself
          used = true;
          break;
        }
      }
      if (!used && imp.symbols.length > 0) {
        issues.push({
          id: this.generateIssueId('best-practices', 'unused-import', imp.line),
          severity: 'low',
          category: 'best-practices',
          rule: 'unused-import',
          message: `Unused import: ${imp.symbols.join(', ')}`,
          description: 'Unused imports clutter the code and may indicate dead code',
          file: parsedFile.path,
          line: imp.line,
          code: lines[imp.line - 1]?.trim(),
          suggestion: 'Remove the unused import',
          confidence: 0.8,
          tags: ['best-practices', 'cleanup'],
        });
      }
    }

    // Check for non-const variables that are never reassigned
    const letPattern = /let\s+(\w+)\s*=/g;
    while ((match = letPattern.exec(content)) !== null) {
      const varName = match[1];
      const pattern = new RegExp(`\\b${varName}\\s*=`, 'g');
      const matches = content.substring(match.index).match(pattern);
      if (matches && matches.length === 1) {
        const lineNum = this.getLineNumber(content, match.index);
        issues.push({
          id: this.generateIssueId('best-practices', 'should-be-const', lineNum),
          severity: 'info',
          category: 'best-practices',
          rule: 'should-be-const',
          message: `Variable '${varName}' is never reassigned`,
          description: 'Variables that are never reassigned should be declared as const',
          file: parsedFile.path,
          line: lineNum,
          code: lines[lineNum - 1]?.trim(),
          suggestion: `Change 'let' to 'const'`,
          confidence: 0.9,
          tags: ['best-practices', 'es6'],
        });
      }
    }

    return issues;
  }

  /**
   * Run custom rules
   */
  private async runRules(
    parsedFile: ParsedFile,
    ast: ASTParseResult,
    options: ReviewOptions
  ): Promise<RuleResult[]> {
    const results: RuleResult[] = [];
    const startTime = performance.now();

    // Filter enabled rules
    const enabledRules = this.rules.filter(rule => {
      if (options.disabledRules?.includes(rule.id)) return false;
      if (options.enabledRules?.length) {
        return options.enabledRules.includes(rule.id);
      }
      if (rule.options?.enabled === false) return false;
      return true;
    });

    // Check language support
    const applicableRules = enabledRules.filter(rule =>
      rule.languages.includes(parsedFile.language)
    );

    // Execute rules
    for (const rule of applicableRules) {
      const ruleStartTime = performance.now();
      const matches: RuleResult['matches'] = [];

      for (const pattern of rule.patterns) {
        if (pattern.type === 'regex') {
          const regex = new RegExp(pattern.pattern as string, 'g');
          let match;
          while ((match = regex.exec(parsedFile.content)) !== null) {
            const lineNum = this.getLineNumber(parsedFile.content, match.index);
            matches.push({
              file: parsedFile.path,
              line: lineNum,
              column: match.index,
              code: parsedFile.content.split('\n')[lineNum - 1]?.trim() || '',
              message: rule.description,
              suggestion: rule.options?.options?.suggestion as string | undefined,
            });
          }
        }
      }

      results.push({
        rule: rule.id,
        matches,
        executionTime: performance.now() - ruleStartTime,
      });
    }

    console.debug(
      `Ran ${applicableRules.length} rules in ${(performance.now() - startTime).toFixed(2)}ms`
    );

    return results;
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Count lines of code (excluding blank and comment lines)
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
   * Calculate complexity metrics
   */
  private calculateComplexity(parsedFile: ParsedFile, ast: ASTParseResult): ComplexityAnalysis {
    const parser = this.parsers.get(parsedFile.language);
    let cyclomatic = 1; // Base complexity
    let cognitive = 0;

    if (parser && ast.tree) {
      cyclomatic = parser.calculateComplexity(ast.tree);
    } else {
      // Fallback: count decision points
      const decisionPatterns = [
        /\bif\b/g,
        /\belse\b/g,
        /\bfor\b/g,
        /\bwhile\b/g,
        /\bswitch\b/g,
        /\bcase\b/g,
        /\bcatch\b/g,
        /\?\s*:/g, // ternary
        /&&/g,
        /\|\|/g,
      ];

      for (const pattern of decisionPatterns) {
        let match;
        while ((match = pattern.exec(parsedFile.content)) !== null) {
          cyclomatic++;
        }
      }
    }

    // Calculate cognitive complexity (simplified)
    const nestingPatterns = [
      /\bif\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bswitch\b/g,
      /\btry\b/g,
    ];

    let nestingLevel = 0;
    const lines = parsedFile.content.split('\n');
    for (const line of lines) {
      for (const pattern of nestingPatterns) {
        if (pattern.test(line)) {
          nestingLevel++;
          cognitive += nestingLevel;
        }
      }
      if (line.includes('}') || line.includes('end') || line.includes('fi')) {
        nestingLevel = Math.max(0, nestingLevel - 1);
      }
    }

    return {
      cyclomatic,
      cognitive,
      maintainability: 0, // Will be calculated separately
    };
  }

  /**
   * Analyze nesting depth
   */
  private analyzeNestingDepth(content: string, language: SupportedLanguage): {
    nestingDepth: number;
    maxNestingDepth: number;
  } {
    const lines = content.split('\n');
    let currentDepth = 0;
    let maxDepth = 0;
    let totalDepth = 0;
    let lineCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/\b(if|for|while|switch|try|function|class)\b/) ||
          trimmed.match(/\{/)) {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (trimmed.match(/\}|end|\belse\b/)) {
        currentDepth = Math.max(0, currentDepth - 1);
      }

      if (trimmed.length > 0) {
        totalDepth += currentDepth;
        lineCount++;
      }
    }

    return {
      nestingDepth: lineCount > 0 ? totalDepth / lineCount : 0,
      maxNestingDepth: maxDepth,
    };
  }

  /**
   * Analyze code duplication
   */
  private analyzeDuplication(parsedFile: ParsedFile): {
    duplicationPercentage: number;
    duplicatedLines: number;
    duplicateBlocks: number;
  } {
    // Simplified duplication detection
    const lines = parsedFile.content.split('\n');
    const lineMap = new Map<string, number[]>();

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.length > 10) { // Ignore very short lines
        if (!lineMap.has(trimmed)) {
          lineMap.set(trimmed, []);
        }
        lineMap.get(trimmed)!.push(i + 1);
      }
    }

    let duplicatedLines = 0;
    let duplicateBlocks = 0;

    for (const [line, occurrences] of lineMap) {
      if (occurrences.length > 1) {
        duplicatedLines += line.length * occurrences.length;
        duplicateBlocks++;
      }
    }

    const duplicationPercentage = lines.length > 0
      ? (duplicatedLines / (lines.length * 80)) * 100 // Assume 80 chars per line
      : 0;

    return {
      duplicationPercentage: Math.min(100, duplicationPercentage),
      duplicatedLines,
      duplicateBlocks,
    };
  }

  /**
   * Calculate maintainability index
   * Based on Microsoft's formula: MI = MAX(0, (171 - 5.2 * ln(HV) - 0.23 * CC - 16.2 * ln(LOC)) * 100 / 171)
   */
  private calculateMaintainabilityIndex(
    cyclomaticComplexity: number,
    linesOfCode: number,
    linesOfDocumentation: number
  ): number {
    if (linesOfCode === 0) return 100;

    const volume = linesOfCode; // Simplified Halstead volume
    const cc = cyclomaticComplexity;
    const loc = linesOfCode;

    const mi = Math.max(0, (171 - 5.2 * Math.log(volume) - 0.23 * cc - 16.2 * Math.log(loc)) * 100 / 171);

    // Bonus for documentation
    const docBonus = linesOfDocumentation > 0 ? (linesOfDocumentation / linesOfCode) * 10 : 0;

    return Math.min(100, mi + docBonus);
  }

  /**
   * Estimate technical debt (in minutes)
   */
  private estimateTechnicalDebt(complexity: number, duplication: number): number {
    // Simplified formula: 1 minute per complexity point + 5 minutes per percent duplication
    return complexity + (duplication * 5);
  }

  /**
   * Count external dependencies
   */
  private countExternalDependencies(imports: Array<{ module: string }>): number {
    return imports.filter(imp => !imp.module.startsWith('.') && !imp.module.startsWith('/')).length;
  }

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

    // Simplified extraction for JavaScript/TypeScript
    if (language === 'javascript' || language === 'typescript') {
      const funcPattern = /(?:function\s+(\w+)|(\w+)\s*(?::\s*\w+)?\s*=>|(?:async\s+)?(\w+)\s*\()/g;
      let match;
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

    // Simplified for JavaScript/TypeScript
    if (language === 'javascript' || language === 'typescript') {
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
   * Get line number from character index
   */
  private getLineNumber(content: string, index: number): number {
    const before = content.substring(0, index);
    return before.split('\n').length;
  }

  /**
   * Generate unique issue ID
   */
  private generateIssueId(category: string, type: string, line: number): string {
    return `${category}-${type}-${line}`;
  }

  /**
   * Convert rule match to code issue
   */
  private toCodeIssue(match: RuleResult['matches'][0], ruleId: string): CodeIssue {
    const rule = this.rules.find(r => r.id === ruleId);
    return {
      id: this.generateIssueId('rule', ruleId, match.line),
      severity: rule?.severity || 'medium',
      category: rule?.category || 'best-practices',
      rule: ruleId,
      message: match.message,
      file: match.file,
      line: match.line,
      column: match.column,
      code: match.code,
      suggestion: match.suggestion,
      confidence: 0.8,
      tags: rule?.tags || [],
    };
  }

  /**
   * Generate review summary
   */
  private generateSummary(issues: CodeIssue[], metrics: CodeMetrics): ReviewSummary {
    const summary: ReviewSummary = {
      totalIssues: issues.length,
      criticalIssues: issues.filter(i => i.severity === 'critical').length,
      highIssues: issues.filter(i => i.severity === 'high').length,
      mediumIssues: issues.filter(i => i.severity === 'medium').length,
      lowIssues: issues.filter(i => i.severity === 'low').length,
      infoIssues: issues.filter(i => i.severity === 'info').length,
      securityScore: 100,
      performanceScore: 100,
      qualityScore: 100,
      maintainabilityScore: Math.round(metrics.maintainabilityIndex),
      recommendations: [],
      strengths: [],
      weaknesses: [],
    };

    // Calculate scores based on issues
    const criticalWeight = 25;
    const highWeight = 10;
    const mediumWeight = 5;
    const lowWeight = 1;
    const infoWeight = 0;

    const issueScore =
      summary.criticalIssues * criticalWeight +
      summary.highIssues * highWeight +
      summary.mediumIssues * mediumWeight +
      summary.lowIssues * lowWeight +
      summary.infoIssues * infoWeight;

    summary.securityScore = Math.max(0, 100 - issueScore);
    summary.performanceScore = Math.max(0, 100 - issueScore);
    summary.qualityScore = Math.max(0, 100 - issueScore);

    // Generate recommendations
    if (summary.criticalIssues > 0) {
      summary.recommendations.push(`Address ${summary.criticalIssues} critical security issues immediately`);
    }
    if (metrics.cyclomaticComplexity > 20) {
      summary.recommendations.push('Reduce function complexity by breaking down large functions');
    }
    if (metrics.duplicationPercentage > 10) {
      summary.recommendations.push('Extract duplicated code into reusable functions');
    }
    if (metrics.documentationCoverage < 20) {
      summary.recommendations.push('Improve code documentation');
    }

    // Identify strengths
    if (metrics.maintainabilityIndex > 80) {
      summary.strengths.push('High maintainability index');
    }
    if (metrics.duplicationPercentage < 5) {
      summary.strengths.push('Low code duplication');
    }
    if (metrics.documentationCoverage > 50) {
      summary.strengths.push('Good documentation coverage');
    }

    // Identify weaknesses
    if (metrics.cyclomaticComplexity > 15) {
      summary.weaknesses.push('High cyclomatic complexity');
    }
    if (metrics.maxNestingDepth > 5) {
      summary.weaknesses.push('Deep code nesting');
    }
    if (metrics.duplicationPercentage > 15) {
      summary.weaknesses.push('High code duplication');
    }

    return summary;
  }

  /**
   * Calculate overall score
   */
  private calculateScore(issues: CodeIssue[], metrics: CodeMetrics): number {
    const weights = {
      critical: 25,
      high: 10,
      medium: 5,
      low: 2,
      info: 0,
    };

    const issuePenalty = issues.reduce((sum, issue) => {
      return sum + (weights[issue.severity] || 0);
    }, 0);

    const maintainabilityBonus = metrics.maintainabilityIndex;

    const score = Math.max(0, Math.min(100, 100 - issuePenalty + (maintainabilityBonus / 5)));

    return Math.round(score);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a static analyzer instance
 */
export function createStaticAnalyzer(
  options?: Partial<AnalyzerConfig>
): StaticAnalyzer {
  return new StaticAnalyzer(options);
}
