/**
 * Queue Manager
 * Manages queue lifecycle, configuration, and monitoring
 */

import type {
  QueueConfig,
  QueueStats,
  QueueMetrics,
  QueueFilterOptions,
  HealthCheckResult,
  PurgeOptions,
  QueueType
} from '../types';
import {
  DeliveryGuarantee,
  QueueEventType
} from '../types';
import { generateQueueId, generateEventId } from '../utils/id-generator';
import { validateQueueName } from '../utils/message-validator';

/**
 * Queue storage interface
 */
interface QueueStorage {
  config: QueueConfig;
  state: QueueState;
  createdAt: number;
  updatedAt: number;
}

/**
 * Queue state
 */
interface QueueState {
  messageCount: number;
  notVisibleCount: number;
  delayedCount: number;
  deadLetterCount: number;
  totalProcessed: number;
  totalFailed: number;
  lastActivityAt: number;
}

/**
 * Queue Manager class
 */
export class QueueManager {
  private queues: Map<string, QueueStorage> = new Map();
  private metrics: Map<string, QueueMetrics> = new Map();
  private eventHandlers: Map<QueueEventType, Set<(event: unknown) => void>> = new Map();

  /**
   * Create a new queue
   */
  async createQueue(config: QueueConfig): Promise<{
    success: boolean;
    queueId: string;
    error?: string;
  }> {
    try {
      // Validate queue name
      const nameValidation = validateQueueName(config.name);
      if (!nameValidation.valid) {
        return {
          success: false,
          queueId: '',
          error: `Invalid queue name: ${nameValidation.errors.map(e => e.message).join(', ')}`
        };
      }

      // Check if queue already exists
      if (this.queues.has(config.name)) {
        return {
          success: false,
          queueId: '',
          error: `Queue '${config.name}' already exists`
        };
      }

      // Generate queue ID
      const queueId = generateQueueId(config.name);

      // Initialize queue state
      const queueState: QueueState = {
        messageCount: 0,
        notVisibleCount: 0,
        delayedCount: 0,
        deadLetterCount: 0,
        totalProcessed: 0,
        totalFailed: 0,
        lastActivityAt: Date.now()
      };

      // Store queue configuration and state
      const storage: QueueStorage = {
        config,
        state: queueState,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      this.queues.set(config.name, storage);

      // Initialize metrics
      this.initializeMetrics(config.name);

      // Emit queue created event
      await this.emitEvent(QueueEventType.QUEUE_CREATED, {
        queueName: config.name,
        queueId,
        config,
        timestamp: Date.now()
      });

      return {
        success: true,
        queueId
      };
    } catch (error) {
      return {
        success: false,
        queueId: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete a queue
   */
  async deleteQueue(queueName: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const storage = this.queues.get(queueName);
      if (!storage) {
        return {
          success: false,
          error: `Queue '${queueName}' not found`
        };
      }

      // Remove queue
      this.queues.delete(queueName);
      this.metrics.delete(queueName);

      // Emit queue deleted event
      await this.emitEvent(QueueEventType.QUEUE_DELETED, {
        queueName,
        timestamp: Date.now()
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get queue configuration
   */
  getQueueConfig(queueName: string): QueueConfig | null {
    const storage = this.queues.get(queueName);
    return storage?.config || null;
  }

  /**
   * Update queue configuration
   */
  async updateQueueConfig(
    queueName: string,
    updates: Partial<QueueConfig>
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const storage = this.queues.get(queueName);
      if (!storage) {
        return {
          success: false,
          error: `Queue '${queueName}' not found`
        };
      }

      // Merge updates with existing config
      storage.config = {
        ...storage.config,
        ...updates
      };
      storage.updatedAt = Date.now();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List all queues
   */
  listQueues(options?: QueueFilterOptions): Array<{
    name: string;
    type: QueueType;
    createdAt: number;
    messageCount: number;
  }> {
    let queues = Array.from(this.queues.entries()).map(([name, storage]) => ({
      name,
      type: storage.config.type,
      createdAt: storage.createdAt,
      messageCount: storage.state.messageCount
    }));

    // Apply filters
    if (options?.type) {
      queues = queues.filter(q => q.type === options.type);
    }

    if (options?.namePattern) {
      const pattern = new RegExp(options.namePattern);
      queues = queues.filter(q => pattern.test(q.name));
    }

    // Apply pagination
    if (options?.limit !== undefined) {
      const offset = options.offset || 0;
      queues = queues.slice(offset, offset + options.limit);
    }

    return queues;
  }

  /**
   * Get queue statistics
   */
  getQueueStats(queueName: string): QueueStats | null {
    const storage = this.queues.get(queueName);
    if (!storage) {
      return null;
    }

    const { state, config } = storage;
    const metrics = this.metrics.get(queueName);

    return {
      name: queueName,
      approximateMessageCount: state.messageCount,
      approximateNotVisibleCount: state.notVisibleCount,
      approximateDelayedCount: state.delayedCount,
      deadLetterCount: state.deadLetterCount,
      sizeStats: {
        min: 0,
        max: config.maxMessageSize || 256 * 1024,
        average: 0,
        total: state.messageCount * (config.maxMessageSize || 256 * 1024)
      },
      processingStats: {
        totalProcessed: state.totalProcessed,
        successful: state.totalProcessed - state.totalFailed,
        failed: state.totalFailed,
        averageProcessingTime: metrics?.consumer.averageProcessingLatency || 0,
        throughput: metrics?.consumer.totalConsumed || 0
      },
      timestamp: Date.now()
    };
  }

  /**
   * Get queue metrics
   */
  getQueueMetrics(queueName: string): QueueMetrics | null {
    return this.metrics.get(queueName) || null;
  }

  /**
   * Update queue state
   */
  updateQueueState(
    queueName: string,
    updates: Partial<QueueState>
  ): void {
    const storage = this.queues.get(queueName);
    if (storage) {
      storage.state = {
        ...storage.state,
        ...updates,
        lastActivityAt: Date.now()
      };
      storage.updatedAt = Date.now();
    }
  }

  /**
   * Increment message count
   */
  incrementMessageCount(queueName: string, amount: number = 1): void {
    const storage = this.queues.get(queueName);
    if (storage) {
      storage.state.messageCount += amount;
      storage.state.lastActivityAt = Date.now();
      storage.updatedAt = Date.now();
    }
  }

  /**
   * Decrement message count
   */
  decrementMessageCount(queueName: string, amount: number = 1): void {
    const storage = this.queues.get(queueName);
    if (storage) {
      storage.state.messageCount = Math.max(0, storage.state.messageCount - amount);
      storage.state.lastActivityAt = Date.now();
      storage.updatedAt = Date.now();
    }
  }

  /**
   * Increment processed count
   */
  incrementProcessedCount(queueName: string, amount: number = 1): void {
    const storage = this.queues.get(queueName);
    if (storage) {
      storage.state.totalProcessed += amount;
      storage.state.lastActivityAt = Date.now();
      storage.updatedAt = Date.now();
    }
  }

  /**
   * Increment failed count
   */
  incrementFailedCount(queueName: string, amount: number = 1): void {
    const storage = this.queues.get(queueName);
    if (storage) {
      storage.state.totalFailed += amount;
      storage.state.lastActivityAt = Date.now();
      storage.updatedAt = Date.now();
    }
  }

  /**
   * Purge queue
   */
  async purgeQueue(
    queueName: string,
    options?: PurgeOptions
  ): Promise<{
    success: boolean;
    purgedCount: number;
    error?: string;
  }> {
    try {
      const storage = this.queues.get(queueName);
      if (!storage) {
        return {
          success: false,
          purgedCount: 0,
          error: `Queue '${queueName}' not found`
        };
      }

      let purgedCount = 0;

      if (options?.messageIds && options.messageIds.length > 0) {
        // Purge specific messages (would need to be implemented with actual message store)
        purgedCount = options.messageIds.length;
      } else {
        // Purge all messages
        purgedCount = storage.state.messageCount;
        storage.state.messageCount = 0;
        storage.state.notVisibleCount = 0;
        storage.state.delayedCount = 0;
      }

      // Emit queue purged event
      await this.emitEvent(QueueEventType.QUEUE_PURGED, {
        queueName,
        purgedCount,
        timestamp: Date.now()
      });

      return {
        success: true,
        purgedCount
      };
    } catch (error) {
      return {
        success: false,
        purgedCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Health check for queue
   */
  async healthCheck(queueName: string): Promise<HealthCheckResult> {
    const checks: Array<{
      name: string;
      status: 'pass' | 'fail' | 'warn';
      message?: string;
      duration: number;
    }> = [];

    const startTime = Date.now();

    // Check if queue exists
    const storage = this.queues.get(queueName);
    const existsCheck = {
      name: 'queue_exists',
      status: (storage ? 'pass' : 'fail') as 'pass' | 'fail',
      message: storage ? 'Queue exists' : 'Queue not found',
      duration: Date.now() - startTime
    };
    checks.push(existsCheck);

    if (!storage) {
      return {
        healthy: false,
        queueName,
        checks,
        timestamp: Date.now()
      };
    }

    // Check message count
    const checkStart = Date.now();
    const messageCount = storage.state.messageCount;
    checks.push({
      name: 'message_count',
      status: messageCount < 1000000 ? 'pass' : 'warn',
      message: `Message count: ${messageCount}`,
      duration: Date.now() - checkStart
    });

    // Check failure rate
    const failureRate = storage.state.totalProcessed > 0
      ? storage.state.totalFailed / storage.state.totalProcessed
      : 0;
    checks.push({
      name: 'failure_rate',
      status: failureRate < 0.1 ? 'pass' : failureRate < 0.5 ? 'warn' : 'fail',
      message: `Failure rate: ${(failureRate * 100).toFixed(2)}%`,
      duration: Date.now() - checkStart
    });

    // Check recent activity
    const timeSinceActivity = Date.now() - storage.state.lastActivityAt;
    checks.push({
      name: 'recent_activity',
      status: timeSinceActivity < 300000 ? 'pass' : 'warn',
      message: `Last activity: ${timeSinceActivity / 1000}s ago`,
      duration: Date.now() - checkStart
    });

    // Overall health is pass if all critical checks pass
    const healthy = checks.every(c => c.status !== 'fail');

    return {
      healthy,
      queueName,
      checks,
      timestamp: Date.now()
    };
  }

  /**
   * Check if queue exists
   */
  queueExists(queueName: string): boolean {
    return this.queues.has(queueName);
  }

  /**
   * Get queue count
   */
  getQueueCount(): number {
    return this.queues.size;
  }

  /**
   * Get total message count across all queues
   */
  getTotalMessageCount(): number {
    let total = 0;
    for (const storage of this.queues.values()) {
      total += storage.state.messageCount;
    }
    return total;
  }

  /**
   * Register event handler
   */
  on(event: QueueEventType, handler: (event: unknown) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Unregister event handler
   */
  off(event: QueueEventType, handler: (event: unknown) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Emit event to handlers
   */
  private async emitEvent(
    type: QueueEventType,
    data: unknown
  ): Promise<void> {
    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      const event = {
        type,
        data,
        eventId: generateEventId(),
        timestamp: Date.now()
      };

      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (error) {
          console.error('Error in event handler:', error);
        }
      }
    }
  }

  /**
   * Initialize metrics for a queue
   */
  private initializeMetrics(queueName: string): void {
    this.metrics.set(queueName, {
      queueName,
      producer: {
        totalPublished: 0,
        successRate: 1,
        averageLatency: 0,
        bytesPublished: 0
      },
      consumer: {
        totalConsumed: 0,
        acknowledgmentRate: 1,
        averageProcessingLatency: 0,
        activeConsumers: 0
      },
      errors: {
        totalErrors: 0,
        errorRate: 0,
        errorsByType: {},
        recentErrors: []
      },
      timestamp: Date.now()
    });
  }

  /**
   * Update metrics for a queue
   */
  updateMetrics(
    queueName: string,
    updates: Partial<QueueMetrics>
  ): void {
    const metrics = this.metrics.get(queueName);
    if (metrics) {
      Object.assign(metrics, updates);
      metrics.timestamp = Date.now();
    }
  }

  /**
   * Reset metrics for a queue
   */
  resetMetrics(queueName: string): void {
    this.initializeMetrics(queueName);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, QueueMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Export queue state for backup/replication
   */
  exportQueueState(queueName: string): {
    config: QueueConfig;
    state: QueueState;
    createdAt: number;
    updatedAt: number;
  } | null {
    const storage = this.queues.get(queueName);
    if (!storage) {
      return null;
    }

    return {
      config: storage.config,
      state: { ...storage.state },
      createdAt: storage.createdAt,
      updatedAt: storage.updatedAt
    };
  }

  /**
   * Import queue state from backup
   */
  importQueueState(
    queueName: string,
    state: {
      config: QueueConfig;
      state: QueueState;
      createdAt: number;
      updatedAt: number;
    }
  ): { success: boolean; error?: string } {
    try {
      const storage: QueueStorage = {
        config: state.config,
        state: state.state,
        createdAt: state.createdAt,
        updatedAt: Date.now()
      };

      this.queues.set(queueName, storage);
      this.initializeMetrics(queueName);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * Global queue manager instance
 */
let globalQueueManager: QueueManager | null = null;

/**
 * Get or create global queue manager
 */
export function getQueueManager(): QueueManager {
  if (!globalQueueManager) {
    globalQueueManager = new QueueManager();
  }
  return globalQueueManager;
}

/**
 * Reset global queue manager (useful for testing)
 */
export function resetQueueManager(): void {
  globalQueueManager = null;
}
