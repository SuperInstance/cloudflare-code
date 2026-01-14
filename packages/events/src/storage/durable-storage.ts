/**
 * Durable Object storage for event bus state management
 */

import type {
  EventEnvelope,
  SubscriptionConfig,
  ConsumerConfig,
  TopicConfig,
  ConsumerGroup,
  ConsumerMember,
  Partition,
} from '../types';

// ============================================================================
// Storage Schema
// ============================================================================

interface EventBusState {
  topics: Record<string, TopicConfig>;
  subscriptions: Record<string, SubscriptionConfig>;
  consumers: Record<string, ConsumerConfig>;
  consumerGroups: Record<string, ConsumerGroup>;
  partitions: Record<string, Partition>;
  offsets: Record<string, Record<string, number>>; // subscriptionId -> messageId -> offset
  messageBuffers: Record<string, EventEnvelope[]>; // subscriptionId -> messages
  lastCleanup: number;
}

// ============================================================================
// Durable Object Storage
// ============================================================================

export class EventBusStorage {
  private state: EventBusState = {
    topics: {},
    subscriptions: {},
    consumers: {},
    consumerGroups: {},
    partitions: {},
    offsets: {},
    messageBuffers: {},
    lastCleanup: Date.now(),
  };

  constructor(private storage: DurableObjectStorage) {}

  // ============================================================================
// Initialization
  // ============================================================================

  async initialize(): Promise<void> {
    const data = await this.storage.get<EventBusState>('state');
    if (data) {
      this.state = data;
    }
  }

  async save(): Promise<void> {
    await this.storage.put('state', this.state);
  }

  // ============================================================================
  // Topic Management
  // ============================================================================

  async createTopic(config: TopicConfig): Promise<void> {
    this.state.topics[config.name] = config;
    await this.save();
  }

  async getTopic(name: string): Promise<TopicConfig | null> {
    return this.state.topics[name] ?? null;
  }

  async listTopics(): Promise<TopicConfig[]> {
    return Object.values(this.state.topics);
  }

  async deleteTopic(name: string): Promise<void> {
    delete this.state.topics[name];
    await this.save();
  }

  // ============================================================================
  // Subscription Management
  // ============================================================================

  async createSubscription(config: SubscriptionConfig): Promise<void> {
    this.state.subscriptions[config.subscriptionId] = config;
    this.state.messageBuffers[config.subscriptionId] = [];
    this.state.offsets[config.subscriptionId] = {};
    await this.save();
  }

  async getSubscription(subscriptionId: string): Promise<SubscriptionConfig | null> {
    return this.state.subscriptions[subscriptionId] ?? null;
  }

  async listSubscriptions(topic?: string): Promise<SubscriptionConfig[]> {
    const subscriptions = Object.values(this.state.subscriptions);
    if (topic) {
      return subscriptions.filter((s) => s.topic === topic);
    }
    return subscriptions;
  }

  async deleteSubscription(subscriptionId: string): Promise<void> {
    delete this.state.subscriptions[subscriptionId];
    delete this.state.messageBuffers[subscriptionId];
    delete this.state.offsets[subscriptionId];
    await this.save();
  }

  // ============================================================================
  // Message Buffering
  // ============================================================================

  async addMessage(subscriptionId: string, event: EventEnvelope): Promise<void> {
    if (!this.state.messageBuffers[subscriptionId]) {
      this.state.messageBuffers[subscriptionId] = [];
    }
    this.state.messageBuffers[subscriptionId].push(event);
    await this.save();
  }

  async getMessages(
    subscriptionId: string,
    limit?: number
  ): Promise<EventEnvelope[]> {
    const messages = this.state.messageBuffers[subscriptionId] ?? [];
    if (limit) {
      return messages.slice(0, limit);
    }
    return messages;
  }

  async removeMessages(subscriptionId: string, messageIds: string[]): Promise<void> {
    const buffer = this.state.messageBuffers[subscriptionId] ?? [];
    this.state.messageBuffers[subscriptionId] = buffer.filter(
      (m) => !messageIds.includes(m.metadata.eventId)
    );
    await this.save();
  }

  async clearMessages(subscriptionId: string): Promise<void> {
    this.state.messageBuffers[subscriptionId] = [];
    await this.save();
  }

