/**
 * Advanced Rate Limiter
 *
 * Implements multiple rate limiting algorithms:
 * - Token Bucket: Burst-friendly with token accumulation
 * - Sliding Window: Accurate rate limiting with time-based windows
 * - Fixed Window: Simple counter-based rate limiting
 * - Leaky Bucket: Smooth request processing with constant rate
 *
 * Features:
 * - Hierarchical rate limits (user, org, global)
 * - Distributed rate limiting with Durable Objects
 * - Burst handling with configurable capacity
 * - Graceful degradation on failures
 * - Real-time metrics and monitoring
 *
 * Performance targets:
 * - <1ms rate limit check latency
 * - Support for hierarchical limits
 * - 99.99% availability
 */

import type {
  GatewayRequest,
  GatewayContext,
  RateLimitAlgorithm,
  RateLimitScope,
  RateLimitConfig,
} from '../types';

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
  scope: string;
  identifier: string;
  retryAfter?: number;
  metadata: Record<string, unknown>;
}

/**
 * Rate limit statistics
 */
export interface RateLimitStats {
  totalChecks: number;
  allowedRequests: number;
  blockedRequests: number;
  avgCheckTimeNs: number;
  currentUsage: Record<string, number>;
  limitViolations: Record<string, number>;
  lastResetTime: number;
}

/**
 * Durable Object state for token bucket
 */
interface TokenBucketState {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number;
}

/**
 * Sliding window state
 */
interface SlidingWindowState {
  requests: number[];
  windowStart: number;
  windowSize: number;
  limit: number;
}

/**
 * Fixed window state
 */
interface FixedWindowState {
  count: number;
  windowStart: number;
  windowSize: number;
  limit: number;
}

/**
 * Leaky bucket state
 */
interface LeakyBucketState {
  volume: number;
  lastLeak: number;
  capacity: number;
  leakRate: number;
}

/**
 * Rate limiter options
 */
export interface RateLimiterOptions {
  algorithm: RateLimitAlgorithm;
  storage?: 'memory' | 'kv' | 'do';
  kv?: KVNamespace;
  do?: DurableObjectNamespace;
  defaultLimits?: RateLimitDefinition[];
  burstCapacity?: number;
  enableBurst?: boolean;
  enableHierarchical?: boolean;
  enableMetrics?: boolean;
  degradeOnFailure?: boolean;
}

/**
 * Internal options with required fields
 */
interface InternalRateLimiterOptions {
  algorithm: RateLimitAlgorithm;
  storage: 'memory' | 'kv' | 'do';
  kv: KVNamespace | undefined;
  do: DurableObjectNamespace | undefined;
  defaultLimits: RateLimitDefinition[];
  burstCapacity: number;
  enableBurst: boolean;
  enableHierarchical: boolean;
  enableMetrics: boolean;
  degradeOnFailure: boolean;
}

/**
 * Rate limit definition
 */
export interface RateLimitDefinition {
  id: string;
  name: string;
  scope: RateLimitScope;
  limit: number;
  window: number; // in milliseconds
  burst?: number;
  key?: string;
}

/**
 * Advanced Rate Limiter
 */
export class RateLimiter {
  private options: InternalRateLimiterOptions;
  private limits: Map<string, RateLimitDefinition>;
  private stats: RateLimitStats;
  private localCache: Map<string, unknown>;
  private metricsEnabled: boolean;

  // Algorithm instances
  private tokenBucket: TokenBucketAlgorithm;
  private slidingWindow: SlidingWindowAlgorithm;
  private fixedWindow: FixedWindowAlgorithm;
  private leakyBucket: LeakyBucketAlgorithm;

  constructor(options: RateLimiterOptions) {
    this.options = {
      algorithm: options.algorithm,
      storage: options.storage || 'memory',
      kv: options.kv,
      do: options.do,
      defaultLimits: options.defaultLimits || [],
      burstCapacity: options.burstCapacity || 10,
      enableBurst: options.enableBurst ?? true,
      enableHierarchical: options.enableHierarchical ?? true,
      enableMetrics: options.enableMetrics ?? true,
      degradeOnFailure: options.degradeOnFailure ?? true,
    };

    this.limits = new Map();
    this.localCache = new Map();
    this.metricsEnabled = this.options.enableMetrics;

    this.stats = {
      totalChecks: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      avgCheckTimeNs: 0,
      currentUsage: {},
      limitViolations: {},
      lastResetTime: Date.now(),
    };

    // Initialize algorithms
    this.tokenBucket = new TokenBucketAlgorithm(this.options);
    this.slidingWindow = new SlidingWindowAlgorithm(this.options);
    this.fixedWindow = new FixedWindowAlgorithm(this.options);
    this.leakyBucket = new LeakyBucketAlgorithm(this.options);

    // Register default limits
    for (const limit of this.options.defaultLimits) {
      this.addLimit(limit);
    }
  }

