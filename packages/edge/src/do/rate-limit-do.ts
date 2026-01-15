/**
 * Rate Limit Durable Object
 *
 * Distributed rate limiting state management using Durable Objects.
 * Coordinates rate limiting across multiple Cloudflare Workers instances.
 *
 * Each DO instance manages rate limit state for a specific key (user, IP, etc.).
 * Uses token bucket and sliding window algorithms for accurate rate limiting.
 */

import type {
  TokenBucketState,
  SlidingWindowState,
  RateLimitDecision,
  RateLimitAlgorithm,
  SubscriptionTier,
} from '../lib/rate-limit/types';

/**
 * DO state storage interface
 */
interface DORateLimitState {
  /**
   * Token bucket state
   */
  tokenBucket?: TokenBucketState;

  /**
   * Sliding window state
   */
  slidingWindow?: SlidingWindowState;

  /**
   * Last access timestamp
   */
  lastAccess: number;

  /**
   * Algorithm being used
   */
  algorithm: RateLimitAlgorithm;

  /**
   * Tier configuration
   */
  tier: SubscriptionTier;

  /**
   * Configuration
   */
  config: {
    maxRequests: number;
    windowMs: number;
    burst?: number;
  };
}

/**
 * Check request payload
 */
interface CheckRequest {
  /**
   * Algorithm to use
   */
  algorithm?: RateLimitAlgorithm;

  /**
   * Tokens to consume (for token bucket)
   */
  tokens?: number;

  /**
   * Tier
   */
  tier: SubscriptionTier;

  /**
   * Configuration
   */
  config: {
    maxRequests: number;
    windowMs: number;
    burst?: number;
  };

  /**
   * Burst configuration
   */
  burstConfig?: {
    enabled: boolean;
    burstSize: number;
    cooldownPeriod: number;
  };
}

/**
 * Rate Limit Durable Object
 */
export class RateLimitDO implements DurableObject {
  private storage: DurableObjectStorage;
  private doState: DORateLimitState;

  constructor(state: DurableObjectState, _env: unknown) {
    this.storage = state.storage;

    // Initialize default state
    this.doState = {
      lastAccess: Date.now(),
      algorithm: 'token-bucket',
      tier: 'free',
      config: {
        maxRequests: 60,
        windowMs: 60000,
      },
    };
  }

  /**
   * Handle incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname;

    try {
      switch (action) {
        case '/check':
          return this.handleCheck(request);
        case '/reset':
          return this.handleReset();
        case '/getState':
          return this.handleGetState();
        case '/configure':
          return this.handleConfigure(request);
        case '/cleanup':
          return this.handleCleanup();
        default:
          return Response.json({ error: 'Unknown action' }, { status: 400 });
      }
    } catch (error) {
      return Response.json(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  }

  /**
   * Handle rate limit check
   */
  private async handleCheck(request: Request): Promise<Response> {
    await this.loadState();

    const payload = (await request.json()) as CheckRequest;
    const { algorithm, tokens = 1, tier, config, burstConfig } = payload;

    // Update configuration if changed
    if (config.maxRequests !== this.doState.config.maxRequests ||
        config.windowMs !== this.doState.config.windowMs) {
      this.doState.config = config;
      this.doState.tier = tier;
      await this.initializeAlgorithm(algorithm || this.doState.algorithm);
    }

    // Check rate limit
    const decision = await this.checkLimit(algorithm || this.doState.algorithm, tokens, burstConfig);

    // Update last access
    this.doState.lastAccess = Date.now();
    await this.saveState();

    return Response.json(decision);
  }

  /**
   * Handle reset
   */
  private async handleReset(): Promise<Response> {
    await this.loadState();

    // Reset token bucket
    if (this.doState.tokenBucket) {
      this.doState.tokenBucket.tokens = this.doState.tokenBucket.capacity;
      this.doState.tokenBucket.lastRefill = Date.now();
    }

    // Reset sliding window
    if (this.doState.slidingWindow) {
      this.doState.slidingWindow.timestamps = [];
    }

    await this.saveState();

    return Response.json({ success: true });
  }

  /**
   * Handle get state
   */
  private async handleGetState(): Promise<Response> {
    await this.loadState();

    return Response.json({
      tokenBucket: this.doState.tokenBucket,
      slidingWindow: this.doState.slidingWindow,
      lastAccess: this.doState.lastAccess,
      algorithm: this.doState.algorithm,
      tier: this.doState.tier,
    });
  }

  /**
   * Handle configure
   */
  private async handleConfigure(request: Request): Promise<Response> {
    const payload = await request.json() as Partial<CheckRequest>;

    if (payload.config) {
      this.doState.config = payload.config;
    }

    if (payload.tier) {
      this.doState.tier = payload.tier;
    }

    if (payload.algorithm) {
      await this.initializeAlgorithm(payload.algorithm);
      this.doState.algorithm = payload.algorithm;
    }

    await this.saveState();

    return Response.json({ success: true });
  }

