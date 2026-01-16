/**
 * Advanced Circuit Breaker
 *
 * Implements the circuit breaker pattern with:
 * - Failure threshold detection
 * - Automatic circuit opening
 * - Half-open state testing
 * - Fallback responses
 * - Recovery automation
 * - Circuit breaker metrics
 *
 * Features:
 * - Multiple circuit states (CLOSED, OPEN, HALF_OPEN)
 * - Configurable thresholds and timeouts
 * - Sliding window failure tracking
 * - KV-backed state persistence
 * - Real-time metrics
 * - Health check integration
 */

import type { GatewayRequest, GatewayContext, CircuitState, CircuitBreakerConfig, CircuitBreakerStats } from '../types';

/**
 * Circuit breaker events
 */
type CircuitEvent = 'state_change' | 'failure' | 'success' | 'timeout' | 'reset';

/**
 * Circuit event listener
 */
type CircuitEventListener = (event: CircuitEvent, data: unknown) => void;

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  name: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  openedAt?: number;
  halfOpenCallCount: number;
  failureHistory: number[];
  successHistory: number[];
  lastStateChange: number;
}

/**
 * Fallback response configuration
 */
interface FallbackConfig {
  enabled: boolean;
  status?: number;
  body?: string | Record<string, unknown>;
  headers?: Record<string, string>;
  contentType?: string;
}

/**
 * Circuit Breaker
 */
export class CircuitBreaker {
  private config: Required<CircuitBreakerConfig>;
  private state: CircuitBreakerState;
  private listeners: Map<CircuitEvent, Set<CircuitEventListener>>;
  private metrics: CircuitMetrics;
  private kv?: KVNamespace;

  constructor(config: CircuitBreakerConfig, kv?: KVNamespace) {
    this.config = {
      enabled: config.enabled ?? true,
      failureThreshold: config.failureThreshold ?? 5,
      successThreshold: config.successThreshold ?? 2,
      timeout: config.timeout ?? 60000,
      halfOpenMaxCalls: config.halfOpenMaxCalls ?? 3,
      slidingWindowSize: config.slidingWindowSize ?? 100,
    };

    this.kv = kv;

    this.state = {
      name: 'default',
      state: 'closed',
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      halfOpenCallCount: 0,
      failureHistory: [],
      successHistory: [],
      lastStateChange: Date.now(),
    };

    this.listeners = new Map();

    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      avgResponseTime: 0,
      stateChanges: 0,
      lastResetTime: Date.now(),
    };

    // Load state from KV if available
    if (this.kv) {
      this.loadState().catch(console.error);
    }
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(
    fn: () => Promise<T>,
    _request?: GatewayRequest,
    _context?: GatewayContext,
    fallback?: FallbackConfig
  ): Promise<T> {
    if (!this.config.enabled) {
      return await fn();
    }

    this.metrics.totalCalls++;

    // Check circuit state
    const currentState = this.getState();

    if (currentState === 'open') {
      if (this.shouldAttemptReset()) {
        await this.transitionTo('half_open');
      } else {
        this.metrics.rejectedCalls++;
        this.emit('failure', { reason: 'Circuit is open' });

        if (fallback?.enabled) {
          return this.executeFallback(fallback);
        }

        throw new Error(`Circuit breaker is OPEN for ${this.state.name}`);
      }
    }

    // Check half-open call limit
    if (currentState === 'half_open') {
      if (this.state.halfOpenCallCount >= this.config.halfOpenMaxCalls) {
        this.metrics.rejectedCalls++;
        throw new Error(`Circuit breaker HALF_OPEN max calls reached for ${this.state.name}`);
      }
      this.state.halfOpenCallCount++;
    }

    const startTime = performance.now();

    try {
      const result = await fn();

      const duration = performance.now() - startTime;
      await this.recordSuccess(duration);

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      await this.recordFailure(error, duration);

      if (fallback?.enabled) {
        return this.executeFallback(fallback);
      }

      throw error;
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    // Auto-transition from OPEN to HALF_OPEN if timeout expired
    if (this.state.state === 'open' && this.shouldAttemptReset()) {
      this.transitionTo('half_open');
    }

    return this.state.state;
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.getState(),
      failureCount: this.state.failureCount,
      successCount: this.state.successCount,
      lastFailureTime: this.state.lastFailureTime,
      lastSuccessTime: this.state.lastSuccessTime,
      openedAt: this.state.openedAt,
      halfOpenCallCount: this.state.halfOpenCallCount,
    };
  }

