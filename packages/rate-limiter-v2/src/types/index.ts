/**
 * Core types and interfaces for the rate limiting system
 */

/**
 * Available rate limiting algorithms
 */
export enum RateLimitAlgorithm {
  TOKEN_BUCKET = 'token_bucket',
  LEAKY_BUCKET = 'leaky_bucket',
  SLIDING_WINDOW = 'sliding_window',
  FIXED_WINDOW = 'fixed_window',
  ADAPTIVE = 'adaptive',
  CUSTOM = 'custom'
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for a rate limit
 */
export interface RateLimitConfig {
  algorithm: RateLimitAlgorithm;
  limit: number;
  window: number; // in milliseconds
  burst?: number; // for token bucket
  rate?: number; // for leaky bucket (tokens per ms)
  key?: string;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Storage backend types
 */
export enum StorageType {
  MEMORY = 'memory',
  DURABLE_OBJECTS = 'durable_objects',
  REDIS = 'redis',
  CUSTOM = 'custom'
}

/**
 * Storage backend configuration
 */
export interface StorageConfig {
  type: StorageType;
  prefix?: string;
  ttl?: number;
  durableObjectId?: string;
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
  };
  custom?: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown, ttl?: number) => Promise<void>;
    delete: (key: string) => Promise<void>;
    increment: (key: string, amount: number) => Promise<number>;
    expire: (key: string, ttl: number) => Promise<void>;
  };
}

/**
 * Rate limit key types
 */
export enum KeyType {
  IP = 'ip',
  USER = 'user',
  API_KEY = 'api_key',
  ENDPOINT = 'endpoint',
  RESOURCE = 'resource',
  CUSTOM = 'custom'
}

/**
 * Key generator configuration
 */
export interface KeyConfig {
  type: KeyType;
  prefix?: string;
  extractor?: (context: RateLimitContext) => Promise<string> | string;
}

/**
 * Context for rate limit checking
 */
export interface RateLimitContext {
  identifier: string;
  ip?: string;
  userId?: string;
  apiKey?: string;
  endpoint?: string;
  resource?: string;
  method?: string;
  headers?: Record<string, string>;
  metadata?: Record<string, unknown>;
  timestamp?: number;
}

/**
 * Hierarchical limit configuration
 */
export interface HierarchicalLimit {
  global?: RateLimitConfig;
  perUser?: RateLimitConfig;
  perResource?: RateLimitConfig;
  perEndpoint?: RateLimitConfig;
  perApiKey?: RateLimitConfig;
  custom?: Record<string, RateLimitConfig>;
}

/**
 * Adaptive throttling configuration
 */
export interface AdaptiveConfig {
  enabled: boolean;
  loadThreshold?: number; // CPU/memory usage threshold (0-1)
  performanceThreshold?: number; // Response time threshold in ms
  costThreshold?: number; // Cost threshold in credits
  adjustmentFactor?: number; // How much to adjust (0-1)
  minLimit?: number; // Minimum limit to allow
  maxLimit?: number; // Maximum limit to allow
  windowSize?: number; // Window for averaging metrics
}

/**
 * User tier for adaptive throttling
 */
export enum UserTier {
  FREE = 'free',
  BASIC = 'basic',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
  CUSTOM = 'custom'
}

/**
 * User tier configuration
 */
export interface UserTierConfig {
  tier: UserTier;
  baseLimit: number;
  burstMultiplier?: number;
  priority?: number; // Higher priority users get preferential treatment
  customLimits?: Record<string, number>;
}

/**
 * Distributed coordination configuration
 */
export interface DistributedConfig {
  enabled: boolean;
  syncInterval?: number; // Sync interval in ms
  leaderElection?: boolean;
  nodeId?: string;
  heartbeatInterval?: number;
  failureTimeout?: number;
  syncStrategy?: 'strong' | 'eventual' | 'hybrid';
}

/**
 * Metrics for rate limiting
 */
export interface RateLimitMetrics {
  totalRequests: number;
  allowedRequests: number;
  deniedRequests: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  currentUsage: number;
  peakUsage: number;
  algorithmMetrics: Record<string, unknown>;
}

/**
 * Performance metrics for adaptive throttling
 */
export interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
  timestamp: number;
}

/**
 * Cost tracking for rate limiting
 */
export interface CostMetrics {
  creditsUsed: number;
  creditsRemaining: number;
  costPerRequest: number;
  estimatedCost: number;
  billingCycle: {
    start: number;
    end: number;
  };
}

/**
 * Events emitted by the rate limiter
 */
export enum RateLimitEvent {
  CHECKED = 'checked',
  ALLOWED = 'allowed',
  DENIED = 'denied',
  EXCEEDED = 'exceeded',
  RESET = 'reset',
  ADJUSTED = 'adjusted',
  SYNCED = 'synced',
  ERROR = 'error'
}

/**
 * Event payload
 */
export interface RateLimitEventPayload {
  type: RateLimitEvent;
  context: RateLimitContext;
  result?: RateLimitResult;
  error?: Error;
  timestamp: number;
}

/**
 * Event listener
 */
export type EventListener = (payload: RateLimitEventPayload) => void | Promise<void>;

/**
 * State snapshot for distributed sync
 */
export interface StateSnapshot {
  version: number;
  timestamp: number;
  nodeId: string;
  state: Map<string, RateLimitState>;
}

/**
 * Generic rate limit state
 */
export interface RateLimitState {
  count: number;
  lastUpdate: number;
  windowStart?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Token bucket state
 */
export interface TokenBucketState extends RateLimitState {
  tokens: number;
  lastRefill: number;
}

/**
 * Leaky bucket state
 */
export interface LeakyBucketState extends RateLimitState {
  volume: number;
  lastLeak: number;
}

/**
 * Sliding window state
 */
export interface SlidingWindowState extends RateLimitState {
  requests: Array<{ timestamp: number; count: number }>;
}

/**
 * Fixed window state
 */
export interface FixedWindowState extends RateLimitState {
  windowStart: number;
  count: number;
}

/**
 * Rate limiter options
 */
export interface RateLimiterOptions {
  config: RateLimitConfig;
  storage?: StorageConfig;
  key?: KeyConfig;
  hierarchical?: HierarchicalLimit;
  adaptive?: AdaptiveConfig;
  distributed?: DistributedConfig;
  skipOnError?: boolean;
  onEvent?: EventListener;
}

/**
 * Distributed node information
 */
export interface NodeInfo {
  id: string;
  address: string;
  port: number;
  lastSeen: number;
  isLeader: boolean;
  role: 'leader' | 'follower' | 'candidate';
}

/**
 * Sync message for distributed coordination
 */
export interface SyncMessage {
  type: 'state_sync' | 'heartbeat' | 'election' | 'handoff';
  nodeId: string;
  timestamp: number;
  payload: unknown;
}

/**
 * Export all types
 */
export type {
  RateLimitResult,
  RateLimitConfig,
  StorageConfig,
  KeyConfig,
  RateLimitContext,
  HierarchicalLimit,
  AdaptiveConfig,
  UserTierConfig,
  DistributedConfig,
  RateLimitMetrics,
  PerformanceMetrics,
  CostMetrics,
  RateLimitEventPayload,
  EventListener,
  StateSnapshot,
  RateLimitState,
  TokenBucketState,
  LeakyBucketState,
  SlidingWindowState,
  FixedWindowState,
  RateLimiterOptions,
  NodeInfo,
  SyncMessage
};
