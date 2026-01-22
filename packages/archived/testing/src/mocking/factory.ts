/**
 * Mock Framework - Function and module mocking with Cloudflare service mocks
 */

import type {
  MockFunction,
  Mock,
  ModuleMock,
  KVNamespaceMock,
  R2BucketMock,
  D1DatabaseMock,
  DurableObjectMock,
  DurableObjectStorageMock,
} from '../types/index.js';

// ============================================================================
// Function Mocking
// ============================================================================

export class MockFactory {
  private mocks = new Map<string, MockFunction<(...args: unknown[]) => unknown>>();

  fn<T extends (...args: unknown[]) => unknown>(
    implementation?: T
  ): MockFunction<T> {
    const mockFn = function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
      const mock = mockFn._mock;
      mock.calls.push(args);
      mock.contexts.push(this);

      let result: unknown;
      try {
        if (implementation) {
          result = implementation.apply(this, args);
        } else {
          result = undefined;
        }

        mock.results.push({ type: 'return', value: result });
        return result as ReturnType<T>;
      } catch (error) {
        mock.results.push({ type: 'throw', value: error });
        throw error;
      }
    } as MockFunction<T>;

    mockFn._isMock = true;
    mockFn._mock = {
      calls: [],
      results: [],
      instances: [],
      contexts: [],
    };
    mockFn.getMockName = () => 'mockFn';
    mockFn.mockName = (name: string) => {
      mockFn.getMockName = () => name;
      return mockFn;
    };

    // Mock methods
    mockFn.mockImplementation = (fn: T) => {
      implementation = fn;
      return mockFn;
    };

    mockFn.mockImplementationOnce = (fn: T) => {
      const original = implementation;
      implementation = function (this: unknown, ...args: Parameters<T>) {
        implementation = original!;
        return fn.apply(this, args);
      } as T;
      return mockFn;
    };

    mockFn.mockReturnValue = (value: ReturnType<T>) => {
      implementation = (() => value) as T;
      return mockFn;
    };

    mockFn.mockReturnValueOnce = (value: ReturnType<T>) => {
      const original = implementation;
      implementation = (function () {
        implementation = original!;
        return value;
      }) as T;
      return mockFn;
    };

    mockFn.mockResolvedValue = (value: Awaited<ReturnType<T>>) => {
      implementation = (async () => value) as T;
      return mockFn;
    };

    mockFn.mockResolvedValueOnce = (value: Awaited<ReturnType<T>>) => {
      const original = implementation;
      implementation = (async function () {
        implementation = original!;
        return value;
      }) as T;
      return mockFn;
    };

    mockFn.mockRejectedValue = (error: unknown) => {
      implementation = (async () => {
        throw error;
      }) as T;
      return mockFn;
    };

    mockFn.mockRejectedValueOnce = (error: unknown) => {
      const original = implementation;
      implementation = (async function () {
        implementation = original!;
        throw error;
      }) as T;
      return mockFn;
    };

    mockFn.returnThis = () => {
      implementation = function (this: unknown) {
        return this;
      } as T;
      return mockFn;
    };

    mockFn.clearMock = () => {
      mockFn._mock.calls = [];
      mockFn._mock.results = [];
      mockFn._mock.instances = [];
      mockFn._mock.contexts = [];
      return mockFn;
    };

    mockFn.resetMock = () => {
      mockFn._mock.calls = [];
      mockFn._mock.results = [];
      mockFn._mock.instances = [];
      mockFn._mock.contexts = [];
      implementation = undefined as unknown as T;
      return mockFn;
    };

    mockFn.restoreMocks = () => {
      implementation = undefined as unknown as T;
      return mockFn;
    };

