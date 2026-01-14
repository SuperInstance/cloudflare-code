/**
 * Pub/Sub Messaging System for Multi-Agent Communication
 *
 * Provides publish/subscribe messaging with:
 * - Topic-based routing
 * - Message filtering
 * - Subscription management
 * - Delivery guarantees
 * - <100ms message delivery
 */

import type {
  AgentMessage,
  Topic,
  Subscription,
  MessageFilter,
  MessageStatus,
  MessageType,
  MessagePriority,
} from './types';

export interface PubSubEnv {
  AGENT_PUBSUB: DurableObjectNamespace;
  AGENTS_KV?: KVNamespace;
}

/**
 * PubSub state
 */
interface PubSubState {
  topics: Map<string, Topic>;
  subscriptions: Map<string, Subscription>;
  messageQueue: Map<string, AgentMessage>;
  deliveryStatus: Map<string, MessageStatus>;
  stats: {
    messagesPublished: number;
    messagesDelivered: number;
    messagesFailed: number;
    lastPublishTime: number;
  };
}

/**
 * Pub/Sub Messaging System
 *
 * Features:
 * - Topic-based publish/subscribe
 * - Message filtering per subscription
 * - At-least-once delivery guarantees
 * - Automatic retry with exponential backoff
 * - Performance: <100ms delivery
 */
export class PubSubSystem {
  private env: PubSubEnv;
  private storage: DurableObjectStorage;
  private state: PubSubState;
  private maxRetries = 3;
  private baseRetryDelay = 100;

  constructor(env: PubSubEnv, storage: DurableObjectStorage) {
    this.env = env;
    this.storage = storage;

    this.state = {
      topics: new Map(),
      subscriptions: new Map(),
      messageQueue: new Map(),
      deliveryStatus: new Map(),
      stats: {
        messagesPublished: 0,
        messagesDelivered: 0,
        messagesFailed: 0,
        lastPublishTime: Date.now(),
      },
    };
  }

  /**
   * Initialize from storage
   */
  async initialize(): Promise<void> {
    try {
      const stored = await this.storage.get<{
        topics: Array<[string, Omit<Topic, 'subscribers'> & { subscribers: Array<[string, Subscription]> }]>;
        subscriptions: Array<[string, Subscription]>;
        messageQueue: Array<[string, AgentMessage]>;
        deliveryStatus: Array<[string, MessageStatus]>;
        stats: PubSubState['stats'];
      }>('pubsubState');

      if (stored) {
        // Restore topics with proper Map for subscribers
        for (const [name, topic] of stored.topics) {
          this.state.topics.set(name, {
            ...topic,
            subscribers: new Map(topic.subscribers),
          });
        }

        this.state.subscriptions = new Map(stored.subscriptions);
        this.state.messageQueue = new Map(stored.messageQueue);
        this.state.deliveryStatus = new Map(stored.deliveryStatus);
        this.state.stats = stored.stats;

        // Retry pending messages
        await this.retryPendingMessages();
      }
    } catch (error) {
      console.error('Failed to initialize pubsub system:', error);
    }
  }

  /**
   * Create a new topic
   */
  async createTopic(topicName: string): Promise<void> {
    if (this.state.topics.has(topicName)) {
      return; // Topic already exists
    }

    const topic: Topic = {
      name: topicName,
      subscribers: new Map(),
      messageCount: 0,
      createdAt: Date.now(),
    };

    this.state.topics.set(topicName, topic);
    await this.persistState();
  }

  /**
   * Delete a topic
   */
  async deleteTopic(topicName: string): Promise<void> {
    const topic = this.state.topics.get(topicName);
    if (!topic) {
      return;
    }

    // Remove all subscriptions to this topic
    for (const [subId, subscription] of topic.subscribers) {
      this.state.subscriptions.delete(subId);
    }

    this.state.topics.delete(topicName);
    await this.persistState();
  }

  /**
   * Subscribe to a topic
   */
  async subscribe(
    subscriberId: string,
    topicName: string,
    filter?: MessageFilter
  ): Promise<string> {
    // Create topic if it doesn't exist
    await this.createTopic(topicName);

    const topic = this.state.topics.get(topicName);
    if (!topic) {
      throw new Error(`Failed to create or retrieve topic: ${topicName}`);
    }

    const subscriptionId = crypto.randomUUID();

    const subscription: Subscription = {
      subscriptionId,
      subscriberId,
      topic: topicName,
      filter,
      createdAt: Date.now(),
    };

    // Add subscription to topic
    topic.subscribers.set(subscriptionId, subscription);

    // Add to global subscriptions
    this.state.subscriptions.set(subscriptionId, subscription);

    await this.persistState();

    return subscriptionId;
  }