  /**
   * Check if request is allowed under rate limits
   */
  async check(
    request: GatewayRequest,
    context: GatewayContext,
    config?: RateLimitConfig
  ): Promise<RateLimitResult> {
    const startTime = performance.now();
    this.stats.totalChecks++;

    const limits = this.getLimitsForRequest(request, config);
    const results: RateLimitResult[] = [];

    for (const limit of limits) {
      try {
        const result = await this.checkLimit(request, context, limit);
        results.push(result);

        if (!result.allowed && this.options.enableHierarchical) {
          // If hierarchical enabled, block if any limit fails
          this.updateStats(result, startTime);
          return result;
        }
      } catch (error) {
        console.error('Rate limit check error:', error);

        if (this.options.degradeOnFailure) {
          // Degrade gracefully - allow request
          continue;
        } else {
          throw error;
        }
      }
    }

    // Return most restrictive result
    const finalResult = this.getMostRestrictiveResult(results);
    this.updateStats(finalResult, startTime);

    return finalResult;
  }

  /**
   * Add a rate limit definition
   */
  addLimit(limit: RateLimitDefinition): void {
    this.limits.set(limit.id, limit);
  }

  /**
   * Remove a rate limit definition
   */
  removeLimit(limitId: string): boolean {
    return this.limits.delete(limitId);
  }

  /**
   * Get rate limit statistics
   */
  getStats(): RateLimitStats {
    return { ...this.stats };
  }

  /**
   * Reset rate limit statistics
   */
  resetStats(): void {
    this.stats = {
      totalChecks: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      avgCheckTimeNs: 0,
      currentUsage: {},
      limitViolations: {},
      lastResetTime: Date.now(),
    };
  }

  /**
   * Reset rate limit for a specific identifier
   */
  async reset(identifier: string, scope: RateLimitScope): Promise<void> {
    const key = this.getStorageKey(identifier, scope);

    if (this.options.storage === 'kv' && this.options.kv) {
      await this.options.kv.delete(key);
    } else if (this.options.storage === 'do' && this.options.do) {
      // Reset DO state
      // @ts-ignore - DurableObjectId type issue
      const stub = this.options.do.get(this.getDOId(key));
      // @ts-ignore - reset method not in type stub
      await stub.reset();
    } else {
      this.localCache.delete(key);
    }
  }

  /**
   * Get current usage for an identifier
   */
  async getCurrentUsage(identifier: string, scope: RateLimitScope): Promise<number> {
    const limit = this.getLimitByScope(scope);
    if (!limit) return 0;

    const key = this.getStorageKey(identifier, scope);

    switch (this.options.algorithm) {
      case 'token_bucket':
        return await this.tokenBucket.getUsage(key, limit);

      case 'sliding_window':
        return await this.slidingWindow.getUsage(key, limit);

      case 'fixed_window':
        return await this.fixedWindow.getUsage(key, limit);

      case 'leaky_bucket':
        return await this.leakyBucket.getUsage(key, limit);

      default:
        return 0;
    }
  }

  /**
   * Check a single rate limit (private helper)
   */
  private async checkLimit(
    request: GatewayRequest,
    _context: GatewayContext,
    limit: RateLimitDefinition
  ): Promise<RateLimitResult> {
    const identifier = this.getIdentifier(request, limit);
    const key = this.getStorageKey(identifier, limit.scope);

    const burstLimit = this.options.enableBurst
      ? limit.burst || this.options.burstCapacity
      : limit.limit;

    switch (this.options.algorithm) {
      case 'token_bucket':
        return await this.tokenBucket.check(key, limit, burstLimit);

      case 'sliding_window':
        return await this.slidingWindow.check(key, limit, burstLimit);

      case 'fixed_window':
        return await this.fixedWindow.check(key, limit, burstLimit);

      case 'leaky_bucket':
        return await this.leakyBucket.check(key, limit, burstLimit);

      default:
        throw new Error(`Unknown algorithm: ${this.options.algorithm}`);
    }
  }

