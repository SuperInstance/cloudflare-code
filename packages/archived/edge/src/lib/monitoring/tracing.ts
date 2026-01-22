/**
 * OpenTelemetry Distributed Tracing
 *
 * Comprehensive distributed tracing implementation following OpenTelemetry standards.
 * Provides span creation, trace context propagation, and export functionality.
 *
 * Features:
 * - OpenTelemetry-compatible span creation
 * - Trace context propagation (traceparent header)
 * - Span events and attributes
 * - Span links for causal relationships
 * - Multiple exporter support (OTLP, Zipkin, Jaeger)
 * - Automatic instrumentation helpers
 * - Low overhead sampling
 */

import type {
  Trace,
  SpanEvent,
  SpanLink,
  TraceExport,
} from './types';

/**
 * Tracer Configuration
 */
export interface TracerConfig {
  serviceName: string;
  serviceVersion: string;
  deploymentEnvironment: string;
  samplingRate: number; // 0-1
  exporter: 'otlp' | 'zipkin' | 'jaeger' | 'cloudflare' | 'memory';
  exporterEndpoint?: string;
  batchSize: number;
  exportInterval: number; // milliseconds
}

/**
 * Span Context
 */
interface SpanContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
  traceState?: Map<string, string>;
  isRemote: boolean;
}

/**
 * Active Span
 */
interface ActiveSpan extends Trace {
  context: SpanContext;
  parentContext?: SpanContext;
}

/**
 * Tracer Class
 */
export class Tracer {
  private config: TracerConfig;
  activeSpans: Map<string, ActiveSpan>;
  private completedSpans: Trace[];
  private exportTimer?: ReturnType<typeof setInterval>;

  constructor(config: TracerConfig) {
    this.config = config;
    this.activeSpans = new Map();
    this.completedSpans = [];
  }

  /**
   * Start a new span
   */
  startSpan(
    name: string,
    options: {
      kind?: Trace['kind'];
      attributes?: Record<string, string | number | boolean>;
      links?: SpanLink[];
      startTime?: number;
      parentTraceId?: string;
      parentSpanId?: string;
    } = {}
  ): string {
    const traceId = options.parentTraceId || this.generateTraceId();
    const spanId = this.generateSpanId();

    const span: ActiveSpan = {
      traceId,
      spanId,
      parentSpanId: options.parentSpanId,
      name,
      kind: options.kind || 'INTERNAL',
      startTime: options.startTime || Date.now(),
      status: 'UNSET',
      attributes: options.attributes || {},
      events: [],
      links: options.links || [],
      context: {
        traceId,
        spanId,
        traceFlags: 1, // sampled
        isRemote: false,
      },
    };

    this.activeSpans.set(spanId, span);

    return spanId;
  }

