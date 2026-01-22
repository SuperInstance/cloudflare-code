/**
 * Code Validator
 *
 * AST-based code validation with quality checks,
 * security scanning, and best practices enforcement.
 */

import type {
  ValidationRequest,
  ValidationResult,
  ValidationIssue,
  ValidationRule,
  ValidationOptions,
  QualityCategory,
  QualityMetrics,
  TextEdit,
  Fix,
} from './types';
import type { SupportedLanguage } from '../codebase/types';

/**
 * Validation rule definition
 */
interface RuleDefinition {
  id: string;
  name: string;
  category: QualityCategory;
  severity: 'error' | 'warning' | 'info' | 'suggestion';
  description: string;
  pattern?: RegExp;
  check: (code: string, language: SupportedLanguage) => ValidationIssue[];
  fix?: (code: string, issue: ValidationIssue) => string;
}

/**
 * Code Validator
 */
export class CodeValidator {
  private rules: Map<string, RuleDefinition>;
  private customRules: ValidationRule[];
  private cache: Map<string, ValidationResult>;

  constructor() {
    this.rules = new Map();
    this.customRules = [];
    this.cache = new Map();

    // Register default rules
    this.registerDefaultRules();
  }

  /**
   * Validate code
   */
  async validate(request: ValidationRequest): Promise<ValidationResult> {
    const options = request.options || {};
    const cacheKey = `${request.language}:${request.code.slice(0, 100)}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return this.filterByCategories(cached, options);
    }

    const issues: ValidationIssue[] = [];
    const categoryKeys = Object.keys(this.getCategoryRules()) as QualityCategory[];
    const categories = (options as any).categories || categoryKeys;

    // Run built-in rules
    for (const category of categories) {
      const categoryRules = this.getCategoryRules()[category as QualityCategory] || [];
      for (const rule of categoryRules) {
        if (this.shouldRunRule(rule, options)) {
          const ruleIssues = rule.check(request.code, request.language);
          issues.push(...ruleIssues);
        }
      }
    }

    // Run custom rules
    for (const customRule of this.customRules) {
      try {
        const result = customRule.check(request.code);
        if (!result.valid) {
          issues.push(...result.issues);
        }
      } catch {
        // Ignore custom rule errors
      }
    }

    // Calculate quality metrics
    const metrics = this.calculateMetrics(request.code, request.language);

    // Generate suggestions
    const suggestions = this.generateSuggestions(issues, metrics);

    // Apply auto-fix if requested
    let fixedCode: string | undefined;
    if (options.autoFix) {
      fixedCode = this.applyAutoFix(request.code, issues);
    }

    const result: ValidationResult = {
      valid: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      metrics,
      suggestions,
      fixedCode,
    };

    // Cache result
    this.cache.set(cacheKey, result);

    return this.filterByCategories(result, options);
  }

  /**
   * Register a validation rule
   */
  registerRule(rule: RuleDefinition): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Register custom validation rule
   */
  registerCustomRule(rule: ValidationRule): void {
    this.customRules.push(rule);
  }

  /**
   * Get all rules by category
   */
  getCategoryRules(): Partial<Record<QualityCategory, RuleDefinition[]>> {
    const byCategory: Partial<Record<QualityCategory, RuleDefinition[]>> = {};

    for (const rule of this.rules.values()) {
      if (!byCategory[rule.category]) {
        byCategory[rule.category] = [];
      }
      byCategory[rule.category]!.push(rule);
    }

    return byCategory;
  }

  /**
   * Register default validation rules
   */
  private registerDefaultRules(): void {
    // Type Safety Rules
    this.registerRule({
      id: 'ts-no-any',
      name: 'No Any Type',
      category: 'type-safety',
      severity: 'warning',
      description: 'Avoid using `any` type, use specific types instead',
      pattern: /:\s*any\b/g,
      check: (code, lang) => {
        if (lang !== 'typescript' && lang !== 'javascript') return [];
        const issues: ValidationIssue[] = [];
        const lines = code.split('\n');
        lines.forEach((line, i) => {
          const matches = line.match(/:\s*any\b/g);
          if (matches) {
            issues.push({
              id: 'ts-no-any',
              category: 'type-safety',
              severity: 'warning',
              message: 'Avoid using `any` type',
              description: 'Using `any` defeats the purpose of TypeScript. Use a more specific type or `unknown`.',
              line: i + 1,
              code: line.trim(),
            });
          }
        });
        return issues;
      },
    });

    // Naming Convention Rules
    this.registerRule({
      id: 'naming-variables',
      name: 'Variable Naming',
      category: 'naming',
      severity: 'warning',
      description: 'Variables should use camelCase',
      check: (code, lang) => {
        const issues: ValidationIssue[] = [];
        if (lang !== 'typescript' && lang !== 'javascript' && lang !== 'java') return [];

        const lines = code.split('\n');
        lines.forEach((line, i) => {
          const match = line.match(/(?:let|const|var)\s+([A-Z][a-zA-Z0-9]*)\s*=/);
          if (match && !match[1].startsWith(match[1].toUpperCase())) {
            issues.push({
              id: 'naming-variables',
              category: 'naming',
              severity: 'warning',
              message: 'Variable should use camelCase',
              description: 'Variables in JavaScript/TypeScript should use camelCase naming convention.',
              line: i + 1,
              code: line.trim(),
            });
          }
        });
        return issues;
      },
    });

    // Error Handling Rules
    this.registerRule({
      id: 'error-handling-async',
      name: 'Async Error Handling',
      category: 'error-handling',
      severity: 'warning',
      description: 'Async functions should handle errors',
      check: (code, lang) => {
        if (lang !== 'typescript' && lang !== 'javascript') return [];
        const issues: ValidationIssue[] = [];

        const lines = code.split('\n');
        lines.forEach((line, i) => {
          const asyncMatch = line.match(/async\s+function\s+(\w+)/);
          if (asyncMatch) {
            // Check if next 10 lines have try-catch
            const nextLines = lines.slice(i + 1, i + 11).join('\n');
            if (!nextLines.includes('try') && !nextLines.includes('catch')) {
              issues.push({
                id: 'error-handling-async',
                category: 'error-handling',
                severity: 'warning',
                message: 'Async function should have error handling',
                description: 'Async functions should use try-catch blocks or handle promises rejections.',
                line: i + 1,
                code: line.trim(),
              });
            }
          }
        });
        return issues;
      },
    });

    // Security Rules
    this.registerRule({
      id: 'security-eval',
      name: 'No Eval',
      category: 'security',
      severity: 'error',
      description: 'Avoid using eval() as it can execute arbitrary code',
      pattern: /eval\s*\(/g,
      check: (code, lang) => {
        if (lang !== 'typescript' && lang !== 'javascript') return [];
        const issues: ValidationIssue[] = [];

        const lines = code.split('\n');
        lines.forEach((line, i) => {
          if (/\beval\s*\(/.test(line)) {
            issues.push({
              id: 'security-eval',
              category: 'security',
              severity: 'error',
              message: 'Avoid using eval()',
              description: 'eval() can execute arbitrary code and is a major security risk.',
              line: i + 1,
              code: line.trim(),
            });
          }
        });
        return issues;
      },
    });

    this.registerRule({
      id: 'security-hardcoded-secrets',
      name: 'Hardcoded Secrets',
      category: 'security',
      severity: 'error',
      description: 'Detect hardcoded API keys, passwords, and tokens',
      pattern: /(api[_-]?key|password|secret|token)\s*[=:]\s*['"][^'"]{10,}['"]/gi,
      check: (code, lang) => {
        const issues: ValidationIssue[] = [];

        const lines = code.split('\n');
        lines.forEach((line, i) => {
          if (/(api[_-]?key|password|secret|token)\s*[=:]\s*['"][^'"]{10,}['"]/gi.test(line)) {
            issues.push({
              id: 'security-hardcoded-secrets',
              category: 'security',
              severity: 'error',
              message: 'Possible hardcoded secret detected',
              description: 'Hardcoded secrets should be stored in environment variables.',
              line: i + 1,
              code: line.trim().substring(0, 50) + '...',
            });
          }
        });
        return issues;
      },
    });

    // Performance Rules
    this.registerRule({
      id: 'performance-nested-loops',
      name: 'Nested Loops',
      category: 'performance',
      severity: 'warning',
      description: 'Nested loops can cause performance issues',
      check: (code, lang) => {
        const issues: ValidationIssue[] = [];

        const lines = code.split('\n');
        let nestedCount = 0;

        lines.forEach((line, i) => {
          const hasLoop = /\b(for|while)\b/.test(line);
          if (hasLoop) {
            nestedCount++;
            if (nestedCount > 2) {
              issues.push({
                id: 'performance-nested-loops',
                category: 'performance',
                severity: 'warning',
                message: 'Deeply nested loops detected',
                description: 'Consider refactoring to reduce nesting depth for better performance.',
                line: i + 1,
                code: line.trim(),
              });
            }
          } else if (line.trim().endsWith('}') && nestedCount > 0) {
            nestedCount--;
          }
        });
        return issues;
      },
    });

    this.registerRule({
      id: 'performance-console-log',
      name: 'Console Log in Production',
      category: 'performance',
      severity: 'info',
      description: 'Console.log statements should be removed in production',
      pattern: /console\.log\(/g,
      check: (code, lang) => {
        if (lang !== 'typescript' && lang !== 'javascript') return [];
        const issues: ValidationIssue[] = [];

        const lines = code.split('\n');
        lines.forEach((line, i) => {
          if (/\bconsole\.log\(/.test(line)) {
            issues.push({
              id: 'performance-console-log',
              category: 'performance',
              severity: 'info',
              message: 'Console.log statement found',
              description: 'Console logs should be removed or replaced with proper logging in production.',
              line: i + 1,
              code: line.trim(),
            });
          }
        });
        return issues;
      },
    });

    // Complexity Rules
    this.registerRule({
      id: 'complexity-long-function',
      name: 'Long Function',
      category: 'complexity',
      severity: 'warning',
      description: 'Functions should be under 50 lines',
      check: (code, lang) => {
        const issues: ValidationIssue[] = [];
        const functionPattern = lang === 'typescript' || lang === 'javascript'
          ? /(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|=>\s*{)/g
          : /def\s+\w+|fn\s+\w+/g;

        const lines = code.split('\n');
        let inFunction = false;
        let functionStart = 0;
        let braceCount = 0;

        lines.forEach((line, i) => {
          if (functionPattern.test(line)) {
            inFunction = true;
            functionStart = i;
            braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
          } else if (inFunction) {
            braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
            if (braceCount === 0) {
              const functionLength = i - functionStart + 1;
              if (functionLength > 50) {
                issues.push({
                  id: 'complexity-long-function',
                  category: 'complexity',
                  severity: 'warning',
                  message: `Function is ${functionLength} lines long (> 50)`,
                  description: 'Long functions are harder to understand and maintain. Consider breaking it into smaller functions.',
                  line: functionStart + 1,
                  endLine: i + 1,
                });
              }
              inFunction = false;
            }
          }
        });
        return issues;
      },
    });

    // Documentation Rules
    this.registerRule({
      id: 'documentation-missing-jsdoc',
      name: 'Missing JSDoc',
      category: 'documentation',
      severity: 'suggestion',
      description: 'Functions should have JSDoc comments',
      check: (code, lang) => {
        if (lang !== 'typescript' && lang !== 'javascript') return [];
        const issues: ValidationIssue[] = [];

        const lines = code.split('\n');
        lines.forEach((line, i) => {
          if (/(?:function|export.*function)\s+\w+/.test(line)) {
            const prevLine = i > 0 ? lines[i - 1].trim() : '';
            const prevPrevLine = i > 1 ? lines[i - 2].trim() : '';
            if (!prevLine.startsWith('/**') && !prevPrevLine.startsWith('/**')) {
              issues.push({
                id: 'documentation-missing-jsdoc',
                category: 'documentation',
                severity: 'suggestion',
                message: 'Function is missing JSDoc documentation',
                description: 'Add JSDoc comments to document function purpose, parameters, and return values.',
                line: i + 1,
                code: line.trim(),
              });
            }
          }
        });
        return issues;
      },
    });

    // Best Practices
    this.registerRule({
      id: 'best-practices-magic-numbers',
      name: 'Magic Numbers',
      category: 'best-practices',
      severity: 'suggestion',
      description: 'Magic numbers should be replaced with named constants',
      check: (code, lang) => {
        const issues: ValidationIssue[] = [];

        const lines = code.split('\n');
        lines.forEach((line, i) => {
          // Match numbers that aren't 0, 1, or -1
          const matches = line.match(/\b(?!0|1|-1\b)\d{2,}\b/g);
          if (matches && !line.includes('//')) {
            issues.push({
              id: 'best-practices-magic-numbers',
              category: 'best-practices',
              severity: 'suggestion',
              message: 'Magic number detected',
              description: 'Replace magic numbers with named constants for better readability.',
              line: i + 1,
              code: line.trim(),
            });
          }
        });
        return issues;
      },
    });

    this.registerRule({
      id: 'best-practices-unused-vars',
      name: 'Unused Variables',
      category: 'best-practices',
      severity: 'warning',
      description: 'Detect unused variable declarations',
      check: (code, lang) => {
        if (lang !== 'typescript' && lang !== 'javascript') return [];
        const issues: ValidationIssue[] = [];

        const lines = code.split('\n');
        const declaredVars: { name: string; line: number }[] = [];

        lines.forEach((line, i) => {
          const match = line.match(/(?:const|let|var)\s+(\w+)/);
          if (match) {
            declaredVars.push({ name: match[1], line: i + 1 });
          }
        });

        // Check if variables are used (simple check)
        const codeLower = code.toLowerCase();
        declaredVars.forEach(v => {
          const regex = new RegExp(`\\b${v.name}\\b`, 'g');
          const matches = codeLower.match(regex);
          if (matches && matches.length === 1) {
            issues.push({
              id: 'best-practices-unused-vars',
              category: 'best-practices',
              severity: 'warning',
              message: `Variable '${v.name}' is never used`,
              description: 'Remove unused variables to keep code clean.',
              line: v.line,
            });
          }
        });

        return issues;
      },
    });
  }

  /**
   * Determine if a rule should run based on options
   */
  private shouldRunRule(rule: RuleDefinition, options: ValidationOptions): boolean {
    if (options.severityThreshold) {
      const severityOrder = ['error', 'warning', 'info', 'suggestion'];
      if (severityOrder.indexOf(rule.severity) < severityOrder.indexOf(options.severityThreshold)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Filter issues by categories
   */
  private filterByCategories(
    result: ValidationResult,
    options: ValidationOptions
  ): ValidationResult {
    const categories = (options as any).categories;
    if (!categories || categories.length === 0) {
      return result;
    }

    return {
      ...result,
      issues: result.issues.filter(issue => categories.includes(issue.category)),
    };
  }

  /**
   * Calculate code quality metrics
   */
  private calculateMetrics(code: string, language: SupportedLanguage): QualityMetrics {
    const lines = code.split('\n');
    const linesOfCode = lines.filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('*')).length;

    // Calculate complexity (simplified cyclomatic complexity)
    let complexity = 1;
    const complexityPatterns = [
      /\bif\b/g,
      /\belse\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\?\s*:/g, // ternary
      /&&/g,
      /\|\|/g,
    ];

    for (const pattern of complexityPatterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    // Calculate comment ratio
    const commentLines = lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('*') || l.trim().startsWith('/*'));
    const commentRatio = lines.length > 0 ? commentLines.length / lines.length : 0;

    // Calculate maintainability index (simplified)
    const maintainabilityIndex = Math.max(0, Math.min(100,
      171 - 5.2 * Math.log(complexity) - 0.23 * complexity - 16.2 * Math.log(linesOfCode)
    ));

    // Calculate score (0-100)
    const score = Math.round(
      (maintainabilityIndex * 0.4) +
      ((1 - Math.min(1, complexity / 50)) * 30) +
      (commentRatio * 30)
    );

    return {
      complexity,
      maintainabilityIndex: Math.round(maintainabilityIndex),
      linesOfCode,
      commentRatio: Math.round(commentRatio * 100) / 100,
      duplicationRatio: 0, // Would need more sophisticated analysis
      score,
    };
  }

  /**
   * Generate improvement suggestions
   */
  private generateSuggestions(issues: ValidationIssue[], metrics: QualityMetrics): string[] {
    const suggestions: string[] = [];

    if (metrics.complexity > 20) {
      suggestions.push('Consider breaking down complex functions into smaller, more focused units.');
    }

    if (metrics.commentRatio < 0.1) {
      suggestions.push('Add more comments to improve code documentation.');
    }

    if (metrics.maintainabilityIndex < 50) {
      suggestions.push('Code has low maintainability. Consider refactoring.');
    }

    const errorCount = issues.filter(i => i.severity === 'error').length;
    if (errorCount > 0) {
      suggestions.push(`Fix ${errorCount} error(s) to improve code quality.`);
    }

    return suggestions;
  }

  /**
   * Apply automatic fixes
   */
  private applyAutoFix(code: string, issues: ValidationIssue[]): string {
    let fixed = code;

    // Fix console.log statements
    fixed = fixed.replace(/^\s*console\.log\(.*\);\s*$/gm, '// $&');

    // Fix hardcoded secrets (redact)
    fixed = fixed.replace(/(api[_-]?key|password|secret|token)\s*[=:]\s*['"][^'"]+['"]/gi, '$1 = "***REDACTED***"');

    // Fix magic numbers (wrap in constant)
    fixed = fixed.replace(/\b(\d{2,})\b/g, '/* MAGIC_NUMBER: $1 */ $1');

    return fixed;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Create a code validator instance
 */
export function createValidator(): CodeValidator {
  return new CodeValidator();
}

/**
 * Default validator instance
 */
let defaultValidator: CodeValidator | null = null;

export function setDefaultValidator(validator: CodeValidator): void {
  defaultValidator = validator;
}

export function getDefaultValidator(): CodeValidator {
  if (!defaultValidator) {
    defaultValidator = new CodeValidator();
  }
  return defaultValidator;
}

/**
 * Convenience function for quick validation
 */
export async function validateCode(request: ValidationRequest): Promise<ValidationResult> {
  return getDefaultValidator().validate(request);
}
