// @ts-nocheck
/**
 * Backpressure handling implementation
 * Provides flow control, rate limiting, and circuit breaking
 */

import type {
  BackpressureStrategy,
  FlowControlConfig,
  RetryPolicy,
  CircuitBreakerConfig,
  CircuitBreakerState
} from '../types/index.js';
import { TokenBucket, SlidingWindowRateLimiter } from '../utils/timing.js';

// ============================================================================
// Backpressure Controller
// ============================================================================

export class BackpressureController {
  private strategy: BackpressureStrategy;
  private buffer: Array<{ item: unknown; priority: number }> = [];
  private processing = false;
  private stats: BackpressureStats = {
    accepted: 0,
    rejected: 0,
    buffered: 0,
    processed: 0,
    dropped: 0,
  };

  constructor(strategy: BackpressureStrategy) {
    this.strategy = strategy;
  }

  /**
   * Process an item with backpressure
   */
  async process<T>(
    item: T,
    processor: (item: T) => Promise<void>,
    options: {
      priority?: number;
    } = {}
  ): Promise<BackpressureResult> {
    const priority = options.priority ?? 5;

    switch (this.strategy.type) {
      case 'drop':
        return this.processWithDrop(item, processor, priority);

      case 'buffer':
        return await this.processWithBuffer(item, processor, priority);

      case 'throttle':
        return await this.processWithThrottle(item, processor);

      case 'reject':
        return this.processWithReject(item, processor);

      case 'custom':
        if (this.strategy.customHandler) {
          await this.strategy.customHandler(item);
          return { status: 'accepted' };
        }
        return { status: 'rejected', reason: 'No custom handler defined' };

      default:
        return { status: 'accepted' };
    }
  }

  /**
   * Process with drop strategy
   */
  private processWithDrop<T>(
    item: T,
    processor: (item: T) => Promise<void>,
    priority: number
  ): BackpressureResult {
    if (this.buffer.length >= (this.strategy.bufferSize ?? 1000)) {
      // Drop based on policy
      let dropIndex = 0;

      switch (this.strategy.dropPolicy) {
        case 'oldest':
          dropIndex = 0;
          break;
        case 'newest':
          dropIndex = this.buffer.length - 1;
          break;
        case 'lowest-priority':
          dropIndex = this.buffer.findIndex(b => b.priority === Math.min(...this.buffer.map(b => b.priority)));
          break;
      }

      this.buffer.splice(dropIndex, 1);
      this.stats.dropped++;
    }

    this.buffer.push({ item, priority });
    this.stats.accepted++;

    // Process asynchronously
    this.processBuffer(processor).catch(console.error);

    return { status: 'accepted' };
  }

  /**
   * Process with buffer strategy
   */
  private async processWithBuffer<T>(
    item: T,
    processor: (item: T) => Promise<void>,
    priority: number
  ): Promise<BackpressureResult> {
    const maxSize = this.strategy.bufferSize ?? 1000;

    if (this.buffer.length >= maxSize) {
      return {
        status: 'rejected',
        reason: 'Buffer full',
        bufferSize: this.buffer.length,
      };
    }

    this.buffer.push({ item, priority });
    this.stats.buffered++;
    this.stats.accepted++;

    // Process buffer
    if (!this.processing) {
      this.processing = true;
      await this.processBuffer(processor);
      this.processing = false;
    }

    return { status: 'accepted' };
  }

  /**
   * Process with throttle strategy
   */
  private async processWithThrottle<T>(
    item: T,
    processor: (item: T) => Promise<void>
  ): Promise<BackpressureResult> {
    if (!this.rateLimiter) {
      this.rateLimiter = new TokenBucket(
        this.strategy.throttleRate ?? 100,
        this.strategy.throttleRate ?? 100
      );
    }

    const allowed = await this.rateLimiter.tryConsume(1);

    if (!allowed) {
      return {
        status: 'rejected',
        reason: 'Rate limit exceeded',
        retryAfter: 1000 / (this.strategy.throttleRate ?? 100),
      };
    }

    try {
      await processor(item);
      this.stats.processed++;
      this.stats.accepted++;
      return { status: 'accepted' };
    } catch (error) {
      this.stats.rejected++;
      return {
        status: 'rejected',
        reason: 'Processing failed',
        error: error as Error,
      };
    }
  }

  /**
   * Process with reject strategy
   */
  private processWithReject<T>(
    item: T,
    processor: (item: T) => Promise<void>
  ): BackpressureResult {
    const maxSize = this.strategy.bufferSize ?? 100;

    if (this.buffer.length >= maxSize) {
      this.stats.rejected++;
      return {
        status: 'rejected',
        reason: 'Overloaded',
        bufferSize: this.buffer.length,
      };
    }

    this.buffer.push({ item, priority: 5 });
    this.stats.accepted++;

    // Process asynchronously
    this.processBuffer(processor).catch(console.error);

    return { status: 'accepted' };
  }