  /**
   * Handle cleanup
   */
  private async handleCleanup(): Promise<Response> {
    // Clean up old sliding window timestamps
    if (this.doState.slidingWindow) {
      const now = Date.now();
      const windowStart = now - this.doState.slidingWindow.windowMs;
      this.doState.slidingWindow.timestamps =
        this.doState.slidingWindow.timestamps.filter(ts => ts > windowStart);

      await this.saveState();
    }

    return Response.json({ success: true });
  }

  /**
   * Check rate limit using configured algorithm
   */
  private async checkLimit(
    algorithm: RateLimitAlgorithm,
    tokens: number,
    burstConfig?: CheckRequest['burstConfig']
  ): Promise<RateLimitDecision> {
    if (algorithm === 'token-bucket') {
      return this.checkTokenBucket(tokens, burstConfig);
    } else if (algorithm === 'sliding-window') {
      return this.checkSlidingWindow();
    } else {
      // Default to token bucket
      return this.checkTokenBucket(tokens, burstConfig);
    }
  }

  /**
   * Check token bucket rate limit
   */
  private checkTokenBucket(
    tokens: number,
    burstConfig?: CheckRequest['burstConfig']
  ): RateLimitDecision {
    const now = Date.now();
    let bucket = this.doState.tokenBucket;

    // Initialize if needed
    if (!bucket) {
      const capacity = this.doState.config.maxRequests;
      const burst = burstConfig?.enabled ? burstConfig.burstSize : this.doState.config.burst;
      const effectiveCapacity = burst ? capacity + burst : capacity;

      bucket = {
        tokens: effectiveCapacity,
        lastRefill: now,
        capacity: this.doState.config.maxRequests,
        refillRate: this.doState.config.maxRequests / (this.doState.config.windowMs / 1000),
        ...(burst !== undefined && { burst }),
      };

      this.doState.tokenBucket = bucket;
    }

    // Refill tokens based on elapsed time
    const elapsed = (now - bucket.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * bucket.refillRate;

    let effectiveCapacity = bucket.capacity;
    if (burstConfig?.enabled && bucket.burst) {
      // Check if in cooldown
      const timeSinceLastRefill = now - bucket.lastRefill;
      if (timeSinceLastRefill < burstConfig.cooldownPeriod) {
        effectiveCapacity = bucket.capacity; // No burst during cooldown
      } else {
        effectiveCapacity = bucket.capacity + bucket.burst;
      }
    }

    bucket.tokens = Math.min(effectiveCapacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Check if enough tokens
    const allowed = bucket.tokens >= tokens;
    const remaining = Math.max(0, bucket.tokens - (allowed ? tokens : 0));

    if (allowed) {
      bucket.tokens -= tokens;
    }

    // Calculate reset time
    const tokensNeeded = bucket.capacity - bucket.tokens;
    const resetMs = (tokensNeeded / bucket.refillRate) * 1000;

    const result: RateLimitDecision = {
      allowed,
      remaining: Math.floor(remaining),
      limit: Math.floor(effectiveCapacity),
      resetTime: now + resetMs,
      resetIn: Math.floor(resetMs),
      currentUsage: Math.floor(bucket.capacity - bucket.tokens),
      tier: this.doState.tier,
    };

    if (!allowed) {
      result.retryAfter = Math.ceil(resetMs / 1000);
    }

    return result;
  }

  /**
   * Check sliding window rate limit
   */
  private checkSlidingWindow(): RateLimitDecision {
    const now = Date.now();
    let window = this.doState.slidingWindow;

    // Initialize if needed
    if (!window) {
      window = {
        timestamps: [],
        maxRequests: this.doState.config.maxRequests,
        windowMs: this.doState.config.windowMs,
      };

      this.doState.slidingWindow = window;
    }

    // Filter out timestamps outside the window
    const windowStart = now - window.windowMs;
    const validTimestamps = window.timestamps.filter(ts => ts > windowStart);

    // Check if under limit
    const allowed = validTimestamps.length < window.maxRequests;

    if (allowed) {
      validTimestamps.push(now);
    }

    window.timestamps = validTimestamps;

    // Calculate reset time (when oldest request expires)
    const oldestTimestamp = validTimestamps.length > 0 ? validTimestamps[0]! : now;
    const resetTime = oldestTimestamp + window.windowMs;

    const result: RateLimitDecision = {
      allowed,
      remaining: Math.max(0, window.maxRequests - validTimestamps.length),
      limit: window.maxRequests,
      resetTime,
      resetIn: Math.max(0, resetTime - now),
      currentUsage: validTimestamps.length,
      tier: this.doState.tier,
    };

    if (!allowed) {
      result.retryAfter = Math.ceil((resetTime - now) / 1000);
    }

    return result;
  }

  /**
   * Initialize algorithm state
   */
  private async initializeAlgorithm(algorithm: RateLimitAlgorithm): Promise<void> {
    if (algorithm === 'token-bucket' && !this.doState.tokenBucket) {
      const capacity = this.doState.config.maxRequests;
      const burst = this.doState.config.burst;
      const effectiveCapacity = burst ? capacity + burst : capacity;

      const tokenBucketState: TokenBucketState = {
        tokens: effectiveCapacity,
        lastRefill: Date.now(),
        capacity,
        refillRate: capacity / (this.doState.config.windowMs / 1000),
      };

      if (burst !== undefined) {
        tokenBucketState.burst = burst;
      }

      this.doState.tokenBucket = tokenBucketState;
    } else if (algorithm === 'sliding-window' && !this.doState.slidingWindow) {
      this.doState.slidingWindow = {
        timestamps: [],
        maxRequests: this.doState.config.maxRequests,
        windowMs: this.doState.config.windowMs,
      };
    }

    await this.saveState();
  }

  /**
   * Load state from storage
   */
  private async loadState(): Promise<void> {
    try {
      const stored = await this.storage.get<DORateLimitState>('state');
      if (stored) {
        this.doState = stored;
      }
    } catch (error) {
      console.error('Failed to load DO state:', error);
    }
  }

  /**
   * Save state to storage
   */
  private async saveState(): Promise<void> {
    try {
      await this.storage.put('state', this.doState);
    } catch (error) {
      console.error('Failed to save DO state:', error);
    }
  }

  /**
   * Alarm handler for periodic maintenance
   */
  async alarm(): Promise<void> {
    await this.loadState();

    // Clean up old sliding window timestamps
    if (this.doState.slidingWindow) {
      const now = Date.now();
      const windowStart = now - this.doState.slidingWindow.windowMs;
      this.doState.slidingWindow.timestamps =
        this.doState.slidingWindow.timestamps.filter(ts => ts > windowStart);
    }

    // Save updated state
    await this.saveState();
  }
}

/**
 * Rate Limit Coordinator DO
 *
 * Coordinates rate limiting across multiple DO instances.
 * Provides aggregated statistics and global rate limiting.
 */
export class RateLimitCoordinatorDO implements DurableObject {
  private storage: DurableObjectStorage;

  constructor(state: DurableObjectState, _env: unknown) {
    this.storage = state.storage;
  }

  /**
   * Handle incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const action = url.pathname;

    try {
      switch (action) {
        case '/checkGlobal':
          return this.handleCheckGlobal(request);
        case '/getStats':
          return this.handleGetStats();
        case '/resetAll':
          return this.handleResetAll();
        default:
          return Response.json({ error: 'Unknown action' }, { status: 400 });
      }
    } catch (error) {
      return Response.json(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  }

  /**
   * Handle global rate limit check
   */
  private async handleCheckGlobal(request: Request): Promise<Response> {
    const payload = await request.json() as { limit: number; windowMs: number };
    const { limit, windowMs } = payload;

    const now = Date.now();
    const key = `global:${Math.floor(now / windowMs)}`;

    let count = await this.storage.get<number>(key) || 0;

    if (count >= limit) {
      return Response.json({
        allowed: false,
        remaining: 0,
        limit,
        resetTime: Math.floor(now / windowMs + 1) * windowMs,
        resetIn: (Math.floor(now / windowMs + 1) * windowMs) - now,
        currentUsage: count,
      });
    }

    count++;
    await this.storage.put(key, count);

    return Response.json({
      allowed: true,
      remaining: limit - count,
      limit,
      resetTime: Math.floor(now / windowMs + 1) * windowMs,
      resetIn: (Math.floor(now / windowMs + 1) * windowMs) - now,
      currentUsage: count,
    });
  }

  /**
   * Handle get stats
   */
  private async handleGetStats(): Promise<Response> {
    const stats = {
      totalRequests: 0,
      blockedRequests: 0,
      lastUpdated: Date.now(),
    };

    // Count all keys
    const keys = await this.storage.list();
    for (const [_keyName, value] of keys) {
      if (typeof value === 'number') {
        stats.totalRequests += value;
      }
    }

    return Response.json(stats);
  }

  /**
   * Handle reset all
   */
  private async handleResetAll(): Promise<Response> {
    // Delete all keys
    await this.storage.deleteAll();

    return Response.json({ success: true });
  }

  /**
   * Alarm handler for cleanup
   */
  async alarm(): Promise<void> {
    // Cleanup is handled by TTL on keys
    // This can be used for periodic aggregation
  }
}
