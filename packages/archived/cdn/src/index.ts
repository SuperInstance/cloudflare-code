/**
 * ClaudeFlare CDN Package
 *
 * Advanced CDN integration with Cloudflare support.
 *
 * @packageDocumentation
 */

// Cache module
export {
  CacheController,
  CacheMetrics,
  CacheWarmer
} from './cache/index.js';

export type {
  ICachePolicy,
  ICacheRule,
  ICacheCondition,
  ICacheEntry,
  ICacheStats,
  ICacheHierarchy,
  IBypassRule
} from './types/index.js';

// Invalidation module
export {
  InvalidationEngine,
  PurgeScheduler,
  PurgeTracker
} from './invalidation/index.js';

export type {
  IPurgeRequest,
  IPurgeResult,
  PurgeType,
  PurgeStatus,
  IInvalidatorOptions
} from './types/index.js';

// Optimizer module
export {
  AssetOptimizer,
  BundleOptimizer,
  ImageOptimizer
} from './optimizer/index.js';

export type {
  IAssetOptimization,
  IOptimizedAsset,
  AssetType,
  OptimizationLevel,
  IOptimizerOptions
} from './types/index.js';

// Edge module
export {
  EdgeDeployer,
  EdgeRouter,
  EdgeMonitor
} from './edge/index.js';

export type {
  IEdgeFunction,
  IDeploymentConfig,
  IDeploymentResult,
  DeploymentStatus,
  IRouteConfig,
  IAssetDeployment,
  IDeployerOptions,
  IABTestConfig,
  IRolloutConfig
} from './types/index.js';

// Analytics module
export {
  CDNAnalytics,
  AnalyticsReporter
} from './analytics/index.js';

export type {
  ICDNAnalytics,
  CDNEventType,
  ICDNEvent
} from './types/index.js';

// Multi-CDN module
export {
  MultiCDNProvider,
  CDNLoadBalancer
} from './multi-cdn/index.js';

export type {
  IMultiCDNConfig,
  IHealthCheckConfig,
  IProviderStatus
} from './types/index.js';

// Types
export type {
  CachePolicy,
  CacheLevel,
  CacheStatus,
  CDNProvider,
  IRequestContext,
  ICDNResponse,
  ICDNConfig,
  IGeoInfo
} from './types/index.js';

// Utilities
export {
  parseRequestContext,
  parseCloudflareHeaders,
  generateCacheKey,
  parseRangeHeader,
  generateContentRangeHeader,
  isConditionalRequest,
  parseAcceptEncoding,
  determineBestEncoding,
  calculateAge,
  parseCacheControl,
  generateCacheControlHeader,
  isValidURL,
  normalizeURL,
  extractDomain,
  isAbsoluteURL,
  resolveURL,
  calculateTTL,
  parseETag,
  generateFingerprint,
  formatBytes,
  formatDuration,
  sleep,
  retry,
  debounce,
  throttle,
  withTimeout
} from './utils/index.js';

// Main CDN class
export { CDN } from './cdn.js';
