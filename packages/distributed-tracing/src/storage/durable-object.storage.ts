/**
 * Durable Objects storage implementation for Cloudflare Workers
 * Provides persistent, strongly consistent storage for distributed tracing
 */

import {
  TraceStorage,
  StorageStats,
  QueryOptions,
  BatchResult,
  StorageIndex,
} from '../types/storage.types';
import { Trace, TraceId, Span, SpanId } from '../types/trace.types';

/**
 * Durable Object stub interface
 */
interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

/**
 * Durable Object state interface
 */
interface DurableObjectState {
  storage: {
    get: (key: string) => Promise<any>;
    put: (key: string, value: any) => Promise<void>;
    delete: (key: string) => Promise<void>;
    list: (options?: { limit?: number; start?: string }) => Promise<{ keys: string[] }>;
    transaction: <T>(callback: (store: any) => Promise<T>) => Promise<T>;
  };
  id: { toString: () => string };
}

/**
 * Trace storage Durable Object
 */
export class TraceStorageDurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState, _env: unknown) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    try {
      let result: any;
      let status = 200;

      if (path === '/get' && method === 'GET') {
        const traceId = url.searchParams.get('traceId');
        if (!traceId) throw new Error('Missing traceId');
        result = await this.getTrace(traceId);
      } else if (path === '/put' && method === 'POST') {
        const body = await request.json() as { traceId: TraceId; trace: Trace };
        result = await this.putTrace(body.traceId, body.trace);
      } else if (path === '/delete' && method === 'DELETE') {
        const traceId = url.searchParams.get('traceId');
        if (!traceId) throw new Error('Missing traceId');
        await this.deleteTrace(traceId);
        result = { success: true };
      } else if (path === '/list' && method === 'GET') {
        const options = JSON.parse(url.searchParams.get('options') || '{}');
        result = await this.listTraces(options);
      } else if (path === '/getSpan' && method === 'GET') {
        const spanId = url.searchParams.get('spanId');
        if (!spanId) throw new Error('Missing spanId');
        result = await this.getSpan(spanId);
      } else if (path === '/putSpan' && method === 'POST') {
        const body = await request.json() as { spanId: SpanId; span: Span };
        result = await this.putSpan(body.spanId, body.span);
      } else if (path === '/batchPutSpans' && method === 'POST') {
        const body = await request.json() as { spans: Span[] };
        result = await this.batchPutSpans(body.spans);
      } else if (path === '/queryTracesByService' && method === 'GET') {
        const service = url.searchParams.get('service');
        if (!service) throw new Error('Missing service');
        const options = JSON.parse(url.searchParams.get('options') || '{}');
        result = await this.queryTracesByService(service, options);
      } else if (path === '/querySpansByTrace' && method === 'GET') {
        const traceId = url.searchParams.get('traceId');
        if (!traceId) throw new Error('Missing traceId');
        result = await this.querySpansByTrace(traceId);
      } else if (path === '/getStats' && method === 'GET') {
        result = await this.getStats();
      } else if (path === '/clear' && method === 'POST') {
        await this.clear();
        result = { success: true };
      } else {
        status = 404;
        result = { error: 'Not found' };
      }

