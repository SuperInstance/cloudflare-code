/**
 * Retry Logic with Exponential Backoff and Jitter
 *
 * Implements sophisticated retry logic with:
 * - Exponential backoff (delay doubles with each retry)
 * - Jitter to prevent thundering herd
 * - Configurable retry conditions
 * - Maximum attempt limits
 * - Per-attempt timeout handling
 *
 * Features:
 * - Automatic retry on transient failures
 * - Configurable backoff strategy
 * - Jitter for distributed systems
 * - Retry condition predicates
 * - Detailed retry metrics
 */

export interface RetryOptions {
  /**
   * Maximum number of retry attempts (excluding initial attempt)
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Base delay in milliseconds
   * @default 1000 (1 second)
   */
  baseDelay?: number;

  /**
   * Maximum delay in milliseconds
   * @default 60000 (60 seconds)
   */
  maxDelay?: number;

  /**
   * Backoff multiplier (exponential)
   * @default 2 (doubles each time)
   */
  backoffMultiplier?: number;

  /**
   * Jitter factor (0-1) to add randomness
   * @default 0.1 (10% jitter)
   */
  jitterFactor?: number;

  /**
   * Custom retry condition predicate
   * @default undefined (use default retry conditions)
   */
  shouldRetry?: (error: Error, attempt: number) => boolean;

  /**
   * Callback after each retry attempt
   */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

/**
 * Retry result with metadata
 */
export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDelay: number;
}

/**
 * Retry Policy
 *
 * @example
 * ```typescript
 * const retry = new RetryPolicy({
 *   maxAttempts: 3,
 *   baseDelay: 1000,
 *   maxDelay: 60000,
 *   backoffMultiplier: 2,
 *   jitterFactor: 0.1
 * });
 *
 * try {
 *   const result = await retry.execute(async () => {
 *     return await fetchFromAPI();
 *   });
 * } catch (error) {
 *   // All retries exhausted
 * }
 * ```
 */
export class RetryPolicy {
  private options: Required<RetryOptions>;

  constructor(options: RetryOptions = {}) {
    this.options = {
      maxAttempts: options.maxAttempts ?? 3,
      baseDelay: options.baseDelay ?? 1000,
      maxDelay: options.maxDelay ?? 60000,
      backoffMultiplier: options.backoffMultiplier ?? 2,
      jitterFactor: options.jitterFactor ?? 0.1,
      shouldRetry: options.shouldRetry ?? this.defaultShouldRetry,
      onRetry: options.onRetry ?? (() => {}),
    };
  }

