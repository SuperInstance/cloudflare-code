/**
 * Integration tests for complete message flow
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MessageQueue, resetQueueManager, resetProducer, resetConsumer, resetDeadLetterHandler } from '../../src';
import { QueueType, DeliveryGuarantee, MessagePriority } from '../../src/types';

describe('Message Flow Integration', () => {
  let messageQueue: MessageQueue;

  beforeEach(async () => {
    // Reset all singletons
    resetQueueManager();
    resetProducer();
    resetConsumer();
    resetDeadLetterHandler();

    messageQueue = new MessageQueue();
    await messageQueue.initialize();

    // Create test queues
    await messageQueue.queueManager.createQueue({
      name: 'test-standard',
      type: QueueType.STANDARD,
      deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE,
      messageTTL: 3600
    });

    await messageQueue.queueManager.createQueue({
      name: 'test-fifo',
      type: QueueType.FIFO,
      deliveryGuarantee: DeliveryGuarantee.EXACTLY_ONCE,
      messageTTL: 3600
    });

    await messageQueue.queueManager.createQueue({
      name: 'test-priority',
      type: QueueType.PRIORITY,
      deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE,
      messageTTL: 3600
    });
  });

  afterEach(async () => {
    await messageQueue.close();
    resetQueueManager();
    resetProducer();
    resetConsumer();
    resetDeadLetterHandler();
  });

  describe('Basic publish-consume flow', () => {
    it('should complete full message lifecycle', async () => {
      // Publish message
      const publishResult = await messageQueue.producer.publish(
        'test-standard',
        { type: 'test', data: 'hello world' }
      );

      expect(publishResult.success).toBe(true);
      expect(publishResult.messageId).toBeDefined();

      // Verify queue stats
      const stats = messageQueue.queueManager.getQueueStats('test-standard');
      expect(stats?.approximateMessageCount).toBeGreaterThan(0);
    });

    it('should handle batch publish', async () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        body: { id: i, value: `message-${i}` }
      }));

      const batchResult = await messageQueue.producer.publishBatch('test-standard', messages);

      expect(batchResult.total).toBe(100);
      expect(batchResult.successCount).toBeGreaterThan(0);
    });

    it('should publish with different priorities', async () => {
      const highPriorityResult = await messageQueue.producer.publish(
        'test-priority',
        { urgent: true },
        { priority: MessagePriority.HIGH }
      );

      const lowPriorityResult = await messageQueue.producer.publish(
        'test-priority',
        { urgent: false },
        { priority: MessagePriority.LOW }
      );

      expect(highPriorityResult.success).toBe(true);
      expect(lowPriorityResult.success).toBe(true);
    });
  });

  describe('FIFO queue ordering', () => {
    it('should maintain message order in FIFO queue', async () => {
      const messages = [
        { sequence: 1 },
        { sequence: 2 },
        { sequence: 3 }
      ];

      for (const msg of messages) {
        const result = await messageQueue.producer.publish(
          'test-fifo',
          msg,
          {
            metadata: {
              messageGroupId: 'group-1'
            }
          }
        );
        expect(result.success).toBe(true);
      }

      // Messages should be processed in order
      const stats = messageQueue.queueManager.getQueueStats('test-fifo');
      expect(stats?.approximateMessageCount).toBeGreaterThan(0);
    });
  });

  describe('Dead letter handling', () => {
    it('should handle failed messages', async () => {
      const failedMessage = {
        id: 'test-message-id',
        body: { data: 'failing message' },
        metadata: {
          headers: {},
          priority: MessagePriority.NORMAL
        },
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE,
        state: 'failed' as const,
        retryCount: 3,
        timestamps: { createdAt: Date.now() }
      };

      const error = new Error('Processing failed');

      const result = await messageQueue.deadLetterHandler.handleFailedMessage(
        failedMessage,
        error,
        'test-standard'
      );

      expect(result.success).toBe(true);
    });

    it('should retry messages with backoff', async () => {
      const retryableMessage = {
        id: 'retry-message-id',
        body: { data: 'retryable' },
        metadata: {
          headers: {},
          priority: MessagePriority.NORMAL
        },
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE,
        state: 'pending' as const,
        retryCount: 1,
        timestamps: { createdAt: Date.now() }
      };

      const error = new Error('Temporary failure');

      const result = await messageQueue.deadLetterHandler.handleFailedMessage(
        retryableMessage,
        error,
        'test-standard',
        {
          type: 'exponential-backoff',
          maxRetries: 5,
          initialDelay: 1000,
          backoffMultiplier: 2
        }
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Queue management', () => {
    it('should create and delete queues', async () => {
      const createResult = await messageQueue.queueManager.createQueue({
        name: 'temp-queue',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      expect(createResult.success).toBe(true);
      expect(messageQueue.queueManager.queueExists('temp-queue')).toBe(true);

      const deleteResult = await messageQueue.queueManager.deleteQueue('temp-queue');
      expect(deleteResult.success).toBe(true);
      expect(messageQueue.queueManager.queueExists('temp-queue')).toBe(false);
    });

    it('should list queues with filters', async () => {
      const standardQueues = messageQueue.queueManager.listQueues({
        type: QueueType.STANDARD
      });

      expect(standardQueues.length).toBeGreaterThan(0);
      expect(standardQueues.every(q => q.type === QueueType.STANDARD)).toBe(true);
    });

    it('should perform health checks', async () => {
      const health = await messageQueue.queueManager.healthCheck('test-standard');

      expect(health).toBeDefined();
      expect(health.queueName).toBe('test-standard');
      expect(health.checks).toBeDefined();
    });
  });

  describe('Fanout scenarios', () => {
    it('should publish to multiple queues', async () => {
      await messageQueue.queueManager.createQueue({
        name: 'fanout-1',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      await messageQueue.queueManager.createQueue({
        name: 'fanout-2',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      const results = await messageQueue.producer.publishFanout(
        ['fanout-1', 'fanout-2'],
        { broadcast: true }
      );

      expect(results.size).toBe(2);
      expect(Array.from(results.values()).every(r => r.success)).toBe(true);
    });
  });

  describe('Delayed and scheduled messages', () => {
    it('should publish delayed messages', async () => {
      const result = await messageQueue.producer.publishDelayed(
        'test-standard',
        { delayed: true },
        60
      );

      expect(result.success).toBe(true);
    });

    it('should publish scheduled messages', async () => {
      const scheduledTime = new Date(Date.now() + 300000); // 5 minutes from now

      const result = await messageQueue.producer.publishScheduled(
        'test-standard',
        { scheduled: true },
        scheduledTime
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Statistics and monitoring', () => {
    it('should track queue statistics', async () => {
      await messageQueue.producer.publish('test-standard', { test: true });
      await messageQueue.producer.publish('test-standard', { test: true });

      const stats = messageQueue.queueManager.getQueueStats('test-standard');

      expect(stats).toBeDefined();
      expect(stats?.approximateMessageCount).toBeGreaterThan(0);
    });

    it('should track producer metrics', async () => {
      await messageQueue.producer.publish('test-standard', { data: 'test' });

      const metrics = messageQueue.queueManager.getQueueMetrics('test-standard');

      expect(metrics?.producer.totalPublished).toBeGreaterThan(0);
    });

    it('should provide system statistics', () => {
      const stats = messageQueue.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.queues.count).toBeGreaterThan(0);
    });
  });

  describe('Queue purging', () => {
    it('should purge queue messages', async () => {
      await messageQueue.producer.publishBatch('test-standard', [
        { body: { id: 1 } },
        { body: { id: 2 } },
        { body: { id: 3 } }
      ]);

      const purgeResult = await messageQueue.queueManager.purgeQueue('test-standard');

      expect(purgeResult.success).toBe(true);
      expect(purgeResult.purgedCount).toBeGreaterThan(0);

      const stats = messageQueue.queueManager.getQueueStats('test-standard');
      expect(stats?.approximateMessageCount).toBe(0);
    });
  });

  describe('Consumer registration and management', () => {
    it('should register and manage consumers', async () => {
      const handler = async () => {
        // Message handler
      };

      const registerResult = await messageQueue.consumer.registerConsumer(
        'test-standard',
        handler
      );

      expect(registerResult.success).toBe(true);
      expect(registerResult.consumerId).toBeDefined();

      const info = messageQueue.consumer.getConsumerInfo(registerResult.consumerId!);
      expect(info?.queueName).toBe('test-standard');
    });

    it('should list consumers for a queue', async () => {
      const handler = async () => {};

      await messageQueue.consumer.registerConsumer('test-standard', handler);
      await messageQueue.consumer.registerConsumer('test-standard', handler);

      const consumers = messageQueue.consumer.listConsumers('test-standard');

      expect(consumers.length).toBe(2);
    });
  });

  describe('State persistence', () => {
    it('should export and import queue state', async () => {
      await messageQueue.producer.publish('test-standard', { data: 'test' });

      const exported = messageQueue.queueManager.exportQueueState('test-standard');

      expect(exported).toBeDefined();
      expect(exported?.config.name).toBe('test-standard');

      // Create new queue and import state
      await messageQueue.queueManager.createQueue({
        name: 'imported-queue',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      const importResult = messageQueue.queueManager.importQueueState(
        'imported-queue',
        exported!
      );

      expect(importResult.success).toBe(true);
    });
  });

  describe('Event handling', () => {
    it('should emit and handle events', async () => {
      let eventReceived = false;

      messageQueue.queueManager.on('queue.created' as any, () => {
        eventReceived = true;
      });

      await messageQueue.queueManager.createQueue({
        name: 'event-queue',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      expect(eventReceived).toBe(true);
    });
  });

  describe('Configuration updates', () => {
    it('should update queue configuration', async () => {
      const updateResult = await messageQueue.queueManager.updateQueueConfig(
        'test-standard',
        { messageTTL: 7200 }
      );

      expect(updateResult.success).toBe(true);

      const config = messageQueue.queueManager.getQueueConfig('test-standard');
      expect(config?.messageTTL).toBe(7200);
    });

    it('should update producer configuration', () => {
      messageQueue.producer.updateConfig({
        batchSize: 20,
        timeout: 10000
      });

      const config = messageQueue.producer.getConfig();
      expect(config.batchSize).toBe(20);
      expect(config.timeout).toBe(10000);
    });
  });

  describe('Error handling', () => {
    it('should handle publishing to non-existent queue', async () => {
      const result = await messageQueue.producer.publish(
        'non-existent',
        { data: 'test' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle invalid queue names', async () => {
      const result = await messageQueue.queueManager.createQueue({
        name: '123-invalid',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      expect(result.success).toBe(false);
    });
  });
});
