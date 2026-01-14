/**
 * Core type definitions for ClaudeFlare Edge Cache Optimization System
 */

import { Schema } from 'zod';

// ============================================================================
// Cache Tier Types
// ============================================================================

export type CacheTier = 'hot' | 'warm' | 'cold' | 'browser';
export type CacheLevel = 'L1' | 'L2' | 'L3' | 'L4'; // L1: Browser, L2: Edge, L3: Origin, L4: Database

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  metadata: CacheMetadata;
  tier: CacheTier;
  compressed: boolean;
  encoded: boolean;
}

export interface CacheMetadata {
  createdAt: number;
  updatedAt: number;
  accessedAt: number;
  accessCount: number;
  ttl: number;
  maxAge: number;
  staleWhileRevalidate: number;
  tags: string[];
  size: number;
  checksum: string;
  version: number;
  etag?: string;
  lastModified?: string;
}

export interface CacheStats {
  tier: CacheTier;
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
  evictions: number;
  size: number;
  entryCount: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
}

export interface CacheConfig {
  hot: {
    maxSize: number;
    maxEntries: number;
    ttl: number;
    cleanupInterval: number;
  };
  warm: {
    maxSize: number;
    maxEntries: number;
    ttl: number;
    cleanupInterval: number;
  };
  cold: {
    maxSize: number;
    maxEntries: number;
    ttl: number;
    cleanupInterval: number;
  };
  browser: {
    enabled: boolean;
    ttl: number;
    staleWhileRevalidate: number;
  };
}

// ============================================================================
// Warming Types
// ============================================================================

export interface WarmingStrategy {
  type: 'popular' | 'time-based' | 'user-based' | 'geographic' | 'api-endpoint' | 'hybrid';
  priority: number;
  enabled: boolean;
  config: WarmingConfig;
}

export interface WarmingConfig {
  threshold: number;
  concurrency: number;
  batchSize: number;
  interval: number;
  retryAttempts: number;
  backoffMultiplier: number;
}

export interface PopularContentPattern {
  url: string;
  method: string;
  accessCount: number;
  lastAccess: number;
  trend: 'rising' | 'stable' | 'falling';
  score: number;
  parameters?: Record<string, unknown>;
}

export interface TimeBasedSchedule {
  id: string;
  name: string;
  cron: string;
  urls: string[];
  enabled: boolean;
  timezone: string;
  lastRun: number;
  nextRun: number;
}

export interface UserSegment {
  id: string;
  name: string;
  criteria: UserSegmentCriteria;
  warmUrls: string[];
  priority: number;
}

export interface UserSegmentCriteria {
  geography?: string[];
  userAgent?: string[];
  role?: string[];
  custom?: Record<string, unknown>;
}

export interface GeographicRegion {
  country: string;
  region?: string;
  city?: string;
  datacenter: string;
  warmUrls: string[];
  priority: number;
}

export interface ApiEndpointPattern {
  path: string;
  method: string;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  frequency: number;
  lastCalled: number;
}

export interface WarmingTask {
  id: string;
  type: string;
  url: string;
  method: string;
  priority: number;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startedAt?: number;
  completedAt?: number;
  attempts: number;
  error?: string;
}

export interface WarmingResult {
  taskId: string;
  success: boolean;
  duration: number;
  cached: boolean;
  cacheKey: string;
  tier: CacheTier;
  size: number;
  metadata: Partial<CacheMetadata>;
}

// ============================================================================
// Prediction Types
// ============================================================================

export interface PredictionModel {
  id: string;
  name: string;
  type: 'ml-based' | 'behavioral' | 'pattern' | 'collaborative';
  version: string;
  accuracy: number;
  lastTrained: number;
  enabled: boolean;
}

export interface PredictionRequest {
  userId?: string;
  sessionId?: string;
  currentUrl: string;
  context: PredictionContext;
  limit: number;
}

export interface PredictionContext {
  userAgent: string;
  referrer?: string;
  timestamp: number;
  geography: string;
  device: string;
  custom?: Record<string, unknown>;
}

export interface PredictionResult {
  url: string;
  probability: number;
  reason: string;
  confidence: number;
  category: string;
  priority: number;
}

export interface UserBehavior {
  userId?: string;
  sessionId: string;
  history: AccessPattern[];
  preferences: UserPreferences;
  predictions: PredictionResult[];
}

export interface AccessPattern {
  url: string;
  timestamp: number;
  duration: number;
  referrer?: string;
  method: string;
  status: number;
}

export interface UserPreferences {
  preferredCategories: string[];
  preferredPaths: string[];
  timePreferences: Record<string, number>; // hour of day -> access count
  devicePreferences: Record<string, number>;
}

export interface SequentialPattern {
  sequence: string[];
  support: number;
  confidence: number;
  lift: number;
  lastSeen: number;
}

