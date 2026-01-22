/**
 * Package Orchestrator
 *
 * Handles invocation, coordination, and lifecycle management of packages.
 * Provides unified interface for calling package capabilities.
 */

import type {
  PackageIdentifier,
  PackageMetadata,
  PackageInvocationRequest,
  PackageInvocationResponse,
  ServiceDiscoveryRequest,
  PackageEvent,
  PackageCapability,
} from './types';
import { PackageRegistry } from './registry';

/**
 * Invocation options
 */
export interface InvocationOptions {
  /**
   * Timeout in milliseconds
   */
  timeout?: number;

  /**
   * Number of retries
   */
  retries?: number;

  /**
   * Retry delay in milliseconds
   */
  retryDelay?: number;

  /**
   * Request ID for tracing
   */
  requestId?: string;

  /**
   * Enable fallback to alternative packages
   */
  enableFallback?: boolean;

  /**
   * Callback for progress updates
   */
  onProgress?: (progress: {
    attempt: number;
    totalAttempts: number;
    package: PackageIdentifier;
    status: string;
  }) => void;
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /**
   * Default timeout in milliseconds
   */
  defaultTimeout?: number;

  /**
   * Default retry count
   */
  defaultRetries?: number;

  /**
   * Default retry delay in milliseconds
   */
  defaultRetryDelay?: number;

  /**
   * Enable request tracing
   */
  enableTracing?: boolean;

  /**
   * Enable metrics collection
   */
  enableMetrics?: boolean;

  /**
   * Maximum concurrent invocations
   */
  maxConcurrentInvocations?: number;

  /**
   * Callback for invocation events
   */
  onInvocationEvent?: (event: {
    type: 'start' | 'complete' | 'error' | 'fallback';
    request: PackageInvocationRequest;
    response?: PackageInvocationResponse;
    error?: Error;
  }) => void;
}

/**
 * Invocation metrics
 */
export interface InvocationMetrics {
  /**
   * Total invocations
   */
  total: number;

  /**
   * Successful invocations
   */
  successful: number;

  /**
   * Failed invocations
   */
  failed: number;

  /**
   * Fallback activations
   */
  fallbacks: number;

  /**
   * Average response time in milliseconds
   */
  avgResponseTime: number;

  /**
   * Average retry count
   */
  avgRetries: number;

  /**
   * Invocations by package
   */
  byPackage: Map<string, number>;

  /**
   * Invocations by capability
   */
  byCapability: Map<string, number>;
}

/**
 * Package Orchestrator
 *
 * Manages package invocation and coordination.
 */
export class PackageOrchestrator {
  private registry: PackageRegistry;
  private options: Required<Omit<OrchestratorConfig, 'onInvocationEvent'>> & {
    onInvocationEvent?: OrchestratorConfig['onInvocationEvent'];
  };
  private metrics: InvocationMetrics;
  private activeInvocations: Map<string, AbortController>;
  private requestIdCounter: number;

  constructor(registry: PackageRegistry, config: OrchestratorConfig = {}) {
    this.registry = registry;
    this.options = {
      defaultTimeout: config.defaultTimeout ?? 30000, // 30 seconds
      defaultRetries: config.defaultRetries ?? 3,
      defaultRetryDelay: config.defaultRetryDelay ?? 1000,
      enableTracing: config.enableTracing ?? true,
      enableMetrics: config.enableMetrics ?? true,
      maxConcurrentInvocations: config.maxConcurrentInvocations ?? 100,
      onInvocationEvent: config.onInvocationEvent,
    };

    this.metrics = {
      total: 0,
      successful: 0,
      failed: 0,
      fallbacks: 0,
      avgResponseTime: 0,
      avgRetries: 0,
      byPackage: new Map(),
      byCapability: new Map(),
    };

    this.activeInvocations = new Map();
    this.requestIdCounter = 0;
  }

  /**
   * Invoke a package capability
   */
  async invoke(
    target: PackageIdentifier,
    capability: string,
    input: unknown,
    options?: InvocationOptions
  ): Promise<PackageInvocationResponse> {
    const requestId =
      options?.requestId ?? this.generateRequestId();

    const request: PackageInvocationRequest = {
      target,
      capability,
      input,
      options: {
        timeout: options?.timeout ?? this.options.defaultTimeout,
        retries: options?.retries ?? this.options.defaultRetries,
        requestId,
      },
    };

    return this.executeInvocation(request, options);
  }

  /**
   * Invoke with automatic service discovery
   */
  async invokeDiscovered(
    capability: string,
    input: unknown,
    discovery?: Partial<ServiceDiscoveryRequest>,
    options?: InvocationOptions
  ): Promise<PackageInvocationResponse> {
    // Discover packages with the requested capability
    const discoveryResult = this.registry.discover({
      capability,
      ...discovery,
    });

    if (!discoveryResult.selected) {
      return {
        data: null,
        status: 'error',
        metadata: {
          error: {
            code: 'SERVICE_NOT_FOUND',
            message: `No package found with capability: ${capability}`,
          },
        },
      };
    }

    // Invoke the selected package
    return this.invoke(
      discoveryResult.selected.metadata.id,
      capability,
      input,
      {
        ...options,
        enableFallback: true,
      }
    );
  }

