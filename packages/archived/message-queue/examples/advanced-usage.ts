/**
 * Advanced Message Queue Usage Examples
 *
 * This example demonstrates advanced features:
 * - FIFO queues with message ordering
 * - Priority queues
 * - Dead letter queues
 * - Fanout publishing
 * - Delayed and scheduled messages
 * - Retry policies
 * - Consumer groups
 */

import { MessageQueue } from '../src';
import { MessagePriority, QueueType, DeliveryGuarantee } from '../src/types';

async function advancedExample() {
  console.log('=== Advanced Message Queue Examples ===\n');

  const messageQueue = new MessageQueue();
  await messageQueue.initialize();

  try {
    // Example 1: FIFO Queue with Ordering
    console.log('1. FIFO Queue with Message Ordering');
    console.log('---');

    await messageQueue.queueManager.createQueue({
      name: 'fifo-queue',
      type: QueueType.FIFO,
      deliveryGuarantee: DeliveryGuarantee.EXACTLY_ONCE
    });

    // Publish messages with the same group ID to ensure ordering
    for (let i = 0; i < 5; i++) {
      const result = await messageQueue.producer.publish(
        'fifo-queue',
        { sequence: i, data: `Ordered message ${i}` },
        {
          metadata: {
            messageGroupId: 'order-group-123',
            messageDeduplicationId: `msg-${i}-${Date.now()}`
          }
        }
      );
      console.log(`  Published message ${i}:`, result.messageId);
    }

    console.log('✓ FIFO messages published with ordering guarantees\n');

    // Example 2: Priority Queue
    console.log('2. Priority Queue');
    console.log('---');

    await messageQueue.queueManager.createQueue({
      name: 'priority-queue',
      type: QueueType.PRIORITY,
      deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
    });

    // Publish messages with different priorities
    const priorities = [
      MessagePriority.LOW,
      MessagePriority.NORMAL,
      MessagePriority.HIGH,
      MessagePriority.CRITICAL
    ];

    for (const priority of priorities) {
      await messageQueue.producer.publish(
        'priority-queue',
        { priority, message: `${MessagePriority[priority]} priority message` },
        { priority }
      );
      console.log(`  Published ${MessagePriority[priority]} priority message`);
    }

    console.log('✓ Priority messages published\n');

    // Example 3: Fanout Publishing
    console.log('3. Fanout Publishing to Multiple Queues');
    console.log('---');

    // Create multiple queues for fanout
    const fanoutQueues = ['audit-log', 'analytics', 'notifications'];
    for (const queueName of fanoutQueues) {
      await messageQueue.queueManager.createQueue({
        name: queueName,
        type: QueueType.STANDARD,
        deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
      });
    }

    // Publish same message to all queues
    const fanoutResults = await messageQueue.producer.publishFanout(
      fanoutQueues,
      { event: 'user.signup', userId: 12345, timestamp: new Date().toISOString() }
    );

    console.log('  Fanout results:');
    for (const [queue, result] of fanoutResults.entries()) {
      console.log(`    ${queue}: ${result.success ? '✓' : '✗'}`);
    }
    console.log();

    // Example 4: Delayed Messages
    console.log('4. Delayed Messages');
    console.log('---');

    await messageQueue.queueManager.createQueue({
      name: 'delayed-queue',
      type: QueueType.DELAYED,
      deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
    });

    // Publish a message that will be delivered after 60 seconds
    const delayedResult = await messageQueue.producer.publishDelayed(
      'delayed-queue',
      { message: 'This will be delivered later' },
      60
    );
    console.log(`  ✓ Delayed message published: ${delayedResult.messageId}`);
    console.log(`  Will be delivered in 60 seconds\n`);

    // Example 5: Scheduled Messages
    console.log('5. Scheduled Messages');
    console.log('---');

    const scheduledTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
    const scheduledResult = await messageQueue.producer.publishScheduled(
      'delayed-queue',
      { message: 'Scheduled for specific time' },
      scheduledTime
    );
    console.log(`  ✓ Scheduled message published: ${scheduledResult.messageId}`);
    console.log(`  Will be delivered at: ${scheduledTime.toISOString()}\n`);

    // Example 6: Dead Letter Queue with Retry Policy
    console.log('6. Dead Letter Queue with Retry Policy');
    console.log('---');

    await messageQueue.queueManager.createQueue({
      name: 'retry-queue',
      type: QueueType.STANDARD,
      deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE,
      maxReceiveCount: 5,
      deadLetterQueue: 'dlq-retry-queue'
    });

    await messageQueue.queueManager.createQueue({
      name: 'dlq-retry-queue',
      type: QueueType.STANDARD,
      deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
    });

    // Simulate a failed message
    const failedMessage = {
      id: 'failed-msg-1',
      body: { data: 'This will fail' },
      metadata: {
        headers: {},
        priority: MessagePriority.NORMAL
      },
      deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE,
      state: 'failed' as const,
      retryCount: 0,
      timestamps: { createdAt: Date.now() }
    };

    const error = new Error('Simulated processing error');

    // Handle with exponential backoff retry policy
    const dlhResult = await messageQueue.deadLetterHandler.handleFailedMessage(
      failedMessage,
      error,
      'retry-queue',
      {
        type: 'exponential-backoff',
        maxRetries: 5,
        initialDelay: 1000,
        backoffMultiplier: 2,
        maxDelay: 60000
      }
    );

    console.log(`  ✓ Failed message handled: ${dlhResult.action}`);
    console.log(`  Entry ID: ${dlhResult.entryId}\n`);

    // Example 7: Consumer Groups
    console.log('7. Consumer Groups for Load Balancing');
    console.log('---');

    await messageQueue.queueManager.createQueue({
      name: 'worker-queue',
      type: QueueType.STANDARD,
      deliveryGuarantee: DeliveryGuarantee.AT_LEAST_ONCE
    });

    // Register multiple consumers in the same group
    const groupName = 'worker-group';
    const consumers: string[] = [];

    for (let i = 0; i < 3; i++) {
      const result = await messageQueue.consumer.registerConsumer(
        'worker-queue',
        async (message) => {
          console.log(`    Worker ${i} processing:`, message.body);
          // Simulate processing
          await new Promise(resolve => setTimeout(resolve, 100));
        },
        {
          groupName,
          batchSize: 3,
          timeout: 30000
        }
      );

      if (result.consumerId) {
        consumers.push(result.consumerId);
        await messageQueue.consumer.startConsumer(result.consumerId);
      }
    }

    console.log(`  ✓ Registered ${consumers.length} consumers in group '${groupName}'`);

    // Publish work items
    for (let i = 0; i < 9; i++) {
      await messageQueue.producer.publish('worker-queue', { taskId: i });
    }

    console.log('  ✓ Published 9 work items');

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('  ✓ Work distributed among consumers\n');

    // Example 8: Message Compression
    console.log('8. Message Compression for Large Payloads');
    console.log('---');

    const compressingProducer = new (messageQueue.producer.constructor as any)({
      compressionEnabled: true,
      batchSize: 10
    });

    const largeData = 'x'.repeat(100000); // 100KB of data
    const compressedResult = await compressingProducer.publish(
      'my-queue',
      { largeData }
    );

    console.log(`  ✓ Compressed message published: ${compressedResult.messageId}`);
    console.log('  Original size: ~100KB, Compressed: smaller\n');

    // Example 9: Monitoring and Health Checks
    console.log('9. Queue Health Monitoring');
    console.log('---');

    const healthCheck = await messageQueue.queueManager.healthCheck('my-queue');
    console.log(`  Queue: ${healthCheck.queueName}`);
    console.log(`  Health: ${healthCheck.healthy ? '✓ Healthy' : '✗ Unhealthy'}`);
    console.log('  Checks:');
    for (const check of healthCheck.checks) {
      const status = check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✗';
      console.log(`    ${status} ${check.name}: ${check.message || 'OK'}`);
    }
    console.log();

    // Example 10: Metrics and Statistics
    console.log('10. Queue Metrics and Statistics');
    console.log('---');

    const allStats = messageQueue.getStatistics();
    console.log('  System Statistics:');
    console.log(`    Total queues: ${allStats.queues.count}`);
    console.log(`    Total messages: ${allStats.queues.totalMessages}`);
    console.log(`    Dead letter entries: ${allStats.deadLetters.totalEntries}`);

    const queueMetrics = messageQueue.queueManager.getQueueMetrics('my-queue');
    if (queueMetrics) {
      console.log('\n  Producer Metrics:');
      console.log(`    Published: ${queueMetrics.producer.totalPublished}`);
      console.log(`    Success rate: ${(queueMetrics.producer.successRate * 100).toFixed(2)}%`);
      console.log(`    Avg latency: ${queueMetrics.producer.averageLatency.toFixed(2)}ms`);
    }
    console.log();

    // Cleanup
    console.log('11. Cleanup');
    console.log('---');

    for (const consumerId of consumers) {
      await messageQueue.consumer.deregisterConsumer(consumerId);
    }

    const allQueues = messageQueue.queueManager.listQueues();
    for (const queue of allQueues) {
      await messageQueue.queueManager.deleteQueue(queue.name);
    }

    console.log('✓ All queues and consumers cleaned up');

  } finally {
    await messageQueue.close();
  }

  console.log('\n=== Advanced Examples Complete ===');
}

// Run the examples
if (require.main === module) {
  advancedExample().catch(console.error);
}

export { advancedExample };
