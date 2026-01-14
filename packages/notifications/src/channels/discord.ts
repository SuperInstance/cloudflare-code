/**
 * Discord notification channel
 * Supports Discord webhooks
 */

import type {
  Notification,
  NotificationRecipient,
  DiscordProvider,
  ChannelDeliveryResult,
  ChannelStats,
} from '../types';
import { BaseChannel, ChannelDeliveryOptions } from './base';

export interface DiscordChannelConfig {
  provider: DiscordProvider;
  maxRetries?: number;
  timeout?: number;
}

export interface DiscordMessage {
  webhookUrl: string;
  username?: string;
  avatarUrl?: string;
  content?: string;
  embeds?: DiscordEmbed[];
  tts?: boolean;
  allowedMentions?: DiscordAllowedMentions;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  footer?: DiscordEmbedFooter;
  timestamp?: string;
  thumbnail?: DiscordEmbedMedia;
  image?: DiscordEmbedMedia;
  author?: DiscordEmbedAuthor;
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbedFooter {
  text: string;
  icon_url?: string;
}

export interface DiscordEmbedMedia {
  url: string;
  proxy_url?: string;
  height?: number;
  width?: number;
}

export interface DiscordEmbedAuthor {
  name: string;
  url?: string;
  icon_url?: string;
}

export interface DiscordAllowedMentions {
  parse?: ('users' | 'roles' 'everyone')[];
  users?: string[];
  roles?: string[];
}

/**
 * Discord notification channel implementation
 */
export class DiscordChannel extends BaseChannel {
  private config: DiscordChannelConfig;
  private stats: ChannelStats = {
    totalSent: 0,
    totalDelivered: 0,
    totalFailed: 0,
    averageDeliveryTime: 0,
  };
  private deliveryTimes: number[] = [];

  constructor(config: DiscordChannelConfig) {
    super('discord', config.provider);
    this.config = config;
  }

  /**
   * Validate Discord webhook URL
   */
  async validateRecipient(recipient: NotificationRecipient): Promise<boolean> {
    // Discord webhook URL format: https://discord.com/api/webhooks/1234567890/abcdefghijklmnopqrstuvwxyz
    const discordWebhookRegex = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/;
    return discordWebhookRegex.test(recipient.address);
  }

  /**
   * Send Discord notification
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
        throw new Error(`Invalid Discord webhook URL: ${recipient.address}`);
      }

      const message = this.buildMessage(notification);
      const result = await this.sendToDiscord(message, options);

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
   * Build Discord message from notification
   */
  private buildMessage(notification: Notification): DiscordMessage {
    const provider = this.config.provider;

    // Build embeds for rich content
    const embeds: DiscordEmbed[] = [
      {
        title: notification.subject || 'Notification',
        description: notification.content.substring(0, 4096), // Discord limit
        color: this.getPriorityColor(notification.priority),
        fields: this.buildEmbedFields(notification),
        footer: {
          text: 'ClaudeFlare Notifications',
        },
        timestamp: new Date().toISOString(),
      },
    ];

    // Add URL if available
    if (notification.data?.url) {
      embeds[0].url = String(notification.data.url);
    }

    return {
      webhookUrl: provider.webhookUrl,
      username: provider.username || 'ClaudeFlare',
      avatarUrl: provider.avatarUrl,
      content: '', // Content is in embeds
      embeds,
      allowedMentions: {
        parse: [],
      },
    };
  }

  /**
   * Build embed fields from notification data
   */
  private buildEmbedFields(notification: Notification): DiscordEmbedField[] {
    const fields: DiscordEmbedField[] = [];

    if (notification.metadata?.correlationId) {
      fields.push({
        name: 'Correlation ID',
        value: notification.metadata.correlationId,
        inline: true,
      });
    }

    if (notification.category) {
      fields.push({
        name: 'Category',
        value: notification.category,
        inline: true,
      });
    }

    if (notification.priority) {
      const emoji = this.getPriorityEmoji(notification.priority);
      fields.push({
        name: 'Priority',
        value: `${emoji} ${notification.priority}`,
        inline: true,
      });
    }

    if (notification.metadata?.source) {
      fields.push({
        name: 'Source',
        value: notification.metadata.source,
        inline: true,
      });
    }

    if (notification.metadata?.tags && notification.metadata.tags.length > 0) {
      fields.push({
        name: 'Tags',
        value: notification.metadata.tags.join(', '),
        inline: false,
      });
    }

    return fields;
  }

  /**
   * Get emoji based on priority
   */
  private getPriorityEmoji(priority: string): string {
    const emojis: Record<string, string> = {
      low: '🔽',
      normal: '⚪',
      high: '🟠',
      urgent: '⚠️',
      critical: '🚨',
    };
    return emojis[priority] || '⚪';
  }

  /**
   * Get color based on priority
   */
  private getPriorityColor(priority: string): number {
    const colors: Record<string, number> = {
      low: 0x36a64f, // Green
      normal: 0x36a64f, // Green
      high: 0xff9900, // Orange
      urgent: 0xff6600, // Dark Orange
      critical: 0xff0000, // Red
    };
    return colors[priority] || 0x36a64f;
  }

  /**
   * Send to Discord via webhook
   */
  private async sendToDiscord(
    message: DiscordMessage,
    options?: ChannelDeliveryOptions
  ): Promise<ChannelDeliveryResult> {
    try {
      const payload = this.buildDiscordPayload(message);
      const response = await this.callWebhook(payload, options?.timeout);

      if (response.ok) {
        return {
          success: true,
          messageId: response.messageId,
          metadata: {
            provider: 'discord',
            timestamp: response.timestamp,
          },
        };
      } else {
        return {
          success: false,
          error: response.error || 'Discord API error',
          errorCode: 'DISCORD_API_ERROR',
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
   * Build Discord webhook payload
   */
  private buildDiscordPayload(message: DiscordMessage): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    if (message.username) {
      payload.username = message.username;
    }

    if (message.avatarUrl) {
      payload.avatar_url = message.avatarUrl;
    }

    if (message.content) {
      payload.content = message.content;
    }

    if (message.embeds && message.embeds.length > 0) {
      payload.embeds = message.embeds;
    }

    if (message.tts) {
      payload.tts = true;
    }

    if (message.allowedMentions) {
      payload.allowed_mentions = message.allowedMentions;
    }

    return payload;
  }

  /**
   * Call Discord webhook
   */
  private async callWebhook(
    payload: Record<string, unknown>,
    timeout?: number
  ): Promise<{ ok: boolean; messageId?: string; timestamp?: string; error?: string }> {
    // Simulate webhook call
    await this.simulateNetworkDelay(timeout || 5000);

    // Simulate success
    return {
      ok: true,
      messageId: `discord_${Date.now()}`,
      timestamp: new Date().toISOString(),
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
   * Check if Discord channel is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const webhookUrl = this.config.provider.webhookUrl;
      return webhookUrl.startsWith('https://discord.com/api/webhooks/');
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
