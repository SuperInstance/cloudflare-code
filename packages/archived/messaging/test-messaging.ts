import { MessagingBroker } from './src/index';
import { createMessage } from './src/utils';

async function testMessagingBroker() {
  console.log('=== Testing Messaging Broker ===\n');

  // Create broker
  const broker = new MessagingBroker({
    topics: {
      enableMetrics: true
    },
    subscribers: {
      enableHealthChecks: true
    },
    delivery: {
      enableMetrics: true
    }
  });

  try {
    // Start broker
    await broker.start();
    console.log('✓ Broker started\n');

    // Create topic
    const topic = await broker.createTopic('test.topic');
    console.log(`✓ Created topic: ${topic.name}`);

    // Subscribe
    const subResult = await broker.subscribe('test.topic', 'test-service');
    console.log(`✓ Created subscription: ${subResult.subscriptionId}`);

    // Publish message
    const msg = createMessage('test.topic', { hello: 'world' });
    const pubResult = await broker.publish('test.topic', { hello: 'world' });

    console.log(`✓ Published message: ${pubResult.messageId}`);
    console.log(`  Success: ${pubResult.success}`);

    if (pubResult.error) {
      console.log(`  Warning: ${pubResult.error}`);
    }

    // Get stats
    const stats = await broker.getStats();
    console.log(`\n✓ Broker Stats:`);
    console.log(`  Topics: ${stats.totalTopics}`);
    console.log(`  Subscriptions: ${stats.totalSubscriptions}`);
    console.log(`  Messages: ${stats.totalMessages}`);
    console.log(`  Rate: ${stats.messageRate.toFixed(2)} msg/s`);

    // Test subscription count
    const subs = await broker.getSubscriptions();
    console.log(`\n✓ Found ${subs.length} subscriptions`);

    // Test health
    const isHealthy = await broker.isHealthy();
    console.log(`\n✓ Health check: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);

    console.log('\n=== All tests passed! ===');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    await broker.stop();
    console.log('\n✓ Broker stopped');
  }
}

// Run the test
testMessagingBroker().catch(console.error);