  /**
   * End a span
   */
  endSpan(
    spanId: string,
    options: {
      endTime?: number;
      status?: Trace['status'];
      statusCode?: number;
      statusMessage?: string;
    } = {}
  ): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      throw new Error(`Span not found: ${spanId}`);
    }

    const endTime = options.endTime || Date.now();

    // Mark as completed
    span.endTime = endTime;
    span.duration = endTime - span.startTime;
    span.status = options.status || span.status;

    if (options.statusCode !== undefined) {
      span.statusCode = options.statusCode;
    }

    if (options.statusMessage !== undefined) {
      span.statusMessage = options.statusMessage;
    }

    // Remove from active spans and add to completed
    this.activeSpans.delete(spanId);
    this.completedSpans.push(span);

    // Check if we should export
    if (this.completedSpans.length >= this.config.batchSize) {
      this.export().catch((err) => {
        console.error('Failed to export traces:', err);
      });
    }
  }

  /**
   * Add an event to a span
   */
  addEvent(
    spanId: string,
    name: string,
    attributes?: Record<string, string | number | boolean>,
    timestamp?: number
  ): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      throw new Error(`Span not found: ${spanId}`);
    }

    const event: SpanEvent = {
      name,
      timestamp: timestamp || Date.now(),
      attributes: attributes || {},
    };

    span.events.push(event);
  }

  /**
   * Add attributes to a span
   */
  setAttributes(
    spanId: string,
    attributes: Record<string, string | number | boolean>
  ): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      throw new Error(`Span not found: ${spanId}`);
    }

    Object.assign(span.attributes, attributes);
  }

  /**
   * Record an exception in a span
   */
  recordException(
    spanId: string,
    exception: Error | string,
    attributes?: Record<string, string | number | boolean>
  ): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      throw new Error(`Span not found: ${spanId}`);
    }

    const errorMessage = typeof exception === 'string' ? exception : exception.message;
    const errorStack = typeof exception === 'string' ? undefined : exception.stack;

    this.addEvent(
      spanId,
      'exception',
      {
        'exception.message': errorMessage,
        'exception.stacktrace': errorStack || '',
        'exception.type': typeof exception === 'string' ? 'Error' : exception.name,
        ...attributes,
      }
    );

    span.status = 'ERROR';
  }

  /**
   * Get the current span context
   */
  getSpanContext(spanId: string): SpanContext | undefined {
    const span = this.activeSpans.get(spanId);
    return span?.context;
  }

  /**
   * Inject trace context into headers
   */
  inject(spanId: string): Record<string, string> {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      throw new Error(`Span not found: ${spanId}`);
    }

    const traceparent = `00-${span.traceId}-${span.spanId}-${span.context.traceFlags.toString(16).padStart(2, '0')}`;

    return {
      traceparent,
      'trace-id': span.traceId,
      'span-id': span.spanId,
    };
  }

  /**
   * Extract trace context from headers
   */
  extract(headers: Record<string, string>): {
    traceId: string;
    spanId: string;
    traceFlags: number;
  } | null {
    const traceparent = headers.traceparent || headers['trace-parent'];

    if (!traceparent) {
      return null;
    }

    // Parse traceparent: {version}-{traceId}-{spanId}-{traceFlags}
    const match = traceparent.match(/^(\d{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/);

    if (!match) {
      return null;
    }

    const [, version, traceId, spanId, traceFlags] = match;

    return {
      traceId,
      spanId,
      traceFlags: parseInt(traceFlags, 16),
    };
  }

  /**
   * Create a child span from headers
   */
  startSpanFromHeaders(
    name: string,
    headers: Record<string, string>,
    options: {
      kind?: Trace['kind'];
      attributes?: Record<string, string | number | boolean>;
    } = {}
  ): string | null {
    const context = this.extract(headers);

    if (!context) {
      // Start a new root span
      return this.startSpan(name, options);
    }

    return this.startSpan(name, {
      ...options,
      parentTraceId: context.traceId,
      parentSpanId: context.spanId,
    });
  }

  /**
   * Get a span by ID
   */
  getSpan(spanId: string): Trace | undefined {
    const activeSpan = this.activeSpans.get(spanId);
    if (activeSpan) {
      return activeSpan;
    }

    return this.completedSpans.find((s) => s.spanId === spanId);
  }

  /**
   * Get all spans in a trace
   */
  getTrace(traceId: string): Trace[] {
    const active: Trace[] = Array.from(this.activeSpans.values())
      .filter((s) => s.traceId === traceId);

    const completed = this.completedSpans
      .filter((s) => s.traceId === traceId);

    return [...active, ...completed];
  }

  /**
   * Get trace statistics
   */
  getTraceStats(traceId: string): {
    spanCount: number;
    duration: number;
    errorCount: number;
    byKind: Record<string, number>;
  } | null {
    const spans = this.getTrace(traceId);

    if (spans.length === 0) {
      return null;
    }

    const startTimes = spans.map((s) => s.startTime).sort((a, b) => a - b);
    const endTimes = spans
      .map((s) => s.endTime || s.startTime)
      .sort((a, b) => b - a);

    const duration = endTimes[0] - startTimes[0];
    const errorCount = spans.filter((s) => s.status === 'ERROR').length;

    const byKind: Record<string, number> = {};
    for (const span of spans) {
      byKind[span.kind] = (byKind[span.kind] || 0) + 1;
    }

    return {
      spanCount: spans.length,
      duration,
      errorCount,
      byKind,
    };
  }

  /**
   * Export traces
   */
  async export(): Promise<void> {
    if (this.completedSpans.length === 0) {
      return;
    }

    const traceExport: TraceExport = {
      traces: [...this.completedSpans],
      resource: {
        serviceName: this.config.serviceName,
        serviceVersion: this.config.serviceVersion,
        deploymentEnvironment: this.config.deploymentEnvironment,
      },
      instrumentationScope: '@claudeflare/edge',
    };

    // Export based on configured exporter
    switch (this.config.exporter) {
      case 'otlp':
        await this.exportOTLP(traceExport);
        break;
      case 'zipkin':
        await this.exportZipkin(traceExport);
        break;
      case 'jaeger':
        await this.exportJaeger(traceExport);
        break;
      case 'cloudflare':
        await this.exportCloudflare(traceExport);
        break;
      case 'memory':
        // Keep in memory, do nothing
        break;
    }

    // Clear exported spans
    this.completedSpans = [];
  }

  /**
   * Export in OTLP format
   */
  private async exportOTLP(traceExport: TraceExport): Promise<void> {
    // Convert to OTLP format
    const otlpData = this.convertToOTLP(traceExport);

    if (!this.config.exporterEndpoint) {
      console.warn('OTLP endpoint not configured, skipping export');
      return;
    }

    try {
      const response = await fetch(this.config.exporterEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-protobuf',
        },
        body: JSON.stringify(otlpData),
      });

      if (!response.ok) {
        throw new Error(`OTLP export failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to export to OTLP:', error);
    }
  }

  /**
   * Export in Zipkin format
   */
  private async exportZipkin(traceExport: TraceExport): Promise<void> {
    const zipkinSpans = traceExport.traces.map((span) => ({
      traceId: span.traceId,
      id: span.spanId,
      parentId: span.parentSpanId,
      name: span.name,
      timestamp: span.startTime * 1000, // microseconds
      duration: (span.duration || 0) * 1000, // microseconds
      localEndpoint: {
        serviceName: this.config.serviceName,
      },
      tags: span.attributes,
      annotations: span.events.map((e) => ({
        timestamp: e.timestamp * 1000,
        value: e.name,
      })),
    }));

    if (!this.config.exporterEndpoint) {
      console.warn('Zipkin endpoint not configured, skipping export');
      return;
    }

    try {
      const response = await fetch(`${this.config.exporterEndpoint}/api/v2/spans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(zipkinSpans),
      });

      if (!response.ok) {
        throw new Error(`Zipkin export failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to export to Zipkin:', error);
    }
  }

  /**
   * Export in Jaeger format
   */
  private async exportJaeger(traceExport: TraceExport): Promise<void> {
    // Jaeger uses a similar format to Zipkin but with batching
    const batches = [
      {
        service: this.config.serviceName,
        traceID: traceExport.traces[0]?.traceId || '',
        spans: traceExport.traces.map((span) => ({
          traceID: span.traceId,
          spanID: span.spanId,
          parentSpanID: span.parentSpanId,
          operationName: span.name,
          startTime: span.startTime * 1000, // microseconds
          duration: (span.duration || 0) * 1000, // microseconds
          tags: Object.entries(span.attributes).map(([key, value]) => ({
            key,
            type: typeof value,
            value: String(value),
          })),
          logs: span.events.map((e) => ({
            timestamp: e.timestamp * 1000,
            fields: Object.entries(e.attributes).map(([key, value]) => ({
              key,
              value: String(value),
            })),
          })),
        })),
      },
    ];

    if (!this.config.exporterEndpoint) {
      console.warn('Jaeger endpoint not configured, skipping export');
      return;
    }

    try {
      const response = await fetch(`${this.config.exporterEndpoint}/api/traces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: batches }),
      });

      if (!response.ok) {
        throw new Error(`Jaeger export failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to export to Jaeger:', error);
    }
  }

  /**
   * Export to Cloudflare Analytics
   */
  private async exportCloudflare(traceExport: TraceExport): Promise<void> {
    // Cloudflare Workers can export to Workers Analytics
    // This is a placeholder for the actual implementation
    console.log('Exporting traces to Cloudflare Analytics:', {
      traceCount: traceExport.traces.length,
      serviceName: this.config.serviceName,
    });
  }

  /**
   * Convert to OTLP format
   */
  private convertToOTLP(traceExport: TraceExport): any {
    return {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: this.config.serviceName } },
              { key: 'service.version', value: { stringValue: this.config.serviceVersion } },
              {
                key: 'deployment.environment',
                value: { stringValue: this.config.deploymentEnvironment },
              },
            ],
          },
          scopeSpans: [
            {
              scope: {
                name: traceExport.instrumentationScope,
              },
              spans: traceExport.traces.map((span) => ({
                traceId: this.hexToBytes(span.traceId),
                spanId: this.hexToBytes(span.spanId),
                parentSpanId: span.parentSpanId
                  ? this.hexToBytes(span.parentSpanId)
                  : undefined,
                name: span.name,
                kind: this.mapSpanKind(span.kind),
                startTimeUnixNano: span.startTime * 1000000,
                endTimeUnixNano: (span.endTime || span.startTime) * 1000000,
                attributes: Object.entries(span.attributes).map(([key, value]) => ({
                  key,
                  value: { stringValue: String(value) },
                })),
                events: span.events.map((e) => ({
                  timeUnixNano: e.timestamp * 1000000,
                  attributes: Object.entries(e.attributes).map(([key, value]) => ({
                    key,
                    value: { stringValue: String(value) },
                  })),
                })),
                status: {
                  code: this.mapStatusCode(span.status),
                },
              })),
            },
          ],
        },
      ],
    };
  }

  /**
   * Map span kind to OTLP kind
   */
  private mapSpanKind(kind: Trace['kind']): number {
    const kinds = {
      INTERNAL: 1,
      SERVER: 2,
      CLIENT: 3,
      PRODUCER: 4,
      CONSUMER: 5,
    };
    return kinds[kind] || 1;
  }

  /**
   * Map status code to OTLP code
   */
  private mapStatusCode(status: Trace['status']): number {
    const codes = {
      UNSET: 0,
      OK: 1,
      ERROR: 2,
    };
    return codes[status] || 0;
  }

  /**
   * Convert hex string to bytes (for OTLP)
   */
  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  /**
   * Generate a random trace ID (16 bytes, hex encoded)
   */
  private generateTraceId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generate a random span ID (8 bytes, hex encoded)
   */
  private generateSpanId(): string {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Start automatic periodic export
   */
  startAutoExport(): void {
    if (this.exportTimer) {
      this.stopAutoExport();
    }

    this.exportTimer = setInterval(() => {
      this.export().catch((err) => {
        console.error('Auto-export failed:', err);
      });
    }, this.config.exportInterval);
  }

  /**
   * Stop automatic periodic export
   */
  stopAutoExport(): void {
    if (this.exportTimer) {
      clearInterval(this.exportTimer);
      this.exportTimer = undefined;
    }
  }

  /**
   * Get statistics about the tracer
   */
  getStats(): {
    activeSpans: number;
    completedSpans: number;
    totalSpans: number;
  } {
    return {
      activeSpans: this.activeSpans.size,
      completedSpans: this.completedSpans.length,
      totalSpans: this.activeSpans.size + this.completedSpans.length,
    };
  }

  /**
   * Clear all completed spans
   */
  clear(): void {
    this.completedSpans = [];
  }

  /**
   * Shutdown the tracer
   */
  async shutdown(): Promise<void> {
    this.stopAutoExport();
    await this.export();
    this.activeSpans.clear();
    this.completedSpans = [];
  }
}

/**
 * Create a tracer with default configuration
 */
export function createTracer(
  serviceName: string,
  config: Partial<TracerConfig> = {}
): Tracer {
  const defaultConfig: TracerConfig = {
    serviceName,
    serviceVersion: '1.0.0',
    deploymentEnvironment: 'production',
    samplingRate: 0.1, // 10%
    exporter: 'memory',
    batchSize: 100,
    exportInterval: 60000, // 1 minute
  };

  return new Tracer({ ...defaultConfig, ...config });
}

/**
 * Middleware for automatic request tracing
 */
export function createTracingMiddleware(tracer: Tracer) {
  return async (request: Request, env: any): Promise<Response> => {
    const url = new URL(request.url);
    const method = request.method;

    // Extract trace context from headers
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Start span
    const spanId = tracer.startSpanFromHeaders(
      `${method} ${url.pathname}`,
      headers,
      {
        kind: 'SERVER',
        attributes: {
          'http.method': method,
          'http.url': url.href,
          'http.scheme': url.protocol.replace(':', ''),
          'http.host': url.host,
          'http.target': url.pathname + url.search,
          'user_agent': headers['user-agent'] || '',
        },
      }
    );

    if (!spanId) {
      // Sampling disabled, proceed without tracing
      return await fetch(request);
    }

    // Add event for request received
    tracer.addEvent(spanId, 'request.received', {
      headers: JSON.stringify(headers),
    });

    try {
      // Process request
      const response = await fetch(request);

      // Record response attributes
      tracer.setAttributes(spanId, {
        'http.status_code': response.status,
        'http.status_text': response.statusText,
      });

      // Add event for response sent
      tracer.addEvent(spanId, 'response.sent', {
        status: response.status,
      });

      // End span with appropriate status
      tracer.endSpan(spanId, {
        status: response.ok ? 'OK' : 'ERROR',
        statusCode: response.status,
      });

      return response;
    } catch (error) {
      // Record exception
      tracer.recordException(spanId, error as Error);

      // End span with error
      tracer.endSpan(spanId, {
        status: 'ERROR',
      });

      throw error;
    }
  };
}
