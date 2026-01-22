/**
 * Test Utilities for ClaudeFlare Edge API
 *
 * Comprehensive mocking and testing utilities for Cloudflare Workers environment
 */

import type { Env, ChatMessage, ChatRequest, ChatResponse, Model } from '../src/types';
import { vi } from 'vitest';

/**
 * Mock KV Namespace implementation
 */
export class MockKVNamespace {
  private store = new Map<string, { value: string; expiration?: number }>();

  async get(key: string): Promise<string | null>;
  async get(key: string, type: 'text'): Promise<string | null>;
  async get(key: string, type: 'json'): Promise<any>;
  async get(key: string, type: 'stream'): Promise<ReadableStream | null>;
  async get(key: string, type: 'text' | 'json' | 'stream' = 'text'): Promise<any> {
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (entry.expiration && entry.expiration < Date.now()) {
      this.store.delete(key);
      return null;
    }

    if (type === 'json') {
      return JSON.parse(entry.value);
    }

    if (type === 'stream') {
      return new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(entry.value));
          controller.close();
        },
      });
    }

    return entry.value;
  }

  async getWithMetadata(key: string): Promise<{ value: string | null; metadata: any }> {
    const entry = this.store.get(key);

    if (!entry) {
      return { value: null, metadata: null };
    }

    return { value: entry.value, metadata: {} };
  }

  async put(key: string, value: string | ReadableStream | ArrayBuffer, options?: any): Promise<void> {
    let stringValue: string;

    if (typeof value === 'string') {
      stringValue = value;
    } else if (value instanceof ReadableStream) {
      const reader = value.getReader();
      const chunks: Uint8Array[] = [];
      let done = false;

      while (!done) {
        const { value: chunk, done: d } = await reader.read();
        done = d;
        if (chunk) chunks.push(chunk);
      }

      const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      stringValue = new TextDecoder().decode(combined);
    } else {
      stringValue = new TextDecoder().decode(value);
    }

    this.store.set(key, {
      value: stringValue,
      ...(options?.expirationTtl !== undefined ? { expiration: Date.now() + options.expirationTtl * 1000 } : {}),
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: Array<{ name: string }>;
    list_complete: boolean;
    cursor?: string;
  }> {
    let keys = Array.from(this.store.keys());

    if (options?.prefix) {
      keys = keys.filter(key => key.startsWith(options.prefix!));
    }

    if (options?.limit) {
      keys = keys.slice(0, options.limit);
    }

    return {
      keys: keys.map(name => ({ name })),
      list_complete: true,
    };
  }

  // Helper methods for testing
  _clear(): void {
    this.store.clear();
  }

  _size(): number {
    return this.store.size;
  }

  _has(key: string): boolean {
    return this.store.has(key);
  }
}

/**
 * Mock R2 Bucket implementation
 */
export class MockR2Bucket {
  private store = new Map<string, Uint8Array>();
  private metadata = new Map<string, any>();

  async put(key: string, value: ReadableStream | ArrayBuffer | Uint8Array, options?: any): Promise<any> {
    let data: Uint8Array;

    if (value instanceof ReadableStream) {
      const reader = value.getReader();
      const chunks: Uint8Array[] = [];
      let done = false;

      while (!done) {
        const { value: chunk, done: d } = await reader.read();
        done = d;
        if (chunk) chunks.push(chunk);
      }

      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      data = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.length;
      }
    } else if (value instanceof ArrayBuffer) {
      data = new Uint8Array(value);
    } else {
      data = value;
    }

    this.store.set(key, data);
    if (options?.customMetadata) {
      this.metadata.set(key, options.customMetadata);
    }

    return {
      key,
      size: data.length,
      etag: crypto.randomUUID(),
    };
  }

  async get(key: string): Promise<{
    object?: {
      arrayBuffer(): Promise<ArrayBuffer>;
      text(): Promise<string>;
      json(): Promise<any>;
    };
    writeHttpMetadata(headers: Headers): void;
    httpEtag: string;
    httpMetadata?: any;
    size: number;
    key: string;
  } | null> {
    const data = this.store.get(key);
    if (!data) return null;

    return {
      object: {
        async arrayBuffer(): Promise<ArrayBuffer> {
          return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
        },
        async text() {
          return new TextDecoder().decode(data);
        },
        async json() {
          return JSON.parse(new TextDecoder().decode(data));
        },
      },
      writeHttpMetadata(_headers: Headers): void {},
      httpEtag: crypto.randomUUID(),
      httpMetadata: this.metadata.get(key),
      size: data.length,
      key,
    };
  }

  async delete(keys: string[]): Promise<{ succeeded: string[]; failed: string[] }> {
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const key of keys) {
      if (this.store.delete(key)) {
        succeeded.push(key);
      } else {
        failed.push(key);
      }
    }

    return { succeeded, failed };
  }

  async list(options?: { prefix?: string; limit?: number }): Promise<{
    objects: Array<{ key: string; size: number }>;
    truncated: boolean;
  }> {
    let keys = Array.from(this.store.keys());

    if (options?.prefix) {
      keys = keys.filter(key => key.startsWith(options.prefix!));
    }

    if (options?.limit) {
      keys = keys.slice(0, options.limit);
    }

    return {
      objects: keys.map(key => ({
        key,
        size: this.store.get(key)!.length,
      })),
      truncated: false,
    };
  }

  // Helper methods for testing
  _clear(): void {
    this.store.clear();
    this.metadata.clear();
  }

  _size(): number {
    return this.store.size;
  }
}

