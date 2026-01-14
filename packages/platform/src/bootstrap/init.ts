/**
 * Platform Bootstrap - Enhanced Initialization
 *
 * Comprehensive platform initialization with service discovery,
 * dependency injection, configuration management, and health monitoring.
 */

import type {
  PlatformContext,
  PlatformConfig,
  PlatformEnvironment,
  PlatformCapabilities,
  ServiceInstance,
  ServiceMetadata,
  HealthCheckResult,
  DependencyInjectionConfig,
  StateManagementConfig,
  EventBusConfig,
  MetricsConfig,
  TracingConfig,
} from '../types/core';

import { DIContainer } from '../di/container';
import { CORE_TOKENS } from '../di/tokens';
import { StateManager, DistributedStateManager } from '../state/manager';
import { PlatformEventBus } from '../events/integration';
import { ConfigManager } from '../config/manager';
import { HealthMonitor } from '../health/monitor';
import { ShutdownHandler } from '../shutdown/handler';
import { PerformanceOptimizer } from '../performance/optimizer';
import { ReadinessChecker } from '../readiness/checker';
import { serviceDiscovery } from '../services/discovery';
import { delay, generateId, deepMerge } from '../utils/helpers';

/**
 * Platform initialization options
 */
export interface PlatformInitOptions {
  readonly config?: Partial<PlatformConfig>;
  readonly environment?: Partial<PlatformEnvironment>;
  readonly capabilities?: Partial<PlatformCapabilities>;
  readonly di?: DependencyInjectionConfig;
  readonly state?: StateManagementConfig;
  readonly eventBus?: EventBusConfig;
  readonly metrics?: MetricsConfig;
  readonly tracing?: TracingConfig;
  readonly autoStart?: boolean;
  readonly enableDiscovery?: boolean;
  readonly enableHealthChecks?: boolean;
  readonly enableShutdownHooks?: boolean;
  readonly enablePerformanceOptimization?: boolean;
  readonly enableReadinessChecks?: boolean;
  readonly startupTimeout?: number;
  readonly shutdownTimeout?: number;
  readonly onInit?: () => Promise<void> | void;
  readonly onStart?: () => Promise<void> | void;
  readonly onError?: (error: Error) => Promise<void> | void;
}

/**
 * Initialization phase
 */
export enum InitPhase {
  VALIDATING = 'validating',
  LOADING_CONFIG = 'loading_config',
  INITIALIZING_DI = 'initializing_di',
  INITIALIZING_STATE = 'initializing_state',
  INITIALIZING_EVENTS = 'initializing_events',
  INITIALIZING_HEALTH = 'initializing_health',
  DISCOVERING_SERVICES = 'discovering_services',
  REGISTERING_SERVICES = 'registering_services',
  STARTING_SERVICES = 'starting_services',
  RUNNING_HEALTH_CHECKS = 'running_health_checks',
  READY = 'ready',
  FAILED = 'failed',
}

/**
 * Initialization progress
 */
export interface InitProgress {
  readonly phase: InitPhase;
  readonly progress: number; // 0-100
  readonly message: string;
  readonly timestamp: number;
  readonly details?: Record<string, unknown>;
}

/**
 * Initialization result
 */
export interface InitResult {
  readonly success: boolean;
  readonly context: PlatformContext;
  readonly duration: number;
  readonly services: ReadonlyArray<{
    id: string;
    type: string;
    status: string;
    health?: HealthCheckResult;
  }>;
  readonly warnings: string[];
  readonly errors: string[];
  readonly readinessScore: number;
}

/**
 * Platform initializer
 */
export class PlatformInitializer {
  private context!: PlatformContext;
  private configManager: ConfigManager;
  private diContainer: DIContainer;
  private stateManager: StateManager;
  private eventBus: PlatformEventBus;
  private healthMonitor: HealthMonitor;
  private shutdownHandler: ShutdownHandler;
  private performanceOptimizer: PerformanceOptimizer;
  private readinessChecker: ReadinessChecker;

  private progressCallbacks: Set<(progress: InitProgress) => void>;
  private initialized = false;
  private disposed = false;

  constructor() {
    this.configManager = new ConfigManager({
      validateOnChange: true,
      enableWatchers: true,
    });

    this.diContainer = new DIContainer({
      autoRegister: true,
      enableCache: true,
      enableAutoResolve: true,
    });

    this.stateManager = new StateManager();
    this.eventBus = new PlatformEventBus(this.createEventBusConfig());
    this.healthMonitor = new HealthMonitor();
    this.shutdownHandler = new ShutdownHandler();
    this.performanceOptimizer = new PerformanceOptimizer();
    this.readinessChecker = new ReadinessChecker();

    this.progressCallbacks = new Set();
  }

