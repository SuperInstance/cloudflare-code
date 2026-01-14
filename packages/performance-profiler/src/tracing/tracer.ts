/**
 * Execution Tracer - Distributed tracing with span analysis
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  TraceSpan,
  TraceContext,
  TraceLog,
  SpanReference,
  CriticalPath,
  Bottleneck,
  ProfilerEvent,
} from '../types';

export interface TracerOptions {
  /**
   * Enable distributed tracing
   */
  enabled?: boolean;

  /**
   * Sampling rate (0-1)
   */
  samplingRate?: number;

  /**
   * Maximum number of spans to keep
   */
  maxSpans?: number;

  /**
   * Enable baggage propagation
   */
  enableBaggage?: boolean;

  /**
   * Enable automatic critical path analysis
   */
  enableCriticalPathAnalysis?: boolean;

  /**
   * Minimum span duration to record (microseconds)
   */
  minDuration?: number;

  /**
   * Filter spans by operation name
   */
  operationFilter?: RegExp[];

  /**
   * Export format
   */
  exportFormat?: 'json' | 'jaeger' | 'zipkin';
}

export interface TraceOptions {
  /**
   * Operation name
   */
  operationName: string;

  /**
   * Tags to attach to the span
   */
  tags?: Record<string, string | number | boolean>;

  /**
   * Parent span context
   */
  parentContext?: TraceContext;

  /**
   * Span references
   */
  references?: SpanReference[];

  /**
   * Start time (optional, defaults to now)
   */
  startTime?: number;

  /**
   * Whether to follow from parent
   */
  followFrom?: boolean;
}

export interface SpanMetrics {
  operationName: string;
  count: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  errorCount: number;
  errorRate: number;
}

export interface TraceStatistics {
  totalTraces: number;
  totalSpans: number;
  averageSpansPerTrace: number;
  averageTraceDuration: number;
  operationsCount: number;
  errorRate: number;
  sampledRate: number;
}

/**
 * Distributed Tracer implementation
 */
export class ExecutionTracer extends EventEmitter {
  private spans: Map<string, TraceSpan> = new Map();
  private activeSpans: Map<string, TraceSpan> = new Map();
  private traces: Map<string, TraceSpan[]> = new Map();
  private metrics: Map<string, SpanMetrics> = new Map();
  private options: Required<TracerOptions>;
  private currentContext?: TraceContext;

  constructor(options: TracerOptions = {}) {
    super();
    this.options = {
      enabled: options.enabled ?? true,
      samplingRate: options.samplingRate ?? 1.0,
      maxSpans: options.maxSpans ?? 10000,
      enableBaggage: options.enableBaggage ?? true,
      enableCriticalPathAnalysis: options.enableCriticalPathAnalysis ?? true,
      minDuration: options.minDuration ?? 0,
      operationFilter: options.operationFilter ?? [],
      exportFormat: options.exportFormat ?? 'json',
    };
  }

  /**
   * Start a new trace span
   */
  public startSpan(options: TraceOptions): TraceSpan | null {
    if (!this.options.enabled) {
      return null;
    }

    // Check sampling
    if (Math.random() > this.options.samplingRate) {
      return null;
    }

    // Check operation filter
    if (this.options.operationFilter.length > 0) {
      const matches = this.options.operationFilter.some((pattern) =>
        pattern.test(options.operationName)
      );
      if (!matches) {
        return null;
      }
    }

    const traceId = options.parentContext?.traceId ?? uuidv4();
    const spanId = uuidv4();
    const parentSpanId = options.parentContext?.spanId;

    const span: TraceSpan = {
      traceId,
      spanId,
      parentSpanId,
      operationName: options.operationName,
      startTime: options.startTime ?? Date.now(),
      duration: 0, // Will be set on finish
      tags: options.tags ?? {},
      logs: [],
      references: options.references ?? [],
      status: { code: 0 },
    };

    // Add to active spans
    this.activeSpans.set(spanId, span);

    // Store span
    this.spans.set(spanId, span);

    // Add to trace
    let traceSpans = this.traces.get(traceId);
    if (!traceSpans) {
      traceSpans = [];
      this.traces.set(traceId, traceSpans);
    }
    traceSpans.push(span);

    // Update context
    this.currentContext = {
      traceId,
      spanId,
      parentSpanId,
      baggage: options.parentContext?.baggage ?? {},
      sampled: true,
    };

    return span;
  }

