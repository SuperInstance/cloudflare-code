/**
 * Advanced Rate Limiting
 * Supports multiple algorithms: token-bucket, leaky-bucket, fixed-window, sliding-window
 */

import { DurableObjectStorage } from '@cloudflare/workers-types';
import {
  RateLimitConfig,
  RateLimitRule,
  RateLimitResult,
  RateLimitState,
  RateLimitStorage,
  RateLimitError,
  GatewayError,
} from '../types';

// ============================================================================
// Rate Limiter
// ============================================================================

export class RateLimiter {
  private config: RateLimitConfig;
  private storage: RateLimitStorageBackend;
  private localCache: Map<string, RateLimitState>;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.storage = this.createStorage(config.storage);
    this.localCache = new Map();
  }

  /**
   * Check if request is allowed
   */
  async checkLimit(
    identifier: string,
    endpoint?: string
  ): Promise<RateLimitResult> {
    if (!this.config.enabled) {
      return {
        allowed: true,
        limit: Number.MAX_SAFE_INTEGER,
        remaining: Number.MAX_SAFE_INTEGER,
        resetAt: Date.now() + 86400000,
      };
    }

    const rule = this.getRule(endpoint);
    const state = await this.getState(identifier, rule);

    const result = this.applyAlgorithm(state, rule);

    // Update state if allowed
    if (result.allowed) {
      await this.saveState(identifier, state);
    }

    return result;
  }

  /**
   * Get rate limit rule for endpoint
   */
  private getRule(endpoint?: string): RateLimitRule {
    if (endpoint && this.config.endpoints.has(endpoint)) {
      return this.config.endpoints.get(endpoint)!;
    }
    return this.config.default;
  }

  /**
   * Get rate limit state for identifier
   */
  private async getState(
    identifier: string,
    rule: RateLimitRule
  ): Promise<RateLimitState> {
    // Check local cache first
    const cacheKey = this.buildCacheKey(identifier);
    const cached = this.localCache.get(cacheKey);
    if (cached && cached.resetAt > Date.now()) {
      return cached;
    }

    // Load from storage
    const stored = await this.storage.get(identifier);
    if (stored && stored.resetAt > Date.now()) {
      this.localCache.set(cacheKey, stored);
      return stored;
    }

    // Create new state
    const now = Date.now();
    const newState: RateLimitState = {
      count: 0,
      resetAt: this.calculateResetTime(now, rule.window),
      remaining: rule.requests,
      burstTokens: rule.burst || rule.requests,
    };

    return newState;
  }

  /**
   * Save rate limit state
   */
  private async saveState(
    identifier: string,
    state: RateLimitState
  ): Promise<void> {
    const cacheKey = this.buildCacheKey(identifier);
    this.localCache.set(cacheKey, state);
    await this.storage.set(identifier, state);
  }

  /**
   * Apply rate limiting algorithm
   */
  private applyAlgorithm(
    state: RateLimitState,
    rule: RateLimitRule
  ): RateLimitResult {
    const now = Date.now();

    // Check if window has expired
    if (now >= state.resetAt) {
      state.count = 0;
      state.resetAt = this.calculateResetTime(now, rule.window);
      state.remaining = rule.requests;
    }

    switch (this.config.algorithm) {
      case 'token-bucket':
        return this.tokenBucket(state, rule);
      case 'leaky-bucket':
        return this.leakyBucket(state, rule);
      case 'fixed-window':
        return this.fixedWindow(state, rule);
      case 'sliding-window':
        return this.slidingWindow(state, rule);
      default:
        return this.fixedWindow(state, rule);
    }
  }

  /**
   * Token bucket algorithm
   */
  private tokenBucket(
    state: RateLimitState,
    rule: RateLimitRule
  ): RateLimitResult {
    const now = Date.now();
    const burst = rule.burst || rule.requests;

    // Refill tokens based on time elapsed
    const windowElapsed = now - (state.resetAt - rule.window);
    const tokensToAdd = Math.floor((windowElapsed / rule.window) * rule.requests);

    state.burstTokens = Math.min(burst, (state.burstTokens || burst) + tokensToAdd);

    if (state.burstTokens > 0) {
      state.burstTokens--;
      state.count++;
      state.remaining = state.burstTokens;

      return {
        allowed: true,
        limit: rule.requests,
        remaining: state.burstTokens,
        resetAt: state.resetAt,
      };
    }

    return {
      allowed: false,
      limit: rule.requests,
      remaining: 0,
      resetAt: state.resetAt,
      retryAfter: Math.ceil((state.resetAt - now) / 1000),
    };
  }

  /**
   * Leaky bucket algorithm
   */
  private leakyBucket(
    state: RateLimitState,
    rule: RateLimitRule
  ): RateLimitResult {
    const now = Date.now();

    // Leak tokens based on time elapsed
    if (state.burstTokens !== undefined && state.burstTokens < rule.requests) {
      const windowElapsed = now - (state.resetAt - rule.window);
      const leakRate = rule.requests / rule.window;
      const tokensToLeak = Math.floor(windowElapsed * leakRate);
      state.burstTokens = Math.min(rule.requests, state.burstTokens + tokensToLeak);
    }

    if ((state.burstTokens || rule.requests) < rule.requests) {
      state.burstTokens = (state.burstTokens || rule.requests) + 1;
      state.count++;
      state.remaining = rule.requests - (state.burstTokens || 0);

      return {
        allowed: true,
        limit: rule.requests,
        remaining: state.remaining,
        resetAt: state.resetAt,
      };
    }

    return {
      allowed: false,
      limit: rule.requests,
      remaining: 0,
      resetAt: state.resetAt,
      retryAfter: Math.ceil(rule.window / 1000),
    };
  }

  /**
   * Fixed window algorithm
   */
  private fixedWindow(
    state: RateLimitState,
    rule: RateLimitRule
  ): RateLimitResult {
    const now = Date.now();

    if (state.count < rule.requests) {
      state.count++;
      state.remaining = rule.requests - state.count;

      return {
        allowed: true,
        limit: rule.requests,
        remaining: state.remaining,
        resetAt: state.resetAt,
      };
    }

    return {
      allowed: false,
      limit: rule.requests,
      remaining: 0,
      resetAt: state.resetAt,
      retryAfter: Math.ceil((state.resetAt - now) / 1000),
    };
  }

  /**
   * Sliding window algorithm
   */
  private slidingWindow(
    state: RateLimitState,
    rule: RateLimitRule
  ): RateLimitResult {
    const now = Date.now();

    // Calculate weighted count from previous and current windows
    const windowStart = state.resetAt - rule.window;
    const windowProgress = (now - windowStart) / rule.window;
    const previousCount = state.count * (1 - windowProgress);

    const currentCount = Math.floor(previousCount);

    if (currentCount < rule.requests) {
      state.count++;
      state.remaining = rule.requests - currentCount - 1;

      return {
        allowed: true,
        limit: rule.requests,
        remaining: Math.max(0, state.remaining),
        resetAt: state.resetAt,
      };
    }

    return {
      allowed: false,
      limit: rule.requests,
      remaining: 0,
      resetAt: state.resetAt,
      retryAfter: Math.ceil((state.resetAt - now) / 1000),
    };
  }

  /**
   * Calculate reset time for window
   */
  private calculateResetTime(now: number, window: number): number {
    return now + window;
  }

  /**
   * Build cache key for identifier
   */
  private buildCacheKey(identifier: string): string {
    return `ratelimit:${identifier}`;
  }

  /**
   * Create storage backend
   */
  private createStorage(config: RateLimitStorage): RateLimitStorageBackend {
    switch (config.type) {
      case 'memory':
        return new MemoryStorage(config.options);
      case 'redis':
        return new RedisStorage(config.options);
      case 'durable-object':
        return new DurableObjectStorage(config.options);
      default:
        return new MemoryStorage(config.options);
    }
  }

  /**
   * Reset rate limit for identifier
   */
  async reset(identifier: string): Promise<void> {
    const cacheKey = this.buildCacheKey(identifier);
    this.localCache.delete(cacheKey);
    await this.storage.delete(identifier);
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    totalRequests: number;
    blockedRequests: number;
    cacheSize: number;
  }> {
    return {
      totalRequests: 0, // Would need to track
      blockedRequests: 0, // Would need to track
      cacheSize: this.localCache.size,
    };
  }

  /**
   * Clear local cache
   */
  clearCache(): void {
    this.localCache.clear();
  }
}

