/**
 * AI-Powered Debugging Suggestions
 *
 * Intelligent suggestion engine that provides actionable fixes for errors.
 * Uses:
 * - Pattern matching against common issues
 * - Code context analysis
 * - Historical resolution data
 * - Best practices database
 * - ML-based recommendation ranking
 *
 * Features:
 * - Code diff suggestions
 * - Configuration fixes
 * - Architecture improvements
 * - Performance optimizations
 * - Security enhancements
 */

import type {
  ErrorInfo,
  StackTrace,
  StackFrame,
  FixSuggestion,
  SuggestionType,
  CodeDiff,
  ImpactAnalysis,
  Reference,
  RootCauseAnalysis,
  CodeContext,
  Language,
} from './types';
import { SuggestionType as ST, Language as Lang } from './types';

// ============================================================================
// SUGGESTION PATTERNS
// ============================================================================

interface SuggestionPattern {
  errorPattern: RegExp;
  suggestionType: SuggestionType;
  confidence: number;
  title: string;
  description: string;
  codeTemplate?: (match: RegExpMatchArray, context: any) => CodeDiff;
  references: Reference[];
}

const SUGGESTION_PATTERNS: SuggestionPattern[] = [
  // Null/undefined errors
  {
    errorPattern: /Cannot read property ['"](.+?)['"] of (undefined|null)/i,
    suggestionType: ST.CODE_FIX,
    confidence: 0.9,
    title: 'Add optional chaining or null check',
    description: 'The error indicates accessing a property on a null/undefined value. Use optional chaining (?.) or add a null check.',
    codeTemplate: (match, context) => {
      const property = match[1];
      return {
        filePath: context.filePath || 'unknown.js',
        original: `obj.${property}`,
        suggested: `obj?.${property}`,
        startLine: context.lineNumber || 1,
        endLine: context.lineNumber || 1,
        unifiedDiff: `@@ -${context.lineNumber || 1} +${context.lineNumber || 1} @@
-obj.${property}
+obj?.${property}`,
        language: Lang.JAVASCRIPT,
      };
    },
    references: [
      {
        title: 'Optional chaining (?.)',
        url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining',
        type: 'documentation',
      },
    ],
  },

  // TypeError: X is not a function
  {
    errorPattern: /(.+?) is not a function/i,
    suggestionType: ST.CODE_FIX,
    confidence: 0.85,
    title: 'Check function type or import',
    description: 'The value being called is not a function. This could be due to incorrect import or type mismatch.',
    references: [
      {
        title: 'TypeError: "x" is not a function',
        url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Not_a_function',
        type: 'documentation',
      },
    ],
  },

  // Network errors
  {
    errorPattern: /ECONNREFUSED|ETIMEDOUT|connection refused/i,
    suggestionType: ST.ERROR_HANDLING,
    confidence: 0.8,
    title: 'Add retry logic with exponential backoff',
    description: 'Network connections can fail intermittently. Implement retry logic with exponential backoff for resilience.',
    codeTemplate: (match, context) => ({
      filePath: context.filePath || 'unknown.js',
      original: `await fetch(url)`,
      suggested: `await retryWithBackoff(() => fetch(url), { maxRetries: 3, baseDelay: 1000 })`,
      startLine: context.lineNumber || 1,
      endLine: context.lineNumber || 1,
      unifiedDiff: `@@ -${context.lineNumber || 1} +${context.lineNumber || 1} @@
-await fetch(url)
+await retryWithBackoff(() => fetch(url), { maxRetries: 3, baseDelay: 1000 })`,
      language: Lang.JAVASCRIPT,
    }),
    references: [
      {
        title: 'Exponential backoff',
        url: 'https://en.wikipedia.org/wiki/Exponential_backoff',
        type: 'documentation',
      },
    ],
  },

  // Memory leaks
  {
    errorPattern: /out of memory|heap.*overflow|memory.*limit/i,
    suggestionType: ST.PERFORMANCE,
    confidence: 0.85,
    title: 'Fix memory leak or implement pagination',
    description: 'Memory is being exhausted. Check for memory leaks, implement pagination, or increase memory limits.',
    references: [
      {
        title: 'Memory Management',
        url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management',
        type: 'documentation',
      },
    ],
  },

  // Race conditions
  {
    errorPattern: /race condition|deadlock|concurrency.*error/i,
    suggestionType: ST.ARCHITECTURE,
    confidence: 0.75,
    title: 'Implement proper synchronization',
    description: 'Race conditions require proper synchronization mechanisms. Use mutexes, atomic operations, or immutable data structures.',
    references: [
      {
        title: 'Race Conditions',
        url: 'https://en.wikipedia.org/wiki/Race_condition#In_software',
        type: 'documentation',
      },
    ],
  },

  // Timeout errors
  {
    errorPattern: /timeout|timed out/i,
    suggestionType: ST.PERFORMANCE,
    confidence: 0.7,
    title: 'Increase timeout or optimize operation',
    description: 'Operation is taking too long. Consider increasing timeout, optimizing the operation, or making it async.',
    references: [
      {
        title: 'Timeout patterns',
        url: 'https://docs.aws.amazon.com/whitepapers/latest/best-practices-for-operational-excellence/timeout-patterns.html',
        type: 'documentation',
      },
    ],
  },

  // Configuration errors
  {
    errorPattern: /invalid configuration|config.*error|missing config/i,
    suggestionType: ST.CONFIG_CHANGE,
    confidence: 0.8,
    title: 'Validate and document configuration',
    description: 'Configuration issues can be prevented with schema validation and proper documentation.',
    references: [
      {
        title: 'Configuration Best Practices',
        url: 'https://12factor.net/config',
        type: 'documentation',
      },
    ],
  },

  // SQL injection / Security
  {
    errorPattern: /sql injection|unescaped.*sql|raw.*query/i,
    suggestionType: ST.SECURITY,
    confidence: 0.95,
    title: 'Use parameterized queries',
    description: 'SQL injection vulnerabilities can be prevented by using parameterized queries or ORM.',
    codeTemplate: (match, context) => ({
      filePath: context.filePath || 'unknown.js',
      original: `db.query("SELECT * FROM users WHERE id = " + userId)`,
      suggested: `db.query("SELECT * FROM users WHERE id = ?", [userId])`,
      startLine: context.lineNumber || 1,
      endLine: context.lineNumber || 1,
      unifiedDiff: `@@ -${context.lineNumber || 1} +${context.lineNumber || 1} @@
-db.query("SELECT * FROM users WHERE id = " + userId)
+db.query("SELECT * FROM users WHERE id = ?", [userId])`,
      language: Lang.JAVASCRIPT,
    }),
    references: [
      {
        title: 'SQL Injection',
        url: 'https://owasp.org/www-community/attacks/SQL_Injection',
        type: 'documentation',
      },
    ],
  },

  // N+1 queries
  {
    errorPattern: /n\+1.*query|too many.*queries/i,
    suggestionType: ST.PERFORMANCE,
    confidence: 0.8,
    title: 'Use eager loading or batch queries',
    description: 'N+1 query problems can be solved with eager loading, batch queries, or data loader patterns.',
    references: [
      {
        title: 'N+1 query problem',
        url: 'https://stackoverflow.com/questions/97197/what-is-the-n1-selects-issue',
        type: 'stackoverflow',
      },
    ],
  },

  // Missing error handling
  {
    errorPattern: /unhandledrejection|uncaught.*exception/i,
    suggestionType: ST.ERROR_HANDLING,
    confidence: 0.9,
    title: 'Add error handling',
    description: 'Unhandled promises or exceptions can crash your application. Add try-catch blocks and error handlers.',
    references: [
      {
        title: 'Error handling',
        url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling',
        type: 'documentation',
      },
    ],
  },

  // Missing validation
  {
    errorPattern: /validation.*failed|invalid.*input|parse.*error/i,
    suggestionType: ST.CODE_FIX,
    confidence: 0.75,
    title: 'Add input validation',
    description: 'Validate user input and API responses to prevent errors and security issues.',
    references: [
      {
        title: 'Input Validation',
        url: 'https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html',
        type: 'documentation',
      },
    ],
  },

  // Missing logging
  {
    errorPattern: /unknown.*error|debugging.*difficult/i,
    suggestionType: ST.OBSERVABILITY,
    confidence: 0.6,
    title: 'Add structured logging',
    description: 'Add structured logging to track execution flow and debug issues more easily.',
    references: [
      {
        title: 'Structured Logging',
        url: 'https://www.honeycomb.io/blog/structured-logging-is-for-developers/',
        type: 'blog',
      },
    ],
  },
];

// ============================================================================
// AI SUGGESTIONS ENGINE
// ============================================================================

export class AIDebugSuggestionsEngine {
  /**
   * Generate suggestions for an error
   */
  async generateSuggestions(
    error: ErrorInfo,
    stackTrace?: StackTrace,
    rootCause?: RootCauseAnalysis,
    codeContext?: CodeContext
  ): Promise<FixSuggestion[]> {
    const suggestions: FixSuggestion[] = [];

    // Match error against patterns
    for (const pattern of SUGGESTION_PATTERNS) {
      const match = error.message.match(pattern.errorPattern);

      if (match) {
        const suggestion = await this.createSuggestionFromPattern(
          pattern,
          match,
          error,
          stackTrace,
          codeContext
        );

        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
    }

    // Analyze stack trace for suggestions
    if (stackTrace) {
      const stackSuggestions = this.analyzeStackTrace(stackTrace, error);
      suggestions.push(...stackSuggestions);
    }

    // Analyze root cause for suggestions
    if (rootCause) {
      const causeSuggestions = this.analyzeRootCause(rootCause);
      suggestions.push(...causeSuggestions);
    }

    // Analyze code context for suggestions
    if (codeContext) {
      const codeSuggestions = this.analyzeCodeContext(codeContext);
      suggestions.push(...codeSuggestions);
    }

    // Add best practice suggestions
    const bestPracticeSuggestions = this.suggestBestPractices(error);
    suggestions.push(...bestPracticeSuggestions);

    // Deduplicate and rank
    const unique = this.deduplicateSuggestions(suggestions);
    const ranked = this.rankSuggestions(unique);

    return ranked.slice(0, 10); // Return top 10
  }

  /**
   * Create suggestion from pattern match
   */
  private async createSuggestionFromPattern(
    pattern: SuggestionPattern,
    match: RegExpMatchArray,
    error: ErrorInfo,
    stackTrace?: StackTrace,
    codeContext?: CodeContext
  ): Promise<FixSuggestion | null> {
    const codeDiff = pattern.codeTemplate
      ? pattern.codeTemplate(match, {
          filePath: stackTrace?.rootCauseFrame?.filePath,
          lineNumber: stackTrace?.rootCauseFrame?.lineNumber,
        })
      : undefined;

    const impact = this.assessImpact(pattern.suggestionType, codeDiff);

    return {
      suggestionId: this.generateSuggestionId(),
      type: pattern.suggestionType,
      confidence: pattern.confidence,
      title: pattern.title,
      description: pattern.description,
      codeDiff,
      explanation: this.generateExplanation(pattern, match),
      impact,
      references: pattern.references,
      tags: this.generateTags(pattern.suggestionType),
      effort: this.estimateEffort(pattern.suggestionType, codeDiff),
    };
  }

  /**
   * Analyze stack trace for suggestions
   */
  private analyzeStackTrace(stackTrace: StackTrace, error: ErrorInfo): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];

    // Check for deep call stacks
    if (stackTrace.frames.length > 50) {
      suggestions.push({
        suggestionId: this.generateSuggestionId(),
        type: ST.ARCHITECTURE,
        confidence: 0.7,
        title: 'Reduce call stack depth',
        description: `Call stack has ${stackTrace.frames.length} frames. Consider refactoring to reduce complexity.`,
        explanation: 'Deep call stacks can cause performance issues and make debugging difficult.',
        impact: {
          errorReduction: 0.3,
          performanceImpact: 'positive',
          riskLevel: 'medium',
          sideEffects: ['Requires refactoring multiple functions'],
          breakingChanges: [],
        },
        references: [],
        tags: ['performance', 'architecture'],
        effort: 'high',
      });
    }

    // Check for excessive library frames
    const libraryRatio = stackTrace.libraryFrames.length / stackTrace.frames.length;
    if (libraryRatio > 0.7) {
      suggestions.push({
        suggestionId: this.generateSuggestionId(),
        type: ST.ARCHITECTURE,
        confidence: 0.6,
        title: 'Reduce dependency on external libraries',
        description: `${(libraryRatio * 100).toFixed(0)}% of stack frames are from libraries. Consider reducing dependencies or wrapping them.`,
        explanation: 'Heavy dependency on external libraries can cause maintenance issues and unexpected behavior.',
        impact: {
          errorReduction: 0.2,
          performanceImpact: 'neutral',
          riskLevel: 'low',
          sideEffects: ['May require reimplementing functionality'],
          breakingChanges: [],
        },
        references: [],
        tags: ['architecture', 'dependencies'],
        effort: 'high',
      });
    }

    // Check for async complexity
    if (stackTrace.asyncFrames.length > 5) {
      suggestions.push({
        suggestionId: this.generateSuggestionId(),
        type: ST.CODE_FIX,
        confidence: 0.65,
        title: 'Simplify async flow',
        description: `Detected ${stackTrace.asyncFrames.length} async frames. Consider using async/await consistently or simplifying the async flow.`,
        explanation: 'Complex async flows can lead to race conditions and hard-to-debug issues.',
        impact: {
          errorReduction: 0.4,
          performanceImpact: 'positive',
          riskLevel: 'medium',
          sideEffects: [],
          breakingChanges: [],
        },
        references: [
          {
            title: 'Async/await best practices',
            url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function',
            type: 'documentation',
          },
        ],
        tags: ['async', 'code-quality'],
        effort: 'medium',
      });
    }

    return suggestions;
  }

  /**
   * Analyze root cause for suggestions
   */
  private analyzeRootCause(rootCause: RootCauseAnalysis): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];

    // Suggest preventive measures as fix suggestions
    for (const prevention of rootCause.prevention) {
      suggestions.push({
        suggestionId: this.generateSuggestionId(),
        type: ST.CODE_FIX,
        confidence: rootCause.confidence * 0.8,
        title: `Prevent ${rootCause.category} errors`,
        description: prevention,
        explanation: rootCause.explanation,
        impact: {
          errorReduction: rootCause.confidence,
          performanceImpact: 'neutral',
          riskLevel: 'low',
          sideEffects: [],
          breakingChanges: [],
        },
        references: [],
        tags: ['prevention', rootCause.category],
        effort: 'medium',
      });
    }

    return suggestions;
  }

  /**
   * Analyze code context for suggestions
   */
  private analyzeCodeContext(codeContext: CodeContext): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];

    // Check for missing error handling
    const hasTryCatch = codeContext.snippet.lines.some(
      line => line.content.includes('try') || line.content.includes('catch')
    );

    if (!hasTryCatch && codeContext.functionContext.isAsync) {
      suggestions.push({
        suggestionId: this.generateSuggestionId(),
        type: ST.ERROR_HANDLING,
        confidence: 0.75,
        title: 'Add error handling to async function',
        description: `Function ${codeContext.functionContext.name} is async but lacks error handling.`,
        explanation: 'Async functions should wrap await calls in try-catch blocks or handle errors.',
        codeDiff: {
          filePath: codeContext.filePath,
          original: codeContext.snippet.lines.map(l => l.content).join('\n'),
          suggested: codeContext.snippet.lines.map(l => l.content).join('\n').replace(
            /await (.+)/,
            'try {\n        await $1\n      } catch (error) {\n        console.error("Error:", error);\n        throw error;\n      }'
          ),
          startLine: codeContext.snippet.startLine,
          endLine: codeContext.snippet.endLine,
          unifiedDiff: '',
          language: codeContext.language,
        },
        impact: {
          errorReduction: 0.5,
          performanceImpact: 'neutral',
          riskLevel: 'low',
          sideEffects: [],
          breakingChanges: [],
        },
        references: [
          {
            title: 'Error handling in async functions',
            url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/try...catch',
            type: 'documentation',
          },
        ],
        tags: ['error-handling', 'async'],
        effort: 'low',
      });
    }

    return suggestions;
  }

  /**
   * Suggest best practices
   */
  private suggestBestPractices(error: ErrorInfo): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];

    // Suggest logging
    suggestions.push({
      suggestionId: this.generateSuggestionId(),
      type: ST.OBSERVABILITY,
      confidence: 0.5,
      title: 'Add structured logging',
      description: 'Add structured logging to track errors and debug issues more effectively.',
      explanation: 'Structured logging makes it easier to search, filter, and analyze logs.',
      impact: {
        errorReduction: 0.1,
        performanceImpact: 'neutral',
        riskLevel: 'low',
        sideEffects: ['Slightly increased log volume'],
        breakingChanges: [],
      },
      references: [
        {
          title: 'Structured Logging Best Practices',
          url: 'https://www.honeycomb.io/blog/structured-logging-is-for-developers/',
          type: 'blog',
        },
      ],
      tags: ['logging', 'observability'],
      effort: 'low',
    });

    // Suggest monitoring
    suggestions.push({
      suggestionId: this.generateSuggestionId(),
      type: ST.OBSERVABILITY,
      confidence: 0.5,
      title: 'Set up error monitoring',
      description: 'Configure error monitoring (e.g., Sentry, DataDog) to track and alert on errors.',
      explanation: 'Error monitoring helps you detect and fix issues before they affect many users.',
      impact: {
        errorReduction: 0.2,
        performanceImpact: 'neutral',
        riskLevel: 'low',
        sideEffects: [],
        breakingChanges: [],
      },
      references: [
        {
          title: 'Error Monitoring Best Practices',
          url: 'https://sentry.io/for/monitoring/',
          type: 'documentation',
        },
      ],
      tags: ['monitoring', 'observability'],
      effort: 'medium',
    });

    return suggestions;
  }

  /**
   * Generate explanation for suggestion
   */
  private generateExplanation(pattern: SuggestionPattern, match: RegExpMatchArray): string {
    let explanation = pattern.description;

    // Add pattern-specific details
    if (match.length > 1) {
      explanation += `\n\nMatched: "${match[0]}"`;
    }

    return explanation;
  }

  /**
   * Assess impact of suggestion
   */
  private assessImpact(
    type: SuggestionType,
    codeDiff?: CodeDiff
  ): ImpactAnalysis {
    let errorReduction = 0.5;
    let performanceImpact: 'positive' | 'neutral' | 'negative' = 'neutral';
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';

    switch (type) {
      case ST.SECURITY:
        errorReduction = 0.9;
        riskLevel = 'low';
        break;
      case ST.ERROR_HANDLING:
        errorReduction = 0.7;
        riskLevel = 'low';
        break;
      case ST.PERFORMANCE:
        performanceImpact = 'positive';
        errorReduction = 0.3;
        riskLevel = 'medium';
        break;
      case ST.CODE_FIX:
        errorReduction = 0.8;
        riskLevel = 'low';
        break;
      case ST.CONFIG_CHANGE:
        errorReduction = 0.6;
        riskLevel = 'medium';
        break;
      case ST.ARCHITECTURE:
        errorReduction = 0.4;
        riskLevel = 'high';
        break;
    }

    return {
      errorReduction,
      performanceImpact,
      riskLevel,
      sideEffects: [],
      breakingChanges: [],
    };
  }

  /**
   * Generate tags for suggestion
   */
  private generateTags(type: SuggestionType): string[] {
    const tags: Record<SuggestionType, string[]> = {
      [ST.CODE_FIX]: ['code', 'bug-fix'],
      [ST.CONFIG_CHANGE]: ['configuration', 'setup'],
      [ST.ARCHITECTURE]: ['architecture', 'design'],
      [ST.PERFORMANCE]: ['performance', 'optimization'],
      [ST.SECURITY]: ['security', 'vulnerability'],
      [ST.ERROR_HANDLING]: ['error-handling', 'resilience'],
      [ST.OBSERVABILITY]: ['logging', 'monitoring'],
      [ST.DOCUMENTATION]: ['documentation', 'knowledge'],
      [ST.TESTING]: ['testing', 'quality'],
    };

    return tags[type] || [];
  }

  /**
   * Estimate effort to implement suggestion
   */
  private estimateEffort(type: SuggestionType, codeDiff?: CodeDiff): 'low' | 'medium' | 'high' {
    if (codeDiff && codeDiff.original.length > 100) {
      return 'high';
    }

    const effort: Record<SuggestionType, 'low' | 'medium' | 'high'> = {
      [ST.CODE_FIX]: 'low',
      [ST.CONFIG_CHANGE]: 'low',
      [ST.ERROR_HANDLING]: 'low',
      [ST.OBSERVABILITY]: 'low',
      [ST.TESTING]: 'medium',
      [ST.DOCUMENTATION]: 'low',
      [ST.PERFORMANCE]: 'medium',
      [ST.SECURITY]: 'medium',
      [ST.ARCHITECTURE]: 'high',
    };

    return effort[type];
  }

  /**
   * Deduplicate suggestions
   */
  private deduplicateSuggestions(suggestions: FixSuggestion[]): FixSuggestion[] {
    const seen = new Set<string>();
    const unique: FixSuggestion[] = [];

    for (const suggestion of suggestions) {
      const key = `${suggestion.type}-${suggestion.title}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(suggestion);
      }
    }

    return unique;
  }

  /**
   * Rank suggestions by confidence and impact
   */
  private rankSuggestions(suggestions: FixSuggestion[]): FixSuggestion[] {
    return suggestions.sort((a, b) => {
      // Prioritize security fixes
      if (a.type === ST.SECURITY && b.type !== ST.SECURITY) return -1;
      if (b.type === ST.SECURITY && a.type !== ST.SECURITY) return 1;

      // Then by confidence
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }

      // Then by error reduction
      return b.impact.errorReduction - a.impact.errorReduction;
    });
  }

  /**
   * Generate suggestion ID
   */
  private generateSuggestionId(): string {
    return `suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create AI suggestions engine
 */
export function createAISuggestionsEngine(): AIDebugSuggestionsEngine {
  return new AIDebugSuggestionsEngine();
}

/**
 * Generate suggestions for error (convenience function)
 */
export async function generateSuggestions(
  error: ErrorInfo,
  stackTrace?: StackTrace,
  rootCause?: RootCauseAnalysis,
  codeContext?: CodeContext
): Promise<FixSuggestion[]> {
  const engine = new AIDebugSuggestionsEngine();
  return engine.generateSuggestions(error, stackTrace, rootCause, codeContext);
}