  /**
   * Execute an invocation with retries and fallback
   */
  private async executeInvocation(
    request: PackageInvocationRequest,
    userOptions?: InvocationOptions
  ): Promise<PackageInvocationResponse> {
    const requestId = request.options?.requestId ?? this.generateRequestId();
    const timeout = request.options?.timeout ?? this.options.defaultTimeout;
    const maxRetries = request.options?.retries ?? this.options.defaultRetries;
    const enableFallback = userOptions?.enableFallback ?? false;

    // Track invocation
    this.metrics.total++;
    this.trackInvocationByPackage(request.target);
    this.trackInvocationByCapability(request.capability);

    // Emit start event
    this.emitEvent({ type: 'start', request });

    // Create abort controller
    const controller = new AbortController();
    this.activeInvocations.set(requestId, controller);

    let lastError: Error | undefined;
    let attempts = 0;
    let usedFallback = false;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      attempts = attempt + 1;

      // Report progress
      userOptions?.onProgress?.({
        attempt: attempts,
        totalAttempts: maxRetries + 1,
        package: request.target,
        status: 'invoking',
      });

      try {
        const response = await this.executeSingleAttempt(
          request,
          controller,
          timeout
        );

        // Success!
        this.metrics.successful++;
        this.updateResponseTimeMetrics(
          response.metadata?.processingTime ?? 0
        );

        this.emitEvent({ type: 'complete', request, response });

        return response;
      } catch (error) {
        lastError = error as Error;

        // Check if we should try fallback
        if (attempt === maxRetries && enableFallback) {
          const fallbackResponse = await this.tryFallback(
            request,
            userOptions
          );
          if (fallbackResponse) {
            usedFallback = true;
            this.metrics.fallbacks++;
            this.emitEvent({ type: 'fallback', request, response: fallbackResponse });
            return fallbackResponse;
          }
        }

        // Wait before retry
        if (attempt < maxRetries) {
          await this.delay(this.options.defaultRetryDelay * (attempt + 1));
        }
      }
    }

    // All attempts failed
    this.metrics.failed++;
    this.emitEvent({
      type: 'error',
      request,
      error: lastError,
    });