      return new Response(JSON.stringify(result), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  private async getTrace(traceId: TraceId): Promise<Trace | null> {
    const key = `trace:${traceId}`;
    const data = await this.state.storage.get(key);
    return data || null;
  }

  private async putTrace(traceId: TraceId, trace: Trace): Promise<void> {
    const key = `trace:${traceId}`;
    await this.state.storage.put(key, trace);

    // Update service index
    const services = new Set(trace.spans.map((s) => s.service));
    for (const service of services) {
      const indexKey = `service:${service}`;
      const existing = await this.state.storage.get(indexKey);
      const traces = new Set(existing || []);
      traces.add(traceId);
      await this.state.storage.put(indexKey, Array.from(traces));
    }
  }

  private async deleteTrace(traceId: TraceId): Promise<void> {
    const trace = await this.getTrace(traceId);
    if (!trace) return;

    // Remove from service index
    const services = new Set(trace.spans.map((s) => s.service));
    for (const service of services) {
      const indexKey = `service:${service}`;
      const existing = await this.state.storage.get(indexKey);
      if (existing) {
        const traces = new Set(existing);
        traces.delete(traceId);
        await this.state.storage.put(indexKey, Array.from(traces));
      }
    }

    // Remove trace
    const key = `trace:${traceId}`;
    await this.state.storage.delete(key);
  }

  private async listTraces(options?: QueryOptions): Promise<Trace[]> {
    const { keys } = await this.state.storage.list({ limit: options?.limit });
    const traceKeys = keys.filter((k) => k.startsWith('trace:'));

    const traces: Trace[] = [];
    for (const key of traceKeys) {
      const trace = await this.state.storage.get(key);
      if (trace) {
        traces.push(trace);
      }
    }

    return traces;
  }

  private async getSpan(spanId: SpanId): Promise<Span | null> {
    const key = `span:${spanId}`;
    const data = await this.state.storage.get(key);
    return data || null;
  }

  private async putSpan(spanId: SpanId, span: Span): Promise<void> {
    const key = `span:${spanId}`;
    await this.state.storage.put(key, span);

    // Update trace-to-spans index
    const indexKey = `trace_spans:${span.traceId}`;
    const existing = await this.state.storage.get(indexKey);
    const spanIds = new Set(existing || []);
    spanIds.add(spanId);
    await this.state.storage.put(indexKey, Array.from(spanIds));
  }

  private async batchPutSpans(spans: Span[]): Promise<BatchResult> {
    let successful = 0;
    const errors: Array<{ key: string; error: string }> = [];

    for (const span of spans) {
      try {
        await this.putSpan(span.spanId, span);
        successful++;
      } catch (error) {
        errors.push({
          key: span.spanId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { successful, failed: errors.length, errors };
  }

  private async queryTracesByService(service: string, options?: QueryOptions): Promise<Trace[]> {
    const indexKey = `service:${service}`;
    const traceIds = await this.state.storage.get(indexKey);

    if (!traceIds) {
      return [];
    }

    const traces: Trace[] = [];
    for (const traceId of traceIds) {
      const trace = await this.getTrace(traceId);
      if (trace) {
        traces.push(trace);
      }
    }

    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit || traces.length;
    return traces.slice(offset, offset + limit);
  }

  private async querySpansByTrace(traceId: TraceId): Promise<Span[]> {
    const indexKey = `trace_spans:${traceId}`;
    const spanIds = await this.state.storage.get(indexKey);

    if (!spanIds) {
      return [];
    }

    const spans: Span[] = [];
    for (const spanId of spanIds) {
      const span = await this.getSpan(spanId);
      if (span) {
        spans.push(span);
      }
    }

    return spans;
  }

  private async getStats(): Promise<StorageStats> {
    const { keys } = await this.state.storage.list();
    const traceKeys = keys.filter((k) => k.startsWith('trace:'));
    const spanKeys = keys.filter((k) => k.startsWith('span:'));

    return {
      totalTraces: traceKeys.length,
      totalSpans: spanKeys.length,
      storageSize: 0, // Durable Objects don't expose storage size
      indexSize: keys.filter((k) => k.includes(':') && !k.startsWith('trace:') && !k.startsWith('span:'))
        .length,
      cacheHits: 0,
      cacheMisses: 0,
      avgReadTime: 0,
      avgWriteTime: 0,
    };
  }

  private async clear(): Promise<void> {
    const { keys } = await this.state.storage.list();
    for (const key of keys) {
      await this.state.storage.delete(key);
    }
  }
}

/**
 * Durable Objects storage client
 */
export class DurableObjectStorage implements TraceStorage {
  private stub: DurableObjectStub;

  constructor(stub: DurableObjectStub) {
    this.stub = stub;
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const url = `http://durable-object${path}`;
    const init: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (body) {
      init.body = JSON.stringify(body);
    }

    const response = await this.stub.fetch(new Request(url, init));
    const data = await response.json() as { error?: string; [key: string]: unknown };

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  async getTrace(traceId: TraceId): Promise<Trace | null> {
    return await this.request('GET', `/get?traceId=${encodeURIComponent(traceId)}`);
  }

  async putTrace(traceId: TraceId, trace: Trace): Promise<void> {
    await this.request('POST', '/put', { traceId, trace });
  }

  async deleteTrace(traceId: TraceId): Promise<void> {
    await this.request('DELETE', `/delete?traceId=${encodeURIComponent(traceId)}`);
  }

  async listTraces(options?: QueryOptions): Promise<Trace[]> {
    const params = options ? `?options=${encodeURIComponent(JSON.stringify(options))}` : '';
    return await this.request('GET', `/list${params}`);
  }

  async getSpan(spanId: SpanId): Promise<Span | null> {
    return await this.request('GET', `/getSpan?spanId=${encodeURIComponent(spanId)}`);
  }

  async putSpan(spanId: SpanId, span: Span): Promise<void> {
    await this.request('POST', '/putSpan', { spanId, span });
  }

  async deleteSpan(_spanId: SpanId): Promise<void> {
    // Implementation for deleteSpan
    throw new Error('deleteSpan not implemented');
  }

  async batchPutSpans(spans: Span[]): Promise<BatchResult> {
    return await this.request('POST', '/batchPutSpans', { spans });
  }

  async batchDeleteSpans(_spanIds: SpanId[]): Promise<BatchResult> {
    // Implementation for batchDeleteSpans
    throw new Error('batchDeleteSpans not implemented');
  }

  async queryTracesByService(service: string, options?: QueryOptions): Promise<Trace[]> {
    const params = options
      ? `?service=${encodeURIComponent(service)}&options=${encodeURIComponent(
          JSON.stringify(options)
        )}`
      : `?service=${encodeURIComponent(service)}`;
    return await this.request('GET', `/queryTracesByService${params}`);
  }

  async querySpansByTrace(traceId: TraceId): Promise<Span[]> {
    return await this.request('GET', `/querySpansByTrace?traceId=${encodeURIComponent(traceId)}`);
  }

  async queryTracesByTimeRange(startTime: number, endTime: number, _options?: QueryOptions): Promise<Trace[]> {
    // Implementation would require time-based indexing
    const traces = await this.listTraces();
    return traces.filter((t) => t.startTime >= startTime && t.startTime <= endTime);
  }

  async createIndex(_index: StorageIndex): Promise<void> {
    // Durable Objects handle indexing implicitly
    throw new Error('createIndex not implemented');
  }

  async deleteIndex(_name: string): Promise<void> {
    throw new Error('deleteIndex not implemented');
  }

  async compact(): Promise<void> {
    // Durable Objects handle compaction automatically
  }

  async clear(): Promise<void> {
    await this.request('POST', '/clear');
  }

  async getStats(): Promise<StorageStats> {
    return await this.request('GET', '/getStats');
  }
}

export default DurableObjectStorage;
