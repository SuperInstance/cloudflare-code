/**
 * Platform Bootstrap
 *
 * Centralized platform initialization and lifecycle management.
 */

import type {
  PlatformContext,
  PlatformConfig,
  PlatformEnvironment,
  PlatformCapabilities,
  ServiceInstance,
  ServiceLifecycle,
} from '../types/core';

import { ServiceRegistryClient } from '../services/registry';
import { serviceDiscovery } from '../services/discovery';
import { DIContainer } from '../di/container';
import { StateManager } from '../state/manager';
import { PlatformEventBus } from '../events/integration';
import { ConfigManager, DefaultConfigLoader } from '../config/manager';
import { CORE_TOKENS } from '../di/tokens';

/**
 * Platform bootstrap options
 */
export interface PlatformBootstrapOptions {
  readonly config?: Partial<PlatformConfig>;
  readonly environment?: Partial<PlatformEnvironment>;
  readonly capabilities?: Partial<PlatformCapabilities>;
  readonly autoStart?: boolean;
  readonly enableDiscovery?: boolean;
  readonly enableMonitoring?: boolean;
}

/**
 * Platform bootstrap result
 */
export interface PlatformBootstrapResult {
  readonly context: PlatformContext;
  readonly started: boolean;
  readonly duration: number;
  readonly services: ReadonlyArray<{
    readonly id: string;
    readonly type: string;
    readonly status: string;
  }>;
}

/**
 * Platform class
 */
export class Platform {
  private static instance: Platform | null = null;

