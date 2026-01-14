/**
 * Rate Limiting Middleware
 * Protects against DDoS attacks and brute force attempts
 * Designed for Cloudflare Workers with KV storage
 */

import type { Context, Next } from 'hono';
import type { RateLimitConfig, RateLimitInfo, SecurityContext } from '../types';
import { securityLogger } from '../utils/logger';
import { generateUUID } from '../utils/crypto';

interface RateLimitStore {
  key: string;
  count: number;
  resetTime: number;
  blocked: boolean;
}

export class RateLimiter {
  private config: Required<RateLimitConfig>;
  private store: Map<string, RateLimitStore> = new Map();

  constructor(config: RateLimitConfig = {}) {
    this.config = {
      windowMs: config.windowMs || 60000, // 1 minute
      maxRequests: config.maxRequests || 100,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator.bind(this),
      skipSuccessfulRequests: config.skipSuccessfulRequests || false,
      skipFailedRequests: config.skipFailedRequests || false,
      handler: config.handler || this.defaultHandler.bind(this)
    };
  }

  private defaultKeyGenerator(c: Context): string {
    const ip = c.req.header('cf-connecting-ip') ||
               c.req.header('x-forwarded-for')?.split(',')[0] ||
               'unknown';
    return `ratelimit:${ip}:${c.req.path()}`;
  }

  private defaultHandler(c: Context, next: Next): Response {
    return c.json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(this.config.windowMs / 1000)
    }, 429);
  }

  /**
   * Rate limiting middleware
   */
  async middleware(c: Context, next: Next): Promise<void | Response> {
    const key = await this.config.keyGenerator(c);
    const now = Date.now();

    // Get current rate limit state
    let state = this.store.get(key);

    // Reset if window has expired
    if (!state || now > state.resetTime) {
      state = {
        key,
        count: 0,
        resetTime: now + this.config.windowMs,
        blocked: false
      };
      this.store.set(key, state);
    }

    // Check if blocked
    if (state.blocked) {
      securityLogger.warn('Rate limit exceeded - request blocked', {
        ip: c.req.header('cf-connecting-ip'),
        path: c.req.path(),
        key
      });

      return this.config.handler(c, next);
    }

    // Increment counter
    state.count++;

    // Check if limit exceeded
    if (state.count > this.config.maxRequests) {
      state.blocked = true;

      securityLogger.warn('Rate limit exceeded', {
        ip: c.req.header('cf-connecting-ip'),
        path: c.req.path(),
        count: state.count,
        limit: this.config.maxRequests,
        key
      });

      return this.config.handler(c, next);
    }

    // Add rate limit info to response headers
    c.header('X-RateLimit-Limit', this.config.maxRequests.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, this.config.maxRequests - state.count).toString());
    c.header('X-RateLimit-Reset', new Date(state.resetTime).toISOString());

    await next();

    // Optionally skip counting successful/failed requests
    const status = c.res.status;
    if (this.config.skipSuccessfulRequests && status >= 200 && status < 300) {
      state.count--;
    } else if (this.config.skipFailedRequests && (status < 200 || status >= 400)) {
      state.count--;
    }
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Get rate limit info for a key
   */
  getRateLimitInfo(key: string): RateLimitInfo | null {
    const state = this.store.get(key);
    if (!state) return null;

    return {
      limit: this.config.maxRequests,
      current: state.count,
      remaining: Math.max(0, this.config.maxRequests - state.count),
      resetTime: new Date(state.resetTime)
    };
  }

  /**
   * Clear all rate limits
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, state] of this.store.entries()) {
      if (now > state.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Advanced rate limiter with Cloudflare KV integration
 */
export class CloudflareRateLimiter {
  private config: Required<RateLimitConfig>;
  private kv: KVNamespace;
  private prefix: string;

  constructor(kv: KVNamespace, config: RateLimitConfig = {}) {
    this.kv = kv;
    this.prefix = 'ratelimit:';
    this.config = {
      windowMs: config.windowMs || 60000,
      maxRequests: config.maxRequests || 100,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator.bind(this),
      skipSuccessfulRequests: config.skipSuccessfulRequests || false,
      skipFailedRequests: config.skipFailedRequests || false,
      handler: config.handler || this.defaultHandler.bind(this)
    };
  }

  private defaultKeyGenerator(c: Context): string {
    const ip = c.req.header('cf-connecting-ip') ||
               c.req.header('x-forwarded-for')?.split(',')[0] ||
               'unknown';
    return `${ip}:${c.req.path()}`;
  }

