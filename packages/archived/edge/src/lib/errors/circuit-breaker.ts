/**
 * Enhanced Circuit Breaker
 *
 * Advanced circuit breaker implementation with:
 * - Multi-state transitions (CLOSED, OPEN, HALF_OPEN)
 * - Error type-aware breaking
 * - Adaptive thresholds
 * - KV persistence
 * - Metrics collection
 * - Integration with error taxonomy
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import { ErrorType, getErrorSeverity, isRetryable } from './types';

// ============================================================================
// CIRCUIT STATES
// ============================================================================

/**
 * Circuit breaker states
 */
export enum CircuitState {
  /** Normal operation, requests pass through */
  CLOSED = 'closed',
  /** Provider is failing, requests are blocked */
  OPEN = 'OPEN',
  /** Testing if provider has recovered */
  HALF_OPEN = 'half_open',
  /** Forced open (manual intervention) */
  FORCED_OPEN = 'forced_open',
}

// ============================================================================
// CIRCUIT BREAKER EVENTS
// ============================================================================

/**
 * Circuit breaker events
 */
export enum CircuitEvent {
  /** State transition occurred */
  STATE_TRANSITION = 'state_transition',
  /** Circuit opened due to failures */
  CIRCUIT_OPENED = 'circuit_opened',
  /** Circuit closed after recovery */
  CIRCUIT_CLOSED = 'circuit_closed',
  /** Circuit entered half-open state */
  CIRCUIT_HALF_OPEN = 'circuit_half_open',
  /** Request succeeded */
  REQUEST_SUCCESS = 'request_success',
  /** Request failed */
  REQUEST_FAILURE = 'request_failure',
  /** Circuit forced open */
  CIRCUIT_FORCED = 'circuit_forced',
  /** Circuit reset */
  CIRCUIT_RESET = 'circuit_reset',
}

// ============================================================================
// CIRCUIT BREAKER CONFIGURATION
// ============================================================================

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Circuit name/identifier */
  name: string;
  /** Number of consecutive failures before opening */
  failureThreshold: number;
  /** Number of consecutive successes to close circuit */
  successThreshold: number;
  /** Time in ms before attempting recovery (half-open) */
  timeout: number;
  /** Maximum number of calls in half-open state */
  halfOpenMaxCalls: number;
  /** Time window to consider for failure rate (ms) */
  failureRateWindow?: number;
  /** Failure rate threshold (0-1) to open circuit */
  failureRateThreshold?: number;
  /** Whether to break on non-retryable errors */
  breakOnNonRetryable?: boolean;
  /** Error types that should not break the circuit */
  ignoreErrorTypes?: ErrorType[];
  /** KV namespace for state persistence */
  kv?: KVNamespace;
  /** TTL for stored state in seconds */
  ttl?: number;
  /** Enable metrics collection */
  enableMetrics?: boolean;
  /** Callback for state transitions */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  /** Callback for failures */
  onFailure?: (error: Error, errorType: ErrorType) => void;
}

// ============================================================================
// CIRCUIT BREAKER STATE
// ============================================================================

/**
 * Circuit breaker state snapshot
 */
export interface CircuitBreakerState {
  /** Current state */
  state: CircuitState;
  /** Consecutive failure count */
  failureCount: number;
  /** Consecutive success count */
  successCount: number;
  /** Last failure timestamp */
  lastFailureTime: number;
  /** Last success timestamp */
  lastSuccessTime: number;
  /** Half-open call count */
  halfOpenCallCount: number;
  /** Total requests in current window */
  totalRequests: number;
  /** Failed requests in current window */
  failedRequests: number;
  /** Circuit opened timestamp */
  openedAt?: number;
  /** Forced open flag */
  forcedOpen: boolean;
  /** Last state change timestamp */
  lastStateChange: number;
}

// ============================================================================
// CIRCUIT BREAKER METRICS
// ============================================================================

/**
 * Circuit breaker metrics
 */
export interface CircuitBreakerMetrics {
  /** Total requests handled */
  totalRequests: number;
  /** Total successful requests */
  totalSuccesses: number;
  /** Total failed requests */
  totalFailures: number;
  /** Total times circuit opened */
  totalOpens: number;
  /** Total times circuit closed */
  totalCloses: number;
  /** Total time spent in OPEN state (ms) */
  totalOpenTime: number;
  /** Total time spent in HALF_OPEN state (ms) */
  totalHalfOpenTime: number;
  /** Current failure rate */
  currentFailureRate: number;
  /** Average request duration (ms) */
  avgRequestDuration: number;
  /** Last request duration (ms) */
  lastRequestDuration?: number;
  /** State transition history */
  stateHistory: Array<{
    from: CircuitState;
    to: CircuitState;
    timestamp: number;
  }>;
}

