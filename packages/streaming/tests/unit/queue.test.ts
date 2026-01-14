/**
 * Unit tests for Message Queue
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MessageQueue,
  PriorityQueue,
  FIFOQueue,
  DelayedQueue,
  QueueManager,
} from '../../src/queue/queue';
import type { Message } from '../../src/types';

describe('MessageQueue', () => {
  let queue: MessageQueue<{ value: number }>;

  beforeEach(() => {
    queue = new MessageQueue();
  });

  describe('enqueue', () => {
    it('should enqueue a message', async () => {
      const id = await queue.enqueue({ value: 1 });

      expect(id).toBeDefined();
      expect(queue.size()).toBe(1);
    });

    it('should enqueue message with priority', async () => {
      const id = await queue.enqueue({ value: 1 }, { priority: 10 });

      expect(id).toBeDefined();
      const message = Array.from(queue['messages'].values())[0];
      expect(message.priority).toBe(10);
    });

    it('should enqueue message with delay', async () => {
      const id = await queue.enqueue({ value: 1 }, { delay: 100 });

      expect(id).toBeDefined();
      const message = Array.from(queue['messages'].values())[0];
      expect(message.metadata?.scheduledAt).toBeGreaterThan(Date.now());
    });

    it('should enqueue message with deduplication ID', async () => {
      const id1 = await queue.enqueue({ value: 1 }, { deduplicationId: 'dup-1' });
      const id2 = await queue.enqueue({ value: 2 }, { deduplicationId: 'dup-1' });

      expect(id1).toBe(id2);
      expect(queue.size()).toBe(1);
    });

    it('should throw error when queue is full', async () => {
      const smallQueue = new MessageQueue({ maxSize: 2 });

      await smallQueue.enqueue({ value: 1 });
      await smallQueue.enqueue({ value: 2 });

      await expect(smallQueue.enqueue({ value: 3 })).rejects.toThrow('Queue is full');
    });

    it('should enqueue multiple messages', async () => {
      const ids = await queue.enqueueBatch([
        { payload: { value: 1 } },
        { payload: { value: 2 } },
        { payload: { value: 3 } },
      ]);

      expect(ids).toHaveLength(3);
      expect(queue.size()).toBe(3);
    });
  });

  describe('dequeue', () => {
    it('should dequeue a message', async () => {
      await queue.enqueue({ value: 1 });
      const message = await queue.dequeue();

      expect(message).toBeDefined();
      expect(message?.payload).toEqual({ value: 1 });
    });

    it('should return null when queue is empty', async () => {
      const message = await queue.dequeue();

      expect(message).toBeNull();
    });

    it('should respect at-most-once delivery', async () => {
      await queue.enqueue({ value: 1 });

      const message1 = await queue.dequeue({ type: 'at-most-once' });
      const message2 = await queue.dequeue({ type: 'at-most-once' });

      expect(message1).toBeDefined();
      expect(message2).toBeNull();
      expect(queue.size()).toBe(0);
    });

    it('should respect at-least-once delivery', async () => {
      await queue.enqueue({ value: 1 });

      const message1 = await queue.dequeue({ type: 'at-least-once' });
      expect(message1).toBeDefined();
      expect(queue['processing'].has(message1!.id)).toBe(true);
    });

    it('should dequeue in FIFO order', async () => {
      await queue.enqueue({ value: 1 });
      await queue.enqueue({ value: 2 });
      await queue.enqueue({ value: 3 });

      const msg1 = await queue.dequeue();
      const msg2 = await queue.dequeue();
      const msg3 = await queue.dequeue();

      expect(msg1?.payload.value).toBe(1);
      expect(msg2?.payload.value).toBe(2);
      expect(msg3?.payload.value).toBe(3);
    });
  });

  describe('dequeueBatch', () => {
    it('should dequeue multiple messages', async () => {
      await queue.enqueue({ value: 1 });
      await queue.enqueue({ value: 2 });
      await queue.enqueue({ value: 3 });

      const messages = await queue.dequeueBatch(2);

      expect(messages).toHaveLength(2);
    });

    it('should return fewer messages if not available', async () => {
      await queue.enqueue({ value: 1 });

      const messages = await queue.dequeueBatch(5);

      expect(messages).toHaveLength(1);
    });
  });

  describe('acknowledge', () => {
    it('should acknowledge message', async () => {
      await queue.enqueue({ value: 1 });
      const message = await queue.dequeue();

      expect(message).toBeDefined();

      const acknowledged = await queue.acknowledge(message!.id);

      expect(acknowledged).toBe(true);
      expect(queue.size()).toBe(0);
    });

    it('should return false for non-existent message', async () => {
      const acknowledged = await queue.acknowledge('non-existent');

      expect(acknowledged).toBe(false);
    });
  });

  describe('reject', () => {
    it('should reject and remove message', async () => {
      await queue.enqueue({ value: 1 });
      const message = await queue.dequeue();

      const rejected = await queue.reject(message!.id, { requeue: false });

      expect(rejected).toBe(true);
      expect(queue.size()).toBe(0);
    });

    it('should reject and requeue message', async () => {
      await queue.enqueue({ value: 1 });
      const message = await queue.dequeue();

      const rejected = await queue.reject(message!.id, { requeue: true });

      expect(rejected).toBe(true);
      expect(queue['processing'].has(message!.id)).toBe(false);
    });

    it('should move to dead letter queue after max attempts', async () => {
      await queue.enqueue({ value: 1 }, { priority: 5 });
      const message = await queue.dequeue();

      // Set attempts to max
      if (message) {
        message.attempts = (message.maxAttempts ?? 3) - 1;
      }

      await queue.reject(message!.id, { requeue: true });

      expect(queue.deadLetterQueueSize()).toBe(1);
      expect(queue.getStats().deadLettered).toBe(1);
    });
  });

  describe('extendVisibilityTimeout', () => {
    it('should extend visibility timeout', async () => {
      await queue.enqueue({ value: 1 });
      const message = await queue.dequeue();

      const extended = await queue.extendVisibilityTimeout(message!.id, 60000);

      expect(extended).toBe(true);
    });

    it('should return false for non-existent message', async () => {
      const extended = await queue.extendVisibilityTimeout('non-existent', 60000);

      expect(extended).toBe(false);
    });
  });

  describe('size', () => {
    it('should return queue size', async () => {
      expect(queue.size()).toBe(0);

      await queue.enqueue({ value: 1 });
      await queue.enqueue({ value: 2 });

      expect(queue.size()).toBe(2);
    });
  });

  describe('processingCount', () => {
    it('should return processing count', async () => {
      await queue.enqueue({ value: 1 });
      await queue.dequeue();

      expect(queue.processingCount()).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return queue statistics', async () => {
      await queue.enqueue({ value: 1 });
      await queue.dequeue();
      await queue.acknowledge((await queue.dequeue())!.id);

      const stats = queue.getStats();

      expect(stats.enqueued).toBe(1);
      expect(stats.acknowledged).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear queue', async () => {
      await queue.enqueue({ value: 1 });
      await queue.enqueue({ value: 2 });

      queue.clear();

      expect(queue.size()).toBe(0);
    });
  });
});

describe('PriorityQueue', () => {
  it('should dequeue by priority', async () => {
    const queue = new PriorityQueue();

    await queue.enqueueWithPriority({ value: 1 }, 5);
    await queue.enqueueWithPriority({ value: 2 }, 1);
    await queue.enqueueWithPriority({ value: 3 }, 10);

    const msg1 = await queue.dequeue();
    const msg2 = await queue.dequeue();
    const msg3 = await queue.dequeue();

    expect(msg1?.priority).toBe(1);
    expect(msg2?.priority).toBe(5);
    expect(msg3?.priority).toBe(10);
  });
});

describe('FIFOQueue', () => {
  it('should maintain FIFO order', async () => {
    const queue = new FIFOQueue();

    await queue.enqueue({ value: 1 });
    await queue.enqueue({ value: 2 });
    await queue.enqueue({ value: 3 });

    const msg1 = await queue.dequeue();
    const msg2 = await queue.dequeue();
    const msg3 = await queue.dequeue();

    expect(msg1?.payload.value).toBe(1);
    expect(msg2?.payload.value).toBe(2);
    expect(msg3?.payload.value).toBe(3);
  });
});

describe('DelayedQueue', () => {
  it('should delay message delivery', async () => {
    const queue = new DelayedQueue();

    await queue.enqueueDelayed({ value: 1 }, 100);

    const msg1 = await queue.dequeue();

    expect(msg1).toBeNull();

    // Wait for delay
    await new Promise(resolve => setTimeout(resolve, 150));

    const msg2 = await queue.dequeue();

    expect(msg2).toBeDefined();
  });
});

describe('QueueManager', () => {
  it('should manage multiple queues', () => {
    const manager = new QueueManager();

    const queue1 = manager.getQueue('queue1');
    const queue2 = manager.getQueue('queue2');

    expect(queue1).toBeDefined();
    expect(queue2).toBeDefined();
    expect(queue1).not.toBe(queue2);
  });

  it('should return same queue instance', () => {
    const manager = new QueueManager();

    const queue1 = manager.getQueue('queue1');
    const queue2 = manager.getQueue('queue1');

    expect(queue1).toBe(queue2);
  });

  it('should list all queues', async () => {
    const manager = new QueueManager();

    manager.getQueue('queue1');
    manager.getQueue('queue2');
    manager.getQueue('queue3');

    const queues = manager.listQueues();

    expect(queues).toHaveLength(3);
    expect(queues).toContain('queue1');
    expect(queues).toContain('queue2');
    expect(queues).toContain('queue3');
  });

  it('should delete queue', () => {
    const manager = new QueueManager();

    manager.getQueue('queue1');
    const deleted = manager.deleteQueue('queue1');

    expect(deleted).toBe(true);
    expect(manager.listQueues()).toHaveLength(0);
  });

  it('should get all statistics', async () => {
    const manager = new QueueManager();

    const queue1 = manager.getQueue('queue1');
    await queue1.enqueue({ value: 1 });

    const stats = manager.getAllStats();

    expect(stats.size).toBe(1);
    expect(stats.get('queue1')?.enqueued).toBe(1);
  });
});
