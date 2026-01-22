/**
 * Intelligent Debugging System Type Definitions
 *
 * Comprehensive type system for error analysis, stack trace parsing,
 * log correlation, and AI-powered debugging suggestions.
 */

// ============================================================================
// ERROR ANALYSIS TYPES
// ============================================================================

/**
 * Detailed error information for debugging
 */
export interface ErrorInfo {
  /** Unique error identifier */
  errorId: string;
  /** Error type/class name */
  errorType: string;
  /** Error message */
  message: string;
  /** Full error stack trace */
  stackTrace: string;
  /** Error code if available */
  code?: string;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Timestamp when error occurred */
  timestamp: number;
  /** Service/function where error occurred */
  source: string;
  /** Error severity */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Error category */
  category: ErrorCategory;
  /** Request ID if available */
  requestId?: string;
  /** Trace ID for distributed tracing */
  traceId?: string;
  /** User ID if applicable */
  userId?: string;
  /** Additional context */
  context: Record<string, any>;
  /** Whether error is recoverable */
  recoverable: boolean;
  /** Suggested retry delay if applicable */
  retryDelay?: number;
}

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  /** Runtime errors (exceptions, crashes) */
  RUNTIME = 'runtime',
  /** Network errors (timeouts, connection failures) */
  NETWORK = 'network',
  /** Database errors (queries, connections) */
  DATABASE = 'database',
  /** Authentication/authorization errors */
  AUTHENTICATION = 'authentication',
  /** Validation errors (invalid input) */
  VALIDATION = 'validation',
  /** Business logic errors */
  BUSINESS_LOGIC = 'business_logic',
  /** External service errors */
  EXTERNAL_SERVICE = 'external_service',
  /** Configuration errors */
  CONFIGURATION = 'configuration',
  /** Resource exhaustion (memory, disk) */
  RESOURCE_EXHAUSTION = 'resource_exhaustion',
  /** Concurrency errors (race conditions, deadlocks) */
  CONCURRENCY = 'concurrency',
  /** Unknown/unclassified errors */
  UNKNOWN = 'unknown',
}

// ============================================================================
// STACK TRACE TYPES
// ============================================================================

/**
 * Programming language detection
 */
export enum Language {
  JAVASCRIPT = 'javascript',
  TYPESCRIPT = 'typescript',
  PYTHON = 'python',
  JAVA = 'java',
  CSHARP = 'csharp',
  CPP = 'cpp',
  RUST = 'rust',
  GO = 'go',
  RUBY = 'ruby',
  PHP = 'php',
  SWIFT = 'swift',
  KOTLIN = 'kotlin',
  SCALA = 'scala',
  CLOJURE = 'clojure',
  ERLANG = 'erlang',
  ELIXIR = 'elixir',
  LUA = 'lua',
  PERL = 'perl',
  BASH = 'bash',
  POWERSHELL = 'powershell',
  UNKNOWN = 'unknown',
}

/**
 * Parsed stack frame
 */
export interface StackFrame {
  /** Frame index in the stack */
  index: number;
  /** Programming language */
  language: Language;
  /** File path */
  filePath?: string;
  /** Line number */
  lineNumber?: number;
  /** Column number */
  columnNumber?: number;
  /** Function/method name */
  functionName?: string;
  /** Class name (if applicable) */
  className?: string;
  /** Module name */
  moduleName?: string;
  /** Full source code context */
  sourceContext?: {
    /** Source file content */
    content: string;
    /** Start line of context */
    startLine: number;
    /** End line of context */
    endLine: number;
    /** The actual error line */
    errorLine: number;
  };
  /** Whether this is an async frame */
  isAsync: boolean;
  /** Whether this is from a library/framework */
  isLibrary: boolean;
  /** Whether this is application code */
  isApp: boolean;
  /** Raw frame string */
  raw: string;
}

/**
 * Parsed stack trace
 */
