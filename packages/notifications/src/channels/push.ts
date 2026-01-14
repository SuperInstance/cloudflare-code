/**
 * Push notification channel
 * Supports FCM (Firebase Cloud Messaging) and APNs (Apple Push Notification Service)
 */

import type {
  Notification,
  NotificationRecipient,
  PushProvider,
  ChannelDeliveryResult,
  ChannelStats,
} from '../types';
import { BaseChannel, ChannelDeliveryOptions } from './base';

export interface PushChannelConfig {
  provider: PushProvider;
  maxRetries?: number;
  timeout?: number;
  priority?: 'high' | 'normal';
  ttl?: number;
}

export interface PushMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: string;
  badge?: number;
  icon?: string;
  image?: string;
  clickAction?: string;
  priority?: 'high' | 'normal';
  ttl?: number;
  collapseKey?: string;
}

export interface PushDevice {
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  active: boolean;
  createdAt: Date;
  lastUsedAt: Date;
}

/**
 * Push notification channel implementation
 */
export class PushChannel extends BaseChannel {
  private config: PushChannelConfig;
  private stats: ChannelStats = {
    totalSent: 0,
    totalDelivered: 0,
    totalFailed: 0,
    averageDeliveryTime: 0,
  };
  private deliveryTimes: number[] = [];

  constructor(config: PushChannelConfig) {
    super('push', config.provider);
    this.config = config;
  }

  /**
   * Validate push notification token
   */
  async validateRecipient(recipient: NotificationRecipient): Promise<boolean> {
    // Basic validation for push tokens
    // FCM tokens are typically long strings
    // APNs tokens are hex strings
    const token = recipient.address.trim();

    // FCM token format
    const fcmRegex = /^[a-zA-Z0-9_-]{100,200}$/;

    // APNs token format (hex string with optional spaces or colons)
    const apnsRegex = /^([0-9a-fA-F]{2}[:\s]?){31}[0-9a-fA-F]{2}$/;

    return fcmRegex.test(token) || apnsRegex.test(token.replace(/[:\s]/g, ''));
  }

  /**
   * Send push notification
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
        throw new Error(`Invalid push token: ${recipient.address.substring(0, 20)}...`);
      }

      const message = this.buildMessage(notification, recipient);
      const platform = this.detectPlatform(recipient.address);
      const result = await this.sendPush(message, platform, options);

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
          platform,
          priority: this.config.priority || 'normal',
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
   * Build push message from notification
   */
  private buildMessage(
    notification: Notification,
    recipient: NotificationRecipient
  ): PushMessage {
    const data: Record<string, string> = {
      notificationId: notification.id,
      category: notification.category,
      priority: notification.priority,
    };

    if (notification.metadata?.correlationId) {
      data.correlationId = notification.metadata.correlationId;
    }

    if (notification.data) {
      Object.entries(notification.data).forEach(([key, value]) => {
        data[key] = String(value);
      });
    }

    return {
      token: recipient.address,
      title: notification.subject || 'Notification',
      body: notification.content,
      data,
      sound: 'default',
      priority: this.config.priority || 'normal',
      ttl: this.config.ttl || 2419200, // 28 days in seconds
    };
  }

  /**
   * Detect platform from token format
   */
  private detectPlatform(token: string): 'ios' | 'android' | 'web' {
    const cleaned = token.replace(/[:\s]/g, '');

    // APNs tokens are 64 bytes (128 hex characters)
    if (/^[0-9a-fA-F]{128}$/.test(cleaned)) {
      return 'ios';
    }

    // FCM tokens are longer and contain mixed case
    if (/[a-z]/.test(cleaned)) {
      return 'android';
    }

    return 'web';
  }

  /**
   * Send push notification using the appropriate provider
   */
  private async sendPush(
    message: PushMessage,
    platform: string,
    options?: ChannelDeliveryOptions
  ): Promise<ChannelDeliveryResult> {
    const provider = this.config.provider;

    if (platform === 'ios' || provider.type === 'apns') {
      return this.sendViaAPNs(message, options);
    } else if (platform === 'android' || provider.type === 'fcm') {
      return this.sendViaFCM(message, options);
    } else {
      return {
        success: false,
        error: `Unsupported platform: ${platform}`,
        errorCode: 'UNSUPPORTED_PLATFORM',
      };
    }
  }

  /**
   * Send via FCM (Firebase Cloud Messaging)
   */
  private async sendViaFCM(
    message: PushMessage,
    options?: ChannelDeliveryOptions
  ): Promise<ChannelDeliveryResult> {
    const provider = this.config.provider;

    if (provider.type === 'fcm' && !provider.config.apiKey) {
      return {
        success: false,
        error: 'FCM credentials not configured',
        errorCode: 'MISSING_CREDENTIALS',
      };
    }

    // Simulate API call
    await this.simulateNetworkDelay(options?.timeout || 10000);

    return {
      success: true,
      messageId: `fcm_${Date.now()}`,
      metadata: {
        provider: 'fcm',
        token: message.token.substring(0, 20) + '...',
      },
    };
  }

  /**
   * Send via APNs (Apple Push Notification Service)
   */
  private async sendViaAPNs(
    message: PushMessage,
    options?: ChannelDeliveryOptions
  ): Promise<ChannelDeliveryResult> {
    const provider = this.config.provider;

    if (provider.type === 'apns' && (!provider.config.certificate || !provider.config.keyId)) {
      return {
        success: false,
        error: 'APNs credentials not configured',
        errorCode: 'MISSING_CREDENTIALS',
      };
    }

    // Simulate API call
    await this.simulateNetworkDelay(options?.timeout || 10000);

    return {
      success: true,
      messageId: `apns_${Date.now()}`,
      metadata: {
        provider: 'apns',
        token: message.token.substring(0, 20) + '...',
      },
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
   * Check if push channel is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const provider = this.config.provider;

      switch (provider.type) {
        case 'fcm':
          return !!(
            provider.config.apiKey ||
            (provider.config.projectId && provider.config.privateKey)
          );
        case 'apns':
          return !!(
            provider.config.certificate ||
            (provider.config.keyId && provider.config.teamId)
          );
        case 'onesignal':
          return !!provider.config.apiKey;
        case 'airship':
          return !!provider.config.apiKey;
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
