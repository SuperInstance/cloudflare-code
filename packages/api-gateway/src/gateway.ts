/**
 * API Gateway - Ultra-Optimized
 * Minimal overhead request routing
 */

import type { GatewayRequest, GatewayResponse, GatewayContext, GatewayConfig, GatewayEnv } from './types';
import { Router, createRouter } from './router';
import { RateLimiter, createRateLimiter } from './rate-limit';
import { AuthManager, createAuthManager } from './auth';
import { Transformer, createTransformer } from './transformer';
import { CircuitBreaker, createCircuitBreaker } from './circuit';
import { AnalyticsEngine, createAnalyticsEngine } from './analytics';
import { MiddlewareChain, createMiddlewareChain, Middleware } from './middleware';

interface GatewayMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatency: number;
  totalLatency: number;
}

export interface APIGatewayOptions {
  env: GatewayEnv;
  config: GatewayConfig;
  enableRouter?: boolean;
  enableRateLimit?: boolean;
  enableAuth?: boolean;
  enableTransformer?: boolean;
  enableCircuitBreaker?: boolean;
  enableAnalytics?: boolean;
}

// Error response helper (frozen for memory efficiency)
const errorResponse = Object.freeze({
  notFound: () => new Response(JSON.stringify({ error: 'Route not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } }),
  unauthorized: () => new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { 'Content-Type': 'application/json' } }),
  rateLimit: (retryAfter?: number) => new Response(
    JSON.stringify({ error: 'Rate limit exceeded', retryAfter }),
    { status: 429, headers: { 'Content-Type': 'application/json', ...(retryAfter && { 'Retry-After': String(retryAfter) }) } }
  ),
  serverError: () => new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } }),
  serviceUnavailable: () => new Response(JSON.stringify({ error: 'Service unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
});

export class APIGateway {
  private router?: Router;
  private rateLimiter?: RateLimiter;
  private authManager?: AuthManager;
  private transformer?: Transformer;
  private circuitBreakers: Map<string, CircuitBreaker>;
  private analytics?: AnalyticsEngine;
  private middleware: MiddlewareChain;
  private metrics: GatewayMetrics;

  constructor(options: APIGatewayOptions) {
    this.circuitBreakers = new Map();
    this.middleware = createMiddlewareChain();
    this.metrics = { totalRequests: 0, successfulRequests: 0, failedRequests: 0, avgLatency: 0, totalLatency: 0 };

    // Initialize router
    if (options.enableRouter !== false) {
      this.router = createRouter({ cacheEnabled: true, cacheMaxSize: 10000 });
      options.config.routes.forEach(r => this.router!.addRoute(r));
    }

    // Initialize rate limiter
    if (options.enableRateLimit !== false && options.config.defaultRateLimit?.enabled) {
      this.rateLimiter = createRateLimiter({
        algorithm: options.config.defaultRateLimit.algorithm || 'token_bucket',
        storage: 'do',
        do: options.env.DO?.RATE_LIMIT,
        defaultLimits: options.config.defaultRateLimit.limits,
      });
    }

    // Initialize auth manager
    if (options.enableAuth !== false) {
      this.authManager = createAuthManager({ kv: options.env.KV?.SESSIONS, do: options.env.DO?.SESSION });
    }

    // Initialize transformer
    if (options.enableTransformer !== false) {
      this.transformer = createTransformer({});
    }

    // Initialize circuit breakers
    if (options.enableCircuitBreaker !== false) {
      options.config.routes.forEach(route => {
        route.upstream.targets.forEach(target => {
          const breaker = createCircuitBreaker(target.id, { failureThreshold: 5, successThreshold: 2, timeout: 60000 }, options.env.KV?.RATE_LIMIT);
          this.circuitBreakers.set(target.id, breaker);
        });
      });
    }

    // Initialize analytics
    if (options.enableAnalytics !== false && options.config.analytics.enabled) {
      this.analytics = createAnalyticsEngine({
        enabled: true,
        sampleRate: options.config.analytics.sampleRate,
        storage: 'kv',
        kv: options.env.KV?.CACHE,
        bufferSize: options.config.analytics.bufferSize,
        flushInterval: options.config.analytics.flushInterval,
      });
    }

    // Setup default middleware
    this.middleware.use(Middleware.logging());
    this.middleware.use(Middleware.cors());
    this.middleware.use(Middleware.requestId());
  }

  async handle(request: Request, ctx: ExecutionContext): Promise<Response> {
    const startTime = performance.now();
    this.metrics.totalRequests++;

    try {
      const url = new URL(request.url);
      const gatewayRequest: GatewayRequest = {
        id: request.headers.get('X-Request-ID') || `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
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
          tags: {}
        }
      };

      const gatewayContext: GatewayContext = { env: (this as any).env, ctx, requestId: `req-${Date.now()}`, timestamp: Date.now() };

      await this.middleware.executePreRequest(gatewayRequest, gatewayContext);

      if (this.analytics) await this.analytics.recordRequest(gatewayRequest, gatewayContext);

      const routeMatch = this.router ? await this.router.match(gatewayRequest, gatewayContext) : null;
      if (!routeMatch) return errorResponse.notFound();

      gatewayRequest.route = routeMatch;

      // Check rate limits
      if (this.rateLimiter && routeMatch.route.rateLimit?.enabled) {
        const rateLimitResult = await this.rateLimiter.check(gatewayRequest, gatewayContext, routeMatch.route.rateLimit);
        if (!rateLimitResult.allowed) return errorResponse.rateLimit(rateLimitResult.retryAfter);
      }

      // Authenticate
      if (this.authManager && routeMatch.route.auth?.required) {
        const authResult = await this.authManager.authenticate(gatewayRequest, gatewayContext, routeMatch.route.auth);
        if (!authResult.authenticated) return errorResponse.unauthorized();
        if (authResult.authContext) gatewayRequest.auth = authResult.authContext;
      }

      // Transform request
      if (this.transformer) await this.transformer.transformRequest(gatewayRequest, gatewayContext);

      // Route to upstream
      const target = await this.router?.routeToTarget(gatewayRequest, gatewayContext, routeMatch.route.upstream);
      if (!target) return errorResponse.serviceUnavailable();

      // Execute through circuit breaker
      const breaker = this.circuitBreakers.get(target.id);
      const upstreamResponse = breaker
        ? await breaker.execute(() => this.fetchFromUpstream(gatewayRequest, target), gatewayRequest, gatewayContext, { enabled: true, status: 503, body: { error: 'Service unavailable' } })
        : await this.fetchFromUpstream(gatewayRequest, target);

      const gatewayResponse: GatewayResponse = {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: upstreamResponse.headers,
        body: upstreamResponse.body,
        timestamp: Date.now(),
        duration: 0,
        metadata: {
          tags: {}
        }
      };

      if (this.transformer) await this.transformer.transformResponse(gatewayResponse, gatewayContext, gatewayRequest);

      await this.middleware.executePostRequest(gatewayRequest, gatewayResponse, gatewayContext);

      if (this.analytics) await this.analytics.recordResponse(gatewayResponse, gatewayRequest);

      const latency = performance.now() - startTime;
      this.updateMetrics(latency, true);

      return new Response(gatewayResponse.body, { status: gatewayResponse.status, statusText: gatewayResponse.statusText, headers: gatewayResponse.headers });

    } catch (error) {
      const latency = performance.now() - startTime;
      this.updateMetrics(latency, false);
      return errorResponse.serverError();
    }
  }

  use(middleware: Middleware): void {
    this.middleware.use(middleware);
  }

  onError(name: string, handler: Middleware['execute']): void {
    this.middleware.onError(name, handler);
  }

  getMetrics(): GatewayMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = { totalRequests: 0, successfulRequests: 0, failedRequests: 0, avgLatency: 0, totalLatency: 0 };
  }

  private async fetchFromUpstream(request: GatewayRequest, target: { id: string; url: string }): Promise<Response> {
    const url = new URL(request.url.pathname + request.url.search, target.url);
    return await fetch(new Request(url, { method: request.method, headers: request.headers, body: request.body }));
  }

  private updateMetrics(latency: number, success: boolean): void {
    if (success) this.metrics.successfulRequests++; else this.metrics.failedRequests++;
    this.metrics.totalLatency += latency;
    this.metrics.avgLatency = this.metrics.totalLatency / this.metrics.totalRequests;
  }
}

export function createAPIGateway(options: APIGatewayOptions): APIGateway {
  return new APIGateway(options);
}
