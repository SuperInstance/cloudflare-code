/**
 * Pub/Sub broker implementation
 * Supports topic management, subscriptions, message routing, and fan-out
 */

import type {
  Topic,
  Subscription,
  SubscriptionFilter,
  SubscriptionPosition,
  PublishOptions,
  Subscriber,
  SubscriberConfig,
  StreamEvent
} from '../types/index.js';
import { generateTopicId, generateSubscriptionId } from '../utils/id-generator.js';
import { EventStream } from '../stream/event-stream.js';

// ============================================================================
// Pub/Sub Broker
// ============================================================================

export class PubSubBroker {
  private topics: Map<string, TopicData> = new Map();
  private subscriptions: Map<string, SubscriptionData> = new Map();
  private subscribers: Map<string, Subscriber> = new Map();
  private partitions: Map<string, Map<number, EventStream>> = new Map();

  // ========================================================================
  // Topic Management
  // ========================================================================

  /**
   * Create a new topic
   */
  createTopic(
    name: string,
    options: {
      partitions?: number;
      retention?: { duration?: number; maxSize?: number; maxEvents?: number };
    } = {}
  ): Topic {
    if (this.topics.has(name)) {
      throw new Error(`Topic ${name} already exists`);
    }

    const topic: Topic = {
      name,
      partitions: options.partitions ?? 1,
      retention: options.retention ?? {
        duration: 24 * 60 * 60 * 1000, // 24 hours
        maxSize: 1024 * 1024 * 1024, // 1GB
        maxEvents: 10000000,
      },
      subscriptions: [],
      createdAt: Date.now(),
    };

    this.topics.set(name, {
      topic,
      partitions: new Map(),
    });

    // Create partition streams
    for (let i = 0; i < topic.partitions; i++) {
      this.getOrCreatePartitionStream(name, i);
    }

    return topic;
  }

  /**
   * Get topic
   */
  getTopic(name: string): Topic | undefined {
    return this.topics.get(name)?.topic;
  }

  /**
   * List all topics
   */
  listTopics(): Topic[] {
    return Array.from(this.topics.values()).map(data => data.topic);
  }

  /**
   * Delete topic
   */
  deleteTopic(name: string): boolean {
    const topicData = this.topics.get(name);

    if (!topicData) {
      return false;
    }

    // Delete all subscriptions
    for (const subscriptionId of topicData.topic.subscriptions) {
      this.subscriptions.delete(subscriptionId);
    }

    // Delete partitions
    this.partitions.delete(name);

    return this.topics.delete(name);
  }

  /**
   * Get or create topic
   */
  private getOrCreateTopic(name: string): TopicData {
    let topicData = this.topics.get(name);

    if (!topicData) {
      this.createTopic(name);
      topicData = this.topics.get(name)!;
    }

    return topicData;
  }

  // ========================================================================
  // Partition Management
  // ========================================================================

  /**
   * Get partition stream
   */
  private getOrCreatePartitionStream(topicName: string, partition: number): EventStream {
    if (!this.partitions.has(topicName)) {
      this.partitions.set(topicName, new Map());
    }

    const topicPartitions = this.partitions.get(topicName)!;

    if (!topicPartitions.has(partition)) {
      topicPartitions.set(partition, new EventStream());
    }

    return topicPartitions.get(partition)!;
  }

  /**
   * Get partition for message
   */
  private getPartition(topicName: string, partitionKey?: string): number {
    const topic = this.topics.get(topicName)?.topic;

    if (!topic) {
      return 0;
    }

    if (!partitionKey) {
      // Round-robin
      return Math.floor(Math.random() * topic.partitions);
    }

    // Hash-based partitioning
    let hash = 0;
    for (let i = 0; i < partitionKey.length; i++) {
      hash = ((hash << 5) - hash) + partitionKey.charCodeAt(i);
      hash = hash & hash;
    }

    return Math.abs(hash) % topic.partitions;
  }

  // ========================================================================
  // Publishing
  // ========================================================================

  /**
   * Publish message to topic
   */
  async publish<T>(
    topicName: string,
    type: string,
    data: T,
    options: PublishOptions = {}
  ): Promise<string> {
    const topicData = this.getOrCreateTopic(topicName);
    const partition = this.getPartition(topicName, options.partitionKey);

    const stream = this.getOrCreatePartitionStream(topicName, partition);

    // Publish event with attributes
    const event = await stream.publish(type, data, {
      ...options.attributes,
      partitionKey: options.partitionKey,
      orderingKey: options.orderingKey,
    });

    // Deliver to subscriptions
    await this.deliverToSubscriptions(topicName, partition, event);

    return event.id;
  }

