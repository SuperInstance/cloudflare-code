/**
 * Performance Analyzer
 *
 * Comprehensive performance analysis including:
 * - N+1 query detection
 * - Memory leak detection
 * - Algorithm complexity analysis
 * - Inefficient loop detection
 * - Bundle size analysis
 * - Database operation analysis
 * - Async operation analysis
 */

import type { SupportedLanguage } from '../codebase/types';
import type {
  PerformanceIssue,
  PerformanceProfile,
  CodeIssue,
  ReviewOptions,
} from './types';

// ============================================================================
// Performance Patterns
// ============================================================================

/**
 * N+1 query patterns
 */
const N_PLUS_1_PATTERNS = [
  {
    pattern: /(?:forEach|map|for|while)\s*\([^)]*\)\s*\{[^}]*(?:db|query|execute|find)\s*\(/gi,
    type: 'database-query-in-loop',
    description: 'Database query inside loop can cause N+1 query problem',
    suggestion: 'Use bulk operations or join queries',
  },
  {
    pattern: /(?:\.forEach|\.map|\.filter|\.reduce)\s*\([^)]*\)\s*[^}]*(?:fetch|axios|http)\s*\(/gi,
    type: 'http-request-in-loop',
    description: 'HTTP request inside loop can cause performance issues',
    suggestion: 'Batch requests or use Promise.all()',
  },
];

/**
 * Memory leak patterns
 */
const MEMORY_LEAK_PATTERNS = [
  {
    pattern: /setInterval\s*\([^,]+,\s*(?:10|100|1000)\s*\)/gi,
    type: 'fast-interval',
    description: 'Fast interval timer can cause performance issues',
    suggestion: 'Use appropriate interval duration or consider requestAnimationFrame',
  },
  {
    pattern: /addEventListener\s*\([^)]+\)/gi,
    type: 'event-listener',
    description: 'Event listener added without cleanup can cause memory leaks',
    suggestion: 'Ensure removeEventListener is called when component unmounts',
  },
  {
    pattern: /(?:setTimeout|setInterval)\s*\([^)]*\)\s*(?!.*clear)/gi,
    type: 'uncleared-timer',
    description: 'Timer created without clear operation',
    suggestion: 'Store timer ID and clear it when done',
  },
];

/**
 * Inefficient algorithm patterns
 */
const INEFFICIENT_ALGORITHM_PATTERNS = [
  {
    pattern: /(?:indexOf|includes|find)\s*\(\s*\w+\s*\)\s*[^}]*for\s*\(/gi,
    type: 'nested-search',
    description: 'O(n²) algorithm detected - using search inside loop',
    suggestion: 'Use Set or Map for O(1) lookups',
  },
  {
    pattern: /for\s*\([^)]+\)\s*\{[^}]*for\s*\([^)]+\)\s*\{[^}]*for\s*\(/gi,
    type: 'triple-nested-loop',
    description: 'O(n³) algorithm detected - triple nested loop',
    suggestion: 'Consider optimizing algorithm or using better data structures',
  },
  {
    pattern: /\.sort\s*\([^)]*\)\s*[^}]*\.indexOf\s*\(/gi,
    type: 'sort-then-search',
    description: 'Inefficient sort then search pattern',
    suggestion: 'Use binary search or consider the data structure',
  },
];

/**
 * Synchronous operation patterns
 */
const SYNC_OPERATION_PATTERNS = [
  {
    pattern: /fs\.(readFileSync|writeFileSync|existsSync|statSync)\s*\(/gi,
    type: 'sync-file-operation',
    description: 'Synchronous file I/O blocks the event loop',
    suggestion: 'Use async version of the function',
  },
  {
    pattern: /child_process\.(execSync|spawnSync)\s*\(/gi,
    type: 'sync-child-process',
    description: 'Synchronous child process blocks the event loop',
    suggestion: 'Use async version of the function',
  },
  {
    pattern: /crypto\.(randomBytes|pbkdf2)\s*\([^)]*\)\s*(?!await)/gi,
    type: 'sync-crypto',
    description: 'Synchronous crypto operation can be slow',
    suggestion: 'Use async version or move off main thread',
  },
];

/**
 * DOM manipulation patterns
 */
const DOM_MANIPULATION_PATTERNS = [
  {
    pattern: /for\s*\([^)]+\)\s*\{[^}]*document\.(createElement|appendChild)/gi,
    type: 'dom-in-loop',
    description: 'DOM manipulation inside loop causes reflows',
    suggestion: 'Use DocumentFragment or batch DOM updates',
  },
  {
    pattern: /document\.(querySelector|querySelectorAll)\s*\([^)]+\)\s*[^}]*for\s*\(/gi,
    type: 'dom-query-in-loop',
    description: 'DOM query inside loop is inefficient',
    suggestion: 'Cache DOM queries outside loop',
  },
  {
    pattern: /style\s*=.*;/gi,
    type: 'direct-style-manipulation',
    description: 'Direct style manipulation causes layout thrashing',
    suggestion: 'Use CSS classes or batch style changes',
  },
];

