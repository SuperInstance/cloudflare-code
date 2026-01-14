/**
 * Stream Processing Operations
 * Common operations for stream processing
 */

import type { StreamEvent } from '../types';

// ============================================================================
// Filter Operations
// ============================================================================

/**
 * Filter events by predicate
 */
export async function* filter(
  events: AsyncIterable<StreamEvent>,
  predicate: (event: StreamEvent) => boolean | Promise<boolean>
): AsyncGenerator<StreamEvent> {
  for await (const event of events) {
    if (await predicate(event)) {
      yield event;
    }
  }
}

/**
 * Filter events by field value
 */
export async function* filterBy(
  events: AsyncIterable<StreamEvent>,
  field: string,
  value: unknown
): AsyncGenerator<StreamEvent> {
  for await (const event of events) {
    if (typeof event.value === 'object' && event.value !== null) {
      const obj = event.value as Record<string, unknown>;
      if (obj[field] === value) {
        yield event;
      }
    }
  }
}

/**
 * Filter events by field value range
 */
export async function* filterByRange(
  events: AsyncIterable<StreamEvent>,
  field: string,
  min: number,
  max: number
): AsyncGenerator<StreamEvent> {
  for await (const event of events) {
    if (typeof event.value === 'object' && event.value !== null) {
      const obj = event.value as Record<string, unknown>;
      const value = obj[field];
      if (typeof value === 'number' && value >= min && value <= max) {
        yield event;
      }
    }
  }
}

// ============================================================================
// Map Operations
// ============================================================================

/**
 * Map events using transformer function
 */
export async function* map(
  events: AsyncIterable<StreamEvent>,
  mapper: (event: StreamEvent) => StreamEvent | Promise<StreamEvent>
): AsyncGenerator<StreamEvent> {
  for await (const event of events) {
    yield await mapper(event);
  }
}

/**
 * Extract field from event value
 */
export async function* pluck(
  events: AsyncIterable<StreamEvent>,
  field: string
): AsyncGenerator<StreamEvent> {
  for await (const event of events) {
    if (typeof event.value === 'object' && event.value !== null) {
      const obj = event.value as Record<string, unknown>;
      yield {
        ...event,
        value: obj[field]
      };
    }
  }
}

/**
 * Add computed field to event
 */
export async function* compute(
  events: AsyncIterable<StreamEvent>,
  field: string,
  computeFn: (value: unknown) => unknown
): AsyncGenerator<StreamEvent> {
  for await (const event of events) {
    if (typeof event.value === 'object' && event.value !== null) {
      const obj = { ...event.value } as Record<string, unknown>;
      obj[field] = computeFn(event.value);
      yield {
        ...event,
        value: obj
      };
    }
  }
}

// ============================================================================
// Aggregation Operations
// ============================================================================

/**
 * Count events
 */
export async function count(
  events: AsyncIterable<StreamEvent>
): Promise<number> {
  let count = 0;
  for await (const _ of events) {
    count++;
  }
  return count;
}

/**
 * Sum field values
 */
export async function sum(
  events: AsyncIterable<StreamEvent>,
  field: string
): Promise<number> {
  let total = 0;
  for await (const event of events) {
    if (typeof event.value === 'object' && event.value !== null) {
      const obj = event.value as Record<string, unknown>;
      const value = obj[field];
      if (typeof value === 'number') {
        total += value;
      }
    }
  }
  return total;
}

/**
 * Calculate average of field values
 */
export async function average(
  events: AsyncIterable<StreamEvent>,
  field: string
): Promise<number> {
  let sum = 0;
  let count = 0;

  for await (const event of events) {
    if (typeof event.value === 'object' && event.value !== null) {
      const obj = event.value as Record<string, unknown>;
      const value = obj[field];
      if (typeof value === 'number') {
        sum += value;
        count++;
      }
    }
  }

  return count > 0 ? sum / count : 0;
}

/**
 * Find minimum field value
 */
export async function min(
  events: AsyncIterable<StreamEvent>,
  field: string
): Promise<number | null> {
  let minValue: number | null = null;

  for await (const event of events) {
    if (typeof event.value === 'object' && event.value !== null) {
      const obj = event.value as Record<string, unknown>;
      const value = obj[field];
      if (typeof value === 'number') {
        if (minValue === null || value < minValue) {
          minValue = value;
        }
      }
    }
  }

  return minValue;
}

/**
 * Find maximum field value
 */
export async function max(
  events: AsyncIterable<StreamEvent>,
  field: string
): Promise<number | null> {
  let maxValue: number | null = null;

  for await (const event of events) {
    if (typeof event.value === 'object' && event.value !== null) {
      const obj = event.value as Record<string, unknown>;
      const value = obj[field];
      if (typeof value === 'number') {
        if (maxValue === null || value > maxValue) {
          maxValue = value;
        }
      }
    }
  }

  return maxValue;
}

// ============================================================================
// Grouping Operations
// ============================================================================

/**
 * Group events by key
 */
