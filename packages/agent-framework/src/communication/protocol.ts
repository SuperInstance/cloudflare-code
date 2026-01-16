/**
 * Agent Communication Protocol
 *
 * Provides message passing, pub/sub, streaming,
 * and various communication patterns for agents.
 */

import type {
  AgentId,
  MessageId
} from '../types';
import {
  Message,
  MessageType,
  MessagePriority,
  DeliveryGuarantee,
  RoutingStrategy,
  DeliveryStatus,
  Subscription,
  Topic,
  MessageFilter,
  MessageStats,
  MessageAck,
  QueuedMessage,
  MessagePayload,
  JsonPayload
} from '../types';
import { createLogger } from '../utils/logger';
import { generateId } from '../utils/helpers';
import { EventEmitter } from 'eventemitter3';

/**
 * Message broker configuration
 */
export interface MessageBrokerConfig {
  maxQueueSize: number;
  maxMessageSize: number;
  defaultTimeout: number;
  enableCompression: boolean;
  enableEncryption: boolean;
  enablePersistence: boolean;
  maxRetries: number;
  retryDelay: number;
}

/**
 * Message broker events
 */
export interface MessageBrokerEvents {
  'message:sent': (message: Message) => void;
  'message:received': (message: Message) => void;
  'message:delivered': (receipt: MessageAck) => void;
  'message:failed': (messageId: MessageId, error: Error) => void;
  'message:expired': (messageId: MessageId) => void;
  'subscription:created': (subscription: Subscription) => void;
  'subscription:removed': (subscriptionId: string) => void;
}

/**
 * Message broker class
 */
export class MessageBroker extends EventEmitter<MessageBrokerEvents> {
  private config: MessageBrokerConfig;
  private logger = createLogger('MessageBroker');
  private messageQueue: Map<AgentId, QueuedMessage[]>;
  private subscriptions: Map<AgentId, Map<string, Subscription>>; // agentId -> (topic -> subscription)
  private topics: Map<string, Topic>;
  private deliveryStatus: Map<MessageId, DeliveryStatus>;
  private messageStats: MessageStats;
  private retryTimers: Map<MessageId, NodeJS.Timeout>;

  constructor(config: Partial<MessageBrokerConfig> = {}) {
    super();

    this.config = {
      maxQueueSize: 1000,
      maxMessageSize: 1024 * 1024, // 1MB
      defaultTimeout: 5000,
      enableCompression: false,
      enableEncryption: false,
      enablePersistence: false,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };

    this.messageQueue = new Map();
    this.subscriptions = new Map();
    this.topics = new Map();
    this.deliveryStatus = new Map();
    this.messageStats = this.initializeStats();
    this.retryTimers = new Map();
  }

  /**
   * Initialize message statistics
   */
  private initializeStats(): MessageStats {
    return {
      totalSent: 0,
      totalReceived: 0,
      totalDelivered: 0,
      totalFailed: 0,
      averageLatency: 0,
      messagesByType: {} as Record<MessageType, number>,
      messagesByPriority: {},
      deliveryRate: 1,
      errorRate: 0
    };
  }

  /**
   * Send a message
   */
  async send(message: Message): Promise<void> {
    this.logger.debug('Sending message', {
      messageId: message.id,
      type: message.type,
      from: message.from,
      to: message.to
    });

    // Validate message
    this.validateMessage(message);

    // Set delivery status to pending
    this.deliveryStatus.set(message.id, DeliveryStatus.PENDING);

    try {
      // Route message based on strategy
      await this.routeMessage(message);

      // Update stats
      this.messageStats.totalSent++;
      this.messageStats.messagesByType[message.type] =
        (this.messageStats.messagesByType[message.type] || 0) + 1;
      this.messageStats.messagesByPriority[MessagePriority[message.priority]] =
        (this.messageStats.messagesByPriority[MessagePriority[message.priority]] || 0) + 1;

      this.emit('message:sent', message);

      this.logger.debug('Message sent successfully', { messageId: message.id });
    } catch (error) {
      this.handleDeliveryFailure(message.id, error as Error);
      throw error;
    }
  }

