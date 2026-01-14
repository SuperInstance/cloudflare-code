/**
 * Retry Handler with exponential backoff for webhook deliveries
 */

import type {
  Webhook,
  WebhookDelivery,
  RetryStrategy,
  WebhookDeliveryStatus,
} from '../types/webhook.js';
import type { IWebhookDeliveryStorage } from '../types/storage.js';
import type { IKVStorage } from '../types/storage.js';
import { MaxRetriesExceededError } from '../types/errors.js';
import type { WebhookSystemConfig } from '../types/config.js';

/**
 * Retry calculation result
 */
export interface RetryCalculation {
  shouldRetry: boolean;
  attemptNumber: number;
  nextRetryAt: Date;
  delayMs: number;
  reason: string;
}

/**
 * Retry schedule item
 */
export interface RetryScheduleItem {
  deliveryId: string;
  webhookId: string;
  scheduledFor: Date;
  attemptNumber: number;
  priority: number;
}

/**
 * Retry statistics
 */
export interface RetryStatistics {
  totalRetries: number;
  successfulRetries: number;
  failedAfterMaxRetries: number;
  deadLettered: number;
  averageRetriesPerDelivery: number;
  byStrategy: Record<RetryStrategy, number>;
}

/**
 * Retry Handler class
 */
export class RetryHandler {
  private config: WebhookSystemConfig;
  private deliveryStorage: IWebhookDeliveryStorage;
  private kvStorage: IKVStorage;
  private retryQueue: Map<string, RetryScheduleItem[]>;
  private processing: Set<string>;

  constructor(
    config: WebhookSystemConfig,
    deliveryStorage: IWebhookDeliveryStorage,
    kvStorage: IKVStorage
  ) {
    this.config = config;
    this.deliveryStorage = deliveryStorage;
    this.kvStorage = kvStorage;
    this.retryQueue = new Map();
    this.processing = new Set();
  }

  /**
   * Calculate next retry schedule
   */
  public async calculateRetry(
    delivery: WebhookDelivery,
    statusCode?: number
  ): Promise<RetryCalculation> {
    const webhook = await this.getWebhookForDelivery(delivery);
    if (!webhook) {
      return {
        shouldRetry: false,
        attemptNumber: delivery.attemptNumber,
        nextRetryAt: new Date(),
        delayMs: 0,
        reason: 'Webhook not found',
      };
    }

    const retryConfig = webhook.retryConfig;

    // Check if retries are enabled
    if (!retryConfig.enabled) {
      return {
        shouldRetry: false,
        attemptNumber: delivery.attemptNumber,
        nextRetryAt: new Date(),
        delayMs: 0,
        reason: 'Retries disabled for this webhook',
      };
    }

    // Check if status code is retryable
    if (statusCode !== undefined) {
      const isRetryable = retryConfig.retryableStatusCodes.includes(statusCode);
      if (!isRetryable) {
        return {
          shouldRetry: false,
          attemptNumber: delivery.attemptNumber,
          nextRetryAt: new Date(),
          delayMs: 0,
          reason: `Status code ${statusCode} is not retryable`,
        };
      }
    }

    // Check max retries
    const nextAttempt = delivery.attemptNumber + 1;
    const maxAttempts = retryConfig.maxRetries || this.config.retry.maxAttempts;

    if (nextAttempt > maxAttempts) {
      return {
        shouldRetry: false,
        attemptNumber: delivery.attemptNumber,
        nextRetryAt: new Date(),
        delayMs: 0,
        reason: `Maximum retry attempts (${maxAttempts}) exceeded`,
      };
    }

    // Calculate delay
    const delayMs = this.calculateDelay(
      nextAttempt,
      retryConfig.strategy,
      retryConfig
    );

    const nextRetryAt = new Date(Date.now() + delayMs);

    return {
      shouldRetry: true,
      attemptNumber: nextAttempt,
      nextRetryAt,
      delayMs,
      reason: 'Retry scheduled',
    };
  }