export interface CollaborativeFilteringResult {
  similarUsers: string[];
  recommendedUrls: string[];
  scores: number[];
}

// ============================================================================
// Rendering Types
// ============================================================================

export interface RenderStrategy {
  type: 'ssr' | 'ssg' | 'isr' | 'streaming' | 'hybrid';
  priority: number;
  enabled: boolean;
  config: RenderConfig;
}

export interface RenderConfig {
  timeout: number;
  maxRetries: number;
  fallbackStrategy: 'static' | 'error' | 'stale';
  cacheStrategy: CacheStrategy;
}

export interface CacheStrategy {
  enabled: boolean;
  tier: CacheTier;
  ttl: number;
  staleWhileRevalidate: number;
  purgeKey?: string;
}

export interface RenderRequest {
  url: string;
  method: string;
  headers: Headers;
  body?: string;
  query: Record<string, string>;
  cookies: Record<string, string>;
  context: RenderContext;
}

export interface RenderContext {
  userId?: string;
  sessionId?: string;
  device: string;
  geography: string;
  timestamp: number;
  custom?: Record<string, unknown>;
}

export interface RenderResult {
  content: string;
  status: number;
  headers: Headers;
  metadata: RenderMetadata;
  cached: boolean;
  duration: number;
}

export interface RenderMetadata {
  strategy: RenderStrategy['type'];
  generatedAt: number;
  expiresAt: number;
  cacheKey: string;
  tags: string[];
  size: number;
  compressed: boolean;
}

export interface SsgConfig {
  paths: string[];
  revalidate: number;
  fallback: boolean;
  generateInterval: number;
}

export interface IsrConfig {
  revalidate: number;
  regenerateOnDemand: boolean;
  fallbackPages: string[];
}

export interface StreamingConfig {
  chunkSize: number;
  flushInterval: number;
  shellCache: boolean;
  dataCacheTtl: number;
}

export interface HybridConfig {
  staticPaths: string[];
  dynamicPaths: string[];
  threshold: number;
  cacheStrategy: CacheStrategy;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface CacheAnalytics {
  timestamp: number;
  period: AnalyticsPeriod;
  metrics: CacheMetrics;
  insights: CacheInsight[];
  recommendations: CacheRecommendation[];
}

export type AnalyticsPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly';

export interface CacheMetrics {
  overall: OverallMetrics;
  byTier: Record<CacheTier, TierMetrics>;
  byFeature: Record<string, FeatureMetrics>;
  byEndpoint: Record<string, EndpointMetrics>;
  byGeography: Record<string, GeographyMetrics>;
}

export interface OverallMetrics {
  hitRate: number;
  totalRequests: number;
  totalHits: number;
  totalMisses: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  bandwidthSaved: number;
  costSaved: number;
  tokensSaved: number;
}

export interface TierMetrics {
  hitRate: number;
  totalRequests: number;
  hits: number;
  misses: number;
  avgLatency: number;
  size: number;
  entryCount: number;
  evictionCount: number;
  evictionRate: number;
  avgEntrySize: number;
  utilizationRate: number;
}

export interface FeatureMetrics {
  hitRate: number;
  totalRequests: number;
  avgLatency: number;
  size: number;
  entryCount: number;
}

export interface EndpointMetrics {
  hitRate: number;
  totalRequests: number;
  avgLatency: number;
  size: number;
  popularity: number;
  trend: 'rising' | 'stable' | 'falling';
}

export interface GeographyMetrics {
  hitRate: number;
  totalRequests: number;
  avgLatency: number;
  closestDatacenter: string;
}

export interface CacheInsight {
  type: 'performance' | 'cost' | 'usage' | 'anomaly';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  metric: string;
  value: number;
  threshold?: number;
  timestamp: number;
}

export interface CacheRecommendation {
  type: 'ttl' | 'size' | 'warming' | 'invalidation' | 'routing';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  action: string;
  expectedImpact: string;
  estimatedSavings?: number;
}

export interface AnalyticsDashboard {
  summary: AnalyticsSummary;
  charts: DashboardChart[];
  tables: DashboardTable[];
  alerts: AnalyticsAlert[];
}

export interface AnalyticsSummary {
  period: AnalyticsPeriod;
  hitRate: number;
  totalRequests: number;
  avgLatency: number;
  costSaved: number;
  bandwidthSaved: number;
  topInsights: string[];
}

export interface DashboardChart {
  id: string;
  type: 'line' | 'bar' | 'pie' | 'heatmap' | 'gauge';
  title: string;
  data: ChartData;
  config: ChartConfig;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  color?: string;
  type?: string;
}

export interface ChartConfig {
  xAxis?: string;
  yAxis?: string;
  stacked?: boolean;
  normalized?: boolean;
  groupBy?: string;
}

export interface DashboardTable {
  id: string;
  title: string;
  columns: TableColumn[];
  rows: TableRow[];
  sortable?: boolean;
  filterable?: boolean;
}

export interface TableColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'percentage' | 'duration';
  sortable?: boolean;
}

