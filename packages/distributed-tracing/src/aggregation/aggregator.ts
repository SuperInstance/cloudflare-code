/**
 * Trace Aggregator - Intelligent trace reconstruction and assembly
 * Handles span correlation, trace assembly, validation, and indexing
 */

import { EventEmitter } from 'eventemitter3';

import {
  Trace,
  TraceId,
  Span,
  SpanId,
  AggregationOptions,
  AggregationStats,
  TraceCompleteness,
  TraceMetrics,
  TraceService,
} from '../types/trace.types';
import { validateSpan, validateTrace, calculateCompleteness } from '../utils/validation.utils';
import {
  calculateDuration,
  calculateDurationStatistics,
  getCurrentTimestamp,
} from '../utils/time.utils';

/**
 * Default aggregation options
 */
const DEFAULT_OPTIONS: Required<AggregationOptions> = {
  timeout: 30000,
  maxSpansPerTrace: 10000,
  validateStructure: true,
  enrichWithMetadata: true,
  indexForSearch: true,
};

/**
 * Span buffer for aggregation
 */
interface SpanBuffer {
  spans: Map<SpanId, Span>;
  rootSpans: Set<SpanId>;
  parentToChildren: Map<SpanId, Set<SpanId>>;
  startTime?: number;
  endTime?: number;
  lastUpdated: number;
}

/**
 * Trace Aggregator class
 */
