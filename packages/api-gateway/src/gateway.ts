/**
 * API Gateway
 *
 * Main gateway class that orchestrates all components:
 * - Request routing
 * - Rate limiting
 * - Authentication
 * - Request/response transformation
 * - API versioning
 * - Circuit breaking
 * - Analytics
 * - Configuration management
 *
 * Performance targets:
 * - <10ms gateway overhead
 * - 99.99% uptime
 * - Support for 100K+ RPS
 * - <1ms rate limit check latency
 * - 99.9% request routing accuracy
 */

import type {
  GatewayRequest,
  GatewayResponse,
  GatewayContext,
  GatewayConfig,
  GatewayEnv,
} from './types';

import { Router, createRouter } from './router';
import { RateLimiter, createRateLimiter } from './rate-limit';
import { AuthManager, createAuthManager } from './auth';
import { Transformer, createTransformer } from './transformer';
import { VersionManager, createVersionManager } from './version';
import { CircuitBreaker, createCircuitBreaker } from './circuit';
import { AnalyticsEngine, createAnalyticsEngine } from './analytics';
import { ConfigManager, createConfigManager } from './config';
import { MiddlewareChain, createMiddlewareChain, Middleware } from './middleware';

/**
 * Gateway options
 */
export interface APIGatewayOptions {
  env: GatewayEnv;
  config: GatewayConfig;
  enableRouter?: boolean;
  enableRateLimit?: boolean;
  enableAuth?: boolean;
  enableTransformer?: boolean;
  enableVersioning?: boolean;
  enableCircuitBreaker?: boolean;
  enableAnalytics?: boolean;
}

/**
 * API Gateway
 */
export class APIGateway {
  private env: GatewayEnv;
  private config: GatewayConfig;
  private configManager: ConfigManager;

  // Core components
  private router?: Router;
  private rateLimiter?: RateLimiter;
  private authManager?: AuthManager;
  private transformer?: Transformer;
  private versionManager?: VersionManager;
  private circuitBreakers: Map<string, CircuitBreaker>;
  private analytics?: AnalyticsEngine;
  private middleware: MiddlewareChain;

  // Metrics
  private metrics: GatewayMetrics;

