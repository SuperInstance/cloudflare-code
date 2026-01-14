/**
 * Webhooks Module
 * Main entry point for webhook functionality
 */

export { WebhookDeliveryService, DeliveryResult } from './delivery';
export { WebhookQueue, QueuedDelivery } from './queue';
export { WebhookSignatureService } from './signature';
export type {
  Webhook,
  WebhookDelivery,
  WebhookEvent,
  WebhookLog,
  RetryConfig,
  WebhookSignature
} from '../types';

// Re-export commonly used types
export type {
  QueuedDelivery
} from './queue';

import { Webhook, WebhookEvent } from '../types';
import { WebhookDeliveryService } from './delivery';
import { WebhookQueue } from './queue';
import { WebhookSignatureService } from './signature';

/**
 * Webhook Manager
 * High-level API for webhook management
 */
export class WebhookManager {
  private deliveryService: WebhookDeliveryService;
  private queue: WebhookQueue;
  private signatureService: WebhookSignatureService;

  constructor() {
    this.deliveryService = new WebhookDeliveryService();
    this.queue = new WebhookQueue();
    this.signatureService = new WebhookSignatureService();
  }

  /**
   * Create new webhook
   */
  public async createWebhook(config: {
    partnerId: string;
    integrationId: string;
    url: string;
    events: string[];
    headers?: Record<string, string>;
    retryConfig?: Partial<import('../types').RetryConfig>;
    rateLimitPerSecond?: number;
  }): Promise<Webhook> {
    const secret = this.signatureService.generateSecret();

    const webhook: Webhook = {
      id: crypto.randomUUID(),
      partnerId: config.partnerId,
      integrationId: config.integrationId,
      url: config.url,
      secret,
      events: config.events,
      headers: config.headers,
      enabled: true,
      version: 1,
      retryConfig: {
        maxAttempts: config.retryConfig?.maxAttempts || 5,
        initialDelay: config.retryConfig?.initialDelay || 1000,
        maxDelay: config.retryConfig?.maxDelay || 60000,
        backoffMultiplier: config.retryConfig?.backoffMultiplier || 2,
        retryableStatusCodes: config.retryConfig?.retryableStatusCodes || [408, 429, 500, 502, 503, 504]
      },
      rateLimitPerSecond: config.rateLimitPerSecond,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return webhook;
  }

  /**
   * Deliver webhook event
   */
  public async deliverEvent(webhook: Webhook, eventType: string, data: unknown): Promise<void> {
    const event: WebhookEvent = {
      id: crypto.randomUUID(),
      type: eventType,
      source: webhook.partnerId,
      data,
      timestamp: new Date()
    };

    await this.deliveryService.deliver(webhook, event);
  }

  /**
   * Verify incoming webhook
   */
  public verifyWebhook(
    payload: string,
    signature: string,
    secret: string,
    timestamp: string
  ): boolean {
    return this.deliveryService.verifySignature(payload, signature, secret, timestamp);
  }

  /**
   * Get webhook statistics
   */
  public getStats(webhookId: string) {
    return this.deliveryService.getDeliveryStats(webhookId);
  }

  /**
   * Get delivery history
   */
  public getHistory(webhookId: string, limit = 100) {
    return this.deliveryService.getDeliveryHistory(webhookId, limit);
  }

  /**
   * Retry failed delivery
   */
  public async retryDelivery(deliveryId: string) {
    return this.deliveryService.retryDelivery(deliveryId);
  }
}
