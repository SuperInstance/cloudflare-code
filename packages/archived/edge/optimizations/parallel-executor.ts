/**
 * Parallel Execution Utilities
 *
 * High-performance concurrent execution utilities for minimizing
 * response latency through parallelization.
 *
 * Features:
 * - Parallel execution of independent operations
 * - Timeout management
 * - Race conditions for provider selection
 * - Batch processing
 * - Result aggregation
 */

import type { ProviderClient } from '../lib/providers/base';
import type { ChatRequest, ChatResponse } from '@claudeflare/shared';

/**
 * Parallel execution options
 */
export interface ParallelOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Continue on error */
  continueOnError?: boolean;
  /** Maximum concurrent operations */
  concurrency?: number;
}

/**
 * Parallel execution result
 */
export interface ParallelResult<T> {
  /** Result value */
  value?: T;
  /** Error if failed */
  error?: Error;
  /** Execution time in milliseconds */
  duration: number;
  /** Index in original array */
  index: number;
  /** Success status */
  success: boolean;
}

/**
 * Batch execution options
 */
export interface BatchOptions<T> {
  /** Batch size */
  batchSize: number;
  /** Items to process */
  items: T[];
  /** Processor function */
  processor: (item: T, index: number) => Promise<any>;
  /** Continue on error */
  continueOnError?: boolean;
}

/**
 * Parallel executor
 */
export class ParallelExecutor {
  /**
   * Execute operations in parallel
   */
  async parallel<T>(
    operations: (() => Promise<T>)[],
    options: ParallelOptions = {}
  ): Promise<ParallelResult<T>[]> {
    const {
      timeout,
      continueOnError = true,
    } = options;

    const startTime = performance.now();
    const results: ParallelResult<T>[] = [];

    // Create promises with individual error handling
    const promises = operations.map(async (op, index) => {
      try {
        let opPromise = op();

        // Apply timeout if specified
        if (timeout) {
          opPromise = this.withTimeout(opPromise, timeout);
        }

        const value = await opPromise;
        const duration = performance.now() - startTime;

        return {
          value,
          duration,
          index,
          success: true,
        };
      } catch (error) {
        const duration = performance.now() - startTime;

        if (!continueOnError) {
          throw error;
        }

        return {
          error: error instanceof Error ? error : new Error(String(error)),
          duration,
          index,
          success: false,
        };
      }
    });

    // Wait for all to complete
    const settled = await Promise.all(promises);
    results.push(...settled);

    return results;
  }

