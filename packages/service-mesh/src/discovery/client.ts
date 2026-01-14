/**
 * Service Discovery Client
 * Client-side library for service discovery operations
 */

import {
  ServiceInstance,
  ServiceQuery,
  ServiceEndpoints,
  HealthStatus
} from '../types';

export interface DiscoveryClientConfig {
  registryUrl: string;
  cacheEnabled?: boolean;
  cacheTtl?: number;
  heartbeatInterval?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface RegistrationResult {
  success: boolean;
  instanceId?: string;
  ttl?: number;
  error?: string;
}

export class ServiceDiscoveryClient {
  private config: DiscoveryClientConfig;
  private cache: Map<string, { endpoints: ServiceEndpoints; expires: number }>;
  private localInstance?: ServiceInstance;
  private heartbeatTimer?: number;
  private env: any;

  constructor(config: DiscoveryClientConfig, env: any = {}) {
    this.config = {
      ...config,
      cacheEnabled: config.cacheEnabled ?? true,
      cacheTtl: config.cacheTtl ?? 5000,
      heartbeatInterval: config.heartbeatInterval ?? 10000,
      retryAttempts: config.retryAttempts ?? 3,
      retryDelay: config.retryDelay ?? 1000
    };
    this.cache = new Map();
    this.env = env;
  }

  /**
   * Register a service instance
   */
  async register(instance: ServiceInstance, ttl: number = 30000): Promise<RegistrationResult> {
    try {
      const response = await this.withRetry(() =>
        fetch(`${this.config.registryUrl}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceName: instance.serviceName,
            instance,
            ttl
          })
        })
      );

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error || 'Registration failed'
        };
      }

      const result = await response.json();
      this.localInstance = instance;

      // Start heartbeat
      this.startHeartbeat(instance.serviceName, instance.id);

      return {
        success: true,
        instanceId: result.instanceId,
        ttl: result.ttl
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Deregister a service instance
   */
  async deregister(serviceName: string, instanceId: string): Promise<boolean> {
    try {
      this.stopHeartbeat();

      const response = await this.withRetry(() =>
        fetch(`${this.config.registryUrl}/deregister?serviceName=${encodeURIComponent(serviceName)}&instanceId=${encodeURIComponent(instanceId)}`, {
          method: 'DELETE'
        })
      );

      if (!response.ok) {
        return false;
      }

      this.localInstance = undefined;
      this.clearCache();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Discover service endpoints
   */
  async discover(serviceName: string, options: Partial<ServiceQuery> = {}): Promise<ServiceEndpoints | null> {
    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.getFromCache(serviceName, options);
      if (cached) {
        return cached;
      }
    }

    try {
      const params = new URLSearchParams({
        serviceName,
        ...(options.healthyOnly !== undefined && { healthyOnly: String(options.healthyOnly) }),
        ...(options.region && { region: options.region }),
        ...(options.tags && options.tags.length > 0 && { tags: options.tags.join(',') })
      });

      const response = await this.withRetry(() =>
        fetch(`${this.config.registryUrl}/discover?${params}`)
      );

      if (!response.ok) {
        return null;
      }

      const endpoints: ServiceEndpoints = await response.json();

      // Cache the result
      if (this.config.cacheEnabled) {
        this.setToCache(serviceName, options, endpoints);
      }

      return endpoints;
    } catch (error) {
      console.error('Discovery failed:', error);
      return null;
    }
  }

  /**
   * Query services with complex criteria
   */
  async query(query: ServiceQuery): Promise<ServiceEndpoints | null> {
    try {
      const response = await this.withRetry(() =>
        fetch(`${this.config.registryUrl}/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(query)
        })
      );

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Query failed:', error);
      return null;
    }
  }

