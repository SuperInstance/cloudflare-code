/**
 * Webhook Delivery Service
 * Handles webhook event delivery with retry logic and signature verification
 */

import {
  Webhook,
  WebhookDelivery,
  WebhookEvent,
  RetryConfig,
  WebhookLog,
  WebhookSignature
} from '../types';
import { WebhookQueue } from './queue';
import { WebhookSignatureService } from './signature';

export interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  duration: number;
  errorMessage?: string;
  shouldRetry: boolean;
}

export class WebhookDeliveryService {
  private queue: WebhookQueue;
  private signatureService: WebhookSignatureService;
  private deliveryHistory: Map<string, WebhookDelivery[]> = new Map();
  private maxHistoryPerWebhook = 1000;

  constructor() {
    this.queue = new WebhookQueue();
    this.signatureService = new WebhookSignatureService();
  }

  /**
   * Deliver webhook event
   */
  public async deliver(webhook: Webhook, event: WebhookEvent): Promise<WebhookDelivery> {
    // Check if webhook is enabled
    if (!webhook.enabled) {
      throw new Error('Webhook is disabled');
    }

    // Check if event type is subscribed
    if (!webhook.events.includes(event.type)) {
      throw new Error('Event type not subscribed');
    }

    // Create delivery record
    const delivery: WebhookDelivery = {
      id: crypto.randomUUID(),
      webhookId: webhook.id,
      eventId: event.id,
      attemptNumber: 1,
      payload: event.data,
      headers: {},
      duration: 0,
      status: 'pending',
      createdAt: new Date()
    };

    // Queue for delivery
    await this.queue.add(webhook, event, delivery);

    return delivery;
  }

  /**
   * Process webhook delivery
   */
  public async processDelivery(
    webhook: Webhook,
    event: WebhookEvent,
    delivery: WebhookDelivery
  ): Promise<DeliveryResult> {
    const startTime = Date.now();

    try {
      // Generate signature
      const signature = this.signatureService.generateSignature(
        webhook.secret,
        event,
        webhook.version
      );

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'ClaudeFlare-Webhook/1.0',
        'X-Webhook-ID': delivery.id,
        'X-Webhook-Event': event.type,
        'X-Webhook-Timestamp': event.timestamp.toISOString(),
        'X-Webhook-Signature': signature.signature,
        'X-Delivery-ID': delivery.id,
        'X-Event-ID': event.id,
        ...webhook.headers
      };

      delivery.headers = headers;

      // Send webhook
      const response = await this.sendRequest(webhook.url, event.data, headers);

      const duration = Date.now() - startTime;
      delivery.duration = duration;
      delivery.responseStatus = response.status;
      delivery.responseHeaders = Object.fromEntries(response.headers.entries());

      // Parse response
      if (response.body) {
        try {
          delivery.responseBody = await response.text();
        } catch {
          delivery.responseBody = '[Binary response]';
        }
      }

      // Check if successful
      if (response.ok) {
        delivery.status = 'delivered';
        delivery.deliveredAt = new Date();

        return {
          success: true,
          statusCode: response.status,
          duration,
          shouldRetry: false
        };
      } else {
        // Check if should retry
        const shouldRetry = this.shouldRetry(response.status, webhook.retryConfig);

        if (shouldRetry && delivery.attemptNumber < webhook.retryConfig.maxAttempts) {
          delivery.status = 'retrying';
          delivery.nextRetryAt = this.calculateNextRetry(
            delivery.attemptNumber,
            webhook.retryConfig
          );
          delivery.errorMessage = `HTTP ${response.status}`;

          // Schedule retry
          await this.scheduleRetry(webhook, event, delivery, webhook.retryConfig);

          return {
            success: false,
            statusCode: response.status,
            duration,
            errorMessage: `HTTP ${response.status}`,
            shouldRetry: true
          };
        } else {
          delivery.status = 'failed';
          delivery.errorMessage = `HTTP ${response.status}`;

          return {
            success: false,
            statusCode: response.status,
            duration,
            errorMessage: `HTTP ${response.status}`,
            shouldRetry: false
          };
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      delivery.duration = duration;
      delivery.status = 'failed';
      delivery.errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        duration,
        errorMessage: delivery.errorMessage,
        shouldRetry: delivery.attemptNumber < webhook.retryConfig.maxAttempts
      };
    } finally {
      // Store delivery history
      this.addToHistory(webhook.id, delivery);

      // Log delivery
      await this.logDelivery(delivery);
    }
  }

  /**
   * Send HTTP request
   */
  private async sendRequest(
    url: string,
    payload: unknown,
    headers: Record<string, string>
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }

