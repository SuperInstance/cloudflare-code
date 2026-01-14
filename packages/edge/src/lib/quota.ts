/**
 * Quota Tracker
 *
 * Tracks API usage quotas for multiple providers.
 * Supports daily/monthly reset schedules and real-time monitoring.
 *
 * Features:
 * - Track usage per provider
 * - Automatic reset scheduling
 * - KV-backed persistence
 * - Usage percentage calculation
 * - Predictive exhaustion warnings
 * - Multi-provider support
 */

import type { KVNamespace } from '@cloudflare/workers-types';

/**
 * Quota reset type
 */
export type ResetType = 'daily' | 'monthly' | 'never';

/**
 * Quota status for a provider
 */
export interface QuotaStatus {
  provider: string;
  used: number;
  limit: number;
  remaining: number;
  resetTime: number;
  resetType: ResetType;
  lastUpdated: number;
  dailyUsage?: number; // For predictive analytics
}

/**
 * Quota tracker options
 */
export interface QuotaTrackerOptions {
  /**
   * KV namespace for persistence
   */
  kv: KVNamespace;

  /**
   * Default TTL for stored data in seconds (default: 1 day)
   */
  ttl?: number;

  /**
   * Enable predictive analytics
   */
  enableAnalytics?: boolean;
}

/**
 * Quota usage statistics
 */
export interface QuotaStats {
  provider: string;
  usagePercent: number;
  remaining: number;
  limit: number;
  isExhausted: boolean;
  projectedExhaustion?: number; // Unix timestamp
}

/**
 * Quota Tracker
 *
 * @example
 * ```typescript
 * const tracker = new QuotaTracker({ kv: env.KV });
 *
 * // Initialize provider quota
 * await tracker.initialize('openai', 1000000, 'daily');
 *
 * // Record usage
 * await tracker.recordUsage('openai', 1000);
 *
 * // Check if has quota
 * if (await tracker.hasQuota('openai')) {
 *   // Make API call
 * }
 *
 * // Get usage percentage
 * const percent = await tracker.getQuotaPercent('openai');
 * ```
 */
export class QuotaTracker {
  private kv: KVNamespace;
  private options: Required<Omit<QuotaTrackerOptions, 'kv'>>;
  private cache: Map<string, QuotaStatus> = new Map();

  constructor(options: QuotaTrackerOptions) {
    this.kv = options.kv;
    this.options = {
      ttl: options.ttl ?? 86400, // 1 day
      enableAnalytics: options.enableAnalytics ?? true,
    };
  }

  /**
   * Initialize quota tracking for a provider
   *
   * @param provider - Provider name/identifier
   * @param limit - Quota limit (tokens, requests, etc.)
   * @param resetType - When to reset quota
   */
  async initialize(
    provider: string,
    limit: number,
    resetType: ResetType = 'daily'
  ): Promise<void> {
    const key = this.getStorageKey(provider);
    const cached = await this.loadFromKV<QuotaStatus>(key);

    if (cached) {
      // Check if quota needs reset
      const now = Date.now();
      if (now > cached.resetTime) {
        // Reset quota
        const resetTime = this.calculateNextReset(resetType);
        const status: QuotaStatus = {
          provider,
          used: 0,
          limit,
          remaining: limit,
          resetTime,
          resetType,
          lastUpdated: now,
          dailyUsage: 0,
        };
        this.cache.set(provider, status);
        await this.saveToKV(provider, status);
      } else {
        // Update limit if changed
        if (cached.limit !== limit) {
          cached.limit = limit;
          cached.remaining = Math.max(0, limit - cached.used);
        }
        this.cache.set(provider, cached);
      }
    } else {
      // Initialize new
      const resetTime = this.calculateNextReset(resetType);
      const status: QuotaStatus = {
        provider,
        used: 0,
        limit,
        remaining: limit,
        resetTime,
        resetType,
        lastUpdated: Date.now(),
        dailyUsage: 0,
      };
      this.cache.set(provider, status);
      await this.saveToKV(provider, status);
    }
  }

