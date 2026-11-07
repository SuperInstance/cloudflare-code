import { Observable, ObservableConfig } from '../core/Observable';
import {
  TraceOptions,
  SpanOptions,
  SpanContext,
  SpanLink,
  SamplingStrategy,
  TraceExportResult
} from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Distributed Tracer with OpenTelemetry integration
 */
export class Tracer extends Observable {
  private config: TraceOptions;
  private activeSpans: Map<string, Span> = new Map();
  private completedSpans: Map<string, Span> = new Map();
  private samplingStrategy: SamplingStrategy | null = null;
  private otelInitialized = false;

  constructor(config: TraceOptions = {}) {
    super();
    this.config = {
      serviceName: 'unknown',
      serviceVersion: '1.0.0',
      environment: 'development',
      samplingRate: 1.0,
      ...config
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize OpenTelemetry
      await this.initializeOpenTelemetry();

      // Set up sampling strategy
      if (this.config.samplingRate && this.config.samplingRate < 1) {
        this.samplingStrategy = new RateLimitingSamplingStrategy(this.config.samplingRate);
      } else {
        this.samplingStrategy = new AlwaysSamplingStrategy();
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Tracer:', error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (!this.initialized) return;

    // Export any remaining spans
    await this.exportSpans();

    this.activeSpans.clear();
    this.completedSpans.clear();
    this.initialized = false;
  }

  async export(): Promise<TraceExportResult> {
    this.ensureInitialized();

    try {
      const result = await this.exportSpans();
      return result;
    } catch (error) {
      console.error('Failed to export traces:', error);
      return {
        exportedSpans: 0,
        failedSpans: this.completedSpans.size,
        duration: 0
      };
    }
  }

  /**
   * Start a new span
   */
  startSpan(options: SpanOptions): Span {
    this.ensureInitialized();

    // Check sampling
    if (this.samplingStrategy && !this.shouldSample(options.name, options.kind)) {
      return new NoopSpan();
    }

    // Generate context
    const context = {
      traceId: this.generateTraceId(),
      spanId: this.generateSpanId(),
      traceFlags: 0x01 // Sampled flag
    };

    // Create span
    const span = new Span({
      ...options,
      context,
      tracer: this
    });

    this.activeSpans.set(context.spanId, span);

    return span;
  }

  /**
   * Get an active span by span ID
   */
  getActiveSpan(spanId: string): Span | null {
    return this.activeSpans.get(spanId) || null;
  }

  /**
   * Complete all active spans
   */
  completeAllActiveSpans(): void {
    const activeSpans = Array.from(this.activeSpans.values());
    activeSpans.forEach(span => {
      if (!span.isComplete()) {
        span.end();
      }
    });
  }

  /**
   * Get sampling decision
   */
  shouldSample(spanName: string, spanKind?: string): boolean {
    if (!this.samplingStrategy) {
      return true;
    }

    const samplingContext: any = {
      traceId: uuidv4(),
      spanName,
      spanKind
    };

    return this.samplingStrategy.shouldSample(samplingContext);
  }

  /**
   * Get completed span by ID
   */
  getCompletedSpan(spanId: string): Span | null {
    return this.completedSpans.get(spanId) || null;
  }

  /**
   * Get all active spans
   */
  getActiveSpans(): Span[] {
    return Array.from(this.activeSpans.values());
  }

  /**
   * Get all completed spans
   */
  getCompletedSpans(): Span[] {
    return Array.from(this.completedSpans.values());
  }

  /**
   * Generate trace ID
   */
  private generateTraceId(): string {
    return uuidv4().replace(/-/g, '');
  }

  /**
   * Generate span ID
   */
  private generateSpanId(): string {
    return uuidv4().replace(/-/g, '');
  }

  /**
   * Initialize OpenTelemetry
   */
  private async initializeOpenTelemetry(): Promise<void> {
    try {
      // Placeholder for OpenTelemetry initialization
      console.log('Initializing OpenTelemetry Trace SDK...');
      this.otelInitialized = true;
    } catch (error) {
      console.warn('OpenTelemetry initialization failed:', error);
    }
  }

  /**
   * Export spans
   */
  private async exportSpans(): Promise<TraceExportResult> {
    if (this.completedSpans.size === 0) {
      return {
        exportedSpans: 0,
        failedSpans: 0,
        duration: 0
      };
    }

    const spansToExport = Array.from(this.completedSpans.values());
    this.completedSpans.clear();

    try {
      if (this.otelInitialized) {
        await this.exportToOpenTelemetry(spansToExport);
      }

      return {
        exportedSpans: spansToExport.length,
        failedSpans: 0,
        duration: Date.now()
      };
    } catch (error) {
      // Re-store spans if export fails
      spansToExport.forEach(span => {
        this.completedSpans.set(span.context.spanId, span);
      });

      throw error;
    }
  }

  /**
   * Export traces to OpenTelemetry
   */
  private async exportToOpenTelemetry(spans: Span[]): Promise<void> {
    // Placeholder for OpenTelemetry export logic
    console.log(`Exporting ${spans.length} traces to OpenTelemetry...`);
  }
}

/**
 * Span class representing a single operation in a trace
 */
export class Span {
  private options: SpanOptions & {
    context: SpanContext;
    tracer: Tracer;
  };
  private startTime: number;
  private endTime?: number;
  private attributes: Record<string, any> = {};
  private events: any[] = [];
  private status?: 'pending' | 'completed' | 'error';

  constructor(options: SpanOptions & {
    context: SpanContext;
    tracer: Tracer;
  }) {
    this.options = options;
    this.startTime = Date.now();
    this.attributes = { ...options.attributes };
  }

  /**
   * Set span attributes
   */
  setAttributes(attributes: Record<string, any>): void {
    this.attributes = { ...this.attributes, ...attributes };
  }

  /**
   * Add an event to the span
   */
  addEvent(name: string, attributes?: Record<string, any>): void {
    this.events.push({
      name,
      attributes,
      timestamp: Date.now()
    });
  }

  /**
   * Update the current time
   */
  updateTimestamp(): void {
    this.startTime = Date.now();
  }

  /**
   * End the span
   */
  end(): void {
    if (this.endTime) return;

    this.endTime = Date.now();
    this.status = 'completed';

    // Add to completed spans
    if (this.options.tracer) {
      this.options.tracer['completedSpans'].set(this.options.context.spanId, this);
    }
  }

  /**
   * Record an error
   */
  recordError(error: Error): void {
    this.addEvent('error', {
      error: error.message,
      stack: error.stack,
      type: error.name
    });

    this.status = 'error';
    this.end();
  }

  /**
   * Get span duration
   */
  getDuration(): number {
    if (!this.endTime) return Date.now() - this.startTime;
    return this.endTime - this.startTime;
  }

  /**
   * Check if span is complete
   */
  isComplete(): boolean {
    return this.endTime !== undefined;
  }

  /**
   * Get span context
   */
  getContext(): SpanContext {
    return this.options.context;
  }

  /**
   * Get span attributes
   */
  getAttributes(): Record<string, any> {
    return { ...this.attributes };
  }

  /**
   * Get span events
   */
  getEvents(): any[] {
    return [...this.events];
  }

  /**
   * Get span status
   */
  getStatus(): string | undefined {
    return this.status;
  }

  /**
   * Create a child span
   */
  startChildSpan(name: string, kind?: string): Span {
    return this.options.tracer.startSpan({
      name,
      kind,
      parentSpan: this.options.context
    });
  }

  /**
   * Convert to trace context for propagation
   */
  toTraceContext(): string {
    return `${this.options.context.traceId}-${this.options.context.spanId}`;
  }
}

/**
 * No-op span for non-sampled traces
 */
export class NoopSpan extends Span {
  constructor() {
    super({
      name: 'noop',
      context: {
        traceId: '00000000000000000000000000000000',
        spanId: '0000000000000000'
      },
      tracer: null as any
    });
  }

  end(): void {}
  recordError(error: Error): void {}
  addEvent(name: string, attributes?: Record<string, any>): void {}
  setAttributes(attributes: Record<string, any>): void {}
  updateTimestamp(): void {}
}

/**
 * Always sample all spans
 */
export class AlwaysSamplingStrategy implements SamplingStrategy {
  shouldSample(): boolean {
    return true;
  }
}

/**
 * Sample spans based on rate limiting
 */
export class RateLimitingSamplingStrategy implements SamplingStrategy {
  private sampleRate: number;
  private lastSampleTime: number = 0;
  private sampleCount: number = 0;
  private maxSamples: number;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.maxSamples = Math.floor(sampleRate * 1000); // Sample per 1000 spans
  }

  shouldSample(): boolean {
    const now = Date.now();
    if (now - this.lastSampleTime > 1000) {
      this.lastSampleTime = now;
      this.sampleCount = 0;
      return true;
    }

    this.sampleCount++;
    return this.sampleCount <= this.maxSamples;
  }
}

/**
 * Probabilistic sampling strategy
 */
export class ProbabilisticSamplingStrategy implements SamplingStrategy {
  private sampleRate: number;

  constructor(sampleRate: number) {
    this.sampleRate = Math.min(1, Math.max(0, sampleRate));
  }

  shouldSample(): boolean {
    return Math.random() < this.sampleRate;
  }
}