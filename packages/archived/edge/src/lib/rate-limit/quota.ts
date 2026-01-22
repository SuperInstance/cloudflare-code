/**
 * Advanced Quota Management
 *
 * Tracks API usage quotas across multiple dimensions:
 * - Request quotas (requests per time period)
 * - Token quotas (tokens consumed)
 * - Cost quotas (monetary limits)
 * - Concurrent request quotas
 *
 * Supports tiered quotas with automatic upgrades/downgrades.
 */

import type { KVNamespace } from '@cloudflare/workers-types';
import type {
  SubscriptionTier,
  QuotaStatus,
  TierConfig,
} from './types';

/**
 * Quota type
 */
export type QuotaType = 'requests' | 'tokens' | 'cost' | 'concurrent';

/**
 * Quota period
 */
export type QuotaPeriod = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'forever';

/**
 * Quota configuration
 */
export interface QuotaConfig {
  /**
   * Quota type
   */
  type: QuotaType;

  /**
   * Quota limit
   */
  limit: number;

  /**
   * Quota period
   */
  period: QuotaPeriod;

  /**
   * Soft limit percentage (0-1)
   */
  softLimit?: number;

  /**
   * Enable overage (allow exceeding limit with cost)
   */
  allowOverage?: boolean;

  /**
   * Overage cost per unit
   */
  overageCost?: number;
}

/**
 * Quota usage record
 */
interface QuotaUsage {
  /**
   * Current usage
   */
  used: number;

  /**
   * Period start timestamp
   */
  periodStart: number;

  /**
   * Period end timestamp
   */
  periodEnd: number;

  /**
   * Last updated timestamp
   */
  lastUpdated: number;
}

/**
 * Quota state for an identifier
 */
interface QuotaState {
  /**
   * Identifier
   */
  identifier: string;

  /**
   * Current tier
   */
  tier: SubscriptionTier;

  /**
   * Quota usage by type
   */
  quotas: Map<QuotaType, QuotaUsage>;

  /**
   * Concurrent request count
   */
  concurrentRequests: number;

  /**
   * Total cost this period
   */
  totalCost: number;
}

/**
 * Quota check result
 */
export interface QuotaCheckResult {
  /**
   * Whether quota is available
   */
  allowed: boolean;

  /**
   * Quota status
   */
  status: QuotaStatus;

  /**
   * Quota type that blocked the request
   */
  blockedBy?: QuotaType;

  /**
   * Soft limit exceeded warning
   */
  softLimitExceeded?: boolean;

  /**
   * Overage available
   */
  overageAvailable?: boolean;

  /**
   * Cost to use overage
   */
  overageCost?: number;
}

/**
 * Quota manager options
 */
export interface QuotaManagerOptions {
  /**
   * KV namespace for persistence
   */
  kv?: KVNamespace;

  /**
   * Enable quota tracking
   */
  enableTracking?: boolean;

  /**
   * Enable soft limit warnings
   */
  enableSoftLimits?: boolean;

  /**
   * Enable overage
   */
  enableOverage?: boolean;

  /**
   * TTL for stored data (seconds)
   */
  ttl?: number;

  /**
   * Default quota limits
   */
  defaultQuotas?: Partial<Record<SubscriptionTier, QuotaConfig[]>>;
}

/**
 * Default quota configurations per tier
 */
const DEFAULT_QUOTAS: Record<SubscriptionTier, QuotaConfig[]> = {
  free: [
    { type: 'requests', limit: 60, period: 'minute', softLimit: 0.8 },
    { type: 'requests', limit: 1000, period: 'day', softLimit: 0.9 },
    { type: 'tokens', limit: 10000, period: 'day', softLimit: 0.9 },
    { type: 'cost', limit: 10, period: 'month', allowOverage: false },
    { type: 'concurrent', limit: 5, period: 'forever' },
  ],
  pro: [
    { type: 'requests', limit: 600, period: 'minute', softLimit: 0.8 },
    { type: 'requests', limit: 10000, period: 'day', softLimit: 0.9 },
    { type: 'tokens', limit: 100000, period: 'day', softLimit: 0.9 },
    { type: 'cost', limit: 100, period: 'month', allowOverage: true, overageCost: 0.001 },
    { type: 'concurrent', limit: 20, period: 'forever' },
  ],
  enterprise: [
    { type: 'requests', limit: 6000, period: 'minute', softLimit: 0.8 },
    { type: 'requests', limit: 100000, period: 'day', softLimit: 0.9 },
    { type: 'tokens', limit: 1000000, period: 'day', softLimit: 0.9 },
    { type: 'cost', limit: Number.MAX_SAFE_INTEGER, period: 'month' },
    { type: 'concurrent', limit: 100, period: 'forever' },
  ],
};

/**
 * Quota Manager
 *
 * Manages quotas across multiple dimensions with tier support.
 */
