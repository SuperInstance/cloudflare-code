/**
 * Trace Collector - High-performance span ingestion and processing
 * Handles span collection, validation, enrichment, buffering, and transmission
 */

import { EventEmitter } from 'eventemitter3';
import PQueue from 'p-queue';
import { v4 as uuidv4 } from 'uuid';

import {
  Span,
  CollectionOptions,
  BufferEntry,
  BufferStats,
  CollectionStats,
  ValidationResult,
  SpanEnrichment,
} from '../types/trace.types';
import { validateSpan } from '../utils/validation.utils';
import { getCurrentTimestamp } from '../utils/time.utils';

/**
 * Default collection options
 */
const DEFAULT_OPTIONS: Required<CollectionOptions> = {
  endpoint: '',
  apiKey: '',
  batchSize: 1000,
  flushInterval: 5000,
  maxBufferSize: 10000,
  compression: true,
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
};

/**
 * Trace Collector class
 */
export class TraceCollector extends EventEmitter {
  private options: Required<CollectionOptions>;
  private buffer: Map<string, BufferEntry[]>;
  private processingQueue: PQueue;
  private stats: CollectionStats;
  private flushTimer?: NodeJS.Timeout;
  private isShuttingDown: boolean;

  constructor(options: CollectionOptions = {}) {
    super();

    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.buffer = new Map();
    this.processingQueue = new PQueue({
      concurrency: this.options.batchSize,
      autoStart: true,
    });
    this.isShuttingDown = false;

    this.stats = {
      spansCollected: 0,
      spansProcessed: 0,
      spansDropped: 0,
      tracesCompleted: 0,
      avgProcessingTime: 0,
      bytesProcessed: 0,
    };

    this.startFlushTimer();
  }

  /**
   * Collect a single span
   */
  async collect(span: Span): Promise<ValidationResult> {
    if (this.isShuttingDown) {
      throw new Error('Collector is shutting down');
    }

    const startTime = Date.now();

    // Validate the span
    const validation = validateSpan(span);
    if (!validation.valid) {
      this.stats.spansDropped++;
      this.emit('span:rejected', { span, errors: validation.errors });
      return validation;
    }

    // Enrich the span
    const enriched = await this.enrichSpan(span);

    // Add to buffer
    this.addToBuffer(enriched);

    this.stats.spansCollected++;
    this.stats.spansProcessed++;
    const processingTime = Date.now() - startTime;
    this.updateAvgProcessingTime(processingTime);

    this.emit('span:collected', enriched);

    // Check if we should flush
    if (this.shouldFlush()) {
      this.flush().catch((err) => this.emit('error', err));
    }

    return validation;
  }

  /**
   * Collect multiple spans in batch
   */
  async collectBatch(spans: Span[]): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (const span of spans) {
      const result = await this.collect(span);
      results.push(result);
    }

