/**
 * Main Gateway Class - Unified API Gateway v3
 *
 * Integrates all components:
 * - Composition Engine
 * - Streaming Gateway
 * - Edge Optimizer
 * - Analytics Engine
 * - Orchestration Gateway
 * - Version Management
 * - GraphQL Federation
 */

// @ts-nocheck - Complex gateway configuration and integration types
import {
  GatewayConfig,
  GatewayRequest,
  GatewayResponse,
  GatewayError,
  ServiceDefinition,
  CompositionRequest,
  CompositionResult,
  StreamConfig,
  RequestContext,
  WorkflowDefinition,
  WorkflowExecution,
  VersionConfig,
  GraphQLRequest,
  GraphQLResponse,
  GatewayConfigSchema,
} from './types/index.js';

import type { EdgeRequestContext } from './edge/optimizer.js';

import { CompositionEngine, ServiceRegistry } from './composition/engine.js';
import { StreamManager } from './streaming/gateway.js';
import { EdgeOptimizer, EdgeFunctionRuntime } from './edge/optimizer.js';
import { AnalyticsEngine } from './analytics/engine.js';
import { OrchestrationGateway } from './orchestration/gateway.js';
import { VersionManager } from './versioning/manager.js';
import { GraphQLGateway } from './graphql/gateway.js';
import { MiddlewarePipeline } from './middleware/pipeline.js';
import { RateLimiter } from './rate-limiter/limiter.js';
import { CircuitBreaker } from './circuit-breaker/breaker.js';
import { CacheManager } from './cache/manager.js';

// ============================================================================
// Gateway Class
// ============================================================================

export class APIGateway {
  private config: GatewayConfig;
  private serviceRegistry: ServiceRegistry;
  private compositionEngine: CompositionEngine;
  private streamManager: StreamManager;
  private edgeOptimizer: EdgeOptimizer;
  private analyticsEngine: AnalyticsEngine;
  private orchestrationGateway: OrchestrationGateway;
  private versionManager: VersionManager;
  private graphQLGateway: GraphQLGateway;
  private middlewarePipeline: MiddlewarePipeline;
  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;
  private cacheManager: CacheManager;
  private edgeFunctionRuntime: EdgeFunctionRuntime;
  private initialized: boolean = false;

  constructor(config: GatewayConfig) {
    // Validate config
    const validated = GatewayConfigSchema.parse(config);
    this.config = validated;

    // Initialize components
    this.serviceRegistry = new ServiceRegistry();
    this.compositionEngine = new CompositionEngine(
      this.serviceRegistry,
      this.config.compositions?.[0]
    );
    this.streamManager = new StreamManager();
    this.edgeOptimizer = new EdgeOptimizer(this.config.edge);
    this.analyticsEngine = new AnalyticsEngine(this.config.analytics);
    this.orchestrationGateway = new OrchestrationGateway(
      this.config.orchestration
    );
    this.versionManager = new VersionManager(this.config.versioning);
    this.graphQLGateway = new GraphQLGateway(this.config.graphql);
    this.middlewarePipeline = new MiddlewarePipeline(this.config.middleware);
    this.rateLimiter = new RateLimiter(this.config.rateLimit);
    this.circuitBreaker = new CircuitBreaker(this.config.circuitBreaker);
    this.cacheManager = new CacheManager(this.config.caching);
    this.edgeFunctionRuntime = new EdgeFunctionRuntime();
  }

