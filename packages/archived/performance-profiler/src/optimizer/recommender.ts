/**
 * Optimizer Recommender - AI-powered optimization suggestions
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  OptimizationRecommendation,
  OptimizationType,
  CodeLocation,
  OptimizationQueue,
  CPUProfileData,
  MemorySnapshot,
  PerformanceMetrics,
  TraceSpan,
} from '../types';

export interface OptimizerOptions {
  /**
   * Enable AI-powered recommendations
   */
  enableAI?: boolean;

  /**
   * Minimum impact threshold for recommendations
   */
  minImpact?: number;

  /**
   * Maximum number of recommendations to generate
   */
  maxRecommendations?: number;

  /**
   * Enable code analysis
   */
  enableCodeAnalysis?: boolean;

  /**
   * Pattern database for common optimizations
   */
  patternDatabase?: OptimizationPattern[];
}

export interface OptimizationPattern {
  type: OptimizationType;
  pattern: RegExp | string;
  suggestion: string;
  codeExample: string;
  estimatedImpact: number;
  effort: 'easy' | 'medium' | 'hard';
}

export interface OptimizationAnalysis {
  cpuProfile?: CPUProfileData;
  memorySnapshots?: MemorySnapshot[];
  performanceMetrics?: PerformanceMetrics[];
  traces?: TraceSpan[];
  code?: string;
}

/**
 * Optimizer Recommender implementation
 */
export class OptimizerRecommender extends EventEmitter {
  private recommendations: OptimizationRecommendation[] = new Array();
  private queue: OptimizationQueue = {
    items: [],
    totalImpact: 0,
    totalEffort: 0,
  };
  private patterns: OptimizationPattern[];
  private options: Required<OptimizerOptions>;

  constructor(options: OptimizerOptions = {}) {
    super();
    this.options = {
      enableAI: options.enableAI ?? true,
      minImpact: options.minImpact ?? 5,
      maxRecommendations: options.maxRecommendations ?? 50,
      enableCodeAnalysis: options.enableCodeAnalysis ?? true,
      patternDatabase: options.patternDatabase ?? this.getDefaultPatterns(),
    };
    this.patterns = this.options.patternDatabase;
  }

  /**
   * Analyze performance data and generate recommendations
   */
  public analyze(analysis: OptimizationAnalysis): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // CPU optimization recommendations
    if (analysis.cpuProfile) {
      recommendations.push(...this.analyzeCPUProfile(analysis.cpuProfile));
    }

    // Memory optimization recommendations
    if (analysis.memorySnapshots && analysis.memorySnapshots.length > 0) {
      recommendations.push(...this.analyzeMemorySnapshots(analysis.memorySnapshots));
    }

    // Performance metrics recommendations
    if (analysis.performanceMetrics && analysis.performanceMetrics.length > 0) {
      recommendations.push(...this.analyzePerformanceMetrics(analysis.performanceMetrics));
    }

    // Tracing recommendations
    if (analysis.traces && analysis.traces.length > 0) {
      recommendations.push(...this.analyzeTraces(analysis.traces));
    }

    // Code analysis recommendations
    if (analysis.code && this.options.enableCodeAnalysis) {
      recommendations.push(...this.analyzeCode(analysis.code));
    }