    return mockFn;
  }

  spyOn<T extends object, K extends keyof T>(
    obj: T,
    method: K
  ): MockFunction<T[K] extends (...args: any[]) => any ? T[K] : never> {
    const original = obj[method];
    const mockFn = this.fn(original as any) as MockFunction<any>;

    mockFn.mockRestore = () => {
      obj[method] = original;
      return mockFn;
    };

    obj[method] = mockFn as any;
    return mockFn;
  }

  replace<T>(obj: T, property: keyof T, value: T[keyof T]): void {
    const original = obj[property];
    (obj as any)[`__mock_${property}`] = original;
    obj[property] = value;
  }

  restore<T>(obj: T, property: keyof T): void {
    const original = (obj as any)[`__mock_${property}`];
    if (original !== undefined) {
      obj[property] = original;
      delete (obj as any)[`__mock_${property}`];
    }
  }

  restoreAll<T>(obj: T): void {
    for (const key in obj) {
      if (key.startsWith('__mock_')) {
        const property = key.replace('__mock_', '') as keyof T;
        obj[property] = obj[key as keyof T];
        delete obj[key as keyof T];
      }
    }
  }
}

// ============================================================================
// Module Mocking
// ============================================================================

export class ModuleMockFactory {
  private mocks = new Map<string, ModuleMock>();
  private originals = new Map<string, unknown>();

  mock(modulePath: string, mock: ModuleMock): void {
    if (!this.mocks.has(modulePath)) {
      // Store original if not already stored
      if (!this.originals.has(modulePath)) {
        try {
          this.originals.set(modulePath, require(modulePath));
        } catch {
          // Module not loaded yet, that's fine
        }
      }
    }
    this.mocks.set(modulePath, mock);
  }

  unmock(modulePath: string): void {
    this.mocks.delete(modulePath);
  }

  getMock(modulePath: string): ModuleMock | undefined {
    return this.mocks.get(modulePath);
  }

  getOriginal(modulePath: string): unknown {
    return this.originals.get(modulePath);
  }

  restoreAll(): void {
    this.mocks.clear();
    this.originals.clear();
  }
}

// ============================================================================
// KV Namespace Mock
// ============================================================================

export class KVNamespaceMockFactory {
  create(): KVNamespaceMock {
    const store = new Map<string, { value: string | ArrayBuffer; metadata?: unknown }>();

    return {
      async get(key: string): Promise<string | null> {
        const item = store.get(key);
        return item?.value as string || null;
      },

      async get(key: string, type: 'text'): Promise<string | null>;
      async get(key: string, type: 'json'): Promise<unknown | null>;
      async get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
      async get(key: string, type: 'stream'): Promise<ReadableStream | null>;
      async get(key: string, type?: string): Promise<string | ArrayBuffer | ReadableStream | unknown | null> {
        const item = store.get(key);
        if (!item) return null;

        switch (type) {
          case 'json':
            return JSON.parse(item.value as string);
          case 'arrayBuffer':
            return item.value as ArrayBuffer;
          case 'stream':
            return new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode(item.value as string));
                controller.close();
              },
            });
          default:
            return item.value as string;
        }
      },

      async put(key: string, value: string | ReadableStream | ArrayBuffer, options?: { expirationTtl?: number; metadata?: unknown }): Promise<void> {
        let storedValue: string | ArrayBuffer;

        if (value instanceof ReadableStream) {
          const reader = value.getReader();
          const chunks: Uint8Array[] = [];
          let totalLength = 0;

          while (true) {
            const { done, value: chunk } = await reader.read();
            if (done) break;
            chunks.push(chunk);
            totalLength += chunk.length;
          }

          const combined = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of chunks) {
            combined.set(chunk, offset);
            offset += chunk.length;
          }

          storedValue = combined.buffer;
        } else {
          storedValue = value;
        }

        store.set(key, {
          value: typeof storedValue === 'object' && 'buffer' in storedValue ? storedValue.buffer : storedValue,
          metadata: options?.metadata,
        });
      },

      async delete(key: string): Promise<void> {
        store.delete(key);
      },

      async list(options?: { cursor?: string; limit?: number; prefix?: string }): Promise<{ keys: Array<{ name: string }>; list_complete: boolean; cursor?: string }> {
        let keys = Array.from(store.keys());

        if (options?.prefix) {
          keys = keys.filter(k => k.startsWith(options.prefix!));
        }

        if (options?.limit) {
          const start = options.cursor ? parseInt(options.cursor) : 0;
          keys = keys.slice(start, start + options.limit);
        }

        return {
          keys: keys.map(k => ({ name: k })),
          list_complete: true,
          cursor: undefined,
        };
      },

      async getWithMetadata<Metadata = unknown>(key: string): Promise<{ value: string | null; metadata: Metadata | null }> {
        const item = store.get(key);
        return {
          value: (item?.value as string) || null,
          metadata: (item?.metadata as Metadata) || null,
        };
      },
    };
  }
}