  /**
   * Get limits for a request (private helper)
   */
  private getLimitsForRequest(
    _request: GatewayRequest,
    config?: RateLimitConfig
  ): RateLimitDefinition[] {
    if (config && config.limits.length > 0) {
      return config.limits;
    }

    // Return applicable default limits
    return Array.from(this.limits.values()).filter(_limit => {
      // Check if limit applies to request
      return true;
    });
  }

  /**
   * Get identifier for request (private helper)
   */
  private getIdentifier(
    request: GatewayRequest,
    limit: RateLimitDefinition
  ): string {
    if (limit.key) {
      // Use custom key template
      return this.interpolateKey(limit.key, request);
    }

    switch (limit.scope) {
      case 'per_user':
        return request.metadata.userId || request.ip;

      case 'per_org':
        return request.metadata.orgId || 'default';

      case 'per_ip':
        return request.ip;

      case 'per_api_key':
        return request.metadata.apiKey || 'anonymous';

      case 'global':
        return 'global';

      default:
        return request.ip;
    }
  }

  /**
   * Interpolate key template (private helper)
   */
  private interpolateKey(template: string, request: GatewayRequest): string {
    return template
      .replace('{{user_id}}', request.metadata.userId || '')
      .replace('{{org_id}}', request.metadata.orgId || '')
      .replace('{{ip}}', request.ip)
      .replace('{{api_key}}', request.metadata.apiKey || '');
  }

  /**
   * Get storage key (private helper)
   */
  private getStorageKey(identifier: string, scope: RateLimitScope): string {
    return `ratelimit:${scope}:${identifier}`;
  }

  /**
   * Get DO ID (private helper)
   */
  private getDOId(key: string): string {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `ratelimit-${Math.abs(hash)}`;
  }

  /**
   * Get limit by scope (private helper)
   */
  private getLimitByScope(scope: RateLimitScope): RateLimitDefinition | undefined {
    return Array.from(this.limits.values()).find(l => l.scope === scope);
  }

  /**
   * Get most restrictive result (private helper)
   */
  private getMostRestrictiveResult(results: RateLimitResult[]): RateLimitResult {
    if (results.length === 0) {
      return {
        allowed: true,
        remaining: Number.MAX_SAFE_INTEGER,
        resetAt: Date.now() + 60000,
        limit: Number.MAX_SAFE_INTEGER,
        scope: 'none',
        identifier: 'none',
        metadata: {},
      };
    }

    // Sort by remaining (ascending)
    results.sort((a, b) => a.remaining - b.remaining);

    return results[0];
  }

  /**
   * Update statistics (private helper)
   */
  private updateStats(result: RateLimitResult, startTime: number): void {
    if (!this.metricsEnabled) return;

    if (result.allowed) {
      this.stats.allowedRequests++;
    } else {
      this.stats.blockedRequests++;
      this.stats.limitViolations[result.scope] =
        (this.stats.limitViolations[result.scope] || 0) + 1;
    }

    this.stats.currentUsage[result.scope] = result.limit - result.remaining;

    const checkTime = performance.now() - startTime;
    this.stats.avgCheckTimeNs =
      (this.stats.avgCheckTimeNs * (this.stats.totalChecks - 1) + checkTime) /
      this.stats.totalChecks;
  }
}

/**
 * Token Bucket Algorithm
 */
class TokenBucketAlgorithm {
  constructor(private options: InternalRateLimiterOptions) {}

  async check(
    key: string,
    limit: RateLimitDefinition,
    burst: number
  ): Promise<RateLimitResult> {
    const capacity = burst;
    const refillRate = limit.limit / (limit.window / 1000); // tokens per second

    let state: TokenBucketState;

    if (this.options.storage === 'do' && this.options.do) {
      state = await this.getStateFromDO(key, capacity, refillRate);
    } else {
      state = await this.getStateFromLocal(key, capacity, refillRate);
    }

    // Refill tokens
    const now = Date.now();
    const elapsed = (now - state.lastRefill) / 1000;
    const tokensToAdd = elapsed * refillRate;
    state.tokens = Math.min(capacity, state.tokens + tokensToAdd);
    state.lastRefill = now;

    const allowed = state.tokens >= 1;
    if (allowed) {
      state.tokens -= 1;
    }

    // Save state
    if (this.options.storage === 'do' && this.options.do) {
      await this.saveStateToDO(key, state);
    } else {
      this.saveStateToLocal(key, state);
    }

    return {
      allowed,
      remaining: Math.floor(state.tokens),
      resetAt: now + limit.window,
      limit: limit.limit,
      scope: limit.scope,
      identifier: key,
      retryAfter: allowed ? undefined : Math.ceil((1 - state.tokens) / refillRate * 1000),
      metadata: { algorithm: 'token_bucket' },
    };
  }