  /**
   * Get circuit metrics
   */
  getMetrics(): CircuitMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset the circuit breaker
   */
  async reset(): Promise<void> {
    this.state.state = 'closed';
    this.state.failureCount = 0;
    this.state.successCount = 0;
    this.state.lastFailureTime = 0;
    this.state.lastSuccessTime = 0;
    this.state.openedAt = undefined;
    this.state.halfOpenCallCount = 0;
    this.state.failureHistory = [];
    this.state.successHistory = [];
    this.state.lastStateChange = Date.now();

    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      avgResponseTime: 0,
      stateChanges: 0,
      lastResetTime: Date.now(),
    };

    await this.saveState();
    this.emit('reset', this.state);
  }

  /**
   * Manually open the circuit
   */
  async open(_reason?: string): Promise<void> {
    await this.transitionTo('open', _reason);
  }

  /**
   * Manually close the circuit
   */
  async close(): Promise<void> {
    await this.transitionTo('closed');
  }

  /**
   * Add event listener
   */
  on(event: CircuitEvent, listener: CircuitEventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  /**
   * Remove event listener
   */
  off(_event: CircuitEvent, _listener: CircuitEventListener): void {
    const listeners = this.listeners.get(_event);
    if (listeners) {
      listeners.delete(_listener);
    }
  }

  /**
   * Record a successful execution (private helper)
   */
  private async recordSuccess(duration: number): Promise<void> {
    const now = Date.now();

    this.state.lastSuccessTime = now;
    this.state.successCount++;
    this.state.failureCount = 0;

    // Update history
    this.state.successHistory.push(now);
    if (this.state.successHistory.length > this.config.slidingWindowSize) {
      this.state.successHistory.shift();
    }

    // Update metrics
    this.metrics.successfulCalls++;
    this.metrics.avgResponseTime =
      (this.metrics.avgResponseTime * (this.metrics.successfulCalls - 1) + duration) /
      this.metrics.successfulCalls;

    if (this.state.state === 'half_open') {
      if (this.state.successCount >= this.config.successThreshold) {
        await this.transitionTo('closed');
      }
    }

    this.emit('success', { duration, state: this.state.state });
    await this.saveState();
  }

  /**
   * Record a failed execution (private helper)
   */
  private async recordFailure(error: unknown, duration: number): Promise<void> {
    const now = Date.now();

    this.state.lastFailureTime = now;
    this.state.failureCount++;
    this.state.successCount = 0;

    // Update history
    this.state.failureHistory.push(now);
    if (this.state.failureHistory.length > this.config.slidingWindowSize) {
      this.state.failureHistory.shift();
    }

    // Update metrics
    this.metrics.failedCalls++;
    this.metrics.avgResponseTime =
      (this.metrics.avgResponseTime * (this.metrics.successfulCalls - 1) + duration) /
      this.metrics.successfulCalls;

    if (this.state.state === 'half_open') {
      await this.transitionTo('open', 'Failure in half-open state');
    } else if (this.state.failureCount >= this.config.failureThreshold) {
      await this.transitionTo('open', `Failure threshold reached: ${this.state.failureCount}`);
    }

    this.emit('failure', { error, duration, state: this.state.state });
    await this.saveState();
  }

  /**
   * Transition to a new state (private helper)
   */
  private async transitionTo(state: CircuitState, reason?: string): Promise<void> {
    const oldState = this.state.state;

    if (oldState === state) {
      return;
    }

    this.state.state = state;
    this.state.lastStateChange = Date.now();
    this.metrics.stateChanges++;

    if (state === 'open') {
      this.state.openedAt = Date.now();
      this.state.halfOpenCallCount = 0;
    } else if (state === 'closed') {
      this.state.openedAt = undefined;
      this.state.halfOpenCallCount = 0;
    } else if (state === 'half_open') {
      this.state.successCount = 0;
      this.state.halfOpenCallCount = 0;
    }

    await this.saveState();
    this.emit('state_change', { from: oldState, to: state, reason });
  }

  /**
   * Check if should attempt reset (private helper)
   */
  private shouldAttemptReset(): boolean {
    if (!this.state.openedAt) return false;

    const timeSinceOpened = Date.now() - this.state.openedAt;
    return timeSinceOpened >= this.config.timeout;
  }

  /**
   * Execute fallback (private helper)
   */
  private executeFallback<T>(fallback: FallbackConfig): T {
    const response = {
      status: fallback.status || 503,
      body: fallback.body || { error: 'Service unavailable' },
      headers: fallback.headers || {},
      contentType: fallback.contentType || 'application/json',
    };

    return response as T;
  }

  /**
   * Emit event (private helper)
   */
  private emit(event: CircuitEvent, data: unknown): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event, data);
        } catch (error) {
          console.error('Circuit breaker event listener error:', error);
        }
      }
    }
  }

  /**
   * Load state from KV (private helper)
   */
  private async loadState(): Promise<void> {
    if (!this.kv) return;

    try {
      const key = this.getStorageKey();
      const data = await this.kv.get(key, 'json');

      if (data && typeof data === 'object') {
        const savedState = data as CircuitBreakerState;
        this.state = { ...this.state, ...savedState };
      }
    } catch (error) {
      console.error('Circuit breaker KV load error:', error);
    }
  }

  /**
   * Save state to KV (private helper)
   */
  private async saveState(): Promise<void> {
    if (!this.kv) return;

    try {
      const key = this.getStorageKey();
      await this.kv.put(key, JSON.stringify(this.state), {
        expirationTtl: 3600, // 1 hour
      });
    } catch (error) {
      console.error('Circuit breaker KV save error:', error);
    }
  }

  /**
   * Get storage key (private helper)
   */
  private getStorageKey(): string {
    return `circuit-breaker:${this.state.name}`;
  }
}

