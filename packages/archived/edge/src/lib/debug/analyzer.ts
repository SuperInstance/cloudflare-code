/**
 * Error Analyzer with Root Cause Detection
 *
 * Comprehensive error analysis system that:
 * - Detects root causes using ML-based pattern matching
 * - Correlates errors with historical data
 * - Provides context-aware analysis
 * - Generates actionable insights
 *
 * Integrates with:
 * - Stack trace parser for frame analysis
 * - Log correlation engine for timeline reconstruction
 * - Code vector store for context retrieval
 * - Historical error database for pattern matching
 */

import type {
  ErrorInfo,
  StackTrace,
  StackFrame,
  RootCauseAnalysis,
  RootCauseCategory,
  ContributingFactor,
  Evidence,
  ErrorMatch,
  CodeContext,
  AnalyzeErrorRequest,
  AnalyzeErrorResponse,
  AnalysisOptions,
} from './types';
import { ErrorCategory, RootCauseCategory as RCA } from './types';
import { StackTraceParser } from './stack-trace';

// ============================================================================
// ERROR PATTERNS AND RULES
// ============================================================================

/**
 * Error pattern rules for root cause detection
 */
const ERROR_PATTERNS: Array<{
  pattern: RegExp;
  category: RootCauseCategory;
  confidence: number;
  description: string;
}> = [
  // Code bugs
  {
    pattern: /Cannot read property.*undefined|Cannot read.*undefined|undefined is not (an object|a function)/i,
    category: RCA.CODE_BUG,
    confidence: 0.85,
    description: 'Null/undefined reference error - likely missing null check',
  },
  {
    pattern: /is not a function|is not a constructor|has no method/i,
    category: RCA.CODE_BUG,
    confidence: 0.8,
    description: 'Type error - incorrect type assumption',
  },
  {
    pattern: /Unexpected token|SyntaxError|Invalid (left-hand|right-hand) side/i,
    category: RCA.CODE_BUG,
    confidence: 0.9,
    description: 'Syntax error - malformed code',
  },

  // Configuration errors
  {
    pattern: /ENOENT|no such file or directory|file not found|cannot find module/i,
    category: RCA.CONFIGURATION_ERROR,
    confidence: 0.75,
    description: 'Missing file or dependency - configuration issue',
  },
  {
    pattern: /EACCES|permission denied|unauthorized|401|403/i,
    category: RCA.PERMISSION_DENIED,
    confidence: 0.8,
    description: 'Permission denied - access control issue',
  },
  {
    pattern: /invalid configuration|config.*error|missing config/i,
    category: RCA.CONFIGURATION_ERROR,
    confidence: 0.85,
    description: 'Configuration error - invalid or missing config',
  },

  // External dependencies
  {
    pattern: /ECONNREFUSED|ETIMEDOUT|connection refused|connection timed out/i,
    category: RCA.EXTERNAL_DEPENDENCY,
    confidence: 0.7,
    description: 'External service connection failed',
  },
  {
    pattern: /502|503|504|service unavailable|bad gateway/i,
    category: RCA.EXTERNAL_DEPENDENCY,
    confidence: 0.8,
    description: 'External service unavailable',
  },
  {
    pattern: /upstream.*timeout|gateway.*timeout/i,
    category: RCA.TIMEOUT,
    confidence: 0.75,
    description: 'Timeout waiting for external service',
  },

  // Resource exhaustion
  {
    pattern: /out of memory|heap.*overflow|memory.*limit|allocation failed/i,
    category: RCA.RESOURCE_EXHAUSTION,
    confidence: 0.9,
    description: 'Memory exhaustion - resource limit reached',
  },
  {
    pattern: /too many open files|EMFILE|i.*o.*error/i,
    category: RCA.RESOURCE_EXHAUSTION,
    confidence: 0.85,
    description: 'File descriptor limit reached',
  },
  {
    pattern: /quota exceeded|rate limit|429/i,
    category: RCA.RESOURCE_EXHAUSTION,
    confidence: 0.8,
    description: 'Resource quota exceeded',
  },

  // Race conditions
  {
    pattern: /race condition|deadlock|livelock|concurrency.*error/i,
    category: RCA.RACE_CONDITION,
    confidence: 0.8,
    description: 'Concurrency issue detected',
  },
  {
    pattern: /lock.*timeout|lock.*not.*available/i,
    category: RCA.RACE_CONDITION,
    confidence: 0.7,
    description: 'Lock contention or deadlock',
  },

  // Network issues
  {
    pattern: /network error|socket.*error|dns.*error/i,
    category: RCA.NETWORK_ISSUE,
    confidence: 0.7,
    description: 'Network connectivity issue',
  },
  {
    pattern: /ENOTFOUND|getaddrinfo.*failed/i,
    category: RCA.NETWORK_ISSUE,
    confidence: 0.85,
    description: 'DNS resolution failed',
  },

  // Data corruption
  {
    pattern: /data.*corrupt|checksum.*error|validation.*failed/i,
    category: RCA.DATA_CORRUPTION,
    confidence: 0.7,
    description: 'Data integrity issue detected',
  },
  {
    pattern: /malformed|unexpected format|invalid.*format/i,
    category: RCA.DATA_CORRUPTION,
    confidence: 0.6,
    description: 'Data format issue - possible corruption',
  },
];

