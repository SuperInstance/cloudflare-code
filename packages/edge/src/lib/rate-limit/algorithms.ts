/**
 * Advanced Rate Limiting Algorithms
 *
 * Implements multiple rate limiting algorithms with distributed coordination support.
 * Includes token bucket, sliding window, fixed window, and leaky bucket algorithms.
 */

import type {
  RateLimitDecision,
  RateLimitAlgorithm,
  TokenBucketState,
  SlidingWindowState,
  BurstConfig,
} from './types';

/**
 * Token Bucket Algorithm
 *
 * Tokens are added at a fixed rate until the bucket is full.
 * Requests consume tokens; if insufficient tokens are available,
 * the request is rate limited. Allows for burst traffic.
 */
export class TokenBucketAlgorithm {
  private capacity: number;
  private refillRate: number; // tokens per second
  private state: Map<string, TokenBucketState>;
  private storage?: DurableObjectStorage;

  constructor(
    capacity: number,
    refillRate: number,
    burst?: number,
    storage?: DurableObjectStorage
  ) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.state = new Map();
    if (storage !== undefined) {
      this.storage = storage;
    }
  }

  /**
   * Check if request is allowed and consume tokens
   */
  async check(
    identifier: string,
    tokens: number = 1,
    burstConfig?: BurstConfig
  ): Promise<RateLimitDecision> {
    const now = Date.now();
    let state = this.state.get(identifier);

    // Load from storage if not in memory
    if (!state && this.storage) {
      const stored = await this.storage.get<TokenBucketState>(
        `token-bucket:${identifier}`
      );
      if (stored) {
        state = stored;
        this.state.set(identifier, state);
      }
    }

    // Initialize new state
    if (!state) {
      const effectiveCapacity = burstConfig?.enabled
        ? this.capacity + burstConfig.burstSize
        : this.capacity;

      state = {
        tokens: effectiveCapacity,
        lastRefill: now,
        capacity: this.capacity,
        refillRate: this.refillRate,
        ...(burstConfig?.burstSize !== undefined ? { burst: burstConfig.burstSize } : {}),
      };
      this.state.set(identifier, state);
    }

    // Refill tokens based on elapsed time
    this.refill(state);

    // Verify state is still valid after refill
    if (!state) {
      throw new Error('State became undefined after refill');
    }

    // Check if in burst recovery
    if (burstConfig?.enabled && state.burst) {
      const elapsed = now - state.lastRefill;
      if (elapsed < burstConfig.cooldownPeriod) {
        // Still in cooldown, reduce effective capacity
        state.capacity = this.capacity;
      } else {
        // Cooldown over, restore burst capacity
        state.capacity = this.capacity + burstConfig.burstSize;
      }
    }

    // Check if enough tokens available
    const allowed = state.tokens >= tokens;
    const remaining = Math.max(0, state.tokens - (allowed ? tokens : 0));

    if (allowed) {
      state.tokens -= tokens;
    }

    // Save to storage
    if (this.storage) {
      await this.storage.put(`token-bucket:${identifier}`, state);
    }

    // Calculate reset time (when bucket will be full)
    const tokensNeeded = this.capacity - state.tokens;
    const resetMs = (tokensNeeded / this.refillRate) * 1000;

    const result: RateLimitDecision = {
      allowed,
      remaining: Math.floor(remaining),
      limit: state.capacity,
      resetTime: now + resetMs,
      resetIn: Math.floor(resetMs),
      currentUsage: Math.floor(state.capacity - state.tokens),
    };

    // Conditionally add retryAfter
    if (!allowed) {
      result.retryAfter = Math.ceil(resetMs / 1000);
    }

    return result;
  }

  /**
   * Reset the token bucket for an identifier
   */
  async reset(identifier: string): Promise<void> {
    this.state.delete(identifier);
    if (this.storage) {
      await this.storage.delete(`token-bucket:${identifier}`);
    }
  }

  /**
   * Get current state
   */
  async getState(identifier: string): Promise<TokenBucketState | null> {
    let state = this.state.get(identifier);

    if (!state && this.storage) {
      state = await this.storage.get<TokenBucketState>(
        `token-bucket:${identifier}`
      );
      if (state) {
        this.state.set(identifier, state);
      }
    }

    if (state) {
      this.refill(state);
    }

    return state || null;
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
}

