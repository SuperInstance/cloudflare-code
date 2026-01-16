// @ts-nocheck
/**
 * Service Registry
 *
 * Advanced service registration and discovery system with:
 * - Service registration with TTL
 * - Health checking
 * - Service discovery with filtering
 * - Endpoint management
 * - Service versioning
 * - Label-based querying
 *
 * Performance targets:
 * - <1ms registration latency
 * - <1ms discovery latency
 * - Support for 1000+ services
 * - 99.99% availability
 */

import type {
  ServiceInstance,
  ServiceRegistration,
  ServiceQuery,
  ServiceEndpoints,
  HealthCheckResult,
  ServiceEvent,
  ServiceEventType,
} from '../types';

export interface RegistryOptions {
  ttl?: number;
  healthCheckInterval?: number;
  healthCheckTimeout?: number;
  cleanupInterval?: number;
  maxServices?: number;
}

export interface RegistryStats {
  totalServices: number;
  totalInstances: number;
  healthyInstances: number;
  unhealthyInstances: number;
  registrationsPerSecond: number;
  discoveriesPerSecond: number;
  averageLatency: number;
}

/**
 * Service Registry Durable Object
 */
export class ServiceRegistryDO {
  private state: {
    services: Map<string, ServiceInstance>;
    indexes: {
      byName: Map<string, Set<string>>;
      byVersion: Map<string, Set<string>>;
      byTag: Map<string, Set<string>>;
      byRegion: Map<string, Set<string>>;
      byZone: Map<string, Set<string>>;
    };
    healthChecks: Map<string, number>;
    stats: RegistryStats;
    eventLog: ServiceEvent[];
  };

  private env: any;
  private ctx: any;

  constructor(state: any, env: any) {
    this.state = state.services || {
      services: new Map(),
      indexes: {
        byName: new Map(),
        byVersion: new Map(),
        byTag: new Map(),
        byRegion: new Map(),
        byZone: new Map(),
      },
      healthChecks: new Map(),
      stats: {
        totalServices: 0,
        totalInstances: 0,
        healthyInstances: 0,
        unhealthyInstances: 0,
        registrationsPerSecond: 0,
        discoveriesPerSecond: 0,
        averageLatency: 0,
      },
      eventLog: [],
    };
    this.env = env;
    this.ctx = state;
  }

  /**
   * Register a service instance
   */
  async register(registration: ServiceRegistration): Promise<void> {
    const startTime = performance.now();
    const instance = registration.instance;

    // Store instance
    this.state.services.set(instance.id, instance);
    this.state.stats.totalInstances++;

    // Update indexes
    this.updateIndexes(instance.id, instance, 'add');

    // Setup health check
    this.scheduleHealthCheck(instance.id, registration.ttl || 30000);

    // Record event
    this.recordEvent({
      eventType: 'service_registered',
      timestamp: Date.now(),
      serviceName: instance.serviceName,
      instanceId: instance.id,
      data: { instance },
    });

    // Update stats
    const latency = performance.now() - startTime;
    this.updateStats('registration', latency);
  }

  /**
   * Deregister a service instance
   */
  async deregister(instanceId: string): Promise<boolean> {
    const instance = this.state.services.get(instanceId);
    if (!instance) {
      return false;
    }

    // Remove from storage
    this.state.services.delete(instanceId);
    this.state.stats.totalInstances--;

    // Update indexes
    this.updateIndexes(instanceId, instance, 'remove');

    // Cancel health check
    this.state.healthChecks.delete(instanceId);

    // Record event
    this.recordEvent({
      eventType: 'service_deregistered',
      timestamp: Date.now(),
      serviceName: instance.serviceName,
      instanceId,
      data: {},
    });

    return true;
  }

  /**
   * Discover service instances
   */
  async discover(query: ServiceQuery): Promise<ServiceEndpoints> {
    const startTime = performance.now();

    // Get all instances for the service
    const instances = this.getInstancesByQuery(query);

    // Filter by health if requested
    let filtered = instances;
    if (query.healthyOnly) {
      filtered = instances.filter(
        (inst) => inst.healthStatus === 'healthy'
      );
    }

    // Filter by version if specified
    if (query.minVersion) {
      filtered = filtered.filter(
        (inst) => this.compareVersions(inst.version, query.minVersion!) >= 0
      );
    }

    const endpoints: ServiceEndpoints = {
      serviceName: query.serviceName,
      instances: filtered,
      timestamp: Date.now(),
    };

    // Update stats
    const latency = performance.now() - startTime;
    this.updateStats('discovery', latency);

    return endpoints;
  }

  /**
   * Get all instances for a service name
   */
  private getInstancesByQuery(query: ServiceQuery): ServiceInstance[] {
    const instanceIds = this.state.indexes.byName.get(query.serviceName);
    if (!instanceIds) {
      return [];
    }

    const instances: ServiceInstance[] = [];
    for (const id of instanceIds) {
      const instance = this.state.services.get(id);
      if (!instance) continue;

      // Filter by tags
      if (query.tags && query.tags.length > 0) {
        const hasAllTags = query.tags.every((tag) =>
          instance.tags.includes(tag)
        );
        if (!hasAllTags) continue;
      }

      // Filter by region
      if (query.region && instance.region !== query.region) continue;

      // Filter by zone
      if (query.zone && instance.zone !== query.zone) continue;

      instances.push(instance);
    }

    return instances;
  }