  /**
   * Route message based on strategy
   */
  private async routeMessage(message: Message): Promise<void> {
    switch (message.routingStrategy) {
      case RoutingStrategy.DIRECT:
        await this.routeDirect(message);
        break;

      case RoutingStrategy.BROADCAST:
        await this.routeBroadcast(message);
        break;

      case RoutingStrategy.MULTICAST:
        await this.routeMulticast(message);
        break;

      case RoutingStrategy.PUBLISH_SUBSCRIBE:
        await this.routePubSub(message);
        break;

      default:
        throw new Error(`Unknown routing strategy: ${message.routingStrategy}`);
    }
  }

  /**
   * Route message directly to recipient
   */
  private async routeDirect(message: Message): Promise<void> {
    const recipientId = message.to as AgentId;

    // Get or create message queue for recipient
    if (!this.messageQueue.has(recipientId)) {
      this.messageQueue.set(recipientId, []);
    }

    const queue = this.messageQueue.get(recipientId)!;

    // Check queue size limit
    if (queue.length >= this.config.maxQueueSize) {
      throw new Error(`Message queue for agent ${recipientId} is full`);
    }

    // Add message to queue
    const queuedMessage: QueuedMessage = {
      message,
      queuedAt: Date.now(),
      attempts: 0,
      nextAttemptAt: Date.now(),
      priority: message.priority
    };

    queue.push(queuedMessage);
    this.sortQueueByPriority(queue);

    // Mark as delivered
    this.deliveryStatus.set(message.id, DeliveryStatus.DELIVERED);

    // Emit received event
    this.emit('message:received', message);

    // Process delivery guarantees
    await this.processDeliveryGuarantee(message);
  }

  /**
   * Route message to all agents
   */
  private async routeBroadcast(message: Message): Promise<void> {
    // Get all registered agents (would need registry integration)
    const allAgents = Array.from(this.messageQueue.keys());

    for (const agentId of allAgents) {
      // Skip sender
      if (agentId === message.from) {
        continue;
      }

      // Create copy of message for each recipient
      const messageCopy = { ...message, to: agentId };
      await this.routeDirect(messageCopy);
    }
  }

  /**
   * Route message to multiple recipients
   */
  private async routeMulticast(message: Message): Promise<void> {
    const recipients = Array.isArray(message.to) ? message.to : [message.to];

    for (const recipientId of recipients) {
      const messageCopy = { ...message, to: recipientId };
      await this.routeDirect(messageCopy);
    }
  }

  /**
   * Route message to topic subscribers
   */
  private async routePubSub(message: Message): Promise<void> {
    const topicName = message.headers.routing?.topic;
    if (!topicName) {
      throw new Error('Topic name required for pub/sub routing');
    }

    const topic = this.topics.get(topicName);
    if (!topic) {
      throw new Error(`Topic ${topicName} not found`);
    }

    // Get subscribers
    const subscribers = Array.from(topic.subscribers.values());

    for (const subscription of subscribers) {
      // Apply subscription filter
      if (subscription.filter && !this.matchesFilter(message, subscription.filter)) {
        continue;
      }

      // Create copy of message for subscriber
      const messageCopy = { ...message, to: subscription.subscriberId };
      await this.routeDirect(messageCopy);
    }

    // Update topic message count
    topic.messageCount++;
    topic.lastMessageAt = Date.now();
  }

  /**
   * Process delivery guarantees
   */
  private async processDeliveryGuarantee(message: Message): Promise<void> {
    switch (message.deliveryGuarantee) {
      case DeliveryGuarantee.AT_MOST_ONCE:
        // Fire and forget
        break;

      case DeliveryGuarantee.AT_LEAST_ONCE:
        // Wait for acknowledgment or retry
        await this.waitForAck(message);
        break;

      case DeliveryGuarantee.EXACTLY_ONCE:
        // Deduplication and retry (would need persistence)
        await this.waitForAck(message);
        break;
    }
  }

