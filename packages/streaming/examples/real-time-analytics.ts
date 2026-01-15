import {
  StreamingPlatform,
  Event,
  AggregationConfig,
  FaultToleranceConfig,
  ProcessingConfig,
  SourceConfig
} from '../src/index';

async function realTimeAnalyticsExample() {
  console.log('📈 Real-Time Analytics Example');
  console.log('==============================\n');

  const platform = StreamingPlatform;

  const processingConfig: ProcessingConfig = {
    concurrency: 8,
    batchSize: 200,
    maxRetries: 5,
    timeout: 3000,
    backpressure: {
      enabled: true,
      threshold: 5000,
      strategy: 'buffer'
    }
  };

  const faultConfig: FaultToleranceConfig = {
    strategy: 'exactly-once',
    checkpointing: {
      interval: 2000,
      maxSnapshots: 20,
      storage: {
        type: 'memory',
        config: {}
      }
    },
    recovery: {
      maxAttempts: 5,
      backoff: {
        initial: 500,
        max: 15000,
        multiplier: 1.5
      }
    },
    idempotency: {
      enabled: true,
      keyGenerator: (event) => `${event.key || event.id}:${event.sequence || 0}`,
      ttl: 120000
    }
  };

  const processor = platform.createProcessor(processingConfig, faultConfig);

  console.log('🔍 Setting up complex analytics pipeline...');

  const userActivityAgg: AggregationConfig = {
    operation: 'count',
    field: 'userId',
    windows: [
      {
        type: 'time',
        size: 60000,
        slide: 30000
      }
    ]
  };

  const revenueAgg: AggregationConfig = {
    operation: 'sum',
    field: 'amount',
    windows: [
      {
        type: 'time',
        size: 300000,
        slide: 60000
      }
    ],
    groupBy: ['paymentMethod']
  };

  const transformEngine = platform.createTransformEngine();

  transformEngine
    .map((event) => ({
      ...event,
      data: {
        ...event.data,
        normalizedAmount: parseFloat(event.data.amount) || 0,
        sessionDuration: event.data.sessionEnd - event.data.sessionStart
      }
    }))
    .filter((event) => event.data.normalizedAmount > 0)
    .aggregate(userActivityAgg, 'userActivity')
    .aggregate(revenueAgg, 'revenueAnalysis');

  transformEngine.on('windowAggregate', (result) => {
    if (result.metadata?.operation === 'count') {
      console.log(`👥 Active Users: ${result.data} (last 60s)`);
    } else if (result.metadata?.operation === 'sum') {
      console.log(`💰 Revenue: $${result.data.toFixed(2)} by ${result.metadata.groupBy?.[0]}`);
    }
  });

  console.log('🔌 Setting up WebSocket connector for live data...');
  const wsSource: SourceConfig = {
    type: 'websocket',
    connection: {
      url: 'wss://analytics.example.com/live',
      reconnect: true,
      reconnectInterval: 2000,
      maxReconnectAttempts: 10
    }
  };

  const stream = platform.createSourceStream(wsSource);

  console.log('📊 Setting up state management for metrics...');

  processor.addState('totalRevenue', 0, async (key, state, event) => {
    return state + (event.data.normalizedAmount || 0);
  });

  processor.addState('activeUsers', new Set(), async (key, state, event) => {
    const userId = event.data.userId;
    const newState = new Set(state);
    if (event.data.action === 'login') {
      newState.add(userId);
    } else if (event.data.action === 'logout') {
      newState.delete(userId);
    }
    return newState;
  });

  processor.on('windowResult', (window, result) => {
    if (window.id.includes('revenue')) {
      console.log(`💼 Total Revenue: $${result.sum.toFixed(2)}`);
    }
  });

  console.log('🎯 Processing live events...');
  processor.process(stream);

  const sampleEvents = [
    {
      id: 'session-1',
      timestamp: Date.now(),
      data: {
        userId: 'user-123',
        action: 'login',
        sessionStart: Date.now(),
        amount: 29.99,
        paymentMethod: 'credit_card'
      }
    },
    {
      id: 'session-2',
      timestamp: Date.now() + 1000,
      data: {
        userId: 'user-456',
        action: 'login',
        sessionStart: Date.now(),
        amount: 49.99,
        paymentMethod: 'paypal'
      }
    },
    {
      id: 'purchase-1',
      timestamp: Date.now() + 2000,
      data: {
        userId: 'user-123',
        action: 'purchase',
        amount: 99.99,
        paymentMethod: 'credit_card'
      }
    },
    {
      id: 'logout-1',
      timestamp: Date.now() + 3000,
      data: {
        userId: 'user-123',
        action: 'logout',
        sessionEnd: Date.now()
      }
    }
  ];

  sampleEvents.forEach(event => {
    stream.emit('data', event);
  });

  await new Promise(resolve => setTimeout(resolve, 5000));

  const metrics = processor.getMetrics();
  console.log('\n📊 Analytics Metrics:');
  console.log(`   Events Processed: ${metrics.eventsProcessed}`);
  console.log(`   Throughput: ${metrics.throughput.toFixed(2)} events/sec`);
  console.log(`   Average Processing Time: ${metrics.avgProcessingTime.toFixed(2)}ms`);
  console.log(`   Memory Usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`);

  processor.stop();
}

realTimeAnalyticsExample().catch(console.error);