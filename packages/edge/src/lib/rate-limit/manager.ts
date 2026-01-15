/**
 * Rate Limit Manager
 *
 * Manages hierarchical rate limits across multiple scopes (global > org > user > IP).
 * Supports multiple tiers, per-endpoint configuration, and distributed coordination.
 */

import {
  TokenBucketAlgorithm,
  SlidingWindowAlgorithm,
  RateLimitAlgorithmFactory,
} from './algorithms';
import type {
  RateLimitDecision,
  RateLimitConfig,
  RateLimitScope,
  SubscriptionTier,
  TierConfig,
  EndpointRateLimitConfig,
  RateLimitRule,
  RateLimitStats,
  RateLimitResult,
  RateLimitManagerOptions,
  BurstConfig,
  RateLimitEvent,
  RateLimitAlgorithm,
} from './types';

/**
 * Default tier configurations
 */
const DEFAULT_TIERS: Record<SubscriptionTier, TierConfig> = {
  free: {
    tier: 'free',
    requestsPerMinute: 60,
    burst: 10,
    monthlyCostLimit: 10,
    tokensPerRequest: 1000,
    concurrentRequests: 5,
  },
  pro: {
    tier: 'pro',
    requestsPerMinute: 600,
    burst: 100,
    monthlyCostLimit: 100,
    tokensPerRequest: 10000,
    concurrentRequests: 20,
  },
  enterprise: {
    tier: 'enterprise',
    requestsPerMinute: 6000,
    burst: 1000,
    monthlyCostLimit: Number.MAX_SAFE_INTEGER,
    tokensPerRequest: 100000,
    concurrentRequests: 100,
    features: ['custom-domains', 'priority-support'],
  },
};

/**
 * Default per-endoint limits
 */
const DEFAULT_ENDPOINT_LIMITS: EndpointRateLimitConfig[] = [
  {
    pattern: '/api/chat',
    limits: {
      free: {
        maxRequests: 10,
        windowMs: 60000,
        scope: 'user',
        algorithm: 'token-bucket',
      },
      pro: {
        maxRequests: 100,
        windowMs: 60000,
        scope: 'user',
        algorithm: 'token-bucket',
      },
      enterprise: {
        maxRequests: 1000,
        windowMs: 60000,
        scope: 'user',
        algorithm: 'token-bucket',
      },
    },
    requiresAuth: true,
  },
  {
    pattern: '/api/code',
    limits: {
      free: {
        maxRequests: 5,
        windowMs: 60000,
        scope: 'user',
        algorithm: 'token-bucket',
      },
      pro: {
        maxRequests: 50,
        windowMs: 60000,
        scope: 'user',
        algorithm: 'token-bucket',
      },
      enterprise: {
        maxRequests: 500,
        windowMs: 60000,
        scope: 'user',
        algorithm: 'token-bucket',
      },
    },
    requiresAuth: true,
  },
  {
    pattern: '/api/analyze',
    limits: {
      free: {
        maxRequests: 20,
        windowMs: 60000,
        scope: 'user',
        algorithm: 'sliding-window',
      },
      pro: {
        maxRequests: 200,
        windowMs: 60000,
        scope: 'user',
        algorithm: 'sliding-window',
      },
      enterprise: {
        maxRequests: 2000,
        windowMs: 60000,
        scope: 'user',
        algorithm: 'sliding-window',
      },
    },
    requiresAuth: true,
  },
  {
    pattern: '/api/admin',
    limits: {
      enterprise: {
        maxRequests: 100,
        windowMs: 60000,
        scope: 'user',
        algorithm: 'sliding-window',
      },
    },
    requiresAuth: true,
  },
];

/**
 * Rate Limit Manager
 *
 * Manages rate limiting across multiple scopes and tiers.
 */
export class RateLimitManager {
  private options: Omit<RateLimitManagerOptions, 'doNamespace'> & {
    defaultAlgorithm: RateLimitAlgorithm;
    enableAnalytics: boolean;
    enableDistributed: boolean;
    gracefulDegradation: boolean;
    ttl: number;
  };
  private tiers: Map<SubscriptionTier, TierConfig>;
  private endpointLimits: EndpointRateLimitConfig[];
  private customRules: Map<string, RateLimitRule>;
  private stats: Map<string, RateLimitStats>;
  private events: RateLimitEvent[] = [];
  private limiters: Map<string, TokenBucketAlgorithm | SlidingWindowAlgorithm>;
  private burstConfig: BurstConfig;
  private doNamespace?: DurableObjectNamespace;

