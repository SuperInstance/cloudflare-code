/**
 * Best Practices Enforcer - Enforces coding best practices and design patterns
 */

import { Issue, Severity, Category, FileInfo, Language } from '../types/index.js';

// ============================================================================
// Best Practices Enforcer Options
// ============================================================================

interface PracticesEnforcerOptions {
  checkSOLID?: boolean;
  checkDRY?: boolean;
  checkKISS?: boolean;
  checkYAGNI?: boolean;
  checkErrorHandling?: boolean;
  checkTesting?: boolean;
  checkDocumentation?: boolean;
  checkDesignPatterns?: boolean;
  checkArchitecture?: boolean;
}

const DEFAULT_OPTIONS: PracticesEnforcerOptions = {
  checkSOLID: true,
  checkDRY: true,
  checkKISS: true,
  checkYAGNI: true,
  checkErrorHandling: true,
  checkTesting: true,
  checkDocumentation: false, // Disabled by default as it requires external analysis
  checkDesignPatterns: true,
  checkArchitecture: true,
};

// ============================================================================
// Best Practices Enforcer
// ============================================================================

export class PracticesEnforcer {
  private options: PracticesEnforcerOptions;

  constructor(options: PracticesEnforcerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ========================================================================
  // Main Enforce Methods
  // ========================================================================

  /**
   * Enforce best practices for a file
   */
  async enforceFile(filePath: string, content: string, fileInfo: FileInfo): Promise<Issue[]> {
    const issues: Issue[] = [];

    if (this.options.checkSOLID) {
      issues.push(...this.checkSOLID(filePath, content, fileInfo));
    }

    if (this.options.checkDRY) {
      issues.push(...this.checkDRY(filePath, content, fileInfo));
    }

    if (this.options.checkKISS) {
      issues.push(...this.checkKISS(filePath, content, fileInfo));
    }

    if (this.options.checkYAGNI) {
      issues.push(...this.checkYAGNI(filePath, content, fileInfo));
    }

    if (this.options.checkErrorHandling) {
      issues.push(...this.checkErrorHandling(filePath, content, fileInfo));
    }

    if (this.options.checkDesignPatterns) {
      issues.push(...this.checkDesignPatterns(filePath, content, fileInfo));
    }

    if (this.options.checkArchitecture) {
      issues.push(...this.checkArchitecture(filePath, content, fileInfo));
    }

    return issues;
  }

  // ========================================================================
  // SOLID Principles
  // ========================================================================

  private checkSOLID(filePath: string, content: string, fileInfo: FileInfo): Issue[] {
    const issues: Issue[] = [];

    // Single Responsibility Principle (SRP)
    issues.push(...this.checkSRP(filePath, content, fileInfo));

    // Open/Closed Principle (OCP)
    issues.push(...this.checkOCP(filePath, content, fileInfo));

    // Liskov Substitution Principle (LSP)
    issues.push(...this.checkLSP(filePath, content, fileInfo));

    // Interface Segregation Principle (ISP)
    issues.push(...this.checkISP(filePath, content, fileInfo));

    // Dependency Inversion Principle (DIP)
    issues.push(...this.checkDIP(filePath, content, fileInfo));

    return issues;
  }

  private checkSRP(filePath: string, content: string, fileInfo: FileInfo): Issue[] {
    const issues: Issue[] = [];
    const lines = content.split('\n');

    // Check for classes that do too much
    let methodCount = 0;
    let propertyCount = 0;

    for (const line of lines) {
      if (/\w+\s*\([^)]*\)\s*{/.test(line)) methodCount++;
      if (/(this\.|private|public)\s+\w+/.test(line)) propertyCount++;
    }

    if (methodCount > 10 && propertyCount > 10) {
      issues.push(this.createIssue(
        'srp-violation',
        'Single Responsibility Principle Violation',
        'Class appears to have too many responsibilities. Consider splitting it.',
        filePath,
        1,
        'warning',
        'SRP',
        'Split class into smaller, focused classes'
      ));
    }

    return issues;
  }

  private checkOCP(filePath: string, content: string, fileInfo: FileInfo): Issue[] {
    const issues: Issue[] = [];
    const lines = content.split('\n');

    // Check for methods that need modification for new types
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for switch/if-else on type
      if (/switch\s*\(\s*\w+\.type/.test(line) || /if\s*\([^)]*\.type\s*===/.test(line)) {
        // Look ahead to see if it's a long chain
        const nextLines = lines.slice(i, Math.min(i + 20, lines.length)).join('\n');
        const caseCount = (nextLines.match(/case\s+/g) || []).length;
        const elseCount = (nextLines.match(/else if/g) || []).length;

        if (caseCount > 3 || elseCount > 3) {
          issues.push(this.createIssue(
            'ocp-violation',
            'Open/Closed Principle Violation',
            'Code uses type-based polymorphism. Consider using inheritance or strategy pattern.',
            filePath,
            i + 1,
            'info',
            'OCP',
            'Use polymorphism to make code open for extension, closed for modification'
          ));
          break;
        }
      }
    }

    return issues;
  }

  private checkLSP(filePath: string, content: string, fileInfo: FileInfo): Issue[] {
    const issues: Issue[] = [];
    const lines = content.split('\n');

    // Check for inheritance issues
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for subclasses that override to throw errors
      if (/\bextends\s+\w+/.test(line)) {
        const nextLines = lines.slice(i, Math.min(i + 30, lines.length)).join('\n');

        if (/throw\s+new\s+(NotImplementedError|UnsupportedOperationException)/.test(nextLines)) {
          issues.push(this.createIssue(
            'lsp-violation',
            'Liskov Substitution Principle Violation',
            'Subclass throws error for parent method. This violates LSP.',
            filePath,
            i + 1,
            'warning',
            'LSP',
            'Refactor inheritance hierarchy or use composition instead'
          ));
        }
      }
    }

    return issues;
  }

