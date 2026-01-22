import {
  StreamingPlatform,
  Event,
  ProcessingConfig,
  FaultToleranceConfig,
  SourceConfig
} from '../src/index';

async function connectorsDemo() {
  console.log('🔌 Source Connectors Demo');
  console.log('=========================\n');

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

  const processor = platform.createProcessor(processingConfig, faultConfig);

  console.log('📊 Setting up processing pipeline...');

  processor.addWindow(
    { type: 'count', size: 10, slide: 5 },
    (window) => {
      return {
        windowId: window.id,
        eventCount: window.events.length,
        averageValue: window.events.reduce((acc, e) => acc + (e.data.value || 0), 0) / window.events.length
      };
    }
  );

  processor.on('windowResult', (window, result) => {
    console.log(`📈 Window [${result.windowId}]: ${result.eventCount} events, Avg: ${result.averageValue.toFixed(2)}`);
  });

  const transformEngine = platform.createTransformEngine({
    batchSize: 50,
    enableCaching: true,
    cacheSize: 1000,
    cacheTTL: 30000
  });

  transformEngine
    .map((event) => ({
      ...event,
      data: {
        ...event.data,
        processed: true,
        processedAt: Date.now()
      }
    }))
    .filter((event) => event.data.value > 0)
    .map((event) => ({
      ...event,
      data: {
        ...event.data,
        squared: event.data.value * event.data.value
      }
    }));

  console.log('🎯 Testing different connectors...\n');

  await testHttpConnector();
  await testWebSocketConnector();
  await testDatabaseConnector();
  await testFileConnector();

  processor.stop();

  async function testHttpConnector() {
    console.log('🌐 HTTP Connector Test');
    console.log('---------------------');

    const httpSource: SourceConfig = {
      type: 'http',
      connection: {
        url: 'https://jsonplaceholder.typicode.com/posts',
        interval: 3000,
        timeout: 5000,
        transform: (data) => data.map((post: any) => ({
          id: `post-${post.id}`,
          timestamp: Date.now(),
          data: {
            title: post.title,
            body: post.body,
            value: post.id * 10,
            source: 'jsonplaceholder'
          }
        }))
      }
    };

    const stream = platform.createSourceStream(httpSource);

    const eventHandler = (event: Event) => {
      console.log(`📨 HTTP Event: ${event.id} - Value: ${event.data.value}`);
    };

    stream.on('data', eventHandler);

    console.log('⚡ Starting HTTP data stream...');
    stream.emit('connected');

    const mockResponse = [
      { id: 1, title: 'Test Post 1', body: 'Test content 1' },
      { id: 2, title: 'Test Post 2', body: 'Test content 2' },
      { id: 3, title: 'Test Post 3', body: 'Test content 3' }
    ];

    for (const post of mockResponse) {
      stream.emit('data', {
        id: `post-${post.id}`,
        timestamp: Date.now(),
        data: {
          title: post.title,
          body: post.body,
          value: post.id * 10,
          source: 'jsonplaceholder'
        }
      });
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    stream.off('data', eventHandler);
  }

  async function testWebSocketConnector() {
    console.log('\n🔌 WebSocket Connector Test');
    console.log('--------------------------');

    const wsSource: SourceConfig = {
      type: 'websocket',
      connection: {
        url: 'ws://localhost:8080/analytics',
        reconnect: true,
        reconnectInterval: 2000,
        maxReconnectAttempts: 3
      }
    };

    const stream = platform.createSourceStream(wsSource);

    stream.on('connected', () => {
      console.log('✅ WebSocket connected');
    });

    stream.on('data', (event: Event) => {
      console.log(`📡 WebSocket Event: ${event.id} - ${event.data.message}`);
    });

    console.log('⚡ Simulating WebSocket messages...');

    const mockMessages = [
      { type: 'user_action', message: 'User logged in', value: 1 },
      { type: 'user_action', message: 'User clicked button', value: 2 },
      { type: 'user_action', message: 'User made purchase', value: 100 }
    ];

    for (const msg of mockMessages) {
      stream.emit('data', {
        id: `ws-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        data: msg
      });
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  async function testDatabaseConnector() {
    console.log('\n🗄️ Database Connector Test');
    console.log('-------------------------');

    const dbSource: SourceConfig = {
      type: 'database',
      connection: {
        connectionString: 'postgresql://localhost:5432/testdb',
        query: 'SELECT id, name, value FROM metrics ORDER BY created_at DESC LIMIT 100',
        interval: 5000,
        transform: (row: any) => ({
          id: `db-${row.id}`,
          timestamp: Date.now(),
          data: {
            name: row.name,
            value: row.value,
            source: 'database'
          }
        })
      }
    };

    const stream = platform.createSourceStream(dbSource);

    stream.on('data', (event: Event) => {
      console.log(`💾 DB Event: ${event.data.name} - Value: ${event.data.value}`);
    });

    console.log('⚡ Simulating database results...');

    const mockResults = [
      { id: 1, name: 'CPU Usage', value: 75.5 },
      { id: 2, name: 'Memory Usage', value: 62.3 },
      { id: 3, name: 'Disk Usage', value: 45.8 }
    ];

    for (const row of mockResults) {
      stream.emit('data', {
        id: `db-${row.id}`,
        timestamp: Date.now(),
        data: row
      });
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  async function testFileConnector() {
    console.log('\n📁 File Connector Test');
    console.log('---------------------');

    const fileSource: SourceConfig = {
      type: 'file',
      connection: {
        path: '/tmp/metrics.json',
        format: 'json',
        interval: 2000,
        transform: (data) => ({
          id: `file-${data.id}`,
          timestamp: Date.now(),
          data: {
            metric: data.name,
            value: data.value,
            source: 'file'
          }
        })
      }
    };

    const stream = platform.createSourceStream(fileSource);

    stream.on('data', (event: Event) => {
      console.log(`📄 File Event: ${event.data.metric} - Value: ${event.data.value}`);
    });

    console.log('⚡ Simulating file content...');

    const mockFileContent = [
      { id: 1, name: 'requests_per_second', value: 1500 },
      { id: 2, name: 'error_rate', value: 0.05 },
      { id: 3, name: 'response_time', value: 250 }
    ];

    for (const item of mockFileContent) {
      stream.emit('data', {
        id: `file-${item.id}`,
        timestamp: Date.now(),
        data: item
      });
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  const metrics = processor.getMetrics();
  console.log('\n📊 Connector Demo Summary:');
  console.log(`   Total Events Processed: ${metrics.eventsProcessed}`);
  console.log(`   Errors: ${metrics.errors}`);
  console.log(`   Average Processing Time: ${metrics.avgProcessingTime.toFixed(2)}ms`);
  console.log(`   Throughput: ${metrics.throughput.toFixed(2)} events/sec`);
}

connectorsDemo().catch(console.error);