// ============================================================================
// R2 Bucket Mock
// ============================================================================>

export class R2BucketMockFactory {
  create(): R2BucketMock {
    const store = new Map<string, { data: ArrayBuffer; metadata: Record<string, string>; httpMetadata: Record<string, string> }>();

    return {
      async put(key: string, value: R2PutValue, options?: R2PutOptions): Promise<R2Object> {
        let data: ArrayBuffer;

        if (value instanceof ReadableStream) {
          const reader = value.getReader();
          const chunks: Uint8Array[] = [];
          let totalLength = 0;

          while (true) {
            const { done, value: chunk } = await reader.read();
            if (done) break;
            chunks.push(chunk);
            totalLength += chunk.length;
          }

          const combined = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of chunks) {
            combined.set(chunk, offset);
            offset += chunk.length;
          }

          data = combined.buffer;
        } else if (value instanceof ArrayBuffer) {
          data = value;
        } else {
          data = new TextEncoder().encode(value).buffer;
        }

        store.set(key, {
          data,
          metadata: options?.customMetadata || {},
          httpMetadata: options?.httpMetadata || {},
        });

        return {
          key,
          size: data.byteLength,
          etag: 'mock-etag',
          uploaded: new Date(),
          httpMetadata: options?.httpMetadata || {},
          customMetadata: options?.customMetadata || {},
          writeHttpMetadata: async () => {},
        } as R2Object;
      },

      async get(key: string): Promise<R2Object | R2ObjectBody | null> {
        const item = store.get(key);
        if (!item) return null;

        return {
          key,
          size: item.data.byteLength,
          etag: 'mock-etag',
          uploaded: new Date(),
          httpMetadata: item.httpMetadata,
          customMetadata: item.metadata,
          writeHttpMetadata: async () => {},
          arrayBuffer: async () => item.data,
          text: async () => new TextDecoder().decode(item.data),
          json: async () => JSON.parse(new TextDecoder().decode(item.data)),
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(item.data));
              controller.close();
            },
          }),
        } as R2ObjectBody;
      },

      async head(key: string): Promise<R2Object | null> {
        const item = store.get(key);
        if (!item) return null;

        return {
          key,
          size: item.data.byteLength,
          etag: 'mock-etag',
          uploaded: new Date(),
          httpMetadata: item.httpMetadata,
          customMetadata: item.metadata,
          writeHttpMetadata: async () => {},
        } as R2Object;
      },

      async delete(keys: string | string[]): Promise<void> {
        const keysArray = Array.isArray(keys) ? keys : [keys];
        for (const key of keysArray) {
          store.delete(key);
        }
      },

      async list(options?: R2ListOptions): Promise<R2Objects> {
        let keys = Array.from(store.entries()).map(([key, value]) => ({
          key,
          size: value.data.byteLength,
          uploaded: new Date(),
          httpMetadata: value.httpMetadata,
          customMetadata: value.metadata,
        }));

        if (options?.prefix) {
          keys = keys.filter(k => k.key.startsWith(options.prefix));
        }

        if (options?.limit) {
          keys = keys.slice(0, options.limit);
        }

        if (options?.cursor) {
          const start = parseInt(options.cursor);
          keys = keys.slice(start);
        }

        return {
          objects: keys,
          truncated: false,
          cursor: undefined,
        };
      },
    };
  }
}

// ============================================================================
// D1 Database Mock
// ============================================================================

export class D1DatabaseMockFactory {
  private tables = new Map<string, Map<string, Record<string, unknown>>>();

