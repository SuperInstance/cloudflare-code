/**
 * Circuit Breaker and Retry Logic
 *
 * Implements circuit breaker pattern to prevent cascading failures
 * and exponential backoff retry logic for transient errors.
 */

import type { ProviderClient } from './base';

/**
 * Circuit breaker states
 */
export enum CircuitState {
  /** Normal operation, requests pass through */
  CLOSED = 'closed',
  /** Provider is failing, requests are blocked */
  OPEN = 'open',
  /** Testing if provider has recovered */
  HALF_OPEN = 'half_open',
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening circuit */
  failureThreshold: number;
  /** Number of successful requests to close circuit */
  successThreshold: number;
  /** Time in ms before attempting recovery (half-open) */
  timeout: number;
  /** Maximum number of calls in half-open state */
  halfOpenMaxCalls: number;
  /** Time window to consider for failure rate (ms) */
  failureRateWindow?: number;
  /** Failure rate threshold (0-1) to open circuit */
  failureRateThreshold?: number;
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
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
}

/**
 * Circuit breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitBreakerState;
  private config: Required<CircuitBreakerConfig>;

  constructor(
    private providerName: string,
    config: CircuitBreakerConfig
  ) {
    this.config = {
      failureThreshold: config.failureThreshold || 5,
      successThreshold: config.successThreshold || 2,
      timeout: config.timeout || 60000, // 1 minute
      halfOpenMaxCalls: config.halfOpenMaxCalls || 3,
      failureRateWindow: config.failureRateWindow || 60000, // 1 minute
      failureRateThreshold: config.failureRateThreshold || 0.5, // 50%
    };

    this.state = {
      state: CircuitState.CLOSED,
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      halfOpenCallCount: 0,
      totalRequests: 0,
      failedRequests: 0,
    };
  }

  /**
   * Execute function through circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        throw new Error(`Circuit breaker OPEN for ${this.providerName}`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    const now = Date.now();
    this.state.failureCount = 0;
    this.state.lastSuccessTime = now;
    this.state.totalRequests++;
    this.state.successCount++;

    if (this.state.state === CircuitState.HALF_OPEN) {
      this.state.halfOpenCallCount--;

      if (this.state.successCount >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    } else if (this.state.state === CircuitState.CLOSED) {
      // Reset success count in closed state
      if (this.state.successCount >= this.config.successThreshold) {
        this.state.successCount = 0;
      }
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(): void {
    const now = Date.now();
    this.state.lastFailureTime = now;
    this.state.failureCount++;
    this.state.successCount = 0;
    this.state.totalRequests++;
    this.state.failedRequests++;

    // Check failure rate
    const failureRate = this.calculateFailureRate();

    if (this.state.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen();
    } else if (
      this.state.failureCount >= this.config.failureThreshold ||
      failureRate >= this.config.failureRateThreshold
    ) {
      this.transitionToOpen();
    }
  }

  /**
   * Transition to closed state
   */
  private transitionToClosed(): void {
    console.log(`Circuit breaker CLOSED for ${this.providerName}`);
    this.state.state = CircuitState.CLOSED;
    this.state.failureCount = 0;
    this.state.successCount = 0;
    this.state.halfOpenCallCount = 0;
    this.state.failedRequests = 0;
    this.state.totalRequests = 0;
  }

  /**
   * Transition to open state
   */
  private transitionToOpen(): void {
    console.error(
      `Circuit breaker OPEN for ${this.providerName} after ${this.state.failureCount} failures`
    );
    this.state.state = CircuitState.OPEN;
    this.state.halfOpenCallCount = 0;
  }

  /**
   * Transition to half-open state
   */
  private transitionToHalfOpen(): void {
    console.log(`Circuit breaker HALF_OPEN for ${this.providerName} - testing recovery`);
    this.state.state = CircuitState.HALF_OPEN;
    this.state.successCount = 0;
    this.state.halfOpenCallCount = 0;
  }

  /**
   * Check if should attempt reset
   */
  private shouldAttemptReset(): boolean {
    const timeSinceLastFailure = Date.now() - this.state.lastFailureTime;
    return timeSinceLastFailure >= this.config.timeout;
  }

  /**
   * Calculate failure rate in current window
   */
  private calculateFailureRate(): number {
    if (this.state.totalRequests === 0) return 0;
    return this.state.failedRequests / this.state.totalRequests;
  }

  /**
   * Reset failure window
   */
  resetFailureWindow(): void {
    this.state.totalRequests = 0;
    this.state.failedRequests = 0;
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state.state;
  }

  /**
   * Get detailed stats
   */
  getStats() {
    return {
      state: this.state.state,
      failureCount: this.state.failureCount,
      successCount: this.state.successCount,
      lastFailureTime: this.state.lastFailureTime,
      lastSuccessTime: this.state.lastSuccessTime,
      halfOpenCallCount: this.state.halfOpenCallCount,
      totalRequests: this.state.totalRequests,
      failedRequests: this.state.failedRequests,
      failureRate: this.calculateFailureRate(),
    };
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.transitionToClosed();
  }
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay in milliseconds */
  baseDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Jitter factor (0-1) */
  jitterFactor: number;
  /** Exponential backoff multiplier */
  backoffMultiplier: number;
}

