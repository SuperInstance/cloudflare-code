// @ts-nocheck
/**
 * HTTP Client for Service Communication
 * Handles HTTP/REST communication between services
 */

import {
  ServiceRequest,
  ServiceResponse,
  ServiceError,
  RequestMetadata,
  MeshContext
} from '../types';
import { CircuitBreaker } from '../circuit/breaker';
import { RetryExecutor } from '../retry/policy';
import { TimeoutManager } from '../retry/timeout';

interface ServiceResponseGeneric<T> {
  id: string;
  status: number;
  headers: Headers;
  body?: T;
  duration: number;
  fromCache: boolean;
  error?: ServiceError;
}

export interface HttpClientConfig {
  baseUrl?: string;
  defaultTimeout?: number;
  defaultHeaders?: Record<string, string>;
  enableCircuitBreaker?: boolean;
  enableRetry?: boolean;
  enableMetrics?: boolean;
  circuitBreakerConfig?: any;
  retryPolicy?: any;
}

export interface RequestInitWithMetadata extends RequestInit {
  metadata?: RequestMetadata;
  circuitBreaker?: string;
  retry?: boolean;
  timeout?: number;
}

export class ServiceHttpClient {
  private config: HttpClientConfig;
  private circuitBreakers: Map<string, CircuitBreaker>;
  private retryExecutor: RetryExecutor;
  private timeoutManager: TimeoutManager;
  private requestMetrics: Map<string, Array<{ duration: number; success: boolean; timestamp: number }>>;

  constructor(config: HttpClientConfig = {}) {
    this.config = {
      defaultTimeout: 30000,
      enableCircuitBreaker: true,
      enableRetry: true,
      enableMetrics: true,
      ...config
    };

    this.circuitBreakers = new Map();
    this.retryExecutor = new RetryExecutor({
      policy: this.config.retryPolicy
    });
    this.timeoutManager = new TimeoutManager();
    this.requestMetrics = new Map();
  }

