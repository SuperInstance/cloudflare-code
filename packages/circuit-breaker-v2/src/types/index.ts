/**
 * Circuit Breaker States
 */
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
  ISOLATED = 'ISOLATED',
}

/**
 * Result of a circuit breaker operation
 */
export enum ExecutionResult {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  TIMEOUT = 'TIMEOUT',
  FALLBACK_SUCCESS = 'FALLBACK_SUCCESS',
  FALLBACK_FAILURE = 'FALLBACK_FAILURE',
  REJECTED = 'REJECTED',
}

/**
 * Priority levels for fallback selection
 */
export enum FallbackPriority {
  CRITICAL = 0,
  HIGH = 1,
  MEDIUM = 2,
  LOW = 3,
}

/**
 * Health status of a circuit
 */
export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY',
  RECOVERING = 'RECOVERING',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Configuration for circuit breaker thresholds
 */
export interface ThresholdConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Number of successes in half-open before closing */
  successThreshold: number;
  /** Timeout in milliseconds before attempting half-open */
  timeoutMs: number;
  /** Window size for sliding window calculations */
  windowSize: number;
  /** Minimum requests before calculating metrics */
  minRequests: number;
  /** Error rate percentage to trigger open (0-100) */
  errorRateThreshold: number;
  /** Slow call duration threshold in ms */
  slowCallThreshold: number;
  /** Slow call rate percentage to trigger open (0-100) */
  slowCallRateThreshold: number;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Unique name for the circuit breaker */
  name: string;
  /** Threshold configuration */
  thresholds: ThresholdConfig;
  /** Whether to enable metrics collection */
  enableMetrics: boolean;
  /** Whether to enable predictive failure detection */
  enablePredictiveDetection: boolean;
  /** Whether to persist state */
  enablePersistence: boolean;
  /** Storage key for persistence */
  storageKey?: string;
  /** Custom timeout for operations */
  operationTimeoutMs?: number;
  /** Maximum concurrent operations */
  maxConcurrent?: number;
  /** Whether to enable adaptive thresholds */
  enableAdaptiveThresholds?: boolean;
  /** Adaptive threshold sensitivity (0-1) */
  adaptiveSensitivity?: number;
}

/**
 * Execution context for operations
 */
export interface ExecutionContext {
  /** Circuit breaker name */
  circuitName: string;
  /** Attempt number */
  attempt: number;
  /** Start timestamp */
  startTime: number;
  /** Timeout in milliseconds */
  timeout: number;
  /** Metadata attached to the execution */
  metadata?: Record<string, unknown>;
}

/**
 * Result of an operation execution
 */
export interface ExecutionResultData<T = unknown> {
  /** Result status */
  status: ExecutionResult;
  /** Result data if successful */
  data?: T;
  /** Error if failed */
  error?: Error;
  /** Execution duration in ms */
  duration: number;
  /** Whether fallback was used */
  usedFallback: boolean;
  /** Fallback name if used */
  fallbackName?: string;
  /** Execution context */
  context: ExecutionContext;
  /** Timestamp */
  timestamp: number;
}

/**
 * Fallback function signature
 */
export type FallbackFunction<T = unknown> = (
  context: ExecutionContext,
  error?: Error
) => Promise<T> | T;

/**
 * Fallback configuration
 */
