/**
 * Webhook Queue Service
 * Manages webhook delivery queue with rate limiting and prioritization
 */

import { Webhook, WebhookEvent, WebhookDelivery } from '../types';
import { WebhookDeliveryService, DeliveryResult } from './delivery';

export interface QueuedDelivery {
  webhook: Webhook;
  event: WebhookEvent;
  delivery: WebhookDelivery;
  priority: number;
  scheduledFor?: Date;
}

export class WebhookQueue {
  private queue: QueuedDelivery[] = [];
  private processing = false;
  private deliveryService: WebhookDeliveryService;
  private rateLimiters: Map<string, RateLimiter> = new Map();

  // Configuration
  private maxConcurrent = 10;
  private batchInterval = 100; // ms
  private maxQueueSize = 10000;

  constructor() {
    this.deliveryService = new WebhookDeliveryService();
    this.startProcessing();
  }

  /**
   * Add webhook to queue
   */
  public async add(
    webhook: Webhook,
    event: WebhookEvent,
    delivery: WebhookDelivery,
    priority = 5
  ): Promise<void> {
    // Check queue size
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error('Queue is full');
    }

    const queued: QueuedDelivery = {
      webhook,
      event,
      delivery,
      priority,
      scheduledFor: undefined
    };

    this.queue.push(queued);

    // Sort by priority (higher priority first)
    this.queue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Add webhook with delay
   */
  public async addDelayed(
    webhook: Webhook,
    event: WebhookEvent,
    delivery: WebhookDelivery,
    delay: number,
    priority = 5
  ): Promise<void> {
    const scheduledFor = new Date(Date.now() + delay);

    const queued: QueuedDelivery = {
      webhook,
      event,
      delivery,
      priority,
      scheduledFor
    };

    this.queue.push(queued);

    // Sort by scheduled time, then priority
    this.queue.sort((a, b) => {
      if (a.scheduledFor && b.scheduledFor) {
        return a.scheduledFor.getTime() - b.scheduledFor.getTime();
      }
      if (a.scheduledFor) return 1;
      if (b.scheduledFor) return -1;
      return b.priority - a.priority;
    });
  }

  /**
   * Start processing queue
   */
  private startProcessing(): void {
    setInterval(() => {
      if (!this.processing) {
        this.processBatch();
      }
    }, this.batchInterval);
  }

  /**
   * Process batch of webhooks
   */
  private async processBatch(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      // Process up to maxConcurrent deliveries
      const batch = this.getNextBatch();

      // Process in parallel
      await Promise.all(
        batch.map(item => this.processItem(item))
      );
    } catch (error) {
      console.error('Error processing webhook batch:', error);
    } finally {
      this.processing = false;
    }
  }

  /**
   * Get next batch of items to process
   */
  private getNextBatch(): QueuedDelivery[] {
    const batch: QueuedDelivery[] = [];
    const now = new Date();

    for (let i = this.queue.length - 1; i >= 0; i--) {
      const item = this.queue[i];

      // Check if scheduled for later
      if (item.scheduledFor && item.scheduledFor > now) {
        continue;
      }

      // Check rate limit
      if (this.isRateLimited(item.webhook.id)) {
        continue;
      }

      batch.push(item);
      this.queue.splice(i, 1);

      if (batch.length >= this.maxConcurrent) {
        break;
      }
    }

    return batch;
  }

  /**
   * Process single queue item
   */
  private async processItem(item: QueuedDelivery): Promise<void> {
    const { webhook, event, delivery } = item;

    try {
      // Check rate limit
      if (webhook.rateLimitPerSecond) {
        await this.checkRateLimit(webhook.id, webhook.rateLimitPerSecond);
      }

      // Process delivery
      const result = await this.deliveryService.processDelivery(webhook, event, delivery);

      // Handle retry
      if (!result.success && result.shouldRetry) {
        await this.addDelayed(webhook, event, delivery, 5000, item.priority); // 5s delay
      }
    } catch (error) {
      console.error(`Error processing webhook ${delivery.id}:`, error);

      // Retry on error
      if (delivery.attemptNumber < webhook.retryConfig.maxAttempts) {
        await this.addDelayed(webhook, event, delivery, 10000, item.priority); // 10s delay
      }
    }
  }

  /**
   * Check and enforce rate limit
   */
  private async checkRateLimit(webhookId: string, limitPerSecond: number): Promise<void> {
    let limiter = this.rateLimiters.get(webhookId);

    if (!limiter) {
      limiter = new RateLimiter(limitPerSecond);
      this.rateLimiters.set(webhookId, limiter);
    }

    await limiter.acquire();
  }

  /**
   * Check if rate limited
   */
  private isRateLimited(webhookId: string): boolean {
    const limiter = this.rateLimiters.get(webhookId);
    return limiter ? limiter.isLimited() : false;
  }

  /**
   * Get queue size
   */
  public getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Get queue statistics
   */
  public getStats(): {
    queueSize: number;
    processing: boolean;
    rateLimiters: number;
  } {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      rateLimiters: this.rateLimiters.size
    };
  }

  /**
   * Clear queue
   */
  public clear(): void {
    this.queue = [];
  }

  /**
   * Pause processing
   */
  public pause(): void {
    this.processing = true;
  }

  /**
   * Resume processing
   */
  public resume(): void {
    this.processing = false;
  }
}

/**
 * Rate Limiter
 * Implements token bucket algorithm
 */
class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;
  private lastRefill: number;

  constructor(ratePerSecond: number) {
    this.maxTokens = ratePerSecond;
    this.tokens = ratePerSecond;
    this.refillRate = ratePerSecond / 1000; // tokens per ms
    this.lastRefill = Date.now();
  }

  /**
   * Acquire token
   */
  public async acquire(): Promise<void> {
    while (this.tokens < 1) {
      this.refill();

      if (this.tokens < 1) {
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    this.tokens--;
  }

  /**
   * Check if limited
   */
  public isLimited(): boolean {
    this.refill();
    return this.tokens < 1;
  }

  /**
   * Refill tokens
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }
}
