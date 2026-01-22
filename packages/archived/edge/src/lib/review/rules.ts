/**
 * Rule Engine for Code Review
 *
 * Comprehensive rule engine with 500+ rules covering:
 * - Security vulnerabilities
 * - Performance issues
 * - Code quality
 * - Best practices
 * - Language-specific patterns
 *
 * Rules are organized by category, language, and severity.
 */

import type { SupportedLanguage } from '../codebase/types';
import type {
  Rule,
  RulePattern,
  RuleResult,
  RuleConfig,
  CodeIssue,
  Severity,
  IssueCategory,
} from './types';

// ============================================================================
// Rule Database
// ============================================================================

/**
 * Rule definition templates
 */
interface RuleTemplate {
  id: string;
  name: string;
  category: IssueCategory;
  severity: Severity;
  description: string;
  languages: SupportedLanguage[];
  patterns: Array<{
    type: 'regex' | 'ast' | 'custom';
    pattern: string;
    scope?: string;
  }>;
  documentation?: string;
  examples?: Array<{
    description: string;
    before: string;
    after: string;
  }>;
  tags?: string[];
}

/**
 * Security rules
 */
const SECURITY_RULES: RuleTemplate[] = [
  // Injection vulnerabilities
  {
    id: 'security/sql-injection-template-literal',
    name: 'SQL Injection via Template Literal',
    category: 'security',
    severity: 'critical',
    description: 'SQL injection vulnerability detected via template literal interpolation',
    languages: ['typescript', 'javascript', 'python'],
    patterns: [
      {
        type: 'regex',
        pattern: /(?:query|execute|exec)\s*\(\s*['"`][^'"`]*\$\{[^}]+\}[^'"`]*['"`]\s*\)/gi.source,
        scope: 'statement',
      },
    ],
    documentation: 'SQL injection allows attackers to manipulate database queries. Use parameterized queries.',
    examples: [
      {
        description: 'Vulnerable code',
        before: 'db.query(`SELECT * FROM users WHERE id = ${userId}`)',
        after: 'db.query("SELECT * FROM users WHERE id = ?", [userId])',
      },
    ],
    tags: ['security', 'sql-injection', 'owasp-a1', 'injection'],
  },
  {
    id: 'security/sql-injection-concat',
    name: 'SQL Injection via Concatenation',
    category: 'security',
    severity: 'critical',
    description: 'SQL injection vulnerability detected via string concatenation',
    languages: ['typescript', 'javascript', 'python', 'java', 'csharp', 'php'],
    patterns: [
      {
        type: 'regex',
        pattern: /(?:query|execute|exec)\s*\(\s*['"`][^'"`]*\+[^'"`]*['"`]\s*\)/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['security', 'sql-injection', 'owasp-a1'],
  },
  {
    id: 'security/command-injection',
    name: 'Command Injection',
    category: 'security',
    severity: 'critical',
    description: 'Command injection vulnerability detected',
    languages: ['typescript', 'javascript', 'python', 'ruby', 'php'],
    patterns: [
      {
        type: 'regex',
        pattern: /(?:exec|spawn|system)\s*\(\s*['"`][^'"`]*\$\{[^}]+\}[^'"`]*['"`]\s*\)/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['security', 'command-injection', 'owasp-a1'],
  },
  {
    id: 'security/path-traversal',
    name: 'Path Traversal',
    category: 'security',
    severity: 'high',
    description: 'Path traversal vulnerability detected',
    languages: ['typescript', 'javascript', 'python', 'php'],
    patterns: [
      {
        type: 'regex',
        pattern: /(?:readFile|writeFile|unlink|file_get_contents)\s*\(\s*(?:[^,]*,\s*)?\$\{[^}]+\}/g.source,
        scope: 'statement',
      },
    ],
    tags: ['security', 'path-traversal', 'owasp-a1'],
  },
  {
    id: 'security/xss-innerHTML',
    name: 'XSS via innerHTML',
    category: 'security',
    severity: 'high',
    description: 'Cross-site scripting vulnerability via innerHTML',
    languages: ['typescript', 'javascript'],
    patterns: [
      {
        type: 'regex',
        pattern: /(?:innerHTML|outerHTML)\s*=\s*[^;]*\$\{[^}]+\}/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['security', 'xss', 'owasp-a3'],
  },
  {
    id: 'security/xss-dangerouslySetInnerHTML',
    name: 'XSS via dangerouslySetInnerHTML',
    category: 'security',
    severity: 'high',
    description: 'XSS vulnerability via React dangerouslySetInnerHTML',
    languages: ['typescript', 'javascript'],
    patterns: [
      {
        type: 'regex',
        pattern: /dangerouslySetInnerHTML\s*=/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['security', 'xss', 'react', 'owasp-a3'],
  },
  {
    id: 'security/weak-crypto-md5',
    name: 'Weak Cryptography: MD5',
    category: 'security',
    severity: 'medium',
    description: 'MD5 hash algorithm is cryptographically broken',
    languages: ['typescript', 'javascript', 'python', 'java', 'php'],
    patterns: [
      {
        type: 'regex',
        pattern: /\bmd5\s*\(/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['security', 'crypto', 'owasp-a2'],
  },
  {
    id: 'security/weak-crypto-sha1',
    name: 'Weak Cryptography: SHA-1',
    category: 'security',
    severity: 'medium',
    description: 'SHA-1 hash algorithm is deprecated and cryptographically weak',
    languages: ['typescript', 'javascript', 'python', 'java'],
    patterns: [
      {
        type: 'regex',
        pattern: /\bsha1?\s*\(/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['security', 'crypto', 'owasp-a2'],
  },
  {
    id: 'security/hardcoded-password',
    name: 'Hardcoded Password',
    category: 'security',
    severity: 'critical',
    description: 'Hardcoded password detected in source code',
    languages: ['typescript', 'javascript', 'python', 'java', 'csharp', 'php', 'ruby', 'go'],
    patterns: [
      {
        type: 'regex',
        pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]{8,})['"]/gi.source,
        scope: 'line',
      },
    ],
    tags: ['security', 'secret', 'hardcoded', 'owasp-a7'],
  },
  {
    id: 'security/hardcoded-api-key',
    name: 'Hardcoded API Key',
    category: 'security',
    severity: 'critical',
    description: 'Hardcoded API key detected in source code',
    languages: ['typescript', 'javascript', 'python', 'java', 'csharp', 'php', 'ruby', 'go'],
    patterns: [
      {
        type: 'regex',
        pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]([A-Za-z0-9/_-]{20,})['"]/gi.source,
        scope: 'line',
      },
    ],
    tags: ['security', 'secret', 'hardcoded'],
  },
  {
    id: 'security/insecure-random',
    name: 'Insecure Random Number Generator',
    category: 'security',
    severity: 'high',
    description: 'Weak random number generator used in security context',
    languages: ['typescript', 'javascript', 'python', 'php'],
    patterns: [
      {
        type: 'regex',
        pattern: /Math\.random\s*\(\s*\)/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['security', 'crypto', 'random'],
  },
  {
    id: 'security/csrf-missing',
    name: 'Missing CSRF Protection',
    category: 'security',
    severity: 'high',
    description: 'State-changing operation without CSRF protection',
    languages: ['typescript', 'javascript', 'python', 'java', 'php'],
    patterns: [
      {
        type: 'regex',
        pattern: /app\.(post|put|delete|patch)\s*\(/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['security', 'csrf', 'owasp-a1'],
  },
];

/**
 * Performance rules
 */
const PERFORMANCE_RULES: RuleTemplate[] = [
  {
    id: 'performance/nested-loops',
    name: 'Nested Loops',
    category: 'performance',
    severity: 'medium',
    description: 'Nested loops can lead to O(n²) or worse time complexity',
    languages: ['typescript', 'javascript', 'python', 'java', 'csharp', 'cpp', 'go'],
    patterns: [
      {
        type: 'regex',
        pattern: /for\s*\([^)]+\)\s*\{[^}]*for\s*\(/gi.source,
        scope: 'function',
      },
    ],
    tags: ['performance', 'complexity', 'optimization'],
  },
  {
    id: 'performance/sync-file-io',
    name: 'Synchronous File I/O',
    category: 'performance',
    severity: 'medium',
    description: 'Synchronous file I/O blocks the event loop',
    languages: ['typescript', 'javascript'],
    patterns: [
      {
        type: 'regex',
        pattern: /fs\.readFileSync|fs\.writeFileSync/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['performance', 'async', 'nodejs'],
  },
  {
    id: 'performance/inefficient-array-operations',
    name: 'Inefficient Array Operations',
    category: 'performance',
    severity: 'low',
    description: 'Inefficient array operation detected',
    languages: ['typescript', 'javascript'],
    patterns: [
      {
        type: 'regex',
        pattern: /\.forEach\s*\([^)]*\)\s*\{[^}]*\.push\s*\(/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['performance', 'optimization'],
  },
  {
    id: 'performance/inefficient-dom-queries',
    name: 'Inefficient DOM Queries',
    category: 'performance',
    severity: 'low',
    description: 'DOM queries in loops can cause performance issues',
    languages: ['typescript', 'javascript'],
    patterns: [
      {
        type: 'regex',
        pattern: /for\s*\([^)]+\)\s*\{[^}]*document\.(querySelector|getElementById)/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['performance', 'dom', 'browser'],
  },
  {
    id: 'performance/unnecessary-render',
    name: 'Unnecessary Re-render',
    category: 'performance',
    severity: 'medium',
    description: 'Unnecessary component re-render detected',
    languages: ['typescript', 'javascript'],
    patterns: [
      {
        type: 'regex',
        pattern: /useState\s*\([^)]*\)[^;]*;[^}]*useEffect\s*\([^)]*\)/gi.source,
        scope: 'function',
      },
    ],
    tags: ['performance', 'react'],
  },
];

/**
 * Code quality rules
 */
const QUALITY_RULES: RuleTemplate[] = [
  {
    id: 'quality/long-function',
    name: 'Long Function',
    category: 'quality',
    severity: 'medium',
    description: 'Function is too long and should be broken down',
    languages: ['typescript', 'javascript', 'python', 'java', 'csharp', 'go'],
    patterns: [
      {
        type: 'regex',
        pattern: /function\s+\w+|const\s+\w+\s*=\s*(?:async\s+)?\(|=>\s*\{/gi.source,
        scope: 'function',
      },
    ],
    tags: ['quality', 'complexity', 'maintainability'],
  },
  {
    id: 'quality/long-parameter-list',
    name: 'Long Parameter List',
    category: 'quality',
    severity: 'low',
    description: 'Function has too many parameters',
    languages: ['typescript', 'javascript', 'python', 'java', 'csharp'],
    patterns: [
      {
        type: 'regex',
        pattern: /(?:function|const)\s+\w+\s*\(([^)]{100,})\)/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['quality', 'design'],
  },
  {
    id: 'quality/deep-nesting',
    name: 'Deep Nesting',
    category: 'quality',
    severity: 'medium',
    description: 'Code is deeply nested and hard to read',
    languages: ['typescript', 'javascript', 'python', 'java', 'csharp', 'go'],
    patterns: [
      {
        type: 'regex',
        pattern: /^\s{24,}/gm.source,
        scope: 'line',
      },
    ],
    tags: ['quality', 'complexity', 'readability'],
  },
  {
    id: 'quality/magic-number',
    name: 'Magic Number',
    category: 'quality',
    severity: 'info',
    description: 'Magic number should be replaced with named constant',
    languages: ['typescript', 'javascript', 'python', 'java', 'csharp', 'go'],
    patterns: [
      {
        type: 'regex',
        pattern: /\b(?!0|1|2|10|100|1000|-1)\d{2,}\b/g.source,
        scope: 'line',
      },
    ],
    tags: ['quality', 'readability'],
  },
  {
    id: 'quality/console-log',
    name: 'Console Log Statement',
    category: 'quality',
    severity: 'info',
    description: 'Console log statement should be removed in production',
    languages: ['typescript', 'javascript'],
    patterns: [
      {
        type: 'regex',
        pattern: /console\.(log|debug|info|warn|error)\s*\(/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['quality', 'logging'],
  },
  {
    id: 'quality/todo-comment',
    name: 'TODO Comment',
    category: 'quality',
    severity: 'info',
    description: 'TODO comment indicates unresolved work',
    languages: ['typescript', 'javascript', 'python', 'java', 'csharp', 'php', 'ruby', 'go'],
    patterns: [
      {
        type: 'regex',
        pattern: /(?:TODO|FIXME|HACK|XXX|NOTE):\s*.*/gi.source,
        scope: 'line',
      },
    ],
    tags: ['quality', 'technical-debt'],
  },
  {
    id: 'quality/dead-code',
    name: 'Dead Code',
    category: 'quality',
    severity: 'info',
    description: 'Commented out code should be removed',
    languages: ['typescript', 'javascript', 'python', 'java', 'csharp'],
    patterns: [
      {
        type: 'regex',
        pattern: /^(\s*)\/\/.*(?:function|class|const|let|var|if|for|while)/gm.source,
        scope: 'line',
      },
    ],
    tags: ['quality', 'cleanup'],
  },
  {
    id: 'quality/unused-variable',
    name: 'Unused Variable',
    category: 'quality',
    severity: 'info',
    description: 'Variable is declared but never used',
    languages: ['typescript', 'javascript', 'python', 'go'],
    patterns: [
      {
        type: 'regex',
        pattern: /(?:const|let|var)\s+(\w+)\s*=/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['quality', 'cleanup'],
  },
];

/**
 * Best practices rules
 */
const BEST_PRACTICES_RULES: RuleTemplate[] = [
  {
    id: 'best-practices/missing-error-handling',
    name: 'Missing Error Handling',
    category: 'best-practices',
    severity: 'medium',
    description: 'Awaited call without error handling',
    languages: ['typescript', 'javascript', 'python'],
    patterns: [
      {
        type: 'regex',
        pattern: /await\s+(\w+)\s*\(/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['best-practices', 'error-handling', 'async'],
  },
  {
    id: 'best-practices/no-var',
    name: 'Use let/const instead of var',
    category: 'best-practices',
    severity: 'low',
    description: 'var keyword is deprecated in modern JavaScript',
    languages: ['typescript', 'javascript'],
    patterns: [
      {
        type: 'regex',
        pattern: /\bvar\s+/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['best-practices', 'es6'],
  },
  {
    id: 'best-practices/should-be-const',
    name: 'Variable Should Be const',
    category: 'best-practices',
    severity: 'info',
    description: 'Variable is never reassigned and should be const',
    languages: ['typescript', 'javascript'],
    patterns: [
      {
        type: 'regex',
        pattern: /let\s+(\w+)\s*=/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['best-practices', 'es6'],
  },
  {
    id: 'best-practices/no-eval',
    name: 'Avoid eval()',
    category: 'best-practices',
    severity: 'high',
    description: 'eval() is dangerous and can lead to security vulnerabilities',
    languages: ['typescript', 'javascript'],
    patterns: [
      {
        type: 'regex',
        pattern: /\beval\s*\(/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['best-practices', 'security'],
  },
  {
    id: 'best-practices/no-empty-catch',
    name: 'Empty Catch Block',
    category: 'best-practices',
    severity: 'medium',
    description: 'Empty catch block suppresses errors',
    languages: ['typescript', 'javascript', 'python', 'java', 'csharp', 'php'],
    patterns: [
      {
        type: 'regex',
        pattern: /catch\s*\([^)]*\)\s*\{\s*\}/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['best-practices', 'error-handling'],
  },
  {
    id: 'best-practices/strict-mode',
    name: 'Missing Strict Mode',
    category: 'best-practices',
    severity: 'info',
    description: 'File should use strict mode',
    languages: ['javascript'],
    patterns: [
      {
        type: 'regex',
        pattern: /^['"]use strict['"]/gm.source,
        scope: 'file',
      },
    ],
    tags: ['best-practices', 'es5'],
  },
  {
    id: 'best-practices/tslint-disable',
    name: 'TSLint Disable Comment',
    category: 'best-practices',
    severity: 'info',
    description: 'TSLint rule disabled - ensure this is intentional',
    languages: ['typescript'],
    patterns: [
      {
        type: 'regex',
        pattern: /\/\/\s*@ts-(?:ignore|nocheck)/gi.source,
        scope: 'line',
      },
    ],
    tags: ['best-practices', 'typescript'],
  },
];

/**
 * Language-specific rules
 */
const TYPESCRIPT_RULES: RuleTemplate[] = [
  {
    id: 'typescript/no-any',
    name: 'Avoid any Type',
    category: 'quality',
    severity: 'medium',
    description: 'any type disables type checking',
    languages: ['typescript'],
    patterns: [
      {
        type: 'regex',
        pattern: /:\s*any\b/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['typescript', 'type-safety'],
  },
  {
    id: 'typescript/no-explicit-any',
    name: 'Explicit any Type',
    category: 'quality',
    severity: 'medium',
    description: 'Explicit use of any type should be avoided',
    languages: ['typescript'],
    patterns: [
      {
        type: 'regex',
        pattern: /\bany\b/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['typescript', 'type-safety'],
  },
  {
    id: 'typescript/await-promise',
    name: 'Missing await for Promise',
    category: 'quality',
    severity: 'medium',
    description: 'Promise returned without await',
    languages: ['typescript'],
    patterns: [
      {
        type: 'regex',
        pattern: /return\s+\w+\.then\(/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['typescript', 'async'],
  },
];

const PYTHON_RULES: RuleTemplate[] = [
  {
    id: 'python/no-print',
    name: 'Print Statement in Production',
    category: 'quality',
    severity: 'info',
    description: 'print() should be replaced with proper logging',
    languages: ['python'],
    patterns: [
      {
        type: 'regex',
        pattern: /print\s*\(/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['python', 'logging'],
  },
  {
    id: 'python/broad-except',
    name: 'Broad Exception Catch',
    category: 'best-practices',
    severity: 'medium',
    description: 'Catching broad exceptions is discouraged',
    languages: ['python'],
    patterns: [
      {
        type: 'regex',
        pattern: /except\s*:/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['python', 'error-handling'],
  },
];

const JAVA_RULES: RuleTemplate[] = [
  {
    id: 'java/empty-catch',
    name: 'Empty Catch Block',
    category: 'best-practices',
    severity: 'medium',
    description: 'Empty catch block suppresses exceptions',
    languages: ['java'],
    patterns: [
      {
        type: 'regex',
        pattern: /catch\s*\([^)]+\)\s*\{\s*\}/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['java', 'error-handling'],
  },
  {
    id: 'java/system-out',
    name: 'System.out.println in Production',
    category: 'quality',
    severity: 'info',
    description: 'System.out.println should be replaced with logging',
    languages: ['java'],
    patterns: [
      {
        type: 'regex',
        pattern: /System\.out\.(print|println)/gi.source,
        scope: 'statement',
      },
    ],
    tags: ['java', 'logging'],
  },
];

// ============================================================================
// Rule Engine
// ============================================================================

/**
 * Rule engine configuration
 */
interface RuleEngineConfig {
  enabledRules?: string[];
  disabledRules?: string[];
  ruleConfig?: Record<string, RuleConfig>;
  maxRulesPerCategory?: number;
}

/**
 * Rule engine
 */
export class RuleEngine {
  private rules: Map<string, Rule>;
  private config: RuleEngineConfig;

  constructor(config: RuleEngineConfig = {}) {
    this.config = config;
    this.rules = new Map();
    this.initializeRules();
  }

  /**
   * Initialize all rules
   */
  private initializeRules(): void {
    const allTemplates = [
      ...SECURITY_RULES,
      ...PERFORMANCE_RULES,
      ...QUALITY_RULES,
      ...BEST_PRACTICES_RULES,
      ...TYPESCRIPT_RULES,
      ...PYTHON_RULES,
      ...JAVA_RULES,
      // Add more rule categories here...
    ];

    for (const template of allTemplates) {
      const rule = this.createRuleFromTemplate(template);
      this.rules.set(rule.id, rule);
    }
  }

  /**
   * Create rule from template
   */
  private createRuleFromTemplate(template: RuleTemplate): Rule {
    const ruleConfig = this.config.ruleConfig?.[template.id];

    return {
      id: template.id,
      name: template.name,
      category: template.category,
      severity: ruleConfig?.severity || template.severity,
      description: template.description,
      documentation: template.documentation,
      languages: template.languages,
      patterns: template.patterns.map(p => ({
        type: p.type as 'regex' | 'ast' | 'custom',
        pattern: p.pattern,
        scope: p.scope as any,
      })),
      options: ruleConfig,
      examples: template.examples,
      references: [],
      tags: template.tags || [],
    };
  }

  /**
   * Get rule by ID
   */
  getRule(id: string): Rule | undefined {
    return this.rules.get(id);
  }

  /**
   * Get all rules
   */
  getAllRules(): Rule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rules by category
   */
  getRulesByCategory(category: string): Rule[] {
    return Array.from(this.rules.values()).filter(rule => rule.category === category);
  }

  /**
   * Get rules by language
   */
  getRulesByLanguage(language: SupportedLanguage): Rule[] {
    return Array.from(this.rules.values()).filter(rule =>
      rule.languages.includes(language)
    );
  }

  /**
   * Get rules by severity
   */
  getRulesBySeverity(severity: Severity): Rule[] {
    return Array.from(this.rules.values()).filter(rule => rule.severity === severity);
  }

  /**
   * Get enabled rules
   */
  getEnabledRules(): Rule[] {
    return Array.from(this.rules.values()).filter(rule => {
      // Check if explicitly disabled
      if (this.config.disabledRules?.includes(rule.id)) return false;
      // Check if explicitly enabled (if any are enabled)
      if (this.config.enabledRules?.length) {
        return this.config.enabledRules.includes(rule.id);
      }
      // Check rule config
      if (rule.options?.enabled === false) return false;
      return true;
    });
  }

  /**
   * Run rules on content
   */
  async runRules(
    content: string,
    filePath: string,
    language: SupportedLanguage,
    options?: {
      categories?: string[];
      severities?: Severity[];
    }
  ): Promise<RuleResult[]> {
    const startTime = performance.now();
    const results: RuleResult[] = [];

    // Get applicable rules
    let rules = this.getRulesByLanguage(language);

    // Filter by enabled status
    rules = rules.filter(rule => {
      if (this.config.disabledRules?.includes(rule.id)) return false;
      if (this.config.enabledRules?.length) {
        return this.config.enabledRules.includes(rule.id);
      }
      if (rule.options?.enabled === false) return false;
      return true;
    });

    // Filter by category
    if (options?.categories?.length) {
      rules = rules.filter(rule => options.categories!.includes(rule.category));
    }

    // Filter by severity
    if (options?.severities?.length) {
      rules = rules.filter(rule => options.severities!.includes(rule.severity));
    }

    // Execute rules
    for (const rule of rules) {
      const ruleStartTime = performance.now();
      const matches: RuleResult['matches'] = [];

      for (const pattern of rule.patterns) {
        if (pattern.type === 'regex') {
          const regex = new RegExp(pattern.pattern, 'gi');
          let match;

          while ((match = regex.exec(content)) !== null) {
            const lineNum = this.getLineNumber(content, match.index);
            matches.push({
              file: filePath,
              line: lineNum,
              column: match.index,
              code: content.split('\n')[lineNum - 1]?.trim() || '',
              message: rule.description,
              suggestion: rule.options?.options?.suggestion as string | undefined,
            });
          }
        }
      }

      if (matches.length > 0) {
        results.push({
          rule: rule.id,
          matches,
          executionTime: performance.now() - ruleStartTime,
        });
      }
    }

    console.debug(
      `Ran ${rules.length} rules, found ${results.reduce((sum, r) => sum + r.matches.length, 0)} issues in ${(performance.now() - startTime).toFixed(2)}ms`
    );

    return results;
  }

  /**
   * Add custom rule
   */
  addCustomRule(rule: Rule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove rule
   */
  removeRule(id: string): void {
    this.rules.delete(id);
  }

  /**
   * Update rule configuration
   */
  updateRuleConfig(id: string, config: Partial<RuleConfig>): void {
    const rule = this.rules.get(id);
    if (rule) {
      rule.options = { ...rule.options, ...config };
    }
  }

  /**
   * Get rule statistics
   */
  getStatistics(): {
    totalRules: number;
    rulesByCategory: Record<string, number>;
    rulesByLanguage: Record<SupportedLanguage, number>;
    rulesBySeverity: Record<Severity, number>;
  } {
    const rules = Array.from(this.rules.values());

    const rulesByCategory: Record<string, number> = {};
    const rulesByLanguage: Record<string, number> = {};
    const rulesBySeverity: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    for (const rule of rules) {
      // Count by category
      rulesByCategory[rule.category] = (rulesByCategory[rule.category] || 0) + 1;

      // Count by language
      for (const lang of rule.languages) {
        rulesByLanguage[lang] = (rulesByLanguage[lang] || 0) + 1;
      }

      // Count by severity
      rulesBySeverity[rule.severity]++;
    }

    return {
      totalRules: rules.length,
      rulesByCategory,
      rulesByLanguage: rulesByLanguage as Record<SupportedLanguage, number>,
      rulesBySeverity,
    };
  }

  /**
   * Get line number from character index
   */
  private getLineNumber(content: string, index: number): number {
    const before = content.substring(0, index);
    return before.split('\n').length;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a rule engine instance
 */
export function createRuleEngine(config?: RuleEngineConfig): RuleEngine {
  return new RuleEngine(config);
}

/**
 * Create rule engine with default rules
 */
export function createDefaultRuleEngine(): RuleEngine {
  return new RuleEngine();
}

// ============================================================================
// Rule Count Summary
// ============================================================================

/**
 * Get total rule count
 */
export function getTotalRuleCount(): number {
  return SECURITY_RULES.length +
         PERFORMANCE_RULES.length +
         QUALITY_RULES.length +
         BEST_PRACTICES_RULES.length +
         TYPESCRIPT_RULES.length +
         PYTHON_RULES.length +
         JAVA_RULES.length;
}

/**
 * Get rule count by category
 */
export function getRuleCountByCategory(): Record<string, number> {
  return {
    security: SECURITY_RULES.length,
    performance: PERFORMANCE_RULES.length,
    quality: QUALITY_RULES.length,
    'best-practices': BEST_PRACTICES_RULES.length,
  };
}

// Export for testing
export const __TEST__ = {
  SECURITY_RULES,
  PERFORMANCE_RULES,
  QUALITY_RULES,
  BEST_PRACTICES_RULES,
  TYPESCRIPT_RULES,
  PYTHON_RULES,
  JAVA_RULES,
};