  /**
   * Initialize the platform
   */
  async initialize(options: PlatformInitOptions = {}): Promise<InitResult> {
    if (this.initialized) {
      throw new Error('Platform already initialized');
    }

    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Phase 1: Validate environment
      await this.setProgress(InitPhase.VALIDATING, 5, 'Validating environment');
      const validationResult = await this.validateEnvironment(options);
      if (!validationResult.valid) {
        errors.push(...validationResult.errors);
      }
      warnings.push(...validationResult.warnings);

      // Phase 2: Load configuration
      await this.setProgress(InitPhase.LOADING_CONFIG, 15, 'Loading configuration');
      await this.loadConfiguration(options);

      // Phase 3: Initialize dependency injection
      await this.setProgress(InitPhase.INITIALIZING_DI, 25, 'Initializing dependency injection');
      await this.initializeDependencyInjection(options);

      // Phase 4: Initialize state management
      await this.setProgress(InitPhase.INITIALIZING_STATE, 35, 'Initializing state management');
      await this.initializeStateManagement(options);

      // Phase 5: Initialize event bus
      await this.setProgress(InitPhase.INITIALIZING_EVENTS, 45, 'Initializing event bus');
      await this.initializeEventBus(options);

      // Phase 6: Initialize health monitoring
      await this.setProgress(InitPhase.INITIALIZING_HEALTH, 50, 'Initializing health monitoring');
      await this.initializeHealthMonitoring(options);

      // Phase 7: Discover services
      if (options.enableDiscovery !== false) {
        await this.setProgress(InitPhase.DISCOVERING_SERVICES, 60, 'Discovering services');
        const discovered = await this.discoverServices();
        warnings.push(...discovered.warnings);
      }

      // Phase 8: Register services
      await this.setProgress(InitPhase.REGISTERING_SERVICES, 70, 'Registering services');
      await this.registerServices(options);

      // Phase 9: Start services
      if (options.autoStart !== false) {
        await this.setProgress(InitPhase.STARTING_SERVICES, 85, 'Starting services');
        await this.startServices(options);
      }

      // Phase 10: Run health checks
      if (options.enableHealthChecks !== false) {
        await this.setProgress(InitPhase.RUNNING_HEALTH_CHECKS, 90, 'Running health checks');
        const healthResults = await this.runHealthChecks();
        warnings.push(...healthResults.warnings);
      }

      // Phase 11: Setup shutdown hooks
      if (options.enableShutdownHooks !== false) {
        await this.setupShutdownHooks(options);
      }

      // Phase 12: Enable performance optimization
      if (options.enablePerformanceOptimization !== false) {
        await this.enablePerformanceOptimization(options);
      }

      // Calculate readiness score
      await this.setProgress(InitPhase.READY, 100, 'Platform ready');
      const readinessScore = await this.calculateReadiness(options);

      // Build context
      this.context = this.buildContext(options);

      // Run custom init hook
      if (options.onInit) {
        await options.onInit();
      }

      this.initialized = true;

      const duration = Date.now() - startTime;

      // Emit platform initialized event
      await this.eventBus.publish('platform:initialized', {
        duration,
        readinessScore,
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
        success: true,
        context: this.context,
        duration,
        services: Array.from(this.context.serviceRegistry.services.values()).map(
          (s) => ({
            id: s.metadata.id,
            type: s.metadata.type,
            status: s.lifecycle,
          })
        ),
        warnings,
        errors,
        readinessScore,
      };
    } catch (error) {
      await this.setProgress(InitPhase.FAILED, 0, 'Initialization failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      const duration = Date.now() - startTime;
      errors.push(error instanceof Error ? error.message : String(error));

      // Run error hook
      if (options.onError) {
        await options.onError(error as Error);
      }

      // Cleanup partial initialization
      await this.cleanup();

      return {
        success: false,
        context: this.context,
        duration,
        services: [],
        warnings,
        errors,
        readinessScore: 0,
      };
    }
  }

  /**
   * Watch initialization progress
   */
  onProgress(callback: (progress: InitProgress) => void): () => void {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }

  /**
   * Get initialization status
   */
  getStatus(): { initialized: boolean; disposed: boolean } {
    return {
      initialized: this.initialized,
      disposed: this.disposed,
    };
  }

  /**
   * Dispose of initializer
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    await this.cleanup();

    this.disposed = true;
    this.initialized = false;
    this.progressCallbacks.clear();
  }

  private async validateEnvironment(
    options: PlatformInitOptions
  ): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check capabilities
    if (options.capabilities?.durableObjects && typeof DurableObject === 'undefined') {
      errors.push('Durable Objects requested but not available in this environment');
    }

    if (options.capabilities?.kvStorage && typeof KVNamespace === 'undefined') {
      warnings.push('KV Storage requested but may not be available');
    }

    if (options.capabilities?.r2Storage && typeof R2Bucket === 'undefined') {
      warnings.push('R2 Storage requested but may not be available');
    }

    // Validate configuration
    if (options.config?.limits) {
      const { limits } = options.config;

      if (limits.maxConcurrentRequests < 1) {
        errors.push('maxConcurrentRequests must be at least 1');
      }

      if (limits.maxServiceInstances < 1) {
        errors.push('maxServiceInstances must be at least 1');
      }

      if (limits.cacheSize < 0) {
        errors.push('cacheSize must be non-negative');
      }

      if (limits.timeout < 1000) {
        warnings.push('timeout is very low, may cause requests to fail');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async loadConfiguration(options: PlatformInitOptions): Promise<void> {
    // Add default configuration loader
    const defaults: Record<string, unknown> = {
      'environment.name': options.environment?.name || 'claudeflare',
      'environment.mode': options.environment?.mode || 'development',
      'environment.debug': options.environment?.debug ?? true,
      'environment.tracing': options.environment?.tracing ?? false,
      'environment.metrics': options.environment?.metrics ?? true,
    };

    this.configManager.addLoader({
      source: 'default',
      load: async () => defaults,
    });

    // Add environment loader
    this.configManager.addLoader({
      source: 'environment',
      load: async () => {
        const env: Record<string, unknown> = {};
        // In Cloudflare Workers, environment vars come from bindings
        if (typeof process !== 'undefined' && process.env) {
          for (const [key, value] of Object.entries(process.env)) {
            if (key.startsWith('CLAUDEFLARE_')) {
              const configKey = key
                .replace('CLAUDEFLARE_', '')
                .toLowerCase()
                .replace(/_/g, '.');
              env[configKey] = value;
            }
          }
        }
        return env;
      },
    });

    // Load configuration
    await this.configManager.load();
  }

  private async initializeDependencyInjection(
    options: PlatformInitOptions
  ): Promise<void> {
    // Register core services
    this.diContainer.registerSingleton(
      CORE_TOKENS.CONFIG_MANAGER,
      () => this.configManager
    );

    this.diContainer.registerSingleton(
      CORE_TOKENS.EVENT_BUS,
      () => this.eventBus
    );

    this.diContainer.registerSingleton(
      CORE_TOKENS.STATE_MANAGER,
      () => this.stateManager
    );

    this.diContainer.registerSingleton(
      CORE_TOKENS.HEALTH_MONITOR,
      () => this.healthMonitor
    );

    this.diContainer.registerSingleton(
      CORE_TOKENS.SHUTDOWN_HANDLER,
      () => this.shutdownHandler
    );

    this.diContainer.registerSingleton(
      CORE_TOKENS.PERFORMANCE_OPTIMIZER,
      () => this.performanceOptimizer
    );

    this.diContainer.registerSingleton(
      CORE_TOKENS.READINESS_CHECKER,
      () => this.readinessChecker
    );

    // Configure DI container
    if (options.di) {
      if (options.di.autoRegister) {
        this.diContainer.enableAutoRegister();
      }
      if (options.di.enableCache !== undefined) {
        this.diContainer.setCacheEnabled(options.di.enableCache);
      }
    }
  }

  private async initializeStateManagement(
    options: PlatformInitOptions
  ): Promise<void> {
    if (options.state?.distributed) {
      // Initialize distributed state manager
      const distributedManager = new DistributedStateManager({
        replicationFactor: options.state.replicationFactor || 3,
        consistency: options.state.consistency || 'eventual',
      });

      await distributedManager.initialize();
    }
  }

  private async initializeEventBus(
    options: PlatformInitOptions
  ): Promise<void> {
    await this.eventBus.initialize();

    // Subscribe to platform events
    this.eventBus.subscribe('platform:shutdown', async (data) => {
      console.log('Platform shutdown initiated:', data);
    });

    this.eventBus.subscribe('platform:error', async (data) => {
      console.error('Platform error:', data);
    });
  }

  private async initializeHealthMonitoring(
    options: PlatformInitOptions
  ): Promise<void> {
    await this.healthMonitor.initialize({
      checkInterval: options.config?.monitoring?.exportInterval || 60000,
      timeout: 10000,
      retryAttempts: 3,
    });

    // Register system health checks
    this.healthMonitor.registerCheck('memory', {
      check: async () => {
        if (typeof performance !== 'undefined' && performance.memory) {
          const usage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
          return {
            status: usage > 0.9 ? 'degraded' : 'healthy',
            details: { usage: usage * 100 },
          };
        }
        return { status: 'healthy' };
      },
      interval: 30000,
    });

    this.healthMonitor.registerCheck('eventbus', {
      check: async () => {
        const isHealthy = await this.eventBus.isHealthy();
        return { status: isHealthy ? 'healthy' : 'unhealthy' };
      },
      interval: 30000,
    });
  }

  private async discoverServices(): Promise<{ warnings: string[] }> {
    const warnings: string[] = [];

    try {
      const discoveries = serviceDiscovery.discoverServices();

      for (const discovery of discoveries) {
        if (discovery.status === 'warning') {
          warnings.push(`Service ${discovery.service.id}: ${discovery.message}`);
        }
      }
    } catch (error) {
      warnings.push(`Service discovery encountered issues: ${error}`);
    }

    return { warnings };
  }

  private async registerServices(
    options: PlatformInitOptions
  ): Promise<void> {
    const discoveries = serviceDiscovery.discoverServices();
    const order = serviceDiscovery.getStartupOrder();

    for (const serviceId of order) {
      const discovery = discoveries.find((d) => d.service.id === serviceId);

      if (discovery && discovery.status === 'available') {
        // Register service with DI container
        const factory = discovery.factory;
        if (factory) {
          this.diContainer.registerSingleton(
            { id: serviceId, type: discovery.service.type },
            factory
          );
        }
      }
    }
  }

  private async startServices(
    options: PlatformInitOptions
  ): Promise<void> {
    const services = await this.getStartupOrder();
    const timeout = options.startupTimeout || 30000;

    for (const service of services) {
      try {
        await Promise.race([
          service.start(),
          delay(timeout).then(() => {
            throw new Error(`Service ${service.metadata.id} startup timeout`);
          }),
        ]);

        // Run custom start hook
        if (options.onStart) {
          await options.onStart();
        }
      } catch (error) {
        console.error(`Failed to start service ${service.metadata.id}:`, error);
        throw error;
      }
    }
  }

  private async runHealthChecks(): Promise<{ warnings: string[] }> {
    const warnings: string[] = [];

    try {
      const results = await this.healthMonitor.checkAll();

      for (const result of results) {
        if (result.status === 'degraded') {
          warnings.push(`Health check ${result.name}: degraded`);
        } else if (result.status === 'unhealthy') {
          warnings.push(`Health check ${result.name}: unhealthy`);
        }
      }
    } catch (error) {
      warnings.push(`Health check failed: ${error}`);
    }

    return { warnings };
  }

  private async setupShutdownHooks(
    options: PlatformInitOptions
  ): Promise<void> {
    await this.shutdownHandler.initialize({
      timeout: options.shutdownTimeout || 5000,
      forceTimeout: options.shutdownTimeout ? options.shutdownTimeout * 2 : 10000,
    });

    // Register cleanup handlers
    this.shutdownHandler.registerCleanup({
      name: 'di-container',
      priority: 100,
      cleanup: async () => {
        await this.diContainer.dispose();
      },
    });

    this.shutdownHandler.registerCleanup({
      name: 'state-manager',
      priority: 90,
      cleanup: async () => {
        await this.stateManager.dispose();
      },
    });

    this.shutdownHandler.registerCleanup({
      name: 'event-bus',
      priority: 80,
      cleanup: async () => {
        await this.eventBus.dispose();
      },
    });

    this.shutdownHandler.registerCleanup({
      name: 'health-monitor',
      priority: 70,
      cleanup: async () => {
        await this.healthMonitor.dispose();
      },
    });

    // Setup signal handlers
    if (typeof process !== 'undefined') {
      process.on('SIGTERM', () => this.shutdownHandler.shutdown('SIGTERM'));
      process.on('SIGINT', () => this.shutdownHandler.shutdown('SIGINT'));
    }
  }

  private async enablePerformanceOptimization(
    options: PlatformInitOptions
  ): Promise<void> {
    await this.performanceOptimizer.initialize({
      enabled: true,
      autoTune: true,
      monitoring: true,
    });

    // Enable optimizations
    await this.performanceOptimizer.enableMemoryOptimization();
    await this.performanceOptimizer.enableConnectionPooling();
    await this.performanceOptimizer.enableCaching();
  }

  private async calculateReadiness(
    options: PlatformInitOptions
  ): Promise<number> {
    const result = await this.readinessChecker.check({
      skipTests: options.environment?.mode === 'development',
    });

    return result.score;
  }

  private buildContext(options: PlatformInitOptions): PlatformContext {
    return {
      environment: {
        name: options.environment?.name || 'claudeflare',
        mode: options.environment?.mode || 'development',
        region: options.environment?.region,
        debug: options.environment?.debug ?? true,
        tracing: options.environment?.tracing ?? false,
        metrics: options.environment?.metrics ?? true,
      },
      capabilities: {
        durableObjects: options.capabilities?.durableObjects ?? true,
        kvStorage: options.capabilities?.kvStorage ?? true,
        r2Storage: options.capabilities?.r2Storage ?? true,
        d1Database: options.capabilities?.d1Database ?? true,
        queues: options.capabilities?.queues ?? true,
        cronTriggers: options.capabilities?.cronTriggers ?? true,
        analytics: options.capabilities?.analytics ?? true,
      },
      config: options.config as PlatformConfig || {
        services: [],
        features: {},
        limits: {
          maxConcurrentRequests: 100,
          maxServiceInstances: 50,
          cacheSize: 1000000,
          timeout: 30000,
        },
        monitoring: {
          enabled: true,
          sampleRate: 1.0,
          exportInterval: 60000,
        },
      },
      serviceRegistry: this.createServiceRegistry(),
      eventBus: this.eventBus,
      stateManager: this.stateManager,
      diContainer: this.diContainer,
    };
  }

  private createServiceRegistry() {
    return {
      services: new Map<string, ServiceInstance>(),
      servicesByType: new Map<string, ServiceInstance[]>(),
      register: async (service: ServiceInstance) => {
        this.diContainer.registerSingleton(
          { id: service.metadata.id, type: service.metadata.type },
          () => service
        );
      },
      unregister: async (id: string) => {
        // Implementation
      },
      get: async (id: string) => {
        return this.diContainer.resolve({ id, type: 'unknown' });
      },
      getByType: async (type: string) => {
        return [];
      },
      getByTag: async (tag: string) => {
        return [];
      },
      checkHealth: async (id: string) => {
        return {} as HealthCheckResult;
      },
      checkAllHealth: async () => {
        return [];
      },
      on: async (event: string, handler: () => void) => {
        return () => {};
      },
      off: async (event: string, handler: () => void) => {
        // Implementation
      },
    };
  }

  private createEventBusConfig(): EventBusConfig {
    return {
      publish: async (event, data) => {
        // Implementation
      },
      subscribe: async (event, handler) => {
        return () => {};
      },
    };
  }

  private async getStartupOrder(): Promise<ServiceInstance[]> {
    // Get services in startup order
    return [];
  }

  private async setProgress(
    phase: InitPhase,
    progress: number,
    message: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    const initProgress: InitProgress = {
      phase,
      progress,
      message,
      timestamp: Date.now(),
      details,
    };

    // Notify all callbacks
    for (const callback of this.progressCallbacks) {
      try {
        await callback(initProgress);
      } catch (error) {
        console.error('Error in progress callback:', error);
      }
    }
  }

  private async cleanup(): Promise<void> {
    try {
      await this.healthMonitor.dispose();
      await this.eventBus.dispose();
      await this.stateManager.dispose();
      await this.diContainer.dispose();
      await this.configManager.dispose();
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

/**
 * Initialize the platform with comprehensive setup
 */
export async function initPlatform(
  options?: PlatformInitOptions
): Promise<InitResult> {
  const initializer = new PlatformInitializer();
  return initializer.initialize(options);
}

/**
 * Create a new platform initializer
 */
export function createInitializer(): PlatformInitializer {
  return new PlatformInitializer();
}