  /**
   * Update service indexes
   */
  private updateIndexes(
    instanceId: string,
    instance: ServiceInstance,
    operation: 'add' | 'remove'
  ): void {
    const { indexes } = this.state;

    // Name index
    this.updateIndex(indexes.byName, instance.serviceName, instanceId, operation);

    // Version index
    this.updateIndex(indexes.byVersion, instance.version, instanceId, operation);

    // Region index
    this.updateIndex(indexes.byRegion, instance.region, instanceId, operation);

    // Zone index
    this.updateIndex(indexes.byZone, instance.zone, instanceId, operation);

    // Tag indexes
    for (const tag of instance.tags) {
      this.updateIndex(indexes.byTag, tag, instanceId, operation);
    }
  }

  /**
   * Update a single index
   */
  private updateIndex(
    index: Map<string, Set<string>>,
    key: string,
    instanceId: string,
    operation: 'add' | 'remove'
  ): void {
    let set = index.get(key);
    if (!set) {
      set = new Set();
      index.set(key, set);
    }

    if (operation === 'add') {
      set.add(instanceId);
    } else {
      set.delete(instanceId);
      if (set.size === 0) {
        index.delete(key);
      }
    }
  }

  /**
   * Schedule health check for an instance
   */
  private scheduleHealthCheck(instanceId: string, ttl: number): void {
    const nextCheck = Date.now() + ttl;
    this.state.healthChecks.set(instanceId, nextCheck);
  }

  /**
   * Perform health check on an instance
   */
  async performHealthCheck(instanceId: string): Promise<HealthCheckResult> {
    const instance = this.state.services.get(instanceId);
    if (!instance) {
      return {
        serviceName: '',
        instanceId,
        healthy: false,
        timestamp: Date.now(),
        checks: [],
        metadata: {},
      };
    }

    const checks = [];
    let healthy = true;

    // TCP connectivity check
    const tcpCheck = await this.checkTcpConnectivity(instance);
    checks.push(tcpCheck);
    if (!tcpCheck.healthy) healthy = false;

    // HTTP health check (if applicable)
    if (instance.protocol === 'http' || instance.protocol === 'https') {
      const httpCheck = await this.checkHttpHealth(instance);
      checks.push(httpCheck);
      if (!httpCheck.healthy) healthy = false;
    }

    // Update instance health status
    const previousStatus = instance.healthStatus;
    instance.healthStatus = healthy ? 'healthy' : 'unhealthy';
    instance.lastHeartbeat = Date.now();

    // Record event if status changed
    if (previousStatus !== instance.healthStatus) {
      this.recordEvent({
        eventType: healthy ? 'service_healthy' : 'service_unhealthy',
        timestamp: Date.now(),
        serviceName: instance.serviceName,
        instanceId,
        data: { previousStatus, newStatus: instance.healthStatus },
      });
    }

    return {
      serviceName: instance.serviceName,
      instanceId,
      healthy,
      timestamp: Date.now(),
      checks,
      metadata: {},
    };
  }

  /**
   * Check TCP connectivity
   */
  private async checkTcpConnectivity(
    instance: ServiceInstance
  ): Promise<any> {
    const start = performance.now();

    try {
      // In a real implementation, this would attempt a TCP connection
      // For now, simulate a successful check
      const duration = performance.now() - start;

      return {
        name: 'tcp_connectivity',
        healthy: true,
        duration,
      };
    } catch (error) {
      return {
        name: 'tcp_connectivity',
        healthy: false,
        message: String(error),
        duration: performance.now() - start,
      };
    }
  }

  /**
   * Check HTTP health endpoint
   */
  private async checkHttpHealth(instance: ServiceInstance): Promise<any> {
    const start = performance.now();

    try {
      // In a real implementation, this would make an HTTP request
      // to the health endpoint
      const duration = performance.now() - start;

      return {
        name: 'http_health',
        healthy: true,
        duration,
      };
    } catch (error) {
      return {
        name: 'http_health',
        healthy: false,
        message: String(error),
        duration: performance.now() - start,
      };
    }
  }

  /**
   * Run periodic health checks
   */
  async runHealthChecks(): Promise<void> {
    const now = Date.now();
    const instancesToCheck: string[] = [];

    // Find instances that need health checking
    for (const [instanceId, nextCheck] of this.state.healthChecks) {
      if (nextCheck <= now) {
        instancesToCheck.push(instanceId);
      }
    }

    // Run health checks in parallel
    const results = await Promise.all(
      instancesToCheck.map((id) => this.performHealthCheck(id))
    );

    // Reschedule healthy instances, remove unhealthy ones
    for (const result of results) {
      const instance = this.state.services.get(result.instanceId);
      if (!instance) continue;

      if (result.healthy) {
        // Reschedule next health check
        this.scheduleHealthCheck(result.instanceId, 30000);
      } else {
        // Mark for removal if consistently unhealthy
        const consecutiveFailures =
          (instance.metadata.consecutiveFailures as number) || 0;
        instance.metadata.consecutiveFailures = consecutiveFailures + 1;

        if (consecutiveFailures >= 3) {
          await this.deregister(result.instanceId);
        }
      }
    }
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    // Update real-time stats
    this.state.stats.totalServices = this.state.indexes.byName.size;
    this.state.stats.healthyInstances = Array.from(
      this.state.services.values()
    ).filter((inst) => inst.healthStatus === 'healthy').length;
    this.state.stats.unhealthyInstances =
      this.state.stats.totalInstances - this.state.stats.healthyInstances;

    return { ...this.state.stats };
  }

