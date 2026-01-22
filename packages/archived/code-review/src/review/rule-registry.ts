/**
 * Rule Registry - Manages and registers review rules
 */

// @ts-nocheck - Rule registry with unused parameters
import { Language, Category, Severity, RuleConfig } from '../types/index.js';

// ============================================================================
// Rule Definition
// ============================================================================

export interface RuleDefinition {
  id: string;
  name: string;
  category: Category;
  severity: Severity;
  description: string;
  languages: Language[];
  enabled: boolean;
  options?: Record<string, unknown>;
  execute: (
    filePath: string,
    content: string,
    ast: unknown,
    fileInfo: { path: string; language: Language; size: number; lines: number }
  ) => Promise<RuleIssue[]>;
}

export interface RuleIssue {
  ruleId: string;
  message: string;
  location: { line: number; column: number };
  severity: Severity;
  category: Category;
  fix?: {
    description: string;
    replacement: string;
  };
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Rule Registry
// ============================================================================

export class RuleRegistry {
  private rules: Map<string, RuleDefinition> = new Map();
  private rulesByLanguage: Map<Language, Set<string>> = new Map();
  private rulesByCategory: Map<Category, Set<string>> = new Map();

  constructor() {
    this.initializeBuiltInRules();
  }

  /**
   * Register a new rule
   */
  register(rule: RuleDefinition): void {
    this.rules.set(rule.id, rule);

    // Index by language
    for (const language of rule.languages) {
      if (!this.rulesByLanguage.has(language)) {
        this.rulesByLanguage.set(language, new Set());
      }
      this.rulesByLanguage.get(language)!.add(rule.id);
    }

    // Index by category
    if (!this.rulesByCategory.has(rule.category)) {
      this.rulesByCategory.set(rule.category, new Set());
    }
    this.rulesByCategory.get(rule.category)!.add(rule.id);
  }

  /**
   * Get a rule by ID
   */
  getRule(id: string): RuleDefinition | undefined {
    return this.rules.get(id);
  }

  /**
   * Get all rules for a language
   */
  getRulesForLanguage(language: Language): RuleDefinition[] {
    const ruleIds = this.rulesByLanguage.get(language);
    if (!ruleIds) {
      return [];
    }

    return Array.from(ruleIds)
      .map((id) => this.rules.get(id))
      .filter((r): r is RuleDefinition => r !== undefined && r.enabled);
  }

  /**
   * Get all rules for a category
   */
  getRulesForCategory(category: Category): RuleDefinition[] {
    const ruleIds = this.rulesByCategory.get(category);
    if (!ruleIds) {
      return [];
    }

    return Array.from(ruleIds)
      .map((id) => this.rules.get(id))
      .filter((r): r is RuleDefinition => r !== undefined && r.enabled);
  }

