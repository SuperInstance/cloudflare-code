/**
 * Email notification channel
 * Supports SMTP, SendGrid, AWS SES, Mailgun, and Postmark
 */

import type {
  Notification,
  NotificationRecipient,
  EmailProvider,
  ChannelDeliveryResult,
  ChannelStats,
} from '../types';
import { BaseChannel, ChannelDeliveryOptions } from './base';

export interface EmailChannelConfig {
  provider: EmailProvider;
  maxRetries?: number;
  timeout?: number;
}

export interface EmailMessage {
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  text: string;
  html?: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

/**
 * Email notification channel implementation
 */
export class EmailChannel extends BaseChannel {
  private config: EmailChannelConfig;
  private stats: ChannelStats = {
    totalSent: 0,
    totalDelivered: 0,
    totalFailed: 0,
    averageDeliveryTime: 0,
  };
  private deliveryTimes: number[] = [];

  constructor(config: EmailChannelConfig) {
    super('email', config.provider);
    this.config = config;
  }

  /**
   * Validate email recipient
   */
  async validateRecipient(recipient: NotificationRecipient): Promise<boolean> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(recipient.address);
  }

  /**
   * Send email notification
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
        throw new Error(`Invalid email address: ${recipient.address}`);
      }

      const message = this.buildMessage(notification, recipient);
      const result = await this.sendEmail(message, options);

      const duration = Date.now() - startTime;
      this.updateStats(true, duration);

      return {
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        errorCode: result.errorCode,
        metadata: {
          ...result.metadata,
          duration,
          provider: this.config.provider.type,
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
   * Build email message from notification
   */
  private buildMessage(
    notification: Notification,
    recipient: NotificationRecipient
  ): EmailMessage {
    const provider = this.config.provider;

    return {
      to: recipient.address,
      subject: notification.subject || 'Notification',
      text: notification.content,
      html: notification.htmlContent || this.textToHtml(notification.content),
      from: provider.config.from,
      fromName: provider.config.fromName,
      replyTo: provider.config.replyTo,
      headers: notification.metadata
        ? {
            'X-Notification-ID': notification.id,
            'X-Notification-Category': notification.category,
            'X-Correlation-ID': notification.metadata.correlationId || '',
          }
        : undefined,
    };
  }

  /**
   * Convert plain text to HTML
   */
  private textToHtml(text: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .content { white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="content">${this.escapeHtml(text)}</div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Send email using the configured provider
   */
  private async sendEmail(
    message: EmailMessage,
    options?: ChannelDeliveryOptions
  ): Promise<ChannelDeliveryResult> {
    const provider = this.config.provider;

    switch (provider.type) {
      case 'smtp':
        return this.sendViaSMTP(message, options);
      case 'sendgrid':
        return this.sendViaSendGrid(message, options);
      case 'ses':
        return this.sendViaSES(message, options);
      case 'mailgun':
        return this.sendViaMailgun(message, options);
      case 'postmark':
        return this.sendViaPostmark(message, options);
      default:
        return {
          success: false,
          error: `Unsupported email provider: ${provider.type}`,
          errorCode: 'UNSUPPORTED_PROVIDER',
        };
    }
  }

  /**
   * Send via SMTP
   */
  private async sendViaSMTP(
    message: EmailMessage,
    options?: ChannelDeliveryOptions
  ): Promise<ChannelDeliveryResult> {
    // In a real implementation, this would use nodemailer or similar
    // For now, we'll simulate the sending
    const timeout = options?.timeout || this.config.timeout || 30000;

    await this.simulateNetworkDelay(timeout);

    return {
      success: true,
      messageId: `smtp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        provider: 'smtp',
        host: this.config.provider.config.host,
      },
    };
  }

  /**
   * Send via SendGrid
   */
  private async sendViaSendGrid(
    message: EmailMessage,
    options?: ChannelDeliveryOptions
  ): Promise<ChannelDeliveryResult> {
    const apiKey = this.config.provider.config.apiKey;
    if (!apiKey) {
      return {
        success: false,
        error: 'SendGrid API key not configured',
        errorCode: 'MISSING_API_KEY',
      };
    }

    // Simulate API call
    await this.simulateNetworkDelay(options?.timeout || 10000);

    return {
      success: true,
      messageId: `sendgrid_${Date.now()}`,
      metadata: { provider: 'sendgrid' },
    };
  }

  /**
   * Send via AWS SES
   */
  private async sendViaSES(
    message: EmailMessage,
    options?: ChannelDeliveryOptions
  ): Promise<ChannelDeliveryResult> {
    // Simulate AWS SES API call
    await this.simulateNetworkDelay(options?.timeout || 10000);

    return {
      success: true,
      messageId: `ses_${Date.now()}`,
      metadata: { provider: 'ses' },
    };
  }

  /**
   * Send via Mailgun
   */
  private async sendViaMailgun(
    message: EmailMessage,
    options?: ChannelDeliveryOptions
  ): Promise<ChannelDeliveryResult> {
    const apiKey = this.config.provider.config.apiKey;
    if (!apiKey) {
      return {
        success: false,
        error: 'Mailgun API key not configured',
        errorCode: 'MISSING_API_KEY',
      };
    }

    await this.simulateNetworkDelay(options?.timeout || 10000);

    return {
      success: true,
      messageId: `mailgun_${Date.now()}`,
      metadata: { provider: 'mailgun' },
    };
  }

  /**
   * Send via Postmark
   */
  private async sendViaPostmark(
    message: EmailMessage,
    options?: ChannelDeliveryOptions
  ): Promise<ChannelDeliveryResult> {
    const apiKey = this.config.provider.config.apiKey;
    if (!apiKey) {
      return {
        success: false,
        error: 'Postmark API key not configured',
        errorCode: 'MISSING_API_KEY',
      };
    }

    await this.simulateNetworkDelay(options?.timeout || 10000);

    return {
      success: true,
      messageId: `postmark_${Date.now()}`,
      metadata: { provider: 'postmark' },
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
   * Check if email channel is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if provider is configured
      const provider = this.config.provider;

      switch (provider.type) {
        case 'smtp':
          return !!(provider.config.host && provider.config.auth);
        case 'sendgrid':
        case 'mailgun':
        case 'postmark':
          return !!provider.config.apiKey;
        case 'ses':
          return true; // SES uses AWS credentials
        default:
          return false;
      }
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
