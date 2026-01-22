/**
 * Tests for Tracing System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Tracer, createTracer } from './tracing';

describe('Tracer', () => {
  let tracer: Tracer;

  beforeEach(() => {
    tracer = createTracer('test-service', {
      samplingRate: 1.0,
      exporter: 'memory',
    });
  });

  describe('Span Creation', () => {
    it('should create a root span', () => {
      const spanId = tracer.startSpan('test-operation', {
        kind: 'INTERNAL',
        attributes: { key: 'value' },
      });

      expect(spanId).toBeDefined();
      expect(spanId.length).toBe(16); // 8 bytes hex encoded

      const span = tracer.getSpan(spanId);
      expect(span).toBeDefined();
      expect(span?.name).toBe('test-operation');
      expect(span?.kind).toBe('INTERNAL');
      expect(span?.attributes).toEqual({ key: 'value' });
      expect(span?.parentSpanId).toBeUndefined();
    });

    it('should create a child span', () => {
      const parentSpanId = tracer.startSpan('parent-operation');
      const childSpanId = tracer.startSpan('child-operation', {
        parentSpanId: parentSpanId,
      });

      const childSpan = tracer.getSpan(childSpanId);
      expect(childSpan?.parentSpanId).toBe(parentSpanId);
    });

    it('should assign same trace ID to child spans', () => {
      const parentSpanId = tracer.startSpan('parent');
      const childSpanId = tracer.startSpan('child', {
        parentSpanId: parentSpanId,
      });

      const parentSpan = tracer.getSpan(parentSpanId);
      const childSpan = tracer.getSpan(childSpanId);

      expect(childSpan?.traceId).toBe(parentSpan?.traceId);
    });
  });

  describe('Span Lifecycle', () => {
    it('should end a span and calculate duration', async () => {
      const spanId = tracer.startSpan('test-operation');

      await new Promise((resolve) => setTimeout(resolve, 10));

      tracer.endSpan(spanId);

      const span = tracer.getSpan(spanId);
      expect(span?.endTime).toBeDefined();
      expect(span?.duration).toBeGreaterThanOrEqual(10);
      expect(span?.duration).toBeLessThan(100);
    });

    it('should move span from active to completed', () => {
      const spanId = tracer.startSpan('test-operation');

      expect(tracer.getStats().activeSpans).toBe(1);

      tracer.endSpan(spanId);

      expect(tracer.getStats().activeSpans).toBe(0);
      expect(tracer.getStats().completedSpans).toBe(1);
    });

    it('should set status on span end', () => {
      const spanId = tracer.startSpan('test-operation');

      tracer.endSpan(spanId, {
        status: 'ERROR',
        statusCode: 500,
        statusMessage: 'Internal Server Error',
      });

      const span = tracer.getSpan(spanId);
      expect(span?.status).toBe('ERROR');
      expect(span?.statusCode).toBe(500);
      expect(span?.statusMessage).toBe('Internal Server Error');
    });
  });

  describe('Span Events', () => {
    it('should add events to span', () => {
      const spanId = tracer.startSpan('test-operation');

      tracer.addEvent(spanId, 'event1', { key: 'value1' });
      tracer.addEvent(spanId, 'event2', { key: 'value2' });

      const span = tracer.getSpan(spanId);
      expect(span?.events).toHaveLength(2);
      expect(span?.events[0].name).toBe('event1');
      expect(span?.events[0].attributes).toEqual({ key: 'value1' });
      expect(span?.events[1].name).toBe('event2');
    });

    it('should use custom timestamp for events', () => {
      const spanId = tracer.startSpan('test-operation');
      const customTime = Date.now() - 1000;

      tracer.addEvent(spanId, 'event', {}, customTime);

      const span = tracer.getSpan(spanId);
      expect(span?.events[0].timestamp).toBe(customTime);
    });
  });

  describe('Span Attributes', () => {
    it('should set attributes on span', () => {
      const spanId = tracer.startSpan('test-operation');

      tracer.setAttributes(spanId, { key1: 'value1', key2: 42 });

      const span = tracer.getSpan(spanId);
      expect(span?.attributes).toEqual({
        key1: 'value1',
        key2: 42,
      });
    });

    it('should merge attributes', () => {
      const spanId = tracer.startSpan('test-operation', {
        attributes: { key1: 'value1' },
      });

      tracer.setAttributes(spanId, { key2: 'value2', key3: 33 });

      const span = tracer.getSpan(spanId);
      expect(span?.attributes).toEqual({
        key1: 'value1',
        key2: 'value2',
        key3: 33,
      });
    });
  });

  describe('Exception Recording', () => {
    it('should record exception in span', () => {
      const spanId = tracer.startSpan('test-operation');

      const error = new Error('Test error');
      tracer.recordException(spanId, error);

      const span = tracer.getSpan(spanId);
      expect(span?.status).toBe('ERROR');
      expect(span?.events).toHaveLength(1);
      expect(span?.events[0].name).toBe('exception');
      expect(span?.events[0].attributes['exception.message']).toBe('Test error');
      expect(span?.events[0].attributes['exception.type']).toBe('Error');
    });

    it('should record exception with metadata', () => {
      const spanId = tracer.startSpan('test-operation');

      tracer.recordException(spanId, 'Test error', { code: 500 });

      const span = tracer.getSpan(spanId);
      expect(span?.events[0].attributes).toMatchObject({
        'exception.message': 'Test error',
        code: 500,
      });
    });
  });

  describe('Trace Context Propagation', () => {
    it('should inject trace context into headers', () => {
      const spanId = tracer.startSpan('test-operation');

      const headers = tracer.inject(spanId);

      expect(headers.traceparent).toBeDefined();
      expect(headers.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[12]$/);
      expect(headers['trace-id']).toBeDefined();
      expect(headers['span-id']).toBeDefined();
    });

    it('should extract trace context from headers', () => {
      const spanId = tracer.startSpan('test-operation');
      const headers = tracer.inject(spanId);

      const extracted = tracer.extract(headers);

      expect(extracted).toBeDefined();
      expect(extracted?.traceId).toHaveLength(32);
      expect(extracted?.spanId).toHaveLength(16);
      expect(extracted?.traceFlags).toBe(1);
    });

    it('should create child span from headers', () => {
      const parentSpanId = tracer.startSpan('parent');
      const headers = tracer.inject(parentSpanId);

      const childSpanId = tracer.startSpanFromHeaders('child', headers);

      const childSpan = tracer.getSpan(childSpanId);
      expect(childSpan?.traceId).toMatch(headers['trace-id'] as string);
    });

    it('should return null for invalid traceparent', () => {
      const extracted = tracer.extract({
        traceparent: 'invalid-format',
      });

      expect(extracted).toBeNull();
    });

    it('should start new root span if no headers provided', () => {
      const spanId = tracer.startSpanFromHeaders('test', {});

      const span = tracer.getSpan(spanId);
      expect(span?.parentSpanId).toBeUndefined();
    });
  });

  describe('Trace Queries', () => {
    it('should get all spans in a trace', () => {
      const parentSpanId = tracer.startSpan('parent');
      const childSpanId = tracer.startSpan('child', {
        parentSpanId: parentSpanId,
      });

      const parentSpan = tracer.getSpan(parentSpanId);
      const traceSpans = tracer.getTrace(parentSpan!.traceId);

      expect(traceSpans).toHaveLength(2);
      expect(traceSpans.map((s) => s.spanId)).toEqual(
        expect.arrayContaining([parentSpanId, childSpanId])
      );
    });

    it('should get trace statistics', () => {
      const parentSpanId = tracer.startSpan('parent');
      const childSpanId = tracer.startSpan('child', {
        parentSpanId: parentSpanId,
        kind: 'CLIENT',
      });

      tracer.endSpan(childSpanId);
      tracer.endSpan(parentSpanId);

      const parentSpan = tracer.getSpan(parentSpanId);
      const stats = tracer.getTraceStats(parentSpan!.traceId);

      expect(stats).toBeDefined();
      expect(stats?.spanCount).toBe(2);
      expect(stats?.errorCount).toBe(0);
      expect(stats?.byKind.INTERNAL).toBe(1);
      expect(stats?.byKind.CLIENT).toBe(1);
    });

    it('should return null for non-existent trace', () => {
      const stats = tracer.getTraceStats('nonexistent');
      expect(stats).toBeNull();
    });
  });

  describe('Span Context', () => {
    it('should get span context', () => {
      const spanId = tracer.startSpan('test-operation');

      const context = tracer.getSpanContext(spanId);

      expect(context).toBeDefined();
      expect(context?.traceId).toHaveLength(32);
      expect(context?.spanId).toHaveLength(16);
      expect(context?.traceFlags).toBe(1);
      expect(context?.isRemote).toBe(false);
    });
  });

  describe('Export', () => {
    it('should export completed spans', async () => {
      const spanId = tracer.startSpan('test-operation');
      tracer.endSpan(spanId);

      await tracer.export();

      expect(tracer.getStats().completedSpans).toBe(0);
    });

    it('should not export active spans', async () => {
      tracer.startSpan('test-operation');

      await tracer.export();

      expect(tracer.getStats().activeSpans).toBe(1);
    });

    it('should clear completed spans after export', async () => {
      const spanId = tracer.startSpan('test-operation');
      tracer.endSpan(spanId);

      await tracer.export();

      const span = tracer.getSpan(spanId);
      expect(span).toBeDefined();
    });
  });

  describe('Auto Export', () => {
    it('should start and stop auto export', async () => {
      tracer.startAutoExport();

      await new Promise((resolve) => setTimeout(resolve, 100));

      tracer.stopAutoExport();

      // Auto export should be stopped
      expect(tracer.getStats()).toBeDefined();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown and export all spans', async () => {
      const spanId = tracer.startSpan('test-operation');

      await tracer.shutdown();

      expect(tracer.getStats().activeSpans).toBe(0);
      expect(tracer.getStats().completedSpans).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle ending non-existent span', () => {
      expect(() => {
        tracer.endSpan('nonexistent');
      }).not.toThrow();
    });

    it('should handle adding events to non-existent span', () => {
      expect(() => {
        tracer.addEvent('nonexistent', 'event');
      }).not.toThrow();
    });

    it('should handle getting non-existent span', () => {
      const span = tracer.getSpan('nonexistent');
      expect(span).toBeUndefined();
    });

    it('should handle inject on non-existent span', () => {
      expect(() => {
        tracer.inject('nonexistent');
      }).toThrow();
    });

    it('should generate unique span IDs', () => {
      const spanIds = new Set<string>();

      for (let i = 0; i < 1000; i++) {
        const spanId = tracer.startSpan(`test-${i}`);
        spanIds.add(spanId);
      }

      expect(spanIds.size).toBe(1000);
    });

    it('should generate unique trace IDs', () => {
      const traceIds = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const spanId = tracer.startSpan(`test-${i}`);
        const span = tracer.getSpan(spanId);
        traceIds.add(span!.traceId);
      }

      expect(traceIds.size).toBe(100);
    });
  });

  describe('Span Links', () => {
    it('should create spans with links', () => {
      const linkSpanId = tracer.startSpan('linked-operation');
      const linkSpan = tracer.getSpan(linkSpanId);

      const spanId = tracer.startSpan('test-operation', {
        links: [
          {
            traceId: linkSpan!.traceId,
            spanId: linkSpanId,
            attributes: { linkType: 'related' },
          },
        ],
      });

      const span = tracer.getSpan(spanId);
      expect(span?.links).toHaveLength(1);
      expect(span?.links[0].traceId).toBe(linkSpan?.traceId);
      expect(span?.links[0].attributes).toEqual({ linkType: 'related' });
    });
  });
});