export async function* groupBy(
  events: AsyncIterable<StreamEvent>,
  keyFn: (event: StreamEvent) => string | Promise<string>
): AsyncGenerator<{ key: string; events: StreamEvent[] }> {
  const groups = new Map<string, StreamEvent[]>();

  for await (const event of events) {
    const key = await keyFn(event);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key)!.push(event);
  }

  for (const [key, events] of groups.entries()) {
    yield { key, events };
  }
}

/**
 * Group events by field
 */
export async function* groupByField(
  events: AsyncIterable<StreamEvent>,
  field: string
): AsyncGenerator<{ key: string; events: StreamEvent[] }> {
  const groups = new Map<string, StreamEvent[]>();

  for await (const event of events) {
    if (typeof event.value === 'object' && event.value !== null) {
      const obj = event.value as Record<string, unknown>;
      const key = String(obj[field] ?? 'null');

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key)!.push(event);
    }
  }

  for (const [key, events] of groups.entries()) {
    yield { key, events };
  }
}

// ============================================================================
// Window Operations
// ============================================================================

/**
 * Tumbling time windows
 */
export async function* tumblingWindow(
  events: AsyncIterable<StreamEvent>,
  windowSize: number
): AsyncGenerator<{ windowStart: Date; windowEnd: Date; events: StreamEvent[] }> {
  const windows = new Map<string, StreamEvent[]>();

  for await (const event of events) {
    const windowId = Math.floor(event.timestamp.getTime() / windowSize);
    const windowStart = new Date(windowId * windowSize);
    const windowEnd = new Date(windowStart.getTime() + windowSize);

    if (!windows.has(windowId.toString())) {
      windows.set(windowId.toString(), []);
    }

    windows.get(windowId.toString())!.push(event);

    // Emit completed windows
    const currentWindowId = Math.floor(Date.now() / windowSize);
    for (const [id, events] of windows.entries()) {
      if (parseInt(id) < currentWindowId) {
        yield {
          windowStart,
          windowEnd,
          events
        };
        windows.delete(id);
      }
    }
  }

  // Emit remaining windows
  for (const [id, events] of windows.entries()) {
    const windowId = parseInt(id);
    const windowStart = new Date(windowId * windowSize);
    const windowEnd = new Date(windowStart.getTime() + windowSize);

    yield {
      windowStart,
      windowEnd,
      events
    };
  }
}

/**
 * Sliding time windows
 */
export async function* slidingWindow(
  events: AsyncIterable<StreamEvent>,
  windowSize: number,
  slideSize: number
): AsyncGenerator<{ windowStart: Date; windowEnd: Date; events: StreamEvent[] }> {
  const windows = new Map<string, { events: StreamEvent[]; start: Date; end: Date }>();

  for await (const event of events) {
    const timestamp = event.timestamp.getTime();

    // Create windows that this event belongs to
    const numWindows = Math.ceil(windowSize / slideSize);
    const firstWindowStart = Math.floor(timestamp / slideSize) * slideSize - (windowSize - slideSize);

    for (let i = 0; i < numWindows; i++) {
      const windowStart = firstWindowStart + (i * slideSize);
      const windowEnd = windowStart + windowSize;
      const windowId = `window-${windowStart}`;

      if (timestamp >= windowStart && timestamp < windowEnd) {
        if (!windows.has(windowId)) {
          windows.set(windowId, {
            events: [],
            start: new Date(windowStart),
            end: new Date(windowEnd)
          });
        }

        windows.get(windowId)!.events.push(event);
      }
    }

    // Emit completed windows
    const currentTime = Date.now();
    for (const [id, window] of windows.entries()) {
      if (window.end.getTime() <= currentTime) {
        yield {
          windowStart: window.start,
          windowEnd: window.end,
          events: window.events
        };
        windows.delete(id);
      }
    }
  }

  // Emit remaining windows
  for (const window of windows.values()) {
    yield {
      windowStart: window.start,
      windowEnd: window.end,
      events: window.events
    };
  }
}

// ============================================================================
// Join Operations
// ============================================================================

/**
 * Inner join two streams
 */
