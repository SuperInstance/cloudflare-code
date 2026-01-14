/**
 * Metrics and monitoring type definitions for ClaudeFlare platform
 * @packageDocumentation
 */

import { z } from 'zod';

// ============================================================================
// METRICS TYPES
// ============================================================================

/**
 * Request-level metrics
 */
export interface RequestMetrics {
  /** Unique request identifier */
  requestId: string;
  /** Request timestamp (Unix ms) */
  timestamp: number;
  /** Provider used */
  provider: string;
  /** Model used */
  model: string;
  /** Request duration in milliseconds */
  latency: number;
  /** Total tokens used */
  tokens: number;
  /** Whether cache was hit */
  cacheHit: boolean;
  /** Estimated cost in USD */
  cost: number;
  /** Request success status */
  success: boolean;
  /** Error code if failed */
  errorCode?: string;
  /** User identifier */
  userId?: string;
  /** Session identifier */
  sessionId?: string;
}

/**
 * Zod schema for RequestMetrics validation
 */
export const RequestMetricsSchema = z.object({
  requestId: z.string(),
  timestamp: z.number().nonnegative(),
  provider: z.string(),
  model: z.string(),
  latency: z.number().nonnegative(),
  tokens: z.number().nonnegative(),
  cacheHit: z.boolean(),
  cost: z.number().nonnegative(),
  success: z.boolean(),
  errorCode: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional()
});

/**
 * Aggregated metrics over a time period
 */
export interface AggregatedMetrics {
  /** Time period start (Unix ms) */
  periodStart: number;
  /** Time period end (Unix ms) */
  periodEnd: number;
  /** Total number of requests */
  totalRequests: number;
  /** Number of successful requests */
  successfulRequests: number;
  /** Number of failed requests */
  failedRequests: number;
  /** Average latency in milliseconds */
  avgLatency: number;
  /** Latency percentiles */
  latencyPercentiles: LatencyPercentiles;
  /** Total tokens used */
  totalTokens: number;
  /** Total cost in USD */
  totalCost: number;
  /** Cache hit rate (0-1) */
  cacheHitRate: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Requests per provider */
  requestsByProvider: Record<string, number>;
  /** Requests by model */
  requestsByModel: Record<string, number>;
  /** Requests by error type */
  errorsByType: Record<string, number>;
}

/**
 * Latency percentile measurements
 */
export interface LatencyPercentiles {
  /** 50th percentile latency in ms */
  p50: number;
  /** 90th percentile latency in ms */
  p90: number;
  /** 95th percentile latency in ms */
  p95: number;
  /** 99th percentile latency in ms */
  p99: number;
}

/**
 * Zod schema for LatencyPercentiles validation
 */
export const LatencyPercentilesSchema = z.object({
  p50: z.number().nonnegative(),
  p90: z.number().nonnegative(),
  p95: z.number().nonnegative(),
  p99: z.number().nonnegative()
});

/**
 * Zod schema for AggregatedMetrics validation
 */
export const AggregatedMetricsSchema = z.object({
  periodStart: z.number().nonnegative(),
  periodEnd: z.number().nonnegative(),
  totalRequests: z.number().nonnegative(),
  successfulRequests: z.number().nonnegative(),
  failedRequests: z.number().nonnegative(),
  avgLatency: z.number().nonnegative(),
  latencyPercentiles: LatencyPercentilesSchema,
  totalTokens: z.number().nonnegative(),
  totalCost: z.number().nonnegative(),
  cacheHitRate: z.number().min(0).max(1),
  errorRate: z.number().min(0).max(1),
  requestsByProvider: z.record(z.number()),
  requestsByModel: z.record(z.number()),
  errorsByType: z.record(z.number())
});

// ============================================================================
// QUOTA TYPES
// ============================================================================

/**
 * Quota information for a provider
 */
export interface QuotaInfo {
  /** Provider identifier */
  provider: string;
  /** Tokens used in current period */
  used: number;
  /** Token limit for current period */
  limit: number;
  /** Timestamp when quota resets (Unix ms) */
  resetAt: number;
  /** Quota usage percentage (0-1) */
  usagePercentage: number;
  /** Quota status */
  status: QuotaStatus;
}

/**
 * Quota status enum
 */
export enum QuotaStatus {
  OK = 'ok',
  WARNING = 'warning',     // Above 80% usage
  CRITICAL = 'critical',   // Above 95% usage
  EXHAUSTED = 'exhausted'  // At 100% usage
}

/**
 * Zod schema for QuotaInfo validation
 */