  constructor(options: RateLimitManagerOptions = {}) {
    this.options = {
      defaultAlgorithm: options.defaultAlgorithm ?? 'token-bucket',
      enableAnalytics: options.enableAnalytics ?? true,
      enableDistributed: options.enableDistributed ?? true,
      gracefulDegradation: options.gracefulDegradation ?? true,
      ttl: options.ttl ?? 3600,
      ...(options.kv !== undefined ? { kv: options.kv } : {}),
    };

    if (options.doNamespace !== undefined) {
      this.doNamespace = options.doNamespace;
    }
    this.tiers = new Map(Object.entries(DEFAULT_TIERS) as [SubscriptionTier, TierConfig][]);
    this.endpointLimits = DEFAULT_ENDPOINT_LIMITS;
    this.customRules = new Map();
    this.stats = new Map();
    this.limiters = new Map();
    this.burstConfig = {
      enabled: true,
      burstSize: 10,
      burstDuration: 10000,
      recoveryRate: 1,
      cooldownPeriod: 30000,
    };
  }

  /**
   * Check rate limit for a request
   */
  async checkLimit(
    identifier: string,
    scope: RateLimitScope,
    tier: SubscriptionTier = 'free',
    endpoint?: string,
    method: string = 'GET'
  ): Promise<RateLimitResult> {
    const startTime = Date.now();

    // Get tier configuration
    const tierConfig = this.tiers.get(tier) || DEFAULT_TIERS[tier];

    // Collect all applicable rules
    const rules = this.getApplicableRules(scope, tier, endpoint, method);

    // Check each rule in priority order
    const checkedRules: RateLimitRule[] = [];
    let finalDecision: RateLimitDecision | null = null;
    let appliedRule: RateLimitRule | undefined;

    for (const rule of rules) {
      if (!rule.enabled) continue;

      checkedRules.push(rule);

      const decision = await this.checkRule(rule, identifier, tierConfig);

      if (!decision.allowed) {
        finalDecision = decision;
        finalDecision.scope = rule.scope;
        finalDecision.identifier = identifier;
        finalDecision.tier = tier;
        appliedRule = rule;
        break;
      }

      if (!finalDecision || decision.remaining < finalDecision.remaining) {
        finalDecision = decision;
      }
    }

    // If no rules blocked, use the most restrictive
    if (!finalDecision) {
      finalDecision = await this.getDefaultDecision(identifier, scope, tierConfig);
    }

    // Update statistics
    if (this.options.enableAnalytics) {
      await this.updateStats(identifier, scope, tier, endpoint, finalDecision);
    }

    // Log event
    this.logEvent({
      timestamp: startTime,
      type: finalDecision.allowed ? 'allow' : 'block',
      scope,
      identifier,
      ...(endpoint !== undefined ? { endpoint } : {}),
      tier,
      decision: finalDecision,
    });

    return {
      decision: finalDecision,
      ...(appliedRule !== undefined ? { rule: appliedRule } : {}),
      checkedRules,
    };
  }

  /**
   * Check multiple hierarchical limits
   */
  async checkHierarchicalLimits(
    ip: string,
    userId?: string,
    orgId?: string,
    tier: SubscriptionTier = 'free',
    endpoint?: string
  ): Promise<RateLimitDecision> {
    // Check in order: global > org > user > ip
    const scopes: RateLimitScope[] = ['global'];

    if (orgId) scopes.push('organization');
    if (userId) scopes.push('user');
    scopes.push('ip');

    let mostRestrictive: RateLimitDecision | null = null;

    for (const scope of scopes) {
      let identifier: string;

      switch (scope) {
        case 'global':
          identifier = 'global';
          break;
        case 'organization':
          identifier = `org:${orgId}`;
          break;
        case 'user':
          identifier = `user:${userId}`;
          break;
        case 'ip':
          identifier = `ip:${ip}`;
          break;
        default:
          continue;
      }

      const result = await this.checkLimit(identifier, scope, tier, endpoint);

      if (!result.decision.allowed) {
        return result.decision;
      }

      if (!mostRestrictive || result.decision.remaining < mostRestrictive.remaining) {
        mostRestrictive = result.decision;
      }
    }

    return mostRestrictive || this.createEmptyDecision();
  }

