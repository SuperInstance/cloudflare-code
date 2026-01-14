/**
 * Tests for distributed tracing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DistributedTracer } from '../src/tracing';
import { TraceOptions } from '../src/types';

describe('DistributedTracer', () => {
  let tracer: DistributedTracer;

  beforeEach(() => {
    tracer = new DistributedTracer('test-service');
  });

  describe('startSpan', () => {
    it('should start a new span with context', () => {
      const { span, context } = tracer.startSpan('test-operation');

      expect(span).toBeDefined();
      expect(context).toBeDefined();
      expect(context.traceId).toBeDefined();
      expect(context.spanId).toBeDefined();
    });

    it('should create unique trace IDs for each root span', () => {
      const { context: context1 } = tracer.startSpan('operation-1');
      const { context: context2 } = tracer.startSpan('operation-2');

      expect(context1.traceId).not.toBe(context2.traceId);
    });
  });

  describe('injectContext', () => {
    it('should inject trace context into headers', () => {
      const { span } = tracer.startSpan('test-operation');
      const headers = tracer.injectContext({});

      expect(headers).toBeDefined();
      // OpenTelemetry propagation headers should be present
    });
  });

  describe('recordSpan', () => {
    it('should record span metadata', () => {
      const spanId = 'test-span-id';
      const metadata = {
        name: 'test-span',
        kind: 0,
        startTime: Date.now(),
        duration: 100,
        status: 1,
        attributes: {
          'trace.id': 'test-trace',
          'span.id': spanId,
        },
        events: [],
        links: [],
        resource: {
          serviceName: 'test-service',
          attributes: {},
        },
      };

      tracer.recordSpan(spanId, metadata);
      const retrieved = tracer.getSpan(spanId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('test-span');
    });
  });

  describe('buildTraceTree', () => {
    it('should build a tree from recorded spans', () => {
      const traceId = 'test-trace';
      const parentSpanId = 'parent-span';
      const childSpanId = 'child-span';

      const parentMetadata = {
        name: 'parent',
        kind: 0,
        startTime: Date.now(),
        duration: 200,
        status: 1,
        attributes: {
          'trace.id': traceId,
          'span.id': parentSpanId,
        },
        events: [],
        links: [],
        resource: {
          serviceName: 'test-service',
          attributes: {},
        },
      };

      const childMetadata = {
        name: 'child',
        kind: 0,
        startTime: Date.now(),
        duration: 100,
        status: 1,
        attributes: {
          'trace.id': traceId,
          'span.id': childSpanId,
        },
        events: [],
        links: [],
        resource: {
          serviceName: 'test-service',
          attributes: {},
        },
      };

      tracer.recordSpan(parentSpanId, parentMetadata);
      tracer.recordSpan(childSpanId, childMetadata, parentSpanId);

      const tree = tracer.buildTraceTree(traceId);

      expect(tree).toBeDefined();
      expect(tree?.span.name).toBe('parent');
      expect(tree?.children.length).toBe(1);
      expect(tree?.children[0].span.name).toBe('child');
    });
  });

  describe('addDependency', () => {
    it('should track service dependencies', () => {
      tracer.addDependency({
        serviceName: 'database',
        operation: 'query',
        latency: 50,
        success: true,
      });

      const serviceMap = tracer.generateServiceMap();

      expect(serviceMap.nodes.length).toBeGreaterThan(0);
      expect(serviceMap.edges.length).toBeGreaterThan(0);
    });
  });

  describe('generateServiceMap', () => {
    it('should generate a complete service map', () => {
      tracer.addDependency({
        serviceName: 'api-service',
        operation: 'GET',
        latency: 100,
        success: true,
      });

      tracer.addDependency({
        serviceName: 'cache',
        operation: 'GET',
        latency: 10,
        success: true,
      });

      const map = tracer.generateServiceMap();

      expect(map.nodes.length).toBeGreaterThan(0);
      expect(map.edges.length).toBeGreaterThan(0);
      expect(map.timestamp).toBeDefined();
    });
  });

  describe('getTraceStatistics', () => {
    it('should calculate trace statistics', () => {
      const stats = tracer.getTraceStatistics();

      expect(stats).toHaveProperty('totalSpans');
      expect(stats).toHaveProperty('totalTraces');
      expect(stats).toHaveProperty('avgSpansPerTrace');
    });
  });

  describe('clear', () => {
    it('should clear all recorded spans', () => {
      const metadata = {
        name: 'test',
        kind: 0,
        startTime: Date.now(),
        duration: 100,
        status: 1,
        attributes: {
          'trace.id': 'trace-1',
          'span.id': 'span-1',
        },
        events: [],
        links: [],
        resource: {
          serviceName: 'test',
          attributes: {},
        },
      };

      tracer.recordSpan('span-1', metadata);
      tracer.clear();

      const stats = tracer.getTraceStatistics();
      expect(stats.totalSpans).toBe(0);
    });
  });
});
