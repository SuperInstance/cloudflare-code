/**
 * Trace exporter for various backends
 */

import { SpanMetadata } from '../types';
import { TraceExportOptions } from './types';

export interface TraceExportData {
  traces: SpanMetadata[];
  timestamp: number;
  metadata: {
    format: string;
    version: string;
    source: string;
  };
}

export class TraceExporter {
  constructor(private endpoint?: string) {}

  /**
   * Export traces to JSON format
   */
  exportToJSON(spans: SpanMetadata[]): string {
    return JSON.stringify(
      {
        format: 'json',
        version: '1.0.0',
        timestamp: Date.now(),
        spans: spans.map((span) => this.serializeSpan(span)),
      },
      null,
      2
    );
  }

  /**
   * Export traces to Jaeger format
   */
  exportToJaeger(spans: SpanMetadata[]): string {
    const tracesByTraceId = new Map<string, SpanMetadata[]>();

    for (const span of spans) {
      const traceId = span.attributes['trace.id'] as string;
      if (!tracesByTraceId.has(traceId)) {
        tracesByTraceId.set(traceId, []);
      }
      tracesByTraceId.get(traceId)!.push(span);
    }

    const jaegerData = {
      data: Array.from(tracesByTraceId.entries()).map(([traceId, spans]) => ({
        traceID: traceId,
        spans: spans.map((span) => ({
          traceID: traceId,
          spanID: span.attributes['span.id'] as string,
          operationName: span.name,
          startTime: span.startTime,
          duration: span.duration || 0,
          tags: Object.entries(span.attributes).map(([key, value]) => ({
            key,
            type: typeof value,
            value: String(value),
          })),
          logs: span.events.map((event) => ({
            timestamp: event.timestamp,
            fields: Object.entries(event.attributes).map(([key, value]) => ({
              key,
              value: String(value),
            })),
          })),
          references: span.attributes['parent.span.id']
            ? [
                {
                  refType: 'CHILD_OF',
                  traceID: traceId,
                  spanID: span.attributes['parent.span.id'] as string,
                },
              ]
            : [],
        })),
      })),
    };

    return JSON.stringify(jaegerData, null, 2);
  }

  /**
   * Export traces to OTLP format (protobuf-like JSON representation)
   */
  exportToOTLP(spans: SpanMetadata[]): string {
    const resourceSpans = {
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'claudeflare' } },
        ],
      },
      scopeSpans: [
        {
          scope: {
            name: 'claudeflare-observability',
            version: '1.0.0',
          },
          spans: spans.map((span) => ({
            traceId: this.stringToBase64(span.attributes['trace.id'] as string),
            spanId: this.stringToBase64(span.attributes['span.id'] as string),
            parentSpanId: span.attributes['parent.span.id']
              ? this.stringToBase64(span.attributes['parent.span.id'] as string)
              : undefined,
            name: span.name,
            kind: this.mapSpanKind(span.kind),
            startTimeUnixNano: span.startTime * 1_000_000,
            endTimeUnixNano: (span.startTime + (span.duration || 0)) * 1_000_000,
            attributes: Object.entries(span.attributes).map(([key, value]) => ({
              key,
              value: { stringValue: String(value) },
            })),
            events: span.events.map((event) => ({
              name: event.name,
              timeUnixNano: event.timestamp * 1_000_000,
              attributes: Object.entries(event.attributes).map(([key, value]) => ({
                key,
                value: { stringValue: String(value) },
              })),
            })),
            links: span.links.map((link) => ({
              traceId: this.stringToBase64(link.context.traceId),
              spanId: this.stringToBase64(link.context.spanId),
              attributes: Object.entries(link.attributes).map(([key, value]) => ({
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
    };

    return JSON.stringify(resourceSpans, null, 2);
  }

  /**
   * Send traces to remote endpoint
   */
  async sendToEndpoint(
    data: string,
    format: 'json' | 'jaeger' | 'otlp',
    options: TraceExportOptions = {}
  ): Promise<boolean> {
    if (!this.endpoint) {
      throw new Error('No endpoint configured');
    }

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Trace-Format': format,
        },
        body: data,
        signal: options.timeout
          ? AbortSignal.timeout(options.timeout)
          : undefined,
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to send traces:', error);
      return false;
    }
  }

  /**
   * Serialize span for export
   */
  private serializeSpan(span: SpanMetadata): any {
    return {
      traceId: span.attributes['trace.id'],
      spanId: span.attributes['span.id'],
      parentSpanId: span.attributes['parent.span.id'],
      name: span.name,
      kind: span.kind,
      startTime: span.startTime,
      endTime: span.endTime,
      duration: span.duration,
      status: span.status,
      attributes: span.attributes,
      events: span.events,
      links: span.links,
    };
  }

  /**
   * Convert string to base64
   */
  private stringToBase64(str: string): string {
    return Buffer.from(str).toString('base64');
  }

  /**
   * Map span kind to OTLP format
   */
  private mapSpanKind(kind: number): number {
    const kinds: Record<number, number> = {
      0: 0, // INTERNAL
      1: 1, // SERVER
      2: 2, // CLIENT
      3: 3, // PRODUCER
      4: 4, // CONSUMER
    };
    return kinds[kind] || 0;
  }

  /**
   * Map status code to OTLP format
   */
  private mapStatusCode(code: number): number {
    const codes: Record<number, number> = {
      0: 0, // UNSET
      1: 1, // OK
      2: 2, // ERROR
    };
    return codes[code] || 0;
  }
}