  create(): D1DatabaseMock {
    return {
      prepare(query: string): D1PreparedStatement {
        return new D1PreparedStatementMock(query);
      },

      async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
        const results: D1Result[] = [];
        for (const stmt of statements) {
          const mock = stmt as D1PreparedStatementMock;
          results.push(await mock.execute());
        }
        return results;
      },

      async exec(query: string): Promise<D1ExecResult> {
        // Simple SQL parsing for INSERT, UPDATE, DELETE
        const tableMatch = query.match(/(?:INSERT INTO|UPDATE|DELETE FROM)\s+(\w+)/);
        if (tableMatch) {
          const tableName = tableMatch[1];
          if (!this.tables.has(tableName)) {
            this.tables.set(tableName, new Map());
          }
        }

        return {
          success: true,
          meta: {
            duration: 0,
            changes: 1,
            last_row_id: 1,
            served_by: 'mock',
          },
        };
      },
    };
  }
}

class D1PreparedStatementMock implements D1PreparedStatement {
  private query: string;
  private params: unknown[] = [];

  constructor(query: string) {
    this.query = query;
  }

  bind(...values: unknown[]): D1PreparedStatement {
    this.params = values;
    return this;
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    // Mock implementation
    return null;
  }

  async first<T = Record<string, unknown>>(columnName: string): Promise<T | null> {
    return null;
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return {
      results: [],
      success: true,
      meta: {
        duration: 0,
        served_by: 'mock',
      },
    };
  }

  async run(): Promise<D1Result> {
    return {
      results: [],
      success: true,
      meta: {
        duration: 0,
        served_by: 'mock',
        changes: 1,
        last_row_id: 1,
      },
    };
  }

  async raw(): Promise<unknown[]> {
    return [];
  }

  async execute(): Promise<D1Result> {
    return this.run();
  }
}

// ============================================================================
// Durable Object Mock
// ============================================================================

export class DurableObjectMockFactory {
  private storages = new Map<string, DurableObjectStorageMock>();

  create(id: string): DurableObjectMock {
    const storage = this.createStorage(id);

    return {
      id: {
        toString: () => id,
        equals: (other: DurableObjectId) => other.toString() === id,
      } as DurableObjectId,
      stub: {
        get: async () => null,
        fetch: async () => new Response(),
        fetch: async () => new Response(),
      } as DurableObjectStub,
      storage,
      state: {
        storage,
        get id() {
          return {
            toString: () => id,
          };
        },
        get waitUntil() {
          return () => {};
        },
        getAlarm: async () => null,
        setAlarm: async () => {},
        deleteAlarm: async () => {},
      } as DurableObjectStateMock,
    };
  }

  createStorage(id: string): DurableObjectStorageMock {
    if (!this.storages.has(id)) {
      this.storages.set(id, new DurableObjectStorageMockImpl());
    }
    return this.storages.get(id)!;
  }

  clear(id?: string): void {
    if (id) {
      this.storages.delete(id);
    } else {
      this.storages.clear();
    }
  }
}

class DurableObjectStorageMockImpl implements DurableObjectStorageMock {
  private data = new Map<string, unknown>();
  private alarm: Date | null = null;

  async get<T>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.data.delete(key);
  }

  async list(options?: { start?: string; startAfter?: string; end?: string; limit?: number; reverse?: boolean }): Promise<string[]> {
    let keys = Array.from(this.data.keys());

    if (options?.start) {
      keys = keys.filter(k => k >= options.start!);
    }

    if (options?.end) {
      keys = keys.filter(k => k <= options.end);
    }

    if (options?.reverse) {
      keys.reverse();
    }

    if (options?.limit) {
      keys = keys.slice(0, options.limit);
    }

    return keys;
  }

  async getAlarm(): Promise<Date | null> {
    return this.alarm;
  }

  async setAlarm(time: Date | number): Promise<void> {
    this.alarm = typeof time === 'number' ? new Date(time) : time;
  }

  async deleteAlarm(): Promise<void> {
    this.alarm = null;
  }

  async transaction<T>(closure: (txn: DurableObjectStorageTransaction) => Promise<T>): Promise<T> {
    const txn = {
      get: async (key: string) => this.data.get(key),
      put: async (key: string, value: unknown) => this.data.set(key, value),
      delete: async (key: string) => this.data.delete(key),
      list: async (options?: any) => this.list(options),
      rollback: async () => {
        // Mock rollback - in real implementation would undo changes
      },
    } as DurableObjectStorageTransaction;

    return await closure(txn);
  }
}

