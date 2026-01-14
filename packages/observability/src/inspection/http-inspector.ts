/**
 * HTTP request/response inspection
 */

import { v4 as uuidv4 } from 'uuid';
import {
  RequestInspection,
  ResponseInspection,
  RequestResponsePair,
  InspectionFilter,
  TimingInfo,
} from '../types';

export interface InspectorOptions {
  recordHeaders?: boolean;
  recordBody?: boolean;
  maxBodySize?: number;
  maskSensitiveHeaders?: string[];
}

export class HTTPInspector {
  private requests: Map<string, RequestInspection> = new Map();
  private responses: Map<string, ResponseInspection> = new Map();
  private pairs: RequestResponsePair[] = [];
  private maxEntries: number = 1000;

  constructor(private options: InspectorOptions = {}) {
    this.options = {
      recordHeaders: options.recordHeaders ?? true,
      recordBody: options.recordBody ?? true,
      maxBodySize: options.maxBodySize || 102400, // 100KB default
      maskSensitiveHeaders: options.maskSensitiveHeaders || [
        'authorization',
        'cookie',
        'set-cookie',
        'x-api-key',
      ],
    };
  }

  /**
   * Intercept and record a fetch request
   */
  interceptFetch(): void {
    const originalFetch = window.fetch;
    const self = this;

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const requestId = uuidv4();
      const startTime = performance.now();

      // Extract request info
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method || (typeof input === 'object' && 'method' in input ? input.method : 'GET');

      // Record request
      self.recordRequest({
        id: requestId,
        timestamp: Date.now(),
        method: method.toUpperCase(),
        url,
        headers: init?.headers ? self.recordHeaders(init.headers) : {},
        query: self.extractQuery(url),
        cookies: self.extractCookies(),
        body: self.options.recordBody ? self.sanitizeBody(init?.body) : undefined,
      });

      try {
        // Execute original fetch
        const response = await originalFetch(input, init);
        const endTime = performance.now();

        // Record response
        self.recordResponse({
          id: uuidv4(),
          requestId,
          timestamp: Date.now(),
          status: response.status,
          statusText: response.statusText,
          headers: self.recordHeaders(response.headers),
          body: self.options.recordBody ? await self.captureBody(response) : undefined,
          timing: {
            startTime,
            endTime,
            duration: endTime - startTime,
          },
        });

        return response;
      } catch (error) {
        const endTime = performance.now();

        // Record error response
        self.recordResponse({
          id: uuidv4(),
          requestId,
          timestamp: Date.now(),
          status: 0,
          statusText: (error as Error).message,
          headers: {},
          timing: {
            startTime,
            endTime,
            duration: endTime - startTime,
          },
        });

        throw error;
      }
    };
  }

  /**
   * Record a request
   */
  recordRequest(request: Partial<RequestInspection> & { id: string }): void {
    const fullRequest: RequestInspection = {
      id: request.id,
      timestamp: request.timestamp || Date.now(),
      method: request.method || 'GET',
      url: request.url || '',
      headers: this.maskSensitiveHeaders(request.headers || {}),
      query: request.query || {},
      cookies: request.cookies || {},
      body: request.body,
    };

    this.requests.set(fullRequest.id, fullRequest);

    // Enforce max entries
    if (this.requests.size > this.maxEntries) {
      const firstKey = this.requests.keys().next().value;
      this.requests.delete(firstKey);
    }
  }

  /**
   * Record a response
   */
  recordResponse(response: Partial<ResponseInspection> & { id: string; requestId: string }): void {
    const fullResponse: ResponseInspection = {
      id: response.id,
      requestId: response.requestId,
      timestamp: response.timestamp || Date.now(),
      status: response.status || 0,
      statusText: response.statusText || '',
      headers: this.maskSensitiveHeaders(response.headers || {}),
      body: response.body,
      timing: response.timing || {
        startTime: 0,
        endTime: 0,
        duration: 0,
      },
    };

    this.responses.set(fullResponse.id, fullResponse);

    // Create request/response pair
    const request = this.requests.get(fullResponse.requestId);
    if (request) {
      this.pairs.push({
        request,
        response: fullResponse,
      });

      // Enforce max entries
      if (this.pairs.length > this.maxEntries) {
        this.pairs.shift();
      }
    }

    // Enforce max entries
    if (this.responses.size > this.maxEntries) {
      const firstKey = this.responses.keys().next().value;
      this.responses.delete(firstKey);
    }
  }

  /**
   * Record headers from Headers object
   */
  private recordHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};

    if (this.options.recordHeaders) {
      headers.forEach((value, key) => {
        result[key] = value;
      });
    }

    return result;
  }

  /**
   * Record headers from plain object
   */
  private recordHeadersFromObject(headers: HeadersInit): Record<string, string> {
    const result: Record<string, string> = {};

    if (this.options.recordHeaders) {
      if (headers instanceof Headers) {
        headers.forEach((value, key) => {
          result[key] = value;
        });
      } else if (Array.isArray(headers)) {
        for (const [key, value] of headers) {
          result[key] = value as string;
        }
      } else {
        Object.assign(result, headers);
      }
    }

    return result;
  }

  /**
   * Mask sensitive headers
   */
  private maskSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
    const masked = { ...headers };

    for (const key of Object.keys(masked)) {
      if (this.options.maskSensitiveHeaders!.includes(key.toLowerCase())) {
        masked[key] = '***MASKED***';
      }
    }

    return masked;
  }

  /**
   * Extract query parameters from URL
   */
  private extractQuery(url: string): Record<string, string> {
    try {
      const urlObj = new URL(url);
      const query: Record<string, string> = {};

      urlObj.searchParams.forEach((value, key) => {
        query[key] = value;
      });

      return query;
    } catch {
      return {};
    }
  }

  /**
   * Extract cookies from document
   */
  private extractCookies(): Record<string, string> {
    if (typeof document === 'undefined') {
      return {};
    }

    const cookies: Record<string, string> = {};

    if (document.cookie) {
      document.cookie.split(';').forEach((cookie) => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
          cookies[name] = decodeURIComponent(value);
        }
      });
    }

    return cookies;
  }

  /**
   * Sanitize request body
   */
  private sanitizeBody(body: BodyInit | null | undefined): any {
    if (!body || !this.options.recordBody) {
      return undefined;
    }

    try {
      if (typeof body === 'string') {
        if (body.length > this.options.maxBodySize!) {
          return `[Body too large: ${body.length} bytes]`;
        }

        // Try to parse as JSON
        try {
          return JSON.parse(body);
        } catch {
          return body;
        }
      }

      // For other body types, return a placeholder
      return '[Body data]';
    } catch {
      return '[Error reading body]';
    }
  }

  /**
   * Capture response body
   */
  private async captureBody(response: Response): Promise<any> {
    try {
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const text = await response.text();
        if (text.length > this.options.maxBodySize!) {
          return `[Body too large: ${text.length} bytes]`;
        }
        return JSON.parse(text);
      } else if (contentType.includes('text/')) {
        const text = await response.text();
        if (text.length > this.options.maxBodySize!) {
          return `[Body too large: ${text.length} bytes]`;
        }
        return text;
      } else {
        return '[Binary or unsupported content type]';
      }
    } catch {
      return '[Error reading body]';
    }
  }

  /**
   * Get all request/response pairs
   */
  getPairs(): RequestResponsePair[] {
    return [...this.pairs];
  }

  /**
   * Filter pairs by criteria
   */
  filterPairs(filter: InspectionFilter): RequestResponsePair[] {
    return this.pairs.filter((pair) => {
      if (filter.startTime && pair.request.timestamp < filter.startTime) {
        return false;
      }
      if (filter.endTime && pair.request.timestamp > filter.endTime) {
        return false;
      }
      if (filter.method && pair.request.method !== filter.method) {
        return false;
      }
      if (filter.url && !pair.request.url.includes(filter.url)) {
        return false;
      }
      if (filter.minStatus && pair.response.status < filter.minStatus) {
        return false;
      }
      if (filter.maxStatus && pair.response.status > filter.maxStatus) {
        return false;
      }
      if (filter.traceId && pair.request.traceId !== filter.traceId) {
        return false;
      }
      if (filter.hasError && pair.response.status >= 400) {
        return true;
      }
      if (filter.hasError === false && pair.response.status >= 400) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get a specific pair by request ID
   */
  getPairByRequestId(requestId: string): RequestResponsePair | undefined {
    return this.pairs.find((pair) => pair.request.id === requestId);
  }

  /**
   * Get a specific pair by trace ID
   */
  getPairsByTraceId(traceId: string): RequestResponsePair[] {
    return this.pairs.filter((pair) => pair.request.traceId === traceId);
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalRequests: number;
    totalResponses: number;
    totalPairs: number;
    avgResponseTime: number;
    errorRate: number;
    statusDistribution: Record<number, number>;
    methodDistribution: Record<string, number>;
  } {
    if (this.pairs.length === 0) {
      return {
        totalRequests: this.requests.size,
        totalResponses: this.responses.size,
        totalPairs: 0,
        avgResponseTime: 0,
        errorRate: 0,
        statusDistribution: {},
        methodDistribution: {},
      };
    }

    const totalDuration = this.pairs.reduce(
      (sum, pair) => sum + pair.response.timing.duration,
      0
    );
    const errorCount = this.pairs.filter((pair) => pair.response.status >= 400).length;

    const statusDistribution: Record<number, number> = {};
    const methodDistribution: Record<string, number> = {};

    for (const pair of this.pairs) {
      statusDistribution[pair.response.status] =
        (statusDistribution[pair.response.status] || 0) + 1;
      methodDistribution[pair.request.method] =
        (methodDistribution[pair.request.method] || 0) + 1;
    }

    return {
      totalRequests: this.requests.size,
      totalResponses: this.responses.size,
      totalPairs: this.pairs.length,
      avgResponseTime: totalDuration / this.pairs.length,
      errorRate: errorCount / this.pairs.length,
      statusDistribution,
      methodDistribution,
    };
  }

  /**
   * Clear all recorded data
   */
  clear(): void {
    this.requests.clear();
    this.responses.clear();
    this.pairs = [];
  }

  /**
   * Export pairs as JSON
   */
  exportAsJSON(pairs?: RequestResponsePair[]): string {
    const data = pairs || this.pairs;
    return JSON.stringify(
      {
        format: 'http-inspection',
        version: '1.0.0',
        timestamp: Date.now(),
        count: data.length,
        pairs: data,
      },
      null,
      2
    );
  }

  /**
   * Create HAR (HTTP Archive) format export
   */
  exportAsHAR(pairs?: RequestResponsePair[]): string {
    const data = pairs || this.pairs;

    const har = {
      log: {
        version: '1.2',
        creator: {
          name: 'ClaudeFlare Observability',
          version: '1.0.0',
        },
        entries: data.map((pair) => ({
          startedDateTime: new Date(pair.request.timestamp).toISOString(),
          time: pair.response.timing.duration,
          request: {
            method: pair.request.method,
            url: pair.request.url,
            httpVersion: 'HTTP/1.1',
            headers: Object.entries(pair.request.headers).map(([name, value]) => ({
              name,
              value,
            })),
            queryString: Object.entries(pair.request.query).map(([name, value]) => ({
              name,
              value,
            })),
            headersSize: -1,
            bodySize: -1,
          },
          response: {
            status: pair.response.status,
            statusText: pair.response.statusText,
            httpVersion: 'HTTP/1.1',
            headers: Object.entries(pair.response.headers).map(([name, value]) => ({
              name,
              value,
            })),
            content: {
              size: -1,
              mimeType: pair.response.headers['content-type'] || '',
              text: pair.response.body
                ? typeof pair.response.body === 'string'
                  ? pair.response.body
                  : JSON.stringify(pair.response.body)
                : '',
            },
            redirectURL: '',
            headersSize: -1,
            bodySize: -1,
          },
          cache: {},
          timings: {
            send: 0,
            wait: pair.response.timing.duration,
            receive: 0,
          },
        })),
      },
    };

    return JSON.stringify(har, null, 2);
  }
}
