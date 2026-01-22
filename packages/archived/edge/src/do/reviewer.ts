/**
 * Reviewer Agent Durable Object
 *
 * Reviews code quality and provides feedback:
 * - Code quality analysis
 * - Best practices checking
 * - Security review
 * - Performance optimization suggestions
 * - Style guide compliance
 */

import type { AgentMessage, AgentCapability } from '../lib/agents/types';

export interface ReviewerEnv {
  REVIEWER_DO: DurableObjectNamespace;
  AGENT_REGISTRY: DurableObjectNamespace;
  AGENTS_KV?: KVNamespace;
}

/**
 * Reviewer agent state
 */
interface ReviewerState {
  reviewsCompleted: number;
  issuesFound: number;
  suggestionsProvided: number;
  averageQualityScore: number;
  load: number;
}

/**
 * Reviewer Agent - Code quality and best practices review
 *
 * Features:
 * - Code quality scoring
 * - Best practices validation
 * - Security vulnerability detection
 * - Performance optimization hints
 * - Style guide compliance checking
 */
export class ReviewerAgent implements DurableObject {
  private state: DurableObjectState;
  private env: ReviewerEnv;
  private storage: DurableObjectStorage;
  private reviewerState: ReviewerState;

  constructor(state: DurableObjectState, env: ReviewerEnv) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;

    this.reviewerState = {
      reviewsCompleted: 0,
      issuesFound: 0,
      suggestionsProvided: 0,
      averageQualityScore: 0,
      load: 0,
    };

