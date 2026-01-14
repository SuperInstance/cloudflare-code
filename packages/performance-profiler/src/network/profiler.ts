/**
 * Network Profiler - Network performance analysis
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  NetworkRequest,
  NetworkProfile,
  NetworkTiming,
  ProfilerEvent,
} from '../types';

export interface NetworkProfilerOptions {
  /**
   * Enable automatic request tracking
   */
  enabled?: boolean;

  /**
   * Maximum requests to track
   */
  maxRequests?: number;

  /**
   * Enable detailed timing breakdown
   */
  enableDetailedTiming?: boolean;

  /**
   * Filter requests by URL pattern
   */
  urlFilter?: RegExp[];

  /**
   * Filter by HTTP method
   */
  methodFilter?: string[];

  /**
   * Enable request/response body tracking
   */
  trackBodies?: boolean;

  /**
   * Maximum body size to track (bytes)
   */
  maxBodySize?: number;
}

export interface NetworkStatistics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  totalBytesTransferred: number;
  averageRequestSize: number;
  averageResponseSize: number;
  cacheHitRate: number;
  requestsPerSecond: number;
  errorsByStatus: Record<number, number>;
  slowestRequests: NetworkRequest[];
  largestRequests: NetworkRequest[];
}

export interface NetworkIssue {
  id: string;
  type: 'slow-request' | 'failed-request' | 'large-payload' | 'cache-miss' | 'timeout';
  severity: 'low' | 'medium' | 'high' | 'critical';
  request: NetworkRequest;
  description: string;
  suggestion: string;
}

/**
 * Network Profiler implementation
 */
export class NetworkProfiler extends EventEmitter {
  private requests: Map<string, NetworkRequest> = new Map();
  private activeRequests: Map<string, Partial<NetworkRequest>> = new Map();
  private options: Required<NetworkProfilerOptions>;
  private startTime: number = 0;

  constructor(options: NetworkProfilerOptions = {}) {
    super();
    this.options = {
      enabled: options.enabled ?? true,
      maxRequests: options.maxRequests ?? 10000,
      enableDetailedTiming: options.enableDetailedTiming ?? true,
      urlFilter: options.urlFilter ?? [],
      methodFilter: options.methodFilter ?? [],
      trackBodies: options.trackBodies ?? false,
      maxBodySize: options.maxBodySize ?? 1024 * 100, // 100KB
    };

    if (this.options.enabled) {
      this.setupGlobalInterceptors();
    }
  }

  /**
   * Start network profiling
   */
  public start(): void {
    if (!this.options.enabled) {
      throw new Error('Network profiler is disabled');
    }

    this.startTime = Date.now();
  }

  /**
   * Stop network profiling
   */
  public stop(): NetworkProfile {
    const profile = this.getProfile();
    this.requests.clear();
    this.activeRequests.clear();
    return profile;
  }

  /**
   * Get network profile
   */
  public getProfile(): NetworkProfile {
    const allRequests = Array.from(this.requests.values());

    return {
      requests: allRequests,
      totalBytes: allRequests.reduce((sum, r) => sum + r.requestSize + r.responseSize, 0),
      totalDuration: this.calculateTotalDuration(allRequests),
      averageLatency: this.calculateAverageLatency(allRequests),
      errorRate: this.calculateErrorRate(allRequests),
      cacheHitRate: this.calculateCacheHitRate(allRequests),
    };
  }

  /**
   * Get network statistics
   */
  public getStatistics(): NetworkStatistics {
    const allRequests = Array.from(this.requests.values());

    const successful = allRequests.filter((r) => r.status >= 200 && r.status < 400);
    const failed = allRequests.filter((r) => r.status >= 400);

    const latencies = allRequests.map((r) => r.duration);
    const averageLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;

    const errorsByStatus: Record<number, number> = {};
    for (const request of failed) {
      errorsByStatus[request.status] = (errorsByStatus[request.status] ?? 0) + 1;
    }

    const sortedByDuration = [...allRequests].sort((a, b) => b.duration - a.duration);
    const sortedBySize = [...allRequests].sort(
      (a, b) => b.responseSize - a.responseSize
    );

    const duration = Date.now() - this.startTime;
    const requestsPerSecond = duration > 0 ? (allRequests.length / duration) * 1000 : 0;

    return {
      totalRequests: allRequests.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      averageLatency,
      minLatency: latencies.length > 0 ? Math.min(...latencies) : 0,
      maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
      totalBytesTransferred: allRequests.reduce(
        (sum, r) => sum + r.requestSize + r.responseSize,
        0
      ),
      averageRequestSize:
        allRequests.length > 0
          ? allRequests.reduce((sum, r) => sum + r.requestSize, 0) / allRequests.length
          : 0,
      averageResponseSize:
        allRequests.length > 0
          ? allRequests.reduce((sum, r) => sum + r.responseSize, 0) / allRequests.length
          : 0,
      cacheHitRate: this.calculateCacheHitRate(allRequests),
      requestsPerSecond,
      errorsByStatus,
      slowestRequests: sortedByDuration.slice(0, 10),
      largestRequests: sortedBySize.slice(0, 10),
    };
  }