  /**
   * Publish multiple messages
   */
  async publishBatch<T>(
    topicName: string,
    messages: Array<{
      type: string;
      data: T;
      options?: PublishOptions;
    }>
  ): Promise<string[]> {
    const ids: string[] = [];

    for (const { type, data, options } of messages) {
      const id = await this.publish(topicName, type, data, options);
      ids.push(id);
    }

    return ids;
  }

  /**
   * Deliver event to subscriptions
   */
  private async deliverToSubscriptions(
    topicName: string,
    partition: number,
    event: StreamEvent
  ): Promise<void> {
    const topicData = this.topics.get(topicName);

    if (!topicData) {
      return;
    }

    const subscriptions = topicData.topic.subscriptions
      .map(id => this.subscriptions.get(id))
      .filter((s): s is SubscriptionData => s !== undefined);

    for (const subscriptionData of subscriptions) {
      // Check if subscription is interested in this partition
      if (subscriptionData.subscription.position?.partition !== undefined &&
          subscriptionData.subscription.position.partition !== partition) {
        continue;
      }

      // Apply filter
      if (subscriptionData.subscription.filter && !this.matchesFilter(event, subscriptionData.subscription.filter)) {
        continue;
      }

      // Deliver to subscriber
      await this.deliverToSubscriber(subscriptionData, event);
    }
  }

