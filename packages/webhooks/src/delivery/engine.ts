// @ts-nocheck
/**
 * Delivery Engine - handles webhook dispatch, batching, and rate limiting
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Webhook,
  WebhookEvent,
  WebhookDelivery,
  WebhookDeliveryStatus,
  DeliveryQueueItem,
  WebhookPriority,
} from '../types/webhook.js';
import type { IWebhookStorage, IWebhookDeliveryStorage, IKVStorage } from '../types/storage.js';
import type { WebhookSystemConfig } from '../types/config.js';
import { SecurityLayer } from '../security/layer.js';
import { RetryHandler } from '../retry/handler.js';
import {
  WebhookDeliveryError,
  WebhookTimeoutError,
  RateLimitExceededError,
  SerializationError,
} from '../types/errors.js';

/**
 * Delivery result
 */
export interface DeliveryResult {
  success: boolean;
  deliveryId: string;
  webhookId: string;
  eventType: string;
  statusCode?: number;
  duration: number;
  error?: string;
  willRetry: boolean;
}

/**
 * Batch delivery result
 */
export interface BatchDeliveryResult {
  total: number;
  successful: number;
  failed: number;
  results: DeliveryResult[];
  duration: number;
}

/**
 * Delivery statistics
 */
export interface DeliveryEngineStats {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  pendingDeliveries: number;
  averageDeliveryTime: number;
  throughputPerSecond: number;
  queueSize: number;
}

/**
 * Rate limiter state
 */
interface RateLimiterState {
  count: number;
  resetAt: number;
}

/**
 * Delivery Engine class
 */
export class DeliveryEngine {
  private config: WebhookSystemConfig;
  private webhookStorage: IWebhookStorage;
  private deliveryStorage: IWebhookDeliveryStorage;
  private kvStorage: IKVStorage;
  private securityLayer: SecurityLayer;
  private retryHandler: RetryHandler;

  // Rate limiting
  private rateLimiters: Map<string, RateLimiterState>;

  // Delivery queue
  private deliveryQueue: Map<WebhookPriority, DeliveryQueueItem[]>;

  // Processing state
  private processing: Map<string, boolean>;
  private processingCount: number;

  constructor(
    config: WebhookSystemConfig,
    webhookStorage: IWebhookStorage,
    deliveryStorage: IWebhookDeliveryStorage,
    kvStorage: IKVStorage,
    securityLayer: SecurityLayer,
    retryHandler: RetryHandler
  ) {
    this.config = config;
    this.webhookStorage = webhookStorage;
    this.deliveryStorage = deliveryStorage;
    this.kvStorage = kvStorage;
    this.securityLayer = securityLayer;
    this.retryHandler = retryHandler;

    this.rateLimiters = new Map();
    this.deliveryQueue = new Map();
    this.processing = new Map();
    this.processingCount = 0;

    // Initialize queue for each priority level
    for (let i = 0; i <= 3; i++) {
      this.deliveryQueue.set(i as WebhookPriority, []);
    }
  }

  /**
   * Deliver a webhook event
   */
  public async deliver(webhookId: string, event: WebhookEvent): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      // Get webhook
      const webhook = await this.webhookStorage.getById(webhookId);
      if (!webhook) {
        throw new WebhookDeliveryError(
          webhookId,
          'Webhook not found'
        );
      }

      // Check if webhook is active
      if (!webhook.active) {
        return {
          success: false,
          deliveryId: '',
          webhookId,
          eventType: event.type,
          duration: Date.now() - startTime,
          error: 'Webhook is not active',
          willRetry: false,
        };
      }

      // Check rate limit
      await this.checkRateLimit(webhook);

      // Apply filters
      if (!this.evaluateFilters(webhook, event)) {
        return {
          success: true,
          deliveryId: uuidv4(),
          webhookId,
          eventType: event.type,
          duration: Date.now() - startTime,
          error: 'Filtered by webhook filters',
          willRetry: false,
        };
      }

      // Transform payload if template is configured
      const payload = await this.transformPayload(webhook, event);