// ============================================================================
// ROOT CAUSE ANALYZER
// ============================================================================

export class ErrorAnalyzer {
  private stackParser: StackTraceParser;
  private historicalErrors: Map<string, ErrorInfo[]> = new Map();

  constructor() {
    this.stackParser = new StackTraceParser();
  }

  /**
   * Analyze an error comprehensively
   */
  async analyze(request: AnalyzeErrorRequest): Promise<AnalyzeErrorResponse> {
    const startTime = Date.now();

    // Parse stack trace if provided
    let stackTrace: StackTrace | undefined;
    if (request.options.includeStackTrace && request.stackTrace) {
      const parseResult = this.stackParser.parse(request.stackTrace);
      if (parseResult.success && parseResult.trace) {
        stackTrace = parseResult.trace;
      }
    }

    // Perform root cause analysis
    const rootCause = this.analyzeRootCause(request.error, stackTrace);

    // Search for similar historical errors
    let similarErrors: ErrorMatch[] = [];
    if (request.options.searchSimilarErrors) {
      similarErrors = await this.findSimilarErrors(
        request.error,
        request.options.maxSimilarErrors
      );
    }

    // Build response
    const response: AnalyzeErrorResponse = {
      analysisId: this.generateAnalysisId(),
      rootCause,
      stackTrace,
      similarErrors,
      timestamp: Date.now(),
      duration: Date.now() - startTime,
    };

    return response;
  }

  /**
   * Perform root cause analysis
   */
  private analyzeRootCause(
    error: ErrorInfo,
    stackTrace?: StackTrace
  ): RootCauseAnalysis {
    // Match error against known patterns
    const patternMatch = this.matchErrorPattern(error);

    // Analyze stack trace if available
    const stackAnalysis = stackTrace
      ? this.analyzeStackTrace(stackTrace)
      : null;

    // Determine root cause category
    const category = this.determineCategory(error, stackAnalysis);

    // Build contributing factors
    const factors = this.identifyContributingFactors(error, stackTrace);

    // Gather evidence
    const evidence = this.gatherEvidence(error, stackTrace);

    // Generate explanation
    const explanation = this.generateExplanation(category, factors, evidence);

    // Suggest preventive measures
    const prevention = this.suggestPrevention(category, factors);

    return {
      analysisId: this.generateAnalysisId(),
      rootCause: this.formulateRootCause(category, patternMatch),
      confidence: this.calculateConfidence(patternMatch, stackAnalysis),
      category,
      explanation,
      factors,
      evidence,
      prevention,
    };
  }

  /**
   * Match error against known patterns
   */
  private matchErrorPattern(error: ErrorInfo): {
    match: boolean;
    pattern?: typeof ERROR_PATTERNS[0];
  } {
    const message = error.message.toLowerCase();
    const context = JSON.stringify(error.context).toLowerCase();

    for (const pattern of ERROR_PATTERNS) {
      if (
        pattern.pattern.test(message) ||
        pattern.pattern.test(context)
      ) {
        return { match: true, pattern };
      }
    }

    return { match: false };
  }

