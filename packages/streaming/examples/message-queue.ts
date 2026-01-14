/**
 * Message Queue Example
 * Demonstrates FIFO, priority, and delayed message queues
 */

import {
  MessageQueue,
  PriorityQueue,
  FIFOQueue,
  DelayedQueue,
  QueueManager,
} from '../src/queue/queue.js';
import type { Message } from '../src/types/index.js';

async function main() {
  console.log('=== Message Queue Example ===\n');

  // ========================================================================
  // Basic Queue Operations
  // ========================================================================

  console.log('1. Basic queue operations...');

  const queue = new MessageQueue({
    type: 'fifo',
    maxSize: 1000,
    retention: 24 * 60 * 60 * 1000, // 24 hours
    visibilityTimeout: 30000,
  });

  // Enqueue messages
  const id1 = await queue.enqueue({ task: 'process-order', orderId: 123 });
  const id2 = await queue.enqueue({ task: 'send-email', email: 'user@example.com' });
  const id3 = await queue.enqueue({ task: 'update-inventory', productId: 456 });

  console.log(`   Enqueued messages: ${id1}, ${id2}, ${id3}`);
  console.log(`   Queue size: ${queue.size()}`);

  // Enqueue batch
  const batchIds = await queue.enqueueBatch([
    { payload: { task: 'task-1' } },
    { payload: { task: 'task-2' } },
    { payload: { task: 'task-3' } },
  ]);

  console.log(`   Enqueued batch: ${batchIds.length} messages`);

  // ========================================================================
  // Dequeue and Process
  // ========================================================================

  console.log('\n2. Dequeue and process...');

  // Dequeue with at-least-once delivery
  const message1 = await queue.dequeue({ type: 'at-least-once' });
  console.log(`   Dequeued: ${message1?.id} - ${JSON.stringify(message1?.payload)}`);

  // Process the message
  console.log('   Processing message...');
  await simulateWork(100);

  // Acknowledge successful processing
  if (message1) {
    await queue.acknowledge(message1.id);
    console.log(`   Acknowledged: ${message1.id}`);
  }

  console.log(`   Processing count: ${queue.processingCount()}`);

  // ========================================================================
  // Priority Queue
  // ========================================================================

  console.log('\n3. Priority queue...');

  const priorityQueue = new PriorityQueue({
    maxSize: 100,
  });

  // Enqueue with different priorities (lower = higher priority)
  await priorityQueue.enqueueWithPriority({ task: 'low-priority' }, 10);
  await priorityQueue.enqueueWithPriority({ task: 'high-priority' }, 1);
  await priorityQueue.enqueueWithPriority({ task: 'medium-priority' }, 5);

  console.log('   Messages dequeued in priority order:');

  const p1 = await priorityQueue.dequeue();
  console.log(`     1. ${p1?.payload.task} (priority: ${p1?.priority})`);

  const p2 = await priorityQueue.dequeue();
  console.log(`     2. ${p2?.payload.task} (priority: ${p2?.priority})`);

  const p3 = await priorityQueue.dequeue();
  console.log(`     3. ${p3?.payload.task} (priority: ${p3?.priority})`);

  // ========================================================================
  // Delayed Queue
  // ========================================================================

  console.log('\n4. Delayed queue...');

  const delayedQueue = new DelayedQueue({
    maxSize: 100,
  });

  // Enqueue with delay
  await delayedQueue.enqueueDelayed({ task: 'delayed-task' }, 500);
  console.log('   Enqueued delayed message (500ms)');

  // Try to dequeue immediately (should return null)
  const immediate = await delayedQueue.dequeue();
  console.log(`   Immediate dequeue: ${immediate ? 'got message' : 'no message'}`);

  // Wait for delay
  console.log('   Waiting for delay...');
  await simulateWork(600);

  const delayed = await delayedQueue.dequeue();
  console.log(`   After delay: ${delayed ? 'got message' : 'no message'}`);

  // ========================================================================
  // Error Handling and Retry
  // ========================================================================

  console.log('\n5. Error handling and retry...');

  const retryQueue = new FIFOQueue();

  await retryQueue.enqueue({ task: 'flaky-task' });

  const msg = await retryQueue();
  if (msg) {
    // Simulate processing failure
    console.log('   Processing failed, retrying...');
    await retryQueue.reject(msg.id, { requeue: true, delay: 100 });

    const stats = retryQueue.getStats();
    console.log(`   Retries: ${stats.retried}`);
  }

  // ========================================================================
  // Dead Letter Queue
  // ========================================================================

  console.log('\n6. Dead letter queue...');

  const dlqQueue = new FIFOQueue({
    deadLetterQueue: 'my-dlq',
  });

  // Enqueue message
  await dlqQueue.enqueue({ task: 'failing-task' });

  const dlqMsg = await dlqQueue();
  if (dlqMsg) {
    // Simulate multiple failures
    dlqMsg.attempts = (dlqMsg.maxAttempts ?? 3) - 1;
    await dlqQueue.reject(dlqMsg.id, { requeue: true });

    console.log(`   Dead letter queue size: ${dlqQueue.deadLetterQueueSize()}`);

    // Get from DLQ
    const dlqItem = dlqQueue.getFromDeadLetterQueue(dlqMsg.id);
    console.log(`   DLQ item: ${dlqItem?.id}`);

    // Requeue from DLQ
    await dlqQueue.requeueFromDeadLetterQueue(dlqMsg.id);
    console.log(`   Requeued from DLQ`);
  }

  // ========================================================================
  // Queue Manager
  // ========================================================================

  console.log('\n7. Queue manager...');

  const manager = new QueueManager();

  // Create multiple queues
  const ordersQueue = manager.getQueue('orders');
  const emailsQueue = manager.getQueue('emails');
  const notificationsQueue = manager.getQueue('notifications');

  // Add messages
  await ordersQueue.enqueue({ orderId: 1 });
  await emailsQueue.enqueue({ emailId: 1 });
  await notificationsQueue.enqueue({ notificationId: 1 });

  // List queues
  const queues = manager.listQueues();
  console.log(`   Queues: ${queues.join(', ')}`);

  // Get all stats
  const allStats = manager.getAllStats();
  console.log('   Queue statistics:');
  for (const [name, stats] of allStats) {
    console.log(`     ${name}: ${stats.enqueued} enqueued, ${stats.dequeued} dequeued`);
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  console.log('\n8. Queue statistics...');

  const queueStats = queue.getStats();
  console.log(`   Enqueued: ${queueStats.enqueued}`);
  console.log(`   Dequeued: ${queueStats.dequeued}`);
  console.log(`   Acknowledged: ${queueStats.acknowledged}`);
  console.log(`   Rejected: ${queueStats.rejected}`);
  console.log(`   Dead lettered: ${queueStats.deadLettered}`);
  console.log(`   Retried: ${queueStats.retried}`);

  console.log('\n=== Example Complete ===');
}

// Helper function to simulate work
function simulateWork(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the example
main().catch(console.error);
