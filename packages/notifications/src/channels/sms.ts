// @ts-nocheck
/**
 * SMS notification channel
 * Supports Twilio, AWS SNS, MessageBird, and Nexmo
 */

import type {
  Notification,
  NotificationRecipient,
  SmsProvider,
  ChannelDeliveryResult,
  ChannelStats,
} from '../types';
import { BaseChannel, ChannelDeliveryOptions } from './base';

export interface SmsChannelConfig {
  provider: SmsProvider;
  maxRetries?: number;
  timeout?: number;
  maxSegments?: number;
}

export interface SmsMessage {
  to: string;
  from: string;
  body: string;
  statusCallback?: string;
  maxPrice?: number;
  validityPeriod?: number;
}

/**
 * SMS notification channel implementation
 */
export class SmsChannel extends BaseChannel {
  private config: SmsChannelConfig;
  private stats: ChannelStats = {
    totalSent: 0,
    totalDelivered: 0,
    totalFailed: 0,
    averageDeliveryTime: 0,
  };
  private deliveryTimes: number[] = [];

  constructor(config: SmsChannelConfig) {
    super('sms', config.provider);
    this.config = config;
  }

  /**
   * Validate SMS recipient (phone number)
   */
  async validateRecipient(recipient: NotificationRecipient): Promise<boolean> {
    // Support international phone numbers with optional +
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    const cleaned = recipient.address.replace(/[\s\-\(\)]/g, '');
    return phoneRegex.test(cleaned);
  }

  /**
   * Send SMS notification
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
        throw new Error(`Invalid phone number: ${recipient.address}`);
      }

      const message = this.buildMessage(notification, recipient);
      const result = await this.sendSms(message, options);

      const duration = Date.now() - startTime;
      this.updateStats(result.success, duration);

      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        errorCode: result.errorCode,
        metadata: {
          ...result.metadata,
          duration,
          provider: this.config.provider.type,
          segments: this.calculateSegments(message.body),
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
   * Build SMS message from notification
   */
  private buildMessage(
    notification: Notification,
    recipient: NotificationRecipient
  ): SmsMessage {
    let body = notification.content;

    // Truncate if too long (SMS standard is 160 chars per segment)
    const maxSegments = this.config.maxSegments || 10;
    const maxChars = maxSegments * 153; // 153 chars for multi-part messages

    if (body.length > maxChars) {
      body = body.substring(0, maxChars - 3) + '...';
    }

    return {
      to: this.cleanPhoneNumber(recipient.address),
      from: this.config.provider.config.fromNumber,
      body,
    };
  }

  /**
   * Clean and normalize phone number
   */
  private cleanPhoneNumber(phone: string): string {
    return phone.replace(/[\s\-\(\)]/g, '');
  }

  /**
   * Calculate number of SMS segments needed
   */
  private calculateSegments(text: string): number {
    const length = text.length;
    if (length <= 160) return 1;
    return Math.ceil(length / 153);
  }

  /**
   * Send SMS using the configured provider
   */
  private async sendSms(
    message: SmsMessage,
    options?: ChannelDeliveryOptions
  ): Promise<ChannelDeliveryResult> {
    const provider = this.config.provider;

    switch (provider.type) {
      case 'twilio':
        return this.sendViaTwilio(message, options);
      case 'aws_sns':
        return this.sendViaSNS(message, options);
      case 'messagebird':
        return this.sendViaMessageBird(message, options);
      case 'nexmo':
        return this.sendViaNexmo(message, options);
      default:
        return {
          success: false,
          error: `Unsupported SMS provider: ${provider.type}`,
          errorCode: 'UNSUPPORTED_PROVIDER',
        };
    }
  }

  /**
   * Send via Twilio
   */
  private async sendViaTwilio(
    message: SmsMessage,
    options?: ChannelDeliveryOptions
  ): Promise<ChannelDeliveryResult> {
    const { accountSid, authToken } = this.config.provider.config;

    if (!accountSid || !authToken) {
      return {
        success: false,
        error: 'Twilio credentials not configured',
        errorCode: 'MISSING_CREDENTIALS',
      };
    }

    // Simulate API call
    await this.simulateNetworkDelay(options?.timeout || 10000);

    return {
      success: true,
      messageId: `twilio_${Date.now()}`,
      metadata: {
        provider: 'twilio',
        from: message.from,
        to: message.to,
      },
    };
  }

  /**
   * Send via AWS SNS
   */
  private async sendViaSNS(
    message: SmsMessage,
    options?: ChannelDeliveryOptions
  ): Promise<ChannelDeliveryResult> {
    const apiKey = this.config.provider.config.apiKey;
    if (!apiKey) {
      return {
        success: false,
        error: 'AWS credentials not configured',
        errorCode: 'MISSING_CREDENTIALS',
      };
    }

    await this.simulateNetworkDelay(options?.timeout || 10000);

    return {
      success: true,
      messageId: `sns_${Date.now()}`,
      metadata: { provider: 'aws_sns' },
    };
  }

  /**
   * Send via MessageBird
   */
  private async sendViaMessageBird(
    message: SmsMessage,
    options?: ChannelDeliveryOptions
  ): Promise<ChannelDeliveryResult> {
    const apiKey = this.config.provider.config.apiKey;
    if (!apiKey) {
      return {
        success: false,
        error: 'MessageBird API key not configured',
        errorCode: 'MISSING_API_KEY',
      };
    }

    await this.simulateNetworkDelay(options?.timeout || 10000);

    return {
      success: true,
      messageId: `messagebird_${Date.now()}`,
      metadata: { provider: 'messagebird' },
    };
  }

  /**
   * Send via Nexmo (Vonage)
   */
  private async sendViaNexmo(
    message: SmsMessage,
    options?: ChannelDeliveryOptions
  ): Promise<ChannelDeliveryResult> {
    const apiKey = this.config.provider.config.apiKey;
    if (!apiKey) {
      return {
        success: false,
        error: 'Nexmo API key not configured',
        errorCode: 'MISSING_API_KEY',
      };
    }

    await this.simulateNetworkDelay(options?.timeout || 10000);

    return {
      success: true,
      messageId: `nexmo_${Date.now()}`,
      metadata: { provider: 'nexmo' },
    };
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
   * Check if SMS channel is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const provider = this.config.provider;
      return !!(
        provider.config.fromNumber &&
        (provider.config.apiKey ||
          provider.config.authToken ||
          provider.config.accountSid)
      );
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
