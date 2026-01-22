/**
 * Package Adapter
 *
 * Helper utilities to easily adapt existing packages to work with the
 * unified integration layer. Provides automatic capability extraction,
 * health check setup, and lifecycle management.
 */

import type {
  PackageMetadata,
  PackageIdentifier,
  PackageCapability,
} from './types';
import { IntegrationManager } from './manager';

/**
 * Adapter configuration options
 */
export interface PackageAdapterOptions {
  /**
   * Package identifier
   */
  id: PackageIdentifier;

  /**
   * Package type
   */
  type?: PackageMetadata['type'];

  /**
   * Capability definitions
   */
  capabilities: PackageAdapterCapability[];

  /**
   * Package dependencies
   */
  dependencies?: string[];

  /**
   * Package tags
   */
  tags?: string[];

  /**
   * Package priority
   */
  priority?: number;

  /**
   * Health check implementation
   */
  healthCheck?: {
    /**
     * Health check endpoint or function
     */
    endpoint?: string;

    /**
     * Custom health check function
     */
    handler?: () => Promise<boolean> | boolean;

    /**
     * Health check interval in milliseconds
     */
    interval?: number;
  };

  /**
   * Package location
   */
  location?: {
    type?: 'local' | 'remote' | 'durable-object';
    endpoint?: string;
    doId?: string;
  };

  /**
   * Lifecycle hooks
   */
  lifecycle?: {
    /**
     * Called when package is registered
     */
    onRegister?: () => Promise<void> | void;

    /**
     * Called when package is unregistered
     */
    onUnregister?: () => Promise<void> | void;

    /**
     * Called when health status changes
     */
    onHealthChange?: (status: 'healthy' | 'degraded' | 'unhealthy') => Promise<void> | void;
  };
}

/**
 * Capability adapter definition
 */
export interface PackageAdapterCapability {
  /**
   * Capability name
   */
  name: string;

  /**
   * Capability version
   */
  version: string;

  /**
   * Capability description
   */
  description?: string;

  /**
   * Input schema
   */
  inputSchema?: Record<string, unknown>;

  /**
   * Output schema
   */
  outputSchema?: Record<string, unknown>;

  /**
   * Required dependencies
   */
  dependencies?: string[];

  /**
   * Handler function
   */
  handler: (input: unknown) => Promise<unknown> | unknown;

  /**
   * Resource requirements
   */
  resources?: {
    memory?: number;
    cpu?: number;
    timeout?: number;
  };
}

/**
 * Package Adapter
 *
 * Adapts existing packages to work with the integration layer.
 */
export class PackageAdapter {
  private manager: IntegrationManager;
  private options: PackageAdapterOptions;
  private metadata: PackageMetadata;
  private handlers: Map<string, (input: unknown) => Promise<unknown>>;
  private healthCheckTimer?: ReturnType<typeof setInterval>;

  constructor(
    manager: IntegrationManager,
    options: PackageAdapterOptions
  ) {
    this.manager = manager;
    this.options = options;
    this.handlers = new Map();

    // Build package metadata
    this.metadata = this.buildMetadata();

    // Register handlers
    for (const capability of options.capabilities) {
      this.handlers.set(capability.name, capability.handler);
    }
  }

  /**
   * Register the adapted package
   */
  async register(): Promise<void> {
    await this.manager.registerPackage(this.metadata);

    // Set up custom health check if provided
    if (this.options.healthCheck?.handler) {
      this.setupCustomHealthCheck();
    }

    // Call lifecycle hook
    if (this.options.lifecycle?.onRegister) {
      await this.options.lifecycle.onRegister();
    }
  }

  /**
   * Unregister the adapted package
   */
  async unregister(): Promise<void> {
    // Stop health check
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    // Unregister from manager
    await this.manager.unregisterPackage(this.options.id);

    // Call lifecycle hook
    if (this.options.lifecycle?.onUnregister) {
      await this.options.lifecycle.onUnregister();
    }
  }

  /**
   * Handle an invocation
   */
  async handle(capabilityName: string, input: unknown): Promise<unknown> {
    const handler = this.handlers.get(capabilityName);

    if (!handler) {
      throw new Error(`Capability not found: ${capabilityName}`);
    }

    return await handler(input);
  }

  /**
   * Get package metadata
   */
  getMetadata(): PackageMetadata {
    return this.metadata;
  }

  /**
   * Build package metadata from adapter options
   */
  private buildMetadata(): PackageMetadata {
    const capabilities: PackageCapability[] = this.options.capabilities.map(
      (cap) => ({
        name: cap.name,
        version: cap.version,
        description: cap.description,
        inputSchema: cap.inputSchema,
        outputSchema: cap.outputSchema,
        dependencies: cap.dependencies,
        resources: cap.resources,
      })
    );

    return {
      id: this.options.id,
      type: this.options.type ?? 'service',
      capabilities,
      dependencies: this.options.dependencies ?? [],
      healthCheck: this.options.healthCheck?.endpoint,
      location: this.options.location
        ? {
            type: this.options.location.type ?? 'local',
            endpoint: this.options.location.endpoint,
            doId: this.options.location.doId,
          }
        : undefined,
      tags: this.options.tags,
      priority: this.options.priority,
    };
  }