  constructor(options: APIGatewayOptions) {
    this.env = options.env;
    this.config = options.config;
    this.circuitBreakers = new Map();

    // Initialize configuration manager
    this.configManager = createConfigManager(this.config, {
      kv: this.env.KV?.CONFIG,
    });

    // Initialize middleware chain
    this.middleware = createMiddlewareChain();

    // Initialize components based on options
    if (options.enableRouter !== false) {
      this.router = createRouter({
        cacheEnabled: true,
        cacheMaxSize: 10000,
      });

      // Register routes from config
      for (const route of this.config.routes) {
        this.router.addRoute(route);
      }
    }

    if (options.enableRateLimit !== false && this.config.defaultRateLimit?.enabled) {
      this.rateLimiter = createRateLimiter({
        algorithm: this.config.defaultRateLimit.algorithm || 'token_bucket',
        storage: 'do',
        do: this.env.DO?.RATE_LIMIT,
        defaultLimits: this.config.defaultRateLimit.limits,
      });
    }

    if (options.enableAuth !== false) {
      this.authManager = createAuthManager({
        kv: this.env.KV?.SESSIONS,
        do: this.env.DO?.SESSION,
      });
    }

    if (options.enableTransformer !== false) {
      this.transformer = createTransformer({});
    }

    if (options.enableVersioning !== false) {
      this.versionManager = createVersionManager({
        defaultVersion: 'v1.0',
        supportedVersions: ['v1.0', 'v2.0'],
        strategy: 'url_path',
      });
    }

    if (options.enableCircuitBreaker !== false) {
      // Create circuit breakers for each upstream
      for (const route of this.config.routes) {
        for (const target of route.upstream.targets) {
          const breaker = createCircuitBreaker(
            target.id,
            {
              failureThreshold: 5,
              successThreshold: 2,
              timeout: 60000,
            },
            this.env.KV?.RATE_LIMIT
          );
          this.circuitBreakers.set(target.id, breaker);
        }
      }
    }

    if (options.enableAnalytics !== false && this.config.analytics.enabled) {
      this.analytics = createAnalyticsEngine({
        enabled: true,
        sampleRate: this.config.analytics.sampleRate,
        storage: 'kv',
        kv: this.env.KV?.CACHE,
        bufferSize: this.config.analytics.bufferSize,
        flushInterval: this.config.analytics.flushInterval,
      });
    }

    // Setup default middleware
    this.setupDefaultMiddleware();

    // Initialize metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgLatency: 0,
      totalLatency: 0,
      lastResetTime: Date.now(),
    };
  }

  /**
   * Handle an incoming request
   */
  async handle(request: Request, ctx: ExecutionContext): Promise<Response> {
    const startTime = performance.now();
    this.metrics.totalRequests++;

    try {
      // Create gateway request
      const gatewayRequest = await this.createGatewayRequest(request);
      const gatewayContext = this.createGatewayContext(ctx);

      // Execute pre-request middleware
      await this.middleware.executePreRequest(gatewayRequest, gatewayContext);

      // Record analytics
      if (this.analytics) {
        await this.analytics.recordRequest(gatewayRequest, gatewayContext);
      }

      // Route request
      const routeMatch = this.router
        ? await this.router.match(gatewayRequest, gatewayContext)
        : null;

      if (!routeMatch) {
        return this.createErrorResponse(404, 'Not Found', 'Route not found');
      }

      gatewayRequest.route = routeMatch;

      // Check rate limits
      if (this.rateLimiter && routeMatch.route.rateLimit?.enabled) {
        const rateLimitResult = await this.rateLimiter.check(
          gatewayRequest,
          gatewayContext,
          routeMatch.route.rateLimit
        );

        if (!rateLimitResult.allowed) {
          return this.createRateLimitResponse(rateLimitResult);
        }
      }

      // Authenticate
      if (this.authManager && routeMatch.route.auth?.required) {
        const authResult = await this.authManager.authenticate(
          gatewayRequest,
          gatewayContext,
          routeMatch.route.auth
        );

        if (!authResult.authenticated) {
          return this.createAuthResponse(authResult.error);
        }

        if (authResult.authContext) {
          gatewayRequest.auth = authResult.authContext;
        }
      }

      // Transform request
      if (this.transformer) {
        await this.transformer.transformRequest(gatewayRequest, gatewayContext);
      }

      // Route to upstream
      const target = await this.router?.routeToTarget(
        gatewayRequest,
        gatewayContext,
        routeMatch.route.upstream
      );

      if (!target) {
        return this.createErrorResponse(503, 'Service Unavailable', 'No upstream targets available');
      }

      // Execute through circuit breaker
      const breaker = this.circuitBreakers.get(target.id);
      const upstreamResponse = breaker
        ? await breaker.execute(
            () => this.fetchFromUpstream(gatewayRequest, target),
            gatewayRequest,
            gatewayContext,
            {
              enabled: true,
              status: 503,
              body: { error: 'Service temporarily unavailable' },
            }
          )
        : await this.fetchFromUpstream(gatewayRequest, target);

      // Create gateway response
      const gatewayResponse = await this.createGatewayResponse(upstreamResponse);

      // Transform response
      if (this.transformer) {
        await this.transformer.transformResponse(
          gatewayResponse,
          gatewayContext,
          gatewayRequest
        );
      }

      // Execute post-request middleware
      await this.middleware.executePostRequest(
        gatewayRequest,
        gatewayResponse,
        gatewayContext
      );

      // Record analytics
      if (this.analytics) {
        await this.analytics.recordResponse(gatewayResponse, gatewayRequest);
      }

      // Update metrics
      const latency = performance.now() - startTime;
      this.updateMetrics(latency, true);

      // Create response
      return this.createResponse(gatewayResponse);

    } catch (error) {
      console.error('Gateway error:', error);

      // Update metrics
      const latency = performance.now() - startTime;
      this.updateMetrics(latency, false);

      // Record error analytics
      if (this.analytics) {
        await this.analytics.recordError(
          {
            status: 500,
            statusText: 'Internal Server Error',
            headers: new Headers(),
            body: null,
            timestamp: Date.now(),
            duration: latency,
            metadata: {},
          } as any,
          {} as any
        );
      }

      return this.createErrorResponse(500, 'Internal Server Error', 'An unexpected error occurred');
    }
  }

  /**
   * Add middleware
   */
  use(middleware: Middleware): void {
    this.middleware.use(middleware);
  }

  /**
   * Add error handler
   */
  onError(name: string, handler: Middleware['execute']): void {
    this.middleware.onError(name, handler);
  }

  /**
   * Get gateway metrics
   */
  getMetrics(): GatewayMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgLatency: 0,
      totalLatency: 0,
      lastResetTime: Date.now(),
    };
  }

  /**
   * Get configuration
   */
  getConfig(): GatewayConfig {
    return this.configManager.getConfig();
  }

  /**
   * Update configuration
   */
  async updateConfig(
    updates: Partial<GatewayConfig>,
    options?: { description?: string; createdBy?: string }
  ): Promise<void> {
    const result = await this.configManager.updateConfig(updates, options);

    if (!result.valid) {
      throw new Error(`Configuration validation failed: ${result.errors.map(e => e.message).join(', ')}`);
    }

    // Update routes if router exists
    if (this.router && updates.routes) {
      for (const route of updates.routes) {
        this.router.addRoute(route);
      }
    }
  }

  /**
   * Shutdown the gateway
   */
  async shutdown(): Promise<void> {
    if (this.analytics) {
      await this.analytics.shutdown();
    }
  }

  /**
   * Create gateway request (private helper)
   */
  private async createGatewayRequest(request: Request): Promise<GatewayRequest> {
    const url = new URL(request.url);

    return {
      id: request.headers.get('X-Request-ID') || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      method: request.method,
      url,
      headers: request.headers,
      body: request.body,
      query: url.searchParams,
      ip: request.headers.get('CF-Connecting-IP') || 'unknown',
      userAgent: request.headers.get('User-Agent') || 'unknown',
      timestamp: Date.now(),
      metadata: {
        sourceIp: request.headers.get('CF-Connecting-IP') || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown',
        referer: request.headers.get('Referer') || undefined,
        country: request.headers.get('CF-IPCountry') || undefined,
        contentType: request.headers.get('Content-Type') || undefined,
        contentLength: request.headers.get('Content-Length')
          ? parseInt(request.headers.get('Content-Length')!, 10)
          : undefined,
        tags: {},
      },
    };
  }

  /**
   * Create gateway context (private helper)
   */
  private createGatewayContext(ctx: ExecutionContext): GatewayContext {
    return {
      env: this.env,
      ctx,
      requestId: `req-${Date.now()}`,
      timestamp: Date.now(),
    };
  }

  /**
   * Create gateway response (private helper)
   */
  private async createGatewayResponse(response: Response): Promise<GatewayResponse> {
    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body: response.body,
      timestamp: Date.now(),
      duration: 0,
      metadata: {},
    };
  }

  /**
   * Fetch from upstream (private helper)
   */
  private async fetchFromUpstream(
    request: GatewayRequest,
    target: { id: string; url: string }
  ): Promise<Response> {
    const url = new URL(request.url.pathname + request.url.search, target.url);

    const upstreamRequest = new Request(url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    return await fetch(upstreamRequest);
  }

  /**
   * Create response (private helper)
   */
  private createResponse(gatewayResponse: GatewayResponse): Response {
    return new Response(gatewayResponse.body, {
      status: gatewayResponse.status,
      statusText: gatewayResponse.statusText,
      headers: gatewayResponse.headers,
    });
  }

  /**
   * Create error response (private helper)
   */
  private createErrorResponse(
    status: number,
    statusText: string,
    message: string
  ): Response {
    const body = JSON.stringify({
      error: {
        status,
        code: statusText.toUpperCase().replace(/\s+/g, '_'),
        message,
      },
    });

    return new Response(body, {
      status,
      statusText,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Create rate limit response (private helper)
   */
  private createRateLimitResponse(rateLimitResult: {
    allowed: boolean;
    retryAfter?: number;
  }): Response {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (rateLimitResult.retryAfter) {
      headers['Retry-After'] = String(rateLimitResult.retryAfter);
    }

    return new Response(
      JSON.stringify({
        error: {
          status: 429,
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter,
        },
      }),
      {
        status: 429,
        statusText: 'Too Many Requests',
        headers,
      }
    );
  }

  /**
   * Create auth response (private helper)
   */
  private createAuthResponse(error?: { code: string; message: string }): Response {
    return new Response(
      JSON.stringify({
        error: {
          status: 401,
          code: error?.code || 'UNAUTHORIZED',
          message: error?.message || 'Authentication required',
        },
      }),
      {
        status: 401,
        statusText: 'Unauthorized',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  /**
   * Setup default middleware (private helper)
   */
  private setupDefaultMiddleware(): void {
    this.middleware.use(Middleware.logging());
    this.middleware.use(Middleware.cors());
    this.middleware.use(Middleware.requestId());
  }

  /**
   * Update metrics (private helper)
   */
  private updateMetrics(latency: number, success: boolean): void {
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    this.metrics.totalLatency += latency;
    this.metrics.avgLatency = this.metrics.totalLatency / this.metrics.totalRequests;
  }
}

/**
 * Gateway metrics
 */
interface GatewayMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatency: number;
  totalLatency: number;
  lastResetTime: number;
}

/**
 * Create an API Gateway
 */
export function createAPIGateway(options: APIGatewayOptions): APIGateway {
  return new APIGateway(options);
}
