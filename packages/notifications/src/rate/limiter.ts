/**
 * Rate limiting for notifications
 */

import type {
  RateLimit,
  RateLimitState,
  RateLimitStrategy,
  NotificationChannelType,
  NotificationPriority,
} from '../types';

export interface RateLimiterConfig {
  enablePriority?: boolean;
  enableBursting?: boolean;
  defaultStrategy?: RateLimitStrategy;
  defaultLimits?: Partial<RateLimit>;
  cleanupIntervalMs?: number;
  stateRetentionMs?: number;
}

export interface RateLimitCheck {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: Date;
}

/**
 * Rate limiter implementation
 */
export class RateLimiter {
  private limits: Map<string, RateLimit> = new Map();
  private states: Map<string, RateLimitState> = new Map();
  private config: RateLimiterConfig;
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(config: RateLimiterConfig = {}) {
    this.config = {
      enablePriority: true,
      enableBursting: true,
      defaultStrategy: 'sliding_window',
      cleanupIntervalMs: 60000, // 1 minute
      stateRetentionMs: 3600000, // 1 hour
      ...config,
    };

    // Start cleanup timer
    this.startCleanupTimer();
  }

  /**
   * Add a rate limit
   */
  addLimit(limit: RateLimit): void {
    this.limits.set(this.getLimitKey(limit.identifier, limit.channel), limit);
  }

  /**
   * Remove a rate limit
   */
  removeLimit(identifier: string, channel: NotificationChannelType): boolean {
    return this.limits.delete(this.getLimitKey(identifier, channel));
  }

  /**
   * Get a rate limit
   */
  getLimit(identifier: string, channel: NotificationChannelType): RateLimit | undefined {
    return this.limits.get(this.getLimitKey(identifier, channel));
  }

  /**
   * Get all limits
   */
  getAllLimits(): RateLimit[] {
    return Array.from(this.limits.values());
  }

  /**
   * Check if a request is allowed
   */
  async check(
    identifier: string,
    channel: NotificationChannelType,
    priority?: NotificationPriority
  ): Promise<RateLimitCheck> {
    const limit = this.getLimit(identifier, channel);

    if (!limit) {
      // No limit configured, allow all requests
      return {
        allowed: true,
        remaining: Number.MAX_SAFE_INTEGER,
        resetAt: new Date(Date.now() + (this.config.defaultLimits?.windowMs || 60000)),
      };
    }

    // Get or create state
    let state = this.states.get(this.getLimitKey(identifier, channel));

    if (!state || state.resetAt < new Date()) {
      state = this.createState(limit);
      this.states.set(this.getLimitKey(identifier, channel), state);
    }

    // Update last request time
    state.lastRequestAt = new Date();

    // Check rate limit based on strategy
    const result = this.checkLimit(limit, state, priority);

    // Update state count if allowed
    if (result.allowed) {
      state.count++;
    }

    return result;
  }

  /**
   * Check limit based on strategy
   */
  private checkLimit(
    limit: RateLimit,
    state: RateLimitState,
    priority?: NotificationPriority
  ): RateLimitCheck {
    switch (limit.strategy) {
      case 'fixed_window':
        return this.checkFixedWindow(limit, state, priority);

      case 'sliding_window':
        return this.checkSlidingWindow(limit, state, priority);

      case 'token_bucket':
        return this.checkTokenBucket(limit, state, priority);

      case 'leaky_bucket':
        return this.checkLeakyBucket(limit, state, priority);

      default:
        return this.checkFixedWindow(limit, state, priority);
    }
  }

  /**
   * Fixed window rate limiting
   */
  private checkFixedWindow(
    limit: RateLimit,
    state: RateLimitState,
    priority?: NotificationPriority
  ): RateLimitCheck {
    const adjustedLimit = this.adjustLimitForPriority(limit.limit, priority);
    const remaining = Math.max(0, adjustedLimit - state.count);

    return {
      allowed: remaining > 0,
      remaining,
      resetAt: state.resetAt,
      retryAfter: remaining <= 0 ? state.resetAt : undefined,
    };
  }