export interface StackTrace {
  /** Unique trace ID */
  traceId: string;
  /** Programming language */
  language: Language;
  /** Parsed frames */
  frames: StackFrame[];
  /** Raw stack trace string */
  raw: string;
  /** Application frames only */
  appFrames: StackFrame[];
  /** Library frames only */
  libraryFrames: StackFrame[];
  /** Async call stack if available */
  asyncFrames: StackFrame[];
  /** Root cause frame (likely origin) */
  rootCauseFrame?: StackFrame;
  /** Timestamp when parsed */
  timestamp: number;
}

/**
 * Stack trace parse result
 */
export interface StackTraceParseResult {
  success: boolean;
  trace?: StackTrace;
  error?: string;
  confidence: number;
}

// ============================================================================
// LOG CORRELATION TYPES
// ============================================================================

/**
 * Log level severity
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Single log entry
 */
export interface LogEntry {
  /** Unique log ID */
  logId: string;
  /** Timestamp */
  timestamp: number;
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Source service/component */
  source: string;
  /** Log metadata */
  metadata: Record<string, any>;
  /** Trace ID for correlation */
  traceId?: string;
  /** Request ID */
  requestId?: string;
  /** User ID */
  userId?: string;
  /** Span ID for distributed tracing */
  spanId?: string;
  /** Parent span ID */
  parentSpanId?: string;
  /** Stack trace if error */
  stackTrace?: string;
}

/**
 * Correlated log entry with context
 */
export interface CorrelatedLog extends LogEntry {
  /** Correlation score */
  correlationScore: number;
  /** Related error info */
  errorInfo?: ErrorInfo;
  /** Related stack frames */
  relatedFrames?: StackFrame[];
  /** Time offset from error */
  timeOffset: number;
  /** Whether this is likely causal */
  isLikelyCause: boolean;
}

/**
 * Log timeline reconstruction
 */
export interface LogTimeline {
  /** Timeline ID */
  timelineId: string;
  /** Error being analyzed */
  error: ErrorInfo;
  /** Correlated logs in chronological order */
  logs: CorrelatedLog[];
  /** Timeline start */
  startTime: number;
  /** Timeline end */
  endTime: number;
  /** Total duration */
  duration: number;
  /** Services involved */
  services: string[];
  /** Event count by level */
  levelCounts: Record<LogLevel, number>;
  /** Key events (errors, warnings) */
  keyEvents: CorrelatedLog[];
  /** Potential causes (before error) */
  potentialCauses: CorrelatedLog[];
  /** Consequences (after error) */
  consequences: CorrelatedLog[];
}

/**
 * Cross-service correlation
 */
export interface CrossServiceCorrelation {
  /** Correlation ID */
  correlationId: string;
  /** Trace ID */
  traceId: string;
  /** Services involved */
  services: string[];
  /** Logs from each service */
  serviceLogs: Map<string, LogEntry[]>;
  /** Service call graph */
  callGraph: ServiceCallGraph;
  /** Timeline of cross-service events */
  timeline: LogTimeline;
  /** Error propagation path */
  propagationPath: string[];
}

/**
 * Service call graph
 */
export interface ServiceCallGraph {
  nodes: ServiceNode[];
  edges: ServiceEdge[];
}

export interface ServiceNode {
  service: string;
  errorCount: number;
  requestCount: number;
  avgLatency: number;
}

export interface ServiceEdge {
  from: string;
  to: string;
  callCount: number;
  errorRate: number;
}

// ============================================================================
// DEBUG SESSION TYPES
// ============================================================================

/**
 * Debug session state
 */
export enum DebugSessionState {
  /** Session is being initialized */
  INITIALIZING = 'initializing',
  /** Session is active */
  ACTIVE = 'active',
  /** Session is paused */
  PAUSED = 'paused',
  /** Session is analyzing */
  ANALYZING = 'analyzing',
  /** Session is completed */
  COMPLETED = 'completed',
  /** Session encountered error */
  ERROR = 'error',
}

/**
 * Breakpoint location
 */
export interface Breakpoint {
  /** Breakpoint ID */
  breakpointId: string;
  /** File path */
  filePath: string;
  /** Line number */
  lineNumber: number;
  /** Condition for breakpoint */
  condition?: string;
  /** Whether breakpoint is enabled */
  enabled: boolean;
  /** Hit count */
  hitCount: number;
  /** Timestamp when set */
  timestamp: number;
}