export class QuotaManager {
  private kv?: KVNamespace;
  private options: Omit<QuotaManagerOptions, 'defaultQuotas'> & {
    enableTracking: boolean;
    enableSoftLimits: boolean;
    enableOverage: boolean;
    ttl: number;
  };
  private quotas: Map<SubscriptionTier, QuotaConfig[]>;
  private cache: Map<string, QuotaState>;
  private tierConfigs: Map<SubscriptionTier, TierConfig>;

  constructor(options: QuotaManagerOptions = {}) {
    if (options.kv !== undefined) {
      this.kv = options.kv;
    }
    this.options = {
      ...(options.kv !== undefined ? { kv: options.kv } : {}),
      enableTracking: options.enableTracking ?? true,
      enableSoftLimits: options.enableSoftLimits ?? true,
      enableOverage: options.enableOverage ?? true,
      ttl: options.ttl ?? 3600,
    };

    this.quotas = new Map(
      Object.entries(DEFAULT_QUOTAS) as [SubscriptionTier, QuotaConfig[]][]
    );
    this.cache = new Map();
    this.tierConfigs = new Map();

    // Apply custom quotas if provided
    if (options.defaultQuotas) {
      for (const [tier, quotas] of Object.entries(options.defaultQuotas)) {
        if (quotas) {
          this.quotas.set(tier as SubscriptionTier, quotas);
        }
      }
    }
  }

  /**
   * Check if quota is available for a request
   */
  async checkQuota(
    identifier: string,
    tier: SubscriptionTier,
    requestCost: number = 0,
    tokenCount: number = 0
  ): Promise<QuotaCheckResult> {
    const state = await this.getState(identifier, tier);
    const quotaConfigs = this.quotas.get(tier) || [];

    let allowed = true;
    let blockedBy: QuotaType | undefined;
    let softLimitExceeded = false;
    let overageAvailable = false;
    let overageCost = 0;

    // Check each quota type
    for (const config of quotaConfigs) {
      const usage = state.quotas.get(config.type);

      if (!usage) {
        continue;
      }

      // Check if period needs reset
      const now = Date.now();
      if (now > usage.periodEnd) {
        await this.resetQuota(identifier, config.type);
        continue;
      }

      // Calculate remaining quota
      const softLimitThreshold = config.softLimit
        ? config.limit * config.softLimit
        : config.limit;

      // Check soft limit
      if (usage.used >= softLimitThreshold && config.softLimit) {
        softLimitExceeded = true;
      }

      // Check hard limit
      let wouldExceed = false;
      switch (config.type) {
        case 'requests':
          wouldExceed = usage.used + 1 > config.limit;
          break;
        case 'tokens':
          wouldExceed = usage.used + tokenCount > config.limit;
          break;
        case 'cost':
          wouldExceed = usage.used + requestCost > config.limit;
          break;
        case 'concurrent':
          wouldExceed = state.concurrentRequests >= config.limit;
          break;
      }

      if (wouldExceed) {
        if (config.allowOverage && this.options.enableOverage) {
          overageAvailable = true;
          overageCost += config.overageCost || 0;
        } else {
          allowed = false;
          blockedBy = config.type;
          break;
        }
      }
    }

    // Build status
    const status = this.buildStatus(identifier, tier, state);

    return {
      allowed,
      status,
      ...(blockedBy !== undefined ? { blockedBy } : {}),
      softLimitExceeded,
      overageAvailable,
      ...(overageCost > 0 ? { overageCost } : {}),
    };
  }

  /**
   * Record quota usage
   */
  async recordUsage(
    identifier: string,
    tier: SubscriptionTier,
    requestCost: number = 0,
    tokenCount: number = 0,
    increment: number = 1
  ): Promise<void> {
    if (!this.options.enableTracking) {
      return;
    }

    const state = await this.getState(identifier, tier);

    // Update request quota
    await this.incrementQuota(identifier, 'requests', increment);

    // Update token quota
    if (tokenCount > 0) {
      await this.incrementQuota(identifier, 'tokens', tokenCount);
    }

    // Update cost quota
    if (requestCost > 0) {
      await this.incrementQuota(identifier, 'cost', requestCost);
      state.totalCost += requestCost;
    }

    // Update concurrent requests
    state.concurrentRequests++;

    await this.saveState(identifier, state);
  }

  /**
   * Release concurrent request quota
   */
  async releaseConcurrent(identifier: string, tier: SubscriptionTier): Promise<void> {
    const state = await this.getState(identifier, tier);
    state.concurrentRequests = Math.max(0, state.concurrentRequests - 1);
    await this.saveState(identifier, state);
  }