  /**
   * Make HTTP GET request
   */
  async get<T>(
    url: string,
    options: RequestInitWithMetadata = {}
  ): Promise<ServiceResponseGeneric<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'GET'
    });
  }

  /**
   * Make HTTP POST request
   */
  async post<T>(
    url: string,
    body: any,
    options: RequestInitWithMetadata = {}
  ): Promise<ServiceResponseGeneric<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  /**
   * Make HTTP PUT request
   */
  async put<T>(
    url: string,
    body: any,
    options: RequestInitWithMetadata = {}
  ): Promise<ServiceResponseGeneric<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  /**
   * Make HTTP PATCH request
   */
  async patch<T>(
    url: string,
    body: any,
    options: RequestInitWithMetadata = {}
  ): Promise<ServiceResponseGeneric<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  }

  /**
   * Make HTTP DELETE request
   */
  async delete<T>(
    url: string,
    options: RequestInitWithMetadata = {}
  ): Promise<ServiceResponseGeneric<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'DELETE'
    });
  }

  /**
   * Make HTTP HEAD request
   */
  async head(
    url: string,
    options: RequestInitWithMetadata = {}
  ): Promise<ServiceResponse> {
    return this.request(url, {
      ...options,
      method: 'HEAD'
    });
  }

  /**
   * Make HTTP OPTIONS request
   */
  async options(
    url: string,
    options: RequestInitWithMetadata = {}
  ): Promise<ServiceResponse> {
    return this.request(url, {
      ...options,
      method: 'OPTIONS'
    });
  }

  /**
   * Make HTTP request with full control
   */
  async request<T>(
    url: string,
    options: RequestInitWithMetadata = {}
  ): Promise<ServiceResponseGeneric<T>> {
    const startTime = Date.now();
    const serviceUrl = this.buildUrl(url);
    const metadata = options.metadata || this.createMetadata();

    try {
      // Prepare request
      const requestInit: RequestInit = {
        ...options,
        headers: this.buildHeaders(options)
      };

      // Execute with retry, circuit breaker, and timeout
      const executeRequest = async () => {
        if (this.config.enableCircuitBreaker && options.circuitBreaker) {
          return this.executeWithCircuitBreaker(serviceUrl, requestInit, options.circuitBreaker);
        }

        return this.executeRequest(serviceUrl, requestInit);
      };

      const response = this.config.enableRetry && options.retry !== false
        ? await this.retryExecutor.execute(executeRequest, { metadata: options.metadata })
        : await executeRequest();

      // Parse response
      const responseBody = await this.parseResponse<T>(response);

      const duration = Date.now() - startTime;

      const serviceResponse: ServiceResponseGeneric<T> = {
        id: metadata.traceId,
        status: response.status,
        headers: response.headers,
        body: responseBody,
        duration,
        fromCache: false
      };

      // Record metrics
      if (this.config.enableMetrics) {
        this.recordMetric(serviceUrl, duration, true);
      }

      return serviceResponse;

    } catch (error) {
      const duration = Date.now() - startTime;
      const serviceError = this.normalizeError(error);

      // Record metrics
      if (this.config.enableMetrics) {
        this.recordMetric(serviceUrl, duration, false);
      }

      return {
        id: metadata.traceId,
        status: serviceError.statusCode || 500,
        headers: new Headers(),
        duration,
        fromCache: false,
        error: serviceError
      };
    }
  }

  /**
   * Execute request with circuit breaker
   */
  private async executeWithCircuitBreaker(
    url: string,
    options: RequestInit,
    circuitBreakerName: string
  ): Promise<Response> {
    let circuitBreaker = this.circuitBreakers.get(circuitBreakerName);

    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker(
        circuitBreakerName,
        this.config.circuitBreakerConfig
      );

      this.circuitBreakers.set(circuitBreakerName, circuitBreaker);
    }

    return circuitBreaker.execute(() => this.executeRequest(url, options));
  }

  /**
   * Execute raw HTTP request
   */
  private async executeRequest(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const timeout = options.timeout || this.config.defaultTimeout;

    return this.timeoutManager.executeWithRequestTimeout(
      () => fetch(url, options),
      timeout
    );
  }

  /**
   * Parse response body
   */
  private async parseResponse<T>(response: Response): Promise<T | undefined> {
    const contentType = response.headers.get('content-type');

    if (!contentType) {
      return undefined;
    }

    if (contentType.includes('application/json')) {
      try {
        return await response.json();
      } catch {
        return undefined;
      }
    }

    if (contentType.includes('text/')) {
      return await response.text() as T;
    }

    return undefined;
  }

  /**
   * Build full URL
   */
  private buildUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    if (this.config.baseUrl) {
      return `${this.config.baseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
    }

    return url;
  }

  /**
   * Build request headers
   */
  private buildHeaders(options: RequestInitWithMetadata): HeadersInit {
    const headers = new Headers(options.headers);

    // Add default headers
    if (this.config.defaultHeaders) {
      for (const [key, value] of Object.entries(this.config.defaultHeaders)) {
        if (!headers.has(key)) {
          headers.set(key, value);
        }
      }
    }

    // Add content type if not set and has body
    if (options.body && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }

    // Add mesh context headers
    if (options.metadata) {
      this.addMeshContextHeaders(headers, options.metadata);
    }

    return headers;
  }

  /**
   * Add mesh context to headers
   */
  private addMeshContextHeaders(headers: Headers, metadata: RequestMetadata): void {
    headers.set('x-trace-id', metadata.traceId);
    headers.set('x-span-id', metadata.spanId);

    if (metadata.parentSpanId) {
      headers.set('x-parent-span-id', metadata.parentSpanId);
    }

    headers.set('x-request-start', metadata.timestamp.toString());

    if (metadata.userId) {
      headers.set('x-user-id', metadata.userId);
    }

    if (metadata.sessionId) {
      headers.set('x-session-id', metadata.sessionId);
    }

    // Add custom metadata
    if (metadata.custom) {
      for (const [key, value] of Object.entries(metadata.custom)) {
        headers.set(`x-meta-${key}`, String(value));
      }
    }
  }

  /**
   * Create request metadata
   */
  private createMetadata(): RequestMetadata {
    return {
      traceId: this.generateTraceId(),
      spanId: this.generateSpanId(),
      timestamp: Date.now()
    };
  }

  /**
   * Normalize error to ServiceError
   */
  private normalizeError(error: unknown): ServiceError {
    if (this.isServiceError(error)) {
      return error;
    }

    if (error instanceof Error) {
      return {
        code: this.getErrorCode(error),
        message: error.message,
        retryable: this.isRetryableError(error),
        statusCode: this.getErrorStatusCode(error)
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      retryable: false
    };
  }

  /**
   * Check if error is ServiceError
   */
  private isServiceError(error: unknown): error is ServiceError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      'retryable' in error
    );
  }

  /**
   * Get error code from Error
   */
  private getErrorCode(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('timed out')) {
      return 'TIMEOUT';
    }

    if (message.includes('network') || message.includes('fetch')) {
      return 'NETWORK_ERROR';
    }

    if (message.includes('connection refused')) {
      return 'ECONNREFUSED';
    }

    if (message.includes('connection reset')) {
      return 'ECONNRESET';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'TIMEOUT',
      'NETWORK_ERROR',
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT'
    ];

    const code = this.getErrorCode(error);
    return retryableErrors.includes(code);
  }

  /**
   * Get status code from error
   */
  private getErrorStatusCode(error: Error): number | undefined {
    const match = error.message.match(/status\s+(\d+)/i);
    return match ? parseInt(match[1], 10) : undefined;
  }

  /**
   * Record request metric
   */
  private recordMetric(url: string, duration: number, success: boolean): void {
    const metrics = this.requestMetrics.get(url) || [];
    metrics.push({
      duration,
      success,
      timestamp: Date.now()
    });

    // Keep only last 1000 metrics
    if (metrics.length > 1000) {
      metrics.shift();
    }

    this.requestMetrics.set(url, metrics);
  }

  /**
   * Get metrics for a URL
   */
  getMetrics(url: string): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageDuration: number;
    p95Duration: number;
    p99Duration: number;
  } | undefined {
    const metrics = this.requestMetrics.get(url);

    if (!metrics || metrics.length === 0) {
      return undefined;
    }

    const successful = metrics.filter(m => m.success);
    const failed = metrics.filter(m => !m.success);
    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);

    return {
      totalRequests: metrics.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      p95Duration: durations[Math.floor(durations.length * 0.95)],
      p99Duration: durations[Math.floor(durations.length * 0.99)]
    };
  }

  /**
   * Generate trace ID
   */
  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate span ID
   */
  private generateSpanId(): string {
    return `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<HttpClientConfig>): void {
    this.config = { ...this.config, ...updates };

    if (updates.retryPolicy) {
      this.retryExecutor = new RetryExecutor({
        policy: updates.retryPolicy
      });
    }
  }

  /**
   * Get circuit breaker by name
   */
  getCircuitBreaker(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name);
  }

  /**
   * Get all circuit breakers
   */
  getCircuitBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.circuitBreakers);
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.requestMetrics.clear();
  }

  /**
   * Clear all circuit breakers
   */
  clearCircuitBreakers(): void {
    this.circuitBreakers.clear();
  }
}

