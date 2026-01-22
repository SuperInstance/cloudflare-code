/**
 * Retry Policy Implementation
 * Handles retry logic with various backoff strategies
 */

import {
  RetryPolicy,
  RetryAttempt,
  RetryResult,
  BackoffCalculator,
  ServiceError
} from '../types';

const DEFAULT_RETRY_POLICY: Partial<RetryPolicy> = {
  maxAttempts: 3,
  initialBackoff: 1000,
  maxBackoff: 30000,
  backoffMultiplier: 2,
  jitterEnabled: true,
  jitterFactor: 0.1,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableErrors: [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    'EPIPE',
    'TIMEOUT',
    'NETWORK_ERROR'
  ]
};

export interface RetryExecutorOptions {
  policy?: Partial<RetryPolicy>;
  onRetry?: (attempt: RetryAttempt) => void;
  onSuccess?: (result: RetryResult) => void;
  onFailure?: (result: RetryResult) => void;
  timeout?: number;
}

export class RetryExecutor {
  private policy: RetryPolicy;
  private options: RetryExecutorOptions;

  constructor(options: RetryExecutorOptions = {}) {
    this.policy = { ...DEFAULT_RETRY_POLICY, ...options.policy } as RetryPolicy;
    this.options = options;
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    context?: { operation?: string; metadata?: Record<string, any> }
  ): Promise<T> {
    const attempts: RetryAttempt[] = [];
    let lastError: ServiceError | null = null;
    const startTime = Date.now();

    for (let attemptNumber = 1; attemptNumber <= this.policy.maxAttempts; attemptNumber++) {
      const attemptStartTime = Date.now();

      try {
        // Execute the function
        const result = await fn();

        const attempt: RetryAttempt = {
          attemptNumber,
          timestamp: attemptStartTime,
          duration: Date.now() - attemptStartTime,
          success: true
        };

        attempts.push(attempt);

        // Notify success
        const retryResult: RetryResult = {
          success: true,
          attempts,
          totalDuration: Date.now() - startTime
        };

        if (this.options.onSuccess) {
          this.options.onSuccess(retryResult);
        }

        return result;

      } catch (error) {
        const normalizedError = this.normalizeError(error);
        lastError = normalizedError;

        const attempt: RetryAttempt = {
          attemptNumber,
          timestamp: attemptStartTime,
          error: normalizedError,
          duration: Date.now() - attemptStartTime,
          success: false
        };

        attempts.push(attempt);

        // Notify retry attempt
        if (this.options.onRetry) {
          this.options.onRetry(attempt);
        }

        // Check if we should retry
        if (attemptNumber < this.policy.maxAttempts && this.isRetryable(normalizedError)) {
          // Calculate backoff delay
          const delay = this.calculateBackoff(attemptNumber);

          // Wait before retrying
          await this.sleep(delay);
        } else {
          // No more retries or non-retryable error
          break;
        }
      }
    }

    // All retries exhausted
    const retryResult: RetryResult = {
      success: false,
      attempts,
      totalDuration: Date.now() - startTime,
      finalError: lastError || undefined
    };

    if (this.options.onFailure) {
      this.options.onFailure(retryResult);
    }

    throw this.createRetryExhaustedError(retryResult);
  }

