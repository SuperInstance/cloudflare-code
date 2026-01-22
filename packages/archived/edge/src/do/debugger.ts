/**
 * Debugger Agent Durable Object
 *
 * Debugs issues and provides fix suggestions:
 * - Error analysis
 * - Bug detection
 * - Stack trace analysis
 * - Fix suggestions
 * - Testing strategies
 */

import type { AgentCapability } from '../lib/agents/types';

export interface DebuggerEnv {
  DEBUGGER_DO: DurableObjectNamespace;
  AGENT_REGISTRY: DurableObjectNamespace;
  AGENTS_KV?: KVNamespace;
}

/**
 * Debugger agent state
 */
interface DebuggerState {
  bugsAnalyzed: number;
  fixesSuggested: number;
  successRate: number;
  load: number;
}

/**
 * Debugger Agent - Bug detection and fixing
 *
 * Features:
 * - Error analysis
 * - Bug detection
 * - Stack trace interpretation
 * - Fix suggestions
 * - Test recommendations
 */
export class DebuggerAgent implements DurableObject {
  private state: DurableObjectState;
  private _env: DebuggerEnv;
  private storage: DurableObjectStorage;
  private debuggerState: DebuggerState;

  constructor(state: DurableObjectState, env: DebuggerEnv) {
    this.state = state;
    this._env = env;
    this.storage = state.storage;

    this.debuggerState = {
      bugsAnalyzed: 0,
      fixesSuggested: 0,
      successRate: 0,
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
      if (method === 'POST' && path === '/debug') {
        return this.handleDebug(request);
      }

      if (method === 'POST' && path === '/analyze-error') {
        return this.handleAnalyzeError(request);
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
   * Handle debug request
   */
  private async handleDebug(request: Request): Promise<Response> {
    this.debuggerState.load = Math.min(1, this.debuggerState.load + 0.1);

    try {
      const body = await request.json() as {
        code: string;
        error?: string;
        stackTrace?: string;
      };

      const debugResult = await this.performDebug(body);

      this.debuggerState.bugsAnalyzed++;
      this.debuggerState.fixesSuggested += debugResult.fixes.length;

      // Update success rate
      const successRate = debugResult.fixes.length > 0 ? 1 : 0;
      this.debuggerState.successRate =
        (this.debuggerState.successRate * (this.debuggerState.bugsAnalyzed - 1) + successRate) /
        this.debuggerState.bugsAnalyzed;

      await this.persistState();

      return new Response(
        JSON.stringify({
          debugResult,
          debuggerId: this.state.id.toString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      this.debuggerState.load = Math.max(0, this.debuggerState.load - 0.1);
      await this.persistState();
    }
  }

  /**
   * Handle analyze error
   */
  private async handleAnalyzeError(request: Request): Promise<Response> {
    this.debuggerState.load = Math.min(1, this.debuggerState.load + 0.1);

    try {
      const body = await request.json() as {
        error: string;
        stackTrace?: string;
        context?: string;
      };

      const analysis = await this.analyzeError(body);

      return new Response(
        JSON.stringify({
          analysis,
          debuggerId: this.state.id.toString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      this.debuggerState.load = Math.max(0, this.debuggerState.load - 0.1);
      await this.persistState();
    }
  }

  /**
   * Handle get state
   */
  private async handleGetState(): Promise<Response> {
    return new Response(
      JSON.stringify(this.debuggerState),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get capabilities
   */
  private async handleGetCapabilities(): Promise<Response> {
    const capabilities: AgentCapability[] = [
      {
        name: 'debugger',
        version: '1.0.0',
        description: 'Debugs issues and provides fix suggestions',
        expertise: ['debugging', 'error-analysis', 'testing'],
        features: [
          'error-analysis',
          'bug-detection',
          'stack-trace-analysis',
          'fix-suggestions',
          'test-recommendations',
        ],
      },
    ];

    return new Response(
      JSON.stringify({ capabilities }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Perform debugging analysis
   */
  private async performDebug(request: {
    code: string;
    error?: string;
    stackTrace?: string;
  }): Promise<{
    bugs: Array<{
      type: string;
      severity: 'error' | 'warning' | 'info';
      location: string;
      message: string;
      suggestion?: string;
    }>;
    fixes: Array<{
      type: string;
      description: string;
      code?: string;
    }>;
    tests: string[];
  }> {
    const { code, error, stackTrace } = request;

    const bugs: Array<{
      type: string;
      severity: 'error' | 'warning' | 'info';
      location: string;
      message: string;
      suggestion: string;
    }> = [];
    const fixes: Array<{
      type: string;
      description: string;
      code?: string;
    }> = [];
    const tests: string[] = [];

    // Analyze for common bugs
    bugs.push(...this.detectCommonBugs(code));

    // Analyze error if provided
    if (error) {
      const errorAnalysis = this.analyzeErrorMessage(error, stackTrace);
      bugs.push(...errorAnalysis.bugs);
      fixes.push(...errorAnalysis.fixes);
    }

    // Suggest tests
    tests.push(...this.suggestTests(code, bugs));

    return { bugs, fixes, tests };
  }

  /**
   * Detect common bugs
   */
  private detectCommonBugs(code: string): Array<{
    type: string;
    severity: 'error' | 'warning' | 'info';
    location: string;
    message: string;
    suggestion: string;
  }> {
    const bugs: Array<{
      type: string;
      severity: 'error' | 'warning' | 'info';
      location: string;
      message: string;
      suggestion: string;
    }> = [];

    // Check for null/undefined access
    const nullAccess = code.matchAll(/(\w+)\??\.\w+/g);
    for (const match of nullAccess) {
      if (!code.includes(`if (${match[1]} != null`) && !code.includes(`if (${match[1]} !== null`)) {
        bugs.push({
          type: 'potential-null-access',
          severity: 'warning',
          location: 'unknown',
          message: `Potential null/undefined access on ${match[1]}`,
          suggestion: 'Add null check before accessing property',
        });
      }
    }

    // Check for async/await issues
    const asyncFunctions = code.match(/async\s+\w+\s*\([^)]*\)\s*{/g);
    if (asyncFunctions) {
      for (const func of asyncFunctions) {
        const funcStart = code.indexOf(func);
        const funcBody = code.substring(funcStart, funcStart + 500);

        if (funcBody.includes('.then(') || funcBody.includes('.catch(')) {
          bugs.push({
            type: 'mixed-async-patterns',
            severity: 'warning',
            location: 'unknown',
            message: 'Mixing async/await with Promises in same function',
            suggestion: 'Use either async/await or Promises consistently',
          });
        }
      }
    }

    // Check for missing return
    const functions = code.matchAll(/function\s+\w+\s*\([^)]*\)\s*{|=>\s*{/g);
    for (const match of functions) {
      const funcStart = code.indexOf(match[0]);
      const funcEnd = code.indexOf('}', funcStart + 1);
      const funcBody = code.substring(funcStart, funcEnd);

      if (funcBody.includes('if') && !funcBody.includes('return')) {
        bugs.push({
          type: 'missing-return',
          severity: 'warning',
          location: 'unknown',
          message: 'Function may be missing return statement',
          suggestion: 'Ensure all code paths return a value',
        });
      }
    }

    // Check for memory leaks
    if (code.includes('addEventListener') && !code.includes('removeEventListener')) {
      bugs.push({
        type: 'potential-memory-leak',
        severity: 'warning',
        location: 'unknown',
        message: 'addEventListener without corresponding removeEventListener',
        suggestion: 'Clean up event listeners when done',
      });
    }

    return bugs;
  }

  /**
   * Analyze error message
   */
  private analyzeErrorMessage(error: string, stackTrace?: string): {
    bugs: Array<{
      type: string;
      severity: 'error' | 'warning' | 'info';
      location: string;
      message: string;
      suggestion: string;
    }>;
    fixes: Array<{
      type: string;
      description: string;
      code?: string;
    }>;
  } {
    const bugs: Array<{
      type: string;
      severity: 'error' | 'warning' | 'info';
      location: string;
      message: string;
      suggestion: string;
    }> = [];
    const fixes: Array<{
      type: string;
      description: string;
      code?: string;
    }> = [];

    // Analyze error type
    if (error.includes('TypeError')) {
      bugs.push({
        type: 'type-error',
        severity: 'error',
        location: stackTrace ? this.parseLocationFromStack(stackTrace) : 'unknown',
        message: error,
        suggestion: 'Check variable types and ensure proper type conversions',
      });

      fixes.push({
        type: 'type-check',
        description: 'Add type validation',
        code: `if (typeof variable !== 'expected') { throw new TypeError('...'); }`,
      });
    }

    if (error.includes('ReferenceError')) {
      bugs.push({
        type: 'reference-error',
        severity: 'error',
        location: stackTrace ? this.parseLocationFromStack(stackTrace) : 'unknown',
        message: error,
        suggestion: 'Check variable declarations and scope',
      });

      fixes.push({
        type: 'variable-declaration',
        description: 'Ensure variable is declared before use',
        code: 'const variable = value;',
      });
    }

    if (error.includes('NetworkError') || error.includes('fetch failed')) {
      bugs.push({
        type: 'network-error',
        severity: 'error',
        location: stackTrace ? this.parseLocationFromStack(stackTrace) : 'unknown',
        message: error,
        suggestion: 'Add error handling for network requests',
      });

      fixes.push({
        type: 'error-handling',
        description: 'Add try/catch for network operations',
        code: `try { const response = await fetch(url); } catch (error) { /* handle error */ }`,
      });
    }

    return { bugs, fixes };
  }

  /**
   * Parse location from stack trace
   */
  private parseLocationFromStack(stackTrace: string): string {
    const lines = stackTrace.split('\n');
    if (lines.length > 0) {
      const firstLine = lines[0];
      if (firstLine) {
        const match = firstLine.match(/at\s+.*?\s+\(([^)]+)\)/);
        if (match && match[1]) {
          return match[1];
        }
      }
    }
    return 'unknown';
  }

  /**
   * Suggest tests
   */
  private suggestTests(code: string, bugs: Array<{
    type: string;
    severity: 'error' | 'warning' | 'info';
    location: string;
    message: string;
    suggestion: string;
  }>): string[] {
    const tests: string[] = [];

    // Suggest tests based on bugs found
    for (const bug of bugs) {
      switch (bug.type) {
        case 'potential-null-access':
          tests.push(`Test null/undefined handling for ${bug.location}`);
          break;

        case 'mixed-async-patterns':
          tests.push('Test async error handling');
          break;

        case 'missing-return':
          tests.push('Test function return values');
          break;

        case 'type-error':
          tests.push('Add type validation tests');
          break;

        case 'network-error':
          tests.push('Test network failure scenarios');
          break;
      }
    }

    // Suggest general tests
    if (code.includes('if')) {
      tests.push('Add branch coverage tests');
    }

    if (code.includes('async') || code.includes('await')) {
      tests.push('Add async operation tests');
    }

    if (code.includes('try') || code.includes('catch')) {
      tests.push('Add error case tests');
    }

    return [...new Set(tests)]; // Remove duplicates
  }

  /**
   * Analyze error
   */
  private async analyzeError(request: {
    error: string;
    stackTrace?: string;
    context?: string;
  }): Promise<{
    errorType: string;
    severity: 'error' | 'warning' | 'info';
    description: string;
    possibleCauses: string[];
    suggestedFixes: string[];
    relatedDocs?: string[];
  }> {
    const { error, stackTrace: _stackTrace, context: _context } = request;

    let errorType = 'unknown';
    let severity: 'error' | 'warning' | 'info' = 'error';
    const possibleCauses: string[] = [];
    const suggestedFixes: string[] = [];

    // Categorize error
    if (error.includes('TypeError')) {
      errorType = 'TypeError';
      possibleCauses.push('Trying to access property on null/undefined');
      possibleCauses.push('Incorrect type assumption');
      suggestedFixes.push('Add null checks before property access');
      suggestedFixes.push('Use TypeScript for type safety');
    } else if (error.includes('ReferenceError')) {
      errorType = 'ReferenceError';
      possibleCauses.push('Variable not declared');
      possibleCauses.push('Variable out of scope');
      suggestedFixes.push('Declare variable before use');
      suggestedFixes.push('Check variable scope');
    } else if (error.includes('NetworkError') || error.includes('fetch failed')) {
      errorType = 'NetworkError';
      possibleCauses.push('Network connectivity issue');
      possibleCauses.push('Invalid URL or endpoint');
      possibleCauses.push('Server not responding');
      suggestedFixes.push('Add retry logic');
      suggestedFixes.push('Implement timeout handling');
      suggestedFixes.push('Add network error logging');
    } else if (error.includes('SyntaxError')) {
      errorType = 'SyntaxError';
      severity = 'error';
      possibleCauses.push('Invalid syntax');
      possibleCauses.push('Missing bracket or parenthesis');
      suggestedFixes.push('Review code syntax');
      suggestedFixes.push('Use linter to catch syntax errors');
    }

    return {
      errorType,
      severity,
      description: error,
      possibleCauses,
      suggestedFixes,
    };
  }

  /**
   * Initialize from storage
   */
  private async initializeFromStorage(): Promise<void> {
    try {
      const stored = await this.storage.get<DebuggerState>('debuggerState');

      if (stored) {
        this.debuggerState = stored;
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
      await this.storage.put('debuggerState', this.debuggerState);
    } catch (error) {
      console.error('Failed to persist state:', error);
    }
  }

  /**
   * Alarm handler
   */
  async alarm(): Promise<void> {
    this.debuggerState.load = Math.max(0, this.debuggerState.load * 0.9);
    await this.persistState();
  }
}