// ============================================================================
// Storage Backends
// ============================================================================

interface RateLimitStorageBackend {
  get(identifier: string): Promise<RateLimitState | null>;
  set(identifier: string, state: RateLimitState): Promise<void>;
  delete(identifier: string): Promise<void>;
}

class MemoryStorage implements RateLimitStorageBackend {
  private data: Map<string, RateLimitState>;

  constructor(options?: Record<string, any>) {
    this.data = new Map();
  }

  async get(identifier: string): Promise<RateLimitState | null> {
    return this.data.get(identifier) || null;
  }

  async set(identifier: string, state: RateLimitState): Promise<void> {
    this.data.set(identifier, state);
  }

  async delete(identifier: string): Promise<void> {
    this.data.delete(identifier);
  }
}

class RedisStorage implements RateLimitStorageBackend {
  private client: any; // Redis client
  private prefix: string;

  constructor(options?: Record<string, any>) {
    this.prefix = options?.prefix || 'ratelimit';
    // Initialize Redis client here
  }

  async get(identifier: string): Promise<RateLimitState | null> {
    // Implement Redis get
    return null;
  }

  async set(identifier: string, state: RateLimitState): Promise<void> {
    // Implement Redis set with TTL
  }

  async delete(identifier: string): Promise<void> {
    // Implement Redis delete
  }
}

