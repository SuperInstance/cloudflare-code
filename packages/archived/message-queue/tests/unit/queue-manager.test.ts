/**
 * Unit tests for Queue Manager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueueManager, resetQueueManager } from '../../src/queue/manager';
import { QueueType, DeliveryGuarantee } from '../../src/types';

describe('QueueManager', () => {
  let manager: QueueManager;

  beforeEach(() => {
    resetQueueManager();
    manager = new QueueManager();
  });

  afterEach(() => {
    resetQueueManager();
  });

  describe('createQueue', () => {
    it('should create a new queue successfully', async () => {
      const result = await manager.createQueue({
        name: 'test-queue',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      expect(result.success).toBe(true);
      expect(result.queueId).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should reject duplicate queue names', async () => {
      const config = {
        name: 'duplicate-queue',
        type: QueueType.STANDARD as const,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE as const
      };

      const first = await manager.createQueue(config);
      expect(first.success).toBe(true);

      const second = await manager.createQueue(config);
      expect(second.success).toBe(false);
      expect(second.error).toContain('already exists');
    });

    it('should reject invalid queue names', async () => {
      const result = await manager.createQueue({
        name: '123-invalid',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject queue names that are too long', async () => {
      const longName = 'a'.repeat(100);
      const result = await manager.createQueue({
        name: longName,
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      expect(result.success).toBe(false);
    });
  });

  describe('deleteQueue', () => {
    it('should delete an existing queue', async () => {
      await manager.createQueue({
        name: 'to-delete',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      const result = await manager.deleteQueue('to-delete');
      expect(result.success).toBe(true);
      expect(manager.queueExists('to-delete')).toBe(false);
    });

    it('should fail to delete non-existent queue', async () => {
      const result = await manager.deleteQueue('non-existent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('getQueueConfig', () => {
    it('should return queue configuration', async () => {
      const config = {
        name: 'config-test',
        type: QueueType.FIFO,
        deliveryGuarantee: DeliveryGuarantee.EXACTLY_ONCE,
        maxMessageSize: 1024 * 1024,
        messageTTL: 3600
      };

      await manager.createQueue(config);
      const retrieved = manager.getQueueConfig('config-test');

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe(config.name);
      expect(retrieved?.type).toBe(config.type);
      expect(retrieved?.maxMessageSize).toBe(config.maxMessageSize);
    });

    it('should return null for non-existent queue', () => {
      const config = manager.getQueueConfig('non-existent');
      expect(config).toBeNull();
    });
  });

  describe('listQueues', () => {
    beforeEach(async () => {
      await manager.createQueue({
        name: 'queue-1',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });
      await manager.createQueue({
        name: 'queue-2',
        type: QueueType.FIFO,
        deliveryGuarantee: DeliveryGuarantee.EXACTLY_ONCE
      });
      await manager.createQueue({
        name: 'fifo-queue-3',
        type: QueueType.FIFO,
        deliveryGuarantee: DeliveryGuarantee.EXACTLY_ONCE
      });
    });

    it('should list all queues', () => {
      const queues = manager.listQueues();
      expect(queues).toHaveLength(3);
    });

    it('should filter by queue type', () => {
      const fifoQueues = manager.listQueues({ type: QueueType.FIFO });
      expect(fifoQueues).toHaveLength(2);
      expect(fifoQueues.every(q => q.type === QueueType.FIFO)).toBe(true);
    });

    it('should filter by name pattern', () => {
      const matching = manager.listQueues({ namePattern: '^fifo-' });
      expect(matching).toHaveLength(1);
      expect(matching[0].name).toBe('fifo-queue-3');
    });

    it('should apply pagination', () => {
      const page1 = manager.listQueues({ limit: 2, offset: 0 });
      expect(page1).toHaveLength(2);

      const page2 = manager.listQueues({ limit: 2, offset: 2 });
      expect(page2).toHaveLength(1);
    });
  });

  describe('queue state management', () => {
    it('should update message count', async () => {
      await manager.createQueue({
        name: 'state-test',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      manager.incrementMessageCount('state-test', 10);
      const stats = manager.getQueueStats('state-test');

      expect(stats?.approximateMessageCount).toBe(10);
    });

    it('should decrement message count', async () => {
      await manager.createQueue({
        name: 'decrement-test',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      manager.incrementMessageCount('decrement-test', 10);
      manager.decrementMessageCount('decrement-test', 3);

      const stats = manager.getQueueStats('decrement-test');
      expect(stats?.approximateMessageCount).toBe(7);
    });

    it('should not allow negative message count', async () => {
      await manager.createQueue({
        name: 'negative-test',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      manager.decrementMessageCount('negative-test', 5);
      const stats = manager.getQueueStats('negative-test');

      expect(stats?.approximateMessageCount).toBe(0);
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      await manager.createQueue({
        name: 'stats-test',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      manager.incrementMessageCount('stats-test', 100);
      manager.incrementProcessedCount('stats-test', 80);
      manager.incrementFailedCount('stats-test', 5);

      const stats = manager.getQueueStats('stats-test');

      expect(stats).toBeDefined();
      expect(stats?.name).toBe('stats-test');
      expect(stats?.approximateMessageCount).toBe(100);
      expect(stats?.processingStats.totalProcessed).toBe(80);
      expect(stats?.processingStats.failed).toBe(5);
    });

    it('should return null for non-existent queue', () => {
      const stats = manager.getQueueStats('non-existent');
      expect(stats).toBeNull();
    });
  });

  describe('purgeQueue', () => {
    it('should purge all messages from queue', async () => {
      await manager.createQueue({
        name: 'purge-test',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      manager.incrementMessageCount('purge-test', 50);

      const result = await manager.purgeQueue('purge-test');
      expect(result.success).toBe(true);
      expect(result.purgedCount).toBe(50);

      const stats = manager.getQueueStats('purge-test');
      expect(stats?.approximateMessageCount).toBe(0);
    });

    it('should fail to purge non-existent queue', async () => {
      const result = await manager.purgeQueue('non-existent');
      expect(result.success).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('should pass health check for healthy queue', async () => {
      await manager.createQueue({
        name: 'healthy-queue',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      manager.incrementMessageCount('healthy-queue', 100);
      manager.incrementProcessedCount('healthy-queue', 95);

      const health = await manager.healthCheck('healthy-queue');
      expect(health.healthy).toBe(true);
      expect(health.checks.every(c => c.status !== 'fail')).toBe(true);
    });

    it('should fail health check for non-existent queue', async () => {
      const health = await manager.healthCheck('non-existent');
      expect(health.healthy).toBe(false);
    });

    it('should warn on high failure rate', async () => {
      await manager.createQueue({
        name: 'failing-queue',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      manager.incrementProcessedCount('failing-queue', 100);
      manager.incrementFailedCount('failing-queue', 30); // 30% failure rate

      const health = await manager.healthCheck('failing-queue');
      expect(health.healthy).toBe(false); // High failure rate
    });
  });

  describe('event handling', () => {
    it('should emit events', async () => {
      let eventEmitted = false;

      manager.on('queue.created' as any, () => {
        eventEmitted = true;
      });

      await manager.createQueue({
        name: 'event-test',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      expect(eventEmitted).toBe(true);
    });

    it('should allow unregistering event handlers', async () => {
      let callCount = 0;

      const handler = () => {
        callCount++;
      };

      manager.on('queue.created' as any, handler);
      manager.off('queue.created' as any, handler);

      await manager.createQueue({
        name: 'event-test-2',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      expect(callCount).toBe(0);
    });
  });

  describe('metrics', () => {
    it('should track metrics for queues', async () => {
      await manager.createQueue({
        name: 'metrics-test',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      const metrics = manager.getQueueMetrics('metrics-test');
      expect(metrics).toBeDefined();
      expect(metrics?.producer.totalPublished).toBe(0);
      expect(metrics?.consumer.totalConsumed).toBe(0);
    });

    it('should update metrics', async () => {
      await manager.createQueue({
        name: 'metrics-update',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      manager.updateMetrics('metrics-update', {
        producer: {
          totalPublished: 100,
          successRate: 0.95,
          averageLatency: 50,
          bytesPublished: 10000
        }
      });

      const metrics = manager.getQueueMetrics('metrics-update');
      expect(metrics?.producer.totalPublished).toBe(100);
    });

    it('should reset metrics', async () => {
      await manager.createQueue({
        name: 'metrics-reset',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      manager.updateMetrics('metrics-reset', {
        producer: {
          totalPublished: 100,
          successRate: 0.95,
          averageLatency: 50,
          bytesPublished: 10000
        }
      });

      manager.resetMetrics('metrics-reset');

      const metrics = manager.getQueueMetrics('metrics-reset');
      expect(metrics?.producer.totalPublished).toBe(0);
    });
  });

  describe('state import/export', () => {
    it('should export queue state', async () => {
      await manager.createQueue({
        name: 'export-test',
        type: QueueType.FIFO,
        deliveryGuarantee: DeliveryGuarantee.EXACTLY_ONCE
      });

      manager.incrementMessageCount('export-test', 25);

      const exported = manager.exportQueueState('export-test');
      expect(exported).toBeDefined();
      expect(exported?.config.name).toBe('export-test');
      expect(exported?.state.messageCount).toBe(25);
    });

    it('should import queue state', async () => {
      const state = {
        config: {
          name: 'import-test',
          type: QueueType.STANDARD as const,
          deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE as const
        },
        state: {
          messageCount: 50,
          notVisibleCount: 10,
          delayedCount: 5,
          deadLetterCount: 2,
          totalProcessed: 45,
          totalFailed: 3,
          lastActivityAt: Date.now()
        },
        createdAt: Date.now() - 10000,
        updatedAt: Date.now()
      };

      const result = manager.importQueueState('import-test', state);
      expect(result.success).toBe(true);

      const stats = manager.getQueueStats('import-test');
      expect(stats?.approximateMessageCount).toBe(50);
    });
  });

  describe('utility methods', () => {
    it('should return correct queue count', async () => {
      expect(manager.getQueueCount()).toBe(0);

      await manager.createQueue({
        name: 'queue-1',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });
      await manager.createQueue({
        name: 'queue-2',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      expect(manager.getQueueCount()).toBe(2);
    });

    it('should return total message count', async () => {
      await manager.createQueue({
        name: 'queue-1',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });
      await manager.createQueue({
        name: 'queue-2',
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });

      manager.incrementMessageCount('queue-1', 100);
      manager.incrementMessageCount('queue-2', 50);

      expect(manager.getTotalMessageCount()).toBe(150);
    });
  });
});
