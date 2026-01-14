/**
 * Sliding Window Rate Limiter
 *
 * Implements a sliding window log rate limiting algorithm.
 * Tracks each request timestamp within a rolling time window.
 * More accurate than fixed window and prevents the burst problem.
 *
 * Features:
 * - Precise rate limiting without edge spikes
 * - KV-backed state for persistence
 * - Automatic cleanup of old timestamps
 * - Support for multiple window sizes
 */

import type { KVNamespace } from '@cloudflare/workers-types';

export interface SlidingWindowOptions {
  /**
   * Maximum number of requests allowed in the window
   */
  maxRequests: number;

  /**
   * Window size in milliseconds
   */
  windowMs: number;

  /**
   * KV namespace for persistence (optional)
   */
  kv?: KVNamespace;

  /**
   * TTL for stored data in seconds (default: 1 hour)
   */
  ttl?: number;
}

export interface SlidingWindowStats {
  count: number;
  maxRequests: number;
  windowStart: number;
  windowEnd: number;
  remaining: number;
  resetTime: number;
}

/**
 * Sliding Window Rate Limiter
 *
 * @example
 * ```typescript
 * const limiter = new SlidingWindow({
 *   maxRequests: 100,     // 100 requests
 *   windowMs: 60000      // per 60 seconds
 * });
 *
 * if (await limiter.isAllowed('user-123')) {
 *   // Process request
 * } else {
 *   // Rate limited
 * }
 * ```
 */
export class SlidingWindow {
  private options: Required<SlidingWindowOptions>;
  private localCache: Map<string, number[]> = new Map();

  constructor(options: SlidingWindowOptions) {
    this.options = {
      maxRequests: options.maxRequests,
      windowMs: options.windowMs,
      kv: options.kv,
      ttl: options.ttl ?? 3600, // 1 hour default
    };
  }

  /**
   * Record a request and check if allowed
   *
   * @param identifier - Unique identifier (user ID, IP, etc.)
   * @returns Promise<boolean> - true if request is allowed
   */
  async isAllowed(identifier: string): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;

    // Get existing requests
    let requests: number[];
    if (this.options.kv) {
      requests = await this.getRequestsFromKV(identifier);
    } else {
      requests = this.localCache.get(identifier) || [];
    }

    // Remove requests outside the window
    requests = requests.filter(timestamp => timestamp > windowStart);

    // Check if under limit
    if (requests.length < this.options.maxRequests) {
      requests.push(now);
      await this.saveRequests(identifier, requests);
      return true;
    }

    // Save the filtered requests
    await this.saveRequests(identifier, requests);
    return false;
  }

  /**
   * Record a request without checking limits
   *
   * @param identifier - Unique identifier
   */
  async recordRequest(identifier: string): Promise<void> {
    const now = Date.now();
    let requests: number[];

    if (this.options.kv) {
      requests = await this.getRequestsFromKV(identifier);
    } else {
      requests = this.localCache.get(identifier) || [];
    }

    requests.push(now);
    await this.saveRequests(identifier, requests);
  }

  /**
   * Get the current request count for an identifier
   *
   * @param identifier - Unique identifier
   * @returns Promise<number> - Current count
   */
  async getCount(identifier: string): Promise<number> {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;

    let requests: number[];
    if (this.options.kv) {
      requests = await this.getRequestsFromKV(identifier);
    } else {
      requests = this.localCache.get(identifier) || [];
    }

    // Count requests within the window
    const count = requests.filter(timestamp => timestamp > windowStart).length;
    return count;
  }

  /**
   * Get detailed statistics for an identifier
   *
   * @param identifier - Unique identifier
   * @returns Promise<SlidingWindowStats> - Statistics
   */
  async getStats(identifier: string): Promise<SlidingWindowStats> {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;

    let requests: number[];
    if (this.options.kv) {
      requests = await this.getRequestsFromKV(identifier);
    } else {
      requests = this.localCache.get(identifier) || [];
    }

    // Filter requests within window
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    const count = validRequests.length;

    return {
      count,
      maxRequests: this.options.maxRequests,
      windowStart,
      windowEnd: now,
      remaining: Math.max(0, this.options.maxRequests - count),
      resetTime: validRequests.length > 0
        ? validRequests[0] + this.options.windowMs
        : now,
    };
  }

  /**
   * Reset the rate limit for an identifier
   *
   * @param identifier - Unique identifier
   */
  async reset(identifier: string): Promise<void> {
    if (this.options.kv) {
      await this.options.kv.delete(this.getStorageKey(identifier));
    } else {
      this.localCache.delete(identifier);
    }
  }

  /**
   * Clean up old entries to free memory
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const ttl = this.options.windowMs * 2; // Keep slightly longer than window

    // Clean local cache
    for (const [identifier, requests] of this.localCache.entries()) {
      const validRequests = requests.filter(
        timestamp => now - timestamp < ttl
      );
      if (validRequests.length === 0) {
        this.localCache.delete(identifier);
      } else {
        this.localCache.set(identifier, validRequests);
      }
    }

    // Note: KV entries auto-expire based on TTL
  }

  /**
   * Get requests from KV storage
   */
  private async getRequestsFromKV(identifier: string): Promise<number[]> {
    try {
      const data = await this.options.kv!.get(
        this.getStorageKey(identifier),
        'json'
      );
      return (data as number[]) || [];
    } catch (error) {
      console.error('SlidingWindow KV read error:', error);
      return [];
    }
  }

  /**
   * Save requests to storage
   */
  private async saveRequests(
    identifier: string,
    requests: number[]
  ): Promise<void> {
    if (this.options.kv) {
      try {
        await this.options.kv.put(
          this.getStorageKey(identifier),
          JSON.stringify(requests),
          {
            expirationTtl: this.options.ttl,
          }
        );
      } catch (error) {
        console.error('SlidingWindow KV write error:', error);
        // Fall back to local cache on error
        this.localCache.set(identifier, requests);
      }
    } else {
      this.localCache.set(identifier, requests);
    }
  }

  /**
   * Generate storage key for identifier
   */
  private getStorageKey(identifier: string): string {
    return `sliding-window:${identifier}`;
  }
}

/**
 * Create a rate limiter for requests per minute (RPM)
 *
 * @param requestsPerMinute - Maximum requests per minute
 * @param kv - Optional KV namespace
 * @returns SlidingWindow instance
 */
export function createRateLimiterRPM(
  requestsPerMinute: number,
  kv?: KVNamespace
): SlidingWindow {
  return new SlidingWindow({
    maxRequests: requestsPerMinute,
    windowMs: 60000, // 60 seconds
    kv,
  });
}

/**
 * Create a rate limiter for requests per second (RPS)
 *
 * @param requestsPerSecond - Maximum requests per second
 * @param kv - Optional KV namespace
 * @returns SlidingWindow instance
 */
export function createRateLimiterRPS(
  requestsPerSecond: number,
  kv?: KVNamespace
): SlidingWindow {
  return new SlidingWindow({
    maxRequests: requestsPerSecond,
    windowMs: 1000, // 1 second
    kv,
  });
}
