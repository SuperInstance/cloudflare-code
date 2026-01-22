import { MessagingBroker } from '../src/index';

async function basicUsageExample() {
  console.log('=== Basic Messaging Broker Usage Example ===\n');

  // Create broker instance
  const broker = new MessagingBroker({
    topics: {
      maxTopics: 100,
      enableMetrics: true
    },
    subscribers: {
      enableHealthChecks: true,
      enableDeadLetter: true
    },
    delivery: {
      maxConcurrentDeliveries: 100,
      enableMetrics: true
    }
  });

  try {
    // Start the broker
    await broker.start();
    console.log('✓ Broker started successfully\n');

    // Create a topic
    const topic = await broker.createTopic('orders', 3, 2);
    console.log(`✓ Topic created: ${topic.name} (Partitions: ${topic.partitions})`);

    // Subscribe to the topic
    const subscriptionResult = await broker.subscribe(
      'orders',
      'order-processor',
      {
        deliveryGuarantee: 'at-least-once',
        retryPolicy: {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 50000,
          backoffMultiplier: 2,
          jitter: true
        },
        batchSize: 5,
        metadata: {
          description: 'Process order messages',
          priority: 'high'
        }
      }
    );
    console.log(`✓ Subscription created: ${subscriptionResult.subscriptionId}`);

    // Create some routing rules
    await broker.createRoutingRule(
      'orders.*.urgent',
      [{ type: 'forward', target: 'urgent-orders' }],
      { name: 'Urgent Orders Routing', priority: 10 }
    );

    await broker.createRoutingRule(
      'orders.*.normal',
      [{ type: 'forward', target: 'normal-orders' }],
      { name: 'Normal Orders Routing', priority: 5 }
    );

    // Publish messages
    console.log('\n--- Publishing Messages ---');

    const messages = [
      { orderId: 'ORD-001', amount: 100, priority: 'normal', items: ['item1', 'item2'] },
      { orderId: 'ORD-002', amount: 250, priority: 'urgent', items: ['item3', 'item4', 'item5'] },
      { orderId: 'ORD-003', amount: 75, priority: 'normal', items: ['item6'] },
      { orderId: 'ORD-004', amount: 300, priority: 'urgent', items: ['item7', 'item8', 'item9', 'item10'] },
      { orderId: 'ORD-005', amount: 150, priority: 'normal', items: ['item11', 'item12'] }
    ];

    for (const msg of messages) {
      const result = await broker.publish('orders', msg, {
        correlationId: `correlation-${msg.orderId}`,
        timestamp: Date.now(),
        priority: msg.priority
      });

      if (result.success) {
        console.log(`✓ Published order ${msg.orderId}: ${result.messageId}`);
      } else {
        console.log(`✗ Failed to publish order ${msg.orderId}: ${result.error}`);
      }
    }

    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get broker statistics
    const stats = await broker.getStats();
    console.log('\n--- Broker Statistics ---');
    console.log(`Total Topics: ${stats.totalTopics}`);
    console.log(`Total Subscriptions: ${stats.totalSubscriptions}`);
    console.log(`Total Messages: ${stats.totalMessages}`);
    console.log(`Message Rate: ${stats.messageRate.toFixed(2)} messages/s`);
    console.log(`Uptime: ${Math.floor(stats.uptime)} seconds`);

    // Get detailed metrics
    const metrics = await broker.getMetrics();
    console.log('\n--- Detailed Metrics ---');
    console.log(`Topics: ${metrics.topics.total} with ${metrics.topics.messages} messages`);
    console.log(`Subscribers: ${metrics.subscribers.total} (${metrics.subscribers.healthy} healthy)`);
    console.log(`Delivery: ${metrics.delivery.total} total, ${metrics.delivery.successful} successful`);

    // Get all subscriptions
    const subscriptions = await broker.getSubscriptions();
    console.log('\n--- Subscriptions ---');
    subscriptions.forEach(sub => {
      console.log(`- ${sub.subscriber} -> ${sub.topic} (${sub.deliveryGuarantee})`);
    });

    // Check broker health
    const isHealthy = await broker.isHealthy();
    console.log(`\nBroker Health: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await broker.stop();
    console.log('\n✓ Broker stopped');
  }
}

// Run the example
basicUsageExample().catch(console.error);