/**
 * Mock D1 Database implementation
 */
export class MockD1Database {
  private tables = new Map<string, any[]>();

  async prepare(statement: string): Promise<D1PreparedStatement> {
    return new D1PreparedStatement(statement, this.tables);
  }

  async batch(statements: D1PreparedStatement[]): Promise<any[]> {
    return await Promise.all(statements.map(stmt => stmt.all()));
  }

  // Helper methods for testing
  _getTable(name: string): any[] {
    if (!this.tables.has(name)) {
      this.tables.set(name, []);
    }
    return this.tables.get(name)!;
  }

  _insert(table: string, row: any): void {
    const rows = this._getTable(table);
    rows.push({ id: rows.length + 1, ...row });
  }

  _clear(): void {
    this.tables.clear();
  }
}

class D1PreparedStatement {
  private statement: string;
  private tables: Map<string, any[]>;

  constructor(_statement: string, tables: Map<string, any[]>) {
    this.statement = _statement;
    this.tables = tables;
  }

  bind(..._params: any[]): D1PreparedStatement {
    return this;
  }

  async first(): Promise<any> {
    const results = await this.all();
    return results.results[0] || null;
  }

  async all(): Promise<any> {
    // Simple SQL parser for basic operations
    const stmt = this.statement.trim().toLowerCase();

    // SELECT
    if (stmt.startsWith('select')) {
      const match = this.statement.match(/from\s+(\w+)/i);
      if (match) {
        const tableName = match[1];
        if (!tableName) {
          return { results: [], success: true, meta: {} };
        }
        const rows = this.tables.get(tableName) || [];
        return { results: rows, success: true, meta: {} };
      }
    }

    // INSERT
    if (stmt.startsWith('insert')) {
      const match = this.statement.match(/into\s+(\w+)/i);
      if (match) {
        const tableName = match[1];
        if (!tableName) {
          return { results: [], success: true, meta: {} };
        }
        const table = this.tables.get(tableName);
        if (!table) {
          this.tables.set(tableName, []);
        }
        return { results: [], success: true, meta: {} };
      }
    }

    // CREATE
    if (stmt.startsWith('create')) {
      return { results: [], success: true, meta: {} };
    }

    return { results: [], success: true, meta: {} };
  }

  async run(): Promise<any> {
    return await this.all();
  }
}

/**
 * Mock Durable Object Namespace
 */
export class MockDurableObjectNamespace {
  private instances = new Map<string, any>();

  async idFromName(name: string): Promise<any> {
    return { name };
  }

  async idFromString(id: string): Promise<any> {
    return { id };
  }

  async get(id: any): Promise<any> {
    const key = id.name || id.id;
    if (!this.instances.has(key)) {
      this.instances.set(key, new MockDurableObjectStub());
    }
    return this.instances.get(key);
  }

  // Helper methods for testing
  _clear(): void {
    this.instances.clear();
  }
}

class MockDurableObjectStub {
  constructor() {}