  /**
   * Get quota status
   */
  async getQuotaStatus(
    identifier: string,
    tier: SubscriptionTier
  ): Promise<QuotaStatus> {
    const state = await this.getState(identifier, tier);
    return this.buildStatus(identifier, tier, state);
  }

  /**
   * Get quota usage for all types
   */
  async getAllQuotas(
    identifier: string,
    tier: SubscriptionTier
  ): Promise<Map<QuotaType, QuotaStatus>> {
    const state = await this.getState(identifier, tier);
    const statuses = new Map<QuotaType, QuotaStatus>();

    for (const [type, usage] of state.quotas.entries()) {
      const config = this.getQuotaConfig(tier, type);
      if (config) {
        statuses.set(type, {
          identifier,
          tier,
          used: usage.used,
          limit: config.limit,
          remaining: config.limit - usage.used,
          resetTime: usage.periodEnd,
          resetType: this.getResetType(config.period),
          usagePercent: (usage.used / config.limit) * 100,
          isExhausted: usage.used >= config.limit,
        });
      }
    }

    return statuses;
  }

  /**
   * Reset quota for a specific type
   */
  async resetQuota(identifier: string, type: QuotaType): Promise<void> {
    const cached = this.cache.get(identifier);

    if (cached && cached.quotas.has(type)) {
      const config = this.getQuotaConfig(cached.tier, type);
      if (config) {
        const now = Date.now();
        const { periodStart, periodEnd } = this.calculatePeriod(config.period, now);

        cached.quotas.set(type, {
          used: 0,
          periodStart,
          periodEnd,
          lastUpdated: now,
        });

        await this.saveState(identifier, cached);
      }
    }
  }

  /**
   * Reset all quotas for an identifier
   */
  async resetAllQuotas(identifier: string): Promise<void> {
    this.cache.delete(identifier);

    if (this.kv) {
      await this.kv.delete(this.getStorageKey(identifier));
    }
  }

  /**
   * Change tier for an identifier
   */
  async changeTier(
    identifier: string,
    _oldTier: SubscriptionTier,
    newTier: SubscriptionTier
  ): Promise<void> {
    // Reset quotas with new tier
    await this.resetAllQuotas(identifier);

    const state = await this.getState(identifier, newTier);
    await this.saveState(identifier, state);
  }

  /**
   * Set tier configuration
   */
  setTierConfig(tier: SubscriptionTier, config: TierConfig): void {
    this.tierConfigs.set(tier, config);
  }

  /**
   * Set quota configuration for a tier
   */
  setQuotaConfig(tier: SubscriptionTier, quotas: QuotaConfig[]): void {
    this.quotas.set(tier, quotas);
  }

  /**
   * Get quota configuration for a tier and type
   */
  getQuotaConfig(tier: SubscriptionTier, type: QuotaType): QuotaConfig | undefined {
    const quotas = this.quotas.get(tier);
    return quotas?.find((q) => q.type === type);
  }

  /**
   * Get state for identifier
   */
  private async getState(
    identifier: string,
    tier: SubscriptionTier
  ): Promise<QuotaState> {
    let state = this.cache.get(identifier);

    if (!state) {
      // Try loading from KV
      if (this.kv) {
        const data = await this.kv.get(this.getStorageKey(identifier), 'json');
        if (data) {
          state = this.deserializeState(identifier, data as Record<string, unknown>);
          this.cache.set(identifier, state);
        }
      }

      // Initialize if not found
      if (!state) {
        state = await this.initializeState(identifier, tier);
      }
    }

    // Check if tier changed
    if (state.tier !== tier) {
      state = await this.initializeState(identifier, tier);
    }

    return state;
  }

  /**
   * Initialize state for identifier
   */
  private async initializeState(
    identifier: string,
    tier: SubscriptionTier
  ): Promise<QuotaState> {
    const quotaConfigs = this.quotas.get(tier) || [];
    const quotas = new Map<QuotaType, QuotaUsage>();
    const now = Date.now();

    for (const config of quotaConfigs) {
      const { periodStart, periodEnd } = this.calculatePeriod(config.period, now);

      quotas.set(config.type, {
        used: 0,
        periodStart,
        periodEnd,
        lastUpdated: now,
      });
    }

    const state: QuotaState = {
      identifier,
      tier,
      quotas,
      concurrentRequests: 0,
      totalCost: 0,
    };

    this.cache.set(identifier, state);
    await this.saveState(identifier, state);

    return state;
  }

  /**
   * Increment quota usage
   */
  private async incrementQuota(
    identifier: string,
    type: QuotaType,
    amount: number
  ): Promise<void> {
    const state = this.cache.get(identifier);
    if (!state) return;

    const usage = state.quotas.get(type);
    if (!usage) return;

    const now = Date.now();

    // Check if period needs reset
    if (now > usage.periodEnd) {
      const config = this.getQuotaConfig(state.tier, type);
      if (config) {
        const { periodStart, periodEnd } = this.calculatePeriod(config.period, now);
        usage.used = 0;
        usage.periodStart = periodStart;
        usage.periodEnd = periodEnd;
      }
    }

    usage.used += amount;
    usage.lastUpdated = now;

    await this.saveState(identifier, state);
  }