/**
 * Variable inspection
 */
export interface Variable {
  /** Variable name */
  name: string;
  /** Variable value (serialized) */
  value: string;
  /** Variable type */
  type: string;
  /** Scope (local, global, closure) */
  scope: 'local' | 'global' | 'closure' | 'parameter';
  /** Whether variable is mutable */
  mutable: boolean;
  /** Nested properties */
  properties?: Record<string, Variable>;
  /** Variable location */
  location?: {
    filePath: string;
    lineNumber: number;
  };
}

/**
 * Debug session
 */
export interface DebugSession {
  /** Unique session ID */
  sessionId: string;
  /** Session state */
  state: DebugSessionState;
  /** Error being debugged */
  error: ErrorInfo;
  /** Parsed stack trace */
  stackTrace?: StackTrace;
  /** Correlated logs */
  logs: CorrelatedLog[];
  /** Timeline reconstruction */
  timeline?: LogTimeline;
  /** Breakpoints */
  breakpoints: Breakpoint[];
  /** Captured variables */
  variables: Map<string, Variable>;
  /** Analysis results */
  analysis: SessionAnalysis;
  /** Session metadata */
  metadata: SessionMetadata;
  /** Timestamp when created */
  createdAt: number;
  /** Last updated timestamp */
  updatedAt: number;
}

/**
 * Session analysis results
 */
export interface SessionAnalysis {
  /** Root cause analysis */
  rootCause?: RootCauseAnalysis;
  /** Similar historical errors */
  similarErrors?: ErrorMatch[];
  /** AI-powered suggestions */
  suggestions?: FixSuggestion[];
  /** Performance metrics */
  performance?: PerformanceAnalysis;
  /** Anomaly detection results */
  anomalies?: AnomalyResult[];
  /** Code context at error location */
  codeContext?: CodeContext;
}

/**
 * Session metadata
 */
export interface SessionMetadata {
  /** User ID who created session */
  userId?: string;
  /** Environment (dev, staging, prod) */
  environment: string;
  /** Service version */
  version: string;
  /** Tags */
  tags: string[];
  /** Notes */
  notes: string[];
  /** Share settings */
  sharing: {
    /** Whether session is shared */
    shared: boolean;
    /** Shared with users */
    sharedWith: string[];
    /** Public link */
    publicLink?: string;
  };
}

// ============================================================================
// ROOT CAUSE ANALYSIS
// ============================================================================

/**
 * Root cause analysis result
 */
export interface RootCauseAnalysis {
  /** Analysis ID */
  analysisId: string;
  /** Identified root cause */
  rootCause: string;
  /** Confidence level (0-1) */
  confidence: number;
  /** Category of root cause */
  category: RootCauseCategory;
  /** Explanation */
  explanation: string;
  /** Contributing factors */
  factors: ContributingFactor[];
  /** Evidence */
  evidence: Evidence[];
  /** Preventive measures */
  prevention: string[];
}

/**
 * Root cause categories
 */
export enum RootCauseCategory {
  /** Bug in code logic */
  CODE_BUG = 'code_bug',
  /** Configuration error */
  CONFIGURATION_ERROR = 'configuration_error',
  /** External dependency failure */
  EXTERNAL_DEPENDENCY = 'external_dependency',
  /** Resource exhaustion */
  RESOURCE_EXHAUSTION = 'resource_exhaustion',
  /** Race condition */
  RACE_CONDITION = 'race_condition',
  /** Data corruption */
  DATA_CORRUPTION = 'data_corruption',
  /** Network issue */
  NETWORK_ISSUE = 'network_issue',
  /** Insufficient permissions */
  PERMISSION_DENIED = 'permission_denied',
  /** Timeout */
  TIMEOUT = 'timeout',
  /** Unknown cause */
  UNKNOWN = 'unknown',
}

/**
 * Contributing factor
 */
export interface ContributingFactor {
  /** Factor description */
  factor: string;
  /** Impact level (0-1) */
  impact: number;
  /** Evidence supporting this factor */
  evidence: string[];
}

