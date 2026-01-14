/**
 * Types for distributed tracing
 */

import { SpanKind, Attributes, SpanStatusCode } from '@opentelemetry/api';

export interface TraceOptions {
  name: string;
  kind?: SpanKind;
  attributes?: Attributes;
  startTime?: number;
  links?: TraceLink[];
}

export interface TraceLink {
  traceId: string;
  spanId: string;
  attributes?: Attributes;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceState?: string;
  sampled: boolean;
}

export interface TraceExportOptions {
  format?: 'json' | 'protobuf' | 'jaeger';
  timeout?: number;
}

export interface ServiceDependency {
  serviceName: string;
  operation: string;
  latency: number;
  success: boolean;
  error?: string;
}
