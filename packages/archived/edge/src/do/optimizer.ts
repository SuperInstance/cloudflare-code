/**
 * Optimizer Agent Durable Object
 *
 * Optimizes code for performance:
 * - Performance analysis
 * - Code optimization
 * - Resource usage optimization
 * - Caching strategies
 * - Bottleneck detection
 */

import type { AgentCapability } from '../lib/agents/types';

export interface OptimizerEnv {
  OPTIMIZER_DO: DurableObjectNamespace;
  AGENT_REGISTRY: DurableObjectNamespace;
  AGENTS_KV?: KVNamespace;
}

/**
 * Optimizer agent state
 */
interface OptimizerState {
  optimizationsPerformed: number;
  performanceImproved: number;
  bottlenecksFound: number;
  load: number;
}

/**
 * Optimizer Agent - Performance optimization
 *
 * Features:
 * - Performance analysis
 * - Code optimization suggestions
 * - Resource usage optimization
 * - Caching strategy recommendations
 * - Bottleneck detection
 */
export class OptimizerAgent implements DurableObject {
  private state: DurableObjectState;
  private env: OptimizerEnv;
  private storage: DurableObjectStorage;
  private optimizerState: OptimizerState;

  constructor(state: DurableObjectState, env: OptimizerEnv) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;

