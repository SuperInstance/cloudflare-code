/**
 * Multi-CDN Support
 *
 * Advanced multi-CDN routing with failover and load balancing.
 */

import { EventEmitter } from 'events';
import PQueue from 'p-queue';
import type {
  CDNProvider,
  IMultiCDNConfig,
  IProviderStatus,
  IHealthCheckConfig,
  ICDNResponse,
  IRequestContext
} from '../types/index.js';

export interface IProviderConfig {
  provider: CDNProvider;
  enabled: boolean;
  weight: number;
  priority: number;
  config: Record<string, any>;
}

export class MultiCDNProvider extends EventEmitter {
  private config: IMultiCDNConfig;
  private providers: Map<CDNProvider, IProviderConfig>;
  private providerStatus: Map<CDNProvider, IProviderStatus>;
  private requestQueue: PQueue;
  private healthCheckInterval?: NodeJS.Timeout;
  private currentIndex: number = 0;

  constructor(config: IMultiCDNConfig) {
    super();

    this.config = config;
    this.providers = new Map();
    this.providerStatus = new Map();

    // Initialize primary provider
    this.providers.set(config.primary, {
      provider: config.primary,
      enabled: true,
      weight: config.weights?.get(config.primary) ?? 100,
      priority: 1,
      config: {}
    });

    // Initialize fallback providers
    if (config.fallback) {
      for (let i = 0; i < config.fallback.length; i++) {
        const provider = config.fallback[i];
        this.providers.set(provider, {
          provider,
          enabled: true,
          weight: config.weights?.get(provider) ?? 50,
          priority: i + 2,
          config: {}
        });
      }
    }

    // Initialize status for all providers
    for (const provider of this.providers.keys()) {
      this.providerStatus.set(provider, {
        provider,
        healthy: true,
        responseTime: 0,
        lastCheck: new Date(),
        consecutiveFailures: 0
      });
    }

    this.requestQueue = new PQueue({ concurrency: 10 });

    // Start health checks
    if (this.config.healthCheck) {
      this.startHealthChecks();
    }
  }

