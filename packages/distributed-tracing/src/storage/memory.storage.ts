/**
 * In-memory storage implementation for distributed tracing
 * Useful for testing and development
 */

import {
  TraceStorage,
  StorageConfig,
  StorageStats,
  QueryOptions,
  BatchResult,
  StorageIndex,
} from '../types/storage.types';
import { Trace, TraceId, Span, SpanId } from '../types/trace.types';

/**
 * In-memory storage implementation
 */
export class MemoryStorage implements TraceStorage {
  private traces: Map<TraceId, Trace>;
  private spans: Map<SpanId, Span>;
  private traceToSpans: Map<TraceId, Set<SpanId>>;
  private serviceToTraces: Map<string, Set<TraceId>>;
  private indexes: Map<string, StorageIndex>;
  private stats: StorageStats;

  constructor(_config?: Partial<StorageConfig>) {
    this.traces = new Map();
    this.spans = new Map();
    this.traceToSpans = new Map();
    this.serviceToTraces = new Map();
    this.indexes = new Map();

    this.stats = {
      totalTraces: 0,
      totalSpans: 0,
      storageSize: 0,
      indexSize: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgReadTime: 0,
      avgWriteTime: 0,
    };
  }

  async getTrace(traceId: TraceId): Promise<Trace | null> {
    const startTime = Date.now();
    const trace = this.traces.get(traceId) || null;
    const readTime = Date.now() - startTime;

    this.updateAvgReadTime(readTime);
    if (trace) {
      this.stats.cacheHits++;
    } else {
      this.stats.cacheMisses++;
    }

    return trace;
  }

  async putTrace(traceId: TraceId, trace: Trace): Promise<void> {
    const startTime = Date.now();

    this.traces.set(traceId, trace);
    this.stats.totalTraces++;

    // Update service index
    const services = new Set(trace.spans.map((s) => s.service));
    for (const service of services) {
      if (!this.serviceToTraces.has(service)) {
        this.serviceToTraces.set(service, new Set());
      }
      this.serviceToTraces.get(service)!.add(traceId);
    }

    const writeTime = Date.now() - startTime;
    this.updateAvgWriteTime(writeTime);
    this.stats.storageSize += JSON.stringify(trace).length;
  }

  async deleteTrace(traceId: TraceId): Promise<void> {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    // Remove from service index
    const services = new Set(trace.spans.map((s) => s.service));
    for (const service of services) {
      const traces = this.serviceToTraces.get(service);
      if (traces) {
        traces.delete(traceId);
      }
    }

    // Remove spans
    const spanIds = this.traceToSpans.get(traceId);
    if (spanIds) {
      for (const spanId of spanIds) {
        this.spans.delete(spanId);
        this.stats.totalSpans--;
      }
      this.traceToSpans.delete(traceId);
    }

    this.traces.delete(traceId);
    this.stats.totalTraces--;
  }

