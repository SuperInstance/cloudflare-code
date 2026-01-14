/**
 * Agent Validation and Testing System
 * Provides comprehensive validation, testing, and quality assurance for agents
 */

import {
  Agent,
  AgentConfig,
  TestCase,
  TestSuite,
  TestResult,
  TestReport,
  ValidationIssue,
  ValidationReport,
  TestType
} from '../types';

// ============================================================================
// Validation Configuration
// ============================================================================

export interface ValidationOptions {
  checkSyntax?: boolean;
  checkSemantics?: boolean;
  checkSecurity?: boolean;
  checkPerformance?: boolean;
  checkBestPractices?: boolean;
  strictMode?: boolean;
  customRules?: ValidationRule[];
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check: (agent: Agent) => Promise<boolean> | boolean;
  message?: string;
  suggestion?: string;
}

export interface SecurityCheck {
  name: string;
  description: string;
  check: (code: string, config: AgentConfig) => Promise<ValidationIssue[]>;
}

// ============================================================================
// Agent Validator
// ============================================================================

export class AgentValidator {
  private rules: ValidationRule[] = [];
  private securityChecks: SecurityCheck[] = [];

  constructor() {
    this.registerBuiltinRules();
    this.registerSecurityChecks();
  }

  // ========================================================================
  // Rule Registration
  // ========================================================================

  private registerBuiltinRules(): void {
    // Name validation
    this.addRule({
      id: 'VALID_NAME',
      name: 'Valid Agent Name',
      description: 'Agent name must be present and valid',
      severity: 'error',
      check: (agent) => {
        return (
          !!agent.config.name &&
          agent.config.name.length >= 3 &&
          agent.config.name.length <= 100
        );
      },
      message: 'Agent name must be between 3 and 100 characters',
      suggestion: 'Choose a descriptive name for your agent'
    });

    // Description validation
    this.addRule({
      id: 'VALID_DESCRIPTION',
      name: 'Valid Agent Description',
      description: 'Agent description must be present and meaningful',
      severity: 'error',
      check: (agent) => {
        return (
          !!agent.config.description &&
          agent.config.description.length >= 50 &&
          agent.config.description.length <= 500
        );
      },
      message: 'Agent description must be between 50 and 500 characters',
      suggestion: 'Provide a detailed description of what your agent does'
    });

    // Version validation
    this.addRule({
      id: 'VALID_VERSION',
      name: 'Valid Version Number',
      description: 'Version must follow semantic versioning',
      severity: 'error',
      check: (agent) => {
        return /^\d+\.\d+\.\d+$/.test(agent.metadata.version);
      },
      message: 'Version must follow semver format (x.y.z)',
      suggestion: 'Use semantic versioning (e.g., 1.0.0)'
    });

    // Capability validation
    this.addRule({
      id: 'HAS_CAPABILITIES',
      name: 'Has Capabilities',
      description: 'Agent must define at least one capability',
      severity: 'warning',
      check: (agent) => {
        return agent.config.capabilities && agent.config.capabilities.length > 0;
      },
      message: 'Agent has no capabilities defined',
      suggestion: 'Add relevant capabilities to your agent configuration'
    });

    // Prompt validation
    this.addRule({
      id: 'HAS_PROMPTS',
      name: 'Has Prompts',
      description: 'Agent should define prompts',
      severity: 'warning',
      check: (agent) => {
        return (
          agent.config.prompts &&
          Object.keys(agent.config.prompts).length > 0
        );
      },
      message: 'Agent has no prompts defined',
      suggestion: 'Define system and user prompts for your agent'
    });

    // System prompt validation
    this.addRule({
      id: 'VALID_SYSTEM_PROMPT',
      name: 'Valid System Prompt',
      description: 'System prompt should be meaningful',
      severity: 'warning',
      check: (agent) => {
        const defaultPrompt = agent.config.prompts?.default;
        return (
          defaultPrompt?.system &&
          defaultPrompt.system.length >= 20
        );
      },
      message: 'System prompt should be at least 20 characters',
      suggestion: 'Provide a clear and detailed system prompt'
    });

    // Timeout validation
    this.addRule({
      id: 'HAS_TIMEOUT',
      name: 'Has Timeout',
      description: 'Agent should have a timeout constraint',
      severity: 'warning',
      check: (agent) => {
        return !!agent.config.constraints?.timeout;
      },
      message: 'Agent should have a timeout constraint',
      suggestion: 'Set a timeout to prevent long-running operations'
    });

    // Tool validation
    this.addRule({
      id: 'VALID_TOOLS',
      name: 'Valid Tool Definitions',
      description: 'All tools must have valid definitions',
      severity: 'error',
      check: (agent) => {
        return agent.config.tools.every(tool =>
          tool.id &&
          tool.name &&
          tool.description &&
          tool.handler
        );
      },
      message: 'All tools must have id, name, description, and handler',
      suggestion: 'Ensure all tools are properly defined'
    });

    // Permission validation
    this.addRule({
      id: 'PERMISSION_MATCH',
      name: 'Permissions Match Tools',
      description: 'Tool permissions should be declared in agent permissions',
      severity: 'warning',
      check: (agent) => {
        const agentPerms = new Set(agent.config.permissions);
        for (const tool of agent.config.tools) {
          for (const perm of tool.permissions) {
            if (!agentPerms.has(perm)) {
              return false;
            }
          }
        }
        return true;
      },
      message: 'Tool permissions should be declared in agent permissions',
      suggestion: 'Add all required permissions to agent configuration'
    });
  }

