// @ts-nocheck
/**
 * Channel registry and factory
 */

import type {
  NotificationChannelType,
  Notification,
  NotificationRecipient,
  ChannelDeliveryResult,
  ChannelStats,
} from '../types';
import { BaseChannel } from './base';
import { EmailChannel, EmailChannelConfig } from './email';
import { SmsChannel, SmsChannelConfig } from './sms';
import { PushChannel, PushChannelConfig } from './push';
import { SlackChannel, SlackChannelConfig } from './slack';
import { DiscordChannel, DiscordChannelConfig } from './discord';
import { WebhookChannel, WebhookChannelConfig } from './webhook';
import { InAppChannel, InAppChannelConfig } from './in-app';

export type ChannelConfig =
  | EmailChannelConfig
  | SmsChannelConfig
  | PushChannelConfig
  | SlackChannelConfig
  | DiscordChannelConfig
  | WebhookChannelConfig
  | InAppChannelConfig;

/**
 * Channel registry for managing all notification channels
 */
export class ChannelRegistry {
  private channels: Map<NotificationChannelType, BaseChannel> = new Map();

  /**
   * Register a channel
   */
  register(channelType: NotificationChannelType, channel: BaseChannel): void {
    this.channels.set(channelType, channel);
  }

  /**
   * Get a channel by type
   */
  get(channelType: NotificationChannelType): BaseChannel | undefined {
    return this.channels.get(channelType);
  }

  /**
   * Check if a channel is registered
   */
  has(channelType: NotificationChannelType): boolean {
    return this.channels.has(channelType);
  }

  /**
   * Get all registered channels
   */
  getAll(): BaseChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Get all registered channel types
   */
  getTypes(): NotificationChannelType[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Unregister a channel
   */
  unregister(channelType: NotificationChannelType): void {
    this.channels.delete(channelType);
  }

  /**
   * Clear all channels
   */
  clear(): void {
    this.channels.clear();
  }

  /**
   * Send a notification through a specific channel
   */
  async send(
    channelType: NotificationChannelType,
    notification: Notification,
    recipient: NotificationRecipient
  ): Promise<ChannelDeliveryResult> {
    const channel = this.get(channelType);

    if (!channel) {
      return {
        success: false,
        error: `Channel not registered: ${channelType}`,
        errorCode: 'CHANNEL_NOT_FOUND',
      };
    }

    return channel.send(notification, recipient);
  }

  /**
   * Send a notification through multiple channels
   */
  async sendMulti(
    channelTypes: NotificationChannelType[],
    notification: Notification,
    recipients: Map<NotificationChannelType, NotificationRecipient>
  ): Promise<Map<NotificationChannelType, ChannelDeliveryResult>> {
    const results = new Map<NotificationChannelType, ChannelDeliveryResult>();

    const promises = channelTypes.map(async (channelType) => {
      const recipient = recipients.get(channelType);
      if (!recipient) {
        results.set(channelType, {
          success: false,
          error: 'Recipient not found for channel',
          errorCode: 'RECIPIENT_NOT_FOUND',
        });
        return;
      }

      const result = await this.send(channelType, notification, recipient);
      results.set(channelType, result);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Check health of all channels
   */
  async healthCheck(): Promise<Map<NotificationChannelType, boolean>> {
    const results = new Map<NotificationChannelType, boolean>();

    const promises = Array.from(this.channels.entries()).map(
      async ([channelType, channel]) => {
        const healthy = await channel.healthCheck();
        results.set(channelType, healthy);
      }
    );

    await Promise.all(promises);
    return results;
  }

  /**
   * Get statistics from all channels
   */
  async getStats(): Promise<Map<NotificationChannelType, ChannelStats>> {
    const stats = new Map<NotificationChannelType, ChannelStats>();

    const promises = Array.from(this.channels.entries()).map(
      async ([channelType, channel]) => {
        const channelStats = await channel.getStats();
        stats.set(channelType, channelStats);
      }
    );

    await Promise.all(promises);
    return stats;
  }
}

/**
 * Channel factory for creating channel instances
 */
export class ChannelFactory {
  /**
   * Create a channel instance from configuration
   */
  static create(channelType: NotificationChannelType, config: ChannelConfig): BaseChannel {
    switch (channelType) {
      case 'email':
        return new EmailChannel(config as EmailChannelConfig);

      case 'sms':
        return new SmsChannel(config as SmsChannelConfig);

      case 'push':
        return new PushChannel(config as PushChannelConfig);

      case 'slack':
        return new SlackChannel(config as SlackChannelConfig);

      case 'discord':
        return new DiscordChannel(config as DiscordChannelConfig);

      case 'webhook':
        return new WebhookChannel(config as WebhookChannelConfig);

      case 'in_app':
        return new InAppChannel(config as InAppChannelConfig);

      default:
        throw new Error(`Unknown channel type: ${channelType}`);
    }
  }

  /**
   * Create multiple channels from configurations
   */
  static createMany(
    configs: Map<NotificationChannelType, ChannelConfig>
  ): Map<NotificationChannelType, BaseChannel> {
    const channels = new Map<NotificationChannelType, BaseChannel>();

    for (const [channelType, config] of configs.entries()) {
      try {
        const channel = this.create(channelType, config);
        channels.set(channelType, channel);
      } catch (error) {
        console.error(`Failed to create channel ${channelType}:`, error);
      }
    }

    return channels;
  }

  /**
   * Create a channel registry from configurations
   */
  static createRegistry(
    configs: Map<NotificationChannelType, ChannelConfig>
  ): ChannelRegistry {
    const registry = new ChannelRegistry();
    const channels = this.createMany(configs);

    for (const [channelType, channel] of channels.entries()) {
      registry.register(channelType, channel);
    }

    return registry;
  }
}