  /**
   * Enable or disable a rule
   */
  setRuleEnabled(id: string, enabled: boolean): boolean {
    const rule = this.rules.get(id);
    if (rule) {
      rule.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Update rule options
   */
  updateRuleOptions(id: string, options: Record<string, unknown>): boolean {
    const rule = this.rules.get(id);
    if (rule) {
      rule.options = { ...rule.options, ...options };
      return true;
    }
    return false;
  }

  /**
   * Get all registered rule IDs
   */
  getAllRuleIds(): string[] {
    return Array.from(this.rules.keys());
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    enabled: number;
    byLanguage: Record<string, number>;
    byCategory: Record<string, number>;
  } {
    const byLanguage: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const [language, ids] of this.rulesByLanguage.entries()) {
      byLanguage[language] = ids.size;
    }

    for (const [category, ids] of this.rulesByCategory.entries()) {
      byCategory[category] = ids.size;
    }

    return {
      total: this.rules.size,
      enabled: Array.from(this.rules.values()).filter((r) => r.enabled).length,
      byLanguage,
      byCategory,
    };
  }

  // ========================================================================
  // Built-in Rules
  // ========================================================================

  private initializeBuiltInRules(): void {
    // Security rules
    this.register(this.hardcodedSecretRule());
    this.register(this.sqlInjectionRule());
    this.register(this.xssVulnerabilityRule());
    this.register(this.insecureRandomRule());

    // Performance rules
    this.register(this.nestedLoopRule());
    this.register(this.inefficientRegexRule());
    this.register(this.memoryLeakRule());

    // Quality rules
    this.register(this.complexFunctionRule());
    this.register(this.longFunctionRule());
    this.register(this.deepNestingRule());
    this.register(this.magicNumberRule());

    // Style rules
    this.register(this.namingConventionRule());
    this.register(this.trailingWhitespaceRule());
    this.register(this.lineLengthRule());

    // Best practices
    this.register(this.consoleLogRule());
    this.register(this.todoCommentRule());
    this.register(this.emptyCatchRule());

    // Documentation
    this.register(this.missingJsdocRule());
    this.register(this.parameterDocumentationRule());

    // Testing
    this.register(this.missingTestRule());
    this.register(this.lowCoverageRule());
  }

  // ========================================================================
  // Security Rules
  // ========================================================================

  private hardcodedSecretRule(): RuleDefinition {
    return {
      id: 'security-hardcoded-secret',
      name: 'Hardcoded Secret',
      category: 'security',
      severity: 'error',
      description: 'Detects hardcoded secrets and passwords',
      languages: ['typescript', 'javascript', 'python', 'go', 'java'],
      enabled: true,
      execute: async (_filePath, content) => {
        const issues: RuleIssue[] = [];
        const lines = content.split('\n');
        const secretPatterns = [
          /password\s*=\s*['"][^'"]+['"]/i,
          /api[_-]?key\s*=\s*['"][^'"]+['"]/i,
          /secret\s*=\s*['"][^'"]+['"]/i,
          /token\s*=\s*['"][^'"]+['"]/i,
          /private[_-]?key\s*=\s*['"][^'"]+['"]/i,
        ];

        lines.forEach((line, index) => {
          for (const pattern of secretPatterns) {
            const match = line.match(pattern);
            if (match) {
              issues.push({
                ruleId: 'security-hardcoded-secret',
                message: `Possible hardcoded secret detected: ${match[0]}`,
                location: { line: index + 1, column: match.index! + 1 },
                severity: 'error',
                category: 'security',
                fix: {
                  description: 'Move secret to environment variables or secure configuration',
                  replacement: line.replace(match[0], "password = process.env.SECRET_PASSWORD"),
                },
              });
            }
          }
        });

        return issues;
      },
    };
  }

  private sqlInjectionRule(): RuleDefinition {
    return {
      id: 'security-sql-injection',
      name: 'SQL Injection',
      category: 'security',
      severity: 'error',
      description: 'Detects potential SQL injection vulnerabilities',
      languages: ['typescript', 'javascript', 'python', 'php'],
      enabled: true,
      execute: async (_filePath, content) => {
        const issues: RuleIssue[] = [];
        const lines = content.split('\n');
        const patterns = [
          /execute\s*\(\s*['"`].*\$\{.*\}['"`]/,
          /query\s*\(\s*['"`].*\+.*['"`]/,
        ];

        lines.forEach((line, index) => {
          for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
              issues.push({
                ruleId: 'security-sql-injection',
                message: 'Possible SQL injection vulnerability - use parameterized queries',
                location: { line: index + 1, column: match.index! + 1 },
                severity: 'error',
                category: 'security',
                fix: {
                  description: 'Use parameterized queries or prepared statements',
                  replacement: 'Use prepared statement with bound parameters',
                },
              });
            }
          }
        });

        return issues;
      },
    };
  }

  private xssVulnerabilityRule(): RuleDefinition {
    return {
      id: 'security-xss',
      name: 'Cross-Site Scripting (XSS)',
      category: 'security',
      severity: 'error',
      description: 'Detects potential XSS vulnerabilities',
      languages: ['typescript', 'javascript'],
      enabled: true,
      execute: async (_filePath, content) => {
        const issues: RuleIssue[] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          // Check for dangerous innerHTML assignments
          if (/\.(innerHTML|outerHTML)\s*=/.test(line) && !/innerHTML\s*=\s*['"`]\s*['"`]/.test(line)) {
            issues.push({
              ruleId: 'security-xss',
              message: 'Potential XSS vulnerability - setting innerHTML with variable data',
              location: { line: index + 1, column: line.indexOf('innerHTML') + 1 },
              severity: 'error',
              category: 'security',
              fix: {
                description: 'Use textContent or sanitize HTML',
                replacement: 'Use textContent or DOMPurify for sanitization',
              },
            });
          }

          // Check for dangerous document.write
          if (/document\.write\s*\(/.test(line)) {
            issues.push({
              ruleId: 'security-xss',
              message: 'Potential XSS vulnerability - document.write can execute scripts',
              location: { line: index + 1, column: line.indexOf('document.write') + 1 },
              severity: 'error',
              category: 'security',
            });
          }
        });

        return issues;
      },
    };
  }

  private insecureRandomRule(): RuleDefinition {
    return {
      id: 'security-insecure-random',
      name: 'Insecure Random Number Generation',
      category: 'security',
      severity: 'warning',
      description: 'Detects insecure random number generation',
      languages: ['typescript', 'javascript', 'python'],
      enabled: true,
      execute: async (_filePath, content) => {
        const issues: RuleIssue[] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          if (/Math\.random\s*\(/.test(line)) {
            // Check if used for security purposes
            if (/crypto|security|token|password|secret/i.test(line)) {
              issues.push({
                ruleId: 'security-insecure-random',
                message: 'Math.random() is not cryptographically secure',
                location: { line: index + 1, column: line.indexOf('Math.random') + 1 },
                severity: 'warning',
                category: 'security',
                fix: {
                  description: 'Use crypto.randomBytes() or crypto.getRandomValues()',
                  replacement: 'Use crypto module for secure random generation',
                },
              });
            }
          }
        });

        return issues;
      },
    };
  }

  // ========================================================================
  // Performance Rules
  // ========================================================================

  private nestedLoopRule(): RuleDefinition {
    return {
      id: 'performance-nested-loop',
      name: 'Nested Loops',
      category: 'performance',
      severity: 'warning',
      description: 'Detects deeply nested loops that may cause performance issues',
      languages: ['typescript', 'javascript', 'python', 'java', 'go'],
      enabled: true,
      execute: async (_filePath, content) => {
        const issues: RuleIssue[] = [];
        const lines = content.split('\n');
        let loopDepth = 0;

        lines.forEach((line, index) => {
          const trimmed = line.trim();

          // Count opening loops
          if (/^\s*(for|while)\s*\(/.test(trimmed)) {
            loopDepth++;
            if (loopDepth > 2) {
              issues.push({
                ruleId: 'performance-nested-loop',
                message: `Deeply nested loop (depth ${loopDepth}) detected - consider refactoring`,
                location: { line: index + 1, column: line.search(/\S/) + 1 },
                severity: 'warning',
                category: 'performance',
                metadata: { depth: loopDepth },
              });
            }
          }

          // Count closing braces
          const closeBraces = (trimmed.match(/\}/g) || []).length;
          loopDepth = Math.max(0, loopDepth - closeBraces);
        });

        return issues;
      },
    };
  }

  private inefficientRegexRule(): RuleDefinition {
    return {
      id: 'performance-inefficient-regex',
      name: 'Inefficient Regular Expression',
      category: 'performance',
      severity: 'warning',
      description: 'Detects inefficient regular expressions',
      languages: ['typescript', 'javascript', 'python', 'go'],
      enabled: true,
      execute: async (_filePath, content) => {
        const issues: RuleIssue[] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          // Check for catastrophic backtracking patterns
          const patterns = [
            /\(.+\)\+\(.+\)+/, // Nested quantifiers
            /\(.+\*\(.+\)+/, // Nested quantifiers
            /\(.+\)\{10,\}/, // Excessive quantifiers
          ];

          for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
              issues.push({
                ruleId: 'performance-inefficient-regex',
                message: 'Inefficient regex pattern that may cause catastrophic backtracking',
                location: { line: index + 1, column: match.index! + 1 },
                severity: 'warning',
                category: 'performance',
              });
            }
          }
        });

        return issues;
      },
    };
  }

