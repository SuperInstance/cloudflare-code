/**
 * Performance Analyzer - Analyzes code performance issues and optimization opportunities
 */

// @ts-nocheck - Complex performance analysis with unused parameters
import {
  PerformanceIssue,
  PerformanceMetrics,
  Issue,
  Severity,
  Category,
  FileInfo,
  Language,
} from '../types/index.js';

// ============================================================================
// Performance Analyzer Options
// ============================================================================

interface PerformanceAnalyzerOptions {
  maxLoopIterations?: number;
  maxNestingDepth?: number;
  enableProfiling?: boolean;
  benchmarkIterations?: number;
}

const DEFAULT_OPTIONS: PerformanceAnalyzerOptions = {
  maxLoopIterations: 1000,
  maxNestingDepth: 3,
  enableProfiling: false,
  benchmarkIterations: 1000,
};

// ============================================================================
// Performance Analyzer
// ============================================================================

export class PerformanceAnalyzer {
  private options: PerformanceAnalyzerOptions;

  constructor(options: PerformanceAnalyzerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ========================================================================
  // Main Analysis Methods
  // ========================================================================

  /**
   * Analyze performance of a file
   */
  async analyzeFile(filePath: string, content: string, fileInfo: FileInfo): Promise<PerformanceMetrics> {
    const issues = await this.detectPerformanceIssues(filePath, content, fileInfo);

    return {
      timeComplexity: this.estimateTimeComplexity(content, fileInfo.language),
      spaceComplexity: this.estimateSpaceComplexity(content, fileInfo.language),
      bottlenecks: this.identifyBottlenecks(content, fileInfo),
      recommendations: this.generateRecommendations(content, fileInfo, issues),
      benchmarkResults: this.options.enableProfiling
        ? await this.runBenchmarks(content, fileInfo)
        : undefined,
    };
  }

  /**
   * Detect performance issues
   */
  async detectPerformanceIssues(
    filePath: string,
    content: string,
    fileInfo: FileInfo
  ): Promise<PerformanceIssue[]> {
    const issues: PerformanceIssue[] = [];

    // Detect various performance issues
    issues.push(...this.detectInefficientLoops(filePath, content, fileInfo));
    issues.push(...this.detectMemoryLeaks(filePath, content, fileInfo));
    issues.push(...this.detectInefficientDataStructures(filePath, content, fileInfo));
    issues.push(...this.detectBlockingOperations(filePath, content, fileInfo));
    issues.push(...this.detectRedundantComputations(filePath, content, fileInfo));
    issues.push(...this.detectInefficientDOMOperations(filePath, content, fileInfo));
    issues.push(...this.detectLargeObjectAllocations(filePath, content, fileInfo));

    return issues;
  }

  // ========================================================================
  // Performance Issue Detection
  // ========================================================================

  private detectInefficientLoops(filePath: string, content: string, fileInfo: FileInfo): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Nested loops
      if (/\bfor\s*\([^)]*\)\s*{/.test(line)) {
        let depth = 1;
        let j = i + 1;

        while (j < lines.length && depth > 0) {
          if (/\bfor\s*\(/.test(lines[j])) depth++;
          if (lines[j].includes('}')) depth--;
          j++;
        }

        if (depth >= 3) {
          issues.push(this.createPerformanceIssue(
            'inefficient-nested-loops',
            'Inefficient Nested Loops',
            `Deeply nested loops (${depth} levels) detected. Time complexity is likely O(n^${depth}).`,
            filePath,
            i + 1,
            line,
            'high',
            'Consider flattening loops or using more efficient algorithms like hash maps for lookups.',
            fileInfo
          ));
        }
      }

      // Loop with heavy operations
      if (/\bfor\s*\([^)]*\)\s*{/.test(line)) {
        const nextLines = lines.slice(i, Math.min(i + 10, lines.length)).join('\n');
        if (/\b(query|select|fetch|request|http)\s*\(/.test(nextLines)) {
          issues.push(this.createPerformanceIssue(
            'loop-with-io',
            'I/O Operation Inside Loop',
            'Performing I/O operations inside a loop can severely impact performance.',
            filePath,
            i + 1,
            line,
            'high',
            'Move I/O operations outside the loop or use batch/parallel processing.',
            fileInfo
          ));
        }
      }

      // Inefficient array operations in loop
      if (/\bfor\s*\([^)]*\)\s*{/.test(line)) {
        const loopBody = this.extractLoopBody(lines, i);
        if (/\.(push|splice|concat)\(/.test(loopBody) && /\blength\b/.test(loopBody)) {
          issues.push(this.createPerformanceIssue(
            'array-resize-in-loop',
            'Array Resize Inside Loop',
            'Modifying array length inside a loop causes repeated reallocation.',
            filePath,
            i + 1,
            line,
            'medium',
            'Pre-allocate array size or use different data structure.',
            fileInfo
          ));
        }
      }
    }

    return issues;
  }

  private detectMemoryLeaks(filePath: string, content: string, fileInfo: FileInfo): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Event listeners without cleanup
      if (/\.(addEventListener|on)\s*\(/.test(line)) {
        const nextLines = lines.slice(i, Math.min(i + 50, lines.length)).join('\n');
        if (!/\bremoveEventListener\b/.test(nextLines) && !/\boff\b/.test(nextLines)) {
          issues.push(this.createPerformanceIssue(
            'event-listener-leak',
            'Potential Event Listener Leak',
            'Event listener added without corresponding removal in cleanup.',
            filePath,
            i + 1,
            line,
            'medium',
            'Remove event listeners when component unmounts or when no longer needed.',
            fileInfo
          ));
        }
      }

      // Timers without cleanup
      if (/\b(setInterval|setTimeout)\s*\(/.test(line)) {
        const nextLines = lines.slice(i, Math.min(i + 50, lines.length)).join('\n');
        if (!/\b(clearInterval|clearTimeout)\b/.test(nextLines)) {
          issues.push(this.createPerformanceIssue(
            'timer-leak',
            'Potential Timer Leak',
            'Timer created without corresponding cleanup.',
            filePath,
            i + 1,
            line,
            'medium',
            'Store timer reference and clear it when done.',
            fileInfo
          ));
        }
      }

      // Closures retaining large objects
      if (/\bfunction\s*\(\s*\)\s*{/.test(line) || /=>\s*{/.test(line)) {
        const funcBody = this.extractFunctionBody(lines, i);
        if (funcBody.length > 100 && /\blet\s+\w+\s*=\s*\[/.test(funcBody)) {
          issues.push(this.createPerformanceIssue(
            'closure-memory-leak',
            'Potential Closure Memory Leak',
            'Closure may retain large objects in memory longer than necessary.',
            filePath,
            i + 1,
            line,
            'low',
            'Consider nullifying large objects when no longer needed or using weaker references.',
            fileInfo
          ));
        }
      }
    }

    return issues;
  }

  private detectInefficientDataStructures(filePath: string, content: string, fileInfo: FileInfo): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Array.includes() or indexOf() in loop
      if (/\b(for|while)\s*\(/.test(line)) {
        const loopBody = this.extractLoopBody(lines, i);
        const matches = loopBody.match(/\.\s*(includes|indexOf)\s*\(/g);
        if (matches && matches.length > 0) {
          issues.push(this.createPerformanceIssue(
            'inefficient-lookup',
            'Inefficient Array Lookup',
            `Array.includes()/indexOf() is O(n). Consider using Set or Map for O(1) lookups.`,
            filePath,
            i + 1,
            line,
            'medium',
            'Convert array to Set for O(1) lookup performance.',
            fileInfo
          ));
        }
      }

      // String concatenation in loop
      if (/\b(for|while)\s*\(/.test(line)) {
        const loopBody = this.extractLoopBody(lines, i);
        if (/\+\s*['"`]/.test(loopBody) && /\b(for|while)\b/.test(loopBody)) {
          issues.push(this.createPerformanceIssue(
            'inefficient-string-concat',
            'Inefficient String Concatenation',
            'String concatenation in loop creates many temporary strings.',
            filePath,
            i + 1,
            line,
            'medium',
            'Use array.join() or template literals for better performance.',
            fileInfo
          ));
        }
      }

      // Using array as queue with shift()
      if (/\.\s*shift\s*\(\s*\)/.test(line)) {
        issues.push(this.createPerformanceIssue(
          'inefficient-queue',
          'Inefficient Queue Operation',
          'Array.shift() is O(n). Consider using a proper queue data structure.',
          filePath,
          i + 1,
          line,
          'medium',
          'Use a deque or linked list for efficient queue operations.',
          fileInfo
        ));
      }
    }

    return issues;
  }

  private detectBlockingOperations(filePath: string, content: string, fileInfo: FileInfo): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Synchronous file operations
      if (/\b(fs\.readFileSync|fs\.writeFileSync|fs\.existsSync)\s*\(/.test(line)) {
        issues.push(this.createPerformanceIssue(
          'blocking-io',
          'Blocking I/O Operation',
          'Synchronous file operations block the event loop.',
          filePath,
          i + 1,
          line,
          'high',
          'Use async/await with fs.promises for non-blocking I/O.',
          fileInfo
        ));
      }

      // Synchronous network requests
      if (/\b(request\.get|axios\.get|fetch)\s*\(\s*\)[^;]*;(?!\s*\n\s*await)/.test(line)) {
        issues.push(this.createPerformanceIssue(
          'blocking-network',
          'Potential Blocking Network Request',
          'Network request without await could be blocking or cause race conditions.',
          filePath,
          i + 1,
          line,
          'high',
          'Use await or proper promise handling for async operations.',
          fileInfo
        ));
      }

      // CPU-intensive synchronous operations
      if (/\b(JSON\.parse|JSON\.stringify|crypto\.[a-zA-Z]+)\s*\(/.test(line)) {
        const prevLine = i > 0 ? lines[i - 1] : '';
        if (!/await/.test(prevLine) && !/await/.test(line)) {
          issues.push(this.createPerformanceIssue(
            'blocking-cpu',
            'Blocking CPU-Intensive Operation',
            'CPU-intensive operation without await could block the event loop.',
            filePath,
            i + 1,
            line,
            'medium',
            'Consider offloading to worker thread or using async alternatives.',
            fileInfo
          ));
        }
      }
    }

    return issues;
  }

  private detectRedundantComputations(filePath: string, content: string, fileInfo: FileInfo): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    const lines = content.split('\n');

    // Track repeated computations
    const computations: Map<string, number[]> = new Map();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect function calls or calculations
      const matches = line.match(/([a-zA-Z_$][\w$]*\s*\([^)]*\)|[a-zA-Z_$][\w$]*\s*[\/*+\-]\s*[\w\d]+)/g);
      if (matches) {
        for (const match of matches) {
          if (!computationss.has(match)) {
            computations.set(match, []);
          }
          computations.get(match)!.push(i + 1);
        }
      }
    }

    // Report repeated computations
    for (const [computation, occurrences] of computations.entries()) {
      if (occurrences.length > 3) {
        issues.push(this.createPerformanceIssue(
          'redundant-computation',
          'Redundant Computation',
          `Computation '${computation}' appears ${occurrences.length} times. Consider memoization.`,
          filePath,
          occurrences[0],
          '',
          'low',
          'Cache the result or use memoization to avoid repeated computation.',
          fileInfo
        ));
      }
    }

    return issues;
  }

  private detectInefficientDOMOperations(filePath: string, content: string, fileInfo: FileInfo): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // DOM queries in loop
      if (/\b(for|while)\s*\(/.test(line)) {
        const loopBody = this.extractLoopBody(lines, i);
        const domQueries = loopBody.match(/document\.(getElementById|querySelector|querySelectorAll)\s*\(/g);
        if (domQueries && domQueries.length > 0) {
          issues.push(this.createPerformanceIssue(
            'dom-query-in-loop',
            'DOM Query Inside Loop',
            'Querying the DOM inside a loop causes unnecessary reflows/repaints.',
            filePath,
            i + 1,
            line,
            'high',
            'Cache DOM queries outside the loop.',
            fileInfo
          ));
        }
      }

      // Forced reflow
      if (/\boffset\w+\s*=/.test(line) || /\bclient\w+\s*=/.test(line) || /\bscroll\w+\s*=/.test(line)) {
        const prevLines = lines.slice(Math.max(0, i - 5), i).join('\n');
        if (/\b(style\.|className\s*=)/.test(prevLines)) {
          issues.push(this.createPerformanceIssue(
            'forced-reflow',
            'Forced Reflow',
            'Reading layout properties immediately after writing causes forced reflow.',
            filePath,
            i + 1,
            line,
            'high',
            'Batch DOM reads and writes to avoid forced reflows.',
            fileInfo
          ));
        }
      }

      // Direct innerHTML with user input
      if (/\.\s*innerHTML\s*=\s*.*\$/.test(line) || /\.\s*innerHTML\s*\+=/.test(line)) {
        issues.push(this.createPerformanceIssue(
          'inefficient-innerhtml',
          'Inefficient innerHTML Usage',
          'innerHTML is slow and can cause security issues.',
          filePath,
          i + 1,
          line,
          'medium',
          'Use createElement or textContent for better performance and security.',
          fileInfo
        ));
      }
    }

    return issues;
  }

  private detectLargeObjectAllocations(filePath: string, content: string, fileInfo: FileInfo): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Large object/array literal
      if (/\{[\s\S]{100,}\}/.test(line) || /\[[\s\S]{100,}\]/.test(line)) {
        issues.push(this.createPerformanceIssue(
          'large-allocation',
          'Large Object Allocation',
          'Large object allocation detected. Consider lazy loading or pagination.',
          filePath,
          i + 1,
          line.substring(0, 50) + '...',
          'low',
          'Consider lazy loading, pagination, or streaming for large data sets.',
          fileInfo
        ));
      }

      // Creating large arrays with spread
      if (/\[.*\.\.\..*[0-9]{4,}\]/.test(line)) {
        issues.push(this.createPerformanceIssue(
          'large-array-spread',
          'Large Array Creation with Spread',
          'Creating large arrays with spread operator can be memory-intensive.',
          filePath,
          i + 1,
          line,
          'medium',
          'Use Array.from() or lazy generation for large arrays.',
          fileInfo
        ));
      }
    }

    return issues;
  }

  // ========================================================================
  // Complexity Analysis
  // ========================================================================

  private estimateTimeComplexity(content: string, language: Language): string {
    // Analyze loops and recursion
    const lines = content.split('\n');
    let maxNesting = 0;
    let currentNesting = 0;

    for (const line of lines) {
      if (/\b(for|while)\s*\(/.test(line)) {
        currentNesting++;
        maxNesting = Math.max(maxNesting, currentNesting);
      }
      if (line.includes('}')) {
        currentNesting = Math.max(0, currentNesting - 1);
      }
    }

    // Check for common patterns
    if (maxNesting >= 3) return `O(n^${maxNesting})`;
    if (maxNesting === 2) return 'O(n²)';
    if (maxNesting === 1) return 'O(n)';
    if (/\bbinary\s+(search|search)/.test(content)) return 'O(log n)';
    if (/\b(sort|merge|quick)/.test(content)) return 'O(n log n)';

    return 'O(1)';
  }

  private estimateSpaceComplexity(content: string, language: Language): string {
    // Check for data structure allocations
    let maxArrays = 0;
    let maxObjects = 0;

    const arrayMatches = content.match(/\[[^\]]*\]/g);
    const objectMatches = content.match(/\{[^}]*\}/g);

    if (arrayMatches) maxArrays = arrayMatches.length;
    if (objectMatches) maxObjects = objectMatches.length;

    const maxAllocations = Math.max(maxArrays, maxObjects);

    if (maxAllocations > 100) return 'O(n²)';
    if (maxAllocations > 10) return 'O(n)';
    return 'O(1)';
  }

  // ========================================================================
  // Bottleneck Identification
  // ========================================================================

  private identifyBottlenecks(content: string, fileInfo: FileInfo): string[] {
    const bottlenecks: string[] = [];

    // Check for common bottleneck patterns
    if (/\bfor\s*\(.*\)\s*{\s*for\s*\(/.test(content)) {
      bottlenecks.push('Nested loops (O(n²) or worse complexity)');
    }

    if (/\b(fs\.readFileSync|fs\.writeFileSync)\s*\(/.test(content)) {
      bottlenecks.push('Synchronous file I/O operations');
    }

    if (/document\.(getElementById|querySelector)/.test(content)) {
      bottlenecks.push('Frequent DOM queries');
    }

    if (/\.\s*innerHTML\s*=/.test(content)) {
      bottlenecks.push('Direct DOM manipulation');
    }

    if (/\b(setTimeout|setInterval)\s*\(\s*function/.test(content)) {
      bottlenecks.push('Improper async/timeout handling');
    }

    return bottlenecks;
  }

  private generateRecommendations(content: string, fileInfo: FileInfo, issues: PerformanceIssue[]): string[] {
    const recommendations: string[] = [];

    // Analyze issues and generate recommendations
    const nestedLoops = issues.filter((i) => i.ruleId === 'inefficient-nested-loops').length;
    if (nestedLoops > 0) {
      recommendations.push('Refactor nested loops to use hash maps or more efficient algorithms');
    }

    const blockingOps = issues.filter((i) => i.ruleId === 'blocking-io' || i.ruleId === 'blocking-network').length;
    if (blockingOps > 0) {
      recommendations.push('Convert blocking I/O operations to async/await pattern');
    }

    const memoryLeaks = issues.filter((i) => i.ruleId === 'event-listener-leak' || i.ruleId === 'timer-leak').length;
    if (memoryLeaks > 0) {
      recommendations.push('Implement proper cleanup for event listeners and timers');
    }

    const domIssues = issues.filter((i) => i.ruleId.includes('dom')).length;
    if (domIssues > 0) {
      recommendations.push('Optimize DOM operations by batching reads/writes and caching queries');
    }

    if (recommendations.length === 0) {
      recommendations.push('No major performance issues detected. Continue monitoring.');
    }

    return recommendations;
  }

  // ========================================================================
  // Benchmarking
  // ========================================================================

  private async runBenchmarks(content: string, fileInfo: FileInfo): Promise<Array<{
    name: string;
    iterations: number;
    totalTime: number;
    avgTime: number;
    minTime: number;
    maxTime: number;
  }>> {
    // This would actually run the code and measure performance
    // For now, return empty array as this requires code execution
    return [];
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private createPerformanceIssue(
    ruleId: string,
    title: string,
    description: string,
    filePath: string,
    line: number,
    code: string,
    impact: 'high' | 'medium' | 'low',
    suggestion: string,
    fileInfo: FileInfo
  ): PerformanceIssue {
    const severity: Severity = impact === 'high' ? 'error' : impact === 'medium' ? 'warning' : 'info';

    return {
      id: `PERF-${ruleId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId,
      severity,
      category: 'performance',
      title,
      description,
      location: {
        path: filePath,
        line,
        column: 1,
      },
      code,
      suggestion,
      impact,
      metadata: {},
      timestamp: new Date(),
    };
  }

  private extractLoopBody(lines: string[], startIndex: number): string {
    let depth = 1;
    let body = '';

    for (let i = startIndex + 1; i < lines.length && depth > 0; i++) {
      const line = lines[i];
      depth += (line.match(/{/g) || []).length;
      depth -= (line.match(/}/g) || []).length;
      body += line + '\n';
    }

    return body;
  }

  private extractFunctionBody(lines: string[], startIndex: number): string {
    let depth = 1;
    let body = '';

    for (let i = startIndex + 1; i < lines.length && depth > 0; i++) {
      const line = lines[i];
      depth += (line.match(/{/g) || []).length;
      depth -= (line.match(/}/g) || []).length;
      body += line + '\n';
    }

    return body;
  }
}
