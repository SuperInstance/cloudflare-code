/**
 * Provider Registry
 *
 * Manages registration, health checks, and retrieval of AI providers.
 * Provides centralized access to all available providers with real-time health monitoring.
 */

import type {
  ProviderClient,
  QuotaInfo,
  HealthStatus,
  ProviderCapabilities,
} from './base';

/**
 * Registry configuration
 */
export interface RegistryConfig {
  /** Health check interval in milliseconds */
  healthCheckInterval?: number;
  /** Health check timeout in milliseconds */
  healthCheckTimeout?: number;
  /** Minimum success rate to consider provider healthy (0-1) */
  minSuccessRate?: number;
  /** Maximum average latency to consider provider healthy (ms) */
  maxLatency?: number;
  /** Enable automatic health checks */
  autoHealthCheck?: boolean;
}

/**
 * Provider with metadata
 */
export interface ProviderMetadata {
  /** Provider instance */
  provider: ProviderClient;
  /** Is provider enabled */
  enabled: boolean;
  /** Priority for routing (higher = preferred) */
  priority: number;
  /** Last health check timestamp */
  lastHealthCheck: number;
  /** Current health status */
  healthStatus: HealthStatus;
  /** Is provider currently healthy */
  isHealthy: boolean;
}

/**
 * Provider Registry class
 */
export class ProviderRegistry {
  private providers: Map<string, ProviderMetadata> = new Map();
  private config: Required<RegistryConfig>;
  private healthCheckTimer?: ReturnType<typeof setInterval>;

  constructor(config: RegistryConfig = {}) {
    this.config = {
      healthCheckInterval: config.healthCheckInterval || 60000, // 1 minute
      healthCheckTimeout: config.healthCheckTimeout || 5000, // 5 seconds
      minSuccessRate: config.minSuccessRate || 0.9, // 90%
      maxLatency: config.maxLatency || 5000, // 5 seconds
      autoHealthCheck: config.autoHealthCheck ?? true,
    };

    // Start automatic health checks if enabled
    if (this.config.autoHealthCheck) {
      this.startHealthChecks();
    }
  }

  /**
   * Register a new provider
   */
  register(provider: ProviderClient, options: { priority?: number; enabled?: boolean } = {}): void {
    const metadata: ProviderMetadata = {
      provider,
      enabled: options.enabled ?? true,
      priority: options.priority ?? 0,
      lastHealthCheck: 0,
      healthStatus: {
        provider: provider.name,
        isHealthy: true,
        lastCheck: 0,
        avgLatency: provider.capabilities.avgLatency,
        successRate: 1.0,
        totalRequests: 0,
        failedRequests: 0,
        circuitState: 'closed',
      },
      isHealthy: true,
    };

    this.providers.set(provider.name, metadata);
  }

  /**
   * Unregister a provider
   */
  unregister(providerName: string): void {
    this.providers.delete(providerName);
  }

  /**
   * Get all registered providers
   */
  getAll(): ProviderClient[] {
    return Array.from(this.providers.values()).map((m) => m.provider);
  }

  /**
   * Get only enabled providers
   */
  getEnabled(): ProviderClient[] {
    return Array.from(this.providers.values())
      .filter((m) => m.enabled)
      .map((m) => m.provider);
  }

  /**
   * Get only available (enabled and healthy) providers
   */
  async getAvailable(): Promise<ProviderClient[]> {
    const available: ProviderClient[] = [];

    for (const metadata of this.providers.values()) {
      if (!metadata.enabled) continue;

      const isAvailable = await metadata.provider.isAvailable();
      if (isAvailable && metadata.isHealthy) {
        available.push(metadata.provider);
      }
    }

    return available;
  }

  /**
   * Get provider by name
   */
  getByName(name: string): ProviderClient | undefined {
    return this.providers.get(name)?.provider;
  }

  /**
   * Get providers that support a specific model
   */
  async getByModel(model: string): Promise<ProviderClient[]> {
    const available = await this.getAvailable();
    const supported: ProviderClient[] = [];

    for (const provider of available) {
      const models = await provider.getModelList();
      if (models.includes(model)) {
        supported.push(provider);
      }
    }

    return supported;
  }

  /**
   * Get provider metadata
   */
  getMetadata(providerName: string): ProviderMetadata | undefined {
    return this.providers.get(providerName);
  }

  /**
   * Enable or disable a provider
   */
  setEnabled(providerName: string, enabled: boolean): void {
    const metadata = this.providers.get(providerName);
    if (metadata) {
      metadata.enabled = enabled;
    }
  }

  /**
   * Set provider priority
   */
  setPriority(providerName: string, priority: number): void {
    const metadata = this.providers.get(providerName);
    if (metadata) {
      metadata.priority = priority;
    }
  }

  /**
   * Get all providers sorted by priority
   */
  async getByPriority(): Promise<ProviderClient[]> {
    const available = await this.getAvailable();
    return available.sort((a, b) => {
      const metadataA = this.providers.get(a.name)!;
      const metadataB = this.providers.get(b.name)!;
      return metadataB.priority - metadataA.priority;
    });
  }

