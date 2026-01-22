import { TransformEngine, TransformEngineFactory } from '../src/transform';
import { Event, WindowConfig, AggregationConfig } from '../src/types';

describe('TransformEngine', () => {
  let engine: TransformEngine;

  beforeEach(() => {
    engine = new TransformEngine({
      batchSize: 100,
      enableCaching: true,
      cacheSize: 1000,
      cacheTTL: 60000
    });
  });

  afterEach(() => {
    engine.clearCache();
  });

  describe('Map Operation', () => {
    it('should transform events using map', async () => {
      const mapFn = jest.fn((event: Event) => ({
        ...event,
        data: { ...event.data, transformed: true }
      }));

      engine.map(mapFn);

      const event = { id: '1', timestamp: Date.now(), data: { value: 'test' } };
      const result = await engine.transform(event);

      expect(mapFn).toHaveBeenCalledWith(event, expect.any(Object));
      expect(result.data).toEqual({ value: 'test', transformed: true });
    });

    it('should handle async map operations', async () => {
      const asyncMapFn = jest.fn(async (event: Event) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          ...event,
          data: { ...event.data, async: true }
        };
      });

      engine.map(asyncMapFn);

      const event = { id: '1', timestamp: Date.now(), data: { value: 'test' } };
      const result = await engine.transform(event);

      expect(asyncMapFn).toHaveBeenCalledWith(event, expect.any(Object));
      expect(result.data.async).toBe(true);
    });
  });

  describe('Filter Operation', () => {
    it('should filter events based on predicate', async () => {
      const filterFn = jest.fn((event: Event) => event.data.value > 5);

      engine.filter(filterFn);

      const event1 = { id: '1', timestamp: Date.now(), data: { value: 10 } };
      const event2 = { id: '2', timestamp: Date.now(), data: { value: 3 } };

      const result1 = await engine.transform(event1);
      const result2 = await engine.transform(event2);

      expect(filterFn).toHaveBeenCalledWith(event1, expect.any(Object));
      expect(filterFn).toHaveBeenCalledWith(event2, expect.any(Object));
      expect(result1).toBeTruthy();
      expect(result2).toBeNull();
    });

    it('should allow events when filter returns true', async () => {
      const filterFn = jest.fn(() => true);

      engine.filter(filterFn);

      const event = { id: '1', timestamp: Date.now(), data: { value: 'test' } };
      const result = await engine.transform(event);

      expect(result).toEqual(event);
    });
  });

  describe('Aggregation', () => {
    it('should perform sum aggregation', async () => {
      const config: AggregationConfig = {
        operation: 'sum',
        field: 'value'
      };

      engine.aggregate(config);

      const event1 = { id: '1', timestamp: Date.now(), data: { value: 10 } };
      const event2 = { id: '2', timestamp: Date.now(), data: { value: 20 } };
      const event3 = { id: '3', timestamp: Date.now(), data: { value: 30 } };

      await engine.transform(event1);
      await engine.transform(event2);
      await engine.transform(event3);

      const aggregationResult = await new Promise(resolve => {
        engine.once('transformComplete', () => {
          const metrics = engine.getMetrics();
          const sumOp = metrics.operations['sum'];
          resolve(sumOp);
        });
      });

      expect(sumOp).toBeDefined();
    });

    it('should perform count aggregation', async () => {
      const config: AggregationConfig = {
        operation: 'count',
        field: 'value'
      };

      engine.aggregate(config);

      const events = [
        { id: '1', timestamp: Date.now(), data: { value: 1 } },
        { id: '2', timestamp: Date.now(), data: { value: 1 } },
        { id: '3', timestamp: Date.now(), data: { value: 1 } }
      ];

      for (const event of events) {
        await engine.transform(event);
      }

      const metrics = engine.getMetrics();
      const countOp = metrics.operations['count'];

      expect(countOp).toBeDefined();
    });
  });

  describe('Caching', () => {
    it('should cache transformed events', async () => {
      const mapFn = jest.fn((event: Event) => ({
        ...event,
        data: { ...event.data, cached: true }
      }));

      engine.map(mapFn);

      const event = { id: '1', timestamp: Date.now(), data: { value: 'test' } };

      await engine.transform(event);
      await engine.transform(event);

      expect(mapFn).toHaveBeenCalledTimes(1);

      const cacheMetrics = engine.getMetrics().cache;
      expect(cacheMetrics.hits).toBe(1);
      expect(cacheMetrics.misses).toBe(1);
    });

    it('should clear cache when requested', () => {
      engine.clearCache();

      const cacheMetrics = engine.getMetrics().cache;
      expect(cacheMetrics.size).toBe(0);
      expect(cacheMetrics.hits).toBe(0);
      expect(cacheMetrics.misses).toBe(0);
    });
  });

  describe('Metrics', () => {
    it('should track operation metrics', async () => {
      engine.map((event: Event) => event);

      const event = { id: '1', timestamp: Date.now(), data: {} };
      await engine.transform(event);

      const metrics = engine.getMetrics();
      expect(metrics.operations).toHaveProperty('default');
      expect(metrics.operations.default.count).toBe(1);
    });

    it('should reset metrics when requested', () => {
      engine.resetMetrics();

      const metrics = engine.getMetrics();
      expect(Object.keys(metrics.operations).length).toBe(0);
      expect(metrics.cache.hits).toBe(0);
      expect(metrics.cache.misses).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle transformation errors', async () => {
      const errorFn = jest.fn(() => {
        throw new Error('Transform error');
      });

      engine.map(errorFn);

      const event = { id: '1', timestamp: Date.now(), data: { value: 'test' } };

      await expect(engine.transform(event)).rejects.toThrow('Transform error');
    });

    it('should emit transform error event', async () => {
      const errorFn = jest.fn(() => {
        throw new Error('Transform error');
      });

      const errorCallback = jest.fn();
      engine.on('transformError', errorCallback);

      engine.map(errorFn);

      const event = { id: '1', timestamp: Date.now(), data: { value: 'test' } };

      await expect(engine.transform(event)).rejects.toThrow();

      expect(errorCallback).toHaveBeenCalledWith(
        expect.any(Error),
        event,
        expect.any(Object)
      );
    });
  });

  describe('Batch Processing', () => {
    it('should emit batch events', async () => {
      const batchCallback = jest.fn();
      engine.on('batch', batchCallback);

      engine.map((event: Event) => event);

      const events = Array.from({ length: 50 }, (_, i) => ({
        id: `${i}`,
        timestamp: Date.now() + i * 100,
        data: { value: i }
      }));

      for (const event of events) {
        await engine.transform(event);
      }

      expect(batchCallback).toHaveBeenCalledWith(expect.arrayContaining(events));
    });
  });
});

describe('TransformEngineFactory', () => {
  describe('createWithAggregation', () => {
    it('should create engine with multiple aggregations', () => {
      const configs: AggregationConfig[] = [
        { operation: 'sum', field: 'value' },
        { operation: 'count', field: 'value' }
      ];

      const engine = TransformEngineFactory.createWithAggregation(configs);

      expect(engine).toBeInstanceOf(TransformEngine);
    });
  });

  describe('createWithPipeline', () => {
    it('should create engine with predefined operations', () => {
      const operations = [
        {
          type: 'map' as const,
          name: 'uppercase',
          config: {},
          fn: (event: Event) => ({
            ...event,
            data: { ...event.data, value: event.data.value.toUpperCase() }
          })
        }
      ];

      const engine = TransformEngineFactory.createWithPipeline(operations);

      expect(engine).toBeInstanceOf(TransformEngine);
    });
  });

  describe('create', () => {
    it('should create basic engine', () => {
      const engine = TransformEngineFactory.create();

      expect(engine).toBeInstanceOf(TransformEngine);
    });
  });
});