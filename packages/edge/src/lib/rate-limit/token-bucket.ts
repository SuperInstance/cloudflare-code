/**
 * Token Bucket Rate Limiter
 *
 * Implements the token bucket algorithm for rate limiting.
 * Tokens are added at a fixed rate until the bucket is full.
 * Requests consume tokens; if insufficient tokens are available,
 * the request is rate limited.
 *
 * Features:
 * - Configurable capacity and refill rate
 * - DO-backed state for distributed rate limiting
 * - Support for burst traffic
 * - Automatic token refill
 */

import { TokenBucketDO } from '../../do/token-bucket-do';

export interface TokenBucketOptions {
  /**
   * Maximum number of tokens the bucket can hold
   */
  capacity: number;

  /**
   * Rate at which tokens are added (tokens per second)
   */
  refillRate: number;

  /**
   * Initial token count (defaults to capacity)
   */
  initialTokens?: number;

  /**
   * Durable Object namespace for distributed state
   */
  namespace?: DurableObjectNamespace;
}

export interface TokenBucketState {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number;
}

/**
 * Token Bucket Rate Limiter
 *
 * @example
 * ```typescript
 * const limiter = new TokenBucket({
 *   capacity: 60,        // 60 requests
 *   refillRate: 1        // 1 request per second (60 per minute)
 * });
 *
 * if (await limiter.tryConsume('user-123')) {
 *   // Process request
 * } else {
 *   // Rate limited
 * }
 * ```
 */
export class TokenBucket {
  private options: Required<TokenBucketOptions>;
  private localCache: Map<string, TokenBucketState> = new Map();

  constructor(options: TokenBucketOptions) {
    this.options = {
      capacity: options.capacity,
      refillRate: options.refillRate,
      initialTokens: options.initialTokens ?? options.capacity,
      namespace: options.namespace,
    };
  }

  /**
   * Try to consume the specified number of tokens
   *
   * @param identifier - Unique identifier (user ID, IP, etc.)
   * @param tokens - Number of tokens to consume (default: 1)
   * @returns Promise<boolean> - true if tokens were consumed, false if rate limited
   */
  async tryConsume(identifier: string, tokens: number = 1): Promise<boolean> {
    // Use DO if available for distributed state
    if (this.options.namespace) {
      return this.consumeWithDO(identifier, tokens);
    }

    // Fall back to local state (single-instance)
    return this.consumeLocal(identifier, tokens);
  }

  /**
   * Consume tokens and wait until available if rate limited
   *
   * @param identifier - Unique identifier
   * @param tokens - Number of tokens to consume
   * @param maxWait - Maximum time to wait in milliseconds (default: 60000ms)
   * @returns Promise<boolean> - true if tokens were consumed
   */
  async consumeAndWait(
    identifier: string,
    tokens: number = 1,
    maxWait: number = 60000
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const consumed = await this.tryConsume(identifier, tokens);
      if (consumed) {
        return true;
      }

      // Calculate wait time needed
      const state = this.localCache.get(identifier);
      if (!state) {
        return false;
      }

      const waitTime = Math.ceil((tokens - state.tokens) / this.options.refillRate * 1000);
      const actualWait = Math.min(waitTime, 100); // Wait in 100ms increments

      await this.sleep(actualWait);
    }

    return false;
  }

  /**
   * Get the current number of available tokens
   *
   * @param identifier - Unique identifier
   * @returns Promise<number> - Available token count
   */
  async getAvailableTokens(identifier: string): Promise<number> {
    // Use DO if available
    if (this.options.namespace) {
      const stub = this.options.namespace.get(
        this.getDOId(identifier)
      );
      const state = await stub.getState();
      return state.tokens;
    }

    // Use local state
    const state = this.localCache.get(identifier);
    if (!state) {
      return this.options.initialTokens;
    }

    this.refill(state);
    return state.tokens;
  }

  /**
   * Reset the token bucket for a specific identifier
   *
   * @param identifier - Unique identifier
   */
  async reset(identifier: string): Promise<void> {
    if (this.options.namespace) {
      const stub = this.options.namespace.get(
        this.getDOId(identifier)
      );
      await stub.reset();
    } else {
      this.localCache.delete(identifier);
    }
  }

  /**
   * Get bucket statistics
   *
   * @param identifier - Unique identifier
   * @returns Promise<TokenBucketState> - Current bucket state
   */
  async getStats(identifier: string): Promise<TokenBucketState> {
    if (this.options.namespace) {
      const stub = this.options.namespace.get(
        this.getDOId(identifier)
      );
      return await stub.getStats();
    }

    const state = this.localCache.get(identifier);
    if (!state) {
      return {
        tokens: this.options.initialTokens,
        lastRefill: Date.now(),
        capacity: this.options.capacity,
        refillRate: this.options.refillRate,
      };
    }

    this.refill(state);
    return { ...state };
  }

  /**
   * Consume tokens using local state
   */
  private consumeLocal(identifier: string, tokens: number): boolean {
    let state = this.localCache.get(identifier);

    if (!state) {
      state = {
        tokens: this.options.initialTokens,
        lastRefill: Date.now(),
        capacity: this.options.capacity,
        refillRate: this.options.refillRate,
      };
      this.localCache.set(identifier, state);
    }

    // Refill tokens based on elapsed time
    this.refill(state);

    // Check if enough tokens available
    if (state.tokens >= tokens) {
      state.tokens -= tokens;
      return true;
    }

    return false;
  }

  /**
   * Consume tokens using Durable Object
   */
  private async consumeWithDO(
    identifier: string,
    tokens: number
  ): Promise<boolean> {
    try {
      const stub = this.options.namespace!.get(
        this.getDOId(identifier)
      );
      return await stub.consume(tokens);
    } catch (error) {
      console.error('TokenBucket DO error:', error);
      // Fall back to local state on error
      return this.consumeLocal(identifier, tokens);
    }
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(state: TokenBucketState): void {
    const now = Date.now();
    const elapsed = (now - state.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * state.refillRate;

    state.tokens = Math.min(state.capacity, state.tokens + tokensToAdd);
    state.lastRefill = now;
  }

  /**
   * Generate stable DO ID from identifier
   */
  private getDOId(identifier: string): string {
    // Use hash of identifier for stable mapping
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
      const char = identifier.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `token-bucket-${Math.abs(hash)}`;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a token bucket for rate limiting (RPM - requests per minute)
 *
 * @param requestsPerMinute - Maximum requests per minute
 * @param namespace - Optional DO namespace
 * @returns TokenBucket instance
 */
export function createRateLimiterRPM(
  requestsPerMinute: number,
  namespace?: DurableObjectNamespace
): TokenBucket {
  return new TokenBucket({
    capacity: requestsPerMinute,
    refillRate: requestsPerMinute / 60, // tokens per second
    namespace,
  });
}

/**
 * Create a token bucket for rate limiting (TPM - tokens per minute)
 *
 * @param tokensPerMinute - Maximum tokens per minute
 * @param namespace - Optional DO namespace
 * @returns TokenBucket instance
 */
export function createRateLimiterTPM(
  tokensPerMinute: number,
  namespace?: DurableObjectNamespace
): TokenBucket {
  return new TokenBucket({
    capacity: tokensPerMinute,
    refillRate: tokensPerMinute / 60, // tokens per second
    namespace,
  });
}