  /**
   * Process buffered items
   */
  private async processBuffer<T>(processor: (item: T) => Promise<void>): Promise<void> {
    while (this.buffer.length > 0) {
      // Sort by priority (higher priority first)
      this.buffer.sort((a, b) => b.priority - a.priority);

      const { item } = this.buffer.shift()!;

      try {
        await processor(item as T);
        this.stats.processed++;
      } catch (error) {
        console.error('Processing error:', error);
        this.stats.rejected++;
      }
    }
  }

  private rateLimiter?: TokenBucket;

  /**
   * Get current statistics
   */
  getStats(): BackpressureStats {
    return { ...this.stats };
  }

  /**
   * Get buffer size
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Clear buffer
   */
  clearBuffer(): void {
    this.buffer = [];
    this.stats.buffered = 0;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      accepted: 0,
      rejected: 0,
      buffered: 0,
      processed: 0,
      dropped: 0,
    };
  }

  /**
   * Update strategy
   */
  updateStrategy(strategy: Partial<BackpressureStrategy>): void {
    this.strategy = { ...this.strategy, ...strategy };
  }
}

// ============================================================================
// Flow Controller
// ============================================================================

export class FlowController {
  private config: Required<FlowControlConfig>;
  private activeRequests = 0;
  private requestQueue: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
  private circuitBreaker?: CircuitBreaker;

  constructor(config: FlowControlConfig) {
    this.config = {
      windowSize: config.windowSize ?? 10,
      maxConcurrent: config.maxConcurrent ?? 100,
      timeout: config.timeout ?? 30000,
      retryPolicy: config.retryPolicy ?? {
        maxAttempts: 3,
        backoff: 'exponential',
        initialDelay: 1000,
        maxDelay: 30000,
      },
      circuitBreaker: config.circuitBreaker ?? undefined,
    };

    if (config.circuitBreaker) {
      this.circuitBreaker = new CircuitBreaker(config.circuitBreaker);
    }
  }

  /**
   * Execute request with flow control
   */
  async execute<T>(
    request: () => Promise<T>,
    options: {
      timeout?: number;
      retries?: boolean;
    } = {}
  ): Promise<T> {
    // Check circuit breaker
    if (this.circuitBreaker) {
      await this.circuitBreaker.waitForReady();
    }

    // Wait for slot
    await this.acquireSlot();

    try {
      // Execute with timeout
      const timeout = options.timeout ?? this.config.timeout;
      const result = await this.withTimeout(request(), timeout);

      // Record success
      if (this.circuitBreaker) {
        this.circuitBreaker.recordSuccess();
      }

      return result;
    } catch (error) {
      // Record failure
      if (this.circuitBreaker) {
        this.circuitBreaker.recordFailure();
      }

      // Retry if enabled
      if (options.retries !== false) {
        return this.retry(request, error as Error);
      }

      throw error;
    } finally {
      this.releaseSlot();
    }
  }

  /**
   * Acquire execution slot
   */
  private async acquireSlot(): Promise<void> {
    if (this.activeRequests < this.config.maxConcurrent) {
      this.activeRequests++;
      return;
    }

    // Wait for slot
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ resolve, reject });
    });
  }

  /**
   * Release execution slot
   */
  private releaseSlot(): void {
    this.activeRequests--;

    // Process queue
    if (this.requestQueue.length > 0 && this.activeRequests < this.config.maxConcurrent) {
      const next = this.requestQueue.shift();
      if (next) {
        this.activeRequests++;
        next.resolve();
      }
    }
  }

  /**
   * Execute with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      ),
    ]);
  }

  /**
   * Retry request
   */
  private async retry<T>(request: () => Promise<T>, lastError: Error): Promise<T> {
    const policy = this.config.retryPolicy;

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      try {
        await this.delay(policy.initialDelay * Math.pow(policy.multiplier ?? 2, attempt - 1));
        return await request();
      } catch (error) {
        if (attempt === policy.maxAttempts) {
          throw lastError;
        }
      }
    }

    throw lastError;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get active request count
   */
  getActiveRequestCount(): number {
    return this.activeRequests;
  }

  /**
   * Get circuit breaker state
   */
  getCircuitBreakerState(): CircuitBreakerState | undefined {
    return this.circuitBreaker?.getState();
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker?.reset();
  }
}

// ============================================================================
// Circuit Breaker
// ============================================================================

export class CircuitBreaker {
  private state: CircuitBreakerState = {
    state: 'closed',
    failureCount: 0,
    successCount: 0,
    lastStateChange: Date.now(),
  };

