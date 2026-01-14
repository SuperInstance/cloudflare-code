/**
 * Retry utilities with exponential backoff
 */

import { isRetryableError, isNetworkError } from './errors.js';

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: Set<string>;
  onRetry?: (attempt: number, error: Error) => void;
}

export const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateDelay(
  attempt: number,
  config: RetryConfig
): number {
  const exponentialDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // Add 0-30% jitter
  const delay = exponentialDelay + jitter;

  return Math.min(delay, config.maxDelay);
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = defaultRetryConfig
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const isRetryable =
        isRetryableError(error) || isNetworkError(error);

      if (!isRetryable || attempt >= config.maxRetries) {
        throw error;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, config);

      // Call retry callback if provided
      config.onRetry?.(attempt + 1, lastError);

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Create a retry-aware fetch wrapper
 */
export function createRetryFetch(
  fetchFn: typeof fetch,
  config: RetryConfig = defaultRetryConfig
): typeof fetch {
  return async (input, init) => {
    return retryWithBackoff(async () => {
      const response = await fetchFn(input, init);

      // Throw error for non-retryable status codes
      if (!response.ok && !isRetryableStatus(response.status)) {
        return response;
      }

      return response;
    }, config);
  };
}

/**
 * Check if HTTP status is retryable
 */
function isRetryableStatus(status: number): boolean {
  return (
    status === 408 || // Request Timeout
    status === 429 || // Too Many Requests
    status === 500 || // Internal Server Error
    status === 502 || // Bad Gateway
    status === 503 || // Service Unavailable
    status === 504 // Gateway Timeout
  );
}