  /**
   * Execute with timeout
   */
  async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number,
    context?: { operation?: string; metadata?: Record<string, any> }
  ): Promise<T> {
    return Promise.race([
      this.execute(fn, context),
      new Promise<T>((_, reject) =>
        setTimeout(() => {
          reject(new Error(`Operation timeout after ${timeout}ms`));
        }, timeout)
      )
    ]);
  }

  /**
   * Calculate backoff delay for a given attempt
   */
  calculateBackoff(attemptNumber: number): number {
    // Exponential backoff
    let delay = this.policy.initialBackoff * Math.pow(this.policy.backoffMultiplier, attemptNumber - 1);

    // Cap at max backoff
    delay = Math.min(delay, this.policy.maxBackoff);

    // Add jitter if enabled
    if (this.policy.jitterEnabled) {
      delay = this.addJitter(delay);
    }

    return delay;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error: ServiceError): boolean {
    // Check if error is explicitly marked as retryable
    if (error.retryable) {
      return true;
    }

    // Check error code
    if (this.policy.retryableErrors.includes(error.code)) {
      return true;
    }

    // Check HTTP status code
    if (error.statusCode && this.policy.retryableStatuses.includes(error.statusCode)) {
      return true;
    }

    return false;
  }

  /**
   * Get current retry policy
   */
  getPolicy(): RetryPolicy {
    return { ...this.policy };
  }

  /**
   * Update retry policy
   */
  updatePolicy(updates: Partial<RetryPolicy>): void {
    this.policy = { ...this.policy, ...updates };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private normalizeError(error: unknown): ServiceError {
    if (this.isServiceError(error)) {
      return error;
    }

    if (error instanceof Error) {
      return {
        code: this.getErrorCode(error),
        message: error.message,
        details: error,
        retryable: this.isRetryableErrorCode(this.getErrorCode(error)),
        statusCode: this.getErrorStatusCode(error)
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

  private getErrorCode(error: Error): string {
    // Try to extract error code from error message or name
    const message = error.message;
    const name = error.name;

    // Check for common network errors
    const networkErrors = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      'EPIPE'
    ];

    for (const code of networkErrors) {
      if (message.includes(code) || name.includes(code)) {
        return code;
      }
    }

    // Check for timeout
    if (message.includes('timeout') || name.includes('Timeout')) {
      return 'TIMEOUT';
    }

    // Check for network error
    if (message.includes('network') || message.includes('fetch')) {
      return 'NETWORK_ERROR';
    }

    return name || 'UNKNOWN_ERROR';
  }

  private getErrorStatusCode(error: Error): number | undefined {
    const message = error.message;

    // Try to extract status code from error message
    const match = message.match(/status\s+code\s+(\d+)/i);
    if (match) {
      return parseInt(match[1], 10);
    }

    return undefined;
  }

  private isRetryableErrorCode(code: string): boolean {
    return this.policy.retryableErrors.includes(code);
  }

  private addJitter(delay: number): number {
    const jitter = delay * this.policy.jitterFactor;
    const randomJitter = (Math.random() * 2 - 1) * jitter; // Random between -jitter and +jitter
    return Math.max(0, delay + randomJitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private createRetryExhaustedError(result: RetryResult): Error {
    const error = new Error(
      `Retry attempts exhausted after ${result.attempts.length} attempts. ` +
      `Final error: ${result.finalError?.message || 'Unknown error'}`
    );

    (error as any).code = 'RETRY_EXHAUSTED';
    (error as any).retryable = false;
    (error as any).attempts = result.attempts;
    (error as any).totalDuration = result.totalDuration;

    return error;
  }
}

// ========================================================================
// Backoff Strategies
// ========================================================================

export class BackoffStrategies {
  /**
   * Exponential backoff with jitter
   */
  static exponentialWithJitter: BackoffCalculator = (attempt, baseDelay) => {
    const delay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = delay * 0.1;
    return Math.max(0, delay + (Math.random() * 2 - 1) * jitter);
  };

  /**
   * Linear backoff
   */
  static linear: BackoffCalculator = (attempt, baseDelay) => {
    return baseDelay * attempt;
  };

  /**
   * Linear backoff with jitter
   */
  static linearWithJitter: BackoffCalculator = (attempt, baseDelay) => {
    const delay = baseDelay * attempt;
    const jitter = delay * 0.1;
    return Math.max(0, delay + (Math.random() * 2 - 1) * jitter);
  };

  /**
   * Fixed delay with jitter
   */
  static fixed: BackoffCalculator = (attempt, baseDelay) => {
    return baseDelay;
  };

  /**
   * Fixed delay with jitter
   */
  static fixedWithJitter: BackoffCalculator = (attempt, baseDelay) => {
    const jitter = baseDelay * 0.1;
    return Math.max(0, baseDelay + (Math.random() * 2 - 1) * jitter);
  };

  /**
   * Custom backoff with full jitter (recommended for distributed systems)
   */
  static fullJitter: BackoffCalculator = (attempt, baseDelay) => {
    const cap = baseDelay * Math.pow(2, attempt - 1);
    return Math.random() * cap;
  };

  /**
   * Decorrelated jitter (prevents thundering herd)
   */
  static decorrelatedJitter: BackoffCalculator = (attempt, baseDelay, previousDelay?: number) => {
    const cap = baseDelay * Math.pow(2, attempt - 1);
    const prev = previousDelay || baseDelay;
    return Math.min(cap, prev * 3 + Math.random() * baseDelay);
  };

  /**
   * Exponential backoff with equal jitter
   */
  static equalJitter: BackoffCalculator = (attempt, baseDelay) => {
    const delay = baseDelay * Math.pow(2, attempt - 1);
    return delay / 2 + Math.random() * (delay / 2);
  };
}

// ========================================================================
// Retry Condition Builders
// ============================================================================

export class RetryConditions {
  /**
   * Retry on specific HTTP status codes
   */
  static onStatusCodes(...codes: number[]): (error: ServiceError) => boolean {
    return (error: ServiceError) => {
      return error.statusCode !== undefined && codes.includes(error.statusCode);
    };
  }

  /**
   * Retry on specific error codes
   */
  static onErrorCodes(...codes: string[]): (error: ServiceError) => boolean {
    return (error: ServiceError) => {
      return codes.includes(error.code);
    };
  }

  /**
   * Retry on network errors
   */
  static onNetworkErrors(): (error: ServiceError) => boolean {
    return (error: ServiceError) => {
      const networkCodes = [
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'EAI_AGAIN',
        'EPIPE',
        'NETWORK_ERROR'
      ];
      return networkCodes.includes(error.code);
    };
  }

  /**
   * Retry on timeout errors
   */
  static onTimeouts(): (error: ServiceError) => boolean {
    return (error: ServiceError) => {
      return error.code === 'TIMEOUT' || error.code === 'ETIMEDOUT';
    };
  }

  /**
   * Retry on rate limit errors
   */
  static onRateLimits(): (error: ServiceError) => boolean {
    return (error: ServiceError) => {
      return error.statusCode === 429 || error.code === 'RATE_LIMIT_EXCEEDED';
    };
  }

  /**
   * Retry on server errors (5xx)
   */
  static onServerErrors(): (error: ServiceError) => boolean {
    return (error: ServiceError) => {
      return error.statusCode !== undefined && error.statusCode >= 500 && error.statusCode < 600;
    };
  }

  /**
   * Combine multiple conditions with OR logic
   */
  static any(...conditions: Array<(error: ServiceError) => boolean>): (error: ServiceError) => boolean {
    return (error: ServiceError) => {
      return conditions.some(condition => condition(error));
    };
  }

  /**
   * Combine multiple conditions with AND logic
   */
  static all(...conditions: Array<(error: ServiceError) => boolean>): (error: ServiceError) => boolean {
    return (error: ServiceError) => {
      return conditions.every(condition => condition(error));
    };
  }

  /**
   * Negate a condition
   */
  static not(condition: (error: ServiceError) => boolean): (error: ServiceError) => boolean {
    return (error: ServiceError) => !condition(error);
  }
}

// ========================================================================
// Retry Decorator
// ========================================================================

export function retryable(options: RetryExecutorOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const executor = new RetryExecutor(options);

    descriptor.value = async function (...args: any[]) {
      return executor.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
