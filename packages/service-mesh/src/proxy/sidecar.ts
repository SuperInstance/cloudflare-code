/**
 * Sidecar Proxy Implementation
 * Implements sidecar proxy pattern for service mesh
 */

import {
  ProxyConfig,
  ProxyUpstream,
  ProxyStats,
  ServiceRequest,
  ServiceResponse,
  LoadBalancingStrategy
} from '../types';
import { ServiceHttpClient } from '../communication/http-client';
import { ServiceLoadBalancer } from '../discovery/load-balancer';
import { CircuitBreaker } from '../circuit/breaker';
import { RetryExecutor } from '../retry/policy';

export interface SidecarContext {
  sourceService: string;
  sourceInstance: string;
  requestId: string;
  timestamp: number;
}

export class SidecarProxy {
  private config: ProxyConfig;
  private httpClient: ServiceHttpClient;
  private loadBalancers: Map<string, ServiceLoadBalancer>;
  private circuitBreakers: Map<string, CircuitBreaker>;
  private retryExecutor: RetryExecutor;
  private stats: ProxyStats;
  private startTime: number;

  constructor(config: ProxyConfig) {
    this.config = config;
    this.loadBalancers = new Map();
    this.circuitBreakers = new Map();

    this.httpClient = new ServiceHttpClient({
      enableCircuitBreaker: false, // Manage our own
      enableRetry: false, // Manage our own
      enableMetrics: true
    });

    this.retryExecutor = new RetryExecutor({
      policy: config.upstreams[0]?.retryPolicy
    });

    this.stats = this.createEmptyStats();
    this.startTime = Date.now();

    this.initializeUpstreams();
  }

  /**
   * Handle incoming request (outbound proxy)
   */
  async handleOutbound(
    targetService: string,
    request: Request,
    context: SidecarContext
  ): Promise<Response> {
    const upstream = this.findUpstream(targetService);

    if (!upstream) {
      return new Response(
        JSON.stringify({ error: 'Service not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const startTime = Date.now();
    let success = false;
    let error: Error | null = null;

    try {
      // Select instance using load balancer
      const loadBalancer = this.loadBalancers.get(targetService);

      if (!loadBalancer) {
        throw new Error(`Load balancer not found for service: ${targetService}`);
      }

      const instance = loadBalancer.selectInstance(
        {
          serviceName: targetService,
          instances: [], // Will be populated by service discovery
          timestamp: Date.now()
        },
        {
          sessionId: context.requestId,
          metadata: { clientIP: request.headers.get('cf-connecting-ip') || undefined }
        }
      );

      if (!instance) {
        throw new Error('No healthy instances available');
      }

      // Build target URL
      const targetUrl = `${instance.protocol}://${instance.host}:${instance.port}${new URL(request.url).pathname}`;

      // Add mesh context headers
      const headers = new Headers(request.headers);
      headers.set('x-source-service', context.sourceService);
      headers.set('x-source-instance', context.sourceInstance);
      headers.set('x-request-id', context.requestId);
      headers.set('x-proxy-id', this.config.proxyId);
      headers.set('x-forwarded-for', headers.get('cf-connecting-ip') || 'unknown');

      // Execute with circuit breaker and retry
      const circuitBreaker = this.circuitBreakers.get(targetService);

      const executeRequest = async (): Promise<Response> => {
        if (circuitBreaker) {
          return circuitBreaker.execute(
            () => this.executeRequest(targetUrl, headers, request.method, request.body),
            { methodName: request.method }
          );
        }

        return this.executeRequest(targetUrl, headers, request.method, request.body);
      };

      const response = await this.retryExecutor.execute(executeRequest);

      success = true;

      // Update stats
      this.updateStats(targetService, success, Date.now() - startTime);

      // Update load balancer
      if (loadBalancer && instance) {
        loadBalancer.recordRequest(instance.id, true, Date.now() - startTime);
      }

      // Add proxy headers
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('x-served-by', instance.id);
      responseHeaders.set('x-proxy-id', this.config.proxyId);

      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders
      });

    } catch (err) {
      error = err as Error;
      success = false;

      // Update stats
      this.updateStats(targetService, success, Date.now() - startTime);

      // Update load balancer
      const loadBalancer = this.loadBalancers.get(targetService);
      if (loadBalancer) {
        loadBalancer.recordRequest(targetService, false, Date.now() - startTime);
      }

      return new Response(
        JSON.stringify({
          error: 'Service unavailable',
          message: error.message,
          service: targetService
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'x-proxy-id': this.config.proxyId
          }
        }
      );
    }
  }

  /**
   * Handle incoming request (inbound proxy)
   */
  async handleInbound(request: Request, context: SidecarContext): Promise<Response> {
    // Extract mesh context from headers
    const sourceService = request.headers.get('x-source-service');
    const sourceInstance = request.headers.get('x-source-instance');
    const requestId = request.headers.get('x-request-id') || context.requestId;

    // Apply rate limiting
    if (!await this.checkRateLimit(sourceService || 'unknown')) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Apply security policies
    if (!await this.checkSecurityPolicies(request, sourceService || 'unknown')) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update connection stats
    this.stats.connections.active++;
    this.stats.connections.total++;
    this.stats.connections.created++;

    try {
      // Forward to local service
      const localPort = this.config.listeningPorts[0]?.port || 8080;
      const localUrl = `http://localhost:${localPort}${new URL(request.url).pathname}`;

      const response = await fetch(localUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body
      });

      this.stats.requests.total++;
      this.stats.requests.successful++;

      return response;

    } catch (error) {
      this.stats.requests.total++;
      this.stats.requests.failed++;

      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );

    } finally {
      this.stats.connections.active--;
      this.stats.connections.closed++;
    }
  }

