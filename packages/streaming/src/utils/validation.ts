/**
 * Validation utilities for streaming infrastructure
 */

import { z } from 'zod';

// ============================================================================
// Event Validation Schemas
// ============================================================================

export const EventMetadataSchema = z.object({
  source: z.string().optional(),
  correlationId: z.string().optional(),
  causationId: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  version: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional(),
}).passthrough();

export const StreamEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.unknown(),
  timestamp: z.number().int().positive(),
  metadata: EventMetadataSchema.optional(),
  headers: z.record(z.string()).optional(),
});

export const EventFilterSchema = z.object({
  types: z.array(z.string()).optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
  timeRange: z.object({
    start: z.number().int().positive(),
    end: z.number().int().positive(),
  }).optional(),
  custom: z.function().args(StreamEventSchema).returns(z.boolean()).optional(),
});

// ============================================================================
// Queue Validation Schemas
// ============================================================================

export const MessageMetadataSchema = z.object({
  createdAt: z.number().int().positive(),
  scheduledAt: z.number().int().positive().optional(),
  expiresAt: z.number().int().positive().optional(),
  correlationId: z.string().optional(),
  groupId: z.string().optional(),
  deduplicationId: z.string().optional(),
});

export const MessageSchema = z.object({
  id: z.string().min(1),
  payload: z.unknown(),
  priority: z.number().int().min(0).max(100).optional(),
  attempts: z.number().int().min(0).optional(),
  maxAttempts: z.number().int().min(1).optional(),
  timeout: z.number().int().positive().optional(),
  deadline: z.number().int().positive().optional(),
  metadata: MessageMetadataSchema.optional(),
});

export const QueueOptionsSchema = z.object({
  type: z.enum(['fifo', 'priority', 'delayed']).optional(),
  maxSize: z.number().int().positive().optional(),
  deadLetterQueue: z.string().optional(),
  retention: z.number().int().positive().optional(),
  deliveryDelay: z.number().int().positive().optional(),
  receiveWaitTime: z.number().int().nonnegative().optional(),
  visibilityTimeout: z.number().int().positive().optional(),
});

// ============================================================================
// Stream Processing Validation Schemas
// ============================================================================

export const WindowOptionsSchema = z.object({
  size: z.number().int().positive(),
  slide: z.number().int().positive().optional(),
  type: z.enum(['tumbling', 'sliding', 'session']),
  sessionTimeout: z.number().int().positive().optional(),
});

export const JoinOptionsSchema = z.object({
  type: z.enum(['inner', 'left', 'right', 'outer', 'stream-stream']),
  window: WindowOptionsSchema,
  keySelector: z.function().args(StreamEventSchema).returns(z.string()),
});

// ============================================================================
// Pub/Sub Validation Schemas
// ============================================================================

export const SubscriptionFilterSchema = z.object({
  types: z.array(z.string()).optional(),
  attributes: z.record(z.string()).optional(),
  expression: z.string().optional(),
});

export const SubscriptionSchema = z.object({
  id: z.string().min(1),
  topic: z.string().min(1),
  subscriberId: z.string().min(1),
  filter: SubscriptionFilterSchema.optional(),
  createdAt: z.number().int().positive(),
  position: z.object({
    partition: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
  }).optional(),
});

export const PublishOptionsSchema = z.object({
  partitionKey: z.string().optional(),
  orderingKey: z.string().optional(),
  delay: z.number().int().nonnegative().optional(),
  attributes: z.record(z.string()).optional(),
});

// ============================================================================
// Analytics Validation Schemas
// ============================================================================

export const LatencyMetricsSchema = z.object({
  p50: z.number().nonnegative(),
  p95: z.number().nonnegative(),
  p99: z.number().nonnegative(),
  p999: z.number().nonnegative(),
  avg: z.number().nonnegative(),
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
});

export const StreamMetricsSchema = z.object({
  eventCount: z.number().int().nonnegative(),
  eventRate: z.number().nonnegative(),
  byteRate: z.number().nonnegative(),
  latency: LatencyMetricsSchema,
  throughput: z.object({
    current: z.number().nonnegative(),
    peak: z.number().nonnegative(),
    average: z.number().nonnegative(),
  }),
  errors: z.object({
    count: z.number().int().nonnegative(),
    rate: z.number().nonnegative(),
    types: z.record(z.number().int().nonnegative()),
    lastError: z.instanceof(Error).optional(),
  }),
});

