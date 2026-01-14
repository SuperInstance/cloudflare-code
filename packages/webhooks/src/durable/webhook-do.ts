/**
 * Durable Object for coordinating webhook delivery across instances
 */

import type {
  Webhook,
  WebhookEvent,
  WebhookDelivery,
  DeliveryQueueItem,
  WebhookPriority,
} from '../types/webhook.js';

/**
 * Durable Object state
 */
interface WebhookDOState {
  webhooks: Map<string, Webhook>;
  deliveryQueue: Map<string, DeliveryQueueItem>;
  processing: Set<string>;
  rateLimitCounters: Map<string, { count: number; resetAt: number }>;
  statistics: Map<string, {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
  }>;
}

/**
 * Message types for Durable Object
 */
type DORequest =
  | { type: 'register_webhook'; webhook: Webhook }
  | { type: 'unregister_webhook'; webhookId: string }
  | { type: 'get_webhook'; webhookId: string }
  | { type: 'queue_delivery'; item: DeliveryQueueItem }
  | { type: 'dequeue_delivery'; priority?: WebhookPriority }
  | { type: 'get_queue_size' }
  | { type: 'check_rate_limit'; webhookId: string; maxRequests: number; windowMs: number }
  | { type: 'record_delivery'; webhookId: string; success: boolean }
  | { type: 'get_statistics'; webhookId?: string }
  | { type: 'update_webhook'; webhookId: string; updates: Partial<Webhook> }
  | { type: 'activate_webhook'; webhookId: string }
  | { type: 'deactivate_webhook'; webhookId: string }
  | { type: 'list_webhooks'; userId?: string }
  | { type: 'health_check' };

type DOResponse =
  | { success: true; data?: any }
  | { success: false; error: string }
  | { type: 'delivery_item'; item?: DeliveryQueueItem }
  | { queue_size: number }
  | { rate_limit_allowed: boolean }
  | { statistics: any };

/**
 * Webhook Durable Object
 */
export class WebhookDurableObject {
  private state: DurableObjectState;
  private env: any;
  private internalState: WebhookDOState;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    this.internalState = {
      webhooks: new Map(),
      deliveryQueue: new Map(),
      processing: new Set(),
      rateLimitCounters: new Map(),
      statistics: new Map(),
    };