  /**
   * Execute a function with retry logic
   *
   * @param fn - Function to execute
   * @param options - Override default retry options
   * @returns Promise<T> - Result of the function
   * @throws Error if all retries exhausted
   */
  async execute<T>(
    fn: () => Promise<T>,
    options?: RetryOptions
  ): Promise<T> {
    const mergedOptions = { ...this.options, ...options };
    let lastError: Error;
    let totalDelay = 0;

    for (let attempt = 0; attempt <= mergedOptions.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if should retry
        if (
          attempt >= mergedOptions.maxAttempts ||
          !mergedOptions.shouldRetry(lastError, attempt)
        ) {
          throw lastError;
        }

        // Calculate delay
        const delay = this.calculateDelay(attempt, mergedOptions);
        totalDelay += delay;

        // Call onRetry callback
        mergedOptions.onRetry(lastError, attempt + 1, delay);

        // Wait before retry
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Execute with detailed result metadata
   *
   * @param fn - Function to execute
   * @param options - Override default retry options
   * @returns Promise<RetryResult<T>> - Result with metadata
   */
  async executeWithResult<T>(
    fn: () => Promise<T>,
    options?: RetryOptions
  ): Promise<RetryResult<T>> {
    const mergedOptions = { ...this.options, ...options };
    let lastError: Error;
    let totalDelay = 0;

    for (let attempt = 0; attempt <= mergedOptions.maxAttempts; attempt++) {
      try {
        const data = await fn();
        return {
          success: true,
          data,
          attempts: attempt + 1,
          totalDelay,
        };
      } catch (error) {
        lastError = error as Error;

        // Check if should retry
        if (
          attempt >= mergedOptions.maxAttempts ||
          !mergedOptions.shouldRetry(lastError, attempt)
        ) {
          return {
            success: false,
            error: lastError,
            attempts: attempt + 1,
            totalDelay,
          };
        }

        // Calculate delay
        const delay = this.calculateDelay(attempt, mergedOptions);
        totalDelay += delay;

        // Call onRetry callback
        mergedOptions.onRetry(lastError, attempt + 1, delay);

        // Wait before retry
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: lastError!,
      attempts: mergedOptions.maxAttempts + 1,
      totalDelay,
    };
  }

  /**
   * Calculate delay for a given attempt
   *
   * @param attempt - Attempt number (0-indexed)
   * @param options - Retry options
   * @returns Delay in milliseconds
   */
  private calculateDelay(attempt: number, options: Required<RetryOptions>): number {
    // Exponential backoff: baseDelay * (backoffMultiplier ^ attempt)
    const exponentialDelay =
      options.baseDelay * Math.pow(options.backoffMultiplier, attempt);

    // Add jitter to prevent thundering herd
    const jitter =
      exponentialDelay * options.jitterFactor * (Math.random() * 2 - 1);

    // Apply max delay cap
    const delay = Math.min(exponentialDelay + jitter, options.maxDelay);

    // Ensure minimum delay of 1ms
    return Math.max(1, Math.floor(delay));
  }

  /**
   * Default retry condition predicate
   *
   * Retries on:
   * - Rate limit errors (429)
   * - Server errors (5xx)
   * - Network errors
   * - Timeout errors
   */
  private defaultShouldRetry(error: Error, _attempt: number): boolean {
    // Check for status code (for fetch/API errors)
    const statusCode = (error as any).status;
    if (statusCode) {
      // Retry on rate limits
      if (statusCode === 429) {
        return true;
      }

      // Retry on server errors (5xx)
      if (statusCode >= 500 && statusCode < 600) {
        return true;
      }

      // Retry on request timeout (408)
      if (statusCode === 408) {
        return true;
      }
    }

    // Check for network errors
    const errorCode = (error as any).code;
    if (errorCode) {
      // Retry on connection errors
      const retryableCodes = [
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ENETUNREACH',
        'EPIPE',
      ];
      if (retryableCodes.includes(errorCode)) {
        return true;
      }
    }

    // Check error message for retryable patterns
    const message = error.message?.toLowerCase() || '';
    const retryablePatterns = [
      'timeout',
      'network',
      'connection',
      'rate limit',
      'temporarily unavailable',
      'service unavailable',
      'gateway timeout',
    ];

    return retryablePatterns.some(pattern => message.includes(pattern));
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a retry policy for API calls
 *
 * @param maxAttempts - Maximum retry attempts
 * @returns RetryPolicy instance
 */
export function createAPIRetryPolicy(
  maxAttempts: number = 3
): RetryPolicy {
  return new RetryPolicy({
    maxAttempts,
    baseDelay: 1000,
    maxDelay: 60000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
  });
}

/**
 * Create a retry policy for quick retries (for transient issues)
 *
 * @param maxAttempts - Maximum retry attempts
 * @returns RetryPolicy instance
 */
export function createQuickRetryPolicy(
  maxAttempts: number = 5
): RetryPolicy {
  return new RetryPolicy({
    maxAttempts,
    baseDelay: 100,
    maxDelay: 5000,
    backoffMultiplier: 1.5,
    jitterFactor: 0.2,
  });
}

/**
 * Create a retry policy for long-running operations
 *
 * @param maxAttempts - Maximum retry attempts
 * @returns RetryPolicy instance
 */
export function createLongRunningRetryPolicy(
  maxAttempts: number = 10
): RetryPolicy {
  return new RetryPolicy({
    maxAttempts,
    baseDelay: 5000,
    maxDelay: 300000, // 5 minutes
    backoffMultiplier: 2,
    jitterFactor: 0.15,
  });
}

/**
 * Execute function with retry (convenience function)
 *
 * @param fn - Function to execute
 * @param maxAttempts - Maximum retry attempts
 * @returns Promise<T> - Result of the function
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  const policy = new RetryPolicy({ maxAttempts });
  return policy.execute(fn);
}
