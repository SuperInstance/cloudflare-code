/**
 * Rate Limiting Type Definitions
 *
 * Comprehensive type definitions for the advanced rate limiting system.
 * Supports hierarchical limits, multiple algorithms, and tiered quotas.
 */

/**
 * Rate limit algorithm types
 */
export type RateLimitAlgorithm = 'token-bucket' | 'sliding-window' | 'fixed-window' | 'leaky-bucket';

/**
 * Rate limit scope levels (hierarchical)
 */
export type RateLimitScope = 'global' | 'organization' | 'user' | 'ip' | 'endpoint';

/**
 * Subscription tiers for quota management
 */
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

/**
 * Time window units
 */
export type TimeUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month';

/**
 * Rate limit decision result
 */
export interface RateLimitDecision {
  /**
   * Whether the request is allowed
   */
  allowed: boolean;

  /**
   * Remaining requests/tokens
   */
  remaining: number;

  /**
   * Maximum limit
   */
  limit: number;

  /**
   * Unix timestamp when limit resets
   */
  resetTime: number;

  /**
   * Time until reset in milliseconds
   */
  resetIn: number;

  /**
   * Which scope triggered the limit
   */
  scope?: RateLimitScope;

  /**
   * Identifier that was rate limited
   */
  identifier?: string;

  /**
   * Current usage count
   */
  currentUsage: number;

  /**
   * Rate limit tier that applied
   */
  tier?: SubscriptionTier;

  /**
   * Retry-after header value (seconds)
   */
  retryAfter?: number;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum requests allowed
   */
  maxRequests: number;

  /**
   * Time window
   */
  windowMs: number;

  /**
   * Algorithm to use
   */
  algorithm?: RateLimitAlgorithm;

  /**
   * Burst capacity (for token bucket)
   */
  burst?: number;

  /**
   * Scope level
   */
  scope: RateLimitScope;

  /**
   * Key pattern for storage (e.g., "ratelimit:{scope}:{id}")
   */
  keyPattern?: string;
}

/**
 * Per-endpoint rate limit configuration
 */
export interface EndpointRateLimitConfig {
  /**
   * Endpoint path pattern (e.g., "/api/chat", "/api/code/*")
   */
  pattern: string | RegExp;

  /**
   * Rate limits per tier
   */
  limits: Partial<Record<SubscriptionTier, RateLimitConfig>>;

  /**
   * Requires authentication
   */
  requiresAuth?: boolean;

  /**
   * HTTP methods to apply to (empty = all methods)
   */
  methods?: string[];

  /**
   * Priority (higher = checked first)
   */
  priority?: number;
}

/**
 * Subscription tier configuration
 */
export interface TierConfig {
  /**
   * Tier name
   */
  tier: SubscriptionTier;

  /**
   * Requests per minute
   */
  requestsPerMinute: number;

  /**
   * Burst capacity
   */
  burst: number;

  /**
   * Monthly cost limit (USD)
   */
  monthlyCostLimit: number;

  /**
   * Token limit per request
   */
  tokensPerRequest?: number;

  /**
   * Concurrent request limit
   */
  concurrentRequests?: number;

  /**
   * Daily request limit
   */
  dailyLimit?: number;

  /**
   * Custom features
   */
  features?: string[];
}

/**
 * Rate limit rule
 */
export interface RateLimitRule {
  /**
   * Rule identifier
   */
  id: string;

  /**
   * Rule name
   */
  name: string;

  /**
   * Scope level
   */
  scope: RateLimitScope;

  /**
   * Rate limit configuration
   */
  config: RateLimitConfig;

  /**
   * Applicable tiers (empty = all tiers)
   */
  tiers?: SubscriptionTier[];

  /**
   * Enabled flag
   */
  enabled: boolean;

  /**
   * Priority for evaluation order
   */
  priority: number;
}

/**
 * Rate limit statistics
 */
export interface RateLimitStats {
  /**
   * Total requests checked
   */
  totalRequests: number;

