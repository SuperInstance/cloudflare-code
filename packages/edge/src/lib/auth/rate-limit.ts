/**
 * Rate Limiting for Authentication
 *
 * Per-user and per-organization rate limiting with role-based limits.
 * Integrates with existing token bucket and sliding window rate limiters.
 */

import type { Context, Next } from 'hono';
import type { UserRole } from './types';
import { AuthError } from './types';
import { DEFAULT_RATE_LIMITS, type RoleRateLimits } from './types';
import type { AuthEnv } from './middleware';

// ============================================================================
// RATE LIMIT CONFIGURATION
// ============================================================================

/**
 * Custom rate limits for specific users/organizations
 */
interface CustomRateLimit {
  userId?: string;
  organizationId?: string;
  limits: Partial<RoleRateLimits>;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Default limits by role */
  roleLimits: Record<UserRole, RoleRateLimits>;
  /** Custom overrides */
  customLimits: CustomRateLimit[];
  /** Redis/KV prefix */
  prefix: string;
}

/**
 * Default rate limit config
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  roleLimits: DEFAULT_RATE_LIMITS,
  customLimits: [],
  prefix: 'rate_limit',
};

// ============================================================================
// RATE LIMIT STATE
// ============================================================================

/**
 * Rate limit state stored in KV
 */
interface RateLimitState {
  count: number;
  resetAt: number;
  lastRequest: number;
}

/**
 * Rate limit info response
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

// ============================================================================
// RATE LIMITER CLASS
// ============================================================================

/**
 * Rate limiter for authentication
 */
export class AuthRateLimiter {
  private kv: KVNamespace;
  private config: RateLimitConfig;
  private do?: DurableObjectNamespace;

  constructor(kv: KVNamespace, config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG) {
    this.kv = kv;
    this.config = config;
  }

  /**
   * Set Durable Object for distributed rate limiting
   */
  setDO(doNamespace: DurableObjectNamespace): void {
    this.do = doNamespace;
  }

  /**
   * Get rate limits for user
   */
  getLimitsForUser(userId: string, role: UserRole, organizationId?: string): RoleRateLimits {
    // Check custom limits first
    for (const custom of this.config.customLimits) {
      if ((custom.userId === userId || custom.organizationId === organizationId) && custom.limits) {
        return {
          ...this.config.roleLimits[role],
          ...custom.limits,
        };
      }
    }

    return this.config.roleLimits[role];
  }

  /**
   * Check rate limit for user
   */
  async checkRateLimit(
    identifier: string,
    window: 'minute' | 'hour' | 'day',
    limit: number
  ): Promise<RateLimitInfo> {
    const now = Date.now();
    const key = `${this.config.prefix}:${identifier}:${window}`;

    // Get current state
    const state = await this.kv.get<RateLimitState>(key, 'json');

    if (!state) {
      // First request
      const resetAt = this.getResetTime(window);
      await this.kv.put(key, JSON.stringify({
        count: 1,
        resetAt,
        lastRequest: now,
      }), {
        expirationTtl: this.getTTL(window),
      });

      return {
        limit,
        remaining: limit - 1,
        resetAt,
      };
    }

    // Check if window expired
    if (now >= state.resetAt) {
      const resetAt = this.getResetTime(window);
      await this.kv.put(key, JSON.stringify({
        count: 1,
        resetAt,
        lastRequest: now,
      }), {
        expirationTtl: this.getTTL(window),
      });

      return {
        limit,
        remaining: limit - 1,
        resetAt,
      };
    }

    // Check limit
    if (state.count >= limit) {
      const retryAfter = Math.ceil((state.resetAt - now) / 1000);
      throw new AuthError(
        'RATE_LIMIT_EXCEEDED',
        `Rate limit exceeded for ${window} window`,
        429,
        { limit, window, retryAfter }
      );
    }

    // Increment counter
    const newState: RateLimitState = {
      count: state.count + 1,
      resetAt: state.resetAt,
      lastRequest: now,
    };

    await this.kv.put(key, JSON.stringify(newState), {
      expirationTtl: this.getTTL(window),
    });

    return {
      limit,
      remaining: limit - newState.count,
      resetAt: state.resetAt,
    };
  }

  /**
   * Check all rate limits for user
   */
  async checkAllRateLimits(
    userId: string,
    role: UserRole,
    organizationId?: string
  ): Promise<void> {
    const limits = this.getLimitsForUser(userId, role, organizationId);
    const identifier = organizationId ? `org:${organizationId}` : `user:${userId}`;

    // Check all windows
    await Promise.all([
      this.checkRateLimit(identifier, 'minute', limits.requestsPerMinute),
      this.checkRateLimit(identifier, 'hour', limits.requestsPerHour),
      this.checkRateLimit(identifier, 'day', limits.requestsPerDay),
    ]);
  }

