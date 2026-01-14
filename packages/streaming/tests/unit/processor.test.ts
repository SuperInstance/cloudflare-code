/**
 * Unit tests for Stream Processing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StreamTransformer,
  WindowOperator,
  StreamAggregator,
  Aggregations,
  StreamJoiner,
  ComplexEventProcessor,
  Patterns,
} from '../../src/processing/processor';
import type { StreamEvent, WindowOptions } from '../../src/types';

describe('StreamTransformer', () => {
  it('should process events through pipeline', async () => {
    const transformer = new StreamTransformer<number, number>();

    transformer.pipe({
      process: async (event) => event.data * 2,
    });

    transformer.pipe({
      process: async (event) => event.data + 10,
    });

    const events: StreamEvent<number>[] = [
      {
        id: '1',
        type: 'test',
        data: 5,
        timestamp: Date.now(),
      },
    ];

    const results = await transformer.process(events);

    expect(results).toHaveLength(1);
    expect(results[0].data).toBe(20); // (5 * 2) + 10
  });

  it('should handle errors gracefully', async () => {
    const transformer = new StreamTransformer();

    transformer.pipe({
      process: async () => {
        throw new Error('Test error');
      },
    });

    const events: StreamEvent[] = [
      {
        id: '1',
        type: 'test',
        data: null,
        timestamp: Date.now(),
      },
    ];

    const results = await transformer.process(events);

    expect(results).toHaveLength(0);
  });

  it('should clear processors', () => {
    const transformer = new StreamTransformer();

    transformer.pipe({ process: async () => null });
    transformer.clear();

    expect(transformer['processors']).toHaveLength(0);
  });
});

describe('WindowOperator', () => {
  describe('tumbling windows', () => {
    it('should create tumbling windows', () => {
      const options: WindowOptions = {
        size: 1000,
        type: 'tumbling',
      };

      const operator = new WindowOperator(options);

      expect(operator).toBeDefined();
    });
  });

  describe('sliding windows', () => {
    it('should create sliding windows', () => {
      const options: WindowOptions = {
        size: 1000,
        slide: 500,
        type: 'sliding',
      };

      const operator = new WindowOperator(options);

      expect(operator).toBeDefined();
    });
  });

  describe('session windows', () => {
    it('should create session windows', () => {
      const options: WindowOptions = {
        size: 1000,
        type: 'session',
        sessionTimeout: 30000,
      };

      const operator = new WindowOperator(options);

      expect(operator).toBeDefined();
    });
  });
});

describe('StreamAggregator', () => {
  it('should count events', () => {
    const aggregation = Aggregations.count();
    const aggregator = new StreamAggregator(aggregation);

    const event: StreamEvent = {
      id: '1',
      type: 'test',
      data: null,
      timestamp: Date.now(),
    };

    aggregator.add(event);
    aggregator.add(event);

    expect(aggregator.getCount()).toBe(2);
    expect(aggregator.getCurrent()).toBe(2);
  });

  it('should sum values', () => {
    const aggregation = Aggregations.sum((e) => (e.data as { value: number }).value);
    const aggregator = new StreamAggregator(aggregation);

    aggregator.add({
      id: '1',
      type: 'test',
      data: { value: 10 },
      timestamp: Date.now(),
    });

    aggregator.add({
      id: '2',
      type: 'test',
      data: { value: 20 },
      timestamp: Date.now(),
    });

    expect(aggregator.getCurrent()).toBe(30);
  });

  it('should calculate average', () => {
    const aggregation = Aggregations.average((e) => (e.data as { value: number }).value);
    const aggregator = new StreamAggregator(aggregation);

    aggregator.add({
      id: '1',
      type: 'test',
      data: { value: 10 },
      timestamp: Date.now(),
    });

    aggregator.add({
      id: '2',
      type: 'test',
      data: { value: 20 },
      timestamp: Date.now(),
    });

    const result = aggregator.getCurrent() as { sum: number; count: number };
    expect(result.sum).toBe(30);
    expect(result.count).toBe(2);
  });

  it('should find min value', () => {
    const aggregation = Aggregations.min((e) => (e.data as { value: number }).value);
    const aggregator = new StreamAggregator(aggregation);

    aggregator.add({
      id: '1',
      type: 'test',
      data: { value: 10 },
      timestamp: Date.now(),
    });

    aggregator.add({
      id: '2',
      type: 'test',
      data: { value: 5 },
      timestamp: Date.now(),
    });

    aggregator.add({
      id: '3',
      type: 'test',
      data: { value: 20 },
      timestamp: Date.now(),
    });

    expect(aggregator.getCurrent()).toBe(5);
  });

  it('should find max value', () => {
    const aggregation = Aggregations.max((e) => (e.data as { value: number }).value);
    const aggregator = new StreamAggregator(aggregation);

    aggregator.add({
      id: '1',
      type: 'test',
      data: { value: 10 },
      timestamp: Date.now(),
    });

    aggregator.add({
      id: '2',
      type: 'test',
      data: { value: 20 },
      timestamp: Date.now(),
    });

    expect(aggregator.getCurrent()).toBe(20);
  });

  it('should collect values', () => {
    const aggregation = Aggregations.collect((e) => (e.data as { value: number }).value);
    const aggregator = new StreamAggregator(aggregation);

    aggregator.add({
      id: '1',
      type: 'test',
      data: { value: 10 },
      timestamp: Date.now(),
    });

    aggregator.add({
      id: '2',
      type: 'test',
      data: { value: 20 },
      timestamp: Date.now(),
    });

    expect(aggregator.getCurrent()).toEqual([10, 20]);
  });

  it('should count distinct values', () => {
    const aggregation = Aggregations.distinctCount((e) => (e.data as { category: string }).category);
    const aggregator = new StreamAggregator(aggregation);

    aggregator.add({
      id: '1',
      type: 'test',
      data: { category: 'A' },
      timestamp: Date.now(),
    });

    aggregator.add({
      id: '2',
      type: 'test',
      data: { category: 'B' },
      timestamp: Date.now(),
    });

    aggregator.add({
      id: '3',
      type: 'test',
      data: { category: 'A' },
      timestamp: Date.now(),
    });

    expect(aggregator.getCurrent().size).toBe(2);
  });

  it('should reset aggregation', () => {
    const aggregation = Aggregations.count();
    const aggregator = new StreamAggregator(aggregation);

    const event: StreamEvent = {
      id: '1',
      type: 'test',
      data: null,
      timestamp: Date.now(),
    };

    aggregator.add(event);
    aggregator.reset();

    expect(aggregator.getCount()).toBe(0);
  });
});

describe('StreamJoiner', () => {
  it('should perform inner join', () => {
    const options = {
      type: 'inner' as const,
      window: {
        size: 1000,
        type: 'tumbling' as const,
      },
      keySelector: (e: StreamEvent) => (e.data as { key: string }).key,
    };

    const joiner = new StreamJoiner(options);

    const leftEvent: StreamEvent = {
      id: '1',
      type: 'left',
      data: { key: 'A', value: 'L1' },
      timestamp: Date.now(),
    };

    const rightEvent: StreamEvent = {
      id: '2',
      type: 'right',
      data: { key: 'A', value: 'R1' },
      timestamp: Date.now(),
    };

    joiner.joinLeft(leftEvent);
    const results = joiner.joinRight(rightEvent);

    expect(results).toHaveLength(1);
    expect(results[0].left).toEqual(leftEvent);
    expect(results[0].right).toEqual(rightEvent);
  });

  it('should perform left join', () => {
    const options = {
      type: 'left' as const,
      window: {
        size: 1000,
        type: 'tumbling' as const,
      },
      keySelector: (e: StreamEvent) => (e.data as { key: string }).key,
    };

    const joiner = new StreamJoiner(options);

    const leftEvent: StreamEvent = {
      id: '1',
      type: 'left',
      data: { key: 'A', value: 'L1' },
      timestamp: Date.now(),
    };

    const results = joiner.joinLeft(leftEvent);

    expect(results).toHaveLength(1);
    expect(results[0].left).toEqual(leftEvent);
    expect(results[0].right).toBeNull();
  });

  it('should clear buffers', () => {
    const options = {
      type: 'inner' as const,
      window: {
        size: 1000,
        type: 'tumbling' as const,
      },
      keySelector: (e: StreamEvent) => 'A',
    };

    const joiner = new StreamJoiner(options);

    const event: StreamEvent = {
      id: '1',
      type: 'test',
      data: { key: 'A' },
      timestamp: Date.now(),
    };

    joiner.joinLeft(event);
    joiner.clear();

    expect(joiner['leftBuffer'].size).toBe(0);
    expect(joiner['rightBuffer'].size).toBe(0);
  });
});

describe('ComplexEventProcessor', () => {
  it('should register pattern', () => {
    const cep = new ComplexEventProcessor();
    const pattern = Patterns.sequence(
      (e) => e.type === 'start',
      (e) => e.type === 'middle',
      (e) => e.type === 'end'
    );

    cep.registerPattern(pattern);

    expect(cep['patterns'].size).toBe(1);
  });

  it('should unregister pattern', () => {
    const cep = new ComplexEventProcessor();
    const pattern = Patterns.sequence((e) => e.type === 'test');

    cep.registerPattern(pattern);
    cep.unregisterPattern(pattern.id);

    expect(cep['patterns'].size).toBe(0);
  });

  it('should create sequence pattern', () => {
    const pattern = Patterns.sequence(
      (e) => e.type === 'type1',
      (e) => e.type === 'type2'
    );

    expect(pattern.pattern.type).toBe('sequence');
    expect(pattern.pattern.children).toHaveLength(2);
  });

  it('should create repeat pattern', () => {
    const pattern = Patterns.repeat(
      (e) => e.type === 'test',
      { min: 3, max: 5 }
    );

    expect(pattern.pattern.type).toBe('repeat');
    expect(pattern.pattern.times?.min).toBe(3);
    expect(pattern.pattern.times?.max).toBe(5);
  });

  it('should create and pattern', () => {
    const pattern = Patterns.and(
      { type: 'and', filter: (e) => e.type === 'type1' },
      { type: 'and', filter: (e) => e.type === 'type2' }
    );

    expect(pattern.pattern.type).toBe('and');
    expect(pattern.pattern.children).toHaveLength(2);
  });

  it('should create or pattern', () => {
    const pattern = Patterns.or(
      { type: 'or', filter: (e) => e.type === 'type1' },
      { type: 'or', filter: (e) => e.type === 'type2' }
    );

    expect(pattern.pattern.type).toBe('or');
    expect(pattern.pattern.children).toHaveLength(2);
  });
});