  /**
   * Wait for message acknowledgment
   */
  private async waitForAck(message: Message): Promise<void> {
    const timeout = message.ttl || this.config.defaultTimeout;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.deliveryStatus.get(message.id) === DeliveryStatus.DELIVERED) {
          resolve();
        } else {
          this.handleDeliveryFailure(message.id, new Error('Message timeout'));
          reject(new Error('Message timeout'));
        }
      }, timeout);

      // Store timer for cleanup
      this.retryTimers.set(message.id, timer);
    });
  }

  /**
   * Handle delivery failure
   */
  private async handleDeliveryFailure(messageId: MessageId, error: Error): Promise<void> {
    this.logger.error('Message delivery failed', error, { messageId });

    this.deliveryStatus.set(messageId, DeliveryStatus.FAILED);
    this.messageStats.totalFailed++;
    this.updateErrorRate();

    this.emit('message:failed', messageId, error);

    // Clean up timer
    const timer = this.retryTimers.get(messageId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(messageId);
    }
  }

  /**
   * Receive message for an agent
   */
  async receive(agentId: AgentId): Promise<Message | null> {
    const queue = this.messageQueue.get(agentId);

    if (!queue || queue.length === 0) {
      return null;
    }

    // Get highest priority message
    const queuedMessage = queue.shift()!;
    const message = queuedMessage.message;

    // Mark as processed
    this.deliveryStatus.set(message.id, DeliveryStatus.PROCESSED);
    this.messageStats.totalDelivered++;

    // Update latency
    const latency = Date.now() - message.timestamp;
    this.updateLatency(latency);

    this.emit('message:delivered', {
      messageId: message.id,
      acknowledged: true,
      timestamp: Date.now(),
      agentId
    });

    return message;
  }

  /**
   * Acknowledge message
   */
  async acknowledge(ack: MessageAck): Promise<void> {
    this.logger.debug('Acknowledging message', {
      messageId: ack.messageId,
      agentId: ack.agentId
    });

    this.deliveryStatus.set(ack.messageId, DeliveryStatus.PROCESSED);
    this.emit('message:delivered', ack);

    // Clean up timer
    const timer = this.retryTimers.get(ack.messageId);
    if (timer) {
      clearTimeout(timer);
      this.retryTimers.delete(ack.messageId);
    }
  }

  /**
   * Subscribe to a topic
   */
  async subscribe(
    agentId: AgentId,
    topic: string,
    filter?: MessageFilter
  ): Promise<Subscription> {
    this.logger.debug('Agent subscribing to topic', { agentId, topic });

    // Get or create topic
    if (!this.topics.has(topic)) {
      this.topics.set(topic, {
        name: topic,
        subscribers: new Map(),
        messageCount: 0,
        createdAt: Date.now()
      });
    }

    const topicObj = this.topics.get(topic)!;

    // Get or create agent subscriptions
    if (!this.subscriptions.has(agentId)) {
      this.subscriptions.set(agentId, new Map());
    }

    const agentSubscriptions = this.subscriptions.get(agentId)!;

    // Create subscription
    const subscription: Subscription = {
      subscriptionId: generateId('sub'),
      subscriberId: agentId,
      topic,
      filter,
      createdAt: Date.now(),
      messageCount: 0,
      active: true
    };

    // Add to topic subscribers
    topicObj.subscribers.set(subscription.subscriptionId, subscription);

    // Add to agent subscriptions
    agentSubscriptions.set(topic, subscription);

    this.emit('subscription:created', subscription);

    return subscription;
  }

  /**
   * Unsubscribe from a topic
   */
  async unsubscribe(agentId: AgentId, topic: string): Promise<void> {
    this.logger.debug('Agent unsubscribing from topic', { agentId, topic });

    const agentSubscriptions = this.subscriptions.get(agentId);
    if (!agentSubscriptions) {
      return;
    }

    const subscription = agentSubscriptions.get(topic);
    if (!subscription) {
      return;
    }

    // Remove from topic
    const topicObj = this.topics.get(topic);
    if (topicObj) {
      topicObj.subscribers.delete(subscription.subscriptionId);
    }

    // Remove from agent subscriptions
    agentSubscriptions.delete(topic);

    this.emit('subscription:removed', subscription.subscriptionId);
  }

  /**
   * Publish message to topic
   */
  async publish(topic: string, payload: MessagePayload, from: AgentId): Promise<void> {
    const message: Message = {
      id: generateId('msg'),
      type: MessageType.NOTIFICATION,
      from,
      to: '*',
      payload,
      priority: MessagePriority.NORMAL,
      timestamp: Date.now(),
      deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE,
      routingStrategy: RoutingStrategy.PUBLISH_SUBSCRIBE,
      headers: {
        contentType: 'application/json',
        routing: { topic }
      },
      metadata: {}
    };

    await this.send(message);
  }

  /**
   * Request-response pattern
   */
  async request<T = unknown>(
    to: AgentId,
    from: AgentId,
    action: string,
    data: Record<string, unknown>,
    timeout: number = 5000
  ): Promise<T> {
    const correlationId = generateId('corr');

    const request: Message = {
      id: generateId('msg'),
      type: MessageType.REQUEST,
      from,
      to,
      payload: {
        type: 'json',
        data: { action, data }
      } as JsonPayload,
      priority: MessagePriority.NORMAL,
      timestamp: Date.now(),
      correlationId,
      deliveryGuarantee: DeliveryGuarantee.EXACTLY_ONCE,
      routingStrategy: RoutingStrategy.DIRECT,
      headers: {
        contentType: 'application/json'
      },
      metadata: {}
    };

    // Send request
    await this.send(request);

    // Wait for response
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, timeout);

      // Listen for response (would need proper event handling)
      const responseHandler = (message: Message) => {
        if (message.correlationId === correlationId) {
          clearTimeout(timer);
          if (message.type === MessageType.RESPONSE) {
            resolve((message.payload as JsonPayload).data as T);
          } else if (message.type === MessageType.ERROR) {
            reject(new Error((message.payload as JsonPayload).data as unknown as string));
          }
        }
      };

      this.on('message:received', responseHandler);
    });
  }

  /**
   * Validate message
   */
  private validateMessage(message: Message): void {
    if (!message.id) {
      throw new Error('Message ID is required');
    }

    if (!message.from) {
      throw new Error('Message sender is required');
    }

    if (!message.to) {
      throw new Error('Message recipient is required');
    }

    if (!message.payload) {
      throw new Error('Message payload is required');
    }

    // Check message size
    const size = JSON.stringify(message).length;
    if (size > this.config.maxMessageSize) {
      throw new Error(`Message size (${size}) exceeds maximum (${this.config.maxMessageSize})`);
    }
  }

  /**
   * Check if message matches filter
   */
  private matchesFilter(message: Message, filter: MessageFilter): boolean {
    if (filter.types && !filter.types.includes(message.type)) {
      return false;
    }

    if (filter.priorities && !filter.priorities.includes(message.priority)) {
      return false;
    }

    if (filter.fromAgents && !filter.fromAgents.includes(message.from)) {
      return false;
    }

    if (filter.headers) {
      for (const [key, value] of Object.entries(filter.headers)) {
        if ((message.headers as unknown as Record<string, unknown>)[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Sort queue by priority
   */
  private sortQueueByPriority(queue: QueuedMessage[]): void {
    queue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Update latency statistics
   */
  private updateLatency(latency: number): void {
    const total = this.messageStats.totalDelivered;
    this.messageStats.averageLatency =
      (this.messageStats.averageLatency * (total - 1) + latency) / total;
  }

  /**
   * Update error rate
   */
  private updateErrorRate(): void {
    const total = this.messageStats.totalSent;
    this.messageStats.errorRate = this.messageStats.totalFailed / total;
    this.messageStats.deliveryRate = 1 - this.messageStats.errorRate;
  }

  /**
   * Get message statistics
   */
  getStats(): MessageStats {
    return { ...this.messageStats };
  }

  /**
   * Get message queue status
   */
  getQueueStatus(agentId: AgentId): { size: number; messages: QueuedMessage[] } | undefined {
    const queue = this.messageQueue.get(agentId);
    if (!queue) {
      return undefined;
    }

    return {
      size: queue.length,
      messages: [...queue]
    };
  }

  /**
   * Get all topics
   */
  getTopics(): Topic[] {
    return Array.from(this.topics.values());
  }

  /**
   * Get subscriptions for an agent
   */
  getSubscriptions(agentId: AgentId): Subscription[] {
    const agentSubscriptions = this.subscriptions.get(agentId);
    if (!agentSubscriptions) {
      return [];
    }

    return Array.from(agentSubscriptions.values());
  }

  /**
   * Clear message queue for an agent
   */
  clearQueue(agentId: AgentId): void {
    this.messageQueue.delete(agentId);
  }

  /**
   * Shutdown message broker
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down message broker');

    // Clear all retry timers
    const timers = Array.from(this.retryTimers.values());
    for (const timer of timers) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();

    // Clear all data
    this.messageQueue.clear();
    this.subscriptions.clear();
    this.topics.clear();
    this.deliveryStatus.clear();

    this.removeAllListeners();
  }
}
