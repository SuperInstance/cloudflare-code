/**
 * Distributed Tracing System with OpenTelemetry
 * Provides comprehensive tracing capabilities with minimal overhead
 */

import {
  trace,
  context,
  Context,
  Span as OtelSpan,
  SpanStatusCode,
  SpanKind as OtelSpanKind,
  Attributes,
} from '@opentelemetry/api';
import {
  NodeTracerProvider,
  SimpleSpanProcessor,
  BatchSpanProcessor,
  SDKTraceConfig,
} from '@opentelemetry/sdk-trace-node';
import {
  Resource,
  ResourceAttributes,
} from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import * as jaegerExporter from '@opentelemetry/exporter-trace-jaeger';
import * as zipkinExporter from '@opentelemetry/exporter-trace-zipkin';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { v4 as uuidv4 } from 'uuid';
import {
  TraceOptions,
  SpanOptions,
  SpanContext,
  SpanKind,
  SpanLink,
  SamplingStrategy,
  SamplingContext,
  TraceExportResult,
} from '../types';

// ============================================================================
// Sampling Strategies
// ============================================================================

/**
 * Fixed-rate sampling strategy
 */
export class FixedRateSamplingStrategy implements SamplingStrategy {
  constructor(private rate: number) {
    if (rate < 0 || rate > 1) {
      throw new Error('Sampling rate must be between 0 and 1');
    }
  }

  shouldSample(samplingContext: SamplingContext): boolean {
    return Math.random() < this.rate;
  }
}

/**
 * Trace ID-based sampling for consistent sampling
 */
export class TraceIDBasedSamplingStrategy implements SamplingStrategy {
  private sampledTraces = new Set<string>();

  constructor(private rate: number) {
    if (rate < 0 || rate > 1) {
      throw new Error('Sampling rate must be between 0 and 1');
    }
  }

  shouldSample(samplingContext: SamplingContext): boolean {
    const hash = this.hashTraceId(samplingContext.traceId);
    const shouldSample = hash < this.rate;
    
    if (shouldSample) {
      this.sampledTraces.add(samplingContext.traceId);
    }
    
    return shouldSample;
  }

  private hashTraceId(traceId: string): number {
    let hash = 0;
    for (let i = 0; i < traceId.length; i++) {
      const char = traceId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) / 0xffffffff;
  }
}

/**
 * Rule-based sampling strategy
 */
export class RuleBasedSamplingStrategy implements SamplingStrategy {
  constructor(private rules: SamplingRule[]) {}

  shouldSample(samplingContext: SamplingContext): boolean {
    for (const rule of this.rules) {
      if (this.matchesRule(samplingContext, rule)) {
        return rule.sample;
      }
    }
    return false; // Default: don't sample
  }

  private matchesRule(ctx: SamplingContext, rule: SamplingRule): boolean {
    if (rule.spanName && rule.spanName !== ctx.spanName) {
      return false;
    }
    
    if (rule.spanKind && rule.spanKind !== ctx.spanKind) {
      return false;
    }
    
    if (rule.attributes) {
      for (const [key, value] of Object.entries(rule.attributes)) {
        if (ctx.attributes?.[key] !== value) {
          return false;
        }
      }
    }
    
    return true;
  }
}

interface SamplingRule {
  spanName?: string;
  spanKind?: SpanKind;
  attributes?: Record<string, unknown>;
  sample: boolean;
}

// ============================================================================
// Custom Span Implementation
// ============================================================================

/**
 * Enhanced span with additional capabilities
 */
export class Span {
  private readonly span: OtelSpan;
  private readonly startTime: number;
  private attributes: Attributes = {};
  private events: SpanEvent[] = [];
  private links: SpanLink[] = [];
  private ended = false;

  constructor(span: OtelSpan, private options: SpanOptions) {
    this.span = span;
    this.startTime = Date.now();
    
    if (options.attributes) {
      this.setAttributes(options.attributes);
    }
    
    if (options.links) {
      this.links = options.links;
    }
  }