  async listTraces(options?: QueryOptions): Promise<Trace[]> {
    const traces = Array.from(this.traces.values());

    if (!options) {
      return traces;
    }

    let result = traces;

    // Apply filter
    if (options.filter) {
      result = result.filter((trace) => {
        return Object.entries(options.filter!).every(([key, value]) => {
          // Simple filter implementation - can be enhanced
          return (trace as any)[key] === value;
        });
      });
    }

    // Apply sorting
    if (options.orderBy) {
      result.sort((a, b) => {
        const aVal = (a as any)[options.orderBy!];
        const bVal = (b as any)[options.orderBy!];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return options.orderDirection === 'desc' ? -comparison : comparison;
      });
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || result.length;
    result = result.slice(offset, offset + limit);

    return result;
  }

  async getSpan(spanId: SpanId): Promise<Span | null> {
    const startTime = Date.now();
    const span = this.spans.get(spanId) || null;
    const readTime = Date.now() - startTime;

    this.updateAvgReadTime(readTime);
    return span;
  }

  async putSpan(spanId: SpanId, span: Span): Promise<void> {
    const startTime = Date.now();

    this.spans.set(spanId, span);
    this.stats.totalSpans++;

    // Update trace-to-spans index
    if (!this.traceToSpans.has(span.traceId)) {
      this.traceToSpans.set(span.traceId, new Set());
    }
    this.traceToSpans.get(span.traceId)!.add(spanId);

    const writeTime = Date.now() - startTime;
    this.updateAvgWriteTime(writeTime);
    this.stats.storageSize += JSON.stringify(span).length;
  }

  async deleteSpan(spanId: SpanId): Promise<void> {
    const span = this.spans.get(spanId);
    if (!span) return;

    // Remove from trace-to-spans index
    const spanIds = this.traceToSpans.get(span.traceId);
    if (spanIds) {
      spanIds.delete(spanId);
    }

    this.spans.delete(spanId);
    this.stats.totalSpans--;
  }

  async batchPutSpans(spans: Span[]): Promise<BatchResult> {
    let successful = 0;
    const failed: Array<{ key: string; error: string }> = [];

    for (const span of spans) {
      try {
        await this.putSpan(span.spanId, span);
        successful++;
      } catch (error) {
        failed.push({
          key: span.spanId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { successful, failed: failed.length, errors: failed };
  }

  async batchDeleteSpans(spanIds: SpanId[]): Promise<BatchResult> {
    let successful = 0;
    const failed: Array<{ key: string; error: string }> = [];

    for (const spanId of spanIds) {
      try {
        await this.deleteSpan(spanId);
        successful++;
      } catch (error) {
        failed.push({
          key: spanId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { successful, failed: failed.length, errors: failed };
  }

  async queryTracesByService(service: string, options?: QueryOptions): Promise<Trace[]> {
    const traceIds = this.serviceToTraces.get(service);
    if (!traceIds) {
      return [];
    }

    const traces: Trace[] = [];
    for (const traceId of traceIds) {
      const trace = this.traces.get(traceId);
      if (trace) {
        traces.push(trace);
      }
    }

    if (!options) {
      return traces;
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || traces.length;
    return traces.slice(offset, offset + limit);
  }

  async querySpansByTrace(traceId: TraceId): Promise<Span[]> {
    const spanIds = this.traceToSpans.get(traceId);
    if (!spanIds) {
      return [];
    }

    const spans: Span[] = [];
    for (const spanId of spanIds) {
      const span = this.spans.get(spanId);
      if (span) {
        spans.push(span);
      }
    }

    return spans;
  }

  async queryTracesByTimeRange(
    startTime: number,
    endTime: number,
    options?: QueryOptions
  ): Promise<Trace[]> {
    const traces = Array.from(this.traces.values()).filter(
      (trace) => trace.startTime >= startTime && trace.startTime <= endTime
    );

    if (!options) {
      return traces;
    }

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || traces.length;
    return traces.slice(offset, offset + limit);
  }

  async createIndex(index: StorageIndex): Promise<void> {
    this.indexes.set(index.name, index);
    this.stats.indexSize++;
  }

  async deleteIndex(name: string): Promise<void> {
    this.indexes.delete(name);
    this.stats.indexSize--;
  }

  async compact(): Promise<void> {
    // Remove orphaned spans
    const validSpanIds = new Set<SpanId>();
    for (const trace of this.traces.values()) {
      for (const span of trace.spans) {
        validSpanIds.add(span.spanId);
      }
    }

    for (const [spanId] of this.spans) {
      if (!validSpanIds.has(spanId)) {
        await this.deleteSpan(spanId);
      }
    }
  }

  async clear(): Promise<void> {
    this.traces.clear();
    this.spans.clear();
    this.traceToSpans.clear();
    this.serviceToTraces.clear();
    this.indexes.clear();

    this.stats = {
      totalTraces: 0,
      totalSpans: 0,
      storageSize: 0,
      indexSize: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgReadTime: 0,
      avgWriteTime: 0,
    };
  }

  async getStats(): Promise<StorageStats> {
    return { ...this.stats };
  }

  private updateAvgReadTime(time: number): void {
    const totalOps = this.stats.cacheHits + this.stats.cacheMisses;
    this.stats.avgReadTime = (this.stats.avgReadTime * (totalOps - 1) + time) / totalOps;
  }

  private updateAvgWriteTime(time: number): void {
    // Simple moving average
    this.stats.avgWriteTime = (this.stats.avgWriteTime + time) / 2;
  }
}

export default MemoryStorage;
