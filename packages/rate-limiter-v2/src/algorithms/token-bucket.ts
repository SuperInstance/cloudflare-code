/**
 * Token Bucket Algorithm Implementation
 *
 * Token bucket algorithm allows for burst traffic while maintaining a steady rate.
 * Tokens are added to the bucket at a fixed rate, up to a maximum capacity.
 * Each request consumes one or more tokens.
 */

import type {
  RateLimitResult,
  RateLimitConfig,
  TokenBucketState,
  RateLimitContext
} from '../types/index.js';

/**
 * Token bucket algorithm
 */
export class TokenBucketAlgorithm {
  private config: RateLimitConfig;
  private capacity: number;
  private refillRate: number; // tokens per millisecond

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.capacity = config.burst || config.limit;
    // Calculate refill rate: tokens per ms
    this.refillRate = config.limit / config.window;
  }

  /**
   * Check if request is allowed
   */
  async check(
    state: TokenBucketState | null,
    context: RateLimitContext,
    tokens: number = 1
  ): Promise<RateLimitResult> {
    const now = Date.now();

    // Initialize state if not exists
    if (!state) {
      const newState: TokenBucketState = {
        tokens: this.capacity - tokens,
        lastRefill: now,
        count: 1,
        lastUpdate: now,
        metadata: {}
      };

      return {
        allowed: true,
        limit: this.capacity,
        remaining: this.capacity - tokens,
        reset: now + this.config.window,
        metadata: {
          algorithm: 'token_bucket',
          tokens: newState.tokens,
          refillRate: this.refillRate
        }
      };
    }

    // Refill tokens based on time passed
    const timePassed = now - state.lastRefill;
    const tokensToAdd = Math.floor(timePassed * this.refillRate);
    const newTokens = Math.min(
      this.capacity,
      state.tokens + tokensToAdd
    );

    // Check if enough tokens available
    const allowed = newTokens >= tokens;

    if (allowed) {
      // Consume tokens
      state.tokens = newTokens - tokens;
      state.count++;
    } else {
      // Not enough tokens, calculate retry after
      const tokensNeeded = tokens - newTokens;
      const retryAfter = Math.ceil(tokensNeeded / this.refillRate);
    }

    state.lastRefill = now;
    state.lastUpdate = now;

    const remaining = Math.max(0, state.tokens);
    const resetTime = now + Math.ceil((this.capacity - remaining) / this.refillRate);

    return {
      allowed,
      limit: this.capacity,
      remaining,
      reset: resetTime,
      retryAfter: allowed ? undefined : Math.ceil((tokens - newTokens) / this.refillRate),
      metadata: {
        algorithm: 'token_bucket',
        tokens: state.tokens,
        refillRate: this.refillRate,
        capacity: this.capacity
      }
    };
  }

  /**
   * Reset the token bucket
   */
  reset(): TokenBucketState {
    const now = Date.now();
    return {
      tokens: this.capacity,
      lastRefill: now,
      count: 0,
      lastUpdate: now,
      metadata: {}
    };
  }

  /**
   * Get current state snapshot
   */
  getState(): {
    capacity: number;
    refillRate: number;
    window: number;
  } {
    return {
      capacity: this.capacity,
      refillRate: this.refillRate,
      window: this.config.window
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    if (config.limit !== undefined) {
      this.config.limit = config.limit;
      this.refillRate = config.limit / this.config.window;
    }
    if (config.burst !== undefined) {
      this.capacity = config.burst;
    }
    if (config.window !== undefined) {
      this.config.window = config.window;
      this.refillRate = this.config.limit / config.window;
    }
  }

  /**
   * Calculate expected refill time
   */
  calculateRefillTime(currentTokens: number, targetTokens: number): number {
    if (currentTokens >= targetTokens) {
      return 0;
    }
    const tokensNeeded = targetTokens - currentTokens;
    return Math.ceil(tokensNeeded / this.refillRate);
  }

  /**
   * Get tokens needed for request
   */
  getTokensForRequest(context: RateLimitContext): number {
    // Can be overridden to calculate tokens based on request properties
    // e.g., more expensive operations cost more tokens
    return context.metadata?.tokens ? Number(context.metadata.tokens) : 1;
  }

  /**
   * Estimate available tokens at a future time
   */
  estimateTokensAt(state: TokenBucketState, futureTime: number): number {
    const timePassed = futureTime - state.lastRefill;
    const tokensToAdd = Math.floor(timePassed * this.refillRate);
    return Math.min(this.capacity, state.tokens + tokensToAdd);
  }

  /**
   * Get time until next refill
   */
  getTimeUntilNextRefill(state: TokenBucketState): number {
    if (state.tokens >= this.capacity) {
      return 0;
    }
    return Math.ceil((this.capacity - state.tokens) / this.refillRate);
  }
}
