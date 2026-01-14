/**
 * Service Registry Implementation
 *
 * Comprehensive service registry with discovery, health checks, and lifecycle management.
 * Built on Cloudflare Durable Objects for distributed consistency.
 */

import type {
  ResourceId,
  ServiceInstance,
  ServiceMetadata,
  ServiceRegistrationOptions,
  ServiceHealth,
  HealthCheckResult,
  ServiceRegistryEvent,
  ServiceType,
  ServicePriority,
} from '../types/core';

import { ServiceLifecycle } from '../types/core';

/**
 * Service Registry Durable Object
 */
export class ServiceRegistryDurableObject {
  private state: DurableObjectState;
  private services: Map<ResourceId, ServiceRecord>;
  private byType: Map<ServiceType, Set<ResourceId>>;
  private byTag: Map<string, Set<ResourceId>>;
  private healthStatus: Map<ResourceId, HealthCheckResult>;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.services = new Map();
    this.byType = new Map();
    this.byTag = new Map();
    this.healthStatus = new Map();

    // Load from storage
    this.loadFromStorage();
  }

  private async loadFromStorage(): Promise<void> {
    const data = await this.state.storage.get<RegistryData>('registry');
    if (data) {
      this.services = new Map(data.services);
      this.byType = new Map(
        Array.from(data.byType).map(([k, v]) => [k, new Set(v)])
      );
      this.byTag = new Map(
        Array.from(data.byTag).map(([k, v]) => [k, new Set(v)])
      );
      this.healthStatus = new Map(data.healthStatus);
    }
  }

  private async saveToStorage(): Promise<void> {
    await this.state.storage.put('registry', {
      services: Array.from(this.services.entries()),
      byType: Array.from(this.byType.entries()).map(([k, v]) => [k, Array.from(v)]),
      byTag: Array.from(this.byTag.entries()).map(([k, v]) => [k, Array.from(v)]),
      healthStatus: Array.from(this.healthStatus.entries()),
    } as RegistryData);
  }

  /**
   * Register a new service
   */
  async register<T>(
    id: ResourceId,
    factory: () => T | Promise<T>,
    options: ServiceRegistrationOptions
  ): Promise<ServiceMetadata> {
    const now = Date.now();

    const metadata: ServiceMetadata = {
      id,
      name: options.name || id,
      type: options.type,
      version: options.version || '1.0.0',
      priority: options.priority || ServicePriority.NORMAL,
      dependencies: options.dependencies || [],
      tags: new Set(options.tags || []),
      created: now,
      updated: now,
    };

    const record: ServiceRecord = {
      metadata,
      factory: factory.toString(),
      lifecycle: ServiceLifecycle.CREATED,
      singleton: options.singleton !== false,
      lazy: options.lazy || false,
      instance: null,
      initialized: false,
    };

    this.services.set(id, record);

    // Update indexes
    this.updateIndexes(id, metadata);

    // Initialize health status
    this.healthStatus.set(id, {
      serviceId: id,
      status: 'starting' as ServiceHealth,
      message: 'Service registered',
      checks: [],
      timestamp: now,
    });

    await this.saveToStorage();

    return metadata;
  }

  /**
   * Unregister a service
   */
  async unregister(id: ResourceId): Promise<void> {
    const record = this.services.get(id);
    if (!record) {
      throw new Error(`Service not found: ${id}`);
    }

    // Stop if running
    if (record.lifecycle === ServiceLifecycle.STARTED) {
      await this.stop(id);
    }

    // Remove from indexes
    const metadata = record.metadata;
    for (const type of [metadata.type]) {
      const ids = this.byType.get(type);
      if (ids) {
        ids.delete(id);
        if (ids.size === 0) {
          this.byType.delete(type);
        }
      }
    }

    for (const tag of metadata.tags) {
      const ids = this.byTag.get(tag);
      if (ids) {
        ids.delete(id);
        if (ids.size === 0) {
          this.byTag.delete(tag);
        }
      }
    }

    this.services.delete(id);
    this.healthStatus.delete(id);

    await this.saveToStorage();
  }

  /**
   * Initialize a service
   */
  async initialize(id: ResourceId): Promise<void> {
    const record = this.services.get(id);
    if (!record) {
      throw new Error(`Service not found: ${id}`);
    }

    if (record.lifecycle !== ServiceLifecycle.CREATED) {
      throw new Error(
        `Service cannot be initialized from state: ${record.lifecycle}`
      );
    }

    record.lifecycle = ServiceLifecycle.INITIALIZING;
    await this.saveToStorage();

    try {
      // Execute factory
      const factory = eval(record.factory) as () => unknown;
      const instance = await factory();

      record.instance = instance;
      record.initialized = true;
      record.lifecycle = ServiceLifecycle.INITIALIZED;

      // Update health
      this.healthStatus.set(id, {
        serviceId: id,
        status: 'healthy' as ServiceHealth,
        message: 'Service initialized',
        checks: [],
        timestamp: Date.now(),
      });

      await this.saveToStorage();
    } catch (error) {
      record.lifecycle = ServiceLifecycle.FAILED;
      await this.saveToStorage();
      throw error;
    }
  }

  /**
   * Start a service
   */
  async start(id: ResourceId): Promise<void> {
    const record = this.services.get(id);
    if (!record) {
      throw new Error(`Service not found: ${id}`);
    }

    if (record.lifecycle !== ServiceLifecycle.INITIALIZED) {
      throw new Error(
        `Service cannot be started from state: ${record.lifecycle}`
      );
    }

    record.lifecycle = ServiceLifecycle.STARTING;
    await this.saveToStorage();

    try {
      // Call start method if exists
      const instance = record.instance as any;
      if (instance && typeof instance.start === 'function') {
        await instance.start();
      }

      record.lifecycle = ServiceLifecycle.STARTED;

      // Update health
      this.healthStatus.set(id, {
        serviceId: id,
        status: 'healthy' as ServiceHealth,
        message: 'Service started',
        checks: [],
        timestamp: Date.now(),
      });

      await this.saveToStorage();
    } catch (error) {
      record.lifecycle = ServiceLifecycle.FAILED;
      await this.saveToStorage();
      throw error;
    }
  }

  /**
   * Stop a service
   */
  async stop(id: ResourceId): Promise<void> {
    const record = this.services.get(id);
    if (!record) {
      throw new Error(`Service not found: ${id}`);
    }

    if (record.lifecycle !== ServiceLifecycle.STARTED) {
      return;
    }

    record.lifecycle = ServiceLifecycle.STOPPING;
    await this.saveToStorage();

    try {
      const instance = record.instance as any;
      if (instance && typeof instance.stop === 'function') {
        await instance.stop();
      }

      record.lifecycle = ServiceLifecycle.STOPPED;

      this.healthStatus.set(id, {
        serviceId: id,
        status: 'stopped' as ServiceHealth,
        message: 'Service stopped',
        checks: [],
        timestamp: Date.now(),
      });

      await this.saveToStorage();
    } catch (error) {
      record.lifecycle = ServiceLifecycle.FAILED;
      await this.saveToStorage();
      throw error;
    }
  }

  /**
   * Get a service instance
   */
  get<T>(id: ResourceId): T | undefined {
    const record = this.services.get(id);
    if (!record || !record.initialized) {
      return undefined;
    }
    return record.instance as T;
  }

  /**
   * Get services by type
   */
  getByType(type: ServiceType): ServiceInstance[] {
    const ids = this.byType.get(type);
    if (!ids) {
      return [];
    }

    const services: ServiceInstance[] = [];
    for (const id of ids) {
      const record = this.services.get(id);
      if (record && record.initialized) {
        services.push(this.createServiceInstance(record));
      }
    }

    return services.sort(
      (a, b) => a.metadata.priority - b.metadata.priority
    );
  }

  /**
   * Get services by tag
   */
  getByTag(tag: string): ServiceInstance[] {
    const ids = this.byTag.get(tag);
    if (!ids) {
      return [];
    }

    const services: ServiceInstance[] = [];
    for (const id of ids) {
      const record = this.services.get(id);
      if (record && record.initialized) {
        services.push(this.createServiceInstance(record));
      }
    }

    return services;
  }

  /**
   * Check service health
   */
  async checkHealth(id: ResourceId): Promise<HealthCheckResult> {
    const record = this.services.get(id);
    if (!record) {
      return {
        serviceId: id,
        status: 'unknown' as ServiceHealth,
        message: 'Service not found',
        checks: [],
        timestamp: Date.now(),
      };
    }

    try {
      const instance = record.instance as any;
      if (instance && typeof instance.checkHealth === 'function') {
        const result = await instance.checkHealth();
        this.healthStatus.set(id, result);
        await this.saveToStorage();
        return result;
      }

      // Default health check
      const result: HealthCheckResult = {
        serviceId: id,
        status: record.lifecycle === ServiceLifecycle.STARTED
          ? 'healthy' as ServiceHealth
          : 'unhealthy' as ServiceHealth,
        message: `Service is ${record.lifecycle}`,
        checks: [],
        timestamp: Date.now(),
      };

      this.healthStatus.set(id, result);
      await this.saveToStorage();
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        serviceId: id,
        status: 'unhealthy' as ServiceHealth,
        message: error instanceof Error ? error.message : 'Unknown error',
        checks: [],
        timestamp: Date.now(),
      };

      this.healthStatus.set(id, result);
      await this.saveToStorage();
      return result;
    }
  }

  /**
   * Check all service health
   */
  async checkAllHealth(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    for (const id of this.services.keys()) {
      const result = await this.checkHealth(id);
      results.push(result);
    }

    return results;
  }

  /**
   * Get all services
   */
  getAll(): ServiceInstance[] {
    const services: ServiceInstance[] = [];

    for (const record of this.services.values()) {
      if (record.initialized) {
        services.push(this.createServiceInstance(record));
      }
    }

    return services.sort(
      (a, b) => a.metadata.priority - b.metadata.priority
    );
  }

  /**
   * Get service metadata
   */
  getMetadata(id: ResourceId): ServiceMetadata | undefined {
    const record = this.services.get(id);
    return record?.metadata;
  }

  private updateIndexes(id: ResourceId, metadata: ServiceMetadata): void {
    // Type index
    if (!this.byType.has(metadata.type)) {
      this.byType.set(metadata.type, new Set());
    }
    this.byType.get(metadata.type)!.add(id);

    // Tag index
    for (const tag of metadata.tags) {
      if (!this.byTag.has(tag)) {
        this.byTag.set(tag, new Set());
      }
      this.byTag.get(tag)!.add(id);
    }
  }

  private createServiceInstance(record: ServiceRecord): ServiceInstance {
    return {
      metadata: record.metadata,
      lifecycle: record.lifecycle,
      health: this.healthStatus.get(record.metadata.id) || {
        serviceId: record.metadata.id,
        status: 'unknown' as ServiceHealth,
        checks: [],
        timestamp: Date.now(),
      },
      instance: record.instance!,
      initialize: async () => {
        await this.initialize(record.metadata.id);
      },
      start: async () => {
        await this.start(record.metadata.id);
      },
      stop: async () => {
        await this.stop(record.metadata.id);
      },
      destroy: async () => {
        await this.unregister(record.metadata.id);
      },
      checkHealth: async () => {
        return this.checkHealth(record.metadata.id);
      },
    };
  }
}

