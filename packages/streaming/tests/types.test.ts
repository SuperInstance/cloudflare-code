import {
  Event,
  Stream,
  StreamObserver,
  Subscription,
  WindowConfig,
  AggregationConfig,
  JoinConfig,
  ProcessingConfig,
  FaultToleranceConfig,
  SourceConfig,
  ProcessorMetrics,
  TransformMetrics
} from '../src/types';

describe('Stream Types', () => {
  describe('Event', () => {
    it('should create event with required fields', () => {
      const event: Event = {
        id: 'test-event-1',
        timestamp: Date.now(),
        data: { value: 'test' }
      };

      expect(event.id).toBe('test-event-1');
      expect(event.timestamp).toBeInstanceOf(Number);
      expect(event.data).toEqual({ value: 'test' });
    });

    it('should create event with all fields', () => {
      const event: Event = {
        id: 'test-event-1',
        timestamp: Date.now(),
        data: { value: 'test' },
        metadata: { source: 'test' },
        key: 'test-key',
        headers: { 'content-type': 'application/json' },
        sequence: 1
      };

      expect(event).toEqual({
        id: 'test-event-1',
        timestamp: expect.any(Number),
        data: { value: 'test' },
        metadata: { source: 'test' },
        key: 'test-key',
        headers: { 'content-type': 'application/json' },
        sequence: 1
      });
    });
  });

  describe('Stream', () => {
    it('should have required fields', () => {
      const stream: Stream = {
        id: 'test-stream',
        name: 'Test Stream',
        source: 'test',
        subscribe: jest.fn()
      };

      expect(stream.id).toBe('test-stream');
      expect(stream.name).toBe('Test Stream');
      expect(stream.source).toBe('test');
      expect(stream.subscribe).toBeDefined();
    });

    it('should have optional schema', () => {
      const stream: Stream = {
        id: 'test-stream',
        name: 'Test Stream',
        source: 'test',
        schema: {
          type: 'json',
          schema: {}
        },
        subscribe: jest.fn()
      };

      expect(stream.schema).toEqual({
        type: 'json',
        schema: {}
      });
    });
  });

  describe('StreamObserver', () => {
    it('should define optional callback functions', () => {
      const observer: StreamObserver = {
        next: jest.fn(),
        error: jest.fn(),
        complete: jest.fn()
      };

      expect(observer.next).toBeDefined();
      expect(observer.error).toBeDefined();
      expect(observer.complete).toBeDefined();
    });
  });

  describe('Subscription', () => {
    it('should have required fields', () => {
      const subscription: Subscription = {
        id: 'sub-1',
        closed: false,
        unsubscribe: jest.fn()
      };

      expect(subscription.id).toBe('sub-1');
      expect(subscription.closed).toBe(false);
      expect(subscription.unsubscribe).toBeDefined();
    });
  });

  describe('WindowConfig', () => {
    it('should create time window', () => {
      const config: WindowConfig = {
        type: 'time',
        size: 1000,
        slide: 500
      };

      expect(config).toEqual({
        type: 'time',
        size: 1000,
        slide: 500
      });
    });

    it('should create count window', () => {
      const config: WindowConfig = {
        type: 'count',
        size: 100,
        gap: 50
      };

      expect(config).toEqual({
        type: 'count',
        size: 100,
        gap: 50
      });
    });

    it('should create session window', () => {
      const config: WindowConfig = {
        type: 'session',
        size: 30000,
        gap: 10000
      };

      expect(config).toEqual({
        type: 'session',
        size: 30000,
        gap: 10000
      });
    });
  });

  describe('AggregationConfig', () => {
    it('should create simple aggregation', () => {
      const config: AggregationConfig = {
        operation: 'sum',
        field: 'value'
      };

      expect(config).toEqual({
        operation: 'sum',
        field: 'value'
      });
    });

    it('should create aggregation with windows', () => {
      const config: AggregationConfig = {
        operation: 'avg',
        field: 'value',
        windows: [
          {
            type: 'time',
            size: 60000,
            slide: 30000
          }
        ],
        groupBy: ['category']
      };

      expect(config).toEqual({
        operation: 'avg',
        field: 'value',
        windows: [
          {
            type: 'time',
            size: 60000,
            slide: 30000
          }
        ],
        groupBy: ['category']
      });
    });
  });

  describe('JoinConfig', () => {
    it('should create join configuration', () => {
      const config: JoinConfig = {
        type: 'inner',
        streams: ['stream1', 'stream2'],
        fields: {
          left: 'id',
          right: 'foreign_id'
        },
        window: {
          type: 'time',
          size: 30000,
          slide: 15000
        }
      };

      expect(config).toEqual({
        type: 'inner',
        streams: ['stream1', 'stream2'],
        fields: {
          left: 'id',
          right: 'foreign_id'
        },
        window: {
          type: 'time',
          size: 30000,
          slide: 15000
        }
      });
    });
  });

  describe('ProcessingConfig', () => {
    it('should create basic processing config', () => {
      const config: ProcessingConfig = {
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

      expect(config).toEqual({
        concurrency: 4,
        batchSize: 100,
        maxRetries: 3,
        timeout: 5000,
        backpressure: {
          enabled: true,
          threshold: 1000,
          strategy: 'buffer'
        }
      });
    });
  });

  describe('FaultToleranceConfig', () => {
    it('should create at-least-once config', () => {
      const config: FaultToleranceConfig = {
        strategy: 'at-least-once',
        checkpointing: {
          interval: 10000,
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

      expect(config).toEqual({
        strategy: 'at-least-once',
        checkpointing: {
          interval: 10000,
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
      });
    });
  });

  describe('SourceConfig', () => {
    it('should create Kafka source config', () => {
      const config: SourceConfig = {
        type: 'kafka',
        connection: {
          brokers: ['localhost:9092'],
          topic: 'test-topic'
        },
        options: {
          batchSize: 100,
          maxRetries: 3,
          partitioning: {
            strategy: 'round-robin'
          }
        }
      };

      expect(config).toEqual({
        type: 'kafka',
        connection: {
          brokers: ['localhost:9092'],
          topic: 'test-topic'
        },
        options: {
          batchSize: 100,
          maxRetries: 3,
          partitioning: {
            strategy: 'round-robin'
          }
        }
      });
    });

    it('should create HTTP source config', () => {
      const config: SourceConfig = {
        type: 'http',
        connection: {
          url: 'https://api.example.com/data',
          method: 'GET',
          headers: { 'Authorization': 'Bearer token' }
        },
        options: {
          timeout: 10000,
          maxRetries: 5
        }
      };

      expect(config).toEqual({
        type: 'http',
        connection: {
          url: 'https://api.example.com/data',
          method: 'GET',
          headers: { 'Authorization': 'Bearer token' }
        },
        options: {
          timeout: 10000,
          maxRetries: 5
        }
      });
    });
  });

  describe('ProcessorMetrics', () => {
    it('should create default metrics', () => {
      const metrics: ProcessorMetrics = {
        eventsProcessed: 0,
        errors: 0,
        lastProcessedTime: 0,
        avgProcessingTime: 0,
        throughput: 0,
        memoryUsage: 0,
        checkpointStatus: {
          lastCheckpoint: 0,
          nextCheckpoint: 0
        }
      };

      expect(metrics).toEqual({
        eventsProcessed: 0,
        errors: 0,
        lastProcessedTime: 0,
        avgProcessingTime: 0,
        throughput: 0,
        memoryUsage: 0,
        checkpointStatus: {
          lastCheckpoint: 0,
          nextCheckpoint: 0
        }
      });
    });

    it('should create metrics with values', () => {
      const metrics: ProcessorMetrics = {
        eventsProcessed: 1000,
        errors: 5,
        lastProcessedTime: Date.now(),
        avgProcessingTime: 12.5,
        throughput: 83.3,
        memoryUsage: 1024000,
        checkpointStatus: {
          lastCheckpoint: Date.now(),
          nextCheckpoint: Date.now() + 10000
        }
      };

      expect(metrics.eventsProcessed).toBe(1000);
      expect(metrics.errors).toBe(5);
      expect(metrics.avgProcessingTime).toBe(12.5);
    });
  });

  describe('TransformMetrics', () => {
    it('should create default transform metrics', () => {
      const metrics: TransformMetrics = {
        operations: {},
        cache: {
          hits: 0,
          misses: 0,
          size: 0
        }
      };

      expect(metrics).toEqual({
        operations: {},
        cache: {
          hits: 0,
          misses: 0,
          size: 0
        }
      });
    });

    it('should create transform metrics with operations', () => {
      const metrics: TransformMetrics = {
        operations: {
          map: {
            count: 100,
            duration: 500,
            errors: 0
          },
          filter: {
            count: 50,
            duration: 250,
            errors: 1
          }
        },
        cache: {
          hits: 80,
          misses: 20,
          size: 100
        }
      };

      expect(metrics.operations.map.count).toBe(100);
      expect(metrics.operations.filter.errors).toBe(1);
      expect(metrics.cache.hits).toBe(80);
      expect(metrics.cache.misses).toBe(20);
    });
  });
});