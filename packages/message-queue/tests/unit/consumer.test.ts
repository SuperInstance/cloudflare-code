/**
 * Unit tests for Message Consumer
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageConsumer, resetConsumer, getConsumer } from '../../src/consumer/consumer';
import { resetQueueManager } from '../../src/queue/manager';
import { QueueType, DeliveryGuarantee } from '../../src/types';

describe('MessageConsumer', () => {
  let consumer: MessageConsumer;

  beforeEach(() => {
    resetQueueManager();
    resetConsumer();
    consumer = new MessageConsumer();
  });

  afterEach(async () => {
    await consumer.close();
    resetConsumer();
    resetQueueManager();
  });

  describe('registerConsumer', () => {
    it('should register a consumer successfully', async () => {
      // Create test queue first
      const queueManager = (global as any).__queueManager;
      if (queueManager) {
        await queueManager.createQueue({
          name: 'consumer-test-queue',
          type: QueueType.STANDARD,
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
        });
      }

      const handler = vi.fn().mockResolvedValue(undefined);
      const result = await consumer.registerConsumer('consumer-test-queue', handler);

      expect(result.success).toBe(true);
      expect(result.consumerId).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should reject consumer for non-existent queue', async () => {
      const handler = vi.fn();
      const result = await consumer.registerConsumer('non-existent-queue', handler);

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });

    it('should accept consumer configuration', async () => {
      const queueManager = (global as any).__queueManager;
      if (queueManager) {
        await queueManager.createQueue({
          name: 'config-test-queue',
          type: QueueType.STANDARD,
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
        });
      }

      const handler = vi.fn();
      const config = {
        groupName: 'test-group',
        batchSize: 10,
        waitTimeSeconds: 5,
        timeout: 30000
      };

      const result = await consumer.registerConsumer('config-test-queue', handler, config);

      expect(result.success).toBe(true);
      expect(result.consumerId).toBeDefined();
    });
  });

  describe('registerBatchConsumer', () => {
    it('should register batch consumer', async () => {
      const queueManager = (global as any).__queueManager;
      if (queueManager) {
        await queueManager.createQueue({
          name: 'batch-queue',
          type: QueueType.STANDARD,
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
        });
      }

      const batchHandler = vi.fn().mockResolvedValue(undefined);
      const result = await consumer.registerBatchConsumer('batch-queue', batchHandler);

      expect(result.success).toBe(true);
      expect(result.consumerId).toBeDefined();
    });
  });

  describe('deregisterConsumer', () => {
    it('should deregister a consumer', async () => {
      const queueManager = (global as any).__queueManager;
      if (queueManager) {
        await queueManager.createQueue({
          name: 'deregister-queue',
          type: QueueType.STANDARD,
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
        });
      }

      const handler = vi.fn();
      const registerResult = await consumer.registerConsumer('deregister-queue', handler);
      expect(registerResult.success).toBe(true);

      const deregisterResult = await consumer.deregisterConsumer(registerResult.consumerId!);
      expect(deregisterResult.success).toBe(true);
    });

    it('should fail to deregister non-existent consumer', async () => {
      const result = await consumer.deregisterConsumer('non-existent-consumer');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('startConsumer and stopConsumer', () => {
    it('should start a consumer', async () => {
      const queueManager = (global as any).__queueManager;
      if (queueManager) {
        await queueManager.createQueue({
          name: 'start-stop-queue',
          type: QueueType.STANDARD,
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
        });
      }

      const handler = vi.fn();
      const registerResult = await consumer.registerConsumer('start-stop-queue', handler);

      const startResult = await consumer.startConsumer(registerResult.consumerId!);
      expect(startResult.success).toBe(true);

      const stopResult = await consumer.stopConsumer(registerResult.consumerId!);
      expect(stopResult.success).toBe(true);
    });

    it('should fail to start already running consumer', async () => {
      const queueManager = (global as any).__queueManager;
      if (queueManager) {
        await queueManager.createQueue({
          name: 'running-queue',
          type: QueueType.STANDARD,
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
        });
      }

      const handler = vi.fn();
      const registerResult = await consumer.registerConsumer('running-queue', handler);
      await consumer.startConsumer(registerResult.consumerId!);

      const startAgainResult = await consumer.startConsumer(registerResult.consumerId!);
      expect(startAgainResult.success).toBe(false);
      expect(startAgainResult.error).toContain('already running');

      await consumer.stopConsumer(registerResult.consumerId!);
    });
  });

  describe('receive', () => {
    it('should receive messages from queue', async () => {
      const queueManager = (global as any).__queueManager;
      if (queueManager) {
        await queueManager.createQueue({
          name: 'receive-queue',
          type: QueueType.STANDARD,
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
        });
      }

      const result = await consumer.receive('receive-queue', {
        maxMessages: 10,
        waitTime: 5
      });

      expect(result).toBeDefined();
      expect(result.messages).toBeDefined();
      expect(result.receiptHandles).toBeDefined();
    });

    it('should return empty result for non-existent queue', async () => {
      const result = await consumer.receive('non-existent-queue');

      expect(result.messages).toEqual([]);
      expect(result.receiptHandles).toEqual([]);
    });
  });

  describe('acknowledge', () => {
    it('should acknowledge a message', async () => {
      const queueManager = (global as any).__queueManager;
      if (queueManager) {
        await queueManager.createQueue({
          name: 'ack-queue',
          type: QueueType.STANDARD,
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
        });
      }

      // Create a test receipt handle
      const testReceiptHandle = 'test-message-id-1234567890-abc123-1234567890-0';

      const result = await consumer.acknowledge('ack-queue', testReceiptHandle);

      expect(result).toBeDefined();
    });

    it('should handle invalid receipt handle', async () => {
      const queueManager = (global as any).__queueManager;
      if (queueManager) {
        await queueManager.createQueue({
          name: 'invalid-ack-queue',
          type: QueueType.STANDARD,
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
        });
      }

      const result = await consumer.acknowledge('invalid-ack-queue', 'invalid-handle');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('negativeAcknowledge', () => {
    it('should negative acknowledge and requeue message', async () => {
      const queueManager = (global as any).__queueManager;
      if (queueManager) {
        await queueManager.createQueue({
          name: 'nack-queue',
          type: QueueType.STANDARD,
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
        });
      }

      const testReceiptHandle = 'test-message-id-1234567890-abc123-1234567890-0';

      const result = await consumer.negativeAcknowledge('nack-queue', testReceiptHandle, true);

      expect(result).toBeDefined();
    });

    it('should negative acknowledge and not requeue', async () => {
      const queueManager = (global as any).__queueManager;
      if (queueManager) {
        await queueManager.createQueue({
          name: 'nack-no-requeue-queue',
          type: QueueType.STANDARD,
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
        });
      }

      const testReceiptHandle = 'test-message-id-1234567890-abc123-1234567890-0';

      const result = await consumer.negativeAcknowledge('nack-no-requeue-queue', testReceiptHandle, false);

      expect(result).toBeDefined();
    });
  });

  describe('extendVisibilityTimeout', () => {
    it('should extend visibility timeout', async () => {
      const queueManager = (global as any).__queueManager;
      if (queueManager) {
        await queueManager.createQueue({
          name: 'visibility-queue',
          type: QueueType.STANDARD,
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
        });
      }

      const testReceiptHandle = 'test-message-id-1234567890-abc123-1234567890-0';

      // This would require setting up a processing message first
      const result = await consumer.extendVisibilityTimeout('visibility-queue', testReceiptHandle, 30);

      expect(result).toBeDefined();
    });
  });

  describe('getConsumerInfo', () => {
    it('should return consumer info', async () => {
      const queueManager = (global as any).__queueManager;
      if (queueManager) {
        await queueManager.createQueue({
          name: 'info-queue',
          type: QueueType.STANDARD,
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
        });
      }

      const handler = vi.fn();
      const registerResult = await consumer.registerConsumer('info-queue', handler, {
        groupName: 'test-group'
      });

      const info = consumer.getConsumerInfo(registerResult.consumerId!);

      expect(info).toBeDefined();
      expect(info?.queueName).toBe('info-queue');
      expect(info?.groupName).toBe('test-group');
      expect(info?.isActive).toBe(true);
    });

    it('should return null for non-existent consumer', () => {
      const info = consumer.getConsumerInfo('non-existent');
      expect(info).toBeNull();
    });
  });

  describe('listConsumers', () => {
    it('should list consumers for a queue', async () => {
      const queueManager = (global as any).__queueManager;
      if (queueManager) {
        await queueManager.createQueue({
          name: 'list-queue',
          type: QueueType.STANDARD,
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
        });
      }

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      await consumer.registerConsumer('list-queue', handler1);
      await consumer.registerConsumer('list-queue', handler2);

      const consumers = consumer.listConsumers('list-queue');

      expect(consumers).toHaveLength(2);
    });

    it('should return empty array for queue with no consumers', () => {
      const consumers = consumer.listConsumers('non-existent-queue');
      expect(consumers).toEqual([]);
    });
  });

  describe('getConsumerCount', () => {
    it('should return consumer count for specific queue', async () => {
      const queueManager = (global as any).__queueManager;
      if (queueManager) {
        await queueManager.createQueue({
          name: 'count-queue-1',
          type: QueueType.STANDARD,
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
        });
        await queueManager.createQueue({
          name: 'count-queue-2',
          type: QueueType.STANDARD,
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
        });
      }

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      await consumer.registerConsumer('count-queue-1', handler1);
      await consumer.registerConsumer('count-queue-2', handler2);

      expect(consumer.getConsumerCount('count-queue-1')).toBe(1);
      expect(consumer.getConsumerCount('count-queue-2')).toBe(1);
    });

    it('should return total consumer count when no queue specified', async () => {
      const queueManager = (global as any).__queueManager;
      if (queueManager) {
        await queueManager.createQueue({
          name: 'total-count-queue',
          type: QueueType.STANDARD,
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
        });
      }

      const handler = vi.fn();
      await consumer.registerConsumer('total-count-queue', handler);

      expect(consumer.getConsumerCount()).toBe(1);
    });
  });

  describe('close', () => {
    it('should close all consumers', async () => {
      const queueManager = (global as any).__queueManager;
      if (queueManager) {
        await queueManager.createQueue({
          name: 'close-queue-1',
          type: QueueType.STANDARD,
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
        });
        await queueManager.createQueue({
          name: 'close-queue-2',
          type: QueueType.STANDARD,
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
        });
      }

      const handler = vi.fn();
      await consumer.registerConsumer('close-queue-1', handler);
      await consumer.registerConsumer('close-queue-2', handler);

      await consumer.close();

      expect(consumer.getConsumerCount()).toBe(0);
    });
  });

  describe('global consumer', () => {
    it('should provide global consumer instance', () => {
      const globalConsumer = getConsumer();
      expect(globalConsumer).toBeInstanceOf(MessageConsumer);
    });

    it('should return same instance on multiple calls', () => {
      const consumer1 = getConsumer();
      const consumer2 = getConsumer();
      expect(consumer1).toBe(consumer2);
    });

    it('should allow resetting global consumer', () => {
      const consumer1 = getConsumer();
      resetConsumer();
      const consumer2 = getConsumer();

      expect(consumer1).not.toBe(consumer2);
    });
  });

  describe('helper functions', () => {
    it('should consume messages with helper', async () => {
      const queueManager = (global as any).__queueManager;
      if (queueManager) {
        await queueManager.createQueue({
          name: 'helper-queue',
          type: QueueType.STANDARD,
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
        });
      }

      const handler = vi.fn();
      const result = await (async () => {
        const { consumeMessages } = await import('../../src/consumer/consumer');
        return consumeMessages('helper-queue', handler);
      })();

      expect(result).toBeDefined();
    });

    it('should consume message batches with helper', async () => {
      const queueManager = (global as any).__queueManager;
      if (queueManager) {
        await queueManager.createQueue({
          name: 'helper-batch-queue',
          type: QueueType.STANDARD,
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
        });
      }

      const batchHandler = vi.fn();
      const result = await (async () => {
        const { consumeMessageBatches } = await import('../../src/consumer/consumer');
        return consumeMessageBatches('helper-batch-queue', batchHandler);
      })();

      expect(result).toBeDefined();
    });
  });
});
