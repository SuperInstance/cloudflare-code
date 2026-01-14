/**
 * Basic Message Queue Usage Examples
 *
 * This example demonstrates the fundamental operations of the message queue system:
 * - Creating queues
 * - Publishing messages
 * - Consuming messages
 * - Handling acknowledgments
 */

import { MessageQueue } from '../src';

async function basicExample() {
  console.log('=== Basic Message Queue Example ===\n');

  // Initialize the message queue
  const messageQueue = new MessageQueue();
  await messageQueue.initialize();

  try {
    // 1. Create a queue
    console.log('1. Creating queue...');
    const createResult = await messageQueue.queueManager.createQueue({
      name: 'my-queue',
      type: 'standard',
      deliveryGuarantee: 'at-least-once',
      messageTTL: 3600
    });
    console.log('✓ Queue created:', createResult.queueId);

    // 2. Publish a message
    console.log('\n2. Publishing message...');
    const publishResult = await messageQueue.producer.publish(
      'my-queue',
      {
        type: 'greeting',
        content: 'Hello, World!',
        timestamp: new Date().toISOString()
      }
    );
    console.log('✓ Message published:', publishResult.messageId);

    // 3. Publish multiple messages
    console.log('\n3. Publishing batch...');
    const batchResult = await messageQueue.producer.publishBatch(
      'my-queue',
      Array.from({ length: 10 }, (_, i) => ({
        body: {
          id: i,
          message: `Message ${i}`
        }
      }))
    );
    console.log(`✓ Batch published: ${batchResult.successCount}/${batchResult.total} successful`);

    // 4. Check queue statistics
    console.log('\n4. Queue statistics:');
    const stats = messageQueue.queueManager.getQueueStats('my-queue');
    console.log('  Messages:', stats?.approximateMessageCount);
    console.log('  Processed:', stats?.processingStats.totalProcessed);

    // 5. Register a consumer
    console.log('\n5. Registering consumer...');
    const consumerResult = await messageQueue.consumer.registerConsumer(
      'my-queue',
      async (message) => {
        console.log('  Received message:', message.body);
        // Message is automatically acknowledged if handler succeeds
      },
      {
        batchSize: 5,
        waitTimeSeconds: 2
      }
    );
    console.log('✓ Consumer registered:', consumerResult.consumerId);

    // 6. Start consuming messages
    console.log('\n6. Starting consumer...');
    await messageQueue.consumer.startConsumer(consumerResult.consumerId!);
    console.log('✓ Consumer started');

    // 7. Wait for messages to be processed
    console.log('\n7. Waiting for messages to process...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 8. Check final statistics
    console.log('\n8. Final statistics:');
    const finalStats = messageQueue.queueManager.getQueueStats('my-queue');
    console.log('  Messages:', finalStats?.approximateMessageCount);
    console.log('  Processed:', finalStats?.processingStats.totalProcessed);

    // 9. Cleanup
    console.log('\n9. Cleaning up...');
    await messageQueue.consumer.deregisterConsumer(consumerResult.consumerId!);
    await messageQueue.queueManager.deleteQueue('my-queue');
    console.log('✓ Cleanup complete');

  } finally {
    await messageQueue.close();
  }

  console.log('\n=== Example Complete ===');
}

// Run the example
if (require.main === module) {
  basicExample().catch(console.error);
}

export { basicExample };