  /**
   * Finish a trace span
   */
  public finishSpan(span: TraceSpan, endTime?: number): void {
    if (!span) {
      return;
    }

    // Set duration
    span.duration = (endTime ?? Date.now()) - span.startTime;

    // Remove from active spans
    this.activeSpans.delete(span.spanId);

    // Check minimum duration
    if (span.duration < this.options.minDuration) {
      return;
    }

    // Update metrics
    this.updateMetrics(span);

    // Perform critical path analysis if enabled
    if (this.options.enableCriticalPathAnalysis) {
      this.analyzeCriticalPath(span.traceId);
    }
  }

  /**
   * Start and finish a span automatically
   */
  public async withSpan<T>(
    options: TraceOptions,
    fn: (span: TraceSpan) => T | Promise<T>
  ): Promise<T | null> {
    const span = this.startSpan(options);
    if (!span) {
      return fn(null as any);
    }

    try {
      const result = await fn(span);
      this.finishSpan(span);
      return result;
    } catch (error) {
      span.status = {
        code: 1,
        message: error instanceof Error ? error.message : String(error),
      };
      this.finishSpan(span);
      throw error;
    }
  }

  /**
   * Get current trace context
   */
  public getCurrentContext(): TraceContext | undefined {
    return this.currentContext;
  }

  /**
   * Extract context from headers
   */
  public extractContext(headers: Record<string, string>): TraceContext | undefined {
    const traceId = headers['x-trace-id'] || headers['uber-trace-id'];
    const spanId = headers['x-span-id'];
    const baggageHeader = headers['x-baggage'];

    if (!traceId) {
      return undefined;
    }

    const baggage: Record<string, string> = {};
    if (baggageHeader && this.options.enableBaggage) {
      baggageHeader.split(',').forEach((pair) => {
        const [key, value] = pair.split('=');
        if (key && value) {
          baggage[key] = decodeURIComponent(value);
        }
      });
    }

    return {
      traceId,
      spanId,
      baggage,
      sampled: true,
    };
  }

  /**
   * Inject context into headers
   */
  public injectContext(context: TraceContext, headers: Record<string, string>): void {
    headers['x-trace-id'] = context.traceId;
    headers['x-span-id'] = context.spanId;

    if (this.options.enableBaggage && Object.keys(context.baggage).length > 0) {
      const baggage = Object.entries(context.baggage)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join(',');
      headers['x-baggage'] = baggage;
    }
  }

  /**
   * Add a log to a span
   */
  public addLog(span: TraceSpan, fields: Record<string, unknown>): void {
    if (!span) {
      return;
    }

    span.logs.push({
      timestamp: Date.now(),
      fields,
    });
  }

  /**
   * Set a tag on a span
   */
  public setTag(span: TraceSpan, key: string, value: string | number | boolean): void {
    if (!span) {
      return;
    }

    span.tags[key] = value;
  }

  /**
   * Get span by ID
   */
  public getSpan(spanId: string): TraceSpan | undefined {
    return this.spans.get(spanId);
  }

  /**
   * Get all spans for a trace
   */
  public getTrace(traceId: string): TraceSpan[] {
    return this.traces.get(traceId) ?? [];
  }

  /**
   * Get all traces
   */
  public getAllTraces(): Map<string, TraceSpan[]> {
    return new Map(this.traces);
  }

  /**
   * Find traces by operation name
   */
  public findTracesByOperation(operationName: RegExp): TraceSpan[] {
    const results: TraceSpan[] = [];

    for (const span of this.spans.values()) {
      if (operationName.test(span.operationName)) {
        results.push(span);
      }
    }

    return results;
  }

  /**
   * Analyze critical path for a trace
   */
  public analyzeCriticalPath(traceId: string): CriticalPath | null {
    const spans = this.traces.get(traceId);
    if (!spans || spans.length === 0) {
      return null;
    }

    // Build span tree
    const spanMap = new Map<string, TraceSpan>();
    const roots: TraceSpan[] = [];

    for (const span of spans) {
      spanMap.set(span.spanId, span);
    }

    for (const span of spans) {
      if (!span.parentSpanId) {
        roots.push(span);
      }
    }

    // Find critical path using dynamic programming
    let criticalPath: TraceSpan[] = [];
    let maxDuration = 0;

    const findCriticalPath = (span: TraceSpan, currentPath: TraceSpan[]): void => {
      const path = [...currentPath, span];
      let pathDuration = span.duration;

      // Find children
      const children = spans.filter((s) => s.parentSpanId === span.spanId);

      if (children.length === 0) {
        // Leaf node
        if (pathDuration > maxDuration) {
          maxDuration = pathDuration;
          criticalPath = path;
        }
      } else {
        // Find child with maximum duration
        let maxChildDuration = 0;
        for (const child of children) {
          maxChildDuration = Math.max(maxChildDuration, child.duration);
        }
        pathDuration += maxChildDuration;

        for (const child of children) {
          findCriticalPath(child, path);
        }
      }
    };

    for (const root of roots) {
      findCriticalPath(root, []);
    }

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(criticalPath);

    const totalDuration = Math.max(...spans.map((s) => s.startTime + s.duration)) -
                         Math.min(...spans.map((s) => s.startTime));

    return {
      traceId,
      path: criticalPath,
      totalDuration,
      criticalDuration: maxDuration,
      bottlenecks,
    };
  }

