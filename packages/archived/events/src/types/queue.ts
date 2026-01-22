/**
 * Type definitions for message queue
 */

// ============================================================================
// Queue Message
// ============================================================================

export interface QueueMessage {
  messageId: string;
  queueName: string;
  payload: unknown;
  metadata: {
    enqueueTime: number;
    priority: number;
    delayUntil?: number;
    expiresAt?: number;
    attemptCount: number;
    maxAttempts: number;
    deduplicationId?: string;
  };
}

// ============================================================================
// Queue Configuration
// ============================================================================

export interface QueueConfig {
  name: string;
  type: 'fifo' | 'standard';
  retentionMs: number;
  maxMessageSize: number;
  maxReceiveCount: number;
  visibilityTimeoutMs: number;
  deliveryDelayMs: number;
  deadLetterTarget?: string;
  priority: boolean;
}

// ============================================================================
// Queue Statistics
// ============================================================================

export interface QueueStats {
  name: string;
  approximateNumberOfMessages: number;
  approximateNumberOfMessagesDelayed: number;
  approximateNumberOfMessagesNotVisible: number;
  createdAt: number;
  lastModifiedAt: number;
}

// ============================================================================
// Consumer Group
// ============================================================================

export interface ConsumerGroup {
  groupId: string;
  queueName: string;
  members: string[];
  leaderId: string;
  generationId: number;
  rebalanceInProgress: boolean;
}

export interface ConsumerMember {
  memberId: string;
  groupId: string;
  assignedPartitions: number[];
  lastHeartbeat: number;
  processingMessages: string[];
}

// ============================================================================
// Partition
// ============================================================================

export interface Partition {
  partitionId: number;
  queueName: string;
  ownerId?: string;
  offset: number;
  lag: number;
}

// ============================================================================
// Batch Processing
// ============================================================================

export interface MessageBatch {
  messages: QueueMessage[];
  batchId: string;
  receivedAt: number;
}

export interface BatchResult {
  batchId: string;
  successful: string[];
  failed: Array<{
    messageId: string;
    error: Error;
    retry: boolean;
  }>;
}

// ============================================================================
// Priority Queue
// ============================================================================

export interface PrioritizedMessage extends QueueMessage {
  priority: number;
  orderKey: string;
}

// ============================================================================
// Delayed Delivery
// ============================================================================

export interface DelayedMessage {
  message: QueueMessage;
  deliveryTime: number;
  scheduledAt: number;
}

// ============================================================================
// Dead Letter Queue
// ============================================================================

export interface DeadLetterEntry {
  originalMessage: QueueMessage;
  deadLetterAt: number;
  reason: string;
  attemptCount: number;
  originalError: Error;
}

export interface DeadLetterConfig {
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  deadLetterAfter: number;
}
