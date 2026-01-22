/**
 * E2E Test Framework
 *
 * Comprehensive testing framework for Cloudflare Workers with:
 * - Isolated DO instances
 * - KV/R2/D1 fixture management
 * - Request/response recording
 * - Snapshot testing
 * - Parallel test execution
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Env } from '@claudeflare/edge';
import { Hono } from 'hono';
import { getTestContext, cleanupTestContext, generateTestId, wait } from './setup';

/**
 * Test recorder for request/response logging
 */
export interface TestRecorder {
  requests: RecordedRequest[];
  responses: RecordedResponse[];
  start(): void;
  stop(): void;
  clear(): void;
  getHistory(): TestHistory;
  export(format?: 'json' | 'har'): string;
}

export interface RecordedRequest {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
}

export interface RecordedResponse {
  id: string;
  requestId: string;
  timestamp: number;
  status: number;
  headers: Record<string, string>;
  body?: any;
  duration: number;
}

export interface TestHistory {
  requests: RecordedRequest[];
  responses: RecordedResponse[];
  duration: number;
}

/**
 * Create test recorder
 */
export function createTestRecorder(): TestRecorder {
  const requests: RecordedRequest[] = [];
  const responses: RecordedResponse[] = [];
  let startTime = 0;
  let recording = false;

  return {
    get requests() {
      return requests;
    },
    get responses() {
      return responses;
    },

    start() {
      recording = true;
      startTime = Date.now();
    },

    stop() {
      recording = false;
    },

    clear() {
      requests.length = 0;
      responses.length = 0;
      startTime = 0;
    },

    getHistory(): TestHistory {
      return {
        requests: [...requests],
        responses: [...responses],
        duration: startTime ? Date.now() - startTime : 0,
      };
    },

    export(format: 'json' | 'har' = 'json'): string {
      if (format === 'json') {
        return JSON.stringify(this.getHistory(), null, 2);
      }

      // HAR format
      return JSON.stringify(
        {
          log: {
            version: '1.2',
            creator: { name: 'ClaudeFlare E2E Framework', version: '1.0.0' },
            entries: requests.map((req, i) => ({
              startedDateTime: new Date(req.timestamp).toISOString(),
              request: {
                method: req.method,
                url: req.url,
                headers: Object.entries(req.headers).map(([name, value]) => ({
                  name,
                  value,
                })),
                postData: req.body ? { mimeType: 'application/json', text: JSON.stringify(req.body) } : undefined,
              },
              response: responses[i]
                ? {
                    status: responses[i].status,
                    headers: Object.entries(responses[i].headers).map(([name, value]) => ({
                      name,
                      value,
                    })),
                    content: responses[i].body ? { mimeType: 'application/json', text: JSON.stringify(responses[i].body) } : undefined,
                  }
                : undefined,
              timings: { send: 0, wait: 0, receive: responses[i]?.duration || 0 },
            })),
          },
        },
        null,
        2
      );
    },
  };
}

/**
 * Snapshot manager for AI responses
 */
export class SnapshotManager {
  private snapshots: Map<string, any> = new Map();
  private baseline: Map<string, any> = new Map();
  private readonly snapshotDir: string;

  constructor(snapshotDir: string = './snapshots') {
    this.snapshotDir = snapshotDir;
  }

  /**
   * Capture snapshot
   */
  capture(name: string, data: any, metadata?: any): void {
    this.snapshots.set(name, {
      data,
      metadata: {
        timestamp: Date.now(),
        ...metadata,
      },
    });
  }