  /**
   * Save state to storage
   */
  private async saveState(identifier: string, state: QuotaState): Promise<void> {
    this.cache.set(identifier, state);

    if (this.kv) {
      await this.kv.put(
        this.getStorageKey(identifier),
        JSON.stringify(this.serializeState(state)),
        {
          expirationTtl: this.options.ttl,
        }
      );
    }
  }

  /**
   * Calculate period start and end
   */
  private calculatePeriod(
    period: QuotaPeriod,
    now: number
  ): { periodStart: number; periodEnd: number } {
    const date = new Date(now);

    switch (period) {
      case 'minute':
        const minuteStart = new Date(date);
        minuteStart.setSeconds(0, 0);
        const minuteEnd = new Date(minuteStart);
        minuteEnd.setMinutes(minuteEnd.getMinutes() + 1);
        return { periodStart: minuteStart.getTime(), periodEnd: minuteEnd.getTime() };

      case 'hour':
        const hourStart = new Date(date);
        hourStart.setMinutes(0, 0, 0);
        const hourEnd = new Date(hourStart);
        hourEnd.setHours(hourEnd.getHours() + 1);
        return { periodStart: hourStart.getTime(), periodEnd: hourEnd.getTime() };

      case 'day':
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        return { periodStart: dayStart.getTime(), periodEnd: dayEnd.getTime() };

      case 'week':
        const weekStart = new Date(date);
        weekStart.setHours(0, 0, 0, 0);
        const dayOfWeek = weekStart.getDay();
        weekStart.setDate(weekStart.getDate() - dayOfWeek);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        return { periodStart: weekStart.getTime(), periodEnd: weekEnd.getTime() };

      case 'month':
        const monthStart = new Date(date);
        monthStart.setHours(0, 0, 0, 0);
        monthStart.setDate(1);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        return { periodStart: monthStart.getTime(), periodEnd: monthEnd.getTime() };

      case 'forever':
        return {
          periodStart: 0,
          periodEnd: Number.MAX_SAFE_INTEGER,
        };

      default:
        return {
          periodStart: now,
          periodEnd: now + 60000,
        };
    }
  }

  /**
   * Build quota status
   */
  private buildStatus(
    identifier: string,
    tier: SubscriptionTier,
    state: QuotaState
  ): QuotaStatus {
    // Get the most restrictive quota
    let highestUsagePercent = 0;
    let closestLimit = 0;
    let closestRemaining = 0;
    let closestReset = 0;

    for (const [type, usage] of state.quotas.entries()) {
      const config = this.getQuotaConfig(tier, type);
      if (!config) continue;

      const usagePercent = (usage.used / config.limit) * 100;
      if (usagePercent > highestUsagePercent) {
        highestUsagePercent = usagePercent;
        closestLimit = config.limit;
        closestRemaining = config.limit - usage.used;
        closestReset = usage.periodEnd;
      }
    }

    return {
      identifier,
      tier,
      used: closestLimit - closestRemaining,
      limit: closestLimit,
      remaining: closestRemaining,
      resetTime: closestReset,
      resetType: 'daily',
      usagePercent: highestUsagePercent,
      isExhausted: closestRemaining === 0,
    };
  }

  /**
   * Convert period to reset type
   */
  private getResetType(period: QuotaPeriod): 'daily' | 'monthly' | 'never' {
    if (period === 'day') return 'daily';
    if (period === 'month') return 'monthly';
    return 'never';
  }

  /**
   * Serialize state for storage
   */
  private serializeState(state: QuotaState): Record<string, unknown> {
    return {
      identifier: state.identifier,
      tier: state.tier,
      quotas: Array.from(state.quotas.entries()),
      concurrentRequests: state.concurrentRequests,
      totalCost: state.totalCost,
    };
  }

  /**
   * Deserialize state from storage
   */
  private deserializeState(
    identifier: string,
    data: Record<string, unknown>
  ): QuotaState {
    return {
      identifier,
      tier: data['tier'] as SubscriptionTier,
      quotas: new Map(data['quotas'] as [QuotaType, QuotaUsage][]),
      concurrentRequests: data['concurrentRequests'] as number,
      totalCost: data['totalCost'] as number,
    };
  }

  /**
   * Get storage key
   */
  private getStorageKey(identifier: string): string {
    return `quota:${identifier}`;
  }
}

/**
 * Create a quota manager with default configuration
 */
export function createQuotaManager(options?: QuotaManagerOptions): QuotaManager {
  return new QuotaManager(options);
}
