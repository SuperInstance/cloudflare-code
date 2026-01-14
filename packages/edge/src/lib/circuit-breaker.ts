/**
 * Circuit Breaker
 *
 * Implements the circuit breaker pattern to prevent cascading failures.
 * When a service fails repeatedly, the circuit breaker "opens" to stop
 * sending requests. After a timeout, it enters "half-open" state to test
 * if the service has recovered.
 *
 * Features:
 * - Automatic state transitions (CLOSED -> OPEN -> HALF_OPEN -> CLOSED)
 * - Configurable failure/success thresholds
 * - KV-backed state persistence
 * - Multiple circuit breakers per service
 * - Time-based recovery
 */

import type { KVNamespace } from '@cloudflare/workers-types';

/**
 * Circuit breaker states
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerOptions {
  /**
   * Number of consecutive failures before opening circuit
   * @default 5
   */
  failureThreshold?: number;

  /**
   * Number of consecutive successes to close circuit from half-open
   * @default 2
   */
  successThreshold?: number;

  /**
   * Timeout in milliseconds before attempting recovery (half-open)
   * @default 60000 (1 minute)
   */
  timeout?: number;

  /**
   * Maximum number of calls allowed in half-open state
   * @default 3
   */
  halfOpenMaxCalls?: number;

  /**
   * KV namespace for state persistence (optional)
   */
  kv?: KVNamespace;

  /**
   * Circuit name/identifier
   */
  name: string;

  /**
   * TTL for stored state in seconds (default: 1 hour)
   */
  ttl?: number;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  openedAt?: number;
  halfOpenCallCount: number;
}

/**
 * Circuit Breaker
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   name: 'api-service',
 *   failureThreshold: 5,
 *   successThreshold: 2,
 *   timeout: 60000
 * });
 *
 * try {
 *   const result = await breaker.execute(async () => {
 *     return await fetchFromService();
 *   });
 * } catch (error) {
 *   if (breaker.getState() === 'OPEN') {
 *     // Circuit is open, use fallback
 *   }
 * }
 * ```
 */
export class CircuitBreaker {
  private options: Required<CircuitBreakerOptions>;
  private state: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private lastSuccessTime: number = 0;
  private openedAt: number = 0;
  private halfOpenCallCount: number = 0;
  private localInitialized: boolean = false;

