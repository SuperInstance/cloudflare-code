/**
 * Unit tests for distributed tracing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  Tracer,
  Span,
  FixedRateSamplingStrategy,
  TraceIDBasedSamplingStrategy,
  AutoInstrumentation,
  type TraceOptions,
  type SpanOptions,
} from '../../src/tracing/tracer';

describe('Tracer', () => {
  let tracer: Tracer;
  let options: TraceOptions;

  beforeEach(() => {
    options = {
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      environment: 'test',
      samplingRate: 1.0,
      exporter: 'console',
    };
    tracer = new Tracer(options);
  });

  afterEach(async () => {
    await tracer.shutdown();
  });

  describe('Span Creation', () => {
    it('should create a new span', () => {
      const spanOptions: SpanOptions = {
        name: 'test-operation',
        kind: 'server',
        attributes: { 'test.key': 'test-value' },
      };
      
      const span = tracer.startSpan(spanOptions);
      expect(span).toBeInstanceOf(Span);
      expect(span.isEnded()).toBe(false);
      span.end();
      expect(span.isEnded()).toBe(true);
    });

    it('should record span attributes', () => {
      const span = tracer.startSpan({
        name: 'test-span',
        attributes: { key1: 'value1', key2: 42 },
      });
      
      const context = span.getContext();
      expect(context).toBeDefined();
      expect(context.traceId).toBeDefined();
      expect(context.spanId).toBeDefined();
      
      span.end();
    });

    it('should add events to span', () => {
      const span = tracer.startSpan({ name: 'test-span' });
      
      span.addEvent('event1', { data: 'value' });
      span.addEvent('event2', { data: 'value2' });
      
      span.end();
    });

    it('should record exceptions', () => {
      const span = tracer.startSpan({ name: 'test-span' });
      
      const error = new Error('Test error');
      span.recordException(error);
      
      span.end();
    });
  });

  describe('Async Operations', () => {
    it('should wrap async operations', async () => {
      const result = await tracer.withSpan(
        { name: 'async-operation' },
        async (span) => {
          expect(span).toBeInstanceOf(Span);
          await new Promise(resolve => setTimeout(resolve, 10));
          return 'result';
        }
      );
      
      expect(result).toBe('result');
    });

    it('should handle errors in async operations', async () => {
      await expect(
        tracer.withSpan({ name: 'failing-operation' }, async () => {
          throw new Error('Operation failed');
        })
      ).rejects.toThrow('Operation failed');
    });
  });

  describe('Context Propagation', () => {
    it('should inject trace context into headers', () => {
      const span = tracer.startSpan({ name: 'test-span' });
      const headers = tracer.injectTraceContext({});
      
      expect(headers).toHaveProperty('traceparent');
      expect(headers.traceparent).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-0\d$/);
      
      span.end();
    });

    it('should extract trace context from headers', () => {
      const headers = {
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      };
      
      const context = tracer.extractTraceContext(headers);
      expect(context).not.toBeNull();
      expect(context?.traceId).toBe('0af7651916cd43dd8448eb211c80319c');
    });
  });

  describe('Sampling Strategies', () => {
    it('should use fixed rate sampling', () => {
      const strategy = new FixedRateSamplingStrategy(0.5);
      let sampled = 0;
      
      for (let i = 0; i < 1000; i++) {
        if (strategy.shouldSample({
          traceId: 'test-trace',
          spanName: 'test-span',
        })) {
          sampled++;
        }
      }
      
      // Should be around 50%
      expect(sampled).toBeGreaterThan(400);
      expect(sampled).toBeLessThan(600);
    });

    it('should use trace ID based sampling', () => {
      const strategy = new TraceIDBasedSamplingStrategy(1.0);
      
      const result1 = strategy.shouldSample({
        traceId: 'trace1',
        spanName: 'span1',
      });
      
      const result2 = strategy.shouldSample({
        traceId: 'trace1',
        spanName: 'span2',
      });
      
      // Same trace should get same sampling decision
      expect(result1).toBe(result2);
    });
  });

  describe('Tracer Configuration', () => {
    it('should enable and disable tracing', () => {
      expect(tracer.isEnabled()).toBe(true);
      
      tracer.setEnabled(false);
      expect(tracer.isEnabled()).toBe(false);
      
      tracer.setEnabled(true);
      expect(tracer.isEnabled()).toBe(true);
    });

    it('should force flush pending spans', async () => {
      tracer.startSpan({ name: 'flush-test' }).end();
      
      await expect(tracer.forceFlush()).resolves.not.toThrow();
    });
  });
});

describe('AutoInstrumentation', () => {
  let autoInstrumentation: AutoInstrumentation;
  let tracer: Tracer;

  beforeEach(() => {
    tracer = new Tracer({
      serviceName: 'test-service',
      exporter: 'console',
    });
    autoInstrumentation = new AutoInstrumentation(tracer);
  });

  afterEach(async () => {
    await tracer.shutdown();
  });

  it('should enable HTTP instrumentation', () => {
    autoInstrumentation.enableHTTPInstrumentation();
    const active = autoInstrumentation.getActiveInstrumentations();
    
    expect(active).toContain('http');
  });

  it('should enable Express instrumentation', () => {
    autoInstrumentation.enableExpressInstrumentation();
    const active = autoInstrumentation.getActiveInstrumentations();
    
    expect(active).toContain('express');
  });

  it('should disable specific instrumentation', () => {
    autoInstrumentation.enableHTTPInstrumentation();
    autoInstrumentation.disableInstrumentation('http');
    
    const active = autoInstrumentation.getActiveInstrumentations();
    expect(active).not.toContain('http');
  });
});