/**
 * Service Registry Client
 */
export class ServiceRegistryClient {
  private doStub: DurableObjectStub;

  constructor(doStub: DurableObjectStub) {
    this.doStub = doStub;
  }

  async register<T>(
    id: ResourceId,
    factory: () => T | Promise<T>,
    options: ServiceRegistrationOptions
  ): Promise<ServiceMetadata> {
    return this.doStub.register(id, factory, options);
  }

  async unregister(id: ResourceId): Promise<void> {
    return this.doStub.unregister(id);
  }

  async get<T>(id: ResourceId): Promise<T | undefined> {
    return this.doStub.get(id);
  }

  async getByType<T>(type: ServiceType): Promise<T[]> {
    return this.doStub.getByType(type);
  }

  async getByTag<T>(tag: string): Promise<T[]> {
    return this.doStub.getByTag(tag);
  }

  async checkHealth(id: ResourceId): Promise<HealthCheckResult> {
    return this.doStub.checkHealth(id);
  }

  async checkAllHealth(): Promise<HealthCheckResult[]> {
    return this.doStub.checkAllHealth();
  }

  async getAll(): Promise<ServiceInstance[]> {
    return this.doStub.getAll();
  }

  async getMetadata(id: ResourceId): Promise<ServiceMetadata | undefined> {
    return this.doStub.getMetadata(id);
  }
}

/**
 * Internal types
 */
interface ServiceRecord {
  metadata: ServiceMetadata;
  factory: string;
  lifecycle: ServiceLifecycle;
  singleton: boolean;
  lazy: boolean;
  instance: unknown;
  initialized: boolean;
}

interface RegistryData {
  services: Array<[ResourceId, ServiceRecord]>;
  byType: Array<[ServiceType, string[]]>;
  byType: Array<[string, string[]]>;
  healthStatus: Array<[ResourceId, HealthCheckResult]>;
}

interface Env {
  SERVICE_REGISTRY_DURABLE_OBJECT: DurableObjectNamespace;
}
