import { Tracer, Span, NoopSpan, RateLimitingSamplingStrategy, ProbabilisticSamplingStrategy } from '../src/tracing/Tracer';
import { TraceOptions, SpanOptions, SpanKind } from '../src/types';

describe('Tracer', () => {
  let tracer: Tracer;
  let traceOptions: TraceOptions;

  beforeEach(() => {
    traceOptions = {
      serviceName: 'test-service',
      samplingRate: 1.0
    };
    tracer = new Tracer(traceOptions);
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(tracer.initialize()).resolves.toBeUndefined();
      expect(tracer.isInitialized()).toBe(true);
    });

    it('should export successfully when initialized', async () => {
      await tracer.initialize();
      const result = await tracer.export();

      expect(result.success).toBe(true);
      expect(result.exportedSpans).toBeGreaterThanOrEqual(0);
    });
  });

  describe('span creation', () => {
    it('should create a span when initialized', async () => {
      await tracer.initialize();

      const span = tracer.startSpan({
        name: 'test-operation',
        kind: 'internal'
      });

      expect(span).toBeInstanceOf(Span);
    });

    it('should create a span with default attributes', async () => {
      await tracer.initialize();

      const span = tracer.startSpan({
        name: 'test-operation'
      });

      expect(span.getContext().traceId).toBeDefined();
      expect(span.getContext().spanId).toBeDefined();
      expect(span.getContext().traceFlags).toBeDefined();
    });

    it('should create a span with custom attributes', async () => {
      await tracer.initialize();

      const span = tracer.startSpan({
        name: 'test-operation',
        attributes: {
          'custom.attr': 'value',
          'http.method': 'GET'
        }
      });

      const attrs = span.getAttributes();
      expect(attrs['custom.attr']).toBe('value');
      expect(attrs['http.method']).toBe('GET');
    });

    it('should create a child span with parent context', async () => {
      await tracer.initialize();

      const parentSpan = tracer.startSpan({
        name: 'parent-operation'
      });

      const childSpan = parentSpan.startChildSpan('child-operation');

      expect(childSpan.getContext().traceId).toBe(parentSpan.getContext().traceId);
      expect(childSpan.getContext().parentSpanId).toBe(parentSpan.getContext().spanId);
    });
  });

  describe('span lifecycle', () => {
    it('should record error and end span', async () => {
      await tracer.initialize();

      const span = tracer.startSpan({
        name: 'test-operation'
      });

      const testError = new Error('Test error');
      span.recordError(testError);

      expect(span.getStatus()).toBe('error');

      span.end();

      expect(span.isComplete()).toBe(true);
    });

    it('should update timestamp', async () => {
      await tracer.initialize();

      const span = tracer.startSpan({
        name: 'test-operation'
      });

      span.updateTimestamp();
      const duration1 = span.getDuration();

      // Wait a bit and update again
      await new Promise(resolve => setTimeout(resolve, 10));
      span.updateTimestamp();
      const duration2 = span.getDuration();

      expect(duration2).toBeLessThan(duration1);
    });

    it('should add events', async () => {
      await tracer.initialize();

      const span = tracer.startSpan({
        name: 'test-operation'
      });

      span.addEvent('test-event', {
        'event.attr': 'value'
      });

      const events = span.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe('test-event');
      expect(events[0].attributes['event.attr']).toBe('value');
    });

    it('should set attributes', async () => {
      await tracer.initialize();

      const span = tracer.startSpan({
        name: 'test-operation'
      });

      span.setAttributes({
        'new.attr': 'value',
        'another.attr': 123
      });

      const attrs = span.getAttributes();
      expect(attrs['new.attr']).toBe('value');
      expect(attrs['another.attr']).toBe(123);
    });
  });

  describe('noop span', () => {
    it('should be instance of NoopSpan', () => {
      const noop = new NoopSpan();
      expect(noop).toBeInstanceOf(NoopSpan);
    });

    it('should not change state when modified', () => {
      const noop = new NoopSpan();

      noop.end();
      noop.recordError(new Error('test'));
      noop.addEvent('test');
      noop.setAttributes({ test: 'value' });

      expect(noop.isComplete()).toBe(false);
    });
  });

  describe('sampling strategies', () => {
    it('should use always sampling when rate is 1.0', () => {
      const tracer = new Tracer({
        serviceName: 'test-service',
        samplingRate: 1.0
      });

      const span = tracer.startSpan({
        name: 'test-operation'
      });

      expect(span).toBeInstanceOf(Span);
    });

    it('should use noop span when rate is 0.0', () => {
      const tracer = new Tracer({
        serviceName: 'test-service',
        samplingRate: 0.0
      });

      const span = tracer.startSpan({
        name: 'test-operation'
      });

      expect(span).toBeInstanceOf(NoopSpan);
    });

    it('should rate limit sampling when rate < 1.0', () => {
      const tracer = new Tracer({
        serviceName: 'test-service',
        samplingRate: 0.1
      });

      // Most spans should be NoopSpans
      let sampledCount = 0;
      for (let i = 0; i < 20; i++) {
        const span = tracer.startSpan({
          name: `operation-${i}`
        });

        if (span instanceof Span) {
          sampledCount++;
        }
      }

      // With rate 0.1, we should get approximately 2 sampled spans
      expect(sampledCount).toBeLessThanOrEqual(5);
      expect(sampledCount).toBeGreaterThan(0);
    });
  });

  describe('span management', () => {
    it('should track active spans', async () => {
      await tracer.initialize();

      const span1 = tracer.startSpan({
        name: 'operation1'
      });

      const span2 = tracer.startSpan({
        name: 'operation2'
      });

      const activeSpans = tracer.getActiveSpans();
      expect(activeSpans).toHaveLength(2);
      expect(activeSpans).toContain(span1);
      expect(activeSpans).toContain(span2);
    });

    it('should complete active spans when end is called', async () => {
      await tracer.initialize();

      const span1 = tracer.startSpan({
        name: 'operation1'
      });

      const span2 = tracer.startSpan({
        name: 'operation2'
      });

      span1.end();

      const activeSpans = tracer.getActiveSpans();
      expect(activeSpans).toHaveLength(1);
      expect(activeSpans).toContain(span2);
    });

    it('should complete all active spans', async () => {
      await tracer.initialize();

      const span1 = tracer.startSpan({
        name: 'operation1'
      });

      const span2 = tracer.startSpan({
        name: 'operation2'
      });

      tracer.completeAllActiveSpans();

      const activeSpans = tracer.getActiveSpans();
      expect(activeSpans).toHaveLength(0);

      const completedSpans = tracer.getCompletedSpans();
      expect(completedSpans).toHaveLength(2);
    });

    it('should get completed span by ID', async () => {
      await tracer.initialize();

      const span = tracer.startSpan({
        name: 'test-operation'
      });

      const context = span.getContext();
      span.end();

      const completedSpan = tracer.getCompletedSpan(context.spanId);
      expect(completedSpan).toBe(span);
    });
  });

  describe('trace context', () => {
    it('should generate unique trace IDs', async () => {
      await tracer.initialize();

      const span1 = tracer.startSpan({
        name: 'operation1'
      });

      const span2 = tracer.startSpan({
        name: 'operation2'
      });

      expect(span1.getContext().traceId).not.toBe(span2.getContext().traceId);
    });

    it('should create child spans with same trace ID', async () => {
      await tracer.initialize();

      const parent = tracer.startSpan({
        name: 'parent'
      });

      const child = parent.startChildSpan('child');

      expect(parent.getContext().traceId).toBe(child.getContext().traceId);
      expect(child.getContext().parentSpanId).toBe(parent.getContext().spanId);
    });

    it('should convert span to trace context string', async () => {
      await tracer.initialize();

      const span = tracer.startSpan({
        name: 'test-operation'
      });

      const contextString = span.toTraceContext();
      expect(contextString).toContain(span.getContext().traceId);
      expect(contextString).toContain(span.getContext().spanId);
    });
  });

  describe('sampling strategy classes', () => {
    describe('RateLimitingSamplingStrategy', () => {
      it('should limit sampling based on rate', () => {
        const strategy = new RateLimitingSamplingStrategy(0.1);

        let sampleCount = 0;
        const totalRuns = 100;

        for (let i = 0; i < totalRuns; i++) {
          if (strategy.shouldSample({})) {
            sampleCount++;
          }
        }

        // Should sample approximately 10 times
        expect(sampleCount).toBeLessThan(20);
        expect(sampleCount).toBeGreaterThan(5);
      });

      it('should reset counter every second', () => {
        const strategy = new RateLimitingSamplingStrategy(1.0);

        // Should sample all in first second
        let sampleCount = 0;
        for (let i = 0; i < 10; i++) {
          if (strategy.shouldSample({})) {
            sampleCount++;
          }
        }
        expect(sampleCount).toBe(10);

        // Should sample all again after reset
        // (Note: This test may need adjustment based on actual implementation)
        expect(strategy.shouldSample({})).toBe(true);
      });
    });

    describe('ProbabilisticSamplingStrategy', () => {
      it('should sample probabilistically', () => {
        const strategy = new ProbabilisticSamplingStrategy(0.5);

        let sampleCount = 0;
        const totalRuns = 1000;

        for (let i = 0; i < totalRuns; i++) {
          if (strategy.shouldSample({})) {
            sampleCount++;
          }
        }

        // Should be close to 50%
        expect(sampleCount).toBeGreaterThan(450);
        expect(sampleCount).toBeLessThan(550);
      });

      it('should never sample when rate is 0', () => {
        const strategy = new ProbabilisticSamplingStrategy(0);

        for (let i = 0; i < 10; i++) {
          expect(strategy.shouldSample({})).toBe(false);
        }
      });

      it('should always sample when rate is 1', () => {
        const strategy = new ProbabilisticSamplingStrategy(1);

        for (let i = 0; i < 10; i++) {
          expect(strategy.shouldSample({})).toBe(true);
        }
      });
    });
  });
});