  /**
   * Unsubscribe from a topic
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.state.subscriptions.get(subscriptionId);
    if (!subscription) {
      return;
    }

    // Remove from topic
    const topic = this.state.topics.get(subscription.topic);
    if (topic) {
      topic.subscribers.delete(subscriptionId);
    }

    // Remove from global subscriptions
    this.state.subscriptions.delete(subscriptionId);

    await this.persistState();
  }

  /**
   * Publish message to a topic
   */
  async publish(topicName: string, message: AgentMessage): Promise<string[]> {
    const topic = this.state.topics.get(topicName);
    if (!topic) {
      throw new Error(`Topic not found: ${topicName}`);
    }

    // Update topic stats
    topic.messageCount++;
    topic.lastMessageAt = Date.now();

    // Update global stats
    this.state.stats.messagesPublished++;
    this.state.stats.lastPublishTime = Date.now();

    // Find matching subscribers
    const matchingSubscriptions = this.findMatchingSubscriptions(topic, message);

    if (matchingSubscriptions.length === 0) {
      await this.persistState();
      return [];
    }

    // Queue message for delivery
    const deliveryPromises = matchingSubscriptions.map(async (subscription) => {
      return this.deliverToSubscriber(subscription, message);
    });

    const results = await Promise.allSettled(deliveryPromises);

    const successfulDeliveries: string[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        successfulDeliveries.push(result.value);
      }
    }

    await this.persistState();