  /**
   * Schedule a retry for a delivery
   */
  public async scheduleRetry(
    delivery: WebhookDelivery,
    nextRetryAt: Date,
    attemptNumber: number
  ): Promise<void> {
    const webhook = await this.getWebhookForDelivery(delivery);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    // Update delivery
    await this.deliveryStorage.update(delivery.id, {
      status: 'retrying' as WebhookDeliveryStatus,
      attemptNumber,
      nextRetryAt,
    });

    // Add to retry queue
    const queueKey = this.getQueueKey(nextRetryAt);
    if (!this.retryQueue.has(queueKey)) {
      this.retryQueue.set(queueKey, []);
    }

    this.retryQueue.get(queueKey)!.push({
      deliveryId: delivery.id,
      webhookId: delivery.webhookId,
      scheduledFor: nextRetryAt,
      attemptNumber,
      priority: webhook.priority,
    });

    // Sort by priority
    this.retryQueue.get(queueKey)!.sort((a, b) => a.priority - b.priority);

    // Store in KV for persistence
    await this.persistRetryQueue();
  }

  /**
   * Get due retries
   */
  public getDueRetries(): RetryScheduleItem[] {
    const now = Date.now();
    const dueItems: RetryScheduleItem[] = [];

    for (const [key, items] of this.retryQueue.entries()) {
      const timestamp = parseInt(key.split(':')[1], 10);
      if (timestamp <= now) {
        dueItems.push(...items);
        this.retryQueue.delete(key);
      }
    }

    return dueItems;
  }

  /**
   * Process retry queue
   */
  public async processRetryQueue(): Promise<number> {
    const dueItems = this.getDueRetries();
    let processed = 0;

    for (const item of dueItems) {
      if (this.processing.has(item.deliveryId)) {
        continue;
      }

      this.processing.add(item.deliveryId);

      try {
        // Mark as processing
        await this.deliveryStorage.update(item.deliveryId, {
          status: 'pending' as WebhookDeliveryStatus,
        });

        processed++;
      } catch (error) {
        console.error(
          `Failed to process retry for delivery ${item.deliveryId}:`,
          error
        );
      } finally {
        this.processing.delete(item.deliveryId);
      }
    }

    // Persist queue state
    await this.persistRetryQueue();

    return processed;
  }

  /**
   * Get retry statistics
   */
  public async getStatistics(webhookId?: string): Promise<RetryStatistics> {
    const stats = await this.deliveryStorage.getStatistics(webhookId);

    return {
      totalRetries: stats.retrying,
      successfulRetries: stats.successful,
      failedAfterMaxRetries: stats.deadLettered,
      deadLettered: stats.deadLettered,
      averageRetriesPerDelivery: stats.total > 0 ? stats.total / stats.successful : 0,
      byStrategy: {
        exponential_backoff: stats.total,
        linear_backoff: 0,
        fixed_interval: 0,
        custom: 0,
      },
    };
  }

  /**
   * Clear retry queue for a webhook
   */
  public async clearWebhookRetries(webhookId: string): Promise<number> {
    let cleared = 0;

    for (const [key, items] of this.retryQueue.entries()) {
      const filtered = items.filter(item => item.webhookId !== webhookId);

      if (filtered.length < items.length) {
        this.retryQueue.set(key, filtered);
        cleared += items.length - filtered.length;
      }

      if (filtered.length === 0) {
        this.retryQueue.delete(key);
      }
    }

    await this.persistRetryQueue();

    return cleared;
  }

  /**
   * Calculate delay based on strategy
   */
  private calculateDelay(
    attemptNumber: number,
    strategy: RetryStrategy,
    config: any
  ): number {
    const initialDelay = config.initialDelay || this.config.retry.initialDelayMs;
    const maxDelay = config.maxDelay || this.config.retry.maxDelayMs;
    const multiplier =
      config.backoffMultiplier || this.config.retry.backoffMultiplier;

    switch (strategy) {
      case RetryStrategy.EXPONENTIAL_BACKOFF:
        // Exponential: delay = initial * (multiplier ^ (attempt - 1))
        const expDelay = initialDelay * Math.pow(multiplier, attemptNumber - 1);
        return Math.min(expDelay, maxDelay);

      case RetryStrategy.LINEAR_BACKOFF:
        // Linear: delay = initial + (attempt - 1) * multiplier
        const linearDelay = initialDelay + (attemptNumber - 1) * multiplier * 1000;
        return Math.min(linearDelay, maxDelay);

      case RetryStrategy.FIXED_INTERVAL:
        // Fixed: always return initial delay
        return initialDelay;

      case RetryStrategy.CUSTOM:
        // Use custom schedule if provided
        if (config.customSchedule && config.customSchedule.length > 0) {
          const index = Math.min(attemptNumber - 1, config.customSchedule.length - 1);
          return config.customSchedule[index];
        }
        return initialDelay;

      default:
        return initialDelay;
    }
  }