// ============================================================================
// Timer Mocking
// ============================================================================

export class TimerMock {
  private now = Date.now();
  private timeouts = new Set<NodeJS.Timeout>();
  private intervals = new Set<NodeJS.Timeout>();
  private immediates = new Set<NodeJS.Immediate>();
  private timers: Array<{ time: number; fn: () => void; type: 'timeout' | 'interval' | 'immediate' }> = [];

  install(): void {
    this.originalSetTimeout = global.setTimeout;
    this.originalClearTimeout = global.clearTimeout;
    this.originalSetInterval = global.setInterval;
    this.originalClearInterval = global.clearInterval;
    this.originalSetImmediate = global.setImmediate;
    this.originalClearImmediate = global.clearImmediate;
    this.originalDate = global.Date;

    global.setTimeout = this.setTimeout.bind(this) as any;
    global.clearTimeout = this.clearTimeout.bind(this);
    global.setInterval = this.setInterval.bind(this) as any;
    global.clearInterval = this.clearInterval.bind(this);
    global.setImmediate = this.setImmediate.bind(this) as any;
    global.clearImmediate = this.clearImmediate.bind(this);
    global.Date = this.createMockDate() as any;
  }

  uninstall(): void {
    global.setTimeout = this.originalSetTimeout;
    global.clearTimeout = this.originalClearTimeout;
    global.setInterval = this.originalSetInterval;
    global.clearInterval = this.originalClearInterval;
    global.setImmediate = this.originalSetImmediate;
    global.clearImmediate = this.originalClearImmediate;
    global.Date = this.originalDate;
  }

  private originalSetTimeout: typeof setTimeout = setTimeout.bind(global);
  private originalClearTimeout: typeof clearTimeout = clearTimeout.bind(global);
  private originalSetInterval: typeof setInterval = setInterval.bind(global);
  private originalClearInterval: typeof clearInterval = clearInterval.bind(global);
  private originalSetImmediate: typeof setImmediate = setImmediate.bind(global);
  private originalClearImmediate: typeof clearImmediate = clearImmediate.bind(global);
  private originalDate = Date;

  private setTimeout(fn: () => void, delay?: number, ...args: unknown[]): NodeJS.Timeout {
    const timeout = {} as NodeJS.Timeout;
    this.timeouts.add(timeout);
    this.timers.push({
      time: this.now + (delay || 0),
      fn: () => fn(...args),
      type: 'timeout',
    });
    return timeout;
  }

  private clearTimeout(timeout: NodeJS.Timeout): void {
    this.timeouts.delete(timeout);
  }

  private setInterval(fn: () => void, delay?: number, ...args: unknown[]): NodeJS.Timeout {
    const interval = {} as NodeJS.Timeout;
    this.intervals.add(interval);
    this.timers.push({
      time: this.now + (delay || 0),
      fn: () => fn(...args),
      type: 'interval',
    });
    return interval;
  }

  private clearInterval(interval: NodeJS.Timeout): void {
    this.intervals.delete(interval);
  }

  private setImmediate(fn: () => void, ...args: unknown[]): NodeJS.Immediate {
    const immediate = {} as NodeJS.Immediate;
    this.immediates.add(immediate);
    this.timers.push({
      time: this.now,
      fn: () => fn(...args),
      type: 'immediate',
    });
    return immediate;
  }

  private clearImmediate(immediate: NodeJS.Immediate): void {
    this.immediates.delete(immediate);
  }

  tick(ms: number): void {
    const targetTime = this.now + ms;
    this.now = targetTime;

    while (true) {
      const nextTimer = this.timers
        .filter(t => t.time <= targetTime)
        .sort((a, b) => a.time - b.time)[0];

      if (!nextTimer) break;

      this.timers = this.timers.filter(t => t !== nextTimer);
      nextTimer.fn();

      if (nextTimer.type === 'interval') {
        this.timers.push({
          ...nextTimer,
          time: this.now + (nextTimer.time - this.now),
        });
      }
    }
  }