  /**
   * Perform health check on a specific provider
   */
  async checkProviderHealth(providerName: string): Promise<HealthStatus> {
    const metadata = this.providers.get(providerName);
    if (!metadata) {
      throw new Error(`Provider '${providerName}' not found in registry`);
    }

    const startTime = Date.now();
    let isHealthy = true;

    try {
      // Test provider with timeout
      const testResult = await Promise.race<boolean>([
        metadata.provider.test(),
        new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), this.config.healthCheckTimeout)
        ),
      ]);

      const latency = Date.now() - startTime;
      const healthStatus = await metadata.provider.getHealthStatus();

      // Update health status
      metadata.healthStatus = {
        ...healthStatus,
        lastCheck: Date.now(),
        avgLatency: latency,
      };

      // Determine if healthy based on config
      isHealthy =
        testResult &&
        healthStatus.successRate >= this.config.minSuccessRate &&
        latency <= this.config.maxLatency &&
        healthStatus.circuitState !== 'open';

      metadata.isHealthy = isHealthy;
      metadata.lastHealthCheck = Date.now();

      return metadata.healthStatus;
    } catch (error) {
      isHealthy = false;
      metadata.isHealthy = false;
      metadata.lastHealthCheck = Date.now();

      metadata.healthStatus = {
        provider: providerName,
        isHealthy: false,
        lastCheck: Date.now(),
        avgLatency: Date.now() - startTime,
        successRate: 0,
        totalRequests: metadata.healthStatus.totalRequests,
        failedRequests: metadata.healthStatus.failedRequests,
        circuitState: 'open',
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      return metadata.healthStatus;
    }
  }

  /**
   * Perform health checks on all providers
   */
  async checkAllHealth(): Promise<Map<string, HealthStatus>> {
    const results = new Map<string, HealthStatus>();

    for (const providerName of this.providers.keys()) {
      const status = await this.checkProviderHealth(providerName);
      results.set(providerName, status);
    }

    return results;
  }

  /**
   * Get health status of all providers
   */
  getAllHealthStatus(): Map<string, HealthStatus> {
    const status = new Map<string, HealthStatus>();

    for (const [name, metadata] of this.providers.entries()) {
      status.set(name, metadata.healthStatus);
    }

    return status;
  }

  /**
   * Get quota information for all providers
   */
  async getAllQuotas(): Promise<Map<string, QuotaInfo>> {
    const quotas = new Map<string, QuotaInfo>();

    for (const [name, metadata] of this.providers.entries()) {
      try {
        const quota = await metadata.provider.getQuota();
        quotas.set(name, quota);
      } catch (error) {
        // Skip providers that fail to return quota
        continue;
      }
    }

    return quotas;
  }

  /**
   * Get capabilities of all providers
   */
  getAllCapabilities(): Map<string, ProviderCapabilities> {
    const capabilities = new Map<string, ProviderCapabilities>();

    for (const [name, metadata] of this.providers.entries()) {
      capabilities.set(name, metadata.provider.capabilities);
    }

    return capabilities;
  }

  /**
   * Get provider statistics
   */
  getStats(): {
    totalProviders: number;
    enabledProviders: number;
    healthyProviders: number;
    availableProviders: number;
  } {
    const totalProviders = this.providers.size;
    const enabledProviders = Array.from(this.providers.values()).filter((m) => m.enabled).length;
    const healthyProviders = Array.from(this.providers.values()).filter((m) => m.isHealthy).length;

    return {
      totalProviders,
      enabledProviders,
      healthyProviders,
      availableProviders: enabledProviders, // Will be updated asynchronously
    };
  }

  /**
   * Start automatic health checks
   */
  private startHealthChecks(): void {
    if (this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.checkAllHealth();
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop automatic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckTimer !== undefined) {
      clearInterval(this.healthCheckTimer);
      // Timer is cleared but value remains (timer will be ignored on next check)
      this.healthCheckTimer = undefined as unknown as ReturnType<typeof setInterval>;
    }
  }

  /**
   * Clear all registered providers
   */
  clear(): void {
    this.providers.clear();
  }

  /**
   * Destroy registry and cleanup resources
   */
  destroy(): void {
    this.stopHealthChecks();
    this.clear();
  }

  /**
   * Get registry configuration
   */
  getConfig(): Required<RegistryConfig> {
    return { ...this.config };
  }

  /**
   * Update registry configuration
   */
  updateConfig(config: Partial<RegistryConfig>): void {
    Object.assign(this.config, config);

    // Restart health checks if interval changed
    if (config.healthCheckInterval && this.healthCheckTimer) {
      this.stopHealthChecks();
      this.startHealthChecks();
    }
  }
}

/**
 * Create provider registry instance
 */
export function createProviderRegistry(config?: RegistryConfig): ProviderRegistry {
  return new ProviderRegistry(config);
}
