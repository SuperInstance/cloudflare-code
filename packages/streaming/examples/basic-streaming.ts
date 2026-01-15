import {
  StreamingPlatform,
  Event,
  WindowConfig,
  AggregationConfig,
  FaultToleranceConfig,
  ProcessingConfig,
  SourceConfig
} from '../src/index';

async function basicStreamingExample() {
  console.log('🚀 Basic Streaming Example');
  console.log('==============================\n');

  const platform = StreamingPlatform;

  const processingConfig: ProcessingConfig = {
    concurrency: 4,
    batchSize: 100,
    maxRetries: 3,
    timeout: 5000,
    backpressure: {
      enabled: true,
      threshold: 1000,
      strategy: 'buffer'
    }
  };

  const faultConfig: FaultToleranceConfig = {
    strategy: 'at-least-once',
    checkpointing: {
      interval: 5000,
      maxSnapshots: 10,
      storage: {
        type: 'memory',
        config: {}
      }
    },
    recovery: {
      maxAttempts: 3,
      backoff: {
        initial: 1000,
        max: 10000,
        multiplier: 2
      }
    },
    idempotency: {
      enabled: true,
      ttl: 60000
    }
  };

  const processor = platform.createProcessor<number>(processingConfig, faultConfig);

  console.log('📊 Creating time-based aggregation window...');
  processor.addWindow(
    { type: 'time', size: 5000, slide: 2500 },
    (window) => {
      const sum = window.events.reduce((acc, event) => acc + (event.data as number), 0);
      return {
        timestamp: Date.now(),
        windowId: window.id,
        eventCount: window.events.length,
        sum
      };
    }
  );

  processor.on('windowResult', (window, result) => {
    console.log(`📈 Window [${result.windowId}]: ${result.eventCount} events, Sum: ${result.sum}`);
  });

  console.log('🔧 Adding state management...');
  processor.addState('total', 0, async (key, state, event) => {
    return state + (event.data as number);
  });

  processor.on('windowResult', (window, result) => {
    const currentState = processor.getMetrics();
    console.log(`📊 Current total: ${currentState.eventsProcessed} events processed`);
  });

  console.log('🔌 Creating HTTP source connector...');
  const httpSource: SourceConfig = {
    type: 'http',
    connection: {
      url: 'https://api.example.com/metrics',
      interval: 1000,
      timeout: 5000,
      transform: (data) => data.map((item: any) => ({
        id: item.id,
        timestamp: Date.now(),
        data: item.value
      }))
    }
  };

  const stream = platform.createSourceStream<number>(httpSource);

  console.log('📡 Starting stream processing...');
  processor.process(stream);

  const events = Array.from({ length: 100 }, (_, i) => ({
    id: `event-${i}`,
    timestamp: Date.now() + i * 100,
    data: Math.floor(Math.random() * 100)
  }));

  events.forEach(event => {
    stream.emit('data', event);
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  const metrics = processor.getMetrics();
  console.log('\n📊 Processing Metrics:');
  console.log(`   Events Processed: ${metrics.eventsProcessed}`);
  console.log(`   Errors: ${metrics.errors}`);
  console.log(`   Average Processing Time: ${metrics.avgProcessingTime.toFixed(2)}ms`);
  console.log(`   Throughput: ${metrics.throughput.toFixed(2)} events/sec`);

  processor.stop();
}

basicStreamingExample().catch(console.error);