  /**
   * Route request to best provider
   */
  public async route(context: IRequestContext): Promise<ICDNResponse> {
    const provider = this.selectProvider(context);

    if (!provider) {
      throw new Error('No healthy CDN providers available');
    }

    const startTime = Date.now();

    try {
      const response = await this.requestFromProvider(provider, context);

      // Update provider status
      const status = this.providerStatus.get(provider)!;
      status.responseTime = Date.now() - startTime;
      status.lastCheck = new Date();
      status.consecutiveFailures = 0;

      return {
        ...response,
        provider,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      // Mark provider as unhealthy
      const status = this.providerStatus.get(provider)!;
      status.consecutiveFailures++;
      status.lastCheck = new Date();

      if (status.consecutiveFailures >= (this.config.failoverThreshold ?? 3)) {
        status.healthy = false;
        this.emit('provider_unhealthy', provider);
      }

      // Try fallback provider
      const fallback = this.selectFallbackProvider(provider);
      if (fallback) {
        this.emit('failover', { from: provider, to: fallback });
        return this.route(context);
      }

      throw error;
    }
  }

  /**
   * Select best provider
   */
  private selectProvider(context: IRequestContext): CDNProvider | null {
    const healthyProviders = Array.from(this.providers.values())
      .filter(p => p.enabled)
      .filter(p => {
        const status = this.providerStatus.get(p.provider)!;
        return status.healthy;
      })
      .sort((a, b) => a.priority - b.priority);

    if (healthyProviders.length === 0) {
      return null;
    }

    switch (this.config.strategy) {
      case 'round_robin':
        return this.selectRoundRobin(healthyProviders);
      case 'weighted':
        return this.selectWeighted(healthyProviders);
      case 'geographic':
        return this.selectGeographic(healthyProviders, context);
      case 'performance':
        return this.selectPerformance(healthyProviders);
      default:
        return healthyProviders[0].provider;
    }
  }

  /**
   * Select provider using round-robin
   */
  private selectRoundRobin(providers: IProviderConfig[]): CDNProvider {
    const provider = providers[this.currentIndex % providers.length];
    this.currentIndex++;
    return provider.provider;
  }

  /**
   * Select provider using weighted random
   */
  private selectWeighted(providers: IProviderConfig[]): CDNProvider {
    const totalWeight = providers.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;

    for (const provider of providers) {
      random -= provider.weight;
      if (random <= 0) {
        return provider.provider;
      }
    }

    return providers[0].provider;
  }

  /**
   * Select provider based on geography
   */
  private selectGeographic(
    providers: IProviderConfig[],
    context: IRequestContext
  ): CDNProvider {
    // In a real implementation, you would use geo-IP data
    // to select the closest provider
    return providers[0].provider;
  }

  /**
   * Select provider based on performance
   */
  private selectPerformance(providers: IProviderConfig[]): CDNProvider {
    const sorted = [...providers].sort((a, b) => {
      const statusA = this.providerStatus.get(a.provider)!;
      const statusB = this.providerStatus.get(b.provider)!;
      return statusA.responseTime - statusB.responseTime;
    });

    return sorted[0].provider;
  }

  /**
   * Select fallback provider
   */
  private selectFallbackProvider(failedProvider: CDNProvider): CDNProvider | null {
    const providers = Array.from(this.providers.values())
      .filter(p => p.provider !== failedProvider)
      .filter(p => p.enabled)
      .filter(p => {
        const status = this.providerStatus.get(p.provider)!;
        return status.healthy;
      })
      .sort((a, b) => a.priority - b.priority);

    return providers.length > 0 ? providers[0].provider : null;
  }

  /**
   * Request from provider
   */
  private async requestFromProvider(
    provider: CDNProvider,
    context: IRequestContext
  ): Promise<Omit<ICDNResponse, 'provider' | 'responseTime'>> {
    // In a real implementation, you would make an actual request
    // to the provider's API
    return {
      status: 200,
      headers: {},
      body: '',
      fromCache: false
    };
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    const interval = this.config.healthCheck!.interval;

    this.healthCheckInterval = setInterval(async () => {
      for (const provider of this.providers.keys()) {
        await this.checkProviderHealth(provider);
      }
    }, interval);
  }

  /**
   * Check provider health
   */
  private async checkProviderHealth(provider: CDNProvider): Promise<void> {
    const status = this.providerStatus.get(provider)!;
    const config = this.providers.get(provider)!;

    if (!config.enabled) {
      return;
    }

    try {
      const startTime = Date.now();

      // Perform health check
      const isHealthy = await this.performHealthCheck(provider);

      status.responseTime = Date.now() - startTime;
      status.lastCheck = new Date();

      if (isHealthy) {
        if (!status.healthy) {
          status.healthy = true;
          status.consecutiveFailures = 0;
          this.emit('provider_healthy', provider);
        }
      } else {
        status.consecutiveFailures++;

        if (status.consecutiveFailures >= (this.config.healthCheck!.unhealthyThreshold ?? 3)) {
          if (status.healthy) {
            status.healthy = false;
            this.emit('provider_unhealthy', provider);
          }
        }
      }
    } catch (error) {
      status.consecutiveFailures++;
      status.lastCheck = new Date();

      if (status.consecutiveFailures >= (this.config.healthCheck!.unhealthyThreshold ?? 3)) {
        if (status.healthy) {
          status.healthy = false;
          this.emit('provider_unhealthy', provider);
        }
      }
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(provider: CDNProvider): Promise<boolean> {
    const config = this.config.healthCheck!;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      // Make health check request
      const response = await fetch(config.path, {
        signal: controller.signal,
        method: 'HEAD'
      });

      clearTimeout(timeoutId);

      return response.status === config.expectedStatus;
    } catch (error) {
      return false;
    }
  }

  /**
   * Enable provider
   */
  public enableProvider(provider: CDNProvider): void {
    const config = this.providers.get(provider);
    if (config) {
      config.enabled = true;
      this.emit('provider_enabled', provider);
    }
  }

  /**
   * Disable provider
   */
  public disableProvider(provider: CDNProvider): void {
    const config = this.providers.get(provider);
    if (config) {
      config.enabled = false;
      this.emit('provider_disabled', provider);
    }
  }

  /**
   * Get provider status
   */
  public getProviderStatus(provider: CDNProvider): IProviderStatus | null {
    return this.providerStatus.get(provider) ?? null;
  }

  /**
   * Get all provider statuses
   */
  public getAllProviderStatuses(): IProviderStatus[] {
    return Array.from(this.providerStatus.values());
  }

  /**
   * Get healthy providers
   */
  public getHealthyProviders(): CDNProvider[] {
    return Array.from(this.providerStatus.entries())
      .filter(([_, status]) => status.healthy)
      .map(([provider, _]) => provider);
  }

  /**
   * Get statistics
   */
  public getStatistics(): {
    totalProviders: number;
    healthyProviders: number;
    unhealthyProviders: number;
    primaryProvider: CDNProvider;
    strategy: string;
  } {
    const statuses = Array.from(this.providerStatus.values());
    const healthy = statuses.filter(s => s.healthy).length;

    return {
      totalProviders: statuses.length,
      healthyProviders: healthy,
      unhealthyProviders: statuses.length - healthy,
      primaryProvider: this.config.primary,
      strategy: this.config.strategy
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<IMultiCDNConfig>): void {
    Object.assign(this.config, updates);

    // Restart health checks if config changed
    if (updates.healthCheck && this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.startHealthChecks();
    }
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.providers.clear();
    this.providerStatus.clear();
    this.removeAllListeners();
  }
}

export default MultiCDNProvider;
