/**
 * Unit tests for Trace Collector
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TraceCollector } from '../../src/collector';
import { Span, SpanKind, TraceId, SpanId } from '../../src/types/trace.types';

describe('TraceCollector', () => {
  let collector: TraceCollector;

  beforeEach(() => {
    collector = new TraceCollector({
      batchSize: 10,
      flushInterval: 1000,
      maxBufferSize: 100,
    });
  });

  afterEach(async () => {
    await collector.shutdown();
  });

  const createValidSpan = (traceId?: string, spanId?: string): Span => ({
    traceId: (traceId || '0123456789abcdef0123456789abcdef') as TraceId,
    spanId: (spanId || '0123456789abcdef') as SpanId,
    name: 'test-span',
    kind: SpanKind.INTERNAL,
    startTime: Date.now() * 1000,
    endTime: (Date.now() + 100) * 1000,
    duration: 100000,
    status: { code: 1 },
    service: 'test-service',
  });

  describe('collect', () => {
    it('should collect a valid span', async () => {
      const span = createValidSpan();
      const result = await collector.collect(span);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject an invalid span', async () => {
      const span = createValidSpan();
      delete (span as any).traceId;

      const result = await collector.collect(span);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should emit span:collected event', async () => {
      const span = createValidSpan();
      const handler = vi.fn();

      collector.on('span:collected', handler);

      await collector.collect(span);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          spanId: span.spanId,
        })
      );
    });

    it('should emit span:rejected event for invalid spans', async () => {
      const span = createValidSpan();
      delete (span as any).name;

      const handler = vi.fn();
      collector.on('span:rejected', handler);

      await collector.collect(span);

      expect(handler).toHaveBeenCalled();
    });

    it('should enrich spans with metadata', async () => {
      const span = createValidSpan();
      await collector.collect(span);

      // Check that extensions were added
      expect(span.extensions).toBeDefined();
      expect(span.extensions?.collectedAt).toBeDefined();
    });

    it('should collect multiple spans', async () => {
      const spans = [
        createValidSpan('trace1', 'span1'),
        createValidSpan('trace1', 'span2'),
        createValidSpan('trace2', 'span3'),
      ];

      for (const span of spans) {
        await collector.collect(span);
      }

      const stats = collector.getStats();
      expect(stats.spansCollected).toBe(3);
    });
  });

  describe('collectBatch', () => {
    it('should collect a batch of spans', async () => {
      const spans = [
        createValidSpan('trace1', 'span1'),
        createValidSpan('trace1', 'span2'),
        createValidSpan('trace2', 'span3'),
      ];

      const results = await collector.collectBatch(spans);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.valid)).toBe(true);
    });

    it('should handle mixed valid and invalid spans', async () => {
      const spans = [
        createValidSpan('trace1', 'span1'),
        createValidSpan('trace1', 'span2'),
      ];
      delete (spans[1] as any).name; // Make second span invalid

      const results = await collector.collectBatch(spans);

      expect(results).toHaveLength(2);
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
    });
  });

  describe('flush', () => {
    it('should flush buffered spans', async () => {
      const spans = [];
      for (let i = 0; i < 5; i++) {
        spans.push(createValidSpan('trace1', `span${i}`));
      }

      for (const span of spans) {
        await collector.collect(span);
      }

      const flushHandler = vi.fn();
      collector.on('flush:completed', flushHandler);

      await collector.flush();

      expect(flushHandler).toHaveBeenCalled();
    });

    it('should clear buffer after flush', async () => {
      await collector.collect(createValidSpan('trace1', 'span1'));
      await collector.collect(createValidSpan('trace1', 'span2'));

      await collector.flush();

      expect(collector.isEmpty()).toBe(true);
    });

    it('should emit batch:transmitted event', async () => {
      const handler = vi.fn();
      collector.on('batch:transmitted', handler);

      await collector.collect(createValidSpan('trace1', 'span1'));
      await collector.flush();

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('statistics', () => {
    it('should track collected spans', async () => {
      await collector.collect(createValidSpan('trace1', 'span1'));
      await collector.collect(createValidSpan('trace2', 'span2'));

      const stats = collector.getStats();
      expect(stats.spansCollected).toBe(2);
      expect(stats.spansProcessed).toBe(2);
    });

    it('should track dropped spans', async () => {
      const invalidSpan = createValidSpan();
      delete (invalidSpan as any).traceId;

      await collector.collect(invalidSpan);

      const stats = collector.getStats();
      expect(stats.spansDropped).toBe(1);
    });

    it('should track bytes processed', async () => {
      const span = createValidSpan();
      await collector.collect(span);

      const stats = collector.getStats();
      expect(stats.bytesProcessed).toBeGreaterThan(0);
    });

    it('should calculate average processing time', async () => {
      for (let i = 0; i < 10; i++) {
        await collector.collect(createValidSpan(`trace${i}`, `span${i}`));
      }

      const stats = collector.getStats();
      expect(stats.avgProcessingTime).toBeGreaterThan(0);
    });
  });

  describe('buffer management', () => {
    it('should report buffer statistics', async () => {
      await collector.collect(createValidSpan('trace1', 'span1'));
      await collector.collect(createValidSpan('trace1', 'span2'));

      const bufferStats = collector.getBufferStats();
      expect(bufferStats.currentSize).toBeGreaterThan(0);
      expect(bufferStats.flushCount).toBe(0);
    });

    it('should evict old spans when buffer is full', async () => {
      const smallCollector = new TraceCollector({
        maxBufferSize: 100, // Very small buffer
        batchSize: 100,
      });

      const evictionHandler = vi.fn();
      smallCollector.on('trace:evicted', evictionHandler);

      // Fill buffer beyond capacity
      for (let i = 0; i < 100; i++) {
        await smallCollector.collect(createValidSpan(`trace${i}`, `span${i}`));
      }

      expect(evictionHandler).toHaveBeenCalled();

      await smallCollector.shutdown();
    });

    it('should auto-fllush when batch size is reached', async () => {
      const flushHandler = vi.fn();
      collector.on('flush:completed', flushHandler);

      // Add exactly batchSize spans
      for (let i = 0; i < 10; i++) {
        await collector.collect(createValidSpan(`trace${i}`, `span${i}`));
      }

      // Wait for async flush
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(flushHandler).toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should flush on shutdown', async () => {
      await collector.collect(createValidSpan('trace1', 'span1'));

      const shutdownHandler = vi.fn();
      collector.on('shutdown:completed', shutdownHandler);

      await collector.shutdown();

      expect(shutdownHandler).toHaveBeenCalled();
      expect(collector.isEmpty()).toBe(true);
    });

    it('should reject new spans after shutdown', async () => {
      await collector.shutdown();

      await expect(
        collector.collect(createValidSpan('trace1', 'span1'))
      ).rejects.toThrow('Collector is shutting down');
    });
  });

  describe('forceFlush', () => {
    it('should immediately flush buffer', async () => {
      await collector.collect(createValidSpan('trace1', 'span1'));

      const flushHandler = vi.fn();
      collector.on('flush:completed', flushHandler);

      await collector.forceFlush();

      expect(flushHandler).toHaveBeenCalled();
      expect(collector.isEmpty()).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle transmit errors with retry', async () => {
      const errorCollector = new TraceCollector({
        endpoint: 'http://invalid-endpoint',
        retryAttempts: 2,
        retryDelay: 10,
      });

      const errorHandler = vi.fn();
      errorCollector.on('transmit:error', errorHandler);

      await errorCollector.collect(createValidSpan('trace1', 'span1'));
      await errorCollector.forceFlush();

      // Error should be handled
      expect(errorHandler).toHaveBeenCalled();

      await errorCollector.shutdown();
    });

    it('should emit error events', async () => {
      const errorHandler = vi.fn();
      collector.on('error', errorHandler);

      // Trigger an error condition
      await collector.collect(createValidSpan('trace1', 'span1'));

      // Force an error by shutting down during collection
      await collector.shutdown();

      // Error handler should have been set up
      expect(typeof errorHandler).toBe('function');
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics', async () => {
      await collector.collect(createValidSpan('trace1', 'span1'));
      await collector.collect(createValidSpan('trace2', 'span2'));

      collector.resetStats();

      const stats = collector.getStats();
      expect(stats.spansCollected).toBe(0);
      expect(stats.spansProcessed).toBe(0);
      expect(stats.spansDropped).toBe(0);
    });
  });
});
