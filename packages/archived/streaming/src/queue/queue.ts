/**
 * Message queue implementation with FIFO, priority, and dead letter queues
 * Supports at-least-once, at-most-once, and exactly-once delivery semantics
 */

import type {
  Message,
  MessageMetadata,
  QueueOptions,
  QueueType,
  DeliveryGuarantee,
  RetryPolicy
} from '../types/index.js';
import { generateMessageId, generateCorrelationId } from '../utils/id-generator.js';
import { delay, retry } from '../utils/timing.js';

// ============================================================================
// Queue Core
// ============================================================================

export class MessageQueue<T = unknown> {
  private messages: Map<string, Message<T>> = new Map();
  private deadLetterQueue: Map<string, Message<T>> = new Map();
  private processing: Set<string> = new Set();
  private delivered: Map<string, number> = new Map(); // For deduplication
  private options: Required<QueueOptions>;
  private stats: QueueStats;

  constructor(options: QueueOptions = {}) {
    this.options = {
      type: options.type ?? 'fifo',
      maxSize: options.maxSize ?? 10000,
      deadLetterQueue: options.deadLetterQueue ?? 'dlq',
      retention: options.retention ?? 24 * 60 * 60 * 1000, // 24 hours
      deliveryDelay: options.deliveryDelay ?? 0,
      receiveWaitTime: options.receiveWaitTime ?? 0,
      visibilityTimeout: options.visibilityTimeout ?? 30000,
    };

    this.stats = {
      enqueued: 0,
      dequeued: 0,
      acknowledged: 0,
      rejected: 0,
      deadLettered: 0,
      retried: 0,
    };

    // Start cleanup timer
    this.startCleanup();
  }

  // ========================================================================
  // Message Enqueuing
  // ========================================================================

  /**
   * Enqueue a message
   */
  async enqueue(
    payload: T,
    options: {
      priority?: number;
      delay?: number;
      deduplicationId?: string;
      groupId?: string;
    } = {}
  ): Promise<string> {
    // Check deduplication
    if (options.deduplicationId) {
      const existing = Array.from(this.messages.values()).find(
        m => m.metadata?.deduplicationId === options.deduplicationId
      );
      if (existing) {
        return existing.id;
      }
    }

    // Check queue size limit
    if (this.messages.size >= this.options.maxSize) {
      throw new Error('Queue is full');
    }

    const id = generateMessageId();
    const metadata: MessageMetadata = {
      createdAt: Date.now(),
      scheduledAt: options.delay ? Date.now() + options.delay : undefined,
      expiresAt: this.options.retention ? Date.now() + this.options.retention : undefined,
      correlationId: generateCorrelationId(),
      groupId: options.groupId,
      deduplicationId: options.deduplicationId,
    };

    const message: Message<T> = {
      id,
      payload,
      priority: options.priority ?? 5,
      attempts: 0,
      maxAttempts: 3,
      timeout: this.options.visibilityTimeout,
      deadline: metadata.expiresAt,
      metadata,
    };

    this.messages.set(id, message);
    this.stats.enqueued++;

    return id;
  }

  /**
   * Enqueue multiple messages
   */
  async enqueueBatch(messages: Array<{
    payload: T;
    priority?: number;
    delay?: number;
    deduplicationId?: string;
    groupId?: string;
  }>): Promise<string[]> {
    const ids: string[] = [];

    for (const msg of messages) {
      const id = await this.enqueue(msg.payload, msg);
      ids.push(id);
    }

    return ids;
  }

  // ========================================================================
  // Message Dequeuing
  // ========================================================================

  /**
   * Dequeue a message
   */
  async dequeue(deliveryGuarantee: DeliveryGuarantee = { type: 'at-least-once' }): Promise<Message<T> | null> {
    const message = this.getNextMessage();

    if (!message) {
      // Wait for message if receiveWaitTime is set
      if (this.options.receiveWaitTime > 0) {
        await delay(this.options.receiveWaitTime);
        return this.dequeue(deliveryGuarantee);
      }
      return null;
    }

    // Check if message is ready to be delivered
    if (message.metadata?.scheduledAt && message.metadata.scheduledAt > Date.now()) {
      return null;
    }

    // Check delivery guarantee
    if (deliveryGuarantee.type === 'at-most-once') {
      // Remove immediately
      this.messages.delete(message.id);
    } else if (deliveryGuarantee.type === 'exactly-once' && deliveryGuarantee.idempotenceKey) {
      // Check if already delivered
      const deliveryCount = this.delivered.get(deliveryGuarantee.idempotenceKey) ?? 0;
      if (deliveryCount > 0) {
        return null; // Already delivered
      }
      this.delivered.set(deliveryGuarantee.idempotenceKey, 1);
    }

    // Mark as processing
    this.processing.add(message.id);
    this.stats.dequeued++;

    return message;
  }