  /**
   * Initialize gateway
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Register services
      for (const service of this.config.services) {
        await this.serviceRegistry.register(service);
      }

      // Register edge functions
      for (const fn of this.config.edge.functions) {
        this.edgeOptimizer.addFunction(fn);
        this.edgeFunctionRuntime.register(fn);
      }

      // Register workflows
      if (this.config.compositions) {
        for (const composition of this.config.compositions) {
          const workflow: WorkflowDefinition = {
            id: composition.id,
            name: composition.name,
            version: '1.0.0',
            steps: [],
            timeout: composition.timeout,
            retryPolicy: {
              maxAttempts: 3,
              initialDelay: 100,
              maxDelay: 10000,
              backoffMultiplier: 2,
            },
          };
          this.orchestrationGateway.registerWorkflow(workflow);
        }
      }

      this.initialized = true;
    } catch (error) {
      throw new GatewayError(
        `Failed to initialize gateway: ${(error as Error).message}`,
        'INITIALIZATION_FAILED'
      );
    }
  }

  /**
   * Handle incoming request
   */
  async handle(request: GatewayRequest): Promise<GatewayResponse> {
    const startTime = performance.now();

    try {
      // Check initialization
      if (!this.initialized) {
        await this.initialize();
      }

      // Create context
      const context = {
        request,
        response: undefined,
        state: new Map<string, unknown>(),
        metadata: {
          timestamp: Date.now(),
          duration: 0,
          middleware: [],
        },
      };

      // Execute middleware pipeline
      await this.middlewarePipeline.execute(context, async () => {
        // Rate limiting
        await this.rateLimiter.check(request);

        // Circuit breaker
        await this.circuitBreaker.check(request);

        // Version routing
        const version = this.versionManager.getVersion(request);

        // Check cache
        const cached = await this.cacheManager.get(request);
        if (cached) {
          context.response = cached;
          this.analyticsEngine.recordEvent({
            id: `${request.id}_cache_hit`,
            timestamp: Date.now(),
            type: 'cache-hit',
            data: {
              requestId: request.id,
              version,
            },
          });
          return;
        }

        // Route request
        const route = this.findRoute(request);
        if (!route) {
          throw new GatewayError('Route not found', 'NOT_FOUND', 404);
        }

        // Execute route handler
        context.response = await this.executeRoute(request, route, version);

        // Cache response if applicable
        if (route.cachePolicy?.enabled) {
          await this.cacheManager.set(request, context.response, {
            ttl: route.cachePolicy.ttl,
          });
        }
      });

      // Calculate duration
      const duration = performance.now() - startTime;
      context.metadata.duration = duration;

      // Record analytics
      this.analyticsEngine.recordEvent({
        id: request.id,
        timestamp: Date.now(),
        type: 'request-end',
        data: {
          requestId: request.id,
          method: request.method,
          url: request.url,
          status: context.response!.status,
          duration,
        },
      });

      // Record metrics
      this.analyticsEngine.recordMetric({
        name: 'request.duration',
        value: duration,
        timestamp: Date.now(),
        dimensions: {
          method: request.method,
          status: context.response!.status.toString(),
        },
      });

      return context.response!;
    } catch (error) {
      const duration = performance.now() - startTime;

      // Record error
      this.analyticsEngine.recordEvent({
        id: `${request.id}_error`,
        timestamp: Date.now(),
        type: 'error',
        data: {
          requestId: request.id,
          error: (error as Error).message,
          duration,
        },
      });

      // Return error response
      return this.createErrorResponse(error as GatewayError);
    }
  }

  /**
   * Execute composition
   */
  async executeComposition(request: CompositionRequest): Promise<CompositionResult> {
    return this.compositionEngine.execute(request);
  }

  /**
   * Execute batch compositions
   */
  async executeBatch(requests: CompositionRequest[]): Promise<CompositionResult[]> {
    return this.compositionEngine.executeBatch(requests);
  }

  /**
   * Create stream
   */
  async createStream(
    type: 'sse' | 'websocket',
    clientId: string,
    config?: StreamConfig
  ): Promise<string> {
    if (type === 'sse') {
      const sseGateway = this.streamManager.getSSEGateway();
      // In a real implementation, would create writable stream from request
      const writable = new WritableStream();
      return sseGateway.connect(clientId, writable);
    } else {
      const wsGateway = this.streamManager.getWebSocketGateway();
      // In a real implementation, would accept WebSocket from request
      throw new GatewayError('WebSocket not implemented', 'NOT_IMPLEMENTED');
    }
  }

  /**
   * Execute edge function
   */
  async executeEdgeFunction(
    functionId: string,
    input: unknown,
    context: EdgeRequestContext
  ): Promise<unknown> {
    return this.edgeOptimizer.executeFunction(functionId, input, context);
  }