  /**
   * Set up custom health check
   */
  private setupCustomHealthCheck(): void {
    const interval = this.options.healthCheck?.interval ?? 30000;

    this.healthCheckTimer = setInterval(async () => {
      if (!this.options.healthCheck?.handler) return;

      try {
        const isHealthy = await this.options.healthCheck.handler();

        const status = isHealthy ? 'healthy' : 'unhealthy';

        await this.manager.getRegistry().updateHealth(
          this.options.id,
          {
            status,
            timestamp: Date.now(),
          }
        );

        // Call lifecycle hook
        if (this.options.lifecycle?.onHealthChange) {
          await this.options.lifecycle.onHealthChange(status);
        }
      } catch {
        await this.manager.getRegistry().updateHealth(
          this.options.id,
          {
            status: 'unhealthy',
            timestamp: Date.now(),
          }
        );

        if (this.options.lifecycle?.onHealthChange) {
          await this.options.lifecycle.onHealthChange('unhealthy');
        }
      }
    }, interval);
  }
}

/**
 * Create a package adapter
 */
export function createPackageAdapter(
  manager: IntegrationManager,
  options: PackageAdapterOptions
): PackageAdapter {
  return new PackageAdapter(manager, options);
}

// ============================================================================
// Convenience adapters for common package patterns
// ============================================================================

/**
 * Create adapter for a simple service package
 */
export function createServiceAdapter(
  manager: IntegrationManager,
  id: PackageIdentifier,
  capabilities: PackageAdapterCapability[],
  options?: Partial<Omit<PackageAdapterOptions, 'id' | 'capabilities' | 'type'>>
): PackageAdapter {
  return createPackageAdapter(manager, {
    id,
    type: 'service',
    capabilities,
    ...options,
  });
}

/**
 * Create adapter for a Durable Object package
 */
export function createDOAdapter(
  manager: IntegrationManager,
  id: PackageIdentifier,
  capabilities: PackageAdapterCapability[],
  doId: string,
  options?: Partial<Omit<PackageAdapterOptions, 'id' | 'capabilities' | 'type' | 'location'>>
): PackageAdapter {
  return createPackageAdapter(manager, {
    id,
    type: 'durable-object',
    capabilities,
    location: {
      type: 'durable-object',
      doId,
    },
    ...options,
  });
}

/**
 * Create adapter for an agent package
 */
export function createAgentAdapter(
  manager: IntegrationManager,
  id: PackageIdentifier,
  capabilities: PackageAdapterCapability[],
  options?: Partial<Omit<PackageAdapterOptions, 'id' | 'capabilities' | 'type'>>
): PackageAdapter {
  return createPackageAdapter(manager, {
    id,
    type: 'agent',
    capabilities,
    tags: ['agent', ...(options?.tags ?? [])],
    ...options,
  });
}

// ============================================================================
// Batch adapter for multiple packages
// ============================================================================

/**
 * Batch package adapter for registering multiple packages at once
 */
export class BatchPackageAdapter {
  private manager: IntegrationManager;
  private adapters: Map<string, PackageAdapter>;

  constructor(manager: IntegrationManager) {
    this.manager = manager;
    this.adapters = new Map();
  }

  /**
   * Add a package adapter
   */
  add(options: PackageAdapterOptions): PackageAdapter {
    const adapter = createPackageAdapter(this.manager, options);
    const key = this.getPackageKey(options.id);
    this.adapters.set(key, adapter);
    return adapter;
  }

  /**
   * Register all added packages
   */
  async registerAll(): Promise<void> {
    await Promise.all(
      Array.from(this.adapters.values()).map((adapter) =>
        adapter.register()
      )
    );
  }

  /**
   * Unregister all packages
   */
  async unregisterAll(): Promise<void> {
    await Promise.all(
      Array.from(this.adapters.values()).map((adapter) =>
        adapter.unregister()
      )
    );
  }

  /**
   * Get adapter by package ID
   */
  get(id: PackageIdentifier): PackageAdapter | undefined {
    return this.adapters.get(this.getPackageKey(id));
  }

  /**
   * Get all adapters
   */
  getAll(): PackageAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get package key for storage
   */
  private getPackageKey(id: PackageIdentifier): string {
    return `${id.name}@${id.version}`;
  }
}

/**
 * Create a batch package adapter
 */
export function createBatchPackageAdapter(
  manager: IntegrationManager
): BatchPackageAdapter {
  return new BatchPackageAdapter(manager);
}

// ============================================================================
// Helper to extract capabilities from existing package
// ============================================================================

/**
 * Extract capabilities from an object with handler methods
 */
export function extractCapabilities(
  obj: Record<string, unknown>,
  prefix?: string
): PackageAdapterCapability[] {
  const capabilities: PackageAdapterCapability[] = [];

  for (const [key, value] of Object.entries(obj)) {
    // Skip non-function properties
    if (typeof value !== 'function') continue;

    // Skip if doesn't start with prefix
    if (prefix && !key.startsWith(prefix)) continue;

    // Extract capability name
    const name = prefix ? key.slice(prefix.length) : key;

    // Convert camelCase to kebab-case
    const capabilityName = name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

    capabilities.push({
      name: capabilityName,
      version: '1.0.0',
      description: `${capabilityName} capability`,
      handler: value as (input: unknown) => Promise<unknown>,
    });
  }

  return capabilities;
}

/**
 * Auto-adapt an existing package object
 */
export function autoAdaptPackage(
  manager: IntegrationManager,
  id: PackageIdentifier,
  pkgObj: Record<string, unknown>,
  options?: {
    handlerPrefix?: string;
    type?: PackageMetadata['type'];
    tags?: string[];
    dependencies?: string[];
  }
): PackageAdapter {
  const capabilities = extractCapabilities(pkgObj, options?.handlerPrefix);

  return createPackageAdapter(manager, {
    id,
    type: options?.type ?? 'service',
    capabilities,
    tags: options?.tags,
    dependencies: options?.dependencies,
  });
}
