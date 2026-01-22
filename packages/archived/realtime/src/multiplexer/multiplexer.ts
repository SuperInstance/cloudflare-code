// @ts-nocheck
/**
 * Multiplexer - Advanced channel multiplexing system
 * Handles message routing to channels with subscription management
 */

import { MultiplexEvent, ChannelMessage, ChannelInfo, ChannelSubscription } from '../types';
import {
  IdGenerator,
  LRUCache,
  PerformanceTimer,
  BackpressureManager,
  EventBus,
  MessageValidator
} from '../utils';
import { Logger } from '@claudeflare/logger';

export interface MultiplexerConfig {
  maxChannels: number;
  maxSubscribers: number;
  channelTtl: number;
  enableHistory: boolean;
  historySize: number;
  messageOrdering: boolean;
  enableCompression: boolean;
  enableMetrics: boolean;
}

export interface ChannelOptions {
  persistent?: boolean;
  private?: boolean;
  encrypted?: boolean;
  metadata?: Record<string, any>;
  autoDelete?: boolean;
  ttl?: number;
}

export class Multiplexer {
  private config: MultiplexerConfig;
  private channels = new Map<string, ChannelInfo>();
  private subscriptions = new Map<string, Map<string, ChannelSubscription>>();
  private messageHistory = new Map<string, ChannelMessage[]>();
  private eventBus: EventBus;
  private backpressureManager: BackpressureManager;
  private logger: Logger;
  private metrics: {
    totalChannels: number;
    activeChannels: number;
    totalSubscriptions: number;
    totalMessages: number;
    averageSubscribers: number;
  };

  constructor(config: Partial<MultiplexerConfig> = {}, logger?: Logger) {
    this.config = {
      maxChannels: 10000,
      maxSubscribers: 10000,
      channelTtl: 3600000, // 1 hour
      enableHistory: true,
      historySize: 1000,
      messageOrdering: true,
      enableCompression: true,
      enableMetrics: true,
      ...config
    };

    this.logger = logger || new Logger('Multiplexer');
    this.eventBus = new EventBus();
    this.backpressureManager = new BackpressureManager(100);
    this.metrics = {
      totalChannels: 0,
      activeChannels: 0,
      totalSubscriptions: 0,
      totalMessages: 0,
      averageSubscribers: 0
    };

    // Start cleanup timer
    this.startCleanup();
  }

  /**
   * Create a new channel
   */
  public async createChannel(
    channelName: string,
    options: ChannelOptions = {}
  ): Promise<ChannelInfo> {
    try {
      if (this.channels.size >= this.config.maxChannels) {
        throw new Error(`Channel limit exceeded: ${this.config.maxChannels} max`);
      }

      if (this.channels.has(channelName)) {
        throw new Error(`Channel already exists: ${channelName}`);
      }

      const channelInfo: ChannelInfo = {
        name: channelName,
        subscribers: new Set(),
        metadata: options.metadata || {},
        createdAt: Date.now(),
        messageCount: 0
      };

      this.channels.set(channelName, channelInfo);

      // Initialize subscriptions map
      this.subscriptions.set(channelName, new Map());

      // Initialize message history if enabled
      if (this.config.enableHistory) {
        this.messageHistory.set(channelName, []);
      }

      this.metrics.totalChannels++;
      this.metrics.activeChannels++;

      this.logger.info('Channel created', {
        channelName,
        options
      });

      this.eventBus.emit('channel:create', {
        type: 'create',
        channel: channelName,
        timestamp: Date.now(),
        data: options
      });

      return channelInfo;

    } catch (error) {
      this.logger.error('Failed to create channel', error, { channelName });
      throw error;
    }
  }