  /**
   * Requests allowed
   */
  allowedRequests: number;

  /**
   * Requests blocked
   */
  blockedRequests: number;

  /**
   * Allow rate (percentage)
   */
  allowRate: number;

  /**
   * Current usage count
   */
  currentUsage: number;

  /**
   * Peak usage
   */
  peakUsage: number;

  /**
   * First request timestamp
   */
  firstRequest: number;

  /**
   * Last request timestamp
   */
  lastRequest: number;

  /**
   * Requests per minute
   */
  requestsPerMinute: number;

  /**
   * Requests per second
   */
  requestsPerSecond: number;
}

/**
 * Rate limit event
 */
export interface RateLimitEvent {
  /**
   * Event timestamp
   */
  timestamp: number;

  /**
   * Event type
   */
  type: 'check' | 'allow' | 'block' | 'reset' | 'exhausted';

  /**
   * Scope level
   */
  scope: RateLimitScope;

  /**
   * Identifier
   */
  identifier: string;

  /**
   * Endpoint
   */
  endpoint?: string;

  /**
   * Tier
   */
  tier?: SubscriptionTier;

  /**
   * Decision
   */
  decision?: RateLimitDecision;

  /**
   * Metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Rate limit analytics data
 */
export interface RateLimitAnalytics {
  /**
   * Time window start
   */
  windowStart: number;

  /**
   * Time window end
   */
  windowEnd: number;

  /**
   * Total requests
   */
  totalRequests: number;

  /**
   * Blocked requests
   */
  blockedRequests: number;

  /**
   * Block rate (percentage)
   */
  blockRate: number;

  /**
   * Top blocked identifiers
   */
  topBlocked: Array<{
    identifier: string;
    count: number;
    percentage: number;
  }>;

  /**
   * Requests by tier
   */
  requestsByTier: Array<{
    tier: SubscriptionTier;
    count: number;
    percentage: number;
  }>;

  /**
   * Requests by scope
   */
  requestsByScope: Array<{
    scope: RateLimitScope;
    count: number;
    percentage: number;
  }>;

  /**
   * Requests by endpoint
   */
  requestsByEndpoint: Array<{
    endpoint: string;
    count: number;
    blocked: number;
  }>;

  /**
   * Peak usage timestamp
   */
  peakUsageTime?: number;

  /**
   * Peak requests per second
   */
  peakRPS?: number;
}

/**
 * Quota status
 */
export interface QuotaStatus {
  /**
   * Identifier
   */
  identifier: string;

  /**
   * Current tier
   */
  tier: SubscriptionTier;

  /**
   * Used amount
   */
  used: number;

  /**
   * Limit
   */
  limit: number;

  /**
   * Remaining
   */
  remaining: number;

  /**
   * Reset timestamp
   */
  resetTime: number;

  /**
   * Reset type
   */
  resetType: 'daily' | 'monthly' | 'never';

  /**
   * Usage percentage
   */
  usagePercent: number;

  /**
   * Is quota exhausted
   */
  isExhausted: boolean;

  /**
   * Projected exhaustion timestamp
   */
  projectedExhaustion?: number;
}

/**
 * Rate limit manager options
 */
export interface RateLimitManagerOptions {
  /**
   * KV namespace for persistence
   */
  kv?: KVNamespace;

  /**
   * Durable Object namespace for distributed coordination
   */
  doNamespace?: DurableObjectNamespace;

  /**
   * Default algorithm
   */
  defaultAlgorithm?: RateLimitAlgorithm;

  /**
   * Enable analytics
   */
  enableAnalytics?: boolean;

  /**
   * Enable distributed rate limiting
   */
  enableDistributed?: boolean;

  /**
   * Graceful degradation (fallback to local if DO fails)
   */
  gracefulDegradation?: boolean;

