/**
 * ClaudeFlare Message Queue
 * Advanced message queue system for distributed AI coding platform
 *
 * @package @claudeflare/message-queue
 * @version 1.0.0
 */

// Export types
export * from './types';

// Export queue manager
export {
  QueueManager,
  getQueueManager,
  resetQueueManager
} from './queue/manager';

// Export producer
export {
  MessageProducer,
  createProducer,
  getProducer,
  resetProducer
} from './producer/producer';

// Export consumer
export {
  MessageConsumer,
  createConsumer,
  getConsumer,
  resetConsumer,
  consumeMessages,
  consumeMessageBatches
} from './consumer/consumer';

// Export dead letter handler
export {
  DeadLetterHandler,
  RecoveryStrategy,
  createDeadLetterHandler,
  getDeadLetterHandler,
  resetDeadLetterHandler,
  handleFailedMessage,
  recoverDeadLetterEntry,
  listDeadLetterEntries,
  getDeadLetterStatistics
} from './deadletter/handler';

// Export utilities
export {
  generateMessageId,
  generateQueueId,
  generateCorrelationId,
  generateCausationId,
  generateMessageGroupId,
  generateDeduplicationId,
  generateConsumerId,
  generateSequenceNumber,
  generateReceiptHandle,
  parseReceiptHandle,
  verifyReceiptHandle,
  generateBatchId,
  generateDeadLetterId,
  generateEventId,
  generateHealthCheckId,
  generateBulkMessageIds,
  validateId,
  extractTimestampFromId
} from './utils/id-generator';

export {
  validateMessage,
  validateMessageBody,
  validateMessageMetadata,
  validateHeaders,
  validateMessageTimestamps,
  validateQueueName,
  validateBatchSize,
  validateTimeout,
  validateVisibilityTimeout,
  validatePriorityOrder,
  validateDeliveryGuaranteeCompatibility
} from './utils/message-validator';

export {
  calculateRetryDelay,
  shouldRetry,
  isNonRetryableError,
  calculateNextRetryTimestamp,
  DefaultRetryPolicies,
  createRetryPolicy,
  addFullJitter,
  addEqualJitter,
  addDecorrelatedJitter,
  calculateRetryDelayWithJitter,
  createRetryState,
  updateRetryState,
  calculateTotalRetryDuration,
  estimateTimeUntilNextRetry
} from './utils/retry-calculator';

export {
  compressData,
  decompressData,
  compressMessage,
  decompressMessage,
  compressBatch,
  calculateCompressionRatio,
  estimateCompressionBenefit,
  chooseCompressionAlgorithm,
  validateCompressedData,
  calculateSizeSavings,
  DefaultCompressionOptions
} from './utils/compression';

// Version
export const VERSION = '1.0.0';

/**
 * Create a complete message queue system
 */
export function createMessageQueue() {
  return {
    queueManager: getQueueManager(),
    producer: getProducer(),
    consumer: getConsumer(),
    deadLetterHandler: getDeadLetterHandler()
  };
}

/**
 * Message queue factory
 */
export class MessageQueue {
  public readonly queueManager = getQueueManager();
  public readonly producer = getProducer();
  public readonly consumer = getConsumer();
  public readonly deadLetterHandler = getDeadLetterHandler();

  /**
   * Initialize the message queue system
   */
  async initialize(): Promise<void> {
    // Initialization logic if needed
  }

  /**
   * Close the message queue system
   */
  async close(): Promise<void> {
    await this.producer.close();
    await this.consumer.close();
    await this.deadLetterHandler.close();
  }

  /**
   * Get system statistics
   */
  getStatistics() {
    return {
      queues: {
        count: this.queueManager.getQueueCount(),
        totalMessages: this.queueManager.getTotalMessageCount()
      },
      deadLetters: this.deadLetterHandler.getStatistics()
    };
  }
}

// Default export
export default MessageQueue;
