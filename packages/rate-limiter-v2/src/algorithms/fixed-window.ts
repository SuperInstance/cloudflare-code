/**
 * Fixed Window Counter Algorithm Implementation
 *
 * Fixed window algorithm divides time into fixed-size windows.
 * Simple and efficient but can allow bursts at window boundaries.
 * Best for basic rate limiting where precision is less critical.
 */

// @ts-nocheck
import type {
  RateLimitResult,
  RateLimitConfig,
  FixedWindowState,
  RateLimitContext
} from '../types/index.js';

/**
 * Fixed window algorithm
 */
export class FixedWindowAlgorithm {
  private config: RateLimitConfig;
  private windowSize: number;
  private maxRequests: number;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.windowSize = config.window;
    this.maxRequests = config.limit;
  }

  /**
   * Check if request is allowed
   */
  async check(
    state: FixedWindowState | null,
    context: RateLimitContext
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const currentWindowStart = this.getWindowStart(now);

    // Initialize state if not exists or window expired
    if (!state || state.windowStart !== currentWindowStart) {
      const newState: FixedWindowState = {
        windowStart: currentWindowStart,
        count: 1,
        lastUpdate: now,
        metadata: {}
      };

      return {
        allowed: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        reset: currentWindowStart + this.windowSize,
        metadata: {
          algorithm: 'fixed_window',
          windowStart: currentWindowStart,
          windowEnd: currentWindowStart + this.windowSize
        }
      };
    }

    // Check if limit exceeded
    const allowed = state.count < this.maxRequests;

    if (allowed) {
      state.count++;
    }

    state.lastUpdate = now;

    const resetTime = state.windowStart + this.windowSize;
    const remaining = Math.max(0, this.maxRequests - state.count);
    const retryAfter = allowed ? undefined : resetTime - now;

    return {
      allowed,
      limit: this.maxRequests,
      remaining,
      reset: resetTime,
      retryAfter,
      metadata: {
        algorithm: 'fixed_window',
        windowStart: state.windowStart,
        windowEnd: resetTime,
        count: state.count
      }
    };
  }

  /**
   * Check with custom request weight
   */
  async checkWithWeight(
    state: FixedWindowState | null,
    context: RateLimitContext,
    weight: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const currentWindowStart = this.getWindowStart(now);

    if (!state || state.windowStart !== currentWindowStart) {
      const newState: FixedWindowState = {
        windowStart: currentWindowStart,
        count: weight,
        lastUpdate: now,
        metadata: {}
      };

      return {
        allowed: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - weight,
        reset: currentWindowStart + this.windowSize,
        metadata: {
          algorithm: 'fixed_window',
          windowStart: currentWindowStart,
          windowEnd: currentWindowStart + this.windowSize
        }
      };
    }

    const allowed = state.count + weight <= this.maxRequests;

    if (allowed) {
      state.count += weight;
    }

    state.lastUpdate = now;

    const resetTime = state.windowStart + this.windowSize;
    const remaining = Math.max(0, this.maxRequests - state.count);
    const retryAfter = allowed ? undefined : resetTime - now;

    return {
      allowed,
      limit: this.maxRequests,
      remaining,
      reset: resetTime,
      retryAfter,
      metadata: {
        algorithm: 'fixed_window',
        windowStart: state.windowStart,
        windowEnd: resetTime,
        count: state.count,
        weight
      }
    };
  }

  /**
   * Get window start timestamp for a given time
   */
  private getWindowStart(timestamp: number): number {
    return Math.floor(timestamp / this.windowSize) * this.windowSize;
  }

  /**
   * Reset the fixed window
   */
  reset(): FixedWindowState {
    const now = Date.now();
    const currentWindowStart = this.getWindowStart(now);

    return {
      windowStart: currentWindowStart,
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
  } {
    return {
      windowSize: this.windowSize,
      maxRequests: this.maxRequests
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
   * Get current window info
   */
  getCurrentWindow(): {
    start: number;
    end: number;
    remaining: number;
  } {
    const now = Date.now();
    const windowStart = this.getWindowStart(now);
    const windowEnd = windowStart + this.windowSize;
    const remaining = windowEnd - now;

    return {
      start: windowStart,
      end: windowEnd,
      remaining
    };
  }

  /**
   * Get window index for a given timestamp
   */
  getWindowIndex(timestamp: number): number {
    return Math.floor(timestamp / this.windowSize);
  }

  /**
   * Check if a timestamp is in the current window
   */
  isInCurrentWindow(timestamp: number): boolean {
    const now = Date.now();
    const windowStart = this.getWindowStart(now);
    const windowEnd = windowStart + this.windowSize;

    return timestamp >= windowStart && timestamp < windowEnd;
  }

  /**
   * Get time until next window
   */
  getTimeUntilNextWindow(): number {
    const now = Date.now();
    const windowStart = this.getWindowStart(now);
    const windowEnd = windowStart + this.windowSize;

    return Math.max(0, windowEnd - now);
  }

  /**
   * Get window statistics
   */
  getWindowStats(state: FixedWindowState | null): {
    currentWindow: number;
    nextWindow: number;
    count: number;
    remaining: number;
    progress: number; // 0-1
  } {
    const now = Date.now();
    const currentWindowStart = this.getWindowStart(now);
    const nextWindowStart = currentWindowStart + this.windowSize;

    const count = state && state.windowStart === currentWindowStart
      ? state.count
      : 0;

    const remaining = Math.max(0, this.maxRequests - count);
    const elapsed = now - currentWindowStart;
    const progress = elapsed / this.windowSize;

    return {
      currentWindow: currentWindowStart,
      nextWindow: nextWindowStart,
      count,
      remaining,
      progress: Math.min(1, Math.max(0, progress))
    };
  }

  /**
   * Calculate burst allowance at window boundary
   */
  calculateBurstAllowance(): number {
    // Fixed window allows 2x limit at boundary (current + next window)
    return this.maxRequests;
  }

  /**
   * Estimate requests in current window
   */
  estimateCurrentWindowRequests(state: FixedWindowState | null): number {
    const now = Date.now();
    const currentWindowStart = this.getWindowStart(now);

    if (!state || state.windowStart !== currentWindowStart) {
      return 0;
    }

    return state.count;
  }
}