// ============================================================================
// Performance Analyzer
// ============================================================================

/**
 * Performance analyzer configuration
 */
interface PerformanceAnalyzerConfig {
  checkNPlusOne: boolean;
  checkMemoryLeaks: boolean;
  checkAlgorithms: boolean;
  checkDOM: boolean;
  checkAsync: boolean;
  maxLoopNesting: number;
  maxFunctionLength: number;
}

/**
 * Performance analyzer
 */
export class PerformanceAnalyzer {
  private config: PerformanceAnalyzerConfig;

  constructor(config: Partial<PerformanceAnalyzerConfig> = {}) {
    this.config = {
      checkNPlusOne: config.checkNPlusOne ?? true,
      checkMemoryLeaks: config.checkMemoryLeaks ?? true,
      checkAlgorithms: config.checkAlgorithms ?? true,
      checkDOM: config.checkDOM ?? true,
      checkAsync: config.checkAsync ?? true,
      maxLoopNesting: config.maxLoopNesting ?? 2,
      maxFunctionLength: config.maxFunctionLength ?? 50,
    };
  }

  /**
   * Analyze code for performance issues
   */
  async analyzePerformance(
    content: string,
    filePath: string,
    language: SupportedLanguage,
    options?: ReviewOptions
  ): Promise<{
    issues: CodeIssue[];
    profile: PerformanceProfile;
  }> {
    const issues: CodeIssue[] = [];
    const lines = content.split('\n');

    // Check for N+1 problems
    if (this.config.checkNPlusOne) {
      issues.push(...this.checkNPlusOneProblems(content, filePath, lines));
    }

    // Check for memory leaks
    if (this.config.checkMemoryLeaks) {
      issues.push(...this.checkMemoryLeaks(content, filePath, lines));
    }

    // Check for inefficient algorithms
    if (this.config.checkAlgorithms) {
      issues.push(...this.checkInefficientAlgorithms(content, filePath, lines));
    }

    // Check for DOM issues
    if (this.config.checkDOM && (language === 'typescript' || language === 'javascript')) {
      issues.push(...this.checkDOMIssues(content, filePath, lines));
    }

    // Check for async issues
    if (this.config.checkAsync) {
      issues.push(...this.checkAsyncOperations(content, filePath, lines));
    }

    // Generate performance profile
    const profile = this.generateProfile(content, filePath, issues);

    return { issues, profile };
  }

  /**
   * Check for N+1 query problems
   */
  private checkNPlusOneProblems(
    content: string,
    filePath: string,
    lines: string[]
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];

    for (const pattern of N_PLUS_1_PATTERNS) {
      let match;
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);