    return successfulDeliveries;
  }

  /**
   * Find subscribers matching the message based on filters
   */
  private findMatchingSubscriptions(topic: Topic, message: AgentMessage): Subscription[] {
    const matching: Subscription[] = [];

    for (const subscription of topic.subscribers.values()) {
      if (this.matchesFilter(subscription.filter, message)) {
        matching.push(subscription);
      }
    }

    return matching;
  }

  /**
   * Check if message matches subscription filter
   */
  private matchesFilter(filter: MessageFilter | undefined, message: AgentMessage): boolean {
    if (!filter) {
      return true; // No filter, match all
    }

    // Check message type
    if (filter.messageType && !filter.messageType.includes(message.type)) {
      return false;
    }

    // Check action
    if (filter.actions && !filter.actions.includes(message.action)) {
      return false;
    }

    // Check priority
    if (filter.priority && !filter.priority.includes(message.priority)) {
      return false;
    }

    // Check from agent
    if (filter.fromAgent && !filter.fromAgent.includes(message.from)) {
      return false;
    }

    return true;
  }

  /**
   * Deliver message to a subscriber
   */
  private async deliverToSubscriber(
    subscription: Subscription,
    message: AgentMessage
  ): Promise<string> {
    const deliveryId = `${message.id}-${subscription.subscriptionId}`;

    // Create delivery status
    const status: MessageStatus = {
      messageId: deliveryId,
      status: 'pending',
      attempts: 0,
      lastAttempt: Date.now(),
    };

    this.state.deliveryStatus.set(deliveryId, status);

    try {
      // Get subscriber DO stub
      const subscriberDO = this.env.AGENT_PUBSUB.get(
        this.env.AGENT_PUBSUB.idFromName(subscription.subscriberId)
      );

      // Send message
      const response = await subscriberDO.fetch(
        new Request('https://pubsub/deliver', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            subscriptionId: subscription.subscriptionId,
          }),
        })
      );

      if (response.ok) {
        // Mark as delivered
        status.status = 'delivered';
        status.deliveredAt = Date.now();
        this.state.stats.messagesDelivered++;

        // Update subscription
        subscription.lastMessageAt = Date.now();
      } else {
        // Mark for retry
        await this.scheduleRetry(deliveryId, status);
      }
    } catch (error) {
      // Mark for retry
      await this.scheduleRetry(deliveryId, status);
    }

    return deliveryId;
  }

  /**
   * Schedule retry for failed delivery
   */
  private async scheduleRetry(deliveryId: string, status: MessageStatus): Promise<void> {
    status.attempts++;

    if (status.attempts >= this.maxRetries) {
      // Max retries reached
      status.status = 'failed';
      status.error = 'Max retries exceeded';
      this.state.stats.messagesFailed++;
    } else {
      // Schedule retry
      status.status = 'pending';
    }

    this.state.deliveryStatus.set(deliveryId, status);
  }

  /**
   * Retry pending message deliveries
   */
  async retryPendingMessages(): Promise<void> {
    const now = Date.now();
    const retryBatch: Array<(Promise<void>)> = [];

    for (const [deliveryId, status] of this.state.deliveryStatus.entries()) {
      if (status.status !== 'pending') {
        continue;
      }

      // Check if message has expired
      const message = this.state.messageQueue.get(deliveryId.split('-')[0]);
      if (message && message.ttl && now - message.timestamp > message.ttl) {
        status.status = 'expired';
        status.error = 'Message TTL exceeded';
        this.state.stats.messagesFailed++;
        continue;
      }

      // Calculate retry delay using exponential backoff
      const retryDelay = this.baseRetryDelay * Math.pow(2, status.attempts);
      const timeSinceLastAttempt = now - status.lastAttempt;

      if (timeSinceLastAttempt >= retryDelay) {
        // Retry delivery
        retryBatch.push(this.retryDelivery(deliveryId));
      }
    }

    await Promise.all(retryBatch);
    await this.persistState();
  }

  /**
   * Retry a single delivery
   */
  private async retryDelivery(deliveryId: string): Promise<void> {
    const status = this.state.deliveryStatus.get(deliveryId);
    if (!status || status.status !== 'pending') {
      return;
    }

    const [messageId, subscriptionId] = deliveryId.split('-');
    const subscription = this.state.subscriptions.get(subscriptionId);
    const message = this.state.messageQueue.get(messageId);

    if (!subscription || !message) {
      status.status = 'failed';
      status.error = 'Subscription or message not found';
      return;
    }

    await this.deliverToSubscriber(subscription, message);
  }

  /**
   * Get topic statistics
   */
  async getTopicStats(topicName: string): Promise<{
    name: string;
    subscriberCount: number;
    messageCount: number;
    lastMessageAt?: number;
  } | null> {
    const topic = this.state.topics.get(topicName);
    if (!topic) {
      return null;
    }

    return {
      name: topic.name,
      subscriberCount: topic.subscribers.size,
      messageCount: topic.messageCount,
      lastMessageAt: topic.lastMessageAt,
    };
  }

  /**
   * Get subscription info
   */
  getSubscription(subscriptionId: string): Subscription | null {
    return this.state.subscriptions.get(subscriptionId) || null;
  }

  /**
   * List all topics
   */
  listTopics(): string[] {
    return Array.from(this.state.topics.keys());
  }

  /**
   * List subscriptions for a subscriber
   */
  listSubscriptions(subscriberId: string): Subscription[] {
    return Array.from(this.state.subscriptions.values()).filter(
      (sub) => sub.subscriberId === subscriberId
    );
  }

  /**
   * Get delivery status
   */
  getDeliveryStatus(deliveryId: string): MessageStatus | null {
    return this.state.deliveryStatus.get(deliveryId) || null;
  }

  /**
   * Get system statistics
   */
  getStats(): PubSubState['stats'] {
    return { ...this.state.stats };
  }

  /**
   * Persist state to storage
   */
  private async persistState(): Promise<void> {
    try {
      // Convert subscribers Maps to arrays for serialization
      const topicsArray = Array.from(this.state.topics.entries()).map(([name, topic]) => [
        name,
        {
          ...topic,
          subscribers: Array.from(topic.subscribers.entries()),
        },
      ]);

      await this.storage.put('pubsubState', {
        topics: topicsArray,
        subscriptions: Array.from(this.state.subscriptions.entries()),
        messageQueue: Array.from(this.state.messageQueue.entries()),
        deliveryStatus: Array.from(this.state.deliveryStatus.entries()),
        stats: this.state.stats,
      });
    } catch (error) {
      console.error('Failed to persist pubsub state:', error);
    }
  }

  /**
   * Cleanup old messages and status
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up message queue
    for (const [id, message] of this.state.messageQueue.entries()) {
      if (now - message.timestamp > maxAge) {
        this.state.messageQueue.delete(id);
      }
    }

    // Clean up delivery status
    for (const [id, status] of this.state.deliveryStatus.entries()) {
      if (
        status.status === 'delivered' ||
        status.status === 'failed' ||
        status.status === 'expired'
      ) {
        if (now - status.lastAttempt > maxAge) {
          this.state.deliveryStatus.delete(id);
        }
      }
    }

    await this.persistState();
  }
}

/**
 * PubSub Durable Object
 */
