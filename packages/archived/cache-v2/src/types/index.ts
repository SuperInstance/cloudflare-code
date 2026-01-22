/**
 * Core types for the multi-tier caching system
 */

// ============================================================================
// Cache Entry Types
// ============================================================================

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  metadata: CacheMetadata;
  tiers: TierInfo;
}

export interface CacheMetadata {
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  size: number;
  compressed: boolean;
  tags: string[];
  version: number;
}

export interface TierInfo {
  currentTier: CacheTier;
  tierHistory: TierTransition[];
  promotionCount: number;
  demotionCount: number;
}

export interface TierTransition {
  from: CacheTier;
  to: CacheTier;
  timestamp: number;
  reason: TransitionReason;
}

export type TransitionReason =
  | 'access_frequency'
  | 'size_constraints'
  | 'ttl_expiry'
  | 'manual'
  | 'capacity_pressure'
  | 'cold_start';

// ============================================================================
// Cache Tier Definitions
// ============================================================================

export enum CacheTier {
  L1 = 'L1', // Durable Object memory (fastest)
  L2 = 'L2', // KV (fast)
  L3 = 'L3', // R2 (cold storage)
}

export interface TierConfig {
  tier: CacheTier;
  maxSize: number;
  maxEntries: number;
  ttl: number;
  compressionEnabled: boolean;
  priority: number;
}

export interface TierCapabilities {
  readLatency: number;
  writeLatency: number;
  supportsCompression: boolean;
  supportsTTL: boolean;
  supportsTags: boolean;
}

// ============================================================================
// Cache Operation Types
// ============================================================================

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  compress?: boolean;
  tier?: CacheTier;
  skipPrefetch?: boolean;
  priority?: number;
}

export interface CacheResult<T> {
  hit: boolean;
  value: T | null;
  tier: CacheTier | null;
  latency: number;
  metadata: CacheMetadata | null;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
  tierDistribution: TierStats;
  latencyStats: LatencyStats;
  sizeStats: SizeStats;
}

export interface TierStats {
  L1: { hits: number; misses: number; size: number };
  L2: { hits: number; misses: number; size: number };
  L3: { hits: number; misses: number; size: number };
}

export interface LatencyStats {
  L1: { min: number; max: number; avg: number; p50: number; p95: number; p99: number };
  L2: { min: number; max: number; avg: number; p50: number; p95: number; p99: number };
  L3: { min: number; max: number; avg: number; p50: number; p95: number; p99: number };
}

export interface SizeStats {
  total: number;
  L1: number;
  L2: number;
  L3: number;
  compressionRatio: number;
}

// ============================================================================
// Cache Warming Types
// ============================================================================

export interface WarmupStrategy {
  type: 'predictive' | 'scheduled' | 'event-driven' | 'hybrid';
  config: WarmupConfig;
  schedule?: ScheduleConfig;
}

export interface WarmupConfig {
  enabled: boolean;
  concurrency: number;
  batchSize: number;
  maxEntries: number;
  priority: 'high' | 'medium' | 'low';
  sourceTier: CacheTier;
}

export interface ScheduleConfig {
  type: 'cron' | 'interval' | 'event';
  expression?: string;
  interval?: number;
  event?: string;
  timezone?: string;
}

export interface WarmupPrediction {
  key: string;
  probability: number;
  reason: string;
  predictedAccess: number;
  confidence: number;
}

export interface WarmupResult {
  success: boolean;
  warmedKeys: string[];
  failedKeys: string[];
  duration: number;
  bytesTransferred: number;
}

// ============================================================================
// Cache Invalidation Types
// ============================================================================

export interface InvalidationStrategy {
  type: 'ttl' | 'tag' | 'hierarchical' | 'manual';
  config: InvalidationConfig;
}

export interface InvalidationConfig {
  propagateToAllTiers: boolean;
  backgroundProcessing: boolean;
  batchSize: number;
  retries: number;
  retryDelay: number;
}

export interface InvalidationEvent {
  type: 'invalidate' | 'expire' | 'evict' | 'update';
  key: string;
  tags?: string[];
  timestamp: number;
  source: string;
  propagate: boolean;
}

export interface InvalidationResult {
  success: boolean;
  invalidatedKeys: string[];
  affectedTiers: CacheTier[];
  duration: number;
}