/**
 * Sliding Window Algorithm
 *
 * Tracks each request timestamp within a rolling time window.
 * More accurate than fixed window and prevents the burst problem
 * at window boundaries.
 */
export class SlidingWindowAlgorithm {
  private maxRequests: number;
  private windowMs: number;
  private state: Map<string, number[]>;
  private storage?: DurableObjectStorage;

  constructor(
    maxRequests: number,
    windowMs: number,
    storage?: DurableObjectStorage
  ) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.state = new Map();
    this.storage = storage;
  }

  /**
   * Check if request is allowed
   */
  async check(identifier: string): Promise<RateLimitDecision> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing timestamps
    let timestamps = this.state.get(identifier);

    if (!timestamps && this.storage) {
      const stored = await this.storage.get<{ timestamps: number[] }>(
        `sliding-window:${identifier}`
      );
      if (stored) {
        timestamps = stored.timestamps;
        this.state.set(identifier, timestamps);
      }
    }

    if (!timestamps) {
      timestamps = [];
      this.state.set(identifier, timestamps);
    }

    // Filter out timestamps outside the window
    const validTimestamps = timestamps.filter((ts) => ts > windowStart);

    // Check if under limit
    const allowed = validTimestamps.length < this.maxRequests;

    if (allowed) {
      validTimestamps.push(now);
    }

    // Update state
    this.state.set(identifier, validTimestamps);

    // Save to storage
    if (this.storage) {
      await this.storage.put(`sliding-window:${identifier}`, {
        timestamps: validTimestamps,
      });
    }

    // Calculate reset time (when oldest request expires)
    const resetTime =
      validTimestamps.length > 0
        ? validTimestamps[0] + this.windowMs
        : now + this.windowMs;

    return {
      allowed,
      remaining: Math.max(0, this.maxRequests - validTimestamps.length),
      limit: this.maxRequests,
      resetTime,
      resetIn: Math.max(0, resetTime - now),
      currentUsage: validTimestamps.length,
      retryAfter: allowed
        ? undefined
        : Math.ceil((resetTime - now) / 1000),
    };
  }

  /**
   * Reset the sliding window for an identifier
   */
  async reset(identifier: string): Promise<void> {
    this.state.delete(identifier);
    if (this.storage) {
      await this.storage.delete(`sliding-window:${identifier}`);
    }
  }

  /**
   * Get current state
   */
  async getState(identifier: string): Promise<SlidingWindowState | null> {
    let timestamps = this.state.get(identifier);

    if (!timestamps && this.storage) {
      const stored = await this.storage.get<{ timestamps: number[] }>(
        `sliding-window:${identifier}`
      );
      if (stored) {
        timestamps = stored.timestamps;
        this.state.set(identifier, timestamps);
      }
    }

    if (!timestamps) {
      return null;
    }

    const now = Date.now();
    const windowStart = now - this.windowMs;
    const validTimestamps = timestamps.filter((ts) => ts > windowStart);

    return {
      timestamps: validTimestamps,
      maxRequests: this.maxRequests,
      windowMs: this.windowMs,
    };
  }
}

/**
 * Fixed Window Algorithm
 *
 * Simple implementation that resets at fixed time intervals.
 * Less accurate than sliding window but more performant.
 */
export class FixedWindowAlgorithm {
  private maxRequests: number;
  private windowMs: number;
  private state: Map<string, { count: number; windowStart: number }>;
  private storage?: DurableObjectStorage;

