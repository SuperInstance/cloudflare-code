/**
 * Intelligent Debugging and Troubleshooting System
 *
 * Comprehensive debugging system for ClaudeFlare platform providing:
 * - Error root cause analysis
 * - Stack trace interpretation (20+ languages)
 * - Log analysis and correlation
 * - Performance bottleneck detection
 * - AI-powered debugging suggestions
 * - Interactive debugging sessions
 *
 * @example
 * ```typescript
 * import { createErrorAnalyzer, parseStackTrace, correlateLogs } from './debug';
 *
 * // Analyze an error
 * const analyzer = createErrorAnalyzer();
 * const analysis = await analyzer.analyze({
 *   error: errorInfo,
 *   stackTrace: stackTraceString,
 *   options: { includeStackTrace: true }
 * });
 *
 * // Parse stack trace
 * const parser = new StackTraceParser();
 * const result = parser.parse(stackTraceString);
 *
 * // Correlate logs
 * const correlator = createLogCorrelationEngine();
 * const correlatedLogs = await correlator.correlateErrorLogs(error, logs);
 * ```
 */

// Type definitions
export * from './types';

// Stack trace parser
export {
  StackTraceParser,
  createStackTraceParser,
  parseStackTrace,
  parseStackTraceWithSource,
} from './stack-trace';

// Error analyzer
export {
  ErrorAnalyzer,
  createErrorAnalyzer,
  analyzeError,
} from './analyzer';

// Log correlation
export {
  LogCorrelationEngine,
  LogAggregator,
  createLogCorrelationEngine,
  correlateLogs,
  reconstructLogTimeline,
  correlateCrossServiceLogs,
} from './logs';

// Debug session DO
export {
  DebugSessionDO,
  DebugSessionDOState,
  DebugSessionManager,
  createDebugSessionManager,
} from './session';

// AI suggestions
export {
  AIDebugSuggestionsEngine,
  createAISuggestionsEngine,
  generateSuggestions,
} from './suggestions';

// Performance analysis
export {
  PerformanceAnalyzer,
  AnomalyDetector,
  createPerformanceAnalyzer,
  createAnomalyDetector,
  detectAnomalies,
} from './performance';

// Re-export commonly used types
export type {
  ErrorInfo,
  StackTrace,
  StackFrame,
  CorrelatedLog,
  LogTimeline,
  DebugSession,
  RootCauseAnalysis,
  FixSuggestion,
  PerformanceAnalysis,
  MetricSnapshot,
  AnalyzeErrorResponse,
} from './types';
