// @ts-nocheck
/**
 * In-app notification channel
 * Stores notifications for retrieval within the application
 */

import type {
  Notification,
  NotificationRecipient,
  ChannelDeliveryResult,
  ChannelStats,
  NotificationStatus,
} from '../types';
import { BaseChannel, ChannelDeliveryOptions } from './base';

export interface InAppChannelConfig {
  storage: InAppStorage;
  maxNotifications?: number;
  retentionDays?: number;
}

export interface InAppStorage {
  save(notification: InAppNotification): Promise<void>;
  get(userId: string, limit?: number, offset?: number): Promise<InAppNotification[]>;
  markAsRead(userId: string, notificationId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  delete(userId: string, notificationId: string): Promise<void>;
  deleteOld(userId: string, olderThan: Date): Promise<void>;
  countUnread(userId: string): Promise<number>;
}

export interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  priority: string;
  category: string;
  data?: Record<string, unknown>;
  actionUrl?: string;
  actionLabel?: string;
  icon?: string;
  imageUrl?: string;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * In-app notification channel implementation
 */
export class InAppChannel extends BaseChannel {
  private config: InAppChannelConfig;
  private stats: ChannelStats = {
    totalSent: 0,
    totalDelivered: 0,
    totalFailed: 0,
    averageDeliveryTime: 0,
  };
  private deliveryTimes: number[] = [];

  constructor(config: InAppChannelConfig) {
    super('in_app', config.storage);
    this.config = config;
  }

  /**
   * Validate in-app notification recipient (user ID)
   */
  async validateRecipient(recipient: NotificationRecipient): Promise<boolean> {
    // For in-app notifications, the address is the user ID
    return recipient.address.length > 0;
  }

  /**
   * Send in-app notification
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
        throw new Error(`Invalid user ID: ${recipient.address}`);
      }

      const inAppNotification = this.buildInAppNotification(notification, recipient);
      await this.saveNotification(inAppNotification);

      const duration = Date.now() - startTime;
      this.updateStats(true, duration);

      return {
        success: true,
        messageId: inAppNotification.id,
        metadata: {
          duration,
          userId: recipient.address,
          type: inAppNotification.type,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateStats(false, duration);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'SAVE_FAILED',
        metadata: { duration },
      };
    }
  }

  /**
   * Build in-app notification from notification
   */
  private buildInAppNotification(
    notification: Notification,
    recipient: NotificationRecipient
  ): InAppNotification {
    const retentionDays = this.config.retentionDays || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + retentionDays);

    return {
      id: notification.id,
      userId: recipient.address,
      title: notification.subject || 'Notification',
      body: notification.content,
      type: notification.channel,
      priority: notification.priority,
      category: notification.category,
      data: notification.data,
      actionUrl: this.extractActionUrl(notification),
      actionLabel: this.extractActionLabel(notification),
      icon: this.extractIcon(notification),
      imageUrl: this.extractImageUrl(notification),
      read: false,
      createdAt: new Date(),
      expiresAt,
    };
  }

  /**
   * Extract action URL from notification data
   */
  private extractActionUrl(notification: Notification): string | undefined {
    if (typeof notification.data?.actionUrl === 'string') {
      return notification.data.actionUrl as string;
    }
    return undefined;
  }

  /**
   * Extract action label from notification data
   */
  private extractActionLabel(notification: Notification): string | undefined {
    if (typeof notification.data?.actionLabel === 'string') {
      return notification.data.actionLabel as string;
    }
    return undefined;
  }

  /**
   * Extract icon from notification data
   */
  private extractIcon(notification: Notification): string | undefined {
    if (typeof notification.data?.icon === 'string') {
      return notification.data.icon as string;
    }
    return this.getDefaultIcon(notification);
  }

  /**
   * Get default icon based on category
   */
  private getDefaultIcon(notification: Notification): string {
    const icons: Record<string, string> = {
      system: '🔧',
      security: '🔒',
      billing: '💳',
      deployment: '🚀',
      performance: '📊',
      alert: '🔔',
      social: '👥',
      marketing: '📣',
      workflow: '⚙️',
    };
    return icons[notification.category] || '📬';
  }

  /**
   * Extract image URL from notification data
   */
  private extractImageUrl(notification: Notification): string | undefined {
    if (typeof notification.data?.imageUrl === 'string') {
      return notification.data.imageUrl as string;
    }
    return undefined;
  }

  /**
   * Save notification to storage
   */
  private async saveNotification(inAppNotification: InAppNotification): Promise<void> {
    await this.config.storage.save(inAppNotification);

    // Clean up old notifications if needed
    const maxNotifications = this.config.maxNotifications;
    if (maxNotifications) {
      const notifications = await this.config.storage.get(
        inAppNotification.userId,
        maxNotifications + 1
      );

      if (notifications.length > maxNotifications) {
        // Delete oldest notifications
        const toDelete = notifications.slice(maxNotifications);
        for (const notification of toDelete) {
          await this.config.storage.delete(notification.userId, notification.id);
        }
      }
    }
  }

  /**
   * Get notifications for a user
   */
  async getUserNotifications(
    userId: string,
    limit?: number,
    offset?: number
  ): Promise<InAppNotification[]> {
    return this.config.storage.get(userId, limit, offset);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.config.storage.markAsRead(userId, notificationId);
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.config.storage.markAllAsRead(userId);
  }

  /**
   * Delete a notification
   */
  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    await this.config.storage.delete(userId, notificationId);
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.config.storage.countUnread(userId);
  }

  /**
   * Clean up old notifications
   */
  async cleanupOldNotifications(userId: string, olderThan: Date): Promise<void> {
    await this.config.storage.deleteOld(userId, olderThan);
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
   * Check if in-app channel is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to perform a simple operation
      await this.config.storage.countUnread('health-check');
      return true;
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
