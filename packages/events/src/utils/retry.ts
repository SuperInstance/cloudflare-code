/**
 * Retry utilities for event processing
 */

import type { RetryPolicy } from '../types/saga';

// ============================================================================
// Retry Delays
// ============================================================================

/**
 * Calculate delay based on retry policy
 */
export function calculateRetryDelay(
  attempt: number,
  policy: RetryPolicy
): number {
  let delay: number;

  switch (policy.backoffType) {
    case 'fixed':
      delay = policy.initialDelayMs;
      break;

    case 'linear':
      delay = policy.initialDelayMs * attempt;
      break;

    case 'exponential':
      delay = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
      break;

    default:
      delay = policy.initialDelayMs;
  }

  // Apply maximum delay cap
  return Math.min(delay, policy.maxDelayMs);
}

/**
 * Calculate if a retry should be attempted
 */
export function shouldRetry(attempt: number, policy: RetryPolicy): boolean {
  return attempt <= policy.maxAttempts;
}

/**
 * Calculate the next attempt number
 */
export function getNextAttempt(currentAttempt: number, policy: RetryPolicy): number | null {
  const nextAttempt = currentAttempt + 1;
  return shouldRetry(nextAttempt, policy) ? nextAttempt : null;
}

// ============================================================================
// Retry Strategy
// ============================================================================

/**
 * Execute a function with retry logic
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error | undefined;
  let attempt = 1;

  while (shouldRetry(attempt, policy)) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!shouldRetry(attempt + 1, policy)) {
        throw lastError;
      }

      if (onRetry) {
        onRetry(attempt, lastError);
      }

      const delay = calculateRetryDelay(attempt, policy);
      await sleep(delay);
      attempt++;
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Execute a function with exponential backoff
 */
export async function executeWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    multiplier?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const policy: RetryPolicy = {
    maxAttempts: options.maxAttempts ?? 3,
    initialDelayMs: options.initialDelayMs ?? 1000,
    maxDelayMs: options.maxDelayMs ?? 30000,
    backoffMultiplier: options.multiplier ?? 2,
    backoffType: 'exponential',
  };

  return executeWithRetry(fn, policy, options.onRetry);
}

/**
 * Execute a function with linear backoff
 */
export async function executeWithLinearBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const policy: RetryPolicy = {
    maxAttempts: options.maxAttempts ?? 3,
    initialDelayMs: options.initialDelayMs ?? 1000,
    maxDelayMs: options.maxDelayMs ?? 30000,
    backoffMultiplier: 1,
    backoffType: 'linear',
  };

  return executeWithRetry(fn, policy, options.onRetry);
}

// ============================================================================
// Circuit Breaker
// ============================================================================

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  monitorPeriodMs: number;
}

export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open',
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;

  constructor(private options: CircuitBreakerOptions) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.transitionTo(CircuitBreakerState.HALF_OPEN);
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

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 2) {
        this.transitionTo(CircuitBreakerState.CLOSED);
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (
      this.state === CircuitBreakerState.HALF_OPEN ||
      this.failureCount >= this.options.failureThreshold
    ) {
      this.transitionTo(CircuitBreakerState.OPEN);
      this.nextAttemptTime = Date.now() + this.options.resetTimeoutMs;
    }
  }

  private transitionTo(newState: CircuitBreakerState): void {
    this.state = newState;
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }
}

// ============================================================================
// Bulkhead
// ============================================================================

export class Bulkhead {
  private running = 0;
  private queue: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];

  constructor(private maxConcurrent: number) {}

  /**
   * Execute a function with bulkhead protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();

    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }

    return new Promise((resolve, reject) => {
      this.queue.push({
        resolve: () => {
          this.running++;
          resolve();
        },
        reject,
      });
    });
  }

  private release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.resolve();
    } else {
      this.running--;
    }
  }

  getRunningCount(): number {
    return this.running;
  }

  getQueuedCount(): number {
    return this.queue.length;
  }
}

// ============================================================================
// Timeout
// ============================================================================

/**
 * Execute a function with a timeout
 */
export async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutError: Error = new Error('Operation timed out')
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(timeoutError), timeoutMs)
    ),
  ]);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry with jitter to avoid thundering herd
 */
export async function executeWithJitter<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy,
  jitterMs: number = 100
): Promise<T> {
  let attempt = 1;
  let lastError: Error | undefined;

  while (shouldRetry(attempt, policy)) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!shouldRetry(attempt + 1, policy)) {
        throw lastError;
      }

      const baseDelay = calculateRetryDelay(attempt, policy);
      const jitter = Math.random() * jitterMs;
      await sleep(baseDelay + jitter);
      attempt++;
    }
  }

  throw lastError || new Error('Max retries exceeded');
}