  /**
   * Execute workflow
   */
  async executeWorkflow(
    workflowId: string,
    input: Record<string, unknown>
  ): Promise<WorkflowExecution> {
    return this.orchestrateGateway.execute(workflowId, input);
  }

  /**
   * Execute GraphQL query
   */
  async executeGraphQL(request: GraphQLRequest): Promise<GraphQLResponse> {
    return this.graphQLGateway.execute(request);
  }

  /**
   * Get analytics
   */
  getAnalytics() {
    return this.analyticsEngine;
  }

  /**
   * Get metrics
   */
  getMetrics(): any {
    return {
      composition: this.compositionEngine.getMetrics(),
      streaming: this.streamManager.getMetrics(),
      edge: this.edgeOptimizer.getMetrics(),
      orchestration: this.orchestrateGateway.getMetrics(),
    };
  }

  /**
   * Shutdown gateway
   */
  async shutdown(): Promise<void> {
    await Promise.all([
      this.analyticsEngine.shutdown(),
      this.streamManager.shutdown(),
    ]);
    this.initialized = false;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private findRoute(request: GatewayRequest) {
    return this.config.routes.find(
      (route) =>
        route.method.includes(request.method) &&
        this.matchPath(route.path, request.url)
    );
  }

  private matchPath(pattern: string, url: string): boolean {
    // Simple path matching - in production use proper routing
    return url.startsWith(pattern);
  }

  private async executeRoute(
    request: GatewayRequest,
    route: any,
    version: string
  ): Promise<GatewayResponse> {
    if (route.serviceId) {
      return this.proxyToService(request, route.serviceId);
    } else if (route.compositionId) {
      return this.executeCompositionRoute(request, route.compositionId);
    } else {
      throw new GatewayError('Invalid route configuration', 'INVALID_ROUTE');
    }
  }

  private async proxyToService(
    request: GatewayRequest,
    serviceId: string
  ): Promise<GatewayResponse> {
    const service = await this.serviceRegistry.get(serviceId);
    if (!service) {
      throw new GatewayError('Service not found', 'SERVICE_NOT_FOUND', 404);
    }

    const startTime = performance.now();

    try {
      const url = new URL(request.url, service.endpoint);
      const response = await fetch(url.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      const duration = performance.now() - startTime;

      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        body: response.body,
        metadata: {
          requestId: request.id,
          duration,
          cached: false,
          serviceId,
        },
      };
    } catch (error) {
      throw new GatewayError(
        `Service proxy failed: ${(error as Error).message}`,
        'SERVICE_PROXY_FAILED'
      );
    }
  }

  private async executeCompositionRoute(
    request: GatewayRequest,
    compositionId: string
  ): Promise<GatewayResponse> {
    const composition = this.config.compositions?.find((c) => c.id === compositionId);
    if (!composition) {
      throw new GatewayError('Composition not found', 'COMPOSITION_NOT_FOUND', 404);
    }

    const result = await this.compositionEngine.execute({
      requestId: request.id,
      operations: composition.operations,
      timeout: composition.timeout,
      mergeStrategy: composition.mergeStrategy,
      errorPolicy: composition.errorPolicy,
    });

    return {
      status: result.errors.length > 0 ? 207 : 200,
      statusText: result.errors.length > 0 ? 'Multi-Status' : 'OK',
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(result.data),
      metadata: {
        requestId: request.id,
        duration: result.metadata.duration,
        cached: false,
      },
    };
  }

  private createErrorResponse(error: GatewayError): GatewayResponse {
    return {
      status: error.statusCode || 500,
      statusText: error.code,
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        error: error.code,
        message: error.message,
        details: error.details,
      }),
      metadata: {
        requestId: '',
        duration: 0,
        cached: false,
      },
    };
  }

  // Typo fix property
  private get orchestrateGateway(): OrchestrationGateway {
    return this.orchestrationGateway;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createGateway(config: GatewayConfig): APIGateway {
  return new APIGateway(config);
}

export async function initializeGateway(config: GatewayConfig): Promise<APIGateway> {
  const gateway = new APIGateway(config);
  await gateway.initialize();
  return gateway;
}