export interface FallbackConfig<T = unknown> {
  /** Unique fallback name */
  name: string;
  /** Priority level */
  priority: FallbackPriority;
  /** Fallback function */
  handler: FallbackFunction<T>;
  /** Whether fallback is enabled */
  enabled: boolean;
  /** Maximum number of times this fallback can be used */
  maxUses?: number;
  /** Timeout for fallback execution */
  timeout?: number;
  /** Conditions under which this fallback applies */
  condition?: (error: Error) => boolean;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Metrics for circuit operations
 */
export interface CircuitMetrics {
  /** Total requests */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Rejected requests */
  rejectedRequests: number;
  /** Timed out requests */
  timeoutRequests: number;
  /** Current error rate */
  errorRate: number;
  /** Average duration in ms */
  averageDuration: number;
  /** P50 duration in ms */
  p50Duration: number;
  /** P95 duration in ms */
  p95Duration: number;
  /** P99 duration in ms */
  p99Duration: number;
  /** Slow call rate */
  slowCallRate: number;
  /** Timestamp of last state change */
  lastStateChange: number;
  /** Current state */
  state: CircuitState;
  /** Time in current state */
  timeInCurrentState: number;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /** Whether health checks are enabled */
  enabled: boolean;
  /** Interval between health checks in ms */
  intervalMs: number;
  /** Timeout for health check */
  timeoutMs: number;
  /** Number of consecutive successful checks to mark healthy */
  successThreshold: number;
  /** Number of consecutive failed checks to mark unhealthy */
  failureThreshold: number;
  /** Health check function */
  checker: () => Promise<boolean>;
}

/**
 * Recovery strategy configuration
 */
export interface RecoveryConfig {
  /** Whether automatic recovery is enabled */
  enabled: boolean;
  /** Initial delay before recovery attempt in ms */
  initialDelayMs: number;
  /** Maximum delay between attempts in ms */
  maxDelayMs: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Maximum recovery attempts */
  maxAttempts: number;
  /** Whether to use gradual traffic ramping */
  enableGradualRamping: boolean;
  /** Initial traffic percentage (0-100) */
  initialTrafficPercent: number;
  /** Traffic increment per step (0-100) */
  trafficIncrement: number;
  /** Duration of each ramping step in ms */
  rampingStepDurationMs: number;
}

/**
 * Sliding window data point
 */
export interface WindowDataPoint {
  /** Success (true) or failure (false) */
  success: boolean;
  /** Duration in ms */
  duration: number;
  /** Timestamp */
  timestamp: number;
  /** Error if failed */
  error?: Error;
}

/**
 * Predictive model data
 */
export interface PredictiveModel {
  /** Predicted failure probability (0-1) */
  failureProbability: number;
  /** Confidence in prediction (0-1) */
  confidence: number;
  /** Predicted time until failure (ms, or Infinity if not predicted) */
  timeUntilFailure: number;
  /** Features used for prediction */
  features: string[];
  /** Timestamp of prediction */
  timestamp: number;
}

/**
 * Analytics event
 */
export interface AnalyticsEvent {
  /** Event type */
  type: string;
  /** Circuit name */
  circuitName: string;
  /** Timestamp */
  timestamp: number;
  /** Event data */
  data: Record<string, unknown>;
}

/**
 * Snapshot of circuit state for persistence
 */
export interface CircuitSnapshot {
  /** Circuit name */
  name: string;
  /** Current state */
  state: CircuitState;
  /** Metrics snapshot */
  metrics: CircuitMetrics;
  /** Timestamp */
  timestamp: number;
  /** Version */
  version: number;
}

/**
 * Storage interface for persistence
 */
export interface StorageAdapter {
  /** Get stored value */
  get(key: string): Promise<string | null>;
  /** Set value */
  set(key: string, value: string): Promise<void>;
  /** Delete value */
  delete(key: string): Promise<void>;
}

/**
 * Circuit breaker event listener
 */
export type CircuitEventListener = (event: CircuitEvent) => void | Promise<void>;

/**
 * Circuit breaker event
 */
export interface CircuitEvent {
  /** Event type */
  type: 'stateChange' | 'thresholdExceeded' | 'prediction' | 'recovery' | 'fallback';
  /** Circuit name */
  circuitName: string;
  /** Previous state (for state changes) */
  fromState?: CircuitState;
  /** New state (for state changes) */
  toState?: CircuitState;
  /** Event data */
  data: Record<string, unknown>;
  /** Timestamp */
  timestamp: number;
}

/**
 * Operation options
 */
export interface OperationOptions<T = unknown> {
  /** Timeout for this operation */
  timeout?: number;
  /** Metadata to attach */
  metadata?: Record<string, unknown>;
  /** Custom fallbacks for this operation */
  fallbacks?: FallbackConfig<T>[];
  /** Skip circuit breaker and execute directly */
  skipCircuit?: boolean;
  /** Attempt number (for retries) */
  attempt?: number;
}