export const QuotaInfoSchema = z.object({
  provider: z.string(),
  used: z.number().nonnegative(),
  limit: z.number().positive(),
  resetAt: z.number().nonnegative(),
  usagePercentage: z.number().min(0).max(1),
  status: z.enum(['ok', 'warning', 'critical', 'exhausted'])
});

/**
 * User quota information
 */
export interface UserQuota {
  /** User identifier */
  userId: string;
  /** Total requests made */
  totalRequests: number;
  /** Request limit per period */
  requestLimit: number;
  /** Total tokens used */
  totalTokens: number;
  /** Token limit per period */
  tokenLimit: number;
  /** Total cost incurred in USD */
  totalCost: number;
  /** Cost limit per period in USD */
  costLimit: number;
  /** Quota reset timestamp (Unix ms) */
  resetAt: number;
  /** Remaining quota information */
  remaining: {
    requests: number;
    tokens: number;
    cost: number;
  };
}

/**
 * Zod schema for UserQuota validation
 */
export const UserQuotaSchema = z.object({
  userId: z.string(),
  totalRequests: z.number().nonnegative(),
  requestLimit: z.number().positive(),
  totalTokens: z.number().nonnegative(),
  tokenLimit: z.number().positive(),
  totalCost: z.number().nonnegative(),
  costLimit: z.number().nonnegative(),
  resetAt: z.number().nonnegative(),
  remaining: z.object({
    requests: z.number().nonnegative(),
    tokens: z.number().nonnegative(),
    cost: z.number().nonnegative()
  })
});

// ============================================================================
// PERFORMANCE METRICS
// ============================================================================

/**
 * Provider performance metrics
 */
export interface ProviderMetrics {
  /** Provider identifier */
  providerId: string;
  /** Model identifier */
  model: string;
  /** Timestamp of measurement (Unix ms) */
  timestamp: number;
  /** Number of requests measured */
  sampleSize: number;
  /** Average latency in milliseconds */
  avgLatency: number;
  /** Latency percentiles */
  percentiles: LatencyPercentiles;
  /** Average tokens per second */
  avgTokensPerSecond: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Average cost per request in USD */
  avgCostPerRequest: number;
  /** Throughput in requests per minute */
  throughputRpm: number;
}

/**
 * Zod schema for ProviderMetrics validation
 */
export const ProviderMetricsSchema = z.object({
  providerId: z.string(),
  model: z.string(),
  timestamp: z.number().nonnegative(),
  sampleSize: z.number().positive(),
  avgLatency: z.number().nonnegative(),
  percentiles: LatencyPercentilesSchema,
  avgTokensPerSecond: z.number().nonnegative(),
  successRate: z.number().min(0).max(1),
  errorRate: z.number().min(0).max(1),
  avgCostPerRequest: z.number().nonnegative(),
  throughputRpm: z.number().nonnegative()
});

/**
 * Cache performance metrics
 */
export interface CacheMetrics {
  /** Cache identifier */
  cacheId: string;
  /** Timestamp of measurement (Unix ms) */
  timestamp: number;
  /** Total cache entries */
  totalEntries: number;
  /** Cache size in bytes */
  currentSize: number;
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
  /** Number of evictions */
  evictions: number;
  /** Average access time in microseconds */
  avgAccessTime: number;
}

/**
 * Zod schema for CacheMetrics validation
 */
export const CacheMetricsSchema = z.object({
  cacheId: z.string(),
  timestamp: z.number().nonnegative(),
  totalEntries: z.number().nonnegative(),
  currentSize: z.number().nonnegative(),
  hits: z.number().nonnegative(),
  misses: z.number().nonnegative(),
  hitRate: z.number().min(0).max(1),
  evictions: z.number().nonnegative(),
  avgAccessTime: z.number().nonnegative()
});

// ============================================================================
// COST METRICS
// ============================================================================

/**
 * Cost breakdown by provider
 */
export interface CostBreakdown {
  /** Provider identifier */
  provider: string;
  /** Total cost in USD */
  totalCost: number;
  /** Cost percentage of total */
  percentage: number;
  /** Number of requests */
  requestCount: number;
  /** Average cost per request in USD */
  avgCostPerRequest: number;
  /** Total tokens used */
  totalTokens: number;
  /** Cost per million tokens in USD */
  costPerMillionTokens: number;
}

/**
 * Zod schema for CostBreakdown validation
 */
export const CostBreakdownSchema = z.object({
  provider: z.string(),
  totalCost: z.number().nonnegative(),
  percentage: z.number().min(0).max(1),
  requestCount: z.number().nonnegative(),
  avgCostPerRequest: z.number().nonnegative(),
  totalTokens: z.number().nonnegative(),
  costPerMillionTokens: z.number().nonnegative()
});

