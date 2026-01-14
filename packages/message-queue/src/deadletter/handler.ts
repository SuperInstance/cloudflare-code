/**
 * Dead Letter Handler
 * Manages failed messages, retry policies, and recovery strategies
 */

import type {
  Message,
  DeadLetterEntry,
  RetryPolicy,
  QueueConfig
} from '../types';
import { RetryPolicyType, MessageState } from '../types';
import { generateDeadLetterId } from '../utils/id-generator';
import { calculateRetryDelay, shouldRetry, isNonRetryableError, createRetryState, updateRetryState } from '../utils/retry-calculator';
import { getQueueManager } from '../queue/manager';

/**
 * Dead letter storage
 */
interface DeadLetterStorage {
  entries: Map<string, DeadLetterEntry>;
  queueIndex: Map<string, Set<string>>; // queueName -> entry IDs
  errorIndex: Map<string, Set<string>>; // errorType -> entry IDs
  retrySchedule: Map<string, Set<string>>; // timestamp -> entry IDs
}

/**
 * Recovery strategy
 */
export enum RecoveryStrategy {
  /** Retry immediately */
  IMMEDIATE_RETRY = 'immediate-retry',
  /** Retry with backoff */
  BACKOFF_RETRY = 'backoff-retry',
  /** Move to specific queue */
  MOVE_TO_QUEUE = 'move-to-queue',
  /** Discard message */
  DISCARD = 'discard',
  /** Manual review required */
  MANUAL_REVIEW = 'manual-review'
}

/**
 * Recovery action result
 */
export interface RecoveryActionResult {
  success: boolean;
  action: RecoveryStrategy;
  messageId: string;
  error?: string;
}

/**
 * Dead Letter Handler class
 */
export class DeadLetterHandler {
  private queueManager: ReturnType<typeof getQueueManager>;
  private storage: DeadLetterStorage;
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();
  private maxEntries: number = 100000;
  private retentionMs: number = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor() {
    this.queueManager = getQueueManager();
    this.storage = {
      entries: new Map(),
      queueIndex: new Map(),
      errorIndex: new Map(),
      retrySchedule: new Map()
    };
  }

