/**
 * @claudeflare/rate-limiter-v2
 *
 * Advanced distributed rate limiting for ClaudeFlare with multi-algorithm support
 * and adaptive throttling.
 *
 * @example
 * ```typescript
 * import { RateLimiter, RateLimitAlgorithm } from '@claudeflare/rate-limiter-v2';
 *
 * const limiter = new RateLimiter({
 *   config: {
 *     algorithm: RateLimitAlgorithm.SLIDING_WINDOW,
 *     limit: 100,
 *     window: 60000
 *   }
 * });
 *
 * const result = await limiter.check({
 *   identifier: 'user-123',
 *   endpoint: '/api/users'
 * });
 *
 * if (result.allowed) {
 *   // Process request
 * } else {
 *   // Rate limit exceeded
 * }
 * ```
 */

// Main rate limiter
export { RateLimiter } from './rate-limiter.js';

// Types
export {
  RateLimitAlgorithm,
  type RateLimitResult,
  type RateLimitConfig,
  type StorageConfig,
  type KeyConfig,
  type RateLimitContext,
  type HierarchicalLimit,
  type AdaptiveConfig,
  type UserTier,
  type UserTierConfig,
  type DistributedConfig,
  type RateLimitMetrics,
  type PerformanceMetrics,
  type CostMetrics,
  type RateLimitEvent,
  type RateLimitEventPayload,
  type EventListener,
  type StateSnapshot,
  type RateLimitState,
  type TokenBucketState,
  type LeakyBucketState,
  type SlidingWindowState,
  type FixedWindowState,
  type RateLimiterOptions,
  type NodeInfo,
  type SyncMessage
} from './types/index.js';

// Algorithms
export {
  TokenBucketAlgorithm,
  LeakyBucketAlgorithm,
  SlidingWindowAlgorithm,
  FixedWindowAlgorithm,
  AlgorithmEngine,
  algorithmEngine,
  type CustomAlgorithm
} from './algorithms/index.js';

// Storage
export {
  createStorage,
  MemoryStorage,
  RedisStorage,
  DurableObjectsStorage,
  RateLimiterDurableObject,
  type StorageBackend
} from './storage/index.js';

// Distributed
export {
  DistributedRateLimiter,
  type DistributedLimiterConfig
} from './distributed/limiter.js';

// Hierarchy
export {
  HierarchyManager,
  LimitPriority,
  type HierarchyManagerConfig
} from './hierarchy/manager.js';

// Adaptive
export {
  AdaptiveThrottler,
  type LoadThrottlingConfig,
  type PerformanceThrottlingConfig,
  type CostThrottlingConfig
} from './adaptive/throttler.js';

// Middleware
export {
  expressMiddleware,
  ipRateLimiter,
  userRateLimiter,
  apiKeyRateLimiter,
  endpointRateLimiter,
  fastifyRateLimiter,
  createFastifyIpRateLimiter,
  createFastifyUserRateLimiter,
  createFastifyApiKeyRateLimiter,
  workersMiddleware,
  createWorkersIpRateLimiter,
  createWorkersApiKeyRateLimiter,
  createCountryRateLimiter,
  createColoRateLimiter,
  withRateLimit,
  type ExpressMiddlewareOptions,
  type FastifyMiddlewareOptions,
  type WorkersMiddlewareOptions
} from './middleware/index.js';

// Version
export const VERSION = '2.0.0' as const;