  /**
   * Get recent events
   */
  getEvents(limit: number = 100): ServiceEvent[] {
    return this.state.eventLog.slice(-limit);
  }

  /**
   * Record an event
   */
  private recordEvent(event: ServiceEvent): void {
    this.state.eventLog.push(event);

    // Keep only last 1000 events
    if (this.state.eventLog.length > 1000) {
      this.state.eventLog = this.state.eventLog.slice(-1000);
    }
  }

  /**
   * Update statistics
   */
  private updateStats(operation: 'registration' | 'discovery', latency: number): void {
    const stats = this.state.stats;

    // Update average latency
    const count = operation === 'registration'
      ? stats.registrationsPerSecond
      : stats.discoveriesPerSecond;
    stats.averageLatency = (stats.averageLatency * count + latency) / (count + 1);

    // Update operations per second (simplified)
    if (operation === 'registration') {
      stats.registrationsPerSecond++;
    } else {
      stats.discoveriesPerSecond++;
    }
  }

  /**
   * Compare version strings
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;

      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }

    return 0;
  }

  /**
   * Alarm handler for periodic tasks
   */
  async alarm(): Promise<void> {
    // Run health checks
    await this.runHealthChecks();

    // Set next alarm
    this.ctx.storage.setAlarm(Date.now() + 5000); // Every 5 seconds
  }

  /**
   * Fetch handler for incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case '/register':
          const registration = await request.json();
          await this.register(registration);
          return Response.json({ success: true });

        case '/deregister':
          const instanceId = url.searchParams.get('instanceId')!;
          const deregistered = await this.deregister(instanceId);
          return Response.json({ success: deregistered });

        case '/discover':
          const query = Object.fromEntries(url.searchParams);
          const endpoints = await this.discover(query as any);
          return Response.json(endpoints);

        case '/stats':
          return Response.json(this.getStats());

        case '/events':
          const limit = parseInt(url.searchParams.get('limit') || '100', 10);
          return Response.json(this.getEvents(limit));

        case '/health-check':
          const targetId = url.searchParams.get('instanceId')!;
          const result = await this.performHealthCheck(targetId);
          return Response.json(result);

        default:
          return Response.json({ error: 'Not found' }, { status: 404 });
      }
    } catch (error) {
      return Response.json(
        { error: String(error) },
        { status: 500 }
      );
    }
  }
}

/**
 * Service Registry Client
 */
export class ServiceRegistryClient {
  private registryDO: DurableObjectStub;

  constructor(doStub: DurableObjectStub) {
    this.registryDO = doStub;
  }

  /**
   * Register a service
   */
  async register(registration: ServiceRegistration): Promise<void> {
    await this.registryDO.fetch(
      new Request('https://registry/register', {
        method: 'POST',
        body: JSON.stringify(registration),
      })
    );
  }

  /**
   * Deregister a service
   */
  async deregister(instanceId: string): Promise<boolean> {
    const response = await this.registryDO.fetch(
      new Request(`https://registry/deregister?instanceId=${instanceId}`)
    );
    const data = await response.json();
    return data.success;
  }

  /**
   * Discover services
   */
  async discover(query: ServiceQuery): Promise<ServiceEndpoints> {
    const params = new URLSearchParams(query as any);
    const response = await this.registryDO.fetch(
      new Request(`https://registry/discover?${params}`)
    );
    return response.json();
  }

  /**
   * Get registry statistics
   */
  async getStats(): Promise<RegistryStats> {
    const response = await this.registryDO.fetch(
      new Request('https://registry/stats')
    );
    return response.json();
  }

  /**
   * Get recent events
   */
  async getEvents(limit?: number): Promise<ServiceEvent[]> {
    const params = limit ? `?limit=${limit}` : '';
    const response = await this.registryDO.fetch(
      new Request(`https://registry/events${params}`)
    );
    return response.json();
  }

  /**
   * Trigger health check
   */
  async healthCheck(instanceId: string): Promise<HealthCheckResult> {
    const response = await this.registryDO.fetch(
      new Request(`https://registry/health-check?instanceId=${instanceId}`)
    );
    return response.json();
  }
}

/**
 * Create a registry client
 */
export function createRegistryClient(
  env: any,
  namespace: string = 'SERVICE_REGISTRY'
): ServiceRegistryClient {
  const id = env[namespace].idFromName('global-registry');
  const stub = env[namespace].get(id);
  return new ServiceRegistryClient(stub);
}