// ============================================================================
// ENHANCED CIRCUIT BREAKER
// ============================================================================

/**
 * Enhanced circuit breaker with error taxonomy integration
 */
export class EnhancedCircuitBreaker {
  private state: CircuitBreakerState;
  private config: Required<CircuitBreakerConfig>;
  private metrics: CircuitBreakerMetrics;
  private stateTimings: Map<CircuitState, number> = new Map();

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      successThreshold: config.successThreshold ?? 2,
      timeout: config.timeout ?? 60000,
      halfOpenMaxCalls: config.halfOpenMaxCalls ?? 3,
      failureRateWindow: config.failureRateWindow ?? 60000,
      failureRateThreshold: config.failureRateThreshold ?? 0.5,
      breakOnNonRetryable: config.breakOnNonRetryable ?? false,
      ignoreErrorTypes: config.ignoreErrorTypes ?? [],
      kv: config.kv,
      ttl: config.ttl ?? 3600,
      enableMetrics: config.enableMetrics ?? true,
      onStateChange: config.onStateChange ?? (() => {}),
      onFailure: config.onFailure ?? (() => {}),
      name: config.name,
    };

    this.state = this.initializeState();
    this.metrics = this.initializeMetrics();

    // Load state from KV if available
    if (this.config.kv) {
      this.loadStateFromKV().catch(console.error);
    }
  }

  /**
   * Execute function through circuit breaker
   */
  async execute<T>(
    fn: () => Promise<T>,
    context?: { errorType?: ErrorType }
  ): Promise<T> {
    const startTime = Date.now();

    // Check circuit state
    if (this.state.state === CircuitState.OPEN || this.state.state === CircuitState.FORCED_OPEN) {
      if (this.shouldAttemptReset()) {
        await this.transitionToHalfOpen();
      } else {
        throw new Error(
          `Circuit breaker ${this.config.name} is ${this.state.state}. ` +
          `Opened at: ${new Date(this.state.openedAt!).toISOString()}`
        );
      }
    }

    // Check half-open call limit
    if (this.state.state === CircuitState.HALF_OPEN) {
      if (this.state.halfOpenCallCount >= this.config.halfOpenMaxCalls) {
        throw new Error(
          `Circuit breaker ${this.config.name} has reached max half-open calls`
        );
      }
      this.state.halfOpenCallCount++;
    }

    try {
      const result = await fn();
      await this.recordSuccess();

      // Update metrics
      if (this.config.enableMetrics) {
        const duration = Date.now() - startTime;
        this.metrics.totalSuccesses++;
        this.metrics.lastRequestDuration = duration;
        this.updateAvgRequestDuration(duration);
      }

      return result;
    } catch (error) {
      await this.recordFailure(error as Error, context?.errorType);

      // Update metrics
      if (this.config.enableMetrics) {
        this.metrics.totalFailures++;
      }

      throw error;
    } finally {
      // Update total requests
      if (this.config.enableMetrics) {
        this.metrics.totalRequests++;
      }
    }
  }

  /**
   * Record a successful execution
   */
  private async recordSuccess(): Promise<void> {
    const now = Date.now();
    this.state.lastSuccessTime = now;
    this.state.failureCount = 0;
    this.state.totalRequests++;
    this.state.successCount++;

    if (this.state.state === CircuitState.HALF_OPEN) {
      if (this.state.successCount >= this.config.successThreshold) {
        await this.transitionToClosed();
      }
    } else if (this.state.state === CircuitState.CLOSED) {
      // Reset success count in closed state
      if (this.state.successCount >= this.config.successThreshold) {
        this.state.successCount = 0;
      }
    }

    // Save to KV
    if (this.config.kv) {
      await this.saveStateToKV();
    }
  }

  /**
   * Record a failed execution
   */
  private async recordFailure(error: Error, errorType?: ErrorType): Promise<void> {
    const now = Date.now();
    this.state.lastFailureTime = now;
    this.state.failureCount++;
    this.state.successCount = 0;
    this.state.totalRequests++;
    this.state.failedRequests++;

    // Determine if error should break circuit
    const shouldBreak = this.shouldBreakCircuit(error, errorType);

    if (shouldBreak) {
      if (this.state.state === CircuitState.HALF_OPEN) {
        await this.transitionToOpen();
      } else if (
        this.state.failureCount >= this.config.failureThreshold ||
        this.calculateFailureRate() >= this.config.failureRateThreshold
      ) {
        await this.transitionToOpen();
      }
    }

    // Call failure callback
    this.config.onFailure(error, errorType ?? this.classifyError(error));

    // Save to KV
    if (this.config.kv) {
      await this.saveStateToKV();
    }
  }

  /**
   * Determine if error should break circuit
   */
  private shouldBreakCircuit(error: Error, errorType?: ErrorType): boolean {
    const type = errorType ?? this.classifyError(error);

    // Check if error type should be ignored
    if (this.config.ignoreErrorTypes.includes(type)) {
      return false;
    }

    // Check if non-retryable errors should break circuit
    if (!isRetryable(type) && !this.config.breakOnNonRetryable) {
      return false;
    }

    // Break on critical and high severity errors
    const severity = getErrorSeverity(type);
    return severity === 'critical' || severity === 'high';
  }

  /**
   * Transition to CLOSED state
   */
  private async transitionToClosed(): Promise<void> {
    const from = this.state.state;
    const to = CircuitState.CLOSED;

    console.log(`Circuit breaker ${this.config.name} CLOSED`);

    this.state.state = CircuitState.CLOSED;
    this.state.failureCount = 0;
    this.state.successCount = 0;
    this.state.halfOpenCallCount = 0;
    this.state.openedAt = undefined;
    this.state.forcedOpen = false;
    this.state.lastStateChange = Date.now();

    // Update metrics
    if (this.config.enableMetrics) {
      this.metrics.totalCloses++;
      this.recordStateTransition(from, to);
    }

    // Call callback
    this.config.onStateChange(from, to);

    // Save to KV
    if (this.config.kv) {
      await this.saveStateToKV();
    }
  }

  /**
   * Transition to OPEN state
   */
  private async transitionToOpen(): Promise<void> {
    const from = this.state.state;
    const to = CircuitState.OPEN;

    console.error(
      `Circuit breaker ${this.config.name} OPEN after ${this.state.failureCount} failures`
    );

    this.state.state = CircuitState.OPEN;
    this.state.openedAt = Date.now();
    this.state.halfOpenCallCount = 0;
    this.state.lastStateChange = Date.now();

    // Update metrics
    if (this.config.enableMetrics) {
      this.metrics.totalOpens++;
      this.recordStateTransition(from, to);
    }

    // Call callback
    this.config.onStateChange(from, to);

    // Save to KV
    if (this.config.kv) {
      await this.saveStateToKV();
    }
  }

  /**
   * Transition to HALF_OPEN state
   */
  private async transitionToHalfOpen(): Promise<void> {
    const from = this.state.state;
    const to = CircuitState.HALF_OPEN;

    console.log(`Circuit breaker ${this.config.name} HALF_OPEN - testing recovery`);

    this.state.state = CircuitState.HALF_OPEN;
    this.state.successCount = 0;
    this.state.halfOpenCallCount = 0;
    this.state.lastStateChange = Date.now();

    // Update metrics
    if (this.config.enableMetrics) {
      this.recordStateTransition(from, to);
    }

    // Call callback
    this.config.onStateChange(from, to);

    // Save to KV
    if (this.config.kv) {
      await this.saveStateToKV();
    }
  }

  /**
   * Force circuit open (manual intervention)
   */
  async forceOpen(reason?: string): Promise<void> {
    const from = this.state.state;
    const to = CircuitState.FORCED_OPEN;

    console.warn(`Circuit breaker ${this.config.name} FORCED OPEN${reason ? ': ' + reason : ''}`);

    this.state.state = CircuitState.FORCED_OPEN;
    this.state.openedAt = Date.now();
    this.state.forcedOpen = true;
    this.state.lastStateChange = Date.now();

    // Update metrics
    if (this.config.enableMetrics) {
      this.metrics.totalOpens++;
      this.recordStateTransition(from, to);
    }

    // Call callback
    this.config.onStateChange(from, to);

    // Save to KV
    if (this.config.kv) {
      await this.saveStateToKV();
    }
  }

  /**
   * Reset circuit breaker to CLOSED state
   */
  async reset(): Promise<void> {
    const from = this.state.state;
    const to = CircuitState.CLOSED;

    console.log(`Circuit breaker ${this.config.name} RESET`);

    this.state = this.initializeState();
    this.metrics = this.initializeMetrics();

    // Update metrics
    if (this.config.enableMetrics) {
      this.recordStateTransition(from, to);
    }

    // Call callback
    this.config.onStateChange(from, to);

    // Save to KV
    if (this.config.kv) {
      await this.saveStateToKV();
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    // Auto-transition from OPEN to HALF_OPEN if timeout expired
    if (this.state.state === CircuitState.OPEN && this.shouldAttemptReset()) {
      this.transitionToHalfOpen();
    }

    return this.state.state;
  }

  /**
   * Get detailed state
   */
  getDetailedState(): CircuitBreakerState {
    return { ...this.state };
  }

  /**
   * Get metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      ...this.metrics,
      currentFailureRate: this.calculateFailureRate(),
    };
  }

  /**
   * Check if should attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.state.openedAt || this.state.forcedOpen) {
      return false;
    }
    const timeSinceOpened = Date.now() - this.state.openedAt;
    return timeSinceOpened >= this.config.timeout;
  }

  /**
   * Calculate failure rate in current window
   */
  private calculateFailureRate(): number {
    if (this.state.totalRequests === 0) return 0;
    return this.state.failedRequests / this.state.totalRequests;
  }

  /**
   * Classify error from Error object
   */
  private classifyError(error: Error): ErrorType {
    const statusCode = (error as any).status ?? 0;
    const message = error.message?.toLowerCase() ?? '';

    if (statusCode === 429 || message.includes('rate limit')) {
      return ErrorType.RATE_LIMITED;
    }
    if (statusCode >= 500 || message.includes('timeout')) {
      return ErrorType.TIMEOUT;
    }
    if (message.includes('network') || message.includes('connection')) {
      return ErrorType.NETWORK_ERROR;
    }
    if (statusCode === 503 || message.includes('unavailable')) {
      return ErrorType.PROVIDER_UNAVAILABLE;
    }

    return ErrorType.UNKNOWN_ERROR;
  }

  /**
   * Initialize state
   */
  private initializeState(): CircuitBreakerState {
    return {
      state: CircuitState.CLOSED,
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      halfOpenCallCount: 0,
      totalRequests: 0,
      failedRequests: 0,
      openedAt: undefined,
      forcedOpen: false,
      lastStateChange: Date.now(),
    };
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): CircuitBreakerMetrics {
    return {
      totalRequests: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalOpens: 0,
      totalCloses: 0,
      totalOpenTime: 0,
      totalHalfOpenTime: 0,
      currentFailureRate: 0,
      avgRequestDuration: 0,
      stateHistory: [],
    };
  }

  /**
   * Record state transition
   */
  private recordStateTransition(from: CircuitState, to: CircuitState): void {
    this.metrics.stateHistory.push({
      from,
      to,
      timestamp: Date.now(),
    });

    // Keep only last 100 transitions
    if (this.metrics.stateHistory.length > 100) {
      this.metrics.stateHistory.shift();
    }
  }

  /**
   * Update average request duration
   */
  private updateAvgRequestDuration(duration: number): void {
    const total = this.metrics.totalRequests;
    const currentAvg = this.metrics.avgRequestDuration;
    this.metrics.avgRequestDuration = ((currentAvg * (total - 1)) + duration) / total;
  }

  /**
   * Load state from KV storage
   */
  private async loadStateFromKV(): Promise<void> {
    if (!this.config.kv) return;

    try {
      const data = await this.config.kv.get(
        this.getStorageKey(),
        'json'
      );

      if (data && typeof data === 'object') {
        const savedState = data as CircuitBreakerState;
        this.state = {
          ...this.state,
          ...savedState,
        };
      }
    } catch (error) {
      console.error('CircuitBreaker KV load error:', error);
    }
  }

  /**
   * Save state to KV storage
   */
  private async saveStateToKV(): Promise<void> {
    if (!this.config.kv) return;

    try {
      await this.config.kv.put(
        this.getStorageKey(),
        JSON.stringify(this.getDetailedState()),
        {
          expirationTtl: this.config.ttl,
        }
      );
    } catch (error) {
      console.error('CircuitBreaker KV save error:', error);
    }
  }

  /**
   * Generate storage key
   */
  private getStorageKey(): string {
    return `circuit-breaker:${this.config.name}`;
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create enhanced circuit breaker with default configuration
 */
export function createEnhancedCircuitBreaker(
  name: string,
  config?: Partial<CircuitBreakerConfig>
): EnhancedCircuitBreaker {
  const defaultConfig: CircuitBreakerConfig = {
    name,
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000,
    halfOpenMaxCalls: 3,
    failureRateWindow: 60000,
    failureRateThreshold: 0.5,
    breakOnNonRetryable: false,
    ignoreErrorTypes: [ErrorType.INVALID_INPUT, ErrorType.UNAUTHORIZED],
    enableMetrics: true,
  };

  return new EnhancedCircuitBreaker({
    ...defaultConfig,
    ...config,
  });
}

/**
 * Create circuit breaker for API providers
 */
export function createProviderCircuitBreaker(
  providerName: string,
  kv?: KVNamespace
): EnhancedCircuitBreaker {
  return createEnhancedCircuitBreaker(
    `provider:${providerName}`,
    {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
      kv,
    }
  );
}

/**
 * Create circuit breaker for critical services
 */
export function createCriticalCircuitBreaker(
  serviceName: string,
  kv?: KVNamespace
): EnhancedCircuitBreaker {
  return createEnhancedCircuitBreaker(
    `critical:${serviceName}`,
    {
      failureThreshold: 3,
      successThreshold: 3,
      timeout: 30000,
      kv,
    }
  );
}
