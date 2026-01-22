/**
 * Core webhook types and interfaces for ClaudeFlare webhook system
 */

import { z } from 'zod';

/**
 * Webhook event types that can trigger webhook deliveries
 */
export enum WebhookEventType {
  // Code events
  CODE_PUSH = 'code.push',
  CODE_PR_CREATED = 'code.pr.created',
  CODE_PR_UPDATED = 'code.pr.updated',
  CODE_PR_MERGED = 'code.pr.merged',
  CODE_PR_CLOSED = 'code.pr.closed',
  CODE_COMMENT = 'code.comment',
  CODE_REVIEW = 'code.review',

  // Build events
  BUILD_STARTED = 'build.started',
  BUILD_COMPLETED = 'build.completed',
  BUILD_FAILED = 'build.failed',
  BUILD_CANCELLED = 'build.cancelled',

  // Deployment events
  DEPLOYMENT_STARTED = 'deployment.started',
  DEPLOYMENT_SUCCESS = 'deployment.success',
  DEPLOYMENT_FAILED = 'deployment.failed',
  DEPLOYMENT_ROLLED_BACK = 'deployment.rolled_back',

  // AI events
  AI_REQUEST = 'ai.request',
  AI_RESPONSE = 'ai.response',
  AI_STREAM_START = 'ai.stream.start',
  AI_STREAM_CHUNK = 'ai.stream.chunk',
  AI_STREAM_END = 'ai.stream.end',
  AI_ERROR = 'ai.error',

  // Security events
  SECURITY_SCAN_STARTED = 'security.scan.started',
  SECURITY_VULNERABILITY_FOUND = 'security.vulnerability.found',
  SECURITY_VULNERABILITY_FIXED = 'security.vulnerability.fixed',
  SECURITY_INCIDENT = 'security.incident',

  // Monitoring events
  METRIC_ALERT = 'monitoring.metric.alert',
  SERVICE_UP = 'monitoring.service.up',
  SERVICE_DOWN = 'monitoring.service.down',
  PERFORMANCE_DEGRADED = 'monitoring.performance.degraded',

  // User events
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',

  // Custom events
  CUSTOM = 'custom',
}

/**
 * Webhook delivery status
 */
export enum WebhookDeliveryStatus {
  PENDING = 'pending',
  SENDING = 'sending',
  SUCCESS = 'success',
  FAILED = 'failed',
  RETRYING = 'retrying',
  TIMEOUT = 'timeout',
  DEAD_LETTER = 'dead_letter',
}

/**
 * Webhook retry strategy
 */
export enum RetryStrategy {
  EXPONENTIAL_BACKOFF = 'exponential_backoff',
  LINEAR_BACKOFF = 'linear_backoff',
  FIXED_INTERVAL = 'fixed_interval',
  CUSTOM = 'custom',
}

/**
 * Webhook HTTP method
 */
export enum WebhookHttpMethod {
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
}

/**
 * Signature algorithm for webhook security
 */
export enum SignatureAlgorithm {
  HMAC_SHA256 = 'hmac_sha256',
  HMAC_SHA384 = 'hmac_sha384',
  HMAC_SHA512 = 'hmac_sha512',
  ED25519 = 'ed25519',
  RSA_SHA256 = 'rsa_sha256',
}

/**
 * Webhook priority levels for delivery queue
 */
export enum WebhookPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
}

/**
 * Main webhook configuration interface
 */
export interface Webhook {
  id: string;
  name: string;
  description?: string;
  userId: string;
  projectId?: string;
  url: string;
  httpMethod: WebhookHttpMethod;
  events: WebhookEventType[];
  headers?: Record<string, string>;
  secret: string;
  signatureAlgorithm: SignatureAlgorithm;
  active: boolean;
  priority: WebhookPriority;
  timeout: number;
  retryConfig: RetryConfig;
  rateLimit?: RateLimitConfig;
  filters?: WebhookFilter[];
  template?: WebhookTemplate;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  lastTriggeredAt?: Date;
  statistics: WebhookStatistics;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  enabled: boolean;
  strategy: RetryStrategy;
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
  customSchedule?: number[];
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  enabled: boolean;
  maxRequests: number;
  windowMs: number;
  burstAllowance: number;
}

/**
 * Webhook filter for conditional triggering
 */
export interface WebhookFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'nin' | 'contains' | 'regex';
  value: unknown;
}

/**
 * Webhook template for payload transformation
 */
export interface WebhookTemplate {
  contentType: string;
  bodyTemplate?: string;
  headers?: Record<string, string>;
  transformScript?: string;
}

/**
 * Webhook delivery attempt
 */
export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: WebhookEventType;
  eventId: string;
  payload: unknown;
  status: WebhookDeliveryStatus;
  statusCode?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  attemptNumber: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  duration: number;
  errorMessage?: string;
  stackTrace?: string;
  createdAt: Date;
  updatedAt: Date;
  deliveredAt?: Date;
}

/**
 * Webhook statistics
 */
export interface WebhookStatistics {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  pendingDeliveries: number;
  averageDeliveryTime: number;
  lastDeliveryStatus?: WebhookDeliveryStatus;
  lastDeliveryAt?: Date;
  successRate: number;
  failureRate: number;
}

/**
 * Webhook event payload
 */
export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  source: string;
  subject: string;
  timestamp: Date;
  data: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Delivery queue item
 */
