// @ts-nocheck
/**
 * Circuit Breaker Implementation
 * Implements the circuit breaker pattern for service resilience
 */

import {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerState,
  RollingStats,
  FallbackConfig,
  ServiceError
} from '../types';

const DEFAULT_CONFIG: Partial<CircuitBreakerConfig> = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000, // 1 minute
  halfOpenMaxCalls: 3,
  rollingWindow: 100,
  slidingWindow: { size: 100, type: 'count', bucketCount: 10 },
  minRequests: 10
};

export interface CircuitBreakerEvents {
  onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;
  onFailure?: (error: ServiceError) => void;
  onTimeout?: () => void;
  onFallback?: (fallbackResult: any) => void;
}

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState;
  private events: CircuitBreakerEvents;
  private listeners: Set<(state: CircuitBreakerState) => void>;
  private callCountInHalfOpen: number = 0;
  private windowBuckets: Map<number, { successes: number; failures: number }>;

  constructor(
    serviceName: string,
    config: Partial<CircuitBreakerConfig> = {},
    events: CircuitBreakerEvents = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, serviceName, ...config } as CircuitBreakerConfig;
    this.events = events;
    this.listeners = new Set();
    this.windowBuckets = new Map();

    this.state = this.initializeState();
    this.initializeWindowBuckets();
  }

  /**
   * Execute a request through the circuit breaker
   */
  async execute<T>(
    request: () => Promise<T>,
    context?: { methodName?: string; metadata?: Record<string, any> }
  ): Promise<T> {
    const timestamp = Date.now();

    // Check if we should allow the request
    if (!this.shouldAllowRequest()) {
      throw this.createCircuitOpenError();
    }

    try {
      // Execute the request
      const result = await request();

      // Record success
      this.recordSuccess(timestamp);

      return result;
    } catch (error) {
      // Record failure
      const serviceError = this.normalizeError(error);
      this.recordFailure(timestamp, serviceError);

      // Check if we should use fallback
      if (this.config.fallback?.enabled) {
        return this.executeFallback(serviceError, context);
      }

      throw error;
    }
  }

  /**
   * Execute with timeout
   */
  async executeWithTimeout<T>(
    request: () => Promise<T>,
    timeout: number,
    context?: { methodName?: string; metadata?: Record<string, any> }
  ): Promise<T> {
    return Promise.race([
      this.execute(request, context),
      new Promise<T>((_, reject) =>
        setTimeout(() => {
          this.recordTimeout();
          reject(new Error(`Request timeout after ${timeout}ms`));
        }, timeout)
      )
    ]);
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  /**
   * Get current circuit state enum
   */
  getCircuitState(): CircuitState {
    return this.state.state;
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    const oldState = this.state.state;
    this.state = this.initializeState();
    this.initializeWindowBuckets();
    this.callCountInHalfOpen = 0;

    this.notifyStateChange(oldState, CircuitState.CLOSED);
  }

  /**
   * Force open the circuit
   */
  open(): void {
    this.transitionTo(CircuitState.OPEN);
  }

  /**
   * Force close the circuit
   */
  close(): void {
    this.transitionTo(CircuitState.CLOSED);
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: CircuitBreakerState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get statistics
   */
  getStats(): RollingStats {
    return { ...this.state.rollingStats };
  }

  /**
   * Get configuration
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  // ========================================================================
  // State Management
  // ========================================================================

  private shouldAllowRequest(): boolean {
    const now = Date.now();

    switch (this.state.state) {
      case CircuitState.CLOSED:
        // In closed state, check if we've exceeded failure threshold
        return this.checkFailureThreshold();

      case CircuitState.OPEN:
        // Check if timeout has elapsed
        if (now >= this.state.nextAttemptTime) {
          // Transition to half-open
          this.transitionTo(CircuitState.HALF_OPEN);
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        // Allow limited calls in half-open state
        return this.callCountInHalfOpen < this.config.halfOpenMaxCalls;

      default:
        return false;
    }
  }

  private checkFailureThreshold(): boolean {
    const stats = this.state.rollingStats;

    // Check minimum request threshold
    if (stats.totalRequests < this.config.minRequests) {
      return true;
    }

    // Calculate failure rate
    const failureRate = stats.failedRequests / stats.totalRequests;

    // Check if failure rate exceeds threshold
    if (failureRate >= this.config.failureThreshold / this.config.minRequests) {
      this.transitionTo(CircuitState.OPEN);
      return false;
    }

    return true;
  }

  private recordSuccess(timestamp: number): void {
    this.updateWindowBuckets(timestamp, true);
    this.updateRollingStats(true, false, false);

    if (this.state.state === CircuitState.HALF_OPEN) {
      this.callCountInHalfOpen++;
      this.state.successCount++;

      // Check if we've reached success threshold
      if (this.state.successCount >= this.config.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    } else if (this.state.state === CircuitState.CLOSED) {
      this.state.failureCount = 0; // Reset failure count on success
    }
  }

  private recordFailure(timestamp: number, error: ServiceError): void {
    this.updateWindowBuckets(timestamp, false);
    this.updateRollingStats(false, true, false);
    this.state.lastFailureTime = timestamp;

    if (this.events.onFailure) {
      this.events.onFailure(error);
    }

    if (this.state.state === CircuitState.HALF_OPEN) {
      // In half-open, any failure immediately opens the circuit
      this.transitionTo(CircuitState.OPEN);
    } else if (this.state.state === CircuitState.CLOSED) {
      this.state.failureCount++;

      // Check if we should open
      if (this.state.failureCount >= this.config.failureThreshold) {
        this.transitionTo(CircuitState.OPEN);
      }
    }
  }

  private recordTimeout(): void {
    this.updateRollingStats(false, false, true);

    if (this.events.onTimeout) {
      this.events.onTimeout();
    }

    // Treat timeout as a failure
    this.recordFailure(Date.now(), {
      code: 'TIMEOUT',
      message: 'Request timeout',
      retryable: true
    });
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state.state;

    if (oldState === newState) {
      return;
    }

    this.state.state = newState;
    this.state.lastStateChange = Date.now();

    // Reset counters based on new state
    switch (newState) {
      case CircuitState.OPEN:
        this.state.nextAttemptTime = Date.now() + this.config.timeout;
        this.callCountInHalfOpen = 0;
        break;

      case CircuitState.HALF_OPEN:
        this.state.successCount = 0;
        this.callCountInHalfOpen = 0;
        break;

      case CircuitState.CLOSED:
        this.state.failureCount = 0;
        this.state.successCount = 0;
        this.callCountInHalfOpen = 0;
        break;
    }

    this.notifyStateChange(oldState, newState);
  }

  private notifyStateChange(oldState: CircuitState, newState: CircuitState): void {
    if (this.events.onStateChange) {
      this.events.onStateChange(oldState, newState);
    }

    // Notify all listeners
    const stateSnapshot = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(stateSnapshot);
      } catch (error) {
        console.error('Error notifying circuit breaker listener:', error);
      }
    });
  }

  // ========================================================================
  // Rolling Window Management
  // ========================================================================

  private initializeWindowBuckets(): void {
    this.windowBuckets.clear();

    const bucketCount = this.config.rollingWindow.bucketCount;
    for (let i = 0; i < bucketCount; i++) {
      this.windowBuckets.set(i, { successes: 0, failures: 0 });
    }
  }

  private updateWindowBuckets(timestamp: number, success: boolean): void {
    // Calculate bucket index based on time
    const bucketSize = this.config.rollingWindow.size / this.config.rollingWindow.bucketCount;
    const bucketIndex = Math.floor((timestamp % this.config.rollingWindow.size) / bucketSize);

    const bucket = this.windowBuckets.get(bucketIndex);
    if (bucket) {
      if (success) {
        bucket.successes++;
      } else {
        bucket.failures++;
      }
    }
  }

  private getRollingWindowStats(): { successes: number; failures: number } {
    let successes = 0;
    let failures = 0;

    for (const bucket of this.windowBuckets.values()) {
      successes += bucket.successes;
      failures += bucket.failures;
    }

    return { successes, failures };
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  private updateRollingStats(success: boolean, failure: boolean, timeout: boolean): void {
    const stats = this.state.rollingStats;

    stats.totalRequests++;

    if (success) {
      stats.successfulRequests++;
    }

    if (failure) {
      stats.failedRequests++;
    }

    if (timeout) {
      stats.timeouts++;
    }
  }

  // ========================================================================
  // Fallback
  // ========================================================================

  private async executeFallback<T>(
    error: ServiceError,
    context?: { methodName?: string; metadata?: Record<string, any> }
  ): Promise<T> {
    const fallback = this.config.fallback!;

    if (!fallback.enabled) {
      throw error;
    }

    try {
      let result: any;

      switch (fallback.strategy) {
        case 'exception':
          if (fallback.exceptionType) {
            throw new (globalThis as any)[fallback.exceptionType](error.message);
          }
          throw error;

        case 'cached':
          // Return cached value if available
          const cacheKey = `fallback_${this.config.serviceName}_${context?.methodName || 'default'}`;
          result = await this.getCachedValue(cacheKey, fallback.cacheTtl);
          if (result === null) {
            throw error;
          }
          break;

        case 'default':
          result = fallback.defaultValue;
          break;

        case 'alternative':
          // Call alternative service
          if (fallback.fallbackService) {
            result = await this.callAlternativeService(fallback.fallbackService, context);
          } else {
            throw error;
          }
          break;

        default:
          throw error;
      }

      if (this.events.onFallback) {
        this.events.onFallback(result);
      }

      return result as T;
    } catch (fallbackError) {
      throw error; // Throw original error if fallback fails
    }
  }

  private async getCachedValue(key: string, ttl?: number): Promise<any> {
    // Check global cache
    const cached = globalThis[key];
    if (cached) {
      if (ttl && Date.now() - cached.timestamp > ttl) {
        delete globalThis[key];
        return null;
      }
      return cached.value;
    }
    return null;
  }

  private async callAlternativeService(
    serviceName: string,
    context?: { methodName?: string; metadata?: Record<string, any> }
  ): Promise<any> {
    // This would integrate with the service discovery and communication layers
    // For now, return a placeholder
    throw new Error(`Alternative service ${serviceName} not implemented`);
  }

  // ========================================================================
  // Error Handling
  // ========================================================================

  private normalizeError(error: unknown): ServiceError {
    if (this.isServiceError(error)) {
      return error;
    }

    if (error instanceof Error) {
      return {
        code: 'UNKNOWN_ERROR',
        message: error.message,
        retryable: this.isRetryableError(error)
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      retryable: false
    };
  }

  private isServiceError(error: unknown): error is ServiceError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      'retryable' in error
    );
  }

  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN'
    ];

    return retryableErrors.some(code => error.message.includes(code));
  }

  private createCircuitOpenError(): Error {
    const error = new Error(
      `Circuit breaker is OPEN for service ${this.config.serviceName}. ` +
      `Next attempt at ${new Date(this.state.nextAttemptTime).toISOString()}`
    );

    (error as any).code = 'CIRCUIT_OPEN';
    (error as any).retryable = false;
    (error as any).circuitState = CircuitState.OPEN;

    return error;
  }

  // ========================================================================
  // Initialization
  // ========================================================================

  private initializeState(): CircuitBreakerState {
    return {
      state: CircuitState.CLOSED,
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
      lastStateChange: Date.now(),
      nextAttemptTime: 0,
      rollingStats: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        rejectedRequests: 0,
        timeouts: 0,
        latencies: []
      }
    };
  }
}
