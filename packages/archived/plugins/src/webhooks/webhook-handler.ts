// @ts-nocheck
/**
 * Webhook extensions system
 */

import type {
  WebhookPayload,
  WebhookEventType,
  PluginId,
  SecurityContext,
} from '../types';
import { WebhookError, WebhookVerificationError } from '../types/errors';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  /**
   * Webhook ID
   */
  id: string;

  /**
   * Webhook URL
   */
  url: string;

  /**
   * Secret for signature verification
   */
  secret: string;

  /**
   * Event types to listen for
   */
  events: WebhookEventType[];

  /**
   * Enabled
   */
  enabled: boolean;

  /**
   * HTTP method (POST or PUT)
   */
  method: 'POST' | 'PUT';

  /**
   * Additional headers
   */
  headers?: Record<string, string>;

  /**
   * Timeout (ms)
   */
  timeout?: number;

  /**
   * Retry configuration
   */
  retry?: {
    maxAttempts: number;
    backoffMs: number;
  };

  /**
   * Plugin ID that owns this webhook
   */
  pluginId?: PluginId;
}

/**
 * Webhook delivery result
 */
export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  responseText?: string;
  error?: string;
  duration: number;
  attemptNumber: number;
}

/**
 * Webhook handler class
 */
export class WebhookHandler {
  private webhooks: Map<string, WebhookConfig> = new Map();
  private deliveryHistory: Map<string, WebhookDeliveryResult[]> = new Map();

  /**
   * Register a webhook
   */
  register(config: WebhookConfig): void {
    this.webhooks.set(config.id, config);
  }

  /**
   * Unregister a webhook
   */
  unregister(id: string): void {
    this.webhooks.delete(id);
    this.deliveryHistory.delete(id);
  }

  /**
   * Get webhook configuration
   */
  get(id: string): WebhookConfig | undefined {
    return this.webhooks.get(id);
  }

  /**
   * Get all webhooks
   */
  getAll(): WebhookConfig[] {
    return Array.from(this.webhooks.values());
  }

  /**
   * Get webhooks for an event type
   */
  getForEvent(eventType: WebhookEventType): WebhookConfig[] {
    return this.getAll().filter((w) => w.events.includes(eventType) && w.enabled);
  }

  /**
   * Update webhook configuration
   */
  update(id: string, updates: Partial<WebhookConfig>): void {
    const webhook = this.webhooks.get(id);
    if (!webhook) {
      throw new WebhookError(id, 'Webhook not found');
    }

    this.webhooks.set(id, { ...webhook, ...updates });
  }

  /**
   * Enable webhook
   */
  enable(id: string): void {
    const webhook = this.webhooks.get(id);
    if (webhook) {
      webhook.enabled = true;
    }
  }

  /**
   * Disable webhook
   */
  disable(id: string): void {
    const webhook = this.webhooks.get(id);
    if (webhook) {
      webhook.enabled = false;
    }
  }

