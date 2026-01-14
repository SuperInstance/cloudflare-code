/**
 * Webhook notification channel
 * Supports generic HTTP webhooks with configurable retry policies
 */

import type {
  Notification,
  NotificationRecipient,
  WebhookProvider,
  ChannelDeliveryResult,
  ChannelStats,
} from '../types';
import { BaseChannel, ChannelDeliveryOptions } from './base';

export interface WebhookChannelConfig {
  providers: Map<string, WebhookProvider>;
  maxRetries?: number;
  timeout?: number;
  defaultHeaders?: Record<string, string>;
}

export interface WebhookMessage {
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  payload: WebhookPayload;
  timeout: number;
}

export interface WebhookPayload {
  id: string;
  channel: string;
  priority: string;
  category: string;
  subject?: string;
  content: string;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface WebhookResponse {
  ok: boolean;
  status?: number;
  messageId?: string;
  error?: string;
}

/**
 * Webhook notification channel implementation
 */
export class WebhookChannel extends BaseChannel {
  private config: WebhookChannelConfig;
  private stats: ChannelStats = {
    totalSent: 0,
    totalDelivered: 0,
    totalFailed: 0,
    averageDeliveryTime: 0,
  };
  private deliveryTimes: number[] = [];

  constructor(config: WebhookChannelConfig) {
    super('webhook', config.providers);
    this.config = config;
  }

  /**
   * Validate webhook URL
   */
  async validateRecipient(recipient: NotificationRecipient): Promise<boolean> {
    try {
      const url = new URL(recipient.address);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Send webhook notification
   */
  async send(
    notification: Notification,
    recipient: NotificationRecipient,
    options?: ChannelDeliveryOptions
  ): Promise<ChannelDeliveryResult> {
    const startTime = Date.now();

    try {
      this.validateNotification(notification);
      const isValid = await this.validateRecipient(recipient);

      if (!isValid) {
        throw new Error(`Invalid webhook URL: ${recipient.address}`);
      }

      const message = this.buildMessage(notification, recipient);
      const result = await this.sendWebhook(message, options);

      const duration = Date.now() - startTime;
      this.updateStats(result.success, duration);

      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        errorCode: result.success ? undefined : 'WEBHOOK_ERROR',
        metadata: {
          ...result,
          duration,
          url: message.url,
          method: message.method,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateStats(false, duration);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'SEND_FAILED',
        metadata: { duration },
      };
    }
  }

  /**
   * Build webhook message from notification
   */
  private buildMessage(
    notification: Notification,
    recipient: NotificationRecipient
  ): WebhookMessage {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'ClaudeFlare/1.0',
      'X-Notification-ID': notification.id,
      'X-Notification-Category': notification.category,
      'X-Notification-Priority': notification.priority,
      ...this.config.defaultHeaders,
    };

    if (notification.metadata?.correlationId) {
      headers['X-Correlation-ID'] = notification.metadata.correlationId;
    }

    if (notification.metadata?.source) {
      headers['X-Notification-Source'] = notification.metadata.source;
    }

    const payload: WebhookPayload = {
      id: notification.id,
      channel: notification.channel,
      priority: notification.priority,
      category: notification.category,
      subject: notification.subject,
      content: notification.content,
      data: notification.data,
      metadata: notification.metadata,
      timestamp: new Date().toISOString(),
    };

    return {
      url: recipient.address,
      method: 'POST',
      headers,
      payload,
      timeout: this.config.timeout || 30000,
    };
  }

  /**
   * Send webhook with retry logic
   */
  private async sendWebhook(
    message: WebhookMessage,
    options?: ChannelDeliveryOptions
  ): Promise<WebhookResponse> {
    const maxRetries = options?.retryAttempts ?? this.config.maxRetries ?? 3;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeWebhook(message, attempt);
        if (result.ok) {
          return result;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Don't retry on certain HTTP status codes
        if (error instanceof WebhookError) {
          if (error.status === 400 || error.status === 401 || error.status === 403) {
            break; // Don't retry client errors
          }
        }

        // Wait before retrying with exponential backoff
        if (attempt < maxRetries) {
          const delay = this.calculateBackoff(attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    return {
      ok: false,
      error: lastError?.message || 'Webhook delivery failed after retries',
    };
  }

  /**
   * Execute the webhook HTTP request
   */
  private async executeWebhook(
    message: WebhookMessage,
    attempt: number
  ): Promise<WebhookResponse> {
    const startTime = Date.now();

    try {
      // Simulate HTTP request
      await this.simulateNetworkDelay(message.timeout);

      // Simulate success response
      const duration = Date.now() - startTime;

      return {
        ok: true,
        status: 200,
        messageId: `webhook_${Date.now()}_${attempt}`,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error instanceof WebhookError) {
        throw error;
      }

      throw new WebhookError(
        error instanceof Error ? error.message : 'Unknown webhook error',
        500
      );
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 10000; // 10 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    // Add jitter to avoid thundering herd
    return delay + Math.random() * 1000;
  }

  /**
   * Simulate network delay for testing
   */
  private async simulateNetworkDelay(timeout: number): Promise<void> {
    const delay = Math.random() * (timeout / 2);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Update channel statistics
   */
  private updateStats(success: boolean, duration: number): void {
    this.stats.totalSent++;
    if (success) {
      this.stats.totalDelivered++;
      this.deliveryTimes.push(duration);
    } else {
      this.stats.totalFailed++;
    }

    if (this.deliveryTimes.length > 0) {
      const sum = this.deliveryTimes.reduce((a, b) => a + b, 0);
      this.stats.averageDeliveryTime = sum / this.deliveryTimes.length;
    }

    this.stats.lastDeliveryAt = new Date();
  }

  /**
   * Check if webhook channel is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      return this.config.providers.size > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get channel statistics
   */
  async getStats(): Promise<ChannelStats> {
    return { ...this.stats };
  }
}

/**
 * Webhook-specific error class
 */
export class WebhookError extends Error {
  constructor(
    message: string,
    public status: number,
    public responseBody?: string
  ) {
    super(message);
    this.name = 'WebhookError';
  }
}