  /**
   * Identify network issues
   */
  public identifyIssues(): NetworkIssue[] {
    const issues: NetworkIssue[] = [];
    const stats = this.getStatistics();

    // Slow requests (>2x average)
    const slowThreshold = stats.averageLatency * 2;
    for (const request of this.requests.values()) {
      if (request.duration > slowThreshold && request.duration > 1000) {
        issues.push({
          id: uuidv4(),
          type: 'slow-request',
          severity: request.duration > 5000 ? 'critical' : 'high',
          request,
          description: `Request to ${request.url} took ${request.duration}ms, which is significantly above average`,
          suggestion: this.getSlowRequestSuggestion(request),
        });
      }
    }

    // Failed requests
    for (const request of this.requests.values()) {
      if (request.status >= 400) {
        issues.push({
          id: uuidv4(),
          type: 'failed-request',
          severity: request.status >= 500 ? 'critical' : 'medium',
          request,
          description: `Request to ${request.url} failed with status ${request.status}`,
          suggestion: this.getFailedRequestSuggestion(request),
        });
      }
    }

    // Large payloads
    const avgResponseSize = stats.averageResponseSize;
    for (const request of this.requests.values()) {
      if (request.responseSize > avgResponseSize * 3 && request.responseSize > 1024 * 100) {
        issues.push({
          id: uuidv4(),
          type: 'large-payload',
          severity: request.responseSize > 1024 * 1024 ? 'high' : 'medium',
          request,
          description: `Response from ${request.url} is ${this.formatBytes(request.responseSize)}`,
          suggestion: 'Consider implementing response compression, pagination, or field selection',
        });
      }
    }

    // Cache misses (if cache info available)
    const cacheMisses = Array.from(this.requests.values()).filter(
      (r) => r.cacheHit === false
    );
    if (cacheMisses.length > stats.totalRequests * 0.5) {
      for (const request of cacheMisses.slice(0, 10)) {
        issues.push({
          id: uuidv4(),
          type: 'cache-miss',
          severity: 'low',
          request,
          description: `Request to ${request.url} could benefit from caching`,
          suggestion: 'Implement appropriate cache headers (Cache-Control, ETag)',
        });
      }
    }

    return issues.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Get request by ID
   */
  public getRequest(id: string): NetworkRequest | undefined {
    return this.requests.get(id);
  }

  /**
   * Find requests by URL pattern
   */
  public findRequests(urlPattern: RegExp): NetworkRequest[] {
    return Array.from(this.requests.values()).filter((r) => urlPattern.test(r.url));
  }

  /**
   * Find requests by status code
   */
  public findRequestsByStatus(status: number): NetworkRequest[] {
    return Array.from(this.requests.values()).filter((r) => r.status === status);
  }

  /**
   * Find requests by method
   */
  public findRequestsByMethod(method: string): NetworkRequest[] {
    return Array.from(this.requests.values()).filter((r) => r.method === method);
  }

  /**
   * Record a network request start
   */
  public recordRequestStart(
    url: string,
    method: string,
    options?: RequestInit
  ): string {
    if (!this.options.enabled) {
      return '';
    }

    // Check filters
    if (this.options.urlFilter.length > 0) {
      const matches = this.options.urlFilter.some((pattern) => pattern.test(url));
      if (!matches) {
        return '';
      }
    }

    if (this.options.methodFilter.length > 0) {
      if (!this.options.methodFilter.includes(method)) {
        return '';
      }
    }

    const id = uuidv4();
    const request: Partial<NetworkRequest> = {
      id,
      url,
      method,
      startTime: performance.now(),
      status: 0,
      requestSize: 0,
      responseSize: 0,
      timing: {
        dns: 0,
        tcp: 0,
        tls: 0,
        ttfb: 0,
        download: 0,
        total: 0,
      },
      headers: {},
    };

    this.activeRequests.set(id, request);

    return id;
  }

  /**
   * Record a network request completion
   */
  public recordRequestEnd(
    id: string,
    status: number,
    responseHeaders?: Headers,
    responseSize?: number
  ): void {
    if (!this.options.enabled) {
      return;
    }

    const active = this.activeRequests.get(id);
    if (!active) {
      return;
    }

    const endTime = performance.now();
    const duration = endTime - (active.startTime ?? 0);

    const request: NetworkRequest = {
      id: active.id!,
      url: active.url!,
      method: active.method!,
      startTime: active.startTime!,
      endTime,
      duration,
      status,
      requestSize: active.requestSize ?? 0,
      responseSize: responseSize ?? 0,
      timing: active.timing!,
      headers: this.extractHeaders(responseHeaders),
    };

    this.requests.set(id, request);
    this.activeRequests.delete(id);

    // Manage request limit
    if (this.requests.size > this.options.maxRequests) {
      const oldest = Array.from(this.requests.values())
        .sort((a, b) => a.startTime - b.startTime)[0];
      if (oldest) {
        this.requests.delete(oldest.id);
      }
    }
  }

  /**
   * Clear all tracked requests
   */
  public clear(): void {
    this.requests.clear();
    this.activeRequests.clear();
    this.startTime = 0;
  }

  /**
   * Setup global request interceptors
   */
  private setupGlobalInterceptors(): void {
    // Note: In a real implementation, this would intercept fetch/XHR
    // For Node.js, we'd patch the http/https modules
    // For browser, we'd use Performance API or service workers
  }

  /**
   * Calculate total duration
   */
  private calculateTotalDuration(requests: NetworkRequest[]): number {
    if (requests.length === 0) {
      return 0;
    }

    const minTime = Math.min(...requests.map((r) => r.startTime));
    const maxTime = Math.max(...requests.map((r) => r.endTime));

    return maxTime - minTime;
  }

  /**
   * Calculate average latency
   */
  private calculateAverageLatency(requests: NetworkRequest[]): number {
    if (requests.length === 0) {
      return 0;
    }

    return requests.reduce((sum, r) => sum + r.duration, 0) / requests.length;
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(requests: NetworkRequest[]): number {
    if (requests.length === 0) {
      return 0;
    }

    const errors = requests.filter((r) => r.status >= 400).length;
    return (errors / requests.length) * 100;
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(requests: NetworkRequest[]): number {
    const withCacheInfo = requests.filter((r) => r.cacheHit !== undefined);

    if (withCacheInfo.length === 0) {
      return 0;
    }

    const hits = withCacheInfo.filter((r) => r.cacheHit === true).length;
    return (hits / withCacheInfo.length) * 100;
  }

  /**
   * Get suggestion for slow request
   */
  private getSlowRequestSuggestion(request: NetworkRequest): string {
    if (request.url.includes('api') || request.url.includes('graphql')) {
      return 'Consider implementing request batching, reducing payload size, or adding response caching';
    }

    if (request.url.includes('cdn') || request.url.includes('static')) {
      return 'Ensure proper CDN caching and consider using preloading or prefetching';
    }

    if (request.method === 'POST' || request.method === 'PUT') {
      return 'Consider reducing request payload size or implementing request compression';
    }

    return 'Investigate server-side performance and consider implementing caching';
  }

  /**
   * Get suggestion for failed request
   */
  private getFailedRequestSuggestion(request: NetworkRequest): string {
    if (request.status === 401 || request.status === 403) {
      return 'Check authentication and authorization logic';
    }

    if (request.status === 404) {
      return 'Verify the endpoint URL and routing configuration';
    }

    if (request.status === 429) {
      return 'Implement rate limiting and request throttling';
    }

    if (request.status >= 500) {
      return 'Check server logs and implement error handling and retry logic';
    }

    return 'Implement proper error handling and retry logic';
  }

  /**
   * Extract headers from Headers object
   */
  private extractHeaders(headers?: Headers): Record<string, string> {
    if (!headers) {
      return {};
    }

    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });

    return result;
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}

/**
 * Convenience function to create a network profiler
 */
export function createNetworkProfiler(options?: NetworkProfilerOptions): NetworkProfiler {
  return new NetworkProfiler(options);
}

/**
 * Track a fetch request automatically
 */
export async function trackedFetch(
  profiler: NetworkProfiler,
  url: string,
  options?: RequestInit
): Promise<Response> {
  const method = options?.method || 'GET';
  const id = profiler.recordRequestStart(url, method, options);

  try {
    const response = await fetch(url, options);

    if (id) {
      const responseSize = parseInt(
        response.headers.get('content-length') || '0',
        10
      );
      profiler.recordRequestEnd(id, response.status, response.headers, responseSize);
    }

    return response;
  } catch (error) {
    if (id) {
      profiler.recordRequestEnd(id, 0);
    }
    throw error;
  }
}