/**
 * Cost summary over time period
 */
export interface CostSummary {
  /** Time period start (Unix ms) */
  periodStart: number;
  /** Time period end (Unix ms) */
  periodEnd: number;
  /** Total cost in USD */
  totalCost: number;
  /** Cost breakdown by provider */
  breakdown: CostBreakdown[];
  /** Cost trend */
  trend: CostTrend;
  /** Projected monthly cost in USD */
  projectedMonthlyCost: number;
}

/**
 * Cost trend enum
 */
export enum CostTrend {
  INCREASING = 'increasing',
  STABLE = 'stable',
  DECREASING = 'decreasing'
}

/**
 * Zod schema for CostSummary validation
 */
export const CostSummarySchema = z.object({
  periodStart: z.number().nonnegative(),
  periodEnd: z.number().nonnegative(),
  totalCost: z.number().nonnegative(),
  breakdown: z.array(CostBreakdownSchema),
  trend: z.enum(['increasing', 'stable', 'decreasing']),
  projectedMonthlyCost: z.number().nonnegative()
});

// ============================================================================
// ALERT TYPES
// ============================================================================

/**
 * Metric alert configuration
 */
export interface MetricAlert {
  /** Alert unique identifier */
  alertId: string;
  /** Alert name */
  name: string;
  /** Metric to monitor */
  metric: string;
  /** Alert condition */
  condition: AlertCondition;
  /** Threshold value */
  threshold: number;
  /** Alert severity */
  severity: AlertSeverity;
  /** Whether alert is enabled */
  enabled: boolean;
  /** Notification channels */
  notificationChannels: string[];
  /** Time window for evaluation in milliseconds */
  timeWindowMs: number;
  /** Minimum number of violations before triggering */
  minViolations: number;
}

/**
 * Alert condition enum
 */
export enum AlertCondition {
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  EQUAL_TO = 'equal_to',
  PERCENTAGE_CHANGE = 'percentage_change'
}

/**
 * Alert severity enum
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Zod schema for MetricAlert validation
 */
export const MetricAlertSchema = z.object({
  alertId: z.string(),
  name: z.string(),
  metric: z.string(),
  condition: z.enum(['greater_than', 'less_than', 'equal_to', 'percentage_change']),
  threshold: z.number(),
  severity: z.enum(['info', 'warning', 'error', 'critical']),
  enabled: z.boolean(),
  notificationChannels: z.array(z.string()),
  timeWindowMs: z.number().positive(),
  minViolations: z.number().positive()
});

/**
 * Alert trigger event
 */
export interface AlertTrigger {
  /** Alert identifier */
  alertId: string;
  /** Trigger timestamp (Unix ms) */
  timestamp: number;
  /** Current metric value */
  currentValue: number;
  /** Threshold value */
  thresholdValue: number;
  /** Alert severity */
  severity: AlertSeverity;
  /** Alert message */
  message: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Zod schema for AlertTrigger validation
 */
export const AlertTriggerSchema = z.object({
  alertId: z.string(),
  timestamp: z.number().nonnegative(),
  currentValue: z.number(),
  thresholdValue: z.number(),
  severity: z.enum(['info', 'warning', 'error', 'critical']),
  message: z.string(),
  context: z.record(z.unknown()).optional()
});

// ============================================================================
// TYPE INFERENCE UTILITIES
// ============================================================================

/**
 * Infer RequestMetrics type from schema
 */
export type RequestMetricsType = z.infer<typeof RequestMetricsSchema>;

/**
 * Infer AggregatedMetrics type from schema
 */
export type AggregatedMetricsType = z.infer<typeof AggregatedMetricsSchema>;

/**
 * Infer QuotaInfo type from schema
 */
export type QuotaInfoType = z.infer<typeof QuotaInfoSchema>;

/**
 * Infer UserQuota type from schema
 */
export type UserQuotaType = z.infer<typeof UserQuotaSchema>;

/**
 * Infer ProviderMetrics type from schema
 */
export type ProviderMetricsType = z.infer<typeof ProviderMetricsSchema>;

/**
 * Infer CacheMetrics type from schema
 */
export type CacheMetricsType = z.infer<typeof CacheMetricsSchema>;

/**
 * Infer CostSummary type from schema
 */
export type CostSummaryType = z.infer<typeof CostSummarySchema>;

/**
 * Infer MetricAlert type from schema
 */
export type MetricAlertType = z.infer<typeof MetricAlertSchema>;
