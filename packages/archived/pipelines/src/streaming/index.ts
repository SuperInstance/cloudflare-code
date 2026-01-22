// @ts-nocheck
/**
 * Stream Processing Module
 * High-performance stream processing for real-time data
 */

export { StreamProcessor } from './engine';
export {
  filter,
  filterBy,
  filterByRange,
  map,
  pluck,
  compute,
  count,
  sum,
  average,
  min,
  max,
  groupBy,
  groupByField,
  tumblingWindow,
  slidingWindow,
  innerJoin,
  leftJoin,
  distinct,
  distinctBy,
  sortBy,
  take,
  takeWhile,
  skip,
  batch,
  batchTime
} from './operations';

export type { StreamProcessorConfig } from './engine';

import type { StreamEvent, WindowConfig, AggregationOperation } from '../types';

// ============================================================================
// Stream Builder
// ============================================================================

/**
 * Fluent API for building stream processing pipelines
 */
export class StreamBuilder {
  private source: AsyncIterable<StreamEvent> | null = null;
  private operations: StreamOperation[] = [];

  /**
   * Set the source stream
   */
  from(source: AsyncIterable<StreamEvent>): StreamBuilder {
    this.source = source;
    return this;
  }

  /**
   * Filter events
   */
  filter(predicate: (event: StreamEvent) => boolean): StreamBuilder {
    this.operations.push({ type: 'filter', predicate });
    return this;
  }

  /**
   * Filter by field value
   */
  where(field: string, value: unknown): StreamBuilder {
    this.operations.push({
      type: 'where',
      field,
      value
    });
    return this;
  }

  /**
   * Map events
   */
  map(mapper: (event: StreamEvent) => StreamEvent): StreamBuilder {
    this.operations.push({ type: 'map', mapper });
    return this;
  }

  /**
   * Extract field
   */
  pluck(field: string): StreamBuilder {
    this.operations.push({ type: 'pluck', field });
    return this;
  }

  /**
   * Group by key
   */
  groupBy(keyFn: (event: StreamEvent) => string): StreamBuilder {
    this.operations.push({ type: 'groupBy', keyFn });
    return this;
  }

  /**
   * Apply tumbling window
   */
  tumblingWindow(size: number): StreamBuilder {
    this.operations.push({ type: 'tumblingWindow', size });
    return this;
  }

  /**
   * Apply sliding window
   */
  slidingWindow(size: number, slide: number): StreamBuilder {
    this.operations.push({ type: 'slidingWindow', size, slide });
    return this;
  }

  /**
   * Remove duplicates
   */
  distinct(keyFn?: (event: StreamEvent) => string): StreamBuilder {
    this.operations.push({ type: 'distinct', keyFn });
    return this;
  }

  /**
   * Limit number of events
   */
  limit(n: number): StreamBuilder {
    this.operations.push({ type: 'limit', n });
    return this;
  }

  /**
   * Batch events
   */
  batch(size: number): StreamBuilder {
    this.operations.push({ type: 'batch', size });
    return this;
  }

  /**
   * Build and execute the pipeline
   */
  async *execute(): AsyncGenerator<StreamEvent> {
    if (!this.source) {
      throw new Error('Source not set');
    }

    let stream: AsyncIterable<StreamEvent> = this.source;

    // Apply operations in sequence
    for (const op of this.operations) {
      stream = this.applyOperation(stream, op);
    }

    yield* stream;
  }

  /**
   * Apply operation to stream
   */
  private applyOperation(
    stream: AsyncIterable<StreamEvent>,
    operation: StreamOperation
  ): AsyncIterable<StreamEvent> {
    return {
      [Symbol.asyncIterator]: async function* () {
        switch (operation.type) {
          case 'filter':
            for await (const event of stream) {
              if (operation.predicate!(event)) {
                yield event;
              }
            }
            break;

          case 'where':
            for await (const event of stream) {
              if (typeof event.value === 'object' && event.value !== null) {
                const obj = event.value as Record<string, unknown>;
                if (obj[operation.field!] === operation.value) {
                  yield event;
                }
              }
            }
            break;

          case 'map':
            for await (const event of stream) {
              yield operation.mapper!(event);
            }
            break;

          case 'pluck':
            for await (const event of stream) {
              if (typeof event.value === 'object' && event.value !== null) {
                const obj = event.value as Record<string, unknown>;
                yield {
                  ...event,
                  value: obj[operation.field!]
                };
              }
            }
            break;

          case 'distinct':
            const seen = new Set<string>();
            const keyFn = operation.keyFn || ((e: StreamEvent) => e.key);
            for await (const event of stream) {
              const key = keyFn(event);
              if (!seen.has(key)) {
                seen.add(key);
                yield event;
              }
            }
            break;

          case 'limit':
            let count = 0;
            for await (const event of stream) {
              if (count >= operation.n!) {
                break;
              }
              yield event;
              count++;
            }
            break;

          default:
            yield* stream;
        }
      }
    };
  }

  /**
   * Reset the builder
   */
  reset(): StreamBuilder {
    this.source = null;
    this.operations = [];
    return this;
  }
}

/**
 * Stream operation types
 */
type StreamOperation =
  | { type: 'filter'; predicate?: (event: StreamEvent) => boolean }
  | { type: 'where'; field?: string; value?: unknown }
  | { type: 'map'; mapper?: (event: StreamEvent) => StreamEvent }
  | { type: 'pluck'; field?: string }
  | { type: 'groupBy'; keyFn?: (event: StreamEvent) => string }
  | { type: 'tumblingWindow'; size?: number }
  | { type: 'slidingWindow'; size?: number; slide?: number }
  | { type: 'distinct'; keyFn?: (event: StreamEvent) => string }
  | { type: 'limit'; n?: number }
  | { type: 'batch'; size?: number };