  runAll(): void {
    while (this.timers.length > 0) {
      const nextTimer = this.timers.sort((a, b) => a.time - b.time)[0];
      this.now = nextTimer.time;
      this.timers = this.timers.filter(t => t !== nextTimer);
      nextTimer.fn();
    }
  }

  runOnlyPendingTimers(): void {
    const now = this.now;
    while (this.timers.length > 0) {
      const nextTimer = this.timers.sort((a, b) => a.time - b.time)[0];
      if (nextTimer.time > now) break;
      this.timers = this.timers.filter(t => t !== nextTimer);
      nextTimer.fn();
    }
  }

  advanceTimersByTime(msToRun: number): void {
    this.tick(msToRun);
  }

  advanceTimersToTime(timerId: number): void {
    const timer = this.timers.find(t => t.time === timerId);
    if (timer) {
      const diff = timer.time - this.now;
      this.tick(diff);
    }
  }

  clearAllTimers(): void {
    this.timers = [];
    this.timeouts.clear();
    this.intervals.clear();
    this.immediates.clear();
  }

  getTimerCount(): number {
    return this.timers.length;
  }

  private createMockDate(): DateConstructor {
    const self = this;
    return class extends Date {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(self.now);
        } else {
          super(...(args as [number]));
        }
      }

      static now() {
        return self.now;
      }

      getValueOf() {
        return self.now;
      }
    } as unknown as DateConstructor;
  }
}

// ============================================================================
// HTTP Mocking
// ============================================================================

export interface HTTPMockOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | ArrayBuffer;
  status?: number;
  statusText?: string;
  delay?: number;
}

export class HTTPMock {
  private mocks = new Map<string, Map<string, HTTPMockOptions>>();

  mock(url: string, options: HTTPMockOptions = {}): void {
    const method = options.method?.toUpperCase() || 'GET';
    if (!this.mocks.has(url)) {
      this.mocks.set(url, new Map());
    }
    this.mocks.get(url)!.set(method, options);
  }

  unmock(url: string, method?: string): void {
    if (method) {
      this.mocks.get(url)?.delete(method.toUpperCase());
    } else {
      this.mocks.delete(url);
    }
  }

  async fetch(url: string, init?: RequestInit): Promise<Response> {
    const urlObj = new URL(url);
    const method = init?.method?.toUpperCase() || 'GET';

    const mock = this.mocks.get(urlObj.pathname)?.get(method);
    if (!mock) {
      throw new Error(`No mock found for ${method} ${url}`);
    }

    if (mock.delay) {
      await new Promise(resolve => setTimeout(resolve, mock.delay));
    }

    return new Response(mock.body, {
      status: mock.status || 200,
      statusText: mock.statusText || 'OK',
      headers: mock.headers || {},
    });
  }

  clearAll(): void {
    this.mocks.clear();
  }
}

// ============================================================================
// Factory exports
// ============================================================================

export const mockFactory = new MockFactory();
export const moduleMockFactory = new ModuleMockFactory();
export const kvMockFactory = new KVNamespaceMockFactory();
export const r2MockFactory = new R2BucketMockFactory();
export const d1MockFactory = new D1DatabaseMockFactory();
export const durableObjectMockFactory = new DurableObjectMockFactory();
export const timerMock = new TimerMock();
export const httpMock = new HTTPMock();

// Convenience functions
export function mock<T extends (...args: unknown[]) => unknown>(implementation?: T): MockFunction<T> {
  return mockFactory.fn(implementation);
}

export function spyOn<T extends object, K extends keyof T>(obj: T, method: K): MockFunction<any> {
  return mockFactory.spyOn(obj, method);
}

export function mockKV(): KVNamespaceMock {
  return kvMockFactory.create();
}

export function mockR2(): R2BucketMock {
  return r2MockFactory.create();
}

export function mockD1(): D1DatabaseMock {
  return d1MockFactory.create();
}

export function mockDurableObject(id: string): DurableObjectMock {
  return durableObjectMockFactory.create(id);
}

export function useFakeTimers(): TimerMock {
  timerMock.install();
  return timerMock;
}

export function useRealTimers(): void {
  timerMock.uninstall();
}