/**
 * Evidence for root cause
 */
export interface Evidence {
  /** Evidence type */
  type: 'log' | 'metric' | 'trace' | 'code' | 'config';
  /** Evidence description */
  description: string;
  /** Source of evidence */
  source: string;
  /** Timestamp */
  timestamp: number;
  /** Confidence */
  confidence: number;
}

// ============================================================================
// ERROR MATCHING
// ============================================================================

/**
 * Historical error match
 */
export interface ErrorMatch {
  /** Match ID */
  matchId: string;
  /** Historical error */
  error: ErrorInfo;
  /** Similarity score (0-1) */
  similarity: number;
  /** Match factors */
  matchFactors: MatchFactor[];
  /** How it was resolved */
  resolution?: ErrorResolution;
  /** Frequency of occurrence */
  frequency: number;
  /** First occurrence */
  firstSeen: number;
  /** Last occurrence */
  lastSeen: number;
}

/**
 * Match factor
 */
export interface MatchFactor {
  /** Factor name */
  factor: string;
  /** Match score (0-1) */
  score: number;
  /** Description */
  description: string;
}

/**
 * Error resolution
 */
export interface ErrorResolution {
  /** How it was resolved */
  method: 'fix' | 'workaround' | 'ignored' | 'pending';
  /** Resolution description */
  description: string;
  /** Commit SHA if fixed */
  commitSha?: string;
  /** Who resolved it */
  resolvedBy?: string;
  /** When it was resolved */
  resolvedAt?: number;
}

// ============================================================================
// AI SUGGESTIONS
// ============================================================================

/**
 * Fix suggestion from AI
 */
export interface FixSuggestion {
  /** Suggestion ID */
  suggestionId: string;
  /** Suggestion type */
  type: SuggestionType;
  /** Confidence level (0-1) */
  confidence: number;
  /** Title */
  title: string;
  /** Detailed description */
  description: string;
  /** Code diff if applicable */
  codeDiff?: CodeDiff;
  /** Explanation of the fix */
  explanation: string;
  /** Expected impact */
  impact: ImpactAnalysis;
  /** References */
  references: Reference[];
  /** Related suggestions */
  relatedSuggestions?: string[];
  /** Tags */
  tags: string[];
  /** Estimated effort */
  effort: 'low' | 'medium' | 'high';
}

/**
 * Suggestion types
 */
export enum SuggestionType {
  /** Code change needed */
  CODE_FIX = 'code_fix',
  /** Configuration change */
  CONFIG_CHANGE = 'config_change',
  /** Architecture improvement */
  ARCHITECTURE = 'architecture',
  /** Performance optimization */
  PERFORMANCE = 'performance',
  /** Security fix */
  SECURITY = 'security',
  /** Add error handling */
  ERROR_HANDLING = 'error_handling',
  /** Add logging/monitoring */
  OBSERVABILITY = 'observability',
  /** Documentation */
  DOCUMENTATION = 'documentation',
  /** Testing improvement */
  TESTING = 'testing',
}

/**
 * Code diff for suggestion
 */
export interface CodeDiff {
  /** File path */
  filePath: string;
  /** Original code */
  original: string;
  /** Suggested code */
  suggested: string;
  /** Start line */
  startLine: number;
  /** End line */
  endLine: number;
  /** Diff in unified format */
  unifiedDiff: string;
  /** Language */
  language: Language;
}

/**
 * Impact analysis
 */
export interface ImpactAnalysis {
  /** Expected impact on errors */
  errorReduction: number;
  /** Performance impact */
  performanceImpact: 'positive' | 'neutral' | 'negative';
  /** Risk level */
  riskLevel: 'low' | 'medium' | 'high';
  /** Side effects */
  sideEffects: string[];
  /** Breaking changes */
  breakingChanges: string[];
}

/**
 * Reference link
 */
export interface Reference {
  /** Reference title */
  title: string;
  /** Reference URL */
  url: string;
  /** Reference type */
  type: 'documentation' | 'stackoverflow' | 'github' | 'blog' | 'internal';
}