  /**
   * Identify bottlenecks in a trace
   */
  public identifyBottlenecks(spans: TraceSpan[]): Bottleneck[] {
    if (spans.length === 0) {
      return [];
    }

    const bottlenecks: Bottleneck[] = [];
    const avgDuration = spans.reduce((sum, s) => sum + s.duration, 0) / spans.length;
    const threshold = avgDuration * 1.5;

    for (const span of spans) {
      if (span.duration > threshold) {
        const impact = (span.duration / avgDuration - 1) * 100;

        bottlenecks.push({
          spanId: span.spanId,
          operationName: span.operationName,
          duration: span.duration,
          impact,
          suggestion: this.generateBottleneckSuggestion(span),
        });
      }
    }

    return bottlenecks.sort((a, b) => b.impact - a.impact);
  }

  /**
   * Get span metrics
   */
  public getMetrics(): SpanMetrics[] {
    return Array.from(this.metrics.values()).sort(
      (a, b) => b.totalDuration - a.totalDuration
    );
  }

  /**
   * Get metrics for a specific operation
   */
  public getOperationMetrics(operationName: string): SpanMetrics | undefined {
    return this.metrics.get(operationName);
  }

  /**
   * Get overall statistics
   */
  public getStatistics(): TraceStatistics {
    const totalTraces = this.traces.size;
    const totalSpans = this.spans.size;
    const averageSpansPerTrace = totalTraces > 0 ? totalSpans / totalTraces : 0;

    let totalDuration = 0;
    let errorCount = 0;
    let sampledCount = 0;

    for (const span of this.spans.values()) {
      totalDuration += span.duration;
      if (span.status.code !== 0) {
        errorCount++;
      }
      sampledCount++;
    }

    const averageTraceDuration = totalTraces > 0 ? totalDuration / totalTraces : 0;
    const errorRate = totalSpans > 0 ? (errorCount / totalSpans) * 100 : 0;

    return {
      totalTraces,
      totalSpans,
      averageSpansPerTrace,
      averageTraceDuration,
      operationsCount: this.metrics.size,
      errorRate,
      sampledRate: this.options.samplingRate * 100,
    };
  }

  /**
   * Export traces in various formats
   */
  public exportTraces(format?: string): any {
    const exportFormat = format ?? this.options.exportFormat;

    switch (exportFormat) {
      case 'jaeger':
        return this.exportJaeger();
      case 'zipkin':
        return this.exportZipkin();
      case 'json':
      default:
        return this.exportJSON();
    }
  }

