// @ts-nocheck
/**
 * Base channel interface and abstract implementation
 */

import type {
  Notification,
  NotificationChannelType,
  DeliveryReceipt,
  NotificationRecipient,
} from '../types';

export interface ChannelDeliveryOptions {
  timeout?: number;
  retryAttempts?: number;
  metadata?: Record<string, unknown>;
}

export interface ChannelDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Abstract base class for all notification channels
 */
export abstract class BaseChannel {
  protected provider: unknown;
  protected channelType: NotificationChannelType;

  constructor(channelType: NotificationChannelType, provider?: unknown) {
    this.channelType = channelType;
    this.provider = provider;
  }

  /**
   * Get the channel type
   */
  getChannelType(): NotificationChannelType {
    return this.channelType;
  }

  /**
   * Validate recipient configuration
   */
  abstract validateRecipient(recipient: NotificationRecipient): Promise<boolean>;

  /**
   * Send a notification to a recipient
   */
  abstract send(
    notification: Notification,
    recipient: NotificationRecipient,
    options?: ChannelDeliveryOptions
  ): Promise<ChannelDeliveryResult>;

  /**
   * Send bulk notifications to multiple recipients
   */
  async sendBulk(
    notification: Notification,
    recipients: NotificationRecipient[],
    options?: ChannelDeliveryOptions
  ): Promise<ChannelDeliveryResult[]> {
    const results: ChannelDeliveryResult[] = [];

    for (const recipient of recipients) {
      try {
        const result = await this.send(notification, recipient, options);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Create a delivery receipt from a delivery result
   */
  protected createReceipt(
    notificationId: string,
    result: ChannelDeliveryResult,
    recipient: NotificationRecipient
  ): DeliveryReceipt {
    return {
      id: this.generateId(),
      notificationId,
      channelId: this.channelType,
      status: result.success ? 'delivered' : 'failed',
      attempts: 1,
      sentAt: new Date(),
      deliveredAt: result.success ? new Date() : undefined,
      failedAt: result.success ? undefined : new Date(),
      errorMessage: result.error,
      errorCode: result.errorCode,
      providerMessageId: result.messageId,
      metadata: result.metadata,
    };
  }

  /**
   * Generate a unique ID
   */
  protected generateId(): string {
    return `${this.channelType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate notification content
   */
  protected validateNotification(notification: Notification): void {
    if (!notification.content || notification.content.trim().length === 0) {
      throw new Error('Notification content cannot be empty');
    }

    if (notification.channel !== this.channelType) {
      throw new Error(
        `Notification channel mismatch. Expected ${this.channelType}, got ${notification.channel}`
      );
    }
  }

  /**
   * Transform notification data for the channel
   */
  protected transformNotification(
    notification: Notification,
    recipient: NotificationRecipient
  ): Record<string, unknown> {
    return {
      id: notification.id,
      subject: notification.subject || '',
      content: notification.content,
      htmlContent: notification.htmlContent,
      data: notification.data,
      metadata: notification.metadata,
      recipient: {
        id: recipient.id,
        address: recipient.address,
        userId: recipient.userId,
      },
    };
  }

  /**
   * Handle delivery error
   */
  protected handleError(error: unknown, recipient: NotificationRecipient): Error {
    if (error instanceof Error) {
      return new Error(
        `Failed to deliver to ${recipient.address}: ${error.message}`
      );
    }
    return new Error(
      `Failed to deliver to ${recipient.address}: Unknown error`
    );
  }

  /**
   * Check if channel is healthy
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * Get channel statistics
   */
  abstract getStats(): Promise<ChannelStats>;
}

export interface ChannelStats {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  averageDeliveryTime: number;
  lastDeliveryAt?: Date;
}