class DurableObjectStorage implements RateLimitStorageBackend {
  private storage: DurableObjectStorage;
  private prefix: string;

  constructor(options?: Record<string, any>) {
    this.storage = options?.storage;
    this.prefix = options?.prefix || 'ratelimit';
  }

  async get(identifier: string): Promise<RateLimitState | null> {
    const key = `${this.prefix}:${identifier}`;
    const data = await this.storage.get(key);
    return data as RateLimitState || null;
  }

  async set(identifier: string, state: RateLimitState): Promise<void> {
    const key = `${this.prefix}:${identifier}`;
    await this.storage.put(key, state);
  }

  async delete(identifier: string): Promise<void> {
    const key = `${this.prefix}:${identifier}`;
    await this.storage.delete(key);
  }
}

// ============================================================================
// Middleware
// ============================================================================

/**
 * Create rate limiting middleware
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  const limiter = new RateLimiter(config);

  return async (request: Request): Promise<Response> => {
    // Extract identifier from request
    const identifier = await extractIdentifier(request);

    // Get endpoint path
    const url = new URL(request.url);
    const endpoint = url.pathname;

    // Check rate limit
    const result = await limiter.checkLimit(identifier, endpoint);

    // Add rate limit headers
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', result.limit.toString());
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
    headers.set('X-RateLimit-Reset', result.resetAt.toString());

    if (!result.allowed) {
      headers.set('Retry-After', (result.retryAfter || 0).toString());
      throw new RateLimitError(
        'Rate limit exceeded',
        result.retryAfter || 0
      );
    }

    return new Response(null, { headers });
  };
}

/**
 * Extract identifier from request
 */
async function extractIdentifier(request: Request): Promise<string> {
  // Try API key first
  const apiKey = request.headers.get('X-API-Key');
  if (apiKey) {
    return `apikey:${apiKey}`;
  }

  // Try auth token
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    return `token:${token}`;
  }

  // Fall back to IP address
  const cfConnectingIp = request.headers.get('CF-Connecting-IP');
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  const ip = cfConnectingIp || xForwardedFor || 'unknown';

  return `ip:${ip}`;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Validate rate limit configuration
 */
export function validateRateLimitConfig(config: RateLimitConfig): void {
  if (config.default.requests < 1) {
    throw new GatewayError(
      'Rate limit requests must be at least 1',
      'INVALID_CONFIG',
      400
    );
  }

  if (config.default.window < 1000) {
    throw new GatewayError(
      'Rate limit window must be at least 1000ms',
      'INVALID_CONFIG',
      400
    );
  }

  const validAlgorithms = ['token-bucket', 'leaky-bucket', 'fixed-window', 'sliding-window'];
  if (!validAlgorithms.includes(config.algorithm)) {
    throw new GatewayError(
      `Invalid rate limit algorithm: ${config.algorithm}`,
      'INVALID_CONFIG',
      400
    );
  }

  const validStorageTypes = ['memory', 'redis', 'durable-object'];
  if (!validStorageTypes.includes(config.storage.type)) {
    throw new GatewayError(
      `Invalid storage type: ${config.storage.type}`,
      'INVALID_CONFIG',
      400
    );
  }
}

/**
 * Create default rate limit config
 */
export function createDefaultRateLimitConfig(): RateLimitConfig {
  return {
    enabled: true,
    default: {
      requests: 100,
      window: 60000, // 1 minute
      burst: 150,
    },
    endpoints: new Map(),
    storage: {
      type: 'memory',
    },
    algorithm: 'token-bucket',
  };
}
