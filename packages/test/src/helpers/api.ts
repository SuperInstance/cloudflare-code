/**
 * API Test Helpers
 *
 * Helper functions for testing API endpoints with request/response recording
 */

import { Hono } from 'hono';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HTTPTestClient } from '../e2e/framework';

/**
 * API test configuration
 */
export interface APITestConfig {
  app: Hono;
  baseUrl?: string;
  recordRequests?: boolean;
  recordResponses?: boolean;
  timeout?: number;
}

/**
 * API test result
 */
export interface APITestResult {
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    body: any;
  };
  duration: number;
  success: boolean;
  error?: string;
}

/**
 * API test suite builder
 */
export class APITestSuite {
  private client: HTTPTestClient;
  private results: APITestResult[] = [];
  private recordRequests: boolean;
  private recordResponses: boolean;

  constructor(config: APITestConfig) {
    const { app, baseUrl = '', recordRequests = true, recordResponses = true } = config;

    const recorder = {
      requests: [],
      responses: [],
      start: () => {},
      stop: () => {},
      clear: () => {
        this.recorder = { requests: [], responses: [] };
      },
      getHistory: () => ({}),
      export: () => '',
    };

    this.client = new HTTPTestClient(app, {
      baseUrl,
      recorder: recordRequests || recordResponses ? recorder : undefined,
    });
    this.recordRequests = recordRequests;
    this.recordResponses = recordResponses;
  }

  private recorder: any = {
    requests: [],
    responses: [],
  };

  /**
   * Make HTTP request
   */
  async request(
    method: string,
    path: string,
    options: {
      headers?: Record<string, string>;
      body?: any;
      query?: Record<string, string>;
      expectedStatus?: number;
    } = {}
  ): Promise<APITestResult> {
    const { headers = {}, body, query, expectedStatus } = options;
    const startTime = Date.now();

    try {
      const response = await this.client.request(method, path, {
        headers,
        body,
        query,
      });

      const duration = Date.now() - startTime;
      const success = expectedStatus ? response.status === expectedStatus : response.status >= 200 && response.status < 300;

      const result: APITestResult = {
        request: {
          method,
          url: path,
          headers,
          body,
        },
        response: {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: response.data,
        },
        duration,
        success,
      };

      if (this.recordRequests || this.recordResponses) {
        this.results.push(result);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const result: APITestResult = {
        request: {
          method,
          url: path,
          headers,
          body,
        },
        response: {
          status: 0,
          headers: {},
          body: null,
        },
        duration,
        success: false,
        error: (error as Error).message,
      };

      if (this.recordRequests || this.recordResponses) {
        this.results.push(result);
      }

      return result;
    }
  }

  /**
   * GET request
   */
  async get(path: string, options?: {
    headers?: Record<string, string>;
    query?: Record<string, string>;
    expectedStatus?: number;
  }): Promise<APITestResult> {
    return this.request('GET', path, options);
  }

  /**
   * POST request
   */
  async post(path: string, options: {
    body?: any;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    expectedStatus?: number;
  }): Promise<APITestResult> {
    return this.request('POST', path, options);
  }

  /**
   * PUT request
   */
  async put(path: string, options: {
    body?: any;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    expectedStatus?: number;
  }): Promise<APITestResult> {
    return this.request('PUT', path, options);
  }

  /**
   * PATCH request
   */
  async patch(path: string, options: {
    body?: any;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    expectedStatus?: number;
  }): Promise<APITestResult> {
    return this.request('PATCH', path, options);
  }

  /**
   * DELETE request
   */
  async delete(path: string, options?: {
    headers?: Record<string, string>;
    query?: Record<string, string>;
    expectedStatus?: number;
  }): Promise<APITestResult> {
    return this.request('DELETE', path, options);
  }

  /**
   * Get all results
   */
  getResults(): APITestResult[] {
    return [...this.results];
  }

  /**
   * Clear results
   */
  clearResults(): void {
    this.results = [];
    this.recorder = { requests: [], responses: [] };
  }

  /**
   * Get request history
   */
  getRequestHistory() {
    return this.recorder.requests;
  }

  /**
   * Get response history
   */
  getResponseHistory() {
    return this.recorder.responses;
  }

  /**
   * Export results as JSON
   */
  exportResults(): string {
    return JSON.stringify(this.results, null, 2);
  }

  /**
   * Export results as HAR
   */
  exportAsHAR(): string {
    return JSON.stringify({
      log: {
        version: '1.2',
        creator: { name: 'ClaudeFlare API Test Suite', version: '1.0.0' },
        entries: this.results.map((result) => ({
          startedDateTime: new Date(Date.now() - result.duration).toISOString(),
          request: {
            method: result.request.method,
            url: result.request.url,
            headers: Object.entries(result.request.headers).map(([name, value]) => ({ name, value })),
            postData: result.request.body ? { mimeType: 'application/json', text: JSON.stringify(result.request.body) } : undefined,
          },
          response: {
            status: result.response.status,
            headers: Object.entries(result.response.headers).map(([name, value]) => ({ name, value })),
            content: result.response.body ? { mimeType: 'application/json', text: JSON.stringify(result.response.body) } : undefined,
          },
          timings: { send: 0, wait: result.duration, receive: 0 },
        })),
      },
    }, null, 2);
  }

  /**
   * Calculate statistics
   */
  getStatistics() {
    const successful = this.results.filter((r) => r.success);
    const failed = this.results.filter((r) => !r.success);
    const durations = this.results.map((r) => r.duration);

    return {
      total: this.results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: this.results.length > 0 ? (successful.length / this.results.length) * 100 : 0,
      averageDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      statusCodes: this.getStatusCodes(),
    };
  }

  private getStatusCodes(): Record<number, number> {
    const codes: Record<number, number> = {};
    this.results.forEach((result) => {
      const status = result.response.status;
      codes[status] = (codes[status] || 0) + 1;
    });
    return codes;
  }
}

/**
 * Create API test suite
 */
export function createAPITestSuite(config: APITestConfig): APITestSuite {
  return new APITestSuite(config);
}

/**
 * API assertion helpers
 */
export class APIAssertions {
  static assertSuccess(result: APITestResult): void {
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  }