  async getUsage(key: string, limit: RateLimitDefinition): Promise<number> {
    const capacity = this.options.burstCapacity;
    const refillRate = limit.limit / (limit.window / 1000);
    const state = await this.getStateFromLocal(key, capacity, refillRate);
    return capacity - state.tokens;
  }

  private async getStateFromDO(
    key: string,
    _capacity: number,
    _refillRate: number
  ): Promise<TokenBucketState> {
    // @ts-ignore - DurableObjectId type issue
    const stub = this.options.do!.get(this.getDOId(key));
    // @ts-ignore - getState method not in type stub
    return await stub.getState();
  }

  private async getStateFromLocal(
    _key: string,
    capacity: number,
    refillRate: number
  ): Promise<TokenBucketState> {
    // Simple in-memory implementation
    return {
      tokens: capacity,
      lastRefill: Date.now(),
      capacity,
      refillRate,
    };
  }

  private async saveStateToDO(key: string, state: TokenBucketState): Promise<void> {
    // @ts-ignore - DurableObjectId type issue
    const stub = this.options.do!.get(this.getDOId(key));
    // @ts-ignore - setState method not in type stub
    await stub.setState(state);
  }

  private saveStateToLocal(_key: string, _state: TokenBucketState): void {
    // In a real implementation, use a proper cache
  }

  private getDOId(key: string): string {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `ratelimit-${Math.abs(hash)}`;
  }
}

/**
 * Sliding Window Algorithm
 */
class SlidingWindowAlgorithm {
  constructor(private options: InternalRateLimiterOptions) {}

  async check(
    key: string,
    limit: RateLimitDefinition,
    burst: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - limit.window;

    let state: SlidingWindowState;

    if (this.options.storage === 'kv' && this.options.kv) {
      state = await this.getStateFromKV(key);
    } else {
      state = {
        requests: [],
        windowStart,
        windowSize: limit.window,
        limit: burst,
      };
    }

    // Remove old requests
    state.requests = state.requests.filter(t => t > windowStart);

    const allowed = state.requests.length < burst;
    if (allowed) {
      state.requests.push(now);
    }

    // Save state
    if (this.options.storage === 'kv' && this.options.kv) {
      await this.saveStateToKV(key, state);
    }

    return {
      allowed,
      remaining: Math.max(0, burst - state.requests.length),
      resetAt: state.requests.length > 0 ? state.requests[0] + limit.window : now + limit.window,
      limit: limit.limit,
      scope: limit.scope,
      identifier: key,
      retryAfter: allowed ? undefined : limit.window,
      metadata: { algorithm: 'sliding_window' },
    };
  }

  async getUsage(key: string, limit: RateLimitDefinition): Promise<number> {
    const state = await this.getStateFromKV(key);
    const windowStart = Date.now() - limit.window;
    const validRequests = state.requests.filter(t => t > windowStart);
    return validRequests.length;
  }

  private async getStateFromKV(key: string): Promise<SlidingWindowState> {
    const data = await this.options.kv!.get(key, 'json');
    return data as SlidingWindowState || {
      requests: [],
      windowStart: Date.now(),
      windowSize: 60000,
      limit: 100,
    };
  }

  private async saveStateToKV(key: string, state: SlidingWindowState): Promise<void> {
    await this.options.kv!.put(key, JSON.stringify(state), {
      expirationTtl: Math.ceil(state.windowSize / 1000) + 1,
    });
  }
}

/**
 * Fixed Window Algorithm
 */
class FixedWindowAlgorithm {
  constructor(private options: InternalRateLimiterOptions) {}