    return results;
  }

  /**
   * Enrich a span with additional metadata
   */
  private async enrichSpan(span: Span): Promise<Span> {
    const enriched = { ...span };

    // Add collection metadata
    enriched.extensions = {
      ...enriched.extensions,
      collectedAt: getCurrentTimestamp(),
      collectorId: this.getCollectorId(),
      collectionAttempt: 1,
    };

    // Add geoip if available (placeholder for actual implementation)
    // if (span.attributes?.['client.address']) {
    //   enriched.extensions.geoip = await this.lookupGeoIP(span.attributes['client.address']);
    // }

    return enriched;
  }

  /**
   * Add span to buffer
   */
  private addToBuffer(span: Span): void {
    const traceId = span.traceId;
    const entry: BufferEntry = {
      span,
      timestamp: getCurrentTimestamp(),
      size: this.calculateSpanSize(span),
      retryCount: 0,
    };

    if (!this.buffer.has(traceId)) {
      this.buffer.set(traceId, []);
    }

    const traceBuffer = this.buffer.get(traceId)!;
    traceBuffer.push(entry);

    // Check buffer size
    const totalSize = this.getTotalBufferSize();
    if (totalSize > this.options.maxBufferSize) {
      this.evictOldSpans();
    }
  }

  /**
   * Flush buffered spans
   */
  async flush(): Promise<void> {
    if (this.buffer.size === 0) {
      return;
    }

    // Get all entries from buffer
    const allEntries: Array<{ traceId: string; entry: BufferEntry }> = [];
    for (const [traceId, entries] of this.buffer.entries()) {
      for (const entry of entries) {
        allEntries.push({ traceId, entry });
      }
    }

    // Clear buffer
    this.buffer.clear();

    // Process in batches
    const batches = this.createBatches(allEntries);

    for (const batch of batches) {
      await this.processBatch(batch);
    }

    this.emit('flush:completed', { spansProcessed: allEntries.length });
  }

  /**
   * Process a batch of spans
   */
  private async processBatch(
    batch: Array<{ traceId: string; entry: BufferEntry }>
  ): Promise<void> {
    const spans = batch.map((b) => b.entry.span);

    try {
      await this.transmitSpans(spans);
      this.stats.tracesCompleted += new Set(batch.map((b) => b.traceId)).size;
      this.emit('batch:transmitted', { count: spans.length });
    } catch (error) {
      await this.handleTransmitError(batch, error);
    }
  }

  /**
   * Transmit spans to endpoint
   */
  private async transmitSpans(spans: Span[]): Promise<void> {
    if (!this.options.endpoint) {
      // No endpoint configured, just emit event
      this.emit('spans:transmitted', spans);
      return;
    }

    const payload = this.serializeSpans(spans);
    this.stats.bytesProcessed += payload.length;

    // Simulate HTTP request (replace with actual implementation)
    // const response = await fetch(this.options.endpoint, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'X-API-Key': this.options.apiKey,
    //   },
    //   body: payload,
    //   signal: AbortSignal.timeout(this.options.timeout),
    // });

    // if (!response.ok) {
    //   throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    // }

    // For now, just emit the event
    this.emit('spans:transmitted', spans);
  }

  /**
   * Handle transmission error with retry logic
   */
  private async handleTransmitError(
    batch: Array<{ traceId: string; entry: BufferEntry }>,
    error: unknown
  ): Promise<void> {
    this.emit('transmit:error', { error, count: batch.length });

    // Retry logic
    for (const item of batch) {
      if (item.entry.retryCount < this.options.retryAttempts) {
        item.entry.retryCount++;
        this.addToBuffer(item.entry.span);
      } else {
        this.stats.spansDropped++;
        this.emit('span:dropped', { span: item.entry.span, error });
      }
    }
  }

  /**
   * Create batches from entries
   */
  private createBatches(
    entries: Array<{ traceId: string; entry: BufferEntry }>
  ): Array<Array<{ traceId: string; entry: BufferEntry }>> {
    const batches: Array<Array<{ traceId: string; entry: BufferEntry }>> = [];
    const batchSize = this.options.batchSize;

    for (let i = 0; i < entries.length; i += batchSize) {
      batches.push(entries.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Serialize spans for transmission
   */
  private serializeSpans(spans: Span[]): string {
    const data = {
      resourceSpans: [
        {
          resource: {
            attributes: spans[0]?.resource || {},
          },
          scopeSpans: [
            {
              scope: {
                name: 'claudeflare-distributed-tracing',
                version: '1.0.0',
              },
              spans: spans.map((span) => this.spanToProtobuf(span)),
            },
          ],
        },
      ],
    };

    return JSON.stringify(data);
  }

  /**
   * Convert span to protobuf-like format
   */
  private spanToProtobuf(span: Span): Record<string, unknown> {
    return {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      traceState: span.traceState,
      name: span.name,
      kind: span.kind,
      startTimeUnixNano: span.startTime * 1000,
      endTimeUnixNano: span.endTime ? span.endTime * 1000 : undefined,
      attributes: span.attributes,
      events: span.events?.map((e) => ({
        name: e.name,
        timeUnixNano: e.timestamp * 1000,
        attributes: e.attributes,
      })),
      links: span.links?.map((l) => ({
        traceId: l.traceId,
        spanId: l.spanId,
        attributes: l.attributes,
      })),
      status: span.status,
    };
  }

  /**
   * Check if buffer should be flushed
   */
  private shouldFlush(): boolean {
    const totalEntries = Array.from(this.buffer.values()).reduce(
      (sum, entries) => sum + entries.length,
      0
    );
    return totalEntries >= this.options.batchSize;
  }

  /**
   * Get total buffer size
   */
  private getTotalBufferSize(): number {
    return Array.from(this.buffer.values()).reduce((sum, entries) => {
      return sum + entries.reduce((s, e) => s + e.size, 0);
    }, 0);
  }

  /**
   * Evict old spans when buffer is full
   */
  private evictOldSpans(): void {
    const entries = Array.from(this.buffer.entries()).sort((a, b) => {
      const aTime = Math.min(...a[1].map((e) => e.timestamp));
      const bTime = Math.min(...b[1].map((e) => e.timestamp));
      return aTime - bTime;
    });

    // Remove oldest 10% of traces
    const toRemove = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      const [traceId, traceEntries] = entries[i];
      this.stats.spansDropped += traceEntries.length;
      this.buffer.delete(traceId);
      this.emit('trace:evicted', { traceId, count: traceEntries.length });
    }
  }

  /**
   * Calculate span size in bytes
   */
  private calculateSpanSize(span: Span): number {
    return JSON.stringify(span).length * 2; // Rough estimate
  }

  /**
   * Update average processing time
   */
  private updateAvgProcessingTime(time: number): void {
    const count = this.stats.spansProcessed;
    this.stats.avgProcessingTime =
      (this.stats.avgProcessingTime * (count - 1) + time) / count;
  }

  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => this.emit('error', err));
    }, this.options.flushInterval);
  }

  /**
   * Get collector ID
   */
  private getCollectorId(): string {
    // Generate a stable ID for this collector instance
    if (!this.extensions?.instanceId) {
      this.extensions = { instanceId: uuidv4() };
    }
    return this.extensions.instanceId as string;
  }

  private extensions?: { instanceId: string };

  /**
   * Get buffer statistics
   */
  getBufferStats(): BufferStats {
    const currentSize = this.getTotalBufferSize();
    const totalEntries = Array.from(this.buffer.values()).reduce(
      (sum, entries) => sum + entries.length,
      0
    );

    return {
      currentSize,
      maxSize: this.options.maxBufferSize,
      utilization: currentSize / this.options.maxBufferSize,
      droppedSpans: this.stats.spansDropped,
      flushCount: this.stats.tracesCompleted,
    };
  }

  /**
   * Get collection statistics
   */
  getStats(): CollectionStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      spansCollected: 0,
      spansProcessed: 0,
      spansDropped: 0,
      tracesCompleted: 0,
      avgProcessingTime: 0,
      bytesProcessed: 0,
    };
  }

  /**
   * Gracefully shutdown the collector
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Stop flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Wait for queue to finish
    await this.processingQueue.onIdle();

    // Final flush
    await this.flush();

    this.emit('shutdown:completed');
  }

  /**
   * Force immediate flush
   */
  async forceFlush(): Promise<void> {
    await this.flush();
  }

  /**
   * Get pending span count
   */
  getPendingCount(): number {
    return Array.from(this.buffer.values()).reduce(
      (sum, entries) => sum + entries.length,
      0
    );
  }

  /**
   * Check if collector is empty
   */
  isEmpty(): boolean {
    return this.buffer.size === 0;
  }
}

export default TraceCollector;