  /**
   * Get webhook for delivery (cached)
   */
  private async getWebhookForDelivery(delivery: WebhookDelivery): Promise<Webhook | null> {
    // This would typically use a webhook cache or storage
    // For now, return null as placeholder
    // In real implementation, you'd fetch from webhook storage
    return null;
  }

  /**
   * Get queue key for timestamp
   */
  private getQueueKey(timestamp: Date): string {
    // Group by minute to reduce number of keys
    const minuteBucket = Math.floor(timestamp.getTime() / 60000) * 60000;
    return `retry:${minuteBucket}`;
  }

  /**
   * Persist retry queue to KV storage
   */
  private async persistRetryQueue(): Promise<void> {
    const data = JSON.stringify(
      Array.from(this.retryQueue.entries()).map(([key, items]) => ({
        key,
        items,
      }))
    );

    await this.kvStorage.set('retry_queue', data, 3600000); // 1 hour TTL
  }

  /**
   * Load retry queue from KV storage
   */
  public async loadRetryQueue(): Promise<void> {
    const data = await this.kvStorage.get('retry_queue');
    if (!data) {
      return;
    }

    try {
      const parsed = JSON.parse(data);
      this.retryQueue = new Map(
        parsed.map((entry: any) => [entry.key, entry.items])
      );
    } catch (error) {
      console.error('Failed to load retry queue:', error);
    }
  }

  /**
   * Clear all retry queues
   */
  public async clearAll(): Promise<void> {
    this.retryQueue.clear();
    await this.kvStorage.delete('retry_queue');
  }

  /**
   * Get queue size
   */
  public getQueueSize(): number {
    let size = 0;
    for (const items of this.retryQueue.values()) {
      size += items.length;
    }
    return size;
  }

  /**
   * Get queue items by webhook ID
   */
  public getWebhookQueueItems(webhookId: string): RetryScheduleItem[] {
    const items: RetryScheduleItem[] = [];

    for (const queueItems of this.retryQueue.values()) {
      items.push(
        ...queueItems.filter(item => item.webhookId === webhookId)
      );
    }

    return items;
  }
}

/**
 * Retry calculator helper class
 */
export class RetryCalculator {
  /**
   * Calculate exponential backoff delay
   */
  public static exponentialBackoff(
    attemptNumber: number,
    initialDelay: number,
    maxDelay: number,
    multiplier: number = 2
  ): number {
    const delay = initialDelay * Math.pow(multiplier, attemptNumber - 1);
    return Math.min(delay, maxDelay);
  }

  /**
   * Calculate linear backoff delay
   */
  public static linearBackoff(
    attemptNumber: number,
    initialDelay: number,
    maxDelay: number,
    increment: number = 1000
  ): number {
    const delay = initialDelay + (attemptNumber - 1) * increment;
    return Math.min(delay, maxDelay);
  }

  /**
   * Calculate fixed interval delay
   */
  public static fixedInterval(delay: number): number {
    return delay;
  }

  /**
   * Check if status code is retryable
   */
  public static isRetryableStatusCode(statusCode: number): boolean {
    // Retryable status codes
    const retryableCodes = [408, 429, 500, 502, 503, 504];
    return retryableCodes.includes(statusCode);
  }

  /**
   * Check if error is retryable
   */
  public static isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
      /ENOTFOUND/i,
      /ECONNRESET/i,
      /socket hang up/i,
      /timeout/i,
    ];

    return retryablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Calculate jitter for retry delay
   */
  public static addJitter(delay: number, jitterPercent: number = 0.1): number {
    const jitter = delay * jitterPercent * (Math.random() * 2 - 1);
    return Math.max(0, Math.floor(delay + jitter));
  }
}