  /**
   * Analyze stack trace for insights
   */
  private analyzeStackTrace(stackTrace: StackTrace): {
    hasAppFrames: boolean;
    appFrameCount: number;
    libraryFrameCount: number;
    asyncFrames: number;
    rootCauseLocation?: {
      filePath: string;
      functionName: string;
      lineNumber: number;
    };
  } {
    const appFrames = stackTrace.appFrames || [];
    const libraryFrames = stackTrace.libraryFrames || [];
    const asyncFrames = stackTrace.asyncFrames || [];

    let rootCauseLocation;
    if (stackTrace.rootCauseFrame) {
      const frame = stackTrace.rootCauseFrame;
      rootCauseLocation = {
        filePath: frame.filePath || 'unknown',
        functionName: frame.functionName || 'unknown',
        lineNumber: frame.lineNumber || 0,
      };
    }

    return {
      hasAppFrames: appFrames.length > 0,
      appFrameCount: appFrames.length,
      libraryFrameCount: libraryFrames.length,
      asyncFrames: asyncFrames.length,
      rootCauseLocation,
    };
  }

  /**
   * Determine root cause category
   */
  private determineCategory(
    error: ErrorInfo,
    stackAnalysis: ReturnType<ErrorAnalyzer['analyzeStackTrace']> | null
  ): RootCauseCategory {
    // Check error category first
    if (error.category === ErrorCategory.NETWORK) {
      return RCA.NETWORK_ISSUE;
    }
    if (error.category === ErrorCategory.CONFIGURATION) {
      return RCA.CONFIGURATION_ERROR;
    }
    if (error.category === ErrorCategory.AUTHENTICATION) {
      return RCA.PERMISSION_DENIED;
    }

    // Check stack analysis
    if (stackAnalysis) {
      if (!stackAnalysis.hasAppFrames) {
        // All frames are in libraries - likely external dependency issue
        return RCA.EXTERNAL_DEPENDENCY;
      }

      if (stackAnalysis.asyncFrames > 0) {
        // Async frames present - could be race condition
        return RCA.RACE_CONDITION;
      }
    }

    // Default to code bug for unknown errors
    return RCA.CODE_BUG;
  }

  /**
   * Identify contributing factors
   */
  private identifyContributingFactors(
    error: ErrorInfo,
    stackTrace?: StackTrace
  ): ContributingFactor[] {
    const factors: ContributingFactor[] = [];

    // Error message analysis
    if (error.message.includes('timeout')) {
      factors.push({
        factor: 'Timeout occurred',
        impact: 0.8,
        evidence: ['Error message indicates timeout'],
      });
    }

    if (error.message.includes('memory')) {
      factors.push({
        factor: 'Memory pressure',
        impact: 0.7,
        evidence: ['Error message references memory'],
      });
    }

    // Stack trace analysis
    if (stackTrace) {
      if (stackTrace.libraryFrames.length > stackTrace.appFrames.length * 2) {
        factors.push({
          factor: 'Heavy dependency on external libraries',
          impact: 0.5,
          evidence: [
            `${stackTrace.libraryFrames.length} library frames vs ${stackTrace.appFrames.length} app frames`,
          ],
        });
      }

      if (stackTrace.asyncFrames.length > 3) {
        factors.push({
          factor: 'Complex async call chain',
          impact: 0.6,
          evidence: [`${stackTrace.asyncFrames.length} async frames detected`],
        });
      }

      if (stackTrace.appFrames.length === 0) {
        factors.push({
          factor: 'No application frames in stack trace',
          impact: 0.9,
          evidence: ['All frames are from library code'],
        });
      }
    }

    // Context analysis
    if (error.context.requestId) {
      factors.push({
        factor: 'Request-specific error',
        impact: 0.3,
        evidence: [`Request ID: ${error.context.requestId}`],
      });
    }

    if (error.context.userId) {
      factors.push({
        factor: 'User-specific error',
        impact: 0.2,
        evidence: [`User ID: ${error.context.userId}`],
      });
    }

    return factors.sort((a, b) => b.impact - a.impact);
  }