export async function* innerJoin(
  left: AsyncIterable<StreamEvent>,
  right: AsyncIterable<StreamEvent>,
  leftKey: string,
  rightKey: string
): AsyncGenerator<StreamEvent> {
  const rightEvents = new Map<string, StreamEvent>();

  // Buffer right stream
  for await (const event of right) {
    if (typeof event.value === 'object' && event.value !== null) {
      const obj = event.value as Record<string, unknown>;
      const key = String(obj[rightKey] ?? null);
      rightEvents.set(key, event);
    }
  }

  // Join with left stream
  for await (const leftEvent of left) {
    if (typeof leftEvent.value === 'object' && leftEvent.value !== null) {
      const leftObj = leftEvent.value as Record<string, unknown>;
      const key = String(leftObj[leftKey] ?? null);

      const rightEvent = rightEvents.get(key);
      if (rightEvent) {
        const rightObj = rightEvent.value as Record<string, unknown>;
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

/**
 * Left join two streams
 */
export async function* leftJoin(
  left: AsyncIterable<StreamEvent>,
  right: AsyncIterable<StreamEvent>,
  leftKey: string,
  rightKey: string
): AsyncGenerator<StreamEvent> {
  const rightEvents = new Map<string, StreamEvent>();

  // Buffer right stream
  for await (const event of right) {
    if (typeof event.value === 'object' && event.value !== null) {
      const obj = event.value as Record<string, unknown>;
      const key = String(obj[rightKey] ?? null);
      rightEvents.set(key, event);
    }
  }

  // Join with left stream
  for await (const leftEvent of left) {
    if (typeof leftEvent.value === 'object' && leftEvent.value !== null) {
      const leftObj = leftEvent.value as Record<string, unknown>;
      const key = String(leftObj[leftKey] ?? null);

      const rightEvent = rightEvents.get(key);
      if (rightEvent) {
        const rightObj = rightEvent.value as Record<string, unknown>;
        yield {
          ...leftEvent,
          value: {
            ...leftObj,
            ...Object.fromEntries(
              Object.entries(rightObj).map(([k, v]) => [`right_${k}`, v])
            )
          }
        };
      } else {
        yield leftEvent;
      }
    }
  }
}

// ============================================================================
// Deduplication Operations
// ============================================================================

/**
 * Remove duplicate events based on key
 */
export async function* distinct(
  events: AsyncIterable<StreamEvent>,
  keyFn?: (event: StreamEvent) => string
): AsyncGenerator<StreamEvent> {
  const seen = new Set<string>();

  for await (const event of events) {
    const key = keyFn ? keyFn(event) : event.key;

    if (!seen.has(key)) {
      seen.add(key);
      yield event;
    }
  }
}

/**
 * Remove duplicate events based on field
 */
export async function* distinctBy(
  events: AsyncIterable<StreamEvent>,
  field: string
): AsyncGenerator<StreamEvent> {
  const seen = new Set<unknown>();

  for await (const event of events) {
    if (typeof event.value === 'object' && event.value !== null) {
      const obj = event.value as Record<string, unknown>;
      const value = obj[field];

      if (!seen.has(value)) {
        seen.add(value);
        yield event;
      }
    }
  }
}

// ============================================================================
// Sorting Operations
// ============================================================================

/**
 * Sort events by field (buffered)
 */
export async function* sortBy(
  events: AsyncIterable<StreamEvent>,
  field: string,
  order: 'asc' | 'desc' = 'asc'
): AsyncGenerator<StreamEvent> {
  const buffered: StreamEvent[] = [];

  for await (const event of events) {
    buffered.push(event);
  }

  buffered.sort((a, b) => {
    const aObj = a.value as Record<string, unknown>;
    const bObj = b.value as Record<string, unknown>;

    const aVal = aObj[field];
    const bVal = bObj[field];

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return order === 'asc' ? aVal - bVal : bVal - aVal;
    }

    const aStr = String(aVal ?? '');
    const bStr = String(bVal ?? '');

    return order === 'asc'
      ? aStr.localeCompare(bStr)
      : bStr.localeCompare(aStr);
  });

  for (const event of buffered) {
    yield event;
  }
}

// ============================================================================
// Limiting Operations
// ============================================================================

/**
 * Take first N events
 */
export async function* take(
  events: AsyncIterable<StreamEvent>,
  n: number
): AsyncGenerator<StreamEvent> {
  let count = 0;

  for await (const event of events) {
    if (count >= n) {
      break;
    }
    yield event;
    count++;
  }
}

/**
 * Take events while predicate is true
 */
export async function* takeWhile(
  events: AsyncIterable<StreamEvent>,
  predicate: (event: StreamEvent) => boolean | Promise<boolean>
): AsyncGenerator<StreamEvent> {
  for await (const event of events) {
    if (!(await predicate(event))) {
      break;
    }
    yield event;
  }
}

/**
 * Skip first N events
 */
export async function* skip(
  events: AsyncIterable<StreamEvent>,
  n: number
): AsyncGenerator<StreamEvent> {
  let count = 0;

  for await (const event of events) {
    if (count < n) {
      count++;
      continue;
    }
    yield event;
  }
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Batch events into fixed-size chunks
 */
export async function* batch(
  events: AsyncIterable<StreamEvent>,
  size: number
): AsyncGenerator<StreamEvent[]> {
  let batch: StreamEvent[] = [];

  for await (const event of events) {
    batch.push(event);

    if (batch.length >= size) {
      yield batch;
      batch = [];
    }
  }

  if (batch.length > 0) {
    yield batch;
  }
}

/**
 * Batch events by time window
 */
export async function* batchTime(
  events: AsyncIterable<StreamEvent>,
  windowMs: number
): AsyncGenerator<StreamEvent[]> {
  let batch: StreamEvent[] = [];
  let lastFlush = Date.now();

  for await (const event of events) {
    batch.push(event);

    const now = Date.now();
    if (now - lastFlush >= windowMs) {
      yield batch;
      batch = [];
      lastFlush = now;
    }
  }

  if (batch.length > 0) {
    yield batch;
  }
}