  /**
   * Compare with baseline
   */
  async compare(name: string, data: any, options: {
    ignoreFields?: string[];
    tolerance?: number;
  } = {}): Promise<{
    matches: boolean;
    diff?: any;
    error?: string;
  }> {
    const { ignoreFields = [], tolerance = 0 } = options;

    const baseline = this.baseline.get(name);
    if (!baseline) {
      return {
        matches: false,
        error: `No baseline found for snapshot: ${name}`,
      };
    }

    try {
      const diff = this.deepDiff(baseline, data, ignoreFields);
      const matches = this.matchesTolerance(diff, tolerance);

      return { matches, diff: matches ? undefined : diff };
    } catch (error) {
      return {
        matches: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Save baseline
   */
  saveBaseline(name: string): void {
    const snapshot = this.snapshots.get(name);
    if (snapshot) {
      this.baseline.set(name, snapshot);
    }
  }

  /**
   * Load baseline
   */
  loadBaseline(name: string): any | undefined {
    return this.baseline.get(name);
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): Map<string, any> {
    return new Map(this.snapshots);
  }

  /**
   * Clear all snapshots
   */
  clear(): void {
    this.snapshots.clear();
  }

  /**
   * Deep diff two objects
   */
  private deepDiff(obj1: any, obj2: any, ignoreFields: string[]): any {
    if (obj1 === obj2) return null;

    if (typeof obj1 !== typeof obj2) {
      return { type: 'type-mismatch', value1: obj1, value2: obj2 };
    }

    if (typeof obj1 !== 'object' || obj1 === null) {
      return obj1 !== obj2 ? { type: 'value-mismatch', value1: obj1, value2: obj2 } : null;
    }

    const keys1 = Object.keys(obj1).filter((k) => !ignoreFields.includes(k));
    const keys2 = Object.keys(obj2).filter((k) => !ignoreFields.includes(k));

    if (keys1.length !== keys2.length) {
      return { type: 'keys-mismatch', keys1, keys2 };
    }

    const diff: any = {};
    let hasDiff = false;

    for (const key of keys1) {
      if (!keys2.includes(key)) {
        diff[key] = { type: 'missing-in-obj2', value: obj1[key] };
        hasDiff = true;
        continue;
      }

      const keyDiff = this.deepDiff(obj1[key], obj2[key], ignoreFields);
      if (keyDiff) {
        diff[key] = keyDiff;
        hasDiff = true;
      }
    }

    return hasDiff ? diff : null;
  }

  /**
   * Check if diff matches tolerance
   */
  private matchesTolerance(diff: any, tolerance: number): boolean {
    if (!diff) return true;

    if (diff.type === 'value-mismatch' && typeof diff.value1 === 'number' && typeof diff.value2 === 'number') {
      return Math.abs(diff.value1 - diff.value2) <= tolerance;
    }

    for (const key of Object.keys(diff)) {
      if (!this.matchesTolerance(diff[key], tolerance)) {
        return false;
      }
    }

    return true;
  }
}

/**
 * E2E test suite builder
 */
export interface E2ETestSuiteOptions {
  name: string;
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
  beforeAll?: () => Promise<void>;
  afterAll?: () => Promise<void>;
  beforeEach?: () => Promise<void>;
  afterEach?: () => Promise<void>;
}

export function createE2ETestSuite(options: E2ETestSuiteOptions) {
  const { name, setup, teardown, beforeAll: beforeAllFn, afterAll: afterAllFn, beforeEach: beforeEachFn, afterEach: afterEachFn } = options;

  describe(name, () => {
    let recorder: TestRecorder;
    let snapshots: SnapshotManager;
    let testId: string;

    beforeAll(async () => {
      testId = generateTestId();
      recorder = createTestRecorder();
      snapshots = new SnapshotManager();

      if (beforeAllFn) {
        await beforeAllFn();
      }

      if (setup) {
        await setup();
      }
    });

    afterAll(async () => {
      if (afterAllFn) {
        await afterAllFn();
      }

      if (teardown) {
        await teardown();
      }

      await cleanupTestContext(testId);
    });

    beforeEach(async () => {
      recorder.clear();
      if (beforeEachFn) {
        await beforeEachFn();
      }
    });

    afterEach(async () => {
      if (afterEachFn) {
        await afterEachFn();
      }
    });

    return {
      testId,
      recorder,
      snapshots,
      test: (name: string, fn: () => Promise<void>) => {
        it(name, async () => {
          recorder.start();
          try {
            await fn();
          } finally {
            recorder.stop();
          }
        });
      },
      skip: (name: string, fn: () => Promise<void>) => {
        it.skip(name, fn);
      },
      only: (name: string, fn: () => Promise<void>) => {
        it.only(name, fn);
      },
    };
  });
}

/**
 * HTTP test helper
 */
export class HTTPTestClient {
  private app: Hono;
  private recorder?: TestRecorder;
  private baseUrl: string;

  constructor(app: Hono, options: {
    recorder?: TestRecorder;
    baseUrl?: string;
  } = {}) {
    this.app = app;
    this.recorder = options.recorder;
    this.baseUrl = options.baseUrl || '';
  }

  /**
   * Make HTTP request
   */
  async request(method: string, path: string, options: {
    headers?: Record<string, string>;
    body?: any;
    query?: Record<string, string>;
  } = {}): Promise<{
    status: number;
    headers: Headers;
    data: any;
  }> {
    const { headers = {}, body, query } = options;
    const url = new URL(path, this.baseUrl);

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const startTime = Date.now();
    const requestId = generateTestId();

    // Record request
    if (this.recorder) {
      this.recorder.requests.push({
        id: requestId,
        timestamp: startTime,
        method,
        url: url.toString(),
        headers,
        body,
      });
    }

    try {
      const response = await this.app.request(path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const duration = Date.now() - startTime;
      const responseData = await response.json().catch(() => response.text());

      // Record response
      if (this.recorder) {
        this.recorder.responses.push({
          id: generateTestId(),
          requestId,
          timestamp: Date.now(),
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseData,
          duration,
        });
      }

      return {
        status: response.status,
        headers: response.headers,
        data: responseData,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record error response
      if (this.recorder) {
        this.recorder.responses.push({
          id: generateTestId(),
          requestId,
          timestamp: Date.now(),
          status: 0,
          headers: {},
          body: { error: (error as Error).message },
          duration,
        });
      }

      throw error;
    }
  }

  get(path: string, options?: { headers?: Record<string, string>; query?: Record<string, string> }) {
    return this.request('GET', path, options);
  }

  post(path: string, options: { body?: any; headers?: Record<string, string>; query?: Record<string, string> }) {
    return this.request('POST', path, options);
  }

  put(path: string, options: { body?: any; headers?: Record<string, string>; query?: Record<string, string> }) {
    return this.request('PUT', path, options);
  }

  delete(path: string, options?: { headers?: Record<string, string>; query?: Record<string, string> }) {
    return this.request('DELETE', path, options);
  }

  patch(path: string, options: { body?: any; headers?: Record<string, string>; query?: Record<string, string> }) {
    return this.request('PATCH', path, options);
  }
}

/**
 * Performance test helper
 */
export interface PerformanceMetrics {
  min: number;
  max: number;
  avg: number;
  median: number;
  p95: number;
  p99: number;
  throughput: number;
  errorRate: number;
}

export async function measurePerformance(
  fn: () => Promise<void>,
  options: {
    iterations?: number;
    concurrency?: number;
    warmupIterations?: number;
  } = {}
): Promise<PerformanceMetrics> {
  const {
    iterations = 100,
    concurrency = 10,
    warmupIterations = 10,
  } = options;

  // Warmup
  for (let i = 0; i < warmupIterations; i++) {
    await fn();
  }

  const durations: number[] = [];
  const errors: number[] = [];
  const startTime = Date.now();

  // Run iterations with concurrency
  const batches = Math.ceil(iterations / concurrency);

  for (let batch = 0; batch < batches; batch++) {
    const batchStart = Date.now();
    const batchPromises = [];

    for (let i = 0; i < concurrency && batch * concurrency + i < iterations; i++) {
      const promise = fn()
        .then(() => {
          const duration = Date.now() - batchStart;
          durations.push(duration);
        })
        .catch((error) => {
          errors.push(1);
          throw error;
        });

      batchPromises.push(promise);
    }

    await Promise.allSettled(batchPromises);
  }

  const totalTime = Date.now() - startTime;

  // Calculate metrics
  const sorted = [...durations].sort((a, b) => a - b);
  const min = sorted[0] || 0;
  const max = sorted[sorted.length - 1] || 0;
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const median = sorted[Math.floor(sorted.length / 2)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
  const throughput = (iterations / totalTime) * 1000;
  const errorRate = errors.length / iterations;

  return {
    min,
    max,
    avg,
    median,
    p95,
    p99,
    throughput,
    errorRate,
  };
}

/**
 * Assertion helpers
 */
export class AssertionHelpers {
  static assertValidJSON(data: any): void {
    expect(() => JSON.parse(JSON.stringify(data))).not.toThrow();
  }

  static assertTimestamp(timestamp: number): void {
    expect(timestamp).toBeGreaterThan(Date.now() - 10000);
    expect(timestamp).toBeLessThanOrEqual(Date.now());
  }

  static assertUUID(id: string): void {
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  }

  static assertResponseStructure(response: any, requiredFields: string[]): void {
    expect(response).toBeInstanceOf(Object);
    requiredFields.forEach((field) => {
      expect(response).toHaveProperty(field);
    });
  }

  static assertErrorResponse(error: any, expectedCode: string): void {
    expect(error).toHaveProperty('error');
    expect(error.error).toHaveProperty('code', expectedCode);
    expect(error.error).toHaveProperty('message');
    expect(error.error).toHaveProperty('timestamp');
  }
}
