/**
 * Unified Integration Manager
 *
 * Central manager that combines registry, orchestrator, and event bus
 * to provide a complete package integration solution.
 */

import type { PackageIdentifier, PackageMetadata, PackageRegistryConfig } from './types';
import { PackageRegistry } from './registry';
import { PackageOrchestrator, type OrchestratorConfig } from './orchestrator';
import { EventBus, type EventBusConfig } from './event-bus';

/**
 * Integration manager configuration
 */
export interface IntegrationManagerConfig {
  /**
   * Registry configuration
   */
  registry?: PackageRegistryConfig;

  /**
   * Orchestrator configuration
   */
  orchestrator?: OrchestratorConfig;

  /**
   * Event bus configuration
   */
  eventBus?: EventBusConfig;

  /**
   * Enable auto-discovery of packages
   */
  enableAutoDiscovery?: boolean;

  /**
   * Auto-discovery patterns
   */
  discoveryPatterns?: string[];

  /**
   * Enable automatic health monitoring
   */
  enableAutoHealthMonitoring?: boolean;

  /**
   * Enable automatic reconnection on failure
   */
  enableAutoReconnect?: boolean;

  /**
   * Reconnect delay in milliseconds
   */
  reconnectDelay?: number;

  /**
   * Maximum reconnect attempts
   */
  maxReconnectAttempts?: number;
}

/**
 * Integration manager status
 */
export interface IntegrationManagerStatus {
  /**
   * Manager is initialized
   */
  initialized: boolean;

  /**
   * Manager is running
   */
  running: boolean;

  /**
   * Registered packages count
   */
  registeredPackages: number;

  /**
   * Healthy packages count
   */
  healthyPackages: number;

  /**
   * Active invocations
   */
  activeInvocations: number;

  /**
   * Total events published
   */
  totalEvents: number;

  /**
   * Active subscriptions
   */
  activeSubscriptions: number;

  /**
   * Uptime in milliseconds
   */
  uptime: number;
}

/**
 * Unified Integration Manager
 *
 * Combines all integration components into a single interface.
 */
export class IntegrationManager {
  private registry: PackageRegistry;
  private orchestrator: PackageOrchestrator;
  private eventBus: EventBus;
  private options: Required<Omit<IntegrationManagerConfig, 'registry' | 'orchestrator' | 'eventBus'>>;

  private running: boolean;
  private startTime: number;
  private reconnectTimer: ReturnType<typeof setInterval> | undefined;

  constructor(config: IntegrationManagerConfig = {}) {
    this.options = {
      enableAutoDiscovery: config.enableAutoDiscovery ?? false,
      discoveryPatterns: config.discoveryPatterns ?? [],
      enableAutoHealthMonitoring: config.enableAutoHealthMonitoring ?? true,
      enableAutoReconnect: config.enableAutoReconnect ?? true,
      reconnectDelay: config.reconnectDelay ?? 5000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 10,
    };

    // Initialize components
    this.registry = new PackageRegistry(config.registry);
    this.orchestrator = new PackageOrchestrator(this.registry, config.orchestrator);
    this.eventBus = new EventBus({
      ...config.eventBus,
      kv: config.registry?.persistence?.kv,
      doNamespace: config.registry?.persistence?.doNamespace,
    });

    this.running = false;
    this.startTime = Date.now();

    // Set up orchestrator event callbacks
    this.orchestrator.onInvocationEvent = (event) => {
      if (event.type === 'error') {
        this.handleInvocationError(event);
      }
    };

    // Set up auto-discovery
    if (this.options.enableAutoDiscovery) {
      this.setupAutoDiscovery();
    }
  }

  /**
   * Start the integration manager
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    // Emit startup event
    await this.eventBus.publish(
      'integration.manager.started',
      {
        name: '@claudeflare/integration',
        version: '1.0.0',
        instanceId: 'integration-manager',
      },
      {
        version: '1.0.0',
      }
    );

    // Set up auto-reconnect
    if (this.options.enableAutoReconnect) {
      this.setupAutoReconnect();
    }
  }

  /**
   * Stop the integration manager
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    // Emit shutdown event
    await this.eventBus.publish(
      'integration.manager.stopped',
      {
        name: '@claudeflare/integration',
        version: '1.0.0',
        instanceId: 'integration-manager',
      },
      {
        version: '1.0.0',
      }
    );

    // Dispose of components
    this.registry.dispose();
    this.orchestrator.dispose();
    this.eventBus.dispose();
  }

  /**
   * Register a package
   */
  async registerPackage(metadata: PackageMetadata): Promise<void> {
    await this.registry.registerPackage(metadata);

    // Emit registration event
    await this.eventBus.publish(
      'integration.package.registered',
      {
        name: '@claudeflare/integration',
        version: '1.0.0',
        instanceId: 'integration-manager',
      },
      {
        correlationId: `pkg_${metadata.id.name}`,
      },
      {
        package: metadata.id,
      }
    );
  }