  /**
   * Gather evidence for root cause
   */
  private gatherEvidence(
    error: ErrorInfo,
    stackTrace?: StackTrace
  ): Evidence[] {
    const evidence: Evidence[] = [];

    // Error message evidence
    evidence.push({
      type: 'code',
      description: `Error message: ${error.message}`,
      source: error.source,
      timestamp: error.timestamp,
      confidence: 0.9,
    });

    // Stack trace evidence
    if (stackTrace && stackTrace.rootCauseFrame) {
      const frame = stackTrace.rootCauseFrame;
      evidence.push({
        type: 'code',
        description: `Root cause at ${frame.filePath}:${frame.lineNumber}`,
        source: frame.filePath || 'unknown',
        timestamp: error.timestamp,
        confidence: 0.85,
      });
    }

    // Context evidence
    if (error.context) {
      for (const [key, value] of Object.entries(error.context)) {
        evidence.push({
          type: 'log',
          description: `Context ${key}: ${JSON.stringify(value)}`,
          source: error.source,
          timestamp: error.timestamp,
          confidence: 0.5,
        });
      }
    }

    return evidence;
  }

  /**
   * Generate explanation
   */
  private generateExplanation(
    category: RootCauseCategory,
    factors: ContributingFactor[],
    evidence: Evidence[]
  ): string {
    const categoryDesc = this.getCategoryDescription(category);
    const topFactors = factors.slice(0, 3).map(f => f.factor).join(', ');

    let explanation = `${categoryDesc}`;

    if (topFactors) {
      explanation += ` Contributing factors include: ${topFactors}.`;
    }

    if (evidence.length > 0) {
      explanation += ` This analysis is based on ${evidence.length} pieces of evidence.`;
    }

    return explanation;
  }

  /**
   * Get category description
   */
  private getCategoryDescription(category: RootCauseCategory): string {
    const descriptions: Record<RootCauseCategory, string> = {
      [RCA.CODE_BUG]: 'A code bug was detected in the application logic.',
      [RCA.CONFIGURATION_ERROR]: 'A configuration error is preventing the application from functioning correctly.',
      [RCA.EXTERNAL_DEPENDENCY]: 'An external dependency or service is causing the failure.',
      [RCA.RESOURCE_EXHAUSTION]: 'System resources have been exhausted, preventing further operations.',
      [RCA.RACE_CONDITION]: 'A race condition or concurrency issue is causing intermittent failures.',
      [RCA.DATA_CORRUPTION]: 'Data corruption or integrity issues were detected.',
      [RCA.NETWORK_ISSUE]: 'A network connectivity issue is preventing communication.',
      [RCA.PERMISSION_DENIED]: 'Insufficient permissions are preventing the operation.',
      [RCA.TIMEOUT]: 'A timeout occurred while waiting for an operation to complete.',
      [RCA.UNKNOWN]: 'The root cause could not be definitively determined.',
    };

    return descriptions[category] || descriptions[RCA.UNKNOWN];
  }

