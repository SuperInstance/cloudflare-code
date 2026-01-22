/**
 * Unit tests for Event Stream
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventStream, formatSSE, parseSSE } from '../../src/stream/event-stream';
import type { StreamEvent, EventFilter, SSEEvent } from '../../src/types';

describe('EventStream', () => {
  let stream: EventStream;

  beforeEach(() => {
    stream = new EventStream();
  });

  describe('publish', () => {
    it('should publish an event', async () => {
      const event = await stream.publish('test-type', { data: 'test' });

      expect(event).toBeDefined();
      expect(event.type).toBe('test-type');
      expect(event.data).toEqual({ data: 'test' });
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('should publish multiple events in batch', async () => {
      const events = [
        { type: 'type1', data: { value: 1 } },
        { type: 'type2', data: { value: 2 } },
        { type: 'type3', data: { value: 3 } },
      ];

      const published = await stream.publishBatch(events);

      expect(published).toHaveLength(3);
      expect(published[0].type).toBe('type1');
      expect(published[1].type).toBe('type2');
      expect(published[2].type).toBe('type3');
    });

    it('should update statistics after publishing', async () => {
      await stream.publish('test', { data: 'test' });
      const stats = stream.getStats();

      expect(stats.eventCount).toBe(1);
      expect(stats.lastEventTime).toBeGreaterThan(0);
    });
  });

  describe('subscribeSSE', () => {
    it('should create SSE connection', () => {
      const connection = stream.subscribeSSE('client-1');

      expect(connection).toBeDefined();
      expect(connection.clientId).toBe('client-1');
      expect(connection.id).toBeDefined();
      expect(stream.getConnectionCount()).toBe(1);
    });

    it('should create SSE connection with filters', () => {
      const filter: EventFilter = {
        types: ['type1', 'type2'],
      };

      const connection = stream.subscribeSSE('client-1', [filter]);

      expect(connection.filters).toEqual([filter]);
    });

    it('should create SSE connection with custom retry', () => {
      const connection = stream.subscribeSSE('client-1', [], 5000);

      expect(connection.retry).toBe(5000);
    });
  });

  describe('subscribeWebSocket', () => {
    it('should create WebSocket connection', () => {
      const connection = stream.subscribeWebSocket('client-1');

      expect(connection).toBeDefined();
      expect(connection.clientId).toBe('client-1');
      expect(connection.id).toBeDefined();
    });

    it('should create WebSocket connection with subprotocol', () => {
      const connection = stream.subscribeWebSocket('client-1', [], 'chat');

      expect(connection.subprotocol).toBe('chat');
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe connection', () => {
      const connection = stream.subscribeSSE('client-1');
      stream.unsubscribe(connection.id);

      expect(stream.getConnectionCount()).toBe(0);
    });

    it('should unsubscribe all connections for client', () => {
      stream.subscribeSSE('client-1');
      stream.subscribeSSE('client-1');
      stream.subscribeWebSocket('client-2');

      stream.unsubscribeClient('client-1');

      expect(stream.getConnectionCount()).toBe(1);
    });
  });

  describe('getEvent', () => {
    it('should get event by ID', async () => {
      const event = await stream.publish('test', { data: 'test' });
      const retrieved = stream.getEvent(event.id);

      expect(retrieved).toEqual(event);
    });

    it('should return undefined for non-existent event', () => {
      const retrieved = stream.getEvent('non-existent');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('getEvents', () => {
    beforeEach(async () => {
      await stream.publish('type1', { value: 1 });
      await stream.publish('type2', { value: 2 });
      await stream.publish('type1', { value: 3 });
    });

    it('should get all events without filter', () => {
      const events = stream.getEvents({});

      expect(events).toHaveLength(3);
    });

    it('should filter by type', () => {
      const events = stream.getEvents({ types: ['type1'] });

      expect(events).toHaveLength(2);
      expect(events.every(e => e.type === 'type1')).toBe(true);
    });

    it('should filter by time range', async () => {
      const now = Date.now();
      await stream.publish('type3', { value: 4 });

      const events = stream.getEvents({
        timeRange: {
          start: now,
          end: Date.now(),
        },
      });

      expect(events.length).toBeGreaterThan(0);
    });

    it('should apply custom filter', () => {
      const events = stream.getEvents({
        custom: (e) => (e.data as any).value > 1,
      });

      expect(events).toHaveLength(2);
    });

    it('should limit results', () => {
      const events = stream.getEvents({}, 2);

      expect(events).toHaveLength(2);
    });
  });

  describe('getEventsSince', () => {
    it('should get events after timestamp', async () => {
      const timestamp = Date.now();
      await stream.publish('test', { data: 'after' });

      const events = stream.getEventsSince(timestamp);

      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('getRecentEvents', () => {
    it('should get recent events', async () => {
      await stream.publish('test', { data: '1' });
      await stream.publish('test', { data: '2' });
      await stream.publish('test', { data: '3' });

      const events = stream.getRecentEvents(2);

      expect(events).toHaveLength(2);
    });
  });

  describe('transform', () => {
    it('should transform events', async () => {
      await stream.publish('test', { value: 1 });

      const transformed = stream.transform((event) => ({
        ...event,
        data: { transformed: true, original: event.data },
      }));

      expect(transformed).toBeDefined();
    });
  });

  describe('filter', () => {
    it('should filter events', async () => {
      await stream.publish('type1', { value: 1 });
      await stream.publish('type2', { value: 2 });

      const filtered = stream.filter((e) => e.type === 'type1');

      expect(filtered).toBeDefined();
    });
  });

  describe('batch', () => {
    it('should batch events', async () => {
      const batched = stream.batch(3, 1000);

      expect(batched).toBeDefined();
    });
  });

  describe('clear', () => {
    it('should clear all data', async () => {
      await stream.publish('test', { data: 'test' });
      stream.subscribeSSE('client-1');

      stream.clear();

      expect(stream.getStats().eventCount).toBe(0);
      expect(stream.getConnectionCount()).toBe(0);
    });
  });
});

describe('SSE formatting', () => {
  describe('formatSSE', () => {
    it('should format SSE event with all fields', () => {
      const sseEvent: SSEEvent = {
        id: '123',
        event: 'message',
        data: 'test data',
        retry: 5000,
      };

      const formatted = formatSSE(sseEvent);

      expect(formatted).toContain('id: 123');
      expect(formatted).toContain('event: message');
      expect(formatted).toContain('data: test data');
      expect(formatted).toContain('retry: 5000');
    });

    it('should format SSE event with minimal fields', () => {
      const sseEvent: SSEEvent = {
        data: 'test data',
      };

      const formatted = formatSSE(sseEvent);

      expect(formatted).toContain('data: test data');
      expect(formatted).not.toContain('id:');
    });

    it('should split multiline data', () => {
      const sseEvent: SSEEvent = {
        data: 'line1\nline2\nline3',
      };

      const formatted = formatSSE(sseEvent);

      expect(formatted).toContain('data: line1');
      expect(formatted).toContain('data: line2');
      expect(formatted).toContain('data: line3');
    });
  });

  describe('parseSSE', () => {
    it('should parse SSE message', () => {
      const message = 'id: 123\nevent: message\ndata: test data\n\n';

      const events = parseSSE(message);

      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('123');
      expect(events[0].event).toBe('message');
      expect(events[0].data).toBe('test data');
    });

    it('should parse multiple SSE events', () => {
      const message = 'id: 1\ndata: event1\n\nid: 2\ndata: event2\n\n';

      const events = parseSSE(message);

      expect(events).toHaveLength(2);
      expect(events[0].id).toBe('1');
      expect(events[1].id).toBe('2');
    });

    it('should parse SSE with retry', () => {
      const message = 'retry: 5000\ndata: test\n\n';

      const events = parseSSE(message);

      expect(events[0].retry).toBe(5000);
    });
  });
});