  /**
   * Record usage for a provider
   *
   * @param provider - Provider name
   * @param tokens - Number of tokens/requests used
   */
  async recordUsage(provider: string, tokens: number): Promise<void> {
    let status = this.cache.get(provider);

    if (!status) {
      // Try loading from KV
      const key = this.getStorageKey(provider);
      status = await this.loadFromKV<QuotaStatus>(key);

      if (!status) {
        throw new Error(`Provider ${provider} not initialized. Call initialize() first.`);
      }

      this.cache.set(provider, status);
    }

    // Check if quota needs reset
    const now = Date.now();
    if (now > status.resetTime) {
      const resetTime = this.calculateNextReset(status.resetType);
      status.used = 0;
      status.resetTime = resetTime;
      status.dailyUsage = 0;
    }

    // Update usage
    status.used += tokens;
    status.remaining = Math.max(0, status.limit - status.used);
    status.lastUpdated = now;

    // Track daily usage for analytics
    if (this.options.enableAnalytics) {
      status.dailyUsage = (status.dailyUsage || 0) + tokens;
    }

    // Save to storage
    await this.saveToKV(provider, status);
  }

  /**
   * Get current usage for a provider
   *
   * @param provider - Provider name
   * @returns Current usage count
   */
  async getUsage(provider: string): Promise<number> {
    const status = await this.getStatus(provider);
    return status.used;
  }

  /**
   * Get remaining quota for a provider
   *
   * @param provider - Provider name
   * @returns Remaining quota
   */
  async getRemaining(provider: string): Promise<number> {
    const status = await this.getStatus(provider);
    return status.remaining;
  }

  /**
   * Check if provider has available quota
   *
   * @param provider - Provider name
   * @param threshold - Minimum required (default: 1)
   * @returns true if has quota
   */
  async hasQuota(provider: string, threshold: number = 1): Promise<boolean> {
    const status = await this.getStatus(provider);
    return status.remaining >= threshold;
  }

  /**
   * Get quota usage percentage
   *
   * @param provider - Provider name
   * @returns Percentage used (0-100)
   */
  async getQuotaPercent(provider: string): Promise<number> {
    const status = await this.getStatus(provider);
    if (status.limit === 0) return 0;
    return (status.used / status.limit) * 100;
  }

  /**
   * Get detailed statistics for a provider
   *
   * @param provider - Provider name
   * @returns Quota statistics
   */
  async getStats(provider: string): Promise<QuotaStats> {
    const status = await this.getStatus(provider);
    const usagePercent = status.limit === 0 ? 0 : (status.used / status.limit) * 100;

    const stats: QuotaStats = {
      provider: status.provider,
      usagePercent,
      remaining: status.remaining,
      limit: status.limit,
      isExhausted: status.remaining === 0,
    };

    // Add predictive analytics
    if (this.options.enableAnalytics && status.dailyUsage) {
      stats.projectedExhaustion = this.calculateProjectedExhaustion(status);
    }

    return stats;
  }

  /**
   * Check if quota is exhausted (or near exhausted)
   *
   * @param provider - Provider name
   * @param threshold - Exhaustion threshold (0-1, default: 0.9)
   * @returns true if exhausted
   */
  async isExhausted(provider: string, threshold: number = 0.9): Promise<boolean> {
    const percent = await this.getQuotaPercent(provider);
    return percent >= (threshold * 100);
  }

  /**
   * Reset quota for a provider
   *
   * @param provider - Provider name
   */
  async reset(provider: string): Promise<void> {
    const status = this.cache.get(provider);
    if (!status) {
      throw new Error(`Provider ${provider} not initialized`);
    }

    const resetTime = this.calculateNextReset(status.resetType);
    status.used = 0;
    status.remaining = status.limit;
    status.resetTime = resetTime;
    status.lastUpdated = Date.now();
    status.dailyUsage = 0;

    await this.saveToKV(provider, status);
  }

