/**
 * Webhook Data Ingestion
 * Handles incoming webhook data for Cloudflare Workers
 */

import type {
  WebhookConfig,
  WebhookValidationConfig,
  StreamEvent
} from '../types';

export interface WebhookIngestorConfig {
  id: string;
  config: WebhookConfig;
}

export class WebhookIngestor {
  private config: WebhookIngestorConfig;
  private eventHandlers: Map<string, (event: StreamEvent) => void> = new Map();

  constructor(config: WebhookIngestorConfig) {
    this.config = config;
  }

  /**
   * Handle incoming webhook request
   */
  async handle(request: Request): Promise<Response> {
    try {
      // Validate method
      if (request.method !== this.config.config.method) {
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { status: 405, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Validate authentication if configured
      if (this.config.config.auth) {
        const authValid = await this.validateAuth(request);
        if (!authValid) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      // Validate webhook signature if configured
      if (this.config.config.validation) {
        const signatureValid = await this.validateSignature(request);
        if (!signatureValid) {
          return new Response(
            JSON.stringify({ error: 'Invalid signature' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      // Parse request body
      const payload = await request.json();

      // Create stream event
      const event = this.createEvent(payload);

      // Trigger handlers
      this.triggerHandlers(event);

      // Return success response
      return new Response(
        JSON.stringify({ success: true, eventId: event.key }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Register event handler
   */
  on(event: string, handler: (event: StreamEvent) => void): void {
    this.eventHandlers.set(event, handler);
  }

  /**
   * Remove event handler
   */
  off(event: string): void {
    this.eventHandlers.delete(event);
  }

  /**
   * Validate request authentication
   */
  private async validateAuth(request: Request): Promise<boolean> {
    const auth = this.config.config.auth;
    if (!auth) return true;

    switch (auth.type) {
      case 'bearer':
        const authHeader = request.headers.get('Authorization');
        const expectedToken = auth.credentials?.token || '';
        return authHeader === `Bearer ${expectedToken}`;

      case 'api-key':
        const apiKeyName = auth.credentials?.headerName || 'X-API-Key';
        const apiKey = request.headers.get(apiKeyName);
        return apiKey === auth.credentials?.apiKey;

      case 'basic':
        const basicHeader = request.headers.get('Authorization');
        if (!basicHeader?.startsWith('Basic ')) {
          return false;
        }
        const credentials = atob(basicHeader.slice(6));
        const [username, password] = credentials.split(':');
        return username === auth.credentials?.username &&
               password === auth.credentials?.password;

      default:
        return true;
    }
  }

  /**
   * Validate webhook signature
   */
  private async validateSignature(request: Request): Promise<boolean> {
    const validation = this.config.config.validation;
    if (!validation) return true;

    switch (validation.type) {
      case 'hmac':
        return this.validateHMAC(request, validation);

      case 'signature':
        return this.validateCustomSignature(request, validation);

      default:
        return true;
    }
  }

  /**
   * Validate HMAC signature
   */
  private async validateHMAC(
    request: Request,
    validation: WebhookValidationConfig
  ): Promise<boolean> {
    const signatureHeader = request.headers.get(validation.header || 'X-Signature');
    if (!signatureHeader) {
      return false;
    }

    // Get raw body
    const body = await request.text();

    // In a real implementation, we would:
    // 1. Extract the signature from the header
    // 2. Compute HMAC of the body using the secret
    // 3. Compare signatures using timing-safe comparison

    // For now, return true (placeholder)
    return true;
  }

  /**
   * Validate custom signature
   */
  private async validateCustomSignature(
    request: Request,
    validation: WebhookValidationConfig
  ): Promise<boolean> {
    const signature = request.headers.get(validation.header || 'X-Signature');
    return signature !== null;
  }

  /**
   * Create stream event from webhook payload
   */
  private createEvent(payload: unknown): StreamEvent {
    return {
      key: this.generateKey(payload),
      value: payload,
      timestamp: new Date(),
      headers: this.extractHeaders(),
      metadata: {
        source: this.config.id,
        sourceType: 'webhook'
      }
    };
  }

  /**
   * Generate unique key for payload
   */
  private generateKey(payload: unknown): string {
    if (typeof payload === 'object' && payload !== null) {
      const obj = payload as Record<string, unknown>;
      for (const key of ['id', 'event_id', 'webhook_id']) {
        if (typeof obj[key] === 'string' || typeof obj[key] === 'number') {
          return `${this.config.id}-${obj[key]}`;
        }
      }
    }

    return `${this.config.id}-${Date.now()}-${Math.random()}`;
  }

  /**
   * Extract relevant headers from request
   */
  private extractHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json'
    };
  }

  /**
   * Trigger all registered event handlers
   */
  private triggerHandlers(event: StreamEvent): void {
    for (const [_, handler] of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in webhook handler:', error);
      }
    }
  }
}

/**
 * Webhook manager for managing multiple webhooks
 */
export class WebhookManager {
  private webhooks: Map<string, WebhookIngestor> = new Map();

  register(config: WebhookIngestorConfig): void {
    const webhook = new WebhookIngestor(config);
    this.webhooks.set(config.id, webhook);
  }

  unregister(id: string): void {
    this.webhooks.delete(id);
  }

  get(id: string): WebhookIngestor | undefined {
    return this.webhooks.get(id);
  }

  async route(request: Request, webhookId: string): Promise<Response> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      return new Response(
        JSON.stringify({ error: 'Webhook not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return webhook.handle(request);
  }
}
