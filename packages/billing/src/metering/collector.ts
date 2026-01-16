// @ts-nocheck - Unused imports and external dependencies
/**
 * Usage collector for gathering metrics from various sources
 */

import {
  UsageMetric,
  UsageMetricType,
  MeteringEvent,
  BillingError,
  BillingErrorCode,
} from '../types/index.js';
import { UsageMeter } from './meter.js';

/**
 * Request information for metering
 */
export interface RequestInfo {
  userId: string;
  organizationId: string;
  projectId?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  timestamp: Date;
  duration: number; // in milliseconds
  tokenCount?: {
    prompt: number;
    completion: number;
    total: number;
  };
  requestBody?: number; // in bytes
  responseBody?: number; // in bytes
}

/**
 * Storage information for metering
 */
export interface StorageInfo {
  userId: string;
  organizationId: string;
  projectId?: string;
  storageType: 'database' | 'file' | 'cache' | 'cdn';
  size: number; // in bytes
  operation: 'read' | 'write' | 'delete';
  timestamp: Date;
}

/**
 * API call information for metering
 */
export interface ApiCallInfo {
  userId: string;
  organizationId: string;
  apiMethod: string;
  timestamp: Date;
  statusCode: number;
  duration: number;
  requestSize?: number;
  responseSize?: number;
}

/**
 * Usage collector for gathering metrics
 */
export class UsageCollector {
  private meter: UsageMeter;
  private requestQueue: RequestInfo[] = [];
  private storageQueue: StorageInfo[] = [];
  private apiCallQueue: ApiCallInfo[] = [];

  constructor(meter: UsageMeter) {
    this.meter = meter;
  }

  /**
   * Collect metrics from a request
   */
  async collectRequestMetrics(request: RequestInfo): Promise<void> {
    this.requestQueue.push(request);

    const metrics: UsageMetric[] = [
      {
        type: UsageMetricType.REQUESTS,
        value: 1,
        unit: 'requests',
        timestamp: request.timestamp,
        userId: request.userId,
        organizationId: request.organizationId,
        projectId: request.projectId,
      },
      {
        type: UsageMetricType.CPU_TIME,
        value: request.duration / 1000, // Convert to seconds
        unit: 'seconds',
        timestamp: request.timestamp,
        userId: request.userId,
        organizationId: request.organizationId,
        projectId: request.projectId,
      },
    ];

    // Add token metrics if available
    if (request.tokenCount) {
      metrics.push({
        type: UsageMetricType.TOKENS,
        value: request.tokenCount.total,
        unit: 'tokens',
        timestamp: request.timestamp,
        userId: request.userId,
        organizationId: request.organizationId,
        projectId: request.projectId,
        metadata: {
          promptTokens: request.tokenCount.prompt,
          completionTokens: request.tokenCount.completion,
        },
      });
    }

    // Add bandwidth metrics if available
    if (request.requestBody !== undefined) {
      metrics.push({
        type: UsageMetricType.BANDWIDTH,
        value: request.requestBody,
        unit: 'bytes',
        timestamp: request.timestamp,
        userId: request.userId,
        organizationId: request.organizationId,
        projectId: request.projectId,
        metadata: { direction: 'inbound' },
      });
    }

    if (request.responseBody !== undefined) {
      metrics.push({
        type: UsageMetricType.BANDWIDTH,
        value: request.responseBody,
        unit: 'bytes',
        timestamp: request.timestamp,
        userId: request.userId,
        organizationId: request.organizationId,
        projectId: request.projectId,
        metadata: { direction: 'outbound' },
      });
    }

    await this.meter.recordMetrics(metrics);
  }

  /**
   * Collect metrics from storage operations
   */
  async collectStorageMetrics(storage: StorageInfo): Promise<void> {
    this.storageQueue.push(storage);

    const metrics: UsageMetric[] = [];

    // Track storage usage for writes
    if (storage.operation === 'write') {
      metrics.push({
        type: UsageMetricType.STORAGE,
        value: storage.size,
        unit: 'bytes',
        timestamp: storage.timestamp,
        userId: storage.userId,
        organizationId: storage.organizationId,
        projectId: storage.projectId,
        metadata: {
          storageType: storage.storageType,
          operation: storage.operation,
        },
      });
    }

    // Track bandwidth for storage operations
    metrics.push({
      type: UsageMetricType.BANDWIDTH,
      value: storage.size,
      unit: 'bytes',
      timestamp: storage.timestamp,
      userId: storage.userId,
      organizationId: storage.organizationId,
      projectId: storage.projectId,
      metadata: {
        source: 'storage',
        operation: storage.operation,
        storageType: storage.storageType,
      },
    });

    await this.meter.recordMetrics(metrics);
  }