  /**
   * Sliding window rate limiting
   */
  private checkSlidingWindow(
    limit: RateLimit,
    state: RateLimitState,
    priority?: NotificationPriority
  ): RateLimitCheck {
    const adjustedLimit = this.adjustLimitForPriority(limit.limit, priority);

    // For sliding window, we count requests in the current window
    // This is a simplified implementation
    const windowStart = new Date(Date.now() - limit.windowMs);
    const currentCount = state.count; // In real implementation, would filter by time

    const remaining = Math.max(0, adjustedLimit - currentCount);

    return {
      allowed: remaining > 0,
      remaining,
      resetAt: new Date(state.lastRequestAt.getTime() + limit.windowMs),
      retryAfter: remaining <= 0 ? new Date(state.lastRequestAt.getTime() + limit.windowMs) : undefined,
    };
  }

  /**
   * Token bucket rate limiting
   */
  private checkTokenBucket(
    limit: RateLimit,
    state: RateLimitState,
    priority?: NotificationPriority
  ): RateLimitCheck {
    const adjustedLimit = this.adjustLimitForPriority(limit.limit, priority);

    // Calculate refill rate
    const refillRate = adjustedLimit / (limit.windowMs / 1000); // tokens per second
    const now = Date.now();
    const elapsed = (now - state.lastRequestAt.getTime()) / 1000;

    // Refill tokens
    const refilledTokens = Math.floor(elapsed * refillRate);
    state.count = Math.max(0, state.count - refilledTokens);

    const remaining = Math.max(0, adjustedLimit - state.count);

    return {
      allowed: remaining > 0,
      remaining,
      resetAt: new Date(now + (adjustedLimit - state.count) / refillRate * 1000),
      retryAfter: remaining <= 0 ? new Date(now + 1000) : undefined,
    };
  }

  /**
   * Leaky bucket rate limiting
   */
  private checkLeakyBucket(
    limit: RateLimit,
    state: RateLimitState,
    priority?: NotificationPriority
  ): RateLimitCheck {
    const adjustedLimit = this.adjustLimitForPriority(limit.limit, priority);

    // Leaky bucket processes at a constant rate
    const leakRate = adjustedLimit / (limit.windowMs / 1000); // requests per second
    const now = Date.now();
    const elapsed = (now - state.lastRequestAt.getTime()) / 1000;

    // Leak from bucket
    const leaked = Math.floor(elapsed * leakRate);
    state.count = Math.max(0, state.count - leaked);

    const remaining = Math.max(0, adjustedLimit - state.count);

    return {
      allowed: remaining > 0,
      remaining,
      resetAt: new Date(now + state.count / leakRate * 1000),
      retryAfter: remaining <= 0 ? new Date(now + 1000) : undefined,
    };
  }

  /**
   * Adjust limit based on priority
   */
  private adjustLimitForPriority(limit: number, priority?: NotificationPriority): number {
    if (!this.config.enablePriority || !priority) {
      return limit;
    }

    const priorityMultipliers: Record<NotificationPriority, number> = {
      critical: 10,
      urgent: 5,
      high: 2,
      normal: 1,
      low: 0.5,
    };

    return Math.floor(limit * (priorityMultipliers[priority] || 1));
  }

  /**
   * Create initial rate limit state
   */
  private createState(limit: RateLimit): RateLimitState {
    return {
      identifier: limit.identifier,
      channel: limit.channel,
      count: 0,
      resetAt: new Date(Date.now() + limit.windowMs),
      burstCount: 0,
      lastRequestAt: new Date(),
    };
  }

  /**
   * Get limit key
   */
  private getLimitKey(identifier: string, channel: NotificationChannelType): string {
    return `${identifier}:${channel}`;
  }

