// @ts-nocheck
/**
 * Webhook Handler - handles HTTP webhook triggers
 */

import type { Trigger, TriggerCallback, TriggerId, WebhookTriggerConfig } from '../types';

export interface WebhookRequest {
  headers: Record<string, string>;
  body: any;
  query: Record<string, string>;
  method: string;
  url: string;
}

export class WebhookHandler {
  private webhooks: Map<TriggerId, WebhookTriggerConfig>;
  private endpoints: Map<string, TriggerId>;
  private callbacks: Map<TriggerId, TriggerCallback>;

  constructor() {
    this.webhooks = new Map();
    this.endpoints = new Map();
    this.callbacks = new Map();
  }

  /**
   * Register a webhook trigger
   */
  public async register(
    trigger: Trigger,
    callback: TriggerCallback
  ): Promise<void> {
    const config = trigger.config as WebhookTriggerConfig;

    this.webhooks.set(trigger.id, config);
    this.callbacks.set(trigger.id, callback);
    this.endpoints.set(config.endpoint, trigger.id);
  }

  /**
   * Unregister a webhook trigger
   */
  public async unregister(triggerId: TriggerId): Promise<void> {
    const config = this.webhooks.get(triggerId);
    if (config) {
      this.endpoints.delete(config.endpoint);
    }

    this.webhooks.delete(triggerId);
    this.callbacks.delete(triggerId);
  }

  /**
   * Handle an incoming webhook request
   */
  public async handle(
    endpoint: string,
    request: Request
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const triggerId = this.endpoints.get(endpoint);

    if (!triggerId) {
      return {
        success: false,
        error: 'Webhook endpoint not found'
      };
    }

    const config = this.webhooks.get(triggerId);
    const callback = this.callbacks.get(triggerId);

    if (!config || !callback) {
      return {
        success: false,
        error: 'Webhook configuration not found'
      };
    }

    try {
      // Parse request
      const requestBody = await request.json();
      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headers[key] = value;
      });

      const webhookRequest: WebhookRequest = {
        headers,
        body: requestBody,
        query: {}, // Would need to parse URL
        method: request.method,
        url: request.url
      };

      // Validate method
      if (config.method && webhookRequest.method !== config.method) {
        return {
          success: false,
          error: `Method not allowed. Expected: ${config.method}`
        };
      }

      // Validate signature if configured
      if (config.validation?.validateSignature) {
        const signature = headers[config.validation.secretHeader || 'x-signature'];

        if (!signature || !this.validateSignature(signature, config.validation.secret!, requestBody)) {
          return {
            success: false,
            error: 'Invalid signature'
          };
        }
      }

      // Parse source-specific data
      let processedData = requestBody;

      if (config.source === 'github') {
        processedData = this.parseGitHubWebhook(requestBody);
      } else if (config.source === 'gitlab') {
        processedData = this.parseGitLabWebhook(requestBody);
      }

      // Execute callback
      await callback(triggerId, processedData);

      return {
        success: true,
        data: { message: 'Webhook processed successfully' }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate webhook signature
   */
  private validateSignature(
    signature: string,
    secret: string,
    body: any
  ): boolean {
    // Simplified signature validation
    // In production, use proper HMAC validation
    const expected = `sha256=${Buffer.from(JSON.stringify(body) + secret).toString('base64')}`;
    return signature === expected;
  }

  /**
   * Parse GitHub webhook payload
   */
  private parseGitHubWebhook(payload: any): any {
    return {
      source: 'github',
      event: payload.action || payload.event_type,
      repository: payload.repository?.full_name,
      sender: payload.sender?.login,
      action: payload.action,
      data: payload
    };
  }

  /**
   * Parse GitLab webhook payload
   */
  private parseGitLabWebhook(payload: any): any {
    return {
      source: 'gitlab',
      event: payload.object_kind,
      repository: payload.project?.path_with_namespace,
      sender: payload.user?.username,
      action: payload.object_attributes?.action,
      data: payload
    };
  }

  /**
   * Get all registered endpoints
   */
  public getEndpoints(): string[] {
    return Array.from(this.endpoints.keys());
  }

  /**
   * Get webhook statistics
   */
  public getStats(): {
    totalWebhooks: number;
    endpoints: string[];
  } {
    return {
      totalWebhooks: this.webhooks.size,
      endpoints: this.getEndpoints()
    };
  }

  /**
   * Cleanup
   */
  public async cleanup(): Promise<void> {
    this.webhooks.clear();
    this.endpoints.clear();
    this.callbacks.clear();
  }
}
