import { Message, Subscription, DeliveryResult, DeliveryGuarantee } from '../types';
import { createMessage } from '../utils';

export namespace DeliveryEngine {
  export interface Config {
    maxConcurrentDeliveries: number;
    deliveryTimeout: number;
    enablePersistence: boolean;
    enableMetrics: boolean;
    enableBackpressure: boolean;
    maxQueueSize: number;
    retryBackoffMultiplier: number;
    maxRetryDelay: number;
  }

  export interface DeliveryOptions {
    retryPolicy?: Subscription['retryPolicy'];
    timeout?: number;
    priority?: number;
  }
}

export class DeliveryEngine {
  private config: DeliveryEngine.Config;
  private pendingDeliveries: Set<string> = new Set();
  private deliveryQueue: Array<{
    message: Message;
    subscription: Subscription;
    options?: DeliveryEngine.DeliveryOptions;
    timestamp: number;
  }> = [];
  private metrics: {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    retries: number;
    timeouts: number;
    queueSize: number;
    throughput: number;
  };
  private throughputStartTime: number = Date.now();
  private throughputMessageCount: number = 0;

  constructor(config: Partial<DeliveryEngine.Config> = {}) {
    this.config = {
      maxConcurrentDeliveries: 1000,
      deliveryTimeout: 5000,
      enablePersistence: true,
      enableMetrics: true,
      enableBackpressure: true,
      maxQueueSize: 10000,
      retryBackoffMultiplier: 2,
      maxRetryDelay: 30000,
      ...config
    };

    this.metrics = {
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      retries: 0,
      timeouts: 0,
      queueSize: 0,
      throughput: 0
    };
  }

  async initialize(): Promise<void> {
    // Start throughput calculation
    setInterval(() => this.calculateThroughput(), 1000);

    // Start queue monitoring
    if (this.config.enableBackpressure) {
      setInterval(() => this.checkBackpressure(), 5000);
    }
  }

  async deliverMessage(
    message: Message,
    subscription: Subscription,
    options?: DeliveryEngine.DeliveryOptions
  ): Promise<DeliveryResult> {
    const startTime = performance.now();
    const deliveryId = `${message.id}:${subscription.id}`;

    // Check concurrency limits
    if (this.pendingDeliveries.size >= this.config.maxConcurrentDeliveries) {
      return {
        success: false,
        messageId: message.id,
        subscriber: subscription.subscriber,
        timestamp: Date.now(),
        error: 'Maximum concurrent deliveries exceeded'
      };
    }

    // Check queue limits
    if (this.config.enableBackpressure && this.deliveryQueue.length >= this.config.maxQueueSize) {
      return {
        success: false,
        messageId: message.id,
        subscriber: subscription.subscriber,
        timestamp: Date.now(),
        error: 'Backpressure limit reached'
      };
    }

    // Add to delivery queue
    this.deliveryQueue.push({
      message,
      subscription,
      options,
      timestamp: Date.now()
    });
    this.metrics.queueSize = this.deliveryQueue.length;

    // Process delivery
    const result = await this.processDelivery(deliveryId);

    // Calculate processing time
    const processingTime = performance.now() - startTime;

    // Update metrics
    this.metrics.totalDeliveries++;
    this.metrics.throughputMessageCount++;

    if (result.success) {
      this.metrics.successfulDeliveries++;
    } else {
      this.metrics.failedDeliveries++;
    }

    return {
      ...result,
      timestamp: Date.now()
    };
  }