// ========================================================================
// Request Builder
// ========================================================================

export class RequestBuilder {
  private client: ServiceHttpClient;
  private url: string = '';
  private method: string = 'GET';
  private body: any = null;
  private headers: Record<string, string> = {};
  private metadata?: RequestMetadata;
  private circuitBreaker?: string;
  private retry: boolean = true;
  private timeout?: number;

  constructor(client: ServiceHttpClient) {
    this.client = client;
  }

  setUrl(url: string): RequestBuilder {
    this.url = url;
    return this;
  }

  setMethod(method: string): RequestBuilder {
    this.method = method;
    return this;
  }

  setBody(body: any): RequestBuilder {
    this.body = body;
    return this;
  }

  setHeaders(headers: Record<string, string>): RequestBuilder {
    this.headers = { ...this.headers, ...headers };
    return this;
  }

  setHeader(key: string, value: string): RequestBuilder {
    this.headers[key] = value;
    return this;
  }

  setMetadata(metadata: RequestMetadata): RequestBuilder {
    this.metadata = metadata;
    return this;
  }

  setCircuitBreaker(name: string): RequestBuilder {
    this.circuitBreaker = name;
    return this;
  }

  enableRetry(enabled: boolean = true): RequestBuilder {
    this.retry = enabled;
    return this;
  }

  setTimeout(timeout: number): RequestBuilder {
    this.timeout = timeout;
    return this;
  }

  async execute<T>(): Promise<ServiceResponseGeneric<T>> {
    return this.client.request<T>(this.url, {
      method: this.method,
      body: this.body,
      headers: this.headers,
      metadata: this.metadata,
      circuitBreaker: this.circuitBreaker,
      retry: this.retry,
      timeout: this.timeout
    });
  }
}