// ============================================================================
// PERFORMANCE ANALYSIS
// ============================================================================

/**
 * Performance analysis result
 */
export interface PerformanceAnalysis {
  /** Analysis ID */
  analysisId: string;
  /** Bottlenecks detected */
  bottlenecks: Bottleneck[];
  /** Slow operations */
  slowOperations: SlowOperation[];
  /** Memory usage analysis */
  memoryAnalysis?: MemoryAnalysis;
  /** Hot paths */
  hotPaths: HotPath[];
  /** N+1 queries detected */
  nPlusOneQueries: NPlusOneQuery[];
  /** Optimization suggestions */
  optimizations: OptimizationSuggestion[];
}

/**
 * Performance bottleneck
 */
export interface Bottleneck {
  /** Bottleneck ID */
  bottleneckId: string;
  /** Bottleneck type */
  type: BottleneckType;
  /** Location */
  location: {
    filePath: string;
    functionName: string;
    lineNumber: number;
  };
  /** Severity */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Impact on performance */
  impact: number;
  /** Description */
  description: string;
  /** Metrics */
  metrics: {
    /** Average execution time */
    avgTime: number;
    /** Maximum execution time */
    maxTime: number;
    /** Call count */
    callCount: number;
    /** Percentage of total time */
    percentage: number;
  };
}

/**
 * Bottleneck types
 */
export enum BottleneckType {
  /** Slow database query */
  SLOW_QUERY = 'slow_query',
  /** N+1 query problem */
  N_PLUS_ONE = 'n_plus_one',
  /** Inefficient algorithm */
  INEFFICIENT_ALGORITHM = 'inefficient_algorithm',
  /** Excessive memory allocation */
  MEMORY_ALLOCATION = 'memory_allocation',
  /** Blocking I/O */
  BLOCKING_IO = 'blocking_io',
  /** Network round-trip */
  NETWORK_ROUND_TRIP = 'network_round_trip',
  /** Synchronous operation */
  SYNCHRONOUS_OPERATION = 'synchronous_operation',
  /** Cache miss */
  CACHE_MISS = 'cache_miss',
  /** Lock contention */
  LOCK_CONTENTION = 'lock_contention',
  /** CPU intensive */
  CPU_INTENSIVE = 'cpu_intensive',
}

/**
 * Slow operation
 */
export interface SlowOperation {
  /** Operation ID */
  operationId: string;
  /** Operation name */
  name: string;
  /** Operation type */
  type: string;
  /** Average duration */
  avgDuration: number;
  /** Maximum duration */
  maxDuration: number;
  /** Call count */
  callCount: number;
  /** Threshold exceeded */
  threshold: number;
  /** Location */
  location: {
    filePath: string;
    lineNumber: number;
  };
}

/**
 * Memory analysis
 */
export interface MemoryAnalysis {
  /** Total heap used */
  heapUsed: number;
  /** Heap size limit */
  heapLimit: number;
  /** Percentage used */
  percentage: number;
  /** Potential memory leaks */
  memoryLeaks: MemoryLeak[];
  /** Large allocations */
  largeAllocations: LargeAllocation[];
}

/**
 * Memory leak detection
 */
export interface MemoryLeak {
  /** Leak ID */
  leakId: string;
  /** Suspected object type */
  objectType: string;
  /** Estimated leak size */
  size: number;
  /** Growth rate */
  growthRate: number;
  /** Location */
  location: {
    filePath: string;
    functionName: string;
    lineNumber: number;
  };
  /** Confidence */
  confidence: number;
}

/**
 * Large memory allocation
 */
export interface LargeAllocation {
  /** Allocation ID */
  allocationId: string;
  /** Size in bytes */
  size: number;
  /** Object type */
  type: string;
  /** Location */
  location: {
    filePath: string;
    lineNumber: number;
  };
}

/**
 * Hot path (frequently executed code)
 */
export interface HotPath {
  /** Path ID */
  pathId: string;
  /** Function name */
  functionName: string;
  /** File path */
  filePath: string;
  /** Execution count */
  executionCount: number;
  /** Total time spent */
  totalTime: number;
  /** Percentage of total execution time */
  percentage: number;
  /** Call stack depth */
  depth: number;
}