  private async processDelivery(deliveryId: string): Promise<DeliveryResult> {
    const { message, subscription, options = {} } = this.deliveryQueue.shift()!;
    this.metrics.queueSize = this.deliveryQueue.length;

    this.pendingDeliveries.add(deliveryId);

    try {
      // Apply delivery guarantee policy
      switch (subscription.deliveryGuarantee) {
        case 'at-most-once':
          return await this.atMostOnceDelivery(message, subscription, options);

        case 'at-least-once':
          return await this.atLeastOnceDelivery(message, subscription, options);

        case 'exactly-once':
          return await this.exactlyOnceDelivery(message, subscription, options);

        default:
          throw new Error(`Unknown delivery guarantee: ${subscription.deliveryGuarantee}`);
      }
    } catch (error) {
      console.error('Delivery failed:', error);
      return {
        success: false,
        messageId: message.id,
        subscriber: subscription.subscriber,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      this.pendingDeliveries.delete(deliveryId);
    }
  }

  private async atMostOnceDelivery(
    message: Message,
    subscription: Subscription,
    options: DeliveryEngine.DeliveryOptions
  ): Promise<DeliveryResult> {
    // Try to deliver once without retry
    const result = await this.attemptDelivery(message, subscription, options);

    // No retry logic for at-most-once
    return result;
  }

  private async atLeastOnceDelivery(
    message: Message,
    subscription: Subscription,
    options: DeliveryEngine.DeliveryOptions
  ): Promise<DeliveryResult> {
    const retryPolicy = options.retryPolicy || subscription.retryPolicy;
    const maxRetries = retryPolicy.maxRetries;

    let lastError: string | undefined;
    let retryCount = 0;

    // Try delivery with retries
    while (retryCount <= maxRetries) {
      try {
        const result = await this.attemptDelivery(message, subscription, options);

        if (result.success) {
          // If successful, return result
          return result;
        }

        // If not successful but no error, treat as success
        if (!result.error) {
          return {
            success: true,
            messageId: message.id,
            subscriber: subscription.subscriber,
            timestamp: Date.now()
          };
        }

        lastError = result.error;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
      }

      // If we have more retries, calculate backoff
      if (retryCount < maxRetries) {
        const delay = this.calculateRetryDelay(retryCount, retryPolicy);
        await this.sleep(delay);
      }

      retryCount++;
      this.metrics.retries++;
    }

    // All retries failed
    return {
      success: false,
      messageId: message.id,
      subscriber: subscription.subscriber,
      timestamp: Date.now(),
      error: lastError,
      retryAttempt: retryCount
    };
  }

  private async exactlyOnceDelivery(
    message: Message,
    subscription: Subscription,
    options: DeliveryEngine.DeliveryOptions
  ): Promise<DeliveryResult> {
    // For exactly-once, we need to track delivered messages
    // This would typically involve:
    // 1. Checking if message was already delivered
    // 2. Acquiring lock before delivery
    // 3. Storing delivery acknowledgment
    // 4. Processing message
    // 5. Releasing lock

    // Simplified implementation:
    try {
      // Check if message was delivered before (in a real implementation)
      const wasDelivered = await this.checkMessageDelivered(message.id, subscription.id);

      if (wasDelivered) {
        return {
          success: true,
          messageId: message.id,
          subscriber: subscription.subscriber,
          timestamp: Date.now()
        };
      }

      // Attempt delivery
      const result = await this.attemptDelivery(message, subscription, options);

      if (result.success) {
        // Mark as delivered
        await this.markMessageDelivered(message.id, subscription.id);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        messageId: message.id,
        subscriber: subscription.subscriber,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async attemptDelivery(
    message: Message,
    subscription: Subscription,
    options: DeliveryEngine.DeliveryOptions
  ): Promise<DeliveryResult> {
    const timeout = options.timeout || this.config.deliveryTimeout;
    const startTime = Date.now();

    // Simulate delivery to subscriber
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.metrics.timeouts++;
        resolve({
          success: false,
          messageId: message.id,
          subscriber: subscription.subscriber,
          timestamp: Date.now(),
          error: 'Delivery timeout'
        });
      }, timeout);

      // Simulate delivery attempt
      setTimeout(() => {
        clearTimeout(timer);

        // Simulate success rate (95% success)
        const isSuccess = Math.random() > 0.05;

        resolve({
          success: isSuccess,
          messageId: message.id,
          subscriber: subscription.subscriber,
          timestamp: Date.now(),
          error: isSuccess ? undefined : 'Delivery failed'
        });
      }, Math.random() * 50); // Random processing time 0-50ms
    });
  }

  private calculateRetryDelay(
    attempt: number,
    retryPolicy: Subscription['retryPolicy']
  ): number {
    const delay = retryPolicy.initialDelay * Math.pow(
      this.config.retryBackoffMultiplier,
      attempt
    );

    // Add jitter
    if (retryPolicy.jitter) {
      const jitter = Math.random() * 0.1 * delay;
      delay += jitter;
    }

    return Math.min(delay, retryPolicy.maxDelay || this.config.maxRetryDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Persistence methods for exactly-once delivery
  private async checkMessageDelivered(messageId: string, subscriptionId: string): Promise<boolean> {
    // In a real implementation, this would check storage
    // For now, return false (assume not delivered)
    return false;
  }

  private async markMessageDelivered(messageId: string, subscriptionId: string): Promise<void> {
    // In a real implementation, this would store the delivery acknowledgment
    // For now, just log it
    console.log(`Marked message ${messageId} as delivered to ${subscriptionId}`);
  }

  // Queue management
  private async checkBackpressure(): Promise<void> {
    if (this.config.enableBackpressure && this.deliveryQueue.length >= this.config.maxQueueSize * 0.8) {
      console.warn(`Backpressure warning: Queue size ${this.deliveryQueue.length}/${this.config.maxQueueSize}`);
    }
  }

  private calculateThroughput(): void {
    const now = Date.now();
    const timeDiff = now - this.throughputStartTime;
    const messageCount = this.metrics.throughputMessageCount;

    if (timeDiff > 0) {
      this.metrics.throughput = messageCount / (timeDiff / 1000);
    }

    this.throughputStartTime = now;
    this.metrics.throughputMessageCount = 0;
  }

  // Public methods
  async getQueueStatus(): Promise<{
    queueSize: number;
    pendingDeliveries: number;
    throughput: number;
    lastProcessTime: number;
  }> {
    return {
      queueSize: this.deliveryQueue.length,
      pendingDeliveries: this.pendingDeliveries.size,
      throughput: this.metrics.throughput,
      lastProcessTime: this.deliveryQueue[0]?.timestamp || Date.now()
    };
  }

  async flush(): Promise<void> {
    // Wait for all pending deliveries to complete
    while (this.pendingDeliveries.size > 0) {
      await this.sleep(100);
    }
  }

  async getMetrics(): Promise<{
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    retries: number;
    timeouts: number;
    successRate: number;
    retryRate: number;
    timeoutRate: number;
    throughput: number;
  }> {
    const total = this.metrics.totalDeliveries;

    return {
      totalDeliveries: total,
      successfulDeliveries: this.metrics.successfulDeliveries,
      failedDeliveries: this.metrics.failedDeliveries,
      retries: this.metrics.retries,
      timeouts: this.metrics.timeouts,
      successRate: total > 0 ? this.metrics.successfulDeliveries / total : 0,
      retryRate: total > 0 ? this.metrics.retries / total : 0,
      timeoutRate: total > 0 ? this.metrics.timeouts / total : 0,
      throughput: this.metrics.throughput
    };
  }

  async resetMetrics(): void {
    this.metrics = {
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      retries: 0,
      timeouts: 0,
      queueSize: this.deliveryQueue.length,
      throughput: 0
    };
  }

  async close(): Promise<void> {
    // Wait for all pending deliveries to complete
    await this.flush();
  }
}