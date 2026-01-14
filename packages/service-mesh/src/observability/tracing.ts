/**
 * Distributed Tracing Implementation
 * Manages distributed tracing across service mesh
 */

import {
  DistributedTrace,
  TraceSpan,
  TraceLog,
  SpanStatus,
  MeshContext
} from '../types';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  baggage: Map<string, string>;
}

export interface SpanOptions {
  operationName: string;
  serviceName: string;
  tags?: Record<string, string>;
  parentSpanId?: string;
  startTime?: number;
}

export class Tracer {
  private serviceName: string;
  private activeSpans: Map<string, TraceSpan>;
  private completedTraces: Map<string, DistributedTrace>;
  private traceListeners: Set<(trace: DistributedTrace) => void>;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.activeSpans = new Map();
    this.completedTraces = new Map();
    this.traceListeners = new Set();
  }

  /**
   * Start a new span
   */
  startSpan(options: SpanOptions): TraceSpan {
    const spanId = this.generateSpanId();
    const parentSpanId = options.parentSpanId;

    const span: TraceSpan = {
      spanId,
      parentSpanId,
      operationName: options.operationName,
      serviceName: options.serviceName || this.serviceName,
      startTime: options.startTime || Date.now(),
      duration: 0,
      tags: options.tags || {},
      logs: [],
      status: { code: 0 } // OK
    };

    this.activeSpans.set(spanId, span);

    return span;
  }

  /**
   * Finish a span
   */
  finishSpan(spanId: string, status?: SpanStatus): TraceSpan | undefined {
    const span = this.activeSpans.get(spanId);

    if (!span) {
      return undefined;
    }

    span.duration = Date.now() - span.startTime;

    if (status) {
      span.status = status;
    }

    this.activeSpans.delete(spanId);

    return span;
  }

  /**
   * Add a tag to a span
   */
  addTag(spanId: string, key: string, value: string): void {
    const span = this.activeSpans.get(spanId);

    if (span) {
      span.tags[key] = value;
    }
  }

  /**
   * Add tags to a span
   */
  addTags(spanId: string, tags: Record<string, string>): void {
    const span = this.activeSpans.get(spanId);

    if (span) {
      Object.assign(span.tags, tags);
    }
  }

  /**
   * Add a log to a span
   */
  addLog(spanId: string, level: 'debug' | 'info' | 'warn' | 'error', message: string, fields?: Record<string, any>): void {
    const span = this.activeSpans.get(spanId);

    if (span) {
      span.logs.push({
        timestamp: Date.now(),
        level,
        message,
        fields
      });
    }
  }

  /**
   * Set span status
   */
  setStatus(spanId: string, status: SpanStatus): void {
    const span = this.activeSpans.get(spanId);

    if (span) {
      span.status = status;
    }
  }

  /**
   * Record an error in a span
   */
  recordError(spanId: string, error: Error): void {
    const span = this.activeSpans.get(spanId);

    if (span) {
      span.status = {
        code: 2, // INTERNAL
        message: error.message
      };

      span.tags['error'] = 'true';
      span.tags['error.message'] = error.message;
      span.tags['error.type'] = error.name;

      if (error.stack) {
        span.tags['error.stack'] = error.stack;
      }

      span.logs.push({
        timestamp: Date.now(),
        level: 'error',
        message: error.message,
        fields: {
          'error.type': error.name,
          'error.stack': error.stack
        }
      });
    }
  }

  /**
   * Create a child span
   */
  createChildSpan(parentSpanId: string, operationName: string, serviceName?: string): TraceSpan | undefined {
    const parentSpan = this.activeSpans.get(parentSpanId);

    if (!parentSpan) {
      return undefined;
    }

    return this.startSpan({
      operationName,
      serviceName: serviceName || this.serviceName,
      parentSpanId
    });
  }

  /**
   * Start a trace with a root span
   */
  startTrace(operationName: string, tags?: Record<string, string>): TraceContext {
    const traceId = this.generateTraceId();
    const spanId = this.generateSpanId();

    const span: TraceSpan = {
      spanId,
      operationName,
      serviceName: this.serviceName,
      startTime: Date.now(),
      duration: 0,
      tags: tags || {},
      logs: [],
      status: { code: 0 }
    };

    this.activeSpans.set(spanId, span);

    return {
      traceId,
      spanId,
      baggage: new Map()
    };
  }

  /**
   * Finish a trace
   */
  finishTrace(context: TraceContext): DistributedTrace | undefined {
    const rootSpan = this.finishSpan(context.spanId);

    if (!rootSpan) {
      return undefined;
    }

    // Collect all spans in the trace
    const allSpans = this.collectTraceSpans(context.traceId, rootSpan);

    const trace: DistributedTrace = {
      traceId: context.traceId,
      spans: allSpans,
      startTime: rootSpan.startTime,
      endTime: rootSpan.startTime + rootSpan.duration,
      services: Array.from(new Set(allSpans.map(s => s.serviceName)))
    };

    this.completedTraces.set(context.traceId, trace);

    // Notify listeners
    this.notifyTraceListeners(trace);

    return trace;
  }

  /**
   * Get a completed trace
   */
  getTrace(traceId: string): DistributedTrace | undefined {
    return this.completedTraces.get(traceId);
  }

  /**
   * Get all completed traces
   */
  getTraces(): DistributedTrace[] {
    return Array.from(this.completedTraces.values());
  }

  /**
   * Subscribe to trace completion events
   */
  onTraceComplete(listener: (trace: DistributedTrace) => void): () => void {
    this.traceListeners.add(listener);

    return () => {
      this.traceListeners.delete(listener);
    };
  }

  /**
   * Extract trace context from headers
   */
  extractContext(headers: Headers): TraceContext | undefined {
    const traceId = headers.get('x-trace-id');
    const spanId = headers.get('x-span-id');
    const parentSpanId = headers.get('x-parent-span-id');

    if (!traceId || !spanId) {
      return undefined;
    }

    const baggage = new Map<string, string>();

    // Extract baggage headers
    for (const [key, value] of headers.entries()) {
      if (key.startsWith('x-baggage-')) {
        const baggageKey = key.replace('x-baggage-', '');
        baggage.set(baggageKey, value);
      }
    }

    return {
      traceId,
      spanId,
      parentSpanId: parentSpanId || undefined,
      baggage
    };
  }

  /**
   * Inject trace context into headers
   */
  injectContext(headers: Headers, context: TraceContext): void {
    headers.set('x-trace-id', context.traceId);
    headers.set('x-span-id', context.spanId);

    if (context.parentSpanId) {
      headers.set('x-parent-span-id', context.parentSpanId);
    }

    // Inject baggage
    for (const [key, value] of context.baggage) {
      headers.set(`x-baggage-${key}`, value);
    }
  }

  /**
   * Create child context from parent
   */
  createChildContext(parentContext: TraceContext): TraceContext {
    const childSpanId = this.generateSpanId();

    return {
      traceId: parentContext.traceId,
      spanId: childSpanId,
      parentSpanId: parentContext.spanId,
      baggage: new Map(parentContext.baggage)
    };
  }

  /**
   * Clear old traces
   */
  clearOldTraces(maxAge: number = 3600000): void {
    const cutoffTime = Date.now() - maxAge;

    for (const [traceId, trace] of this.completedTraces.entries()) {
      if (trace.endTime < cutoffTime) {
        this.completedTraces.delete(traceId);
      }
    }
  }

  /**
   * Clear all traces
   */
  clearTraces(): void {
    this.completedTraces.clear();
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  private generateSpanId(): string {
    return `span_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private collectTraceSpans(traceId: string, rootSpan: TraceSpan): TraceSpan[] {
    const spans: TraceSpan[] = [rootSpan];

    // Collect child spans
    const children = Array.from(this.activeSpans.values())
      .filter(span => span.parentSpanId === rootSpan.spanId);

    for (const child of children) {
      spans.push(...this.collectTraceSpans(traceId, child));
    }

    return spans;
  }

  private notifyTraceListeners(trace: DistributedTrace): void {
    for (const listener of this.traceListeners) {
      try {
        listener(trace);
      } catch (error) {
        console.error('Error notifying trace listener:', error);
      }
    }
  }
}

// ========================================================================
// Trace Scope Manager
// ========================================================================

export class TraceScope {
  private static currentContext: TraceContext | undefined;

  /**
   * Get current trace context
   */
  static getCurrentContext(): TraceContext | undefined {
    return this.currentContext;
  }

  /**
   * Set current trace context
   */
  static setCurrentContext(context: TraceContext): void {
    this.currentContext = context;
  }

  /**
   * Clear current trace context
   */
  static clearCurrentContext(): void {
    this.currentContext = undefined;
  }

  /**
   * Execute callback with trace context
   */
  static async withContext<T>(
    context: TraceContext,
    callback: () => Promise<T>
  ): Promise<T> {
    const previousContext = this.currentContext;
    this.currentContext = context;

    try {
      return await callback();
    } finally {
      this.currentContext = previousContext;
    }
  }

  /**
   * Execute callback with new child span
   */
  static async withSpan<T>(
    tracer: Tracer,
    operationName: string,
    callback: (span: TraceSpan) => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const context = this.getCurrentContext();

    let span: TraceSpan;

    if (context) {
      span = tracer.createChildSpan(context.spanId, operationName) ||
             tracer.startSpan({ operationName, tags });
    } else {
      span = tracer.startSpan({ operationName, tags });
    }

    try {
      const result = await callback(span);

      tracer.finishSpan(span.spanId, { code: 0 });

      return result;
    } catch (error) {
      if (error instanceof Error) {
        tracer.recordError(span.spanId, error);
      }

      tracer.finishSpan(span.spanId, {
        code: 2,
        message: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }
}

// ========================================================================
// Middleware Integration
// ========================================================================

export function createTracingMiddleware(tracer: Tracer) {
  return async (
    request: Request,
    env: any,
    ctx: ExecutionContext
  ): Promise<Response> => {
    // Extract trace context from incoming request
    const incomingContext = tracer.extractContext(request.headers);

    let traceContext: TraceContext;

    if (incomingContext) {
      // Continue existing trace
      traceContext = tracer.createChildContext(incomingContext);
    } else {
      // Start new trace
      traceContext = tracer.startTrace(
        request.method + ' ' + new URL(request.url).pathname,
        {
          'http.method': request.method,
          'http.url': request.url
        }
      );
    }

    // Set as current context
    TraceScope.setCurrentContext(traceContext);

    try {
      // Process request (will be handled by actual route handler)
      const response = await env.next(request, env, ctx);

      // Add tracing headers to response
      const responseHeaders = new Headers(response.headers);
      tracer.injectContext(responseHeaders, traceContext);

      // Finish the root span
      tracer.finishSpan(traceContext.spanId, {
        code: response.status < 400 ? 0 : 2
      });

      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders
      });

    } catch (error) {
      // Record error in span
      const span = tracer.startSpan({
        operationName: 'error',
        tags: { 'error.type': 'error' }
      });

      if (error instanceof Error) {
        tracer.recordError(span.spanId, error);
      }

      tracer.finishSpan(span.spanId, {
        code: 2,
        message: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;

    } finally {
      // Clear current context
      TraceScope.clearCurrentContext();
    }
  };
}
