/**
 * Core CDN types and interfaces
 */

/**
 * Cache policy types
 */
export enum CachePolicy {
  PUBLIC = 'public',
  PRIVATE = 'private',
  NO_CACHE = 'no-cache',
  NO_STORE = 'no-store',
  MUST_REVALIDATE = 'must-revalidate',
  PROXY_REVALIDATE = 'proxy-revalidate'
}

/**
 * Cache levels
 */
export enum CacheLevel {
  EDGE = 'edge',
  BROWSER = 'browser',
  BOTH = 'both'
}

/**
 * Cache status
 */
export enum CacheStatus {
  HIT = 'hit',
  MISS = 'miss',
  STALE = 'stale',
  UPDATING = 'updating',
  BYPASS = 'bypass'
}

/**
 * Purge types
 */
export enum PurgeType {
  URL = 'url',
  TAG = 'tag',
  WILDCARD = 'wildcard',
  HOST = 'host',
  PREFIX = 'prefix'
}

/**
 * Purge status
 */
export enum PurgeStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIAL = 'partial'
}

/**
 * CDN providers
 */
export enum CDNProvider {
  CLOUDFLARE = 'cloudflare',
  AWS_CLOUDFRONT = 'aws_cloudfront',
  AZURE_CDN = 'azure_cdn',
  FASTLY = 'fastly',
  AKAMAI = 'akamai',
  VERIZON = 'verizon'
}

/**
 * Asset types
 */
export enum AssetType {
  IMAGE = 'image',
  JAVASCRIPT = 'javascript',
  CSS = 'css',
  FONT = 'font',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  OTHER = 'other'
}

/**
 * Optimization level
 */
export enum OptimizationLevel {
  NONE = 'none',
  BASIC = 'basic',
  STANDARD = 'standard',
  AGGRESSIVE = 'aggressive'
}

/**
 * Deployment status
 */
export enum DeploymentStatus {
  PENDING = 'pending',
  BUILDING = 'building',
  UPLOADING = 'uploading',
  DEPLOYING = 'deploying',
  SUCCESS = 'success',
  FAILED = 'failed',
  ROLLING_BACK = 'rolling_back',
  ROLLED_BACK = 'rolled_back'
}

/**
 * Cache policy configuration
 */
export interface ICachePolicy {
  name: string;
  policy: CachePolicy;
  ttl: number;
  staleWhileRevalidate?: number;
  staleIfError?: number;
  vary?: string[];
  mustRevalidate?: boolean;
  noTransform?: boolean;
  level: CacheLevel;
  tags?: string[];
  priority?: number;
}

/**
 * Cache rule
 */
export interface ICacheRule {
  id: string;
  pattern: string | RegExp;
  policy: ICachePolicy;
  conditions?: ICacheCondition[];
  enabled: boolean;
  priority: number;
}

/**
 * Cache condition
 */
export interface ICacheCondition {
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'startsWith' | 'endsWith' | 'exists';
  value?: string | RegExp;
  caseSensitive?: boolean;
}

/**
 * Cache entry
 */
export interface ICacheEntry {
  key: string;
  url: string;
  status: CacheStatus;
  ttl: number;
  age: number;
  size: number;
  tags: string[];
  contentType: string;
  lastAccessed: Date;
  createdAt: Date;
  expiresAt: Date;
  metadata: Record<string, any>;
}

/**
 * Cache statistics
 */
export interface ICacheStats {
  hits: number;
  misses: number;
  staleHits: number;
  bypasses: number;
  hitRate: number;
  missRate: number;
  avgResponseTime: number;
  totalBandwidth: number;
  savedBandwidth: number;
  compressionRatio: number;
}

/**
 * Purge request
 */
export interface IPurgeRequest {
  id: string;
  type: PurgeType;
  targets: string[];
  tags?: string[];
  status: PurgeStatus;
  createdAt: Date;
  completedAt?: Date;
  progress: number;
  errors: Array<{
    target: string;
    error: string;
  }>;
}

/**
 * Purge result
 */
export interface IPurgeResult {
  requestId: string;
  success: boolean;
  purged: number;
  failed: number;
  duration: number;
  errors: string[];
}

/**
 * Asset optimization options
 */
export interface IAssetOptimization {
  type: AssetType;
  level: OptimizationLevel;
  compress?: boolean;
  minify?: boolean;
  transform?: boolean;
  quality?: number;
  format?: string;
  dimensions?: {
    width?: number;
    height?: number;
  };
  options?: Record<string, any>;
}

