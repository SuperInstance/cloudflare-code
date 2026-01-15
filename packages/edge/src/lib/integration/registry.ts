/**
 * Package Registry
 *
 * Central registry for all packages in the ClaudeFlare ecosystem.
 * Handles registration, discovery, health monitoring, and lifecycle management.
 */

import type {
  PackageIdentifier,
  PackageMetadata,
  PackageHealth,
  PackageHealthStatus,
  ServiceDiscoveryRequest,
  ServiceDiscoveryResult,
  PackageRegistryConfig,
  PackageRegistryStats,
  PackageCapability,
} from './types';

/**
 * Package Registry
 *
 * Manages all registered packages and their lifecycle.
 */
export class PackageRegistry {
  private kv?: KVNamespace;
  private doNamespace?: DurableObjectNamespace;
  private options: Required<Omit<PackageRegistryConfig, 'persistence'>> & {
    persistence?: PackageRegistryConfig['persistence'];
  };

  // In-memory stores
  private packages: Map<string, PackageMetadata>;
  private health: Map<string, PackageHealth>;
  private capabilities: Map<string, Set<string>>; // capability -> package IDs
  private startTime: number;

  // Health monitoring
  private healthCheckTimer?: ReturnType<typeof setInterval>;
  private healthCheckCallbacks: Map<string, (health: PackageHealth) => void>;

  // Statistics
  private stats: PackageRegistryStats;

  constructor(config: PackageRegistryConfig = {}) {
    if (config.persistence?.kv !== undefined) {
      this.kv = config.persistence.kv;
    }
    if (config.persistence?.doNamespace !== undefined) {
      this.doNamespace = config.persistence.doNamespace;
    }

    this.options = {
      enableDiscovery: config.enableDiscovery ?? true,
      enableHealthMonitoring: config.enableHealthMonitoring ?? true,
      healthCheckInterval: config.healthCheckInterval ?? 30000, // 30 seconds
      healthCheckTimeout: config.healthCheckTimeout ?? 5000, // 5 seconds
      enableEventBus: config.enableEventBus ?? true,
      eventRetention: config.eventRetention ?? 3600000, // 1 hour
      maxEvents: config.maxEvents ?? 10000,
      persistence: config.persistence,
    };

    this.packages = new Map();
    this.health = new Map();
    this.capabilities = new Map();
    this.healthCheckCallbacks = new Map();
    this.startTime = Date.now();

    this.stats = {
      totalPackages: 0,
      packagesByType: {},
      packagesByHealth: {
        healthy: 0,
        degraded: 0,
        unhealthy: 0,
        unknown: 0,
      },
      totalCapabilities: 0,
      totalSubscriptions: 0,
      totalInvocations: 0,
      successfulInvocations: 0,
      failedInvocations: 0,
      avgResponseTime: 0,
      uptime: 0,
    };

    // Start health monitoring
    if (this.options.enableHealthMonitoring) {
      this.startHealthMonitoring();
    }

    // Load persisted state
    this.loadState();
  }

  /**
   * Register a package
   */
  async registerPackage(metadata: PackageMetadata): Promise<void> {
    const packageKey = this.getPackageKey(metadata.id);

    // Check if package already registered
    if (this.packages.has(packageKey)) {
      throw new Error(`Package ${metadata.id.name}@${metadata.id.version} is already registered`);
    }

    // Store package metadata
    this.packages.set(packageKey, metadata);

    // Initialize health as unknown
    this.health.set(packageKey, {
      package: metadata.id,
      status: 'unknown',
      timestamp: Date.now(),
    });

    // Index capabilities
    for (const capability of metadata.capabilities) {
      let packageIds = this.capabilities.get(capability.name);
      if (!packageIds) {
        packageIds = new Set();
        this.capabilities.set(capability.name, packageIds);
      }
      packageIds.add(packageKey);
    }

    // Update statistics
    this.stats.totalPackages++;
    this.stats.packagesByType[metadata.type] =
      (this.stats.packagesByType[metadata.type] || 0) + 1;
    this.stats.totalCapabilities += metadata.capabilities.length;

    // Persist state
    await this.saveState();

    // Perform initial health check
    if (this.options.enableHealthMonitoring) {
      void this.performHealthCheck(metadata.id);
    }
  }

  /**
   * Unregister a package
   */
  async unregisterPackage(id: PackageIdentifier): Promise<boolean> {
    const packageKey = this.getPackageKey(id);
    const metadata = this.packages.get(packageKey);

    if (!metadata) {
      return false;
    }

    // Remove from packages
    this.packages.delete(packageKey);

    // Remove health status
    this.health.delete(packageKey);

    // Remove from capabilities index
    for (const capability of metadata.capabilities) {
      const packageIds = this.capabilities.get(capability.name);
      if (packageIds) {
        packageIds.delete(packageKey);
        if (packageIds.size === 0) {
          this.capabilities.delete(capability.name);
        }
      }
    }

    // Update statistics
    this.stats.totalPackages--;
    this.stats.packagesByType[metadata.type]--;
    this.stats.totalCapabilities -= metadata.capabilities.length;

    // Persist state
    await this.saveState();

    return true;
  }