  private context!: PlatformContext;
  private initialized = false;
  private started = false;
  private disposed = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): Platform {
    if (!Platform.instance) {
      Platform.instance = new Platform();
    }

    return Platform.instance;
  }

  /**
   * Bootstrap the platform
   */
  async bootstrap(options: PlatformBootstrapOptions = {}): Promise<PlatformBootstrapResult> {
    if (this.initialized) {
      throw new Error('Platform already initialized');
    }

    const startTime = Date.now();

    // Build context
    this.context = await this.buildContext(options);

    // Initialize core services
    await this.initializeCoreServices();

    // Discover and register services
    if (options.enableDiscovery !== false) {
      await this.discoverAndRegisterServices();
    }

    // Start services if auto-start enabled
    if (options.autoStart !== false) {
      await this.startServices();
    }

    this.initialized = true;

    const duration = Date.now() - startTime;

    // Emit platform initialized event
    await this.context.eventBus.publish('platform:initialized', {
      duration,
      services: Array.from(this.context.serviceRegistry.services.values()).map(
        (s) => ({
          id: s.metadata.id,
          type: s.metadata.type,
          status: s.lifecycle,
        })
      ),
      timestamp: Date.now(),
    });

    return {
      context: this.context,
      started: this.started,
      duration,
      services: Array.from(this.context.serviceRegistry.services.values()).map(
        (s) => ({
          id: s.metadata.id,
          type: s.metadata.type,
          status: s.lifecycle,
        })
      ),
    };
  }

  /**
   * Start all services
   */
  async startServices(): Promise<void> {
    if (this.started) {
      return;
    }

    const services = await this.startupOrder();

    for (const service of services) {
      try {
        await service.start();
      } catch (error) {
        console.error(`Failed to start service ${service.metadata.id}:`, error);
      }
    }

    this.started = true;
  }

  /**
   * Stop all services
   */
  async stopServices(): Promise<void> {
    if (!this.started) {
      return;
    }

    const services = await this.shutdownOrder();

    for (const service of services) {
      try {
        await service.stop();
      } catch (error) {
        console.error(`Failed to stop service ${service.metadata.id}:`, error);
      }
    }

    this.started = false;
  }

  /**
   * Shutdown the platform
   */
  async shutdown(reason = 'manual'): Promise<void> {
    if (this.disposed) {
      return;
    }

    const startTime = Date.now();

    try {
      // Stop all services
      await this.stopServices();

      // Emit shutdown event
      await this.context.eventBus.publish('platform:shutdown', {
        reason,
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      });

      // Dispose of resources
      await this.context.diContainer.dispose();
      await this.context.stateManager.dispose();
      await this.context.eventBus.dispose();

      this.disposed = true;
      this.initialized = false;
      Platform.instance = null;
    } catch (error) {
      console.error('Error during platform shutdown:', error);
      throw error;
    }
  }

  /**
   * Get platform context
   */
  getContext(): PlatformContext {
    if (!this.initialized) {
      throw new Error('Platform not initialized');
    }

    return this.context;
  }

  /**
   * Check if platform is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if platform is started
   */
  isStarted(): boolean {
    return this.started;
  }

  /**
   * Get platform health
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: ReadonlyArray<{
      id: string;
      status: string;
      health: unknown;
    }>;
  }> {
    if (!this.initialized) {
      return {
        status: 'unhealthy',
        services: [],
      };
    }

    const healthResults = await this.context.serviceRegistry.checkAllHealth();

    let unhealthyCount = 0;
    let degradedCount = 0;

    for (const result of healthResults) {
      if (result.status === 'unhealthy') {
        unhealthyCount++;
      } else if (result.status === 'degraded') {
        degradedCount++;
      }
    }

    const status =
      unhealthyCount > 0
        ? 'unhealthy'
        : degradedCount > 0
          ? 'degraded'
          : 'healthy';

    return {
      status,
      services: healthResults.map((r) => ({
        id: r.serviceId,
        status: r.status,
        health: r,
      })),
    };
  }

  private async buildContext(
    options: PlatformBootstrapOptions
  ): Promise<PlatformContext> {
    // Build environment
    const environment: PlatformEnvironment = {
      name: options.environment?.name || 'claudeflare',
      mode: options.environment?.mode || 'development',
      region: options.environment?.region,
      debug: options.environment?.debug ?? true,
      tracing: options.environment?.tracing ?? false,
      metrics: options.environment?.metrics ?? true,
    };

    // Build capabilities
    const capabilities: PlatformCapabilities = {
      durableObjects: options.capabilities?.durableObjects ?? true,
      kvStorage: options.capabilities?.kvStorage ?? true,
      r2Storage: options.capabilities?.r2Storage ?? true,
      d1Database: options.capabilities?.d1Database ?? true,
      queues: options.capabilities?.queues ?? true,
      cronTriggers: options.capabilities?.cronTriggers ?? true,
      analytics: options.capabilities?.analytics ?? true,
    };

    // Build config
    const config: PlatformConfig = {
      services: options.config?.services || [],
      features: options.config?.features || {},
      limits: options.config?.limits || {
        maxConcurrentRequests: 100,
        maxServiceInstances: 50,
        cacheSize: 1000000,
        timeout: 30000,
      },
      monitoring: options.config?.monitoring || {
        enabled: true,
        sampleRate: 1.0,
        exportInterval: 60000,
      },
    };

    // Initialize core components
    const configManager = new ConfigManager();
    configManager.addLoader(new DefaultConfigLoader({}));

    const diContainer = new DIContainer({
      autoRegister: true,
      enableCache: true,
    });

    const stateManager = new StateManager();

    // Create event bus (would integrate with events package)
    const eventBus = new PlatformEventBus({
      publish: async (_event, _data) => {},
      subscribe: async (_event, _handler) => () => {},
    } as any);

    // Create service registry
    const serviceRegistry = {
      services: new Map(),
      servicesByType: new Map(),
      register: async () => {},
      unregister: async () => {},
      get: async () => undefined,
      getByType: async () => [],
      getByTag: async () => [],
      checkHealth: async () => ({}) as any,
      checkAllHealth: async () => [],
      on: async () => {},
      off: async () => {},
    };

    return {
      environment,
      capabilities,
      config,
      serviceRegistry: serviceRegistry as any,
      eventBus,
      stateManager,
      diContainer,
    };
  }

  private async initializeCoreServices(): Promise<void> {
    const container = this.context.diContainer;

    // Register core services
    container.registerSingleton(
      CORE_TOKENS.SERVICE_REGISTRY,
      () => this.context.serviceRegistry
    );

    container.registerSingleton(
      CORE_TOKENS.EVENT_BUS,
      () => this.context.eventBus
    );

    container.registerSingleton(
      CORE_TOKENS.STATE_MANAGER,
      () => this.context.stateManager
    );

    container.registerSingleton(
      CORE_TOKENS.CONFIG_MANAGER,
      () => new ConfigManager()
    );

    container.registerSingleton(
      CORE_TOKENS.DI_CONTAINER,
      () => this.context.diContainer
    );
  }

  private async discoverAndRegisterServices(): Promise<void> {
    const discoveries = serviceDiscovery.discoverServices();
    const order = serviceDiscovery.getStartupOrder();

    for (const serviceId of order) {
      const discovery = discoveries.find((d) => d.service.id === serviceId);

      if (discovery) {
        // Register service with factory
        // This would integrate with actual service implementations
      }
    }
  }

  private async startupOrder(): Promise<ServiceInstance[]> {
    const allServices = Array.from(
      this.context.serviceRegistry.services.values()
    );

    // Sort by priority and dependencies
    return allServices.sort((a, b) => {
      // Critical services first
      if (a.metadata.priority < b.metadata.priority) return -1;
      if (a.metadata.priority > b.metadata.priority) return 1;

      // Then by dependencies
      const aDependsOnB = a.metadata.dependencies.includes(b.metadata.id);
      const bDependsOnA = b.metadata.dependencies.includes(a.metadata.id);

      if (aDependsOnB && !bDependsOnA) return 1;
      if (bDependsOnA && !aDependsOnB) return -1;

      return 0;
    });
  }

  private async shutdownOrder(): Promise<ServiceInstance[]> {
    // Reverse of startup order
    const services = await this.startupOrder();
    return services.reverse();
  }
}

/**
 * Bootstrap the platform
 */
export async function bootstrapPlatform(
  options?: PlatformBootstrapOptions
): Promise<PlatformBootstrapResult> {
  const platform = Platform.getInstance();
  return platform.bootstrap(options);
}

/**
 * Get platform instance
 */
export function getPlatform(): Platform {
  return Platform.getInstance();
}

/**
 * Shutdown the platform
 */
export async function shutdownPlatform(reason = 'manual'): Promise<void> {
  const platform = Platform.getInstance();

  if (platform.isInitialized()) {
    await platform.shutdown(reason);
  }
}