/**
 * Optimized asset result
 */
export interface IOptimizedAsset {
  original: {
    size: number;
    type: string;
    url: string;
  };
  optimized: {
    size: number;
    type: string;
    url: string;
  };
  savings: {
    bytes: number;
    percentage: number;
  };
  duration: number;
  metadata: Record<string, any>;
}

/**
 * Edge function config
 */
export interface IEdgeFunction {
  name: string;
  content: string;
  type: 'worker' | 'function' | 'middleware';
  routes: string[];
  environment: Record<string, string>;
  bindings: IEdgeBinding[];
  enabled: boolean;
}

/**
 * Edge binding
 */
export interface IEdgeBinding {
  type: 'kv' | 'durable_object' | 'r2' | 'd1' | 'secret' | 'wasm';
  name: string;
  resource: string;
}

/**
 * Deployment config
 */
export interface IDeploymentConfig {
  id: string;
  version: string;
  functions: IEdgeFunction[];
  assets: IAssetDeployment[];
  routes: IRouteConfig[];
  environment: Record<string, string>;
  strategy: 'rolling' | 'blue_green' | 'canary';
  canaryPercentage?: number;
  rolloutConfig?: IRolloutConfig;
}

/**
 * Asset deployment
 */
export interface IAssetDeployment {
  path: string;
  content: string | Buffer;
  contentType: string;
  optimized?: boolean;
  cachePolicy?: string;
}

/**
 * Route config
 */
export interface IRouteConfig {
  pattern: string;
  functionName?: string;
  cachePolicy?: string;
  rateLimit?: number;
  cors?: boolean;
  headers?: Record<string, string>;
}

/**
 * Rollout config
 */
export interface IRolloutConfig {
  stages: Array<{
    percentage: number;
    duration: number;
    metrics?: string[];
  }>;
  monitoringWindow: number;
  rollbackThreshold: number;
  healthCheckPath?: string;
}

/**
 * Deployment result
 */
export interface IDeploymentResult {
  deploymentId: string;
  status: DeploymentStatus;
  version: string;
  url: string;
  deployedAt: Date;
  functions: number;
  assets: number;
  routes: number;
  duration: number;
  errors: Array<{
    resource: string;
    error: string;
  }>;
}

/**
 * CDN analytics metrics
 */
export interface ICDNAnalytics {
  requests: {
    total: number;
    cached: number;
    uncached: number;
    byCountry: Record<string, number>;
    byDevice: Record<string, number>;
  };
  bandwidth: {
    total: number;
    cached: number;
    uncached: number;
    saved: number;
  };
  performance: {
    avgResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
  };
  popularity: {
    topPaths: Array<{
      path: string;
      requests: number;
      bandwidth: number;
    }>;
    topTags: Array<{
      tag: string;
      requests: number;
    }>;
  };
  security: {
    threatsBlocked: number;
    rateLimitExceeded: number;
    suspiciousIPs: number;
  };
}

/**
 * Multi-CDN configuration
 */
export interface IMultiCDNConfig {
  primary: CDNProvider;
  fallback?: CDNProvider[];
  strategy: 'round_robin' | 'weighted' | 'geographic' | 'performance';
  weights?: Map<CDNProvider, number>;
  healthCheck?: IHealthCheckConfig;
  failoverThreshold?: number;
}

/**
 * Health check config
 */
export interface IHealthCheckConfig {
  interval: number;
  timeout: number;
  unhealthyThreshold: number;
  healthyThreshold: number;
  path: string;
  expectedStatus: number;
}

/**
 * CDN provider status
 */
export interface IProviderStatus {
  provider: CDNProvider;
  healthy: boolean;
  responseTime: number;
  lastCheck: Date;
  consecutiveFailures: number;
}

/**
 * CDN request context
 */
export interface IRequestContext {
  url: string;
  method: string;
  headers: Record<string, string>;
  ip?: string;
  country?: string;
  device?: string;
  userAgent?: string;
  referer?: string;
}

/**
 * CDN response
 */
export interface ICDNResponse {
  status: number;
  headers: Record<string, string>;
  body: string | Buffer;
  fromCache: boolean;
  cacheKey?: string;
  provider: CDNProvider;
  responseTime: number;
}

/**
 * CDN configuration
 */