  private memoryLeakRule(): RuleDefinition {
    return {
      id: 'performance-memory-leak',
      name: 'Potential Memory Leak',
      category: 'performance',
      severity: 'warning',
      description: 'Detects potential memory leaks',
      languages: ['typescript', 'javascript'],
      enabled: true,
      execute: async (_filePath, content) => {
        const issues: RuleIssue[] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          // Check for event listeners without cleanup
          if (/\.(addEventListener|on)\s*\(/.test(line)) {
            // Look ahead for removal
            const nextLines = lines.slice(index, Math.min(index + 20, lines.length));
            const hasRemoval = nextLines.some((l) =>
              /\.(removeEventListener|off)\s*\(/.test(l)
            );

            if (!hasRemoval) {
              issues.push({
                ruleId: 'performance-memory-leak',
                message: 'Event listener added without corresponding removal - potential memory leak',
                location: { line: index + 1, column: line.search(/\S/) + 1 },
                severity: 'warning',
                category: 'performance',
                fix: {
                  description: 'Remove event listener when component unmounts or no longer needed',
                  replacement: 'Add removeEventListener in cleanup',
                },
              });
            }
          }

          // Check for setInterval without clearInterval
          if (/\bsetInterval\s*\(/.test(line)) {
            const nextLines = lines.slice(index, Math.min(index + 20, lines.length));
            const hasClear = nextLines.some((l) => /\bclearInterval\s*\(/.test(l));

            if (!hasClear) {
              issues.push({
                ruleId: 'performance-memory-leak',
                message: 'setInterval without clearInterval - potential memory leak',
                location: { line: index + 1, column: line.search(/\S/) + 1 },
                severity: 'warning',
                category: 'performance',
              });
            }
          }
        });

        return issues;
      },
    };
  }

  // ========================================================================
  // Quality Rules
  // ========================================================================

  private complexFunctionRule(): RuleDefinition {
    return {
      id: 'quality-complex-function',
      name: 'Complex Function',
      category: 'quality',
      severity: 'warning',
      description: 'Detects functions with high cyclomatic complexity',
      languages: ['typescript', 'javascript', 'python', 'java', 'go'],
      enabled: true,
      execute: async (_filePath, content) => {
        const issues: RuleIssue[] = [];
        const lines = content.split('\n');

        // Simple complexity counting based on decision points
        lines.forEach((line, index) => {
          const decisionPoints = (line.match(/\b(if|else|for|while|case|catch|&&|\|\|)\b/g) || []).length;
          if (decisionPoints > 5) {
            issues.push({
              ruleId: 'quality-complex-function',
              message: `High complexity detected (${decisionPoints} decision points)`,
              location: { line: index + 1, column: line.search(/\S/) + 1 },
              severity: 'warning',
              category: 'quality',
              metadata: { complexity: decisionPoints },
            });
          }
        });

        return issues;
      },
    };
  }

  private longFunctionRule(): RuleDefinition {
    return {
      id: 'quality-long-function',
      name: 'Long Function',
      category: 'quality',
      severity: 'info',
      description: 'Detects functions that are too long',
      languages: ['typescript', 'javascript', 'python', 'java', 'go'],
      enabled: true,
      options: { maxLines: 50 },
      execute: async (_filePath, content, _ast, fileInfo) => {
        const issues: RuleIssue[] = [];
        const maxLines = (fileInfo as any).maxLines || 50;

        if (fileInfo.lines > maxLines) {
          issues.push({
            ruleId: 'quality-long-function',
            message: `Function exceeds ${maxLines} lines (${fileInfo.lines} lines)`,
            location: { line: 1, column: 1 },
            severity: 'info',
            category: 'quality',
            fix: {
              description: 'Consider breaking this function into smaller, more focused functions',
              replacement: 'Extract logical blocks into separate functions',
            },
          });
        }

        return issues;
      },
    };
  }

  private deepNestingRule(): RuleDefinition {
    return {
      id: 'quality-deep-nesting',
      name: 'Deep Nesting',
      category: 'quality',
      severity: 'warning',
      description: 'Detects deeply nested code blocks',
      languages: ['typescript', 'javascript', 'python', 'java', 'go'],
      enabled: true,
      options: { maxDepth: 4 },
      execute: async (_filePath, content) => {
        const issues: RuleIssue[] = [];
        const lines = content.split('\n');
        const maxDepth = 4;

        lines.forEach((line, index) => {
          const indent = line.search(/\S/);
          const depth = Math.floor(indent / 4); // Assuming 4-space indentation

          if (depth > maxDepth) {
            issues.push({
              ruleId: 'quality-deep-nesting',
              message: `Deep nesting detected (depth ${depth}) - consider refactoring`,
              location: { line: index + 1, column: indent + 1 },
              severity: 'warning',
              category: 'quality',
              metadata: { depth },
            });
          }
        });

        return issues;
      },
    };
  }

  private magicNumberRule(): RuleDefinition {
    return {
      id: 'quality-magic-number',
      name: 'Magic Number',
      category: 'quality',
      severity: 'info',
      description: 'Detects magic numbers in code',
      languages: ['typescript', 'javascript', 'python', 'java', 'go'],
      enabled: true,
      execute: async (_filePath, content) => {
        const issues: RuleIssue[] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          // Match numbers (excluding 0, 1, and common values)
          const matches = line.match(/\b(?!0\b|1\b|2\b)[2-9]\d*\b/g);
          if (matches) {
            matches.forEach((match) => {
              // Skip if it's part of common patterns
              if (!/version|port|status|error|code/i.test(line)) {
                issues.push({
                  ruleId: 'quality-magic-number',
                  message: `Magic number '${match}' should be replaced with a named constant`,
                  location: { line: index + 1, column: line.indexOf(match) + 1 },
                  severity: 'info',
                  category: 'quality',
                });
              }
            });
          }
        });

        return issues;
      },
    };
  }