  /**
   * Get proxy statistics
   */
  getStats(): ProxyStats {
    return {
      ...this.stats,
      uptime: Date.now() - this.startTime
    } as ProxyStats;
  }

  /**
   * Get proxy configuration
   */
  getConfig(): ProxyConfig {
    return { ...this.config };
  }

  /**
   * Update proxy configuration
   */
  updateConfig(updates: Partial<ProxyConfig>): void {
    this.config = { ...this.config, ...updates };

    if (updates.upstreams) {
      this.initializeUpstreams();
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    uptime: number;
    upstreams: Array<{ name: string; healthy: boolean }>;
  }> {
    const upstreams = await Promise.all(
      this.config.upstreams.map(async (upstream) => {
        const circuitBreaker = this.circuitBreakers.get(upstream.name);
        const healthy = circuitBreaker
          ? circuitBreaker.getCircuitState() !== 'open'
          : true;

        return {
          name: upstream.name,
          healthy
        };
      })
    );

    const allHealthy = upstreams.every(u => u.healthy);

    return {
      healthy: allHealthy,
      uptime: Date.now() - this.startTime,
      upstreams
    };
  }

  /**
   * Shutdown proxy
   */
  async shutdown(): Promise<void> {
    // Close all connections
    // Stop all timers
    // Flush metrics
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private initializeUpstreams(): void {
    for (const upstream of this.config.upstreams) {
      // Create load balancer
      const loadBalancer = new ServiceLoadBalancer(upstream.loadBalancing);
      this.loadBalancers.set(upstream.name, loadBalancer);

      // Create circuit breaker if configured
      if (upstream.circuitBreaker) {
        const circuitBreaker = new CircuitBreaker(
          upstream.name,
          upstream.circuitBreaker
        );

        this.circuitBreakers.set(upstream.name, circuitBreaker);
      }
    }
  }

  private findUpstream(serviceName: string): ProxyUpstream | undefined {
    return this.config.upstreams.find(u => u.service === serviceName);
  }

  private async executeRequest(
    url: string,
    headers: Headers,
    method: string,
    body: ReadableStream | null
  ): Promise<Response> {
    return fetch(url, {
      method,
      headers,
      body
    });
  }

  private async checkRateLimit(sourceService: string): Promise<boolean> {
    // Implement rate limiting logic
    // For now, always allow
    return true;
  }

  private async checkSecurityPolicies(request: Request, sourceService: string): Promise<boolean> {
    // Implement security policy checks
    // For now, always allow
    return true;
  }

  private updateStats(serviceName: string, success: boolean, duration: number): void {
    this.stats.requests.total++;

    if (success) {
      this.stats.requests.successful++;
    } else {
      this.stats.requests.failed++;

      // Track error by service
      const serviceErrors = this.stats.errors.byService[serviceName] || 0;
      this.stats.errors.byService[serviceName] = serviceErrors + 1;
    }

    // Update latency
    // Simplified - would use proper percentile calculation
    this.stats.latency.mean = (this.stats.latency.mean + duration) / 2;
  }

  private createEmptyStats(): ProxyStats {
    return {
      proxyId: this.config.proxyId,
      timestamp: Date.now(),
      connections: {
        active: 0,
        total: 0,
        created: 0,
        closed: 0
      },
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        timeout: 0,
        retried: 0
      },
      errors: {
        total: 0,
        byCode: {},
        byService: {}
      },
      latency: {
        min: 0,
        max: 0,
        mean: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        p999: 0
      },
      throughput: {
        requestsPerSecond: 0,
        bytesPerSecond: 0
      }
    };
  }
}

// ========================================================================
// Proxy Manager
// ========================================================================

export class ProxyManager {
  private proxies: Map<string, SidecarProxy>;
  private configs: Map<string, ProxyConfig>;