  /**
   * Dequeue multiple messages
   */
  async dequeueBatch(
    count: number,
    deliveryGuarantee: DeliveryGuarantee = { type: 'at-least-once' }
  ): Promise<Message<T>[]> {
    const messages: Message<T>[] = [];

    for (let i = 0; i < count; i++) {
      const message = await this.dequeue(deliveryGuarantee);
      if (!message) break;
      messages.push(message);
    }

    return messages;
  }

  /**
   * Peek at the next message without removing it
   */
  peek(): Message<T> | null {
    return this.getNextMessage();
  }

  // ========================================================================
  // Message Acknowledgment
  // ========================================================================

  /**
   * Acknowledge successful processing of a message
   */
  async acknowledge(messageId: string): Promise<boolean> {
    const message = this.messages.get(messageId);

    if (!message) {
      return false;
    }

    this.messages.delete(messageId);
    this.processing.delete(messageId);
    this.stats.acknowledged++;

    return true;
  }

  /**
   * Reject a message and optionally retry
   */
  async reject(
    messageId: string,
    options: {
      requeue?: boolean;
      delay?: number;
    } = {}
  ): Promise<boolean> {
    const message = this.messages.get(messageId);

    if (!message) {
      return false;
    }

    this.processing.delete(messageId);

    if (options.requeue) {
      // Increment attempts
      message.attempts = (message.attempts ?? 0) + 1;

      // Check max attempts
      if (message.attempts >= (message.maxAttempts ?? 3)) {
        // Move to dead letter queue
        this.moveToDeadLetterQueue(messageId);
        this.stats.deadLettered++;
        return true;
      }

      // Requeue with delay
      if (message.metadata) {
        message.metadata.scheduledAt = options.delay
          ? Date.now() + options.delay
          : Date.now();
      }

      this.stats.retried++;
    } else {
      // Remove message
      this.messages.delete(messageId);
      this.stats.rejected++;
    }

    return true;
  }

  /**
   * Extend message visibility timeout
   */
  async extendVisibilityTimeout(messageId: string, timeout: number): Promise<boolean> {
    const message = this.messages.get(messageId);

    if (!message || !this.processing.has(messageId)) {
      return false;
    }

    message.timeout = timeout;
    return true;
  }

  // ========================================================================
  // Queue Management
  // ========================================================================

  /**
   * Get queue size
   */
  size(): number {
    return this.messages.size;
  }

  /**
   * Get processing count
   */
  processingCount(): number {
    return this.processing.size;
  }

  /**
   * Get dead letter queue size
   */
  deadLetterQueueSize(): number {
    return this.deadLetterQueue.size;
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    return { ...this.stats };
  }