  /**
   * Get all registered services
   */
  async listServices(): Promise<Array<{ name: string; instanceCount: number; healthyCount: number }> | null> {
    try {
      const response = await this.withRetry(() =>
        fetch(`${this.config.registryUrl}/list`)
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.services;
    } catch (error) {
      console.error('List services failed:', error);
      return null;
    }
  }

  /**
   * Check registry health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.registryUrl}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get service events
   */
  async getEvents(options: {
    limit?: number;
    eventType?: string;
    serviceName?: string;
  } = {}): Promise<any[] | null> {
    try {
      const params = new URLSearchParams({
        ...(options.limit && { limit: String(options.limit) }),
        ...(options.eventType && { eventType: options.eventType }),
        ...(options.serviceName && { serviceName: options.serviceName })
      });

      const response = await fetch(`${this.config.registryUrl}/events?${params}`);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.events;
    } catch (error) {
      console.error('Get events failed:', error);
      return null;
    }
  }

  /**
   * Select an instance using load balancing
   */
  async selectInstance(
    serviceName: string,
    strategy: 'random' | 'round-robin' | 'least-connections' | 'weighted' = 'random',
    options: Partial<ServiceQuery> = {}
  ): Promise<ServiceInstance | null> {
    const endpoints = await this.discover(serviceName, options);

    if (!endpoints || endpoints.instances.length === 0) {
      return null;
    }

    const instances = endpoints.instances;

    switch (strategy) {
      case 'random':
        return instances[Math.floor(Math.random() * instances.length)];

      case 'round-robin':
        const counter = this.getRoundRobinCounter(serviceName);
        return instances[counter % instances.length];

      case 'least-connections':
        return instances.reduce((min, instance) =>
          (instance.metadata.activeConnections || 0) < (min.metadata.activeConnections || 0)
            ? instance
            : min
        );

      case 'weighted':
        const totalWeight = instances.reduce((sum, i) => sum + i.weight, 0);
        let random = Math.random() * totalWeight;
        for (const instance of instances) {
          random -= instance.weight;
          if (random <= 0) {
            return instance;
          }
        }
        return instances[instances.length - 1];

      default:
        return instances[0];
    }
  }

  /**
   * Watch for service changes
   */
  async watch(
    serviceName: string,
    callback: (endpoints: ServiceEndpoints) => void,
    options: Partial<ServiceQuery> = {}
  ): Promise<() => void> {
    let cancelled = false;
    let previousHash: string | null = null;

    const poll = async () => {
      if (cancelled) return;

      try {
        const endpoints = await this.discover(serviceName, options);

        if (endpoints) {
          const hash = this.hashEndpoints(endpoints);

          if (previousHash && hash !== previousHash) {
            callback(endpoints);
          }

          previousHash = hash;
        }
      } catch (error) {
        console.error('Watch error:', error);
      }

      // Poll again
      setTimeout(poll, 5000);
    };

    poll();

    return () => {
      cancelled = true;
    };
  }

  /**
   * Get service instance URL
   */
  getInstanceUrl(instance: ServiceInstance, path: string = ''): string {
    return `${instance.protocol}://${instance.host}:${instance.port}${path}`;
  }

  /**
   * Clear the discovery cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private getCacheKey(serviceName: string, options: Partial<ServiceQuery>): string {
    return `${serviceName}:${JSON.stringify(options)}`;
  }

  private getFromCache(serviceName: string, options: Partial<ServiceQuery>): ServiceEndpoints | null {
    const key = this.getCacheKey(serviceName, options);
    const cached = this.cache.get(key);

    if (cached && cached.expires > Date.now()) {
      return cached.endpoints;
    }

    this.cache.delete(key);
    return null;
  }

  private setToCache(serviceName: string, options: Partial<ServiceQuery>, endpoints: ServiceEndpoints): void {
    const key = this.getCacheKey(serviceName, options);
    this.cache.set(key, {
      endpoints,
      expires: Date.now() + this.config.cacheTtl!
    });
  }

  private startHeartbeat(serviceName: string, instanceId: string): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(
      async () => {
        try {
          await fetch(`${this.config.registryUrl}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serviceName, instanceId })
          });
        } catch (error) {
          console.error('Heartbeat failed:', error);
        }
      },
      this.config.heartbeatInterval
    ) as unknown as number;
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < this.config.retryAttempts!; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < this.config.retryAttempts! - 1) {
          await new Promise(resolve =>
            setTimeout(resolve, this.config.retryDelay! * Math.pow(2, i))
          );
        }
      }
    }

    throw lastError;
  }

  private getRoundRobinCounter(serviceName: string): number {
    const key = `rr_counter_${serviceName}`;
    const counter = parseInt(globalThis[key] || '0', 10);
    globalThis[key] = String(counter + 1);
    return counter;
  }

  private hashEndpoints(endpoints: ServiceEndpoints): string {
    const instanceIds = endpoints.instances
      .map(i => i.id)
      .sort()
      .join(',');
    return `${endpoints.serviceName}:${instanceIds}:${endpoints.timestamp}`;
  }

  /**
   * Cleanup on destroy
   */
  async destroy(): Promise<void> {
    this.stopHeartbeat();

    if (this.localInstance) {
      await this.deregister(this.localInstance.serviceName, this.localInstance.id);
    }

    this.clearCache();
  }
}