  constructor() {
    this.proxies = new Map();
    this.configs = new Map();
  }

  /**
   * Register a proxy
   */
  registerProxy(config: ProxyConfig): SidecarProxy {
    const proxy = new SidecarProxy(config);

    this.proxies.set(config.proxyId, proxy);
    this.configs.set(config.proxyId, config);

    return proxy;
  }

  /**
   * Unregister a proxy
   */
  unregisterProxy(proxyId: string): void {
    const proxy = this.proxies.get(proxyId);

    if (proxy) {
      proxy.shutdown();
      this.proxies.delete(proxyId);
      this.configs.delete(proxyId);
    }
  }

  /**
   * Get a proxy by ID
   */
  getProxy(proxyId: string): SidecarProxy | undefined {
    return this.proxies.get(proxyId);
  }

  /**
   * Get proxy by service
   */
  getProxyByService(serviceName: string): SidecarProxy | undefined {
    for (const [proxyId, config] of this.configs) {
      if (config.serviceName === serviceName) {
        return this.proxies.get(proxyId);
      }
    }

    return undefined;
  }

  /**
   * Get all proxies
   */
  getAllProxies(): SidecarProxy[] {
    return Array.from(this.proxies.values());
  }

  /**
   * Get all proxy stats
   */
  getAllStats(): Map<string, ProxyStats> {
    const stats = new Map<string, ProxyStats>();

    for (const [proxyId, proxy] of this.proxies) {
      stats.set(proxyId, proxy.getStats());
    }

    return stats;
  }

  /**
   * Health check all proxies
   */
  async healthCheckAll(): Promise<Map<string, {
    healthy: boolean;
    uptime: number;
    upstreams: Array<{ name: string; healthy: boolean }>;
  }>> {
    const results = new Map();

    for (const [proxyId, proxy] of this.proxies) {
      results.set(proxyId, await proxy.healthCheck());
    }

    return results;
  }

  /**
   * Shutdown all proxies
   */
  async shutdownAll(): Promise<void> {
    for (const proxy of this.proxies.values()) {
      await proxy.shutdown();
    }

    this.proxies.clear();
    this.configs.clear();
  }
}