  constructor(options: CircuitBreakerOptions) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      successThreshold: options.successThreshold ?? 2,
      timeout: options.timeout ?? 60000,
      halfOpenMaxCalls: options.halfOpenMaxCalls ?? 3,
      kv: options.kv,
      name: options.name,
      ttl: options.ttl ?? 3600,
    };

    // Load state from KV if available
    if (this.options.kv) {
      this.loadStateFromKV().catch(console.error);
    }
  }

  /**
   * Execute a function through the circuit breaker
   *
   * @param fn - Function to execute
   * @returns Promise<T> - Result of the function
   * @throws Error if circuit is open or function fails
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        throw new Error(
          `Circuit breaker OPEN for ${this.options.name}. ` +
          `Failed at: ${new Date(this.openedAt).toISOString()}`
        );
      }
    }

    // Check half-open call limit
    if (this.state === 'HALF_OPEN') {
      if (this.halfOpenCallCount >= this.options.halfOpenMaxCalls) {
        throw new Error(
          `Circuit breaker HALF_OPEN for ${this.options.name}. ` +
          `Max test calls (${this.options.halfOpenMaxCalls}) reached.`
        );
      }
      this.halfOpenCallCount++;
    }

    try {
      const result = await fn();
      await this.recordSuccess();
      return result;
    } catch (error) {
      await this.recordFailure();
      throw error;
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    // Auto-transition from OPEN to HALF_OPEN if timeout expired
    if (this.state === 'OPEN' && this.shouldAttemptReset()) {
      this.transitionToHalfOpen();
    }

    return this.state;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      openedAt: this.openedAt,
      halfOpenCallCount: this.halfOpenCallCount,
    };
  }

  /**
   * Reset the circuit breaker to CLOSED state
   */
  async reset(): Promise<void> {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.lastSuccessTime = 0;
    this.openedAt = 0;
    this.halfOpenCallCount = 0;

    if (this.options.kv) {
      await this.saveStateToKV();
    }
  }

  /**
   * Manually open the circuit breaker
   */
  async open(reason?: string): Promise<void> {
    this.transitionToOpen();
    if (reason) {
      console.warn(`Circuit breaker manually opened for ${this.options.name}: ${reason}`);
    }

    if (this.options.kv) {
      await this.saveStateToKV();
    }
  }

  /**
   * Record a successful execution
   */
  private async recordSuccess(): Promise<void> {
    this.lastSuccessTime = Date.now();
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;

      if (this.successCount >= this.options.successThreshold) {
        await this.transitionToClosed();
      }
    } else if (this.state === 'CLOSED') {
      // Reset success count in closed state
      this.successCount = 0;
    }

    if (this.options.kv) {
      await this.saveStateToKV();
    }
  }

  /**
   * Record a failed execution
   */
  private async recordFailure(): Promise<void> {
    this.lastFailureTime = Date.now();
    this.failureCount++;
    this.successCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.transitionToOpen();
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.transitionToOpen();
    }

    if (this.options.kv) {
      await this.saveStateToKV();
    }
  }

  /**
   * Transition to CLOSED state
   */
  private async transitionToClosed(): Promise<void> {
    console.log(`Circuit breaker CLOSED for ${this.options.name}`);
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenCallCount = 0;
    this.openedAt = 0;

    if (this.options.kv) {
      await this.saveStateToKV();
    }
  }

  /**
   * Transition to OPEN state
   */
  private async transitionToOpen(): Promise<void> {
    console.error(
      `Circuit breaker OPEN for ${this.options.name} ` +
      `after ${this.failureCount} failures`
    );
    this.state = 'OPEN';
    this.openedAt = Date.now();
    this.halfOpenCallCount = 0;

    if (this.options.kv) {
      await this.saveStateToKV();
    }
  }

  /**
   * Transition to HALF_OPEN state
   */
  private async transitionToHalfOpen(): Promise<void> {
    console.log(
      `Circuit breaker HALF_OPEN for ${this.options.name} - testing recovery`
    );
    this.state = 'HALF_OPEN';
    this.successCount = 0;
    this.halfOpenCallCount = 0;

    if (this.options.kv) {
      await this.saveStateToKV();
    }
  }

  /**
   * Check if should attempt reset (timeout expired)
   */
  private shouldAttemptReset(): boolean {
    if (this.openedAt === 0) return false;
    const timeSinceOpened = Date.now() - this.openedAt;
    return timeSinceOpened >= this.options.timeout;
  }

  /**
   * Load state from KV storage
   */
  private async loadStateFromKV(): Promise<void> {
    if (!this.options.kv) return;

    try {
      const data = await this.options.kv.get(
        this.getStorageKey(),
        'json'
      );

      if (data && typeof data === 'object') {
        const state = data as CircuitBreakerStats;
        this.state = state.state;
        this.failureCount = state.failureCount;
        this.successCount = state.successCount;
        this.lastFailureTime = state.lastFailureTime;
        this.lastSuccessTime = state.lastSuccessTime;
        this.openedAt = state.openedAt ?? 0;
        this.halfOpenCallCount = state.halfOpenCallCount;
        this.localInitialized = true;
      }
    } catch (error) {
      console.error('CircuitBreaker KV load error:', error);
    }
  }

  /**
   * Save state to KV storage
   */
  private async saveStateToKV(): Promise<void> {
    if (!this.options.kv) return;

    try {
      await this.options.kv.put(
        this.getStorageKey(),
        JSON.stringify(this.getStats()),
        {
          expirationTtl: this.options.ttl,
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
    return `circuit-breaker:${this.options.name}`;
  }
}

/**
 * Create a circuit breaker for API services
 *
 * @param name - Service name
 * @param kv - Optional KV namespace
 * @returns CircuitBreaker instance with default config
 */
export function createCircuitBreaker(
  name: string,
  kv?: KVNamespace
): CircuitBreaker {
  return new CircuitBreaker({
    name,
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 60000,
    kv,
  });
}