  /**
   * Get status for all providers
   *
   * @returns Array of quota statuses
   */
  async getAllStatus(): Promise<QuotaStatus[]> {
    // List all quota keys
    const keys = await this.kv.list({ prefix: 'quota:' });

    const statuses: QuotaStatus[] = [];
    for (const key of keys.keys) {
      const status = await this.loadFromKV<QuotaStatus>(key.name);
      if (status) {
        statuses.push(status);
      }
    }

    return statuses;
  }

  /**
   * Get all providers sorted by remaining quota
   *
   * @returns Array of provider names (highest remaining first)
   */
  async getProvidersByRemaining(): Promise<string[]> {
    const statuses = await this.getAllStatus();

    return statuses
      .sort((a, b) => b.remaining - a.remaining)
      .map(s => s.provider);
  }

  /**
   * Calculate next reset time based on reset type
   */
  private calculateNextReset(resetType: ResetType): number {
    const now = new Date();

    if (resetType === 'daily') {
      // Reset at midnight UTC
      const tomorrow = new Date(now);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);
      return tomorrow.getTime();
    } else if (resetType === 'monthly') {
      // Reset at first of next month
      const nextMonth = new Date(now);
      nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
      nextMonth.setUTCDate(1);
      nextMonth.setUTCHours(0, 0, 0, 0);
      return nextMonth.getTime();
    } else {
      // Never reset
      return Number.MAX_SAFE_INTEGER;
    }
  }

  /**
   * Calculate projected exhaustion timestamp
   */
  private calculateProjectedExhaustion(status: QuotaStatus): number {
    if (!status.dailyUsage || status.dailyUsage === 0) {
      return Number.MAX_SAFE_INTEGER;
    }

    // Calculate average daily usage
    const avgDailyUsage = status.dailyUsage;

    // Calculate days until exhaustion
    const daysUntilExhaustion = status.remaining / avgDailyUsage;

    if (daysUntilExhaustion === Infinity) {
      return Number.MAX_SAFE_INTEGER;
    }

    // Return timestamp
    return Date.now() + daysUntilExhaustion * 24 * 60 * 60 * 1000;
  }

  /**
   * Get status for a provider (from cache or KV)
   */
  private async getStatus(provider: string): Promise<QuotaStatus> {
    let status = this.cache.get(provider);

    if (!status) {
      const key = this.getStorageKey(provider);
      status = await this.loadFromKV<QuotaStatus>(key);

      if (!status) {
        throw new Error(`Provider ${provider} not initialized. Call initialize() first.`);
      }

      this.cache.set(provider, status);
    }

    // Check if quota needs reset
    const now = Date.now();
    if (now > status.resetTime) {
      const resetTime = this.calculateNextReset(status.resetType);
      status.used = 0;
      status.resetTime = resetTime;
      status.remaining = status.limit;
      status.dailyUsage = 0;
      status.lastUpdated = now;
      await this.saveToKV(provider, status);
    }

    return status;
  }

  /**
   * Save status to KV
   */
  private async saveToKV(provider: string, status: QuotaStatus): Promise<void> {
    const key = this.getStorageKey(provider);
    await this.kv.put(key, JSON.stringify(status), {
      expirationTtl: this.options.ttl,
    });
  }

  /**
   * Load status from KV
   */
  private async loadFromKV<T>(key: string): Promise<T | null> {
    try {
      const data = await this.kv.get(key, 'json');
      return (data as T) || null;
    } catch (error) {
      console.error('QuotaTracker KV load error:', error);
      return null;
    }
  }

  /**
   * Generate storage key
   */
  private getStorageKey(provider: string): string {
    const today = new Date().toISOString().split('T')[0];
    return `quota:${provider}:${today}`;
  }
}

/**
 * Create a quota tracker with default settings
 *
 * @param kv - KV namespace
 * @returns QuotaTracker instance
 */
export function createQuotaTracker(kv: KVNamespace): QuotaTracker {
  return new QuotaTracker({ kv });
}