  private checkISP(filePath: string, content: string, fileInfo: FileInfo): Issue[] {
    const issues: Issue[] = [];
    const lines = content.split('\n');

    // Check for fat interfaces
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/interface\s+\w+/.test(line) || /protocol\s+\w+/.test(line)) {
        // Count methods in interface
        let methodCount = 0;
        let j = i + 1;

        while (j < lines.length && j < i + 50) {
          if (lines[j].includes('}')) break;
          if (/\w+\s*\(/.test(lines[j])) methodCount++;
          j++;
        }

        if (methodCount > 10) {
          issues.push(this.createIssue(
            'isp-violation',
            'Interface Segregation Principle Violation',
            `Interface has ${methodCount} methods. Consider splitting into smaller, focused interfaces.`,
            filePath,
            i + 1,
            'info',
            'ISP',
            'Split interface into smaller, role-specific interfaces'
          ));
        }
      }
    }

    return issues;
  }

  private checkDIP(filePath: string, content: string, fileInfo: FileInfo): Issue[] {
    const issues: Issue[] = [];
    const lines = content.split('\n');

    // Check for direct dependency on concrete implementations
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for instantiation of concrete classes
      if (/\b(new\s+)[A-Z][a-zA-Z0-9]*\s*\(/.test(line)) {
        // Check if it's a concrete class (not an interface or abstract)
        const match = line.match(/new\s+([A-Z][a-zA-Z0-9]*)/);
        if (match) {
          const className = match[1];

          // Look for interface definition
          const hasInterface = content.includes(`interface I${className}`) || content.includes(`interface ${className}Service`);

          if (hasInterface) {
            issues.push(this.createIssue(
              'dip-violation',
              'Dependency Inversion Principle Violation',
              `Code depends on concrete class ${className} instead of abstraction.`,
              filePath,
              i + 1,
              'info',
              'DIP',
              `Depend on I${className} interface instead`
            ));
          }
        }
      }
    }

    return issues;
  }

  // ========================================================================
  // DRY Principle
  // ========================================================================

  private checkDRY(filePath: string, content: string, fileInfo: FileInfo): Issue[] {
    const issues: Issue[] = [];
    const lines = content.split('\n');

    // Track repeated patterns
    const patterns: Map<string, number[]> = new Map();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length > 20 && !line.startsWith('//') && !line.startsWith('#')) {
        const normalized = line.replace(/\s+/g, ' ').replace(/\d+/g, 'N');
        if (!patterns.has(normalized)) {
          patterns.set(normalized, []);
        }
        patterns.get(normalized)!.push(i + 1);
      }
    }

    // Report repeated patterns
    for (const [pattern, occurrences] of patterns.entries()) {
      if (occurrences.length > 2) {
        issues.push(this.createIssue(
          'dry-violation',
          'Don\'t Repeat Yourself (DRY) Violation',
          `Code pattern appears ${occurrences.length} times. Extract to a function.`,
          filePath,
          occurrences[0],
          'info',
          'DRY',
          'Extract repeated code into a reusable function'
        ));
      }
    }

    return issues;
  }

  // ========================================================================
  // KISS Principle
  // ========================================================================

  private checkKISS(filePath: string, content: string, fileInfo: FileInfo): Issue[] {
    const issues: Issue[] = [];
    const lines = content.split('\n');

    // Check for overly complex expressions
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Count operators and parentheses
      const operatorCount = (line.match(/[+\-*/%&|^!=<>]/g) || []).length;
      const parenCount = (line.match(/\(/g) || []).length;

      if (operatorCount > 5 || parenCount > 5) {
        issues.push(this.createIssue(
          'kiss-violation',
          'Keep It Simple, Stupid (KISS) Violation',
          'Expression is too complex. Break it down into simpler parts.',
          filePath,
          i + 1,
          'info',
          'KISS',
          'Extract complex expression into named variable or function'
        ));
      }
    }

    return issues;
  }

  // ========================================================================
  // YAGNI Principle
  // ========================================================================

  private checkYAGNI(filePath: string, content: string, fileInfo: FileInfo): Issue[] {
    const issues: Issue[] = [];
    const lines = content.split('\n');

    // Check for unused parameters and methods
    const parameters: Set<string> = new Set();
    const usedParams: Set<string> = new Set();

    for (const line of lines) {
      // Collect parameters
      const paramMatch = line.match(/(\w+)\s*,\s*/g);
      if (paramMatch) {
        paramMatch.forEach((m) => {
          const name = m.replace(',', '').trim();
          if (name && name !== 'callback' && name !== 'next' && name !== 'done') {
            parameters.add(name);
          }
        });
      }

      // Check usage
      for (const param of parameters) {
        if (line.includes(param) && !line.includes('function') && !line.includes('=>')) {
          usedParams.add(param);
        }
      }
    }

    // Find unused parameters
    for (const param of parameters) {
      if (!usedParams.has(param)) {
        issues.push(this.createIssue(
          'yagni-violation',
          'You Aren\'t Gonna Need It (YAGNI) Violation',
          `Parameter '${param}' is never used. Remove it (YAGNI).`,
          filePath,
          1,
          'hint',
          'YAGNI',
          `Remove unused parameter '${param}'`
        ));
      }
    }

    return issues;
  }

  // ========================================================================
  // Error Handling
  // ========================================================================

  private checkErrorHandling(filePath: string, content: string, fileInfo: FileInfo): Issue[] {
    const issues: Issue[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for empty catch blocks
      if (/\}\s*catch\s*\([^)]*\)\s*\{\s*\}/.test(line)) {
        issues.push(this.createIssue(
          'error-handling',
          'Empty Catch Block',
          'Catch block should handle or log the error, not ignore it.',
          filePath,
          i + 1,
          'warning',
          'Error Handling',
          'Add error handling or logging in catch block'
        ));
      }

      // Check for catching generic exceptions
      if (/catch\s*\(\s*(Exception|Error|Throwable)\s+\w+\s*\)/.test(line)) {
        issues.push(this.createIssue(
          'error-handling',
          'Generic Exception Catch',
          'Catching generic exceptions is discouraged. Catch specific exceptions.',
          filePath,
          i + 1,
          'info',
          'Error Handling',
          'Catch specific exception types instead'
        ));
      }

      // Check for swallowing errors
      if (/catch\s*\([^)]*\)\s*{\s*\/\/\s*empty/i.test(line)) {
        issues.push(this.createIssue(
          'error-handling',
          'Swallowed Error',
          'Error is being caught and intentionally ignored.',
          filePath,
          i + 1,
          'warning',
          'Error Handling',
          'Properly handle the error or rethrow it'
        ));
      }

      // Check for operations without error handling
      if (this.isRiskyOperation(line) && !this.hasErrorHandling(lines, i)) {
        issues.push(this.createIssue(
          'error-handling',
          'Missing Error Handling',
          'Risky operation without proper error handling.',
          filePath,
          i + 1,
          'info',
          'Error Handling',
          'Add try-catch or error handling'
        ));
      }
    }

    return issues;
  }

  private isRiskyOperation(line: string): boolean {
    return /\b(JSON\.parse|fs\.readFileSync|require\s*\(|import\s*\()/.test(line);
  }

  private hasErrorHandling(lines: string[], index: number): boolean {
    const surroundingCode = lines.slice(Math.max(0, index - 10), Math.min(lines.length, index + 20)).join('\n');
    return /try\s*{/.test(surroundingCode);
  }

  // ========================================================================
  // Design Patterns
  // ========================================================================

  private checkDesignPatterns(filePath: string, content: string, fileInfo: FileInfo): Issue[] {
    const issues: Issue[] = [];

    // Suggest using factory pattern for complex object creation
    issues.push(...this.suggestFactoryPattern(filePath, content));

    // Suggest using singleton for single-instance classes
    issues.push(...this.suggestSingletonPattern(filePath, content));

    // Suggest using observer/event pattern for notifications
    issues.push(...this.suggestObserverPattern(filePath, content));

    // Suggest using strategy pattern for algorithms
    issues.push(...this.suggestStrategyPattern(filePath, content));

    return issues;
  }

  private suggestFactoryPattern(filePath: string, content: string): Issue[] {
    const issues: Issue[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Look for multiple new statements with conditions
      if (/if\s*\([^)]*\)\s*{\s*new\s+\w+/.test(line)) {
        const nextLines = lines.slice(i, Math.min(i + 10, lines.length)).join('\n');
        if (/else.*new\s+\w+/.test(nextLines)) {
          issues.push(this.createIssue(
            'design-pattern',
            'Consider Factory Pattern',
            'Multiple conditional object creations detected. Consider using Factory pattern.',
            filePath,
            i + 1,
            'info',
            'Factory Pattern',
            'Use Factory pattern to encapsulate object creation logic'
          ));
        }
      }
    }

    return issues;
  }

  private suggestSingletonPattern(filePath: string, content: string): Issue[] {
    const issues: Issue[] = [];

    // Look for classes that manage single instance
    if (/class\s+\w+.*\{[\s\S]*static\s+instance/.test(content)) {
      // Already using singleton
    } else if (/class\s+\w+Manager|class\s+\w+Service/.test(content)) {
      issues.push(this.createIssue(
        'design-pattern',
        'Consider Singleton Pattern',
        'Manager/Service class might benefit from Singleton pattern.',
        filePath,
        1,
        'hint',
        'Singleton Pattern',
        'Consider implementing Singleton if only one instance should exist'
      ));
    }

    return issues;
  }

  private suggestObserverPattern(filePath: string, content: string): Issue[] {
    const issues: Issue[] = [];
    const lines = content.split('\n');

    // Look for manual notification code
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/notify|emit|trigger|fire/.test(line) && /\.\s*(forEach|for|map)\s*\(/.test(line)) {
        issues.push(this.createIssue(
          'design-pattern',
          'Consider Observer Pattern',
          'Manual notification code detected. Consider using Observer/Event pattern.',
          filePath,
          i + 1,
          'info',
          'Observer Pattern',
          'Implement Observer pattern for decoupled notifications'
        ));
      }
    }

    return issues;
  }

  private suggestStrategyPattern(filePath: string, content: string): Issue[] {
    const issues: Issue[] = [];
    const lines = content.split('\n');

    // Look for switch/if-else on strategy type
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/switch\s*\(\s*\w+\.(strategy|algorithm|type)/.test(line)) {
        issues.push(this.createIssue(
          'design-pattern',
          'Consider Strategy Pattern',
          'Strategy-based switch detected. Consider using Strategy pattern.',
          filePath,
          i + 1,
          'info',
          'Strategy Pattern',
          'Replace with Strategy pattern for better extensibility'
        ));
      }
    }

    return issues;
  }

  // ========================================================================
  // Architecture
  // ========================================================================

  private checkArchitecture(filePath: string, content: string, fileInfo: FileInfo): Issue[] {
    const issues: Issue[] = [];

    // Check for circular dependencies (simplified)
    issues.push(...this.checkCircularDependencies(filePath, content));

    // Check for proper layering
    issues.push(...this.checkLayering(filePath, content));

    return issues;
  }

  private checkCircularDependencies(filePath: string, content: string): Issue[] {
    const issues: Issue[] = [];

    // Simplified check - would need full project analysis
    const imports = content.match(/import\s+.*from\s+['"]([^'"]+)['"]/g) || [];

    if (imports.length > 20) {
      issues.push(this.createIssue(
        'architecture',
        'High Import Coupling',
        'File has many imports. Consider refactoring to reduce coupling.',
        filePath,
        1,
        'info',
        'Architecture',
        'Extract dependencies or introduce abstractions'
      ));
    }

    return issues;
  }

  private checkLayering(filePath: string, content: string): Issue[] {
    const issues: Issue[] = [];

    // Check if domain layer imports infrastructure or presentation
    if (filePath.includes('/domain/') || filePath.includes('\\domain\\')) {
      const imports = content.match(/import\s+.*from\s+['"]([^'"]+)['"]/g) || [];

      for (const imp of imports) {
        if (imp.includes('/infrastructure/') || imp.includes('/ui/') || imp.includes('/presentation/')) {
          issues.push(this.createIssue(
            'architecture',
            'Layer Violation',
            'Domain layer should not depend on infrastructure or presentation layers.',
            filePath,
            1,
            'warning',
            'Clean Architecture',
            'Move dependencies or use dependency inversion'
          ));
          break;
        }
      }
    }

    return issues;
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private createIssue(
    ruleId: string,
    title: string,
    description: string,
    filePath: string,
    line: number,
    severity: Severity,
    principle: string,
    suggestion: string
  ): Issue {
    return {
      id: `PRACTICE-${ruleId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId,
      severity,
      category: 'best-practices',
      title,
      description,
      location: {
        path: filePath,
        line,
        column: 1,
      },
      suggestion,
      metadata: {
        principle,
      },
      timestamp: new Date(),
    };
  }
}