  /**
   * Get current rate limit status
   */
  async getRateLimitStatus(
    userId: string,
    role: UserRole,
    organizationId?: string
  ): Promise<{
    minute: RateLimitInfo;
    hour: RateLimitInfo;
    day: RateLimitInfo;
  }> {
    const limits = this.getLimitsForUser(userId, role, organizationId);
    const identifier = organizationId ? `org:${organizationId}` : `user:${userId}`;

    const [minute, hour, day] = await Promise.all([
      this.checkRateLimit(identifier, 'minute', limits.requestsPerMinute),
      this.checkRateLimit(identifier, 'hour', limits.requestsPerHour),
      this.checkRateLimit(identifier, 'day', limits.requestsPerDay),
    ]);

    return { minute, hour, day };
  }

  /**
   * Reset rate limit for user
   */
  async resetRateLimit(userId: string, window: 'minute' | 'hour' | 'day'): Promise<void> {
    const key = `${this.config.prefix}:user:${userId}:${window}`;
    await this.kv.delete(key);
  }

  /**
   * Reset all rate limits for user
   */
  async resetAllRateLimits(userId: string): Promise<void> {
    const keys = ['minute', 'hour', 'day'].map(
      window => `${this.config.prefix}:user:${userId}:${window}`
    );

    await Promise.all(keys.map(key => this.kv.delete(key)));
  }

  /**
   * Get reset time for window
   */
  private getResetTime(window: 'minute' | 'hour' | 'day'): number {
    const now = Date.now();

    switch (window) {
      case 'minute':
        // Next minute
        return Math.ceil(now / 60000) * 60000;
      case 'hour':
        // Next hour
        return Math.ceil(now / 3600000) * 3600000;
      case 'day':
        // Next day (midnight UTC)
        const day = 86400000;
        return Math.ceil(now / day) * day;
    }
  }

  /**
   * Get TTL for KV storage
   */
  private getTTL(window: 'minute' | 'hour' | 'day'): number {
    switch (window) {
      case 'minute':
        return 120; // 2 minutes
      case 'hour':
        return 3600; // 1 hour
      case 'day':
        return 86400; // 1 day
    }
  }
}

// ============================================================================
// RATE LIMIT MIDDLEWARE
// ============================================================================

/**
 * Rate limiting middleware
 *
 * Checks rate limits based on user role and adds rate limit headers to response.
 */
export const rateLimitMiddleware = (limiter: AuthRateLimiter) => {
  return async (c: Context<{ Bindings: AuthEnv }>, next: Next) => {
    const authContext = c.get('authContext');

    if (!authContext) {
      return next();
    }

    try {
      // Check rate limits
      const userId = authContext.userId || 'anonymous';
      const role = authContext.role;
      const organizationId = authContext.organizationId;

      await limiter.checkAllRateLimits(userId, role, organizationId);

      // Get rate limit status for headers
      const status = await limiter.getRateLimitStatus(userId, role, organizationId);

      // Store for response headers
      c.set('rateLimit', status);

      return next();
    } catch (error) {
      if (error instanceof AuthError && error.code === 'RATE_LIMIT_EXCEEDED') {
        // Add retry-after header
        const retryAfter = error.details?.retryAfter as number | undefined;
        if (retryAfter) {
          c.res.headers.set('Retry-After', retryAfter.toString());
        }
        throw error;
      }
      throw error;
    }
  };
};

/**
 * Add rate limit headers to response
 */
export const rateLimitHeaders = async (c: Context, next: Next) => {
  await next();

  const status = c.get('rateLimit');

  if (status) {
    // Add rate limit headers
    c.res.headers.set('X-RateLimit-Limit-Minute', status.minute.limit.toString());
    c.res.headers.set('X-RateLimit-Remaining-Minute', status.minute.remaining.toString());
    c.res.headers.set('X-RateLimit-Reset-Minute', status.minute.resetAt.toString());

    c.res.headers.set('X-RateLimit-Limit-Hour', status.hour.limit.toString());
    c.res.headers.set('X-RateLimit-Remaining-Hour', status.hour.remaining.toString());
    c.res.headers.set('X-RateLimit-Reset-Hour', status.hour.resetAt.toString());

    c.res.headers.set('X-RateLimit-Limit-Day', status.day.limit.toString());
    c.res.headers.set('X-RateLimit-Remaining-Day', status.day.remaining.toString());
    c.res.headers.set('X-RateLimit-Reset-Day', status.day.resetAt.toString());
  }
};

// ============================================================================
// TOKEN-BASED RATE LIMITING
// ============================================================================

/**
 * Token bucket rate limiter for finer-grained control
 */
export class TokenBucketRateLimiter {
  private kv: KVNamespace;
  private do?: DurableObjectNamespace;

  constructor(kv: KVNamespace, doNamespace?: DurableObjectNamespace) {
    this.kv = kv;
    this.do = doNamespace;
  }

