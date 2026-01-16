// @ts-nocheck - External dependencies and complex type relationships
import { Message, BrokerStats, Topic, Subscription } from './types';
import { MessageRouter } from './router/router';
import { TopicManager } from './topics/manager';
import { SubscriberManager } from './subscribers/manager';
import { DeliveryEngine } from './delivery/engine';

export interface BrokerConfig {
  router?: Partial<MessageRouter.Config>;
  topics?: Partial<TopicManager.Config>;
  subscribers?: Partial<SubscriberManager.Config>;
  delivery?: Partial<DeliveryEngine.Config>;
}

export interface BrokerMetrics {
  topics: {
    total: number;
    messages: number;
    size: number;
  };
  subscribers: {
    total: number;
    healthy: number;
    unhealthy: number;
  };
  delivery: {
    total: number;
    successful: number;
    failed: number;
    throughput: number;
  };
  system: {
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

export class MessagingBroker {
  private router: MessageRouter;
  private topicManager: TopicManager;
  private subscriberManager: SubscriberManager;
  private deliveryEngine: DeliveryEngine;
  private config: BrokerConfig;
  private isRunning: boolean = false;
  private startTime: number = Date.now();
  private messageRateHistory: number[] = [];
  private maxMessageRateHistory = 60; // 1 minute at 1s intervals

  constructor(config: BrokerConfig = {}) {
    this.config = config;

    // Initialize components
    this.router = new MessageRouter(config.router);
    this.topicManager = new TopicManager(config.topics);
    this.subscriberManager = new SubscriberManager(config.subscribers);
    this.deliveryEngine = new DeliveryEngine(config.delivery);
  }

  async initialize(): Promise<void> {
    console.log('Initializing Messaging Broker...');

    // Initialize all components
    await Promise.all([
      this.router.initialize(),
      this.topicManager.initialize(),
      this.subscriberManager.initialize(),
      this.deliveryEngine.initialize()
    ]);

    // Set up event handlers
    this.setupEventHandlers();

    this.isRunning = true;
    console.log('Messaging Broker initialized successfully');
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Broker is already running');
      return;
    }

    await this.initialize();
    console.log('Messaging Broker started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('Broker is not running');
      return;
    }

    console.log('Stopping Messaging Broker...');

    // Graceful shutdown
    await this.deliveryEngine.flush();
    await this.topicManager.close();
    await this.subscriberManager.close();
    await this.deliveryEngine.close();

    this.isRunning = false;
    console.log('Messaging Broker stopped');
  }

  async publish(topic: string, payload: any, headers: any = {}): Promise<{
    success: boolean;
    messageId: string;
    error?: string;
  }> {
    if (!this.isRunning) {
      return {
        success: false,
        messageId: '',
        error: 'Broker is not running'
      };
    }

    try {
      // Check if topic exists
      const topicExists = await this.topicManager.topicExists(topic);
      if (!topicExists) {
        // Create topic if it doesn't exist
        await this.topicManager.createTopic(topic);
      }

      // Create message
      const message = this.createMessage(topic, payload, headers);

      // Route message
      const routeResult = await this.router.route(message);
      let routedMessage = message;

      if (routeResult.transformedMessage) {
        routedMessage = routeResult.transformedMessage;
      }

      // Update topic stats
      await this.topicManager.incrementMessageCount(topic);
      await this.topicManager.incrementByteSize(topic, JSON.stringify(routedMessage).length);

      // Deliver to subscribers
      const subscriptions = await this.subscriberManager.getSubscriptionsByTopic(topic);
      const deliveries: Promise<import('./delivery/engine').DeliveryResult>[] = [];

      for (const subscription of subscriptions) {
        if (subscription.filter && !this.messageMatchesFilter(routedMessage, subscription.filter)) {
          continue;
        }

        deliveries.push(
          this.deliveryEngine.deliverMessage(routedMessage, subscription)
        );
      }

      // Wait for all deliveries to complete
      const results = await Promise.allSettled(deliveries);

      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.filter(r => r.status === 'fulfilled' && !r.value.success).length;
      const errors = results.filter(r => r.status === 'rejected').length;

      // Update message rate
      this.updateMessageRate();

      return {
        success: true,
        messageId: routedMessage.id,
        error: failed > 0 || errors > 0 ? `${failed} failed, ${errors} errors` : undefined
      };

    } catch (error) {
      return {
        success: false,
        messageId: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async subscribe(
    topic: string,
    subscriber: string,
    options: Partial<Subscription> = {}
  ): Promise<{
    success: boolean;
    subscriptionId: string;
    error?: string;
  }> {
    if (!this.isRunning) {
      return {
        success: false,
        subscriptionId: '',
        error: 'Broker is not running'
      };
    }

    try {
      // Create subscription
      const subscription = await this.subscriberManager.createSubscription(
        topic,
        subscriber,
        options
      );

      return {
        success: true,
        subscriptionId: subscription.id
      };

    } catch (error) {
      return {
        success: false,
        subscriptionId: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async unsubscribe(subscriptionId: string): Promise<boolean> {
    if (!this.isRunning) {
      return false;
    }

    return await this.subscriberManager.deleteSubscription(subscriptionId);
  }

  async createTopic(
    name: string,
    partitions: number = 1,
    replicationFactor: number = 1,
    options: Partial<Topic> = {}
  ): Promise<Topic> {
    if (!this.isRunning) {
      throw new Error('Broker is not running');
    }

    return await this.topicManager.createTopic(name, {
      partitions,
      replicationFactor,
      ...options
    });
  }

  async createRoutingRule(
    pattern: string,
    actions: MessageRouter.RoutingAction[],
    options: Partial<MessageRouter.RoutingRule> = {}
  ): Promise<MessageRouter.RoutingRule> {
    if (!this.isRunning) {
      throw new Error('Broker is not running');
    }

    const rule = MessageRouter.RoutingRule.createRoutingRule(pattern, actions, options);
    this.router.addRule(rule);
    return rule;
  }

  async getStats(): Promise<BrokerStats> {
    const [topicStats, subscriberStats, deliveryMetrics] = await Promise.all([
      this.topicManager.getMetrics(),
      this.subscriberManager.getMetrics(),
      this.deliveryEngine.getMetrics()
    ]);

    const now = Date.now();
    const uptime = (now - this.startTime) / 1000;

    // Calculate current message rate
    const recentRates = this.messageRateHistory.slice(-10);
    const currentMessageRate = recentRates.length > 0
      ? recentRates.reduce((sum, rate) => sum + rate, 0) / recentRates.length
      : 0;

    return {
      totalTopics: topicStats.totalTopics,
      totalSubscriptions: subscriberStats.totalSubscriptions,
      totalMessages: topicStats.totalMessages,
      messageRate: currentMessageRate,
      errorRate: deliveryMetrics.totalDeliveries > 0
        ? deliveryMetrics.failedDeliveries / deliveryMetrics.totalDeliveries
        : 0,
      memoryUsage: process.memoryUsage ? process.memoryUsage().heapUsed : 0,
      cpuUsage: 0, // Would need to implement CPU monitoring
      uptime
    };
  }

  async getMetrics(): Promise<BrokerMetrics> {
    const [topicMetrics, subscriberMetrics, deliveryMetrics] = await Promise.all([
      this.topicManager.getMetrics(),
      this.subscriberManager.getMetrics(),
      this.deliveryEngine.getMetrics()
    ]);

    return {
      topics: {
        total: topicMetrics.totalTopics,
        messages: topicMetrics.totalMessages,
        size: topicMetrics.totalSize
      },
      subscribers: {
        total: subscriberMetrics.totalSubscriptions,
        healthy: subscriberMetrics.healthySubscribers,
        unhealthy: subscriberMetrics.unhealthySubscribers
      },
      delivery: {
        total: deliveryMetrics.totalDeliveries,
        successful: deliveryMetrics.successfulDeliveries,
        failed: deliveryMetrics.failedDeliveries,
        throughput: deliveryMetrics.throughput
      },
      system: {
        uptime: (Date.now() - this.startTime) / 1000,
        memoryUsage: process.memoryUsage ? process.memoryUsage().heapUsed : 0,
        cpuUsage: 0
      }
    };
  }

  private createMessage(topic: string, payload: any, headers: any): Message {
    return {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      topic,
      payload,
      headers: {
        contentType: 'application/json',
        priority: 'normal',
        timestamp: Date.now(),
        ...headers
      },
      timestamp: Date.now(),
      retryCount: 0
    };
  }

  private messageMatchesFilter(message: Message, filter: Subscription['filter']): boolean {
    if (!filter) {
      return true;
    }

    // Check topic pattern
    if (filter.topicPattern && !this.topicMatches(message.topic, filter.topicPattern)) {
      return false;
    }

    // Check content type
    if (filter.contentType && message.headers.contentType !== filter.contentType) {
      return false;
    }

    // Check payload filter
    if (filter.payload) {
      if (typeof filter.payload === 'object') {
        for (const [key, value] of Object.entries(filter.payload)) {
          if (!message.payload || message.payload[key] !== value) {
            return false;
          }
        }
      }
    }

    return true;
  }

  private topicMatches(topic: string, pattern: string): boolean {
    // Simple prefix matching for now
    return topic.startsWith(pattern);
  }

  private setupEventHandlers(): void {
    // Event handlers would be implemented here
    // For now, leaving as placeholder
  }

  private updateMessageRate(): void {
    const now = Date.now();
    const timeDiff = now - this.lastMessageTime || now;

    if (timeDiff > 0) {
      const rate = 1000 / timeDiff;
      this.messageRateHistory.push(rate);

      // Keep only recent rates
      if (this.messageRateHistory.length > this.maxMessageRateHistory) {
        this.messageRateHistory.shift();
      }
    }

    this.lastMessageTime = now;
  }

  private lastMessageTime = Date.now();

  // Helper methods
  async getTopics(): Promise<Topic[]> {
    return await this.topicManager.getAllTopics();
  }

  async getSubscriptions(topic?: string, subscriber?: string): Promise<Subscription[]> {
    if (topic && subscriber) {
      throw new Error('Cannot filter by both topic and subscriber');
    }

    if (topic) {
      return await this.subscriberManager.getSubscriptionsByTopic(topic);
    }

    if (subscriber) {
      return await this.subscriberManager.getSubscriptionsBySubscriber(subscriber);
    }

    return await this.subscriberManager.getAllSubscriptions();
  }

  async isHealthy(): Promise<boolean> {
    if (!this.isRunning) {
      return false;
    }

    // Check component health
    const [routerHealthy, topicsHealthy, subscribersHealthy] = await Promise.all([
      this.checkRouterHealth(),
      this.checkTopicHealth(),
      this.checkSubscriberHealth()
    ]);

    return routerHealthy && topicsHealthy && subscribersHealthy;
  }

  private async checkRouterHealth(): Promise<boolean> {
    try {
      const metrics = this.router.getMetrics();
      return metrics && metrics.errorRate < 0.1;
    } catch {
      return false;
    }
  }

  private async checkTopicHealth(): Promise<boolean> {
    try {
      const topics = await this.topicManager.getAllTopics();
      return topics.length >= 0;
    } catch {
      return false;
    }
  }

  private async checkSubscriberHealth(): Promise<boolean> {
    try {
      const healthy = await this.subscriberManager.getHealthySubscribers();
      const total = await this.subscriberManager.getAllSubscriptions();
      return healthy.length / total.length > 0.8; // 80% healthy
    } catch {
      return false;
    }
  }
}