  private defaultHandler(c: Context, next: Next): Response {
    return c.json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(this.config.windowMs / 1000)
    }, 429);
  }

  async middleware(c: Context, next: Next): Promise<void | Response> {
    const key = await this.config.keyGenerator(c);
    const fullKey = this.prefix + key;
    const now = Date.now();
    const resetTime = now + this.config.windowMs;

    // Get current count from KV
    const stored = await this.kv.get(fullKey, 'json');
    const state = stored as RateLimitStore | null;

    // Initialize or reset if window has expired
    let count = 0;
    if (!state || now > (state.resetTime || 0)) {
      await this.kv.put(fullKey, JSON.stringify({
        key: fullKey,
        count: 1,
        resetTime,
        blocked: false
      }), { expirationTtl: Math.ceil(this.config.windowMs / 1000) });
      count = 1;
    } else {
      count = (state.count || 0) + 1;

      // Check if limit exceeded
      if (count > this.config.maxRequests) {
        // Block for remaining window
        const remainingTTL = Math.ceil((state.resetTime! - now) / 1000);
        await this.kv.put(fullKey, JSON.stringify({
          key: fullKey,
          count,
          resetTime: state.resetTime,
          blocked: true
        }), { expirationTtl: remainingTTL });

        securityLogger.warn('Rate limit exceeded', {
          ip: c.req.header('cf-connecting-ip'),
          path: c.req.path(),
          count,
          limit: this.config.maxRequests
        });

        return this.config.handler(c, next);
      }

      // Update count
      await this.kv.put(fullKey, JSON.stringify({
        key: fullKey,
        count,
        resetTime: state.resetTime,
        blocked: false
      }), { expirationTtl: Math.ceil((state.resetTime! - now) / 1000) });
    }

    // Add rate limit info to response headers
    c.header('X-RateLimit-Limit', this.config.maxRequests.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, this.config.maxRequests - count).toString());
    c.header('X-RateLimit-Reset', new Date(resetTime).toISOString());

    await next();
  }

  async reset(key: string): Promise<void> {
    await this.kv.delete(this.prefix + key);
  }

  async getRateLimitInfo(key: string): Promise<RateLimitInfo | null> {
    const stored = await this.kv.get(this.prefix + key, 'json');
    const state = stored as RateLimitStore | null;

    if (!state) return null;

    return {
      limit: this.config.maxRequests,
      current: state.count,
      remaining: Math.max(0, this.config.maxRequests - state.count),
      resetTime: new Date(state.resetTime)
    };
  }
}

/**
 * Sliding window rate limiter for more accurate rate limiting
 */
export class SlidingWindowRateLimiter {
  private config: Required<RateLimitConfig>;
  private store: Map<string, number[]> = new Map();

  constructor(config: RateLimitConfig = {}) {
    this.config = {
      windowMs: config.windowMs || 60000,
      maxRequests: config.maxRequests || 100,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator.bind(this),
      skipSuccessfulRequests: config.skipSuccessfulRequests || false,
      skipFailedRequests: config.skipFailedRequests || false,
      handler: config.handler || this.defaultHandler.bind(this)
    };
  }

  private defaultKeyGenerator(c: Context): string {
    const ip = c.req.header('cf-connecting-ip') ||
               c.req.header('x-forwarded-for')?.split(',')[0] ||
               'unknown';
    return `ratelimit:${ip}:${c.req.path()}`;
  }

  private defaultHandler(c: Context, next: Next): Response {
    return c.json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(this.config.windowMs / 1000)
    }, 429);
  }

  async middleware(c: Context, next: Next): Promise<void | Response> {
    const key = await this.config.keyGenerator(c);
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get existing timestamps
    let timestamps = this.store.get(key) || [];

    // Remove timestamps outside the window
    timestamps = timestamps.filter(t => t > windowStart);

    // Check if limit exceeded
    if (timestamps.length >= this.config.maxRequests) {
      securityLogger.warn('Rate limit exceeded (sliding window)', {
        ip: c.req.header('cf-connecting-ip'),
        path: c.req.path(),
        count: timestamps.length,
        limit: this.config.maxRequests
      });

      return this.config.handler(c, next);
    }

    // Add current timestamp
    timestamps.push(now);
    this.store.set(key, timestamps);

    // Calculate reset time (oldest timestamp + window)
    const resetTime = timestamps[0] + this.config.windowMs;

    // Add rate limit info to response headers
    c.header('X-RateLimit-Limit', this.config.maxRequests.toString());
    c.header('X-RateLimit-Remaining', (this.config.maxRequests - timestamps.length).toString());
    c.header('X-RateLimit-Reset', new Date(resetTime).toISOString());

    await next();
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [key, timestamps] of this.store.entries()) {
      const validTimestamps = timestamps.filter(t => t > windowStart);
      if (validTimestamps.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, validTimestamps);
      }
    }
  }
}