  /**
   * Delete a channel
   */
  public async deleteChannel(channelName: string): Promise<void> {
    try {
      const channel = this.channels.get(channelName);
      if (!channel) {
        throw new Error(`Channel not found: ${channelName}`);
      }

      // Unsubscribe all users
      const subscriptions = this.subscriptions.get(channelName);
      if (subscriptions) {
        for (const userId of subscriptions.keys()) {
          await this.unsubscribe(channelName, userId);
        }
      }

      // Clean up data
      this.channels.delete(channelName);
      this.subscriptions.delete(channelName);
      this.messageHistory.delete(channelName);

      this.metrics.activeChannels--;

      this.logger.info('Channel deleted', { channelName });

      this.eventBus.emit('channel:delete', {
        type: 'delete',
        channel: channelName,
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('Failed to delete channel', error, { channelName });
      throw error;
    }
  }

  /**
   * Subscribe a user to a channel
   */
  public async subscribe(
    channelName: string,
    userId: string,
    metadata: Record<string, any> = {}
  ): Promise<ChannelSubscription> {
    try {
      await PerformanceTimer.measure('multiplexer-subscribe', async () => {
        // Get or create channel
        let channel = this.channels.get(channelName);
        if (!channel) {
          channel = await this.createChannel(channelName);
        }

        // Check subscriber limit
        const subscriptions = this.subscriptions.get(channelName)!;
        if (subscriptions.size >= this.config.maxSubscribers) {
          throw new Error(`Subscriber limit exceeded: ${this.config.maxSubscribers} max`);
        }

        // Check if already subscribed
        if (subscriptions.has(userId)) {
          throw new Error(`User already subscribed: ${userId}`);
        }

        const subscription: ChannelSubscription = {
          channel: channelName,
          userId,
          subscribedAt: Date.now(),
          metadata
        };

        // Add subscription
        subscriptions.set(userId, subscription);
        channel.subscribers.add(userId);

        this.metrics.totalSubscriptions++;
        this.updateAverageSubscribers();

        this.logger.info('User subscribed to channel', {
          channelName,
          userId
        });

        this.eventBus.emit('subscribe', {
          type: 'subscribe',
          channel: channelName,
          userId,
          timestamp: Date.now(),
          data: metadata
        });

        // Send recent history if enabled
        if (this.config.enableHistory) {
          await this.sendHistory(channelName, userId);
        }

        return subscription;
      });

    } catch (error) {
      this.logger.error('Failed to subscribe user', error, { channelName, userId });
      throw error;
    }
  }

  /**
   * Unsubscribe a user from a channel
   */
  public async unsubscribe(channelName: string, userId: string): Promise<void> {
    try {
      await PerformanceTimer.measure('multiplexer-unsubscribe', async () => {
        const subscriptions = this.subscriptions.get(channelName);
        if (!subscriptions) {
          throw new Error(`Channel not found: ${channelName}`);
        }

        const subscription = subscriptions.get(userId);
        if (!subscription) {
          throw new Error(`User not subscribed: ${userId}`);
        }

        // Remove subscription
        subscriptions.delete(userId);
        const channel = this.channels.get(channelName)!;
        channel.subscribers.delete(userId);

        this.metrics.totalSubscriptions--;
        this.updateAverageSubscribers();

        this.logger.info('User unsubscribed from channel', {
          channelName,
          userId
        });

        this.eventBus.emit('unsubscribe', {
          type: 'unsubscribe',
          channel: channelName,
          userId,
          timestamp: Date.now()
        });

        // Auto-delete channel if no subscribers
        if (channel.subscribers.size === 0 && !channel.metadata.persistent) {
          await this.deleteChannel(channelName);
        }
      });

    } catch (error) {
      this.logger.error('Failed to unsubscribe user', error, { channelName, userId });
      throw error;
    }
  }

  /**
   * Publish a message to a channel
   */
  public async publish(
    channelName: string,
    message: any,
    sourceConnectionId: string,
    isBroadcast: boolean = false
  ): Promise<void> {
    try {
      await PerformanceTimer.measure('multiplexer-publish', async () => {
        const channel = this.channels.get(channelName);
        if (!channel) {
          throw new Error(`Channel not found: ${channelName}`);
        }

        // Validate message
        if (!MessageValidator.isValidMessage(message)) {
          throw new Error('Invalid message format');
        }

        // Create channel message
        const channelMessage: ChannelMessage = {
          id: IdGenerator.generateMessageId(),
          type: message.type || 'message',
          payload: message.payload || message,
          timestamp: Date.now(),
          source: {
            id: sourceConnectionId,
            namespace: channelName
          },
          channel: channelName,
          isBroadcast,
          metadata: message.metadata
        };

        // Add to history
        if (this.config.enableHistory) {
          const history = this.messageHistory.get(channelName)!;
          history.push(channelMessage);

          // Trim history to size limit
          if (history.length > this.config.historySize) {
            history.shift();
          }
        }

        // Update metrics
        channel.messageCount++;
        this.metrics.totalMessages++;

        this.logger.debug('Message published to channel', {
          channelName,
          messageId: channelMessage.id,
          subscriberCount: channel.subscribers.size
        });

        // Publish to all subscribers
        await this.publishToSubscribers(channel, channelMessage);
      });

    } catch (error) {
      this.logger.error('Failed to publish message', error, { channelName });
      throw error;
    }
  }

  /**
   * Publish message to all subscribers
   */
  private async publishToSubscribers(channel: ChannelInfo, message: ChannelMessage): Promise<void> {
    const subscriptions = this.subscriptions.get(channel.name)!;

    // Create array of promises for concurrent publishing
    const publishPromises = Array.from(channel.subscribers).map(async (userId) => {
      const subscription = subscriptions.get(userId)!;
      await this.publishToUser(subscription, message);
    });

    // Wait for all publishes to complete
    await Promise.all(publishPromises);
  }

  /**
   * Publish message to specific user
   */
  private async publishToUser(subscription: ChannelSubscription, message: ChannelMessage): Promise<void> {
    try {
      // In a real implementation, this would send the message to the user's WebSocket connection
      // For now, we'll emit an event that can be handled by the WebSocket manager

      this.eventBus.emit('message', {
        type: 'message',
        channel: subscription.channel,
        userId: subscription.userId,
        message: message,
        timestamp: Date.now()
      });

    } catch (error) {
      this.logger.error('Failed to publish to user', error, {
        userId: subscription.userId,
        channel: subscription.channel
      });
    }
  }

  /**
   * Send message history to user
   */
  private async sendHistory(channelName: string, userId: string): Promise<void> {
    const history = this.messageHistory.get(channelName);
    if (!history || history.length === 0) {
      return;
    }

    // Send history in batches to avoid overwhelming the connection
    const batchSize = 50;
    for (let i = 0; i < history.length; i += batchSize) {
      const batch = history.slice(i, i + batchSize);

      // Create history message
      const historyMessage = {
        type: 'history:batch',
        channel: channelName,
        messages: batch,
        timestamp: Date.now(),
        isHistory: true
      };

      // In a real implementation, this would send the history batch to the user's WebSocket
      this.eventBus.emit('history', {
        type: 'history',
        channel: channelName,
        userId,
        message: historyMessage,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Send unicast message to specific user
   */
  public async sendUnicast(
    channelName: string,
    targetUserId: string,
    message: any,
    sourceConnectionId: string
  ): Promise<void> {
    try {
      const subscriptions = this.subscriptions.get(channelName);
      if (!subscriptions) {
        throw new Error(`Channel not found: ${channelName}`);
      }

      if (!subscriptions.has(targetUserId)) {
        throw new Error(`User not subscribed to channel: ${targetUserId}`);
      }

      const unicastMessage: ChannelMessage = {
        id: IdGenerator.generateMessageId(),
        type: message.type || 'message',
        payload: message.payload || message,
        timestamp: Date.now(),
        source: {
          id: sourceConnectionId,
          namespace: channelName
        },
        channel: channelName,
        target: {
          id: targetUserId,
          namespace: channelName
        },
        metadata: message.metadata
      };

      // Add to history
      if (this.config.enableHistory) {
        const history = this.messageHistory.get(channelName)!;
        history.push(unicastMessage);

        // Trim history to size limit
        if (history.length > this.config.historySize) {
          history.shift();
        }
      }

      // Send to specific user
      const subscription = subscriptions.get(targetUserId)!;
      await this.publishToUser(subscription, unicastMessage);

      this.metrics.totalMessages++;

      this.logger.debug('Unicast message sent', {
        channelName,
        targetUserId,
        messageId: unicastMessage.id
      });

    } catch (error) {
      this.logger.error('Failed to send unicast message', error, {
        channelName,
        targetUserId
      });
      throw error;
    }
  }

  /**
   * Send multicast message to multiple users
   */
  public async sendMulticast(
    channelName: string,
    targetUserIds: string[],
    message: any,
    sourceConnectionId: string
  ): Promise<void> {
    try {
      const subscriptions = this.subscriptions.get(channelName);
      if (!subscriptions) {
        throw new Error(`Channel not found: ${channelName}`);
      }

      // Filter users who are actually subscribed
      const validTargets = targetUserIds.filter(userId => subscriptions.has(userId));
      if (validTargets.length === 0) {
        throw new Error('No valid targets found');
      }

      const multicastMessage: ChannelMessage = {
        id: IdGenerator.generateMessageId(),
        type: message.type || 'message',
        payload: message.payload || message,
        timestamp: Date.now(),
        source: {
          id: sourceConnectionId,
          namespace: channelName
        },
        channel: channelName,
        isBroadcast: false,
        metadata: {
          ...message.metadata,
          multicastTargets: validTargets
        }
      };

      // Add to history
      if (this.config.enableHistory) {
        const history = this.messageHistory.get(channelName)!;
        history.push(multicastMessage);

        // Trim history to size limit
        if (history.length > this.config.historySize) {
          history.shift();
        }
      }

      // Send to each target
      for (const userId of validTargets) {
        const subscription = subscriptions.get(userId)!;
        await this.publishToUser(subscription, multicastMessage);
      }

      this.metrics.totalMessages++;

      this.logger.debug('Multicast message sent', {
        channelName,
        targetCount: validTargets.length,
        messageId: multicastMessage.id
      });

    } catch (error) {
      this.logger.error('Failed to send multicast message', error, {
        channelName,
        targetCount: targetUserIds.length
      });
      throw error;
    }
  }

  /**
   * Get channel information
   */
  public getChannel(channelName: string): ChannelInfo | undefined {
    return this.channels.get(channelName);
  }

  /**
   * Get all channels
   */
  public getAllChannels(): ChannelInfo[] {
    return Array.from(this.channels.values());
  }

  /**
   * Get user subscriptions
   */
  public getUserSubscriptions(userId: string): ChannelSubscription[] {
    const subscriptions: ChannelSubscription[] = [];

    for (const [channelName, channelSubs] of this.subscriptions) {
      const subscription = channelSubs.get(userId);
      if (subscription) {
        subscriptions.push(subscription);
      }
    }

    return subscriptions;
  }

  /**
   * Get channel subscribers
   */
  public getChannelSubscribers(channelName: string): string[] {
    const channel = this.channels.get(channelName);
    if (!channel) {
      return [];
    }

    return Array.from(channel.subscribers);
  }

  /**
   * Get channel message history
   */
  public getChannelHistory(channelName: string, limit: number = 50): ChannelMessage[] {
    const history = this.messageHistory.get(channelName);
    if (!history) {
      return [];
    }

    return history.slice(-limit);
  }

  /**
   * Get multiplexer statistics
   */
  public getStats(): { [key: string]: any } {
    return {
      channels: {
        total: this.metrics.totalChannels,
        active: this.metrics.activeChannels,
        max: this.config.maxChannels
      },
      subscriptions: {
        total: this.metrics.totalSubscriptions,
        average: this.metrics.averageSubscribers,
        max: this.config.maxSubscribers
      },
      messages: {
        total: this.metrics.totalMessages,
        historyEnabled: this.config.enableHistory,
        historySize: this.config.historySize
      },
      config: this.config
    };
  }

  /**
   * Check if user is subscribed to channel
   */
  public isSubscribed(channelName: string, userId: string): boolean {
    const subscriptions = this.subscriptions.get(channelName);
    return subscriptions ? subscriptions.has(userId) : false;
  }

  /**
   * Get subscriber count for channel
   */
  public getSubscriberCount(channelName: string): number {
    const channel = this.channels.get(channelName);
    return channel ? channel.subscribers.size : 0;
  }

  /**
   * Update average subscribers count
   */
  private updateAverageSubscribers(): void {
    const totalSubscriptions = this.metrics.totalSubscriptions;
    const totalChannels = this.metrics.activeChannels;

    this.metrics.averageSubscribers = totalChannels > 0
      ? totalSubscriptions / totalChannels
      : 0;
  }

  /**
   * Start cleanup timer
   */
  private startCleanup(): void {
    setInterval(() => {
      this.cleanup();
    }, this.config.channelTtl);
  }

  /**
   * Cleanup expired channels and data
   */
  private cleanup(): void {
    const now = Date.now();
    const cleanupThreshold = now - this.config.channelTtl;

    for (const [channelName, channel] of this.channels) {
      // Check if channel should be auto-deleted
      if (channel.subscribers.size === 0 && !channel.metadata.persistent) {
        if (now - channel.createdAt > cleanupThreshold) {
          this.deleteChannel(channelName).catch(error => {
            this.logger.error('Cleanup failed to delete channel', error, { channelName });
          });
        }
      }

      // Cleanup old message history
      if (this.config.enableHistory) {
        const history = this.messageHistory.get(channelName);
        if (history) {
          // Remove messages older than TTL
          while (history.length > 0 && history[0].timestamp < cleanupThreshold) {
            history.shift();
          }
        }
      }
    }
  }

  /**
   * Listen for multiplex events
   */
  public on(event: string, handler: Function): void {
    this.eventBus.on(event, handler);
  }

  /**
   * Stop listening for multiplex events
   */
  public off(event: string, handler: Function): void {
    this.eventBus.off(event, handler);
  }

  /**
   * Reset multiplexer (clear all data)
   */
  public async reset(): Promise<void> {
    const channelsToDelete = Array.from(this.channels.keys());
    await Promise.all(channelsToDelete.map(channelName => this.deleteChannel(channelName)));

    this.metrics = {
      totalChannels: 0,
      activeChannels: 0,
      totalSubscriptions: 0,
      totalMessages: 0,
      averageSubscribers: 0
    };

    this.logger.info('Multiplexer reset');
  }

  /**
   * Cleanup resources
   */
  public async dispose(): Promise<void> {
    // Stop cleanup timer
    // In a real implementation, we would properly clear the interval

    // Reset data
    await this.reset();

    this.logger.info('Multiplexer disposed');
  }
}