  async check(
    key: string,
    limit: RateLimitDefinition,
    burst: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowSize = limit.window;
    const currentWindow = Math.floor(now / windowSize) * windowSize;

    let state: FixedWindowState;

    if (this.options.storage === 'kv' && this.options.kv) {
      state = await this.getStateFromKV(key);
    } else {
      state = {
        count: 0,
        windowStart: currentWindow,
        windowSize,
        limit: burst,
      };
    }

    // Check if we need to reset the window
    if (state.windowStart !== currentWindow) {
      state.count = 0;
      state.windowStart = currentWindow;
    }

    const allowed = state.count < burst;
    if (allowed) {
      state.count++;
    }

    // Save state
    if (this.options.storage === 'kv' && this.options.kv) {
      await this.saveStateToKV(key, state);
    }

    return {
      allowed,
      remaining: Math.max(0, burst - state.count),
      resetAt: state.windowStart + windowSize,
      limit: limit.limit,
      scope: limit.scope,
      identifier: key,
      retryAfter: allowed ? undefined : state.windowStart + windowSize - now,
      metadata: { algorithm: 'fixed_window' },
    };
  }

  async getUsage(key: string, _limit: RateLimitDefinition): Promise<number> {
    const state = await this.getStateFromKV(key);
    return state.count;
  }

  private async getStateFromKV(key: string): Promise<FixedWindowState> {
    const data = await this.options.kv!.get(key, 'json');
    return data as FixedWindowState || {
      count: 0,
      windowStart: Date.now(),
      windowSize: 60000,
      limit: 100,
    };
  }

  private async saveStateToKV(key: string, state: FixedWindowState): Promise<void> {
    await this.options.kv!.put(key, JSON.stringify(state), {
      expirationTtl: Math.ceil(state.windowSize / 1000) + 1,
    });
  }
}

/**
 * Leaky Bucket Algorithm
 */
class LeakyBucketAlgorithm {
  constructor(private options: InternalRateLimiterOptions) {}

  async check(
    key: string,
    limit: RateLimitDefinition,
    burst: number
  ): Promise<RateLimitResult> {
    const capacity = burst;
    const leakRate = limit.limit / (limit.window / 1000); // requests per second

    let state: LeakyBucketState;

    if (this.options.storage === 'kv' && this.options.kv) {
      state = await this.getStateFromKV(key);
    } else {
      state = {
        volume: 0,
        lastLeak: Date.now(),
        capacity,
        leakRate,
      };
    }

    // Leak volume
    const now = Date.now();
    const elapsed = (now - state.lastLeak) / 1000;
    const leakedVolume = elapsed * leakRate;
    state.volume = Math.max(0, state.volume - leakedVolume);
    state.lastLeak = now;

    const allowed = state.volume < capacity;
    if (allowed) {
      state.volume += 1;
    }

    // Save state
    if (this.options.storage === 'kv' && this.options.kv) {
      await this.saveStateToKV(key, state);
    }

    return {
      allowed,
      remaining: Math.floor(capacity - state.volume),
      resetAt: now + Math.ceil(state.volume / leakRate * 1000),
      limit: limit.limit,
      scope: limit.scope,
      identifier: key,
      retryAfter: allowed ? undefined : Math.ceil((state.volume - capacity) / leakRate * 1000),
      metadata: { algorithm: 'leaky_bucket' },
    };
  }

  async getUsage(key: string, _limit: RateLimitDefinition): Promise<number> {
    const state = await this.getStateFromKV(key);
    return Math.floor(state.volume);
  }

  private async getStateFromKV(key: string): Promise<LeakyBucketState> {
    const data = await this.options.kv!.get(key, 'json');
    return data as LeakyBucketState || {
      volume: 0,
      lastLeak: Date.now(),
      capacity: 10,
      leakRate: 1,
    };
  }

  private async saveStateToKV(key: string, state: LeakyBucketState): Promise<void> {
    await this.options.kv!.put(key, JSON.stringify(state), {
      expirationTtl: 3600,
    });
  }
}

/**
 * Create a rate limiter instance
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  return new RateLimiter(options);
}

/**
 * Create rate limit for requests per minute
 */
export function createRateLimitRPM(
  requestsPerMinute: number,
  scope: RateLimitScope = 'per_ip'
): RateLimitDefinition {
  return {
    id: `rpm-${scope}-${Date.now()}`,
    name: `${requestsPerMinute} requests per minute`,
    scope,
    limit: requestsPerMinute,
    window: 60000, // 1 minute
  };
}

/**
 * Create rate limit for requests per second
 */
export function createRateLimitRPS(
  requestsPerSecond: number,
  scope: RateLimitScope = 'per_ip'
): RateLimitDefinition {
  return {
    id: `rps-${scope}-${Date.now()}`,
    name: `${requestsPerSecond} requests per second`,
    scope,
    limit: requestsPerSecond,
    window: 1000, // 1 second
  };
}