  /**
   * TTL for stored data (seconds)
   */
  ttl?: number;
}

/**
 * Rate limit middleware options
 */
export interface RateLimitMiddlewareOptions {
  /**
   * Rate limit configuration
   */
  config: RateLimitConfig;

  /**
   * KV namespace for persistence (optional)
   */
  kv?: KVNamespace;

  /**
   * Extract identifier from request
   */
  identifierGenerator: (c: import('hono').Context) => string | Promise<string>;

  /**
   * Extract tier from request
   */
  tierGenerator?: (c: import('hono').Context) => SubscriptionTier | Promise<SubscriptionTier>;

  /**
   * Skip rate limiting for certain requests
   */
  skipIf?: (c: import('hono').Context) => boolean | Promise<boolean>;

  /**
   * Custom error handler
   */
  errorHandler?: (
    c: import('hono').Context,
    decision: RateLimitDecision
  ) => Response | Promise<Response>;

  /**
   * Add rate limit headers to response
   */
  addHeaders?: boolean;

  /**
   * Log rate limit events
   */
  logEvents?: boolean;

  /**
   * Key prefix for storage
   */
  keyPrefix?: string;
}

/**
 * Token bucket state (distributed)
 */
export interface TokenBucketState {
  /**
   * Current token count
   */
  tokens: number;

  /**
   * Last refill timestamp
   */
  lastRefill: number;

  /**
   * Bucket capacity
   */
  capacity: number;

  /**
   * Refill rate (tokens per second)
   */
  refillRate: number;

  /**
   * Burst capacity
   */
  burst?: number;
}

/**
 * Sliding window state (distributed)
 */
export interface SlidingWindowState {
  /**
   * Request timestamps
   */
  timestamps: number[];

  /**
   * Maximum requests
   */
  maxRequests: number;

  /**
   * Window size (ms)
   */
  windowMs: number;
}

/**
 * Rate limit storage interface
 */
export interface RateLimitStorage {
  /**
   * Get rate limit state
   */
  get(key: string): Promise<TokenBucketState | SlidingWindowState | null>;

  /**
   * Set rate limit state
   */
  set(
    key: string,
    value: TokenBucketState | SlidingWindowState,
    ttl?: number
  ): Promise<void>;

  /**
   * Increment counter
   */
  increment(key: string, ttl?: number): Promise<number>;

  /**
   * Delete rate limit state
   */
  delete(key: string): Promise<void>;

  /**
   * Reset rate limit state
   */
  reset(key: string): Promise<void>;
}

/**
 * Rate limit result with metadata
 */
export interface RateLimitResult {
  /**
   * Decision
   */
  decision: RateLimitDecision;

  /**
   * Statistics
   */
  stats?: RateLimitStats;

  /**
   * Rule that was applied
   */
  rule?: RateLimitRule;

  /**
   * All rules that were checked
   */
  checkedRules?: RateLimitRule[];
}

/**
 * Burst handling configuration
 */
export interface BurstConfig {
  /**
   * Enable burst handling
   */
  enabled: boolean;

  /**
   * Burst size (number of requests)
   */
  burstSize: number;

  /**
   * Burst duration (milliseconds)
   */
  burstDuration: number;

  /**
   * Recovery rate (requests per second after burst)
   */
  recoveryRate: number;

  /**
   * Cooldown period before next burst
   */
  cooldownPeriod: number;
}

/**
 * Rate limit event log entry
 */
export interface RateLimitLogEntry {
  timestamp: number;
  identifier: string;
  scope: RateLimitScope;
  tier?: SubscriptionTier;
  endpoint?: string;
  allowed: boolean;
  remaining: number;
  limit: number;
  metadata?: Record<string, unknown>;
}

/**
 * Rate limit aggregation window
 */
export interface AggregationWindow {
  /**
   * Window size in milliseconds
   */
  sizeMs: number;

  /**
   * Number of windows to keep
   */
  retention: number;

  /**
   * Aggregation function
   */
  function: 'sum' | 'avg' | 'max' | 'min';
}