  /**
   * Get rate limit statistics
   */
  getStats(identifier: string): RateLimitStats | undefined {
    return this.stats.get(identifier);
  }

  /**
   * Get all rate limit events
   */
  getEvents(limit?: number): RateLimitEvent[] {
    if (limit) {
      return this.events.slice(-limit);
    }
    return [...this.events];
  }

  /**
   * Add a custom rate limit rule
   */
  addRule(rule: RateLimitRule): void {
    this.customRules.set(rule.id, rule);
  }

  /**
   * Remove a rate limit rule
   */
  removeRule(ruleId: string): boolean {
    return this.customRules.delete(ruleId);
  }

  /**
   * Update tier configuration
   */
  updateTier(tier: SubscriptionTier, config: Partial<TierConfig>): void {
    const existing = this.tiers.get(tier) || DEFAULT_TIERS[tier];
    this.tiers.set(tier, { ...existing, ...config });
  }

  /**
   * Set burst configuration
   */
  setBurstConfig(config: Partial<BurstConfig>): void {
    this.burstConfig = { ...this.burstConfig, ...config };
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string, scope: RateLimitScope): Promise<void> {
    const key = this.getLimiterKey(identifier, scope);
    const limiter = this.limiters.get(key);

    if (limiter) {
      await limiter.reset(identifier);
    }

    this.stats.delete(identifier);
  }

  /**
   * Reset all rate limits
   */
  async resetAll(): Promise<void> {
    for (const _limiter of this.limiters.values()) {
      // Reset each limiter (implementation specific)
    }

    this.stats.clear();
    this.events = [];
  }