/**
 * N+1 query detection
 */
export interface NPlusOneQuery {
  /** Query ID */
  queryId: string;
  /** Initial query */
  initialQuery: string;
  /** N+1 queries */
  nPlusOneQueries: string[];
  /** Location */
  location: {
    filePath: string;
    functionName: string;
    lineNumber: number;
  };
  /** Suggested fix */
  suggestedFix: string;
}

/**
 * Optimization suggestion
 */
export interface OptimizationSuggestion {
  /** Suggestion ID */
  suggestionId: string;
  /** Optimization type */
  type: OptimizationType;
  /** Description */
  description: string;
  /** Expected improvement */
  expectedImprovement: number;
  /** Code example */
  codeExample?: string;
  /** References */
  references: Reference[];
}

/**
 * Optimization types
 */
export enum OptimizationType {
  /** Add caching */
  ADD_CACHE = 'add_cache',
  /** Optimize query */
  OPTIMIZE_QUERY = 'optimize_query',
  /** Use async/parallel */
  USE_ASYNC = 'use_async',
  /** Batch operations */
  BATCH_OPERATIONS = 'batch_operations',
  /** Use connection pooling */
  CONNECTION_POOL = 'connection_pool',
  /** Pagination */
  PAGINATION = 'pagination',
  /** Lazy loading */
  LAZY_LOADING = 'lazy_loading',
  /** Index optimization */
  ADD_INDEX = 'add_index',
}

// ============================================================================
// ANOMALY DETECTION
// ============================================================================

/**
 * Anomaly detection result
 */
export interface AnomalyResult {
  /** Anomaly ID */
  anomalyId: string;
  /** Anomaly type */
  type: AnomalyType;
  /** Severity */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Description */
  description: string;
  /** Anomaly score (0-1) */
  score: number;
  /** Detected timestamp */
  timestamp: number;
  /** Metrics */
  metrics: AnomalyMetrics;
  /** Context */
  context: Record<string, any>;
  /** Suggested actions */
  suggestedActions: string[];
}

/**
 * Anomaly types
 */
export enum AnomalyType {
  /** Spike in errors */
  ERROR_SPIKE = 'error_spike',
  /** Latency increase */
  LATENCY_INCREASE = 'latency_increase',
  /** Traffic drop */
  TRAFFIC_DROP = 'traffic_drop',
  /** Memory leak */
  MEMORY_LEAK = 'memory_leak',
  /** CPU spike */
  CPU_SPIKE = 'cpu_spike',
  /** Unusual pattern */
  UNUSUAL_PATTERN = 'unusual_pattern',
  /** Data inconsistency */
  DATA_INCONSISTENCY = 'data_inconsistency',
}

/**
 * Anomaly metrics
 */
export interface AnomalyMetrics {
  /** Current value */
  currentValue: number;
  /** Expected value */
  expectedValue: number;
  /** Deviation from expected */
  deviation: number;
  /** Standard deviation */
  standardDeviation: number;
  /** Z-score */
  zScore: number;
  /** Baseline period */
  baselinePeriod: {
    start: number;
    end: number;
  };
}

// ============================================================================
// CODE CONTEXT
// ============================================================================

/**
 * Code context at error location
 */
export interface CodeContext {
  /** File path */
  filePath: string;
  /** Language */
  language: Language;
  /** Error line number */
  errorLine: number;
  /** Code snippet */
  snippet: CodeSnippet;
  /** Function context */
  functionContext: FunctionContext;
  /** Related functions */
  relatedFunctions: RelatedFunction[];
  /** Imports and dependencies */
  imports: Import[];
}

/**
 * Code snippet
 */
export interface CodeSnippet {
  /** Start line */
  startLine: number;
  /** End line */
  endLine: number;
  /** Lines of code */
  lines: CodeLine[];
  /** Highlighted error line */
  errorLineIndex: number;
}

/**
 * Code line
 */
export interface CodeLine {
  /** Line number */
  lineNumber: number;
  /** Line content */
  content: string;
  /** Indentation level */
  indentLevel: number;
  /** Whether this is the error line */
  isErrorLine: boolean;
}