  private config: Required<CircuitBreakerConfig>;
  private halfOpenCalls = 0;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      successThreshold: config.successThreshold ?? 2,
      timeout: config.timeout ?? 60000,
      halfOpenMaxCalls: config.halfOpenMaxCalls ?? 3,
    };
  }

  /**
   * Record successful call
   */
  recordSuccess(): void {
    this.state.failureCount = 0;
    this.state.successCount++;

    if (this.state.state === 'half-open') {
      if (this.state.successCount >= this.config.successThreshold) {
        this.setState('closed');
      }
    } else if (this.state.state === 'closed') {
      this.state.successCount = 0;
    }
  }

  /**
   * Record failed call
   */
  recordFailure(): void {
    this.state.successCount = 0;
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();

    if (this.state.failureCount >= this.config.failureThreshold) {
      this.setState('open');
    }
  }

  /**
   * Wait for circuit breaker to be ready
   */
  async waitForReady(): Promise<void> {
    if (this.state.state === 'open') {
      const timeSinceLastFailure = Date.now() - (this.state.lastFailureTime ?? 0);

      if (timeSinceLastFailure >= this.config.timeout) {
        this.setState('half-open');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    if (this.state.state === 'half-open') {
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        throw new Error('Circuit breaker is in half-open state with max calls reached');
      }
      this.halfOpenCalls++;
    }
  }

  /**
   * Set circuit breaker state
   */
  private setState(state: 'closed' | 'open' | 'half-open'): void {
    this.state.state = state;
    this.state.lastStateChange = Date.now();
    this.halfOpenCalls = 0;

    if (state === 'closed') {
      this.state.failureCount = 0;
      this.state.successCount = 0;
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.setState('closed');
  }

  /**
   * Check if circuit is open
   */
  isOpen(): boolean {
    return this.state.state === 'open';
  }

  /**
   * Check if circuit is closed
   */
  isClosed(): boolean {
    return this.state.state === 'closed';
  }
}

// ============================================================================
// Rate Limiter
// ============================================================================

export class RateLimiter {
  private limiter: SlidingWindowRateLimiter;

  constructor(maxRequests: number, windowMs: number) {
    this.limiter = new SlidingWindowRateLimiter(maxRequests, windowMs);
  }

  /**
   * Try to make a request
   */
  async tryRequest(): Promise<boolean> {
    return this.limiter.tryRequest();
  }

  /**
   * Make a request (waits if necessary)
   */
  async request(): Promise<void> {
    await this.limiter.request();
  }

  /**
   * Get current request count
   */
  getRequestCount(): number {
    return this.limiter.getRequestCount();
  }

  /**
   * Reset rate limiter
   */
  reset(): void {
    this.limiter.reset();
  }
}

// ============================================================================
// Adaptive Throttler
// ============================================================================

export class AdaptiveThrottler {
  private currentRate: number;
  private minRate: number;
  private maxRate: number;
  private consecutiveErrors = 0;
  private consecutiveSuccesses = 0;
  private adjustmentFactor = 0.1;

  constructor(initialRate: number, minRate: number, maxRate: number) {
    this.currentRate = initialRate;
    this.minRate = minRate;
    this.maxRate = maxRate;
  }

  /**
   * Record success and adjust rate
   */
  recordSuccess(): void {
    this.consecutiveSuccesses++;
    this.consecutiveErrors = 0;

    if (this.consecutiveSuccesses >= 5) {
      this.increaseRate();
      this.consecutiveSuccesses = 0;
    }
  }

  /**
   * Record error and adjust rate
   */
  recordError(): void {
    this.consecutiveErrors++;
    this.consecutiveSuccesses = 0;

    if (this.consecutiveErrors >= 2) {
      this.decreaseRate();
      this.consecutiveErrors = 0;
    }
  }

  /**
   * Increase rate
   */
  private increaseRate(): void {
    this.currentRate = Math.min(
      this.maxRate,
      this.currentRate * (1 + this.adjustmentFactor)
    );
  }

  /**
   * Decrease rate
   */
  private decreaseRate(): void {
    this.currentRate = Math.max(
      this.minRate,
      this.currentRate * (1 - this.adjustmentFactor)
    );
  }

  /**
   * Get current rate
   */
  getCurrentRate(): number {
    return this.currentRate;
  }

  /**
   * Calculate wait time
   */
  getWaitTime(): number {
    return 1000 / this.currentRate;
  }

  /**
   * Reset throttler
   */
  reset(): void {
    this.consecutiveErrors = 0;
    this.consecutiveSuccesses = 0;
  }
}

// ============================================================================
// Types
// ============================================================================

export interface BackpressureStats {
  accepted: number;
  rejected: number;
  buffered: number;
  processed: number;
  dropped: number;
}

export interface BackpressureResult {
  status: 'accepted' | 'rejected';
  reason?: string;
  bufferSize?: number;
  retryAfter?: number;
  error?: Error;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create backpressure controller with default strategy
 */
export function createBackpressureController(
  strategy: BackpressureStrategy
): BackpressureController {
  return new BackpressureController(strategy);
}

/**
 * Create flow controller with default config
 */
export function createFlowController(config: FlowControlConfig): FlowController {
  return new FlowController(config);
}

/**
 * Create circuit breaker with default config
 */
export function createCircuitBreaker(config: CircuitBreakerConfig): CircuitBreaker {
  return new CircuitBreaker(config);
}

/**
 * Create rate limiter
 */
export function createRateLimiter(maxRequests: number, windowMs: number): RateLimiter {
  return new RateLimiter(maxRequests, windowMs);
}

/**
 * Create adaptive throttler
 */
export function createAdaptiveThrottler(
  initialRate: number,
  minRate: number,
  maxRate: number
): AdaptiveThrottler {
  return new AdaptiveThrottler(initialRate, minRate, maxRate);
}
