export interface TraceOptions {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  samplingRate?: number;
  exporter?: TraceExporter;
  attributes?: Record<string, string | number | boolean>;
  resourceAttributes?: ResourceAttributes;
}

export type TraceExporter = 'jaeger' | 'zipkin' | 'honeycomb' | 'otlp' | 'console' | 'cloudflare';

export interface SpanOptions {
  name: string;
  kind?: SpanKind;
  attributes?: Record<string, string | number | boolean | string[]>;
  links?: SpanLink[];
  startTime?: number;
  parentSpan?: SpanContext;
  baggage?: Record<string, string>;
}

export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer';

export interface SpanContext {
  traceId: string;
  spanId: string;
  traceFlags?: number;
  spanName?: string;
  parentId?: string;
}

export interface SpanLink {
  context: SpanContext;
  attributes?: Record<string, string | number | boolean>;
}

export interface SamplingStrategy {
  shouldSample(context: SamplingContext): boolean;
}

export interface SamplingContext {
  traceId: string;
  spanName: string;
  spanKind?: SpanKind;
  attributes?: Record<string, string | number | boolean>;
  parentContext?: SpanContext;
}

export interface TraceExportResult {
  exportedSpans: number;
  failedSpans: number;
  duration: number;
  errors?: Error[];
}

export interface SpanStatus {
  code: SpanStatusCode;
  message?: string;
}

export type SpanStatusCode = 'unset' | 'ok' | 'error' | 'timeout';

export interface ResourceAttributes {
  'service.name': string;
  'service.version'?: string;
  'service.instance.id'?: string;
  'telemetry.sdk.name': string;
  'telemetry.sdk.language': string;
  'telemetry.sdk.version': string;
  'host.name'?: string;
  'host.arch'?: string;
  'os.type'?: string;
  'cloud.account.id'?: string;
  'cloud.region'?: string;
}

export interface Span {
  name: string;
  traceId: string;
  spanId: string;
  parentId?: string;
  startTime: number;
  endTime?: number;
  status: SpanStatus;
  kind: SpanKind;
  attributes: Record<string, string | number | boolean | string[]>;
  links: SpanLink[];
  events: SpanEvent[];
  droppedAttributesCount?: number;
  droppedEventsCount?: number;
  droppedLinksCount?: number;
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes: Record<string, string | number | boolean>;
}

export interface Trace {
  traceId: string;
  spans: Span[];
  startTime: number;
  endTime?: number;
  resourceAttributes: ResourceAttributes;
}

export interface TraceQuery {
  traceId?: string;
  spanName?: string;
  startTime: number;
  endTime: number;
  filters?: TraceFilter[];
  limit?: number;
  orderBy?: TraceOrderBy;
}

export interface TraceFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value: string | number | string[];
}

export type TraceOrderBy = 'startTime' | 'duration' | 'spanCount' | 'field';

export interface TraceResult {
  traces: Trace[];
  total: number;
  hasMore: boolean;
  cursor?: string;
}

export interface SpanMetrics {
  spanCount: number;
  totalDuration: number;
  averageDuration: number;
  p50Duration: number;
  p90Duration: number;
  p95Duration: number;
  p99Duration: number;
  errorRate: number;
}