/**
 * Function context
 */
export interface FunctionContext {
  /** Function name */
  name: string;
  /** Function signature */
  signature: string;
  /** Parameters */
  parameters: Parameter[];
  /** Return type */
  returnType?: string;
  /** Visibility */
  visibility: 'public' | 'private' | 'protected' | 'internal';
  /** Async flag */
  isAsync: boolean;
  /** Generator flag */
  isGenerator: boolean;
}

/**
 * Function parameter
 */
export interface Parameter {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type?: string;
  /** Default value */
  defaultValue?: string;
  /** Is optional */
  optional: boolean;
}

/**
 * Related function
 */
export interface RelatedFunction {
  /** Function name */
  name: string;
  /** File path */
  filePath: string;
  /** Line number */
  lineNumber: number;
  /** Relationship type */
  relationship: 'calls' | 'called_by' | 'related';
}

/**
 * Import statement
 */
export interface Import {
  /** Import statement */
  statement: string;
  /** Module/path */
  module: string;
  /** Imported items */
  items: string[];
  /** Line number */
  lineNumber: number;
}

// ============================================================================
// METRICS SNAPSHOT
// ============================================================================

/**
 * Metric snapshot at a point in time
 */
export interface MetricSnapshot {
  /** Snapshot ID */
  snapshotId: string;
  /** Timestamp */
  timestamp: number;
  /** Request metrics */
  requests: RequestMetrics;
  /** Error metrics */
  errors: ErrorMetrics;
  /** Performance metrics */
  performance: PerformanceMetrics;
  /** Resource metrics */
  resources: ResourceMetrics;
  /** Custom metrics */
  custom: Record<string, number>;
}

/**
 * Request metrics
 */
export interface RequestMetrics {
  /** Total requests */
  total: number;
  /** Successful requests */
  success: number;
  /** Failed requests */
  failed: number;
  /** Requests per second */
  rps: number;
  /** Average latency */
  avgLatency: number;
  /** P50 latency */
  p50: number;
  /** P95 latency */
  p95: number;
  /** P99 latency */
  p99: number;
}

/**
 * Error metrics
 */
export interface ErrorMetrics {
  /** Total errors */
  total: number;
  /** Error rate */
  errorRate: number;
  /** Errors by type */
  byType: Record<string, number>;
  /** Errors by category */
  byCategory: Record<ErrorCategory, number>;
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /** CPU usage percentage */
  cpuUsage: number;
  /** Memory usage */
  memoryUsage: number;
  /** Memory limit */
  memoryLimit: number;
  /** Active connections */
  activeConnections: number;
  /** Queue depth */
  queueDepth: number;
}

/**
 * Resource metrics
 */
export interface ResourceMetrics {
  /** Heap used */
  heapUsed: number;
  /** Heap total */
  heapTotal: number;
  /** Heap limit */
  heapLimit: number;
  /** External memory */
  externalMemory: number;
  /** Array buffers */
  arrayBuffers: number;
}

// ============================================================================
// ANALYSIS REQUESTS
// ============================================================================

/**
 * Request to analyze an error
 */
export interface AnalyzeErrorRequest {
  /** Error information */
  error: ErrorInfo;
  /** Stack trace string */
  stackTrace?: string;
  /** Request ID */
  requestId?: string;
  /** Trace ID */
  traceId?: string;
  /** Analysis options */
  options: AnalysisOptions;
}

/**
 * Analysis options
 */
export interface AnalysisOptions {
  /** Whether to include stack trace analysis */
  includeStackTrace: boolean;
  /** Whether to correlate logs */
  correlateLogs: boolean;
  /** Whether to search similar errors */
  searchSimilarErrors: boolean;
  /** Whether to generate suggestions */
  generateSuggestions: boolean;
  /** Whether to analyze performance */
  analyzePerformance: boolean;
  /** Whether to detect anomalies */
  detectAnomalies: boolean;
  /** Maximum similar errors to return */
  maxSimilarErrors: number;
  /** Time window for log correlation (ms) */
  logCorrelationWindow: number;
}

