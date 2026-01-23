/**
 * Rate Limiting Utility
 * Token bucket rate limiting for Cloudflare Workers
 */

export interface RateLimitConfig {
  requests: number; // Max requests
  window: number; // Time window in seconds
  burst?: number; // Burst capacity
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface RateLimitState {
  count: number;
  reset: number;
}

export class RateLimiter {
  private limits: Map<string, RateLimitState> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if request is allowed
   */
  async check(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = this.config.window * 1000;

    let state = this.limits.get(identifier);

    // Reset if window expired
    if (!state || now > state.reset) {
      state = {
        count: 0,
        reset: now + windowMs
      };
      this.limits.set(identifier, state);
    }

    // Check if request is allowed
    const allowed = state.count < this.config.requests;

    if (allowed) {
      state.count++;
    }

    return {
      allowed,
      remaining: Math.max(0, this.config.requests - state.count),
      resetAt: state.reset
    };
  }

  /**
   * Reset rate limit for identifier
   */
  reset(identifier: string): void {
    this.limits.delete(identifier);
  }

  /**
   * Clean up expired states
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, state] of this.limits.entries()) {
      if (now > state.reset) {
        this.limits.delete(key);
      }
    }
  }
}

/**
 * KV-based rate limiter for distributed systems
 */
export class KVRateLimiter {
  private prefix = 'ratelimit:';
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig, private kv: KVNamespace) {
    this.config = config;
  }

  /**
   * Check rate limit using KV storage
   */
  async check(identifier: string): Promise<RateLimitResult> {
    const key = this.prefix + identifier;
    const now = Date.now();
    const windowMs = this.config.window * 1000;
    const reset = now + windowMs;

    // Get current state
    const data = await this.kv.get(key, { type: 'json' }) as RateLimitState | null;

    let count = 0;
    let resetAt = reset;

    if (data) {
      if (now > data.reset) {
        // Window expired, reset
        count = 1;
        resetAt = reset;
      } else {
        // Within window
        count = data.count + 1;
        resetAt = data.reset;
      }
    } else {
      // First request
      count = 1;
    }

    // Check if allowed
    const allowed = count <= this.config.requests;

    // Store updated state
    if (allowed) {
      await this.kv.put(key, JSON.stringify({
        count,
        reset: resetAt
      }), {
        expirationTtl: this.config.window
      });
    }

    return {
      allowed,
      remaining: Math.max(0, this.config.requests - count),
      resetAt
    };
  }

  /**
   * Reset rate limit for identifier
   */
  async reset(identifier: string): Promise<void> {
    const key = this.prefix + identifier;
    await this.kv.delete(key);
  }
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const RateLimits = {
  /**
   * Strict rate limit for expensive operations
   * 10 requests per minute
   */
  strict: new RateLimiter({ requests: 10, window: 60 }),

  /**
   * Standard rate limit for API calls
   * 100 requests per minute
   */
  standard: new RateLimiter({ requests: 100, window: 60 }),

  /**
   * Lenient rate limit for read operations
   * 1000 requests per minute
   */
  lenient: new RateLimiter({ requests: 1000, window: 60 }),

  /**
   * Deployment rate limit
   * 10 deployments per hour
   */
  deployment: new RateLimiter({ requests: 10, window: 3600 })
};

/**
 * Rate limiting middleware for Hono
 */
export function rateLimit(limiter: RateLimiter, getIdentifier: (c: any) => string) {
  return async (c: any, next: any) => {
    const identifier = getIdentifier(c);
    const result = await limiter.check(identifier);

    // Add rate limit headers
    c.header('X-RateLimit-Limit', limiter['config'].requests.toString());
    c.header('X-RateLimit-Remaining', result.remaining.toString());
    c.header('X-RateLimit-Reset', new Date(result.resetAt).toISOString());

    if (!result.allowed) {
      return c.json({
        error: 'Rate limit exceeded',
        resetAt: result.resetAt
      }, 429);
    }

    await next();
  };
}
