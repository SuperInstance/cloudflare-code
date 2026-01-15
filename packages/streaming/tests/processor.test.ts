import { StreamProcessorImpl, TimeWindow, CountWindow, SessionWindow } from '../src/processor';
import { Event, WindowConfig, FaultToleranceConfig, ProcessingConfig } from '../src/types';

describe('StreamProcessor', () => {
  let processor: StreamProcessorImpl;
  let mockStream: any;
  let eventCallback: jest.Mock;
  let errorCallback: jest.Mock;

  beforeEach(() => {
    const processingConfig: ProcessingConfig = {
      concurrency: 1,
      batchSize: 10,
      maxRetries: 3,
      timeout: 5000,
      backpressure: {
        enabled: true,
        threshold: 100,
        strategy: 'buffer'
      }
    };

    const faultConfig: FaultToleranceConfig = {
      strategy: 'at-least-once',
      checkpointing: {
        interval: 5000,
        maxSnapshots: 5,
        storage: { type: 'memory', config: {} }
      },
      recovery: {
        maxAttempts: 3,
        backoff: {
          initial: 1000,
          max: 5000,
          multiplier: 2
        }
      },
      idempotency: {
        enabled: true,
        ttl: 60000
      }
    };

    processor = new StreamProcessorImpl(processingConfig, faultConfig);

    eventCallback = jest.fn();
    errorCallback = jest.fn();

    mockStream = {
      id: 'test-stream',
      name: 'test',
      source: 'test',
      subscribe: jest.fn((observer) => {
        return {
          id: 'sub-1',
          closed: false,
          unsubscribe: jest.fn()
        };
      })
    };

    processor.on('windowResult', eventCallback);
    processor.on('error', errorCallback);
  });

  afterEach(() => {
    processor.stop();
  });

  describe('Time Window', () => {
    it('should process events in time windows', async () => {
      const windowFn = jest.fn((window: TimeWindow) => {
        return window.events.map(e => e.data).join(',');
      });

      processor.addWindow(
        { type: 'time', size: 1000, slide: 500 },
        windowFn
      );

      processor.process(mockStream);

      const events = [
        { id: '1', timestamp: Date.now(), data: 'event1' },
        { id: '2', timestamp: Date.now() + 200, data: 'event2' },
        { id: '3', timestamp: Date.now() + 800, data: 'event3' },
        { id: '4', timestamp: Date.now() + 1200, data: 'event4' }
      ];

      events.forEach(event => {
        (mockStream.subscribe as jest.Mock).mock.calls[0][0].next(event);
      });

      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(eventCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/time_/),
          startTime: expect.any(Number),
          endTime: expect.any(Number)
        }),
        'event1,event2,event3'
      );

      expect(eventCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/time_/),
          startTime: expect.any(Number),
          endTime: expect.any(Number)
        }),
        'event4'
      );
    });
  });

  describe('Count Window', () => {
    it('should process events in count windows', async () => {
      const windowFn = jest.fn((window: CountWindow) => {
        return window.events.map(e => e.data).join(',');
      });

      processor.addWindow(
        { type: 'count', size: 2, slide: 1 },
        windowFn
      );

      processor.process(mockStream);

      const events = [
        { id: '1', timestamp: Date.now(), data: 'event1' },
        { id: '2', timestamp: Date.now() + 100, data: 'event2' },
        { id: '3', timestamp: Date.now() + 200, data: 'event3' },
        { id: '4', timestamp: Date.now() + 300, data: 'event4' }
      ];

      events.forEach(event => {
        (mockStream.subscribe as jest.Mock).mock.calls[0][0].next(event);
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      expect(windowFn).toHaveBeenCalledTimes(3);
    });
  });

  describe('State Management', () => {
    it('should maintain and update state', async () => {
      const stateFn = jest.fn(async (key: string, state: number, event: Event) => {
        return state + (event.data as number);
      });

      processor.addState('sum', 0, stateFn);

      processor.process(mockStream);

      const events = [
        { id: '1', timestamp: Date.now(), data: 1 },
        { id: '2', timestamp: Date.now() + 100, data: 2 },
        { id: '3', timestamp: Date.now() + 200, data: 3 }
      ];

      events.forEach(event => {
        (mockStream.subscribe as jest.Mock).mock.calls[0][0].next(event);
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      expect(stateFn).toHaveBeenCalledWith('sum', 0, events[0]);
      expect(stateFn).toHaveBeenCalledWith('sum', 1, events[1]);
      expect(stateFn).toHaveBeenCalledWith('sum', 3, events[2]);
    });
  });

  describe('Metrics', () => {
    it('should track processing metrics', () => {
      const metrics = processor.getMetrics();

      expect(metrics).toMatchObject({
        eventsProcessed: 0,
        errors: 0,
        lastProcessedTime: 0,
        avgProcessingTime: 0,
        throughput: 0
      });
    });

    it('should update metrics when processing events', async () => {
      processor.process(mockStream);

      const events = [
        { id: '1', timestamp: Date.now(), data: 'test' },
        { id: '2', timestamp: Date.now() + 100, data: 'test' }
      ];

      events.forEach(event => {
        (mockStream.subscribe as jest.Mock).mock.calls[0][0].next(event);
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = processor.getMetrics();
      expect(metrics.eventsProcessed).toBeGreaterThan(0);
    });
  });

  describe('Backpressure Handling', () => {
    it('should handle backpressure when queue exceeds threshold', async () => {
      const backpressureConfig: ProcessingConfig = {
        concurrency: 1,
        batchSize: 10,
        maxRetries: 3,
        timeout: 5000,
        backpressure: {
          enabled: true,
          threshold: 5,
          strategy: 'buffer'
        }
      };

      const backpressureProcessor = new StreamProcessorImpl(
        backpressureConfig,
        processor.faultConfig
      );

      const backpressureCallback = jest.fn();
      backpressureProcessor.on('backpressure', backpressureCallback);

      backpressureProcessor.process(mockStream);

      const events = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        timestamp: Date.now() + i * 100,
        data: `event${i}`
      }));

      events.forEach(event => {
        (mockStream.subscribe as jest.Mock).mock.calls[0][0].next(event);
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(backpressureCallback).toHaveBeenCalledWith(10);
    });
  });

  describe('Checkpointing', () => {
    it('should create checkpoints', async () => {
      const checkpointSpy = jest.fn();
      processor.on('checkpoint', checkpointSpy);

      await processor.checkpoint();

      expect(checkpointSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number),
          id: expect.stringMatching(/ckpt_/)
        })
      );
    });
  });
});