    // Block concurrency while we initialize
    this.state.blockConcurrencyWhile(async () => {
      await this.loadState();
    });
  }

  /**
   * Fetch handler for incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    try {
      const req = (await request.json()) as DORequest;
      const response = await this.handleRequest(req);
      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        { status: 500 }
      );
    }
  }

  /**
   * Handle incoming request
   */
  private async handleRequest(req: DORequest): Promise<DOResponse> {
    switch (req.type) {
      case 'register_webhook':
        return await this.registerWebhook(req.webhook);

      case 'unregister_webhook':
        return await this.unregisterWebhook(req.webhookId);

      case 'get_webhook':
        return await this.getWebhook(req.webhookId);

      case 'queue_delivery':
        return await this.queueDelivery(req.item);

      case 'dequeue_delivery':
        return await this.dequeueDelivery(req.priority);

      case 'get_queue_size':
        return await this.getQueueSize();

      case 'check_rate_limit':
        return await this.checkRateLimit(
          req.webhookId,
          req.maxRequests,
          req.windowMs
        );

      case 'record_delivery':
        return await this.recordDelivery(req.webhookId, req.success);

      case 'get_statistics':
        return await this.getStatistics(req.webhookId);

      case 'update_webhook':
        return await this.updateWebhook(req.webhookId, req.updates);

      case 'activate_webhook':
        return await this.activateWebhook(req.webhookId);

      case 'deactivate_webhook':
        return await this.deactivateWebhook(req.webhookId);

      case 'list_webhooks':
        return await this.listWebhooks(req.userId);

      case 'health_check':
        return { success: true, data: { status: 'healthy' } };

      default:
        return { success: false, error: 'Unknown request type' };
    }
  }

  /**
   * Register a webhook
   */
  private async registerWebhook(webhook: Webhook): Promise<DOResponse> {
    this.internalState.webhooks.set(webhook.id, webhook);
    await this.saveState();

    return { success: true, data: { webhookId: webhook.id } };
  }

  /**
   * Unregister a webhook
   */
  private async unregisterWebhook(webhookId: string): Promise<DOResponse> {
    if (!this.internalState.webhooks.has(webhookId)) {
      return { success: false, error: 'Webhook not found' };
    }

    this.internalState.webhooks.delete(webhookId);
    await this.saveState();

    return { success: true };
  }

  /**
   * Get a webhook by ID
   */
  private async getWebhook(webhookId: string): Promise<DOResponse> {
    const webhook = this.internalState.webhooks.get(webhookId);

    if (!webhook) {
      return { success: false, error: 'Webhook not found' };
    }

    return { success: true, data: webhook };
  }

  /**
   * Queue a delivery
   */
  private async queueDelivery(item: DeliveryQueueItem): Promise<DOResponse> {
    this.internalState.deliveryQueue.set(item.id, item);
    await this.saveState();

    return { success: true, data: { deliveryId: item.id } };
  }

  /**
   * Dequeue a delivery for processing
   */
  private async dequeueDelivery(
    priority?: WebhookPriority
  ): Promise<DOResponse> {
    // Find the highest priority item that's due
    let foundItem: DeliveryQueueItem | null = null;
    let foundKey: string | null = null;

    for (const [key, item] of this.internalState.deliveryQueue.entries()) {
      // Check if already processing
      if (this.internalState.processing.has(item.id)) {
        continue;
      }

      // Check priority filter
      if (priority !== undefined && item.priority !== priority) {
        continue;
      }

      // Check if scheduled time has arrived
      if (item.scheduledFor.getTime() > Date.now()) {
        continue;
      }

      // Take the highest priority (lowest number)
      if (!foundItem || item.priority < foundItem.priority) {
        foundItem = item;
        foundKey = key;
      }
    }

    if (foundItem && foundKey) {
      this.internalState.processing.add(foundItem.id);
      return { type: 'delivery_item', item: foundItem };
    }

    return { type: 'delivery_item' };
  }

  /**
   * Get queue size
   */
  private async getQueueSize(): Promise<DOResponse> {
    return { queue_size: this.internalState.deliveryQueue.size };
  }

  /**
   * Check rate limit
   */
  private async checkRateLimit(
    webhookId: string,
    maxRequests: number,
    windowMs: number
  ): Promise<DOResponse> {
    const now = Date.now();
    const counter = this.internalState.rateLimitCounters.get(webhookId);

    if (!counter || now >= counter.resetAt) {
      // Create or reset counter
      this.internalState.rateLimitCounters.set(webhookId, {
        count: 1,
        resetAt: now + windowMs,
      });
      return { rate_limit_allowed: true };
    }

    if (counter.count >= maxRequests) {
      return { rate_limit_allowed: false };
    }

    counter.count++;
    return { rate_limit_allowed: true };
  }

  /**
   * Record a delivery
   */
  private async recordDelivery(
    webhookId: string,
    success: boolean
  ): Promise<DOResponse> {
    let stats = this.internalState.statistics.get(webhookId);

    if (!stats) {
      stats = {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
      };
      this.internalState.statistics.set(webhookId, stats);
    }

    stats.totalDeliveries++;
    if (success) {
      stats.successfulDeliveries++;
    } else {
      stats.failedDeliveries++;
    }

    // Remove from processing
    this.internalState.processing.delete(webhookId);

    await this.saveState();

    return { success: true };
  }

  /**
   * Get statistics
   */
  private async getStatistics(webhookId?: string): Promise<DOResponse> {
    if (webhookId) {
      const stats = this.internalState.statistics.get(webhookId);
      return { success: true, data: stats || null };
    }

    // Aggregate all statistics
    const allStats = {
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      byWebhook: Object.fromEntries(this.internalState.statistics),
    };

    for (const stats of this.internalState.statistics.values()) {
      allStats.totalDeliveries += stats.totalDeliveries;
      allStats.successfulDeliveries += stats.successfulDeliveries;
      allStats.failedDeliveries += stats.failedDeliveries;
    }

    return { success: true, statistics: allStats };
  }

  /**
   * Update a webhook
   */
  private async updateWebhook(
    webhookId: string,
    updates: Partial<Webhook>
  ): Promise<DOResponse> {
    const webhook = this.internalState.webhooks.get(webhookId);

    if (!webhook) {
      return { success: false, error: 'Webhook not found' };
    }

    const updated = { ...webhook, ...updates, updatedAt: new Date() };
    this.internalState.webhooks.set(webhookId, updated);
    await this.saveState();

    return { success: true, data: updated };
  }

  /**
   * Activate a webhook
   */
  private async activateWebhook(webhookId: string): Promise<DOResponse> {
    return this.updateWebhook(webhookId, { active: true });
  }

  /**
   * Deactivate a webhook
   */
  private async deactivateWebhook(webhookId: string): Promise<DOResponse> {
    return this.updateWebhook(webhookId, { active: false });
  }

  /**
   * List webhooks
   */
  private async listWebhooks(userId?: string): Promise<DOResponse> {
    let webhooks = Array.from(this.internalState.webhooks.values());

    if (userId) {
      webhooks = webhooks.filter(w => w.userId === userId);
    }

    return { success: true, data: webhooks };
  }

  /**
   * Load state from storage
   */
  private async loadState(): Promise<void> {
    try {
      const webhooksData = await this.state.storage.get<Webhook[]>('webhooks');
      if (webhooksData) {
        this.internalState.webhooks = new Map(webhooksData.map(w => [w.id, w]));
      }

      const queueData = await this.state.storage.get<DeliveryQueueItem[]>('deliveryQueue');
      if (queueData) {
        this.internalState.deliveryQueue = new Map(queueData.map(q => [q.id, q]));
      }

      const rateLimitData = await this.state.storage.get<any>('rateLimitCounters');
      if (rateLimitData) {
        this.internalState.rateLimitCounters = new Map(Object.entries(rateLimitData));
      }

      const statsData = await this.state.storage.get<any>('statistics');
      if (statsData) {
        this.internalState.statistics = new Map(Object.entries(statsData));
      }
    } catch (error) {
      console.error('Failed to load state:', error);
    }
  }

  /**
   * Save state to storage
   */
  private async saveState(): Promise<void> {
    try {
      await this.state.storage.put(
        'webhooks',
        Array.from(this.internalState.webhooks.values())
      );

      await this.state.storage.put(
        'deliveryQueue',
        Array.from(this.internalState.deliveryQueue.values())
      );

      await this.state.storage.put(
        'rateLimitCounters',
        Object.fromEntries(this.internalState.rateLimitCounters)
      );

      await this.state.storage.put(
        'statistics',
        Object.fromEntries(this.internalState.statistics)
      );
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }

  /**
   * Alarm handler for scheduled tasks
   */
  async alarm(): Promise<void> {
    // Clean up old delivery queue items
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [key, item] of this.internalState.deliveryQueue.entries()) {
      if (now - item.scheduledFor.getTime() > maxAge) {
        this.internalState.deliveryQueue.delete(key);
      }
    }

    // Clean up old rate limit counters
    for (const [key, counter] of this.internalState.rateLimitCounters.entries()) {
      if (now >= counter.resetAt) {
        this.internalState.rateLimitCounters.delete(key);
      }
    }

    await this.saveState();
  }
}