/**
 * Circuit metrics
 */
interface CircuitMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  rejectedCalls: number;
  avgResponseTime: number;
  stateChanges: number;
  lastResetTime: number;
}

/**
 * Circuit Breaker Registry
 *
 * Manages multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker>;
  private kv?: KVNamespace;

  constructor(kv?: KVNamespace) {
    this.breakers = new Map();
    this.kv = kv;
  }

  /**
   * Get or create a circuit breaker
   */
  get(name: string, config?: CircuitBreakerConfig): CircuitBreaker {
    let breaker = this.breakers.get(name);

    if (!breaker) {
      breaker = new CircuitBreaker(
        {
          ...config,
          enabled: config?.enabled ?? true,
          failureThreshold: config?.failureThreshold ?? 5,
          successThreshold: config?.successThreshold ?? 2,
          timeout: config?.timeout ?? 60000,
          halfOpenMaxCalls: config?.halfOpenMaxCalls ?? 3,
          slidingWindowSize: config?.slidingWindowSize ?? 100,
        } as CircuitBreakerConfig,
        this.kv
      );
      this.breakers.set(name, breaker);
    }

    return breaker;
  }

  /**
   * Remove a circuit breaker
   */
  delete(name: string): boolean {
    return this.breakers.delete(name);
  }

  /**
   * Get all circuit breakers
   */
  getAll(): CircuitBreaker[] {
    return Array.from(this.breakers.values());
  }

  /**
   * Get stats for all circuit breakers
   */
  getAllStats(): Map<string, CircuitBreakerStats> {
    const stats = new Map<string, CircuitBreakerStats>();

    for (const [name, breaker] of this.breakers) {
      stats.set(name, breaker.getStats());
    }

    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  async resetAll(): Promise<void> {
    const promises = Array.from(this.breakers.values()).map(b => b.reset());
    await Promise.all(promises);
  }
}

/**
 * Create a circuit breaker
 */
export function createCircuitBreaker(
  _name: string,
  config?: Partial<CircuitBreakerConfig>,
  kv?: KVNamespace
): CircuitBreaker {
  return new CircuitBreaker(
    {
      enabled: config?.enabled ?? true,
      failureThreshold: config?.failureThreshold ?? 5,
      successThreshold: config?.successThreshold ?? 2,
      timeout: config?.timeout ?? 60000,
      halfOpenMaxCalls: config?.halfOpenMaxCalls ?? 3,
      slidingWindowSize: config?.slidingWindowSize ?? 100,
    } as CircuitBreakerConfig,
    kv
  );
}

/**
 * Create a circuit breaker registry
 */
export function createCircuitBreakerRegistry(kv?: KVNamespace): CircuitBreakerRegistry {
  return new CircuitBreakerRegistry(kv);
}