  /**
   * Execute operations with concurrency limit
   */
  async parallelWithConcurrency<T>(
    operations: (() => Promise<T>)[],
    concurrency: number
  ): Promise<ParallelResult<T>[]> {
    const results: ParallelResult<T>[] = [];
    const executing: Promise<void>[] = [];

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const index = i;
      const startTime = performance.now();

      const promise = op()
        .then((value) => {
          results.push({
            value,
            duration: performance.now() - startTime,
            index,
            success: true,
          });
        })
        .catch((error) => {
          results.push({
            error: error instanceof Error ? error : new Error(String(error)),
            duration: performance.now() - startTime,
            index,
            success: false,
          });
        });

      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        // Remove completed promises
        executing.splice(
          executing.findIndex((p) => {
            // This is a simplified check
            return false;
          }),
          1
        );
      }
    }

    await Promise.all(executing);

    // Sort by original index
    return results.sort((a, b) => a.index - b.index);
  }

  /**
   * Execute operation with timeout
   */
  async withTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
      ),
    ]);
  }

  /**
   * Race multiple providers and return fastest result
   */
  async raceProviders(
    providers: ProviderClient[],
    request: ChatRequest,
    options: {
      timeout?: number;
      minSuccessRate?: number;
    } = {}
  ): Promise<{
    response: ChatResponse;
    provider: string;
    duration: number;
  }> {
    const { timeout = 30000, minSuccessRate = 0.5 } = options;
    const startTime = performance.now();

    // Filter providers by success rate
    const eligibleProviders = providers.filter(async (p) => {
      const health = await p.getHealthStatus();
      return health.successRate >= minSuccessRate;
    });

    if (eligibleProviders.length === 0) {
      throw new Error('No eligible providers');
    }

    // Race providers
    const raced = await Promise.race([
      ...eligibleProviders.map(async (provider) => {
        try {
          const response = await provider.chat(request);
          return {
            response,
            provider: provider.name,
            duration: performance.now() - startTime,
          };
        } catch (error) {
          throw new Error(`Provider ${provider.name} failed: ${error}`);
        }
      }),
      // Timeout
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Provider race timeout after ${timeout}ms`)), timeout)
      ),
    ]);

    return raced;
  }

  /**
   * Execute with fallback providers
   */
  async withFallback(
    providers: ProviderClient[],
    request: ChatRequest,
    options: {
      timeout?: number;
      maxAttempts?: number;
    } = {}
  ): Promise<{
    response: ChatResponse;
    provider: string;
    attempts: number;
  }> {
    const { timeout = 10000, maxAttempts = providers.length } = options;
    const startTime = performance.now();

    for (let i = 0; i < Math.min(maxAttempts, providers.length); i++) {
      const provider = providers[i];

      try {
        const response = await this.withTimeout(
          () => provider.chat(request),
          timeout
        );

        return {
          response,
          provider: provider.name,
          attempts: i + 1,
        };
      } catch (error) {
        // Try next provider
        continue;
      }
    }

    throw new Error('All providers failed');
  }

  /**
   * Execute operations in batches
   */
  async batch<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    batchSize: number,
    options: {
      continueOnError?: boolean;
    } = {}
  ): Promise<Array<R | Error>> {
    const { continueOnError = true } = options;
    const results: Array<R | Error> = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchStartIndex = i;

      const batchResults = await Promise.all(
        batch.map(async (item, batchIndex) => {
          try {
            return await processor(item, batchStartIndex + batchIndex);
          } catch (error) {
            if (!continueOnError) {
              throw error;
            }
            return error instanceof Error ? error : new Error(String(error));
          }
        })
      );

      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Execute all and return first successful result
   */
  async firstSuccess<T>(
    operations: (() => Promise<T>)[]
  ): Promise<T | null> {
    const errors: Error[] = [];

    for (const op of operations) {
      try {
        return await op();
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    // All failed
    throw new AggregateError(
      errors,
      `All operations failed: ${errors.map((e) => e.message).join(', ')}`
    );
  }

  /**
   * Execute all and aggregate results
   */
  async aggregate<T, R>(
    operations: (() => Promise<T>)[],
    aggregator: (results: T[]) => R
  ): Promise<R> {
    const results = await Promise.all(
      operations.map(async (op) => {
        try {
          return await op();
        } catch (error) {
          // Return null for failed operations
          return null as any;
        }
      })
    );

    // Filter out nulls
    const validResults = results.filter((r) => r !== null);

    return aggregator(validResults);
  }

  /**
   * Execute with retry
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    options: {
      maxAttempts?: number;
      delay?: number;
      backoff?: number;
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      delay = 100,
      backoff = 2,
    } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxAttempts - 1) {
          const waitTime = delay * Math.pow(backoff, attempt);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    throw lastError;
  }

  /**
   * Execute with circuit breaker
   */
  async withCircuitBreaker<T>(
    fn: () => Promise<T>,
    circuitBreaker: {
      isOpen: () => boolean;
      recordSuccess: () => void;
      recordFailure: () => void;
    }
  ): Promise<T> {
    if (circuitBreaker.isOpen()) {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await fn();
      circuitBreaker.recordSuccess();
      return result;
    } catch (error) {
      circuitBreaker.recordFailure();
      throw error;
    }
  }
}

/**
 * Concurrent request limiter
 */
export class ConcurrencyLimiter {
  private maxConcurrent: number;
  private running: number;
  private queue: Array<() => void>;

  constructor(maxConcurrent: number = 10) {
    this.maxConcurrent = maxConcurrent;
    this.running = 0;
    this.queue = [];
  }

  /**
   * Execute function with concurrency limit
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // If at capacity, wait for slot
    if (this.running >= this.maxConcurrent) {
      await new Promise<void>((resolve) => {
        this.queue.push(resolve);
      });
    }

    this.running++;

    try {
      return await fn();
    } finally {
      this.running--;

      // Process queue
      if (this.queue.length > 0 && this.running < this.maxConcurrent) {
        const next = this.queue.shift();
        if (next) next();
      }
    }
  }

  /**
   * Get current stats
   */
  getStats(): { running: number; queued: number } {
    return {
      running: this.running,
      queued: this.queue.length,
    };
  }
}

/**
 * Parallel fetch for multiple URLs
 */
export async function parallelFetch(
  urls: string[],
  options: RequestInit = {}
): Promise<Array<{ url: string; response: Response | null; error?: Error }>> {
  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, options);
        return { url, response, error: undefined };
      } catch (error) {
        return {
          url,
          response: null,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    })
  );

  return results;
}

/**
 * Parallel map with concurrency limit
 */
export async function parallelMap<T, R>(
  items: T[],
  mapper: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const limiter = new ConcurrencyLimiter(concurrency);
  const results: R[] = new Array(items.length);

  await Promise.all(
    items.map(async (item, index) => {
      results[index] = await limiter.execute(() => mapper(item, index));
    })
  );

  return results;
}

/**
 * Parallel filter with concurrency limit
 */
export async function parallelFilter<T>(
  items: T[],
  predicate: (item: T, index: number) => Promise<boolean>,
  concurrency: number
): Promise<T[]> {
  const limiter = new ConcurrencyLimiter(concurrency);
  const results: boolean[] = new Array(items.length);

  await Promise.all(
    items.map(async (item, index) => {
      results[index] = await limiter.execute(() => predicate(item, index));
    })
  );

  return items.filter((_, index) => results[index]);
}

/**
 * Create parallel executor instance
 */
export function createParallelExecutor(): ParallelExecutor {
  return new ParallelExecutor();
}

/**
 * Global parallel executor instance
 */
export const parallelExecutor = new ParallelExecutor();