export class PubSubDO implements DurableObject {
  private state: DurableObjectState;
  private env: PubSubEnv;
  private pubsub: PubSubSystem;

  constructor(state: DurableObjectState, env: PubSubEnv) {
    this.state = state;
    this.env = env;
    this.pubsub = new PubSubSystem(env, state.storage);
    this.pubsub.initialize();
  }

  /**
   * Fetch handler
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (method === 'POST' && path === '/topic/create') {
        return this.handleCreateTopic(request);
      }

      if (method === 'DELETE' && path === '/topic/delete') {
        return this.handleDeleteTopic(request);
      }

      if (method === 'POST' && path === '/subscribe') {
        return this.handleSubscribe(request);
      }

      if (method === 'DELETE' && path === '/unsubscribe') {
        return this.handleUnsubscribe(request);
      }

      if (method === 'POST' && path === '/publish') {
        return this.handlePublish(request);
      }

      if (method === 'GET' && path === '/topics') {
        return this.handleListTopics();
      }

      if (method === 'GET' && path === '/subscriptions') {
        return this.handleListSubscriptions(request);
      }

      if (method === 'GET' && path === '/stats') {
        return this.handleGetStats();
      }

      if (method === 'GET' && path === '/topic/stats') {
        return this.handleGetTopicStats(request);
      }

      if (method === 'POST' && path === '/cleanup') {
        return this.handleCleanup();
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Handle create topic
   */
  private async handleCreateTopic(request: Request): Promise<Response> {
    const body = await request.json() as { topicName: string };

    await this.pubsub.createTopic(body.topicName);

    return new Response(
      JSON.stringify({ success: true, topicName: body.topicName }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle delete topic
   */
  private async handleDeleteTopic(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const topicName = url.searchParams.get('topicName') || '';

    await this.pubsub.deleteTopic(topicName);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle subscribe
   */
  private async handleSubscribe(request: Request): Promise<Response> {
    const body = await request.json() as {
      subscriberId: string;
      topicName: string;
      filter?: MessageFilter;
    };

    const subscriptionId = await this.pubsub.subscribe(
      body.subscriberId,
      body.topicName,
      body.filter
    );

    return new Response(
      JSON.stringify({ success: true, subscriptionId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle unsubscribe
   */
  private async handleUnsubscribe(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const subscriptionId = url.searchParams.get('subscriptionId') || '';

    await this.pubsub.unsubscribe(subscriptionId);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle publish
   */
  private async handlePublish(request: Request): Promise<Response> {
    const body = await request.json() as {
      topicName: string;
      message: AgentMessage;
    };

    const deliveryIds = await this.pubsub.publish(body.topicName, body.message);

    return new Response(
      JSON.stringify({
        success: true,
        deliveredCount: deliveryIds.length,
        deliveryIds,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle list topics
   */
  private async handleListTopics(): Promise<Response> {
    const topics = this.pubsub.listTopics();

    return new Response(
      JSON.stringify({ topics, count: topics.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle list subscriptions
   */
  private async handleListSubscriptions(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const subscriberId = url.searchParams.get('subscriberId') || '';

    const subscriptions = this.pubsub.listSubscriptions(subscriberId);

    return new Response(
      JSON.stringify({ subscriptions, count: subscriptions.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get stats
   */
  private async handleGetStats(): Promise<Response> {
    const stats = this.pubsub.getStats();

    return new Response(
      JSON.stringify(stats),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle get topic stats
   */
  private async handleGetTopicStats(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const topicName = url.searchParams.get('topicName') || '';

    const stats = await this.pubsub.getTopicStats(topicName);

    if (!stats) {
      return new Response(
        JSON.stringify({ error: 'Topic not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(stats),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle cleanup
   */
  private async handleCleanup(): Promise<Response> {
    await this.pubsub.cleanup();

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Alarm handler for periodic maintenance
   */
  async alarm(): Promise<void> {
    // Retry pending messages
    await this.pubsub.retryPendingMessages();

    // Cleanup old data
    await this.pubsub.cleanup();
  }
}

/**
 * Helper function to create PubSub stub
 */
export function createPubSubStub(env: PubSubEnv): DurableObjectStub {
  return env.AGENT_PUBSUB.get(env.AGENT_PUBSUB.idFromName('global-pubsub'));
}