  /**
   * Add an event to the span
   */
  addEvent(name: string, attributes?: Attributes, time?: number): void {
    if (this.ended) {
      return;
    }
    
    this.events.push({
      name,
      attributes: attributes || {},
      timestamp: time || Date.now(),
    });
    
    this.span.addEvent(name, attributes, time);
  }

  /**
   * Set attributes on the span
   */
  setAttributes(attributes: Attributes): void {
    if (this.ended) {
      return;
    }
    
    this.attributes = { ...this.attributes, ...attributes };
    this.span.setAttributes(attributes);
  }

  /**
   * Set a single attribute
   */
  setAttribute(key: string, value: Attributes[string]): void {
    if (this.ended) {
      return;
    }
    
    this.attributes[key] = value;
    this.span.setAttribute(key, value);
  }

  /**
   * Record an exception
   */
  recordException(exception: Error | ErrorInfo, time?: number): void {
    if (this.ended) {
      return;
    }
    
    const errorInfo = exception instanceof Error
      ? {
          name: exception.name,
          message: exception.message,
          stack: exception.stack,
        }
      : exception;
    
    this.span.recordException(exception as Error);
    
    this.addEvent('exception', {
      'exception.type': errorInfo.name,
      'exception.message': errorInfo.message,
      'exception.stacktrace': errorInfo.stack,
    }, time);
  }

  /**
   * Set the span status
   */
  setStatus(code: SpanStatusCode, description?: string): void {
    if (this.ended) {
      return;
    }
    
    this.span.setStatus({ code, description });
  }

  /**
   * Add a link to another span
   */
  addLink(link: SpanLink): void {
    if (this.ended) {
      return;
    }
    
    this.links.push(link);
  }

  /**
   * End the span
   */
  end(endTime?: number): void {
    if (this.ended) {
      return;
    }
    
    this.ended = true;
    const duration = (endTime || Date.now()) - this.startTime;
    
    this.setAttribute('span.duration.ms', duration);
    this.setAttribute('span.events.count', this.events.length);
    this.setAttribute('span.links.count', this.links.length);
    
    this.span.end(endTime);
  }

  /**
   * Get the span context
   */
  getContext(): SpanContext {
    const spanContext = this.span.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceFlags: spanContext.traceFlags,
    };
  }

  /**
   * Check if the span is ended
   */
  isEnded(): boolean {
    return this.ended;
  }

  /**
   * Get span duration
   */
  getDuration(): number {
    return Date.now() - this.startTime;
  }
}

interface SpanEvent {
  name: string;
  attributes: Attributes;
  timestamp: number;
}

interface ErrorInfo {
  name: string;
  message: string;
  stack?: string;
  code?: string;
}

// ============================================================================
// Main Tracer Class
// ============================================================================

/**
 * Distributed tracer with OpenTelemetry integration
 */
export class Tracer {
  private provider: NodeTracerProvider;
  private enabled = true;
  private samplingStrategy: SamplingStrategy;
  private readonly serviceName: string;
  private exportResults: TraceExportResult[] = [];

  constructor(private options: TraceOptions) {
    this.serviceName = options.serviceName;
    this.samplingStrategy = new FixedRateSamplingStrategy(
      options.samplingRate ?? 1.0
    );
    
    this.provider = this.createProvider();
    this.register();
  }

  /**
   * Create a new span
   */
  startSpan(options: SpanOptions): Span {
    if (!this.enabled) {
      return this.createNoopSpan(options);
    }

    const samplingContext: SamplingContext = {
      traceId: context.active()?.traceId || uuidv4(),
      spanName: options.name,
      spanKind: options.kind,
      attributes: options.attributes,
    };

    if (!this.samplingStrategy.shouldSample(samplingContext)) {
      return this.createNoopSpan(options);
    }

    const otelSpan = trace.getTracer(this.serviceName).startSpan(
      options.name,
      {
        kind: this.mapSpanKind(options.kind),
        attributes: options.attributes as Attributes,
        startTime: options.startTime,
        links: options.links?.map(link => ({
          context: {
            traceId: link.context.traceId,
            spanId: link.context.spanId,
          },
          attributes: link.attributes as Attributes,
        })),
      }
    );

    return new Span(otelSpan, options);
  }

