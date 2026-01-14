/**
 * Core type definitions for the event system
 */

import { z } from 'zod';

// ============================================================================
// Event Metadata
// ============================================================================

export interface EventMetadata {
  eventId: string;
  eventType: string;
  timestamp: number;
  causationId?: string;
  correlationId?: string;
  version: number;
  source: string;
  userId?: string;
  traceId?: string;
}

// ============================================================================
// Event Envelope
// ============================================================================

export interface EventEnvelope<T = unknown> {
  metadata: EventMetadata;
  payload: T;
  schema?: string;
}

// ============================================================================
// Event Types
// ============================================================================

export type EventHandler<T = unknown> = (event: EventEnvelope<T>) => Promise<void> | void;

export type EventFilter = {
  eventType?: string | string[] | RegExp;
  correlationId?: string;
  userId?: string;
  fromTimestamp?: number;
  toTimestamp?: number;
};

// ============================================================================
// Event Versioning
// ============================================================================

export interface EventVersion {
  version: number;
  schema: string;
  migrationPath?: string;
  deprecated: boolean;
  introducedAt: number;
}

export interface EventSchema {
  eventType: string;
  currentVersion: number;
  versions: Record<number, EventVersion>;
  validationSchema?: z.ZodTypeAny;
}

// ============================================================================
// Topic Configuration
// ============================================================================

export interface TopicConfig {
  name: string;
  partitions?: number;
  retentionMs?: number;
  retentionBytes?: number;
  maxMessageSize?: number;
  replicationFactor?: number;
}

// ============================================================================
// Subscription Configuration
// ============================================================================

export interface SubscriptionConfig {
  topic: string;
  subscriptionId: string;
  filter?: EventFilter;
  deliverySemantics: 'at-least-once' | 'exactly-once' | 'at-most-once';
  maxRetries: number;
  retryDelayMs: number;
  deadLetterTarget?: string;
  batch?: {
    enabled: boolean;
    maxSize: number;
    maxWaitMs: number;
  };
}

// ============================================================================
// Consumer Configuration
// ============================================================================

export interface ConsumerConfig {
  consumerId: string;
  groupId: string;
  subscriptions: string[];
  maxConcurrentMessages: number;
  processingTimeoutMs: number;
  heartbeatIntervalMs: number;
}

// ============================================================================
// Message Ordering
// ============================================================================

export interface MessageOrdering {
  partitionKey?: string;
  sequenceNumber?: number;
  orderingKey?: string;
}

// ============================================================================
// Delivery Guarantees
// ============================================================================

export interface DeliveryAck {
  messageId: string;
  processed: boolean;
  retry: boolean;
  error?: Error;
}

export interface DeliveryReceipt {
  messageId: string;
  processedAt: number;
  processingTimeMs: number;
  consumerId: string;
}