  /**
   * Handle failed message
   */
  async handleFailedMessage(
    message: Message,
    error: Error,
    queueName: string,
    retryPolicy?: RetryPolicy
  ): Promise<{
    success: boolean;
    action: RecoveryStrategy;
    entryId?: string;
    error?: string;
  }> {
    try {
      // Determine if should retry
      const canRetry = retryPolicy && shouldRetry(retryPolicy, message.retryCount, error);

      if (canRetry && retryPolicy) {
        // Schedule retry
        return await this.scheduleRetry(message, error, queueName, retryPolicy);
      } else {
        // Move to dead letter queue
        return await this.sendToDeadLetter(message, error, queueName);
      }
    } catch (err) {
      return {
        success: false,
        action: RecoveryStrategy.DISCARD,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }

  /**
   * Schedule message for retry
   */
  private async scheduleRetry(
    message: Message,
    error: Error,
    queueName: string,
    retryPolicy: RetryPolicy
  ): Promise<{
    success: boolean;
    action: RecoveryStrategy;
    entryId?: string;
    error?: string;
  }> {
    try {
      // Calculate retry delay
      const delay = calculateRetryDelay(retryPolicy, message.retryCount);
      const nextRetryAt = Date.now() + delay;

      // Create dead letter entry
      const entryId = generateDeadLetterId(message.id);
      const entry: DeadLetterEntry = {
        message: {
          ...message,
          state: MessageState.PENDING,
          timestamps: {
            ...message.timestamps,
            nextDeliveryAt: nextRetryAt
          }
        },
        reason: error.message,
        error,
        timestamp: Date.now(),
        originalQueue: queueName,
        retryCount: message.retryCount + 1,
        nextRetryAt
      };

      // Store entry
      this.storage.entries.set(entryId, entry);

      // Update indexes
      this.updateIndexes(entryId, entry, queueName, error);

      // Schedule retry
      this.scheduleRetryTimer(entryId, entry, delay, retryPolicy);

      return {
        success: true,
        action: RecoveryStrategy.BACKOFF_RETRY,
        entryId
      };
    } catch (err) {
      return {
        success: false,
        action: RecoveryStrategy.DISCARD,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }

  /**
   * Send message to dead letter queue
   */
  private async sendToDeadLetter(
    message: Message,
    error: Error,
    queueName: string
  ): Promise<{
    success: boolean;
    action: RecoveryStrategy;
    entryId?: string;
    error?: string;
  }> {
    try {
      // Create dead letter entry
      const entryId = generateDeadLetterId(message.id);
      const entry: DeadLetterEntry = {
        message: {
          ...message,
          state: MessageState.DEAD_LETTERED,
          timestamps: {
            ...message.timestamps,
            failedAt: Date.now()
          }
        },
        reason: error.message,
        error,
        timestamp: Date.now(),
        originalQueue: queueName,
        retryCount: message.retryCount
      };

      // Check storage limit
      if (this.storage.entries.size >= this.maxEntries) {
        // Evict oldest entry
        this.evictOldestEntry();
      }

      // Store entry
      this.storage.entries.set(entryId, entry);

      // Update indexes
      this.updateIndexes(entryId, entry, queueName, error);

      // Update queue metrics
      this.queueManager.incrementFailedCount(queueName);

      return {
        success: true,
        action: RecoveryStrategy.MANUAL_REVIEW,
        entryId
      };
    } catch (err) {
      return {
        success: false,
        action: RecoveryStrategy.DISCARD,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }

  /**
   * Update indexes for dead letter entry
   */
  private updateIndexes(entryId: string, entry: DeadLetterEntry, queueName: string, error: Error): void {
    // Queue index
    if (!this.storage.queueIndex.has(queueName)) {
      this.storage.queueIndex.set(queueName, new Set());
    }
    this.storage.queueIndex.get(queueName)!.add(entryId);

    // Error index
    const errorType = error.constructor.name;
    if (!this.storage.errorIndex.has(errorType)) {
      this.storage.errorIndex.set(errorType, new Set());
    }
    this.storage.errorIndex.get(errorType)!.add(entryId);

    // Retry schedule
    if (entry.nextRetryAt) {
      const timeKey = entry.nextRetryAt.toString();
      if (!this.storage.retrySchedule.has(timeKey)) {
        this.storage.retrySchedule.set(timeKey, new Set());
      }
      this.storage.retrySchedule.get(timeKey)!.add(entryId);
    }
  }

  /**
   * Schedule retry timer
   */
  private scheduleRetryTimer(
    entryId: string,
    entry: DeadLetterEntry,
    delay: number,
    retryPolicy: RetryPolicy
  ): void {
    const timer = setTimeout(async () => {
      try {
        await this.executeRetry(entryId, entry, retryPolicy);
      } catch (error) {
        console.error(`Retry failed for entry ${entryId}:`, error);
      }
    }, delay);

    this.retryTimers.set(entryId, timer);
  }

  /**
   * Execute retry
   */
  private async executeRetry(
    entryId: string,
    entry: DeadLetterEntry,
    retryPolicy: RetryPolicy
  ): Promise<void> {
    try {
      // Remove from retry schedule
      if (entry.nextRetryAt) {
        const timeKey = entry.nextRetryAt.toString();
        this.storage.retrySchedule.get(timeKey)?.delete(entryId);
      }

      // Remove timer
      this.retryTimers.delete(entryId);

      // Remove from dead letter storage
      this.storage.entries.delete(entryId);

      // Re-add message to original queue
      const queueConfig = this.queueManager.getQueueConfig(entry.originalQueue);
      if (queueConfig) {
        // In production, this would use the producer to re-publish
        // For now, update the message state
        entry.message.state = MessageState.PENDING;
        entry.message.retryCount = entry.retryCount;

        // Update queue state
        this.queueManager.incrementMessageCount(entry.originalQueue);
      }
    } catch (error) {
      // Retry failed, send to dead letter
      await this.sendToDeadLetter(entry.message, error as Error, entry.originalQueue);
    }
  }

  /**
   * Recover a dead letter entry
   */
  async recoverEntry(
    entryId: string,
    strategy: RecoveryStrategy
  ): Promise<RecoveryActionResult> {
    try {
      const entry = this.storage.entries.get(entryId);
      if (!entry) {
        return {
          success: false,
          action: strategy,
          messageId: '',
          error: 'Entry not found'
        };
      }

      switch (strategy) {
        case RecoveryStrategy.IMMEDIATE_RETRY:
          return await this.immediateRetry(entryId, entry);

        case RecoveryStrategy.BACKOFF_RETRY:
          return await this.backoffRetry(entryId, entry);

        case RecoveryStrategy.MOVE_TO_QUEUE:
          return await this.moveToQueue(entryId, entry);

        case RecoveryStrategy.DISCARD:
          return await this.discardEntry(entryId, entry);

        case RecoveryStrategy.MANUAL_REVIEW:
          return {
            success: true,
            action: strategy,
            messageId: entry.message.id
          };

        default:
          return {
            success: false,
            action: strategy,
            messageId: entry.message.id,
            error: 'Unknown recovery strategy'
          };
      }
    } catch (error) {
      return {
        success: false,
        action: strategy,
        messageId: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Immediate retry
   */
  private async immediateRetry(entryId: string, entry: DeadLetterEntry): Promise<RecoveryActionResult> {
    // Cancel any existing retry timer
    const timer = this.retryTimers.get(entryId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(entryId);
    }

    // Execute retry immediately
    await this.executeRetry(entryId, entry, {
      type: RetryPolicyType.FIXED_DELAY,
      maxRetries: 0,
      initialDelay: 0
    });

    return {
      success: true,
      action: RecoveryStrategy.IMMEDIATE_RETRY,
      messageId: entry.message.id
    };
  }

  /**
   * Backoff retry
   */
  private async backoffRetry(entryId: string, entry: DeadLetterEntry): Promise<RecoveryActionResult> {
    // Cancel existing timer
    const timer = this.retryTimers.get(entryId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(entryId);
    }

    // Schedule new retry with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, entry.retryCount), 60000); // Max 60 seconds
    const retryPolicy: RetryPolicy = {
      type: RetryPolicyType.EXPONENTIAL_BACKOFF,
      maxRetries: 10,
      initialDelay: delay,
      backoffMultiplier: 2
    };

    this.scheduleRetryTimer(entryId, entry, delay, retryPolicy);

    return {
      success: true,
      action: RecoveryStrategy.BACKOFF_RETRY,
      messageId: entry.message.id
    };
  }

  /**
   * Move to queue
   */
  private async moveToQueue(entryId: string, entry: DeadLetterEntry): Promise<RecoveryActionResult> {
    // Remove from dead letter storage
    this.storage.entries.delete(entryId);
    this.storage.queueIndex.get(entry.originalQueue)?.delete(entryId);

    // In production, this would use the producer to publish to the specified queue
    // For now, update state and metrics
    entry.message.state = MessageState.PENDING;
    entry.message.retryCount = 0;

    this.queueManager.incrementMessageCount(entry.originalQueue);

    return {
      success: true,
      action: RecoveryStrategy.MOVE_TO_QUEUE,
      messageId: entry.message.id
    };
  }

  /**
   * Discard entry
   */
  private async discardEntry(entryId: string, entry: DeadLetterEntry): Promise<RecoveryActionResult> {
    // Cancel any existing retry timer
    const timer = this.retryTimers.get(entryId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(entryId);
    }

    // Remove from storage
    this.storage.entries.delete(entryId);
    this.storage.queueIndex.get(entry.originalQueue)?.delete(entryId);

    return {
      success: true,
      action: RecoveryStrategy.DISCARD,
      messageId: entry.message.id
    };
  }

  /**
   * Get dead letter entry
   */
  getEntry(entryId: string): DeadLetterEntry | null {
    return this.storage.entries.get(entryId) || null;
  }

  /**
   * List dead letter entries for a queue
   */
  listEntries(queueName: string, options?: {
    limit?: number;
    offset?: number;
    errorType?: string;
  }): DeadLetterEntry[] {
    const entryIds = this.storage.queueIndex.get(queueName);
    if (!entryIds) return [];

    let entries: DeadLetterEntry[] = [];
    for (const id of entryIds) {
      const entry = this.storage.entries.get(id);
      if (entry) {
        // Filter by error type if specified
        if (!options?.errorType || entry.error?.constructor.name === options.errorType) {
          entries.push(entry);
        }
      }
    }

    // Sort by timestamp (newest first)
    entries.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    if (options?.offset !== undefined) {
      entries = entries.slice(options.offset);
    }
    if (options?.limit !== undefined) {
      entries = entries.slice(0, options.limit);
    }

    return entries;
  }

  /**
   * Get dead letter statistics
   */
  getStatistics(queueName?: string): {
    totalEntries: number;
    entriesByQueue: Record<string, number>;
    entriesByError: Record<string, number>;
    pendingRetries: number;
  } {
    const entriesByQueue: Record<string, number> = {};
    const entriesByError: Record<string, number> = {};
    let pendingRetries = 0;

    for (const [id, entry] of this.storage.entries) {
      // Count by queue
      if (!queueName || entry.originalQueue === queueName) {
        entriesByQueue[entry.originalQueue] = (entriesByQueue[entry.originalQueue] || 0) + 1;

        // Count by error type
        if (entry.error) {
          const errorType = entry.error.constructor.name;
          entriesByError[errorType] = (entriesByError[errorType] || 0) + 1;
        }

        // Count pending retries
        if (entry.nextRetryAt && entry.nextRetryAt > Date.now()) {
          pendingRetries++;
        }
      }
    }

    const totalEntries = queueName
      ? (entriesByQueue[queueName] || 0)
      : this.storage.entries.size;

    return {
      totalEntries,
      entriesByQueue,
      entriesByError,
      pendingRetries
    };
  }

  /**
   * Evict oldest entry
   */
  private evictOldestEntry(): void {
    let oldestEntryId: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [id, entry] of this.storage.entries) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestEntryId = id;
      }
    }

    if (oldestEntryId) {
      const entry = this.storage.entries.get(oldestEntryId)!;
      this.storage.entries.delete(oldestEntryId);
      this.storage.queueIndex.get(entry.originalQueue)?.delete(oldestEntryId);
    }
  }

  /**
   * Clean up expired entries
   */
  async cleanupExpiredEntries(): Promise<number> {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [id, entry] of this.storage.entries) {
      if (now - entry.timestamp > this.retentionMs) {
        expiredIds.push(id);
      }
    }

    for (const id of expiredIds) {
      const entry = this.storage.entries.get(id);
      if (entry) {
        this.storage.entries.delete(id);
        this.storage.queueIndex.get(entry.originalQueue)?.delete(id);

        // Cancel retry timer if exists
        const timer = this.retryTimers.get(id);
        if (timer) {
          clearTimeout(timer);
          this.retryTimers.delete(id);
        }
      }
    }

    return expiredIds.length;
  }

  /**
   * Clear all entries for a queue
   */
  clearQueue(queueName: string): number {
    const entryIds = this.storage.queueIndex.get(queueName);
    if (!entryIds) return 0;

    let count = 0;
    for (const id of entryIds) {
      const entry = this.storage.entries.get(id);
      if (entry) {
        this.storage.entries.delete(id);

        // Cancel retry timer
        const timer = this.retryTimers.get(id);
        if (timer) {
          clearTimeout(timer);
          this.retryTimers.delete(id);
        }

        count++;
      }
    }

    this.storage.queueIndex.delete(queueName);
    return count;
  }

  /**
   * Set max entries limit
   */
  setMaxEntries(limit: number): void {
    this.maxEntries = limit;

    // Evict entries if over limit
    while (this.storage.entries.size > this.maxEntries) {
      this.evictOldestEntry();
    }
  }

  /**
   * Set retention period
   */
  setRetentionPeriod(ms: number): void {
    this.retentionMs = ms;
  }

  /**
   * Close handler and cleanup resources
   */
  async close(): Promise<void> {
    // Cancel all retry timers
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();

    // Clear storage
    this.storage.entries.clear();
    this.storage.queueIndex.clear();
    this.storage.errorIndex.clear();
    this.storage.retrySchedule.clear();
  }
}

/**
 * Create a new dead letter handler
 */
export function createDeadLetterHandler(): DeadLetterHandler {
  return new DeadLetterHandler();
}

/**
 * Global dead letter handler instance
 */
let globalDeadLetterHandler: DeadLetterHandler | null = null;

/**
 * Get or create global dead letter handler
 */
export function getDeadLetterHandler(): DeadLetterHandler {
  if (!globalDeadLetterHandler) {
    globalDeadLetterHandler = new DeadLetterHandler();
  }
  return globalDeadLetterHandler;
}

/**
 * Reset global dead letter handler (useful for testing)
 */
export function resetDeadLetterHandler(): void {
  if (globalDeadLetterHandler) {
    globalDeadLetterHandler.close();
    globalDeadLetterHandler = null;
  }
}

/**
 * Helper function to handle failed message
 */
export async function handleFailedMessage(
  message: Message,
  error: Error,
  queueName: string,
  retryPolicy?: RetryPolicy
): Promise<{
  success: boolean;
  action: RecoveryStrategy;
  entryId?: string;
  error?: string;
}> {
  const handler = getDeadLetterHandler();
  return handler.handleFailedMessage(message, error, queueName, retryPolicy);
}

/**
 * Helper function to recover dead letter entry
 */
export async function recoverDeadLetterEntry(
  entryId: string,
  strategy: RecoveryStrategy
): Promise<RecoveryActionResult> {
  const handler = getDeadLetterHandler();
  return handler.recoverEntry(entryId, strategy);
}

/**
 * Helper function to list dead letter entries
 */
export function listDeadLetterEntries(
  queueName: string,
  options?: {
    limit?: number;
    offset?: number;
    errorType?: string;
  }
): DeadLetterEntry[] {
  const handler = getDeadLetterHandler();
  return handler.listEntries(queueName, options);
}

/**
 * Helper function to get dead letter statistics
 */
export function getDeadLetterStatistics(queueName?: string): {
  totalEntries: number;
  entriesByQueue: Record<string, number>;
  entriesByError: Record<string, number>;
  pendingRetries: number;
} {
  const handler = getDeadLetterHandler();
  return handler.getStatistics(queueName);
}