  constructor(
    maxRequests: number,
    windowMs: number,
    storage?: DurableObjectStorage
  ) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.state = new Map();
    this.storage = storage;
  }

  /**
   * Check if request is allowed
   */
  async check(identifier: string): Promise<RateLimitDecision> {
    const now = Date.now();
    const currentWindowStart = Math.floor(now / this.windowMs) * this.windowMs;

    // Get existing state
    let state = this.state.get(identifier);

    if (!state && this.storage) {
      const stored = await this.storage.get<{
        count: number;
        windowStart: number;
      }>(`fixed-window:${identifier}`);
      if (stored) {
        state = stored;
        this.state.set(identifier, state);
      }
    }

    // Initialize or reset if window expired
    if (!state || state.windowStart !== currentWindowStart) {
      state = {
        count: 0,
        windowStart: currentWindowStart,
      };
      this.state.set(identifier, state);
    }

    // Check if under limit
    const allowed = state.count < this.maxRequests;

    if (allowed) {
      state.count++;
    }

    // Save to storage
    if (this.storage) {
      await this.storage.put(`fixed-window:${identifier}`, state);
    }

    // Calculate reset time
    const resetTime = currentWindowStart + this.windowMs;

    return {
      allowed,
      remaining: Math.max(0, this.maxRequests - state.count),
      limit: this.maxRequests,
      resetTime,
      resetIn: Math.max(0, resetTime - now),
      currentUsage: state.count,
      retryAfter: allowed
        ? undefined
        : Math.ceil((resetTime - now) / 1000),
    };
  }

  /**
   * Reset the fixed window for an identifier
   */
  async reset(identifier: string): Promise<void> {
    this.state.delete(identifier);
    if (this.storage) {
      await this.storage.delete(`fixed-window:${identifier}`);
    }
  }
}

/**
 * Leaky Bucket Algorithm
 *
 * Processes requests at a constant rate. Excess requests are discarded
 * (or queued if implementation supports it). Good for smoothing traffic.
 */
export class LeakyBucketAlgorithm {
  private capacity: number;
  private leakRate: number; // requests per second
  private state: Map<string, { tokens: number; lastLeak: number }>;
  private storage?: DurableObjectStorage;

  constructor(
    capacity: number,
    leakRate: number,
    storage?: DurableObjectStorage
  ) {
    this.capacity = capacity;
    this.leakRate = leakRate;
    this.state = new Map();
    this.storage = storage;
  }

  /**
   * Check if request is allowed
   */
  async check(identifier: string): Promise<RateLimitDecision> {
    const now = Date.now();

    // Get existing state
    let state = this.state.get(identifier);

    if (!state && this.storage) {
      const stored = await this.storage.get<{
        tokens: number;
        lastLeak: number;
      }>(`leaky-bucket:${identifier}`);
      if (stored) {
        state = stored;
        this.state.set(identifier, state);
      }
    }

    // Initialize new state
    if (!state) {
      state = {
        tokens: 0,
        lastLeak: now,
      };
      this.state.set(identifier, state);
    }

    // Leak tokens (process requests) based on elapsed time
    const elapsed = (now - state.lastLeak) / 1000; // seconds
    const tokensToLeak = elapsed * this.leakRate;

    state.tokens = Math.max(0, state.tokens - tokensToLeak);
    state.lastLeak = now;

    // Check if bucket has space
    const allowed = state.tokens < this.capacity;

    if (allowed) {
      state.tokens++;
    }

    // Save to storage
    if (this.storage) {
      await this.storage.put(`leaky-bucket:${identifier}`, state);
    }

    // Calculate time until bucket has space
    const resetMs = state.tokens > 0 ? (state.tokens / this.leakRate) * 1000 : 0;

    return {
      allowed,
      remaining: Math.floor(this.capacity - state.tokens),
      limit: this.capacity,
      resetTime: now + resetMs,
      resetIn: Math.ceil(resetMs),
      currentUsage: Math.floor(state.tokens),
      retryAfter: allowed ? undefined : Math.ceil(resetMs / 1000),
    };
  }