/**
 * Retry logic with exponential backoff
 */
export class RetryPolicy {
  private config: Required<RetryConfig>;

  constructor(config: RetryConfig) {
    this.config = {
      maxRetries: config.maxRetries || 3,
      baseDelay: config.baseDelay || 1000, // 1 second
      maxDelay: config.maxDelay || 30000, // 30 seconds
      jitterFactor: config.jitterFactor || 0.1, // 10%
      backoffMultiplier: config.backoffMultiplier || 2,
    };
  }

  /**
   * Execute function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    context?: { provider?: string; operation?: string }
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if should retry
        if (!this.shouldRetry(error, attempt)) {
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt);

        if (context) {
          console.log(
            `Retry ${attempt + 1}/${this.config.maxRetries} after ${delay}ms` +
              (context.provider ? ` for ${context.provider}` : '')
          );
        }

        // Wait before retry
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Check if should retry based on error
   */
  private shouldRetry(error: unknown, attempt: number): boolean {
    if (attempt >= this.config.maxRetries) {
      return false;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Retry on rate limits
      if (message.includes('rate limit') || message.includes('429')) {
        return true;
      }

      // Retry on server errors (5xx)
      if (message.includes('500') || message.includes('502') || message.includes('503')) {
        return true;
      }

      // Retry on timeout
      if (message.includes('timeout')) {
        return true;
      }

      // Retry on network errors
      if (
        message.includes('network') ||
        message.includes('connection') ||
        message.includes('econnrefused') ||
        message.includes('etimedout')
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number): number {
    // Exponential backoff: baseDelay * multiplier^attempt
    const exponentialDelay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt);

    // Add jitter to prevent thundering herd
    const jitter =
      exponentialDelay * this.config.jitterFactor * (Math.random() * 2 - 1);

    // Cap at max delay
    return Math.min(exponentialDelay + jitter, this.config.maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get retry configuration
   */
  getConfig(): Required<RetryConfig> {
    return { ...this.config };
  }
}

/**
 * Combined circuit breaker and retry wrapper
 */
export class ResilientWrapper {
  private circuitBreaker: CircuitBreaker;
  private retryPolicy: RetryPolicy;

  constructor(
    providerName: string,
    circuitConfig: CircuitBreakerConfig,
    retryConfig: RetryConfig
  ) {
    this.circuitBreaker = new CircuitBreaker(providerName, circuitConfig);
    this.retryPolicy = new RetryPolicy(retryConfig);
  }

  /**
   * Execute function with both circuit breaker and retry logic
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      return this.retryPolicy.execute(fn, { provider: this.circuitBreaker['providerName'] });
    });
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState(): CircuitState {
    return this.circuitBreaker.getState();
  }

  /**
   * Get circuit breaker stats
   */
  getCircuitStats() {
    return this.circuitBreaker.getStats();
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.circuitBreaker.reset();
  }
}

/**
 * Create circuit breaker instance
 */
export function createCircuitBreaker(
  providerName: string,
  config: CircuitBreakerConfig
): CircuitBreaker {
  return new CircuitBreaker(providerName, config);
}

/**
 * Create retry policy instance
 */
export function createRetryPolicy(config: RetryConfig): RetryPolicy {
  return new RetryPolicy(config);
}

/**
 * Create resilient wrapper with both circuit breaker and retry
 */
export function createResilientWrapper(
  providerName: string,
  circuitConfig: CircuitBreakerConfig,
  retryConfig: RetryConfig
): ResilientWrapper {
  return new ResilientWrapper(providerName, circuitConfig, retryConfig);
}