export interface DeliveryQueueItem {
  id: string;
  webhook: Webhook;
  event: WebhookEvent;
  priority: WebhookPriority;
  scheduledFor: Date;
  attemptNumber: number;
  maxAttempts: number;
  previousAttempts: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Signature verification result
 */
export interface SignatureVerificationResult {
  valid: boolean;
  algorithm?: SignatureAlgorithm;
  signature?: string;
  timestamp?: number;
  error?: string;
}

/**
 * Dead letter queue item
 */
export interface DeadLetterItem {
  id: string;
  webhookId: string;
  webhookName: string;
  eventType: WebhookEventType;
  eventId: string;
  payload: unknown;
  status: WebhookDeliveryStatus;
  attempts: number;
  lastAttemptAt: Date;
  failureReason: string;
  createdAt: Date;
}

/**
 * Batch delivery configuration
 */
export interface BatchDeliveryConfig {
  enabled: boolean;
  maxBatchSize: number;
  maxBatchWaitMs: number;
  aggregationKey?: string;
}

/**
 * Analytics data points
 */
export interface WebhookAnalytics {
  webhookId: string;
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalEvents: number;
    deliveredEvents: number;
    failedEvents: number;
    averageLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    throughput: number;
  };
  breakdown: {
    byEventType: Record<WebhookEventType, number>;
    byStatus: Record<WebhookDeliveryStatus, number>;
    byHour: number[];
  };
}

/**
 * Zod schemas for validation
 */
export const WebhookEventTypeSchema = z.nativeEnum(WebhookEventType);

export const RetryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  strategy: z.nativeEnum(RetryStrategy).default(RetryStrategy.EXPONENTIAL_BACKOFF),
  maxRetries: z.number().int().min(0).max(10).default(3),
  initialDelay: z.number().int().min(100).max(60000).default(1000),
  maxDelay: z.number().int().min(1000).max(3600000).default(60000),
  backoffMultiplier: z.number().positive().default(2),
  retryableStatusCodes: z.array(z.number().int().min(400).max(599)).default([
    408, 429, 500, 502, 503, 504,
  ]),
  customSchedule: z.array(z.number().int().positive()).optional(),
});

export const RateLimitConfigSchema = z.object({
  enabled: z.boolean().default(false),
  maxRequests: z.number().int().positive().default(100),
  windowMs: z.number().int().positive().default(60000),
  burstAllowance: z.number().int().min(0).default(10),
});

export const WebhookFilterSchema = z.object({
  field: z.string(),
  operator: z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'in', 'nin', 'contains', 'regex']),
  value: z.unknown(),
});

export const WebhookTemplateSchema = z.object({
  contentType: z.string().default('application/json'),
  bodyTemplate: z.string().optional(),
  headers: z.record(z.string()).optional(),
  transformScript: z.string().optional(),
});

export const WebhookStatisticsSchema = z.object({
  totalDeliveries: z.number().int().nonnegative().default(0),
  successfulDeliveries: z.number().int().nonnegative().default(0),
  failedDeliveries: z.number().int().nonnegative().default(0),
  pendingDeliveries: z.number().int().nonnegative().default(0),
  averageDeliveryTime: z.number().nonnegative().default(0),
  lastDeliveryStatus: z.nativeEnum(WebhookDeliveryStatus).optional(),
  lastDeliveryAt: z.date().optional(),
  successRate: z.number().min(0).max(1).default(1),
  failureRate: z.number().min(0).max(1).default(0),
});

export const WebhookSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  userId: z.string(),
  projectId: z.string().optional(),
  url: z.string().url(),
  httpMethod: z.nativeEnum(WebhookHttpMethod).default(WebhookHttpMethod.POST),
  events: z.array(z.nativeEnum(WebhookEventType)).min(1),
  headers: z.record(z.string()).optional(),
  secret: z.string().min(32),
  signatureAlgorithm: z.nativeEnum(SignatureAlgorithm).default(SignatureAlgorithm.HMAC_SHA256),
  active: z.boolean().default(true),
  priority: z.nativeEnum(WebhookPriority).default(WebhookPriority.NORMAL),
  timeout: z.number().int().positive().max(300000).default(30000),
  retryConfig: RetryConfigSchema,
  rateLimit: RateLimitConfigSchema.optional(),
  filters: z.array(WebhookFilterSchema).optional(),
  template: WebhookTemplateSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastTriggeredAt: z.date().optional(),
  statistics: WebhookStatisticsSchema,
});

export const WebhookEventSchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(WebhookEventType),
  source: z.string(),
  subject: z.string(),
  timestamp: z.date(),
  data: z.unknown(),
  metadata: z.record(z.unknown()).optional(),
});

export const WebhookDeliverySchema = z.object({
  id: z.string().uuid(),
  webhookId: z.string().uuid(),
  eventType: z.nativeEnum(WebhookEventType),
  eventId: z.string().uuid(),
  payload: z.unknown(),
  status: z.nativeEnum(WebhookDeliveryStatus),
  statusCode: z.number().int().min(100).max(599).optional(),
  responseHeaders: z.record(z.string()).optional(),
  responseBody: z.string().optional(),
  attemptNumber: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  nextRetryAt: z.date().optional(),
  duration: z.number().nonnegative(),
  errorMessage: z.string().optional(),
  stackTrace: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deliveredAt: z.date().optional(),
});