  /**
   * Get applicable rules for a request
   */
  private getApplicableRules(
    scope: RateLimitScope,
    tier: SubscriptionTier,
    endpoint?: string,
    method: string = 'GET'
  ): RateLimitRule[] {
    const rules: RateLimitRule[] = [];

    // Add endpoint-specific rules
    if (endpoint) {
      for (const endpointLimit of this.endpointLimits) {
        if (this.matchEndpoint(endpoint, endpointLimit.pattern, method)) {
          const limit = endpointLimit.limits[tier];
          if (limit) {
            rules.push({
              id: `endpoint:${endpoint}:${tier}`,
              name: `Endpoint ${endpoint} (${tier})`,
              scope,
              config: limit,
              tiers: [tier],
              enabled: true,
              priority: 100,
            });
          }
        }
      }
    }

    // Add custom rules
    for (const rule of this.customRules.values()) {
      if (rule.scope === scope) {
        if (!rule.tiers || rule.tiers.includes(tier)) {
          rules.push(rule);
        }
      }
    }

    // Sort by priority (higher first)
    return rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Check a single rate limit rule
   */
  private async checkRule(
    rule: RateLimitRule,
    identifier: string,
    tierConfig: TierConfig
  ): Promise<RateLimitDecision> {
    const key = this.getLimiterKey(identifier, rule.scope);
    let limiter = this.limiters.get(key);

    // Create limiter if not exists
    if (!limiter) {
      // Algorithm will be determined by the limiter creation methods
      if (this.options.enableDistributed && this.doNamespace) {
        // Use distributed DO-based limiter
        limiter = await this.createDistributedLimiter(
          key,
          rule.config,
          tierConfig
        );
      } else {
        // Use local limiter
        limiter = this.createLocalLimiter(key, rule.config, tierConfig);
      }

      this.limiters.set(key, limiter);
    }

    // Check limit
    if (limiter instanceof TokenBucketAlgorithm) {
      return await limiter.check(identifier, 1, this.burstConfig);
    } else {
      return await limiter.check(identifier);
    }
  }

  /**
   * Create local rate limiter
   */
  private createLocalLimiter(
    _key: string,
    config: RateLimitConfig,
    tierConfig: TierConfig
  ): TokenBucketAlgorithm | SlidingWindowAlgorithm {
    const algorithm = config.algorithm || this.options.defaultAlgorithm;
    const burst = tierConfig.burst || config.burst;

    if (algorithm === 'token-bucket') {
      return new TokenBucketAlgorithm(
        config.maxRequests,
        config.maxRequests / (config.windowMs / 1000),
        burst
      );
    } else {
      return new SlidingWindowAlgorithm(
        config.maxRequests,
        config.windowMs
      );
    }
  }

  /**
   * Create distributed rate limiter using DO
   */
  private async createDistributedLimiter(
    key: string,
    config: RateLimitConfig,
    tierConfig: TierConfig
  ): Promise<TokenBucketAlgorithm | SlidingWindowAlgorithm> {
    if (!this.doNamespace) {
      return this.createLocalLimiter(key, config, tierConfig);
    }

    try {
      const stub = this.doNamespace.get(
        this.doNamespace.idFromName(this.getDOId(key))
      );

      const response = await stub.fetch(
        new Request('http://do/check', {
          method: 'POST',
          body: JSON.stringify({
            config,
            tier: tierConfig.tier,
            burst: tierConfig.burst,
          }),
        })
      );

      if (response.ok) {
        const data = await response.json() as { decision?: TokenBucketAlgorithm | SlidingWindowAlgorithm };
        // Return decision from DO
        if (data.decision) {
          return data.decision;
        }
      }
    } catch (error) {
      console.error('Distributed limiter error:', error);
      if (this.options.gracefulDegradation) {
        return this.createLocalLimiter(key, config, tierConfig);
      }
    }

    return this.createLocalLimiter(key, config, tierConfig);
  }

  /**
   * Get default rate limit decision
   */
  private async getDefaultDecision(
    identifier: string,
    scope: RateLimitScope,
    tierConfig: TierConfig
  ): Promise<RateLimitDecision> {
    const key = this.getLimiterKey(identifier, scope);
    let limiter = this.limiters.get(key);

    if (!limiter) {
      limiter = RateLimitAlgorithmFactory.createTokenBucketRPM(
        tierConfig.requestsPerMinute,
        undefined,
        tierConfig.burst
      );
      this.limiters.set(key, limiter);
    }

    return await limiter.check(identifier, 1, this.burstConfig);
  }

  /**
   * Update statistics
   */
  private async updateStats(
    identifier: string,
    _scope: RateLimitScope,
    _tier: SubscriptionTier,
    _endpoint: string | undefined,
    decision: RateLimitDecision
  ): Promise<void> {
    let stats = this.stats.get(identifier);

    if (!stats) {
      stats = {
        totalRequests: 0,
        allowedRequests: 0,
        blockedRequests: 0,
        allowRate: 100,
        currentUsage: 0,
        peakUsage: 0,
        firstRequest: Date.now(),
        lastRequest: Date.now(),
        requestsPerMinute: 0,
        requestsPerSecond: 0,
      };
      this.stats.set(identifier, stats);
    }

    stats.totalRequests++;
    stats.lastRequest = Date.now();

    if (decision.allowed) {
      stats.allowedRequests++;
    } else {
      stats.blockedRequests++;
    }

    stats.currentUsage = decision.currentUsage;
    stats.peakUsage = Math.max(stats.peakUsage, decision.currentUsage);
    stats.allowRate = (stats.allowedRequests / stats.totalRequests) * 100;

    // Calculate RPS/RPM
    const elapsed = (stats.lastRequest - stats.firstRequest) / 1000;
    if (elapsed > 0) {
      stats.requestsPerSecond = stats.totalRequests / elapsed;
      stats.requestsPerMinute = stats.requestsPerSecond * 60;
    }
  }

  /**
   * Log rate limit event
   */
  private logEvent(event: RateLimitEvent): void {
    this.events.push(event);

    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
  }

  /**
   * Match endpoint against pattern
   */
  private matchEndpoint(
    endpoint: string,
    pattern: string | RegExp,
    _method: string
  ): boolean {
    if (pattern instanceof RegExp) {
      return pattern.test(endpoint);
    }

    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(endpoint);
  }

  /**
   * Get limiter cache key
   */
  private getLimiterKey(identifier: string, scope: RateLimitScope): string {
    return `${scope}:${identifier}`;
  }

  /**
   * Get stable DO ID from key
   */
  private getDOId(key: string): string {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `rate-limit-${Math.abs(hash)}`;
  }

  /**
   * Create empty decision
   */
  private createEmptyDecision(): RateLimitDecision {
    return {
      allowed: true,
      remaining: Number.MAX_SAFE_INTEGER,
      limit: Number.MAX_SAFE_INTEGER,
      resetTime: Date.now() + 60000,
      resetIn: 60000,
      currentUsage: 0,
    };
  }
}

/**
 * Create a rate limit manager with default configuration
 */
export function createRateLimitManager(
  options?: RateLimitManagerOptions
): RateLimitManager {
  return new RateLimitManager(options);
}
