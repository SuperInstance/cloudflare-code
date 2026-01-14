/**
 * Rate Limiting & Circuit Breaker Module
 *
 * Exports all rate limiting, circuit breaker, retry, and quota tracking components.
 *
 * @example
 * ```typescript
 * import { rateLimit, RateLimitManager, QuotaManager } from './lib/rate-limit';
 *
 * // Use middleware in Hono
 * app.use('/api/*', rateLimit({
 *   config: {
 *     maxRequests: 60,
 *     windowMs: 60000,
 *     scope: 'user',
 *   },
 *   identifierGenerator: (c) => c.req.header('x-user-id') || 'unknown',
 * }));
 *
 * // Or use manager directly
 * const manager = new RateLimitManager();
 * const result = await manager.checkLimit('user1', 'user', 'free');
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type {
  RateLimitAlgorithm,
  RateLimitScope,
  SubscriptionTier,
  TimeUnit,
  RateLimitDecision,
  RateLimitConfig,
  EndpointRateLimitConfig,
  TierConfig,
  RateLimitRule,
  RateLimitStats,
  RateLimitEvent,
  RateLimitAnalytics,
  QuotaStatus,
  RateLimitManagerOptions,
  RateLimitMiddlewareOptions,
  TokenBucketState,
  SlidingWindowState,
  RateLimitStorage,
  RateLimitResult,
  BurstConfig,
  RateLimitLogEntry,
  AggregationWindow,
} from './types';

// ============================================================================
// Algorithms
// ============================================================================

export {
  TokenBucketAlgorithm,
  SlidingWindowAlgorithm,
  FixedWindowAlgorithm,
  LeakyBucketAlgorithm,
  RateLimitAlgorithmFactory,
  HybridRateLimiter,
} from './algorithms';

// ============================================================================
// Manager
// ============================================================================

export {
  RateLimitManager,
  createRateLimitManager,
} from './manager';

// ============================================================================
// Advanced Quota Management
// ============================================================================

export {
  QuotaManager,
  createQuotaManager,
} from './quota';
export type {
  QuotaType,
  QuotaPeriod,
  QuotaConfig,
  QuotaManagerOptions,
  QuotaCheckResult,
} from './quota';

// ============================================================================
// Middleware
// ============================================================================

export {
  rateLimit,
  rateLimitByIP,
  rateLimitByUser,
  rateLimitHierarchical,
  rateLimitByTier,
  skipIfAdmin,
  skipIfPath,
  skipIfMethod,
  rateLimitErrorHandler,
  getRateLimitInfo,
  isRateLimited,
  createRateLimiter,
} from './middleware';

// ============================================================================
// Analytics
// ============================================================================

export {
  RateLimitAnalytics,
  createRateLimitAnalytics,
} from './analytics';
export type {
  AnalyticsWindow,
  AnalyticsOptions,
  AnalyticsDataPoint,
} from './analytics';

// ============================================================================
// Legacy Components (Backward Compatibility)
// ============================================================================

// Token Bucket (Legacy)
export {
  TokenBucket,
  createRateLimiterRPM,
  createRateLimiterTPM,
} from './token-bucket';
export type { TokenBucketOptions } from './token-bucket';

// Sliding Window (Legacy)
export {
  SlidingWindow,
  createRateLimiterRPM as createSlidingWindowRPM,
  createRateLimiterRPS as createSlidingWindowRPS,
} from './sliding-window';
export type { SlidingWindowOptions, SlidingWindowStats } from './sliding-window';

// Circuit Breaker
export {
  CircuitBreaker,
  createCircuitBreaker,
} from '../circuit-breaker';
export type {
  CircuitState,
  CircuitBreakerOptions,
  CircuitBreakerStats,
} from '../circuit-breaker';

// Retry
export {
  RetryPolicy,
  createAPIRetryPolicy,
  createQuickRetryPolicy,
  createLongRunningRetryPolicy,
  retry,
} from '../retry';
export type { RetryOptions, RetryResult } from '../retry';

// Legacy Quota Tracker (Provider-based)
export {
  QuotaTracker as LegacyQuotaTracker,
  createQuotaTracker as createLegacyQuotaTracker,
} from '../quota';
export type {
  ResetType,
  QuotaTrackerOptions,
  QuotaStats as LegacyQuotaStats,
} from '../quota';

// ============================================================================
// Durable Objects
// ============================================================================

export {
  RateLimitDO,
  RateLimitCoordinatorDO,
} from '../../do/rate-limit-do';