// ============================================================================
// Stream Aggregator
// ============================================================================

/**
 * Aggregate streams with custom aggregation functions
 */
export class StreamAggregator {
  private aggregates: Map<string, AggregateState> = new Map();

  /**
   * Add event to aggregates
   */
  add(event: StreamEvent, key?: string): void {
    const aggregateKey = key || 'default';

    if (!this.aggregates.has(aggregateKey)) {
      this.aggregates.set(aggregateKey, {
        count: 0,
        sum: {},
        min: {},
        max: {},
        first: null,
        last: null
      });
    }

    const state = this.aggregates.get(aggregateKey)!;
    state.count++;
    state.last = event;

    if (!state.first) {
      state.first = event;
    }

    if (typeof event.value === 'object' && event.value !== null) {
      const obj = event.value as Record<string, unknown>;

      for (const [field, value] of Object.entries(obj)) {
        if (typeof value === 'number') {
          // Sum
          if (!state.sum[field]) {
            state.sum[field] = 0;
          }
          state.sum[field] += value;

          // Min
          if (state.min[field] === undefined || value < state.min[field]) {
            state.min[field] = value;
          }

          // Max
          if (state.max[field] === undefined || value > state.max[field]) {
            state.max[field] = value;
          }
        }
      }
    }
  }

  /**
   * Get aggregate results
   */
  get(key?: string): AggregateResult {
    const aggregateKey = key || 'default';
    const state = this.aggregates.get(aggregateKey);

    if (!state) {
      return {
        count: 0,
        sum: {},
        avg: {},
        min: {},
        max: {}
      };
    }

    const avg: Record<string, number> = {};

    for (const [field, sum] of Object.entries(state.sum)) {
      avg[field] = sum / state.count;
    }

    return {
      count: state.count,
      sum: state.sum,
      avg,
      min: state.min,
      max: state.max
    };
  }

  /**
   * Get all aggregate results
   */
  getAll(): Map<string, AggregateResult> {
    const results = new Map<string, AggregateResult>();

    for (const key of this.aggregates.keys()) {
      results.set(key, this.get(key));
    }

    return results;
  }

  /**
   * Reset aggregates
   */
  reset(key?: string): void {
    if (key) {
      this.aggregates.delete(key);
    } else {
      this.aggregates.clear();
    }
  }
}

/**
 * Aggregate state
 */
interface AggregateState {
  count: number;
  sum: Record<string, number>;
  min: Record<string, number>;
  max: Record<string, number>;
  first: StreamEvent | null;
  last: StreamEvent | null;
}

/**
 * Aggregate result
 */
export interface AggregateResult {
  count: number;
  sum: Record<string, number>;
  avg: Record<string, number>;
  min: Record<string, number>;
  max: Record<string, number>;
}

// ============================================================================
// Stream Joiner
// ============================================================================

/**
 * Join multiple streams
 */
export class StreamJoiner {
  private streams: Map<string, AsyncIterable<StreamEvent>> = new Map();
  private buffers: Map<string, StreamEvent[]> = new Map();

  /**
   * Add stream to join
   */
  add(name: string, stream: AsyncIterable<StreamEvent>): void {
    this.streams.set(name, stream);
    this.buffers.set(name, []);
  }

  /**
   * Perform inner join
   */
  async *innerJoin(
    leftKey: string,
    rightKey: string
  ): AsyncGenerator<StreamEvent> {
    if (this.streams.size !== 2) {
      throw new Error('Inner join requires exactly 2 streams');
    }

    const [leftName, rightName] = Array.from(this.streams.keys());

    // Buffer right stream
    for await (const event of this.streams.get(rightName)!) {
      this.buffers.get(rightName)!.push(event);
    }

    // Join with left stream
    for await (const leftEvent of this.streams.get(leftName)!) {
      if (typeof leftEvent.value === 'object' && leftEvent.value !== null) {
        const leftObj = leftEvent.value as Record<string, unknown>;
        const key = String(leftObj[leftKey] ?? null);

        for (const rightEvent of this.buffers.get(rightName)!) {
          if (typeof rightEvent.value === 'object' && rightEvent.value !== null) {
            const rightObj = rightEvent.value as Record<string, unknown>;
            const rightKeyValue = String(rightObj[rightKey] ?? null);

            if (key === rightKeyValue) {
              yield {
                ...leftEvent,
                value: {
                  ...leftObj,
                  ...Object.fromEntries(
                    Object.entries(rightObj).map(([k, v]) => [`right_${k}`, v])
                  )
                }
              };
            }
          }
        }
      }
    }
  }

  /**
   * Clear buffers
   */
  clear(): void {
    for (const buffer of this.buffers.values()) {
      buffer.length = 0;
    }
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Convert array to async iterable
 */
export function toAsyncIterable(events: StreamEvent[]): AsyncIterable<StreamEvent> {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const event of events) {
        yield event;
      }
    }
  };
}

/**
 * Collect all events from stream
 */
export async function collect(stream: AsyncIterable<StreamEvent>): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];

  for await (const event of stream) {
    events.push(event);
  }

  return events;
}

/**
 * Pipe multiple operations
 */
export function pipe(
  source: AsyncIterable<StreamEvent>,
  ...operations: Array<(stream: AsyncIterable<StreamEvent>) => AsyncIterable<StreamEvent>>
): AsyncIterable<StreamEvent> {
  return operations.reduce((stream, op) => op(stream), source);
}