/**
 * Factory function to create Durable Object stubs
 */
export function createWebhookDOStub(
  env: any,
  id?: string
): WebhookDurableObject {
  const objectId = id || 'webhook-coordinator';
  return env.WEBHOOK_DO.get(env.WEBHOOK_DO.idFromName(objectId));
}

/**
 * Helper class for interacting with Webhook DO
 */
export class WebhookDOClient {
  private stub: any;

  constructor(env: any, id?: string) {
    this.stub = createWebhookDOStub(env, id);
  }

  /**
   * Register a webhook
   */
  async registerWebhook(webhook: Webhook): Promise<boolean> {
    const response = await this.stub.fetch(
      new Request('https://do.local', {
        method: 'POST',
        body: JSON.stringify({
          type: 'register_webhook',
          webhook,
        }),
      })
    );

    const result = await response.json();
    return result.success;
  }

  /**
   * Get a webhook
   */
  async getWebhook(webhookId: string): Promise<Webhook | null> {
    const response = await this.stub.fetch(
      new Request('https://do.local', {
        method: 'POST',
        body: JSON.stringify({
          type: 'get_webhook',
          webhookId,
        }),
      })
    );

    const result = await response.json();
    return result.success ? result.data : null;
  }

  /**
   * Queue a delivery
   */
  async queueDelivery(item: DeliveryQueueItem): Promise<string> {
    const response = await this.stub.fetch(
      new Request('https://do.local', {
        method: 'POST',
        body: JSON.stringify({
          type: 'queue_delivery',
          item,
        }),
      })
    );

    const result = await response.json();
    return result.success ? result.data.deliveryId : '';
  }

  /**
   * Check rate limit
   */
  async checkRateLimit(
    webhookId: string,
    maxRequests: number,
    windowMs: number
  ): Promise<boolean> {
    const response = await this.stub.fetch(
      new Request('https://do.local', {
        method: 'POST',
        body: JSON.stringify({
          type: 'check_rate_limit',
          webhookId,
          maxRequests,
          windowMs,
        }),
      })
    );

    const result = await response.json();
    return result.rate_limit_allowed;
  }

  /**
   * Get queue size
   */
  async getQueueSize(): Promise<number> {
    const response = await this.stub.fetch(
      new Request('https://do.local', {
        method: 'POST',
        body: JSON.stringify({
          type: 'get_queue_size',
        }),
      })
    );

    const result = await response.json();
    return result.queue_size || 0;
  }
}