export class TraceAggregator extends EventEmitter {
  private options: Required<AggregationOptions>;
  private traceBuffers: Map<TraceId, SpanBuffer>;
  private completedTraces: Map<TraceId, Trace>;
  private stats: AggregationStats;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: AggregationOptions = {}) {
    super();

    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.traceBuffers = new Map();
    this.completedTraces = new Map();

    this.stats = {
      tracesAggregated: 0,
      spansAggregated: 0,
      avgAggregationTime: 0,
      aggregationErrors: 0,
      orphanedSpans: 0,
    };

    this.startCleanupTimer();
  }

  /**
   * Add a span to aggregation buffer
   */
  async addSpan(span: Span): Promise<Trace | null> {
    const startTime = Date.now();

    try {
      // Validate span
      if (this.options.validateStructure) {
        const validation = validateSpan(span);
        if (!validation.valid) {
          this.stats.aggregationErrors++;
          this.emit('span:invalid', { span, errors: validation.errors });
          return null;
        }
      }

      // Get or create trace buffer
      let buffer = this.traceBuffers.get(span.traceId);
      if (!buffer) {
        buffer = this.createBuffer();
        this.traceBuffers.set(span.traceId, buffer);
      }

      // Add span to buffer
      buffer.spans.set(span.spanId, span);
      buffer.lastUpdated = getCurrentTimestamp();

      // Update temporal bounds
      if (!buffer.startTime || span.startTime < buffer.startTime) {
        buffer.startTime = span.startTime;
      }
      const spanEnd = span.endTime || span.startTime + (span.duration || 0);
      if (!buffer.endTime || spanEnd > buffer.endTime) {
        buffer.endTime = spanEnd;
      }

      // Update parent-child relationships
      if (span.parentSpanId) {
        if (!buffer.parentToChildren.has(span.parentSpanId)) {
          buffer.parentToChildren.set(span.parentSpanId, new Set());
        }
        buffer.parentToChildren.get(span.parentSpanId)!.add(span.spanId);
      } else {
        buffer.rootSpans.add(span.spanId);
      }

      this.stats.spansAggregated++;

      // Check if trace is complete
      if (await this.isTraceComplete(span.traceId)) {
        const trace = await this.aggregateTrace(span.traceId);
        this.traceBuffers.delete(span.traceId);
        return trace;
      }

      // Update aggregation time
      const aggregationTime = Date.now() - startTime;
      this.updateAggregationTime(aggregationTime);

      return null;
    } catch (error) {
      this.stats.aggregationErrors++;
      this.emit('aggregation:error', { error, span });
      return null;
    }
  }

  /**
   * Add multiple spans
   */
  async addSpans(spans: Span[]): Promise<Array<Trace | null>> {
    const results: Array<Trace | null> = [];

    for (const span of spans) {
      const result = await this.addSpan(span);
      results.push(result);
    }

    return results;
  }

  /**
   * Aggregate a complete trace
   */
  async aggregateTrace(traceId: TraceId): Promise<Trace> {
    const buffer = this.traceBuffers.get(traceId);
    if (!buffer) {
      throw new Error(`Trace buffer not found: ${traceId}`);
    }

    // Convert buffer map to array
    const spans = Array.from(buffer.spans.values());

    // Find root span
    let rootSpan: Span;
    if (buffer.rootSpans.size === 1) {
      const rootSpanId = Array.from(buffer.rootSpans)[0];
      rootSpan = buffer.spans.get(rootSpanId)!;
    } else {
      // Multiple or zero root spans - use earliest span as root
      rootSpan = spans.reduce((earliest, span) =>
        span.startTime < earliest.startTime ? span : earliest
      );
    }

    // Build trace
    const trace: Trace = {
      traceId,
      rootSpan,
      spans,
      startTime: buffer.startTime!,
      endTime: buffer.endTime!,
      duration: calculateDuration(buffer.startTime!, buffer.endTime!),
      spanCount: spans.length,
      services: this.extractServices(spans),
      serviceMap: this.buildServiceMap(spans),
      completeness: this.analyzeCompleteness(spans, buffer),
    };

    // Enrich with metadata if enabled
    if (this.options.enrichWithMetadata) {
      trace.metrics = this.calculateMetrics(spans);
    }

    // Validate trace
    if (this.options.validateStructure) {
      const validation = validateTrace(trace);
      if (!validation.valid) {
        this.emit('trace:invalid', { trace, errors: validation.errors });
      }
    }

    // Store completed trace
    this.completedTraces.set(traceId, trace);
    this.stats.tracesAggregated++;

    // Index for search if enabled
    if (this.options.indexForSearch) {
      await this.indexTrace(trace);
    }

    this.emit('trace:aggregated', trace);

    return trace;
  }

  /**
   * Force aggregation of incomplete trace
   */
  async forceAggregate(traceId: TraceId): Promise<Trace> {
    const buffer = this.traceBuffers.get(traceId);
    if (!buffer) {
      throw new Error(`Trace buffer not found: ${traceId}`);
    }

    return await this.aggregateTrace(traceId);
  }

  /**
   * Get aggregated trace
   */
  getTrace(traceId: TraceId): Trace | null {
    return this.completedTraces.get(traceId) || null;
  }

  /**
   * Get all aggregated traces
   */
  getAllTraces(): Trace[] {
    return Array.from(this.completedTraces.values());
  }

  /**
   * Get in-progress trace IDs
   */
  getInProgressTraceIds(): TraceId[] {
    return Array.from(this.traceBuffers.keys());
  }

  /**
   * Check if trace is complete
   */
  private async isTraceComplete(traceId: TraceId): Promise<boolean> {
    const buffer = this.traceBuffers.get(traceId);
    if (!buffer) {
      return false;
    }

    // Check timeout
    const age = getCurrentTimestamp() - buffer.lastUpdated;
    if (age > this.options.timeout) {
      return true;
    }

    // Check span limit
    if (buffer.spans.size >= this.options.maxSpansPerTrace) {
      return true;
    }

    // Heuristic: trace is likely complete if we have a root span and
    // no new spans have been added recently
    if (buffer.rootSpans.size > 0 && age > 5000) {
      // 5 seconds without new spans
      return true;
    }

    return false;
  }

  /**
   * Create new span buffer
   */
  private createBuffer(): SpanBuffer {
    return {
      spans: new Map(),
      rootSpans: new Set(),
      parentToChildren: new Map(),
      lastUpdated: getCurrentTimestamp(),
    };
  }

  /**
   * Extract services from spans
   */
  private extractServices(spans: Span[]): TraceService[] {
    const serviceMap = new Map<string, TraceService>();

    for (const span of spans) {
      const serviceName = span.service;

      if (!serviceMap.has(serviceName)) {
        serviceMap.set(serviceName, {
          name: serviceName,
          version: span.serviceVersion,
          spanCount: 0,
          errorCount: 0,
          totalDuration: 0,
          avgDuration: 0,
          minDuration: Infinity,
          maxDuration: -Infinity,
        });
      }

      const service = serviceMap.get(serviceName)!;
      service.spanCount++;

      if (span.status?.code === 2) {
        // ERROR
        service.errorCount++;
      }

      const duration = span.duration || 0;
      service.totalDuration += duration;
      service.minDuration = Math.min(service.minDuration, duration);
      service.maxDuration = Math.max(service.maxDuration, duration);
    }

    // Calculate averages
    for (const service of serviceMap.values()) {
      service.avgDuration = service.totalDuration / service.spanCount;
    }

    return Array.from(serviceMap.values());
  }

  /**
   * Build service map
   */
  private buildServiceMap(spans: Span[]): Map<string, TraceService> {
    const services = this.extractServices(spans);
    return new Map(services.map((s) => [s.name, s]));
  }

  /**
   * Analyze trace completeness
   */
  private analyzeCompleteness(spans: Span[], buffer: SpanBuffer): TraceCompleteness {
    const spanIds = new Set(spans.map((s) => s.spanId));

    let orphanedSpans = 0;
    for (const span of spans) {
      if (span.parentSpanId && !spanIds.has(span.parentSpanId)) {
        orphanedSpans++;
      }
    }

    const hasRootSpan = buffer.rootSpans.size > 0;
    const allSpansConnected = orphanedSpans === 0;
    const completenessScore = calculateCompleteness({
      traceId: spans[0]?.traceId || '',
      rootSpan: spans[0],
      spans,
      startTime: buffer.startTime!,
      endTime: buffer.endTime!,
      duration: calculateDuration(buffer.startTime!, buffer.endTime!),
      spanCount: spans.length,
      services: [],
      serviceMap: new Map(),
      completeness: {} as TraceCompleteness,
    });

    return {
      hasRootSpan,
      allSpansConnected,
      orphanedSpans,
      missingSpans: 0, // We can't know this without external info
      completenessScore,
    };
  }

  /**
   * Calculate trace metrics
   */
  private calculateMetrics(spans: Span[]): TraceMetrics {
    const durations = spans.map((s) => s.duration || 0);
    const errorSpans = spans.filter((s) => s.status?.code === 2);

    const stats = calculateDurationStatistics(durations);

    return {
      totalSpans: spans.length,
      errorSpans: errorSpans.length,
      errorRate: errorSpans.length / spans.length,
      totalDuration: stats.max,
      avgDuration: stats.avg,
      minDuration: stats.min,
      maxDuration: stats.max,
      p50Duration: stats.p50,
      p95Duration: stats.p95,
      p99Duration: stats.p99,
    };
  }

  /**
   * Index trace for search
   */
  private async indexTrace(trace: Trace): Promise<void> {
    // Placeholder for indexing logic
    // In a real implementation, this would add the trace to a search index
    this.emit('trace:indexed', { traceId: trace.traceId });
  }

  /**
   * Update aggregation time
   */
  private updateAggregationTime(time: number): void {
    const count = this.stats.tracesAggregated;
    this.stats.avgAggregationTime =
      (this.stats.avgAggregationTime * (count - 1) + time) / Math.max(1, count);
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch((err) => this.emit('error', err));
    }, 60000); // Cleanup every minute
  }

  /**
   * Cleanup old incomplete traces
   */
  private async cleanup(): Promise<void> {
    const now = getCurrentTimestamp();
    const toDelete: TraceId[] = [];

    for (const [traceId, buffer] of this.traceBuffers.entries()) {
      const age = now - buffer.lastUpdated;
      if (age > this.options.timeout * 2) {
        toDelete.push(traceId);
      }
    }

    for (const traceId of toDelete) {
      const buffer = this.traceBuffers.get(traceId);
      this.stats.orphanedSpans += buffer!.spans.size;
      this.traceBuffers.delete(traceId);
      this.emit('trace:expired', { traceId, spanCount: buffer!.spans.size });
    }
  }

  /**
   * Get aggregation statistics
   */
  getStats(): AggregationStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      tracesAggregated: 0,
      spansAggregated: 0,
      avgAggregationTime: 0,
      aggregationErrors: 0,
      orphanedSpans: 0,
    };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.traceBuffers.clear();
    this.completedTraces.clear();
    this.resetStats();
    this.emit('cleared');
  }

  /**
   * Shutdown aggregator
   */
  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Force aggregate all in-progress traces
    const inProgress = this.getInProgressTraceIds();
    for (const traceId of inProgress) {
      try {
        await this.forceAggregate(traceId);
      } catch (error) {
        this.emit('shutdown:error', { traceId, error });
      }
    }

    this.emit('shutdown:completed');
  }

  /**
   * Get buffer info
   */
  getBufferInfo(): {
    inProgress: number;
    completed: number;
    totalSpansInProgress: number;
  } {
    const inProgress = this.traceBuffers.size;
    const completed = this.completedTraces.size;
    const totalSpansInProgress = Array.from(this.traceBuffers.values()).reduce(
      (sum, buffer) => sum + buffer.spans.size,
      0
    );

    return { inProgress, completed, totalSpansInProgress };
  }
}

export default TraceAggregator;