      // Sign payload
      const signature = await this.securityLayer.signEvent(
        event,
        webhook.secret,
        {
          algorithm: webhook.signatureAlgorithm,
          includeTimestamp: true,
          includeEventId: true,
        }
      );

      // Create delivery record
      const delivery: Omit<WebhookDelivery, 'id' | 'createdAt' | 'updatedAt'> = {
        webhookId: webhook.id,
        eventType: event.type,
        eventId: event.id,
        payload,
        status: 'sending' as WebhookDeliveryStatus,
        attemptNumber: 1,
        maxAttempts: webhook.retryConfig.maxRetries + 1,
        duration: 0,
      };

      const created = await this.deliveryStorage.create(delivery);

      // Mark as processing
      this.processing.set(created.id, true);
      this.processingCount++;

      // Send webhook
      const result = await this.sendWebhook(webhook, payload, signature.headers);

      const duration = Date.now() - startTime;

      // Update delivery record
      const updateData: Partial<WebhookDelivery> = {
        status: result.success ? 'success' : 'failed',
        statusCode: result.statusCode,
        responseHeaders: result.headers,
        responseBody: result.body,
        duration,
        deliveredAt: new Date(),
      };

      if (!result.success) {
        updateData.errorMessage = result.error;
        updateData.stackTrace = result.stack;
      }

      await this.deliveryStorage.update(created.id, updateData);

      // Update webhook statistics
      await this.updateWebhookStats(webhook.id, result.success, duration);

      // Handle retries if failed
      let willRetry = false;
      if (!result.success) {
        const retryCalc = await this.retryHandler.calculateRetry(
          { ...created, ...updateData },
          result.statusCode
        );

        if (retryCalc.shouldRetry) {
          await this.retryHandler.scheduleRetry(
            { ...created, ...updateData },
            retryCalc.nextRetryAt,
            retryCalc.attemptNumber
          );
          willRetry = true;
        } else {
          // Send to dead letter queue
          await this.sendToDeadLetterQueue(webhook, event, result.error);
        }
      }

