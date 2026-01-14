/**
 * Message Consumer
 * Handles message consumption, acknowledgment, and processing
 */

import type {
  Message,
  MessageHandler,
  BatchMessageHandler,
  ReceiveResult,
  AckResult,
  QueueConfig,
  ConsumerConfig
} from '../types';
import {
  MessageState,
  QueueEventType
} from '../types';
import { generateReceiptHandle, generateConsumerId, parseReceiptHandle, verifyReceiptHandle } from '../utils/id-generator';
import { validateMessage } from '../utils/message-validator';
import { decompressMessage } from '../utils/compression';
import { getQueueManager } from '../queue/manager';

/**
 * Consumer registration
 */
interface ConsumerRegistration {
  id: string;
  queueName: string;
  groupName?: string;
  handler: MessageHandler;
  batchHandler?: BatchMessageHandler;
  registeredAt: number;
  lastActivityAt: number;
  isActive: boolean;
  config: ConsumerConfig;
}

/**
 * Message processing state
 */
interface ProcessingMessage {
  message: Message;
  receiptHandle: string;
  receivedAt: number;
  timeout: number;
  visibilityTimeoutId?: NodeJS.Timeout;
}

/**
 * Message Consumer class
 */
export class MessageConsumer {
  private queueManager: ReturnType<typeof getQueueManager>;
  private registrations: Map<string, ConsumerRegistration> = new Map();
  private processingMessages: Map<string, ProcessingMessage> = new Map();
  private isRunning: Map<string, boolean> = new Map();
  private pollIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.queueManager = getQueueManager();
  }

  /**
   * Register a consumer for a queue
   */
  async registerConsumer<T = unknown>(
    queueName: string,
    handler: MessageHandler<T>,
    config?: ConsumerConfig
  ): Promise<{
    success: boolean;
    consumerId?: string;
    error?: string;
  }> {
    try {
      // Validate queue exists
      if (!this.queueManager.queueExists(queueName)) {
        return {
          success: false,
          error: `Queue '${queueName}' does not exist`
        };
      }

      const consumerId = generateConsumerId(queueName);
      const registration: ConsumerRegistration = {
        id: consumerId,
        queueName,
        groupName: config?.groupName,
        handler,
        registeredAt: Date.now(),
        lastActivityAt: Date.now(),
        isActive: true,
        config: config || {}
      };

      this.registrations.set(consumerId, registration);

      // Update metrics
      const metrics = this.queueManager.getQueueMetrics(queueName);
      if (metrics) {
        metrics.consumer.activeConsumers++;
        this.queueManager.updateMetrics(queueName, metrics);
      }

      // Emit consumer registered event
      await this.emitEvent(QueueEventType.CONSUMER_REGISTERED, {
        queueName,
        consumerId,
        config
      });

      return {
        success: true,
        consumerId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Register a batch consumer
   */
  async registerBatchConsumer<T = unknown>(
    queueName: string,
    handler: BatchMessageHandler<T>,
    config?: ConsumerConfig
  ): Promise<{
    success: boolean;
    consumerId?: string;
    error?: string;
  }> {
    try {
      const consumerId = generateConsumerId(queueName);
      const registration: ConsumerRegistration = {
        id: consumerId,
        queueName,
        groupName: config?.groupName,
        handler: async () => {}, // Placeholder
        batchHandler: handler,
        registeredAt: Date.now(),
        lastActivityAt: Date.now(),
        isActive: true,
        config: config || {}
      };

      this.registrations.set(consumerId, registration);

      return {
        success: true,
        consumerId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Deregister a consumer
   */
  async deregisterConsumer(consumerId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const registration = this.registrations.get(consumerId);
      if (!registration) {
        return {
          success: false,
          error: `Consumer '${consumerId}' not found`
        };
      }

      // Stop consumer if running
      if (this.isRunning.get(consumerId)) {
        await this.stopConsumer(consumerId);
      }

      // Update metrics
      const metrics = this.queueManager.getQueueMetrics(registration.queueName);
      if (metrics) {
        metrics.consumer.activeConsumers--;
        this.queueManager.updateMetrics(registration.queueName, metrics);
      }

      // Remove registration
      this.registrations.delete(consumerId);

      // Emit consumer deregistered event
      await this.emitEvent(QueueEventType.CONSUMER_DEREGISTERED, {
        queueName: registration.queueName,
        consumerId
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Start consuming messages
   */
  async startConsumer(consumerId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const registration = this.registrations.get(consumerId);
      if (!registration) {
        return {
          success: false,
          error: `Consumer '${consumerId}' not found`
        };
      }

      if (this.isRunning.get(consumerId)) {
        return {
          success: false,
          error: `Consumer '${consumerId}' is already running`
        };
      }

      this.isRunning.set(consumerId, true);

      // Start polling loop
      const pollInterval = setInterval(async () => {
        await this.pollMessages(consumerId);
      }, 1000); // Poll every second

      this.pollIntervals.set(consumerId, pollInterval);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Stop consuming messages
   */
  async stopConsumer(consumerId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const registration = this.registrations.get(consumerId);
      if (!registration) {
        return {
          success: false,
          error: `Consumer '${consumerId}' not found`
        };
      }

      // Stop polling
      const interval = this.pollIntervals.get(consumerId);
      if (interval) {
        clearInterval(interval);
        this.pollIntervals.delete(consumerId);
      }

      this.isRunning.set(consumerId, false);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Receive messages from a queue
   */
  async receive<T = unknown>(
    queueName: string,
    options?: {
      maxMessages?: number;
      waitTime?: number;
      visibilityTimeout?: number;
    }
  ): Promise<ReceiveResult<T>> {
    try {
      const maxMessages = options?.maxMessages ?? 1;
      const waitTime = options?.waitTime ?? 0;
      const visibilityTimeout = options?.visibilityTimeout ?? 30;

      // Validate queue exists
      if (!this.queueManager.queueExists(queueName)) {
        return {
          messages: [],
          receiptHandles: []
        };
      }

      // Get queue config
      const queueConfig = this.queueManager.getQueueConfig(queueName);
      if (!queueConfig) {
        return {
          messages: [],
          receiptHandles: []
        };
      }

      // Simulate receiving messages (in production, use Cloudflare Queues)
      const messages: Message<T>[] = [];
      const receiptHandles: string[] = [];

      // In production, this would be:
      // const batch = await queue.batchMessages(maxMessages, waitTime);
      // for (const msg of batch) { ... }

      // For now, return empty results
      // The actual implementation would fetch from the queue

      return {
        messages,
        receiptHandles
      };
    } catch (error) {
      console.error('Failed to receive messages:', error);
      return {
        messages: [],
        receiptHandles: []
      };
    }
  }

  /**
   * Acknowledge a message
   */
  async acknowledge(
    queueName: string,
    receiptHandle: string
  ): Promise<AckResult> {
    try {
      // Verify receipt handle
      if (!verifyReceiptHandle(receiptHandle)) {
        return {
          success: false,
          messageId: '',
          error: new Error('Invalid receipt handle')
        };
      }

      const parsed = parseReceiptHandle(receiptHandle);
      if (!parsed) {
        return {
          success: false,
          messageId: '',
          error: new Error('Failed to parse receipt handle')
        };
      }

      // Remove from processing
      this.processingMessages.delete(receiptHandle);

      // Update queue state
      this.queueManager.decrementMessageCount(queueName);
      this.queueManager.incrementProcessedCount(queueName);

      // Update metrics
      const metrics = this.queueManager.getQueueMetrics(queueName);
      if (metrics) {
        metrics.consumer.totalConsumed++;
        const totalMessages = metrics.consumer.totalConsumed + metrics.errors.totalErrors;
        metrics.consumer.acknowledgmentRate = metrics.consumer.totalConsumed / totalMessages;
        this.queueManager.updateMetrics(queueName, metrics);
      }

      return {
        success: true,
        messageId: parsed.messageId
      };
    } catch (error) {
      return {
        success: false,
        messageId: '',
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }

  /**
   * Negative acknowledgment (reject message)
   */
  async negativeAcknowledge(
    queueName: string,
    receiptHandle: string,
    requeue: boolean = true
  ): Promise<AckResult> {
    try {
      const parsed = parseReceiptHandle(receiptHandle);
      if (!parsed) {
        return {
          success: false,
          messageId: '',
          error: new Error('Failed to parse receipt handle')
        };
      }

      // Remove from processing
      this.processingMessages.delete(receiptHandle);

      if (requeue) {
        // Message will be retried
        // Update queue state to make it visible again
        // In production, this would use the queue's visibility timeout mechanism
      } else {
        // Move to dead letter queue
        const queueConfig = this.queueManager.getQueueConfig(queueName);
        if (queueConfig?.deadLetterQueue) {
          // Move to DLQ
        }

        this.queueManager.incrementFailedCount(queueName);
      }

      return {
        success: true,
        messageId: parsed.messageId
      };
    } catch (error) {
      return {
        success: false,
        messageId: '',
        error: error instanceof Error ? error : new Error('Unknown error')
      };
    }
  }

  /**
   * Extend visibility timeout
   */
  async extendVisibilityTimeout(
    queueName: string,
    receiptHandle: string,
    additionalTimeout: number
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const processing = this.processingMessages.get(receiptHandle);
      if (!processing) {
        return {
          success: false,
          error: 'Message not found in processing'
        };
      }

      // Extend timeout
      processing.timeout += additionalTimeout;

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Poll for messages (internal)
   */
  private async pollMessages(consumerId: string): Promise<void> {
    const registration = this.registrations.get(consumerId);
    if (!registration || !this.isRunning.get(consumerId)) {
      return;
    }

    try {
      const batchSize = registration.config.batchSize ?? 1;
      const waitTime = registration.config.waitTimeSeconds ?? 0;

      // Check if batch handler exists
      if (registration.batchHandler) {
        await this.processBatchMessages(consumerId, batchSize);
      } else {
        await this.processSingleMessage(consumerId);
      }

      registration.lastActivityAt = Date.now();
    } catch (error) {
      console.error(`Error polling messages for consumer ${consumerId}:`, error);
    }
  }

  /**
   * Process single message
   */
  private async processSingleMessage(consumerId: string): Promise<void> {
    const registration = this.registrations.get(consumerId);
    if (!registration) return;

    const result = await this.receive(registration.queueName, {
      maxMessages: 1,
      waitTime: registration.config.waitTimeSeconds,
      visibilityTimeout: registration.config.timeout
    });

    if (result.messages.length > 0) {
      const message = result.messages[0];
      const receiptHandle = result.receiptHandles[0];

      try {
        // Decompress if needed
        if (message.metadata.headers['x-compression']) {
          message.body = await decompressMessage(
            message.body as unknown as Uint8Array,
            message.metadata.headers['x-compression']
          );
        }

        // Call handler
        await registration.handler(message);

        // Acknowledge on success
        await this.acknowledge(registration.queueName, receiptHandle);
      } catch (error) {
        // Negative acknowledge on failure
        await this.negativeAcknowledge(registration.queueName, receiptHandle, true);
      }
    }
  }

  /**
   * Process batch of messages
   */
  private async processBatchMessages(consumerId: string, batchSize: number): Promise<void> {
    const registration = this.registrations.get(consumerId);
    if (!registration || !registration.batchHandler) return;

    const result = await this.receive(registration.queueName, {
      maxMessages: batchSize,
      waitTime: registration.config.waitTimeSeconds,
      visibilityTimeout: registration.config.timeout
    });

    if (result.messages.length > 0) {
      try {
        // Decompress messages if needed
        for (const message of result.messages) {
          if (message.metadata.headers['x-compression']) {
            message.body = await decompressMessage(
              message.body as unknown as Uint8Array,
              message.metadata.headers['x-compression']
            );
          }
        }

        // Call batch handler
        await registration.batchHandler(result.messages);

        // Acknowledge all messages
        for (const receiptHandle of result.receiptHandles) {
          await this.acknowledge(registration.queueName, receiptHandle);
        }
      } catch (error) {
        // Negative acknowledge all messages on failure
        for (const receiptHandle of result.receiptHandles) {
          await this.negativeAcknowledge(registration.queueName, receiptHandle, true);
        }
      }
    }
  }

  /**
   * Emit event
   */
  private async emitEvent(eventType: QueueEventType, data: unknown): Promise<void> {
    // Event emission would be handled by queue manager
    // This is a placeholder for event tracking
  }

  /**
   * Get consumer info
   */
  getConsumerInfo(consumerId: string): {
    id: string;
    queueName: string;
    groupName?: string;
    isActive: boolean;
    isRunning: boolean;
    registeredAt: number;
    lastActivityAt: number;
  } | null {
    const registration = this.registrations.get(consumerId);
    if (!registration) return null;

    return {
      id: registration.id,
      queueName: registration.queueName,
      groupName: registration.groupName,
      isActive: registration.isActive,
      isRunning: this.isRunning.get(consumerId) ?? false,
      registeredAt: registration.registeredAt,
      lastActivityAt: registration.lastActivityAt
    };
  }

  /**
   * List all consumers for a queue
   */
  listConsumers(queueName: string): Array<{
    consumerId: string;
    groupName?: string;
    isActive: boolean;
    isRunning: boolean;
  }> {
    const consumers: Array<{
      consumerId: string;
      groupName?: string;
      isActive: boolean;
      isRunning: boolean;
    }> = [];

    for (const [id, registration] of this.registrations.entries()) {
      if (registration.queueName === queueName) {
        consumers.push({
          consumerId: id,
          groupName: registration.groupName,
          isActive: registration.isActive,
          isRunning: this.isRunning.get(id) ?? false
        });
      }
    }

    return consumers;
  }

  /**
   * Get consumer count
   */
  getConsumerCount(queueName?: string): number {
    if (queueName) {
      return this.listConsumers(queueName).length;
    }
    return this.registrations.size;
  }

  /**
   * Close all consumers
   */
  async close(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const consumerId of this.registrations.keys()) {
      closePromises.push(this.deregisterConsumer(consumerId));
    }

    await Promise.all(closePromises);

    // Clear all intervals
    for (const interval of this.pollIntervals.values()) {
      clearInterval(interval);
    }
    this.pollIntervals.clear();
  }
}

/**
 * Create a new message consumer
 */
export function createConsumer(): MessageConsumer {
  return new MessageConsumer();
}

/**
 * Global consumer instance
 */
let globalConsumer: MessageConsumer | null = null;

/**
 * Get or create global consumer
 */
export function getConsumer(): MessageConsumer {
  if (!globalConsumer) {
    globalConsumer = new MessageConsumer();
  }
  return globalConsumer;
}

/**
 * Reset global consumer (useful for testing)
 */
export function resetConsumer(): void {
  if (globalConsumer) {
    globalConsumer.close();
    globalConsumer = null;
  }
}

/**
 * Helper function to consume messages with automatic acknowledgment
 */
export async function consumeMessages<T = unknown>(
  queueName: string,
  handler: MessageHandler<T>,
  options?: {
    consumerConfig?: ConsumerConfig;
    autoStart?: boolean;
  }
): Promise<{
  success: boolean;
  consumerId?: string;
  error?: string;
}> {
  const consumer = getConsumer();
  const result = await consumer.registerConsumer(queueName, handler, options?.consumerConfig);

  if (result.success && result.consumerId && options?.autoStart) {
    await consumer.startConsumer(result.consumerId);
  }

  return result;
}

/**
 * Helper function to consume message batches
 */
export async function consumeMessageBatches<T = unknown>(
  queueName: string,
  handler: BatchMessageHandler<T>,
  options?: {
    consumerConfig?: ConsumerConfig;
    autoStart?: boolean;
  }
): Promise<{
  success: boolean;
  consumerId?: string;
  error?: string;
}> {
  const consumer = getConsumer();
  const result = await consumer.registerBatchConsumer(queueName, handler, options?.consumerConfig);

  if (result.success && result.consumerId && options?.autoStart) {
    await consumer.startConsumer(result.consumerId);
  }

  return result;
}
