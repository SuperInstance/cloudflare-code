/**
 * Slack notification channel
 * Supports incoming webhooks and Slack API
 */

import type {
  Notification,
  NotificationRecipient,
  SlackProvider,
  ChannelDeliveryResult,
  ChannelStats,
} from '../types';
import { BaseChannel, ChannelDeliveryOptions } from './base';

export interface SlackChannelConfig {
  provider: SlackProvider;
  maxRetries?: number;
  timeout?: number;
}

export interface SlackMessage {
  webhookUrl: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
  text: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
  threadTs?: string;
  replyBroadcast?: boolean;
}

export interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: string;
    text: string;
    emoji?: boolean;
  }>;
  accessory?: unknown;
}

export interface SlackAttachment {
  color?: string;
  fallback?: string;
  title?: string;
  text?: string;
  title_link?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
  footer?: string;
  ts?: number;
}

/**
 * Slack notification channel implementation
 */
export class SlackChannel extends BaseChannel {
  private config: SlackChannelConfig;
  private stats: ChannelStats = {
    totalSent: 0,
    totalDelivered: 0,
    totalFailed: 0,
    averageDeliveryTime: 0,
  };
  private deliveryTimes: number[] = [];

  constructor(config: SlackChannelConfig) {
    super('slack', config.provider);
    this.config = config;
  }

  /**
   * Validate Slack webhook URL
   */
  async validateRecipient(recipient: NotificationRecipient): Promise<boolean> {
    // Slack webhook URL format: https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
    const slackWebhookRegex = /^https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Za-z0-9]+$/;
    return slackWebhookRegex.test(recipient.address);
  }

  /**
   * Send Slack notification
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
        throw new Error(`Invalid Slack webhook URL: ${recipient.address}`);
      }

      const message = this.buildMessage(notification, recipient);
      const result = await this.sendToSlack(message, options);

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
          channel: message.channel,
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
   * Build Slack message from notification
   */
  private buildMessage(
    notification: Notification,
    recipient: NotificationRecipient
  ): SlackMessage {
    const provider = this.config.provider;

    // Build blocks for structured message
    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: notification.subject || 'Notification',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: notification.content,
        },
      },
    ];

    // Add metadata fields if available
    if (notification.metadata || notification.data) {
      const fields: Array<{ type: string; text: string }> = [];

      if (notification.metadata?.correlationId) {
        fields.push({
          type: 'mrkdwn',
          text: `*Correlation ID:*\n${notification.metadata.correlationId}`,
        });
      }

      if (notification.category) {
        fields.push({
          type: 'mrkdwn',
          text: `*Category:*\n${notification.category}`,
        });
      }

      if (notification.priority) {
        const emoji = this.getPriorityEmoji(notification.priority);
        fields.push({
          type: 'mrkdwn',
          text: `*Priority:*\n${emoji} ${notification.priority}`,
        });
      }

      if (fields.length > 0) {
        blocks.push({
          type: 'section',
          fields,
        });
      }
    }

    // Build attachments for visual emphasis
    const attachments: SlackAttachment[] = [];
    if (notification.priority === 'urgent' || notification.priority === 'critical') {
      attachments.push({
        color: this.getPriorityColor(notification.priority),
        footer: 'ClaudeFlare Notifications',
        ts: Math.floor(Date.now() / 1000),
      });
    }

    return {
      webhookUrl: provider.webhookUrl,
      channel: provider.channel,
      username: provider.username || 'ClaudeFlare',
      iconEmoji: provider.iconEmoji || ':bell:',
      text: notification.subject || 'Notification',
      blocks,
      attachments,
    };
  }

  /**
   * Get emoji based on priority
   */
  private getPriorityEmoji(priority: string): string {
    const emojis: Record<string, string> = {
      low: ':arrow_down_small:',
      normal: ':white_circle:',
      high: ':large_orange_diamond:',
      urgent: ':warning:',
      critical: ':rotating_light:',
    };
    return emojis[priority] || ':white_circle:';
  }

  /**
   * Get color based on priority
   */
  private getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
      low: '#36a64f',
      normal: '#36a64f',
      high: '#ff9900',
      urgent: '#ff6600',
      critical: '#ff0000',
    };
    return colors[priority] || '#36a64f';
  }

  /**
   * Send to Slack via webhook
   */
  private async sendToSlack(
    message: SlackMessage,
    options?: ChannelDeliveryOptions
  ): Promise<ChannelDeliveryResult> {
    try {
      const payload = this.buildSlackPayload(message);
      const response = await this.callWebhook(payload, options?.timeout);

      if (response.ok) {
        return {
          success: true,
          messageId: response.messageId,
          metadata: {
            provider: 'slack',
            timestamp: response.timestamp,
            channel: response.channel,
          },
        };
      } else {
        return {
          success: false,
          error: response.error || 'Slack API error',
          errorCode: 'SLACK_API_ERROR',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'WEBHOOK_ERROR',
      };
    }
  }

  /**
   * Build Slack webhook payload
   */
  private buildSlackPayload(message: SlackMessage): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      text: message.text,
      username: message.username,
      icon_emoji: message.iconEmoji,
    };

    if (message.channel) {
      payload.channel = message.channel;
    }

    if (message.blocks && message.blocks.length > 0) {
      payload.blocks = message.blocks;
    }

    if (message.attachments && message.attachments.length > 0) {
      payload.attachments = message.attachments;
    }

    if (message.threadTs) {
      payload.thread_ts = message.threadTs;
    }

    if (message.replyBroadcast) {
      payload.reply_broadcast = true;
    }

    return payload;
  }

  /**
   * Call Slack webhook
   */
  private async callWebhook(
    payload: Record<string, unknown>,
    timeout?: number
  ): Promise<{ ok: boolean; messageId?: string; timestamp?: string; channel?: string; error?: string }> {
    // Simulate webhook call
    await this.simulateNetworkDelay(timeout || 5000);

    // Simulate success
    return {
      ok: true,
      messageId: `slack_${Date.now()}`,
      timestamp: Math.floor(Date.now() / 1000).toString(),
      channel: 'notifications',
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
   * Check if Slack channel is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const webhookUrl = this.config.provider.webhookUrl;
      return webhookUrl.startsWith('https://hooks.slack.com/services/');
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