  /**
   * Collect metrics from API calls
   */
  async collectApiCallMetrics(apiCall: ApiCallInfo): Promise<void> {
    this.apiCallQueue.push(apiCall);

    const metrics: UsageMetric[] = [
      {
        type: UsageMetricType.API_CALLS,
        value: 1,
        unit: 'calls',
        timestamp: apiCall.timestamp,
        userId: apiCall.userId,
        organizationId: apiCall.organizationId,
        metadata: {
          method: apiCall.apiMethod,
          statusCode: apiCall.statusCode,
          duration: apiCall.duration,
        },
      },
    ];

    // Add bandwidth metrics if available
    if (apiCall.requestSize !== undefined) {
      metrics.push({
        type: UsageMetricType.BANDWIDTH,
        value: apiCall.requestSize,
        unit: 'bytes',
        timestamp: apiCall.timestamp,
        userId: apiCall.userId,
        organizationId: apiCall.organizationId,
        metadata: {
          source: 'api',
          direction: 'inbound',
          method: apiCall.apiMethod,
        },
      });
    }

    if (apiCall.responseSize !== undefined) {
      metrics.push({
        type: UsageMetricType.BANDWIDTH,
        value: apiCall.responseSize,
        unit: 'bytes',
        timestamp: apiCall.timestamp,
        userId: apiCall.userId,
        organizationId: apiCall.organizationId,
        metadata: {
          source: 'api',
          direction: 'outbound',
          method: apiCall.apiMethod,
        },
      });
    }

    await this.meter.recordMetrics(metrics);
  }

  /**
   * Collect metrics from a batch of requests
   */
  async collectBatchRequestMetrics(requests: RequestInfo[]): Promise<void> {
    await Promise.all(
      requests.map((request) => this.collectRequestMetrics(request))
    );
  }

  /**
   * Get request queue size
   */
  getRequestQueueSize(): number {
    return this.requestQueue.length;
  }

  /**
   * Get storage queue size
   */
  getStorageQueueSize(): number {
    return this.storageQueue.length;
  }

  /**
   * Get API call queue size
   */
  getApiCallQueueSize(): number {
    return this.apiCallQueue.length;
  }

  /**
   * Clear all queues
   */
  clearQueues(): void {
    this.requestQueue = [];
    this.storageQueue = [];
    this.apiCallQueue = [];
  }

  /**
   * Get aggregate statistics from queues
   */
  getQueueStats(): {
    totalRequests: number;
    totalStorageOperations: number;
    totalApiCalls: number;
  } {
    return {
      totalRequests: this.requestQueue.length,
      totalStorageOperations: this.storageQueue.length,
      totalApiCalls: this.apiCallQueue.length,
    };
  }
}

/**
 * Middleware for collecting HTTP request metrics
 */
export class RequestMetricMiddleware {
  private collector: UsageCollector;

  constructor(collector: UsageCollector) {
    this.collector = collector;
  }

  /**
   * Create a middleware function for use with web frameworks
   */
  middleware() {
    return async (
      request: Request,
      env: any,
      ctx: ExecutionContext
    ): Promise<Response> => {
      const startTime = Date.now();
      const userId = this.extractUserId(request);
      const organizationId = this.extractOrganizationId(request);
      const projectId = this.extractProjectId(request);

      let response: Response;
      let requestBody: number | undefined;
      let responseBody: number | undefined;

      try {
        // Track request size
        requestBody = request.headers.get('content-length')
          ? parseInt(request.headers.get('content-length')!)
          : undefined;

        // Process request
        response = await this.handleRequest(request, env, ctx);

        // Track response size
        responseBody = response.headers.get('content-length')
          ? parseInt(response.headers.get('content-length')!)
          : undefined;

        // Collect metrics
        const duration = Date.now() - startTime;

        await this.collector.collectRequestMetrics({
          userId,
          organizationId,
          projectId,
          endpoint: new URL(request.url).pathname,
          method: request.method,
          statusCode: response.status,
          timestamp: new Date(),
          duration,
          requestBody,
          responseBody,
        });

        return response;
      } catch (error) {
        // Collect error metrics
        const duration = Date.now() - startTime;

        await this.collector.collectRequestMetrics({
          userId,
          organizationId,
          projectId,
          endpoint: new URL(request.url).pathname,
          method: request.method,
          statusCode: 500,
          timestamp: new Date(),
          duration,
          requestBody,
        });

        throw error;
      }
    };
  }

  private async handleRequest(
    request: Request,
    env: any,
    ctx: ExecutionContext
  ): Promise<Response> {
    // This would be implemented by the actual handler
    return new Response('OK');
  }

  private extractUserId(request: Request): string {
    // Extract user ID from request headers or JWT
    return request.headers.get('x-user-id') || 'anonymous';
  }

  private extractOrganizationId(request: Request): string {
    // Extract organization ID from request headers or JWT
    return request.headers.get('x-org-id') || 'default';
  }

  private extractProjectId(request: Request): string | undefined {
    // Extract project ID from request headers or JWT
    return request.headers.get('x-project-id') || undefined;
  }
}

/**
 * Create a usage collector with the given meter
 */
export function createUsageCollector(meter: UsageMeter): UsageCollector {
  return new UsageCollector(meter);
}