  private registerSecurityChecks(): void {
    this.addSecurityCheck({
      name: 'No Exposed Secrets',
      description: 'Check for exposed secrets in code',
      check: async (code, config) => {
        const issues: ValidationIssue[] = [];
        const secretPatterns = [
          { pattern: /api[_-]?key\s*[:=]\s*['"]\w+['"]/i, name: 'API Key' },
          { pattern: /secret\s*[:=]\s*['"]\w+['"]/i, name: 'Secret' },
          { pattern: /password\s*[:=]\s*['"]\w+['"]/i, name: 'Password' },
          { pattern: /token\s*[:=]\s*['"]\w+['"]/i, name: 'Token' },
          { pattern: /bearer\s+\w+/i, name: 'Bearer Token' }
        ];

        for (const { pattern, name } of secretPatterns) {
          const matches = code.match(pattern);
          if (matches) {
            issues.push({
              severity: 'error',
              code: 'EXPOSED_SECRET',
              message: `Potential ${name} found in code`,
              suggestion: 'Use environment variables for sensitive data'
            });
          }
        }

        return issues;
      }
    });

    this.addSecurityCheck({
      name: 'No Dangerous Eval',
      description: 'Check for dangerous eval usage',
      check: async (code, config) => {
        const issues: ValidationIssue[] = [];
        if (/\beval\s*\(/.test(code)) {
          issues.push({
            severity: 'error',
            code: 'DANGEROUS_EVAL',
            message: 'Dangerous eval() usage detected',
            suggestion: 'Avoid using eval() - use safer alternatives'
          });
        }
        return issues;
      }
    });

    this.addSecurityCheck({
      name: 'Input Validation',
      description: 'Check for proper input validation',
      check: async (code, config) => {
        const issues: ValidationIssue[] = [];
        if (!code.includes('validate') && !code.includes('sanitize')) {
          issues.push({
            severity: 'warning',
            code: 'NO_INPUT_VALIDATION',
            message: 'No input validation detected',
            suggestion: 'Add input validation to prevent injection attacks'
          });
        }
        return issues;
      }
    });

    this.addSecurityCheck({
      name: 'Permission Safety',
      description: 'Check if permissions are appropriate for functionality',
      check: async (code, config) => {
        const issues: ValidationIssue[] = [];
        const hasNetworkOps = /fetch|http|request/i.test(code);
        const hasNetworkPerm = config.permissions.includes('network');

        if (hasNetworkOps && !hasNetworkPerm) {
          issues.push({
            severity: 'warning',
            code: 'MISSING_NETWORK_PERMISSION',
            message: 'Code uses network operations but lacks network permission',
            suggestion: 'Add network permission to agent configuration'
          });
        }

        const hasFileOps = /fs\.|readFile|writeFile/i.test(code);
        const hasFilePerm = config.permissions.includes('file_system');

        if (hasFileOps && !hasFilePerm) {
          issues.push({
            severity: 'warning',
            code: 'MISSING_FILE_PERMISSION',
            message: 'Code uses file operations but lacks file_system permission',
            suggestion: 'Add file_system permission to agent configuration'
          });
        }

        return issues;
      }
    });
  }

  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  addSecurityCheck(check: SecurityCheck): void {
    this.securityChecks.push(check);
  }

  // ========================================================================
  // Validation
  // ========================================================================

  async validate(agent: Agent, options: ValidationOptions = {}): Promise<ValidationReport> {
    const issues: ValidationIssue[] = [];

    // Apply validation rules
    for (const rule of this.rules) {
      try {
        const passed = await rule.check(agent);
        if (!passed) {
          issues.push({
            severity: rule.severity,
            code: rule.id,
            message: rule.message || `Rule ${rule.name} failed`,
            suggestion: rule.suggestion
          });
        }
      } catch (error) {
        issues.push({
          severity: 'error',
          code: 'VALIDATION_ERROR',
          message: `Error checking rule ${rule.id}: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }

    // Security checks
    if (options.checkSecurity !== false) {
      for (const check of this.securityChecks) {
        try {
          const securityIssues = await check.check(agent.code, agent.config);
          issues.push(...securityIssues);
        } catch (error) {
          issues.push({
            severity: 'error',
            code: 'SECURITY_CHECK_ERROR',
            message: `Error running security check ${check.name}: ${error instanceof Error ? error.message : String(error)}`
          });
        }
      }
    }

    // Syntax check
    if (options.checkSyntax !== false) {
      const syntaxIssues = await this.checkSyntax(agent);
      issues.push(...syntaxIssues);
    }

    // Performance check
    if (options.checkPerformance !== false) {
      const performanceIssues = await this.checkPerformance(agent);
      issues.push(...performanceIssues);
    }

    // Best practices check
    if (options.checkBestPractices !== false) {
      const practiceIssues = await this.checkBestPractices(agent);
      issues.push(...practiceIssues);
    }

    // Calculate metrics
    const metrics = this.calculateMetrics(agent, issues);

    return {
      valid: !issues.some(i => i.severity === 'error'),
      issues,
      metrics,
      checks: {
        syntax: options.checkSyntax !== false,
        semantics: true,
        security: options.checkSecurity !== false,
        performance: options.checkPerformance !== false,
        bestPractices: options.checkBestPractices !== false
      }
    };
  }

  private async checkSyntax(agent: Agent): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Basic syntax checks
    if (!agent.code || agent.code.trim().length === 0) {
      issues.push({
        severity: 'error',
        code: 'EMPTY_CODE',
        message: 'Agent code is empty'
      });
    }

    // Check for balanced braces
    const openBraces = (agent.code.match(/{/g) || []).length;
    const closeBraces = (agent.code.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push({
        severity: 'error',
        code: 'UNBALANCED_BRACES',
        message: `Unbalanced braces: ${openBraces} open, ${closeBraces} close`
      });
    }

    // Check for balanced parentheses
    const openParens = (agent.code.match(/\(/g) || []).length;
    const closeParens = (agent.code.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      issues.push({
        severity: 'error',
        code: 'UNBALANCED_PARENS',
        message: `Unbalanced parentheses: ${openParens} open, ${closeParens} close`
      });
    }

    return issues;
  }

  private async checkPerformance(agent: Agent): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Check for potential performance issues
    if (/\.map\(.*\.map\(/.test(agent.code)) {
      issues.push({
        severity: 'warning',
        code: 'NESTED_MAP',
        message: 'Nested map operations may impact performance',
        suggestion: 'Consider using flatMap or reducing iterations'
      });
    }

    if (/for\s*\(\s*\w+\s+in\s+/.test(agent.code)) {
      issues.push({
        severity: 'info',
        code: 'FOR_IN_LOOP',
        message: 'for...in loop detected',
        suggestion: 'Consider using for...of or Object methods for better performance'
      });
    }

    // Check for large loops
    const loopMatches = agent.code.match(/for\s*\([^)]+\)\s*{/g);
    if (loopMatches && loopMatches.length > 5) {
      issues.push({
        severity: 'info',
        code: 'MANY_LOOPS',
        message: 'Multiple loops detected - consider optimization',
        suggestion: 'Review loop complexity and consider optimizations'
      });
    }

    return issues;
  }

  private async checkBestPractices(agent: Agent): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // Error handling
    if (!agent.code.includes('try') && !agent.code.includes('catch')) {
      issues.push({
        severity: 'warning',
        code: 'NO_ERROR_HANDLING',
        message: 'No error handling detected',
        suggestion: 'Add try-catch blocks for error handling'
      });
    }

    // Documentation
    if (!agent.code.includes('/**') && !agent.code.includes('/*')) {
      issues.push({
        severity: 'info',
        code: 'NO_DOCUMENTATION',
        message: 'No documentation comments found',
        suggestion: 'Add JSDoc comments for better documentation'
      });
    }

    // Type safety
    if (!agent.code.includes(': ')) {
      issues.push({
        severity: 'info',
        code: 'NO_TYPE_ANNOTATIONS',
        message: 'No type annotations found',
        suggestion: 'Add TypeScript type annotations for better type safety'
      });
    }

    // Async/await
    if (agent.code.includes('Promise') && !agent.code.includes('await')) {
      issues.push({
        severity: 'info',
        code: 'PROMISE_WITHOUT_AWAIT',
        message: 'Promise usage without await detected',
        suggestion: 'Use async/await for better readability'
      });
    }

    return issues;
  }

  private calculateMetrics(agent: Agent, issues: ValidationIssue[]): {
    complexity: number;
    maintainability: number;
    security: number;
    performance: number;
  } {
    // Calculate code complexity
    const complexity = this.calculateComplexity(agent.code);

    // Calculate maintainability
    const maintainability = this.calculateMaintainability(agent, issues);

    // Calculate security score
    const securityIssues = issues.filter(i => i.code.startsWith('EXPOSED_') || i.code.startsWith('DANGEROUS_'));
    const security = Math.max(0, 100 - securityIssues.length * 25);

    // Calculate performance score
    const perfIssues = issues.filter(i => i.code.startsWith('NESTED_') || i.code.startsWith('MANY_'));
    const performance = Math.max(0, 100 - perfIssues.length * 10);

    return {
      complexity,
      maintainability,
      security,
      performance
    };
  }

  private calculateComplexity(code: string): number {
    // Cyclomatic complexity approximation
    let complexity = 1;

    const patterns = [
      /if\s*\(/g,
      /else\s+if\s*\(/g,
      /for\s*\(/g,
      /while\s*\(/g,
      /case\s+/g,
      /catch\s*\(/g,
      /\?\s*[^:]+\s*:/g,
      /&&/g,
      /\|\|/g
    ];

    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  private calculateMaintainability(agent: Agent, issues: ValidationIssue[]): number {
    let score = 100;

    // Deduct for issues
    for (const issue of issues) {
      if (issue.severity === 'error') score -= 10;
      else if (issue.severity === 'warning') score -= 5;
      else score -= 2;
    }

    // Bonus for documentation
    if (agent.code.includes('/**')) score += 5;

    // Bonus for tests
    if (agent.code.includes('test') || agent.code.includes('spec')) score += 5;

    return Math.max(0, Math.min(100, score));
  }
}

// ============================================================================
// Agent Tester
// ============================================================================

export class AgentTester {
  private suites: Map<string, TestSuite> = new Map();

  registerSuite(suite: TestSuite): void {
    this.suites.set(suite.id, suite);
  }

  async runTest(
    agent: Agent,
    testCase: TestCase
  ): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Setup
      if (testCase.setup) {
        await this.executeCode(testCase.setup);
      }

      // Execute test
      const output = await this.executeAgent(agent, testCase.input);

      // Validate output
      const passed = this.validateOutput(output, testCase);

      // Teardown
      if (testCase.teardown) {
        await this.executeCode(testCase.teardown);
      }

      return {
        testCaseId: testCase.id,
        passed,
        duration: Date.now() - startTime,
        output,
        error: passed ? undefined : 'Output validation failed'
      };

    } catch (error) {
      return {
        testCaseId: testCase.id,
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      };
    }
  }

  async runSuite(agent: Agent, suite: TestSuite): Promise<TestReport> {
    const results: TestResult[] = [];

    // Setup
    if (suite.setup) {
      await this.executeCode(suite.setup);
    }

    // Run tests
    for (const test of suite.tests) {
      if (suite.parallel) {
        // Run in parallel
        const result = await this.runTest(agent, test);
        results.push(result);
      } else {
        // Run sequentially
        const result = await this.runTest(agent, test);
        results.push(result);
      }
    }

    // Teardown
    if (suite.teardown) {
      await this.executeCode(suite.teardown);
    }

    // Calculate summary
    const summary = {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      skipped: 0,
      duration: results.reduce((sum, r) => sum + r.duration, 0)
    };

    return {
      suiteId: suite.id,
      suiteName: suite.name,
      results,
      summary
    };
  }

  async runAllTests(agent: Agent): Promise<TestReport[]> {
    const reports: TestReport[] = [];

    for (const suite of this.suites.values()) {
      const report = await this.runSuite(agent, suite);
      reports.push(report);
    }

    return reports;
  }

  private async executeAgent(agent: Agent, input: any): Promise<any> {
    // In a real implementation, this would execute the agent
    // For now, we'll return a mock response
    return {
      success: true,
      data: input,
      timestamp: new Date().toISOString()
    };
  }

  private async executeCode(code: string): Promise<void> {
    // Execute setup/teardown code
    // In a real implementation, this would use a sandbox
  }

  private validateOutput(output: any, testCase: TestCase): boolean {
    if (!testCase.expectedOutput) {
      return true;
    }

    // Run assertions
    for (const assertion of testCase.assertions) {
      const actualValue = this.getProperty(output, assertion.property);
      const passed = this.compare(actualValue, assertion.operator, assertion.value);
      if (!passed) {
        return false;
      }
    }

    return true;
  }

  private getProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private compare(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case '==':
        return actual == expected;
      case '===':
        return actual === expected;
      case '!=':
        return actual != expected;
      case '!==':
        return actual !== expected;
      case '>':
        return actual > expected;
      case '>=':
        return actual >= expected;
      case '<':
        return actual < expected;
      case '<=':
        return actual <= expected;
      case 'includes':
        return Array.isArray(actual) && actual.includes(expected);
      case 'contains':
        return typeof actual === 'string' && actual.includes(expected);
      default:
        return false;
    }
  }
}

// ============================================================================
// Benchmark Runner
// ============================================================================

export class BenchmarkRunner {
  async runBenchmark(agent: Agent, iterations: number = 100): Promise<{
    averageTime: number;
    minTime: number;
    maxTime: number;
    throughput: number;
  }> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await this.executeAgent(agent, { test: true });
      const duration = Date.now() - start;
      times.push(duration);
    }

    const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const throughput = 1000 / averageTime; // executions per second

    return {
      averageTime,
      minTime,
      maxTime,
      throughput
    };
  }

  private async executeAgent(agent: Agent, input: any): Promise<any> {
    // Mock execution
    return { success: true };
  }
}

// ============================================================================
// Quality Metrics
// ============================================================================

export class QualityMetrics {
  static calculate(agent: Agent, report: ValidationReport): {
    overall: number;
    breakdown: {
      correctness: number;
      security: number;
      performance: number;
      maintainability: number;
      documentation: number;
    };
  } {
    const correctness = report.issues.filter(i => i.severity === 'error').length === 0 ? 100 : 50;
    const security = report.metrics.security;
    const performance = report.metrics.performance;
    const maintainability = report.metrics.maintainability;
    const documentation = agent.code.includes('/**') ? 80 : 40;

    const overall = (correctness + security + performance + maintainability + documentation) / 5;

    return {
      overall,
      breakdown: {
        correctness,
        security,
        performance,
        maintainability,
        documentation
      }
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export default AgentValidator;