  /**
   * Run code within a span context
   */
  async withSpan<T>(
    options: SpanOptions,
    fn: (span: Span) => Promise<T>
  ): Promise<T> {
    const span = this.startSpan(options);
    
    try {
      const result = await fn(span);
      span.setStatus(SpanStatusCode.OK);
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus(SpanStatusCode.ERROR, (error as Error).message);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Run synchronous code within a span context
   */
  withSpanSync<T>(options: SpanOptions, fn: (span: Span) => T): T {
    const span = this.startSpan(options);
    
    try {
      const result = fn(span);
      span.setStatus(SpanStatusCode.OK);
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus(SpanStatusCode.ERROR, (error as Error).message);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Get the current span context
   */
  getCurrentContext(): SpanContext | null {
    const currentSpan = trace.getSpan(context.active());
    if (!currentSpan) {
      return null;
    }
    
    const spanContext = currentSpan.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceFlags: spanContext.traceFlags,
    };
  }

  /**
   * Inject trace context into headers
   */
  injectTraceContext(headers: Record<string, string>): Record<string, string> {
    const currentContext = this.getCurrentContext();
    if (!currentContext) {
      return headers;
    }

    return {
      ...headers,
      'traceparent': `00-${currentContext.traceId}-${currentContext.spanId}-0${currentContext.traceFlags || 0}`,
      'tracestate': '',
    };
  }

  /**
   * Extract trace context from headers
   */
  extractTraceContext(headers: Record<string, string>): SpanContext | null {
    const traceParent = headers['traceparent'];
    if (!traceParent) {
      return null;
    }

    const parts = traceParent.split('-');
    if (parts.length < 4) {
      return null;
    }

    return {
      traceId: parts[1],
      spanId: parts[2],
      traceFlags: parseInt(parts[3], 16),
    };
  }

  /**
   * Set sampling strategy
   */
  setSamplingStrategy(strategy: SamplingStrategy): void {
    this.samplingStrategy = strategy;
  }

  /**
   * Enable or disable tracing
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if tracing is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Force flush all pending spans
   */
  async forceFlush(): Promise<void> {
    await this.provider.forceFlush();
  }

  /**
   * Shutdown the tracer
   */
  async shutdown(): Promise<void> {
    await this.provider.shutdown();
    this.enabled = false;
  }

  /**
   * Get export statistics
   */
  getExportStats(): TraceExportResult[] {
    return [...this.exportResults];
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private createProvider(): NodeTracerProvider {
    const resource = this.createResource();
    const provider = new NodeTracerProvider({
      resource,
      mergeResourceWithAttributes: true,
    });

    const exporter = this.createExporter();
    const processor = options.exporter === 'console'
      ? new SimpleSpanProcessor(exporter)
      : new BatchSpanProcessor(exporter, {
          maxBufferSize: 10000,
          bufferTimeout: 5000,
          maxExportBatchSize: 1000,
        });

    provider.addSpanProcessor(processor);
    return provider;
  }

  private createResource(): Resource {
    const attributes: ResourceAttributes = {
      [SEMRESATTRS_SERVICE_NAME]: this.serviceName,
    };

    if (this.options.serviceVersion) {
      attributes[SEMRESATTRS_SERVICE_VERSION] = this.options.serviceVersion;
    }

    if (this.options.environment) {
      attributes[SEMRESATTRS_DEPLOYMENT_ENVIRONMENT] = this.options.environment;
    }

    if (this.options.attributes) {
      Object.assign(attributes, this.options.attributes);
    }

    return new Resource(attributes);
  }

  private createExporter() {
    switch (this.options.exporter) {
      case 'jaeger':
        return new jaegerExporter.JaegerExporter({
          endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
        });

      case 'zipkin':
        return new zipkinExporter.ZipkinExporter({
          url: process.env.ZIPKIN_URL || 'http://localhost:9411/api/v2/spans',
        });

      case 'honeycomb':
        // Honeycomb uses OTLP exporter
        const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
        return new OTLPTraceExporter({
          url: process.env.HONEYCOMB_ENDPOINT || 'grpc://api.honeycomb.io:443',
          headers: {
            'x-honeycomb-team': process.env.HONEYCOMB_API_KEY || '',
          },
        });

      case 'otlp':
        const { OTLPTraceExporter: OTLPExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
        return new OTLPExporter({
          url: process.env.OTLP_ENDPOINT || 'localhost:4317',
        });

      case 'console':
      default:
        return new ConsoleSpanExporter();
    }
  }

  private register(): void {
    this.provider.register();
  }

  private mapSpanKind(kind?: SpanKind): OtelSpanKind | undefined {
    if (!kind) {
      return undefined;
    }

    switch (kind) {
      case 'internal':
        return OtelSpanKind.INTERNAL;
      case 'server':
        return OtelSpanKind.SERVER;
      case 'client':
        return OtelSpanKind.CLIENT;
      case 'producer':
        return OtelSpanKind.PRODUCER;
      case 'consumer':
        return OtelSpanKind.CONSUMER;
    }
  }

  private createNoopSpan(options: SpanOptions): Span {
    // Create a no-op span that doesn't actually record anything
    const noopTracer = trace.getTracer('noop');
    const noopSpan = noopTracer.startSpan('noop') as OtelSpan;
    
    // Override end method to immediately return
    const originalEnd = noopSpan.end;
    noopSpan.end = () => originalEnd.call(noopSpan);
    
    return new Span(noopSpan, options);
  }
}

// ============================================================================
// Automatic Instrumentation
// ============================================================================

/**
 * Auto-instrumentation for common frameworks
 */
export class AutoInstrumentation {
  private instrumentations: Map<string, unknown> = new Map();

  constructor(private tracer: Tracer) {}

  /**
   * Enable HTTP instrumentation
   */
  enableHTTPInstrumentation(): void {
    if (this.instrumentations.has('http')) {
      return;
    }

    const { HTTPInstrumentation } = require('@opentelemetry/instrumentation-http');
    const httpInstrumentation = new HTTPInstrumentation({
      applyCustomAttributesOnSpan: (span) => {
        const attributes = (span as OtelSpan).attributes;
        // Add custom attributes
        if (attributes) {
          // Customize as needed
        }
      },
    });

    this.instrumentations.set('http', httpInstrumentation);
  }

  /**
   * Enable Express instrumentation
   */
  enableExpressInstrumentation(): void {
    if (this.instrumentations.has('express')) {
      return;
    }

    const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
    const expressInstrumentation = new ExpressInstrumentation();

    this.instrumentations.set('express', expressInstrumentation);
  }

  /**
   * Enable gRPC instrumentation
   */
  enableGRPCInstrumentation(): void {
    if (this.instrumentations.has('grpc')) {
      return;
    }

    const { GrpcInstrumentation } = require('@opentelemetry/instrumentation-grpc');
    const grpcInstrumentation = new GrpcInstrumentation();

    this.instrumentations.set('grpc', grpcInstrumentation);
  }

  /**
   * Disable specific instrumentation
   */
  disableInstrumentation(type: string): void {
    this.instrumentations.delete(type);
  }

  /**
   * Get all active instrumentations
   */
  getActiveInstrumentations(): string[] {
    return Array.from(this.instrumentations.keys());
  }
}

// ============================================================================
// Context Propagation
// ============================================================================

/**
 * Propagate trace context across async boundaries
 */
export class TraceContext {
  private contextMap = new WeakMap<Function, Context>();

  constructor(private tracer: Tracer) {}

  /**
   * Capture current context
   */
  capture(): Context {
    return context.active();
  }

  /**
   * Restore context
   */
  restore(ctx: Context): void {
    context.with(ctx, () => {
      // Context is now active
    });
  }

  /**
   * Run function within context
   */
  async runInContext<T>(ctx: Context, fn: () => Promise<T>): Promise<T> {
    return context.with(ctx, fn);
  }

  /**
   * Bind context to a function
   */
  bindToContext<T extends Function>(fn: T): T {
    return context.bind(context.active(), fn);
  }
}