    this.optimizerState = {
      optimizationsPerformed: 0,
      performanceImproved: 0,
      bottlenecksFound: 0,
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
      if (method === 'POST' && path === '/optimize') {
        return this.handleOptimize(request);
      }

      if (method === 'POST' && path === '/analyze-performance') {
        return this.handleAnalyzePerformance(request);
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
   * Handle optimize request
   */
  private async handleOptimize(request: Request): Promise<Response> {
    this.optimizerState.load = Math.min(1, this.optimizerState.load + 0.1);

    try {
      const body = await request.json() as {
        code: string;
        context?: string;
      };

      const optimization = await this.performOptimization(body);

      this.optimizerState.optimizationsPerformed++;
      this.optimizerState.performanceImproved += optimization.suggestions.length;

      await this.persistState();

      return new Response(
        JSON.stringify({
          optimization,
          optimizerId: this.state.id.toString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      this.optimizerState.load = Math.max(0, this.optimizerState.load - 0.1);
      await this.persistState();
    }
  }

  /**
   * Handle analyze performance
   */
  private async handleAnalyzePerformance(request: Request): Promise<Response> {
    this.optimizerState.load = Math.min(1, this.optimizerState.load + 0.1);

    try {
      const body = await request.json() as {
        code: string;
        metrics?: Record<string, number>;
      };

      const analysis = await this.analyzePerformance(body);

      this.optimizerState.bottlenecksFound += analysis.bottlenecks.length;

      await this.persistState();

      return new Response(
        JSON.stringify({
          analysis,
          optimizerId: this.state.id.toString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } finally {
      this.optimizerState.load = Math.max(0, this.optimizerState.load - 0.1);
      await this.persistState();
    }
  }

  /**
   * Handle get state
   */
  private async handleGetState(): Promise<Response> {
    return new Response(
      JSON.stringify(this.optimizerState),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get capabilities
   */
  private async handleGetCapabilities(): Promise<Response> {
    const capabilities: AgentCapability[] = [
      {
        name: 'optimizer',
        version: '1.0.0',
        description: 'Optimizes code for performance',
        expertise: ['performance', 'optimization'],
        features: [
          'performance-analysis',
          'code-optimization',
          'bottleneck-detection',
          'caching-strategies',
          'resource-optimization',
        ],
      },
    ];

    return new Response(
      JSON.stringify({ capabilities }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Perform optimization analysis
   */
  private async performOptimization(request: {
    code: string;
    context?: string;
  }): Promise<{
    currentScore: number;
    potentialScore: number;
    suggestions: Array<{
      type: string;
      severity: 'high' | 'medium' | 'low';
      description: string;
      example?: {
        before: string;
        after: string;
      };
      impact: string;
    }>;
  }> {
    const { code } = request;

    let currentScore = 100;
    const suggestions: typeof optimizationResult.suggestions = [];

    // Check for performance issues

    // 1. Array operations in loops
    const arrayInLoops = code.match(/for\s*\(.*\)\s*{[\s\S]*?\.push\(/g);
    if (arrayInLoops && arrayInLoops.length > 0) {
      currentScore -= 10;
      suggestions.push({
        type: 'array-resizing',
        severity: 'high',
        description: 'Array resizing in loops detected',
        example: {
          before: 'for (let i = 0; i < items.length; i++) {\n  result.push(process(items[i]));\n}',
          after: 'const result = items.map(process);',
        },
        impact: 'Avoids array reallocation, improves performance by 2-10x',
      });
    }

    // 2. String concatenation in loops
    const stringConcatInLoops = code.match(/for\s*\(.*\)\s*{[\s\S]*?\+\s*['"]/g);
    if (stringConcatInLoops && stringConcatInLoops.length > 0) {
      currentScore -= 8;
      suggestions.push({
        type: 'string-concatenation',
        severity: 'medium',
        description: 'String concatenation in loops',
        example: {
          before: 'let result = "";\nfor (const item of items) {\n  result += item;\n}',
          after: 'const result = items.join("");',
        },
        impact: 'Reduces memory allocations, 5-20x faster',
      });
    }

    // 3. Synchronous operations in async functions
    const syncInAsync = code.match(/async\s+[\w(]*\s*{[\s\S]*?JSON\.(parse|stringify)/g);
    if (syncInAsync && syncInAsync.length > 0) {
      currentScore -= 12;
      suggestions.push({
        type: 'blocking-operations',
        severity: 'high',
        description: 'Blocking operations in async function',
        example: {
          before: 'async function processData(data) {\n  const parsed = JSON.parse(data); // blocks\n}',
          after: 'async function processData(data) {\n  const parsed = await JSON.parseAsync(data);\n}',
        },
        impact: 'Prevents event loop blocking, improves responsiveness',
      });
    }

    // 4. Missing memoization
    const repeatedCalculations = code.matchAll(/function\s+(\w+)\([^)]*\)\s*{[\s\S]{0,200}}/g);
    for (const match of repeatedCalculations) {
      const funcBody = code.substring(code.indexOf(match[0]), code.indexOf(match[0]) + 500);

      if (funcBody.includes('return') && !funcBody.includes('cache')) {
        currentScore -= 5;
        suggestions.push({
          type: 'memoization',
          severity: 'medium',
          description: `Function '${match[1]}' could benefit from memoization`,
          example: {
            before: `function ${match[1]}(x) {\n  return expensiveCalculation(x);\n}`,
            after: `const cache = new Map();\nfunction ${match[1]}(x) {\n  if (cache.has(x)) return cache.get(x);\n  const result = expensiveCalculation(x);\n  cache.set(x, result);\n  return result;\n}`,
          },
          impact: 'Caches results, avoids redundant calculations',
        });
        break;
      }
    }

    // 5. Inefficient DOM queries
    const domQueries = code.match(/document\.(getElementById|querySelector)/g);
    if (domQueries && domQueries.length > 3) {
      currentScore -= 7;
      suggestions.push({
        type: 'dom-queries',
        severity: 'medium',
        description: 'Multiple DOM queries detected',
        example: {
          before: 'function updateElements() {\n  document.getElementById("a").style.display = "block";\n  document.getElementById("b").style.display = "block";\n}',
          after: 'function updateElements() {\n  const elements = document.querySelectorAll("#a, #b");\n  elements.forEach(el => el.style.display = "block");\n}',
        },
        impact: 'Reduces DOM traversal, improves rendering performance',
      });
    }

    // 6. Large object allocations
    const largeObjects = code.match(/\{\s*(\w+\s*:\s*[^,}]+,\s*){10,}/g);
    if (largeObjects && largeObjects.length > 0) {
      currentScore -= 5;
      suggestions.push({
        type: 'object-allocation',
        severity: 'low',
        description: 'Large object allocation detected',
        impact: 'Consider object pooling or lazy initialization',
      });
    }

    const potentialScore = currentScore + suggestions.reduce((sum, s) => {
      switch (s.severity) {
        case 'high':
          return sum + 12;
        case 'medium':
          return sum + 8;
        case 'low':
          return sum + 5;
      }
    }, 0);

    return {
      currentScore: Math.max(0, currentScore),
      potentialScore: Math.min(100, potentialScore),
      suggestions,
    };
  }

  /**
   * Analyze performance
   */
  private async analyzePerformance(request: {
    code: string;
    metrics?: Record<string, number>;
  }): Promise<{
    overallScore: number;
    bottlenecks: Array<{
      location: string;
      type: string;
      severity: 'high' | 'medium' | 'low';
      description: string;
      fix?: string;
    }>;
    recommendations: string[];
    metrics: {
      complexity: number;
      memoryUsage: 'low' | 'medium' | 'high';
      ioOperations: number;
      asyncOperations: number;
    };
  }> {
    const { code, metrics = {} } = request;

    let overallScore = 100;
    const bottlenecks: typeof analysisResult.bottlenecks = [];
    const recommendations: string[] = [];

    // Analyze complexity
    const complexity = this.calculateComplexity(code);
    if (complexity > 20) {
      overallScore -= 15;
      bottlenecks.push({
        location: 'unknown',
        type: 'high-complexity',
        severity: 'high',
        description: `High cyclomatic complexity: ${complexity}`,
        fix: 'Consider breaking into smaller functions',
      });
      recommendations.push('Reduce function complexity for better maintainability and performance');
    }

    // Analyze memory usage
    const memoryUsage = this.estimateMemoryUsage(code);
    if (memoryUsage === 'high') {
      overallScore -= 10;
      bottlenecks.push({
        location: 'unknown',
        type: 'memory-usage',
        severity: 'medium',
        description: 'High memory usage detected',
        fix: 'Consider memory optimization techniques',
      });
      recommendations.push('Implement lazy loading or pagination for large datasets');
    }

    // Count I/O operations
    const ioOperations = (code.match(/fetch\(|fs\.|readFile|writeFile/g) || []).length;
    if (ioOperations > 5) {
      overallScore -= 10;
      bottlenecks.push({
        location: 'unknown',
        type: 'io-operations',
        severity: 'high',
        description: `${ioOperations} I/O operations detected`,
        fix: 'Batch or parallelize I/O operations',
      });
      recommendations.push('Use Promise.all() for parallel I/O operations');
    }

    // Count async operations
    const asyncOperations = (code.match(/await\s+/g) || []).length;
    if (asyncOperations > 10) {
      overallScore -= 5;
      bottlenecks.push({
        location: 'unknown',
        type: 'async-operations',
        severity: 'medium',
        description: `${asyncOperations} await statements detected`,
        fix: 'Consider Promise.all() for parallel execution',
      });
      recommendations.push('Parallelize independent async operations');
    }

    // Check for missing error handling
    const asyncFunctions = code.match(/async\s+\w+/g);
    if (asyncFunctions) {
      for (const func of asyncFunctions) {
        const funcStart = code.indexOf(func);
        const funcEnd = code.indexOf('}', funcStart + 100);
        const funcBody = code.substring(funcStart, funcEnd);

        if (!funcBody.includes('try') && !funcBody.includes('catch')) {
          bottlenecks.push({
            location: func,
            type: 'error-handling',
            severity: 'high',
            description: 'Missing error handling in async function',
            fix: 'Add try/catch for error handling',
          });
          break;
        }
      }
    }

    return {
      overallScore: Math.max(0, overallScore),
      bottlenecks,
      recommendations,
      metrics: {
        complexity,
        memoryUsage,
        ioOperations,
        asyncOperations,
      },
    };
  }

  /**
   * Calculate complexity
   */
  private calculateComplexity(code: string): number {
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

    let complexity = 1;

    for (const pattern of patterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(code: string): 'low' | 'medium' | 'high' {
    // Check for large arrays
    if (code.match(/new Array\(\d{3,}\)|\[.*,.*\].*map/g)) {
      return 'high';
    }

    // Check for object creation in loops
    if (code.match(/for\s*\(.*\)\s*{[\s\S]*?new\s+\w+/g)) {
      return 'high';
    }

    // Check for multiple large objects
    const largeObjects = code.match(/\{\s*(\w+\s*:\s*[^,}]+,\s*){10,}/g);
    if (largeObjects && largeObjects.length > 3) {
      return 'high';
    }

    // Check for caching/storage
    if (code.match(/(Map|Set|Array)\.prototype/)) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Initialize from storage
   */
  private async initializeFromStorage(): Promise<void> {
    try {
      const stored = await this.storage.get<OptimizerState>('optimizerState');

      if (stored) {
        this.optimizerState = stored;
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
      await this.storage.put('optimizerState', this.optimizerState);
    } catch (error) {
      console.error('Failed to persist state:', error);
    }
  }

  /**
   * Alarm handler
   */
  async alarm(): Promise<void> {
    this.optimizerState.load = Math.max(0, this.optimizerState.load * 0.9);
    await this.persistState();
  }
}