  /**
   * Clear all messages from the queue
   */
  clear(): void {
    this.messages.clear();
    this.processing.clear();
    this.delivered.clear();
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetterQueue(): void {
    this.deadLetterQueue.clear();
  }

  /**
   * Get message from dead letter queue
   */
  getFromDeadLetterQueue(messageId: string): Message<T> | undefined {
    return this.deadLetterQueue.get(messageId);
  }

  /**
   * Requeue message from dead letter queue
   */
  async requeueFromDeadLetterQueue(messageId: string): Promise<boolean> {
    const message = this.deadLetterQueue.get(messageId);

    if (!message) {
      return false;
    }

    // Reset attempts
    message.attempts = 0;

    // Move back to main queue
    this.deadLetterQueue.delete(messageId);
    this.messages.set(messageId, message);

    return true;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Get the next message based on queue type
   */
  private getNextMessage(): Message<T> | null {
    const now = Date.now();
    let candidate: Message<T> | null = null;

    switch (this.options.type) {
      case 'fifo':
        // Get oldest message
        for (const message of this.messages.values()) {
          if (this.processing.has(message.id)) continue;
          if (message.metadata?.scheduledAt && message.metadata.scheduledAt > now) continue;
          if (message.deadline && message.deadline < now) continue;

          if (!candidate || message.metadata!.createdAt! < candidate.metadata!.createdAt!) {
            candidate = message;
          }
        }
        break;

      case 'priority':
        // Get highest priority message (lowest number = highest priority)
        for (const message of this.messages.values()) {
          if (this.processing.has(message.id)) continue;
          if (message.metadata?.scheduledAt && message.metadata.scheduledAt > now) continue;
          if (message.deadline && message.deadline < now) continue;

          if (!candidate || (message.priority ?? 5) < (candidate.priority ?? 5)) {
            candidate = message;
          } else if (message.priority === candidate.priority) {
            // Tie-breaker: older message first
            if (message.metadata!.createdAt! < candidate.metadata!.createdAt!) {
              candidate = message;
            }
          }
        }
        break;

      case 'delayed':
        // Get next scheduled message
        for (const message of this.messages.values()) {
          if (this.processing.has(message.id)) continue;
          if (message.metadata?.scheduledAt && message.metadata.scheduledAt > now) {
            if (!candidate || message.metadata.scheduledAt < candidate.metadata!.scheduledAt!) {
              candidate = message;
            }
            continue;
          }

          if (!candidate || message.metadata!.createdAt! < candidate.metadata!.createdAt!) {
            candidate = message;
          }
        }
        break;
    }

    return candidate;
  }

  /**
   * Move message to dead letter queue
   */
  private moveToDeadLetterQueue(messageId: string): void {
    const message = this.messages.get(messageId);

    if (!message) {
      return;
    }

    this.messages.delete(messageId);
    this.processing.delete(messageId);
    this.deadLetterQueue.set(messageId, message);
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  /**
   * Cleanup expired messages
   */
  private cleanup(): void {
    const now = Date.now();

    // Clean up expired messages
    for (const [id, message] of this.messages) {
      if (message.deadline && message.deadline < now) {
        this.moveToDeadLetterQueue(id);
      }
    }

    // Clean up deduplication records
    for (const [key, timestamp] of this.delivered) {
      if (timestamp < now - this.options.retention) {
        this.delivered.delete(key);
      }
    }
  }
}

// ============================================================================
// Priority Queue
// ============================================================================

export class PriorityQueue<T> extends MessageQueue<T> {
  constructor(options: QueueOptions = {}) {
    super({ ...options, type: 'priority' });
  }

  /**
   * Enqueue with explicit priority
   */
  async enqueueWithPriority(
    payload: T,
    priority: number,
    options: {
      delay?: number;
      deduplicationId?: string;
      groupId?: string;
    } = {}
  ): Promise<string> {
    return this.enqueue(payload, { ...options, priority });
  }
}

// ============================================================================
// FIFO Queue
// ============================================================================

export class FIFOQueue<T> extends MessageQueue<T> {
  constructor(options: QueueOptions = {}) {
    super({ ...options, type: 'fifo' });
  }
}

// ============================================================================
// Delayed Queue
// ============================================================================

export class DelayedQueue<T> extends MessageQueue<T> {
  constructor(options: QueueOptions = {}) {
    super({ ...options, type: 'delayed' });
  }

  /**
   * Enqueue with delay
   */
  async enqueueDelayed(
    payload: T,
    delayMs: number,
    options: {
      priority?: number;
      deduplicationId?: string;
      groupId?: string;
    } = {}
  ): Promise<string> {
    return this.enqueue(payload, { ...options, delay: delayMs });
  }
}

// ============================================================================
// Queue Statistics
// ============================================================================

interface QueueStats {
  enqueued: number;
  dequeued: number;
  acknowledged: number;
  rejected: number;
  deadLettered: number;
  retried: number;
}

// ============================================================================
// Queue Manager
// ============================================================================

export class QueueManager {
  private queues: Map<string, MessageQueue> = new Map();

  /**
   * Create or get a queue
   */
  getQueue<T>(name: string, options?: QueueOptions): MessageQueue<T> {
    if (!this.queues.has(name)) {
      this.queues.set(name, new MessageQueue<T>(options));
    }

    return this.queues.get(name) as MessageQueue<T>;
  }

  /**
   * Delete a queue
   */
  deleteQueue(name: string): boolean {
    const queue = this.queues.get(name);
    if (queue) {
      queue.clear();
      queue.clearDeadLetterQueue();
      return this.queues.delete(name);
    }
    return false;
  }

  /**
   * List all queue names
   */
  listQueues(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * Get statistics for all queues
   */
  getAllStats(): Map<string, QueueStats> {
    const stats = new Map<string, QueueStats>();

    for (const [name, queue] of this.queues) {
      stats.set(name, queue.getStats());
    }

    return stats;
  }

  /**
   * Clear all queues
   */
  clearAll(): void {
    for (const queue of this.queues.values()) {
      queue.clear();
      queue.clearDeadLetterQueue();
    }
  }
}
