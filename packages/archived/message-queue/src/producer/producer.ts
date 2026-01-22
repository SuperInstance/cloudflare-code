// @ts-nocheck
/**
 * Message Producer
 * Handles message publishing, batching, and routing
 */

import type {
  Message,
  MessageMetadata,
  PublishResult,
  BatchPublishResult,
  ProducerConfig,
  QueueConfig,
  DeliveryGuarantee,
  MessagePriority
} from '../types';
import {
  MessageState,
  DeliveryGuarantee as DeliveryGuaranteeEnum,
  QueueEventType
} from '../types';
import { generateMessageId, generateCorrelationId, generateSequenceNumber, generateBatchId } from '../utils/id-generator';
import { validateMessage } from '../utils/message-validator';
import { compressMessage, DefaultCompressionOptions } from '../utils/compression';
import { getQueueManager } from '../queue/manager';

/**
 * Producer class for publishing messages
 */
export class MessageProducer {
  private config: ProducerConfig;
  private queueManager: ReturnType<typeof getQueueManager>;
  private pendingMessages: Map<string, Message[]> = new Map();
  private publishPromises: Map<string, Promise<PublishResult>[]> = new Map();

  constructor(config: ProducerConfig = {}) {
    this.config = {
      enableConfirms: config.enableConfirms ?? true,
      batchSize: config.batchSize ?? 10,
      compressionEnabled: config.compressionEnabled ?? true,
      timeout: config.timeout ?? 5000,
      maxRetries: config.maxRetries ?? 3
    };
    this.queueManager = getQueueManager();
  }

  /**
   * Publish a single message
   */
  async publish<T = unknown>(
    queueName: string,
    body: T,
    options?: {
      metadata?: Partial<MessageMetadata>;
      deliveryGuarantee?: DeliveryGuarantee;
      priority?: MessagePriority;
    }
  ): Promise<PublishResult> {
    const startTime = Date.now();
    let attempt = 0;

    while (attempt <= (this.config.maxRetries ?? 0)) {
      try {
        // Validate queue exists
        if (!this.queueManager.queueExists(queueName)) {
          return {
            messageId: '',
            success: false,
            error: new Error(`Queue '${queueName}' does not exist`)
          };
        }

        // Get queue config
        const queueConfig = this.queueManager.getQueueConfig(queueName);
        if (!queueConfig) {
          return {
            messageId: '',
            success: false,
            error: new Error(`Queue '${queueName}' configuration not found`)
          };
        }

        // Generate message ID
        const messageId = generateMessageId();

        // Create metadata
        const metadata: MessageMetadata = {
          priority: options?.priority ?? 1, // Default to NORMAL priority
          headers: options?.metadata?.headers ?? {},
          contentType: options?.metadata?.contentType ?? 'application/json',
          correlationId: options?.metadata?.correlationId ?? generateCorrelationId(),
          messageGroupId: options?.metadata?.messageGroupId,
          messageDeduplicationId: options?.metadata?.messageDeduplicationId,
          ttl: options?.metadata?.ttl ?? queueConfig.messageTTL,
          delay: options?.metadata?.delay ?? queueConfig.deliveryDelay,
          schemaVersion: options?.metadata?.schemaVersion,
          causationId: options?.metadata?.causationId
        };

        // Create message
        const message: Message<T> = {
          id: messageId,
          body,
          metadata,
          deliveryGuarantee: options?.deliveryGuarantee ?? queueConfig.deliveryGuarantee,
          state: MessageState.PENDING,
          retryCount: 0,
          timestamps: {
            createdAt: Date.now(),
            enqueuedAt: Date.now()
          }
        };

        // Validate message
        const validation = validateMessage(message);
        if (!validation.valid) {
          return {
            messageId,
            success: false,
            error: new Error(`Message validation failed: ${validation.errors.map(e => e.message).join(', ')}`)
          };
        }

        // Compress message if enabled
        let compressedBody = body;
        let compressionUsed = false;
        if (this.config.compressionEnabled) {
          try {
            const compressionResult = await compressMessage(body, DefaultCompressionOptions);
            if (compressionResult.ratio < 0.9) { // Only use compression if beneficial
              compressedBody = compressionResult.compressed as unknown as T;
              compressionUsed = true;
              message.metadata.headers['x-compression'] = compressionResult.algorithm;
            }
          } catch (error) {
            // Continue without compression if it fails
            console.warn('Compression failed, sending uncompressed:', error);
          }
        }

        // Update message body with compressed version
        if (compressionUsed) {
          message.body = compressedBody;
        }

        // Add to queue (in real implementation, this would use Cloudflare Queues)
        const publishSuccess = await this.addToQueue(queueName, message);

        if (publishSuccess) {
          // Update queue state
          this.queueManager.incrementMessageCount(queueName);

          // Update metrics
          const metrics = this.queueManager.getQueueMetrics(queueName);
          if (metrics) {
            metrics.producer.totalPublished++;
            metrics.producer.bytesPublished += JSON.stringify(body).length;
            metrics.producer.averageLatency = (metrics.producer.averageLatency * (metrics.producer.totalPublished - 1) + (Date.now() - startTime)) / metrics.producer.totalPublished;
            metrics.producer.successRate = (metrics.producer.totalPublished - metrics.errors.totalErrors) / metrics.producer.totalPublished;
            this.queueManager.updateMetrics(queueName, metrics);
          }

          // Emit event
          await this.emitPublishEvent(queueName, message);

          // Generate sequence number for FIFO queues
          let sequenceNumber: string | undefined;
          if (queueConfig.type === 'fifo') {
            sequenceNumber = generateSequenceNumber();
          }

          return {
            messageId,
            sequenceNumber,
            success: true
          };
        } else {
          throw new Error('Failed to add message to queue');
        }
      } catch (error) {
        attempt++;

        if (attempt > (this.config.maxRetries ?? 0)) {
          // Record error in metrics
          const metrics = this.queueManager.getQueueMetrics(queueName);
          if (metrics) {
            metrics.errors.totalErrors++;
            metrics.errors.errorRate = metrics.errors.totalErrors / (metrics.producer.totalPublished + 1);
            metrics.errors.recentErrors.push({
              type: 'publish_failed',
              message: error instanceof Error ? error.message : 'Unknown error',
              timestamp: Date.now()
            });
            // Keep only last 100 errors
            if (metrics.errors.recentErrors.length > 100) {
              metrics.errors.recentErrors.shift();
            }
            this.queueManager.updateMetrics(queueName, metrics);
          }

          return {
            messageId: '',
            success: false,
            error: error instanceof Error ? error : new Error('Unknown error')
          };
        }

        // Exponential backoff before retry
        await this.delay(Math.pow(2, attempt) * 100);
      }
    }

    return {
      messageId: '',
      success: false,
      error: new Error('Max retries exceeded')
    };
  }