/**
 * Analysis response
 */
export interface AnalyzeErrorResponse {
  /** Analysis ID */
  analysisId: string;
  /** Root cause analysis */
  rootCause?: RootCauseAnalysis;
  /** Stack trace */
  stackTrace?: StackTrace;
  /** Correlated logs */
  correlatedLogs?: CorrelatedLog[];
  /** Similar errors */
  similarErrors?: ErrorMatch[];
  /** Suggestions */
  suggestions?: FixSuggestion[];
  /** Performance analysis */
  performance?: PerformanceAnalysis;
  /** Anomalies */
  anomalies?: AnomalyResult[];
  /** Analysis timestamp */
  timestamp: number;
  /** Analysis duration */
  duration: number;
}

// ============================================================================
// DEBUG SESSION REQUESTS
// ============================================================================

/**
 * Create debug session request
 */
export interface CreateDebugSessionRequest {
  /** Error to debug */
  error: ErrorInfo;
  /** Stack trace */
  stackTrace?: string;
  /** Session metadata */
  metadata: Partial<SessionMetadata>;
}

/**
 * Update debug session request
 */
export interface UpdateDebugSessionRequest {
  /** Session ID */
  sessionId: string;
  /** Updates to apply */
  updates: Partial<DebugSession>;
}

/**
 * Query debug sessions
 */
export interface QueryDebugSessionsRequest {
  /** Filter by user ID */
  userId?: string;
  /** Filter by state */
  state?: DebugSessionState;
  /** Filter by error type */
  errorType?: string;
  /** Filter by time range */
  timeRange?: {
    start: number;
    end: number;
  };
  /** Filter by tags */
  tags?: string[];
  /** Pagination */
  pagination?: {
    page: number;
    pageSize: number;
  };
  /** Sort by */
  sortBy?: 'createdAt' | 'updatedAt' | 'severity';
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

/**
 * Debug session export format
 */
export interface DebugSessionExport {
  /** Export format version */
  version: string;
  /** Export timestamp */
  exportedAt: number;
  /** Session data */
  session: DebugSession;
  /** Related data */
  related: {
    logs: LogEntry[];
    traces: any[];
    metrics: MetricSnapshot[];
  };
}

/**
 * Analysis report
 */
export interface AnalysisReport {
  /** Report ID */
  reportId: string;
  /** Report type */
  type: 'error' | 'performance' | 'security' | 'comprehensive';
  /** Generated timestamp */
  generatedAt: number;
  /** Time period covered */
  period: {
    start: number;
    end: number;
  };
  /** Summary */
  summary: ReportSummary;
  /** Findings */
  findings: Finding[];
  /** Recommendations */
  recommendations: Recommendation[];
  /** Metrics */
  metrics: ReportMetrics;
}

/**
 * Report summary
 */
export interface ReportSummary {
  /** Total errors analyzed */
  totalErrors: number;
  /** Critical issues found */
  criticalIssues: number;
  /** High priority issues */
  highPriorityIssues: number;
  /** Medium priority issues */
  mediumPriorityIssues: number;
  /** Low priority issues */
  lowPriorityIssues: number;
}

/**
 * Finding
 */
export interface Finding {
  /** Finding ID */
  findingId: string;
  /** Finding type */
  type: string;
  /** Severity */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Evidence */
  evidence: string[];
  /** Affected components */
  affectedComponents: string[];
}

/**
 * Recommendation
 */
export interface Recommendation {
  /** Recommendation ID */
  recommendationId: string;
  /** Priority */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Expected impact */
  expectedImpact: string;
  /** Estimated effort */
  estimatedEffort: 'low' | 'medium' | 'high';
  /** References */
  references: Reference[];
}

/**
 * Report metrics
 */
export interface ReportMetrics {
  /** Error rate */
  errorRate: number;
  /** Average latency */
  avgLatency: number;
  /** P95 latency */
  p95Latency: number;
  /** Throughput */
  throughput: number;
  /** Resource utilization */
  resourceUtilization: {
    cpu: number;
    memory: number;
  };
}