  // ========================================================================
  // Style Rules
  // ========================================================================

  private namingConventionRule(): RuleDefinition {
    return {
      id: 'style-naming-convention',
      name: 'Naming Convention',
      category: 'style',
      severity: 'info',
      description: 'Checks naming conventions',
      languages: ['typescript', 'javascript', 'python'],
      enabled: true,
      execute: async (_filePath, content) => {
        const issues: RuleIssue[] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          // Check for camelCase variable names
          const varMatch = line.match(/(?:let|const|var)\s+([a-z][a-zA-Z0-9]*)\s*=/);
          if (varMatch) {
            const varName = varMatch[1];
            // Check if it starts with lowercase
            if (/^[A-Z_]/.test(varName)) {
              issues.push({
                ruleId: 'style-naming-convention',
                message: `Variable '${varName}' should use camelCase`,
                location: { line: index + 1, column: varMatch.index! + 1 },
                severity: 'info',
                category: 'style',
              });
            }
          }

          // Check for PascalClass names
          const classMatch = line.match(/class\s+([A-Z][a-zA-Z0-9]*)/);
          if (classMatch) {
            const className = classMatch[1];
            if (/^[a-z]/.test(className)) {
              issues.push({
                ruleId: 'style-naming-convention',
                message: `Class '${className}' should use PascalCase`,
                location: { line: index + 1, column: classMatch.index! + 1 },
                severity: 'info',
                category: 'style',
              });
            }
          }
        });

        return issues;
      },
    };
  }

  private trailingWhitespaceRule(): RuleDefinition {
    return {
      id: 'style-trailing-whitespace',
      name: 'Trailing Whitespace',
      category: 'style',
      severity: 'hint',
      description: 'Detects trailing whitespace',
      languages: ['typescript', 'javascript', 'python', 'java', 'go', 'rust'],
      enabled: true,
      execute: async (_filePath, content) => {
        const issues: RuleIssue[] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          if (line !== line.trimEnd()) {
            issues.push({
              ruleId: 'style-trailing-whitespace',
              message: 'Trailing whitespace detected',
              location: { line: index + 1, column: line.trimEnd().length + 1 },
              severity: 'hint',
              category: 'style',
              fix: {
                description: 'Remove trailing whitespace',
                replacement: line.trimEnd(),
              },
            });
          }
        });

        return issues;
      },
    };
  }

  private lineLengthRule(): RuleDefinition {
    return {
      id: 'style-line-length',
      name: 'Line Length',
      category: 'style',
      severity: 'info',
      description: 'Detects lines that are too long',
      languages: ['typescript', 'javascript', 'python', 'java', 'go'],
      enabled: true,
      options: { maxLength: 120 },
      execute: async (_filePath, content) => {
        const issues: RuleIssue[] = [];
        const lines = content.split('\n');
        const maxLength = 120;

        lines.forEach((line, index) => {
          if (line.length > maxLength) {
            issues.push({
              ruleId: 'style-line-length',
              message: `Line exceeds ${maxLength} characters (${line.length} characters)`,
              location: { line: index + 1, column: maxLength + 1 },
              severity: 'info',
              category: 'style',
            });
          }
        });

        return issues;
      },
    };
  }

  // ========================================================================
  // Best Practices Rules
  // ========================================================================

  private consoleLogRule(): RuleDefinition {
    return {
      id: 'practices-console-log',
      name: 'Console Log',
      category: 'best-practices',
      severity: 'warning',
      description: 'Detects console.log statements that should be removed',
      languages: ['typescript', 'javascript'],
      enabled: true,
      execute: async (_filePath, content) => {
        const issues: RuleIssue[] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          if (/console\.(log|debug|info|warn)\s*\(/.test(line)) {
            issues.push({
              ruleId: 'practices-console-log',
              message: 'Console statement should be removed or replaced with proper logging',
              location: { line: index + 1, column: line.indexOf('console') + 1 },
              severity: 'warning',
              category: 'best-practices',
            });
          }
        });

        return issues;
      },
    };
  }

  private todoCommentRule(): RuleDefinition {
    return {
      id: 'practices-todo-comment',
      name: 'TODO Comment',
      category: 'best-practices',
      severity: 'info',
      description: 'Detects TODO comments',
      languages: ['typescript', 'javascript', 'python', 'java', 'go'],
      enabled: true,
      execute: async (_filePath, content) => {
        const issues: RuleIssue[] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          const match = line.match(/(TODO|FIXME|HACK|XXX)\b.*/);
          if (match) {
            issues.push({
              ruleId: 'practices-todo-comment',
              message: `TODO comment found: ${match[0].trim()}`,
              location: { line: index + 1, column: match.index! + 1 },
              severity: 'info',
              category: 'best-practices',
            });
          }
        });

        return issues;
      },
    };
  }

  private emptyCatchRule(): RuleDefinition {
    return {
      id: 'practices-empty-catch',
      name: 'Empty Catch Block',
      category: 'best-practices',
      severity: 'warning',
      description: 'Detects empty catch blocks',
      languages: ['typescript', 'javascript', 'java', 'python', 'csharp'],
      enabled: true,
      execute: async (_filePath, content) => {
        const issues: RuleIssue[] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          if (/\}\s*catch\s*\([^)]*\)\s*\{\s*\}/.test(line)) {
            issues.push({
              ruleId: 'practices-empty-catch',
              message: 'Empty catch block - should handle or log the error',
              location: { line: index + 1, column: line.search(/\S/) + 1 },
              severity: 'warning',
              category: 'best-practices',
            });
          }
        });

        return issues;
      },
    };
  }

  // ========================================================================
  // Documentation Rules
  // ========================================================================

  private missingJsdocRule(): RuleDefinition {
    return {
      id: 'docs-missing-jsdoc',
      name: 'Missing JSDoc',
      category: 'documentation',
      severity: 'info',
      description: 'Detects missing JSDoc comments',
      languages: ['typescript', 'javascript'],
      enabled: true,
      execute: async (_filePath, content) => {
        const issues: RuleIssue[] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
          // Check for function declarations
          const funcMatch = line.match(
            /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)/
          );
          if (funcMatch) {
            const funcName = funcMatch[1] || funcMatch[2];

            // Look for JSDoc comment before
            const prevLine = index > 0 ? lines[index - 1].trim() : '';
            const hasJSDoc = prevLine.startsWith('*') || prevLine.startsWith('/**');

            if (!hasJSDoc && funcName !== '_') {
              issues.push({
                ruleId: 'docs-missing-jsdoc',
                message: `Function '${funcName}' is missing JSDoc documentation`,
                location: { line: index + 1, column: line.search(/\S/) + 1 },
                severity: 'info',
                category: 'documentation',
              });
            }
          }
        });

        return issues;
      },
    };
  }

  private parameterDocumentationRule(): RuleDefinition {
    return {
      id: 'docs-parameter-docs',
      name: 'Missing Parameter Documentation',
      category: 'documentation',
      severity: 'info',
      description: 'Detects undocumented parameters',
      languages: ['typescript', 'javascript'],
      enabled: true,
      execute: async (_filePath, content) => {
        const issues: RuleIssue[] = [];
        const lines = content.split('\n');

        // This is a simplified version - full implementation would parse JSDoc
        lines.forEach((line, index) => {
          if (/@param/.test(line)) {
            const paramMatch = line.match(/@param\s+\{([^}]+)\}\s+(\w+)/);
            if (paramMatch) {
              const type = paramMatch[1];
              const name = paramMatch[2];

              // Check if description is present
              const description = line.substring(paramMatch[0].length).trim();
              if (!description) {
                issues.push({
                  ruleId: 'docs-parameter-docs',
                  message: `Parameter '${name}' is missing description`,
                  location: { line: index + 1, column: 1 },
                  severity: 'info',
                  category: 'documentation',
                });
              }
            }
          }
        });

        return issues;
      },
    };
  }

  // ========================================================================
  // Testing Rules
  // ========================================================================

  private missingTestRule(): RuleDefinition {
    return {
      id: 'test-missing-test',
      name: 'Missing Test',
      category: 'testing',
      severity: 'info',
      description: 'Detects untested functions',
      languages: ['typescript', 'javascript', 'python'],
      enabled: false, // Disabled by default as it requires project-wide analysis
      execute: async (_filePath, _content) => {
        // This would require cross-file analysis
        return [];
      },
    };
  }

  private lowCoverageRule(): RuleDefinition {
    return {
      id: 'test-low-coverage',
      name: 'Low Code Coverage',
      category: 'testing',
      severity: 'warning',
      description: 'Detects low code coverage',
      languages: ['typescript', 'javascript', 'python'],
      enabled: false, // Disabled by default as it requires coverage reports
      execute: async (_filePath, _content) => {
        // This would require coverage reports
        return [];
      },
    };
  }
}