    this.initializeFromStorage();
  }

  /**
   * Fetch handler
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (method === 'POST' && path === '/review') {
        return this.handleReview(request);
      }

      if (method === 'GET' && path === '/state') {
        return this.handleGetState();
      }

      if (method === 'GET' && path === '/capabilities') {
        return this.handleGetCapabilities();
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Handle review request
   */
  private async handleReview(request: Request): Promise<Response> {
    const startTime = performance.now();

    this.reviewerState.load = Math.min(1, this.reviewerState.load + 0.1);

    try {
      const body = await request.json() as {
        code: string;
        language?: string;
        checks?: string[];
      };

      const review = await this.performReview(body);

      this.reviewerState.reviewsCompleted++;
      this.reviewerState.issuesFound += review.issues.length;
      this.reviewerState.suggestionsProvided += review.suggestions.length;

      // Update average quality score
      const totalScore = this.reviewerState.averageQualityScore * (this.reviewerState.reviewsCompleted - 1) + review.qualityScore;
      this.reviewerState.averageQualityScore = totalScore / this.reviewerState.reviewsCompleted;

      await this.persistState();

      const latency = performance.now() - startTime;

      return new Response(
        JSON.stringify({
          review,
          latency,
          reviewerId: this.state.id.toString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      this.reviewerState.load = Math.max(0, this.reviewerState.load - 0.1);
      await this.persistState();
    }
  }

  /**
   * Handle get state
   */
  private async handleGetState(): Promise<Response> {
    return new Response(
      JSON.stringify(this.reviewerState),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get capabilities
   */
  private async handleGetCapabilities(): Promise<Response> {
    const capabilities: AgentCapability[] = [
      {
        name: 'code-reviewer',
        version: '1.0.0',
        description: 'Reviews code quality and best practices',
        expertise: ['quality', 'security', 'performance', 'style'],
        features: [
          'quality-scoring',
          'best-practices',
          'security-check',
          'performance-hints',
          'style-compliance',
          'code-smell-detection',
        ],
      },
    ];

    return new Response(
      JSON.stringify({ capabilities }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Perform code review
   */
  private async performReview(request: {
    code: string;
    language?: string;
    checks?: string[];
  }): Promise<{
    qualityScore: number; // 0-100
    issues: Array<{
      severity: 'error' | 'warning' | 'info';
      category: string;
      message: string;
      line?: number;
    }>;
    suggestions: Array<{
      type: string;
      message: string;
      code?: string;
    }>;
    metrics: {
      complexity: number;
      maintainabilityIndex: number;
      linesOfCode: number;
    };
  }> {
    const { code, language = 'typescript', checks = ['all'] } = request;

    const issues: typeof reviewResult.issues = [];
    const suggestions: typeof reviewResult.suggestions = [];

    // Calculate basic metrics
    const lines = code.split('\n');
    const linesOfCode = lines.filter((line) => line.trim().length > 0).length;
    const complexity = this.calculateComplexity(code);
    const maintainabilityIndex = this.calculateMaintainabilityIndex(code, complexity);

    // Run checks
    if (checks.includes('all') || checks.includes('best-practices')) {
      const bpIssues = await this.checkBestPractices(code, language);
      issues.push(...bpIssues);
    }

    if (checks.includes('all') || checks.includes('security')) {
      const securityIssues = await this.checkSecurity(code, language);
      issues.push(...securityIssues);
    }

    if (checks.includes('all') || checks.includes('performance')) {
      const perfSuggestions = await this.checkPerformance(code, language);
      suggestions.push(...perfSuggestions);
    }

    if (checks.includes('all') || checks.includes('style')) {
      const styleIssues = await this.checkStyle(code, language);
      issues.push(...styleIssues);
    }

    // Calculate quality score
    const qualityScore = this.calculateQualityScore(
      issues,
      linesOfCode,
      complexity,
      maintainabilityIndex
    );

    const reviewResult = {
      qualityScore,
      issues,
      suggestions,
      metrics: {
        complexity,
        maintainabilityIndex,
        linesOfCode,
      },
    };

    return reviewResult;
  }

  /**
   * Calculate code complexity
   */
  private calculateComplexity(code: string): number {
    // Count cyclomatic complexity indicators
    const patterns = [
      /\bif\b/g,
      /\belse\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\b&&\b/g,
      /\|\|/g,
      /\?/g,
    ];

    let complexity = 1; // Base complexity

    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * Calculate maintainability index
   */
  private calculateMaintainabilityIndex(code: string, complexity: number): number {
    // Simplified maintainability index calculation
    const linesOfCode = code.split('\n').filter((line) => line.trim().length > 0).length;
    const volume = Math.log(linesOfCode);

    // MI = max(0, (171 - 5.2 * ln(HV) - 0.23 * CC - 16.2 * ln(L100)))
    const mi = Math.max(0, 171 - 5.2 * volume - 0.23 * complexity - 16.2 * Math.log(linesOfCode / 100));

    return Math.min(100, mi);
  }

  /**
   * Check best practices
   */
  private async checkBestPractices(code: string, language: string): Promise<typeof reviewResult.issues> {
    const issues: typeof reviewResult.issues = [];

    // Check for console.log statements
    const consoleLogs = code.match(/console\.log/g);
    if (consoleLogs && consoleLogs.length > 0) {
      issues.push({
        severity: 'warning',
        category: 'best-practices',
        message: 'Found console.log statements. Remove or replace with proper logging.',
      });
    }

    // Check for any types
    const anyTypes = code.match(/:\s*any\b/g);
    if (anyTypes && anyTypes.length > 0) {
      issues.push({
        severity: 'warning',
        category: 'best-practices',
        message: 'Avoid using "any" type. Use specific types instead.',
      });
    }

    // Check for TODO comments
    const todos = code.match(/\/\/\s*TODO|\/\*\s*TODO/gi);
    if (todos && todos.length > 0) {
      issues.push({
        severity: 'info',
        category: 'best-practices',
        message: `Found ${todos.length} TODO comments. Consider addressing them.`,
      });
    }

    return issues;
  }

  /**
   * Check security issues
   */
  private async checkSecurity(code: string, language: string): Promise<typeof reviewResult.issues> {
    const issues: typeof reviewResult.issues = [];

    // Check for hardcoded secrets
    const secretPatterns = [
      /password\s*[:=]\s*['"][^'"]+['"]/gi,
      /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
      /secret\s*[:=]\s*['"][^'"]+['"]/gi,
      /token\s*[:=]\s*['"][^'"]+['"]/gi,
    ];

    for (const pattern of secretPatterns) {
      const matches = code.match(pattern);
      if (matches) {
        issues.push({
          severity: 'error',
          category: 'security',
          message: 'Possible hardcoded secret detected. Use environment variables.',
        });
        break;
      }
    }

    // Check for eval usage
    if (/\.?eval\s*\(/.test(code)) {
      issues.push({
        severity: 'error',
        category: 'security',
        message: 'Avoid using eval(). It can lead to code injection vulnerabilities.',
      });
    }

    // Check for innerHTML usage
    if (/\.innerHTML\s*=/.test(code)) {
      issues.push({
        severity: 'warning',
        category: 'security',
        message: 'Using innerHTML can lead to XSS vulnerabilities. Consider using textContent or DOM APIs.',
      });
    }

    return issues;
  }

  /**
   * Check performance issues
   */
  private async checkPerformance(code: string, language: string): Promise<typeof reviewResult.suggestions> {
    const suggestions: typeof reviewResult.suggestions = [];

    // Check for loops with string concatenation
    if (/\b(for|while)\s*\(.*\)\s*{[^}]*\+\s*=/s.test(code)) {
      suggestions.push({
        type: 'performance',
        message: 'String concatenation in loops can be slow. Use array join or template literals.',
      });
    }

    // Check for missing async/await
    const asyncFunctions = code.match(/async\s+\w+\s*\([^)]*\)\s*{/g);
    if (asyncFunctions) {
      for (const func of asyncFunctions) {
        if (!/await/.test(code.substring(code.indexOf(func), code.indexOf(func) + 500))) {
          suggestions.push({
            type: 'performance',
            message: 'Async function without await. Consider removing async or using await.',
          });
          break;
        }
      }
    }

    // Check for large objects
    const largeObjects = code.match(/\{\s*(\w+\s*:\s*[^,}]+,\s*){20,}/g);
    if (largeObjects) {
      suggestions.push({
        type: 'performance',
        message: 'Large object detected. Consider breaking it into smaller pieces.',
      });
    }

    return suggestions;
  }

  /**
   * Check style compliance
   */
  private async checkStyle(code: string, language: string): Promise<typeof reviewResult.issues> {
    const issues: typeof reviewResult.issues = [];

    // Check line length
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > 120) {
        issues.push({
          severity: 'warning',
          category: 'style',
          message: `Line ${i + 1} exceeds 120 characters.`,
          line: i + 1,
        });
      }
    }

    // Check for trailing whitespace
    const trailingWhitespace = code.match(/[ \t]+$/gm);
    if (trailingWhitespace && trailingWhitespace.length > 0) {
      issues.push({
        severity: 'info',
        category: 'style',
        message: `Found ${trailingWhitespace.length} lines with trailing whitespace.`,
      });
    }

    // Check for multiple empty lines
    const multipleEmptyLines = code.match(/\n{3,}/g);
    if (multipleEmptyLines && multipleEmptyLines.length > 0) {
      issues.push({
        severity: 'info',
        category: 'style',
        message: 'Found multiple consecutive empty lines. Use at most 2.',
      });
    }

    return issues;
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(
    issues: typeof reviewResult.issues,
    linesOfCode: number,
    complexity: number,
    maintainabilityIndex: number
  ): number {
    let score = 100;

    // Deduct for issues
    for (const issue of issues) {
      switch (issue.severity) {
        case 'error':
          score -= 10;
          break;
        case 'warning':
          score -= 5;
          break;
        case 'info':
          score -= 1;
          break;
      }
    }

    // Deduct for high complexity
    if (complexity > 20) {
      score -= 10;
    } else if (complexity > 10) {
      score -= 5;
    }

    // Boost for good maintainability
    if (maintainabilityIndex > 80) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Initialize from storage
   */
  private async initializeFromStorage(): Promise<void> {
    try {
      const stored = await this.storage.get<ReviewerState>('reviewerState');

      if (stored) {
        this.reviewerState = stored;
      }
    } catch (error) {
      console.error('Failed to load state:', error);
    }
  }

  /**
   * Persist state
   */
  private async persistState(): Promise<void> {
    try {
      await this.storage.put('reviewerState', this.reviewerState);
    } catch (error) {
      console.error('Failed to persist state:', error);
    }
  }

  /**
   * Alarm handler
   */
  async alarm(): Promise<void> {
    // Decay load over time
    this.reviewerState.load = Math.max(0, this.reviewerState.load * 0.9);
    await this.persistState();
  }
}