    return {
      data: null,
      status: 'error',
      metadata: {
        processingTime: 0,
        package: request.target,
        capability: request.capability,
        error: {
          code: 'INVOCATION_FAILED',
          message: lastError?.message ?? 'Unknown error',
          stack: lastError?.stack,
        },
      },
    };
  }

  /**
   * Execute a single invocation attempt
   */
  private async executeSingleAttempt(
    request: PackageInvocationRequest,
    controller: AbortController,
    timeout: number
  ): Promise<PackageInvocationResponse> {
    const startTime = Date.now();

    // Get package metadata
    const metadata = this.registry.getPackage(request.target);
    if (!metadata) {
      throw new Error(`Package not found: ${request.target.name}`);
    }

    // Check capability exists
    const capability = metadata.capabilities.find(
      (c) => c.name === request.capability
    );
    if (!capability) {
      throw new Error(
        `Capability ${request.capability} not found in package ${metadata.id.name}`
      );
    }

    // Create timeout
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Invoke based on package location type
      let data: unknown;

      if (metadata.location?.type === 'local') {
        // Local package - use direct function call or internal dispatch
        data = await this.invokeLocal(metadata, request);
      } else if (metadata.location?.type === 'remote') {
        // Remote package - use HTTP/REST
        data = await this.invokeRemote(metadata, request, controller);
      } else if (metadata.location?.type === 'durable-object') {
        // Durable Object - use DO stub
        data = await this.invokeDurableObject(metadata, request);
      } else {
        // Fallback: treat as local
        data = await this.invokeLocal(metadata, request);
      }

      clearTimeout(timeoutId);

      const processingTime = Date.now() - startTime;

      return {
        data,
        status: 'success',
        metadata: {
          processingTime,
          package: metadata.id,
          capability: request.capability,
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Invoke local package
   */
  private async invokeLocal(
    metadata: PackageMetadata,
    request: PackageInvocationRequest
  ): Promise<unknown> {
    // Check if package has a handler function
    const handler = (metadata as unknown as Record<string, unknown>)[
      `handle_${request.capability}`
    ];

    if (typeof handler === 'function') {
      return await handler(request.input);
    }

    // Check for default handler
    const defaultHandler = (metadata as unknown as Record<string, unknown>)[
      'handle'
    ];

    if (typeof defaultHandler === 'function') {
      return await defaultHandler({
        capability: request.capability,
        input: request.input,
      });
    }

    throw new Error(
      `No handler found for capability ${request.capability} in package ${metadata.id.name}`
    );
  }

  /**
   * Invoke remote package via HTTP
   */
  private async invokeRemote(
    metadata: PackageMetadata,
    request: PackageInvocationRequest,
    controller: AbortController
  ): Promise<unknown> {
    if (!metadata.location?.endpoint) {
      throw new Error(`Remote package ${metadata.id.name} has no endpoint`);
    }

    const url = `${metadata.location.endpoint}/capabilities/${request.capability}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': request.options?.requestId ?? '',
      },
      body: JSON.stringify(request.input),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return await response.json();
  }

  /**
   * Invoke Durable Object package
   */
  private async invokeDurableObject(
    metadata: PackageMetadata,
    request: PackageInvocationRequest
  ): Promise<unknown> {
    if (!metadata.location?.doId) {
      throw new Error(
        `Durable Object package ${metadata.id.name} has no DO ID`
      );
    }

    // This would need access to the DO namespace
    // For now, throw an error indicating DO support needs to be added
    throw new Error(
      'Durable Object invocation requires DO namespace - not yet implemented'
    );
  }

  /**
   * Try fallback to alternative package
   */
  private async tryFallback(
    request: PackageInvocationRequest,
    userOptions?: InvocationOptions
  ): Promise<PackageInvocationResponse | null> {
    const discoveryResult = this.registry.discover({
      capability: request.capability,
    });

    // Filter out the failed package
    const alternatives = discoveryResult.packages.filter(
      (p) => p.metadata.id.name !== request.target.name
    );

    if (alternatives.length === 0) {
      return null;
    }

    // Try the best alternative
    const alternative = alternatives[0];
    const fallbackRequest: PackageInvocationRequest = {
      ...request,
      target: alternative.metadata.id,
    };

    try {
      const response = await this.executeSingleAttempt(
        fallbackRequest,
        new AbortController(),
        request.options?.timeout ?? this.options.defaultTimeout
      );

      return {
        ...response,
        metadata: {
          ...response.metadata,
          fallback: {
            from: request.target,
            to: alternative.metadata.id,
          },
        },
      };
    } catch {
      return null;
    }
  }

  /**
   * Get invocation metrics
   */
  getMetrics(): InvocationMetrics {
    return {
      ...this.metrics,
      byPackage: new Map(this.metrics.byPackage),
      byCapability: new Map(this.metrics.byCapability),
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      total: 0,
      successful: 0,
      failed: 0,
      fallbacks: 0,
      avgResponseTime: 0,
      avgRetries: 0,
      byPackage: new Map(),
      byCapability: new Map(),
    };
  }

  /**
   * Cancel active invocation
   */
  cancelInvocation(requestId: string): boolean {
    const controller = this.activeInvocations.get(requestId);
    if (controller) {
      controller.abort();
      this.activeInvocations.delete(requestId);
      return true;
    }
    return false;
  }

  /**
   * Get active invocations count
   */
  getActiveInvocationsCount(): number {
    return this.activeInvocations.size;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestIdCounter}`;
  }

  /**
   * Track invocation by package
   */
  private trackInvocationByPackage(id: PackageIdentifier): void {
    const key = this.getPackageKey(id);
    const count = this.metrics.byPackage.get(key) ?? 0;
    this.metrics.byPackage.set(key, count + 1);
  }

  /**
   * Track invocation by capability
   */
  private trackInvocationByCapability(capability: string): void {
    const count = this.metrics.byCapability.get(capability) ?? 0;
    this.metrics.byCapability.set(capability, count + 1);
  }

  /**
   * Update response time metrics
   */
  private updateResponseTimeMetrics(responseTime: number): void {
    const currentAvg = this.metrics.avgResponseTime;
    const currentTotal = this.metrics.successful;

    this.metrics.avgResponseTime =
      (currentAvg * (currentTotal - 1) + responseTime) / currentTotal;
  }

  /**
   * Get package key for metrics
   */
  private getPackageKey(id: PackageIdentifier): string {
    return `${id.name}@${id.version}`;
  }

  /**
   * Emit invocation event
   */
  private emitEvent(event: {
    type: 'start' | 'complete' | 'error' | 'fallback';
    request: PackageInvocationRequest;
    response?: PackageInvocationResponse;
    error?: Error;
  }): void {
    if (this.options.onInvocationEvent) {
      this.options.onInvocationEvent(event);
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Dispose of orchestrator resources
   */
  dispose(): void {
    // Cancel all active invocations
    for (const controller of this.activeInvocations.values()) {
      controller.abort();
    }
    this.activeInvocations.clear();
  }
}

/**
 * Create a package orchestrator
 */
export function createPackageOrchestrator(
  registry: PackageRegistry,
  config?: OrchestratorConfig
): PackageOrchestrator {
  return new PackageOrchestrator(registry, config);
}
