import { MessagingBroker } from '../src/index';

async function advancedPatternsExample() {
  console.log('=== Advanced Messaging Patterns Example ===\n');

  const broker = new MessagingBroker({
    router: {
      enableTransformation: true,
      enableFiltering: true,
      enableMetrics: true
    },
    topics: {
      enableMetrics: true,
      retentionEnabled: true,
      retentionInterval: 60000
    },
    subscribers: {
      enableHealthChecks: true,
      enableDeadLetter: true
    },
    delivery: {
      maxConcurrentDeliveries: 500,
      enableMetrics: true
    }
  });

  try {
    await broker.start();
    console.log('✓ Broker started\n');

    // Create topics for different patterns
    const topics = [
      await broker.createTopic('api.requests', 5, 2),
      await broker.createTopic('api.responses', 5, 2),
      await broker.createTopic('logs.errors', 3, 2),
      await broker.createTopic('logs.info', 3, 2),
      await broker.createTopic('analytics.events', 10, 2)
    ];

    console.log('✓ Topics created\n');

    // === Pattern 1: Request-Response ===
    console.log('--- Pattern 1: Request-Response ---');

    const correlationMap = new Map();

    // Subscribe to responses
    await broker.subscribe('api.responses', 'api-gateway', {
      filter: {
        headers: {
          // This will be dynamically set
        }
      },
      metadata: {
        pattern: 'request-response'
      }
    });

    // Add routing rule for responses
    await broker.createRoutingRule(
      'api.responses',
      [{ type: 'forward', target: 'response-handler' }],
      { name: 'Response Routing' }
    );

    // Send requests
    for (let i = 1; i <= 3; i++) {
      const correlationId = `req-${i}`;
      correlationMap.set(correlationId, `response-${i}`);

      const result = await broker.publish('api.requests', {
        method: 'GET',
        path: `/users/${i}`,
        timestamp: Date.now()
      }, {
        correlationId,
        replyTo: 'api.responses',
        contentType: 'application/json'
      });

      console.log(`✓ Request ${i} sent: ${result.messageId} (Correlation: ${correlationId})`);
    }

    // === Pattern 2: Message Transformation ===
    console.log('\n--- Pattern 2: Message Transformation ---');

    await broker.createRoutingRule(
      'analytics.events',
      [{
        type: 'transform',
        transform: {
          payload: {
            operation: 'replace',
            value: {
              eventType: 'page_view',
              timestamp: Date.now(),
              processed: true
            }
          }
        }
      }],
      { name: 'Event Transformation' }
    );

    const subscriptions = [
      await broker.subscribe('analytics.events.processed', 'analytics-processor', {
        deliveryGuarantee: 'at-least-once',
        batchSize: 100,
        metadata: { pattern: 'analytics' }
      })
    ];

    // Send raw events
    const rawEvents = [
      { event: 'page_view', userId: 123, page: '/home' },
      { event: 'page_view', userId: 456, page: '/products' },
      { event: 'page_view', userId: 789, page: '/checkout' }
    ];

    for (const event of rawEvents) {
      await broker.publish('analytics.events', event);
    }

    console.log('✓ Raw events published (will be transformed)');

    // === Pattern 3: Message Filtering ===
    console.log('\n--- Pattern 3: Message Filtering ---');

    await broker.createRoutingRule(
      'logs.*',
      [{
        type: 'filter',
        filter: {
          payload: {
            level: 'error'
          }
        }
      }],
      { name: 'Error Log Filtering' }
    );

    const errorSubscription = await broker.subscribe('logs.errors', 'error-monitor', {
      deliveryGuarantee: 'exactly-once',
      deadLetterQueue: 'logs.errors.deadletter',
      metadata: { pattern: 'error-monitoring' }
    );

    // Send different log levels
    const logMessages = [
      { level: 'info', message: 'User logged in', timestamp: Date.now() },
      { level: 'error', message: 'Database connection failed', timestamp: Date.now() },
      { level: 'warn', message: 'High memory usage', timestamp: Date.now() },
      { level: 'error', message: 'Payment processing failed', timestamp: Date.now() }
    ];

    for (const log of logMessages) {
      await broker.publish('logs.application', log);
    }

    console.log('✓ Log messages published (errors will be filtered)');

    // === Pattern 4: Fan-Out ===
    console.log('\n--- Pattern 4: Fan-Out Distribution ---');

    // Subscribe multiple services to the same topic
    const fanOutServices = ['notification-service', 'email-service', 'sms-service'];
    for (const service of fanOutServices) {
      await broker.subscribe('user-events', service, {
        deliveryGuarantee: 'at-least-once',
        metadata: { pattern: 'fan-out' }
      });
    }

    await broker.publish('user-events', {
      event: 'user_signup',
      userId: 12345,
      email: 'user@example.com',
      timestamp: Date.now()
    });

    console.log('✓ User event published to all subscribers');

    // === Pattern 5: Dead Letter Queue ===
    console.log('\n--- Pattern 5: Dead Letter Queue ---');

    // Subscribe to a topic that will fail
    await broker.subscribe('failing-topic', 'failing-service', {
      deliveryGuarantee: 'at-least-once',
      deadLetterQueue: 'failing-topic.dlq',
      retryPolicy: {
        maxRetries: 2,
        initialDelay: 1000,
        maxDelay: 5000,
        backoffMultiplier: 2,
        jitter: true
      },
      metadata: { pattern: 'dlq-demo' }
    });

    // This message will fail delivery
    await broker.publish('failing-topic', {
      data: 'will-fail',
      config: 'invalid'
    });

    console.log('✓ Message published that will fail and go to DLQ');

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check statistics
    const stats = await broker.getStats();
    console.log('\n--- Final Statistics ---');
    console.log(`Total Topics: ${stats.totalTopics}`);
    console.log(`Total Subscriptions: ${stats.totalSubscriptions}`);
    console.log(`Total Messages: ${stats.totalMessages}`);
    console.log(`Message Rate: ${stats.messageRate.toFixed(2)} msg/s`);

    const metrics = await broker.getMetrics();
    console.log('\n--- Detailed Metrics ---');
    console.log(`Topics: ${metrics.topics.total} with ${metrics.topics.messages} messages`);
    console.log(`Subscribers: ${metrics.subscribers.total} (${metrics.subscribers.healthy} healthy)`);
    console.log(`Delivery: ${metrics.delivery.total} total, ${metrics.delivery.successful} successful`);
    console.log(`Dead Letters: ${metrics.subscribers.deadLetterCount}`);

    // Get all subscriptions
    const allSubscriptions = await broker.getSubscriptions();
    console.log('\n--- All Subscriptions ---');
    allSubscriptions.forEach(sub => {
      console.log(`- ${sub.subscriber} -> ${sub.topic}`);
    });

    // Get topics
    const allTopics = await broker.getTopics();
    console.log('\n--- All Topics ---');
    allTopics.forEach(topic => {
      console.log(`- ${topic.name} (Partitions: ${topic.partitions})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await broker.stop();
    console.log('\n✓ Broker stopped');
  }
}

// Run the advanced patterns example
advancedPatternsExample().catch(console.error);