  /**
   * Get package metadata
   */
  getPackage(id: PackageIdentifier): PackageMetadata | undefined {
    return this.packages.get(this.getPackageKey(id));
  }

  /**
   * Get package health
   */
  getHealth(id: PackageIdentifier): PackageHealth | undefined {
    return this.health.get(this.getPackageKey(id));
  }

  /**
   * Update package health
   */
  async updateHealth(id: PackageIdentifier, health: Omit<PackageHealth, 'package'>): Promise<void> {
    const packageKey = this.getPackageKey(id);
    const existing = this.health.get(packageKey);

    if (existing) {
      // Update stats if status changed
      if (existing.status !== health.status) {
        this.stats.packagesByHealth[existing.status]--;
        this.stats.packagesByHealth[health.status]++;
      }
    } else {
      this.stats.packagesByHealth[health.status]++;
    }

    this.health.set(packageKey, {
      package: id,
      ...health,
    });

    await this.saveState();
  }

  /**
   * Discover services based on criteria
   */
  discover(request: ServiceDiscoveryRequest): ServiceDiscoveryResult {
    const candidates: Array<{
      metadata: PackageMetadata;
      health: PackageHealth;
    }> = [];

    // Filter packages based on criteria
    for (const [packageKey, metadata] of this.packages.entries()) {
      const health = this.health.get(packageKey);
      if (!health) continue;

      // Filter by capability
      if (request.capability) {
        const hasCapability = metadata.capabilities.some(
          (c) => c.name === request.capability
        );
        if (!hasCapability) continue;
      }

      // Filter by type
      if (request.type && metadata.type !== request.type) continue;

      // Filter by tags
      if (request.tags && request.tags.length > 0) {
        const hasAllTags = request.tags.every((tag) =>
          metadata.tags?.includes(tag)
        );
        if (!hasAllTags) continue;
      }

      // Filter by health status
      if (request.minHealth) {
        const healthOrder = ['healthy', 'degraded', 'unhealthy', 'unknown'];
        const currentLevel = healthOrder.indexOf(health.status);
        const minLevel = healthOrder.indexOf(request.minHealth);
        if (currentLevel < minLevel) continue;
      }

      // Filter by response time
      if (request.maxResponseTime && health.metrics?.responseTime) {
        if (health.metrics.responseTime > request.maxResponseTime) continue;
      }

      candidates.push({ metadata, health });
    }

    // Sort candidates by health and priority
    candidates.sort((a, b) => {
      // Prefer healthy packages
      const healthOrder = { healthy: 3, degraded: 2, unknown: 1, unhealthy: 0 };
      const healthDiff = healthOrder[b.health.status] - healthOrder[a.health.status];
      if (healthDiff !== 0) return healthDiff;

      // Then by priority
      const priorityDiff = (b.metadata.priority || 0) - (a.metadata.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;

      // Then by response time
      const aTime = a.health.metrics?.responseTime ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.health.metrics?.responseTime ?? Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });

    // Select best match
    let selected: { metadata: PackageMetadata; health: PackageHealth } | undefined;

    if (request.preferred && request.preferred.length > 0) {
      // Try to find preferred package
      for (const preferred of request.preferred) {
        const found = candidates.find((c) => c.metadata.id.name === preferred);
        if (found) {
          selected = found;
          break;
        }
      }
    }

    // Fallback to first candidate if no preferred found
    if (!selected && candidates.length > 0) {
      selected = candidates[0];
    }

    return {
      packages: candidates,
      selected,
      timestamp: Date.now(),
    };
  }

  /**
   * Get all registered packages
   */
  getAllPackages(): Array<{
    metadata: PackageMetadata;
    health: PackageHealth;
  }> {
    const result: Array<{
      metadata: PackageMetadata;
      health: PackageHealth;
    }> = [];

    for (const [packageKey, metadata] of this.packages.entries()) {
      const health = this.health.get(packageKey);
      if (health) {
        result.push({ metadata, health });
      }
    }

    return result;
  }

  /**
   * Get packages by capability
   */
  getPackagesByCapability(capabilityName: string): Array<{
    metadata: PackageMetadata;
    health: PackageHealth;
  }> {
    const packageIds = this.capabilities.get(capabilityName);
    if (!packageIds) return [];

    const result: Array<{
      metadata: PackageMetadata;
      health: PackageHealth;
    }> = [];

    for (const packageKey of packageIds) {
      const metadata = this.packages.get(packageKey);
      const health = this.health.get(packageKey);
      if (metadata && health) {
        result.push({ metadata, health });
      }
    }

    return result;
  }

  /**
   * Get packages by type
   */
  getPackagesByType(type: PackageMetadata['type']): Array<{
    metadata: PackageMetadata;
    health: PackageHealth;
  }> {
    const result: Array<{
      metadata: PackageMetadata;
      health: PackageHealth;
    }> = [];

    for (const [packageKey, metadata] of this.packages.entries()) {
      if (metadata.type === type) {
        const health = this.health.get(packageKey);
        if (health) {
          result.push({ metadata, health });
        }
      }
    }

    return result;
  }

  /**
   * Get all available capabilities
   */
  getCapabilities(): PackageCapability[] {
    const capabilities: PackageCapability[] = [];

    for (const [packageKey, metadata] of this.packages.entries()) {
      for (const capability of metadata.capabilities) {
        capabilities.push(capability);
      }
    }

    return capabilities;
  }

  /**
   * Get registry statistics
   */
  getStats(): PackageRegistryStats {
    this.stats.uptime = Date.now() - this.startTime;
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalPackages: this.stats.totalPackages,
      packagesByType: { ...this.stats.packagesByType },
      packagesByHealth: { ...this.stats.packagesByHealth },
      totalCapabilities: this.stats.totalCapabilities,
      totalSubscriptions: this.stats.totalSubscriptions,
      totalInvocations: 0,
      successfulInvocations: 0,
      failedInvocations: 0,
      avgResponseTime: 0,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Perform health check for a package
   */
  async performHealthCheck(id: PackageIdentifier): Promise<PackageHealth | null> {
    const metadata = this.getPackage(id);
    if (!metadata) return null;

    const startTime = Date.now();
    let status: PackageHealthStatus = 'healthy';
    const metrics: PackageHealth['metrics'] = {};

    try {
      // If package has health check endpoint, call it
      if (metadata.healthCheck && metadata.location) {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.options.healthCheckTimeout
        );

        if (metadata.location.type === 'local' || metadata.location.type === 'remote') {
          const endpoint = metadata.location.endpoint
            ? `${metadata.location.endpoint}${metadata.healthCheck}`
            : metadata.healthCheck;

          const response = await fetch(endpoint, {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!response.ok) {
            status = response.status >= 500 ? 'unhealthy' : 'degraded';
          }

          metrics.responseTime = Date.now() - startTime;
        }
      } else {
        // No health check endpoint, assume healthy if package is registered
        status = 'healthy';
      }
    } catch (error) {
      status = 'unhealthy';
      metrics.responseTime = Date.now() - startTime;
    }

    const health: PackageHealth = {
      package: id,
      status,
      timestamp: Date.now(),
      metrics,
    };

    await this.updateHealth(id, health);

    // Notify callbacks
    const callback = this.healthCheckCallbacks.get(this.getPackageKey(id));
    if (callback) {
      callback(health);
    }

    return health;
  }

  /**
   * Register health check callback
   */
  onHealthChange(id: PackageIdentifier, callback: (health: PackageHealth) => void): void {
    this.healthCheckCallbacks.set(this.getPackageKey(id), callback);
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      const packages = Array.from(this.packages.values()).map((p) => p.id);
      await Promise.all(
        packages.map((id) => this.performHealthCheck(id))
      );
    }, this.options.healthCheckInterval);
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Get package key for storage
   */
  private getPackageKey(id: PackageIdentifier): string {
    return `${id.name}@${id.version}`;
  }

  /**
   * Save state to persistence
   */
  private async saveState(): Promise<void> {
    if (!this.kv) return;

    try {
      const state = {
        packages: Array.from(this.packages.entries()),
        health: Array.from(this.health.entries()),
        capabilities: Array.from(this.capabilities.entries()).map(([key, set]) => [
          key,
          Array.from(set),
        ]),
        stats: this.stats,
      };

      await this.kv.put('package-registry', JSON.stringify(state), {
        expirationTtl: this.options.healthCheckInterval / 1000 + 60,
      });
    } catch (error) {
      console.error('Failed to save package registry state:', error);
    }
  }

  /**
   * Load state from persistence
   */
  private async loadState(): Promise<void> {
    if (!this.kv) return;

    try {
      const data = await this.kv.get('package-registry', 'json');
      if (!data) return;

      const state = data as {
        packages: Array<[string, PackageMetadata]>;
        health: Array<[string, PackageHealth]>;
        capabilities: Array<[string, string[]]>;
        stats: PackageRegistryStats;
      };

      this.packages = new Map(state.packages);
      this.health = new Map(state.health);
      this.capabilities = new Map(
        state.capabilities.map(([key, arr]) => [key, new Set(arr)])
      );
      this.stats = state.stats;
    } catch (error) {
      console.error('Failed to load package registry state:', error);
    }
  }

  /**
   * Dispose of registry resources
   */
  dispose(): void {
    this.stopHealthMonitoring();
    this.packages.clear();
    this.health.clear();
    this.capabilities.clear();
    this.healthCheckCallbacks.clear();
  }
}

/**
 * Create a package registry
 */
export function createPackageRegistry(
  config?: PackageRegistryConfig
): PackageRegistry {
  return new PackageRegistry(config);
}