      throw error;
    }
  }

  /**
   * Check if should retry based on status code
   */
  private shouldRetry(statusCode: number, retryConfig: RetryConfig): boolean {
    return retryConfig.retryableStatusCodes.includes(statusCode);
  }

  /**
   * Calculate next retry time with exponential backoff
   */
  private calculateNextRetry(attemptNumber: number, retryConfig: RetryConfig): Date {
    const delay = Math.min(
      retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attemptNumber - 1),
      retryConfig.maxDelay
    );

    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    const finalDelay = delay + jitter;

    return new Date(Date.now() + finalDelay);
  }

  /**
   * Schedule retry delivery
   */
  private async scheduleRetry(
    webhook: Webhook,
    event: WebhookEvent,
    delivery: WebhookDelivery,
    retryConfig: RetryConfig
  ): Promise<void> {
    const nextRetryAt = delivery.nextRetryAt!;

    // Calculate delay
    const delay = nextRetryAt.getTime() - Date.now();

    // Create new delivery with incremented attempt number
    const retryDelivery: WebhookDelivery = {
      ...delivery,
      id: crypto.randomUUID(),
      attemptNumber: delivery.attemptNumber + 1,
      status: 'pending',
      nextRetryAt: undefined,
      createdAt: new Date()
    };

    // Schedule retry
    setTimeout(async () => {
      await this.queue.add(webhook, event, retryDelivery);
    }, delay);
  }

  /**
   * Add to delivery history
   */
  private addToHistory(webhookId: string, delivery: WebhookDelivery): void {
    let history = this.deliveryHistory.get(webhookId);

    if (!history) {
      history = [];
      this.deliveryHistory.set(webhookId, history);
    }

    history.push(delivery);

    // Trim history if needed
    if (history.length > this.maxHistoryPerWebhook) {
      history.splice(0, history.length - this.maxHistoryPerWebhook);
    }
  }

  /**
   * Get delivery history for webhook
   */
  public getDeliveryHistory(webhookId: string, limit = 100): WebhookDelivery[] {
    const history = this.deliveryHistory.get(webhookId);
    if (!history) {
      return [];
    }

    return history.slice(-limit);
  }

  /**
   * Get delivery by ID
   */
  public getDelivery(deliveryId: string): WebhookDelivery | undefined {
    for (const history of this.deliveryHistory.values()) {
      const delivery = history.find(d => d.id === deliveryId);
      if (delivery) {
        return delivery;
      }
    }
    return undefined;
  }

  /**
   * Log delivery
   */
  private async logDelivery(delivery: WebhookDelivery): Promise<void> {
    const log: WebhookLog = {
      id: crypto.randomUUID(),
      webhookId: delivery.webhookId,
      deliveryId: delivery.id,
      eventType: delivery.headers['X-Webhook-Event'] || 'unknown',
      action: delivery.status === 'delivered' ? 'delivered' : 'failed',
      status: delivery.responseStatus || 0,
      message: delivery.errorMessage || 'OK',
      createdAt: new Date()
    };

    // In production, this would be stored in a database
    console.log('[Webhook Delivery]', log);
  }

  /**
   * Get delivery statistics
   */
  public getDeliveryStats(webhookId: string): {
    total: number;
    delivered: number;
    failed: number;
    retrying: number;
    successRate: number;
    avgDuration: number;
  } {
    const history = this.getDeliveryHistory(webhookId);

    const delivered = history.filter(d => d.status === 'delivered').length;
    const failed = history.filter(d => d.status === 'failed').length;
    const retrying = history.filter(d => d.status === 'retrying').length;

    const totalDuration = history.reduce((sum, d) => sum + d.duration, 0);
    const avgDuration = history.length > 0 ? totalDuration / history.length : 0;

    return {
      total: history.length,
      delivered,
      failed,
      retrying,
      successRate: history.length > 0 ? delivered / history.length : 0,
      avgDuration
    };
  }

  /**
   * Retry failed delivery
   */
  public async retryDelivery(deliveryId: string): Promise<WebhookDelivery> {
    const existing = this.getDelivery(deliveryId);
    if (!existing) {
      throw new Error('Delivery not found');
    }

    if (existing.status === 'delivered') {
      throw new Error('Delivery already succeeded');
    }

    // Create retry delivery
    const retryDelivery: WebhookDelivery = {
      ...existing,
      id: crypto.randomUUID(),
      attemptNumber: existing.attemptNumber + 1,
      status: 'pending',
      nextRetryAt: undefined,
      createdAt: new Date()
    };

    // Get webhook (this would normally come from database)
    // For now, just return the delivery
    return retryDelivery;
  }

  /**
   * Verify webhook signature
   */
  public verifySignature(
    payload: string,
    signature: string,
    secret: string,
    timestamp: string,
    tolerance = 300000 // 5 minutes
  ): boolean {
    return this.signatureService.verifySignature(
      payload,
      signature,
      secret,
      timestamp,
      tolerance
    );
  }

  /**
   * Clean up old delivery history
   */
  public cleanupHistory(olderThan: Date): void {
    for (const [webhookId, history] of this.deliveryHistory.entries()) {
      const filtered = history.filter(d => d.createdAt >= olderThan);
      this.deliveryHistory.set(webhookId, filtered);
    }
  }
}