  /**
   * Unregister a package
   */
  async unregisterPackage(id: PackageIdentifier): Promise<boolean> {
    const result = await this.registry.unregisterPackage(id);

    if (result) {
      // Emit unregistration event
      await this.eventBus.publish(
        'integration.package.unregistered',
        {
          name: '@claudeflare/integration',
          version: '1.0.0',
          instanceId: 'integration-manager',
        },
        {
          correlationId: `pkg_${id.name}`,
        },
        {
          package: id,
        }
      );
    }

    return result;
  }

  /**
   * Get the registry
   */
  getRegistry(): PackageRegistry {
    return this.registry;
  }

  /**
   * Get the orchestrator
   */
  getOrchestrator(): PackageOrchestrator {
    return this.orchestrator;
  }

  /**
   * Get the event bus
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /**
   * Get manager status
   */
  getStatus(): IntegrationManagerStatus {
    const registryStats = this.registry.getStats();
    const orchestratorMetrics = this.orchestrator.getMetrics();
    const eventBusStats = this.eventBus.getStats();

    return {
      initialized: true,
      running: this.running,
      registeredPackages: registryStats.totalPackages,
      healthyPackages: registryStats.packagesByHealth.healthy,
      activeInvocations: this.orchestrator.getActiveInvocationsCount(),
      totalEvents: eventBusStats.totalPublished,
      activeSubscriptions: eventBusStats.activeSubscriptions,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Get comprehensive statistics
   */
  getStatistics(): {
    registry: ReturnType<PackageRegistry['getStats']>;
    orchestrator: ReturnType<PackageOrchestrator['getMetrics']>;
    eventBus: ReturnType<EventBus['getStats']>;
    manager: IntegrationManagerStatus;
  } {
    return {
      registry: this.registry.getStats(),
      orchestrator: this.orchestrator.getMetrics(),
      eventBus: this.eventBus.getStats(),
      manager: this.getStatus(),
    };
  }

  /**
   * Perform health check on all packages
   */
  async performHealthChecks(): Promise<void> {
    const packages = this.registry.getAllPackages();

    await Promise.all(
      packages.map(({ metadata }) =>
        this.registry.performHealthCheck(metadata.id)
      )
    );
  }

  /**
   * Handle invocation errors with auto-reconnect
   */
  private async handleInvocationError(event: {
    type: 'error';
    request: import('./types').PackageInvocationRequest;
    error?: Error;
  }): Promise<void> {
    // Check if error is due to unavailability
    if (event.error?.message.includes('not found') ||
        event.error?.message.includes('unavailable')) {
      // Package might be down, trigger health check
      await this.registry.performHealthCheck(event.request.target);
    }
  }

  /**
   * Set up auto-discovery of packages
   */
  private setupAutoDiscovery(): void {
    // Auto-discovery would scan for packages based on patterns
    // This is a placeholder for future implementation
    void this.eventBus.publish(
      'integration.manager.auto-discovery',
      {
        name: '@claudeflare/integration',
        version: '1.0.0',
        instanceId: 'integration-manager',
      },
      {},
      {
        patterns: this.options.discoveryPatterns,
      }
    );
  }

  /**
   * Set up auto-reconnect for failed packages
   */
  private setupAutoReconnect(): void {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
    }

    this.reconnectTimer = setInterval(async () => {
      const packages = this.registry.getAllPackages();
      const unhealthy = packages.filter(
        ({ health }) => health.status === 'unhealthy'
      );

      for (const { metadata } of unhealthy) {
        try {
          await this.registry.performHealthCheck(metadata.id);
        } catch {
          // Health check failed, will retry next time
        }
      }
    }, this.options.reconnectDelay);
  }

  /**
   * Reset all statistics
   */
  resetStatistics(): void {
    this.registry.resetStats();
    this.orchestrator.resetMetrics();
    this.eventBus.resetStats();
  }
}

/**
 * Create an integration manager
 */
export function createIntegrationManager(
  config?: IntegrationManagerConfig
): IntegrationManager {
  return new IntegrationManager(config);
}

/**
 * Singleton instance for global use
 */
let globalManager: IntegrationManager | undefined;

/**
 * Get or create the global integration manager
 */
export function getGlobalIntegrationManager(
  config?: IntegrationManagerConfig
): IntegrationManager {
  if (!globalManager) {
    globalManager = createIntegrationManager(config);
  }
  return globalManager;
}

/**
 * Reset the global integration manager
 */
export function resetGlobalIntegrationManager(): void {
  if (globalManager) {
    void globalManager.stop();
    globalManager = undefined;
  }
}
