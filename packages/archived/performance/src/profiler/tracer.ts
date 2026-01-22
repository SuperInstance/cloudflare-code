/**
 * Distributed Tracing for Performance Monitoring
 *
 * Provides request tracing across service boundaries
 */

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled: boolean;
  baggage?: Record<string, string>;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, string | number | boolean>;
  logs: SpanLog[];
  status: SpanStatus;
}

export interface SpanLog {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  payload?: Record<string, any>;
}

export type SpanStatus = 'ok' | 'error' | 'cancelled' | 'deadline_exceeded' | 'not_found';

export class Tracer {
  private activeSpans = new Map<string, Span>();
  private traceBuffer = new Map<string, Span[]>();
  private maxBufferSize = 10000;

  /**
   * Start a new span
   */
  startSpan(
    operationName: string,
    parentContext?: TraceContext,
    tags?: Record<string, string | number | boolean>
  ): TraceContext {
    const traceId = parentContext?.traceId || this.generateId();
    const spanId = this.generateId();
    const parentSpanId = parentContext?.spanId;

    const span: Span = {
      traceId,
      spanId,
      parentSpanId,
      operationName,
      startTime: Date.now(),
      tags: tags || {},
      logs: [],
      status: 'ok',
    };

    this.activeSpans.set(spanId, span);
    this.addSpanToBuffer(span);

    return {
      traceId,
      spanId,
      parentSpanId,
      sampled: true,
    };
  }

  /**
   * Finish a span
   */
  finishSpan(context: TraceContext, status: SpanStatus = 'ok'): Span | undefined {
    const span = this.activeSpans.get(context.spanId);
    if (!span) {
      return undefined;
    }

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;

    this.activeSpans.delete(context.spanId);

    return span;
  }

  /**
   * Add tags to a span
   */
  addTags(context: TraceContext, tags: Record<string, string | number | boolean>): void {
    const span = this.activeSpans.get(context.spanId);
    if (span) {
      Object.assign(span.tags, tags);
    }
  }

  /**
   * Log to a span
   */
  log(
    context: TraceContext,
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    payload?: Record<string, any>
  ): void {
    const span = this.activeSpans.get(context.spanId);
    if (span) {
      span.logs.push({
        timestamp: Date.now(),
        level,
        message,
        payload,
      });
    }
  }

  /**
   * Get all spans for a trace
   */
  getTrace(traceId: string): Span[] {
    return this.traceBuffer.get(traceId) || [];
  }

  /**
   * Get active span
   */
  getActiveSpan(context: TraceContext): Span | undefined {
    return this.activeSpans.get(context.spanId);
  }

  /**
   * Extract trace context from headers
   */
  extractContext(headers: Record<string, string>): TraceContext | undefined {
    const traceParent = headers['traceparent'] || headers['grpc-trace-bin'];
    if (!traceParent) {
      return undefined;
    }

    // Parse W3C traceparent format: version-traceId-parentId-flags
    const parts = traceParent.split('-');
    if (parts.length >= 3) {
      return {
        traceId: parts[1],
        spanId: parts[2],
        sampled: parts[3]?.includes('01') || true,
      };
    }

    return undefined;
  }

  /**
   * Inject trace context into headers
   */
  injectContext(context: TraceContext): Record<string, string> {
    return {
      traceparent: `00-${context.traceId}-${context.spanId}-01`,
      'x-claudeflare-trace-id': context.traceId,
      'x-claudeflare-span-id': context.spanId,
    };
  }

  /**
   * Add span to buffer
   */
  private addSpanToBuffer(span: Span): void {
    let trace = this.traceBuffer.get(span.traceId);
    if (!trace) {
      trace = [];
      this.traceBuffer.set(span.traceId, trace);
    }
    trace.push(span);

    // Trim buffer if necessary
    if (this.traceBuffer.size > this.maxBufferSize) {
      const firstKey = this.traceBuffer.keys().next().value;
      this.traceBuffer.delete(firstKey);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Clear all traces
   */
  clear(): void {
    this.activeSpans.clear();
    this.traceBuffer.clear();
  }

  /**
   * Export trace to JSON
   */
  exportTrace(traceId: string): string {
    const trace = this.getTrace(traceId);
    return JSON.stringify(trace, null, 2);
  }

  /**
   * Export trace to OpenTelemetry format
   */
  exportTraceOtel(traceId: string): string {
    const trace = this.getTrace(traceId);
    const resourceSpans = {
      resource: {
        attributes: {
          'service.name': 'claudeflare',
        },
      },
      scopeSpans: [
        {
          scope: {
            name: 'claudeflare.performance',
          },
          spans: trace.map((span) => ({
            traceId: span.traceId.replace(/-/g, ''),
            spanId: span.spanId.replace(/-/g, '').substring(0, 16),
            parentSpanId: span.parentSpanId?.replace(/-/g, '').substring(0, 16),
            name: span.operationName,
            startTimeUnixNano: span.startTime * 1000000,
            endTimeUnixNano: (span.endTime || span.startTime) * 1000000,
            status: {
              code: this.statusToOtelCode(span.status),
            },
            attributes: span.tags,
            events: span.logs.map((log) => ({
              timeUnixNano: log.timestamp * 1000000,
              name: log.message,
              attributes: log.payload || {},
            })),
          })),
        },
      ],
    };

    return JSON.stringify(resourceSpans, null, 2);
  }

  /**
   * Convert status to OpenTelemetry code
   */
  private statusToOtelCode(status: SpanStatus): number {
    switch (status) {
      case 'ok':
        return 1; // OK
      case 'error':
        return 2; // ERROR
      case 'cancelled':
        return 1;
      case 'deadline_exceeded':
        return 2;
      case 'not_found':
        return 2;
      default:
        return 2;
    }
  }
}

/**
 * Async context for automatic tracing
 */
export class AsyncTraceContext {
  private static context = new Map<string, any>();
  private static asyncLocalStorage: any;

  static {
    // Try to use AsyncLocalStorage if available (Node.js 14+)
    try {
      const { AsyncLocalStorage } = require('async_hooks');
      this.asyncLocalStorage = new AsyncLocalStorage();
    } catch {
      // Fallback to simple context map
    }
  }

  static run<T>(context: TraceContext, fn: () => T): T {
    if (this.asyncLocalStorage) {
      return this.asyncLocalStorage.run(context, fn);
    } else {
      this.context.set('current', context);
      try {
        return fn();
      } finally {
        this.context.delete('current');
      }
    }
  }

  static get(): TraceContext | undefined {
    if (this.asyncLocalStorage) {
      return this.asyncLocalStorage.getStore();
    } else {
      return this.context.get('current');
    }
  }

  static set(context: TraceContext): void {
    if (!this.asyncLocalStorage) {
      this.context.set('current', context);
    }
  }
}

/**
 * Decorator for automatic function tracing
 */
export function trace(operationName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const name = operationName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const tracer = new Tracer();
      const parentContext = AsyncTraceContext.get();

      const context = tracer.startSpan(name, parentContext, {
        'function.name': propertyKey,
        'function.args': JSON.stringify(args),
      });

      try {
        AsyncTraceContext.set(context);
        const result = await originalMethod.apply(this, args);
        tracer.finishSpan(context, 'ok');
        return result;
      } catch (error) {
        tracer.log(context, 'error', 'Function error', { error: String(error) });
        tracer.finishSpan(context, 'error');
        throw error;
      }
    };

    return descriptor;
  };
}

export default Tracer;