    // Filter by impact and sort
    const filtered = recommendations
      .filter((r) => r.impact.improvement >= this.options.minImpact)
      .sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.impact.improvement - a.impact.improvement;
      })
      .slice(0, this.options.maxRecommendations);

    this.recommendations = filtered;
    this.updateQueue();

    return filtered;
  }

  /**
   * Get all recommendations
   */
  public getRecommendations(): OptimizationRecommendation[] {
    return [...this.recommendations];
  }

  /**
   * Get recommendations by type
   */
  public getRecommendationsByType(type: OptimizationType): OptimizationRecommendation[] {
    return this.recommendations.filter((r) => r.type === type);
  }

  /**
   * Get recommendations by priority
   */
  public getRecommendationsByPriority(priority: OptimizationRecommendation['priority']): OptimizationRecommendation[] {
    return this.recommendations.filter((r) => r.priority === priority);
  }

  /**
   * Get optimization queue
   */
  public getQueue(): OptimizationQueue {
    return { ...this.queue };
  }

  /**
   * Apply recommendation (mark as completed)
   */
  public applyRecommendation(id: string): void {
    const index = this.queue.items.findIndex((r) => r.id === id);
    if (index !== -1) {
      const item = this.queue.items[index];
      this.queue.totalImpact -= item.impact.improvement;
      this.queue.totalEffort -= this.effortToNumber(item.effort);
      this.queue.items.splice(index, 1);
    }
  }

  /**
   * Dismiss recommendation
   */
  public dismissRecommendation(id: string): void {
    this.recommendations = this.recommendations.filter((r) => r.id !== id);
    this.updateQueue();
  }

  /**
   * Clear all recommendations
   */
  public clear(): void {
    this.recommendations = [];
    this.queue = {
      items: [],
      totalImpact: 0,
      totalEffort: 0,
    };
  }

  /**
   * Add custom pattern
   */
  public addPattern(pattern: OptimizationPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Remove pattern
   */
  public removePattern(type: OptimizationType, pattern: RegExp | string): void {
    this.patterns = this.patterns.filter(
      (p) => !(p.type === type && p.pattern === pattern)
    );
  }

  /**
   * Analyze CPU profile for optimization opportunities
   */
  private analyzeCPUProfile(profile: CPUProfileData): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Find hot functions
    const hotFunctions = this.findHotFunctions(profile);
    for (const fn of hotFunctions) {
      recommendations.push({
        id: uuidv4(),
        type: 'code-optimization',
        priority: fn.percentage > 20 ? 'high' : 'medium',
        title: `Optimize hot function: ${fn.name}`,
        description: `Function ${fn.name} accounts for ${fn.percentage.toFixed(1)}% of CPU time. Consider optimizing or caching results.`,
        impact: {
          metric: 'cpu.time',
          improvement: fn.percentage * 0.3,
          confidence: 0.8,
        },
        effort: 'medium',
        codeExample: this.getOptimizationExample('hot-function', fn.name),
        resources: [
          'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function',
          'https://web.dev/fast/',
        ],
      });
    }

    // Check for recursive calls
    const recursiveFunctions = this.findRecursiveFunctions(profile);
    for (const fn of recursiveFunctions) {
      recommendations.push({
        id: uuidv4(),
        type: 'algorithm',
        priority: 'medium',
        title: `Consider iterative approach for: ${fn}`,
        description: `Function ${fn} appears to be recursive. Consider converting to iterative approach to reduce stack overhead.`,
        impact: {
          metric: 'cpu.time',
          improvement: 10,
          confidence: 0.6,
        },
        effort: 'medium',
        codeExample: this.getOptimizationExample('recursion', fn),
        resources: [
          'https://en.wikipedia.org/wiki/Recursion_(computer_science)',
        ],
      });
    }

    return recommendations;
  }

  /**
   * Analyze memory snapshots for optimization opportunities
   */
  private analyzeMemorySnapshots(snapshots: MemorySnapshot[]): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    if (snapshots.length < 2) {
      return recommendations;
    }

    // Compare snapshots
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const growth = last.usedSize - first.usedSize;
    const growthPercent = (growth / first.usedSize) * 100;

    if (growth > 1024 * 1024) { // > 1MB
      recommendations.push({
        id: uuidv4(),
        type: 'memory-leak',
        priority: growthPercent > 50 ? 'critical' : 'high',
        title: 'Memory growth detected',
        description: `Memory usage has grown by ${this.formatBytes(growth)} (${growthPercent.toFixed(1)}%). Investigate potential memory leaks.`,
        impact: {
          metric: 'memory.used',
          improvement: growthPercent,
          confidence: 0.9,
        },
        effort: 'hard',
        codeExample: this.getOptimizationExample('memory-leak'),
        resources: [
          'https://developer.chrome.com/docs/devtools/memory-problems/',
          'https://nodejs.org/en/docs/guides/simple-profiling/',
        ],
      });
    }

    // Check for large objects
    for (const snapshot of snapshots) {
      const largeObjects = snapshot.objects.filter((obj) => obj.size > 1024 * 100); // > 100KB
      for (const obj of largeObjects.slice(0, 5)) {
        recommendations.push({
          id: uuidv4(),
          type: 'memory-leak',
          priority: 'medium',
          title: `Large object detected: ${obj.name}`,
          description: `Object ${obj.name} is ${this.formatBytes(obj.size)}. Consider splitting or lazy loading.`,
          impact: {
            metric: 'memory.used',
            improvement: 5,
            confidence: 0.7,
          },
          effort: 'medium',
          resources: [
            'https://web.dev/fast/#lazy-load-components',
          ],
        });
      }
    }

    return recommendations;
  }

  /**
   * Analyze performance metrics for optimization opportunities
   */
  private analyzePerformanceMetrics(metrics: PerformanceMetrics[]): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    if (metrics.length === 0) {
      return recommendations;
    }

    const latest = metrics[metrics.length - 1];
    const avg = this.calculateAverageMetrics(metrics);

    // CPU usage recommendations
    if (latest.cpu.usage > 80) {
      recommendations.push({
        id: uuidv4(),
        type: 'code-optimization',
        priority: 'critical',
        title: 'High CPU usage detected',
        description: `CPU usage is at ${latest.cpu.usage.toFixed(1)}%. Consider optimizing hot paths or moving work to worker threads.`,
        impact: {
          metric: 'cpu.usage',
          improvement: 30,
          confidence: 0.9,
        },
        effort: 'hard',
        codeExample: this.getOptimizationExample('high-cpu'),
        resources: [
          'https://nodejs.org/en/docs/guides/dont-block-the-event-loop/',
          'https://web.dev/workers/',
        ],
      });
    }

    // Memory usage recommendations
    const memoryUsagePercent = (latest.memory.used / latest.memory.total) * 100;
    if (memoryUsagePercent > 80) {
      recommendations.push({
        id: uuidv4(),
        type: 'memory-leak',
        priority: 'high',
        title: 'High memory usage detected',
        description: `Memory usage is at ${memoryUsagePercent.toFixed(1)}%. Investigate potential memory leaks or optimize data structures.`,
        impact: {
          metric: 'memory.used',
          improvement: 20,
          confidence: 0.8,
        },
        effort: 'hard',
        codeExample: this.getOptimizationExample('high-memory'),
        resources: [
          'https://nodejs.org/en/docs/guides/simple-profiling/',
        ],
      });
    }

    // Network latency recommendations
    if (latest.network.latency > avg.network.latency * 2) {
      recommendations.push({
        id: uuidv4(),
        type: 'network-batching',
        priority: 'high',
        title: 'High network latency detected',
        description: `Network latency is ${latest.network.latency.toFixed(0)}ms, 2x above average. Consider implementing request batching or caching.`,
        impact: {
          metric: 'network.latency',
          improvement: 40,
          confidence: 0.85,
        },
        effort: 'easy',
        codeExample: this.getOptimizationExample('network-batching'),
        resources: [
          'https://web.dev/http-cache/',
          'https://web.dev/stories-uses-caching/',
        ],
      });
    }

    // Caching recommendations
    if (latest.network.requests > avg.network.requests * 1.5) {
      recommendations.push({
        id: uuidv4(),
        type: 'caching',
        priority: 'medium',
        title: 'Excessive network requests',
        description: `Network requests have increased significantly. Consider implementing response caching.`,
        impact: {
          metric: 'network.requests',
          improvement: 50,
          confidence: 0.75,
        },
        effort: 'easy',
        codeExample: this.getOptimizationExample('caching'),
        resources: [
          'https://web.dev/http-cache/',
        ],
      });
    }

    return recommendations;
  }

  /**
   * Analyze traces for optimization opportunities
   */
  private analyzeTraces(traces: TraceSpan[]): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Find slow spans
    const slowSpans = traces
      .filter((t) => t.duration > 1000)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    for (const span of slowSpans) {
      const type = this.inferOptimizationType(span.operationName);
      recommendations.push({
        id: uuidv4(),
        type,
        priority: span.duration > 5000 ? 'high' : 'medium',
        title: `Slow operation: ${span.operationName}`,
        description: `Operation ${span.operationName} took ${span.duration}ms. Consider optimization.`,
        impact: {
          metric: 'operation.duration',
          improvement: Math.min(50, span.duration / 100),
          confidence: 0.7,
        },
        effort: this.estimateEffort(type),
        codeExample: this.getOptimizationExample(type, span.operationName),
        resources: this.getResourcesForType(type),
      });
    }

    // Check for database operations
    const dbSpans = traces.filter((t) =>
      t.operationName.toLowerCase().includes('db') ||
      t.operationName.toLowerCase().includes('query') ||
      t.operationName.toLowerCase().includes('database')
    );

    if (dbSpans.length > 0) {
      const avgDuration = dbSpans.reduce((sum, s) => sum + s.duration, 0) / dbSpans.length;
      if (avgDuration > 100) {
        recommendations.push({
          id: uuidv4(),
          type: 'database-query',
          priority: 'high',
          title: 'Slow database queries detected',
          description: `Average database query time is ${avgDuration.toFixed(0)}ms. Consider adding indexes or optimizing queries.`,
          impact: {
            metric: 'db.query.time',
            improvement: 40,
            confidence: 0.8,
          },
          effort: 'medium',
          codeExample: this.getOptimizationExample('database-query'),
          resources: [
            'https://www.postgresql.org/docs/current/indexes.html',
            'https://dev.mysql.com/doc/refman/8.0/en/optimization-indexes.html',
          ],
        });
      }
    }

    return recommendations;
  }

  /**
   * Analyze code for optimization opportunities
   */
  private analyzeCode(code: string): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    for (const pattern of this.patterns) {
      const regex = pattern.pattern instanceof RegExp ? pattern.pattern : new RegExp(pattern.pattern);
      const matches = code.match(regex);

      if (matches) {
        recommendations.push({
          id: uuidv4(),
          type: pattern.type,
          priority: pattern.estimatedImpact > 20 ? 'high' : 'medium',
          title: `Optimization opportunity: ${pattern.type}`,
          description: pattern.suggestion,
          impact: {
            metric: 'performance',
            improvement: pattern.estimatedImpact,
            confidence: 0.7,
          },
          effort: pattern.effort,
          codeExample: pattern.codeExample,
          resources: [],
        });
      }
    }

    return recommendations;
  }

  /**
   * Update optimization queue
   */
  private updateQueue(): void {
    this.queue.items = [...this.recommendations];
    this.queue.totalImpact = this.recommendations.reduce(
      (sum, r) => sum + r.impact.improvement,
      0
    );
    this.queue.totalEffort = this.recommendations.reduce(
      (sum, r) => sum + this.effortToNumber(r.effort),
      0
    );
  }

  /**
   * Find hot functions in CPU profile
   */
  private findHotFunctions(profile: CPUProfileData): Array<{ name: string; percentage: number }> {
    const hotFunctions: Array<{ name: string; percentage: number }> = [];
    const totalDuration = profile.totalDuration;

    for (const node of profile.nodes) {
      const selfTime = node.hitCount * profile.samplingInterval;
      const percentage = (selfTime / totalDuration) * 100;

      if (percentage > 5) {
        hotFunctions.push({
          name: node.callFrame.name || '(anonymous)',
          percentage,
        });
      }
    }

    return hotFunctions.sort((a, b) => b.percentage - a.percentage);
  }

  /**
   * Find potentially recursive functions
   */
  private findRecursiveFunctions(profile: CPUProfileData): string[] {
    const recursive = new Set<string>();

    for (const node of profile.nodes) {
      if (this.hasRecursiveCall(node, new Set())) {
        recursive.add(node.callFrame.name);
      }
    }

    return Array.from(recursive);
  }

  /**
   * Check if a node has recursive calls
   */
  private hasRecursiveCall(node: any, visited: Set<any>): boolean {
    if (visited.has(node)) {
      return true;
    }

    visited.add(node);

    for (const child of node.children) {
      if (child.callFrame.name === node.callFrame.name) {
        return true;
      }

      if (this.hasRecursiveCall(child, new Set(visited))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Infer optimization type from operation name
   */
  private inferOptimizationType(operationName: string): OptimizationType {
    const lower = operationName.toLowerCase();

    if (lower.includes('cache') || lower.includes('redis') || lower.includes('memcached')) {
      return 'caching';
    }
    if (lower.includes('db') || lower.includes('query') || lower.includes('sql')) {
      return 'database-query';
    }
    if (lower.includes('http') || lower.includes('api') || lower.includes('request')) {
      return 'network-batching';
    }
    if (lower.includes('lazy') || lower.includes('defer')) {
      return 'lazy-loading';
    }
    if (lower.includes('compress') || lower.includes('gzip')) {
      return 'compression';
    }
    if (lower.includes('index')) {
      return 'indexing';
    }

    return 'code-optimization';
  }

  /**
   * Estimate effort for optimization type
   */
  private estimateEffort(type: OptimizationType): 'easy' | 'medium' | 'hard' {
    const effortMap: Record<OptimizationType, 'easy' | 'medium' | 'hard'> = {
      caching: 'easy',
      'network-batching': 'easy',
      lazy: 'medium',
      'lazy-loading': 'medium',
      'database-query': 'medium',
      'code-optimization': 'medium',
      'memory-leak': 'hard',
      algorithm: 'hard',
      parallelization: 'hard',
      compression: 'easy',
      indexing: 'medium',
    };

    return effortMap[type] || 'medium';
  }

  /**
   * Get resources for optimization type
   */
  private getResourcesForType(type: OptimizationType): string[] {
    const resources: Record<OptimizationType, string[]> = {
      caching: ['https://web.dev/http-cache/'],
      'network-batching': ['https://web.dev/fast/#optimize-data-fetching'],
      'lazy-loading': ['https://web.dev/fast/#lazy-load-components'],
      'database-query': [
        'https://www.postgresql.org/docs/current/indexes.html',
        'https://dev.mysql.com/doc/refman/8.0/en/optimization-indexes.html',
      ],
      'code-optimization': ['https://web.dev/fast/'],
      'memory-leak': ['https://developer.chrome.com/docs/devtools/memory-problems/'],
      algorithm: ['https://en.wikipedia.org/wiki/Algorithmic_efficiency'],
      parallelization: ['https://nodejs.org/en/docs/guides/dont-block-the-event-loop/'],
      compression: ['https://web.dev/compression/'],
      indexing: ['https://www.postgresql.org/docs/current/indexes.html'],
    };

    return resources[type] || [];
  }

  /**
   * Get optimization code example
   */
  private getOptimizationExample(type: string, context?: string): string {
    const examples: Record<string, string> = {
      'hot-function': `
// Before: Hot function without caching
function processRequest(req) {
  return heavyComputation(req.data);
}

// After: Add memoization
const cache = new Map();
function processRequest(req) {
  const key = JSON.stringify(req.data);
  if (cache.has(key)) {
    return cache.get(key);
  }
  const result = heavyComputation(req.data);
  cache.set(key, result);
  return result;
}
`,
      'recursion': `
// Before: Recursive approach
function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

// After: Iterative approach
function factorial(n) {
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}
`,
      'memory-leak': `
// Before: Potential memory leak
class DataProcessor {
  constructor() {
    this.cache = new Map();
  }

  process(data) {
    this.cache.set(Date.now(), data); // Never cleared
  }
}

// After: Implement cache limit
class DataProcessor {
  constructor(maxSize = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  process(data) {
    this.cache.set(Date.now(), data);
    if (this.cache.size > this.maxSize) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
  }
}
`,
      'high-cpu': `
// Before: Blocking computation
function processArray(data) {
  return data.map(item => heavyCompute(item));
}

// After: Parallel processing with workers
function processArray(data) {
  const chunks = chunkArray(data, 1000);
  return Promise.all(
    chunks.map(chunk => runInWorker(chunk))
  );
}
`,
      'high-memory': `
// Before: Loading entire dataset
const data = loadAllData(); // 100MB

// After: Stream processing
for await (const chunk of loadDataStream()) {
  processChunk(chunk);
}
`,
      'network-batching': `
// Before: Individual requests
for (const item of items) {
  await fetchItem(item.id);
}

// After: Batched requests
const batches = chunkArray(items, 10);
for (const batch of batches) {
  await fetchBatch(batch.map(i => i.id));
}
`,
      'caching': `
// Before: No caching
async function getUser(id) {
  return await db.query('SELECT * FROM users WHERE id = ?', [id]);
}

// After: Add cache
const cache = new Map();
async function getUser(id) {
  if (cache.has(id)) {
    return cache.get(id);
  }
  const user = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  cache.set(id, user);
  return user;
}
`,
      'database-query': `
// Before: N+1 queries
async function getUsersWithPosts() {
  const users = await db.query('SELECT * FROM users');
  for (const user of users) {
    user.posts = await db.query('SELECT * FROM posts WHERE userId = ?', [user.id]);
  }
  return users;
}

// After: Single query with JOIN
async function getUsersWithPosts() {
  return await db.query(\`
    SELECT users.*, posts.*
    FROM users
    LEFT JOIN posts ON posts.userId = users.id
  \`);
}
`,
    };

    return examples[type] || '// No example available';
  }

  /**
   * Calculate average metrics
   */
  private calculateAverageMetrics(metrics: PerformanceMetrics[]): PerformanceMetrics {
    const n = metrics.length;

    const avg = (getter: (m: PerformanceMetrics) => number): number =>
      metrics.reduce((sum, m) => sum + getter(m), 0) / n;

    return {
      timestamp: Date.now(),
      cpu: {
        usage: avg((m) => m.cpu.usage),
        userTime: avg((m) => m.cpu.userTime),
        systemTime: avg((m) => m.cpu.systemTime),
        idleTime: avg((m) => m.cpu.idleTime),
      },
      memory: {
        used: avg((m) => m.memory.used),
        total: avg((m) => m.memory.total),
        heapUsed: avg((m) => m.memory.heapUsed),
        heapTotal: avg((m) => m.memory.heapTotal),
        external: avg((m) => m.memory.external),
      },
      network: {
        requests: avg((m) => m.network.requests),
        bytesReceived: avg((m) => m.network.bytesReceived),
        bytesSent: avg((m) => m.network.bytesSent),
        errors: avg((m) => m.network.errors),
        latency: avg((m) => m.network.latency),
      },
      custom: {},
    };
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Convert effort to number
   */
  private effortToNumber(effort: 'easy' | 'medium' | 'hard'): number {
    const effortMap = { easy: 1, medium: 2, hard: 3 };
    return effortMap[effort];
  }

  /**
   * Get default optimization patterns
   */
  private getDefaultPatterns(): OptimizationPattern[] {
    return [
      {
        type: 'caching',
        pattern: /for\s*\(\s*\w+\s+of\s+\w+\)\s*{\s*await\s+/,
        suggestion: 'Consider caching results in loops to avoid repeated async operations',
        codeExample: this.getOptimizationExample('caching'),
        estimatedImpact: 30,
        effort: 'easy',
      },
      {
        type: 'algorithm',
        pattern: /\.indexOf\(/,
        suggestion: 'Consider using Set or Map for O(1) lookups instead of O(n) array.indexOf',
        codeExample: `
// Before: O(n) lookup
if (arr.indexOf(item) !== -1) { ... }

// After: O(1) lookup
const set = new Set(arr);
if (set.has(item)) { ... }
`,
        estimatedImpact: 20,
        effort: 'easy',
      },
      {
        type: 'network-batching',
        pattern: /for\s*\(.*\)\s*{\s*await\s+(fetch|axios|request)/,
        suggestion: 'Consider batching network requests to reduce overhead',
        codeExample: this.getOptimizationExample('network-batching'),
        estimatedImpact: 40,
        effort: 'medium',
      },
      {
        type: 'lazy-loading',
        pattern: /import\s+.*from\s+['"]/,
        suggestion: 'Consider using dynamic import() for code splitting and lazy loading',
        codeExample: `
// Before: Eager import
import { HeavyComponent } from './HeavyComponent';

// After: Lazy import
const HeavyComponent = lazy(() => import('./HeavyComponent'));
`,
        estimatedImpact: 15,
        effort: 'easy',
      },
    ];
  }
}

/**
 * Convenience function to create an optimizer
 */
export function createOptimizer(options?: OptimizerOptions): OptimizerRecommender {
  return new OptimizerRecommender(options);
}