      return {
        success: result.success,
        deliveryId: created.id,
        webhookId: webhook.id,
        eventType: event.type,
        statusCode: result.statusCode,
        duration,
        error: result.error,
        willRetry,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        deliveryId: '',
        webhookId,
        eventType: event.type,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        willRetry: false,
      };
    } finally {
      this.processingCount--;
    }
  }

  /**
   * Deliver webhooks in batch
   */
  public async deliverBatch(
    deliveries: Array<{ webhookId: string; event: WebhookEvent }>
  ): Promise<BatchDeliveryResult> {
    const startTime = Date.now();

    // Group by priority
    const byPriority = new Map<WebhookPriority, Array<{ webhookId: string; event: WebhookEvent }>>();
    for (const d of deliveries) {
      const webhook = await this.webhookStorage.getById(d.webhookId);
      if (webhook) {
        const priority = webhook.priority;
        if (!byPriority.has(priority)) {
          byPriority.set(priority, []);
        }
        byPriority.get(priority)!.push(d);
      }
    }

    // Deliver in priority order
    const results: DeliveryResult[] = [];
    let successful = 0;
    let failed = 0;

    for (let priority = 0; priority <= 3; priority++) {
      const items = byPriority.get(priority as WebhookPriority);
      if (!items) continue;

      // Process in batches
      const batchSize = this.config.maxBatchSize;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);

        // Deliver concurrently
        const batchResults = await Promise.all(
          batch.map(item => this.deliver(item.webhookId, item.event))
        );

        results.push(...batchResults);
        successful += batchResults.filter(r => r.success).length;
        failed += batchResults.filter(r => !r.success).length;
      }
    }

    return {
      total: deliveries.length,
      successful,
      failed,
      results,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Queue a webhook for delivery
   */
  public async queueDelivery(
    webhookId: string,
    event: WebhookEvent,
    scheduledFor?: Date
  ): Promise<string> {
    const webhook = await this.webhookStorage.getById(webhookId);
    if (!webhook) {
      throw new WebhookDeliveryError(webhookId, 'Webhook not found');
    }

    const item: DeliveryQueueItem = {
      id: uuidv4(),
      webhook,
      event,
      priority: webhook.priority,
      scheduledFor: scheduledFor || new Date(),
      attemptNumber: 1,
      maxAttempts: webhook.retryConfig.maxRetries + 1,
      previousAttempts: [],
    };

    const queue = this.deliveryQueue.get(item.priority)!;
    queue.push(item);

    // Sort by scheduled time
    queue.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());

    return item.id;
  }

  /**
   * Process delivery queue
   */
  public async processQueue(maxItems?: number): Promise<number> {
    const processed: string[] = [];
    const now = Date.now();

    // Process each priority level
    for (let priority = 0; priority <= 3; priority++) {
      const queue = this.deliveryQueue.get(priority as WebhookPriority)!;

      while (queue.length > 0 && (!maxItems || processed.length < maxItems)) {
        const item = queue[0];

        // Check if scheduled time has arrived
        if (item.scheduledFor.getTime() > now) {
          break;
        }

        // Remove from queue
        queue.shift();

        // Check if already processing
        if (this.processing.has(item.id)) {
          continue;
        }

        // Mark as processing
        this.processing.set(item.id, true);
        processed.push(item.id);

        // Deliver (don't await - process concurrently)
        this.deliver(item.webhook.id, item.event)
          .catch(error => {
            console.error(`Failed to deliver queued webhook ${item.id}:`, error);
          })
          .finally(() => {
            this.processing.delete(item.id);
          });
      }
    }

    return processed.length;
  }

  /**
   * Get delivery statistics
   */
  public async getStatistics(webhookId?: string): Promise<DeliveryEngineStats> {
    const storageStats = await this.deliveryStorage.getStatistics(webhookId);

    return {
      totalDeliveries: storageStats.total,
      successfulDeliveries: storageStats.successful,
      failedDeliveries: storageStats.failed,
      pendingDeliveries: storageStats.pending,
      averageDeliveryTime: storageStats.averageDuration,
      throughputPerSecond: this.calculateThroughput(),
      queueSize: this.getQueueSize(),
    };
  }

  /**
   * Get queue size
   */
  public getQueueSize(): number {
    let size = 0;
    for (const queue of this.deliveryQueue.values()) {
      size += queue.length;
    }
    return size;
  }

  /**
   * Clear queue
   */
  public clearQueue(): void {
    for (const priority of this.deliveryQueue.keys()) {
      this.deliveryQueue.set(priority, []);
    }
  }

  /**
   * Send webhook to endpoint
   */
  private async sendWebhook(
    webhook: Webhook,
    payload: any,
    headers: Record<string, string>
  ): Promise<{
    success: boolean;
    statusCode?: number;
    headers?: Record<string, string>;
    body?: string;
    error?: string;
    stack?: string;
  }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      webhook.timeout
    );

    try {
      const response = await fetch(webhook.url, {
        method: webhook.httpMethod,
        headers: {
          'Content-Type': 'application/json',
          ...webhook.headers,
          ...headers,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseBody = await response.text();

      return {
        success: response.ok,
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new WebhookTimeoutError(webhook.id, webhook.timeout);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      };
    }
  }

  /**
   * Check rate limit for webhook
   */
  private async checkRateLimit(webhook: Webhook): Promise<void> {
    if (!webhook.rateLimit?.enabled) {
      return;
    }

    const now = Date.now();
    const state = this.rateLimiters.get(webhook.id) || {
      count: 0,
      resetAt: now + webhook.rateLimit.windowMs,
    };

    // Reset if window expired
    if (now >= state.resetAt) {
      state.count = 0;
      state.resetAt = now + webhook.rateLimit.windowMs;
    }

    // Check limit
    if (state.count >= webhook.rateLimit.maxRequests) {
      throw new RateLimitExceededError(
        webhook.id,
        webhook.rateLimit.maxRequests,
        new Date(state.resetAt)
      );
    }

    // Increment counter
    state.count++;
    this.rateLimiters.set(webhook.id, state);
  }

  /**
   * Evaluate webhook filters
   */
  private evaluateFilters(webhook: Webhook, event: WebhookEvent): boolean {
    if (!webhook.filters || webhook.filters.length === 0) {
      return true;
    }

    const eventData = {
      ...event,
      data: event.data,
    };

    for (const filter of webhook.filters) {
      const value = this.getNestedValue(eventData, filter.field);

      let matches = false;
      switch (filter.operator) {
        case 'eq':
          matches = value === filter.value;
          break;
        case 'ne':
          matches = value !== filter.value;
          break;
        case 'gt':
          matches = typeof value === 'number' && value > (filter.value as number);
          break;
        case 'lt':
          matches = typeof value === 'number' && value < (filter.value as number);
          break;
        case 'gte':
          matches = typeof value === 'number' && value >= (filter.value as number);
          break;
        case 'lte':
          matches = typeof value === 'number' && value <= (filter.value as number);
          break;
        case 'in':
          matches = Array.isArray(filter.value) && filter.value.includes(value);
          break;
        case 'nin':
          matches = Array.isArray(filter.value) && !filter.value.includes(value);
          break;
        case 'contains':
          matches = typeof value === 'string' && value.includes(filter.value as string);
          break;
        case 'regex':
          try {
            const regex = new RegExp(filter.value as string);
            matches = regex.test(String(value));
          } catch {
            matches = false;
          }
          break;
      }

      if (!matches) {
        return false;
      }
    }

    return true;
  }

  /**
   * Transform payload using webhook template
   */
  private async transformPayload(
    webhook: Webhook,
    event: WebhookEvent
  ): Promise<any> {
    if (!webhook.template) {
      return event;
    }

    try {
      // If template has bodyTemplate, use it
      if (webhook.template.bodyTemplate) {
        const template = webhook.template.bodyTemplate;
        const data = JSON.stringify(event);

        // Simple template replacement (in production, use a proper template engine)
        let result = template;
        result = result.replace(/\{\{\s*event\.id\s*\}\}/g, event.id);
        result = result.replace(/\{\{\s*event\.type\s*\}\}/g, event.type);
        result = result.replace(/\{\{\s*event\.timestamp\s*\}\}/g, event.timestamp.toISOString());
        result = result.replace(/\{\{\s*event\.data\s*\}\}/g, JSON.stringify(event.data));

        return JSON.parse(result);
      }

      return event;
    } catch (error) {
      throw new SerializationError(event, 'Failed to transform payload');
    }
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: any, path: string): any {
    const keys = path.split('.');
    let value = obj;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Update webhook statistics
   */
  private async updateWebhookStats(
    webhookId: string,
    success: boolean,
    duration: number
  ): Promise<void> {
    const webhook = await this.webhookStorage.getById(webhookId);
    if (!webhook) return;

    const stats = webhook.statistics;
    stats.totalDeliveries++;
    stats.averageDeliveryTime =
      (stats.averageDeliveryTime * (stats.totalDeliveries - 1) + duration) /
      stats.totalDeliveries;

    if (success) {
      stats.successfulDeliveries++;
      stats.lastDeliveryStatus = 'success';
    } else {
      stats.failedDeliveries++;
      stats.lastDeliveryStatus = 'failed';
    }

    stats.lastDeliveryAt = new Date();
    stats.successRate = stats.successfulDeliveries / stats.totalDeliveries;
    stats.failureRate = stats.failedDeliveries / stats.totalDeliveries;

    await this.webhookStorage.updateStatistics(webhookId, stats);
  }

  /**
   * Send to dead letter queue
   */
  private async sendToDeadLetterQueue(
    webhook: Webhook,
    event: WebhookEvent,
    error?: string
  ): Promise<void> {
    // Store in KV for dead letter queue
    const key = `dlq:${webhook.id}:${event.id}`;
    const value = JSON.stringify({
      webhookId: webhook.id,
      webhookName: webhook.name,
      eventType: event.type,
      eventId: event.id,
      payload: event.data,
      error,
      createdAt: new Date().toISOString(),
    });

    await this.kvStorage.set(key, value, this.config.deadLetter.retentionMs);
  }

  /**
   * Calculate throughput
   */
  private calculateThroughput(): number {
    // This would typically use metrics from the last minute
    // For now, return a placeholder
    return 0;
  }
}