  /**
   * Deliver webhook
   */
  async deliver(
    webhookId: string,
    payload: WebhookPayload,
    attemptNumber = 1
  ): Promise<WebhookDeliveryResult> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new WebhookError(webhookId, 'Webhook not found');
    }

    if (!webhook.enabled) {
      return {
        success: false,
        error: 'Webhook is disabled',
        duration: 0,
        attemptNumber,
      };
    }

    const startTime = Date.now();

    try {
      // Prepare the request
      const body = JSON.stringify(payload);
      const signature = this.generateSignature(body, webhook.secret);

      const response = await fetch(webhook.url, {
        method: webhook.method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ClaudeFlare-Webhook/1.0',
          'X-Webhook-ID': webhookId,
          'X-Webhook-Event': payload.type,
          'X-Webhook-Timestamp': payload.timestamp.toISOString(),
          'X-Webhook-Signature': signature,
          ...webhook.headers,
        },
        body,
        signal: webhook.timeout ? AbortSignal.timeout(webhook.timeout) : undefined,
      });

      const duration = Date.now() - startTime;
      const responseText = await response.text();

      const result: WebhookDeliveryResult = {
        success: response.ok,
        statusCode: response.status,
        responseText,
        duration,
        attemptNumber,
      };

      // Store delivery history
      this.recordDelivery(webhookId, result);

      // Retry if failed and retry is configured
      if (!result.success && webhook.retry && attemptNumber < webhook.retry.maxAttempts) {
        await this.delay(webhook.retry.backoffMs * Math.pow(2, attemptNumber - 1));
        return this.deliver(webhookId, payload, attemptNumber + 1);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: WebhookDeliveryResult = {
        success: false,
        error: (error as Error).message,
        duration,
        attemptNumber,
      };

      this.recordDelivery(webhookId, result);

      // Retry if configured
      if (webhook.retry && attemptNumber < webhook.retry.maxAttempts) {
        await this.delay(webhook.retry.backoffMs * Math.pow(2, attemptNumber - 1));
        return this.deliver(webhookId, payload, attemptNumber + 1);
      }

      return result;
    }
  }

  /**
   * Deliver webhook to all subscribers for an event
   */
  async deliverToEventSubscribers(
    eventType: WebhookEventType,
    payload: WebhookPayload
  ): Promise<Map<string, WebhookDeliveryResult>> {
    const webhooks = this.getForEvent(eventType);
    const results = new Map<string, WebhookDeliveryResult>();

    // Deliver to all webhooks in parallel
    const deliveries = await Promise.all(
      webhooks.map(async (webhook) => {
        const result = await this.deliver(webhook.id, payload);
        return [webhook.id, result] as [string, WebhookDeliveryResult];
      })
    );

    for (const [id, result] of deliveries) {
      results.set(id, result);
    }

    return results;
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Parse and verify incoming webhook
   */
  async parseIncoming(
    body: string,
    headers: Headers | Record<string, string>,
    secret: string
  ): Promise<WebhookPayload> {
    // Get signature from headers
    const signature = this.getHeaderValue(headers, 'x-webhook-signature');
    if (!signature) {
      throw new WebhookVerificationError('unknown', { reason: 'Missing signature header' });
    }

    // Verify signature
    if (!this.verifySignature(body, signature, secret)) {
      throw new WebhookVerificationError('unknown', { reason: 'Invalid signature' });
    }

    // Parse payload
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(body);
    } catch (error) {
      throw new WebhookError('unknown', 'Invalid JSON payload');
    }

    // Validate required fields
    if (!payload.type || !payload.id || !payload.timestamp) {
      throw new WebhookError('unknown', 'Missing required fields in payload');
    }

    // Add headers
    if (headers instanceof Headers) {
      const headerObj: Record<string, string> = {};
      headers.forEach((value, key) => {
        headerObj[key] = value;
      });
      payload.headers = headerObj;
    } else {
      payload.headers = headers;
    }

    return payload;
  }

  /**
   * Generate signature
   */
  private generateSignature(payload: string, secret: string): string {
    return `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
  }

  /**
   * Get header value
   */
  private getHeaderValue(headers: Headers | Record<string, string>, name: string): string | undefined {
    if (headers instanceof Headers) {
      return headers.get(name) || undefined;
    }
    return headers[name.toLowerCase()] || headers[name];
  }

  /**
   * Record delivery
   */
  private recordDelivery(webhookId: string, result: WebhookDeliveryResult): void {
    if (!this.deliveryHistory.has(webhookId)) {
      this.deliveryHistory.set(webhookId, []);
    }

    const history = this.deliveryHistory.get(webhookId)!;
    history.push(result);

    // Keep only last 100 deliveries
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Get delivery history
   */
  getDeliveryHistory(webhookId: string): WebhookDeliveryResult[] {
    return this.deliveryHistory.get(webhookId) || [];
  }

  /**
   * Clear delivery history
   */
  clearDeliveryHistory(webhookId: string): void {
    this.deliveryHistory.delete(webhookId);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get statistics
   */
  getStats(): WebhookStats {
    const webhooks = this.getAll();
    const totalDeliveries = Array.from(this.deliveryHistory.values()).reduce(
      (sum, history) => sum + history.length,
      0
    );

    const successfulDeliveries = Array.from(this.deliveryHistory.values()).reduce(
      (sum, history) => sum + history.filter((d) => d.success).length,
      0
    );

    const failedDeliveries = totalDeliveries - successfulDeliveries;

    return {
      totalWebhooks: webhooks.length,
      enabledWebhooks: webhooks.filter((w) => w.enabled).length,
      disabledWebhooks: webhooks.filter((w) => !w.enabled).length,
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      successRate: totalDeliveries > 0 ? successfulDeliveries / totalDeliveries : 1,
    };
  }

  /**
   * Clear all webhooks
   */
  clear(): void {
    this.webhooks.clear();
    this.deliveryHistory.clear();
  }
}

/**
 * Webhook statistics
 */
export interface WebhookStats {
  totalWebhooks: number;
  enabledWebhooks: number;
  disabledWebhooks: number;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  successRate: number;
}

/**
 * Platform-specific webhook handlers
 */

/**
 * GitHub webhook handler
 */
export class GitHubWebhookHandler {
  /**
   * Parse GitHub webhook payload
   */
  static async parse(body: string, headers: Headers | Record<string, string>): Promise<WebhookPayload> {
    const eventType = this.getHeaderValue(headers, 'x-github-event');
    if (!eventType) {
      throw new WebhookVerificationError('github', { reason: 'Missing X-GitHub-Event header' });
    }

    const signature = this.getHeaderValue(headers, 'x-hub-signature-256');
    if (!signature) {
      throw new WebhookVerificationError('github', { reason: 'Missing X-Hub-Signature-256 header' });
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(body);
    } catch (error) {
      throw new WebhookError('github', 'Invalid JSON payload');
    }

    // Map GitHub event to our event type
    const eventTypeMap: Record<string, WebhookEventType> = {
      push: WebhookEventType.GITHUB_PUSH,
      pull_request: WebhookEventType.GITHUB_PULL_REQUEST,
      issues: WebhookEventType.GITHUB_ISSUE,
      release: WebhookEventType.GITHUB_RELEASE,
    };

    return {
      type: eventTypeMap[eventType] || WebhookEventType.CUSTOM,
      id: data.id as string,
      timestamp: new Date(),
      source: 'github',
      data,
      signature,
      headers: this.headersToObject(headers),
    };
  }

  /**
   * Verify GitHub webhook signature
   */
  static verify(body: string, signature: string, secret: string): boolean {
    const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  private static getHeaderValue(headers: Headers | Record<string, string>, name: string): string | undefined {
    if (headers instanceof Headers) {
      return headers.get(name) || undefined;
    }
    return headers[name.toLowerCase()] || headers[name];
  }

  private static headersToObject(headers: Headers | Record<string, string>): Record<string, string> {
    if (headers instanceof Headers) {
      const obj: Record<string, string> = {};
      headers.forEach((value, key) => {
        obj[key] = value;
      });
      return obj;
    }
    return headers;
  }
}

/**
 * GitLab webhook handler
 */
export class GitLabWebhookHandler {
  /**
   * Parse GitLab webhook payload
   */
  static async parse(body: string, headers: Headers | Record<string, string>): Promise<WebhookPayload> {
    const eventType = this.getHeaderValue(headers, 'x-gitlab-event');
    if (!eventType) {
      throw new WebhookVerificationError('gitlab', { reason: 'Missing X-GitLab-Event header' });
    }

    const token = this.getHeaderValue(headers, 'x-gitlab-token');
    if (!token) {
      throw new WebhookVerificationError('gitlab', { reason: 'Missing X-GitLab-Token header' });
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(body);
    } catch (error) {
      throw new WebhookError('gitlab', 'Invalid JSON payload');
    }

    // Map GitLab event to our event type
    const eventTypeMap: Record<string, WebhookEventType> = {
      'Push Hook': WebhookEventType.GITLAB_PUSH,
      'Merge Request Hook': WebhookEventType.GITLAB_MERGE_REQUEST,
      'Issue Hook': WebhookEventType.GITLAB_ISSUE,
    };

    return {
      type: eventTypeMap[eventType] || WebhookEventType.CUSTOM,
      id: data.id as string,
      timestamp: new Date(),
      source: 'gitlab',
      data,
      signature: token,
      headers: this.headersToObject(headers),
    };
  }

  private static getHeaderValue(headers: Headers | Record<string, string>, name: string): string | undefined {
    if (headers instanceof Headers) {
      return headers.get(name) || undefined;
    }
    return headers[name.toLowerCase()] || headers[name];
  }

  private static headersToObject(headers: Headers | Record<string, string>): Record<string, string> {
    if (headers instanceof Headers) {
      const obj: Record<string, string> = {};
      headers.forEach((value, key) => {
        obj[key] = value;
      });
      return obj;
    }
    return headers;
  }
}

/**
 * Bitbucket webhook handler
 */
export class BitbucketWebhookHandler {
  /**
   * Parse Bitbucket webhook payload
   */
  static async parse(body: string, headers: Headers | Record<string, string>): Promise<WebhookPayload> {
    const eventType = this.getHeaderValue(headers, 'x-event-key');
    if (!eventType) {
      throw new WebhookVerificationError('bitbucket', { reason: 'Missing X-Event-Key header' });
    }

    const uuid = this.getHeaderValue(headers, 'x-request-uuid');
    if (!uuid) {
      throw new WebhookVerificationError('bitbucket', { reason: 'Missing X-Request-UUID header' });
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(body);
    } catch (error) {
      throw new WebhookError('bitbucket', 'Invalid JSON payload');
    }

    // Map Bitbucket event to our event type
    const eventTypeMap: Record<string, WebhookEventType> = {
      'repo:push': WebhookEventType.BITBUCKET_PUSH,
      'pullrequest:created': WebhookEventType.BITBUCKET_PULL_REQUEST,
      'pullrequest:updated': WebhookEventType.BITBUCKET_PULL_REQUEST,
    };

    return {
      type: eventTypeMap[eventType] || WebhookEventType.CUSTOM,
      id: uuid,
      timestamp: new Date(),
      source: 'bitbucket',
      data,
      headers: this.headersToObject(headers),
    };
  }

  private static getHeaderValue(headers: Headers | Record<string, string>, name: string): string | undefined {
    if (headers instanceof Headers) {
      return headers.get(name) || undefined;
    }
    return headers[name.toLowerCase()] || headers[name];
  }

  private static headersToObject(headers: Headers | Record<string, string>): Record<string, string> {
    if (headers instanceof Headers) {
      const obj: Record<string, string> = {};
      headers.forEach((value, key) => {
        obj[key] = value;
      });
      return obj;
    }
    return headers;
  }
}

/**
 * Global webhook handler instance
 */
export const globalWebhookHandler = new WebhookHandler();