// ============================================================================
// Prefetch Types
// ============================================================================

export interface PrefetchPrediction {
  key: string;
  probability: number;
  urgency: number;
  reason: string;
  timestamp: number;
}

export interface PrefetchConfig {
  enabled: boolean;
  maxConcurrent: number;
  maxBytes: number;
  threshold: number;
  strategy: PrefetchStrategy;
  learningEnabled: boolean;
}

export type PrefetchStrategy =
  | 'pattern-based'
  | 'ml-based'
  | 'collaborative'
  | 'sequential'
  | 'hybrid';

export interface PrefetchResult {
  success: boolean;
  prefetchedKeys: string[];
  skippedKeys: string[];
  duration: number;
  bytesTransferred: number;
}

// ============================================================================
// Compression Types
// ============================================================================

export interface CompressionConfig {
  algorithm: 'gzip' | 'brotli' | 'lz4' | 'none';
  threshold: number;
  level: number;
  enabled: boolean;
}

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  ratio: number;
  algorithm: string;
  duration: number;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface AnalyticsData {
  accessPatterns: AccessPattern[];
  hotKeys: HotKeyEntry[];
  coldKeys: ColdKeyEntry[];
  tierMovements: TierMovementEntry[];
  predictions: PredictionAccuracy;
}

export interface AccessPattern {
  key: string;
  accessCount: number;
  lastAccess: number;
  firstAccess: number;
  frequency: number;
  pattern: 'sequential' | 'random' | 'periodic' | 'burst';
}

export interface HotKeyEntry {
  key: string;
  score: number;
  trend: 'rising' | 'stable' | 'falling';
  currentTier: CacheTier;
  recommendedTier: CacheTier;
}

export interface ColdKeyEntry {
  key: string;
  lastAccess: number;
  size: number;
  tier: CacheTier;
}

export interface TierMovementEntry {
  key: string;
  from: CacheTier;
  to: CacheTier;
  timestamp: number;
  reason: string;
}

export interface PredictionAccuracy {
  prefetch: { correct: number; total: number; accuracy: number };
  warmup: { correct: number; total: number; accuracy: number };
  eviction: { correct: number; total: number; accuracy: number };
}

// ============================================================================
// Error Types
// ============================================================================

export class CacheError extends Error {
  constructor(
    message: string,
    public code: string,
    public tier?: CacheTier,
    public key?: string
  ) {
    super(message);
    this.name = 'CacheError';
  }
}

export class TierUnavailableError extends CacheError {
  constructor(tier: CacheTier, message?: string) {
    super(message || `Tier ${tier} is unavailable`, 'TIER_UNAVAILABLE', tier);
    this.name = 'TierUnavailableError';
  }
}

export class SerializationError extends CacheError {
  constructor(key: string, message?: string) {
    super(message || `Failed to serialize key ${key}`, 'SERIALIZATION_ERROR', undefined, key);
    this.name = 'SerializationError';
  }
}

export class DeserializationError extends CacheError {
  constructor(key: string, message?: string) {
    super(message || `Failed to deserialize key ${key}`, 'DESERIALIZATION_ERROR', undefined, key);
    this.name = 'DeserializationError';
  }
}

export class CacheCapacityError extends CacheError {
  constructor(tier: CacheTier, message?: string) {
    super(message || `Tier ${tier} is at capacity`, 'CACHE_CAPACITY_ERROR', tier);
    this.name = 'CacheCapacityError';
  }
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface MultiTierCacheConfig {
  tiers: {
    L1: TierConfig;
    L2: TierConfig;
    L3: TierConfig;
  };
  warming: WarmupStrategy;
  invalidation: InvalidationStrategy;
  prefetch: PrefetchConfig;
  compression: CompressionConfig;
  analytics: {
    enabled: boolean;
    retentionDays: number;
    sampleRate: number;
  };
  metrics: {
    enabled: boolean;
    exportInterval: number;
  };
}

export interface CacheContext {
  env: {
    CACHE_DO?: DurableObjectNamespace;
    CACHE_KV?: KVNamespace;
    CACHE_R2?: R2Bucket;
  };
  requestId?: string;
  userId?: string;
  sessionId?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Nullable<T> = T | null;

export type Dict<T> = Record<string, T>;

export type AsyncFunction<T> = (...args: any[]) => Promise<T>;
