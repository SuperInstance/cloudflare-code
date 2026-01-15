/**
 * Metrics and monitoring for SaaS platform
 */

import { Counter, Gauge, Histogram, register } from 'prom-client';

export class Metrics {
  // Application metrics
  private requestCounter = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code', 'tenant_id'],
  });

  private requestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'tenant_id'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  });

  // Business metrics
  private activeUsers = new Gauge({
    name: 'active_users_total',
    help: 'Number of active users',
    labelNames: ['tenant_id'],
  });

  private activeProjects = new Gauge({
    name: 'active_projects_total',
    help: 'Number of active projects',
    labelNames: ['tenant_id'],
  });

  private subscriptionMetrics = new Gauge({
    name: 'subscription_count',
    help: 'Number of subscriptions by plan',
    labelNames: ['plan', 'tenant_id'],
  });

  // System metrics
  private memoryUsage = new Gauge({
    name: 'memory_usage_bytes',
    help: 'Memory usage in bytes',
  });

  private cpuUsage = new Gauge({
    name: 'cpu_usage_percent',
    help: 'CPU usage percentage',
  });

  private databaseConnections = new Gauge({
    name: 'database_connections_active',
    help: 'Number of active database connections',
  });

  // Cache metrics
  private cacheHits = new Counter({
    name: 'cache_hits_total',
    help: 'Total number of cache hits',
    labelNames: ['type', 'tenant_id'],
  });

  private cacheMisses = new Counter({
    name: 'cache_misses_total',
    help: 'Total number of cache misses',
    labelNames: ['type', 'tenant_id'],
  });

  // WebSocket metrics
  private activeWebSocketConnections = new Gauge({
    name: 'websocket_connections_active',
    help: 'Number of active WebSocket connections',
    labelNames: ['tenant_id'],
  });

  private websocketMessages = new Counter({
    name: 'websocket_messages_total',
    help: 'Total number of WebSocket messages',
    labelNames: ['type', 'tenant_id'],
  });

  // Billing metrics
  private revenue = new Counter({
    name: 'revenue_generated_total',
    help: 'Total revenue generated',
    labelNames: ['currency', 'plan', 'tenant_id'],
    // This should be a Summary in production, but Counter for simplicity
  });

  private trialConversions = new Counter({
    name: 'trial_conversions_total',
    help: 'Number of trial conversions to paid',
    labelNames: ['plan', 'tenant_id'],
  });

  // Rate limiting metrics
  private rateLimitHits = new Counter({
    name: 'rate_limit_hits_total',
    help: 'Total number of rate limit hits',
    labelNames: ['tenant_id', 'endpoint'],
  });

  // Error metrics
  private errorCounter = new Counter({
    name: 'errors_total',
    help: 'Total number of errors',
    labelNames: ['type', 'tenant_id', 'endpoint'],
  });

  // API methods
  recordRequest(method: string, route: string, statusCode: number, tenantId?: string) {
    this.requestCounter.inc({ method, route, status_code: statusCode.toString(), tenant_id: tenantId || 'anonymous' });
  }

  recordRequestDuration(method: string, route: string, duration: number, tenantId?: string) {
    this.requestDuration.observe({ method, route, tenant_id: tenantId || 'anonymous' }, duration);
  }

  recordActiveUsers(tenantId: string, count: number) {
    this.activeUsers.set({ tenant_id: tenantId }, count);
  }

  recordActiveProjects(tenantId: string, count: number) {
    this.activeProjects.set({ tenant_id: tenantId }, count);
  }

  recordSubscription(plan: string, tenantId: string, count: number) {
    this.subscriptionMetrics.set({ plan, tenant_id: tenantId }, count);
  }

  recordCacheHit(type: string, tenantId?: string) {
    this.cacheHits.inc({ type, tenant_id: tenantId || 'anonymous' });
  }

  recordCacheMiss(type: string, tenantId?: string) {
    this.cacheMisses.inc({ type, tenant_id: tenantId || 'anonymous' });
  }

  recordWebSocketConnection(tenantId: string, isConnected: boolean) {
    const current = this.activeWebSocketConnections.get({ tenant_id: tenantId }) || 0;
    this.activeWebSocketConnections.set({ tenant_id: tenantId }, isConnected ? current + 1 : current - 1);
  }

  recordWebSocketMessage(type: string, tenantId?: string) {
    this.websocketMessages.inc({ type, tenant_id: tenantId || 'anonymous' });
  }

  recordRevenue(amount: number, currency: string, plan: string, tenantId?: string) {
    this.revenue.inc({ currency, plan, tenant_id: tenantId || 'anonymous' }, amount);
  }

  recordTrialConversion(plan: string, tenantId?: string) {
    this.trialConversions.inc({ plan, tenant_id: tenantId || 'anonymous' });
  }

  recordRateLimitHit(tenantId: string, endpoint: string) {
    this.rateLimitHits.inc({ tenant_id: tenantId, endpoint });
  }

  recordError(type: string, tenantId?: string, endpoint?: string) {
    this.errorCounter.inc({ type, tenant_id: tenant_id || 'anonymous', endpoint: endpoint || 'unknown' });
  }

  // System metrics collection
  collectSystemMetrics() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memory = process.memoryUsage();
      this.memoryUsage.set(memory.heapUsed);
      this.memoryUsage.set({ metric: 'rss' }, memory.rss);
      this.memoryUsage.set({ metric: 'heapTotal' }, memory.heapTotal);
      this.memoryUsage.set({ metric: 'external' }, memory.external);
    }

    if (typeof process !== 'undefined' && process.cpuUsage) {
      const cpu = process.cpuUsage();
      const usagePercent = (cpu.user + cpu.system) / 1000000; // Convert to seconds
      this.cpuUsage.set(usagePercent);
    }
  }

  // Export metrics for Prometheus
  async getMetrics(): Promise<string> {
    return await register.metrics();
  }

  // Get metrics summary
  getSummary() {
    return {
      totalRequests: this.requestCounter._hashMap.size,
      activeUsers: this.activeUsers._hashMap.size,
      activeProjects: this.activeProjects._hashMap.size,
      cacheHits: this.cacheHits._hashMap.size,
      cacheMisses: this.cacheMisses._hashMap.size,
      websocketConnections: this.activeWebSocketConnections._hashMap.size,
      errors: this.errorCounter._hashMap.size,
    };
  }
}

export const metrics = new Metrics();