  // ============================================================================
  // Offset Management
  // ============================================================================

  async setOffset(subscriptionId: string, messageId: string, offset: number): Promise<void> {
    if (!this.state.offsets[subscriptionId]) {
      this.state.offsets[subscriptionId] = {};
    }
    this.state.offsets[subscriptionId][messageId] = offset;
    await this.save();
  }

  async getOffset(subscriptionId: string, messageId: string): Promise<number | null> {
    return this.state.offsets[subscriptionId]?.[messageId] ?? null;
  }

  async removeOffset(subscriptionId: string, messageId: string): Promise<void> {
    delete this.state.offsets[subscriptionId]?.[messageId];
    await this.save();
  }

  // ============================================================================
  // Consumer Management
  // ============================================================================

  async registerConsumer(config: ConsumerConfig): Promise<void> {
    this.state.consumers[config.consumerId] = config;
    await this.save();
  }

  async getConsumer(consumerId: string): Promise<ConsumerConfig | null> {
    return this.state.consumers[consumerId] ?? null;
  }

  async listConsumers(groupId?: string): Promise<ConsumerConfig[]> {
    const consumers = Object.values(this.state.consumers);
    if (groupId) {
      return consumers.filter((c) => c.groupId === groupId);
    }
    return consumers;
  }

  async unregisterConsumer(consumerId: string): Promise<void> {
    delete this.state.consumers[consumerId];
    await this.save();
  }

  // ============================================================================
  // Consumer Group Management
  // ============================================================================

  async createConsumerGroup(group: ConsumerGroup): Promise<void> {
    this.state.consumerGroups[group.groupId] = group;
    await this.save();
  }

  async getConsumerGroup(groupId: string): Promise<ConsumerGroup | null> {
    return this.state.consumerGroups[groupId] ?? null;
  }

  async listConsumerGroups(): Promise<ConsumerGroup[]> {
    return Object.values(this.state.consumerGroups);
  }

  async updateConsumerGroup(group: ConsumerGroup): Promise<void> {
    this.state.consumerGroups[group.groupId] = group;
    await this.save();
  }

  async deleteConsumerGroup(groupId: string): Promise<void> {
    delete this.state.consumerGroups[groupId];
    await this.save();
  }

  // ============================================================================
  // Partition Management
  // ============================================================================

  async createPartition(partition: Partition): Promise<void> {
    this.state.partitions[`${partition.queueName}-${partition.partitionId}`] = partition;
    await this.save();
  }

  async getPartition(queueName: string, partitionId: number): Promise<Partition | null> {
    return this.state.partitions[`${queueName}-${partitionId}`] ?? null;
  }

  async listPartitions(queueName: string): Promise<Partition[]> {
    return Object.values(this.state.partitions).filter((p) => p.queueName === queueName);
  }

  async updatePartition(partition: Partition): Promise<void> {
    this.state.partitions[`${partition.queueName}-${partition.partitionId}`] = partition;
    await this.save();
  }

  async deletePartition(queueName: string, partitionId: number): Promise<void> {
    delete this.state.partitions[`${queueName}-${partitionId}`];
    await this.save();
  }

  // ============================================================================
  // Maintenance
  // ============================================================================

  async cleanup(now: number): Promise<void> {
    const oneHourAgo = now - 60 * 60 * 1000;

    // Clean up old message buffers
    for (const [subscriptionId, buffer] of Object.entries(this.state.messageBuffers)) {
      const filtered = buffer.filter((m) => m.metadata.timestamp > oneHourAgo);
      if (filtered.length < buffer.length) {
        this.state.messageBuffers[subscriptionId] = filtered;
      }
    }

    this.state.lastCleanup = now;
    await this.save();
  }

  async getStats(): Promise<{
    topicCount: number;
    subscriptionCount: number;
    consumerCount: number;
    bufferedMessageCount: number;
  }> {
    return {
      topicCount: Object.keys(this.state.topics).length,
      subscriptionCount: Object.keys(this.state.subscriptions).length,
      consumerCount: Object.keys(this.state.consumers).length,
      bufferedMessageCount: Object.values(this.state.messageBuffers).reduce(
        (sum, buf) => sum + buf.length,
        0
      ),
    };
  }
}
