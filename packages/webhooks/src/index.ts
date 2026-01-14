/**
 * ClaudeFlare Webhook Package
 *
 * A comprehensive webhook delivery system for distributed AI platforms
 */

// Core exports
export { WebhookManager } from './manager/manager.js';
export { DeliveryEngine } from './delivery/engine.js';
export { RetryHandler, RetryCalculator } from './retry/handler.js';
export { SecurityLayer, SECURITY_HEADERS } from './security/layer.js';
export { WebhookAnalytics, AnalyticsUtils } from './analytics/analytics.js';
export {
  WebhookDurableObject,
  createWebhookDOStub,
  WebhookDOClient,
} from './durable/webhook-do.js';

// Type exports
export type {
  Webhook,
  WebhookEvent,
  WebhookDelivery,
  WebhookEventType,
  WebhookDeliveryStatus,
  RetryStrategy,
  WebhookHttpMethod,
  SignatureAlgorithm,
  WebhookPriority,
  RetryConfig,
  RateLimitConfig,
  WebhookFilter,
  WebhookTemplate,
  WebhookStatistics,
  DeliveryQueueItem,
  SignatureVerificationResult,
  DeadLetterItem,
  BatchDeliveryConfig,
  WebhookAnalytics as IWebhookAnalytics,
} from './types/webhook.js';

export type {
  IWebhookStorage,
  IWebhookDeliveryStorage,
  IDeadLetterStorage,
  IAnalyticsStorage,
  IKVStorage,
  ListOptions,
  PaginatedResult,
  DeliveryStatistics,
  AnalyticsPeriod,
  TimeSeriesData,
} from './types/storage.js';

export type {
  WebhookSystemConfig,
  DEFAULT_CONFIG,
} from './types/config.js';

export type {
  CreateWebhookOptions,
  UpdateWebhookOptions,
  ListWebhooksOptions,
  ValidationResult,
} from './manager/manager.js';

export type {
  DeliveryResult,
  BatchDeliveryResult,
  DeliveryEngineStats,
} from './delivery/engine.js';

export type {
  RetryCalculation,
  RetryScheduleItem,
  RetryStatistics,
} from './retry/handler.js';

export type {
  SecurityOptions,
  SignatureResult,
} from './security/layer.js';

export type {
  RealTimeMetrics,
  PerformanceMetrics,
  AlertCondition,
  AlertEvent,
} from './analytics/analytics.js';

// Error exports
export {
  WebhookError,
  WebhookNotFoundError,
  InvalidWebhookConfigError,
  WebhookDeliveryError,
  SignatureVerificationError,
  RateLimitExceededError,
  WebhookTimeoutError,
  MaxRetriesExceededError,
  InvalidWebhookURLError,
  SecurityValidationError,
  ReplayAttackError,
  SerializationError,
  DeserializationError,
  QueueError,
  StorageError,
  FilterEvaluationError,
  TemplateTransformationError,
  IPNotAllowedError,
  InvalidAPIKeyError,
} from './types/errors.js';

// Utility exports
export { mergeConfig, configFromEnv } from './types/config.js';
export { SecurityLayer as SecurityUtils } from './security/layer.js';

// Schema exports
export {
  WebhookEventTypeSchema,
  RetryConfigSchema,
  RateLimitConfigSchema,
  WebhookFilterSchema,
  WebhookTemplateSchema,
  WebhookStatisticsSchema,
  WebhookSchema,
  WebhookEventSchema,
  WebhookDeliverySchema,
} from './types/webhook.js';

// Enums
export {
  WebhookEventType,
  WebhookDeliveryStatus,
  RetryStrategy,
  WebhookHttpMethod,
  SignatureAlgorithm,
  WebhookPriority,
} from './types/webhook.js';