// ============================================================================
// Backpressure Validation Schemas
// ============================================================================

export const RetryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1),
  backoff: z.enum(['fixed', 'exponential', 'linear']),
  initialDelay: z.number().int().positive(),
  maxDelay: z.number().int().positive(),
  multiplier: z.number().positive().optional(),
});

export const BackpressureStrategySchema = z.object({
  type: z.enum(['drop', 'buffer', 'throttle', 'reject', 'custom']),
  bufferSize: z.number().int().positive().optional(),
  throttleRate: z.number().positive().optional(),
  dropPolicy: z.enum(['oldest', 'newest', 'lowest-priority']).optional(),
  customHandler: z.function().args(z.unknown()).returns(z.promise(z.void())).optional(),
});

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a stream event
 */
export function validateEvent(event: unknown): asserts event is z.infer<typeof StreamEventSchema> {
  try {
    StreamEventSchema.parse(event);
  } catch (error) {
    throw new Error(`Invalid event: ${(error as z.ZodError).errors.map(e => e.message).join(', ')}`);
  }
}

/**
 * Validate a message
 */
export function validateMessage(message: unknown): asserts message is z.infer<typeof MessageSchema> {
  try {
    MessageSchema.parse(message);
  } catch (error) {
    throw new Error(`Invalid message: ${(error as z.ZodError).errors.map(e => e.message).join(', ')}`);
  }
}

/**
 * Validate queue options
 */
export function validateQueueOptions(options: unknown): asserts options is z.infer<typeof QueueOptionsSchema> {
  try {
    QueueOptionsSchema.parse(options);
  } catch (error) {
    throw new Error(`Invalid queue options: ${(error as z.ZodError).errors.map(e => e.message).join(', ')}`);
  }
}

/**
 * Validate window options
 */
export function validateWindowOptions(options: unknown): asserts options is z.infer<typeof WindowOptionsSchema> {
  try {
    WindowOptionsSchema.parse(options);
  } catch (error) {
    throw new Error(`Invalid window options: ${(error as z.ZodError).errors.map(e => e.message).join(', ')}`);
  }
}

/**
 * Validate subscription filter
 */
export function validateSubscriptionFilter(filter: unknown): asserts filter is z.infer<typeof SubscriptionFilterSchema> {
  try {
    SubscriptionFilterSchema.parse(filter);
  } catch (error) {
    throw new Error(`Invalid subscription filter: ${(error as z.ZodError).errors.map(e => e.message).join(', ')}`);
  }
}

/**
 * Validate publish options
 */
export function validatePublishOptions(options: unknown): asserts options is z.infer<typeof PublishOptionsSchema> {
  try {
    PublishOptionsSchema.parse(options);
  } catch (error) {
    throw new Error(`Invalid publish options: ${(error as z.ZodError).errors.map(e => e.message).join(', ')}`);
  }
}

/**
 * Validate retry policy
 */
export function validateRetryPolicy(policy: unknown): asserts policy is z.infer<typeof RetryPolicySchema> {
  try {
    RetryPolicySchema.parse(policy);
  } catch (error) {
    throw new Error(`Invalid retry policy: ${(error as z.ZodError).errors.map(e => e.message).join(', ')}`);
  }
}

/**
 * Validate backpressure strategy
 */
export function validateBackpressureStrategy(strategy: unknown): asserts strategy is z.infer<typeof BackpressureStrategySchema> {
  try {
    BackpressureStrategySchema.parse(strategy);
  } catch (error) {
    throw new Error(`Invalid backpressure strategy: ${(error as z.ZodError).errors.map(e => e.message).join(', ')}`);
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a valid stream event
 */
export function isStreamEvent(value: unknown): value is z.infer<typeof StreamEventSchema> {
  try {
    StreamEventSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a value is a valid message
 */
export function isMessage(value: unknown): value is z.infer<typeof MessageSchema> {
  try {
    MessageSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a value is a valid event filter
 */
export function isEventFilter(value: unknown): value is z.infer<typeof EventFilterSchema> {
  try {
    EventFilterSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}
