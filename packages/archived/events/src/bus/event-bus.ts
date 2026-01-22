/**
 * Event Bus implementation using Durable Objects
 */

// @ts-nocheck - Cloudflare Workers DurableObject types not fully available
import type {
  EventEnvelope,
  EventHandler,
  SubscriptionConfig,
  TopicConfig,
  DeliveryReceipt,
  ConsumerConfig,
} from '../types';
import { EventBusStorage } from '../storage/durable-storage';
import { generateEventId, generateSubscriptionId, generateConsumerGroupId } from '../utils/id';

// ============================================================================
// Event Bus Durable Object
// ============================================================================

export interface EventBusEnv {
  EVENT_BUS_STORAGE: DurableObjectNamespace;
  R2_BUCKET: R2Bucket;
}

export class EventBusDurableObject implements DurableObject {
  private storage: EventBusStorage;

  constructor(
    private state: DurableObjectState,
    private env: EventBusEnv
  ) {
    this.storage = new EventBusStorage(state.storage);
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.storage.initialize();
  }

  // ============================================================================
  // Event Publishing
  // ============================================================================

  async publish(event: EventEnvelope, options: { partitionKey?: string } = {}): Promise<void> {
    // Ensure event has required metadata
    if (!event.metadata.eventId) {
      event.metadata.eventId = generateEventId();
    }
    if (!event.metadata.timestamp) {
      event.metadata.timestamp = Date.now();
    }

    // Get topic
    const topic = await this.storage.getTopic(event.metadata.eventType);
    if (!topic) {
      // Auto-create topic if it doesn't exist
      await this.storage.createTopic({
        name: event.metadata.eventType,
        partitions: 1,
      });
    }

    // Get all subscriptions for this event type
    const subscriptions = await this.storage.listSubscriptions(event.metadata.eventType);

    // Add event to each subscription's buffer
    for (const subscription of subscriptions) {
      // Apply filter if configured
      if (subscription.filter && !this.matchesFilter(event, subscription.filter)) {
        continue;
      }

      await this.storage.addMessage(subscription.subscriptionId, event);
    }
  }

