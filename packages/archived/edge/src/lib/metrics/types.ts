/**
 * Metrics Types & Interfaces
 *
 * Comprehensive type definitions for the metrics collection system
 * covering requests, providers, cache performance, and aggregations.
 */

/**
 * Request Metrics - Individual AI request tracking
 */
export interface RequestMetrics {
  requestId: string;
  timestamp: number;
  provider: string;
  model: string;
  latency: number; // milliseconds
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  cacheHit: boolean;
  cacheTier?: 'hot' | 'warm' | 'cold';
  cost: number;
  success: boolean;
  errorCode?: string;
  userId?: string;
  sessionId?: string;
  feature?: string; // e.g., 'code-gen', 'code-review', 'docs'
}

/**
 * Aggregate Metrics - Time-aggregated request data
 */
export interface AggregateMetrics {
  period: 'hour' | 'day' | 'week';
  startTime: number;
  endTime: number;
  provider: string;
  model?: string;

  // Request counts
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cacheHits: number;
  cacheMisses: number;

  // Token metrics
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;

  // Latency metrics (milliseconds)
  latency: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    avg: number;
  };

  // Cost metrics
  totalCost: number;
  avgCostPerRequest: number;
  avgCostPer1KTokens: number;

  // Cache metrics
  cacheHitRate: number;
  cacheSavings: number; // dollars saved
}

/**
 * Provider Metrics - Health and performance monitoring
 */
export interface ProviderMetrics {
  provider: string;
  timestamp: number;

  // Health status
  health: 'healthy' | 'degraded' | 'down';

  // Latency percentiles
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };

  // Performance metrics
  successRate: number;
  requestsPerMinute: number;
  tokensPerSecond: number;

  // Quota tracking
  quotaUsed: number;
  quotaTotal: number;
  quotaResetTime?: number;

  // Cost tracking
  costPer1KTokens: {
    input: number;
    output: number;
  };
}

/**
 * Cache Metrics - Performance tracking across tiers
 */
export interface CacheMetrics {
  tier: 'hot' | 'warm' | 'cold';
  timestamp: number;

  // Hit rates
  hitRate: number;
  totalRequests: number;
  hits: number;
  misses: number;

  // Latency
  avgLatency: number; // milliseconds

  // Storage
  size: number; // bytes
  entryCount: number;

  // Evictions
  evictionCount: number;
  evictionRate: number; // evictions per 1000 requests

  // Freshness
  avgEntryAge: number; // milliseconds
  staleEntries: number;
}

/**
 * Cost Savings Metrics
 */
export interface CostSavings {
  // Total savings
  totalSavings: number;
  savingsPercentage: number;

  // Breakdown by source
  cacheSavings: {
    amount: number;
    percentage: number;
    tokensSaved: number;
  };

  routingSavings: {
    amount: number;
    percentage: number;
  };

  cascadeSavings: {
    amount: number;
    percentage: number;
  };

  // Time period
  period: {
    start: number;
    end: number;
    granularity: 'hour' | 'day' | 'week' | 'month';
  };
}

/**
 * Provider Stats - Aggregated provider statistics
 */
export interface ProviderStats {
  provider: string;

  // Usage
  requestCount: number;
  requestPercentage: number;
  tokenCount: number;

  // Performance
  avgLatency: number;
  p95Latency: number;
  successRate: number;

  // Cost
  totalCost: number;
  avgCostPerRequest: number;
  costPer1KTokens: number;

  // Quota
  quotaUsage: number;
  quotaRemaining: number;

  // Ranking
  costRank: number;
  latencyRank: number;
  qualityRank: number;
}

/**
 * Anomaly Detection
 */
export interface Anomaly {
  id: string;
  type: 'cost_spike' | 'latency_anomaly' | 'error_spike' | 'cache_drop';
  severity: 'warning' | 'critical' | 'emergency';

  timestamp: number;
  detected: number;

  // Values
  currentValue: number;
  baselineValue: number;
  deviation: number; // percentage

  // Context
  description: string;
  affectedProvider?: string;
  affectedModel?: string;

  // Resolution
  resolved: boolean;
  resolution?: string;
}

/**
 * Dashboard Data - Complete dashboard snapshot
 */
export interface DashboardData {
  timestamp: number;
  timeRange: {
    start: number;
    end: number;
    label: string;
  };

  // Overview metrics
  overview: {
    totalCost: number;
    totalRequests: number;
    cacheHitRate: number;
    avgLatency: number;
    successRate: number;
    trends: {
      cost: number; // percentage change
      requests: number;
      cacheHitRate: number;
      latency: number;
    };
  };

  // Cost breakdown
  costByProvider: Record<string, number>;
  costByModel: Record<string, number>;
  costByFeature: Record<string, number>;

  // Provider status
  providerStatus: ProviderMetrics[];

  // Cache performance
  cachePerformance: {
    hot: CacheMetrics;
    warm: CacheMetrics;
    cold: CacheMetrics;
    overall: {
      hitRate: number;
      savings: number;
    };
  };

  // Top providers
  topProviders: ProviderStats[];

  // Recent anomalies
  recentAnomalies: Anomaly[];

  // Forecast
  forecast?: {
    nextHour: number;
    nextDay: number;
    nextWeek: number;
    confidence: number;
  };
}

/**
 * Metrics Query Options
 */
export interface MetricsQueryOptions {
  startTime: number;
  endTime: number;
  provider?: string;
  model?: string;
  feature?: string;
  userId?: string;
  granularity?: 'minute' | 'hour' | 'day' | 'week';
  limit?: number;
}

/**
 * Metrics Storage Strategy
 */
export interface MetricsStorageStrategy {
  // HOT tier (DO Memory) - Last hour
  hot: {
    maxAge: number; // milliseconds
    maxSize: number; // bytes
  };

  // WARM tier (KV) - Last 24 hours
  warm: {
    maxAge: number;
    aggregationLevel: 'minute' | 'hour';
  };

  // COLD tier (R2) - Archived data
  cold: {
    format: 'json' | 'parquet';
    compression: boolean;
  };
}

/**
 * Alert Configuration
 */
export interface AlertConfig {
  alertId: string;
  alertName: string;
  description: string;

  metric: string;
  thresholds: {
    warning: number;
    critical: number;
    emergency: number;
  };

  notificationChannels: {
    slack?: boolean;
    email?: boolean;
    pagerDuty?: boolean;
    webhook?: string;
  };

  cooldown: number; // seconds
  enabled: boolean;
}

/**
 * Alert State
 */
export interface Alert {
  alertId: string;
  severity: 'warning' | 'critical' | 'emergency';
  timestamp: number;
  metric: string;
  value: number;
  threshold: number;
  message: string;
  resolvedAt?: number;
}