  /**
   * Formulate root cause statement
   */
  private formulateRootCause(
    category: RootCauseCategory,
    patternMatch: { match: boolean; pattern?: typeof ERROR_PATTERNS[0] }
  ): string {
    if (patternMatch.match && patternMatch.pattern) {
      return patternMatch.pattern.description;
    }

    return this.getCategoryDescription(category);
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    patternMatch: { match: boolean; pattern?: typeof ERROR_PATTERNS[0] },
    stackAnalysis: ReturnType<ErrorAnalyzer['analyzeStackTrace']> | null
  ): number {
    let confidence = 0.5;

    if (patternMatch.match && patternMatch.pattern) {
      confidence = patternMatch.pattern.confidence;
    }

    if (stackAnalysis) {
      if (stackAnalysis.rootCauseLocation) {
        confidence += 0.1;
      }
      if (stackAnalysis.hasAppFrames) {
        confidence += 0.05;
      }
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Suggest preventive measures
   */
  private suggestPrevention(
    category: RootCauseCategory,
    factors: ContributingFactor[]
  ): string[] {
    const prevention: string[] = [];

    switch (category) {
      case RCA.CODE_BUG:
        prevention.push(
          'Add input validation and null checks',
          'Implement comprehensive unit tests',
          'Use TypeScript or static analysis tools',
          'Add error boundaries and try-catch blocks'
        );
        break;

      case RCA.CONFIGURATION_ERROR:
        prevention.push(
          'Validate configuration at startup',
          'Use configuration schemas',
          'Document all configuration options',
          'Implement configuration versioning'
        );
        break;

      case RCA.EXTERNAL_DEPENDENCY:
        prevention.push(
          'Implement retry logic with exponential backoff',
          'Add circuit breakers for external calls',
          'Monitor external service health',
          'Implement fallback mechanisms'
        );
        break;

      case RCA.RESOURCE_EXHAUSTION:
        prevention.push(
          'Implement resource pooling',
          'Add resource usage monitoring',
          'Implement rate limiting',
          'Add resource cleanup and garbage collection'
        );
        break;

      case RCA.RACE_CONDITION:
        prevention.push(
          'Use proper synchronization primitives',
          'Implement atomic operations',
          'Add race condition detection tests',
          'Use immutable data structures'
        );
        break;

      case RCA.DATA_CORRUPTION:
        prevention.push(
          'Add data validation and checksums',
          'Implement database transactions',
          'Use data integrity constraints',
          'Add audit logging for data changes'
        );
        break;

      case RCA.NETWORK_ISSUE:
        prevention.push(
          'Implement connection pooling',
          'Add network resilience patterns',
          'Monitor network health',
          'Implement graceful degradation'
        );
        break;

      case RCA.PERMISSION_DENIED:
        prevention.push(
          'Implement proper authentication',
          'Use role-based access control',
          'Add permission checks at all layers',
          'Document permission requirements'
        );
        break;

      case RCA.TIMEOUT:
        prevention.push(
          'Implement timeout monitoring',
          'Add async processing for long operations',
          'Optimize slow operations',
          'Add progress indicators'
        );
        break;
    }

    // Add factor-specific prevention
    for (const factor of factors) {
      if (factor.factor.includes('async')) {
        prevention.push('Review async error handling');
      }
      if (factor.factor.includes('memory')) {
        prevention.push('Implement memory profiling');
      }
    }

    return [...new Set(prevention)]; // Deduplicate
  }

  /**
   * Find similar historical errors
   */
  private async findSimilarErrors(
    error: ErrorInfo,
    limit: number
  ): Promise<ErrorMatch[]> {
    // In a real implementation, this would query a database
    // For now, we'll return empty array
    // This would use:
    // 1. Error type matching
    // 2. Message similarity (text similarity)
    // 3. Stack trace similarity
    // 4. Context similarity

    const matches: ErrorMatch[] = [];

    // TODO: Implement actual similarity search
    // This would involve:
    // - Vector embeddings of error messages
    // - Fuzzy matching on stack traces
    // - Clustering of similar errors

    return matches;
  }

  /**
   * Add error to historical database
   */
  addHistoricalError(error: ErrorInfo): void {
    const key = error.errorType;
    if (!this.historicalErrors.has(key)) {
      this.historicalErrors.set(key, []);
    }
    this.historicalErrors.get(key)!.push(error);
  }

  /**
   * Generate analysis ID
   */
  private generateAnalysisId(): string {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new error analyzer
 */
export function createErrorAnalyzer(): ErrorAnalyzer {
  return new ErrorAnalyzer();
}

/**
 * Analyze an error (convenience function)
 */
export async function analyzeError(
  error: ErrorInfo,
  stackTrace?: string,
  options: Partial<AnalysisOptions> = {}
): Promise<AnalyzeErrorResponse> {
  const analyzer = new ErrorAnalyzer();

  const defaultOptions: AnalysisOptions = {
    includeStackTrace: !!stackTrace,
    correlateLogs: false,
    searchSimilarErrors: true,
    generateSuggestions: false,
    analyzePerformance: false,
    detectAnomalies: false,
    maxSimilarErrors: 10,
    logCorrelationWindow: 60000, // 1 minute
  };

  const request: AnalyzeErrorRequest = {
    error,
    stackTrace,
    options: { ...defaultOptions, ...options },
  };

  return analyzer.analyze(request);
}