  /**
   * Check if event matches filter
   */
  private matchesFilter(event: StreamEvent, filter: SubscriptionFilter): boolean {
    // Check types
    if (filter.types && !filter.types.includes(event.type)) {
      return false;
    }

    // Check attributes
    if (filter.attributes) {
      for (const [key, value] of Object.entries(filter.attributes)) {
        if ((event.metadata as any)?.[key] !== value) {
          return false;
        }
      }
    }

    // Check expression (basic SQL-like filter)
    if (filter.expression) {
      try {
        // Very basic expression evaluation
        // In production, use a proper expression parser
        const metadata = event.metadata ?? {};
        const context = { event, metadata };
        // Simple property access: metadata.property = 'value'
        const matches = this.evaluateExpression(filter.expression, context);
        if (!matches) return false;
      } catch {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate filter expression (simplified)
   */
  private evaluateExpression(expression: string, context: Record<string, unknown>): boolean {
    // This is a simplified version
    // In production, use a proper expression evaluator like jexl or expr-eval
    try {
      const func = new Function('context', `with(context) { return ${expression} }`);
      return func(context) === true;
    } catch {
      return false;
    }
  }

  /**
   * Deliver event to subscriber
   */
  private async deliverToSubscriber(
    subscriptionData: SubscriptionData,
    event: StreamEvent
  ): Promise<void> {
    const subscriberId = subscriptionData.subscription.subscriberId;
    const subscriber = this.subscribers.get(subscriberId);

    if (!subscriber) {
      return;
    }

    // Update position
    if (subscriptionData.subscription.position) {
      subscriptionData.subscription.position.offset++;
    }

    // Add to delivery queue
    subscriptionData.deliveryQueue.push(event);

    // Process based on protocol
    if (subscriber.protocol === 'sse' || subscriber.protocol === 'websocket') {
      // Event will be picked up by connection handler
      subscriptionData.pendingEvents++;
    } else if (subscriber.protocol === 'http') {
      // Push to endpoint (in production, this would make HTTP request)
      // For now, just track it
      subscriptionData.pendingEvents++;
    }
  }

  // ========================================================================
  // Subscription Management
  // ========================================================================

  /**
   * Create subscription
   */
  createSubscription(
    topicName: string,
    subscriberId: string,
    options: {
      filter?: SubscriptionFilter;
      position?: {
        partition?: number;
        offset?: number;
      };
    } = {}
  ): Subscription {
    const topic = this.getTopic(topicName);

    if (!topic) {
      throw new Error(`Topic ${topicName} not found`);
    }

    const subscriptionId = generateSubscriptionId();

    const subscription: Subscription = {
      id: subscriptionId,
      topic: topicName,
      subscriberId,
      filter: options.filter,
      createdAt: Date.now(),
      position: options.position,
    };

    this.subscriptions.set(subscriptionId, {
      subscription,
      deliveryQueue: [],
      pendingEvents: 0,
    });

    // Add to topic
    topic.subscriptions.push(subscriptionId);

    return subscription;
  }

  /**
   * Get subscription
   */
  getSubscription(subscriptionId: string): Subscription | undefined {
    return this.subscriptions.get(subscriptionId)?.subscription;
  }

  /**
   * List subscriptions for topic
   */
  listSubscriptions(topicName?: string): Subscription[] {
    let subscriptions = Array.from(this.subscriptions.values()).map(s => s.subscription);

    if (topicName) {
      subscriptions = subscriptions.filter(s => s.topic === topicName);
    }

    return subscriptions;
  }

  /**
   * Delete subscription
   */
  deleteSubscription(subscriptionId: string): boolean {
    const subscriptionData = this.subscriptions.get(subscriptionId);

    if (!subscriptionData) {
      return false;
    }

    // Remove from topic
    const topicData = this.topics.get(subscriptionData.subscription.topic);
    if (topicData) {
      const index = topicData.topic.subscriptions.indexOf(subscriptionId);
      if (index >= 0) {
        topicData.topic.subscriptions.splice(index, 1);
      }
    }

    return this.subscriptions.delete(subscriptionId);
  }

  /**
   * Acknowledge message
   */
  async acknowledge(subscriptionId: string, eventId: string): Promise<boolean> {
    const subscriptionData = this.subscriptions.get(subscriptionId);

    if (!subscriptionData) {
      return false;
    }

    const index = subscriptionData.deliveryQueue.findIndex(e => e.id === eventId);

    if (index >= 0) {
      subscriptionData.deliveryQueue.splice(index, 1);
      subscriptionData.pendingEvents--;
      return true;
    }

    return false;
  }

  /**
   * Get pending messages for subscription
   */
  getPendingMessages(subscriptionId: string, limit?: number): StreamEvent[] {
    const subscriptionData = this.subscriptions.get(subscriptionId);

    if (!subscriptionData) {
      return [];
    }

    let events = [...subscriptionData.deliveryQueue];

    if (limit) {
      events = events.slice(0, limit);
    }

    return events;
  }

  // ========================================================================
  // Subscriber Management
  // ========================================================================

  /**
   * Register subscriber
   */
  registerSubscriber(
    subscriber: Omit<Subscriber, 'id'>
  ): Subscriber {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const fullSubscriber: Subscriber = {
      ...subscriber,
      id,
    };

    this.subscribers.set(id, fullSubscriber);

    return fullSubscriber;
  }

  /**
   * Get subscriber
   */
  getSubscriber(subscriberId: string): Subscriber | undefined {
    return this.subscribers.get(subscriberId);
  }

  /**
   * Unregister subscriber
   */
  unregisterSubscriber(subscriberId: string): boolean {
    // Delete all subscriptions for this subscriber
    for (const [subscriptionId, subscriptionData] of this.subscriptions) {
      if (subscriptionData.subscription.subscriberId === subscriberId) {
        this.deleteSubscription(subscriptionId);
      }
    }

    return this.subscribers.delete(subscriberId);
  }

  /**
   * List subscribers
   */
  listSubscribers(): Subscriber[] {
    return Array.from(this.subscribers.values());
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  /**
   * Get broker statistics
   */
  getStats(): PubSubStats {
    const topicStats = new Map<string, TopicStats>();

    for (const [name, topicData] of this.topics) {
      const subscriptions = topicData.topic.subscriptions;
      const subscriptionCount = subscriptions.length;
      let messageCount = 0;

      for (const partition of topicData.partitions.values()) {
        messageCount += partition.getStats().eventCount;
      }

      topicStats.set(name, {
        subscriptionCount,
        messageCount,
        partitionCount: topicData.topic.partitions,
      });
    }

    return {
      topicCount: this.topics.size,
      subscriptionCount: this.subscriptions.size,
      subscriberCount: this.subscribers.size,
      topicStats,
    };
  }

  /**
   * Get topic statistics
   */
  getTopicStats(topicName: string): TopicStats | undefined {
    const stats = this.getStats().topicStats.get(topicName);
    return stats;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.topics.clear();
    this.subscriptions.clear();
    this.subscribers.clear();
    this.partitions.clear();
  }
}

// ============================================================================
// Types
// ============================================================================

interface TopicData {
  topic: Topic;
  partitions: Map<number, EventStream>;
}

interface SubscriptionData {
  subscription: Subscription;
  deliveryQueue: StreamEvent[];
  pendingEvents: number;
}

export interface PubSubStats {
  topicCount: number;
  subscriptionCount: number;
  subscriberCount: number;
  topicStats: Map<string, TopicStats>;
}

export interface TopicStats {
  subscriptionCount: number;
  messageCount: number;
  partitionCount: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create pub/sub broker with default configuration
 */
export function createPubSubBroker(): PubSubBroker {
  return new PubSubBroker();
}