  /**
   * Publish multiple messages in a batch
   */
  async publishBatch<T = unknown>(
    queueName: string,
    messages: Array<{
      body: T;
      metadata?: Partial<MessageMetadata>;
      priority?: MessagePriority;
    }>
  ): Promise<BatchPublishResult> {
    const batchId = generateBatchId();
    const results: PublishResult[] = [];
    const successful: PublishResult[] = [];
    const failed: PublishResult[] = [];

    // Process messages in parallel batches
    const batchSize = this.config.batchSize ?? 10;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(msg =>
          this.publish(queueName, msg.body, {
            metadata: msg.metadata,
            priority: msg.priority
          })
        )
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          if (result.value.success) {
            successful.push(result.value);
          } else {
            failed.push(result.value);
          }
        } else {
          const errorResult: PublishResult = {
            messageId: '',
            success: false,
            error: result.reason instanceof Error ? result.reason : new Error('Unknown error')
          };
          results.push(errorResult);
          failed.push(errorResult);
        }
      }
    }

    return {
      successful,
      failed,
      total: results.length,
      successCount: successful.length,
      failureCount: failed.length
    };
  }

  /**
   * Publish message with publisher confirms
   */
  async publishWithConfirm<T = unknown>(
    queueName: string,
    body: T,
    options?: {
      metadata?: Partial<MessageMetadata>;
      deliveryGuarantee?: DeliveryGuarantee;
      priority?: MessagePriority;
      timeout?: number;
    }
  ): Promise<PublishResult> {
    if (!this.config.enableConfirms) {
      return this.publish(queueName, body, options);
    }

    const timeout = options?.timeout ?? this.config.timeout ?? 5000;
    const publishPromise = this.publish(queueName, body, options);

    // Race between publish and timeout
    const result = await Promise.race([
      publishPromise,
      this.createTimeoutPromise(timeout)
    ]);

    return result;
  }

  /**
   * Publish message to multiple queues (fanout)
   */
  async publishFanout<T = unknown>(
    queueNames: string[],
    body: T,
    options?: {
      metadata?: Partial<MessageMetadata>;
      deliveryGuarantee?: DeliveryGuarantee;
      priority?: MessagePriority;
    }
  ): Promise<Map<string, PublishResult>> {
    const results = new Map<string, PublishResult>();

    await Promise.all(
      queueNames.map(async queueName => {
        const result = await this.publish(queueName, body, options);
        results.set(queueName, result);
      })
    );

    return results;
  }

  /**
   * Publish delayed message
   */
  async publishDelayed<T = unknown>(
    queueName: string,
    body: T,
    delaySeconds: number,
    options?: {
      metadata?: Partial<MessageMetadata>;
      priority?: MessagePriority;
    }
  ): Promise<PublishResult> {
    return this.publish(queueName, body, {
      ...options,
      metadata: {
        ...options?.metadata,
        delay: delaySeconds
      }
    });
  }

  /**
   * Publish scheduled message
   */
  async publishScheduled<T = unknown>(
    queueName: string,
    body: T,
    scheduledTime: Date,
    options?: {
      metadata?: Partial<MessageMetadata>;
      priority?: MessagePriority;
    }
  ): Promise<PublishResult> {
    const delaySeconds = Math.max(0, Math.floor((scheduledTime.getTime() - Date.now()) / 1000));
    return this.publishDelayed(queueName, body, delaySeconds, options);
  }

  /**
   * Get pending message count for a queue
   */
  getPendingCount(queueName: string): number {
    const pending = this.pendingMessages.get(queueName);
    return pending?.length ?? 0;
  }

  /**
   * Flush pending messages
   */
  async flushPending(queueName: string): Promise<void> {
    const pending = this.pendingMessages.get(queueName);
    if (pending && pending.length > 0) {
      await this.publishBatch(queueName, pending.map(msg => ({ body: msg.body })));
      this.pendingMessages.delete(queueName);
    }
  }

  /**
   * Add message to pending batch
   */
  addPending<T = unknown>(queueName: string, message: Message<T>): void {
    if (!this.pendingMessages.has(queueName)) {
      this.pendingMessages.set(queueName, []);
    }
    this.pendingMessages.get(queueName)!.push(message);

    // Auto-flush if batch size reached
    const batchSize = this.config.batchSize ?? 10;
    if (this.pendingMessages.get(queueName)!.length >= batchSize) {
      this.flushPending(queueName);
    }
  }

  /**
   * Update producer configuration
   */
  updateConfig(updates: Partial<ProducerConfig>): void {
    this.config = {
      ...this.config,
      ...updates
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): ProducerConfig {
    return { ...this.config };
  }

  /**
   * Close producer and cleanup resources
   */
  async close(): Promise<void> {
    // Flush all pending messages
    const flushPromises: Promise<void>[] = [];
    for (const queueName of this.pendingMessages.keys()) {
      flushPromises.push(this.flushPending(queueName));
    }
    await Promise.all(flushPromises);

    // Clear data structures
    this.pendingMessages.clear();
    this.publishPromises.clear();
  }

  /**
   * Add message to queue (internal implementation)
   */
  private async addToQueue<T>(queueName: string, message: Message<T>): Promise<boolean> {
    // In a real implementation, this would use Cloudflare Queues API
    // For now, we'll simulate it with a simple in-memory structure
    try {
      // Simulate network delay
      await this.delay(Math.random() * 10);

      // In production, this would be:
      // const queue = env QUEUE_BINDING;
      // await queue.send(message);

      return true;
    } catch (error) {
      console.error('Failed to add message to queue:', error);
      return false;
    }
  }

  /**
   * Emit publish event
   */
  private async emitPublishEvent<T>(queueName: string, message: Message<T>): Promise<void> {
    // Event emission would be handled by queue manager
    // This is a placeholder for event tracking
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise<T>(timeoutMs: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), timeoutMs);
    });
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate message size
   */
  private calculateMessageSize(message: Message): number {
    return new Blob([JSON.stringify(message)]).size;
  }

  /**
   * Validate message size
   */
  private validateMessageSize(message: Message, maxSize: number): boolean {
    const size = this.calculateMessageSize(message);
    return size <= maxSize;
  }

  /**
   * Get producer statistics
   */
  getStats(queueName: string): {
    totalPublished: number;
    successRate: number;
    averageLatency: number;
    pendingCount: number;
  } {
    const metrics = this.queueManager.getQueueMetrics(queueName);
    return {
      totalPublished: metrics?.producer.totalPublished ?? 0,
      successRate: metrics?.producer.successRate ?? 1,
      averageLatency: metrics?.producer.averageLatency ?? 0,
      pendingCount: this.getPendingCount(queueName)
    };
  }

  /**
   * Reset statistics
   */
  resetStats(queueName: string): void {
    this.queueManager.resetMetrics(queueName);
  }
}

/**
 * Create a new message producer
 */
export function createProducer(config?: ProducerConfig): MessageProducer {
  return new MessageProducer(config);
}

/**
 * Global producer instance
 */
let globalProducer: MessageProducer | null = null;

/**
 * Get or create global producer
 */
export function getProducer(config?: ProducerConfig): MessageProducer {
  if (!globalProducer) {
    globalProducer = new MessageProducer(config);
  }
  return globalProducer;
}

/**
 * Reset global producer (useful for testing)
 */
export function resetProducer(): void {
  if (globalProducer) {
    globalProducer.close();
    globalProducer = null;
  }
}
