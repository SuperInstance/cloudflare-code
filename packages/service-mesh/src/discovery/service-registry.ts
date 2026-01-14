/**
 * Service Registry Durable Object
 * Manages service registration, discovery, and health checking
 */

import {
  ServiceInstance,
  ServiceRegistration,
  ServiceQuery,
  ServiceEndpoints,
  HealthStatus,
  ServiceEvent,
  ServiceEventType
} from '../types';

interface RegistryState {
  services: Map<string, ServiceInstance[]>;
  serviceIndexes: Map<string, Set<string>>; // name -> instance IDs
  tagIndex: Map<string, Set<string>>; // tag -> instance IDs
  regionIndex: Map<string, Set<string>>; // region -> instance IDs
  events: ServiceEvent[];
  lastCleanup: number;
}

const DEFAULT_TTL = 30000; // 30 seconds
const CLEANUP_INTERVAL = 60000; // 1 minute
const MAX_EVENTS = 10000;

export class ServiceRegistry {
  private state: DurableObjectStorage;
  private env: any;
  private ctx: ExecutionContext;

  constructor(state: DurableObjectStorage, env: any) {
    this.state = state;
    this.env = env;
    this.ctx = env.ctx;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (true) {
        case path === '/register' && request.method === 'POST':
          return this.handleRegister(request);

        case path === '/deregister' && request.method === 'DELETE':
          return this.handleDeregister(request);

        case path === '/discover' && request.method === 'GET':
          return this.handleDiscover(url);

        case path === '/heartbeat' && request.method === 'POST':
          return this.handleHeartbeat(request);

        case path === '/health' && request.method === 'GET':
          return this.handleHealthCheck();

        case path === '/list' && request.method === 'GET':
          return this.handleListServices();

        case path === '/events' && request.method === 'GET':
          return this.handleGetEvents(url);

        case path === '/query' && request.method === 'POST':
          return this.handleQuery(request);

        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  /**
   * Register a new service instance
   */
  private async handleRegister(request: Request): Promise<Response> {
    const registration: ServiceRegistration = await request.json();

    // Validate registration
    if (!registration.serviceName || !registration.instance) {
      return new Response(
        JSON.stringify({ error: 'Invalid registration data' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const state = await this.getState();

    // Check if instance already exists
    const existingIndex = state.serviceIndexes.get(registration.serviceName);
    if (existingIndex && existingIndex.has(registration.instance.id)) {
      // Update existing instance
      await this.updateInstance(registration);
    } else {
      // Add new instance
      await this.addInstance(registration);
    }

    // Emit registration event
    await this.emitEvent({
      eventType: 'service_registered',
      timestamp: Date.now(),
      serviceName: registration.serviceName,
      instanceId: registration.instance.id,
      data: { instance: registration.instance }
    });

    return new Response(
      JSON.stringify({
        success: true,
        instanceId: registration.instance.id,
        ttl: registration.ttl || DEFAULT_TTL
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Deregister a service instance
   */
  private async handleDeregister(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const serviceName = url.searchParams.get('serviceName');
    const instanceId = url.searchParams.get('instanceId');

    if (!serviceName || !instanceId) {
      return new Response(
        JSON.stringify({ error: 'serviceName and instanceId are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await this.removeInstance(serviceName, instanceId);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Discover service endpoints
   */
  private async handleDiscover(url: URL): Promise<Response> {
    const serviceName = url.searchParams.get('serviceName');

    if (!serviceName) {
      return new Response(
        JSON.stringify({ error: 'serviceName is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const healthyOnly = url.searchParams.get('healthyOnly') === 'true';
    const region = url.searchParams.get('region') || undefined;
    const tags = url.searchParams.get('tags')?.split(',').filter(Boolean) || [];

    const query: ServiceQuery = {
      serviceName,
      healthyOnly,
      region,
      tags: tags.length > 0 ? tags : undefined
    };

    const endpoints = await this.discover(query);

    return new Response(
      JSON.stringify(endpoints),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Handle service heartbeat
   */
  private async handleHeartbeat(request: Request): Promise<Response> {
    const { serviceName, instanceId } = await request.json();

    if (!serviceName || !instanceId) {
      return new Response(
        JSON.stringify({ error: 'serviceName and instanceId are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const updated = await this.updateHeartbeat(serviceName, instanceId);

    return new Response(
      JSON.stringify({ success: updated }),
      { status: updated ? 200 : 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Health check for the registry itself
   */
  private async handleHealthCheck(): Promise<Response> {
    const state = await this.getState();
    const serviceCount = state.services.size;
    const totalInstances = Array.from(state.services.values())
      .reduce((sum, instances) => sum + instances.length, 0);

    return new Response(
      JSON.stringify({
        healthy: true,
        serviceCount,
        totalInstances,
        timestamp: Date.now()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * List all registered services
   */
  private async handleListServices(): Promise<Response> {
    const state = await this.getState();

    const services = Array.from(state.services.entries()).map(([name, instances]) => ({
      name,
      instanceCount: instances.length,
      healthyCount: instances.filter(i => i.healthStatus === 'healthy').length,
      instances: instances.map(i => ({
        id: i.id,
        host: i.host,
        port: i.port,
        healthStatus: i.healthStatus,
        lastHeartbeat: i.lastHeartbeat
      }))
    }));

    return new Response(
      JSON.stringify({ services }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Get recent events
   */
  private async handleGetEvents(url: URL): Promise<Response> {
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const eventType = url.searchParams.get('eventType');
    const serviceName = url.searchParams.get('serviceName');

    const state = await this.getState();
    let events = state.events;

    if (eventType) {
      events = events.filter(e => e.eventType === eventType);
    }

    if (serviceName) {
      events = events.filter(e => e.serviceName === serviceName);
    }

    events = events.slice(-limit);

    return new Response(
      JSON.stringify({ events }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  /**
   * Query services with complex criteria
   */
  private async handleQuery(request: Request): Promise<Response> {
    const query: ServiceQuery = await request.json();

    if (!query.serviceName) {
      return new Response(
        JSON.stringify({ error: 'serviceName is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const endpoints = await this.discover(query);

    return new Response(
      JSON.stringify(endpoints),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ========================================================================
  // Core Methods
  // ========================================================================

  private async getState(): Promise<RegistryState> {
    const servicesList = await this.state.get<ServiceInstance[]>('services') || [];
    const services = new Map<string, ServiceInstance[]>();

    for (const item of servicesList) {
      const serviceInstances = services.get(item.serviceName) || [];
      serviceInstances.push(item);
      services.set(item.serviceName, serviceInstances);
    }

    const serviceIndexesData = await this.state.get<Map<string, string[]>>('serviceIndexes');
    const serviceIndexes = new Map<string, Set<string>>();
    if (serviceIndexesData) {
      for (const [key, values] of serviceIndexesData.entries()) {
        serviceIndexes.set(key, new Set(values));
      }
    }

    const tagIndexData = await this.state.get<Map<string, string[]>>('tagIndex');
    const tagIndex = new Map<string, Set<string>>();
    if (tagIndexData) {
      for (const [key, values] of tagIndexData.entries()) {
        tagIndex.set(key, new Set(values));
      }
    }

    const regionIndexData = await this.state.get<Map<string, string[]>>('regionIndex');
    const regionIndex = new Map<string, Set<string>>();
    if (regionIndexData) {
      for (const [key, values] of regionIndexData.entries()) {
        regionIndex.set(key, new Set(values));
      }
    }

    const events = await this.state.get<ServiceEvent[]>('events') || [];
    const lastCleanup = await this.state.get<number>('lastCleanup') || 0;

    return {
      services,
      serviceIndexes,
      tagIndex,
      regionIndex,
      events,
      lastCleanup
    };
  }

  private async saveState(state: RegistryState): Promise<void> {
    const servicesList = Array.from(state.services.values()).flat();

    const serviceIndexesMap = new Map<string, string[]>();
    for (const [key, values] of state.serviceIndexes.entries()) {
      serviceIndexesMap.set(key, Array.from(values));
    }

    const tagIndexMap = new Map<string, string[]>();
    for (const [key, values] of state.tagIndex.entries()) {
      tagIndexMap.set(key, Array.from(values));
    }

    const regionIndexMap = new Map<string, string[]>();
    for (const [key, values] of state.regionIndex.entries()) {
      regionIndexMap.set(key, Array.from(values));
    }

    await this.state.put([
      { key: 'services', value: servicesList },
      { key: 'serviceIndexes', value: serviceIndexesMap },
      { key: 'tagIndex', value: tagIndexMap },
      { key: 'regionIndex', value: regionIndexMap },
      { key: 'events', value: state.events.slice(-MAX_EVENTS) },
      { key: 'lastCleanup', value: state.lastCleanup }
    ]);
  }

  private async addInstance(registration: ServiceRegistration): Promise<void> {
    const state = await this.getState();

    const instances = state.services.get(registration.serviceName) || [];
    instances.push(registration.instance);
    state.services.set(registration.serviceName, instances);

    // Update indexes
    const index = state.serviceIndexes.get(registration.serviceName) || new Set();
    index.add(registration.instance.id);
    state.serviceIndexes.set(registration.serviceName, index);

    // Tag index
    for (const tag of registration.instance.tags) {
      const tagSet = state.tagIndex.get(tag) || new Set();
      tagSet.add(registration.instance.id);
      state.tagIndex.set(tag, tagSet);
    }

    // Region index
    const regionSet = state.regionIndex.get(registration.instance.region) || new Set();
    regionSet.add(registration.instance.id);
    state.regionIndex.set(registration.instance.region, regionSet);

    await this.saveState(state);
  }

  private async updateInstance(registration: ServiceRegistration): Promise<void> {
    const state = await this.getState();
    const instances = state.services.get(registration.serviceName) || [];

    const index = instances.findIndex(i => i.id === registration.instance.id);
    if (index !== -1) {
      instances[index] = registration.instance;
      state.services.set(registration.serviceName, instances);
      await this.saveState(state);
    }
  }

  private async removeInstance(serviceName: string, instanceId: string): Promise<void> {
    const state = await this.getState();
    const instances = state.services.get(serviceName) || [];

    const index = instances.findIndex(i => i.id === instanceId);
    if (index !== -1) {
      const instance = instances[index];
      instances.splice(index, 1);

      if (instances.length === 0) {
        state.services.delete(serviceName);
      } else {
        state.services.set(serviceName, instances);
      }

      // Update indexes
      const serviceIndex = state.serviceIndexes.get(serviceName);
      if (serviceIndex) {
        serviceIndex.delete(instanceId);
        if (serviceIndex.size === 0) {
          state.serviceIndexes.delete(serviceName);
        }
      }

      // Tag index
      for (const tag of instance.tags) {
        const tagSet = state.tagIndex.get(tag);
        if (tagSet) {
          tagSet.delete(instanceId);
          if (tagSet.size === 0) {
            state.tagIndex.delete(tag);
          }
        }
      }

      // Region index
      const regionSet = state.regionIndex.get(instance.region);
      if (regionSet) {
        regionSet.delete(instanceId);
        if (regionSet.size === 0) {
          state.regionIndex.delete(instance.region);
        }
      }

      // Emit event
      await this.emitEvent({
        eventType: 'service_deregistered',
        timestamp: Date.now(),
        serviceName,
        instanceId,
        data: { instance }
      });

      await this.saveState(state);
    }
  }

  private async updateHeartbeat(serviceName: string, instanceId: string): Promise<boolean> {
    const state = await this.getState();
    const instances = state.services.get(serviceName) || [];

    const instance = instances.find(i => i.id === instanceId);
    if (instance) {
      instance.lastHeartbeat = Date.now();

      // Mark as healthy if was unhealthy
      if (instance.healthStatus !== 'healthy') {
        instance.healthStatus = 'healthy';

        await this.emitEvent({
          eventType: 'service_healthy',
          timestamp: Date.now(),
          serviceName,
          instanceId,
          data: { instance }
        });
      }

      await this.saveState(state);
      return true;
    }

    return false;
  }

  private async discover(query: ServiceQuery): Promise<ServiceEndpoints> {
    const state = await this.getState();

    // Perform cleanup if needed
    await this.performCleanupIfNeeded(state);

    let instances = state.services.get(query.serviceName) || [];

    // Apply filters
    if (query.healthyOnly) {
      instances = instances.filter(i => i.healthStatus === 'healthy');
    }

    if (query.tags && query.tags.length > 0) {
      const matchingIds = new Set<string>();
      for (const tag of query.tags) {
        const tagSet = state.tagIndex.get(tag);
        if (tagSet) {
          for (const id of tagSet) {
            matchingIds.add(id);
          }
        }
      }
      instances = instances.filter(i => matchingIds.has(i.id));
    }

    if (query.region) {
      const regionSet = state.regionIndex.get(query.region);
      if (regionSet) {
        instances = instances.filter(i => regionSet.has(i.id));
      } else {
        instances = [];
      }
    }

    if (query.minVersion) {
      instances = instances.filter(i =>
        this.compareVersions(i.version, query.minVersion) >= 0
      );
    }

    return {
      serviceName: query.serviceName,
      instances,
      timestamp: Date.now()
    };
  }

  private async performCleanupIfNeeded(state: RegistryState): Promise<void> {
    const now = Date.now();
    if (now - state.lastCleanup < CLEANUP_INTERVAL) {
      return;
    }

    const threshold = now - DEFAULT_TTL;
    let hasChanges = false;

    for (const [serviceName, instances] of state.services.entries()) {
      const toRemove: string[] = [];

      for (const instance of instances) {
        if (instance.lastHeartbeat < threshold) {
          toRemove.push(instance.id);
        }
      }

      for (const instanceId of toRemove) {
        await this.removeInstance(serviceName, instanceId);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      state.lastCleanup = now;
      await this.saveState(state);
    }
  }

  private async emitEvent(event: ServiceEvent): Promise<void> {
    const state = await this.getState();
    state.events.push(event);

    // Keep only recent events
    if (state.events.length > MAX_EVENTS) {
      state.events = state.events.slice(-MAX_EVENTS);
    }

    await this.saveState(state);

    // Optionally send to external event system
    if (this.env.EVENT_DISPATCHER) {
      try {
        const dispatcher = this.env.EVENT_DISPATCHER as DurableObjectNamespace;
        const stub = dispatcher.get(this.env.EVENT_DISPATCHER.idFromName('events'));
        await stub.fetch(new Request('https://events/internal', {
          method: 'POST',
          body: JSON.stringify(event)
        }));
      } catch (error) {
        console.error('Failed to dispatch event:', error);
      }
    }
  }

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

  async alarm() {
    // Perform periodic cleanup
    const state = await this.getState();
    await this.performCleanupIfNeeded(state);
  }
}