  static assertStatus(result: APITestResult, status: number): void {
    expect(result.response.status).toBe(status);
  }

  static assertHeader(result: APITestResult, name: string, value: string): void {
    expect(result.response.headers[name]).toBe(value);
  }

  static assertBody(result: APITestResult, body: any): void {
    expect(result.response.body).toEqual(body);
  }

  static assertBodyContains(result: APITestResult, key: string, value: any): void {
    expect(result.response.body).toHaveProperty(key, value);
  }

  static assertDuration(result: APITestResult, maxDuration: number): void {
    expect(result.duration).toBeLessThan(maxDuration);
  }

  static assertContentType(result: APITestResult, contentType: string): void {
    expect(result.response.headers['content-type']).toContain(contentType);
  }

  static assertJSON(result: APITestResult): void {
    expect(result.response.headers['content-type']).toContain('application/json');
  }

  static assertError(result: APITestResult, errorCode: string): void {
    expect(result.success).toBe(false);
    expect(result.response.body).toHaveProperty('error');
    expect(result.response.body.error).toHaveProperty('code', errorCode);
  }

  static assertValidationError(result: APITestResult): void {
    this.assertError(result, 'VALIDATION_ERROR');
    this.assertStatus(result, 400);
  }

  static assertUnauthorized(result: APITestResult): void {
    this.assertError(result, 'UNAUTHORIZED');
    this.assertStatus(result, 401);
  }

  static assertNotFound(result: APITestResult): void {
    this.assertError(result, 'NOT_FOUND');
    this.assertStatus(result, 404);
  }

  static assertRateLimited(result: APITestResult): void {
    this.assertError(result, 'RATE_LIMIT_EXCEEDED');
    this.assertStatus(result, 429);
  }
}

/**
 * API endpoint test builder
 */
export function buildEndpointTestSuite(
  name: string,
  config: APITestConfig,
  tests: (suite: APITestSuite) => void
) {
  describe(name, () => {
    let suite: APITestSuite;

    beforeEach(() => {
      suite = createAPITestSuite(config);
    });

    afterEach(() => {
      // Log statistics
      const stats = suite.getStatistics();
      if (stats.total > 0) {
        console.log(`[API Stats] ${name}:`, stats);
      }
    });

    tests(suite);
  });
}

/**
 * Load test helper
 */
export async function loadTestEndpoint(
  suite: APITestSuite,
  config: {
    method: string;
    path: string;
    requestsPerSecond: number;
    duration: number;
    concurrency?: number;
    options?: {
      headers?: Record<string, string>;
      body?: any;
      query?: Record<string, string>;
    };
  }
): Promise<{
  results: APITestResult[];
  statistics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    requestsPerSecond: number;
    averageLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
  };
}> {
  const { method, path, requestsPerSecond, duration, concurrency = 10, options = {} } = config;
  const results: APITestResult[] = [];
  const interval = 1000 / requestsPerSecond;
  const startTime = Date.now();
  const endTime = startTime + duration;

  let requestCount = 0;

  while (Date.now() < endTime) {
    const batchStart = Date.now();
    const batchPromises: Promise<void>[] = [];

    for (let i = 0; i < concurrency && Date.now() < endTime; i++) {
      const promise = suite
        .request(method, path, options)
        .then((result) => {
          results.push(result);
          requestCount++;
        })
        .catch((error) => {
          results.push({
            request: { method, url: path, headers: options.headers || {}, body: options.body },
            response: { status: 0, headers: {}, body: null },
            duration: 0,
            success: false,
            error: error.message,
          });
        });

      batchPromises.push(promise);
    }

    await Promise.all(batchPromises);

    // Maintain request rate
    const batchDuration = Date.now() - batchStart;
    if (batchDuration < interval * concurrency) {
      await new Promise((resolve) => setTimeout(resolve, interval * concurrency - batchDuration));
    }
  }

  // Calculate statistics
  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const latencies = results.map((r) => r.duration).sort((a, b) => a - b);

  return {
    results,
    statistics: {
      totalRequests: results.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      requestsPerSecond: results.length / (duration / 1000),
      averageLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p50Latency: latencies[Math.floor(latencies.length * 0.5)],
      p95Latency: latencies[Math.floor(latencies.length * 0.95)],
      p99Latency: latencies[Math.floor(latencies.length * 0.99)],
    },
  };
}