export interface TableRow {
  [key: string]: string | number;
}

export interface AnalyticsAlert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

// ============================================================================
// Coordination Types
// ============================================================================

export interface CacheHierarchy {
  levels: CacheLevel[];
  fallbackOrder: CacheLevel[];
  propagationRules: PropagationRule[];
  consistencyModel: ConsistencyModel;
}

export type ConsistencyModel = 'strong' | 'eventual' | 'weak';

export interface PropagationRule {
  from: CacheLevel;
  to: CacheLevel;
  condition: PropagationCondition;
  action: PropagationAction;
}

export type PropagationCondition = 'on-write' | 'on-read' | 'scheduled' | 'manual';

export type PropagationAction = 'copy' | 'move' | 'invalidate' | 'refresh';

export interface CacheCoordinatorMessage {
  type: CoordinatorMessageType;
  source: CacheLevel;
  target?: CacheLevel;
  key: string;
  data?: unknown;
  timestamp: number;
  id: string;
}

export type CoordinatorMessageType =
  | 'get'
  | 'set'
  | 'delete'
  | 'invalidate'
  | 'propagate'
  | 'sync'
  | 'ping';

export interface CoordinationResult {
  success: boolean;
  source: CacheLevel;
  hits: CacheLevel[];
  misses: CacheLevel[];
  latency: number;
  propagated: boolean;
  consistent: boolean;
}

export interface CacheEntryDistribution {
  key: string;
  distribution: Record<CacheLevel, boolean>;
  primary: CacheLevel;
  staleVersions: number;
  lastSynced: number;
}

export interface InvalidationPropagation {
  key: string;
  source: CacheLevel;
  targets: CacheLevel[];
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  errors: string[];
}

// ============================================================================
// Invalidation Types
// ============================================================================

export interface InvalidationStrategy {
  type: InvalidationType;
  priority: number;
  enabled: boolean;
  config: InvalidationConfig;
}

export type InvalidationType =
  | 'time-based'
  | 'event-based'
  | 'tag-based'
  | 'pattern-based'
  | 'cascade'
  | 'selective'
  | 'purge-all';

export interface InvalidationConfig {
  cascade: boolean;
  propagate: boolean;
  confirm: boolean;
  retryAttempts: number;
  timeout: number;
}

export interface InvalidationRequest {
  keys?: string[];
  tags?: string[];
  pattern?: string;
  purgeAll?: boolean;
  reason?: string;
  priority: number;
  strategy: InvalidationType;
}

export interface InvalidationResult {
  success: boolean;
  keysInvalidated: number;
  tiersAffected: CacheTier[];
  duration: number;
  errors: string[];
  propagationResults: PropagationResult[];
}

export interface PropagationResult {
  tier: CacheTier;
  success: boolean;
  keysInvalidated: number;
  duration: number;
  error?: string;
}

export interface InvalidationEvent {
  type: string;
  key: string;
  timestamp: number;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface InvalidationRule {
  id: string;
  name: string;
  condition: InvalidationCondition;
  action: InvalidationAction;
  priority: number;
  enabled: boolean;
}

export interface InvalidationCondition {
  type: 'time' | 'event' | 'tag' | 'pattern' | 'custom';
  criteria: Record<string, unknown>;
}

export interface InvalidationAction {
  type: 'invalidate' | 'refresh' | 'purge' | 'revalidate';
  target?: CacheTier[];
}

export interface TagIndex {
  tag: string;
  keys: string[];
  count: number;
  lastUpdated: number;
}

export interface PatternMatcher {
  pattern: string;
  type: 'glob' | 'regex' | 'exact';
  compiled: RegExp;
  matchCount: number;
  lastMatched: number;
}

// ============================================================================
// Environment Types
// ============================================================================

export interface EdgeCacheEnv {
  CACHE_KV: KVNamespace;
  CACHE_R2: R2Bucket;
  CACHE_COORDINATOR?: DurableObjectNamespace;
  ANALYTICS_KV?: KVNamespace;
  PREDICTION_KV?: KVNamespace;
  WARMING_KV?: KVNamespace;
}

// ============================================================================
// Utility Types
// ============================================================================

export type PromiseValue<T> = T extends Promise<infer V> ? V : T;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export interface PerformanceTimer {
  start: number;
  end?: number;
  duration?: number;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface BatchConfig {
  size: number;
  timeout: number;
  concurrency: number;
}

export interface ThrottleConfig {
  interval: number;
  maxRequests: number;
}

export interface RateLimitConfig {
  requests: number;
  period: number;
  burst?: number;
}