  /**
   * Check and consume tokens
   */
  async consumeTokens(
    identifier: string,
    tokens: number,
    capacity: number,
    refillRate: number, // tokens per second
    window: number = 60 // window in seconds
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Date.now();
    const key = `token_bucket:${identifier}`;

    // Get current state
    const state = await this.kv.get<{ tokens: number; lastRefill: number }>(key, 'json');

    let currentTokens = capacity;
    let lastRefill = now;

    if (state) {
      currentTokens = state.tokens;
      lastRefill = state.lastRefill;

      // Refill tokens
      const elapsed = (now - lastRefill) / 1000;
      const tokensToAdd = Math.floor(elapsed * refillRate);
      currentTokens = Math.min(capacity, currentTokens + tokensToAdd);
    }

    // Check if enough tokens
    if (currentTokens < tokens) {
      const resetTime = lastRefill + (capacity - currentTokens) / refillRate * 1000;
      return {
        allowed: false,
        remaining: currentTokens,
        resetAt: Math.ceil(resetTime),
      };
    }

    // Consume tokens
    currentTokens -= tokens;

    // Update state
    await this.kv.put(key, JSON.stringify({
      tokens: currentTokens,
      lastRefill: now,
    }), {
      expirationTtl: window,
    });

    return {
      allowed: true,
      remaining: currentTokens,
      resetAt: now + window * 1000,
    };
  }
}

// ============================================================================
// CONCURRENT REQUEST LIMITING
// ============================================================================

/**
 * Concurrent request limiter
 */
export class ConcurrentRequestLimiter {
  private kv: KVNamespace;
  private do?: DurableObjectNamespace;

  constructor(kv: KVNamespace, doNamespace?: DurableObjectNamespace) {
    this.kv = kv;
    this.do = doNamespace;
  }

  /**
   * Acquire slot for concurrent request
   */
  async acquireSlot(
    identifier: string,
    maxConcurrent: number,
    timeout: number = 30000 // 30 seconds
  ): Promise<{ acquired: boolean; waitTime: number }> {
    const now = Date.now();
    const key = `concurrent:${identifier}`;
    const lockKey = `lock:${identifier}`;

    // Get current active requests
    const active = await this.kv.get<number>(key, 'json');
    const current = active || 0;

    if (current < maxConcurrent) {
      // Slot available
      await this.kv.put(key, JSON.stringify(current + 1), {
        expirationTtl: 60,
      });

      return { acquired: true, waitTime: 0 };
    }

    // No slot available
    const retryAfter = Math.ceil(timeout / 1000);
    throw new AuthError(
      'RATE_LIMIT_EXCEEDED',
      'Too many concurrent requests',
      429,
      { maxConcurrent, retryAfter }
    );
  }

  /**
   * Release slot
   */
  async releaseSlot(identifier: string): Promise<void> {
    const key = `concurrent:${identifier}`;

    const active = await this.kv.get<number>(key, 'json');
    if (active && active > 0) {
      await this.kv.put(key, JSON.stringify(active - 1), {
        expirationTtl: 60,
      });
    }
  }
}

// ============================================================================
// MIDDLEWARE FACTORY
// ============================================================================

/**
 * Create rate limiting middleware with custom limiter
 */
export function createRateLimitMiddleware(limiter: AuthRateLimiter) {
  return rateLimitMiddleware(limiter);
}

/**
 * Create rate limiting middleware with custom config
 */
export function createRateLimitMiddlewareWithConfig(config: Partial<RateLimitConfig>) {
  const limiter = new AuthRateLimiter(
    null as any, // Will be set in middleware
    { ...DEFAULT_RATE_LIMIT_CONFIG, ...config }
  );

  return rateLimitMiddleware(limiter);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get rate limit info from context
 */
export function getRateLimitInfo(c: Context): {
  minute: RateLimitInfo;
  hour: RateLimitInfo;
  day: RateLimitInfo;
} | null {
  return c.get('rateLimit') || null;
}

/**
 * Check if rate limited
 */
export function isRateLimited(c: Context): boolean {
  const status = getRateLimitInfo(c);
  if (!status) return false;

  return status.minute.remaining === 0 ||
         status.hour.remaining === 0 ||
         status.day.remaining === 0;
}

/**
 * Get retry after time
 */
export function getRetryAfter(c: Context): number | null {
  const status = getRateLimitInfo(c);
  if (!status) return null;

  const now = Date.now();
  const resets = [
    status.minute.resetAt,
    status.hour.resetAt,
    status.day.resetAt,
  ].filter(t => t > now);

  if (resets.length === 0) return null;

  return Math.min(...resets);
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  DEFAULT_RATE_LIMITS,
  type RoleRateLimits,
  type RateLimitInfo,
  type RateLimitState,
  type CustomRateLimit,
  type RateLimitConfig,
};