/**
 * DDoS protection middleware
 */
export class DDoSProtection {
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();
  private blacklist: Set<string> = new Set();
  private whitelist: Set<string> = new Set();

  constructor(
    private threshold: number = 1000,
    private windowMs: number = 60000,
    private blacklistDuration: number = 3600000 // 1 hour
  ) {}

  /**
   * Check if IP is blacklisted
   */
  isBlacklisted(ip: string): boolean {
    return this.blacklist.has(ip);
  }

  /**
   * Check if IP is whitelisted
   */
  isWhitelisted(ip: string): boolean {
    return this.whitelist.has(ip);
  }

  /**
   * Add IP to blacklist
   */
  blacklistIP(ip: string): void {
    this.blacklist.add(ip);
    securityLogger.warn(`IP blacklisted: ${ip}`);

    // Auto-remove after duration
    setTimeout(() => {
      this.blacklist.delete(ip);
    }, this.blacklistDuration);
  }

  /**
   * Add IP to whitelist
   */
  whitelistIP(ip: string): void {
    this.whitelist.add(ip);
  }

  /**
   * Remove IP from blacklist
   */
  unblacklistIP(ip: string): void {
    this.blacklist.delete(ip);
  }

  /**
   * Remove IP from whitelist
   */
  unwhitelistIP(ip: string): void {
    this.whitelist.delete(ip);
  }

  /**
   * DDoS protection middleware
   */
  async middleware(c: Context, next: Next): Promise<void | Response> {
    const ip = c.req.header('cf-connecting-ip') ||
               c.req.header('x-forwarded-for')?.split(',')[0] ||
               'unknown';
    const now = Date.now();

    // Check whitelist
    if (this.isWhitelisted(ip)) {
      return next();
    }

    // Check blacklist
    if (this.isBlacklisted(ip)) {
      securityLogger.error('Blacklisted IP attempted access', {
        ip,
        path: c.req.path()
      });

      return c.json({
        error: 'Access denied',
        message: 'Your IP has been temporarily blocked due to suspicious activity'
      }, 403);
    }

    // Get current count
    let state = this.requestCounts.get(ip);

    // Reset if window has expired
    if (!state || now > state.resetTime) {
      state = { count: 0, resetTime: now + this.windowMs };
      this.requestCounts.set(ip, state);
    }

    // Increment counter
    state.count++;

    // Check if threshold exceeded
    if (state.count > this.threshold) {
      this.blacklistIP(ip);

      return c.json({
        error: 'Access denied',
        message: 'Too many requests from your IP. Please try again later.'
      }, 429);
    }

    await next();
  }

  /**
   * Get statistics
   */
  getStats(): {
    trackedIPs: number;
    blacklistedIPs: number;
    whitelistedIPs: number;
  } {
    return {
      trackedIPs: this.requestCounts.size,
      blacklistedIPs: this.blacklist.size,
      whitelistedIPs: this.whitelist.size
    };
  }

  /**
   * Clear all tracking data
   */
  clear(): void {
    this.requestCounts.clear();
  }
}

/**
 * Factory functions for creating rate limiters
 */
export function createRateLimiter(config?: RateLimitConfig) {
  return new RateLimiter(config);
}

export function createCloudflareRateLimiter(kv: KVNamespace, config?: RateLimitConfig) {
  return new CloudflareRateLimiter(kv, config);
}

export function createSlidingWindowRateLimiter(config?: RateLimitConfig) {
  return new SlidingWindowRateLimiter(config);
}

export function createDDoSProtection(
  threshold?: number,
  windowMs?: number,
  blacklistDuration?: number
) {
  return new DDoSProtection(threshold, windowMs, blacklistDuration);
}

/**
 * Simple rate limiting middleware
 */
export function rateLimit(options?: {
  windowMs?: number;
  maxRequests?: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) {
  const limiter = new RateLimiter({
    windowMs: options?.windowMs,
    maxRequests: options?.maxRequests,
    skipSuccessfulRequests: options?.skipSuccessfulRequests,
    skipFailedRequests: options?.skipFailedRequests
  });

  return limiter.middleware.bind(limiter);
}
