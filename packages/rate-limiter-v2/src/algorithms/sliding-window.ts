/**
 * Sliding Window Log Algorithm Implementation
 *
 * Sliding window algorithm tracks requests in a rolling time window.
 * Provides more accurate rate limiting than fixed window by preventing
 * the "boundary problem" where bursts occur at window boundaries.
 */

import type {
  RateLimitResult,
  RateLimitConfig,
  SlidingWindowState,
  RateLimitContext
} from '../types/index.js';

/**
 * Sliding window algorithm
 */
export class SlidingWindowAlgorithm {
  private config: RateLimitConfig;
  private windowSize: number;
  private maxRequests: number;
  private precision: number; // milliseconds between data points

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.windowSize = config.window;
    this.maxRequests = config.limit;
    this.precision = 100; // 100ms precision by default
  }

  /**
   * Check if request is allowed
   */
  async check(
    state: SlidingWindowState | null,
    context: RateLimitContext
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.windowSize;

    // Initialize state if not exists
    if (!state) {
      const newState: SlidingWindowState = {
        requests: [{ timestamp: now, count: 1 }],
        count: 1,
        lastUpdate: now,
        metadata: {}
      };

      return {
        allowed: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        reset: now + this.config.window,
        metadata: {
          algorithm: 'sliding_window',
          windowSize: this.windowSize,
          requestCount: 1
        }
      };
    }

    // Remove old requests outside the window
    state.requests = state.requests.filter(
      req => req.timestamp > windowStart
    );

    // Count total requests in window
    const totalCount = state.requests.reduce((sum, req) => sum + req.count, 0);

    // Check if limit exceeded
    const allowed = totalCount < this.maxRequests;

    if (allowed) {
      // Add current request
      state.requests.push({ timestamp: now, count: 1 });
      state.count++;
    }

    state.lastUpdate = now;

    // Calculate oldest request timestamp for reset time
    const oldestRequest = state.requests[0];
    const resetTime = oldestRequest
      ? oldestRequest.timestamp + this.windowSize
      : now + this.windowSize;

    // Calculate remaining requests
    const remaining = Math.max(0, this.maxRequests - (allowed ? totalCount + 1 : totalCount));

    // Calculate retry after if denied
    let retryAfter: number | undefined;
    if (!allowed && state.requests.length > 0) {
      const oldestTimestamp = state.requests[0].timestamp;
      retryAfter = oldestTimestamp + this.windowSize - now;
    }

    return {
      allowed,
      limit: this.maxRequests,
      remaining,
      reset: resetTime,
      retryAfter,
      metadata: {
        algorithm: 'sliding_window',
        windowSize: this.windowSize,
        requestCount: totalCount,
        windowStart,
        windowEnd: now
      }
    };
  }

  /**
   * Check with custom request weight
   */
  async checkWithWeight(
    state: SlidingWindowState | null,
    context: RateLimitContext,
    weight: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.windowSize;

    if (!state) {
      const newState: SlidingWindowState = {
        requests: [{ timestamp: now, count: weight }],
        count: weight,
        lastUpdate: now,
        metadata: {}
      };

      return {
        allowed: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - weight,
        reset: now + this.config.window,
        metadata: {
          algorithm: 'sliding_window',
          windowSize: this.windowSize,
          requestCount: weight
        }
      };
    }

    // Remove old requests
    state.requests = state.requests.filter(
      req => req.timestamp > windowStart
    );

    // Count total requests in window
    const totalCount = state.requests.reduce((sum, req) => sum + req.count, 0);

    // Check if limit would be exceeded
    const allowed = totalCount + weight <= this.maxRequests;

    if (allowed) {
      state.requests.push({ timestamp: now, count: weight });
      state.count++;
    }

    state.lastUpdate = now;

    const oldestRequest = state.requests[0];
    const resetTime = oldestRequest
      ? oldestRequest.timestamp + this.windowSize
      : now + this.windowSize;

    const remaining = Math.max(0, this.maxRequests - (allowed ? totalCount + weight : totalCount));

    let retryAfter: number | undefined;
    if (!allowed && state.requests.length > 0) {
      retryAfter = this.calculateRetryAfter(state, weight);
    }

    return {
      allowed,
      limit: this.maxRequests,
      remaining,
      reset: resetTime,
      retryAfter,
      metadata: {
        algorithm: 'sliding_window',
        windowSize: this.windowSize,
        requestCount: totalCount,
        weight
      }
    };
  }

  /**
   * Calculate retry after time
   */
  private calculateRetryAfter(state: SlidingWindowState, weight: number): number {
    const now = Date.now();
    let cumulativeCount = 0;

    // Find how many requests need to expire
    for (const request of state.requests) {
      cumulativeCount += request.count;
      if (cumulativeCount > this.maxRequests - weight) {
        return request.timestamp + this.windowSize - now;
      }
    }

    return this.windowSize;
  }

  /**
   * Reset the sliding window
   */
  reset(): SlidingWindowState {
    const now = Date.now();
    return {
      requests: [],
      count: 0,
      lastUpdate: now,
      metadata: {}
    };
  }

  /**
   * Get current state snapshot
   */
  getState(): {
    windowSize: number;
    maxRequests: number;
    precision: number;
  } {
    return {
      windowSize: this.windowSize,
      maxRequests: this.maxRequests,
      precision: this.precision
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    if (config.limit !== undefined) {
      this.maxRequests = config.limit;
      this.config.limit = config.limit;
    }
    if (config.window !== undefined) {
      this.windowSize = config.window;
      this.config.window = config.window;
    }
  }

  /**
   * Get request count in current window
   */
  getRequestCount(state: SlidingWindowState): number {
    const now = Date.now();
    const windowStart = now - this.windowSize;

    return state.requests
      .filter(req => req.timestamp > windowStart)
      .reduce((sum, req) => sum + req.count, 0);
  }

  /**
   * Estimate requests at a future time
   */
  estimateRequestsAt(state: SlidingWindowState, futureTime: number): number {
    const windowStart = futureTime - this.windowSize;

    return state.requests
      .filter(req => req.timestamp > windowStart)
      .reduce((sum, req) => sum + req.count, 0);
  }

  /**
   * Get window statistics
   */
  getWindowStats(state: SlidingWindowState): {
    start: number;
    end: number;
    count: number;
    requestsPerSecond: number;
  } {
    const now = Date.now();
    const windowStart = now - this.windowSize;

    const requests = state.requests.filter(req => req.timestamp > windowStart);
    const count = requests.reduce((sum, req) => sum + req.count, 0);

    return {
      start: windowStart,
      end: now,
      count,
      requestsPerSecond: (count / this.windowSize) * 1000
    };
  }

  /**
   * Optimize state by merging close requests
   */
  optimizeState(state: SlidingWindowState): void {
    if (state.requests.length < 100) {
      return; // Not worth optimizing for small arrays
    }

    const optimized: Array<{ timestamp: number; count: number }> = [];
    let current = state.requests[0];

    for (let i = 1; i < state.requests.length; i++) {
      const next = state.requests[i];

      if (next.timestamp - current.timestamp < this.precision) {
        // Merge requests that are close together
        current.count += next.count;
      } else {
        optimized.push(current);
        current = next;
      }
    }

    optimized.push(current);
    state.requests = optimized;
  }

  /**
   * Get clean state (remove old requests)
   */
  cleanState(state: SlidingWindowState): void {
    const now = Date.now();
    const windowStart = now - this.windowSize;

    state.requests = state.requests.filter(
      req => req.timestamp > windowStart
    );
  }
}