  async fetch(_input: RequestInfo, _init?: RequestInit): Promise<Response> {
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Mock Queue Producer
 */
export class MockQueueProducer {
  private messages: any[] = [];

  async send(message: any): Promise<void> {
    this.messages.push(message);
  }

  async sendBatch(messages: any[]): Promise<void> {
    this.messages.push(...messages);
  }

  // Helper methods for testing
  _getMessages(): any[] {
    return [...this.messages];
  }

  _clear(): void {
    this.messages = [];
  }

  _size(): number {
    return this.messages.length;
  }
}

/**
 * Create mock Cloudflare environment
 */
export function mockEnv(): Env {
  return {
    CACHE_KV: new MockKVNamespace() as any,
    CONFIG_KV: new MockKVNamespace() as any,
    SESSIONS: new MockDurableObjectNamespace() as any,
    AGENTS: new MockDurableObjectNamespace() as any,
    VECTOR_DB: new MockDurableObjectNamespace() as any,
    STORAGE_R2: new MockR2Bucket() as any,
    DB: new MockD1Database() as any,
    QUEUE_PRODUCER: new MockQueueProducer() as any,
    ENVIRONMENT: 'development' as const,
    API_VERSION: '0.1.0',
  };
}

/**
 * Create mock KV namespace
 */
export function mockKV(): MockKVNamespace {
  return new MockKVNamespace();
}

/**
 * Create mock R2 bucket
 */
export function mockR2(): MockR2Bucket {
  return new MockR2Bucket();
}

/**
 * Create mock D1 database
 */
export function mockD1(): MockD1Database {
  return new MockD1Database();
}

/**
 * Create mock request
 */
export function createMockRequest(
  url: string,
  method: string = 'GET',
  body?: unknown,
  headers?: Record<string, string>
): Request {
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'ClaudeFlare-Test/1.0',
      ...headers,
    },
  };

  if (body && method !== 'GET' && method !== 'HEAD') {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  return new Request(url, init);
}

/**
 * Create mock chat request
 */
export function createChatRequest(
  content: string,
  role: 'user' | 'system' | 'assistant' = 'user',
  options?: Partial<ChatRequest>
): Request {
  const message: ChatMessage = { role, content };
  const chatRequest: ChatRequest = {
    messages: [message],
    model: options?.model || 'claude-3-opus-20240229',
    provider: options?.provider || 'anthropic',
    temperature: options?.temperature || 0.7,
    maxTokens: options?.maxTokens || 4096,
    ...options,
  };

  return createMockRequest('https://api.test.com/v1/chat', 'POST', chatRequest);
}

/**
 * Create mock chat response
 */
export function createMockResponse(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': crypto.randomUUID(),
    },
  });
}

/**
 * Create mock error response
 */
export function createMockErrorResponse(code: string, message: string, status: number = 500): Response {
  return createMockResponse(
    {
      error: {
        code,
        message,
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
      },
    },
    status
  );
}

/**
 * Create mock chat completion response
 */
export function createMockChatResponse(
  content: string,
  model: string = 'claude-3-opus-20240229',
  provider: string = 'anthropic'
): ChatResponse {
  return {
    id: crypto.randomUUID(),
    content,
    model,
    provider: provider as any,
    finishReason: 'stop',
    usage: {
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
    },
    timestamp: Date.now(),
  };
}

/**
 * Create mock model
 */
export function createMockModel(overrides?: Partial<Model>): Model {
  return {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    contextLength: 200000,
    description: 'Most powerful model for complex tasks',
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: true,
    },
    pricing: {
      inputCostPer1K: 0.015,
      outputCostPer1K: 0.075,
    },
    ...overrides,
  };
}

/**
 * Wait for async operations
 */
export async function flushPromises(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Create a spy that tracks calls
 */
export function createSpy<T extends (...args: any[]) => any>(fn?: T) {
  const calls: any[][] = [];
  const results: any[] = [];

  const spy = ((...args: any[]) => {
    calls.push(args);
    const result = fn ? fn(...args) : undefined;
    results.push(result);
    return result;
  }) as T & {
    calls: any[][];
    results: any[];
    mockClear(): void;
  };

  spy.calls = calls;
  spy.results = results;
  spy.mockClear = () => {
    calls.length = 0;
    results.length = 0;
  };

  return spy;
}

/**
 * Mock performance API for timing tests
 */
export function mockPerformance() {
  let time = 0;

  return {
    now: vi.fn(() => time),
    advance: (ms: number) => {
      time += ms;
    },
    reset: () => {
      time = 0;
    },
  };
}

/**
 * Create a mock readable stream
 */
export function createMockReadableStream(chunks: string[]): ReadableStream {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });
}

/**
 * Read a stream completely
 */
export async function readStream(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return new TextDecoder().decode(combined);
}

/**
 * Assert async error
 */
export async function assertThrowsAsync(fn: () => Promise<any>, errorMatch?: string | RegExp): Promise<void> {
  let error: Error | null = null;

  try {
    await fn();
  } catch (e) {
    error = e as Error;
  }

  if (!error) {
    throw new Error('Expected function to throw');
  }

  if (errorMatch) {
    const match = typeof errorMatch === 'string' ? error.message.includes(errorMatch) : errorMatch.test(error.message);
    if (!match) {
      throw new Error(`Expected error message to match ${errorMatch}, got "${error.message}"`);
    }
  }
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelay?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelay = 100 } = options;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await sleep(baseDelay * Math.pow(2, attempt - 1));
      }
    }
  }

  throw lastError;
}