export interface ICDNConfig {
  provider: CDNProvider | IMultiCDNConfig;
  zoneId?: string;
  accountId?: string;
  apiKey?: string;
  apiEmail?: string;
  cachePolicies: ICachePolicy[];
  cacheRules: ICacheRule[];
  optimization?: IAssetOptimization;
  edgeFunctions?: IEdgeFunction[];
  analytics?: boolean;
  debug?: boolean;
}

/**
 * Cache hierarchy level
 */
export interface ICacheHierarchyLevel {
  name: string;
  priority: number;
  ttl: number;
  maxSize: number;
  evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'random';
}

/**
 * Cache hierarchy
 */
export interface ICacheHierarchy {
  levels: ICacheHierarchyLevel[];
  enabled: boolean;
  cascade: boolean;
}

/**
 * Bypass rule
 */
export interface IBypassRule {
  id: string;
  pattern: string | RegExp;
  reason: string;
  enabled: boolean;
  priority: number;
}

/**
 * Invalidator options
 */
export interface IInvalidatorOptions {
  batchSize?: number;
  maxConcurrent?: number;
  retryAttempts?: number;
  retryDelay?: number;
  timeout?: number;
  progressCallback?: (progress: number) => void;
}

/**
 * Optimizer options
 */
export interface IOptimizerOptions {
  parallelism?: number;
  cacheDir?: string;
  tempDir?: string;
  maxFileSize?: number;
  timeout?: number;
}

/**
 * Deployer options
 */
export interface IDeployerOptions {
  dryRun?: boolean;
  skipTests?: boolean;
  skipOptimization?: boolean;
  verbose?: boolean;
  rollbackOnError?: boolean;
  progressCallback?: (stage: string, progress: number) => void;
}

/**
 * A/B test config
 */
export interface IABTestConfig {
  name: string;
  variants: Array<{
    name: string;
    weight: number;
    config: Record<string, any>;
  }>;
  criteria: string;
  duration?: number;
  metrics: string[];
}

/**
 * CDN event types
 */
export enum CDNEventType {
  CACHE_HIT = 'cache_hit',
  CACHE_MISS = 'cache_miss',
  PURGE_START = 'purge_start',
  PURGE_COMPLETE = 'purge_complete',
  DEPLOYMENT_START = 'deployment_start',
  DEPLOYMENT_COMPLETE = 'deployment_complete',
  ERROR = 'error',
  THREAT_DETECTED = 'threat_detected'
}

/**
 * CDN event
 */
export interface ICDNEvent {
  type: CDNEventType;
  timestamp: Date;
  data: Record<string, any>;
  source?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Geo IP info
 */
export interface IGeoInfo {
  country: string;
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  asn?: number;
  timezone?: string;
}

/**
 * Cache metrics configuration
 */
export interface ICacheMetricsConfig {
  retentionPeriod: number;
  sampleInterval: number;
  enableRealTime: boolean;
  enableHistorical: boolean;
  aggregationWindow: number;
}

/**
 * Cache metrics snapshot
 */
export interface ICacheMetricsSnapshot {
  timestamp: Date;
  hits: number;
  misses: number;
  staleHits: number;
  bypasses: number;
  totalResponseTime: number;
  responseTimes: number[];
  totalBandwidth: number;
  savedBandwidth: number;
}

/**
 * Cache metrics report
 */
export interface ICacheMetricsReport {
  timestamp: Date;
  period: {
    start: Date;
    end: Date;
  };
  stats: ICacheStats;
  performance: {
    p50: number;
    p95: number;
    p99: number;
  };
  trends: {
    hitRate: number;
    responseTime: number;
    bandwidth: number;
  };
  alerts: string[];
}

/**
 * Cache warmer configuration
 */
export interface ICacheWarmerConfig {
  concurrency: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  strategy: 'popularity' | 'size' | 'alphabetical' | 'random';
  enableProgressReporting: boolean;
  prioritizeBy: 'access_frequency' | 'size' | 'recency';
}

/**
 * Cache warmer result
 */
export interface ICacheWarmerResult {
  success: boolean;
  total: number;
  succeeded: number;
  failed: number;
  duration: number;
  errors: Array<{
    url: string;
    error: string;
  }>;
  throughput: number;
}

/**
 * Warmup strategy
 */
export interface IWarmupStrategy {
  prioritize: (urls: string[]) => Promise<string[]>;
}