  /**
   * Reset the leaky bucket for an identifier
   */
  async reset(identifier: string): Promise<void> {
    this.state.delete(identifier);
    if (this.storage) {
      await this.storage.delete(`leaky-bucket:${identifier}`);
    }
  }
}

/**
 * Algorithm factory
 */
export class RateLimitAlgorithmFactory {
  /**
   * Create algorithm instance
   */
  static create(
    algorithm: RateLimitAlgorithm,
    maxRequests: number,
    windowMs: number,
    storage?: DurableObjectStorage,
    burst?: number
  ):
    | TokenBucketAlgorithm
    | SlidingWindowAlgorithm
    | FixedWindowAlgorithm
    | LeakyBucketAlgorithm {
    const refillRate = maxRequests / (windowMs / 1000); // tokens per second

    switch (algorithm) {
      case 'token-bucket':
        return new TokenBucketAlgorithm(maxRequests, refillRate, burst, storage);

      case 'sliding-window':
        return new SlidingWindowAlgorithm(maxRequests, windowMs, storage);

      case 'fixed-window':
        return new FixedWindowAlgorithm(maxRequests, windowMs, storage);

      case 'leaky-bucket':
        return new LeakyBucketAlgorithm(maxRequests, refillRate, storage);

      default:
        throw new Error(`Unknown algorithm: ${algorithm}`);
    }
  }

  /**
   * Create token bucket for requests per minute
   */
  static createTokenBucketRPM(
    requestsPerMinute: number,
    storage?: DurableObjectStorage,
    burst?: number
  ): TokenBucketAlgorithm {
    const refillRate = requestsPerMinute / 60;
    return new TokenBucketAlgorithm(
      requestsPerMinute,
      refillRate,
      burst,
      storage
    );
  }

  /**
   * Create sliding window for requests per minute
   */
  static createSlidingWindowRPM(
    requestsPerMinute: number,
    storage?: DurableObjectStorage
  ): SlidingWindowAlgorithm {
    return new SlidingWindowAlgorithm(requestsPerMinute, 60000, storage);
  }

  /**
   * Create fixed window for requests per minute
   */
  static createFixedWindowRPM(
    requestsPerMinute: number,
    storage?: DurableObjectStorage
  ): FixedWindowAlgorithm {
    return new FixedWindowAlgorithm(requestsPerMinute, 60000, storage);
  }
}

/**
 * Hybrid algorithm that combines multiple algorithms
 */
export class HybridRateLimiter {
  private primary: TokenBucketAlgorithm | SlidingWindowAlgorithm;
  private secondary: FixedWindowAlgorithm;
  private storage?: DurableObjectStorage;

  constructor(
    primary: RateLimitAlgorithm,
    maxRequests: number,
    windowMs: number,
    storage?: DurableObjectStorage
  ) {
    this.storage = storage;

    if (primary === 'token-bucket') {
      this.primary = RateLimitAlgorithmFactory.createTokenBucketRPM(
        maxRequests,
        storage
      );
    } else {
      this.primary = new SlidingWindowAlgorithm(maxRequests, windowMs, storage);
    }

    this.secondary = new FixedWindowAlgorithm(
      maxRequests * 2,
      windowMs,
      storage
    );
  }

  /**
   * Check using both algorithms
   */
  async check(identifier: string): Promise<RateLimitDecision> {
    // Check primary algorithm first (more accurate)
    const primaryDecision = await this.primary.check(identifier);

    if (!primaryDecision.allowed) {
      return primaryDecision;
    }

    // Check secondary algorithm (backup protection)
    const secondaryDecision = await this.secondary.check(identifier);

    if (!secondaryDecision.allowed) {
      return {
        ...secondaryDecision,
        allowed: false,
        remaining: primaryDecision.remaining,
      };
    }

    return primaryDecision;
  }

  /**
   * Reset both algorithms
   */
  async reset(identifier: string): Promise<void> {
    await Promise.all([
      this.primary.reset(identifier),
      this.secondary.reset(identifier),
    ]);
  }
}