  async publishBatch(events: EventEnvelope[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  // ============================================================================
  // Event Subscription
  // ============================================================================

  async subscribe(config: Omit<SubscriptionConfig, 'subscriptionId'>): Promise<string> {
    const subscriptionId = generateSubscriptionId(config.topic);
    const subscription: SubscriptionConfig = {
      ...config,
      subscriptionId,
    };

    await this.storage.createSubscription(subscription);
    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    await this.storage.deleteSubscription(subscriptionId);
  }

  async getSubscription(subscriptionId: string): Promise<SubscriptionConfig | null> {
    return this.storage.getSubscription(subscriptionId);
  }

  async listSubscriptions(topic?: string): Promise<SubscriptionConfig[]> {
    return this.storage.listSubscriptions(topic);
  }

  // ============================================================================
  // Event Consumption
  // ============================================================================

  async consume(subscriptionId: string, maxMessages: number = 10): Promise<EventEnvelope[]> {
    const subscription = await this.storage.getSubscription(subscriptionId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const messages = await this.storage.getMessages(subscriptionId, maxMessages);
    return messages;
  }

  async acknowledge(
    subscriptionId: string,
    messageIds: string[],
    receipt: DeliveryReceipt
  ): Promise<void> {
    // Remove acknowledged messages from buffer
    await this.storage.removeMessages(subscriptionId, messageIds);

    // Update offset
    for (const messageId of messageIds) {
      await this.storage.setOffset(subscriptionId, messageId, Date.now());
    }
  }

  async negativeAcknowledge(
    subscriptionId: string,
    messageIds: string[],
    retry: boolean = true
  ): Promise<void> {
    if (!retry) {
      await this.storage.removeMessages(subscriptionId, messageIds);
    }
    // Messages stay in buffer for retry
  }

  // ============================================================================
  // Topic Management
  // ============================================================================

  async createTopic(config: TopicConfig): Promise<void> {
    await this.storage.createTopic(config);
  }

  async getTopic(name: string): Promise<TopicConfig | null> {
    return this.storage.getTopic(name);
  }

  async listTopics(): Promise<TopicConfig[]> {
    return this.storage.listTopics();
  }

  async deleteTopic(name: string): Promise<void> {
    await this.storage.deleteTopic(name);

    // Delete all subscriptions for this topic
    const subscriptions = await this.storage.listSubscriptions(name);
    for (const subscription of subscriptions) {
      await this.storage.deleteSubscription(subscription.subscriptionId);
    }
  }

  // ============================================================================
  // Consumer Management
  // ============================================================================

  async registerConsumer(config: ConsumerConfig): Promise<void> {
    await this.storage.registerConsumer(config);
  }

  async getConsumer(consumerId: string): Promise<ConsumerConfig | null> {
    return this.storage.getConsumer(consumerId);
  }

  async listConsumers(groupId?: string): Promise<ConsumerConfig[]> {
    return this.storage.listConsumers(groupId);
  }

  async unregisterConsumer(consumerId: string): Promise<void> {
    await this.storage.unregisterConsumer(consumerId);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private matchesFilter(event: EventEnvelope, filter: SubscriptionConfig['filter']): boolean {
    if (!filter) {
      return true;
    }

    if (filter.eventType) {
      if (typeof filter.eventType === 'string') {
        if (event.metadata.eventType !== filter.eventType) {
          return false;
        }
      } else if (Array.isArray(filter.eventType)) {
        if (!filter.eventType.includes(event.metadata.eventType)) {
          return false;
        }
      } else if (filter.eventType instanceof RegExp) {
        if (!filter.eventType.test(event.metadata.eventType)) {
          return false;
        }
      }
    }

    if (filter.correlationId && event.metadata.correlationId !== filter.correlationId) {
      return false;
    }

    if (filter.userId && event.metadata.userId !== filter.userId) {
      return false;
    }

    if (filter.fromTimestamp && event.metadata.timestamp < filter.fromTimestamp) {
      return false;
    }

    if (filter.toTimestamp && event.metadata.timestamp > filter.toTimestamp) {
      return false;
    }

    return true;
  }

  // ============================================================================
  // Maintenance
  // ============================================================================

  async alarm(): Promise<void> {
    const now = Date.now();
    await this.storage.cleanup(now);
  }

  async getStats(): Promise<{
    topicCount: number;
    subscriptionCount: number;
    consumerCount: number;
    bufferedMessageCount: number;
  }> {
    return this.storage.getStats();
  }
}

// ============================================================================
// Event Bus Client
// ============================================================================

export class EventBusClient {
  constructor(
    private namespace: DurableObjectNamespace,
    private id: DurableObjectId
  ) {}

  private getStub(): EventBusDurableObjectStub {
    return this.namespace.get(this.id);
  }

  async publish(event: EventEnvelope): Promise<void> {
    const stub = this.getStub();
    await stub.publish(event);
  }

  async publishBatch(events: EventEnvelope[]): Promise<void> {
    const stub = this.getStub();
    await stub.publishBatch(events);
  }

  async subscribe(config: Omit<SubscriptionConfig, 'subscriptionId'>): Promise<string> {
    const stub = this.getStub();
    return stub.subscribe(config);
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const stub = this.getStub();
    await stub.unsubscribe(subscriptionId);
  }

  async consume(subscriptionId: string, maxMessages?: number): Promise<EventEnvelope[]> {
    const stub = this.getStub();
    return stub.consume(subscriptionId, maxMessages);
  }

  async acknowledge(
    subscriptionId: string,
    messageIds: string[],
    receipt: DeliveryReceipt
  ): Promise<void> {
    const stub = this.getStub();
    await stub.acknowledge(subscriptionId, messageIds, receipt);
  }

  async createTopic(config: TopicConfig): Promise<void> {
    const stub = this.getStub();
    await stub.createTopic(config);
  }

  async listTopics(): Promise<TopicConfig[]> {
    const stub = this.getStub();
    return stub.listTopics();
  }
}

// ============================================================================
// Event Bus Factory
// ============================================================================

export class EventBusFactory {
  constructor(private namespace: DurableObjectNamespace) {}

  create(id: string = 'default'): EventBusClient {
    const durableObjectId = this.namespace.idFromString(id);
    return new EventBusClient(this.namespace, durableObjectId);
  }

  createFromName(name: string): EventBusClient {
    const durableObjectId = this.namespace.idFromName(name);
    return new EventBusClient(this.namespace, durableObjectId);
  }
}