      while ((match = regex.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index);

        issues.push({
          id: `perf-${pattern.type}-${lineNum}`,
          severity: 'high',
          category: 'performance',
          rule: 'n-plus-one-problem',
          message: pattern.description,
          description: pattern.description,
          file: filePath,
          line: lineNum,
          code: lines[lineNum - 1]?.trim(),
          suggestion: pattern.suggestion,
          confidence: 0.8,
          tags: ['performance', 'n-plus-one', 'database'],
        });
      }
    }

    return issues;
  }

  /**
   * Check for memory leaks
   */
  private checkMemoryLeaks(
    content: string,
    filePath: string,
    lines: string[]
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];

    for (const pattern of MEMORY_LEAK_PATTERNS) {
      let match;
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);

      while ((match = regex.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index);

        issues.push({
          id: `perf-${pattern.type}-${lineNum}`,
          severity: 'medium',
          category: 'performance',
          rule: 'memory-leak',
          message: pattern.description,
          description: pattern.description,
          file: filePath,
          line: lineNum,
          code: lines[lineNum - 1]?.trim(),
          suggestion: pattern.suggestion,
          confidence: 0.7,
          tags: ['performance', 'memory-leak'],
        });
      }
    }

    // Check for missing cleanup in React components
    const useEffectPattern = /useEffect\s*\(\s*\([^)]*\)\s*=>\s*\{([^}]+setInterval|setTimeout|addEventListener)/g;
    let match;
    while ((match = useEffectPattern.exec(content)) !== null) {
      const lineNum = this.getLineNumber(content, match.index);
      const nextLines = lines.slice(lineNum - 1, lineNum + 10).join('\n');

      if (!nextLines.includes('return') && !nextLines.includes('clear')) {
        issues.push({
          id: `perf-missing-cleanup-${lineNum}`,
          severity: 'medium',
          category: 'performance',
          rule: 'missing-cleanup',
          message: 'useEffect with timer/event listener missing cleanup',
          description: 'Timers and event listeners in useEffect should be cleaned up',
          file: filePath,
          line: lineNum,
          code: lines[lineNum - 1]?.trim(),
          suggestion: 'Return a cleanup function from useEffect',
          confidence: 0.75,
          tags: ['performance', 'memory-leak', 'react'],
        });
      }
    }

    return issues;
  }

  /**
   * Check for inefficient algorithms
   */
  private checkInefficientAlgorithms(
    content: string,
    filePath: string,
    lines: string[]
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];

    for (const pattern of INEFFICIENT_ALGORITHM_PATTERNS) {
      let match;
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);

      while ((match = regex.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index);

        issues.push({
          id: `perf-${pattern.type}-${lineNum}`,
          severity: 'medium',
          category: 'performance',
          rule: 'inefficient-algorithm',
          message: pattern.description,
          description: pattern.description,
          file: filePath,
          line: lineNum,
          code: lines[lineNum - 1]?.trim(),
          suggestion: pattern.suggestion,
          confidence: 0.75,
          tags: ['performance', 'algorithm', 'complexity'],
        });
      }
    }

    // Check for nested loops
    const nestedLoopPattern = /for\s*\([^)]+\)\s*\{[^}]{0,500}for\s*\(/gi;
    let match;
    while ((match = nestedLoopPattern.exec(content)) !== null) {
      const lineNum = this.getLineNumber(content, match.index);
      const context = content.substring(match.index, match.index + 1000);

      // Count nesting level
      let nestingLevel = 0;
      const forMatches = context.match(/for\s*\(/gi) || [];
      nestingLevel = forMatches.length;

      if (nestingLevel > this.config.maxLoopNesting) {
        issues.push({
          id: `perf-nested-loop-${lineNum}`,
          severity: 'medium',
          category: 'performance',
          rule: 'nested-loops',
          message: `Nested loop detected (nesting level: ${nestingLevel})`,
          description: `Nested loops can lead to O(n^${nestingLevel}) time complexity`,
          file: filePath,
          line: lineNum,
          code: lines[lineNum - 1]?.trim(),
          suggestion: 'Consider optimizing the algorithm or using better data structures',
          confidence: 0.85,
          tags: ['performance', 'complexity', 'algorithm'],
        });
      }
    }

    return issues;
  }

  /**
   * Check for DOM manipulation issues
   */
  private checkDOMIssues(
    content: string,
    filePath: string,
    lines: string[]
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];

    for (const pattern of DOM_MANIPULATION_PATTERNS) {
      let match;
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);

      while ((match = regex.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index);

        issues.push({
          id: `perf-${pattern.type}-${lineNum}`,
          severity: 'medium',
          category: 'performance',
          rule: 'dom-performance',
          message: pattern.description,
          description: pattern.description,
          file: filePath,
          line: lineNum,
          code: lines[lineNum - 1]?.trim(),
          suggestion: pattern.suggestion,
          confidence: 0.7,
          tags: ['performance', 'dom', 'browser'],
        });
      }
    }

    // Check for layout thrashing
    const layoutThrashPattern = /style\.[^;]+;[^}]*offset(?:Width|Height|Top|Left)/gi;
    let match;
    while ((match = layoutThrashPattern.exec(content)) !== null) {
      const lineNum = this.getLineNumber(content, match.index);

      issues.push({
        id: `perf-layout-thrashing-${lineNum}`,
        severity: 'medium',
        category: 'performance',
        rule: 'layout-thrashing',
        message: 'Layout thrashing detected - reading layout properties after writing',
        description: 'Reading layout properties after writing causes forced reflow',
        file: filePath,
        line: lineNum,
        code: lines[lineNum - 1]?.trim(),
        suggestion: 'Batch reads and writes, or use requestAnimationFrame',
        confidence: 0.8,
        tags: ['performance', 'dom', 'layout'],
      });
    }

    return issues;
  }

  /**
   * Check for async operation issues
   */
  private checkAsyncOperations(
    content: string,
    filePath: string,
    lines: string[]
  ): CodeIssue[] {
    const issues: CodeIssue[] = [];

    for (const pattern of SYNC_OPERATION_PATTERNS) {
      let match;
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);

      while ((match = regex.exec(content)) !== null) {
        const lineNum = this.getLineNumber(content, match.index);

        issues.push({
          id: `perf-${pattern.type}-${lineNum}`,
          severity: 'medium',
          category: 'performance',
          rule: 'sync-operation',
          message: pattern.description,
          description: pattern.description,
          file: filePath,
          line: lineNum,
          code: lines[lineNum - 1]?.trim(),
          suggestion: pattern.suggestion,
          confidence: 0.9,
          tags: ['performance', 'async', 'nodejs'],
        });
      }
    }

    // Check for missing await
    const missingAwaitPattern = /(?:const|let|var)\s+\w+\s*=\s*(?!await)(\w+)\.(?:then|catch)\s*\(/gi;
    let match;
    while ((match = missingAwaitPattern.exec(content)) !== null) {
      const lineNum = this.getLineNumber(content, match.index);

      issues.push({
        id: `perf-missing-await-${lineNum}`,
        severity: 'info',
        category: 'performance',
        rule: 'missing-await',
        message: 'Promise returned without await',
        description: 'Missing await can lead to unhandled promise rejections',
        file: filePath,
        line: lineNum,
        code: lines[lineNum - 1]?.trim(),
        suggestion: 'Add await before the promise',
        confidence: 0.6,
        tags: ['performance', 'async'],
      });
    }

    // Check for sequential async operations in loop
    const sequentialAsyncPattern = /for\s*(?:await|)\s*\([^)]+\)\s*\{[^}]*await\s+\w+\s*\(/gi;
    while ((match = sequentialAsyncPattern.exec(content)) !== null) {
      const lineNum = this.getLineNumber(content, match.index);
      const loopContent = content.substring(match.index, Math.min(content.length, match.index + 500));

      if (!loopContent.includes('Promise.all')) {
        issues.push({
          id: `perf-sequential-async-${lineNum}`,
          severity: 'medium',
          category: 'performance',
          rule: 'sequential-async-in-loop',
          message: 'Sequential async operations in loop',
          description: 'Sequential async operations in loop are slower than parallel',
          file: filePath,
          line: lineNum,
          code: lines[lineNum - 1]?.trim(),
          suggestion: 'Use Promise.all() or Promise.allSettled() for parallel execution',
          confidence: 0.75,
          tags: ['performance', 'async', 'parallelism'],
        });
      }
    }

    return issues;
  }

  /**
   * Generate performance profile
   */
  private generateProfile(
    content: string,
    filePath: string,
    issues: CodeIssue[]
  ): PerformanceProfile {
    const lines = content.split('\n');

    // Estimate execution time based on complexity
    let complexityScore = 0;
    for (const issue of issues) {
      if (issue.tags?.includes('complexity')) {
        complexityScore += 5;
      } else if (issue.tags?.includes('n-plus-one')) {
        complexityScore += 10;
      } else if (issue.tags?.includes('memory-leak')) {
        complexityScore += 7;
      }
    }

    const estimatedExecutionTime = Math.min(1000, complexityScore * 10);
    const memoryUsageEstimate = Math.min(100, complexityScore * 2);

    // Calculate score (0-100)
    const score = Math.max(0, 100 - (issues.length * 5) - complexityScore);

    // Identify bottlenecks
    const bottlenecks = issues
      .filter(i => i.severity === 'high' || i.severity === 'critical')
      .map(i => ({
        id: i.id,
        severity: i.severity,
        category: i.category as PerformanceIssue['category'],
        title: i.message,
        description: i.description,
        file: i.file,
        line: i.line,
        impact: `${i.severity} impact on performance`,
        optimization: i.suggestion || 'Review and optimize',
      }));

    // Generate optimizations
    const optimizations: string[] = [];
    if (issues.some(i => i.tags?.includes('n-plus-one'))) {
      optimizations.push('Use batch operations or joins to avoid N+1 queries');
    }
    if (issues.some(i => i.tags?.includes('memory-leak'))) {
      optimizations.push('Add cleanup for timers, event listeners, and subscriptions');
    }
    if (issues.some(i => i.tags?.includes('complexity'))) {
      optimizations.push('Optimize algorithms and use appropriate data structures');
    }
    if (issues.some(i => i.tags?.includes('dom'))) {
      optimizations.push('Batch DOM updates and minimize reflows/repaints');
    }
    if (issues.some(i => i.tags?.includes('async'))) {
      optimizations.push('Use async operations and parallelize when possible');
    }

    return {
      file: filePath,
      executionTime: estimatedExecutionTime,
      memoryUsage: memoryUsageEstimate,
      cpuUsage: Math.min(100, complexityScore * 3),
      ioOperations: issues.filter(i => i.tags?.includes('n-plus-one')).length,
      networkRequests: issues.filter(i => i.tags?.includes('n-plus-one')).length,
      bottlenecks,
      optimizations,
      score,
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
// Factory Function
// ============================================================================

/**
 * Create a performance analyzer instance
 */
export function createPerformanceAnalyzer(
  config?: Partial<PerformanceAnalyzerConfig>
): PerformanceAnalyzer {
  return new PerformanceAnalyzer(config);
}
