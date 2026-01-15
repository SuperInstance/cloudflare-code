/**
 * Unit tests for Trace Analyzer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TraceAnalyzer } from '../../src/analyzer';
import { Trace, Span, SpanKind, TraceId, SpanId } from '../../src/types/trace.types';

describe('TraceAnalyzer', () => {
  let analyzer: TraceAnalyzer;

  beforeEach(() => {
    analyzer = new TraceAnalyzer();
  });

  const createValidSpan = (
    traceId: string,
    spanId: string,
    parentSpanId?: string,
    duration?: number,
    hasError?: boolean
  ): Span => ({
    traceId: traceId as TraceId,
    spanId: spanId as SpanId,
    parentSpanId,
    name: `span-${spanId}`,
    kind: SpanKind.INTERNAL,
    startTime: 1000,
    endTime: 1000 + (duration || 100),
    duration: duration || 100,
    status: hasError ? { code: 2, message: 'Test error' } : { code: 1 },
    service: 'test-service',
  });

  const createValidTrace = (spanCount = 5, includeErrors = false): Trace => {
    const traceId = '0123456789abcdef0123456789abcdef' as TraceId;
    const spans: Span[] = [];

    // Create root span
    const rootSpan = createValidSpan(traceId, 'root', undefined, 500);
    spans.push(rootSpan);

    // Create child spans
    for (let i = 1; i < spanCount; i++) {
      const spanId = `span${i}`;
      const hasError = includeErrors && i === 2;
      spans.push(createValidSpan(traceId, spanId, 'root', 100, hasError));
    }

    return {
      traceId,
      rootSpan,
      spans,
      startTime: 1000,
      endTime: 1600,
      duration: 600,
      spanCount,
      services: [],
      serviceMap: new Map(),
      completeness: {
        hasRootSpan: true,
        allSpansConnected: true,
        orphanedSpans: 0,
        missingSpans: 0,
        completenessScore: 1.0,
      },
    };
  };

  describe('analyze', () => {
    it('should analyze a valid trace', async () => {
      const trace = createValidTrace();
      const analysis = await analyzer.analyze(trace);

      expect(analysis).toBeDefined();
      expect(analysis.bottlenecks).toBeDefined();
      expect(analysis.criticalPath).toBeDefined();
      expect(analysis.errorAnalysis).toBeDefined();
      expect(analysis.latencyAnalysis).toBeDefined();
      expect(analysis.performanceInsights).toBeDefined();
    });

    it('should cache analysis results', async () => {
      const trace = createValidTrace();

      const firstAnalysis = await analyzer.analyze(trace);
      const secondAnalysis = await analyzer.analyze(trace);

      expect(firstAnalysis).toBe(secondAnalysis);
    });

    it('should generate bottlenecks', async () => {
      const trace = createValidTrace();
      const analysis = await analyzer.analyze(trace);

      expect(Array.isArray(analysis.bottlenecks)).toBe(true);
    });

    it('should detect slow operations as bottlenecks', async () => {
      const trace = createValidTrace();
      // Make a span very slow
      trace.spans[1].duration = 2000000; // 2 seconds

      const analysis = await analyzer.analyze(trace);

      const slowBottlenecks = analysis.bottlenecks.filter(
        b => b.reason.includes('took')
      );
      expect(slowBottlenecks.length).toBeGreaterThan(0);
    });

    it('should detect errors as critical bottlenecks', async () => {
      const trace = createValidTrace(5, true);
      const analysis = await analyzer.analyze(trace);

      const errorBottlenecks = analysis.bottlenecks.filter(
        b => b.severity === 'critical'
      );
      expect(errorBottlenecks.length).toBeGreaterThan(0);
    });

    it('should find critical path', async () => {
      const trace = createValidTrace();
      const analysis = await analyzer.analyze(trace);

      expect(analysis.criticalPath.spans).toBeDefined();
      expect(analysis.criticalPath.totalDuration).toBeGreaterThan(0);
      expect(analysis.criticalPath.steps).toBeDefined();
    });

    it('should analyze errors', async () => {
      const trace = createValidTrace(5, true);
      const analysis = await analyzer.analyze(trace);

      expect(analysis.errorAnalysis.totalErrors).toBeGreaterThan(0);
      expect(analysis.errorAnalysis.errorSpans).toBeDefined();
      expect(analysis.errorAnalysis.errorPatterns).toBeDefined();
    });

    it('should identify root causes', async () => {
      const trace = createValidTrace(5, true);
      const analysis = await analyzer.analyze(trace);

      expect(analysis.errorAnalysis.rootCauses).toBeDefined();
      expect(Array.isArray(analysis.errorAnalysis.rootCauses)).toBe(true);
    });

    it('should analyze latency', async () => {
      const trace = createValidTrace();
      const analysis = await analyzer.analyze(trace);

      expect(analysis.latencyAnalysis.percentiles).toBeDefined();
      expect(analysis.latencyAnalysis.percentiles.p50).toBeDefined();
      expect(analysis.latencyAnalysis.percentiles.p95).toBeDefined();
      expect(analysis.latencyAnalysis.percentiles.p99).toBeDefined();
    });

    it('should detect outliers', async () => {
      const trace = createValidTrace();
      // Add an outlier span
      const outlierSpan = createValidSpan(trace.traceId, 'outlier', 'root', 10000);
      trace.spans.push(outlierSpan);
      trace.spanCount++;

      const analysis = await analyzer.analyze(trace);

      expect(analysis.latencyAnalysis.outliers).toBeDefined();
      expect(analysis.latencyAnalysis.outliers.length).toBeGreaterThan(0);
    });

    it('should find slow operations', async () => {
      const trace = createValidTrace();
      const analysis = await analyzer.analyze(trace);

      expect(analysis.latencyAnalysis.slowOperations).toBeDefined();
      expect(Array.isArray(analysis.latencyAnalysis.slowOperations)).toBe(true);
    });

    it('should create time distribution', async () => {
      const trace = createValidTrace();
      const analysis = await analyzer.analyze(trace);

      expect(analysis.latencyAnalysis.timeDistribution).toBeDefined();
      expect(Array.isArray(analysis.latencyAnalysis.timeDistribution)).toBe(true);
    });

    it('should generate performance insights', async () => {
      const trace = createValidTrace();
      const analysis = await analyzer.analyze(trace);

      expect(analysis.performanceInsights).toBeDefined();
      expect(Array.isArray(analysis.performanceInsights)).toBe(true);
    });

    it('should generate warning for high error rate', async () => {
      const trace = createValidTrace(10, true);
      // Make more spans have errors
      for (let i = 0; i < 5; i++) {
        trace.spans[i].status = { code: 2, message: 'Error' };
      }

      const analysis = await analyzer.analyze(trace);

      const errorInsights = analysis.performanceInsights.filter(
        i => i.category === 'reliability' && i.type === 'warning'
      );
      expect(errorInsights.length).toBeGreaterThan(0);
    });

    it('should generate warning for long trace duration', async () => {
      const trace = createValidTrace();
      trace.duration = 10000000; // 10 seconds

      const analysis = await analyzer.analyze(trace);

      const latencyInsights = analysis.performanceInsights.filter(
        i => i.category === 'latency' && i.type === 'warning'
      );
      expect(latencyInsights.length).toBeGreaterThan(0);
    });

    it('should generate info for high span count', async () => {
      const trace = createValidTrace(150);
      const analysis = await analyzer.analyze(trace);

      const complexityInsights = analysis.performanceInsights.filter(
        i => i.category === 'complexity' && i.type === 'info'
      );
      expect(complexityInsights.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeBatch', () => {
    it('should analyze multiple traces', async () => {
      const traces = [createValidTrace(5), createValidTrace(10), createValidTrace(15)];

      const results = await analyzer.analyzeBatch(traces);

      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(3);
    });

    it('should return results keyed by trace ID', async () => {
      const traces = [createValidTrace(5), createValidTrace(10)];

      const results = await analyzer.analyzeBatch(traces);

      for (const trace of traces) {
        expect(results.has(trace.traceId)).toBe(true);
      }
    });
  });

  describe('options', () => {
    it('should respect includeBottlenecks option', async () => {
      const analyzerWithOptions = new TraceAnalyzer({
        includeBottlenecks: false,
      });

      const trace = createValidTrace();
      const analysis = await analyzerWithOptions.analyze(trace);

      expect(analysis.bottlenecks).toHaveLength(0);
    });

    it('should respect includeCriticalPath option', async () => {
      const analyzerWithOptions = new TraceAnalyzer({
        includeCriticalPath: false,
      });

      const trace = createValidTrace();
      const analysis = await analyzerWithOptions.analyze(trace);

      expect(analysis.criticalPath.spans).toHaveLength(0);
    });

    it('should respect includeErrorAnalysis option', async () => {
      const analyzerWithOptions = new TraceAnalyzer({
        includeErrorAnalysis: false,
      });

      const trace = createValidTrace();
      const analysis = await analyzerWithOptions.analyze(trace);

      expect(analysis.errorAnalysis.totalErrors).toBe(0);
    });

    it('should respect includeLatencyAnalysis option', async () => {
      const analyzerWithOptions = new TraceAnalyzer({
        includeLatencyAnalysis: false,
      });

      const trace = createValidTrace();
      const analysis = await analyzerWithOptions.analyze(trace);

      expect(analysis.latencyAnalysis.percentiles.p50).toBe(0);
    });

    it('should respect includePerformanceInsights option', async () => {
      const analyzerWithOptions = new TraceAnalyzer({
        includePerformanceInsights: false,
      });

      const trace = createValidTrace();
      const analysis = await analyzerWithOptions.analyze(trace);

      expect(analysis.performanceInsights).toHaveLength(0);
    });

    it('should respect custom bottleneckThreshold', async () => {
      const analyzerWithOptions = new TraceAnalyzer({
        bottleneckThreshold: 0.8, // Higher threshold
      });

      const trace = createValidTrace();
      const analysis = await analyzerWithOptions.analyze(trace);

      // Should have fewer bottlenecks with higher threshold
      expect(analysis.bottlenecks).toBeDefined();
    });

    it('should respect custom slowOperationThreshold', async () => {
      const analyzerWithOptions = new TraceAnalyzer({
        slowOperationThreshold: 5000000, // 5 seconds
      });

      const trace = createValidTrace();
      trace.spans[1].duration = 2000000; // 2 seconds

      const analysis = await analyzerWithOptions.analyze(trace);

      // Should not detect 2s as slow when threshold is 5s
      const slowOps = analysis.latencyAnalysis.slowOperations.filter(
        s => s.spanId === trace.spans[1].spanId
      );
      expect(slowOps.length).toBe(0);
    });
  });

  describe('statistics', () => {
    it('should track analysis statistics', async () => {
      const trace = createValidTrace();
      await analyzer.analyze(trace);

      const stats = analyzer.getStats();
      expect(stats.tracesAnalyzed).toBe(1);
    });

    it('should track bottlenecks found', async () => {
      const trace = createValidTrace();
      await analyzer.analyze(trace);

      const stats = analyzer.getStats();
      expect(stats.bottlenecksFound).toBeGreaterThanOrEqual(0);
    });

    it('should track errors analyzed', async () => {
      const trace = createValidTrace(5, true);
      await analyzer.analyze(trace);

      const stats = analyzer.getStats();
      expect(stats.errorsAnalyzed).toBeGreaterThan(0);
    });

    it('should track insights generated', async () => {
      const trace = createValidTrace();
      await analyzer.analyze(trace);

      const stats = analyzer.getStats();
      expect(stats.insightsGenerated).toBeGreaterThan(0);
    });

    it('should calculate average analysis time', async () => {
      const trace = createValidTrace();
      await analyzer.analyze(trace);
      await analyzer.analyze(trace);

      const stats = analyzer.getStats();
      expect(stats.avgAnalysisTime).toBeGreaterThan(0);
    });
  });

  describe('cache management', () => {
    it('should cache analysis results', async () => {
      const trace = createValidTrace();

      await analyzer.analyze(trace);
      const stats1 = analyzer.getStats();

      await analyzer.analyze(trace);
      const stats2 = analyzer.getStats();

      // Stats should not increment for cached result
      expect(stats2.tracesAnalyzed).toBe(stats1.tracesAnalyzed);
    });

    it('should clear cache', async () => {
      const trace = createValidTrace();

      await analyzer.analyze(trace);
      analyzer.clearCache();

      await analyzer.analyze(trace);

      const stats = analyzer.getStats();
      expect(stats.tracesAnalyzed).toBe(2); // Should analyze again after cache clear
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics', async () => {
      const trace = createValidTrace();
      await analyzer.analyze(trace);

      analyzer.resetStats();

      const stats = analyzer.getStats();
      expect(stats.tracesAnalyzed).toBe(0);
      expect(stats.bottlenecksFound).toBe(0);
      expect(stats.errorsAnalyzed).toBe(0);
      expect(stats.insightsGenerated).toBe(0);
    });
  });
});