  /**
   * Filter spans by criteria
   */
  public filterSpans(criteria: {
    operationName?: RegExp;
    minDuration?: number;
    maxDuration?: number;
    hasError?: boolean;
    tags?: Record<string, string | number | boolean>;
  }): TraceSpan[] {
    return Array.from(this.spans.values()).filter((span) => {
      if (criteria.operationName && !criteria.operationName.test(span.operationName)) {
        return false;
      }

      if (criteria.minDuration !== undefined && span.duration < criteria.minDuration) {
        return false;
      }

      if (criteria.maxDuration !== undefined && span.duration > criteria.maxDuration) {
        return false;
      }

      if (criteria.hasError && span.status.code === 0) {
        return false;
      }

      if (criteria.tags) {
        for (const [key, value] of Object.entries(criteria.tags)) {
          if (span.tags[key] !== value) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * Clear all traces
   */
  public clearTraces(): void {
    this.spans.clear();
    this.activeSpans.clear();
    this.traces.clear();
    this.metrics.clear();
  }

  /**
   * Reset tracer state
   */
  public reset(): void {
    this.clearTraces();
    this.currentContext = undefined;
  }

  /**
   * Update span metrics
   */
  private updateMetrics(span: TraceSpan): void {
    let metrics = this.metrics.get(span.operationName);

    if (!metrics) {
      metrics = {
        operationName: span.operationName,
        count: 0,
        totalDuration: 0,
        averageDuration: 0,
        minDuration: Infinity,
        maxDuration: -Infinity,
        errorCount: 0,
        errorRate: 0,
      };
      this.metrics.set(span.operationName, metrics);
    }

    metrics.count++;
    metrics.totalDuration += span.duration;
    metrics.averageDuration = metrics.totalDuration / metrics.count;
    metrics.minDuration = Math.min(metrics.minDuration, span.duration);
    metrics.maxDuration = Math.max(metrics.maxDuration, span.duration);

    if (span.status.code !== 0) {
      metrics.errorCount++;
    }

    metrics.errorRate = (metrics.errorCount / metrics.count) * 100;
  }

  /**
   * Generate bottleneck suggestion
   */
  private generateBottleneckSuggestion(span: TraceSpan): string {
    if (span.operationName.includes('database') || span.operationName.includes('db')) {
      return 'Consider adding database indexes or optimizing queries';
    }

    if (span.operationName.includes('http') || span.operationName.includes('api')) {
      return 'Consider implementing caching or request batching';
    }

    if (span.operationName.includes('compute') || span.operationName.includes('process')) {
      return 'Consider parallelizing or optimizing the algorithm';
    }

    return 'Investigate the operation implementation for optimization opportunities';
  }

  /**
   * Export traces as JSON
   */
  private exportJSON(): any {
    return {
      traces: Array.from(this.traces.entries()).map(([traceId, spans]) => ({
        traceId,
        spans: spans.map((span) => ({
          traceId: span.traceId,
          spanId: span.spanId,
          parentSpanId: span.parentSpanId,
          operationName: span.operationName,
          startTime: span.startTime,
          duration: span.duration,
          tags: span.tags,
          logs: span.logs,
          status: span.status,
        })),
      })),
      metrics: Array.from(this.metrics.values()),
      statistics: this.getStatistics(),
    };
  }

  /**
   * Export traces in Jaeger format
   */
  private exportJaeger(): any {
    const processes = new Map<string, any>();
    const spans: any[] = [];

    for (const span of this.spans.values()) {
      const processKey = `service:${span.tags.service || 'unknown'}`;

      if (!processes.has(processKey)) {
        processes.set(processKey, {
          serviceName: span.tags.service || 'unknown',
          tags: Object.entries(span.tags).map(([key, value]) => ({
            key,
            type: typeof value,
            value: String(value),
          })),
        });
      }

      spans.push({
        traceID: span.traceId.replace(/-/g, ''),
        spanID: span.spanId.replace(/-/g, ''),
        parentSpanID: span.parentSpanId?.replace(/-/g, '') || '',
        operationName: span.operationName,
        startTime: span.startTime * 1000, // Convert to microseconds
        duration: span.duration * 1000,
        tags: Object.entries(span.tags).map(([key, value]) => ({
          key,
          type: typeof value,
          value: String(value),
        })),
        logs: span.logs.map((log) => ({
          timestamp: log.timestamp * 1000,
          fields: Object.entries(log.fields).map(([key, value]) => ({
            key,
            value: String(value),
          })),
        })),
      });
    }

    return {
      data: Array.from(processes.values()).map((process) => ({
        process,
        spans: spans.filter((s) =>
          s.tags.some((t: any) => t.key === 'service' && t.value === process.serviceName)
        ),
      })),
    };
  }

  /**
   * Export traces in Zipkin format
   */
  private exportZipkin(): any {
    return Array.from(this.spans.values()).map((span) => ({
      traceId: span.traceId.replace(/-/g, ''),
      id: span.spanId.replace(/-/g, '').substring(0, 16),
      parentId: span.parentSpanId?.replace(/-/g, '').substring(0, 16) || null,
      name: span.operationName,
      timestamp: span.startTime * 1000,
      duration: span.duration * 1000,
      localEndpoint: {
        serviceName: span.tags.service || 'unknown',
      },
      tags: span.tags,
      annotations: span.logs.map((log) => ({
        timestamp: log.timestamp * 1000,
        value: JSON.stringify(log.fields),
      })),
    }));
  }
}

/**
 * Convenience function to create a tracer
 */
export function createTracer(options?: TracerOptions): ExecutionTracer {
  return new ExecutionTracer(options);
}

/**
 * Decorator to automatically trace methods
 */
export function trace(operationName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const tracer = new ExecutionTracer();

    descriptor.value = async function (...args: any[]) {
      const span = tracer.startSpan({
        operationName: operationName || `${target.constructor.name}.${propertyKey}`,
        tags: {
          class: target.constructor.name,
          method: propertyKey,
        },
      });

      try {
        const result = await originalMethod.apply(this, args);
        if (span) tracer.finishSpan(span);
        return result;
      } catch (error) {
        if (span) {
          span.status = {
            code: 1,
            message: error instanceof Error ? error.message : String(error),
          };
          tracer.finishSpan(span);
        }
        throw error;
      }
    };

    return descriptor;
  };
}