  /**
   * Reserve capacity (for burst handling)
   */
  async reserve(
    identifier: string,
    channel: NotificationChannelType,
    amount: number
  ): Promise<RateLimitCheck> {
    const state = this.states.get(this.getLimitKey(identifier, channel));

    if (!state) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(),
      };
    }

    const limit = this.getLimit(identifier, channel);
    if (!limit) {
      return {
        allowed: true,
        remaining: Number.MAX_SAFE_INTEGER,
        resetAt: new Date(),
      };
    }

    const adjustedLimit = this.adjustLimitForPriority(limit.limit, limit.priority);
    const remaining = Math.max(0, adjustedLimit - state.count - amount);

    return {
      allowed: remaining >= 0,
      remaining,
      resetAt: state.resetAt,
    };
  }

  /**
   * Reset a rate limit state
   */
  reset(identifier: string, channel: NotificationChannelType): void {
    const limit = this.getLimit(identifier, channel);

    if (limit) {
      const state = this.createState(limit);
      this.states.set(this.getLimitKey(identifier, channel), state);
    }
  }

  /**
   * Get statistics for an identifier
   */
  getStats(identifier: string, channel: NotificationChannelType): {
    limit?: RateLimit;
    state?: RateLimitState;
    utilization?: number;
  } {
    const limit = this.getLimit(identifier, channel);
    const state = this.states.get(this.getLimitKey(identifier, channel));

    let utilization: number | undefined;

    if (limit && state) {
      const adjustedLimit = this.adjustLimitForPriority(limit.limit, limit.priority);
      utilization = adjustedLimit > 0 ? state.count / adjustedLimit : 0;
    }

    return {
      limit,
      state,
      utilization,
    };
  }

  /**
   * Get all rate limit states
   */
  getAllStates(): RateLimitState[] {
    return Array.from(this.states.values());
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * Clean up expired states
   */
  private cleanup(): void {
    const now = new Date();

    for (const [key, state] of this.states.entries()) {
      if (state.resetAt < now) {
        this.states.delete(key);
      }
    }
  }

  /**
   * Clear all limits and states
   */
  clear(): void {
    this.limits.clear();
    this.states.clear();
  }

  /**
   * Clear only states
   */
  clearStates(): void {
    this.states.clear();
  }

  /**
   * Get overall statistics
   */
  getOverallStats(): {
    totalLimits: number;
    activeStates: number;
    channels: NotificationChannelType[];
    strategies: RateLimitStrategy[];
  } {
    const channels = new Set<NotificationChannelType>();
    const strategies = new Set<RateLimitStrategy>();

    for (const limit of this.limits.values()) {
      channels.add(limit.channel);
      strategies.add(limit.strategy);
    }

    return {
      totalLimits: this.limits.size,
      activeStates: this.states.size,
      channels: Array.from(channels),
      strategies: Array.from(strategies),
    };
  }

  /**
   * Update a rate limit
   */
  updateLimit(limit: RateLimit): boolean {
    const key = this.getLimitKey(limit.identifier, limit.channel);

    if (!this.limits.has(key)) {
      return false;
    }

    this.limits.set(key, limit);
    return true;
  }

  /**
   * Check multiple channels at once
   */
  async checkMultiple(
    identifier: string,
    channels: NotificationChannelType[],
    priority?: NotificationPriority
  ): Promise<Map<NotificationChannelType, RateLimitCheck>> {
    const results = new Map<NotificationChannelType, RateLimitCheck>();

    for (const channel of channels) {
      const check = await this.check(identifier, channel, priority);
      results.set(channel, check);
    }

    return results;
  }

  /**
   * Get limits for a channel
   */
  getLimitsForChannel(channel: NotificationChannelType): RateLimit[] {
    const limits: RateLimit[] = [];

    for (const limit of this.limits.values()) {
      if (limit.channel === channel) {
        limits.push(limit);
      }
    }

    return limits;
  }

  /**
   * Get limits for an identifier
   */
  getLimitsForIdentifier(identifier: string): RateLimit[] {
    const limits: RateLimit[] = [];

    for (const limit of this.limits.values()) {
      if (limit.identifier === identifier) {
        limits.push(limit);
      }
    }

    return limits;
  }
}
